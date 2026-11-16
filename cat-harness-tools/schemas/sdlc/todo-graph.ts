/**
 * The todo graph — what `todos/` is, rather than where it happens to be.
 *
 * @module schemas/todo-graph
 *
 * The same shape as `bean-graph.ts`, reusing `ContentDirectorySchema` and the
 * same open kind registry; this file carries only what is SPECIFIC to the
 * todo graph.
 *
 * ```jsonc
 *  // todos/todos.json
 * {
 *   "name": "my-folio",
 *   "directories": [
 *     { "id": "items",    "path": "items",    "graphs": ["todo-items"] },
 *     { "id": "feedback", "path": "feedback", "graphs": ["todo-feedback"] }
 *   ]
 * }
 * ```
 *
 * ## It is content, and the folio owns it
 *
 * `beans/` is the AGENT work plan and lives in every layer. `todos/`
 * records what **people** have outstanding, so it belongs to the folio — the
 * platform ships the kind and the schema and declares no directory of its
 * own, since a declared-but-absent directory would let a consumer scan
 * nothing and report a clean run.
 *
 * ## Paths resolve against the graph root
 *
 * As in the bean graph: a node's `path` is relative to the directory holding
 * `todos.json`, so the whole graph relocates by moving one folder, and a path
 * that is absolute or escapes its root is rejected.
 *
 * ## Three states
 *
 * - **Absent** → `undefined`. A folio with no todos has no graph file; this is
 *   ordinary, not an error, and not the same as an empty graph.
 * - **Present but unreadable** → **throws**. A graph nobody can parse leaves
 *   every consumer guessing.
 * - **Unknown node kind** → rejected, never accepted and ignored. A node whose
 *   kind nothing understands is a store nothing will read.
 * @graphNode schema
 */

import { z } from "zod";

import {
  GraphNodeDirectorySchema,
  defaultGraphTypologies,
  type GraphNodeDirectory,
  type GraphTypologyRegistry,
} from "../kg/cat-harness";

/**
 * The graph typologies a todo graph's directories hold.
 *
 * Registered in `BASE_GRAPH_TYPOLOGIES`, not defined here — the vocabulary is
 * shared with `harness.json`. This is a convenience for callers wanting
 * the todo-specific subset, never a second source of truth.
 */
export const TODO_NODE_KINDS = ["todo-items", "todo-feedback", "review-verdicts"] as const;
export type TodoNodeKind = (typeof TODO_NODE_KINDS)[number];

export const TodoGraphNodeSchema = GraphNodeDirectorySchema;
export type TodoGraphNode = GraphNodeDirectory;

export const TodoGraphSchema = z.object({
  /** Display name — whose todos these are. */
  name: z.string().min(1),
  /**
   * The theme a todo takes when it does not choose one — an id from `THEMES`.
   *
   * ## Why the DEFAULT is declared here rather than picked at render time
   *
   * Bean `5y4b`, and the owner's ask was *"todos need grump cat themeing based
   * on content too. used jugement"*. A theme chosen by keyword-matching a
   * summary in JavaScript is a rule nobody can see, review or override, and it
   * changes silently when somebody rewords a todo. So the theme is **data on
   * the todo**, and this is the value it falls back to.
   *
   * ## Why a DEFAULT at all, rather than requiring every todo to choose
   *
   * Because **a wrong theme is worse than no theme.** A plain card says
   * nothing; a card themed `operations` says *"this is operations work"* about
   * a todo that may be nothing of the sort. A default that is the layer's
   * own theme makes no claim — it says "this belongs to this folio" — so it is
   * safe to apply to everything, which is exactly what a clever guess is not.
   *
   * ## Why it lives on the GRAPH and not in the code
   *
   * A folio's own theme is the folio's to choose, and a literal in the
   * generator would be this repository's answer imposed on every downstream
   * layer. Absent means **no default**: a todo that chooses nothing renders
   * as a flat card, which is today's behaviour and a determined state rather
   * than a failure.
   */
  defaultTheme: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, "a theme id is lowercase kebab-case")
    .optional(),
  directories: z.array(TodoGraphNodeSchema).min(1),
});
export type TodoGraph = z.infer<typeof TodoGraphSchema>;

/**
 * The graph file's name inside its root directory.
 *
 * Derived from the `todos` kind — see {@link BEAN_GRAPH_FILE} in
 * `bean-graph.ts` for why the kind owns the name rather than this module or
 * the directory it sits in.
 */
