/**
 * Node kinds with more than one parent, composed by the platform's one
 * resolve-then-walk.
 *
 * @module schemas/node-kind
 * @graphNode none — a composition function over other modules' schemas, not a schema
 *
 * ## The rule is the layers' rule, from the same module
 *
 * A kind DECLARES its parents. {@link nodeKind} resolves every ancestor, orders
 * them with `flattenDependencies` from `schemas/kg/dependency-order.ts` (deepest
 * first, ties on declared parent order), and composes each ancestor's OWN shape
 * in that order. The layer resolver in `harness-config.ts` calls the same
 * flattener, so layers and kinds compose in one order.
 *
 * ## Refused, at the moment the kind is defined
 *
 * - **A field two unrelated ancestors define** (`findConflicts`): the order
 *   between them means nothing, so it must not pick a value.
 * - **A redefinition the child did not declare.** Overriding an inherited field
 *   is allowed and must be said, in `overrides`.
 * - **A declared override that overrides nothing**, which is a stale claim.
 *
 * All three throw on module load, so the first test that imports the kind
 * fails.
 *
 * ## Parents are objects, not ids
 *
 * A kind names its parents by reference, so the graph is the import graph and
 * there is no global registry to be loaded in the wrong order. A parent may be
 * a tagged kind (`todo/1.0.0`) or a named mixin (`themed`), which has no
 * `$schema` of its own. Both are kinds here, because both are layers.
 */
import { z } from "zod";

import { findConflicts, flattenDependencies } from "./dependency-order";

/** A node kind: its declared parents, its own fields, and the composed schema. */
export interface NodeKind<S extends z.ZodRawShape = z.ZodRawShape> {
  /** The kind's NAME — its identity and its URL segment (`changeset`). Never versioned. */
  id: string;
  /**
   * SemVer, for a kind whose nodes are files (issue #2195). Absent for a mixin
   * (`themed`), which has no `$schema` of its own.
   */
  version?: string;
  /** `<id>/<version>`: what a writer stamps in `$schema`. Absent when unversioned. */
  tag?: string;
  /**
   * What ONE node of this kind is called, in the words a reader meets: "Work
   * item" for `bean`. The glossary's label for the kind; absent, the glossary
   * reads the id (`memory-record-core` → "Memory record core"). Work item
   * folio-assistant-dkqd: the id stays, the word a reader sees need not be it.
   */
  term?: string;
  /** One sentence saying what a node of this kind is: the glossary's definition. */
  summary?: string;
  parents: readonly NodeKind[];
  /** The fields this layer itself declares. */
  own: z.ZodRawShape;
  /** Inherited fields this layer redefines, on purpose. */
  overrides: readonly string[];
  /** Every ancestor and then this kind, deepest first: the composition order. */
  order: readonly string[];
  /** Every field, composed in {@link order}. */
  schema: z.ZodObject<S>;
}

/**
 * A kind id carrying its version: `public-comment/1.0.0`. The owner,
 * 2026-10-05: schema tags are short names, and versions are *"SEMVER"*, one
 * live version per kind — a minor or patch bump only adds or fixes, so an older
 * file stays valid; a major bump migrates every file in the same change.
 */
const VERSIONED = /^([a-z][a-z0-9-]*)\/(\d+)\.(\d+)\.(\d+)$/;

/** Split `name/x.y.z`; undefined when `id` is not versioned. */
export function parseSchemaTag(tag: string): { name: string; major: number; minor: number; patch: number } | undefined {
  const m = VERSIONED.exec(tag);
  return m ? { name: m[1]!, major: +m[2]!, minor: +m[3]!, patch: +m[4]! } : undefined;
}

/**
 * Does a file stamped `tag` belong to `kind` at its current version? Same name,
 * same MAJOR, and a minor.patch no newer than the kind's — a file cannot have
 * been written against fields the kind does not have yet.
 */
