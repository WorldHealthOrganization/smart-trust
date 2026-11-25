#!/usr/bin/env bun
/**
 * review-coverage — the two facts `content-change-review.bpmn`'s coverage
 * gate reads, computed rather than supplied. Bean `px0t`, epic `q4jm`.
 *
 * `GW_Covered` is backed by `decisions/review-coverage-gate.dmn`, which
 * reads `uncoveredBlocks` and `openDefects`. The workflow engine reads a fact
 * by name and does no arithmetic. So the numbers come from here, and the
 * review coordinator passes this command's `facts` to `workflow_complete`.
 *
 * ## Inputs are the preview's published files
 *
 * - `changeset.json`: which blocks changed;
 * - `blocks.json`: each head block's current hash;
 * - `review-comments.json`: open defects, and the ingested verdicts.
 *
 * - `rendered-impact.json` (`--rendered`): the pages the change alters, each
 *   pinned, and the inputs no renderer could place (bean `bnjs`);
 * - `rendered-measured.json` (`--measured`): what the build measured and the
 *   prediction missed. Absent means NOT MEASURED, and the facts say so.
 *
 * Every fact is always emitted, because the decision engine refuses a fact it
 * is not given; `rendered` and `measured` say whether the counts beside them
 * were computed, so an uncomputed count is never read as 0.
 *
 * With `--todos`, verdicts committed under the todos graph's declared
 * `review-verdicts` directory are read too. They win over the published copy,
 * as committed comment statuses do.
 *
 * ## `--commit`: the owner's "commit to feature branch" ruling, for verdicts
 *
 * Writes every current published verdict into the declared directory, one
 * `verdictFileName(id)` per verdict, and commits them to the current FEATURE branch.
 * It refuses the base branch and a detached HEAD, exactly as
 * `review-comment-move` does, because a verdict committed straight to `main`
 * would record a review nobody's merge accepted. So the review record lands
 * on `main` with the edit it is about, and only then.
 *
 * ## Why a verdict on an older hash is reported, not dropped
 *
 * It is evidence the block WAS read, at a version that no longer exists. It
 * does not count toward coverage, and it is listed as `stale` so a
 * coordinator can ask the same reviewer to look again rather than starting
 * over with somebody new.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { TODO_GRAPH_FILE, nodeOfKind, parseTodoGraph } from "@litlfred/cat-harness-tools/schemas/sdlc/todo-graph.js";
import { ReviewCommentsFileSchema } from "../schemas/review-comment.js";
import { missedFiles, RenderedImpactSchema, RenderedMeasuredSchema } from "@litlfred/cat-harness-tools/schemas/ui/rendered-impact.js";
import {
  REVIEW_VERDICT_SCHEMA,
  ReviewVerdictSchema,
  computeCoverage,
  type Coverage,
  type MeasuredStatus,
  type RenderedFacts,
  type RenderedStatus,
  type ReviewVerdict,
} from "../schemas/review-verdict.js";
import { featureBranch } from "./review-comment-move.js";

export const REVIEW_COVERAGE_SCHEMA = "folio-review-coverage/v1" as const;

/** The folio's declared verdicts directory, from `<todosRoot>/todos.json`. */
export function verdictsDir(todosRoot: string): string {
  const decl = join(todosRoot, TODO_GRAPH_FILE);
  if (!existsSync(decl)) {
    throw new Error(`${decl} does not exist, so this folio declares no todos graph. Declare one with a directory of graph typology "review-verdicts".`);
  }
  const node = nodeOfKind(parseTodoGraph(JSON.parse(readFileSync(decl, "utf-8"))), "review-verdicts");
  if (!node) {
    throw new Error(`${decl} declares no directory of graph typology "review-verdicts", which is where verdicts are committed.`);
  }
  return join(todosRoot, node.path);
}

