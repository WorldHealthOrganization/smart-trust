/**
 * The QA report's own words (`ig-qa-page.ts` and its page script), in each
 * locale an IG translates into.
 *
 * Owner, 2026-11-14: *"For this page why is there no translation?"* — the
 * QA page is written by this layer, not the Publisher, so its words are this
 * layer's to translate. Each English string is keyed here; a locale's words
 * are in `translations/<locale>/generated-pages/ig-qa-page.po` (`msgctxt` is
 * the key, `msgid` the English). An entry is used only while its `msgid` is
 * still the English here and it keeps every `{name}` variable; otherwise the
 * English is shown (fail closed), and `check:qa-page-strings` (this module's
 * test) names it.
 *
 * Agent translation, unofficial: every translated QA page carries the
 * machine-translation notice (`ig-page-translations.ts` UNREVIEWED_NOTICE).
 *
 * @module fhir-harness/scripts/ig-qa-page-i18n
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePoEntries } from "../../cat-harness-tools/pipeline/po-inject.ts";

/** This layer's catalogues: `translations/<locale>/...`. */
export const HARNESS_TRANSLATIONS = join(import.meta.dir, "..", "translations");

/** Where a locale's catalogue for the QA page is, under a translations directory. */
export const qaPageCatalogue = (translationsDir: string, locale: string): string => join(translationsDir, locale, "generated-pages", "ig-qa-page.po");

/** Every string of the QA page and its script, in English. `{name}` is a variable; Markdown is kept as Markdown. */
export const QA_PAGE_STRINGS = {
  title: "QA Report",
  intro:
    "Two halves: the FHIR QA of this implementation guide, and the knowledge graph's QA, the harness's checks over the instances this site is built from. A finding is a gap a check reports, not a failure of the build.",
  fhirQa: "FHIR QA",
  kgQa: "Knowledge-graph QA",
  englishOnly: "This part of the report is in English only.",
  publisher: "IG Publisher",
  publisherSummary: "The Publisher's own QA summary for the run this AST came from{run}.",
  summaryJson: "Summary (JSON)",
  messagesIntro: "Every message the Publisher reported, laid out as its own `qa.html` lays them out.",
  messagesJson: "Messages (JSON)",
  messagesTranslated: "Each message is shown in this page's language: in the IG Publisher's own translation where it has one, otherwise in a machine translation no person has reviewed. \"Show English\" shows the Publisher's original beside each.",
  whereUsed: "Where each translated string is used (JSON)",
  loading: "Loading the Publisher's messages…",
  noscript: "The messages are drawn in the browser; without JavaScript, read the JSON above.",
  messages: "messages",
  count: "count",
  errors: "errors",
  warnings: "warnings",
  hints: "hints",
  suppressedWarnings: "suppressed warnings",
  suppressedHints: "suppressed hints",
  noSummary:
    "This build holds no Publisher QA summary (`qa.json`): the AST it was built from was cached without one. The Publisher's message list is not published here; an AST cached from a newer build carries its summary.",
  ast: "The IG's AST",
  field: "field",
  value: "value",
  noManifest: "This build holds no AST manifest.",
  validity: "**Validity for this checkout:** {verdict}.",
  recorded: "recorded in the AST",
  thisCheckout: "this checkout",
  noValidity: "This build recorded no validity verdict for the AST.",
  injection: "Injection scan",
  injectionIntro:
    "Every resource narrative, markdown field and IG page this site publishes ({items} text(s)) is checked for injection attempts before publication: a pattern scan, and an agent's review kept in the IG's {sidecar}. The browser checks each narrative again before drawing it.",
  verdictJson: "Verdict (JSON)",
  state: "state",
  content: "content",
  reviewed: "reviewed",
  by: "by",
  nobody: "nobody",
  stateReviewed: "reviewed, no pattern hit and no open finding",
  stateMissing: "**not reviewed**: there is no review of these texts",
  stateStale: "**not reviewed**: the review read other texts than these",
  stateUnusable: "the review file is not usable",
  stateOpen: "the review holds open findings",
  stateHits: "texts break a pattern rule",
  acceptedLocal: "accepted for this local build only; a publish refuses it",
  noInjection: "This build ran no injection scan.",
  // The page script's words.
  jsResultsFor: "Validation Results for {title}",
  jsThisIg: "this IG",
  jsGenerated: "Generated {date}, FHIR version {version} for ",
  jsCanonical: " (canonical = ",
  jsQualityChecks: "Quality Checks",
  jsPublisherVersion: "Publisher Version:",
  jsSummary: "Summary:",
  jsCounts: " errors = {errs}, warn = {warn}, info = {info}, broken links = {links}.  ",
  jsShowIds: "Show Message Ids",
  jsHideIds: "Hide Message Ids",
  jsShowEnglish: "Show English",
  jsHideEnglish: "Hide English",
  jsFilename: "Filename",
  jsErrors: "Errors",
  jsWarnings: "Warnings",
  jsHints: "Hints",
  jsBuildErrors: "Build Errors",
  jsPage: "(page)",
  jsSource: "(source)",
  jsUpFiles: "↑ files",
  jsGroupCounts: "  ({err} errors, {warn} warnings, {info} hints) ",
  jsPath: "Path",
  jsSeverity: "Severity",
  jsMessage: "Message",
  jsNoMessages: "No messages: {why}.",
  jsNoneReported: "The Publisher reported no messages.",
  jsCouldNotLoad: "Could not load the Publisher's messages ({error}).",
  jsMachine: "machine translation",
  jsSevFatal: "fatal",
  jsSevError: "error",
  jsSevWarning: "warning",
  jsSevInformation: "information",
} as const;

