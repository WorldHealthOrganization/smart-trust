/**
 * The bibliography attestation migration (qou C9 stories B3, B4).
 *
 * The property that matters is the ROUND TRIP: the legacy ledger, migrated
 * into the store and read back through the reader every caller uses, is the
 * same bytes in the legacy file's own style. A fixture exercises every shape
 * the real qou ledger has (duplicate ids, `id: null` orphans, rows with no
 * verifier, ASCII-escaped Python output at indent 1). Set
 * `FOLIO_BIB_ROUNDTRIP_REPO=<folio checkout>` to run the same round trip on a
 * real folio's ledgers, copied into a temporary directory — the folio itself
 * is never written.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import "../../schemas/kg/folio-graph-typology.js";
import { migrateFamily } from "../migrate-bib-attestations";
import {
  BibAttestationError,
  readHumanReviews,
  readSourceLedger,
  serialiseLike,
  SOURCE_LEDGER_AUTHORITATIVE_FOR,
  writeHumanReviews,
  writeSourceLedger,
} from "../../schemas/library/bib-attestations.ts";
import { jsonText } from "../../schemas/sdlc/qa-attestations.ts";

const ROWS = [
  { id: "a2004", status: "verified-clean", verified_at: "2026-05-19T06:38:00Z", verified_by: { kind: "agent", model: "claude-opus-4-7" }, note: "§5.5 → §5.2 — ✓", source: { kind: "upload", file: "library/a/a.pdf" } },
  { source: { kind: "upload", file: "library/orphan-1/o.pdf" }, id: null, status: "unreviewed" },
  { source: { kind: "external", url: "https://doi.org/10.1/x" }, id: "b1999", status: "partial", relevance: { verdict: "core", rationale: "r", keyResults: [], proposedActions: [], assessed_by: { kind: "agent", model: "m" }, assessed_at: "t" } },
  { id: "a2004", status: "fixed", fixes_applied: 2, verified_by: { kind: "human", name: "N" }, source: { kind: "upload", file: "library/a/a-v2.pdf" } },
  { source: { kind: "external", url: "https://example.org/no-id" }, id: null, status: "unreviewed", notes: "a stray key kept verbatim" },
];
const LEDGER = { _schema: "source-ledger/v1", _authoritative_for: SOURCE_LEDGER_AUTHORITATIVE_FOR, entries: ROWS };
const REVIEWS = {
  _meta: { purpose: "p", statusEnum: ["unreviewed", "source-in-repo", "issue-open", "photo-uploaded", "validated"], default: "unreviewed" },
  reviews: {
    zeta2001: { status: "issue-open", by: "someone", date: "2026-06-09", source: "issue#1", page: "1", entryHash: "c6aefdff481b" },
    alpha2004: { status: "validated", by: "agent-backfill", date: "2026-06-12", source: "library/x.pdf", page: "auto", entryHash: "bc4b9215fa90" },
  },
};

/** A folio repository with the two legacy files, ledger written Python-style. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "bib-att-"));
  writeFileSync(join(root, "fx.json"), JSON.stringify({ name: "fx", directories: [{ id: "folio", path: "folio/", graphTypologies: ["folio"] }] }));
  mkdirSync(join(root, "folio", "schema"), { recursive: true });
  // indent 1, ASCII-escaped: what `json.dump(indent=1)` writes.
  const py = jsonText(LEDGER, true).replace(/^( +)/gm, (s) => " ".repeat(s.length / 2));
  writeFileSync(join(root, "folio", "bib-qa-verifications.json"), `${py}\n`);
  writeFileSync(join(root, "folio", "schema", "references.review.json"), `${JSON.stringify(REVIEWS, null, 2)}\n`);
  return root;
}

const legacyText = (root: string, rel: string) => readFileSync(join(root, "folio", rel), "utf-8");

describe("before migration: the reader falls back to the legacy file and says so", () => {
  test("source ledger and reviews", () => {
    const root = fixture();
    const l = readSourceLedger(root);
    expect(l.from).toBe("legacy");
    expect(l.note).toContain("LEGACY");
    expect(l.ledger.entries).toEqual(ROWS as never);
    const r = readHumanReviews(root);
    expect(r.from).toBe("legacy");
    expect(r.reviews).toEqual(REVIEWS.reviews as never);
  });

  test("a writer writes back where it read: the legacy file, not the store", () => {
    const root = fixture();
    const l = readSourceLedger(root);
    expect(writeSourceLedger(root, l.ledger).to).toBe("legacy");
    expect(existsSync(join(root, "test", "attestations"))).toBe(false);
  });
});

describe("the migration round-trips byte for byte", () => {
  test("--apply, then the store gives back the legacy bytes; --check passes; a second --apply is a no-op", () => {
    const root = fixture();
    const ledgerBefore = legacyText(root, "bib-qa-verifications.json");
    const reviewsBefore = legacyText(root, "schema/references.review.json");

    expect(migrateFamily(root, "bib-verification", "check").state).toBe("waiting");
    const v = migrateFamily(root, "bib-verification", "apply");
    expect(v.state).toBe("migrated");
    expect(v.rows).toBe(5);
    expect(v.unknownVerifier).toBe(3);
    expect(migrateFamily(root, "bib-human-review", "apply").state).toBe("migrated");

    const l = readSourceLedger(root);
    expect(l.from).toBe("store");
    expect(l.legacyPresent).toBe(true);
    expect(serialiseLike(l.ledger, ledgerBefore)).toBe(ledgerBefore);
    const r = readHumanReviews(root);
    expect(r.from).toBe("store");
    expect(Object.keys(r.reviews)).toEqual(["zeta2001", "alpha2004"]); // recorded order, not file order
    expect(serialiseLike({ ...REVIEWS, reviews: r.reviews }, reviewsBefore)).toBe(reviewsBefore);

    expect(migrateFamily(root, "bib-verification", "check").state).toBe("migrated");
    expect(migrateFamily(root, "bib-verification", "apply").wrote).toBeUndefined();
  });

  test("one file per reference; duplicates share it; orphans file by source; unknown verifiers are marked, never attributed", () => {
    const root = fixture();
    migrateFamily(root, "bib-verification", "apply");
    const fam = join(root, "test", "attestations", "bib-verification");
    const a = JSON.parse(readFileSync(join(fam, "reference", "a2004.attestations.json"), "utf-8"));
    expect(a.verifications.map((x: { position: number }) => x.position)).toEqual([0, 3]);
    expect(a.verifications.every((x: { verifier?: string }) => x.verifier === undefined)).toBe(true);
    const o = JSON.parse(readFileSync(join(fam, "source", "library", "orphan-1", "o.pdf.attestations.json"), "utf-8"));
    expect(o.subject).toEqual({ kind: "source", id: "library/orphan-1/o.pdf", path: "library/orphan-1/o.pdf" });
    expect(o.verifications[0].verifier).toBe("unknown");
    expect(o.verifications[0].entry.verified_by).toBeUndefined();
    expect(readdirSync(join(fam, "source", "external"))).toHaveLength(1);
  });
});

describe("after migration: writers write the store, and refuse what they cannot read", () => {
  test("a change round-trips through the store; a moved row leaves an empty (retracted) file, not a deletion", () => {
    const root = fixture();
    migrateFamily(root, "bib-verification", "apply");
    const l = readSourceLedger(root).ledger;
    (l.entries[1] as { id: string | null }).id = "c2010"; // the orphan is joined to a reference
    expect(writeSourceLedger(root, l).to).toBe("store");
    const back = readSourceLedger(root).ledger;
    expect(back.entries).toEqual(l.entries);
    const orphan = join(root, "test", "attestations", "bib-verification", "source", "library", "orphan-1", "o.pdf.attestations.json");
    expect(JSON.parse(readFileSync(orphan, "utf-8")).verifications).toEqual([]);
  });

  test("the schema refuses a row marked unknown that names a verifier, and a reader throws rather than answer past it", () => {
    const root = fixture();
    migrateFamily(root, "bib-verification", "apply");
    const p = join(root, "test", "attestations", "bib-verification", "reference", "a2004.attestations.json");
    const f = JSON.parse(readFileSync(p, "utf-8"));
    f.verifications[0].verifier = "unknown";
    writeFileSync(p, JSON.stringify(f, null, 2));
    expect(() => readSourceLedger(root)).toThrow(BibAttestationError);
    // ...and a writer refuses too, writing nothing.
    expect(() => writeSourceLedger(root, { ...LEDGER, entries: ROWS } as never)).toThrow(BibAttestationError);
    expect(JSON.parse(readFileSync(p, "utf-8")).verifications[0].verifier).toBe("unknown");
  });

  test("a corrupt file is never overwritten", () => {
    const root = fixture();
    migrateFamily(root, "bib-human-review", "apply");
    const p = join(root, "test", "attestations", "bib-human-review", "reference", "zeta2001.attestations.json");
    writeFileSync(p, "{ not json");
    expect(() => readHumanReviews(root)).toThrow(BibAttestationError);
    expect(() => writeHumanReviews(root, REVIEWS.reviews as never)).toThrow(BibAttestationError);
    expect(readFileSync(p, "utf-8")).toBe("{ not json");
  });

  test("a review ledger whose statusEnum disagrees with the schema is refused, not moved", () => {
    const root = fixture();
    const p = join(root, "folio", "schema", "references.review.json");
    writeFileSync(p, JSON.stringify({ ...REVIEWS, _meta: { statusEnum: ["unreviewed", "maybe"] } }, null, 2));
    expect(migrateFamily(root, "bib-human-review", "apply").state).toBe("refused");
    expect(existsSync(join(root, "test", "attestations", "bib-human-review"))).toBe(false);
  });
});

const REAL = process.env["FOLIO_BIB_ROUNDTRIP_REPO"];
describe.if(REAL !== undefined)("the real folio's ledgers round-trip (FOLIO_BIB_ROUNDTRIP_REPO)", () => {
  test("every row and review, byte for byte, in a temporary copy", () => {
    const root = mkdtempSync(join(tmpdir(), "bib-att-real-"));
    const decl = readdirSync(REAL!).find((f) => f.endsWith(".json") && !f.endsWith(".config.json") && existsSync(join(REAL!, f)) && JSON.parse(readFileSync(join(REAL!, f), "utf-8")).directories);
    expect(decl).toBeDefined();
    cpSync(join(REAL!, decl!), join(root, decl!));
    mkdirSync(join(root, "folio", "schema"), { recursive: true });
    for (const rel of ["bib-qa-verifications.json", "schema/references.review.json"]) {
      if (existsSync(join(REAL!, "folio", rel))) cpSync(join(REAL!, "folio", rel), join(root, "folio", rel));
    }
    const v = migrateFamily(root, "bib-verification", "apply");
    const h = migrateFamily(root, "bib-human-review", "apply");
    console.log(`real round trip: ${JSON.stringify({ verification: v, review: h })}`);
    expect(v.state).toBe("migrated");
    expect(h.state).toBe("migrated");
  });
});
