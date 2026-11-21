#!/usr/bin/env bun
/**
 * Script-reviewer checkers for the non-voice integration-watcher
 * axes:
 *
 *   - proof-*        (5 criteria, 3 script + 2 mixed/agent)
 *   - canonical-*    (3 criteria, 2 script + 1 agent)
 *   - compute-*      (4 criteria, all script)
 *   - detangler-*    (4 criteria, all script)
 *   - bib-*          (4 criteria, all script)
 *
 * Each checker returns the same `{ result, hits }` shape as the
 * voice checkers in `qa-checkers-voice.ts`, so they wire into the
 * existing `AUTOMATED_CHECKERS` dispatcher unchanged.
 *
 * Many checkers delegate to existing repo scripts (`bib-qa.ts`,
 * `validate-references.ts`, `compute_audit_scan.py`, etc.) by
 * reading the cached JSON artefacts those scripts produce, rather
 * than re-running them per block. This keeps `qa-sweep` fast
 * (sub-second per block) while preserving the canonical sources.
 *
 * @module pipeline/qa-checkers-extended
 */

import { folioDirDeferred } from "../schemas/kg/cat-harness.js";
// The `proof-*` checkers (including `checkProofNoTrivialSkeleton`, which calls
// `stripLeanComments`) moved to the sci layer (https://github.com/litlfred/folio-assistant-sci/blob/main/pipeline/qa-checkers-extended.ts)
// (bean `saqd` Group 8).
import { existsSync, readFileSync, readdirSync } from "fs";
import type { CheckerPaths, CheckerHit, CheckerResult } from "../schemas/sdlc/block-qa.ts";
import { resolve, dirname, join, relative } from "path";
// The conformance check itself, plus its result type. Imported here rather than
// given its own module because a checker belongs in the registry's file, and the
// mechanism it wraps is one function.
import { checkFolioProfile, readDeclaredFolioProfile, type ProfileCheckResult } from "./profile-check";
import { fileURLToPath } from "url";
import { findContentRepoRoot, findPapers } from "./repo-root";
import { maskStringsAndComments, parseStringField } from "./uses-field";

const __filename = fileURLToPath(import.meta.url);
// Resolve content-repo paths (witnesses under <repo>/computations, Lean
// under <repo>/content, the i1 audit) against the CONTENT repo — not the
// folio-assistant tree the pipeline lives in. The old
// `resolve(dirname(__filename), "..")` landed inside folio-assistant
// (a symlinked subdir of the content repo), so witness/Lean existence checks
// resolved to non-existent paths and false-failed compute-integration
// criteria (compute-witness-exists, compute-prop-has-probe/-consumer). See
// repo-root.ts.
const REPO_ROOT = findContentRepoRoot();
// The CONTENT repo's content/ dir, not folio-assistant's. This was
// `resolve(dirname(__filename), "..")` — import-relative, so it pointed at
// folio-assistant/content (which holds only `pipeline/`). Every consumer
// below wants the content repo: the bib-qa artefacts, content/schema/
// references.ts, and the paper manifests. The paper lookup therefore always
// missed and the ENTIRE detangler axis reported n/a on every folio,
// silently, while looking healthy.
const folioDirOf = folioDirDeferred(REPO_ROOT, import.meta.url);
const BIB_QA_REPORT = join(folioDirOf(), "bib-qa.json");


// ── Lazy-loaded bib-qa report (cached across calls per process) ─

let bibQaReportCache: Record<string, unknown> | null = null;
function loadBibQaReport(): Record<string, unknown> | null {
  if (bibQaReportCache !== null) return bibQaReportCache;
  if (!existsSync(BIB_QA_REPORT)) {
    bibQaReportCache = {};
    return bibQaReportCache;
  }
  try {
    bibQaReportCache = JSON.parse(readFileSync(BIB_QA_REPORT, "utf-8"));
  } catch {
    bibQaReportCache = {};
  }
  return bibQaReportCache;
}

// ── Profile conformance — the check that was reachable only over MCP ─
//
// `checkFolioProfile` catches what schema validation STRUCTURALLY cannot: a
// block valid against its own schema but wrong for the folio's content profile,
// because adapters partition disjointly while profiles NEST. Until this axis it
// had no shell entry point at all — its only caller registered MCP tools — so CI
// could never ask the question. Bean `0bzg`, and the owner chose this axis over a
// `check:profile` script precisely because a sweep verdict is durable where a
// printed one is not.
//
// CACHED PER PROCESS, and that is not an optimisation. `checkFolioProfile` walks
// the whole folio; calling it per block would re-walk once per block, which is
// bean `4n37`'s defect (`probeAll` re-spawning 25 subprocesses per call) in a
// different costume. The profile and the manifests cannot change mid-sweep, so
// one walk is not a cache of something volatile — it is not repeating work.
let profileCheckCache: ProfileCheckResult | null | undefined;
function loadProfileCheck(): ProfileCheckResult | null {
  if (profileCheckCache !== undefined) return profileCheckCache;
  try {
    profileCheckCache = checkFolioProfile(REPO_ROOT, folioDirOf());
  } catch {
    // A throw is COULD-NOT-DETERMINE, never conformance. Swallowing it into a
    // pass is how `qa-checkers-extended`'s detangler axis once reported n/a on
    // every folio while looking healthy — see the `folioDirOf()` note above.
    profileCheckCache = null;
  }
  return profileCheckCache;
}

/**
 * Does this block conform to the folio's declared content profile?
 *
 * Its own criterion, NEVER folded into the schema verdict. `0bzg`'s argument is
 * that this check answers a question schema validation cannot reach, so a
 * combined verdict would report one judgement where there are two — and the one
 * it would hide is the one with no other source.
 *
 * Three results, and the `n/a` cases are the point:
 *
 *   · **no manifest** — nothing to place in a profile.
 *   · **the folio declares no profile** — `profile-check.ts` is explicit that
 *     this is distinct from declaring `paper`, and that a consumer which skips
 *     work on the strength of a profile must not skip it on the strength of a
 *     guess. So: not a pass.
 *   · **the check threw** — could-not-determine.
 *
 * Only a folio that declares a profile AND has no violation for this block
 * passes.
 */
export function checkProfileConformance(ts: string | undefined): CheckerResult {
  if (ts === undefined) {
    return { result: "n/a", hits: [], notes: "no `.ts` manifest for this block, so it sits in no profile" };
  }
  const r = loadProfileCheck();
  if (r === null) {
    return { result: "n/a", hits: [], notes: "the profile check could not run — could not determine, not conformant" };
  }
  // ASKED OF `readDeclaredFolioProfile`, not of `r.profile`, and finding that out
  // took running it. `checkFolioProfile` resolves through `readFolioProfile`,
  // which turns an undeclared profile into `"paper"` — the right default for a
  // VALIDATOR, since the wider vocabulary is the safe one to validate against —
  // so `r.profile` is never `undefined` and a guard on it never fires. The first
  // version of this axis therefore reported `pass` on a folio that declares
  // nothing, which is exactly the laundering it exists to prevent.
  //
  // Not inferred from `declaredBy`'s wording either: that is prose, and matching
  // on "default (…)" would break the moment the sentence is reworded. The
  // declared/undeclared question has its own function, and that function's whole
  // documented purpose is keeping the two apart.
  const declared = readDeclaredFolioProfile(REPO_ROOT);
  if (declared.profile === undefined) {
    return {
      result: "n/a",
      hits: [],
      notes: `the folio declares no content profile (${declared.declaredBy}) — could not determine, not conformant`,
    };
  }
  // Compared by RESOLVED path. `ProfileViolation.ts` is absolute and the sweep's
  // companion path may be relative, so a string compare would silently match
  // nothing and report every block conformant.
  const mine = r.violations.filter((v) => resolve(v.ts) === resolve(ts));
  if (mine.length === 0) {
    return {
      result: "pass",
      hits: [],
      notes: `conforms to the declared \`${r.profile}\` profile (${r.declaredBy})`,
    };
  }
  return {
    result: "fail",
    hits: mine.map((v) => ({ file: v.ts, line: 1, text: `${v.reason}: ${v.detail}` })),
    notes: `${mine.length} profile violation(s) against the declared \`${r.profile}\` profile`,
  };
}

// Extract `\cite{key1, key2}` + `-- Ref: [key]` from .md / .lean.
function extractCitations(text: string): Set<string> {
  const keys = new Set<string>();
  // \cite{a,b} / \citep{a} / \citet{a}
  for (const m of text.matchAll(
    /\\cite[a-zA-Z]*(?:\[[^\]]*\])?\{([^}]+)\}/g,
  )) {
    for (const k of m[1].split(",")) {
      const trimmed = k.trim();
      if (trimmed) keys.add(trimmed);
    }
  }
  // -- Ref: [key]
  for (const m of text.matchAll(/--\s*Ref:\s*\[([^\]]+)\]/g)) {
    keys.add(m[1].trim());
  }
  return keys;
}

