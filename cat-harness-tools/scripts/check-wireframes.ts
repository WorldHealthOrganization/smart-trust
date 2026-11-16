/**
 * Every declared harness visualiser has a wireframe, and every wireframe has
 * passed its mechanical checks at BOTH a web and a mobile viewport.
 *
 * Reads:
 *
 * - **The declarations.** Every harness's `visualisers`, through
 *   `declaredVisualisers` in `viewer-declarations.ts`, each named by its ROUTE
 *   KEY `<harness>/<visualiser>` (the route `visualiserRoute` computes, without
 *   the base), never by a page path.
 * - **`cat-harness/docs/wireframes/index.json`**, and the same file in the
 *   `wireframes/` of every other layer's declared `docs` directories
 *   ({@link wireframeSources}): which wireframe covers which visualiser. A
 *   `covers` entry is a route key, or a route key and a sub-graph
 *   (`cat-harness/auto-docs/index/skills`); one wireframe may cover several.
 * - **Each wireframe directory.** It must hold `intent.md`, at least one
 *   candidate `.html`, and `checks/report.json` written by `wireframe:check`
 *   (the Tool `wireframe-check`).
 *
 * Fails on:
 *
 * - a declared visualiser that no wireframe covers
 * - a wireframe with no intent, or no candidate
 * - a candidate with no check report
 * - a candidate whose report lacks a viewport, or holds a `fail`
 *
 * Usage:
 *   bun run cat check:wireframes            # report, write the sidecar, exit 1 on any gap
 *   bun run cat check:wireframes -- --json  # print the sidecar document
 *   bun run cat check:wireframes:check      # JUDGE: compute and judge, write nothing (the gate)
 *
 * Judge mode (`--check`): 0 no gap · 1 any gap · 2 no visualiser
 * declared (could not determine), an unknown flag, or the run threw.
 *
 * @module scripts/check-wireframes
 * @covers cat-harness, docs — the declarations supply the visualiser list through
 *   `visualisationsOf`, and the wireframes it requires of them live in the docs tree
 */
import { HARNESS_ROOT } from "./lib/roots.ts";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readDeclaration, repoRootFor, siteDirFor } from "../schemas/kg/cat-harness.ts";
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
import { checkoutInstanceRoots, declaredVisualisers as harnessVisualisers } from "./viewer-declarations.js";
import { leftOutByMount } from "../schemas/kg/remote-mount.js";

const INSTANCE_ROOT = HARNESS_ROOT;
const REPO_ROOT = repoRootFor(INSTANCE_ROOT);
/** Wireframes live in the site, under `<site>/wireframes/`, so they publish with it. */
const WIREFRAMES = join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT), "wireframes");
/** The two viewports every usability review needs (owner, 2026-09-23). */
export const VIEWPORTS = ["web", "mobile"] as const;

type Index = { wireframes: Record<string, { covers: string[] }> };
type ReportEntry = { viewport: string; criterion: string; result: string; notes?: string };
/**
 * `use`, `topic` and `surface` are the skill's input, recorded by `wireframe:check`
 * since 2026-10-14; a report written before then has none of them.
 */
type Report = { topic?: string; use?: string; surface?: string; candidates: { file: string; entries: ReportEntry[] }[] };

export interface WireframeReport {
  declared: string[];
  covered: { ref: string; wireframe: string }[];
  uncovered: { ref: string }[];
  unknownRef: { wireframe: string; ref: string }[];
  incomplete: { wireframe: string; problem: string }[];
  missingViewport: { wireframe: string; candidate: string; viewport: string }[];
  failing: { wireframe: string; candidate: string; viewport: string; criterion: string; notes?: string }[];
  /**
   * NOT JUDGED HERE: a harness's visualiser with no wireframe in a checkout
   * whose mount left that harness's own wireframes out ({@link wireframesLeftOut}).
   * Not a gap and not a pass: whether it is covered is decided where the
   * wireframes are, by the layer that switches them on.
   */
  notJudged: { ref: string; reason: string }[];
}

