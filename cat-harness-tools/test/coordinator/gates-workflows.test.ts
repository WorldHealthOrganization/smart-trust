/**
 * `gates.ts` held against the REAL CI workflows — moved here from
 * `cat-harness-tools/scripts/tests/sdlc/gates.test.ts` (bean `ho66`), beside
 * `merge-guard-workflows.test.ts` and for the same reason: a standalone
 * cat-harness layer has no `.github/workflows/`, and
 * `check:cat-harness-standalone` collects every test in that layer. The
 * reader's fixture tests stay there; these pin what it reads from the
 * repository this checkout is.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  GATES_WORKFLOW,
  PRECONDITION_STEPS,
  SCRIPT_EXEMPTIONS,
  STEP_EXEMPTIONS,
  checkScriptNames,
  commandsCiRuns,
  gatesFrom,
  unresolvedGatesFrom,
  isWriterStep,
  loadGates,
  loadUnresolved,
  loadWriterSteps,
  otherWorkflowSteps,
  unclassifiedSteps,
  unrunScripts,
  installsBrowser,
} from "../../scripts/gates.ts";
import { parse } from "yaml";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";

/**
 * The directory this test was written in (`cat-harness/scripts/tests/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

// THE REPOSITORY root — `GATES_WORKFLOW` is `.github/workflows/…`. See the
// same constant in `gates.ts`.
const ROOT = repoRootFor(resolve(ORIGIN_DIR, "../.."));
/** The REPOSITORY root — where `.github/workflows/` lives. */
const REPO = ROOT;

