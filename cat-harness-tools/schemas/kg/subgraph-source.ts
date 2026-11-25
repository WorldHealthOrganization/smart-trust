/**
 * WHERE A DECLARED SUBGRAPH GETS ITS CONTENT — one concept, several kinds.
 *
 * @module schemas/subgraph-source
 * @graphNode schema
 *
 * A declared subgraph says where it gets its content, and the layer config
 * may override that. Directory, branch and remote subgraphs are one thing
 * differing in SOURCE, a discriminated union on `kind`:
 *
 * | kind | content comes from | the entry's `path` is |
 * |---|---|---|
 * | `directory` (the default) | the checkout, at `path` | the content itself |
 * | `branch` | a declared repository branch, keyed by `commit` or `tip` | where a mount of it lands |
 * | `family` | a family of branches, one per key | where a mount of ONE member lands |
 * | `remote` | another repository's tree, at a pinned 40-character commit | where the remote mount lands |
 * | `hydrated` | another layer's published `index.hydrated.jsonld` for one subgraph, at a pinned commit — metadata, no files | where that one file lands |
 *
 * A new kind (e.g. a graph database) is a new MEMBER of the union, which every
 * `switch` on `kind` is then forced by the compiler to answer — never a
 * reinterpretation of an existing field.
 *
 * ## The legacy `storage` field
 *
 * `storage: { branch, keyedBy }` is EXACTLY
 * `source: { kind: "branch", branch, keyedBy }`, kept as the LEGACY spelling:
 * the resolver reads it and reports `declaredIn: "storage"`, the presence
 * checks ask {@link contentIsOffCheckout} (which honours both), and an entry
 * carrying both is refused. `qa-store.ts` and `branch-store.ts` still read
 * `storage` directly. The DECLARATION is the only source of a branch's name;
 * a branch no directory declares is a health finding (`state:drift`), not a
 * resolver failure.
 *
 * ## Overridable by the layer config, matched on id
 *
 * `<instance>.config.json` → `subgraphSources: { "<dir-id>": <source> }`. The
 * declaration says what the subgraph IS; the config says how THIS
 * instantiation is set up (an IG folio may mount `fsh-guts` from a branch
 * while a fresh clone reads it from the checkout). Matched on the entry's
 * `id`, never its `path`.
 *
 * ## One resolver
 *
 * {@link resolveSubgraphSource} is pure: entry + optional override in,
 * resolved source out. Every consumer — the KG export's Subgraph node, a
 * publisher's container node, `branch-store mount`/`push` — asks it, so the
 * precedence (config, then `source`, then legacy `storage`, then the
 * `directory` default) is stated once.
 */
import { z } from "zod";

import { propertyIri, termIri } from "./namespaces";

/** A plain branch name: no `refs/`, no `..`, no leading `-` — the rule `DirectoryStorageSchema` (#1764) uses. */
export const BranchNameSchema = z
  .string()
  .regex(/^(?!-)(?!refs\/)[A-Za-z0-9._/-]+$/, "a plain branch name, e.g. cat/cat-harness/todos")
  .refine(
    (b) => !b.includes("..") && !b.includes("//") && !b.endsWith("/") && !b.endsWith(".lock") && !b.startsWith("/"),
    "not a valid branch name",
  );

/**
 * How entries are keyed on a branch: one per `commit`, one live copy at the
 * `tip`, or one per published `route`.
 *
 * **THE one spelling of this enum.** `DirectoryStorageSchema.keyedBy` in
 * `cat-harness.ts` imports it rather than restating it, and that is not tidying:
 * the two were separate literals until this change, `cat-harness.ts` gained
 * `"route"` with bean `1j3q` and this one did not, so any declaration carrying
 * `keyedBy: "route"` parsed at the declaration layer and threw a ZodError the
 * moment {@link resolveSubgraphSource} read it —
 * `Invalid option: expected one of "commit"|"tip"`, measured on
 * `main@12b916e9a5`. The declaration said yes and the resolver said no, about
 * one field, and nothing compared them.
 *
 * **Widening an enum is SILENT where widening the union is loud.** The union
 * below documents that "a new kind is a new member here and a compile error at
 * every consumer that has not decided what to do with it". A new VALUE gets no
 * such help: every consumer guarding `keyedBy !== "tip"` kept compiling and
 * silently took its else-arm. That is why this change is four consumers wide and
 * not one line.
 *
 * What each value means, and why `route` is not a synonym for `tip` (the
 * difference is whether a write carries `expect`), is in
 * `DirectoryStorageSchema`'s docblock — one place, because the meaning is one
 * fact even though the enum is now read in two.
 */
