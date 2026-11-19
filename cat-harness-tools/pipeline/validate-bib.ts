#!/usr/bin/env bun
/**
 * validate-bib.ts — comprehensive bibliography correctness audit.
 *
 * **Network requirement.** Modes `--doi`, `--crossref`, and `--arxiv`
 * issue outbound HTTPS to `doi.org`, `api.crossref.org`, and
 * `arxiv.org` respectively. Sandboxed environments with whitelist-
 * only egress (Claude Code on the web, some CI runners) will see
 * uniform 403/timeout failures from those modes; the script reports
 * them as warnings rather than errors so a sandbox run isn't taken
 * for a bib failure. Run these modes from a local machine or a
 * runner with general outbound access. `--cross-check` and
 * `--pandoc` (assuming pandoc is installed) work offline.
 *
 * Modes (run individually or combined; `--all` enables every check):
 *
 *   --doi           DOI resolution: HEAD-request each entry's DOI →
 *                   expect 200/301/302 from doi.org. Catches broken DOIs.
 *   --cross-check   Parse `-- Ref: [key] <description>` comments in
 *                   content/**\/*.lean; extract surname (Title-case words)
 *                   and year (4-digit) from the description; compare
 *                   against referenceMap entry's author[0].family +
 *                   issued.date-parts[0][0]. Catches wrong-work
 *                   resolutions (the class Copilot found 4 of in PR #792).
 *   --crossref      Per-entry Crossref API lookup
 *                   (api.crossref.org/works/<DOI>): compare canonical
 *                   title / first-author surname / year against the entry.
 *                   Confirms the DOI actually points at what the entry says.
 *   --arxiv         For entries whose URL field contains arxiv.org/...,
 *                   fetch the arXiv abstract page and verify the entry's
 *                   title appears. Catches preprint-vs-published-version
 *                   mismatches.
 *   --pandoc        Pipe a sample LaTeX citation through pandoc-citeproc
 *                   with the generated references.bib; verify output is
 *                   well-formed (catches CSL formatting issues + missing
 *                   required fields).
 *   --all           Run all 5 modes in sequence.
 *   --strict        Exit non-zero on any failure (default: warn-only).
 *
 * Usage examples:
 *   bun run cat-harness-tools/pipeline/validate-bib.ts --doi
 *   bun run cat-harness-tools/pipeline/validate-bib.ts --cross-check --strict
 *   bun run cat-harness-tools/pipeline/validate-bib.ts --all
 *
 * Per CLAUDE.md §"Bibliography architecture": references.ts is the
 * source of truth; this script verifies external correctness of every
 * entry beyond schema-shape validation.
 */
import { folioDirDeferred } from "../schemas/kg/cat-harness.js";
import { references } from "./references-registry-di";
import { findContentRepoRoot } from "./repo-root";
import * as fs from "fs";
import * as path from "path";
import { glob } from "fs/promises";

type Mode = "doi" | "cross-check" | "crossref" | "arxiv" | "pandoc";
type CheckResult = { entry: string; severity: "ok" | "warn" | "error"; note: string };

const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const ALL = args.includes("--all");
const MODES: Set<Mode> = new Set();
if (ALL || args.includes("--doi")) MODES.add("doi");
if (ALL || args.includes("--cross-check")) MODES.add("cross-check");
if (ALL || args.includes("--crossref")) MODES.add("crossref");
if (ALL || args.includes("--arxiv")) MODES.add("arxiv");
if (ALL || args.includes("--pandoc")) MODES.add("pandoc");
if (MODES.size === 0) {
  console.error("No mode selected. Pass --doi / --cross-check / --crossref / --arxiv / --pandoc or --all.");
  process.exit(2);
}

// Both roots are the FOLIO's, not the platform's. `path.resolve(__dirname,
// "..")` lands in `<folio-assistant>/content/`, which holds only `pipeline/` —
// so the `**/*.lean` glob below had nothing to walk. Never noticed, because
// this file threw `Cannot find module` at import and could not run at all.
const REPO_ROOT = findContentRepoRoot();
const folioDirOf = folioDirDeferred(REPO_ROOT, import.meta.url);

