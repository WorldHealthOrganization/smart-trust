/**
 * A TODO — one human actor's work state, as a knowledge-graph node.
 *
 * @module schemas/todo
 *
 * ## What a todo is
 *
 * A todo records that a **person** has something outstanding. It is not the
 * agent work plan (`beans/`); it belongs to the content-review feedback
 * workflow, and it is **content**, authored and owned by the folio, not by the
 * harness.
 *
 * ## It carries the four coordinates of the role model
 *
 * > **An actor performs a task in a process as a role, using that role's skills.**
 *
 * A todo is tagged by the same four things: who ({@link ExternalIdentity}),
 * acting as what ({@link TodoTags.roles}), in which process
 * ({@link TodoTags.processes}), on which task ({@link TodoTags.tasks}).
 *
 * ## A task reference carries its process
 *
 * A BPMN activity id is unique only **within** its process — `A_Implement`
 * names one thing in `crdm-requirements` and could name another anywhere else.
 * So {@link TaskRef} is a pair, never a bare string.
 *
 * ## An identity is provider-qualified
 *
 * `litlfred` is not an identity; `github:litlfred` is. A bare handle cannot be
 * compared across systems, and two providers' namespaces are free to collide.
 *
 * The link to a declared {@link ActorDefinition} is **optional**: somebody who
 * comments on a pull request has a real outstanding item whether or not
 * `cat-harness/scenarios/actors/` declares them. `actor: undefined` means
 * **not linked**, a third state — never "anonymous", and never silently
 * resolved to a default actor.
 * @graphNode schema
 */

import { z } from "zod";

import { nodeKind } from "../kg/node-kind.js";
import { ThemedKind } from "../ui/theme.js";
import {
  CarriedNoteKind,
  NoteTagsSchema,
  type NoteTags,
} from "../kg/carried-note.js";

/**
 * The reference vocabulary now lives in `schemas/kg/carried-note.ts`, shared with
 * agent memory — see that module for why a todo and a memory entry are the
 * same thing with different storage. Re-exported here so every existing
 * importer of `schemas/todo` keeps working: the types did not change, only
 * where they are defined.
 */
export {
  TaskRefSchema,
  ExternalIdentitySchema,
  KgRefSchema,
  ArtefactRefSchema,
  ARTEFACT_KINDS,
} from "../kg/carried-note.js";
export type { TaskRef, ExternalIdentity, KgRef, ArtefactRef } from "../kg/carried-note.js";

/**
 * The knowledge-graph edges a todo carries.
 *
 * Now {@link NoteTagsSchema}, shared with memory and widened with `artefacts`
 * — issues, pull requests and commits, which are neither graph nodes nor
 * people and so had nowhere to go before.
 */
export const TodoTagsSchema = NoteTagsSchema;
export type TodoTags = NoteTags;

/** How a tag came out when checked against the knowledge graph. */
export type TagResolution = "resolved" | "dangling" | "not-checked";

export interface ResolvedTag {
  /** Which axis — `role`, `process`, `task`, `actor`. */
  axis: "role" | "process" | "task" | "actor";
  /** The reference as written, e.g. `crdm-requirements▸A_Implement`. */
  ref: string;
  state: TagResolution;
}

/**
 * What the knowledge graph currently declares, for checking tags against.
 *
 * Each field is optional, and **absent means "could not be read"** — not
 * "empty". That distinction is the whole point: a shallow checkout with no
 * `skills/` must report every role tag as `not-checked`, never as dangling. A
 * wall of false dangling findings is how a check gets switched off.
 */
export interface KgIndex {
  roles?: ReadonlySet<string>;
  processes?: ReadonlySet<string>;
  /** Task ids per process id. */
  tasks?: ReadonlyMap<string, ReadonlySet<string>>;
  actors?: ReadonlySet<string>;
}

/**
 * Check every tag against the graph, reporting three states per tag.
 *
 * Reports rather than throws, for the reason `kg-export` reports its dangling
 * `declaresSkill` edges rather than failing: a todo naming a role somebody
 * later renamed is a **data** defect in content a person wrote, and blocking
 * on it would hold the folio hostage to a backlog.
 */