/**
 * The ONE keying enum. `DirectoryStorageSchema.keyedBy` in `cat-harness.ts`
 * imports this rather than restating it, and bean `1j3q` is why: that field
 * held its own copy, `route` was added there and not here, and a route-keyed
 * declaration then parsed and threw a ZodError inside
 * {@link resolveSubgraphSource}. A schema change somebody has to make is only
 * a guard if there is one schema to change.
 *
 * `route-family` (bean `xp5j`) is added HERE for that reason. The branch that
 * introduced it first added a fourth value to the copy in `cat-harness.ts` and
 * reproduced `1j3q` one keying later — accepted by the declaration, rejected by
 * every consumer that parses through this.
 *
 * `family` (bean `lehh`) is here for the same reason: a family of BRANCHES,
 * one per key, under a `branchPrefix` (fhir-ast, lake-cache). It first lived
 * as a separate `z.literal("family")` arm of the storage schema — a second
 * definition of a keying, the drift this enum exists to prevent — and merging
 * main's identity test (`route-member.test.ts`) said so.
 */
export const KeyedBySchema = z.enum(["commit", "tip", "route", "route-family", "family"]);
export type KeyedBy = z.infer<typeof KeyedBySchema>;

/** A branch-name PREFIX for a family of branches: a plain branch name ending in `/`. */
export const BranchPrefixSchema = z
  .string()
  .regex(/^(?!-)(?!refs\/)[A-Za-z0-9._/-]+\/$/, "a plain branch prefix ending in /, e.g. cat/<instance>/fhir-ast/")
  .refine((b) => !b.includes("..") && !b.includes("//") && !b.startsWith("/"), "not a valid branch prefix");

/**
 * ## `route-family`, and why its reasoning is HERE
 *
 * One entry per MEMBER of a family under a directory's path, the member
 * supplied at publish time rather than declared — the `branches/<slug>/`
 * previews on `gh-pages`, one per open branch. Bean `xp5j`.
 *
 * A fourth keying rather than a flag on `route`, because `route` must not carry
 * two write contracts for the same reason it is not a synonym for `tip`. Three
 * things differ, each a decision rather than a detail:
 *
 * 1. **The member key is UNTRUSTED** — it derives from a branch name, and
 *    `.github/workflows/feature-staging.yml` states a branch name is
 *    attacker-controlled on a fork PR. {@link RouteMemberSchema} is the
 *    validation.
 * 2. **Source and destination differ.** A declared `route` is published FROM
 *    the declared path; a family member is built into a local directory and
 *    published to a route named at publish time, so the two cannot be one field.
 * 3. **A member can be REMOVED.** `route`'s contract has no case for it — "a
 *    generator that stops emitting a page must stop publishing it" — but a
 *    member's branch can be deleted, and `feature-staging.yml` already deletes
 *    `branches/<slug>` on PR close.
 *
 * Like `route`, a `route-family` write carries NO `expect`: a member is a
 * rendering authored by nobody, so the newer generation wins.
 *
 * This text sits beside the enum rather than on
 * `DirectoryStorageSchema.keyedBy` in `cat-harness.ts`, and that is `1j3q`'s
 * rule applied to prose: the keying has ONE definition, so it gets one
 * description. It also keeps this branch out of a file `main` edits constantly
 * — the earlier arrangement put 67 lines there and `merge-main-bot` refused
 * every sweep on it.
 */

