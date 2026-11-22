#!/usr/bin/env bun
/**
 * Run the gates CI runs — DERIVED from the workflow, never listed here.
 *
 * The question a contributor needs answered before pushing is *"what will CI
 * run against my change"*, and only the workflow knows that. `package.json`
 * over-answers it (many `check:` scripts are gated by no workflow, some
 * deliberately excluded, e.g. `check:ci-health` is a report); a
 * hand-maintained list drifts.
 *
 * ## Fast vs full is DERIVED too
 *
 * From job membership: a job that installs a browser ({@link installsBrowser})
 * is in `--all` only, and every other job is in the fast set. The `e2e` job
 * installs Chromium, which is why `render:bpmn:check` lives there. The rule is
 * the predicate, never a job's name, so it moves jobs when the workflow does.
 *
 * ## The vacuity guard
 *
 * If the extraction finds no commands it **fails**: a runner over an empty
 * list would exit 0 and read as a clean sweep.
 *
 * Usage:
 *   bun run cat gates              # the fast set — every job that installs no browser
 *   bun run cat gates --all        # plus the jobs that need a browser
 *   bun run cat gates --list       # print them and exit, running nothing
 *   bun run cat gates --jobs 3     # pool size for read-only gates (default: CPUs - 1)
 *   bun run cat gates --no-cache   # ask every gate; neither read nor update the input-hash cache
 *   bun run cat gates --except "bun test"   # hold one gate out (repeatable); named in the report as `heldOut`
 *
 * Gates whose script declares `outputs: []` in `task-io.ts` run in a worker
 * pool, output printed in workflow order; every other gate runs alone. A gate
 * whose declared inputs are unchanged since it last passed is SKIPPED and
 * reported as such ({@link GateSkipper}).
 *
 * @module scripts/gates
 */
import { QA_WRITERS } from "./qa-refresh.ts";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

import { checkoutRootFor, readDeclaration, repoRootFor } from "../schemas/kg/cat-harness.js";
import { layerRootsIn } from "../schemas/kg/instance-roots.ts";
import { readIndexConfig } from "../schemas/kg/index-config.ts";
import { parse } from "yaml";

import { distortions } from "./check-environment.ts";
import { movedRoots } from "./qa-verify-moved.ts";
import { workingCopyState } from "./qa-working-copy.ts";

import {
  attributeChanges,
  diffReadings,
  formatMutations,
  formatUndetermined,
  readTree,
  type GateMutation,
  type GateWindow,
} from "./gate-tree-guard.js";
import { jobsFromArgv, orderedEmitter, runCaptured, runPool } from "./task-pool.ts";
import { gateReadsOnly, pairIO } from "./task-io.ts";
import {
  FileDigests,
  againstRefsOf,
  cacheEnabled,
  checkFingerprint,
  decideCheck,
  loadCache,
  qaBaselineIdentity,
  recordCheckRun,
  saveCache,
  type BaselineResolver,
  type Fingerprint,
  type HashCache,
  type PairIO,
  type SkipDecision,
} from "./input-hash.ts";
import { openTrace } from "../schemas/sdlc/input-trace.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";
import { scriptNameOf, scriptsOf } from "../schemas/sdlc/script-table.ts";
import {
  CONTENT_COMPILE_GATES,
  compileGatesForPaths,
  evaluateCompileGates,
  type ContentCompileGate,
  type CompileGateId,
  type GateEvaluation,
  type GateStatus,
} from "./content-compile-gates.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { GATES_REPORT_SCHEMA, GatesReportSchema, type GatesReport } from "../schemas/sdlc/gates-report.ts";
import { GATES_WORKFLOW } from "./lib/gates-workflow.ts";
import { rootGateSet, rootProfile } from "./lib/root-gate-set.ts";

export {
  CONTENT_COMPILE_GATES,
  compileGatesForPaths,
  evaluateCompileGates,
  type ContentCompileGate,
  type CompileGateId,
  type GateEvaluation,
  type GateStatus,
};

/** Compile gates for given paths, reading the declared CONTENT_COMPILE_GATES data map. */
export function contentCompileGates(paths: readonly string[]): ContentCompileGate[] {
  return compileGatesForPaths(paths);
}

// The REPOSITORY root. `GATES_WORKFLOW` is `.github/workflows/…`, which
// belongs to the repository rather than to this layer, and the gates
// themselves are npm scripts run from the repository root. This arrived from
// `main` as `resolve(HARNESS_ROOT)` — correct there, because the
// layer and the repository were one directory; after the move (bean
// `wggr`) it named `cat-harness/.github/`, which does not exist, and
// `loadGates` would have thrown `NoGatesFound` on a workflow that is fine.
const ROOT = repoRootFor(resolve(HARNESS_ROOT));

/** The workflow that defines the FAST set. One place, declared: `lib/gates-workflow.ts`. */
export { GATES_WORKFLOW };

/** The job a content root's gates are reported under: the shared PR checks that run them. */
export const LAYER_PR_CHECKS = "layer-pr-checks.yml";

/** Where every workflow lives. `--all` reads all of them, not just the one. */
export const WORKFLOW_DIR = join(".github", "workflows");

/**
 * Why a step CI runs is not in the local set.
 *
 * ## The gap this closes, and what it cost
 *
 * This module read ONE workflow. Measured 2026-09-20: four others carry `bun`
 * steps CI executes and no local command did. It surfaced the way it had to —
 * `bun run cat gates --all` passed 46 gates on a tree CI then rejected, because
 * the npm script behind one gate was a strict SUBSET of the workflow's four
 * steps. "Green locally" and "green in CI" were two different claims with
 * nothing saying so, which is the `dh4f` shape applied to a checker rather
 * than a directory.
 *
 * ## Two legitimate reasons a step stays out, and one that is not
 *
 * **`covered-by`** — the workflow runs a GENERATOR and the gate set already
 * runs its `--check` twin. Running both locally would regenerate and then
 * verify what was just written, which passes by construction.
 *
 * **`ci-only`** — the step needs something a checkout does not have: a built
 * `_site`, a `gh-pages` working tree, a deploy slug off the event payload.
 *
 * **`no-folio`** — the step's INPUT is a folio's tree, and this repository is
 * the platform. `AGENTS.md` states the fact and names two of them; the table
 * below is the first place a machine can read it.
 *
 * Say it precisely, because the imprecise version was wrong here for two
 * months and three entries still carried it on 2026-09-20: **the scripts are
 * the platform's** — `cat-harness-tools/scripts/audit-wiring.ts` and friends are
 * right here. Two entries said "no such path in the platform", which was
 * false, and a third said the platform "has no `pipeline/`", which was also
 * false. An exemption resting on a false reason is precisely what this table
 * exists to prevent, so the error mattered more here than it would have in
 * prose (bean `52dz`).
 *
 * **And the corrected version was still wrong, one turn later.** It said what
 * these steps lack is "the `content/` tree they read" — owner, 2026-09-20:
 * *"content/ shouldnt be expected anymore. folio/ was renamed as
 * default/convention."* So `no-folio` here does not mean "a folio tree we
 * happen not to carry". It means these steps `cd` into `content/`, a root the
 * convention has moved off. `cat-harness/harness.json` already declares
 * `folio/` holding the `folio` graph and carries no `content` entry at all.
 *
 * Two corrections to one paragraph in one day is the argument for the table
 * rather than against it: prose drifts silently, an entry here is read by
 * `check:workflow-paths` and by `gates.test.ts`.
 *
 * The one case where the distinction has teeth: `pipeline/build.ts` runs after
 * `cd content` and names a FOLIO's build, while `cat-harness/content/pipeline/
 * build.ts` exists and is a different file with the same basename. "Fixing"
 * the path to the platform's copy would look correct and silently run the
 * wrong program. `check:workflow-paths` records that as a `FOLIO_PATHS`
 * exemption with the same reason, and a test pins it.
 *
 * `52dz`'s owner ruling (2026-09-24) settled the rest: the generic QA
 * workflows and the Lean workflows that `cd content` were moved OUT of
 * `.github/workflows/` into the platform's `templates/`, which `folio_init`
 * writes into a new folio pointed at `folio/`. Their entries left this table
 * with them — an exemption for a step no workflow here runs is the stale
 * claim `gates.test.ts` refuses.
 *
 * These steps are not broken and not runnable here, and until this table
 * existed nothing could tell either from a real gap.
 *
 * **Not a reason: "it is slow" or "it usually passes."** A step with no entry
 * here is reported as UNCLASSIFIED and fails `gates.test.ts`, so a new
 * workflow step lands in the gate set or in this table, and never in the gap
 * between them. The reason is required for the same cause `folio:no-skill`
 * and `workflow-policy.json` require one: an exemption nobody can review is
 * one somebody added to get to green.
 */
/**
 * Every present layer's declared `gateExemptions`. Read from the CHECKOUT
 * (`checkoutRootFor`), not `ROOT`: `repoRootFor` climbs out of a standalone
 * checkout whose root IS cat-harness (bean `g43f`).
 */
function declaredExemptions(root: string = checkoutRootFor(resolve(HARNESS_ROOT))): { steps: StepExemption[]; scripts: ScriptExemption[] } {
  const steps: StepExemption[] = [];
  const scripts: ScriptExemption[] = [];
  for (const instance of layerRootsIn(root)) {
    const g = readDeclaration(instance)?.gateExemptions;
    steps.push(...(g?.steps ?? []));
    scripts.push(...(g?.scripts ?? []));
  }
  // And the INDEX's, for the steps of its own workflows: the index owns
  // `.github/workflows/`, so it declares their exemptions in the same change
  // as the step (cat-harness `GateExemptionsSchema`, `index.config.json`).
  // Declared from a layer instead, an exemption landed ahead of its step and
  // matched nothing CI ran on the next re-pin (`qa:publish --add`). An index
  // that does not parse is a fault, never "no exemptions".
  const index = readIndexConfig(root);
  if (index.state === "unreadable") throw new Error(`gates: ${index.file} is unreadable (${index.why}), so its gate exemptions cannot be read`);
  if (index.state === "ok") {
    const g = (index.config as { gateExemptions?: { steps?: StepExemption[]; scripts?: ScriptExemption[] } }).gateExemptions;
    steps.push(...(g?.steps ?? []));
    scripts.push(...(g?.scripts ?? []));
  }
  return { steps, scripts };
}

export interface StepExemption {
  /** Matched against the command as a substring — a script path, usually. */
  match: string;
  kind: "covered-by" | "ci-only" | "no-folio";
  reason: string;
}

/**
 * Workflow steps this runner performs as a PRECONDITION rather than as gates.
 * `qa:working-copy` (bean `72a8`) computes the QA tree every reading gate
 * judges; CI runs it as a step before them, and `main` runs it first when the
 * copy is absent. As a gate it would run in the pool beside the gates that
 * read its output — a race — and a second time on every run.
 */
export const PRECONDITION_STEPS: readonly string[] = ["bun run cat qa:working-copy"];

/**
 * The setup steps a local run performs ONCE (owner, 2026-11-06, bean
 * `cat-tools-sm8r` item 2: "a local gates run does each setup command once").
 *
 * CI runs the gates as jobs, each from a fresh checkout, so every job repeats
 * its setup: the workflow names `state:mount` eight times, `ig-index:build`
 * three, `bun install` nine. Here every job runs in ONE checkout, so a repeat
 * sets up nothing new, and it reads what the steps between wrote: each later
 * `state:mount` found the mounts those steps had written into, fetched every
 * remote, and exited 1 (305 s of a 1396 s run, all eight red).
 *
 * Listed, not inferred from "a serial command that repeats": a repeated
 * CHECK may judge what a step in between wrote, and answers for itself.
 * A repeat is reported SKIPPED with the first run's exit; the first run's
 * failure, if any, is the one counted.
 */
export const RUN_ONCE_SETUP_STEPS: readonly string[] = [
  "bun install --frozen-lockfile",
  "bun run cat state:mount",
  "bun run cat ig-index:build",
  "bun run cat smart:pages",
  "bun run smart:pages",
];

/** Which run-once setup steps have run in this local run, and how they exited. */
export class SetupOnce {
  private readonly ran = new Map<string, number>();
  constructor(private readonly steps: readonly string[] = RUN_ONCE_SETUP_STEPS) {}
  /** The first run's exit when `command` is a run-once step that has already run, else undefined (run it). */
  ranAlready(command: string): number | undefined {
    return this.ran.get(command);
  }
  /** Record a run; only a listed setup step is remembered. */
  record(command: string, code: number): void {
    if (this.steps.includes(command) && !this.ran.has(command)) this.ran.set(command, code);
  }
}

/**
 * A WRITER's mark: `@covers none — writer — …` as a use in its script's
 * module docblock (` * @covers`, exactly one space either side of the star —
 * `coversIn`'s rule in audit-coverage.ts, so a mention in prose is not a use).
 * The first token after `none` is the role; the reason follows the next dash.
 */
export const WRITER_MARK = /^ \* @covers none\s+[—–-]{1,2}\s+writer\b/m;

/** Whether a script's text declares it a writer — see {@link WRITER_MARK}. */
export function declaresWriter(text: string): boolean {
  return WRITER_MARK.test(text);
}

/**
 * Whether a workflow line runs a script that DECLARES itself a writer.
 *
 * Steps a workflow runs to REWRITE something rather than to judge it — the
 * whole-repository projections' writers, run as plain lines so a writer that
 * cannot write is red (`@covers none`, since a writer judges nothing). In the
 * local runner such a line in the gate list is wrong twice: it rewrites what
 * the gates around it read, and the tree guard (bean `ymsu`) then reports the
 * run NOT clean for a write that was the step's whole purpose. So they are
 * held out of the gate list like {@link PRECONDITION_STEPS}, and run as a
 * separate phase (see `main`).
 *
 * DATA, not a list of names: the mark is read from the script the line runs
 * (the line's own `.ts` path, or the `.ts` paths its script-table entry
 * names — one hop, as `bun run cat <name>` resolves it), so a writer added to
 * a workflow is sequenced by declaring itself, and nothing here names the
 * layer that declares it.
 */
