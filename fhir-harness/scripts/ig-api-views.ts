/**
 * The IG API VIEW pages — the Publisher's `<Name>.schema.json.html` and
 * `<Name>.jsonld.html` — and the IG API hub, as data for Liquid templates
 * (bean `jut3`, P0).
 *
 * An IG's post-processing may publish machine-readable sidecars per artefact
 * (JSON Schema, displays, OpenAPI, JSON-LD) and a hub page listing them; two
 * of them a reader can open as a page. The Publisher's page for each is a tab
 * bar, a heading, Raw and Download links, and the file. This module computes
 * the page's data; `templates/ig-api-view.liquid` arranges it and Jekyll
 * renders it (`liquid-templates`: computation in the generator, layout in the
 * template). The file itself is fetched in the browser by
 * `templates/ig-api-view.js`, as the Publisher's page does — never baked into
 * the page (bean `680p`).
 *
 * **Generic by construction, and named so (bean `d313`).** Every name here
 * once said which overlay publishes these sidecars today — which, in a layer
 * whose one rule is that it knows nothing of the layers above it, put one
 * overlay's name on a surface any IG may publish. What is an overlay's is now
 * configuration its layers pass: the label (`--sidecar-label`), the hub
 * page's name and markers (ingest flags), and the source placeholder
 * (recorded on the index's `igApiHub.placeholder`). Rendering is still driven entirely by
 * `a.sidecars` being present, so an IG that publishes none gets none of it.
 */
import { readFileSync } from "node:fs";
import { hasJsonView } from "./resource-views.ts";
import { hasIgApi, igApiHubNodeFill, sidecarHref } from "./ig-api-hub.ts";
import { basename } from "node:path";
import { artifactPageName, type FhirArtifact, type FhirArtifactIndex } from "../schemas/fhir-artifact-index.js";
import { declarationPathIn } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { indexReadPath } from "./lib/ig-index-at.ts";

/** The two sidecars the Publisher renders a page for, in its tab order. */
export const IG_API_VIEW_KINDS = [
  { key: "schema", label: "JSON Schema" },
  { key: "jsonld", label: "JSON-LD" },
] as const;

export interface IgApiView {
  /** The file's name (`ValueSet-Actors.schema.json`) — the page is `<file>.html`. */
  file: string;
  /** Repository-relative path of the held copy, from the index. */
  localPath: string;
  label: (typeof IG_API_VIEW_KINDS)[number]["label"];
}

/** The view pages one artefact has: a held schema and/or JSON-LD sidecar. A referenced-only sidecar has no bytes here, so no page. */
export function igApiViews(a: FhirArtifact): IgApiView[] {
  return IG_API_VIEW_KINDS.flatMap(({ key, label }) => {
    const r = a.sidecars?.[key];
    return r?.localPath ? [{ file: basename(r.localPath), localPath: r.localPath, label }] : [];
  });
}

export interface IgApiViewData {
  label: string;
  file: string;
  /** Where the file is fetched from: the SERVED artefact-index graph, relative to the page — never a copy beside it (bean `680p`). */
  src: string;
  artifact: { title: string; page: string };
  tabs: Array<{ label: string; href: string; active: boolean }>;
  /** The shared loader, relative to the page. */
  script: string;
}

/** Where the generator publishes the loader, under the layer's docs root; pages sit one level down in `artifact/`. */
export const IG_API_VIEW_SCRIPT = "assets/ig-api-view.js";

/**
 * Everything one view page shows. Tabs follow the Publisher's order: the
 * artefact's narrative, its JSON, then each IG API view, the current one
 * active. No XML or TTL (owner, 2026-10-09).
 */
/**
 * @param servedFrom the page's path to the layer root's served data — `../`
 *   from `artifact/`, so a `localPath` of `fhir-artifact-index/sidecars/X` is fetched
 *   at `../fhir-artifact-index/sidecars/X`.
 * @param sidecarBase the index's `sidecarBase`: with it the file is fetched
 *   there (the AST cache commit), not from the site.
 */
