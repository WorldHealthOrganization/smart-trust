/**
 * What a check script reads and writes. This layer's rows are declared here;
 * a layer above it declares its own under `taskIo` in its
 * `<instance>.json`, and {@link collectTaskIo} reads both.
 *
 * @module scripts/task-io
 * @graphNode none — a declaration table read by `regen-after-merge.ts` and `gates.ts`
 *
 * ## What a declaration buys
 *
 * - `outputs: []` — the script WRITES NOTHING, so `gates` runs it in the
 *   worker pool beside other read-only gates, and `regen` asks it beside other
 *   read-only checks. A script with no `outputs` here runs alone, in order.
 *   (Only the empty list is used: a check that writes is treated as
 *   undeclared, and the test says so.)
 * - `inputs` — what can change the script's answer, so `regen` can SKIP a
 *   verify/write pair whose inputs hash to the value recorded at its last
 *   green run, and `gates` skip the script itself when its inputs hash to its
 *   last pass (`input-hash.ts`). `{tracked}` means the whole working tree as
 *   version control sees it; a narrower glob list hashes only what it names,
 *   plus the script's own source and every module it imports.
 *
 * ## The rule for adding one
 *
 * **`inputs: [TRACKED]` is a claim the fingerprint CHECKS, every time.**
 * `input-sites.ts` walks the script's import closure, and every line that can
 * read something the tree does not hold — the environment, the network, the
 * clock, git history, a spawned process, a computed module — must carry a
 * pinned, reviewed `// input-site:` annotation saying what it reads;
 * otherwise the fingerprint is undetermined and the script RUNS. So a
 * `{tracked}` declaration can cost skips, never correctness.
 * `bun run cat input-hash:coverage` says which declared scripts can skip and what
 * blocks the rest; `--sites <file>` prints the pins.
 *
 * - prefer `{tracked}` to a hand-picked glob list: a narrower list is a claim
 *   about FILES the audit cannot check, and a `tree` site refuses it;
 * - an `outputs: []` claim is re-checked on every `gates` run by the tree
 *   guard: a parallel batch that changes the tree is reported, naming the batch.
 * - **never add a narrower list to get a CI skip.** Inputs are declared or
 *   derived (computed from the run itself, never stored), never inferred: the
 *   narrow set is DERIVED by `ci-cone.ts`, which traces a `{tracked}` check's
 *   green run and records what it read. A row here only makes a check a
 *   candidate.
 *
 * ## How entries are chosen
 *
 * - `inputs`: a script's `--check` path is READ for writes, and its import
 *   closure scanned for environment, network and clock reads. Scripts that
 *   read the network or environment (e.g. `uml:overview:check`,
 *   `kg:locale:check`, `translated-links:check`, `library:viz:check`,
 *   `schema:viz:check`, `auto:docs:check`) are left out.
 * - `outputs: []` without `inputs`: a gate script that, run under `strace` on
 *   a clean tree, opened NOTHING for writing, created, renamed, removed or
 *   truncated nothing, inside or outside the repository (Bun's own cache
 *   aside) — measured, not inferred from a name.
 *
 * ## What the measurement cannot see, and why that is tolerable
 *
 * `strace` sees the code path a CLEAN tree takes. A check that writes only
 * when its answer changes is invisible to it (`skill:register:check` is
 * therefore declared by reading: skippable, not read-only). A wrong
 * `outputs: []` can produce a false red, not a false green: in `gates`, its
 * write is caught by the tree guard and the run reports NOT clean, naming the
 * parallel batch; in `regen`, the settling pass re-asks every pair.
 */
import { dirname } from "node:path";
import { checkoutRootFor, readDeclaration } from "../schemas/kg/cat-harness.ts";
import { layerRootsIn } from "../schemas/kg/instance-roots.ts";
import { mountScopeFor } from "../schemas/kg/remote-mount.ts";
import { TRACKED, type PairIO } from "./input-hash.ts";

