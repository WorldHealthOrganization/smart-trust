/**
 * The `mathpaper` vocabulary's own code: the seven formal-claim block kinds'
 * types, schemas, builders, constraint rules and the constraint context they read.
 *
 * `content-adapters/mathpaper.json` names this module as its `vocabulary`, and
 * cat-harness's `schemas/content/vocabulary-modules.ts` loads it. The kinds were typed
 * in cat-harness's `BlockSchema` until the owner's ruling of 2026-10-22
 * (option C): a composition that did not mount this layer then had seven kinds
 * typed in code and declared by no node. The vocabulary had already moved here
 * on 2026-10-12 (bean `bzwk`); this is its code following it.
 *
 * Each definition is cat-harness's, moved unchanged, so taking the kinds over
 * changes no verdict. While cat-harness still carries its copies, this
 * module's schemas and same-id rules take precedence over them.
 *
 * @module folio-assistant-sci/schemas/mathpaper-vocabulary
 * @graphNode schema
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";

import {
  BlockBaseSchema,
  ComputationSchema,
  type ConstraintContext,
  type ConstraintRule,
  LeanRefSchema,
  labelForKind,
  ProvableBaseSchema,
} from "@litlfred/cat-harness-tools/schemas/constraints.ts";
import { resolveFormalRef } from "@litlfred/cat-harness-tools/schemas/formal-ref.ts";
import type { BlockBase, Computation, LeanRef, ProvableBase } from "@litlfred/cat-harness-tools/schemas/types.ts";

// ── Types ─────────────────────────────────────────────────────────

/**
 * Definition — MUST have a Lean declaration.
 *
 * Pipeline validates:
 *   - .lean sibling exists (or companions.lean resolves)
 *   - lean.decl is a valid Lean identifier
 */
export interface DefinitionBlock extends BlockBase {
  kind: "definition";
  /** Required: every definition must be formalized. */
  lean: LeanRef;
  /** Labels of example blocks illustrating this definition. */
  examples?: string[];
}

/** Theorem — a major result. Lean expected; proof may be inline or in .lean. */
export interface TheoremBlock extends ProvableBase {
  kind: "theorem";
}

/** Lemma — auxiliary result supporting a theorem. */
export interface LemmaBlock extends ProvableBase {
  kind: "lemma";
}

/** Proposition — a result of moderate significance. */
export interface PropositionBlock extends ProvableBase {
  kind: "proposition";
}

/** Corollary — a consequence of a theorem or proposition. */
export interface CorollaryBlock extends ProvableBase {
  kind: "corollary";
}

/**
 * Distinguishes a formal mathematical conjecture (`"formal"`) from an
 * identification (`"identification"`, a numerical or structural match awaiting
 * proof). Bean `folio-assistant-ckej`.
 */
export const CONJECTURE_KINDS = ["formal", "identification"] as const;
export type ConjectureClaimKind = (typeof CONJECTURE_KINDS)[number];
export const ConjectureClaimKindSchema = z.enum(CONJECTURE_KINDS);

/** Conjecture — an unproven statement. Lean stub optional. */
export interface ConjectureBlock extends BlockBase {
  kind: "conjecture";
  /** Optional Lean stub for the conjecture statement. */
  lean?: LeanRef;
  /**
   * Distinguishes a formal mathematical conjecture (`"formal"`) from an
   * identification (`"identification"`, a numerical or structural match
   * awaiting proof). Bean `folio-assistant-ckej`.
   */
  conjectureKind?: ConjectureClaimKind;
  /** Alias for {@link conjectureKind}: `"formal"` | `"identification"`. */
  formality?: ConjectureClaimKind;
}

/**
 * Proof — establishes a provable. It can include a `computation` for claims
 * verified by running an external script (SnapPea, sympy, mpmath, etc.), whose
 * JSON witness Lean accepts as an axiom with `-- Ref: [computation]`.
 */
export interface ProofBlock extends BlockBase {
  kind: "proof";
  /**
   * Label of the provable block this proof establishes (reverse link of
   * `ProvableBase.proofs[]`). Canonical field name — use in preference to
   * `proves`.
   */
  of?: string;
  /** Optional Lean formalization of the proof. */
  lean?: LeanRef;
  /** Optional computational verification (Python/SnapPea/sympy/etc.). */
  computation?: Computation;
}

