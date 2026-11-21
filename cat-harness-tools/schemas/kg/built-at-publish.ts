/**
 * Artefacts a layer must NOT commit, because no commit of it can hold them
 * current: they are built when the site is published, and only then.
 *
 * @module schemas/built-at-publish
 * @graphNode none — a declaration shape and two pure readers over it
 *
 * ## The rule
 *
 * An artefact may be committed in a layer only if every input it is
 * computed from is its OWN TREE. Three ways to fail it, and
 * {@link BuiltAtPublishSchema} names which one each entry fails:
 *
 * - `checkout` — computed over every layer the checkout stacks on this one.
 *   Those are ABOVE it (they `need` it), so it cannot pin them, and the bytes
 *   are a function of the consuming index's lock, not of this commit.
 * - `lower` — computed from a layer BELOW it (one it `needs`) or from the
 *   tools that generate it. Only the top-level lock decides which commits of
 *   those a composition mounts (owner, 2026-11-13, "3y 1y"); the layer's own
 *   lock records only what it was last tested with. So the bytes are a function
 *   of the consuming index's lock, as for `checkout`, and a committed copy goes
 *   stale on every re-pin below. Until 2026-11-13 the rule allowed these, on the
 *   premise that the layer's own lock pinned its lower layers.
 *
 *   EXCEPT what a reader of the repository on GitHub needs (owner,
 *   2026-11-13: "i still want the agents.md and skills.md generated … and
 *   readme.mds … those are needed in the github repo"): `README.md`,
 *   `AGENTS.md` and the skill listings in them stay generated AND committed,
 *   with their drift gates and post-merge regen, even where a section reads a
 *   lower layer. Write those sections from the layer's own tree where possible
 *   so a re-pin moves them as little as it can.
 * - `state` — computed from a graph kept on a branch (`beans`, `todos`, `qa`),
 *   which moves without a commit (`check:derived-from`'s storage clock,
 *   for artefacts that are not a declared directory).
 *
 * ## A list in the declaration, not only `.gitignore`
 *
 * `.gitignore` says "never committed" but not who builds the file. The
 * declaration names the WRITER (a package script, run as
 * `bun run cat <script>` — a script NAME, because the generators live in a layer
 * above this one), so the publish step can run it and a gate can refuse an
 * entry nobody builds. `built-at-publish.test.ts` keeps the two equal: every
 * declared path is ignored, and nothing declared is tracked.
 *
 * ## Writer order
 *
 * `derive:publish` runs every layer's writers lowest layer first
 * (dependency order), each layer's entries in their declared order, a
 * writer named twice running once, at its first mention. A writer that reads
 * another layer's publish-time output declares it (`reads`, the kinds of
 * directory it reads) and is ordered AFTER that writer. `derive:publish`
 * sorts by those edges and refuses a cycle.
 */
import { z } from "zod";

/** Why an artefact cannot be current in a commit of the layer that serves it. */
export const BuiltAtPublishCauseSchema = z.enum(["checkout", "lower", "state"]);
export type BuiltAtPublishCause = z.infer<typeof BuiltAtPublishCauseSchema>;

/** A path relative to the layer root: a file, or a directory ending in `/`. No `..`, no leading `/`. */
const InstancePath = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith("/") && !p.split("/").includes(".."), "an instance-relative path, with no leading / and no ..")
  .refine((p) => !/[*?[\]]/.test(p), "a literal path, not a glob: a glob cannot be checked against what a writer produced");

export const BuiltAtPublishSchema = z
  .object({
    /** Instance-relative; a directory ends in `/`. */
    path: InstancePath,
    /** Package scripts that write it, in order — run as `bun run cat <script>`. */
    writer: z
      .array(z.string().regex(/^[A-Za-z0-9:_-]+$/, "a package script name"))
      .min(1)
      .refine((ws) => new Set(ws).size === ws.length, "writer names a script twice"),
    /** Which half of the rule it fails. */
    because: BuiltAtPublishCauseSchema,
    /** `state` only: the declared directory ids of the branch-kept graphs it is computed from. */
    from: z.array(z.string().min(1)).min(1).optional(),
    /** The declared directory id this path fills, when it is one (so presence checks do not expect it on disk). */
    directory: z.string().min(1).optional(),
    /**
     * The graph typologies (directory kinds) whose directories, in OTHER
     * layers, this entry's writers read: the declared READ EDGE that orders
     * them (see "Writer order" above). `derive:publish` runs these writers after
     * the writers of every other layer's entry that fills (`directory`) a
     * directory of one of these kinds. Kinds, never layer names: a lower
     * layer reading what the layers above it build cannot name them.
     */
    reads: z
      .array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "a graph typology name"))
      .min(1)
      .refine((ks) => new Set(ks).size === ks.length, "reads names a kind twice")
      .optional(),
    /** One sentence a reviewer can check: what makes it pin- or state-dependent. */
    reason: z.string().min(1),
    /**
     * A whole-corpus INDEX (search, LSI, SQLite slices, a handler index), not a
     * page a reviewer reads. A `preview` build puts back main's copy instead of
     * running its writer; a `full` build (main, public comment, release)
     * always runs it (owner, 2026-11-01: "preview" = no reindex, only
     * changes). A writer is borrowed only when EVERY entry it writes says so,
     * so marking one of a writer's pages does not skip the others.
     * `cat-harness-tools/scripts/lib/build-type.ts`.
     */
    index: z.literal(true).optional(),
  })
  .strict()
  .superRefine((e, ctx) => {
    if (e.because === "state" && e.from === undefined) {
      ctx.addIssue({ code: "custom", path: ["from"], message: "a `state` artefact names the branch-kept graph it is computed from" });
    }
    if (e.because !== "state" && e.from !== undefined) {
      ctx.addIssue({ code: "custom", path: ["from"], message: `\`from\` names branch-kept graphs; a \`${e.because}\` artefact is computed over instances, not a branch` });
    }
  });
export type BuiltAtPublish = z.infer<typeof BuiltAtPublishSchema>;

/** The list, refusing a path declared twice or nested inside another entry (one writer per route). */
export const BuiltAtPublishListSchema = z.array(BuiltAtPublishSchema).superRefine((list, ctx) => {
  for (const [i, a] of list.entries()) {
    for (const [j, b] of list.entries()) {
      if (i === j) continue;
      if (a.path === b.path && i < j) ctx.addIssue({ code: "custom", path: [j, "path"], message: `${b.path} is declared twice` });
      else if (a.path.endsWith("/") && b.path !== a.path && b.path.startsWith(a.path)) {
        ctx.addIssue({ code: "custom", path: [j, "path"], message: `${b.path} is inside ${a.path}: one route, one declared writer` });
      }
    }
  }
});

/** The `.gitignore` line that keeps one entry out of a commit: anchored at the layer root. */
export function ignoreLineFor(entry: Pick<BuiltAtPublish, "path">): string {
  return `/${entry.path}`;
}

/** Whether `rel` (instance-relative) is one of the declared artefacts or under one. */
export function isBuiltAtPublish(list: readonly Pick<BuiltAtPublish, "path">[], rel: string): boolean {
  return list.some((e) => (e.path.endsWith("/") ? rel.startsWith(e.path) || `${rel}/` === e.path : rel === e.path));
}
