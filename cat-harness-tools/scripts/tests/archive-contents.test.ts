/**
 * Archives — bean `twqe`.
 *
 * `uploads/` holds four PDFs and NO archives, so nothing here can be proved by
 * running over the corpus: a checker that returned "fine" unconditionally
 * would pass that just as well. Every claim is made against archives this file
 * builds, and the corpus is used only to assert the determined zero.
 *
 * The routing tests deliberately need no PDF backend. This container has
 * none — `import fitz` and `import pymupdf` both fail — which is exactly why
 * routing must happen on sniffed CONTENT before anything opens the file as a
 * PDF, and why these tests can run at all.
 *
 * @module scripts/tests/archive-contents
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ARCHIVE_CONTENTS_SCHEMA_ID, ArchiveContentsSchema, isArchiveMimetype } from "../../schemas/library/archive-contents.ts";
import { checkAll, checkEntry } from "../check-l1-complete.ts";
import { planFor, sniffMimetype } from "../ingest-document.ts";

// The harness: the Python scripts it spawns stayed there; this test moved up in 70lx B2b.
const ROOT = HARNESS_ROOT;
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function sh(cmd: string, cwd: string): void {
  const r = Bun.spawnSync(["sh", "-c", cmd], { cwd });
  if (r.exitCode !== 0) throw new Error(`${cmd}: ${new TextDecoder().decode(r.stderr)}`);
}

/** A tree with a nested directory, a PDF and a text file, packed both ways. */
function fixtures(): { dir: string; zip: string; tgz: string } {
  const dir = mkdtempSync(join(tmpdir(), "arc-"));
  made.push(dir);
  const src = join(dir, "src", "sub");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(dir, "src", "a.txt"), "hello archive");
  writeFileSync(join(src, "b.pdf"), "%PDF-1.4 pretend");
  sh("cd src && zip -qr ../t.zip .", dir);
  sh("cd src && tar czf ../t.tar.gz .", dir);
  return { dir, zip: join(dir, "t.zip"), tgz: join(dir, "t.tar.gz") };
}

function listed(archive: string, out: string): ReturnType<typeof ArchiveContentsSchema.safeParse> {
  const r = Bun.spawnSync(["python3", join(TOOLS_ROOT, "scripts/archive-contents.py"), "-o", out, archive], { cwd: ROOT });
  if (r.exitCode !== 0) throw new Error(new TextDecoder().decode(r.stderr));
  const slug = archive.endsWith(".zip") ? "t" : "ttar";
  return ArchiveContentsSchema.safeParse(JSON.parse(readFileSync(join(out, slug, "contents.jsonld"), "utf-8")));
}

describe("one schema, whatever the container", () => {
  test("zip and tar produce the same shape and the same digests", () => {
    const f = fixtures();
    const z = listed(f.zip, join(f.dir, "libz"));
    const t = listed(f.tgz, join(f.dir, "libt"));
    expect(z.success && t.success).toBe(true);
    if (!z.success || !t.success) return;
    expect(z.data.format).toBe("zip");
    expect(t.data.format).toBe("tar");
    const digests = (d: typeof z.data) =>
      d.entries.filter((e) => e.kind === "file").map((e) => `${e.path.replace(/^\.\//, "")}:${e.sha256}`).sort();
    // The SAME bytes packed two ways must list identically. A shape that
    // differed by container would make the listing a fact about the packer.
    expect(digests(z.data)).toEqual(digests(t.data));
  });

  test("the mimetype is sniffed from the ENTRY's own bytes, not its name", () => {
    const f = fixtures();
    const z = listed(f.zip, join(f.dir, "lib"));
    expect(z.success).toBe(true);
    if (!z.success) return;
    const pdf = z.data.entries.find((e) => e.path.endsWith("b.pdf"));
    expect(pdf?.mimetype_sniffed).toBe("application/pdf");
    expect(pdf?.mimetype_source).toBe("magic-bytes");
    // Plain text has no magic bytes, so it is honestly unrecognised rather
    // than guessed from `.txt` — the same refusal `_tech_meta.py` makes.
    const txt = z.data.entries.find((e) => e.path.endsWith("a.txt"));
    expect(txt?.mimetype_sniffed).toBeNull();
    expect(txt?.mimetype_source).toBe("unrecognised");
  });

  test("a directory is listed with no size and no digest", () => {
    const f = fixtures();
    const z = listed(f.zip, join(f.dir, "lib"));
    expect(z.success).toBe(true);
    if (!z.success) return;
    const dirs = z.data.entries.filter((e) => e.kind === "directory");
    // Dropping directories would make an archive of empty ones
    // indistinguishable from an empty archive: different facts.
    expect(dirs.length).toBeGreaterThan(0);
    for (const d of dirs) {
      expect(d.bytes).toBeUndefined();
      expect(d.sha256).toBeUndefined();
    }
  });

  test("the counts agree with the entries — the schema refuses it otherwise", () => {
    const f = fixtures();
    const z = listed(f.zip, join(f.dir, "lib"));
    expect(z.success).toBe(true);
    if (!z.success) return;
    expect(z.data.n_entries).toBe(z.data.entries.length);
    expect(z.data.n_files).toBe(z.data.entries.filter((e) => e.kind === "file").length);
    const lying = { ...z.data, n_entries: z.data.n_entries + 1 };
    expect(ArchiveContentsSchema.safeParse(lying).success).toBe(false);
  });

  test("a non-archive is REFUSED, never listed as empty", () => {
    const f = fixtures();
    const notArchive = join(f.dir, "plain.zip");
    writeFileSync(notArchive, "I am not a zip, whatever my name says");
    const r = Bun.spawnSync(["python3", join(TOOLS_ROOT, "scripts/archive-contents.py"), "-o", join(f.dir, "lib"), notArchive], {
      cwd: ROOT,
    });
    expect(r.exitCode).not.toBe(0);
    // An empty `entries[]` would read as an empty archive, which is a
    // different fact — the silent zero this repository keeps paying for.
    expect(new TextDecoder().decode(r.stderr)).toContain("not an archive");
  });
});

