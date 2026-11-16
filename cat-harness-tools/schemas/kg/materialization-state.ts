/**
 * The materialization STATE vocabulary — whether the bytes are here, and how
 * a held copy proves it is unchanged.
 *
 * @module schemas/materialization-state
 * @graphNode schema
 *
 * ## Only the vocabulary lives in the harness
 *
 * The three states and {@link FixitySchema} are here because harness modules
 * speak them (`schemas/library/referenced-source.ts`, `cat-harness.ts`,
 * `binary-release.ts`). The rest — the five gates (size, restrictions,
 * retention, source loss, copyright), the purposes, and the record that binds
 * them — stays in the content core's `schemas/materialization.ts`, because
 * each gate is a decision a person makes about CONTENT, asked in
 * `sample-import.bpmn`. Core re-exports these names.
 *
 * ## Three states
 *
 *   - **`referenced`** — the node exists, we know where, we hold no bytes.
 *   - **`materialized`** — the bytes are here.
 *   - **`unknown`** — we have not established which.
 *
 * Collapsing `unknown` into `referenced` reports a clean scan over content
 * nobody looked for. Collapsing `referenced` into `materialized` is worse:
 * `corpus-grep` searches `library/` only, so a referenced node reads as
 * ABSENT.
 *
 * There is deliberately **no default**. A node that does not declare its state
 * is invalid, not `unknown`.
 *
 * ## A remote-KG subscription is a materialization
 *
 * Subscribing to an external knowledge graph (`kg-subscribe`,
 * `subscribe-kg.bpmn`, the `kg-subscription` skill) is a materialization
 * whose MINIMUM is the chosen subgraphs' METADATA, held under
 * `library/<source>/`. The chosen subgraphs are `materialized` as metadata;
 * everything else the remote declares is `referenced`; a subgraph whose
 * declaration could not be read is `unknown`. Taking more than the metadata
 * is an ordinary materialization of those nodes, with core's five gates. No
 * subscription feature reads this yet.
 */
import { z } from "zod";

/**
 * Whether the bytes are here.
 *
 * Ordered weakest-to-strongest deliberately: a reader scanning the union sees
 * that `unknown` is not a kind of `referenced`.
 */
export const MATERIALIZATION_STATES = ["unknown", "referenced", "materialized"] as const;
export type MaterializationState = (typeof MATERIALIZATION_STATES)[number];

/**
 * Proof that an archived blob is the blob that was archived.
 *
 * Required on anything `archival`. An archive that cannot demonstrate it is
 * unchanged is a copy, and the distinction is the whole point of the purpose:
 * a working copy may be re-fetched if it rots, an archival one cannot, because
 * the thing it would be re-fetched from is what it exists to survive.
 */
export const FixitySchema = z
  .object({
    algorithm: z.literal("sha256"),
    digest: z.string().regex(/^[0-9a-f]{64}$/, "a sha256 digest is 64 lowercase hex characters"),
    /** When the digest was last RE-COMPUTED against the bytes, not when it was recorded. An unverified digest ages. */
    verifiedAt: z.string().min(1).optional(),
  })
  .strict();
export type Fixity = z.infer<typeof FixitySchema>;
