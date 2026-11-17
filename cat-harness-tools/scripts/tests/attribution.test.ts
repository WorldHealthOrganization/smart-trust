/**
 * Narrative provenance — bean `iqim`.
 *
 * The corpus holds 424 blocks and every one of them is extracted prose, so
 * NOTHING here can be proved by running the gate over `library/`: a checker
 * that returned "fine" unconditionally would pass that just as well. The
 * authored branch is therefore proved against a fixture that carries a
 * narrative block, and the extracted branch against the corpus.
 *
 * @module scripts/tests/attribution
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { libraryEntries } from "./library-dirs.ts";

import { QA_REVIEWER_KINDS } from "../../schemas/sdlc/block-qa.ts";
import {
  ATTRIBUTION_KINDS,
  AttributionSchema,
  INGESTED,
  LIBRARY_BLOCK_ORIGIN,
  ProvenanceSchema,
  attributionOf,
  isIngested,
  isNarrativeKind,
} from "../../schemas/content/attribution.ts";
import { checkAll, checkEntry } from "../check-l1-complete.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("the vocabulary is one set, not two", () => {
  test("`QA_REVIEWER_KINDS` IS `ATTRIBUTION_KINDS`", () => {
    // Identity, not equality. Equal arrays would still be two definitions free
    // to drift; `rlp5` is this repository's record of what that costs.
    expect(QA_REVIEWER_KINDS).toBe(ATTRIBUTION_KINDS);
  });

  test("the order is the one block-qa always exported", () => {
    // A re-spelling that also silently reorders shows up somewhere nobody was
    // looking, so the order is pinned rather than left to the new file.
    expect([...ATTRIBUTION_KINDS]).toEqual(["script", "agent", "human"]);
  });
});

describe("an agent must name its model", () => {
  test("an `agent` with no model is rejected", () => {
    const r = AttributionSchema.safeParse({ kind: "agent", id: "claude-code" });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("model");
  });

  test("an empty-string model is rejected too — it is an absence spelled differently", () => {
    expect(AttributionSchema.safeParse({ kind: "agent", id: "x", model: "" }).success).toBe(false);
  });

  test("a human and a script need no model", () => {
    for (const kind of ["human", "script"] as const) {
      expect(AttributionSchema.safeParse({ kind, id: "someone" }).success).toBe(true);
    }
  });
});

describe("provenance is a CLOSED union", () => {
  test('"ingested" is the one bare string that parses', () => {
    expect(ProvenanceSchema.safeParse(INGESTED).success).toBe(true);
    for (const other of ["derived", "generated", "", "unknown"]) {
      expect(ProvenanceSchema.safeParse(other).success).toBe(false);
    }
  });

  test("a well-formed attribution parses; a malformed one does not", () => {
    expect(ProvenanceSchema.safeParse({ kind: "agent", id: "a", model: "claude-opus-5" }).success).toBe(true);
    expect(ProvenanceSchema.safeParse({ kind: "wizard", id: "a" }).success).toBe(false);
    expect(ProvenanceSchema.safeParse({ kind: "human" }).success).toBe(false);
  });

  test("`attributionOf` gives null for extracted text and never throws", () => {
    expect(attributionOf(INGESTED)).toBeNull();
    expect(attributionOf(undefined)).toBeNull();
    expect(attributionOf({ kind: "human", id: "litlfred" })?.id).toBe("litlfred");
    expect(isIngested(INGESTED)).toBe(true);
    expect(isIngested({ kind: "human", id: "x" })).toBe(false);
  });
});

describe("the origin registry is total over what actually exists", () => {
  test("every kind in library/ is classified", () => {
    // This is what stops a narrative arm landing an unclassified kind: the
    // moment one appears in the corpus, this fails until somebody decides
    // whether it is somebody's account or the source's own words.
    // PARSED, not scraped. This regexed `"kind": "..."` out of the raw text
    // until 2026-09-20, which matched every NESTED kind too: the moment a
    // figure block carried `narrative.drafted_by.kind = "agent"`, the test
    // demanded an origin classification for "agent", a value that is not a
    // block kind at all. A regex over JSON cannot tell depth, and the thing
    // being asserted here is specifically about the TOP-LEVEL kind.
    const kinds = new Set<string>();
    // Every declared library, READ rather than composed. This globbed
    // `${ROOT}/library/*/blocks/*.jsonld`, which named one directory and went
    // silent when bean `frs5` moved the corpus out of it — and a glob that
    // matches nothing produces an empty set, so the assertion below would have
    // passed over zero blocks.
    const blockFiles: string[] = [];
    for (const { dir } of libraryEntries()) {
      const blocks = join(dir, "blocks");
      if (!existsSync(blocks)) continue;
      for (const b of readdirSync(blocks)) if (b.endsWith(".jsonld")) blockFiles.push(join(blocks, b));
    }
    expect(blockFiles.length, "no blocks found — this test would be vacuous").toBeGreaterThan(0);
    for (const f of blockFiles) {
      // Read and parse SEPARATELY, and let anything that is not a parse
      // failure through untouched. A single try/catch around both reported a
      // missing import as "could not parse" — a code defect dressed as a data
      // problem, which is the costliest kind of wrong error message.
      const body = readFileSync(f, "utf-8");
      let k: unknown;
      try {
        k = JSON.parse(body).kind;
      } catch (e) {
        throw new Error(`${f} is not valid JSON, so the kind set would be incomplete: ${e}`);
      }
      if (typeof k === "string") kinds.add(k);
    }
    expect(kinds.size).toBeGreaterThan(0);
    for (const k of kinds) expect(LIBRARY_BLOCK_ORIGIN[k]).toBeDefined();
  });

  test("today's corpus is all extracted, and that is a determined answer", () => {
    expect(isNarrativeKind("prose")).toBe(false);
    // Not vacuous: an unregistered kind is not narrative either, so the test
    // above is what carries the weight.
    expect(isNarrativeKind("description")).toBe(false);
  });
});

/** A library entry whose single block has the given kind and provenance. */
function entryWith(kind: string, provenance: unknown): string {
  const root = mkdtempSync(join(tmpdir(), "prov-"));
  made.push(root);
  const dir = join(root, "doc");
  mkdirSync(join(dir, "blocks"), { recursive: true });
  mkdirSync(join(dir, "sections"), { recursive: true });
  writeFileSync(join(dir, "sections", "s0.md"), "x");
  writeFileSync(join(dir, "blocks", "b0.jsonld"), JSON.stringify({ "@id": "b0", kind, provenance }));
  writeFileSync(
    join(dir, "structure.json"),
    JSON.stringify({ _schema: "pdf-structure/v1", toc_source: "none", sections: [1] }),
  );
  writeFileSync(join(dir, "manifest.jsonld"), JSON.stringify({ "@id": "x", "@type": [], contains: [], provenance: {} }));
  return dir;
}

