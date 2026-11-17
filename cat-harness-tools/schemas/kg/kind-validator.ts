/**
 * Resolving a graph typology's **validator** — the one parameter that turns
 * "validate a node" from one case per schema into a lookup.
 *
 * Skills' inputs and outputs are constrained by schemas through one common
 * pattern, not a Tool per Zod schema. The parameter is the **graph
 * typology**: `harness.json` already says which directory holds which kind,
 * and {@link GraphTypologyDef.validator} supplies the schema.
 *
 * A downstream layer inherits the platform's `tools/` graph but not its CI
 * workflows, so this is how a folio built on the platform validates its own
 * graph.
 *
 * ## Three states
 *
 * | | |
 * |---|---|
 * | **resolved** | the kind declares a validator and it loaded |
 * | **undeclared** | the kind declares none — *could not determine*, never "valid" |
 * | **unresolvable** | it declares one that does not load — a defect, and loud |
 *
 * Many kinds are `undeclared`, so collapsing it into success would report a
 * clean sweep over most of the corpus. The result is a union, so a caller
 * cannot read a verdict without handling the middle state.
 *
 * @graphNode schema
 * @module folio-assistant/schemas/kind-validator
 */

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { z } from "zod";
import ts from "typescript";

import {
  defaultGraphTypologies,
  declaresInstance,
  layerRootsIn,
  readDeclaration,
  siblingScopeFor,
  resolveGraphTypology,
  type GraphTypologyRegistry,
} from "./cat-harness.js";
import type { NodeSchemaRef } from "./graph-typology-registry.js";
import { libraryNodeClass } from "../library/library-nodes.js";
import { isNodeKind } from "./node-kind.js";
import { implementingRootFor } from "./harness-config.js";

/** A validator reference, split from its `module#Export` form. */
export interface ValidatorRef {
  /**
   * The layer the module belongs to, by its DECLARED NAME, when that is not
   * the layer resolving the reference: `folio-assistant-core:schemas/x.ts#X`.
   *
   * By name rather than by a `../` path, because a relative path resolves into
   * whatever checkout sits next door, and a name resolves only to the layer
   * that declares it. Bean `quda`: a harness kind whose node shapes live in
   * core (`catalogue`, `uploads`) had no honest way to say so.
   */
  instance?: string;
  /** Module path, relative to {@link ValidatorRef.instance}'s root, or to the resolving one. */
  module: string;
  /** The exported symbol — required; see §"`module#Export`". */
  exportName: string;
}

export type KindValidator =
  | { state: "resolved"; ref: ValidatorRef; schema: z.ZodTypeAny }
  | { state: "undeclared"; kind: string; reason: string }
  | { state: "unresolvable"; kind: string; ref?: ValidatorRef; reason: string };

export class ValidatorRefError extends Error {}

/**
 * Split `module#Export`.
 *
 * The `#` half is REQUIRED rather than defaulting to a conventional name. A
 * module exports many schemas — `schemas/sdlc/health-report.ts` exports five — and
 * a default would pick one silently, which is how a validator ends up
 * checking the wrong shape and passing.
 */
export function parseValidatorRef(ref: string): ValidatorRef {
  const hash = ref.indexOf("#");
  if (hash < 0) {
    throw new ValidatorRefError(
      `validator ${JSON.stringify(ref)} has no "#Export". A module exports many ` +
        `schemas; naming one is the difference between validating this kind and ` +
        `validating whichever export came first.`,
    );
  }
  let module = ref.slice(0, hash).trim();
  const exportName = ref.slice(hash + 1).trim();
  const qualified = /^([a-z][a-z0-9-]*):(.+)$/.exec(module);
  const instance = qualified?.[1];
  if (qualified) module = qualified[2];
  if (!module || !exportName) {
    throw new ValidatorRefError(`validator ${JSON.stringify(ref)} is not "module#Export".`);
  }
  if (isAbsolute(module) || module.startsWith("..")) {
    throw new ValidatorRefError(
      `validator module ${JSON.stringify(module)} must be instance-relative. An absolute ` +
        `or escaping path resolves into whatever checkout happens to be next door.`,
    );
  }
  return instance ? { instance, module, exportName } : { module, exportName };
}

/** Is this object a Zod schema — i.e. can a caller actually run it? */
export function isZodSchema(v: unknown): v is z.ZodTypeAny {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { safeParse?: unknown }).safeParse === "function"
  );
}

