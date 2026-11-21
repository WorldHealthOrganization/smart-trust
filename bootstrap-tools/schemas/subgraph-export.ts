/**
 * The files a NAMED SUBGRAPH publishes, as `scripts/subgraph-jsonld.ts` writes
 * them: `index.jsonld` (each direct member a pointer, each child subgraph an
 * IRI) and `index.hydrated.jsonld` (every node of the transitive membership
 * inline, child subgraphs nested).
 *
 * @module bootstrap-tools/schemas/subgraph-export
 *
 * The keys are the ones a consumer that already reads named subgraphs reads:
 * `@id`, `@type`, `name`, `path`, `title`, `description`, `holdsGraph`,
 * `hasMember`, `hasSubgraph`, and nothing else on a subgraph node — strict,
 * because a reader validating strictly would reject any extra key, and an
 * extra key here is a new term nobody asked for. A member is open: it is the
 * graph's own node, whatever standard properties apply to it.
 *
 * `@context` is a URL, never an inline object: every file names the one
 * shared context, published beside them.
 *
 * Not published as a JSON Schema: `gen-bootstrap-schemas.ts` publishes the
 * documents it lists, and this is not one of them.
 */
import { z } from "zod";

/** `<BASE_URL>subgraph/`, `<BASE_URL>subgraph/<HARNESS>/` or `<BASE_URL>subgraph/<HARNESS>/<PATH>/` — always a directory. */
export const SubgraphIriSchema = z
  .string()
  .url()
  .regex(/\/subgraph\/(?:[^/]+\/(?:.+\/)?)?$/, "a subgraph IRI is <BASE_URL>subgraph/[<HARNESS>/[<PATH>/]], ending in /");

const SubgraphNodeBase = z.object({
  "@id": SubgraphIriSchema,
  "@type": z.literal("bootstrap:Subgraph"),
  /** The repository's or harness's name at the two top levels; the layer-relative path below them. */
  name: z.string().min(1),
  /** Layer-relative, ending in `/`; `./` at the two top levels. */
  path: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  /** The graph typologies it holds, as bootstrap's graph-typology individuals. */
  holdsGraph: z.array(z.string().regex(/^bootstrap:graphTypology\/[a-z][a-z0-9-]*$/)).optional(),
});

/** A member as the index carries it: enough to find it, type it and label it. */
export const SubgraphPointerSchema = z
  .object({
    "@id": z.string().url(),
    "@type": z.string().regex(/^bootstrap:[A-Z][A-Za-z]*$/),
    name: z.string().optional(),
    title: z.string().optional(),
  })
  .strict();

/** A member as the hydrated file carries it: the whole node. */
export const SubgraphMemberSchema = z
  .object({
    "@id": z.string().url(),
    "@type": z.string().regex(/^bootstrap:[A-Z][A-Za-z]*$/),
  })
  .passthrough();

export const SubgraphIndexSchema = SubgraphNodeBase.extend({
  "@context": z.string().url(),
  hasMember: z.array(SubgraphPointerSchema).optional(),
  hasSubgraph: z.array(SubgraphIriSchema).optional(),
}).strict();
export type SubgraphIndex = z.infer<typeof SubgraphIndexSchema>;

export type SubgraphHydratedNode = z.infer<typeof SubgraphNodeBase> & {
  hasMember?: z.infer<typeof SubgraphMemberSchema>[];
  hasSubgraph?: SubgraphHydratedNode[];
};

export const SubgraphHydratedNodeSchema: z.ZodType<SubgraphHydratedNode> = z.lazy(() =>
  SubgraphNodeBase.extend({
    hasMember: z.array(SubgraphMemberSchema).optional(),
    hasSubgraph: z.array(SubgraphHydratedNodeSchema).optional(),
  }).strict(),
);

export const SubgraphHydratedSchema = SubgraphNodeBase.extend({
  "@context": z.string().url(),
  hasMember: z.array(SubgraphMemberSchema).optional(),
  hasSubgraph: z.array(SubgraphHydratedNodeSchema).optional(),
}).strict();
export type SubgraphHydrated = z.infer<typeof SubgraphHydratedSchema>;