export interface ScriptIO {
  /** Globs (or `{tracked}`) whose content can change the answer. Absent: never skipped. */
  inputs?: readonly string[];
  /** `[]`: writes nothing, may run in the pool. Absent: runs alone. */
  outputs?: readonly string[];
  /** The task that repairs this check, when `X` / `X:check` naming does not give it (`regen`'s `WRITER_OVERRIDES`). */
  writer?: string;
  /** A merge train runs this check, and its writer when red, even without `regen`. */
  afterMerge?: boolean;
  /** True when the check is a judge/baseline verdict against qa-reports rather than an artefact staleness check. */
  judge?: boolean;
}

/** Writes nothing — measured with `strace` (see the module comment). Not skippable. */
const READ_ONLY: ScriptIO = { outputs: [] };

/** Read-only, and safe to skip on an unchanged tree: read for writes, env, network and clock. */
const TREE_READER: ScriptIO = { inputs: [TRACKED], outputs: [] };

/**
 * This layer's own rows. A task owned by a layer ABOVE this one is not
 * listed here: that layer declares it in its own `<instance>.json` under
 * `taskIo`, and {@link collectTaskIo} reads it from whatever layers are
 * present (bean `0r7u`, owner ruling 2026-10-06 — "each instance declares its
 * own tasks"). Twenty rows moved out on that day; naming them here would be
 * the upward reference that breaks this layer when it stands alone.
 */
