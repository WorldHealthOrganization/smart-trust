/**
 * The defined-terms index: every KG asset that carries a title and a
 * description, extracted into core's glossary as `candidate` terms.
 *
 * Bean `lqo9`, piece 1 as the owner posed it: *"an index of all defined terms
 * extracted from KG assets in the docs/ (e.g. a bpmn diagram swimlane has
 * title/description)"*, and on 2026-09-23 *"everything extracted to glosasay /
 * skos? accesible in ihris page/search?"*, *"it should be part of general
 * pracice w/ glossary/ page"*.
 *
 * ## One scheme per asset type per layer
 *
 * | scheme | asset | prefLabel | definition | notation | source |
 * |---|---|---|---|---|---|
 * | `kg-skills` | a skill's markdown | front matter `name` | front matter `description` | the name | the file |
 * | `kg-tools` | a Tool node | `title` | `description` | the Tool id | the file declaring it `#<id>` |
 * | `kg-bpmn-activities` | a BPMN task or call activity | `name` | its own `<documentation>` | the element id | the diagram `#<element id>` |
 * | `kg-dmn-decisions` | a DMN decision | `name` | its own `<description>` | the element id | the table `#<element id>` |
 * | `kg-schema-fields` | a schema field with a doc comment | `<Declaration>.<field>` | the doc comment's first paragraph | none | the module `#<Declaration>.<field>` |
 *
 * A scheme is emitted only for a (layer, type) with at least one term: an
 * empty scheme is a declaration claiming a set that is not there (`dh4f`).
 *
 * ## What is NOT extracted here, and why
 *
 * **BPMN lanes and roles.** The swimlane ledger (`swimlane-glossary`) already
 * carries every declared role as a concept, with each lane name as an
 * `altLabel` and each lane's documentation as a per-process usage. Extracting
 * them again would be a second concept for one meaning, which is the
 * duplication slice 2 of the bean was built to avoid. The glossary page links
 * the ledger instead.
 *
 * **Schema fields with no doc comment.** The type is "schema fields with
 * descriptions" as the bean poses it. A field without one is a name, not a
 * term; 1,287 of them would bury the ones that say something.
 *
 * ## The rules, from the bean and the `glossary-terms` skill
 *
 * - **Always `candidate`.** An extractor writes candidates; only a person
 *   moves one to `authored`.
 * - **The definition is the asset's own text, verbatim**, whitespace folded
 *   and XML entities decoded, and nothing else. An asset with a title and no
 *   description is a candidate with no definition. Nothing is paraphrased,
 *   summarised or completed.
 * - **`source` points at the asset**: a repository path, with an anchor
 *   naming the element inside a file that holds many.
 * - **IRIs are in the owning layer's namespace**, which is the layer
 *   whose root holds the asset. A skill in `folio-assistant-core/skills/` is
 *   core's even though `cat-harness.json` also declares that directory with
 *   `scope: "repository"`.
 * - **A duplicate label is two concepts, never a merge.** `id` is a field of
 *   dozens of schemas and means something different in each.
 * - **Deterministic**: sorted, no timestamps, no line numbers (an editor
 *   coordinate would make the output change when nothing extracted did).
 *
 * @module folio-assistant-core/scripts/glossary-extract
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

import {
  instanceRootsIn,
  readDeclaration,
  resolveDirectories,
} from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.ts";
import { parseFrontMatter, scalar } from "@litlfred/cat-harness-tools/schemas/kg/front-matter.ts";
import { isSkillMd, skillMdDirs, unpublishedSkills } from "@litlfred/cat-harness-tools/scripts/known-skills.ts";
import { readSchemaGraph } from "@litlfred/cat-harness-tools/scripts/schema-graph.ts";
import { discoverTools } from "@litlfred/cat-harness-tools/tools/discover.ts";
import { GLOSSARY_SCHEMA_ID, GlossarySchema, type Glossary, type Term } from "../schemas/glossary.ts";

/** The asset types this extractor reads, in the order the page lists them. */
export const ASSET_TYPES = ["kg-skills", "kg-tools", "kg-bpmn-activities", "kg-dmn-decisions", "kg-schema-fields"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/** The prefix every extracted scheme id carries, and no authored one may. */
export const EXTRACTED_PREFIX = "kg-";

const TITLES: Record<AssetType, { title: string; what: string }> = {
  "kg-skills": { title: "Skills", what: "every skill's front matter: `name` as the label, `description` as the definition" },
  "kg-tools": { title: "Tools", what: "every Tool node: `title` as the label, `description` as the definition, the Tool id as the code" },
  "kg-bpmn-activities": {
    title: "BPMN activities",
    what: "every BPMN task and call activity: `name` as the label, its own `<documentation>` as the definition, the element id as the code",
  },
  "kg-dmn-decisions": {
    title: "DMN decisions",
    what: "every DMN decision: `name` as the label, its own `<description>` as the definition, the element id as the code",
  },
  "kg-schema-fields": {
    title: "Schema fields",
    what: "every schema field with a doc comment: `<Declaration>.<field>` as the label, the comment's first paragraph as the definition",
  },
};

export function assetTypeTitle(t: AssetType): string {
  return TITLES[t].title;
}

/** What an asset type's terms are read from, in a sentence: the glossary's per-type page says it once at the top. */
export function assetTypeWhat(t: AssetType): string {
  return TITLES[t].what;
}

/** One extracted scheme: the layer it belongs to, and the glossary itself. */
export interface ExtractedScheme {
  instance: string;
  type: AssetType;
  glossary: Glossary;
}

export interface Extraction {
  schemes: ExtractedScheme[];
  /** Two assets that would mint one IRI. Never resolved by guessing: the run fails. */
  collisions: string[];
}

/** Everything a term carries before it is given an id. */
interface Raw {
  instance: string;
  type: AssetType;
  /** The asset's own identity, from which the local id is derived. */
  key: string;
  prefLabel: string;
  definition?: string;
  notation?: string;
  source: string;
}

const posix = (p: string) => p.split(sep).join("/");

/** Whitespace folded to single spaces. The one normalisation a definition gets. */
export function fold(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** The five predefined XML entities and numeric references, decoded. */
export function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * A local id for a term: lowercase, `[a-z0-9._-]`, so it satisfies the
 * schema's LOCAL_ID. `@` is spelled out rather than dropped, so `@id` and `id`
 * stay two terms.
 */
export function localId(key: string): string {
  return key
    .toLowerCase()
    .replace(/@/g, "at-")
    .replace(/\$/g, "dollar-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/-+$/, "");
}

/** Layer roots, longest first, so a path resolves to the MOST specific owner. */
function owners(repo: string): Array<{ root: string; name: string; rel: string }> {
  const out: Array<{ root: string; name: string; rel: string }> = [];
  for (const root of instanceRootsIn(repo)) {
    const decl = readDeclaration(root);
    if (!decl) continue;
    const rel = posix(relative(repo, root));
    // The repository root's own declaration owns nothing a layer does.
    if (rel === "") continue;
    out.push({ root: resolve(root), name: decl.name, rel });
  }
  return out.sort((a, b) => b.root.length - a.root.length);
}

function ownerOf(abs: string, own: ReturnType<typeof owners>): string | undefined {
  const p = resolve(abs);
  return own.find((o) => p === o.root || p.startsWith(o.root + sep))?.name;
}

/** Declared directories of one graph typology, each at its declaring layer's own root. */
function ownDirectories(repo: string, kind: string): string[] {
  const out = new Set<string>();
  for (const root of instanceRootsIn(repo)) {
    const decl = readDeclaration(root);
    if (!decl) continue;
    for (const d of resolveDirectories([{ name: decl.name, root, own: true }])) {
      if (!d.own || d.scope === "repository") continue;
      if (!(d.graphTypologies ?? []).includes(kind)) continue;
      if (existsSync(d.absPath)) out.add(resolve(d.absPath));
    }
  }
  return [...out].sort();
}

function walk(dir: string, pred: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, pred));
    else if (pred(e.name)) out.push(p);
  }
  return out.sort();
}

