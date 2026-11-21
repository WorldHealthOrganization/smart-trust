/**
 * Automated checkers for the `voice-*` QA criteria (and
 * `cite-named-theorem`). Each checker returns `result: "pass" | "fail"` plus
 * (on fail) evidence in the form `file:line: <quote>`.
 *
 * Coverage:
 *
 * - Eight voice criteria are now fully automated: status-leak,
 *   emoji-content, first-person-work, time-stamped-notes,
 *   unicode-crash, editorializing, **ai-slop** (heuristic LLM-tell
 *   detection), and **scholarly-default** (second-person address +
 *   lecturer cadence + past-tense narration).
 * - `framework-canonical`, `wall-side-correct` and
 *   `wall-base-ring-minimal` are automated in the science layer, which
 *   contributes them (bean saqd, row 9; see the note above
 *   `ARCHIMEDEAN_TYPE_RE`).
 * - Only `fit-section-chapter` remains agent-only — it requires
 *   semantic block-vs-section reasoning that no lexical heuristic
 *   captures faithfully.
 *
 * The automated checkers are conservative — they prefer
 * false-positive `fail` over false-negative `pass`. Agent entries
 * appended later via `qa-merge-findings.ts` overrule the script
 * entries when the script is being overzealous.
 *
 * @module pipeline/qa-checkers-voice
 */

import { readFileSync, existsSync } from "fs";
import type { CheckerPaths } from "../schemas/sdlc/block-qa.ts";

export interface CheckerHit {
  file: string;
  line: number;
  text: string;
}

export interface CheckerResult {
  result: "pass" | "fail" | "warn" | "n/a";
  hits: CheckerHit[];
  /**
   * Optional human-readable context threaded into the sidecar entry's
   * `notes` field (e.g. a cache-staleness reason). Kept structurally
   * identical to the `CheckerResult` in `qa-checkers-extended.ts` so
   * the merged `AUTOMATED_CHECKERS` registry stays type-compatible.
   */
  notes?: string;
  /**
   * Optional structured numeric/heuristic measures persisted into the
   * sidecar entry's `metrics` field. Kept structurally identical to the
   * `CheckerResult` in `qa-checkers-extended.ts` so the merged
   * `AUTOMATED_CHECKERS` registry stays type-compatible; the detangler
   * checkers populate it.
   */
  metrics?: Record<string, number | string>;
}

function readLines(path: string): string[] {
  return readSource(path).lines;
}

/**
 * Read a file once and return both the whole-file string and the
 * line array. Centralised so every checker uses the same access
 * pattern (avoids duplicate `readFileSync` calls + ambiguous
 * "line vs source" handling). Returns empty when the file is
 * absent so callers can treat missing input as a pass.
 */
function readSource(path: string): { src: string; lines: string[] } {
  if (!existsSync(path)) return { src: "", lines: [] };
  const src = readFileSync(path, "utf-8");
  return { src, lines: src.split("\n") };
}

function scan(
  path: string,
  re: RegExp,
  filter?: (line: string, idx: number, lines: string[]) => boolean,
): CheckerHit[] {
  const lines = readLines(path);
  const hits: CheckerHit[] = [];
  lines.forEach((l, i) => {
    if (re.test(l)) {
      if (filter && !filter(l, i, lines)) return;
      hits.push({ file: path, line: i + 1, text: l.trim().slice(0, 200) });
    }
  });
  return hits;
}

// ── voice-status-leak ───────────────────────────────────────────

// Work-tracker / implementation-status markers that never belong in the
// manuscript — in ANY block kind, conjectures included.
const STATUS_LEAK_RE =
  /(\*\*Done\*\*|\*\*Completed\*\*|\*\*Pending\*?\*?|\*\*Blocked\*?\*?|\*\*Deferred\*?\*?|\*\*In progress\*?\*?|\*\*Punted\*?\*?|\(TODO\)|\(TBD\)|\(TBA\)|\(WIP\)|\(stub\)|\(placeholder\)|\bTODO:|\bFIXME:|\bXXX:|\bHACK:|\bWIP\b|\bTO-DO\b|\bTBD\b|\bplaceholder\b|\b(?:stub(?:bed)?|punt(?:ed|ing)?)\s+(?:for\s+now|until|pending)|\bneeds\s+(?:work|fixing|attention|review|filling\s+in)|\bkick\s+the\s+can|\bnot\s+yet\s+(?:implemented|written|filled\s+in|wired)|\bdeferred\s+via\s+sorry\b)/i;

// Derivation-status / open-status speech ("would prove the …", "pending
// the derivation", "exact closure remains open", "near-match to a
// derivation"). These belong in audit docs, NOT the paper — UNLESS the
// block is a formal `conjecture`, where stating what remains open and what
// would settle it is legitimate, author-approved content.
const OPEN_DERIVATION_RE =
  /\bwould\s+(?:cohomologically\s+)?prove\s+the\b|\bpending\s+(?:the\s+)?derivation\b|\bexact\s+closure\s+remains\s+open\b|\bnear-match\s+to\s+a\s+derivation\b/i;

/** True when the block's `.ts` manifest is `export default conjecture(...)`. */
function isConjectureBlock(tsPath?: string): boolean {
  if (!tsPath || !existsSync(tsPath)) return false;
  return /\bexport\s+default\s+conjecture\s*\(/.test(readFileSync(tsPath, "utf-8"));
}

/**
 * Mask the LABEL CELL of a definition-table row.
 *
 * A row shaped `| **Term** (qualifier) | what it means |` is a definition
 * list: the first cell names a term and the rest of the row defines it. A
 * status word inside that label is a proper noun for a process stage, not an
 * assertion about the work — `| **Needs review** (Phase 1) | Confirm the BA's
 * needs statement … |` is a row in a table OF CHECKPOINT NAMES, and flagging
 * it as a work-tracker leak is a category error of the same shape as the one
 * the profile axis fixed.
 *
 * Deliberately conservative, because a table is also a plausible place to
 * hide a real leak:
 *
 * - only the FIRST cell is masked; a status marker in the definition half of
 *   the row is still a hit;
 * - the cell must be ENTIRELY a bolded term plus an optional parenthetical.
 *   `| **Pending.** the proof is stalled |` is prose in a table and is not
 *   masked, because the cell is not purely a label.
 *
 * Same principle as {@link isConjectureBlock}: a block whose declared subject
 * is the open question is not leaking status by naming it.
 */
function maskTableLabelCell(line: string): string {
  if (!/^\s*\|/.test(line)) return line;
  const cells = line.split("|");
  // cells[0] is the empty string before the leading pipe.
  if (cells.length < 3) return line;
  const first = cells[1];
  if (/^\s*\*\*[^*]+\*\*(?:\s*\([^)]*\))?\s*$/.test(first)) cells[1] = " ";
  return cells.join("|");
}