export function igApiViewData(a: FhirArtifact, view: IgApiView, servedFrom = "../", jsonViews = false, sidecarBase?: string): IgApiViewData {
  const page = `${artifactPageName(a)}.html`;
  // JSON is this site's own view where the Publisher writes one
  // (`resource-views.ts`). No XML or Turtle tab: the site links JSON, JSON-LD,
  // the schema and HTML only (owner, 2026-10-09).
  const reps = (["json"] as const).flatMap((k) => {
    const url = a.published?.[k]?.url;
    if (!url) return [];
    // Only when this site WRITES the JSON view (`jsonViews`: the IG's package
    // is held and served); otherwise the tab would link a page that is not there.
    return [{ label: k.toUpperCase(), href: k === "json" && jsonViews && hasJsonView(a) ? `${page.replace(/\.html$/, "")}.json.html` : url, active: false }];
  });
  return {
    label: view.label,
    file: view.file,
    src: sidecarHref(sidecarBase ? { sidecarBase } : {}, view, servedFrom)!,
    artifact: { title: a.title ?? a.name ?? a.id, page },
    tabs: [
      { label: "Narrative Content", href: page, active: false },
      ...reps,
      ...igApiViews(a).map((v) => ({ label: v.label, href: `${v.file}.html`, active: v.file === view.file })),
    ],
    script: `../${IG_API_VIEW_SCRIPT}`,
  };
}

/**
 * Whether a layer's sidecar files are on the site for a page to fetch: its
 * artefact-index directory is declared `served`, and its docs directory is
 * the composed layer root — so a page one level down reaches the served
 * data as `../<path>` (bean `680p`).
 */
export function igApiServed(instanceRoot: string): { ok: true } | { ok: false; why: string } {
  // Found as the file whose stem equals its own `name`, never as
  // `<directory>.json`: in a separated IG repository the directory may be named
  // for another layer while the declaration keeps its own name (bean `rbz3`).
  const at = declarationPathIn(instanceRoot);
  if (at === undefined) return { ok: false, why: `${basename(instanceRoot)}/ holds no instance declaration` };
  let d: { directories?: { path?: string; graphTypologies?: string[]; served?: boolean; instanceRoot?: boolean; composed?: boolean; igSite?: boolean }[] };
  try {
    d = JSON.parse(readFileSync(at, "utf8"));
  } catch {
    return { ok: false, why: `${basename(at)} could not be read` };
  }
  const dirs = d.directories ?? [];
  const index = dirs.find((x) => x.graphTypologies?.includes("fhir-artifact-index"));
  // declared-path-literal: matches an entry in the STAGED layer's own declaration by its path; no folio-assistant directory is read
  const docs = dirs.find((x) => x.path === "docs/");
  if (!index?.served) return { ok: false, why: "its fhir-artifact-index directory is not declared `served`" };
  // Composed into the main site or built into the IG's own (bean `mftp`): either way the
  // pages sit at the layer root, where `../` from `artifact/` reaches the served data.
  if (!(docs?.instanceRoot && (docs.composed || docs.igSite))) return { ok: false, why: "its docs/ is not the instance root (composed or igSite), so `../` does not reach the served data" };
  return { ok: true };
}

/**
 * The placeholder a hub page's source holds when its index records none —
 * the ingest's own default. An IG whose post-processing uses another marker
 * has it recorded on `igApiHub.placeholder` at ingest, from the
 * `--api-placeholder` its own layer passes.
 */
export const IG_API_PLACEHOLDER = "<!-- IG_API_CONTENT -->";
/**
 * The fill that makes the IG site's own hub page what the Publisher
 * published: its source holds only the placeholder, and the IG's
 * post-processing writes the hub there. Undefined, with nothing
 * filled, when the layer holds no hub or does not serve its graph.
 */
/**
 * `prefix` is where the layer root is from the IG site's root: `"../"` for
 * a site at `/<instance>/ig/`, `""` for one served AT `/<instance>/` (an
 * `igSite` layer, bean `mftp`).
 */
export function igApiHubFill(instanceRoot: string, prefix = "../"): { marker: string; body: string; data: Record<string, unknown> } | undefined {
  let ix: FhirArtifactIndex;
  try {
    ix = JSON.parse(readFileSync(indexReadPath(instanceRoot, "index.json"), "utf8"));
  } catch {
    return undefined;
  }
  if (!igApiServed(instanceRoot).ok) return undefined;
  // The hub holds no copy: it is drawn from the index's bound sidecars (bean `h7ap`).
  return hasIgApi(ix) ? igApiHubNodeFill(ix.igApiHub?.label ?? "IG API", ix.igApiHub?.placeholder ?? IG_API_PLACEHOLDER, prefix) : undefined;
}
