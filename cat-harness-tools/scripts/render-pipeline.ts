#!/usr/bin/env bun
/**
 * render-pipeline.ts — the repository's renders, in the order their
 * dependencies imply, with the failure policy declared per step.
 *
 * ## Two exports, three stages
 *
 * | stage | what it renders | on failure |
 * |---|---|---|
 * | 1 | the CURRENT declared state, as json/jsonld — then the README from it | **fatal** |
 * | 2 | the dynamic parts: viewers, visualisers, doc pages, diagrams | skip + log |
 * | 3 | the dynamic state, exported once the stage-2 renderers have contributed | fatal |
 *
 * **Stage 1 is fatal because everything downstream is derived from it**: a
 * README generated from a half-read graph states a wrong fact in the file a
 * reader opens first. **Stage 2 is not fatal** because a missing visualiser
 * costs one rendering and nothing else. That policy lives on each
 * {@link OrderedStep}, not in this runner: see `dependency-order.ts` for why.
 *
 * ## Bootstrap is the exception, and it is declared as one
 *
 * Bootstrap renders before the graph is read at all, because it is what an
 * agent reads when no harness is installed. It is the same exemption
 * `check:subgraph-coverage` grants it from the `visualiser` criterion, and it
 * is a SECOND criterion rather than a hole: bootstrap owes its own
 * .json/.jsonld instead.
 *
 * ## What this file is NOT
 *
 * It is not a second CI workflow. `docs-site.yml` remains what publishes; this
 * declares the ORDER and the policy in one readable, testable place, runs it
 * locally, and gives CI one thing to call per stage.
 *
 * @module scripts/render-pipeline
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { flattenDependencies, runInOrder, type OrderedStep } from "../schemas/kg/dependency-order.js";
import { buildManifest, readManifest, selectSteps } from "./render-selection.js";
import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** A step, plus the command that performs it. */
interface RenderStep extends OrderedStep {
  /** Argv, run from the repository root. */
  run?: string[];
  /**
   * What this step READS, repository-relative — bean `9c34`.
   *
   * Declared so an incremental render can tell whether a seeded output is
   * still current. **Under-declaring is the dangerous direction**: a step
   * whose real input is not listed keeps a stale output and looks exactly
   * like one that re-rendered. Over-declaring only costs a needless re-run.
   *
   * Absent is not "reads nothing" — it is "has not said", and such a step
   * always runs. `check:render-inputs` reports which steps are in that state.
   */
  inputs?: readonly string[];
  /**
   * Graph TYPOLOGIES this step reads, resolved from `harness.json`.
   *
   * Preferred over `inputs`: `check:declared-paths` rejected the first draft
   * for spelling nine declared directories as literals, and it was right —
   * a second answer to "where do the skills live" goes stale the moment one
   * moves, while the render goes on hashing a path that is not there and
   * reporting everything unchanged.
   */
  inputGraphs?: readonly string[];
  /** Run every time regardless of the seed, and why. */
  alwaysRun?: string;
  /**
   * This step is DECLARED but not yet performable, and why.
   *
   * A third outcome, and it exists because the first draft did not have it:
   * the bootstrap step was written as `kg-export --root bootstrap`, and
   * `kg-export` has no `--root` flag. The argument would have been ignored and
   * the whole graph exported under bootstrap's name — a step reporting success
   * while doing something else entirely, which is the one failure a pipeline
   * report must never produce. Naming the gap costs a line; discovering it
   * from a wrong artefact costs a release.
   */
  pending?: string;
}

/**
 * The pipeline, declared.
 *
 * `needs` is the ONLY thing that orders this list — the array order here is
 * the tie-break and nothing more, so a step can be moved without changing
 * what runs when. Read the `needs` field, not the position.
 */