export function checkStatusLeak(mdPath: string, tsPath?: string): CheckerResult {
  // Conjecture blocks are exempt from the open-derivation patterns (a
  // conjecture legitimately says what remains open); the hard work-tracker
  // markers apply to every block. Code fences / backticks / link URLs are
  // stripped by scanProse so a status word inside code or a filename is
  // not a prose hit.
  const re = isConjectureBlock(tsPath)
    ? STATUS_LEAK_RE
    : new RegExp(`${STATUS_LEAK_RE.source}|${OPEN_DERIVATION_RE.source}`, "i");
  const hits = scanProse(mdPath, re, maskTableLabelCell);
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

/**
 * Scan a `.md` for `re`, skipping fenced code blocks and inline
 * backtick spans (so a keyword inside a code sample is not a prose hit).
 * Shared by the prose-voice checkers below and `checkStatusLeak`'s idiom.
 */
function scanProse(
  mdPath: string,
  re: RegExp,
  /** Optional extra masking applied after code/link stripping. */
  premask?: (line: string) => string,
): CheckerHit[] {
  return scan(mdPath, re, (l, i, lines) => {
    let inFence = false;
    for (let j = 0; j < i; j++) {
      if (/^```/.test(lines[j].trim())) inFence = !inFence;
    }
    if (inFence) return false;
    // Strip code spans AND markdown link targets `](…)` / autolinks
    // `<…>` before testing — a hyphenated filename in a URL
    // (e.g. `…script-rewire-handoff.md`) is not prose and must not
    // trip a prose-vocabulary pattern.
    const stripped = l
      .replace(/`[^`]+`/g, "")
      .replace(/\]\([^)]*\)/g, "]")
      .replace(/<[^>\s]+>/g, "");
    return re.test(premask ? premask(stripped) : stripped);
  });
}

// ── voice-probe-narrative ───────────────────────────────────────
//
// Paper prose should present results, not narrate the exploratory PROBE
// that produced them. Flag experiment-writeup voice that belongs in an
// audit / probe doc, not the manuscript: an inline `witness:` reference,
// "We test whether …", "We compare N models", or "overshoots CODATA by
// N×". (The numeric conclusion stays; only the probe framing is the leak.)
// Match only unambiguous exploratory-PROBE framing. A `(witness: …)` label or
// a bare `*.witness.json` reference is NOT used: a witnessed-value citation is
// legitimate scholarly provenance, indistinguishable by regex from probe-run
// bookkeeping, so keying on it over-flags real content.
const PROBE_NARRATIVE_RE =
  /\bWe\s+test\s+whether\b|\bWe\s+compare\s+\w+\s+models?\b|\bovershoot(?:s|ing)?\b[^.]{0,40}\bCODATA\b|\bCODATA\b[^.]{0,40}\bovershoot/i;

