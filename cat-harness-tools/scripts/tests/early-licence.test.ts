/**
 * The EARLY licence verdict (bean 7bg9): read from the upload alone, three
 * outcomes, and undetermined is never reported as cleared.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carryIntakeLicence, earlyLicence } from "../ingest-document.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});
function upload(files: Record<string, string> = {}): string {
  const d = mkdtempSync(join(tmpdir(), "7bg9-"));
  made.push(d);
  writeFileSync(join(d, "doc.pdf"), "%PDF-1.4");
  for (const [f, text] of Object.entries(files)) writeFileSync(join(d, f), text);
  return join(d, "doc.pdf");
}
const intake = (licence?: unknown) =>
  JSON.stringify({
    $schema: "folio-intake/v1",
    doc_id: "doc",
    title: "A test document",
    source: { upstream: "https://example.org/doc", capturedAt: "2026-09-30T00:00:00Z", capturedBy: "test" },
    files: [],
    ...(licence === undefined ? {} : { licence }),
  });

describe("earlyLicence (bean 7bg9)", () => {
  test("a stated licence in intake.json is reported with its basis", () => {
    const v = earlyLicence(upload({ "intake.json": intake({ status: "stated", id: "CC-BY-4.0", basis: "the PDF's copyright page" }) }));
    expect(v.verdict).toBe("stated");
    expect(v.detail).toContain("CC-BY-4.0");
  });
  test("unknown — somebody looked — is reported as unknown, not cleared", () => {
    const v = earlyLicence(upload({ "intake.json": intake({ status: "unknown", searched: [{ where: "publisher page", result: "no licence stated" }] }) }));
    expect(v.verdict).toBe("unknown");
  });
  test("nothing recorded is UNDETERMINED, never stated", () => {
    expect(earlyLicence(upload()).verdict).toBe("undetermined");
    expect(earlyLicence(upload({ "intake.json": intake() })).verdict).toBe("undetermined");
  });
  test("a LICENSE file beside the upload is named, but a person states it — still undetermined", () => {
    const v = earlyLicence(upload({ LICENSE: "MIT License" }));
    expect(v.verdict).toBe("undetermined");
    expect(v.detail).toContain("LICENSE");
  });
  test("a malformed licence record is not read as 'no licence' — it says it could not validate", () => {
    const v = earlyLicence(upload({ "intake.json": intake({ status: "stated", id: "CC-BY-4.0" }) }));
    expect(v.verdict).toBe("undetermined");
    expect(v.detail).toContain("does not validate");
  });
});

describe("carryIntakeLicence (bean 7bg9)", () => {
  function staged(sidecar?: unknown): string {
    const d = mkdtempSync(join(tmpdir(), "7bg9-entry-"));
    made.push(d);
    if (sidecar !== undefined) writeFileSync(join(d, "licence.json"), JSON.stringify(sidecar));
    return d;
  }
  const sidecarOf = (d: string) => (existsSync(join(d, "licence.json")) ? JSON.parse(readFileSync(join(d, "licence.json"), "utf-8")) : undefined);
  const stated = { status: "stated", id: "CC-BY-4.0", basis: "the PDF's copyright page" };

  test("a licence recorded at intake becomes the entry's licence.json — the sidecar gen:jsonld carries, not the generated manifest", () => {
    const entry = staged();
    expect(carryIntakeLicence(upload({ "intake.json": intake(stated) }), entry).outcome).toBe("carried");
    expect(sidecarOf(entry)).toEqual(stated);
    expect(existsSync(join(entry, "manifest.jsonld"))).toBe(false);
  });
  test("never overwrites: a different licence.json already there is a CONFLICT, and left alone", () => {
    const mine = { status: "unknown", searched: [{ where: "publisher", result: "silent" }] };
    const entry = staged(mine);
    expect(carryIntakeLicence(upload({ "intake.json": intake(stated) }), entry).outcome).toBe("conflict");
    expect(sidecarOf(entry)).toEqual(mine);
  });
  test("nothing recorded at intake writes nothing — absence is not a licence", () => {
    const entry = staged();
    expect(carryIntakeLicence(upload({ "intake.json": intake() }), entry).outcome).toBe("nothing");
    expect(sidecarOf(entry)).toBeUndefined();
  });
});
