#!/usr/bin/env bun
/**
 * Check every MARKDOWN annex's links from the page it is appended to.
 *
 * @module fhir-harness/scripts/check-ig-annex-links
 * @covers ig-annex
 *
 * A `.md` annex (`ig-annexes/v1`, {@link annexesIn}) is appended to its host
 * page `input/pagecontent/<page>` as written (`stageIgSite`), so its links
 * address the PUBLISHED page, not the directory that holds the file:
 * `business-processes.html#b--plan-service-delivery` in `annexes/` names the
 * page `input/pagecontent/business-processes.md` renders, and the heading
 * kramdown gives an id there. The kind says so (`ig-annex.json`
 * `shownOnPublishedPages`), which takes such links out of the harness's
 * source-tree link sweep (`check:subgraphs`). This gate is the other half:
 * without it, a genuinely broken annex link would be checked by nothing.
 * Owner, 2026-10-26 (https://github.com/litlfred/smart-immunizations/issues/81, option A).
 *
 * What is checked, from the host page:
 *
 * - `x.html` is a page this IG serves: `input/pagecontent/x.md`, a
 *   Publisher-only page ({@link PUBLISHER_PAGES}), `artifacts.html`, or an
 *   artefact page (`x.json` among the IG's resources);
 * - `#id` and `x.html#id`, where `x` is a pagecontent page, name an id that
 *   page carries: a heading's kramdown id ({@link kramdownId}), an explicit
 *   `{#id}`, or an `id="…"` / `name="…"` attribute, counting the annexes
 *   appended to that page too. An anchor on a page this build does not
 *   write (an artefact page) is not judged.
 *
 * Any other relative target (an image, a file) is counted as not judged,
 * never passed silently. A repository with no `ig-annex` directory has
 * nothing to check and says so.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { repoRootFor } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { gitTopLevelDirs } from "@litlfred/cat-harness-tools/schemas/sdlc/git-corpus.js";
import { PUBLISHER_PAGES, kramdownId } from "./build-ig-site.ts";
import { annexesFor } from "./stage-ig-sites.ts";

export interface AnnexLinkFinding {
  /** The annex, relative to the IG root. */
  annex: string;
  /** The page it is appended to. */
  page: string;
  target: string;
  reason: string;
}

export interface AnnexLinkReport {
  /** Markdown annexes examined. */
  annexes: number;
  /** Links judged. */
  checked: number;
  /** Relative links of a sort this gate does not judge (a file, an image). */
  notJudged: string[];
  findings: AnnexLinkFinding[];
}

/** Where an IG's artefact pages come from: `<Type>-<id>.json` in any of these. */
const RESOURCE_DIRS = ["fsh-generated/resources", "input/resources", "input/examples", "input/vocabulary", "input/profiles", "input/extensions"];

/** The relative link targets of a markdown text: `](t)` and `href="t"`. */
export function annexLinkTargets(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?:\]\(|href=["'])([^)"'\s]+)(?=[)"'\s])/g)) {
    const t = m[1]!;
    if (/^([a-z][a-z0-9+.-]*:|\/|\{)/i.test(t) || t.includes("{")) continue;
    out.push(t);
  }
  return out;
}