function readMaybe(path: string | undefined): string {
  if (!path || !existsSync(path)) return "";
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

// ─── Bibliography axis ──────────────────────────────────────────

// Lazily-built set of known reference ids, sourced first from
// `references.ts` (always available, committed source) and second from
// `bib-qa.json` (gitignored — generated by `pipeline/bib-qa.ts`; only
// present after a local/CI bib-qa run).
let bibIdSetCache: Set<string> | null = null;
function loadBibIdSet(): Set<string> {
  if (bibIdSetCache !== null) return bibIdSetCache;
  const set = new Set<string>();
  // Primary source: references.ts. Parse out every `id: "<key>"`.
  // This is robust to bib-qa.json absence (the file is gitignored).
  try {
    const refsPath = join(folioDirOf(), "schema", "references.ts");
    if (existsSync(refsPath)) {
      const src = readFileSync(refsPath, "utf-8");
      const idRe = /\bid:\s*"([^"]+)"/g;
      for (const m of src.matchAll(idRe)) set.add(m[1]);
    }
  } catch {
    /* fall through to bib-qa.json */
  }
  // Secondary: bib-qa.json (entries is a LIST of {id, …} records).
  const report = loadBibQaReport();
  const entriesRaw = report?.entries;
  if (Array.isArray(entriesRaw)) {
    for (const e of entriesRaw) {
      if (e && typeof e === "object" && "id" in e) {
        const id = (e as { id?: unknown }).id;
        if (typeof id === "string") set.add(id);
      }
    }
  } else if (entriesRaw && typeof entriesRaw === "object") {
    for (const k of Object.keys(entriesRaw as Record<string, unknown>)) {
      set.add(k);
    }
  }
  // `manuscript` is the canonical placeholder for unpublished references
  // (per CLAUDE.md §1) — always accept even if absent from references.ts.
  set.add("manuscript");
  bibIdSetCache = set;
  return set;
}