/**
 * The harnesses whose OWN wireframes the mount that placed them left out:
 * `<site>/wireframes/` is an opt-in sub-graph (`cat-harness.wireframes`,
 * owner 2026-11-10, card Q-SG-1 C — "design work for this harness, which no
 * layer below reads"), so a downstream that has not switched it on gets no
 * wireframes and no `index.json` saying what they cover. Absent by consent
 * (`leftOutByMount`), never merely absent: a harness whose wireframes the
 * mount took, or that no mount placed, is judged as before.
 */
export function wireframesLeftOut(harnessRoot: string = INSTANCE_ROOT): string[] {
  let dir: string;
  try {
    dir = join(harnessRoot, siteDirFor(harnessRoot), "wireframes");
  } catch {
    return [];
  }
  if (!leftOutByMount(harnessRoot, dir)) return [];
  const name = (readDeclaration(harnessRoot) as { name?: string } | undefined)?.name;
  return name === undefined ? [] : [name];
}

/** Every declared visualiser, by route key `<harness>/<visualiser>`, across every layer in the checkout. */
export function declaredVisualisers(repoRoot: string = REPO_ROOT): string[] {
  return [...new Set(harnessVisualisers(repoRoot).map((v) => `${v.harness}/${v.id}`))].sort();
}

/** The declared route key a `covers` entry names — itself, or the visualiser of the sub-graph it names. */
export function coveredKey(entry: string, declared: readonly string[]): string | undefined {
  return declared.find((k) => entry === k || entry.startsWith(`${k}/`));
}

/**
 * Where the wireframes are: this harness's own `<site>/wireframes/`, and the
 * `wireframes/` directory of every declared `docs` directory of every OTHER
 * layer of the checkout that has one.
 *
 * A wireframe belongs with the page it draws. While every wireframe sat here,
 * the harness's index named pages of layers ABOVE it — a catalogue page of a
 * content layer — and in any checkout that did not mount that layer the
 * ref read as undeclared (measured in a content repository that mounts only
 * the platform, cat-harness-tools#281). A content layer's own visualiser had
 * nowhere to put its wireframe at all. So each layer's index is read where it sits, and
 * names only refs it can see. This harness's wireframes keep their bare
 * names; another layer's are named `<instance>/<topic>`, since two layers
 * may each have a `catalogue`.
 *
 * WHICH directories is the declaration's: every directory the layer
 * declares of the `docs` kind, its site directory among them. The site
 * directory alone was not enough (wrong-direction move M3, 2026-10-20): an IG
 * layer builds its site directory at publish and commits nothing there, so
 * its authored pages sit in a second `docs` directory it declares for exactly
 * that reason, and so do its wireframes.
 */
export function wireframeSources(repoRoot: string = REPO_ROOT): { dir: string; prefix: string }[] {
  const own = resolve(WIREFRAMES);
  const out = [{ dir: own, prefix: "" }];
  const seen = new Set([own]);
  for (const root of checkoutInstanceRoots(repoRoot)) {
    let decl: { name?: string; directories?: { path?: string; graphTypologies?: string[] }[] } | undefined;
    try {
      decl = readDeclaration(root) as typeof decl;
    } catch {
      decl = undefined;
    }
    const docsDirs: string[] = [];
    try {
      docsDirs.push(resolve(root, siteDirFor(root)));
    } catch {
      // no readable declaration: `check:harness-dirs`' finding, not this one's
    }
    for (const d of decl?.directories ?? []) {
      if (d.path && (d.graphTypologies ?? []).includes("docs")) docsDirs.push(resolve(root, d.path));
    }
    const name = decl?.name ?? basename(root);
    for (const docs of docsDirs) {
      const dir = join(docs, "wireframes");
      if (seen.has(dir) || !existsSync(join(dir, "index.json"))) continue;
      seen.add(dir);
      out.push({ dir, prefix: `${name}/` });
    }
  }
  return out;
}

