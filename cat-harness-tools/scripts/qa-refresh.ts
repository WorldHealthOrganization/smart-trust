#!/usr/bin/env bun
/**
 * qa-refresh — produce the QA working copy that `qa-publish` stores, and say
 * whether it is complete.
 *
 * `qa:publish` stores whatever the checkout holds under the declared `qa`
 * directories. Where `test/results/` is not committed, a fresh CI checkout
 * holds almost nothing there, so the writers must run before publishing.
 *
 * ## The publish job runs the writers
 *
 * Every gate over the `qa` graph is in JUDGE mode: it computes, judges and
 * **writes nothing** (`gates.ts`' tree guard reports a read-only gate that
 * writes), so the gates job has no working copy to hand over. Making gates
 * write would put the writers on the critical path of every PR and of every
 * local `bun run cat gates`. So the writers run here, in `qa-publish`, which
 * is not a gate and runs after the gates whatever they concluded — the same
 * commit and the same producers, so what it stores is what the gates judged,
 * recomputed.
 *
 * ## The writers are DECLARED, and the declaration is checked on every run
 *
 * {@link QA_WRITERS} says which command writes which part of the tree. After
 * every computed run, over the real tree:
 *
 * - a file **no** writer claims is `unclaimed`: something wrote where the
 *   declaration does not look, and the record's provenance is unknown;
 * - a writer whose families hold **no** file is `empty`: it ran and produced
 *   nothing, or did not run;
 * - a writer that exits outside its `okExits` is `failed`.
 *
 * Any of the three makes the run INCOMPLETE (exit 1), and `qa:publish
 * --completeness` refuses an incomplete report. A partial entry is never
 * stored as if it were whole.
 *
 * ## Modes, decided per writer
 *
 * Each writer is decided ON ITS OWN DECLARED PATHS, so one family can be
 * untracked while others stay tracked:
 *
 * - **tracked** — every writer's declared paths are still tracked. Nothing is
 *   run: the commit's own copy IS the record, and `main/<sha>` must be
 *   byte-identical to it (`qa:verify-moved`).
 * - **computed** — nothing is tracked there. Every writer runs, in order,
 *   into the working copy.
 * - **mixed** — some writers' paths are tracked and some are not. Unbacked, a
 *   writer runs; backed, the commit's copy is its record and it does not.
 *
 * In `mixed`, `empty` and `failed` are judged over EVERY writer (a backed
 * writer's family holding no file means the commit's copy is missing it), but
 * `unclaimed` only over files NOT tracked: a tracked file's provenance is the
 * commit that carries it.
 *
 * Usage:
 *   bun run cat qa:refresh [--report FILE] [--json]   # run (computed) or account (tracked); write the report
 *   bun run cat qa:refresh --github --report FILE     # CI: skip, with a notice, where qa:publish would skip
 *   bun run cat qa:refresh --list                     # the declared writers, in order; runs nothing
 *
 * Exit: 0 complete · 1 incomplete · 2 could not determine (no declaration, not a checkout).
 *
 * @module scripts/qa-refresh
 * @covers qa
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import { githubPublishDecision, QaUsageError, REFRESH_SCHEMA, refreshReportComplete } from "./qa-store.ts";
import { movedInventory, movedRoots, type MovedInventory } from "./qa-verify-moved.ts";
import { BUILDING_ENV } from "./qa-working-copy.ts";
import { TEST_RUN_WRITERS } from "./test-run-compute.ts";
import { mountedInstanceRoots } from "../schemas/kg/remote-mount.ts";
import { artefactStub, layerRootsIn, kgQaHomeFor, readDeclaration } from "../schemas/kg/cat-harness.ts";
import { scriptsOf, scriptTable } from "../schemas/sdlc/script-table.ts";
import { coneMode, QaCone, straceWorks } from "./qa-cone.ts";
import { HARNESS_ROOT, REPO_ROOT } from "./lib/roots.ts";
import { rootProfile, type RootProfile } from "./lib/root-gate-set.ts";
import { NOT_APPLICABLE_EXIT, NOT_APPLICABLE_REASON_ENV } from "./lib/not-applicable.ts";
import { stateMountedDirs } from "./mount-from-lock.ts";
import { writePathOf } from "./lib/layer-output.ts";

export { REFRESH_SCHEMA, refreshReportComplete };
export const REFRESH_EXIT = { complete: 0, incomplete: 1, unknown: 2 } as const;

/** One producer of part of the `qa` tree. */
export interface QaWriter {
  /** Stable id: the npm script it runs where there is one. */
  id: string;
  /**
   * `bun run` arguments, from the repository root — an npm script name or a
   * script path, then its flags. `external` for a family another step of the
   * same job writes; it is still checked for files.
   */
  run: readonly string[] | "external";
  /**
   * An `external` family written only AFTER the site is published, so a
   * pre-publish refresh finds it absent and must not call it empty. Every
   * other external writer is still checked for files: its step runs earlier
   * in the same job, and an empty family there means that step broke.
   */
  afterPublish?: true;
  /** Repository-relative globs (`*` one segment, `**` any) of what it writes. */
  writes: readonly string[];
  /**
   * Repository-relative globs of COMMITTED files this writer is known to
   * rewrite beside its QA output, which the refresh restores after it runs
   * (bean `72a8`). Only these are restored: any other committed file that
   * changes while the writer runs is reported and LEFT IN PLACE, because it
   * may be somebody's edit (2026-10-07: four uncommitted edits reverted under
   * `kg:audit:all`, `docs:pages` and `readme:subgraphs`, none of which writes
   * them). Each glob is measured, from the restore log of real runs.
   */
  rewrites?: readonly string[];
  /** Exit codes that mean "wrote its output". Default `[0]`. */
  okExits?: readonly number[];
  /** Why it is here, or what it depends on. */
  because: string;
  /**
   * It reads graphs kept on their STATE branches (todos, beans, issue marks …).
   * In a content root with no state branch mounted it is not applicable,
   * reported with that reason rather than as failed (cat-harness-tools#281).
   */
  readsState?: true;
}

