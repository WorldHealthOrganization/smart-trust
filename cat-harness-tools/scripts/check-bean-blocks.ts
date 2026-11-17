#!/usr/bin/env bun
/**
 * A bean that declares a block must say when it goes stale — ENFORCED.
 *
 * @module scripts/check-bean-blocks
 * @graphNode none — a checker over the `bean-defs` graph
 * @covers bean-defs
 *
 * It reuses `readBeans`, `resolveBeanDefs`, `hasExpiry` and `beanFindings`
 * from `scripts/beans.ts` rather than restating them. `beanFindings` emits
 * **`blocked-without-expiry`**, but its other consumer, `gen-docs-pages.ts`,
 * only publishes it; this is what FAILS.
 *
 * There is no `status: blocked`: `beans update --status` accepts only
 * in-progress, todo, draft, completed and scrapped (`BeanStatusSchema`). A
 * block is declared with a `## Blocked on` section.
 *
 * ## What this gates, and what it only reports
 *
 * | shape | treatment |
 * |---|---|
 * | a `## Blocked on` section | **ENFORCED** — all four fields or the gate fails |
 * | a relation-block with no expiry (`beanFindings`) | surfaced on every run |
 * | blocking language in prose only | counted, never failed |
 *
 * Prose is not gated: the same words assert, retract or report on a block,
 * so a gate firing on them would go red on beans that are not blocked.
 *
 * Usage:
 *   bun run cat check:bean-blocks
 *   bun run cat check:bean-blocks --list   # ...and name every unstructured bean
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { beanFindings, hasExpiry, readBeans, resolveBeanDefs, type BeanNode } from "./beans.ts";
import { repoRootFor } from "../schemas/kg/cat-harness.ts";
import "../schemas/kg/folio-graph-typology.js";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = HARNESS_ROOT;

/**
 * Blocks declared before this gate existed.
 *
 * Same mechanism and the same file shape as `bean-parents-baseline.json`, for
 * the same reason: a gate that lands RED on `main` gets switched off, and a
 * gate switched off is indistinguishable from one that passes (`1xhc`). The
 * two entries it carries are the stream 2 and stream 3 consolidation claims
 * (issue #956), which declare a genuine block on the owner and predate the
 * four fields.
 *
 * REPAIRING THEM IS NOT THE CHECKER-AUTHOR'S TO DO. `expires` is a date
 * somebody has to choose and `handoff` says what happens when it passes;
 * both are judgements about somebody else's block. `bean-blocking.md` already
 * draws this line for an external block — `cz17` waits on WHO, and no agent
 * may invent WHO's date — and a sibling stream's claim is the same shape.
 *
 * The file may only SHRINK: an entry nothing matches is reported stale and
 * fails, so a repair cannot leave a licence behind.
 */
export const BASELINE_FILE = "cat-harness-tools/scripts/bean-blocks-baseline.json";

/** A defect's identity, stable across a title edit: the verdict and the bean. */
const key = (verdict: string, id: string): string => `${verdict}:${id}`;

function loadBaseline(root: string): Set<string> {
  const f = resolve(root, BASELINE_FILE);
  if (!existsSync(f)) return new Set();
  const raw: unknown = JSON.parse(readFileSync(f, "utf-8"));
  const entries = (raw as { outstanding?: unknown }).outstanding;
  return new Set(
    Array.isArray(entries) ? entries.filter((e): e is string => typeof e === "string") : [],
  );
}

/** The heading that makes a block CHECKABLE. */
export const BLOCK_HEADING = /^##+\s*blocked\s+on\b/im;

/**
 * The three fields this module checks for itself.
 *
 * `expires` is NOT here — `hasExpiry` in `beans.ts` owns that question, and it
 * matches `expires`/`expiry`/`expire` deliberately loosely so a detector never
 * accuses somebody who complied. Restating the pattern here would be a second
 * answer to it.
 */
export const REQUIRED_FIELDS = [
  { key: "waits on", why: "so a reader can tell whether the thing has since happened" },
  { key: "since", why: "so staleness is visible" },
  { key: "handoff", why: "what a DIFFERENT agent should do on picking it up" },
] as const;

/** Generous on purpose: its false positives cost a line, not a red gate. */
const PROSE_BLOCK = /\b(blocked|waits on|waiting on)\b/i;

export type Verdict = "ok" | "incomplete" | "unstructured";

export interface BeanBlock {
  id: string;
  verdict: Verdict;
  /** For `incomplete`: which fields are absent, `expires` included. */
  missing: string[];
}

/**
 * Read one bean's block record.
 *
 * Takes the `BeanNode` so the expiry question goes through `hasExpiry`, and
 * the raw text because the heading is a property of the file rather than of
 * the parsed node.
 */
