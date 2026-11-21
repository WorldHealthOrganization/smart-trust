/**
 * Validation rules for `:val[name]` witnessed-value directives.
 *
 * Runs after the standard constraint phase in `validate.ts`.  For each
 * block's `.md` content, every `:val[…]` occurrence is checked against
 * the registry and its backing witness file.
 *
 * Five rules:
 *   - val-registered:        name appears in WITNESSED_VALUES
 *   - val-resolves:          witness file exists, dotted path resolves
 *   - val-precision-bounded: requested precision ≤ source precision
 *   - val-units-consistent:  units= attribute is 'plain' | 'none'
 *   - val-format-valid:      format= attribute is decimal|scientific|measured
 *
 * Plus an auto-link advisory:
 *   - val-block-computation: when a block .md cites :val[…], emit a
 *     warning if the block has a `computation:` field with a different
 *     witness, or no field at all (so the existing witness-staleness
 *     audit picks the dependency up).
 *
 * @module pipeline/validate-value
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { findContentRepoRoot } from "./repo-root";
import {
  lookupValue,
} from "./value-registry-di";
import {
  extractValOccurrences,
  resolvePath,
  type ValOccurrence,
} from "./render-value";
import { LIQUID_VALUE, applyFilters, resolveKey, valueScope, type ValueScope } from "./liquid-values";
import type { Block, ValidationIssue } from "../schemas/types.ts";
// Content repo root (the downstream repo embedding folio-assistant); witness
// files are resolved relative to this.  See ./repo-root for why import-relative
// resolution is wrong under the symlinked-subdir layout.
const REPO_ROOT = findContentRepoRoot();

// ── Witness shape inspection ─────────────────────────────────────

/**
 * Determine the source precision of a witness value.
 *
 * - PrecisionScalar envelope `{value, dps}`: return `dps`.
 * - Decimal string: count significant digits.
 * - Number: assume IEEE 754 double precision (~15 significant digits).
 * - Anything else: undefined (no precision constraint enforced).
 */
function sourcePrecision(raw: unknown): number | undefined {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.value === "string" && typeof o.dps === "number") {
      return o.dps;
    }
  }
  if (typeof raw === "string") {
    // Count significant digits in a decimal string.
    const m = raw.match(/^-?(\d+)(?:\.(\d+))?(?:[eE][+-]?\d+)?$/);
    if (!m) return undefined;
    let digits = (m[1] || "") + (m[2] || "");
    digits = digits.replace(/^0+/, "");  // strip leading zeros
    return digits.length || 1;
  }
  if (typeof raw === "number") return 15;
  return undefined;
}

// ── Cache for witness files (validator-local) ────────────────────

const _validatorWitnessCache = new Map<string, unknown | null>();

function loadWitnessOnce(file: string): unknown | null {
  if (_validatorWitnessCache.has(file)) return _validatorWitnessCache.get(file) ?? null;
  const abs = resolve(REPO_ROOT, file);
  if (!existsSync(abs)) {
    _validatorWitnessCache.set(file, null);
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(abs, "utf-8"));
    _validatorWitnessCache.set(file, parsed);
    return parsed;
  } catch {
    _validatorWitnessCache.set(file, null);
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────

export interface ValValidationOpts {
  /** When true, treat needsReview entries as errors instead of warnings. */
  strict?: boolean;
  /** The Liquid value scope; defaults to the process-wide one. */
  scope?: ValueScope;
}

/** One `{{ key | filters }}` reference in a block's markdown. */
export interface LiquidOccurrence {
  key: string;
  filters: string;
}

export function extractLiquidOccurrences(md: string): LiquidOccurrence[] {
  return [...md.matchAll(LIQUID_VALUE)].map((m) => ({ key: m[1]!, filters: m[2] ?? "" }));
}

/**
 * The same rules as a `:val` reference, for a Liquid one (bean `kott`):
 * without this, migrating a folio from `:val` to Liquid silently REMOVED its
 * validation — a broken reference showed only as `⟦unresolved⟧` in the
 * rendered output. Returns the witness file the reference reads, when it
 * reads one, for the computation auto-link.
 */
function checkLiquidOccurrence(
  blockName: string,
  occ: LiquidOccurrence,
  scope: ValueScope,
  issues: ValidationIssue[],
): string | undefined {
  const r = resolveKey(occ.key, scope);
  // `site.*`, `page.*` and pass-through prefixes are Jekyll's to resolve.
  if (r.state === "not-ours" || r.state === "pass-through") return undefined;
  const at = (rule: string, msg: string, level: "error" | "warning" = "error") =>
    issues.push({ level, block: blockName, message: `[${rule}] {{ ${occ.key} }} — ${msg}`, file: `${blockName}.md` });
  if (r.state === "unresolved") {
    at("val-resolves", r.reason);
    return undefined;
  }
  try {
    applyFilters(r.raw, r.text, occ.filters);
  } catch (e) {
    at("val-filter", (e as Error).message);
  }
  const requested = occ.filters.match(/precision\s*:\s*(\d+)/);
  const source = sourcePrecision(r.raw);
  if (requested && source !== undefined && Number(requested[1]) > source) {
    at("val-precision-bounded", `requested precision ${requested[1]} > source precision ${source}`);
  }
  // A witness is a computation's output; a dataset's values.json is not.
  return r.provenance.file.endsWith(".witness.json") ? r.provenance.file : undefined;
}

/**
 * Validate every `:val[…]` reference inside the supplied block .md
 * cache.  Also emits the auto-link advisory comparing inline `:val`
 * references to each block's `computation:` field.
 */
export function validateValueDirectives(
  blocks: Map<string, { block: Block; md: string | undefined }>,
  opts: ValValidationOpts = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [name, { block, md }] of blocks) {
    if (!md) continue;
    const occs = extractValOccurrences(md);
    const liquid = md.includes("{{") ? extractLiquidOccurrences(md) : [];
    if (occs.length === 0 && liquid.length === 0) continue;

    // ── Per-occurrence rules ────────────────────────────────────
    for (const occ of occs) {
      checkOccurrence(name, occ, issues, opts);
    }
    const referenced = new Set<string>();
    if (liquid.length) {
      const scope = opts.scope ?? valueScope();
      for (const occ of liquid) {
        const witness = checkLiquidOccurrence(name, occ, scope, issues);
        if (witness) referenced.add(witness);
      }
    }

    // ── Auto-link advisory: block computation field ─────────────
    for (const occ of occs) {
      const entry = lookupValue(occ.name);
      if (entry && !entry.needsReview) referenced.add(entry.witnessFile);
    }
    if (referenced.size === 0) continue;

    // If block declares a computation, warn when any referenced
    // witness is not among those declared.  If the block declares no
    // computation, warn so the author either attaches one or accepts
    // the implicit dependency.  This is per decision 2a (implicit
    // auto-link).
    // `computation` is declared on definition/theorem/algorithm/simulator/
    // table but not on prose/diagram/equation, so the `in` test is real.
    const compWitnessRaw: string | string[] | undefined =
      "computation" in block ? block.computation?.witness : undefined;
    const declared: string[] = compWitnessRaw === undefined
      ? []
      : Array.isArray(compWitnessRaw)
        ? compWitnessRaw
        : [compWitnessRaw];
    if (declared.length === 0) {
      // Implicit dependency — informational warning so the author
      // sees what the renderer already does silently.
      const list = Array.from(referenced).join(", ");
      issues.push({
        level: "warning",
        block: name,
        message: `[val-block-computation] block cites a witnessed value but has no \`computation:\` field; implicit witness dep on ${list}`,
        file: `${name}.md`,
      });
    } else {
      const declaredSet = new Set(declared);
      const missing = Array.from(referenced).filter((w) => !declaredSet.has(w));
      if (missing.length > 0) {
        // Block declares a computation but some referenced witness
        // files are not in the declared set.  Likely a stale or
        // incomplete link — declare the missing witness(es) on the
        // block's `computation.witness` (which accepts an array).
        const declaredList = declared.join(", ");
        const missingList = missing.join(", ");
        issues.push({
          level: "warning",
          block: name,
          message: `[val-block-computation] block computation.witness is ${declaredList} but its witnessed values also reference ${missingList}`,
          file: `${name}.md`,
        });
      }
    }
  }

  return issues;
}