/** A block of this vocabulary. */
export type MathpaperBlock =
  | DefinitionBlock
  | TheoremBlock
  | LemmaBlock
  | PropositionBlock
  | CorollaryBlock
  | ConjectureBlock
  | ProofBlock;

// ── Schemas ───────────────────────────────────────────────────────

export const DefinitionSchema = BlockBaseSchema.extend({
  kind: z.literal("definition"),
  label: labelForKind("definition"),
  lean: LeanRefSchema,
  examples: z.array(z.string()).optional(),
});

export const TheoremSchema = ProvableBaseSchema.extend({
  kind: z.literal("theorem"),
  label: labelForKind("theorem"),
});

export const LemmaSchema = ProvableBaseSchema.extend({
  kind: z.literal("lemma"),
  label: labelForKind("lemma"),
});

export const PropositionSchema = ProvableBaseSchema.extend({
  kind: z.literal("proposition"),
  label: labelForKind("proposition"),
});

export const CorollarySchema = ProvableBaseSchema.extend({
  kind: z.literal("corollary"),
  label: labelForKind("corollary"),
});

export const ConjectureSchema = BlockBaseSchema.extend({
  kind: z.literal("conjecture"),
  label: labelForKind("conjecture"),
  lean: LeanRefSchema.optional(),
  conjectureKind: ConjectureClaimKindSchema.optional(),
  formality: ConjectureClaimKindSchema.optional(),
});

export const ProofSchema = BlockBaseSchema.extend({
  kind: z.literal("proof"),
  label: labelForKind("proof"),
  // The canonical reverse link to the provable this proof establishes
  // (`ProvableBase.proofs[]` is the forward one).
  of: z.string().optional(),
  lean: LeanRefSchema.optional(),
  computation: ComputationSchema.optional(),
});

/** The vocabulary's schemas, one per kind: what `vocabulary-modules.ts` reads. */
export const blockSchemas = [
  DefinitionSchema,
  TheoremSchema,
  LemmaSchema,
  PropositionSchema,
  CorollarySchema,
  ConjectureSchema,
  ProofSchema,
] as const;

// ── Builders ──────────────────────────────────────────────────────

function validated<T>(schema: { parse: (v: unknown) => unknown }, data: T): T {
  schema.parse(data);
  return data;
}

// `DefinitionBlock.lean` is required, so `Omit<…, "kind">` could not express
// the very case this builder exists to handle — a partially-authored
// definition with no ref yet.
export function definition(data: Omit<DefinitionBlock, "kind" | "lean"> & { lean?: LeanRef }): DefinitionBlock {
  // Provide a default lean ref so partially-authored definitions load instead
  // of crashing the viewer/MCP server with Zod errors. Uses the qou package by
  // default; callers working in other papers must pass an explicit `lean.ref`.
  const label = data.label || "def:unknown";
  const defaultDecl = "QOU." + label.replace(/^def:/, "").replace(/-./g, (m) => m[1]!.toUpperCase()).replace(/^./, (c) => c.toUpperCase());
  const lean = data.lean ?? { ref: `qou:${defaultDecl}` };
  return validated(DefinitionSchema, { kind: "definition" as const, ...data, lean });
}

export function theorem(data: Omit<TheoremBlock, "kind">): TheoremBlock {
  return validated(TheoremSchema, { kind: "theorem" as const, ...data });
}

export function lemma(data: Omit<LemmaBlock, "kind">): LemmaBlock {
  return validated(LemmaSchema, { kind: "lemma" as const, ...data });
}

export function proposition(data: Omit<PropositionBlock, "kind">): PropositionBlock {
  return validated(PropositionSchema, { kind: "proposition" as const, ...data });
}

export function corollary(data: Omit<CorollaryBlock, "kind">): CorollaryBlock {
  return validated(CorollarySchema, { kind: "corollary" as const, ...data });
}

