/**
 * Materialized content is read-only, and fixity is what says so.
 *
 * Owner, 2026-09-21: *"if we have a mateiralized `<stub>/<sub-graph>`, the
 * contents of it should be immutable … you would need to copy/mateiralize it
 * to your own `folio/` in order to mess around with it."* And 2026-09-22,
 * choosing between advising and enforcing: **enforce from the start.**
 *
 * ## The four verdicts are four different facts
 *
 * Every assertion here is about keeping them apart, because each collapse has
 * already happened once:
 *
 * - **verified** vs **unverifiable** — `materialization.ts` says an archival
 *   copy with no fixity *"is not an archive, it is a file somebody kept"*.
 *   Reporting one as the other turns "nobody can check this" into "this is
 *   unchanged".
 * - **absent** vs **unverifiable** — the first version of `verify()` asked
 *   about the digest before asking whether the bytes existed, so two
 *   smart-immunizations artefacts that are declared materialized **with no
 *   file at all** were filed as "no fixity digest recorded", beside 217 that
 *   are merely unverified. A broken claim hid inside a softer category.
 * - **covered-by-parts** vs **unverifiable** — who-iris's items point at a
 *   DIRECTORY (`library/<id>`) while their bitstreams point at
 *   `uploads/<id>/<file>`. A file digest cannot apply to a directory, so the
 *   item read as a gap while every byte under it was verified by its parts.
 *   The same defect as `harness-tiles` reporting a viewer nobody had built,
 *   one layer along.
 *
 * @module folio-assistant-core/scripts/materialized-fixity.test
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { collect, materializationsIn, run, verify } from "./check-materialized-fixity.js";
import { applyTo, backfillable } from "./backfill-materialized-fixity.js";
import { FixitySchema } from "../schemas/materialization.js";

const REPO = resolve(import.meta.dir, "..", "..");

/** sha256 of the string "hello", used as a known-good digest in fixtures. */
const HELLO = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

function fixture(): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), "fixity-"));
  mkdirSync(join(dir, "sub"), { recursive: true });
  const file = join(dir, "sub", "a.txt");
  writeFileSync(file, "hello");
  return { dir, file };
}

describe("the corpus verifies", () => {
  const verdicts = run(REPO);

  it("corpusHasArtefacts", () => {
    // Vacuity guard. A checker that swept nothing would report a clean corpus,
    // which is the `dh4f` shape this repository names.
    expect(verdicts.length).toBeGreaterThan(0);
  });

  it("nothingEditedInPlace", () => {
    // THE RULE ITSELF. A mismatch means a copy of somebody else's artefact was
    // changed here without saying so.
    const edited = verdicts
      .filter((v) => v.kind === "mismatch")
      .map((v) => `${v.record.localPath} (${v.record.source})`);
    expect(edited).toEqual([]);
  });

  it("verdictOneOfFive", () => {
    for (const v of verdicts) {
      expect(["verified", "mismatch", "absent", "unverifiable", "covered-by-parts"]).toContain(v.kind);
    }
  });

  it("unverifiableNeverVerified", () => {
    for (const v of verdicts) {
      if (v.kind !== "verified") continue;
      // A verified verdict must have had something to verify against.
      expect(v.record.digest, `${v.record.localPath} verified with no digest`).toBeDefined();
    }
  });
});

