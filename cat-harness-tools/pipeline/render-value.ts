/**
 * Witnessed-value rendering — `:val[name]{key=value...}` substitution.
 *
 * Loads the canonical witness JSON for each registered name, extracts
 * the value at the registered dotted path, and formats it according to
 * the directive attributes (precision, units, format, mode).
 *
 * Two call sites in `render-latex.ts`:
 *   1. `textDirective` mdast node — `:val[…]` outside math (renders
 *      the full `value units` clause, math-mode-wrapped if needed).
 *   2. Math-text regex pass — `:val[…]` literal text inside the `value`
 *      string of `inlineMath` / `math` nodes (renders the bare numeral
 *      without `$…$` wrappers, since math context is already open).
 *
 * @module pipeline/render-value
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { findContentRepoRoot } from "./repo-root";
import {
  WITNESSED_VALUES,
  lookupValue,
  type WitnessedValueEntry,
  type WitnessedValueFormat,
} from "./value-registry-di";

// Content repo root (the downstream repo embedding folio-assistant); witness
// files are resolved relative to this.  See ./repo-root for why import-relative
// resolution is wrong under the symlinked-subdir layout.
const REPO_ROOT = findContentRepoRoot();

// ── Witness JSON cache ───────────────────────────────────────────

const _witnessCache = new Map<string, unknown>();

/**
 * Load and parse a witness JSON file, caching the result for the
 * lifetime of the process.  Returns `null` if the file does not
 * exist or fails to parse.
 */
function loadWitness(file: string): unknown | null {
  const abs = resolve(REPO_ROOT, file);
  if (_witnessCache.has(abs)) return _witnessCache.get(abs) ?? null;
  if (!existsSync(abs)) {
    _witnessCache.set(abs, null);
    return null;
  }
  try {
    const text = readFileSync(abs, "utf-8");
    const parsed = JSON.parse(text);
    _witnessCache.set(abs, parsed);
    return parsed;
  } catch {
    _witnessCache.set(abs, null);
    return null;
  }
}

/** Reset the witness cache (for test harnesses or watch mode). */
export function clearWitnessCache(): void {
  _witnessCache.clear();
}

// ── Dotted-path resolution ───────────────────────────────────────

/**
 * Resolve `obj.a.b.0.c` style dotted paths.  Numeric segments index
 * arrays, but bracketed segments like `[2]_q` are kept as object keys
 * (the q-pinning witness uses `quantum_integers.[2]_q`).
 *
 * Returns `undefined` when any segment is missing.
 */
export function resolvePath(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;
  // Split on `.` but keep bracketed segments intact: "[2]_q" stays one
  // segment because the qint keys literally contain brackets in JSON.
  const segments = path.split(".");
  let cur: unknown = obj;
  for (const seg of segments) {
    if (cur == null || typeof cur !== "object") return undefined;
    // Try as object key first (covers "[2]_q"-style literal keys).
    if (Object.prototype.hasOwnProperty.call(cur, seg)) {
      cur = (cur as Record<string, unknown>)[seg];
      continue;
    }
    // Numeric segment for array indexing.
    if (Array.isArray(cur) && /^\d+$/.test(seg)) {
      cur = cur[Number(seg)];
      continue;
    }
    return undefined;
  }
  return cur;
}

// ── Value extraction ─────────────────────────────────────────────

/**
 * Extracted scalar — either a decimal string (preferred for
 * arbitrary-precision values) or a JS number.  Internal helpers
 * normalise to a decimal string before formatting so f64 conversion
 * never silently truncates the witness.
 */
export type RawScalar = { kind: "string"; value: string } | { kind: "number"; value: number };

export function asScalar(raw: unknown): RawScalar | null {
  if (typeof raw === "string") return { kind: "string", value: raw };
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { kind: "number", value: raw };
  }
  // PrecisionScalar envelope: { value: "<dec>", dps: N }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.value === "string" && typeof o.dps === "number") {
      return { kind: "string", value: o.value };
    }
  }
  return null;
}

// ── Number formatting ────────────────────────────────────────────

/**
 * Format a decimal-string value to `precision` significant digits
 * using round-half-even on the trailing digit.  Pure string surgery —
 * no float conversion — so 50-digit witnesses survive intact.
 *
 * Returns the formatted decimal string in the requested format
 * (decimal or scientific).  Scientific output uses LaTeX `\\times 10^{e}`.
 */
