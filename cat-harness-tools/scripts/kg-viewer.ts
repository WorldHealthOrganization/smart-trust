#!/usr/bin/env bun
/**
 * A page that makes the published knowledge graph legible.
 *
 * ## Generated, not committed
 *
 * The page fetches the graph document, which is named after the repository
 * (`<stub>.jsonld`). The exporter already knows the stub and writes it in, so
 * the page neither hardcodes one layer's stub nor composes a name at
 * runtime.
 *
 * It fetches the graph **relative to its own location**, so the same bytes work
 * at `<canonical>/<stub>/` and at `branches/<slug>/<stub>/` with no
 * configuration.
 *
 * **The graph is found from the SITE ROOT, never as a neighbour.** The page
 * climbs to the root and descends the document's own path, `exportIdentity`'s
 * `docPath` (currently `<base>/<name>/<stub>.jsonld`, beside its subjects).
 * The viewer's own route is separate (`kgViewerRoute`), so neither is written
 * here as an assumption about the other.
 *
 * ## No dependencies, and no force-directed graph
 *
 * **No CDN, no framework, no build step**: one HTML file that opens from disk,
 * can be reviewed offline, and adds no third party to the trust boundary.
 *
 * A graph of this size renders as a hairball when force-directed. The
 * questions people bring — what is this node, what does it point at, what
 * points at it, what else is of this kind — are answered by a faceted index
 * with a detail panel, and by a ONE-HOP neighbourhood diagram for the
 * selected node.
 *
 * ## The viewer reports the graph's own gaps
 *
 * `undeclaredTerms` is rendered, and every property the `@context` does not
 * declare is marked in the detail panel, since a JSON-LD processor silently
 * drops them.
 *
 * ## The chrome is translated; the graph is not, and the page says so
 *
 * Every word the viewer itself says is lifted into `scripts/kg-viewer-strings.ts`
 * and extracted from THERE, never from this page's generated HTML.
 *
 * Each locale's `translations/<locale>/kg-viewer.po` is read at generate time
 * and embedded, so the page still fetches nothing but its own graph document.
 * The reader's language comes from a "lang" query parameter, then the
 * "fa-locale" key the docs site writes, then the browser.
 *
 * **The graph's own words are NOT translated.** Node titles, descriptions and
 * property names arrive in whatever language the corpus is written in, and
 * the page says so on screen, in the reader's language.
 *
 * @covers none — a page writer, not an audit of a declared graph
 * @module scripts/kg-viewer
 */
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { visualiserRoute } from "../schemas/kg/visualiser-route.js";
import { redirectStub } from "./compose-docs.ts";
import { exportIdentity } from "./kg-export.js";
import { instanceDocPath } from "./instance-exports.js";
import { SUBJECT_KINDS } from "./lib/subject-iri.ts";
import {
  UI_STRINGS,
  loadCatalogues,
  plannedLocales,
  type LocaleCatalogue,
  type PlannedLocale,
} from "./kg-viewer-strings.js";
import { siteDirFor } from "../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { siteTarget } from "./lib/site-target.ts";
import { pageParts } from "./viewer-declarations.ts";

const ROOT = join(HARNESS_ROOT);

/**
 * The viewer's id among the harness's visualisers: the page is a viewer of the
 * whole graph, so it is published at a viewer's route,
 * `<locale>/<stub>/kg/`, and `<stub>/` is left to the layer as itself.
 * Owner, 2026-10-20, on the collision of the two at `<base>/<stub>/`:
 * "move graph viewer so aligns" (folio-assistant bean `o7eq`).
 */
export const KG_VISUALISER = "kg";

/** The site-relative directory the viewer is published in, `en/<stub>/kg/`. */
export function kgViewerRoute(stub: string): string {
  return visualiserRoute(pageParts({ harness: stub, visualiser: KG_VISUALISER }));
}

/** The relative way from a site-relative directory back to the site root: one `../` per segment. */
export function upFrom(route: string): string {
  return "../".repeat(route.split("/").filter(Boolean).length);
}

/**
 * Write the viewer at its route under `site`, and a forwarding page at the
 * address it had until 2026-10-20, `<stub>/` — unless a page is already there,
 * which is the layer's own page and wins (the same refusal
 * `writeForwardingPages` makes).
 */
export function writeViewer(
  site: string,
  stub: string,
  html = (up: string) => viewerHtml(stub, undefined, undefined, up),
): { page: string; forwarded?: string } {
  const route = kgViewerRoute(stub);
  const page = join(site, route, "index.html");
  mkdirSync(dirname(page), { recursive: true });
  writeFileSync(page, html(upFrom(route)));
  const old = join(site, stub, "index.html");
  if (existsSync(old) || existsSync(join(site, stub, "index.md"))) return { page };
  mkdirSync(dirname(old), { recursive: true });
  writeFileSync(old, redirectStub(`${upFrom(`${stub}/`)}${route}`));
  return { page, forwarded: old };
}

/**
 * JSON for a page that is ONE TEMPLATE LITERAL.
 *
 * A translated string is text somebody else wrote, and three sequences in it
 * would end the literal or escape the script: a backtick, a dollar-brace
 * interpolation, and a closing script tag. `JSON.stringify` escapes none of
 * them. Neither is typed literally here — each is matched by code point, for
 * the same reason the rest of this file carries no backtick.
 */
function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/\u0060/g, "\\u0060")
    .replace(/\u0024\{/g, "\\u0024{")
    .replace(/<\/(script)/gi, "<\\/$1");
}

/**
 * The page, with the graph document's filename written in.
 *
 * `stub` is the ONLY thing interpolated. Everything else is static, so the
 * generated file is reviewable as a diff rather than as a template.
 *
 * ## NO BACKTICKS BELOW THIS LINE
 *
 * The whole page is one template literal, so a backtick anywhere inside it —
 * including inside a CSS or JS comment — ends the string and produces a wall
 * of syntax errors far from the cause. I did this three times writing the
 * accessibility pass, quoting `color: #fff`, then `nested-interactive`, then
 * `float: right`. `tsc` catches it immediately every time, which is why it is
 * cheap rather than dangerous, but it is still a cycle each time. Write
 * identifiers in comments bare or in double quotes.
 */
