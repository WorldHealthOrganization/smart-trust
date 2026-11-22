#!/usr/bin/env bun
/**
 * Typed content dependency graph — editorial + formal edges, unioned.
 *
 * ## Two relations, deliberately distinct
 *
 * A content block participates in **two different** dependency
 * relations, and conflating them is a category error:
 *
 * - **editorial** — from the block manifest's `uses[]` array **and its
 *   `interprets` field**. Answers "what must a reader have read to follow
 *   this block?" Authored: agent/human maintained, part of the content. See
 *   `schemas/types.ts` → `BlockBase.uses` and `RemarkBlock.interprets`.
 *
 *   Both fields state the same reader-facing fact, so both are editorial: a
 *   remark interpreting a proposition cannot be followed without it. This was
 *   `uses[]` alone until 2026-08-15 (owner decision, bean `i8ad`), so the graph
 *   answered "what must a reader have read?" while omitting 342 authored
 *   statements of exactly that, and they were absent from every cone, energy
 *   and reachability measure.
 *
 *   Note what this does **not** change: `loadChapterGraph` in
 *   `qa-checkers-extended.ts` builds its own `uses`-only adjacency and does not
 *   consume this module, so `detangler-no-forward-ref` is unaffected and its
 *   count stands at 195. Ten `interprets` edges do point forward, and that gate
 *   does not see them — a real gap, now visible, and deliberately left as a
 *   separate decision rather than folded into this one.
 *
 *   Each editorial edge carries `editorialField` so a consumer can still tell
 *   which field an author wrote. That matters for anything *proposing* an
 *   edit: `uses[]` is a curated list, `interprets` is a single structural
 *   claim, and they are not interchangeable to a writer even though they are
 *   to a reader.
 * - **formal** — from the Lean dependency graph, resolved through each
 *   block's `lean.ref`. Answers "what does this proof actually invoke?"
 *   Machine-derived, never hand-written, never stored in a manifest.
 *
 * They diverge in both directions, legitimately. A proof invokes
 * `simp` lemmas nobody needs to read about (formal, not editorial). A
 * theorem is motivated by an example it never formally cites
 * (editorial, not formal). **Neither divergence is a defect**, and
 * nothing in this module or downstream of it may "reconcile" the two
 * by writing into `uses[]`.
 *
 * ## What this module is for
 *
 * Graph questions come in two flavours and want different edge sets:
 *
 * | Question | Edge set |
 * |----------|----------|
 * | "What must a reader read first?" (ordering, forward refs, graph energy) | `editorial` |
 * | "Is this provable block downstream of a conjecture?" (soundness) | `formal`, falling back to `editorial` |
 * | "What breaks if this changes?" (blast radius, triage, impact) | **union** |
 *
 * So every edge carries an `EdgeKind` and every accessor takes an
 * optional kind filter. The default is the **union** — the honest
 * answer to the impact question, and the safe default for a caller
 * that has not thought about which relation it means.
 *
 * ## Degradation
 *
 * Formal edges come from the Lean Atlas ingest cache
 * (`docs/audits/lean-atlas-deps.json`, written by
 * `pipeline/lean-atlas-ingest.ts`). When that cache is absent
 * — no Lean toolchain, no Atlas, a non-math folio — `hasFormal` is
 * `false`, the formal edge set is empty, and the union degrades
 * exactly to the editorial graph. That is the pre-existing behaviour,
 * so no consumer regresses when the cache is missing; consumers that
 * need to distinguish "no formal edges" from "formal edges not
 * available" must check `hasFormal` and report `n/a` rather than a
 * false clean bill.
 *
 * @module pipeline/content-graph
 */

import { folioDir } from "../schemas/kg/cat-harness.js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { walkBlocks } from "./qa-utils";
import { findContentRepoRoot } from "./repo-root";
import { findUsesField, parseNestedStringField, parseStringField } from "./uses-field";

/** Provenance of a dependency edge. */
export type EdgeKind = "editorial" | "formal";