/** Every verdict committed under `dir`, by id. Other files are left alone. */
export function readCommittedVerdicts(dir: string): Map<string, ReviewVerdict> {
  const out = new Map<string, ReviewVerdict>();
  if (!existsSync(dir)) return out;
  for (const f of new Bun.Glob("*.json").scanSync(dir)) {
    const raw = JSON.parse(readFileSync(join(dir, f), "utf-8")) as { $schema?: unknown };
    if (raw.$schema !== REVIEW_VERDICT_SCHEMA) continue;
    const v = ReviewVerdictSchema.parse(raw);
    out.set(v.id, v);
  }
  return out;
}

/**
 * The rendered half, from the build's published files: `rendered-impact.json`
 * (one impact or an array, one per renderer) and, when the build was
 * measured, `rendered-measured.json`.
 */
export function renderedFacts(impacts: unknown, measured?: unknown): RenderedFacts {
  const list = (Array.isArray(impacts) ? impacts : [impacts]).map((i) => RenderedImpactSchema.parse(i));
  const m = measured === undefined ? undefined : RenderedMeasuredSchema.parse(measured);
  return {
    files: list.flatMap((i) => i.files),
    undetermined: list.flatMap((i) => i.undetermined),
    ...(m ? { measured: { status: m.status, missed: missedFiles(m) } } : {}),
  };
}

/** What a `page:` or `input:` verdict may name, each with the pin it is recorded against. */
export function pinMaps(r: RenderedFacts): { pages: Map<string, string>; inputs: Map<string, string> } {
  const pages = new Map<string, string>();
  for (const f of [...r.files, ...(r.measured?.missed ?? [])]) if (f.hash && !pages.has(f.path)) pages.set(f.path, f.hash);
  const inputs = new Map<string, string>();
  for (const u of r.undetermined) if (u.hash) inputs.set(u.input, u.hash);
  return { pages, inputs };
}

export interface CoverageFile extends Coverage {
  $schema: typeof REVIEW_COVERAGE_SCHEMA;
  /** Exactly what `workflow_complete` takes for `GW_Covered`: every fact, always. */
  facts: {
    uncoveredBlocks: number;
    openDefects: number;
    rendered: RenderedStatus;
    unreviewedPages: number;
    undeterminedInputs: number;
    measured: MeasuredStatus;
    missedPages: number;
  };
}

/** The whole computation, with no I/O: tested directly. */
export function buildCoverage(o: {
  changeset: { changes: ReadonlyArray<{ change: string; label: string }> };
  blocks: Record<string, { hash: string }>;
  reviewComments: unknown;
  committed?: ReadonlyMap<string, ReviewVerdict>;
  rendered?: RenderedFacts;
}): CoverageFile {
  const rc = ReviewCommentsFileSchema.parse(o.reviewComments);
  const byId = new Map(rc.verdicts.map((v) => [v.id, v]));
  for (const [id, v] of o.committed ?? []) byId.set(id, v);
  const c = computeCoverage({
    changes: o.changeset.changes,
    blocks: new Map(Object.entries(o.blocks).map(([l, b]) => [l, b.hash])),
    verdicts: [...byId.values()],
    comments: rc.comments,
    rendered: o.rendered,
  });
  return {
    $schema: REVIEW_COVERAGE_SCHEMA,
    ...c,
    facts: {
      uncoveredBlocks: c.uncoveredBlocks,
      openDefects: c.openDefects,
      rendered: c.rendered,
      unreviewedPages: c.unreviewedPages.length,
      undeterminedInputs: c.undeterminedInputs.length,
      measured: c.measured,
      missedPages: c.missedPages.length,
    },
  };
}

/**
 * A verdict's file name. Its id carries a block label, and labels contain
 * `:`, which a Windows checkout cannot hold. The file is read by its
 * `$schema` and its `id` field, never by its name, so the name only has to
 * be unique and portable.
 */
export const verdictFileName = (id: string) => `${id.replace(/[^A-Za-z0-9._-]/g, "_")}.json`;

/** Write each verdict as `<dir>/<safe id>.json`. Returns the paths written. */
export function writeVerdicts(dir: string, verdicts: readonly ReviewVerdict[]): string[] {
  mkdirSync(dir, { recursive: true });
  return verdicts.map((v) => {
    const p = join(dir, verdictFileName(v.id));
    writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
    return p;
  });
}