// declared-path-literal: the HARNESS's qa tree, as the repo-relative key every writer below is keyed by. This script moved up to cat-harness-tools in 70lx B2 and drives its implementer's writers (downward); it was an own-instance path until the move.
const R = "cat-harness/test/results";

/**
 * The hosted KG-QA homes `kg:audit:all` writes under {@link R}: the harness's
 * known hosted layers, plus any layer declared in `repoRoot` whose
 * `kgQaHomeFor` resolves to `"hosted"` (such as a content root's own layer
 * when it declares no `qa` directory of its own — bean `rn24`). Still named
 * per declared layer rather than globbed, so the folded `agent-skills/` and
 * `large-datasets/` trees remain unclaimed.
 */
export function hostedKgWrites(repoRoot: string | undefined = REPO_ROOT): string[] {
  const stubs = new Set([
    "bootstrap",
    "bootstrap-tools",
    "cat-harness-tools",
    "cat-openapi",
    "folio-assistant",
    "folio-assistant-state",
  ]);
  if (repoRoot) {
    for (const r of layerRootsIn(repoRoot)) {
      if (kgQaHomeFor(r, HARNESS_ROOT).by !== "hosted") continue;
      const decl = readDeclaration(r);
      if (decl) stubs.add(artefactStub(decl));
    }
  }
  return [...stubs].map((s) => `${R}/${s}/**`);
}

/**
 * Every writer of the `qa` tree, in the order they must run. Order matters
 * where one reads another's output: the witnesses project the block and
 * translation verdicts; `lsi audit` reads the indexes; `audit:coverage`
 * counts the files the others wrote; the subgraph READMEs list them.
 *
 * Measured 2026-10-02 on a scratch branch with `5hox`'s removal applied, each
 * run into the empty tree: together they reproduce 1,182 of the inventory's
 * 1,186 paths. The other four are `agent-skills/` and `large-datasets/`
 * kg-qa trees of two layers that were folded away (`j7ql`): no writer
 * audits a layer that no longer exists, so the record correctly loses
 * them. The block sweep covers the whole docs tree, which adds the 106 block
 * verdicts no hand sweep had reached — a derived result is a function of the
 * tree, not of which chapters somebody once swept.
 */
