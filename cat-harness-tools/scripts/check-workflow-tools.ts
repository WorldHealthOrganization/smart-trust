#!/usr/bin/env bun
/**
 * Every script a GitHub workflow runs is a Tool, and every such Tool is
 * linked to a process.
 *
 * Owner, 2026-11-10: "is each github action a skill (so also available under
 * for example MCP or CLI)? … make sure linked to processes". A step that runs
 * a script nobody declared is reachable from CI and from nowhere else: an
 * agent cannot find it with `bun run cat`, the MCP server does not serve it
 * (`registerServedToolGroups` serves the `tools` graph), and no BPMN says which
 * process it is a step of. So two findings per script a workflow runs:
 *
 * - **no-tool**: no Tool in any declared `tools` graph reaches it. A Tool
 *   reaches a script when its `invoke.shell` names the file, or names a
 *   `bun run cat <key>` whose declared command runs the file, or when its
 *   `invoke.inProcess` / `invoke.mcp` module is the file.
 * - **no-process**: a Tool reaches it, but none of the Tools that do is linked
 *   to a process. A Tool is linked when a skill it `satisfies` is named by a
 *   task in a `.bpmn` of the checkout (`<…processes:skill ref="…"/>`), or when
 *   it declares `subprocesses`.
 *
 * ## What needs no Tool
 *
 * - **QC checks** (owner, 2026-11-10: "we dont need Tools/Skills for QC checks
 *   actions"): a run through a gate key (`check:*`, `*:check`), a run with
 *   `--check` or `--verify`, or a file named for a check (`check-*`,
 *   `audit-*`, `validate-*`, `verify-*`, `*-links`, a `test/` file; see
 *   {@link isQcScript}). A generator a workflow also runs to WRITE is still
 *   judged on that run.
 * - **A step of a Tool**: a script a Tool's own implementation runs (a
 *   `bun run cat <key>` or a script path literal in it) is covered by that
 *   Tool, so a workflow that runs the step directly needs no second Tool.
 * - **A step of a workflow Tool**: a Tool whose `invoke.shell` is
 *   `gh workflow run <file>` covers every script that workflow runs,
 *   following the reusable workflows it calls ({@link scriptsOfWorkflow}).
 *   One Tool per workflow, not one per helper script.
 *
 * ## What counts as "run"
 *
 * Read out of the `run:` blocks of `.github/workflows/*.yml` and of composite
 * actions (`.github/actions/<name>/action.yml`), comment lines removed:
 *
 * - an interpreter followed by a file: `bun [run] x.ts`, `bash x.sh`,
 *   `python3 [-I] x.py`, `node x.js`, `sh x.sh`; a bare `./x.sh`; and a
 *   `script=x.py` assignment (the step then runs `"$script"`);
 * - a script key: `bun run cat <key>` or `bun run <a:b>`, resolved through the
 *   checkout's script table to the file it runs.
 *
 * A path is resolved against the checkout the way a workflow's own checkout
 * prefix (`fa/`, `ci/`, `tools/`) hides it: leading segments are dropped
 * until the rest names a file at the root or in the workflow's own layer. A
 * path that resolves to no file is reported as `unresolved`, never dropped.
 *
 * ## A ratchet, one baseline per layer, kept in that layer
 *
 * `.github/workflows/` is not a declared graph typology (see
 * `check-ci-invocations.ts`), and on the day this landed most scripts the
 * workflows run had no Tool. So existing findings are recorded, and only a
 * NEW one fails. The fix for a new finding is a Tool node (and a process
 * link), never a wider baseline.
 *
 * Each layer keeps its own list in `.github/workflow-tools-baseline.json`
 * (the index root in its own `.github/`), never in this layer: a list here
 * of another layer's scripts would name the layers above this one, which
 * `check:reference-direction` refuses.
 *
 * - A layer with NO baseline file is not yet ratcheted: its findings are
 *   reported and do not fail, so the gate can land before every repository
 *   that runs it (every IG repo through `layer-pr-checks`) has been measured.
 *   Seeding one is `--write-baseline <layer directory>` (`.` for the root).
 * - A listed finding that is gone is reported as fixed, not failed: the Tool
 *   that fixes it usually lands in another layer, and a checkout pinned on
 *   either side of that change must not go red on a line it cannot change.
 * - In a layer's PR checks only the caller's own workflows are judged
 *   (`lib/gate-own.ts`), as `check-ci-invocations.ts` does.
 *
 * Usage:  bun run cat check:workflow-tools [--list] [--write-baseline [<layer dir> ...]]
 *         `--write-baseline` alone rewrites the layers that already have one.
 * Exit:   0 no new finding · 1 a new finding in a ratcheted layer
 *         2 no workflow found: could not determine
 *
 * @module scripts/check-workflow-tools
 * @covers tools, processes
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { discoverTools } from "../tools/discover.js";
import type { ToolDefinition } from "../schemas/tools/tool.js";
import { scriptTable } from "../schemas/sdlc/script-table.ts";
import { gateOwnsFile } from "./lib/gate-own.ts";
import { declaredInstanceName } from "./lib/roots.ts";

const ROOT = resolve(import.meta.dir, "..", "..");
/** A layer's baseline, inside that layer: `<layer dir>/.github/workflow-tools-baseline.json`. */
export function baselinePath(layerDir: string, root: string = ROOT): string {
  return join(root, layerDir, ".github", "workflow-tools-baseline.json");
}