// --- skills -----------------------------------------------------------------

function skills(repo: string, own: ReturnType<typeof owners>): Raw[] {
  const out: Raw[] = [];
  const seen = new Set<string>();
  for (const root of instanceRootsIn(repo)) {
    // A skill that says `published: false` is withheld from the site, and the
    // glossary page is on the site.
    const withheld = unpublishedSkills(root);
    for (const parts of skillMdDirs(root)) {
      const dir = join(root, ...parts);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).sort()) {
        const abs = resolve(join(dir, f));
        if (!f.endsWith(".md") || seen.has(abs) || !isSkillMd(abs)) continue;
        seen.add(abs);
        if (withheld.has(f.slice(0, -3))) continue;
        const instance = ownerOf(abs, own);
        if (!instance) continue;
        const { fm } = parseFrontMatter(readFileSync(abs, "utf-8"));
        const name = scalar(fm, "name") ?? basename(f, ".md");
        const description = scalar(fm, "description");
        out.push({
          instance,
          type: "kg-skills",
          key: name,
          prefLabel: name,
          ...(description ? { definition: fold(description) } : {}),
          notation: name,
          source: posix(relative(repo, abs)),
        });
      }
    }
  }
  return out;
}

// --- tools ------------------------------------------------------------------

function toolsOfRepo(repo: string, own: ReturnType<typeof owners>): Raw[] {
  const d = discoverTools(repo);
  if (d.failures.length) {
    // A Tool graph that did not load is not a Tool graph with no terms.
    throw new Error(`tool discovery failed: ${d.failures.map((f) => `${f.dir ?? f.instance}: ${f.reason}`).join("; ")}`);
  }
  const out: Raw[] = [];
  for (const src of d.sources) {
    const dir = join(repo, src.dir);
    const files = walk(dir, (n) => n.endsWith(".ts") && !n.endsWith(".test.ts"));
    const texts = files.map((f) => [f, readFileSync(f, "utf-8")] as const);
    const instance = ownerOf(dir, own);
    if (!instance) continue;
    for (const t of d.tools) {
      const declaring = texts.find(([, text]) => text.includes(`id: "${t.id}"`) || text.includes(`id: '${t.id}'`));
      if (!declaring) continue; // declared by another source directory
      out.push({
        instance,
        type: "kg-tools",
        key: t.id,
        prefLabel: t.title,
        definition: fold(t.description),
        notation: t.id,
        source: `${posix(relative(repo, declaring[0]))}#${t.id}`,
      });
    }
  }
  return out;
}

