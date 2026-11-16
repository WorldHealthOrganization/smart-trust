/**
 * Preview QA: the tests and gates in a change's dependency cone, run for a
 * preview build and shown ON TOP of the QA report, judged against main.
 *
 * @module scripts/preview-qa
 * @graphNode none — a helper of the preview tier of `layer-pr-checks.yml` and of `stage-local.ts`
 * @covers none — it selects, compares and renders; the tests and gates it reports judge
 *
 * ## Why (owner, 2026-11-14)
 *
 * *"if a staging/preview branch is being built, then if a CI test is in the
 * dependency cone of a change then it should be run and the QA report page(s)
 * should show that on top as well as the main QA below that."* Release-gated
 * CI (card Q-CIB-4 A) runs a non-release PR's fast tier only, so a preview
 * showed no verdict for its change. The owner chose (card "Preview QA", A) a
 * PREVIEW TIER of `layer-pr-checks.yml`, started by the `preview` label, and
 * (card "Select all") to say so, not run the whole suite, when a change
 * reaches every test.
 *
 * ## The cone is the one the tools already compute
 *
 * Nothing here works out a dependency by itself:
 *
 * - **tests**: `affected-tests.ts`, the pre-push hook's selection: every test
 *   whose relative-import closure holds a changed path. A change to what every
 *   test runs under (lockfile, manifest, tsconfig, preload) selects them ALL,
 *   and then no test runs here: the page says so and names the `release` tier,
 *   which runs the suite;
 * - **gates**: the CI cone (`ci-cone.ts`, `run-gates.py` `GATE_CONE=skip`). A
 *   gate whose recorded read set is unchanged since main's record is skipped
 *   as `unchanged: <sha>`; every gate that RUNS is in the cone. A gate with no
 *   record runs (any doubt runs).
 *
 * ## Judged against main, never as the merge verdict
 *
 * Each check is put beside main's stored answer (the `base-answer` a push to
 * main kept, as the full tier reads it): `new` (red here, not on main),
 * `fixed` (red on main, not here), `both` (red on both, with findings added
 * AND findings gone), `still` (red on both, the same), `clean`, or `unknown`
 * (red here, and main's answer for it is not known). The preview tier never
 * computes main's side, so a PR with no stored answer is `unknown`, never
 * `new`: could not determine is never green, and never blamed on the PR
 * either. The report is advisory: merge-guard and the `release` tier judge
 * the merge.
 *
 * ## On the page
 *
 * {@link renderSection} is a self-contained HTML section, and
 * {@link injectSection} puts it first in a QA page's `<main>` (or `<body>`)
 * between `<!-- preview-qa:start -->` and `<!-- preview-qa:end -->`, so the
 * page's own report stays below it, unchanged, and a rebuild replaces the
 * section instead of stacking a second one. `staging-share.ts` sets the
 * section aside when it compares a preview page, as it does the banner, and
 * `preview-qa.json` is a build fact (`preview-record.ts`): two builds of the
 * same tree may see the cone run at different stages.
 *
 * ```sh
 * bun run cat-harness-tools/scripts/preview-qa.ts select --root <caller> --base <ref> [--head <ref>] [--as <sha>] [--base-label <name>] --out selection.json
 * bun run cat-harness-tools/scripts/preview-qa.ts judge  --selection selection.json --head-dir <dir> [--main-dir <dir>] [--findings findings.json] --out preview-qa.json [--md summary.md]
 * bun run cat-harness-tools/scripts/preview-qa.ts inject --site <dir> [--report preview-qa.json] --sha <sha> [--page <rel>]...
 * ```
 *
 * The judging and the page half import nothing but `node:`; the selection
 * loads `affected-tests.ts`, which reaches the schema packages through
 * `input-hash.ts`, only when it selects. So `stage-local.ts`,
 * `preview-record.ts` and a viewer can render the section without them.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import type { Selection } from "./affected-tests.ts";

export const SCHEMA = "preview-qa/v1";
/** Where a preview site carries its report, beside its pages. A build fact (`preview-record.ts`). */
export const SITE_REPORT = "preview-qa.json";
export const START = "<!-- preview-qa:start -->";
export const END = "<!-- preview-qa:end -->";