/**
 * The validator for a graph typology, or a stated reason there is none.
 *
 * `instanceRoot` is the LAYER root, not the repository root — the two
 * parted company when `#437` moved this layer under `cat-harness/`, and
 * nothing noticed because nothing read these paths.
 */
const kindValidatorCache = new WeakMap< object, Map<string, Promise<KindValidator>> >();

export async function resolveKindValidator(
  kind: string,
  instanceRoot: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): Promise<KindValidator> {
  const canonical = resolveGraphTypology(kind).kind;
  const def = registry.get(canonical);
  if (!def) {
    return { state: "unresolvable", kind: canonical, reason: `no such graph typology` };
  }
  if (!def.validator) {
    return {
      state: "undeclared",
      kind: canonical,
      reason:
        `graph typology "${canonical}" declares no validator, so a node of this kind ` +
        `cannot be checked. Not a failure and not a pass.`,
    };
  }
  let byRoot = kindValidatorCache.get(def);
  if (!byRoot) {
    byRoot = new Map();
    kindValidatorCache.set(def, byRoot);
  }
  const key = resolve(instanceRoot);
  const cached = byRoot.get(key);
  if (cached) return cached;
  const pending = loadValidator(def.validator, canonical, instanceRoot);
  byRoot.set(key, pending);
  return pending;
}

/**
 * Load one `module#Export` as a Zod schema. Shared by the kind-level
 * {@link resolveKindValidator} and the per-family {@link resolveNodeSchemas},
 * so the two cannot disagree about what "resolves" means.
 */
async function loadValidator(
  validator: string,
  canonical: string,
  instanceRoot: string,
): Promise<KindValidator> {
  let ref: ValidatorRef;
  try {
    ref = parseValidatorRef(validator);
  } catch (e) {
    return {
      state: "unresolvable",
      kind: canonical,
      reason: e instanceof Error ? e.message : String(e),
    };
  }

  const base = moduleRootOf(ref, instanceRoot);
  if (base === undefined) {
    return { state: "unresolvable", kind: canonical, ref, reason: `no instance declares the name ${ref.instance}` };
  }
  const abs = resolve(join(base, ref.module));
  if (!existsSync(abs)) {
    return {
      state: "unresolvable",
      kind: canonical,
      ref,
      reason: `${ref.module} does not exist under the instance root ${instanceRoot}`,
    };
  }

  let mod: Record<string, unknown>;
  try {
    // input-site: declared validator-refs #771876e3 — validator modules named by graph typology and node-kind declarations, resolved from them at fingerprint time (`scripts/declared-imports.ts`); input-sites.test.ts holds the two to each other
    mod = (await import(abs)) as Record<string, unknown>;
  } catch (e) {
    return {
      state: "unresolvable",
      kind: canonical,
      ref,
      reason: `${ref.module} could not be imported: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // A NODE KIND stands for its composed schema (issue #2195): naming the kind
  // rather than its bare shape is what lets the node-kind index read parents.
  const named = mod[ref.exportName];
  const exported = isNodeKind(named) ? named.schema : named;
  if (exported === undefined) {
    return {
      state: "unresolvable",
      kind: canonical,
      ref,
      reason: `${ref.module} exports no ${ref.exportName}`,
    };
  }
  if (!isZodSchema(exported)) {
    return {
      state: "unresolvable",
      kind: canonical,
      ref,
      reason:
        `${ref.module}#${ref.exportName} is not a Zod schema — it has no safeParse. ` +
        `A TypeScript interface documents a shape and cannot check one; that is the ` +
        `distinction GraphTypologyDef.schema and .validator exist to keep apart.`,
    };
  }
  return { state: "resolved", ref, schema: exported };
}

// ── Annotations ───────────────────────────────────────────────────────────

/**
 * A node with its top-level `_`-prefixed keys removed — `_comment`, `_note`.
 *
 * The corpus annotates JSON with them everywhere, and every loader already
 * drops them before parsing (`check-catalogue.ts` does it inline). A sweep
 * that did not would fail strict schemas on a comment, and teach nothing.
 */
export function stripAnnotations(node: unknown): unknown {
  if (node === null || typeof node !== "object" || Array.isArray(node)) return node;
  return Object.fromEntries(Object.entries(node as Record<string, unknown>).filter(([k]) => !k.startsWith("_")));
}

