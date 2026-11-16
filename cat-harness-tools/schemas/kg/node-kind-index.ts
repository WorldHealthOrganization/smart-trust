/**
 * Every node kind a checkout declares, found THROUGH the graph typologies.
 *
 * @module cat-harness/schemas/node-kind-index
 * @graphNode none — a function library over the typology registry; it defines no schema
 *
 * ## Two concepts, no third
 *
 * - a **graph typology** is what a DIRECTORY holds — its `$schema` families
 *   (`nodeSchemas`), each naming the TypeScript that validates it;
 * - a **node kind** is a `nodeKind()` in TypeScript — a class whose parents
 *   make it a subclass.
 *
 * This module joins them and adds nothing: where a family's (or a typology's)
 * `validator` names a `nodeKind()` export, that kind is the family's node kind.
 * There is no list of kinds to keep and no source scan.
 *
 * ## The declaring harness is not written down
 *
 * It is the layer the validator ref names — `core:schemas/x.ts#XKind` is
 * declared by `core` — or, for an unqualified ref, the layer the ref
 * resolves against (cat-harness).
 *
 * ## UNKINDED is a third state, not a failure
 *
 * A family whose validator is a bare Zod schema, or that names none, is
 * reported as unkinded with the reason, so the gate holds existing ones as a
 * baseline and fails only on a NEW one.
 *
 * ## One baseline per layer
 *
 * Each family is OWNED by the layer that declares its typology
 * ({@link typologyOwner}), each layer keeps its own families in a declared
 * asset of role `unkinded-baseline` ({@link UnkindedBaselineKind}), and
 * {@link ratchet} judges each layer against its own. The combined table
 * for the node-kind pages is built at publish (cat-harness's
 * `builtAtPublish`), never committed.
 */
import { existsSync } from "node:fs";
import { z } from "zod";
import { dirname, join, relative, resolve } from "node:path";

import { CatHarnessDeclarationKind, declaredAssetPath, findInstanceRoot, readDeclaration, resolveGraphTypology, UNKINDED_BASELINE_ROLE, type GraphTypologyRegistry } from "./cat-harness.js";
import { BASE_GRAPH_TYPOLOGIES, REGISTRATION_MODULE, type NodeSchemaRef } from "./graph-typology-registry.js";
import { layerRootsIn } from "./instance-roots.js";
import { harnessRoot } from "../harness-root.js";
import { moduleRootOf, parseValidatorRef } from "./kind-validator.js";
import { isNodeKind, nodeKind, type NodeKind } from "./node-kind.js";
import { WorkPlanKind } from "../sdlc/work-plan.ts";

/** One node kind, as the index records it. */
export interface NodeKindEntry {
  /** `nodeKind()`'s id — a `$schema` tag for a tagged kind, a name for a mixin. */
  id: string;
  /** SemVer, for a kind whose nodes are files; absent for a mixin. */
  version?: string;
  /** `<id>/<version>`: the `$schema` a current node carries. */
  tag?: string;
  /** Direct parents, by id, in declared order. */
  parents: string[];
  /** Direct subclasses, by id, sorted: the kinds that name this one as a parent. */
  subclasses: string[];
  /**
   * The layer that declares it: the one whose code holds the `nodeKind()`.
   * Absent for a kind reached only as an ANCESTOR (a mixin such as `themed`):
   * no typology names it, so nothing here says where it lives, and guessing
   * from a child would file it under whichever child was read first.
   */
  declaredBy?: string;
  /** Where, repo-relative, and under which export. Absent for an ancestor reached only as a parent. */
  module?: string;
  exportName?: string;
  /**
   * The kind's own page renderer, when its validator node names one (`pages`),
   * repo-relative. Absent: the generic pages built from the schema.
   */
  pages?: { module: string; exportName: string };
  /** The graph typologies that hold nodes of this kind, and the families they file it under. */
  holdings: { typology: string; family?: string }[];
  /**
   * How its nodes are found when no typology holds them: by a NAME RULE
   * ({@link NAME_RULE_KINDS}). `instance-declaration` is each layer's own
   * `<instance>.json`, which sits at a layer root rather than in a
   * declared directory, so no typology can name it. Absent: found through
   * `holdings`.
   */
  foundBy?: NameRule;
}

/**
 * The rules that find a kind's nodes WITHOUT a typology. Two today.
 *
 * A layer declaration is a node (bean `ujiv`, issue #88: *"harness
 * declarations become node kinds by tagging the files"*), but it is not IN a
 * directory any typology describes. It is the file that DECLARES the
 * directories, at the layer's root, found by `findDeclarationFile`. Filing
 * it under a typology would invent a directory; the rule names where it is.
 *
 * A work plan (`process-tag`, work item folio-assistant-exrp) is a work item
 * file already held as a `bean`; what makes it a plan is a `process:` tag, so
 * the rule is that tag, and no directory is named twice.
 */
