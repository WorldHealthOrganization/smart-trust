/**
 * `:leanval[…]` codemod — keeps numeric literals inside `.lean`
 * source files in sync with the canonical witness JSONs registered
 * in `content/values/registry.ts`.
 *
 * Mirror of `codemod-val.ts` for the markdown side; the registry
 * is the **single source of truth** consumed by both codemods so
 * a witness update propagates atomically to every tagged Lean
 * literal.
 *
 * ## Tag syntax (Lean side)
 *
 * A Lean line ending with the magic comment
 *
 *     -- :leanval[NAME]
 *     -- :leanval[NAME]{precision=N}
 *
 * declares that the *immediately preceding decimal literal on the
 * same line* tracks the witnessed value `NAME` (registered in
 * `WITNESSED_VALUES`).  Examples:
 *
 *     volume     := 2.029883212819307  -- :leanval[Vol_4_1]{precision=15}
 *     mostow_gap := 0.5                -- :leanval[mostow_gap_4_1]
 *
 * The codemod looks up `NAME`, formats the witness value to the
 * requested precision (or the registry default), and rewrites the
 * literal in place.  Comment text after the directive is preserved.
 *
 * ## Modes
 *
 * Invoke from the repo root (the path the CI workflow uses):
 *
 *   bun run cat-harness-tools/pipeline/codemod-leanval.ts              # dry-run, prints diff summary
 *   bun run cat-harness-tools/pipeline/codemod-leanval.ts --write      # apply rewrites
 *   bun run cat-harness-tools/pipeline/codemod-leanval.ts --check      # CI gate: exit 1 if any
 *                                                            # rewrite would happen
 *
 * ## Idempotency / safety
 *
 *   - Replacement is **byte-for-byte identical** when the literal
 *     already matches the witness; no diff is emitted.
 *   - Entries flagged `needsReview` in the registry are skipped
 *     (the codemod will not apply unverified values).
 *   - Lines that lack the magic comment are never touched, so
 *     hand-edited literals elsewhere in the file are untouched.
 *   - A literal that fails to parse (e.g. starts with `0x` or a
 *     fraction) is reported and skipped.
 *
 * @module pipeline/codemod-leanval
 */

import { folioDir } from "../schemas/kg/cat-harness.js";
import { readFileSync, writeFileSync, statSync, readdirSync } from "fs";
import { resolve, join, extname } from "path";
import {
  lookupValue,
  type WitnessedValueEntry,
} from "./value-registry-di";
import { resolvePath } from "./render-value";
import { findContentRepoRoot } from "./repo-root";

const REPO_ROOT = findContentRepoRoot();

// ── Tag matcher ──────────────────────────────────────────────────

/**
 * Matches a Lean line of the form
 *
 *     <prefix>= <literal>  -- :leanval[NAME]{key=value,...}
 *
 * Capture groups:
 *   1: prefix (everything up to and including the literal's
 *      preceding whitespace; preserved verbatim)
 *   2: numeric literal (replaced)
 *   3: comment-side spacing + the rest of the comment after the
 *      directive (preserved verbatim)
 *   4: tag NAME
 *   5: optional `{…}` attribute string (sans braces); empty if absent
 */
// `(?<![\d./])` keeps us from matching mid-fraction (e.g. the `2`
// in `1/2`) or a digit immediately preceded by another digit/period
// that the prefix's non-greedy match would otherwise hand us.
const LEAN_TAG_RE =
  /^(\s*[^\n]*?)(?<![\d./])(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(\s+--\s+:leanval\[)(\w+)\](?:\{([^}]*)\})?(.*)$/;

interface LiteralRewrite {
  filePath: string;          // repo-root-relative
  lineNo: number;            // 1-based
  oldLine: string;
  newLine: string;
  name: string;
  reason?: string;           // when the rewrite is skipped
}

// ── Witness JSON cache ───────────────────────────────────────────

