#!/usr/bin/env bun
/**
 * Full translation simulation: English → French with round-trip verification.
 *
 * Demonstrates the complete pipeline:
 *   1. Extract translatable strings from a markdown page → POT
 *   2. Simulate agentic French translation → PO
 *   3. Inject translations → translated markdown
 *
 * It stops at step 3. A round trip needs a back-translator that has not seen
 * the original, which this script cannot be: its `BACK_TRANSLATIONS` map held
 * 6 entries against 36 strings, so every string nobody had back-translated
 * scored 0 similarity and was published as semantic drift. `fail: 21` on the
 * French landing page counted absence. The real round trip is a pair of
 * agents — see `pipeline/translation-roundtrip.ts` and
 * `skills/library/library-core/translation-manager.md`.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/translation/simulate-translation.ts [path-to-md]
 *
 * Default test page: docs/guides/agent-onboarding.md
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { extractMarkdown, extractFromManifest, formatPot } from "../../pipeline/pot-extract.ts";
import { parsePo, injectMarkdown } from "../../pipeline/po-inject.ts";
import { directoryForGraph, deferResolution} from "../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

// ── Configuration ───────────────────────────────────────────────

// The harness whose docs it translates; the script moved up in 70lx B2.
const ROOT = HARNESS_ROOT;
// declared-path-literal: a page of the HARNESS's docs, joined onto HARNESS_ROOT below, not onto the repository. The checker reads it as the aggregate root's docs/; the script moved up in 70lx B2.
const DEFAULT_PAGE = "docs/guides/agent-onboarding.md";
const TARGET_LOCALE = "fr";
const OUTPUT_DIR = deferResolution(() => join(directoryForGraph(ROOT, "translation-sources") ?? join(ROOT, "translations"), TARGET_LOCALE), {
  moduleUrl: import.meta.url,
  what: "OUTPUT_DIR",
  under: ROOT,
});

// ── Agentic translation (simulated) ─────────────────────────────

/**
 * Simulated French translations for the agent-onboarding page.
 * In production this would be an LLM call or Weblate/Crowdin API.
 *
 * These are real French translations, not placeholders.
 */
const FRENCH_TRANSLATIONS: Record<string, string> = {
  // Headings
  "Agent onboarding": "Intégration de l'agent",
  "1. Work out which repo you are in": "1. Déterminez dans quel dépôt vous vous trouvez",
  "2. Your first five minutes": "2. Vos cinq premières minutes",
  "3. Find the right skill — don't improvise": "3. Trouvez la bonne compétence — n'improvisez pas",
  
  // Paragraphs
  "You are an LLM agent that has just been dropped into a repository using folio-assistant. This page is your orientation: what you are looking at, what to do first, and where to look things up.":
    "Vous êtes un agent LLM qui vient d'être placé dans un dépôt utilisant folio-assistant. Cette page est votre orientation : ce que vous regardez, ce qu'il faut faire en premier, et où chercher les informations.",

  "For the architecture of skills, roles, and capabilities, read Skills & roles. This page is the practical version.":
    "Pour l'architecture des compétences, des rôles et des capacités, lisez Compétences & rôles. Cette page est la version pratique.",

  "There are two kinds, and confusing them is the most common early mistake.":
    "Il en existe deux types, et les confondre est l'erreur la plus fréquente au début.",

  "folio-assistant contains no content. If you find yourself about to write subject matter into it — a chapter, a constant, a chapter-keyword list — you are in the wrong repo, or the thing you are writing should be folio-supplied data. See §7.":
    "folio-assistant ne contient aucun contenu. Si vous vous apprêtez à y écrire de la matière — un chapitre, une constante, une liste de mots-clés de chapitre — vous êtes dans le mauvais dépôt, ou ce que vous écrivez devrait être des données fournies par le folio. Voir §7.",

  "matters more than it looks. Many checks degrade to rather than failing when a tool is missing (no Lean toolchain, no Atlas, no LaTeX). An is not a pass. If you report \"all clean\" without knowing what was skipped, you are reporting the absence of data as a result.":
    "importe plus qu'il n'y paraît. De nombreuses vérifications se dégradent en au lieu d'échouer lorsqu'un outil est manquant (pas de chaîne Lean, pas d'Atlas, pas de LaTeX). Un n'est pas une réussite. Si vous rapportez « tout est propre » sans savoir ce qui a été ignoré, vous rapportez l'absence de données comme un résultat.",

  "Skills are the unit of work here. Before hand-rolling a procedure, check whether one exists.":
    "Les compétences sont l'unité de travail ici. Avant de créer une procédure à la main, vérifiez si une existe déjà.",

  // Table cells
  "folio-assistant (the platform)": "folio-assistant (la plateforme)",
  "A folio (the content repo)": "Un folio (le dépôt de contenu)",
  "Contains": "Contient",
  "skills, schemas, pipeline, MCP server": "compétences, schémas, pipeline, serveur MCP",
  "the actual paper / guideline / IG": "le document / la directive / l'IG réel(le)",
  "no — only": "non — seulement",
  "yes": "oui",
  "You edit here to": "Vous éditez ici pour",
  "change how authoring works": "modifier le fonctionnement de la rédaction",
  "change what is being authored": "modifier ce qui est rédigé",
};

