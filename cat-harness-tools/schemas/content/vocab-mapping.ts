/**
 * A vocabulary mapping: one source vocabulary's values carried into a target
 * vocabulary, declared as data rather than written as a line in a generator.
 *
 * @module schemas/vocab-mapping
 * @graphNode schema
 *
 * Mapping tables are KG data applied by one in-process Tool, and they
 * interoperate with FHIR ConceptMaps. Design:
 * `docs/proposals/vocabulary-mappings-2026-10-02.md`.
 *
 * ## The shape is a ConceptMap's
 *
 * A table is a map → group → element → target tree, with the field names FHIR
 * R5 `ConceptMap` uses. A group pairs one SOURCE vocabulary with one TARGET
 * vocabulary (`source` and `target`, each an IRI or a CURIE). An element's
 * `code` is the source field. Each `target` names the target term (`code`) and
 * the relationship between them. An existing ConceptMap, R5 or R4, is
 * representable here without loss (`fromConceptMap` in the FHIR IG layer's
 * `schemas/vocab-mapping-fhir.ts`), and a table can be produced as a
 * ConceptMap, lossily, with the loss reported (`toConceptMap`).
 *
 * ## Beyond a ConceptMap
 *
 * A generator needs fields a ConceptMap does not carry; `toConceptMap`
 * reports each one it drops:
 *
 * | field | why a generator needs it |
 * |---|---|
 * | `target.key` | the JSON term written, where it differs from the target code (`usage` for `cat-harness:hasLaneUsage`) |
 * | `target.authority: "derived"` + `derivedFrom` | `vocabulary-authority`'s rule: one predicate is the fact, another a rendering of it. The derived value is COPIED from the authoritative output, so the two cannot drift |
 * | `target.transform` | `copy` (the default), `flag` (true or nothing), or `code` (the value is prepared in code before the mapping; the row says so rather than hiding it) |
 *
 * ## More than R5
 *
 * R4 says things R5 cannot: ten `equivalence` codes where R5 has five
 * relationships, and a `dependsOn` with a `system` and a `display`. Those are
 * kept verbatim beside the R5 field (`equivalence`, `dependsOn[].system`) so
 * an R4 map stays recoverable. `relationship` is always present: for an R4
 * map it is derived from `equivalence` by {@link R4_TO_R5_RELATIONSHIP}.
 *
 * Every ConceptMap key this schema does not interpret (`extension`, `id` on a
 * backbone element, `contact`, `jurisdiction`, `text`, …) is carried in the
 * `extra` bag at its level, or in `metadata` at the map level.
 * `vocab-mapping-fhir.test.ts` asserts the interpreted fields do not leak into
 * those bags on real maps.
 *
 * @conformsTo hl7-fhir
 * @conformsTo w3c-skos
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";

import { ownDirectories } from "../kg/cat-harness.js";

/** The tag every table file carries, so the file declares what it is. */
export const VOCAB_MAPPING_SCHEMA = "folio-vocab-mapping/v1";

/**
 * FHIR R5 `ConceptMapRelationship` (`http://hl7.org/fhir/concept-map-relationship`),
 * read from `hl7.fhir.r5.core@5.0.0`'s CodeSystem rather than recalled.
 * `equivalent` and the two `source-is-…` codes are children of `related-to`.
 */
export const RELATIONSHIPS = [
  "related-to",
  "equivalent",
  "source-is-narrower-than-target",
  "source-is-broader-than-target",
  "not-related-to",
] as const;
export const RelationshipSchema = z.enum(RELATIONSHIPS);
export type Relationship = z.infer<typeof RelationshipSchema>;

/**
 * FHIR R4 `ConceptMapEquivalence` (`http://hl7.org/fhir/concept-map-equivalence`),
 * read from `hl7.fhir.r4.examples@4.0.1`'s CodeSystem. The hierarchy:
 * `relatedto` > {`equivalent` > `equal`, `wider`, `subsumes`, `narrower`,
 * `specializes`, `inexact`}, and `unmatched` > `disjoint`.
 */
export const R4_EQUIVALENCES = [
  "relatedto",
  "equivalent",
  "equal",
  "wider",
  "subsumes",
  "narrower",
  "specializes",
  "inexact",
  "unmatched",
  "disjoint",
] as const;
export const R4EquivalenceSchema = z.enum(R4_EQUIVALENCES);
export type R4Equivalence = z.infer<typeof R4EquivalenceSchema>;

