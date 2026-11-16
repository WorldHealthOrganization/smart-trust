/**
 * Resolve one review thread on a GitHub pull request.
 *
 * The implementation of the `github-pr-resolve-thread` Tool. `gh` has no
 * command for this; it is the GraphQL mutation `resolveReviewThread`. That
 * mutation's text contains `$id`, which a shell expands, so a command an agent
 * types would silently send an empty id. Here `gh` is called with an argument
 * array, and no shell ever sees the query.
 *
 * The thread id is parsed by `ReviewThreadId` before anything runs, so a value
 * that could be a flag or a payload never reaches `gh`. It is passed with
 * `-f` (a raw string), not `-F`, which would turn an all-digit value into a
 * number.
 *
 * Usage: bun run cat github:resolve-thread <thread-id>
 *
 * @module scripts/github-resolve-thread
 */
import { spawnSync } from "node:child_process";
import { ReviewThreadIdSchema } from "../schemas/tools/tool-types.js";

export const RESOLVE_MUTATION = "mutation($id: ID!) { resolveReviewThread(input: { threadId: $id }) { thread { id isResolved } } }";

/** The `gh` argument array for one thread. Throws when the id does not parse. */
export function resolveThreadArgv(thread: string): string[] {
  const id = ReviewThreadIdSchema.parse(thread);
  return ["api", "graphql", "-f", `query=${RESOLVE_MUTATION}`, "-f", `id=${id}`];
}

if (import.meta.main) {
  const thread = process.argv[2];
  if (thread === undefined || process.argv.length > 3) {
    console.error("usage: bun run cat github:resolve-thread <thread-id>");
    process.exit(2);
  }
  let argv: string[];
  try {
    argv = resolveThreadArgv(thread);
  } catch {
    console.error(`not a review thread id: ${JSON.stringify(thread)}`);
    process.exit(2);
  }
  const r = spawnSync("gh", argv, { stdio: "inherit" });
  if (r.error) {
    console.error(`could not run gh: ${r.error.message}`);
    process.exit(127);
  }
  process.exit(r.status ?? 1);
}
