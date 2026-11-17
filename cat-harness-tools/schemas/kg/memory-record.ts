/**
 * **The memory record**: the base every kept memory shares, and the layer a
 * bean extends — a bean is a memory note with additional structure for
 * process, role and the like.
 *
 * | layer | kind | adds |
 * |---|---|---|
 * | the shared core | {@link MemoryRecordCoreKind} (mixin) | id, title, tags, timestamps |
 * | a memory record | {@link MemoryRecordKind} `memory-record/1.0.0` | scope, `about`, structured entries |
 * | a bean | `bean/1.0.0` (`schemas/sdlc/bean-graph.ts`) | status, type, priority, parent, blocking |
 *
 * A bean extends the core rather than `memory-record/1.0.0` itself, so the
 * bean's own file format is unchanged: its entries are the lines of its body
 * that {@link parseEntryLine} reads, and its scope is always `item`. The
 * store interface is layered the same way: `WorkPlanStore` extends
 * `MemoryStore` (`src/workflow/work-plan-store.ts`).
 *
 * The curated agent memory (the `memory` kind, "read during a process, never
 * written by one") is a different thing and stays separate.
 *
 * @module schemas/kg/memory-record
 * @graphNode schema
 */
import { z } from "zod";
import { nodeKind } from "./node-kind.ts";

/** What an entry records. `taken-up`, `step-done` and `closed` are the engine's; `note` and `checkpoint` an agent's. */
export const MEMORY_ENTRY_KINDS = ["note", "checkpoint", "taken-up", "step-done", "closed"] as const;
export type MemoryEntryKind = (typeof MEMORY_ENTRY_KINDS)[number];

/** Whose memory: one item of work, one run, or a space a group of agents shares. */
export const MEMORY_SCOPES = ["item", "run", "shared"] as const;
export type MemoryScope = (typeof MEMORY_SCOPES)[number];

/**
 * One kept entry. `process`, `step`, `instance` and `role` are filled by the
 * backend when it knows them; the agent that wrote the entry never sees them.
 */
export const MemoryEntrySchema = z
  .object({
    at: z.string().min(1),
    by: z.string().min(1),
    kind: z.enum(MEMORY_ENTRY_KINDS),
    text: z.string(),
    process: z.string().min(1).optional(),
    step: z.string().min(1).optional(),
    instance: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
  })
  .strict();
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

/** The fields every memory record and every bean share. Snake case, as the `beans` CLI writes them. */
export const MemoryRecordCoreKind = nodeKind("memory-record-core", [], {
  id: z.string().optional(),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
}, {
  term: "Memory record",
  summary:
    "What every kept memory shares: an id, a title, tags and when it was made and changed. A work item is one, with more structure; a memory record on its own adds a scope and dated entries.",
});

/** A memory record on its own, as a store that is not the work plan keeps it. */
export const MemoryRecordKind = nodeKind("memory-record/1.0.0", [MemoryRecordCoreKind], {
  scope: z.enum(MEMORY_SCOPES),
  /** What the record is about: an item, a run, a document, a block label. */
  about: z.array(z.string().min(1)).optional(),
  entries: z.array(MemoryEntrySchema).optional(),
});

// ---------------------------------------------------------------------------
// An entry as one line of a bean's body.

const LINE = /\[memory (note|checkpoint|taken-up|step-done|closed) · ([^·\]]+) · ([^·\]]+)((?: · [a-z]+=[^·\]]+)*)\](?: (.*))?$/;

const META = ["process", "step", "instance", "role"] as const;

/** One line: the entry's metadata in brackets, then its text. A text's line breaks are folded. */
export function renderEntryLine(e: MemoryEntry): string {
  const clean = (s: string): string => s.replace(/[\s·\]]+/g, " ").trim();
  const meta = META.filter((k) => e[k]).map((k) => ` · ${k}=${clean(e[k]!)}`).join("");
  const text = e.text.replace(/\s+/g, " ").trim();
  return `[memory ${e.kind} · ${clean(e.at)} · ${clean(e.by)}${meta}]${text ? ` ${text}` : ""}`;
}

/**
 * The entry a body line holds, or undefined when the line is not one. A Tool
 * may put its own stamp before the bracket (`_2026-11-03 07:00_ — [memory …`),
 * so the entry is found where it starts, not only at the line's start.
 */
export function parseEntryLine(line: string): MemoryEntry | undefined {
  const m = LINE.exec(line.trim());
  if (!m) return undefined;
  const by = m[3]!.trim();
  // A Tool whose `note` signs the line with its writer (`… (agent-1)`) adds
  // nothing the entry does not already say: the signature is not the text.
  const raw = (m[5] ?? "").trim();
  const text = raw.endsWith(` (${by})`) ? raw.slice(0, -(by.length + 3)).trimEnd() : raw === `(${by})` ? "" : raw;
  const e: MemoryEntry = { kind: m[1] as MemoryEntryKind, at: m[2]!.trim(), by, text };
  for (const part of (m[4] ?? "").split(" · ").filter(Boolean)) {
    const eq = part.indexOf("=");
    const k = part.slice(0, eq) as (typeof META)[number];
    if ((META as readonly string[]).includes(k)) e[k] = part.slice(eq + 1).trim();
  }
  return e;
}

/** Every entry in a body, in order. Other lines are the body's prose and are left alone. */
export function entriesInBody(body: string): MemoryEntry[] {
  return body.split("\n").map(parseEntryLine).filter((e): e is MemoryEntry => e !== undefined);
}
