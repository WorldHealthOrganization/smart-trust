/**
 * The IG's version chrome on every page of its site: the three things the IG
 * Publisher's pages carry and ours did not (owner, 2026-11-14, from a
 * published IG: "missing some chrome (versions, releases etc)").
 *
 * 1. **The version beside the IG's title** in the page bar: `1.7.5 - ci-build`
 *    and the jurisdiction's flag ({@link igVersionTag}). Owner: "put version
 *    to right of IG title, not near search/locale selector".
 * 2. **The version banner** under the bar ({@link igVersionBanner}): which
 *    version and status THIS build is, the FHIR version it is based on, and
 *    the Directory of published versions at the IG's canonical
 *    (`<canonical>/history.html`, the Publisher's own convention). It states
 *    this build's own version, never the latest release's: a CI build that
 *    said "v1.7.4: Release" would be a false statement on every page (owner's
 *    card answer: "This build, every page").
 * 3. **The metadata table** (Official URL, Version, status as of date,
 *    Computable Name) on the IG's home page ({@link igMetadataTable}); the
 *    artefact pages draw their own from the artefact index
 *    (`ig-thin-pages.ts`).
 *
 * Every fact is read from the IG's own `sushi-config.yaml` ({@link igVersionFacts}):
 * nothing here names a publisher, a canonical or an IG. A fact the config
 * does not state is left out, never guessed.
 *
 * {@link stampIgVersionChrome} lays all three over the FINISHED site, keyed on
 * what each page holds (the IG's bar), as {@link stampIgBar} gives every page
 * the bar: the composed pages, the thin artefact and list pages, the pages
 * other layers wrote, every language and every preview. It is idempotent.
 *
 * @module fhir-harness/scripts/ig-version-chrome
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import { fhirSpecUrl } from "./ig-footer.ts";
import { igReadScope } from "./ig-read-scope.ts";

/** What the version chrome states, each from `sushi-config.yaml`. */
export interface IgVersionFacts {
  title: string;
  id?: string;
  name?: string;
  version?: string;
  /** `releaseLabel`, e.g. `ci-build`, `release`, `ballot`. */
  releaseLabel?: string;
  /** `status`, e.g. `draft`, `active`. */
  status?: string;
  /** The first `fhirVersion`, e.g. `4.0.1`. */
  fhirVersion?: string;
  /** `canonical`, without a trailing slash. */
  canonical?: string;
  /** `date`, as written. */
  date?: string;
  /** The jurisdiction's flag: a country's regional-indicator pair, or a globe for the world. */
  flag?: string;
  /** What the flag stands for, for its accessible name. */
  flagLabel?: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : undefined);

/** A jurisdiction coding's code: `{system, code}`, `system#code`, or `{coding:[…]}`. */
function jurisdictionCode(j: unknown): { system?: string; code?: string } | undefined {
  const first = Array.isArray(j) ? j[0] : j;
  if (typeof first === "string") {
    const i = first.lastIndexOf("#");
    return i < 0 ? { code: first } : { system: first.slice(0, i), code: first.slice(i + 1) };
  }
  if (first && typeof first === "object") {
    const o = first as { coding?: unknown; system?: unknown; code?: unknown };
    if (Array.isArray(o.coding)) return jurisdictionCode(o.coding[0]);
    return { system: str(o.system), code: str(o.code) };
  }
  return undefined;
}

/**
 * The flag for a jurisdiction: UN M49 `001` (World) is a globe; an ISO 3166
 * two-letter code is its regional-indicator pair. Anything else has none.
 */
export function jurisdictionFlag(j: unknown): { flag: string; label: string } | undefined {
  const c = jurisdictionCode(j);
  if (!c?.code) return undefined;
  if (/m49/i.test(c.system ?? "") && c.code === "001") return { flag: "\u{1F310}", label: "International" };
  if (/^[A-Za-z]{2}$/.test(c.code) && (!c.system || /3166/.test(c.system))) {
    const up = c.code.toUpperCase();
    return { flag: [...up].map((ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65)).join(""), label: up };
  }
  return undefined;
}

