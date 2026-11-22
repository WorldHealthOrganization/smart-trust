/**
 * The IG API hub: one page listing an IG's API sidecars (JSON Schema,
 * displays, OpenAPI, JSON-LD), each with its artefact and its view page.
 * Built from the artefact index, which already binds every sidecar to its
 * artefact, so there is no second binding rule here (bean `h7ap`).
 *
 * The page is THIN: a shell holding the label and a pointer to its node,
 * `assets/ig-api-hub.json`, which one loader (`assets/ig-api-hub-node.js`)
 * draws (`visualizer-loading`). The same node and loader serve three places:
 *
 * - the docs site (`gen-ig-pages`): the hub page `<page>.md`;
 * - an `igSite` layer's IG site (`stage-ig-sites`): the IG's own hub page
 *   holds the placeholder, and {@link igApiHubNodeFill} fills it;
 * - an IG repository's own site (`ig-repo-site`): {@link writeIgApiHubSite}
 *   writes the page as HTML, in place of the IG's page holding the placeholder.
 *
 * Generic by construction: what the hub is called (the label) and which of the
 * IG's pages is the hub (the one whose source holds the placeholder) come from
 * the layer above or the IG. The defaults are "IG API" and `ig-api.html`.
 * Nothing here may know about WHO (fhir-harness/AGENTS.md).
 *
 * @module fhir-harness/scripts/ig-api-hub
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { igReadScope } from "./ig-read-scope.ts";

import { escHtml, thinPageHtml } from "../../cat-harness-tools/scripts/thin-page.ts";
import { PAGE_MAIN_CLASS } from "../../cat-harness-tools/scripts/page-layout.ts";
import { artifactPageName, type FhirArtifactIndex } from "../schemas/fhir-artifact-index.js";

/** The hub's node and loader, under the served root's `assets/`. */
export const IG_API_HUB_NODE = "assets/ig-api-hub.json";
export const IG_API_HUB_NODE_SCRIPT = "assets/ig-api-hub-node.js";
/** The config block's id on a hub page. */
export const IG_API_HUB_CONFIG_ID = "ig-api-hub";
/** The hub page when no page of the IG's own holds the placeholder. */
export const IG_API_HUB_DEFAULT_PAGE = "ig-api.html";
/** The loader's source. */
export const IG_API_HUB_NODE_LOADER = join(import.meta.dir, "templates", "ig-pages", "ig-api-hub-node.js");

/** The sidecar kinds, in the order the index holds them, and which have a view page. */
export const SIDECAR_KINDS = [
  { key: "schema", label: "JSON Schema", view: true },
  { key: "displays", label: "Displays", view: false },
  { key: "openapi", label: "OpenAPI", view: false },
  { key: "jsonld", label: "JSON-LD", view: true },
] as const;

export interface HubEntry {
  file: string;
  label: string;
  /** Where the file is served, relative to the served root. */
  href: string;
  artefact?: { key: string; page: string };
  view?: string;
}

/**
 * Where a page fetches or links a bound sidecar: `<sidecarBase>/<file>` when
 * the index reads the sidecars from the AST cache commit (`sidecarBase`), else
 * its `localPath`, prefixed by the page's way to the served root (`toRoot`).
 * Undefined for a sidecar held nowhere. Pure.
 */
export function sidecarHref(ix: Pick<FhirArtifactIndex, "sidecarBase">, r: { localPath?: string } | undefined, toRoot = ""): string | undefined {
  if (!r?.localPath) return undefined;
  return ix.sidecarBase ? `${ix.sidecarBase}/${basename(r.localPath)}` : `${toRoot}${r.localPath}`;
}

/** One entry per sidecar the index binds, with its artefact's page and its view page. Pure. */
export function hubEntries(ix: Pick<FhirArtifactIndex, "artifacts" | "sidecarBase">): HubEntry[] {
  const out: HubEntry[] = [];
  for (const a of ix.artifacts ?? []) {
    for (const k of SIDECAR_KINDS) {
      const r = a.sidecars?.[k.key];
      if (!r) continue;
      const href = sidecarHref(ix, r) ?? r.url;
      const file = basename(href);
      out.push({
        file,
        label: k.label,
        href,
        artefact: { key: a.key, page: `artifact/${artifactPageName(a)}.html` },
        ...(k.view && r.localPath ? { view: `artifact/${file}.html` } : {}),
      });
    }
  }
  return out.sort((x, y) => x.file.localeCompare(y.file));
}

/** Whether the index binds any sidecar, so there is a hub to draw. Pure. */
export const hasIgApi = (ix: Pick<FhirArtifactIndex, "artifacts">): boolean => (ix.artifacts ?? []).some((a) => a.sidecars !== undefined && SIDECAR_KINDS.some((k) => a.sidecars?.[k.key]));

/** The hub's JSON-LD node. Every href is relative to the served root. Pure. */
export function igApiHubNode(o: { label: string; entries: readonly HubEntry[]; openapi?: boolean; documents?: readonly string[] }): Record<string, unknown> {
  return {
    "@context": { schema: "https://schema.org/" },
    "@id": IG_API_HUB_NODE,
    "@type": "schema:WebAPI",
    "schema:name": o.label,
    ...(o.openapi ? { "schema:documentation": "openapi/" } : {}),
    "schema:hasPart": o.entries.map((e) => ({
      "@type": "schema:DigitalDocument",
      "schema:name": e.file,
      "schema:additionalType": e.label,
      "schema:contentUrl": e.href,
      ...(e.view ? { "schema:url": e.view } : {}),
      ...(e.artefact ? { "schema:about": { "@id": e.artefact.page, "schema:identifier": e.artefact.key } } : {}),
    })),
    "schema:workExample": [...(o.documents ?? [])].sort().map((d) => ({ "@type": "schema:DigitalDocument", "schema:name": basename(d), "schema:contentUrl": d })),
  };
}

