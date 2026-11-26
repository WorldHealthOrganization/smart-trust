#!/usr/bin/env bun
/**
 * @covers fhir-artifact-index, qa
 *
 * P1's navigation diff (bean `ha24`, `ig-publisher-reduction` P1): the IG's
 * navigation DERIVED from its `sushi-config.yaml` `menu:` — the data this
 * pipeline renders from — against the navigation the IG Publisher actually
 * RENDERED into its top bar. One record per IG, and a combined record across
 * IGs, as `qa-results/v1`.
 *
 * Exit criterion (the skill's words): *one diff per IG; each difference empty
 * or explained entry by entry; the per-IG diffs also reported together*. This
 * tool produces the diffs; an explanation is a person's, recorded beside the
 * finding (the bean), never invented here.
 *
 * ## The two sides, and reusing the one parser
 *
 * - **Derived:** `groupsFromSushiMenu` from `ingest-ig-menu.ts` — owner,
 *   2026-10-01: *"use pages: menu: for IGs as data … reuse sushi-config"*. No
 *   second parser of `menu:`.
 * - **Rendered:** the Publisher writes `menu:` into every page as
 *   `<ul class="nav navbar-nav">`: a dropdown `<li>` holds a
 *   `<ul class="dropdown-menu">`; a plain `<li><a>` is a top-level page. Read
 *   from the Publisher's `index.html`.
 *
 * ## What a difference is
 *
 * Entries are matched by HREF within their group — a label is what the reader
 * sees, but the href is what the entry IS — so:
 * - `only-derived` / `only-rendered`: an entry one side has and the other not;
 * - `label`: same href, different label;
 * - `group-only-derived` / `group-only-rendered`: a whole top-level group;
 * - `order`: the same entries in a different order (reported once per group).
 *
 * With `--toc`, the PAGES too: `sushi-config.yaml` `pages:` against the pages
 * the Publisher's `toc.html` lists (artefact pages left out), as `toc-diff`.
 *
 * Generic: nothing here knows whose IG it is.
 *
 *   bun run fhir-harness/scripts/ig-nav-diff.ts --sushi <sushi-config.yaml> --rendered <index.html> [--toc <toc.html>] --out <file> [--check]
 *   bun run fhir-harness/scripts/ig-nav-diff.ts --combine <record.json> <record.json> [...] --out <file> [--check]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { sourceHashOf, type QaResult } from "../../cat-harness-tools/scripts/qa-results.ts";
import { groupsFromSushiMenu } from "./ingest-ig-menu.ts";
import type { IgMenuGroup } from "../schemas/ig-menu.ts";

const REPO = resolve(import.meta.dir, "..", "..");

const decode = (s: string): string =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** The top-level `<li>` elements of a `<ul>` body, by depth — no regex can pair nested tags. */
function topLevelItems(ul: string): string[] {
  const out: string[] = [];
  const tag = /<(\/?)li\b[^>]*>/g;
  let depth = 0;
  let start = -1;
  for (let m = tag.exec(ul); m; m = tag.exec(ul)) {
    if (!m[1]) {
      if (depth === 0) start = m.index;
      depth++;
    } else if (--depth === 0 && start >= 0) {
      out.push(ul.slice(start, m.index + m[0].length));
      start = -1;
    }
  }
  return out;
}

/** The body of the first `<ul>` whose class list includes `cls`, paired by depth. */
function ulBody(html: string, cls: string, from = 0): string | undefined {
  const open = new RegExp(`<ul\\b[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`, "g");
  open.lastIndex = from;
  const m = open.exec(html);
  if (!m) return undefined;
  const tag = /<(\/?)ul\b[^>]*>/g;
  tag.lastIndex = m.index + m[0].length;
  let depth = 1;
  for (let t = tag.exec(html); t; t = tag.exec(html)) {
    depth += t[1] ? -1 : 1;
    if (depth === 0) return html.slice(m.index + m[0].length, t.index);
  }
  return undefined;
}

/** The navigation the Publisher RENDERED: its `navbar-nav` top bar, in order. */
export function renderedMenu(html: string): IgMenuGroup[] {
  const bar = ulBody(html, "navbar-nav");
  if (bar === undefined) throw new Error("no <ul class=\"navbar-nav\"> in the page: not a Publisher-rendered page, or a template this reader does not know");
  return topLevelItems(bar).map((li) => {
    const sub = ulBody(li, "dropdown-menu");
    const first = /<a\b([^>]*)>([\s\S]*?)<\/a>/.exec(li);
    const label = decode(first?.[2] ?? "");
    if (sub === undefined) {
      const href = /href="([^"]*)"/.exec(first?.[1] ?? "")?.[1];
      return { label, ...(href && href !== "#" ? { href } : {}), items: [] };
    }
    const items = topLevelItems(sub).flatMap((c) => {
      const a = /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(c);
      return a ? [{ label: decode(a[2]!), href: a[1]! }] : [];
    });
    return { label, items };
  });
}

