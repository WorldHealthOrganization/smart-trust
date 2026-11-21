/**
 * A typed vocabulary's own module: the code a layer above cat-harness ships
 * so that it, not cat-harness, types its block kinds.
 *
 * A kind's schema belongs to the layer that declares it, so a composition
 * that does not mount that layer has no kinds typed in code and declared by
 * no node (which `check:kind-validators` would fail).
 *
 * ## The contract
 *
 * A `folio-content-adapter/v1` node that says `typed: true` may name a
 * `vocabulary` module, relative to the layer that declares it. The module
 * exports:
 *
 * - `blockSchemas` — one Zod object per kind, each with a literal `kind`. Every
 *   kind must be declared by a block-kind node of the same adapter.
 * - `constraintRules` (optional) — {@link ConstraintRule}s, run beside
 *   `CONSTRAINT_RULES`.
 * - `constraintContext` (optional) — a {@link ConstraintContextContributor}:
 *   what its rules read beyond the generic context (e.g. the science layer's
 *   sibling `.lean` and Lake-tree lookup).
 * - `builders` (optional) — the manifest builders for its kinds, by name.
 *
 * A kind is typed either by `BlockSchema` or by a module. A module's schema
 * takes precedence over a built-in one for the same kind, and a module's rule
 * over a built-in rule with the same `id`.
 *
 * ## Loaded lazily
 *
 * A module imports cat-harness's base schemas (`BlockBaseSchema`). Loading it
 * while `constraints.ts` evaluates would be an import cycle, so nothing here
 * runs until a block is first parsed.
 *
 * @module schemas/vocabulary-modules
 *
 * @graphNode none — a loader for the vocabulary modules layers above ship, not a schema
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { z } from "zod";

import { DISCOVERED_BLOCK_KIND_NODES, discoverContentAdapterFiles } from "./block-kinds";
import { findInstanceRoot } from "../kg/cat-harness";
import {
  BlockSchema,
  CONSTRAINT_RULES,
  type ConstraintContextContributor,
  type ConstraintRule,
  typedBlockKinds,
} from "../constraints";
import type { Block } from "../types";

const require = createRequire(import.meta.url);

/** One kind's schema: a Zod object whose `kind` is a literal. */
type KindSchema = z.ZodObject<{ kind: z.ZodLiteral<string> } & z.ZodRawShape>;

/** What a vocabulary module exports. */
export interface VocabularyModule {
  blockSchemas: readonly KindSchema[];
  constraintRules?: readonly ConstraintRule[];
  constraintContext?: ConstraintContextContributor;
  builders?: Readonly<Record<string, (...args: never[]) => unknown>>;
}

/** A loaded vocabulary: its adapter, where its module is, and what it supplies. */
export interface LoadedVocabulary {
  adapter: string;
  module: string;
  schemas: ReadonlyMap<string, KindSchema>;
  constraintRules: readonly ConstraintRule[];
  constraintContext?: ConstraintContextContributor;
  builders: Readonly<Record<string, (...args: never[]) => unknown>>;
}

/**
 * Read one module's exports and hold them to the contract. Throws with the
 * module's path and what is wrong: a module that does not keep it would leave
 * its kinds untyped, and every block of them failing validation, silently.
 *
 * @param declaredKinds the kinds the adapter's block-kind nodes declare
 */
