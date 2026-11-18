#!/usr/bin/env bun
/**
 * Reconcile the specifications this repository depends on against what it
 * actually uses — and MATERIALIZE the operative vocabulary into the graph.
 *
 * The SPECIFICATION is referenced, by edition. The TERMS WE BRANCH ON are
 * derived from the corpus by this tool and written into the record — never
 * hand-listed, so they cannot drift from what the code does.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/external-schemas.ts            # report
 *   bun run cat-harness-tools/scripts/external-schemas.ts --write    # refresh terms
 *   bun run cat-harness-tools/scripts/external-schemas.ts --check    # CI
 *
 * @module scripts/external-schemas
 * @covers external-schema
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  EXTERNAL_SCHEMA_TAG,
  ExternalSchemaSchema,
  undeclaredNamespaces,
  unusedNamespaces,
  type ExternalSchema,
} from "../schemas/kg/external-schema.js";

import { isOwnExtensionNamespace, OWN_BPMN_EXTENSION_NAMESPACES, OWN_XML_NAMESPACES, WORKFLOWS_NS } from "../schemas/kg/namespaces.js";
import { ownNamespaceValues } from "../schemas/kg/graph-typology-registry.js";
import { portableSegment } from "../schemas/kg/portable-path.ts";
import { directoriesForGraph, instanceDirectoriesForGraph } from "../schemas/kg/cat-harness.js";
import { layerRootsIn } from "../schemas/kg/instance-roots.js";
import { workflowFiles } from "./known-skills.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { rootProfile } from "./lib/root-gate-set.ts";

const ROOT = resolve(HARNESS_ROOT);
// Read from the DECLARATION rather than hardcoded, and the reason this
// changed on 2026-09-22 is worth keeping: the literal was invisible to
// `check:declared-paths` for as long as nothing declared the directory. The
// moment `external-schemas/` was declared in `cat-harness.json`, the same
// unchanged line became counted debt — which is the check doing exactly its
// job, and is why a held-but-undeclared directory is worse than it looks.
//
// declared-path-literal: the convention fallback, at the call site so the
// choice is visible. A layer that declares no registry gets the
// conventional path and `loadSpecs` reports the empty result as the third
// state rather than as a pass.
const REGISTRY: string = (() => {
  const declared = directoriesForGraph(ROOT, "external-schema");
  return declared.length > 0 ? declared[0]! : join(ROOT, "external-schemas");
})();

/** Every declared record, parsed — a malformed one fails here, not at use. */
export function loadSpecs(dir = REGISTRY): ExternalSchema[] {
  if (!existsSync(dir)) return [];
  const out: ExternalSchema[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    const raw = JSON.parse(readFileSync(join(dir, f), "utf-8")) as { $schema?: unknown };
    // THE FILE DECLARES WHAT IT IS, and the directory is only a place to
    // look — `directory-conventions`: "Extension is a coincidence; a
    // declaration inside the file is the contract." This globbed `*.json`
    // and parsed every one as an external-schema record until 2026-09-30,
    // so the directory could never hold anything else: pinning
    // `who-smart-base` and snapshotting its terminology beside the record
    // broke the gate on a file that never claimed to be one (bean `7wou`).
    //
    // A DIFFERENT declared kind is skipped. Everything else is still parsed
    // STRICTLY — a record with no `$schema`, or one that says it is an
    // external schema and is malformed, must still fail here rather than be
    // filed as "not my kind", which would turn a broken record into a silent
    // absence.
    if (typeof raw.$schema === "string" && raw.$schema !== EXTERNAL_SCHEMA_TAG) continue;
    out.push(ExternalSchemaSchema.parse(raw));
  }
  return out;
}

/** XML namespaces the corpus declares, read from the files that declare them. */
export function namespacesInUse(root = ROOT): string[] {
  const out: string[] = [];
  // The DECLARED workflow graph, recursively (the DMN tables sit in
  // `processes/decisions/`), not a literal `processes/`: a sub-graph's diagrams
  // (cat-harness#1032: `library/processes/`) are this instance's too.
  for (const f of workflowFiles(root, "instance")) {
    const src = readFileSync(f, "utf-8");
    for (const m of src.matchAll(/xmlns(?::[a-zA-Z0-9]+)?="([^"]+)"/g)) out.push(m[1]!);
  }
  return [...new Set(out)].sort();
}

