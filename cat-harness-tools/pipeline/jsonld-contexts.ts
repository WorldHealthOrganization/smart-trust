/**
 * Per-instance JSON-LD contexts, GENERATED from what documents use — the pure half.
 *
 * Bean `folio-assistant-63q4`, owner 2026-10-14: no "forward-declared" prefix
 * anywhere. Each layer declares the external namespaces it speaks
 * (`jsonldPrefixes`, cat-harness `schemas/kg/jsonld-prefixes.ts`), and its
 * published context binds ONLY the prefixes its documents actually use,
 * resolved through its table flattened with the tables of the layers it
 * `needs`. A bound-but-unused prefix cannot exist, so nothing needs excusing.
 *
 * Since the follow-up on the same bean it also DEFINES every content- and
 * subgraph-context TERM those documents use ({@link documentUses},
 * {@link buildInstanceContext} §Terms): prefixes alone cannot stand in for the
 * content context — a 60-document sample per layer lost 352–593 triples
 * when the prefix-only context was swapped in, and loses none with the terms.
 *
 * This module reads no files. `scripts/gen-instance-contexts.ts` walks the
 * checkout, reads each declaration as data, and calls these.
 *
 * ## What counts as "used", and why two answers are kept
 *
 * {@link usedPrefixes} walks EVERY string — object keys, values, and strings
 * inside arrays (`"@type": ["doco:Section"]`, which `check-context-emission`'s
 * walk never reached) — and skips every `@context` subtree, since a context
 * BINDING a prefix is not a document SPEAKING it. That is the set the
 * generated context is built from.
 *
 * It also records WHERE each prefix was met, because the two kinds of place
 * mean different things to a reader:
 *
 * - **iri** — a key, an `@type`/`@id` value, or the value of a term the
 *   document's contexts coerce to `@id`/`@vocab`. A processor EXPANDS these;
 *   an unbound prefix here becomes an IRI in a URI scheme called `<prefix>`
 *   (bean `zaqn`). An unresolved prefix in this position is a finding.
 * - **literal** — any other string value. `leanRef: "qou:QOU.Torsion.x"` and
 *   `label: "def:foo"` are authored strings that merely LOOK like CURIEs
 *   (the hazard `schemas/kg/jsonld.ts` opens with). A processor never expands
 *   them, so an unresolved prefix here is reported, never failed on: failing
 *   would condemn every Lean reference in the corpus, and a gate that cries
 *   wolf is switched off.
 *
 * A literal occurrence of a prefix the flattened table DOES bind still puts it
 * in the context — the owner's rule is "every string", and binding a declared
 * vocabulary a document names is never wrong. Only resolution is position-aware.
 *
 * @module pipeline/jsonld-contexts
 * @covers schemas
 */
import { mergePrefixTables, type DeclaredPrefixes, type PrefixConflict } from "../schemas/kg/jsonld-prefixes.js";

/** Where a prefix was met. See the module note. */
export type PrefixPosition = "iri" | "literal";

/**
 * URI schemes and pseudo-prefixes a string may start with that are never a
 * CURIE prefix. `JsonldPrefixSchema` refuses the same set as a declared prefix,
 * so the two cannot disagree; the rest are schemes seen in IRIs.
 */
export const NON_CURIE_SCHEMES: ReadonlySet<string> = new Set([
  "_",
  "http",
  "https",
  "urn",
  "mailto",
  "file",
  "data",
  "tag",
  "ftp",
  "doi",
  "isbn",
  "info",
  "ws",
  "wss",
]);

/**
 * The prefix of a CURIE, or `undefined` for anything that is not one: an
 * absolute IRI (`//` after the colon), a blank node, a keyword, a URI scheme,
 * a string with whitespace (prose that happens to contain a colon), or a
 * string with no colon.
 */
export function curiePrefix(s: string): string | undefined {
  if (s.startsWith("@") || s.startsWith("_:")) return undefined;
  const m = /^([A-Za-z_][A-Za-z0-9._-]*):(\S*)$/.exec(s);
  if (!m) return undefined;
  if (m[2]!.startsWith("//")) return undefined;
  if (NON_CURIE_SCHEMES.has(m[1]!.toLowerCase())) return undefined;
  return m[1];
}

