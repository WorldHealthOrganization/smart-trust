/**
 * The translation status page — what the gettext side actually covers.
 *
 * @module scripts/gen-translation-status
 * @covers translation-sources
 *
 * It is the viewer of the `translation-sources` graph (`translations/`). That
 * graph is authored input to injection, not state, so `state-visualizer.ts`
 * (which draws only `isStateGraph` kinds) skips it.
 *
 * ## What it measures, and what it refuses to guess
 *
 *   1. IS THERE A CATALOGUE AT ALL? `.pot` templates are what CAN be
 *      translated; `.po` catalogues are what somebody started. A locale with
 *      few catalogues is mostly unreachable however complete its strings are.
 *   2. OF THE CATALOGUES THAT EXIST, how much is translated, fuzzy, or empty.
 *
 * It never reports (2) without (1). Every number is DERIVED from the files on
 * each run; there is no baseline to go stale.
 *
 * ## Paths come from the DECLARATION
 *
 * The translations directory is resolved from the layer's own
 * `<instance>.json` (`translation-sources`), and the site directory from
 * `siteDirFor`. Neither is written here; `site-dir-single-answer.test.ts`
 * guards the second across the whole tree.
 *
 * ## `--instance <dir>`: another layer's catalogues, reported
 *
 * The page and projection this generator writes are THIS layer's viewer, at
 * a route this layer declares, so another layer's numbers are not
 * written there. With `--instance`, the layer at `<dir>` is measured from
 * its own `translation-sources` declaration and the per-locale table is
 * printed (or emitted as the projection's `locales` array with `--json`);
 * nothing is written, with or without `--check`. A layer that declares no
 * such directory exits 2, as this one would.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { findDeclarationFile, instanceDirectories, readDeclaration, siteDirFor } from "../schemas/kg/cat-harness.js";
import { tileCounts } from "../schemas/ui/tile-count.js";
import { siteRootFrom } from "../schemas/kg/visualiser-route.js";
import { pageParts, tileDirectories, visualiserSitePath, withRenderedByFrontMatter } from "./viewer-declarations.js";
import { themedPage } from "./lib/themed-page.ts";
import { explicitInstanceRoot, HARNESS_ROOT } from "./lib/roots.ts";
import { localSiteDir } from "./lib/local-site-dir.ts";
import { siteArg, sitePageAt, siteTarget } from "./lib/site-target.ts";
import { SKILL_PAGES_DIR } from "./lib/skill-pages.ts";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.ts";
import { officialityFindings, readLocale } from "./check-translation-officiality.ts";
import { poHeader } from "./kg-viewer-strings.ts";
import { reviewBody, reviewLayer, type ReviewLayer } from "./lib/translation-review-page.ts";
import { ADJUDICATION_FENCE_INFO, ADJUDICATION_LABEL, CANDIDATES_SCHEMA, CANDIDATES_SUFFIX, ADJUDICATION_SCHEMA, ADJUDICATION_TITLE_PREFIX, MAX_ISSUE_URL } from "./lib/translation-adjudication.ts";
import { criteriaAttestationsHome } from "../schemas/sdlc/qa-attestations.ts";

/** This generator's Tool node (`tools/viewers.ts`), named on every page it draws. */
const VIEWER_TOOL = "translation-status-viewer";

function resolveRepoRoot(root: string): string {
  if (root.includes("/.claude/worktrees/")) {
    const coord = resolve(root.split("/.claude/worktrees/")[0]!);
    if (existsSync(join(coord, "index.config.json"))) return coord;
  }
  return resolve(root, "..");
}

const ROOT = resolve(HARNESS_ROOT);
const REPO_ROOT = resolveRepoRoot(ROOT);

/** The projection's own tag. A file declares what it is — the contract
 *  `directory-conventions` states for every node here. */
export const TRANSLATION_STATUS_SCHEMA = "folio-translation-status/v1";

const displayNames = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });

/**
 * Human-readable language name for an ISO 639-1 / BCP 47 locale code.
 */
export function languageName(locale: string): string | undefined {
  try {
    return displayNames.of(locale);
  } catch {
    return undefined;
  }
}

/** One catalogue's string counts. */
export interface CatalogueCounts {
  /** Entries with a non-empty `msgid`. The header entry is NOT one. */
  entries: number;
  /** Entries whose translation is non-empty and not fuzzy. */
  translated: number;
  /** Entries carrying the `fuzzy` flag — present, but needing review. */
  fuzzy: number;
  /** Entries with an empty translation. */
  untranslated: number;
}

/**
 * Whether a person signed this locale off (issue #206), as the translation
 * drawer shows it — bean `cat-tools-bbnd`, owner ruling 2026-10-10: officiality
 * is read from BOTH the PO headers (`X-Folio-Official`) and the locale's
 * `status.json`, and the reader is told when they disagree rather than shown
 * one of the two. Computed by `check-translation-officiality.ts`'s own reader,
 * so the drawer and the gate cannot answer differently.
 */
export interface LocaleOfficiality {
  /**
   * `official`: status.json says so, names who and when, and every catalogue
   * agrees. `unofficial`: neither side claims it — today's state everywhere.
   * `disagree`: the two records say different things. `unreadable`: status.json
   * will not parse, so this run cannot say.
   */
  state: "official" | "unofficial" | "disagree" | "unreadable";
  signedOffBy?: string;
  signedOffAt?: string;
  /** Catalogues whose header says `X-Folio-Official: yes`. */
  officialCatalogues: number;
  /** How many disagreements the officiality check reports for this locale. */
  findings: number;
}