/**
 * Sub-classification of a formal edge, mirroring Lean Atlas's
 * type-vs-value split (arXiv 2604.16347).
 *
 * - `type` — a **statement-level** dependency: the declaration's type
 *   (its signature) mentions the target. Changing the target changes
 *   what this block *claims*.
 * - `value` — a **proof-level** dependency: only the proof term
 *   mentions the target. Changing the target changes how this block is
 *   *justified*, not what it says.
 *
 * The distinction drives staleness propagation: a statement-level
 * change invalidates downstream narrative-equivalence and
 * statement-integrity audits; a proof-level change does not.
 */
export type FormalEdgeKind = "type" | "value";

export interface ContentEdge {
  /** Source block label (the dependent). */
  from: string;
  /** Target block label (the dependency). */
  to: string;
  kind: EdgeKind;
  /**
   * Which authored field produced an editorial edge. Set only on
   * `kind: "editorial"`.
   *
   * Both fields state a reader-facing prerequisite, so both are editorial — but
   * they are not interchangeable to a *writer*. `uses[]` is a list a maintainer
   * curates; `interprets` is a single structural claim ("this remark is about
   * that proposition"). A tool proposing an edit must know which it is looking
   * at, and evidence messages read better naming the field the author actually
   * wrote.
   */
  editorialField?: "uses" | "interprets";
  /** Set only on `kind: "formal"`. */
  formalKind?: FormalEdgeKind;
  /**
   * For a formal edge, the Lean declaration pair that induced it
   * (`"<fromDecl> -> <toDecl>"`). Kept for evidence strings so a
   * reviewer can see *why* the graph thinks two blocks are related
   * without re-running Atlas.
   */
  via?: string;
}

export interface ContentNode {
  label: string;
  /** Block kind (`definition`, `theorem`, …). */
  kind: string;
  /** Absolute path to the block's `.ts` manifest. */
  ts: string;
  /** `lean.ref` URI (`pkg:Decl`) if the block declares one. */
  leanRef?: string;
  /** Raw `uses[]` as authored, in manifest order (deduplicated). */
  uses: string[];
}

/**
 * How the formal edge set was derived. See
 * `pipeline/lean-atlas-ingest.ts` for the full contract.
 *
 * - `atlas` — elaborated by Lean Atlas. Authoritative; the type/value
 *   split is real.
 * - `scan` — the ingest script's syntactic fallback. **Approximate**:
 *   misses `simp`/instance/unfolding dependencies and can over-report a
 *   coincidental name match. Good enough for advisory signals; not good
 *   enough to drive staleness invalidation.
 * - `elaborated` — records from a contributed formal-edge extractor
 *   (a pipeline slot the science layer fills): the same
 *   elaborated type/value split as `atlas`, computed with LeanArchitect's
 *   dependency rule over the folio's `lean.ref` targets. As trustworthy as
 *   `atlas`; see `isElaborated`.
 * - `mixed` — some entries `scan`, the rest elaborated. Only `scan` makes a
 *   cache mixed: `atlas` beside `elaborated` is still fully elaborated.
 */
export type FormalSource = "atlas" | "elaborated" | "scan" | "mixed";

/**
 * True when a formal edge set was elaborated rather than lexically scanned,
 * i.e. its type/value split is real. Consumers branch on THIS, never on
 * `=== "atlas"`, so a second elaborated source cannot be silently treated as
 * a scan.
 */
export function isElaborated(source: string | undefined): boolean {
  return source === "atlas" || source === "elaborated";
}

/**
 * The cache-level summary of per-entry sources. ONE rule, used both where the
 * cache is written (`lean-atlas-ingest.ts` `saveCache`) and where it is read
 * without a summary, so the two cannot disagree. Empty is `scan` (nothing
 * elaborated has been recorded); any `scan` beside an elaborated entry is
 * `mixed`; `atlas` beside `elaborated` is still fully elaborated.
 */
export function summarizeSources(sources: Iterable<string | undefined>): FormalSource {
  const s = new Set([...sources].map((x) => x ?? "scan"));
  const elaborated = [...s].some((x) => isElaborated(x));
  if (s.size === 0 || (s.has("scan") && !elaborated)) return "scan";
  if (s.has("scan")) return "mixed";
  return s.has("elaborated") ? "elaborated" : "atlas";
}