/**
 * A `route-family` MEMBER key — one path segment, from untrusted input.
 *
 * The member becomes a path on the published branch, so a traversal here writes
 * OUTSIDE the family's prefix — over the site at `/` in the worst case. This
 * REFUSES rather than sanitises: a key that had to be cleaned up is a key whose
 * author meant something else, and a sanitiser's output is a value nobody
 * declared.
 *
 * ONE SEGMENT is the load-bearing rule. Refusing `/` outright disposes of
 * `..`, `//`, absolute paths and deep traversal in a single rule rather than as
 * four patterns somebody has to keep complete. No dot-prefixed segment (the
 * `kg-core/directory-conventions` guard, written to stay correct if a member
 * ever stops being one segment); no leading dash, so a member cannot be read as
 * a flag.
 */
export const RouteMemberSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "one path segment: alphanumerics, dot, dash, underscore, not starting with a dot or dash")
  .refine((m) => !m.split("/").some((seg) => seg.startsWith(".")), "no dot-prefixed segment")
  .refine((m) => m !== "." && m !== ".." && !m.includes(".."), "not a traversal");
export type RouteMember = z.infer<typeof RouteMemberSchema>;

/** The content is the checkout's own directory at the entry's `path`. */
export const DirectorySourceSchema = z.object({ kind: z.literal("directory") }).strict();

/** The content is a declared repository branch; the entry's `path` is where a mount of it lands. */
export const BranchSourceSchema = z
  .object({
    kind: z.literal("branch"),
    branch: BranchNameSchema,
    keyedBy: KeyedBySchema,
  })
  .strict();

/**
 * The content is a FAMILY of branches, one per key: `<branchPrefix><key>`,
 * where `keyFrom` says in words what the key is (an IG's package id; a Lean
 * package and toolchain). Bean `lehh`, owner 2026-10-04 (option 1 of 3): a
 * branch-only graph is declared on its directory, with a mount path, as
 * fsh-guts is. `repository` says WHERE the family is (owner, 2026-10-04: an
 * IG's AST *"could also materialize a remote AST into local branch"*, and
 * *"similar for lean cache"*): absent, it is on this repository, a local copy
 * materialised here; present, it is read from that remote `owner/repo`.
 * Its own KIND rather than a fourth `keyedBy` on `branch`,
 * because a family has no single branch to read: a consumer that took the
 * `branch` arm would read a branch that does not exist as an empty graph. A new
 * union member is a compile error at every such consumer instead.
 */
export const FamilySourceSchema = z
  .object({
    kind: z.literal("family"),
    branchPrefix: BranchPrefixSchema,
    keyFrom: z.string().min(1),
    /** Where the family is: absent = this repository (materialised locally); `owner/repo` = read from that remote. */
    repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "owner/repo").optional(),
  })
  .strict();

/**
 * The content is ANOTHER REPOSITORY's tree at a pinned commit — a REMOTE MOUNT
 * (bean `0mpw`). The entry's `path` is where the mount lands in this checkout;
 * `upstreamPath` is where the bytes are in that repository (absent: the same
 * path). Owner, 2026-10-06: *no git submodules ever*, and no `.deps/` — a
 * remote mount is a DECLARED DIRECTORY with a remote source, pinned to a full
 * SHA. A branch name moves under the reader and an abbreviated SHA is ambiguous
 * by definition, so neither is admitted.
 *
 * A downstream rarely writes this by hand: `remoteMounts` on its declaration
 * names a harness and its pin, and the harness's own `mountDefaults` say which
 * directories arrive and where (`schemas/kg/remote-mount.ts`). This member is the
 * per-directory answer that expansion produces, and the spelling a declaration
 * uses when it mounts one directory of somebody else's tree on its own.
 */
export const RemoteSourceSchema = z
  .object({
    kind: z.literal("remote"),
    repository: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/, "owner/repo").refine((r) => !r.includes(".."), "no `..`"),
    ref: z.string().regex(/^[0-9a-f]{40}$/, "ref must be a full 40-character commit SHA — pin, never follow a branch"),
    upstreamPath: z
      .string()
      .regex(/^[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\/?$/, "a repository-relative path, no dot-prefixed segment")
      .refine((p) => !p.split("/").includes(".."), "may not climb with `..`")
      .optional(),
    tool: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "a Tool node id").optional(),
  })
  .strict();