// --- BPMN and DMN -----------------------------------------------------------

/** Task-like BPMN elements. None nests another, so an element's body holds only its own documentation. */
const ACTIVITY = /<(?:bpmn:)?(task|userTask|serviceTask|scriptTask|manualTask|businessRuleTask|sendTask|receiveTask|callActivity)\b([^>]*?)(\/?)>/g;

/**
 * BPMN 2.0's global tasks: a layer's shared steps, defined once in the one
 * `.bpmn` that holds no process and called by bare id (owner, 2026-10-20,
 * "a1"/"b1"). They are terms in their own right, and a call to one carries
 * the shared definition — without this the glossary would show the shared
 * steps' entries as undefined, which is the half of the term a reader needs.
 */
const GLOBAL_TASK = /<(?:bpmn:)?(globalTask|globalUserTask|globalScriptTask|globalManualTask|globalBusinessRuleTask)\b([^>]*?)(\/?)>/g;

function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(attrs);
  return m?.[1];
}

/** The text of an element's own `<tag>` child, where its body starts at `from`. */
function childText(xml: string, from: string, tag: string): string | undefined {
  const d = new RegExp(`<(?:bpmn:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:bpmn:)?${tag}>`).exec(from);
  if (!d) return undefined;
  const text = fold(decodeXml(d[1]!));
  return text || undefined;
}