/** {@link LocaleOfficiality} for one locale directory. */
export function localeOfficiality(dir: string): LocaleOfficiality {
  const l = readLocale(dir);
  const findings = officialityFindings(l);
  const officialCatalogues = l.catalogues.filter((c) => c.official === "yes").length;
  if (l.status === null) return { state: "unreadable", officialCatalogues, findings: findings.length };
  const by = typeof l.status?.signedOffBy === "string" ? l.status.signedOffBy : undefined;
  const at = typeof l.status?.signedOffAt === "string" ? l.status.signedOffAt : undefined;
  const signed = { ...(by ? { signedOffBy: by } : {}), ...(at ? { signedOffAt: at } : {}) };
  if (findings.length > 0) return { state: "disagree", ...signed, officialCatalogues, findings: findings.length };
  return { state: l.status?.official === true ? "official" : "unofficial", ...signed, officialCatalogues, findings: 0 };
}

/** One catalogue in a locale, as the status page's per-row drawer lists it. */
export interface CatalogueRow extends CatalogueCounts {
  /** Relative to the locale directory. */
  path: string;
  /** The PO header `X-Folio-Official`, lower-cased; absent when unset. */
  official?: string;
}

export interface LocaleStatus extends CatalogueCounts {
  locale: string;
  /**
   * Each catalogue's counts and header, for the per-row drawer (bean
   * `cat-tools-bbnd`). Optional for the same reason as `officiality`.
   */
  files?: CatalogueRow[];
  /**
   * Who signed it off, from both records (bean `cat-tools-bbnd`). Optional
   * because a projection written before the field existed has none, and
   * "not recorded" is what the table then says, not "unofficial".
   */
  officiality?: LocaleOfficiality;
  /** `.pot` templates visible for this locale — what COULD be translated. */
  templates: number;
  /** `.po` catalogues present — what somebody started. */
  catalogues: number;
  /** Catalogues this run could not parse, by name. NEVER folded into a count. */
  unreadable: string[];
}

/**
 * Count the entries in a gettext `.po` catalogue.
 *
 * Hand-written rather than pulled from a library, and the reason is the one
 * this repository keeps paying: a dependency here would have to be added to
 * the CI image for a parse this small, and the awkward cases are few and
 * testable. They are ALL awkward, though, which is why this is exported and
 * has fixtures of its own rather than being a regex inline:
 *
 * - **The header entry has `msgid ""`** and a long `msgstr`. It is metadata,
 *   not a string anybody translates, and counting it inflates every locale by
 *   exactly one — invisibly, and in the direction that flatters.
 * - **`#, fuzzy` means present but unreviewed.** Counting it as translated is
 *   the single most misleading thing this parser could do, because fuzzy
 *   entries are precisely the ones a reviewer must look at.
 * - **Plurals** put the translation in `msgstr[0]`, `msgstr[1]`, … rather than
 *   `msgstr`. A parser that only knows `msgstr` reports every plural entry as
 *   untranslated.
 * - **Continuation lines** — a long string is written as several quoted lines
 *   after the keyword, so emptiness cannot be judged from the keyword's own
 *   line alone.
 */
export function countCatalogue(text: string): CatalogueCounts {
  const counts: CatalogueCounts = { entries: 0, translated: 0, fuzzy: 0, untranslated: 0 };

  // Entries are separated by blank lines. Splitting on them rather than
  // tracking state through the file keeps each entry independent, so one
  // malformed block cannot shift the interpretation of the rest.
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const isFuzzy = lines.some((l) => /^#,/.test(l) && /\bfuzzy\b/.test(l));

    // The value of a keyword is its own quoted part plus every bare quoted
    // continuation line that follows it.
    const valueOf = (keyword: RegExp): string | undefined => {
      const i = lines.findIndex((l) => keyword.test(l));
      if (i === -1) return undefined;
      const first = /"((?:[^"\\]|\\.)*)"/.exec(lines[i] ?? "");
      let v = first?.[1] ?? "";
      for (let j = i + 1; j < lines.length; j++) {
        const cont = /^\s*"((?:[^"\\]|\\.)*)"\s*$/.exec(lines[j] ?? "");
        if (!cont) break;
        v += cont[1];
      }
      return v;
    };

    const msgid = valueOf(/^\s*msgid\s/);
    if (msgid === undefined) continue;
    // The header. `msgid ""` with no plural is metadata, never a string.
    if (msgid === "") continue;

    counts.entries += 1;

    // Plural forms live in `msgstr[n]`; a singular entry uses `msgstr`. Taking
    // whichever is present means a plural entry is judged on its forms rather
    // than on a `msgstr` it does not have.
    const plural = lines.some((l) => /^\s*msgstr\[\d+\]/.test(l));
    const filled = plural
      ? lines.some((l) => {
          const m = /^\s*msgstr\[\d+\]\s*"((?:[^"\\]|\\.)*)"/.exec(l);
          return m !== null && m[1] !== "";
        })
      : (valueOf(/^\s*msgstr\s/) ?? "") !== "";

    if (isFuzzy) counts.fuzzy += 1;
    else if (filled) counts.translated += 1;
    else counts.untranslated += 1;
  }
  return counts;
}