export function formatScalar(
  value: RawScalar,
  precision: number,
  format: WitnessedValueFormat,
): string {
  // Normalise to a sign-prefixed decimal string.  For numbers we use
  // toString — JS gives at most 17 significant digits, which is fine
  // because `precision` will be much smaller for native-number paths.
  const str = value.kind === "string" ? value.value : value.value.toString();
  return formatDecimalString(str, precision, format);
}

/** Internal: format a sign-prefixed decimal string. */
function formatDecimalString(
  str: string,
  precision: number,
  format: WitnessedValueFormat,
): string {
  const m = str.match(/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!m) return str;  // not parseable — pass through verbatim
  const sign = m[1] || "";
  const intPart = m[2];
  const fracPart = m[3] || "";
  const exp = m[4] ? parseInt(m[4], 10) : 0;

  // Build a digit string and locate the decimal point, then shift by exp.
  // E.g. "1.23e2" → digits="123", pointAfter=1+2=3 (i.e. "123.").
  const digits = intPart + fracPart;
  const pointAfter = intPart.length + exp;  // position of decimal in `digits`

  // Strip leading zeros to find the first significant digit.
  let firstSig = 0;
  while (firstSig < digits.length - 1 && digits[firstSig] === "0") firstSig++;
  const significant = digits.slice(firstSig);
  // Magnitude exponent (decimal): position of the leading digit.
  // pointAfter counts from the start of `digits`; subtracting firstSig
  // gives position relative to `significant`.  The leading digit's
  // exponent is (pointAfter - firstSig - 1).
  const mag = pointAfter - firstSig - 1;

  // Round to `precision` significant digits using half-even.
  const rounded = roundHalfEven(significant, precision);

  // Rounding can carry: "999" → precision 2 → "10" but with mag+=1.
  const outDigits = rounded.digits;
  const outMag = mag + rounded.carry;

  if (format === "scientific") {
    const lead = outDigits[0] ?? "0";
    const tail = outDigits.slice(1);
    const mantissa = tail.length > 0 ? `${lead}.${tail}` : lead;
    return `${sign}${mantissa} \\times 10^{${outMag}}`;
  }

  // Decimal layout: place the decimal point at outMag+1 from the left.
  return layoutDecimal(sign, outDigits, outMag);
}

/** Layout `digits` as a plain decimal with the leading digit at position `mag` (0 = ones place). */
function layoutDecimal(sign: string, digits: string, mag: number): string {
  if (mag >= 0) {
    // Integer part has mag+1 digits.
    const intLen = mag + 1;
    if (digits.length <= intLen) {
      // Pad with trailing zeros to reach the integer length.
      return sign + digits + "0".repeat(intLen - digits.length);
    }
    return sign + digits.slice(0, intLen) + "." + digits.slice(intLen);
  }
  // mag < 0: leading zeros after decimal point.
  const zeros = "0".repeat(-mag - 1);
  return sign + "0." + zeros + digits;
}

/**
 * Round a significant-digit string to `n` digits using IEEE 754
 * round-half-even (banker's rounding).  Returns the new digit string
 * and a `carry` of 0 or 1 to propagate to the magnitude exponent.
 */
function roundHalfEven(digits: string, n: number): { digits: string; carry: number } {
  if (digits.length <= n) {
    return { digits, carry: 0 };
  }
  const kept = digits.slice(0, n);
  const next = digits.charCodeAt(n) - 48;  // '0' = 48
  const restNonZero = /[1-9]/.test(digits.slice(n + 1));

  let roundUp = false;
  if (next > 5) roundUp = true;
  else if (next < 5) roundUp = false;
  else {
    // next === 5 — half: round up if remaining digits non-zero,
    // else round to even (last kept digit even ⇒ keep, odd ⇒ up).
    if (restNonZero) roundUp = true;
    else {
      const lastKept = kept.charCodeAt(n - 1) - 48;
      roundUp = (lastKept % 2) !== 0;
    }
  }

  if (!roundUp) return { digits: kept, carry: 0 };

  // Add 1 to the last digit, propagating carries.
  const out = kept.split("");
  let i = out.length - 1;
  while (i >= 0) {
    const d = out[i].charCodeAt(0) - 48 + 1;
    if (d < 10) {
      out[i] = String(d);
      return { digits: out.join(""), carry: 0 };
    }
    out[i] = "0";
    i--;
  }
  // Carry past the leading digit — magnitude grows by 1.
  return { digits: "1" + out.join(""), carry: 1 };
}

