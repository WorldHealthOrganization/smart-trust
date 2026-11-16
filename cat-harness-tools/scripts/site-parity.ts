#!/usr/bin/env bun
/**
 * What a built site WEARS, measured on its pages, and what a candidate lacks
 * that the site it would replace has.
 *
 * @module scripts/site-parity
 * @covers none — a publish guard: it compares two built sites and judges no graph
 *
 * Before a root publish the candidate is measured against the root it would
 * replace, on the PAGES, never on the exit codes of the steps that made them:
 *
 * - the theme's side bar (`#site-nav`) and a search box (`#search-input`),
 *   which a page Jekyll laid out with just-the-docs carries, and which an IG
 *   site's own search box carries too (the FHIR IG harness's `ig-search.ts`);
 * - the language picker's block (`#fa-translation-meta`), from which docs-ui
 *   draws the language picker at the top of the page;
 * - the harness icon row (`#fa-navbar-row`) and the rail (`nav.fa-nav`, or the
 *   theme's `#site-nav`, which is where the rail sits on a laid-out page);
 * - every top-level directory (`openapi/`, `fhir-artifact-index/`, `ast-data/`,
 *   …): `folio-site.yml`'s `publish-served` step and its copies;
 * - the build stamp `folio-build.json` (`site-build-stamp.ts stamp`).
 *
 * A feature the current root carries on at least one page and the candidate
 * carries on none, or carries on its `index.html` and the candidate's
 * `index.html` does not, is a SHORTFALL; so is a directory or the stamp that
 * the current root has and the candidate lacks. Directories the publish keeps
 * (previews under `branches/`, `branches/`) are not the candidate's to carry
 * and are left out of both sides.
 *
 * ## Directories and features dropped by a ruling
 *
 * A directory or page feature the owner ruled is no longer published is not
 * a shortfall, but only when the caller names it in a {@link DroppedByRuling}
 * with the ruling's own words. An entry names EITHER top-level directory
 * names (a `*` glob) OR one page feature, by its key in {@link PAGE_FEATURES},
 * and excuses exactly that — never a missing `index.html` or the stamp. What
 * it excuses is said, never silent ({@link droppedByRuling}). Example: an IG
 * site whose folio rail stands in for the theme's side menu drops
 * `#site-nav`, while the search box and the rail stay required.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** The page features compared, each with the test that finds it in a page's HTML. */
export const PAGE_FEATURES = {
  siteNav: /id="site-nav"/,
  search: /id="search-input"/,
  navbarRow: /id="fa-navbar-row"/,
  rail: /<nav class="fa-nav"|id="site-nav"/,
  translationMeta: /id="fa-translation-meta"/,
} as const;
export type PageFeature = keyof typeof PAGE_FEATURES;

/** Words for each feature, as a refusal says them. */
const FEATURE_WORDS: Record<PageFeature, string> = {
  siteNav: "the theme's side bar (#site-nav)",
  search: "the search box (#search-input)",
  navbarRow: "the harness icon row (#fa-navbar-row)",
  rail: "the rail (nav.fa-nav or #site-nav)",
  translationMeta: "the language picker's block (#fa-translation-meta)",
};

export interface SiteFeatures {
  pages: number;
  /** How many pages carry each feature. */
  counts: Record<PageFeature, number>;
  /** The features `index.html` carries; undefined when there is no `index.html`. */
  index?: PageFeature[];
  /** Top-level directories, sorted, the excluded ones left out. */
  dirs: string[];
  /** The `folio-build.json` stamp, parsed, or undefined when absent. */
  stamp?: Record<string, unknown>;
}

/** Measure a built site. `exclude` names top-level entries left out (kept by the publish, not built). */
export function siteFeatures(site: string, exclude: readonly string[] = []): SiteFeatures {
  const counts = Object.fromEntries(Object.keys(PAGE_FEATURES).map((k) => [k, 0])) as Record<PageFeature, number>;
  const f: SiteFeatures = { pages: 0, counts, dirs: [] };
  if (!existsSync(site)) return f;
  const walk = (d: string, top: boolean): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (top && exclude.includes(e.name)) continue;
      if (e.name.startsWith(".")) continue;
      const abs = join(d, e.name);
      if (e.isDirectory()) {
        if (top) f.dirs.push(e.name);
        walk(abs, false);
        continue;
      }
      if (!e.name.endsWith(".html")) continue;
      const html = readFileSync(abs, "utf-8");
      f.pages++;
      const has = (Object.keys(PAGE_FEATURES) as PageFeature[]).filter((k) => PAGE_FEATURES[k].test(html));
      for (const k of has) counts[k]++;
      if (top && e.name === "index.html") f.index = has;
    }
  };
  walk(site, true);
  f.dirs.sort();
  const stamp = join(site, "folio-build.json");
  if (existsSync(stamp)) {
    try {
      f.stamp = JSON.parse(readFileSync(stamp, "utf-8")) as Record<string, unknown>;
    } catch {
      f.stamp = { unreadable: true };
    }
  }
  return f;
}

