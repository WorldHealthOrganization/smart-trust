/**
 * The two kinds of site build: `preview` and `full`.
 *
 * @module scripts/lib/build-type
 * @graphNode none — one environment switch and its reader
 *
 * ## The ruling (owner, 2026-11-01)
 *
 * *"preview" = no reindex, only changes, and "full".* A public comment (PC)
 * build is a full build, and so is a release.
 *
 * | build type | used for | what it builds |
 * |---|---|---|
 * | `preview` | a pull request's `branches/<slug>/` preview | only what the change can reach (the cone); every whole-corpus index (`builtAtPublish` entries marked `index: true`, and the search index) is main's copy, put back rather than rebuilt |
 * | `full` | the main site deploy, a public comment release, a release | everything, every index rebuilt from this tree |
 *
 * A preview exists so a reviewer can see a change. An index (search, LSI,
 * SQLite slices, the handler index) is computed over the whole corpus, so
 * rebuilding it shows the reviewer almost nothing and costs minutes. A frozen
 * release is different: it is cited for years, so every index in it must be
 * built from the tree it freezes. That is why `pc-release.ts freeze` refuses a
 * copy whose `staging.json` says `buildType: "preview"`.
 *
 * ## Any doubt builds full
 *
 * The switch is the environment variable {@link BUILD_TYPE_ENV}. Unset means
 * `full`: a build that forgot to say what it is gets every index, which costs
 * minutes, rather than a stale index, which misleads. A value that is neither
 * word is refused, because a typo that silently built `full` would hide that
 * the preview never got faster.
 */

/** The environment variable that names the build type. */
export const BUILD_TYPE_ENV = "CAT_BUILD_TYPE";

export const BUILD_TYPES = ["preview", "full"] as const;
export type BuildType = (typeof BUILD_TYPES)[number];

/** What the environment asks for, and why; `refused` when it names neither type. */
export function buildTypeOf(env: Readonly<Record<string, string | undefined>>): { type: BuildType; why: string } | { refused: string } {
  const raw = env[BUILD_TYPE_ENV]?.trim() ?? "";
  if (raw === "") return { type: "full", why: `${BUILD_TYPE_ENV} is not set, so every index is built` };
  if ((BUILD_TYPES as readonly string[]).includes(raw)) return { type: raw as BuildType, why: `${BUILD_TYPE_ENV}=${raw}` };
  return { refused: `${BUILD_TYPE_ENV} is "preview" or "full", not ${JSON.stringify(raw)}` };
}

/** Whether a writer is an index a preview borrows: every entry it writes is marked `index: true`. */
export function isIndexWriter(writer: string, plan: readonly { writer: readonly string[]; index?: boolean }[]): boolean {
  const mine = plan.filter((a) => a.writer.includes(writer));
  return mine.length > 0 && mine.every((a) => a.index === true);
}