/** A term definition, reduced to what this module reads. */
interface TermDef {
  /**
   * The remote context the term came from, by URL, with its definition as
   * written there — set only for REMOTE terms, since those are what an
   * instance context must carry when it stands in for that remote context.
   * An inline term is the document's own and needs nothing from anyone.
   */
  remote?: { context: string; definition: unknown };
  /** The prefix the term's IRI is written with, when it is a CURIE. */
  prefix?: string;
  /** The term coerces its values to IRIs (`@type: @id` or `@vocab`). */
  idValued: boolean;
  /** The term's value is a JSON LITERAL (`@type: @json`): its keys are data, not properties. */
  json: boolean;
}

/** The result of {@link usedPrefixes}: every prefix met, with the positions it was met in. */
export type UsedPrefixes = Map<string, Set<PrefixPosition>>;

/**
 * A remote-context TERM a document uses — as a property key, or as an `@type`
 * value — with the context it came from and its definition there, verbatim.
 */
export interface UsedTerm {
  /** The remote context's URL. */
  context: string;
  /** The term's definition in that context, as written (a string or an object). */
  definition: unknown;
}

/** The terms of {@link documentUses}: term → where it was defined. */
export type UsedTerms = Map<string, UsedTerm>;

export interface UsedPrefixesOptions {
  /**
   * Remote contexts this walk can read, by URL. A document naming one gets its
   * TERMS as aliases: `title` under the content context is `dcterms:title`,
   * so a node carrying `title` speaks `dcterms` with no `dcterms:` in the file.
   * The writer passes `CONTENT_CONTEXT` under `CONTENT_CONTEXT_URL`.
   */
  remoteContexts?: ReadonlyMap<string, Record<string, unknown>>;
  /**
   * Namespace IRI → prefix, for REMOTE-context term definitions written as
   * FULL IRIs (`alternateOf` → `http://www.w3.org/ns/prov#alternateOf`). Such
   * a term speaks the prefix whose namespace its IRI starts with. Inline
   * full-IRI terms never count (see `addContext`). The writer passes
   * the layer's flattened table, inverted; without it only CURIE-valued
   * terms count as aliases.
   */
  namespacePrefixes?: ReadonlyMap<string, string>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** The prefix whose namespace a full IRI sits in — the longest match, so a nested namespace wins. */
function namespacePrefixOf(iri: string, namespaces: ReadonlyMap<string, string>): string | undefined {
  let best: string | undefined;
  let len = 0;
  for (const [ns, prefix] of namespaces) {
    if (iri.length > ns.length && iri.startsWith(ns) && ns.length > len) {
      best = prefix;
      len = ns.length;
    }
  }
  return best;
}

/** Fold a `@context` value's term definitions into `terms` (a copy the caller owns). */
function addContext(
  c: unknown,
  terms: Map<string, TermDef>,
  remote: ReadonlyMap<string, Record<string, unknown>>,
  namespaces: ReadonlyMap<string, string>,
  fromRemote?: string,
): void {
  if (Array.isArray(c)) return void c.forEach((x) => addContext(x, terms, remote, namespaces, fromRemote));
  if (typeof c === "string") {
    const r = remote.get(c);
    if (r !== undefined) addContext(r, terms, remote, namespaces, c);
    return;
  }
  if (!isRecord(c)) return;
  for (const [k, v] of Object.entries(c)) {
    if (k.startsWith("@")) continue;
    const id = typeof v === "string" ? v : isRecord(v) && typeof v["@id"] === "string" ? v["@id"] : undefined;
    const type = isRecord(v) ? v["@type"] : undefined;
    // A full-IRI term counts its namespace's prefix only when it comes from a
    // REMOTE context: an inline full-IRI term (a SMART IG's `generatedAt` →
    // `prov#generatedAtTime`) is complete as written and needs no prefix bound
    // anywhere, so counting it would put `prov` in a context nobody needs it in.
    const prefix = id === undefined ? undefined : (curiePrefix(id) ?? (fromRemote !== undefined ? namespacePrefixOf(id, namespaces) : undefined));
    terms.set(k, {
      ...(prefix !== undefined ? { prefix } : {}),
      ...(fromRemote !== undefined ? { remote: { context: fromRemote, definition: v } } : {}),
      idValued: type === "@id" || type === "@vocab",
      json: type === "@json",
    });
  }
}

/**
 * Every prefix a document uses, with where. See the module note for what is
 * walked, what is skipped, and what the two positions mean.
 */
export function usedPrefixes(doc: unknown, options: UsedPrefixesOptions = {}): UsedPrefixes {
  return documentUses(doc, options).prefixes;
}

/**
 * Every prefix a document uses ({@link usedPrefixes}) AND every remote-context
 * term it uses: a property key, or an `@type` value, that resolves to a term
 * of a remote context in `options.remoteContexts`. A term an inline context
 * redefines is the document's own, and is not counted.
 *
 * The terms are what an instance context must DEFINE when it stands in for
 * the remote context: binding `cito` alone does not make `cites` mean
 * `cito:cites` as an `@id`-typed set.
 */
export function documentUses(doc: unknown, options: UsedPrefixesOptions = {}): { prefixes: UsedPrefixes; terms: UsedTerms } {
  const remote = options.remoteContexts ?? new Map<string, Record<string, unknown>>();
  const namespaces = options.namespacePrefixes ?? new Map<string, string>();
  const out: UsedPrefixes = new Map();
  const termsUsed: UsedTerms = new Map();
  const note = (p: string | undefined, pos: PrefixPosition): void => {
    if (p === undefined) return;
    const s = out.get(p) ?? new Set<PrefixPosition>();
    s.add(pos);
    out.set(p, s);
  };
  /** A string in a position: a CURIE, or a term whose definition is one. */
  const str = (s: string, pos: PrefixPosition, terms: ReadonlyMap<string, TermDef>, aliasable: boolean): void => {
    const p = curiePrefix(s);
    if (p !== undefined) return note(p, pos);
    if (!aliasable) return;
    const def = terms.get(s);
    note(def?.prefix, pos);
    if (def?.remote !== undefined && !termsUsed.has(s)) termsUsed.set(s, { context: def.remote.context, definition: def.remote.definition });
  };

  /** Inside a `@json` literal: every key and value is data, so every string is a literal. */
  const literal = (o: unknown): void => {
    if (typeof o === "string") return note(curiePrefix(o), "literal");
    if (Array.isArray(o)) return void o.forEach(literal);
    if (!isRecord(o)) return;
    for (const [k, v] of Object.entries(o)) {
      note(curiePrefix(k), "literal");
      literal(v);
    }
  };

  const walk = (o: unknown, terms: Map<string, TermDef>, valuePos: PrefixPosition): void => {
    if (typeof o === "string") return str(o, valuePos, terms, false);
    if (Array.isArray(o)) return void o.forEach((x) => walk(x, terms, valuePos));
    if (!isRecord(o)) return;
    let scope = terms;
    if ("@context" in o) {
      scope = new Map(terms);
      addContext(o["@context"], scope, remote, namespaces);
    }
    for (const [k, v] of Object.entries(o)) {
      if (k === "@context") continue; // a binding, not a use
      // The KEY: a CURIE, or a term whose IRI is one (an alias).
      if (!k.startsWith("@")) str(k, "iri", scope, true);
      if (k === "@type" || k === "type") {
        // A type value may itself be a term (`"@type": "Section"` with `Section`
        // aliased), so it is aliasable as well as a CURIE.
        for (const t of Array.isArray(v) ? v : [v]) {
          if (typeof t === "string") str(t, "iri", scope, true);
          else walk(t, scope, "literal");
        }
        continue;
      }
      if (k === "@id" || k === "@vocab") {
        walk(v, scope, "iri");
        continue;
      }
      const def = scope.get(k);
      if (def?.json) literal(v);
      else walk(v, scope, def?.idValued ? "iri" : "literal");
    }
  };

  walk(doc, new Map(), "literal");
  return { prefixes: out, terms: termsUsed };
}

/**
 * The prefixes a document binds ITSELF — in an inline `@context` object
 * anywhere in it, or in a remote context it names that the caller can read
 * (`options.remoteContexts`). A prefix bound here needs nothing from the
 * instance context: a SMART IG's local `fhir` binding is its own.
 *
 * A term counts as a binding when its value is an absolute IRI ending in `/`
 * or `#` — what makes `term:local` expand — which is exactly a prefix.
 */
export function ownBindings(doc: unknown, options: UsedPrefixesOptions = {}): Map<string, string> {
  const remote = options.remoteContexts ?? new Map<string, Record<string, unknown>>();
  const out = new Map<string, string>();
  const fromContext = (c: unknown): void => {
    if (Array.isArray(c)) return void c.forEach(fromContext);
    if (typeof c === "string") {
      const r = remote.get(c);
      if (r !== undefined) fromContext(r);
      return;
    }
    if (!isRecord(c)) return;
    for (const [k, v] of Object.entries(c)) {
      if (k.startsWith("@")) continue;
      const id = typeof v === "string" ? v : isRecord(v) && typeof v["@id"] === "string" ? v["@id"] : undefined;
      if (id !== undefined && /^[A-Za-z][\w+.-]*:/.test(id) && curiePrefix(id) === undefined && /[/#]$/.test(id)) out.set(k, id);
    }
  };
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) return void o.forEach(walk);
    if (!isRecord(o)) return;
    for (const [k, v] of Object.entries(o)) {
      if (k === "@context") fromContext(v);
      else walk(v);
    }
  };
  walk(doc);
  return out;
}

/** A JSON-LD document that is only a context — what `ns/<what>/v1.jsonld` holds. Never a corpus document. */
export function isContextDocument(doc: unknown): boolean {
  return isRecord(doc) && "@context" in doc && Object.keys(doc).every((k) => k === "@context");
}

/** One prefix use the instance context cannot resolve. */
export interface UnresolvedPrefix {
  prefix: string;
  /** Positions it was met in; only `iri` ones are a finding (see the module note). */
  positions: PrefixPosition[];
  /** Documents (as the caller names them) it was met in, sorted; the first is the example. */
  documents: string[];
}

/**
 * A remote context an instance context may stand in for, and the layer
 * that owns it. Its terms are available to a layer only when the owner is
 * in that layer's flattened `needs` — the same rule its prefixes follow.
 */
export interface TermSource {
  /** The layer that publishes the context (`cat-harness` for the content and subgraph contexts). */
  instance: string;
  /** The context object itself (the value of its `@context`): read for its own prefix bindings. */
  context: Record<string, unknown>;
}

export interface InstanceContextInput {
  /** The layer this context is for. */
  instance: string;
  /**
   * Its declared table, then its dependencies', in DEPENDENCY ORDER — `needs`
   * first, the layer itself LAST, which is the order `mergePrefixTables`
   * takes.
   */
  tables: readonly DeclaredPrefixes[];
  /**
   * Every prefix the layer's documents use, per document: the prefix map
   * from {@link usedPrefixes} and the bindings from {@link ownBindings}, and
   * the remote-context terms from {@link documentUses}.
   */
  documents: ReadonlyMap<string, { used: UsedPrefixes; own: ReadonlyMap<string, string>; terms?: UsedTerms }>;
  /**
   * The remote contexts whose TERMS this instance context carries — the ones
   * it stands in for — by URL. A term from a context not listed here (a
   * third-party context the document goes on naming) is neither copied nor
   * reported; one from a listed context owned by a layer outside the
   * flattened `needs` is reported in {@link InstanceContext.unresolvedTerms}.
   */
  termSources?: ReadonlyMap<string, TermSource>;
}

/** A remote-context term two places define differently, left OUT of the context. */
export interface TermConflict {
  term: string;
  /** Each distinct definition, with the context it came from and the documents that used it. */
  definitions: { context: string; definition: unknown; documents: string[] }[];
  /** Why it conflicts: two definitions, or a name a bound prefix already holds. */
  reason: string;
}

/** A remote-context term the instance context cannot carry faithfully. */
export interface UnresolvedTerm {
  term: string;
  context: string;
  reason: string;
  documents: string[];
}

export interface InstanceContext {
  /**
   * The `@context` object to publish: `@version`, `@protected`, the used,
   * resolved, unconflicted prefixes, then the used remote-context terms.
   */
  context: Record<string, unknown>;
  /** Each prefix in {@link context}, with how many documents use it (directly, or through a term defined with it). */
  bound: { prefix: string; iri: string; documents: number }[];
  /** Each remote-context term in {@link context}, with where it is defined and how many documents use it. */
  terms: { term: string; context: string; documents: number }[];
  /** Used in an IRI position and bound by neither the flattened table nor the document itself — a FINDING. */
  unresolved: UnresolvedPrefix[];
  /** Met only as a literal string and not bound — reported, never failed on. */
  literalOnly: UnresolvedPrefix[];
  /** Prefixes two layers in the flattened table bind differently — a FINDING; never resolved by order. */
  conflicts: PrefixConflict[];
  /** Terms defined two ways, or colliding with a prefix — a FINDING; never resolved by order. */
  termConflicts: TermConflict[];
  /** Terms whose context is not available here, or whose prefixes do not resolve to what the context meant — a FINDING. */
  unresolvedTerms: UnresolvedTerm[];
}

/**
 * Every CURIE prefix a term definition needs bound to expand — in `@id`,
 * `@type`, `@reverse`, and the terms of a scoped `@context` — or `[]` for a
 * definition written in full IRIs.
 */
export function definitionPrefixes(definition: unknown): string[] {
  const out = new Set<string>();
  const visit = (v: unknown): void => {
    if (typeof v === "string") {
      const p = curiePrefix(v);
      if (p !== undefined) out.add(p);
      return;
    }
    if (Array.isArray(v)) return void v.forEach(visit);
    if (!isRecord(v)) return;
    for (const [k, x] of Object.entries(v)) {
      if (k === "@container" || k === "@language" || k === "@direction" || k === "@nest" || k === "@prefix" || k === "@protected" || k === "@version") continue;
      if (k === "@context") {
        // A scoped context: its terms' definitions, not its keys.
        if (isRecord(x)) for (const [tk, tv] of Object.entries(x)) if (!tk.startsWith("@")) visit(tv);
        continue;
      }
      visit(x);
    }
  };
  visit(definition);
  return [...out].sort();
}

/**
 * A definition with every CURIE its source context can expand written as the
 * full IRI, for COMPARISON only. Two contexts that spell one IRI differently
 * (`dcterms:title` in the content context, `http://purl.org/dc/terms/title` in
 * the generated subgraph context) define the term the SAME way; comparing the
 * text called that a conflict and failed `derive:publish`. A CURIE the context
 * does not bind is left as written, so it still compares unequal to an IRI.
 */
function expandedForComparison(definition: unknown, context: Record<string, unknown> | undefined): unknown {
  if (context === undefined) return definition;
  const expand = (s: string): string => {
    const p = curiePrefix(s);
    if (p === undefined) return s;
    const iri = contextBinding(context, p);
    return iri === undefined ? s : iri + s.slice(p.length + 1);
  };
  const visit = (v: unknown, key?: string): unknown => {
    if (typeof v === "string") return key === undefined || key === "@id" || key === "@type" || key === "@reverse" ? expand(v) : v;
    if (Array.isArray(v)) return v.map((x) => visit(x, key));
    if (!isRecord(v)) return v;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      if (k === "@context" && isRecord(x)) {
        const scoped: Record<string, unknown> = {};
        for (const [tk, tv] of Object.entries(x)) scoped[tk] = tk.startsWith("@") ? tv : visit(tv);
        out[k] = scoped;
      } else out[k] = k.startsWith("@") ? visit(x, k) : x;
    }
    return out;
  };
  return visit(definition);
}