export function resolveTodoTags(tags: TodoTags, kg: KgIndex): ResolvedTag[] {
  const out: ResolvedTag[] = [];
  const check = (
    axis: ResolvedTag["axis"],
    ref: string,
    known: ReadonlySet<string> | undefined,
  ): void => {
    out.push({
      axis,
      ref,
      state: known === undefined ? "not-checked" : known.has(ref) ? "resolved" : "dangling",
    });
  };

  for (const r of tags.roles) check("role", r, kg.roles);
  for (const p of tags.processes) check("process", p, kg.processes);

  for (const t of tags.tasks) {
    const ref = `${t.process}▸${t.task}`;
    if (kg.tasks === undefined) {
      out.push({ axis: "task", ref, state: "not-checked" });
      continue;
    }
    const within = kg.tasks.get(t.process);
    // A task in a process the index does not know is DANGLING, not
    // not-checked: the index was read, and it does not contain that process.
    out.push({ axis: "task", ref, state: within?.has(t.task) ? "resolved" : "dangling" });
  }

  for (const i of tags.identities) {
    // Only a LINKED identity is checkable. An unlinked one is not dangling —
    // see the module header: a person outside the actor registry is a real
    // person, and reporting them as a broken reference would be wrong.
    if (i.actor !== undefined) check("actor", i.actor, kg.actors);
  }

  return out;
}

/** Tags that did not resolve. Never includes `not-checked`. */
export function danglingTags(resolved: ResolvedTag[]): ResolvedTag[] {
  return resolved.filter((r) => r.state === "dangling");
}

// ── The node ────────────────────────────────────────────────────

/**
 * A todo node.
 *
 * The status/priority/origin vocabulary is NOT restated here — it is
 * `TodoStatus`, `TodoPriority` and `TodoOrigin` in `types.ts`, where the
 * existing store and the `todo-review` skill already read it. Two spellings of
 * one enum is the drift this repository keeps paying for; this module adds the
 * KG tagging that was missing and takes nothing over.
 */
/**
 * A todo — one person's outstanding work.
 *
 * Extends {@link CarriedNoteKind} (and the `themed` mixin) with the three fields that are the HUMAN
 * half specifically: a lifecycle (`status`), how urgent (`priority`) and where
 * it came from (`origin`). Agent memory has none of those — a TRAP is not
 * "open", and marking one "done" would say the failure it records has stopped
 * being possible.
 */
export const TodoNodeKind = nodeKind("todo/1.0.0", [CarriedNoteKind, ThemedKind], {
  /** `TodoStatus` from `types.ts`, not re-enumerated here. */
  status: z.string().min(1),
  /** `TodoPriority` from `types.ts`. */
  priority: z.string().min(1),
  /** `TodoOrigin` from `types.ts`. */
  origin: z.string().min(1),
  /**
   * What this file IS, declared inside it.
   *
   * The same convention the workflow instances use (`folio-workflow-instance/v1`)
   * and for the reason `#263` gave: a directory may hold more than one part of
   * a graph, and telling the parts apart by file extension is "a coincidence of
   * the current layout, not a contract". A declaration inside the file is the
   * contract.
   *
   * GENERATED by `nodeKind()` from the versioned id above (issue #2195): it
   * accepts `todo/1.x.y` up to this kind's version, so it is not spelled here.
   */
});

/**
 * The composed schema: carried note, then themed, then the todo's own fields.
 *
 * `theme` arrives from the `themed` parent rather than a spread. It was a
 * spread until bean `a1lq`, and a spread is last-writer-wins with no record
 * that two parents were composed at all. The parents are now declared, and
 * the composition is the one walk layers use.
 *
 * `theme` — the id of the theme this todo's sticky renders with — was declared
 * by `ThemedTodoFieldsSchema` all along and merged in by nothing, so it was
 * authorable in principle and dropped in practice (bean `5y4b`). Absent means
 * nobody has chosen: the todo takes the graph's `defaultTheme`, else a flat
 * card.
 */
export const TodoNodeSchema = TodoNodeKind.schema;
export type TodoNode = z.infer<typeof TodoNodeSchema>;

/** The `$schema` tag every todo file carries. */
export const TODO_SCHEMA_TAG = "todo/1.0.0";