export type NameRule = "instance-declaration" | "process-tag";

/** A kind found by a name rule: the `nodeKind()` itself, where it is declared, and the rule. */
export interface NameRuleKind {
  kind: NodeKind;
  /** Absolute path of the module holding the export. */
  file: string;
  exportName: string;
  rule: NameRule;
}

/**
 * Kinds found by a name rule. Imported, not named by a validator ref: a ref
 * resolves against the `instanceRoot` the caller passes, and these are this
 * module's OWN layer's kinds wherever the index is built from.
 */
export const NAME_RULE_KINDS: readonly NameRuleKind[] = [
  { kind: CatHarnessDeclarationKind, file: join(import.meta.dir, "cat-harness.ts"), exportName: "CatHarnessDeclarationKind", rule: "instance-declaration" },
  { kind: WorkPlanKind, file: join(import.meta.dir, "..", "sdlc", "work-plan.ts"), exportName: "WorkPlanKind", rule: "process-tag" },
];

/** The layer this module belongs to: the one whose code holds {@link NAME_RULE_KINDS}. */
//
// The harness, found rather than walked to: this module moved to
// cat-harness-tools (bean `8lcl`) but the kinds it names are still the harness's.
const OWN_INSTANCE = (): string => {
  const root = harnessRoot();
  return root ? (readDeclaration(root)?.name ?? "") : "";
};

/** A family (or a typology's nodes as a whole) that no node kind validates yet. */
export interface Unkinded {
  typology: string;
  /** The `$schema` family; absent when it is the typology's kind-level validator. */
  family?: string;
  reason: "zod-schema" | "no-validator" | "unresolvable";
  ref?: string;
}

export interface NodeKindIndex {
  kinds: NodeKindEntry[];
  unkinded: Unkinded[];
  /** Two different kinds sharing one id — always a finding. */
  collisions: string[];
}

/**
 * The index file, `cat-harness/docs/_data/node-kinds.json`, as a node kind —
 * so the file that records node kinds is itself one, and the gate that refuses
 * a new unkinded family does not start by refusing its own. Built at publish
 * since 2026-10-15; its `unkinded` is a report, and the baselines the gate
 * reads are each layer's own ({@link UnkindedBaselineKind}).
 */
export const NodeKindIndexFileKind = nodeKind("node-kind-index/1.1.0", [], {
  kinds: z.array(z.object({
    id: z.string().min(1),
    version: z.string().optional(),
    tag: z.string().optional(),
    parents: z.array(z.string()),
    subclasses: z.array(z.string()),
    declaredBy: z.string().optional(),
    module: z.string().optional(),
    exportName: z.string().optional(),
    pages: z.object({ module: z.string().min(1), exportName: z.string().min(1) }).optional(),
    holdings: z.array(z.object({ typology: z.string().min(1), family: z.string().optional() })),
    // 1.1.0 (bean `ujiv`): a kind found by a name rule rather than a typology.
    foundBy: z.enum(["instance-declaration", "process-tag"]).optional(),
  })),
  unkinded: z.array(z.object({
    typology: z.string().min(1),
    family: z.string().optional(),
    reason: z.enum(["zod-schema", "no-validator", "unresolvable"]),
    ref: z.string().optional(),
  })),
  collisions: z.array(z.string()),
});

/** The key the gate's baseline is kept under: `typology` or `typology#family`. */
export const unkindedKey = (u: Pick<Unkinded, "typology" | "family">): string =>
  u.family === undefined ? u.typology : `${u.typology}#${u.family}`;

/**
 * Build the index from `registry`. `instanceRoot` is what an unqualified
 * validator ref resolves against (cat-harness's root, as `check:kind-validators`
 * uses); `repoRoot` makes the recorded module paths repo-relative.
 */
