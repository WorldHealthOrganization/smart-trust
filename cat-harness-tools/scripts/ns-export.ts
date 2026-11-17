/**
 * The folio namespace, as a document that dereferences.
 *
 * `FOLIO_NS` is `https://litlfred.github.io/folio-assistant/ns/` and every
 * class and property the graph projects hangs off it. This serves that stem,
 * so a consumer holding only the JSON-LD can resolve any term it meets; CI
 * also uses it to assert every minted term is defined.
 *
 * ## One node per term
 *
 * Each term gets an `@id`, a type, a label and a definition — which is what
 * makes `folio:Actor` resolvable rather than merely mentioned.
 *
 * ## Where each definition comes from
 *
 * Graph typologies are read from `BASE_GRAPH_TYPOLOGIES`, which already carries a
 * `summary` for each; they are not restated in `schemas/content/vocabulary.ts`.
 * Everything else is glossed in `vocabulary.ts`. A term
 * defined in both is an error, not a preference.
 *
 * Usage:  bun run cat-harness-tools/scripts/ns-export.ts [--out FILE] [--check]
 *
 * `--check` writes nothing and exits non-zero if any minted term has no
 * definition, naming each one.
 *
 * @module scripts/ns-export
 * @covers cat-harness
 *
 * @conformsTo dcmi-terms
 * @conformsTo w3c-owl2
 * @conformsTo w3c-rdf
 * @conformsTo w3c-rdfs
 * @conformsTo w3c-skos
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  contentLayerInstance,
  declaringInstanceOf,
  defaultGraphTypologies,
  graphTypologyLayer,
  isPublishedGraphTypology,
  ownPrefixTable,
  repoRootFor,
} from "../schemas/kg/cat-harness.js";
import "../schemas/kg/folio-graph-typology.js";
import {
  LEGACY_FOLIO_NS,
  namespaceForLayer,
  prefixForLayer,
  replacementIri,
  termIri,
} from "../schemas/kg/namespaces.js";
import { REGISTRY_GROUPS } from "../schemas/kg/kg-node.js";
import { gitFiles } from "../schemas/sdlc/git-corpus.ts";
import { siteDirFor } from "../schemas/kg/cat-harness.js";
import { publishedHref } from "./lib/jekyll-permalink.ts";
import { discoverBlockKinds } from "../schemas/content/block-kinds.js";
import { defaultInstancePrefixes } from "../schemas/content/content-context.js";
import { findDeclarationFile, layerRootsIn } from "../schemas/kg/instance-roots.js";
import { ownDeclaredDirectories } from "../schemas/kg/declared-nodes.js";
import {
  CLASS_GLOSSES,
  PROPERTY_GLOSSES,
  TERM_LAYERS,
  type TermGloss,
  type TermLayer,
} from "../schemas/content/vocabulary.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
// The layer that declares the `core` term layer's kinds — the content layer
// above the harness — read from where those kinds were declared, so this layer
// does not carry its name (folio-assistant#2598). `undefined` when none is
// composed, as when the tools stand alone.
const CONTENT = contentLayerInstance();
const CORE_INSTANCE: string | undefined = CONTENT?.prefix;
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const OWL = "http://www.w3.org/2002/07/owl#";
// DECLARED HERE RATHER THAN IMPORTED, and the duplicate is CHECKED.
//
// `schemas/kg/jsonld.ts` also declares these two, but it is `folio-assist-core`
// and this module is `agentic-harness` — core depends on the harness, so the
// import would be a wrong-direction edge and `check:partition` refuses it.
// That is the rule working: the constant a harness module needs must not be
// reached for across a boundary just because it happens to exist there.
//
// So they sit beside RDFS/RDF/OWL above, which are local for the same reason,
// and `ns-export-skos.test.ts` asserts each equals its `jsonld.ts` twin — a
// test may cross the boundary where source may not. An unavoidable duplicate
// is fine; an UNCHECKED one is the drift this repository keeps paying for.
const SKOS = "http://www.w3.org/2004/02/skos/core#";
const DCTERMS = "http://purl.org/dc/terms/";

/**
 * The `@id` of the all-layers build — which is no longer PUBLISHED (owner,
 * 2026-09-30, bean `xsqm`: *"Retire it"*). Every term is defined by its layer's
 * own namespace document, and a person looking for terms reads the Glossary,
 * which publishes SKOS for every scheme; a third copy of the same terms was
 * one more thing free to drift. The full build still runs — it is what
 * `ns:check` uses to prove every minted term is defined — it just is not
 * written to the site.
 */