export const TODO_GRAPH_FILE = defaultGraphTypologies.get("todos")?.declarationFile ?? "todos.json";

/** Where the graph root sits, when a folio has not moved it. */
export const DEFAULT_TODO_GRAPH_ROOT = "todos";

/**
 * The layout a folio gets from `folio_init`.
 *
 * Two nodes rather than one, because the two already exist separately and the
 * difference is real: an `items` todo is raised about anything, while a
 * `feedback` todo is typically raised against a specific block and carries the
 * submitter's identity. Same split, and the same reasoning, as `bean-defs`
 * against `workflow-state`.
 *
 * **That difference is a filing convention, not a schema distinction, and the
 * wording above used to claim otherwise.** There is one `TodoNodeSchema`, and
 * the kind is a property of the DIRECTORY a note lives in rather than of the
 * note itself. Both halves of the description are merely *available* to both
 * kinds — the block anchor (`targetLabel`, and {@link NoteAnchorSchema} since
 * 2026-09-19) and `identities[]` are declared on `CarriedNoteSchema`, which
 * `TodoNodeSchema` extends. So nothing requires a `feedback` todo to name a
 * block or a submitter, and nothing stops an `items` todo from doing both.
 *
 * Saying so matters because the old wording was read as evidence that the
 * relation was *enforced*, and then, separately, as evidence that it did not
 * exist at all — bean `5oai` opened by asserting `schemas/sdlc/todo.ts` "carries no
 * block field", having grepped that file and not the base it extends. A
 * comment that describes a convention in the voice of a constraint invites
 * both mistakes. If the distinction should be enforced, that is a refinement
 * on the node schema keyed by kind, and it does not exist today.
 */
export const DEFAULT_TODO_GRAPH: TodoGraph = {
  name: "default",
  directories: [
    { id: "items", path: "items", graphTypologies: ["todo-items"] },
    { id: "feedback", path: "feedback", graphTypologies: ["todo-feedback"] },
  ],
};

/** A node `path` must stay inside the graph root. */
function pathEscapesRoot(p: string): boolean {
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) return true;
  const parts = p.split(/[\\/]+/).filter((s) => s.length > 0 && s !== ".");
  let depth = 0;
  for (const seg of parts) {
    if (seg === "..") depth--;
    else depth++;
    if (depth < 0) return true;
  }
  return depth <= 0;
}

/**
 * Parse a todo graph, rejecting what must not be accepted quietly.
 *
 * Kind validation lives here rather than in the Zod shape for the reason
 * `readDeclaration` gives: the vocabulary is OPEN, so the valid set is
 * whatever has been registered by the time the graph is read, not what existed
 * at module load. Reusing `ContentDirectorySchema` brings the shape and not
 * this check — a gap a test caught on the bean graph, where an unknown kind
 * was being accepted and ignored.
 */
export function parseTodoGraph(
  raw: unknown,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): TodoGraph {
  const graph = TodoGraphSchema.parse(raw);

  const seen = new Set<string>();
  for (const node of graph.directories) {
    for (const g of node.graphTypologies) {
      if (!registry.has(g)) {
        throw new Error(
          `todo graph: directory "${node.id}" declares unknown graph typology "${g}". ` +
            `Known kinds: ${registry.names().join(", ")}.`,
        );
      }
    }

    if (seen.has(node.id)) {
      throw new Error(
        `todo graph: duplicate node id "${node.id}". Ids are what overrides and ` +
          `references match on, so two nodes sharing one make the graph ambiguous.`,
      );
    }
    seen.add(node.id);

    if (pathEscapesRoot(node.path)) {
      throw new Error(
        `todo graph: node "${node.id}" has path "${node.path}", which is absolute ` +
          `or escapes the graph root. A store outside the graph is not a node of it.`,
      );
    }
  }

  return graph;
}

/**
 * The first node declaring `kind`, or undefined when the graph declares none.
 *
 * Unlike the bean graph's `workflow-state`, NEITHER todo kind is constrained
 * to a single node: a folio may legitimately keep one feedback store per paper,
 * and there is no shared mutable state for a second store to split.
 */
export function nodeOfKind(graph: TodoGraph, kind: TodoNodeKind): TodoGraphNode | undefined {
  return graph.directories.find((n) => n.graphTypologies.includes(kind));
}