const SCRIPT_EXT = "(?:ts|mts|sh|py|mjs|cjs|js)";
const PATH = `((?:\\.{1,2}/)*[\\w.@-]+(?:/[\\w.@-]+)*\\.${SCRIPT_EXT})`;
const END = `(?=$|[\\s"';&|)])`;
/** An interpreter, its flags, then the file. Quotes around the file are allowed. */
const INTERPRETED = new RegExp(
  `(?:^|[\\s;&|(])(?:bun(?:\\s+run)?|bash|sh|python3?|node|deno\\s+run)(?:\\s+-[\\w-]+)*\\s+["']?${PATH}["']?${END}`,
  "g",
);
/** `./x.sh` at the start of a command. */
const BARE = new RegExp(`(?:^|[;&|(]\\s*|\\s)(\\.{1,2}/[\\w.@/-]+\\.${SCRIPT_EXT})${END}`, "g");
/** `script=ci/.github/scripts/x.py`: the step runs "$script" next. */
const ASSIGNED = new RegExp(`(?:^|\\s)[A-Za-z_]\\w*=["']?${PATH}["']?${END}`, "g");

/**
 * A script copied out of a pinned tree before it runs: `git [-C d] show
 * "<ref>:<src>" > "$var"` with `var=<dest>` in the same block, then `bun
 * "$var"`. The step runs `<src>` at a pin (the judging scripts' version), and
 * `<dest>` is a scratch name that exists in no tree, so it is read as `<src>`
 * rather than reported as `unresolved` (the preview tier's
 * `.preview-qa-ci.ts`, a copy of `scripts/preview-qa.ts`).
 */
const COPIED_FROM_PIN = new RegExp(
  `\\bshow\\s+["']?[^\\s"':]*:${PATH}["']?\\s*>\\s*["']?\\$\\{?([A-Za-z_]\\w*)\\}?["']?`,
  "g",
);
const VAR_PATH = new RegExp(`(?:^|\\s)([A-Za-z_]\\w*)=["']?${PATH}["']?${END}`, "g");

/** In one `run:` block, each copy destination named by a variable → the path it was copied from. */
export function pinnedCopies(block: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const m of block.matchAll(VAR_PATH)) vars.set(m[1]!, m[2]!);
  const out = new Map<string, string>();
  for (const m of block.matchAll(COPIED_FROM_PIN)) {
    const dest = vars.get(m[2]!);
    if (dest !== undefined) out.set(dest, m[1]!);
  }
  return out;
}
/** `bun run cat <key>` or `bun run <a:b>`. */
const KEYED = /\bbun run (?:cat ([A-Za-z0-9:_.-]+)|([A-Za-z0-9_.-]+:[A-Za-z0-9:_.-]+))/g;