// ---------------------------------------------------------------- select

export interface PreviewSelection {
  $schema: "preview-qa-selection/v1";
  base: string;
  head: string;
  /** Repo-relative paths the change touches. */
  changed: string[];
  tests: Selection;
}

/** The paths `head` changes against `base` (their merge base), repo-relative. */
export function changedPaths(root: string, base: string, head = "HEAD"): string[] {
  const out = execFileSync("git", ["-C", root, "diff", "--name-only", "--no-renames", `${base}...${head}`], { encoding: "utf-8" });
  return out.split("\n").map((s) => s.trim()).filter(Boolean).sort();
}

/** The change's test cone: `affected-tests.ts` over the changed paths. */
export async function selectCone(root: string, changed: readonly string[], o: { base: string; head: string; tests?: readonly string[] }): Promise<PreviewSelection> {
  const { affectedTests } = await import("./affected-tests.ts");
  const tests = affectedTests(root, changed, o.tests);
  return { $schema: "preview-qa-selection/v1", base: o.base, head: o.head, changed: [...changed], tests };
}

/**
 * What `bun test` is given, from the root the shards run in: each selected
 * file under `prefix` (the instance's directory, in layer mode). Empty when
 * nothing is selected, and when everything is (the page says why).
 */
export function testArgs(sel: PreviewSelection, prefix: string): string[] {
  if (sel.tests.kind === "all") return [];
  const p = prefix.replace(/\/+$/, "");
  return sel.tests.files.map((f) => (p === "" || p === "." ? `./${f}` : `./${p.replace(/^\.\//, "")}/${f}`));
}

// ---------------------------------------------------------------- judge

export type Verdict = "pass" | "fail" | "undetermined" | "not-applicable" | "skipped";
export type Delta = "new" | "fixed" | "both" | "still" | "clean" | "unknown";

export interface CheckResult {
  kind: "test" | "gate";
  name: string;
  head: Verdict;
  /** Main's verdict, or `absent` when main's answer does not hold this check. */
  main: Verdict | "absent";
  delta: Delta;
  /** Findings (failing test cases, or gate errors) here and not on main. */
  added: string[];
  /** Findings on main and not here. */
  removed: string[];
  why?: string;
}

export interface PreviewQa {
  $schema: typeof SCHEMA;
  head: string;
  base: string;
  run?: string;
  main: { available: boolean; sha?: string; run?: string };
  cone: {
    changed: string[];
    tests: { kind: "some"; files: string[]; why: Record<string, string> } | { kind: "all"; why: string };
    /** Gates that ran: the ones whose inputs the change reaches, or that have no record. */
    gates: string[];
    /** Gates the CI cone skipped as unchanged since main's record. */
    outside: number;
  };
  results: CheckResult[];
  counts: Record<Delta, number>;
  notes: string[];
}

/** One `run-gates.py` entry. */
export interface GateEntry {
  command?: string;
  exit?: number;
  tail?: string;
  skipped?: string;
  unchanged?: string;
  /** The errors it printed, as `gate_diagnostics.py` keys them (line numbers and counts left out). */
  diagnostics?: string[];
}

export function gateVerdict(e: GateEntry | undefined): Verdict | "absent" {
  if (e === undefined) return "absent";
  if (e.exit === undefined) return "skipped";
  if (e.exit === 0) return "pass";
  if (e.exit === 78) return "not-applicable";
  if (e.exit === 2) return "undetermined";
  return "fail";
}

/** A gate the CI cone skipped because nothing it read changed. */
export function outsideCone(e: GateEntry): boolean {
  return e.exit === undefined && e.unchanged !== undefined;
}

/**
 * Failing test cases of a `bun test --reporter=junit` report, keyed as
 * `compare-test-failures.py` keys them (suite path, then the case's name),
 * grouped by the file each top-level suite names.
 */
