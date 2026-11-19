/**
 * render-selection.ts — which render steps must actually run, and why.
 *
 * @module scripts/render-selection
 *
 * A staging render seeds from main's render as a cache when that is not
 * stale, diffs, and re-renders only what changed **and what DEPENDS on it** —
 * a dependency graph, because a page that was not re-rendered looks exactly
 * like one that was.
 *
 * ## The two edges, one mechanism
 *
 * | edge | example | one change means |
 * |---|---|---|
 * | **projection** | `ingestion-notes.html` ← `iris-dspace.md` | one source file → one page |
 * | **index** | `community-list.html` ← every catalogue node | one MEMBER → the whole index |
 *
 * In both cases, if any declared input changed, the step re-runs and its own
 * `--check` decides which outputs actually differ. So `inputs` is one
 * mechanism, and the distinction lives in the declaration a human reads.
 *
 * The downstream half is `needs`: a step whose dependency re-ran re-runs too.
 *
 * ## Staleness is DETECTED, never assumed
 *
 * A render writes a MANIFEST — per step, a hash over the content of its
 * declared inputs — and a later build compares:
 *
 * - hashes match → the seeded output stands, the step is skipped;
 * - hashes differ → the step runs, and so does everything that needs it;
 * - **the manifest is missing, unreadable, or does not mention the step →
 *   the step RUNS.** Never "assume fresh": could not determine is never
 *   rendered as clean.
 *
 * A step that declares NO inputs also always runs: it has not said what it
 * reads, so nothing can be concluded about whether its output is current.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Byte order, NOT locale order — for anything a hash depends on.
 *
 * `localeCompare` is collation, and collation depends on the ICU data the
 * runtime happens to carry: it sorts `README.md` after `a/skills`, and a
 * different ICU version may not. A hash whose input order can vary by
 * platform is a hash that mismatches between the machine that wrote a seed
 * and the one reading it — which fails in the safe direction (a needless full
 * render) and is still wrong. Codepoint order is the same everywhere.
 *
 * Display ordering elsewhere may keep `localeCompare`; this is only for
 * inputs to a digest.
 */
const byCodepoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** What a step reads, declared. Repo-relative paths; a directory means its whole tree. */
export interface StepInputs {
  id: string;
  /**
   * Repo-relative files and directories this step reads.
   *
   * Absent or empty is a real state and is NOT "reads nothing": it is "has
   * not said", and such a step always runs. Declaring `[]` deliberately
   * requires saying so in `alwaysRun`.
   */
  inputs?: readonly string[];
  /**
   * Graph TYPOLOGIES whose declared directories this step reads.
   *
   * **Preferred over spelling the paths into `inputs`.** `check:declared-paths`
   * caught the first draft listing a content layer's `skills`, `kg-navigation/skills`
   * and six more as literals, and it was right to: `harness.json` already
   * answers "where do the skills live", and a second answer goes stale the
   * moment a directory moves — while the render would go on hashing a path
   * that is not there and reporting everything unchanged.
   *
   * Resolved at selection time, so a newly declared layer is picked up
   * with no edit here.
   */
  inputGraphs?: readonly string[];
  /** Ids this step must run after — the same edge `dependency-order` uses. */
  needs?: readonly string[];
  /**
   * Run every time, whatever the manifest says.
   *
   * For a step whose output depends on something outside the file tree — the
   * clock, the network, a git history. Declared rather than inferred, so a
   * reader can see which steps can never be cached and why.
   */
  alwaysRun?: string;
}

export const MANIFEST_SCHEMA = "folio-render-manifest/v1";

export interface RenderManifest {
  $schema: typeof MANIFEST_SCHEMA;
  /** The commit this render was produced from, for a human reading the file. */
  commit?: string;
  generatedAt?: string;
  /** step id → hash over its declared inputs at render time. */
  steps: Record<string, string>;
}

/**
 * Every file under a declared input, in a deterministic order.
 *
 * Sorted, because `readdirSync` order is not stable across machines and a
 * hash over an unstable order is a hash that changes for no reason — the same
 * defect `gen-iris-pages` shipped and had to ratchet against.
 *
 * Dot-prefixed segments are skipped: `directory-conventions` says a
 * dot-prefixed segment is not a place this graph declares, and `.git` alone
 * would dominate every hash.
 */
export function filesUnder(root: string, rel: string): string[] {
  const abs = join(root, rel);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [rel];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => byCodepoint(a.name, b.name))) {
      if (e.name.startsWith(".")) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(relative(root, p).split(sep).join("/"));
    }
  };
  walk(abs);
  return out.sort(byCodepoint);
}

/**
 * A step's input hash — over CONTENT and PATH, not mtime.
 *
 * mtime is the obvious shortcut and it is wrong twice over: a fresh checkout
 * rewrites every mtime, so a CI build would re-render everything; and a file
 * touched but unchanged would re-render for nothing. The path is hashed
 * alongside the content so that MOVING a file is a change, which it is — an
 * index keyed on filenames notices.
 *
 * Returns `undefined` when the step declares no inputs. That is not a hash of
 * nothing; it is the absence of a claim, and callers must treat it as
 * "cannot determine" rather than as a value that can match.
 */
export function resolvedInputs(root: string, step: StepInputs, resolve?: GraphResolver): string[] {
  const fromGraphs = (step.inputGraphs ?? []).flatMap((g) => resolve?.(g) ?? []);
  return [...new Set([...(step.inputs ?? []), ...fromGraphs])].sort(byCodepoint);
}

