/**
 * Script-quality checkers for Python source files.
 *
 * Implements the 8 criteria in the script-quality axis:
 *   - `does_not_default_to_float`     — bare floats / casts
 *   - `respects_archimedean_wall`     — `math.sqrt`/`numpy.float64`/…
 *   - `code_is_commented`             — module docstring or ≥10% comments
 *   - `variables_typed`               — function parameter annotations
 *   - `has_references_to_paper`       — `# Ref: [key]` markers
 *   - `connected_to_ci_pipeline`      — referenced from a workflow
 *   - `deprecated`                    — path / marker / docstring
 *   - `uses_library_framework_appropriately` — `WitnessBuilder` import
 *
 * Checkers in this file are **regex-based heuristics**, not full
 * AST scans. The trade-off is accept some false positives in
 * exchange for not adding a Python runtime dependency to the QA
 * sweep. When a heuristic produces too many false positives in
 * practice, the right escalation path is to port the checker to a
 * subprocess that runs Python's `ast` module — separate PR.
 *
 * @module pipeline/qa-checkers-python
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, basename, dirname } from "path";
import type { CheckerResult, CheckerHit } from "./qa-checkers-voice";

// ─── does_not_default_to_float ─────────────────────────────────

/**
 * Allow-list of patterns where a float literal is acceptable:
 *
 * - String args to high-precision constructors:
 *   `mpf("1.5")`, `Decimal("0.5")`, `mpmath.mpf("3.14")` —
 *   the float-looking content is a string, not a Python float.
 * - Sentinel values: `float("inf")`, `float("-inf")`, `float("nan")`,
 *   `float("infinity")` (Python's float() accepts the long form too;
 *   matching is case-insensitive).
 * - Comments / docstrings: anywhere after `#` or inside `""" ... """`
 *   / `''' ... '''` — narrative, not code.
 *
 * Implementation: strip these regions before scanning for bare
 * float literals.
 */
const PY_STRING_RE = /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;
const PY_COMMENT_RE = /#[^\n]*/g;

// A "bare float literal" is a numeric token that contains a `.`
// or exponent and is NOT immediately followed by `j`/`J` (complex)
// or another identifier char. PEP 515 numeric underscores (`1_000.5`,
// `1.5_5e1_0`) are accepted between digits.
//
// The lookbehind class blocks identifier chars, digits, dots, AND
// `:` — the `:` exclusion prevents false positives in f-string
// format specs like `{x:.2f}` / `{x:0.4f}` / `{x:10.5f}`, where
// the digit+dot sequence after `:` is a width/precision specifier,
// not a code literal.
//
// Alternatives are ordered specific→general: the exponent form
// matches before the dot-only form so `1.5e10` matches as the full
// e-literal, not just `1.5` (the original regex stopped at the
// dot and missed the exponent suffix).
const BARE_FLOAT_LITERAL_RE =
  /(?<![A-Za-z_0-9.:])(?:\d[\d_]*(?:\.[\d_]*)?[eE][+-]?\d[\d_]*|\d[\d_]*\.[\d_]*|\.\d[\d_]*)(?![jJ])/g;

// A `float(...)` cast call. The inner `(?:[^()]|\([^()]*\))*`
// alternation allows one level of nested parens — `float(int(x))`
// matches as a single call. Two or more levels of nesting
// (`float(int(int(x)))`) remain a known heuristic limitation; the
// inner `float(...)` calls are still caught via the recursive scan
// because each is a separate `\bfloat` anchor. `[^()]` matches
// newlines by default in JS regex, so multiline casts like
// `float(\n  "inf"\n)` are handled by the same pattern.
const FLOAT_CALL_RE =
  /\bfloat\s*\((?:[^()]|\([^()]*\))*\)/g;