const _witnessCache = new Map<string, unknown | null>();
function loadWitness(file: string): unknown | null {
  if (_witnessCache.has(file)) return _witnessCache.get(file) ?? null;
  const abs = resolve(REPO_ROOT, file);
  try {
    const text = readFileSync(abs, "utf-8");
    const parsed = JSON.parse(text);
    _witnessCache.set(file, parsed);
    return parsed;
  } catch {
    _witnessCache.set(file, null);
    return null;
  }
}

// ── Value formatting ─────────────────────────────────────────────

/**
 * Format a witness value for embedding as a Lean ℝ literal.
 * Truncates (does not round) to the requested number of significant
 * digits to avoid silently shifting the value upward.
 */
function formatLiteral(canonical: string, precision: number): string {
  const m = canonical.match(/^(-?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!m) throw new Error(`Unparseable witness value: ${canonical}`);
  const [, sign, intPart, fracRaw = "", expRaw = ""] = m;
  const exp = expRaw ? parseInt(expRaw, 10) : 0;
  if (exp !== 0) {
    // Defer scientific-notation handling to a later pass — the
    // current call sites all use plain decimals.
    throw new Error(
      `Scientific notation in witness value not yet supported: ${canonical}`,
    );
  }
  // Build the digit stream and truncate at `precision` significant
  // digits (post-leading-zero).
  const stripped = (intPart + fracRaw).replace(/^0+/, "") || "0";
  const visibleDigits = stripped.length;
  const outInt = intPart;
  let outFrac = fracRaw;
  if (visibleDigits > precision) {
    const intDigits = intPart === "0" ? 0 : intPart.length;
    // Leading zeros in the fraction are NOT significant digits when
    // the integer part is "0" (e.g. "0.00123" has 3 sig digits, not
    // 5).  Add them back into the kept-fraction count so precision=2
    // yields "0.0012", not "0.00".
    const leadingZeros =
      intPart === "0" ? (fracRaw.match(/^0*/)?.[0].length ?? 0) : 0;
    const fracKeep = Math.max(0, precision - intDigits + leadingZeros);
    outFrac = fracRaw.slice(0, fracKeep);
  }
  const lit = outFrac.length > 0 ? `${outInt}.${outFrac}` : outInt;
  return sign + lit;
}

function entryCanonical(entry: WitnessedValueEntry): string | null {
  const witness = loadWitness(entry.witnessFile);
  if (witness == null) return null;
  const raw = resolvePath(witness, entry.witnessPath);
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw.toString();
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.value === "string") return o.value;
  }
  return null;
}

// ── Per-line rewrite ─────────────────────────────────────────────

interface ParsedAttrs {
  precision?: number;
}

function parseAttrs(s: string): ParsedAttrs {
  const out: ParsedAttrs = {};
  for (const pair of s.split(",")) {
    const [k, v] = pair.split("=").map((x) => x.trim());
    if (k === "precision" && v) {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n > 0) out.precision = n;
    }
  }
  return out;
}

function rewriteLine(
  line: string,
  filePath: string,
  lineNo: number,
): LiteralRewrite | null {
  const m = LEAN_TAG_RE.exec(line);
  if (!m) return null;
  const [, prefix, literal, midComment, name, attrStr = "", tail] = m;
  const entry = lookupValue(name);
  if (!entry) {
    return {
      filePath,
      lineNo,
      oldLine: line,
      newLine: line,
      name,
      reason: `unknown registry name: ${name}`,
    };
  }
  if (entry.needsReview) {
    return {
      filePath,
      lineNo,
      oldLine: line,
      newLine: line,
      name,
      reason: `entry needsReview — skipping`,
    };
  }
  const canonical = entryCanonical(entry);
  if (!canonical) {
    return {
      filePath,
      lineNo,
      oldLine: line,
      newLine: line,
      name,
      reason: `unable to resolve witness value`,
    };
  }
  const attrs = parseAttrs(attrStr);
  const precision = attrs.precision ?? entry.defaultPrecision;
  const newLit = formatLiteral(canonical, precision);
  if (newLit === literal) return null;  // already in sync
  // Reconstruct the line with the original attrs/tail preserved.
  const attrSuffix = attrStr ? `{${attrStr}}` : "";
  const newLine = `${prefix}${newLit}${midComment}${name}]${attrSuffix}${tail}`;
  return { filePath, lineNo, oldLine: line, newLine, name };
}