export const QA_WRITERS: readonly QaWriter[] = [
  {
    id: "kg:audit:all",
    run: ["kg:audit:all"],
    writes: [
      "*/test/results/kg-qa/**",
      "*/test/results/kg-qa.manifest.json",
      ...hostedKgWrites(),
    ],
    because: "every declared instance's KG verdicts, hosted homes included (bootstrap, bootstrap-tools, cat-harness-tools, cat-openapi, folio-assistant, folio-assistant-state, and any declared instance in this checkout hosted under cat-harness)",
  },
  { id: "kg:detangle", run: ["kg:detangle"], writes: [`${R}/detangle/**`], because: "detangle measurements per instance graph" },
  // `translation:page-qa` is `translation:block-qa --catalogues`: the same block
  // and page passes plus the catalogue pass (translations/<rel>.<locale>), so
  // main's stored tree carries the baseline `translation:page-qa:check` judges
  // against (owner, 2026-11-07, "A. Two steps"). One run, not two.
  { id: "translation:block-qa", run: ["translation:page-qa"], writes: [`${R}/translation-qa/**`], because: "translation verdicts, catalogues included; read by the witnesses below" },
  {
    id: "qa-sweep:docs",
    // declared-path-literal: the sweep's target is cat-harness's authored docs tree, one fixed directory of the harness this step refreshes, passed as the CLI argument qa-sweep.ts takes.
    run: ["cat-harness-tools/pipeline/qa-sweep.ts", "cat-harness/docs/source"],
    // The script sidecars it stamps live under test/results since cat-harness 70lx (qa-utils.ts
    // `SCRIPT_SIDECAR_DIR`), so they are this writer's OUTPUT, not committed files it rewrites: left
    // out of `writes`, the 86 of them in the composed checkout were `unclaimed` (2026-10-10).
    writes: [`${R}/block-qa/**`, `${R}/script-sidecars/*.script.json`],
    // declared-path-literal: the script sidecars the sweep restamped where they were committed before 70lx, measured from the 2026-10-07 restore log (65 of them).
    rewrites: ["cat-harness/content/pipeline/script-sidecars/*.script.json"],
    because: "script block verdicts over the docs tree; agent verdicts are composed from test/attestations/, which stays on main. Read by the witnesses below",
  },
  // `*/test/results`, not `${R}`: since cat-harness#12 each verdict is written
  // under the layer that owns the library entry (the IRIS replica, the DAK
  // base layer, the FHIR IG harness …), and claiming only cat-harness's tree left 24 of them
  // `unclaimed` in the composed checkout (2026-10-09). And the ROOT layer's
  // own entries land at `test/results/library-qa/`, which `*/` never matches:
  // in smart-ra (library/ at the repo root) the writer read as producing
  // nothing and uml:overview failed (smart-ra#228, 2026-11-05).
  { id: "check:l1-complete", run: ["check:l1-complete", "--write"], writes: [`*/test/results/library-qa/**`, `test/results/library-qa/**`], because: "per-library-entry L1 completeness, under the instance owning each entry; `--write` is its writer form" },
  {
    id: "p2:refusals",
    run: ["p2:refusals"],
    writes: ["*/test/results/p2-refusals.qa-results.json"],
    because: "each IG instance's record of the Publisher pages refused under P2 (bean `jut3`), derived from its artefact index; missing from this list until bean `72a8`, so a computed tree lacked it and `p2:refusals:check` failed",
  },
  { id: "lsi:index:cat-harness:skills", run: ["lsi:skills"], writes: [`${R}/lsi/cat-harness/skills.lsi.json`, `${R}/tool-runs/lsi-index/cat-harness/skills.tool-run.json`], because: "the skills graph's LSI index and its run record" },
  {
    id: "lsi:index:library",
    run: ["lsi", "index", "--graph", "library", "--needed"],
    writes: [`${R}/lsi/*/library.lsi.json`, `${R}/tool-runs/lsi-index/*/library.tool-run.json`],
    because:
      "every library graph `lsi audit` says needs an index, chosen by `needOf` over the instances present (three, measured 2026-10-06). The list was hardcoded and named instances above this layer (bean `0r7u`)",
  },
  { id: "lsi:audit", run: ["lsi:audit"], writes: [`${R}/lsi-need-an-index.qa-results.json`], because: "which prose graphs need an index; reads the indexes above" },
  {
    id: "docs:pages",
    run: ["docs:pages"],
    // `*/test/results`, as for check:l1-complete: since #609 docs:pages writes each
    // mounted layer's witnesses under that layer's own test/results/ (qaAssetDirOf).
    writes: [`*/test/results/witnesses/**`],
    // declared-path-literal: the docs projections it regenerates beside the witnesses (bean `72a8`), measured from the 2026-10-07 restore log.
    rewrites: ["cat-harness/docs/assets/beans/*.json", "cat-harness/docs/assets/qa/*.json"],
    // Measured in smart-ra 2026-10-15: `skills:docs` reads the todo graph and exits 1 when it is unmounted.
    readsState: true,
    because: "the published witness projections of the block and translation verdicts above",
  },
  { id: "viewer:nav:audit", run: ["viewer:nav:audit"], writes: [`${R}/viewer-nav/**`], because: "viewer navbar census" },
  // Declared in test-run-compute.ts, so kg:audit:check can run them without importing this module (#1191).
  ...TEST_RUN_WRITERS,
  ...(
    [
      ["root-scan-census", "root-scan-census"],
      ["skill:register", "skill-register"],
      ["term:mapping", "term-mapping"],
      ["check:harness-state", "harness-state"],
      ["check:wireframes", "wireframes"],
      ["check:source-licence", "source-licence"],
      ["check:layout-norms", "layout-norms"],
      ["check:rendered-labels", "rendered-labels"],
      ["check:lane-documentation", "lane-documentation"],
      ["check:methodology-evidence", "methodology-evidence"],
      ["check:avatar-coverage", "avatar-coverage"],
      ["check:unlinked-beans", "unlinked-beans"],
      ["kg:export", "kg-export"],
      // Its writer form wrote `library-entry-qa.qa-results.json` in a gate shard
      // before `uml:overview:check` ran qa:refresh, which then refused the file
      // as unclaimed (three PRs blocked intermittently, 2026-11-19).
      ["check:library-qa", "library-entry-qa"],
    ] as const
  ).map(([script, stem]): QaWriter => ({
    id: script,
    run: [script],
    writes: [
      `${R}/${stem}.qa-results.json`,
      // kg:export qualifies a sidecar for any layer but the host with that
      // layer's stub (`kg-export.<stub>`, kg-export.ts), so in a content
      // layer's cone it writes `kg-export.<that layer>.qa-results.json`. Only
      // the host's bare stem was claimed, so a content layer's PR refused its
      // own `kg-export.<layer>.qa-results.json` as unclaimed (issue #2313).
      ...(script === "kg:export" ? [`${R}/kg-export.*.qa-results.json`] : []),
    ],
    // declared-path-literal: the skill artefacts the register's writer form regenerates, measured from the 2026-10-07 restore log.
    ...(script === "skill:register"
      ? {
          rewrites: [
            "cat-harness/docs/payload/sha256/*",
            "cat-harness/docs/subgraph/**",
            "cat-harness/docs/assets/img/uml/**",
            "cat-harness/docs/uml/**",
            "cat-harness/uml/**",
            "cat-harness/docs/*/glossary/**",
            "cat-harness/docs/assets/glossary/**",
            "cat-harness/docs/cat-harness/auto-docs/**",
            "cat-harness/docs/reference/skill-instructions/**",
            "**/glossary/generated/**",
            "cat-harness/docs/lsi/**",
            "cat-harness/docs/assets/beans/*.json",
          ],
        }
      : script === "term:mapping"
      ? {
          rewrites: ["cat-harness/docs/assets/qa/*.json"],
        }
      : {}),
    // Measured in smart-ra 2026-10-15 (cat-harness-tools#281): skill:register
    // runs `skills:docs`, which reads the todo graph, and check:harness-state
    // judges the issue-marks, merge-queue, session-survey, todo-feedback and
    // board-positions graphs; all of them live on state branches.
    // check:unlinked-beans (bean `w2hn`) reads the beans graph and its workflow instances.
    ...(script === "skill:register" || script === "check:harness-state" || script === "check:unlinked-beans" ? { readsState: true as const } : {}),
    because: "a whole-artefact review; its writer form writes the sidecar",
  })),
  {
    id: "check:reference-direction",
    run: ["check:reference-direction"],
    writes: [`${R}/reference-direction.qa-results.json`],
    okExits: [0, 1],
    because: "exits 1 when it finds a wrong-direction reference, and writes the sidecar either way",
  },
  {
    // Claimed, never run here: `check:nav-names` reads the BUILT site (the
    // navbar include, harness.json and every railed viewer page), and a
    // consumer's QA working copy runs qa:refresh BEFORE derive:publish builds
    // it, so running it here judged an empty site UNDETERMINED and left the
    // refresh INCOMPLETE (folio-assistant#3124). Its report form writes the
    // sidecar after the site is built; `check:nav-names:check` gates it.
    id: "check:nav-names",
    run: "external",
    afterPublish: true,
    writes: [`${R}/nav-names.qa-results.json`],
    because: "written by `check:nav-names` once the site is built, which qa:refresh's pre-publish pass cannot do; judged by `check:nav-names:check`",
  },
  {
    id: "kg-export:bootstrap",
    run: "external",
    writes: [`${R}/kg-export.bootstrap.qa-results.json`],
    because: "written by the job's own `Regenerate the bootstrap kg-export QA sidecar` step, which `check:published-instance-exports` reads as its producer",
  },
  { id: "audit:coverage", run: ["audit:coverage"], writes: [`${R}/audit-coverage.qa-results.json`], because: "counts what every writer above produced, so it runs after them" },
  {
    id: "readme:subgraphs",
    run: ["readme:subgraphs"],
    // Its findings sidecar only. It writes no README into a `qa` directory
    // any more: a STORED directory is skipped (bean `f3bh`), so the README and
    // the findings cannot depend on whether a working copy was fetched.
    writes: [`${R}/subgraph-readmes.qa-results.json`],
    // The directory READMEs it regenerates (bean `f3bh`).
    rewrites: ["**/README.md"],
    because: "its findings cover every declared directory's README, so it runs last",
  },
];

