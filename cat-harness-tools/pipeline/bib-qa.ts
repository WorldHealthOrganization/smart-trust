#!/usr/bin/env bun
/**
 * Bibliography QA — generate per-reference quality-assurance metadata.
 *
 * For each entry in `schema/references.ts`, this script evaluates:
 *   1. has_url         — entry has a URL or DOI-derived URL
 *   2. url_resolves    — URL responds with HTTP 2xx (optional, with --check-urls)
 *   3. metadata_ok     — title, author, year all present and well-formed
 *   4. cited_in_paper  — referenced by at least one \cite{} or -- Ref: in the repo
 *   5. has_screenshot   — a screenshot/image exists in bib-qa-images/<id>.*
 *
 * Output: writes `bib-qa.json` (consumed by bib-qa.html)
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/bib-qa.ts                   # fast, no network
 *   bun run cat-harness-tools/pipeline/bib-qa.ts --check-urls      # also verify URLs resolve
 *   bun run cat-harness-tools/pipeline/bib-qa.ts --ci              # exit non-zero on metadata failures
 *   bun run cat-harness-tools/pipeline/bib-qa.ts --out /tmp/x.json # custom output path
 *
 * @module pipeline/bib-qa
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from "fs";
import { resolve, join, extname, relative } from "path";
import { references } from "./references-registry-di";
import { findContentRepoRoot } from "./repo-root";
import { readSourceLedger } from "../schemas/library/bib-attestations.ts";
import type { Data as CSLData, Person as CSLPerson } from "csl-json";

// Content repo root (was import-relative, which pointed at
// folio-assistant and made every content path below miss).
const REPO_ROOT = findContentRepoRoot();
// Content repo's content/, not folio-assistant's — see qa-checkers-extended.
const folioDirOf = folioDirDeferred(findContentRepoRoot(), import.meta.url);
const IMAGES_DIR = join(folioDirOf(), "bib-qa-images");

const args = process.argv.slice(2);
const checkUrls = args.includes("--check-urls");
const ciMode = args.includes("--ci");
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 && args[outIdx + 1]
  ? resolve(args[outIdx + 1])
  : join(folioDirOf(), "bib-qa.json");

// ── Types ───────────────────────────────────────────────────────

export interface BibQATag {
  key: string;
  label: string;
  status: "pass" | "fail" | "warn" | "unchecked";
  detail?: string;
}

export interface BibQAEntry {
  id: string;
  type: string;
  title: string;
  authors: string;
  year: string;
  url: string | null;
  doi: string | null;
  journal: string | null;
  tags: BibQATag[];
  citedIn: string[];      // file paths where this ref is cited
  images: string[];        // relative paths to screenshots in bib-qa-images/
  score: number;           // 0-7, count of passing tags (5 original + 2 added 2026-05-19)
  /** Verification status from bib-qa-verifications.json (if any). */
  verification?: {
    status: string;
    local_pdf?: string;
    verified_at?: string;
    verified_by?: Verifier;
    human_adjudicated?: { who: string; at: string; note?: string };
    fixes_applied?: number;
    fix_commit?: string;
    note?: string;
  };
}

export interface BibQAReport {
  generated: string;
  totalRefs: number;
  summary: { pass: number; warn: number; fail: number; unchecked: number };
  entries: BibQAEntry[];
}

// ── Helpers ─────────────────────────────────────────────────────

function formatPerson(p: CSLPerson): string {
  if (p.literal) return p.literal;
  const parts: string[] = [];
  if (p.given) parts.push(p.given);
  if (p.family) parts.push(p.family);
  return parts.join(" ");
}

function formatAuthors(entry: CSLData): string {
  if (!entry.author?.length) return "—";
  const names = entry.author.map(formatPerson);
  if (names.length <= 3) return names.join(", ");
  return `${names[0]} et al.`;
}

function formatYear(entry: CSLData): string {
  if (entry.issued) {
    const dp = entry.issued["date-parts"];
    if (dp?.[0]?.[0]) return String(dp[0][0]);
    if (entry.issued.raw) {
      const m = entry.issued.raw.match(/\d{4}/);
      if (m) return m[0];
    }
    if (entry.issued.literal) return entry.issued.literal;
  }
  return "—";
}