export function checkWireframes(
  repoRoot: string = REPO_ROOT,
  dirs: string | { dir: string; prefix: string }[] = wireframeSources(repoRoot),
  /** Harnesses whose own wireframes are left out here ({@link wireframesLeftOut}). */
  leftOut: readonly string[] = wireframesLeftOut(),
): WireframeReport {
  const sources = typeof dirs === "string" ? [{ dir: dirs, prefix: "" }] : dirs;
  const r: WireframeReport = {
    declared: declaredVisualisers(repoRoot),
    covered: [],
    uncovered: [],
    unknownRef: [],
    incomplete: [],
    missingViewport: [],
    failing: [],
    notJudged: [],
  };
  const coverer = new Map<string, string>();
  for (const { dir, prefix } of sources) {
    const indexFile = join(dir, "index.json");
    const index: Index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, "utf-8")) : { wireframes: {} };
    for (const [topic, w] of Object.entries(index.wireframes)) {
      const name = `${prefix}${topic}`;
      for (const ref of w.covers) {
        const key = coveredKey(ref, r.declared);
        if (key === undefined) r.unknownRef.push({ wireframe: name, ref });
        else if (!coverer.has(key)) coverer.set(key, name);
      }
      const wdir = join(dir, topic);
      if (!existsSync(join(wdir, "intent.md"))) r.incomplete.push({ wireframe: name, problem: "no intent.md" });
      const candidates = existsSync(wdir) ? readdirSync(wdir).filter((f) => f.endsWith(".html")).sort() : [];
      if (candidates.length === 0) {
        r.incomplete.push({ wireframe: name, problem: "no candidate .html" });
        continue;
      }
      const reportFile = join(wdir, "checks", "report.json");
      if (!existsSync(reportFile)) {
        r.incomplete.push({ wireframe: name, problem: `no checks/report.json: run \`bun run cat wireframe:check --use as-is --topic ${topic} --surface <ref>\`` });
        continue;
      }
      const report: Report = JSON.parse(readFileSync(reportFile, "utf-8"));
      if (report.topic !== undefined && report.topic !== topic) {
        r.incomplete.push({ wireframe: name, problem: `checks/report.json was written for topic "${report.topic}"` });
        continue;
      }
      for (const c of candidates) {
        const entries = report.candidates.find((x) => basename(x.file) === c)?.entries;
        if (entries === undefined) {
          r.incomplete.push({ wireframe: name, problem: `${c} is not in checks/report.json` });
          continue;
        }
        for (const vp of VIEWPORTS) {
          const at = entries.filter((e) => e.viewport === vp);
          if (at.length === 0) r.missingViewport.push({ wireframe: name, candidate: c, viewport: vp });
          for (const e of at.filter((x) => x.result !== "pass"))
            r.failing.push({ wireframe: name, candidate: c, viewport: vp, criterion: e.criterion, ...(e.notes ? { notes: e.notes } : {}) });
        }
      }
    }
  }
  for (const ref of r.declared) {
    const w = coverer.get(ref);
    const off = leftOut.find((h) => ref.startsWith(`${h}/`));
    if (w) r.covered.push({ ref, wireframe: w });
    else if (off !== undefined) r.notJudged.push({ ref, reason: `${off}'s wireframes are switched off here: the mount left them out` });
    else r.uncovered.push({ ref });
  }
  return r;
}

export function wireframeGaps(r: WireframeReport): number {
  return r.uncovered.length + r.unknownRef.length + r.incomplete.length + r.missingViewport.length + r.failing.length;
}

/** The sidecar document for a report. Pure, so the judge and the writer render ONE computation. */
export function wireframesDocument(r: WireframeReport): QaResult {
  return buildQaResult({
    script: "cat-harness-tools/scripts/check-wireframes.ts",
    scriptAbsPath: fileURLToPath(import.meta.url),
    subject: { kind: "corpus", id: "harness-visualiser-wireframes" },
    families: {
      covered: { summary: "A declared visualiser with a wireframe whose checks pass at both viewports.", entries: r.covered },
      uncovered: { summary: "A declared visualiser that no wireframe covers.", entries: r.uncovered },
      "unknown-ref": { summary: "index.json names a ref that no declaration declares: a stale or mistyped mapping.", entries: r.unknownRef },
      incomplete: { summary: "A wireframe missing its intent, its candidate or its check report.", entries: r.incomplete },
      "missing-viewport": {
        summary: "A candidate checked at only one width. A usability review at one viewport is incomplete, not passed.",
        entries: r.missingViewport,
      },
      failing: { summary: "A mechanical check that failed: renders, no-overflow or no-placeholder.", entries: r.failing },
      // Only when there is one, so a checkout that judges everything writes the sidecar it always did.
      ...(r.notJudged.length
        ? { "not-judged": { summary: "A visualiser whose harness's wireframes the mount left out here: judged where they are switched on.", entries: r.notJudged } }
        : {}),
    },
  });
}

