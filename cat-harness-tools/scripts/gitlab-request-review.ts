/**
 * Ask one or more GitLab users to review a merge request, keeping the
 * reviewers it already has.
 *
 * The implementation of the `gitlab-mr-request-review` Tool.
 * `glab mr update --reviewer name` REPLACES the reviewers; `--reviewer +name`
 * adds one (glab's documented prefix). A Tool input cannot carry that prefix,
 * so this script adds it, after each name has parsed as a `GitLabUsername`.
 * `glab` is called with an argument array; no shell sees the names.
 *
 * Usage: bun run cat gitlab:request-review [<number>] <username>...
 * The number, when given, comes first. A leading all-digit word is read as
 * the number, so an all-digit username needs the number before it.
 *
 * @module scripts/gitlab-request-review
 */
import { spawnSync } from "node:child_process";
import { GitLabUsernameSchema } from "../schemas/tools/tool-types.js";

/** The `glab` argument array. Throws when no username is given or one does not parse. */
export function requestReviewArgv(args: readonly string[]): string[] {
  const rest = [...args];
  const number = rest[0] !== undefined && /^[1-9][0-9]{0,9}$/.test(rest[0]) ? rest.shift() : undefined;
  if (rest.length === 0) throw new Error("no reviewer given");
  const flags = rest.flatMap((u) => {
    const name = GitLabUsernameSchema.safeParse(u);
    if (!name.success) throw new Error(`not a GitLab username: ${JSON.stringify(u)}`);
    return ["--reviewer", `+${name.data}`];
  });
  return ["mr", "update", ...(number ? [number] : []), ...flags];
}

if (import.meta.main) {
  let argv: string[];
  try {
    argv = requestReviewArgv(process.argv.slice(2));
  } catch (e) {
    console.error(`${(e as Error).message}\nusage: bun run cat gitlab:request-review [<number>] <username>...`);
    process.exit(2);
  }
  const r = spawnSync("glab", argv, { stdio: "inherit" });
  if (r.error) {
    console.error(`could not run glab: ${r.error.message}`);
    process.exit(127);
  }
  process.exit(r.status ?? 1);
}
