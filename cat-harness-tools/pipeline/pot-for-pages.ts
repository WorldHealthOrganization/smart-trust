#!/usr/bin/env bun
/**
 * `.pot` templates for the published pages that have no catalogue.
 *
 * ## Why this exists, and what it deliberately does NOT do
 *
 * `translation:drift:check` fails on a page that is published in a locale with
 * no `.po` beside it. On 2026-09-26 that is **25** pages — the 5 × 5 grid of
 * `accessibility` / `content-types` / `contributing` / `getting-started` /
 * `installation` × `ar` / `es` / `fr` / `ru` / `zh` — and `main` carries that
 * red BY DECISION (bean `ngxj`, issue #206). The owner chose the remedy on
 * 2026-09-26: **get the catalogues authored**, not record their absence.
 *
 * **This does not turn the gate green, and must not be read as trying to.** A
 * `.pot` is a translator's INPUT; the gate wants a `.po`, which is a
 * translator's OUTPUT. What this removes is the reason a translator cannot
 * start: measured the same day, not one of those 25 pages had a `.pot` OR a
 * `.po` in any locale, so the campaign had nothing to be handed.
 *
 * Bean `f6r1` is why generating the `.po` is not on the table: of 27 such
 * translations, **19 are provably not derivable** from the published text (the
 * segment counts differ by ~20, so deriving would mean deciding which segments
 * went untranslated and which were merged) and 8 are undetermined, with 0
 * demonstrated derivable. Authoring is human work. Extraction is not.
 *
 * ## The page list is DERIVED, never written down here
 *
 * It comes from `translation-drift`'s own findings, so this cannot disagree
 * with the gate it exists to serve. A hardcoded list of five names would be a
 * second answer to "which pages need a catalogue", free to drift the moment one
 * is finished — and the whole subject here is a record going stale against a
 * corpus that moved on.
 *
 * ## Reuses the extractor, adds nothing to it
 *
 * `extractMarkdown` + `formatPot` from `pot-extract.ts`, called the same way
 * the `translation_extract` MCP tool calls them. That tool could already do
 * this one page at a time; what was missing was a runnable entry point over
 * the SET the gate names, which is why this is 40 lines and not a parser.
 *
 * Usage:
 *   bun run cat translation:pot              # write a .pot per (locale, page) needing one
 *   bun run cat translation:pot -- --check   # exit 1 if any is missing or stale
 *   bun run cat translation:pot -- --json    # the plan, written nowhere
 *
 * Exit: 0 wrote or all current, 1 `--check` found one missing or stale,
 *       2 could not determine — the drift report named no page.
 *
 * @module pipeline/pot-for-pages
 * @covers cat-harness
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { directoryForGraph, readDeclaration, siteDirFor } from "../schemas/kg/cat-harness.js";
import { extractMarkdown, formatPot, potWithoutTimestamp } from "./pot-extract.js";
import { driftFor } from "./translation-drift.js";
import { gateOwnInstances, gateOwnsFile, nothingOwnLine } from "../scripts/lib/gate-own.ts";
import { HARNESS_ROOT, REPO_ROOT } from "../scripts/lib/roots.ts";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);

/**
 * Where a translator's `.pot` and `.po` live.
 *
 * declared-path-literal: the convention fallback is stated at the call site,
 * the same shape `translation.ts` and `translation-drift.ts` use, so the choice
 * is visible rather than buried in the accessor.
 */
function translationsRoot(root: string): string {
  return directoryForGraph(root, "translation-sources") ?? join(root, "translations");
}

/**
 * The English source a locale's page is a translation OF.
 *
 * `siteDirFor`, not a `docs` literal — the site root is ONE answer and a second
 * copy is free to disagree with it. `site-dir-single-answer` refuses the
 * literal, and it refused this one twice.
 *
 * **`siteDirFor` returns a path RELATIVE to the layer root, so it must be
 * joined to one.** The first version of this returned `join(siteDirFor(root),
 * ...)` and the missing root is not a cosmetic slip: with no root the result is
 * resolved against the process's CWD, so the function answered correctly only
 * while the CWD happened to be a layer that happened to hold a `docs/`.
 * It did, for one run — which is how 25 templates were extracted through a path
 * that was wrong, and why the accessor is now used the way the other eleven
 * call sites in this repository use it (`join(INSTANCE_ROOT, siteDirFor(...))`).
 * A relative accessor that silently falls back to the CWD is the failure
 * `site-dir-single-answer` guards from the other side: not a second literal,
 * but one answer read against the wrong origin.
 */