/** On-disk shape of the formal dependency cache. */
interface AtlasCache {
  $schema: string;
  generated_at: string;
  source?: FormalSource;
  decls: Record<
    string,
    {
      /** Statement-level dependencies (fully-qualified decl names). */
      type_deps?: string[];
      /** Proof-level dependencies (fully-qualified decl names). */
      value_deps?: string[];
      /** 12-char SHA of the owning `.lean` at extraction time. */
      lean_sha?: string;
      source?: "atlas" | "elaborated" | "scan";
    }
  >;
}

const ATLAS_CACHE_REL = "docs/audits/lean-atlas-deps.json";

/**
 * Extract a block manifest's `uses: [...]` array in source order,
 * WITHOUT deduplicating.
 *
 * Regex-based, matching the rest of the pipeline (`qa-utils`,
 * `conjectural-propagation-sweep`) — no TypeScript loader needed for a
 * literal string array.
 *
 * Anchored on `uses` at a property position (start-of-line or after
 * `{`/`,`) so a `uses` substring inside another identifier — or the
 * word inside a `title:` string — cannot be mistaken for the array.
 *
 * Comments inside the array are stripped before strings are extracted.
 * This matters: authors annotate `uses[]` entries, and an apostrophe in
 * a comment ("the atom's T_w") otherwise opens a spurious single-quoted
 * match that swallows the rest of the comment as a "label". Real
 * manifests in the corpus do this, and the resulting phantom entries
 * read as unresolvable-dependency failures.
 *
 * @returns entries in source order plus the array's source offset, or
 *          `undefined` when the manifest has no `uses` array.
 */
export function extractUses(
  tsSrc: string,
): { entries: string[]; index: number } | undefined {
  // Delegates to the shared field scanner rather than carrying a fourth
  // hand-rolled parser. The regex this replaced anchored on
  // /(?:^|[{,])\s*uses\s*:\s*\[/ — the anchor was right (it stops a `uses:`
  // quoted in an authorNotes body winning), but `\s*` does not span comments,
  // so a `//` line between the previous field's comma and the `uses:` key made
  // the match fail outright. The block then contributed NO editorial edges,
  // indistinguishable from one that genuinely declares nothing: 27 blocks and
  // 53 declared edges were invisible to every graph metric.
  //
  // `findUsesField` anchors on an identifier boundary instead and matches the
  // close by bracket depth, so neither comments nor nesting can defeat it.
  const f = findUsesField(tsSrc);
  if (!f) return undefined;
  return { entries: f.entries, index: f.fieldStart };
}

/**
 * Parse a block manifest's `uses: [...]` array, deduplicated.
 *
 * A manifest listing the same label twice must not inflate out-degree
 * or cone size. Use `extractUses` when the duplicate itself is the
 * thing being audited.
 */
export function parseUses(tsSrc: string): string[] {
  return [...new Set(extractUses(tsSrc)?.entries ?? [])];
}

/**
 * Parse a block manifest's `lean: { ref: "..." }` URI, if present.
 *
 * **Scoped to the `lean` object.** A manifest may carry several `ref:` keys —
 * `lean.ref`, `simulator.ref`, `computation.ref` — and the unscoped
 * `/\bref\s*:\s*["']([^"']+)["']/` this replaced returned whichever came first
 * in the file. Three blocks in the `qou` corpus have `simulator: { ref: … }`
 * and **no `lean:` block at all**, and were reported as owning a Lean
 * declaration named `sim:…`, which put them in `declOwners` and gave them
 * formal edges they cannot have.
 */
export function parseLeanRef(tsSrc: string): string | undefined {
  return parseNestedStringField(tsSrc, "lean", "ref");
}

/**
 * Strip a `lean.ref` URI (`pkg:Decl`) down to its declaration path.
 *
 * Atlas emits bare fully-qualified Lean names (`QOU.Braid.foo`);
 * manifests carry a package prefix (`qou:QOU.Braid.foo`). Normalising
 * to the decl path is what lets the two be joined.
 */
export function refToDecl(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const i = ref.indexOf(":");
  return i === -1 ? ref : ref.slice(i + 1);
}