export function isWriterStep(root: string, command: string, scripts: Record<string, string> = scriptsOf(root)): boolean {
  const name = scriptNameOf(command);
  const expanded = name !== undefined ? scripts[name] : undefined;
  const text = expanded === undefined ? command : `${command} ${expanded}`;
  for (const m of text.matchAll(/[\w./@-]+\.ts\b/g)) {
    const file = join(root, m[0].replace(/^\.\//, ""));
    if (!existsSync(file)) continue;
    try {
      if (declaresWriter(readFileSync(file, "utf-8"))) return true;
    } catch {
      // unreadable: not shown to be a writer, so it stays a gate
    }
  }
  return false;
}

const OWN_STEP_EXEMPTIONS: StepExemption[] = [
  // The `nn8e` remote-mount replay used to be exempted here, matched on
  // `/cat-harness/scripts/mount-from-lock.ts`. Since the cat-harness cutover
  // the workflows reach it as `bash .github/mount-from-lock.sh` (cat-harness is
  // itself a mount, so the wrapper fetches the pinned replayer); that is not a
  // `bun` line, which is all this reader extracts, so no exemption is needed
  // and the old one exempted nothing — the stale-exemption test's finding.
  {
    // Bean `hupw`: the IG layers are remote mounts of their forks, which
    // do not commit the pages this checkout generates for them, so the
    // publish builds write them. (In the monorepo since before the
    // separation; this repository was seeded without it.)
    match: "bun run smart:pages:publish",
    kind: "covered-by",
    reason:
      "a BUILD step, not a check: it writes the mounted IG instances' docs/ and OpenAPI pages at publish; the gate " +
      "`smart:pages` (code-quality-gates) runs the same docs generator over the mounts",
  },
  {
    // Bean `9c7h`: fsh-guts is kept on `cat/cat-harness/fsh-guts`, so every
    // job that reads the repository mounts it after `bun install`. A SETUP
    // step: it fetches over the network and has no verdict of its own; the
    // readers it serves refuse an unmounted copy (exit 2), and the mount
    // logic is asserted by state-mount.test.ts and branch-mount.test.ts.
    match: "bun run cat state:mount",
    kind: "ci-only",
    reason:
      "a SETUP step, not a check: it mounts the subgraphs kept on branches (fsh-guts) so the gates that follow " +
      "read real content; a contributor's session-start hook runs the same command",
  },
  {
    // Bean `0b8c` (#2230). The site builds run every writer of an artefact
    // derived from a branch-kept graph (today the fsh-guts viewer), after
    // `state:mount`. Nothing it writes is committed. Its verdicts run in the
    // fast set: `check:derived-from` decides WHICH artefacts are publish-time
    // and refuses a committed one, and `fsh-guts:viz:check` runs the writer
    // over the mount.
    match: "bun run cat derive:publish",
    kind: "covered-by",
    reason:
      "a BUILD step, not a check: it writes the derived artefacts that cannot be committed because an input is " +
      "kept on a branch; check:derived-from and each writer's own :check (fsh-guts:viz:check) are its verdict",
  },
  {
    // Bean `q8ar`. The deploy-time BUILD of each SQLite slice (beans, todos,
    // library, kg; one line per slice) and its payloads, written straight into
    // `./_site`. None is committed, because their sources move on most merges.
    // The fast set runs their verdict as `slice:sqlite:check` (determinism,
    // the row digest against the source, FTS5, the payload audit, for every
    // slice), so these lines only write.
    match: "gen-slice-sqlite.ts --out ./_site",
    kind: "covered-by",
    reason:
      "a DEPLOY build into ./_site, which only the deploy and staging jobs produce; its verdict is " +
      "`slice:sqlite:check` in the fast set, and gen-slice-sqlite.test.ts plus slice-sqlite.e2e.ts pin it",
  },
  {
    // Bean `4ak5` item 3. The root index is BUILT at publish time over the
    // exports the deploy has just written into `./_site`, and never committed
    // (owner, 2026-10-04), so there is no committed artefact for a `--check`
    // to compare. It refuses to write when any declared layer has no
    // export, which is its verdict, and root-index.test.ts pins that over a
    // real site layout.
    match: "scripts/root-index.ts --site ./_site",
    kind: "covered-by",
    reason:
      "a DEPLOY build into ./_site over the exports only the deploy writes, with no committed copy to check; " +
      "it exits 1 rather than publish a shorter map, and root-index.test.ts pins both the map and that refusal",
  },
  {
    // Bean `oi1y`. Rails the pages Jekyll copies through verbatim — wireframe
    // `as-is.html` and bootstrap's `.md`-rendered siblings — which inherit no
    // layout and so no sidebar.
    //
    // `ci-only` for the same reason as `mount-instance-docs`: it WRITES INTO a
    // built `./_site`, which only the deploy and staging jobs produce, so there
    // is nothing for it to operate on in the fast set. Its logic is pinned by
    // `standalone-rail.test.ts` in `bun test`, over a fixture site carrying one
    // page per case, and `bun run cat preview:site` builds a site to run it on.
    //
    // Its ORDERING is the part no unit test can hold: it must run after every
    // generator that writes a page, and a version that ran 142 lines earlier
    // missed ten pages silently. That is asserted by
    // `check:invocation-parity`, which requires both workflows to run it.
    match: "rail-standalone-pages",
    kind: "ci-only",
    reason:
      "writes into the built ./_site that only the deploy and staging jobs produce; its logic is " +
      "pinned by standalone-rail.test.ts in `bun test`, and its ordering by check:invocation-parity",
  },
  {
    // The unattended PR sweep and its `gh` plumbing. `ci-only` rather than a
    // gate, for the same reason the script itself is exempt: a CI job asking
    // whether a commit has a CI run has already answered it. Bean `3pqn`.
    match: "check:prs-have-runs",
    kind: "ci-only",
    reason:
      "circular as a gate, and it needs `issues: write` and `pull-requests: write`, which the gate jobs deliberately do not have",
  },
  {
    // Bean `16ei`. The scheduled retention job for the `qa-reports` branch.
    // It WRITES a branch rather than judging a tree, needs `contents: write`
    // and `pull-requests: read`, and a contributor has no verdict to get from
    // it. Its rule is pinned by `qa-store.test.ts` in `bun test`, on real
    // repositories.
    match: "qa:prune",
    kind: "ci-only",
    reason:
      "a scheduled WRITE to the qa-reports branch, not a check; its retention rule and its " +
      "tip-only rewrite are covered by qa-store.test.ts in `bun test`",
  },
  {
    // Bean `tfqf`. The site builds' QA evidence: `fetch` reads the
    // `qa-reports` entry for THIS run's ref (`main/<sha>`, `pr/<n>/<sha>`)
    // over the network and may materialise it into the checkout; `verify`
    // judges the built `./_site/assets/qa/`, which only the deploy and
    // staging jobs produce. Run locally with no ref and no site it has no
    // verdict to give. Its decisions are pinned by qa-site-assets.test.ts in
    // `bun test`, and `bun run cat preview:site` runs both halves on a real build.
    match: "scripts/qa-site-assets.ts",
    kind: "ci-only",
    reason:
      "a build step keyed by the run's own ref (network fetch) and the built ./_site; its source " +
      "decision and shrink judgement are covered by qa-site-assets.test.ts in `bun test`",
  },
  {
    // Bean `bejf`, #2217. The built-site half of `check:qa-result-links` reads
    // `./_site`, which only the site build produces; the sources half runs as
    // its own step in `gates-docs`, and is therefore in the gate set.
    match: "check:qa-result-links --site",
    kind: "ci-only",
    reason:
      "judges the built ./_site that only the docs build produces; the sources half is a gate step " +
      "in gates-docs, and the rule itself is covered by check-qa-result-links.test.ts in `bun test`",
  },
  {
    // Bean `tfqf`. `folio-staging.yml` reads the FOLIO's own `qa-reports`
    // entry for its PR before sweeping. A read keyed by a downstream PR
    // number; the read path is pinned by qa-store.test.ts in `bun test`.
    match: "qa-store.ts\" fetch",
    kind: "ci-only",
    reason:
      "a network read of a downstream folio's qa-reports entry keyed by its PR number; the read " +
      "path is covered by qa-store.test.ts in `bun test`",
  },
  {
    // Bean `uknu`. It reads a BUILT Jekyll site, which only the staging job
    // produces (`actions/jekyll-build-pages`), so it cannot join the fast set.
    // Its logic is pinned by `duplicate-ids.test.ts`, which IS in `bun test`,
    // and `bun run cat preview:site` builds a site to run it on locally.
    match: "check:duplicate-ids",
    kind: "ci-only",
    reason:
      "runs on the built ./_site that only the staging job produces; its scanner and the " +
      "nav include's one-checkbox rule are pinned by duplicate-ids.test.ts in `bun test`",
  },
  {
    // Mounts each layer's rendered content into the built site. It COPIES
    // rather than checks, so there is no verdict for a contributor to run —
    // and it is meaningless outside a job that has just built `_site/`.
    //
    // Its refusals are not exempt: the collision rule (two layers claiming
    // one path) is asserted by `mount-instance-docs.test.ts` in `bun test`,
    // which IS in the gate set, and the staleness of what it mounts is gated
    // by `iris:pages:check`.
    match: "mount-instance-docs.ts",
    kind: "ci-only",
    reason:
      "a DEPLOY step, not a check: it copies rendered output into ./_site, which only exists " +
      "inside the site-build job. Its path-collision refusal is covered by " +
      "mount-instance-docs.test.ts in `bun test`",
  },
  {
    // The inline PDF viewer (bean `folio-assistant-5ea6`). A DEPLOY step like
    // the mount above it: it downloads the pinned pdf.js release and writes it
    // into `./_site`, which only the deploy and staging jobs produce, and it
    // needs the network the fast set must not. The allowlist shim, the root
    // derivation and the install helpers are run as shipped bytes by
    // `pdf-viewer.test.ts` in `bun test`.
    match: "pdf-viewer.ts --site",
    kind: "ci-only",
    reason:
      "a DEPLOY step, not a check: it installs the pinned, hash-checked pdf.js viewer into ./_site, " +
      "which only exists inside the site-build job, and it fetches the release over the network. " +
      "Its shim, embed and install helpers are covered by pdf-viewer.test.ts in `bun test`",
  },
  {
    // The knowledge-graph viewer's deploy step (o7eq). It writes the viewer at
    // its declared route and a forwarding page at its old address into the
    // BUILT `./_site` (`--site`), or one page (`--out`). Matched by script
    // rather than by flag so the exemption holds across the switch from one
    // spelling to the other. Its page and route are covered by
    // `kg-viewer-route.test.ts` in `bun test` and by the `kg-viewer` e2e specs.
    match: "scripts/kg-viewer.ts",
    kind: "ci-only",
    reason:
      "a DEPLOY step, not a check: it writes the KG viewer page(s) into ./_site, which only exists " +
      "inside the site-build job. Its route and page are covered by kg-viewer-route.test.ts",
  },
  {
    // Its sibling, and exempt for the same reason. `compose-docs.ts` lays the
    // declared `docs` layers into one tree for Jekyll to build — base
    // (`cat-harness/docs/`) then the repository root's overlay. It COPIES
    // rather than checks, and its output is meaningless outside the job that
    // then runs Jekyll over it.
    //
    // Its guarantees are NOT exempt, and that distinction is the whole reason
    // an exemption here is safe: `compose-docs.test.ts` is in `bun test`, and
    // it asserts on the REAL tree that an empty overlay composes
    // byte-identically, that an override is both applied and REPORTED with
    // both layer ids, and that a declared layer with no directory is a finding
    // rather than a silent empty. Those are what make changing the live
    // publish path's `source:` sound; this exemption only says the copy itself
    // is not something a contributor runs for a verdict.
    match: "compose-docs.ts",
    kind: "ci-only",
    reason:
      "a BUILD step, not a check: it composes the declared docs layers into ./_docs for Jekyll, " +
      "which only means anything inside the site-build job. Its byte-identity, override-reporting " +
      "and missing-layer guarantees are covered by compose-docs.test.ts in `bun test`",
  },
  {
    match: "bun install",
    kind: "ci-only",
    reason: "installing dependencies is not a check; every workflow opens with it",
  },
  {
    // One entry, four call sites — `stage`, both `cleanup` paths and
    // `cleanup-dispatch` — because `match` is a substring and the script is
    // the same in all of them, reached by three different relative paths.
    match: "scripts/render-log.ts",
    kind: "ci-only",
    reason:
      "APPENDS to the render log in a `gh-pages` working tree, using a slug off the event " +
      "payload — it writes what happened rather than checking anything, and there is nothing " +
      "for a contributor to run locally. Its refusals (a reasonless removal, an unsafe path) " +
      "are covered by `render-log.test.ts` in `bun test`, and the WIRING by " +
      "`workflow-yaml.test.ts`, both of which are in the gate set",
  },
  {
    match: "check:maintained-artefacts",
    kind: "ci-only",
    reason:
      // input-site: inert #6c47660d — prose naming the directory, in a message or a description
      "reads the ASSEMBLED `_site/`, which exists only after the site build has run — the " +
      "whole point of the check is that a `maintains` claim is verified against what actually " +
      "shipped, not against the source it was generated from, so there is nothing for a " +
      "contributor to run locally and no `--check` twin to gate. Its three-state behaviour " +
      "(exit 2 for could-not-determine, never folded into a pass) is covered by " +
      "`check-maintained-artefacts.test.ts` in `bun test`, which is in the gate set",
  },
  {
    match: "check:escaped-markup",
    kind: "ci-only",
    reason:
      // input-site: inert #b4721469 — prose naming the directory, in a message or a description
      "reads the ASSEMBLED `_site/` for the same reason, and the reason is sharper here: what " +
      "it looks for exists ONLY after the markdown conversion. The template that shipped the " +
      "defect was valid HTML — a Liquid whitespace strip welded two attributes together, " +
      "Kramdown refused the block and escaped it, and the landing page published " +
      "`&lt;article class=\"fa-sticky …\"` as visible text. Nothing readable from a checkout " +
      "could have seen that, which is why every source-level gate passed over it. Its three " +
      "states and the `<code>`/`<pre>` exclusion that keeps it off legitimate documentation " +
      "are covered by `check-escaped-markup.test.ts` in `bun test`, which is in the gate set",
  },
  // ── Generators whose `--check` twin is gated ────────────────────────
  {
    match: "scripts/gen-schema-docs.ts",
    kind: "covered-by",
    reason: "`gen-schema-docs.ts --check` is in the gate set; the site build runs the writer",
  },
  {
    match: "scripts/gen-skill-docs.ts",
    kind: "covered-by",
    reason: "`gen-skill-docs.ts --check` is in the gate set; the site build runs the writer",
  },
  {
    match: "scripts/gen-docs-pages.ts",
    kind: "covered-by",
    reason: "`gen-docs-pages.ts --check` is in the gate set; the site build runs the writer",
  },
  {
    // Bean `5hox` prep, owner ruling 2026-10-01: the /qa/ page is regenerated
    // from the QA results the site build fetched, so it cannot freeze once QA
    // leaves `main`.
    match: "bun run cat state:visualizer",
    kind: "covered-by",
    reason: "`state:visualizer:check` is in the gate set; the site build runs the writer over the results it fetched",
  },
  // The two projection writers are run by the SITE BUILD and by nothing else.
  //
  // Their `--check` twins are deliberately not in the gate set (owner,
  // 2026-09-20): both projections derive from the whole repository, so the
  // check reddens when somebody else merges rather than when the author
  // forgets — which is not an omission, and not what a gate is for. Saying
  // "covered-by" here would have been false the moment the gate came out.
  {
    match: "run cat schema:viz",
    kind: "covered-by",
    reason:
      "the site build runs the writer at deploy, so nothing PUBLISHED goes stale; " +
      "`schema:viz:check` is intentionally not gated — see code-quality-gates.yml",
  },
  {
    match: "run cat library:viz",
    kind: "covered-by",
    reason:
      "the site build runs the writer at deploy, so nothing PUBLISHED goes stale; " +
      "`library:viz:check` is intentionally not gated — see code-quality-gates.yml",
  },
  {
    match: "run cat uploads:viz",
    kind: "covered-by",
    reason:
      "the site build runs the writer at deploy, so nothing PUBLISHED goes stale; " +
      "`uploads:viz:check` is intentionally not gated, for `library:viz:check`'s reason — " +
      "it renders that same projection (bean `flh4`: one dataset, two viewers)",
  },
  {
    // The WRITER's step in the site build. Its `--check` IS gated — see the
    // reason beside it in code-quality-gates.yml — so this is the ordinary
    // writer-runs-at-deploy case rather than the schema/library exception.
    match: "run cat voices:viz",
    kind: "covered-by",
    reason: "`voices:viz:check` is in the gate set; the site build runs the writer at deploy",
  },
  {
    match: "run cat handler:index",
    kind: "covered-by",
    reason: "`handler:index:check` is in the gate set; the site build runs the writer at deploy",
  },
  {
    match: "run cat translation:index",
    kind: "covered-by",
    reason: "`translation:index:check` is in the gate set; the site build runs the writer",
  },
  {
    match: "gen-jsonld-context.ts --check",
    kind: "covered-by",
    reason: "run by `gen:jsonld:check`, which is in the gate set",
  },
  {
    match: "gen-block-jsonld.ts --check",
    kind: "covered-by",
    reason: "run by `gen:jsonld:check`, which is in the gate set",
  },
  {
    match: "gen-library-jsonld.ts --check",
    kind: "covered-by",
    reason: "run by `gen:jsonld:check`, which is in the gate set",
  },
  {
    // THE ONE THAT WAS MISSING, and the reason this table exists. It was not
    // in `gen:jsonld:check` at all until 2026-09-20 — three of the
    // workflow's four, with nothing comparing the lists.
    match: "gen-site-jsonld.ts --check",
    kind: "covered-by",
    reason: "run by `gen:jsonld:check`, which is in the gate set — added there the day this table was written",
  },
  // ── Runs against a FOLIO's tree, which the platform does not have ──
  //
  // `AGENTS.md`: "qa-sweep and witness-refresh fail by design in this repo:
  // the first preflights on `content/package.json`, the second needs
  // `computations/`, and the platform carries no folio." That was true of two
  // workflows and prose; it is true of these and now declared.
  //
  // WORTH SAYING PLAINLY: several of these were authored for `litlfred/qou`
  // and lived here. Bean `52dz` decided where they go (owner, 2026-09-24):
  // `qa-sweep.yml`, `qa-sweep-nightly.yml`, `section-title-audit.yml` and the
  // four Lean workflows are now templates `folio_init` writes, so the
  // `qa-staleness` and `qa-section-title-audit.ts` entries went with them.
  // `pipeline/build.ts`, `check-witnesses`, `render-atlas` and
  // `latex-overfull-report.ts` went with `publish.yml` and `witness-refresh.yml`
  // when folio-assistant#3066 (2026-11-10) moved those to qou or dropped them.
  // What remains below still matches a workflow in `.github/workflows/`.
  {
    // Since `52dz` the only match is the reusable `folio-staging.yml`, which
    // runs inside a FOLIO's staging job and sweeps that folio's `folio_dir`.
    match: "qa-sweep",
    kind: "no-folio",
    reason:
      "runs inside a FOLIO's staging job (`folio-staging.yml`, a reusable " +
      "workflow) over that folio's blocks; the platform carries no folio. " +
      "The standalone qa-sweep workflows are folio_init templates (bean `52dz`)",
  },
  // ── Needs something a checkout does not have ────────────────────────
  {
    match: "site-links.ts",
    kind: "ci-only",
    reason: "takes `--site ./_site`: it resolves links in the BUILT site, which Jekyll produces in CI",
  },
  {
    match: "harness:state --out ./_site",
    kind: "ci-only",
    reason:
      "writes one state file per harness into the BUILT site (bean `supn`); it judges nothing, and " +
      "`harness:state --json` prints the same answer in a checkout",
  },
  {
    match: "site-dead-links.ts",
    kind: "ci-only",
    reason:
      "takes `--site ./_site`: it finds and repoints dead links in the BUILT site (folio-assistant#2741), " +
      "which Jekyll produces in CI; its logic is covered in a checkout by site-dead-links.test.ts",
  },
  {
    match: "publish-verify.ts",
    kind: "ci-only",
    reason:
      "takes `--dir ./_site`: it verifies the BUILT site before a deploy (bean `vigi`); its " +
      "logic is covered in a checkout by publish-verify.test.ts, which builds the documents in memory",
  },
  {
    match: "search-split.ts",
    kind: "ci-only",
    reason:
      "takes `--dir ./_site`: it cuts the BUILT (or, on a preview, borrowed) search index into per-scope " +
      // input-site: inert #6918934e — prose naming the directory, in a message or a description
      "indices (bean `m7mn`); there is no `_site` in a checkout. Its scope rule, partition and determinism " +
      "are covered by search-split.test.ts, and its output on every deployed tree by publish-verify's " +
      "`search-scopes` verifier",
  },
  {
    match: "publish-id-lookup.ts",
    kind: "ci-only",
    reason:
      "takes `--site ./_site`: it copies the identifier-lookup client and each declared index into the BUILT " +
      // input-site: inert #cd9d2ebf — prose naming the directory, in a message or a description
      "site (bean `1br0`); there is no `_site` in a checkout. Covered by publish-id-lookup.test.ts, and on " +
      "every deployed tree by publish-verify's `search-scopes`, which fails a linked lookup the tree lacks",
  },
  {
    match: "strip-preview-seo.ts",
    kind: "ci-only",
    // input-site: inert #f9c95b4f — prose naming the directory, in a message or a description
    reason: "rewrites the built `_site` before a preview deploy; there is no `_site` in a checkout",
  },
  {
    // Its last-in-the-pipeline sibling: drops the comments and the unrendered
    // inter-tag whitespace from every emitted page. `ci-only` for the same
    // reason — it takes `--site ./_site` — and for one more that is specific
    // to it: the saving it reports is a fact about the BUILT tree, so a gate
    // run in a checkout would have nothing to measure and would print 0.
    //
    // There IS a `--check` mode, and it is deliberately not gated: it reports
    // what a build would save rather than passing or failing, so it is a
    // measurement, not a verdict. The verdicts are elsewhere —
    // `minify-site.test.ts` holds the equivalence rules (verbatim regions
    // untouched, word boundaries kept, the three comment classes that stay)
    // and idempotency, and `bun run cat preview:site` builds a tree to run it on.
    match: "minify-site.ts",
    kind: "ci-only",
    reason:
      "takes `--site ./_site`: it minifies the BUILT tree as the last pass before a publish, and " +
      // input-site: inert #50e65645 — prose naming the directory, in a message or a description
      "there is no `_site` in a checkout. Its equivalence rules and its idempotency are covered " +
      "by minify-site.test.ts in `bun test`, and its ORDERING — after every check and rewrite " +
      "that reads the built HTML, two of which decide whether a marker is inside a COMMENT " +
      "(bean `ur84`) — by check:invocation-parity requiring both workflows to run it",
  },
  {
    match: "set-html-lang.ts",
    kind: "ci-only",
    reason:
      "takes `--site ./_site`: it rewrites the BUILT site's `<html>` tags before a deploy (bean " +
      // input-site: inert #a37730dc — prose naming the directory, in a message or a description
      "`zru7`); there is no `_site` in a checkout, and its logic is covered here by " +
      "set-html-lang.test.ts, which builds pages as strings",
  },
  {
    // Four call sites, one entry — `match` is a substring and the script is
    // the same in every retry loop in `feature-staging.yml`.
    match: "backoff-sleep.ts",
    kind: "ci-only",
    reason:
      "it SLEEPS. Running it as a gate would add a jittered wait of up to 24s to every " +
      "`bun run cat gates`, to observe a number `retry.test.ts` already covers at the source — " +
      "`waitFor` is the only arithmetic here and this script does not repeat it (bean `06kg`). " +
      "That it is reached from every retry loop, rather than each loop computing its own wait, " +
      "is covered by the index repository's `test/workflows/retry-backoff-in-workflows.test.ts` in its `bun test`, which is a gate",
  },
  {
    // The ChangeSet step of `folio-staging.yml`, the reusable workflow folios
    // call (bean `ojcx`). It computes over a folio's `folio` graph against
    // its base, and this repository holds no folio, so there is nothing for
    // a gate here to run it on. Its logic is not exempt: every change kind
    // is asserted by the content core's `schemas/changeset.test.ts` in
    // `bun test`, which IS in the gate set.
    match: "changeset.ts",
    kind: "no-folio",
    reason:
      "runs inside a FOLIO's staging job over that folio's graph; the platform carries no folio. " +
      "Covered by changeset.test.ts in `bun test`",
  },
  {
    // The rendered-impact step that follows it (bean `bnjs`): it reads the
    // ChangeSet and the outline a FOLIO's site build just wrote, so it has
    // the same reason to run nowhere here. Its logic is not exempt:
    // `document-rendered-impact.test.ts` is in `bun test`.
    match: "document-rendered-impact.ts",
    kind: "no-folio",
    reason:
      "runs inside a FOLIO's staging job over that folio's ChangeSet and outline; the platform carries no folio. " +
      "Covered by document-rendered-impact.test.ts in `bun test`",
  },
  {
    // The measurement after it (bean `bnjs`): it diffs a FOLIO's staging build
    // against that folio's published main site, and this repository builds
    // neither. Its logic is not exempt: `measure-rendered-impact.test.ts` is in
    // `bun test`.
    match: "measure-rendered-impact.ts",
    kind: "no-folio",
    reason:
      "diffs a FOLIO's staging build against that folio's published main site; the platform carries no folio. " +
      "Covered by measure-rendered-impact.test.ts in `bun test`",
  },
  {
    // Same reason as the ChangeSet above (bean `423d`): the review-comments
    // Tool ingests a FOLIO's pull-request comments against that folio's
    // blocks, in the folio's staging job and in its comment-triggered
    // refresh. The platform has no folio and no such pull request to run it
    // on here. Its logic is not exempt: `review-comments.test.ts` (the Tool,
    // including the command run offline exactly as both jobs call it) and
    // `review-comment.test.ts` (the kind) are in `bun test`.
    match: "review-comments.ts",
    kind: "no-folio",
    reason:
      "runs inside a FOLIO's staging and comment-refresh jobs over that folio's PR and blocks; the platform carries no folio. " +
      "Covered by review-comments.test.ts and review-comment.test.ts in `bun test`",
  },
  {
    // The same reason again (bean `qbfi`): the block QA summary reads a
    // FOLIO's committed verdicts, in that folio's staging job. The platform
    // has no folio. Its logic is covered by `publish-block-qa.test.ts` and
    // the heat map's unit and Playwright tests, in the gate set.
    match: "publish-block-qa.ts",
    kind: "no-folio",
    reason:
      "runs inside a FOLIO's staging job over that folio's committed QA verdicts; the platform carries no folio. " +
      "Covered by publish-block-qa.test.ts and the review heat map tests in `bun test` and the e2e job",
  },
  {
    // The same reason (bean `0rxe`): the visual diff pictures a FOLIO's
    // changed figures on that folio's published main site and staging build.
    // The platform has no folio. The pixel compare is unit-tested, and the
    // whole Tool runs in Chromium in `block-screenshots.e2e.ts`.
    match: "block-screenshots.ts",
    kind: "no-folio",
    reason:
      "runs inside a FOLIO's staging job over that folio's published site and staging build; the platform carries no folio. " +
      "Covered by block-screenshots.test.ts in `bun test` and block-screenshots.e2e.ts in the e2e job",
  },
  {
    // Bean `5uuf`: publishes a FOLIO's main site at its publish branch's root,
    // the before side of every preview. The platform has no folio, and no
    // publish branch checked out in a gate run.
    match: "publish-main-site.ts",
    kind: "no-folio",
    reason:
      "runs inside a FOLIO's publish-main job over that folio's built site and its publish branch; the platform carries no folio. " +
      "Covered by publish-main-site.test.ts in `bun test`: the manifest, the reserved paths, and the refusals",
  },
  {
    match: "staging-banner.ts",
    kind: "ci-only",
    reason:
      // input-site: inert #87064adb — prose naming the directory, in a message or a description
      "injects the banner into the built `_site` and writes `staging.json` beside it; there is " +
      // input-site: inert #1cd18d35 — prose naming the directory, in a message or a description
      "no `_site` in a checkout, and the facts it writes (run id, event payload, publish-ref " +
      "listing) exist only in CI. The property it exists for — that the injected bytes do NOT " +
      "depend on the build, which is what lets git deduplicate a preview against its own next " +
      "rebuild (bean `g196`) — is covered by `staging-banner-constant.test.ts` in `bun test`, " +
      "and the client half it ships by `staging-banner.e2e.ts` in the e2e set. Both are gates",
  },
  {
    match: "staging-record.ts",
    kind: "ci-only",
    reason:
      // input-site: inert #4fabf72d — prose naming the directory, in a message or a description
      "writes the preview's `staging-preview` record into the built `_site` at deploy time (bean `6pfo`); " +
      "the PR, issue and the already-published record it updates exist only in CI and on `gh-pages`. " +
      "Its rules — builtAt kept, a retired record refused as live, a corrupt one refused — are in " +
      "`schemas/sdlc/staging-preview.ts` and covered by `staging-record.test.ts` in `bun test`",
  },
  {
    match: "staging-rotate.ts",
    kind: "ci-only",
    reason:
      "enforces the preview size budget (owner ruling 2026-10-02, issue #1868, amended 2026-10-04) by " +
      "removing previews from a `gh-pages` checkout at deploy time; that checkout exists only in CI. Its " +
      "rules — the budget counts the current preview, the oldest go, `_retired/` and non-previews are untouched, the age " +
      "fallbacks — are covered by `staging-rotate.test.ts` in `bun test`",
  },
  {
    match: "staging-push-gate.ts",
    kind: "ci-only",
    reason:
      "rate-limits the staging push (owner ruling 2026-10-03, issues #1868 and #1956) by reading the tip " +
      "of a `gh-pages` checkout and SLEEPING until its Pages build has had time to finish; that checkout " +
      "and the wait exist only in CI. Its rules — the two windows, clock skew never opening early, the " +
      "deadline failing rather than pushing, an unreadable tip never open, the PR comment's wording — are " +
      "covered by `staging-push-gate.test.ts` in `bun test`",
  },
  {
    match: "restore-staging.ts",
    kind: "ci-only",
    reason: "reconciles the `gh-pages` working tree against the open PRs' previews; needs that branch checked out",
  },
  {
    // Added by folio-assistant#2843 in `feature-staging.yml`: rewrites the
    // `gh-pages` checkout in place (`pages/branches/<slug>/` -> `_staging-blob/`
    // + `_staging-manifest/<slug>.json`) and writes `pages/404.html` and
    // `pages/_worker.js` right before the staging commit/push. Its four modes
    // (`apply`, `GC`, `write-404`, `verify`) — content-addressed deduplication,
    // manifest emission, and the fallback worker and root 404 — are covered by
    // `staging-share.test.ts` in `bun test`.
    match: "staging-share.ts",
    kind: "ci-only",
    reason:
      "deduplicates the built `pages/STAGING/<slug>/` tree in the `gh-pages` checkout before the staging push; " +
      "all four modes (`apply`, `GC`, `write-404`, `verify`) — content-addressed deduplication, manifest " +
      "emission, and the fallback worker and root 404 — are covered by `staging-share.test.ts` in `bun test`",
  },
  {
    match: "staging-cleanup-preflight.ts",
    kind: "ci-only",
    reason: "takes a deploy slug off the event payload; there is no event locally",
  },
  {
    // input-site: inert #c5cae08f — prose naming the directory, in a message or a description
    match: "--out \"./_site",
    kind: "ci-only",
    // input-site: inert #bac3cc4a — prose naming the directory, in a message or a description
    reason: "writes into the BUILT `_site`, which Jekyll produces in CI",
  },
  {
    match: "--out-dir ./_site",
    kind: "ci-only",
    // input-site: inert #bac3cc4a — prose naming the directory, in a message or a description
    reason: "writes into the BUILT `_site`, which Jekyll produces in CI",
  },
  {
    // The third spelling, and the reason there are three: `match` is a
    // substring, and a deploy step whose destination carries a shell variable
    // must quote it. `--out "./_site` and `--out-dir ./_site` were the two
    // forms that had occurred; `--out-dir "./_site` had not until a per-locale
    // export wrote into a foreign layer's subdirectory. Same reason, not a
    // new exemption — a step that got to green by being spelled differently
    // would be the thing this ratchet exists to stop.
    // input-site: inert #4229d23b — prose naming the directory, in a message or a description
    match: '--out-dir "./_site',
    kind: "ci-only",
    // input-site: inert #bac3cc4a — prose naming the directory, in a message or a description
    reason: "writes into the BUILT `_site`, which Jekyll produces in CI",
  },
  {
    match: "$RUNNER_TEMP",
    kind: "ci-only",
    reason: "a scheduled report written to the runner's temp dir and posted to an issue; the script runs locally, the reporting does not",
  },
  {
    // `bun pm pack`, renamed from `bun pack` 2026-09-20 (bean `frq2`) — the
    // latter is not a bun subcommand and so never ran. It sat as the dead
    // first branch of a `|| npm pack || tar … || true` chain, which is why
    // the release tarball could contain four files and no code without
    // anything failing.
    //
    // The old reason said "only a tagged release run has anything to pack".
    // That workflow has no tag trigger and never has; it is
    // `workflow_dispatch` only, and there are zero tags in this repository.
    match: "bun pm pack",
    kind: "ci-only",
    reason: "builds a release tarball; only a release run, dispatched by hand, has anything to pack",
  },
  {
    match: "bun run cat processes:viz",
    kind: "covered-by",
    reason:
      "the site builds write the processes pages (docs-site.yml, feature-staging.yml, after the drawings they embed); " +
      "`processes:viz:check` is in the gate set, and `processes-viz.test.ts` covers the generator in `bun test`",
  },
  {
    match: "scripts/staging-changes.ts",
    kind: "ci-only",
    reason:
      "writes a preview's `STAGING/<slug>/changes/` page at deploy time: its inputs are the PR's file list, the base " +
      "commit's lock, the built `_site` and the published `gh-pages` root, which exist only in the staging job. " +
      "Its expansion, prediction and comparison are covered by `staging-changes.test.ts` in `bun test`",
  },
  {
    match: "run cat render:bpmn",
    kind: "covered-by",
    reason: "`render:bpmn:check` is in the gate set; the site build runs the writer",
  },
  {
    match: "jsonld-label-resolution.test.ts",
    kind: "covered-by",
    reason: "`bun test` is in the gate set and runs every test file, this one included",
  },
  {
    // Bean `03nl`. The merge-main bot's one notification per run: it reads
    // THIS RUN's per-PR verdicts out of its own artifacts and decides whether
    // anything in them is new. There is no tree to judge and no verdict a
    // contributor could get from it — outside a run there are no artifacts to
    // read, and inside one the answer is about that run. Its branches are
    // pinned by `merge-main-workflow.test.ts` in `bun test`: every verdict
    // class, the three conditions that notify, and the quiet ones.
    match: "merge-main-comment.ts --aggregate",
    kind: "ci-only",
    reason:
      "reads this run's own per-PR verdict artifacts and decides whether any of them is new; nothing " +
      "to run outside a run, and its branches are pinned by merge-main-workflow.test.ts in `bun test`",
  },
  {
    // folio-assistant#2526 (owner, 2026-10-10: "regenerate at build"):
    // `docs/_data/harness.json` carries each navbar tile's count, and the
    // beans count is LIVE (open beans on the work-plan tip), so the site
    // builds (docs-site.yml, feature-staging.yml) rewrite it from the
    // projections they have just written. That is a WRITER. Its verdict is
    // `docs:harness:check` in the gate set, which is `publish:check
    // docs:harness` since B1: it runs this same writer and then holds it to a
    // fixed point and to every committed file it must not move. Matched with
    // the command prefix, which both workflows' lines share, and which no
    // `:check` twin outside the gates workflow carries.
    match: "bun run cat docs:harness",
    kind: "covered-by",
    reason:
      "a BUILD step: the site builds rewrite docs/_data/harness.json with this build's live tile counts; " +
      "its verdict is `docs:harness:check` (publish:check docs:harness) in the gate set, which runs the same writer",
  },
];

/**
 * {@link OWN_STEP_EXEMPTIONS} plus each present layer's declared
 * `gateExemptions.steps`. A layer above this layer declares the steps of
 * its own that CI runs and the gate set does not (bean `0r7u`): naming them
 * here broke this layer standalone, where those steps do not exist and the
 * stale-exemption test would refuse them.
 */
export const STEP_EXEMPTIONS: StepExemption[] = [
  ...OWN_STEP_EXEMPTIONS,
  ...declaredExemptions().steps,
];

/** The exemption covering this command, if any. */
export function exemptionFor(command: string): StepExemption | undefined {
  return STEP_EXEMPTIONS.find((e) => command.includes(e.match));
}

/**
 * Does this job install a browser? — the inner loop's one question.
 *
 * **Derived, because the sentence this replaces already said the answer was
 * derivable.** `FAST_JOBS = new Set(["typescript", "gates"])` was documented
 * as *"jobs whose steps need no browser"* and as *"Chromium … is the only
 * question this set actually asks"* — a predicate, written out, beside a
 * hardcoded list of the jobs that happened to satisfy it. Asking it directly
 * removes the gap where those two can disagree.
 *
 * The hazard the old comment names is real and this keeps it: a job the set
 * does not name contributes NOTHING, so `bun run cat gates` would shrink while
 * still printing a confident pass, and {@link NoGatesFound} could not catch it
 * because the remaining jobs still yield commands. Bean `om30` had to widen
 * the literal by hand when it split the job; the next split will not.
 *
 * It was also already wrong in the other direction. `dependency-advisories`
 * runs `bun run cat check:dependency-advisories`, needs no browser, and was absent
 * from the literal — so one CI gate had never run in the local fast set at all
 * (157 → 158).
 *
 * `playwright install` is the discriminator rather than a job's name: it is
 * what actually costs the 36 seconds and actually requires Chromium. The
 * shared installer `.github/scripts/playwright-chromium/install.sh` (which
 * skips apt when the libraries are present) counts the same.
 */
export function installsBrowser(def: { steps?: { run?: string }[] }): boolean {
  return (def.steps ?? []).some((s) => /playwright\s+install|playwright-chromium\/install\.sh/.test(s.run ?? ""));
}

/**
 * A job granted `contents: write` is a PUBLISHER, not a gate.
 *
 * Bean `16ei`: `code-quality-gates.yml` gained a job that publishes the QA
 * results to the `qa-reports` branch after the gates have run. Its `bun run
 * qa:publish` line would otherwise be extracted here and run by `bun run
 * gates` on a contributor's machine — a gate set that PUSHES. No gate needs
 * write access to judge a tree, so the permission is the structural
 * discriminator, as `playwright install` is for {@link installsBrowser}: it is
 * what the job actually holds, not what it is called.
 *
 * SCOPED TO THE GATES WORKFLOW ({@link loadGates}). Other workflows have jobs
 * holding `contents: write` too — `publish.yml`'s, for one — and their `bun`
 * steps are still classified by {@link otherWorkflowSteps} and the exemption
 * table, which is what keeps a CI step from going unaccounted for. The first
 * version applied it everywhere and three exemptions stopped matching.
 */
export function publishes(def: { permissions?: unknown }): boolean {
  const p = def.permissions;
  if (p === "write-all") return true;
  return typeof p === "object" && p !== null && (p as Record<string, unknown>).contents === "write";
}

/** One runnable gate, with the job and step that ask for it. */
export interface Gate {
  job: string;
  /** The step's `name:`, which is what the Actions UI shows on a failure. */
  step: string;
  /** The command line, exactly as the workflow runs it. */
  command: string;
}

/**
 * Every gate the workflow runs, in workflow order.
 *
 * Only `bun`/`bunx` lines are taken. The Lean, Python and Rust jobs are shell
 * scripts against trees a folio has and the platform does not — they SKIP
 * here by design, and running their bodies locally would report a clean scan
 * of nothing, which is the thing this module refuses to do.
 */
/**
 * `$VAR` or `${VAR}` — a shell variable this reader cannot resolve.
 *
 * ## Why a command carrying one is NOT a gate
 *
 * The extraction keeps `bun …` lines and discards everything else, which
 * necessarily discards the shell that gave those lines their variables.
 * `code-quality-gates.yml` writes
 *
 *     base="$(git merge-base origin/main HEAD 2>/dev/null || true)"   # :1345
 *     bun run cat translation:catalogue:check -- --base "$base"           # :1348
 *
 * and only the second line survives. Run as written, git is handed a ref
 * literally named `$base`, so the check exits 2 with *"could not determine:
 * git would not list what this change adds (`$base..HEAD`)"* — on every
 * branch, forever. Measured 2026-10-02, bean `9zok`: this made
 * `bun run cat gates` report `✗ 1 of 210` on a clean tree, which means the STRICT
 * pre-push rule in `AGENTS.md` was unsatisfiable as written.
 *
 * ## Why skipping loses nothing, and why that was checked rather than assumed
 *
 * The obvious worry is that skipping hides a gate. It does not here, and the
 * reason is measurable: the SAME script is invoked twice in that workflow —
 * once with `--base` for CI, which has a PR base sha, and once bare at :1321
 * for when it does not. Both are extracted, so the bare form already runs in
 * the same sweep. Measured on this workflow: 2 `translation:catalogue`
 * invocations extracted, and exactly 1 command in the whole set carrying an
 * unexpanded variable.
 *
 * ## It is reported, never silently dropped
 *
 * This file's own `NoGatesFound` doctrine is that a reader finding nothing is
 * not a clean sweep. The same applies one command at a time: a skipped
 * command is printed every run under its own heading, so "this reader cannot
 * run it" stays distinguishable from "it passed". Resolving the variable
 * properly would mean executing the workflow's shell, which is a different
 * and much larger thing than reading it.
 */
/** What {@link gatesFrom} takes: `all` widens to the browser jobs; `skipPublishers` drops jobs holding `contents: write` (bean `16ei`). */
export interface GateOpts {
  all?: boolean;
  skipPublishers?: boolean;
}

const SHELL_VAR = /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/;

/** Whether a command references a shell variable this reader cannot resolve. */
export function carriesUnexpandedVariable(command: string): boolean {
  return SHELL_VAR.test(command);
}

export function gatesFrom(workflowText: string, opts: GateOpts = {}): Gate[] {
  const doc = parse(workflowText) as {
    jobs?: Record<string, { permissions?: unknown; steps?: { name?: string; run?: string }[] }>;
  };
  const out: Gate[] = [];
  for (const [job, def] of Object.entries(doc.jobs ?? {})) {
    if (!opts.all && installsBrowser(def)) continue;
    if (opts.skipPublishers && publishes(def)) continue;
    for (const step of def.steps ?? []) {
      if (!step.run) continue;
      // A step's `run` may hold several lines; each `bun …` line is its own
      // gate, which is also how the workflow's own multi-command step is
      // meant to be read (`set -e`: the first failure names itself).
      for (const raw of step.run.split("\n")) {
        const line = raw.trim();
        if (!/^(bun|bunx) /.test(line)) continue;
        out.push({ job, step: step.name ?? "(unnamed step)", command: line });
      }
    }
  }
  return out;
}

/**
 * The commands this reader READ but cannot run.
 *
 * A VIEW over {@link gatesFrom}, not a narrowing of it, and that distinction
 * was paid for: the first version of this fix filtered inside `gatesFrom`
 * itself, which broke two tests that were right to break. `gatesFrom` answers
 * **"what does CI run"** — `unclassifiedSteps` and the `STEP_EXEMPTIONS`
 * staleness check both read it that way, and 14 exemptions went stale the
 * moment a command vanished from it — while *this* answers "what can I run
 * here". CI runs the `--base` command correctly, with a shell; only this tool
 * cannot. Removing it from the first answer asserted something false about CI.
 */
export function unresolvedGatesFrom(workflowText: string, opts: GateOpts = {}): Gate[] {
  return gatesFrom(workflowText, opts).filter((g) => carriesUnexpandedVariable(g.command));
}

/**
 * What this tool will actually run: {@link gatesFrom} minus
 * {@link unresolvedGatesFrom}. The two partition the extraction, so a command
 * is in exactly one of them and none goes missing from both.
 */
export function runnableGatesFrom(workflowText: string, opts: GateOpts = {}): Gate[] {
  return gatesFrom(workflowText, opts).filter((g) => !carriesUnexpandedVariable(g.command));
}

/** Thrown when the extraction finds nothing — never reported as a clean run. */
export class NoGatesFound extends Error {
  constructor(path: string) {
    super(
      `${path}: no gate commands were extracted. That is not a clean sweep, ` +
        `it is a broken reader — the workflow was renamed, restructured, or ` +
        `no longer runs its checks through \`bun\`. Fix the extraction or the ` +
        `workflow; do not treat this as green.`,
    );
    this.name = "NoGatesFound";
  }
}

/**
 * The commands this reader could not run, for the CLI to print.
 *
 * Separate from {@link loadGates} rather than returned beside it, because a
 * caller that wants the runnable set must not have to destructure an
 * "and also these" it can then ignore — that is how a skipped gate becomes a
 * silent one.
 */
export function loadUnresolved(root: string, opts: { all?: boolean } = {}): Gate[] {
  // A content root: the gates its CI runs with an input this side does not
  // hold (`run-gates.py` SUPPLIED_INPUTS, kind `input-absent`). CI runs them;
  // this tool cannot (cat-harness-tools#281).
  if (rootProfile(root) === "content") {
    return Object.entries(rootGateSet(root).skipped)
      .filter(([, s]) => s.kind === "input-absent")
      .map(([name, s]) => ({ job: LAYER_PR_CHECKS, step: name, command: s.command }));
  }
  // Publishers are dropped here as in `loadGates`: they are not gates, so
  // they are neither run nor reported as unrunnable (bean `16ei`).
  return unresolvedGatesFrom(readFileSync(join(root, GATES_WORKFLOW), "utf-8"), { ...opts, skipPublishers: true });
}

/**
 * Every gate CI RUNS — the runnable set plus the ones only this tool cannot run.
 *
 * The third consumer of this list, and the second time the layering caught me
 * out. `audit:coverage` asks "how many gates declare a kind", which is a
 * question about CI: a gate CI runs and that declares `@covers` still covers
 * its kind, whether or not a local runner can execute it. Pointing it at
 * {@link loadGates} silently shrank its census from 210 to 209 and turned
 * *"all 210 gates have declared, so this is a verdict rather than an upper
 * bound"* into a verdict over a smaller set than reality.
 *
 * So the two questions get two functions with their names on them:
 * `loadGates` for **what can I run**, this for **what does CI run**.
 */
export function loadGatesCiRuns(root: string, opts: { all?: boolean } = {}): Gate[] {
  // The writers too: CI runs them, as plain lines, and each declares `@covers`.
  return [...loadGates(root, opts), ...loadWriterSteps(root, opts), ...loadUnresolved(root, opts)];
}

/**
 * The gates workflow's runnable lines, partitioned: the GATES, and the
 * declared WRITERS ({@link isWriterStep}) held out of them. Preconditions are
 * in neither — `main` runs `qa:working-copy` itself.
 */
function workflowGates(root: string, opts: { all?: boolean }): { gates: Gate[]; writers: Gate[] } {
  const runnable = runnableGatesFrom(readFileSync(join(root, GATES_WORKFLOW), "utf-8"), { ...opts, skipPublishers: true }).filter(
    (g) => !PRECONDITION_STEPS.includes(g.command),
  );
  const scripts = scriptsOf(root);
  const gates: Gate[] = [];
  const writers: Gate[] = [];
  for (const g of runnable) (isWriterStep(root, g.command, scripts) ? writers : gates).push(g);
  return { gates, writers };
}

/**
 * The WRITER steps of the gates workflow, in workflow order — held out of
 * {@link loadGates}, so out of the parallel pool and out of the tree guard's
 * accounting, and run by `main` AFTER every gate, which is where CI puts them
 * ("last in the job on purpose"): nothing judged reads what they rewrite. A
 * content root's gate set carries none.
 */
export function loadWriterSteps(root: string, opts: { all?: boolean } = {}): Gate[] {
  if (rootProfile(root) === "content") return [];
  return workflowGates(root, opts).writers;
}

/** Read and parse, refusing an empty result. The RUNNER's list — see {@link loadGatesCiRuns}. */
export function loadGates(root: string, opts: { all?: boolean } = {}): Gate[] {
  // A root that is not a harness is measured against its OWN gate set: the
  // gates `layer-pr-checks.yml` runs for it, derived once by `run-gates.py`
  // (owner, cat-harness-tools#281: "hold smart-ra to its own gate set").
  // `--all` adds nothing there: that set is everything its PR checks run.
  if (rootProfile(root) === "content") {
    const gates = Object.entries(rootGateSet(root).gates).map(([name, command]) => ({ job: LAYER_PR_CHECKS, step: name, command }));
    if (gates.length === 0) throw new NoGatesFound(`${LAYER_PR_CHECKS} (run-gates.py --list)`);
    return gates;
  }
  // The RUNNER's list, so the filter belongs here rather than in `gatesFrom`:
  // a command referencing a shell variable this reader discarded cannot be run
  // as written, but CI does run it, and `gatesFrom` is what the accounting
  // checks read as "what CI runs". `reportUnresolved` prints what this drops.
  const gates = workflowGates(root, opts).gates;
  if (gates.length === 0) throw new NoGatesFound(GATES_WORKFLOW);
  if (!opts.all) return gates;

  // `--all` adds the OTHER workflows' locally-runnable steps. The fast set is
  // deliberately untouched: it is the inner loop, and widening it would make
  // the cheap check expensive without making it more true.
  const seen = new Set(gates.map((g) => g.command));
  for (const { file, step } of otherWorkflowSteps(root)) {
    if (seen.has(step.command)) continue;
    if (exemptionFor(step.command)) continue;
    seen.add(step.command);
    gates.push({ ...step, job: `${file}/${step.job}` });
  }
  return gates;
}

/** One `bun` step from a workflow that is not {@link GATES_WORKFLOW}. */
export interface ForeignStep {
  file: string;
  step: Gate;
}

/**
 * Every `bun` step in every OTHER workflow, in file order.
 *
 * Jobs are not filtered by {@link installsBrowser} here: that question is asked of the
 * gates workflow, and a job called `typescript` in another file is a different
 * job. Reading them all and classifying each is what keeps the two lists from
 * drifting.
 */
export function otherWorkflowSteps(root: string): ForeignStep[] {
  const dir = join(root, WORKFLOW_DIR);
  const out: ForeignStep[] = [];
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort()) {
    const rel = join(WORKFLOW_DIR, f);
    if (rel === GATES_WORKFLOW) continue;
    for (const step of gatesFrom(readFileSync(join(dir, f), "utf-8"), { all: true })) {
      out.push({ file: f, step });
    }
  }
  return out;
}

/**
 * Steps CI runs that are neither gated nor exempted.
 *
 * **Never empty-by-accident:** an unreadable workflow directory yields an
 * empty `otherWorkflowSteps`, and this would then report nothing unclassified
 * — a clean run over a directory it could not read. `gates.test.ts` asserts
 * the step list is non-empty for exactly that reason.
 */
export function unclassifiedSteps(root: string): ForeignStep[] {
  const gated = new Set(loadGates(root, { all: false }).map((g) => g.command));
  for (const g of gatesFrom(readFileSync(join(root, GATES_WORKFLOW), "utf-8"), { all: true })) {
    gated.add(g.command);
  }
  return otherWorkflowSteps(root).filter(
    ({ step }) => !gated.has(step.command) && !exemptionFor(step.command),
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * The OTHER direction: a check script no workflow runs.
 *
 * `unclassifiedSteps` asks "CI runs this — does the local set?". Its domain
 * is steps found IN WORKFLOWS, which makes it structurally unable to report a
 * check that appears in no workflow at all. Measured 2026-09-20: **9 of 46**
 * `check:` / `:check` scripts here are in no workflow, and one of them,
 * `translate-kg-viewer:check`, was RED on main for an unknown stretch while
 * CI stayed green — bean `ot9a`, which is bean `xom7`'s shape one level down.
 *
 * ## This does NOT make `package.json` the authority
 *
 * The module header's argument stands and is not being re-litigated: the
 * RUNNER derives from the workflow, because the question it answers is *"what
 * will CI run against my change"* and only the workflow knows that. Running
 * every script in `package.json` would fail on things CI does not gate.
 *
 * This asks a different question — *"is there a check nobody runs?"* — and a
 * different question needs a different domain. Six of the nine already had
 * reasons, written as a COMMENT in `code-quality-gates.yml`. A comment cannot
 * be compared against the set it describes, which is why the other three
 * (`health:check`, `landing:data:check`, `landing:sticky:check`) had no reason
 * anywhere and nothing said so.
 *
 * And a reason nothing checks is free to be false. The comment excluded
 * `translate-*:check` as needing *"a translation toolchain not installed on
 * this runner"*; both run clean on a bare checkout, measured. That exclusion
 * kept two working gates out of CI on a premise no longer true.
 * ───────────────────────────────────────────────────────────────────────── */

/** Why a check script is not wired into a workflow. */
export interface ScriptExemption {
  /** The script name, matched EXACTLY. Never a substring — see below. */
  script: string;
  kind: "report" | "covered-by" | "no-folio" | "scheduled" | "pending-baseline";
  reason: string;
  /**
   * `pending-baseline` only (owner, 2026-11-07, "A. Two steps"): the script
   * that WRITES the stored baseline this check judges against. A new check
   * judged against a baseline main has never written reports every finding as
   * new, so it is wired in two steps: the writer first, so main's push records
   * the baseline, then the check. The exemption holds only while CI runs this
   * writer; with the writer unwired, the check is reported unrun as before.
   */
  writer?: string;
  /** `pending-baseline` only: the change that wires the check, named so the wait is visible. */
  followUp?: string;
}

/**
 * The check scripts CI deliberately does not gate, each with its reason.
 *
 * Lifted out of a comment in `code-quality-gates.yml`. Same reasons, now in
 * a place a test can compare against the actual script list — which is the
 * whole difference, since the comment silently covered six of nine.
 */
const OWN_SCRIPT_EXEMPTIONS: ScriptExemption[] = [
  {
    script: "check:site-iris",
    kind: "covered-by",
    reason:
      "judges a BUILT site tree (`--site <dir> --base <iriBase>`), so it has nothing to read on a checkout: every site build " +
      "runs it over the tree it built, as a QA finding — `build-instance-site.ts` and `stage-local.ts`'s folio path, " +
      "`siteIriCheckStep` (IRI fix 1A, f; owner, 2026-11-18). Covered by `scripts/tests/check-site-iris.test.ts` in `bun test`",
  },
  {
    script: "iri-base:check",
    kind: "no-folio",
    reason:
      "judges only a layer whose `index.config.json` entry declares `publish` (WHO migration T3, cat-harness-tools#2337), " +
      "and runs in that content layer's own checkout; the platform index mounts no such layer, so here it judges nothing. " +
      "Covered by repo-owner.test.ts in `bun test`; wired into the content layers' CI when the first one declares `publish` (T4)",
  },
  {
    script: "check:optin-links",
    kind: "covered-by",
    reason:
      "COMPOSED into `check:declaration-resolution`, which CI runs: its findings are that gate's `optInLinks` field, so a " +
      "step of its own would report every link twice. Kept as a script to list the links alone (owner, 2026-11-11: a gate " +
      "fails on links into a switched-off opt-in sub-graph, each fixed by hand)",
  },
  {
    script: "check:optin-refs",
    kind: "covered-by",
    reason:
      "COMPOSED into `check:declaration-resolution`, which CI runs: its findings are that gate's `optInRefs` field, so a " +
      "step of its own would report every reference twice. Kept as a script to list the references alone (owner, " +
      "2026-11-12, card Q-OPTINREFS-CI B: gated now, each always-on Tool or workflow naming an opt-in-only skill fixed at its source)",
  },
  {
    script: "layers:check",
    kind: "covered-by",
    reason:
      "runs in the CALLER'S CI, not this layer's: job `layers-ref` of `layer-pr-checks.yml` runs the replayer at the " +
      "commit the caller's lock pins with `--check-layers`, on an index-mode pull request that changes `index.lock.json` " +
      "(owner, 2026-11-08: the re-pinner publishes the layers ref, and a gate checks it). This layer has no lock of its " +
      "own to judge, so `bun run cat layers:check` here would only report `skipped`",
  },
  {
    script: "lock:coherence:check",
    kind: "covered-by",
    reason:
      "runs in the CALLER'S CI, not this layer's: job `lock-coherence` of `layer-pr-checks.yml` runs it at the commit the " +
      "caller's lock pins, on every pull request that changes `index.lock.json` (owner, 2026-11-11: a lock whose harness " +
      "pins disagree with the pinned harnesses' own locks, or lag their repositories' main, may not reach main, after " +
      "a content layer's main went red on skewed pins). " +
      "This layer has no lock of its own to judge, so `bun run cat lock:coherence:check` here only reports nothing to check",
  },
  {
    script: "translate-user-scenarios:check",
    kind: "no-folio",
    reason:
      "judges an instance's user-scenario templates, and the platform declares no user-scenario directory, so here it can " +
      "only exit 78 (not applicable). Each instance that declares one runs it in its own CI over its own scenarios, as " +
      "the IGs run their translation template checks",
  },
  {
    script: "check:context-leak",
    kind: "report",
    reason:
      "JUDGES A BUILT AGENT CONTEXT, not this tree (cat-harness#991 step 22, proposal §4.13): it is given the context " +
      "directory, tool list and prompt of a bean-blind run and has no default input, since reading nothing is never clean. " +
      "It runs in report mode until the clean-up (steps 23-25) lands; it then becomes a gate in the ITB, which refuses a " +
      "bean-blind run whose context fails it, and in each content layer's CI over that layer's bean-blind context",
  },
  {
    script: "check:workflow-pins",
    kind: "report",
    reason:
      "RED UNTIL THE ROLLOUT (security audit S1, owner Q-SEC-4 \"B\", 2026-11-01): it judges the calling repository's own " +
      "`.github/workflows/*`, and every layer still calls `litlfred/*@main` until its index.lock.json is re-pinned past the " +
      "commit that adds this script and `bun run cat workflow-pins` is run there. Wiring it now would red every PR in every " +
      "layer on refs this commit does not change; it becomes a gate in each repository's own CI once that repository is pinned",
  },
  {
    script: "check:site-publish-caller",
    kind: "report",
    reason:
      "RED UNTIL THE ROLLOUT (owner, 2026-11-11: \"i want that it publishes once merge to main, update QA reports etc.\"; " +
      "cat-harness-tools#1879): it judges the calling repository's own `.github/workflows/*` for the canonical caller of " +
      "`folio-site-publish.yml`, and most layers still carry a dispatch-only copy or none. Here it judges nothing (this " +
      "layer holds the template). Wiring it now would red every layer's PRs on files their change does not touch; it " +
      "becomes a gate in each repository's own CI once that repository carries the caller",
  },
  {
    script: "check:lock-consistency",
    kind: "report",
    reason:
      "A REPORT, NOT A GATE (owner, 2026-11-13, \"3y 1y\": only the top-level lock decides): it lists where an index " +
      "and the locks of the layers it mounts pin different commits of a shared lower layer. A composition mounts each " +
      "layer once, at the index's pin, so a lower layer's own lock records only what it was last tested with; requiring " +
      "them to match made every re-pin a serial bottom-up cascade. The stale committed files it once caught move to build " +
      "time under option 3 of the same ruling. Run it to see what a lower layer was tested with",
  },
  {
    script: "jsonld:contexts:check",
    kind: "report",
    reason:
      "RED WHERE IT LANDED (891c678): the DAK base layer and two DAK IGs publish no `ns/context/v1.jsonld` " +
      "yet, and `cat-harness/docs/subgraph/cat-harness/index.jsonld` uses an unbound prefix for the content core. " +
      "Wiring it into CI now would red every PR on pre-existing gaps; it becomes a gate once those contexts are generated " +
      "(folio-assistant#2529 triage, 2026-10-15)",
  },
  {
    script: "software:check",
    kind: "report",
    reason:
      "A PROPERTY OF THE MACHINE, not of the commit: it asks whether the programs the harness's scripts check for " +
      "(`scripts/software.json`) are on PATH here, so the same tree passes on one runner and fails on another. Its use is " +
      "the `finding-software` skill's ladder before a run that needs them; as a CI gate it would judge the runner image",
  },
  {
    script: "check:bean-issues",
    kind: "report",
    reason:
      "IT JUDGES THE WORK PLAN, which lives on its state branch rather than in the commit under review (bean `xeer`): a PR " +
      "that touches no bean would go red when somebody else files one. On 2026-10-10 it reported 131 beans owing an issue " +
      "link; wiring it as a gate is for after that drain, by an owner's decision, with the work plan's own CI as its home",
  },
  {
    script: "check:bean-one-home",
    kind: "report",
    reason:
      "IT JUDGES THE WORK PLAN ACROSS FOUR REPOSITORIES (#459): it fetches every bean store over the network and fails when a " +
      "bean id is held by two of them or by the retired litlfred/cat-harness branch. No commit under review changes that answer, " +
      "so as a PR gate it would red unrelated work; it is run after editing beans and before applying a dedupe",
  },
  {
    script: "check:change-size",
    kind: "report",
    reason:
      "A MEASUREMENT OF ONE CHANGE against a base ref (`--against origin/main`), not a property of a commit: the same tree is " +
      "small against one base and large against another. It is advisory by its own header (report-only until the ~400-line " +
      "threshold is calibrated, spec-kit Child 4 / issue #754), so as a CI gate it would red ordinary work on a number nobody " +
      "has yet agreed is a defect",
  },
  {
    script: "check:spec",
    kind: "report",
    reason:
      "IT HAS NO SUBJECT IN A COMMIT: it validates ONE specification, named by `--issue <n>` or `--file <path>`, and reads " +
      "specs from issue comments rather than from a directory (FR-013, spec-kit Child 2 / issue #752). Run bare it has " +
      "nothing to judge, so as a CI step it would be a gate whose normal state is unable to fire; the CRDM process runs it " +
      "on the spec in hand",
  },
  {
    script: "skill:register:declarations:check",
    kind: "covered-by",
    reason:
      "SUBSUMED by `skill:register:check`, which CI runs: this is the same script with `--declarations-only`, which asks the declaration half and leaves out the chain checks (`STEPS`), so the gate performs this one's entire job besides. It exists for ONE caller, `regen-after-merge` via `pair-cover.ts` (bean `8qyc`): when every chain check is already asked in the same pool, the full gate would ask them a second time, so the pool asks the residual instead. As a CI step it would duplicate a subset of a step CI already runs",
  },
  {
    script: "check:bean-calls",
    kind: "covered-by",
    reason:
      "SUBSUMED by `check:workflow-refs`, which CI runs: that gate calls the same `beanCallFindings` over the same diagrams and fails on the same findings, so this one's entire job is done there. Kept as a script so the rule — claim, resolve and archive only inside Process_BeanOpen and Process_BeanClose, and every bean-working process calling both — can be asked on its own while a diagram is being redrawn. Bean `m8gz`",
  },
  {
    script: "split:baseline:check",
    kind: "report",
    reason:
      "A COMPARISON FOR ONE CHANGE, not a property of every commit — bean `pyds`. It compares the served MCP tools and the resolvable skills against the stage-0 baseline of the cat-harness-tools split, and its only consumer is the stage-1a move (`70lx`), whose falsifiers say a change that only MOVES files must leave both identical. Every other pull request legitimately adds a skill or a tool, so as a CI gate it would go red on ordinary work and teach the next agent to rewrite the baseline to get green, which is a ratchet with no direction. The 70lx PRs run it by hand and quote the result; once the split is done it has no subject, and the script and its baseline are removed with the last 70lx batch",
  },
  {
    script: "check:test-budgets",
    kind: "report",
    reason:
      "IT HAS NO SUBJECT UNTIL A SUITE HAS RUN — bean `sff8`. It reads a junit report produced by `bun test --reporter=junit`, so as a gate it would either duplicate the ~5-minute suite or run against a file that is not there; a missing report is exit 2, `could not determine`, which as a CI step would be a gate whose normal state is unable to fire. Its subject is also the wrong KIND for a gate: a test's cost is a fact about the MACHINE, not about this repository, so red here would report the runner while every reviewer read it as a verdict on the diff — the always-red-signal defect `check:bun-runtime` names one input over. Nothing it reports is a defect in this repository's source, so it exits 0 or 2 and never 1 (`nytj`), and 0 cases is exit 2 rather than a clean run over nothing (`6tkl`). It writes NO sidecar, deliberately, because committing milliseconds would pin this container's numbers as the corpus's — the `3vc1` defect — and `check:ci-health` already carries the precedent for asking a machine-shaped question externally every run and caching it nowhere. Whether a threshold should ever GATE is left open on the bean rather than settled here: ~50 cases sit at half the default budget under load, so a threshold gate would need 50 exemptions nobody has read, which is the empty exemption `xd1g` removed a gate for",
  },
  {
    script: "check:environment",
    kind: "report",
    reason:
      "A PRECONDITION, not a gate — bean `3vc1`. `gates.ts` calls `distortions()` directly before running anything and refuses the whole set on a finding, so the script exists for a contributor to ask the same question standalone. It is deliberately in NO workflow: CI installs only from the repository root, so a nested install cannot arise there and the step would be a gate that can never fire — which reads as protection and is not, the same dead-guard defect this file names for `build-glossary`. Its findings exit 2, never 1: a distorted environment is `could not determine` and nothing it reports is a defect in this repository's source (`nytj`). Measured: a nested `bun install` under `adapters/mcp-server` takes root `tsc` from 0 errors to 12 across 6 files with no source change, while CI on the identical commit is green",
  },
  {
    script: "check:bun-runtime",
    kind: "report",
    reason:
      "CI CANNOT OBTAIN A MISMATCH \u2014 the `ingest:ig-menu:check` shape, one input over. It compares the Bun RUNNING in this process against `.bun-version`, and CI installs `.bun-version` at all 22 `setup-bun` sites (that is `check:bun-pin`, which IS gated), so on a runner `running === pinned` by construction. Wired as a gate it would exercise nothing on every run, and its one interesting state would be unreachable from the only place it was ever checked. Its subject is the ENVIRONMENT rather than the corpus, so no commit can change the answer either: red here would report the machine while every reviewer read it as a verdict on the diff, which is the second always-red signal #1442 removed the first one for. **It is not unrun.** `session-start-coord-sweep.sh` runs it with `--markdown` on every session start. What it reports there changed once already: it was built to warn that a mismatched bun rewrites 72 of 86 sidecars on every sweep, and #1452 removed `engine_version` from `saveQaScriptSidecar`'s write-skip comparison, so nothing is rewritten and THAT CLAIM IS RETRACTED (measured: 0 rewritten where this container had produced 72). What it says now is that the agent is not running the code CI will judge its push with, and that a checker changed here stamps its sidecar with the older local engine \u2014 `rmcf`'s downgrade concern, which needs a real content change and is no longer an every-run event. Built so a blind run cannot read as clean: no pin, an unparseable pin or no Bun to ask all exit **2** as `cannot-tell`, never 0. Run it by hand, or read it at session start. Bean `3ozg`",
  },
  {
    script: "check:quiet-claims",
    kind: "report",
    reason:
      "A REPORT, and deliberately not a gate — bean `omki`. It supplies the NETWORK half of `bean-quiet-claims` (an open pull request naming a bean, an unmerged branch changing its file), so it needs a reachable GitHub API and a token, and it fetches before it reads because `pomp` makes ref freshness part of the evidence. Gating on it would make every PR depend on api.github.com being up, and it would redden when a SIBLING's branch merges rather than when this author forgot anything — the property `schema:viz:check` is exempt for. Its findings exit 0 on purpose: a quiet claim is a fact about the repository, not a defect in a diff. Could-not-determine exits 2, so a caller cannot read a blind sweep as a clean one. Run it by hand, or from a goal-review sweep",
  },
  {
    script: "check:kind-validators",
    kind: "covered-by",
    reason:
      "SUBSUMED by `check:kind-validators:require-all`, which CI runs: the same script with a flag that adds one assertion — that no kind has stayed silent about a validator — and performs this one's entire job besides. Kept as a script because the bare form is the REPORT, and a contributor adding a kind wants to read the three states without the non-zero exit while they are still deciding which one applies. Bean `rj0n`",
  },
  {
    script: "kind:table:check",
    kind: "covered-by",
    reason:
      "SUBSUMED by `kind:register:check`, which CI runs: its first STEP is exactly `kind:table:check` (cat-harness-tools/scripts/kind-register.ts), so the generated kind table in directory-conventions.md is checked on every push through the command that owns every artefact a kind owes. Kept as a script because a contributor editing one kind node wants the table's answer alone, without the other steps. Bean `dmx1`",
  },
  {
    script: "check:harness-state",
    kind: "covered-by",
    reason:
      "SUBSUMED by `check:harness-state:check`, which CI runs: the same script with `--check`, so it examines exactly the same four families and fails on a finding instead of reporting it. Kept as a script because the writer is what refreshes the committed sidecar, and a contributor wants the report without the non-zero exit while they are still fixing things. Bean `h1wq`",
  },
  {
    script: "check:source-licence",
    kind: "covered-by",
    reason:
      "SUBSUMED by `check:source-licence:check`, which CI runs: the same script with `--check`, so it computes the same report and fails on the same malformed records, and additionally fails when the committed sidecar is not what the corpus produces. The bare form is the WRITER of `test/results/source-licence.qa-results.json`, and it used to be the gate — so the gate rewrote the record it should have judged, and a stale sidecar failed nothing (bean `i2kp`). Kept as the author's command, and as the writer `regen` pairs with the `:check` twin",
  },
  {
    script: "check:library-qa",
    kind: "covered-by",
    reason:
      "SUBSUMED by `check:library-qa:check`, which CI runs: the same script with `--check`, so it judges exactly the same library entries and fails on a stale sidecar or a could-not-determine entry instead of rewriting the sidecar. Kept as a script because the writer is what refreshes `library-entry-qa.qa-results.json` after an ingest. Issue #1794, bean `8iqc`",
  },
  {
    script: "audit:coverage:check",
    kind: "covered-by",
    reason:
      "SUBSUMED by `audit:coverage:require-all`, which CI runs: that is the same script with `--check --require-all`, so it performs this check's entire job and one more assertion on top. Kept as a script because it is what a contributor runs locally when they want the staleness answer WITHOUT being told about a gate somebody else left undeclared — the two questions have different owners. Bean `3srh`",
  },
  {
    script: "schema:viz:check",
    kind: "covered-by",
    reason:
      "the site build runs the WRITER at deploy (`docs-site.yml`), so nothing published goes stale. Deliberately not gated (owner, 2026-09-20): the projection derives from the WHOLE repository, so the check reddens when somebody ELSE merges rather than when the author forgets. Measured on PR #583 — `main` moved four times in one session (120, 2, 2, 11 commits) and twice that reddened a branch whose own tree was correct. A red that is not an omission is the thing `gen-docs-pages --check` sets the standard against. Run it by hand, or from `/prepare-merge`",
  },
  {
    script: "library:viz:check",
    kind: "covered-by",
    reason:
      "same as `schema:viz:check` and for the same reason: the writer runs at deploy, and the projection derives from the whole repository, so its red means a sibling merged rather than that this diff forgot. Run it by hand, or from `/prepare-merge`",
  },
  {
    script: "library:keywords:check",
    kind: "covered-by",
    reason:
      "the keywords graph (`docs/assets/keywords/`) is builtAtPublish, so in the harness `--check` has nothing committed to compare and exits 0; `derive:publish` writes it at deploy. Its term weights derive from the WHOLE library, so one sibling ingesting an entry reweights every node (issue #2302, cat-harness#1144). Missing keywords and legacy keywords.json files are reported by the `library-keywords` health check",
  },
  {
    script: "uploads:viz:check",
    kind: "covered-by",
    reason:
      "same as `library:viz:check`, and NECESSARILY so: it renders that projection. The writer runs at deploy (`docs-site.yml`), and what it draws derives from the whole repository, so a red here means a sibling merged rather than that this diff forgot. Gating it would also be worse than gating its sibling, because this generator emits no projection of its own — it publishes a viewer over `assets/library/index.json` (bean `flh4`: one dataset, since two would be two answers to how many are queued), so its staleness is the library projection's staleness wearing a second name. Run it by hand, or from `/prepare-merge`",
  },
  {
    script: "wireframe:check",
    kind: "covered-by",
    reason:
      "not a gate but the Tool `wireframe-check`: it takes the candidate files to render as arguments, and with none it has nothing to measure. What it writes, `checks/report.json` beside each wireframe, IS gated, by `check:wireframes`, which fails on a declared visualiser whose wireframe has no report, or a report missing a viewport or holding a fail (issue #1023). Run it by hand when a wireframe changes",
  },
  {
    script: "check:reference-direction",
    kind: "covered-by",
    reason:
      "SUBSUMED by `check:reference-direction:check`, which CI runs with `--against main`: the same script with `--check`, which writes nothing and fails on a graded state that is NEW against the `qa-reports` baseline \u2014 above all A.10's `wrong-direction` family (owner Q-B 2026-10-01), one entry per file and per instance above it that the file names, so a new file naming ONE higher instance fails as well as one naming several, and a known file naming a further instance fails too; plus an unlisted multi-destination file, a `PENDING` entry newly no longer qualifying, an instance newly declaring no `needs`. The inherited backlog is not graded: a gate that refused every push until the backlog drained would be switched off. This plain form is kept as the WRITER of `cat-harness/test/results/reference-direction.qa-results.json` (`qa:refresh` runs it, and that copy is what the next `main` entry on `qa-reports` publishes), and it still exits 1 on the stale-`PENDING` and unlisted-multi-destination states \u2014 recording a state is not resolving it. Fix a finding by REWORDING in place (Q1), not by moving the file. Beans `1bvx`, `vzo5`, `zhg2`",
  },
  {
    script: "check:session-staleness",
    kind: "report",
    reason:
      "CI CANNOT OBTAIN ITS INPUT, and that is the reason rather than a preference. Probed 2026-09-21 from inside a session container: no session credential in the environment, `api.anthropic.com/v1/sessions` -> 401, `claude.ai/api/code/sessions` -> 403. `list_sessions` is an MCP tool an AGENT holds, not an endpoint a script can call -- the same wall that makes `sibling-sessions.ts` infer sessions from commit trailers. Wired as a gate it would examine NOTHING and report a clean run over every session, which is the `dh4f` defect inside the check written to stop a clean-run-over-nothing one level up. It belongs in the session-start sweep, run by an agent that can produce the listing, or by hand with a saved payload. Bean `rq8s`",
  },
  {
    script: "check:ci-health",
    kind: "report",
    reason:
      "a REPORT, not a gate: it reads the DEFAULT BRANCH, so on a PR it describes main rather than the diff. `ci-health.yml` runs it",
  },
  {
    script: "check:head-has-run",
    kind: "report",
    reason:
      "CIRCULAR as a gate — it asks whether this commit has a workflow run, and a CI job asking that has already answered it. Bean `3pqn`: it exists for the moment BEFORE the run, when a PR shows zero checks and that is indistinguishable from checks not started. Run it by hand, or from `/prepare-merge`",
  },
  {
    script: "check:corpus-gate",
    kind: "no-folio",
    reason: "runs over a folio's content tree; the platform carries none",
  },
  {
    script: "folio:shim:check",
    kind: "no-folio",
    reason: "runs over a folio's builders shim; the platform carries no folio, so here it exits 2 (no builders shim here)",
  },
  {
    script: "check:upstream-pins",
    kind: "scheduled",
    reason: "`upstream-pins.yml` runs it weekly; pins do not move with a diff",
  },
  {
    script: "check:reference-direction:strict",
    kind: "report",
    reason:
      "THE SAME SCRIPT AS `check:reference-direction`, exiting 1 on ANY wrong-direction occurrence rather than only on a NEW (file, instance) pair. It is the form the axis ends in: it becomes the gate when the `wrong-direction` family of the sidecar is empty, which is the drain (reword in place, owner Q-B Q1). Until then `check:reference-direction:check` is what CI enforces \u2014 the ratchet over the `qa-reports` baseline \u2014 and a gate that failed on the inherited backlog would be a gate somebody switches off. Run it by hand to see what full enforcement would say today. Bean `zhg2`",
  },
  {
    script: "check:partition:edges",
    kind: "report",
    reason: "prints the edge list; `check:partition` is the gate and is wired",
  },
  {
    script: "check:theme-art",
    kind: "report",
    reason:
      "prints every backdrop role and what intake found; `check:theme-art:check` is the gating form",
  },
  // Bean `bo44`: seven producers whose bare form WRITES its QA sidecar. Each
  // used to be the gate, so the gate CI ran was also the writer of the record
  // it reported into. The bare form is now the author's command and the
  // `:check` form — compute, judge, write nothing — is what is wired.
  ...(
    [
      "check:avatar-coverage",
      "check:lane-documentation",
      "check:layout-norms",
      "check:methodology-evidence",
      "check:rendered-labels",
      "check:source-licence",
      "check:wireframes",
    ] as const
  ).map(
    (script): ScriptExemption => ({
      script,
      kind: "report",
      reason: `WRITES its QA sidecar (bean \`bo44\`), so it is the author's command and not a gate; \`${script}:check\` is the judge form — compute, judge, write nothing — and is wired`,
    }),
  ),
  {
    script: "check:unlinked-beans",
    kind: "report",
    reason:
      "WRITES its QA sidecar and is a WARNING by the owner's ruling (bean `w2hn`, 2026-10-24: a bean tied to no BPMN task is \"not failure\"), so it has no gating form; `qa:refresh` runs it as a writer of the `qa` tree",
  },
  {
    script: "check:upload-names",
    kind: "report",
    reason:
      "prints every name it would change; `check:upload-names:check` is the gating form and is wired",
  },
  {
    script: "check:upload-names:fix",
    kind: "report",
    reason:
      "performs the renames with `git mv`; a FIX is never a gate, and it refuses on a collision rather than picking a winner",
  },
  {
    script: "check:bean-parent-prose",
    kind: "report",
    reason:
      "prints the placement-phrase ratio that justifies the check's own scope; `check:bean-parent-prose:check` is the gating form and is wired",
  },
  {
    script: "check:instance-themes",
    kind: "report",
    reason:
      "prints each declaring instance's themes and their kinds; `check:instance-themes:check` is the gating form and is wired",
  },
  {
    script: "check:navbar-consistency",
    kind: "report",
    reason:
      "prints each instance's icon resolution and the two glyph registries' overlap; `check:navbar-consistency:check` is the gating form and is wired",
  },
  {
    script: "check:nav-names",
    kind: "report",
    reason:
      "rewrites `test/results/nav-names.qa-results.json` and prints every destination's names; `check:nav-names:check` is the gating form and is wired",
  },
  {
    script: "check:navbar-consistency:strict",
    kind: "report",
    reason:
      "fails on the two ADVISORY families as well — declared tiles on the fallback glyph, and art shipped without an `icon`. Both are editorial calls (`glyphFor`'s fallback is deliberate), so the gate runs `:check`; this form exists for a sweep that wants the coverage gap to be fatal",
  },
  {
    script: "check:undeclared-files",
    kind: "report",
    reason:
      "prints the unaccounted paths with their sizes; `check:undeclared-files:check` is the gating form and is wired",
  },
  {
    script: "check:merged",
    kind: "covered-by",
    reason:
      "runs the WHOLE gate set on this branch merged with the current base (bean `nytj`), so wiring it into the workflow the gate set is read from would run the gates inside the gates. In CI the same question is answered by the merge queue: `merge_group:` on the gating workflows tests exactly the commit that will land. `check:merged` is the agent's half, run from `/prepare-merge` before asking for a merge",
  },
  {
    script: "health:check",
    kind: "covered-by",
    reason:
      "`health-check.yml` runs `test/health/run.ts` directly rather than through this script name — daily, and it writes its results to their state branch through `state:push`",
  },
  {
    script: "publish:check",
    kind: "covered-by",
    reason:
      "A RUNNER WITH NO SUBJECT OF ITS OWN (B1, owner 2026-10-14): it takes the writer to judge as its argument, and run bare it exits 2 with `name a package script that writes`. CI runs it through every `<writer>:check` alias that names one — `docs:harness:check`, `auto:docs:check`, `navbar:include:check`, `subgraph:jsonld:check` and the rest are each `publish-check.ts <writer>` — so every writer it can judge is judged, under its own name",
  },
  {
    script: "beans:retag:check",
    kind: "covered-by",
    reason:
      "IT JUDGES THE WORK PLAN, which lives on its state branch rather than in the commit under review (bean `xeer`'s reason for `check:bean-issues`), and the write it checks for is made on every path a bean takes to that branch: `state:push` retags the store before it splices (`retagBeansBeforePush`), and the session-start sweep retags the mount. So no bean reaches the branch untagged through the harness's own tools; this `--check` is for a store somebody wrote around them. Bean `ujiv`",
  },
  {
    script: "check:draft-beans",
    kind: "report",
    reason:
      "IT JUDGES THE WORK PLAN AGAINST OTHER BRANCHES, not a commit (bean `folio-assistant-3432`): it reports draft decision beans that exist on no ancestor of the default branch, so it needs the bean store mounted from its state branch and the default branch's history, which a pull-request checkout (one commit, no `origin/main`) does not carry: it names the branch from `GITHUB_BASE_REF`, the event's declared default or the remote's HEAD and fetches it (cat-harness-tools#2460), and with no draft decision bean it never asks. Its finding is about a SIBLING's unmerged branch, so as a gate it would redden this PR for somebody else's draft. Run it from a goal-review sweep",
  },
  {
    script: "branch:readme:check",
    kind: "report",
    reason:
      "ITS SUBJECT IS OTHER BRANCHES (bean `esz4`): it reads every declared special branch's README over the network and compares it with the rendering from its declaration and manifest. A state branch moves independently of `main` — the work plan, the health reports and the QA store are written by their own jobs — so as a PR gate it would redden on a branch the PR never touched, and an unreachable branch is exit 2 rather than a verdict on the diff. The fix it names is `branch:readme --push <branch>`, a write to that branch, never a change to the PR",
  },
  {
    script: "check:tool-parity",
    kind: "report",
    reason:
      "A MEASUREMENT, with no failing state (bean `folio-assistant-2ngl`): it counts the Tool nodes with an MCP arm, a CLI arm or both, and lists the skills a CLI-only developer mode cannot exercise. It exits 0 on every outcome, so as a CI step it would be a gate that can never fire; the numbers are input to the developer-mode decision, not a defect in a diff",
  },
  {
    script: "secrets:check",
    kind: "report",
    reason:
      "IT JUDGES THE REPOSITORIES' SECRET SETTINGS, not the commit (bean `folio-assistant-jzba`): it compares declared credential needs with the `${{ secrets.NAME }}` the workflows use and with the secret NAMES GitHub lists, which needs a token allowed to list them. Every run exits 2 by its own design until `credentials/needs.json` exists (bean `9hxd`), so as a CI step its normal state is unable to fire; its naming findings are advisories about secrets an owner configures outside any PR",
  },
  {
    script: "separation:cutover:check",
    kind: "report",
    reason:
      "A ONE-EVENT QUESTION, asked of a repository that has just left the monorepo: is its cutover complete (kg-separation stage 13)? Five of its six conditions are gates CI already runs (`remote-mount --check`, `check:declaration-resolution`'s parts, `check:import-direction`, `check:reference-direction`), and the sixth, `site`, is a full site build it runs only with `--site`; without it the run is `not-run` and exits 2 by design. So as a step it would either repeat gates or build the site twice. Run it, with `--site`, in the separated repository at its cutover",
  },
  {
    script: "post-merge:regen:check",
    kind: "covered-by",
    reason:
      "IT RUNS THE GATES' CHECK HALVES ITSELF (bean `folio-assistant-ey1c`): `checkPostMergeRegen` reads the gate set (`loadGates`) and runs the `:check` of every repairable writer/check pair in it, so wiring it into the workflow the gate set is read from would run the gates inside the gates — the reason `check:merged` is exempt. Its subject is `main` AFTER a merge, which no pull-request run has; its repair logic is pinned by post-merge-regen.test.ts in `bun test`",
  },
  {
    script: "check:cat-harness-tools-standalone",
    kind: "covered-by",
    reason:
      "RUN IN THIS LAYER'S OWN CI: cat-harness-tools' `pr-tests.yml` measures the layer standing alone on the pull request's base and head (`check-standalone.ts --layer cat-harness-tools --measured-out …`) and its `standalone` job fails on a test that newly fails. In folio-assistant the layer is a mount at a pin that has already passed that, the way `check:cat-harness-standalone` is the index's job for cat-harness",
  },
  {
    script: "check:journey-refs",
    kind: "no-folio",
    reason:
      "ITS SUBJECT IS JOURNEYS AND WORKSHOPS, which no instance this index mounts declares (the `user-scenario` and `workshop` kinds are held by litlfred/smart-trust-demo and litlfred/smart-ips-pilgrimage; test/coordinator/viewer-tools.test.ts lists them as held outside), so here it would read nothing and say so. It is a `check:` script of this layer's package.json, so `run-gates.py` runs it as a declared gate in this layer's own CI and in every checkout that mounts this layer, the content instances that hold journeys among them; it moves into the index's gate set when an instance the index mounts declares a journey",
  },
];

/** {@link OWN_SCRIPT_EXEMPTIONS} plus each present layer's declared `gateExemptions.scripts` (bean `0r7u`). */
export const SCRIPT_EXEMPTIONS: ScriptExemption[] = [
  ...OWN_SCRIPT_EXEMPTIONS,
  ...declaredExemptions().scripts,
];

/** Thrown when the script scan finds nothing — never reported as full coverage. */
export class NoCheckScriptsFound extends Error {
  constructor(path: string) {
    super(
      `${path}: no \`check:\` or \`:check\` scripts were found. That is not ` +
        `full coverage, it is a broken reader — a filter over nothing passes. ` +
        `Fix the scan; do not treat this as green.`,
    );
    this.name = "NoCheckScriptsFound";
  }
}

/** The exemption covering this script, if any. Exact name, never a substring. */
export function scriptExemptionFor(script: string): ScriptExemption | undefined {
  return SCRIPT_EXEMPTIONS.find((e) => e.script === script);
}

/** Every `check:` / `:check` script this repository declares. */
export function checkScriptNames(root: string): string[] {
  const names = Object.keys(scriptsOf(root))
    .filter((n) => n.startsWith("check:") || n.endsWith(":check"))
    .sort();
  if (names.length === 0) throw new NoCheckScriptsFound("package.json");
  return names;
}

/**
 * Does this command invoke that script?
 *
 * The name must end at a token boundary. A substring match would read
 * `bun run cat check:partition` as running `check:partition:edges` — two scripts
 * that differ precisely in that one is the gate and the other is a report —
 * and the ungated one would report as covered.
 */
export function commandRunsScript(command: string, script: string): boolean {
  const escaped = script.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)bun run (?:cat )?${escaped}(\\s|$)`).test(command);
}

/** Every `bun` command any workflow runs, the gate set included. */
export function commandsCiRuns(root: string): string[] {
  const out = gatesFrom(readFileSync(join(root, GATES_WORKFLOW), "utf-8"), { all: true }).map(
    (g) => g.command,
  );
  for (const { step } of otherWorkflowSteps(root)) out.push(step.command);
  return out;
}

/**
 * Check scripts no workflow runs and no exemption covers.
 *
 * **Never empty-by-accident:** {@link checkScriptNames} throws on an empty
 * scan rather than returning `[]`, which would read as total coverage.
 */
export function unrunScripts(root: string): string[] {
  const commands = commandsCiRuns(root);
  return unrunFrom(checkScriptNames(root), commands, SCRIPT_EXEMPTIONS, writersRunBy(commands));
}

/** The commands that run every `QA_WRITERS` entry: `qa:refresh`, and `qa:working-copy`, which runs it. */
const QA_RUNNERS = ["qa:refresh", "qa:working-copy"];

/**
 * The scripts CI runs INDIRECTLY, as `QA_WRITERS` entries of a `qa:refresh`
 * some workflow runs. A baseline writer is usually one of these rather than a
 * step of its own: the stored tree is what `qa:working-copy` builds.
 */
export function writersRunBy(commands: readonly string[]): string[] {
  if (!commands.some((c) => QA_RUNNERS.some((r) => commandRunsScript(c, r)))) return [];
  return QA_WRITERS.map((w) => w.run[0]!).filter(Boolean);
}

/**
 * {@link unrunScripts} over given inputs, pure. A `pending-baseline` exemption
 * covers its check only while some command CI runs invokes its `writer`.
 */
export function unrunFrom(
  names: readonly string[],
  commands: readonly string[],
  exemptions: readonly ScriptExemption[],
  indirect: readonly string[] = [],
): string[] {
  const runs = (script: string) => commands.some((c) => commandRunsScript(c, script));
  const writerRuns = (w: string) => runs(w) || indirect.includes(w);
  return names.filter((n) => {
    if (runs(n)) return false;
    const e = exemptions.find((x) => x.script === n);
    if (!e) return true;
    return e.kind === "pending-baseline" ? !(e.writer && writerRuns(e.writer)) : false;
  });
}

/** Where one `pending-baseline` exemption stands. */
export interface PendingBaseline {
  script: string;
  writer: string;
  followUp: string;
  /** CI runs the writer: the exemption holds. */
  writerRun: boolean;
  /** CI runs the check itself: the wait is over and the exemption can go. */
  checkRun: boolean;
}

/** Every `pending-baseline` exemption, and whether its writer and its check are wired. Pure. */
export function pendingBaselinesFrom(
  commands: readonly string[],
  exemptions: readonly ScriptExemption[],
  indirect: readonly string[] = [],
): PendingBaseline[] {
  const runs = (script: string) => commands.some((c) => commandRunsScript(c, script));
  return exemptions
    .filter((e) => e.kind === "pending-baseline")
    .map((e) => ({
      script: e.script,
      writer: e.writer ?? "",
      followUp: e.followUp ?? "",
      writerRun: !!e.writer && (runs(e.writer) || indirect.includes(e.writer)),
      checkRun: runs(e.script),
    }));
}

/**
 * Print every check waiting on its first baseline. Unconditional, like
 * {@link reportUnresolved}: a wait is a fact about the gate set whether or not
 * the run is green, and an exemption nobody sees is the silent skip this table
 * exists to prevent. A check already wired is printed as done, never failed:
 * the exemption is declared by the index, and failing on it would hold the
 * follow-up hostage to a second change.
 */
function reportPendingBaselines(root: string): void {
  let rows: PendingBaseline[];
  try {
    const commands = commandsCiRuns(root);
    rows = pendingBaselinesFrom(commands, SCRIPT_EXEMPTIONS, writersRunBy(commands));
  } catch {
    return;
  }
  if (rows.length === 0) return;
  console.log(`\n· ${rows.length} check(s) WAITING FOR A FIRST BASELINE — not gated yet, and not counted clean:`);
  for (const r of rows) {
    const state = r.checkRun
      ? "the check is wired now: remove this exemption"
      : r.writerRun
        ? `writer \`${r.writer}\` runs, so main stores the baseline; the check is wired by ${r.followUp}`
        : `writer \`${r.writer}\` is NOT run, so the check is reported unrun`;
    console.log(`    ${r.script}   (${state})`);
  }
}

/**
 * Print the commands the extraction read but cannot run.
 *
 * Unconditional: printed on a green run as well as a red one. A line that
 * appears only when something else is already wrong is a line nobody reads,
 * and the fact being reported — that this tool is not covering a command CI
 * does run — is exactly as true on a clean tree.
 */
function reportUnresolved(root: string, opts: { all?: boolean }): void {
  let skipped: Gate[];
  try {
    skipped = loadUnresolved(root, opts);
  } catch {
    return;
  }
  if (skipped.length === 0) return;
  console.log(
    `\n· ${skipped.length} command(s) COULD NOT BE EXTRACTED — not run, and not counted clean:`,
  );
  for (const g of skipped) console.log(`    ${g.command}   (${g.job} / ${g.step})`);
  console.log(
    `  Each references a shell variable defined on a line this reader discards\n` +
      `  (it keeps \`bun …\` lines only), so running it as written would pass the\n` +
      `  variable's NAME to the script. CI runs these correctly; this tool does not\n` +
      `  run them at all. Bean \`9zok\`.`,
  );
}

/**
 * What to print when the gate set could not be derived.
 *
 * Pure, and exported, for one reason: the CLI's `ROOT` is computed from this
 * file's own location (`repoRootFor(import.meta.dir/..)`), so no spawn test can
 * put it in a tree without workflows — `cd` elsewhere and it still reads this
 * repository's. The decision is therefore separated from the exit so the
 * decision is what gets tested.
 *
 * The wording matters as much as the code: a caller must be able to tell this
 * from a failure, so it says so in as many words rather than leaving the exit
 * code to carry the whole distinction.
 */
export function undeterminedReport(e: unknown, root: string): string[] {
  return [
    `? could not derive the gate set: ${e instanceof Error ? e.message : String(e)}`,
    `  Expected ${GATES_WORKFLOW} relative to ${root}.`,
    "  This is NOT a pass and NOT a failure — no verdict is possible, so nothing here",
    "  may be read as a clean tree. Exit 2.",
  ];
}

/**
 * Run a command, streaming its output AND keeping a copy.
 *
 * `stdio: "inherit"` was here, and the summary could say nothing about WHY a
 * gate failed because nothing was captured — bean `ucb9`. Capturing with
 * `spawnSync` and printing afterwards would have worked and is wrong: `bun
 * test` runs for the best part of a minute, and a contributor watching a
 * blank terminal for that long is a regression traded for a recap.
 *
 * So both. The child's streams are pumped to this process as they arrive,
 * which keeps the live output a reader already relies on, and accumulated so
 * the summary can quote the failing lines back at the end.
 */
async function runTee(cmd: string, args: string[], env?: Record<string, string | undefined>): Promise<{ code: number; output: string }> {
  // input-site: traced #562a3d19 — the gate runner; a check that imports gates.ts to read the gate list runs nothing
  inputSiteReached("gates: runTee spawns a gate");
  const child = Bun.spawn([cmd, ...args], { cwd: ROOT, stdout: "pipe", stderr: "pipe", ...(env ? { env } : {}) });
  const chunks: string[] = [];
  const pump = async (stream: ReadableStream<Uint8Array>, to: NodeJS.WriteStream): Promise<void> => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) {
      const text = decoder.decode(chunk, { stream: true });
      chunks.push(text);
      to.write(text);
    }
  };
  await Promise.all([pump(child.stdout, process.stdout), pump(child.stderr, process.stderr)]);
  return { code: await child.exited, output: chunks.join("") };
}

