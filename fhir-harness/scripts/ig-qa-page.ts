#!/usr/bin/env bun
/**
 * ig-qa-page.ts — an IG site's QA report, `qa.html`: the FHIR QA and the
 * knowledge graph's QA on one page, the page the footer's "QA Report" links.
 *
 * Owner, 2026-11-06: *"QA report should link to harness QA reports = FHIR QA
 * reports + KG QA"*. Earlier (2026-10-12): *"where are qa reports
 * visible?"* — a finding a check wrote and nobody can read is the same as no
 * finding.
 *
 * ## The FHIR QA, from what the build holds
 *
 * The site is built from the IG's cached AST, never a Publisher run
 * (`ig-build-pipeline` rule 1), so the Publisher's `qa.html` is not
 * published. What the build holds is said, and what it does not hold is said
 * too:
 *
 * - the **Publisher's QA summary**, `qa.json`, which the AST build carries
 *   beside the AST (`ig-ast-build.sh`, `ig-cache.sh seed`): its errors,
 *   warnings and hints, and the run they came from. An AST cached before it
 *   carried one has none, and the page says so rather than showing zeros;
 * - the **AST's own record**: when its Publisher run generated it, with which
 *   toolchain, and which of its parts are provisional until a full run;
 * - the **AST's validity** for this checkout (`ig-repo-site ast` writes it
 *   under the work directory): valid, stale, or cannot tell, with why.
 *
 * ## The KG QA, from the harness
 *
 * cat-harness-tools `kg-qa-report.ts`: each layer's `qa-results/v1`
 * records and the harness's own view of the `qa` graph on this site. This
 * page lays it out and knows nothing of what any record is about.
 *
 *   bun run fhir-harness/scripts/ig-qa-page.ts --instance-root <dir> --docs <jekyll source> [--ast <dir>] [--work <dir>]
 *
 * @module fhir-harness/scripts/ig-qa-page
 * @covers none — it publishes QA records other checks wrote, and judges nothing
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { copyKgQaRecords, kgQaMarkdown, kgQaReport, type KgQaReport } from "../../cat-harness-tools/scripts/kg-qa-report.ts";
import { readDeclaration } from "../../cat-harness-tools/schemas/kg/cat-harness.ts";
import { CONTENT_QA_PUBLISHED, CONTENT_QA_SIDECAR, type ContentQaVerdict } from "./ig-content-qa.ts";
import { QA_MESSAGES_FILE, QA_MESSAGES_SCHEMA } from "./ig-qa-messages.ts";
import { markdownQaMarkdown, scanDir, type MarkdownFinding } from "./ig-markdown-qa.ts";
import { pageRenderQaMarkdown } from "./ig-page-render-qa.ts";
import { fetchPublisherBundles, readBundle, readOwnCatalogue, translateMessages, usageReport } from "./ig-publisher-i18n.ts";
import { HARNESS_TRANSLATIONS, qaScriptLabels, qaStrings, type Tr } from "./ig-qa-page-i18n.ts";

/** Where the KG records are published under the site root. */
export const KG_QA_ASSETS = "assets/kg-qa";
/** Where the Publisher's QA summary is published under the site root. */
export const FHIR_QA_ASSETS = "assets/fhir-qa";
/** The Publisher's QA summary, as its run writes it to `output/` and the AST build carries it. */
export const PUBLISHER_QA_FILE = "qa.json";
/** Where the site's artifact pages are: `ARTIFACT_DIR` of `ig-artifact-jsonld.ts`, named here so this page does not load that module's schemas. */
const ARTIFACT_DIR = "artifact";
/** The page script that draws the Publisher's messages in its own layout, published beside them. */
export const QA_MESSAGES_SCRIPT = "qa-messages.js";
/** One locale's messages, published beside the English ones. */
export const qaMessagesFile = (locale: string): string => (locale === "en" ? QA_MESSAGES_FILE : QA_MESSAGES_FILE.replace(/\.json$/, `.${locale}.json`));
/** Where each translated message string is used, per locale (`ig-publisher-i18n.ts` usageReport). */
export const QA_I18N_USAGE_FILE = "i18n-usage.json";

type Json = Record<string, unknown>;

