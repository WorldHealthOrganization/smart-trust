#!/usr/bin/env bun
/**
 * CLI surface for the BPMN workflow engine (`workflow:start`, `workflow:next`,
 * `workflow:complete`, plus `list` and `gate`).
 *
 * A session that clones a harness repository mid-session (as project threads
 * do) has no MCP server, so this is how it records and advances a process
 * instance (`cat-harness/skills/process/workflow/process-state.md`
 * §"Arriving without the sweep"). It wraps the exact same functions in
 * `src/tools/workflow.ts` that `registerWorkflowTools` registers on the MCP
 * server, so CLI and MCP calls run the same precondition gate, hand-over
 * screen, strict GitHub authorization, refusal recording, work-plan
 * operations and `beans/workflows/` store writes.
 *
 * Usage:
 *   bun run cat workflow:start <process> <subject> [--bean <id>] [--plan <epic-id>] [--root <dir>]
 *   bun run cat workflow:next <instance> [--root <dir>]
 *   bun run cat workflow:complete <instance> <node> [--outcome <branch>] [--facts <json>] [--actor <id>] [--target <id>] [--note <text> | --stdin] [--activities <json>] [--root <dir>]
 *   bun run cat-harness-tools/scripts/workflow-cli.ts scope <instance> --change-set <CS-NNN> --blocks <label,label,…> [--root <dir>]
 *
 * `scope` records which blocks a change-set (`content-change-review`) instance
 * changes. The corpus gate reads it to recognise the change-set path
 * (`src/workflow/change-set-coverage.ts`). It records no step and no sign-off.
 *
 * Each command also accepts `--json '<payload>'` (or a single JSON-object
 * positional argument) with the MCP tool's input fields.
 *
 * Exit codes:
 *   0 — succeeded
 *   1 — engine, precondition, hand-over screen or authorization refusal
 *   2 — usage or argument parse error
 *
 * @module scripts/workflow-cli
 * @covers none — a CLI runner over `src/tools/workflow.ts`, not a gate
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  workflowComplete,
  workflowGate,
  workflowList,
  workflowNext,
  workflowStart,
  type WorkflowToolEnv,
} from "../src/tools/workflow.ts";
import { declaredInstanceName, REPO_ROOT } from "./lib/roots.ts";
import { loadInstance, saveInstance } from "../src/workflow/store.ts";
import { CHANGE_REVIEW_PROCESS } from "../src/workflow/change-set-coverage.ts";

export interface WorkflowCliOptions extends WorkflowToolEnv {
  /** Working directory when `--root` is not passed; defaults to `process.cwd()`. */
  cwd?: string;
  /** Standard input text when `--stdin` is passed; defaults to reading fd 0. */
  stdin?: string;
}

export interface WorkflowCliResult {
  code: 0 | 1 | 2;
  out: string;
}

const VALUE_FLAGS = new Set([
  "--root",
  "--process",
  "--subject",
  "--bean",
  "--plan",
  "--instance",
  "--node",
  "--activity",
  "--outcome",
  "--facts",
  "--actor",
  "--target",
  "--note",
  "--activities",
  "--json",
  "--change-set",
  "--blocks",
]);

interface ParsedArgs {
  flags: Map<string, string>;
  booleans: Set<string>;
  positionals: string[];
}

function parseArgv(argv: readonly string[]): ParsedArgs {
  const flags = new Map<string, string>();
  const booleans = new Set<string>();
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--stdin" || a === "--help" || a === "-h") {
      booleans.add(a);
      continue;
    }
    const eq = a.indexOf("=");
    if (a.startsWith("--") && eq > 2) {
      const k = a.slice(0, eq);
      const v = a.slice(eq + 1);
      if (VALUE_FLAGS.has(k)) {
        flags.set(k, v);
        continue;
      }
    }
    if (VALUE_FLAGS.has(a)) {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new UsageError(`flag ${a} requires a value`);
      }
      flags.set(a, next);
      i++;
      continue;
    }
    if (a.startsWith("--")) {
      throw new UsageError(`unknown flag: ${a}`);
    }
    positionals.push(a);
  }
  return { flags, booleans, positionals };
}

class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

/**
 * Default checkout root when `--root` is not given: if `cwd` itself declares a
 * layer or an index (`index.config.json`), use `cwd`; otherwise fall back to
 * `REPO_ROOT ?? cwd`.
 */
