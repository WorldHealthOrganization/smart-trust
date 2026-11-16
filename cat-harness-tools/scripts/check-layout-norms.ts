#!/usr/bin/env bun
/**
 * No declared directory sits inside another declared directory.
 *
 * A layer's assets live at `<stub>/<asset>` — `cat-harness/skills/`,
 * `<content>/library/`, `<ig>/methodologies/`. A root declaration reaching
 * down a multi-level path is not allowed. Nesting declared from within (a
 * sub-graph node in the first subdirectory labelling the ones inside it) is
 * allowed but not yet recognised here; when that node kind exists, this check
 * must stop reporting the nestings it describes.
 *
 * A pair is also not a finding when one of the child's typologies declares
 * `within` equal to one of the parent directory's typologies (e.g.
 * `library/<entry>/l1-extraction/` with a typology `within: "library"`). The
 * rule reads the typology registry, never a kind name, the same reading
 * `lib/library-entry-graphs.ts` makes to publish that directory.
 *
 * The test is containment, not depth: `<content>/library/` is two segments
 * deep and fine. The containment relation comes from `subgraphTree`; this
 * check computes no geometry of its own.
 *
 * Enforcement is a RATCHET: known pairs sit in a committed baseline and
 * anything not in it fails. Removing a pair prints as fixed, not a failure;
 * `--update` rewrites the baseline.
 *
 * Usage:
 *   bun run cat check:layout-norms
 *   bun run cat check:layout-norms -- --update    # rewrite the baseline
 *   bun run cat check:layout-norms -- --json      # sidecar only
 *   bun run cat check:layout-norms:check          # JUDGE: compute and judge, write nothing (the gate)
 *
 * Exit: 0 clean (or only known pairs), 1 a pair not in the baseline,
 *       2 could not determine. Judge mode (`--check`) keeps the
 *       same table and adds 2 for an unknown flag or a run that threw.
 *
 * @module scripts/check-layout-norms
 * @covers cat-harness
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  layerRootsIn,
  readDeclaration,
  repoRootFor,
  resolveDirectories,
  subgraphTree,
} from "../schemas/kg/cat-harness.ts";
import { defaultGraphTypologies, type GraphTypologyRegistry } from "../schemas/kg/graph-typology-registry.ts";
import {
  buildQaResult,
  concludeJudgement,
  judgementOf,
  judgeUsage,
  judging,
  writeQaResult,
  type Judgement,
  type QaResult,
} from "./qa-results.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";

const INSTANCE_ROOT = HARNESS_ROOT;
const REPO_ROOT = repoRootFor(INSTANCE_ROOT);

/**
 * Known pairs, committed.
 *
 * Beside this module rather than in the declaration: it records what has NOT
 * been done yet, which is a property of the work rather than of the graph, and
 * a declaration that carried its own exceptions would be asserting them as
 * intended layout.
 */
const BASELINE = join(TOOLS_ROOT, "scripts", "layout-norms-baseline.json");

/**
 * `<instance>: <outer path> contains <inner path>` — the stable spelling of a pair.
 *
 * KEYED ON PATHS, NOT IDS, and that is a correction rather than a preference.
 * `resolveDirectories` merges a layer's DECLARED directories with the
 * conventional ones, existence-filtered. Where a layer declares a
 * directory the convention also supplies — `agent-skills` declares
 * `skills/voices/` while `skills/` arrives as the default `cat-harness` entry
 * — the same physical nesting surfaces under more than one id, and an
 * id-keyed report counted a fixture's single nesting FOUR times.
 *
 * A nesting is a fact about two directories. Two ids for one directory is a
 * property of how the set was assembled, and letting it into the count would
 * make the number this check reports meaningless — the "never quote a count
 * from prose" rule, arriving in a script instead.
 */
export function pairKey(instance: string, parentPath: string, childPath: string): string {
  const trim = (p: string): string => p.replace(/\/+$/, "");
  return `${instance}: ${trim(parentPath)} contains ${trim(childPath)}`;
}

export interface LayoutReport {
  undetermined: boolean;
  instances: number;
  /** Every nested pair found, as `pairKey` strings. */
  found: string[];
  /** Found and not in the baseline — these fail. */
  unexpected: string[];
  /** In the baseline and no longer found — progress, never a failure. */
  fixed: string[];
}