/**
 * Skipping a gate whose inputs have not changed since it last passed — bean `f017`.
 *
 * ## Why gates may skip at all
 *
 * The merge cycle is `regen` then `gates`, on the same tree. `regen` has just
 * asked every verify/write pair, and `gates` asks each of those checks again —
 * and `skill:register:check` twice in one run, because two CI jobs run it.
 * A check whose DECLARED inputs (`task-io.ts`) hash to what they were when it
 * last passed cannot answer differently, so asking again buys nothing.
 *
 * ## What may be skipped, and what never is
 *
 * Only a gate that is exactly `bun run <script>` whose script declares
 * `inputs`, and only when the input-hash cache holds a hash for THAT SCRIPT
 * equal to its fingerprint now — recorded by a real run that exited 0 (by
 * `gates`, or by `regen`'s check). Everything else runs: undeclared scripts,
 * inputs that cannot be determined, a moved `--against` baseline, `CI`, or
 * `--no-cache`. A skipped gate is reported as SKIPPED, by name and with its
 * reason, and counted apart from the gates that passed — never as a pass.
 *
 * ## Recording
 *
 * A gate's hash is recorded only when it exited 0 AND its fingerprint was the
 * same just before and just after it ran (`recordCheckRun`): a gate whose
 * inputs moved while it read them — a writer, a person editing, the gate
 * itself — records nothing.
 *
 * **The falsifier** is a script that reads something its declaration does not
 * name; `task-io.ts` carries the rule (declare by reading, `{tracked}` for
 * whole-tree walkers, nothing for environment, network or clock readers).
 */
