/**
 * The JSON VIEW pages — the Publisher's `<Name>.json.html` — as data for a
 * Liquid template (bean `jut3`, P0; owner 2026-10-01).
 *
 * The Publisher's page is a tab bar, a heading, a status line, Raw and
 * Download links, and the resource as `JSON.stringify(parsed, null, 2)`, which
 * its own script fetches. Ours fetches too, but from the IG's `package.tgz`
 * held in the served artefact-index graph — one archive, cached by the
 * browser, read with a gzip+tar reader in `templates/ig-pages/resource-json.js` —
 * instead of copying 672 resource files (bean `680p`, `visualizer-loading`).
 *
 * Generic: nothing here knows whose IG it is. A caller that renders more tabs
 * (an overlay with views of its own) passes them in.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { artifactPageName, type FhirArtifact } from "../schemas/fhir-artifact-index.js";

/** Where the generator publishes the loader, under the layer's docs root. */
export const JSON_VIEW_SCRIPT = "assets/resource-json.js";

/**
 * Whether the Publisher writes a `<Name>.json.html` for this artefact.
 * Measured on the WHO SMART Trust IG 2026-10-01: every artefact except the
 * ImplementationGuide (no view at all) and StructureDefinitions (which get
 * `.profile.json.html` instead — the profile tabs, a different page kind).
 */
export function hasJsonView(a: FhirArtifact): boolean {
  return a.resourceType !== "ImplementationGuide" && a.resourceType !== "StructureDefinition" && a.published?.json !== undefined;
}

export interface Tab {
  label: string;
  href: string;
  active: boolean;
}

export interface JsonViewData {
  heading: string;
  /** The package, relative to the page, and the entry to read from it. */
  package: string;
  entry: string;
  /** The Publisher's published `.json` — the Raw and Download target. */
  raw: string;
  rawName: string;
  tabs: Tab[];
  script: string;
  /** A one-line description under the heading — a logical model's `.profile.json` page has one. */
  intro?: string;
}

/**
 * @param packagePath the package's instance-relative path (`fhir-artifact-index/package.tgz`)
 * @param extraTabs   tabs after JSON, in the Publisher's order (an overlay's views)
 */
export function jsonViewData(a: FhirArtifact, packagePath: string, extraTabs: Tab[] = []): JsonViewData {
  const stem = artifactPageName(a);
  const pub = (k: "json") => a.published?.[k]?.url;
  const tabs: Tab[] = [
    { label: "Narrative Content", href: `${stem}.html`, active: false },
    { label: "JSON", href: `${stem}.json.html`, active: true },
    ...extraTabs,
  ];
  return {
    heading: `${a.title ?? a.name ?? a.id} - JSON Representation`,
    package: `../${packagePath}`,
    entry: `package/${a.resourceType}-${a.id}.json`,
    raw: pub("json")!,
    rawName: `${stem}.json`,
    tabs,
    script: `../${JSON_VIEW_SCRIPT}`,
  };
}

// ── The IG's package, read at generation time ───────────────────────────────
//
// The tab pages below need a few facts about each resource that the artefact
// index does not carry in the Publisher's terms (its `name`, `experimental`,
// a StructureDefinition's `kind`). They are read from the same package.tgz the
// JSON views fetch — the KG's copy — so the generator and the browser read one
// source.