/**
 * Kinds that assert something — as opposed to `proof`, `prose`, and
 * friends, which are *about* an assertion. Only these should own a Lean
 * declaration in the graph.
 */
const STATEMENT_KINDS = new Set([
  "definition",
  "theorem",
  "lemma",
  "proposition",
  "corollary",
  "conjecture",
]);

export function isStatementKind(kind: string): boolean {
  return STATEMENT_KINDS.has(kind);
}

export class ContentGraph {
  readonly nodes = new Map<string, ContentNode>();
  readonly edges: ContentEdge[] = [];
  /**
   * True iff a Lean Atlas cache was found and read. When false the
   * formal edge set is empty because the data was unavailable — NOT
   * because the corpus has no formal structure. Consumers must not
   * read an empty formal edge set as a clean result.
   */
  hasFormal = false;
  /**
   * Lean declaration -> every block whose `lean.ref` claims it.
   *
   * Usually one. Two entries are legitimate for a statement/proof pair
   * (`prop:x` and `prf:x` both point at the decl the proposition IS).
   * Two *statement-bearing* blocks claiming one decl is a defect —
   * audited by `lean-ref-owns-decl`.
   */
  readonly declOwners = new Map<string, string[]>();
  /**
   * Provenance of the formal edge set — `undefined` when `hasFormal`
   * is false.
   *
   * Consumers must branch on this where confidence matters. In
   * particular, anything that invalidates downstream work on the
   * strength of a **type** vs **value** edge (staleness propagation)
   * requires an elaborated source (`isElaborated`: `"atlas"` or
   * `"elaborated"`); under `"scan"` the split is a lexical guess and
   * must be treated as unavailable rather than trusted.
   */
  formalSource?: FormalSource;

  private _out = new Map<string, ContentEdge[]>();
  private _in = new Map<string, ContentEdge[]>();

  /** Register an edge, dropping self-loops and duplicates. */
  addEdge(e: ContentEdge): void {
    if (e.from === e.to) return;
    const dup = (this._out.get(e.from) ?? []).some(
      (x) => x.to === e.to && x.kind === e.kind && x.formalKind === e.formalKind,
    );
    if (dup) return;
    this.edges.push(e);
    const o = this._out.get(e.from);
    if (o) o.push(e);
    else this._out.set(e.from, [e]);
    const i = this._in.get(e.to);
    if (i) i.push(e);
    else this._in.set(e.to, [e]);
  }

  /**
   * Dependencies of `label` — the blocks it points at.
   *
   * `kind` omitted ⇒ **union** of editorial and formal, deduplicated
   * by target. Pass a kind explicitly when the question is specific to
   * one relation.
   */
  out(label: string, kind?: EdgeKind): string[] {
    const es = this._out.get(label) ?? [];
    return [...new Set(es.filter((e) => !kind || e.kind === kind).map((e) => e.to))];
  }

  /** Dependents of `label` — the blocks pointing at it. */
  in(label: string, kind?: EdgeKind): string[] {
    const es = this._in.get(label) ?? [];
    return [...new Set(es.filter((e) => !kind || e.kind === kind).map((e) => e.from))];
  }

  /** Full edge records out of `label` (for evidence strings). */
  outEdges(label: string, kind?: EdgeKind): ContentEdge[] {
    return (this._out.get(label) ?? []).filter((e) => !kind || e.kind === kind);
  }

  /**
   * Transitive dependency cone from `label` — every block reachable by
   * following edges, excluding `label` itself. Cycle-safe.
   *
   * This is the blast-radius measure: "what does this block rest on?"
   * Defaults to the union, which is the right default for impact.
   */
  cone(label: string, kind?: EdgeKind): Set<string> {
    const seen = new Set<string>();
    const stack = [...this.out(label, kind)];
    while (stack.length) {
      const n = stack.pop()!;
      if (n === label || seen.has(n)) continue;
      seen.add(n);
      for (const next of this.out(n, kind)) {
        if (next !== label && !seen.has(next)) stack.push(next);
      }
    }
    return seen;
  }