export function readVocabulary(adapter: string, module: string, exports: unknown, declaredKinds: readonly string[]): LoadedVocabulary {
  const m = exports as Partial<VocabularyModule> | null;
  const fail = (why: string): never => {
    throw new Error(`vocabulary module of adapter "${adapter}" (${module}) ${why}`);
  };
  if (!m || !Array.isArray(m.blockSchemas)) fail("exports no `blockSchemas` array");
  const schemas = new Map<string, KindSchema>();
  for (const s of m!.blockSchemas!) {
    const kind = (s as { shape?: { kind?: { value?: unknown } } })?.shape?.kind?.value;
    if (typeof kind !== "string") fail("has a `blockSchemas` member that is not a Zod object with a literal `kind`");
    if (!declaredKinds.includes(kind as string)) fail(`types kind "${kind}", which no block-kind node of "${adapter}" declares`);
    if (schemas.has(kind as string)) fail(`types kind "${kind}" twice`);
    schemas.set(kind as string, s);
  }
  if (m!.constraintRules !== undefined && !Array.isArray(m!.constraintRules)) fail("exports `constraintRules` that is not an array");
  if (m!.constraintContext !== undefined && typeof m!.constraintContext !== "function") fail("exports `constraintContext` that is not a function");
  if (m!.builders !== undefined && (typeof m!.builders !== "object" || m!.builders === null)) fail("exports `builders` that is not an object");
  return {
    adapter,
    module,
    schemas,
    constraintRules: m!.constraintRules ?? [],
    ...(m!.constraintContext ? { constraintContext: m!.constraintContext } : {}),
    builders: m!.builders ?? {},
  };
}

let loaded: readonly LoadedVocabulary[] | undefined;

/**
 * Every discovered typed vocabulary's module, loaded and checked, in adapter
 * order. Empty when no typed adapter names one.
 */
export function vocabularies(): readonly LoadedVocabulary[] {
  if (loaded) return loaded;
  const out: LoadedVocabulary[] = [];
  for (const { file, node } of discoverContentAdapterFiles()) {
    if (!node.typed || node.vocabulary === undefined) continue;
    const root = findInstanceRoot(dirname(file));
    if (root === undefined) throw new Error(`${file}: names vocabulary ${node.vocabulary}, but belongs to no instance it could be resolved against`);
    const module = join(root, node.vocabulary);
    if (!existsSync(module)) throw new Error(`${file}: names vocabulary ${node.vocabulary}, which does not exist at ${module}`);
    const declared = DISCOVERED_BLOCK_KIND_NODES.filter((k) => k.adapter === node.adapter).map((k) => k.kind);
    // input-site: imports */schemas/*-vocabulary.ts,schemas/*-vocabulary.ts #d5b0e9a9 — vocabulary modules declared by content-adapters nodes
    out.push(readVocabulary(node.adapter, module, require(module), declared));
  }
  loaded = out;
  return loaded;
}

/** The schema a block of `kind` is parsed with: a vocabulary module's, else `BlockSchema`. */
export function blockSchemaFor(kind: unknown): z.ZodTypeAny {
  if (typeof kind === "string") for (const v of vocabularies()) {
    const s = v.schemas.get(kind);
    if (s) return s;
  }
  return BlockSchema;
}

/** What {@link parseBlock} returns: the block, typed, or why it is not one. */
export type ParsedBlock = { success: true; data: Block } | { success: false; error: z.ZodError };

/** Parse a block with the schema its kind is typed by. */
export function parseBlock(block: unknown): ParsedBlock {
  return blockSchemaFor((block as { kind?: unknown } | null)?.kind).safeParse(block) as ParsedBlock;
}

/** Every typed kind: `BlockSchema`'s members and every vocabulary module's. */
export function allTypedBlockKinds(): string[] {
  const kinds = new Set(typedBlockKinds());
  for (const v of vocabularies()) for (const k of v.schemas.keys()) kinds.add(k);
  return [...kinds];
}

/**
 * `CONSTRAINT_RULES` and every vocabulary module's rules. A module's rule
 * replaces a built-in one with the same `id`, as its schemas do, so a rule
 * moving to the layer that owns its kinds never runs twice.
 */
export function allConstraintRules(): readonly ConstraintRule[] {
  const contributed = vocabularies().flatMap((v) => v.constraintRules);
  const replaced = new Set(contributed.map((r) => r.id));
  return [...CONSTRAINT_RULES.filter((r) => !replaced.has(r.id)), ...contributed];
}

/**
 * Every vocabulary module's {@link ConstraintContextContributor}, in adapter
 * order — what `pipeline/validate.ts` merges into each block's context, so a
 * vocabulary's rules (`allConstraintRules`) read what its own layer supplies.
 */
export function allConstraintContextContributors(): readonly ConstraintContextContributor[] {
  return vocabularies().flatMap((v) => (v.constraintContext ? [v.constraintContext] : []));
}