export function conjecture(data: Omit<ConjectureBlock, "kind">): ConjectureBlock {
  if (data.conjectureKind && data.formality && data.conjectureKind !== data.formality) {
    throw new Error(
      `conjecture "${data.label}": conflicting conjectureKind "${data.conjectureKind}" and formality "${data.formality}"`,
    );
  }
  const conjectureKind = data.conjectureKind ?? data.formality;
  return validated(ConjectureSchema, {
    kind: "conjecture" as const,
    ...data,
    ...(conjectureKind !== undefined ? { conjectureKind } : {}),
  });
}

export function proof(data: Omit<ProofBlock, "kind">): ProofBlock {
  return validated(ProofSchema, { kind: "proof" as const, ...data });
}

/** The vocabulary's builders, by name: what a folio's builders shim re-exports. */
export const builders = { definition, theorem, lemma, proposition, corollary, conjecture, proof };

// ── Constraint context ────────────────────────────────────────────

/**
 * What this vocabulary's rules read beyond cat-harness's generic
 * {@link ConstraintContext}: the block's sibling `.lean` and a basename lookup
 * under a Lake package root. Supplied by {@link constraintContext}, which
 * `pipeline/validate.ts` composes through `vocabulary-modules.ts` (bean `saqd`,
 * row `pipeline/validate.ts`); it built both itself until then.
 */
export interface MathpaperConstraintContext extends ConstraintContext {
  /** Basename lookup under a Lake package root (for the `lean.ref` fallback). */
  lakeTreeContainsBasename?: (lakeRoot: string, basename: string) => boolean;
  /** Lean sibling stub content (for the §3b-cond kind check), if the file exists. */
  leanContent?: string;
}

/**
 * This vocabulary's contribution to each block's constraint context, moved
 * unchanged from `pipeline/validate.ts`'s phase 2. Called once per validation
 * run (so the Lake-tree scan is cached for the run), then once per block.
 *
 * `LEAN_PACKAGES.lakeRoot` is CONTENT-repo-relative, so it is resolved against
 * the folio's `repoRoot` — not against `import.meta.dir`, which lands in the
 * platform's own tree when the folio embeds it as a symlink. With that old
 * computation the scan found a Lake tree that does not exist, so
 * `lean-file-exists`'s basename fallback never found anything.
 */
export function constraintContext(run: {
  repoRoot: string;
}): (block: { rootName: string; dir: string }) => Pick<MathpaperConstraintContext, "lakeTreeContainsBasename" | "leanContent"> {
  // Per-lake-tree basename cache, populated lazily. The cluster-migration
  // pattern allows a `.lean` path to differ from its `lean.ref` decl prefix,
  // so `lean-file-exists` falls back to a basename scan of the package tree.
  const lakeTreeBasenameCache = new Map<string, Set<string>>();
  function lakeTreeContainsBasename(lakeRoot: string, basename: string): boolean {
    const absRoot = resolve(run.repoRoot, lakeRoot);
    let cached = lakeTreeBasenameCache.get(absRoot);
    if (!cached) {
      cached = new Set<string>();
      try {
        const stack: string[] = [absRoot];
        while (stack.length) {
          const dir = stack.pop()!;
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            // input-site: inert #49074d14 — names the build and dependency directories the .lean walk skips; never reads them
            if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".lake" || entry.name === "build") continue;
            const full = join(dir, entry.name);
            if (entry.isDirectory()) stack.push(full);
            else if (entry.isFile() && entry.name.endsWith(".lean")) cached.add(entry.name);
          }
        }
      } catch {
        // Lake root missing — leave the set empty (constraint will fail downstream).
      }
      lakeTreeBasenameCache.set(absRoot, cached);
    }
    return cached.has(basename);
  }
  return ({ rootName, dir }) => {
    const leanPath = join(dir, `${rootName}.lean`);
    return { lakeTreeContainsBasename, leanContent: existsSync(leanPath) ? readFileSync(leanPath, "utf-8") : undefined };
  };
}

// ── Constraint rules ──────────────────────────────────────────────

/**
 * The rules that concern only this vocabulary's kinds, under the ids they had
 * in cat-harness, so each replaces its old copy there rather than running
 * twice; and `mathpaper-md-exists`, cat-harness's `md-exists` for these kinds,
 * which it covered until its copy listed only cat-harness's own.
 */