const provState = (d: string) =>
  checkEntry(d).requirements.find((r) => r.name === "narrative-provenance");

describe("the gate fires on an unattributed narrative", () => {
  /**
   * Registers a narrative kind for the duration of one test.
   *
   * The registry is mutated rather than injected because there is no authored
   * kind in the corpus yet: proving the branch fires REQUIRES one to exist,
   * and a checker whose narrative path has never executed is a checker nobody
   * has tested. Restored in `finally` so nothing leaks into a sibling test.
   */
  function withNarrativeKind<T>(kind: string, fn: () => T): T {
    LIBRARY_BLOCK_ORIGIN[kind] = "authored";
    try {
      return fn();
    } finally {
      delete LIBRARY_BLOCK_ORIGIN[kind];
    }
  }

  test('an authored block claiming "ingested" is UNMET — nobody is credited', () => {
    withNarrativeKind("description", () => {
      const r = provState(entryWith("description", INGESTED));
      expect(r?.state).toBe("unmet");
      expect(r?.detail).toContain("nobody is credited");
    });
  });

  test("the same block with an agent attribution is MET, and is counted as narrative", () => {
    withNarrativeKind("description", () => {
      const r = provState(
        entryWith("description", { kind: "agent", id: "claude-code", model: "claude-opus-5", date: "2026-09-19" }),
      );
      expect(r?.state).toBe("met");
      expect(r?.detail).toContain("1 narrative");
    });
  });

  test("an agent attribution with no model does not rescue it", () => {
    withNarrativeKind("description", () => {
      expect(provState(entryWith("description", { kind: "agent", id: "claude-code" }))?.state).toBe("unmet");
    });
  });

  test("a human attribution is enough", () => {
    withNarrativeKind("description", () => {
      expect(provState(entryWith("description", { kind: "human", id: "litlfred" }))?.state).toBe("met");
    });
  });
});

