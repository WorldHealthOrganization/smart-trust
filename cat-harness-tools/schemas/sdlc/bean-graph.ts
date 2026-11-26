/**
 * The bean graph — what `beans/` is, rather than where it happens to be.
 *
 * `beans/` is a **graph** with named nodes, each node a store with its own
 * kind and path:
 *
 * ```jsonc
 *  // beans/beans.json
 * {
 *   "name": "folio-assistant",
 *   "nodes": [
 *     { "id": "defs",      "path": "defs",      "kinds": ["bean-defs"] },
 *     { "id": "workflows", "path": "workflows", "kinds": ["workflow-state"] }
 *   ]
 * }
 * ```
 *
 * The graph states the layout; the harness config does not restate it. The
 * path is also written in `.beans.yml`, because the third-party `beans`
 * binary reads only that; that duplication stays checked.
 *
 * ## Paths are relative to the graph root
 *
 * A node's `path` is resolved against the directory holding `beans.json`, not
 * against the repo root, so moving `beans/` to `work/` requires editing
 * nothing inside it. A path escaping its own root (`..`, or absolute) is
 * rejected: a folio must not scan a directory its graph does not own.
 *
 * ## Three states
 *
 * - **Absent** → `undefined`. An unmigrated repo falls back to the documented
 *   defaults; this is ordinary, not an error.
 * - **Present but unreadable** → **throws**, rather than leave every consumer
 *   guessing where the work plan is.
 * - **Unknown node kind** → rejected, not accepted and ignored. A node whose
 *   kind nothing understands is a store nothing will read.
 *
 * ## It defers to `cat-harness.ts`
 *
 * A bean-graph entry IS a {@link ContentDirectory}: an id, a path, and the
 * graph typologies found there (`BASE_GRAPH_TYPOLOGIES`). Same schema, same
 * open registry, same JSON-LD projection. Only what is SPECIFIC to the bean
 * graph is here: paths resolve against this file's own directory rather than
 * the layer root, and at most one directory may hold `workflow-state`.
 *
 * @module schemas/bean-graph
 * @graphNode schema
 */

import { z } from "zod";

import { nodeKind } from "../kg/node-kind";
import { MemoryRecordCoreKind } from "../kg/memory-record.ts";
import {
  GraphNodeDirectorySchema,
  defaultGraphTypologies,
  type GraphNodeDirectory,
  type GraphTypologyRegistry,
} from "../kg/cat-harness";

/**
 * The kinds of store a bean-graph node can be.
 *
 * `bean-defs` holds the work-plan items themselves — one markdown file per
 * bean, the store the `beans` CLI reads. `workflow-state` holds one JSON file
 * per running BPMN process instance.
 *
 * They are separate kinds because they answer different questions and are
 * written by different things: the definitions say WHAT is being worked on and
 * are authored by agents and people; the workflow state says WHERE A PROCESS
 * GOT TO and is written by the workflow engine. Collapsing them into one store
 * was considered in `docs/proposals/workflow-state-in-beans.md` and rejected
 * (Option A: two stores, one link).
 */
/**
 * The graph typologies a bean graph's directories hold.
 *
 * Both are registered in {@link BASE_GRAPH_TYPOLOGIES}, not defined here — the
 * vocabulary is shared with `harness.json`, so a consumer that knows
 * one declaration knows the other. This constant is a convenience for callers
 * that want the bean-specific subset, never a second source of truth.
 */
export const BEAN_NODE_KINDS = ["bean-defs", "bean-notes", "workflow-state", "sweep-marks"] as const;
export type BeanNodeKind = (typeof BEAN_NODE_KINDS)[number];

/**
 * A bean-graph directory — the shared {@link ContentDirectorySchema}, reused
 * rather than redeclared.
 *
 * `graphs` is an array for the reason it is one there: a directory is a PLACE
 * TO LOOK and may hold more than one part of the graph. It does not say how to
 * tell the contents apart, deliberately — **the files declare what they are.**
 * A bean carries its id, `title`, `status` and `type` in front matter; a
 * workflow instance carries `"$schema": "folio-workflow-instance/v1"`.
 */
export const BeanGraphNodeSchema = GraphNodeDirectorySchema;

export type BeanGraphNode = GraphNodeDirectory;

export const BeanGraphSchema = z.object({
  /** Display name — which layer's work plan this is. */
  name: z.string().min(1),
  /** Named `directories`, like the harness declaration, not `nodes`. */
  directories: z.array(BeanGraphNodeSchema).min(1),
});

export type BeanGraph = z.infer<typeof BeanGraphSchema>;

/**
 * Targets schema for bean front matter.
 *
 * Supports array of strings (e.g. `targets: ["sec:foo", "thm:bar"]`),
 * flow sequence or single scalar coerced to array.
 */
export const BeanTargetsSchema = z
  .union([
    z.array(z.string()),
    z.string().transform((s) => (s.trim().length > 0 ? [s.trim()] : [])),
  ])
  .optional();

