#!/usr/bin/env bun
/**
 * Read `schemas/*.ts` as a graph of declarations and the edges between them.
 *
 * @module scripts/schema-graph
 * @graphNode none — a reader over the schema graph, not a schema itself
 *
 * `schemas/` is a declared graph typology holding **content** (`BASE_GRAPH_TYPOLOGIES`:
 * *"a shape is the subject matter of the schema graph"*) but is
 * `renderable: false`; this is the reader that lets it be looked at. The
 * projection built from it is gated — see `gen-schema-viz.ts`.
 *
 * ## Why the AST, not the type checker or the published JSON Schema
 *
 * Both alternatives **erase the edges a class diagram is made of**:
 *
 * - **The published JSON Schema.** `harness-schema-export.ts` renders with
 *   `$refStrategy: "none"`, right for a dereferenceable document, so a named
 *   schema like `ContentDirectory` is an anonymous object repeated at each use
 *   site.
 *
 * - **The TypeScript type checker.** `z.infer<typeof FooSchema>` resolves to a
 *   deeply expanded structural type, so `Foo.bar` comes back as the whole of
 *   `Bar` inlined rather than a reference to it.
 *
 * Only the syntactic form still holds `bar: BarSchema` as a reference to a
 * named thing. That is the edge; everything else is a property of a box.
 * `typescript` is already a direct dependency, so the viewer built over this
 * keeps `kg-viewer.ts`'s rule of no CDN and no third party.
 *
 * ## Resolution is syntactic, and says so
 *
 * A referenced name is resolved in this order: an export of the same module,
 * then through that module's import map to the exporting module. A name that
 * is neither is recorded in {@link SchemaDecl.unresolved} rather than dropped
 * — usually a type from outside the schema graph.
 *
 * ## Three states, and `undetermined` is never a pass
 *
 * A Zod expression this walker does not recognise yields
 * `kind: "undetermined"` **with the head of the expression recorded in
 * `note`** — never an empty object that renders as a type with no fields.
 * `z.lazy`, a 16-member union and the registry pattern in `cat-harness.ts` are
 * the real cases.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, posix, relative } from "node:path";

import ts from "typescript";

import { checkoutRootFor, findInstanceRoot } from "../schemas/kg/cat-harness.js";
import { checkoutDirectoriesForGraph, corpusDirectoriesForGraph, rootInstanceName } from "../schemas/kg/harness-config.js";
import { withConcernGroupDirs } from "./concern-groups.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { FHIR_CORE_SD, fhirCoreRelease, isFhirStructureDefinition, readFhirLogicalModel } from "./fhir-logical-model.ts";
import { readModdleMetamodels } from "./moddle-metamodel.ts";
import { readRdfVocabularies, type VocabularyRead } from "./rdf-vocabulary.ts";

/**
 * Which layers' `schemas` directories a reading covers.
 *
 * - `corpus` (the default): this layer and every layer stacked ON it,
 *   never its own dependencies — the rule for a tool shipped BY a layer
 *   (`directory-conventions` §corpus scope). `kg-audit` and the glossary read
 *   this, and their verdicts are about the corpus they serve.
 * - `checkout`: every layer in the checkout, dependencies included. The
 *   schemas VIEWER reads this (issue #2278): it is a handler publishing one
 *   page per subject, and a dependency such as `bootstrap` is a subject the
 *   owner expects to browse. Leaving it out made
 *   `/cat-harness/schemas/bootstrap/` a 404 with nothing saying why.
 */
export interface SchemaGraphScope {
  scope?: "corpus" | "checkout";
}

/**
 * EVERY declared `schemas` directory reachable from this root.
 *
 * ## Why plural, and why the singular version was a bug waiting for main
 *
 * The first version asked `directoryForGraph(root, "schemas")` for THE
 * directory. That call throws by design when more than one directory declares
 * a graph — the `wggr` guard, which exists because returning the first
 * silently once resolved `cat-harness` to `schemas/` and wrote 37 sidecars
 * against the wrong subjects on a run that exited 0.
 *
 * It threw the moment this branch met main. Four layers declare a
 * `schemas` graph now — `schemas/`, the content core's `schemas/`,
 * `large-datasets/schemas/` and `detangle/schemas/` — so the singular question
 * has no answer, and the guard said so rather than picking one. **The right
 * fix is not to pick one.** The schema graph genuinely spans layers, a
 * viewer that showed one of four would report a corpus that does not exist,
 * and every id here is already repo-relative so four directories cannot
 * collide.
 *
 * declared-path-literal: the fallback is at the call site so the choice is
 * visible. It applies only when NOTHING declares the graph — an unmigrated
 * layer — and an absent conventional directory yields `[]` rather than a
 * path nothing is at.
 */
export function schemaRoots(root: string, opts: SchemaGraphScope = {}): string[] {
  const declared =
    opts.scope === "checkout"
      ? checkoutDirectoriesForGraph("schemas", root)
      : corpusDirectoriesForGraph(root, "schemas");
  if (declared.length > 0) return [...declared].sort();
  const conventional = join(root, "schemas");
  return existsSync(conventional) ? [conventional] : [];
}

/**
 * What a declaration IS, as far as the syntax says.
 *
 * `undetermined` is a real member rather than an absence. See the module note.
 */
export type DeclKind =
  | "zod-object"
  | "zod-union"
  | "zod-enum"
  | "zod-array"
  | "zod-record"
  | "zod-scalar"
  | "interface"
  | "type-alias"
  | "json-schema"
  | "fhir-logical"
  | "fhir-profile"
  | "owl-class"
  | "rdfs-class"
  | "rdf-property-set"
  | "moddle-class"
  | "moddle-enum"
  | "undetermined";

/** One field of an object-like declaration. */
export interface SchemaField {
  name: string;
  /** The field's expression as written, collapsed to one line. */
  type: string;
  optional: boolean;
  /** `true` when the field is a list of its target. */
  array: boolean;
  /** Names this field mentions, before resolution. */
  names: string[];
  /** First line of the field's own doc comment, when it has one. */
  doc?: string;
  /**
   * The first prose PARAGRAPH of the field's doc comment, its lines joined by
   * one space: everything up to the first blank line or tag line.
   *
   * `doc` is the first LINE, which is right for a detail panel and wrong for
   * a definition: measured 2026-09-24, 177 of 1,515 documented fields break
   * their first sentence across lines, so `doc` ends mid-clause ("OPTIONAL
   * because folio"). The glossary's extracted schema-field terms (bean `lqo9`)
   * read this instead. Not carried into the published projection.
   */
  paragraph?: string;
  /**
   * The declaration this field's STRING ID points at, when the field declares
   * one with `@ref <Name>`.
   *
   * This exists because the reader is syntactic and a foreign key carried as
   * `z.string()` holds no link to the schema it names — measured against
   * `assistant-schema.puml`, 0 of 9 id-associations were reproduced while 14
   * of 15 compositions were. That is not a gap a better reader closes: the
   * information is not in the source. So it is DECLARED, in the one place
   * that cannot drift from the field, and the diagram draws what the author
   * said rather than what a heuristic guessed.
   */
  ref?: string;
  /**
   * The least number of values, when the source states it: JSON Schema
   * `minItems` (with `required`), a FHIR element's `min`. Unset, it is read
   * from {@link SchemaField.optional} and {@link SchemaField.array} by
   * {@link cardinalityOf}.
   */
  min?: number;
  /** The most, when the source states it: `maxItems`, a FHIR `max`; `"*"` is unbounded. */
  max?: number | "*";
  /** The source states no cardinality and none can be read: drawn `?..?`, never guessed. */
  cardinalityUnknown?: true;
  /**
   * The source states the upper bound and not the lower one — a moddle
   * descriptor says `isMany` and nothing else: drawn `?..1` / `?..*`.
   */
  minUnknown?: true;
  /**
   * Type name → where its definition is (a canonical URL), for a type that is
   * not a declaration of this graph — a FHIR datatype while no layer holds FHIR
   * core. A type that IS a declaration links by its edge instead.
   */
  typeLinks?: Record<string, string>;
  /**
   * What a profile says about the field beyond its type and cardinality —
   * `MS` (mustSupport), `= value` (fixed), `~ value` (pattern), `prohibited`
   * — drawn after the cardinality as `{…}` (bean `cat-tools-t6fz`).
   */
  constraint?: string;
}