/**
 * R4 equivalence → the R5 relationship it falls under, from the two code
 * systems' definitions. R4 `wider` is *"the target mapping is wider in
 * meaning than the source"*, so the SOURCE is narrower than the target. The
 * direction flips between the two releases' wording, and this table is where
 * that flip is written once.
 *
 * Six of the ten land on a coarser code (`equal`, `subsumes`, `specializes`,
 * `inexact`, `unmatched`, `disjoint`). That is why `equivalence` is kept
 * verbatim on the target rather than recomputed from `relationship`.
 */
export const R4_TO_R5_RELATIONSHIP: Readonly<Record<R4Equivalence, Relationship>> = {
  relatedto: "related-to",
  equivalent: "equivalent",
  equal: "equivalent",
  wider: "source-is-narrower-than-target",
  subsumes: "source-is-narrower-than-target",
  narrower: "source-is-broader-than-target",
  specializes: "source-is-broader-than-target",
  inexact: "related-to",
  unmatched: "not-related-to",
  disjoint: "not-related-to",
};

/** R5 relationship → the R4 equivalence that says it, used only when no R4 code was recorded. */
export const R5_TO_R4_EQUIVALENCE: Readonly<Record<Relationship, R4Equivalence>> = {
  "related-to": "relatedto",
  equivalent: "equivalent",
  "source-is-narrower-than-target": "wider",
  "source-is-broader-than-target": "narrower",
  "not-related-to": "disjoint",
};

/**
 * The SKOS mapping property for a relationship — what the terminology work
 * (`check-term-mapping.ts`, bean `5yhm`) already publishes. `A skos:broadMatch
 * B` says B is broader, which is R5's `source-is-narrower-than-target`.
 * `related-to` is `relatedMatch`; `skos:closeMatch` also reads back as
 * `related-to`, because R5 has no code for "close". `not-related-to` has no
 * SKOS property at all, and is `undefined` rather than a guess.
 */
export const SKOS_MATCH_FOR: Readonly<Record<Relationship, string | undefined>> = {
  equivalent: "skos:exactMatch",
  "source-is-narrower-than-target": "skos:broadMatch",
  "source-is-broader-than-target": "skos:narrowMatch",
  "related-to": "skos:relatedMatch",
  "not-related-to": undefined,
};

/** The relationship a SKOS mapping property states. */
export const RELATIONSHIP_FOR_SKOS: Readonly<Record<string, Relationship>> = {
  "skos:exactMatch": "equivalent",
  "skos:broadMatch": "source-is-narrower-than-target",
  "skos:narrowMatch": "source-is-broader-than-target",
  "skos:closeMatch": "related-to",
  "skos:relatedMatch": "related-to",
};

/** Keys at one level that this schema does not interpret, carried verbatim. */
const Extra = z.record(z.string(), z.unknown());

/**
 * A FHIR `value[x]`: `type` is the suffix (`Coding`, `String`, `Code`, …), so
 * `valueCoding` is `{type: "Coding", value: {…}}`. An R4 `dependsOn.value`,
 * which has no suffix because R4 allows only a string, is `{type: "String"}`.
 */
export const TypedValueSchema = z.object({ type: z.string().min(1), value: z.unknown() });
export type TypedValue = z.infer<typeof TypedValueSchema>;

/** `dependsOn` / `product`: R5's `attribute`, or R4's `property`, with what each release adds. */
export const DependencySchema = z.object({
  /** R5 `attribute` (a code); R4 `property` (a URI). */
  attribute: z.string().min(1),
  value: TypedValueSchema.optional(),
  /** R5 only. */
  valueSet: z.string().min(1).optional(),
  /** R4 only. */
  system: z.string().min(1).optional(),
  /** R4 only. */
  display: z.string().optional(),
  extra: Extra.optional(),
});
export type Dependency = z.infer<typeof DependencySchema>;

export const TargetPropertySchema = z.object({
  code: z.string().min(1),
  value: TypedValueSchema,
  extra: Extra.optional(),
});

