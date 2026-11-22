/**
 * A source RECORDED, not held — bean `scfh`, issue #1614.
 *
 * The OMG BPMN and DMN licences forbid posting copies on a network, so their
 * library entries identify the exact PDF and its outline and hold no text. The
 * assertion that matters most is the refusal: an entry of this kind that DOES
 * carry section text is refused, because that is the copy the kind exists not
 * to make.
 *
 * This file tests the TypeScript half — the schema, the manifest
 * `gen-library-jsonld` writes, and the L1 gate — against a hand-written record,
 * so it needs no PDF and no PyMuPDF. The writer, which does need PyMuPDF, is
 * tested in `referenced-source.test.py`, in the job that installs it. They were
 * one file until CI's TypeScript job, which installs no Python packages, failed
 * on the PDF fixture (#1615).
 *
 * @module scripts/tests/referenced-source
 */
import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { ReferencedSourceSchema } from "../../../schemas/library/referenced-source.ts";
import { checkEntry, entryKind } from "../../check-l1-complete.ts";

const SCRIPT = resolve(import.meta.dir, "../../referenced-source.py");
const GEN = resolve(import.meta.dir, "../../../pipeline/gen-library-jsonld.ts");
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A record as `referenced-source.py` writes it, and the manifest generated from it. */
function staged(): string {
  const d = mkdtempSync(join(tmpdir(), "ref-"));
  made.push(d);
  const entry = join(d, "spec");
  mkdirSync(entry);
  const record = {
    $schema: "folio-referenced-source/v1",
    identity: { title: "Example Spec", version: "1.0", document_number: "formal/00-00-00", date: "2026-01", publisher: "Example Org" },
    source: {
      file: "spec.pdf",
      sha256: "a".repeat(64),
      bytes: 1234,
      mtime: "2026-09-30T00:00:00Z",
      mimetype_sniffed: "application/pdf",
      mimetype_source: "magic-bytes",
    },
    outline: [
      { level: 1, title: "Scope", page: 1 },
      { level: 1, title: "Conformance", page: 2 },
    ],
    outline_source: "embedded",
    materialization: {
      $schema: "folio-materialization/v1",
      state: "referenced",
      provenance: { upstream: { url: "https://example.org/spec/" } },
      note: "Text withheld by licence.",
    },
    withheld: { what: "all text, figures and tables", why: "licence forbids posting copies" },
  };
  writeFileSync(join(entry, "referenced.json"), JSON.stringify(record, null, 2));
  const g = Bun.spawnSync(["bun", "run", GEN, "--entry", entry]);
  if (g.exitCode !== 0) throw new Error(new TextDecoder().decode(g.stderr));
  return entry;
}

test("the record validates, the manifest holds nothing, and the entry passes with no text", () => {
  const e = staged();
  const rec = ReferencedSourceSchema.parse(JSON.parse(readFileSync(join(e, "referenced.json"), "utf-8")));
  expect(rec.materialization.state).toBe("referenced");
  const manifest = JSON.parse(readFileSync(join(e, "manifest.jsonld"), "utf-8"));
  expect(manifest.contains).toEqual([]);
  expect(manifest.provenance).toBe("ingested");
  expect(entryKind((f) => f === "referenced.json")).toBe("referenced");
  expect(checkEntry(e).requirements.filter((q) => q.state === "unmet")).toEqual([]);
});

test("an identity missing a field is refused, never guessed", () => {
  // The identity is checked before the PDF is opened, so this runs anywhere.
  const d = mkdtempSync(join(tmpdir(), "ref-"));
  made.push(d);
  writeFileSync(join(d, "id.json"), JSON.stringify({ title: "x" }));
  writeFileSync(join(d, "a.pdf"), "%PDF-1.4\n");
  const w = Bun.spawnSync(["python3", SCRIPT, "-o", d, join(d, "a.pdf"), "--identity", join(d, "id.json")]);
  expect(w.exitCode).toBe(1);
  expect(new TextDecoder().decode(w.stderr)).toContain("never guess");
});

test("a referenced entry that holds section text is REFUSED", () => {
  const e = staged();
  mkdirSync(join(e, "sections"));
  writeFileSync(join(e, "sections", "s1.md"), "copied clause text\n");
  const req = checkEntry(e).requirements.find((q) => q.name === "referenced-record");
  expect(req?.state).toBe("unmet");
  expect(req?.detail).toContain("sections/");
});