/** One declaration — a Zod schema, an interface, a type alias, a JSON Schema or a FHIR logical model. */
export interface SchemaDecl {
  /** `<module>#<name>`, unique across the graph. */
  id: string;
  name: string;
  /** Repo-relative module path. */
  module: string;
  kind: DeclKind;
  /** For `undetermined`: the head of what was seen. Never omitted silently. */
  note?: string;
  /**
   * The IRI the source names itself by — a JSON Schema `$id`, a FHIR `url` —
   * so a reference by canonical resolves to it.
   */
  canonical?: string;
  /** First prose line of the declaration's doc comment. */
  doc?: string;
  /**
   * `true` when the declaration's doc comment carries `@general` — a node
   * others DEPEND on (a Role, a Skill, a Requirement statement), which may
   * point only at other general nodes and never at its dependents
   * (data-modelling step 8; #1168, B5). Read from the tag, never inferred:
   * which nodes are general is a modelling decision, and `arrow-direction`
   * checks the arrows against it.
   */
  general?: true;
  fields: SchemaField[];
  /**
   * Names this declaration extends or merges — the generalisation arrow.
   *
   * Populated for Zod (`.extend`, `.merge`, `.and`, and a bare base at the
   * head of the chain) and for an interface's heritage clauses. It is a
   * separate field from {@link SchemaDecl.values} because an extension is an
   * EDGE and a literal member is a property of the box, and the first version
   * of this reader carried both in `values`, which made a diagram unable to
   * tell them apart.
   */
  extendsNames: string[];
  /** Literal members of an enum or a union of literals. */
  values: string[];
  /** Declaration ids this one references, resolved. */
  refs: string[];
  /**
   * Names bound in this module that resolved to no declaration in the graph.
   *
   * A real finding: usually a type imported from outside `schemas/`. Distinct
   * from {@link SchemaDecl.external}, which is bound to a non-relative import
   * and was never a candidate.
   */
  unresolved: string[];
  /**
   * Names bound to a NON-RELATIVE import — `z` from `zod`, `ts` from
   * `typescript`.
   *
   * Recorded rather than dropped, because the rule throughout this reader is
   * that nothing disappears silently. But they are not unresolved references:
   * they resolved perfectly well, to a module outside the schema graph, and
   * listing them beside genuine misses would bury the misses. Measured before
   * this split existed: `z` alone accounted for **151** of the 150 distinct
   * "unresolved" names — the single noisiest entry in a list whose whole
   * purpose is to be read.
   */
  external: string[];
  /** 1-indexed line in its module, for a deep link. */
  line: number;
  /** `true` when the declaration is exported. */
  exported: boolean;
}

/** A resolved reference from one declaration to another. */
export interface SchemaEdge {
  from: string;
  to: string;
  /** The field it goes through, or `""` for a union member or an extension. */
  via: string;
  /**
   * `id-ref` is an association DECLARED by `@ref`, not one the reader found:
   * the field is a string and the target is typically not even imported. Kept
   * distinct from `field` so a consumer can tell a reference the source proves
   * from one an author asserted.
   */
  kind: "field" | "member" | "extends" | "id-ref";
  optional: boolean;
  array: boolean;
}

/** One module of the schema graph. */
export interface SchemaGraphModule {
  /** Repo-relative path. */
  module: string;
  /**
   * The layer whose `schemas/` directory this is.
   *
   * Four layers declare one now, and a viewer that merged them would
   * report a corpus that does not exist — the same per-instance rule the
   * uploads queues follow.
   */
  instance: string;
  /** Bare stem — the identifier a node IRI is minted from. */
  name: string;
  /** From the module's own `@graphNode` tag. */
  graphNode: "schema" | "none" | "undeclared";
  /** The reason given after `none —`, when one is. */
  reason?: string;
  /** First prose line of the leading docblock. */
  summary?: string;
  isTest: boolean;
  /** Declaration ids in this module. */
  decls: string[];
}

/** The whole reading. */
export interface SchemaGraph {
  /** Repo-relative paths of every directory read. */
  roots: string[];
  modules: SchemaGraphModule[];
  decls: SchemaDecl[];
  edges: SchemaEdge[];
  /**
   * Every `@ref` that named nothing, or named several things.
   *
   * Reported rather than dropped, for the reason every other state here is:
   * a tag the graph could not honour and a field with no tag at all are
   * different answers, and rendering them alike reports a clean run over a
   * broken assertion.
   */
  refProblems: string[];
  /**
   * Sources the reading was asked to cover and could not open — a declared
   * FHIR artefact index that is built at publish and absent here. Listed so a
   * viewer says "not read", never shows the IG as having no logical models.
   */
  unread: string[];
  /**
   * The published vocabularies and metamodels the checkout read (SKOS, PROV,
   * BPMN, …), each with the namespace it defines, for the QA report's check
   * that an external-schema record names it (bean `cat-tools-xfd4`).
   */
  vocabularies?: VocabularyRead[];
}

/** The graph typology an IG's artefact index is declared under (the FHIR layer's kind). */
const FHIR_ARTIFACT_INDEX = "fhir-artifact-index";

/** The graph typology FHIR core's StructureDefinitions are declared under (by whichever layer holds it; never named here). */
const FHIR_CORE_DEFINITIONS = "fhir-core-definitions";

const TAG = /@graphNode\s+(\S+)(?:\s*[—-]\s*(.*))?/;

/**
 * The first prose line of a JSDoc block, skipping tag lines.
 *
 * The opening `/**` and closing marker are stripped BEFORE splitting rather
 * than by dropping the first line. Dropping line 1 works for a multi-line
 * block and silently returns nothing for a one-liner — `/** A thing. *\/` is
 * a single line, so its only content was the line being discarded. Caught by
 * the reader's own test, which is the case a corpus-wide count would have
 * hidden: most docblocks here are long, so the miss shows up as "a few
 * declarations have no summary" rather than as a defect.
 */
function firstProse(block: string): string | undefined {
  return block
    .replace(/^\/\*\*+/, "")
    .replace(/\*+\/\s*$/, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\*+\s?/, "").trim())
    .find((l) => l.length > 0 && !l.startsWith("@"));
}

/** The first prose paragraph of a JSDoc block: {@link firstProse}'s line and the lines that continue it. */
function firstParagraph(block: string): string | undefined {
  const lines = block
    .replace(/^\/\*\*+/, "")
    .replace(/\*+\/\s*$/, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\*+\s?/, "").trim());
  const start = lines.findIndex((l) => l.length > 0 && !l.startsWith("@"));
  if (start < 0) return undefined;
  const out: string[] = [];
  for (const l of lines.slice(start)) {
    if (l.length === 0 || l.startsWith("@")) break;
    out.push(l);
  }
  return out.join(" ");
}

/** The first prose paragraph of the JSDoc block immediately above a node. */
function paragraphOf(node: ts.Node, text: string): string | undefined {
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart());
  const last = ranges?.[ranges.length - 1];
  if (!last) return undefined;
  const raw = text.slice(last.pos, last.end);
  return raw.startsWith("/**") ? firstParagraph(raw) : undefined;
}

/**
 * The `@ref <Name>` a field declares, if any.
 *
 * Read from the RAW block rather than from `doc`, because `firstProse` skips
 * every `@`-line on purpose — the prose summary and the machine-readable tag
 * are different things and neither should swallow the other.
 */
function refTagOf(node: ts.Node, text: string): string | undefined {
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart());
  const last = ranges?.[ranges.length - 1];
  if (!last) return undefined;
  const raw = text.slice(last.pos, last.end);
  if (!raw.startsWith("/**")) return undefined;
  const m = /@ref\s+([A-Za-z_$][\w$]*)/.exec(raw);
  return m?.[1];
}

/** Whether the JSDoc block immediately above a node carries `@general`. */
function generalTagOf(node: ts.Node, text: string): true | undefined {
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart());
  const last = ranges?.[ranges.length - 1];
  if (!last) return undefined;
  const raw = text.slice(last.pos, last.end);
  return raw.startsWith("/**") && /(^|\s)@general\b/m.test(raw) ? true : undefined;
}

/** The JSDoc block immediately above a node, as source text. */
function docOf(node: ts.Node, text: string): string | undefined {
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart());
  if (!ranges) return undefined;
  const last = ranges[ranges.length - 1];
  if (!last) return undefined;
  const raw = text.slice(last.pos, last.end);
  return raw.startsWith("/**") ? firstProse(raw) : undefined;
}

/**
 * Every identifier mentioned in an expression or type node.
 *
 * Deliberately over-collects: `z`, `string` and other noise come back too, and
 * are discarded at resolution time by failing to resolve. Filtering here would
 * need a list of things to ignore, and a list is a second place for the schema
 * graph's vocabulary to be wrong.
 */
function namesIn(node: ts.Node): string[] {
  const out: string[] = [];
  const walk = (n: ts.Node): void => {
    if (ts.isIdentifier(n)) out.push(n.text);
    // A property access — `z.string`, `Foo.Bar` — contributes only its head,
    // because the tail is a member name and never a declaration in this graph.
    else if (ts.isPropertyAccessExpression(n)) walk(n.expression);
    else n.forEachChild(walk);
  };
  node.forEachChild(walk);
  if (ts.isIdentifier(node)) out.push(node.text);
  return [...new Set(out)];
}

/** One line, collapsed, truncated — enough to read in a table cell. */
function oneLine(s: string, max = 120): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * The chain of Zod calls on an expression, outermost first.
 *
 * `z.string().optional()` gives `["optional", "string"]`. Used to detect
 * optionality and arrays without caring what sits underneath them.
 */
function callChain(node: ts.Expression): string[] {
  const out: string[] = [];
  let cur: ts.Expression = node;
  for (;;) {
    if (ts.isCallExpression(cur)) {
      const c: ts.Expression = cur.expression;
      if (ts.isPropertyAccessExpression(c)) {
        out.push(c.name.text);
        cur = c.expression;
        continue;
      }
      cur = c;
      continue;
    }
    if (ts.isPropertyAccessExpression(cur)) {
      out.push(cur.name.text);
      cur = cur.expression;
      continue;
    }
    break;
  }
  return out;
}

