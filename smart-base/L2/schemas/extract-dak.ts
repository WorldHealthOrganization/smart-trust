/**
 * Extracts the DAK component layer (L2) from a smart-base-shaped IG — a port
 * of WHO smart-kg `tools/extract-dak.mjs` (main 3f5e477): dak.json for the
 * kit's metadata, and the FSH instance tree for whichever of the components it
 * actually ships.
 *
 * DAK.fsh declares nine components. This reports on ALL NINE — including the
 * ones with no instance, because "which components does this DAK not have
 * yet" is a question the kit's own model implies and nothing in the estate answers.
 *
 * The one join here that is not string matching is `fulfilledBy`: requirement
 * instances write `actor[+] = Canonical(SGAuthoring.Persona.X)`, which
 * resolves against a persona's instance id without guessing.
 *
 *   npx tsx L2/schemas/extract-dak.ts --dak <dak.json> --fsh <input/fsh> [--bpmn-dir d] [--dmn-dir d] [--out p]
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { argOf, edgeBuilder, graphDocument, isMain, nodeBuilder, type GraphDocument, type GraphEdge, type GraphNode, type ProvenanceSource } from "../../L1/schemas/extract-doc.ts";
import { localStructureDefinitions, personaId, sha256, slug, structureDefinitionCanonical } from "./kgid-l2.ts";
import { L2 } from "./l2.ts";

const SKILL = "kg/extract-dak";
const node = nodeBuilder(SKILL);
const edge = edgeBuilder(SKILL);

/** Every .fsh under a directory tree, sorted, with a hash over the lot. */
function fshTree(dir: string): { files: string[]; sha256: string | null } {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d).sort()) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith(".fsh")) files.push(p);
    }
  };
  if (existsSync(dir)) walk(dir);
  const digest = createHash("sha256");
  for (const f of files) digest.update(relative(dir, f)).update("\0").update(readFileSync(f));
  return { files, sha256: files.length ? digest.digest("hex") : null };
}

