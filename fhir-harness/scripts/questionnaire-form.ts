/**
 * questionnaire-form.ts — one form-view page per Questionnaire on an IG site.
 *
 * Skill `fhir-questionnaire-wireframe`, step 2: the built Questionnaire JSON,
 * drawn by the vendored NLM LHC-Forms web component (owner, 2026-10-14:
 * LHC-Forms, vendored into the site, never a CDN at runtime). Each page
 * carries ✎ (the FSH source), 📣 (feedback) and ✍ (suggest a change, in the
 * Questionnaire mode, `questionnaire-mode.js`), a plain link-out to CSIRO
 * Smart Forms as a rendering cross-check (nothing embedded), and the
 * Publisher's own page. The page config names the mode as a profile of the
 * ✍ suggest runtime's mode registry (`QUESTIONNAIRE_PROFILE`).
 *
 * Reads the IG's AST, which `build-ig-site` already copies into `_data/`;
 * writes, beside the site's pages:
 *
 *   Questionnaire-<id>-form.html            the page
 *   questionnaires/Questionnaire-<id>.json   the copy LHC-Forms renders
 *   assets/lhc-forms/<version>/              the vendored LHC-Forms build
 *   assets/js/questionnaire-form.js          the page's loader
 *   assets/js/questionnaire-mode.js          the ✍ Questionnaire mode
 *   assets/js/check-wireframe-questionnaire.js  its checker, types stripped
 *   assets/js/questionnaire-edit-links.js    the ✎ / 📣 link recipe, at its own
 *                                            path: `assets/js/edit-links.js` is the
 *                                            platform chrome's, which an IG
 *                                            repository's site composes at the
 *                                            same root (see QFORM_EDIT_LINKS)
 *   assets/formbuilder/<version>/            the self-hosted NLM Form Builder's
 *                                            index.html rewritten, and the service
 *                                            worker that answers its cross-site calls
 *                                            and serves the bundle below
 *   assets/formbuilder-bundle/<version>/     the builder's vendored bundle, unchanged,
 *                                            so a shared host can serve it once for
 *                                            every IG (owner, 2026-11-10: "share it on
 *                                            smart-html-jtd like LHC-Forms")
 *   assets/jquery/<version>/                 the jQuery its index.html loads
 *   assets/terminology/                      the IG's terminology index and UCUM
 *
 * No page and no builder request leaves this site (owner, 2026-10-14: "cache
 * + ucum. this is gh-pages so no XSS"): LOINC comes only from the IG's own
 * restored cache (`expansions.json`, `txcache/`), UCUM from the vendored
 * definitions, and `answerValueSet` is expanded into the rendered copy.
 *
 * The source Questionnaire is never changed; the rendered copy is the one a
 * later step may adapt for rendering.
 *
 * @module fhir-harness/scripts/questionnaire-form
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDIT_LINKS_RUNTIME } from "../../cat-harness-tools/src/core/edit-links.js";
import { readAst } from "./ig-ast.ts";
import { ARTIFACT_DIR, artifactPageName } from "./ig-artifact-jsonld.ts";
import { buildIndex, expansionsOf, preExpand, ucumRows, writeIndex } from "./terminology-index.ts";

/**
 * Where the form pages load the edit-links runtime they were built with. Not
 * `assets/js/edit-links.js`: that path is the platform chrome's own copy, and
 * an IG repository's folio site composes the IG at the chrome's root
 * (`composeIgSite`, `atRoot`), where the two met and the compose refused "two
 * answers for one URL" (the WHO SMART Immunizations IG, 2026-10-14). The two copies come
 * from different layers at different pins, so they need not be equal.
 */