export function junitFailures(xml: string): { total: number; byFile: Map<string, Set<string>>; files: Set<string> } {
  const byFile = new Map<string, Set<string>>();
  const files = new Set<string>();
  const total = Number(/<testsuites\b[^>]*\btests="(\d+)"/.exec(xml)?.[1] ?? 0);
  const trail: string[] = [];
  const tag = /<(\/?)(testsuite|testcase)\b([^>]*?)(\/?)>|<(failure|error)\b/g;
  let caseKey: string | undefined;
  let caseFailed = false;
  let caseOpen = false;
  const close = () => {
    if (caseKey !== undefined && caseFailed) {
      const file = trail[0] ?? "";
      if (!byFile.has(file)) byFile.set(file, new Set());
      byFile.get(file)!.add(caseKey);
    }
    caseKey = undefined;
    caseFailed = false;
    caseOpen = false;
  };
  for (let m = tag.exec(xml); m !== null; m = tag.exec(xml)) {
    if (m[5] !== undefined) {
      if (caseOpen) caseFailed = true;
      continue;
    }
    const closing = m[1] === "/";
    const selfClosing = m[4] === "/";
    const name = decodeXml(/\bname="([^"]*)"/.exec(m[3] ?? "")?.[1] ?? "");
    if (m[2] === "testsuite") {
      if (closing) trail.pop();
      else if (!selfClosing) {
        trail.push(name);
        if (trail.length === 1) files.add(name);
      }
    } else if (closing) close();
    else {
      close();
      caseKey = [...trail, name].join(" > ");
      caseOpen = !selfClosing;
      if (selfClosing) close();
    }
  }
  return { total, byFile, files };
}