/** The body of `m`'s element, where `m` matched its opening tag in `xml`. */
function elementBody(xml: string, m: RegExpMatchArray): string {
  if (m[3] === "/") return "";
  const start = m.index! + m[0].length;
  const close = new RegExp(`</(?:bpmn:)?${m[1]}>`).exec(xml.slice(start));
  return close ? xml.slice(start, start + close.index) : "";
}

function bpmn(repo: string, own: ReturnType<typeof owners>): Raw[] {
  const out: Raw[] = [];
  for (const dir of ownDirectories(repo, "processes")) {
    // This directory's global tasks first: a call activity below resolves its
    // shared definition from here. Sharing is within one layer (c1), so one
    // pass over the same directory is the whole scope.
    const shared = new Map<string, { name: string; definition?: string }>();
    for (const f of walk(dir, (n) => n.endsWith(".bpmn"))) {
      const xml = readFileSync(f, "utf-8");
      for (const m of xml.matchAll(GLOBAL_TASK)) {
        const id = attr(m[2]!, "id");
        const name = attr(m[2]!, "name");
        if (!id || !name) continue;
        const definition = childText(xml, elementBody(xml, m), "documentation");
        shared.set(id, { name: fold(decodeXml(name)), ...(definition ? { definition } : {}) });
        const instance = ownerOf(f, own);
        if (!instance) continue;
        out.push({
          instance,
          type: "kg-bpmn-activities",
          key: `globalTask.${id}`,
          prefLabel: fold(decodeXml(name)),
          ...(definition ? { definition } : {}),
          notation: id,
          source: `${posix(relative(repo, f))}#${id}`,
        });
      }
    }
    for (const f of walk(dir, (n) => n.endsWith(".bpmn"))) {
      const instance = ownerOf(f, own);
      if (!instance) continue;
      const xml = readFileSync(f, "utf-8");
      const rel = posix(relative(repo, f));
      const proc = /<(?:bpmn:)?process\b[^>]*\sid="([^"]+)"/.exec(xml)?.[1] ?? basename(f, ".bpmn");
      for (const m of xml.matchAll(ACTIVITY)) {
        const id = attr(m[2]!, "id");
        const name = attr(m[2]!, "name");
        if (!id || !name) continue;
        let definition = childText(xml, elementBody(xml, m), "documentation");
        // A call to one of this layer's global tasks reads as the step it
        // shares: the shared text first, then this call's own, which is how
        // `loadProcessModel` composes the step's documentation.
        const g = m[1] === "callActivity" ? shared.get(attr(m[2]!, "calledElement") ?? "") : undefined;
        if (g) definition = [g.definition, definition].filter(Boolean).join(" ") || undefined;
        out.push({
          instance,
          type: "kg-bpmn-activities",
          key: `${proc}.${id}`,
          prefLabel: fold(decodeXml(name)),
          ...(definition ? { definition } : {}),
          notation: id,
          source: `${rel}#${id}`,
        });
      }
    }
  }
  return out;
}

