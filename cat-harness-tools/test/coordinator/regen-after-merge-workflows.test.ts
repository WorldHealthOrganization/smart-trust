/**
 * `regen-after-merge` tests that read the aggregate repository's own root —
 * `.github/workflows/code-quality-gates.yml` — moved here from
 * `cat-harness-tools/scripts/tests/sdlc/regen-after-merge.test.ts` (bean `ho66`), as
 * `merge-guard-workflows.test.ts` was: a standalone cat-harness layer has no
 * such root, and `check:cat-harness-standalone` collects every test in that
 * layer. The rest of that file's tests stay there.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { describe, expect, test } from "bun:test";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  NO_WRITER,
  UNGATED_INPUTS,
  WRITER_OVERRIDES,
  repairableGates,
  scriptOf,
  writerFor,
} from "../../scripts/regen-after-merge.ts";
import { loadGates } from "../../scripts/gates.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { scriptsOf } from "../../schemas/sdlc/script-table.ts";

/**
 * The directory this test was written in (`cat-harness/scripts/tests/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const INSTANCE = join(ORIGIN_DIR, "..", "..");
const REPO = repoRootFor(INSTANCE);
const SCRIPTS = scriptsOf(REPO);

describe("a writer that is not <check minus :check> is DECLARED (bean eowd)", () => {
  // Bean `loxz` (cat-harness 4690860) reversed the eowd pairing: both gates
  // are judge-mode checks against qa-reports, so a pass says nothing about
  // whether `audit-coverage.qa-results.json` is current. Regen must not
  // offer `audit:coverage` as their repair; NO_WRITER says why.
  test("the audit-coverage gates run in CI and are NOT offered for repair — bean loxz", () => {
    const gates = loadGates(REPO, {});
    const pairs = repairableGates(gates, SCRIPTS);
    for (const gate of ["audit:coverage:strict", "audit:coverage:require-all"]) {
      expect(gates.some((g) => g.command.includes(gate)), `${gate} is no longer a CI gate`).toBe(true);
      expect(pairs.find((p) => p.check === gate)).toBeUndefined();
      expect(NO_WRITER[gate]).toContain("judge-mode");
    }
  });

  // Moved from `cat-harness-tools/scripts/tests/sdlc/regen-after-merge.test.ts`: the
  // overrides name writers declared by layers above cat-harness, so only the
  // whole checkout's script table can answer it.
  test("every override names a writer that exists — a renamed writer is a finding, not a guess", () => {
    for (const w of Object.values(WRITER_OVERRIDES)) expect(SCRIPTS[w]).toBeDefined();
  });
});

describe("a `check:X` gate is paired only by DECLARATION — bean `uju6`", () => {

  test("every `check:X` that is some script's command plus ` --check` is decided — paired or recorded", () => {
    // The measurement that found `check:glossary` (main red at 7bdda74) after
    // uju6 had listed four. Composing the pair from the COMMAND, not the name,
    // is how a fifth and sixth were found; this keeps a seventh from hiding.
    const byCmd = new Map(Object.entries(SCRIPTS).map(([k, v]) => [String(v).trim(), k]));
    // The WHOLE gate set, not the fast one (bean `g5kt`). `regen --all` asks
    // the browser jobs' and other workflows' pairs too, so a `check:X` gate
    // that lives only there was derived by exactly the convention this test
    // exists to police and no assertion reached it.
    const gates = loadGates(REPO, { all: true });
    for (const g of gates) {
      const c = scriptOf(g.command);
      if (c === undefined || !c.startsWith("check:") || c.endsWith(":check")) continue;
      const cmd = String(SCRIPTS[c] ?? "").trim();
      if (!cmd.endsWith(" --check")) continue;
      if (!byCmd.has(cmd.slice(0, -" --check".length).trim())) continue;
      expect(WRITER_OVERRIDES[c] !== undefined || NO_WRITER[c] !== undefined, `${c} is undecided`).toBe(true);
    }
  });

  // Moved from `cat-harness-tools/scripts/tests/sdlc/regen-after-merge.test.ts`, for the
  // same reason: the recorded non-writers are scripts declared above cat-harness.
  test("the recorded non-writers are real scripts, and none is also paired", () => {
    for (const check of Object.keys(NO_WRITER)) {
      expect(SCRIPTS[check]).toBeDefined();
      expect(WRITER_OVERRIDES[check]).toBeUndefined();
      // Not guessed from the name either: `check:subgraphs` has a `subgraphs`
      // script, and it only reports.
      expect(writerFor(SCRIPTS, check)).toBeUndefined();
    }
  });
});

describe("UNGATED_INPUTS — writers regen runs without making them gates (bean 5qq3)", () => {
  const pkg = { scripts: scriptsOf(REPO) };

  test("none of them is a gate — the owner's 2026-09-20 ruling keeps them ungated", () => {
    // If one of these BECOMES a gate, it belongs in the gated set and this list
    // must drop it, or regen asks it twice under two different reasons.
    const gated = new Set(repairableGates(loadGates(REPO, { all: true }), pkg.scripts).map((p) => p.check));
    for (const { check } of UNGATED_INPUTS) expect(gated.has(check), `${check} is gated now`).toBe(false);
  });
});

describe("a writer must WRITE — bean `i1q7`", () => {

  test("no pair regen uses runs its CHECK as its writer, or a writer that is itself a check", () => {
    const pairs = [...UNGATED_INPUTS, ...repairableGates(loadGates(REPO, { all: true }), SCRIPTS)];
    for (const p of pairs) {
      if (p.writer === undefined) continue;
      expect(p.writer, p.check).not.toBe(p.check);
      expect(SCRIPTS[p.writer], `${p.check}'s writer ${p.writer}`).not.toMatch(/--check\b/);
    }
  });
});

describe("the default asks the WHOLE gate set — bean `i1q7`, item 3", () => {
  test("render:bpmn:check and bat:sync:check are pairs regen asks by default", () => {
    // They are outside the fast set only because the e2e job installs a
    // browser. regen never runs `playwright test`, so that boundary is not
    // regen's, and render:bpmn was stale after every merge that changed a
    // process while regen printed it as a footnote.
    //
    // regen's default IS the whole set: `all` is false only under `--fast`,
    // and that flag is what reaches `loadGates`. Read from regen's own source,
    // since the flag is parsed at module load and running regen is not a unit
    // test's job.
    const src = readFileSync(join(import.meta.dir, "..", "..", "scripts", "regen-after-merge.ts"), "utf-8");
    expect(src).toContain('const fast = process.argv.includes("--fast");');
    expect(src).toContain("const all = !fast;");
    expect(src).toContain("const gates = loadGates(repoRoot, { all });");
    const pairs = repairableGates(loadGates(REPO, { all: true }), SCRIPTS);
    expect(pairs.find((p) => p.check === "render:bpmn:check")?.writer).toBe("render:bpmn");
    expect(pairs.find((p) => p.check === "bat:sync:check")?.writer).toBe("bat:sync");
  });
});