// Sentinel allow-list: case-insensitive `inf`/`-inf`/`nan`/`infinity`/
// `-infinity`, optional trailing comma (`float("inf",)` is valid
// Python and is the form Black produces for multiline single-arg
// calls).
const FLOAT_CALL_SENTINEL_RE =
  /^\s*['"](?:inf|-inf|nan|infinity|-infinity)['"]\s*,?\s*$/i;

// Known heuristic limitations (documented; not bugs to file):
//   - f-string expression regions are currently masked uniformly
//     with their text portions, so bare floats inside `f'{1.0}'`
//     are false negatives. Naïve unmasking introduces false
//     positives on format specs (`{x:>10.4f}`) and literal text
//     (`f'value 1.0'`); proper f-string expression scanning needs
//     a tokeniser and lands in a follow-up PR.
//   - 2+ levels of nested parens inside `float(...)` (e.g.
//     `float(int(int(x)))`) — the outer call is missed but each
//     inner `float(...)` is caught via its own `\bfloat` anchor.

const blankNonNewline = (m: string) => m.replace(/[^\n]/g, " ");

/**
 * Mask Python string literals and comments with same-length blanks,
 * preserving line numbers so hit locations remain accurate.
 */
function maskStringsAndComments(src: string): string {
  return src
    .replace(PY_STRING_RE, blankNonNewline)
    .replace(PY_COMMENT_RE, blankNonNewline);
}

/**
 * Flag bare float literals (`1.0`, `0.5`, `3.14e-10`, …) and
 * `float(...)` casts in Python source. Strings, comments, and
 * `float("inf"|"nan"|…)` sentinels are exempt.
 *
 * Heuristic — does not parse Python. Produces some false positives
 * (e.g. floats embedded in conditional blocks that the author knows
 * are safe). Authors override with a `human` reviewer entry in the
 * script's sidecar.
 */
/**
 * Predicate: is this Python source line a "display context" where
 * `float(...)` casts and bare float literals are legitimately
 * NOT substrate-precision operations? Triggers:
 *   - `print(` / `>>>` REPL prompt — explicit display output
 *   - `\bf['"]` — f-string marker (word boundary prevents words
 *     ending in `f` like `stuff["…"]` from matching)
 *   - `.format(` (method) or `\bformat(` (builtin) — string format
 *   - `\bassert ` — tolerance comparison
 *   - `\blog(?:ging|ger)?\.` — `logging.info` / `logger.debug` / `log.info` etc.
 *     (formatted messages, never substrate-precision compute)
 *   - assignment to a name with a display-intent suffix
 *     (`_pct`, `_ppb`, `_ppm`, `_print`, `_display`, `_str`,
 *     `_repr`) — convention for variables that are *only* used
 *     for human-readable output
 *   - assignment to a name with a time-budget / wall-clock suffix
 *     (`_sec`, `_seconds`, `_ms`, `_us`, `_ns`, `_timeout`,
 *     `_budget`, `_deadline`, `_interval`, `_delay`, `_elapsed`,
 *     `_wall`, `_duration`) — these are operational time values,
 *     not substrate-precision math. Per PR-batch (drain pivot):
 *     dozens of false positives across the corpus were
 *     `*_BUDGET_SEC = 480.0`, `wall_seconds_to_reach`, etc.
 *   - prefix-style time names: `wall_`, `elapsed_`, `t_start`,
 *     `t_end`, `start_time`, `end_time`
 *   - dict-key string for the same time/display set
 *     (e.g. `"wall_seconds": float(...)` — the cast is to make
 *     the value JSON-serialisable, not for compute)
 *
 * **The caller must pass a comments-only-masked source line**
 * (strings intact). Calling this on a `maskStringsAndComments`-
 * blanked line silently breaks the f-string check (the quotes are
 * gone in that representation).
 */
function isDisplayContextLine(line: string): boolean {
  return (
    /\bprint\(|\bf["']|\.format\(|\bformat\(|\bassert\s|>>>|\blog(?:ging|ger)?\./.test(line) ||
    /\b\w+_(?:pct|ppb|ppm|print|display|str|repr)\b\s*=/.test(line) ||
    /\b\w*_(?:sec|seconds|ms|us|ns|timeout|budget|deadline|interval|delay|elapsed|wall|duration)\b\s*=/i.test(line) ||
    /\b(?:wall|elapsed)_\w+\s*=/.test(line) ||
    /\b(?:t_start|t_end|start_time|end_time)\b\s*=/.test(line) ||
    // Dict / kwarg form: "wall_seconds_to_reach": float(...), "elapsed_ms": ..., etc.
    // Matches the time-context substring ANYWHERE in the key (per the
    // comment intent) — drop `\b` boundaries from `_ms` / `_us` / `_ns`
    // since "elapsed_ms_to_reach" should match (the unit appears
    // mid-key followed by another underscore). Per PR #1109 review (Copilot).
    /["']\w*(?:_sec|_seconds|_ms|_us|_ns|_wall|wall_|_elapsed|elapsed_|_duration|_timeout|_budget|_deadline|_pct|_ppb|_ppm)\w*["']\s*:/.test(line) ||
    /\b\w*(?:_sec|_seconds|_ms|_us|_ns|_wall|_elapsed|_duration|_timeout|_budget|_deadline|_pct|_ppb|_ppm)\w*\s*=\s*float\(/.test(line) ||
    // `float(wall_seconds)` / `float(elapsed_ms)` — argument is a
    // time-context variable, so the cast is JSON-serialisation
    // / display, not substrate compute.
    /\bfloat\(\s*\w*(?:wall_|elapsed_|t_start|t_end|start_time|end_time|_sec|_seconds|_ms|_us|_ns|_elapsed|_duration|_timeout|_budget|_deadline|_pct|_ppb|_ppm)\w*\s*\)/.test(line) ||
    // try/except float() pattern — graceful fallback for malformed
    // input, not a substrate-precision compute path. NOTE: removed
    // `return` from this alternation per PR #1109 review — it was too
    // broad and masked legitimate findings like
    // `return float(mp.mpf(...))` in active compute scripts. A
    // narrow `return float(x)` cast in compute code IS a real
    // substrate concern; leave it flagged.
    /^\s*(?:try|except)\b.*\bfloat\(/.test(line)
  );
}

export function checkDoesNotDefaultToFloat(
  scriptPath: string,
): CheckerResult {
  if (!existsSync(scriptPath)) return { result: "n/a", hits: [] };
  // Scripts under `_deprecated/` are already flagged by the
  // `deprecated` criterion — double-flagging is noise.
  if (scriptPath.includes("/_deprecated/")) {
    return { result: "n/a", hits: [] };
  }
  const src = readFileSync(scriptPath, "utf-8");
  const masked = maskStringsAndComments(src);
  // For display-context detection we need a version of the source
  // that masks COMMENTS but keeps STRING QUOTES intact — otherwise
  // the f-string marker (`f"…"`) is invisible (its quote was
  // blanked by maskStringsAndComments). Comments-only mask lets
  // us see `f"`, `print(`, `.format(`, `assert ` while still
  // ignoring patterns that happen to appear inside `# ...` lines.
  const srcCommentsOnly = src.replace(PY_COMMENT_RE, blankNonNewline);
  const ctxLines = srcCommentsOnly.split("\n");
  // `maskStringsAndComments` blanks string/comment regions in place
  // (same length, same line breaks), so offsets in the masked text
  // align with the original text — we can recover sentinel
  // arguments from `src` using indices computed against `masked`.
  const hits: CheckerHit[] = [];

  // Precompute newline offsets so we can map a char offset back to a
  // 1-indexed line number in O(log n) per lookup. Whole-source scan
  // (rather than per-line) lets us catch multiline `float(\n ...)`
  // casts that Black-formatted code may produce.
  const newlineOffsets: number[] = [];
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === "\n") newlineOffsets.push(i);
  }
  const lineForOffset = (offset: number): number => {
    let lo = 0;
    let hi = newlineOffsets.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (newlineOffsets[mid] < offset) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };

  // Phase 1 — whole-source scan for `float(...)` casts. For each
  // match, recover the original arg from `src` (since the masked
  // copy has string contents blanked), test the sentinel allow-list,
  // and blank the matched region in a working copy so the literal
  // scan below does not double-flag arguments like `float(1.0)`.
  //
  // Display-context exemption: `float(...)` casts on a line that
  // also contains an f-string (`f"`), `print(`, `.format(`, or
  // `assert ` are presentation / comparison conversions, not
  // substrate-precision compute paths. The conversion is the
  // INTENT — we want a regular Python float for `:.6f` formatting,
  // human-readable print output, or tolerance comparison.
  // Same intent applies to lines that ASSIGN to a name ending in
  // `_pct`, `_ppb`, `_ppm`, `_print`, `_display`, `_str` — those
  // are explicit display-only variables. Restricting the float-
  // cast flag to substrate code paths matches the criterion's
  // own description ("in substrate-precision code paths").
  let workingSource = masked;
  // Pre-split for per-line context lookup. masked preserves line
  // breaks so workingLines indexing matches lineForOffset() values.
  for (const m of masked.matchAll(FLOAT_CALL_RE)) {
    const startOfArg = m.index! + m[0].indexOf("(") + 1;
    const endOfArg = m.index! + m[0].lastIndexOf(")");
    const rawArg = src.slice(startOfArg, endOfArg);
    const isSentinel = FLOAT_CALL_SENTINEL_RE.test(rawArg.trim());

    // Display-context check on the line containing the cast.
    // Use the comments-only-masked source so f-string markers
    // (`f"`) are visible — `maskedLines` (from full
    // maskStringsAndComments) has quotes blanked and would miss
    // them.
    const lineNum = lineForOffset(m.index!);
    const lineCtx = ctxLines[lineNum - 1] ?? "";
    const isDisplayContext = isDisplayContextLine(lineCtx);

    if (!isSentinel && !isDisplayContext) {
      const display = rawArg.trim().replace(/\s+/g, " ");
      hits.push({
        file: scriptPath,
        line: lineNum,
        text:
          `bare \`float(${display.slice(0, 40)}${
            display.length > 40 ? "…" : ""
          })\` cast — use \`mpmath.mpf("...")\` / \`Decimal("...")\` ` +
          `to preserve substrate precision`,
      });
    }
    // Blank the cast region (newlines preserved) so the per-line
    // literal scan below does not see the cast's interior.
    const blanked = m[0].replace(/[^\n]/g, " ");
    workingSource =
      workingSource.substring(0, m.index!) +
      blanked +
      workingSource.substring(m.index! + m[0].length);
  }

  // Phase 2 — bare float literals in regions not consumed by a
  // `float(...)` cast. Per-line scan is fine here; literals do not
  // span lines. Same display-context exemption as Phase 1 — a
  // literal like `1e-6` inside `assert x < 1e-6` is the tolerance
  // for a comparison, not a substrate-precision value. The display
  // check runs on `ctxLines` (comments-only mask, strings intact)
  // so f-string markers are visible.
  const workingLines = workingSource.split("\n");
  for (let i = 0; i < workingLines.length; i++) {
    const line = workingLines[i];
    if (!line.trim()) continue;
    if (isDisplayContextLine(ctxLines[i] ?? "")) continue;
    for (const m of line.matchAll(BARE_FLOAT_LITERAL_RE)) {
      hits.push({
        file: scriptPath,
        line: i + 1,
        text:
          `bare float literal \`${m[0]}\` — wrap in ` +
          `\`mpmath.mpf("${m[0]}")\` / \`Decimal("${m[0]}")\` to ` +
          `preserve substrate precision, or move to a string constant ` +
          `if it's an input parameter`,
      });
    }
  }

  return {
    result: hits.length > 0 ? "fail" : "pass",
    hits,
  };
}

// ─── compute_no_mpf_to_float_cast (critical-severity precision destroyer) ──

/**
 * Patterns that are GUARANTEED precision destroyers (no false positives,
 * no display-context exemption — these are always wrong in production
 * compute):
 *   - `float(<expr>.evalf(...))` — casting a sympy high-precision eval to float64
 *   - `float(<expr>.subs(...).evalf(...))` — same, common in symbolic substitution
 *   - `float(mp.<X>)` / `float(mp.mpf(...))` — casting mpmath to float64
 *   - `float(mpmath.<X>)` — fully-qualified mpmath
 *   - `numpy.float64(<expr>)` / `np.float64(<expr>)` — explicit float64 wrap
 *
 * The existing `does_not_default_to_float` (`major`) is broader — catches
 * any bare cast — but has display-context exemptions and may have false
 * positives. This `critical` companion catches only the unambiguous cases
 * where an mpmath / sympy precision-bearing value is dropped into float64.
 * "float64 is EVIL" (CLAUDE.md / author directive 2026-06-09).
 */
// Inner-content patterns that mark a `float(...)` arg as a
// guaranteed-destroyer precision sink.
const MPF_INNER_DESTROYER_RE =
  /\.evalf\s*\(|\bmp\.[A-Za-z_]|\bmpmath\.[A-Za-z_]/;
const NUMPY_FLOAT64_CALL_RE =
  /\b(?:numpy|np)\.float64\s*\((?:[^()]|\([^()]*\))*\)/g;

export function checkComputeNoMpfToFloatCast(
  scriptPath: string,
): CheckerResult {
  if (!existsSync(scriptPath)) return { result: "n/a", hits: [] };
  if (scriptPath.includes("/_deprecated/")) {
    return { result: "n/a", hits: [] };
  }
  const src = readFileSync(scriptPath, "utf-8");
  // Mask strings + comments so documentation references don't fire.
  const masked = maskStringsAndComments(src);
  // For display-context detection we need a comments-only mask
  // (keeps string quotes intact) so f-string markers `f"` are
  // visible — same approach as `checkDoesNotDefaultToFloat`.
  const srcCommentsOnly = src.replace(PY_COMMENT_RE, blankNonNewline);
  const ctxLines = srcCommentsOnly.split("\n");
  const hits: CheckerHit[] = [];
  // Build a sparse newline index for fast offset → line lookup.
  const newlineOffsets: number[] = [];
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === "\n") newlineOffsets.push(i);
  }
  const lineForOffset = (offset: number): number => {
    let lo = 0;
    let hi = newlineOffsets.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (newlineOffsets[mid] < offset) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };
  // Reuse the same balanced-parens scanner the broader checker uses
  // (`FLOAT_CALL_RE` handles one level of nesting). For each
  // `float(...)`, inspect the arg for destroyer patterns.
  for (const m of masked.matchAll(FLOAT_CALL_RE)) {
    const argStart = m.index! + m[0].indexOf("(") + 1;
    const argEnd = m.index! + m[0].lastIndexOf(")");
    const arg = src.slice(argStart, argEnd);
    if (!MPF_INNER_DESTROYER_RE.test(arg)) continue;
    const lineNum = lineForOffset(m.index!);
    // Display-context exemption — same logic as
    // `checkDoesNotDefaultToFloat`: lines containing `f"`/`print(`/
    // `.format(`/`assert`, or assignments to `*_pct`/`_ppb`/`_ppm`/
    // `_print`/`_display`/`_str` variables are presentation-only,
    // not substrate-compute paths. The conversion is INTENT (you
    // want a Python float for `:.6f` formatting, etc.).
    const lineCtx = ctxLines[lineNum - 1] ?? "";
    if (isDisplayContextLine(lineCtx)) continue;
    const original = m[0].replace(/\s+/g, " ").trim();
    hits.push({
      file: scriptPath,
      line: lineNum,
      text:
        `mpmath/sympy → float64 cast \`${
          original.slice(0, 80)
        }${original.length > 80 ? "…" : ""}\` — GUARANTEED precision loss; ` +
        `keep the value in mpmath (\`mp.mpf(str(...))\`) or sympy ` +
        `(\`sp.N(..., dps)\` without the outer \`float()\`).`,
    });
  }
  // Direct numpy.float64(...) / np.float64(...) sites — independent
  // family, same severity. Same display-context exemption.
  for (const m of masked.matchAll(NUMPY_FLOAT64_CALL_RE)) {
    const lineNum = lineForOffset(m.index!);
    const lineCtx = ctxLines[lineNum - 1] ?? "";
    if (isDisplayContextLine(lineCtx)) continue;
    const original = src
      .slice(m.index!, m.index! + m[0].length)
      .replace(/\s+/g, " ")
      .trim();
    hits.push({
      file: scriptPath,
      line: lineNum,
      text:
        `numpy.float64 cast \`${original.slice(0, 80)}\` — explicit ` +
        `float64 wrap; use \`mp.mpf\` to keep substrate precision.`,
    });
  }
  return { result: hits.length > 0 ? "fail" : "pass", hits };
}

// ─── respects_archimedean_wall ─────────────────────────────────

/**
 * Archimedean-realization functions that should NOT appear in
 * categorical / algebraic / substrate-precision code paths.
 * Per CLAUDE.md §7c, these belong in `archimedean-universe/` or
 * `observations/` archimedean-specialised modules, not in the
 * generic-R compute layer.
 *
 * The mpmath equivalents (`mp.sqrt`, `mp.log`, `mp.exp`, …) are
 * the correct substrate-precision substitutes.
 */
const ARCHIMEDEAN_FUNCTION_RE =
  /\b(?:math|numpy|np)\.(?:sqrt|log|log2|log10|log1p|exp|expm1|cos|sin|tan|acos|asin|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|pow|hypot|erf|erfc|gamma|lgamma|floor|ceil|trunc)\b/g;
const NUMPY_FLOAT64_RE = /\bnumpy\.float64\b|\bnp\.float64\b/g;

/**
 * Flag archimedean-floating-point operations (`math.sqrt`,
 * `numpy.cos`, `np.float64`, …) in Python source. These should
 * not appear in substrate-precision code paths — the mpmath
 * equivalents preserve the 50-digit working precision the rest
 * of the framework relies on.
 *
 * Strings and comments are masked before scanning so `# uses
 * math.sqrt for archimedean realization` style narrative does
 * not produce false positives.
 */
export function checkRespectsArchimedeanWall(
  scriptPath: string,
): CheckerResult {
  if (!existsSync(scriptPath)) return { result: "n/a", hits: [] };
  // Scripts under `_deprecated/` are already flagged by the
  // `deprecated` criterion — double-flagging the same scripts here
  // (since deprecated code commonly used the older math.*/np.* APIs)
  // is noise. The `deprecated` finding is the canonical signal;
  // archimedean violations don't need to pile on. Return n/a so the
  // sweep records the criterion was considered but didn't apply.
  if (scriptPath.includes("/_deprecated/")) {
    return { result: "n/a", hits: [] };
  }
  // Probe / audit / experiment scripts are exploratory by design.
  // Per the substrate-vs-archimedean wall (CLAUDE.md §7c), substrate
  // code MUST use mpmath; archimedean / exploratory code MAY use
  // float / math.* / np.*. Probe scripts ARE the archimedean
  // realization layer — flagging math.log inside a script literally
  // named `probe_*.py` is noise.
  //
  // Exemption pattern: basename matches `^(probe|audit|experiment|
  // shape_audit|sanity_check|exploratory|diag(nose|nostic)?)_…` OR
  // `…_probe.py` / `…_audit.py` / `…_experiment.py` suffix.
  // These naming conventions are used pervasively in
  // folio-assistant/computations/ for non-production exploratory
  // compute.
  const basename = scriptPath.split("/").pop() ?? "";
  const EXPLORATORY_RE =
    /^(?:probe|audit|experiment|shape_audit|sanity_check|exploratory|diag(?:nose|nostic)?)_/i;
  const EXPLORATORY_SUFFIX_RE =
    /_(?:probe|audit|experiment|exploratory)\.py$/i;
  if (
    EXPLORATORY_RE.test(basename) ||
    EXPLORATORY_SUFFIX_RE.test(basename)
  ) {
    return { result: "n/a", hits: [] };
  }
  // Per-file opt-out via audit-tag comment. A file whose header
  // declares `# archimedean_by_design:` is explicitly classified
  // as archimedean-realization code; the criterion doesn't apply.
  // Authors using this MUST also document the file in narrative
  // (per CLAUDE.md §7c the proper home is a separate
  // `archimedean-universe/` module, but tagging in place is the
  // cheaper unblock during migration).
  const src = readFileSync(scriptPath, "utf-8");
  if (/^\s*#\s*archimedean_by_design\s*:/m.test(src)) {
    return { result: "n/a", hits: [] };
  }
  const masked = maskStringsAndComments(src);
  const lines = masked.split("\n");
  // Comments-only mask so f-string markers remain visible (the
  // full maskStringsAndComments blanks quotes too, hiding `f"`).
  // Same approach as `checkDoesNotDefaultToFloat` (per PR #1093).
  const srcCommentsOnly = src.replace(PY_COMMENT_RE, blankNonNewline);
  const ctxLines = srcCommentsOnly.split("\n");
  const hits: CheckerHit[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    // Display-context exemption (mirrors PR #1093): `math.log(x)`
    // inside `print(f"…{math.log(x):.4f}")` or `assert math.log(x)
    // < 1e-6` is a presentation / comparison conversion, not a
    // substrate-precision compute path. The math.X call returns a
    // Python float, which the format spec `:.Nf` consumes natively
    // (mpmath 1.3.0's mpf.__format__ doesn't support all format
    // codes, so swapping to mp.X here CAUSES runtime regressions).
    //
    // Same display-intent variables — `_pct` / `_ppb` / `_ppm` /
    // `_print` / `_display` / `_str` / `_repr` suffix assignments
    // — are also exempt: they're explicit display-only variables.
    if (isDisplayContextLine(ctxLines[i] ?? "")) continue;
    for (const m of lines[i].matchAll(ARCHIMEDEAN_FUNCTION_RE)) {
      hits.push({
        file: scriptPath,
        line: i + 1,
        text:
          `archimedean call \`${m[0]}\` — use the mpmath equivalent ` +
          `(\`mp.${m[0].split(".")[1]}\`) for substrate-precision ` +
          `values, or move this code to an archimedean-realization ` +
          `module under \`archimedean-universe/\` / \`observations/\``,
      });
    }
    for (const _m of lines[i].matchAll(NUMPY_FLOAT64_RE)) {
      hits.push({
        file: scriptPath,
        line: i + 1,
        text:
          `numpy.float64 type — use \`mpmath.mpf\` for ` +
          `substrate-precision values; numpy.float64 truncates to ` +
          `IEEE-754 double precision (~15 decimal digits)`,
      });
    }
  }

  return {
    result: hits.length > 0 ? "fail" : "pass",
    hits,
  };
}

// ─── code_is_commented ─────────────────────────────────────────

// Module docstring at the top of a Python file. Tolerates the
// common preamble patterns: shebang (`#!/usr/bin/env python3`),
// `# ...` line comments (encoding declarations, mode markers,
// per-script audit tags like `# polynomial_q_not_applicable`),
// blank lines, and `from __future__ import` lines — any
// combination of these may precede the triple-quoted docstring.
// Many baseline `code_is_commented` fails were scripts that DO
// have a docstring but ship a shebang + audit-tag comment block
// above it; tolerating these patterns eliminates the false
// positives without weakening the actual "module has a
// docstring or rich comments" check.
//
// Leading whitespace `\s*` is allowed at the start of each
// preamble line so an indented `from __future__ import …` or an
// indented `# comment` (rare but legal Python) doesn't fail the
// match.
const MODULE_DOCSTRING_RE =
  /^(?:\s*\n|\s*#![^\n]*\n|\s*#[^\n]*\n|\s*from\s+__future__\s+import[^\n]*\n)*\s*("""[\s\S]*?"""|'''[\s\S]*?''')/;

/**
 * Pass if either:
 *   - A module docstring exists at the top of the file
 *     (allowing `from __future__ import …` to precede it), OR
 *   - Comment-line density is ≥ 10% of non-blank lines.
 *
 * Fail otherwise (suggests adding a `"""docstring"""` at the
 * module top). Authors override with a `human` reviewer entry.
 */
export function checkCodeIsCommented(scriptPath: string): CheckerResult {
  if (!existsSync(scriptPath)) return { result: "n/a", hits: [] };
  // Scripts under `_deprecated/` are already flagged by the
  // `deprecated` criterion — double-flagging is noise.
  if (scriptPath.includes("/_deprecated/")) {
    return { result: "n/a", hits: [] };
  }
  const src = readFileSync(scriptPath, "utf-8");
  if (MODULE_DOCSTRING_RE.test(src)) return { result: "pass", hits: [] };
  const lines = src.split("\n");
  let nonBlank = 0;
  let comments = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    nonBlank++;
    if (t.startsWith("#")) comments++;
  }
  if (nonBlank === 0) return { result: "n/a", hits: [] };
  const ratio = comments / nonBlank;
  if (ratio >= 0.1) return { result: "pass", hits: [] };
  return {
    result: "fail",
    hits: [
      {
        file: scriptPath,
        line: 1,
        text:
          `script lacks both a module docstring and ≥10% comment ` +
          `density (got ${comments}/${nonBlank} = ` +
          `${(ratio * 100).toFixed(1)}%) — add a top-of-file ` +
          `\`"""…"""\` docstring describing purpose and inputs / ` +
          `outputs, or increase inline commentary`,
      },
    ],
  };
}

// ─── variables_typed ───────────────────────────────────────────

const FUNCTION_DEF_RE = /^\s*(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/gm;

/**
 * Pass if every function-definition parameter list has type
 * annotations (`def foo(x: int, y: str)`). Excludes `self`,
 * `cls`, `*args`, `**kwargs`, and `_` (unused). Defaults without
 * type annotations are flagged.
 *
 * Heuristic — does not parse Python. Multi-line `def` signatures
 * with line breaks inside the parameter list are skipped (the
 * regex requires the `(…)` to fit on one logical line); those
 * are uncommon enough that the false-negative rate is acceptable.
 */
export function checkVariablesTyped(scriptPath: string): CheckerResult {
  if (!existsSync(scriptPath)) return { result: "n/a", hits: [] };
  // Scripts under `_deprecated/` are already flagged by the
  // `deprecated` criterion — double-flagging is noise.
  if (scriptPath.includes("/_deprecated/")) {
    return { result: "n/a", hits: [] };
  }
  const src = readFileSync(scriptPath, "utf-8");
  const masked = maskStringsAndComments(src);
  const hits: CheckerHit[] = [];
  const newlines: number[] = [];
  for (let i = 0; i < masked.length; i++)
    if (masked[i] === "\n") newlines.push(i);
  const lineFor = (off: number): number => {
    let lo = 0, hi = newlines.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (newlines[mid] < off) lo = mid + 1; else hi = mid;
    }
    return lo + 1;
  };

  for (const m of masked.matchAll(FUNCTION_DEF_RE)) {
    const fnName = m[1];
    const argsStr = (m[2] ?? "").trim();
    if (!argsStr) continue; // no-arg function is trivially typed
    const args = argsStr.split(",").map((a) => a.trim()).filter(Boolean);
    const untyped: string[] = [];
    for (const a of args) {
      // Strip default value if present (`x=5` → `x`).
      const beforeEq = a.split("=")[0].trim();
      // Exempt parameter forms.
      if (beforeEq === "self" || beforeEq === "cls" ||
          beforeEq === "_" ||
          beforeEq.startsWith("*") || beforeEq.startsWith("**") ||
          beforeEq === "/") {
        continue;
      }
      if (!beforeEq.includes(":")) untyped.push(beforeEq);
    }
    if (untyped.length > 0) {
      hits.push({
        file: scriptPath,
        line: lineFor(m.index!),
        text:
          `\`def ${fnName}(…)\` has ${untyped.length} parameter` +
          `${untyped.length === 1 ? "" : "s"} without type ` +
          `annotation: ${untyped.slice(0, 5).join(", ")}` +
          `${untyped.length > 5 ? ", …" : ""} — add \`: type\` ` +
          `(or \`: Any\` if the type genuinely is untyped)`,
      });
    }
  }

  return {
    result: hits.length > 0 ? "fail" : "pass",
    hits,
  };
}

// ─── has_references_to_paper ───────────────────────────────────

/**
 * Pass if the script has a `references: string[]` field declared
 * in its sidecar (per `ScriptQaReport.references`). Each entry is
 * a content-block label (`prop:foo`, `def:bar`, …) or a
 * bibliographic key matching an entry in
 * `content/schema/references.ts`.
 *
 * The checker reads **proper metadata only** — the sidecar JSON
 * field. There is no source-side grep / extraction at any point:
 * citation patterns embedded in script comments / docstrings are
 * NOT discovered by this criterion. References live as structured
 * metadata on the sidecar, mirroring how content blocks declare
 * `uses: [...]` / `meta.cites: [...]` arrays in their `.ts`
 * manifests.
 *
 * Pass / fail rules:
 *   - `sidecarReferences` is any defined array (including `[]`)
 *     → pass. An empty array `[]` is a deliberate "no references
 *     intended" declaration (e.g. pure infrastructure) and counts
 *     as explicit metadata.
 *   - `sidecarReferences` is `undefined` → fail. The script's
 *     sidecar has no `references` field; the human must add one
 *     (either listing the genuine citations or `[]` to declare
 *     "deliberately no refs").
 */
export function checkHasReferencesToPaper(
  scriptPath: string,
  sidecarReferences?: string[] | undefined,
): CheckerResult {
  if (!existsSync(scriptPath)) return { result: "n/a", hits: [] };
  // Scripts under `_deprecated/` are already flagged by the
  // `deprecated` criterion — double-flagging is noise.
  if (scriptPath.includes("/_deprecated/")) {
    return { result: "n/a", hits: [] };
  }
  // Sole check: sidecar metadata. An explicit empty array
  // (`[]`) is a deliberate "no references" declaration and passes;
  // `undefined` means the field has never been populated and the
  // script has no metadata-declared citation.
  if (sidecarReferences !== undefined) {
    return { result: "pass", hits: [] };
  }
  return {
    result: "fail",
    hits: [
      {
        file: scriptPath,
        line: 1,
        text:
          `script's sidecar has no \`references\` field — the ` +
          `criterion reads metadata only and does not grep source ` +
          `for citations. Add an explicit \`references: [...]\` ` +
          `entry to the script's \`.script-qa.json\` (content-block ` +
          `labels like \`prop:foo\`, bibliography keys like ` +
          `\`wenzl1988\`), or set \`references: []\` if the script ` +
          `is pure infrastructure with no paper backing`,
      },
    ],
  };
}

// ─── connected_to_ci_pipeline ──────────────────────────────────

let _workflowsCache: string | null = null;
let _workflowsCacheRepoRoot = "";

/**
 * Lazily-loaded concatenation of every `.github/workflows/*.yml`
 * file's content. The checker scans this string for the script's
 * basename — if found, the script is connected to the CI pipeline.
 */
function loadWorkflows(repoRoot: string): string {
  if (_workflowsCache !== null && _workflowsCacheRepoRoot === repoRoot) {
    return _workflowsCache;
  }
  const dir = join(repoRoot, ".github", "workflows");
  if (!existsSync(dir)) {
    _workflowsCache = "";
    _workflowsCacheRepoRoot = repoRoot;
    return "";
  }
  const parts: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".yml") && !entry.endsWith(".yaml")) continue;
    const p = join(dir, entry);
    if (!statSync(p).isFile()) continue;
    parts.push(readFileSync(p, "utf-8"));
  }
  _workflowsCache = parts.join("\n");
  _workflowsCacheRepoRoot = repoRoot;
  return _workflowsCache;
}

