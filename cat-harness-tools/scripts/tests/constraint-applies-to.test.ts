/**
 * `validate.ts` gates every constraint on its `appliesTo` list:
 *
 *     if (!rule.appliesTo.includes(block.kind)) continue;
 *
 * A kind missing from that list is not reported as unchecked — it is
 * simply never checked. Which makes a short `appliesTo` the same defect
 * as a short block-kind regex, one layer down: the validator passes
 * because it never looked.
 *
 * Three rules were short for no reason. `cites` and `simulator` are
 * **BlockBase** fields, so every kind can carry one, and both checks
 * already return null when the field is absent — the narrower list only
 * removed coverage. `md-crossref-resolve` guards on `ctx.mdContent`, so
 * kinds without an `.md` were already no-ops.
 *
 * The rest are genuinely kind-specific, and this pins WHICH and WHY. A
 * new kind added to `Block` now has to be classified here: it either
 * lands in `BLOCK_KINDS` and every universal rule picks it up, or
 * someone states the reason it is exempt.
 */
import { describe, expect, test } from "bun:test";
// The rules validate.ts runs: cat-harness's, and each vocabulary module's
// (the science layer carries the rules about its own kinds since 2026-10-22).
import { allConstraintRules } from "../../schemas/content/vocabulary-modules.ts";
import { BLOCK_KINDS } from "../../schemas/content/block-kinds.ts";

/**
 * Rules that are deliberately narrower, with the reason. Anything not
 * listed here must apply to every kind.
 */
const KIND_SPECIFIC: Record<string, { kinds: string[]; because: string }> = {
  "lean-file-exists": {
    kinds: ["definition"],
    because: "only definitions are required to carry a sibling .lean",
  },
  "simulator-html-exists": {
    kinds: ["simulator"],
    because: "the html field belongs to the simulator block itself",
  },
  "remark-interprets": {
    kinds: ["remark"],
    because: "`interprets` is a remark-only field",
  },
  "interprets-resolve": {
    kinds: ["remark"],
    because: "`interprets` is a remark-only field",
  },
  "provable-lean-warning": {
    kinds: ["theorem", "lemma", "proposition", "corollary"],
    because: "only provable kinds are expected to have a formalisation",
  },
  "lean-stub-conjecture-kind-check": {
    kinds: ["proposition", "theorem", "lemma", "corollary"],
    because:
      "asks whether a PROVABLE block should have been a conjecture, given " +
      "its Lean stub. The question is meaningless for any other kind.",
  },
  "md-exists": {
    // With `mathpaper-md-exists`, the science layer's copy for its own kinds
    // (since 2026-10-22): the two together cover these, whichever holds which
    // while cat-harness's copy is cut down to its own kinds. See SHARED below.
    kinds: [
      "definition", "theorem", "lemma", "proposition", "corollary",
      "conjecture", "example", "remark", "simulator", "prose", "recommendation",
    ],
    because:
      // `recommendation` joined when cat-harness admitted the normative
      // statement kind: its body is prose, so it carries a companion .md.
      "whether equation/diagram/table/proof/algorithm blocks must have a " +
      "companion .md is an editorial policy question, not drift — left as " +
      "found, deliberately. Its description says 'every block', which is " +
      "wider than its behaviour; see bean j19q.",
  },
};

/**
 * A scope split across rules by layer: the ids listed beside a KIND_SPECIFIC
 * entry cover its kinds TOGETHER. `md-exists` is cat-harness's; the science
 * layer's vocabulary module carries the same check for its kinds.
 */
const SHARED: Record<string, string[]> = { "md-exists": ["mathpaper-md-exists"] };

const RULES = allConstraintRules();
const byId = new Map(RULES.map((c) => [c.id, c]));
/** A kind-specific entry about kinds no layer here declares (the science layer, unmounted) has no rule to find. */
const inScope = (kinds: string[]): boolean => kinds.some((k) => (BLOCK_KINDS as readonly string[]).includes(k));

