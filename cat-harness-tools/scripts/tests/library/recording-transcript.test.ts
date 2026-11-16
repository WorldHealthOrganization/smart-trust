/**
 * A recording as a library entry, and its transcripts — bean `folio-assistant-1r0p`.
 *
 * End to end on a synthetic recording: `recording-transcript.py` writes the
 * record and the source-language transcript from a whisper.cpp JSON,
 * `gen-library-jsonld --entry` writes the manifest and one block per
 * language, and `check:l1-complete` passes it. Then the gate's refusals:
 * no transcript, a translation cut at other times, one of other bytes, and a
 * stale translation reported without failing. Standard library Python only.
 *
 * @module scripts/tests/library/recording-transcript
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { RecordingSchema, TranscriptSchema, segmentsCanonical } from "../../../schemas/library/recording.ts";
import { checkEntry, entryKind } from "../../check-l1-complete.ts";

const SCRIPT = resolve(import.meta.dir, "../../recording-transcript.py");
const GEN = resolve(import.meta.dir, "../../../pipeline/gen-library-jsonld.ts");
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

const dec = (b: Uint8Array) => new TextDecoder().decode(b);
const py = (...args: string[]) => Bun.spawnSync(["python3", SCRIPT, ...args]);
const read = (p: string) => JSON.parse(readFileSync(p, "utf-8"));

const WHISPER = {
  model: { type: "base", multilingual: true },
  params: { model: "models/ggml-base.bin", language: "en", translate: false },
  result: { language: "en" },
  transcription: [
    { timestamps: { from: "00:00:00,000", to: "00:00:04,000" }, offsets: { from: 0, to: 4000 }, text: " Hello, this is a walkthrough." },
    { timestamps: { from: "00:00:04,000", to: "00:00:07,500" }, offsets: { from: 4000, to: 7500 }, text: " Second segment." },
  ],
};
const RECOGNISER = { tool: "transcribe-whisper-cpp", version: "231638a", model: "ggml-base.bin", model_sha256: "b".repeat(64) };

/** A staged entry: an MP4 by its signature, the record, the English transcript and the manifest. */
function staged(whisper: object = WHISPER): { root: string; entry: string } {
  const root = mkdtempSync(join(tmpdir(), "rec-"));
  made.push(root);
  const media = join(root, "talk.mp4");
  writeFileSync(media, Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(64)]));
  writeFileSync(join(root, "id.json"), JSON.stringify({ title: "A walkthrough", date: "2026-10-06", language: "en", speakers: ["A", "B"] }));
  writeFileSync(join(root, "whisper.json"), JSON.stringify(whisper));
  writeFileSync(join(root, "rec.json"), JSON.stringify(RECOGNISER));
  const lib = join(root, "library");
  const r = py("record", media, "-o", lib, "--identity", join(root, "id.json"), "--slug", "walkthrough");
  if (r.exitCode !== 0) throw new Error(dec(r.stderr));
  const entry = join(lib, "walkthrough");
  const t = py("transcript", entry, "--whisper-json", join(root, "whisper.json"), "--recogniser", join(root, "rec.json"), "--date", "2026-10-24");
  if (t.exitCode !== 0) throw new Error(dec(t.stderr));
  gen(entry);
  return { root, entry };
}

function gen(entry: string) {
  const g = Bun.spawnSync(["bun", "run", GEN, "--entry", entry]);
  if (g.exitCode !== 0) throw new Error(dec(g.stderr));
}

const audio = (entry: string) => checkEntry(entry).requirements.find((q) => q.name === "audio-transcripts");

/** A French translation of the entry's English transcript, as a translator would write it. */
function translate(entry: string, over: Record<string, unknown> = {}) {
  const en = read(join(entry, "transcript", "en.json"));
  const fr = {
    $schema: "folio-transcript/v1",
    lang: "fr",
    recording_sha256: en.recording_sha256,
    translated_from: { lang: "en", segments_sha256: createHash("sha256").update(segmentsCanonical(en.segments)).digest("hex") },
    state: "draft",
    drafted_by: { kind: "agent", id: "agy", model: "claude-opus-5" },
    segments: en.segments.map((s: { start_ms: number; end_ms: number }, i: number) => ({ ...s, text: `Segment ${i + 1} en français.` })),
    ...over,
  };
  writeFileSync(join(entry, "transcript", "fr.json"), JSON.stringify(fr, null, 2));
}