/**
 * Pass if the script's basename appears in at least one
 * `.github/workflows/*.yml` file. Used to flag scripts that are
 * never exercised in CI (likely candidates for `_deprecated/`).
 *
 * `__init__.py`, `conftest.py`, library / helper modules imported
 * from other scripts, and scripts under `_deprecated/` get an
 * `n/a` so they don't pollute the failure count.
 */
export function checkConnectedToCiPipeline(
  scriptPath: string,
  repoRoot: string,
): CheckerResult {
  if (!existsSync(scriptPath)) return { result: "n/a", hits: [] };
  const base = basename(scriptPath);
  if (
    base === "__init__.py" ||
    base === "conftest.py" ||
    scriptPath.includes("/_deprecated/")
  ) {
    return { result: "n/a", hits: [] };
  }
  const workflows = loadWorkflows(repoRoot);
  if (workflows.includes(base)) return { result: "pass", hits: [] };
  // Also check whether the script is imported as a module by any
  // other script (library / helper pattern). If so, it's "connected"
  // transitively through whichever script CI runs.
  const modName = base.replace(/\.py$/, "");
  // Crude probe: does the modName appear in any other .py under
  // computations as `from <modName> import` or `import <modName>`?
  // We don't recurse — a single grep against the parent dir suffices
  // for the common case.
  const parent = dirname(scriptPath);
  if (existsSync(parent)) {
    const importRe = new RegExp(
      `(?:^|\\s)(?:from\\s+${modName}\\s+import|import\\s+${modName}(?:\\s|$))`,
      "m",
    );
    for (const entry of readdirSync(parent)) {
      if (!entry.endsWith(".py")) continue;
      if (entry === base) continue;
      const p = join(parent, entry);
      try {
        const s = readFileSync(p, "utf-8");
        if (importRe.test(s)) return { result: "pass", hits: [] };
      } catch {
        // Skip unreadable
      }
    }
  }
  return {
    result: "fail",
    hits: [
      {
        file: scriptPath,
        line: 1,
        text:
          `script \`${base}\` is not referenced from any ` +
          `\`.github/workflows/*.yml\` and is not imported by any ` +
          `sibling script — likely never exercised in CI. Either ` +
          `add a workflow invocation, mark as a library by adding ` +
          `\`from <this-module> import\` somewhere, or move to ` +
          `\`_deprecated/\``,
      },
    ],
  };
}