export function checkBibCiteResolves(
  mdPath: string | undefined,
  leanPath: string | undefined,
): CheckerResult {
  const md = readMaybe(mdPath);
  const lean = readMaybe(leanPath);
  const keys = new Set<string>([
    ...extractCitations(md),
    ...extractCitations(lean),
  ]);
  if (keys.size === 0) return { result: "pass", hits: [] };

  const entrySet = loadBibIdSet();

  const hits: CheckerHit[] = [];
  for (const key of keys) {
    // Skip cross-paper qualified references (`paper-dir:label`) — they
    // are validated at the folio level, not by the per-paper bib check.
    if (/^[a-z0-9_-]+:/.test(key)) continue;
    if (!entrySet.has(key)) {
      hits.push({
        file: mdPath ?? leanPath ?? "(unknown)",
        line: 1,
        text: `\\cite{${key}} or -- Ref: [${key}] does not resolve in references.ts`,
      });
    }
  }
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

function checkBibRefTag(
  mdPath: string | undefined,
  leanPath: string | undefined,
  tagKey: string,
  describe: string,
): CheckerResult {
  const md = readMaybe(mdPath);
  const lean = readMaybe(leanPath);
  const keys = new Set<string>([
    ...extractCitations(md),
    ...extractCitations(lean),
  ]);
  if (keys.size === 0) return { result: "pass", hits: [] };

  const report = loadBibQaReport();
  const entries = (report?.entries ?? {}) as Record<
    string,
    { tags?: Array<{ key: string; status: string }> }
  >;
  const hits: CheckerHit[] = [];
  for (const key of keys) {
    const entry = entries[key];
    if (!entry) continue; // resolution failure is a different criterion
    const tag = entry.tags?.find((t) => t.key === tagKey);
    if (!tag || tag.status !== "pass") {
      hits.push({
        file: mdPath ?? leanPath ?? "(unknown)",
        line: 1,
        text: `cite [${key}] fails bib-qa tag '${tagKey}' (${describe})`,
      });
    }
  }
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

export function checkBibCitedRefHasUrl(
  mdPath: string | undefined,
  leanPath: string | undefined,
): CheckerResult {
  return checkBibRefTag(mdPath, leanPath, "has_url", "no URL or DOI");
}

export function checkBibCitedRefMetadataOk(
  mdPath: string | undefined,
  leanPath: string | undefined,
): CheckerResult {
  return checkBibRefTag(
    mdPath,
    leanPath,
    "metadata_ok",
    "missing title/author/year",
  );
}

export function checkBibCitedRefHasScreenshot(
  mdPath: string | undefined,
  leanPath: string | undefined,
): CheckerResult {
  return checkBibRefTag(
    mdPath,
    leanPath,
    "has_screenshot",
    "no screenshot under folio/bib-qa-images/",
  );
}

// ─── Detangler axis ─────────────────────────────────────────────

// Resolve a block slug (filename without .ts) under a chapter dir to
// its kind, handling both declaration forms (`kind: "x"` and the
// `export default <builder>(` builder call). Returns "" if unresolved.
function blockKindForSlug(chapterDir: string, slug: string): string {
  const p = join(chapterDir, `${slug}.ts`);
  if (!existsSync(p)) return "";
  const src = readFileSync(p, "utf-8");
  const m =
    src.match(/kind:\s*"([^"]+)"/) ||
    src.match(/export\s+default\s+(\w+)\s*\(/);
  return m ? m[1] : "";
}

export function checkDetanglerSectionBand(
  tsPath: string | undefined,
): CheckerResult {
  const ts = readMaybe(tsPath);
  if (!ts || !tsPath) return { result: "n/a", hits: [] };
  const chapterDir = dirname(tsPath);
  // Only applies to chapter manifests (which list sections). Capture
  // the section TITLE too, so intro/overview sections can be skipped
  // (detangler H4 excludes them from the sparse-section check).
  const sectionRe =
    /\{\s*title:\s*["']([^"']*)["']\s*,\s*blocks:\s*\[([^\]]*)\]/g;
  const sections: Array<{ title: string; nonProse: number }> = [];
  for (const m of ts.matchAll(sectionRe)) {
    const slugs = m[2]
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    // Count NON-PROSE blocks only (detangler H4/H5 measure "content
    // blocks", not narrative prose/section-intro text). Resolving each
    // slug's kind avoids the old bug of counting every ref — including
    // prose — which inflated dense counts and masked sparse ones.
    let nonProse = 0;
    for (const slug of slugs) {
      const kind = blockKindForSlug(chapterDir, slug);
      // Unresolved slugs (kind "") count as content (conservative — do
      // not silently drop a block we failed to read).
      if (kind !== "prose") nonProse++;
    }
    sections.push({ title: m[1], nonProse });
  }
  if (sections.length === 0) return { result: "n/a", hits: [] };
  const isIntro = (t: string) =>
    /\b(introduction|overview|preliminaries|motivation)\b/i.test(t);
  const hits: CheckerHit[] = [];
  sections.forEach((s, i) => {
    // Sparse check excludes intro/overview sections (H4); dense check
    // applies to all.
    const sparse = s.nonProse < 3 && !isIntro(s.title);
    const dense = s.nonProse > 18;
    if (sparse || dense) {
      hits.push({
        file: tsPath,
        line: 1,
        text: `section ${i + 1} "${s.title}": ${s.nonProse} non-prose blocks (out of band 3..18)`,
      });
    }
  });
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

// `detangler-no-forward-ref`, `detangler-no-xchapter-fwd`, and
// `detangler-archimedean-wall` need access to the chapter ordering
// of the paper. They share a heavier preamble — left as TODO in
// this commit, with explicit `n/a` returns so the sweep doesn't
// flag them as missing. A follow-up commit will wire them.

/**
 * Parse a block manifest's DECLARED `foreshadows: [...]`.
 *
 * Text-level like the sibling `label:` parse in this file, so the checker
 * stays free of a module import of the manifest.
 *
 * ⚠ The array match is non-greedy, so it stops at the first `]`. A comment
 * inside the array containing a closing bracket — `// moved out of uses[]` —
 * silently truncates the list, and a truncated array is indistinguishable
 * from a shorter one, so nothing downstream can detect it. The same shape
 * applies to the `uses:` parse in `loadChapterGraph`. Do not write a closing
 * bracket in a comment inside one of these arrays.
 */
// `maskStringsAndComments` now lives in `./uses-field`, next to the field
// scanner that needs it, and is re-exported here so existing importers and
// tests keep working. Two copies of a masking primitive is how the manifest
// parsers diverged in the first place (see `fsl7`).
export { maskStringsAndComments };

/**
 * Extract a manifest array field's string entries.
 *
 * Replaces three regex-shaped bugs that made the checkers read different
 * data from the content pipeline — which imports the manifest and sees the
 * real array — while `validate` stayed green:
 *
 *  1. **Phantom entries.** A quoted string in a comment inside the array was
 *     extracted as an entry. Live in the corpus: `p3-blowup-yekutieli.ts`
 *     read 4 `uses[]` entries where the truth is 3, the extra being the
 *     phrase `NS blowup ⟺ obstruction level n*` from an explanatory comment.
 *  2. **Wrong array entirely.** The old match was unanchored and took the
 *     first hit in the file, so a quoted `uses: [...]` in an `authorNotes`
 *     body won over the block's real field. Live in
 *     `hecke-log-decomposition-table-data.ts`, whose note documents an
 *     earlier fabricated-edge incident and thereby fabricated another.
 *  3. **Silent truncation.** `[\s\S]*?\]` stops at the first `]`, so a
 *     comment containing one — `// moved out of uses[]` — dropped every
 *     entry after it. The worst of the three: a truncated array is
 *     indistinguishable from a shorter one, so nothing downstream can
 *     detect it.
 *
 * Masking fixes all three at once: comments and string CONTENTS are blanked
 * (indices preserved), so the field is located only at a real property
 * position and the closing bracket is found by depth-scanning text that can
 * no longer contain a decorative one. Entries are then read from the
 * ORIGINAL source over that range.
 *
 * Note the masking must be index-preserving rather than a strip: naive
 * comment removal corrupts `https://…` inside string literals.
 */
/**
 * Every occurrence of a manifest array field, in source order.
 *
 * Same masking and depth-scanning as `parseManifestStringArray` — which is now
 * the first element of this — but a chapter manifest holds one `blocks: [...]`
 * per section and per subsection, and the position map has to walk all of them
 * in order.
 */
export function parseManifestStringArrays(tsSrc: string, field: string): string[][] {
  const masked = maskStringsAndComments(tsSrc);
  const re = new RegExp(`(^|[{,\\s])${field}\\s*:\\s*\\[`, "g");
  const arrays: string[][] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    const open = masked.indexOf("[", m.index);
    let depth = 0;
    let close = -1;
    for (let k = open; k < masked.length; k++) {
      if (masked[k] === "[") depth++;
      else if (masked[k] === "]") {
        depth--;
        if (depth === 0) {
          close = k;
          break;
        }
      }
    }
    if (close === -1) break; // unbalanced source; take nothing further
    // Read entries from the ORIGINAL text, but only at positions the mask
    // agrees are string literals — so a bracket or quote inside a comment
    // cannot contribute an entry.
    const region = tsSrc.slice(open + 1, close);
    const maskRegion = masked.slice(open + 1, close);
    const entries: string[] = [];
    const entry = /["']/g;
    let mm: RegExpExecArray | null;
    while ((mm = entry.exec(maskRegion))) {
      const q = mm.index;
      const quote = maskRegion[q];
      const end = maskRegion.indexOf(quote, q + 1);
      if (end === -1) break;
      entries.push(region.slice(q + 1, end));
      entry.lastIndex = end + 1;
    }
    arrays.push(entries);
    re.lastIndex = close; // resume after this array, never inside it
  }
  return arrays;
}

export function parseManifestStringArray(tsSrc: string, field: string): string[] {
  const masked = maskStringsAndComments(tsSrc);
  const re = new RegExp(`(^|[{,\\s])${field}\\s*:\\s*\\[`, "g");
  const m = re.exec(masked);
  if (!m) return [];
  const open = masked.indexOf("[", m.index);
  let depth = 0;
  let close = -1;
  for (let k = open; k < masked.length; k++) {
    if (masked[k] === "[") depth++;
    else if (masked[k] === "]") {
      depth--;
      if (depth === 0) { close = k; break; }
    }
  }
  if (close === -1) return [];
  // Read entries from the ORIGINAL text, but only at positions the mask
  // agrees are string literals — so a bracket or quote inside a comment
  // cannot contribute an entry.
  const region = tsSrc.slice(open + 1, close);
  const maskRegion = masked.slice(open + 1, close);
  const out: string[] = [];
  const entry = /["']/g;
  let mm: RegExpExecArray | null;
  while ((mm = entry.exec(maskRegion))) {
    const q = mm.index;
    const quote = maskRegion[q];
    const end = maskRegion.indexOf(quote, q + 1);
    if (end === -1) break;
    out.push(region.slice(q + 1, end));
    entry.lastIndex = end + 1;
  }
  return out;
}

/**
 * Parse a block manifest's DECLARED `foreshadows: [...]`.
 *
 * Comment- and string-safe via `parseManifestStringArray`; see that
 * function for the three failure modes this replaced.
 */
export function parseForeshadows(tsSrc: string): string[] {
  return parseManifestStringArray(tsSrc, "foreshadows");
}

/**
 * Every block label a `.md` narrative references, in either form the corpus
 * uses:
 *
 *   - `](#kind:label)` — a markdown link (4786 occurrences in qou)
 *   - `` `kind:label` `` — a backtick mention (907, of which 44 appear in no
 *     link anywhere in their block)
 *
 * Deliberately NOT included: `:refterm[…]{#slug}` / `:defterm[…]{#slug}`.
 * Those carry GLOSSARY TERM slugs (`braided-monoidal-category`) — a separate
 * namespace from block labels, owned by the `defines` machinery.
 *
 * Returns raw candidates. Resolution against the corpus and the
 * forward/backward split are the caller's job; this function has no position
 * information and stays deliberately ignorant of it.
 */
export function parseMdBlockRefs(mdSrc: string): string[] {
  const out = new Set<string>();
  for (const m of mdSrc.matchAll(/\]\(#([a-z]+:[a-z0-9-]+)\)/g)) out.add(m[1]);
  for (const m of mdSrc.matchAll(/`([a-z]+:[a-z0-9-]+)`/g)) out.add(m[1]);
  return [...out];
}

/**
 * A block's DERIVED forward pointers: labels its narrative references that sit
 * later in the reading order and are not already declared dependencies.
 *
 * This is the autopopulation rule. A forward pointer already lives in the
 * prose — "see X", "the remarks below frame these regimes as ODEs" — so the
 * manifest should not have to repeat it. Same relationship `cites` has to
 * `\cite{}` in the `.md`.
 *
 * What it CANNOT derive, and why the manifest field remains: a foreshadow that
 * is also a `uses[]` dependency — a real prerequisite the paper states later
 * on purpose. No rule separates that from a forward `uses[]` edge that is
 * simply a defect; only the author's declaration can. Callers therefore take
 * the UNION of this and `parseForeshadows`.
 */
export function deriveForeshadows(
  label: string,
  mdSrc: string,
  uses: readonly string[],
  positionOf: (l: string) => number | undefined,
  isKnownLabel: (l: string) => boolean,
): string[] {
  const myPos = positionOf(label);
  if (myPos === undefined) return [];
  const declared = new Set(uses);
  return parseMdBlockRefs(mdSrc)
    .filter((t) => t !== label && !declared.has(t) && isKnownLabel(t))
    .filter((t) => {
      const p = positionOf(t);
      return p !== undefined && p > myPos;
    })
    .sort();
}

export function checkDetanglerNoForwardRef(
  tsPath: string | undefined,
): CheckerResult {
  if (!tsPath || !existsSync(tsPath)) return { result: "n/a", hits: [] };
  loadChapterGraph();
  if (!_graphLoaded || !_blockPos || !_usesGraph || !_labelToChapter)
    return { result: "n/a", hits: [] };

  const content = readFileSync(tsPath, "utf-8");
  const labelMatch = content.match(/label:\s*"([^"]+)"/);
  if (!labelMatch) return { result: "pass", hits: [] };
  const label = labelMatch[1];
  const myPos = _blockPos.get(label);
  if (myPos === undefined) return { result: "pass", hits: [] }; // not listed
  const myChapter = _labelToChapter.get(label);

  // Deliberate forward references — a foreshadow, a preview, or an explicitly
  // deferred result the exposition promises to return to. Declared on the
  // block, so the intent lives in the authored manifest next to `uses[]`
  // rather than in a QA sidecar. Only these edges are exempt; every other
  // forward ref is still a finding.
  const foreshadowed = new Set(parseForeshadows(content));

  const hits: CheckerHit[] = [];
  for (const u of _usesGraph.get(label) ?? []) {
    // Only SAME-chapter forward refs here; cross-chapter is the
    // separate `detangler-no-xchapter-fwd` criterion.
    if (_labelToChapter.get(u) !== myChapter) continue;
    if (foreshadowed.has(u)) continue;
    const uPos = _blockPos.get(u);
    if (uPos !== undefined && uPos > myPos) {
      hits.push({
        file: tsPath,
        line: 0,
        text: `forward ref: uses ${u} (manifest pos ${withinChapter(uPos)}) which appears after this block (pos ${withinChapter(myPos)}) in the chapter`,
      });
    }
  }
  return hits.length
    ? { result: "fail", hits }
    : { result: "pass", hits: [] };
}

/**
 * `foreshadows[]` must point FORWARD.
 *
 * A foreshadow is a promise that material is coming. Naming something the
 * reader has already passed is not a preview — it is either a prerequisite
 * filed in the wrong field, or a back-reference that costs nothing and says
 * nothing.
 *
 * This became load-bearing when `foreshadows[]` stopped being a subset of
 * `uses[]` (2026-08-10). While the subset rule held, every foreshadow was
 * also a dependency and `uses-resolve` plus the ordering criteria constrained
 * it from the other side. Now an entry may name a block the manifest does not
 * otherwise reference, and such an entry is zero-cost by construction — so
 * direction is the one property left that a machine can check.
 *
 * It is a partial guard, and worth being honest about the gap: it catches a
 * BACKWARD-pointing entry, which is incoherent, but it cannot catch a genuine
 * prerequisite moved out of `uses[]` into `foreshadows[]` to clear a red
 * `detangler-no-forward-ref`. Both point forward. That move is laundering and
 * is a review failure; no checker adjudicates it.
 */
export function checkForeshadowsPointForward(
  tsPath: string | undefined,
): CheckerResult {
  if (!tsPath || !existsSync(tsPath)) return { result: "n/a", hits: [] };
  loadChapterGraph();
  if (!_graphLoaded || !_blockPos || !_labelToChapter || !_chapterOrder)
    return { result: "n/a", hits: [] };

  const content = readFileSync(tsPath, "utf-8");
  const labelMatch = content.match(/label:\s*"([^"]+)"/);
  if (!labelMatch) return { result: "pass", hits: [] };
  const label = labelMatch[1];
  const foreshadows = parseForeshadows(content);
  if (!foreshadows.length) return { result: "n/a", hits: [] };

  const myPos = _blockPos.get(label);
  if (myPos === undefined) return { result: "pass", hits: [] }; // not listed
  const myChapter = _labelToChapter.get(label);
  const myChapterIdx = myChapter ? _chapterOrder.get(myChapter) : undefined;

  const hits: CheckerHit[] = [];
  for (const f of foreshadows) {
    const fPos = _blockPos.get(f);
    if (fPos === undefined) continue; // unresolved — `foreshadows-resolve` owns that
    const fChapter = _labelToChapter.get(f);
    if (fChapter === myChapter) {
      if (fPos < myPos)
        hits.push({
          file: tsPath,
          line: 0,
          text: `foreshadows ${f} (pos ${withinChapter(fPos)}), which appears BEFORE this block (pos ${withinChapter(myPos)}) in the chapter — a foreshadow must point forward`,
        });
      continue;
    }
    // Cross-chapter: judge by chapter order rather than absolute position.
    const fChapterIdx = fChapter ? _chapterOrder.get(fChapter) : undefined;
    if (
      myChapterIdx !== undefined &&
      fChapterIdx !== undefined &&
      fChapterIdx < myChapterIdx
    )
      hits.push({
        file: tsPath,
        line: 0,
        text: `foreshadows ${f}, which lives in an EARLIER chapter (${fChapter}) than this block (${myChapter}) — a foreshadow must point forward`,
      });
  }
  return hits.length ? { result: "fail", hits } : { result: "pass", hits: [] };
}

export function checkDetanglerNoXChapterFwd(
  _tsPath: string | undefined,
): CheckerResult {
  // TODO: same as above but at paper.ts level — verify cross-chapter
  // `uses:` refs point at an earlier chapter in `paper.ts`'s
  // ordering. n/a until wired.
  return { result: "n/a", hits: [], notes: "not implemented: stub checker" };
}

export function checkDetanglerArchimedeanWall(
  _tsPath: string | undefined,
  _leanPath: string | undefined,
): CheckerResult {
  // TODO: parse the chapter directory + classify Lean files as
  // archimedean / generic-R / mixed; verify the chapter's expected
  // wall side per the chapter-ts metadata. n/a until wired.
  return { result: "n/a", hits: [], notes: "not implemented: stub checker" };
}

// ─── detangler-block-tanglement ─────────────────────────────────
// Per-block forward-ref score: counts uses[] targets in later
// chapters + blocks in earlier chapters that reference this block.

let _chapterOrder: Map<string, number> | null = null;
let _labelToChapter: Map<string, string> | null = null;
let _usesGraph: Map<string, string[]> | null = null;
// Block label -> its author-declared `foreshadows[]`. Since 2026-08-10 these
// are INDEPENDENT of that block's `uses[]`: an entry that also appears in
// `uses[]` is a real dependency exempted from the ordering-COST metrics, and
// an entry that does not is a pure forward pointer that never enters the
// dependency graph at all. Consulted by the cost metrics only.
let _foreshadowGraph: Map<string, string[]> | null = null;
// Reverse adjacency: block label -> labels whose uses[] reference it.
// Drives the per-block in-degree metric (how foundational a block is)
// without a per-call full scan.
let _reverseUses: Map<string, string[]> | null = null;
// Memoized transitive dependency-cone sizes (label -> count), filled
// lazily by `dependencyConeSize` and reset on each graph (re)build so
// the per-block cone metric is O(1) amortised across a full sweep
// rather than re-walking the graph once per block.
let _coneSizeCache: Map<string, number> | null = null;
// Memoized longest `uses[]` dependency chain depth (label -> count of
// edges on the longest acyclic path out of the block). Back-edges
// (cycles) are skipped so depth stays well-defined on the rare cyclic
// block. A deep chain ⇒ the block sits atop a tall argument tower —
// the proof-depth proxy. Reset on each graph build.
let _depthCache: Map<string, number> | null = null;
// PageRank centrality over the `uses[]` graph (label -> score in
// [0,1], summing to ~1). Computed once per graph build by power
// iteration. High score ⇒ a foundational block many others lean on
// (a weighted refinement of raw in-degree). Reset on each build.
let _pagerank: Map<string, number> | null = null;
// Precomputed once per load: block label -> an example uses[] cycle
// path through it (only present for labels that sit on a cycle), so
// the per-block cycle check is an O(1) lookup, not a per-call DFS.
let _inCyclePath: Map<string, string[]> | null = null;
// block label -> global manifest position (chapterIndex*1e6 + index
// within the chapter's ordered sections[].blocks[]). Drives the
// same-chapter forward-ref check.
let _blockPos: Map<string, number> | null = null;
// block label -> global section id (chapterIndex*STRIDE + section index
// within the chapter's ordered sections[]). Two blocks share a section
// iff their ids match. Drives the within-section graph-energy measure:
// a forward edge ACROSS sections reflects the chapter's intentional
// face ordering (Algebraic→Geometric→…), not a reorderable local
// tangle, so graph-energy only counts WITHIN-section forward edges.
let _blockSection: Map<string, number> | null = null;
// Set true only after a *successful* graph build. Checkers gate on
// this (not on map nullability) so a missing paper manifest yields
// `n/a` rather than a false "everything passes".
let _graphLoaded = false;

// Block-position encoding: `chapterIndex * CHAPTER_POS_STRIDE + index`
// within the chapter's ordered blocks. Shared by the encoder
// (loadChapterGraph) and the decoder (`withinChapter`, used to recover
// the within-chapter index for evidence messages). Assumes fewer than
// CHAPTER_POS_STRIDE blocks per chapter.
const CHAPTER_POS_STRIDE = 1_000_000;
const withinChapter = (pos: number): number => pos % CHAPTER_POS_STRIDE;

/**
 * Where a block sits, for callers outside this module.
 *
 * Three outcomes, kept distinct on purpose. The position map is the only
 * source of block ordering in the platform, and it was private — so a consumer
 * that needed to ask "where is this block?" had to hand-roll a second manifest
 * parser. That duplication is what `fsl7` exists to prevent and what `#116`
 * finished undoing for `loadChapterGraph` itself; re-creating it one caller out
 * would be the same mistake with extra steps.
 *
 * - `ok` — the block is listed, and `pos` orders it within `chapter`.
 * - `unlisted` — the graph loaded and this label is not in any manifest.
 * - `unavailable` — the graph could not be built (no paper manifest, multi-paper
 *   folio). **Nothing is known.**
 *
 * The last two are separated because conflating them is the recurring defect in
 * this area: `checkDetanglerNoForwardRef` returns `pass` for an unpositioned
 * block, so an unbuilt graph and a clean corpus produce the same report. A new
 * consumer should not inherit that.
 */
export type BlockPlacement =
  | { status: "ok"; chapter: string; pos: number; within: number }
  | { status: "unlisted" }
  | { status: "unavailable" };

/** Placement of `label`, building the chapter graph on first call. */
export function blockPlacement(label: string): BlockPlacement {
  loadChapterGraph();
  if (!_graphLoaded || !_blockPos || !_labelToChapter) return { status: "unavailable" };
  const pos = _blockPos.get(label);
  const chapter = _labelToChapter.get(label);
  if (pos === undefined || chapter === undefined) return { status: "unlisted" };
  return { status: "ok", chapter, pos, within: withinChapter(pos) };
}

/**
 * Would an edge `from → to` be a **forward reference**?
 *
 * The rule `checkDetanglerNoForwardRef` applies, exported once rather than
 * re-derived per caller: an edge counts as forward only when both blocks sit in
 * the **same chapter** and the target comes later. A cross-chapter edge
 * reflects the paper's intended chapter order and is not a local tangle.
 *
 * `undefined` means the question could not be answered — either block unlisted,
 * or no graph. Callers must not read that as `false`; the whole point of
 * costing a proposed `uses[]` edge is to avoid silently undoing ordering work,
 * and "I could not check" is not "it is fine".
 */
export function pointsForward(from: string, to: string): boolean | undefined {
  const a = blockPlacement(from);
  const b = blockPlacement(to);
  if (a.status !== "ok" || b.status !== "ok") return undefined;
  if (a.chapter !== b.chapter) return false;
  return b.pos > a.pos;
}

function loadChapterGraph(): void {
  if (_graphLoaded) return;

  // Build into locals; publish to the module-level caches only on a
  // fully successful load.
  const chapterOrder = new Map<string, number>();
  const labelToChapter = new Map<string, string>();
  const usesGraph = new Map<string, string[]>();
  // `uses[]` PLUS `interprets` — the full editorial relation. Cycle detection
  // runs on this; the ordering measures stay on `usesGraph`.
  const editorialGraph = new Map<string, string[]>();
  // Deliberate forward references, per block. A separate adjacency (rather
  // than a per-file re-parse) so the RECEIVE side of the tanglement metric
  // can ask "did the citing block declare this?" without reading that
  // block's manifest again. Seeded with the DECLARED entries and unioned
  // with the ones derived from each `.md` once positions exist.
  const foreshadowGraph = new Map<string, string[]>();
  // Raw block labels each narrative references, pre-direction-filter.
  const mdRefs = new Map<string, string[]>();

  // Resolve the paper from the folio rather than hardcoding one. A
  // folio may hold several papers and the platform must not privilege
  // one; `soleFolioPaper` returns undefined for a multi-paper folio, in
  // which case the graph stays unloaded and every detangler checker
  // reports `n/a` instead of silently auditing nothing.
  //
  // (This previously hardcoded "quantum-observable-universe", so the
  // whole detangler axis was inert in any other folio while still
  // reporting `pass`.)
  // Chapter keys are namespaced `"<paper>/<chapter>"` so a multi-paper
  // folio cannot collide two same-named chapters, and the global
  // chapter index keeps `blockPos` unique across papers.
  const papers = findPapers(REPO_ROOT);
  if (papers.length === 0) return; // not loaded — _graphLoaded stays false
  const slugToLabel = new Map<string, string>();
  const blockPos = new Map<string, number>();
  const blockSection = new Map<string, number>();
  let chapterIndex = 0;
  let sawAnyPaper = false;

  for (const paper of papers) {
    const paperTs = join(folioDirOf(), paper, `${paper}.ts`);
    if (!existsSync(paperTs)) continue;
    sawAnyPaper = true;
    const src = readFileSync(paperTs, "utf-8");
    const dirs = [...src.matchAll(/dir:\s*"([^"]+)"/g)].map(m => m[1]);
    const base = join(folioDirOf(), paper);

    // Reserve this paper's chapter index range up front so the block
    // scan and the position pass agree on indices.
    const firstIdx = chapterIndex;
    dirs.forEach((d, i) => chapterOrder.set(`${paper}/${d}`, firstIdx + i));
    chapterIndex += dirs.length;

    // Build label→chapter + uses[] adjacency + slug→label by scanning
    // all block .ts. (slug = filename without .ts; the chapter manifests
    // order blocks by slug, while uses[] reference labels.)
    for (const dir of dirs) {
      const chDir = join(base, dir);
      if (!existsSync(chDir)) continue;
      try {
        const files = readdirSync(chDir);
        for (const f of files) {
          if (!f.endsWith(".ts") || f === `${dir}.ts`) continue;
          const content = readFileSync(join(chDir, f), "utf-8");
          const m = content.match(/label:\s*"([^"]+)"/);
          if (m) {
            labelToChapter.set(m[1], `${paper}/${dir}`);
            slugToLabel.set(f.slice(0, -3), m[1]);
            // Record the block's `uses:[...]` dependency edges (only the
            // uses array — NOT cites/own-label) for ordering measures.
            // De-duplicate: a block listing the same `uses:` label twice
            // must not inflate out-degree / in-degree / cone size — count
            // unique dependency edges only.
            const useLabels = [
              ...new Set(parseManifestStringArray(content, "uses")),
            ];
            usesGraph.set(m[1], useLabels);
            // The EDITORIAL adjacency additionally carries `interprets`, which
            // is an editorial dependency too (bean `i8ad`). Kept separate from
            // `usesGraph` on purpose: cycle detection must see the whole
            // relation, while the forward-reference count stays on `uses[]`
            // alone. Merging them would move a gate five merged PRs were
            // measured against, and that is a separate decision.
            const interpretsTarget = parseStringField(content, "interprets");
            editorialGraph.set(
              m[1],
              interpretsTarget && !useLabels.includes(interpretsTarget)
                ? [...useLabels, interpretsTarget]
                : useLabels,
            );
            foreshadowGraph.set(m[1], parseForeshadows(content));
            // Collect the narrative's raw block references now; the
            // forward/backward split needs positions, which are built in the
            // pass below. Missing .md is normal for some kinds and is not an
            // error here.
            try {
              mdRefs.set(
                m[1],
                parseMdBlockRefs(
                  readFileSync(join(chDir, `${f.slice(0, -3)}.md`), "utf-8"),
                ),
              );
            } catch {
              /* no .md sibling */
            }
          }
        }
      } catch {}
    }

    // Build label→position from each chapter manifest's ordered
    // `sections[].blocks[]` slug lists.
    dirs.forEach((dir, i) => {
      const ci = firstIdx + i;
      const manifestPath = join(base, dir, `${dir}.ts`);
      if (!existsSync(manifestPath)) return;
      // Read via the masking parser, not a regex over the raw text. The
      // position map is what `detangler-no-forward-ref` and its siblings run
      // on, and a block with no position reads as "not listed" and returns
      // `pass` — so a mis-parse here does not produce a wrong answer, it
      // produces a silent absence of checking.
      const mc = readFileSync(manifestPath, "utf-8");
      let within = 0;
      let sectionIdx = 0;
      for (const slugs of parseManifestStringArrays(mc, "blocks")) {
        for (const slug of slugs) {
          const lbl = slugToLabel.get(slug);
          if (lbl && !blockPos.has(lbl)) {
            blockPos.set(lbl, ci * CHAPTER_POS_STRIDE + within);
            blockSection.set(lbl, ci * CHAPTER_POS_STRIDE + sectionIdx);
          }
          within++;
        }
        sectionIdx++;
      }
    });
  }

  if (!sawAnyPaper) return; // no paper manifest resolved — stays unloaded

  // Build the reverse adjacency (label -> users) once so per-block
  // in-degree is an O(1) lookup rather than a full corpus scan.
  const reverseUses = new Map<string, string[]>();
  for (const [user, deps] of usesGraph) {
    for (const dep of deps) {
      const arr = reverseUses.get(dep);
      if (arr) arr.push(user);
      else reverseUses.set(dep, [user]);
    }
  }

  // Precompute EDITORIAL cycle membership ONCE: for each label on a
  // dependency cycle, store an example back-to-self path. Per-block
  // checks then become an O(1) lookup.
  //
  // Runs on `editorialGraph`, not `usesGraph`. A cycle through an `interprets`
  // edge is just as circular for a reader — "read A before B and B before A" —
  // and one such cycle sat undetected in the corpus because this scan could
  // not see that leg (`rem:frobenius-packing-density` interprets
  // `conj:mass-volume-factorization`, which `uses` it back).
  const inCyclePath = new Map<string, string[]>();
  for (const start of editorialGraph.keys()) {
    const visited = new Set<string>([start]);
    const path: string[] = [start];
    const dfs = (node: string): string[] | null => {
      for (const next of editorialGraph.get(node) ?? []) {
        if (next === start) return [...path, start];
        if (!visited.has(next)) {
          visited.add(next);
          path.push(next);
          const found = dfs(next);
          if (found) return found;
          path.pop();
        }
      }
      return null;
    };
    const cyc = dfs(start);
    if (cyc) inCyclePath.set(start, cyc);
  }

  // PageRank over the uses[] graph by power iteration. Nodes = all
  // labels appearing as a block or as a dependency target. An edge
  // b -> d (block depends on d) contributes rank mass to d, so a
  // heavily-depended-on foundational block accrues a high score.
  const nodes = new Set<string>([...usesGraph.keys()]);
  for (const deps of usesGraph.values()) for (const d of deps) nodes.add(d);
  const N = nodes.size;
  const pagerank = new Map<string, number>();
  if (N > 0) {
    const damping = 0.85;
    const base = (1 - damping) / N;
    for (const n of nodes) pagerank.set(n, 1 / N);
    for (let iter = 0; iter < 40; iter++) {
      const next = new Map<string, number>();
      for (const n of nodes) next.set(n, base);
      let dangling = 0;
      for (const n of nodes) {
        const outs = usesGraph.get(n) ?? [];
        if (outs.length === 0) dangling += pagerank.get(n)! / N;
        else {
          const share = (damping * pagerank.get(n)!) / outs.length;
          for (const d of outs) next.set(d, (next.get(d) ?? base) + share);
        }
      }
      // Redistribute dangling-node mass uniformly (standard PageRank).
      if (dangling > 0)
        for (const n of nodes)
          next.set(n, next.get(n)! + damping * dangling);
      for (const [k, v] of next) pagerank.set(k, v);
    }
  }

  // Union the DERIVED forward pointers into the declared ones. Runs here
  // rather than in the block loop because the forward/backward split needs
  // `blockPos`, which is only complete once every chapter manifest has been
  // walked.
  //
  // Derivation is done from source on every load rather than read from the
  // generated `foreshadows.json`, so a stale or absent artifact can never
  // change a checker's verdict. The JSON is an emission for humans and other
  // tools, not an input.
  {
    const posOf = (l: string) => blockPos.get(l);
    // Every block the walk saw is a key here, so this doubles as the
    // "is this a real label?" test — an unresolvable reference in prose is
    // dropped rather than becoming a phantom pointer.
    const known = (l: string) => labelToChapter.has(l);
    for (const [label, refs] of mdRefs) {
      const myPos = blockPos.get(label);
      if (myPos === undefined) continue;
      const uses = new Set(usesGraph.get(label) ?? []);
      const derived = refs.filter(
        (t) =>
          t !== label &&
          !uses.has(t) &&
          known(t) &&
          (posOf(t) ?? -1) > myPos,
      );
      if (!derived.length) continue;
      foreshadowGraph.set(
        label,
        [...new Set([...(foreshadowGraph.get(label) ?? []), ...derived])],
      );
    }
  }

  _chapterOrder = chapterOrder;
  _labelToChapter = labelToChapter;
  _usesGraph = usesGraph;
  _foreshadowGraph = foreshadowGraph;
  _reverseUses = reverseUses;
  _coneSizeCache = new Map();
  _depthCache = new Map();
  _pagerank = pagerank;
  _inCyclePath = inCyclePath;
  _blockPos = blockPos;
  _blockSection = blockSection;
  _graphLoaded = true;
}

// Longest acyclic `uses[]` dependency chain out of a block (edge
// count). Recursive memoized DFS with an on-stack guard so a rare
// dependency cycle does not loop forever (back-edges contribute 0).
// Recursion depth is bounded by the longest dependency chain (tens of
// levels on this corpus), so it is stack-safe. Memoized in
// `_depthCache`, so amortised O(1) per block across a sweep.
function dependencyDepth(start: string): number {
  if (!_usesGraph) return 0;
  const cached = _depthCache?.get(start);
  if (cached !== undefined) return cached;
  const onStack = new Set<string>();
  const compute = (node: string): number => {
    const memo = _depthCache?.get(node);
    if (memo !== undefined) return memo;
    if (onStack.has(node)) return 0; // back-edge: don't extend depth
    onStack.add(node);
    let best = 0;
    for (const dep of _usesGraph!.get(node) ?? []) {
      const d = 1 + compute(dep);
      if (d > best) best = d;
    }
    onStack.delete(node);
    _depthCache?.set(node, best);
    return best;
  };
  return compute(start);
}

// Transitive `uses[]` dependency-cone size from a starting label:
// the count of distinct blocks reachable by following uses[] edges
// (excluding the start itself). A large cone means "much breaks if
// this block changes" — the downstream-impact proxy used by the
// dependency-graph section of CLAUDE.md.
function dependencyConeSize(start: string): number {
  if (!_usesGraph) return 0;
  const cached = _coneSizeCache?.get(start);
  if (cached !== undefined) return cached;
  const seen = new Set<string>();
  const stack = [...(_usesGraph.get(start) ?? [])];
  while (stack.length) {
    const node = stack.pop()!;
    if (node === start || seen.has(node)) continue;
    seen.add(node);
    for (const next of _usesGraph.get(node) ?? []) {
      if (next !== start && !seen.has(next)) stack.push(next);
    }
  }
  _coneSizeCache?.set(start, seen.size);
  return seen.size;
}

export function checkDetanglerBlockTanglement(
  tsPath: string | undefined,
): CheckerResult & { metrics?: Record<string, number | string> } {
  if (!tsPath || !existsSync(tsPath)) return { result: "pass", hits: [] };

  loadChapterGraph();
  if (!_chapterOrder || !_labelToChapter) return { result: "n/a", hits: [] };

  const content = readFileSync(tsPath, "utf-8");
  const labelMatch = content.match(/label:\s*"([^"]+)"/);
  if (!labelMatch) return { result: "pass", hits: [] };
  const label = labelMatch[1];

  // Determine this block's chapter
  // Chapter key is `"<paper>/<chapter>"`, matching loadChapterGraph's
  // namespacing — a multi-paper folio must not collide two same-named
  // chapters. Platform-aware split: `relative()` yields `\` on Windows.
  const relSeg = relative(folioDirOf(), tsPath).split(/[\\/]/);
  const thisChapter = relSeg.length >= 2 ? `${relSeg[0]}/${relSeg[1]}` : relSeg[0];
  const thisIdx = _chapterOrder.get(thisChapter) ?? 999;

  // Count forward refs emitted: LOGICAL dependencies (`uses[]`) whose
  // target lives in a later chapter. Use the parsed `_usesGraph`
  // adjacency, NOT a raw label scan of the whole .ts — the latter also
  // matches `examples:` / `cites:` / `interprets:` pointers, which are
  // illustrative/back-references, not logical forward dependencies, and
  // over-count the tangle (e.g. a prop listing later-chapter example
  // remarks is not a dependency tangle). Consistent with the
  // graph-energy and no-forward-ref checkers, which key off `uses[]`.
  const uses = _usesGraph?.get(label) ?? [];
  // Declared foreshadows are zero-cost on BOTH sides of this metric, for
  // the same reason they are zero-energy: tanglement scores reader burden,
  // and a signposted forward reference imposes none.
  const myForeshadows = new Set(_foreshadowGraph?.get(label) ?? []);
  let fwdEmitted = 0;
  const hits: CheckerHit[] = [];
  for (const u of uses) {
    if (myForeshadows.has(u)) continue;
    const tgtCh = _labelToChapter.get(u);
    if (tgtCh && (_chapterOrder.get(tgtCh) ?? 0) > thisIdx) {
      fwdEmitted++;
      hits.push({ file: tsPath, line: 0, text: `emits fwd-ref to ${tgtCh}: ${u}` });
    }
  }

  // Receive-side: blocks in EARLIER chapters that reference this label
  // (now an O(1) reverse-index lookup, not a deferred full scan).
  let fwdReceived = 0;
  for (const user of _reverseUses?.get(label) ?? []) {
    // Symmetric to the emit side: if the EARLIER block declared this
    // reference a foreshadow, the edge is signposted and costs its target
    // nothing either. Without this the author would clear the citing
    // block's score and still see the cost reappear on the cited one.
    if ((_foreshadowGraph?.get(user) ?? []).includes(label)) continue;
    const userCh = _labelToChapter.get(user);
    if (userCh && (_chapterOrder.get(userCh) ?? 999) < thisIdx) fwdReceived++;
  }

  // ── Structural graph metrics (canonical uses[] adjacency) ──────
  // out-degree = direct dependency fan-out; in-degree = how many
  // blocks build on this one (fan-in / "foundational-ness");
  // cone-size = transitive downstream-impact blast radius;
  // edge-span = the manifest-position distance of this block's
  // same-chapter dependency edges (max + mean), the magnitude that
  // bare forward-ref counts miss.
  const outDegree = (_usesGraph?.get(label) ?? []).length;
  const inDegree = (_reverseUses?.get(label) ?? []).length;
  const coneSize = dependencyConeSize(label);
  // depth = longest dependency chain (proof-depth proxy); pagerank =
  // weighted centrality (refines in-degree by who depends on you).
  const depth = dependencyDepth(label);
  const pagerank =
    Math.round((_pagerank?.get(label) ?? 0) * 1e6) / 1e6;

  const myPos = _blockPos?.get(label);
  const spans: number[] = [];
  if (myPos !== undefined) {
    for (const u of _usesGraph?.get(label) ?? []) {
      if (_labelToChapter.get(u) !== thisChapter) continue; // same-chapter only
      const uPos = _blockPos?.get(u);
      if (uPos !== undefined) spans.push(Math.abs(myPos - uPos));
    }
  }
  const edgeSpanMax = spans.length ? Math.max(...spans) : 0;
  const edgeSpanMean = spans.length
    ? Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 100) / 100
    : 0;

  const score = fwdEmitted; // emit-side cross-chapter forward refs
  const result = score >= 4 ? "fail" : score >= 1 ? "warn" : "pass";

  return {
    result,
    hits: hits.slice(0, 10),
    metrics: {
      fwd_emitted: fwdEmitted,
      fwd_received: fwdReceived,
      tanglement_score: score,
      out_degree: outDegree,
      in_degree: inDegree,
      cone_size: coneSize,
      depth: depth,
      pagerank: pagerank,
      edge_span_max: edgeSpanMax,
      edge_span_mean: edgeSpanMean,
      worst_target: hits[0]?.text ?? "",
    },
  };
}

// ─── detangler-graph-energy ─────────────────────────────────────
// Per-block contribution to the chapter's graph energy
//   E(b) = Σ_{d ∈ uses(b), pos(d) > pos(b)} (pos(d) − pos(b))
// summed over SAME-chapter dependency edges that point *forward* in
// the manifest order (i.e. backward edges in the dependency DAG — the
// reader must skip ahead). Where `detangler-no-forward-ref` is a
// binary count, energy weights each forward edge by how far it
// reaches: one definition used 30 blocks later is a worse tangle than
// one used 2 blocks later. Mirrors the `chapter-complexity-review`
// graph-energy metric, projected onto a single block.
export function checkDetanglerGraphEnergy(
  tsPath: string | undefined,
): CheckerResult & { metrics?: Record<string, number | string> } {
  if (!tsPath || !existsSync(tsPath)) return { result: "pass", hits: [] };
  loadChapterGraph();
  if (!_graphLoaded || !_blockPos || !_usesGraph || !_labelToChapter)
    return { result: "n/a", hits: [] };

  const content = readFileSync(tsPath, "utf-8");
  const labelMatch = content.match(/label:\s*"([^"]+)"/);
  if (!labelMatch) return { result: "pass", hits: [] };
  const label = labelMatch[1];
  const myPos = _blockPos.get(label);
  if (myPos === undefined) return { result: "pass", hits: [] };
  const mySection = _blockSection?.get(label);

  // A declared foreshadow costs ZERO energy. Energy measures the burden a
  // forward edge puts on a reader who must jump ahead to follow the block;
  // a foreshadow imposes no such burden, because the prose has told the
  // reader the material is coming and does not ask them to go now. Leaving
  // these in would bill the author for the very device that removes the
  // cost, and would push the "reorder me" signal toward orderings that
  // delete a deliberate rhetorical thread.
  //
  // Same exemption, same source of truth, as `detangler-no-forward-ref`
  // above — and it is an exemption from the *cost*, never from the *edge*:
  // the dependency stays in `uses[]` and still counts for cycle detection,
  // dependency cones, and chain depth.
  const foreshadowed = new Set(parseForeshadows(content));

  let energy = 0;
  let fwdEdges = 0;
  let worstSpan = 0;
  const hits: CheckerHit[] = [];
  for (const u of _usesGraph.get(label) ?? []) {
    if (foreshadowed.has(u)) continue;
    // Count only WITHIN-section forward edges. A forward edge that
    // crosses a section boundary reflects the chapter's intentional
    // face ordering (e.g. a Geometric-face block citing an Archimedean-
    // face result) — not a tangle a within-section reorder can fix, so
    // it would be a false "reorder me" signal. Same-section forward
    // edges ARE locally reorderable and are the actionable tangle.
    if (mySection === undefined || _blockSection?.get(u) !== mySection)
      continue;
    const uPos = _blockPos.get(u);
    if (uPos !== undefined && uPos > myPos) {
      const span = uPos - myPos;
      energy += span;
      fwdEdges++;
      if (span > worstSpan) worstSpan = span;
      hits.push({
        file: tsPath,
        line: 0,
        text: `within-section forward edge to ${u} spans ${span} manifest positions`,
      });
    }
  }

  // 0 → pass; any forward edge → warn; deep tangle (≥ 100, i.e. far
  // above the corpus median non-zero energy of ~18) → fail. The metrics
  // payload records the exact energy regardless, so the verdict gates
  // only the pathological cases while the measure is always available.
  const result = energy === 0 ? "pass" : energy >= 100 ? "fail" : "warn";
  return {
    result,
    hits: hits.slice(0, 10),
    metrics: {
      graph_energy: energy,
      fwd_edge_count: fwdEdges,
      worst_span: worstSpan,
    },
  };
}