const OWN_TASK_IO: Readonly<Record<string, ScriptIO>> = {
  // ── regen's slowest pairs, by measured wall time (seconds, both passes) ──
  "translation:block-qa:check": TREE_READER, //   456 s — `--check` compares `substantive()`, which drops commit SHAs and timestamps
  "kg:audit:all:check": TREE_READER, //            335 s — spawns `kg-audit.ts --check` per layer; the spawned source is in the tree
  // 107 s (2026-10-05). Read-only since bean `bo44`: `writesReport` is false
  // under `--check`, so this said "writes its registration report" a week after
  // it stopped (bean `8qyc`). Re-measured under strace on a clean tree: no
  // write in the repository; what it writes is what its sub-checks write, all
  // declared read-only here (the qa-store fetch below `.git/` is
  // `kg:audit:check`'s). In regen its sub-checks are folded (`pair-cover.ts`).
  "skill:register:check": TREE_READER,
  "kg:audit:check": TREE_READER, //                 81 s — `--check` compares the manifest and every sidecar, writes neither
  "readme:subgraphs:check": TREE_READER, //         25 s — writes its QA result only without `--check`
  "skills:docs:check": TREE_READER, //              19 s — returns before `writeFileSync`
  "processes:viz:check": TREE_READER, //            19 s
  "external-schemas:viz:check": TREE_READER, //     17 s — reads `git ls-files`, which the tree digest covers
  "kg:detangle:check": TREE_READER, //              15 s — writes only when not checking
  "audit:coverage:require-all": { ...TREE_READER, judge: true }, //     14 s — `writeQaResult` only without `--check`
  "audit:coverage:strict": { ...TREE_READER, judge: true }, //          14 s
  "lsi:viz:check": TREE_READER, //                  12 s
  "check:prov-qaqc": TREE_READER, //                12 s — exits before its write loop
  // ── read-only by measurement: no write under `strace` on a clean tree ──
  // Not skippable (no `inputs`): each may still read the environment, the
  // clock or the network. Re-measure before adding one; never add by name.
  "agent-memory:check": TREE_READER,
  "avatars:css:check": TREE_READER,
  "boards:default:check": TREE_READER,
  "bootstrap:schemas:check": TREE_READER,
  "kind:json-schemas:check": TREE_READER,
  "bootstrap:validate": READ_ONLY,
  "bootstrap:vocabulary:check": TREE_READER,
  "check:actor-reach": TREE_READER,
  "check:agent-entry-links": TREE_READER,
  "check:agents-claims": TREE_READER,
  "check:agents-xref": TREE_READER,
  "check:agents-xref:strict": TREE_READER,
  "check:anchor-names": TREE_READER,
  "check:artefact-verification": TREE_READER,
  "check:asset-roles": TREE_READER,
  "check:available-locales": READ_ONLY,
  "check:avatar-instances": TREE_READER,
  "check:bean-archive": TREE_READER,
  "check:bean-calls": TREE_READER,
  "check:context-leak": READ_ONLY,
  "check:bean-blocks": TREE_READER,
  "check:bean-bodies": TREE_READER,
  "check:bean-front-matter": TREE_READER,
  "check:bean-issue-links": READ_ONLY,
  "check:bean-parent-prose:check": TREE_READER,
  "check:bean-parents": TREE_READER,
  "check:bean-restates-skill": TREE_READER,
  "check:bean-rollup": READ_ONLY,
  "check:bootstrap-concepts": TREE_READER,
  "check:bun-pin": TREE_READER,
  "check:ci-invocations": READ_ONLY,
  "check:code-accounting": TREE_READER,
  "check:command-paths": READ_ONLY,
  "check:concern-groups": TREE_READER,
  "check:content-keys": READ_ONLY,
  "check:declaration-claims": TREE_READER,
  "check:declaration-filename": TREE_READER,
  "check:declared-assets": TREE_READER,
  "check:declaration-resolution": TREE_READER,
  "check:declared-dirs": TREE_READER,
  "check:declared-paths": TREE_READER,
  "check:docs-populated": TREE_READER,
  "check:docs-templates": TREE_READER,
  "check:escaped-markup:source": TREE_READER,
  "check:fallback-roles": TREE_READER,
  "check:folio-mount": TREE_READER,
  "check:graph-typology-work": TREE_READER,
  "check:harness-dirs": TREE_READER,
  "check:harness-state:check": READ_ONLY,
  "check:image-roles": TREE_READER,
  "check:import-direction": TREE_READER,
  "check:instance-config": TREE_READER,
  "check:instance-graph": READ_ONLY,
  "check:instance-render": READ_ONLY,
  "check:instance-themes:check": TREE_READER,
  "check:invocation-parity": TREE_READER,
  "check:kind-validators:require-all": READ_ONLY,
  "check:l1-complete": READ_ONLY,
  "check:lane-documentation": TREE_READER,
  "check:layout-norms": TREE_READER,
  "check:lockfile-pinning": TREE_READER,
  "check:methodology-evidence": TREE_READER,
  "check:model-languages": READ_ONLY,
  "check:module-scope-resolution": TREE_READER,
  "check:navbar-consistency:check": TREE_READER,
  "check:node-iris": TREE_READER,
  "check:orphan-verdicts": TREE_READER,
  "check:partition": TREE_READER,
  "check:portable-paths": READ_ONLY,
  "check:process-documentation": TREE_READER,
  "check:publishable": TREE_READER,
  "check:published-refs": TREE_READER,
  "check:python-deps": READ_ONLY,
  "check:qa-reviewer-permission": READ_ONLY,
  "check:raci": TREE_READER,
  "check:read-only-graphs": TREE_READER,
  "check:ready-to-close": TREE_READER,
  "check:red-gate-is-last": TREE_READER,
  "check:remote-skills": READ_ONLY,
  "check:rendered-labels": TREE_READER,
  "check:requirements": TREE_READER,
  "check:retired-front-matter": TREE_READER,
  "check:schema-nodes": TREE_READER,
  "check:secret-leaks": TREE_READER,
  "check:skills": TREE_READER,
  "check:soft-hyphens": TREE_READER,
  "check:source-licence": TREE_READER,
  "check:stale-field-advice": TREE_READER,
  "check:stale-paths": TREE_READER,
  "check:state-on-main": TREE_READER,
  "check:structure-accessor": TREE_READER,
  "check:subgraph-coverage": READ_ONLY,
  "check:subgraphs": TREE_READER,
  "check:tabular-stubs": TREE_READER,
  "check:term-mapping": TREE_READER,
  "check:theme-art:check": TREE_READER,
  "check:tools": TREE_READER,
  "check:tools-closure": TREE_READER,
  "check:upload-names:check": READ_ONLY,
  "check:uploads-retired": TREE_READER,
  "check:usage-paths": READ_ONLY,
  "check:viewer-backticks": TREE_READER,
  "check:viewer-nav": TREE_READER,
  "check:voice-skills": TREE_READER,
  "check:waivers": READ_ONLY,
  "check:wireframes": TREE_READER,
  "check:workflow-coverage": TREE_READER,
  "check:workflow-injection": TREE_READER,
  "check:workflow-tools": TREE_READER,
  "check:workflow-paths": TREE_READER,
  "check:workflow-policy": TREE_READER,
  "check:workflow-refs": TREE_READER,
  "check:workflow-script-paths": TREE_READER,
  "check:workflows": TREE_READER,
  "check:xml-comments": TREE_READER,
  "code-lists:check": TREE_READER,
  "vocab-mappings:check": TREE_READER,
  "deps:python:check": TREE_READER,
  "auto:docs:check": TREE_READER,
  "docs:harness:check": TREE_READER,
  "docs:pages:check": READ_ONLY,
  "external-schemas:check": TREE_READER,
  "folio:viz:check": TREE_READER,
  "fsh-guts:viz:check": TREE_READER,
  "gen:jsonld:check": READ_ONLY,
  "glossary:check": READ_ONLY,
  "glossary:check:bootstrap": READ_ONLY,
  "handler:index:check": TREE_READER,
  "harness:dirs:check": TREE_READER,
  "id-lookup:check": READ_ONLY,
  "iri:sync:check": TREE_READER,
  "jsonld:contexts:check": TREE_READER, // `--check` returns before the write loop; reads the corpus git lists
  "kg:detangle:direction": TREE_READER,
  "kg:schema:check": READ_ONLY,
  "kg:subscribe:check": READ_ONLY,
  // read: `--check` never writes; `beans:retag` is the writer. Not skippable —
  // the store is the mount, which the tracked-tree digest does not cover.
  "beans:retag:check": READ_ONLY,
  // read: `--check` compares each declaration's first key; `declarations:retag` writes.
  "declarations:retag:check": READ_ONLY,
  "beans:notes:check": READ_ONLY, // read: `checkNotes` only reads; the writer is `beans:notes`
  "landing:data:check": TREE_READER,
  "landing:sticky:check": READ_ONLY,
  "library:readmes:check": TREE_READER,
  "lint": READ_ONLY,
  "lsi:skills:check": TREE_READER,
  "methodologies:viz:check": TREE_READER,
  "navbar:assets:check": TREE_READER,
  "navbar:geometry:check": TREE_READER,
  "navbar:include:check": TREE_READER,
  "ns:check": TREE_READER,
  "readme:audit": TREE_READER,
  "readme:audit:root": TREE_READER,
  "readme:sync:all:check": TREE_READER,
  "readme:sync:check": TREE_READER,
  "readme:sync:root:check": TREE_READER,
  "root-scan-census:check": TREE_READER,
  "skill:commands:check": TREE_READER,
  "state:visualizer:check": TREE_READER,
  "subscriptions:viz:check": READ_ONLY,
  "theme:page:check": TREE_READER,
  "themes:css:check": TREE_READER,
  "tools:viz:check": TREE_READER,
  "translate-bpmn:bootstrap:check": TREE_READER,
  "translate-bpmn:check": TREE_READER,
  "translate-kg-viewer:check": READ_ONLY,
  "translated-links:check": READ_ONLY,
  "translation:catalogue:check": READ_ONLY,
  "translation:drift:check": TREE_READER,
  "translation:index:check": TREE_READER,
  "translation:obsolete:check": TREE_READER,
  "translation:pot:check": TREE_READER,
  "translation:status:check": READ_ONLY,
  "uml:overview:check": READ_ONLY,
  "upload-step:docs:check": TREE_READER,
  "voices:viz:check": TREE_READER,
  // ── regen's barriers, re-measured 2026-10-05 (bean `8qyc`) ──
  // Each was a pair regen ran ALONE only for want of a declaration: added to
  // the gate set after the 2026-10-01 sweep. Each `--check` ran under `strace -f`
  // on this tree and opened nothing for writing, created, renamed, removed or
  // truncated nothing (`.git/**/index.lock`, git's optional stat refresh, aside:
  // two concurrent refreshes skip rather than fail). AND each `--check` branch
  // was READ for a write that only a red verdict reaches — every one returns or
  // exits before its writer path, most through the judge (`concludeJudgement`
  // / `judgeQaResult`), which writes nothing by contract.
  "bat:sync:check": READ_ONLY,
  "check:avatar-coverage:check": TREE_READER,
  "check:l1-complete:check": READ_ONLY, //         `sidecarFor` only under `--write`
  "check:lane-documentation:check": TREE_READER,
  "check:layout-norms:check": TREE_READER,
  "check:library-qa:check": READ_ONLY, //          `writeQaResult` only in the else of `if (check)`
  "check:methodology-evidence:check": TREE_READER,
  "check:nav-names:check": READ_ONLY, //           ditto
  "check:rendered-labels:check": TREE_READER,
  "check:source-licence:check": TREE_READER,
  "check:undeclared-files:check": READ_ONLY, //    its one ftruncate is Bun's spawn-stdin memfd
  "kg:locale:check": READ_ONLY, //                 writes nothing; reads KG_BASE_URL, so still no `inputs`
  "kind:register:check": READ_ONLY, //             `--check` skips the write loop; its five verifies are READ_ONLY here
  "check:wireframes:check": TREE_READER,
  "document-kinds:viz:check": TREE_READER, //        its one `rmSync` is in the not-`check` arm
  "node-kind:pages:check": READ_ONLY, //           its one `rmSync` is in the not-`check` arm
  "qa:attestations:migrate:check": TREE_READER, //   `--check` passes `dryRun` to the kg trees and `check` to criteria
  "slice:sqlite:vendor:check": TREE_READER,
  "kg-graph:vendor:check": TREE_READER, //         the same byte comparison, for the vendored Graphviz WASM
  // NO `inputs` for these five, read rather than assumed (bean `8qyc`): four
  // build through `kg-export.ts`'s `buildExport`, which stamps the document
  // with `stagingFields(process.env)` (`staging-stamp.ts`), and `kg:export`
  // also reads `KG_BASE_URL`; `render:bpmn` renders through whatever Chromium
  // the machine has. An answer that depends on the environment may not be
  // skipped, so they are always asked — in the pool now, rather than alone.
  //
  // These five DO write, and only into a directory each makes for itself with
  // `mkdtemp` (strace `-y` resolved every write fd: nothing outside
  // `/tmp/<own prefix>-XXXXXX`, Chromium's per-launch profile included) and
  // removes before exiting. No other process can name that directory, so
  // nothing another pair reads moves — which is the property `outputs: []`
  // exists to assert. Two were RED when measured (a stale skill payload on
  // `main`), so the red `--check` path was traced as well as read.
  "check:published-instance-exports": READ_ONLY, // 49 s; exports into `published-instance-export-*`, `--qa-root` there too (bean `ymsu`)
  "kg:export:check": READ_ONLY, //                  13 s; `sidecarMode("check")` judges, `writeQaResult` is the write mode's
  "render:bpmn:check": READ_ONLY, //                5 s; `emit` returns before `writeFile` under `--check`
  "slice:sqlite:check": READ_ONLY, //               12 s; `checkSlice` builds in `slice-check-*` / `slice-sqlite-*`
  "subgraph:jsonld:check": READ_ONLY, //            15 s; `if (check)` returns before `rmSync` / `writeFileSync`
};