/** Every `package/*.json` entry of a package.tgz, by entry name. */
export function packageEntries(tgzPath: string): Map<string, Buffer> {
  const buf = gunzipSync(readFileSync(tgzPath));
  const out = new Map<string, Buffer>();
  for (let off = 0; off + 512 <= buf.length; ) {
    const header = buf.subarray(off, off + 512);
    const cstr = (a: number, b: number) => header.subarray(a, b).toString("utf8").replace(/\0.*$/s, "");
    const name = cstr(0, 100);
    if (!name) break;
    const prefix = cstr(345, 500);
    const size = parseInt(cstr(124, 136).trim() || "0", 8);
    const full = prefix ? `${prefix}/${name}` : name;
    if (full.endsWith(".json")) out.set(full, buf.subarray(off + 512, off + 512 + size));
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}

/** The resource facts a tab page states, read from the resource itself. */
export interface ResourceFacts {
  resourceType: string;
  id: string;
  name?: string;
  title?: string;
  status?: string;
  date?: string;
  experimental?: boolean;
  kind?: string;
  url?: string;
}

export function resourceFacts(r: Record<string, unknown>): ResourceFacts {
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : undefined);
  return {
    resourceType: String(r.resourceType),
    id: String(r.id),
    name: str("name"),
    title: str("title"),
    status: str("status"),
    date: str("date"),
    experimental: typeof r.experimental === "boolean" ? r.experimental : undefined,
    kind: str("kind"),
    url: str("url"),
  };
}

/** "<Status> as of <YYYY-MM-DD>", only when the resource carries a date — the Publisher's status line. */
export function statusLine(f: ResourceFacts): string | undefined {
  if (!f.date) return undefined;
  const s = f.status ?? "";
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} as of ${f.date.slice(0, 10)}`;
}

/** A page of the tab family: a heading, an optional status line, then sections of text. */
export interface TabPageData {
  tabs: Tab[];
  heading: string;
  status?: string;
  sections: Array<{ heading?: string; text: string }>;
}

/**
 * The Publisher's tab bar for a resource's pages, with `active` the current one (or none).
 *
 * No XML or TTL tab (owner, 2026-10-09: *"i dont want links to *.xml / *.ttl,
 * only the json(ld)+schema and .html"*). The Publisher wrote both; this site
 * renders neither, so each was an absolute link to a file the site root does
 * not hold -- 4,288 of them on the WHO SMART Trust IG's gh-pages, measured 2026-10-09.
 * JSON-LD and the JSON Schema arrive as `extraTabs` from the IG API views.
 */
export function resourceTabs(a: FhirArtifact, extraTabs: Tab[], jsonLocal: boolean, active?: string): Tab[] {
  const stem = artifactPageName(a);
  const pub = (k: "json") => a.published?.[k]?.url;
  if (a.resourceType === "StructureDefinition") {
    // The SD family's own bar: Content, Mappings, then the representations.
    // No "Detailed Descriptions" (owner, 2026-10-09): it linked the
    // Publisher's `-definitions.html`, which this site does not write -- 67
    // dead links on the WHO SMART Trust IG's gh-pages, measured 2026-10-09.
    const site = pub("json")?.replace(/[^/]*$/, "") ?? "";
    return [
      { label: "Content", href: `${stem}.html`, active: active === "Content" },
      { label: "Mappings", href: jsonLocal ? `${stem}-mappings.html` : `${site}${stem}-mappings.html`, active: active === "Mappings" },
        ...(pub("json") ? [{ label: "JSON", href: jsonLocal ? `${stem}.profile.json.html` : pub("json")!, active: active === "JSON" }] : []),
        ...extraTabs,
    ];
  }
  return [
    { label: "Narrative Content", href: `${stem}.html`, active: false },
    ...(pub("json") ? [{ label: "JSON", href: jsonLocal && hasJsonView(a) ? `${stem}.json.html` : pub("json")!, active: active === "JSON" }] : []),
    ...extraTabs,
  ];
}

/**
 * `<Name>.change.history.html` (and a StructureDefinition's
 * `.profile.history.html`). The Publisher's page states no history — none is
 * exported to it — only a heading and one sentence, measured on all 672 of
 * the WHO SMART Trust IG's: the heading names `name ?? title ?? id`, the sentence `id`.
 */
export function historyPage(a: FhirArtifact, f: ResourceFacts, tabs: Tab[]): TabPageData | undefined {
  if (f.resourceType === "StructureDefinition") {
    if (f.kind !== "logical") return undefined;
    return { tabs, heading: `Logical Model: ${f.name ?? f.id} - Change History`, status: statusLine(f), sections: [{ text: `Changes in the ${f.name ?? f.id} logical model.` }] };
  }
  return { tabs, heading: `${f.name ?? f.title ?? f.id} - Change History`, sections: [{ text: `History of changes for ${f.id} .` }] };
}

/**
 * `<Name>-testing.html`. Written only when the IG holds NO TestPlan and no
 * TestScript (`hasTests` false): the page then states that none is available,
 * which is the Publisher's text. An IG with tests would list them, and this
 * renders no such list — so it writes nothing rather than a page that says
 * "none" over tests that exist.
 */
export function testingPage(f: ResourceFacts, tabs: Tab[], hasTests: boolean): TabPageData | undefined {
  if (hasTests || !f.url || f.resourceType === "ImplementationGuide") return undefined;
  const sd = f.resourceType === "StructureDefinition";
  if (sd && f.kind !== "logical") return undefined;
  const label = sd ? `Logical Model: ${f.name ?? f.id}` : `${f.resourceType}: ${f.title ?? f.name ?? f.id}`;
  const what = sd ? "Profile" : f.resourceType;
  return {
    tabs,
    heading: `${label} - Testing${!sd && f.experimental ? " (Experimental)" : ""}`,
    status: statusLine(f),
    sections: [
      { heading: "Test Plans", text: `No test plans are currently available for the ${what}.` },
      { heading: "Test Scripts", text: `No test scripts are currently available for the ${what}.` },
    ],
  };
}

/** A logical model's `-examples.html`, written only when no resource in the IG claims the model in `meta.profile`. */
export function examplesPage(f: ResourceFacts, tabs: Tab[], hasExamples: boolean): TabPageData | undefined {
  if (f.resourceType !== "StructureDefinition" || f.kind !== "logical" || hasExamples) return undefined;
  return { tabs, heading: `Logical Model: ${f.name ?? f.id} - Examples`, status: statusLine(f), sections: [{ text: "No examples are currently available for the Profile." }] };
}

/** A logical model's `.profile.json.html`: the JSON view, with the SD family's heading and line. */
export function profileJsonViewData(a: FhirArtifact, f: ResourceFacts, packagePath: string, tabs: Tab[]): JsonViewData | undefined {
  if (f.kind !== "logical" || !a.published?.json) return undefined;
  const base = jsonViewData(a, packagePath);
  return {
    ...base,
    heading: `Logical Model: ${f.name ?? f.id} - JSON Profile`,
    intro: `JSON representation of the ${f.name ?? f.id} logical model.`,
    tabs,
  };
}

/** Text safe as markdown prose: the characters kramdown would read as markup are escaped. */
export function mdText(s: string): string {
  return s.replace(/([\\`*_[\]<>|])/g, "\\$1");
}

