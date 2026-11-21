/**
 * `depends_on` was typed `Array<"md" | "ts" | "lean">` — the *paper* adapter's
 * companion set — and it gates **applicability**, not merely freshness. Two
 * consequences, both silent:
 *
 *  - no criterion could say "this applies to blocks with a `.dmn`", so WHO L2
 *    decision logic and L3 FHIR artefacts had no QA axis that could attach;
 *  - worse, every such block hit `qa-sweep`'s hard-coded `.md` branch and
 *    recorded a clean `n/a`. A criterion reporting `n/a` on a corpus it never
 *    read is indistinguishable downstream from one that found nothing wrong —
 *    the same failure shape as the stale `BLOCK_BUILDER_RE` that hid 461
 *    blocks from every QA tool.
 *
 * These tests pin the widened vocabulary, the generic gate that replaced the
 * two `if`s, and — importantly — that the change is a no-op for the existing
 * paper corpus. `sameScriptVerdict` compares `notes`, so a reworded message
 * would rewrite every `n/a` sidecar in the folio on the next sweep.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  COMPANION_ROLES,
  TEXTUAL_COMPANION_ROLES,
  type CompanionRole,
} from "../../schemas/sdlc/block-qa.ts";
import {
  applicabilityGap,
  missingCompanionNote,
  resolveCompanions,
  hashBlockFiles,
  freshnessKeys,
  entryIsFresh,
} from "../../pipeline/qa-utils";
import { QA_CRITERIA_REGISTRY } from "../../pipeline/qa-criteria-registry";
import { CONTENT_ADAPTERS } from "../../schemas/content/block-kinds.ts";
import { criterionAdapters } from "../../schemas/sdlc/block-qa.ts";
import type { QaCriterionEntry } from "../../schemas/sdlc/block-qa.ts";

const DIR = mkdtempSync(join(tmpdir(), "companion-roles-"));
const STEM = join(DIR, "dt-anc-01");

beforeAll(() => {
  writeFileSync(`${STEM}.ts`, "export default {};\n");
  writeFileSync(`${STEM}.dmn`, "<definitions/>\n");
  writeFileSync(`${STEM}.fsh`, "Profile: Foo\n");
});

afterAll(() => {
  try {
    rmSync(DIR, { recursive: true, force: true });
  } catch {}
});

describe("companion role vocabulary", () => {
  test("covers the paper adapter's set", () => {
    for (const r of ["md", "ts", "lean"] as CompanionRole[]) {
      expect(COMPANION_ROLES).toContain(r);
    }
  });

  test("covers what WHO L2 DAK and L3 FHIR blocks are made of", () => {
    // L2: business-processes → .bpmn, decision-logic → .dmn,
    //     data-dictionary / indicators → .xlsx
    // L3: profiles, ValueSets, PlanDefinitions → .fsh; logic → .cql;
    for (const r of ["bpmn", "dmn", "xlsx", "fsh", "cql"] as CompanionRole[]) {
      expect(COMPANION_ROLES).toContain(r);
    }
  });

  test("compiled FHIR JSON is not a role — SUSHI generates it from .fsh", () => {
    // A build output is not an authored companion: a criterion that cares
    // about the resource depends on the source that produced it. It would
    // also shadow BaseModel.json in the Python mirror of this schema.
    expect(COMPANION_ROLES as readonly string[]).not.toContain("json");
  });

  test("xlsx is not textual — it is a ZIP container, not greppable", () => {
    expect(TEXTUAL_COMPANION_ROLES).not.toContain("xlsx");
    expect(TEXTUAL_COMPANION_ROLES).toContain("dmn");
  });

  test("no duplicates", () => {
    expect(new Set(COMPANION_ROLES).size).toBe(COMPANION_ROLES.length);
  });
});

describe("resolveCompanions", () => {
  test("discovers new-role siblings from the stem", () => {
    const c = resolveCompanions(STEM);
    expect(c.dmn).toBe(`${STEM}.dmn`);
    expect(c.fsh).toBe(`${STEM}.fsh`);
    expect(c.ts).toBe(`${STEM}.ts`);
  });

  test("omits absent siblings rather than inventing paths", () => {
    expect(resolveCompanions(STEM).bpmn).toBeUndefined();
    expect(resolveCompanions(STEM).md).toBeUndefined();
  });

  test("a caller-resolved path wins over the stem guess", () => {
    // `lean` is the motivating case: it may live in the Lake tree rather than
    // beside the manifest, so re-deriving it from the stem would lose it.
    const c = resolveCompanions(STEM, { lean: "/elsewhere/Foo.lean" });
    expect(c.lean).toBe("/elsewhere/Foo.lean");
  });

  test("an explicitly-absent role stays absent", () => {
    const c = resolveCompanions(STEM, { dmn: undefined });
    expect(c.dmn).toBeUndefined();
  });
});

describe("applicabilityGap", () => {
  test("undefined when every declared companion is present", () => {
    expect(applicabilityGap(["dmn", "ts"], resolveCompanions(STEM))).toBeUndefined();
  });

  test("names the missing role — this is what used to be unreachable", () => {
    expect(applicabilityGap(["md"], resolveCompanions(STEM))).toBe("md");
    expect(applicabilityGap(["bpmn"], resolveCompanions(STEM))).toBe("bpmn");
  });

  test("reports in declared order, so the sidecar note is stable", () => {
    expect(applicabilityGap(["md", "lean"], {})).toBe("md");
    expect(applicabilityGap(["lean", "md"], {})).toBe("lean");
  });

  test("a criterion depending on nothing always applies", () => {
    expect(applicabilityGap([], {})).toBeUndefined();
  });
});

describe("no churn on the existing paper corpus", () => {
  test("the n/a note is byte-identical to the strings sidecars already hold", () => {
    // sameScriptVerdict compares `notes`. Reword these and every existing
    // `n/a` entry in the folio rewrites on the next sweep.
    expect(missingCompanionNote("md")).toBe("block has no .md sibling");
    expect(missingCompanionNote("lean")).toBe("block has no .lean sibling");
  });

  test("every built-in-scoped criterion still declares only built-in companions", () => {
    // DAK criteria now exist and legitimately depend on .dmn/.fsh, so this
    // narrows to the paper axes — which are the ones whose sidecars already
    // exist in the folio and must not start invalidating differently.
    const paper = new Set(["md", "ts", "lean"]);
    for (const def of QA_CRITERIA_REGISTRY) {
      if (!CONTENT_ADAPTERS.some((a) => criterionAdapters(def).includes(a))) continue;
      for (const r of def.depends_on) {
        expect(paper.has(r)).toBe(true);
      }
    }
  });
});

describe("freshness over the new roles", () => {
  const entryFor = (hashes: ReturnType<typeof hashBlockFiles>): QaCriterionEntry => ({
    field_hash: hashes,
    result: "pass",
    reviewer: { kind: "agent", id: "test" },
    reviewed_at: "2026-01-01T00:00:00Z",
  });

  test("hashBlockFiles hashes a .dmn", () => {
    const h = hashBlockFiles({ dmn: `${STEM}.dmn` });
    expect(h.dmn).toMatch(/^[0-9a-f]{12}$/);
  });

  test("existing {md, ts, lean} call sites are unaffected", () => {
    const h = hashBlockFiles({ ts: `${STEM}.ts` });
    expect(Object.keys(h)).toEqual(["ts"]);
  });

  test("freshnessKeys passes a new role through", () => {
    expect(freshnessKeys({ depends_on: ["dmn"], also_invalidated_by: ["graph"] })).toEqual([
      "dmn",
      "graph",
    ]);
  });

  test("editing the .dmn invalidates a verdict keyed on it", () => {
    const before = hashBlockFiles({ dmn: `${STEM}.dmn` });
    const entry = entryFor(before);
    expect(entryIsFresh(entry, before, ["dmn"])).toBe(true);

    writeFileSync(`${STEM}.dmn`, "<definitions><decision/></definitions>\n");
    const after = hashBlockFiles({ dmn: `${STEM}.dmn` });
    expect(entryIsFresh(entry, after, ["dmn"])).toBe(false);
  });

  test("a .dmn appearing after the audit invalidates too", () => {
    const entry: QaCriterionEntry = { ...entryFor({}), result: "n/a" };
    expect(entryIsFresh(entry, {}, ["bpmn"])).toBe(true);
    expect(entryIsFresh(entry, { bpmn: "abc123abc123" }, ["bpmn"])).toBe(false);
  });
});
