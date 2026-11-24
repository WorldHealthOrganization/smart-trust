/**
 * A pinned install must not fall back to an unpinned one.
 *
 * `bun install --frozen-lockfile` exists to FAIL when the lockfile does not
 * satisfy the manifest; `|| bun install` turns that failure into a silent,
 * green, unpinned resolve. (With `cd dir && ... || bun install`, a failed `cd`
 * also runs the fallback in the wrong directory.)
 *
 * | | |
 * |---|---|
 * | a pin that DEGRADES (`--frozen-lockfile \|\|`) | **fails, always, never baselined** |
 * | an install with NO pin | baselined; a NEW one fails |
 *
 * An unpinned install is sometimes right: a guarded block may fall back to one
 * deliberately and say so with a `::warning::`.
 *
 * Not checked: that any lockfile is current, or any single dependency.
 *
 * @module scripts/check-lockfile-pinning
 * @covers code
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { checkoutName } from "./workflow-pins.ts";

const TOOLS_ROOT = resolve(import.meta.dir, "..");
const ROOT = join(import.meta.dir, "..", "..");
const WORKFLOWS = join(ROOT, ".github", "workflows");
const BASELINE = join(TOOLS_ROOT, "scripts", "lockfile-pinning-baseline.json");

/** A pinned install whose failure is swallowed by a fallback. */
const DEGRADING_PIN = /--frozen-lockfile[^\n]*\|\|/;

/** `cd <dir> && …` on one line: if the cd fails, everything after `||` runs in the WRONG cwd. */
const CD_AND_FALLBACK = /\bcd\s+\S+\s*&&[^\n]*\|\|/;

export interface PinFinding {
  workflow: string;
  line: number;
  text: string;
  why: string;
  /** `degrading` always fails; `unpinned` is baselined. */
  kind: "degrading" | "unpinned";
}

/** An install command with no `--frozen-lockfile` anywhere on the line. */
const UNPINNED_INSTALL = /\bbun install\b(?![^\n]*--frozen-lockfile)/;

export function scanWorkflows(dir: string = WORKFLOWS): PinFinding[] {
  const out: PinFinding[] = [];
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!/\.ya?ml$/.test(f)) continue;
    const lines = readFileSync(join(dir, f), "utf-8").split("\n");
    lines.forEach((text, i) => {
      if (DEGRADING_PIN.test(text)) {
        out.push({
          workflow: f,
          line: i + 1,
          text: text.trim(),
          kind: "degrading",
          why: "a pinned install that falls back to an unpinned one swallows the failure the pin exists to raise",
        });
      } else if (CD_AND_FALLBACK.test(text)) {
        out.push({
          workflow: f,
          line: i + 1,
          text: text.trim(),
          kind: "degrading",
          why: "`cd X && A || B` runs B in the CURRENT directory when the cd fails — not in X",
        });
      } else if (UNPINNED_INSTALL.test(text)) {
        out.push({
          workflow: f,
          line: i + 1,
          text: text.trim(),
          kind: "unpinned",
          why: "an install with no `--frozen-lockfile` resolves fresh, so the lockfile holds nothing here",
        });
      }
    });
  }
  return out;
}

/** Install steps that pin, for the reported count. A gate should say what it saw. */
export function countPinned(dir: string = WORKFLOWS): { pinned: number; guarded: number } {
  let pinned = 0;
  let guarded = 0;
  if (!existsSync(dir)) return { pinned, guarded };
  for (const f of readdirSync(dir)) {
    if (!/\.ya?ml$/.test(f)) continue;
    const src = readFileSync(join(dir, f), "utf-8");
    pinned += (src.match(/bun install --frozen-lockfile/g) ?? []).length;
    guarded += (src.match(/no content\/ in this checkout/g) ?? []).length;
  }
  return { pinned, guarded };
}

