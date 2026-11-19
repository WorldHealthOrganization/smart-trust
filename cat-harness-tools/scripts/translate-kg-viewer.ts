#!/usr/bin/env bun
/**
 * The knowledge-graph viewer's chrome, extracted and checked.
 *
 * `scripts/kg-viewer-strings.ts` is the table; this is the orchestration
 * around it, the same shape as `scripts/translate-bpmn.ts`: extract from the
 * SOURCE, write `translations/<locale>/<stem>.pot`, and let the artefact's
 * own generator do the injecting. It reuses `formatPot` and `parsePo` rather
 * than a second gettext implementation.
 *
 * ## There is no `--inject`
 *
 * `bun run cat kg:viewer` reads every locale's `.po` and embeds the
 * catalogues in the one page it emits, so **generating the page IS the
 * injection**.
 *
 * Usage:
 *   bun run cat translate-kg-viewer --extract [--locale fr]
 *   bun run cat translate-kg-viewer --check
 *
 * ## What `--check` fails on, and what it only reports
 *
 * It fails on **drift**: a `.pot` that no longer matches the table, a
 * translation that dropped a `{placeholder}` the runtime will substitute into,
 * or an entry for a string the viewer no longer says.
 *
 * It reports, without failing, on **coverage**: a string with no translation
 * yet. The page falls back to English per string, so a partial catalogue is
 * the ordinary state of a translation in progress.
 *
 * @module scripts/translate-kg-viewer
 * @covers translation-sources
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { formatPot, potQuote } from "../pipeline/pot-extract.js";
import { parsePo, parsePoEntries } from "../pipeline/po-inject.js";
import type { PoEntry } from "../pipeline/po-inject.js";
import type { PotEntry } from "../pipeline/pot-extract.js";
import { directoryForGraph } from "../schemas/kg/cat-harness.js";
import {
  STRINGS_SOURCE,
  UI_STRINGS,
  localeName,
  potEntries,
} from "./kg-viewer-strings.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import { TranslationNodeSchema } from "../schemas/content/translation.ts";

/** The `$schema` of a TranslationNode manifest written as JSON (bean `y9r6`). */
export const TRANSLATION_NODE_SCHEMA = "translation-node/v1";

const root = resolve(HARNESS_ROOT);

/**
 * The declared `translation-sources` graph — where a translator's `.pot` and
 * `.po` live. Falls back to the convention because extraction CREATES the
 * tree for a locale that has none yet.
 *
 * declared-path-literal: the convention fallback, stated at the call site
 * rather than inside `directoriesForGraph` so the choice is visible.
 */
export function translationsRoot(repoRoot: string): string {
  return directoryForGraph(repoRoot, "translation-sources") ?? join(repoRoot, "translations");
}

/** Every `{placeholder}` a string carries, as a sorted list. */
export function placeholders(s: string): string[] {
  return [...s.matchAll(/\{([a-zA-Z][\w]*)\}/g)].map((m) => m[1]).sort();
}