/** A repository-relative glob as a RegExp: `**` any depth, `*` one segment. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
    } else if (c === "*") re += "[^/]*";
    else re += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** The writers whose `writes` match `path`. */
export function claimants(path: string, writers: readonly QaWriter[] = QA_WRITERS): string[] {
  return writers.filter((w) => w.writes.some((g) => globToRegExp(g).test(path))).map((w) => w.id);
}

export type RefreshMode = "tracked" | "computed" | "mixed";

/** A writer that cannot build anything in this root, and why: neither run nor failed. */
export interface NotApplicable {
  id: string;
  why: string;
}

/** What {@link notApplicableWriters} needs to know about the root. */
export interface RootFacts {
  profile: RootProfile;
  /** Whether an npm script of this name is declared by any layer on disk. */
  declares: (script: string) => boolean;
  /** Whether any state branch is mounted in this worktree. */
  stateMounted: boolean;
}

/**
 * The writers that do not apply to this root, each with its reason. Pure, so
 * the rule is tested on fixtures.
 *
 * Only a CONTENT root has any (owner, cat-harness-tools#281: "hold smart-ra to
 * its own gate set"). In the harness every writer is its own CI recipe, and a
 * writer that names no script there is a broken declaration (bean `72a8`), so
 * it stays a failure. In a content root two things are true that are not
 * failures of the root:
 *
 * - the writer's script is declared by no layer mounted there (`p2:refusals`
 *   is declared by the IG layers smart-ra does not mount);
 * - it reads state graphs and no state branch is mounted (`readsState`).
 *
 * Anything else a content root's writer does stays judged: a real content gap
 * (an L1 entry with no manifest, a surface with no wireframe) is a failure.
 */
