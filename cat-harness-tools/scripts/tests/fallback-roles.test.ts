/**
 * A `fallback` resolves to something real, and the derivation is exact.
 *
 * The property worth pinning is not "the check finds a bad string" — the
 * old version of this file did that, over a field that no longer exists.
 * It is that **the fallback role is recoverable from the diagram**, which
 * is the whole argument for having removed the declaration (bean
 * `folio-assistant-85e8`, on the owner's question about duplicate data).
 * If that derivation ever stops returning `publication-manager` for
 * `qa-report-signing`, the removal was wrong and this says so.
 *
 * @module scripts/tests/fallback-roles.test
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  SCANNED,
  checkoutCapabilityFacts,
  declaredCapabilities,
  declaredCapabilityFacts,
  declaredRoles,
  fallbackRoleFor,
  fallbackRolesBySkill,
  fallbackUses,
  transitivelyRequires,
} from "../check-fallback-roles.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";
import { notApplicableAlone } from "../../test/support/checkout.js";

/** The Lean pair (`lean-toolchain`, `lean-mcp`) is declared by folio-assistant-sci, the layer its subject belongs to; only a composed checkout holds it. */
const NO_LEAN_CAPABILITIES = notApplicableAlone(
  "folio-assistant-sci's scenarios/capabilities/, which declares `lean-toolchain` and its `fallbackTo: lean-mcp`",
);

const ROOT = resolve(HARNESS_ROOT);

describe("the registries it resolves against", () => {
  test("both are non-empty, or every resolution below is vacuous", () => {
    expect(declaredRoles(ROOT).size).toBeGreaterThan(10);
    expect(declaredCapabilities(ROOT).size).toBeGreaterThan(5);
  });

  test("roles are read through the declaration, so relocating the kg graph cannot blind it", () => {
    // `check:declared-paths` refused a hardcoded `scenarios/roles.json`
    // in the first draft. Asserting a known id is present is what makes the
    // declaration-reading path testable at all.
    expect(declaredRoles(ROOT).has("publication-manager")).toBe(true);
  });
});

describe("the derivation that replaced the declaration", () => {
  test("qa-report-signing falls back to publication-manager, from the DIAGRAM", () => {
    // The exact value `fallbackRole` used to declare. `Task_HumanSign` is a
    // `userTask` in `Lane_Human`, which binds `publication-manager`; the
    // declaration was a second copy of this with nothing asserting they
    // agreed.
    //
    // Read from the hoisted BATCH — `fallbackRoleFor` is `BATCH.get(skill) ?? []`
    // over the same pass — rather than a second corpus pass of its own (bean
    // `sff8`). The bounded sample at the end of this file is what pins the
    // single-skill path to BATCH.
    expect(BATCH.get("qa-report-signing") ?? []).toEqual(["publication-manager"]);
  });

  test("a skill with no human-only lane derives nothing, rather than guessing", () => {
    // The failure that would make the whole approach unsafe is a derivation
    // that returns SOMETHING for every skill — then a fallback with no
    // route would silently resolve. Against the hoisted BATCH, as above.
    expect(BATCH.get("formalizer") ?? []).toEqual([]);
    // The `no-such-skill-anywhere` case that used to sit here is asserted in
    // `describe("the batch pass agrees...")` below, through BOTH paths rather than
    // one. It was a second full pass over 74 diagrams for a claim already made,
    // which put this test at 3.93 s of a 5000 ms budget (79 %) and second on
    // `check:test-budgets`' exposure list. Bean `sff8`: the coverage moved, it did
    // not go.
  });

  test("the retired field is gone from both declarations and from the corpus", async () => {
    // A field removed from the type but left in a module would still be
    // read by nothing AND invisible to the type checker, since the schema
    // is not applied to these modules at build time.
    const { readFileSync } = await import("node:fs");
    for (const f of ["schemas/conduct/assistant-types.ts", "schemas/kg/skill-package.ts"]) {
      // Both modules moved into this layer with schemas/ (8lcl).
      const src = readFileSync(resolve(TOOLS_ROOT, f), "utf-8");
      // Mentioned in prose (the record of why it went), never re-declared.
      expect(src).not.toMatch(/^\s*fallbackRole[?]?:/m);
    }
    const uses = fallbackUses(ROOT, SCANNED);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).not.toHaveProperty("fallbackRole");
  });
});