export class GateSkipper {
  private readonly touched = new Set<string>();
  constructor(
    private readonly root: string,
    private readonly scripts: Readonly<Record<string, string>>,
    /** `undefined`: the cache is off (`--no-cache`, `CI`) — nothing is skipped or recorded. */
    readonly cache: HashCache | undefined,
    private readonly baseline: BaselineResolver | undefined,
    private readonly ioOf: (script: string) => PairIO | undefined = pairIO,
  ) {}

  /** The script a gate runs, when it is exactly one script that declares its inputs. */
  scriptOf(command: string): string | undefined {
    const m = /^bun run (?:cat )?([A-Za-z0-9:_-]+)\s*$/.exec(command.trim());
    if (m === null) return undefined;
    return this.ioOf(m[1]!)?.inputs === undefined ? undefined : m[1]!;
  }

  /** The script's fingerprint over `digests` (fresh per moment: before, after). */
  fingerprint(script: string, digests: FileDigests): Fingerprint {
    return checkFingerprint(this.root, this.scripts, script, this.ioOf(script), digests, this.baseline);
  }

  /** Whether to skip `command` now; `fp` is what to hand {@link GateSkipper.record} if it runs. */
  decide(command: string, digests: FileDigests): (SkipDecision & { script: string; fp: Fingerprint }) | undefined {
    if (this.cache === undefined) return undefined;
    const script = this.scriptOf(command);
    if (script === undefined) return undefined;
    const fp = this.fingerprint(script, digests);
    return { ...decideCheck(this.cache, script, fp), script, fp };
  }

