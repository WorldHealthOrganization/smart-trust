/**
 * `pair-cover.ts` — regen derives a covered check's verdict instead of
 * re-running work other pairs already do (bean `8qyc`).
 *
 * The assertions that matter are the ones that would catch a FALSE GREEN: a
 * covered check reported `current` while a coverer is red, a fold made when a
 * coverer is not asked, and an equivalence that silently stopped holding
 * because somebody respelt a script.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { foldable, settleCovered } from "../pair-cover.ts";
import { isJudgeCheck, regenPass, type Pair, type Runner } from "../regen-after-merge.ts";
import { CHECKS } from "../skill-register.ts";
import { layerRootsIn, repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { scriptsOf } from "../../schemas/sdlc/script-table.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";

const INSTANCE = join(HARNESS_ROOT);
const REPO = repoRootFor(INSTANCE);
const SCRIPTS = scriptsOf(REPO);

const ALL_SKILL_PAIRS = ["skill:register:check", ...CHECKS];

/** A runner that records what it was asked, answering from a table (default: pass). */
function recording(answers: Record<string, boolean | (() => boolean)> = {}): { runner: Runner; asked: string[] } {
  const asked: string[] = [];
  const runner: Runner = (s) => {
    asked.push(s);
    const a = answers[s];
    return a === undefined ? true : typeof a === "function" ? a() : a;
  };
  return { runner, asked };
}

const pairs = (checks: readonly string[]): Pair[] => checks.map((check) => ({ check, writer: `${check}:writer` }));

describe("when a check is folded", () => {
  test("only when EVERY coverer is asked in the same pass", () => {
    expect(foldable(ALL_SKILL_PAIRS).has("skill:register:check")).toBe(true);
    // Drop one coverer — say `--changed` selected the gate and not that pair.
    expect(foldable(ALL_SKILL_PAIRS.filter((c) => c !== CHECKS[3])).has("skill:register:check")).toBe(false);
    expect(foldable(["kg:audit:check"]).has("kg:audit:check")).toBe(false);
    expect(foldable(["kg:audit:check", "kg:audit:all:check"]).has("kg:audit:check")).toBe(true);
  });

  test("a cycle is never folded — both are asked in full", () => {
    const table = { "a:check": { covers: ["b:check"], why: "t" }, "b:check": { covers: ["a:check"], why: "t" } };
    expect(foldable(["a:check", "b:check"], table).size).toBe(0);
  });
});

