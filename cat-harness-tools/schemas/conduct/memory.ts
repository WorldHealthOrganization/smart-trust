/**
 * An agent's memory — what it carries into the next task, as a graph node.
 *
 * @module schemas/memory
 *
 * The agent half of the memory column. See `schemas/kg/carried-note.ts` for the
 * shared base and for why a todo and a memory entry are the same thing wearing
 * different storage.
 *
 * ## The file an agent reads is GENERATED, not this
 *
 * `memory: project` is a Claude Code **harness** feature: it injects the first
 * 200 lines of `.claude/agent-memory/<agent>/MEMORY.md` into a subagent's
 * system prompt. That path is fixed by the harness. Entries are authored here,
 * scoped, and **assembled** into the file the harness reads, as
 * `docs/reference/skill-instructions/` is to `skills/`.
 *
 * ## Scoped by role, not by agent
 *
 * Memory is knowledge, and `AGENTS.md` puts knowledge with the lane (role),
 * not the actor. Agent-scoping duplicates a fact two agents both need into two
 * files that drift. {@link memoryForRoles} selects the entries for a set of
 * roles.
 *
 * ## `BASELINE` must carry its provenance
 *
 * A BASELINE is a measured number, stored with the command that produced it
 * and the date, never quoted as a current answer. {@link MemoryNodeSchema}
 * **refuses a `baseline` entry without `measured`**.
 *
 * @graphNode schema
 */

import { z } from "zod";

import { CarriedNoteSchema } from "../kg/carried-note.js";

/**
 * What kind of thing this entry is. The three labels agent memories already
 * use as `## LABEL — heading`, lifted into a field so they can be filtered
 * rather than grepped.
 */
export const MEMORY_LABELS = ["stable", "trap", "baseline"] as const;
export type MemoryLabel = (typeof MEMORY_LABELS)[number];

/**
 * How a number was arrived at.
 *
 * Required on a `baseline`, because a measurement without its command and date
 * cannot be re-run and cannot be aged — which is the whole content of the
 * "never quote it as a current answer" rule.
 */
export const MeasurementSchema = z.object({
  /** The exact command, runnable as written. */
  command: z.string().min(1),
  /** ISO 8601 date the measurement was taken. */
  date: z.string().min(1),
  /** What it produced — the number, or the summary line. */
  result: z.string().min(1),
});
export type Measurement = z.infer<typeof MeasurementSchema>;

/**
 * One memory entry.
 *
 * Carries no `status`, and that is deliberate — see the base module. A TRAP is
 * not "open", and marking one "done" would assert that the failure it records
 * has stopped being possible.
 */
export const MemoryNodeSchema = CarriedNoteSchema.extend({
  /** STABLE, TRAP or BASELINE. */
  label: z.enum(MEMORY_LABELS),
  /**
   * Provenance for a measured number. **Required when `label` is `baseline`**,
   * enforced by the refinement below rather than by the type, so the error
   * names the rule instead of a missing field.
   */
  measured: MeasurementSchema.optional(),
  /**
   * Retained as a graph node, injected into no agent's file.
   *
   * **The third state between "reaches everybody" and "deleted".** An untagged
   * entry reaches every agent; an entry tagged with an agent that no longer
   * exists reaches nobody *by accident*, which is indistinguishable from a
   * typo. This says so on purpose.
   *
   * It exists because retiring a subagent would otherwise force a choice
   * between destroying knowledge and blowing the injection budget. Measured
   * when `content-pipeline-navigator` was retired, 2026-09-19: nine of its
   * twelve entries reached it and nothing else, two of them TRAPs written by
   * *other* sessions, and the only remaining agent with a related subject was
   * already at 189 of its 200 lines — so there was nowhere to put them and
   * deleting them would have thrown away work somebody else had paid for.
   *
   * Same discipline as a `scrapped` bean, which `AGENTS.md` keeps rather than
   * deletes so the next agent does not re-enter a dead end: the record of what
   * was learned survives the mechanism that carried it. An archived entry is
   * still found by grep, still readable, still a node of the graph — it simply
   * is not in anybody's prompt.
   */
  archived: z.boolean().optional(),
  /**
   * The part of this entry that is NOT injected — written beside `MEMORY.md`
   * and pointed at, for the agent to read on demand.
   *
   * ## Why the schema needs this rather than "write shorter entries"
   *
   * The harness injects the FIRST 200 lines of `MEMORY.md`, and `AGENTS.md`
   * prescribes the remedy — *"split detail into sibling files the agent reads
   * on demand"* — but there was no mechanism, so the only lever was brevity.
   * Brevity runs out: measured 2026-09-19, `content-pipeline-navigator` held
   * twelve entries ending at line 199, one line under the cut. It FIT, and it
   * could not accept a thirteenth. Adding four pushed two existing entries
   * past the cut, where the harness drops them silently.
   *
   * That is the trap worth naming: a file at capacity punishes the NEXT
   * writer, not the one who filled it, and the failure is invisible — the
   * agent simply behaves as though the entry was never recorded, which is the
   * whole premise of having memory.
   *
   * ## What belongs here rather than in `comment`
   *
   * `comment` is the TRIGGER: what goes wrong, in the fewest words that let an
   * agent recognise the situation. `detail` is the evidence — the measurement,
   * the worked example, the enumeration of paths. An agent that recognises the
   * trigger can go and read it; one that does not was never going to be helped
   * by having it inlined.
   *
   * Omitted means the entry is short enough to carry its own evidence.
   */
  detail: z.string().optional(),
  /**
   * What this file IS, declared inside it.
   *
   * The same convention the workflow instances and todos use, and for the
   * reason #263 gave: a directory may hold more than one part of a graph, and
   * telling the parts apart by file extension is "a coincidence of the current
   * layout, not a contract". A declaration inside the file is the contract.
   */
  $schema: z.literal("folio-memory/v1"),
}).refine((m) => m.label !== "baseline" || m.measured !== undefined, {
  message:
    "a `baseline` entry must carry `measured` — the command, the date and the result. " +
    "A number without its provenance cannot be re-run or aged, which is what makes it " +
    "quotable as a current answer when it is not one.",
  path: ["measured"],
});
export type MemoryNode = z.infer<typeof MemoryNodeSchema>;