export function inspect(b: BeanNode, text: string): BeanBlock | undefined {
  if (BLOCK_HEADING.test(text)) {
    const lower = text.toLowerCase();
    const missing: string[] = REQUIRED_FIELDS.filter((f) => !lower.includes(f.key)).map(
      (f) => f.key as string,
    );
    if (!hasExpiry(b)) missing.push("expires");
    return { id: b.id, verdict: missing.length === 0 ? "ok" : "incomplete", missing };
  }
  // Only an in-progress bean is a live stall: a `todo` mentioning blocking
  // describes future work and a `completed` one describes history.
  if (b.status === "in-progress" && PROSE_BLOCK.test(text)) {
    return { id: b.id, verdict: "unstructured", missing: [] };
  }
  return undefined;
}

/** Every bean carrying a block. */
export function scan(repoRoot: string, beans: readonly BeanNode[]): BeanBlock[] {
  const out: BeanBlock[] = [];
  for (const b of beans) {
    let text: string;
    try {
      text = readFileSync(join(repoRoot, b.file), "utf-8");
    } catch {
      continue;
    }
    const v = inspect(b, text);
    if (v !== undefined) out.push(v);
  }
  return out;
}

if (import.meta.main) {
  const repoRoot = repoRootFor(ROOT);
  const where = resolveBeanDefs(repoRoot);
  if (where.dir === null) {
    // NOT a pass. Nothing was examined, and saying so differs from saying
    // every block is well formed.
    console.log("Bean blocks — no `bean-defs` graph is declared, so nothing was checked");
    process.exit(0);
  }
  const beans = readBeans(repoRoot);
  if (beans === null) {
    console.error("Bean blocks — the `bean-defs` graph is declared and could not be read");
    process.exit(2);
  }

  const found = scan(repoRoot, beans);
  const baseline = loadBaseline(repoRoot);
  const incomplete = found.filter((b) => b.verdict === "incomplete");
  const bad = incomplete.filter((b) => !baseline.has(key(b.verdict, b.id)));
  const outstanding = incomplete.filter((b) => baseline.has(key(b.verdict, b.id)));
  /* A baseline entry nothing matched: the bean was repaired, or renamed away.
   * Reported and FAILED, so the file can only shrink — a licence that outlives
   * its defect is how a baseline turns into a permanent exemption. */
  const matched = new Set(incomplete.map((b) => key(b.verdict, b.id)));
  const stale = [...baseline].filter((k) => !matched.has(k)).sort();
  const prose = found.filter((b) => b.verdict === "unstructured");
  const ok = found.filter((b) => b.verdict === "ok");
  const relation = beanFindings(beans).filter((f) => f.kind === "blocked-without-expiry");

  /* `incomplete.length`, NOT `bad.length`. Reporting the post-baseline figure
   * here would print "0 incomplete" directly above two incomplete entries —
   * a count refuted by the next line, which is `itka`'s defect in miniature.
   * A baseline changes what FAILS; it does not change what is true. */
  console.log(
    `Bean blocks (${ok.length} structured and complete, ${incomplete.length} incomplete` +
      `${outstanding.length > 0 ? ` (${outstanding.length} baselined)` : ""}, ` +
      `${prose.length} in prose only, over ${beans.length} bean(s))`,
  );

  for (const b of bad) {
    console.error(`  ✗ ${b.id} declares a block and omits: ${b.missing.join(", ")}`);
  }

  for (const b of outstanding) {
    console.log(
      `  · outstanding (baselined): ${b.id} declares a block and omits: ${b.missing.join(", ")}` +
        " — its owner supplies these, not this check",
    );
  }

  for (const k of stale) {
    console.error(`  ✗ baseline entry matches nothing: ${k} — remove it from ${BASELINE_FILE}`);
  }

  if (relation.length > 0) {
    // Surfaced here because `beanFindings`' only other consumer publishes it
    // to a docs page. Advisory: a relation-block is a different shape from a
    // declared one, and gating it would fail beans nobody has asked to change.
    console.log(
      `  · ${relation.length} relation-block(s) carry no expiry — \`beanFindings\`' ` +
        "`blocked-without-expiry`, which until now reached only a docs page",
    );
  }

  if (prose.length > 0) {
    console.log(
      `  · ${prose.length} in-progress bean(s) use blocking language with no ` +
        "`## Blocked on` section, so no date can expire them. Advisory — prose is too " +
        "varied to gate on, and a gate that fires on “no longer blocked” gets switched off.",
    );
    if (process.argv.includes("--list")) for (const b of prose) console.log(`      ${b.id}`);
    else console.log("      Run with `--list` to name them.");
  }

  if (bad.length > 0 || stale.length > 0) {
    if (bad.length > 0) {
      console.error(
        "\nA block with no expiry cannot be told from abandoned work. " +
          "See `work-plan/skills/work-plan/bean-blocking.md` for the four fields.",
      );
    }
    process.exit(1);
  }
  if (found.length === 0 && relation.length === 0) {
    console.log("  ✓ no bean declares a block");
  } else if (outstanding.length > 0) {
    /* NOT "every block is complete". `itka` is the worked example of a summary
     * asserting a universal that the line below it refutes; the count goes in
     * the claim so a reader who stops at the tick is not misled. */
    console.log(
      `  ✓ every NEW block carries the four fields — ${outstanding.length} baselined above, ` +
        "which this check holds level rather than clears",
    );
  }
  process.exit(0);
}