export async function nodeKindIndex(
  registry: GraphTypologyRegistry,
  instanceRoot: string,
  repoRoot: string,
  nameRules: readonly NameRuleKind[] = NAME_RULE_KINDS,
): Promise<NodeKindIndex> {
  const byId = new Map<string, { kind: NodeKind; entry: NodeKindEntry }>();
  const collisions = new Set<string>();
  const unkinded: Unkinded[] = [];

  const add = (kind: NodeKind, declared?: { declaredBy: string; module: string; exportName: string }): NodeKindEntry => {
    const prior = byId.get(kind.id);
    if (prior) {
      if (prior.kind !== kind) collisions.add(kind.id);
      if (declared && !prior.entry.module) Object.assign(prior.entry, declared);
      return prior.entry;
    }
    const entry: NodeKindEntry = { id: kind.id, ...(kind.version ? { version: kind.version, tag: kind.tag } : {}), parents: kind.parents.map((p) => p.id), subclasses: [], ...declared, holdings: [] };
    byId.set(kind.id, { kind, entry });
    // Ancestors are kinds too, though no typology may name them directly.
    for (const p of kind.parents) add(p);
    return entry;
  };

  const resolveRef = async (validator: string): Promise<{ kind?: NodeKind; declaredBy: string; at?: { module: string; exportName: string }; reason?: Unkinded["reason"] }> => {
    let ref;
    try {
      ref = parseValidatorRef(validator);
    } catch {
      return { declaredBy: "", reason: "unresolvable" };
    }
    // The implementing layer when the module is code that moved out of the declaring one (bean 8lcl).
    const base = moduleRootOf(ref, instanceRoot);
    if (base === undefined) return { declaredBy: ref.instance ?? "", reason: "unresolvable" };
    const declaredBy = ref.instance ?? readDeclaration(instanceRoot)?.name ?? "";
    const abs = resolve(join(base, ref.module));
    if (!existsSync(abs)) return { declaredBy, reason: "unresolvable" };
    let mod: Record<string, unknown>;
    try {
      // input-site: declared validator-refs #771876e3 — validator modules named by graph typology and node-kind declarations, resolved from them at fingerprint time (`scripts/declared-imports.ts`); input-sites.test.ts holds the two to each other
      mod = (await import(abs)) as Record<string, unknown>;
    } catch {
      return { declaredBy, reason: "unresolvable" };
    }
    const named = mod[ref.exportName];
    const at = { module: relative(repoRoot, abs).split("\\").join("/"), exportName: ref.exportName };
    return isNodeKind(named) ? { kind: named, declaredBy, at } : { declaredBy, at, reason: "zod-schema" };
  };

  // A renderer is resolved to a path, not imported: only the page generator
  // runs it, and an index that executed page code to list kinds would fail on
  // a renderer's bug rather than report the kind.
  const withPages = (entry: NodeKindEntry, typology: string, family?: string): NodeKindEntry => {
    const pages = registry.validatorNodeFor(typology, family)?.node.pages;
    if (!pages || entry.pages) return entry;
    const ref = parseValidatorRef(pages);
    const base = moduleRootOf(ref, instanceRoot);
    if (base !== undefined) entry.pages = { module: relative(repoRoot, resolve(join(base, ref.module))).split("\\").join("/"), exportName: ref.exportName };
    return entry;
  };

  for (const name of registry.names().sort()) {
    const typology = resolveGraphTypology(name).kind;
    if (typology !== name) continue; // an alias: its canonical name is visited on its own
    const def = registry.get(typology);
    if (!def) continue;
    // Another layer's typology is that layer's to index (bean `w1gy`).
    if (ownedOutside(registry, typology, repoRoot)) continue;
    const families = Object.entries((def.nodeSchemas ?? {}) as Record<string, NodeSchemaRef>);
    // A typology with families is judged per family; one without is judged on
    // its kind-level validator, and one with neither holds nothing a node kind
    // could type (markdown, XML, code) and is not counted.
    if (families.length > 0) {
      for (const [family, ref] of families) {
        if (ref.external) continue; // an outside standard, e.g. JSON Schema itself
        const validator = ref.validator;
        if (!validator) {
          unkinded.push({ typology, family, reason: "no-validator" });
          continue;
        }
        const r = await resolveRef(validator);
        if (r.kind) withPages(add(r.kind, { declaredBy: r.declaredBy, ...r.at! }), typology, family).holdings.push({ typology, family });
        else unkinded.push({ typology, family, reason: r.reason ?? "unresolvable", ref: validator });
      }
    } else if (def.validator) {
      const r = await resolveRef(def.validator);
      if (r.kind) withPages(add(r.kind, { declaredBy: r.declaredBy, ...r.at! }), typology).holdings.push({ typology });
      else unkinded.push({ typology, reason: r.reason ?? "unresolvable", ref: def.validator });
    }
  }

  // Kinds no typology holds, found by a name rule instead.
  for (const { kind, file, exportName, rule } of nameRules) {
    add(kind, { declaredBy: OWN_INSTANCE(), module: relative(repoRoot, file).split("\\").join("/"), exportName }).foundBy = rule;
  }

  for (const { entry } of byId.values()) {
    for (const p of entry.parents) byId.get(p)?.entry.subclasses.push(entry.id);
  }
  const kinds = [...byId.values()].map(({ entry }) => ({ ...entry, subclasses: entry.subclasses.sort() }));
  kinds.sort((a, b) => a.id.localeCompare(b.id));
  unkinded.sort((a, b) => unkindedKey(a).localeCompare(unkindedKey(b)));
  return { kinds, unkinded, collisions: [...collisions].sort() };
}