describe("regenPass with folds", () => {
  test("skill:register:check runs its residual, not the 107-second whole; kg:audit:check runs nothing", async () => {
    const checks = [...ALL_SKILL_PAIRS, "kg:audit:all:check"];
    const { runner, asked } = recording();
    const { results } = await regenPass(pairs(checks), runner, { dryRun: true });
    expect(asked).not.toContain("skill:register:check");
    expect(asked).toContain("skill:register:declarations:check");
    expect(asked).not.toContain("kg:audit:check");
    expect(asked).toContain("kg:audit:all:check");
    // Every one passes: `current`, or `judged` for a judge check (bean `loxz`),
    // which passes without asserting an artefact matches its writer.
    const wrong = results.filter((r) => r.outcome !== (isJudgeCheck(r.check) ? "judged" : "current"));
    expect(wrong.map((r) => `${r.check}: ${r.outcome}`)).toEqual([]);
  });

  test("a red coverer is NEVER a green covered check — through two levels of folding", async () => {
    const checks = [...ALL_SKILL_PAIRS, "kg:audit:all:check"];
    // kg:audit:all:check is red and its writer does not repair it.
    const { runner } = recording({ "kg:audit:all:check": false });
    const { results } = await regenPass(pairs(checks), runner);
    const by = new Map(results.map((r) => [r.check, r]));
    expect(by.get("kg:audit:all:check")!.outcome).toBe("unrepaired");
    expect(by.get("kg:audit:check")!.outcome).toBe("unrepaired");
    expect(by.get("kg:audit:check")!.coveredBy).toBe("kg:audit:all:check");
    // skill:register:check covers kg:audit:check, which is derived in turn.
    expect(by.get("skill:register:check")!.outcome).toBe("unrepaired");
    expect(by.get("skill:register:check")!.coveredBy).toBe("kg:audit:check");
  });

  test("a stale coverer makes the covered check stale too, in a dry run", async () => {
    const { runner } = recording({ "skills:docs:check": false });
    const { results } = await regenPass(pairs(ALL_SKILL_PAIRS), runner, { dryRun: true });
    const r = results.find((x) => x.check === "skill:register:check")!;
    expect(r.outcome).toBe("regenerated");
    expect(r.coveredBy).toBe("skills:docs:check");
  });

  test("a red residual runs the covered check's OWN writer, then re-asks the residual", async () => {
    let fixed = false;
    const { runner, asked } = recording({
      "skill:register:declarations:check": () => fixed,
      "skill:register:check:writer": () => ((fixed = true), true),
    });
    const { results, writerRan } = await regenPass(pairs(ALL_SKILL_PAIRS), runner);
    expect(writerRan).toEqual(["skill:register:check:writer"]);
    expect(asked.filter((s) => s === "skill:register:declarations:check").length).toBe(2);
    expect(results.find((x) => x.check === "skill:register:check")!.outcome).toBe("regenerated");
  });

  test("a residual that stays red is reported as such even when every coverer is green", async () => {
    const { runner } = recording({ "skill:register:declarations:check": false });
    const { results } = await regenPass(pairs(ALL_SKILL_PAIRS), runner);
    expect(results.find((x) => x.check === "skill:register:check")!.outcome).toBe("unrepaired");
  });

  test("without its coverers the check is asked whole", async () => {
    const { runner, asked } = recording();
    await regenPass(pairs(["skill:register:check", "kg:audit:check"]), runner, { dryRun: true });
    expect(asked).toEqual(expect.arrayContaining(["skill:register:check", "kg:audit:check"]));
    expect(asked).not.toContain("skill:register:declarations:check");
  });

  test("settleCovered leaves an unfolded result alone", () => {
    const rs = [{ check: "x:check", outcome: "unrepaired" }];
    expect(settleCovered(rs, new Map())).toEqual(rs);
  });
});

/**
 * The equivalences the table ASSERTS, pinned to the spellings they were read
 * from. A respelt script breaks one of these, which is the point: the
 * argument in `pair-cover.ts` has to be re-read before the fold may stand.
 */
describe("the equivalences still hold in this tree", () => {
  // "every residual is a script, and every coverer a pair regen asks" reads
  // the CI workflows, so it lives in
  // `test/pair-cover-workflows.test.ts`: a
  // standalone cat-harness layer has no workflows to read.

  test("skill:register's residual is its gate plus --declarations-only, and its chain names scripts", () => {
    expect(SCRIPTS["skill:register:declarations:check"]).toBe(`${SCRIPTS["skill:register:check"]} --declarations-only`);
    // `bun run <name>` in skill-register.ts and in regen: the same program
    // only while every chain step is a bare script name.
    for (const c of CHECKS) expect(c, "a chain step with arguments is not regen's pair").toMatch(/^[A-Za-z0-9:_-]+$/);
  });

  test("kg:audit:all:check runs kg:audit:check's audit for the cat-harness instance, flags and all", () => {
    expect(SCRIPTS["kg:audit:check"]).toBe("bun run cat-harness-tools/scripts/kg-audit.ts --check --against main");
    expect(SCRIPTS["kg:audit:all:check"]).toBe("bun run cat-harness-tools/scripts/kg-audit-all.ts --check --against main");
    // The default root of kg-audit.ts is its own layer; the sweep must reach it.
    expect(layerRootsIn(REPO).map((r) => resolve(r))).toContain(resolve(INSTANCE));
    const all = readFileSync(join(TOOLS_ROOT, "scripts", "kg-audit-all.ts"), "utf-8");
    // Passes --check and --against through, and fails on any non-0/1 exit.
    expect(all).toContain('if (check) argv.push("--check")');
    expect(all).toContain('if (against !== undefined) argv.push("--against", against)');
    expect(all).toContain("failed.some((o) => o.code !== 1)");
  });
});