/**
 * The content is an NPM PACKAGE or tarball (.tgz) retrieved from npm or GitHub Packages
 * (bean `0mpw`, skills `npm-kg-distribution` & `remote-mount`).
 * The entry's `path` is where the package contents land in this checkout;
 * `upstreamPath` is where the bytes are inside the unpacked package (default: root).
 * `tool` is the declared Tool node id used for retrieval (defaults to "npm").
 */
export const NpmSourceSchema = z
  .object({
    kind: z.literal("npm"),
    /** Scoped or unscoped package name (e.g. `@litlfred/cat-harness`). */
    package: z.string().regex(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/, "an npm package name"),
    /** Exact semver version triple (no ranges). */
    version: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, "exact semver version triple (no ranges)"),
    /** Integrity SRI string (sha256 or sha512) for fixity verification. */
    integrity: z.string().optional(),
    /** Upstream path inside the extracted package tarball. */
    upstreamPath: z
      .string()
      .regex(/^[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\/?$/, "a package-relative path, no dot-prefixed segment")
      .refine((p) => !p.split("/").includes(".."), "may not climb with `..`")
      .optional(),
    /** Declared Tool that retrieves/mounts the package. Default: 'npm'. */
    tool: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "a Tool node id").default("npm"),
  })
  .strict();
export type NpmSource = z.infer<typeof NpmSourceSchema>;

/**
 * The content is ONE FILE OF METADATA: another layer's published
 * `index.hydrated.jsonld` for one of its subgraphs, at a pinned commit — every
 * node of that subgraph inline, typed, labelled and described, its heavy
 * bodies as payload pointers, and not one byte of the subgraph itself (bean
 * `mo75` G2; the contract is `skills/kg/kg-core/kg-export.md` §"Named
 * subgraphs"). The entry's `path` is the directory that one file lands in.
 *
 * It is a source KIND, not a flag on `remote`, for the reason `family` is not
 * a `keyedBy` on `branch`: a consumer that took the `remote` arm would copy a
 * directory that is not there and read the result as the subgraph. A new
 * member is a compile error at every such consumer instead (bean `l4ay`).
 *
 * `harness` and `subgraph` name the file rather than spell its path: where a
 * layer publishes is `<its docs dir>/subgraph/<harness>/<subgraph>/` and
 * the docs directory is read from ITS declaration at the pin, so the path is
 * the mounting tool's to compute ({@link publishedSubgraphDir} in
 * `subgraph-manifest.ts`). `subgraph` is never the layer root: a hydrated
 * file there would be the whole graph in one document (`f233`).
 *
 * `tool` names the declared Tool that fetches it (bean `j9cs`: the subgraph
 * names its mounter; there is no central one). Absent is `remote-mount`, the
 * Tool that lays it down when a mount entry or override asks for
 * `hydrated: true` (`schemas/kg/remote-mount.ts`).
 */
export const HydratedSourceSchema = z
  .object({
    kind: z.literal("hydrated"),
    repository: RemoteSourceSchema.shape.repository,
    ref: RemoteSourceSchema.shape.ref,
    /** The upstream layer's name — the `<HARNESS>` segment of the subgraph IRI. */
    harness: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "an instance name"),
    /** The subgraph's path in that layer, e.g. `tools` or `skills/sdlc`; never the root. */
    subgraph: z
      .string()
      .regex(/^[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\/?$/, "an instance-relative subgraph path, no dot-prefixed segment, never the root")
      .refine((p) => !p.split("/").includes(".."), "may not climb with `..`"),
    tool: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "a Tool node id").optional(),
  })
  .strict();
export type HydratedSource = z.infer<typeof HydratedSourceSchema>;

/** The Tool that lays a `hydrated` source down when the source names none. */
export const DEFAULT_HYDRATED_TOOL = "remote-mount";

/**
 * A declared subgraph's content source. A discriminated union, so a new kind
 * is a new member here and a compile error at every consumer that has not
 * decided what to do with it.
 */