// ─── detangler-topic-coherence ──────────────────────────────────
// Keyword-based topic-fit heuristic, ported from
// `pipeline/block-density-audit.py` (multi-topic check R-?).
// A block whose prose scores more chapter-keyword hits for some OTHER
// chapter than for its own home chapter is a candidate for relocation
// or splitting. Soft (warn) — keyword overlap is noisy — but the
// metrics payload records the scores so a reviewer can adjudicate.
/**
 * Chapter topic-keyword profiles, loaded from FOLIO-SUPPLIED data.
 *
 * This table used to be a literal in this file, keyed by one folio's
 * chapter directory names and filled with that folio's vocabulary — so
 * `detangler-topic-coherence` was permanently `n/a` for every other
 * folio while appearing to be a platform feature.
 *
 * A folio now supplies `content/<paper>/topic-keywords.json`:
 *
 *   { "$schema": "topic-keywords/v1",
 *     "chapters": { "<chapter-dir>": ["keyword", ...] } }
 *
 * Absent ⇒ the checker reports `n/a`, which is the honest answer: no
 * keyword profile means no basis for judging topic fit. A sample lives
 * at `pipeline/topic-keywords/` for reference.
 *
 * Merged across every paper in the folio; keys are bare chapter
 * directory names, matching how `homeChapter` is derived.
 */