/**
 * A FHIR description's links, for a page written one level below the IG root.
 *
 * A description is markdown the IG author wrote for the Publisher's pages,
 * which all sit at the IG root, so `[governance](concepts.html)` names a page
 * beside it. An artefact page here sits in `artifact/`, where that link 404s.
 * With a `prefix` (`../`), every relative link is rebased onto the IG root;
 * with `null` (no IG pages exist on this site at all), the link is reduced to
 * its text rather than left to dangle. Absolute links, `../` links, anchors and
 * other schemes are left alone.
 */
export function rebaseDescriptionLinks(md: string, prefix: string | null): string {
  return md.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (all, text: string, target: string) => {
    if (/^[a-z][a-z0-9+.-]*:|^\/|^#|^\.\.\//i.test(target)) return all;
    return prefix === null ? text : `[${text}](${prefix}${target.replace(/^\.\//, "")})`;
  });
}

/**
 * A VIEW page beside an artefact's own page — one per representation, sidecar
 * or tab, never one per artefact. The one rule every count and test reads.
 */
export const VIEW_PAGE = /\.(schema\.json|jsonld|json|change\.history|profile\.history|profile\.json)\.md$|-(testing|examples|mappings)\.md$/;

// ── A logical model's `-mappings.html` ──────────────────────────────────────