export interface Invocation {
  /** The workflow or action file, relative to the root. */
  workflow: string;
  /** As written in the step. */
  raw: string;
  /** The script key, when the step names one. */
  key?: string;
  /** That key and every key its command runs in turn. */
  keys?: string[];
  /** Whether the key is declared in a manifest of this checkout. */
  declared?: boolean;
  /** Run as a quality check, not as a step that makes something: see {@link isQcScript}. */
  qc: boolean;
  /** The file it runs, relative to the root; undefined when none resolves. */
  script?: string;
}

/** The text of every `run:` block, comment lines removed. */
export function runBlocks(yaml: string): string[] {
  const lines = yaml.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:-\s+)?run:\s*(.*)$/.exec(lines[i]!);
    if (m === null) continue;
    const rest = m[2]!.trim();
    if (rest !== "" && !/^[|>][+-]?\d*$/.test(rest)) {
      out.push(rest);
      continue;
    }
    const indent = m[1]!.length;
    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j]!;
      if (l.trim() === "") {
        body.push("");
        continue;
      }
      if (l.length - l.trimStart().length <= indent) break;
      body.push(l);
      i = j;
    }
    out.push(body.filter((l) => !/^\s*#/.test(l)).join("\n"));
  }
  return out;
}

/** Workflow and composite-action files of the root and of each layer directory in it. */
export function workflowFiles(root: string = ROOT): string[] {
  const out: string[] = [];
  const bases = [".", ...readdirSync(root).filter((d) => !d.startsWith(".") && d !== "node_modules" && isDir(join(root, d)))];
  for (const b of bases) {
    const wf = join(root, b, ".github", "workflows");
    if (isDir(wf)) {
      for (const f of readdirSync(wf).sort()) if (/\.ya?ml$/.test(f)) out.push(relative(root, join(wf, f)));
    }
    const actions = join(root, b, ".github", "actions");
    if (isDir(actions)) {
      for (const a of readdirSync(actions).sort()) {
        for (const f of ["action.yml", "action.yaml"]) if (existsSync(join(actions, a, f))) out.push(relative(root, join(actions, a, f)));
      }
    }
  }
  return out;
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** The layer directory a root-relative file sits in, or "." for the root's own. */
export function layerOf(rel: string, root: string = ROOT): string {
  const first = rel.split("/")[0]!;
  return first !== ".github" && isDir(join(root, first)) ? first : ".";
}

/**
 * The file a written path names, relative to the root. Leading segments are
 * dropped (a workflow's own checkout prefix) until the rest is a file at the
 * root or in the workflow's own layer.
 */
export function resolvePath(raw: string, workflowLayer: string, root: string = ROOT): string | undefined {
  if (raw.includes("$")) return undefined;
  const segs = raw.replace(/^(?:\.{1,2}\/)+/, "").split("/");
  for (let i = 0; i < segs.length; i++) {
    const rest = segs.slice(i).join("/");
    for (const cand of workflowLayer === "." ? [rest] : [join(workflowLayer, rest), rest]) {
      const abs = join(root, cand);
      if (existsSync(abs) && !isDir(abs)) return cand;
    }
  }
  return undefined;
}

/** Every file a command line runs, resolved. */
function filesInCommand(command: string, layer: string, root: string): string[] {
  const out = new Set<string>();
  for (const rx of [INTERPRETED, BARE, ASSIGNED]) {
    for (const m of command.matchAll(rx)) {
      const p = resolvePath(m[1]!, layer, root);
      if (p !== undefined) out.add(p);
    }
  }
  // A Tool's shell may name the file with no interpreter (`fhir-harness/scripts/x.sh`).
  const first = /^\s*((?:\.{1,2}\/)*[\w.@-]+(?:\/[\w.@-]+)+\.(?:ts|mts|sh|py|mjs|cjs|js))\b/.exec(command);
  if (first) {
    const p = resolvePath(first[1]!, layer, root);
    if (p !== undefined) out.add(p);
  }
  return [...out];
}

/**
 * A script key, followed through the keys its command runs in turn
 * (`smart:pages` → `bun run cat smart-base:pages` → a file), to the files it
 * runs. `declared` is false when the first key is in no manifest here.
 */
export function keyChain(
  key: string,
  table: ReturnType<typeof scriptTable>,
  root: string = ROOT,
): { keys: string[]; files: string[]; declared: boolean } {
  const keys: string[] = [];
  const files = new Set<string>();
  let next: string | undefined = key;
  while (next !== undefined && !keys.includes(next) && keys.length < 8) {
    keys.push(next);
    const entry = table.get(next);
    if (entry === undefined) break;
    for (const f of filesInCommand(entry.command, ".", root)) files.add(f);
    next = /^\s*bun run (?:cat )?([A-Za-z0-9:_.-]+)(?:\s|$)/.exec(entry.command)?.[1];
    if (next !== undefined && /\.(?:m?[jt]s)$/.test(next)) next = undefined;
  }
  return { keys, files: [...files], declared: table.has(key) };
}

/**
 * Quality checks need no Tool (owner, 2026-11-10: "we dont need Tools/Skills
 * for QC checks actions"). A run is a QC check when it is reached through a
 * gate key (`check:*`, `*:check`, `lint`, the set `run-gates.py` derives),
 * passes `--check`, `--verify` or a `verify` subcommand, or runs a file whose
 * name begins `check-`, `validate-`, `lint-` and the like, or carries an
 * `audit`, `verify` or `gates` segment (`determinism-audit.sh`,
 * `run-root-gates.py`). A script that a workflow ALSO runs as a
 * producing step (a generator run once to write and once with `--check`) is
 * still judged, on its producing runs.
 */
export const QC_KEY = /(?:^|:)check(?::|$)|^check-|^audit:|^qa:|^lint(?::|$)/;
const CHECK_FLAG = /\s(?:--(?:check|verify)\b|verify(?:\s|$))/;
export function isQcScript(path: string): boolean {
  if (/(?:^|\/)tests?\//.test(path)) return true;
  const base = (path.split("/").pop() ?? "").replace(/\.[a-z]+$/, "");
  return (
    /^(?:check|audit|validate|verify|qa|typecheck|lint)(?:[-_]|$)/.test(base) ||
    /[-_](?:check|verify|verdict|dryrun|links|dead-links|qa)$/.test(base) ||
    /^verdict[-_]/.test(base) ||
    /(?:^|[-_])(?:audit|verify|gates)(?:[-_]|$)/.test(base)
  );
}

/** The whole line of `text` that holds `index`. */
function lineAround(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? undefined : end);
}

/** Every script the workflows under `root` run. */
export function invocations(root: string = ROOT, files: readonly string[] = workflowFiles(root)): Invocation[] {
  const table = scriptTable(root);
  const out: Invocation[] = [];
  const seen = new Set<string>();
  const push = (i: Invocation) => {
    const k = `${i.workflow}\0${i.raw}\0${i.qc}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(i);
  };
  for (const workflow of files) {
    const layer = layerOf(workflow, root);
    for (const block of runBlocks(readFileSync(join(root, workflow), "utf-8"))) {
      const copies = pinnedCopies(block);
      for (const rx of [INTERPRETED, BARE, ASSIGNED]) {
        for (const m of block.matchAll(rx)) {
          const raw = copies.get(m[1]!) ?? m[1]!;
          if (raw.includes("$")) continue; // a path built at run time names no file here
          const script = resolvePath(raw, layer, root);
          push({ workflow, raw, script, qc: isQcScript(script ?? raw) || CHECK_FLAG.test(lineAround(block, m.index!)) });
        }
      }
      for (const m of block.matchAll(KEYED)) {
        const key = (m[1] ?? m[2])!;
        if (/\.(?:m?[jt]s)$/.test(key)) continue; // `bun run cat x.ts` is a path, read above
        const chain = keyChain(key, table, root);
        const qc =
          chain.keys.some((k) => QC_KEY.test(k)) ||
          (chain.files.length > 0 && chain.files.every(isQcScript)) ||
          CHECK_FLAG.test(lineAround(block, m.index!));
        push({ workflow, raw: `bun run cat ${key}`, key, keys: chain.keys, script: chain.files[0], declared: chain.declared, qc });
      }
    }
  }
  return out;
}

export interface Reach {
  /** Tool ids reaching each root-relative file. */
  byFile: Map<string, string[]>;
  /** Tool ids naming each script key. */
  byKey: Map<string, string[]>;
}

/** Which files and keys each Tool reaches. */
export function toolReach(defs: readonly ToolDefinition[], root: string = ROOT): Reach {
  const byFile = new Map<string, string[]>();
  const byKey = new Map<string, string[]>();
  const add = (m: Map<string, string[]>, k: string, id: string) => m.set(k, [...new Set([...(m.get(k) ?? []), id])]);
  const table = scriptTable(root);
  const layers = readdirSync(root).filter((d) => !d.startsWith(".") && d !== "node_modules" && isDir(join(root, d)));
  for (const t of defs) {
    const shell = t.invoke.shell;
    if (shell !== undefined) {
      for (const f of filesInCommand(shell, ".", root)) add(byFile, f, t.id);
      const wf = /\bgh workflow run ([\w.-]+\.ya?ml)\b/.exec(shell)?.[1];
      if (wf !== undefined) for (const f of scriptsOfWorkflow(wf, root)) add(byFile, f, t.id);
      const k = /^\s*bun run (?:cat )?([A-Za-z0-9:_.-]+)/.exec(shell)?.[1];
      if (k !== undefined && !/\.(?:m?[jt]s)$/.test(k)) {
        const chain = keyChain(k, table, root);
        for (const key of chain.keys) add(byKey, key, t.id);
        for (const f of chain.files) add(byFile, f, t.id);
      }
    }
    for (const mod of [t.invoke.inProcess?.module]) {
      if (mod === undefined) continue;
      for (const l of layers) if (existsSync(join(root, l, mod))) add(byFile, join(l, mod), t.id);
    }
  }
  // A step a Tool's own implementation runs is part of that Tool: a workflow
  // that runs the step directly does not need a second Tool for it.
  const direct = new Map([...byFile].map(([f, ids]) => [f, [...ids]]));
  for (const [file, ids] of direct) {
    for (const f of stepsRunBy(file, table, root)) for (const id of ids) add(byFile, f, id);
  }
  return { byFile, byKey };
}

/**
 * Every script a workflow runs, by the workflow's file name, with the
 * reusable workflows it calls (`uses: <owner>/<repo>/.github/workflows/x.yml@…`
 * or `./.github/workflows/x.yml`) followed. A Tool that dispatches a workflow
 * (`gh workflow run <file>`, standard GitHub CLI, no schema of our own) is the
 * workflow as a whole, so the scripts it runs are its steps (owner, 2026-11-10,
 * option B "one Tool per workflow", "just didnt want custom schemas").
 * Every layer's copy of a file of that name is read: the callers share names
 * (`harness-pr-checks.yml`, `publish-context.yml`).
 */
export function scriptsOfWorkflow(name: string, root: string = ROOT, files: readonly string[] = workflowFiles(root)): string[] {
  const out = new Set<string>();
  const seen = new Set<string>();
  const queue = files.filter((f) => f.endsWith(`/workflows/${name}`) || f === `.github/workflows/${name}`);
  while (queue.length > 0) {
    const f = queue.shift()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const i of invocations(root, [f])) if (i.script !== undefined) out.add(i.script);
    const text = readFileSync(join(root, f), "utf-8");
    for (const m of text.matchAll(/^\s*(?:-\s+)?uses:\s*["']?(?:([\w.-]+)\/([\w.-]+)|\.)\/\.github\/workflows\/([\w.-]+\.ya?ml)/gm)) {
      const repo = m[2];
      const called = m[3]!;
      const own = layerOf(f, root);
      const want = repo !== undefined && isDir(join(root, repo)) ? `${repo}/.github/workflows/${called}` : own === "." ? `.github/workflows/${called}` : `${own}/.github/workflows/${called}`;
      if (files.includes(want)) queue.push(want);
    }
  }
  return [...out];
}

/**
 * The scripts a file runs as steps, one level deep: a `bun run cat <key>` it
 * names, or a script path in a string literal (`"cat-harness-tools/scripts/x.ts"`,
 * `join(..., "set-html-lang.ts")` is not read). Comment lines are skipped,
 * so a file that only MENTIONS a script does not claim it.
 */
export function stepsRunBy(file: string, table: ReturnType<typeof scriptTable>, root: string = ROOT): string[] {
  let text: string;
  try {
    text = readFileSync(join(root, file), "utf-8");
  } catch {
    return [];
  }
  const code = text
    .split("\n")
    .filter((l) => !/^\s*(?:\/\/|\*|\/\*|#)/.test(l))
    .join("\n");
  const layer = layerOf(file, root);
  const out = new Set<string>();
  for (const m of code.matchAll(/["'`]((?:\.{1,2}\/)?[\w.@-]+(?:\/[\w.@-]+)+\.(?:ts|sh|py))["'`]/g)) {
    if (/^\.{1,2}\//.test(m[1]!)) continue; // a relative import is a library, not a step
    const p = resolvePath(m[1]!, layer, root);
    if (p !== undefined && p !== file) out.add(p);
  }
  for (const m of code.matchAll(/["'`\s]bun run cat ([A-Za-z0-9:_.-]+)/g)) {
    for (const f of keyChain(m[1]!, table, root).files) if (f !== file) out.add(f);
  }
  return [...out];
}

/** Skill name → the process ids (`.bpmn` stems) with a task naming it. */
export function skillProcesses(root: string = ROOT): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const walk = (dir: string, depth: number) => {
    if (depth > 8) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.name.endsWith(".bpmn")) {
        const id = e.name.slice(0, -".bpmn".length);
        for (const m of readFileSync(p, "utf-8").matchAll(/<[\w.-]+:skill\s+ref="([^"]+)"/g)) {
          if (!out.has(m[1]!)) out.set(m[1]!, new Set());
          out.get(m[1]!)!.add(id);
        }
      }
    }
  };
  walk(root, 0);
  return out;
}