function entryUrl(entry: CSLData): string | null {
  if (entry.URL) return entry.URL;
  if (entry.DOI) return `https://doi.org/${entry.DOI}`;
  return null;
}

// ── Scan for citations in repository ────────────────────────────

function scanFilesRecursive(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  function walk(d: string) {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, ent.name);
      if (ent.isDirectory()) {
        if (["node_modules", ".lake", "build", ".git"].includes(ent.name)) continue;
        walk(full);
      } else if (ent.name.endsWith(ext)) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

/** Collect per-reference citation locations. */
function collectCitations(): Map<string, string[]> {
  const citedIn = new Map<string, string[]>();

  // Lean: -- Ref: [key]
  const leanFiles = [
    ...scanFilesRecursive(join(REPO_ROOT, "lean"), ".lean"),
    ...scanFilesRecursive(folioDir(REPO_ROOT), ".lean"),
  ];
  const REF_PAT = /(?:--\s*)?Ref:\s*\[([^\]]+)\]/g;
  for (const file of leanFiles) {
    const content = readFileSync(file, "utf-8");
    let m;
    const pat = new RegExp(REF_PAT.source, REF_PAT.flags);
    while ((m = pat.exec(content)) !== null) {
      const key = m[1].trim();
      if (!citedIn.has(key)) citedIn.set(key, []);
      citedIn.get(key)!.push(file.replace(REPO_ROOT + "/", ""));
    }
  }

  // LaTeX/Markdown: \cite{key1, key2}
  const texFiles = [
    ...scanFilesRecursive(join(REPO_ROOT, "chapters"), ".tex"),
    ...scanFilesRecursive(folioDir(REPO_ROOT), ".md"),
    ...[join(REPO_ROOT, "main.tex"), join(REPO_ROOT, "blueprint/src/content.tex")].filter(existsSync),
  ];
  const CITE_PAT = /\\cite(?:\[[^\]]*\])?\{([^}]+)\}/g;
  // Bare bracket citation [authorYYYY] in .md prose
  const BRACKET_CITE_PAT = /(?<![!\w])\[([a-z][a-z0-9-]*\d{4}[a-z]*)\](?!\()/g;
  const allRefIds = new Set(references.map((r) => r.id));

  for (const file of texFiles) {
    const content = readFileSync(file, "utf-8");
    let m;

    // \cite{key} patterns
    const pat = new RegExp(CITE_PAT.source, CITE_PAT.flags);
    while ((m = pat.exec(content)) !== null) {
      for (const key of m[1].split(",").map((k: string) => k.trim())) {
        if (!key) continue;
        if (!citedIn.has(key)) citedIn.set(key, []);
        const rel = file.replace(REPO_ROOT + "/", "");
        if (!citedIn.get(key)!.includes(rel)) {
          citedIn.get(key)!.push(rel);
        }
      }
    }

    // [refkey] bare bracket patterns (only in .md, validated against known refs)
    if (file.endsWith(".md")) {
      const bracketPat = new RegExp(BRACKET_CITE_PAT.source, BRACKET_CITE_PAT.flags);
      while ((m = bracketPat.exec(content)) !== null) {
        const key = m[1];
        if (allRefIds.has(key)) {
          if (!citedIn.has(key)) citedIn.set(key, []);
          const rel = file.replace(REPO_ROOT + "/", "");
          if (!citedIn.get(key)!.includes(rel)) {
            citedIn.get(key)!.push(rel);
          }
        }
      }

      // Tick-quoted bracket cite form: [`refkey`] (used in .md prose
      // when the content-pipeline carries the formal cites: array in
      // the .ts sibling; see e.g. cfs-comparison-summary.md).
      const TICK_BRACKET_PAT = /\[`([a-z][a-z0-9_-]*\d{4}[a-z]*)`\]/g;
      while ((m = TICK_BRACKET_PAT.exec(content)) !== null) {
        const key = m[1];
        if (allRefIds.has(key)) {
          if (!citedIn.has(key)) citedIn.set(key, []);
          const rel = file.replace(REPO_ROOT + "/", "");
          if (!citedIn.get(key)!.includes(rel)) {
            citedIn.get(key)!.push(rel);
          }
        }
      }
    }
  }

  // Content .ts manifest cites: [...] arrays — the authoritative
  // citation declaration for blocks whose .md uses an informal
  // reference style. Added 2026-05-19 after the bib audit found
  // 6 papers wrongly flagged as `uncited` because the inventory
  // missed this source.
  const tsFiles = scanFilesRecursive(folioDir(REPO_ROOT), ".ts");
  // Match: cites: [ "key1", "key2", ... ]  (handles single + multi-line)
  const TS_CITES_PAT = /\bcites\s*:\s*\[([^\]]*?)\]/gs;
  const TS_CITES_KEY = /["'`]([a-z][a-z0-9_-]*\d{4}[a-z]*)["'`]/gi;
  for (const file of tsFiles) {
    const content = readFileSync(file, "utf-8");
    let m;
    const pat = new RegExp(TS_CITES_PAT.source, TS_CITES_PAT.flags);
    while ((m = pat.exec(content)) !== null) {
      const arrBody = m[1];
      const kp = new RegExp(TS_CITES_KEY.source, TS_CITES_KEY.flags);
      let km;
      while ((km = kp.exec(arrBody)) !== null) {
        const key = km[1];
        if (!citedIn.has(key)) citedIn.set(key, []);
        const rel = file.replace(REPO_ROOT + "/", "");
        if (!citedIn.get(key)!.includes(rel)) {
          citedIn.get(key)!.push(rel);
        }
      }
    }
  }

  return citedIn;
}