export function sourceFor(root: string, page: string): string {
  return join(root, siteDirFor(root), `${page}.md`);
}

export interface PotPlan {
  locale: string;
  page: string;
  /** Absolute path of the `.pot` to write. */
  pot: string;
  /** The English source it is extracted from. */
  source: string;
  /** False when the source page does not exist — reported, never invented. */
  sourceExists: boolean;
  /** Already present and byte-equal apart from its timestamp. */
  current: boolean;
}

/**
 * The (locale, page) pairs the gate reports as published with no catalogue.
 *
 * Derived from `driftFor`'s own findings rather than from a list here, matched
 * on the message the checker itself emits — so a page that gains a `.po`
 * leaves this set without anybody editing it. The alternative, five names in a
 * constant, is a second answer to "which pages need a catalogue", and this
 * whole subject is a record going stale against a corpus that moved on.
 *
 * Only the NO-CATALOGUE findings: `driftFor` also reports structural drift,
 * which is a different defect with a different remedy and no `.pot` to write.
 */
export function needingCatalogue(root: string): Array<{ locale: string; page: string }> {
  return driftFor(root).findings
    .filter((f) => f.severity === "error" && f.message.includes("no `.po` catalogue"))
    .map((f) => {
      const [locale, ...rest] = f.subject.split("/");
      return { locale: locale!, page: rest.join("/") };
    })
    .filter((x) => x.locale.length > 0 && x.page.length > 0);
}

/**
 * Page templates this module ALREADY OWNS, whatever the trigger set says today.
 *
 * ## Why the derived set alone is not the subject
 *
 * `needingCatalogue` answers *"which page needs a catalogue NOW"*, and that set
 * moves: a page that gains a `.po` leaves it, which is the property that makes
 * the derivation right. But the `.pot` beside that `.po` does not stop being
 * this module's output — and a generator that stops maintaining an artefact the
 * moment its trigger clears is a generator that MANUFACTURES stale files.
 *
 * Measured 2026-09-26, which is why this exists: 25 templates were written for
 * the five pages then uncatalogued; `main` then reworked `pot-extract.ts` by 284
 * lines and four of those five pages left the set. All 20 of their templates
 * went stale, no gate could see it, and `translation:pot -- --check` reported
 * clean because the pairs were no longer in scope. A `--check` whose SCOPE
 * shrinks away from its own output cannot fail on it.
 *
 * ## The boundary is a DIRECTORY, not a name pattern
 *
 * `translations/<locale>/processes/*.pot` belongs to `translate-bpmn.ts`, whose
 * subject is a `.bpmn` rather than a page. Reading only the top level of each
 * locale — `readdirSync` with no recursion — puts that ownership split in the
 * traversal instead of in a filter, so the two generators cannot collide by
 * one of them being taught a new name. A pattern would have had to guess, and
 * `docs/processes/<name>.md` DOES exist, so a source-exists test alone would
 * have adopted all 58 of the other module's templates.
 */
function adopted(root: string): Array<{ locale: string; page: string }> {
  const dir = translationsRoot(root);
  if (!existsSync(dir)) return [];
  const out: Array<{ locale: string; page: string }> = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    for (const f of readdirSync(join(dir, e.name), { withFileTypes: true })) {
      // Top level only — the subdirectory is another module's graph.
      if (!f.isFile() || !f.name.endsWith(".pot")) continue;
      out.push({ locale: e.name, page: f.name.slice(0, -".pot".length) });
    }
  }
  return out;
}

/**
 * Every (locale, page) this module is responsible for: the pages the gate names
 * plus the templates already committed, deduplicated.
 *
 * Order is the derived set first, so the output reads as "what the gate asked
 * for, then what was already here".
 */