/** The processes a Tool is linked to: through a skill it satisfies, or its own subprocesses. */
export function processesOf(t: ToolDefinition, bySkill: Map<string, Set<string>>): string[] {
  const out = new Set<string>(t.subprocesses ?? []);
  for (const s of t.satisfies) for (const p of bySkill.get(s) ?? []) out.add(p);
  return [...out].sort();
}

export type Kind = "no-tool" | "no-process" | "unresolved";

export interface Finding {
  kind: Kind;
  /** The resolved file, or the raw path or key when none resolved. */
  subject: string;
  workflows: string[];
  tools: string[];
}

export function baselineKey(f: Pick<Finding, "kind" | "subject">): string {
  return `${f.kind}: ${f.subject}`;
}

export function assess(invs: readonly Invocation[], reach: Reach, defs: readonly ToolDefinition[], bySkill: Map<string, Set<string>>) {
  const byId = new Map(defs.map((t) => [t.id, t]));
  const subjects = new Map<string, { invs: Invocation[] }>();
  const producing = new Set(invs.filter((i) => !i.qc).map((i) => i.script ?? (i.key !== undefined ? `key ${i.key}` : i.raw)));
  for (const i of invs) {
    const s = i.script ?? (i.key !== undefined ? `key ${i.key}` : i.raw);
    // A key whose command runs no file (`lint` → eslint) is judged as the key.
    if (!producing.has(s)) continue; // a QC check: no Tool needed
    if (!subjects.has(s)) subjects.set(s, { invs: [] });
    subjects.get(s)!.invs.push(i);
  }
  const findings: Finding[] = [];
  const ok: Array<{ subject: string; tools: string[]; processes: string[] }> = [];
  for (const [subject, { invs: is }] of [...subjects].sort(([a], [b]) => a.localeCompare(b))) {
    const workflows = [...new Set(is.map((i) => i.workflow))].sort();
    const tools = new Set<string>();
    for (const i of is) {
      if (i.script !== undefined) for (const id of reach.byFile.get(i.script) ?? []) tools.add(id);
      for (const k of i.keys ?? []) for (const id of reach.byKey.get(k) ?? []) tools.add(id);
    }
    const ids = [...tools].sort();
    if (ids.length === 0) {
      const resolved = is.some((i) => i.script !== undefined || i.declared === true);
      findings.push({ kind: resolved ? "no-tool" : "unresolved", subject, workflows, tools: [] });
      continue;
    }
    const processes = [...new Set(ids.flatMap((id) => processesOf(byId.get(id)!, bySkill)))].sort();
    if (processes.length === 0) findings.push({ kind: "no-process", subject, workflows, tools: ids });
    else ok.push({ subject, tools: ids, processes });
  }
  return { findings, ok, subjects: new Set(subjects.keys()), qc: new Set(invs.filter((i) => !producing.has(i.script ?? (i.key !== undefined ? `key ${i.key}` : i.raw))).map((i) => i.script ?? i.raw)).size };
}

