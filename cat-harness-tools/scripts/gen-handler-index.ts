#!/usr/bin/env bun
/**
 * The handler namespace's own index — `<site>/<handler>/index.html`.
 *
 * @module scripts/gen-handler-index
 * @covers docs
 * @graphNode none — a generator over the tiles model, not a schema itself
 *
 * `/<handler>/` is where this layer publishes every graph it renders, as
 * `<base>/<handler>/<kind>/[<subject>/]`. Where that meets the layer's own
 * `<base>/<instance>/` route, **the handler wins**: the root is this
 * generated index.
 *
 * `siteLinks` publishes the `kg` tile as `{ path: "/<stub>/", target:
 * "<stub>/index.html" }`, so this page is the KG viewer's landing.
 * `verifySiteLinks` reports `unknown`, not `dead`, when the site is not built,
 * so a missing page here shows only in production.
 *
 * ## Derived from the tiles model, not from the filesystem
 *
 * It renders `harnessTiles` (which declared kinds have a published path, per
 * layer), the model the navbar and the board read, so the page and the
 * navbar cannot disagree, and it need not run after the other generators: a
 * `coverage.visualiser` declaration makes a kind appear, not a file on disk.
 *
 * A kind whose declaration names no published path is shown as **declared,
 * not published** rather than omitted.
 *
 * Usage:
 *   bun run cat handler:index          # write
 *   bun run cat handler:index:check    # fail if stale
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { harnessTiles, type HarnessTile } from "./harness-tiles.ts";
import { graphTiles, type GraphTile } from "./graph-tiles.ts";
import { readDeclaration, repoRootFor, siteDirFor } from "../schemas/kg/cat-harness.ts";
import { publishedPagePath } from "./lib/jekyll-permalink.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = join(HARNESS_ROOT);
const check = process.argv.includes("--check");

/**
 * The page's FILENAME, which is deliberately not `index.md`.
 *
 * Its route is `/<handler>/` and Jekyll gets that from the `permalink` in the
 * front matter, so the file may be called anything — and it must be, because
 * `docs/index.md` and `docs/<handler>/index.md` sharing the stem `index` is
 * the collision bean `8h42` asks to be **gone rather than contained**.
 *
 * It was contained, and the containment was paid for: `resolvePoSources`
 * finds a block-level PO by bare stem, so the second `index` resolved to the
 * first one's catalogue and the first run of the page sweep wrote five locales
 * of "translation-coverage: fail, 2%" about a page nobody had ever translated
 * (PR #691). The fix then was to make a PO claim its subject through its own
 * gettext `#:` references. Replacing the authored `index.md` with a GENERATED
 * one at the same path would have rebuilt the collision under the repair.
 */
const PAGE_FILE = "published-graphs.md";

/** One row of the page: a layer, and one kind this handler renders for it. */
export interface HandlerRow {
  instance: string;
  label: string;
  kind: string;
  /** Site-root-relative; absent when the kind is declared and nothing publishes it. */
  path?: string;
}

/**
 * Every (instance, kind) this handler renders, sorted by kind then layer.
 *
 * By KIND first, because the question a reader arrives with is "where are the
 * schemas" far more often than "what does that instance have" — and the navbar
 * already answers the second, one tile per layer.
 */
