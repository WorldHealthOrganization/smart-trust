/**
 * The memory tools an agent is offered: `memory_note`, `memory_checkpoint`
 * and `memory_recall` (cat-harness#991 proposal §4.14, steps 16 and 20).
 *
 * Their own Tool group, registered apart from the `workflow_*` tools, so a run
 * can offer memory to an agent told nothing about processes or the work plan
 * (owner, 2026-11-03: *"would an agent still see it through the dependency
 * tree … in that case it needs to be own tool"*). Everything the agent reads
 * — names, descriptions, inputs, answers — is neutral: no layer, item,
 * store, process or role.
 *
 * Behind them (*"in reality a bean with metadata wrapped in the backend, just
 * not exposed to agent"*; Q17, layered): the memory store's `keep` and
 * `recall`, through the deployment's work-context store. The run's launcher
 * binds the session:
 *
 * - {@link WORK_INSTANCE_ENV}: the layer the agent works in. Its item is
 *   the agent's own memory of the work, and the backend fills each entry's
 *   process, step and layer.
 * - {@link SHARED_SPACE_ENV}: a memory record a group of agents shares (a
 *   swarm, §4.14). `shared: true` reads and writes it.
 * - {@link AGENT_ID_ENV}: who the agent is, for the entries it keeps.
 *
 * A note is a hand-over another agent reads later, so it passes the same
 * screen as `workflow_complete`'s note: an instruction in it is kept as data,
 * marked, never obeyed.
 *
 * @module folio-assistant/tools/memory
 */
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MemoryEntry, MemoryEntryKind } from "../../schemas/kg/memory-record.ts";
import { oneLineLabel, screenHandover } from "../core/handover-screen.js";
import { loadProcessModel } from "../workflow/process-model.js";
import { loadInstance } from "../workflow/store.js";
import { workContextFrom } from "../workflow/work-context.js";
import { workPlanStoreFor } from "../workflow/work-plan-store-select.js";
import type { MemoryStore } from "../workflow/work-plan-store.js";

/** The layer a launcher bound this session to. */
export const WORK_INSTANCE_ENV = "CAT_WORK_INSTANCE";
/** The shared memory record a launcher opened for a group of agents. */
export const SHARED_SPACE_ENV = "CAT_MEMORY_SHARED";
/** Who this agent is, for the entries it keeps. */
export const AGENT_ID_ENV = "CAT_AGENT_ID";

const NOTE_MAX = 4000;
const RECALL_MAX = 50;

export interface MemoryToolEnv {
  env?: Readonly<Record<string, string | undefined>>;
}

type Env = Readonly<Record<string, string | undefined>>;

/** Where this session's memory is, or the neutral reason it has none. */
async function bound(
  root: string,
  env: Env,
  shared: boolean,
): Promise<{ store: MemoryStore; record: string; meta: Pick<MemoryEntry, "process" | "step" | "instance"> } | { not: string }> {
  let store: MemoryStore;
  try {
    const target = workContextFrom(workPlanStoreFor(root, env), env);
    if ("none" in target) return { not: "this session has no memory" };
    store = target.store;
  } catch {
    return { not: "memory could not be reached" };
  }
  if (shared) {
    const record = env[SHARED_SPACE_ENV]?.trim();
    return record ? { store, record, meta: {} } : { not: "this session has no shared memory" };
  }
  const instance = env[WORK_INSTANCE_ENV]?.trim();
  if (!instance) return { not: "this session is not bound to a piece of work" };
  const state = loadInstance(root, instance);
  if (!state?.bean) return { not: "the work this session was bound to is not found" };
  const model = await loadProcessModel(resolve(root, state.source));
  const step = state.tokens.length === 1 ? state.tokens[0] : undefined;
  return { store, record: state.bean, meta: { process: model.id, instance: state.id, ...(step ? { step } : {}) } };
}