  /** Record (or forget) one run, comparing the fingerprint before it with one after it. */
  record(script: string, passed: boolean, before: Fingerprint, digestsAfter: FileDigests): void {
    if (this.cache === undefined) return;
    recordCheckRun(this.cache, script, passed, before, this.fingerprint(script, digestsAfter));
    this.touched.add(script);
  }

  /**
   * Write what this run learned, over whatever is on disk NOW — `regen` may
   * have recorded since this run loaded the cache. Only scripts this run ran
   * are touched; every other entry is left as it is on disk.
   */
  save(): void {
    if (this.cache === undefined || this.touched.size === 0) return;
    const disk = loadCache(this.root);
    disk.checks ??= {};
    for (const s of this.touched) {
      const h = this.cache.checks?.[s];
      if (h === undefined) delete disk.checks[s];
      else disk.checks[s] = h;
    }
    saveCache(this.root, disk);
  }
}

/** A run of consecutive gates: either all read-only (may share the pool) or one that runs alone. */
export interface GateSegment {
  parallel: boolean;
  gates: Gate[];
}

/**
 * Split the gate list, in order, into maximal runs of read-only gates and
 * single serial gates — bean `xpcu`.
 *
 * Order across segments is the workflow's: a writing gate is never moved
 * ahead of or behind a reader, so whatever it repairs, a later reader sees
 * repaired exactly as it did serially (and the tree guard still names it).
 */
