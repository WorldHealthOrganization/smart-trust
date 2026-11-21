import { describe, test, expect } from "bun:test";
import {
  entryIsFresh,
  freshnessKeys,
  criterionDefHash,
} from "../../pipeline/qa-utils";
import { QA_CRITERIA_BY_ID } from "../../pipeline/qa-criteria-registry";
import type { QaCriterionEntry } from "../../schemas/sdlc/block-qa.ts";

/**
 * `depends_on` carries two meanings — applicability and freshness — and
 * they come apart for any criterion that READS a file it must not GATE on.
 * `also_invalidated_by` is the freshness half on its own.
 *
 * The live bug these pin: `voice-scholarly-default` scans Lean docstrings
 * but listed only `["md"]`, so a Lean-only edit could not clear its own
 * stale `fail` (qou #4673). The naive fix — adding `"lean"` to
 * `depends_on` — is a WORSE bug: it `n/a`s every prose-only block.
 */

const scriptEntry = (
  field_hash: Record<string, string | undefined>,
  result: QaCriterionEntry["result"] = "fail",
): QaCriterionEntry =>
  ({
    field_hash,
    result,
    reviewer: { kind: "script", id: "test" },
    reviewed_at: "2026-01-01T00:00:00.000Z",
  }) as unknown as QaCriterionEntry;

describe("freshnessKeys", () => {
  test("is depends_on when nothing extra is declared", () => {
    expect(freshnessKeys({ depends_on: ["md", "ts"] }).sort()).toEqual(["md", "ts"]);
  });

  test("unions in also_invalidated_by", () => {
    expect(
      freshnessKeys({ depends_on: ["md"], also_invalidated_by: ["lean"] }).sort(),
    ).toEqual(["lean", "md"]);
  });

  test("de-duplicates an overlapping declaration", () => {
    expect(
      freshnessKeys({ depends_on: ["md", "lean"], also_invalidated_by: ["lean"] }).sort(),
    ).toEqual(["lean", "md"]);
  });
});

describe("entryIsFresh honours also_invalidated_by", () => {
  const def = { depends_on: ["md"] as Array<"md">, also_invalidated_by: ["lean"] as Array<"lean"> };

  test("a Lean-only edit makes the entry STALE (the bug)", () => {
    const entry = scriptEntry({ md: "aaa", lean: "old" });
    const current = { md: "aaa", lean: "new" };
    // Under the old behaviour (depends_on alone) this returned `true`,
    // so a corrected docstring kept serving the stale verdict.
    expect(entryIsFresh(entry, current, ["md"])).toBe(true);
    expect(entryIsFresh(entry, current, freshnessKeys(def))).toBe(false);
  });

  test("an untouched Lean file leaves the entry fresh", () => {
    const entry = scriptEntry({ md: "aaa", lean: "same" });
    expect(
      entryIsFresh(entry, { md: "aaa", lean: "same" }, freshnessKeys(def)),
    ).toBe(true);
  });

  test("a prose-only block stays fresh — no .lean on either side", () => {
    // The `!expected && !actual` branch: absent then, absent now.
    const entry = scriptEntry({ md: "aaa" });
    expect(entryIsFresh(entry, { md: "aaa" }, freshnessKeys(def))).toBe(true);
  });

  test("gaining a .lean sibling invalidates", () => {
    const entry = scriptEntry({ md: "aaa" });
    expect(entryIsFresh(entry, { md: "aaa", lean: "new" }, freshnessKeys(def))).toBe(false);
  });
});

describe("voice-scholarly-default registry wiring", () => {
  const def = QA_CRITERIA_BY_ID["voice-scholarly-default"];

  test("is registered", () => {
    expect(def).toBeDefined();
  });

  test("does NOT gate applicability on .lean — prose-only blocks must still run", () => {
    // This is the regression guard. `qa-sweep` writes an `n/a` and skips
    // the checker for any block missing a `depends_on` file, so listing
    // "lean" here would silently stop checking prose-only blocks.
    expect(def.depends_on).not.toContain("lean");
    expect(def.depends_on).toContain("md");
  });

  test("but DOES invalidate on .lean, because the checker reads docstrings", () => {
    expect(def.also_invalidated_by ?? []).toContain("lean");
  });

  test("so its freshness key set covers both files", () => {
    expect(freshnessKeys(def).sort()).toEqual(["lean", "md"]);
  });
});