/** Every file under `dir` with one of `exts`, recursively. */
function filesUnder(dir: string, exts: readonly string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

/**
 * Where the gettext sources are, READ from the declaration.
 *
 * Returns undefined when the layer declares no such directory — which is a
 * real state for a folio that has no translations, and is reported rather
 * than treated as an empty one.
 */
export function translationsDirOf(root: string): string | undefined {
  let dirs: Array<{ path: string; graphTypologies?: string[] }>;
  try {
    dirs = instanceDirectories(root);
  } catch {
    const file = findDeclarationFile(root);
    let decl: { directories?: Array<{ path: string; graphTypologies?: string[] }> } | undefined;
    if (file) {
      try {
        decl = JSON.parse(readFileSync(join(root, file), "utf-8"));
      } catch {}
    }
    dirs = decl?.directories ?? [];
  }
  const entry = dirs.find((d) => (d.graphTypologies ?? []).includes("translation-sources"));
  return entry === undefined ? undefined : join(root, entry.path);
}

export function localeStatuses(translationsDir: string): LocaleStatus[] {
  const out: LocaleStatus[] = [];
  for (const locale of readdirSync(translationsDir).sort()) {
    const dir = join(translationsDir, locale);
    if (!statSync(dir).isDirectory()) continue;

    const status: LocaleStatus = {
      locale,
      officiality: localeOfficiality(dir),
      files: [],
      templates: filesUnder(dir, [".pot"]).length,
      catalogues: 0,
      entries: 0,
      translated: 0,
      fuzzy: 0,
      untranslated: 0,
      unreadable: [],
    };

    for (const po of filesUnder(dir, [".po"])) {
      status.catalogues += 1;
      let text: string;
      try {
        text = readFileSync(po, "utf-8");
      } catch {
        // NAMED, never counted as zero. A catalogue that cannot be read is
        // "could not determine" for that file, and folding it into the
        // untranslated count would report a definite answer this run does
        // not have — the rule `ci-health` states and this repo holds
        // everywhere.
        status.unreadable.push(relative(translationsDir, po));
        continue;
      }
      const c = countCatalogue(text);
      const official = poHeader(text, "X-Folio-Official")?.toLowerCase();
      status.files!.push({ path: relative(dir, po), ...c, ...(official ? { official } : {}) });
      status.entries += c.entries;
      status.translated += c.translated;
      status.fuzzy += c.fuzzy;
      status.untranslated += c.untranslated;
    }
    out.push(status);
  }
  return out;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `n` of `d` as a percentage, or `null` when there is nothing to divide by. */
export function share(n: number, d: number): number | null {
  return d === 0 ? null : Math.round((n / d) * 1000) / 10;
}

/**
 * The same artefact with every ISO date blanked, for comparison only.
 *
 * `changedAt` is the ONE date either artefact carries, and it is rendered in
 * both — so blanking `\d{4}-\d{2}-\d{2}` reaches exactly it. Nothing else
 * here is a date: the locales are names and every other figure is a count.
 * If a date is ever added to the page for its own sake, this becomes too
 * blunt and the comparison has to name the field instead.
 *
 * It is what makes `changedAt` mean what it says. A re-run that reproduces
 * the same numbers leaves the file alone, so the date on the page is the day
 * the measurement last MOVED rather than the day somebody last ran a script
 * — which is the more useful of the two, and the only one a committed
 * artefact can state honestly.
 */
function undated(text: string): string {
  return text.replace(/\d{4}-\d{2}-\d{2}/g, "<date>");
}

/** A share for display. `null` is "no basis", NEVER "0%". */
function pct(v: number | null): string {
  return v === null ? '<span class="ts-none">no basis</span>' : `${v}%`;
}

/**
 * Another layer's `translation-sources` directory, measured the same way.
 *
 * Added for issue #2228: a layer's catalogues moved out of cat-harness's
 * directory into the layer's own on 2026-10-04 (bean `riit`), and from
 * then on this page, which measured one directory, no longer counted them. The move was
 * right and the page went quietly blind to it, which is the gap its own note
 * warned about. Each layer is a SEPARATE table, never summed into the
 * first: two layers' catalogues answer two questions.
 */
export interface InstanceStatus {
  /** The layer's declared name. */
  instance: string;
  /** Its `translation-sources` directory, repo-relative. */
  scope: string;
  locales: LocaleStatus[];
}

/**
 * Every OTHER layer in the checkout that declares a `translation-sources`
 * directory, sorted by name. Found the way `mount-instance-docs.ts` finds
 * layers — a top-level directory carrying a declaration — so cat-harness
 * names none of them.
 */
export function otherInstances(repoRoot: string, except: string): InstanceStatus[] {
  const out: InstanceStatus[] = [];
  let exceptName: string | undefined;
  try {
    exceptName = readDeclaration(except)?.name;
  } catch {}
  for (const e of readdirSync(repoRoot, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".") || e.name === "node_modules") continue;
    const dir = join(repoRoot, e.name);
    if (resolve(dir) === resolve(except)) continue;
    let tdir: string | undefined;
    let name = e.name;
    try {
      tdir = translationsDirOf(dir);
      name = readDeclaration(dir)?.name ?? e.name;
    } catch {
      const file = findDeclarationFile(dir);
      if (file) {
        try {
          const raw = JSON.parse(readFileSync(join(dir, file), "utf-8"));
          name = raw?.name ?? e.name;
        } catch {
          continue;
        }
      } else {
        continue;
      }
    }
    if (exceptName && name === exceptName) continue;
    if (tdir === undefined || !existsSync(tdir)) continue;
    out.push({ instance: name, scope: relative(repoRoot, tdir), locales: localeStatuses(tdir) });
  }
  return out.sort((a, b) => a.instance.localeCompare(b.instance, "en"));
}

/** One line on who signed a locale off — the visualiser's cell and the drawer's. */
export function officialityLabel(o: LocaleOfficiality): string {
  if (o.state === "official") return `official, signed off by ${o.signedOffBy ?? "?"} on ${o.signedOffAt ?? "?"}`;
  if (o.state === "disagree") return `records disagree (${o.findings}); run check:translation-officiality`;
  if (o.state === "unreadable") return "status.json unreadable: could not determine";
  return "not signed off (machine or agent translation)";
}

function localeTable(locales: LocaleStatus[], idPrefix: string, scope?: string): string {
  const rows = locales
    .map((l) => {
      const unread =
        l.unreadable.length === 0
          ? ""
          : `<div class="ts-warn">${l.unreadable.length} catalogue(s) unreadable: ` +
            `${esc(l.unreadable.join(", "))}</div>`;
      const lang = languageName(l.locale);
      const langLabel = lang ? ` <span class="ts-lang-name">${esc(lang)}</span>` : "";
      const fileLink = scope
        ? ` · <a href="https://github.com/litlfred/folio-assistant/tree/main/${esc(scope)}/${esc(l.locale)}" class="ts-files-link">view files &rarr;</a>`
        : "";
      return `<tr id="${esc(idPrefix)}locale-${esc(l.locale)}" data-fa-tr-locale="${esc(l.locale)}">
  <th scope="row" class="ts-col-locale"><code>${esc(l.locale)}</code>${langLabel}</th>
  <td class="ts-col-catalogues">${l.catalogues} / ${l.templates}<br><span class="ts-dim">${pct(share(l.catalogues, l.templates))}</span>${fileLink}</td>
  <td class="ts-col-strings">${l.entries}</td>
  <td class="ts-col-strings">${l.translated}<br><span class="ts-dim">${pct(share(l.translated, l.entries))}</span></td>
  <td class="ts-col-strings">${l.fuzzy}</td>
  <td class="ts-col-strings">${l.untranslated}${unread}</td>
  <td class="ts-col-official" data-fa-tr-officiality="${esc(l.officiality?.state ?? "absent")}">${esc(l.officiality ? officialityLabel(l.officiality) : "not recorded")}</td>
</tr>`;
    })
    .join("\n");
  return `<p class="ts-scroll-hint">Scroll horizontally to see all columns &rarr;</p>
<div class="ts-table-wrapper">
<table>
<thead>
<tr>
  <th scope="col" class="ts-col-locale">locale</th>
  <th scope="col" class="ts-col-catalogues">catalogues / templates<br><span class="ts-col-badge">Q1: availability</span></th>
  <th scope="col" class="ts-col-strings">entries<br><span class="ts-col-badge">Q2: strings</span></th>
  <th scope="col" class="ts-col-strings">translated</th>
  <th scope="col" class="ts-col-strings">fuzzy</th>
  <th scope="col" class="ts-col-strings">untranslated</th>
  <th scope="col" class="ts-col-official">official<br><span class="ts-col-badge">Q3: signed off</span></th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
</div>`;
}

export function statusPage(doc: {
  locales: LocaleStatus[];
  changedAt: string;
  /** The declared directory measured first, repo-relative. See the page note. */
  scope: string;
  /** Every other layer's declared directory, each its own table. */
  instances?: InstanceStatus[];
  /**
   * The prefix that climbs from this page's directory to the SITE ROOT, where
   * the reference pages live (`reference/skill-instructions/…`). It is the
   * page's declared route that fixes it — `<locale>/<harness>/<visualiser>/`
   * is three directories deep — so `main` passes `visualiserSitePath(…).up`;
   * the default is that same shape, never a hand-counted `../`.
   */
  siteRoot?: string;
  /**
   * Whether the site carries the `translation-manager` skill's page. False in
   * a repository's own site (`--site`), which holds no harness reference pages:
   * the skill is then named, not linked. True when absent.
   */
  skillPage?: boolean;
}): string {
  const siteRoot = doc.siteRoot ?? siteRootFrom(pageParts({ harness: "harness", visualiser: "visualiser" }));
  const skill = doc.skillPage === false
    ? "<code>translation-manager</code> skill"
    : `<a href="${siteRoot}reference/skill-instructions/translation-manager.html"><code>translation-manager</code> skill</a>`;
  const others = (doc.instances ?? [])
    .map(
      (i) => `
<h2 id="instance-${esc(i.instance)}">${esc(i.instance)}</h2>
<p class="ts-sub">Measured from <code>${esc(i.scope)}</code>, that instance's own <code>translation-sources</code> directory.</p>
${localeTable(i.locales, `${i.instance}-`, i.scope)}`,
    )
    .join("\n");

  // RENDERED SERVER-SIDE, with no JavaScript. The numbers are known at
  // generate time and a table has no interaction to speak of, so fetching them
  // would buy nothing and cost the accessibility floor every page here is held
  // to — the same reasoning `state-visualizer` gives for its QA table.
  //
  // THEMED since 2026-10-07 (`lib/themed-page.ts`): on the site's `default`
  // layout, so it carries the top band (search, Folio, language) that only
  // that layout delivers. Ground and ink are the theme's; every rule is scoped
  // under `.ts-page`, and the two hues it keeps are keyed on the site's own
  // scheme switch, dark first.
  return themedPage({
    title: "translations — status",
    generator: "cat-harness-tools/scripts/gen-translation-status.ts",
    command: "bun run translation:status",
    body: `<style>
.ts-page {
  --ts-dim: #c3c2b7;
  --ts-line: rgba(127,127,127,.4);
  --ts-line-distinct: rgba(127,127,127,.6);
  --ts-warn: #f0b429;
  --ts-col-bg: rgba(127,127,127,.06);
}
@media (prefers-color-scheme: light) {
  .ts-page {
    --ts-dim: #52514e;
    --ts-line: rgba(127,127,127,.25);
    --ts-line-distinct: rgba(127,127,127,.45);
    --ts-warn: #8a6100;
    --ts-col-bg: rgba(0,0,0,.03);
  }
}
:root[data-fa-scheme="dark"] .ts-page {
  --ts-dim: #c3c2b7;
  --ts-line: rgba(127,127,127,.4);
  --ts-line-distinct: rgba(127,127,127,.6);
  --ts-warn: #f0b429;
  --ts-col-bg: rgba(127,127,127,.06);
}
:root[data-fa-scheme="light"] .ts-page {
  --ts-dim: #52514e;
  --ts-line: rgba(127,127,127,.25);
  --ts-line-distinct: rgba(127,127,127,.45);
  --ts-warn: #8a6100;
  --ts-col-bg: rgba(0,0,0,.03);
}
.ts-page h1 { margin: 0 0 0.25rem; }
.ts-page .ts-sub { color: var(--ts-dim); margin: 0 0 1.5rem; font-size: 0.9rem; }
.ts-page .ts-scroll-hint { display: none; font-size: 0.78rem; color: var(--ts-dim); margin: 0 0 0.5rem; }
.ts-page .ts-table-wrapper { overflow-x: auto; position: relative; -webkit-overflow-scrolling: touch; margin: 0.5rem 0 1rem; }
.ts-page table { display: table; border-collapse: collapse; width: 100%; min-width: 36rem; }
.ts-page th, .ts-page td { border: 0; border-bottom: 1px solid var(--ts-line); background: transparent; padding: 0.5rem 0.6rem; text-align: right; vertical-align: top; }
.ts-page th[scope="row"], .ts-page thead th:first-child { text-align: left; }
.ts-page thead th { font-size: 0.8rem; color: var(--ts-dim); font-weight: 600; }
.ts-page th.ts-col-catalogues, .ts-page td.ts-col-catalogues { border-right: 2px solid var(--ts-line-distinct); background: var(--ts-col-bg); }
.ts-page .ts-col-badge { display: inline-block; font-size: 0.7rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; padding: 0.1rem 0.35rem; border-radius: 3px; background: rgba(127,127,127,.15); color: var(--ts-dim); margin-top: 0.2rem; }
.ts-page .ts-questions-legend { display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.82rem; color: var(--ts-dim); margin: 0.5rem 0 1rem; padding: 0.4rem 0.6rem; border-left: 3px solid var(--ts-line-distinct); background: var(--ts-col-bg); }
.ts-page .ts-dim { color: var(--ts-dim); font-size: 0.8rem; }
.ts-page td.ts-col-official { text-align: left; font-size: 0.82rem; }
.ts-page td.ts-col-official[data-fa-tr-officiality="disagree"], .ts-page td.ts-col-official[data-fa-tr-officiality="unreadable"] { color: var(--ts-warn); }
.ts-page .ts-none { color: var(--ts-dim); font-style: italic; }
.ts-page .ts-warn { color: var(--ts-warn); font-size: 0.8rem; text-align: left; margin-top: 0.3rem; }
.ts-page .ts-note { color: var(--ts-dim); font-size: 0.85rem; margin-top: 1.5rem; }
.ts-page .ts-lang-name { font-weight: normal; color: var(--ts-dim); font-size: 0.85rem; margin-left: 0.35rem; }
.ts-page .ts-onward { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--ts-line); }
.ts-page .ts-onward h2 { font-size: 1.1rem; margin: 0 0 0.5rem; }
.ts-page .ts-onward ul { margin: 0; padding-left: 1.25rem; font-size: 0.9rem; }
.ts-page .ts-onward li { margin-bottom: 0.35rem; }
.ts-page .ts-files-link { font-size: 0.75rem; color: var(--ts-dim); white-space: nowrap; }
.ts-page a { text-decoration: underline; text-underline-offset: 2px; }
@media (max-width: 799.98px) {
  .ts-page .ts-scroll-hint { display: block; }
  @supports (animation-timeline: scroll()) {
    .ts-page .ts-table-wrapper {
      mask-image: linear-gradient(to right, transparent 0, #000 var(--fa-cue-l, 0px), #000 calc(100% - var(--fa-cue-r, 2.5rem)), transparent 100%);
      animation: fa-scroll-cue linear both;
      animation-timeline: scroll(self inline);
    }
  }
  @supports not (animation-timeline: scroll()) {
    .ts-page .ts-table-wrapper {
      mask-image: linear-gradient(to right, #000 calc(100% - 2.5rem), transparent 100%);
    }
  }
}
@property --fa-cue-l { syntax: "<length>"; inherits: false; initial-value: 0px; }
@property --fa-cue-r { syntax: "<length>"; inherits: false; initial-value: 0px; }
@keyframes fa-scroll-cue {
  0%   { --fa-cue-l: 0px;    --fa-cue-r: 2.5rem; }
  12%  { --fa-cue-l: 2.5rem; }
  88%  { --fa-cue-r: 2.5rem; }
  100% { --fa-cue-l: 2.5rem; --fa-cue-r: 0px; }
}
</style>
<div class="ts-page">
<h1 id="ts-title">translations — status</h1>
<p class="ts-sub">The gettext side of the <code>translation-sources</code> graph, measured from the files in
<code>${esc(doc.scope)}</code>. Every number here is derived on each run; none is written down. Governed by the
${skill}. These
numbers last <strong>changed</strong> on ${esc(doc.changedAt)}.</p>

<div class="ts-questions-legend">
  <div><strong>Question 1 (Availability):</strong> Are there <code>.po</code> catalogues for extractable <code>.pot</code> templates?</div>
  <div><strong>Question 2 (Completeness):</strong> Of the catalogues that exist, how many strings are translated?</div>
  <div><strong>Question 3 (Officiality):</strong> Has a person signed this locale off? Read from the PO headers and <code>status.json</code>, which must agree.</div>
</div>

${localeTable(doc.locales, "", doc.scope)}
${others}

<p class="ts-note"><strong>Two questions, not one.</strong> <em>catalogues / templates</em> asks whether a
<code>.po</code> exists at all for each extractable <code>.pot</code>; the string columns ask how much of
the catalogues that DO exist is done. A locale can be near 100% translated across a handful of catalogues
while most of its templates have none — which is why the first column is not folded into the rest.</p>

<p class="ts-note"><strong>&ldquo;no basis&rdquo; is not zero.</strong> A share over an empty denominator is
undefined, and rendering it as 0% would report a measurement this run did not make.</p>

<p class="ts-note"><strong>One directory per table, each named.</strong> <code>translation-sources</code> is a graph
KIND, and more than one instance may declare it; the first table measures the directory named in the subtitle,
and each instance below it gets its own table for its own declared directory. They are never summed: two
instances' catalogues answer two questions. A catalogue sitting in an instance that has not declared the
directory is invisible here — which is a gap in that declaration rather than a locale with no work done, and
the two must not read the same.</p>

<p class="ts-note"><strong>Fuzzy is counted apart from translated.</strong> A fuzzy entry has a translation
and needs review; adding it to <em>translated</em> would flatter exactly the entries a reviewer must look at.</p>

<div class="ts-onward">
<h2 id="onward-links">Onward links</h2>
<ul>
  <li><strong>Review:</strong> <a href="review.html">review the machine translations</a> — every catalogue × locale, who reviewed it, and a form to accept a translation or suggest a better one as a GitHub issue.</li>
  <li><strong>Skill:</strong> ${skill} — gettext extraction, PO injection, round-trip QA, and sign-off workflows.</li>
  <li><strong>Sources:</strong> <a href="https://github.com/litlfred/folio-assistant/tree/main/${esc(doc.scope)}"><code>${esc(doc.scope)}</code> on GitHub</a> — catalogues (<code>.po</code>) and extractable templates (<code>.pot</code>).</li>
</ul>
</div>
</div>`,
  });
}

/** One locale as a line of the `--instance` report. */
export function statusLine(l: LocaleStatus): string {
  const v = share(l.translated, l.entries);
  // Plain text: `pct` renders the page's HTML for "no basis".
  const p = v === null ? "no basis" : `${v}%`;
  return (
    `  ${l.locale.padEnd(6)} ${String(l.catalogues).padStart(4)} catalogue(s) of ${String(l.templates).padStart(4)} template(s)  ` +
    `${String(l.translated).padStart(6)}/${String(l.entries).padEnd(6)} translated (${p})  ` +
    `${l.fuzzy} fuzzy, ${l.untranslated} empty` + (l.officiality ? `  ${officialityLabel(l.officiality)}` : "") +
    (l.unreadable.length > 0 ? `  UNREADABLE: ${l.unreadable.join(", ")}` : "")
  );
}

/** `--instance <dir>`: measure that layer's catalogues and print them. Writes nothing. */
/**
 * The review page's matrix for this layer and every other layer in the
 * checkout that declares a `translation-sources` directory (found the way
 * {@link otherInstances} finds them). Each carries its declared
 * `repository`, which is where a review of it is filed.
 */
export function reviewLayers(repoRoot: string, ownRoot: string): ReviewLayer[] {
  const roots = [ownRoot];
  for (const e of readdirSync(repoRoot, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".") || e.name === "node_modules") continue;
    const dir = join(repoRoot, e.name);
    if (resolve(dir) !== resolve(ownRoot)) roots.push(dir);
  }
  const out: ReviewLayer[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    let tdir: string | undefined;
    let decl: ReturnType<typeof readDeclaration>;
    try {
      tdir = translationsDirOf(root);
      decl = readDeclaration(root);
    } catch {
      continue;
    }
    const name = decl?.name ?? root;
    if (tdir === undefined || !existsSync(tdir) || seen.has(name)) continue;
    seen.add(name);
    const home = criteriaAttestationsHome(root).root;
    out.push(
      reviewLayer({
        name,
        ...(decl?.repository ? { repository: decl.repository } : {}),
        layerRoot: root,
        translationsDir: tdir,
        attestationFor: (cat, locale) => join(home, "translation-qa", `${cat}.${locale}.attestations.json`),
        poHeader,
        count: countCatalogue,
      }),
    );
  }
  return out;
}