/**
 * The year from a CSL `issued` date, as a number.
 *
 * CSL-JSON types `date-parts` entries as `LooseNumber = string | number` and
 * the spec permits `"date-parts": [["2020"]]`. The two comparison sites below
 * subtracted these directly; JS coerces a numeric string, so it happened to
 * work, but it is unsound and silently yields `NaN` for anything non-numeric —
 * and `Math.abs(NaN) > 1` is false, so a malformed year would read as a MATCH
 * rather than a mismatch.
 */
/** An unknown thrown value as a message. `catch (e)` is `unknown` under
 *  `strict`; these sites read `e.message ?? e`, which needs the narrowing. */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function cslYear(parts: unknown): number | undefined {
  // `unknown` rather than csl-json's `Date['date-parts']`: that is a
  // fixed-arity tuple of optional LooseNumbers, and the Crossref response
  // objects below carry their own near-identical shape. Narrowing here takes
  // both without a cast at either call site.
  if (!Array.isArray(parts)) return undefined;
  const first = parts[0];
  if (!Array.isArray(first)) return undefined;
  const raw: unknown = first[0];
  if (typeof raw !== "number" && typeof raw !== "string") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

async function modeDoi(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const withDoi = references.filter((r) => r.DOI);
  console.log(`\n[doi] HEAD-requesting ${withDoi.length} DOIs (skipping ${references.length - withDoi.length} entries without DOI)...`);
  let i = 0;
  for (const r of withDoi) {
    i++;
    const url = `https://doi.org/${r.DOI}`;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      // doi.org returns 403 to bare HEAD requests; use GET with a
      // User-Agent header to satisfy CDN gatekeeping. We just need
      // the redirect to land somewhere, so manual mode + status check.
      const resp = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": "qou-validate-bib/1.0 (DOI verification; +https://github.com/litlfred/qou)" },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      // doi.org returns 301/302 with Location to the publisher
      // (successful resolution); 200 (rare but possible); 404 = unknown DOI.
      if (resp.status === 200 || resp.status === 301 || resp.status === 302) {
        out.push({ entry: r.id, severity: "ok", note: `${resp.status} resolved` });
      } else if (resp.status === 404) {
        out.push({ entry: r.id, severity: "error", note: `404 DOI not found: ${url}` });
      } else {
        out.push({ entry: r.id, severity: "warn", note: `HTTP ${resp.status} for ${url}` });
      }
    } catch (e) {
      out.push({ entry: r.id, severity: "warn", note: `fetch failed: ${errMsg(e)}` });
    }
    if (i % 25 === 0) console.log(`  …${i}/${withDoi.length}`);
  }
  return out;
}

async function modeCrossCheck(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const refMap = new Map(references.map((r) => [r.id, r]));
  // Find all .lean files containing `-- Ref: [key] <description>` lines
  const leanFiles: string[] = [];
  for await (const f of glob("**/*.lean", { cwd: path.join(folioDirOf()) })) {
    if (f.includes(".lake/")) continue;
    leanFiles.push(path.join(folioDirOf(), f as string));
  }
  console.log(`\n[cross-check] scanning ${leanFiles.length} .lean files for -- Ref: comments...`);
  let comments = 0;
  let checked = 0;
  for (const f of leanFiles) {
    const text = fs.readFileSync(f, "utf-8");
    const lines = text.split("\n");
    for (const line of lines) {
      const m = line.match(/--\s*Ref:\s*\[([^\]]+)\]\s*(.*)/);
      if (!m) continue;
      const [, key, desc] = m;
      comments++;
      const entry = refMap.get(key);
      if (!entry) continue; // validate-refs already catches missing keys
      // Heuristic v3 (2026-05-19): the description after `-- Ref: [key]`
      // is varied — sometimes a full citation snippet ("Boyd & Vandenberghe,
      // Convex Optimization 2004"), sometimes a topic hint
      // ("Hecke-skein normalization"), sometimes a bare DOI/URL, sometimes
      // empty. Only flag a surname mismatch when:
      //   1. The description contains prose (≥5 alphabetic words), AND
      //   2. None of the entry's author surnames appear anywhere in the
      //      lowercased description.
      // This skips URL-only / DOI-only / topic-hint-only descriptions
      // (which v2's "always check" misclassified as FPs).
      // `Person` is `{family} | {literal}`, but `PersonPartial` makes both
      // optional on either arm, so the `??` chain is the right read — it was
      // only the `any` that was surplus.
      const authorFamilies: string[] = (entry.author ?? [])
        .map((a) => (a.family ?? a.literal ?? "").toLowerCase())
        .filter((s) => s.length >= 3);
      const entryYear = cslYear(entry.issued?.["date-parts"]);
      checked++;
      // Strip URLs, DOIs, and punctuation; count remaining alphabetic words
      const descStripped = desc
        .replace(/\bhttps?:\/\/\S+/g, " ")     // URLs
        .replace(/\bdoi:\s*\S+/gi, " ")         // doi:foo
        .replace(/\b10\.\d{4,}\/\S+/g, " ")     // bare DOI patterns
        .replace(/\barxiv:\s*\S+/gi, " ")       // arxiv:foo
        .toLowerCase()
        .replace(/[`"',()§\[\]{}]/g, " ");
      // Unicode-aware (\p{L} = any letter): catches Erdős, Möbius, Krein
      // etc. that the original [a-zé...] class would drop (Gemini #820).
      const proseWords = descStripped.split(/\s+/).filter((w) => /^[\p{L}\-']{2,}$/u.test(w));
      const isProseDescription = proseWords.length >= 5;
      // Heuristic v4 addition: also accept the description if it shares a
      // significant title word with the entry. Many .lean Ref descriptions
      // cite the work by title rather than surname (e.g.
      // `[kauffman1991] Knots and Physics, World Scientific`); these are
      // genuine matches that v3 incorrectly flagged.
      const entryTitle: string = (entry.title ?? "").toLowerCase();
      const stopwords = new Set([
        "a", "an", "the", "of", "and", "or", "in", "on", "for", "to", "from",
        "with", "by", "at", "as", "is", "are", "be",
      ]);
      const titleWords = entryTitle
        .split(/[\s\-:,]+/)
        .filter((w) => w.length >= 4 && !stopwords.has(w));
      // Heuristic v5 addition (2026-05-19): also accept the description
      // if it contains a chapter/section marker (§N, Ch. <NUMERAL>, Thm,
      // Definition, etc.). These markers indicate the citation pinpoints
      // a specific part of the cited work — more useful than naming the
      // author, and a stronger anchor than just title words.
      const hasChapterSection = /(?:§|\bCh\.?\s|\bChapter\s|\bSection\s|\bThm\.?\s|\bTheorem\s|\bDefinition\s|\bLemma\s|\bProposition\s|\bCorollary\s|\bAppendix\s|\bExample\s|\bFig\.?\s|\bEq\.?\s|\bPage\s|\bp\.?\s\d)/i.test(desc);
      if (isProseDescription && authorFamilies.length > 0 && !hasChapterSection) {
        const anyAuthorMentioned = authorFamilies.some(
          (fam) => descStripped.includes(fam)
        );
        const anyTitleWordMentioned = titleWords.length > 0
          && titleWords.some((tw) => descStripped.includes(tw));
        if (!anyAuthorMentioned && !anyTitleWordMentioned) {
          out.push({
            entry: key,
            severity: "warn",
            note: `entry author [${authorFamilies.join(", ")}] AND title words [${titleWords.slice(0, 3).join(", ")}] both absent from description "${desc.slice(0, 80)}" (${path.relative(REPO_ROOT, f)})`,
          });
        }
      }
      // v5 year-mismatch refinement (2026-05-19): only flag when EXACTLY
      // ONE year appears in the description. Multiple years almost
      // always means the description references other citations
      // (e.g. "CODATA 2018" alongside [jones1987]) — the year doesn't
      // refer to the current entry, so a mismatch is a false positive.
      const allYears = desc.match(/\b(?:19|20)\d{2}\b/g) ?? [];
      if (allYears.length === 1 && entryYear) {
        const descYear = parseInt(allYears[0]);
        if (Math.abs(descYear - entryYear) > 1) {
          out.push({
            entry: key,
            severity: "warn",
            note: `year mismatch: .lean says ${descYear}, entry has ${entryYear} (${path.relative(REPO_ROOT, f)})`,
          });
        }
      }
    }
  }
  console.log(`  checked ${checked}/${comments} comments (skipped ${comments - checked} unresolvable keys)`);
  return out;
}

async function modeCrossref(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const withDoi = references.filter((r) => r.DOI);
  console.log(`\n[crossref] fetching ${withDoi.length} entries from api.crossref.org...`);
  let i = 0;
  for (const r of withDoi) {
    i++;
    const url = `https://api.crossref.org/works/${r.DOI}`;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const resp = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (resp.status !== 200) {
        out.push({ entry: r.id, severity: "warn", note: `crossref ${resp.status} for ${r.DOI}` });
        continue;
      }
      // The fields this reads off a Crossref `/works/<DOI>` response.
      // Everything else in the payload is ignored, and naming these is what
      // keeps a typo in one of them from silently comparing "" to "".
      interface CrossrefWork {
        title?: string[];
        author?: Array<{ family?: string }>;
        "published-print"?: { "date-parts"?: unknown };
        "published-online"?: { "date-parts"?: unknown };
        created?: { "date-parts"?: unknown };
      }
      const data = await resp.json() as CrossrefWork & { message?: CrossrefWork };
      const msg: CrossrefWork = data.message ?? data;
      const cTitle = (msg.title?.[0] ?? "").toLowerCase();
      const cAuthor = (msg.author?.[0]?.family ?? "").toLowerCase();
      const cYear = cslYear(msg["published-print"]?.["date-parts"])
                  ?? cslYear(msg["published-online"]?.["date-parts"])
                  ?? cslYear(msg["created"]?.["date-parts"]);
      const eTitle = (r.title ?? "").toLowerCase();
      const eAuthor = (r.author?.[0]?.family ?? "").toLowerCase();
      const eYear = cslYear(r.issued?.["date-parts"]);
      const issues: string[] = [];
      if (eTitle && cTitle && !cTitle.includes(eTitle.slice(0, 20)) && !eTitle.includes(cTitle.slice(0, 20))) {
        issues.push(`title mismatch: entry "${eTitle.slice(0, 60)}" vs Crossref "${cTitle.slice(0, 60)}"`);
      }
      if (eAuthor && cAuthor && eAuthor !== cAuthor) {
        issues.push(`author mismatch: entry "${eAuthor}" vs Crossref "${cAuthor}"`);
      }
      if (eYear && cYear && Math.abs(eYear - cYear) > 1) {
        issues.push(`year mismatch: entry ${eYear} vs Crossref ${cYear}`);
      }
      if (issues.length) {
        out.push({ entry: r.id, severity: "warn", note: issues.join("; ") });
      } else {
        out.push({ entry: r.id, severity: "ok", note: "Crossref matches" });
      }
    } catch (e) {
      out.push({ entry: r.id, severity: "warn", note: `crossref fetch failed: ${errMsg(e)}` });
    }
    if (i % 25 === 0) console.log(`  …${i}/${withDoi.length}`);
  }
  return out;
}

async function modeArxiv(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const withArxiv = references.filter((r) => r.URL && /arxiv\.org/i.test(r.URL));
  console.log(`\n[arxiv] checking ${withArxiv.length} arxiv-URL entries...`);
  for (const r of withArxiv) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const resp = await fetch(r.URL!, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
      clearTimeout(timer);
      if (resp.status === 200 || resp.status === 301 || resp.status === 302) {
        out.push({ entry: r.id, severity: "ok", note: `arxiv ${resp.status} OK` });
      } else {
        out.push({ entry: r.id, severity: "warn", note: `arxiv HTTP ${resp.status}` });
      }
    } catch (e) {
      out.push({ entry: r.id, severity: "warn", note: `arxiv fetch failed: ${errMsg(e)}` });
    }
  }
  return out;
}