export function notApplicableWriters(writers: readonly QaWriter[], facts: RootFacts): NotApplicable[] {
  if (facts.profile !== "content") return [];
  const out: NotApplicable[] = [];
  for (const w of writers) {
    if (w.run === "external") continue;
    const name = w.run[0]!;
    const isScriptName = !name.includes("/") && !/\.[cm]?[jt]s$/.test(name);
    if (isScriptName && !facts.declares(name)) {
      out.push({ id: w.id, why: `\`${name}\` is declared by no instance mounted in this root, so there is nothing to run` });
    } else if (w.readsState && !facts.stateMounted) {
      out.push({ id: w.id, why: "it reads graphs kept on state branches, and none is mounted in this root (`bun run cat state:mount`)" });
    }
  }
  return out;
}

export interface WriterRun {
  id: string;
  exit: number | null;
  seconds: number;
}

export interface QaRefreshReport {
  $schema: typeof REFRESH_SCHEMA;
  mode: RefreshMode;
  /** The checkout this describes. */
  commit?: string;
  files: number;
  bytes: number;
  /** Files per writer, in declaration order (computed mode). */
  families: Record<string, number>;
  writers: WriterRun[];
  /** Files no writer claims. */
  unclaimed: string[];
  /** Writers whose families hold no file. */
  empty: string[];
  /** Writers that exited outside their `okExits`. */
  failed: string[];
  /** Writers not run because they do not apply to this root, with why. Neither passed nor failed. */
  notApplicable: NotApplicable[];
  complete: boolean;
  /** Why it is not complete, one line each. Empty when complete. */
  reasons: string[];
}

/**
 * Judge a working copy: pure, so the completeness rule is tested on fixtures.
 *
 * In `tracked` mode the record is the commit's own copy, so only emptiness is
 * judged — a tracked copy with no file at all is not a record of anything.
 *
 * In `mixed` mode the per-writer judgements apply, but `unclaimed` is computed
 * over `unbacked` only: see the module docblock for why a tracked file is not
 * asked which writer claims it.
 */
export function assess(args: {
  mode: RefreshMode;
  inventory: MovedInventory;
  runs: readonly WriterRun[];
  writers?: readonly QaWriter[];
  commit?: string;
  /** `mixed` mode: the paths version control still tracks, whose provenance is the commit. */
  tracked?: readonly string[];
  /** Writers that do not apply to this root ({@link notApplicableWriters}): not judged empty or failed. */
  notApplicable?: readonly NotApplicable[];
}): QaRefreshReport {
  const writers = args.writers ?? QA_WRITERS;
  const na = new Set((args.notApplicable ?? []).map((n) => n.id));
  const paths = args.inventory.directories.flatMap((d) => d.files.map((f) => f.path));
  const families: Record<string, number> = {};
  const unclaimed: string[] = [];
  const empty: string[] = [];
  const failed: string[] = [];
  const reasons: string[] = [];
  if (args.mode !== "tracked") {
    const trackedSet = new Set(args.tracked ?? []);
    for (const w of writers) families[w.id] = 0;
    for (const p of paths) {
      const by = claimants(p, writers);
      // A tracked file's provenance is the commit that carries it, so it is
      // never asked which writer claims it (module docblock, bean `tqjj`).
      if (by.length === 0 && !trackedSet.has(p)) unclaimed.push(p);
      for (const id of by) families[id]!++;
    }
    // A writer that runs only AFTER publish (`afterPublish`) has not written
    // yet, so its empty family is no evidence of failure (check:nav-names,
    // folio-assistant#3124). Its claim still keeps its file from being
    // `unclaimed`, and every other external writer is still held to its files.
    for (const w of writers) if (families[w.id] === 0 && !na.has(w.id) && !w.afterPublish) empty.push(w.id);
    for (const r of args.runs) {
      const w = writers.find((x) => x.id === r.id);
      if (na.has(r.id)) continue;
      if (r.exit === null || !(w?.okExits ?? [0]).includes(r.exit)) failed.push(r.id);
    }
    if (unclaimed.length) reasons.push(`${unclaimed.length} file(s) no declared writer claims (first: ${unclaimed[0]}) — QA_WRITERS is out of date`);
    if (empty.length) reasons.push(`${empty.length} writer(s) produced nothing: ${empty.join(", ")}`);
    if (failed.length) reasons.push(`${failed.length} writer(s) failed: ${failed.join(", ")}`);
  }
  if (paths.length === 0) reasons.push("no file under any declared qa directory — an entry of nothing is not a record");
  return {
    $schema: REFRESH_SCHEMA,
    mode: args.mode,
    ...(args.commit ? { commit: args.commit } : {}),
    files: paths.length,
    bytes: args.inventory.bytes,
    families,
    writers: [...args.runs],
    unclaimed,
    empty,
    failed,
    notApplicable: [...(args.notApplicable ?? [])],
    complete: reasons.length === 0,
    reasons,
  };
}