export const QFORM_EDIT_LINKS = "assets/js/questionnaire-edit-links.js";
/** The vendored LHC-Forms version this layer serves. */
export const LHC_FORMS_VERSION = "44.1.0";
const HERE = import.meta.dir;
export const LHC_FORMS_DIR = join(HERE, "assets", "vendor", "lhc-forms", LHC_FORMS_VERSION);
const PAGE_SCRIPT = join(HERE, "templates", "ig-pages", "questionnaire-form.js");
const MODE_MODULE = join(HERE, "questionnaire-mode.js");
const CHECKER = join(HERE, "check-wireframe-questionnaire.ts");
/** The vendored NLM Form Builder version this layer serves. */
export const FORMBUILDER_VERSION = "12.9.0";
const FORMBUILDER_DIR = join(HERE, "assets", "vendor", "formbuilder-lhcforms", FORMBUILDER_VERSION);
export const JQUERY_VERSION = "3.6.0";
const JQUERY_DIR = join(HERE, "assets", "vendor", "jquery", JQUERY_VERSION);
const UCUM_DEFS = join(HERE, "assets", "vendor", "ucum-lhc", "8.0.0", "ucumDefs.min.json");
const SW_SCRIPT = join(HERE, "terminology-sw.js");
const SW_MAP = join(HERE, "terminology-map.js");
/** The Form Builder's directory on the site, and the worker's scope. */
export const BUILDER_AT = `assets/formbuilder/${FORMBUILDER_VERSION}/`;
/** The builder's vendored bundle on the site: the same bytes for every IG, so it can be shared. */
export const BUNDLE_AT = `assets/formbuilder-bundle/${FORMBUILDER_VERSION}/`;
/** The files the builder's directory keeps itself: the pages and the worker. Every other file is the bundle's. */
export const BUILDER_OWN = ["index.html", "window-open.html", "fa-terminology-sw.js", "fa-terminology-map.js"] as const;

/**
 * The Questionnaire mode as a ✍ suggest runtime profile
 * (`cfg.suggest.profiles[]`, cat-harness-tools#218): the module relative to
 * the page, Questionnaire JSON by file ending and by KG kind.
 */
export const QUESTIONNAIRE_PROFILE = { id: "questionnaire", module: "assets/js/questionnaire-mode.js", extensions: [".json"], kinds: ["questionnaire"] } as const;

/** CSIRO's Smart Forms playground: a cross-check reached by a plain link, never embedded. */
export const SMART_FORMS_URL = "https://smartforms.csiro.au/playground";

/** The LHC-Forms name for a FHIR version (`4.0.1` → `R4`). */
export function lformsFhirVersion(fhirVersion: string | undefined): "STU3" | "R4" | "R4B" | "R5" {
  const v = String(fhirVersion ?? "");
  if (v.startsWith("3.")) return "STU3";
  if (v.startsWith("4.3")) return "R4B";
  if (v.startsWith("5.")) return "R5";
  return "R4";
}

export interface FormPageOptions {
  /** `https://github.com/<o>/<r>/edit/<branch>`: where ✎, 📣 and ✍ point. */
  editBase?: string;
  /** The IG's FHIR version (`sushi-config.yaml` `fhirVersion`). */
  fhirVersion?: string;
  /** The IG's short name, for a change request's title. */
  slug?: string;
  /** The self-hosted NLM Form Builder's site-relative URL, when the site serves it. */
  builder?: string;
  /** The service worker the page registers before the builder opens: its site-relative URL and scope. */
  sw?: { url: string; scope: string };
  /** The IG's restored `expansions.json` (`output-ast/`), for the terminology index and `answerValueSet`. */
  expansions?: string;
  /** The IG's restored Publisher `txcache/` (`input-cache/txcache/`), for the terminology index. */
  txcache?: string;
  /**
   * Where the AST is read by URL: the cache commit's tree on
   * raw.githubusercontent.com (`astRawBase`, fhir-harness#325). Given, the
   * page's suggest editor fetches the unexpanded Questionnaire from there,
   * at the manifest's `file`, and no `.source.json` copy is written into the
   * site. Absent, the copy is written beside the rendered one, as before.
   */
  astRaw?: string;
}