describe("what the gate refuses to wave through", () => {
  test("an unclassified kind is unmet, never skipped", () => {
    const r = provState(entryWith("mystery", INGESTED));
    expect(r?.state).toBe("unmet");
    expect(r?.detail).toContain("not classified");
  });

  test("an open string is unmet even on an extracted kind", () => {
    expect(provState(entryWith("prose", "generated"))?.state).toBe("unmet");
  });

  test("a missing provenance is unmet, not absent-and-fine", () => {
    expect(provState(entryWith("prose", undefined))?.state).toBe("unmet");
  });

  test("no blocks at all is unmet — there is nothing to have attributed", () => {
    const root = mkdtempSync(join(tmpdir(), "prov-empty-"));
    made.push(root);
    const dir = join(root, "doc");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "structure.json"), "{}");
    expect(provState(dir)?.state).toBe("unmet");
  });
});

describe("the real corpus", () => {
  test("every block is extracted prose with a valid provenance", () => {
    // `undefined` means no `library` graph was declared, which is NOT an
    // empty corpus — a test computed over it has checked nothing.
    const reports = checkAll(ROOT);
    expect(reports, "no `library` declared under ROOT — this test would be vacuous").toBeDefined();
    if (reports === undefined) return;
    expect(reports.length).toBeGreaterThan(0);
    for (const r of reports) {
      // A `referenced` entry records a source and holds NO blocks, by design
      // (bean `scfh`); `referenced-record` refuses one that does. There is no
      // prose here to have a provenance, so the requirement does not apply.
      if (r.requirements.some((x) => x.name === "referenced-record")) continue;
      const q = r.requirements.find((x) => x.name === "narrative-provenance");
      // `toBe`, not `toContain("met")` — "unmet" CONTAINS "met", so that
      // assertion passed in both directions. Caught by reading it back.
      expect(`${r.slug}: ${q?.state}`).toBe(`${r.slug}: met`);
      // The zero is REPORTED, not inferred from silence.
      expect(q?.detail).toContain("0 narrative");
    }
    // A scan of every library entry in the checkout: 6.1 s on a CI shard once
    // the largest layer's reference corpus grew (2026-11-12), past bun's 5 s
    // default, so it flipped NEW and fixed on PRs that touch neither.
  }, 30_000);
});

describe("MODEL_NOT_DISCLOSED — the declared non-identifier (owner, 2026-09-30)", () => {
  test("an agent that may not name its model says so, and must give its session", async () => {
    const { AttributionSchema, MODEL_NOT_DISCLOSED, modelDisclosed } = await import("../../schemas/content/attribution.ts");
    const withSession = { kind: "agent", id: "claude-code", model: MODEL_NOT_DISCLOSED, session: "https://claude.ai/code/session_x" };
    expect(AttributionSchema.safeParse(withSession).success).toBe(true);
    expect(AttributionSchema.safeParse({ ...withSession, session: undefined }).success).toBe(false);
    expect(modelDisclosed(withSession)).toBe(false);
  });
  test("model stays REQUIRED for an agent: not-disclosed is an answer, silence is not", async () => {
    const { AttributionSchema } = await import("../../schemas/content/attribution.ts");
    expect(AttributionSchema.safeParse({ kind: "agent", id: "a", session: "s" }).success).toBe(false);
  });
});