export const TargetSchema = z
  .object({
    /** The target term: a predicate's local name, or a code in the target system. */
    code: z.string().min(1).optional(),
    display: z.string().optional(),
    valueSet: z.string().min(1).optional(),
    relationship: RelationshipSchema,
    /** The R4 statement, verbatim, when the row came from an R4 map. */
    equivalence: R4EquivalenceSchema.optional(),
    comment: z.string().optional(),
    property: z.array(TargetPropertySchema).optional(),
    dependsOn: z.array(DependencySchema).optional(),
    product: z.array(DependencySchema).optional(),
    // ── Beyond a ConceptMap: what applying the row needs (see the header). ──
    /** The JSON term written, when it is not `code`. */
    key: z.string().min(1).optional(),
    /** `derived`: a rendering of another target's output, copied from it. */
    authority: z.enum(["authoritative", "derived"]).optional(),
    /** The `key` (or `code`) of the authoritative target a derived one copies. */
    derivedFrom: z.string().min(1).optional(),
    transform: z.enum(["copy", "flag", "code"]).optional(),
    extra: Extra.optional(),
  })
  .refine((t) => (t.authority === "derived") === (t.derivedFrom !== undefined), {
    message: "a derived target names the target it copies (`derivedFrom`), and only a derived one does",
    path: ["derivedFrom"],
  })
  .refine((t) => t.equivalence === undefined || R4_TO_R5_RELATIONSHIP[t.equivalence] === t.relationship, {
    message: "`relationship` must be the R5 code the recorded R4 `equivalence` falls under",
    path: ["relationship"],
  });
export type Target = z.infer<typeof TargetSchema>;

export const ElementSchema = z.object({
  /** The source term: a field of the source record, or a code in the source system. */
  code: z.string().min(1).optional(),
  display: z.string().optional(),
  valueSet: z.string().min(1).optional(),
  /** Deliberately unmapped: an absence that is a statement, not a gap (R5 `noMap`). */
  noMap: z.boolean().optional(),
  target: z.array(TargetSchema).optional(),
  extra: Extra.optional(),
});
export type Element = z.infer<typeof ElementSchema>;

/** What happens to a source term no element names. R4's `provided` is R5's `use-source-code`; R4's `url` is `otherMap`. */
export const UnmappedSchema = z.object({
  mode: z.enum(["use-source-code", "fixed", "other-map"]),
  code: z.string().optional(),
  display: z.string().optional(),
  valueSet: z.string().optional(),
  relationship: RelationshipSchema.optional(),
  otherMap: z.string().optional(),
  extra: Extra.optional(),
});

export const GroupSchema = z.object({
  /** The source vocabulary: an IRI, or a CURIE whose prefix is declared. Never carries `|version`. */
  source: z.string().min(1).optional(),
  sourceVersion: z.string().min(1).optional(),
  target: z.string().min(1).optional(),
  targetVersion: z.string().min(1).optional(),
  element: z.array(ElementSchema).min(1),
  unmapped: UnmappedSchema.optional(),
  extra: Extra.optional(),
});
export type Group = z.infer<typeof GroupSchema>;

/** `sourceScope[x]` / `targetScope[x]` in R5; `source[x]` / `target[x]` in R4. */
export const ScopeSchema = z.object({ type: z.enum(["Uri", "Canonical"]), value: z.string().min(1) });

export const VocabMappingSchema = z.object({
  $schema: z.literal(VOCAB_MAPPING_SCHEMA),
  /** This table's id. A ConceptMap's own resource `id` is metadata, kept in `metadata.id`. */
  id: z.string().min(1),
  url: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "retired", "unknown"]),
  experimental: z.boolean().optional(),
  date: z.string().optional(),
  publisher: z.string().optional(),
  description: z.string().optional(),
  purpose: z.string().optional(),
  copyright: z.string().optional(),
  sourceScope: ScopeSchema.optional(),
  targetScope: ScopeSchema.optional(),
  /** R5 map-level `property` and `additionalAttribute` definitions, verbatim. */
  property: z.array(z.record(z.string(), z.unknown())).optional(),
  additionalAttribute: z.array(z.record(z.string(), z.unknown())).optional(),
  group: z.array(GroupSchema),
  /** Every other ConceptMap field (contact, jurisdiction, meta, text, identifier, the resource id, …), verbatim. */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type VocabMapping = z.infer<typeof VocabMappingSchema>;

// ── Applying a table: the `vocab-map` Tool ─────────────────────────────

/** A value is ABSENT when writing it would say nothing (JSON-LD reads `null` as "remove"). */
function absent(v: unknown): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