export interface MappingsPageData {
  tabs: Tab[];
  heading: string;
  status?: string;
  intro: string;
  /** "Mappings to Structures in this Implementation Guide", then "…to other Structures": each a list of tables, empty → "No Mappings Found". */
  inIg: MappingTable[];
  toOther: MappingTable[];
  /** "Other Mappings": one table per remaining identity. */
  other: MappingTable[];
  legend: string;
}

export interface MappingTable {
  name: string;
  uri?: string;
  rows: Array<{ label: string; depth: number; href?: string; title?: string; value: string }>;
}

/**
 * The mappings page from the StructureDefinition alone — its `mapping`
 * identities and each snapshot element's `mapping` (no core package needed,
 * unlike `-definitions`, whose base-type text is `hl7.fhir.r5.core`'s).
 *
 * Rows as the Publisher writes them, measured on the WHO SMART Trust IG's 5 logical
 * models: every snapshot element; the root by its full name, others by their
 * last path segment, an element's `id` child as `@id`, a slice as
 * `name:slice`; the value is that element's maps for the identity, joined.
 *
 * @param igStructures canonical URLs of the IG's own StructureDefinitions —
 *   an identity whose URI is one of them maps to "this IG".
 * @param definitionsHref where an element's definition is, by its path; omitted,
 *   a row's label is plain text. The site passes none (owner, 2026-10-09): the
 *   Publisher's `-definitions.html` it used to link is not written here.
 */
export function mappingsPage(
  sd: Record<string, unknown>,
  f: ResourceFacts,
  tabs: Tab[],
  igStructures: ReadonlySet<string>,
  definitionsHref?: (path: string) => string,
): MappingsPageData | undefined {
  if (f.kind !== "logical") return undefined;
  const identities = (sd.mapping as Array<{ identity: string; uri?: string; name?: string }> | undefined) ?? [];
  const elements = ((sd.snapshot as { element?: Array<Record<string, unknown>> } | undefined)?.element ?? []);
  const table = (m: { identity: string; uri?: string; name?: string }): MappingTable => ({
    name: m.name ?? m.identity,
    uri: m.uri,
    rows: elements.map((e) => {
      const path = String(e.path);
      const segs = path.split(".");
      const last = segs[segs.length - 1]!;
      const label = segs.length === 1 ? path : last === "id" && segs.length > 2 ? "@id" : e.sliceName ? `${last}:${e.sliceName}` : last;
      const maps = ((e.mapping as Array<{ identity: string; map: string }> | undefined) ?? []).filter((x) => x.identity === m.identity).map((x) => x.map);
      return { label, depth: segs.length - 1, ...(definitionsHref ? { href: definitionsHref(path) } : {}), title: typeof e.short === "string" ? e.short : undefined, value: maps.join(", ") };
    }),
  });
  const inIg = identities.filter((m) => m.uri && igStructures.has(m.uri));
  const toOther = identities.filter((m) => !inIg.includes(m) && m.uri?.startsWith("http://hl7.org/fhir/StructureDefinition/"));
  const other = identities.filter((m) => !inIg.includes(m) && !toOther.includes(m));
  const name = f.name ?? f.id;
  return {
    tabs,
    heading: `Logical Model: ${name} - Mappings`,
    status: statusLine(f),
    intro: `Mappings for the ${name} logical model.`,
    inIg: inIg.map(table),
    toOther: toOther.map(table),
    other: other.map(table),
    legend: "https://build.fhir.org/ig/FHIR/ig-guidance/readingIgs.html#table-views",
  };
}
