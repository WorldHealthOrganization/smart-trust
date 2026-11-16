/**
 * Write every artefact generated from the Zod source, or with `--check`, fail
 * when any committed copy differs from what would be written.
 *
 *   smart-base/L1/schemas/generated/l1.json                          L1 3.0, smart-kg format, JSON-equal to WHO's but for `_generated`
 *   smart-base/L1/schemas/generated/l1-library.json                  the extension layer (imports l1), smart-kg format
 *   smart-base/L1/schemas/generated/l1-library.jsonld                the specialisation: rdfs:subClassOf from L1 layout classes to the library's
 *   smart-base/L1/schemas/generated/recommendation-graph.schema.json the document JSON Schema
 *   smart-base/L1/schemas/generated/l1.context.jsonld                smart-kg's L1 context, JSON-equal to WHO's
 *   smart-base/L1/schemas/generated/l1-library.context.jsonld        the context an l1-library document names (context.ts)
 *   input/fsh/models/KGL1.fsh, KGL1Library.fsh       logical models (the IG's, at the repository root)
 *   input/fsh/codesystems/KG*.fsh, valuesets/KG*VS.fsh
 *
 * A generated FSH file this run would not write — a value set renamed or
 * removed upstream — is deleted, and only if it carries this generator's
 * banner: a hand-written KG*.fsh is never touched. `--check` reports it.
 *
 *   npx tsx emit.ts               write
 *   npx tsx emit.ts     --check   exit 1 and name each stale or orphaned file
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { baseContext, extensionContext, scopedContext } from "./context.ts";
import { fshFiles, GENERATED_BANNER } from "./fsh.ts";
import { GraphDocumentSchema } from "./graph.ts";
import { L1 } from "./l1.ts";
import { DOCO_NS, ELEMENT_TYPE_CLASS, L1_LIBRARY, LAYERING_RULE, SPECIALISES } from "./l1-library.ts";
import { allCypher, allTurtle, buildCypher, buildTurtle } from "./exports.ts";
import { HELD, scopeList } from "./layers.ts";
import { toOntologyJson, type LayerSpec } from "./ontology.ts";
import { SHAPE_ID, SHAPE_TITLE } from "./shape-text.ts";

/** smart-base repository root: this file is `smart-base/L1/schemas/emit.ts`, three levels down. */
export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export function graphJsonSchema(): Record<string, unknown> {
  const body = z.toJSONSchema(GraphDocumentSchema, { io: "input", reused: "inline", target: "draft-2020-12" }) as Record<string, unknown>;
  return { $schema: body.$schema, $id: SHAPE_ID, title: SHAPE_TITLE, ...body };
}

/** The class-level half of the specialisation ruling, as linked data. */
export function specialisationJsonLd(): Record<string, unknown> {
  const sg = "http://smart.who.int/kg/";
  return {
    "@context": { rdfs: "http://www.w3.org/2000/01/rdf-schema#", sgkg: sg, doco: DOCO_NS, subClassOf: { "@id": "rdfs:subClassOf", "@type": "@id" }, comment: "rdfs:comment" },
    "@id": `${sg}l1-library`,
    comment: LAYERING_RULE,
    "@graph": [
      ...SPECIALISES.map((s) => ({ "@id": `${sg}${s.l1}`, subClassOf: s.library, comment: s.note })),
      ...Object.entries(ELEMENT_TYPE_CLASS).map(([type, cls]) => ({
        "@id": `${sg}publication-element#${type}`,
        subClassOf: [`${sg}publication-element`, cls],
        comment: `A publication-element whose elementType is "${type}".`,
      })),
    ],
  };
}

/**
 * The top-level `_generated` the two smart-kg-format files carry: each file's
 * own declaration that this generator wrote it, the convention the harness's
 * reference-direction check reads (`declaresGenerated`). `l1.json` quotes
 * WHO's text byte for byte, including a `where` naming a DAK repository by its
 * layer name; without the key that quote read as authored text in this layer.
 *
 * Added here, at serialisation, and not in `toOntologyJson`: the ontology
 * schema is strict and the parity test compares that function's value with
 * WHO's file, so both stay exactly as they were. `source: "authored"` in the
 * file is about L1's CONTENT (authored, not extracted); this key is about the
 * FILE (written from `l1.ts`, not edited by hand).
 */