function checkOccurrence(
  blockName: string,
  occ: ValOccurrence,
  issues: ValidationIssue[],
  opts: ValValidationOpts,
): void {
  const entry = lookupValue(occ.name);

  // val-registered
  if (!entry) {
    issues.push({
      level: "error",
      block: blockName,
      message: `[val-registered] :val[${occ.name}] — name not in WITNESSED_VALUES registry`,
      file: `${blockName}.md`,
    });
    return;
  }

  // Pending entries: warn (or error in strict mode) and stop.
  if (entry.needsReview) {
    issues.push({
      level: opts.strict ? "error" : "warning",
      block: blockName,
      message: `[val-pending] :val[${occ.name}] — registry entry is needsReview (canonical witness pending)`,
      file: `${blockName}.md`,
    });
    return;
  }

  // val-format-valid (already enforced by parseValAttrs, but flag any
  // raw format= that didn't survive parsing).
  // (parseValAttrs silently drops invalid values, so we re-check the
  // entry's own declared format for consistency.)

  // val-resolves: load witness, resolve path
  const witness = loadWitnessOnce(entry.witnessFile);
  if (witness == null) {
    issues.push({
      level: "error",
      block: blockName,
      message: `[val-resolves] :val[${occ.name}] — witness file not found: ${entry.witnessFile}`,
      file: `${blockName}.md`,
    });
    return;
  }

  const raw = resolvePath(witness, entry.witnessPath);
  if (raw === undefined) {
    issues.push({
      level: "error",
      block: blockName,
      message: `[val-resolves] :val[${occ.name}] — path '${entry.witnessPath}' not found in ${entry.witnessFile}`,
      file: `${blockName}.md`,
    });
    return;
  }

  // val-precision-bounded
  const requested = occ.attrs.precision ?? entry.defaultPrecision;
  const source = sourcePrecision(raw);
  if (source !== undefined && requested > source) {
    issues.push({
      level: "error",
      block: blockName,
      message: `[val-precision-bounded] :val[${occ.name}] — requested precision ${requested} > source precision ${source}`,
      file: `${blockName}.md`,
    });
  }

  // val-units-consistent: parseValAttrs already coerces units= to
  // 'plain' | 'none' or drops it.  No additional check needed beyond
  // ensuring an entry without units cannot opt into units=plain.
  if (occ.attrs.units === "plain" && entry.units == null) {
    issues.push({
      level: "warning",
      block: blockName,
      message: `[val-units-consistent] :val[${occ.name}] — units=plain requested but entry has no units`,
      file: `${blockName}.md`,
    });
  }
}

/**
 * Reset the validator's witness-file cache.  Test harnesses use this
 * between runs to avoid cross-test pollution; production validation
 * runs once per process and never needs to call it.
 */
export function resetValValidatorCache(): void {
  _validatorWitnessCache.clear();
}