// ── Per-file processing ──────────────────────────────────────────

interface FileResult {
  filePath: string;
  rewrites: LiteralRewrite[];     // applied (or candidate)
  skipped: LiteralRewrite[];      // skipped with reason
}

function processFile(absPath: string): FileResult {
  const repoRel = absPath.startsWith(REPO_ROOT)
    ? absPath.slice(REPO_ROOT.length + 1)
    : absPath;
  const text = readFileSync(absPath, "utf-8");
  const lines = text.split("\n");
  const rewrites: LiteralRewrite[] = [];
  const skipped: LiteralRewrite[] = [];
  for (let i = 0; i < lines.length; i++) {
    const r = rewriteLine(lines[i], repoRel, i + 1);
    if (r == null) continue;
    if (r.reason) skipped.push(r);
    else rewrites.push(r);
  }
  return { filePath: repoRel, rewrites, skipped };
}

function* walkLeanFiles(root: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === ".lake" || name === "lake-packages" || name === "build")
      continue;
    const full = join(root, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walkLeanFiles(full);
    } else if (st.isFile() && extname(full) === ".lean") {
      yield full;
    }
  }
}

// ── CLI ──────────────────────────────────────────────────────────

function usage(): never {
  console.error(
    "usage: bun run cat-harness-tools/pipeline/codemod-leanval.ts [<lean-root>] [--write|--check]",
  );
  process.exit(2);
}

function main(): void {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const positional = args.filter((a) => !a.startsWith("--"));
  const root = positional[0]
    ? resolve(positional[0])
    : folioDir(REPO_ROOT);
  const write = flags.has("--write");
  const check = flags.has("--check");
  if (write && check) usage();

  const results: FileResult[] = [];
  for (const file of walkLeanFiles(root)) {
    const r = processFile(file);
    if (r.rewrites.length > 0 || r.skipped.length > 0) results.push(r);
  }

  let totalRewrites = 0;
  let totalSkipped = 0;
  for (const r of results) {
    if (r.rewrites.length > 0) {
      console.log(`\n${r.filePath}`);
      // Read once per file; apply all rewrites in memory; write once.
      const absPath = resolve(REPO_ROOT, r.filePath);
      const lines = write
        ? readFileSync(absPath, "utf-8").split("\n")
        : null;
      for (const rw of r.rewrites) {
        console.log(`  L${rw.lineNo}  [${rw.name}]`);
        console.log(`    - ${rw.oldLine.trim()}`);
        console.log(`    + ${rw.newLine.trim()}`);
        if (write && lines) lines[rw.lineNo - 1] = rw.newLine;
        totalRewrites++;
      }
      if (write && lines) writeFileSync(absPath, lines.join("\n"));
    }
    for (const sk of r.skipped) {
      console.log(`\n${r.filePath} L${sk.lineNo}  [${sk.name}] skipped: ${sk.reason}`);
      totalSkipped++;
    }
  }

  console.log("");
  if (totalRewrites === 0 && totalSkipped === 0) {
    console.log("✓ All :leanval-tagged literals in sync.");
  } else {
    console.log(
      `Summary: ${totalRewrites} rewrite(s)${write ? " applied" : " pending"}` +
        `, ${totalSkipped} skipped.`,
    );
  }

  if (check && totalRewrites > 0) {
    console.error(
      "\n✗ --check: tagged Lean literals are out of sync with witnesses.\n" +
        "  Run `bun run cat-harness-tools/pipeline/codemod-leanval.ts --write` to refresh.",
    );
    process.exit(1);
  }
  if (totalSkipped > 0 && check) {
    // Skipped lines (unknown name, unresolved witness) also fail
    // --check so review is forced.
    process.exit(1);
  }
}

main();
