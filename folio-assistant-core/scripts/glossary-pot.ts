/**
 * Glossary terms into gettext: one `.pot` per glossary scheme, AUTHORED terms only.
 *
 * Owner, 2026-09-24 (bean `lqo9`, structured answer): *"Authored terms only"*.
 * A `candidate` is extracted text nobody has curated yet, and asking a
 * translator to translate it would spend their work on a string that may be
 * rewritten or dropped when a person promotes it. So the 2,400-odd extracted
 * candidates stay out until promoted, and a `could-not-extract` term has no
 * text to translate at all.
 *
 * ## The same pipeline as the BPMN labels, not a second one
 *
 * - the template is written by `formatPot` (`cat-harness-tools/pipeline/pot-extract.ts`),
 *   the formatter `translate-bpmn` uses, and compared with the same
 *   timestamp-blind `potWithoutTimestamp`;
 * - it lands in the declared `translation-sources` directory, per locale, in
 *   a `glossary/` subdirectory beside `processes/`, named after the SKOS file
 *   the page already publishes (`<instance>--<scheme>.pot`);
 * - `gen-translation-status.ts` counts every `.pot` under a locale, so the
 *   status page sees these with no change of its own;
 * - a `.po` beside a template is read by the existing `po-inject` parser when
 *   per-locale rendering is built (the next step, recorded in the bean).
 *
 * `translations/<locale>/glossary.po` is a different file with a different
 * job (terminology hints for `translation-block-qa`, hand-authored, no POT),
 * which is why this uses a `glossary/` DIRECTORY and never that name.
 *
 * ## What is a msgid
 *
 * A term's `prefLabel`, each `altLabel`, and its `definition`, in the source
 * language (`en` when the text is given per language). The term's IRI is the
 * translator comment and never a msgid: an IRI stays stable across languages
 * (bean `lqo9`), so there is nothing in it to translate.
 *
 * Usage:
 *   bun run folio-assistant-core/scripts/glossary-pot.ts --extract [--locale fr]
 *   bun run folio-assistant-core/scripts/glossary-pot.ts --check   [--locale fr]
 *
 * Exit codes, as `translate-bpmn`: 0 current, 1 missing/stale/orphaned,
 * 2 nothing examined (no locale, or no authored term anywhere).
 *
 * @covers glossary, translation-sources
 * @module folio-assistant-core/scripts/glossary-pot
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { directoryForGraph, repoRootFor } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.ts";
import { declaredDirectories } from "@litlfred/cat-harness-tools/schemas/kg/declared-nodes.ts";
import { findDeclarationFile, instanceRootsIn } from "@litlfred/cat-harness-tools/schemas/kg/instance-roots.ts";
import { formatPot, potWithoutTimestamp, type PotEntry } from "@litlfred/cat-harness-tools/pipeline/pot-extract.ts";
import { gateOwnsFile } from "@litlfred/cat-harness-tools/scripts/lib/gate-own.ts";
import { termIri, type LangText } from "../schemas/glossary.ts";
import { LOCALE_PAGE_STRINGS, LOCALE_PAGE_TEMPLATE, collect, type GlossarySource } from "./glossary-page.ts";

const CORE = resolve(import.meta.dir, "..");
const REPO = repoRootFor(CORE);

/**
 * What the check compares: the template without its timestamp and without its
 * `#:` source references. A reference names the source file by its path in the
 * checkout, and a layer sits at a different path in each checkout that checks
 * it (`<layer>/glossary/…` in folio-assistant, `glossary/…` in
 * the layer's own CI), so no one file passes both. Every msgid, msgctxt and
 * comment is still compared exactly. Owner card Q-TRAIN-8 (folio-assistant#2873).
 */
export function potForCheck(pot: string): string {
  return potWithoutTimestamp(pot).split("\n").filter((l) => !l.startsWith("#: ")).join("\n");
}
/**
 * The platform layer whose `translation-sources` directory holds the
 * templates: cat-harness, the site the glossary page is published on, and the
 * same tree the BPMN templates are in.
 */
// declared-path-literal: the platform layer, named as glossary-page.ts names its site.
const PLATFORM = join(REPO, "cat-harness");

/**
 * The per-locale subdirectory for glossary templates.
 *
 * declared-path-literal: a sibling INSIDE `translations/<locale>/`, as
 * `processes/` is for diagrams, named after the kind whose terms it carries.
 * Never `glossary.po`, which is the terminology file `translation-block-qa` reads.
 */
export const GLOSSARY_SUBDIR = "glossary";