export function vocabularyIri(): string {
  // `<base>/ns/vocabulary.jsonld`, NOT `<base>/ns`.
  //
  // `schemas/kg/jsonld.ts` publishes the content `@context` at
  // `<base>/ns/content/v1.jsonld`, so `<base>/ns` has to be a DIRECTORY. A
  // static host cannot serve a file and a directory at one path, and the
  // first version of this exporter wrote the union document straight to
  // `<base>/ns` — which would have made the content context unreachable the
  // day it deployed.
  //
  // Nothing is lost by moving: no term hangs off this document. Every term
  // lives in its layer's namespace (`bootstrap/ns`, `cat-harness/ns`,
  // the content core's `ns`), each of which IS a file and dereferences. The
  // union is a convenience for a person reading the whole vocabulary at once,
  // so it can sit anywhere that resolves.
  return `${LEGACY_FOLIO_NS.replace(/ns[#/]$/, "")}ns/vocabulary.jsonld`;
}

/** Find the platform or repository root holding sibling layers. */
export function findPlatformRoot(start: string = ROOT): string {
  let curr = resolve(start);
  while (curr !== dirname(curr)) {
    if (CORE_INSTANCE !== undefined && existsSync(join(curr, CORE_INSTANCE))) return curr;
    curr = dirname(curr);
  }
  return repoRootFor(start);
}

/** The namespace a layer or layer's terms hang off. */
export function namespaceForPrefixOrLayer(target: string): string {
  if (target === "bootstrap") return namespaceForLayer("bootstrap");
  if (target === "harness" || target === "cat-harness") return namespaceForLayer("harness");
  if (target === "core" || (CORE_INSTANCE !== undefined && target === CORE_INSTANCE)) {
    if (CONTENT === undefined) throw new Error("ns-export: no content layer is composed, so the core layer has no namespace here");
    return CONTENT.namespace;
  }
  const prefixes = defaultInstancePrefixes();
  const ns = prefixes.get(target);
  if (ns) return ns;
  return `${LEGACY_FOLIO_NS.replace(/ns[#/]$/, "")}${target}/ns/`;
}

/**
 * The concept scheme IRI for a layer or layer: the `skos:ConceptScheme` its
 * terms belong to, which is the layer's OWN namespace document, not a fourth
 * IRI invented to hold them.
 *
 * `--layer <l> --exact` already publishes exactly that layer's terms under
 * exactly that IRI, which is the definition of a concept scheme: a set of
 * concepts with a boundary somebody is willing to state. Minting a separate
 * `…#scheme` would be a second name for a set that already has one, and it
 * would not dereference — the defect `blv9` records and the whole reason this
 * module exists.
 *
 * So in `--exact` mode the document node IS the scheme and gains the type
 * rather than a duplicate `@id` appearing in its own `@graph`.
 */