/** The `$schema` tag every memory file carries. */
export const MEMORY_SCHEMA_TAG = "folio-memory/v1";

/**
 * Overlay a dependency chain's memory into what one agent should be handed.
 *
 * `entries` arrive **in dependency order — least specific first**, the way
 * every other context setting in this layer composes: a dependency's
 * entries, then the layer's own, so the nearer one wins.
 *
 * ## The composition hazard, stated because the role model already paid for it
 *
 * `AGENTS.md` records that roles compose **two** ways and they are not the
 * same: `inherits` is static IS-A, while the subprocess stack is scoped to a
 * call path — and merging them *"would give every role every caller's skills,
 * and a closure that broad cannot fail an audit."*
 *
 * This is the dependency axis, which is the `inherits`-like one: it is a
 * property of the instance graph, not of where an agent happens to be
 * standing. **Scoped, call-path overlay is a different question and is
 * deliberately not answered here** — answering both with one function is how
 * the role model's mistake would be made a second time, one layer up.
 *
 * Overriding is **by `id`**, not by summary or by subject. Two entries about
 * the same thing with different ids are two entries, and silently merging them
 * would be a guess about authorial intent.
 */
export function overlayMemory(entries: readonly MemoryNode[][]): MemoryNode[] {
  const byId = new Map<string, MemoryNode>();
  for (const layer of entries) {
    for (const entry of layer) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

/**
 * The entries an agent taking these roles should be handed.
 *
 * An entry with **no** role tag is instance-wide and goes to everybody: that is
 * how a fact like "could not determine is a third state" reaches every agent
 * without being copied into each one's file, which is the duplication this
 * module exists to end.
 */
export function memoryForRoles(entries: readonly MemoryNode[], roles: readonly string[]): MemoryNode[] {
  const wanted = new Set(roles);
  return entries.filter((e) => e.tags.roles.length === 0 || e.tags.roles.some((r) => wanted.has(r)));
}

/**
 * The entries an agent should be handed, by the agent it is.
 *
 * The **transitional** axis, and named as such so it is not mistaken for the
 * answer. Memory is bound to the agent today; the argument in this module's
 * header is that it should be bound to the ROLE, because memory is knowledge
 * and `AGENTS.md` puts knowledge in the lane. That move needs the three
 * memory-carrying subagents to be declared actors with roles, and **none of
 * them is declared at all** — measured 2026-09-19 against
 * `cat-harness/scenarios/actors/`, which holds 24 participants and not one of them.
 *
 * So this exists to make the duplication *expressible* before the role
 * question is settled: an entry references the agents it reaches, and **one
 * entry may reference several**. That is the whole difference from the
 * directory-per-agent layout it replaces — there, a fact two agents need had
 * to be written twice, and five subject areas were.
 *
 * An entry referencing no agent reaches every agent, the same rule
 * {@link memoryForRoles} applies to an untagged entry. Absent is instance-wide,
 * never "belongs to nobody".
 */
export function memoryForAgent(entries: readonly MemoryNode[], agent: string): MemoryNode[] {
  return entries.filter((e) => {
    // Archived first, and before the untagged rule: an archived entry carries
    // no agent tag once its agent is gone, so checking it second would let the
    // "untagged reaches everybody" clause hand it to every agent — the exact
    // opposite of what archiving means.
    if (e.archived) return false;
    const agents = e.tags.references.filter((r) => r.kind === AGENT_REF_KIND);
    return agents.length === 0 || agents.some((r) => r.id === agent);
  });
}

/**
 * The `kind` a {@link KgRef} uses to name a subagent.
 *
 * A subagent is an **actor**, not a role and not a skill, so it is referenced
 * rather than tagged: `tags.roles` means "outstanding in that lane" and an
 * agent is not a lane. Spelled once here so the extractor, the generator and
 * the scoping function cannot disagree about it — the `gh-pages-deploy`
 * lesson, where a second name for one concurrency group serialised against
 * nothing.
 */
export const AGENT_REF_KIND = "agent";