export function gateSegments(gates: readonly Gate[], readsOnly: (g: Gate) => boolean): GateSegment[] {
  const out: GateSegment[] = [];
  for (const g of gates) {
    const ro = readsOnly(g);
    const last = out[out.length - 1];
    if (ro && last?.parallel) last.gates.push(g);
    else out.push({ parallel: ro, gates: [g] });
  }
  return out;
}

/**
 * The lines from a failed gate's output worth repeating in the summary.
 *
 * NOT a `bun test` parser. Several shapes matter and each names a different
 * kind of drift, so the patterns are listed rather than one runner being
 * special-cased:
 *
 *   `(fail) <name>`   a test, by name — the shape that started this
 *   `✗ …` / `✘ …`     what most `*:check` scripts print
 *   `error: …`        a script that threw
 *
 * Capped, because a gate can fail in hundreds of places and a summary that
 * reprints all of them is the scrollback it was meant to replace. The cap is
 * reported rather than silent: "and N more" is a different statement from
 * showing everything, and a reader who sees the first is told to scroll.
 *
 * Returns EMPTY when nothing matched, and the caller says so out loud rather
 * than printing the gate alone as though there were nothing to say. An
 * unrecognised shape is not an absence of one — the same rule the rest of
 * this repository applies to could-not-determine.
 */