export interface FormPage {
  id: string;
  page: string;
  json: string;
  source?: string;
  /** Items whose `answerValueSet` was expanded into the rendered copy, and those the cache does not hold. */
  expanded?: string[];
  notExpanded?: string[];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const yamlStr = (s: string) => JSON.stringify(s);
/** JSON safe inside a `<script>` element. */
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

function repoOf(editBase: string | undefined): { repo?: string; branch?: string } {
  const m = editBase?.replace(/\/$/, "").match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/edit\/(.+)$/);
  return m ? { repo: m[1], branch: m[2] } : {};
}

/** One form page's HTML, front matter included. */
export function formPageHtml(q: { id: string; title?: string; name?: string; url?: string }, o: FormPageOptions & { source?: string; json: string; text?: string }): string {
  const title = q.title ?? q.name ?? q.id;
  const { repo, branch } = repoOf(o.editBase);
  const cfg = {
    ...(repo ? { repo, branch } : {}),
    suggest: {
      profiles: [QUESTIONNAIRE_PROFILE],
      fhirVersion: lformsFhirVersion(o.fhirVersion),
      ...(o.builder ? { builder: o.builder } : {}),
      ...(o.sw ? { sw: o.sw } : {}),
      ...(o.source ? { source: o.source } : {}),
      ...(o.slug ? { slug: o.slug } : {}),
    },
  };
  // The runtime matches the host to the profile by `data-suggest-mode`.
  // `data-src` names the source in the repository (an FSH file), which the
  // issue names and the runtime's FSH pane edits (`ctx.sourcePath` /
  // `ctx.sourceText`); `data-suggest-text` is the URL, relative to this page,
  // of the built Questionnaire JSON the form mode edits as `ctx.text`: the
  // AST's own file (at the AST cache commit, or its `.source.json` copy), not
  // the rendered one, whose value sets were expanded for display.
  const src = `${o.source ? ` data-src="${esc(o.source)}"` : ""}${o.text ? ` data-suggest-text="${esc(o.text)}"` : ""} data-block="questionnaire:${esc(q.id)}" data-suggest-mode="${QUESTIONNAIRE_PROFILE.id}"`;
  return [
    "---",
    `title: ${yamlStr(`${title} — form`)}`,
    "nav_exclude: true",
    "search_exclude: true",
    // The IG's footer, as on every other page of the IG site (#1901; owner, 2026-11-06).
    "ig_footer: true",
    "---",
    `<div id="fa-qform" class="fa-qform" data-json="${esc(o.json)}" data-lhc="assets/lhc-forms/${LHC_FORMS_VERSION}/" data-fhir="${lformsFhirVersion(o.fhirVersion)}"${src}>`,
    `<h1>${esc(title)}: the form</h1>`,
    `<p class="fa-qform-about">How <a href="${esc(`${ARTIFACT_DIR}/${artifactPageName({ resourceType: "Questionnaire", id: q.id })}.html`)}">Questionnaire/${esc(q.id)}</a> looks to the person filling it in, drawn from its built JSON by NLM LHC-Forms ${LHC_FORMS_VERSION}, served from this site.</p>`,
    '<p class="fa-qform-links">',
    ...(o.source && repo
      ? [
          '<a data-fa-link="edit" tabindex="0" title="Edit this Questionnaire\'s source on GitHub">✎ edit the source</a>',
          '<a data-fa-link="feedback" tabindex="0" title="Give feedback on this form (opens a GitHub issue)">📣 feedback</a>',
        ]
      : []),
    ...(repo ? ['<a class="fa-qform-suggest" href="#fa-qform-editor" title="Suggest a change to this form or its wireframe (opens a GitHub issue)">✍ suggest a change</a>'] : []),
    `<a href="${esc(o.json)}" download>the JSON</a>`,
    `<a href="${SMART_FORMS_URL}" rel="noopener" target="_blank" title="CSIRO Smart Forms: load the JSON there to cross-check the rendering">open in CSIRO Smart Forms</a>`,
    "</p>",
    '<p class="fa-qform-state" role="status"></p>',
    '<div class="fa-qform-view"></div>',
    '<div id="fa-qform-editor" class="fa-qform-editor"></div>',
    "</div>",
    `<script type="application/json" id="fa-edit-cfg">${scriptJson(cfg)}</script>`,
    `<script src="${QFORM_EDIT_LINKS}"></script>`,
    '<script src="assets/js/questionnaire-form.js" defer></script>',
    "",
  ].join("\n");
}