/** Stable JSON for comparing two definitions: key order does not make them different. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (isRecord(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

/** A prefix binding written in a context: a string IRI ending `/` or `#`, or `{ "@id", "@prefix": true }`. */
function contextBinding(context: Record<string, unknown>, prefix: string): string | undefined {
  const v = context[prefix];
  if (typeof v === "string") return v;
  if (isRecord(v) && typeof v["@id"] === "string") return v["@id"];
  return undefined;
}

/**
 * Build one layer's context from its flattened table and its documents' uses.
 *
 * Nothing is silently dropped or overridden: a used prefix is either bound
 * (resolved through the table, unconflicted), or the document binds it itself,
 * or it is reported in {@link InstanceContext.unresolved} /
 * {@link InstanceContext.literalOnly}; a conflicting prefix is left OUT of the
 * context and reported in `conflicts`, since `@protected` terms are exactly
 * what a higher layer must not quietly redefine.
 *
 * ## Terms
 *
 * A document naming a remote context (`ns/content/v1.jsonld`) uses its TERMS —
 * `title`, `cites`, `meta` — with no prefix in sight. Binding the prefixes
 * those terms expand through is not enough to stand in for that context: the
 * term itself, with its `@type: @id`, `@container` and `@json`, is what a
 * processor reads. So each remote term a document uses is copied into the
 * instance context VERBATIM, under the same rules as a prefix:
 *
 * - only from a context it stands in for (`termSources`) — a third-party
 *   context the document keeps naming carries its own terms — and only when
 *   that context's owning layer is in the flattened `needs`; otherwise the
 *   term is {@link InstanceContext.unresolvedTerms};
 * - only terms the layer's OWN documents use — nothing a later layer uses;
 * - every prefix the definition is written with is bound too, resolved
 *   through the flattened table, and must resolve to the SAME IRI the source
 *   context binds it to — otherwise the copied term would expand differently,
 *   which is a silent change of meaning and is reported instead;
 * - a term two contexts define differently, or a term whose name a bound
 *   prefix holds, is left OUT and reported in `termConflicts`.
 */