function git(repoRoot: string, args: string[]): string {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf-8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.trim()}`);
  return r.stdout;
}

/** Files version control tracks under the declared `qa` roots. */
export function trackedQaFiles(repoRoot: string, roots: readonly string[]): string[] {
  if (roots.length === 0) return [];
  return git(repoRoot, ["ls-files", "-z", "--", ...roots]).split("\0").filter(Boolean);
}

/**
 * The qa files a REMOTE MOUNT laid down: paths under a mounted layer's root,
 * on disk before any writer runs. In a composed checkout a mount is ignored by
 * the aggregate's git, so `trackedQaFiles` names none of its files, but each one
 * was laid down from the mount's pinned commit and checked against its lock. Its
 * provenance is that commit, the same reason a tracked file is not `unclaimed`.
 * Measured 2026-10-10: the IRIS replica's committed `test/results/translation-roundtrip/`
 * results were read as 11 `unclaimed` files, which failed every QA working copy.
 */
export function carriedByMount(paths: readonly string[], mountedRoots: readonly string[]): string[] {
  const prefixes = mountedRoots.map((r) => r.replace(/\/+$/, "") + "/");
  return paths.filter((p) => prefixes.some((pre) => p.startsWith(pre)));
}

/** Tracked paths that differ from HEAD, in the index or the working tree. */
function dirtyTracked(repoRoot: string): Set<string> {
  return new Set(
    git(repoRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=no"])
      .split("\0")
      .filter(Boolean)
      .map((l) => l.slice(3)),
  );
}

/**
 * Tracked files a writer rewrote that were clean before it ran — the paths to
 * restore. Pure, so the rule is tested without a checkout.
 *
 * The working copy is the IGNORED tree under the `qa` roots, and producing it
 * must leave every committed file as the commit has it. Several writers render
 * more than their QA output: `docs:pages` regenerates the docs projections
 * (`docs/assets/beans/index.json`, `docs/assets/qa/index.json`) alongside the
 * witnesses it is listed for, and `qa-sweep` restamps the script sidecars.
 * Left in place, those edits make the gates that read the committed tree
 * judge a tree nobody committed: measured 2026-10-04 on #2080, the beans tile
 * count moved 796 → 805 and `docs:harness:check` went red in CI and green on
 * every checkout that had not run the working copy (bean `72a8`).
 *
 * A path that was already dirty is the person's own edit and is never touched.
 */
export function writerSideEffects(before: ReadonlySet<string>, after: ReadonlySet<string>): string[] {
  return [...after].filter((p) => !before.has(p)).sort();
}

/**
 * Run each writer and restore, AFTER EACH ONE, the committed files that became
 * dirty while it ran (bean `7how`).
 *
 * The window used to be the whole run — every writer, minutes — so an edit a
 * person or another agent made to a clean file at any point during it read as
 * "a writer rewrote this" and was checked out from `HEAD`. Measured on #2272,
 * 2026-10-06: an uncommitted fix to `translation-tools.ts` was reverted
 * mid-run and lost silently. Per writer, the window is that writer's own run,
 * and every restored path is named with the writer it is charged to, so a
 * loss can be seen and recovered rather than found later by grep. Commit
 * source edits before building the working copy: this narrows the hazard, it
 * cannot remove it, since a write by another process inside one writer's run
 * is indistinguishable from the writer's own.
 */
export function runRestoring<W, R>(
  writers: readonly W[],
  run: (w: W) => R,
  dirty: () => ReadonlySet<string>,
  restore: (paths: string[]) => void,
  opts: {
    /**
     * Whether `w` may have rewritten `path`, from its declared `rewrites`. A
     * path it may not is LEFT, never restored: it changed while `w` ran, and
     * the only other writer in the tree is a person or another agent. Absent,
     * every changed path is restored (the rule before 2026-10-07).
     */
    mayRestore?: (w: W, path: string) => boolean;
    /** Called with the paths about to be restored, BEFORE they are, so a wrong guess costs nothing. */
    backup?: (w: W, paths: string[]) => void;
  } = {},
): { run: R; restored: string[]; left?: string[] }[] {
  const out: { run: R; restored: string[]; left?: string[] }[] = [];
  for (const w of writers) {
    const before = dirty();
    const r = run(w);
    const side = writerSideEffects(before, dirty());
    const may = opts.mayRestore;
    const restored = may ? side.filter((p) => may(w, p)) : side;
    const left = may ? side.filter((p) => !may(w, p)) : [];
    if (restored.length) {
      opts.backup?.(w, restored);
      restore(restored);
    }
    out.push({ run: r, restored, ...(left.length ? { left } : {}) });
  }
  return out;
}

/** Whether `writer` declares it may rewrite the committed file `path`. */
export function mayRestore(writer: QaWriter, path: string): boolean {
  return (writer.rewrites ?? []).some((g) => globToRegExp(g).test(path));
}

/**
 * Split the declared writers by whether version control still carries their
 * output — the per-writer form of the two modes (module docblock, bean `tqjj`).
 *
 * A writer is BACKED when at least one tracked path matches one of its
 * declared `writes` globs: the commit carries its record, so running it would
 * make `main/<sha>` differ from the commit and break `5hox`'s hash check.
 * UNBACKED, nothing in the commit holds its output, so this run must produce
 * it or `qa-reports` carries nothing for it.
 */
export function partitionWriters(
  tracked: readonly string[],
  writers: readonly QaWriter[] = QA_WRITERS,
): { backed: QaWriter[]; unbacked: QaWriter[] } {
  const backed: QaWriter[] = [];
  const unbacked: QaWriter[] = [];
  for (const w of writers) {
    const res = w.writes.map((g) => globToRegExp(g));
    (tracked.some((p) => res.some((re) => re.test(p))) ? backed : unbacked).push(w);
  }
  return { backed, unbacked };
}

/**
 * Run one writer from the repository root; its output streams through. A
 * writer that exits {@link NOT_APPLICABLE_EXIT} said it cannot build anything
 * in this root (`lib/not-applicable.ts`): its reason is collected into
 * `notApplicable`, and it is judged neither empty nor failed.
 */
function runWriter(
  repoRoot: string,
  w: QaWriter,
  notApplicable: NotApplicable[],
  prefix: readonly string[] = [],
  env: Record<string, string | undefined> = process.env,
): WriterRun {
  const t = Date.now();
  if (w.run === "external") return { id: w.id, exit: 0, seconds: 0 };
  console.log(`::group::qa:refresh ${w.id} — bun run cat ${w.run.join(" ")}`);
  const reasonFile = join(tmpdir(), `qa-refresh-na-${process.pid}-${w.id.replace(/[^A-Za-z0-9._-]/g, "_")}.txt`);
  rmSync(reasonFile, { force: true });
  const argv = [...prefix, "bun", "run", "cat", ...w.run];
  const r = spawnSync(argv[0]!, argv.slice(1), {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...env, [NOT_APPLICABLE_REASON_ENV]: reasonFile },
  });
  console.log("::endgroup::");
  if (r.status === NOT_APPLICABLE_EXIT) {
    const why = existsSync(reasonFile) ? readFileSync(reasonFile, "utf-8").trim() : "";
    notApplicable.push({ id: w.id, why: why || `it exited ${NOT_APPLICABLE_EXIT} (not applicable) and gave no reason` });
  }
  rmSync(reasonFile, { force: true });
  return { id: w.id, exit: r.status, seconds: Math.round((Date.now() - t) / 1000) };
}

function main(argv: string[]): number {
  process.env[BUILDING_ENV] = "1";
  const one = (n: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  if (argv.includes("--list")) {
    for (const w of QA_WRITERS) console.log(`${w.id.padEnd(32)} ${w.run === "external" ? "(external step)" : `bun run cat ${w.run.join(" ")}`}\n${" ".repeat(33)}${w.writes.join(", ")}`);
    return 0;
  }
  if (argv.includes("--github")) {
    // The same decision `qa:publish --github` makes, asked first: a run whose
    // publish will be skipped (a fork PR, a push off main) has no use for
    // minutes of writers. Stated, never silent, and exit 0 — as the publish.
    let event: unknown;
    try {
      event = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf-8")) : undefined;
    } catch {
      event = undefined;
    }
    const d = githubPublishDecision(process.env, event);
    if (!d.publish) {
      console.log(`::notice title=qa:refresh skipped::${d.reason}`);
      return REFRESH_EXIT.complete;
    }
  }
  const repoRoot = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  const roots = movedRoots(repoRoot);
  if (roots.length === 0) throw new QaUsageError("no instance declares a qa directory; there is nothing to refresh");
  const commit = git(repoRoot, ["rev-parse", "HEAD"]).trim();
  const tracked = trackedQaFiles(repoRoot, roots);
  const { backed, unbacked: candidates } = partitionWriters(tracked);
  const table = scriptTable(repoRoot);
  const notApplicable = notApplicableWriters(candidates, {
    profile: rootProfile(repoRoot),
    declares: (name) => table.has(name),
    stateMounted: stateMountedDirs(repoRoot).length > 0,
  });
  const naIds = new Set(notApplicable.map((n) => n.id));
  const unbacked = candidates.filter((w) => !naIds.has(w.id));
  for (const n of notApplicable) console.log(`qa:refresh: ${n.id} NOT APPLICABLE in this root — ${n.why}`);
  const declaredNa = notApplicable.length;
  const mode: RefreshMode = unbacked.length === 0 ? "tracked" : backed.length === 0 ? "computed" : "mixed";
  const runs: WriterRun[] = [];
  if (backed.length) {
    console.log(
      `qa:refresh: ${tracked.length} file(s) are still tracked under the qa directories, backing ${backed.length} writer(s) — ` +
        "the commit's own copy is their record, so they do not run (5hox's hash check needs main/<sha> byte-identical to it)",
    );
  }
  // Every declared results directory exists before any writer runs. This
  // command IS the computation, so an absent directory here means "not yet
  // written", never "not computed". Without it, a fresh checkout's first writer
  // (kg:audit:all) audits each nested layer before anything has created that
  // layer's directory, so its test-run criteria read `unknown` (bean `2gst`'s
  // rule for an uncomputed tree), and that critical `unknown` is recorded in the
  // very sidecars it then writes there. `check:qa-corpus` failed on 8 layers
  // in CI on #2080 for exactly this. On main the directories exist because their
  // sidecars are committed; this restores that, nothing more.
  // A mounted layer's directory is created under its layer output root, never
  // inside the mount (bean `cat-tools-sm8r`, item 4): the writers write there,
  // and every reader finds it through the overlay.
  for (const r of roots) mkdirSync(writePathOf(join(repoRoot, r), repoRoot), { recursive: true });
  const mounted = [...mountedInstanceRoots(repoRoot).values()].map((abs) => relative(repoRoot, abs));
  // Only a file IN the mount was laid down from its pin; one under the layer
  // output root (`MovedFile.at`) was computed here, and is judged like any other.
  const carried = carriedByMount(
    movedInventory(repoRoot, roots).directories.flatMap((d) => d.files.filter((f) => f.at === undefined).map((f) => f.path)),
    mounted,
  );
  // A writer may rewrite committed files beside its QA output (bean `72a8`);
  // restore those so the gates judge the tree that was committed.
  // Each restore is backed up first, so a wrong guess costs nothing: the file
  // as it stood is under build/qa-refresh-restored/<stamp>/<writer>/<path>.
  const backupRoot = join(repoRoot, "build", "qa-refresh-restored", new Date().toISOString().replace(/[:.]/g, "-"));
  // The QA cone (owner card Q-CONE-2 B): main records each step's reads, a
  // preview reruns only the steps whose reads changed (`qa-cone.ts`).
  const cone = new QaCone(
    repoRoot,
    scriptsOf(repoRoot),
    unbacked.filter((w): w is QaWriter & { run: readonly string[] } => w.run !== "external"),
    coneMode(process.env, straceWorks),
    // input-site: inert #47f67742 — the commit names the record; it is not an input of any step
    process.env.GITHUB_SHA ?? commit,
  );
  if (cone.mode !== "off") console.log(`qa:refresh: QA cone ${cone.mode === "record" ? "RECORDING every step under strace" : "ON: a step whose recorded reads all match is put back from main"}`);
  const restored = runRestoring(
    unbacked,
    (w) => (w.run === "external" ? runWriter(repoRoot, w, notApplicable) : cone.step({ id: w.id, run: w.run, writes: w.writes }, (prefix, env) => runWriter(repoRoot, w, notApplicable, prefix, env))),
    () => dirtyTracked(repoRoot),
    (paths) => git(repoRoot, ["checkout", "--", ...paths]),
    {
      mayRestore,
      backup: (w, paths) => {
        for (const p of paths) {
          const to = join(backupRoot, w.id.replace(/[^A-Za-z0-9._-]/g, "_"), p);
          mkdirSync(dirname(to), { recursive: true });
          if (existsSync(join(repoRoot, p))) copyFileSync(join(repoRoot, p), to);
        }
      },
    },
  );
  cone.finish();
  for (const r of restored) runs.push(r.run);
  const restore = restored.flatMap((r) => r.restored);
  if (restore.length) {
    console.log(`qa:refresh: restored ${restore.length} committed file(s) a writer declares it rewrites — each backed up first under ${relative(repoRoot, backupRoot)}/:`);
    for (const r of restored) for (const p of r.restored) console.log(`  restored ${p}  (rewritten while ${r.run.id} ran)`);
  }
  const left = restored.flatMap((r) => (r.left ?? []).map((p) => ({ p, w: r.run.id })));
  if (left.length) {
    console.log(`qa:refresh: LEFT ${left.length} changed committed file(s) in place — the writer running does not declare it rewrites them, so they may be somebody's edit:`);
    for (const { p, w } of left) console.log(`  left ${p}  (changed while ${w} ran; add it to that writer's \`rewrites\` if the writer did it)`);
  }
  for (const n of notApplicable.slice(declaredNa)) console.log(`qa:refresh: ${n.id} NOT APPLICABLE in this root — ${n.why}`);
  const report = assess({ mode, inventory: movedInventory(repoRoot, roots), runs, commit, tracked: [...tracked, ...carried], notApplicable });
  const out = resolve(one("report") ?? join(repoRoot, "build", "qa-refresh.json"));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  if (argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  console.log(
    `qa:refresh ${report.complete ? "COMPLETE" : "INCOMPLETE"} (${mode}): ${report.files} file(s), ${report.bytes} bytes` +
      (runs.length ? ` from ${runs.length} writer(s)` : "") +
      (notApplicable.length ? `, ${notApplicable.length} not applicable here` : "") +
      ` — report ${out}`,
  );
  for (const r of report.reasons) console.error(`  ✗ ${r}`);
  for (const p of report.unclaimed.slice(0, 20)) console.error(`    unclaimed ${p}`);
  return report.complete ? REFRESH_EXIT.complete : REFRESH_EXIT.incomplete;
}

if (import.meta.main) {
  let code: number;
  try {
    code = main(process.argv.slice(2));
  } catch (e) {
    console.error(`qa-refresh: could not determine — ${(e as Error).message}. This is NOT a pass.`);
    code = REFRESH_EXIT.unknown;
  }
  process.exit(code);
}
