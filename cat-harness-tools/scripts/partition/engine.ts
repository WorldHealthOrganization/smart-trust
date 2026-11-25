/**
 * The repository-partition ENGINE — the algorithm, with no layer's data in
 * it.
 *
 * ## What moved, and why the host had to carry prose
 *
 * `scripts/repo-partition.ts` was 1,194 lines. Measured before the split:
 * the algorithm is roughly 390 of them, this layer's exception data 272,
 * and its RATIONALE 532 — 65% of the rules block is comment, and the comments
 * are where the measurements live ("measured by putting these in the harness
 * list at the bottom first and watching the two edges survive", and a hundred
 * more like it).
 *
 * That number decided the shape of the repair. `detangler-topic-coherence`
 * was de-math'd by migrating a hardcoded table out to a folio-supplied
 * `topic-keywords.json`, and the obvious move here was the same — until the
 * 65% was counted. JSON cannot host positional per-entry rationale, so the
 * data would have arrived and the reasons would have been destroyed. The
 * mechanism still leaves and the data still stays behind; the host is a
 * MODULE rather than a document, because prose is part of the data here.
 *
 * ## What makes it generic
 *
 * Repo ids are `string`, not this layer's six-member union. Everything
 * else arrives in a {@link PartitionSpec}: the repos, the allowed-import DAG,
 * the ordered rules, the scan roots, the skipped directories and the root to
 * resolve against. Another layer writes its own spec module and reuses
 * every line of this one.
 *
 * ## The three-valued discipline is IN here, not in the caller
 *
 * `unassigned` is a distinct answer from any repo, and `unresolvedEdges` is a
 * distinct list from `crossEdges`. The header this file inherits says why:
 * "could not determine is a distinct answer from determined to be core, and
 * collapsing the two is how a wrong partition looks like a clean one."
 * A caller that wants one number has to decide which; the engine never
 * decides for it.
 *
 * @module scripts/partition/engine
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, relative, dirname, resolve } from "path";
import { directionOf, type LayerRule } from "../../schemas/kg/layer-direction.js";

/** How a module came to be assigned — never collapsed into a boolean. */
export type Provenance = "rule" | "triage" | "keyword" | "default";

/** One ordered assignment rule. First match wins. */
export interface Rule {
  repo: string;
  /** Marks this rule's assignments as hand-triaged rather than structural. */
  triaged?: boolean;
  /** Path prefixes (repo-relative, forward slashes). */
  prefixes?: string[];
  /** Exact repo-relative paths. */
  exact?: string[];
  /** Case-insensitive regex over the repo-relative path. */
  keyword?: RegExp;
}

/**
 * Everything a layer supplies. No default: a spec that forgot a field
 * would scan a directory it does not have, or permit an edge nobody allowed,
 * and both fail quietly.
 */
export interface PartitionSpec {
  /** Absolute path the repo-relative paths are resolved against. */
  root: string;
  /** Display names, in dependency order (most depended-upon first). */
  repos: Array<{ id: string; name: string }>;
  /** What each repo may import from — itself plus its ancestors in the DAG. */
  allowed: Record<string, string[]>;
  /**
   * Edges permitted DESPITE the direction rule, each with its reason.
   *
   * One entry, and the bar for a second is high: a permit is a hole, and the
   * reason this shape is defensible where a blanket rule was not is that it
   * names both endpoints. Anything else crossing the same boundary still
   * fails, which is the property an "exempt side-effect imports" rule would
   * have thrown away.
   *
   * A permit for an edge that no longer exists is a FINDING, not a silent
   * no-op — the same `ALLOWED`-list discipline `check-invocation-parity`
   * follows, and for the same reason: the hand-maintained part of a check is
   * the part that rots, so it has to be the part that reports.
   */
  permittedEdges?: readonly PermittedEdge[];
  /** Ordered; first match wins, so explicit path rules precede keyword rules. */
  rules: Rule[];
  /** Directories scanned for TypeScript modules, relative to `root`. */
  scanRoots: string[];
  /** Directory names never descended into. */
  skipDirs: Set<string>;
}