/**
 * {@link OWN_TASK_IO} plus every present layer's declared `taskIo`.
 *
 * A key declared twice — by two layers, or by a layer and this table —
 * THROWS rather than letting one win: two owners of one task is a placement
 * defect, and silently picking either would make `outputs: []` a claim nobody
 * owns. A layer whose `taskIo` is absent contributes nothing; standalone,
 * with no layer above this layer present, the result is the own rows alone.
 */
export function collectTaskIo(
  repoRoot: string,
  own: Readonly<Record<string, ScriptIO>> = OWN_TASK_IO,
): Readonly<Record<string, ScriptIO>> {
  const out: Record<string, ScriptIO> = { ...own };
  const ownerOf = new Map<string, string>(Object.keys(own).map((k) => [k, "cat-harness-tools/scripts/task-io.ts"]));
  for (const instance of layerRootsIn(repoRoot)) {
    // A REMOTE-MOUNTED layer's `taskIo` names scripts in ITS repository's
    // package.json, not this checkout's (bean `hupw`: a retired layer's
    // gates leave with it), so it contributes nothing here.
    if (mountScopeFor(instance) !== undefined) continue;
    const declared = readDeclaration(instance)?.taskIo;
    if (declared === undefined) continue;
    for (const [task, io] of Object.entries(declared)) {
      const prior = ownerOf.get(task);
      if (prior !== undefined) {
        throw new Error(`task "${task}" is declared by both ${prior} and ${instance} — one task, one owner`);
      }
      ownerOf.set(task, instance);
      // A row that declares only `writes` is about generated files, not about
      // running the task: it stays out of this table (see `collectTaskWrites`).
      if (Object.keys(io).every((k) => k === "writes" || k === "because")) continue;
      out[task] = {
        ...(io.inputs === undefined ? {} : { inputs: io.inputs }),
        ...(io.outputs === undefined ? {} : { outputs: io.outputs }),
        ...(io.writer === undefined ? {} : { writer: io.writer }),
        ...(io.afterMerge === undefined ? {} : { afterMerge: io.afterMerge }),
      };
    }
  }
  return out;
}