// ── Directive parsing ────────────────────────────────────────────

/** Attributes parsed from a `:val[name]{key=value ...}` occurrence. */
export interface ValAttrs {
  precision?: number;
  format?: WitnessedValueFormat;
  /** Force units rendering (`units=plain`) or suppress (`units=none`). */
  units?: "plain" | "none";
}

/** Parse mdast `node.attributes` (object or undefined) to ValAttrs. */
export function parseValAttrs(attrs: Record<string, string> | undefined): ValAttrs {
  if (!attrs) return {};
  const out: ValAttrs = {};
  if (attrs.precision) {
    const n = parseInt(attrs.precision, 10);
    if (Number.isFinite(n) && n > 0) out.precision = n;
  }
  if (attrs.format && (attrs.format === "decimal" || attrs.format === "scientific" || attrs.format === "measured")) {
    out.format = attrs.format;
  }
  if (attrs.units && (attrs.units === "plain" || attrs.units === "none")) {
    out.units = attrs.units;
  }
  return out;
}

// ── Public render API ────────────────────────────────────────────

/**
 * Render a witnessed value reference.
 *
 * - `mode = "math"` returns the bare numeral suitable for splicing
 *   into an existing math context (no `$…$` wrappers, units appended
 *   as `\\;\\text{…}` only if `units=plain`).
 * - `mode = "text"` returns the full clause `$value$\\,units` for
 *   inline prose contexts.
 *
 * If the entry is unknown, returns the literal token unchanged so the
 * rendered LaTeX surfaces the failure visibly rather than silently
 * dropping content.
 */
export function renderValue(
  name: string,
  attrs: ValAttrs,
  mode: "text" | "math",
): string {
  const entry = lookupValue(name);
  if (!entry) return literalFallback(name, attrs);

  // Pending entries (needsReview: true) are name reservations only.
  // Their witnessFile/witnessPath are placeholders, so attempting to
  // resolve them yields garbage.  Emit a visible TODO marker that
  // surfaces in the rendered PDF and tells reviewers to backfill.
  if (entry.needsReview) return pendingFallback(name, mode);

  const witness = loadWitness(entry.witnessFile);
  if (witness == null) return literalFallback(name, attrs);

  const raw = resolvePath(witness, entry.witnessPath);
  const scalar = asScalar(raw);
  if (scalar == null) return literalFallback(name, attrs);

  const precision = attrs.precision ?? entry.defaultPrecision;
  const format: WitnessedValueFormat = attrs.format ?? entry.format ?? "decimal";

  // `format=measured` requires an errorEntry; fall back to decimal when missing.
  let body: string;
  if (format === "measured" && entry.errorEntry) {
    const errEntry = lookupValue(entry.errorEntry);
    let errStr = "";
    if (errEntry) {
      const errWitness = loadWitness(errEntry.witnessFile);
      const errRaw = errWitness == null ? null : resolvePath(errWitness, errEntry.witnessPath);
      const errScalar = errRaw == null ? null : asScalar(errRaw);
      if (errScalar) {
        errStr = formatScalar(errScalar, attrs.precision ?? errEntry.defaultPrecision, "decimal");
      }
    }
    const valStr = formatScalar(scalar, precision, "decimal");
    body = errStr ? `${valStr} $\\pm$ ${errStr}` : valStr;
  } else {
    const fmt = format === "measured" ? "decimal" : format;
    body = formatScalar(scalar, precision, fmt);
  }

  // Units handling. Escape a LaTeX-special `%` in the unit string: a bare
  // `%` (e.g. units="%") starts a comment that eats the closing `$`/brace,
  // producing "! Missing $ inserted". (Other specials don't occur in units.)
  const showUnits = (attrs.units ?? "plain") !== "none";
  const rawUnits = showUnits && entry.units ? entry.units : null;
  const units = rawUnits ? rawUnits.replace(/%/g, "\\%") : null;

  if (mode === "math") {
    return units ? `${body}\\;\\text{${units}}` : body;
  }
  // text mode
  return units ? `$${body}$\\,${units}` : `$${body}$`;
}