export const SubgraphSourceSchema = z.discriminatedUnion("kind", [
  DirectorySourceSchema,
  BranchSourceSchema,
  FamilySourceSchema,
  RemoteSourceSchema,
  NpmSourceSchema,
  HydratedSourceSchema,
]);
export type SubgraphSource = z.infer<typeof SubgraphSourceSchema>;
export type SubgraphSourceKind = SubgraphSource["kind"];

/**
 * Where a NEW layer's graph of a kind lives — the scaffold default a graph
 * typology may carry (`newInstanceSource` on the graph-typology registry). Bean `hp54`.
 *
 * It has NO `branch`, and that is the point. The objection recorded on
 * `check-state-on-main.ts` still stands: a KIND has no branch name to give, so
 * a kind-level default the RESOLVER applied would decide a directory's storage
 * partly in its declaration and partly in a registry entry somebody else
 * edits. This is not that. `folio_init` reads it once, composes the branch
 * with {@link instanceStateBranch}, and writes an ordinary, complete
 * `source: { kind: "branch", branch, keyedBy }` into the new layer's own
 * declaration. After that the declaration is the one place that answers, and
 * {@link resolveSubgraphSource} never consults this field — which is also why
 * an existing layer's undeclared-source `beans/` (this repository's own)
 * is not flipped by it.
 *
 * Only `tip`: it is for one-live-copy state, the keying beans and todos use.
 */
export const NewInstanceSourceSchema = z
  .object({ kind: z.literal("branch"), keyedBy: KeyedBySchema.extract(["tip"]) })
  .strict();
export type NewInstanceSource = z.infer<typeof NewInstanceSourceSchema>;

/**
 * THE branch-name convention for a layer's own state subgraph:
 * `cat/<instance>/<directory-id>`.
 *
 * The owner's 2026-10-02 ruling named special branches `cat/<harness>/<name>`
 * (`cat/cat-harness/beans`, `cat/cat-harness/qa-reports`). A folio is a
 * layer like any harness, so its own work plan is `cat/<instance>/beans` in
 * ITS repository: keyed by the same layer name that already prefixes its
 * bean ids (`.beans.yml` → `prefix: <instance>-`) and names its declaration
 * (`<instance>.json`), so one name answers all three. The directory id, not
 * the kind, is the last segment — the id is what `branch-store mount --id`
 * and `state:seed --id` are keyed by.
 *
 * Validated, so a layer name that would make an invalid ref is refused
 * here rather than by `git push` later.
 */
export function instanceStateBranch(instance: string, id: string): string {
  return BranchNameSchema.parse(`cat/${instance}/${id}`);
}

/** Every kind the union knows — for a reader that must refuse the rest (`branch-store mount`'s exit code). */
export const SUBGRAPH_SOURCE_KINDS: readonly SubgraphSourceKind[] = ["directory", "branch", "family", "remote", "npm", "hydrated"];

/** The config half: `<instance>.config.json` → `subgraphSources`, keyed by directory id. */
export const SubgraphSourceOverridesSchema = z.record(z.string().min(1), SubgraphSourceSchema);
export type SubgraphSourceOverrides = z.infer<typeof SubgraphSourceOverridesSchema>;

/** The #1764 shape, read only to map it. */
const LegacyStorageSchema = z.union([
  z.object({ branch: BranchNameSchema, keyedBy: KeyedBySchema.exclude(["family"]) }),
  // `storage`'s family form (bean `lehh`): the owner's spelling, mapped to `kind: "family"`.
  z.object({
    branchPrefix: BranchPrefixSchema,
    keyedBy: KeyedBySchema.extract(["family"]),
    keyFrom: z.string().min(1),
    repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "owner/repo").optional(),
  }),
]);

/** Which layer the answer came from — reported, so an override is never silent. */
export type SourceDeclaredIn = "default" | "declaration" | "storage" | "config";