export function pipeline(scratch: string): RenderStep[] {
  return [
    // ── Stage 0: the exception ──────────────────────────────────────────
    //
    // It depends on NOTHING and nothing depends on it, which is what "as an
    // exception" means here: bootstrap is read when no harness is installed,
    // so it cannot wait on the graph and the graph must not wait on it.
    {
      id: "bootstrap",
      fatal: false,
      label: "bootstrap's own json/jsonld — renders before the graph is read",
      pending:
        "bootstrap owes its own .json/.jsonld (bean `hfkl`, and the exemption in `check:subgraph-coverage` says so) and no exporter takes an instance root yet",
    },

    // ── Stage 1: current state, then the README derived from it ─────────
    {
      id: "kg-current",
      fatal: true,
      // Reads the DECLARATIONS and everything they point at. Bean `9c34`:
      // these are what a seeded render compares against, so a step that
      // under-declares silently keeps a stale output.
      inputGraphs: ["schemas", "cat-harness", "tools"],
      label: "the CURRENT declared state as json/jsonld — fatal: everything below is derived from it",
      run: ["bun", "run", "cat-harness-tools/scripts/kg-export.ts", "--out", join(scratch, "current.jsonld")],
    },
    {
      id: "readme",
      needs: ["kg-current"],
      fatal: true,
      inputs: ["README.md"],
      label: "the repository README's generated sections — fatal: it is the file a reader opens first",
      // `--dir .` is the REPOSITORY layer. Without it the sync resolves to
      // whichever layer carries a `folio/`, which is cat-harness — whose
      // README carries no markers, so the root's layers table would go
      // stale while the command reported success.
      run: ["bun", "run", "cat", "readme:sync", "--dir", "."],
    },

    // ── Stage 2: the dynamic parts, skip/log on failure ─────────────────
    { id: "schema-docs", needs: ["readme"], fatal: false, inputGraphs: ["schemas"], label: "skill schema reference", run: ["bun", "run", "cat-harness-tools/scripts/gen-schema-docs.ts"] },
    { id: "skill-docs", needs: ["readme"], fatal: false, inputGraphs: ["cat-harness"], label: "skill instruction pages", run: ["bun", "run", "cat-harness-tools/scripts/gen-skill-docs.ts"] },
    {
      id: "docs-pages",
      needs: ["readme"],
      fatal: false,
      inputGraphs: ["beans", "todos"],
      // declared-path-literal: the `folio` graph typology is CORE's — registered
      // by `schemas/kg/folio-graph-typology.ts`, which this layer may not import
      // ("a layer that cannot render must not own the renderable kind"). So
      // asking the resolver for it throws, and the authored pages would
      // otherwise go undeclared — which under-declares, the direction bean
      // `9c34` calls dangerous. Named here rather than resolved.
      inputs: ["cat-harness/docs/source"],
      label: "content-backed docs pages",
      run: ["bun", "run", "cat-harness-tools/scripts/gen-docs-pages.ts"],
    },
    { id: "bpmn", needs: ["readme"], fatal: false, inputGraphs: ["cat-harness"], label: "BPMN workflow diagrams", run: ["bun", "run", "cat", "render:bpmn"] },
    // `needs: ["skill-docs"]` is a real edge and not alphabetical: auto-docs
    // indexes the skill markdown, and a run that raced the generator writing
    // it would index a directory mid-write. It is NOT fatal — a missing index
    // costs one rendering, and the authored pages that reference it are what
    // carry the meaning (bean `06e3`).
    { id: "auto-docs", needs: ["skill-docs", "bpmn"], fatal: false, inputGraphs: ["cat-harness"], label: "derived sub-graph indexes", run: ["bun", "run", "cat", "auto:docs"] },
    // `needs: ["docs-pages"]`, and it is a REAL dependency rather than a
    // tidy-looking one: the state visualiser decides each graph's state by
    // asking whether `assets/<id>/index.json` is on disk, and `docs-pages` is
    // what writes it. Run the other way round, `beans` and `todos` render as
    // "declared" — wrong pages, exit 0, nothing to notice. Bean `flh4`.
    { id: "state-dashboards", needs: ["docs-pages"], fatal: false, inputGraphs: ["beans", "todos"], label: "state graph dashboards", run: ["bun", "run", "cat-harness-tools/scripts/state-visualizer.ts"] },

    // ── Stage 3: the dynamic state, after stage 2 has contributed ───────
    //
    // The owner named this *"cat-harness/state.jsonld or so (whatever matches
    // the dyanmic state vsualizesrs)"*, and settled it on 2026-10-29 (bean
    // 6h47, option A): the workflow pages are the dynamic-state visualiser,
    // and they read `<site>/<harness>/state.jsonld`: the running instances,
    // their positions and their stuck states, typed `cat-harness:DynamicState`
    // so it cannot be mistaken for the stage-1 graph export.
    {
      id: "kg-dynamic",
      // Declared ALWAYS-RUN rather than left input-less. Its stuck states are
      // measured against the clock (a token unmoved for a week is stuck), so
      // the same committed layer files give a different document tomorrow,
      // and there is no source hash that would make caching it correct.
      // Saying so is different from not saying: an undeclared step also
      // always runs, but nobody can tell whether that was a decision.
      alwaysRun: "exports the running workflows' state as of this run: a token ages by the clock, not by a source file",
      needs: ["schema-docs", "skill-docs", "docs-pages", "bpmn"],
      fatal: true,
      label: "the DYNAMIC state (<site>/<harness>/state.jsonld), exported after the stage-2 renderers have contributed",
      run: ["bun", "run", "cat-harness-tools/scripts/dynamic-state-export.ts"],
    },
  ];
}