let _topicKeywords: Record<string, string[]> | null = null;

function topicKeywords(): Record<string, string[]> {
  if (_topicKeywords) return _topicKeywords;
  const merged: Record<string, string[]> = {};
  for (const paper of findPapers(REPO_ROOT)) {
    const f = join(folioDirOf(), paper, "topic-keywords.json");
    if (!existsSync(f)) continue;
    try {
      const parsed = JSON.parse(readFileSync(f, "utf-8"));
      for (const [ch, kws] of Object.entries(parsed.chapters ?? {})) {
        if (Array.isArray(kws)) merged[ch] = kws as string[];
      }
    } catch {
      // A malformed profile is "no profile" — never a silent partial.
    }
  }
  _topicKeywords = merged;
  return merged;
}


// Topic-coherence is only meaningful signal for LOAD-BEARING logical
// blocks: a `definition`/`proposition`/`theorem`/`lemma`/`corollary`
// whose prose is mostly about another chapter's topic is a genuine
// misplacement. Interpretive/narrative kinds (`remark`, `example`,
// `prose`, `proof`, `diagram`, `simulator`, `conjecture`) reference
// upstream concepts by nature, so flagging them is noise — they are
// excluded (n/a). Empirically, restricting to these kinds + requiring
// a clear margin cut a 153-warn dragnet (61 remarks, 79 in the
// cross-cutting observations chapter) down to genuine signal.
const TOPIC_COHERENCE_KINDS = new Set([
  "definition",
  "proposition",
  "theorem",
  "lemma",
  "corollary",
]);