describe("routing happens on CONTENT, with no PDF backend needed", () => {
  test("a zip takes the archive rung", () => {
    const f = fixtures();
    const p = planFor(f.zip, undefined, "library");
    expect(p.rung).toBe("archive");
    // The step is an ABSOLUTE path since 2026-09-20 — `"scripts/<name>.py"`
    // was resolved against the CWD and `bun run` puts you at the repository
    // root, one level above where the helpers live, so every rung died with
    // `can't open file`. Asserting the BASENAME rather than a spelling of the
    // location is what stops this test re-pinning the next relocation.
    expect(p.steps[0]!.some((a) => a.endsWith("/archive-contents.py"))).toBe(true);
    expect(p.why).toContain("application/zip");
  });

  test("a gzip/tar takes it too", () => {
    const p = planFor(fixtures().tgz, undefined, "library");
    expect(p.rung).toBe("archive");
    expect(p.why).toContain("application/gzip");
  });

  test("a file NAMED .pdf that is really a zip still routes as an archive", () => {
    // The whole reason the sniff decides. A liar's extension used to send this
    // to the PDF probe, which answered `undetermined` with "no PDF backend" —
    // the refusal right, the diagnosis wrong.
    const f = fixtures();
    const lying = join(f.dir, "actually-a-zip.pdf");
    writeFileSync(lying, readFileSync(f.zip));
    expect(planFor(lying, undefined, "library").rung).toBe("archive");
  });

  test("a real PDF does NOT take the archive rung", () => {
    // It lands on `undetermined` in this container, because no PyMuPDF is
    // installed — which is an honest report of a missing backend, and is NOT
    // the archive rung. Asserting the negative is the point.
    //
    // A FIXTURE, not a corpus file. This named `uploads/milnorlink.pdf` until
    // 2026-09-30, when the retention rule (`q7ey`) retired that upload to
    // `fsh-guts/uploads/` and `check:declared-paths` reported the literal as
    // a witness that stopped resolving. Re-pointing it would have bought the
    // same breakage the next time a source moves, and every ingested source
    // is now supposed to move. What the test needs is a file the sniffer
    // calls `application/pdf`, which the magic bytes alone decide — checked:
    // `sniffMimetype` answers `application/pdf` for these eight bytes and for
    // the real 1.4 MB paper alike.
    const f = fixtures();
    const pdf = join(f.dir, "minimal.pdf");
    writeFileSync(pdf, "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
    expect(sniffMimetype(pdf)).toBe("application/pdf");
    expect(planFor(pdf, undefined, "library").rung).not.toBe("archive");
  });

  test("the mimetype can be supplied, so the decision is testable in isolation", () => {
    expect(planFor("x", undefined, "library", "application/zip").rung).toBe("archive");
    expect(planFor("x", { outline: 3, outlineUsable: 3, chars: 9000 }, "library", null).rung).toBe("pdf-structure");
    expect(planFor("x", { outline: 3, outlineUsable: 3, chars: 9000 }, "library", "application/pdf").rung).toBe("pdf-structure");
  });

  test("isArchiveMimetype refuses everything else", () => {
    for (const m of ["application/pdf", "text/html", null, undefined, ""]) {
      expect(isArchiveMimetype(m)).toBe(false);
    }
    for (const m of ["application/zip", "application/gzip", "application/x-tar"]) {
      expect(isArchiveMimetype(m)).toBe(true);
    }
  });
});

/** A library entry whose `source` sniffed as the given mimetype. */
function entryFor(mimetype: string, contents?: unknown): string {
  const root = mkdtempSync(join(tmpdir(), "arcgate-"));
  made.push(root);
  const dir = join(root, "doc");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "structure.json"),
    JSON.stringify({ _schema: "pdf-structure/v1", sections: [1], source: { mimetype_sniffed: mimetype } }),
  );
  if (contents !== undefined) {
    writeFileSync(join(dir, "contents.jsonld"), typeof contents === "string" ? contents : JSON.stringify(contents));
  }
  return dir;
}