describe("the arm", () => {
  test("writes a valid record and a recogniser's draft, and the entry passes", () => {
    const { entry } = staged();
    const rec = RecordingSchema.parse(read(join(entry, "recording.json")));
    expect(rec.source.mimetype_sniffed).toBe("video/mp4");
    const en = TranscriptSchema.parse(read(join(entry, "transcript", "en.json")));
    expect(en.state).toBe("draft");
    expect(en.drafted_by).toEqual({ kind: "script", id: "transcribe-whisper-cpp", version: "231638a" });
    expect(en.segments).toEqual([
      { start_ms: 0, end_ms: 4000, text: "Hello, this is a walkthrough." },
      { start_ms: 4000, end_ms: 7500, text: "Second segment." },
    ]);
    expect(en.recording_sha256).toBe(rec.source.sha256);
    expect(entryKind((f) => f === "recording.json")).toBe("recording");
    expect(checkEntry(entry).requirements.filter((q) => q.state !== "met")).toEqual([]);
    expect(audio(entry)?.detail).toContain("en (source, draft)");
  });

  test("the manifest lists one transcript block, crediting its drafter", () => {
    const { entry } = staged();
    const m = read(join(entry, "manifest.jsonld"));
    expect(m.title).toBe("A walkthrough");
    expect(m.meta.title_from).toBe("recording.json identity.title");
    expect(m.contains).toHaveLength(1);
    const b = read(join(entry, "blocks", "transcript-en.jsonld"));
    expect(m.contains[0]).toBe(b["@id"]);
    expect(b.kind).toBe("transcript");
    expect(b.file).toBe("../transcript/en.json");
    expect(b.provenance).toEqual({ kind: "script", id: "transcribe-whisper-cpp", version: "231638a" });
  });

  test("the segments digest is one definition in Python and TypeScript", () => {
    const { entry } = staged();
    const en = read(join(entry, "transcript", "en.json"));
    const r = py("segments-sha256", join(entry, "transcript", "en.json"));
    expect(dec(r.stdout).trim()).toBe(createHash("sha256").update(segmentsCanonical(en.segments)).digest("hex"));
  });

  test("refuses an identity missing a field, a file that is not a recording, and a translate run", () => {
    const root = mkdtempSync(join(tmpdir(), "rec-"));
    made.push(root);
    writeFileSync(join(root, "id.json"), JSON.stringify({ title: "x", date: "2026-10-06" }));
    writeFileSync(join(root, "a.mp4"), Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom")]));
    const noLang = py("record", join(root, "a.mp4"), "-o", root, "--identity", join(root, "id.json"));
    expect(noLang.exitCode).toBe(1);
    expect(dec(noLang.stderr)).toContain("never guess");
    writeFileSync(join(root, "id.json"), JSON.stringify({ title: "x", date: "2026-10-06", language: "en" }));
    writeFileSync(join(root, "a.pdf"), "%PDF-1.4\n");
    const pdf = py("record", join(root, "a.pdf"), "-o", root, "--identity", join(root, "id.json"));
    expect(pdf.exitCode).toBe(1);
    expect(dec(pdf.stderr)).toContain("not audio or video");
    expect(() => staged({ ...WHISPER, params: { ...WHISPER.params, translate: true } })).toThrow("translation, not a transcript");
    expect(() => staged({ ...WHISPER, result: { language: "fr" } })).toThrow("the recogniser heard fr");
  });
});

describe("the gate", () => {
  test("a PDF entry is not a recording, said as a determined answer", () => {
    const d = mkdtempSync(join(tmpdir(), "rec-"));
    made.push(d);
    writeFileSync(
      join(d, "referenced.json"),
      JSON.stringify({ source: { mimetype_sniffed: "application/pdf" } }),
    );
    expect(audio(d)).toEqual({ name: "audio-transcripts", state: "met", detail: "not a recording (application/pdf)" });
  });

  test("a recording with no transcript in its spoken language is unmet", () => {
    const { entry } = staged();
    rmSync(join(entry, "transcript", "en.json"));
    expect(audio(entry)?.state).toBe("unmet");
    expect(audio(entry)?.detail).toContain("no transcript/en.json");
  });

  test("a translation passes; a stale one is reported and does not fail", () => {
    const { entry } = staged();
    translate(entry);
    gen(entry);
    expect(audio(entry)?.state).toBe("met");
    expect(audio(entry)?.detail).toContain("fr (translation, draft)");
    expect(read(join(entry, "manifest.jsonld")).contains).toHaveLength(2);
    const en = read(join(entry, "transcript", "en.json"));
    en.segments[0].text = "Hello, this is a corrected walkthrough.";
    writeFileSync(join(entry, "transcript", "en.json"), JSON.stringify(en, null, 2));
    expect(audio(entry)?.state).toBe("met");
    expect(audio(entry)?.detail).toContain("1 stale translation(s)");
  });

  test("a translation cut at other times, of other bytes, or in a misnamed file is unmet", () => {
    const { entry } = staged();
    translate(entry, { segments: [{ start_ms: 0, end_ms: 7500, text: "Tout en un." }] });
    expect(audio(entry)?.detail).toContain("not the source's, one for one");
    translate(entry, { recording_sha256: "c".repeat(64) });
    expect(audio(entry)?.detail).toContain("transcribes other bytes");
    translate(entry, { lang: "es" });
    expect(audio(entry)?.detail).toContain("holds lang es");
  });

  test("a transcript drafted by an agent with no model is unmet", () => {
    const { entry } = staged();
    translate(entry, { drafted_by: { kind: "agent", id: "agy" } });
    expect(audio(entry)?.state).toBe("unmet");
  });
});

describe("the ingest router", () => {
  test("a recording is refused with the route, not opened as a PDF", async () => {
    const { planFor } = await import("../../ingest-document.ts");
    const p = planFor("talk.mp4", undefined, "library", "video/mp4");
    expect(p.rung).toBe("undetermined");
    expect(p.why).toContain("recording-transcript.py");
    expect(p.steps).toEqual([]);
  });
});