export function checkDetanglerTopicCoherence(
  mdPath: string | undefined,
): CheckerResult & { metrics?: Record<string, number | string> } {
  if (!mdPath || !existsSync(mdPath)) return { result: "n/a", hits: [] };
  // Read the block kind from the .ts sibling; only audit load-bearing
  // logical kinds (see TOPIC_COHERENCE_KINDS rationale above). Blocks
  // declare their kind in one of two forms — an explicit `kind: "x"`
  // field OR a builder call `export default <kind>({ ... })` (the
  // builder name IS the kind). Detect both, matching the convention in
  // block-density-audit.py.
  const tsPath = mdPath.replace(/\.md$/, ".ts");
  if (existsSync(tsPath)) {
    const tsSrc = readFileSync(tsPath, "utf-8");
    const kindM =
      tsSrc.match(/kind:\s*"([^"]+)"/) ||
      tsSrc.match(/export\s+default\s+(\w+)\s*\(/);
    if (kindM && !TOPIC_COHERENCE_KINDS.has(kindM[1]))
      return { result: "n/a", hits: [] };
  }
  const content = readFileSync(mdPath, "utf-8");
  const nonBlank = content.split("\n").filter((l) => l.trim().length > 0);
  // Match the Python gate: only audit substantive blocks (> 20 lines);
  // short blocks rarely accumulate enough keyword signal to judge.
  if (nonBlank.length <= 20) return { result: "n/a", hits: [] };

  // Bare chapter name here (not the `paper/chapter` key): the keyword
  // table below is keyed by chapter directory name.
  const homeSeg = relative(folioDirOf(), mdPath).split(/[\\/]/);
  const homeChapter = homeSeg.length >= 2 ? homeSeg[1] : homeSeg[0]; // platform-aware (relative() yields `\` on Windows)
  // If we have no keyword profile for the home chapter we cannot judge
  // coherence — its home score is structurally 0, so ANY other-chapter
  // hit would spuriously "win". Report n/a rather than a false warn.
  // (The ported keyword map predates some current chapters, e.g.
  // particle-interactions; absence ⇒ undecidable, not a mismatch.)
  const KEYWORDS = topicKeywords();
  if (!(homeChapter in KEYWORDS))
    return { result: "n/a", hits: [] };
  const lower = content.toLowerCase();

  const scores: Record<string, number> = {};
  for (const [ch, kws] of Object.entries(KEYWORDS)) {
    let hits = 0;
    for (const kw of kws) if (lower.includes(kw.toLowerCase())) hits++;
    if (hits > 0) scores[ch] = hits;
  }
  const homeScore = scores[homeChapter] ?? 0;

  let topOther = "";
  let topOtherScore = 0;
  for (const [ch, s] of Object.entries(scores)) {
    if (ch !== homeChapter && s > topOtherScore) {
      topOther = ch;
      topOtherScore = s;
    }
  }

  // Require a CLEAR margin (≥ 3 more hits than home), not a bare tie-
  // break: "4 vs 3" is within keyword-overlap noise, "6 vs 1" is a real
  // misplacement. `top_other_score >= home_score + 3` filters borderline
  // cases the bare `>` rule let through.
  const mismatch =
    topOtherScore >= 3 && topOtherScore >= homeScore + 3;
  const hits: CheckerHit[] = mismatch
    ? [
        {
          file: mdPath,
          line: 0,
          text: `${topOtherScore} keyword hits for '${topOther}' but only ${homeScore} for home chapter '${homeChapter}'`,
        },
      ]
    : [];
  return {
    result: mismatch ? "warn" : "pass",
    hits,
    metrics: {
      home_chapter: homeChapter,
      home_score: homeScore,
      top_other_chapter: topOther || "(none)",
      top_other_score: topOtherScore,
    },
  };
}