/**
 * Each `targetNamespace` the corpus declares, with the diagrams declaring it.
 *
 * Bean `rtrg`. A separate question from {@link namespacesInUse}, which reads
 * `xmlns` BINDINGS: `targetNamespace` is the namespace a diagram's own
 * processes are IN, so it decides what a `calledElement` QName resolves to. A
 * diagram with none is reported under the empty string, not skipped, because
 * a diagram whose identity is unstated is the same defect as one that
 * misstates it.
 */
export function targetNamespacesInUse(
  files: readonly string[] = workflowFiles(ROOT, "instance"),
  base = resolve(ROOT, ".."),
): Map<string, string[]> {
  // The DECLARED workflow graph, not a literal `processes/`: that reaches a
  // dependency's diagrams too (the DAK base layer's), which call into the same corpus.
  const out = new Map<string, string[]>();
  for (const f of files.filter((f) => f.endsWith(".bpmn"))) {
    const src = readFileSync(f, "utf-8");
    const ns = /<(?:bpmn:)?definitions\b[^>]*?\stargetNamespace="([^"]*)"/.exec(src)?.[1] ?? "";
    out.set(ns, [...(out.get(ns) ?? []), relative(base, f)]);
  }
  return out;
}

/**
 * Namespaces this layer BINDS IN JSON-LD, with the files that bind them.
 *
 * Bean `2j09`. {@link namespacesInUse} reads only diagram `xmlns`, so the
 * registry could pin every namespace a BPMN file binds and none that only an
 * `@context` binds — and report a clean pass over the gap. Owner, 2026-09-23,
 * approved the scope: what THIS layer emits, i.e.
 *
 * - every `.ts` file under a directory declared as `code` or `schemas` that
 *   writes an `@context` — the emitters, found by what they do rather than by
 *   a list that goes stale — and the namespace literals they carry;
 * - every committed `.jsonld` under this layer, by its `@context` bindings.
 *
 * NOT third-party documents another layer ingested (the DAK base layer's
 * and a DAK IG's FHIR artefact indexes): those are that layer's data.
 * `@base` is not a namespace and is not read; an IRI of OURS (the
 * `own-namespaces` code list, or one under it) is excluded — ours need
 * spelling one way, not a registry record.
 */