export function readBaseline(file = BASELINE): string[] {
  if (!existsSync(file)) return [];
  const raw = JSON.parse(readFileSync(file, "utf-8")) as { pairs?: string[] };
  return raw.pairs ?? [];
}

export function checkLayoutNorms(
  repoRoot = REPO_ROOT,
  baselineFile = BASELINE,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): LayoutReport {
  const roots = layerRootsIn(repoRoot);
  const r: LayoutReport = {
    undetermined: roots.length === 0,
    instances: 0,
    found: [],
    unexpected: [],
    fixed: [],
  };
  if (r.undetermined) return r;

  for (const root of roots) {
    const decl = readDeclaration(root, registry);
    if (decl === undefined) continue;
    r.instances += 1;
    const name = decl.name ?? basename(root);
    const dirs = resolveDirectories([{ name, root, own: true }], registry);
    const pathOf = new Map(dirs.map((d) => [d.id, d.path]));
    // The typologies at each PATH, unioned over every id naming it (see
    // `pairKey`): a parent's kind may arrive by its declared entry or a default.
    const kindsAt = new Map<string, Set<string>>();
    for (const d of dirs) {
      const s = kindsAt.get(d.path) ?? new Set<string>();
      for (const k of d.graphTypologies ?? []) s.add(k);
      kindsAt.set(d.path, s);
    }
    // A sub-graph KIND held inside its parent's (bean 8pzh; module doc): one of
    // the child's typologies is, in the registry, `within` one of the parent's.
    const kindWithin = (childPath: string, parentPath: string): boolean => {
      const parentKinds = kindsAt.get(parentPath) ?? new Set<string>();
      return [...(kindsAt.get(childPath) ?? [])].some((k) => {
        const w = registry.get(k)?.within;
        return w !== undefined && parentKinds.has(w);
      });
    };
    // Nesting declared FROM WITHIN (the owner's #980 ruling; bean cmsl): the
    // inner directory is named by a declaration file inside the outer one, so
    // the pair is the sanctioned shape and never a finding.
    const withinOf = new Map(dirs.map((d) => [d.id, d.within]));
    for (const rel of subgraphTree(dirs)) {
      const parentPath = pathOf.get(rel.parent);
      if (parentPath === undefined) continue;
      for (const child of rel.children) {
        const childPath = pathOf.get(child);
        if (childPath === undefined) continue;
        // By PATH, not id: two ids may name one directory (core's `core-skills`
        // and the default `skills` are both `skills/`), and the nesting is a
        // fact about the place.
        const within = withinOf.get(child);
        if (within !== undefined && pathOf.get(within) === parentPath) continue;
        // SIBLINGS in one declaration file are the same sanctioned shape. The
        // rule above only recognises a child whose `within` IS the parent, so
        // it missed the case where both were declared by the same file and one
        // path happens to sit under the other — `beans/beans.json` naming
        // `defs` at `defs/` and `archive` at `defs/archive/`, both
        // `within: "beans"`. That is a path choice inside ONE declaration, not
        // "a root declaration reaching down", which is what this check says it
        // guards against.
        //
        // It surfaced only when `subgraph: true` stopped gating promotion: the
        // pair had never resolved, so the nesting was real and invisible. The
        // alternative was moving `beans/defs/archive/` to `beans/archive/`, and
        // that cannot hold — `beans archive` has no path flag and derives the
        // directory as `<path>/archive` from `.beans.yml`, so the third-party
        // CLI would recreate it (bean `wekz` recorded the same dependency).
        if (within !== undefined && within === withinOf.get(rel.parent)) continue;
        if (kindWithin(childPath, parentPath)) continue;
        r.found.push(pairKey(name, parentPath, childPath));
      }
    }
  }
  // Deduplicated: see `pairKey` on why one nesting can surface under several ids.
  r.found = [...new Set(r.found)].sort();

  const known = new Set(readBaseline(baselineFile));
  r.unexpected = r.found.filter((p) => !known.has(p));
  const seen = new Set(r.found);
  r.fixed = [...known].filter((p) => !seen.has(p)).sort();
  return r;
}