function dmn(repo: string, own: ReturnType<typeof owners>): Raw[] {
  const out: Raw[] = [];
  for (const dir of ownDirectories(repo, "processes")) {
    for (const f of walk(dir, (n) => n.endsWith(".dmn"))) {
      const instance = ownerOf(f, own);
      if (!instance) continue;
      const xml = readFileSync(f, "utf-8");
      const rel = posix(relative(repo, f));
      for (const m of xml.matchAll(/<decision\b([^>]*)>/g)) {
        const id = attr(m[1]!, "id");
        const name = attr(m[1]!, "name");
        if (!id || !name) continue;
        // The decision's OWN description is its first child. The
        // `<description>` elements further down belong to its rules, and
        // borrowing one would define the decision by one of its outcomes.
        const after = xml.slice(m.index! + m[0].length);
        const self = /^\s*(?:<!--[\s\S]*?-->\s*)*<description>([\s\S]*?)<\/description>/.exec(after);
        const definition = self ? fold(decodeXml(self[1]!)) || undefined : undefined;
        out.push({
          instance,
          type: "kg-dmn-decisions",
          key: id,
          prefLabel: fold(decodeXml(name)),
          ...(definition ? { definition } : {}),
          notation: id,
          source: `${rel}#${id}`,
        });
      }
    }
  }
  return out;
}

// --- schema fields ----------------------------------------------------------

function schemaFields(repo: string, own: ReturnType<typeof owners>): Raw[] {
  const out: Raw[] = [];
  const seen = new Set<string>();
  for (const root of instanceRootsIn(repo)) {
    const g = readSchemaGraph(root);
    if (!g) continue;
    for (const d of g.decls) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      if (/\.test\.ts$/.test(d.module)) continue;
      const instance = ownerOf(join(repo, d.module), own);
      if (!instance) continue;
      const stem = basename(d.module).replace(/\.tsx?$/, "");
      for (const f of d.fields) {
        if (!f.paragraph) continue;
        out.push({
          instance,
          type: "kg-schema-fields",
          key: `${stem}.${d.name}.${f.name}`,
          prefLabel: `${d.name}.${f.name}`,
          definition: fold(f.paragraph),
          source: `${d.module}#${d.name}.${f.name}`,
        });
      }
    }
  }
  return out;
}

// --- assembly ---------------------------------------------------------------

/** Every extracted scheme in the repository, sorted by layer then type. */
export function extract(repo: string): Extraction {
  const own = owners(repo);
  const raws = [
    ...skills(repo, own),
    ...toolsOfRepo(repo, own),
    ...bpmn(repo, own),
    ...dmn(repo, own),
    ...schemaFields(repo, own),
  ];
  const groups = new Map<string, Raw[]>();
  for (const r of raws) {
    const k = `${r.instance}\0${r.type}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const schemes: ExtractedScheme[] = [];
  const collisions: string[] = [];
  const keys = [...groups.keys()].sort((a, b) => {
    const [ia, ta] = a.split("\0") as [string, AssetType];
    const [ib, tb] = b.split("\0") as [string, AssetType];
    return ia.localeCompare(ib, "en") || ASSET_TYPES.indexOf(ta) - ASSET_TYPES.indexOf(tb);
  });
  for (const k of keys) {
    const [instance, type] = k.split("\0") as [string, AssetType];
    const byId = new Map<string, Raw>();
    for (const r of groups.get(k)!) {
      const id = localId(r.key);
      const prior = byId.get(id);
      if (prior) {
        collisions.push(`${instance}/${type}: "${id}" from both ${prior.source} and ${r.source}`);
        continue;
      }
      byId.set(id, r);
    }
    const terms: Term[] = [...byId.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([id, r]) => ({
        id,
        prefLabel: r.prefLabel,
        ...(r.definition ? { definition: r.definition } : {}),
        ...(r.notation ? { notation: r.notation } : {}),
        source: r.source,
        status: "candidate" as const,
      }));
    const glossary = GlossarySchema.parse({
      $schema: GLOSSARY_SCHEMA_ID,
      id: type,
      title: `${TITLES[type].title}, extracted (${instance})`,
      description:
        `Candidate terms extracted from ${TITLES[type].what}. Generated by ` +
        "folio-assistant-core/scripts/glossary-extract.ts; not curated, and never hand-edited: " +
        "a person promotes a term by authoring it in a glossary of their own.",
      source: `${TITLES[type].title} of ${instance}`,
      terms,
    });
    schemes.push({ instance, type, glossary });
  }
  return { schemes, collisions };
}