export function jsonLdNamespacesInUse(root = ROOT): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (ns: string, f: string) => {
    if (isOwn(ns)) return;
    const k = relative(resolve(root, ".."), f);
    out.set(ns, [...new Set([...(out.get(ns) ?? []), k])].sort());
  };
  const isNs = (s: string) => /^https?:\/\/\S+[#/]$/.test(s);
  const walk = (dir: string, visit: (f: string) => void) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "tests") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, visit);
      else visit(p);
    }
  };
  const codeDirs = [...directoriesForGraph(root, "code"), ...directoriesForGraph(root, "schemas")];
  for (const d of new Set(codeDirs)) {
    walk(d, (f) => {
      if (!f.endsWith(".ts") || f.endsWith(".test.ts")) return;
      const src = readFileSync(f, "utf-8");
      if (!src.includes("@context")) return;
      for (const m of src.matchAll(/"(https?:\/\/[^"\s`$]+[#/])"/g)) add(m[1]!, f);
    });
  }
  const bind = (ctx: unknown, f: string): void => {
    if (Array.isArray(ctx)) return ctx.forEach((c) => bind(c, f));
    if (ctx === null || typeof ctx !== "object") return;
    for (const [k, v] of Object.entries(ctx as Record<string, unknown>)) {
      if (k === "@base" || k === "@vocab" && typeof v !== "string") continue;
      const iri = typeof v === "string" ? v : (v as { "@id"?: unknown } | null)?.["@id"];
      if (typeof iri === "string" && isNs(iri)) add(iri, f);
    }
  };
  walk(root, (f) => {
    if (!f.endsWith(".jsonld")) return;
    try {
      const doc = JSON.parse(readFileSync(f, "utf-8")) as { "@context"?: unknown };
      bind(doc["@context"], f);
    } catch {
      // Not JSON: the file's own gate reports that, not this one.
    }
  });
  return out;
}

/** Ours: an own namespace, or an IRI under one (a document or base we publish). */
function isOwn(iri: string): boolean {
  return ownNamespaceValues().some((o) => iri === o || iri.startsWith(o) || o.startsWith(iri));
}

/**
 * BPMN elements the corpus actually contains.
 *
 * Derived, per "materialized through the tooling". The alternative — listing
 * the dozen somebody remembers — goes stale the first time a diagram uses a
 * thirteenth, and goes stale silently.
 */
export function bpmnTermsInUse(root = ROOT): string[] {
  const out = new Set<string>();
  // The declared workflow graph, as {@link namespacesInUse} reads it: a literal
  // `processes/` missed the diagrams a sub-graph declares (cat-harness#1032
  // moved the library's to `library/processes/`).
  for (const f of workflowFiles(root, "instance").filter((f) => f.endsWith(".bpmn"))) {
    for (const m of readFileSync(f, "utf-8").matchAll(/<(bpmn:[a-zA-Z]+)/g)) {
      out.add(m[1]!);
    }
  }
  return [...out].sort();
}

/** Dublin Core `schema.element[.qualifier]` terms the catalogue records use. */
export function dcTermsInUse(repoRoot = resolve(ROOT, "..")): string[] {
  const out = new Set<string>();
  for (const inst of readdirSync(repoRoot, { withFileTypes: true })) {
    if (!inst.isDirectory() || inst.name.startsWith(".")) continue;
    const dir = join(repoRoot, inst.name, "catalogue", "records");
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const doc = JSON.parse(readFileSync(join(dir, f), "utf-8")) as {
        fields?: Array<{ schema: string; element: string; qualifier?: string }>;
      };
      for (const x of doc.fields ?? []) {
        out.add(`${x.schema}.${x.element}${x.qualifier ? `.${x.qualifier}` : ""}`);
      }
    }
  }
  return [...out].sort();
}

/**
 * Namespace IRIs the corpus mentions ANYWHERE — not only as a BPMN `xmlns`.
 *
 * {@link namespacesInUse} reads `processes/*.bpmn|dmn` and nothing else, which
 * is the right question for "what does a DIAGRAM bind". It is the wrong
 * question for "is this record still earning its place", and on 2026-09-22 the
 * difference produced a FALSE FINDING pointing at the most load-bearing record
 * in the registry:
 *
 *     · 2 declared namespace(s) nothing uses — a record outliving its dependency:
 *         http://purl.org/dc/elements/1.1/
 *         http://purl.org/dc/terms/
 *
 * Dublin Core is used 43 times. `dcterms:title` is in the glossary document's
 * own `@context` and on its scheme node. The remedy the finding offered —
 * delete the record — would have unpinned the edition of a vocabulary the
 * repository actively emits, and a gate whose remedy is wrong is worse than
 * one that says nothing, which is the argument the OWN-namespace block twenty
 * lines up already makes for a different case.
 *
 * The cause is that a vocabulary can be used in more than one syntax. BPMN
 * binds namespaces with `xmlns`; JSON-LD binds them in `@context`. A reader
 * that knows one syntax reports the other as absent — the same shape as the
 * `<bpmn:`-prefixed regexes that read a default-namespace diagram as empty.
 *
 * So the scan is by IRI STRING over the source tree, which is syntax-agnostic
 * by construction and cannot acquire a third blind spot the day somebody emits
 * a vocabulary in a form neither reader knows.
 *
 * DELIBERATELY EXCLUDED, each for a different reason:
 *   - `external-schemas/` — every record names its own IRIs, so including it
 *     makes every record self-justifying and the check vacuous.
 *   - generated trees (`_kg/`, `docs/`) — an answer that depends on whether a
 *     generator has run is not reproducible on a fresh clone.
 *   - `node_modules/` — not this corpus.
 *
 * This feeds the UNUSED question only. `undeclared` still reads diagram
 * bindings, on purpose: widening it would demand a registry record for every
 * IRI mentioned anywhere — `owl:`, `rdfs:`, `schema:` — which is a different
 * and much larger decision. Filed rather than taken: bean `2j09`.
 */
export function namespaceMentions(iris: readonly string[], repoRoot = resolve(ROOT, "..")): Set<string> {
  const found = new Set<string>();
  if (iris.length === 0) return found;
  // The registry is excluded by PATH rather than by name, because repeating
  // the string "external-schemas" here would be a second spelling of a
  // directory the declaration already answers — `check:declared-paths` counts
  // exactly that, and it is right to: the two copies are free to diverge.
  // input-site: inert #ca5b78a8 — names a build-output directory only to leave it out of a walk
  const SKIP = new Set(["node_modules", "_kg", "docs", ".git", "dist", "coverage"]);
  const EXT = [".ts", ".tsx", ".json", ".jsonld", ".md"];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory is not a mention
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        // Every record names its own IRIs, so counting the registry would make
        // each record self-justifying and the check vacuous.
        if (full !== REGISTRY) walk(full);
        continue;
      }
      if (!EXT.some((x) => e.name.endsWith(x))) continue;
      let src;
      try {
        src = readFileSync(full, "utf-8");
      } catch {
        continue;
      }
      for (const iri of iris) if (!found.has(iri) && src.includes(iri)) found.add(iri);
      if (found.size === iris.length) return; // every IRI accounted for
    }
  };
  walk(repoRoot);
  return found;
}

/**
 * SKOS terms this repository EMITS, derived from the exporters that emit them.
 *
 * Source-derived rather than read back from `_kg/`, for the reason
 * {@link namespaceMentions} excludes generated trees: an answer that depends
 * on whether a generator has run is not reproducible on a fresh clone. The
 * exporters carry the mapping as literals (`prefLabel: "skos:prefLabel"`), so
 * the literals ARE the operative vocabulary.
 *
 * `use` on this record is `conforms`, not `reads`, and the distinction is the
 * one {@link SpecUse} draws: we do not parse somebody else's SKOS, we publish
 * documents that claim to BE `skos:ConceptScheme` layers. A version bump is
 * therefore a migration of our own output, not a compatibility question.
 */
export function skosTermsInUse(root = resolve(ROOT, "..")): string[] {
  const out = new Set<string>();
  // This script's own exporters, plus every layer's DECLARED `schemas`
  // graph. The third entry used to be a literal path to the content core's `schemas`:
  // a path into a layer above cat-harness that no import gate sees, and one
  // that would scan nothing, silently, once cat-harness stands alone
  // (separation placement review, 2026-10-06, bean `0r7u` step 0).
  const dirs = [
    join(root, "cat-harness-tools", "scripts"),
    ...new Set(layerRootsIn(root).flatMap((i) => instanceDirectoriesForGraph(i, "schemas"))),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const walk = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.name.startsWith(".") || e.name === "node_modules") continue;
        const full = join(d, e.name);
        if (e.isDirectory()) {
          walk(full);
          continue;
        }
        // Tests are excluded: a term asserted in a fixture is not a term this
        // repository publishes, and counting them would let a deleted feature
        // keep its vocabulary alive through the test that still names it.
        if (!e.name.endsWith(".ts") || e.name.includes(".test.")) continue;
        for (const m of readFileSync(full, "utf-8").matchAll(/"(skos:[a-zA-Z]+)"/g)) out.add(m[1]!);
      }
    };
    walk(dir);
  }
  return [...out].sort();
}