/**
 * Schema for front matter of a bean definition file (`beans/defs/*.md`).
 *
 * Beans are authored by people and agents and managed by the `beans` CLI.
 * Unknown keys are allowed via `.passthrough()` so that new fields from `beans`
 * do not break parsing.
 *
 * Supports standard bean fields plus `issue` linking external GitHub issue tracker,
 * and `targets?: string[]`, representing target block labels or declaration
 * identifiers for work traceability (folio-assistant-f227).
 */
export const BeanFrontMatterSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    status: z.string().optional(),
    type: z.string().optional(),
    priority: z.string().optional(),
    parent: z.string().optional(),
    blocking: z.array(z.string()).optional(),
    blocked_by: z.array(z.string()).optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    tags: z.array(z.string()).optional(),
    /**
     * GitHub issue number or reference (e.g. 730, "#730", or issue URL).
     * Queryable field linking a bean to its external human adjudication/tracking issue.
     */
    issue: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
    targets: BeanTargetsSchema,
  })
  .passthrough();

export type BeanFrontMatter = z.infer<typeof BeanFrontMatterSchema>;

/**
 * A bean, as a node kind: `$schema: bean/1.0.0` in its front matter.
 *
 * Bean `ujiv` (issue #88), owner 2026-10-06: a file that cannot keep a tag on
 * its own is TAGGED. A bean is such a file — `beans update` rewrites the front
 * matter and drops every key it does not know, `$schema` included (measured
 * 2026-10-06 on a scratch store). So the tag is restored rather than trusted:
 * `bun run beans:retag` writes it back, the session-start and pre-commit hooks
 * run that, and a gate fails on a bean that is still missing it.
 *
 * Built on {@link BeanFrontMatterSchema}'s shape rather than a second list of
 * the same fields: the CLI's vocabulary is defined once.
 *
 * Named `BeanKind`, not `BeanNodeKind`: that name is already the type of a
 * NODE in the bean graph (`bean-defs`, `notes`, …) above, and one export name
 * for two things made `schemas/sdlc/bean-graph.ts#BeanNodeKind` resolve to the type
 * in the schema index and to this value in `validators/bean-node.json`.
 */
export const BeanKind = nodeKind("bean/1.0.0", [MemoryRecordCoreKind], beanOwnFields(), {
  term: "Work item",
  summary:
    "One piece of work an agent or a person takes up: a memory record with a status, a type, a priority, a parent and what it blocks, kept in the work plan. Its file is the one the `beans` CLI reads, which is why the kind is named `bean`.",
});

/**
 * The bean's own fields: the front matter minus the memory record's shared
 * core, which the bean inherits (cat-harness#991 §4.14, Q17 — a bean is a
 * memory record with more structure). The set of fields is unchanged.
 */
function beanOwnFields() {
  const { id: _i, title: _t, tags: _g, created_at: _c, updated_at: _u, ...own } = BeanFrontMatterSchema.shape;
  return own;
}

/** The `$schema` tag every bean carries in its front matter. */
export const BEAN_SCHEMA_TAG = "bean/1.0.0";

/**
 * The graph file's name inside its root directory.
 *
 * DERIVED from the `beans` kind rather than written here, so the name exists
 * once. Both spellings were correct and they disagreed about what happens on a
 * move: this module holds that relocating `beans/` to `work/` must rename
 * nothing inside it, while `declaredKinds` computed `${basename(path)}.json`
 * and would have gone looking for `work/work.json`. Same fact, two places, and
 * the drift only appears when somebody relocates — so nothing would have
 * caught it.
 *
 * The owner's rule, 2026-09-20: **each type declares its own filename.** The
 * kind is the type here, so the kind is where it is declared.
 *
 * The `??` is unreachable while the kind carries the field and is not a
 * default: a registry that has lost the kind has bigger problems than this
 * filename, and falling back to the literal keeps the reader oriented rather
 * than crashing in a constant initialiser.
 */
export const BEAN_GRAPH_FILE = defaultGraphTypologies.get("beans")?.declarationFile ?? "beans.json";

/** Where the graph root sits, when a repo has not moved it. */
export const DEFAULT_BEAN_GRAPH_ROOT = "beans";

/**
 * The layout a repo gets when it carries no graph file.
 *
 * Documented rather than implied, so the absent case is a known answer instead
 * of scattered string literals.
 */
export const DEFAULT_BEAN_GRAPH: BeanGraph = {
  name: "default",
  directories: [
    { id: "defs", path: "defs", graphTypologies: ["bean-defs"] },
    { id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] },
  ],
};

/**
 * A node `path` must stay inside the graph root.
 *
 * Checked on parse rather than at use: a consumer that resolves the path is
 * already committed to reading it, and by then the escape has happened.
 */
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
 * Parse a bean graph, rejecting what must not be accepted quietly.
 *
 * Throws on malformed input — see the module docstring for why "present but
 * unreadable" is a hard failure rather than a fallback to defaults.
 */