export const GENERATED_NOTE = "smart-base/L1/schemas/emit.ts (npm run build in smart-base/L1/schemas/) — do not hand-edit; edit the layer source in smart-base/<Layer>/schemas/";

/**
 * Classes a code list once offered and the layer no longer has. A code a
 * recorded outcome carries must stay resolvable, so it is RETIRED, never
 * removed (cat-harness `folio-code-list/v1`). These are L1's pre-3.0 classes,
 * which `code-lists/sgkg-l1-classes.json` listed until it was generated.
 */
export const RETIRED_CLASSES: Record<string, { code: string; label: string; definition: string }[]> = {
  l1: [
    { code: "population", label: "Population", definition: "Retired in L1 3.0: the P of a PICO question is verbatim text on its key-question, coded through crossReferences." },
    { code: "intervention", label: "Intervention", definition: "Retired in L1 3.0: the I of a PICO question is on its key-question, joined to a catalogued health-intervention." },
    { code: "comparator", label: "Comparator", definition: "Retired in L1 3.0: the C of a PICO question is verbatim text on its key-question, coded through crossReferences." },
    { code: "schedule", label: "Schedule", definition: "Retired in L1 3.0: timing is a slot on the recommendation; L2's scheduling-logic implements the recommendation." },
    { code: "schedule-entry", label: "Schedule entry", definition: "Retired in L1 3.0: timing is a slot on the recommendation; L2's scheduling-logic implements the recommendation." },
    { code: "external-artifact", label: "External artefact", definition: "Moved to L2 in 3.0 unchanged: a DAK file is the DAK's material, not WHO content. Use sgkg-l2#external-artifact." },
  ],
};

/** `code-lists/sgkg-<layer>-classes.json`: the class ids document kinds name in `modelledBy`, from the layer source. */
export function classCodeList(key: string, spec: LayerSpec, file: string): Record<string, unknown> {
  const active = spec.classes.map((c) => ({ code: c.id, label: c.name, definition: c.note, value: c.iri }));
  const retired = (RETIRED_CLASSES[key] ?? []).map((r) => ({ ...r, status: "retired" }));
  return {
    $schema: "folio-code-list/v1",
    id: `sgkg-${key}-classes`,
    title: `SMART Guidelines KG ${spec.layer} classes`,
    description: `The classes a ${spec.layer} knowledge-graph node can be. smart-base document kinds and extractions name them as \`sgkg-${key}#<code>\`. GENERATED by smart-base/L1/schemas/emit.ts from ${file}: do not hand-edit; change the layer source and run \`npm run build\` in smart-base/L1/schemas/.`,
    source: { href: `https://github.com/litlfred/smart-base/blob/main/${file}`, note: `${file}, the layer's \`classes\`: id, name, note and iri.${retired.length ? " Classes the layer no longer has stay, retired." : ""}` },
    codes: [...active, ...retired],
  };
}

/** `<layer>.ttl` and `<layer>.cypher` beside each layer's JSON; `all.ttl` and `all.cypher` here, in L1. */
export function exportArtefacts(): { path: string; text: string }[] {
  const layers = HELD.filter((h) => h.key !== "l1-library");
  const per = layers.map((h) => {
    const x = { own: h.spec, scope: scopeList(h.key) };
    return { key: h.key, dir: h.dir, ttl: buildTurtle(x), cypher: buildCypher(x) };
  });
  return [
    ...per.flatMap((l) => [
      { path: `${l.dir}/generated/${l.key}.ttl`, text: l.ttl },
      { path: `${l.dir}/generated/${l.key}.cypher`, text: l.cypher },
    ]),
    { path: "smart-base/L1/schemas/generated/all.ttl", text: allTurtle(per.map((l) => ({ key: l.key, text: l.ttl }))) },
    { path: "smart-base/L1/schemas/generated/all.cypher", text: allCypher(per.map((l) => ({ key: l.key, text: l.cypher }))) },
  ];
}

