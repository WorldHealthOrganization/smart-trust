/**
 * `owner/name` — a forge repository's full name, in its own module so a
 * declaration schema can use it without importing the Tool type table
 * (`tool-types.ts` imports `cat-harness.ts`, which would make the cycle).
 *
 * @module schemas/repo-full-name
 * @graphNode schema
 */
import { z } from "zod";

/**
 * A forge repository's full name, `owner/name`.
 *
 * Its own type rather than `Text` because a Tool takes it on the command line
 * (`folio-review-comments --repo`, bean `423d`), and `Text` is deliberately
 * not admissible there. Each half is the character set GitHub allows in an
 * owner and a repository name, which contains no shell metacharacter, and
 * `..` is refused, so it can never climb a path it is joined into.
 */
export const RepoFullNameSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/, "a repository is `owner/name`")
  .refine((r) => !r.includes(".."), "a repository name may not contain `..`")
  .describe("A forge repository's full name, owner/name");

export type RepoFullName = z.infer<typeof RepoFullNameSchema>;