// ── Scan for screenshots ────────────────────────────────────────

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".pdf"]);

function collectImages(): Map<string, string[]> {
  const images = new Map<string, string[]>();
  if (!existsSync(IMAGES_DIR)) return images;

  for (const file of readdirSync(IMAGES_DIR)) {
    const ext = extname(file).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;
    // Image files are named <refid>.png or <refid>-<n>.png
    const base = file.replace(/(-\d+)?\.[^.]+$/, "");
    if (!images.has(base)) images.set(base, []);
    images.get(base)!.push(`bib-qa-images/${file}`);
  }
  return images;
}

// ── URL resolution + content verification ───────────────────────

// ── Content-match tuning constants ──────────────────────────────

/** Skip title words shorter than this (common words like "the", "and"). */
const MIN_TITLE_WORD_LENGTH = 5;
/** Max title words to sample for content matching. */
const MAX_TITLE_WORDS = 6;
/** Fraction of search terms that must appear on the page (0.4 = 40%). */
const CONTENT_MATCH_THRESHOLD = 0.4;

/**
 * Check that a URL resolves (HTTP 2xx) and that the page contains
 * the intended content (title and/or author name appear on the page).
 */
async function checkUrl(
  url: string,
  entry: CSLData,
): Promise<{ ok: boolean; status: number; detail: string; contentMatch: boolean | null }> {
  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "QOU-BibQA/1.0 (academic reference checker)" },
    });
    if (!resp.ok) {
      return { ok: false, status: resp.status, detail: `HTTP ${resp.status}`, contentMatch: null };
    }

    // Read page text for content verification
    const contentType = resp.headers.get("content-type") || "";
    let contentMatch: boolean | null = null;

    if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
      try {
        const body = await resp.text();
        const bodyLower = body.toLowerCase();

        // Build search terms from entry metadata
        const searchTerms: string[] = [];

        // Title words (skip very short/common words)
        if (entry.title) {
          const titleWords = entry.title
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter((w: string) => w.length >= MIN_TITLE_WORD_LENGTH)
            .slice(0, MAX_TITLE_WORDS);
          searchTerms.push(...titleWords);
        }

        // First author family name
        if (entry.author?.[0]) {
          const name = entry.author[0].family || entry.author[0].literal;
          if (name && name.length >= 3) searchTerms.push(name);
        }

        if (searchTerms.length === 0) {
          contentMatch = null; // can't verify without terms
        } else {
          const matches = searchTerms.filter((t) => bodyLower.includes(t.toLowerCase()));
          const ratio = matches.length / searchTerms.length;
          contentMatch = ratio >= CONTENT_MATCH_THRESHOLD;
        }
      } catch {
        // Body read failed — still count the HTTP 200 as OK
        contentMatch = null;
      }
    }

    const matchStr = contentMatch === true ? "content matches"
      : contentMatch === false ? "content MISMATCH"
      : "content not verified (non-HTML)";
    return {
      ok: true,
      status: resp.status,
      detail: `HTTP ${resp.status}, ${matchStr}`,
      contentMatch,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, detail: msg, contentMatch: null };
  }
}