export const constraintRules: ConstraintRule[] = [
  {
    id: "mathpaper-md-exists",
    description: "Every block must have a companion .md file",
    // The six md-exists always covered; `proof` never was (bean j19q).
    appliesTo: ["definition", "theorem", "lemma", "proposition", "corollary", "conjecture"],
    check: (_block, ctx) => {
      const mdPath = `${ctx.dir}/${ctx.rootName}.md`;
      return ctx.fileExists(mdPath) ? null : `Missing companion: ${mdPath}`;
    },
  },
  {
    id: "lean-file-exists",
    description: "Definitions must have a Lean formalization: sibling .lean OR a resolvable Lake-tree file via lean.ref",
    appliesTo: ["definition"],
    check: (block, ctx) => {
      const siblingPath = `${ctx.dir}/${ctx.rootName}.lean`;
      if (ctx.fileExists(siblingPath)) return null;

      // The resolver chain: (1) sibling <rootName>.lean, checked above;
      // (2) the formalism layer's candidate paths for lean.ref, then its weak
      // candidates; (3) any <name>.lean under the package's tree that matches
      // the ref's bare declaration name. With no formalism layer installed,
      // or an unresolvable ref, this fails closed (qou bean `qou-i2ed`).
      const ref = (block as { lean?: { ref?: string } }).lean?.ref;
      if (ref) {
        const res = resolveFormalRef(ref);
        if (res) {
          for (const candidate of [...res.candidatePaths, ...(res.fallbackPaths ?? [])]) {
            if (ctx.fileExists(candidate)) return null;
          }
          if (res.treeRoot && (ctx as MathpaperConstraintContext).lakeTreeContainsBasename?.(res.treeRoot, res.basename)) return null;
        }
      }

      return (
        `Definition "${block.label}" requires Lean formalization. Expected sibling file: ${siblingPath}` +
        (ref ? ` (or Lake-tree resolution from lean.ref "${ref}")` : "")
      );
    },
  },
  {
    id: "provable-lean-warning",
    description: "Theorems/lemmas/propositions/corollaries should have Lean (warning)",
    appliesTo: ["theorem", "lemma", "proposition", "corollary"],
    check: (block, _ctx) => {
      if ("lean" in block && block.lean) return null;
      // Return as warning-level message (prefix convention)
      return `[warning] ${block.label}: no Lean declaration yet`;
    },
  },
  {
    id: "lean-stub-conjecture-kind-check",
    description:
      "If the sibling .lean stub is a §3b-cond conjectural class axiomatisation, " +
      "the block kind must be conjecture() — not proposition()/theorem()/lemma()/corollary(). " +
      "This catches the bigbang-heatdeath / appendix-surreals pattern (PR #1496, #1519) " +
      "where the .ts declares a provable kind but the Lean side encodes the content as a " +
      "sorry-as-conjecture class instance per CLAUDE.md §3b-cond.",
    appliesTo: ["proposition", "theorem", "lemma", "corollary"],
    check: (block, ctx) => {
      const leanContent = (ctx as MathpaperConstraintContext).leanContent;
      if (!leanContent) return null;
      // Match the §3b-cond stub signature. Any of these three signals is
      // sufficient on its own; the generator-emitted phrase "conjectural
      // sibling stub" is the most reliable marker.
      const signals = [/\bconjectural sibling stub\b/, /\bsorry\s*=\s*conjecture\b/, /\*\*CONJECTURE\.\*\*/];
      const hit = signals.find((re) => re.test(leanContent));
      if (!hit) return null;
      return (
        `Kind mismatch: ${block.label} declares ${block.kind}() but the ` +
        `sibling .lean stub is a §3b-cond conjectural class ` +
        `(matched: ${hit.source}). ` +
        `Demote to conjecture() and rename label prop:/thm:/lem:/cor: → conj: ` +
        `per CLAUDE.md §3b-cond. See PR #1519 commit fix(appendix): ` +
        `demote 5 propositions → conjectures for the migration pattern.`
      );
    },
  },
];
