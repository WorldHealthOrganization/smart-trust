import { describe, expect, test } from "bun:test";

import { RecordingSchema, TranscriptSchema, asNarrative, isRecordingMimetype, segmentsCanonical } from "./recording.ts";

const SHA = "a".repeat(64);
const SOURCE = {
  file: "output.mp4",
  sha256: SHA,
  bytes: 24776789,
  mtime: "2026-10-06T10:00:00Z",
  mimetype_sniffed: "video/mp4",
  mimetype_source: "magic-bytes",
};

const transcript = (over: Record<string, unknown> = {}) => ({
  $schema: "folio-transcript/v1",
  lang: "en",
  recording_sha256: SHA,
  recogniser: { tool: "transcribe-whisper-cpp", version: "231638a", model: "ggml-base.bin", model_sha256: "b".repeat(64) },
  state: "draft",
  drafted_by: { kind: "script", id: "transcribe-whisper-cpp", version: "231638a" },
  segments: [
    { start_ms: 0, end_ms: 9880, text: " Hi, this is a walkthrough." },
    { start_ms: 9880, end_ms: 12000, text: "Second segment." },
  ],
  ...over,
});

describe("RecordingSchema", () => {
  test("accepts a recording record", () => {
    const r = RecordingSchema.safeParse({
      $schema: "folio-recording/v1",
      identity: { title: "A walkthrough", date: "2026-10-06", language: "en", speakers: ["A", "B"] },
      source: SOURCE,
      duration_s: 1028.99,
    });
    expect(r.success).toBe(true);
  });

  test("refuses a recording with no language", () => {
    const r = RecordingSchema.safeParse({
      $schema: "folio-recording/v1",
      identity: { title: "A walkthrough", date: "2026-10-06" },
      source: SOURCE,
      duration_s: null,
    });
    expect(r.success).toBe(false);
  });

  test("audio and video are recordings, a PDF is not", () => {
    expect(isRecordingMimetype("video/mp4")).toBe(true);
    expect(isRecordingMimetype("audio/wav")).toBe(true);
    expect(isRecordingMimetype("application/pdf")).toBe(false);
    expect(isRecordingMimetype(null)).toBe(false);
  });
});

describe("TranscriptSchema", () => {
  test("accepts a recogniser's draft", () => {
    expect(TranscriptSchema.safeParse(transcript()).success).toBe(true);
  });

  test("a transcript names its recogniser or what it translates, not neither and not both", () => {
    expect(TranscriptSchema.safeParse(transcript({ recogniser: undefined })).success).toBe(false);
    const both = transcript({ translated_from: { lang: "fr", segments_sha256: SHA } });
    expect(TranscriptSchema.safeParse(both).success).toBe(false);
  });

  test("a translation names its source language, which is another language", () => {
    const fr = transcript({
      lang: "fr",
      recogniser: undefined,
      translated_from: { lang: "en", segments_sha256: SHA },
      drafted_by: { kind: "agent", id: "agy", model: "claude-opus-5" },
    });
    expect(TranscriptSchema.safeParse(fr).success).toBe(true);
    const same = { ...fr, translated_from: { lang: "fr", segments_sha256: SHA } };
    expect(TranscriptSchema.safeParse(same).success).toBe(false);
  });

  test("the narrative's rules apply: only a human confirms, an agent names its model", () => {
    const confirmedByScript = transcript({ state: "confirmed", confirmed_by: { kind: "script", id: "x" } });
    expect(TranscriptSchema.safeParse(confirmedByScript).success).toBe(false);
    const confirmed = transcript({ state: "confirmed", confirmed_by: { kind: "human", id: "litlfred" } });
    expect(TranscriptSchema.safeParse(confirmed).success).toBe(true);
    const noModel = transcript({ drafted_by: { kind: "agent", id: "agy" } });
    expect(TranscriptSchema.safeParse(noModel).success).toBe(false);
    const noDrafter = transcript({ drafted_by: undefined });
    expect(TranscriptSchema.safeParse(noDrafter).success).toBe(false);
  });

  test("segments are timed and in order", () => {
    const backwards = transcript({ segments: [{ start_ms: 10, end_ms: 5, text: "x" }] });
    expect(TranscriptSchema.safeParse(backwards).success).toBe(false);
    const unordered = transcript({
      segments: [
        { start_ms: 100, end_ms: 200, text: "b" },
        { start_ms: 0, end_ms: 100, text: "a" },
      ],
    });
    expect(TranscriptSchema.safeParse(unordered).success).toBe(false);
    expect(TranscriptSchema.safeParse(transcript({ segments: [] })).success).toBe(false);
  });

  test("read as a narrative, it is its segments' text", () => {
    const t = TranscriptSchema.parse(transcript());
    expect(asNarrative(t).text).toBe("Hi, this is a walkthrough. Second segment.");
    expect(segmentsCanonical(t.segments)).toBe('[[0,9880," Hi, this is a walkthrough."],[9880,12000,"Second segment."]]');
  });
});