// ─── deprecated ────────────────────────────────────────────────

// `# DEPRECATED` line comment. Restricted to the first 10 lines of
// the file so that module-level deprecation banners are flagged
// while in-file section headers like `# DEPRECATED ALIASES` (lines
// of code that document internal symbol aliases) are not.
const DEPRECATED_MARKER_RE = /^\s*#\s*DEPRECATED\b/m;

// `DEPRECATED` mention inside the module docstring. We strip
// backtick-quoted code spans before matching so a docstring that
// describes its subject (e.g. `legacy_formula_audit.py`'s "flags
// banner-marked defs (\`# LEGACY\`, \`# DEPRECATED\`, …)") doesn't
// self-flag.
const DEPRECATED_DOCSTRING_RE = /\bDEPRECATED\b/;

const DEPRECATED_MARKER_HEAD_LINES = 10;

/**
 * Flag the script as deprecated when ANY of:
 *   - Path contains `/_deprecated/`
 *   - First 10 lines contain a `# DEPRECATED` comment line at
 *     module top (script-level deprecation banner)
 *   - Module docstring (first triple-quoted block, minus inline
 *     code spans) contains the word "DEPRECATED" verbatim
 *     (case-sensitive — narrative use of "deprecated" in prose
 *     doesn't trigger)
 *
 * Severity is `minor` — deprecation is a status flag, not a
 * correctness bug. A `human` reviewer entry can move a deprecated
 * script to `pass` if it's intentionally retained for reference.
 */