/**
 * What a Zod expression is, read by walking its call chain.
 *
 * ## Why `.extend()` is handled explicitly, and what it cost not to
 *
 * The first version of this walker looked for a `z.object({…})` at the head
 * and classified everything else `undetermined`. Measured over this
 * repository: **31 declarations** came back undetermined and nearly all of
 * them were `BaseSchema.extend({…})` — which is not an unrecognisable shape,
 * it is THE inheritance relation in this corpus. `BlockBaseSchema` is extended
 * by every block kind; `ProvableBaseSchema` by every provable one. So the
 * walker was discarding precisely the generalisation arrow a class diagram is
 * drawn to show, and reporting it as "could not determine" — which is honest
 * about the failure and useless as a diagram.
 *
 * Handled here: `object` / `strictObject` / `looseObject` contribute fields;
 * `extend` contributes fields AND an extension; `merge` and `and` contribute
 * an extension; `lazy` contributes a reference through its thunk. Anything
 * else still lands in `undetermined` WITH the head of the expression, because
 * the point of that state is that it names what it saw.
 */
interface ZodReading {
  kind: DeclKind;
  note?: string;
  fields: SchemaField[];
  /** Names this declaration extends or merges — the generalisation arrow. */
  extendsNames: string[];
}

/** Fields of a `z.object({...})`-shaped literal. */
function zodFields(lit: ts.ObjectLiteralExpression, text: string): SchemaField[] {
  const out: SchemaField[] = [];
  for (const p of lit.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const name = ts.isIdentifier(p.name)
      ? p.name.text
      : ts.isStringLiteral(p.name)
        ? p.name.text
        : undefined;
    if (name === undefined) continue;
    const chain = callChain(p.initializer);
    out.push({
      name,
      type: oneLine(p.initializer.getText()),
      optional: chain.includes("optional") || chain.includes("nullish") || chain.includes("default"),
      array: chain.includes("array"),
      names: namesIn(p.initializer),
      doc: docOf(p, text),
      paragraph: paragraphOf(p, text),
      ref: refTagOf(p, text),
    });
  }
  return out;
}

/** String-literal members of a `z.enum([...])` or a union of literals. */
function literalValues(node: ts.Expression): string[] {
  const out: string[] = [];
  const walk = (n: ts.Node): void => {
    if (ts.isStringLiteral(n)) out.push(n.text);
    else n.forEachChild(walk);
  };
  walk(node);
  return [...new Set(out)];
}

/** Read a Zod expression: its kind, its fields and what it extends. */
function readZod(node: ts.Expression, text: string): ZodReading {
  const fields: SchemaField[] = [];
  const extendsNames: string[] = [];
  const ops: string[] = [];
  let sawObject = false;

  /** Walk the chain from outermost call inward, collecting what each op means. */
  let cur: ts.Expression = node;
  for (;;) {
    if (ts.isCallExpression(cur)) {
      const callee = cur.expression;
      const op = ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined;
      if (op) ops.push(op);
      const args = cur.arguments;
      if (op === "object" || op === "strictObject" || op === "looseObject" || op === "extend") {
        const a = args[0];
        if (a && ts.isObjectLiteralExpression(a)) {
          sawObject = true;
          // Outermost wins on a name collision: `.extend({a})` over
          // `object({a})` is a narrowing, and the narrowed one is the truth.
          for (const f of zodFields(a, text)) {
            if (!fields.some((g) => g.name === f.name)) fields.push(f);
          }
        }
      }
      if (op === "merge" || op === "and") {
        for (const a of args) if (ts.isIdentifier(a)) extendsNames.push(a.text);
      }
      cur = ts.isPropertyAccessExpression(callee) ? callee.expression : callee;
      continue;
    }
    if (ts.isPropertyAccessExpression(cur)) {
      cur = cur.expression;
      continue;
    }
    break;
  }

  // The base of the chain. `BlockBaseSchema.extend({…})` bottoms out at the
  // identifier `BlockBaseSchema`, and that is the generalisation. `z.object(…)`
  // bottoms out at `z`, which is the namespace and never a declaration — it is
  // discarded at resolution time by not being bound to a relative import.
  if (ts.isIdentifier(cur) && cur.text !== "z") extendsNames.push(cur.text);

  if (sawObject || extendsNames.length > 0) {
    return { kind: "zod-object", fields, extendsNames };
  }
  if (ops.includes("enum") || ops.includes("nativeEnum")) {
    return { kind: "zod-enum", fields, extendsNames };
  }
  if (ops.includes("union") || ops.includes("discriminatedUnion")) {
    return { kind: "zod-union", fields, extendsNames };
  }
  if (ops.includes("array")) return { kind: "zod-array", fields, extendsNames };
  if (ops.includes("record") || ops.includes("map")) {
    return { kind: "zod-record", fields, extendsNames };
  }
  for (const scalar of ["string", "number", "boolean", "literal", "date", "bigint", "lazy"]) {
    if (ops.includes(scalar)) return { kind: "zod-scalar", fields, extendsNames };
  }
  // The honest answer, and it names what it saw. A reader that returned
  // `zod-object` with no fields here would render these as types that
  // reference nothing, which is the one thing a schema viewer must not do.
  return { kind: "undetermined", note: oneLine(node.getText(), 160), fields, extendsNames };
}

/** Members of an interface or an object type literal. */
function typeMembers(members: ts.NodeArray<ts.TypeElement>, text: string): SchemaField[] {
  const out: SchemaField[] = [];
  for (const m of members) {
    if (!ts.isPropertySignature(m) || !m.type) continue;
    const name = ts.isIdentifier(m.name)
      ? m.name.text
      : ts.isStringLiteral(m.name)
        ? m.name.text
        : undefined;
    if (name === undefined) continue;
    out.push({
      name,
      type: oneLine(m.type.getText()),
      optional: m.questionToken !== undefined,
      array: ts.isArrayTypeNode(m.type),
      names: namesIn(m.type),
      doc: docOf(m, text),
      paragraph: paragraphOf(m, text),
      ref: refTagOf(m, text),
    });
  }
  return out;
}

/**
 * `./foo.js`, `../kg/foo.ts` → `./foo`, `../kg/foo`: a relative specifier as
 * a PATH, extension dropped; anything else → `null`.
 *
 * A path and not a bare stem since the concern-group regroup (bean `f8wp`):
 * `schemas/<group>/` put modules one directory down, so `./foo` and
 * `../kg/foo` name different files, and a stem keyed to the importer's own
 * directory resolved every cross-group import to nothing.
 */
function moduleSpecifierPathOf(specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  return specifier.replace(/\.(ts|js|mts|mjs)$/, "");
}

/** A module's path with `.ts` dropped: the key an import specifier resolves to. */
function moduleKeyOf(moduleRel: string): string {
  return moduleRel.replace(/\.ts$/, "");
}

/** The module key `specifier` names, read from inside `fromModule`. */
function resolveSpecifier(fromModule: string, specifier: string): string {
  return posix.normalize(posix.join(posix.dirname(fromModule), specifier));
}

/**
 * What a module RE-EXPORTS: `export * from "./x.js"` (`names` null) and
 * `export { A, B as C } from "./x.js"` (`names` maps exported → original).
 *
 * The regroup's one-release shims at the old paths are exactly this shape,
 * and a module still importing through one must reach the declaration it
 * forwards to rather than be reported as naming nothing.
 */
interface ReExport {
  specifier: string;
  names: Map<string, string> | null;
}

