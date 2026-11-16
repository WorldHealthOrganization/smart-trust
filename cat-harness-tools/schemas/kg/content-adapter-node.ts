/**
 * A content adapter's block VOCABULARY as a KG node: `folio-content-adapter/v1`,
 * one JSON file per adapter in a `content-adapters/` graph the owning harness
 * declares.
 *
 * The vocabulary — the `adapter` every block-kind node names — is a node; the
 * server adapter CLASS is not. The two do not line up: `document` has a class
 * (`DocumentContentAdapter`) and no vocabulary of its own, its kinds being
 * `paper` kinds whose profile is `document`; `dak` has a vocabulary and no
 * class. So the classes stay as `contentAdapters` data in each
 * `<instance>.json`, and the vocabulary is read from these nodes.
 *
 * A LEAF: Zod only, so `block-kinds.ts` and `block-qa.ts` can parse with it.
 *
 * @graphNode schema
 * @module cat-harness/schemas/content-adapter-node
 */
import { z } from "zod";

/**
 * The companion files a block can have, one role per sibling format. Declared
 * in this leaf, and re-exported by `block-qa.ts` where it is documented, so a
 * content-adapter node's `companionRoles` is checked against the same list.
 */
export const COMPANION_ROLES = [
  "md",
  "ts",
  "lean",
  "bpmn",
  "dmn",
  "xlsx",
  "fsh",
  "cql",
  "feature",
] as const;

export const CONTENT_ADAPTER_NODE_SCHEMA = "folio-content-adapter/v1" as const;

export const ContentAdapterNodeSchema = z
  .object({
    $schema: z.literal(CONTENT_ADAPTER_NODE_SCHEMA),
    /**
     * The vocabulary's name — the same field, and the same value, as a
     * block-kind node's `adapter`. Deliberately NOT `name`: a `<stem>.json`
     * whose `name` equals its stem is a layer DECLARATION to
     * `findDeclarationFile`, so `paper.json` with `name: "paper"` made
     * `content-adapters/` a layer and collapsed sci's sibling scope.
     */
    adapter: z.string().regex(/^[a-z][a-z0-9-]*$/),
    /**
     * Whether cat-harness's CODE types this vocabulary's blocks (`BlockSchema`
     * in `schemas/types.ts`). A typed vocabulary's kinds are the platform's
     * own and may not be redefined by a contributor; an untyped one reaches a
     * folio only through its dependency tree. `check:kind-validators` holds
     * the typed set to the `ContentAdapter` type the code asserts.
     */
    typed: z.boolean(),
    /** Which companion roles this vocabulary's blocks can have. */
    companionRoles: z.array(z.enum(COMPANION_ROLES)).min(1),
    /**
     * The vocabulary's own module, `path.ts`, relative to the declaring
     * layer: the code that defines its blocks. For a TYPED vocabulary it
     * exports the kinds' schemas (`blockSchemas`), and may export
     * `constraintRules` and `builders` — the contract and its loader are
     * `vocabulary-modules.ts`. So a layer above cat-harness types its own kinds,
     * and a composition that does not mount it neither discovers nor types them.
     */
    vocabulary: z.string().regex(/^(?![a-z][a-z0-9-]*:)(?!\/)(?!\.\.)[^#\s]+\.ts$/).optional(),
    rationale: z.string().optional(),
  })
  .strict();

export type ContentAdapterNode = z.infer<typeof ContentAdapterNodeSchema>;
