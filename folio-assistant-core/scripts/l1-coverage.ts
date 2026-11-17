#!/usr/bin/env bun
/**
 * l1-coverage — of the normative sentences in a publication, how many does an
 * L1 extraction account for? Issue #2405 FR-009; the report contract is the
 * methodology `methodologies/l1-coverage.md` (moved here from smart-kg's
 * `docs/COVERAGE.md` when smart-kg was deprecated, folio-assistant#3108), and
 * this is its generic implementation.
 *
 * ## Why it exists
 *
 * An L1 graph is extracted from prose, and the failure that matters is silent:
 * a recommendation that never became a node. The graph cannot report what it
 * does not contain. This compares the publication against what was captured,
 * so a missing statement shows up as a count — per page, because a
 * whole-document 97 % hides the one annex page where every miss is.
 *
 * ## Inputs — three files, nothing folio-specific
 *
 * - `--text`: the publication's BODY text, page-tagged. Either a JSON
 *   `{ "pages": [{ "page": 3, "text": "…" }] }`, or plain text with a form
 *   feed (`\f`) between pages, which is what `pdftotext` writes. Reference
 *   lists, running headers and tables of contents are the CALLER's to strip
 *   (contract §1 "body text only"): this script cannot tell a header from a
 *   sentence, and pretending to would make the count unreproducible.
 * - `--captured`: JSON `[{ "id": "…", "text": "…" }]` — every statement the
 *   extraction captured, verbatim (a recommendation's `statement`, a remark's
 *   `text`, a schedule entry).
 * - `--exclusions` (optional): JSON `[{ "location"?: "p3:s7", "text"?: "…",
 *   "reason": "…", "signedOffBy"?: "…", "signedOffAt"?: "…" }]`. `reason` is
 *   one of the contract's FIXED list; `duplicate-of:<id>` must name a
 *   captured id. **An exclusion with no `signedOffBy` is a proposal, and its
 *   sentence stays unaccounted** — counting tool-proposed exclusions would
 *   measure the tool's confidence, not what was checked.
 *
 * ## Output
 *
 * The contract's §4 shape as JSON (`--out`, else stdout), a per-page table on
 * stderr, and the exit code: **0 only at 100 % accounted-for**, 1 below it, 2
 * on unusable input. A publication with no normative sentence at all exits 0
 * and reports `null` percentages — an empty denominator measured nothing.
 *
 * ## Matching, stated because the contract requires it be stated
 *
 * `normalised-substring`: both sides are lower-cased, quotes, dashes and
 * whitespace normalised, and a sentence is captured when it occurs inside a
 * captured statement or a captured statement occurs inside it. No fuzzy
 * matching: a near miss is a person's call, and is reported unaccounted.
 *
 * @graphNode none — a check over three inputs, not a schema
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

/** Contract §1: the closed marker list. Order matters only for reporting. */
export const MARKERS: { group: string; re: RegExp }[] = [
  { group: "negation", re: /\bshould not\b|\bis not a reason\b|\bare not a contraindication\b/i },
  { group: "obligation", re: /\b(should|shall|must)\b/i },
  { group: "recommendation", re: /\brecommend\w*\b/i },
  { group: "permission", re: /\bmay be (given|administered|offered|considered|used|co-administered|implemented)\b/i },
];

/** Contract §2: the fixed exclusion reasons. `duplicate-of:<id>` is checked separately. */
export const EXCLUSION_REASONS = ["background-fact", "manufacturer-statement", "editorial", "research-question"] as const;

// The markers (§1) and reasons (§2) are unchanged since smart-kg/docs/COVERAGE.md, so reports made
// before the move compare with these; the string names where the definition now lives.
export const DEFINITION_VERSION = "folio-assistant-core/methodologies/l1-coverage.md (markers §1, reasons §2) — folio-assistant-core l1-coverage v1";
export const MATCH_METHOD = "normalised-substring";

export interface Page { page: number; text: string }
export interface Captured { id: string; text: string }
export interface Exclusion { location?: string; text?: string; reason: string; signedOffBy?: string; signedOffAt?: string }
export type State = "captured" | "excluded" | "unaccounted";
export interface Sentence {
  location: string; page: number; text: string; markers: string[]; state: State;
  node?: string; reason?: string; signedOffBy?: string; signedOffAt?: string; proposedReason?: string;
}
export interface Counts {
  normative: number; captured: number; excluded: number; unaccounted: number;
  capturedPct: number | null; accountedForPct: number | null;
}