export function defaultWorkflowRoot(cwd: string = process.cwd()): string {
  const abs = resolve(cwd);
  if (existsSync(join(abs, "index.config.json")) || declaredInstanceName(abs) !== undefined) {
    return abs;
  }
  return REPO_ROOT ?? abs;
}

function parseJsonObject(raw: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new UsageError(`invalid JSON for ${label}: ${(e as Error).message}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new UsageError(`${label} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function parseJsonArray(raw: string, label: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new UsageError(`invalid JSON for ${label}: ${(e as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new UsageError(`${label} must be a JSON array`);
  }
  return parsed;
}

function normalizeSubcommand(raw: string | undefined): "start" | "next" | "complete" | "list" | "gate" | "scope" | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/^workflow[:_]/, "");
  if (cleaned === "start" || cleaned === "next" || cleaned === "complete" || cleaned === "list" || cleaned === "gate" || cleaned === "scope") {
    return cleaned;
  }
  return undefined;
}

function usageText(): string {
  return [
    "usage:",
    "  bun run cat workflow:start <process> <subject> [--bean <bean-id>] [--plan <epic-id>] [--root <dir>] [--json <payload>]",
    "  bun run cat workflow:next <instance> [--root <dir>] [--json <payload>]",
    "  bun run cat workflow:complete <instance> <node> [--outcome <branch>] [--facts <json>] [--actor <id>] [--target <id>] [--note <text> | --stdin] [--activities <json>] [--root <dir>] [--json <payload>]",
    "  bun run cat-harness-tools/scripts/workflow-cli.ts list [--root <dir>]",
    "  bun run cat-harness-tools/scripts/workflow-cli.ts gate <instance> <activity> [--actor <id>] [--target <id>] [--root <dir>]",
    "  bun run cat-harness-tools/scripts/workflow-cli.ts scope <instance> --change-set <CS-NNN> --blocks <label,label,…> [--root <dir>]",
  ].join("\n");
}

function strField(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== "string") throw new UsageError(`field "${key}" in JSON payload must be a string`);
  return v;
}

export async function runWorkflowCli(
  argv: readonly string[],
  opts: WorkflowCliOptions = {},
): Promise<WorkflowCliResult> {
  try {
    const sub = normalizeSubcommand(argv[0]);
    if (!sub) {
      return { code: 2, out: usageText() };
    }
    const { flags, booleans, positionals } = parseArgv(argv.slice(1));
    if (booleans.has("--help") || booleans.has("-h")) {
      return { code: 0, out: usageText() };
    }

    const root = resolve(flags.get("--root") ?? defaultWorkflowRoot(opts.cwd));

    // Support `--json '<object>'` or a single `{...}` positional payload.
    let payload: Record<string, unknown> = {};
    const jsonFlag = flags.get("--json");
    if (jsonFlag !== undefined) {
      payload = parseJsonObject(jsonFlag, "--json");
    } else if (positionals.length === 1 && positionals[0]!.trim().startsWith("{")) {
      payload = parseJsonObject(positionals.shift()!, "JSON argument");
    }

    if (sub === "list") {
      return { code: 0, out: await workflowList(root) };
    }

    if (sub === "start") {
      const processName = flags.get("--process") ?? positionals[0] ?? strField(payload, "process");
      const subject = flags.get("--subject") ?? positionals[1] ?? strField(payload, "subject");
      const bean = flags.get("--bean") ?? positionals[2] ?? strField(payload, "bean");
      const plan = flags.get("--plan") ?? strField(payload, "plan");
      if (!processName || !subject) {
        throw new UsageError(
          "usage: workflow:start <process> <subject> [--bean <bean-id>] [--plan <epic-id>] [--root <dir>]",
        );
      }
      const out = await workflowStart(root, { process: processName, subject, bean, plan }, opts);
      return { code: 0, out };
    }

    if (sub === "next") {
      const instance = flags.get("--instance") ?? positionals[0] ?? strField(payload, "instance");
      if (!instance) {
        throw new UsageError("usage: workflow:next <instance> [--root <dir>]");
      }
      const out = await workflowNext(root, { instance }, opts);
      return { code: 0, out };
    }

    if (sub === "gate") {
      const instance = flags.get("--instance") ?? positionals[0] ?? strField(payload, "instance");
      const activity = flags.get("--activity") ?? flags.get("--node") ?? positionals[1] ?? strField(payload, "activity");
      const actor = flags.get("--actor") ?? strField(payload, "actor");
      const target = flags.get("--target") ?? strField(payload, "target");
      if (!instance || !activity) {
        throw new UsageError(
          "usage: workflow:gate <instance> <activity> [--actor <id>] [--target <id>] [--root <dir>]",
        );
      }
      const out = await workflowGate(root, { instance, activity, actor, target }, opts);
      return { code: 0, out };
    }

    if (sub === "scope") {
      const instance = flags.get("--instance") ?? positionals[0] ?? strField(payload, "instance");
      const changeSet = flags.get("--change-set") ?? strField(payload, "changeSet");
      const blocksRaw = flags.get("--blocks") ?? strField(payload, "blocks");
      if (!instance || !changeSet || !blocksRaw) {
        throw new UsageError(
          "usage: workflow-cli.ts scope <instance> --change-set <CS-NNN> --blocks <label,label,…> [--root <dir>]",
        );
      }
      if (!/^CS-\d{3,}$/.test(changeSet)) throw new UsageError(`--change-set must look like CS-014, got ${changeSet}`);
      const blocks = [...new Set(blocksRaw.split(",").map((b) => b.trim()).filter(Boolean))].sort();
      if (blocks.length === 0) throw new UsageError("--blocks names no block");
      const state = loadInstance(root, instance);
      if (!state) return { code: 1, out: `no workflow instance \`${instance}\`` };
      if (state.processId !== CHANGE_REVIEW_PROCESS) {
        return { code: 1, out: `${instance} is a ${state.processId} instance; only ${CHANGE_REVIEW_PROCESS} carries a change-set scope` };
      }
      if (state.status !== "running") return { code: 1, out: `${instance} is completed; a published change set's scope is fixed` };
      const p = saveInstance(root, { ...state, scope: { changeSet, blocks }, updatedAt: new Date().toISOString() });
      return { code: 0, out: `${instance}: scope ${changeSet}, ${blocks.length} block(s) → ${p}` };
    }

    // sub === "complete"
    const instance = flags.get("--instance") ?? positionals[0] ?? strField(payload, "instance");
    const node = flags.get("--node") ?? positionals[1] ?? strField(payload, "node");
    if (!instance || !node) {
      throw new UsageError(
        "usage: workflow:complete <instance> <node> [--outcome <branch>] [--facts <json>] [--actor <id>] [--target <id>] [--note <text> | --stdin] [--activities <json>] [--root <dir>]",
      );
    }
    const outcome = flags.get("--outcome") ?? strField(payload, "outcome");
    const actor = flags.get("--actor") ?? strField(payload, "actor");
    const target = flags.get("--target") ?? strField(payload, "target");

    let facts: Record<string, unknown> | undefined;
    if (flags.has("--facts")) {
      facts = parseJsonObject(flags.get("--facts")!, "--facts");
    } else if (payload.facts !== undefined) {
      if (payload.facts === null || typeof payload.facts !== "object" || Array.isArray(payload.facts)) {
        throw new UsageError('field "facts" in JSON payload must be an object');
      }
      facts = payload.facts as Record<string, unknown>;
    }

    let activities: unknown[] | undefined;
    if (flags.has("--activities")) {
      activities = parseJsonArray(flags.get("--activities")!, "--activities");
    } else if (payload.activities !== undefined) {
      if (!Array.isArray(payload.activities)) {
        throw new UsageError('field "activities" in JSON payload must be an array');
      }
      activities = payload.activities;
    }

    let note = flags.get("--note") ?? strField(payload, "note");
    if (note === undefined && booleans.has("--stdin")) {
      note = opts.stdin !== undefined ? opts.stdin : readFileSync(0, "utf-8");
    }

    const out = await workflowComplete(
      root,
      { instance, node, outcome, facts, actor, target, note, activities },
      opts,
    );
    return { code: 0, out };
  } catch (e) {
    if (e instanceof UsageError) {
      return { code: 2, out: e.message };
    }
    return { code: 1, out: e instanceof Error ? e.message : String(e) };
  }
}

if (import.meta.main) {
  const { code, out } = await runWorkflowCli(process.argv.slice(2));
  if (code === 0) {
    console.log(out);
  } else {
    console.error(out);
  }
  process.exit(code);
}
