#!/usr/bin/env bun
/**
 * No rendered diagram label shows an XML character reference as literal text.
 *
 * A BPMN `name` written `&amp;#10;` is DOUBLE-escaped: XML resolves it to
 * `&#10;` and the renderer draws those five characters in the box.
 *
 * The check reads the RENDERED SVG, not the `.bpmn`: it catches every
 * spelling of a character reference that survives into drawn text, and it
 * ignores `<bpmn:documentation>`, which is prose rather than a label.
 * `render:bpmn:check` cannot catch this: it only asks whether the SVG is
 * current, and the renderer faithfully draws the wrong text.
 *
 * Enforcement is a RATCHET keyed on file AND count: known counts sit in a
 * committed baseline and **anything beyond them fails** (a new file, or an
 * existing file gaining a label). Removing labels prints as fixed; `--update`
 * rewrites the baseline.
 *
 * Usage:
 *   bun run cat check:rendered-labels
 *   bun run cat check:rendered-labels -- --update    # rewrite the baseline
 *   bun run cat check:rendered-labels -- --json      # sidecar only
 *   bun run cat check:rendered-labels:check          # JUDGE: compute and judge, write nothing (the gate)
 *
 * Exit: 0 clean (or only known labels), 1 a label beyond the baseline,
 *       2 could not determine — no SVG was read. Judge mode (`--check`)
 *       keeps the same table and adds 2 for an unknown flag or a run
 *       that threw.
 *
 * @module scripts/check-rendered-labels
 * @covers cat-harness
 */
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { gitCorpus } from "../schemas/sdlc/git-corpus.ts";
import {
  buildQaResult,
  concludeJudgement,
  judgementOf,
  judgeUsage,
  judging,
  writeQaResult,
  type Judgement,
  type QaResult,
} from "./qa-results.ts";

const INSTANCE_ROOT = HARNESS_ROOT;
const REPO_ROOT = resolve(INSTANCE_ROOT, "..");

/**
 * Known counts, committed. Beside this module rather than in a declaration:
 * it records what has NOT been done yet, which is a property of the work
 * rather than of the graph.
 */
const BASELINE = join(TOOLS_ROOT, "scripts", "rendered-labels-baseline.json");

/**
 * A character reference that survived into drawn text.
 *
 * Matches the decimal and hex forms — `&#10;` and `&#x2014;`. In the SVG these
 * appear as `&amp;#10;`, because a tspan whose TEXT is those five characters
 * serialises its ampersand. So this pattern is looking for the escape of an
 * escape, which is exactly the defect and cannot false-positive on a label
 * that merely contains an ampersand (that serialises as `&amp;amp;`).
 */
const LITERAL_REF = /&amp;#(?:x[0-9A-Fa-f]+|[0-9]+);/;

/** Text of every `<tspan>` in an SVG — the drawn label content. */
export function tspans(svg: string): string[] {
  return [...svg.matchAll(/<tspan[^>]*>(.*?)<\/tspan>/gs)].map((m) => m[1]!);
}

/** How many of an SVG's labels show a character reference as literal text. */
export function offendingLabels(svg: string): string[] {
  return tspans(svg).filter((t) => LITERAL_REF.test(t));
}

export interface LabelReport {
  undetermined: boolean;
  /** How many SVGs were read. Zero is `undetermined`, never clean. */
  scanned: number;
  /** repo-relative path -> offending label count, for every affected file. */
  found: Record<string, number>;
  /** Files above their baseline count, or absent from it — these fail. */
  unexpected: string[];
  /** Baselined files now clean, or below their count — progress, never a failure. */
  fixed: string[];
}

export function readBaseline(file = BASELINE): Record<string, number> {
  if (!existsSync(file)) return {};
  const raw = JSON.parse(readFileSync(file, "utf-8")) as { counts?: Record<string, number> };
  return raw.counts ?? {};
}

/**
 * Every rendered workflow diagram, asked of GIT rather than the disk.
 *
 * `gitCorpus` for the reason its own module states, and the reason this
 * session paid for directly: a filesystem walk counts whatever a gate left
 * lying around, which is how a pinned measurement moved by 1214 nodes
 * depending on whether a subpackage's devDependencies were installed.
 */
function renderedDiagrams(repoRoot: string): string[] | undefined {
  const corpus = gitCorpus(repoRoot, ["*.svg"]);
  if (corpus === undefined) return undefined;
  // A drawing is either under a `workflows/` folder (the built-at-publish
  // copies) or committed beside its own `.bpmn` (cat-harness#1047: a layer's
  // own drawings sit next to their source).
  return corpus.filter((p) => {
    if (!p.endsWith(".svg")) return false;
    const rel = relative(repoRoot, p);
    return rel.includes(`${"workflows"}/`) || existsSync(p.slice(0, -".svg".length) + ".bpmn");
  });
}

export function checkRenderedLabels(repoRoot = REPO_ROOT, baselineFile = BASELINE): LabelReport {
  const files = renderedDiagrams(repoRoot);
  const r: LabelReport = {
    undetermined: files === undefined || files.length === 0,
    scanned: 0,
    found: {},
    unexpected: [],
    fixed: [],
  };
  if (files === undefined || files.length === 0) return r;

  for (const abs of files) {
    const n = offendingLabels(readFileSync(abs, "utf-8")).length;
    r.scanned += 1;
    if (n > 0) r.found[relative(repoRoot, abs)] = n;
  }

  const known = readBaseline(baselineFile);
  // ABOVE its allowance, or not in it at all. Equal is known and passes.
  r.unexpected = Object.keys(r.found)
    .filter((f) => r.found[f]! > (known[f] ?? 0))
    .sort();
  r.fixed = Object.keys(known)
    .filter((f) => (r.found[f] ?? 0) < known[f]!)
    .sort();
  return r;
}