/**
 * A top-level directory, or a page feature, the root no longer serves by the
 * owner's ruling, and the ruling that says so. Exactly one of `dir` and
 * `feature`; an entry with both or neither excuses nothing.
 */
export interface DroppedByRuling {
  /** A top-level directory name; `*` matches any run of characters other than `/`. */
  dir?: string;
  /** A page feature, by its key in {@link PAGE_FEATURES}. */
  feature?: PageFeature;
  /** The ruling, quoted with its date: what a reader of the refusal is shown. */
  ruling: string;
}

/** Whether a top-level directory name matches a dropped entry's glob. Pure. */
export function matchesDropped(name: string, d: DroppedByRuling): boolean {
  if (d.feature !== undefined || d.dir === undefined || d.dir === "" || d.dir.includes("/")) return false;
  const re = new RegExp(`^${d.dir.split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")}$`);
  return re.test(name);
}

/** The ruling that drops a page feature, if one does. Pure. */
export function featureRuling(k: PageFeature, dropped: readonly DroppedByRuling[]): DroppedByRuling | undefined {
  return dropped.find((x) => x.feature === k && x.dir === undefined);
}

/** Whether `candidate` lacks feature `k` where `current` has it: on every page, or on `index.html`. Pure. */
function lacksFeature(current: SiteFeatures, candidate: SiteFeatures, k: PageFeature): "pages" | "index" | undefined {
  if (current.counts[k] > 0 && candidate.counts[k] === 0) return "pages";
  if (current.index?.includes(k) && candidate.index !== undefined && !candidate.index.includes(k)) return "index";
  return undefined;
}

/**
 * What a ruling excuses: the directories `current` serves that `candidate`
 * lacks, and the page features it carries that `candidate` lacks, each with
 * its ruling. Pure.
 */
export function droppedByRuling(current: SiteFeatures, candidate: SiteFeatures, dropped: readonly DroppedByRuling[]): { dir?: string; feature?: PageFeature; words: string; ruling: string }[] {
  const dirs = current.dirs
    .filter((d) => !candidate.dirs.includes(d))
    .flatMap((d) => {
      const hit = dropped.find((x) => matchesDropped(d, x));
      return hit ? [{ dir: d, words: `${d}/`, ruling: hit.ruling }] : [];
    });
  const features = (Object.keys(PAGE_FEATURES) as PageFeature[]).flatMap((k) => {
    const hit = lacksFeature(current, candidate, k) ? featureRuling(k, dropped) : undefined;
    return hit ? [{ feature: k, words: FEATURE_WORDS[k], ruling: hit.ruling }] : [];
  });
  return [...dirs, ...features];
}

/** Everything `current` has that `candidate` lacks, in words; empty when the candidate loses nothing. Pure. */
export function parityShortfall(current: SiteFeatures, candidate: SiteFeatures, dropped: readonly DroppedByRuling[] = []): string[] {
  const out: string[] = [];
  for (const k of Object.keys(PAGE_FEATURES) as PageFeature[]) {
    const lack = lacksFeature(current, candidate, k);
    if (!lack || featureRuling(k, dropped)) continue;
    if (lack === "pages") {
      out.push(`${FEATURE_WORDS[k]}: on ${current.counts[k]} of the current root's ${current.pages} page(s), on none of the candidate's ${candidate.pages}`);
    } else {
      out.push(`${FEATURE_WORDS[k]}: on the current root's index.html, not on the candidate's`);
    }
  }
  if (current.index !== undefined && candidate.index === undefined) out.push("index.html: the current root has one, the candidate has none");
  const missing = current.dirs.filter((d) => !candidate.dirs.includes(d) && !dropped.some((x) => matchesDropped(d, x)));
  if (missing.length) out.push(`directories the current root serves and the candidate does not: ${missing.map((d) => `${d}/`).join(", ")}`);
  if (current.stamp && !candidate.stamp) out.push("the build stamp folio-build.json: the current root has it, the candidate does not");
  return out;
}

/**
 * Where a root publish leaves its parity result on the site, beside the link
 * report (`assets/site-qa/links.json`), for the site's QA page to read.
 */
export const PARITY_REPORT = "assets/site-qa/parity.json";

/**
 * The last CLEAN publish: the measures of the newest root that published with
 * no shortfall, and which build it was. Carried from report to report until a
 * build is clean again.
 */
export interface ParityBaseline {
  /** What the clean build carried, the stamp reduced to presence. */
  features: SiteFeatures;
  /** Which build it was (a commit), when the caller knows. */
  from?: string;
}

/** The parity result as the QA page reads it. */
export interface ParityReport {
  $schema: "site-parity-report/v1";
  /** `refused` only when the caller asked for the old gate (`parity: "refuse"`). */
  outcome: "carries-everything" | "published-with-shortfall" | "refused";
  /** Against the root replaced, then against the last clean publish, each named once. */
  shortfall: string[];
  droppedByRuling: { what: string; ruling: string }[];
  current: SiteFeatures;
  candidate: SiteFeatures;
  /** The last clean publish, for the next build to compare with: this build when it is clean. */
  baseline?: ParityBaseline;
}