export function conceptSchemeIriFor(target: string): string {
  return namespaceForPrefixOrLayer(target).replace(/#$/, "");
}

/** Layers that publish an ns document (have vocabulary terms or declare block-kinds). */
export function instancesPublishingNs(root = ROOT): string[] {
  const instances = new Set<string>();
  instances.add("cat-harness");
  const platform = findPlatformRoot(root);
  // input-site: env FOLIO_FIXTURE_CHECKOUT #eac4c68c — a fixture checkout whose layers join the platform's when the variable is set
  const fixture = process.env.FOLIO_FIXTURE_CHECKOUT;
  const roots = [...layerRootsIn(platform), ...(fixture ? layerRootsIn(fixture) : [])];
  for (const instRoot of roots) {
    if (ownDeclaredDirectories(instRoot, "block-kinds", platform).length > 0) {
      const declFile = findDeclarationFile(instRoot);
      if (declFile) {
        try {
          const decl = JSON.parse(readFileSync(join(instRoot, declFile), "utf-8")) as { name?: string; stub?: string };
          const prefix = decl.stub ?? decl.name;
          if (prefix) instances.add(prefix);
        } catch {
          // Ignore unreadable declaration here
        }
      }
    }
  }
  return [...instances].sort();
}

/**
 * Every term the CODE can mint, found by scanning rather than by listing.
 *
 * A list somebody has to remember to extend is not a single answer; it is a
 * copy that happens to match today — the lesson `known-skills.ts` records at
 * length. So this reads the source.
 *
 * **It is not complete on its own, and says so.** `kg-export.ts:712` mints
 * `` `${FOLIO_NS}${type}` `` from a registry group name, so `Actor` and
 * `Capability` appear in the exported graph and in NO literal anywhere. The
 * caller unions this with the terms a real export emits; neither source alone
 * is sound, and pretending either is would put a term on the "defined"
 * side of a check it never reached.
 */
export function mintedTermsFromSource(root = ROOT): Set<string> {
  const out = new Set<string>();
  // `termIri("Name")` is the ONE minting form since the namespaces split —
  // 94 hand-written template literals became this single call, which is also
  // what makes the scan a scan for one pattern rather than for four.
  const pat = /\bterm(?:Iri|Curie)\(\s*"([A-Za-z][A-Za-z0-9_]*)"\s*\)/g;
  // `xd1g`. Measured at the conversion: **936 before, 935 after** — the one it
  // drops is a gitignored `dist/index.d.ts`, and a generated declaration file
  // minting a term would be a term nobody wrote. Nothing gained.
  // Since bean `8lcl` the harness's code lives in cat-harness-tools, so the
  // harness's own minting sites are read there as well as here.
  const roots = root === ROOT ? [ROOT, resolve(TOOLS_ROOT)] : [root];
  for (const p of roots.flatMap((r) => gitFiles(r, (rel) =>
    rel.endsWith(".ts") && !rel.endsWith(".test.ts") && !rel.split("/").some((s) => s.startsWith(".")),
  ).files)) {
    // COMMENTS ARE STRIPPED FIRST, and this is not fussiness: the first
    // version scanned raw source and reported `Name` as an undefined term,
    // matched from THIS function's own comment describing the pattern it looks
    // for. A scanner that reads its own documentation as data will do it again
    // the next time somebody writes an example, and a phantom term in a
    // completeness check is worse than none — it is a finding nobody can act
    // on.
    const src = readFileSync(p, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const m of src.matchAll(pat)) out.add(m[1]!);
  }
  return out;
}

/**
 * The graph typologies the harness and core define, as the `GraphTypology` individuals
 * kg-export names them by — `<prefix>:graphTypology/<name>` — each glossed with
 * its own summary, read, never restated. bootstrap's kinds are not here: they
 * come verbatim from bootstrap's file, like its terms.
 *
 * Until 2026-09-30 each kind was ALSO a class (`SkillGraph`, `KGraph`, …),
 * stamped on a directory as its `@type` beside the individual it `holdsGraph`
 * — two ways to say one fact. Owner (bean `3r47`): "Drop per-kind classes".
 */
export function graphTypologyIndividuals(): Array<{ name: string; layer: TermLayer; prefix: string; gloss: string }> {
  return defaultGraphTypologies
    .names()
    .filter(isPublishedGraphTypology)
    .map((name) => ({ name, def: defaultGraphTypologies.get(name)! }))
    .filter(({ name, def }) => graphTypologyLayer(name, def) !== "bootstrap" && def.summary)
    .map(({ name, def }) => {
      const layer = graphTypologyLayer(name, def) as TermLayer;
      return { name, layer, prefix: typologyPrefix(name, layer, def), gloss: def.summary! };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The prefix a kind's individual is written with: its layer's, or — for a
 * `core` kind — the prefix of the layer that declared it, which is the one
 * whose namespace `graphTypologyIri` names it in.
 */
function typologyPrefix(name: string, layer: TermLayer, def: object): string {
  if (layer !== "core") return prefixForLayer(layer);
  const by = declaringInstanceOf(def);
  if (by === undefined) throw new Error(`ns-export: core kind "${name}" has no declaring instance`);
  return by.prefix;
}

export interface VocabularyReport {
  /** Terms with a definition, in document order. */
  readonly defined: string[];
  /** Minted in the source and defined nowhere — the finding `--check` fails on. */
  readonly undefinedTerms: string[];
  /** Defined here AND carrying a graph-typology summary: two answers to one question. */
  readonly doublyDefined: string[];
}

/** Assemble the vocabulary, and report what is missing rather than guessing. */
/** Where bootstrap's own vocabulary is, whether `root` is the index/workspace root or a layer root under it. */
export function bootstrapVocabularyPath(root = ROOT): string {
  const atRoot = join(root, "bootstrap", "ns.jsonld");
  if (existsSync(atRoot)) return atRoot;
  const inPlatform = join(findPlatformRoot(root), "bootstrap", "ns.jsonld");
  if (existsSync(inPlatform)) return inPlatform;
  return join(root, "..", "bootstrap", "ns.jsonld");
}

/** bootstrap's vocabulary as bootstrap-tools wrote it. Throws when it is not there. */
export function bootstrapVocabulary(root = ROOT): { "@graph": Record<string, unknown>[] } {
  const p = bootstrapVocabularyPath(root);
  if (!existsSync(p)) {
    throw new Error(`${p} is missing — bootstrap's vocabulary is written by bootstrap-tools (bun run bootstrap:vocabulary); it is not rebuilt here.`);
  }
  return JSON.parse(readFileSync(p, "utf-8")) as { "@graph": Record<string, unknown>[] };
}

export function buildVocabulary(
  root = ROOT,
  /**
   * Emit only this layer or layer and the ones BELOW it, or the whole vocabulary.
   *
   * "And below" rather than "only this": a harness consumer meets bootstrap's
   * terms constantly, so a harness slice that omitted them would document a
   * vocabulary nobody actually uses. Bootstrap's slice is the interesting one
   * and it is genuinely minimal — it is the bottom of the stack.
   */
  target?: TermLayer | string,
  /**
   * EXACTLY this layer or layer, rather than it and everything below.
   *
   * The two modes answer different questions and conflating them would publish
   * a lie. `--layer harness` is what a HARNESS CONSUMER wants: it meets
   * bootstrap's terms constantly, so the document includes them. A NAMESPACE
   * document is what `cat:Harness` dereferences to, and it must contain only
   * `cat:` terms — a `cat-harness/ns` that also defined `bs:Actor` would be
   * asserting ownership of a term in somebody else's namespace.
   */
  exact = false,
  /**
   * The block kinds to emit, discovered from the platform when omitted. A
   * parameter so a test can add a kind without `mock.module`, which bun cannot
   * undo and which would leak the fake kind into every later test file.
   */
  blockKindsIn?: ReturnType<typeof discoverBlockKinds>,
): { doc: unknown; report: VocabularyReport } {
  const kinds = graphTypologyIndividuals();
  // A kind is an individual under `graphTypology/`, so it cannot share a name
  // with a class or a property; kept in the report so its shape is stable.
  const doublyDefined: string[] = [];

  // The declared order, not a local one. `TERM_LAYERS` states that its order
  // IS the direction rule, which is exactly what these index comparisons read.
  const ORDER: readonly TermLayer[] = TERM_LAYERS;
  const isTargetLayer = target !== undefined && (ORDER as readonly string[]).includes(target);
  const targetLayer: TermLayer | undefined = isTargetLayer
    ? (target as TermLayer)
    : target === "cat-harness"
      ? "harness"
      : target !== undefined && target === CORE_INSTANCE
        ? "core"
        : undefined;

  const cutoff = targetLayer ? ORDER.indexOf(targetLayer) : ORDER.length - 1;
  const inSlice = (g: TermGloss): boolean => {
    if (target !== undefined && !targetLayer) return false;
    const l = g.layer ?? "harness";
    const i = ORDER.indexOf(l);
    return exact ? i === cutoff : i <= cutoff;
  };

  const nodes: Record<string, unknown>[] = [];
  const defined = new Set<string>();
  const emit = (name: string, kind: "class" | "property", g: TermGloss): void => {
    if (!inSlice(g)) return;
    // bootstrap's terms are NOT built here: they are read, verbatim, from the
    // vocabulary bootstrap-tools writes (below), so the union can never say
    // something about a bootstrap term that bootstrap's own file does not.
    if ((g.layer ?? "harness") === "bootstrap") return;
    defined.add(name);
    const l = g.layer ?? "harness";
    nodes.push({
      "@id": `${prefixForLayer(l)}:${name}`,
      // TWO types on purpose, and the tension is named rather than hidden.
      //
      // A term here is both a thing the graph has instances OF (`rdfs:Class`)
      // and a unit of meaning a reader looks UP (`skos:Concept`). That is
      // punning, sound in RDFS and OWL-Full and what published vocabularies do,
      // but NOT sound under an OWL-DL reasoner. Nothing here runs one; if
      // something ever does, this is the line to revisit — splitting the
      // concept onto its own node linked by `foaf:focus` is the usual repair.
      "@type": [kind === "class" ? "rdfs:Class" : "rdf:Property", "skos:Concept"],
      label: name,
      comment: g.gloss,
      // The SKOS half. `prefLabel`/`definition` restate `label`/`comment`
      // rather than replacing them, because a consumer arriving by either
      // vocabulary must find the term — and `skos:prefLabel` is a declared
      // sub-property of `rdfs:label`, so the two agreeing is the spec's own
      // expectation rather than a duplication this file invented.
      prefLabel: name,
      definition: g.gloss,
      // THE CODE the owner asked for, and it is not a new field to author:
      // the prefixed name IS the notation, unique across the vocabulary
      // because the prefix carries the layer. A `notation` somebody has to
      // type is a `notation` that goes missing; this one cannot.
      notation: `${prefixForLayer(l)}:${name}`,
      inScheme: conceptSchemeIriFor(l),
      // The term's OWN layer document — the one its IRI dereferences to. It
      // pointed at the all-layers union until 2026-09-30, a convenience copy
      // claiming to define terms that live elsewhere; the union is retired
      // (owner, bean `xsqm`), and a definition has one home per layer.
      isDefinedBy: conceptSchemeIriFor(l),
      layer: l,
      // `seeAlso` is authored as the page's SOURCE location; where Jekyll
      // publishes it differs for the docs-folder pages (bean `kc7k`).
      ...(g.seeAlso
        ? { seeAlso: new URL(publishedHref(join(ROOT, siteDirFor(ROOT)), g.seeAlso).replace(/^\//, ""), `${vocabularyIri().replace(/\/ns$/, "/")}`).href }
        : {}),
      // A term that restated a published standard: still defined, so data
      // carrying its IRI resolves, and saying which property replaced it
      // (owner, 2026-09-30, bean `xsqm`).
      ...(kind === "property" && replacementIri(name) !== undefined
        ? { deprecated: true, isReplacedBy: replacementIri(name) }
        : {}),
    });
  };

  for (const [name, g] of Object.entries(CLASS_GLOSSES)) emit(name, "class", g);
  for (const k of kinds) {
    if (!inSlice({ gloss: k.gloss, layer: k.layer })) continue;
    const id = `${k.prefix}:graphTypology/${k.name}`;
    nodes.push({
      "@id": id,
      "@type": ["bootstrap:GraphTypology", "skos:Concept"],
      label: k.name,
      comment: k.gloss,
      prefLabel: k.name,
      definition: k.gloss,
      notation: id,
      inScheme: conceptSchemeIriFor(k.layer),
      isDefinedBy: conceptSchemeIriFor(k.layer),
      layer: k.layer,
    });
  }
  for (const [name, g] of Object.entries(PROPERTY_GLOSSES)) emit(name, "property", g);

  // Block kind classes: each layer generates its own ns document for the block-kind
  // classes it mints (folio-assistant-2osx).
  const platform = findPlatformRoot(root);
  const blockKinds = blockKindsIn ?? discoverBlockKinds(platform);
  const publishingInstances = new Set(instancesPublishingNs(root));

  for (const bk of blockKinds) {
    const prefix = bk.folioType.split(":")[0];
    if (!prefix) continue;

    let inBlockSlice = false;
    if (target === undefined) {
      inBlockSlice = publishingInstances.has(prefix);
    } else if (target === prefix || (target === "core" && prefix === CORE_INSTANCE)) {
      inBlockSlice = true;
    } else if (!exact) {
      if ((targetLayer === "core" || target === "core") && prefix === CORE_INSTANCE) {
        inBlockSlice = true;
      }
    }

    if (!inBlockSlice) continue;

    const className = bk.folioType.split(":")[1] ?? bk.kind;
    const heading = (bk.heading !== undefined && bk.heading.trim().length > 0) ? bk.heading : undefined;
    const label = heading ?? className ?? bk.kind;
    const definition = (bk.rationale !== undefined && bk.rationale.trim().length > 0)
      ? bk.rationale
      : (heading ?? className ?? bk.kind);

    defined.add(className);
    defined.add(bk.folioType);

    const scheme = conceptSchemeIriFor(prefix);
    const bkLayer = prefix === CORE_INSTANCE ? "core" : prefix;

    nodes.push({
      "@id": bk.folioType,
      "@type": ["rdfs:Class", "skos:Concept"],
      label,
      comment: definition,
      prefLabel: label,
      definition,
      notation: bk.folioType,
      inScheme: scheme,
      isDefinedBy: scheme,
      layer: bkLayer,
    });
  }

  // bootstrap's layer: ONE source. Its vocabulary is `bootstrap/ns.jsonld`,
  // written by bootstrap-tools from bootstrap's own terms (owner, 2026-09-30,
  // bean `xsqm`), and every bootstrap node here is that file's node, copied —
  // the owner's question was how `<site>/ns/vocabulary.jsonld` cannot drift,
  // and a copy of the one file cannot say anything the file does not. An
  // absent file is refused rather than rebuilt from glosses: rebuilding is
  // the second source this replaces.
  if ((target === undefined || target === "bootstrap" || (targetLayer !== undefined && !exact)) && ORDER.indexOf("bootstrap") <= cutoff) {
    for (const n of bootstrapVocabulary(root)["@graph"]) {
      nodes.push({ ...n, layer: "bootstrap" });
      defined.add(String(n["@id"]).replace(/^bootstrap:/, ""));
    }
  }

  // The schemes, derived from what was ACTUALLY emitted rather than from the
  // three layers that exist. A scheme with no concepts is `dh4f` in miniature:
  // a consumer follows `inScheme`, finds an empty set, and reports a clean
  // run over nothing. `--layer bootstrap` legitimately emits one scheme.
  const docIri = exact && target ? conceptSchemeIriFor(target) : vocabularyIri();

  const conceptSchemes = [...new Set(nodes.map((n) => n.inScheme as string))].sort();

  const schemeNodes = conceptSchemes
    // In `--exact` mode the DOCUMENT is the scheme, so it gains the type below
    // instead of appearing a second time inside its own `@graph`.
    .filter((iri) => iri !== docIri)
    // bootstrap's scheme is described by bootstrap's own file, just below —
    // a title written here would be a second description of it.
    .filter((iri) => iri !== conceptSchemeIriFor("bootstrap"))
    .map((iri) => {
      let name = "vocabulary";
      for (const inst of instancesPublishingNs(root)) {
        if (conceptSchemeIriFor(inst) === iri) {
          name = inst;
          break;
        }
      }
      if (name === "cat-harness") name = "harness";
      if (name === CORE_INSTANCE) name = "core";
      return {
        "@id": iri,
        "@type": "skos:ConceptScheme",
        prefLabel: `folio-assistant ${name} vocabulary`,
        title: `folio-assistant ${name} vocabulary`,
        definition: `Every class and property the ${name} ${name === "harness" || name === "core" ? "layer" : "instance"} mints, one concept each.`,
      };
    });
  nodes.push(...schemeNodes);

  if (conceptSchemes.includes(conceptSchemeIriFor("bootstrap")) && conceptSchemeIriFor("bootstrap") !== docIri) {
    const b = bootstrapVocabulary(root) as Record<string, unknown>;
    nodes.push({ "@id": b["@id"], "@type": b["@type"], label: b["label"], prefLabel: b["label"], definition: b["definition"] });
  }

  // Only a FULL build can say a term is undefined. A bootstrap slice omits
  // core terms ON PURPOSE, and reporting those as missing would turn the
  // layering into a permanent wall of findings — the "check that cries wolf"
  // this repository switches off.
  const everything = new Set<string>([
    ...Object.keys(CLASS_GLOSSES),
    ...Object.keys(PROPERTY_GLOSSES),
  ]);
  const minted = new Set<string>([...mintedTermsFromSource(root), ...Object.values(REGISTRY_GROUPS)]);
  const undefinedSourceTerms = [...minted].filter((t) => !everything.has(t));

  const undefinedBlockKinds: string[] = [];
  for (const bk of blockKinds) {
    const prefix = bk.folioType.split(":")[0];
    if (!prefix || !publishingInstances.has(prefix)) {
      undefinedBlockKinds.push(bk.folioType);
    }
  }

  const undefinedTerms = target === undefined ? [...undefinedSourceTerms, ...undefinedBlockKinds].sort() : [];

  const extraPrefixes: Record<string, string> = {};
  for (const inst of instancesPublishingNs(root)) {
    extraPrefixes[inst] = namespaceForPrefixOrLayer(inst);
  }

  const doc = {
    "@context": {
      rdf: RDF,
      rdfs: RDFS,
      owl: OWL,
      skos: SKOS,
      dcterms: DCTERMS,
      ...ownPrefixTable(),
      ...extraPrefixes,
      label: "rdfs:label",
      comment: "rdfs:comment",
      isDefinedBy: { "@id": "rdfs:isDefinedBy", "@type": "@id" },
      seeAlso: { "@id": "rdfs:seeAlso", "@type": "@id" },
      prefLabel: "skos:prefLabel",
      definition: "skos:definition",
      notation: "skos:notation",
      title: "dcterms:title",
      inScheme: { "@id": "skos:inScheme", "@type": "@id" },
      // bootstrap's nodes carry what each term uses, as in bootstrap's file.
      requires: { "@id": "dcterms:requires", "@type": "@id" },
      deprecated: { "@id": "owl:deprecated", "@type": "http://www.w3.org/2001/XMLSchema#boolean" },
      isReplacedBy: { "@id": "dcterms:isReplacedBy", "@type": "@id" },
      // Declared, not left bare: a JSON-LD processor DROPS an undeclared key,
      // and this one was on all 159 terms (bean vigi, found by expanding).
      layer: termIri("layer"),
    },
    "@id": docIri,
    // In `--exact` mode this document IS the layer's concept scheme (see
    // `conceptSchemeIri`), so it carries both types rather than pointing at a
    // scheme node that would share its `@id`.
    "@type": exact && target ? ["owl:Ontology", "skos:ConceptScheme"] : "owl:Ontology",
    label: !target
      ? "folio-assistant vocabulary"
      : exact
        ? `folio-assistant vocabulary (${target} only)`
        : `folio-assistant vocabulary (${target} and below)`,
    comment:
      "Every class and property the folio knowledge graph projects, one node each. " +
      "Generated by scripts/ns-export.ts; graph-typology definitions are read from the " +
      "declaration registry rather than restated here.",
    "@graph": nodes,
  };

  return { doc, report: { defined: [...defined], undefinedTerms, doublyDefined } };
}

/**
 * Why `--layer <value>` was refused, or `undefined` when it is a layer.
 *
 * ONE READ OF `TERM_LAYERS` DECIDES BOTH the verdict and the sentence, which
 * is the whole point (#807). It was two literals — a predicate listing
 * `cat-bootstrap` and a message already saying `bootstrap` — so a refusal
 * printed the value it had just refused and read as an impossible state.
 *
 * Exported rather than left inline in the `import.meta.main` block because a
 * branch inside that block cannot be reached by a test at all: the only way to
 * exercise it was to spawn the script and read stderr, which is why nothing
 * did, and why the drift sat there through a rename.
 */
export function layerArgError(value: string): string | undefined {
  if ((TERM_LAYERS as readonly string[]).includes(value)) return undefined;
  // Composed from the same tuple the check used. An Oxford-less "a, b or c",
  // and still right if the tuple ever became one member.
  //
  // Phrased off `rest`, NOT off `TERM_LAYERS.length`: the tuple is `as const`,
  // so its length is the literal `3` and `=== 1` is a comparison tsc can prove
  // impossible — TS2367, which it duly raised. `slice` widens to an array, so
  // this asks the question without asserting a falsehood about today's tuple.
  const last = TERM_LAYERS[TERM_LAYERS.length - 1];
  const rest = TERM_LAYERS.slice(0, -1);
  const names = rest.length > 0 ? `${rest.join(", ")} or ${last}` : String(last);
  return `--layer must be ${names} (got ${value})`;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.includes("--list-instances") || argv.includes("--list")) {
    for (const inst of instancesPublishingNs(ROOT)) {
      console.log(inst);
    }
    process.exit(0);
  }

  const check = argv.includes("--check");

  const instanceIdx = argv.indexOf("--instance");
  const instance = instanceIdx >= 0 ? argv[instanceIdx + 1] : undefined;
  if (instance !== undefined) {
    const valid = instancesPublishingNs(ROOT);
    if (!valid.includes(instance)) {
      console.error(`--instance must be one of: ${valid.join(", ")} (got ${instance})`);
      process.exit(2);
    }
  }

  const layerIdx = argv.indexOf("--layer");
  const layer = layerIdx >= 0 ? (argv[layerIdx + 1] as TermLayer) : undefined;
  if (layer !== undefined) {
    const bad = layerArgError(String(layer));
    if (bad !== undefined) {
      console.error(bad);
      process.exit(2);
    }
  }

  const target = instance ?? layer;
  const exact = argv.includes("--exact");

  const outDirIdx = argv.indexOf("--out-dir");
  const outDir = outDirIdx >= 0 ? argv[outDirIdx + 1] : undefined;

  const outIdx = argv.indexOf("--out");
  // `repoRootFor`: `_kg/` is a repository build output, not a layer one.
  // Spelled `_kg/ns.jsonld` as ONE segment rather than `"_kg", "ns.jsonld"`,
  // which is why the grep that found the other four defaults missed this one —
  // a reminder that a scan for a path is a scan for a spelling.
  const out =
    outIdx >= 0
      ? argv[outIdx + 1]
      : outDir
        ? join(outDir, "ns.jsonld")
        // input-site: inert #b99db878 — an OUTPUT path this script writes, never reads
        : join(repoRootFor(ROOT), target ? `_kg/ns-${target}.jsonld` : "_kg/ns.jsonld");

  const { doc, report } = buildVocabulary(ROOT, target, exact);

  for (const t of report.doublyDefined) {
    console.error(`  DOUBLY DEFINED: ${t} — glossed in vocabulary.ts AND summarised in the graph-typology registry.`);
  }
  if (report.undefinedTerms.length > 0) {
    console.error(`\n${report.undefinedTerms.length} minted term(s) have no definition:`);
    for (const t of report.undefinedTerms) console.error(`  · ${t}`);
  }

  if (check) {
    const bad = report.undefinedTerms.length + report.doublyDefined.length;
    if (bad === 0) console.log(`ns vocabulary is complete — ${report.defined.length} term(s) defined`);
    process.exit(bad === 0 ? 0 : 1);
  }

  mkdirSync(dirname(out!), { recursive: true });
  writeFileSync(out!, `${JSON.stringify(doc, null, 2)}\n`);
  if (outDir) {
    // declared-path-literal: `ns` is an output FILE name here (the extensionless namespace document under the site's outDir), not the `ns/` directory.
    writeFileSync(join(outDir, "ns"), `${JSON.stringify(doc, null, 2)}\n`);
    writeFileSync(join(outDir, "ns.json"), `${JSON.stringify(doc, null, 2)}\n`);
  }
  console.log(`ns vocabulary → ${out}`);
  console.log(`  @id  ${(doc as { "@id": string })["@id"]}`);
  console.log(`  ${report.defined.length} term(s) defined, ${report.undefinedTerms.length} undefined`);
  if (!existsSync(out!)) process.exit(2);
}