/**
 * The Form Builder's `index.html` as this site serves it: jQuery from this
 * site rather than ajax.googleapis.com, the Google font rules and preconnect
 * removed, and a guard first in `<head>` that stops the page, registers the
 * service worker and reloads when the worker does not yet control it — so
 * not even the first load makes a cross-site request. The vendored file is
 * not changed.
 */
export function builderIndexHtml(original: string, swUrl: string): string {
  const guard =
    "<script>(function(){var k='fa-sw-reload';" +
    "if(!('serviceWorker' in navigator)){window.stop();document.documentElement.textContent='This editor needs service workers, which this browser does not allow here.';return}" +
    "if(navigator.serviceWorker.controller){try{sessionStorage.removeItem(k)}catch(e){}return}" +
    "window.stop();var n=0;try{n=+sessionStorage.getItem(k)||0;sessionStorage.setItem(k,n+1)}catch(e){}" +
    "if(n>2){document.documentElement.textContent='The editor could not start its offline service worker; reload to try again.';return}" +
    `navigator.serviceWorker.register(${JSON.stringify(swUrl)},{scope:'./'}).then(function(){return navigator.serviceWorker.ready}).then(function(){location.reload()})` +
    "})();</script>";
  return original
    .replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*>/g, "")
    .replace(/@font-face\{[^}]*fonts\.gstatic\.com[^}]*\}/g, "")
    .replace(/https:\/\/ajax\.googleapis\.com\/ajax\/libs\/jquery\/3\.6\.0\/jquery\.min\.js/g, `../../jquery/${JQUERY_VERSION}/jquery.min.js`)
    .replace(/<head>/, `<head>${guard}`);
}

/** The service worker's URL relative to the builder's directory, its configuration in the query. */
export function swUrl(indexFile: string): string {
  const q = new URLSearchParams({ index: `../../terminology/${indexFile}`, ucum: "../../terminology/ucum.json", lhc: `../../lhc-forms/${LHC_FORMS_VERSION}/`, v: LHC_FORMS_VERSION, bundle: `../../formbuilder-bundle/${FORMBUILDER_VERSION}/` });
  return `fa-terminology-sw.js?${q}`;
}

/** The self-hosted builder, its worker, jQuery and the terminology, under `out`. */
export function stageBuilder(out: string, o: Pick<FormPageOptions, "expansions" | "txcache">): { builder: string; sw: { url: string; scope: string }; codes: number } {
  const dir = join(out, BUILDER_AT);
  // The bundle goes beside the builder, unchanged; the worker serves it under
  // the builder's directory, so the app's relative paths are not rewritten.
  cpSync(FORMBUILDER_DIR, join(out, BUNDLE_AT), { recursive: true, filter: (f) => !/[\\/]index\.html$/.test(f) });
  mkdirSync(dir, { recursive: true });
  cpSync(JQUERY_DIR, join(out, "assets", "jquery", JQUERY_VERSION), { recursive: true });
  const index = buildIndex({ expansions: o.expansions, txcache: o.txcache });
  const w = writeIndex(index, join(out, "assets", "terminology"));
  writeFileSync(join(out, "assets", "terminology", "ucum.json"), JSON.stringify({ source: "@lhncbc/ucum-lhc 8.0.0 data/ucumDefs.min.json", rows: ucumRows(JSON.parse(readFileSync(UCUM_DEFS, "utf-8"))) }));
  const url = swUrl(w.file);
  const page = builderIndexHtml(readFileSync(join(FORMBUILDER_DIR, "index.html"), "utf-8"), url);
  writeFileSync(join(dir, "index.html"), page);
  // The builder takes its opener hand-back only on its `window-open` route
  // (API.md); GitHub Pages serves `window-open` from `window-open.html`.
  writeFileSync(join(dir, "window-open.html"), page);
  writeFileSync(join(dir, "fa-terminology-sw.js"), readFileSync(SW_SCRIPT, "utf-8"));
  writeFileSync(join(dir, "fa-terminology-map.js"), readFileSync(SW_MAP, "utf-8"));
  return { builder: `${BUILDER_AT}window-open`, sw: { url: `${BUILDER_AT}${url}`, scope: BUILDER_AT }, codes: index.codes.length };
}