export function viewerHtml(
  stub: string,
  catalogues: LocaleCatalogue[] = loadCatalogues(ROOT),
  planned: PlannedLocale[] = plannedLocales(ROOT),
  up = "../",
  // Site-relative. Every layer's document, the host's included, sits at
  // `<name>/<stub>.jsonld` since 2026-10-23 (litlfred/cat-harness-tools#603,
  // decision 1b) — `exportIdentity`'s `docPath`, which the CLI passes.
  docPath = instanceDocPath({ name: stub, stub }),
): string {
  const doc = `${up}${docPath}`;

  // English is not a catalogue — it is the msgid, so every string is present
  // by definition and a lookup that misses falls back to it. It heads the
  // list so the switcher always offers a way back to the source language,
  // even in a checkout with no translations at all.
  const locales = [
    {
      locale: "en",
      name: "English",
      dir: "ltr",
      official: true,
      translated: UI_STRINGS.length,
      total: UI_STRINGS.length,
    },
    ...catalogues.map((c) => ({
      locale: c.locale,
      name: c.name,
      dir: c.dir,
      official: c.official,
      translated: c.translated,
      total: UI_STRINGS.length,
    })),
  ];
  const strings = Object.fromEntries(catalogues.map((c) => [c.locale, c.strings]));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${stub} — knowledge graph</title>
<style>
  /*
   * Every pair below is MEASURED against WCAG 1.4.3 (4.5:1 for text) rather
   * than chosen by eye. The numbers are in the comments so a later edit can
   * see what it is spending.
   *
   * --on-accent exists because of a defect this palette shipped with: the
   * selected facet drew "color: #fff" on --accent, which is 5.97:1 in light
   * and **2.19:1 in dark**, where the accent is a LIGHT green. One value
   * written for one scheme and never rechecked in the other. Text on the
   * accent is now a token per scheme, not a literal.
   */
  :root {
    --bg: #fbfbfa; --fg: #1a1a18; --dim: #6b6b64; --line: #e0e0da;
    --panel: #ffffff; --accent: #4a6b52; --accent-bg: #edf3ee; --warn: #8a5a00;
    --warn-bg: #fdf4e3;
    --on-accent: #ffffff;      /* 5.97 on --accent */
    --on-accent-dim: #e3eae5;  /* 4.88 on --accent */
    --focus: #1a5fb4;          /* 6.07 on --bg */
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #17181a; --fg: #e8e8e4; --dim: #9a9a92; --line: #2e3033;
      --panel: #1e2022; --accent: #8fb99a; --accent-bg: #232b25; --warn: #d9a441;
      --warn-bg: #2a2418;
      --on-accent: #17181a;      /* 8.10 on --accent — DARK text on a light accent */
      --on-accent-dim: #26302a;  /* 6.22 on --accent */
      --focus: #e8a33d;          /* 8.24 on --bg */
    }
  }
  :root[data-theme="dark"] {
    --bg: #17181a; --fg: #e8e8e4; --dim: #9a9a92; --line: #2e3033;
    --panel: #1e2022; --accent: #8fb99a; --accent-bg: #232b25; --warn: #d9a441;
    --warn-bg: #2a2418; --on-accent: #17181a; --on-accent-dim: #26302a;
    --focus: #e8a33d;
  }

  /*
   * A visible focus ring, on every interactive thing, in both schemes.
   *
   * The default UA outline was what this page relied on, and it was never
   * checked against the accent backgrounds a focused control can sit on. A
   * keyboard user who cannot see where they are cannot use the page at all.
   */
  :where(a, button, input, [tabindex]):focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* Reachable by keyboard, out of the way otherwise. */
  .visually-hidden {
    position: absolute; width: 1px; height: 1px; margin: -1px;
    padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  .skip {
    position: absolute; left: 8px; top: -44px; z-index: 10;
    background: var(--panel); color: var(--fg); border: 1px solid var(--line);
    padding: 8px 14px; border-radius: 6px; text-decoration: none;
    transition: top .12s;
  }
  .skip:focus { top: 8px; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  header { padding: 14px 16px; border-bottom: 1px solid var(--line); }
  h1 { margin: 0 0 2px; font-size: 17px; font-weight: 600; }
  .meta { color: var(--dim); font-size: 12.5px; }
  .meta code { font-size: 12px; }
  /* 24px is the SC 2.5.8 floor; these sit in a dense header line where the
     text is 12.5px, so the box is what carries the target rather than the
     glyphs. */
  .meta a { display: inline-flex; align-items: center; min-height: 24px; padding: 0 2px;
            color: var(--accent); text-underline-offset: 2px; }
  /*
   * The language switcher, and the note that says where the translation stops.
   *
   * Each button carries a language's name IN THAT LANGUAGE, which is what a
   * reader looking for one is looking for -- so the control needs no label of
   * its own per button, and there is no accessible name to get wrong in a
   * language nobody here reads. 32px like the facets: the floor is 24, and
   * this instance's declared interaction profile is low-dexterity.
   *
   * --fg on --panel is 17.3:1 in light and 13.3:1 in dark; the pressed state
   * is --on-accent on --accent, the pair already measured above.
   */
  .langs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
  .langs[hidden] { display: none; }
  .lang { display: inline-flex; align-items: center; min-height: 32px; padding: 2px 11px;
          border: 1px solid var(--line); border-radius: 5px; background: var(--panel);
          color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; }
  .lang:hover { background: var(--accent-bg); }
  .lang[aria-pressed="true"] { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
  /*
   * A planned language (bean w6fu): still a 32px target, still focusable, but
   * dashed and dimmed so it does not read as a choice. --dim on --bg is the
   * pair the meta line already uses. The hover tint is removed, because a
   * hover change is how a pointer user is told "this does something".
   */
  .lang.planned { background: transparent; color: var(--dim); border-style: dashed; cursor: default; }
  .lang.planned:hover { background: transparent; }
  .langs-why { align-self: center; font-size: 12.5px; color: var(--dim); }
  .langs-why[open] { flex-basis: 100%; }
  .langs-why > summary { display: inline-flex; align-items: center; min-height: 32px; padding: 0 4px;
                         cursor: pointer; color: var(--accent); text-underline-offset: 2px; }
  .langs-why > summary:hover { text-decoration: underline; }
  /* inline-flex drops the UA disclosure marker, so the state is drawn here:
     a toggle that does not show whether it is open is half a toggle. */
  .langs-why > summary::-webkit-details-marker { display: none; }
  .langs-why > summary::before { content: "ⓘ ▸"; margin-inline-end: 5px; }
  .langs-why[open] > summary::before { content: "ⓘ ▾"; }
  .langs-why > p { margin: 2px 0 0; color: var(--fg); max-width: 78ch; }
  .boundary { background: var(--panel); border: 1px solid var(--line); color: var(--fg);
              padding: 8px 11px; border-radius: 6px; font-size: 12.5px;
              margin: 10px 0 0; max-width: 78ch; }
  main { display: grid; grid-template-columns: 210px minmax(0,1fr) minmax(0,1.15fr); gap: 0; align-items: start; }
  @media (max-width: 860px) { main { grid-template-columns: 1fr; } .facets { border-right: none !important; } }
  .facets, .list, .detail { padding: 14px 16px; }
  .facets, .list { border-right: 1px solid var(--line); }
  h2 { font-size: 11px; letter-spacing: .09em; text-transform: uppercase; color: var(--dim); margin: 0 0 8px; font-weight: 600; }
  /*
   * 32px, not the 24px WCAG 2.2 SC 2.5.8 floor.
   *
   * The floor is a floor. This instance's declared interaction profile is
   * low-dexterity (cat-harness/memory/interaction.json), so a target that is *barely*
   * legal is a target that is hard to hit. 32px costs eight pixels of density
   * in a column that has room for it.
   */
  .facet { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
           background: none; border: 0; color: inherit; font: inherit;
           padding: 4px 8px; min-height: 32px; border-radius: 5px; cursor: pointer; }
  .facet:hover { background: var(--accent-bg); }
  .facet[aria-pressed="true"] { background: var(--accent); color: var(--on-accent); }
  .facet .n { margin-left: auto; color: var(--dim); font-variant-numeric: tabular-nums; font-size: 12.5px; }
  .facet[aria-pressed="true"] .n { color: var(--on-accent-dim); }
  input[type=search] { width: 100%; padding: 6px 9px; border: 1px solid var(--line);
                       border-radius: 6px; background: var(--panel); color: inherit; font: inherit; }
  ol { list-style: none; margin: 10px 0 0; padding: 0; max-height: 72vh; overflow-y: auto; }
  ol li button { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
                 background: none; border: 0; color: inherit; font: inherit;
                 padding: 4px 8px; min-height: 32px; border-radius: 5px; cursor: pointer; }
  ol li button:hover { background: var(--accent-bg); }
  ol li button[aria-current="true"] { background: var(--accent); color: var(--on-accent); }
  .kind { color: var(--dim); font-size: 12px; }
  ol li button[aria-current="true"] .kind { color: var(--on-accent-dim); }
  .detail { max-height: 88vh; overflow-y: auto; }
  .detail h3 { margin: 0 0 3px; font-size: 16px; }
  .iri { font-family: var(--fa-font-mono,Menlo,Consolas,monospace); font-size: 11.5px;
         color: var(--dim); word-break: break-all; margin-bottom: 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
  th, td { text-align: left; vertical-align: top; padding: 4px 8px 4px 0; border-bottom: 1px solid var(--line); }
  th { width: 33%; font-weight: 500; color: var(--dim); white-space: nowrap; }
  td { word-break: break-word; }
  /*
   * An edge is a control, and it was 17px tall. axe flagged five of them per
   * node view under SC 2.5.8; min-height plus the inline-flex box gives each
   * one a real 28px target without changing how the table reads.
   */
  .link { display: inline-flex; align-items: center; min-height: 28px; background: none;
          border: 0; padding: 0 2px; font: inherit; color: var(--accent); text-align: left;
          cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
  /* A plain link in the detail pane (an IRI that is not a node here, a source
     commit, a spec URL) had NO colour rule, so the browser drew its default
     #0000EE on --bg in dark: unreadable (owner, 2026-09-27, on typeIri
     "ProcessGraph"). The same accent the edges and the header links use. */
  td a { color: var(--accent); text-underline-offset: 2px; }
  /* A link that LEAVES this page says so (bean yhcq, finding 4). The colour
     alone used to be the only difference between an in-graph edge (a button
     that stays here) and an IRI (a navigation away), and since ce6152624 the
     two share a colour, so nothing said it. An arrow for every outbound link,
     and words for one into another graph, where the short id hides that. */
  td a[href]::after { content: " \\2197"; font-size: .85em; }
  .elsewhere { color: var(--dim); font-size: 12px; }
  /* 28px tall like the edges: a 13px line alone is under the 24px floor
     (SC 2.5.8), and this instance's profile is low-dexterity. */
  .crumb { display: inline-flex; align-items: center; min-height: 28px; font-size: 13px; margin: 0 0 2px;
           color: var(--accent); text-underline-offset: 2px; }
  .undeclared { color: var(--warn); }
  .undeclared::after { content: " ⚠"; }
  .note { background: var(--warn-bg); border: 1px solid var(--warn); color: var(--warn);
          padding: 9px 11px; border-radius: 6px; font-size: 12.5px; margin: 0 0 14px; }
  .note strong { color: inherit; }
  svg { display: block; margin: 14px 0 4px; max-width: 100%; height: auto; }
  svg text { font: 11px ui-sans-serif, system-ui, sans-serif; fill: var(--fg); }
  svg line { stroke: var(--line); stroke-width: 1.5; }
  svg circle { fill: var(--panel); stroke: var(--accent); stroke-width: 1.5; }
  svg circle.self { fill: var(--accent); }
  /* The whole group is the control: a generous invisible hit area, a visible
     dot, and its label — so pointer and keyboard reach the same thing. */
  svg .hit { fill: transparent; stroke: none; cursor: pointer; }
  svg .node { cursor: pointer; }
  svg .node:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
  svg .node:hover circle:not(.hit) { fill: var(--accent-bg); }
  .empty { color: var(--dim); font-style: italic; }
  details > summary { cursor: pointer; color: var(--accent); }
  details > summary code { color: var(--dim); }
  details[open] > summary { margin-bottom: 4px; }
  pre { margin: 0; padding: 8px 10px; background: var(--bg); border: 1px solid var(--line);
        border-radius: 5px; overflow-x: auto; font-size: 12px; line-height: 1.45; max-height: 300px; }
</style>
</head>
<body>
<!-- A keyboard user lands on the facet column first and would otherwise tab
     through a dozen filters to reach the results. -->
<a class="skip" id="skip" href="#list">Skip to results</a>
<header>
  <!-- The way back (bean yhcq, finding 8). The page is reached from the docs
       navbar and carries none of its chrome, so returning depended on the
       browser's Back button. The site root, reached relatively: the same
       reasoning as DOC, so it is right under branches/<slug>/ too. -->
  <a class="crumb" id="home" href="${up}">&larr; <bdi id="home-t">Docs site</bdi></a>
  <h1 id="title">${stub} — knowledge graph</h1>
  <div class="meta" id="meta">loading <code>${doc}</code>…</div>
  <!-- One button per language that has a catalogue, plus a DISABLED one per
       language whose catalogue is still empty, with the reason beside them
       (bean w6fu). Drawn only when there is more than English to show or to
       promise: a switcher with one option and nothing planned is furniture. -->
  <div class="langs" id="langs" role="group" aria-label="Interface language" hidden></div>
  <!-- Where the translation stops. Hidden in English, because in English
       there is no boundary to draw. -->
  <p class="boundary" id="boundary" hidden></p>
  <p class="visually-hidden" id="langstatus" role="status" aria-live="polite"></p>
</header>
<main>
  <nav class="facets" aria-labelledby="facets-h">
    <h2 id="facets-h">Kind</h2>
    <div id="facets" role="group" aria-labelledby="facets-h"></div>
    <h2 id="subs-h" style="margin-top:18px">Subgraph</h2>
    <div id="subs" role="group" aria-labelledby="subs-h"></div>
  </nav>
  <div class="list">
    <h2 id="list-h">Nodes</h2>
    <!-- A real label, not a placeholder. A placeholder IS the accessible name
         until the moment somebody types, and then the field has none. -->
    <label class="visually-hidden" id="q-label" for="q">Search nodes by name, id or description</label>
    <input type="search" id="q" placeholder="search name, id, title…" autocomplete="off">
    <ol id="list" tabindex="-1" aria-labelledby="list-h"></ol>
    <p class="visually-hidden" id="count" role="status" aria-live="polite"></p>
  </div>
  <!--
    aria-live, because selecting a node rewrites this panel in place. Without
    it a screen-reader user activates an edge and is told nothing at all: the
    page changed and their cursor did not move.
  -->
  <div class="detail" id="detail" role="region" aria-live="polite" aria-label="Selected node">
    <p class="empty">Select a node.</p>
  </div>
</main>
<script>
"use strict";
// The document is a SIBLING of this page — never an absolute URL and never a
// composed one. The same bytes therefore work at the canonical base and under
// branches/<slug>/ with no configuration.
const DOC = ${JSON.stringify(doc)};
const STUB = ${JSON.stringify(stub)};
const SUBJECT_KINDS = ${JSON.stringify(SUBJECT_KINDS)};

/*
 * The chrome's words, per language.
 *
 * Extracted from scripts/kg-viewer-strings.ts and translated in
 * translations/<locale>/kg-viewer.po, both read when this page is GENERATED,
 * so the page still fetches nothing but its own graph document.
 *
 * The msgid IS the English text, so a string a catalogue does not carry falls
 * back to English by itself -- per string, not per page. A catalogue that is
 * half written shows the half it has.
 */
const STRINGS = ${safeJson(strings)};
const LOCALES = ${safeJson(locales)};
// Languages with a catalogue that translates nothing yet (bean w6fu). Drawn
// DISABLED beside the real choices, so a reader can see a translation is
// planned; never selectable, because the page cannot show them. Computed from
// each catalogue's contents when the page is generated, so the first
// translated string moves a language from here into LOCALES by itself.
const PLANNED = ${safeJson(planned)};
// The SAME key the docs site writes (docs/assets/js/docs-ui.js), so a reader
// who chose a language there arrives here in it. A second key would be a
// second answer to one question.
const LOCALE_KEY = "fa-locale";

const el = (id) => document.getElementById(id);
let G = [], byId = new Map(), backlinks = new Map(), declared = new Set(),
    linkTerms = new Set(), kind = null, sub = null, sel = null, undeclared = null,
    counts = {}, loaded = null, loadError = null, preview = false, LOC = "en";

// A Tool is its own document, \`<dir>/tools/<id>.jsonld\` (bean \`tdir\`), not a
// fragment, so it is shortened to the \`tool/<id>\` its fragment used to read.
// A subject is a path since #603, \`<doc dir>/<kind>/<id>\`, and a flow
// \`…/process/P#flow/F\`: both read as the \`<kind>/<id>\` the fragment did.
const SUBJECT_AT = new RegExp("/((?:" + SUBJECT_KINDS.join("|") + ")/[^]*)$");
const short = (iri) => {
  const s = String(iri);
  const t = /\\/tools\\/([^/]+)\\.jsonld$/.exec(s);
  if (t) return "tool/" + decodeURIComponent(t[1]);
  const m = SUBJECT_AT.exec(s);
  if (m) return m[1].replace("#flow/", "/flow/");
  if (s.includes("#")) return s.split("#").pop();
  return s;
};
const typeOf = (n) => short(n["@type"] ?? "").split("/").pop();
/**
 * Which DECLARED SUBGRAPH a node belongs to, as the id a reader filters by.
 *
 * 'inSubgraph' is a link to a Directory node, so the readable id is its
 * fragment. A node with no stamp answers UNSTAMPED rather than being folded
 * into a default: vocabulary nodes are minted from the namespace rather than
 * from any file, so they genuinely belong to no directory, and showing that as
 * its own facet keeps the gap visible instead of absorbing it into whichever
 * subgraph happened to be first.
 */
const UNSTAMPED = "(no declared subgraph)";
const subOf = (n) => {
  const v = n.inSubgraph;
  if (typeof v !== "string" || v.length === 0) return UNSTAMPED;
  return String(v).split("/").pop();
};
const label = (n) => n.title ?? n.name ?? n.localId ?? short(n["@id"]);

const localeMeta = (loc) => LOCALES.filter((l) => l.locale === loc)[0] ?? LOCALES[0];
const known = (loc) => loc === "en" || Object.prototype.hasOwnProperty.call(STRINGS, loc);

/**
 * One of the page's own strings, in the reader's language, with its
 * placeholders filled. An untranslated string returns its English self, which
 * is what a msgid IS.
 */
function T(s, vars) {
  const c = STRINGS[LOC] ?? {};
  let out = Object.prototype.hasOwnProperty.call(c, s) ? c[s] : s;
  if (vars) {
    for (const k of Object.keys(vars)) out = out.split("{" + k + "}").join(String(vars[k]));
  }
  return out;
}

/**
 * The same, where a slot holds MARKUP rather than text.
 *
 * The sentence is escaped FIRST and the fragments substituted after, so a
 * filename can still sit in a code element while nothing a catalogue carries
 * can introduce an element of its own.
 */
function fill(s, frags) {
  let out = escape(s);
  for (const k of Object.keys(frags)) out = out.split("{" + k + "}").join(frags[k]);
  return out;
}

/**
 * Which language to open in.
 *
 * The query parameter first, because it is what a link carries and what a
 * reader pasted; then the choice they saved on the docs site; then what their
 * browser asks for. Never a language this page cannot actually show: a locale
 * with no catalogue is not offered and not selected.
 */
function chooseLocale() {
  let asked = null;
  try { asked = new URLSearchParams(window.location.search).get("lang"); } catch (e) { asked = null; }
  if (asked && known(asked)) return asked;
  let saved = null;
  try { saved = window.localStorage.getItem(LOCALE_KEY); } catch (e) { saved = null; }
  if (saved && known(saved)) return saved;
  const prefs = navigator.languages ?? [navigator.language ?? "en"];
  for (const tag of prefs) {
    const base = String(tag).split("-")[0];
    if (known(base)) return base;
  }
  return "en";
}

function setLocale(loc) {
  LOC = loc;
  try { window.localStorage.setItem(LOCALE_KEY, loc); } catch (e) { /* private window */ }
  // Bookmarkable, and shareable to somebody whose browser asks for something
  // else. replaceState rather than push: a language is not a place, and a
  // reader pressing Back should leave the page rather than retrace languages.
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("lang", loc);
    window.history.replaceState(null, "", u.toString());
  } catch (e) { /* no history to write to, e.g. an opened file */ }
  renderAll();
  // The whole page was just rewritten and the reader's cursor did not move.
  el("langstatus").textContent = T("Interface language: {language}", { language: localeMeta(loc).name });
}

/**
 * Every word the page says, redrawn in the current language.
 *
 * Chrome first, then whatever state the document is in. A failed load draws
 * NO facets and NO list: an empty index and an unreadable document look
 * identical on screen and mean opposite things.
 */
function renderAll() {
  applyChrome();
  drawLangs();
  // renderMeta() is NOT optional and is NOT chrome. It was dropped from here
  // when the Subgraph facet's heading was added, and the page then sat on
  // "loading …" forever with the document loaded, 1687 nodes in hand, no
  // console error and no failed request -- the provenance line simply never
  // got its second call. Nine e2e tests said so; a local run that piped the
  // suite through a pager hid the exit code and said nothing.
  renderMeta();
  if (loadError !== null) { renderDetail(); return; }
  if (loaded === null) return;
  drawFacets();
  drawList();
  renderDetail();
}

function applyChrome() {
  const root = document.documentElement;
  root.setAttribute("lang", LOC);
  // Arabic reads right to left, and a frame that does not turn with it is a
  // translation of the words only.
  root.setAttribute("dir", localeMeta(LOC).dir);
  const heading = T("{stub} — knowledge graph", { stub: STUB }) + (preview ? " " + T("(preview)") : "");
  el("title").textContent = heading;
  document.title = heading;
  el("skip").textContent = T("Skip to results");
  el("home-t").textContent = T("Docs site");
  el("facets-h").textContent = T("Kind");
  el("subs-h").textContent = T("Subgraph");
  el("list-h").textContent = T("Nodes");
  el("q-label").textContent = T("Search nodes by name, id or description");
  el("q").setAttribute("placeholder", T("search name, id, title…"));
  el("detail").setAttribute("aria-label", T("Selected node"));
  el("langs").setAttribute("aria-label", T("Interface language"));
  drawBoundary();
}

/**
 * Where the translation stops, said on the page rather than left to be
 * inferred from a half-English screen.
 *
 * The chrome is translated; the graph is not, and it cannot be from here --
 * node names, descriptions and property names arrive in the document in the
 * language the corpus was written in. In English there is no boundary to
 * draw, so nothing is shown.
 */
function drawBoundary() {
  const b = el("boundary");
  const m = localeMeta(LOC);
  if (LOC === "en") { b.hidden = true; b.textContent = ""; return; }
  let text = T(
    "The interface is shown in {language}. The graph itself — node names, " +
    "descriptions and property names — comes from this repository and is shown " +
    "as written, in English.",
    { language: m.name });
  if (!m.official) {
    text += " " + T("This interface translation was produced by an agent and has not been reviewed by a person.");
  }
  b.textContent = text;
  b.hidden = false;
}

/**
 * One button per language with a catalogue, each labelled in ITS OWN language
 * -- which is what a reader looking for that language is looking for, and
 * which leaves no accessible name to get wrong in a language nobody here
 * reads.
 *
 * Languages that are PLANNED -- a catalogue exists and translates nothing yet
 * -- are drawn too, disabled (owner's ruling 2026-10-02, bean w6fu), so a
 * reader can see a translation is coming rather than concluding there will
 * never be one. Four things make "disabled" accessible rather than merely
 * grey:
 *
 *  - aria-disabled, NOT the disabled attribute. A disabled button leaves the
 *    tab order, so a keyboard or screen-reader user would never learn the
 *    language is planned; this one stays focusable and is announced as
 *    unavailable.
 *  - a VISIBLE reason, "Translations coming", on the line itself -- never in a
 *    title tooltip, which a phone cannot show and a keyboard cannot open.
 *  - that reason is a details/summary toggle, so the full sentence opens on
 *    tap, Enter or Space; pressing a planned language opens it too, which is
 *    the answer to "why did nothing happen?" at the place it is asked.
 *  - each planned button is described by the reason, so it is announced with
 *    it.
 *
 * Nothing is drawn when English is the only language at all: a switcher with
 * one choice and nothing planned is furniture.
 */
function drawLangs() {
  const box = el("langs");
  const was = el("langs-why");
  const keepOpen = Boolean(was && was.open);
  // The switcher is drawn twice -- before the document arrives and again
  // after -- so a key pressed between the two lands on a node the redraw
  // throws away. Remember what had focus by id or locale and give it back.
  const had = box.contains(document.activeElement) ? document.activeElement : null;
  const hadId = had && had.id;
  const hadLang = had && had.classList.contains("lang") ? had.getAttribute("lang") : null;
  box.innerHTML = "";
  if (LOCALES.length < 2 && PLANNED.length === 0) { box.hidden = true; return; }
  box.hidden = false;
  for (const l of LOCALES) {
    const b = document.createElement("button");
    b.className = "lang";
    b.type = "button";
    b.setAttribute("lang", l.locale);
    b.setAttribute("dir", l.dir);
    b.setAttribute("aria-pressed", String(l.locale === LOC));
    b.textContent = l.name;
    b.onclick = () => setLocale(l.locale);
    box.appendChild(b);
  }
  if (PLANNED.length === 0) { restoreFocus(box, hadId, hadLang); return; }
  for (const l of PLANNED) {
    const b = document.createElement("button");
    b.className = "lang planned";
    b.type = "button";
    b.setAttribute("lang", l.locale);
    b.setAttribute("dir", l.dir);
    b.setAttribute("aria-disabled", "true");
    b.setAttribute("aria-describedby", "langs-why-s");
    b.textContent = l.name;
    b.onclick = () => {
      el("langs-why").open = true;
      el("langs-why-s").focus();
    };
    box.appendChild(b);
  }
  const why = document.createElement("details");
  why.className = "langs-why";
  why.id = "langs-why";
  why.open = keepOpen;
  const s = document.createElement("summary");
  s.id = "langs-why-s";
  s.textContent = T("Translations coming");
  const p = document.createElement("p");
  p.id = "langs-why-t";
  // Each name in its own language, isolated, so a right-to-left name in a
  // left-to-right sentence keeps its place in the list.
  const names = PLANNED.map((l) =>
    '<bdi lang="' + escape(l.locale) + '" dir="' + escape(l.dir) + '">' + escape(l.name) + "</bdi>").join(", ");
  p.innerHTML = fill(
    T("A translation of this interface into {languages} is planned. Until it is ready, the page is shown in English."),
    { languages: names });
  why.appendChild(s);
  why.appendChild(p);
  box.appendChild(why);
  restoreFocus(box, hadId, hadLang);
}

function restoreFocus(box, id, lang) {
  const target = id ? document.getElementById(id)
    : lang ? box.querySelector('.lang[lang="' + lang + '"]') : null;
  if (target && box.contains(target)) target.focus();
}

fetch(DOC)
  .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
  .then(init)
  .catch((e) => {
    // Three states, not two: a graph that could not be LOADED is never drawn
    // as an empty graph. An empty index and a failed fetch look identical on
    // screen and mean opposite things.
    loadError = String(e.message);
    renderAll();
  });

// The chrome is in the reader's language before the document arrives, so a
// slow fetch does not mean a page in English that then changes under them.
LOC = chooseLocale();
renderAll();

function init(doc) {
  loaded = doc;
  // A TOMBSTONE is a forwarding address, not a node (bean \`4ak5\` item 2,
  // for one release): it has no type, and the export leaves it out of
  // \`counts\` for the same reason it is left out here.
  G = (doc["@graph"] ?? []).filter((n) => n.deprecated !== true);
  const ctx = doc["@context"] ?? {};
  declared = new Set(Object.keys(ctx).filter((k) => !k.startsWith("@")));
  for (const [k, v] of Object.entries(ctx)) {
    if (v && typeof v === "object" && v["@type"] === "@id") linkTerms.add(k);
  }
  // ABSENT and EMPTY are different answers, so this is not defaulted to an
  // empty array.
  //
  // Since 2026-09-19 the export does not publish undeclaredTerms at all: it is
  // a QA reviewer's finding and lives in the qa-results/v1 document under
  // test/results/. A document that predates that change still carries it, and
  // so might one produced by another instance, so it is read when present.
  //
  // Defaulting to empty would render "Across the graph: 0 such property names"
  // over a document that never said so — a clean bill of health nobody issued,
  // which is the same false pass the load-error handling above exists to
  // avoid, one state along.
  undeclared = Array.isArray(doc.undeclaredTerms) ? doc.undeclaredTerms : null;
  counts = doc.counts ?? {};
  preview = Boolean(doc["@type"] && String(doc["@type"]).includes("Preview"));

  for (const n of G) byId.set(n["@id"], n);
  // Back-links are computed here rather than published: they are derivable, and
  // a stored inverse is a second copy that can disagree with the first.
  for (const n of G) {
    for (const t of linkTerms) {
      for (const v of [].concat(n[t] ?? [])) {
        if (!byId.has(v)) continue;
        if (!backlinks.has(v)) backlinks.set(v, []);
        backlinks.get(v).push({ from: n["@id"], via: t });
      }
    }
  }

  // Bound once, not on every redraw: renderAll runs again on every language
  // change, and a listener added there would fire once more each time.
  el("q").addEventListener("input", drawList);
  renderAll();
}

/**
 * The provenance line: what was loaded, from which commit, and a way back to
 * the document itself.
 */
function renderMeta() {
  const m = el("meta");
  if (loadError !== null) {
    m.innerHTML = '<span class="undeclared">' +
      fill(T("could not load {doc} — {error}"), {
        doc: "<code>" + escape(DOC) + "</code>",
        error: escape(loadError),
      }) + "</span>";
    return;
  }
  if (loaded === null) {
    m.innerHTML = fill(T("loading {doc}…"), { doc: "<code>" + escape(DOC) + "</code>" });
    return;
  }

  const bits = [T("{n} nodes", { n: G.length })];
  if (loaded.sourceCommitSha) bits.push(T("commit {sha}", { sha: String(loaded.sourceCommitSha).slice(0, 8) }));
  if (loaded.sourceTreeDirty) bits.push(T("tree dirty"));
  // A timestamp is data rather than a sentence, and is shown as the document
  // wrote it.
  // An export no longer stamps when it ran (owner rulings 2026-11-06, "QA
  // dates" / "Date source"): its date is derived, the source commit's own.
  const when = loaded.generatedAt ?? loaded.sourceCommitAt;
  const utc = when ? new Date(String(when)) : undefined;
  if (utc && !isNaN(utc.getTime())) bits.push(utc.toISOString().slice(0, 19).replace("T", " ") + "Z");

  // Each bit is ISOLATED, and this line is where it stopped being optional.
  //
  // Rendered right to left, the line was "source commit · JSON-LD · nodes ·
  // commit dac179a6 · 2026-09-19 … 1148": the digits of "1148 nodes" are a
  // weak run, the middots between the bits are neutral, and the bidi
  // algorithm merged them into one sequence and moved the number to the far
  // end of the line. The count was no longer next to the word it counted.
  //
  // Found by LOOKING at the page, in the language, which is the half of the
  // accessibility rule no checker performs: every assertion still passed,
  // because textContent is in DOM order whatever the display does.
  m.textContent = "";
  bits.forEach((b, i) => {
    if (i > 0) m.appendChild(document.createTextNode(" · "));
    const bdi = document.createElement("bdi");
    bdi.textContent = b;
    m.appendChild(bdi);
  });

  // A way back to the document this page renders.
  //
  // DOC, not a composed absolute URL. The page already fetched its sibling by
  // that relative path, so the link is correct wherever the page is served
  // from -- canonical or branches/<slug>/ -- for the same reason the fetch is.
  // Composing <base>/kg/<stub>.jsonld from the declaration would have been a
  // second answer to a question the page has already answered, and the one
  // that goes wrong on a preview.
  //
  // A sourceCommit IRI is a different thing and is linked separately: it
  // points at the commit the graph was generated FROM, on the forge, which is
  // not derivable from here and is absent when the export could not determine
  // it.
  m.appendChild(document.createTextNode(" · "));
  const src = document.createElement("a");
  src.href = DOC;
  src.appendChild(document.createElement("bdi")).textContent = T("JSON-LD");
  // The visible text is the format; the accessible name says what it gets you
  // and from where, because "JSON-LD" out of context names a syntax rather
  // than a destination.
  src.setAttribute("aria-label", T("Download this graph as JSON-LD ({doc})", { doc: DOC }));
  m.appendChild(src);

  if (loaded.sourceCommit) {
    m.appendChild(document.createTextNode(" · "));
    const c = document.createElement("a");
    c.href = String(loaded.sourceCommit);
    c.rel = "noreferrer";
    c.appendChild(document.createElement("bdi")).textContent = T("source commit");
    m.appendChild(c);
  }
}

/**
 * One facet group. Two of them now — Kind and Subgraph — and the second is the
 * owner's ask of 2026-09-20: *"should show hierarchy of named subgraphs in the
 * harness instance(s) ... ability to filter by bootstrap/ cat-harness/
 * f-a-core/ f-a/"*.
 *
 * The two are INDEPENDENT filters, deliberately, not a nested tree: a reader
 * asking "every Skill" and a reader asking "everything in bootstrap" are both
 * common, and nesting one inside the other would make the second a walk. The
 * counts shown on each group are computed against the OTHER group's current
 * selection, so a count is always what clicking it would actually give — a
 * count that lies is worse than no count.
 */
function drawGroup(elementId, counts, selected, onPick) {
  const f = el(elementId);
  f.innerHTML = "";
  const add = (name, n, value) => {
    const b = document.createElement("button");
    b.className = "facet";
    b.type = "button";
    b.setAttribute("aria-pressed", String(selected === value));
    // Name first, count second — in the DOM, not just visually.
    //
    // float:right used to place the count regardless of source order; flex
    // does not, and the first pass rendered "1112 All". Fixing it with CSS
    // order would have left the ACCESSIBLE reading as "1112 All" too, which
    // is the wrong sentence. A screen reader follows the DOM.
    b.innerHTML = escape(name) + '<span class="n">' + n + "</span>";
    b.onclick = () => { onPick(selected === value ? null : value); };
    f.appendChild(b);
  };
  // "All" is the page's own word and is translated. The kinds beside it are
  // the graph's own vocabulary and are not: they are the values a reader
  // types into a query, and a translated type name resolves to nothing.
  add(T("All"), Object.values(counts).reduce((a, b) => a + b, 0), null);
  for (const [t, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) add(t, n, t);
}

/** Count a facet dimension over the nodes the OTHER dimension currently admits. */
function tally(of, admits) {
  const c = {};
  for (const n of G) if (admits(n)) c[of(n)] = (c[of(n)] ?? 0) + 1;
  return c;
}

function drawFacets() {
  drawGroup("facets", tally(typeOf, (n) => sub === null || subOf(n) === sub), kind, (v) => {
    kind = v; drawFacets(); drawList();
  });
  drawGroup("subs", tally(subOf, (n) => kind === null || typeOf(n) === kind), sub, (v) => {
    sub = v; drawFacets(); drawList();
  });
}

function matches(n, q) {
  if (kind !== null && typeOf(n) !== kind) return false;
  if (sub !== null && subOf(n) !== sub) return false;
  if (!q) return true;
  return (label(n) + " " + short(n["@id"]) + " " + (n.description ?? "")).toLowerCase().includes(q);
}

function drawList() {
  const q = el("q").value.trim().toLowerCase();
  // ALPHABETICAL BY THE NAME SHOWN (bean yhcq, finding 5). Document order put
  // 2,986 rows in whatever order the export walked its directories, so the
  // list could only be searched, never scanned. Sorted per draw rather than
  // once: the label is the graph's own text and does not change with the
  // interface language, but a collator per draw keeps that true if it ever
  // does. The id breaks a tie so the order is stable.
  const hits = G.filter((n) => matches(n, q))
    .sort((a, b) => collate.compare(sortKey(a), sortKey(b)) || collate.compare(a["@id"], b["@id"]));
  const ol = el("list");
  ol.innerHTML = "";
  ol.setAttribute("data-count", String(hits.length));
  // Filtering changes the list silently otherwise: a sighted user sees it
  // shrink, a screen-reader user gets nothing.
  el("count").textContent = hits.length === 1
    ? T("1 node matches")
    : T("{n} nodes match", { n: hits.length });
  if (hits.length === 0) {
    ol.innerHTML = '<li class="empty">' + escape(T("No node matches.")) + "</li>";
    return;
  }
  for (const n of hits.slice(0, 400)) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-current", String(n["@id"] === sel));
    b.innerHTML = escape(label(n)) + ' <span class="kind">' + escape(typeOf(n)) + "</span>";
    b.onclick = () => select(n["@id"]);
    li.appendChild(b);
    ol.appendChild(li);
  }
  if (hits.length > 400) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = T("… and {n} more; narrow the search.", { n: hits.length - 400 });
    ol.appendChild(li);
  }
}

function escape(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

const collate = new Intl.Collator("en", { sensitivity: "base", numeric: true });
// A label's leading markup -- a backtick, a quote, "**", "/" of a slash
// command -- is not where a reader looks for it, so it does not decide the
// order. The label shown is unchanged.
function sortKey(n) {
  return String(label(n)).replace(/^[^\\p{L}\\p{N}]+/u, "");
}

function select(id) {
  sel = id;
  drawList();
  renderDetail();
  // ON ONE COLUMN THE DETAIL IS BELOW THE WHOLE LIST (bean yhcq, finding 2):
  // measured 2026-09-30, a tapped row's detail was 1,028 px down a 844 px
  // screen, past a 72vh scroll box a swipe scrolls instead of the page.
  // aria-live told a screen reader; nothing told a sighted touch reader. So
  // where the layout has stacked, take the reader to what they asked for.
  // Focus goes with it, so a keyboard user's next Tab starts there too.
  if (window.matchMedia("(max-width: 860px)").matches) {
    const d = el("detail");
    d.scrollIntoView({ block: "start" });
    d.focus({ preventScroll: true });
  }
}

/**
 * The right-hand panel, in whatever state the page is in: unreadable
 * document, nothing selected, or a node.
 */
function renderDetail() {
  const d = el("detail");
  if (loadError !== null) {
    d.innerHTML = '<p class="empty">' +
      escape(T("The graph could not be read, so nothing is shown. This is not an empty graph.")) + "</p>";
    return;
  }
  if (sel === null) {
    d.innerHTML = '<p class="empty">' + escape(T("Select a node.")) + "</p>";
    return;
  }
  drawNode(sel);
}

function drawNode(id) {
  const n = byId.get(id);
  const d = el("detail");
  d.setAttribute("tabindex", "-1");
  if (!n) { d.innerHTML = '<p class="empty">' + escape(T("No such node.")) + "</p>"; return; }

  let h = "<h3>" + escape(label(n)) + "</h3>";
  h += '<div class="iri">' + escape(n["@id"]) + "</div>";

  const undeclaredHere = Object.keys(n).filter((k) => !k.startsWith("@") && !declared.has(k));
  if (undeclaredHere.length > 0) {
    // "@context" is a JSON-LD keyword: it stays as it is in every language,
    // and the code element is put back around it after escaping rather than
    // being carried inside a string a translator can break.
    h += '<p class="note"><strong>' +
      escape(T("{n} of this node's properties are not in the @context", { n: undeclaredHere.length }))
        .replace("@context", "<code>@context</code>") +
      "</strong>, " +
      // The cross-graph count only when the document actually reported one.
      // See the note in init().
      escape(
        undeclared === null
          ? T("so a JSON-LD processor drops them. They are shown below, marked.")
          : T(
              "so a JSON-LD processor drops them. They are shown below, marked. " +
                "Across the graph: {n} such property names.",
              { n: undeclared.length },
            ),
      ) +
      "</p>";
  }

  h += "<table><tbody>";
  h += row(T("type"), escape(typeOf(n)), false);
  for (const [k, v] of Object.entries(n)) {
    if (k.startsWith("@")) continue;
    // The key is the graph's own property name, not the page's word for it.
    h += row(k, value(k, v), !declared.has(k));
  }
  const back = backlinks.get(id) ?? [];
  if (back.length > 0) {
    h += row(T("← referenced by"), back.map((b) =>
      btn(b.from, label(byId.get(b.from)) + " (" + b.via + ")")).join("<br>"), false);
  }
  h += "</tbody></table>";
  d.innerHTML = h + neighbourhood(n, back);
  for (const b of d.querySelectorAll("[data-goto]")) {
    const go = () => select(b.getAttribute("data-goto"));
    b.onclick = go;
    // A <button> gets Enter and Space from the platform; an SVG group with
    // role="button" does not, and must implement them. preventDefault on Space
    // stops the page scrolling under the user instead of following the edge.
    b.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        go();
      }
    };
  }
}

function row(k, v, flag) {
  return "<tr><th" + (flag ? ' class="undeclared"' : "") + ">" + escape(k) + "</th><td>" + v + "</td></tr>";
}

function btn(id, text) {
  return '<button class="link" type="button" data-goto="' + escape(id) + '">' + escape(text) + "</button>";
}

function value(key, v) {
  if (Array.isArray(v)) {
    return v.length === 0
      ? '<span class="empty">' + escape(T("none")) + "</span>"
      : v.map((x) => value(key, x)).join("<br>");
  }
  // A nested object goes behind a disclosure, pretty-printed.
  //
  // Dumping it inline was the first thing that showed up when the page was
  // actually LOOKED AT rather than reasoned about: a Tool's \`io\` is ~900
  // characters of JSON, and rendering it raw pushed \`satisfies\` and the
  // neighbourhood diagram off the bottom of the screen. The most interesting
  // property on the node was the one that made the node unreadable.
  if (v !== null && typeof v === "object") {
    const pretty = JSON.stringify(v, null, 2);
    const oneLine = JSON.stringify(v);
    const summary = oneLine.length <= 70 ? oneLine : oneLine.slice(0, 67) + "…";
    return "<details><summary><code>" + escape(summary) + "</code></summary><pre>" +
      escape(pretty) + "</pre></details>";
  }
  if (linkTerms.has(key) && byId.has(v)) return btn(v, label(byId.get(v)));
  if (typeof v === "string" && /^https?:\\/\\//.test(v)) {
    // A link-valued property whose target is not a node HERE is a node in
    // another graph document (bean yhcq, finding 3): satisfies ->
    // bootstrap.jsonld#skill/discussion. Its short id reads like a local one,
    // so it says where it goes.
    const elsewhere = linkTerms.has(key)
      ? ' <span class="elsewhere">(' + escape(T("in another graph")) + ")</span>"
      : "";
    return '<a href="' + escape(v) + '" rel="noreferrer">' + escape(short(v)) + "</a>" + elsewhere;
  }
  return escape(v);
}

/**
 * A neighbour's name as at most two lines of about 24 characters, broken at a
 * space where there is one, with an ellipsis only when even two lines cannot
 * hold it (bean yhcq, finding 6: "Produce >= 2 candidates, w" was cut mid-word
 * at 26 with nothing showing it had been). The full name stays the group's
 * accessible name; this is the visual half.
 */
function labelLines(name, x) {
  const MAX = 24;
  const words = String(name).split(/\\s+/);
  const lines = [""];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = w;
    else if ((cur + " " + w).length <= MAX) lines[lines.length - 1] = cur + " " + w;
    else lines.push(w);
  }
  let shown = lines.slice(0, 2);
  const cut = lines.length > 2 || shown.some((l) => l.length > MAX);
  shown = shown.map((l) => (l.length > MAX ? l.slice(0, MAX - 1) : l));
  if (cut) shown[shown.length - 1] = shown[shown.length - 1].slice(0, MAX - 1).replace(/\\s+$/, "") + "…";
  return shown.map((l, i) =>
    i === 0 ? escape(l) : '<tspan class="more" x="' + x + '" dy="13">' + escape(l) + "</tspan>").join("");
}

/**
 * One hop, drawn. Deliberately not the whole graph — see the module note.
 */
function neighbourhood(n, back) {
  const out = [];
  for (const t of linkTerms) {
    for (const v of [].concat(n[t] ?? [])) if (byId.has(v)) out.push({ id: v, via: t, dir: "out" });
  }
  const nodes = out.concat(back.map((b) => ({ id: b.from, via: b.via, dir: "in" }))).slice(0, 14);
  if (nodes.length === 0) {
    // "No links" directly under a link was the finding (bean yhcq, 3): a link
    // into another graph document cannot be drawn here, but it IS a link.
    const leaves = [...linkTerms].some((t) =>
      [].concat(n[t] ?? []).some((v) => typeof v === "string" && /^https?:/.test(v) && !byId.has(v)));
    return '<p class="empty">' + escape(leaves
      ? T("No links to or from other nodes in this graph. The links above lead out of it.")
      : T("No links to or from this node.")) + "</p>";
  }

  const W = 560, cx = W / 2, cy = 150, R = 112;
  // role="group", not role="img". An img is a LEAF in the accessibility tree,
  // so declaring one around focusable children is a contradiction — axe reports
  // it as nested-interactive, and it appeared the moment the neighbours
  // became real buttons. The diagram stopped being a picture when it became a
  // set of controls.
  const drawn = nodes.length === 1
    ? T("One-hop neighbourhood, 1 linked node")
    : T("One-hop neighbourhood, {n} linked nodes", { n: nodes.length });
  let s = '<svg viewBox="0 0 ' + W + ' 300" role="group" aria-label="' + escape(drawn) + '">';
  nodes.forEach((m, i) => {
    const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.82;
    s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '"></line>';
  });
  s += '<circle class="self" cx="' + cx + '" cy="' + cy + '" r="7"></circle>';
  nodes.forEach((m, i) => {
    const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.82;
    const anchor = Math.abs(Math.cos(a)) < 0.3 ? "middle" : (Math.cos(a) > 0 ? "start" : "end");
    const dx = anchor === "middle" ? 0 : (Math.cos(a) > 0 ? 10 : -10);
    const name = String(label(byId.get(m.id)));
    // Each neighbour is a GROUP that is a button: focusable, labelled, and
    // activated by Enter or Space.
    //
    // It was a bare <circle> with a click handler. Every edge in this diagram
    // was unreachable by keyboard while the same edges in the table above were
    // fine — and no automated checker said so, because a <circle> with an
    // onclick is not RECOGNISED as interactive, so there is nothing to flag.
    // Found by reading the diff against the rule, not by a tool.
    //
    // The sentence is the page's; the node's name and the property it travels
    // are the graph's, and are substituted into it untranslated.
    //
    // Two calls rather than one with a conditional argument: a msgid that is
    // computed cannot be read out of the source, and the check that every
    // string the page asks for is one the table declares would skip both.
    const says = m.dir === "in"
      ? T("Referenced by {name} via {via}", { name: name, via: m.via })
      : T("Links to {name} via {via}", { name: name, via: m.via });
    s += '<g class="node" role="button" tabindex="0" data-goto="' + escape(m.id) +
      '" aria-label="' + escape(says) + '">';
    // A 16px invisible disc, so the pointer target is not the 5px dot.
    s += '<circle class="hit" cx="' + x + '" cy="' + y + '" r="16"></circle>';
    s += '<circle cx="' + x + '" cy="' + y + '" r="5"></circle>';
    s += '<text aria-hidden="true" x="' + (x + dx) + '" y="' +
      (y + (anchor === "middle" ? (Math.sin(a) > 0 ? 17 : -9) : 4)) +
      '" text-anchor="' + anchor + '">' + labelLines(name, x + dx) + "</text>";
    s += "</g>";
  });
  s += "</svg>";
  return s;
}
</script>
</body>
</html>
`;
}

if (import.meta.main) {
  const arg = (f: string): string | undefined => {
    const i = process.argv.indexOf(f);
    return i !== -1 ? process.argv[i + 1] : undefined;
  };
  const { stub, docPath } = exportIdentity({ baseUrl: arg("--base-url") ?? process.env.KG_BASE_URL });
  // `--out <file>`: one file, the graph its parent — what the e2e specs and the
  // deploy's `_site/` take. Otherwise the published layout, the viewer at its
  // route and a forwarding page at its old address, under `--site <dir>` or,
  // like every other viewer writer, the harness's own docs: `derive:publish`
  // runs this script bare, and the harness declares both pages built at
  // publish (`cat-harness.json` `builtAtPublish`).
  const out = arg("--out");
  if (out === undefined) {
    const { page, forwarded } = writeViewer(siteTarget(join(ROOT, siteDirFor(ROOT))), stub, (up) =>
      viewerHtml(stub, undefined, undefined, up, docPath),
    );
    console.log(`KG viewer → ${relative(ROOT, page)}\n  reads  ${upFrom(kgViewerRoute(stub))}${docPath}`);
    console.log(forwarded ? `  forwards ${relative(ROOT, forwarded)}` : `  ${stub}/ holds a page already; no forwarding page`);
  } else {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, viewerHtml(stub, undefined, undefined, "../", docPath));
    console.log(`KG viewer → ${relative(ROOT, out)}\n  reads  ../${docPath}  (from the site root, resolved at load)`);
  }
}
