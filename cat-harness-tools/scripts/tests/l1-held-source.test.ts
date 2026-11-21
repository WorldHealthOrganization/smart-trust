/**
 * An entry may hold the exact bytes it was derived from — cat-harness-tools#281.
 *
 * A frozen review source keeps its PDF and .docx beside their extraction,
 * because every public comment cites a page and line of those bytes. The
 * `contents` requirement admits such a file only when a sidecar of the entry
 * names it as its `source` AND its sha256 matches; a renamed copy, an edited
 * copy or a stray stays a stray.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ENTRY_SIDECARS, checkEntry, heldSources } from "../check-l1-complete.ts";
import { COVER_FILENAME } from "../library-graph.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const sha = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");

function entry(): string {
  const root = mkdtempSync(join(tmpdir(), "held-"));
  dirs.push(root);
  const dir = join(root, "doc");
  mkdirSync(dir);
  return dir;
}

describe("heldSources", () => {
  test("a child named by a sidecar's source and matching its sha256 is held", () => {
    const dir = entry();
    writeFileSync(join(dir, "doc.pdf"), "%PDF bytes");
    writeFileSync(join(dir, "structure.json"), JSON.stringify({ source: { file: "doc.pdf", sha256: sha("%PDF bytes") } }));
    expect([...heldSources(dir, ["structure.json"])]).toEqual(["doc.pdf"]);
  });

  test("an edited copy is not held: the hash decides, not the name", () => {
    const dir = entry();
    writeFileSync(join(dir, "doc.pdf"), "%PDF edited");
    writeFileSync(join(dir, "structure.json"), JSON.stringify({ source: { file: "doc.pdf", sha256: sha("%PDF bytes") } }));
    expect(heldSources(dir, ["structure.json"]).size).toBe(0);
  });

  test("a multi-file source names each member by path", () => {
    const dir = entry();
    writeFileSync(join(dir, "a.xml"), "<a/>");
    writeFileSync(join(dir, "structure.json"), JSON.stringify({ source: { files: [{ path: "a.xml", sha256: sha("<a/>") }] } }));
    expect([...heldSources(dir, ["structure.json"])]).toEqual(["a.xml"]);
  });

  test("a path outside the entry's top level is never admitted", () => {
    const dir = entry();
    writeFileSync(join(dir, "structure.json"), JSON.stringify({ source: { file: "../doc.pdf", sha256: sha("x") } }));
    expect(heldSources(dir, ["structure.json"]).size).toBe(0);
  });
});

describe("contents", () => {
  test("the review-anchor sidecars are declared entry contents", () => {
    expect(ENTRY_SIDECARS).toContain("docx-structure.json");
    expect(ENTRY_SIDECARS).toContain("pdf-line-map.json");
  });

  test("a held source passes contents; a loose file beside it does not", () => {
    const dir = entry();
    writeFileSync(join(dir, "doc.docx"), "PK docx");
    writeFileSync(join(dir, "docx-structure.json"), JSON.stringify({ source: { file: "doc.docx", sha256: sha("PK docx") } }));
    writeFileSync(join(dir, "notes.txt"), "loose");
    const contents = checkEntry(dir).requirements.find((r) => r.name === "contents");
    expect(contents?.state).toBe("unmet");
    expect(contents?.detail).toContain("1 unexpected child(ren): notes.txt");
    rmSync(join(dir, "notes.txt"));
    const again = checkEntry(dir).requirements.find((r) => r.name === "contents");
    expect(again?.state).toBe("met");
    expect(again?.detail).toContain("1 held source(s) matching their recorded sha256: doc.docx");
  });

  test("the library:covers thumbnail is a declared entry content (#437)", () => {
    expect(ENTRY_SIDECARS).toContain(COVER_FILENAME);
    const dir = entry();
    writeFileSync(join(dir, COVER_FILENAME), "PNG");
    const contents = checkEntry(dir).requirements.find((r) => r.name === "contents");
    expect(contents?.detail ?? "").not.toContain(COVER_FILENAME);
  });
});