/** The checker as a browser module: its types stripped, nothing else changed. */
export function checkerModule(): string {
  const t = new Bun.Transpiler({ loader: "ts", target: "browser" });
  return `// GENERATED from fhir-harness/scripts/check-wireframe-questionnaire.ts; do not edit.\n${t.transformSync(readFileSync(CHECKER, "utf-8"))}`;
}

/** An AST file's URL under the cache commit's raw base, each path segment encoded. */
export function astFileUrl(raw: string, file: string): string {
  return `${raw.replace(/\/+$/, "")}/${file.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Every Questionnaire in the AST gets a form page. No AST, or no
 * Questionnaire in it: nothing written and an empty list back.
 */
export function questionnaireFormPages(astDir: string, out: string, o: FormPageOptions = {}): FormPage[] {
  if (!existsSync(join(astDir, "manifest.json"))) return [];
  const manifest = readAst(astDir).manifest;
  const qs = manifest.resources.filter((r) => r.resourceType === "Questionnaire" && existsSync(join(astDir, r.file)));
  if (!qs.length) return [];
  const pages: FormPage[] = [];
  mkdirSync(join(out, "questionnaires"), { recursive: true });
  const expansionsFile = o.expansions ?? join(astDir, "expansions.json");
  const expansions = existsSync(expansionsFile) ? expansionsOf(JSON.parse(readFileSync(expansionsFile, "utf-8"))) : new Map();
  const staged = stageBuilder(out, { expansions: existsSync(expansionsFile) ? expansionsFile : undefined, txcache: o.txcache });
  for (const r of qs) {
    const source = JSON.parse(readFileSync(join(astDir, r.file), "utf-8"));
    // The copy LHC-Forms renders: value sets expanded from the IG's cache; the source is untouched.
    const { questionnaire: q, expanded, missing } = preExpand(source, expansions);
    const json = `questionnaires/Questionnaire-${r.id}.json`;
    writeFileSync(join(out, json), JSON.stringify(q, null, 2) + "\n");
    // The unexpanded Questionnaire, as the IG built it: what a suggested edit
    // diffs against. Read from the AST cache commit when the site reads the
    // AST by URL, else copied into the site beside the rendered one.
    const text = o.astRaw ? astFileUrl(o.astRaw, r.file) : `questionnaires/Questionnaire-${r.id}.source.json`;
    if (!o.astRaw) writeFileSync(join(out, text), JSON.stringify(source, null, 2) + "\n");
    const page = `Questionnaire-${r.id}-form.html`;
    const src = r.source ?? undefined;
    writeFileSync(join(out, page), formPageHtml({ ...q, id: r.id }, { builder: staged.builder, sw: staged.sw, ...o, json, text, source: src }));
    pages.push({ id: r.id, page, json, ...(src ? { source: src } : {}), ...(expanded.length ? { expanded } : {}), ...(missing.length ? { notExpanded: missing } : {}) });
  }
  const js = join(out, "assets", "js");
  mkdirSync(js, { recursive: true });
  cpSync(LHC_FORMS_DIR, join(out, "assets", "lhc-forms", LHC_FORMS_VERSION), { recursive: true });
  writeFileSync(join(js, "questionnaire-form.js"), readFileSync(PAGE_SCRIPT, "utf-8"));
  writeFileSync(join(js, "questionnaire-mode.js"), readFileSync(MODE_MODULE, "utf-8"));
  writeFileSync(join(js, "check-wireframe-questionnaire.js"), checkerModule());
  writeFileSync(join(out, QFORM_EDIT_LINKS), `${EDIT_LINKS_RUNTIME}\n`);
  return pages;
}