/** The ids a markdown page carries: headings' kramdown ids, `{#id}`, and `id=`/`name=` attributes. */
export function pageIds(text: string): Set<string> {
  const ids = new Set<string>();
  for (const m of text.matchAll(/^#{1,6}[ \t]+(.+?)[ \t#]*$/gm)) {
    const h = m[1]!;
    const explicit = /\{:?\s*#([A-Za-z][\w:.-]*)\s*\}\s*$/.exec(h);
    // kramdown also drops leading characters that are not letters.
    ids.add(explicit ? explicit[1]! : kramdownId(h).replace(/^[^a-z]+/, ""));
  }
  for (const m of text.matchAll(/\{:?\s*#([A-Za-z][\w:.-]*)\s*\}/g)) ids.add(m[1]!);
  for (const m of text.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) ids.add(m[1]!);
  return ids;
}

/** Judge every markdown annex an IG at {@link root} declares, from its host page. */
export function checkAnnexLinks(root: string): AnnexLinkReport {
  const pagecontent = join(root, "input", "pagecontent");
  const md = (annexesFor(root, () => {}) ?? []).filter((a) => a.src.endsWith(".md"));
  const report: AnnexLinkReport = { annexes: md.length, checked: 0, notJudged: [], findings: [] };
  const idCache = new Map<string, Set<string> | undefined>();
  // A page's ids, its markdown annexes appended, as the published page has them.
  const idsOf = (page: string): Set<string> | undefined => {
    if (idCache.has(page)) return idCache.get(page);
    const file = join(pagecontent, page);
    const ids = existsSync(file)
      ? pageIds([readFileSync(file, "utf-8"), ...md.filter((a) => a.page === page).map((a) => readFileSync(a.src, "utf-8"))].join("\n\n"))
      : undefined;
    idCache.set(page, ids);
    return ids;
  };
  const isArtefactPage = (name: string): boolean => RESOURCE_DIRS.some((d) => existsSync(join(root, d, `${name}.json`)));

  for (const a of md) {
    const annex = a.src.startsWith(root + "/") ? a.src.slice(root.length + 1) : a.src;
    const find = (target: string, reason: string) => report.findings.push({ annex, page: a.page, target, reason });
    for (const target of annexLinkTargets(readFileSync(a.src, "utf-8"))) {
      const hash = target.indexOf("#");
      const path = (hash < 0 ? target : target.slice(0, hash)).replace(/\?.*$/, "").replace(/^\.\//, "");
      const anchor = hash < 0 ? "" : decodeURIComponent(target.slice(hash + 1));
      if (path !== "" && !path.endsWith(".html")) {
        report.notJudged.push(`${annex} -> ${target}`);
        continue;
      }
      report.checked++;
      const page = path === "" ? a.page : `${basename(path, ".html")}.md`;
      if (path !== "" && !path.includes("/") && existsSync(join(pagecontent, page))) {
        // A page this IG writes from its pagecontent: the anchor is judged too.
      } else if (path !== "") {
        const name = basename(path, ".html");
        if (PUBLISHER_PAGES.has(path) || path === "artifacts.html" || (!path.includes("/") && isArtefactPage(name))) continue;
        find(target, `no page serves ${path}: no input/pagecontent/${page} and no artefact ${name}`);
        continue;
      }
      if (anchor === "") continue;
      const ids = idsOf(page);
      if (ids === undefined) find(target, `the host page input/pagecontent/${page} is not held`);
      else if (!ids.has(anchor)) find(target, `input/pagecontent/${page} carries no id "${anchor}"`);
    }
  }
  return report;
}

if (import.meta.main) {
  const ROOT = repoRootFor(join(import.meta.dir, ".."));
  // The repository root and every layer at its top level: an index mounts
  // IGs beside each other; an IG repository is its own root.
  const roots = [ROOT, ...gitTopLevelDirs(ROOT).names.map((n) => join(ROOT, n))].filter((r) => existsSync(join(r, "input", "pagecontent")));
  let annexes = 0;
  let failed = 0;
  for (const r of roots) {
    let rep: AnnexLinkReport;
    try {
      rep = checkAnnexLinks(r);
    } catch (e) {
      console.error(`✗ ${r}: ${(e as Error).message}`);
      failed++;
      continue;
    }
    if (rep.annexes === 0) continue;
    annexes += rep.annexes;
    console.log(`${basename(r)}: ${rep.annexes} markdown annex(es), ${rep.checked} link(s) judged from their host pages, ${rep.notJudged.length} not judged`);
    for (const n of rep.notJudged) console.log(`  · not judged: ${n}`);
    for (const f of rep.findings) console.error(`✗ ${f.annex} (on ${f.page}) -> ${f.target}: ${f.reason}`);
    failed += rep.findings.length;
  }
  if (annexes === 0) console.log("No markdown annex declared here: nothing to check.");
  if (failed > 0) {
    console.error(`\n${failed} broken annex link(s). Fix the GENERATOR that writes the annex, not the annex.`);
    process.exit(1);
  }
}