/**
 * Repo-relative directories declaring one graph typology.
 *
 * Injected rather than imported, so this module stays a pure function of its
 * arguments and the tests need no `harness.json` on disk.
 */
export type GraphResolver = (graph: string) => readonly string[];

export function hashInputs(root: string, step: StepInputs, resolve?: GraphResolver): string | undefined {
  const inputs = resolvedInputs(root, step, resolve);
  if (inputs.length === 0) return undefined;
  const h = createHash("sha256");
  for (const rel of inputs) {
    for (const f of filesUnder(root, rel)) {
      h.update(f);
      h.update("\0");
      h.update(readFileSync(join(root, f)));
      h.update("\0");
    }
  }
  return h.digest("hex");
}

export type RunReason =
  | { kind: "inputs-changed"; detail: string }
  | { kind: "not-in-manifest"; detail: string }
  | { kind: "no-manifest"; detail: string }
  | { kind: "undeclared-inputs"; detail: string }
  | { kind: "always"; detail: string }
  | { kind: "needs-rerun"; needs: string; detail: string };

export interface Selection {
  /** Step ids that must run, in the order they were declared. */
  run: string[];
  /** Step ids whose seeded output stands. */
  skip: string[];
  /** Why each running step runs — one entry per id in `run`. */
  why: Record<string, RunReason>;
}

/**
 * Decide which steps run.
 *
 * Two passes, and the second is the bean's step 3. The first asks of each step
 * ONLY "did my own inputs change"; the second propagates along `needs` until
 * nothing more is added, so a step whose dependency re-ran re-runs even though
 * its own inputs are untouched. That is the index case: *an index is derived
 * from a SET, so it goes stale when a member changes even though the index
 * file itself did not.*
 *
 * `manifest === undefined` means every step runs. Not an error and not a
 * fallback: a build with no seed is a full render, which is the correct and
 * safe answer.
 */
export function selectSteps(
  root: string,
  steps: readonly StepInputs[],
  manifest: RenderManifest | undefined,
  resolve?: GraphResolver,
): Selection {
  const why: Record<string, RunReason> = {};

  for (const s of steps) {
    if (s.alwaysRun) {
      why[s.id] = { kind: "always", detail: s.alwaysRun };
      continue;
    }
    if (resolvedInputs(root, s, resolve).length === 0) {
      why[s.id] = {
        kind: "undeclared-inputs",
        detail: `\`${s.id}\` declares no inputs, so nothing can be concluded about whether its output is current`,
      };
      continue;
    }
    if (!manifest) {
      why[s.id] = { kind: "no-manifest", detail: "no seed manifest — this is a full render" };
      continue;
    }
    const recorded = manifest.steps[s.id];
    if (recorded === undefined) {
      why[s.id] = {
        kind: "not-in-manifest",
        detail: `the seed's manifest does not mention \`${s.id}\` — it may never have run, and absent is not fresh`,
      };
      continue;
    }
    const now = hashInputs(root, s, resolve);
    if (now !== recorded) {
      why[s.id] = {
        kind: "inputs-changed",
        detail: `inputs hash ${String(now).slice(0, 12)}… against the seed's ${recorded.slice(0, 12)}…`,
      };
    }
  }

  // ── Step 3: the cascade ────────────────────────────────────────────────
  //
  // Repeated to a fixed point rather than done in one pass: `needs` chains,
  // and a single sweep in declaration order would miss a step whose
  // dependency was itself only added to the set later in the same sweep.
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of steps) {
      if (why[s.id]) continue;
      const trigger = (s.needs ?? []).find((n) => why[n]);
      if (trigger) {
        why[s.id] = {
          kind: "needs-rerun",
          needs: trigger,
          detail: `\`${trigger}\` is re-running, and this step reads what it writes`,
        };
        grew = true;
      }
    }
  }

  return {
    run: steps.filter((s) => why[s.id]).map((s) => s.id),
    skip: steps.filter((s) => !why[s.id]).map((s) => s.id),
    why,
  };
}

/** The manifest a completed render writes, for the next build to compare against. */
export function buildManifest(
  root: string,
  steps: readonly StepInputs[],
  commit?: string,
  resolve?: GraphResolver,
): RenderManifest {
  const out: Record<string, string> = {};
  for (const s of steps) {
    const h = hashInputs(root, s, resolve);
    // A step with no declared inputs contributes NO entry, rather than an
    // entry meaning "nothing". Absent then reads as "cannot be concluded",
    // which is what `selectSteps` already does with it.
    if (h !== undefined) out[s.id] = h;
  }
  return { $schema: MANIFEST_SCHEMA, commit, generatedAt: new Date().toISOString(), steps: out };
}

/**
 * Read a seed manifest, or report that there is none.
 *
 * Any failure — absent, unparseable, wrong schema — returns `undefined`, and
 * `selectSteps` turns that into a full render. A corrupt manifest must never
 * be partially believed: half a cache is worse than none, because the half
 * that is wrong is invisible.
 */
export function readManifest(path: string): RenderManifest | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as RenderManifest;
    if (raw?.$schema !== MANIFEST_SCHEMA) return undefined;
    if (!raw.steps || typeof raw.steps !== "object") return undefined;
    return raw;
  } catch {
    return undefined;
  }
}