const fshString = (body: string, key: string): string | null => {
  const m = new RegExp(`^\\*\\s+${key}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`, "m").exec(body);
  return m ? m[1]!.replace(/\\"/g, '"') : null;
};
const fshMultiline = (body: string, key: string): string | null => {
  const m = new RegExp(`^\\*\\s+${key}\\s*=\\s*"""([\\s\\S]*?)"""`, "m").exec(body);
  return m ? m[1]!.trim() : fshString(body, key);
};

interface Instance {
  id: string;
  instanceOf: string;
  body: string;
}

/**
 * Split a .fsh file into its Instance blocks. Split rather than match: smart-kg
 * once ended each block with a `(?=^Instance:|\Z)` lookahead, and JavaScript
 * has no \Z — the LAST instance in every file was silently dropped.
 */
function instances(text: string): Instance[] {
  const out: Instance[] = [];
  for (const part of text.split(/^(?=Instance:\s*\S)/m)) {
    const m = /^Instance:\s*(\S+)\s*\r?\n\s*InstanceOf:\s*(\S+)/.exec(part);
    if (m) out.push({ id: m[1]!, instanceOf: m[2]!, body: part });
  }
  return out;
}

/** dak.json, as far as this reads it. */
interface DakJson {
  id?: string;
  name?: string;
  title?: string;
  description?: unknown;
  version?: string;
  status?: string;
  publicationUrl?: string;
  previewUrl?: string;
  canonicalUrl?: string;
  license?: string;
  copyrightYear?: string | number;
  publisher?: { name?: string; url?: string };
}

interface Persona {
  iri: string;
  instance: string;
  title: string;
  name: string | null;
  personaType: string | null;
  iscoCode: string[];
  source: string;
}

export interface DakOptions {
  dakPath: string;
  fshDir: string;
  bpmnDir?: string | null;
  dmnDir?: string | null;
}

export interface DakStats {
  found: Record<string, number>;
  statementCount: number;
  conformance: Record<string, number>;
  orphans: { component: string; file: string }[];
  warnings: string[];
  ns: string;
}

export function extract(opts: DakOptions): { doc: GraphDocument; stats: DakStats } {
  const { dakPath, fshDir, bpmnDir, dmnDir } = opts;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];
  const derivedFrom: ProvenanceSource[] = [];

  // ---- the kit -----------------------------------------------------------------------------
  const dakDoc = JSON.parse(readFileSync(dakPath, "utf8")) as DakJson;
  const ns = String(dakDoc.canonicalUrl ?? dakDoc.publicationUrl ?? "urn:unknown").replace(/\/$/, "");
  const dakIri = `${ns}/kg/dak`;
  derivedFrom.push({ path: dakPath, sha256: sha256(readFileSync(dakPath)) });

  nodes.push(
    node(dakIri, "dak", dakDoc.title ?? dakDoc.name ?? dakDoc.id, {
      id: dakDoc.id,
      name: dakDoc.name,
      title: dakDoc.title,
      description: typeof dakDoc.description === "string" ? dakDoc.description : undefined,
      version: dakDoc.version,
      status: dakDoc.status,
      publicationUrl: dakDoc.publicationUrl,
      previewUrl: dakDoc.previewUrl,
      canonicalUrl: dakDoc.canonicalUrl,
      license: dakDoc.license,
      copyrightYear: dakDoc.copyrightYear === undefined ? undefined : String(dakDoc.copyrightYear),
      publisherName: dakDoc.publisher?.name,
      publisherUrl: dakDoc.publisher?.url,
    }),
  );

  // ---- the FSH instance tree ---------------------------------------------------------------
  const tree = fshTree(fshDir);
  if (tree.sha256) {
    derivedFrom.push({
      path: fshDir,
      sha256: tree.sha256,
      note:
        `${tree.files.length} .fsh files, hashed as a unit so that a component added upstream ` +
        `expires this projection rather than being silently absent from it.`,
    });
  }
  const texts = tree.files.map((f) => readFileSync(f, "utf8"));
  const localSDs = localStructureDefinitions(texts);

  const personasByInstance = new Map<string, Persona>();
  const personasByTitle = new Map<string, Persona | null>();
  const requirements: { inst: Instance; rel: string }[] = [];

  tree.files.forEach((file, i) => {
    const rel = relative(process.cwd(), file);
    for (const inst of instances(texts[i]!)) {
      if (inst.instanceOf === "ActorDefinition") {
        const title = fshString(inst.body, "title");
        if (!title) {
          warnings.push(`ActorDefinition ${inst.id} has no title; skipped`);
          continue;
        }
        const iri = personaId(ns, title);
        const description = fshMultiline(inst.body, "description") ?? "";
        const p: Persona = {
          iri,
          instance: inst.id,
          title,
          name: fshString(inst.body, "name"),
          personaType: /^\*\s+type\s*=\s*#(\S+)/m.exec(inst.body)?.[1] ?? null,
          // GenericPersona.fsh declares iscoCode, but the committed instances write ISCO into the
          // description prose. Read it where it actually is, and say so.
          iscoCode: [...(/\*\*ISCO(?:-08)?\*\*:([^\n]*)/.exec(description)?.[1] ?? "").matchAll(/\b(\d{4})\b/g)].map((m) => m[1]!),
          source: rel,
        };
        personasByInstance.set(inst.id, p);
        if (personasByTitle.has(title)) {
          warnings.push(`two ActorDefinitions share the title "${title}" — a BPMN pool naming it is ambiguous`);
          personasByTitle.set(title, null);
        } else personasByTitle.set(title, p);

        nodes.push(
          node(
            iri,
            "persona",
            title,
            {
              id: inst.id,
              title,
              name: p.name,
              description,
              personaType: p.personaType,
              iscoCode: p.iscoCode,
              sourceKind: "instance",
              source: rel,
              resolutionStatus: "resolved",
            },
            p.iscoCode.length
              ? {
                  note:
                    "ISCO codes were read from the description prose, where the committed instances " +
                    "put them; GenericPersona.fsh declares a structured iscoCode field they do not use.",
                }
              : {},
          ),
        );
        continue;
      }

      if (/^SGRequirements?$/.test(inst.instanceOf) || /Requirement$/.test(inst.instanceOf)) {
        requirements.push({ inst, rel });
      }
    }
  });

  // ---- requirements, and the one join that resolves properly -------------------------------
  let statementCount = 0;
  const conformance: Record<string, number> = {};
  for (const { inst, rel } of requirements) {
    const title = fshString(inst.body, "title");
    const iri = `${ns}/requirement/${slug(inst.id)}`;
    const actors = [...inst.body.matchAll(/actor\[[+=]\]\s*=\s*Canonical\(([^)]+)\)/g)].map((m) => m[1]!.trim());
    const capability = /extension\[capability\]\.valueString\s*=\s*"([^"]*)"/.exec(inst.body)?.[1] ?? null;
    const benefit = /extension\[benefit\]\.valueString\s*=\s*"([^"]*)"/.exec(inst.body)?.[1] ?? null;

    // A requirement with an actor and a capability is the functional "as-a / I want / so-that"
    // shape. One with neither is non-functional. Recorded rather than assumed, via `profile`.
    const kind = actors.length || capability ? "functional-requirement" : "non-functional-requirement";
    nodes.push(
      node(iri, kind, title ?? inst.id, {
        id: inst.id,
        title,
        description: fshMultiline(inst.body, "description"),
        ...(kind === "functional-requirement" ? { capability, benefit } : {}),
        // smart-kg recorded the FSH name; the layer types profile as a list of canonicals. The
        // names this branch admits (SGRequirement(s), *Requirement) are never FHIR core's
        // `Requirements`, so a bare name is the IG's own profile, under the kit's canonical.
        profile: [structureDefinitionCanonical(inst.instanceOf, { canonical: ns, local: new Map([...localSDs, [inst.instanceOf, localSDs.get(inst.instanceOf) ?? inst.instanceOf]]) })],
        sourceKind: "instance",
        source: rel,
      }),
    );
    edges.push(
      edge("hasComponent", dakIri, iri, {
        qualifier: "requirements",
        derivation: "inferred",
        note:
          "dak.json declares no component arrays, so kit membership is inferred from the " +
          "instance being present in the IG's input tree rather than read from a declaration.",
        evidence: { location: rel, quote: `Instance: ${inst.id}` },
      }),
    );

    for (const m of inst.body.matchAll(
      /statement\[\+\]\.key\s*=\s*"([^"]+)"[\s\S]*?label\s*=\s*"([^"]*)"[\s\S]*?requirement\s*=\s*"((?:[^"\\]|\\.)*)"[\s\S]*?conformance\[\+\]\s*=\s*#(\S+)/g,
    )) {
      const [, key, label, text, conf] = m as unknown as [string, string, string, string, string];
      const sIri = `${iri}/statement/${slug(key)}`;
      statementCount++;
      conformance[conf] = (conformance[conf] ?? 0) + 1;
      nodes.push(node(sIri, "requirement-statement", key, { key, label, requirement: text.replace(/\\"/g, '"'), conformance: conf }));
      edges.push(edge("hasStatement", iri, sIri));
    }

    for (const a of actors) {
      const hit = personasByInstance.get(a);
      edges.push(
        edge("fulfilledBy", iri, hit ? hit.iri : personaId(ns, a), {
          properties: {
            resolutionStatus: hit ? "resolved" : "unresolved",
            matchedOn: "actor Canonical() == ActorDefinition instance id",
            canonical: a,
          },
          derivation: "inferred",
          note: hit
            ? "Resolved by canonical reference, not by name matching. Unlike a BPMN pool, a " +
              "requirement names the persona by its instance id, so this join does not break when " +
              "someone edits a display title."
            : `No ActorDefinition instance is named "${a}". A canonical that resolves to nothing is ` + `a broken reference, not an ambiguous one.`,
          evidence: { location: rel, quote: `actor[+] = Canonical(${a})` },
        }),
      );
      if (!hit) warnings.push(`requirement ${inst.id} names actor ${a}, which no ActorDefinition defines`);
    }
  }

  for (const p of personasByInstance.values()) {
    edges.push(
      edge("hasComponent", dakIri, p.iri, {
        qualifier: "personas",
        derivation: "inferred",
        note: "Inferred from presence in the IG's input tree; dak.json declares no personas array.",
        evidence: { location: p.source, quote: `Instance: ${p.instance}` },
      }),
    );
  }

  // ---- coverage across all nine components -------------------------------------------------
  const found: Record<string, number> = {
    healthInterventions: 0,
    personas: personasByInstance.size,
    userScenarios: 0,
    businessProcesses: 0,
    dataElements: 0,
    decisionLogic: 0,
    indicators: 0,
    requirements: requirements.length,
    testScenarios: 0,
  };

  // Files that exist without a component declaring them — the inverse gap, and just as real.
  const orphans: { component: string; file: string }[] = [];
  for (const [dir, ext, component] of [
    [bpmnDir, ".bpmn", "businessProcesses"],
    [dmnDir, ".dmn", "decisionLogic"],
  ] as const) {
    if (!dir || !existsSync(dir)) continue;
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith(ext) || f.includes(".layout.")) continue;
      orphans.push({ component, file: join(dir, f) });
    }
  }

  return {
    doc: graphDocument(L2, `${ns}/kg/l2`, derivedFrom, nodes, edges),
    stats: { found, statementCount, conformance, orphans, warnings, ns },
  };
}