describe("the gates come from the workflow, not from a list", () => {
  test("the real workflow yields a substantial set", () => {
    const gates = loadGates(ROOT);
    // Not a pinned number: pinning it would make this the hand-maintained
    // list the module exists to avoid, and every added gate a failing test.
    // The floor asserts the reader WORKS; the ceiling would assert the
    // workflow never grows.
    expect(gates.length).toBeGreaterThan(10);
  });

  test("it finds more than a person hand-lists — the defect that prompted it", () => {
    // Measured 2026-09-19: the agent writing this had been running 17 gates
    // by hand and reporting them as the sweep. If the derived set ever drops
    // to around that, the extraction has quietly stopped reading most of the
    // workflow and the hand-list would be back, unnoticed.
    expect(loadGates(ROOT).length).toBeGreaterThan(20);
  });

  test("`--all` is a superset of the fast set, and strictly larger", () => {
    const fast = loadGates(ROOT).map((g) => g.command);
    const all = loadGates(ROOT, { all: true }).map((g) => g.command);
    for (const c of fast) expect(all).toContain(c);
    // The browser job exists and contributes; if this fails, either the e2e
    // job went away or the fast/slow split has stopped meaning anything.
    expect(all.length).toBeGreaterThan(fast.length);
  });

  test("the browser-only gate is in `--all` and NOT in the fast set", () => {
    // `render:bpmn:check` renders through Chromium. It once passed "locally"
    // only because a browser had been staged earlier in the session, which
    // is the precise green-here-red-there gap these gates close.
    const fast = loadGates(ROOT).map((g) => g.command);
    const all = loadGates(ROOT, { all: true }).map((g) => g.command);
    expect(all.some((c) => c.includes("render:bpmn:check"))).toBe(true);
    expect(fast.some((c) => c.includes("render:bpmn:check"))).toBe(false);
  });

  test("every extracted command is a bun invocation, in workflow order", () => {
    const gates = loadGates(ROOT, { all: true });
    for (const g of gates) expect(g.command).toMatch(/^(bun|bunx) /);
    // Order matters: `bun test` before the slower graph audits is what makes
    // the runner usable, and it is the workflow's order rather than a sort.
    const cmds = gates.map((g) => g.command);
    // Found by prefix, never by exact string: the step became
    // `bun test --parallel` (bean `dlqu`), and an exact `indexOf` would then
    // return -1, which is less than any index — a vacuous pass.
    const test = cmds.findIndex((c) => /^bun test\b/.test(c));
    expect(test).toBeGreaterThanOrEqual(0);
    expect(test).toBeLessThan(cmds.indexOf("bun run cat kg:audit:check"));
  });

  test("each gate carries the step name the Actions UI shows", () => {
    // So a local failure and a CI failure are findable by the same string.
    const g = loadGates(ROOT).find((x) => x.command === "bun run cat ns:check");
    expect(g?.step).toBe("namespace vocabulary is complete");
    // `gates`, not `typescript`, since bean `om30` split the job: `typescript`
    // is lint + typecheck + `bun test`, and every repository gate moved to a
    // sibling job with no `needs`, so a red test no longer stops them being
    // asked. The job is asserted rather than left loose because it is half of
    // what makes a failure findable — the Actions UI groups by it. Since bean
    // `doxj` the repository gates run as three parallel parts under a `gates`
    // roll-up that runs no `bun` line, and this one is in `gates-docs`.
    expect(g?.job).toBe("gates-docs");
  });

  test("every browser-free job contributes, so a split cannot silently shrink the set", () => {
    // The regression this guards is specific and was live for one commit while
    // `om30` was implemented: `FAST_JOBS` named only `typescript`, so moving 43
    // steps into `gates` dropped them from `bun run cat gates` entirely — 154 gates
    // to 6 — while the runner still printed a confident pass over what was
    // left. A subset of the gate set is not the gate set.
    //
    // It asserted `toEqual(new Set(["typescript", "gates"]))` until the fast
    // set became derived, and that spelling was the SAME drift one layer out:
    // a literal list of jobs, which fails when a job legitimately JOINS. It
    // did — `dependency-advisories` runs a `bun` gate and needs no browser, so
    // it belonged all along and the literal had been excluding it.
    //
    // So the property is asserted instead of the membership: the jobs that
    // carry the bulk are present, the one that installs Chromium is not, and
    // the total is nowhere near the 6 the regression produced. Growth passes,
    // shrinkage fails. The test below holds every job to the rule itself.
    const gates = loadGates(ROOT);
    const jobs = new Set(gates.map((g) => g.job));
    // Bean `dlqu` split `typescript` into `typescript-static` (lint, types)
    // and `typescript-test` (sharded `bun test`) under an aggregate that runs
    // no `bun` line, and moved the browser steps into `e2e-shard` the same
    // way. So the jobs named here are the ones that CARRY commands; naming the
    // aggregates would assert membership of jobs that contribute nothing, and
    // `e2e` would pass the browser exclusion for the wrong reason.
    expect(jobs.has("typescript-static")).toBe(true);
    // `bun test` is the inner loop's bulk, and it stays browser-free since
    // B1's page build moved to its own job (owner, 2026-10-14).
    expect(jobs.has("typescript-test")).toBe(true);
    // `gates` is a roll-up since bean `doxj` and carries no command; its
    // three parts do.
    expect(jobs.has("gates-kg")).toBe(true);
    expect(jobs.has("gates-docs")).toBe(true);
    expect(jobs.has("gates-standalone")).toBe(true);
    expect(jobs.has("gates-unrun")).toBe(true);
    expect(jobs.has("e2e-shard")).toBe(false);
    expect(gates.length).toBeGreaterThan(100);
  });

  test("a job is in the fast set exactly when it installs no browser — asked of the job, never of its name", () => {
    // The membership above names the jobs that carry the bulk; this is the
    // RULE they follow, over every job the workflow has, so a job that gains
    // or loses a browser moves between the sets without an edit here.
    //
    // It moved one on 2026-10-14, and the owner moved the work rather than
    // the job. B1 put a Chromium install in `typescript-test`, because
    // `derive:publish` draws the publish-time BPMN pages its tests read, and
    // that took `bun test` out of the fast set. So the build became its own
    // browser job, `publish-pages`, whose artifact the shards restore ("Move
    // the page build out"). The membership test above names `typescript-test`
    // because the owner chose it to stay; this one says why it can.
    const doc = parse(readFileSync(join(ROOT, GATES_WORKFLOW), "utf-8")) as {
      jobs: Record<string, { steps?: { run?: string }[] }>;
    };
    const browser = new Set(Object.entries(doc.jobs).filter(([, d]) => installsBrowser(d)).map(([j]) => j));
    // Not vacuous: the e2e job is a browser job, so the rule has something
    // on each side of it.
    expect(browser.has("e2e-shard")).toBe(true);
    const fast = new Set(loadGates(ROOT).map((g) => g.job));
    const all = new Set(loadGates(ROOT, { all: true }).map((g) => g.job));
    expect(all.has("typescript-test")).toBe(true);
    for (const job of all) {
      if (!(job in doc.jobs)) continue; // another workflow's step, `<file>/<job>`
      expect({ job, fast: fast.has(job) }).toEqual({ job, fast: !browser.has(job) });
    }
  });

  test("the shared Chromium installer counts as installing a browser", () => {
    const step = (run: string) => ({ steps: [{ run }] });
    expect(installsBrowser(step("npx playwright install --with-deps chromium"))).toBe(true);
    expect(installsBrowser(step("bash ../ci/.github/scripts/playwright-chromium/install.sh node_modules/.bin/playwright"))).toBe(true);
    expect(installsBrowser(step("bun run cat gates"))).toBe(false);
  });
});