/**
 * The committed files each task WRITES, declared as globs (litlfred/cat-harness#693,
 * owner 2026-10-29): bare is relative to the declaring layer,
 * `<instance>:<glob>` names another layer's file. `check:generated-writers`
 * warns on every matched file that carries no generated marker.
 *
 * This layer's own writers are {@link OWN_WRITES}; a layer above declares
 * its own as `taskIo.<task>.writes`. Kept apart from {@link TASK_IO}, whose
 * rows decide how a task RUNS: a writer named here gains no `inputs` or
 * `outputs` claim by being listed.
 */
export const OWN_WRITES: Readonly<Record<string, readonly string[]>> = {
  "schema:docs": ["cat-harness:docs/reference/skills/*.md"],
  "kind:json-schemas": ["cat-harness:schemas/kinds/*.schema.json"],
  "upload-step:docs": ["cat-harness:docs/reference/upload-step/index.md"],
  "prov:qaqc": ["cat-harness:docs/prov-qaqc/index.md"],
};

export interface TaskWrites {
  task: string;
  /** The layer root bare globs are relative to. */
  instance: string;
  globs: readonly string[];
}

/** {@link OWN_WRITES} plus every present layer's `taskIo.<task>.writes`. */
export function collectTaskWrites(repoRoot: string, own: Readonly<Record<string, readonly string[]>> = OWN_WRITES): TaskWrites[] {
  const toolsRoot = dirname(import.meta.dir);
  const out: TaskWrites[] = Object.entries(own).map(([task, globs]) => ({ task, instance: toolsRoot, globs }));
  for (const instance of layerRootsIn(repoRoot)) {
    if (mountScopeFor(instance) !== undefined) continue;
    for (const [task, io] of Object.entries(readDeclaration(instance)?.taskIo ?? {})) {
      const globs = (io as { writes?: readonly string[] }).writes;
      if (globs !== undefined) out.push({ task, instance, globs });
    }
  }
  return out;
}

export const TASK_IO: Readonly<Record<string, ScriptIO>> = collectTaskIo(
  checkoutRootFor(dirname(import.meta.dir)),
);

/**
 * A verify/write pair's declaration — its CHECK's. The writer needs none: in
 * `regen` every writer runs alone, whatever it declares. `undefined` when the
 * check is undeclared, which makes the pair run alone and never be skipped.
 */
export function pairIO(check: string): PairIO | undefined {
  const c = TASK_IO[check];
  return c === undefined ? undefined : { inputs: c.inputs, outputs: c.outputs };
}

/** Whether a gate command runs exactly one script that declares it writes nothing. */
export function gateReadsOnly(command: string): boolean {
  const m = /^bun run (?:cat )?([A-Za-z0-9:_-]+)\s*$/.exec(command.trim());
  if (m === null) return false;
  const io = TASK_IO[m[1]!];
  return io?.outputs !== undefined && io.outputs.length === 0;
}