/** Visible fallback when a directive does not resolve. */
function literalFallback(name: string, attrs: ValAttrs): string {
  // Reconstruct an approximate original directive — surfaces the
  // unresolved reference in the rendered PDF instead of silently
  // dropping it.
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  return attrStr ? `:val[${name}]{${attrStr}}` : `:val[${name}]`;
}

/**
 * Visible marker for pending (needsReview) entries.  Surfaces the
 * pending reference in the rendered PDF so reviewers see exactly
 * which `:val[…]` references still need a canonical witness.
 */
function pendingFallback(name: string, mode: "text" | "math"): string {
  const inner = `\\textbf{[TODO ${name}]}`;
  return mode === "math" ? `\\text{${inner}}` : inner;
}

// ── Math-text substitution pass ──────────────────────────────────

/**
 * Inline-math regex pattern for `:val[name]{k=v ...}` references that
 * survive inside the `value` string of an `inlineMath` / `math` mdast
 * node (remark-directive only fires on top-level text, not inside
 * math).  Matches:
 *
 *   :val[name]
 *   :val[name]{precision=6}
 *   :val[name]{precision=6 format=scientific}
 */
const MATH_VAL_PATTERN = /:val\[([A-Za-z_][A-Za-z0-9_]*)\](?:\{([^}]*)\})?/g;

/** Parse a `key=value key=value` attribute string from inside `{…}`. */
function parseInlineAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!s) return out;
  for (const part of s.trim().split(/\s+/)) {
    const m = part.match(/^([a-zA-Z_]+)=(.+)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/**
 * Substitute every `:val[…]` occurrence inside a math-mode string
 * with its rendered numeral.  Used by the `inlineMath` / `math` cases
 * in `renderMdastNode` and by `extractMathContent` for equation
 * blocks.  Idempotent on output (the rendered numeral does not match
 * the pattern).
 */
export function substituteValuesInMath(text: string): string {
  return text.replace(MATH_VAL_PATTERN, (_match, name: string, attrStr?: string) => {
    const attrs = parseValAttrs(parseInlineAttrs(attrStr ?? ""));
    return renderValue(name, attrs, "math");
  });
}

// ── Directive extraction (for validators / auto-link) ────────────

/** A single `:val[…]` occurrence found in a `.md` file. */
export interface ValOccurrence {
  /** Registry name. */
  name: string;
  /** Parsed attributes. */
  attrs: ValAttrs;
}

/**
 * Scan a markdown source string for every `:val[name]` reference,
 * regardless of math/text context.  Used by validators and the
 * block-level computation auto-link.
 *
 * Note: this is intentionally regex-based (not mdast) so it catches
 * directives inside `inlineMath` node values as well as top-level
 * directive nodes.  False positives inside fenced ` ```tex ` blocks
 * are tolerated — those locations *should* still resolve, since the
 * codemod only places valid names.
 */
export function extractValOccurrences(md: string): ValOccurrence[] {
  const out: ValOccurrence[] = [];
  // Reset regex state per call.
  const pat = /:val\[([A-Za-z_][A-Za-z0-9_]*)\](?:\{([^}]*)\})?/g;
  let m: RegExpExecArray | null;
  while ((m = pat.exec(md)) !== null) {
    out.push({
      name: m[1],
      attrs: parseValAttrs(parseInlineAttrs(m[2] ?? "")),
    });
  }
  return out;
}

/**
 * Distinct registry names referenced by any `:val[…]` in `md`.
 * Convenience wrapper used by the auto-link validator to compute
 * which witness files a block transitively depends on.
 */
export function referencedValueNames(md: string): readonly string[] {
  const seen = new Set<string>();
  for (const occ of extractValOccurrences(md)) seen.add(occ.name);
  return Object.freeze(Array.from(seen));
}

/**
 * Distinct canonical witness files referenced by any `:val[…]` in `md`.
 * Returns repo-root-relative paths; entries whose name is unregistered
 * are silently skipped (the validator will flag them).
 */
export function referencedWitnessFiles(md: string): readonly string[] {
  const files = new Set<string>();
  for (const name of referencedValueNames(md)) {
    const entry = lookupValue(name);
    if (entry) files.add(entry.witnessFile);
  }
  return Object.freeze(Array.from(files));
}

// Re-export registry helpers for downstream consumers.
export { WITNESSED_VALUES, lookupValue };
export type { WitnessedValueEntry, WitnessedValueFormat };