describe("registry invariant", () => {
  test("no criterion lists a file in both depends_on and also_invalidated_by", () => {
    // Harmless (freshnessKeys de-dupes) but always a mistake: it means the
    // author was unsure which half they wanted.
    const offenders = Object.values(QA_CRITERIA_BY_ID)
      .filter((d) =>
        (d.also_invalidated_by ?? []).some(
          // "graph" is not a file, so it can never appear in depends_on.
          (k) => k !== "graph" && d.depends_on.includes(k),
        ),
      )
      .map((d) => d.id);
    expect(offenders).toEqual([]);
  });
});

/**
 * Bean `cv10`. `script_hash` covers the checker's CODE and `deps_hash` its
 * extra INPUTS. Neither covers the CRITERION, so re-scoping one left every
 * cached verdict in place: adding `profiles: ["paper"]` to
 * `voice-scholarly-default` and re-sweeping a `document` corpus changed
 * nothing, because the freshness gate short-circuits before the profile gate
 * ever runs. `def_hash` is the missing key.
 *
 * Same family as the bug above — a verdict that can fail to CLEAR — with the
 * criterion itself as the stale input rather than a file.
 */
describe("criterionDefHash", () => {
  test("re-scoping a criterion makes a cached verdict stale", () => {
    // The exact change that was inert: same block, same checker, same files.
    const before = criterionDefHash({ depends_on: ["md"], default_severity: "major" });
    const after = criterionDefHash({
      depends_on: ["md"],
      default_severity: "major",
      profiles: ["paper"],
    });
    expect(after).not.toBe(before);

    const entry = scriptEntry({ md: "aaaa" });
    entry.reviewer.script_hash = "chk1";
    entry.reviewer.def_hash = before;
    const hashes = { script_hash: "chk1", def_hash: after } as never;
    expect(entryIsFresh(entry, { md: "aaaa" }, ["md"], hashes)).toBe(false);
  });

  test("an unchanged definition stays fresh", () => {
    const h = criterionDefHash({ depends_on: ["md"], default_severity: "major" });
    const entry = scriptEntry({ md: "aaaa" });
    entry.reviewer.script_hash = "chk1";
    entry.reviewer.def_hash = h;
    expect(
      entryIsFresh(entry, { md: "aaaa" }, ["md"], {
        script_hash: "chk1",
        def_hash: h,
      } as never),
    ).toBe(true);
  });

  test("re-grading severity invalidates — the entry records it", () => {
    const minor = criterionDefHash({ depends_on: ["md"], default_severity: "minor" });
    const major = criterionDefHash({ depends_on: ["md"], default_severity: "major" });
    expect(minor).not.toBe(major);
  });

  test("description is NOT in the key — a typo fix must not re-sweep a corpus", () => {
    // Pass a full definition and the same definition with reworded prose: for
    // a script criterion the description is documentation, and hashing it
    // would invalidate every verdict in a corpus over an editorial change.
    const base = {
      depends_on: ["md"],
      default_severity: "major",
      profiles: ["paper"],
    };
    expect(
      criterionDefHash({ ...base, description: "one wording" } as never),
    ).toBe(criterionDefHash({ ...base, description: "quite another" } as never));
  });

  test("field ORDER does not change the hash — all six are sets", () => {
    expect(criterionDefHash({ profiles: ["paper", "document"] })).toBe(
      criterionDefHash({ profiles: ["document", "paper"] }),
    );
  });

  test("an entry with no def_hash is STALE once the criterion has one", () => {
    // The one-time adoption churn, asserted rather than discovered: every
    // pre-existing entry re-runs once and is stamped. Mirrors the `deps_hash`
    // asymmetry rule immediately above it in `entryIsFresh`.
    const entry = scriptEntry({ md: "aaaa" });
    entry.reviewer.script_hash = "chk1";
    expect(
      entryIsFresh(entry, { md: "aaaa" }, ["md"], {
        script_hash: "chk1",
        def_hash: "deadbeef1234",
      } as never),
    ).toBe(false);
  });

  test("a live registry criterion produces a stable hash", () => {
    const def = QA_CRITERIA_BY_ID["voice-scholarly-default"]!;
    expect(criterionDefHash(def)).toBe(criterionDefHash(def));
    expect(criterionDefHash(def)).toMatch(/^[0-9a-f]{12}$/);
  });
});