export function checkDeprecated(scriptPath: string): CheckerResult {
  if (!existsSync(scriptPath)) return { result: "n/a", hits: [] };
  if (scriptPath.includes("/_deprecated/")) {
    return {
      result: "fail",
      hits: [
        {
          file: scriptPath,
          line: 1,
          text:
            `script lives under \`_deprecated/\` — consumers must ` +
            `not depend on its output. Move to the canonical path ` +
            `if still active, or delete if truly retired`,
        },
      ],
    };
  }
  const src = readFileSync(scriptPath, "utf-8");
  // Module-top check: only look at first 10 lines, so in-file
  // section headers (`# DEPRECATED ALIASES`, `# DEPRECATED PATHS`,
  // …) don't fire.
  const head = src
    .split("\n", DEPRECATED_MARKER_HEAD_LINES)
    .join("\n");
  if (DEPRECATED_MARKER_RE.test(head)) {
    return {
      result: "fail",
      hits: [
        {
          file: scriptPath,
          line: 1,
          text:
            `\`# DEPRECATED\` marker in module preamble — move ` +
            `script to \`_deprecated/\` to align path and content, ` +
            `or remove the marker if no longer deprecated`,
        },
      ],
    };
  }
  // Check just the first triple-quoted block (module docstring) for
  // a verbatim "DEPRECATED" — avoids matching prose use further
  // down. Strip backtick-quoted code spans so a docstring
  // describing patterns it audits FOR doesn't self-flag.
  const docstringMatch = src.match(MODULE_DOCSTRING_RE);
  if (docstringMatch) {
    const docstrProse = docstringMatch[1].replace(/`[^`]*`/g, "");
    if (DEPRECATED_DOCSTRING_RE.test(docstrProse)) {
      return {
        result: "fail",
        hits: [
          {
            file: scriptPath,
            line: 1,
            text:
              `module docstring contains "DEPRECATED" outside an ` +
              `inline code span — move script to \`_deprecated/\` ` +
              `to align path and content, or rephrase if no longer ` +
              `deprecated`,
          },
        ],
      };
    }
  }
  return { result: "pass", hits: [] };
}