export interface Assignment {
  repo: string;
  provenance: Provenance;
}

export interface PermittedEdge {
  /** Repo-relative path of the importing module. */
  from: string;
  /** Repo-relative path of the imported module. */
  to: string;
  /** Why this edge is allowed to cross. Required — a permit with no reason is a hole. */
  reason: string;
}

export interface CrossEdge {
  from: string;
  fromRepo: string;
  to: string;
  toRepo: string;
}

export interface PartitionReport {
  /** Permits naming an edge that is no longer in the graph — stale, and a finding. */
  stalePermits: PermittedEdge[];
  modules: Map<string, Assignment>;
  crossEdges: CrossEdge[];
  /** Edges whose target this tool could not classify. */
  unresolvedEdges: Array<{ from: string; to: string }>;
  totalEdges: number;
}

/** The id `classify` returns when no rule claimed a module. */
export const UNASSIGNED = "unassigned";

function walkTs(spec: PartitionSpec, dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (spec.skipDirs.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue; // broken symlink
    }
    if (st.isDirectory()) walkTs(spec, full, out);
    else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

// ── Classification ──────────────────────────────────────────────

export function classify(spec: PartitionSpec, relPath: string): Assignment {
  for (const rule of spec.rules) {
    const explicit: Provenance = rule.triaged ? "triage" : "rule";
    if (rule.exact?.includes(relPath)) return { repo: rule.repo, provenance: explicit };
    if (rule.prefixes?.some((p) => relPath.startsWith(p))) return { repo: rule.repo, provenance: explicit };
    if (rule.keyword?.test(relPath)) return { repo: rule.repo, provenance: "keyword" };
  }
  // Nothing claimed it. `scripts/` and stray `src/` modules land here; they
  // are NOT silently called core — that judgement is a human's to make.
  return { repo: UNASSIGNED, provenance: "default" };
}

// ── Import extraction ───────────────────────────────────────────

/**
 * Static and dynamic import specifiers. Deliberately regex-based rather than
 * a full parse: we need the edge set, not a type-checked AST, and a missed
 * exotic form is a false negative we can live with — it understates the
 * cross-edge count, which is the safe direction for a worklist.
 *
 * **Three alternatives, and the ORDER of the first two is load-bearing.**
 * Bean `q2wn`, measured 2026-09-21.
 *
 * The bare side-effect form — `import "./x.js";`, no binding and no `from` —
 * matched neither of the two alternatives this had before. That is not an
 * exotic form here: **every registration edge in this repository is written
 * that way**, because a module imported to run its side effect has nothing to
 * bind. So the one mechanism computing this repo's module edges was blind to
 * exactly the class that carries load-time registration — the class whose
 * absence produces `unknown graph typology`.
 *
 * Measured 2026-09-21, both numbers because they count different things: the
 * relative specifiers this extracts went **2140 → 2214** (76 gained, 2
 * dropped), and the partition's resolved internal edges went **1886 → 1961**.
 * The gained ones are `schemas/folio-graph-typology` almost without exception.
 *
 * **And the blindness was hiding a live rule violation**, which this bean had
 * left explicitly unestablished: wrong-direction edges went **0 → 25**. The
 * rule is `adapter-layering.test.ts`'s — *core may import the harness; the
 * harness may not import core* — and all 25 are harness modules
 * side-effect-importing core's `folio-graph-typology` to get the `folio` kind
 * registered before they read a declaration. So the check was reporting a
 * clean partition over 25 edges it could not see.
 *
 * **Appending a third alternative does not fix it**, which is why the bare
 * form is tried FIRST. Alternation is left-to-right at each position: at a
 * bare import the `from`-scanning alternative would run first, scan forward
 * past it into a LATER statement, find that one's `from`, and consume both —
 * so the bare edge stayed missing however the alternative was written.
 * Measured on the 12-shape corpus in `engine.test.ts`: appending fixes 2 of
 * the 5 failures and leaves 3, including `import "./a.js"` followed by a
 * normal import, where two edges collapse into one.
 *
 * **`[^;]` rather than `[\s\S]` in that scan** stops the same overreach in
 * the other direction. A static import statement contains no `;` before its
 * `from`, so this only narrows — and it removed 2 false edges where the scan
 * crossed into a TEMPLATE LITERAL: `init-folio.ts` writes
 * `import … from "../../schema/builders"` into a *generated* folio, and the
 * scan was attributing that scaffolded import to the platform script. Neither
 * resolved to a file, so nothing downstream changed; they were noise in the
 * edge set rather than a wrong verdict.
 */
const IMPORT_RE =
  /(?:^|\n)\s*import\s+["']([^"']+)["']|(?:^|\n)\s*(?:import|export)[^;]{0,400}?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

/**
 * Every import specifier in one module's source.
 *
 * Exported for its TESTS rather than for a caller — `engine.test.ts` asserts
 * the shapes `IMPORT_RE` must and must not match. Bean `q2wn` is the reason
 * that is worth an export: the two flaws it records are invisible from
 * `analyse()`'s output, which reports a smaller edge set and no error.
 */
export function extractSpecifiers(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    // Three groups now, one per alternative — bare, `from`-bearing, dynamic.
    const spec = m[1] ?? m[2] ?? m[3];
    if (spec) out.push(spec);
  }
  return out;
}