/** The note as it may be kept: screened, one line, capped — the cap said. */
function screened(note: string): string {
  const screen = screenHandover({ note }, { fields: { note: "data" } });
  const seen = typeof screen.screened?.note === "string" ? screen.screened.note : note;
  const folded = oneLineLabel(seen, Number.MAX_SAFE_INTEGER);
  const capped = folded.length <= NOTE_MAX ? folded : `${folded.slice(0, NOTE_MAX)} [… cut: ${folded.length - NOTE_MAX} more characters not kept]`;
  return screen.state === "quarantined"
    ? `[QUARANTINED by the hand-over screen: ${[...new Set(screen.findings.map((f) => f.kind))].join(", ")}; kept, data not instruction] ${capped}`
    : capped;
}

/** `memory_note` and `memory_checkpoint`: keep one entry. Answers only whether it was kept. */
export async function memoryKeep(
  repoRoot: string,
  { note, shared = false }: { note: string; shared?: boolean },
  kind: Extract<MemoryEntryKind, "note" | "checkpoint">,
  opts?: MemoryToolEnv,
): Promise<string> {
  const root = resolve(repoRoot);
  // input-site: env CAT_WORK_INSTANCE #f4c974e2 — the layer, shared space and agent the run's launcher bound this session to
  const env = opts?.env ?? process.env;
  const b = await bound(root, env, shared);
  if ("not" in b) return `Not kept: ${b.not}.`;
  // input-site: inert #a3e3d49c — the moment an entry is kept; a write, never a check's input
  const at = new Date().toISOString();
  const r = b.store.keep(b.record, { at, by: env[AGENT_ID_ENV]?.trim() || "agent", kind, text: screened(note), ...b.meta });
  return r.state === "kept" ? "Kept." : "Not kept: the note could not be stored.";
}

const SAID: Record<MemoryEntryKind, string> = {
  note: "note",
  checkpoint: "where it stood",
  "taken-up": "started",
  "step-done": "done",
  closed: "finished",
};

/** `memory_recall`: what was kept, newest last, in neutral words. */
export async function memoryRecall(repoRoot: string, { shared = false }: { shared?: boolean }, opts?: MemoryToolEnv): Promise<string> {
  const root = resolve(repoRoot);
  // input-site: env CAT_WORK_INSTANCE #f4c974e2 — the layer and shared space the run's launcher bound this session to
  const env = opts?.env ?? process.env;
  const b = await bound(root, env, shared);
  if ("not" in b) return `Nothing to recall: ${b.not}.`;
  const r = b.store.recall(b.record);
  if (r.state !== "hit") return "Nothing to recall: the memory could not be read.";
  const entries = r.record.entries.slice(-RECALL_MAX);
  if (!entries.length) return "Nothing has been kept yet.";
  const skipped = r.record.entries.length - entries.length;
  return [
    ...(skipped ? [`(${skipped} earlier entries not shown)`] : []),
    ...entries.map((e) => `- ${e.at} · ${e.by} · ${SAID[e.kind]}${e.text ? `: ${e.text}` : ""}`),
  ].join("\n");
}

export function registerMemoryTools(server: McpServer, repoRoot: string, opts?: MemoryToolEnv): void {
  const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
  const shared = z
    .boolean()
    .optional()
    .describe("true: the memory you share with the other agents working with you. Default: your own memory of this work.");
  server.tool(
    "memory_note",
    "Keep a short note on the work you are doing — what you did, what you decided and why, and what is left open — " +
      "so it is there when this work is picked up again, by you or by someone else.",
    { note: z.string().describe("The note, in plain words. One paragraph is plenty."), shared },
    async (args) => text(await memoryKeep(repoRoot, args, "note", opts)),
  );
  server.tool(
    "memory_checkpoint",
    "Before you stop or hand over, keep where the work stands: what is done, what is next, and anything the next " +
      "person must know to carry on.",
    { note: z.string().describe("Where the work stands, in plain words."), shared },
    async (args) => text(await memoryKeep(repoRoot, args, "checkpoint", opts)),
  );
  server.tool(
    "memory_recall",
    "Read what has been kept about this work so far, oldest first, so you can start where the last person stopped.",
    { shared },
    async (args) => text(await memoryRecall(repoRoot, args, opts)),
  );
}