  /**
   * Transitive cone from `label` following **`uses[]` edges only**, not the
   * full editorial relation. Cycle-safe, like `cone`.
   *
   * `uses` and `interprets` are both editorial, because both state a
   * reader-facing prerequisite (bean `i8ad`). They are not interchangeable
   * under *transitivity*, which is what a cone measures. Owner ruling
   * 2026-08-24: sending a reader to a remark ABOUT B lets them take B's
   * assertions for granted, and follow the reference if they want more; it
   * does not mean they have read B's prerequisites. A path that leaves a
   * block by its `interprets` edge therefore carries nothing forward.
   *
   * So `cone(label, "editorial")` is the wrong measure for any question of
   * the form "did the reader already have to read this?" — use this one. It
   * remains the right measure for impact ("what breaks if this changes?"),
   * which is why the default cone is still the union.
   *
   * There is deliberately no `EdgeKind` for `uses`: the kind axis is
   * provenance (editorial vs formal) and `uses`/`interprets` is a different
   * axis, recorded per-edge in `editorialField`. Widening `EdgeKind` would
   * make `kind === "editorial"` stop meaning "every editorial edge".
   */
  usesCone(label: string): Set<string> {
    const step = (n: string): string[] => [
      ...new Set(
        this.outEdges(n, "editorial")
          .filter((e) => e.editorialField === "uses")
          .map((e) => e.to),
      ),
    ];
    const seen = new Set<string>();
    const stack = [...step(label)];
    while (stack.length) {
      const n = stack.pop()!;
      if (n === label || seen.has(n)) continue;
      seen.add(n);
      for (const next of step(n)) {
        if (next !== label && !seen.has(next)) stack.push(next);
      }
    }
    return seen;
  }

  /**
   * Formal edges out of `label` whose target is not reachable from
   * `label` through the **editorial** relation.
   *
   * This is the *exposition-gap* signal: the proof leans on something
   * the narrative never asks the reader to have read. It is advisory —
   * frequently the correct state of affairs (`simp` lemmas, library
   * layers). It is NOT a list of missing `uses[]` entries and must
   * never be applied as one.
   */
  formalOnlyTargets(label: string): string[] {
    if (!this.hasFormal) return [];
    const editorialCone = this.cone(label, "editorial");
    return this.out(label, "formal").filter((t) => !editorialCone.has(t));
  }

  /**
   * Editorial edges out of `label` with no formal counterpart.
   *
   * Purely informational. An editorial-only edge is the *expected*
   * shape for motivation, notation, and worked examples, and for every
   * block with no Lean sibling at all. Exposed for reviewer context,
   * never as a finding on its own.
   */
  editorialOnlyTargets(label: string): string[] {
    if (!this.hasFormal) return [];
    const formal = new Set(this.out(label, "formal"));
    return this.out(label, "editorial").filter((t) => !formal.has(t));
  }
}

/**
 * Build the typed graph for a content root.
 *
 * @param rootDir  Absolute path to the content root to walk.
 * @param repoRoot Content-repo root used to locate the Atlas cache.
 *                 Defaults to `findContentRepoRoot()`.
 */