/** Locales that already have a translations directory. */
export function knownLocales(repoRoot: string = root): string[] {
  const dir = translationsRoot(repoRoot);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

const LOCALE_TEAMS: Record<string, string> = {
  ar: "Arabic",
  de: "German",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  ru: "Russian",
  zh: "Chinese",
};

/**
 * Default header for a new kg-viewer .po stub file.
 */
export function defaultPoHeader(loc: string): string {
  const team = LOCALE_TEAMS[loc] ?? localeName(loc);
  return [
    `# ${localeName(loc)} translation of the knowledge-graph viewer's interface — NOT YET TRANSLATED.`,
    `#`,
    `# Every msgid the viewer says is here and every msgstr is EMPTY, which is what a`,
    `# translator receives. It is a stub awaiting a person, not a broken catalogue:`,
    `# the page falls back to the English msgid string by string, so an untranslated`,
    `# entry renders in English rather than blank.`,
    `#`,
    `# DO NOT MACHINE-FILL THIS FILE. A machine translation into a language nobody on`,
    `# this side reads is an artefact whose correctness cannot be checked here, and a`,
    `# header saying "unofficial" does not fix that — it ships anyway and readers see`,
    `# it. The source is scripts/kg-viewer-strings.ts (the generator's string table,`,
    `# never the generated page); re-extract with`,
    `# \`bun run cat translate-kg-viewer --extract\` and check with \`--check\`.`,
    `#`,
    `# The graph's own words — node names, descriptions, property names — are not`,
    `# covered here and cannot be: they come from the corpus.`,
    `msgid ""`,
    `msgstr ""`,
    `"Project-Id-Version: kg-viewer\\n"`,
    `"POT-Creation-Date: ${new Date().toISOString()}\\n"`,
    `"PO-Revision-Date: \\n"`,
    `"Last-Translator: \\n"`,
    `"Language-Team: ${team}\\n"`,
    `"Language: ${loc}\\n"`,
    `"MIME-Version: 1.0\\n"`,
    `"Content-Type: text/plain; charset=UTF-8\\n"`,
    `"Content-Transfer-Encoding: 8bit\\n"`,
    `"X-Folio-Official: no\\n"`,
  ].join("\n");
}

export interface SyncPoOptions {
  locale: string;
}

export interface SyncPoResult {
  content: string;
  added: string[];
  removed: string[];
  changed: boolean;
}

/**
 * Synchronize a `.po` catalogue stub with current extracted POT entries.
 *
 * Rules:
 * 1. Missing msgid entries from the table are added with an empty msgstr.
 * 2. Existing msgstr values are NEVER overwritten — filled translations survive.
 * 3. Preserves the file's header block (comments + header msgid/msgstr).
 * 4. Strings present in the catalogue but no longer in the table are dropped (pruned) and reported.
 * 5. Added and removed msgids are returned for reporting.
 */
export function syncPoContent(
  existingPoText: string,
  entries: PotEntry[],
  options: SyncPoOptions,
): SyncPoResult {
  const trimmed = existingPoText.trim();
  let header: string;
  if (!trimmed) {
    header = defaultPoHeader(options.locale);
  } else {
    const blocks = trimmed.split(/\n{2,}/);
    if (blocks.length > 0 && blocks[0].includes('msgid ""')) {
      header = blocks[0];
    } else {
      header = defaultPoHeader(options.locale);
    }
  }

  const existingEntries = trimmed ? parsePoEntries(trimmed) : [];
  const existingByMsgid = new Map<string, PoEntry>();
  for (const e of existingEntries) {
    existingByMsgid.set(e.msgid, e);
  }

  // Deduplicate entries by msgid
  const deduped = new Map<string, PotEntry[]>();
  for (const entry of entries) {
    const existing = deduped.get(entry.msgid);
    if (existing) {
      existing.push(entry);
    } else {
      deduped.set(entry.msgid, [entry]);
    }
  }

  // Sort entries case-insensitively (matching formatPot)
  const sortedKeys = [...deduped.keys()].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  const existingKeys = new Set(existingByMsgid.keys());
  const currentKeys = new Set(sortedKeys);

  const added = sortedKeys.filter((id) => !existingKeys.has(id));
  const removed = [...existingKeys].filter((id) => !currentKeys.has(id));

  const body = sortedKeys
    .map((msgid) => {
      const locations = deduped.get(msgid)!;
      const parts: string[] = [];

      // Source references
      for (const loc of locations) {
        parts.push(`#: ${loc.source}:${loc.line}`);
      }

      // Translator comments
      for (const loc of locations) {
        if (loc.comment) parts.push(`#. ${loc.comment}`);
        if (loc.contextUrl) parts.push(`#. URL: ${loc.contextUrl}`);
      }

      // Check for python-brace-format flag (Liquid variables)
      const hasLqdVars = /\{lqd_[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\}/.test(msgid);
      if (hasLqdVars) {
        parts.push("#, python-brace-format");
      }

      // Preserve existing flags if any (e.g. fuzzy), avoiding duplicates
      const existing = existingByMsgid.get(msgid);
      if (existing?.flags) {
        for (const flag of existing.flags) {
          if (flag !== "python-brace-format" && !parts.some((p) => p.includes(flag))) {
            parts.push(`#, ${flag}`);
          }
        }
      }

      parts.push(`msgid ${potQuote(msgid)}`);
      const msgstr = existing?.msgstr ?? "";
      parts.push(`msgstr ${potQuote(msgstr)}`);

      return parts.join("\n");
    })
    .join("\n\n");

  const content = header + "\n\n" + body + "\n";
  const changed = content !== existingPoText;

  return {
    content,
    added,
    removed,
    changed,
  };
}

/**
 * The TranslationNode manifest that makes a `.po` a node rather than a file.
 *
 * **Coverage is read from the `.po`, never asserted.** A stub with every
 * msgid and no msgstr is the ordinary state here, and the node says 0% rather
 * than implying a translation that does not exist — `translation_status`
 * reads this, and a node that flattered itself would flatter every report
 * downstream of it.
 */
export function manifest(loc: string, translated: number, sourceHash: string): string {
  const pct = Math.round((translated / UI_STRINGS.length) * 100);
  const state = translated === 0
    ? "Not yet translated: the .po carries every msgid with an empty msgstr, " +
      "awaiting a translator. The page falls back to the English msgid string " +
      "by string, so nothing renders blank in the meantime."
    : "Unofficial until a person signs it off, which the .po header declares " +
      "and the page itself tells the reader.";
  // Content holds no code (bean `y9r6`): the manifest is JSON data, checked
  // against TranslationNodeSchema here, where it is written.
  const node = {
    label: `trans:${loc}/kg-viewer`,
    locale: loc,
    sourceFile: STRINGS_SOURCE,
    sourceHash,
    potFile: `translations/${loc}/kg-viewer.pot`,
    poFile: `translations/${loc}/kg-viewer.po`,
    status: { locale: loc, official: false, generator: "folio-assistant translate-kg-viewer" },
    coverage: { translated, total: UI_STRINGS.length, pct },
    title: `${localeName(loc)} — knowledge-graph viewer interface`,
    description: `Interface strings for the knowledge-graph viewer. ${state}`,
  };
  TranslationNodeSchema.parse(node); // validate; write the node itself so no field is dropped
  return `${JSON.stringify({
    $schema: TRANSLATION_NODE_SCHEMA,
    $comment:
      `${localeName(loc)} (${loc}) translation of the knowledge-graph viewer's chrome.\n\n` +
      `Generated by \`bun run cat translate-kg-viewer --extract\`. The source is the string table in ` +
      `\`${STRINGS_SOURCE}\`, not the page the generator emits — see that module for why a generated ` +
      "artefact is never the translation source.\n\n" +
      "The graph's own content is NOT covered by this node: node names, descriptions and property names " +
      "come from the corpus and reach the page in whatever language the corpus is written in.",
    ...node,
  }, null, 2)}\n`;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);

  function flag(name: string): string | undefined {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  }

  const wantExtract = argv.includes("--extract");
  const wantCheck = argv.includes("--check");
  const locale = flag("locale");

  if (!wantExtract && !wantCheck) {
    console.error("Nothing to do. Pass --extract [--locale <code>] or --check.");
    process.exit(2);
  }

  const sourceText = readFileSync(join(TOOLS_ROOT, STRINGS_SOURCE), "utf-8");  // the table is code, here since 70lx
  const entries = potEntries(sourceText);
  const sourceHash = createHash("sha256").update(sourceText).digest("hex").slice(0, 12);

  // ── --extract ───────────────────────────────────────────────────

  if (wantExtract) {
    const targets = locale ? [locale] : knownLocales();
    if (targets.length === 0) {
      console.error("No locales found under translations/ and none given with --locale.");
      process.exit(2);
    }
    console.log(`Extracting ${entries.length} string(s) from ${STRINGS_SOURCE} for: ${targets.join(", ")}\n`);
    for (const loc of targets) {
      const outDir = join(translationsRoot(root), loc);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        join(outDir, "kg-viewer.pot"),
        formatPot(entries, { projectName: "kg-viewer", locale: loc }),
      );

      // A .po that exists gets synced with the latest msgids (preserving existing
      // msgstr and file header) and a manifest refreshed beside it.
      const po = join(outDir, "kg-viewer.po");
      let coverage = "";
      if (existsSync(po)) {
        const existingPoText = readFileSync(po, "utf-8");
        const syncResult = syncPoContent(existingPoText, entries, { locale: loc });
        if (syncResult.changed) {
          writeFileSync(po, syncResult.content);
        }
        const parsed = parsePo(syncResult.content);
        const translated = UI_STRINGS.filter((s) => (parsed.get(s.en) ?? "") !== "").length;
        writeFileSync(join(outDir, "kg-viewer.json"), manifest(loc, translated, sourceHash));

        const changeNotes: string[] = [];
        if (syncResult.added.length > 0) changeNotes.push(`+${syncResult.added.length} added`);
        if (syncResult.removed.length > 0) changeNotes.push(`-${syncResult.removed.length} removed`);
        const notes = changeNotes.length > 0 ? `, ${changeNotes.join(", ")}` : "";
        coverage = `  (po: ${translated}/${UI_STRINGS.length}${notes}, manifest refreshed)`;

        console.log(`  translations/${loc}/kg-viewer.pot`);
        console.log(`  translations/${loc}/kg-viewer.po${coverage}`);
        for (const id of syncResult.added) {
          console.log(`    + added to .po: ${JSON.stringify(id)}`);
        }
        for (const id of syncResult.removed) {
          console.log(`    - removed from .po: ${JSON.stringify(id)}`);
        }
      } else {
        console.log(`  translations/${loc}/kg-viewer.pot`);
      }
    }
    console.log("\nA .pot is a translator's input; nothing is translated until a .po sits beside it.");
  }

  // ── --check ─────────────────────────────────────────────────────

  if (wantCheck) {
    const table = new Map(UI_STRINGS.map((s) => [s.en, s]));
    const failures: string[] = [];
    const notes: string[] = [];
    let seen = 0;

    for (const loc of knownLocales()) {
      const dir = join(translationsRoot(root), loc);
      const po = join(dir, "kg-viewer.po");
      const pot = join(dir, "kg-viewer.pot");
      if (!existsSync(po) && !existsSync(pot)) continue;
      seen++;

      // The POT is derived. If it does not match the table, it was not
      // re-extracted after the table changed, and a translator is working from
      // a document that no longer describes the page.
      if (!existsSync(pot)) {
        failures.push(`${loc}: no kg-viewer.pot — run --extract`);
      } else {
        const potIds = new Set(
          parsePoEntries(readFileSync(pot, "utf-8")).map((e) => e.msgid),
        );
        const missing = [...table.keys()].filter((id) => !potIds.has(id));
        const extra = [...potIds].filter((id) => !table.has(id));
        if (missing.length || extra.length) {
          failures.push(
            `${loc}: kg-viewer.pot is stale — ${missing.length} string(s) missing, ` +
              `${extra.length} no longer said by the page. Run --extract.`,
          );
        }
      }

      if (!existsSync(po)) {
        notes.push(`${loc}: template only, no translations yet`);
        continue;
      }

      const poText = readFileSync(po, "utf-8");
      const parsed = parsePo(poText);
      let translated = 0;
      for (const [id, msgstr] of parsed) {
        const entry = table.get(id);
        if (entry === undefined) {
          failures.push(`${loc}: translates a string the page no longer says — "${id.slice(0, 48)}…"`);
          continue;
        }
        if (msgstr === "") continue;
        translated++;
        const want = placeholders(id).join(",");
        const got = placeholders(msgstr).join(",");
        if (want !== got) {
          failures.push(
            `${loc}: placeholder mismatch — "${id.slice(0, 40)}…" expects {${want || "none"}}, ` +
              `translation has {${got || "none"}}`,
          );
        }
      }
      const pct = Math.round((translated / UI_STRINGS.length) * 100);
      notes.push(`${loc}: ${translated}/${UI_STRINGS.length} (${pct}%) — ${localeName(loc)}`);
    }

    console.log(`${UI_STRINGS.length} string(s) in ${STRINGS_SOURCE} (source hash ${sourceHash})\n`);
    if (seen === 0) {
      console.log("No locale carries a kg-viewer catalogue yet. Nothing to check, and that is not a failure.");
    }
    for (const n of notes) console.log(`  ${n}`);
    if (failures.length > 0) {
      console.error(`\n${failures.length} problem(s):`);
      for (const f of failures) console.error(`  ✗ ${f}`);
      console.error(
        "\nCoverage below 100% is NOT among these — the page falls back to English " +
          "per string and says the translation is partial. These are drift.",
      );
      process.exit(1);
    }
    console.log("\n✓ No drift: every catalogue matches the table, placeholders intact.");
  }
}