/** Which deriver feeds which record. Keyed by id so a record opts in. */
const DERIVERS: Record<string, () => string[]> = {
  "omg-bpmn-2.0": () => bpmnTermsInUse(),
  "dcmi-terms": () => dcTermsInUse(),
  "w3c-skos": () => skosTermsInUse(),
};

/**
 * The derivers that read the WHOLE CHECKOUT (every instance's catalogue
 * records, every instance's declared `schemas`), not only the record's own
 * instance. `omg-bpmn-2.0` reads the harness's own `processes/` and is judged
 * everywhere; these two give a different answer per composition.
 */
export const COMPOSED_DERIVERS: ReadonlySet<string> = new Set(["dcmi-terms", "w3c-skos"]);

/**
 * Why a composed record's terms ({@link COMPOSED_DERIVERS}) are not
 * `repoRoot`'s to judge stale, or null when they are (cat-harness-tools#1701).
 *
 * The records live in a mounted layer's registry (cat-harness) and are written
 * by the harness index (the root carrying the gates workflow, `rootProfile`
 * "harness"), from what IT mounts. In a CONTENT root (smart-ips-pilgrimage#13)
 * a term only an unmounted layer uses reads as "no longer used", and one only a
 * layer this root mounts at another pin reads as new; neither is a defect of the
 * record. A registry at the root itself, and every harness root, are judged as before.
 */
export function composedTermsNotOursReason(registry: string, repoRoot: string): string | null {
  if (rootProfile(repoRoot) !== "content") return null;
  if (!relative(repoRoot, registry).includes("/")) return null;
  return (
    `a content root (no .github/workflows/code-quality-gates.yml) and the record is a mounted layer's ` +
    `(${relative(repoRoot, registry)}); its terms are derived from every instance the harness index mounts, not this checkout's`
  );
}