export function checkProbeNarrative(mdPath: string): CheckerResult {
  const hits = scanProse(mdPath, PROBE_NARRATIVE_RE);
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

// ── voice-agent-speak ───────────────────────────────────────────
//
// Informal agent / working-session vocabulary that reads as slop in a
// manuscript. TIGHT token list only — deliberately excludes "keystone"
// (established paper terminology: the B1 / gb-depth-period keystone
// conjecture, 27 legitimate uses) and other domain words that a blanket
// scan would false-positive on.
const AGENT_SPEAK_RE =
  /\bwired?\s+in\b|\bun-?wir(?:e|ed|ing)\b|\brewir(?:e|ed|ing)\b|\bflip-?flops?\b|\bflip-?flopp(?:ed|ing)\b|\bwhack-?a-?mole\b|\bnumerical\s+rainbows?\b|\brabbit\s+holes?\b|\bplumbing\s+it\s+in\b/i;

export function checkAgentSpeak(mdPath: string): CheckerResult {
  const hits = scanProse(mdPath, AGENT_SPEAK_RE);
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

// ── cite-named-theorem ──────────────────────────────────────────
//
// ADVISORY (minor). A named external result invoked in prose — a
// proper-noun-attributed "X theorem / lemma / conjecture / inequality /
// duality / criterion" (e.g. "the Gröbner–Shirshov normal-form theorem",
// "Ladyzhenskaya's inequality") — should carry a citation. High-recall
// CANDIDATE detector, not a hard gate: an agent confirms whether the
// result is genuinely external-needing-a-cite vs a ubiquitous result that
// needs none. Conservative to keep noise down:
//   - only fires when the block cites NOTHING (\cite / \[key1234] / a link);
//   - excludes QOU-coined namesakes (Descartes) + tool names (Lean, …);
//   - requires a ≥3-letter capitalised proper noun.
const NAMED_RESULT_RE =
  /\b([A-Z][a-zà-öø-ÿ]{2,}(?:[-–][A-Z][a-zà-öø-ÿ]{2,})*)(?:['’]s)?\s+(theorem|lemma|conjecture|inequality|duality|criterion)\b/g;
const NAMED_RESULT_EXCLUDE =
  /^(Descartes|Lean|Mathlib|Python|Rust|Main|This|That|Our|Its|Their|First|Second|Third|Next|Last|Following|Above|Below|Same|Key|Central|Only|Both|Each|Every|Such|Above|New|Old|Left|Right|Upper|Lower|Master|Trace|Quantum|Categorical|Archimedean)$/;
const HAS_CITATION_RE = /\\cite\{|\\?\[[a-z][a-z0-9-]*\d{4}[a-z0-9-]*\]|\]\([^)]/;

export function checkCiteNamedTheorem(mdPath: string): CheckerResult {
  const { src, lines } = readSource(mdPath);
  if (!src || HAS_CITATION_RE.test(src)) return { result: "pass", hits: [] };
  const hits: CheckerHit[] = [];
  lines.forEach((raw, i) => {
    // skip code fences
    let inFence = false;
    for (let j = 0; j < i; j++) if (/^```/.test(lines[j].trim())) inFence = !inFence;
    if (inFence) return;
    const l = raw.replace(/`[^`]+`/g, "").replace(/\]\([^)]*\)/g, "]");
    for (const m of l.matchAll(NAMED_RESULT_RE)) {
      if (NAMED_RESULT_EXCLUDE.test(m[1]) || m[1].length < 4) continue;
      hits.push({ file: mdPath, line: i + 1, text: `${m[1]} ${m[2]} — named result, no citation in block` });
    }
  });
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

// ── voice-emoji-content ─────────────────────────────────────────

// Status-marker emoji that don't belong in scholarly prose. The `u`
// flag is **required**: without it, the character class compiles as
// raw UTF-16 code units, so e.g. `[🔧]` becomes `[🔧]` —
// which matches the leading surrogate \uD83D of EVERY emoji in the
// U+1F000+ plane (e.g. 🟢 🟡 🟠 ⚪), causing surprise false-
// positives. With `u` the engine treats each emoji as a single
// code-point literal and only the listed glyphs match.
const EMOJI_RE = /[✅❌⚠⏳🔧🚧☑☒✓✗★🎯🚀🔥🟢🟡🟠⚪🔴🔵🟣🟤⬛⬜]/u;

export function checkEmojiContent(mdPath: string): CheckerResult {
  // ✓ and ✗ are allowed inside table rows for compact comparison
  // markers. Any OTHER emoji in a table row (or any emoji at all in
  // body prose) is a hit.
  const hits = scan(mdPath, EMOJI_RE, (l) => {
    if (l.trim().startsWith("|")) {
      // In a table row, flag iff at least one non-✓/✗ emoji is present.
      return /[✅❌⚠⏳🔧🚧☑☒★🎯🚀🔥🟢🟡🟠⚪🔴🔵🟣🟤⬛⬜]/u.test(l);
    }
    // Body prose: every EMOJI_RE match is a hit.
    return true;
  });
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

// ── voice-first-person-work ─────────────────────────────────────

const FIRST_PERSON_WORK_RE =
  /\b(we'?ll (?:add|fix|update|do|write|put in|need to|have to)|I'?ll (?:add|fix|update|do|write|put in|now|first|need to|have to)|let me\b|let'?s\s+(?:add|fix|update|write|punt|defer|move|skip|drop)|needs more work|note to self|we should (?:fix|add|do|write|punt|defer)|TODO for me|gonna\b|going to (?:add|fix|update|write)|here'?s what (?:I|we) (?:did|will|are\s+doing)|(?:I|we) went ahead and|(?:I|we) (?:just|already) (?:added|fixed|updated|wrote)|(?:I|we) decided to)/i;

export function checkFirstPersonWork(mdPath: string): CheckerResult {
  const hits = scan(mdPath, FIRST_PERSON_WORK_RE);
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

// ── voice-time-stamped-notes ────────────────────────────────────

const TIME_STAMPED_RE =
  /\b(as of (?:20\d{2}[- ]\d{2}|today|yesterday|now)|after the (?:recent|last|previous) (?:push|merge|fix|rebase|commit|PR|review)|in the current (?:draft|state|version|implementation)|as currently (?:written|implemented|configured|stated)|prior to (?:the )?(?:recent |last |previous )?(?:fix|push|merge|commit|PR|review|rebase)|(?:yesterday|today|tomorrow|last week|this week|recently)(?:'s| )(?:fix|push|merge|update|review|commit|change|edit)|in (?:PR\s*#\s*\d+|commit\s+[a-f0-9]{7,}|the\s+(?:latest|recent)\s+(?:PR|commit))|(?:earlier|later) (?:today|this (?:week|session))|since (?:the )?(?:last|recent|previous) (?:fix|push|merge|commit|PR|rebase))\b/i;

export function checkTimeStampedNotes(mdPath: string): CheckerResult {
  const hits = scan(mdPath, TIME_STAMPED_RE);
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

// ── voice-unicode-crash ─────────────────────────────────────────

// Source of truth: `.claude/skills/local/one-voice-audit.md` §1
// item 5 + §Workflow grep. Each of these characters crashes pdflatex
// unless explicitly mapped in the preamble.
// Expanded to catch every Unicode glyph that either (a) crashes
// pdflatex when emitted as prose or (b) reliably renders wrong
// without the correct LaTeX wrapper. Includes:
//   - arrows: ↦ ↔ ⇒ ⇔ → ←
//   - super/sub digits: ⁰-⁹ ₀-₉ ⁺ ⁻
//   - operators: ·  × ÷ ± ∓ √
//   - relations: ≤ ≥ ≠ ≈ ≡ ≃ ≅
//   - logical: ¬ ∧ ∨ ∀ ∃ ∈ ∉ ⊂ ⊃ ⊆ ⊇ ∪ ∩
//   - greek-as-prose (sub-set; mostly fine inside $…$): catch in
//     prose with `\b` semantic by including a small set commonly
//     used incorrectly outside math (α, β, γ, δ at start-of-block)
//   - big-operator: ∑ ∏ ∫ ∬ ∮
//   - separator: ─ ━ ┃ │ ┄
//   - misc: ∞ ′ ″ … ™ ®
//
// `✓` / `✗` are EXEMPT inside table rows (table-cell-OK markers per
// existing convention); checkEmojiContent handles that path. This
// regex applies to body prose only — fenced code (```...```) and
// inline backtick spans (`...`) are stripped before testing.
const UNICODE_CRASH_RE =
  /[↦↔⇒⇔→←⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀₁₂₃₄₅₆₇₈₉·×÷±∓√≤≥≠≈≡≃≅¬∧∨∀∃∈∉⊂⊃⊆⊇∪∩∑∏∫∬∮─━┃┄∞′″…™®─✅❌⚠]/;

export function checkUnicodeCrash(mdPath: string): CheckerResult {
  // Skip inside fenced code blocks (```...```) AND inside backtick
  // inline code spans — neither goes through pdflatex as prose.
  // The mdast pipeline emits them as \texttt{} or verbatim macros
  // that escape the offending characters; only crash-hazard chars
  // appearing in raw prose (or math) genuinely break the build.
  const lines = readLines(mdPath);
  let inFence = false;
  const hits: CheckerHit[] = [];
  lines.forEach((l, i) => {
    if (/^```/.test(l.trim())) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    let cleanedLine = stripInlineCode(l);
    // Strip inline math ($...$) and display math ($$...$$) — Unicode
    // inside math mode is handled by the pipeline's LaTeX wrapper.
    cleanedLine = cleanedLine.replace(/\$\$[^$]*\$\$/g, "");
    cleanedLine = cleanedLine.replace(/\$[^$]*\$/g, "");
    if (UNICODE_CRASH_RE.test(cleanedLine)) {
      hits.push({ file: mdPath, line: i + 1, text: l.trim().slice(0, 200) });
    }
  });
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

// ── voice-editorializing ────────────────────────────────────────

const EDITORIALIZING_RE =
  /\b(surprisingly|remarkably|interestingly|notably|amazingly|fortunately|unfortunately|of course\b|clearly|obviously|trivially|naturally|simply|merely|just\s+(?:a|the)|easily|effortlessly|seamlessly|elegantly|beautifully|(?:perhaps )?the (?:single )?most (?:surprising|important|significant|interesting|elegant|striking|remarkable|beautiful|profound)|it is (?:worth|important|interesting|notable|easy|clear|obvious) (?:to (?:note|see|observe|point\s+out)|noting|that)|the reader (?:will|may|can) (?:appreciate|note|see|enjoy|find)|it turns out that|one might (?:expect|hope|wonder|think|imagine|suspect)|a beautiful (?:result|theorem|proof|fact|observation)|an elegant (?:proof|argument|construction|formulation)|(?:a|the) (?:truly|particularly|especially)\s+(?:beautiful|elegant|striking|surprising|remarkable)|nicely|cleanly|crisply|tidily)\b/i;

// Math-idiom exemption: a flagged adverb that modifies a math object
// is canonical mathematical language, not editorializing. Several
// patterns count:
//   (a) "naturally an algebra", "trivially zero", "just a formal map"
//       — adverb + article + math noun
//   (b) "decomposes naturally as a tensor", "factor trivially"
//       — math verb + adverb
//   (c) "naturally $\mathfrak{g}$" — adverb + math-mode region
//   (d) "non-simply-laced", "tri-cleanly", etc. — adverb as part of
//       a hyphenated compound math term
//   (e) "contribute trivially" — verb + adverb at end of clause
// Proof-economy exemption: an adverb routing the reader AWAY from a
// verification that is routine, which is the opposite move from editorializing.
// Editorializing spends the reader's attention on the author's opinion; this
// spends none and saves some.
//
// Measured on `library/milnorlink/` — Milnor, "Link Groups", Annals of
// Mathematics 59(2), 1954, the paper the `expo-milnor-clarity` strict gate is
// named after — 2026-09-19: 26 hits across 11 of its 20 pages, of which about
// twenty are this construction. Every one says "you can check this yourself,
// and I am not going to write it out":
//
//   p177  Clearly the relation of homotopy is reflexive, symmetric and transitive.
//   p179  The inclusion map (Z, hi(Y)) -> (Qi, Pi) is clearly a homotopy equivalence.
//   p181  it is easy to see that ai is unique and well-defined
//   p183  This is clear for the case n = 0.
//   p188  The associative law for multiplication is clear.
//   p193  The following set of relations is clearly equivalent
//
// Four forms, and the list is exhaustive over that corpus rather than guessed:
// sentence-initial; predicative (`is/are/was clear(ly)`); the `it is easy to
// see/verify/check` frame; and `easily` attached to a verification verb.
//
// NOT a licence for `clearly` everywhere. `clearly` before a claim the reader
// CANNOT check in their head is the real defect — the author asserting where
// they should be proving — and no phrase list separates the two. What keeps this
// honest is that it is a STRIP rather than a whole-line skip, so a value
// judgement in the same clause still fails: "Clearly this is the most important
// result" loses the `Clearly` and fails on the superlative. Asserted by a test.
const PROOF_ECONOMY_EXEMPT = new RegExp(
  [
    // sentence-initial, after a full stop, or opening a parenthesis
    String.raw`(?:^|[.;:]\s+|\(\s*)(?:clearly|obviously|evidently)\b`,
    // predicative: "is clear", "are clearly homotopic", "seems obvious"
    String.raw`\b(?:is|are|was|were|seems?)\s+(?:clear|clearly|obvious|obviously|evident)\b`,
    // the "it is easy to see / verify / check / that" frame
    String.raw`\bit\s+is\s+(?:easy|easily|clear|obvious|straightforward)\s+(?:to\s+(?:see|verify|check|show|prove)|that)\b`,
    // ADVERB then VERB, in either order, with any auxiliaries between. Both
    // directions occur in the exemplar and neither is the author's opinion:
    //   p184  "can clearly be represented by a loop"   (adverb, aux, participle)
    //   p184  "it follows easily that L is trivial"    (verb, adverb)
    //   p188  "It clearly maps JG onto S"              (adverb, verb)
    String.raw`\b(?:clearly|obviously|easily|readily)\s+(?:(?:be|been|being|can|may|must|will|would|shall|should|is|are|was|were|has|have|had|not)\s+)*[a-z]+(?:s|ed|en)\b`,
    String.raw`\b[a-z]+(?:s|ed|en)\s+(?:clearly|obviously|easily|readily|trivially)\b`,
    // ...and the participles that take the adverb the other way round
    String.raw`\b(?:easily|readily)\s+(?:verified|checked|shown|seen|given|proved|proven|follows|obtained)\b`,
  ].join("|"),
  "gi",
);

// THE WRAP CUTS THE CONSTRUCTION, AND IT CUTS BOTH WAYS. A line-based scan sees
// only one half of a hard-wrapped idiom, and which half depends on where the
// break fell. Measured on the exemplar:
//
//   p178  "…the subgroup E of G is just the"  / "commutator subgroup [A] of…"
//   p193  "…as = a' and Wi = WiJ ... Wi,ri clearly"  / "represents the ith parallel…"
//
// In both, THIS line ends holding only the head of the construction and the rest
// is on the next. The `COMPARATIVE_TAIL` lookback below handles the mirror case,
// where the previous line held the head. Kept narrow: the line must END in it.
const TRAILING_IDIOM_HEAD =
  /\b(?:(?:just|simply|merely|naturally|trivially|easily|cleanly|nicely)\s+(?:an?|the)|clearly|obviously|evidently|easily|readily)\s*$/i;

// Term-of-art exemption: an adverb bound into a standard mathematical name, so
// that removing it changes the claim rather than tidying it. `MATH_IDIOM_EXEMPT`
// below covers adverb + article + noun ("naturally an algebra"); this covers
// adverb + ADJECTIVE, which it does not.
//
// `naturally isomorphic` is the measured case — four of the exemplar's 26 hits,
// on pp. 178 and 186. A *natural* isomorphism is a specific thing in category
// theory, not an isomorphism the author happens to admire.
const MATH_TERM_OF_ART_EXEMPT =
  /\b(?:naturally|canonically|trivially|freely|densely|properly|simply)\s+(?:isomorphic|equivalent|homeomorphic|homotopic|diffeomorphic|embedded|graded|ordered|generated|connected|discontinuous|transitive|bounded|closed|exact|split)\b/gi;

const MATH_IDIOM_EXEMPT =
  /(?:naturally|trivially|easily|cleanly|simply|nicely|just)\s+(?:an?|the)\s+\S+|(?:decomposes|attaches|factors|contributes?|contribute|extends|embeds|maps|acts|commutes|generates|bar-classify|generate)\s+(?:naturally|trivially|easily|cleanly|nicely|simply)\b|(?:naturally|trivially|easily|cleanly|nicely|simply)\s+\$|(?:non|un|tri|semi|quasi|bi|sub|super|hyper|inter|intra|pre|post)-(?:simply|naturally|trivially|easily|cleanly|nicely)|(?:simply|naturally|trivially|easily|cleanly|nicely)-(?:laced|connected|graded|ordered)/i;

// Domain-terminology exemption: fixed scientific noun-phrases in which a
// flagged adverb is bound into a standard term of art, not editorializing.
// e.g. "naturally occurring elements/isotopes" (natural vs. synthetic) —
// removing the adverb would break the terminology. Applied by STRIPPING the
// phrase from a scratch copy of the line before the editorializing test, so
// it never masks a genuine hit elsewhere on the same line (global flag →
// every occurrence removed; used only in `.replace`, never stateful `.test`).
const DOMAIN_PHRASE_EXEMPT = /\bnaturally\s+occurring\b/gi;

// Comparative-degree exemption: `merely` and `just` inside an explicit
// contrast — "X rather than merely Y", "does not merely X, it Y" — are degree
// markers carrying the sentence's claim, not the author admiring the result.
// The criterion is after the author commenting on quality ("surprisingly", "a
// beautiful result"); a comparative marks the WEAKER alternative, which is the
// opposite move.
//
// Measured on this repo's own `docs/source/` (122 blocks), 2026-09-19: four
// `merely` hits, four comparative, ZERO genuine. Same shape as bean `fl5m`
// mechanism #2 — a word in a phrase list matching the construction the word
// is actually for. Global, so it is a STRIP like the domain phrase above and
// cannot mask a second hit on the same line.
const COMPARATIVE_EXEMPT =
  /(?:rather\s+than|instead\s+of|as\s+opposed\s+to|and\s+not|but\s+not)\s+(?:merely|just)\b|\b(?:does|do|did|is|are|was|were|can|could|will|would|need|needs|would\s+be)\s+not\s+(?:merely|just)\b|\bnot\s+(?:merely|just)\b/gi;

// ...and the negation can sit on the PREVIOUS line when prose is hard-wrapped,
// which a line-based scan cannot see. This is bean `fl5m` mechanism #5 ("wrap
// continuations scanned as sentence starts") in the editorializing rule: one of
// the four hits above was `does not` / `merely go unread` across a break. Kept
// deliberately narrow — the continuation must OPEN the line, and the line
// before must END in the comparative or the negator.
const COMPARATIVE_TAIL =
  /\b(?:rather\s+than|instead\s+of|as\s+opposed\s+to|does|do|did|is|are|was|were|can|could|will|would|need|needs|not)\s*$/i;
const OPENS_COMPARATIVE = /^\s*(?:not\s+)?(?:merely|just)\b/i;

export function checkEditorializing(mdPath: string): CheckerResult {
  // Skip lines that are clearly in fenced code (Lean / TeX snippets).
  const lines = readLines(mdPath);
  let inFence = false;
  const hits: CheckerHit[] = [];
  lines.forEach((l, i) => {
    if (/^```/.test(l.trim())) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    // Strip fixed scientific noun-phrases ("naturally occurring") from a
    // scratch copy first, so an adverb bound inside one is not flagged
    // WITHOUT masking other editorializing terms elsewhere on the line.
    let scan = l
      .replace(DOMAIN_PHRASE_EXEMPT, "")
      .replace(COMPARATIVE_EXEMPT, "")
      .replace(MATH_TERM_OF_ART_EXEMPT, "")
      .replace(PROOF_ECONOMY_EXEMPT, "");
    // Hard-wrapped comparative: the negator is on the line before.
    if (OPENS_COMPARATIVE.test(l) && COMPARATIVE_TAIL.test(lines[i - 1] ?? "")) {
      scan = scan.replace(OPENS_COMPARATIVE, "");
    }
    // This line ends holding only the head of a wrapped idiom — the rest is on
    // the next line, which will be scanned on its own iteration.
    scan = scan.replace(TRAILING_IDIOM_HEAD, "");
    if (!EDITORIALIZING_RE.test(scan)) return;
    // Math-idiom exemption: if the editorial adverb is in a math
    // construction (e.g. "naturally an algebra", "non-simply-laced",
    // "contribute trivially"), it's canonical math language.
    if (MATH_IDIOM_EXEMPT.test(scan)) return;
    hits.push({ file: mdPath, line: i + 1, text: l.trim().slice(0, 200) });
  });
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

// ── The archimedean-wall checkers moved to the science layer ────
//
// `framework-canonical`, `wall-side-correct` and `wall-base-ring-minimal`
// read one folio's mathematics — its canonical notation and its §7c
// substrate-to-archimedean wall — and moved, with their tests, to
// https://github.com/litlfred/folio-assistant-sci/blob/main/pipeline/qa-checkers-wall.ts
// (bean saqd, row 9). Their registry entries say `checker_contributed`.
//
// The one piece that stays is the real-field TYPE pattern below: it is a
// fact about Lean source that `scripts/check-mirror-drift.ts` here applies to
// field types, and the moved wall checker imports it from here rather than
// keeping a second copy that could drift.

/**
 * Archimedean-side TYPE markers used for the mixed-signal split — a genuine
 * real-field TYPE in ANY form: the bare `ℝ` (so `(x : ℝ)`, `→ ℝ`, `ℝ³`,
 * `: ℝ` are all caught — the common spaced Lean forms the old narrow
 * `\(ℝ\)` / `: ℝ\b` tokens missed), the `Real` namespace/type, or
 * `LinearOrderedField`. This is a deliberate BROADENING over the earlier
 * narrow variant (see folio #42, which flagged the `\b` limitation and
 * scoped the broadening to a follow-up — this is that follow-up).
 *
 * It deliberately OMITS the arithmetic tactics `norm_num` / `linarith` /
 * `positivity` / `nlinarith`: those discharge goals over ANY ordered field
 * (or ℕ/ℤ literals) and are not evidence of an ℝ specialisation, so a
 * generic `[Field R]` file that merely closes a literal with `norm_num` is
 * purely algebraic, not a mix (the `bring-residue-resolvent` false-positive).
 *
 * Because the broadening newly detects genuine `ℝ`+generic-R coexistence
 * that the narrow tokens missed, the mixed-signal split below carries an
 * ACKNOWLEDGEMENT-ESCAPE (`!acknowledged`): a file that mixes ℝ and generic-R
 * but carries a §7c acknowledgement is not forced to split. This makes the
 * split consistent with the acknowledgement branch's own philosophy (an
 * archimedean file may acknowledge instead of split) and covers the
 * legitimate patterns — an `R → ℝ` realisation map, or a conjecture whose
 * real claim carries generic support — that cannot be cleanly separated.
 */
export const ARCHIMEDEAN_TYPE_RE = /ℝ|\bReal\b|LinearOrderedField/;

// ── voice-ai-slop ───────────────────────────────────────────────

/**
 * Strip backtick-delimited inline code spans from a markdown line.
 * Used by the line-by-line ai-slop / scholarly-default scans so
 * technical variable names or `you`-named identifiers inside code
 * spans don't trigger false positives.
 *
 * Does not handle escaped backticks. Markdown's strict rules
 * (matching backtick-run lengths) are not enforced — for our
 * scanner the simpler regex is good enough; the only goal is to
 * suppress obvious inline-code matches.
 */
function stripInlineCode(line: string): string {
  return line.replace(/`[^`]+`/g, "");
}

/**
 * Direct LLM tells — phrases that should NEVER appear in published
 * scholarly prose. These produce few false-positives in practice;
 * any hit is a likely ai-slop violation.
 *
 * Note: the "it's important/worth to note that" pattern was removed
 * after Gemini PR #823 review — those phrases are standard in
 * scholarly technical writing and were producing false positives on
 * legitimate prose at the critical-severity level. The remaining
 * patterns are LLM-specific (lecturer phrases, status updates,
 * conversational fillers).
 */
const AI_SLOP_DIRECT_RE =
  /\b(let me (?:think|clarify|explain|address|now|first|see|walk|break|elaborate|verify|check|confirm)|here'?s what (?:I|we)(?: did| will| have| are doing| think| found| see| observed)?|I'?ll (?:go ahead|now|first|address|explain|verify|check|confirm|do that|take a look|elaborate)|great (?:question|point|catch|observation|note)|happy to (?:help|clarify|elaborate|verify)|(?:sure|of course|absolutely|certainly),?\s*(?:I|let'?s|we)|let'?s (?:explore|dive (?:in|into)|unpack|examine|break (?:this|it) down|see what|think about|consider|walk through)|note that we should|delve (?:into|in)|in (?:a )?nutshell|(?:that's|that is) (?:a )?(?:good|great|excellent|interesting) (?:point|question|catch|observation)|(?:as|just) (?:noted|mentioned|established|discussed|stated)\s+(?:above|earlier)|(?:to|let'?s) (?:break|summarize|recap)|(?:I|we) (?:can|will|should) (?:see|note|observe|verify|check|confirm) that|here you go|there you have it|hope (?:this|that) helps|feel free to|please (?:let me know|don'?t hesitate)|by all means)\b/i;

/**
 * Hedging / softener language frequently inserted by LLMs but
 * inappropriate in a precise mathematical paper. Conservative —
 * single-word hits should be a hint, not necessarily a violation.
 * We treat *combinations* (≥ 3 distinct tokens in the same block)
 * as the actual signal — the threshold balances catching real
 * LLM-output concentrations against the false-positive rate on
 * legitimate technical writing that uses one or two of these words
 * naturally.
 */
const AI_SLOP_HEDGE_TOKENS = [
  /\bessentially\b/i,
  /\bcomprehensive(ly)?\b/i,
  /\bleverag(e|ing|es|ed)\b/i,
  /\bstreamlin(e|ing|es|ed)\b/i,
  /\brobust(ly|ness)?\b/i,
  /\boverall(?:,|\s+then)?\b/i,
  /\bin (?:summary|conclusion),/i,
  /\bcrucial(ly)?\b/i,
  /\bvital(ly)?\b/i,
  /\bfundamental(ly)?\b/i,
  /\bsignificant(ly)?\b/i,
  /\bnotabl[ye]\b/i,
  /\bimportantly\b/i,
  /\bcritical(ly)?\b/i,
  /\bnuance[ds]?\b/i,
  /\bholistic(ally)?\b/i,
  /\bseamless(ly)?\b/i,
  /\bsynerg(y|ies|istic)\b/i,
  /\bcutting[- ]edge\b/i,
  /\bstate[- ]of[- ]the[- ]art\b/i,
  /\binnovativ(e|ely)\b/i,
  /\bgame[- ]chang(er|ing)\b/i,
  /\bdive (?:deep|deeper)\b/i,
  /\bdeep dive\b/i,
  /\btapestry\b/i,
  /\brealm of\b/i,
  /\bjourney\b/i,
  /\blandscape\b/i,
];

/**
 * Lecturer "First, ... Second, ... Third, ..." cadence used as a
 * structural crutch. Strictly: the same prose block must contain
 * "First," and "Second," (as sentence openers) AND "Third," or
 * "Finally,". Real scholarly use of these words in math context
 * (e.g. "First-order term...") will NOT match the comma-anchored
 * pattern.
 */
const AI_SLOP_FIRST_SECOND_THIRD_RE =
  /\bFirst,\s.*?\bSecond,\s.*?\b(?:Third|Finally),\s/is;

export function checkAiSlop(mdPath: string): CheckerResult {
  const { src, lines } = readSource(mdPath);
  if (!src) return { result: "pass", hits: [] };

  const hits: CheckerHit[] = [];

  // Pass 1 — direct LLM tells (line-by-line so we can cite line).
  // Both fenced code blocks (skipped via inFence) and inline
  // backtick spans (stripped per-line) are excluded from the scan.
  let inFence = false;
  const proseLineIndices: number[] = []; // for fence-aware Pass-3 idx
  lines.forEach((l, i) => {
    if (/^```/.test(l.trim())) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    proseLineIndices.push(i);
    const cleanedLine = stripInlineCode(l);
    if (AI_SLOP_DIRECT_RE.test(cleanedLine)) {
      hits.push({ file: mdPath, line: i + 1, text: l.trim().slice(0, 200) });
    }
  });

  // Pass 2 — hedge-token concentration. Strip BOTH fenced code
  // blocks AND inline backtick spans, then count distinct hedge
  // tokens in the remaining prose. ≥ 3 distinct hedge tokens in
  // one .md file is the signal.
  const proseOnly = src
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "");
  const distinctHedges = AI_SLOP_HEDGE_TOKENS.filter((re) =>
    re.test(proseOnly),
  );
  if (distinctHedges.length >= 3) {
    hits.push({
      file: mdPath,
      line: 1,
      text: `hedge-token concentration: ${distinctHedges.length} distinct AI-slop softener tokens present (essentially / comprehensive / leverage / streamline / robust / crucial / etc.)`,
    });
  }

  // Pass 3 — First/Second/Third cadence (whole-file scan).
  // Fence-aware idx: find the first "First," that lives on a prose
  // line (not inside a fenced block). Without this, a code snippet
  // containing "First," earlier in the file would mislocate the
  // evidence pointer.
  if (AI_SLOP_FIRST_SECOND_THIRD_RE.test(proseOnly)) {
    const firstProseIdx = proseLineIndices.find((i) =>
      /\bFirst,\s/.test(stripInlineCode(lines[i])),
    );
    hits.push({
      file: mdPath,
      line: firstProseIdx !== undefined ? firstProseIdx + 1 : 1,
      text: "First/Second/Third bullet cadence — characteristic LLM structural crutch",
    });
  }

  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

// ── voice-scholarly-default ─────────────────────────────────────

/**
 * Second-person address — the paper addresses the mathematics, not
 * the reader. "you can see", "the reader will note", etc. are
 * non-scholarly.
 */
const SECOND_PERSON_RE =
  /\b(you (?:can|will|note|see|may|might|should|need|have|are|now|find|get|want|know|notice|observe|understand|imagine|think|try|recall|remember)|your (?:reader|attention|intuition|favourite|favorite)|the reader (?:will|can|may|might|should|finds?|knows?|notices?|observes?|imagines?|recalls?))\b/i;

/**
 * Lecturer cadence — informal sentence openers more at home in a
 * lecture than a paper.
 *
 * `Right` requires a following comma (`Right, so ...`) or `now`
 * (`Right now we encode ...`). The bare `Right\b` this used to carry
 * flagged ordinary mathematical English: measured against the qou
 * corpus 2026-08-24, 22 Lean docstring lines opened with `Right`, and
 * 21 of them were "Right multiplication by", "Right action of",
 * "Right adjoint", "Right identity", "Right zero law" — a 21/22
 * false-positive rate. The remaining one ("Right now we encode") is
 * still caught. The neighbouring `OK,?` / `Okay,?` / `Alright,?`
 * keep their optional comma: none of those three is ever a technical
 * term, so there is nothing for them to collide with.
 *
 * `So the` was the same defect an order of magnitude larger. The bare
 * alternative `So (?:...|the)` fired on every mathematical "So the sum is
 * well-defined" / "So the two sides line up" — conclusion-drawing, not
 * lecture cadence. Measured against the qou corpus 2026-08-24: **246 of the
 * 261** `voice-scholarly-default` hits corpus-wide came from it (94%), across
 * 18 `.md` and 190 `.lean` files, and **zero** were the draft narration it
 * was written for. Narrowed to the narration nouns it was after (`So the
 * plan/idea/point/upshot/...`), which is what "So the" means when it IS a
 * lecturer opener.
 *
 * Every bare-word alternative now ends in `\b`. Without it `the` matched
 * through the prefix of the following word, so `So there is no inverse` /
 * `So they are stated over the same ring` / `So these two agree` all fired —
 * 12 of the 246 were that glue rather than "So the" at all.
 */
const LECTURER_OPENER_RE =
  /^\s*(?:So (?:what (?:we|I)\b(?:'re)?(?: going to)?(?: do)?|let'?s\b|now\b|first\b|why\b|here\b|the (?:plan|idea|point|upshot|deal|thing|trick|takeaway|story|moral|gist)\b)|Now (?:we (?:want|need|will|are|have|move|turn|introduce|consider)\b|let'?s\b|that\b|here\b|first\b|comes?\b)|OK,?\b|Okay,?\b|Alright,?\b|Well,|Right(?:,|\s+now\b)|Anyway,|Anyhow,|Basically,|Briefly,|Long story short|Recap:|In short,|To recap,|At this point,?\s+(?:we|let'?s)|First (?:off|things first)|Before (?:we|getting|moving|diving)|Without further ado)/i;

/**
 * Past-tense narration of the paper's own derivation. Paper voice
 * is present-tense for definitions and theorems; past-tense reads
 * as draft narration. Pattern: "we constructed", "we defined",
 * "we showed", "we proved" — limited to first-person plural since
 * generic past tense is fine in proofs ("Hilbert proved ...").
 */
const PAPER_PAST_TENSE_RE =
  /\b(we (?:constructed|defined|showed|proved|established|derived|computed|verified|developed|introduced|formulated|presented|gave|wrote|stated|sketched|argued|claimed|noted|observed|demonstrated|argued|exhibited|obtained))\s+(?:above|earlier|before|previously|in the (?:previous|preceding|earlier)|just\s+now|just\s+above|in (?:a|the) (?:prior|preceding|earlier) (?:section|paragraph|chapter|lemma|theorem|proposition)|several (?:lines|paragraphs|sections) (?:above|back|ago)|further\s+up|up\s+the\s+page)/i;

/**
 * `LECTURER_OPENER_RE` is the only `^`-anchored rule here, and both scans
 * feed it one line at a time — so on hard-wrapped prose it also sees every
 * WRAP CONTINUATION as if it were a sentence start. Measured 2026-08-24:
 * `SpechtActionInjective.lean:65` reads "...it acts on the `right, since the
 * ring need not be commutative)." across a line break, and the continuation
 * line "right, since ..." fired `Right,`.
 *
 * A line begins a sentence iff nothing precedes it, the previous line is
 * blank or structural (heading, bullet, table row, fence, display-math
 * delimiter), or the previous line ends in terminating punctuation. Anything
 * else is the middle of a sentence, where an "opener" is not an opener.
 */
function startsSentence(prev: string | undefined): boolean {
  if (prev === undefined) return true;
  const t = prev.trim();
  if (t === "") return true;
  if (/^(?:[#>|]|[-*+]\s|\d+\.\s|```|\$\$|-\/|\/-)/.test(t)) return true;
  return /(?:[.:!?]|\$\$|-\/)["'`)\]]*$/.test(t);
}

export function checkScholarlyDefault(
  mdPath: string | undefined,
  leanPath: string | undefined,
): CheckerResult {
  const lines = mdPath ? readSource(mdPath).lines : [];
  if (lines.length === 0 && !leanPath) return { result: "pass", hits: [] };

  const hits: CheckerHit[] = [];

  // Scan .md. Fenced code blocks (```) are skipped via `inFence`;
  // inline backtick spans are stripped per-line so technical terms
  // / identifiers in code don't trigger false positives. HTML-style
  // `<!-- ... -->` comments are intentionally NOT stripped — they
  // render as visible text in the markdown pipeline.
  if (mdPath) {
    let inFence = false;
    lines.forEach((l, i) => {
      if (/^```/.test(l.trim())) {
        inFence = !inFence;
        return;
      }
      if (inFence) return;
      const cleanedLine = stripInlineCode(l);
      if (SECOND_PERSON_RE.test(cleanedLine)) {
        hits.push({ file: mdPath, line: i + 1, text: l.trim().slice(0, 200) });
      }
      if (
        LECTURER_OPENER_RE.test(cleanedLine) &&
        startsSentence(i > 0 ? lines[i - 1] : undefined)
      ) {
        hits.push({ file: mdPath, line: i + 1, text: l.trim().slice(0, 200) });
      }
      if (PAPER_PAST_TENSE_RE.test(cleanedLine)) {
        hits.push({ file: mdPath, line: i + 1, text: l.trim().slice(0, 200) });
      }
    });
  }

  // Also scan Lean docstrings — proof bodies share the scholarly
  // standard. Extract /-! ... -/ module docs and /-- ... -/ decl
  // docstrings as line-tracked spans so we can cite the actual
  // offending line + quote (not just `line: 1`).
  if (leanPath) {
    const { src: leanSrc } = readSource(leanPath);
    if (leanSrc) {
      for (const span of extractLeanDocstrings(leanSrc)) {
        // span.startLine is 1-based; span.body has the raw text.
        // Iterate INTERNAL docstring lines so we cite the exact
        // offender. The three RE's use the same matchers as the
        // .md scan above (incl. PAPER_PAST_TENSE_RE — missing
        // from the previous version).
        const docLines = span.body.split("\n");
        docLines.forEach((dl, j) => {
          const cleanedLine = stripInlineCode(dl);
          const lineNo = span.startLine + j;
          // SECOND_PERSON_RE is case-insensitive, not anchored — fine.
          if (SECOND_PERSON_RE.test(cleanedLine)) {
            hits.push({
              file: leanPath,
              line: lineNo,
              text: dl.trim().slice(0, 200) || "(empty)",
            });
          }
          // LECTURER_OPENER_RE uses `^` so it must match line-start.
          // Per-line iteration applies the anchor naturally; the prior
          // whole-doc-string scan needed the `m` flag. `startsSentence`
          // then rejects wrap continuations, which line-start alone
          // cannot tell apart from real sentence starts.
          if (
            LECTURER_OPENER_RE.test(cleanedLine) &&
            startsSentence(j > 0 ? docLines[j - 1] : undefined)
          ) {
            hits.push({
              file: leanPath,
              line: lineNo,
              text: dl.trim().slice(0, 200) || "(empty)",
            });
          }
          if (PAPER_PAST_TENSE_RE.test(cleanedLine)) {
            hits.push({
              file: leanPath,
              line: lineNo,
              text: dl.trim().slice(0, 200) || "(empty)",
            });
          }
        });
      }
    }
  }

  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

/**
 * Extract Lean docstring spans (/-! ... -/ and /-- ... -/) with
 * line-number tracking. Returns `{ startLine, body }` per span,
 * where `startLine` is the 1-based line of the opening delimiter's
 * line in the source, and `body` is the inner text (NOT including
 * the `/-! ` or trailing ` -/`).
 *
 * Handles **nested** block comments — Lean permits `/- /- … -/ -/`
 * — by tracking nesting depth. Without this, a docstring containing
 * a nested `-/` would terminate the span prematurely.
 */
function extractLeanDocstrings(
  src: string,
): Array<{ startLine: number; body: string }> {
  const out: Array<{ startLine: number; body: string }> = [];
  // Find all docstring openers. `/-!` or `/--` followed by anything
  // except `-/`. We do a manual nested scan rather than a regex.
  let i = 0;
  const n = src.length;
  const lineNum = 1;
  // Pre-compute newline positions so startLine is O(1) per opener.
  const newlineAt: number[] = [];
  for (let k = 0; k < n; k++) {
    if (src.charCodeAt(k) === 10 /* \n */) newlineAt.push(k);
  }
  const lineOf = (pos: number): number => {
    // Lower bound on newlineAt for pos.
    let lo = 0;
    let hi = newlineAt.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (newlineAt[mid] < pos) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };
  void lineNum; // suppress unused

  while (i < n - 2) {
    const isDocOpener =
      src[i] === "/" &&
      src[i + 1] === "-" &&
      (src[i + 2] === "!" || src[i + 2] === "-");
    if (!isDocOpener) {
      i++;
      continue;
    }
    const startLine = lineOf(i);
    // Skip the opening `/-!` or `/--`.
    let j = i + 3;
    let depth = 1;
    while (j < n - 1 && depth > 0) {
      if (src[j] === "/" && src[j + 1] === "-") {
        depth++;
        j += 2;
      } else if (src[j] === "-" && src[j + 1] === "/") {
        depth--;
        j += 2;
      } else if (src[j] === '"') {
        // Skip past Lean string literal so a `"-/"` inside the
        // string does not terminate the docstring prematurely.
        // Handles standard backslash escapes.
        j++;
        while (j < n && src[j] !== '"') {
          if (src[j] === "\\" && j + 1 < n) j += 2;
          else j++;
        }
        if (j < n) j++; // skip closing quote
      } else {
        j++;
      }
    }
    // body = inside the docstring, between opener+3 and the closing -/.
    const bodyEnd = depth === 0 ? j - 2 : j;
    const body = src.slice(i + 3, bodyEnd);
    out.push({ startLine, body });
    i = j;
  }
  return out;
}

// ── voice-author-notes-pollution ──────────────────────────────────
// Detects author-tracking content that belongs in .ts authorNotes
// (per CLAUDE.md §4d), not in scholarly .md prose.
// P1: Status banners  P2: PR/commit refs  P3: Agent names
// P4: ISO dates  P5: Deprecation markers

const AUTHOR_NOTES_STATUS_RE =
  /^>\s*\*\*(?:Status|Caveat|Note|Refined-framing|DEPRECATED|Honest status|Phase \d)/im;
const AUTHOR_NOTES_PR_REF_RE =
  /(?:PR\s*#\s*\d{3,}|commit\s+[a-f0-9]{7,40}|merged\s+(?:to|into|on)\s+main|cherry-pick(?:ed)?|rebas(?:e|ed|ing)\s+(?:onto|clean))/i;
const AUTHOR_NOTES_AGENT_RE =
  /\b(?:Claude|Copilot|Gemini|GPT-4|claude-opus|claude-sonnet|claude-haiku)\b/;
const AUTHOR_NOTES_DATE_RE =
  /\b20(?:25|26)-(?:0[1-9]|1[0-2])-(?:[0-2]\d|3[01])\b/;

// P4 exemption: the DATE OF A MEASUREMENT is mandated provenance, not
// author-tracking pollution.
//
// `AGENTS.md` requires exactly this form — "a number without its date and
// command is a claim, not evidence" — and the BASELINE rule for agent memory
// says a measured number is stored "with the command that produced it and the
// date". So P4 was firing on the house style it is supposed to coexist with,
// and the only way for an author to satisfy both was to omit the provenance
// that makes a number checkable.
//
// Deliberately narrow: it exempts a date bound to the word `measured` within
// the same clause, not dates generally. `as of 2026-05-28 this remains open`
// is still a P4 hit, because that is status speech about the work rather than
// provenance of a number. Bounded by `[^.\n]` so the exemption cannot reach
// across a sentence boundary and launder an unrelated date.
const MEASURED_PROVENANCE_RE =
  /\b(?:re-)?measured\b[^.\n]{0,40}?\b20(?:25|26)-(?:0[1-9]|1[0-2])-(?:[0-2]\d|3[01])\b/gi;

export function checkAuthorNotesPollution(mdPath: string): CheckerResult {
  const { lines } = readSource(mdPath);
  const hits: CheckerHit[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^```/.test(l.trim())) { inFence = !inFence; continue; }
    if (inFence) continue;
    const stripped = l.replace(/`[^`]+`/g, "");
    if (AUTHOR_NOTES_STATUS_RE.test(stripped))
      hits.push({ file: mdPath, line: i + 1, text: `P1:status-banner: ${l.trim().slice(0, 200)}` });
    if (AUTHOR_NOTES_PR_REF_RE.test(stripped) && !/^--\s*Ref:/.test(stripped))
      hits.push({ file: mdPath, line: i + 1, text: `P2:pr-commit-ref: ${l.trim().slice(0, 200)}` });
    if (AUTHOR_NOTES_AGENT_RE.test(stripped))
      hits.push({ file: mdPath, line: i + 1, text: `P3:agent-name: ${l.trim().slice(0, 200)}` });
    // P4 date check: a date inside a markdown-link target
    // `](…/2026-05-28-foo.md)` or inside a dated filename is part of a
    // path, not prose pollution — stripping it would break the link.
    // Mask link targets + dated filenames before testing so genuine
    // prose dates ("as of 2026-05-28 …") still fail but filename dates
    // (audit-doc cross-references) do not.
    const dateProbe = stripped
      .replace(/\]\([^)]*\)/g, "]")
      .replace(/[\w./-]*\d{4}-\d{2}-\d{2}[\w./-]*\.(?:md|json|py|tex|lean|txt|svg|png)\b/g, "")
      .replace(MEASURED_PROVENANCE_RE, "");
    if (AUTHOR_NOTES_DATE_RE.test(dateProbe) && !/^\$/.test(dateProbe) && !/Ref:/.test(dateProbe))
      hits.push({ file: mdPath, line: i + 1, text: `P4:date-ref: ${l.trim().slice(0, 200)}` });
  }
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

// ── voice-status-section ──────────────────────────────────────────
// Work-tracking SECTION HEADERS do not belong in scholarly .md prose.
// Flags markdown headers whose text carries a status / todo / roadmap
// keyword: `## Status`, `### Status (2026-…)`, `## Formalization status`,
// `## TODO`, `## Pending`, `## Roadmap`, `## Next steps`, `## Work
// remaining`. Status / roadmap content migrates to the `.ts` `authorNotes`
// field (CLAUDE.md §4d); todos move to `beans/` (owner directive
// 2026-06-13) — never the paper. Complements voice-status-leak (inline
// markers) and voice-author-notes-pollution (banners / PR# / dates).
// Legitimate scholarly sections ("Open problems", "Discussion",
// "Limitations", "Outlook") are NOT flagged. Skips fenced code blocks.
const STATUS_SECTION_HEADER_RE =
  /^#{1,6}\s+(?=.*\b(?:status|todo|to-?do|pending|roadmap|punch\s*list|next\s+steps?|(?:work\s+remaining|remaining\s+work|outstanding\s+work)|implementation\s+plan)\b).*/i;

export function checkStatusSectionHeader(mdPath: string): CheckerResult {
  const { lines } = readSource(mdPath);
  const hits: CheckerHit[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^```/.test(l.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (STATUS_SECTION_HEADER_RE.test(l))
      hits.push({
        file: mdPath,
        line: i + 1,
        text: `status-section-header: ${l.trim().slice(0, 200)}`,
      });
  }
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

// ── Dispatch table ──────────────────────────────────────────────

/**
 * This module's OWN checkers, keyed by the criterion each answers.
 *
 * It used to be `AUTOMATED_CHECKERS` and spread in five other modules' tables
 * as well, so that `qa-sweep` could dispatch from one object. Nothing reads a
 * merged table any more: the sweep resolves each criterion through
 * `qa-checker-discovery`, which imports the module the registry NAMES and
 * finds the entry there. The aggregation outlived its only caller and was
 * kept alive by a test comparing against it.
 *
 * Dropping it matters beyond tidiness — the spreads made this file import
 * `qa-checkers-cost.ts`, so the voice module (core) depended on the
 * elaboration-cost module (science layer) for no reason but the merge.
 */
export const VOICE_AUTOMATED_CHECKERS: Record<
  string,
  (paths: CheckerPaths) => CheckerResult
> = {
  "voice-status-leak": (p) =>
    p.md ? checkStatusLeak(p.md, p.ts) : { result: "pass", hits: [] },
  "voice-probe-narrative": (p) =>
    p.md ? checkProbeNarrative(p.md) : { result: "pass", hits: [] },
  "voice-agent-speak": (p) =>
    p.md ? checkAgentSpeak(p.md) : { result: "pass", hits: [] },
  "cite-named-theorem": (p) =>
    p.md ? checkCiteNamedTheorem(p.md) : { result: "pass", hits: [] },
  "voice-emoji-content": (p) =>
    p.md ? checkEmojiContent(p.md) : { result: "pass", hits: [] },
  "voice-first-person-work": (p) =>
    p.md ? checkFirstPersonWork(p.md) : { result: "pass", hits: [] },
  "voice-time-stamped-notes": (p) =>
    p.md ? checkTimeStampedNotes(p.md) : { result: "pass", hits: [] },
  "voice-unicode-crash": (p) =>
    p.md ? checkUnicodeCrash(p.md) : { result: "pass", hits: [] },
  "voice-editorializing": (p) =>
    p.md ? checkEditorializing(p.md) : { result: "pass", hits: [] },
  "voice-author-notes-pollution": (p) =>
    p.md ? checkAuthorNotesPollution(p.md) : { result: "pass", hits: [] },
  "voice-status-section": (p) =>
    p.md ? checkStatusSectionHeader(p.md) : { result: "pass", hits: [] },
  "voice-ai-slop": (p) =>
    p.md ? checkAiSlop(p.md) : { result: "pass", hits: [] },
  "voice-scholarly-default": (p) =>
    p.md || p.lean
      ? checkScholarlyDefault(p.md, p.lean)
      : { result: "pass", hits: [] },
};