export function handlerRows(tiles: readonly HarnessTile[]): HandlerRow[] {
  const out: HandlerRow[] = [];
  for (const t of tiles) {
    for (const v of t.visualisations) {
      out.push({ instance: t.name, label: t.label, kind: v.kind, path: v.path });
    }
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.instance.localeCompare(b.instance));
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The page.
 *
 * A Jekyll page with front matter rather than a standalone HTML document, so
 * it inherits the site's theme, navbar and locale chrome — unlike the four
 * viewers, which are zero-dependency apps fetching a projection. This one
 * renders a list that is already computed; it needs no client at all.
 */
export function handlerIndexPage(handler: string, rows: readonly HandlerRow[], viewers: readonly GraphTile[] = []): string {
  const byKind = new Map<string, HandlerRow[]>();
  for (const r of rows) {
    const list = byKind.get(r.kind) ?? byKind.set(r.kind, []).get(r.kind)!;
    list.push(r);
  }

  // MARKDOWN, not raw HTML blocks — and that distinction was measured rather
  // than assumed. An earlier draft emitted `<h3><code>kind</code></h3>`, which
  // kramdown passes through untouched and therefore assigns NO heading id. The
  // just-the-docs anchor-heading include then fell back to the page's own id,
  // so all 22 kind headings rendered `href="#published-graphs"` — one anchor
  // for every section, and an `aria-labelledby` pointing at a heading that is
  // not the one being labelled. A local Jekyll build is the only thing that
  // shows it; the generator's own output looks right. Bean `gjli` is the
  // standing rule ("ALL UI must follow accessibility guidelines").
  const sections = [...byKind.entries()].map(([kind, list]) => {
    const items = list
      .map((r) =>
        r.path === undefined
          ? `- ${esc(r.label)} — *declared, not published*`
          : `- [${esc(r.label)}]({{ '${esc(r.path)}' | relative_url }})`,
      )
      .join("\n");
    const published = list.filter((r) => r.path !== undefined).length;
    return `### \`${esc(kind)}\`\n\n${published} of ${list.length} published.\n{: .fa-hx-dim }\n\n${items}`;
  });

  return `---
layout: default
title: Published graphs
lang: en
description: "Every graph this handler renders, by kind and by the instance whose material it shows."
nav_order: 2
permalink: /${handler}/
---

<!--
  GENERATED by scripts/gen-handler-index.ts. Do not edit.

  This route is the HANDLER NAMESPACE: \`<base>/<handler>/<kind>/[<subject>/]\`,
  where the handler segment is read from this instance's declared \`name\`. The
  authored page that used to sit here moved to \`docs/platform.md\` on
  2026-09-21, when the owner settled that the handler owns the path. Bean \`8h42\`.

  The rows come from \`harnessTiles\`, the same model the navbar reads, so this
  page and the navbar cannot disagree about what is published.
-->

# Published graphs
{: .no_toc }

Every graph this handler renders, by kind and by the instance whose material it
shows. The handler segment of each route is this instance's declared name; the
subject segment, where there is one, is the instance the material belongs to.

**This is the one place every index is reached from** — the tables of contents
(\`docs\`, \`skills\`), the glossaries, the methodologies, the tools, the
libraries' catalogues and the latent semantic indexes (\`qa\`) are each a kind
below. It is listed in the sidebar for that reason (bean \`ansc\`: it had been
excluded from navigation, so the page that answers "where are all the indexes?"
could only be found by knowing its address).

A kind listed as **declared, not published** is one an instance declared and
nothing renders yet. It is shown rather than omitted: "nothing renders this" and
"this does not exist" are different answers, and a gap says neither.

${sections.join("\n\n")}
${viewerSection(viewers)}
---

Looking for what the platform *is* rather than what it publishes?
[The platform]({{ '/${publishedPagePath(join(ROOT, siteDirFor(ROOT)), "platform")}' | relative_url }}) carries the actor, role,
process and skill model.
`;
}

/**
 * Every DECLARED viewer, by title — the second half of "where are all the
 * indexes?".
 *
 * The sections above list one page per (instance, kind), and discovery there
 * is convention-first, so a kind that already has a page at its conventional
 * route keeps that link and a titled viewer declared for the same kind never
 * shows. That is how the latent-semantic-index viewer (declared on the `qa`
 * directory, bean `ansc`) reached the navbar and the board and not this page.
 * These are the SAME tiles the navbar and the board read — `graphTiles` over
 * the same declaration — so the three surfaces cannot disagree about which
 * viewers exist. Hidden tiles and tiles with no published href are left out:
 * a row that is not a link is not a way to reach anything.
 */
export function viewerSection(viewers: readonly GraphTile[]): string {
  const shown = viewers.filter((v) => !v.hidden && v.href !== undefined);
  if (shown.length === 0) return "";
  const items = [...shown]
    .sort((a, b) => a.title.localeCompare(b.title, "en"))
    .map((v) => `- [${esc(v.title)}]({{ '${esc(v.href!)}' | relative_url }}) — declared on \`${esc(v.directory)}\``)
    .join("\n");
  return `\n## Every declared viewer\n\nThe same viewers the navbar and the board show, by title.\n\n${items}\n`;
}

let stale = 0;
function emit(path: string, content: string): void {
  if (check) {
    const current = existsSync(path) ? readFileSync(path, "utf-8") : "";
    if (current === content) return;
    console.error(`  ✗ ${path} ${existsSync(path) ? "is stale" : "is missing"}`);
    stale++;
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`  ✓ ${path}`);
}

if (import.meta.main) {
  const repoRoot = repoRootFor(ROOT);
  const decl = readDeclaration(ROOT);
  if (!decl?.name) {
    // Not a pass. A layer with no declared name has no handler segment, so
    // there is no namespace to index — and saying so is different from saying
    // the index is fine.
    console.log("  · this instance declares no name — no handler namespace to index");
    process.exit(0);
  }
  const names = readdirSync(repoRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "node_modules")
    .map((d) => d.name)
    .sort();
  const rows = handlerRows(harnessTiles(repoRoot, ROOT, names));
  const site = join(ROOT, siteDirFor(ROOT));
  const out = join(site, decl.name, PAGE_FILE);
  const viewers = graphTiles(decl.directories ?? [], relative(repoRoot, site));
  emit(out, handlerIndexPage(decl.name, rows, viewers));

  if (!check) {
    const published = rows.filter((r) => r.path !== undefined).length;
    console.log(
      `  ${rows.length} (instance, kind) pair(s), ${published} published, ` +
        `${new Set(rows.map((r) => r.kind)).size} kind(s) — ` +
        `at /${decl.name}/ (${relative(repoRoot, out)})`,
    );
  }
  if (stale > 0) {
    console.error(`\n${stale} artefact(s) stale — run \`bun run cat handler:index\``);
    process.exit(1);
  }
}