describe("verify() keeps the four facts apart", () => {
  it("matchingBytesVerified", () => {
    const { dir, file } = fixture();
    try {
      expect(verify({ source: "x", localPath: "sub/a.txt", abs: file, digest: HELLO }).kind).toBe("verified");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("nonMatchingIsMismatch", () => {
    const { dir, file } = fixture();
    try {
      const v = verify({ source: "x", localPath: "sub/a.txt", abs: file, digest: "0".repeat(64) });
      expect(v.kind).toBe("mismatch");
      if (v.kind === "mismatch") expect(v.actual).toBe(HELLO);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("absentBytesAbsent", () => {
    // The ordering defect, pinned. Both fields are missing here; the verdict
    // must be the one about the bytes, because a materialized record with no
    // file is a broken claim whatever its fixity says.
    const v = verify({ source: "x", localPath: "gone.txt", abs: "/nonexistent/gone.txt" });
    expect(v.kind).toBe("absent");
  });

  it("noDigestUnverifiable", () => {
    const { dir, file } = fixture();
    try {
      const v = verify({ source: "x", localPath: "sub/a.txt", abs: file });
      expect(v.kind).toBe("unverifiable");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("unsupportedAlgorithmUnverifiable", () => {
    const { dir, file } = fixture();
    try {
      const v = verify({ source: "x", localPath: "sub/a.txt", abs: file, algorithm: "md5", digest: "x" });
      expect(v.kind).toBe("unverifiable");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("directoryCoveredByParts", () => {
    const { dir } = fixture();
    try {
      const item = { source: "n.json", localPath: "sub", abs: join(dir, "sub") };
      const part = { source: "n.json", localPath: "elsewhere/a.txt", digest: HELLO };
      // Deliberately NOT beneath the directory: who-iris's parts live in a
      // different tree, which is why the relation is by node.
      expect(verify(item, [item, part]).kind).toBe("covered-by-parts");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("directoryWithoutPartsUnverifiable", () => {
    const { dir } = fixture();
    try {
      const item = { source: "n.json", localPath: "sub", abs: join(dir, "sub") };
      expect(verify(item, [item]).kind).toBe("unverifiable");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("materializationsIn walks rather than reading a fixed shape", () => {
  it("findsNestedRecord", () => {
    const doc = { a: { b: [{ id: "x", materialization: { state: "materialized", localPath: "p" } }] } };
    const found = materializationsIn(doc, "s.json");
    expect(found.length).toBe(1);
    expect(found[0]!.id).toBe("x");
  });

  it("ignoresNonMaterialized", () => {
    const doc = { materialization: { state: "referenced", localPath: "p" } };
    expect(materializationsIn(doc, "s.json")).toEqual([]);
  });

  it("findsNodeAndChildren", () => {
    // who-iris's shape: an item and the bitstreams beneath it.
    const doc = {
      id: "item/1",
      materialization: { state: "materialized", localPath: "library/1" },
      bitstreams: [{ name: "a.pdf", materialization: { state: "materialized", localPath: "uploads/1/a.pdf" } }],
    };
    expect(materializationsIn(doc, "s.json").length).toBe(2);
  });
});

describe("the backfill records a baseline, and says so", () => {
  it("backfillOnlyUndigested", () => {
    const recs = collect(REPO);
    for (const r of backfillable(recs)) {
      expect(r.digest).toBeUndefined();
      expect(r.localPath).toBeDefined();
    }
  });

  it("backfillWritesDatedDigest", () => {
    const doc: Record<string, unknown> = {
      materialization: { state: "materialized", localPath: "sub/a.txt" },
    };
    const n = applyTo(doc, new Map([["sub/a.txt", HELLO]]));
    expect(n).toBe(1);
    const fx = (doc.materialization as Record<string, unknown>).fixity as Record<string, string>;
    expect(fx.digest).toBe(HELLO);
    expect(fx.algorithm).toBe("sha256");
    // `verifiedAt` carries the load-bearing half of the caveat: it is *when the
    // digest was last re-computed against the bytes*, so a record whose
    // ingestion never wrote a digest, dated at the backfill, IS the statement
    // that this digest was OBSERVED rather than original.
    expect(fx.verifiedAt).toBeDefined();
    expect(() => new Date(fx.verifiedAt!).toISOString()).not.toThrow();
  });

  it("backfillSchemaValid", () => {
    // The defect this replaced. The first backfill put a prose `note` inside
    // `fixity` to carry the caveat; `FixitySchema` is `.strict()` and permits
    // `algorithm`, `digest` and `verifiedAt` only, so 219 records were written
    // that failed `folio-fhir-artifact-index/v1` on both indexes.
    //
    // Asserted against the SCHEMA rather than against a hardcoded list of three
    // names: a list here would go stale the moment the schema gains a field,
    // and would then fail on a legitimate addition.
    const doc: Record<string, unknown> = {
      materialization: { state: "materialized", localPath: "sub/a.txt" },
    };
    applyTo(doc, new Map([["sub/a.txt", HELLO]]));
    const fx = (doc.materialization as Record<string, unknown>).fixity;
    expect(FixitySchema.safeParse(fx).success).toBe(true);
  });

  it("backfillNeverOverwrites", () => {
    // A backfill that clobbered an ingestion-time digest would replace a
    // stronger claim with a weaker one, silently.
    const doc: Record<string, unknown> = {
      materialization: { state: "materialized", localPath: "sub/a.txt", fixity: { digest: "original" } },
    };
    expect(applyTo(doc, new Map([["sub/a.txt", HELLO]]))).toBe(0);
    const fx = (doc.materialization as Record<string, unknown>).fixity as Record<string, string>;
    expect(fx.digest).toBe("original");
  });
});

describe("a mounted instance's bytes outside its declared directories", () => {
  // fa's Pages deploy, 2026-11-01: smart-trust's catalogue records its GDHCN
  // Framework PDF at input/images/, which smart-trust commits but does not
  // declare, so the index's mount does not carry it.
  const rec = (outsideMount?: boolean) => ({
    source: "x/catalogue/nodes/a.json",
    localPath: "input/images/a.pdf",
    abs: "/nonexistent/input/images/a.pdf",
    digest: "0".repeat(64),
    ...(outsideMount ? { outsideMount } : {}),
  });

  it("mountedOutsideUnverifiable", () => {
    const v = verify(rec(true));
    expect(v.kind).toBe("unverifiable");
    expect(v.kind === "unverifiable" && v.why).toContain("does not mount it");
  });

  it("notMountAbsent", () => {
    expect(verify(rec()).kind).toBe("absent");
  });

  it("collectMarksOnlyMountedOutside", () => {
    const root = mkdtempSync(join(tmpdir(), "fixity-mount-"));
    try {
      const inst = join(root, "lay");
      mkdirSync(join(inst, "catalogue"), { recursive: true });
      writeFileSync(join(inst, "lay.json"), JSON.stringify({ name: "lay", directories: [{ path: "catalogue/" }] }));
      const m = (p: string) => ({ materialization: { state: "materialized", localPath: p, fixity: { algorithm: "sha256", digest: "0".repeat(64) } } });
      writeFileSync(join(inst, "catalogue", "n.json"), JSON.stringify({ bitstreams: [m("input/images/a.pdf"), m("catalogue/b.pdf")] }));
      const standalone = collect(root).filter((r) => r.source.startsWith("lay/"));
      expect(standalone.length).toBe(2);
      expect(standalone.some((r) => r.outsideMount)).toBe(false);
      writeFileSync(join(root, "index.lock.json"), JSON.stringify({ instances: [{ instance: "lay", path: "lay" }] }));
      const mounted = collect(root).filter((r) => r.source.startsWith("lay/"));
      expect(mounted.find((r) => r.localPath === "input/images/a.pdf")?.outsideMount).toBe(true);
      expect(mounted.find((r) => r.localPath === "catalogue/b.pdf")?.outsideMount).toBeUndefined();
      expect(verify(mounted.find((r) => r.localPath === "catalogue/b.pdf")!).kind).toBe("absent");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