export function parseBeanGraph(
  raw: unknown,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): BeanGraph {
  const graph = BeanGraphSchema.parse(raw);

  const seen = new Set<string>();
  for (const node of graph.directories) {
    // Kind validation lives here rather than in the Zod shape for the reason
    // `readDeclaration` gives: the vocabulary is OPEN, so the valid set is
    // whatever has been registered by the time the graph is read, not what
    // existed at module load. Reusing `ContentDirectorySchema` brought the
    // shape but not this check, and a test caught the gap — an unknown kind
    // was being accepted and ignored, which is the failure mode this schema's
    // own docstring forbids.
    for (const g of node.graphTypologies) {
      if (!registry.has(g)) {
        throw new Error(
          `bean graph: directory "${node.id}" declares unknown graph typology "${g}". ` +
            `Known kinds: ${registry.names().join(", ")}.`,
        );
      }
    }

    if (seen.has(node.id)) {
      throw new Error(
        `bean graph: duplicate node id "${node.id}". Ids are what overrides and ` +
          `references match on, so two nodes sharing one make the graph ambiguous.`,
      );
    }
    seen.add(node.id);

    if (pathEscapesRoot(node.path)) {
      throw new Error(
        `bean graph: node "${node.id}" has path "${node.path}", which is absolute ` +
          `or escapes the graph root. A store outside the graph is not a node of it.`,
      );
    }
  }

  // Not a uniqueness rule in general — a graph may one day hold several
  // definition stores — but exactly one workflow-state node is what every
  // consumer today assumes, and an unnoticed second would split the state.
  const stateNodes = graph.directories.filter((n) => n.graphTypologies.includes("workflow-state"));
  if (stateNodes.length > 1) {
    throw new Error(
      `bean graph: ${stateNodes.length} workflow-state nodes ` +
        `(${stateNodes.map((n) => n.id).join(", ")}). Process state would be split ` +
        `across them with nothing saying which is authoritative.`,
    );
  }

  return graph;
}

/**
 * The first node declaring `kind`, or undefined when the graph declares none.
 *
 * "First" rather than "the": a kind may appear on several nodes now that
 * `kinds` is an array. Only `workflow-state` is constrained to one node (see
 * {@link parseBeanGraph}), because splitting process state is a correctness
 * problem rather than a layout choice.
 */
export function nodeOfKind(graph: BeanGraph, kind: BeanNodeKind): BeanGraphNode | undefined {
  return graph.directories.find((n) => n.graphTypologies.includes(kind));
}


/* ── The milestone rollup ─────────────────────────────────────────────────
   Here rather than beside the projection that publishes it
   (`site-indexes.ts`), because that file is the content core's and
   `scripts/milestone-rollup.ts` — the only implementation — is `cat-harness`.
   Core may import harness; harness may not import core. Putting the schema on
   the core side made `check:partition` report a wrong-direction edge, which is
   how this landed here. A milestone rollup is a bean-store concept anyway, so
   this file was the right home by subject as well as by layer. */

/** A non-negative whole number of beans. */
const Count = z.number().int().nonnegative();

/**
 * One milestone, rolled up over the closure of beans beneath it.
 *
 * Declared HERE and the TypeScript types are inferred from it
 * (`scripts/milestone-rollup.ts` imports them), so the projection's schema and
 * the function that produces it cannot drift. A hand-written interface beside
 * a Zod object is two declarations of one shape, and `.strict()` only catches
 * the drift in one direction.
 */
export const MilestoneRollupSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    /** Repository-relative path of the milestone's bean file. */
    file: z.string().min(1),
    /** The milestone's OWN status — not derived from its subtree. */
    status: z.string(),
    /** Direct children typed `epic`. */
    epics: Count,
    /** Transitive descendants, excluding the milestone itself. */
    total: Count,
    closed: Count,
    open: Count,
    inProgress: Count,
    todo: Count,
    draft: Count,
    /** In neither status set — reported alone, folded into neither figure. */
    unclassified: Count,
    /** `closed / (closed + open)`; `null` when nothing is classified, which is
     *  NOT the same as 0 — see the module note on `milestone-rollup.ts`. */
    share: z.number().min(0).max(1).nullable(),
  })
  .strict();

/** The milestone rollup as a whole, plus what the per-milestone shares omit. */
export const MilestonePlanSchema = z
  .object({
    milestones: z.array(MilestoneRollupSchema),
    /** Open beans with no milestone anywhere above them. */
    orphanOpen: Count,
    openTotal: Count,
    /** SUMMED from the closures, never `openTotal - orphanOpen`. */
    coveredOpen: Count,
    /** Bean ids held by more than one file. A store defect, reported. */
    duplicateIds: Count,
  })
  .strict();