export type QaKey = keyof typeof QA_PAGE_STRINGS;
/** A string in the page's locale, `{name}` variables filled. */
export type Tr = (k: QaKey, vars?: Record<string, string | number>) => string;

/** The `{name}` variables a string uses, sorted. */
export const varsOf = (s: string): string[] => [...new Set([...s.matchAll(/\{([A-Za-z]\w*)\}/g)].map((m) => m[1]!))].sort();

const fillVars = (s: string, vars: Record<string, string | number> = {}): string => s.replace(/\{([A-Za-z]\w*)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** A locale's usable entries, and those refused because they are stale or drop a variable. */
export function readQaCatalogue(translationsDir: string, locale: string): { strings: Map<QaKey, string>; refused: { key: string; why: string }[] } {
  const strings = new Map<QaKey, string>();
  const refused: { key: string; why: string }[] = [];
  const p = qaPageCatalogue(translationsDir, locale);
  if (!existsSync(p)) return { strings, refused };
  for (const e of parsePoEntries(readFileSync(p, "utf-8"))) {
    const k = e.context as QaKey | undefined;
    if (!k || e.msgid === "" || e.msgstr.trim() === "" || e.flags.includes("fuzzy")) continue;
    const en = QA_PAGE_STRINGS[k];
    if (en === undefined) refused.push({ key: k, why: "no such string on the page" });
    else if (e.msgid !== en) refused.push({ key: k, why: "stale: the English changed since it was translated" });
    else if (varsOf(e.msgstr).join() !== varsOf(en).join()) refused.push({ key: k, why: `variables ${varsOf(e.msgstr).join(",") || "none"} differ from ${varsOf(en).join(",") || "none"}` });
    else strings.set(k, e.msgstr);
  }
  return { strings, refused };
}

/** The page's strings in `locale` (English for `en`, and for anything a catalogue lacks). */
export function qaStrings(locale: string, translationsDir: string = HARNESS_TRANSLATIONS): Tr {
  const s = locale === "en" ? new Map<QaKey, string>() : readQaCatalogue(translationsDir, locale).strings;
  return (k, vars) => fillVars(s.get(k) ?? QA_PAGE_STRINGS[k], vars);
}

/** The page script's strings in `locale`, unfilled: the script fills their variables. */
export function qaScriptLabels(locale: string, translationsDir: string = HARNESS_TRANSLATIONS): Record<string, string> {
  const s = locale === "en" ? new Map<QaKey, string>() : readQaCatalogue(translationsDir, locale).strings;
  const out: Record<string, string> = {};
  for (const k of Object.keys(QA_PAGE_STRINGS) as QaKey[]) if (k.startsWith("js")) out[k] = s.get(k) ?? QA_PAGE_STRINGS[k];
  return out;
}