describe("constraint appliesTo coverage", () => {
  test("every rule is either universal or listed as kind-specific", () => {
    // The forcing function. A new rule with a short appliesTo, or a new
    // block kind that some rule was not extended to, fails here rather
    // than quietly narrowing what gets validated.
    const unexplained: string[] = [];
    for (const rule of RULES) {
      const missing = BLOCK_KINDS.filter((k) => !rule.appliesTo.includes(k));
      if (missing.length === 0) continue;
      if (KIND_SPECIFIC[rule.id] || Object.values(SHARED).some((ids) => ids.includes(rule.id))) continue;
      unexplained.push(`${rule.id} skips: ${missing.join(", ")}`);
    }
    expect(unexplained).toEqual([]);
  });

  test("each kind-specific rule matches its documented scope exactly", () => {
    // Pins the narrowing itself, so widening or narrowing one of these
    // is a deliberate edit here rather than a silent change in coverage.
    for (const [id, { kinds }] of Object.entries(KIND_SPECIFIC)) {
      if (!inScope(kinds)) continue;
      const rule = byId.get(id);
      expect({ id, found: rule !== undefined }).toEqual({ id, found: true });
      const covered = new Set([id, ...(SHARED[id] ?? [])].flatMap((r) => byId.get(r)?.appliesTo ?? []));
      const declared = kinds.filter((k) => (BLOCK_KINDS as readonly string[]).includes(k) || covered.has(k));
      expect({ id, kinds: [...covered].sort() }).toEqual({ id, kinds: [...declared].sort() });
    }
  });

  test("rules checking a BlockBase field apply to every kind", () => {
    // `cites` and `simulator` are on BlockBase, so any kind can carry
    // them. `uses` was already universal; these two were not.
    for (const id of ["cites-resolve", "simulator-ref-resolve", "uses-resolve"]) {
      const rule = byId.get(id)!;
      const missing = BLOCK_KINDS.filter((k) => !rule.appliesTo.includes(k));
      expect({ id, missing }).toEqual({ id, missing: [] });
    }
  });

  test("md-crossref-resolve covers every kind that can have an .md", () => {
    const rule = byId.get("md-crossref-resolve")!;
    expect(rule.appliesTo).toContain("proof");
    expect(rule.appliesTo).toContain("algorithm");
    expect(rule.appliesTo).toContain("table");
  });

  test("no rule lists a kind that is not a block kind", () => {
    // The other direction of drift: a rule naming a kind that was
    // renamed or removed silently applies to nothing.
    const all = new Set<string>(BLOCK_KINDS);
    for (const rule of RULES) {
      const bogus = rule.appliesTo.filter((k) => !all.has(k));
      expect({ id: rule.id, bogus }).toEqual({ id: rule.id, bogus: [] });
    }
  });
});

describe("cites-resolve actually fires now", () => {
  const rule = byId.get("cites-resolve")!;
  const ctx = {
    rootName: "b", dir: "/tmp", allLabels: new Set<string>(),
    allRefIds: new Set(["knuth1984"]),
    fileExists: () => true,
  } as unknown as Parameters<typeof rule.check>[1];

  test("catches a bad citation key on a `table` block", () => {
    // `table` was not in this rule's appliesTo, so validate.ts skipped it
    // entirely. qou carries ~445 table blocks.
    const block = { kind: "table", label: "tbl:x", cites: ["nosuchkey"] };
    const msg = rule.check(block as never, ctx);
    expect(msg).toBeTruthy();
    expect(String(msg)).toContain("nosuchkey");
  });

  test("accepts a good key, on the same previously-excluded kind", () => {
    const block = { kind: "table", label: "tbl:x", cites: ["knuth1984"] };
    expect(rule.check(block as never, ctx)).toBeNull();
  });

  test("still no-ops for a block with no cites[]", () => {
    // Why widening is behaviour-preserving: the rule self-guards.
    const block = { kind: "table", label: "tbl:x" };
    expect(rule.check(block as never, ctx)).toBeNull();
  });

  test("no-ops when allRefIds is absent — which is why it never fired", () => {
    // The real defect: validate.ts built its ConstraintContext without
    // allRefIds, so this returned null for EVERY block regardless of kind.
    const noRefs = { ...ctx, allRefIds: undefined } as unknown as Parameters<typeof rule.check>[1];
    const block = { kind: "theorem", label: "thm:x", cites: ["nosuchkey"] };
    expect(rule.check(block as never, noRefs)).toBeNull();
  });
});