/** The FHIR half: everything optional, because each is something the build may not hold. */
export interface FhirQa {
  /** The Publisher's `qa.json`, as the AST carries it. */
  publisher?: Json;
  /** The Publisher's full message list (`ig-qa-messages.ts`), as the AST carries it. */
  messages?: Json;
  /** Where the IG's tracked files are, at the commit this site is built from (`https://github.com/<o>/<r>/blob/<sha>/`), for the messages' file links. */
  sourceBase?: string;
  /** The AST's `manifest.json`. */
  manifest?: Json;
  /** `ig-ast-validity.json`, as `ig-repo-site ast` wrote it. */
  validity?: { verdict?: string; detail?: Json; recorded?: Json; current?: Json };
  /** The AST's markdown fields drawn by the pages' own renderer, and what they leave as text (`ig-markdown-qa.ts`). */
  markdown?: { scanned: number; findings: MarkdownFinding[] };
  /** The injection gate's verdict (`ig-content-qa.ts`), when the build ran it. */
  content?: ContentQaVerdict;
}

function readJson(file: string | undefined): Json | undefined {
  if (!file || !existsSync(file)) return undefined;
  try {
    const v = JSON.parse(readFileSync(file, "utf-8"));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : undefined;
  } catch {
    return undefined;
  }
}

/** The FHIR QA the build holds: the AST directory, and the work directory the `ast` step wrote its verdict to. */
export function readFhirQa(ast: string | undefined, validityFile?: string): FhirQa {
  const publisher = ast ? readJson(join(ast, PUBLISHER_QA_FILE)) : undefined;
  const manifest = ast ? readJson(join(ast, "manifest.json")) : undefined;
  const validity = readJson(validityFile) as FhirQa["validity"];
  const read = ast ? readJson(join(ast, QA_MESSAGES_FILE)) : undefined;
  const messages = read && read.$schema === QA_MESSAGES_SCHEMA && Array.isArray(read.groups) && read.groups.length > 0 ? read : undefined;
  const scan = ast && existsSync(ast) ? scanDir(ast) : undefined;
  const markdown = scan && scan.scanned > 0 ? scan : undefined;
  return { ...(publisher ? { publisher } : {}), ...(messages ? { messages } : {}), ...(manifest ? { manifest } : {}), ...(validity ? { validity } : {}), ...(markdown ? { markdown } : {}) };
}

const escHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string): string => escHtml(s).replace(/"/g, "&quot;");
const code = (v: unknown): string => `\`${String(v).replace(/`/g, "'")}\``;
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** The FHIR half as Markdown lines. */
export function fhirQaMarkdown(q: FhirQa, o: { up?: string; t?: Tr; locale?: string; translated?: boolean; translationsDir?: string } = {}): string[] {
  const up = o.up ?? "";
  const t = o.t ?? qaStrings("en");
  const locale = o.locale ?? "en";
  const englishOnly = (md: string[]): string[] => (locale === "en" || !md.length ? md : [`<div lang="en" dir="ltr" markdown="1">`, "", `*${t("englishOnly")}*`, "", ...md, "</div>", ""]);
  const lines: string[] = [];
  lines.push(`### ${t("publisher")}`, "");
  const p = q.publisher;
  if (p) {
    const rows: [string, number | undefined][] = [
      [t("errors"), num(p.errs)],
      [t("warnings"), num(p.warnings)],
      [t("hints"), num(p.hints)],
      [t("suppressedWarnings"), num(p["suppressed-warnings"])],
      [t("suppressedHints"), num(p["suppressed-hints"])],
    ];
    const run = [p.tool ? `IG Publisher ${String(p.tool)}` : undefined, p.version ? `FHIR ${String(p.version)}` : undefined, p.date ?? p.dateISO8601 ? `on ${String(p.date ?? p.dateISO8601)}` : undefined].filter(Boolean);
    lines.push(`${t("publisherSummary", { run: run.length ? ` (${run.join(", ")})` : "" })} [${t("summaryJson")}](${up}${FHIR_QA_ASSETS}/${PUBLISHER_QA_FILE})`, "");
    const held = rows.filter(([, n]) => n !== undefined);
    if (q.messages) {
      lines.push(
        `${t("messagesIntro")} [${t("messagesJson")}](${up}${FHIR_QA_ASSETS}/${qaMessagesFile(o.translated ? locale : "en")})`,
        "",
        ...(o.translated ? [`${t("messagesTranslated")} [${t("whereUsed")}](${up}${FHIR_QA_ASSETS}/${QA_I18N_USAGE_FILE})`, ""] : []),
        `<div class="ig-qa-publisher" markdown="0" data-summary="${up}${FHIR_QA_ASSETS}/${PUBLISHER_QA_FILE}" data-messages="${up}${FHIR_QA_ASSETS}/${qaMessagesFile(o.translated ? locale : "en")}" data-pages="${up}assets/ast-pages.json" data-artifacts="${up}${ARTIFACT_DIR}/"${q.sourceBase ? ` data-source="${q.sourceBase}"` : ""} data-labels="${escAttr(JSON.stringify(qaScriptLabels(locale, o.translationsDir)))}"><p>${escHtml(t("loading"))}</p><noscript><p>${escHtml(t("noscript"))}</p></noscript></div>`,
        `<script src="${up}${FHIR_QA_ASSETS}/${QA_MESSAGES_SCRIPT}"></script>`,
        "",
      );
    } else if (held.length) {
      lines.push(`| ${t("messages")} | ${t("count")} |`, "|---|---|");
      for (const [k, n] of held) lines.push(`| ${k} | ${n} |`);
      lines.push("");
    }
  } else {
    lines.push(t("noSummary"), "");
  }
  lines.push(`### ${t("ast")}`, "");
  const m = q.manifest;
  if (m) {
    const tc = (m.toolchain ?? {}) as Json;
    const prov = Array.isArray(m.provisional) ? (m.provisional as unknown[]).map(String) : [];
    lines.push(`| ${t("field")} | ${t("value")} |`, "|---|---|");
    if (m.generatedAt) lines.push(`| generated | ${code(m.generatedAt)} |`);
    if (m.authority) lines.push(`| authority | ${code(m.authority)} |`);
    for (const k of ["publisher", "core", "sushi", "java"]) if (tc[k]) lines.push(`| ${k} | ${code(tc[k])} |`);
    if (Array.isArray(m.resources)) lines.push(`| resources | ${m.resources.length} |`);
    if (prov.length) lines.push(`| provisional | ${prov.map(code).join(", ")}${m.provisionalUntil ? `, until ${String(m.provisionalUntil)}` : ""} |`);
    lines.push("");
  } else lines.push(t("noManifest"), "");
  const v = q.validity;
  if (v?.verdict) {
    const why = typeof v.detail?.why === "string" ? ` ${v.detail.why}` : "";
    lines.push(`${t("validity", { verdict: code(v.verdict) })}${why}`, "");
    const rec = (v.recorded ?? {}) as Json;
    const cur = (v.current ?? {}) as Json;
    const keys = ["toolchain", "sourceRevision", "inputDigest"].filter((k) => rec[k] !== undefined || cur[k] !== undefined);
    if (keys.length) {
      lines.push(`| | ${t("recorded")} | ${t("thisCheckout")} |`, "|---|---|---|");
      for (const k of keys) lines.push(`| ${k} | ${rec[k] !== undefined ? code(rec[k]) : "—"} | ${cur[k] !== undefined ? code(cur[k]) : "—"} |`);
      lines.push("");
    }
  } else lines.push(t("noValidity"), "");
  if (q.markdown) lines.push(...englishOnly(markdownQaMarkdown(q.markdown)));
  lines.push(...englishOnly(pageRenderQaMarkdown({ up })));
  lines.push(`### ${t("injection")}`, "");
  const c = q.content;
  if (c) {
    const by = c.reviewer ? `${c.reviewer.kind} ${code(c.reviewer.name)}${c.reviewedAt ? ` at ${code(c.reviewedAt)}` : ""}` : t("nobody");
    const state: Record<ContentQaVerdict["state"], string> = {
      reviewed: t("stateReviewed"),
      missing: t("stateMissing"),
      stale: t("stateStale"),
      unusable: t("stateUnusable"),
      "open-findings": t("stateOpen"),
      "pattern-hits": t("stateHits"),
    };
    lines.push(
      `${t("injectionIntro", { items: c.items, sidecar: code(CONTENT_QA_SIDECAR) })} [${t("verdictJson")}](${up}${CONTENT_QA_PUBLISHED})`,
      "",
      `| ${t("field")} | ${t("value")} |`,
      "|---|---|",
      `| ${t("state")} | ${state[c.state]}${c.accepted ? ` — ${t("acceptedLocal")}` : ""} |`,
      `| ${t("content")} | ${code(c.contentDigest)} |`,
      `| ${t("reviewed")} | ${c.reviewedDigest ? code(c.reviewedDigest) : "—"} ${t("by")} ${by} |`,
      "",
    );
  } else lines.push(t("noInjection"), "");
  return lines;
}

