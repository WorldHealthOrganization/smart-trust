#!/usr/bin/env bun
/**
 * Does every navigation destination carry ONE name on every surface?
 *
 * @module scripts/check-nav-names
 * @covers none — its subjects are GENERATED navigation surfaces (the rail
 * written into viewer pages, the sidebar include, `_data/harness.json`,
 * `_data/stickies.json` and the landing template), none of which is a node in
 * a declared graph. Naming `docs` here would credit the kind with an audit of
 * its nodes that this never performs.
 *
 * Each destination gets one label, used identically on every surface. Where
 * the harness matters, a surface appends it as a qualifier
 * ("Skills · C@T Harness") and never uses a different base name.
 *
 * Every surface is a committed generated artefact, so names are read
 * statically:
 *
 * | surface | read from |
 * |---|---|
 * | viewer rail | every tracked `.html` under the site carrying `<nav class="fa-nav">` |
 * | Jekyll sidebar harnesses | `_includes/generated/navbar-footer.html` |
 * | landing "visualisations you can open" | `_data/harness.json` `harnesses[].visualisations` (the template prints `label`) |
 * | harness rows | `_data/harness.json` `harnesses[]` |
 * | FOLDERS | `_data/harness.json` `navbar.folders` |
 * | glass tiles, More, Stickies row | `_data/harness.json` `tiles` (the client prints `title`) |
 * | sticky card links | `_data/stickies.json`, only for hrefs another surface also links |
 *
 * It also fails a landing-include anchor whose text is a `.kind` expression
 * (a name composed from the kind word).
 *
 * Related gates: `navbar:geometry:check` (widths), `check:viewer-nav` (which
 * pages carry a rail), `check:navbar-consistency:check` (icons and glyphs).
 *
 * If `harness.json` will not parse, or no railed page and no include could be
 * read, this exits **2**, not 0.
 *
 * ## Modes
 *
 * - `bun run cat check:nav-names` writes the sidecar
 *   (`test/results/nav-names.qa-results.json`) and prints the report. It
 *   exits 1 on a destination with two names.
 * - `bun run cat check:nav-names:check` writes nothing. It exits 1 on a
 *   destination with two names, on a template that prints a kind word, or on
 *   a committed sidecar that is stale or absent. This is the gate CI runs.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { RAIL_DATA_DIR, expandRail, railDataJson } from "./lib/harness-rail.ts";
import { outputTwinOf, readPathAt } from "./lib/layer-output.ts";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { siteDirFor } from "../schemas/kg/cat-harness.js";
import { normaliseDestination } from "./lib/nav-label.ts";
import { againstOrUsage, buildQaResult, judgeQaResult, writeQaResult, type QaResult, type QaVerdict } from "./qa-results.ts";
import { gitCorpus } from "../schemas/sdlc/git-corpus.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

// The HARNESS, not this layer: the script moved up in 70lx B2 and still reads cat-harness's declarations.
const INSTANCE_ROOT = HARNESS_ROOT;
const REPO_ROOT = resolve(INSTANCE_ROOT, "..");
const STEM = "nav-names";

/** One place a destination is named. */
export interface NameSighting {
  /** Which surface, in a reader's words. */
  surface: string;
  /** The file it was read from, repo-relative. */
  source: string;
  /** The destination, normalised by {@link normaliseDestination}. */
  href: string;
  /** The base label, without any qualifier. */
  label: string;
}

/** One destination that carries more than one base label. */
export interface NameConflict {
  href: string;
  names: { label: string; surfaces: string[] }[];
}