export interface PipelineReport {
  text: string;
  exitCode: number;
}

export function runPipeline(
  repoRoot: string,
  opts: { dryRun?: boolean; seedManifest?: string; writeManifest?: string } = {},
): PipelineReport {
  const scratch = mkdtempSync(join(tmpdir(), "render-pipeline-"));
  try {
    const steps = pipeline(scratch);
    const { order, problems } = flattenDependencies(steps);

    if (problems.length > 0) {
      // A broken graph is never partially run — see rule 3/4 in
      // `dependency-order.ts`. Reported as a failure of the PIPELINE
      // DECLARATION, which is a different defect from a step that failed.
      return {
        text: ["The render pipeline cannot be ordered:", ...problems.map((p) => `  ✗ ${p.detail}`)].join("\n"),
        exitCode: 2,
      };
    }

    if (opts.dryRun) {
      return {
        text: [
          "Render order (flattened from `needs`; ties break on declaration order):",
          ...order.map((s, i) => {
            const r = s as RenderStep;
            const p = r.pending === undefined ? "" : " [pending] ";
            // The cacheability mark, so the incremental behaviour is visible
            // in the same list as the order rather than only at run time.
            const cache = r.alwaysRun !== undefined ? "always" : (r.inputs?.length ?? 0) + (r.inputGraphs?.length ?? 0) > 0 ? "cached" : "UNDECL";
            return `  ${String(i + 1).padStart(2)}. ${s.id.padEnd(16)} ${s.fatal ? "FATAL " : "skip  "} ${cache.padEnd(6)} ${p}${s.label ?? ""}`;
          }),
          "",
          // Named, not counted silently. An UNDECL step always re-renders, so
          // it is the ceiling on how incremental a build can be — and bean
          // `9c34` is explicit that under-declaring is the dangerous
          // direction, since a step whose real input is unlisted keeps a
          // stale output and looks exactly like one that re-rendered.
          ...(() => {
            const undecl = (order as RenderStep[]).filter(
              (r) => r.alwaysRun === undefined && !r.inputs?.length && !r.inputGraphs?.length,
            );
            return undecl.length === 0
              ? ["Every step declares its inputs or says why it always runs."]
              : [
                  `${undecl.length} step(s) declare no inputs, so they re-render every build:`,
                  ...undecl.map((r) => `  UNDECL ${r.id}${r.pending === undefined ? "" : " (pending — nothing to cache yet)"}`),
                ];
          })(),
        ].join("\n"),
        exitCode: 0,
      };
    }

    // ── Incremental: which steps actually need to run (bean `9c34`) ──────
    //
    // Only when a seed is supplied. Without one this is a FULL render, which
    // is the correct answer rather than a degraded one — `selectSteps` says
    // the same by returning every step.
    const seed = opts.seedManifest === undefined ? undefined : readManifest(opts.seedManifest);
    const seedMissing = opts.seedManifest !== undefined && seed === undefined;
    // The resolver turns a declared GRAPH TYPOLOGY into the directories that hold
    // it, so no step spells a declared path (`check:declared-paths`).
    //
    // **It can fail, and failing is a real state rather than a crash.**
    // `readDeclaration` validates EVERY kind in the declaration, not just the
    // one being asked for — and this repository declares a `folio` directory
    // whose kind is registered by CORE, on import of a module this layer may
    // not import ("a layer that cannot render must not own the renderable
    // kind"). So resolution throws here, and the honest answer is the one
    // this whole module already keeps: **could not determine, so run.** Every
    // step that declared only graphs becomes undeclared, which always
    // re-renders — the safe direction, and said out loud rather than
    // silently under-declared.
    // Resolved ACROSS THE LAYER BOUNDARY, by spawning — the same way this
    // pipeline already reaches every renderer it runs.
    //
    // `readDeclaration` validates every kind in the declaration, not just the
    // one asked for, and this repository declares a `folio` directory whose
    // kind is core's. So the harness layer cannot resolve any kind in-process
    // without importing core, which `check:partition` rejects and which the
    // argument on `folio-graph-typology.ts` forbids. One subprocess answers it
    // without moving either boundary.
    //
    // A failure is REPORTED and turns every graph-declared step undeclared,
    // which always re-renders. Safe direction, said out loud.
    let resolveFailure: string | undefined;
    let declared: Record<string, string[]> = {};
    {
      const wanted = [...new Set((order as RenderStep[]).flatMap((r) => r.inputGraphs ?? []))].sort();
      if (wanted.length > 0) {
        const r = spawnSync("bun", ["run", "cat-harness-tools/scripts/declared-dirs.ts", ...wanted], {
          cwd: repoRoot,
          encoding: "utf-8",
        });
        if (r.status === 0 && r.stdout) {
          try {
            declared = JSON.parse(r.stdout) as Record<string, string[]>;
          } catch {
            resolveFailure = "declared-dirs.ts produced no parseable JSON";
          }
        } else {
          resolveFailure = (r.stderr || `declared-dirs.ts exited ${r.status}`).split("\n")[0];
        }
      }
    }
    const resolve = (graph: string): string[] => declared[graph] ?? [];

    const selection =
      opts.seedManifest === undefined
        ? undefined
        : selectSteps(repoRoot, order as RenderStep[], seed, resolve);
    const willRun = selection === undefined ? undefined : new Set(selection.run);

    const pending: string[] = [];
    const cached: string[] = [];
    const { records, stopped } = runInOrder(order, (step) => {
      const s = step as RenderStep;
      if (willRun !== undefined && !willRun.has(s.id)) {
        // The seeded output stands. Recorded as CACHED rather than as a pass
        // or a skip: a skip in this pipeline means "its input never
        // rendered", which is a different and much worse fact.
        cached.push(s.id);
        return undefined;
      }
      if (s.pending !== undefined) {
        pending.push(`${s.id}: ${s.pending}`);
        return undefined;
      }
      if (s.run === undefined) return undefined;
      const r = spawnSync(s.run[0]!, s.run.slice(1), { cwd: repoRoot, stdio: "inherit" });
      if (r.error) return r.error.message;
      return r.status === 0 ? undefined : `exited ${r.status}`;
    });

    const out = ["Render pipeline:"];
    const isPending = (id: string): boolean => pending.some((p) => p.startsWith(`${id}: `));
    for (const r of records) {
      // PENDING is reported as its own mark, never as a tick: a declared step
      // that has no implementation and a step that ran clean must not read the
      // same in the report a person skims.
      const mark = cached.includes(r.step.id)
        ? "="
        : isPending(r.step.id)
          ? "◻"
          : r.outcome === "ran"
            ? "✓"
            : r.outcome === "failed"
              ? "✗"
              : "–";
      const why = r.detail === undefined ? "" : ` — ${r.detail}`;
      out.push(`  ${mark} ${r.step.id}${why}`);
    }

    // A skipped step is reported as a SKIP and never as a pass: the whole
    // point of the cascade is that output which looks complete is not.
    const failed = records.filter((r) => r.outcome === "failed");
    const skipped = records.filter((r) => r.outcome === "skipped");
    out.push("");
    // `ran` EXCLUDES the cached ones. `runInOrder` records a step as having
    // run whenever the callback returned no error, and a cached step returns
    // no error because it did nothing — so the first draft reported
    // "10 ran ... 8 served from the seed", double-counting eight of them. A
    // build report that adds up to more than its own steps is one nobody
    // trusts the rest of.
    const cachedIds = new Set(cached);
    const ranCount = records.filter((r) => r.outcome === "ran" && !cachedIds.has(r.step.id)).length;
    out.push(
      `${ranCount} ran, ${failed.length} failed, ${skipped.length} skipped` +
        (selection === undefined ? "." : `, ${cached.length} served from the seed.`),
    );
    if (resolveFailure !== undefined) {
      out.push(
        `Graph typologies could not be resolved here, so every step that declared only graphs re-rendered: ${resolveFailure}`,
      );
    }
    if (seedMissing) {
      // Never silent. A seed that could not be read is the difference between
      // an incremental build and a full one, and a reader comparing two build
      // times deserves to know which they got.
      out.push(`Seed \`${opts.seedManifest}\` was absent or unreadable — this was a FULL render.`);
    }
    if (selection !== undefined && cached.length > 0) {
      out.push("");
      out.push("Served from the seed (inputs unchanged since it was built):");
      for (const id of cached) out.push(`  = ${id}`);
    }
    if (selection !== undefined) {
      out.push("");
      out.push("Re-rendered, and why:");
      for (const id of selection.run) out.push(`  ▸ ${id} — ${selection.why[id]!.detail}`);
    }
    if (stopped !== undefined) {
      out.push(`STOPPED at \`${stopped}\` — a fatal step. Nothing after it was attempted.`);
      return { text: out.join("\n"), exitCode: 1 };
    }
    if (failed.length > 0) {
      out.push("Non-fatal failures: the renderings above are MISSING, not empty. Raise them as QA, not as a clean run.");
    }
    if (pending.length > 0) {
      out.push("");
      out.push("Declared but not yet performable:");
      for (const p of pending) out.push(`  ◻ ${p}`);
    }
    if (opts.writeManifest !== undefined) {
      // Written from the steps that were DECLARED, not from the ones that
      // ran: a cached step's inputs are current by definition, and omitting
      // it would make the next build re-run it for no reason.
      mkdirSync(dirname(opts.writeManifest), { recursive: true });
      writeFileSync(
        opts.writeManifest,
        JSON.stringify(buildManifest(repoRoot, order as RenderStep[], undefined, resolve), null, 2) + "\n",
      );
      out.push("");
      out.push(`Manifest written to ${opts.writeManifest} — the next build compares against it.`);
    }
    return { text: out.join("\n"), exitCode: 0 };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const repoRoot = repoRootFor(HARNESS_ROOT);
  const flag = (name: string): string | undefined => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const report = runPipeline(repoRoot, {
    dryRun: process.argv.includes("--dry-run"),
    seedManifest: flag("--seed"),
    writeManifest: flag("--write-manifest"),
  });
  (report.exitCode === 0 ? console.log : console.error)(report.text);
  process.exit(report.exitCode);
}
