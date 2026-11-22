/**
 * A BEAN NOTE — one pull request's addendum to a bean, in a file of its own.
 *
 * Appending to one bean from several pull requests conflicts on every merge,
 * and the merge-main bot refuses a bean conflict (`beans: refuse` in
 * `merge-conflict-patterns.ts`). A note is a file of its own, so two pull
 * requests adding notes touch two different paths and git merges them with
 * nothing to resolve.
 *
 * ## The naming rule
 *
 * ```
 * <bean-id>--<YYYY-MM-DD>--<branch slug>.md
 * ```
 *
 * The **branch** is the key that makes two writers disjoint: one branch is one
 * pull request's head, so two open pull requests never share it. It is also
 * known at the FIRST commit, which a pull request number is not — open the
 * pull request after that commit, not before it. The date prefix sorts a
 * bean's notes in the order they were started.
 *
 * One branch writes one file per bean. A second note from the same branch is a
 * new section in the same file, found by its front matter (`bean` + `branch`)
 * rather than recomputed from today's date — so a branch that runs over
 * midnight does not split its notes.
 *
 * ## The file declares what it is
 *
 * Front matter carries `$schema: folio-bean-note/v1`, the bean, the branch and
 * the date the note was started. A file in the notes directory that does not
 * carry the tag is a finding, never silently skipped, and the check recomputes
 * each file's name from its own front matter: a name that does not match is a
 * finding.
 *
 * @module cat-harness/schemas/bean-note
 * @graphNode schema
 */
import { z } from "zod";

/** The tag every note carries, so the file declares what it is. */
export const BEAN_NOTE_TAG = "folio-bean-note/v1";

/** `folio-assistant-ob3m` — the prefix the `beans` CLI mints, then a short id. */
const BeanId = z.string().regex(/^[a-z0-9][a-z0-9-]*-[a-z0-9]{4}$/, "a bean id, e.g. folio-assistant-ob3m");

/** A calendar date, UTC, as the note's start. */
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "a YYYY-MM-DD date");

export const BeanNoteFrontMatterSchema = z
  .object({
    $schema: z.literal(BEAN_NOTE_TAG),
    /** The bean this note adds to. It must exist in the bean store. */
    bean: BeanId,
    /** The branch that wrote it — the key that keeps two writers apart. */
    branch: z.string().min(1),
    /** When this branch started its note on this bean (UTC). */
    created: IsoDate,
  })
  .strict();

export type BeanNoteFrontMatter = z.infer<typeof BeanNoteFrontMatterSchema>;

/**
 * A branch name as a file-name segment: `/` and anything outside
 * `[A-Za-z0-9._-]` become `-`.
 *
 * Not injective — `a/b` and `a-b` meet — and that is accepted rather than
 * hidden: the writer refuses to append to a note whose front matter names a
 * different branch, so a meeting is an error at write time, never a silent
 * merge of two branches' notes into one file.
 */
export function branchSlug(branch: string): string {
  const slug = branch.replace(/[^A-Za-z0-9._-]/g, "-").replace(/^[.-]+/, "");
  if (!slug) throw new Error(`branch "${branch}" has no characters usable in a file name`);
  return slug;
}

/** The one name a note may have — see the module docblock for why. */
export function noteFileName(bean: string, created: string, branch: string): string {
  return `${bean}--${created}--${branchSlug(branch)}.md`;
}