export function salientFailures(output: string, cap = 6): string[] {
  const shapes = [
    /^\(fail\)\s/,
    /^\s*(✗|✘)\s/,
    /^error:\s/i,
  ];
  const hits: string[] = [];
  const seen = new Set<string>();
  for (const raw of output.split("\n")) {
    const line = raw.replace(/\u001b\[[0-9;]*m/g, "").trimEnd();
    if (!shapes.some((re) => re.test(line))) continue;
    const t = line.trim();
    // A gate that fails a hundred files prints the same shape a hundred
    // times; the SUMMARY wants the distinct ones.
    if (seen.has(t)) continue;
    seen.add(t);
    hits.push(t.length > 160 ? `${t.slice(0, 157)}…` : t);
    if (hits.length === cap) {
      hits.push(`…and more — scroll up for this gate's full output`);
      break;
    }
  }
  return hits;
}

/**
 * `--report <path>`: where to write the typed report, if anywhere (#1259,
 * owner card Q-DS-14 A). The text and the exit code are unchanged by it.
 */
export function reportPathFrom(argv: readonly string[]): string | undefined {
  const i = argv.indexOf("--report");
  if (i < 0) return undefined;
  const p = argv[i + 1];
  if (p === undefined || p.startsWith("--")) throw new Error("--report needs a path");
  return p;
}

/** Every `--except <command>` value, in order. A flag with no value is refused. */
export function exceptFrom(argv: readonly string[]): string[] {
  const out: string[] = [];
  argv.forEach((a, i) => {
    if (a !== "--except") return;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error("--except needs a gate command");
    out.push(v);
  });
  return out;
}

/** An empty report for a run of the fast or whole set, filled in as the run goes. */
export function startGatesReport(all: boolean): GatesReport {
  return {
    $schema: GATES_REPORT_SCHEMA,
    outcome: "undetermined",
    exitCode: 2,
    set: all ? "whole" : "fast",
    gates: 0,
    writers: 0,
    failed: [],
    skipped: [],
    mutatedBy: [],
    undetermined: [],
    unclassified: [],
    unrun: [],
  };
}

/**
 * The report as the process exits with `code`. The exit code is the verdict
 * and is never re-derived; `outcome` only names it, and tells the two exit-1
 * cases apart. A code outside 0–2 (a crash) is `undetermined`, exit 2 in the
 * report, because nothing it carries was decided.
 */
export function finishGatesReport(report: GatesReport, code: number): GatesReport {
  const exitCode: 0 | 1 | 2 = code === 0 ? 0 : code === 1 ? 1 : 2;
  if (exitCode === 1 && report.failed.length === 0 && report.mutatedBy.length === 0) {
    // Exit 1 with no failed gate and no mutation recorded: the run stopped
    // (an uncaught error) before it reached a verdict. Not a pass, and not a
    // gate failure either, so it is reported as undetermined, with the code.
    return GatesReportSchema.parse({
      ...report,
      exitCode,
      outcome: "undetermined",
      undetermined: [...report.undetermined, "exited 1 before any verdict: no gate was recorded as failing"],
    });
  }
  const outcome: GatesReport["outcome"] =
    exitCode === 0 ? "pass" : exitCode === 2 ? "undetermined" : report.failed.length === 0 ? "not-clean" : "fail";
  return GatesReportSchema.parse({ ...report, exitCode, outcome });
}

/**
 * The scripts {@link SCRIPT_EXEMPTIONS} declares `kind: "report"`, as `{script: reason}`:
 * what `run-gates.py` asks (`--report-scripts`), so its skip is this table and
 * not a copy of it that can drift (check:draft-beans ran as a gate in INDEX mode).
 */
export function reportScripts(exemptions: readonly ScriptExemption[] = SCRIPT_EXEMPTIONS): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of exemptions) if (e.kind === "report") out[e.script] = e.reason;
  return out;
}