/** Which marker groups a sentence carries; `should not` is not also `should` (contract §1). */
export function markersOf(sentence: string): string[] {
  const out: string[] = [];
  let rest = sentence;
  for (const m of MARKERS) {
    if (m.re.test(rest)) {
      out.push(m.group);
      if (m.group === "negation") rest = rest.replace(new RegExp(m.re.source, "gi"), " ");
    }
  }
  return out;
}

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/-\s*\n\s*/g, "") // a word hyphenated across a line break
    // Hyphens inside words are not compared: the extraction keeps one and
    // drops another ("low-birthweight" against "low-birth-weight").
    // The same goes for the spacing around a dash or a slash, and for list
    // bullets: the PDF text reads "immunization –summary" and "https:// www",
    // the folio "immunization – summary" and "https://www".
    .replace(/[•▪◦●]/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s*\/\s*/g, "/")
    .replace(/(\w)-(?=\w)/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/\s*([.;:,])\s*$/, "")
    .trim();
}

/** Sentences of one page. Boundaries are this implementation's choice (contract §1); the location is stable. */
export function sentencesOf(text: string): string[] {
  const flat = text.replace(/-\n(?=[a-z])/g, "").replace(/\s+/g, " ").trim();
  if (!flat) return [];
  return flat
    .split(/(?<=[.!?])\s+(?=[A-Z0-9(“"'‘])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** `{pages:[…]}` JSON, or form-feed–separated plain text numbered from 1. */
export function parsePages(raw: string): Page[] {
  const t = raw.trimStart();
  if (t.startsWith("{")) {
    const j = JSON.parse(t) as { pages?: unknown };
    if (!Array.isArray(j.pages)) throw new Error("--text JSON has no `pages` array");
    return j.pages.map((p, i) => {
      const o = p as { page?: unknown; text?: unknown };
      if (typeof o.text !== "string") throw new Error(`pages[${i}] has no text`);
      return { page: typeof o.page === "number" ? o.page : i + 1, text: o.text };
    });
  }
  return raw.split("\f").map((text, i) => ({ page: i + 1, text }));
}

function pct(n: number, d: number): number | null {
  return d === 0 ? null : Math.round((n / d) * 10000) / 100;
}

export function counts(sentences: Sentence[]): Counts {
  const normative = sentences.length;
  const captured = sentences.filter((s) => s.state === "captured").length;
  const excluded = sentences.filter((s) => s.state === "excluded").length;
  return {
    normative, captured, excluded, unaccounted: normative - captured - excluded,
    capturedPct: pct(captured, normative), accountedForPct: pct(captured + excluded, normative),
  };
}

/** An exclusion's reason, checked against the fixed list; returns the problem, or null. */
export function reasonProblem(reason: string, capturedIds: Set<string>): string | null {
  if ((EXCLUSION_REASONS as readonly string[]).includes(reason)) return null;
  const dup = reason.match(/^duplicate-of:(.+)$/);
  if (dup) return capturedIds.has(dup[1]) ? null : `\`${reason}\` names no captured statement`;
  return `\`${reason}\` is not one of the fixed reasons (${EXCLUSION_REASONS.join(", ")}, duplicate-of:<id>)`;
}

export interface Report {
  $schema: "l1-coverage-report/v1";
  definitionVersion: string; matchMethod: string; generatedAt: string;
  source?: { path: string; sha256: string }; graph?: { path: string; sha256: string };
  totals: Counts; pages: (Counts & { page: number })[]; sentences: Sentence[];
  problems: string[];
}

export function coverage(pages: Page[], captured: Captured[], exclusions: Exclusion[] = []): Report {
  const caps = captured.map((c) => ({ id: c.id, n: normalise(c.text) })).filter((c) => c.n.length > 0);
  const capturedIds = new Set(captured.map((c) => c.id));
  const problems: string[] = [];
  const byLocation = new Map<string, Exclusion>();
  const byText = new Map<string, Exclusion>();
  for (const e of exclusions) {
    const p = reasonProblem(e.reason, capturedIds);
    if (p) { problems.push(`exclusion ${e.location ?? JSON.stringify(e.text)}: ${p}`); continue; }
    if (e.location) byLocation.set(e.location, e);
    else if (e.text) byText.set(normalise(e.text), e);
    else problems.push("an exclusion names neither a location nor a text");
  }
  const sentences: Sentence[] = [];
  for (const pg of pages) {
    sentencesOf(pg.text).forEach((text, i) => {
      const markers = markersOf(text);
      if (markers.length === 0) return;
      const location = `p${pg.page}:s${i + 1}`;
      const n = normalise(text);
      const hit = caps.find((c) => c.n.includes(n) || n.includes(c.n));
      const s: Sentence = { location, page: pg.page, text, markers, state: "unaccounted" };
      if (hit) { s.state = "captured"; s.node = hit.id; }
      else {
        const ex = byLocation.get(location) ?? byText.get(n);
        if (ex && ex.signedOffBy) {
          s.state = "excluded"; s.reason = ex.reason; s.signedOffBy = ex.signedOffBy;
          if (ex.signedOffAt) s.signedOffAt = ex.signedOffAt;
        } else if (ex) {
          s.proposedReason = ex.reason; // proposed, not signed off: still unaccounted
        }
      }
      sentences.push(s);
    });
  }
  const pageNums = [...new Set(pages.map((p) => p.page))];
  return {
    $schema: "l1-coverage-report/v1",
    definitionVersion: DEFINITION_VERSION, matchMethod: MATCH_METHOD, generatedAt: new Date().toISOString(),
    totals: counts(sentences),
    pages: pageNums.map((page) => ({ page, ...counts(sentences.filter((s) => s.page === page)) })),
    sentences, problems,
  };
}

/** 0 at 100 % accounted-for (or nothing normative), 1 below it or with a bad exclusion. */
export function exitCodeFor(r: Report): number {
  if (r.problems.length > 0) return 1;
  return r.totals.unaccounted === 0 ? 0 : 1;
}

function arg(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

function sha(path: string): { path: string; sha256: string } {
  return { path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const textPath = arg(argv, "--text");
  const capPath = arg(argv, "--captured");
  if (argv.includes("--help") || !textPath || !capPath) {
    console.error("usage: bun run folio-assistant-core/scripts/l1-coverage.ts --text <pages.json|text-with-\\f> --captured <captured.json> [--exclusions <exclusions.json>] [--out <report.json>]");
    process.exit(argv.includes("--help") ? 0 : 2);
  }
  let report: Report;
  try {
    const exPath = arg(argv, "--exclusions");
    report = coverage(
      parsePages(readFileSync(textPath, "utf8")),
      JSON.parse(readFileSync(capPath, "utf8")) as Captured[],
      exPath ? (JSON.parse(readFileSync(exPath, "utf8")) as Exclusion[]) : [],
    );
    report.source = sha(textPath);
    report.graph = sha(capPath);
  } catch (e) {
    console.error(`  ✗ ${(e as Error).message}`);
    process.exit(2);
  }
  const out = arg(argv, "--out");
  const json = JSON.stringify(report, null, 2) + "\n";
  if (out) writeFileSync(out, json); else process.stdout.write(json);
  const f = (v: number | null) => (v === null ? "  —  " : `${v.toFixed(1)}%`.padStart(6));
  console.error("page  normative  captured  excluded  unaccounted  captured%  accounted%");
  for (const p of report.pages.filter((x) => x.normative > 0)) {
    console.error(`${String(p.page).padStart(4)}  ${String(p.normative).padStart(9)}  ${String(p.captured).padStart(8)}  ${String(p.excluded).padStart(8)}  ${String(p.unaccounted).padStart(11)}  ${f(p.capturedPct)}     ${f(p.accountedForPct)}`);
  }
  const t = report.totals;
  console.error(`total ${String(t.normative).padStart(9)}  ${String(t.captured).padStart(8)}  ${String(t.excluded).padStart(8)}  ${String(t.unaccounted).padStart(11)}  ${f(t.capturedPct)}     ${f(t.accountedForPct)}`);
  for (const p of report.problems) console.error(`  ✗ ${p}`);
  const code = exitCodeFor(report);
  console.error(code === 0
    ? (t.normative === 0 ? "  ✓ no normative sentence found — nothing to account for (percentages are null, not 100)" : "  ✓ 100% accounted for")
    : `  ✗ ${t.unaccounted} normative sentence(s) unaccounted — below the 100% accounted-for target`);
  process.exit(code);
}