export function acceptsSchemaTag(kind: Pick<NodeKind, "id" | "version">, tag: unknown): boolean {
  if (typeof tag !== "string" || kind.version === undefined) return false;
  const t = parseSchemaTag(tag);
  const k = parseSchemaTag(`${kind.id}/${kind.version}`);
  if (!t || !k || t.name !== k.name || t.major !== k.major) return false;
  return t.minor < k.minor || (t.minor === k.minor && t.patch <= k.patch);
}

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
type ShapeOf<K> = K extends NodeKind<infer S> ? S : never;
type Inherited<P extends readonly NodeKind<z.ZodRawShape>[]> = P extends readonly [] ? Record<never, never> : UnionToIntersection<ShapeOf<P[number]>>;
type Flat<T> = { [K in keyof T]: T[K] };
/** The type-level mirror of the runtime rule: parents' fields, then own fields over them. */
export type Composed<P extends readonly NodeKind<z.ZodRawShape>[], O extends z.ZodRawShape> = AsShape<Flat<Omit<Inherited<P>, keyof O> & O>>;
// Resolved per instantiation, so a concrete composed shape is checked as one
// rather than widened with an index signature (which `Omit` would then erase).
type AsShape<T> = T extends z.ZodRawShape ? T : never;

/** The `$schema` a versioned kind generates: a string, checked by {@link acceptsSchemaTag}. */
type SchemaField = { $schema: z.ZodType<string> };
type IsVersioned<I extends string> = I extends `${string}/${number}.${number}.${number}` ? true : false;
type OwnOf<I extends string, O extends z.ZodRawShape> = IsVersioned<I> extends true ? AsShape<Flat<Omit<O, "$schema"> & SchemaField>> : O;

/**
 * Define a node kind from its parents and its own fields. Throws on any refusal above.
 *
 * An id of the form `name/x.y.z` makes a VERSIONED kind: its id is `name`, and
 * it generates its own `$schema` field — accepting this name at this major, no
 * newer than this minor.patch — so no kind spells its tag twice, and a
 * subclass's `$schema` replaces its parent's without being listed as an
 * override (every subclass has one; saying so each time says nothing).
 */