// ─── uses_library_framework_appropriately ─────────────────────

const WITNESS_WRITE_RE = /["']\S*\.witness\.json["']/;
// Write-intent markers. A script counts as "writing" a witness
// only when it ALSO contains a write-side API call — json.dump,
// `.write_text(`, `.write(` on a file handle, or a direct
// WitnessBuilder.save invocation. Pure consumers (json.load,
// open(..., "r")) carry the string but don't produce a witness.
const WITNESS_WRITE_INTENT_RE =
  /\bjson\.dump\b|\.write_text\(|\.write_bytes\(|\.write\(|\bopen\s*\([^)]*['"][wax][b+]*['"]|WitnessBuilder\b|builder\.save\(/;
const WITNESS_BUILDER_IMPORT_RE =
  /from\s+witness_base\s+import[^\n]*\bWitnessBuilder\b|import\s+witness_base\b/;
const HARDCODED_PI_RE = /\bpi\s*=\s*3\.14\d*/;
const HARDCODED_E_RE = /\be\s*=\s*2\.71\d*/;

/**
 * Pass if the script consumes the standard library framework
 * appropriately:
 *
 *   - If the script writes a `.witness.json`, it must import
 *     `WitnessBuilder` from `witness_base` (provenance + script-
 *     hash metadata stamping).
 *   - No hardcoded mathematical constants (`pi = 3.14…`,
 *     `e = 2.71…`) — use `mpmath.mp.pi` / `mpmath.mp.e`.
 *
 * Strings and comments are masked before scanning so that
 * documentation strings like `"Generates foo.witness.json"` do
 * not produce false positives.
 */
export function checkUsesLibraryFrameworkAppropriately(
  scriptPath: string,
): CheckerResult {
  if (!existsSync(scriptPath)) return { result: "n/a", hits: [] };
  // Scripts under `_deprecated/` are already flagged by the
  // `deprecated` criterion — double-flagging is noise.
  if (scriptPath.includes("/_deprecated/")) {
    return { result: "n/a", hits: [] };
  }
  const src = readFileSync(scriptPath, "utf-8");
  const masked = maskStringsAndComments(src);
  const hits: CheckerHit[] = [];

  // Witness-write requires WitnessBuilder import. The witness path
  // is a STRING LITERAL in code (not a comment); `maskStringsAndComments`
  // blanks BOTH, so to detect string literals in code-not-comment
  // regions we need a comment-only mask that keeps string contents
  // intact.
  const srcWithoutComments = src.replace(PY_COMMENT_RE, blankNonNewline);
  // A script that only READS a `.witness.json` (e.g.
  // `json.load(open("foo.witness.json"))`) is a CONSUMER, not a
  // producer — it doesn't need WitnessBuilder. Only flag if the
  // script actually WRITES a witness (json.dump / open(..., "w") /
  // Path.write_text / WitnessBuilder.save itself absent). Detect
  // write-intent by presence of a `json.dump|Path.write_text|
  // \.write\(` call alongside the witness string. Without this,
  // pure-consumer scripts surface as ~10% noise on this criterion.
  const writesWitness = WITNESS_WRITE_RE.test(srcWithoutComments);
  const hasWriteIntent = WITNESS_WRITE_INTENT_RE.test(srcWithoutComments);
  const importsWitnessBuilder = WITNESS_BUILDER_IMPORT_RE.test(src);
  if (writesWitness && hasWriteIntent && !importsWitnessBuilder) {
    const m = srcWithoutComments.match(WITNESS_WRITE_RE);
    const line =
      m?.index !== undefined
        ? srcWithoutComments.slice(0, m.index).split("\n").length
        : 1;
    hits.push({
      file: scriptPath,
      line,
      text:
        `script writes \`.witness.json\` (${m?.[0] ?? "?"}) but does ` +
        `not import \`WitnessBuilder\` from \`witness_base\` — add ` +
        `\`from witness_base import WitnessBuilder\` and stamp the ` +
        `payload via \`WitnessBuilder.stamp_staleness_metadata(...)\` ` +
        `for provenance / staleness tracking`,
    });
  }

  // Hardcoded math constants — scan the masked copy so comments
  // don't trigger.
  const lines = masked.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (HARDCODED_PI_RE.test(lines[i])) {
      hits.push({
        file: scriptPath,
        line: i + 1,
        text:
          `hardcoded \`pi = 3.14…\` constant — use \`mpmath.mp.pi\` ` +
          `(50-digit substrate precision) or accept the precision ` +
          `loss explicitly`,
      });
    }
    if (HARDCODED_E_RE.test(lines[i])) {
      hits.push({
        file: scriptPath,
        line: i + 1,
        text:
          `hardcoded \`e = 2.71…\` constant — use \`mpmath.mp.e\` ` +
          `(50-digit substrate precision)`,
      });
    }
  }

  return {
    result: hits.length > 0 ? "fail" : "pass",
    hits,
  };
}

// ─── assertions_are_falsifiable ────────────────────────────────

/**
 * An `add_assertion(...)` call whose `computed` and `expected` are the SAME
 * expression, so the assertion holds by construction.
 *
 * `allPassed: true` is what a block's `computation.status: "verified"` rests
 * on. Where the assertion compares an expression to itself, `verified` means
 * the script ran — not that anything it produced was checked. The corpus case
 * that motivated this: `universal-ilp.py` asserted
 * `computed=sel[0], expected=sel[0]` at all five levels, so its witness
 * recorded `"computed": "sigma_1", "expected": "sigma_1"` and passed
 * regardless of what the script computed (bean `qou-v5fp`). An AST census then
 * found 266 of 3,482 such calls across 195 files (bean `qou-26f2`).
 *
 * ## Why regex and not AST
 *
 * Same trade-off as the rest of this module — no Python runtime in the QA
 * sweep. Measured against the AST census on the qou corpus, the regex finds
 * 240 of the 266 (90% recall) at 100% precision on the sampled hits. It
 * **under**-reports, which is the right direction for a `fail`-grade
 * criterion: a missed tautology stays a bean item, whereas a false one costs
 * an author an argument with the checker.
 *
 * The known recall gap is calls spanning many lines with the two keywords far
 * apart; `ASSERT_CALL_RE` bounds the window rather than matching greedily to
 * the next `)`, which a nested call would otherwise swallow.
 */
/** Triple-quoted Python blocks — docstrings and block comments. */
const PY_TRIPLE_QUOTED_RE = /"""[\s\S]*?"""|'''[\s\S]*?'''/g;

const ASSERT_CALL_RE = /add_assertion\s*\(([\s\S]{0,600}?)\)\s*(?:$|[,\n])/gm;
const KW_COMPUTED_RE = /(?:^|[\s,(])computed\s*=\s*([^,)]+)/;
const KW_EXPECTED_RE = /(?:^|[\s,(])expected\s*=\s*([^,)]+)/;

/**
 * Normalise an argument expression for comparison: collapse whitespace, drop a
 * trailing comment. Deliberately NOT semantic — `len(xs)` beside
 * `len(list(xs))` is just as vacuous and is not caught. See the caveat on
 * `qou-26f2`: this count is a lower bound.
 */
function normArg(s: string): string {
  return s.replace(/#.*$/, "").replace(/\s+/g, " ").trim();
}

/**
 * `assertions_are_falsifiable` — a witness assertion must be able to fail.
 *
 * Fires when `computed` and `expected` are textually the same expression.
 * Both keyword form (`computed=x, expected=x`) and the positional form
 * (`add_assertion(name, x, x)`) are checked.
 */
export function checkAssertionsAreFalsifiable(scriptPath: string): CheckerResult {
  if (!existsSync(scriptPath)) return { result: "n/a", hits: [] };
  let src: string;
  try {
    src = readFileSync(scriptPath, "utf-8");
  } catch {
    return { result: "n/a", hits: [] };
  }
  if (!src.includes("add_assertion")) return { result: "n/a", hits: [] };

  // Blank out triple-quoted blocks, preserving newlines so reported line
  // numbers stay true. `witness.py`'s own module docstring illustrates the API
  // with `computed=2.0298, expected=2.0298`, and firing on the documentation
  // of the function under test was the one false positive the first corpus run
  // produced.
  //
  // Only TRIPLE-quoted strings are blanked, not every string literal: a number
  // of genuine tautologies pass string values (`expected="0"`), and stripping
  // those would trade one false positive for a batch of missed real ones.
  const scan = src.replace(PY_TRIPLE_QUOTED_RE, (block) =>
    block.replace(/[^\n]/g, " "),
  );

  const hits: CheckerHit[] = [];
  for (const m of scan.matchAll(ASSERT_CALL_RE)) {
    const body = m[1];
    const c = body.match(KW_COMPUTED_RE);
    const e = body.match(KW_EXPECTED_RE);
    let computed: string | undefined;
    let expected: string | undefined;
    if (c && e) {
      computed = normArg(c[1]);
      expected = normArg(e[1]);
    } else if (!c && !e) {
      // Positional: add_assertion(name, computed, expected, …). Only consider
      // it when there is no keyword form at all, so a half-keyword call is
      // skipped rather than mis-parsed.
      const parts = body.split(",");
      if (parts.length < 3) continue;
      computed = normArg(parts[1]);
      expected = normArg(parts[2]);
    } else {
      continue;
    }
    if (!computed || !expected || computed !== expected) continue;
    const line = scan.slice(0, m.index ?? 0).split("\n").length;
    hits.push({
      file: scriptPath,
      line,
      text:
        `\`add_assertion\` compares \`${computed}\` to itself — ` +
        `\`computed\` and \`expected\` are the same expression, so this ` +
        `assertion holds by construction and \`allPassed\` says nothing ` +
        `about what the script produced. Supply the value the assertion is ` +
        `meant to check. If no independent expected value exists yet, assert ` +
        `a different property that CAN fail rather than a longer tautology ` +
        `— re-deriving the computation under test is the same defect spelled ` +
        `out (bean \`qou-26f2\`).`,
    });
  }

  return { result: hits.length > 0 ? "fail" : "pass", hits };
}