export function buildContentGraph(rootDir: string, repoRoot?: string): ContentGraph {
  const g = new ContentGraph();
  const root = repoRoot ?? findContentRepoRoot();

  // ── Pass 1: nodes + editorial edges ────────────────────────────
  // Editorial edges are authored data; they exist whether or not any
  // Lean is present, so they are read unconditionally.
  const declToLabel = new Map<string, string>();
  for (const b of walkBlocks(rootDir)) {
    const src = readFileSync(b.ts, "utf-8");
    const leanRef = parseLeanRef(src);
    const uses = parseUses(src);
    g.nodes.set(b.label, { label: b.label, kind: b.kind, ts: b.ts, leanRef, uses });
    const decl = refToDecl(leanRef);
    if (decl) {
      g.declOwners.set(decl, [...(g.declOwners.get(decl) ?? []), b.label]);
      // Prefer the STATEMENT-bearing block over a `proof` block when
      // both claim a decl. A `prop:x` / `prf:x` pair legitimately shares
      // one declaration — the proposition IS what the decl states — and
      // a formal edge should attach to the proposition, not to its
      // proof. (This was first-writer-wins, i.e. whichever the walk hit
      // first, which made the graph's shape depend on filesystem order.)
      const prev = declToLabel.get(decl);
      if (!prev || (isStatementKind(b.kind) && !isStatementKind(g.nodes.get(prev)!.kind))) {
        declToLabel.set(decl, b.label);
      }
    }
    for (const u of uses) {
      g.addEdge({ from: b.label, to: u, kind: "editorial", editorialField: "uses" });
    }
    // `interprets` is an editorial edge too: a remark interpreting a
    // proposition cannot be followed without having read it, which is exactly
    // what the editorial relation means. 342 authored dependencies were absent
    // from every cone, energy and reachability measure until this landed.
    // Owner decision 2026-08-15, bean i8ad.
    const interprets = parseStringField(src, "interprets");
    if (interprets) {
      g.addEdge({
        from: b.label,
        to: interprets,
        kind: "editorial",
        editorialField: "interprets",
      });
    }
  }

  // ── Pass 2: formal edges from the Atlas cache ──────────────────
  const cachePath = join(root, ATLAS_CACHE_REL);
  if (!existsSync(cachePath)) return g;
  let cache: AtlasCache;
  try {
    cache = JSON.parse(readFileSync(cachePath, "utf-8"));
  } catch {
    // A corrupt cache is "unavailable", not "empty" — leave
    // hasFormal false so consumers report n/a instead of a clean pass.
    return g;
  }
  g.hasFormal = true;
  // Prefer the cache's own summary; otherwise derive it from the
  // per-entry tags so a hand-assembled cache still reports honestly.
  const perEntry = new Set(
    Object.values(cache.decls ?? {}).map((d) => d.source ?? "scan"),
  );
  g.formalSource = cache.source ?? summarizeSources(perEntry);

  for (const [decl, entry] of Object.entries(cache.decls ?? {})) {
    const fromLabel = declToLabel.get(refToDecl(decl)!);
    if (!fromLabel) continue; // decl not owned by any block
    const add = (deps: string[] | undefined, formalKind: FormalEdgeKind) => {
      for (const d of deps ?? []) {
        const toLabel = declToLabel.get(refToDecl(d)!);
        // Unowned target ⇒ Mathlib / library dependency, not corpus
        // structure. Dropping it is deliberate: the graph describes
        // relationships between *content blocks*.
        if (!toLabel) continue;
        g.addEdge({
          from: fromLabel,
          to: toLabel,
          kind: "formal",
          formalKind,
          via: `${decl} -> ${d}`,
        });
      }
    };
    add(entry.type_deps, "type");
    add(entry.value_deps, "value");
  }

  return g;
}

// ── CLI ────────────────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const rootArg = args.find((a) => !a.startsWith("--"));
  const repoRoot = findContentRepoRoot();
  const rootDir = rootArg
    ? join(repoRoot, rootArg)
    : folioDir(repoRoot);

  const g = buildContentGraph(rootDir, repoRoot);
  const editorial = g.edges.filter((e) => e.kind === "editorial").length;
  const formal = g.edges.filter((e) => e.kind === "formal").length;

  if (json) {
    console.log(
      JSON.stringify(
        {
          root: rootDir,
          hasFormal: g.hasFormal,
          nodes: g.nodes.size,
          edges: { editorial, formal },
          blocks: [...g.nodes.keys()].sort(),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`content-graph: ${rootDir}`);
    console.log(`  blocks:          ${g.nodes.size}`);
    console.log(`  editorial edges: ${editorial}  (authored uses[])`);
    console.log(
      `  formal edges:    ${formal}  ${
        g.hasFormal ? "(from Lean Atlas cache)" : "(cache ABSENT — formal graph unavailable)"
      }`,
    );
    if (!g.hasFormal) {
      console.log(
        `\n  No ${ATLAS_CACHE_REL}. Union degrades to the editorial graph.\n` +
          `  Populate it with: bun run cat-harness-tools/pipeline/lean-atlas-ingest.ts --ingest <jsonl>`,
      );
    }
  }
}