/** The source-language text of a label or definition: `en` when given per language. */
export function sourceText(t: LangText): string {
  return typeof t === "string" ? t : (t.en ?? Object.values(t)[0]!);
}

/** The template's name: the SKOS asset's name, so a translator and a reader of the page see one word. */
export function templateName(s: Pick<GlossarySource, "instance" | "glossary">): string {
  return `${s.instance}--${s.glossary.id}`;
}

/**
 * The msgids of one scheme: every AUTHORED term's labels and definition.
 *
 * An extracted scheme contributes nothing (its terms are candidates by
 * construction), and within an authored file a candidate or
 * could-not-extract term contributes nothing either.
 */
export function potEntries(s: GlossarySource, repo: string = REPO): PotEntry[] {
  let raw = "";
  try {
    raw = readFileSync(join(repo, s.file), "utf-8");
  } catch {
    // An extracted scheme's file may not be on disk yet; its line numbers are
    // cosmetic and it has no authored term to extract anyway.
  }
  const lines = raw.split("\n");
  const lineOf = (id: string): number => {
    const i = lines.findIndex((l) => l.includes(`"id": "${id}"`));
    return i === -1 ? 1 : i + 1;
  };
  const out: PotEntry[] = [];
  for (const t of s.glossary.terms) {
    if (t.status !== "authored") continue;
    const iri = t.iri ?? termIri(s.ns, s.glossary, t.id);
    const line = lineOf(t.id);
    out.push({ source: s.file, line, kind: "glossary-term", msgid: sourceText(t.prefLabel), comment: `Glossary term label: ${iri}` });
    for (const alt of t.altLabel ?? []) {
      out.push({ source: s.file, line, kind: "glossary-term", msgid: alt, comment: `Glossary term alternative label: ${iri}` });
    }
    if (t.definition) {
      out.push({ source: s.file, line, kind: "glossary-term", msgid: sourceText(t.definition), comment: `Glossary term definition: ${iri}` });
    }
  }
  return out;
}

/** Every scheme with at least one authored term, keyed by template name. */
export function templates(c: ReturnType<typeof collect>, repo: string = REPO): Map<string, PotEntry[]> {
  const out = new Map<string, PotEntry[]>();
  for (const s of c.glossaries) {
    if (s.extracted) continue;
    const entries = potEntries(s, repo);
    if (entries.length) out.set(templateName(s), entries);
  }
  // The locale page's own words (bean c592): translated like the terms, so a
  // translated glossary page is translated chrome and all.
  out.set(
    LOCALE_PAGE_TEMPLATE,
    Object.values(LOCALE_PAGE_STRINGS).map((msgid) => ({
      source: "folio-assistant-core/scripts/glossary-page.ts",
      line: 1,
      kind: "ui-string" as const,
      msgid,
      comment: "Glossary locale page",
    })),
  );
  return out;
}

/** The declared `translation-sources` directory of the platform layer. */
export function translationsDir(root: string = PLATFORM): string {
  // declared-path-literal: the convention fallback for a layer that
  // declares nothing, as translate-bpmn and bpmn-pot-current.test.ts do.
  return directoryForGraph(root, "translation-sources") ?? join(root, "translations");
}

export function potPath(dir: string, locale: string, name: string): string {
  return join(dir, locale, GLOSSARY_SUBDIR, `${name}.pot`);
}

/** The layer that owns template `name`: the scheme's owner, or core for the locale page it writes. */
export function templateOwner(name: string): string {
  return name === LOCALE_PAGE_TEMPLATE ? "folio-assistant-core" : name.split("--")[0];
}

/**
 * Where template `name`'s catalogues live: the OWNER's declared
 * `translation-sources` directory. Owner, 2026-10-04: *"move things to
 * semantically appropriate place"* (bean riit). A scheme's translations sit
 * with the layer whose terms they translate, as its block-kind headings do.
 * An owner that declares no translation graph — `bootstrap`, a separate
 * repository this one cannot declare a directory in — falls back to the
 * platform's, and `glossary:pot:check` names each such template so the
 * fallback is never silent.
 */
export function catalogueDir(name: string, repo: string = REPO): { dir: string; fallback: boolean } {
  const owner = templateOwner(name);
  for (const root of instanceRootsIn(repo)) {
    const declFile = findDeclarationFile(root);
    if (!declFile) continue;
    let declared: string | undefined;
    try {
      declared = (JSON.parse(readFileSync(join(root, declFile), "utf-8")) as { name?: string }).name;
    } catch {
      continue;
    }
    if (declared !== owner) continue;
    const dir = directoryForGraph(root, "translation-sources");
    if (dir) return { dir, fallback: false };
  }
  return { dir: translationsDir(), fallback: true };
}