export function artefacts(): { path: string; text: string }[] {
  const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
  const declared = (v: object) => json({ _generated: GENERATED_NOTE, ...v });
  return [
    { path: "smart-base/L1/schemas/generated/l1.json", text: declared(toOntologyJson(L1)) },
    { path: "smart-base/L1/schemas/generated/l1-library.json", text: declared(toOntologyJson(L1_LIBRARY)) },
    { path: "smart-base/L1/schemas/generated/l1-library.jsonld", text: json(specialisationJsonLd()) },
    { path: "smart-base/L1/schemas/generated/recommendation-graph.schema.json", text: json(graphJsonSchema()) },
    { path: "smart-base/L1/schemas/generated/l1.context.jsonld", text: json(baseContext([L1])) },
    { path: "smart-base/L1/schemas/generated/l1-library.context.jsonld", text: json(extensionContext([L1_LIBRARY, L1])) },
    ...fshFiles(L1, "smart-base/L1/schemas/l1.ts (L1 3.0)"),
    ...fshFiles(L1_LIBRARY, "smart-base/L1/schemas/l1-library.ts (the library extension)"),
    // Turtle and Cypher of each layer's type graph (smart-kg build-exports), and every layer merged.
    ...exportArtefacts(),
    // The class lists document kinds check `modelledBy` against, one per layer (not the l1-library extension).
    ...HELD.filter((h) => h.key !== "l1-library").map((h) => ({ path: `smart-base/code-lists/sgkg-${h.key}-classes.json`, text: json(classCodeList(h.key, h.spec, h.file)) })),
    // The layers above L1, each in its own named subgraph (L2/, L2-bpmn/, L2-dmn/, L3/), found from their declarations.
    ...HELD.filter((h) => !h.key.startsWith("l1")).flatMap((h) => [
      { path: `${h.dir}/generated/${h.key}.json`, text: declared(toOntologyJson(h.spec)) },
      { path: `${h.dir}/generated/${h.key}.context.jsonld`, text: json(scopedContext(scopeList(h.key))) },
      ...fshFiles(h.spec, `${h.file} (${h.spec.layer} ${h.spec.schemaVersion})`),
    ]),
  ];
}

/** Generated FSH on disk that this run would not write: renamed or removed upstream. */
export function orphans(written: Set<string>): string[] {
  const out: string[] = [];
  for (const dir of ["input/fsh/models", "input/fsh/codesystems", "input/fsh/valuesets"]) {
    const abs = join(REPO, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      const rel = `${dir}/${f}`;
      if (!/^KG.*\.fsh$/.test(f) || written.has(rel)) continue;
      // Only this generator's own output: the banner's fixed prefix.
      if (readFileSync(join(abs, f), "utf8").startsWith(GENERATED_BANNER("").split(" from ")[0]!)) out.push(rel);
    }
  }
  return out.sort();
}

function main(argv: string[]): number {
  const check = argv.includes("--check");
  const all = artefacts();
  const stale: string[] = [];
  for (const a of all) {
    const abs = join(REPO, a.path);
    const current = existsSync(abs) ? readFileSync(abs, "utf8") : undefined;
    if (current === a.text) continue;
    if (check) {
      stale.push(`${a.path}${current === undefined ? " (missing)" : ""}`);
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, a.text);
    console.log(`wrote ${a.path}`);
  }
  for (const o of orphans(new Set(all.map((a) => a.path)))) {
    if (check) stale.push(`${o} (orphaned: generated, but nothing generates it now)`);
    else {
      rmSync(join(REPO, o));
      console.log(`removed ${o} (orphaned)`);
    }
  }
  if (check) {
    if (stale.length) {
      console.error(`${stale.length} generated file(s) are stale — run \`npm run build\` in smart-base/L1/schemas/:`);
      for (const s of stale) console.error(`  ${s}`);
      return 1;
    }
    console.log(`✓ ${all.length} generated file(s) current, none orphaned`);
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