export type ResolvedSubgraphSource =
  | {
      kind: "directory";
      /** The declared directory's id. */
      id: string;
      /** The entry's `path` — the content itself. */
      path: string;
      declaredIn: SourceDeclaredIn;
    }
  | {
      kind: "branch";
      id: string;
      /** The entry's `path` — where a mount of the branch lands. */
      path: string;
      branch: string;
      keyedBy: KeyedBy;
      declaredIn: SourceDeclaredIn;
    }
  | {
      kind: "family";
      id: string;
      /** The entry's `path` — where a mount of ONE member of the family lands. */
      path: string;
      branchPrefix: string;
      keyFrom: string;
      /** The remote `owner/repo` the family is read from; absent when it is materialised on this repository. */
      repository?: string;
      declaredIn: SourceDeclaredIn;
    }
  | {
      kind: "remote";
      id: string;
      /** The entry's `path` — where the remote mount lands in this checkout. */
      path: string;
      repository: string;
      /** The pinned 40-character commit. */
      ref: string;
      /** Where the bytes are in the remote repository. */
      upstreamPath: string;
      tool?: string;
      declaredIn: SourceDeclaredIn;
    }
  | {
      kind: "npm";
      id: string;
      /** The entry's `path` — where the package mount lands in this checkout. */
      path: string;
      package: string;
      version: string;
      integrity?: string;
      /** Where the bytes are in the extracted package. */
      upstreamPath: string;
      tool: string;
      declaredIn: SourceDeclaredIn;
    }
  | {
      kind: "hydrated";
      id: string;
      /** The entry's `path` — the directory the one hydrated file lands in. */
      path: string;
      repository: string;
      /** The pinned 40-character commit. */
      ref: string;
      harness: string;
      /** The subgraph's instance-relative path, no trailing slash. */
      subgraph: string;
      /** The mounting Tool: the source's own, else {@link DEFAULT_HYDRATED_TOOL}. */
      tool: string;
      declaredIn: SourceDeclaredIn;
    };





/** The fields of a directory entry the resolver reads. */
export interface SourcedEntry {
  id: string;
  path: string;
  graphTypologies?: readonly string[];
  source?: SubgraphSource;
  /** #1764's field, if a declaration carries it. Read only to map it. */
  storage?: unknown;
}

/**
 * Does this entry's DECLARATION put its content somewhere other than the
 * checkout? The presence checks ask this (`materialiseDirectories`,
 * `check:declared-dirs`, `audit:coverage`): a subgraph whose content is on a
 * branch is not "missing" when its directory is absent, and must not be
 * created empty. Asked of the declaration alone, so it never throws and needs
 * no IO; the layer config's override is the resolver's to apply.
 * `storage` (#1764) counts — it is the legacy spelling of a branch source.
 */
export function contentIsOffCheckout(entry: { source?: SubgraphSource; storage?: unknown }): boolean {
  if (entry.source !== undefined) return entry.source.kind !== "directory";
  return entry.storage !== undefined && entry.storage !== null;
}

/**
 * THE resolver. Precedence: the layer config's override for this id, then
 * the entry's `source`, then a legacy `storage`, then `directory`.
 *
 * Throws on the two contradictions a reader must not paper over: an entry
 * carrying both `source` and `storage`, and a `qa` subgraph keyed by `tip`
 * (#1937's rule, kept here so it holds whichever field said it).
 */