/** The sidecar document for a report. Pure, so the judge and the writer render ONE computation. */
export function layoutNormsDocument(r: LayoutReport): QaResult {
  return buildQaResult({
    script: "cat-harness-tools/scripts/check-layout-norms.ts",
    scriptAbsPath: fileURLToPath(import.meta.url),
    subject: { kind: "corpus", id: "declared-directories" },
    families: {
      "nested-declaration": {
        summary:
          "A declared directory contained by another declared directory — an asset buried below its " +
          "stub instead of sitting at `<stub>/<asset>`. A consumer scanning the outer graph must then " +
          "decide whether the inner one's nodes are also its own (bean `x4v4`), and every count " +
          "computed from that sweep depends on the answer. Known pairs are baselined so outstanding " +
          "work does not fail the gate; a pair not in the baseline does.",
        entries: r.found.map((pair) => ({ pair, known: !r.unexpected.includes(pair) })),
      },
    },
  });
}

/** Bean `bo44`'s four states over a report: only a pair NOT in the baseline is a finding. */
export function judgeLayoutNorms(r: LayoutReport): Judgement {
  return judgementOf({ failing: r.unexpected.length, undetermined: r.undetermined });
}

if (import.meta.main) {
  const GATE = "check:layout-norms";
  if (judging()) {
    // Judge mode: compute, judge, write NOTHING — neither the sidecar nor the
    // baseline (bean `bo44`). `--update` is a writer's flag and is refused here.
    const usage = judgeUsage(GATE, process.argv.slice(2), []);
    if (usage !== undefined) process.exit(usage);
    let jr: LayoutReport;
    try {
      jr = checkLayoutNorms();
    } catch (e) {
      process.exit(concludeJudgement({ gate: GATE, judgement: "error", detail: (e as Error).message }));
    }
    for (const p of jr.unexpected) console.error(`  ✗ not in the baseline: ${p}`);
    for (const p of jr.fixed) console.log(`  ✓ FIXED, no longer nested: ${p} (shrink the baseline with --update)`);
    process.exit(
      concludeJudgement({
        gate: GATE,
        judgement: judgeLayoutNorms(jr),
        detail: jr.undetermined
          ? "no instance declaration found under the repository root"
          : `${jr.instances} instance(s), ${jr.found.length} nested pair(s), ${jr.unexpected.length} not baselined`,
        ...(jr.undetermined
          ? {}
          : { committed: { root: INSTANCE_ROOT, stem: "layout-norms", fresh: layoutNormsDocument(jr), writer: GATE } }),
      }),
    );
  }

  const r = checkLayoutNorms();

  if (r.undetermined) {
    console.error("UNDETERMINED: no instance declaration found under the repository root.");
    console.error("This is not a pass — nothing was checked.");
    process.exit(2);
  }

  writeQaResult(INSTANCE_ROOT, "layout-norms", layoutNormsDocument(r));

  if (process.argv.includes("--update")) {
    writeFileSync(
      BASELINE,
      `${JSON.stringify(
        {
          // The file's own declaration that a tool wrote it — the `_generated`
          // key `check-reference-direction.ts` reads. Its pairs name the layers
          // they were found in, which an authored file here may not do.
          _generated: "scripts/check-layout-norms.ts --update — do not hand-edit",
          _comment:
            "Nested declared directories that EXIST and are not yet resolved. Not intended layout — " +
            "see scripts/check-layout-norms.ts. Anything not listed here fails the check, so this file " +
            "only ever shrinks. Written by `bun run cat check:layout-norms -- --update`.",
          pairs: r.found,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`Baseline written: ${r.found.length} known pair(s).`);
    process.exit(0);
  }

  if (!process.argv.includes("--json")) {
    console.log(`layout norms — ${r.instances} instance declaration(s) read\n`);
    if (r.found.length === 0) {
      console.log("  ✓ no declared directory sits inside another, in any instance");
    }
    for (const p of r.found) {
      console.log(`  ${r.unexpected.includes(p) ? "✗" : "·"} ${p}`);
    }
    for (const p of r.fixed) console.log(`  ✓ FIXED, no longer nested: ${p}`);
    if (r.fixed.length > 0) {
      console.log("\n  Re-run with --update to shrink the baseline — the diff is the progress.");
    }
    if (r.unexpected.length > 0) {
      console.log(
        `\n  ${r.unexpected.length} pair(s) not in the baseline. An asset belongs at ` +
          "`<stub>/<asset>`; a package subdirectory of an already-declared graph needs no " +
          "declaration of its own, and a second one declares the directory twice.",
      );
    }
  }

  if (r.unexpected.length > 0) process.exit(1);
}