async function modePandoc(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  // Check pandoc availability
  const { spawnSync } = await import("child_process");
  const pv = spawnSync("pandoc", ["--version"], { encoding: "utf-8" });
  if (pv.status !== 0) {
    out.push({ entry: "(pandoc)", severity: "warn", note: "pandoc not installed; skipping render check" });
    return out;
  }
  // Use existing references.bib (auto-generated)
  const bibPath = path.join(folioDirOf(), "..", "references.bib");
  if (!fs.existsSync(bibPath)) {
    out.push({ entry: "(references.bib)", severity: "warn", note: `not found at ${bibPath}; run "cd content && bun run export-bibtex" first` });
    return out;
  }
  // Sample document citing 5 random entries
  const sample = references.slice(0, 5);
  const tex = `# Test\n\n${sample.map((r) => `[@${r.id}]`).join(" ")}\n`;
  console.log(`\n[pandoc] rendering 5-citation sample through pandoc-citeproc...`);
  const result = spawnSync(
    "pandoc",
    ["-f", "markdown", "-t", "plain", "--citeproc", "--bibliography", bibPath, "-"],
    { input: tex, encoding: "utf-8", timeout: 30000 }
  );
  if (result.status !== 0) {
    out.push({ entry: "(pandoc-render)", severity: "error", note: `pandoc-citeproc failed: ${result.stderr.slice(0, 200)}` });
  } else if (!result.stdout || result.stdout.length < 10) {
    out.push({ entry: "(pandoc-render)", severity: "warn", note: "pandoc output empty or trivially short" });
  } else {
    out.push({ entry: "(pandoc-render)", severity: "ok", note: `rendered ${result.stdout.length} chars` });
  }
  return out;
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  console.log(`validate-bib — modes: ${[...MODES].join(", ")} (strict=${STRICT})`);
  console.log(`references: ${references.length} entries`);

  const allResults: { mode: Mode; results: CheckResult[] }[] = [];
  if (MODES.has("doi")) allResults.push({ mode: "doi", results: await modeDoi() });
  if (MODES.has("cross-check")) allResults.push({ mode: "cross-check", results: await modeCrossCheck() });
  if (MODES.has("crossref")) allResults.push({ mode: "crossref", results: await modeCrossref() });
  if (MODES.has("arxiv")) allResults.push({ mode: "arxiv", results: await modeArxiv() });
  if (MODES.has("pandoc")) allResults.push({ mode: "pandoc", results: await modePandoc() });

  let totalErrors = 0;
  let totalWarns = 0;
  for (const { mode, results } of allResults) {
    const errors = results.filter((r) => r.severity === "error");
    const warns = results.filter((r) => r.severity === "warn");
    const oks = results.filter((r) => r.severity === "ok");
    totalErrors += errors.length;
    totalWarns += warns.length;
    console.log(`\n=== [${mode}] ${oks.length} ok / ${warns.length} warn / ${errors.length} error ===`);
    for (const r of errors.concat(warns).slice(0, 30)) {
      console.log(`  [${r.severity.toUpperCase()}] ${r.entry}: ${r.note}`);
    }
    if (errors.length + warns.length > 30) {
      console.log(`  …(${errors.length + warns.length - 30} more)`);
    }
  }

  console.log(`\n─── totals: ${totalErrors} error, ${totalWarns} warn ───`);
  if (STRICT && (totalErrors > 0 || totalWarns > 0)) process.exit(1);
}

main().catch((e) => {
  console.error("validate-bib failed:", e);
  process.exit(2);
});