// ── Semantic comparison (round-trip QA) ─────────────────────────

// ── Main simulation ─────────────────────────────────────────────

function main() {
  const inputFile = process.argv[2] || join(ROOT, DEFAULT_PAGE);
  const sourceMd = readFileSync(inputFile, "utf-8");
  const sourceFile = basename(inputFile);

  console.log("═══════════════════════════════════════════════════════");
  console.log("  TRANSLATION SIMULATION: English → French");
  console.log(`  Source: ${inputFile}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // ── Step 1: Extract ──────────────────────────────────────────

  console.log("━━━ STEP 1: Extract translatable strings (POT) ━━━\n");
  const siblingTs = inputFile.replace(/\.md$/, ".ts");
  const manifestEntries = existsSync(siblingTs)
    ? extractFromManifest(readFileSync(siblingTs, "utf-8"), basename(siblingTs))
    : [];
  const entries = [...manifestEntries, ...extractMarkdown(sourceMd, sourceFile)];
  console.log(`  Extracted ${entries.length} translatable strings\n`);

  // Show first few
  for (const entry of entries.slice(0, 5)) {
    const preview = entry.msgid.length > 60
      ? entry.msgid.slice(0, 60) + "..."
      : entry.msgid;
    console.log(`  [L${entry.line}] ${preview}`);
  }
  if (entries.length > 5) {
    console.log(`  ... and ${entries.length - 5} more\n`);
  }

  // Write POT file
  const pot = formatPot(entries, { projectName: "folio-assistant", locale: "fr" });
  mkdirSync(OUTPUT_DIR(), { recursive: true });
  const potPath = join(OUTPUT_DIR(), `${sourceFile.replace(".md", "")}.pot`);
  writeFileSync(potPath, pot);
  console.log(`  ✅ POT written: ${potPath}\n`);

  // ── Step 2: Translate (simulated) ────────────────────────────

  console.log("━━━ STEP 2: Agentic French translation ━━━\n");

  // Build PO content
  let translatedCount = 0;
  let untranslatedCount = 0;
  const poLines: string[] = [
    `# French translation for folio-assistant agent-onboarding`,
    `# Simulated agentic translation`,
    `msgid ""`,
    `msgstr ""`,
    `"Language: fr\\n"`,
    `"Content-Type: text/plain; charset=UTF-8\\n"`,
    ``,
  ];

  for (const entry of entries) {
    const french = FRENCH_TRANSLATIONS[entry.msgid];
    poLines.push(`#: ${entry.source}:${entry.line}`);
    poLines.push(`msgid "${entry.msgid.replace(/"/g, '\\"')}"`);
    if (french) {
      poLines.push(`msgstr "${french.replace(/"/g, '\\"')}"`);
      translatedCount++;
    } else {
      poLines.push(`msgstr ""`);
      untranslatedCount++;
    }
    poLines.push(``);
  }

  const poContent = poLines.join("\n");
  const poPath = join(OUTPUT_DIR(), `${sourceFile.replace(".md", "")}.po`);
  writeFileSync(poPath, poContent);

  console.log(`  Translated: ${translatedCount}/${entries.length} strings`);
  console.log(`  Untranslated: ${untranslatedCount} strings`);
  console.log(`  Coverage: ${Math.round((translatedCount / entries.length) * 100)}%`);
  console.log(`  ✅ PO written: ${poPath}\n`);

  // ── Step 3: Inject ───────────────────────────────────────────

  console.log("━━━ STEP 3: Inject translations → French markdown ━━━\n");

  const translations = parsePo(poContent);
  const result = injectMarkdown(sourceMd, translations);

  console.log(`  Changed: ${result.changed}`);
  console.log(`  Spans translated: ${result.stats.translatedSpans}`);
  console.log(`  Spans untranslated: ${result.stats.untranslatedSpans}`);

  const frMdPath = join(OUTPUT_DIR(), sourceFile);
  writeFileSync(frMdPath, result.translated);
  console.log(`  ✅ French markdown written: ${frMdPath}\n`);

  // Show a preview
  console.log("  ── Preview (first 15 lines) ──");
  const previewLines = result.translated.split("\n").slice(0, 15);
  for (const line of previewLines) {
    console.log(`  │ ${line}`);
  }
  console.log("  │ ...\n");

  // Step 4 was a round-trip QA pass and is deliberately gone. It scored the
  // source against a hand-written back-translation map of 6 entries covering
  // 36 strings: every string nobody had back-translated came back at 0
  // similarity and was counted as drift, so the `fail: 21` it wrote into
  // `translations/fr/index.ts` was a count of absences. A back-translator that
  // has not seen the original is what the check needs, and that is a pair of
  // agents rather than a table — `pipeline/translation-roundtrip.ts`.

  // ── Write status.json ────────────────────────────────────────

  console.log("━━━ STEP 5: Write translation status ━━━\n");

  const status = {
    locale: "fr",
    official: false,
    generatedBy: "agent",
    generatedAt: new Date().toISOString(),
    generator: "folio-assistant translation simulation",
    // Unofficial is the honest flag and it is set above: no human has
    // adjudicated this for this source version. `flaggedForReview` used to be
    // driven by the drift count this script invented, so it said "reviewed and
    // found wanting" about a measurement that never happened.
  };

  const statusPath = join(OUTPUT_DIR(), "status.json");
  writeFileSync(statusPath, JSON.stringify(status, null, 2));
  console.log(`  ✅ Status written: ${statusPath}`);
  console.log(`  Official: ${status.official}`);
  console.log(`  Semantic verification: per block, via translation-block-qa.ts`);
  console.log(``);

  // ── Summary ──────────────────────────────────────────────────

  console.log("═══════════════════════════════════════════════════════");
  console.log("  SIMULATION COMPLETE");
  console.log("═══════════════════════════════════════════════════════");
  console.log(``);
  console.log(`  Output files:`);
  console.log(`    POT template:     ${potPath}`);
  console.log(`    PO translations:  ${poPath}`);
  console.log(`    French markdown:  ${frMdPath}`);
  console.log(`    Status:           ${statusPath}`);
  console.log(``);
  console.log(`  Pipeline: Extract(${entries.length}) → Translate(${translatedCount}) → Inject(${result.stats.translatedSpans})`);
  console.log(`  Semantic QA is NOT part of this script — run translation-block-qa.ts,`);
  console.log(`  then translation-roundtrip.ts with a pair of agents.`);
  console.log(``);
}

// Guarded, like the 61 other entry points here. Unguarded, `main()` ran on
// IMPORT: this script writes four files under `translations/fr/`, so merely
// importing it mutated the working tree. `declared-directory-resolves.test.ts`
// imports every module that calls `directoriesForGraph` — this one among them —
// so from the commit that added it, a plain `bun test` left `.po`, `.pot`,
// `agent-onboarding.md` and `status.json` modified, and whoever ran the suite
// reverted them as somebody else's churn. Bean `07p7`.
if (import.meta.main) main();