const archState = (d: string) => checkEntry(d).requirements.find((r) => r.name === "archive-contents");

describe("the gate fires on an archive with no listing", () => {
  test("an archive entry with no contents.jsonld is UNMET", () => {
    const r = archState(entryFor("application/zip"));
    expect(r?.state).toBe("unmet");
    expect(r?.detail).toContain("no contents.jsonld");
  });

  test("a valid listing is MET and reports its counts", () => {
    const f = fixtures();
    const z = listed(f.zip, join(f.dir, "lib"));
    expect(z.success).toBe(true);
    if (!z.success) return;
    const r = archState(entryFor("application/zip", z.data));
    expect(r?.state).toBe("met");
    expect(r?.detail).toContain("file(s)");
  });

  test("a listing that is not the declared schema is UNMET", () => {
    const r = archState(entryFor("application/zip", { $schema: "something-else/v1", entries: [] }));
    expect(r?.state).toBe("unmet");
    expect(r?.detail).toContain(ARCHIVE_CONTENTS_SCHEMA_ID);
  });

  test("an unparseable listing is unmet rather than an exception", () => {
    expect(archState(entryFor("application/zip", "{ not json"))?.state).toBe("unmet");
  });

  test("a PDF entry is MET and SAYS SO — a determined zero, not silence", () => {
    const r = archState(entryFor("application/pdf"));
    expect(r?.state).toBe("met");
    expect(r?.detail).toBe("not an archive (application/pdf)");
  });

  test("an absent mimetype says so, in BOTH its spellings", () => {
    // `_tech_meta.py` writes `null` for unrecognised bytes; an older or
    // hand-edited entry can carry `""`. Either way the detail must say nothing
    // looked, not render as `not an archive ()`.
    for (const absent of ["", null]) {
      expect(archState(entryFor(absent as unknown as string))?.detail).toContain("no sniffed mimetype");
    }
  });
});

describe("the real corpus", () => {
  test("four PDFs, zero archives, and the gate says so per entry", () => {
    // `undefined` means no `library` graph was declared, which is NOT an
    // empty corpus — a test computed over it has checked nothing.
    const reports = checkAll(ROOT);
    expect(reports, "no `library` declared under ROOT — this test would be vacuous").toBeDefined();
    if (reports === undefined) return;
    expect(reports.length).toBeGreaterThan(0);
    for (const r of reports) {
      const q = r.requirements.find((x) => x.name === "archive-contents");
      expect(`${r.slug}: ${q?.state}`).toBe(`${r.slug}: met`);
      expect(q?.detail).toContain("not an archive");
    }
    // It reads the whole mounted library: 6.5 s on a busy CI runner
    // (cat-harness-tools#1950, run 43191767163), past bun's 5 s default.
  }, 60_000);
});

// ── The record is real JSON-LD — bean `yh6u` ───────────────────────────────

import { CONTENT_CONTEXT_URL } from "../../schemas/kg/jsonld.ts";
import { checkDeclaredKeys } from "../check-content-keys.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";

describe("the archive record is JSON-LD a processor keeps whole", () => {
  test("the arm emits the published context, and every key is a declared term", () => {
    const f = fixtures();
    const out = join(f.dir, "lib");
    listed(f.zip, out);
    const raw = JSON.parse(readFileSync(join(out, "t", "contents.jsonld"), "utf-8"));
    expect(raw["@context"]).toBe(CONTENT_CONTEXT_URL);
    const k = checkDeclaredKeys(out);
    expect(k.documents).toBe(1);
    expect(k.undeclared).toEqual([]);
  });
});