// ── Verification status (added 2026-05-19; Verifier union 2026-05-31) ───
//
// The canonical schema lives in schemas/library/bib-verification.ts.
// We re-declare the consumer-side shape here to avoid a pipeline →
// folio-assistant import edge (the content pipeline must stay in the
// content/ tree).  The shapes must stay in sync.

import type { Verifier, VerificationStatus } from "../schemas/library/bib-verification.ts";
import { verifierLabel } from "../schemas/library/bib-verification.ts";
import { directoryForGraph, folioDir, folioDirDeferred } from "../schemas/kg/cat-harness.js";

interface VerificationEntry {
  id: string;
  status: VerificationStatus;
  local_pdf?: string;
  verified_at?: string;
  verified_by?: Verifier;
  human_adjudicated?: { who: string; at: string; note?: string };
  fixes_applied?: number;
  fix_commit?: string;
  note?: string;
}

function loadVerifications(): Map<string, VerificationEntry> {
  // The ONE reader of the source ledger: the attestation store, or the legacy
  // file while this folio's store has no `bib-verification` family. It says which.
  const read = readSourceLedger(REPO_ROOT);
  console.error(read.note);
  const arr = read.ledger.entries as unknown as (VerificationEntry & { id: string | null })[];
  // Since the source-ledger migration (2026-08-08) the file also carries rows
  // for uploaded documents that back no reference yet; those have `id: null`
  // and would otherwise collide on a single null key.  Bib QA is per-
  // reference, so they are not its business.
  return new Map(
    arr.filter((e): e is VerificationEntry => typeof e.id === "string").map((e) => [e.id, e]),
  );
}

function localPdfPath(verif?: VerificationEntry, refId?: string): string | null {
  // Prefer the explicit path recorded in the ledger.  `source` is the current
  // shape; `local_pdf` is the deprecated pre-migration field.
  const recorded =
    (verif as { source?: { kind: string; file?: string } } | undefined)?.source?.kind === "upload"
      ? (verif as unknown as { source: { file: string } }).source.file
      : verif?.local_pdf;
  if (recorded) {
    const abs = join(REPO_ROOT, recorded);
    if (existsSync(abs)) return recorded;
  }
  // Fallback: glob uploads/ for any file matching the ref id.
  if (refId) {
    // declared-path-literal: the convention fallback, at the call site so the choice is visible.
    const uploads = directoryForGraph(REPO_ROOT, "uploads") ?? join(REPO_ROOT, "uploads");
    if (existsSync(uploads)) {
      for (const f of readdirSync(uploads)) {
        // The file's real location, repo-relative; `uploads/${f}` named the
        // ROOT's queue whichever directory was declared (bean `gz47`).
        if (f.startsWith(refId)) return relative(REPO_ROOT, join(uploads, f));
      }
    }
  }
  return null;
}

// ── Build QA entries ────────────────────────────────────────────