function reExportsOf(src: ts.SourceFile): ReExport[] {
  const out: ReExport[] = [];
  for (const st of src.statements) {
    if (!ts.isExportDeclaration(st) || !st.moduleSpecifier || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const specifier = moduleSpecifierPathOf(st.moduleSpecifier.text);
    if (specifier === null) continue;
    const clause = st.exportClause;
    if (clause === undefined) {
      out.push({ specifier, names: null });
      continue;
    }
    if (!ts.isNamedExports(clause)) continue;
    const names = new Map<string, string>();
    for (const el of clause.elements) names.set(el.name.text, (el.propertyName ?? el.name).text);
    out.push({ specifier, names });
  }
  return out;
}

/**
 * Every name BOUND in a module, and where it came from.
 *
 * The value is the exporting module's specifier path for a relative import
 * (see {@link moduleSpecifierPathOf}), `""` for a non-relative one (`z` from
 * `zod`), and `null` for a name declared here.
 *
 * ## Why this replaced a plain import map, and why it is not a deny-list
 *
 * The first version collected every identifier mentioned in an expression and
 * tried to resolve each one. Measured: the top "unresolved reference" in the
 * whole graph was **`z`**, at 151 occurrences — the Zod namespace object,
 * mentioned in every schema and a declaration in none. `Record`, `Array`,
 * `Set` and a tail of lowercase noise followed it.
 *
 * The tempting fix is a list of names to ignore. That is a second, drifting
 * statement of the schema graph's vocabulary, and this repository has paid for
 * that shape before. The fix here needs no list: **a name is a candidate
 * reference only if the module BINDS it** — declares it, or imports it. `z`
 * is bound, to `zod`, which is not a relative import and therefore not part of
 * this graph; `Record` and `Array` are globals and bound by nothing. Both fall
 * out of the candidate set for a reason the module itself states, rather than
 * because somebody remembered to list them.
 */
function bindingsOf(src: ts.SourceFile): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const st of src.statements) {
    if (ts.isImportDeclaration(st) && st.importClause && ts.isStringLiteral(st.moduleSpecifier)) {
      // `""` marks a NON-RELATIVE import — bound, and bound outside this
      // graph. `null` marks a name declared in this module. Keeping them apart
      // is what lets `z` (bound to `zod`) be reported as external rather than
      // as the graph's most-referenced missing declaration.
      const stem = moduleSpecifierPathOf(st.moduleSpecifier.text) ?? "";
      const named = st.importClause.namedBindings;
      if (named && ts.isNamedImports(named)) {
        for (const el of named.elements) out.set(el.name.text, stem);
      }
      if (named && ts.isNamespaceImport(named)) out.set(named.name.text, stem);
      if (st.importClause.name) out.set(st.importClause.name.text, stem);
      continue;
    }
    // Locally declared names bind too — a schema referring to another in the
    // same file never goes through an import.
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) out.set(d.name.text, null);
      }
      continue;
    }
    if (
      (ts.isInterfaceDeclaration(st) ||
        ts.isTypeAliasDeclaration(st) ||
        ts.isFunctionDeclaration(st) ||
        ts.isClassDeclaration(st) ||
        ts.isEnumDeclaration(st)) &&
      st.name
    ) {
      out.set(st.name.text, null);
    }
  }
  return out;
}

