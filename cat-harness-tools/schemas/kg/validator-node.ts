/**
 * A VALIDATOR as a node of the knowledge graph. **The validator names the
 * family it validates**, so the harness that writes the code declares what it
 * checks, and a kind lists only its `$schema` families.
 *
 * Declared in a `validators/` graph of the harness whose code it references.
 * The registry joins each node onto the kind it names: a kind's family with no
 * validator of its own takes the node's `schema`. A node naming a kind or a
 * family the kind does not list is refused, and so is a second answer for a
 * family that already has one.
 *
 * `id`, not `name`: a JSON file whose `name` equals its stem is how
 * `findDeclarationFile` recognises a LAYER declaration.
 *
 * A LEAF: Zod only.
 *
 * @module cat-harness/schemas/validator-node
 * @graphNode schema
 */
import { z } from "zod";

export const VALIDATOR_NODE_TAG = "folio-validator/v1" as const;

export const ValidatorNodeSchema = z
  .object({
    $schema: z.literal(VALIDATOR_NODE_TAG),
    /** This validator's own name, as its file is named. */
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, "a lower-case id, e.g. ig-ast-manifest"),
    /** What it validates: a graph typology, and the `$schema` family within it when the kind has several. */
    validates: z
      .object({
        kind: z.string().min(1),
        family: z.string().min(1).optional(),
      })
      .strict(),
    /** The Zod export, `<harness>:<path>#<Export>` (or instance-relative `<path>#<Export>`). */
    schema: z.string().regex(/#[A-Za-z_$][\w$]*$/, "a reference ending in #Export"),
    /**
     * The kind's own page renderer, `<harness>:<path>#<Export>`, when the
     * generic pages built from its schema are not enough (issue #2195: *"Generic
     * + override"*). The export is a `KindPages` (`scripts/gen-node-kind-pages.ts`).
     * Declared here, beside the schema, so the harness whose code knows the kind
     * is the one that says how to show it.
     */
    pages: z.string().regex(/#[A-Za-z_$][\w$]*$/, "a reference ending in #Export").optional(),
    /** Why this validator is the one, when that is not obvious from the code. */
    rationale: z.string().min(1).optional(),
  })
  .strict();
export type ValidatorNode = z.infer<typeof ValidatorNodeSchema>;