function run(argv: string[]): number {
  const write = argv.includes("--write");
  const check = argv.includes("--check");
  const specs = loadSpecs();

  if (specs.length === 0) {
    // Third state. An empty registry in a repo that plainly uses BPMN is not
    // a clean result; it is the defect this tool was written for.
    console.error("no external-schema records, yet this repository consumes external namespaces.");
    console.error("That is `could not determine`, not a pass.");
    return 2;
  }

  // ── OURS is not a specification we conform to ────────────────────────
  //
  // `namespacesInUse` reads every `xmlns` a diagram binds, and some of them
  // are namespaces this project MINTS. Asking the external registry about
  // those is a category error, and it was not a harmless one: the two
  // spellings of our own BPMN extension namespace (bean `0d99`) were reported
  // as two undeclared SPECIFICATIONS, so the finding told the reader to go and
  // write registry records for an IRI this project owns. A gate whose remedy
  // is wrong is worse than one that says nothing — somebody follows it.
  //
  // So the two questions are asked separately, because they have different
  // answers. An EXTERNAL namespace must have a record naming its edition. An
  // OWN namespace must be spelt exactly ONE way; there is no edition to pin,
  // and nothing external to conform to.
  const inUse = namespacesInUse();
  const own = inUse.filter((ns) => (OWN_XML_NAMESPACES as readonly string[]).includes(ns));
  const external = inUse.filter((ns) => !(OWN_XML_NAMESPACES as readonly string[]).includes(ns));
  // Bean `2j09`: JSON-LD bindings too, not only diagram `xmlns`.
  const jsonLd = jsonLdNamespacesInUse();
  const undeclared = undeclaredNamespaces([...new Set([...external, ...jsonLd.keys()])].sort(), specs);
  // An IRI a diagram does not bind may still be emitted in JSON-LD, so the
  // mention scan is what decides whether a record has outlived its dependency.
  // See {@link namespaceMentions} for the false finding this repairs.
  const mentioned = namespaceMentions(unusedNamespaces(external, specs));
  const unused = unusedNamespaces(external, specs).filter((ns) => !mentioned.has(ns));

  // Drift, not absence: an XML namespace is compared by STRING, so a second
  // spelling means a consumer matching on the first skips every element in the
  // second — silently, and while parsing without error.
  // Since bean 12s9 there is more than one address ON PURPOSE (a prefix names
  // the declaring Subgraph), so drift is "ours but not an active extension
  // namespace" — the retired spelling — rather than "not the one address".
  const drifted = own.filter((ns) => !isOwnExtensionNamespace(ns));
  // The diagram's IDENTITY drifting is a different defect with the same shape:
  // a call is a QName, so two diagrams in two namespaces cannot call each
  // other without an import a standards tool would demand.
  const targets = targetNamespacesInUse();
  const offTarget = [...targets].filter(([ns]) => ns !== WORKFLOWS_NS);

  let stale = 0;
  for (const s of specs) {
    const derive = DERIVERS[s.id];
    if (!derive) continue;
    const found = derive();
    const have = new Set(s.terms.map((t) => t.term));
    const missing = found.filter((t) => !have.has(t));
    const gone = [...have].filter((t) => !found.includes(t));
    if (missing.length === 0 && gone.length === 0) continue;
    // cat-harness-tools#1701: excused, and said so, where the record is not ours.
    const notOurs = COMPOSED_DERIVERS.has(s.id) ? composedTermsNotOursReason(REGISTRY, resolve(ROOT, "..")) : null;
    if (notOurs !== null) {
      console.log(`· ${s.id}: ${missing.length} new term(s), ${gone.length} no longer used — not applicable here — ${notOurs}`);
      continue;
    }
    stale++;
    console.log(`${s.id}: ${missing.length} new term(s), ${gone.length} no longer used`);
    for (const t of missing.slice(0, 6)) console.log(`    + ${t}`);
    for (const t of gone.slice(0, 6)) console.log(`    - ${t}`);
    if (write) {
      // Kept reasons for terms that survive; a new term gets a placeholder
      // the author replaces. NOT invented prose: "derived, not yet described"
      // is honest and greppable, and a plausible-sounding invention is not.
      const prior = new Map(s.terms.map((t) => [t.term, t.operative]));
      s.terms = found.map((term) => ({
        term,
        operative: prior.get(term) ?? "derived from the corpus; what this repository does with it is not yet described",
      }));
      // A specification id is an identifier, not a filename. Safe on the read
      // side — `loadSpecs` walks the directory rather than composing a name —
      // so encoding only the writer cannot split the two apart.
      writeFileSync(join(REGISTRY, `${portableSegment(s.id)}.json`), JSON.stringify(s, null, 2) + "\n");
    }
  }

  console.log(`\n${specs.length} specification(s) referenced:`);
  for (const s of specs) {
    console.log(`  ${s.authority.padEnd(5)} ${s.title} ${s.version}  (${s.use}, ${s.terms.length} operative term(s))`);
  }

  if (undeclared.length > 0) {
    console.error(`\n✗ ${undeclared.length} namespace(s) in use that no record declares:`);
    for (const ns of undeclared) {
      const where = jsonLd.get(ns);
      console.error(`    ${ns}${where ? `   (JSON-LD: ${where.slice(0, 2).join(", ")}${where.length > 2 ? ", …" : ""})` : ""}`);
    }
    console.error("  Conforming to a specification nobody named is the defect this registry ends.");
  }
  // A `cites` record is pinned AHEAD of use on purpose (bean `4sim`: DCAT,
  // "reference only"), so nothing using it yet is its expected state, not a
  // record that outlived its dependency. Said in different words so the
  // remedy the second line offers — drop the record — is never read as
  // applying to the first.
  const citedAhead = new Set(specs.filter((s) => s.use === "cites").flatMap((s) => s.namespaces));
  const ahead = unused.filter((ns) => citedAhead.has(ns));
  const outlived = unused.filter((ns) => !citedAhead.has(ns));
  if (ahead.length > 0) {
    console.log(`\n· ${ahead.length} namespace(s) cited AHEAD of use — pinned by decision, nothing emits them yet:`);
    for (const ns of ahead) console.log(`    ${ns}`);
  }
  if (outlived.length > 0) {
    console.log(`\n· ${outlived.length} declared namespace(s) nothing uses — a record outliving its dependency:`);
    for (const ns of outlived) console.log(`    ${ns}`);
  }

  if (drifted.length > 0) {
    console.error(`\n✗ a diagram binds ${drifted.length} of our namespace(s) that is not active:`);
    for (const ns of OWN_BPMN_EXTENSION_NAMESPACES) console.error(`    ${ns}   (active — schemas/kg/namespaces.ts)`);
    for (const ns of drifted) console.error(`    ${ns}   ✗ retired`);
    console.error("  Bind bootstrap.processes: for skill, role and precondition, and");
    console.error("  cat-harness.processes: for every other element (bean 12s9). This is not cosmetic:");
    console.error("  an extension element under the other IRI is invisible to a consumer");
    console.error("  matching on this one, and the file still parses.");
  }

  if (offTarget.length > 0) {
    const n = offTarget.reduce((a, [, fs]) => a + fs.length, 0);
    console.error(`\n✗ ${n} diagram(s) declare a targetNamespace other than the one every diagram shares:`);
    console.error(`    ${WORKFLOWS_NS}   (canonical — schemas/kg/namespaces.ts, bean rtrg)`);
    for (const [ns, fs] of offTarget) {
      console.error(`    ${ns || "(none declared)"}   ✗ ${fs.length}: ${fs.slice(0, 4).join(", ")}${fs.length > 4 ? ", …" : ""}`);
    }
    console.error("  Set it to the canonical IRI. Not cosmetic: calledElement is a QName, so a call");
    console.error("  into a diagram in another namespace does not resolve in a conformant tool.");
  }

  if (check && (undeclared.length > 0 || drifted.length > 0 || offTarget.length > 0 || stale > 0)) {
    if (stale > 0) console.error(`\n✗ ${stale} record(s) have stale operative terms. Run with --write and commit.`);
    return 1;
  }
  if (undeclared.length > 0 || drifted.length > 0 || offTarget.length > 0) return 1;
  console.log(
    `\n✓ ${external.length} external namespace(s) declared with their edition; ` +
      `${own.length} own namespace(s), one spelling each; ` +
      `${targets.get(WORKFLOWS_NS)?.length ?? 0} diagram(s), one targetNamespace`,
  );
  return 0;
}

if (import.meta.main) process.exit(run(process.argv.slice(2)));