/** The facts from a parsed `sushi-config.yaml`. Pure. */
export function versionFactsFrom(cfg: Record<string, unknown>): IgVersionFacts {
  const fv = Array.isArray(cfg.fhirVersion) ? str(cfg.fhirVersion[0]) : str(cfg.fhirVersion);
  const flag = jurisdictionFlag(cfg.jurisdiction);
  const f: IgVersionFacts = { title: str(cfg.title) ?? str(cfg.name) ?? str(cfg.id) ?? "IG" };
  const set = <K extends keyof IgVersionFacts>(k: K, v: IgVersionFacts[K] | undefined): void => {
    if (v !== undefined) f[k] = v;
  };
  set("id", str(cfg.id));
  set("name", str(cfg.name));
  set("version", str(cfg.version));
  set("releaseLabel", str(cfg.releaseLabel));
  set("status", str(cfg.status));
  set("fhirVersion", fv);
  set("canonical", str(cfg.canonical)?.replace(/\/+$/, ""));
  set("date", cfg.date instanceof Date ? cfg.date.toISOString().slice(0, 10) : str(cfg.date));
  if (flag) {
    f.flag = flag.flag;
    f.flagLabel = flag.label;
  }
  return f;
}

/** The facts from an IG checkout's own `sushi-config.yaml`; undefined when it has none. */
export function igVersionFacts(ig: string): IgVersionFacts | undefined {
  const scope = igReadScope(ig);
  if (!scope.declares("sushi-config.yaml")) return undefined;
  const f = scope.path("sushi-config.yaml");
  if (!existsSync(f)) return undefined;
  const cfg = (parseYaml(readFileSync(f, "utf-8")) ?? {}) as Record<string, unknown>;
  return versionFactsFrom(cfg);
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** `1.7.5 - ci-build`: the version and its release label (else its status). */
export function versionLabel(f: IgVersionFacts): string | undefined {
  if (!f.version) return undefined;
  const label = f.releaseLabel ?? f.status;
  return label ? `${f.version} - ${label}` : f.version;
}

/** The full bar's title line: the IG's title and its version, one item of the bar's row. */
export const IG_TOPBAR_HEAD_CLASS = "ig-topbar-head";

/** The class of the version beside the IG's title, and the marker that it is there. */
export const IG_VERSION_TAG_CLASS = "ig-topbar-ver";

/** The version beside the IG's title; empty when the config states no version. */
export function igVersionTag(f: IgVersionFacts): string {
  const label = versionLabel(f);
  if (!label) return "";
  const flag = f.flag ? `<span class="ig-topbar-flag" role="img" aria-label="${esc(f.flagLabel ?? "")}" title="${esc(f.flagLabel ?? "")}">${f.flag}</span> ` : "";
  return `<span class="${IG_VERSION_TAG_CLASS}">${flag}${esc(label)}</span>`;
}

/** The class of the version banner, and the marker that it is there. */
export const IG_VERSION_BANNER_CLASS = "ig-version-banner";

/** Is this build a continuous-integration build, by its own label? */
const isCi = (f: IgVersionFacts): boolean => /^ci[-_ ]?build$/i.test(f.releaseLabel ?? "");

/**
 * The version banner: the Publisher's sentence, stating THIS build's own
 * version and label. Empty when the config states no version.
 */
export function igVersionBanner(f: IgVersionFacts): string {
  if (!f.version) return "";
  const label = f.releaseLabel ?? f.status;
  const spec = fhirSpecUrl(f.fhirVersion);
  const fhirName = f.fhirVersion ? `FHIR (HL7® FHIR® Standard) v${esc(f.fhirVersion)}` : "";
  const fhir = f.fhirVersion ? ` based on ${spec ? `<a href="${esc(spec)}">${fhirName}</a>` : fhirName}` : "";
  const which = isCi(f)
    ? " This is the continuous integration build: it follows the source and is not a published version."
    : "";
  const history = f.canonical
    ? ` For a full list of available versions, see the <a href="${esc(`${f.canonical}/history.html`)}">Directory of published versions</a>.`
    : "";
  return `<p class="${IG_VERSION_BANNER_CLASS}" role="note">This page is part of the ${esc(f.title)} (v${esc(f.version)}${label ? `: ${esc(label)}` : ""})${fhir}.${which}${history}</p>`;
}

/** A FHIR status code as the Publisher's table writes it: `active` → `Active`. */
const statusWord = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The class of a metadata table, and the marker that it is there. */
export const IG_METADATA_CLASS = "ig-metadata";

/**
 * The Publisher's metadata table for one canonical resource: Official URL and
 * Version, then status (as of its date) and Computable Name. A row's cell is
 * left out when its fact is not stated; no URL, no table.
 */
export function igMetadataTable(r: { url?: string; version?: string; status?: string; date?: string; name?: string }): string {
  if (!r.url) return "";
  const cell = (html: string): string => `<td>${html}</td>`;
  const row1 = cell(`Official URL: <code class="ig-metadata-url">${esc(r.url)}</code>`) + (r.version ? cell(`Version: ${esc(r.version)}`) : "");
  const state = r.status ? `${esc(statusWord(r.status))}${r.date ? ` as of ${esc(r.date)}` : ""}` : r.date ? `As of ${esc(r.date)}` : "";
  const row2 = (state ? cell(state) : "") + (r.name ? cell(`Computable Name: ${esc(r.name)}`) : "");
  return `<table class="${IG_METADATA_CLASS}"><tbody><tr>${row1}</tr>${row2 ? `<tr>${row2}</tr>` : ""}</tbody></table>`;
}

/** The IG's own row: its ImplementationGuide's canonical URL, version, status, date and name. */
export function igOwnMetadataTable(f: IgVersionFacts): string {
  if (!f.canonical || !f.id) return "";
  return igMetadataTable({ url: `${f.canonical}/ImplementationGuide/${f.id}`, version: f.version, status: f.status, date: f.date, name: f.name });
}

/**
 * The chrome's style, scoped to its own classes. The banner wears the
 * Publisher's yellow box (`--publish-box-bg-color: yellow`, its `project.css`),
 * kept readable in the dark scheme; the table its plain bordered cells.
 */
export const IG_VERSION_CHROME_CSS =
  `.ig-topbar-head{flex:0 0 100%;display:flex;flex-wrap:wrap;align-items:baseline;gap:.25rem .9rem}` +
  `.ig-topbar-head .ig-topbar-home{flex:none}` +
  `.ig-topbar-ver{font-weight:400;font-size:.9em;opacity:.95;white-space:nowrap}` +
  `.ig-topbar-flag{font-size:1.1em}` +
  `.${IG_VERSION_BANNER_CLASS}{box-sizing:border-box;margin:0;padding:.5rem 1.5rem;background:#ffffa0;color:#222;border-bottom:1px solid #0a0008;font-size:.95rem;line-height:1.45}` +
  `.${IG_VERSION_BANNER_CLASS} a{color:#1a4b8c;text-decoration:underline}` +
  `html:not([data-fa-scheme="light"]) .${IG_VERSION_BANNER_CLASS}{background:#4a4520;color:#fff8d0;border-color:#8a7d2a}` +
  `html:not([data-fa-scheme="light"]) .${IG_VERSION_BANNER_CLASS} a{color:#ffe680}` +
  `.${IG_METADATA_CLASS}{border-collapse:collapse;margin:0 0 1rem;font-size:.95rem}` +
  `.${IG_METADATA_CLASS} td{border:1px solid #c8c8c8;padding:.25rem .6rem;vertical-align:top}` +
  `.${IG_METADATA_CLASS} code{overflow-wrap:anywhere}`;

/** Marks the style block, so a page carries it once. */
const STYLE_MARK = "data-ig-version-chrome";

/** The anchor of the IG's title in each kind of bar: the full bar, the slim bar, a thin page's own header. */
const TITLE_ANCHOR = /<a class="(?:ig-topbar-home|ig-search-home|iga-home)"[^>]*>[\s\S]*?<\/a>/;

/** Where the bar that holds the title ends: its matching close tag, counting nested elements of its own name. */
export function barEnd(html: string, barStart: number): number | undefined {
  const tag = /^<(div|header|nav)\b/i.exec(html.slice(barStart))?.[1]?.toLowerCase();
  if (!tag) return undefined;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = barStart;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return undefined;
}

/** The start of the element holding the title anchor: the nearest bar opening before it. */
function barStart(html: string, anchorAt: number): number | undefined {
  const before = html.slice(0, anchorAt);
  const at = Math.max(
    before.lastIndexOf('<div class="ig-topbar'),
    before.lastIndexOf('<header class="ig-search-top'),
    before.lastIndexOf('<header class="iga-top'),
  );
  return at < 0 ? undefined : at;
}

/** Is this the site's home page, or a language's (`index.html`, `<lang>/index.html`)? */
export const isHomePage = (rel: string): boolean => /^(?:[a-z]{2,3}(?:-[A-Za-z]{2,4})?\/)?index\.html$/.test(rel);

/**
 * One page with the version chrome: the version after the IG's title, the
 * banner after the bar, and on a home page the IG's metadata table at the top
 * of `<main>`. A page with no IG bar, or that already carries the chrome, is
 * returned as it was. Pure.
 */
export function withIgVersionChrome(html: string, f: IgVersionFacts, o: { home: boolean }): string {
  if (html.includes(`class="${IG_VERSION_BANNER_CLASS}"`) || html.includes(`class="${IG_VERSION_TAG_CLASS}"`)) return html;
  const a = TITLE_ANCHOR.exec(html);
  if (!a) return html;
  const tag = igVersionTag(f);
  const banner = igVersionBanner(f);
  if (!tag && !banner) return html;
  const start = barStart(html, a.index);
  const end = start === undefined ? undefined : barEnd(html, start);
  const anchorEnd = a.index + a[0].length;
  // On the full bar the title holds a line of its own, above the menu; the
  // version shares that line, so the two are one item of the bar's row.
  const head = tag && a[0].startsWith('<a class="ig-topbar-home"') ? [`<span class="${IG_TOPBAR_HEAD_CLASS}">`, "</span>"] : ["", ""];
  let out =
    html.slice(0, a.index) + head[0] + a[0] + tag + head[1] + html.slice(anchorEnd, end ?? anchorEnd) + (end !== undefined ? banner : "") + html.slice(end ?? anchorEnd);
  if (o.home) {
    const table = igOwnMetadataTable(f);
    const main = /<main\b[^>]*>/i.exec(out);
    if (table && main && !out.includes(`class="${IG_METADATA_CLASS}"`)) {
      const at = main.index + main[0].length;
      out = out.slice(0, at) + table + out.slice(at);
    }
  }
  if (!out.includes(STYLE_MARK)) {
    const head = out.search(/<\/head>/i);
    if (head >= 0) out = out.slice(0, head) + `<style ${STYLE_MARK}>${IG_VERSION_CHROME_CSS}</style>` + out.slice(head);
  }
  return out;
}

/** Every HTML page under `site`, as paths relative to it, outside `assets/`. */
function pagesUnder(site: string, rel = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(site, rel))) {
    const r = rel ? `${rel}/${e}` : e;
    if (r === "assets") continue;
    const abs = join(site, r);
    if (statSync(abs).isDirectory()) out.push(...pagesUnder(site, r));
    else if (/\.html?$/i.test(e)) out.push(r);
  }
  return out;
}

/** An immediate meta-refresh redirect stub: no reader stays on it. */
const isRedirect = (html: string): boolean => /<meta\s[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["']?\s*0\s*[;,]/i.test(html);

/** The version chrome on every page of the built site that holds the IG's bar. Returns how many pages changed. */
export function stampIgVersionChrome(site: string, f: IgVersionFacts): { pages: number } {
  let n = 0;
  for (const rel of pagesUnder(site)) {
    const abs = join(site, rel);
    const html = readFileSync(abs, "utf-8");
    if (isRedirect(html)) continue;
    const after = withIgVersionChrome(html, f, { home: isHomePage(rel) });
    if (after !== html) {
      writeFileSync(abs, after);
      n++;
    }
  }
  return { pages: n };
}