/**
 * One layer's baseline. Absent means the layer is not yet ratcheted: its
 * findings are reported and do not fail.
 */
export interface Baseline {
  _comment?: string;
  findings: string[];
}

export function readBaseline(layerDir: string, root: string = ROOT): Baseline | undefined {
  const p = baselinePath(layerDir, root);
  if (!existsSync(p)) return undefined;
  return JSON.parse(readFileSync(p, "utf-8")) as Baseline;
}

/** The layer a workflow file belongs to, by name: its directory, or the root's own name. */
export function layerName(workflow: string, root: string = ROOT): string {
  const dir = layerOf(workflow, root);
  if (dir !== ".") return dir;
  const own = declaredInstanceName(root);
  if (own !== undefined) return own;
  try {
    return (JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as { name?: string }).name ?? ".";
  } catch {
    return ".";
  }
}

const COMMENT =
  "Scripts this layer's GitHub workflows run that are not yet a Tool linked to a process (check:workflow-tools). " +
  "A ratchet: only a finding NOT listed fails, and a layer with no file is reported and not failed until it is " +
  "seeded. The fix for a finding is a Tool node in the tools graph of the layer that owns " +
  "the script, whose `satisfies` names a skill a BPMN task names (or which declares `subprocesses`), never a new " +
  "line here. Keyed by finding and script, never by workflow or line. Refresh with --write-baseline <layer dir>.";