/** The tag of {@link reviewProjection}. */
export const TRANSLATION_REVIEW_SCHEMA = "folio-translation-review/v1";

/**
 * The review matrix as a projection: every layer's catalogues, each with the
 * source files its strings come from and its state per locale. A page's
 * block knows its source file (`data-src`), so the chrome can find the
 * catalogues that translate it, show their state, and file the same
 * `translation-adjudication/v1` issue the review page files.
 */
export function reviewProjection(layers: ReviewLayer[], statusPage: string): string {
  return `${JSON.stringify(
    {
      $schema: TRANSLATION_REVIEW_SCHEMA,
      reviewPage: statusPage.replace(/index\.(html|md)$/, "review.html"),
      issue: {
        schema: ADJUDICATION_SCHEMA,
        label: ADJUDICATION_LABEL,
        titlePrefix: ADJUDICATION_TITLE_PREFIX,
        fence: ADJUDICATION_FENCE_INFO,
        maxUrl: MAX_ISSUE_URL,
        candidatesSchema: CANDIDATES_SCHEMA,
        candidatesSuffix: CANDIDATES_SUFFIX,
      },
      layers,
    },
    null,
    1,
  )}\n`;
}

/** The review page, themed like the status page and written beside it as `review.html`. */
export function reviewPage(layers: ReviewLayer[]): string {
  return themedPage({
    title: "translations — review",
    generator: "cat-harness-tools/scripts/gen-translation-status.ts",
    command: "bun run translation:status",
    body: reviewBody(layers, "./"),
  });
}