/** The navigation DERIVED from `sushi-config.yaml`'s `menu:` — the existing parser, not a second one. */
export function derivedMenu(sushiYaml: string): IgMenuGroup[] {
  const s = (parseYaml(sushiYaml) ?? {}) as Record<string, unknown>;
  return groupsFromSushiMenu(s.menu);
}

/** The pages `sushi-config.yaml` `pages:` declares (a nested map, file → `{title, …children}`), as `.html` names. */
export function derivedPages(sushiYaml: string): string[] {
  const s = (parseYaml(sushiYaml) ?? {}) as Record<string, unknown>;
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (!/\.(md|xml|html)$/.test(key)) continue;
      out.push(key.replace(/\.(md|xml)$/, ".html"));
      walk(value);
    }
  };
  walk(s.pages);
  return out;
}

/** An artefact page (`ValueSet-x.html`, `StructureDefinition-y.html`): the toc's artefact half, not P1's. */
const ARTEFACT_PAGE = /^[A-Z][A-Za-z0-9]+-[^/]+\.html$/;

/**
 * The PAGES the Publisher's `toc.html` lists: every local `.html` link in its
 * table of contents, without anchors, artefact pages left out — those are the
 * artefact index's question (`jut3`), not navigation's.
 */
export function renderedTocPages(html: string): string[] {
  const start = html.indexOf("Table of Contents");
  if (start < 0) throw new Error("no 'Table of Contents' in the page: not a Publisher toc.html");
  const body = html.slice(start);
  const seen = new Set<string>();
  for (const m of body.matchAll(/<a\b[^>]*href="([^"#:?]+\.html)(?:#[^"]*)?"/g)) {
    const href = m[1]!.replace(/^\.\//, "");
    if (!href.includes("/") && !ARTEFACT_PAGE.test(href)) seen.add(href);
  }
  return [...seen];
}

export type TocDifference = { kind: "page-only-derived" | "page-only-rendered"; page: string };

/** Pages one side has and the other does not. Order is not compared: a toc is a tree the Publisher numbers itself. */
export function tocDiff(derived: string[], rendered: string[]): TocDifference[] {
  const r = new Set(rendered);
  const d = new Set(derived);
  return [
    ...derived.filter((p) => !r.has(p)).map((page) => ({ kind: "page-only-derived" as const, page })),
    ...rendered.filter((p) => !d.has(p)).map((page) => ({ kind: "page-only-rendered" as const, page })),
  ];
}

export type NavDifference =
  | { kind: "group-only-derived" | "group-only-rendered"; group: string }
  | { kind: "only-derived" | "only-rendered"; group: string; label: string; href: string }
  | { kind: "label"; group: string; href: string; derived: string; rendered: string }
  | { kind: "order"; group: string; derived: string[]; rendered: string[] };

/** Every difference between the derived and the rendered navigation, entry by entry. */
export function navDiff(derived: IgMenuGroup[], rendered: IgMenuGroup[]): NavDifference[] {
  const out: NavDifference[] = [];
  const norm = (h: string) => h.replace(/^\.\//, "");
  // A top-level PAGE is matched as an entry of a one-item group of itself.
  const entries = (g: IgMenuGroup) => (g.items.length ? g.items : g.href ? [{ label: g.label, href: g.href }] : []);
  const byLabel = new Map(rendered.map((g) => [g.label, g]));
  const seen = new Set<string>();
  for (const d of derived) {
    const r = byLabel.get(d.label);
    if (!r) {
      out.push({ kind: "group-only-derived", group: d.label });
      continue;
    }
    seen.add(d.label);
    const de = entries(d);
    const re = entries(r);
    const rByHref = new Map(re.map((e) => [norm(e.href), e]));
    const dByHref = new Map(de.map((e) => [norm(e.href), e]));
    for (const e of de) {
      const m = rByHref.get(norm(e.href));
      if (!m) out.push({ kind: "only-derived", group: d.label, label: e.label, href: e.href });
      else if (m.label !== e.label) out.push({ kind: "label", group: d.label, href: e.href, derived: e.label, rendered: m.label });
    }
    for (const e of re) if (!dByHref.has(norm(e.href))) out.push({ kind: "only-rendered", group: d.label, label: e.label, href: e.href });
    const common = (xs: typeof de, other: Map<string, unknown>) => xs.map((e) => norm(e.href)).filter((h) => other.has(h));
    const dOrder = common(de, rByHref);
    const rOrder = common(re, dByHref);
    if (dOrder.join("\n") !== rOrder.join("\n")) out.push({ kind: "order", group: d.label, derived: dOrder, rendered: rOrder });
  }
  for (const r of rendered) if (!seen.has(r.label)) out.push({ kind: "group-only-rendered", group: r.label });
  return out;
}

/** One IG's record. Zero differences is a finding too: the comparison was made. */
export function navDiffRecord(
  ig: string,
  derived: IgMenuGroup[],
  rendered: IgMenuGroup[],
  script: string,
  toc?: { derived: string[]; rendered: string[] },
): QaResult {
  const diffs = navDiff(derived, rendered);
  const tocDiffs = toc ? tocDiff(toc.derived, toc.rendered) : undefined;
  const count = (g: IgMenuGroup[]) => g.reduce((n, x) => n + Math.max(x.items.length, x.href ? 1 : 0), 0);
  return {
    $schema: "qa-results/v1",
    producer: { script, script_hash: sourceHashOf(join(REPO, script)) },
    subject: { kind: "fhir-ig", id: ig },
    families: {
      "nav-diff": {
        summary: `Navigation derived from sushi-config.yaml menu: (${derived.length} groups, ${count(derived)} entries) against the Publisher's rendered top bar (${rendered.length} groups, ${count(rendered)} entries); each difference is to be explained entry by entry (P1)`,
        count: diffs.length,
        entries: diffs,
      },
      ...(tocDiffs && toc
        ? {
            "toc-diff": {
              summary: `Pages declared by sushi-config.yaml pages: (${toc.derived.length}) against the pages the Publisher's toc.html lists (${toc.rendered.length}, artefact pages left out)`,
              count: tocDiffs.length,
              entries: tocDiffs,
            },
          }
        : {}),
    },
    total: diffs.length + (tocDiffs?.length ?? 0),
  };
}

/** The per-IG records together (P1's combined view), each difference tagged with its IG. */
export function combinedNavDiff(records: QaResult[], script: string): QaResult {
  if (records.length < 2) throw new Error(`a combined view needs at least two IGs, got ${records.length}`);
  const ids = records.map((r) => r.subject.id);
  if (new Set(ids).size !== ids.length) throw new Error(`an IG appears twice: ${ids.join(", ")}`);
  const entries = records.flatMap((r) =>
    ["nav-diff", "toc-diff"].flatMap((fam) => (r.families[fam]?.entries ?? []).map((e) => ({ ig: r.subject.id, ...(e as Record<string, unknown>) }))),
  );
  return {
    $schema: "qa-results/v1",
    producer: { script, script_hash: sourceHashOf(join(REPO, script)) },
    subject: { kind: "fhir-ig-set", id: ids.join("+") },
    families: {
      "by-ig": {
        summary: "Each IG's difference count, so one IG's empty diff is visible rather than absorbed",
        count: records.length,
        entries: records.map((r) => ({ ig: r.subject.id, differences: r.total })),
      },
      "nav-diff": { summary: `Navigation and toc differences across ${ids.join(", ")}`, count: entries.length, entries },
    },
    total: entries.length,
  };
}

function writeOrCheck(out: string, record: QaResult, check: boolean): void {
  const text = `${JSON.stringify(record, null, 2)}\n`;
  if (check) {
    if (!existsSync(out) || readFileSync(out, "utf8") !== text) {
      console.error(`✗ ${out} is stale — run without --check`);
      process.exit(1);
    }
    console.log(`✓ ${out} is current`);
    return;
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const opt = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const out = opt("--out");
  const check = argv.includes("--check");
  const script = relative(REPO, join(import.meta.dir, "ig-nav-diff.ts"));
  if (argv.includes("--combine")) {
    const rest = argv.slice(argv.indexOf("--combine") + 1);
    const end = rest.findIndex((a) => a.startsWith("--"));
    const files = end < 0 ? rest : rest.slice(0, end);
    if (files.length < 2 || !out) {
      console.error("usage: ig-nav-diff.ts --combine <record.json> <record.json> [...] --out <file> [--check]");
      process.exit(2);
    }
    const record = combinedNavDiff(files.map((f) => JSON.parse(readFileSync(f, "utf8")) as QaResult), script);
    writeOrCheck(resolve(out), record, check);
    const by = record.families["by-ig"]!.entries as Array<{ ig: string; differences: number }>;
    if (!check) console.log(`${out}: ${record.total} difference(s) across ${by.length} IGs — ${by.map((b) => `${b.ig} ${b.differences}`).join("; ")}`);
  } else {
    const sushi = opt("--sushi");
    const rendered = opt("--rendered");
    if (!sushi || !rendered || !out) {
      console.error("usage: ig-nav-diff.ts --sushi <sushi-config.yaml> --rendered <index.html> [--toc <toc.html>] --out <file> [--check]");
      process.exit(2);
    }
    const yaml = readFileSync(sushi, "utf8");
    const ig = String((parseYaml(yaml) as { id?: unknown } | null)?.id ?? "unknown");
    const tocFile = opt("--toc");
    const toc = tocFile ? { derived: derivedPages(yaml), rendered: renderedTocPages(readFileSync(tocFile, "utf8")) } : undefined;
    const record = navDiffRecord(ig, derivedMenu(yaml), renderedMenu(readFileSync(rendered, "utf8")), script, toc);
    writeOrCheck(resolve(out), record, check);
    if (!check) {
      console.log(`${out}: ${ig} — ${record.total} difference(s)`);
      for (const fam of ["nav-diff", "toc-diff"]) for (const d of record.families[fam]?.entries ?? []) console.log(`  ${fam}: ${JSON.stringify(d)}`);
    }
  }
}
