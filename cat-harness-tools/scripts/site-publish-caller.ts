#!/usr/bin/env bun
/**
 * Every harnessed repository publishes its site, and refreshes its QA
 * reports, on every push to main, through the ONE shared workflow, and its
 * caller of that workflow is the canonical one.
 *
 * @module scripts/site-publish-caller
 * @covers cat-harness — the instance axis: a harnessed repository's `.github/workflows/` carries the canonical caller of `folio-site-publish.yml`
 *
 * Owner, 2026-11-11: *"i want that it publishes once merge to main, update QA
 * reports etc."* (cat-harness-tools#1879). The shared workflow is
 * `.github/workflows/folio-site-publish.yml`. The canonical caller is
 * `templates/document/github/workflows/site-publish.yml`, which is read from
 * this layer's own copy and never restated here. A repository is judged when
 * it has an `index.config.json` (it is harnessed). A finding is any of these:
 *
 * | the repository | why it is wrong |
 * |---|---|
 * | calls `folio-site-publish.yml` from no workflow | it never publishes on a merge |
 * | calls it from more than one workflow | two publishes race for gh-pages |
 * | has a caller that differs from the template other than in comments and the pinned commit | e.g. a manual-only trigger, a `paths` filter, other inputs, an extra job |
 * | has a caller pinned to a branch or tag | `check:workflow-pins` moves it to the lock's commit |
 * | runs `stage-local.ts` in a workflow step of its own (a call, not a mention in an `echo` or a comment) | a hand-rolled copy of the shared steps (the old IG template) |
 *
 * WHICH commit the caller is pinned to is `check:workflow-pins`' question,
 * not this one's: here any 40-hex commit is accepted.
 *
 *   bun run cat check:site-publish-caller          # judge this checkout
 *   bun run cat site-publish-caller --write        # write the canonical caller (then: bun run cat workflow-pins)
 *
 * Exit codes: 0 canonical, or not a harnessed repository · 1 a finding · 2 the template is unreadable.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { parse as parseYaml } from "yaml";

/** The shared workflow's file name. */
export const SHARED = "folio-site-publish.yml";
/** Where the canonical caller lives in a repository. */
export const CALLER_PATH = ".github/workflows/site-publish.yml";
/** This layer's canonical caller. */
export const TEMPLATE = resolve(import.meta.dir, "..", "templates", "document", "github", "workflows", "site-publish.yml");

const SHA = /^[0-9a-f]{40}$/;
/** A call of the shared workflow, under whichever owner holds cat-harness-tools (the lock says which). */
const CALL = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/cat-harness-tools\/\.github\/workflows\/folio-site-publish\.yml@(\S+)$/;

export interface Finding {
  file: string;
  why: string;
}

/** The ref a `uses:` value calls the shared workflow at, or undefined when it does not call it. */
export function sharedRef(uses: unknown): string | undefined {
  if (typeof uses !== "string") return undefined;
  return CALL.exec(uses.trim())?.[1];
}

/** A parsed workflow, with every call of the shared workflow's ref replaced by `@<pin>`. */
function normalised(doc: unknown): unknown {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "uses" && sharedRef(x) !== undefined ? `@<pin>` : walk(x)]));
    return v;
  };
  return walk(doc);
}

/** The paths (`on.push`, `jobs.publish.with.plan`, …) at which two parsed values differ. */
export function differences(want: unknown, have: unknown, at = ""): string[] {
  const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
  if (isObj(want) && isObj(have)) {
    const keys = [...new Set([...Object.keys(want), ...Object.keys(have)])].sort();
    return keys.flatMap((k) => {
      const p = at ? `${at}.${k}` : k;
      if (!(k in have)) return [`${p} is missing`];
      if (!(k in want)) return [`${p} is not in the canonical caller`];
      return differences(want[k], have[k], p);
    });
  }
  return JSON.stringify(want) === JSON.stringify(have) ? [] : [`${at || "the file"} is ${JSON.stringify(have)}, the canonical caller has ${JSON.stringify(want)}`];
}

/** `on` as YAML 1.1 readers may give it: the key `on`, or `true`. */
function triggers(doc: Record<string, unknown>): Record<string, unknown> {
  const on = doc.on ?? doc["true"];
  if (typeof on === "string") return { [on]: null };
  if (Array.isArray(on)) return Object.fromEntries(on.map((x) => [String(x), null]));
  return (on && typeof on === "object" ? on : {}) as Record<string, unknown>;
}

/** One sentence for what is most wrong with a caller's triggers, before the itemised differences. */
function triggerSummary(have: Record<string, unknown>): string | undefined {
  const push = have.push as { branches?: unknown; paths?: unknown; "paths-ignore"?: unknown } | null | undefined;
  if (!("push" in have)) return "manual-only: it has no `push` trigger, so a merge to main publishes nothing";
  const branches = Array.isArray(push?.branches) ? push!.branches : [];
  if (!branches.includes("main")) return "its `push` trigger does not name main, so a merge to main publishes nothing";
  if (push?.paths !== undefined || push?.["paths-ignore"] !== undefined) return "its `push` trigger is filtered by path, so a merge that changes other files publishes nothing";
  return undefined;
}