/** Read one module's declarations. */
function readModule(
  file: string,
  moduleRel: string,
  text: string,
): { decls: SchemaDecl[]; bindings: Map<string, string | null>; reExports: ReExport[] } {
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const stem = basename(moduleRel).replace(/\.ts$/, "");
  const decls: SchemaDecl[] = [];
  const lineOf = (n: ts.Node): number =>
    src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1;
  const isExported = (n: ts.Node): boolean =>
    ts.canHaveModifiers(n) &&
    (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

  for (const st of src.statements) {
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        // Only Zod expressions. A plain constant is not a shape, and treating
        // every exported const as a declaration would bury 199 schemas among
        // path literals and regexes.
        const names = namesIn(d.initializer);
        const chain = callChain(d.initializer);
        const looksZod = names.includes("z") || /Schema$/.test(d.name.text);
        if (!looksZod) continue;
        const read = readZod(d.initializer, text);
        decls.push({
          id: `${moduleRel}#${d.name.text}`,
          name: d.name.text,
          module: moduleRel,
          kind: read.kind,
          note: read.note,
          doc: docOf(st, text),
          ...(generalTagOf(st, text) ? { general: true as const } : {}),
          fields: read.fields,
          extendsNames: read.extendsNames,
          values:
            read.kind === "zod-enum" || read.kind === "zod-union"
              ? literalValues(d.initializer)
              : [],
          refs: [],
          unresolved: [],
          external: [],
          line: lineOf(d),
          exported: isExported(st),
        });
        void chain;
        void stem;
      }
      continue;
    }
    if (ts.isInterfaceDeclaration(st)) {
      // Heritage clauses go to `extendsNames`, not to `values`. They are the
      // same generalisation arrow a Zod `.extend()` draws, and putting them
      // where literal members go is what made the first draft render an
      // interface's base class as though it were an enum case.
      const heritage = (st.heritageClauses ?? []).flatMap((h) =>
        h.types.flatMap((t) => (ts.isIdentifier(t.expression) ? [t.expression.text] : [])),
      );
      decls.push({
        id: `${moduleRel}#${st.name.text}`,
        name: st.name.text,
        module: moduleRel,
        kind: "interface",
        doc: docOf(st, text),
        ...(generalTagOf(st, text) ? { general: true as const } : {}),
        fields: typeMembers(st.members, text),
        extendsNames: heritage,
        values: [],
        refs: [],
        unresolved: [],
        external: [],
        line: lineOf(st),
        exported: isExported(st),
      });
      continue;
    }
    if (ts.isTypeAliasDeclaration(st)) {
      const t = st.type;
      const fields = ts.isTypeLiteralNode(t) ? typeMembers(t.members, text) : [];
      const values = ts.isUnionTypeNode(t)
        ? t.types.filter(ts.isLiteralTypeNode).map((n) => n.literal.getText().replace(/["']/g, ""))
        : [];
      decls.push({
        id: `${moduleRel}#${st.name.text}`,
        name: st.name.text,
        module: moduleRel,
        kind: "type-alias",
        doc: docOf(st, text),
        ...(generalTagOf(st, text) ? { general: true as const } : {}),
        fields,
        extendsNames: [],
        values,
        refs: [],
        unresolved: [],
        external: [],
        line: lineOf(st),
        exported: isExported(st),
      });
    }
  }
  return { decls, bindings: bindingsOf(src), reExports: reExportsOf(src) };
}

// ── JSON Schema files (issue #2278) ─────────────────────────────────────
//
// `bootstrap/schemas/` holds `*.schema.json` and no TypeScript: bootstrap must
// be readable with nothing installed, so its shapes are JSON Schema. A reader
// that took `.ts` only reported bootstrap as having no schemas at all, which
// is a wrong answer rather than a partial one. Each file is read as one
// declaration for the root schema and one per `definitions` / `$defs` entry,
// plus one per inline object property (`Root.part`), so a nested shape is a
// class of its own rather than a field typed `object` (bean `cat-tools-4xq6`).

const JSON_SCHEMA_SUFFIX = ".schema.json";

/**
 * One reference a JSON-document reader found, before it is resolved.
 *
 * Shared by every reader over JSON documents — JSON Schema here, FHIR logical
 * models in `fhir-logical-model.ts` — so one resolver turns them all into
 * edges and the viewer cannot tell which reader drew a box.
 */
export interface ClassModelRef {
  from: string;
  /** The reference as written: a `$ref`, or a canonical URL. */
  ref: string;
  /** The module the ref was written in, which a relative ref resolves against. */
  module: string;
  via: string;
  kind: SchemaEdge["kind"];
  optional: boolean;
  array: boolean;
  /**
   * `canonical`: resolve only by a declaration's {@link SchemaDecl.canonical}
   * (a FHIR type or profile URL). Otherwise canonical first, then by path.
   */
  by?: "canonical";
  /** A miss is expected (FHIR core not held here): no edge, and not reported as unresolved. */
  quietMiss?: true;
  /** The FHIR version of the model the ref was written in, for choosing a fhir-core release. */
  fhirVersion?: string;
}

/** What a reader over one JSON document returns. */
export interface ClassModelRead {
  decls: SchemaDecl[];
  /** Cross-declaration references, resolved once every file is read. */
  refs: ClassModelRef[];
  /** Edges inside the document, already resolved (a nested class to its parent). */
  edges: SchemaEdge[];
  summary?: string;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** `Knowledge Graph declaration` → `KnowledgeGraphDeclaration`. */
function identifierOf(title: string): string {
  return title
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join("");
}

/** The last segment of a `$ref`: `#/definitions/Node` → `Node`. */
const refName = (ref: string): string => ref.split(/[#/]/).filter(Boolean).pop() ?? ref;

/** A property's type, written the way the field table shows a Zod type. */
function jsonTypeOf(p: unknown): string {
  if (!isObj(p)) return "unknown";
  if (typeof p.$ref === "string") return refName(p.$ref);
  if (p.const !== undefined) return JSON.stringify(p.const);
  if (Array.isArray(p.enum)) return p.enum.map((v) => JSON.stringify(v)).join(" | ");
  for (const k of ["oneOf", "anyOf"] as const) {
    if (Array.isArray(p[k])) return (p[k] as unknown[]).map(jsonTypeOf).join(" | ");
  }
  if (p.type === "array") return `${jsonTypeOf(p.items)}[]`;
  if (Array.isArray(p.type)) return p.type.join(" | ");
  if (typeof p.type === "string") return p.type;
  if (Array.isArray(p.allOf)) return (p.allOf as unknown[]).map(jsonTypeOf).join(" & ");
  return "unknown";
}

/** Every `$ref` anywhere under `v`. */
function refsUnder(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => refsUnder(x, out));
  else if (isObj(v)) {
    if (typeof v.$ref === "string") out.push(v.$ref);
    for (const [k, x] of Object.entries(v)) if (k !== "$ref") refsUnder(x, out);
  }
  return out;
}

const firstLine = (v: unknown): string | undefined =>
  typeof v === "string" ? v.split("\n").map((l) => l.trim()).find(Boolean) : undefined;

/** True for a JSON Schema `type` that is, or includes, `t`. */
const typeIs = (s: Json, t: string): boolean => s.type === t || (Array.isArray(s.type) && s.type.includes(t));

/** An inline object with its own properties: drawn as a nested class. */
const isInlineObject = (v: unknown): v is Json => isObj(v) && typeof v.$ref !== "string" && isObj(v.properties);

/** Keywords that say what a schema IS. One with none of them cannot be drawn honestly. */
const SHAPE_KEYWORDS = [
  "type", "properties", "enum", "const", "$ref", "allOf", "oneOf", "anyOf", "items",
  "additionalProperties", "patternProperties", "not", "if",
] as const;

/**
 * A field's cardinality, `min..max`, as the class diagram writes it.
 *
 * Readers that know it (JSON Schema `minItems`/`maxItems`, FHIR `min`/`max`)
 * set {@link SchemaField.min} / {@link SchemaField.max}. Otherwise it is read
 * from optionality and list-ness: a list is `0..*` unless its written type says
 * `.nonempty()` or `.min(n)`. A reader that could not determine it says
 * `cardinalityUnknown`, and the answer is `?..?`, never a guess.
 */
export function cardinalityOf(f: SchemaField): string {
  if (f.cardinalityUnknown) return "?..?";
  if (f.minUnknown) return `?..${f.max ?? (f.array ? "*" : 1)}`;
  let min = f.min;
  if (min === undefined) {
    if (f.optional) min = 0;
    else if (f.array) {
      const m = /\.min\((\d+)\)/.exec(f.type);
      min = /\.nonempty\(\)/.test(f.type) ? 1 : m ? Number(m[1]) : 0;
    } else min = 1;
  }
  const max = f.max ?? (f.array ? "*" : 1);
  return `${min}..${max}`;
}

/** Read one `*.schema.json` file: its declarations, its local edges and its unresolved `$ref`s. */
export function readJsonSchemaModule(text: string, moduleRel: string): ClassModelRead {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    // Unparseable is UNDETERMINED, stated, never an empty schema.
    const name = basename(moduleRel, JSON_SCHEMA_SUFFIX);
    return {
      decls: [{
        id: `${moduleRel}#${name}`, name, module: moduleRel, kind: "undetermined",
        note: `not valid JSON: ${(e as Error).message}`.slice(0, 120),
        fields: [], extendsNames: [], values: [], refs: [], unresolved: [], external: [], line: 1, exported: true,
      }],
      refs: [],
      edges: [],
    };
  }
  if (!isObj(doc)) return { decls: [], refs: [], edges: [] };
  const decls: SchemaDecl[] = [];
  const refs: ClassModelRef[] = [];
  const edges: SchemaEdge[] = [];
  const taken = new Set<string>();

  const one = (name: string, schema: Json, isRoot = false): string => {
    let unique = name;
    for (let i = 2; taken.has(unique); i++) unique = `${name}${i}`;
    taken.add(unique);
    const id = `${moduleRel}#${unique}`;
    const fields: SchemaField[] = [];
    const extendsNames: string[] = [];

    const addProperties = (s: Json): void => {
      const required = new Set(Array.isArray(s.required) ? (s.required as string[]) : []);
      const props = isObj(s.properties) ? s.properties : {};
      for (const [fname, p] of Object.entries(props)) {
        const optional = !required.has(fname);
        const array = isObj(p) && typeIs(p, "array");
        const item = array && isObj(p) ? p.items : p;
        const field: SchemaField = {
          name: fname,
          type: jsonTypeOf(p),
          optional,
          array,
          names: [],
          ...(isObj(p) && firstLine(p.description) ? { doc: firstLine(p.description) } : {}),
        };
        if (array && isObj(p)) {
          field.min = optional ? 0 : typeof p.minItems === "number" ? p.minItems : 0;
          field.max = typeof p.maxItems === "number" ? p.maxItems : "*";
        }
        if (isInlineObject(item)) {
          // A nested shape is a class of its own, joined by composition.
          const child = one(`${unique}.${fname}`, item);
          const childName = child.slice(child.indexOf("#") + 1);
          field.type = array ? `${childName}[]` : childName;
          edges.push({ from: id, to: child, via: fname, kind: "field", optional, array });
        } else {
          for (const r of refsUnder(p)) {
            refs.push({ from: id, ref: r, module: moduleRel, via: fname, kind: "field", optional, array });
          }
          field.names = refsUnder(p).map(refName);
        }
        fields.push(field);
      }
    };
    addProperties(schema);
    if (Array.isArray(schema.allOf)) {
      for (const part of schema.allOf) {
        if (!isObj(part)) continue;
        if (typeof part.$ref === "string") {
          extendsNames.push(refName(part.$ref));
          refs.push({ from: id, ref: part.$ref, module: moduleRel, via: "", kind: "extends", optional: false, array: false });
        }
        // An inline part's properties are this class's own fields.
        if (isObj(part.properties)) addProperties(part);
      }
    }
    // A schema that is only a `$ref` is an alias of its target: generalisation.
    if (typeof schema.$ref === "string" && !isObj(schema.properties)) {
      extendsNames.push(refName(schema.$ref));
      refs.push({ from: id, ref: schema.$ref, module: moduleRel, via: "", kind: "extends", optional: false, array: false });
    }
    // A union of references: one member edge per alternative, as a Zod union draws.
    for (const k of ["oneOf", "anyOf"] as const) {
      if (!Array.isArray(schema[k])) continue;
      for (const alt of schema[k] as unknown[]) {
        if (isObj(alt) && typeof alt.$ref === "string") {
          refs.push({ from: id, ref: alt.$ref, module: moduleRel, via: "", kind: "member", optional: false, array: false });
        }
      }
    }
    // `uses` is bootstrap's own vocabulary keyword: a term naming the terms
    // it is defined with. It is an association the AUTHOR declared, not one
    // the structure proves, so it is drawn as an id-ref — the `@ref` rule.
    if (Array.isArray(schema.uses)) {
      for (const n of schema.uses) {
        if (typeof n === "string") refs.push({ from: id, ref: `#/$defs/${n}`, module: moduleRel, via: "uses", kind: "id-ref", optional: false, array: false });
      }
    }
    const hasDefs = isObj(schema.$defs) || isObj(schema.definitions);
    const shaped = SHAPE_KEYWORDS.some((k) => schema[k] !== undefined);
    const base = {
      id,
      name: unique,
      module: moduleRel,
      ...(isRoot && typeof schema.$id === "string" ? { canonical: schema.$id } : {}),
      ...(firstLine(schema.description) ? { doc: firstLine(schema.description) } : {}),
      fields,
      extendsNames,
      values: Array.isArray(schema.enum) ? schema.enum.map((v) => String(v)) : [],
      refs: [],
      unresolved: [],
      external: [],
      line: 1,
      exported: true,
    };
    // A schema with no shape keyword says nothing a box could show. A root
    // that only holds `$defs` is a container, which is a statement; anything
    // else is UNDETERMINED with the keys it did have — never an empty class.
    decls.push(
      shaped || (isRoot && hasDefs)
        ? { ...base, kind: "json-schema" }
        : {
            ...base,
            kind: "undetermined",
            note: `could not determine: no ${SHAPE_KEYWORDS.slice(0, 4).join("/")}… keyword (keys: ${Object.keys(schema).slice(0, 6).join(", ") || "none"})`,
          },
    );
    return id;
  };

  const rootName = typeof doc.title === "string" && identifierOf(doc.title) ? identifierOf(doc.title) : identifierOf(basename(moduleRel, JSON_SCHEMA_SUFFIX));
  one(rootName, doc, true);
  for (const key of ["definitions", "$defs"] as const) {
    const defs = doc[key];
    if (isObj(defs)) for (const [n, d] of Object.entries(defs)) if (isObj(d)) one(n, d);
  }
  // The root first: a ref to the file with no fragment names it.
  decls.sort((a, b) => (a.id === `${moduleRel}#${rootName}` ? -1 : b.id === `${moduleRel}#${rootName}` ? 1 : 0));
  return { decls, refs, edges, ...(firstLine(doc.description) ? { summary: firstLine(doc.description) } : {}) };
}

/**
 * Resolve the references JSON-document readers found into edges.
 *
 * In order: a declaration whose {@link SchemaDecl.canonical} is the ref (a JSON
 * Schema `$id`, a FHIR `url`) — then, for a `$ref`, within its own file
 * (`#/definitions/X`) or a sibling file in the same directory, named
 * relatively or by an IRI whose last segment is that file. Anything else — the
 * JSON Schema meta-schema, an outside standard — is external and not an edge,
 * except a canonical a reader asked to resolve (`by: "canonical"`), whose miss
 * is recorded as unresolved: the model names a model this graph does not hold.
 */
export function resolveClassModelRefs(
  refs: readonly ClassModelRef[],
  byId: ReadonlyMap<string, SchemaDecl>,
): { edges: SchemaEdge[]; unresolved: Map<string, string[]> } {
  const edges: SchemaEdge[] = [];
  const unresolved = new Map<string, string[]>();
  const miss = (from: string, ref: string): void => {
    unresolved.set(from, [...(unresolved.get(from) ?? []), ref]);
  };
  const rootOfModule = new Map<string, string>();
  const byCanonical = new Map<string, SchemaDecl>();
  for (const d of byId.values()) {
    if (d.kind !== "undetermined" && !rootOfModule.has(d.module)) rootOfModule.set(d.module, d.id);
    if (d.canonical) byCanonical.set(d.canonical, d);
  }
  const seen = new Set<string>();
  for (const r of refs) {
    const [file, frag = ""] = r.ref.split("#");
    let to: string | undefined;
    const canon = byCanonical.get(file!) ?? byCanonical.get(r.ref);
    if (canon) {
      to = frag === "" || frag === "/" || byCanonical.has(r.ref) ? canon.id : `${canon.module}#${refName(frag)}`;
    } else if (r.by === "canonical") {
      if (!r.quietMiss) miss(r.from, r.ref);
      continue;
    } else {
      const dir = r.module.slice(0, r.module.lastIndexOf("/"));
      const module = file === "" ? r.module : `${dir}/${file!.split("/").pop()}`;
      if (!rootOfModule.has(module)) {
        // Outside this graph, or a sibling that is not here.
        if (file !== "" && !/^https?:/.test(file!)) miss(r.from, r.ref);
        continue;
      }
      to = frag === "" || frag === "/" ? rootOfModule.get(module)! : `${module}#${refName(frag)}`;
    }
    if (!byId.has(to)) {
      miss(r.from, r.ref);
      continue;
    }
    if (to === r.from) continue; // a self-reference is a property of the box
    const key = `${r.from}\0${to}\0${r.via}\0${r.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from: r.from, to, via: r.via, kind: r.kind, optional: r.optional, array: r.array });
  }
  return { edges, unresolved };
}

/**
 * The class model of a few JSON documents on their own — a skill's input and
 * output contracts, a Tool's MCP input schema — read and resolved by the same
 * readers and resolver as the whole graph, so a skill page draws the boxes the
 * schemas viewer draws.
 */
export function classModelOfDocuments(docs: readonly { text: string; module: string }[]): { decls: SchemaDecl[]; edges: SchemaEdge[] } {
  const decls: SchemaDecl[] = [];
  const refs: ClassModelRef[] = [];
  const edges: SchemaEdge[] = [];
  for (const d of docs) {
    const read = readJsonDocument(d.text, d.module);
    if (!read) continue;
    decls.push(...read.decls);
    refs.push(...read.refs);
    edges.push(...read.edges);
  }
  const byId = new Map(decls.map((d) => [d.id, d]));
  const resolved = resolveClassModelRefs(refs, byId);
  for (const d of decls) {
    d.refs = [...new Set([...edges, ...resolved.edges].filter((e) => e.from === d.id).map((e) => e.to))].sort();
    d.unresolved = [...new Set([...d.unresolved, ...(resolved.unresolved.get(d.id) ?? [])])].sort();
  }
  return { decls, edges: [...edges, ...resolved.edges] };
}

/**
 * The reader for one JSON file, chosen by what the file HOLDS, never by a
 * folio's name: a FHIR logical model by `resourceType`/`kind`, a JSON Schema
 * by its `.schema.json` name. `undefined` when no reader models it — a source
 * descriptor, a concern-group file — which is not a schema and is not shown.
 */
export function readJsonDocument(text: string, moduleRel: string): ClassModelRead | undefined {
  if (moduleRel.endsWith(JSON_SCHEMA_SUFFIX)) return readJsonSchemaModule(text, moduleRel);
  if (!moduleRel.endsWith(".json")) return undefined;
  // Cheap sniff before a parse: most JSON in a schemas directory is not FHIR.
  if (!text.includes("StructureDefinition")) return undefined;
  try {
    if (!isFhirStructureDefinition(JSON.parse(text))) return undefined;
  } catch {
    return undefined;
  }
  return readFhirLogicalModel(text, moduleRel);
}

/**
 * Load the FHIR core definitions `refs` reference, from declared
 * `fhir-core-definitions` directories (bean `cat-tools-t6fz`).
 *
 * Only what is referenced, one level deep, from the release the referencing
 * model states (`fhirVersion` → `r4` / `r4b` / `r5`). A release that is unread,
 * a body not materialised, or a model that states no version is reported in
 * `unread`, and the type stays an external, linked name — never a box guessed
 * from another release.
 */
export function loadFhirCore(
  coreDirs: readonly string[],
  refs: readonly ClassModelRef[],
  alreadyLoaded: ReadonlySet<string>,
  rel: (p: string) => string,
  fallbackInstance?: string,
): { modules: SchemaGraphModule[]; decls: SchemaDecl[]; edges: SchemaEdge[]; unread: string[] } {
  const out = { modules: [] as SchemaGraphModule[], decls: [] as SchemaDecl[], edges: [] as SchemaEdge[], unread: [] as string[] };
  if (coreDirs.length === 0) return out;
  const wanted = new Map<string, Set<string>>();
  let noVersion = 0;
  for (const r of refs) {
    if (!r.quietMiss || !r.ref.startsWith(FHIR_CORE_SD)) continue;
    const release = fhirCoreRelease(r.fhirVersion);
    if (!release) {
      noVersion++;
      continue;
    }
    const set = wanted.get(release) ?? new Set<string>();
    set.add(r.ref.split("|")[0]!);
    wanted.set(release, set);
  }
  if (noVersion > 0) out.unread.push(`fhir-core: ${noVersion} reference(s) to FHIR core from models that state no fhirVersion — left external`);
  const loaded = new Set(alreadyLoaded);
  for (const [release, urls] of [...wanted.entries()].sort()) {
    const dir = coreDirs.map((d) => join(d, release)).find((d) => existsSync(join(d, "manifest.json")));
    if (!dir) {
      out.unread.push(`fhir-core/${release}: no declared release directory with a manifest`);
      continue;
    }
    let manifest: { status?: string; reason?: string; definitions?: { url: string; file: string }[] };
    try {
      manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf-8"));
    } catch (e) {
      out.unread.push(`${rel(dir)}: manifest unreadable — ${(e as Error).message.slice(0, 80)}`);
      continue;
    }
    if (manifest.status !== "read") {
      out.unread.push(`${rel(dir)}: release unread — ${manifest.reason ?? "no reason recorded"}`);
      continue;
    }
    const byUrl = new Map((manifest.definitions ?? []).map((d) => [d.url, d.file]));
    const layerRoot = findInstanceRoot(dir) ?? dir;
    const instance = rel(layerRoot).split("/")[0] || fallbackInstance || basename(layerRoot);
    let missing = 0;
    for (const url of [...urls].sort()) {
      if (loaded.has(url)) continue;
      const file = byUrl.get(url);
      if (!file) continue; // a primitive, or not in this release: stays external
      const abs = join(dir, file);
      if (!existsSync(abs)) {
        missing++;
        continue;
      }
      const moduleRel = rel(abs);
      const read = readFhirLogicalModel(readFileSync(abs, "utf-8"), moduleRel);
      if (read.decls.length === 0) continue;
      loaded.add(url);
      out.modules.push({
        module: moduleRel,
        instance,
        name: basename(file, ".json"),
        graphNode: "schema",
        ...(read.summary ? { summary: read.summary } : {}),
        isTest: false,
        decls: read.decls.map((d) => d.id),
      });
      out.decls.push(...read.decls);
      // Its own references stay external (one level deep): only its local edges are kept.
      out.edges.push(...read.edges);
    }
    if (missing > 0) out.unread.push(`${rel(dir)}: ${missing} referenced definition(s) not materialised (run fhir-core:materialise)`);
  }
  return out;
}

/**
 * The class IRIs of the vocabulary `prefix` / `namespace` that `text` names:
 * a CURIE (`schema:DefinedTerm`) or a full IRI, in either scheme
 * (`https://schema.org/X` is the same name as `http://schema.org/X`). A class
 * is a capitalised local name, as every vocabulary read here writes one.
 */
export function classMentions(text: string, prefix: string, namespace: string): Set<string> {
  const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bare = namespace.replace(/^https?:\/\//, "");
  const re = new RegExp(`(?:\\b${esc(prefix)}:|https?://${esc(bare)})([A-Z][A-Za-z0-9_]*)`, "g");
  const out = new Set<string>();
  for (const m of text.matchAll(re)) out.add(`${namespace}${m[1]}`);
  return out;
}

/** What the corpus's declarations name of a vocabulary: every field type and literal value, scanned. */
function vocabularyMentions(decls: readonly SchemaDecl[]): (prefix: string, namespace: string) => Set<string> {
  const text = decls.map((d) => `${d.fields.map((f) => f.type).join(" ")} ${d.values.join(" ")}`).join("\n");
  return (prefix, namespace) => classMentions(text, prefix, namespace);
}

/**
 * Read the whole schema graph.
 *
 * Returns `null` — not an empty graph — when the declared directory does not
 * exist. The two are different answers and a caller rendering them alike
 * reports a clean run over a directory it never opened.
 */
export function readSchemaGraph(root: string, opts: SchemaGraphScope = {}): SchemaGraph | null {
  const dirs = schemaRoots(root, opts);
  if (dirs.length === 0) return null;
  // `kg-audit` passes the ROOT layer here; `dirname` of it is outside the checkout (g43f).
  const repoRoot = checkoutRootFor(root);
  const rel = (p: string): string => relative(repoRoot, p).split("\\").join("/");

  const modules: SchemaGraphModule[] = [];
  const decls: SchemaDecl[] = [];
  /**
   * Module key (its repo-relative path, `.ts` dropped) → its exports, for
   * cross-module resolution.
   *
   * Keyed by PATH because a relative import names a FILE, not a layer —
   * `import { X } from "./foo.js"` inside `detangle/schemas/` means
   * `detangle/schemas/foo.ts`, and two layers may both have a `foo.ts`.
   * A global stem would resolve one layer's import to another's export,
   * which is the `wggr` failure in miniature. It was keyed by directory and
   * stem until the concern-group regroup (bean `f8wp`) put modules in
   * `schemas/<group>/`, where `../kg/foo.js` names a file in ANOTHER
   * directory; resolving the specifier as a path is what reaches it.
   */
  const exportsByModule = new Map<string, Map<string, string>>();
  /** Module key → what it re-exports, for the regroup's old-path shims. */
  const reExportsByModule = new Map<string, ReExport[]>();
  /** References read from JSON documents, resolved after every file is read. */
  const jsonRefs: ClassModelRef[] = [];
  /** Edges a JSON reader resolved inside its own document. */
  const jsonLocalEdges: SchemaEdge[] = [];
  const bindingsByModule = new Map<string, Map<string, string | null>>();
  /**
   * Module path → the declared schema directory it was read from, for `@ref`'s
   * same-directory tier. The DECLARED directory, not a concern group under
   * it: the groups split one directory's corpus by concern, and an `@ref` that
   * resolved within that corpus before the split must resolve the same after.
   */
  const dirOfModule = new Map<string, string>();

  // The root's DECLARED name, else the single landing harness (issue #1904),
  // never the clone's folder name. Undefined only matters if a module sits at
  // the root, and then it is a finding rather than a guess.
  const rootName = rootInstanceName(repoRoot);
  for (const declaredDir of dirs) {
    const declaredRel = rel(declaredDir);
    // The root's DECLARED name, not the clone's folder name (bean `t5dm`,
    // the sibling of `library-graph`'s `instanceOf`).
    const instance = declaredRel.includes("/") ? declaredRel.split("/")[0]! : rootName;
    if (instance === undefined) {
      throw new Error(`${declaredRel} sits at the root of ${repoRoot}, which declares no instance and has no single landing harness (issue #1904)`);
    }
    // The directory AND its declared concern groups (`schemas/<group>/`,
    // named from within by `schemas/schemas.json`; bean `f8wp`), one level
    // deep — the walk `schemaModules` makes, through the same helper so the
    // two readers cannot disagree about which directories are the graph.
    // Reading the declared directory alone saw only the old-path re-export
    // shims once a group moved, and the schemas page lost every declaration
    // the regroup had moved.
    for (const dir of withConcernGroupDirs([declaredDir], "schemas")) {
      const dirRel = rel(dir);
      for (const f of readdirSync(dir).sort()) {
        if (f.endsWith(".json")) {
          const moduleRel = `${dirRel}/${f}`;
          // The reader is chosen by what the file holds (bean `cat-tools-4xq6`):
          // a JSON Schema, a FHIR logical model, or nothing this graph draws.
          const read = readJsonDocument(readFileSync(join(dir, f), "utf-8"), moduleRel);
          if (read === undefined) continue;
          dirOfModule.set(moduleRel, declaredRel);
          modules.push({
            module: moduleRel,
            instance,
            name: basename(basename(f, JSON_SCHEMA_SUFFIX), ".json"),
            // A JSON Schema file IS a schema node: it carries `$id`, and the
            // `@graphNode` tag is a TypeScript docblock convention it cannot hold.
            graphNode: "schema",
            ...(read.summary ? { summary: read.summary } : {}),
            isTest: false,
            decls: read.decls.map((d) => d.id),
          });
          decls.push(...read.decls);
          jsonRefs.push(...read.refs);
          jsonLocalEdges.push(...read.edges);
          continue;
        }
        if (!f.endsWith(".ts")) continue;
        const moduleRel = `${dirRel}/${f}`;
        const text = readFileSync(join(dir, f), "utf-8");
        const block = /^\/\*\*[\s\S]*?^ \*\//m.exec(text)?.[0] ?? "";
        const tag = TAG.exec(block);
        const graphNode =
          tag === null
            ? "undeclared"
            : tag[1] === "none"
              ? "none"
              : tag[1] === "schema"
                ? "schema"
                : "undeclared";

        const { decls: got, bindings, reExports } = readModule(join(dir, f), moduleRel, text);
        const stem = basename(f, ".ts");
        bindingsByModule.set(moduleRel, bindings);
        dirOfModule.set(moduleRel, declaredRel);
        const key = moduleKeyOf(moduleRel);
        const exported = exportsByModule.get(key) ?? new Map<string, string>();
        for (const d of got) exported.set(d.name, d.id);
        exportsByModule.set(key, exported);
        if (reExports.length > 0) {
          reExportsByModule.set(
            key,
            reExports.map((r) => ({ specifier: resolveSpecifier(moduleRel, r.specifier), names: r.names })),
          );
        }

        modules.push({
          module: moduleRel,
          instance,
          name: stem,
          graphNode,
          reason: tag?.[2]?.trim() || undefined,
          summary: firstProse(block),
          isTest: f.endsWith(".test.ts"),
          decls: got.map((d) => d.id),
        });
        decls.push(...got);
      }
    }
  }

  // FHIR logical models held by an IG's artefact index (bean `cat-tools-4xq6`).
  // Only for the checkout scope — the viewer's — since the corpus readers
  // (kg-audit, the glossary) judge `schemas` modules and an IG's artefacts are
  // not that. The index lists every artefact by `key`; a logical model is a
  // `StructureDefinition/<id>` whose materialised JSON says `kind: logical`.
  const unread: string[] = [];
  if (opts.scope === "checkout") {
    let indexDirs: string[] = [];
    try {
      indexDirs = checkoutDirectoriesForGraph(FHIR_ARTIFACT_INDEX, root);
    } catch {
      indexDirs = [];
    }
    for (const dir of [...indexDirs].sort()) {
      const indexFile = join(dir, "index.json");
      if (!existsSync(indexFile)) {
        unread.push(`${rel(dir)}: index.json absent (built at publish)`);
        continue;
      }
      let idx: { artifacts?: unknown[]; entries?: unknown[] };
      try {
        idx = JSON.parse(readFileSync(indexFile, "utf-8"));
      } catch (e) {
        unread.push(`${rel(dir)}: index.json unreadable — ${(e as Error).message.slice(0, 80)}`);
        continue;
      }
      const layerRoot = findInstanceRoot(dir) ?? dir;
      const instance = rel(layerRoot).split("/")[0] || rootName || basename(layerRoot);
      type Entry = { key?: unknown; materialization?: { localPath?: unknown } };
      for (const a of (idx.artifacts ?? idx.entries ?? []) as Entry[]) {
        if (typeof a.key !== "string" || !a.key.startsWith("StructureDefinition/")) continue;
        const local = a.materialization?.localPath;
        if (typeof local !== "string") continue;
        const abs = join(layerRoot, local);
        if (!existsSync(abs)) continue;
        const text = readFileSync(abs, "utf-8");
        const moduleRel = rel(abs);
        if (modules.some((m) => m.module === moduleRel)) continue;
        let doc: unknown;
        try {
          doc = JSON.parse(text);
        } catch {
          continue;
        }
        // A class, or a profile over one — an extension definition included,
        // which is a profile of Extension (bean `cat-tools-t6fz`).
        if (!isFhirStructureDefinition(doc)) continue;
        const read = readFhirLogicalModel(text, moduleRel);
        modules.push({
          module: moduleRel,
          instance,
          name: basename(local, ".json"),
          graphNode: "schema",
          ...(read.summary ? { summary: read.summary } : {}),
          isTest: false,
          decls: read.decls.map((d) => d.id),
        });
        decls.push(...read.decls);
        jsonRefs.push(...read.refs);
        jsonLocalEdges.push(...read.edges);
      }
    }
  }

  // Published vocabularies and metamodels (bean `cat-tools-xfd4`): the RDF
  // vocabularies this layer's package.json depends on (`@vocabulary/*`, owner
  // option A) and the OMG metamodels its `*-moddle` dependencies describe.
  // Read for the checkout scope only, like the IG's models: they are what the
  // corpus's own types point at, not modules of the corpus.
  const vocabularies: VocabularyRead[] = [];
  if (opts.scope === "checkout") {
    const pj = join(import.meta.dir, "..", "package.json");
    const layer = rel(join(import.meta.dir, "..")).split("/")[0] || rootName || "cat-harness-tools";
    const mentions = vocabularyMentions(decls);
    const rdf = readRdfVocabularies(pj, rel, layer, mentions);
    // A shape the corpus types by a class of such a vocabulary (`"@type":
    // z.literal("schema:DefinedTerm")`) names that class by IRI: an id-ref.
    const byCanonical = new Map(rdf.decls.filter((d) => d.canonical).map((d) => [d.canonical!, d.id]));
    for (const v of rdf.vocabularies.filter((x) => x.referencedOnly)) {
      for (const d of decls) {
        for (const f of d.fields) {
          for (const iri of classMentions(`${f.type} ${d.values.join(" ")}`, v.prefix, v.namespace)) {
            const to = byCanonical.get(iri);
            if (to) jsonLocalEdges.push({ from: d.id, to, via: f.name, kind: "id-ref", optional: f.optional, array: f.array });
          }
        }
      }
    }
    for (const read of [rdf, readModdleMetamodels(pj, rel, layer)]) {
      modules.push(...read.modules);
      decls.push(...read.decls);
      jsonRefs.push(...read.refs);
      jsonLocalEdges.push(...read.edges);
      vocabularies.push(...read.vocabularies);
      unread.push(...read.unread);
    }
  }

  // FHIR core types, from a layer's declared `fhir-core-definitions` graph
  // (bean `cat-tools-t6fz`). Only the core definitions a
  // reading REFERENCES are loaded, one level deep, from the release its model
  // states (`fhirVersion`): the bodies are the full package files, 12 MB, and a
  // reference to `Patient` needs Patient, not the whole specification. A
  // release that is unread, a body not materialised, or a model that states no
  // version is listed in `unread` — the type stays an external, linked name,
  // never a box guessed from another release.
  if (opts.scope === "checkout") {
    let coreDirs: string[] = [];
    try {
      coreDirs = checkoutDirectoriesForGraph(FHIR_CORE_DEFINITIONS, root);
    } catch {
      coreDirs = [];
    }
    const core = loadFhirCore(coreDirs, jsonRefs, new Set(decls.map((d) => d.canonical).filter((c): c is string => !!c)), rel, rootName);
    modules.push(...core.modules);
    decls.push(...core.decls);
    jsonLocalEdges.push(...core.edges);
    unread.push(...core.unread);
  }

  // Resolution, second pass — every module's exports are known by now, so a
  // forward reference resolves the same as a backward one. Doing it inline
  // above would make an edge's existence depend on directory order, which is
  // filesystem state rather than a property of the graph.
  const byId = new Map(decls.map((d) => [d.id, d]));
  const edges: SchemaEdge[] = [];
  /** Modules a JSON reader read: their edges are the resolver's, not the AST walk's. */
  const jsonModules = new Set(modules.filter((m) => /\.(json|nq)$/.test(m.module)).map((m) => m.module));

  /**
   * A bound name → the declaration it names, `"external"`, or `null`.
   *
   * Three outcomes rather than two, and the middle one is why: a name bound to
   * a non-relative import resolved correctly, to somewhere outside this graph.
   * Reporting it as a miss would bury the real misses under `z`.
   */
  /**
   * The declaration module `key` exports as `name`, following its re-exports
   * — so an import through an old-path shim reaches the module it forwards
   * to. `seen` stops a re-export cycle rather than recursing forever.
   */
  const exportedBy = (key: string, name: string, seen: Set<string> = new Set()): string | undefined => {
    if (seen.has(key)) return undefined;
    seen.add(key);
    const hit = exportsByModule.get(key)?.get(name);
    if (hit) return hit;
    for (const r of reExportsByModule.get(key) ?? []) {
      const original = r.names === null ? name : r.names.get(name);
      if (original === undefined) continue;
      const found = exportedBy(r.specifier, original, seen);
      if (found) return found;
    }
    return undefined;
  };

  const resolve = (moduleRel: string, name: string): string | "external" | null => {
    const bindings = bindingsByModule.get(moduleRel);
    if (!bindings || !bindings.has(name)) return null; // not bound here: not a reference
    const here = exportsByModule.get(moduleKeyOf(moduleRel))?.get(name);
    if (here) return here;
    const specifier = bindings.get(name);
    // Bound to a non-relative import, or to something in this module that is
    // not a declaration of the graph (a helper function, a const array of
    // literals). Both resolved; neither is a node.
    if (specifier === "" || specifier === null || specifier === undefined) return "external";
    const target = resolveSpecifier(moduleRel, specifier);
    // A relative import pointing OUT of `schemas/` is external too. Only a
    // module that is part of this graph and does not export the name is a
    // genuine miss — which is the narrow case worth reporting.
    if (!exportsByModule.has(target)) return "external";
    return exportedBy(target, name) ?? null;
  };

  /**
   * Declarations by NAME, for `@ref` resolution.
   *
   * An id-ref cannot go through `resolve`: that requires the name to be BOUND
   * in the module, and the whole point of a string id is that the target is
   * not imported. So it resolves by name across the graph — nearest first.
   */
  const byName = new Map<string, SchemaDecl[]>();
  for (const d of decls) {
    const list = byName.get(d.name);
    if (list) list.push(d);
    else byName.set(d.name, [d]);
  }

  /** Where an `@ref` went wrong, if it did. One entry per bad tag. */
  const refProblems: string[] = [];

  const considerIdRef = (d: SchemaDecl, f: SchemaField): void => {
    const name = f.ref as string;
    const candidates = byName.get(name);
    if (!candidates || candidates.length === 0) {
      // A tag naming nothing is a DEFECT, not a quiet no-op: the author
      // asserted an edge and the graph cannot honour it. Silence here would
      // make a typo indistinguishable from an undeclared field.
      refProblems.push(`${d.id}.${f.name}: @ref ${name} names no declaration`);
      return;
    }
    // Nearest wins: same module, then same directory, then graph-wide — but
    // ONLY when that narrowing leaves exactly one. Two equally-near targets is
    // an ambiguous tag, and picking the first is the `wggr` failure one level
    // down: an answer that looks resolved and may be the wrong schema.
    const dir = dirOfModule.get(d.module) ?? "";
    const tiers = [
      candidates.filter((c) => c.module === d.module),
      candidates.filter((c) => (dirOfModule.get(c.module) ?? "") === dir),
      candidates,
    ];
    const hit = tiers.find((t) => t.length === 1)?.[0];
    if (!hit) {
      refProblems.push(
        `${d.id}.${f.name}: @ref ${name} is ambiguous — ${candidates.length} declarations carry that name (${candidates
          .map((c) => c.module)
          .join(", ")})`,
      );
      return;
    }
    if (hit.id === d.id) return; // a self-reference is a property of the box
    edges.push({ from: d.id, to: hit.id, via: f.name, kind: "id-ref", optional: f.optional, array: f.array });
  };

  const jsonEdges = resolveClassModelRefs(jsonRefs, byId);
  const fromJson = [...jsonLocalEdges, ...jsonEdges.edges];
  edges.push(...fromJson);

  for (const d of decls) {
    if (jsonModules.has(d.module)) {
      d.refs = [...new Set(fromJson.filter((e) => e.from === d.id).map((e) => e.to))].sort();
      d.unresolved = [...new Set([...d.unresolved, ...(jsonEdges.unresolved.get(d.id) ?? [])])].sort();
      continue;
    }
    const refs = new Set<string>();
    const unresolved = new Set<string>();
    const external = new Set<string>();
    const bindings = bindingsByModule.get(d.module);
    const consider = (
      name: string,
      via: string,
      kind: SchemaEdge["kind"],
      optional: boolean,
      array: boolean,
    ): void => {
      // A self-reference — `z.lazy(() => Foo)` inside `Foo` — is a property of
      // the box, not an edge to another one. Drawing it would put a loop on
      // every recursive schema and say nothing.
      if (name === d.name) return;
      if (!bindings || !bindings.has(name)) return;
      const to = resolve(d.module, name);
      if (to === "external") {
        external.add(name);
        return;
      }
      if (to === null || !byId.has(to)) {
        unresolved.add(name);
        return;
      }
      refs.add(to);
      edges.push({ from: d.id, to, via, kind, optional, array });
    };
    for (const f of d.fields) {
      for (const n of f.names) consider(n, f.name, "field", f.optional, f.array);
      if (f.ref) considerIdRef(d, f);
    }
    for (const n of d.extendsNames) consider(n, "", "extends", false, false);
    d.refs = [...refs].sort();
    d.unresolved = [...unresolved].sort();
    d.external = [...external].sort();
  }

  // Sorted for the reason the todo and bean indices both document: the
  // projection built from this is committed, and an artefact reproducible only
  // where it was generated is a snapshot rather than a generated file.
  edges.sort(
    (a, b) =>
      a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.via.localeCompare(b.via),
  );
  decls.sort((a, b) => a.id.localeCompare(b.id));
  modules.sort((a, b) => a.module.localeCompare(b.module));

  refProblems.sort();

  return { roots: dirs.map(rel), modules, decls, edges, refProblems, unread, ...(vocabularies.length ? { vocabularies } : {}) };
}

if (import.meta.main) {
  const root = join(HARNESS_ROOT);
  const g = readSchemaGraph(root);
  if (g === null) {
    console.error("no schemas directory — nothing to read");
    process.exit(2);
  }
  const und = g.decls.filter((d) => d.kind === "undetermined");
  console.log(g.roots.map((r) => `${r}/`).join("  "));
  console.log(`  modules      ${g.modules.length}`);
  console.log(`  declarations ${g.decls.length}`);
  console.log(`  edges        ${g.edges.length}`);
  console.log(`  undetermined ${und.length}`);
  console.log(`  unresolved   ${new Set(g.decls.flatMap((d) => d.unresolved)).size} distinct name(s)`);
}