if (import.meta.main) {
  const all = workflowFiles(ROOT);
  const files = all.filter((f) => gateOwnsFile(f) !== false);
  if (all.length === 0) {
    console.error("? could not determine: no .github/workflows/ or .github/actions/ in this checkout");
    process.exit(2);
  }
  const discovery = discoverTools(ROOT);
  for (const f of discovery.failures) console.log(`  ! tools graph ${f.dir ?? f.instance}: ${f.reason}`);
  const reach = toolReach(discovery.tools, ROOT);
  const bySkill = skillProcesses(ROOT);
  const list = process.argv.includes("--list");
  const wi = process.argv.indexOf("--write-baseline");
  const write = wi >= 0;
  const seed = new Set(write ? process.argv.slice(wi + 1).filter((a) => !a.startsWith("--")).map((a) => a.replace(/\/+$/, "") || ".") : []);
  let written = 0;

  // Judged per layer: a script two layers' workflows run is a finding of each.
  const byLayer = new Map<string, string[]>();
  for (const f of files) {
    const l = layerOf(f, ROOT);
    byLayer.set(l, [...(byLayer.get(l) ?? []), f]);
  }

  let bad = false;
  let total = 0;
  let linked = 0;
  for (const [dir, own] of [...byLayer].sort(([a], [b]) => a.localeCompare(b))) {
    const layer = layerName(own[0]!, ROOT);
    const { findings, ok, subjects, qc } = assess(invocations(ROOT, own), reach, discovery.tools, bySkill);
    total += subjects.size;
    linked += ok.length;
    const keys = new Set(findings.map(baselineKey));
    const known = readBaseline(dir, ROOT)?.findings;
    console.log(
      `${layer}: ${own.length} workflow/action file(s), ${qc} QC check(s) exempt, ${subjects.size} producing script(s), ` +
        `${ok.length} a Tool linked to a process, ${findings.length} not yet` +
        (known === undefined ? " — not yet ratcheted, reported only" : ""),
    );
    if (list) {
      for (const o of ok) console.log(`  ✓ ${o.subject}  ← ${o.tools.join(", ")}  [${o.processes.join(", ")}]`);
      for (const f of findings) {
        console.log(`  · ${baselineKey(f)}${f.tools.length ? `  ← ${f.tools.join(", ")}` : ""}  (${f.workflows.join(", ")})`);
      }
    }
    if (write) {
      if (known !== undefined || seed.has(dir)) {
        const p = baselinePath(dir, ROOT);
        writeFileSync(p, JSON.stringify({ _comment: COMMENT, findings: [...keys].sort() }, null, 2) + "\n");
        console.log(`  ✓ baseline written: ${relative(ROOT, p)} (${keys.size})`);
        written++;
      }
      continue;
    }
    if (known === undefined) continue;
    const knownSet = new Set(known);
    for (const f of findings) {
      if (knownSet.has(baselineKey(f))) continue;
      bad = true;
      const where = f.workflows.join(", ");
      if (f.kind === "no-tool") {
        console.log(`  ✗ NEW ${f.subject} is run by ${where} and no Tool reaches it.`);
        console.log("      Add a Tool node to the tools graph of the layer that owns it (invoke.shell naming the file or");
        console.log("      its key), so `bun run cat` and the MCP server can reach it, and link it to a process.");
      } else if (f.kind === "no-process") {
        console.log(`  ✗ NEW ${f.subject} is run by ${where}; its Tool(s) ${f.tools.join(", ")} are linked to no process.`);
        console.log("      Make a Tool `satisfies` a skill a BPMN task names, or give it `subprocesses`.");
      } else {
        console.log(`  ✗ NEW ${f.subject} is run by ${where} and resolves to no file or declared script key.`);
      }
    }
    // A fixed entry is reported, not failed: the Tool that fixes it often lands
    // in another layer, and a checkout pinned before or after that layer would
    // otherwise go red on a baseline line it cannot change.
    for (const k of known) if (!keys.has(k)) console.log(`  · ${layer}: fixed, drop from the baseline: ${k}`);
  }

  if (write) {
    console.log(`  ✓ ${written} baseline(s) written`);
    process.exit(0);
  }
  if (byLayer.size === 0) {
    console.log(`✓ check:workflow-tools: none of the ${all.length} workflow file(s) is the caller's own; the root's own CI judges them.`);
    process.exit(0);
  }
  if (bad) process.exit(1);
  console.log(`  ✓ no new finding (${total} script(s) run, ${linked} a Tool linked to a process)`);
}