async function buildReport(): Promise<BibQAReport> {
  console.log(`Bibliography QA: ${references.length} references`);

  const citationMap = collectCitations();
  const imageMap = collectImages();
  const verifMap = loadVerifications();

  const entries: BibQAEntry[] = [];
  const summary = { pass: 0, warn: 0, fail: 0, unchecked: 0 };

  for (const entry of references) {
    const tags: BibQATag[] = [];
    const url = entryUrl(entry);
    const cited = citationMap.get(entry.id) || [];
    const imgs = imageMap.get(entry.id) || [];

    // ── Tag 1: has_url ──────────────────────────────────────
    if (url) {
      tags.push({ key: "has_url", label: "Has URL", status: "pass", detail: url });
    } else {
      tags.push({ key: "has_url", label: "Has URL", status: "fail", detail: "No URL or DOI" });
    }

    // ── Tag 2: url_resolves + content match ────────────────
    if (checkUrls && url) {
      const result = await checkUrl(url, entry);
      // URL must resolve AND content should match (if verifiable)
      const resolveOk = result.ok;
      const contentOk = result.contentMatch !== false; // null = not checked = OK
      tags.push({
        key: "url_resolves",
        label: "URL Resolves + Content",
        status: resolveOk && contentOk ? "pass"
          : resolveOk && !contentOk ? "warn"
          : "fail",
        detail: result.detail,
      });
    } else {
      tags.push({
        key: "url_resolves",
        label: "URL Resolves + Content",
        status: "unchecked",
        detail: url ? "Run with --check-urls" : "No URL to check",
      });
    }

    // ── Tag 3: metadata_ok ──────────────────────────────────
    const issues: string[] = [];
    if (!entry.title) issues.push("missing title");
    if (!entry.author?.length && entry.type !== "dataset") issues.push("missing authors");
    if (!entry.issued) issues.push("missing year");
    if (entry.type === "article-journal" && !entry["container-title"]) issues.push("missing journal");
    if (entry.type === "book" && !entry.publisher) issues.push("missing publisher");

    if (issues.length === 0) {
      tags.push({ key: "metadata_ok", label: "Metadata Complete", status: "pass" });
    } else if (issues.length === 1) {
      tags.push({ key: "metadata_ok", label: "Metadata Complete", status: "warn", detail: issues[0] });
    } else {
      tags.push({ key: "metadata_ok", label: "Metadata Complete", status: "fail", detail: issues.join("; ") });
    }

    // ── Tag 4: cited_in_paper ───────────────────────────────
    if (cited.length > 0) {
      tags.push({
        key: "cited_in_paper",
        label: "Cited in Paper",
        status: "pass",
        detail: `${cited.length} citation(s)`,
      });
    } else {
      tags.push({
        key: "cited_in_paper",
        label: "Cited in Paper",
        status: "warn",
        detail: "Uncited — orphan reference",
      });
    }

    // ── Tag 5: has_screenshot ───────────────────────────────
    if (imgs.length > 0) {
      tags.push({
        key: "has_screenshot",
        label: "Screenshot",
        status: "pass",
        detail: `${imgs.length} image(s)`,
      });
    } else {
      tags.push({
        key: "has_screenshot",
        label: "Screenshot",
        status: "unchecked",
        detail: "No screenshot in bib-qa-images/",
      });
    }

    // ── Tag 6: has_local_pdf (added 2026-05-19) ─────────────
    const verif = verifMap.get(entry.id);
    const pdfPath = localPdfPath(verif, entry.id);
    if (pdfPath) {
      tags.push({
        key: "has_local_pdf",
        label: "Local PDF",
        status: "pass",
        detail: pdfPath,
      });
    } else {
      tags.push({
        key: "has_local_pdf",
        label: "Local PDF",
        status: "unchecked",
        detail: "No local copy in uploads/",
      });
    }

    // ── Tag 7: verification_status (added 2026-05-19; Verifier union 2026-05-31) ───
    if (verif) {
      const cleanStates = new Set(["verified-clean", "partial", "fixed"]);
      const verifierStr = verif.verified_by ? verifierLabel(verif.verified_by) : "";
      const adjudicatedStr = verif.human_adjudicated
        ? `, human-adjudicated by ${verif.human_adjudicated.who}`
        : "";
      if (cleanStates.has(verif.status)) {
        tags.push({
          key: "verification_status",
          label: "Verification Status",
          status: "pass",
          detail: `${verif.status}` +
            (verifierStr ? ` (by ${verifierStr})` : "") +
            adjudicatedStr +
            (verif.fixes_applied ? `, ${verif.fixes_applied} fix(es)` : ""),
        });
      } else if (verif.status === "pending-placement") {
        // New status (2026-05-19): "I need this reference but haven't
        // figured out where to cite it yet". Distinct from `uncited`
        // (which suggests the entry may be removable) — this status
        // explicitly says the entry is INTENDED to stay; the
        // citation site is just deferred.
        tags.push({
          key: "verification_status",
          label: "Verification Status",
          status: "pass",
          detail: `pending-placement — author wants to keep; citation site TBD` +
            (verif.note ? ` — ${verif.note.slice(0, 80)}` : ""),
        });
      } else if (verif.status === "uncited") {
        tags.push({
          key: "verification_status",
          label: "Verification Status",
          status: "warn",
          detail: `uncited (bib orphan) — ${verif.note ?? "decision pending"}`,
        });
      } else if (verif.status === "paper-mismatch") {
        tags.push({
          key: "verification_status",
          label: "Verification Status",
          status: "fail",
          detail: `paper-mismatch — ${verif.note ?? "local PDF != metadata"}`,
        });
      } else {
        tags.push({
          key: "verification_status",
          label: "Verification Status",
          status: "warn",
          detail: `${verif.status} — ${verif.note ?? "needs review"}`,
        });
      }
    } else {
      tags.push({
        key: "verification_status",
        label: "Verification Status",
        status: "unchecked",
        detail: "Not yet examined (no entry in the source ledger)",
      });
    }

    // Count summary
    for (const t of tags) summary[t.status]++;

    entries.push({
      id: entry.id,
      type: entry.type,
      title: entry.title ?? "",
      authors: formatAuthors(entry),
      year: formatYear(entry),
      url,
      doi: entry.DOI || null,
      journal: entry["container-title"] || null,
      tags,
      citedIn: cited,
      images: imgs,
      score: tags.filter((t) => t.status === "pass").length,
      verification: verif ? {
        status: verif.status,
        local_pdf: verif.local_pdf,
        verified_at: verif.verified_at,
        verified_by: verif.verified_by,
        fixes_applied: verif.fixes_applied,
        fix_commit: verif.fix_commit,
        note: verif.note,
      } : undefined,
    });
  }

  // Sort: lowest score first (most issues at top)
  entries.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));

  return {
    generated: new Date().toISOString(),
    totalRefs: references.length,
    summary,
    entries,
  };
}