if (import.meta.main) {
  if (process.argv.includes("--report-scripts")) {
    console.log(JSON.stringify(reportScripts()));
    process.exit(0);
  }
  // Compile-gates query / run
  if (process.argv.includes("--compile-gates-list")) {
    console.log("Declared Content Compile Gates:");
    for (const g of CONTENT_COMPILE_GATES) {
      console.log(`  [${g.id}] ${g.name} (${g.blocking ? "BLOCKING" : "advisory"}) — ${g.description}`);
    }
    process.exit(0);
  }
  if (process.argv.includes("--compile-gates")) {
    const rawPaths = process.argv.slice(2).filter((a) => !a.startsWith("--"));
    const triggered = compileGatesForPaths(rawPaths);
    console.log(`Triggered ${triggered.length} compile gate(s) for ${rawPaths.length} path(s):`);
    for (const g of triggered) {
      console.log(`  [${g.id}] ${g.name} (${g.blocking ? "BLOCKING" : "advisory"})`);
    }
    const evalResult = await evaluateCompileGates(rawPaths);
    for (const ev of evalResult.evaluations) {
      const icon = ev.status === "pass" ? "✓" : ev.blocked ? "✗" : "⚠️";
      console.log(`${icon} [${ev.gateId}] ${ev.name}: ${ev.summary}`);
    }
    process.exit(evalResult.blocked ? 1 : 0);
  }

  // `await` below — the gate loop tees each child's output (bean `ucb9`).
  const all = process.argv.includes("--all");
  const listOnly = process.argv.includes("--list");
  const jobs = jobsFromArgv(process.argv);

  // The typed report (#1259, Q-DS-14 A): filled in as the run goes and written
  // on whatever path the process exits by, so an exit 2 is reported as surely
  // as a pass. `--list` runs nothing, so it writes nothing.
  const reportPath = reportPathFrom(process.argv);
  const report = startGatesReport(all);
  if (reportPath && !listOnly) {
    process.on("exit", (code) => {
      writeFileSync(reportPath, JSON.stringify(finishGatesReport(report, code), null, 2) + "\n");
    });
  }

  // ── The third state (bean `6366`) ──────────────────────────────────────
  //
  // Until now this exited 0 or 1 only, so "every gate passed" and "I could not
  // work out what the gates ARE" were the same answer. They are not.
  //
  // `loadGates` was ALREADY right about this and says so in its own message —
  // "no gate commands were extracted. That is not a clean sweep, it is a broken
  // reader" — and it throws for both shapes: the workflow file absent, and the
  // file present but yielding nothing. The defect was here, in the CLI, which
  // let that throw escape as an uncaught exception and so reported a
  // could-not-determine as exit **1**, indistinguishable from a real failure.
  //
  // So this block adds no detection. It translates a refusal the library already
  // makes into the exit code the third-state rule requires, and there is
  // deliberately NO `gates.length === 0` branch underneath it: that check cannot
  // fire, because `loadGates` throws first. A guard that cannot fire is the
  // `build-glossary` dead-guard defect, which reads as protection and is not.
  //
  // Note what is NOT exit 2. UNCLASSIFIED and UNRUN below are *determined*
  // findings — the set is known and every member is named — so they stay a loud
  // report at the existing exit codes. "I know exactly which steps are missing"
  // is not "I could not tell".
  let gates: Gate[];
  try {
    gates = loadGates(ROOT, { all });
  } catch (e) {
    for (const line of undeterminedReport(e, ROOT)) console.error(line);
    report.undetermined.push(...undeterminedReport(e, ROOT));
    process.exit(2);
  }
  // `--except <command>` (repeatable): hold a gate out of this run by its
  // exact command, as the pre-push hook does with the whole-suite `bun test`
  // (owner, 2026-11-05). It is named in the report and the text, never
  // dropped silently. One that names no gate of this set holds nothing out
  // and is said so: a content root's set has no `bun test`, and the hook
  // passes the same flag everywhere.
  const asked = exceptFrom(process.argv);
  const except = asked.filter((c) => gates.some((g) => g.command === c));
  for (const c of asked.filter((x) => !except.includes(x))) console.log(`--except \`${c}\`: no gate of this set has that command, so nothing was held out for it`);
  if (except.length > 0) {
    gates = gates.filter((g) => !except.includes(g.command));
    report.heldOut = [...except];
    console.log(`HELD OUT (--except), CI runs them: ${except.map((c) => `\`${c}\``).join(", ")}\n`);
  }
  report.gates = gates.length;
  report.commands = gates.map((g) => g.command);

  // ── Is the ENVIRONMENT fit to be read from? (bean `3vc1`) ──────────────
  //
  // Asked BEFORE any gate runs, and it refuses the whole set rather than
  // reddening one, because 168 results computed against a filesystem that
  // disagrees with the repository are worse than no results: they look like
  // evidence. Measured 2026-09-26 — a nested `bun install` under
  // `adapters/mcp-server` takes root `tsc --noEmit` from 0 errors to 12 across
  // 6 files with NO source change, and CI on the identical commit is green.
  //
  // Exit 2, never 1, and that distinction is the whole point (`nytj`): nothing
  // it reports is a finding about this repository's source. The third state has
  // to be reachable from here or the reading is indistinguishable from a real
  // red — which is `1xhc`'s subject, and the reason this refusal is not a
  // warning that scrolls past.
  //
  // It is a PRECONDITION rather than one of the gates because CI installs only
  // from the repository root, so the condition cannot arise there: a workflow
  // step would be a gate that can never fire, which reads as protection and is
  // not. `SCRIPT_EXEMPTIONS` carries that reason for `check:unrun-scripts`.
  const distorted = distortions(ROOT);
  if (distorted.length > 0) {
    console.error("REFUSING TO RUN — this checkout's environment is distorted.\n");
    for (const d of distorted) {
      console.error(`  ✗ ${d.path}`);
      console.error(`      ${d.effect}`);
      console.error(`      measured on bean \`${d.bean}\``);
    }
    console.error(
      "\nNo gate ran. A gate set read now would report this repository's source\n" +
        "incorrectly, and a wrong red costs more than a missing one — it sends the\n" +
        "next hour to the wrong file. Move the residue aside and re-run.\n" +
        "\nFor a nested install this is a TRAP and not a mistake: regenerating a\n" +
        "nested lockfile REQUIRES `bun install` in that directory, so doing the\n" +
        "correct thing is what created this. `bun run cat check:environment` alone\n" +
        "reports the same thing without running any gate.",
    );
    report.undetermined.push(...distorted.map((d) => `environment distorted: ${d.path} — ${d.effect}`));
    process.exit(2);
  }

  // ── Is there a QA working copy to judge? (bean `72a8`) ─────────────────
  //
  // After `5hox` the derived QA results are no longer committed: their record
  // is the `qa-reports` branch and a checkout's `test/results/` is
  // `.gitignore`d. Gates that READ that tree then exit 2 on a fresh clone —
  // correctly, they could not determine — and a whole local run reports
  // "could not determine" for a reason nobody's change caused. So the tree is
  // PRODUCED first, exactly as CI produces it before its gates: the external
  // bootstrap export, then `qa:refresh`, which runs every declared QA writer.
  // Only when the copy is not CURRENT (bean `7how`): its stamp names the tree
  // it was built from, so a copy built from this tree is not rebuilt — the
  // `gates` that follows a `regen` costs nothing here — while one built from
  // another tree, or edited since, is. "Present" was the test until
  // 2026-10-06, and a present-but-stale copy was judged as current.
  //
  // Not for `--list`, which promises to run nothing (bean `61tg`, measured
  // 2026-10-24): producing the copy wrote `test/results/` into five mounted
  // layers (549 files in cat-harness alone), and on a mount that cannot be
  // re-cloned, such as an air-gapped one, `mount:remote:check` then reports
  // those layers as modified. The list says what state the copy is in instead.
  const qaRoots = movedRoots(ROOT);
  const qaCopy = workingCopyState(ROOT);
  if (listOnly && qaRoots.length > 0 && qaCopy.state !== "current") {
    console.log(`QA working copy is ${qaCopy.state} (${qaCopy.why}); --list does not produce it. A gate run would, first.\n`);
  } else if (qaRoots.length > 0 && qaCopy.state !== "current") {
    console.log(`QA working copy is ${qaCopy.state} (${qaCopy.why}) — producing it first, as CI does:\n`);
    for (const cmd of [["bun", "run", "cat", "qa:working-copy"]]) {
      console.log(`$ ${cmd.join(" ")}`);
      const r = spawnSync(cmd[0]!, cmd.slice(1), { cwd: ROOT, stdio: "inherit" });
      if (r.status !== 0) {
        console.error(
          `\nREFUSING TO RUN — \`${cmd.slice(1).join(" ")}\` exited ${r.status ?? "on a signal"}, so there is no QA ` +
            "working copy, and every gate that reads one would report could-not-determine. Fix that first, or " +
            "materialise a published entry with `bun run cat qa:fetch --ref main`.",
        );
        report.undetermined.push(`no QA working copy: \`${cmd.slice(1).join(" ")}\` exited ${r.status ?? "on a signal"}`);
        process.exit(2);
      }
    }
    console.log("");
  }

  // Declared writers in the workflow (`isWriterStep`): not gates, so not in
  // the pool or the tree guard's accounting; run after every gate, as CI does.
  const writers = loadWriterSteps(ROOT, { all });
  report.writers = writers.length;

  const scope = all
    ? "every job, plus every locally-runnable step from the other workflows"
    : `the fast set (every job that does not install a browser)`;
  console.log(
    `${gates.length} gate(s) — ${scope}` +
      (writers.length ? `; then ${writers.length} declared writer(s), after them` : "") +
      "\n",
  );

  // Reported on EVERY run, not only with `--list`: an unclassified step is a
  // check CI runs and this does not, and the whole cost of that gap was
  // learning about it from a red PR instead of from here.
  const unclassified = unclassifiedSteps(ROOT);
  report.unclassified = unclassified.map((u) => ({ file: u.file, command: u.step.command }));
  if (unclassified.length) {
    console.log("UNCLASSIFIED — CI runs these and the local set does not:");
    for (const u of unclassified) console.log(`  ? ${u.file}: ${u.step.command}`);
    console.log("  Add each to the gate set, or to STEP_EXEMPTIONS with a reason.\n");
  }

  // The other direction, and reported just as loudly: a check script no
  // workflow runs is a gate that cannot fail. `translate-kg-viewer:check` was
  // red on main while CI was green, because nothing ran it (bean `ot9a`).
  const unrun = unrunScripts(ROOT);
  report.unrun = [...unrun];
  if (unrun.length) {
    console.log("UNRUN — declared in package.json and in NO workflow:");
    for (const u of unrun) console.log(`  ? bun run cat ${u}`);
    console.log("  Wire each into a workflow, or add it to SCRIPT_EXEMPTIONS with a reason.\n");
  }

  if (listOnly) {
    for (const g of gates) console.log(`  ${g.command.padEnd(52)} ${g.step}`);
    if (writers.length) {
      console.log(`\nWRITERS — ${writers.length} step(s) declaring \`@covers none — writer\`; run AFTER every gate, one at a time, as CI runs them last:`);
      for (const g of writers) console.log(`  ${g.command.padEnd(52)} ${g.step}`);
    }
    // `--list` is where somebody goes to learn what this tool covers, so the
    // commands it will NOT run belong here most of all. Omitting them would
    // make the list read as the whole gate set.
    reportUnresolved(ROOT, { all });
    reportPendingBaselines(ROOT);
    console.log(
      all ? "" : "\n`--all` adds the jobs that need a browser (bpmn-js renders through Chromium).",
    );
    process.exit(0);
  }

  // ── Which gate changed the repository (bean `ymsu`) ────────────────────
  //
  // Snapshot the working tree between gates, so a gate that writes to the tree
  // it is being judged on is attributed to ITSELF rather than discovered later
  // as a mystery dirty file. `gate-tree-guard.ts` carries why this can only
  // live here — no gate can observe what another gate did, which is the
  // definition of the blind spot — and why the predicate is a per-gate DELTA
  // rather than "the tree is dirty", since running gates on your own
  // uncommitted work is the normal case.
  //
  // A failure to read the tree is carried as `undetermined` and reported, not
  // thrown: `gates` has to stay runnable where the question cannot be asked.
  const baseline = readTree(ROOT);
  let seen: ReadonlyMap<string, string> | undefined = baseline.ok ? baseline.entries : undefined;
  const undetermined: string[] = baseline.ok ? [] : formatUndetermined(baseline.why);
  const mutations: GateMutation[] = [];
  // When each gate ran, so a changed path's mtime can say who was running
  // when it was written — the only thing that tells a pooled gate's write
  // from its batch-mates', or from an edit made between gates (bean `v3nf`).
  const windows: GateWindow[] = [];

  // ── Read-only gates run in a pool (bean `xpcu`) ────────────────────────
  //
  // A gate whose script DECLARES `outputs: []` in `task-io.ts` only reads, so a
  // run of consecutive such gates goes to a worker pool and its output is
  // buffered and printed in workflow order. Every other gate — undeclared, or
  // declared as writing — runs alone and streams live, exactly as before, and
  // is a barrier: nothing after it starts until it is done. So `bun test`,
  // which writes, still runs by itself and still has its writes attributed to
  // it by the tree guard below.
  //
  // The tree is snapshotted per SEGMENT. A serial gate's segment is the gate,
  // so attribution is as exact as it was. A read-only batch that changed the
  // tree is attributed to the batch, named in full: that is a declaration that
  // turned out false, and `--jobs 1` re-runs everything one at a time to pin it.
  // Each changed path also carries the gates that were RUNNING when it was
  // written (its mtime against each gate's window), which usually pins it
  // without the re-run, and names a write made while no gate ran as outside.
  const segments = gateSegments(gates, (g) => gateReadsOnly(g.command));
  const failed: { gate: Gate; why: string[] }[] = [];
  const t0 = performance.now();
  const parallelCount = segments.filter((s) => s.parallel).reduce((n, s) => n + s.gates.length, 0);

  // ── Input-hash skipping (bean `f017`) — see `GateSkipper` ──────────────
  const useCache = cacheEnabled(process.argv, process.env);
  const pkgScripts =
    scriptsOf(ROOT);
  const skipper = new GateSkipper(
    ROOT,
    pkgScripts,
    useCache ? loadCache(ROOT) : undefined,
    qaBaselineIdentity({ repoRoot: ROOT }),
  );
  const skippedGates: { gate: Gate; why: string }[] = [];
  console.log(
    `${jobs} worker(s): ${parallelCount} read-only gate(s) run in parallel, ` +
      `${gates.length - parallelCount} one at a time (undeclared or writing); ` +
      `input-hash skip ${useCache ? "ON" : "OFF (--no-cache or CI)"}\n`,
  );
  /** Decide each gate of a run-list now; the skipped ones are reported, the rest returned with their "before" fingerprints. */
  const triage = (list: readonly Gate[]): { gate: Gate; script?: string; fp?: Fingerprint }[] => {
    const digests = new FileDigests(ROOT);
    const out: { gate: Gate; script?: string; fp?: Fingerprint }[] = [];
    for (const g of list) {
      const d = skipper.decide(g.command, digests);
      if (d?.skip === true) {
        process.stdout.write(`▸ ${g.command}   SKIPPED — ${d.why}\n`);
        skippedGates.push({ gate: g, why: d.why });
        continue;
      }
      out.push(d === undefined ? { gate: g } : { gate: g, script: d.script, fp: d.fp });
    }
    return out;
  };
  const setupOnce = new SetupOnce();
  for (const seg of segments) {
    if (!seg.parallel || jobs === 1) {
      for (const g of seg.gates) {
        const once = setupOnce.ranAlready(g.command);
        if (once !== undefined) {
          process.stdout.write(`▸ ${g.command}   SKIPPED — setup, run once per local run (exit ${once} above; bean cat-tools-sm8r)\n`);
          continue;
        }
        // One at a time, so a gate's "before" is taken after the gate ahead of
        // it ran — the second `skill:register:check` sees the first's record.
        const [t] = triage([g]);
        if (t === undefined) continue;
        process.stdout.write(`▸ ${g.command}\n`);
        const [cmd, ...args] = g.command.split(/\s+/);
        const started = performance.now();
        const trace = t.script !== undefined ? openTrace(ROOT) : undefined;
        const wStart = Date.now();
        const r = await runTee(cmd!, args, trace?.env);
        windows.push({ gate: g.command, start: wStart, end: Date.now() });
        // Timed like the parallel lines, so a slow serial gate is visible in
        // the log rather than inferred from the total.
        process.stdout.write(`  ↳ ${((performance.now() - started) / 1000).toFixed(1)}s, exit ${r.code}: ${g.command}\n`);
        if (r.code !== 0) failed.push({ gate: g, why: salientFailures(r.output) });
        setupOnce.record(g.command, r.code);
        if (t.script !== undefined && t.fp !== undefined) {
          skipper.record(t.script, r.code === 0 && !tracedReport(t.script, trace?.reached(againstRefsOf(pkgScripts, t.script))), t.fp, new FileDigests(ROOT));
        }
        seen = snapshot(seen, g.command);
      }
      continue;
    }
    const run = triage(seg.gates);
    const traces = run.map((t) => (t.script !== undefined ? openTrace(ROOT) : undefined));
    const codes: number[] = [];
    const emitter = orderedEmitter<{ code: number; output: string; ms: number }>((i, r) => {
      const g = run[i]!.gate;
      codes[i] = r.code;
      process.stdout.write(`▸ ${g.command}   (${(r.ms / 1000).toFixed(1)}s, parallel)\n`);
      process.stdout.write(r.output);
      if (r.code !== 0) failed.push({ gate: g, why: salientFailures(r.output) });
    });
    await runPool(
      run.map(({ gate: g }, i) => ({
        id: g.command,
        outputs: [],
        run: async () => {
          const start = Date.now();
          try {
            return await runCaptured(g.command.split(/\s+/), ROOT, traces[i]?.env);
          } finally {
            windows.push({ gate: g.command, start, end: Date.now() });
          }
        },
      })),
      jobs,
      (i, r) => emitter.push(i, r),
    );
    // "After" for the whole batch: a gate's inputs moving under ANY member of
    // it means its fingerprints disagree, and it records nothing.
    const after = new FileDigests(ROOT);
    run.forEach((t, i) => {
      if (t.script !== undefined && t.fp !== undefined) {
        skipper.record(t.script, codes[i] === 0 && !tracedReport(t.script, traces[i]?.reached(againstRefsOf(pkgScripts, t.script))), t.fp, after);
      }
    });
    seen = snapshot(seen, `one of the parallel read-only gates: ${run.map((t) => t.gate.command).join(", ")}`);
  }
  skipper.save();
  console.log(`\n(${((performance.now() - t0) / 1000).toFixed(0)}s wall for the gate run)`);

  // ── Declared writers, AFTER every gate (`isWriterStep`) ────────────────
  //
  // CI runs them last in their job so that they rewrite nothing a gate judges;
  // here they run after the whole set for the same reason, one at a time and
  // never in the pool. Their writes are their purpose, so the tree guard does
  // not snapshot them: attributing a projection rewrite to them would report
  // the run NOT clean for doing what they are for. A writer that FAILS is red,
  // which is the one thing CI asks of them.
  if (writers.length) {
    console.log(`\n${writers.length} declared writer(s), after the gates — their writes are not gate mutations:\n`);
    for (const g of writers) {
      process.stdout.write(`▸ ${g.command}   (writer)\n`);
      const [cmd, ...args] = g.command.split(/\s+/);
      const started = performance.now();
      const r = await runTee(cmd!, args);
      process.stdout.write(`  ↳ ${((performance.now() - started) / 1000).toFixed(1)}s, exit ${r.code}: ${g.command}\n`);
      if (r.code !== 0) failed.push({ gate: g, why: salientFailures(r.output) });
    }
  }

  /** A run that reached a `traced` input site records nothing (`input-trace.ts`); say so. */
  function tracedReport(script: string, reached: string | undefined): boolean {
    if (reached === undefined) return false;
    process.stdout.write(`  (${script} reached a traced input site — ${reached} — so its pass is not recorded for skipping)\n`);
    return true;
  }

  /** Compare the tree with the last snapshot and attribute any change to `who`. */
  function snapshot(prev: ReadonlyMap<string, string> | undefined, who: string): ReadonlyMap<string, string> | undefined {
    if (prev === undefined) return undefined;
    const now = readTree(ROOT);
    if (!now.ok) {
      // The baseline read fine and this one did not, so the question stops
      // being answerable PART WAY THROUGH. Reported with the gate it stopped
      // at, and the comparison is abandoned rather than continued against a
      // snapshot that is now of unknown age.
      undetermined.push(...formatUndetermined(`${now.why} (after \`${who}\`)`));
      return undefined;
    }
    const changes = diffReadings(prev, now.entries);
    if (changes.length > 0) mutations.push({ gate: who, changes, attribution: attributeChanges(ROOT, changes, windows) });
    return now.entries;
  }

  report.failed = failed.map(({ gate, why }) => ({ command: gate.command, job: gate.job, step: gate.step, why }));
  report.skipped = skippedGates.map(({ gate, why }) => ({ command: gate.command, why }));
  report.mutatedBy = mutations.map((m) => m.gate);
  report.undetermined = [...undetermined];

  console.log("");
  for (const line of undetermined) console.log(line);
  if (undetermined.length) console.log("");
  const mutationReport = formatMutations(mutations);
  for (const line of mutationReport) console.log(line);
  if (mutationReport.length) console.log("");
  if (failed.length === 0) {
    // Every gate passed AND nothing moved underneath them. Only this pair earns
    // the clean line.
    if (mutations.length === 0) {
      if (skippedGates.length === 0) {
        console.log(`✓ ${gates.length} gate(s) pass — the ${all ? "whole" : "fast"} set.`);
      } else {
        // Never folded into the pass count (bean `f017`): a skipped gate was
        // not asked. Its inputs hash to a run that passed, which is a
        // different statement, and the reader is told which gates it covers.
        console.log(
          `✓ ${gates.length - skippedGates.length} gate(s) pass and ${skippedGates.length} were SKIPPED — ` +
            `the ${all ? "whole" : "fast"} set.`,
        );
        console.log(
          "  Skipped: inputs unchanged since each last passed (input-hash cache; `--no-cache` asks them):",
        );
        for (const { gate } of skippedGates) console.log(`    - ${gate.command}`);
      }
      reportUnresolved(ROOT, { all });
      reportPendingBaselines(ROOT);
      if (!all) console.log("  `bun run cat gates --all` adds the browser jobs before you push.");
      process.exit(0);
    }
    // `152 gate(s) pass` is TRUE here and it is the wrong thing to print: the
    // gates that ran after the mutation were handed a repaired tree, so their
    // passing is a verdict about a state the repository does not contain. The
    // whole of bean `ymsu` is that this sentence was printed anyway, 152 times
    // out of 152, over a value nobody had committed.
    console.log(
      `✗ every gate passed, and the run is NOT clean — ${mutations.length} gate(s) changed the tree.`,
    );
    console.log(
      `  ${gates.length} verdict(s) above were reached against a tree that a gate had already`,
    );
    console.log(
      `  repaired, so the later ones describe a state you have not committed. Details above.`,
    );
    process.exit(1);
  }
  reportUnresolved(ROOT, { all });
  reportPendingBaselines(ROOT);
  if (skippedGates.length > 0) {
    console.log(`  (${skippedGates.length} gate(s) SKIPPED — inputs unchanged since each last passed; \`--no-cache\` asks them)`);
  }
  console.log(`✗ ${failed.length} of ${gates.length + writers.length} failed:`);
  for (const { gate, why } of failed) {
    console.log(`  · ${gate.command}   (${gate.job} / ${gate.step})`);
    // The whole point of bean `ucb9`. Without these lines a gate that is
    // ALREADY red for a reason you know stays byte-identical when a second
    // failure joins it, and red -> red-for-a-new-reason is invisible where
    // green -> red is loud. The invisible transition is the one that reaches
    // CI: it did, on bean `7yvd`, 2026-09-20.
    for (const line of why) console.log(`      ${line}`);
  }
  if (failed.some(({ why }) => why.length === 0)) {
    console.log(
      `\n  A gate with no lines quoted above printed nothing this tool recognised as a\n` +
        `  failure. Scroll up and read its output — an unrecognised shape is not an\n` +
        `  absence of one.`,
    );
  }
  process.exit(1);
}
