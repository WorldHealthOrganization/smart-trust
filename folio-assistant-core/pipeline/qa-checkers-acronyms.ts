/**
 * The QA checker for criterion `acronym-in-glossary` (owner, 2026-10-31:
 * "make QA review identify acronyms for potential inclusion"). A block's
 * prose uses no acronym that is missing from every glossary its folio can
 * see. The rule is `schemas/acronyms.ts`.
 *
 * It WARNS and never fails: an acronym it names is a candidate for the
 * glossary, and only a person decides to add one.
 *
 * @module folio-assistant-core/pipeline/qa-checkers-acronyms
 */
import { existsSync, readFileSync } from "node:fs";

import type { CheckerPaths, CheckerResult } from "@litlfred/cat-harness-tools/schemas/sdlc/block-qa.js";
import { findAcronyms, folioWords, lowerWords, missingAcronyms, visibleLabels } from "../schemas/acronyms.js";

/**
 * Criterion `acronym-in-glossary`. `n/a` when the block has no prose;
 * `pass` when every acronym is a glossary label (notation, prefLabel or
 * altLabel); `warn`, one hit per acronym at its first line, when one is not.
 */
export function checkAcronymInGlossary(paths: CheckerPaths): CheckerResult {
  const md = paths.md;
  if (!md || !existsSync(md)) return { result: "n/a", hits: [], notes: "no prose to read" };
  const text = readFileSync(md, "utf-8");
  const words = new Set([...lowerWords(text), ...folioWords(md)]);
  const missing = missingAcronyms(findAcronyms(text, words), visibleLabels(md));
  if (!missing.length) return { result: "pass", hits: [] };
  return {
    result: "warn",
    hits: missing.map((h) => ({ file: md, line: h.line, text: `${h.acronym} is in no glossary this folio can see` })),
    notes: `${missing.length} acronym(s) are candidates for the glossary: ${missing.map((h) => h.acronym).join(", ")}. Run glossary:acronyms for the folio-wide list with expansions.`,
  };
}

/** The dispatch table `qa-checkers/acronym-in-glossary.json` names. */
export const ACRONYM_CHECKERS: Record<string, (paths: CheckerPaths) => CheckerResult> = {
  "acronym-in-glossary": (p) => checkAcronymInGlossary(p),
};