/**
 * Resolve a relative specifier to a repo-relative module path.
 *
 * This codebase writes all three forms — bare (`./qa-utils`), `.js` for
 * TypeScript files (`./core/git.js`, the NodeNext convention), and directory
 * imports — so every candidate is tried before giving up.
 */
function resolveSpecifier(spec: PartitionSpec, fromFile: string, ref: string): string | null {
  if (!ref.startsWith(".")) return null; // package import, not ours
  const base = resolve(dirname(fromFile), ref);
  const candidates = [
    base,
    `${base}.ts`,
    base.replace(/\.js$/, ".ts"),
    join(base, "index.ts"),
    `${base.replace(/\.js$/, "")}/index.ts`,
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return relative(spec.root, c).replace(/\\/g, "/");
  }
  return null;
}

/**
 * Is this module a **composition root** — a command, rather than a library?
 *
 * The layering rule (`core may import the harness; the harness may not import
 * core`) is a rule about LIBRARIES. A command is where an application is
 * assembled, so it necessarily knows every layer it wires together; that is
 * what makes it the command and not a library. Reading the edge out of a
 * composition root as a layering violation asks a binary not to know its own
 * dependencies.
 *
 * **Derived, never listed.** A hand-maintained set of "entry points" is the
 * kind that rots — the `tyyc` shape, where the symptom of forgetting is
 * invisible. Measured 2026-09-21 over the 25 modules bean `q2wn` exposed, the
 * two criteria separate them EXACTLY and with nothing left over:
 *
 * | | shebang or `import.meta.main` | |
 * |---|---|---|
 * | the 18 commands | **all 18** | `kg-export.ts`, `print-stub.ts`, every `check-*` |
 * | the 7 libraries | **none** | `repo-root.ts`, `known-skills.ts`, `harness-config.ts` |
 *
 * So the split costs no judgement here, and a new command declares itself by
 * being runnable rather than by being remembered.
 *
 * **What this does NOT license.** A library reaching across a layer is still a
 * violation and still fails — which is the half that was actually load-bearing,
 * because a library's edge is inherited by every module that imports it, and
 * `repo-root.ts` alone has 92 importers.
 *
 * **The other half was named and never built.** This paragraph said
 * `check:composition-roots` *"refuses a command that READS a declaration
 * without carrying the registration"*, and seven source files repeated it.
 * There is no such script: `bun run check:composition-roots` exits "Script
 * not found". So the guarantee that a library could safely omit the
 * registration rested on a gate nobody wrote, and nothing failed to say so.
 *
 * It is MOOT rather than fixed (bean `z9ax`). #840 put the registration
 * trigger at the foot of `cat-harness.ts`, and a reader lives in that module,
 * so loading it is a precondition of calling one — there is no longer a
 * command that can forget it, and the 74 redundant copies were removed.
 */