describe("the workflow this reads is the one CI runs", () => {
  test("the declared path exists and is a real workflow", () => {
    // If somebody renames the workflow, this fails here rather than the
    // runner silently gating on a file that no longer drives CI.
    const text = readFileSync(join(ROOT, GATES_WORKFLOW), "utf-8");
    expect(text).toContain("name: Code-quality gates");
    expect(text).toMatch(/^\s*pull_request:/m);
  });
});

describe("a strict reader and a loose one agree", () => {
  test("no `bun` line in the workflow is silently dropped", () => {
    // ONE STRICT READER, ONE LOOSE ONE, AND AN ASSERTION THAT THEY AGREE.
    //
    // Carried over from `ci-gates.test.ts`, retired 2026-09-20 in favour of
    // this module. That one read the YAML with a regex whose path branch had
    // the directory written in, so the move (bean `wggr`) made it stop seeing
    // three gates — silently, because a gate a reader cannot see is not a
    // gate it reports as missing. This cross-check is what caught it.
    //
    // The parser here cannot narrow the same way; it walks every job, step
    // and line. The drop it CAN suffer is a gate the workflow invokes in a
    // shape the `^(bun|bunx) ` filter does not match — indented under a
    // conditional, chained after a `cd`, wrapped in a shell function. That is
    // a real possibility and nothing else here would notice it.
    //
    // Deliberately over `--all`: the fast set is a SUBSET by design, so
    // comparing the loose scan against it would fail on every browser job
    // step and say nothing about dropping.
    //
    // Comment lines are stripped first, and that is not a convenience — this
    // workflow documents its own past defects in prose, and one comment
    // quotes a folded line that once ran two commands as one (bean `d2kp`).
    // Counting those would report gates nobody runs, which is a different
    // lie from the one this guards but a lie all the same.
    const yaml = readFileSync(join(ROOT, GATES_WORKFLOW), "utf-8")
      .split("\n")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");
    // BOTH SHAPES. A step's command is either its own line inside a folded
    // `run: |` block, or it follows `run:` on one line — and a first draft of
    // this matched only the former, finding 18 where the workflow runs 37.
    // It passed, because a loose scan that sees half the file cannot disagree
    // with the strict one about the half it never looked at. The floor below
    // is what turned that into a failure instead of a green cross-check.
    const loose = [...yaml.matchAll(/^\s*(?:run:\s*)?(bunx? .+?)\s*$/gm)].map((m) => m[1]!);
    // ACCOUNTED FOR, not merely runnable. `loadGates` is the runner's list and
    // deliberately omits commands carrying a shell variable this reader
    // discarded (bean `9zok`); those are REPORTED instead, so the property
    // this test guards is that every loose-scanned line lands in one of the
    // stated buckets — never in none. Comparing against `loadGates` alone would
    // have made a deliberate, printed omission look identical to the silent
    // drop this test exists to catch, which is the distinction it is for.
    const found = new Set([
      ...loadGates(ROOT, { all: true }).map((g) => g.command),
      ...loadUnresolved(ROOT, { all: true }).map((g) => g.command),
      // The third stated bucket (bean `72a8`): steps the runner performs as a
      // PRECONDITION — once, before the pool — rather than as gates in it.
      ...PRECONDITION_STEPS,
      // The fourth: steps whose script declares `@covers none — writer`,
      // which the runner runs AFTER the gates rather than as gates.
      ...loadWriterSteps(ROOT, { all: true }).map((g) => g.command),
    ]);
    // A PUBLISHER job's lines are dropped on purpose, by `publishes` (bean
    // `16ei`): a job holding `contents: write` is not a gate, and `bun run
    // gates` must never push. They are named here, so the drop is a stated
    // one rather than the silent kind this test exists to catch.
    const published = new Set(
      gatesFrom(readFileSync(join(ROOT, GATES_WORKFLOW), "utf-8"), { all: true })
        .filter((g) => !found.has(g.command))
        .map((g) => g.command),
    );
    // The publish itself, and the step that PRODUCES what it publishes — bean
    // `0utt`: the bootstrap kg-export sidecar is regenerated in that job, and
    // `check:published-instance-exports` (a gate) already runs the same export.
    // And the step that READS BACK what was published (bean `cxcn`):
    // `check:qa-corpus --github` judges the stored entry, which exists only
    // after the publish, so it cannot run in `bun run cat gates`; locally the same
    // check is `check:qa-corpus --dir <tree>` over a `qa:fetch`.
    // And the step that produces the working copy the publish stores (bean
    // `3hk4`): `qa:refresh` RUNS the QA writers when nothing is tracked, so it
    // is a producer, not a judge; its rule is pinned by qa-refresh.test.ts.
    const named = (c: string) =>
      c.includes("qa:publish") ||
      c.includes("qa:refresh") ||
      /kg-export\.ts --instance \.\/bootstrap\b/.test(c) ||
      c === "bun run cat check:qa-corpus --github";
    expect([...published].filter((c) => !named(c))).toEqual([]);
    expect(loose.filter((c) => !found.has(c) && !published.has(c))).toEqual([]);
    // And the guard is not vacuous — a loose scan that matched nothing would
    // pass the filter above while proving nothing at all.
    expect(loose.length).toBeGreaterThan(30);
  });
});

