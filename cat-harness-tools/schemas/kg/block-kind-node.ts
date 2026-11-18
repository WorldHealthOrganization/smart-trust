/**
 * A block kind as a KG node: `folio-block-kind/v1`, one JSON file per kind in
 * a `block-kinds/` graph the OWNING harness declares.
 *
 * Kinds are discoverable, not centrally managed: no module lists them, and
 * `block-kinds.ts` DISCOVERS them by scanning every layer's declared
 * `block-kinds` graph. Each per-kind fact (label prefix, RDF types, builder,
 * profile, whether a label is provable, whether the definition index lists
 * it) is a field here.
 *
 * Headings are NOT here beyond the English source string: locale headings
 * live in the translation graph.
 *
 * A LEAF: Zod only, so `block-kinds.ts` (itself a leaf every schema imports
 * at module load) can parse with it without a cycle.
 *
 * @module cat-harness/schemas/block-kind-node
 * @graphNode schema
 */
import { z } from "zod";

export const BLOCK_KIND_NODE_SCHEMA = "folio-block-kind/v1" as const;

export const BlockKindNodeSchema = z
  .object({
    $schema: z.literal(BLOCK_KIND_NODE_SCHEMA),
    /** The kind string a block's `kind` field carries. */
    kind: z.string().regex(/^[a-z][a-z0-9-]*$/),
    /** The content adapter whose vocabulary the kind is from. */
    adapter: z.string().min(1),
    /**
     * The NARROWEST content profile that admits the kind (paper-adapter kinds
     * only; a contributed adapter's kind is in no profile). Profiles nest
     * (`document` ⊂ `paper`), so `document` means both and `paper` means the
     * paper profile only — a formal mathematical claim.
     */
    profile: z.enum(["document", "paper"]).optional(),
    /** The builder function a block manifest calls. Defaults to `kind`. */
    builder: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/).optional(),
    /** The label prefix, without its colon (`def`, not `def:`). Two kinds may share one (`fig`). */
    labelPrefix: z.string().regex(/^[a-z]+$/),
    /**
     * Whether a block's label MUST start with the prefix. `false` only where
     * the label rule never applied (`prose`), so moving the table onto nodes
     * did not tighten validation of a corpus nobody re-checked.
     */
    prefixEnforced: z.boolean().default(true),
    /** Whether a label of this kind names an upstream provable, which an `algorithm` must cite. */
    provable: z.boolean().default(false),
    /** The kind's own RDF class. */
    folioType: z.string().regex(/^[a-z][a-z0-9-]*:[A-Z][A-Za-z]*$/),
    /** A DoCO co-type, only where one is unambiguously right. */
    docoType: z.string().regex(/^doco:[A-Z][A-Za-z]*$/).optional(),
    /** The English heading, singular — the translation graph's source string. Empty for a kind shown without one (`prose`). */
    heading: z.string().optional(),
    /** The English heading, plural, for an index that groups by kind. */
    headingPlural: z.string().min(1).optional(),
    /**
     * Where the definition index lists this kind's section, lowest first;
     * absent for a kind the index omits. A reading order (definitions before
     * the theorems that use them), so it is authored, not sorted.
     */
    indexRank: z.number().int().positive().optional(),
    rationale: z.string().optional(),
  })
  .strict();
// A TYPED adapter's kinds must declare profile, heading and headingPlural.
// That is checked in block-kinds.ts against the discovered typed adapters: this
// schema cannot know which adapters are typed, and naming one here
// (`adapter !== "paper"`) stopped being true when the vocabulary split (bzwk).

export type BlockKindNode = z.infer<typeof BlockKindNodeSchema>;

/** A node's builder name: the declared one, else the kind itself. */
export function builderOf(node: BlockKindNode): string {
  return node.builder ?? node.kind;
}