/**
 * Whether a target's `dependsOn` holds for this record: the declared
 * CONDITION on a row (bean `lodp`, finding D1).
 *
 * A dependency names an attribute the table declares in
 * `additionalAttribute` and the single value it must have. The record must
 * ANSWER it: a missing attribute is a thrown error, never a silent "no",
 * because the point of declaring the condition is that every emitter applying
 * the table has to decide it. `concept-scheme-naming`'s `isDocument` is the
 * first: the `sl9u` rule, which two emitters applied and two correctly did
 * not, with nothing saying why.
 *
 * Only a single-valued dependency is evaluated. A `valueSet`, or a dependency
 * with no value, is refused by name rather than guessed at.
 */
function conditionHolds(m: VocabMapping, key: string, t: Target, record: Readonly<Record<string, unknown>>): boolean {
  for (const d of t.dependsOn ?? []) {
    if (d.value === undefined || d.valueSet !== undefined) {
      throw new Error(`${m.id}: "${key}" depends on "${d.attribute}" without a single value, which the applier cannot evaluate`);
    }
    const answer = record[d.attribute];
    if (answer === undefined) {
      throw new Error(`${m.id}: "${key}" is written only when "${d.attribute}" is ${JSON.stringify(d.value.value)}, and the record does not say whether it is — an emitter applying this table must answer it`);
    }
    if (answer !== d.value.value) return false;
  }
  return true;
}

/**
 * Apply a table to one source record: the properties it maps to, in the
 * order the table lists them, with each derived target placed directly after
 * the target it copies.
 *
 * The record's keys are the elements' `code`s. An element with `noMap`, or
 * whose value is absent, writes nothing. A target with a `dependsOn` is
 * written only when its condition holds, and the record must answer the
 * condition ({@link conditionHolds}). Writing one key twice is refused,
 * because two rows that each believe they own a key are the drift this
 * schema exists to make visible.
 */
export function applyVocabMapping(m: VocabMapping, record: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Array<[string, unknown]> = [];
  const derived: Array<{ key: string; from: string }> = [];
  const keyOf = (t: Target): string => {
    const k = t.key ?? t.code;
    if (k === undefined) throw new Error(`${m.id}: a target with no code and no key writes nothing a reader can name`);
    return k;
  };
  for (const g of m.group) {
    for (const e of g.element) {
      if (e.noMap === true || e.code === undefined) continue;
      const v = record[e.code];
      for (const t of e.target ?? []) {
        const key = keyOf(t);
        if (!conditionHolds(m, key, t, record)) continue;
        if (t.authority === "derived") {
          derived.push({ key, from: t.derivedFrom! });
          continue;
        }
        if (t.transform === "flag") {
          if (v) out.push([key, true]);
          continue;
        }
        if (!absent(v)) out.push([key, v]);
      }
    }
  }
  for (const d of derived) {
    const at = out.findIndex(([k]) => k === d.from);
    if (at === -1) continue; // the authoritative value is absent, so its rendering is too
    out.splice(at + 1, 0, [d.key, out[at]![1]]);
  }
  const seen = new Set<string>();
  for (const [k] of out) {
    if (seen.has(k)) throw new Error(`${m.id}: two rows write "${k}"`);
    seen.add(k);
  }
  return Object.fromEntries(out);
}

/** Prefixes a table may write a system with. Callers add a layer's own (`NS_PREFIXES`). */
export const STANDARD_PREFIXES: Readonly<Record<string, string>> = {
  skos: "http://www.w3.org/2004/02/skos/core#",
  dcterms: "http://purl.org/dc/terms/",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  owl: "http://www.w3.org/2002/07/owl#",
  prov: "http://www.w3.org/ns/prov#",
  schema: "https://schema.org/",
};

/** Expand a CURIE whose prefix is known; anything else (an IRI, a URN) is returned as written. */
export function expandCurie(v: string, prefixes: Readonly<Record<string, string>>): string {
  const m = /^([A-Za-z][\w.-]*):(.*)$/.exec(v);
  if (m === null || m[2]!.startsWith("//")) return v;
  const ns = prefixes[m[1]!];
  return ns === undefined ? v : `${ns}${m[2]}`;
}

/**
 * The JSON-LD `@context` bindings the given tables' rows imply: JSON key →
 * predicate IRI, in table order. A generator spreads this into its context
 * instead of restating each binding, so the key it WRITES with the table and
 * the predicate a reader EXPANDS it to come from one row (bean `lodp`,
 * finding D2: fsh-guts said it mapped `description` "exactly as the main
 * export" and did not).
 *
 * A predicate stays a CURIE when the document's own context declares its
 * prefix (`inContext`), and is otherwise expanded through `prefixes`. That is
 * the difference between a binding and a bug: `"rdfs:label"` in a context
 * with no `rdfs` prefix is not RDFS's label but an absolute IRI whose scheme
 * is `rdfs`, which is what fsh-guts published until this existed. A prefix
 * neither map knows is refused.
 *
 * `only` keeps the rows whose JSON key is listed — a generator that writes two
 * of a table's keys binds two. A key two rows bind to DIFFERENT predicates is
 * refused; bound twice to the same one is the same fact and kept once.
 * Derived targets bind like any other, and `noMap` elements bind nothing.
 */