/** The whole page: front matter, then both halves inside `{% raw %}` (entries are data, not Liquid). */
export function renderQaPage(o: { title: string; fhir: FhirQa; kg: KgQaReport; up?: string; locale?: string; translated?: boolean; translationsDir?: string }): string {
  const locale = o.locale ?? "en";
  const t = qaStrings(locale, o.translationsDir);
  const kg = kgQaMarkdown(o.kg, { assets: KG_QA_ASSETS, up: o.up, level: 3 });
  return [
    "---",
    `title: ${JSON.stringify(o.title)}`,
    "nav_exclude: true",
    "rendered-by: ig-qa-page",
    "---",
    "",
    "{% raw %}",
    `# ${o.title}`,
    "",
    t("intro"),
    "",
    `## ${t("fhirQa")}`,
    "",
    ...fhirQaMarkdown(o.fhir, { up: o.up, t, locale, ...(o.translated ? { translated: true } : {}), ...(o.translationsDir ? { translationsDir: o.translationsDir } : {}) }),
    `## ${t("kgQa")}`,
    "",
    // The KG half is written by cat-harness-tools in English; said so, and marked as English for the reader's browser.
    ...(locale === "en" ? kg : [`<div lang="en" dir="ltr" markdown="1">`, "", `*${t("englishOnly")}*`, "", ...kg, "", "</div>", ""]),
    "{% endraw %}",
    "",
  ].join("\n");
}