function reportInstance(root: string): number {
  const translationsDir = translationsDirOf(root);
  if (translationsDir === undefined || !existsSync(translationsDir)) {
    console.error(`gen-translation-status: ${root} declares no \`translation-sources\` directory, or it is absent.`);
    console.error("This is NOT a pass. Treat it as unknown.");
    return 2;
  }
  const locales = localeStatuses(translationsDir);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ $schema: TRANSLATION_STATUS_SCHEMA, scope: `${readDeclaration(root)?.name ?? root}/${relative(root, translationsDir)}`, locales }, null, 2));
    return locales.some((l) => l.unreadable.length > 0) ? 2 : 0;
  }
  console.log(`${readDeclaration(root)?.name ?? root}: ${relative(root, translationsDir)}/`);
  for (const l of locales) console.log(statusLine(l));
  const unreadable = locales.reduce((n, l) => n + l.unreadable.length, 0);
  console.log(`${locales.length} locale(s)` + (unreadable > 0 ? `, ${unreadable} catalogue(s) unreadable` : ""));
  // An unreadable catalogue is "could not determine", never a zero: exit 2.
  return unreadable > 0 ? 2 : 0;
}

function main(): void {
  const explicit = explicitInstanceRoot();
  if (explicit !== undefined) process.exit(reportInstance(explicit));
  const check = process.argv.includes("--check");
  const translationsDir = translationsDirOf(ROOT);

  if (translationsDir === undefined || !existsSync(translationsDir)) {
    // COULD NOT DETERMINE, and exit 2 so it is never read as a clean run.
    // A layer with no translation-sources directory is a real state; this
    // generator is not the thing that decides it means "no translations".
    console.error("gen-translation-status: no `translation-sources` directory is declared or present.");
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }

  const declName = readDeclaration(ROOT)?.name ?? "cat-harness";
  const ownScope = `${declName}/translations`;
  const locales = localeStatuses(translationsDir);
  const instances = otherInstances(REPO_ROOT, ROOT);
  const site = siteTarget(localSiteDir(ROOT) ?? join(ROOT, siteDirFor(ROOT)));

  // The route cat-harness DECLARES for this Tool's visualiser — never chosen
  // here (owner, 2026-10-09: `<base>/<harness>/<visualizer>`).
  const sitePath = visualiserSitePath(ROOT, VIEWER_TOOL);

  // The projection first, the page second: the page is a rendering OF the
  // projection, and writing them the other way round invites a page whose
  // numbers no file backs.
  const doc = {
    $schema: TRANSLATION_STATUS_SCHEMA,
    // WHEN THE NUMBERS LAST CHANGED, which is not when the generator last
    // ran — see `undated` below. Filled in after the comparison, because a
    // re-run that reproduces the same numbers must not move it.
    changedAt: "",
    // WHAT WAS MEASURED, in the projection and not only on the page. A reader
    // of the JSON has the same right to know the scope as a reader of the
    // table, and a number whose subject is implicit is the one that gets
    // quoted somewhere else as though it covered everything.
    scope: ownScope,
    // The tile's headline number — #863, and it is `locales` because that is
    // what THIS PAGE shows: one row per locale, which the rendered table has
    // six of, being five locales and a header. The badge mechanism rests on a
    // count being the count of the page its tile opens, and every other number
    // here would break it. `templates` (61–64) and `entries` (85–171) both
    // VARY BY LOCALE, so neither is a property of the page at all;
    // `untranslated` is reported per row, and a tile carrying it would answer
    // a question the page answers five times over.
    //
    // The key is the id of the DIRECTORY the tile was declared for
    // (`translations/`), not this projection's own segment: `scanTileCounts`
    // reads whatever a projection names, so what it names has to be the
    // directory, which is the half a reader gets wrong first. And it is the
    // id in the TILES' list (`tileDirectories`), not this layer's: since
    // the landing moved to the core content layer the tile is
    // `folio-assistant-core-translations`, and the literal
    // `translation-sources` badged nothing (#931). The page is unscoped, so
    // every tile of the kind opens it and every one gets this count.
    ...tileCounts(
      Object.fromEntries(
        tileDirectories(REPO_ROOT, ROOT)
          .filter((d) => (d.graphTypologies ?? []).includes("translation-sources"))
          .map((d) => [d.id, [locales.length, locales.length === 1 ? "locale" : "locales"] as const]),
      ),
    ),
    // WHERE THE PAGE IS, so the translation drawer on any page can link to it
    // without composing a route (bean `cat-tools-bbnd`).
    page: sitePath.rel,
    locales,
    instances,
  };

  const assetDir = join(site, "assets", "translation-status");
  const pageDir = join(site, dirname(sitePath.rel));
  const assetPath = join(assetDir, "index.json");
  const pagePath = join(pageDir, "index.html");
  // The review page, beside the status page: inside the same declared
  // directory, so it is built at publish with it and needs no route.
  const reviewPath = join(pageDir, "review.html");
  const layers = reviewLayers(REPO_ROOT, ROOT);
  // The review matrix as data, for the site chrome's per-block controls
  // (a block's translation status, and the same issue the review page files).
  const reviewJsonPath = join(assetDir, "review.json");

  // NO RAIL since 2026-10-07: the page is themed, so the theme's sidebar is its
  // navigation. The page says which directory it draws (#1168 B7a-2), in its
  // front matter.
  const page = (changedAt: string) =>
    withRenderedByFrontMatter(statusPage({ locales, changedAt, scope: doc.scope, instances, siteRoot: sitePath.up, skillPage: siteArg() === undefined || sitePageAt(site, `${SKILL_PAGES_DIR}/translation-manager.html`) }), VIEWER_TOOL);
  const json = (changedAt: string) => `${JSON.stringify({ ...doc, changedAt }, null, 2)}\n`;

  // The date the NUMBERS last changed is the projection's to say. When the
  // projection is current — the same numbers — its `changedAt` stands, and a
  // page re-rendered for some other reason (a layout change) carries that date
  // rather than today's. Otherwise the page would say the measurement moved on
  // a day it did not, and disagree with the projection beside it.
  const haveJson = existsSync(assetPath) ? readFileSync(assetPath, "utf-8") : null;
  const kept = haveJson !== null && undated(haveJson) === undated(json("2000-01-01"))
    ? (JSON.parse(haveJson) as { changedAt?: unknown }).changedAt
    : undefined;
  const today = typeof kept === "string" && /^\d{4}-\d{2}-\d{2}$/.test(kept) ? kept : new Date().toISOString().slice(0, 10);

  // BUILT AT PUBLISH (owner, 2026-10-14, "B1"; 2026-10-15). Both files carry
  // `instances` — the catalogues of every OTHER layer in the checkout — so
  // they moved with the index's pins, not with this layer's commit. The
  // layer declares them `builtAtPublish` with this script as the writer,
  // and `derive:publish` runs it; under `--check` a declared file has no
  // committed bytes to compare, so it is skipped there (the `folio:viz` rule).
  // Asked by the file's path in the layer's own site, so `--site` asks the
  // same question.
  const declaredBuilt = readDeclaration(ROOT)?.builtAtPublish ?? [];
  const builtHere = (p: string): boolean =>
    isBuiltAtPublish(declaredBuilt, join(siteDirFor(ROOT), relative(site, p)).split(sep).join("/"));

  let stale = 0;
  let built = 0;
  for (const [p, render] of [
    [assetPath, json],
    [pagePath, page],
    [reviewPath, () => withRenderedByFrontMatter(reviewPage(layers), VIEWER_TOOL)],
    [reviewJsonPath, () => reviewProjection(layers, sitePath.rel)],
  ] as const) {
    if (check && builtHere(p)) {
      built += 1;
      continue;
    }
    const have = existsSync(p) ? readFileSync(p, "utf-8") : null;
    // COMPARED WITHOUT THE DATE, and then written WITH it. Comparing the
    // rendered date would make this gate fail on the calendar: the artefact
    // would go stale at midnight with not one catalogue touched, and CI would
    // be red on every branch until somebody re-ran a generator that changes
    // one line. A gate that fails for a reason nobody can act on is a gate
    // people learn to re-run rather than read.
    if (have !== null && undated(have) === undated(render(today))) continue;
    stale += 1;
    if (check) {
      console.error(`  ✗ ${relative(REPO_ROOT, p)} is stale`);
    } else {
      mkdirSync(join(p, ".."), { recursive: true });
      writeFileSync(p, render(today));
      console.log(`  ✓ ${relative(REPO_ROOT, p)}`);
    }
  }

  const totals = locales.reduce(
    (a, l) => ({
      templates: a.templates + l.templates,
      catalogues: a.catalogues + l.catalogues,
      entries: a.entries + l.entries,
      translated: a.translated + l.translated,
      unreadable: a.unreadable + l.unreadable.length,
    }),
    { templates: 0, catalogues: 0, entries: 0, translated: 0, unreadable: 0 },
  );
  console.log(
    `${locales.length} locale(s): ${totals.catalogues} catalogue(s) of ${totals.templates} template(s), ` +
      `${totals.translated} of ${totals.entries} string(s) translated` +
      (totals.unreadable > 0 ? `, ${totals.unreadable} unreadable` : ""),
  );

  if (check && built > 0) console.log(`  · ${built} file(s) built at publish (builtAtPublish), not committed — nothing to compare`);
  if (check && stale > 0) {
    console.error("Run `bun run cat translation:status` and commit.");
    process.exit(1);
  }
}

if (import.meta.main) main();