/**
 * The judgement over a report — bean `bo44`'s four states. `unknown` when no
 * visualiser is declared (nothing was checked); `finding` on any gap, since
 * every family but `covered` is one.
 */
export function judgeWireframes(r: WireframeReport): Judgement {
  return judgementOf({ failing: wireframeGaps(r), undetermined: r.declared.length === 0 });
}

if (import.meta.main) {
  const GATE = "check:wireframes";
  if (judging()) {
    // Judge mode: compute, judge, write NOTHING (bean `bo44`).
    const usage = judgeUsage(GATE, process.argv.slice(2), []);
    if (usage !== undefined) process.exit(usage);
    let jr: WireframeReport;
    try {
      jr = checkWireframes();
    } catch (e) {
      process.exit(concludeJudgement({ gate: GATE, judgement: "error", detail: (e as Error).message }));
    }
    for (const u of jr.uncovered) console.error(`  ✗ no wireframe: ${u.ref}`);
    for (const u of jr.unknownRef) console.error(`  ✗ ${u.wireframe}: covers an undeclared ref ${u.ref}`);
    for (const i of jr.incomplete) console.error(`  ✗ ${i.wireframe}: ${i.problem}`);
    for (const m of jr.missingViewport) console.error(`  ✗ ${m.wireframe}/${m.candidate}: no ${m.viewport} check`);
    for (const f of jr.failing) console.error(`  ✗ ${f.wireframe}/${f.candidate}: ${f.viewport} ${f.criterion} failed`);
    if (jr.notJudged.length) console.error(`  · ${jr.notJudged.length} visualiser(s) not judged here: ${jr.notJudged[0]!.reason}`);
    process.exit(
      concludeJudgement({
        gate: GATE,
        judgement: judgeWireframes(jr),
        detail: `${jr.covered.length}/${jr.declared.length} declared visualiser(s) covered, ${wireframeGaps(jr)} gap(s)`,
        committed: { root: INSTANCE_ROOT, stem: "wireframes", fresh: wireframesDocument(jr), writer: GATE },
      }),
    );
  }
  const r = checkWireframes();
  if (r.declared.length === 0) {
    console.error("UNDETERMINED: no declared visualiser found. This is not a pass; nothing was checked.");
    process.exit(2);
  }
  const doc = wireframesDocument(r);
  if (process.argv.includes("--json")) console.log(JSON.stringify(doc, null, 2));
  else {
    writeQaResult(INSTANCE_ROOT, "wireframes", doc);
    console.log(`wireframes: ${r.covered.length}/${r.declared.length} declared visualiser(s) covered`);
    for (const u of r.uncovered) console.log(`  ✗ no wireframe: ${u.ref}`);
    for (const u of r.unknownRef) console.log(`  ✗ ${u.wireframe}: covers an undeclared ref ${u.ref}`);
    for (const i of r.incomplete) console.log(`  ✗ ${i.wireframe}: ${i.problem}`);
    for (const m of r.missingViewport) console.log(`  ✗ ${m.wireframe}/${m.candidate}: no ${m.viewport} check`);
    for (const f of r.failing) console.log(`  ✗ ${f.wireframe}/${f.candidate}: ${f.viewport} ${f.criterion} failed`);
    if (r.notJudged.length) console.log(`  · ${r.notJudged.length} visualiser(s) not judged here: ${r.notJudged[0]!.reason}`);
  }
  if (wireframeGaps(r) > 0) process.exit(1);
}