/**
 * Families unkinded now that `baseline` does not list — the gate's finding.
 * A baselined family that has since become a kind is simply absent from `now`,
 * so the baseline shrinks without a separate rule.
 */
export function newUnkinded(now: Pick<NodeKindIndex, "unkinded">, baseline: Pick<NodeKindIndex, "unkinded"> | undefined): string[] {
  const known = new Set((baseline?.unkinded ?? []).map(unkindedKey));
  return now.unkinded.map(unkindedKey).filter((k) => !known.has(k));
}

/** Every kind at or below `id` in the subclass tree — what a kind's page lists. */
export function kindAndSubclasses(index: Pick<NodeKindIndex, "kinds">, id: string): string[] {
  const byId = new Map(index.kinds.map((k) => [k.id, k]));
  const out: string[] = [];
  const visit = (k: string): void => {
    if (out.includes(k)) return;
    out.push(k);
    for (const s of byId.get(k)?.subclasses ?? []) visit(s);
  };
  visit(id);
  return out;
}

/**
 * The layer that OWNS a typology's families, and so keeps them in its
 * baseline: the layer whose `typologies/` graph declares the typology, or,
 * for one declared in code here (`BASE_GRAPH_TYPOLOGIES`, or a registration
 * `REGISTRATION_MODULE` names), this module's own layer.
 *
 * The DECLARER, not the validator's layer: a family is a `nodeSchemas` key
 * of the typology, so it appears and disappears with that declaration, and a
 * validator node another layer adds later moves no family between baselines.
 *
 * `undefined` is "could not attribute" — a typology registered in code by a
 * module this one does not know (a layer's own `registry.register`). The gate
 * reports it rather than filing it under a guess.
 */
export function typologyOwner(registry: GraphTypologyRegistry, typology: string): string | undefined {
  const name = resolveGraphTypology(typology).kind;
  const file = registry.declaredBy(name);
  if (file === undefined) {
    return Object.hasOwn(BASE_GRAPH_TYPOLOGIES, name) || Object.hasOwn(REGISTRATION_MODULE, name) ? OWN_INSTANCE() || undefined : undefined;
  }
  const abs = resolve(file);
  const roots = [...new Set(registry.roots().flatMap((r) => layerRootsIn(r)))].sort((a, b) => b.length - a.length);
  const root = roots.find((r) => abs.startsWith(resolve(r) + "/"));
  if (root === undefined) return undefined;
  // The NEAREST declaring layer inside that root, not the root itself: the
  // standalone fixture (`test/fixtures/standalone-checkout/`, which
  // `FOLIO_FIXTURE_CHECKOUT` adds to discovery) holds copies of other layers'
  // layers, and a typology one of them declares is that layer's — not
  // the layer whose directory happens to contain the fixture (bean `w1gy`).
  // For a typology a layer root declares directly the two agree.
  const nearest = findInstanceRoot(dirname(abs));
  const owner = nearest !== undefined && (resolve(nearest) + "/").startsWith(resolve(root) + "/") ? nearest : root;
  return readDeclaration(owner)?.name;
}

/**
 * Whether a typology is owned by a layer this checkout does not hold — a
 * layer outside `checkout`, whose families that layer judges against its own
 * baseline and whose validators it declares. A typology with no owner is
 * NOT outside: it stays unattributed, and the gate reports it.
 *
 * Standalone, the only such typologies are the fixture's (bean `w1gy`); in a
 * composed checkout every layer is held and this is always false.
 */
export function ownedOutside(registry: GraphTypologyRegistry, typology: string, checkout: string): boolean {
  const owner = typologyOwner(registry, typology);
  if (owner === undefined) return false;
  return !checkoutNames(checkout).has(owner);
}

const namesByCheckout = new Map<string, Set<string>>();
function checkoutNames(checkout: string): Set<string> {
  const key = resolve(checkout);
  let names = namesByCheckout.get(key);
  if (!names) {
    names = new Set();
    for (const r of layerRootsIn(key)) {
      try {
        const name = readDeclaration(r)?.name;
        if (name) names.add(name);
      } catch {
        // an unreadable declaration names nothing
      }
    }
    namesByCheckout.set(key, names);
  }
  return names;
}