function main(argv: string[]): number {
  const dakPath = argOf(argv, "--dak");
  const fshDir = argOf(argv, "--fsh");
  if (!dakPath || !fshDir) {
    console.error("usage: extract-dak.ts --dak <dak.json> --fsh <dir> [--bpmn-dir d] [--dmn-dir d] [--out p]");
    return 2;
  }
  const { doc, stats } = extract({ dakPath, fshDir, bpmnDir: argOf(argv, "--bpmn-dir"), dmnDir: argOf(argv, "--dmn-dir") });
  const out = argOf(argv, "--out");
  if (out) writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
  else console.log(JSON.stringify(doc, null, 2));

  console.error(`${doc.nodes.length} nodes, ${doc.edges.length} edges`);
  console.error(`\nDAK component coverage (DAK.fsh declares nine):`);
  for (const [k, v] of Object.entries(stats.found)) {
    console.error(`  ${v ? "✓" : "·"} ${k.padEnd(20)} ${v ? `${v} instance(s)` : "none in this IG"}`);
  }
  const missing = Object.values(stats.found).filter((v) => !v).length;
  if (missing) console.error(`  ${missing} of 9 components have no instance here.`);
  if (stats.statementCount) {
    console.error(
      `\n${stats.statementCount} requirement statements ` +
        `(${Object.entries(stats.conformance)
          .map(([k, v]) => `${v} ${k}`)
          .join(", ")})`,
    );
  }
  const joins = doc.edges.filter((e) => e.properties?.resolutionStatus);
  const res = joins.filter((e) => e.properties?.resolutionStatus === "resolved").length;
  console.error(`${res}/${joins.length} cross-file references resolved`);
  if (stats.orphans.length) {
    console.error(`\n${stats.orphans.length} file(s) present with no component declaring them:`);
    for (const o of stats.orphans) console.error(`  ${o.file}  (would be ${o.component})`);
  }
  for (const w of stats.warnings.slice(0, 6)) console.error(`  warning: ${w}`);
  return 0;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