/** The backlog key for an unpinned install. Keyed by the COMMAND, not the line
 * number — a line number moves when an unrelated step is added above it, and a
 * baseline that churns on every edit is one nobody keeps accurate. */
export function baselineKey(f: PinFinding): string {
  return `${f.workflow}: ${f.text}`;
}

export interface PinBaseline {
  /** The root the entries were recorded in (`checkoutName`); absent, they apply in every root. */
  root?: string;
  known: string[];
}

/** The entries that judge `here`: none when the baseline was recorded in another
 * root. Every repository that mounts this layer runs the gate, and a site does
 * not carry the index's workflows, so the index's entries there read as stale
 * (owner, 2026-11-05: "scope to fa"). */
export function knownFor(baseline: PinBaseline, here: string): string[] {
  return baseline.root === undefined || baseline.root === here ? baseline.known : [];
}

function readBaseline(): PinBaseline {
  if (!existsSync(BASELINE)) return { known: [] };
  return JSON.parse(readFileSync(BASELINE, "utf-8")) as PinBaseline;
}

if (import.meta.main) {
  if (!existsSync(WORKFLOWS)) {
    console.log("  ? could not determine — .github/workflows is absent from this checkout");
    process.exit(2);
  }
  const findings = scanWorkflows();
  const { pinned, guarded } = countPinned();
  const degrading = findings.filter((f) => f.kind === "degrading");
  const unpinned = findings.filter((f) => f.kind === "unpinned");

  const here = checkoutName(ROOT);
  if (process.argv.includes("--write-baseline")) {
    const known = [...new Set(unpinned.map(baselineKey))].sort();
    writeFileSync(
      BASELINE,
      JSON.stringify(
        {
          _comment:
            "Install steps that deliberately resolve UNPINNED. Four are the documented fallback branch of a " +
            "presence guard, which emits ::warning:: when it takes them — failing on those would make the honest " +
            "branch unreachable. A DEGRADING pin is never baselined: the failure it swallows is the one it exists " +
            "to raise, and no instance of that is defensible. Keyed by command rather than line number, so an " +
            "unrelated step added above does not churn the file. Refresh with --write-baseline. `root` is the " +
            "repository the entries were recorded in; in any other root they judge nothing.",
          root: here,
          known,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`  ✓ baseline written — ${known.length} deliberately unpinned install step(s)`);
    process.exit(0);
  }

  const baseline = readBaseline();
  const known = new Set(knownFor(baseline, here));
  const keys = new Set(unpinned.map(baselineKey));
  const novel = [...keys].filter((k) => !known.has(k));
  const stale = [...known].filter((k) => !keys.has(k));

  console.log(
    `Lockfile pinning (${pinned} pinned install step(s), ${guarded} behind a presence guard, ` +
      `${unpinned.length} deliberately unpinned)`,
  );
  if (baseline.root !== undefined && baseline.root !== here) {
    console.log(`  note: the baseline was recorded in ${baseline.root}, not ${here}; none of its entries apply here`);
  }

  let bad = false;
  for (const f of degrading) {
    console.log(`  ✗ ${f.workflow}:${f.line} — ${f.why}`);
    console.log(`      ${f.text}`);
    bad = true;
  }
  for (const k of novel) {
    console.log(`  ✗ NEW unpinned install: ${k}`);
    console.log("      Pin it, or guard on presence and say `::warning::` when it falls back.");
    bad = true;
  }
  for (const k of stale) {
    console.log(`  ✗ stale baseline entry, remove it: ${k}`);
    bad = true;
  }

  if (!bad) {
    console.log("  ✓ no pin degrades, no `cd X && A || B` runs B in the wrong directory, no NEW unpinned install");
    process.exit(0);
  }
  console.log("");
  console.log("  A pin that falls back is not a pin. Guard on PRESENCE instead, and report");
  console.log("  `no lockfile` as its own state — a check that degrades to a pass is the");
  console.log("  defect, not the fix.");
  process.exit(1);
}