// ── Main ────────────────────────────────────────────────────────

const report = await buildReport();
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`\nBib-QA report written to ${outPath}`);
console.log(`  ${report.totalRefs} references`);
console.log(`  ${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail, ${report.summary.unchecked} unchecked`);

const lowScore = report.entries.filter((e) => e.score <= 2);
if (lowScore.length > 0) {
  console.log(`\n  ⚠ ${lowScore.length} references with score ≤ 2/7:`);
  for (const e of lowScore.slice(0, 10)) {
    console.log(`    [${e.score}/7] ${e.id}: ${e.tags.filter((t) => t.status !== "pass").map((t) => t.label).join(", ")}`);
  }
}

// ── CI mode: fail on metadata errors ────────────────────────────
// In CI mode, exit non-zero if any reference has metadata_ok = "fail"
// (missing title + authors + year, or multiple metadata issues).
// This catches broken references without requiring network access.
if (ciMode) {
  const metadataFails = report.entries.filter((e) =>
    e.tags.some((t) => t.key === "metadata_ok" && t.status === "fail"),
  );
  if (metadataFails.length > 0) {
    console.log(`\n✗ CI: ${metadataFails.length} reference(s) with metadata failures:`);
    for (const e of metadataFails) {
      const tag = e.tags.find((t) => t.key === "metadata_ok")!;
      console.log(`    ${e.id}: ${tag.detail}`);
    }
    process.exit(1);
  }
  console.log("\n✓ CI: all references pass metadata checks");
}