export function contextBindings(
  tables: readonly VocabMapping[],
  opts: {
    inContext: Readonly<Record<string, string>>;
    prefixes: Readonly<Record<string, string>>;
    only?: readonly string[];
  },
): Record<string, string> {
  const out = new Map<string, { iri: string; from: string }>();
  for (const m of tables) {
    for (const g of m.group) {
      for (const e of g.element) {
        if (e.noMap === true) continue;
        for (const t of e.target ?? []) {
          const key = t.key ?? t.code;
          if (key === undefined || t.code === undefined || g.target === undefined) continue;
          if (opts.only !== undefined && !opts.only.includes(key)) continue;
          const written = `${g.target}${t.code}`;
          const curie = /^([A-Za-z][\w.-]*):(?!\/\/)(.*)$/.exec(written);
          let iri = written;
          if (curie !== null && opts.inContext[curie[1]!] === undefined) {
            const ns = opts.prefixes[curie[1]!];
            if (ns === undefined) throw new Error(`${m.id}: "${written}" uses a prefix neither the document nor the known prefixes declare`);
            iri = ns + curie[2]!;
          }
          const had = out.get(key);
          if (had !== undefined && had.iri !== iri) {
            throw new Error(`"${key}" is bound to ${had.iri} by ${had.from} and to ${iri} by ${m.id}: one key, two predicates`);
          }
          if (had === undefined) out.set(key, { iri, from: m.id });
        }
      }
    }
  }
  if (opts.only !== undefined) {
    const missing = opts.only.filter((k) => !out.has(k));
    if (missing.length > 0) throw new Error(`no row of ${tables.map((m) => m.id).join(", ")} writes ${missing.join(", ")}`);
  }
  return Object.fromEntries([...out].map(([k, v]) => [k, v.iri]));
}

// ── Finding the tables ──────────────────────────────────────────────────

/** Parse one table file, naming the file when it is not one. */
export function parseVocabMapping(path: string): VocabMapping {
  const r = VocabMappingSchema.safeParse(JSON.parse(readFileSync(path, "utf-8")));
  if (!r.success) throw new Error(`${path}: not a ${VOCAB_MAPPING_SCHEMA} table — ${r.error.message}`);
  return r.data;
}

/** Every table in these directories, by id. A file with another `$schema` is not one and is skipped. */
export function loadVocabMappings(dirs: readonly string[]): Map<string, VocabMapping> {
  const out = new Map<string, VocabMapping>();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
      const p = join(dir, f);
      const head = JSON.parse(readFileSync(p, "utf-8")) as { $schema?: unknown };
      if (head.$schema !== VOCAB_MAPPING_SCHEMA) continue;
      const m = parseVocabMapping(p);
      if (out.has(m.id)) throw new Error(`${p}: table id "${m.id}" is declared twice`);
      out.set(m.id, m);
    }
  }
  return out;
}

/**
 * The `vocab-mapping` directories a layer declares, its own only.
 *
 * Own rather than overlaid: a table belongs to the Tool that applies it, and
 * the Tool lives in this layer. Resolved from the declaration, never from
 * a literal path. Synchronous, because its first caller (`glossary-export`'s
 * `buildGlossary`) is.
 */
export function vocabMappingDirs(instanceRoot: string): string[] {
  return ownDirectories({ name: "(root)", root: resolve(instanceRoot), own: true })
    .filter((d) => d.graphTypologies.includes("vocab-mapping"))
    .map((d) => d.absPath);
}

/** One table by id from a layer's declared directories, or a thrown error naming what was looked for. */
export function vocabMapping(instanceRoot: string, id: string): VocabMapping {
  const dirs = vocabMappingDirs(instanceRoot);
  const m = loadVocabMappings(dirs).get(id);
  if (m === undefined) throw new Error(`no vocab-mapping table "${id}" in ${dirs.join(", ") || "(no declared vocab-mapping directory)"}`);
  return m;
}