/** The sidecar document for a report. Pure, so the judge and the writer render ONE computation. */
export function renderedLabelsDocument(r: LabelReport): QaResult {
  return buildQaResult({
    script: "cat-harness-tools/scripts/check-rendered-labels.ts",
    scriptAbsPath: fileURLToPath(import.meta.url),
    subject: { kind: "corpus", id: "rendered-diagram-labels" },
    families: {
      "literal-character-reference": {
        summary:
          "A rendered diagram label showing an XML character reference as literal text — a reader sees " +
          "`Dependency advisories&#10;(WARN-ONLY)` inside the box. The cause is a DOUBLE-escaped `name` in " +
          "the BPMN (`&amp;#10;` where `&#10;` was meant). Measured against the RENDERED SVG rather than " +
          "the source, because a source grep finds only the escape form somebody already knows and cannot " +
          "tell a label from `<bpmn:documentation>`, whose eight instances in docs-site-publish want a " +
          "different remedy. `render:bpmn:check` is green across all of these and correctly so: it asks " +
          "whether the SVG matches the renderer's output, and the renderer faithfully produced the wrong " +
          "thing. Known counts are baselined so an outstanding sweep does not fail the gate; a NEW file, " +
          "or an existing file gaining a label, does. Bean `li5y`.",
        entries: Object.entries(r.found).map(([file, count]) => ({
          file,
          count,
          known: !r.unexpected.includes(file),
        })),
      },
    },
  });
}

/** Bean `bo44`'s four states over a report: only a file beyond its baselined count is a finding. */
export function judgeRenderedLabels(r: LabelReport): Judgement {
  return judgementOf({ failing: r.unexpected.length, undetermined: r.undetermined });
}

if (import.meta.main) {
  const GATE = "check:rendered-labels";
  if (judging()) {
    // Judge mode: compute, judge, write NOTHING — neither the sidecar nor the
    // baseline (bean `bo44`). `--update` is a writer's flag and is refused here.
    const usage = judgeUsage(GATE, process.argv.slice(2), []);
    if (usage !== undefined) process.exit(usage);
    let jr: LabelReport;
    try {
      jr = checkRenderedLabels();
    } catch (e) {
      process.exit(concludeJudgement({ gate: GATE, judgement: "error", detail: (e as Error).message }));
    }
    for (const f of jr.unexpected) console.error(`  ✗ ${jr.found[f]} label(s) beyond the baseline: ${f}`);
    for (const f of jr.fixed) console.log(`  ✓ FIXED, fewer or none now: ${f} (shrink the baseline with --update)`);
    process.exit(
      concludeJudgement({
        gate: GATE,
        judgement: judgeRenderedLabels(jr),
        detail: jr.undetermined
          ? "no rendered workflow diagram was read"
          : `${jr.scanned} SVG(s) read, ${jr.unexpected.length} file(s) beyond the baseline`,
        ...(jr.undetermined
          ? {}
          : {
              committed: { root: INSTANCE_ROOT, stem: "rendered-labels", fresh: renderedLabelsDocument(jr), writer: GATE },
            }),
      }),
    );
  }

  const r = checkRenderedLabels();

  if (r.undetermined) {
    console.error("UNDETERMINED: no rendered workflow diagram was read.");
    console.error(
      "This is not a pass — nothing was checked. Either git could not list the " +
        "corpus, or `bun run cat render:bpmn` has never produced an SVG here.",
    );
    process.exit(2);
  }

  const total = Object.values(r.found).reduce((a, b) => a + b, 0);

  writeQaResult(INSTANCE_ROOT, "rendered-labels", renderedLabelsDocument(r));

  if (process.argv.includes("--update")) {
    writeFileSync(
      BASELINE,
      `${JSON.stringify(
        {
          _comment:
            "Rendered workflow diagrams whose labels still show an XML character reference as literal text, " +
            "with how many labels each. NOT intended output — see scripts/check-rendered-labels.ts and bean " +
            "`li5y`. A file above its count here, or absent from here, fails the check, so this file only " +
            "ever shrinks. Written by `bun run cat check:rendered-labels -- --update`.",
          counts: Object.fromEntries(Object.entries(r.found).sort(([a], [b]) => a.localeCompare(b))),
        },
        null,
        2,
      )}\n`,
    );
    console.log(`Baseline written: ${Object.keys(r.found).length} file(s), ${total} label(s).`);
    process.exit(0);
  }

  if (!process.argv.includes("--json")) {
    console.log(`rendered diagram labels — ${r.scanned} SVG(s) read\n`);
    if (total === 0) {
      console.log("  ✓ no rendered label shows a character reference as literal text");
    }
    for (const [file, count] of Object.entries(r.found).sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`  ${r.unexpected.includes(file) ? "✗" : "·"} ${count} label(s)  ${file}`);
    }
    for (const f of r.fixed) console.log(`  ✓ FIXED, fewer or none now: ${f}`);
    if (r.fixed.length > 0) {
      console.log("\n  Re-run with --update to shrink the baseline — the diff is the progress.");
    }
    if (r.unexpected.length > 0) {
      console.log(
        `\n  ${r.unexpected.length} file(s) beyond the baseline. A label's line break is ` +
          "`&#10;` in the BPMN `name`, not `&amp;#10;` — the second is double-escaped and the " +
          "renderer draws the five characters. Fix the `name`, then `bun run cat render:bpmn`.",
      );
    }
  }

  if (r.unexpected.length > 0) process.exit(1);
}