export function isCompositionRoot(src: string): boolean {
  return /^#!/.test(src) || /\bimport\.meta\.main\b/.test(src);
}

// ── Analysis ────────────────────────────────────────────────────

export function analyse(spec: PartitionSpec): PartitionReport {
  const files: string[] = [];
  for (const r of spec.scanRoots) walkTs(spec, join(spec.root, r), files);

  const modules = new Map<string, Assignment>();
  for (const f of files) {
    const rel = relative(spec.root, f).replace(/\\/g, "/");
    modules.set(rel, classify(spec, rel));
  }

  const rule: LayerRule = {
    // A repo missing from `spec.allowed` read as `[]` — may reach nothing,
    // not even itself. Kept: an absent key here is a typo in a typed record,
    // and flagging its edges is what surfaced one before.
    allowed: new Map(
      [...new Set([...Object.keys(spec.allowed), ...[...modules.values()].map((a) => a.repo)])].map(
        (r) => [r, new Set(spec.allowed[r] ?? [])],
      ),
    ),
    permits: spec.permittedEdges,
  };
  const crossEdges: CrossEdge[] = [];
  // Which permits were actually used, so the unused ones can be reported.
  const honoured = new Set<string>();
  const unresolvedEdges: Array<{ from: string; to: string }> = [];
  let totalEdges = 0;

  for (const f of files) {
    const rel = relative(spec.root, f).replace(/\\/g, "/");
    const fromA = modules.get(rel)!;
    let src: string;
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    // Computed once per module, not per edge: the answer is a property of the
    // file, and `isCompositionRoot` scans the whole source.
    const composes = isCompositionRoot(src);
    for (const ref of extractSpecifiers(src)) {
      const target = resolveSpecifier(spec, f, ref);
      if (!target) continue;
      totalEdges++;
      const toA = modules.get(target);
      if (!toA) continue;
      if (fromA.repo === UNASSIGNED || toA.repo === UNASSIGNED) {
        unresolvedEdges.push({ from: rel, to: target });
        continue;
      }
      // A composition root assembles layers by definition — see
      // `isCompositionRoot`. Counted in `totalEdges` above either way, so the
      // edge stays VISIBLE in the census and is only exempt from the
      // direction rule; an exemption that also hid the edge would be the
      // blindness `q2wn` was opened about, one level up.
      if (composes) continue;
      // The direction verdict is `layer-direction.ts`'s, shared with
      // `kg-detangle` (bean `j79e`). `undetermined` cannot arise from a
      // well-typed spec — every repo `classify` returns is a key of
      // `allowed` — and if it ever does it is reported as a cross edge, the
      // same as before the extraction, rather than passed as clean.
      const d = directionOf({ from: rel, to: target }, fromA.repo, toA.repo, rule);
      if (d.verdict === "permitted") {
        honoured.add(`${d.permit.from}\u0000${d.permit.to}`);
        continue;
      }
      if (d.verdict !== "allowed") {
        crossEdges.push({ from: rel, fromRepo: fromA.repo, to: target, toRepo: toA.repo });
      }
    }
  }

  const stalePermits = (spec.permittedEdges ?? []).filter(
    (p) => !honoured.has(`${p.from}\u0000${p.to}`),
  );
  return { modules, crossEdges, unresolvedEdges, totalEdges, stalePermits: [...stalePermits] };
}