export function buildInstanceContext(input: InstanceContextInput): InstanceContext {
  const { prefixes: table, conflicts } = mergePrefixTables(input.tables);
  const conflicted = new Set(conflicts.map((c) => c.prefix));
  const available = new Set(input.tables.map((t) => t.instance));
  const sources = input.termSources ?? new Map<string, TermSource>();

  const users = new Map<string, Set<string>>();
  const use = (prefix: string, where: string): void => {
    const s = users.get(prefix) ?? new Set<string>();
    s.add(where);
    users.set(prefix, s);
  };
  const missing = new Map<string, { positions: Set<PrefixPosition>; documents: Set<string> }>();
  /** term → canonical definition → { context, definition, documents } */
  const termUses = new Map<string, Map<string, { context: string; definition: unknown; documents: Set<string> }>>();
  for (const [where, { used, own, terms }] of input.documents) {
    for (const [prefix, positions] of used) {
      if (prefix in table) {
        use(prefix, where);
        continue;
      }
      if (own.has(prefix)) continue;
      const m = missing.get(prefix) ?? { positions: new Set<PrefixPosition>(), documents: new Set<string>() };
      for (const p of positions) m.positions.add(p);
      m.documents.add(where);
      missing.set(prefix, m);
    }
    for (const [term, t] of terms ?? []) {
      const byDef = termUses.get(term) ?? new Map();
      const key = canonical(expandedForComparison(t.definition, sources.get(t.context)?.context));
      const slot = byDef.get(key) ?? { context: t.context, definition: t.definition, documents: new Set<string>() };
      slot.documents.add(where);
      byDef.set(key, slot);
      termUses.set(term, byDef);
    }
  }

  const termConflicts: TermConflict[] = [];
  const unresolvedTerms: UnresolvedTerm[] = [];
  const keptTerms: { term: string; context: string; definition: unknown; documents: Set<string> }[] = [];
  for (const [term, byDef] of termUses) {
    const defs = [...byDef.values()];
    const docs = (): string[] => [...new Set(defs.flatMap((d) => [...d.documents]))].sort();
    if (defs.length > 1) {
      termConflicts.push({
        term,
        definitions: defs.map((d) => ({ context: d.context, definition: d.definition, documents: [...d.documents].sort() })),
        reason: "defined differently by the contexts its documents name",
      });
      continue;
    }
    const d = defs[0]!;
    const source = sources.get(d.context);
    // A term from a context this one does NOT stand in for (a third-party
    // context such as PROV-JSONLD, which the document keeps naming) is that
    // context's business: nothing to carry, nothing to report.
    if (source === undefined) continue;
    if (!available.has(source.instance)) {
      unresolvedTerms.push({ term, context: d.context, reason: `its context belongs to \`${source.instance}\`, which ${input.instance} does not need`, documents: docs() });
      continue;
    }
    let ok = true;
    for (const p of definitionPrefixes(d.definition)) {
      const meant = contextBinding(source.context, p);
      if (conflicted.has(p)) {
        unresolvedTerms.push({ term, context: d.context, reason: `its prefix \`${p}\` is bound differently by two instances in the flattened table`, documents: docs() });
        ok = false;
      } else if (!(p in table)) {
        unresolvedTerms.push({ term, context: d.context, reason: `its prefix \`${p}\` is bound by no instance in the flattened table`, documents: docs() });
        ok = false;
      } else if (meant !== undefined && meant !== table[p]) {
        unresolvedTerms.push({ term, context: d.context, reason: `its prefix \`${p}\` means ${meant} in its context but ${table[p]} in the flattened table`, documents: docs() });
        ok = false;
      }
    }
    if (!ok) continue;
    for (const p of definitionPrefixes(d.definition)) for (const w of d.documents) use(p, w);
    keptTerms.push({ term, context: d.context, definition: d.definition, documents: d.documents });
  }

  // A term whose name is also a BOUND prefix: one key, two meanings. Left out,
  // reported — never resolved by which was written last.
  for (let i = keptTerms.length - 1; i >= 0; i--) {
    const t = keptTerms[i]!;
    if (!users.has(t.term) || conflicted.has(t.term)) continue;
    termConflicts.push({
      term: t.term,
      definitions: [{ context: t.context, definition: t.definition, documents: [...t.documents].sort() }],
      reason: `\`${t.term}\` is also a prefix this context binds (${table[t.term]})`,
    });
    keptTerms.splice(i, 1);
  }

  const bound = [...users]
    .filter(([p]) => !conflicted.has(p))
    .map(([prefix, documents]) => ({ prefix, iri: table[prefix]!, documents: documents.size }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
  const context: Record<string, unknown> = { "@version": 1.1, "@protected": true };
  for (const b of bound) context[b.prefix] = b.iri;
  keptTerms.sort((a, b) => a.term.localeCompare(b.term));
  for (const t of keptTerms) context[t.term] = structuredClone(t.definition);

  const toList = (want: (pos: Set<PrefixPosition>) => boolean): UnresolvedPrefix[] =>
    [...missing]
      .filter(([, m]) => want(m.positions))
      .map(([prefix, m]) => ({ prefix, positions: [...m.positions].sort(), documents: [...m.documents].sort() }))
      .sort((a, b) => b.documents.length - a.documents.length || a.prefix.localeCompare(b.prefix));

  return {
    context,
    bound,
    terms: keptTerms.map((t) => ({ term: t.term, context: t.context, documents: t.documents.size })),
    unresolved: toList((pos) => pos.has("iri")),
    literalOnly: toList((pos) => !pos.has("iri")),
    conflicts,
    termConflicts: termConflicts.sort((a, b) => a.term.localeCompare(b.term)),
    unresolvedTerms: unresolvedTerms.sort((a, b) => a.term.localeCompare(b.term) || a.reason.localeCompare(b.reason)),
  };
}