export function resolveSubgraphSource(
  entry: SourcedEntry,
  overrides?: SubgraphSourceOverrides,
): ResolvedSubgraphSource {
  if (entry.source !== undefined && entry.storage !== undefined) {
    throw new Error(
      `directory "${entry.id}" declares both \`source\` and \`storage\` — two answers to where its content comes from. ` +
        `\`storage: { branch, keyedBy }\` is \`source: { kind: "branch", branch, keyedBy }\`; keep one.`,
    );
  }
  let src: SubgraphSource = { kind: "directory" };
  let declaredIn: SourceDeclaredIn = "default";
  const override = overrides?.[entry.id];
  if (override !== undefined) {
    src = SubgraphSourceSchema.parse(override);
    declaredIn = "config";
  } else if (entry.source !== undefined) {
    src = SubgraphSourceSchema.parse(entry.source);
    declaredIn = "declaration";
  } else if (entry.storage !== undefined) {
    const s = LegacyStorageSchema.parse(entry.storage);
    src = "branchPrefix" in s
      ? { kind: "family", branchPrefix: s.branchPrefix, keyFrom: s.keyFrom, ...(s.repository ? { repository: s.repository } : {}) }
      : { kind: "branch", branch: s.branch, keyedBy: s.keyedBy };
    declaredIn = "storage";
  }
  switch (src.kind) {
    case "directory":
      return { kind: "directory", id: entry.id, path: entry.path, declaredIn };
    case "branch": {
      // Every NON-commit keying, not just `tip`. `directory-storage.test.ts`
      // states the principle this guard had already broken: *"A guard that named
      // one value would admit every value added after it — which is exactly how
      // `route` would have slipped past the check written for `tip`"*.
      // `ContentDirectorySchema` refuses both for a DECLARED entry, so this arm
      // is reached by a caller that builds an entry by hand — `audit-coverage.ts`
      // does — which is precisely where a schema cannot help.
      if (src.keyedBy !== "commit" && (entry.graphTypologies ?? []).includes("qa")) {
        throw new Error(
          `directory "${entry.id}" is a \`qa\` subgraph: it is keyed by commit, and \`keyedBy: "${src.keyedBy}"\` is not. ` +
            `\`tip\` is for one-live-copy state (beans, todos); \`route\` is for regenerable published output. ` +
            `A QA verdict is addressed by the COMMIT it judges, so neither names the right unit.`,
        );
      }
      return {
        kind: "branch",
        id: entry.id,
        path: entry.path,
        branch: src.branch,
        keyedBy: src.keyedBy,
        declaredIn,
      };
    }
    case "family": {
      if ((entry.graphTypologies ?? []).includes("qa")) {
        throw new Error(
          `directory "${entry.id}" is a \`qa\` subgraph: it is keyed by commit, and a branch family is not.`,
        );
      }
      const prefix = src.branchPrefix;
      return {
        kind: "family",
        id: entry.id,
        path: entry.path,
        branchPrefix: prefix,
        keyFrom: src.keyFrom,
        ...(src.repository ? { repository: src.repository } : {}),
        declaredIn,
      };
    }
    case "remote": {
      // A `qa` subgraph is keyed by THIS repository's commits; somebody
      // else's tree at somebody else's pin judges nothing here.
      if ((entry.graphTypologies ?? []).includes("qa")) {
        throw new Error(`directory "${entry.id}" is a \`qa\` subgraph: it is keyed by this repository's commits, and a remote mount is not.`);
      }
      return {
        kind: "remote",
        id: entry.id,
        path: entry.path,
        repository: src.repository,
        ref: src.ref,
        upstreamPath: src.upstreamPath ?? entry.path,
        ...(src.tool ? { tool: src.tool } : {}),
        declaredIn,
      };
    }
    case "npm": {
      if ((entry.graphTypologies ?? []).includes("qa")) {
        throw new Error(`directory "${entry.id}" is a \`qa\` subgraph: it is keyed by this repository's commits, and an npm package is not.`);
      }
      return {
        kind: "npm",
        id: entry.id,
        path: entry.path,
        package: src.package,
        version: src.version,
        ...(src.integrity ? { integrity: src.integrity } : {}),
        upstreamPath: src.upstreamPath ?? entry.path,
        tool: src.tool,
        declaredIn,
      };
    }
    case "hydrated": {
      // Metadata about somebody else's subgraph judges no commit of this one.
      if ((entry.graphTypologies ?? []).includes("qa")) {
        throw new Error(`directory "${entry.id}" is a \`qa\` subgraph: it is keyed by this repository's commits, and another instance's published metadata is not.`);
      }
      return {
        kind: "hydrated",
        id: entry.id,
        path: entry.path,
        repository: src.repository,
        ref: src.ref,
        harness: src.harness,
        subgraph: src.subgraph.replace(/\/+$/, ""),
        tool: src.tool ?? DEFAULT_HYDRATED_TOOL,
        declaredIn,
      };
    }
  }
}