describe("the scan", () => {
  function fixture(files: Record<string, string>): string {
    const root = mkdtempSync(resolve(tmpdir(), "fallback-"));
    for (const [rel, body] of Object.entries(files)) {
      const abs = resolve(root, rel);
      mkdirSync(resolve(abs, ".."), { recursive: true });
      writeFileSync(abs, body);
    }
    return root;
  }

  test("finds a fallback and the capability it is for", () => {
    const root = fixture({
      "skills/a.ts": `const x = { capabilityId: "c1", degradation: "fallback" };\n`,
      "skills/b.ts": `const y = { capabilityId: "c3", degradation: "fail" };\n`,
    });
    try {
      expect(fallbackUses(root, ["skills"]).map((u) => [u.skill, u.capabilityId])).toEqual([
        ["a", "c1"],
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does NOT read its own documentation as corpus", () => {
    // The first run of the rewritten check reported `assistant-types.ts` as
    // a skill with an unresolvable fallback: it had matched a JSDoc table
    // describing the very field being removed. A scanner that reads prose
    // as declarations is this repo's "measured the wrong thing" in
    // miniature.
    const root = fixture({
      "skills/a.ts":
        `/**\n * | \`fallback\` | see below |\n * A ref reads degradation: "fallback" and resolves.\n */\n` +
        `// const dead = { capabilityId: "old", degradation: "fallback" };\n` +
        `export const real = 1;\n`,
    });
    try {
      expect(fallbackUses(root, ["skills"])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a .test.ts file is not corpus", () => {
    const root = fixture({
      "skills/a.test.ts": `const x = { capabilityId: "c", degradation: "fallback" };\n`,
    });
    try {
      expect(fallbackUses(root, ["skills"])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the capability-level fallback, and the contradiction it exposed", () => {
  /** The platform's own registry — what the id-set helper below is compared against. */
  const own = declaredCapabilityFacts(ROOT);
  // The whole checkout's: a capability is declared by the layer its
  // subject belongs to, and the Lean pair is no longer the platform's.
  const facts = checkoutCapabilityFacts(repoRootFor(ROOT));

  test.skipIf(NO_LEAN_CAPABILITIES)("`fallbackTo` is declared ONCE, on the capability it is a property of", () => {
    // Five skill modules each carried `fallbackCapabilityId: "lean-mcp"`.
    // What substitutes for `lean-toolchain` is a fact about
    // `lean-toolchain`, so a sixth Lean skill no longer has to remember it.
    expect(facts.get("lean-toolchain")?.fallbackTo).toBe("lean-mcp");
    for (const u of fallbackUses(ROOT, SCANNED)) {
      expect(u).not.toHaveProperty("fallbackCapabilityId");
    }
  });

  test("the fallback CAN fire — inverted 2026-09-20, and that is the point", () => {
    // This test asserted the DEFECT for a few hours: `lean-mcp` declared
    // `requires: ["lean-toolchain"]`, so `probeAll`'s
    // `present = requiresMet && probe(…)` made it absent in exactly the case
    // the fallback existed for.
    //
    // The owner resolved it — `lean-mcp`'s Lean runs server-side, detection
    // is an `mcp-probe`, so the requirement was wrong — and the test is
    // INVERTED rather than deleted. Deleting it would leave no evidence the
    // finding was ever real, and the next person to add that `requires` back
    // would get a green suite and a dead fallback.
    expect(facts.get("lean-mcp")?.requires ?? []).not.toContain("lean-toolchain");
    expect(transitivelyRequires(facts, "lean-mcp", "lean-toolchain")).toBe(false);
  });

  test("no declared fallback anywhere needs the thing it replaces", () => {
    // The general form, now that the corpus is clean and the check gates on
    // it. Written over every capability rather than the one pair, so a new
    // `fallbackTo` cannot reintroduce the shape without failing here first.
    for (const [id, c] of facts) {
      if (!c.fallbackTo) continue;
      expect(`${id} → ${c.fallbackTo}: ${transitivelyRequires(facts, c.fallbackTo, id)}`).toBe(
        `${id} → ${c.fallbackTo}: false`,
      );
    }
  });

  test("the predicate is not vacuously false — it fires on a real chain", () => {
    // With the corpus clean, every assertion above expects `false`, which a
    // predicate that ALWAYS returns false would satisfy. This is the guard
    // against that, on a constructed chain rather than the corpus.
    const m = new Map([
      ["missing", { id: "missing", requires: [] }],
      ["substitute", { id: "substitute", requires: ["missing"] }],
    ]);
    expect(transitivelyRequires(m, "substitute", "missing")).toBe(true);
  });

  test("transitivity is followed, and a cycle terminates", () => {
    const m = new Map([
      ["a", { id: "a", requires: ["b"] }],
      ["b", { id: "b", requires: ["c"] }],
      ["c", { id: "c", requires: [] }],
      ["x", { id: "x", requires: ["y"] }],
      ["y", { id: "y", requires: ["x"] }],
    ]);
    expect(transitivelyRequires(m, "a", "c")).toBe(true);
    expect(transitivelyRequires(m, "a", "z")).toBe(false);
    // Same reading `probeAll` takes: on the stack is unmet, not infinite.
    expect(transitivelyRequires(m, "x", "z")).toBe(false);
  });

  test("the id-set helper still agrees with the facts map", () => {
    expect(declaredCapabilities(ROOT)).toEqual(new Set(own.keys()));
  });
});

/**
 * The batch, built ONCE at module scope — and the cross-check deliberately BOUNDED.
 *
 * Bean `sff8`. Comparing `fallbackRolesBySkill` against the single-skill path is
 * inherently one full pass per skill: that is the cost the batch exists to remove, so
 * the test proving it correct necessarily pays it. Measured 2026-09-27 at ~1.5 s per
 * single-skill call, and the first version of this test — exhaustive over all skills —
 * took **36 s** and timed out on bun's 5000 ms default. Re-measured 2026-10-24 over
 * 101 diagrams: ~6.4 s quiet, every test here over budget — instance-layout discovery
 * redone per diagram, not the corpus outgrowing the formula. With the layout resolved
 * once per layer root in `process-model.ts`: **~1.6 s quiet, ~2.9 s cold**, so the
 * budget below stands as derived.
 *
 * Two moves, both from this bean's own taxonomy, and then a judgement:
 *
 *  - HOIST the shared pass to module scope, where it is charged to no test's budget.
 *  - DERIVE the remaining budget from the population, as
 *    `declared-directory-resolves.test.ts` does for its process-per-module spawn — a
 *    number that grows with the corpus instead of tightening every time a skill is
 *    added. NOT a raised timeout, which this bean rules out.
 *  - and BOUND the sample, because the exhaustive version added **34 s to a ~270 s
 *    suite — 13 % on every run, for every contributor, forever** — to re-check a
 *    property whose structural argument is written out in `fallbackRolesBySkill`'s
 *    docblock (the three filters are independent per node). Spending that on every run
 *    would be this bean's own defect committed by its own fix.
 *
 * So this is a REGRESSION DETECTOR over a fixed sample, not a proof of equivalence,
 * and it is labelled as one. The full 28-skill comparison was run once, by hand, at
 * the commit that introduced the batch: **0 disagreements**, batch 1417.6 ms against
 * 25476.2 ms for the loop.
 */
const BATCH = await fallbackRolesBySkill(ROOT);
/** ~3.3x the measured quiet cost per call, matching `declared-directory-resolves`' ~3.5x. */
const PER_SKILL_BUDGET_MS = 5000;
/**
 * Deterministic and small: sorted so the sample cannot drift between runs.
 *
 * Held as ENTRIES rather than keys so the expected value is typed — `BATCH.get(k)` is
 * `string[] | undefined` even for a key that came from `BATCH`, and asserting that
 * away with `!` would be a non-null claim the compiler was right to ask about.
 */
const SAMPLE = [...BATCH.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 6);

describe("the batch pass agrees with asking per skill — bounded regression check", () => {
  test(
    "the same roles come back for up to 6 sampled skills",
    async () => {
      // Non-vacuity first, twice over: an empty batch, or a sample whose every entry
      // is empty, would satisfy the loop below and prove nothing (`6tkl`).
      expect(BATCH.size).toBeGreaterThan(0);
      expect(SAMPLE.length).toBeGreaterThan(0);
      expect(SAMPLE.some(([, roles]) => roles.length > 0)).toBe(true);
      for (const [skill, roles] of SAMPLE) {
        expect(await fallbackRoleFor(ROOT, skill), `skill ${skill}`).toEqual(roles);
      }
      // ONE single-path call beyond the sample, inside its budget rather than added to
      // it (the budget stays `SAMPLE.length * PER_SKILL_BUDGET_MS`, so this only
      // tightens it): absence, which the tests above now read from BATCH alone. The
      // sample is what pins the single path to the batch for skills that ARE present.
      expect(await fallbackRoleFor(ROOT, "no-such-skill-anywhere")).toEqual([]);
    },
    SAMPLE.length * PER_SKILL_BUDGET_MS,
  );

  test("a skill in NO diagram is absent from the batch and empty from the single path", () => {
    // The two must agree on absence as well as presence: a batch that simply omitted
    // unknown skills while the single path returned something would disagree exactly
    // where a caller reads "no fallback route". The single-path half is asked inside
    // the bounded sample above, not by a further corpus pass here (bean `sff8`).
    expect(BATCH.has("no-such-skill-anywhere")).toBe(false);
    expect(BATCH.get("no-such-skill-anywhere") ?? []).toEqual([]);
  });

  test("roles are sorted for EVERY skill, so two callers cannot see different orders", () => {
    // Free over the whole batch — no per-skill pass — so this one is not sampled.
    for (const [skill, roles] of BATCH) {
      expect(roles, `skill ${skill}`).toEqual([...roles].sort());
    }
  });
});