describe("every workflow step is accounted for", () => {
  test("the foreign-step reader finds steps — an empty read is not a clean one", () => {
    // `unclassifiedSteps` filters this list, so a reader that returns nothing
    // reports nothing unclassified: a clean run over a directory it could not
    // read. The property is asserted here rather than inferred from silence.
    expect(otherWorkflowSteps(REPO).length).toBeGreaterThan(20);
  });

  test("no step CI runs is unclassified", () => {
    // THE RATCHET, and the reason the table exists. A new workflow step lands
    // in the gate set or in STEP_EXEMPTIONS with a reason, and never in the
    // gap between them — which is where `gen-site-jsonld --check` sat while
    // `bun run cat gates --all` passed 46 gates on a tree CI then rejected.
    const missing = unclassifiedSteps(REPO).map((u) => `${u.file}: ${u.step.command}`);
    expect(missing).toEqual([]);
  });

  test("every exemption still matches something CI runs", () => {
    // The other direction, and the one that rots silently: a workflow step is
    // deleted or reworded, its exemption stays, and the table slowly becomes
    // a list of claims about a CI that no longer exists. Each entry must earn
    // its place on every run.
    const commands = otherWorkflowSteps(REPO).map((u) => u.step.command);
    const stale = STEP_EXEMPTIONS.filter((e) => !commands.some((c) => c.includes(e.match)));
    expect(stale.map((e) => e.match)).toEqual([]);
  });
});