/** Every declared `translation-sources` directory in the checkout: where a reader looks. */
export function allTranslationDirs(repo: string = REPO): string[] {
  return declaredDirectories(repo, "translation-sources");
}

function knownLocales(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const li = argv.indexOf("--locale");
  const locale = li === -1 ? undefined : argv[li + 1];
  const wantExtract = argv.includes("--extract");
  const wantCheck = argv.includes("--check");
  if (!wantExtract && !wantCheck) {
    console.error("Nothing to do. Pass --extract or --check [--locale <code>].");
    process.exit(2);
  }
  const c = collect();
  if (c.findings.invalid.length) {
    console.error(`✗ ${c.findings.invalid.length} glossary document(s) do not validate; run check:glossary.`);
    process.exit(1);
  }
  const tpl = templates(c);
  const entries = [...tpl.values()].reduce((n, e) => n + e.length, 0);
  if (tpl.size === 0) {
    // THE THIRD STATE: no authored term anywhere is "nothing to examine",
    // never a clean pass.
    console.error("No authored glossary term in any declared glossary directory: nothing was examined.");
    process.exit(2);
  }
  const dirs = allTranslationDirs();
  const locales = locale ? [locale] : [...new Set(dirs.flatMap(knownLocales))].sort();
  if (locales.length === 0) {
    console.error(`No locales under any declared translation-sources directory and none given with --locale.`);
    process.exit(2);
  }
  const placed = new Map([...tpl.keys()].map((name) => [name, catalogueDir(name)]));
  const render = (name: string, loc: string) => formatPot(tpl.get(name)!, { projectName: name, locale: loc });

  if (wantCheck) {
    // In a layer's PR checks only the catalogues the caller commits are judged
    // (owner ruling 2026-11-05, "Move the checks"; cat-harness-tools
    // `lib/gate-own.ts`): a mounted layer's .pot files are its own CI's.
    // Unset, every file is the caller's.
    const bad: string[] = [];
    const report = (finding: string, rel: string): void => {
      if (gateOwnsFile(rel) !== false) bad.push(finding);
    };
    for (const loc of locales) {
      for (const name of tpl.keys()) {
        const p = potPath(placed.get(name)!.dir, loc, name);
        const rel = relative(REPO, p);
        if (!existsSync(p)) report(`never extracted: ${rel}`, rel);
        else if (potForCheck(readFileSync(p, "utf-8")) !== potForCheck(render(name, loc))) report(`out of date: ${rel}`, rel);
      }
      for (const dir of dirs) {
        const sub = join(dir, loc, GLOSSARY_SUBDIR);
        if (!existsSync(sub)) continue;
        for (const f of readdirSync(sub).filter((f) => f.endsWith(".pot") || f.endsWith(".po")).sort()) {
          const name = f.replace(/\.pot?$/, "");
          const rel = relative(REPO, join(sub, f));
          if (!tpl.has(name)) {
            if (f.endsWith(".pot")) report(`no authored scheme: ${rel}`, rel);
          } else if (resolve(placed.get(name)!.dir) !== resolve(dir)) {
            report(`misplaced — ${templateOwner(name)} owns it, so it belongs in ${relative(REPO, placed.get(name)!.dir)}: ${rel}`, rel);
          }
        }
      }
    }
    if (bad.length) {
      for (const b of bad) console.error(`  ✗ ${b}`);
      console.error(`\n${bad.length} glossary template(s) need attention: bun run cat glossary:pot`);
      process.exit(1);
    }
    for (const [name, c] of placed) {
      if (c.fallback) console.log(`  · ${name}: ${templateOwner(name)} declares no translation-sources directory — kept in ${relative(REPO, c.dir)}`);
    }
    console.log(`✓ ${tpl.size} glossary template(s), ${entries} msgid(s), current in ${locales.join(", ")}.`);
    process.exit(0);
  }

  for (const loc of locales) {
    for (const name of tpl.keys()) {
      const p = potPath(placed.get(name)!.dir, loc, name);
      const fresh = render(name, loc);
      // Written only when the content changed: POT-Creation-Date moves on every run.
      if (existsSync(p) && potWithoutTimestamp(readFileSync(p, "utf-8")) === potWithoutTimestamp(fresh)) continue;
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, fresh);
    }
  }
  console.log(`${tpl.size} glossary template(s), ${entries} msgid(s), for ${locales.join(", ")}.`);
  console.log("Authored terms only (owner, 2026-09-24): a candidate reaches a .pot once a person promotes it.");
}