/**
 * The `$schema` family a node is routed by. A `structure.json` tags itself
 * `_schema` instead (`pdf-structure/v1` and its siblings predate the
 * convention), so a node with no `$schema` is routed by that; and a library's
 * JSON-LD node, which carries neither, by the content-model class it
 * instantiates (`library-nodes.ts`).
 */
export function nodeFamilyTag(node: unknown): unknown {
  if (node === null || typeof node !== "object" || Array.isArray(node)) return undefined;
  const n = node as { $schema?: unknown; _schema?: unknown };
  return n.$schema ?? n._schema ?? libraryNodeClass(node);
}

/**
 * What a family's schema parses: the node with its annotations removed, but
 * keeping a `_schema` tag the node is routed by, since that tag is part of the
 * family's shape and not a comment.
 */
export function familyBody(node: unknown): unknown {
  const body = stripAnnotations(node);
  const n = node as { $schema?: unknown; _schema?: unknown };
  if (body === node || n.$schema !== undefined || n._schema === undefined) return body;
  return { ...(body as Record<string, unknown>), _schema: n._schema };
}

// ── Instance-qualified references (bean `quda`) ──────────────────────────

const rootsByName = new Map<string, Map<string, string>>();

/**
 * The root a reference resolves against: the named layer's, or the
 * resolving layer's own when the reference names none. `undefined` when
 * no layer in the checkout declares that name.
 */
/**
 * Where an unqualified validator module is read from: the declaring layer,
 * then the one layer that implements it — the rule `check:tools` applies to
 * a Tool's `invoke.*.module`. The harness declares kinds whose schema code
 * lives in the tools layer (bean `8lcl`), so `schemas/kg/x.ts#X` in a harness
 * declaration names a file there. A qualified ref (`name:path#X`) starts from
 * the layer it names, then falls back the same way.
 */
export function moduleRootOf(ref: ValidatorRef, instanceRoot: string): string | undefined {
  const base = rootOf(ref.instance, instanceRoot);
  if (base === undefined) return base;
  return implementingRootFor(base, ref.module);
}

export function rootOf(instance: string | undefined, instanceRoot: string): string | undefined {
  if (instance === undefined) return instanceRoot;
  // `siblingScopeFor`, not `repoRootFor` (`dirname`): for the layer declared
  // AT the checkout root the latter climbs out of the checkout and finds no
  // layer by name — the class of beans `pgzn` and `676g`.
  const repo = siblingScopeFor(instanceRoot);
  let byName = rootsByName.get(repo);
  if (!byName) {
    byName = new Map();
    for (const root of layerRootsIn(repo)) {
      try {
        const decl = readDeclaration(root);
        if (decl?.name) byName.set(decl.name, root);
        // Also by planned repository — the form a reference takes (bean `6rmv`).
        if (decl?.repository) byName.set(decl.repository, root);
      } catch {
        // an unreadable declaration names nothing
      }
    }
    rootsByName.set(repo, byName);
  }
  if (declaresInstance(readOwnDeclaration(instanceRoot), instance)) return instanceRoot;
  const found = byName.get(instance);
  if (found !== undefined) return found;
  // The layer running this code is always present, whatever the checkout
  // around the resolving layer holds. cat-harness declares kinds whose
  // validators live here (`cat-harness-tools:scripts/gen-slice-sqlite.ts#…`),
  // and when the harness is its own checkout `siblingScopeFor` searches no
  // siblings (ruling `68k7`), so the name was unresolvable standalone though
  // the export exists (bean `w1gy`). Only the running layer's own name: this
  // is not a sibling search.
  if (declaresInstance(readOwnDeclaration(OWN_ROOT), instance)) return OWN_ROOT;
  return undefined;
}

/** The root of the layer this module belongs to: `schemas/kg/` → its layer root. */
const OWN_ROOT = resolve(import.meta.dir, "..", "..");

function readOwnDeclaration(root: string): { name?: string; repository?: string } | undefined {
  try {
    return readDeclaration(root);
  } catch {
    return undefined;
  }
}

// ── Per-family node schemas (bean `rdkm`) ────────────────────────────────

/** One field of a TypeScript shape, read from source — never executed. */
export interface ShapeField {
  name: string;
  optional: boolean;
  /** The type as written in the source. */
  type: string;
}