function decodeXml(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/** The delta of one check from its verdicts and its findings on each side. */
export function deltaOf(head: Verdict, main: Verdict | "absent", added: readonly string[], removed: readonly string[], mainKnown: boolean): Delta {
  const red = (v: Verdict | "absent") => v === "fail" || v === "undetermined";
  if (!red(head)) {
    if (mainKnown && red(main)) return "fixed";
    return "clean";
  }
  if (!mainKnown || main === "absent" || main === "skipped") return "unknown";
  if (!red(main)) return "new";
  if (added.length > 0 && removed.length > 0) return "both";
  if (added.length > 0) return "new";
  return "still";
}

const ORDER: readonly Delta[] = ["new", "both", "unknown", "still", "fixed", "clean"];

export interface JudgeInput {
  selection: PreviewSelection;
  /** Main's selection-free answer: its junit report and gates. Undefined when no answer was stored. */
  main?: { junit: string; gates: Record<string, GateEntry>; sha?: string; run?: string };
  head: { junit: string; gates: Record<string, GateEntry> };
  /** Error keys per gate, overriding each entry's own `diagnostics`. */
  findings?: { head?: Record<string, string[]>; main?: Record<string, string[]> };
  run?: string;
  /** Instance directory the test files were run under, to match junit suite names back to selected files. */
  prefix?: string;
}

/** Join a selection, this run's answer and main's into the report. */
export function judge(i: JudgeInput): PreviewQa {
  const mainKnown = i.main !== undefined;
  const results: CheckResult[] = [];
  const notes: string[] = [];
  const sel = i.selection;

  // Tests: one row per selected file.
  if (sel.tests.kind === "all") {
    notes.push(`No tests were run: ${sel.tests.why}, so the change reaches every test. The full suite runs on the release tier (label the PR \`release\`).`);
  } else {
    const head = junitFailures(i.head.junit);
    const main = mainKnown ? junitFailures(i.main!.junit) : undefined;
    const prefix = (i.prefix ?? "").replace(/^\.\//, "").replace(/\/+$/, "");
    const suiteOf = (f: string) => (prefix && prefix !== "." ? `${prefix}/${f}` : f);
    const find = (m: Map<string, Set<string>>, f: string): Set<string> => {
      const s = suiteOf(f);
      for (const [k, v] of m) if (k === s || k === f || k.endsWith(`/${s}`) || k === `./${s}`) return v;
      return new Set();
    };
    const ranHere = (files: Set<string>, f: string) => [...files].some((k) => k === suiteOf(f) || k === f || k.endsWith(`/${suiteOf(f)}`) || k === `./${suiteOf(f)}`);
    for (const f of sel.tests.files) {
      const h = find(head.byFile, f);
      const m = main ? find(main.byFile, f) : new Set<string>();
      const headV: Verdict = h.size > 0 ? "fail" : ranHere(head.files, f) ? "pass" : "undetermined";
      const mainV: Verdict | "absent" = !main ? "absent" : m.size > 0 ? "fail" : ranHere(main.files, f) ? "pass" : "absent";
      const added = [...h].filter((k) => !m.has(k)).sort();
      const removed = [...m].filter((k) => !h.has(k)).sort();
      const r: CheckResult = { kind: "test", name: f, head: headV, main: mainV, delta: deltaOf(headV, mainV, added, removed, mainKnown && mainV !== "absent"), added, removed, why: sel.tests.why[f] };
      if (headV === "undetermined") r.why = `${r.why ? `${r.why}; ` : ""}its report holds no suite for it`;
      results.push(r);
    }
  }

  // Gates: every gate this run ran is in the cone.
  let outside = 0;
  const gates: string[] = [];
  for (const [name, e] of Object.entries(i.head.gates).sort(([a], [b]) => a.localeCompare(b))) {
    if (outsideCone(e)) {
      outside++;
      continue;
    }
    const headV = gateVerdict(e) as Verdict;
    if (headV === "skipped") continue; // not run here for a reason of its own, not the cone's
    gates.push(name);
    const m = i.main?.gates[name];
    const mainV = mainKnown ? gateVerdict(m) : "absent";
    const hf = i.findings?.head?.[name] ?? e.diagnostics ?? [];
    const mf = i.findings?.main?.[name] ?? m?.diagnostics ?? [];
    const added = hf.filter((k) => !mf.includes(k));
    const removed = mf.filter((k) => !hf.includes(k));
    const r: CheckResult = { kind: "gate", name, head: headV, main: mainV, delta: deltaOf(headV, mainV, added, removed, mainKnown && mainV !== "absent"), added, removed };
    if (mainV === "skipped" && m?.unchanged) r.why = `main skipped it as unchanged since ${m.unchanged}`;
    results.push(r);
  }

  if (!mainKnown) notes.push("Main's answer for this PR's base was not stored, so a red check is `unknown`, not `new`: the preview tier never computes main's side. The release tier does.");
  results.sort((a, b) => ORDER.indexOf(a.delta) - ORDER.indexOf(b.delta) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  const counts = Object.fromEntries(ORDER.map((d) => [d, 0])) as Record<Delta, number>;
  for (const r of results) counts[r.delta]++;
  return {
    $schema: SCHEMA,
    head: sel.head,
    base: sel.base,
    ...(i.run ? { run: i.run } : {}),
    main: { available: mainKnown, ...(i.main?.sha ? { sha: i.main.sha } : {}), ...(i.main?.run ? { run: i.main.run } : {}) },
    cone: { changed: sel.changed, tests: sel.tests, gates, outside },
    results,
    counts,
    notes,
  };
}

/** The step summary: the counts and the red rows. */
export function markdown(r: PreviewQa): string {
  const lines = [
    "### This change (preview)",
    "",
    `Cone: ${r.cone.changed.length} changed path(s), ${r.cone.tests.kind === "all" ? "every test (none run)" : `${r.cone.tests.files.length} test file(s)`}, ${r.cone.gates.length} gate(s) (${r.cone.outside} outside the cone).`,
    "",
    `new ${r.counts.new} · both ${r.counts.both} · unknown ${r.counts.unknown} · still ${r.counts.still} · fixed ${r.counts.fixed} · clean ${r.counts.clean}`,
    "",
  ];
  for (const x of r.results.filter((x) => x.delta !== "clean")) lines.push(`- **${x.delta}** ${x.kind} \`${x.name}\` (here ${x.head}, main ${x.main})`);
  for (const n of r.notes) lines.push("", n);
  lines.push("", "Advisory: the release tier and merge-guard judge the merge.");
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------- render

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LABEL: Record<Delta, string> = {
  new: "new",
  both: "new + fixed",
  unknown: "red, main unknown",
  still: "red on main too",
  fixed: "fixed",
  clean: "passes",
};

const STYLE = `
.preview-qa{--pq-bg:#f6f8fb;--pq-fg:#1d2433;--pq-mute:#5b6577;--pq-brd:#d5dbe6;--pq-new:#b42318;--pq-new-bg:#fde8e7;--pq-fixed:#05603a;--pq-fixed-bg:#e3f6ec;--pq-both:#93370d;--pq-both-bg:#fdf0dc;--pq-still:#5b6577;--pq-still-bg:#eceff4;--pq-accent:#2f5bd3;
  font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--pq-fg);background:var(--pq-bg);border:1px solid var(--pq-brd);border-left:4px solid var(--pq-accent);border-radius:8px;padding:14px 16px;margin:0 0 20px;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere}
@media (prefers-color-scheme:dark){.preview-qa{--pq-bg:#161b26;--pq-fg:#e6e9ef;--pq-mute:#9aa4b5;--pq-brd:#2c3446;--pq-new:#ff8a80;--pq-new-bg:#3a1a1a;--pq-fixed:#7ee2a8;--pq-fixed-bg:#12301f;--pq-both:#ffc27a;--pq-both-bg:#3a2a12;--pq-still:#b3bccb;--pq-still-bg:#232a38;--pq-accent:#7aa2ff}}
.preview-qa h2{font-size:1.15em;margin:0 0 4px}
.preview-qa .pq-meta{color:var(--pq-mute);font-size:.9em;margin:0 0 10px}
.preview-qa .pq-meta a{color:var(--pq-accent)}
.preview-qa .pq-counts{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;padding:0;list-style:none}
.preview-qa .pq-chip{display:inline-block;border-radius:999px;padding:1px 9px;font-size:.85em;font-weight:600;white-space:nowrap}
.preview-qa .pq-new{color:var(--pq-new);background:var(--pq-new-bg)}
.preview-qa .pq-both,.preview-qa .pq-unknown{color:var(--pq-both);background:var(--pq-both-bg)}
.preview-qa .pq-fixed,.preview-qa .pq-clean{color:var(--pq-fixed);background:var(--pq-fixed-bg)}
.preview-qa .pq-still{color:var(--pq-still);background:var(--pq-still-bg)}
.preview-qa table{border-collapse:collapse;width:100%;font-size:.9em}
.preview-qa th,.preview-qa td{text-align:left;padding:4px 6px;border-top:1px solid var(--pq-brd);vertical-align:top}
.preview-qa th,.preview-qa td:nth-child(-n+2),.preview-qa td:nth-child(4),.preview-qa td:nth-child(5){white-space:nowrap}
.preview-qa code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em}
.preview-qa details{margin:8px 0}
.preview-qa summary{cursor:pointer;color:var(--pq-accent)}
.preview-qa ul.pq-list{margin:4px 0 0;padding-left:18px}
.preview-qa .pq-note{color:var(--pq-mute);font-size:.9em;margin:8px 0 0}
.preview-qa .pq-below{margin:12px 0 0;padding-top:8px;border-top:1px dashed var(--pq-brd);color:var(--pq-mute);font-size:.85em}
@media (max-width:600px){.preview-qa table,.preview-qa tbody,.preview-qa tr,.preview-qa td{display:block}.preview-qa thead{display:none}.preview-qa td{border:0;padding:2px 0}.preview-qa td[data-l]::before{content:attr(data-l) ": ";color:var(--pq-mute)}.preview-qa tr{border-top:1px solid var(--pq-brd);padding:6px 0}}
`;

function chip(d: Delta): string {
  return `<span class="pq-chip pq-${d}">${esc(LABEL[d])}</span>`;
}

function findingsCell(x: CheckResult): string {
  const parts: string[] = [];
  const list = (title: string, items: readonly string[]) => {
    if (items.length === 0) return;
    const shown = items.slice(0, 20).map((s) => `<li><code>${esc(s)}</code></li>`).join("");
    parts.push(`<details><summary>${esc(title)} (${items.length})</summary><ul class="pq-list">${shown}${items.length > 20 ? `<li>… ${items.length - 20} more</li>` : ""}</ul></details>`);
  };
  list("added here", x.added);
  list("gone here", x.removed);
  if (x.why) parts.push(`<span class="pq-note">${esc(x.why)}</span>`);
  return parts.join("");
}

/** The "This change (preview)" section, self-contained, for the top of a QA page. */
export function renderSection(r: PreviewQa | undefined, o: { sha: string; label?: string } = { sha: "" }): string {
  const short = (s: string) => esc(s.slice(0, 7));
  if (r === undefined || !r.head.startsWith(o.sha.slice(0, 7))) {
    const why = r === undefined
      ? "No cone run is recorded for this commit. Label the PR <code>preview</code> to run the tests and gates in the change's dependency cone; this section then shows their verdicts against main."
      : `The cone run on record is for <code>${short(r.head)}</code>, not this commit; label the PR <code>preview</code> (or push) to run it again.`;
    return `${START}\n<style>${STYLE}</style><section class="preview-qa" aria-labelledby="pq-h"><h2 id="pq-h">This change (preview)</h2><p class="pq-meta">${o.sha ? `commit <code>${short(o.sha)}</code> · ` : ""}not run</p><p>${why}</p><p class="pq-below">The main QA report follows, unchanged.</p></section>\n${END}`;
  }
  const meta = [
    `commit <code>${short(r.head)}</code> against <code>${esc(r.base)}</code>`,
    r.main.available ? `main ${r.main.sha ? `<code>${short(r.main.sha)}</code>` : "answer"}${r.main.run ? ` (<a href="${esc(r.main.run)}">run</a>)` : ""}` : "main's answer not stored",
    ...(r.run ? [`<a href="${esc(r.run)}">cone run</a>`] : []),
  ].join(" · ");
  const counts = ORDER.filter((d) => r.counts[d] > 0).map((d) => `<li>${chip(d)} ${r.counts[d]}</li>`).join("");
  const tests = r.cone.tests.kind === "all"
    ? `<p>Every test (${esc(r.cone.tests.why)}): none run here.</p>`
    : r.cone.tests.files.length === 0
      ? "<p>No test file imports a changed path.</p>"
      : `<ul class="pq-list">${r.cone.tests.files.map((f) => `<li><code>${esc(f)}</code></li>`).join("")}</ul>`;
  const changed = r.cone.changed.slice(0, 200).map((f) => `<li><code>${esc(f)}</code></li>`).join("") + (r.cone.changed.length > 200 ? `<li>… ${r.cone.changed.length - 200} more</li>` : "");
  const rows = r.results.map((x) => `<tr><td>${chip(x.delta)}</td><td>${x.kind}</td><td><code>${esc(x.name)}</code></td><td data-l="here">${esc(x.head)}</td><td data-l="main">${esc(x.main)}</td><td>${findingsCell(x)}</td></tr>`).join("");
  const table = r.results.length === 0
    ? "<p>Nothing in the cone to run.</p>"
    : `<table><thead><tr><th>vs main</th><th>kind</th><th>check</th><th>here</th><th>main</th><th>findings</th></tr></thead><tbody>${rows}</tbody></table>`;
  const notes = r.notes.map((n) => `<p class="pq-note">${esc(n).replace(/`([^`]+)`/g, "<code>$1</code>")}</p>`).join("");
  return [
    START,
    `<style>${STYLE}</style>`,
    `<section class="preview-qa" aria-labelledby="pq-h">`,
    `<h2 id="pq-h">This change (preview)</h2>`,
    `<p class="pq-meta">${meta}</p>`,
    `<ul class="pq-counts">${counts}</ul>`,
    `<details><summary>The cone: ${r.cone.changed.length} changed path(s), ${r.cone.tests.kind === "all" ? "every test" : `${r.cone.tests.files.length} test file(s)`}, ${r.cone.gates.length} gate(s); ${r.cone.outside} gate(s) outside it</summary>`,
    `<p><strong>Changed</strong></p><ul class="pq-list">${changed}</ul><p><strong>Tests</strong></p>${tests}</details>`,
    table,
    notes,
    `<p class="pq-note">Advisory: run because the PR is labelled <code>preview</code>. The release tier and merge-guard judge the merge.</p>`,
    `<p class="pq-below">The main QA report follows, unchanged.</p>`,
    `</section>`,
    END,
  ].join("\n");
}

// ---------------------------------------------------------------- inject

/** A page with any earlier section removed: what `staging-share.ts` compares. */
export function stripSection(html: string): string {
  for (;;) {
    const a = html.indexOf(START);
    if (a < 0) return html;
    const b = html.indexOf(END, a);
    if (b < 0) return html;
    let end = b + END.length;
    if (html[end] === "\n") end++;
    html = html.slice(0, a) + html.slice(end);
  }
}

/** Put `section` first in the page's `<main>`, else its `<body>`, else at the top; replacing an earlier one. */
export function injectSection(html: string, section: string): string {
  const page = stripSection(html);
  for (const re of [/<main\b[^>]*>/i, /<body\b[^>]*>/i]) {
    const m = re.exec(page);
    if (m) {
      const at = m.index + m[0].length;
      return `${page.slice(0, at)}\n${section}\n${page.slice(at)}`;
    }
  }
  return `${section}\n${page}`;
}

/** Whether a site file is a QA report page: `qa.html`, `qa/index.html`, `*-qa.html`, or one that says so. */
export function isQaPage(rel: string, html?: string): boolean {
  const r = rel.split("\\").join("/");
  if (!r.endsWith(".html")) return false;
  if (/(^|\/)qa\.html$/.test(r) || /(^|\/)qa\/index\.html$/.test(r) || /(^|\/)[^/]+[-.]qa\.html$/.test(r)) return true;
  return html !== undefined && /<meta\s+name="cat:qa-report"/i.test(html);
}

function htmlFiles(dir: string, root = dir, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules" && !e.name.startsWith(".")) htmlFiles(p, root, out);
    } else if (e.name.endsWith(".html")) out.push(relative(root, p).split("\\").join("/"));
  }
  return out;
}

/**
 * Put the section on every QA page of a built site, and the report beside it
 * as `preview-qa.json` for viewers that render QA in the browser. Returns
 * the pages changed.
 */
export function injectSite(site: string, report: PreviewQa | undefined, o: { sha: string; pages?: readonly string[] }): string[] {
  const section = renderSection(report, { sha: o.sha });
  const done: string[] = [];
  const pages = o.pages && o.pages.length > 0 ? o.pages : htmlFiles(site).sort();
  for (const rel of pages) {
    const abs = join(site, rel);
    if (!existsSync(abs)) continue;
    const html = readFileSync(abs, "utf-8");
    if (!(o.pages && o.pages.length > 0) && !isQaPage(rel, html)) continue;
    writeFileSync(abs, injectSection(html, section));
    done.push(rel);
  }
  writeFileSync(join(site, SITE_REPORT), JSON.stringify(report ?? { $schema: SCHEMA, head: o.sha, notRun: true }, null, 1) + "\n");
  return done;
}

/**
 * The report a preview build finds: `PREVIEW_QA_REPORT`, else
 * `build/preview-qa/preview-qa.json` in the checkout. Undefined when there is
 * none or it is not a `preview-qa/v1` report.
 */
export function findReport(repo: string, env: Readonly<Record<string, string | undefined>> = process.env): PreviewQa | undefined {
  const file = env.PREVIEW_QA_REPORT || join(repo, "build", "preview-qa", "preview-qa.json");
  try {
    const r = JSON.parse(readFileSync(file, "utf-8")) as PreviewQa;
    return r.$schema === SCHEMA ? r : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- CLI

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function args(argv: readonly string[], name: string): string[] {
  const out: string[] = [];
  argv.forEach((a, i) => {
    if (a === name && argv[i + 1] !== undefined) out.push(argv[i + 1]!);
  });
  return out;
}

function readOr(file: string | undefined, fallback: string): string {
  if (!file || !existsSync(file)) return fallback;
  return readFileSync(file, "utf-8");
}

const EMPTY_JUNIT = '<?xml version="1.0"?><testsuites tests="0" failures="0"></testsuites>';

export async function main(argv: readonly string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === "select") {
    const root = arg(rest, "--root") ?? ".";
    const base = arg(rest, "--base");
    const head = arg(rest, "--head") ?? "HEAD";
    if (!base) {
      console.error("select: --base <ref> is required");
      return 2;
    }
    // `--as`: the commit the preview is built from (a PR's head), when `head` is the merge CI checked out.
    const as = arg(rest, "--as") ?? execFileSync("git", ["-C", root, "rev-parse", head], { encoding: "utf-8" }).trim();
    const sel = await selectCone(root, changedPaths(root, base, head), { base: arg(rest, "--base-label") ?? base, head: as });
    const out = arg(rest, "--out");
    const text = JSON.stringify(sel, null, 1) + "\n";
    if (out) writeFileSync(out, text);
    else process.stdout.write(text);
    const prefix = arg(rest, "--prefix");
    if (prefix !== undefined) console.error(`tests: ${sel.tests.kind === "all" ? `all (${sel.tests.why}) — none run` : testArgs(sel, prefix).join(" ") || "none"}`);
    return 0;
  }
  if (cmd === "tests") {
    const sel = JSON.parse(readFileSync(arg(rest, "--selection")!, "utf-8")) as PreviewSelection;
    process.stdout.write(testArgs(sel, arg(rest, "--prefix") ?? "").join("\n") + "\n");
    return 0;
  }
  if (cmd === "judge") {
    const selFile = arg(rest, "--selection");
    const noSelection = !selFile || !existsSync(selFile);
    // No selection (it could not be made): judge the gates, and say the tests were not selected.
    const sel: PreviewSelection = noSelection
      ? { $schema: "preview-qa-selection/v1", base: "main", head: arg(rest, "--head-sha") ?? "", changed: [], tests: { kind: "some", files: [], why: {} } }
      : (JSON.parse(readFileSync(selFile!, "utf-8")) as PreviewSelection);
    const hd = arg(rest, "--head-dir")!;
    const md = arg(rest, "--main-dir");
    const mainDir = md && existsSync(join(md, "gates.json")) && existsSync(join(md, "junit.xml")) ? md : undefined;
    const from = mainDir ? (JSON.parse(readOr(join(mainDir, "from.json"), "{}")) as { main?: string; run?: string }) : {};
    const findingsFile = arg(rest, "--findings");
    const r = judge({
      selection: sel,
      head: { junit: readOr(join(hd, "junit.xml"), EMPTY_JUNIT), gates: JSON.parse(readOr(join(hd, "gates.json"), "{}")) },
      ...(mainDir ? { main: { junit: readFileSync(join(mainDir, "junit.xml"), "utf-8"), gates: JSON.parse(readFileSync(join(mainDir, "gates.json"), "utf-8")), ...(from.main ? { sha: from.main } : {}), ...(from.run ? { run: from.run } : {}) } } : {}),
      ...(findingsFile && existsSync(findingsFile) ? { findings: JSON.parse(readFileSync(findingsFile, "utf-8")) } : {}),
      ...(arg(rest, "--run") ? { run: arg(rest, "--run")! } : {}),
      prefix: arg(rest, "--prefix") ?? "",
    });
    if (noSelection) r.notes.unshift("The change's tests could not be selected (see the cone step of the run), so none ran.");
    writeFileSync(arg(rest, "--out")!, JSON.stringify(r, null, 1) + "\n");
    const mdOut = arg(rest, "--md");
    if (mdOut) writeFileSync(mdOut, markdown(r));
    else process.stdout.write(markdown(r));
    return 0;
  }
  if (cmd === "inject") {
    const site = arg(rest, "--site")!;
    const reportFile = arg(rest, "--report");
    const report = reportFile ? findReport("", { PREVIEW_QA_REPORT: reportFile }) : findReport(arg(rest, "--repo") ?? ".");
    const pages = injectSite(site, report, { sha: arg(rest, "--sha") ?? report?.head ?? "", pages: args(rest, "--page") });
    console.log(`preview-qa: "This change (preview)" on ${pages.length} QA page(s)${pages.length ? `: ${pages.join(", ")}` : ""}`);
    return 0;
  }
  console.error("usage: preview-qa.ts select|tests|judge|inject …");
  return 2;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