/** `https://github.com/<o>/<r>/blob/<sha>/` for a GitHub checkout, so a message's tracked file links to its source; undefined otherwise. */
export function githubBlobBase(root: string): string | undefined {
  try {
    const git = (...a: string[]) => execFileSync("git", ["-C", root, ...a], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const remote = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(git("remote", "get-url", "origin"));
    const sha = git("rev-parse", "HEAD");
    return remote && /^[0-9a-f]{40}$/.test(sha) ? `https://github.com/${remote[1]}/${remote[2]}/blob/${sha}/` : undefined;
  } catch {
    return undefined;
  }
}

/** One locale's translated messages, and how many came from where. */
export type LocalisedQa = ReturnType<typeof translateMessages>;

/** What the QA page needs to be drawn in other locales: the Publisher's bundles and this layer's catalogues. */
export interface QaLocales {
  /** The locales to write, besides English (an IG's page locales). */
  locales: string[];
  /** Where fetched Publisher bundles are kept (`<cache>/<core version>/`). */
  cache: string;
  /** This layer's catalogues; {@link HARNESS_TRANSLATIONS} by default. */
  translationsDir?: string;
}

/** The QA page in each locale, keyed by locale (`en` is the source page). */
export interface BuiltQa {
  page: string;
  pages: Record<string, string>;
  fhir: FhirQa;
  kg: KgQaReport;
  /** Each locale's translated Publisher messages. */
  localised: Map<string, LocalisedQa>;
  /** What the build did about the Publisher's bundles, for the build log. */
  i18n?: string;
}

/** The page for the checkout at `root`: its text in each locale, and what it links that must be published beside it ({@link publishQaAssets}). */
export function buildQaPage(o: { root: string; ast?: string; validity?: string; title?: string; content?: ContentQaVerdict; i18n?: QaLocales }): BuiltQa {
  const root = resolve(o.root);
  const fhir: FhirQa = { ...readFhirQa(o.ast, o.validity), ...(o.content ? { content: o.content } : {}) };
  const sourceBase = githubBlobBase(root);
  if (sourceBase) fhir.sourceBase = sourceBase;
  const kg = kgQaReport(root, readDeclaration(root)?.name);
  const page = renderQaPage({ title: o.title ?? qaStrings("en")("title"), fhir, kg });
  const pages: Record<string, string> = { en: page };
  const localised = new Map<string, LocalisedQa>();
  let i18n: string | undefined;
  const locales = (o.i18n?.locales ?? []).filter((l) => l !== "en");
  if (o.i18n && locales.length) {
    const translationsDir = o.i18n.translationsDir ?? HARNESS_TRANSLATIONS;
    const core = String(((fhir.manifest?.toolchain ?? {}) as Json).core ?? "");
    const fetched = fhir.messages ? (core ? fetchPublisherBundles(core, o.i18n.cache) : { dir: "", ok: false, why: "the AST records no core version" }) : undefined;
    const publisher = fetched?.ok ? readBundle(fetched.dir, "Messages") : undefined;
    for (const locale of locales) {
      if (fhir.messages) localised.set(locale, translateMessages(fhir.messages as unknown as Parameters<typeof translateMessages>[0], { locale, ...(publisher ? { publisher } : {}), own: readOwnCatalogue(translationsDir, locale) }));
      pages[locale] = renderQaPage({ title: qaStrings(locale, translationsDir)("title"), fhir, kg, up: "../", locale, translated: localised.has(locale), translationsDir });
    }
    i18n = fetched === undefined
      ? "no Publisher messages to translate"
      : `${fetched.ok ? `Publisher bundles of core ${core}` : `no Publisher bundles (${fetched.why})`}; ${[...localised].map(([l, r]) => `${l} ${r.counts.publisher}/${r.counts.machine}/${r.counts.source}${r.refused.length ? ` (${r.refused.length} Publisher template(s) refused)` : ""}`).join(", ")} (publisher/machine/English)`;
  }
  return { page, pages, fhir, kg, localised, ...(i18n ? { i18n } : {}) };
}

/** Publish what the page links under `site`: the Publisher's summary and the KG records. Returns how many KG records were copied. */
export function publishQaAssets(r: { fhir: FhirQa; kg: KgQaReport; localised?: Map<string, LocalisedQa> }, site: string): number {
  if (r.fhir.publisher) {
    mkdirSync(join(site, FHIR_QA_ASSETS), { recursive: true });
    writeFileSync(join(site, FHIR_QA_ASSETS, PUBLISHER_QA_FILE), `${JSON.stringify(r.fhir.publisher, null, 2)}\n`);
  }
  if (r.fhir.publisher && r.fhir.messages) {
    writeFileSync(join(site, FHIR_QA_ASSETS, QA_MESSAGES_FILE), `${JSON.stringify(r.fhir.messages)}\n`);
    writeFileSync(join(site, FHIR_QA_ASSETS, QA_MESSAGES_SCRIPT), QA_MESSAGES_JS);
    for (const [locale, l] of r.localised ?? []) writeFileSync(join(site, FHIR_QA_ASSETS, qaMessagesFile(locale)), `${JSON.stringify(l.messages)}\n`);
    if (r.localised?.size) writeFileSync(join(site, FHIR_QA_ASSETS, QA_I18N_USAGE_FILE), `${JSON.stringify(usageReport(r.localised), null, 1)}\n`);
  }
  if (r.fhir.content) {
    mkdirSync(join(site, FHIR_QA_ASSETS), { recursive: true });
    writeFileSync(join(site, CONTENT_QA_PUBLISHED), `${JSON.stringify(r.fhir.content, null, 2)}\n`);
  }
  return copyKgQaRecords(r.kg, site, KG_QA_ASSETS);
}

function main(): number {
  const arg = (k: string) => {
    const i = process.argv.indexOf(`--${k}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const root = arg("instance-root");
  const docs = arg("docs");
  if (!root || !docs) {
    console.error("usage: ig-qa-page.ts --instance-root <dir> --docs <jekyll source> [--ast <dir>] [--work <dir>] [--title <title>]");
    return 2;
  }
  const work = arg("work");
  const r = buildQaPage({ root, ast: arg("ast") ?? join(root, "output-ast"), ...(work ? { validity: join(work, "ig-ast-validity.json") } : {}), ...(arg("title") ? { title: arg("title")! } : {}) });
  writeFileSync(join(resolve(docs), "qa.md"), r.page);
  const records = publishQaAssets(r, resolve(docs));
  console.log(`qa.md: FHIR QA ${r.fhir.publisher ? "with" : "without"} the Publisher's summary; KG QA over ${r.kg.instances.length} instance(s), ${records} record(s)`);
  return 0;
}

if (import.meta.main) process.exit(main());

/**
 * The page script: the Publisher's `qa.html` layout, drawn from `qa.json` and
 * `qa-messages.json` (ValidationPresenter: the header, the "Quality Checks"
 * table, the file table, then each file's Path / Severity / Message table,
 * in the Publisher's colours). Plain ES5, every value written as text.
 */
export const QA_MESSAGES_JS = String.raw`(function () {
  "use strict";
  var COLOR = { fatal: "#ff9999", error: "#ffdddd", warning: "#ffebcc", information: "#ffffe6" };
  var boxes = document.querySelectorAll(".ig-qa-publisher");
  if (boxes.length && !document.getElementById("ig-qa-publisher-css")) {
    var css = document.createElement("style");
    css.id = "ig-qa-publisher-css";
    css.textContent =
      ".ig-qa-publisher table.grid{border-collapse:collapse;margin:0 0 1em;font-size:.85em;width:auto}" +
      ".ig-qa-publisher table.grid td{border:1px solid #888;padding:3px 6px;vertical-align:top;color:#000}" +
      ".ig-qa-publisher table.grid td.plain{color:inherit}" +
      ".ig-qa-publisher .mid{font-size:8px;color:navy;display:none}" +
      ".ig-qa-publisher.show-ids .mid{display:inline}" +
      ".ig-qa-publisher .en{display:none;font-weight:normal;font-size:.9em;color:#333}" +
      ".ig-qa-publisher.show-en .en{display:block}" +
      ".ig-qa-publisher .mt{font-size:.75em;font-weight:normal;color:#555;margin-inline-start:.5em}" +
      ".ig-qa-publisher tr:target td{outline:2px solid #276749}" +
      ".ig-qa-publisher .grid-wrap{overflow-x:auto}";
    document.head.appendChild(css);
  }
  for (var i = 0; i < boxes.length; i++) run(boxes[i]);

  /** The box's words, in the page's language (data-labels, ig-qa-page-i18n.ts), English otherwise. */
  function labels(box) {
    var EN = {
      jsResultsFor: "Validation Results for {title}", jsThisIg: "this IG", jsGenerated: "Generated {date}, FHIR version {version} for ",
      jsCanonical: " (canonical = ", jsQualityChecks: "Quality Checks", jsPublisherVersion: "Publisher Version:", jsSummary: "Summary:",
      jsCounts: " errors = {errs}, warn = {warn}, info = {info}, broken links = {links}.  ", jsShowIds: "Show Message Ids", jsHideIds: "Hide Message Ids",
      jsShowEnglish: "Show English", jsHideEnglish: "Hide English", jsFilename: "Filename", jsErrors: "Errors", jsWarnings: "Warnings", jsHints: "Hints",
      jsBuildErrors: "Build Errors", jsPage: "(page)", jsSource: "(source)", jsUpFiles: "\u2191 files", jsGroupCounts: "  ({err} errors, {warn} warnings, {info} hints) ",
      jsPath: "Path", jsSeverity: "Severity", jsMessage: "Message", jsNoMessages: "No messages: {why}.", jsNoneReported: "The Publisher reported no messages.",
      jsCouldNotLoad: "Could not load the Publisher's messages ({error}).", jsMachine: "machine translation",
      jsSevFatal: "fatal", jsSevError: "error", jsSevWarning: "warning", jsSevInformation: "information"
    };
    var given = {};
    try { given = JSON.parse(box.getAttribute("data-labels") || "{}") || {}; } catch (e) { given = {}; }
    return function (k, vars) {
      var s = typeof given[k] === "string" ? given[k] : EN[k] || k;
      return s.replace(/\{([A-Za-z]\w*)\}/g, function (m, n) { return vars && Object.prototype.hasOwnProperty.call(vars, n) ? String(vars[n]) : m; });
    };
  }
  var SEV = { fatal: "jsSevFatal", error: "jsSevError", warning: "jsSevWarning", information: "jsSevInformation" };

  function el(tag, text, attrs) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = String(text);
    for (var k in attrs || {}) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    return e;
  }
  function getJson(u) {
    return fetch(u).then(function (r) {
      if (!r.ok) throw new Error(u + " answered HTTP " + r.status);
      return r.json();
    });
  }
  function row(cells, color, bold) {
    var tr = el("tr", null, color ? { style: "background-color: " + color } : null);
    cells.forEach(function (c) {
      var td = el("td", null, color ? null : { "class": "plain" });
      if (c && c.nodeType) td.appendChild(c);
      else if (bold) td.appendChild(el("b", c));
      else td.textContent = c == null ? "" : String(c);
      tr.appendChild(td);
    });
    return tr;
  }
  function wrap(table) {
    var d = el("div", null, { "class": "grid-wrap" });
    d.appendChild(table);
    return d;
  }
  function counts(g) {
    var c = { err: 0, warn: 0, info: 0 };
    g.messages.forEach(function (m) {
      if (m.severity === "error" || m.severity === "fatal") c.err++;
      else if (m.severity === "warning") c.warn++;
      else c.info++;
    });
    return c;
  }

  function run(box) {
    var pagesUrl = box.getAttribute("data-pages");
    Promise.all([
      getJson(box.getAttribute("data-summary")).catch(function () { return {}; }),
      getJson(box.getAttribute("data-messages")),
      pagesUrl ? getJson(pagesUrl).catch(function () { return []; }) : Promise.resolve([]),
    ])
      .then(function (r) {
        var pages = {};
        (Array.isArray(r[2]) ? r[2] : []).forEach(function (p) { pages[p] = true; });
        var q = r[0] || {};
        var canon = typeof q.url === "string" ? q.url.replace(/\/ImplementationGuide\/[^\/]+$/, "") : "";
        draw(box, q, r[1] || {}, labels(box), {
          pages: pages,
          artifacts: box.getAttribute("data-artifacts") || "artifact/",
          source: box.getAttribute("data-source") || "",
          canon: canon,
        });
      })
      .catch(function (e) {
        box.textContent = "";
        box.appendChild(el("p", labels(box)("jsCouldNotLoad", { error: e.message })));
      });
  }

  /** The site's page for a resource named Type-id, when the site has one. */
  function pageFor(L, name) {
    return L.pages[name + ".html"] ? L.artifacts + name + ".html" : null;
  }
  /** A message file: its artifact page on this site, and its source at the built commit when it is tracked (input/...). */
  function fileCell(L, file, label, T) {
    var span = el("span", null, file ? { dir: "ltr" } : null);
    var base = file ? file.replace(/^.*\//, "").replace(/\.(json|xml|fsh)$/, "") : "";
    var page = base && pageFor(L, base);
    span.appendChild(page ? el("a", label, { href: page }) : document.createTextNode(label));
    if (file && L.source && /^input\//.test(file)) {
      span.appendChild(document.createTextNode(" "));
      span.appendChild(el("a", T("jsSource"), { href: L.source + file.split("/").map(encodeURIComponent).join("/") }));
    }
    return span;
  }
  /** Message text with each URL linked: one of this IG's canonicals to its page here, any other to itself. */
  function linkText(L, text) {
    var out = el("b");
    var re = /https?:\/\/[^\s'"<>()|]+[^\s'"<>()|.,;:]/g;
    var last = 0;
    var m;
    while ((m = re.exec(text))) {
      out.appendChild(document.createTextNode(text.slice(last, m.index)));
      var u = m[0].replace(/\|.*$/, "");
      var href = u;
      if (L.canon && u.indexOf(L.canon + "/") === 0) {
        var rest = u.slice(L.canon.length + 1).split("/");
        if (rest.length === 2) href = pageFor(L, rest[0] + "-" + rest[1]) || u;
      }
      out.appendChild(el("a", m[0], { href: href }));
      last = m.index + m[0].length;
    }
    out.appendChild(document.createTextNode(text.slice(last)));
    return out;
  }

  function draw(box, q, m, T, L) {
    box.textContent = "";
    var groups = Array.isArray(m.groups) ? m.groups : [];
    var hasEn = groups.some(function (g) { return g.messages.some(function (x) { return typeof x.en === "string"; }); });
    box.appendChild(el("h4", T("jsResultsFor", { title: q.title || q.name || T("jsThisIg") })));
    var p = el("p");
    p.appendChild(document.createTextNode(T("jsGenerated", { date: q.date || q.dateISO8601 || "?", version: q.version || "?" })));
    var igName = (q["package-id"] || "?") + "#" + (q["ig-ver"] || "?");
    var igPage = q["package-id"] && pageFor(L, "ImplementationGuide-" + q["package-id"]);
    p.appendChild(igPage ? el("a", igName, { href: igPage }) : document.createTextNode(igName));
    if (q.url) {
      p.appendChild(document.createTextNode(T("jsCanonical")));
      var a = el("a", q.url, { href: q.url });
      p.appendChild(a);
      p.appendChild(document.createTextNode(")"));
    }
    p.appendChild(document.createTextNode("."));
    box.appendChild(p);

    var qc = el("table", null, { "class": "grid" });
    var head = el("tr");
    var th = el("td", null, { colspan: "2", "class": "plain" });
    th.appendChild(el("b", T("jsQualityChecks")));
    head.appendChild(th);
    qc.appendChild(head);
    qc.appendChild(row([T("jsPublisherVersion"), q.tool || "?"]));
    function toggle(cls, on1, off1) {
      var b = el("button", T(off1), { type: "button" });
      b.addEventListener("click", function () {
        var on = (" " + box.className + " ").indexOf(" " + cls + " ") < 0;
        box.className = on ? box.className + " " + cls : box.className.replace(new RegExp(" ?" + cls + "\\b"), "");
        b.textContent = T(on ? on1 : off1);
      });
      return b;
    }
    var sum = el("span");
    var na = function (v) { return v != null ? v : "?"; };
    sum.appendChild(document.createTextNode(T("jsCounts", { errs: na(q.errs), warn: na(q.warnings), info: na(q.hints), links: na(q["broken-links"]) })));
    sum.appendChild(toggle("show-ids", "jsHideIds", "jsShowIds"));
    if (hasEn) {
      sum.appendChild(document.createTextNode(" "));
      sum.appendChild(toggle("show-en", "jsHideEnglish", "jsShowEnglish"));
    }
    qc.appendChild(row([T("jsSummary"), sum]));
    box.appendChild(wrap(qc));

    var files = el("table", null, { "class": "grid", id: "qa-files" });
    files.appendChild(row([T("jsFilename"), T("jsErrors"), T("jsWarnings"), T("jsHints")], null, true));
    groups.forEach(function (g, i) {
      var c = counts(g);
      var b = el("b");
      b.appendChild(el("a", g.file || T("jsBuildErrors"), g.file ? { href: "#qa-f" + i, dir: "ltr" } : { href: "#qa-f" + i }));
      var base = g.file ? g.file.replace(/^.*\//, "").replace(/\.(json|xml|fsh)$/, "") : "";
      var page = base && pageFor(L, base);
      if (page) {
        b.appendChild(document.createTextNode(" "));
        b.appendChild(el("a", T("jsPage"), { href: page }));
      }
      files.appendChild(row([b, String(c.err), String(c.warn), String(c.info)], c.err ? COLOR.error : "#EFFFEF"));
    });
    box.appendChild(wrap(files));
    if (!groups.length) box.appendChild(el("p", m.absent ? T("jsNoMessages", { why: m.absent }) : T("jsNoneReported")));

    groups.forEach(function (g, i) {
      box.appendChild(el("hr"));
      var c = counts(g);
      var h = el("h5", null, { id: "qa-f" + i });
      h.appendChild(fileCell(L, g.file, g.file || T("jsBuildErrors"), T));
      h.appendChild(document.createTextNode(T("jsGroupCounts", { err: c.err, warn: c.warn, info: c.info })));
      h.appendChild(el("a", T("jsUpFiles"), { href: "#qa-files" }));
      box.appendChild(h);
      var t = el("table", null, { "class": "grid" });
      t.appendChild(row([T("jsPath"), T("jsSeverity"), T("jsMessage")], null, true));
      g.messages.forEach(function (msg, j) {
        var where = (msg.path || "") + (msg.line > 0 ? " (l" + msg.line + "/c" + msg.col + ")" : "");
        var text = el("span");
        text.appendChild(linkText(L, msg.text));
        if (msg.origin === "machine") text.appendChild(el("span", T("jsMachine"), { "class": "mt" }));
        if (msg.messageId) {
          text.appendChild(document.createTextNode(" "));
          text.appendChild(el("span", msg.messageId, { "class": "mid" }));
        }
        // The Publisher's own words, for a reader checking the translation ("Show English").
        if (typeof msg.en === "string") text.appendChild(el("span", msg.en, { "class": "en", lang: "en", dir: "ltr" }));
        // Paths and file names are Latin text: isolated left-to-right, so a right-to-left page does not flip their punctuation.
        var pw = el("b", where, { dir: "ltr" });
        var sv = el("b", SEV[msg.severity] ? T(SEV[msg.severity]) : msg.severity);
        var tr = row([pw, sv, text], COLOR[msg.severity] || COLOR.information);
        // Each row addressable, so a catalogue's "rendered at" link and the where-used report land on it.
        tr.id = "qa-m" + i + "-" + j;
        t.appendChild(tr);
      });
      box.appendChild(wrap(t));
    });
  }
})();
`;