/**
 * One `$schema` family of a kind, resolved. A TypeScript shape is READABLE
 * but not RUNNABLE, and an external one is somebody else's; neither is a load
 * failure. (An `untyped` state existed until #1168 B6b removed the registry
 * form that produced it.)
 */
export type NodeSchemaResolution = (
  | { tag: string; state: "resolved"; ref: ValidatorRef; schema: z.ZodTypeAny }
  | { tag: string; state: "shape"; ref: ValidatorRef; fields: ShapeField[] }
  | { tag: string; state: "external"; spec: string }
  | { tag: string; state: "unresolvable"; reason: string }
) & {
  /** The registry's `derived`: no file carries the family; it is what the kind's source files are read into. */
  derived?: true;
};

/**
 * Read an interface's or object type alias's fields from source.
 *
 * With the TypeScript parser rather than by import, because an interface does
 * not exist at runtime — which is exactly why it cannot be a validator.
 * Returns undefined when the module does not declare the name.
 */
export function readShape(instanceRoot: string, shape: string): { ref: ValidatorRef; fields: ShapeField[] } | string {
  let ref: ValidatorRef;
  try {
    ref = parseValidatorRef(shape);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  const base = moduleRootOf(ref, instanceRoot);
  if (base === undefined) return `no instance declares the name ${ref.instance}`;
  const abs = resolve(join(base, ref.module));
  if (!existsSync(abs)) return `${ref.module} does not exist under the instance root ${base}`;
  const src = ts.createSourceFile(abs, readFileSync(abs, "utf8"), ts.ScriptTarget.Latest, true);
  let members: ts.NodeArray<ts.TypeElement> | undefined;
  src.forEachChild((n) => {
    if (ts.isInterfaceDeclaration(n) && n.name.text === ref.exportName) members = n.members;
    if (ts.isTypeAliasDeclaration(n) && n.name.text === ref.exportName && ts.isTypeLiteralNode(n.type)) {
      members = n.type.members;
    }
  });
  if (!members) return `${ref.module} declares no interface or object type ${ref.exportName}`;
  const fields: ShapeField[] = [];
  for (const m of members) {
    if (!ts.isPropertySignature(m) || !m.name) continue;
    fields.push({
      name: m.name.getText(src).replace(/^["']|["']$/g, ""),
      optional: m.questionToken !== undefined,
      type: m.type ? m.type.getText(src).replace(/\s+/g, " ") : "any",
    });
  }
  return { ref, fields };
}

const nodeSchemasCache = new WeakMap< object, Map<string, Promise<NodeSchemaResolution[]>> >();

/**
 * Every `$schema` family a kind declares, resolved. Empty when the kind
 * declares none — the caller then falls back to the kind-level validator.
 */
export async function resolveNodeSchemas(
  kind: string,
  instanceRoot: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): Promise<NodeSchemaResolution[]> {
  const canonical = resolveGraphTypology(kind).kind;
  const def = registry.get(canonical);
  if (!def?.nodeSchemas) return [];
  let byRoot = nodeSchemasCache.get(def);
  if (!byRoot) {
    byRoot = new Map();
    nodeSchemasCache.set(def, byRoot);
  }
  const key = resolve(instanceRoot);
  const cached = byRoot.get(key);
  if (cached) return cached;
  const pending = (async (): Promise<NodeSchemaResolution[]> => {
    const map = (def.nodeSchemas ?? {}) as Record<string, NodeSchemaRef>;
    const out: NodeSchemaResolution[] = [];
    for (const [tag, ref] of Object.entries(map)) {
      const at = out.length;
      if (ref.validator) {
        const v = await loadValidator(ref.validator, canonical, instanceRoot);
        out.push(
          v.state === "resolved"
            ? { tag, state: "resolved", ref: v.ref, schema: v.schema }
            : { tag, state: "unresolvable", reason: v.reason },
        );
      } else if (ref.shape) {
        const r = readShape(instanceRoot, ref.shape);
        out.push(typeof r === "string" ? { tag, state: "unresolvable", reason: r } : { tag, state: "shape", ...r });
      } else if (ref.external) {
        out.push({ tag, state: "external", spec: ref.external });
      }
      if (ref.derived && out.length > at) out[at] = { ...out[at], derived: true };
    }
    return out;
  })();
  byRoot.set(key, pending);
  return pending;
}
