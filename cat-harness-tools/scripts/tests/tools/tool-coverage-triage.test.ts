/**
 * Tier D meant "no evidence IN THE BODY", and that is not the same thing —
 * bean `6366`.
 *
 * `tools:coverage` triages uncovered skills into four tiers, and decides "has a
 * command" by testing the skill's own markdown for a fenced ```sh block. So a
 * skill that states its rules **without ever showing its command** landed in
 * **D**, the tier whose label reads *"no evidence. Almost certainly
 * judgement."* — and whose members the report does not even print.
 *
 * `ci-health` is the case that proved it: a real command (`check:ci-health`,
 * declared in `package.json`), documented in `AGENTS.md`, reachable from no Tool
 * node, and triaged into D with an **empty evidence list**.
 *
 * That is the same class of error as reading a mechanism from its name: the
 * instrument answered a question about the *prose* and its label made a claim
 * about the *capability*.
 *
 * ## What these tests pin, and why one of them is an invariant rather than a case
 *
 * Asserting "`ci-health` is in tier C" alone would be brittle in a bad way: the
 * day somebody writes its Tool node it leaves the triage altogether and the test
 * fails for the RIGHT reason, looking like a regression. So the case is asserted
 * conditionally and the **rule** is asserted absolutely — no skill with a
 * declared script may sit in D.
 *
 * @module scripts/tests/tool-coverage-triage.test
 */
import { describe, expect, it } from "bun:test";

import { declaredScripts, scriptFor, triage } from "../../tool-coverage.ts";

const rows = await triage();
const scripts = declaredScripts();

describe("the triage is asking a real corpus", () => {
  it("returns rows, and reads a package.json that has scripts", () => {
    // The filter-over-nothing guard. Every assertion below is a filter, and a
    // filter over an empty list passes while proving nothing.
    expect(rows.length).toBeGreaterThan(0);
    expect(scripts.length).toBeGreaterThan(0);
  });
});

describe("a declared script is evidence, so it cannot leave a skill in D", () => {
  it("NO skill in tier D has a package.json script", () => {
    // The invariant. Stated as an absolute because tier D's label tells a reader
    // not to look, so a skill with a real command sitting there is invisible by
    // design rather than by accident.
    const wrong = rows.filter((r) => r.tier === "D" && scriptFor(r.skill, scripts));
    expect(wrong.map((r) => `${r.skill} ← ${scriptFor(r.skill, scripts)}`)).toEqual([]);
  });

  it("the skills moved by this rule carry the command NAME in their evidence", () => {
    // Not merely reclassified: the point of the read tier C asks for is to start
    // from the command, rather than hunt through 114 scripts for it.
    const moved = rows.filter((r) => r.evidence.some((e) => e.startsWith("script:")));
    expect(moved.length).toBeGreaterThan(0);
    for (const r of moved) {
      // Out of D always; C unless STRONGER evidence put it higher. A skill with
      // a script AND an io-contract is A — `crdm-detect` since it gained a
      // contract (#1168, B4) — and that is the tiering working, not the rule
      // failing.
      expect(r.tier).not.toBe("D");
      const stronger = r.evidence.some((e) => e === "serviceTask" || e === "io-contract" || e === "userTask");
      if (!stronger) expect(r.tier).toBe("C");
      expect(r.evidence.some((e) => e === `script:${scriptFor(r.skill, scripts)}`)).toBe(true);
    }
  });

  it("`ci-health` is the worked case — in C if it is still uncovered at all", () => {
    // Conditional on purpose: writing its Tool node removes it from the triage,
    // which is the outcome this finding wants, not a regression.
    const r = rows.find((x) => x.skill === "ci-health");
    if (r) {
      expect(r.tier).toBe("C");
      expect(r.evidence).toContain("script:check:ci-health");
    }
  });
});

describe("`scriptFor` is strict, because loose matching was tried and rejected", () => {
  const fixture: [string, string][] = [
    ["check:ci-health", "bun run scripts/check-ci-health.ts"],
    ["readme:sections", "bun run scripts/readme-sections.ts"],
    ["check:diff-policy", "bun run scripts/diff-policy.ts"],
    ["build", "bun run scripts/render.ts"],
  ];

  it("matches a whole colon segment of the key", () => {
    expect(scriptFor("ci-health", fixture)).toBe("check:ci-health");
    expect(scriptFor("sections", fixture)).toBe("readme:sections");
  });

  it("matches a command that runs `<skill>.ts`", () => {
    expect(scriptFor("render", fixture)).toBe("build");
  });

  it("does NOT match a substring of a segment — the rejected rule", () => {
    // `diff` inside `diff-policy` is the accident a short skill name causes, and
    // `tools:coverage` has 155 uncovered skills for it to happen among. A false
    // "this has a command" is worse than a miss: it moves a judgement skill into
    // the tier a person is told to read.
    expect(scriptFor("diff", fixture)).toBeUndefined();
    expect(scriptFor("policy", fixture)).toBeUndefined();
    expect(scriptFor("health", fixture)).toBeUndefined();
  });

  it("returns undefined for a skill with nothing", () => {
    expect(scriptFor("pure-judgement", fixture)).toBeUndefined();
  });
});