export function owned(root: string): Array<{ locale: string; page: string }> {
  const seen = new Set<string>();
  const out: Array<{ locale: string; page: string }> = [];
  for (const x of [...needingCatalogue(root), ...adopted(root)]) {
    const k = `${x.locale}/${x.page}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

export function plan(root = INSTANCE_ROOT): PotPlan[] {
  const dir = translationsRoot(root);
  return owned(root).map(({ locale, page }) => {
    const source = sourceFor(root, page);
    const pot = join(dir, locale, `${page}.pot`);
    const sourceExists = existsSync(source);
    let current = false;
    if (sourceExists && existsSync(pot)) {
      const fresh = formatPot(extractMarkdown(readFileSync(source, "utf-8"), relative(root, source)), {
        locale,
      });
      current = potWithoutTimestamp(readFileSync(pot, "utf-8")) === potWithoutTimestamp(fresh);
    }
    return { locale, page, pot, source, sourceExists, current };
  });
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  // In a layer's PR checks, only templates the caller commits (owner ruling
  // 2026-11-05, "Move the checks"; `scripts/lib/gate-own.ts`).
  const own = gateOwnInstances();
  const instName = readDeclaration(INSTANCE_ROOT)?.name ?? "cat-harness";
  const dir = translationsRoot(INSTANCE_ROOT);
  const repoRoot = REPO_ROOT ?? INSTANCE_ROOT;
  if (check && ((own !== undefined && !own.has(instName)) || gateOwnsFile(relative(repoRoot, dir)) === false)) {
    console.log(
      own !== undefined
        ? nothingOwnLine("translation:pot", "translations directory", own)
        : `✓ translation:pot --check: the templates live in ${relative(repoRoot, dir)}, which the caller does not commit; the owning layer's CI judges them.`,
    );
    process.exit(0);
  }
  const items = plan();

  if (items.length === 0) {
    console.error("UNDETERMINED: the drift report named no uncatalogued page.");
    console.error(
      "This is not a pass — nothing was planned. Either every published translation " +
        "has a catalogue (in which case say so from `translation:drift:check`, not from here) " +
        "or the report could not be read.",
    );
    process.exit(2);
  }

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(items.map((i) => ({ ...i, pot: relative(INSTANCE_ROOT, i.pot) })), null, 2));
    process.exit(0);
  }

  const missingSource = items.filter((i) => !i.sourceExists);
  const stale = items.filter((i) => i.sourceExists && !i.current);

  console.log(`.pot templates for uncatalogued pages — ${items.length} (locale, page) pair(s)\n`);
  for (const i of missingSource) {
    console.log(`  ? ${i.locale}/${i.page}  — no English source at ${relative(INSTANCE_ROOT, i.source)}`);
  }
  if (check) {
    for (const i of stale) console.log(`  ✗ ${relative(INSTANCE_ROOT, i.pot)} — missing or stale`);
    if (stale.length === 0 && missingSource.length === 0) {
      console.log("  ✓ every uncatalogued page has a current .pot for a translator to work from");
    }
    console.log(
      "\n  A .pot is the INPUT. The gate wants a .po, which a person writes — " +
        "19 of 27 are provably not derivable (bean `f6r1`), so this cannot and does not " +
        "turn `translation:drift:check` green.",
    );
    if (stale.length > 0) process.exit(1);
    process.exit(0);
  }

  let wrote = 0;
  for (const i of items) {
    if (!i.sourceExists) continue;
    if (i.current) continue;
    mkdirSync(dirname(i.pot), { recursive: true });
    const entries = extractMarkdown(readFileSync(i.source, "utf-8"), relative(INSTANCE_ROOT, i.source));
    writeFileSync(i.pot, formatPot(entries, { locale: i.locale }));
    console.log(`  wrote ${relative(INSTANCE_ROOT, i.pot)}  (${entries.length} string(s))`);
    wrote += 1;
  }
  console.log(
    `\n  ${wrote} template(s) written, ${items.length - wrote - missingSource.length} already current.\n\n` +
      "  NEXT, and it is not mine: a translator writes `<page>.po` beside each `.pot`.\n" +
      "  Until then `translation:drift:check` stays red, which is the chosen state\n" +
      "  (bean `ngxj`, issue #206) rather than a defect.",
  );
}