/** One family a layer's baseline admits: the key, nothing that can drift with another layer. */
export const UnkindedBaselineEntrySchema = z.object({ typology: z.string().min(1), family: z.string().min(1).optional() }).strict();
export type UnkindedBaselineEntry = z.infer<typeof UnkindedBaselineEntrySchema>;

/**
 * A layer's ratchet baseline: the families IT owns ({@link typologyOwner})
 * that may stay unkinded. Declared as an asset of role `unkinded-baseline`, so
 * where it lives is the layer's declaration and not a convention here.
 *
 * Keys only — `typology` and `family`. The reason and the validator ref are in
 * the publish-time table: a ref names the validator's layer, which may sit
 * above this one, and a reason changes when ANOTHER layer adds a validator
 * node, which must not make this layer's commit stale.
 */
export const UnkindedBaselineKind = nodeKind("unkinded-baseline/1.0.0", [], {
  unkinded: z.array(UnkindedBaselineEntrySchema),
}, { strict: true });

/** The baseline file, as written: entries sorted by key, so a regenerate is byte-stable. */
export function renderBaseline(unkinded: readonly Pick<Unkinded, "typology" | "family">[]): string {
  const entries = [...new Map(unkinded.map((u) => [unkindedKey(u), u.family === undefined ? { typology: u.typology } : { typology: u.typology, family: u.family }])).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, e]) => e);
  return JSON.stringify({ $schema: UnkindedBaselineKind.tag!, unkinded: entries }, null, 2) + "\n";
}

/** Where a layer declares its baseline, absolute; `undefined` when it declares none (an empty baseline). */
export function baselinePath(instanceRoot: string, registry?: GraphTypologyRegistry): string | undefined {
  return declaredAssetPath(instanceRoot, UNKINDED_BASELINE_ROLE, registry);
}

/** One layer's verdict against its own baseline. */
export interface LayerRatchet {
  instance: string;
  /** Unkinded now, owned here, and not in the baseline: the gate's finding. */
  fresh: string[];
  /** In the baseline and no longer an unkinded family here: a stale baseline, shrunk by the writer. */
  gone: string[];
  /** In the baseline and unkinded, but OWNED by another layer: a baseline may name only its own. */
  foreign: string[];
  /** What the writer leaves in the baseline (what it held and still owns unkinded, plus `fresh` when accepted). */
  keep: Unkinded[];
}

/**
 * The per-layer ratchet. `owners` maps each typology to its owning layer;
 * `baselines` maps each layer to what its baseline admits (`undefined`: it
 * declares none). Every layer that owns an unkinded family, or declares a
 * baseline, gets a verdict. An unkinded family whose typology has no owner is
 * returned as `unattributed`, never filed under a guess.
 */
export function ratchet(
  index: Pick<NodeKindIndex, "unkinded">,
  owners: (typology: string) => string | undefined,
  baselines: ReadonlyMap<string, readonly Pick<Unkinded, "typology" | "family">[] | undefined>,
  accept = false,
): { layers: LayerRatchet[]; unattributed: Unkinded[] } {
  const ownedBy = new Map<string, Unkinded[]>();
  const ownerOf = new Map<string, string>();
  const unattributed: Unkinded[] = [];
  for (const u of index.unkinded) {
    const o = owners(u.typology);
    if (o === undefined) {
      unattributed.push(u);
      continue;
    }
    ownerOf.set(unkindedKey(u), o);
    ownedBy.set(o, [...(ownedBy.get(o) ?? []), u]);
  }
  const instances = [...new Set([...ownedBy.keys(), ...[...baselines.entries()].filter(([, b]) => b !== undefined).map(([i]) => i)])].sort();
  const layers = instances.map((instance): LayerRatchet => {
    const now = ownedBy.get(instance) ?? [];
    const held = new Set((baselines.get(instance) ?? []).map(unkindedKey));
    const fresh = now.map(unkindedKey).filter((k) => !held.has(k));
    const nowKeys = new Set(now.map(unkindedKey));
    const foreign = [...held].filter((k) => !nowKeys.has(k) && ownerOf.has(k)).sort();
    const gone = [...held].filter((k) => !nowKeys.has(k) && !ownerOf.has(k)).sort();
    const keep = now.filter((u) => held.has(unkindedKey(u)) || accept);
    return { instance, fresh, gone, foreign, keep };
  });
  return { layers, unattributed };
}