/** A template anchor that prints a kind word rather than the label. */
export interface TemplateFinding {
  file: string;
  line: number;
  expression: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" };

function decode(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|#39|apos);/g, (_m, e: string) => ENTITIES[e] ?? _m)
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

type HarnessData = {
  title?: string;
  tiles?: { title?: string; href?: string }[];
  harnesses?: {
    name?: string;
    label?: string;
    title?: string;
    href?: string | null;
    instantiated?: boolean;
    visualisations?: { kind?: string; label?: string; path?: string | null; sameAs?: string }[];
  }[];
  navbar?: { folders?: { kind?: string; label?: string; path?: string }[] } | null;
};

/**
 * The names `_data/harness.json` gives each destination, surface by surface.
 *
 * Only INSTANTIATED harnesses: those are the ones the sidebar, the landing and
 * the rail show. A dependency that is not instantiated here appears on no
 * navigation surface, so its rows are not names anybody reads.
 */
export function sightingsFromHarnessData(d: HarnessData, source: string): NameSighting[] {
  const out: NameSighting[] = [];
  const push = (surface: string, href: string | null | undefined, label: string | undefined): void => {
    if (!href || !label) return;
    const h = normaliseDestination(href);
    if (h === undefined) return;
    out.push({ surface, source, href: h, label: label.trim() });
  };
  for (const t of d.tiles ?? []) push("glass tiles, More and Stickies row", t.href, t.title);
  for (const h of d.harnesses ?? []) {
    if (h.instantiated !== true) continue;
    push("harness rows", h.href, h.label ?? h.title ?? h.name);
    for (const v of h.visualisations ?? []) {
      if (v.sameAs !== undefined) continue;
      push("landing viewers", v.path, v.label ?? v.kind);
    }
  }
  for (const f of d.navbar?.folders ?? []) push("FOLDERS", f.path, f.label ?? f.kind);
  return out;
}

/**
 * The names a rendered navbar gives each destination.
 *
 * Reads every `<a>` carrying a `.fa-nav-label`. The label is the span's own
 * text up to its first child element, so the qualifier
 * (`.fa-nav-qualifier`) and the visually hidden description (`.fa-nav-sr`)
 * are not part of it.
 *
 * @param pagePath the page's published path, for resolving a relative href;
 *   `/` for the include, whose hrefs are Liquid `relative_url` expressions
 *   over site-absolute paths.
 */
export function sightingsFromNavHtml(html: string, pagePath: string, surface: string, source: string): NameSighting[] {
  const out: NameSighting[] = [];
  const nav = /<nav\b[^>]*class="fa-nav"[^>]*>([\s\S]*?)<\/nav>/i.exec(html);
  const region = nav ? nav[1]! : html;
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (let m = anchor.exec(region); m; m = anchor.exec(region)) {
    const raw = /\bhref="([^"]*)"/.exec(m[1]!)?.[1];
    if (raw === undefined) continue;
    const liquid = /\{\{\s*'([^']*)'\s*\|\s*relative_url\s*\}\}/.exec(raw);
    const href = liquid ? liquid[1]! : decode(raw);
    if (href === "" || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
    const lab = /<span class="fa-nav-label">([^<]*)/.exec(m[2]!);
    if (!lab) continue;
    const label = decode(lab[1]!);
    if (label === "") continue;
    let abs: string;
    try {
      const u = new URL(href, `http://site${pagePath}`);
      abs = u.pathname + u.hash;
    } catch {
      continue;
    }
    const h = normaliseDestination(abs);
    if (h !== undefined) out.push({ surface, source, href: h, label });
  }
  return out;
}

/** The authored links on the landing's sticky cards. */
export function sightingsFromStickies(d: { stickies?: { links?: { label?: string; href?: string }[] }[] }, source: string): NameSighting[] {
  const out: NameSighting[] = [];
  for (const s of d.stickies ?? []) {
    for (const l of s.links ?? []) {
      if (!l.href || !l.label) continue;
      const h = normaliseDestination(l.href);
      if (h !== undefined) out.push({ surface: "sticky card links", source, href: h, label: l.label.trim() });
    }
  }
  return out;
}

/** Template anchors whose text is a `.kind` expression: a name composed from the kind word. */
export function templateFindings(text: string, file: string): TemplateFinding[] {
  const out: TemplateFinding[] = [];
  const anchor = /<a\b[^>]*>\s*\{\{\s*([a-z_]+\.kind)\s*\}\}\s*<\/a>/gi;
  for (let m = anchor.exec(text); m; m = anchor.exec(text)) {
    out.push({ file, line: text.slice(0, m.index).split("\n").length, expression: m[1]! });
  }
  return out;
}

/**
 * Destinations with more than one base label.
 *
 * Sticky card links are authored prose and link many pages no navigation
 * surface lists, so a sticky link is compared only where another surface
 * links the same destination.
 */
export function conflicts(sightings: readonly NameSighting[]): NameConflict[] {
  const navigated = new Set(sightings.filter((s) => s.surface !== "sticky card links").map((s) => s.href));
  const by = new Map<string, Map<string, Set<string>>>();
  for (const s of sightings) {
    if (s.surface === "sticky card links" && !navigated.has(s.href)) continue;
    const names = by.get(s.href) ?? new Map<string, Set<string>>();
    const where = names.get(s.label) ?? new Set<string>();
    where.add(s.surface);
    names.set(s.label, where);
    by.set(s.href, names);
  }
  const out: NameConflict[] = [];
  for (const [href, names] of [...by].sort(([a], [b]) => a.localeCompare(b))) {
    if (names.size < 2) continue;
    out.push({
      href,
      names: [...names]
        .map(([label, where]) => ({ label, surfaces: [...where].sort() }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    });
  }
  return out;
}

export interface NavNamesResult {
  undetermined?: string;
  sightings: NameSighting[];
  conflicts: NameConflict[];
  templates: TemplateFinding[];
  /** How many of each source were read — a count of zero is the dh4f symptom. */
  read: { railPages: number; include: boolean; harnessData: boolean; stickies: boolean; templates: number };
  destinations: number;
}

/** Every tracked (or output-root computed) file under `dir`, repo-relative. */
function tracked(repoRoot: string, dir: string): string[] {
  // In a composed checkout every layer is a REMOTE MOUNT, laid down from
  // `index.lock.json` and ignored by the index repository's git, so a bare
  // `git ls-files` at the root lists none of their files. `gitCorpus` counts a
  // mount's files as it counted a submodule's, and is tracked-plus-untracked
  // exactly as before everywhere else. A DIRECTORY is spelled `<dir>/**`:
  // a mount's files are matched as globs, and a bare directory matches none.
  const pinned = (gitCorpus(repoRoot, [`${dir}/**`]) ?? []).map((f) => relative(repoRoot, f).split(sep).join("/"));
  const twin = outputTwinOf(repoRoot, join(repoRoot, dir));
  if (twin === undefined || !existsSync(twin)) return pinned;
  const computed: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else computed.push(join(dir, relative(twin, p)).split(sep).join("/"));
    }
  };
  walk(twin);
  return [...new Set([...pinned, ...computed])].sort();
}

/**
 * Read every surface under a site directory and compare.
 *
 * @param siteAbs the published site directory, absolute
 * @param files   the site's tracked files, repo-relative; read from git when omitted
 */
export function checkNavNames(repoRoot: string, siteAbs: string, files?: readonly string[]): NavNamesResult {
  const rel = (p: string): string => relative(repoRoot, p).split(sep).join("/");
  const read: NavNamesResult["read"] = { railPages: 0, include: false, harnessData: false, stickies: false, templates: 0 };
  const sightings: NameSighting[] = [];
  const templates: TemplateFinding[] = [];

  const dataRel = rel(join(siteAbs, "_data", "harness.json"));
  const dataPath = readPathAt(repoRoot, join(siteAbs, "_data", "harness.json"));
  if (!existsSync(dataPath)) {
    return { undetermined: `${dataRel} is missing`, sightings, conflicts: [], templates, read, destinations: 0 };
  }
  try {
    sightings.push(...sightingsFromHarnessData(JSON.parse(readFileSync(dataPath, "utf-8")) as HarnessData, dataRel));
    read.harnessData = true;
  } catch (e) {
    return { undetermined: `${dataRel} will not parse: ${String(e)}`, sightings, conflicts: [], templates, read, destinations: 0 };
  }

  const stickiesRel = rel(join(siteAbs, "_data", "stickies.json"));
  const stickiesPath = readPathAt(repoRoot, join(siteAbs, "_data", "stickies.json"));
  if (existsSync(stickiesPath)) {
    try {
      sightings.push(...sightingsFromStickies(JSON.parse(readFileSync(stickiesPath, "utf-8")), stickiesRel));
      read.stickies = true;
    } catch {
      // Unreadable stickies are a finding of `docs:landing`'s gate, not this
      // one's; the other surfaces are still compared, and `read` says so.
    }
  }

  const includeRel = rel(join(siteAbs, "_includes", "generated", "navbar-footer.html"));
  const include = readPathAt(repoRoot, join(siteAbs, "_includes", "generated", "navbar-footer.html"));
  if (existsSync(include)) {
    sightings.push(...sightingsFromNavHtml(readFileSync(include, "utf-8"), "/", "Jekyll sidebar harnesses", includeRel));
    read.include = true;
  }

  for (const name of ["harness_details.html", "landing.html"]) {
    const p = join(siteAbs, "_includes", name);
    if (!existsSync(p)) continue;
    templates.push(...templateFindings(readFileSync(p, "utf-8"), rel(p)));
    read.templates++;
  }

  const siteRel = rel(siteAbs);
  const list = files ?? tracked(repoRoot, siteRel);
  for (const f of list) {
    if (!f.endsWith(".html") || f.includes("/_includes/") || f.includes("/_layouts/")) continue;
    const abs = readPathAt(repoRoot, join(repoRoot, f));
    if (!existsSync(abs)) continue;
    // A rail drawn from SHARED data (bean `lnoy`) is read as the reader sees it.
    const html = expandRail(readFileSync(abs, "utf-8"), (name) => {
      const rf = readPathAt(repoRoot, join(siteAbs, RAIL_DATA_DIR, `${name}.js`));
      return existsSync(rf) ? railDataJson(readFileSync(rf, "utf-8")) : undefined;
    });
    if (!html.includes('class="fa-nav"')) continue;
    const under = f.slice(siteRel.length + 1);
    const dir = under.includes("/") ? `/${under.slice(0, under.lastIndexOf("/") + 1)}` : "/";
    sightings.push(...sightingsFromNavHtml(html, dir, `viewer rail (${dir})`, f));
    read.railPages++;
  }

  if (read.railPages === 0 && !read.include) {
    return {
      undetermined: "no railed page and no navbar include were read — nothing to compare the data against",
      sightings,
      conflicts: [],
      templates,
      read,
      destinations: 0,
    };
  }
  const found = conflicts(sightings);
  return {
    sightings,
    conflicts: found,
    templates,
    read,
    destinations: new Set(sightings.filter((s) => s.surface !== "sticky card links").map((s) => s.href)).size,
  };
}

/** The sidecar for a result: what a reviewer diffs to see a new second name arrive. */
export function navNamesQaResult(r: NavNamesResult): QaResult {
  return buildQaResult({
    script: "cat-harness-tools/scripts/check-nav-names.ts",
    scriptAbsPath: fileURLToPath(import.meta.url),
    subject: { kind: "corpus", id: "navigation-names" },
    families: {
      "two-names-for-one-destination": {
        summary:
          "A destination (normalised href) that carries two or more base labels across the generated navigation " +
          "surfaces: the viewer rail, the Jekyll sidebar include, harness rows, landing viewers, FOLDERS, the glass " +
          "and Stickies tiles, and sticky card links where another surface links the same page. Owner, 2026-10-01, " +
          "bean `ob3m` finding 6: 'One name everywhere'. Each destination gets one label from " +
          "`scripts/lib/nav-label.ts`, and a surface may only APPEND the harness as a qualifier. Measured before: " +
          "10 of 42 destinations carried two names.",
        entries: r.conflicts,
      },
      "template-prints-kind-word": {
        summary:
          "A landing template anchor whose text is a `.kind` expression. The landing prints the data's `label`; " +
          "printing the kind word composes a second name for the same page in the template.",
        entries: r.templates,
      },
    },
  });
}

if (import.meta.main) {
  const siteAbs = join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT));
  const check = process.argv.includes("--check");
  if (!check && !existsSync(readPathAt(REPO_ROOT, join(siteAbs, "_data", "harness.json")))) {
    spawnSync("bun", ["run", "cat", "docs:harness"], { cwd: REPO_ROOT, stdio: "inherit" });
  }
  const r = checkNavNames(REPO_ROOT, siteAbs);

  if (r.undetermined) {
    console.error(`UNDETERMINED: ${r.undetermined}.`);
    console.error("This is not a pass: nothing was compared.");
    process.exit(2);
  }

  const result = navNamesQaResult(r);
  let verdict: QaVerdict | undefined;
  if (check) {
    // COMPUTE AND JUDGE (beans `0dav`, `oqe3`), as every gate moved off a
    // committed record does: the results directory declares `storage`, so the
    // working copy is not the record and comparing against it reads UNKNOWN.
    // Both families fail; a missing baseline is reported, not gated.
    const { against, exit: badRef } = againstOrUsage("check:nav-names:check");
    if (badRef !== undefined) process.exit(badRef);
    verdict = judgeQaResult({
      gate: "check:nav-names:check",
      fresh: result,
      failOn: ["two-names-for-one-destination", "template-prints-kind-word"],
      baseline: { root: INSTANCE_ROOT, stem: STEM, writer: "check:nav-names", against },
    });
  } else {
    writeQaResult(INSTANCE_ROOT, STEM, result);
  }

  console.log(
    `navigation names: ${r.destinations} destination(s), ${r.sightings.length} sighting(s) — ` +
      `${r.read.railPages} railed page(s), include ${r.read.include ? "read" : "MISSING"}, ` +
      `_data/harness.json read, stickies ${r.read.stickies ? "read" : "not read"}, ${r.read.templates} template(s)`,
  );
  if (r.conflicts.length === 0 && r.templates.length === 0) {
    console.log("  ✓ every destination carries one name on every surface");
  }
  for (const c of r.conflicts) {
    console.log(`  ✗ ${c.href}`);
    for (const n of c.names) console.log(`      "${n.label}"  — ${n.surfaces.join("; ")}`);
  }
  for (const t of r.templates) {
    console.log(`  ✗ ${t.file}:${t.line} prints {{ ${t.expression} }} — print the data's label instead`);
  }
  if (r.conflicts.length > 0) {
    console.log(
      "\n  Each destination's name comes from `scripts/lib/nav-label.ts`. Fix the declaration it is derived " +
        "from (a kind's `title`, a tile's `title`, a harness's `title`), regenerate, and never compose a name " +
        "on a surface.",
    );
  }
  if (verdict !== undefined) process.exit(verdict.exit);
  if (r.conflicts.length > 0 || r.templates.length > 0) process.exit(1);
}