// Dependency-cycle detector: a `uses[]` cycle through this block.
// Unlike `detangler-no-forward-ref` (a position check that a reorder
// can satisfy), a cycle is reorder-invariant — no ordering removes the
// forward edge — so it signals a genuine structural tangle (two blocks
// each `uses:` the other, or a longer loop) that needs an edge removed
// or the blocks merged. Walks the cached `uses[]` adjacency graph from
// this block's label; fails if the label is reachable from itself.
export function checkDetanglerNoDependencyCycle(
  tsPath: string | undefined,
): CheckerResult {
  if (!tsPath || !existsSync(tsPath)) return { result: "pass", hits: [] };
  loadChapterGraph();
  if (!_graphLoaded || !_inCyclePath) return { result: "n/a", hits: [] };

  const content = readFileSync(tsPath, "utf-8");
  const labelMatch = content.match(/label:\s*"([^"]+)"/);
  if (!labelMatch) return { result: "pass", hits: [] };

  const cyclePath = _inCyclePath.get(labelMatch[1]);
  if (cyclePath) {
    return {
      result: "fail",
      hits: [
        {
          file: tsPath,
          line: 0,
          text:
            `editorial dependency cycle (uses[] + interprets): ` +
            `${cyclePath.join(" -> ")}`,
        },
      ],
    };
  }
  return { result: "pass", hits: [] };
}