describe("every check script is accounted for — the direction nothing asked", () => {

  test("no check script is unrun", () => {
    // THE RATCHET for this direction. `unclassifiedSteps` asks "CI runs this
    // — does the local set?", and its domain is steps found IN WORKFLOWS, so
    // it is structurally unable to see a check that appears in no workflow at
    // all. Nine did. `translate-kg-viewer:check` was RED on main while CI was
    // green, because nothing ran it — bean `ot9a`.
    expect(unrunScripts(REPO)).toEqual([]);
  });

  test("the commands read from CI are non-empty — the same vacuity trap", () => {
    // `unrunScripts` reports everything as unrun if this returns nothing, so
    // a broken reader here fails loudly rather than flooding. Asserted so the
    // clean result above cannot come from an unreadable workflow directory.
    expect(commandsCiRuns(REPO).length).toBeGreaterThan(20);
  });

  // Moved from `cat-harness-tools/scripts/tests/sdlc/gates.test.ts`: `SCRIPT_EXEMPTIONS`
  // names scripts that layers ABOVE cat-harness declare (cat-harness-tools,
  // smart-base, smart-trust), so only the whole checkout's script table can
  // answer it — standing alone it read every one of them as stale.
  test("every script exemption still names a script that EXISTS", () => {
    // The direction that rots silently, and the one this bean was made of. A
    // script is renamed or dropped, its exemption stays, and the table
    // becomes a set of claims about a repository that has moved on. The six
    // reasons these replaced lived in a YAML comment, where exactly that had
    // happened: `translate-*:check` was excluded as needing "a translation
    // toolchain not installed on this runner", and both run clean on a bare
    // checkout.
    const names = new Set(checkScriptNames(REPO));
    const stale = SCRIPT_EXEMPTIONS.filter((e) => !names.has(e.script)).map((e) => e.script);
    expect(stale).toEqual([]);
  });
});

describe("a command whose shell variable this reader discarded is NOT a gate", () => {

  test("the real workflow carries exactly one, and it is that one", () => {
    // Pinned deliberately: if a second appears, somebody has written another
    // command this tool silently will not run, and that should be a decision
    // rather than a discovery.
    const real = readFileSync(resolve(ORIGIN_DIR, "../../..", GATES_WORKFLOW), "utf-8");
    // Publishers excluded, as `loadUnresolved` excludes them: the
    // `qa-publish` job's `$GATES_RESULT` line is not a gate at all (bean
    // `16ei`), so it is neither run nor counted as unrunnable here.
    const skipped = unresolvedGatesFrom(real, { all: true, skipPublishers: true });
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.command).toContain("translation:catalogue:check");
  });
});

describe("a declared writer in the gates workflow runs after the gates, never among them", () => {
  test("every line whose script declares `@covers none — writer` is a writer step, not a gate", () => {
    // Over the REAL workflow. `gatesFrom` reads each `bun` line as a gate;
    // the runner holds the declared writers out of that list (and so out of
    // the pool and the tree guard) and runs them last, as CI does. Vacuous
    // where the workflow runs no writer — the fixture in gates.test.ts is what
    // proves the partition; this proves the real set obeys it.
    const lines = gatesFrom(readFileSync(join(ROOT, GATES_WORKFLOW), "utf-8"), { all: true }).map((g) => g.command);
    const writers = new Set(loadWriterSteps(ROOT, { all: true }).map((g) => g.command));
    const gates = new Set(loadGates(ROOT, { all: true }).map((g) => g.command));
    for (const c of lines.filter((c) => isWriterStep(ROOT, c))) {
      expect({ c, writer: writers.has(c), gate: gates.has(c) }).toEqual({ c, writer: true, gate: false });
    }
  });
});
