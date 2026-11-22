/**
 * Contributions as KG nodes: a harness's QA checkers and pipeline-plugin
 * implementations, each a node in a graph of its own.
 *
 * One graph per contribution type, and a folio sees the nodes of the
 * layers it depends on. `loadContributions` registers them through the
 * same `orderedDependencies` walk it finds `contributes` modules by.
 *
 * ## What a node names, and what it does not
 *
 * The DATA is the node: which criterion a checker answers, which slot a plugin
 * fills. The CODE is referenced as `path#Export`, relative to the CONTRIBUTING
 * layer's root, and the export is a TABLE keyed by the node's `criterion`
 * or `slot`, so `tsc` checks every entry against the contract it fills
 * (`PipelinePlugins`, the checker signature). The node says the entry exists,
 * discoverable without loading code.
 *
 * A contribution's code is its OWN: an `instance:` prefix is refused. A slot
 * whose implementation lives in a lower layer is wrapped by a module in the
 * contributing layer, as the science layer's `plugin-slots.ts` does.
 *
 * A LEAF: Zod only.
 *
 * @module cat-harness/schemas/contribution-nodes
 * @graphNode schema
 */
import { z } from "zod";

/** `path#Export`, instance-relative, no `..`, no `instance:` prefix. */
export const OwnCodeRefSchema = z
  .string()
  .regex(/^(?![a-z][a-z0-9-]*:)(?!\/)(?!\.\.)[^#\s]+\.ts#[A-Za-z_$][\w$]*$/, {
    message: "a contribution's code ref is `path.ts#Export`, relative to the contributing instance's own root",
  });

export const QA_CHECKER_NODE_SCHEMA = "folio-qa-checker/v1" as const;

export const QaCheckerNodeSchema = z
  .object({
    $schema: z.literal(QA_CHECKER_NODE_SCHEMA),
    /** The QA criterion this checker answers; the key into the table `check` names. */
    criterion: z.string().regex(/^[a-z][a-z0-9-]*$/),
    /** The dispatch table holding the checker. Its path is the `sourceFile` freshness is hashed over. */
    check: OwnCodeRefSchema,
    rationale: z.string().optional(),
  })
  .strict();

export type QaCheckerNode = z.infer<typeof QaCheckerNodeSchema>;

export const PIPELINE_PLUGIN_NODE_SCHEMA = "folio-pipeline-plugin/v1" as const;

export const PipelinePluginNodeSchema = z
  .object({
    $schema: z.literal(PIPELINE_PLUGIN_NODE_SCHEMA),
    /** The generic pipeline slot this fills (`pipeline/pipeline-plugins.ts`); the key into the table. */
    slot: z.string().regex(/^[a-z][a-z0-9-]*$/),
    /** The table of slot implementations, typed against the slots' contract. */
    implementation: OwnCodeRefSchema,
    rationale: z.string().optional(),
  })
  .strict();

export type PipelinePluginNode = z.infer<typeof PipelinePluginNodeSchema>;

/** Split an own-code ref into its path and export. */
export function splitOwnCodeRef(ref: string): { path: string; exportName: string } {
  const i = ref.indexOf("#");
  return { path: ref.slice(0, i), exportName: ref.slice(i + 1) };
}