const forReport = (f: SiteFeatures): SiteFeatures => ({ ...f, stamp: f.stamp ? { present: true } : undefined });

/**
 * The parity result for QA. Pure.
 *
 * Owner, 2026-11-14, after a folio's root publish was refused for an icon row
 * missing from its `index.html`: *"It shouldn't fail if there is an issue it
 * should be a QA report."* A shortfall is a finding about the build. It is
 * reported and the site is still published.
 *
 * AGAINST THE LAST CLEAN PUBLISH TOO (owner, 2026-11-14, "last clean"). The
 * root replaced is the previous publish, so a loss published once became the
 * next build's baseline and was never named again: the same folio's next
 * three publishes read "carries-everything" while its home page still lacked
 * the icon row. `previous` is the replaced root's own report. Its `baseline`
 * is the last clean publish, and what the candidate lacks against it is named
 * too, once. With no recorded baseline the replaced root stands in (a site
 * from before this was recorded). A clean build becomes the next baseline;
 * a build with a shortfall carries the old one forward, so a loss is named on
 * every publish until it is fixed or dropped by a ruling.
 */
export function parityReport(
  current: SiteFeatures,
  candidate: SiteFeatures,
  dropped: readonly DroppedByRuling[] = [],
  refused = false,
  previous?: Pick<ParityReport, "baseline">,
  from?: string,
): ParityReport {
  const vsCurrent = parityShortfall(current, candidate, dropped);
  const baseline = previous?.baseline;
  const vsClean = baseline
    ? parityShortfall(baseline.features, candidate, dropped)
        .filter((m) => !vsCurrent.includes(m))
        .map((m) => `${m} (against the last clean publish${baseline.from ? `, ${baseline.from}` : ""})`)
    : [];
  const shortfall = [...vsCurrent, ...vsClean];
  const next: ParityBaseline | undefined =
    shortfall.length === 0 ? { features: forReport(candidate), ...(from ? { from } : {}) } : (baseline ?? { features: forReport(current) });
  return {
    $schema: "site-parity-report/v1",
    outcome: shortfall.length === 0 ? "carries-everything" : refused ? "refused" : "published-with-shortfall",
    shortfall,
    droppedByRuling: droppedByRuling(current, candidate, dropped).map((d) => ({ what: d.words, ruling: d.ruling })),
    current: forReport(current),
    candidate: forReport(candidate),
    baseline: next,
  };
}

/**
 * The parity report a built or published site carries, or undefined when it
 * has none or it does not parse. A report from before baselines were recorded
 * reads as one without a baseline.
 */
export function readParityReport(site: string): ParityReport | undefined {
  const file = join(site, PARITY_REPORT);
  if (!existsSync(file)) return undefined;
  try {
    const r = JSON.parse(readFileSync(file, "utf-8")) as ParityReport;
    if (r?.$schema !== "site-parity-report/v1") return undefined;
    const b = r.baseline;
    const ok = b && typeof b === "object" && b.features && typeof b.features === "object" && b.features.counts && Array.isArray(b.features.dirs);
    return ok ? r : { ...r, baseline: undefined };
  } catch {
    return undefined;
  }
}

/** Write {@link PARITY_REPORT} into `site`. Deterministic. */
export function writeParityReport(site: string, report: ParityReport): void {
  const file = join(site, PARITY_REPORT);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(report, null, 1) + "\n");
}

/** One line per measure, for a log or a report. */
export function describeFeatures(label: string, f: SiteFeatures): string {
  const c = f.counts;
  return `${label}: ${f.pages} page(s); #site-nav ${c.siteNav}, search ${c.search}, #fa-navbar-row ${c.navbarRow}, rail ${c.rail}, language ${c.translationMeta}; dirs ${f.dirs.join(" ") || "(none)"}; stamp ${f.stamp ? "yes" : "no"}`;
}

if (import.meta.main) {
  const a = process.argv.slice(2);
  const one = (k: string) => {
    const i = a.indexOf(k);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const current = one("--current");
  const candidate = one("--candidate");
  const exclude = (one("--exclude") ?? "branches,STAGING,_render-log").split(",").filter(Boolean);
  if (!current || !candidate) {
    console.error("usage: site-parity.ts --current <built site> --candidate <built site> [--exclude a,b]");
    process.exit(2);
  }
  const cur = siteFeatures(current, exclude);
  const cand = siteFeatures(candidate, exclude);
  console.log(describeFeatures("current  ", cur));
  console.log(describeFeatures("candidate", cand));
  const short = parityShortfall(cur, cand);
  for (const s of short) console.log(`✗ ${s}`);
  if (!short.length) console.log("✓ the candidate carries everything the current root does");
  process.exit(short.length ? 1 : 0);
}