/**
 * The JSON-LD form of a resolved source — the value of a Subgraph node's
 * `contentSource`. Keys are scoped by the `@context` the exporter declares
 * ({@link contentSourceContext}), so they cannot leak a meaning onto
 * another node's `kind` or `branch`.
 *
 * A branch on a forge whose tree URL layout is known gets an `@id` that
 * dereferences to the branch; anything else stays a blank node carrying the
 * name — a link that looks dereferenceable and 404s is worse than none.
 */
export function contentSourceJsonLd(src: ResolvedSubgraphSource, repository?: string): Record<string, unknown> {
  switch (src.kind) {
    case "directory":
      return { kind: "directory", declaredIn: src.declaredIn };
    case "branch": {
      const web = forgeTreeUrl(repository, src.branch);
      return {
        ...(web ? { "@id": web } : {}),
        kind: "branch",
        branch: src.branch,
        keyedBy: src.keyedBy,
        declaredIn: src.declaredIn,
      };
    }
    case "family":
      // The prefix is the family's identifier; no single branch has a tree URL.
      return {
        kind: "family",
        branch: src.branchPrefix,
        keyFrom: src.keyFrom,
        ...(src.repository ? { familyRepository: src.repository } : {}),
        declaredIn: src.declaredIn,
      };
    case "remote": {
      // The tree URL at the pin carries both the repository and the commit,
      // so no new term is minted for either: the `@id` dereferences to them.
      const web = forgeTreeUrl(src.repository, `${src.ref}/${src.upstreamPath.replace(/\/+$/, "")}`);
      return { ...(web ? { "@id": web } : {}), kind: "remote", declaredIn: src.declaredIn };
    }
    case "npm": {
      const npmUrl = `https://www.npmjs.com/package/${src.package}/v/${src.version}`;
      return {
        "@id": npmUrl,
        kind: "npm",
        package: src.package,
        version: src.version,
        ...(src.integrity ? { integrity: src.integrity } : {}),
        tool: src.tool,
        declaredIn: src.declaredIn,
      };
    }
    case "hydrated": {
      // The tree at the pin names the repository and the commit; the subgraph
      // is identified by the hydrated file's own root `@id`, which the
      // mounting tool checks, so no term is minted for it here.
      const web = forgeTreeUrl(src.repository, src.ref);
      return { ...(web ? { "@id": web } : {}), kind: "hydrated", declaredIn: src.declaredIn };
    }
  }
}

/** `owner/repo` or a GitHub URL → the branch's tree URL; `undefined` for anything else. */
export function forgeTreeUrl(repository: string | undefined, branch: string): string | undefined {
  if (!repository) return undefined;
  const m = /^(?:https?:\/\/github\.com\/)?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(repository);
  if (!m) return undefined;
  return `https://github.com/${m[1]}/tree/${branch}`;
}

/**
 * The `@context` entry for `contentSource`: the property and its SCOPED terms
 * (JSON-LD 1.1 §4.1.8 — `kind` and `branch` are words another node could use
 * for something else, so they mean this only inside `contentSource`).
 *
 * Vocabulary REUSED before minted: `contentSource` is `dcterms:source` ("a
 * related resource from which the described resource is derived"), `kind` is
 * `dcterms:type`, `branch` is `dcterms:identifier`. Only `keyedBy` and
 * `sourceDeclaredIn` are minted, glossed in `vocabulary.ts`: no published
 * vocabulary says how entries are keyed on a repository branch, or which
 * configuration layer an answer came from.
 */
export function contentSourceContext(): Record<string, unknown> {
  return {
    "@id": propertyIri("contentSource"),
    "@context": {
      kind: propertyIri("contentSourceKind"),
      branch: propertyIri("contentSourceBranch"),
      keyedBy: termIri("keyedBy"),
      keyFrom: termIri("keyFrom"),
      familyRepository: termIri("familyRepository"),
      declaredIn: termIri("sourceDeclaredIn"),
    },
  };
}