// ─── Voice: content-block titles must be scholarly ─────────────
//
// Extract the `title:` field from the .ts manifest and flag
// non-scholarly forms: questions, first-person, second-person,
// imperatives, and casual aside markers.

const TITLE_FIELD_RE = /\btitle:\s*(?:"([^"]+)"|'([^']+)')/;

const NON_SCHOLARLY_TITLE_PATTERNS: Array<{
  re: RegExp;
  what: string;
}> = [
  { re: /\?$/, what: "ends in '?' — title is a question" },
  {
    re: /^\s*(?:relation(?:ship)?|connection|link)\s+(?:to|with|between)\b/i,
    what: "relational header — retitle to a noun phrase naming the subject",
  },
  {
    re: /^\s*(?:Why|What|How|When|Whether)\b/i,
    what: "interrogative / rhetorical opener — use a declarative noun phrase",
  },
  {
    re: /^\s*(?:Compute|Derive|Show|Prove|Recall|Consider)\b/i,
    what: "imperative opener — name the result, not the instruction",
  },
  {
    re: /^(?:Why|How(?:\s+does|\s+do|\s+can|\s+is|\s+are|\s+to)|What(?:\s+is|\s+are|\s+does|\s+do|\s+if)|When|Where|Should|Could|Would|Do(?:es)?|Is|Are|Can)\b/i,
    what: "starts with a question word",
  },
  {
    // Note: apostrophe REQUIRED for contractions ("I'll", "we'll", "I'm") —
    // the bare-letter forms (`Ill`, `well`, `Im`) trigger false positives on
    // common math/text (e.g. "well-separated", "$\mathrm{Im}(q)$"). The
    // multi-word phrasings ("let us", "I will", "we are") stay literal.
    re: /\b(?:I['’]ll|we['’]ll|let['’]s|let\s+us|I['’]m|we['’]re|I\s+(?:will|am)|we\s+(?:will|are))\b/i,
    what: "first-person aside in the title",
  },
  {
    re: /\b(?:you['’]ll|you['’]re|your|you\s+(?:can|will|might|should|may))\b/i,
    what: "second-person address in the title",
  },
  {
    re: /^(?:Quick (?:note|aside|check|look)|TODO|FIXME|WIP|Note|Sidebar|Footnote|Punt|Stub|Placeholder)\b/i,
    what: "casual / status-leak marker in the title",
  },
  {
    re: /\bobviously|clearly|simply|trivially|easily|naturally\b/i,
    what: "editorializing adverb in the title",
  },
  {
    re: /\bhopefully|maybe|probably|perhaps|possibly\b/i,
    what: "hedge in the title — titles state, not speculate",
  },
];

export function checkVoiceTitleScholarly(
  tsPath: string | undefined,
): CheckerResult {
  if (!tsPath) return { result: "n/a", hits: [] };
  const text = readMaybe(tsPath);
  if (!text) return { result: "n/a", hits: [] };
  const m = text.match(TITLE_FIELD_RE);
  if (!m) return { result: "n/a", hits: [] };
  const title = m[1] ?? m[2] ?? "";
  if (!title) return { result: "n/a", hits: [] };
  const hits: CheckerHit[] = [];
  for (const { re, what } of NON_SCHOLARLY_TITLE_PATTERNS) {
    if (re.test(title)) {
      // Find the line containing the title field for accurate
      // reporting.
      const lineIdx = text
        .slice(0, m.index)
        .split("\n").length;
      hits.push({
        file: tsPath,
        line: lineIdx,
        text: `title "${title.slice(0, 100)}" — ${what}`,
      });
    }
  }
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

// ─── Voice: statement should not contain interpretation ────────
//
// A theorem/proposition/lemma/corollary STATEMENT is the bare claim.
// Interpretation, motivation, "physical meaning", or "why this
// matters" belongs in a separate `remark` block linked via
// `interprets:`. This checker is a candidate-flagger only — the
// actual judgement (is this prose interpretation, or a legitimate
// proof sketch?) is non-mechanical and the criterion is registered
// as `automated: false`. Script returns `n/a` to queue the block
// for agent review when the candidate heading pattern fires.

const INTERPRETATION_HEADING_RE =
  /^##+\s*(Interpretation|Discussion|Motivation|Why\s+(?:this\s+matters|we\s+care)|Significance|Physical(?:\s+meaning|\s+interpretation)?|Meaning|Commentary|Aside|Reading|Intuition)/im;

export function checkVoiceStatementNoInterpretation(
  mdPath: string | undefined,
): CheckerResult {
  if (!mdPath) return { result: "n/a", hits: [] };
  const text = readMaybe(mdPath);
  if (!text) return { result: "n/a", hits: [] };
  // Agent-only criterion. Script returns `n/a` ALWAYS so the sidecar
  // is marked needs-agent on every applicable block; an agent /
  // human reviewer entry supersedes. BUT — when the candidate
  // heading pattern fires, append a hint to the agent's queue via
  // the `hits[]` payload so the agent knows where to look.
  const m = text.match(INTERPRETATION_HEADING_RE);
  if (!m) return { result: "n/a", hits: [] };
  const idx = text.slice(0, m.index).split("\n").length;
  return {
    result: "n/a",
    hits: [
      {
        file: mdPath,
        line: idx,
        text:
          `candidate '${m[0].trim()}' heading at line ${idx} — agent should ` +
          `review whether the section's content is interpretation that ` +
          `belongs in a separate remark block`,
      },
    ],
  };
}

// ─── Dispatch map ───────────────────────────────────────────────

export const EXTENDED_AUTOMATED_CHECKERS: Record<
  string,
  (paths: CheckerPaths) => CheckerResult
> = {
  // profile conformance — bean `0bzg`; its own criterion, never folded into
  // the schema verdict, because it answers what schema validation cannot reach.
  "profile-conformance": (p) => checkProfileConformance(p.ts),
  // bibliography
  "bib-cite-resolves": (p) => checkBibCiteResolves(p.md, p.lean),
  "bib-cited-ref-has-url": (p) => checkBibCitedRefHasUrl(p.md, p.lean),
  "bib-cited-ref-metadata-ok": (p) =>
    checkBibCitedRefMetadataOk(p.md, p.lean),
  "bib-cited-ref-has-screenshot": (p) =>
    checkBibCitedRefHasScreenshot(p.md, p.lean),
  // detangler
  "detangler-section-band": (p) => checkDetanglerSectionBand(p.ts),
  "detangler-no-forward-ref": (p) => checkDetanglerNoForwardRef(p.ts),
  "foreshadows-point-forward": (p) => checkForeshadowsPointForward(p.ts),
  "detangler-no-xchapter-fwd": (p) => checkDetanglerNoXChapterFwd(p.ts),
  "detangler-archimedean-wall": (p) =>
    checkDetanglerArchimedeanWall(p.ts, p.lean),
  "detangler-block-tanglement": (p) => checkDetanglerBlockTanglement(p.ts),
  "detangler-graph-energy": (p) => checkDetanglerGraphEnergy(p.ts),
  "detangler-topic-coherence": (p) => checkDetanglerTopicCoherence(p.md),
  "detangler-no-dependency-cycle": (p) =>
    checkDetanglerNoDependencyCycle(p.ts),
  // voice
  "voice-title-scholarly": (p) => checkVoiceTitleScholarly(p.ts),
  "voice-statement-no-interpretation": (p) =>
    checkVoiceStatementNoInterpretation(p.md),
};