/**
 * Whether a step's `run:` script INVOKES `stage-local.ts` (or `cat stage:local`),
 * as opposed to naming it in a message. Per line: shell comments, quoted
 * strings and the arguments of `echo`/`printf` are dropped first, so
 * `echo "::notice::... published by stage-local.ts."` is not a call
 * (a layer's ghbuild.yml was once reported for its notice alone).
 */
export function invokesStageLocal(run: string): boolean {
  return run.split("\n").some((line) => {
    const bare = line
      .replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, " ")
      .replace(/(^|\s)#.*$/, "$1");
    return bare
      .split(/&&|\|\||;|\|/)
      .filter((cmd) => !/^\s*(?:echo|printf)\b/.test(cmd))
      .some((cmd) => /stage-local\.ts|\bcat\s+stage:local\b/.test(cmd));
  });
}

/** Judge one checkout's workflow texts (file name → text) against the canonical caller's text. */
export function judge(workflows: Map<string, string>, template: string): Finding[] {
  const want = normalised(parseYaml(template));
  const findings: Finding[] = [];
  const callers: string[] = [];
  for (const [file, text] of [...workflows.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    let doc: Record<string, unknown>;
    try {
      doc = (parseYaml(text) ?? {}) as Record<string, unknown>;
    } catch (e) {
      findings.push({ file, why: `is not YAML (${(e as Error).message.split("\n")[0]})` });
      continue;
    }
    const jobs = (doc.jobs && typeof doc.jobs === "object" ? doc.jobs : {}) as Record<string, { uses?: unknown; steps?: { run?: unknown }[] }>;
    const refs = Object.values(jobs).map((j) => sharedRef(j?.uses)).filter((r): r is string => r !== undefined);
    const handRolled = Object.values(jobs).some((j) => Array.isArray(j?.steps) && j.steps.some((s) => typeof s?.run === "string" && invokesStageLocal(s.run)));
    if (handRolled) findings.push({ file, why: `runs stage-local.ts in a step of its own: a hand-rolled copy of ${SHARED}; call the shared workflow from ${CALLER_PATH} instead` });
    if (refs.length === 0) continue;
    callers.push(file);
    for (const r of refs) if (!SHA.test(r)) findings.push({ file, why: `calls ${SHARED} at '${r}', not a commit: run \`bun run cat workflow-pins\`` });
    const summary = triggerSummary(triggers(doc));
    const diffs = differences(want, normalised(doc));
    if (summary || diffs.length) findings.push({ file, why: [summary, ...diffs].filter(Boolean).join("; ") });
  }
  if (callers.length === 0) findings.unshift({ file: CALLER_PATH, why: `is missing: no workflow calls ${SHARED}, so a merge to main neither publishes the site nor refreshes its QA reports` });
  else if (callers.length > 1) findings.unshift({ file: callers.join(", "), why: `each call ${SHARED}: keep one, ${CALLER_PATH}, or two publishes race for gh-pages` });
  else if (callers[0] !== "site-publish.yml") findings.push({ file: callers[0]!, why: `the caller is named ${CALLER_PATH} in every repository (move it)` });
  return findings;
}

/** Every `.github/workflows/*.yml|yaml` of a checkout, by file name. */
export function workflowTexts(root: string): Map<string, string> {
  const dir = join(root, ".github", "workflows");
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) if (/\.ya?ml$/.test(f)) out.set(f, readFileSync(join(dir, f), "utf8"));
  return out;
}

/** Is this checkout harnessed (it has an index.config.json)? This layer's own repository is not judged: it holds the template. */
export function judged(root: string): boolean {
  return existsSync(join(root, "index.config.json")) && !existsSync(join(root, "templates", "document", "github", "workflows", "site-publish.yml"));
}

if (import.meta.main) {
  const write = process.argv.includes("--write");
  const rootArg = process.argv.find((a, i) => i > 1 && !a.startsWith("--"));
  const root = resolve(rootArg ?? process.cwd());
  let template: string;
  try {
    template = readFileSync(TEMPLATE, "utf8");
    parseYaml(template);
  } catch (e) {
    console.log(`  ✗ the canonical caller ${TEMPLATE} is unreadable: ${(e as Error).message}`);
    process.exit(2);
  }
  console.log(`Site publish on push to main, through ${SHARED}:`);
  if (!judged(root)) {
    console.log(`  · not judged: ${existsSync(join(root, "index.config.json")) ? "this is the layer that holds the canonical caller" : "no index.config.json, so not a harnessed repository"}`);
    process.exit(0);
  }
  if (write) {
    const file = join(root, CALLER_PATH);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, template);
    console.log(`  ✎ wrote ${CALLER_PATH}; now run \`bun run cat workflow-pins\` to pin it to index.lock.json, and remove any other caller of ${SHARED}`);
  }
  const findings = judge(workflowTexts(root), template);
  if (findings.length === 0) {
    console.log(`  ✓ ${CALLER_PATH} is the canonical caller`);
    process.exit(0);
  }
  for (const f of findings) console.log(`  ✗ ${f.file}: ${f.why}`);
  console.log(`  the canonical caller is cat-harness-tools/templates/document/github/workflows/site-publish.yml (\`bun run cat site-publish-caller --write\`)`);
  process.exit(1);
}