/** The node as the file served at {@link IG_API_HUB_NODE}. */
export function igApiHubNodeJson(ix: Pick<FhirArtifactIndex, "artifacts" | "sidecarBase">, label: string, extra: { openapi?: boolean; documents?: readonly string[] } = {}): string {
  return `${JSON.stringify(igApiHubNode({ label, entries: hubEntries(ix), ...extra }), null, 2)}\n`;
}

/**
 * The hub's body inside a page, for a page at `prefix` from the served root
 * (`""` at the root, `"../"` one level down). The loader resolves the node's
 * hrefs against `prefix` too.
 */
export function igApiHubBody(label: string, prefix: string, openapi = false): string {
  const l = escHtml(label);
  const cfg = JSON.stringify({ node: `${prefix}${IG_API_HUB_NODE}`, base: prefix }).replace(/</g, "\\u003c");
  return [
    `<div class="ig-api-hub ${PAGE_MAIN_CLASS}">`,
    `<p>The ${l}: a JSON Schema, JSON-LD, display and OpenAPI file for the artefacts of this guide, each with its artefact and its view.</p>`,
    openapi ? `<p><a href="${prefix}openapi/">The OpenAPI documentation</a></p>` : "",
    `<div class="ig-api-hub-body" aria-live="polite"><p>Loading the ${l}…</p></div>`,
    `</div>`,
    `<script type="application/json" id="${IG_API_HUB_CONFIG_ID}">${cfg}</script>`,
    `<script src="${prefix}${IG_API_HUB_NODE_SCRIPT}" defer></script>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** The hub as a whole thin HTML page at the served root, for a site with no Jekyll. */
export function igApiHubHtml(label: string, page: string, openapi = false): string {
  return thinPageHtml({
    title: label,
    jsonld: IG_API_HUB_NODE,
    script: IG_API_HUB_NODE_SCRIPT,
    configId: IG_API_HUB_CONFIG_ID,
    config: { node: IG_API_HUB_NODE, base: "" },
    canonical: page,
    layout: "",
    noscriptLead: `The ${escHtml(label)} hub`,
    body:
      `<main class="ig-api-hub ${PAGE_MAIN_CLASS}"><h1>${escHtml(label)}</h1>` +
      `<p>The ${escHtml(label)}: a JSON Schema, JSON-LD, display and OpenAPI file for the artefacts of this guide, each with its artefact and its view.</p>` +
      (openapi ? `<p><a href="openapi/">The OpenAPI documentation</a></p>` : "") +
      `<div class="ig-api-hub-body" aria-live="polite"><p>Loading the ${escHtml(label)}…</p></div></main>`,
  });
}

/**
 * The IG's hub page: the page of its own whose source (`input/pagecontent/*.md`)
 * holds `placeholder`, as `<name>.html`; else {@link IG_API_HUB_DEFAULT_PAGE}.
 */
export function igApiHubPageOf(igSource: string, placeholder: string | undefined): string {
  const pages = join(igSource, "input", "pagecontent");
  const scope = igReadScope(igSource);
  if (placeholder && scope.reaches("input/pagecontent") && existsSync(pages)) {
    for (const f of readdirSync(pages).filter((n) => n.endsWith(".md") && scope.declares(`input/pagecontent/${n}`)).sort()) {
      if (readFileSync(join(pages, f), "utf-8").includes(placeholder)) return `${f.replace(/\.md$/, "")}.html`;
    }
  }
  return IG_API_HUB_DEFAULT_PAGE;
}

/**
 * The fill for an IG site page holding the hub's placeholder (`build-ig-site`
 * fills), drawing the hub from the node. The page is at `prefix` from the
 * served root.
 */
export function igApiHubNodeFill(label: string, marker: string, prefix: string, openapi = false): { marker: string; body: string; data: Record<string, unknown> } {
  return { marker, body: igApiHubBody(label, prefix, openapi), data: {} };
}

/**
 * Write the hub into a built site at its root: the page at `page`, its node
 * and its loader. Returns the files written.
 */
export function writeIgApiHubSite(o: { site: string; ix: Pick<FhirArtifactIndex, "artifacts" | "sidecarBase">; label: string; page: string; openapi?: boolean; documents?: readonly string[] }): string[] {
  mkdirSync(join(o.site, "assets"), { recursive: true });
  writeFileSync(join(o.site, IG_API_HUB_NODE), igApiHubNodeJson(o.ix, o.label, { ...(o.openapi ? { openapi: true } : {}), ...(o.documents ? { documents: o.documents } : {}) }));
  writeFileSync(join(o.site, IG_API_HUB_NODE_SCRIPT), readFileSync(IG_API_HUB_NODE_LOADER, "utf-8"));
  writeFileSync(join(o.site, o.page), igApiHubHtml(o.label, o.page, o.openapi ?? false));
  return [o.page, IG_API_HUB_NODE, IG_API_HUB_NODE_SCRIPT];
}