const USAGE = `usage: bun run folio-assistant-core/scripts/review-coverage.ts
  --changeset <changeset.json> --blocks <blocks.json> --comments <review-comments.json>
  [--rendered <rendered-impact.json> [--measured <rendered-measured.json>]]
  [--out <coverage.json>]
  [--todos <todos graph root>]   read verdicts committed on the feature branch
  [--commit [--base main]]       write the published verdicts into the declared
                                 review-verdicts directory and commit them to the
                                 current FEATURE branch (needs --todos)`;

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const [cs, bl, cm] = [opt("changeset"), opt("blocks"), opt("comments")];
  if (args.includes("--help") || !cs || !bl || !cm || (args.includes("--commit") && !opt("todos"))) {
    console.error(USAGE);
    process.exit(args.includes("--help") ? 0 : 2);
  }
  const read = (p: string) => JSON.parse(readFileSync(p, "utf-8"));
  try {
    // Checked BEFORE anything is written, so a refused commit leaves nothing behind.
    const branch = args.includes("--commit") ? featureBranch(opt("base") ?? "main") : undefined;
    const dir = opt("todos") ? verdictsDir(resolve(opt("todos")!)) : undefined;
    const committed = dir ? readCommittedVerdicts(dir) : undefined;
    const reviewComments = read(cm);
    const rendered = opt("rendered") && existsSync(opt("rendered")!)
      ? renderedFacts(read(opt("rendered")!), opt("measured") && existsSync(opt("measured")!) ? read(opt("measured")!) : undefined)
      : undefined;
    const f = buildCoverage({ changeset: read(cs), blocks: read(bl), reviewComments, committed, rendered });
    if (opt("out")) {
      mkdirSync(dirname(resolve(opt("out")!)), { recursive: true });
      writeFileSync(opt("out")!, JSON.stringify(f, null, 2) + "\n");
    }
    console.error(
      `✓ coverage: ${f.changed.length - f.uncoveredBlocks} of ${f.changed.length} changed block(s) have a current verdict; ` +
        `${f.openDefects} open defect(s); ${f.stale.length} verdict(s) on an older version`,
    );
    for (const l of f.uncovered.slice(0, 20)) console.error(`  · no verdict: ${l}`);
    if (f.uncovered.length > 20) console.error(`  · … and ${f.uncovered.length - 20} more`);
    if (f.rendered === "absent") console.error("  rendered pages: NOT KNOWN — no rendered-impact.json given");
    else {
      console.error(`  rendered pages: ${f.unreviewedPages.length} unreviewed, ${f.undeterminedInputs.length} undetermined input(s) unreviewed`);
      for (const p of f.unreviewedPages.slice(0, 20)) console.error(`  · page not reviewed: ${p}`);
      for (const p of f.undeterminedInputs) console.error(`  · input not placed or reviewed: ${p}`);
    }
    if (f.measured === "known") for (const p of f.missedPages) console.error(`  · missed by the prediction, not reviewed: ${p}`);
    else console.error(`  measured: ${f.measured === "not-base" ? "against a before side that is not the base, so missed pages are not counted" : "NOT MEASURED"}`);
    if (branch && dir) {
      const published = ReviewCommentsFileSchema.parse(reviewComments).verdicts.filter((v) => !committed?.has(v.id));
      const paths = writeVerdicts(dir, published).map((p) => relative(process.cwd(), p));
      if (paths.length) {
        execFileSync("git", ["add", "--", ...paths], { stdio: "inherit" });
        execFileSync("git", ["commit", "-m", `review: record ${paths.length} verdict(s)`, "-m", `on feature branch ${branch}`, "--", ...paths], { stdio: "inherit" });
      } else {
        console.error("  nothing new to commit: every published verdict is already committed");
      }
    }
    // stdout carries only the facts, so a caller can pipe it to workflow_complete.
    console.log(JSON.stringify(f.facts));
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
}