export function nodeKind<const I extends string, const P extends readonly NodeKind<z.ZodRawShape>[], O extends z.ZodRawShape>(
  versionedId: I,
  parents: P,
  ownFields: O,
  opts: {
    overrides?: readonly (keyof O & string)[];
    /**
     * A check across fields that no field's own schema can make (a section id
     * that appears twice). Applied to the composed schema, so a validator that
     * unwraps the kind into its schema runs it too.
     */
    refine?: (value: z.infer<z.ZodObject<Composed<P, OwnOf<I, O>>>>, ctx: z.RefinementCtx) => void;
    /**
     * Refuse a key no field declares, as `z.object(...).strict()` does. Absent:
     * unknown keys are stripped and the node still passes. For a kind made from
     * a strict Zod schema's shape (`nodeKind(id, [], XSchema.shape, { strict: true })`),
     * so the validator node that names the kind judges files exactly as the
     * schema did: a writer that emits exactly its keys treats an extra one as
     * a defect, and stripping would pass it silently.
     */
    strict?: boolean;
    /** {@link NodeKind.term}. */
    term?: string;
    /** {@link NodeKind.summary}. */
    summary?: string;
  } = {},
): NodeKind<Composed<P, OwnOf<I, O>>> {
  const parsed = parseSchemaTag(versionedId);
  const id = parsed ? parsed.name : versionedId;
  const version = parsed ? `${parsed.major}.${parsed.minor}.${parsed.patch}` : undefined;
  if (parsed && "$schema" in ownFields) {
    throw new Error(`node kind \`${versionedId}\`: a versioned kind generates its \`$schema\`; do not declare one`);
  }
  const self = { id, version };
  const own: z.ZodRawShape = parsed
    ? {
        ...ownFields,
        $schema: z.string().refine((t) => acceptsSchemaTag(self, t), {
          message: `expected \`${versionedId}\`, or an earlier minor/patch of major ${parsed.major}`,
        }),
      }
    : ownFields;
  // Resolve every ancestor once. Post-order, so declaration order is the tie-break.
  const byId = new Map<string, NodeKind>();
  const declared: NodeKind[] = [];
  const visit = (k: NodeKind): void => {
    const prior = byId.get(k.id);
    if (prior) {
      if (prior !== k) throw new Error(`node kind \`${id}\`: two different kinds are both named \`${k.id}\``);
      return;
    }
    byId.set(k.id, k);
    for (const p of k.parents) visit(p);
    declared.push(k);
  };
  for (const p of parents) visit(p);
  if (byId.has(id)) throw new Error(`node kind \`${id}\` is its own ancestor`);

  const steps = [
    ...declared.map((k) => ({ id: k.id, needs: k.parents.map((p) => p.id), fatal: true })),
    { id, needs: parents.map((p) => p.id), fatal: true },
  ];
  const { order, problems } = flattenDependencies(steps);
  if (problems.length > 0) {
    throw new Error(`node kind \`${id}\`: ${problems.map((p) => p.detail).join("; ")}`);
  }

  // Unrelated ancestors must not both define a field — this kind has not had
  // its say yet, so it is left out: redefining the field is how it settles one.
  const ownOf = (k: string): z.ZodRawShape => (k === id ? own : byId.get(k)!.own);
  const conflicts = findConflicts(
    order.filter((s) => s.id !== id),
    (k) => Object.keys(ownOf(k)),
  );
  const inherited = new Set(declared.flatMap((k) => Object.keys(k.own)));
  // A versioned kind's generated `$schema` is not a redefinition anybody chose.
  const redefines = Object.keys(own).filter((f) => inherited.has(f) && !(parsed && f === "$schema"));
  const declaredOverrides = new Set<string>(opts.overrides ?? []);

  const refusals: string[] = [];
  for (const c of conflicts) {
    if (!(c.key in own)) refusals.push(c.detail);
  }
  for (const f of redefines) {
    if (!declaredOverrides.has(f)) {
      refusals.push(`\`${f}\` is inherited and redefined here without being listed in \`overrides\``);
    }
  }
  for (const f of declaredOverrides) {
    if (!redefines.includes(f)) refusals.push(`\`${f}\` is listed in \`overrides\` but no ancestor defines it`);
  }
  if (refusals.length > 0) throw new Error(`node kind \`${id}\`:\n  ${refusals.join("\n  ")}`);

  const shape: z.ZodRawShape = {};
  for (const s of order) Object.assign(shape, ownOf(s.id));
  return {
    id,
    ...(version ? { version, tag: `${id}/${version}` } : {}),
    ...(opts.term !== undefined ? { term: opts.term } : {}),
    ...(opts.summary !== undefined ? { summary: opts.summary } : {}),
    parents,
    own,
    overrides: [...declaredOverrides],
    order: order.map((s) => s.id),
    schema: (() => {
      const object = opts.strict ? z.object(shape).strict() : z.object(shape);
      return opts.refine ? object.superRefine(opts.refine as (v: unknown, ctx: z.RefinementCtx) => void) : object;
    })() as unknown as z.ZodObject<Composed<P, OwnOf<I, O>>>,
  };
}

/**
 * Is `v` a node kind? A typology's validator ref may name one (issue #2195):
 * the kind IS the family's schema, and its parents are what make it a class
 * with subclasses rather than a bare shape.
 */
export function isNodeKind(v: unknown): v is NodeKind {
  if (typeof v !== "object" || v === null) return false;
  const k = v as Partial<NodeKind>;
  return typeof k.id === "string" && Array.isArray(k.parents) && Array.isArray(k.order) &&
    typeof (k.schema as { safeParse?: unknown } | undefined)?.safeParse === "function";
}
