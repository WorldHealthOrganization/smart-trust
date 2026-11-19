/**
 * The two files a NAMED SUBGRAPH publishes — `index.jsonld` (referenced) and
 * `index.hydrated.jsonld` (dereferenced) — as one schema with two forms.
 *
 * The contract is `skills/kg/kg-core/kg-export.md` §"Named subgraphs — one
 * IRI, two files, framed from one graph". This module is what a consumer
 * validates against; `scripts/gen-subgraph-jsonld.ts` validates every file
 * against it before writing.
 *
 * ## One base with the harness
 *
 * A harness instance IS a named subgraph, and a subgraph is a directory of a
 * declared graph — both what {@link GraphNodeDirectoryShape} describes. The
 * subgraph node PICKS that shape: `path` and the label fields come from it
 * unchanged. Two fields are not carried, each replaced by its JSON-LD form:
 *
 * - `id` — the node's identity is its `@id`, the directory IRI.
 * - `graphTypologies` — the KG carries kinds as `holdsGraph` LINKS to
 *   GraphTypology nodes, not a literal list.
 *
 * ## The two forms differ only in what a member IS
 *
 * - In the INDEX a direct member is a pointer — `@id`, `@type` and its label —
 *   and a child subgraph is its IRI, nothing more.
 * - In the HYDRATED file a member is the whole node, and a child subgraph is
 *   the child's own subgraph node, nested, with ITS members inline. So
 *   "every node of `skills/sdlc`" is one fetch.
 *
 * Both have the directory IRI as root `@id`, and both name the shared context
 * by URL: an inline `@context` object is rejected by the type, because the
 * contract says the context is never inlined.
 *
 * @graphNode schema
 */

import { z } from "zod";
import { GraphNodeDirectoryShape } from "./cat-harness.js";

/**
 * A subgraph IRI: `<BASE_URL>/subgraph/<HARNESS>/<PATH>/` — always a directory.
 * `<BASE_URL>/subgraph/` itself is the REPOSITORY's level, above every harness
 * root (bean `ax6r`): index only, and its children are the harness roots.
 */
export const SubgraphIriSchema = z
  .string()
  .url()
  .refine((s) => /\/subgraph\/(?:[^/]+\/(?:.+\/)?)?$/.test(s), {
    message: "a subgraph IRI is <BASE_URL>/subgraph/[<HARNESS>/[<PATH>/]], ending in /",
  });

/** The shared base: the declared-directory shape, picked, plus the JSON-LD identity. */
const SubgraphNodeBase = GraphNodeDirectoryShape.pick({ path: true, title: true, description: true }).extend({
  "@id": SubgraphIriSchema,
  "@type": z.string().min(1),
  /** The subgraph's label: the harness name at the root, the instance-relative path below it. */
  name: z.string().min(1),
  /** Links to the GraphTypology nodes this subgraph holds. */
  holdsGraph: z.array(z.string().min(1)).optional(),
});

// ── Payloads (bean `f233`) ──────────────────────────────────────────────
//
// The SKELETON is the two subgraph files; the MUSCLE is here. A node's heavy
// content — the bytes one of its pointer fields names — is published once,
// under the hex SHA-256 of those bytes, and every subgraph file that carries
// the node links to it by that IRI. The contract is
// `skills/kg/kg-core/kg-export.md` §"Payloads — heavy content by content
// address".

/**
 * Where payloads are written, relative to the docs site root, and published,
 * relative to the base URL — the same path for both:
 * `<BASE_URL>/payload/sha256/<hex>` (owner ruling, 2026-10-03).
 */
export const PAYLOAD_PATH = "payload/sha256";

/** A sidecar is `<hex>` plus this; it carries the media type. */
export const PAYLOAD_SIDECAR_SUFFIX = ".json";

/** The tag a payload sidecar declares itself with — the file says what it is. */
export const PAYLOAD_SIDECAR_SCHEMA = "cat-harness-payload/v1";

/** Lower-case hex SHA-256 — the whole of a payload's name. */
export const Sha256HexSchema = z.string().regex(/^[0-9a-f]{64}$/, "a payload name is 64 lower-case hex digits");

/** `<BASE_URL>/payload/sha256/<hex>` — no extension, ever. */
export const PayloadIriSchema = z
  .string()
  .url()
  .refine((s) => new RegExp(`/${PAYLOAD_PATH}/[0-9a-f]{64}$`).test(s), {
    message: `a payload IRI is <BASE_URL>/${PAYLOAD_PATH}/<hex>, with no extension`,
  });

/**
 * The `payload` link a node carries in BOTH subgraph files: the payload's IRI,
 * plus its digest and size, so a consumer can verify what it fetched — and
 * decide whether to fetch it at all — without dereferencing anything. The
 * digest is the IRI's last segment by construction; the refinement makes that
 * checked rather than assumed.
 */
export const PayloadLinkSchema = z
  .strictObject({
    "@id": PayloadIriSchema,
    sha256: Sha256HexSchema,
    bytes: z.number().int().nonnegative(),
  })
  .refine((l) => l["@id"].endsWith(`/${l.sha256}`), { message: "a payload link's sha256 is its IRI's last segment" });
export type PayloadLink = z.infer<typeof PayloadLinkSchema>;

/**
 * `<hex>.json`, beside `<hex>`: the one home of the media type.
 *
 * A sidecar and not an extension, because the IRI is extensionless by ruling
 * — `<hex>.md` would be a second address for one payload — and GitHub Pages
 * types a file by its extension, so an extensionless payload is served as
 * `application/octet-stream` whatever it holds. A consumer holding only the
 * IRI appends `.json` to learn what it fetched. Not on the link: one fact,
 * one place, and the sidecar is the place that travels with the bytes.
 */
export const PayloadSidecarSchema = z.strictObject({
  $schema: z.literal(PAYLOAD_SIDECAR_SCHEMA),
  sha256: Sha256HexSchema,
  bytes: z.number().int().nonnegative(),
  mediaType: z.string().regex(/^[a-z]+\/[a-z0-9.+-]+(?:; ?[a-z]+=[A-Za-z0-9-]+)?$/, "an RFC 6838 media type"),
});
export type PayloadSidecar = z.infer<typeof PayloadSidecarSchema>;

/**
 * WHAT IS HEAVY — the node fields whose TARGET is published as a payload,
 * keyed by node class.
 *
 * Decided from measurement (2026-10-03, kg-export over this layer: 3,120
 * nodes, 2.5 MB of metadata, no literal field over 4.6 KB). The graph already
 * holds no body inline, so "heavy" is what its pointers name:
 *
 * - **Heavy:** Markdown bodies — a skill's instruction body (300 files,
 *   3.0 MB) and a declared asset's (3 files, 12 KB). An asset that is an
 *   image is heavy by the same entry; none is declared today.
 * - **Not heavy, yet:** a process's BPMN (78 files, 1.5 MB) and a decision's
 *   DMN (10, 58 KB). Their topology is already decomposed into graph nodes,
 *   and the XML is the source file of its own declared graph rather than a
 *   node's body.
 * - **Not heavy:** a schema's `.ts` module (161 files, 2.5 MB) — code, not
 *   content.
 * - **Deep provenance:** none is in the graph today, so nothing to move.
 *
 * Adding a row here is the whole change to make a field heavy.
 */
export const HEAVY_POINTERS: ReadonlyArray<{ readonly type: string; readonly field: string }> = [
  { type: "Skill", field: "instructionsPath" },
  { type: "Asset", field: "path" },
];

/**
 * A payload's media type, by its SOURCE file's extension. An extension not
 * listed is a problem, never a guess: a payload declared under the wrong type
 * is worse than one not published.
 */
export const PAYLOAD_MEDIA_TYPES: Readonly<Record<string, string>> = {
  md: "text/markdown; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  // `package.json` is an Asset since npm packaging was declared (role
  // `package-manifest`); its payload is the manifest itself, as JSON.
  json: "application/json",
};

/** A member as the INDEX carries it: enough to find it, label it, type it, and reach its payload. */
export const SubgraphPointerSchema = z.strictObject({
  "@id": z.string().url(),
  "@type": z.string().min(1),
  name: z.string().optional(),
  title: z.string().optional(),
  payload: PayloadLinkSchema.optional(),
});

/** A member as the HYDRATED file carries it: the whole KG node, open-ended — its payload a link, never the body. */
export const SubgraphMemberSchema = z.looseObject({
  "@id": z.string().url(),
  "@type": z.string().min(1),
  payload: PayloadLinkSchema.optional(),
});

export const SubgraphIndexNodeSchema = SubgraphNodeBase.extend({
  hasMember: z.array(SubgraphPointerSchema).optional(),
  hasSubgraph: z.array(SubgraphIriSchema).optional(),
}).strict();

export type SubgraphHydratedNode = z.infer<typeof SubgraphNodeBase> & {
  hasMember?: Array<z.infer<typeof SubgraphMemberSchema>>;
  hasSubgraph?: SubgraphHydratedNode[];
};

export const SubgraphHydratedNodeSchema: z.ZodType<SubgraphHydratedNode> = z.lazy(() =>
  SubgraphNodeBase.extend({
    hasMember: z.array(SubgraphMemberSchema).optional(),
    hasSubgraph: z.array(SubgraphHydratedNodeSchema).optional(),
  }).strict(),
);

/** The `@context` is a URL, never an inline object. */
const ContextUrl = z.string().url();

/**
 * The file's own statement that a generator wrote it — a top-level
 * `_generated`, the convention `check:reference-direction` reads (bean
 * `ws99`). Top level only: a member node never carries it. It IS a JSON-LD
 * term — `ns/subgraph/v1.jsonld` maps `_generated` to `ns#generatedNote`,
 * `@type: @json` — because an unmapped key is not silently dropped: a
 * processor reports it as an `invalid property`, and `publish-verify`'s
 * `jsonld-expand` failed every subgraph file on it (folio-assistant#2545).
 */
const GeneratedNote = z.string().min(1);

/**
 * `index.jsonld`. `seeAlso` is the REPOSITORY level's only (bean `t8c4`): the
 * repository indexes of instances in this checkout whose diagrams this build
 * does not frame (`pve3` — bootstrap publishes through its own graph). A link,
 * not membership: nothing here claims to hold their nodes.
 */
export const SubgraphIndexSchema = SubgraphIndexNodeSchema.extend({
  "@context": ContextUrl,
  _generated: GeneratedNote.optional(),
  seeAlso: z.array(z.string().url()).optional(),
}).strict();
export type SubgraphIndex = z.infer<typeof SubgraphIndexSchema>;

/** `index.hydrated.jsonld`. */
export const SubgraphHydratedSchema = SubgraphNodeBase.extend({
  "@context": ContextUrl,
  _generated: GeneratedNote.optional(),
  hasMember: z.array(SubgraphMemberSchema).optional(),
  hasSubgraph: z.array(SubgraphHydratedNodeSchema).optional(),
}).strict();
export type SubgraphHydrated = z.infer<typeof SubgraphHydratedSchema>;

/**
 * Where the shared subgraph `@context` is written, relative to the layer
 * root, and published, relative to the base URL — the same path for both,
 * beside `ns/content/v1.jsonld`.
 */
// declared-path-literal: this constant DEFINES the published, dereferenceable IRI path of the context; it is fixed by that URL, not by where the `ns/` declaration points.
export const SUBGRAPH_CONTEXT_PATH = "ns/subgraph/v1.jsonld";

/** The two file names under every subgraph IRI. The root has the first only. */
export const SUBGRAPH_INDEX_FILE = "index.jsonld";
export const SUBGRAPH_HYDRATED_FILE = "index.hydrated.jsonld";

/**
 * Where a layer PUBLISHES one subgraph's two files, relative to its own
 * root: `<docs>/subgraph/<HARNESS>/<PATH>/` — `gen-subgraph-jsonld`'s output
 * layout, and the directory `kg:materialize --nodes` and a hydrated mount
 * (bean `mo75` G2) read `index.hydrated.jsonld` from. `docsPath` is the
 * layer's declared `docs` directory, read from ITS declaration by the
 * caller, never spelled.
 *
 * Throws on the root (`""`, `.`): a harness root publishes `index.jsonld`
 * only, and a hydrated file there would be the monolith `f233` forbids.
 * Returns no trailing slash.
 */
export function publishedSubgraphDir(docsPath: string, harness: string, subgraph: string): string {
  const sub = subgraph.trim().replace(/^\/+|\/+$/g, "");
  if (sub === "" || sub === ".") {
    throw new Error(`the root of \`${harness}\` publishes ${SUBGRAPH_INDEX_FILE} only: a hydrated file there would be the whole graph in one document (f233)`);
  }
  if (sub.split("/").some((seg) => seg === ".." || seg.startsWith("."))) throw new Error(`subgraph path \`${subgraph}\` climbs or is dot-prefixed`);
  const docs = docsPath.replace(/^\.\//, "").replace(/\/+$/, "");
  return [docs, "subgraph", harness, sub].filter(Boolean).join("/");
}

/**
 * ## The subgraph index PACKAGE: the two files, published per pin (bean `mo75` G2b)
 *
 * Owner, 2026-10-24 (decision card, option A): *the subgraph index files are
 * published per pin in a package*, and a hydrated mount fetches them through
 * the Tool its source names (`HydratedSource.tool`, bean `j9cs`). Rejected:
 * committing them in each repository (B) — they are `builtAtPublish`, computed
 * over the checkout's other layers, so no commit could hold them current
 * and every re-pin would turn a committed-bytes check red (owner, 2026-10-14,
 * "B1"); and generating them at mount time (C) — a mount would then need the
 * whole index, kg-export and the framing toolchain to read one file of
 * metadata, which is the cost a hydrated mount exists to avoid.
 *
 * What a pin publishes, for each layer that builds `<docs>/subgraph/`:
 *
 * - ONE npm package (`bun pm pack`), `<harness>-subgraph-index` at version
 *   `0.0.0-pin.<sha>`, holding every `index.jsonld` and
 *   `index.hydrated.jsonld` under `<docs>/subgraph/<harness>/` at the paths
 *   the layer publishes them (instance-relative), plus the manifest
 *   {@link SUBGRAPH_INDEX_MANIFEST_FILE} at the package root;
 * - the package's `folio-binary-release/v1` record beside it
 *   (`<tarball>.release.json`, `schemas/sdlc/binary-release.ts`), with the
 *   tarball's size and sha256;
 * - both as assets of the GitHub release tagged
 *   {@link subgraphIndexPackage}`.tag` in the layer's repository — the host
 *   `npm-kg-distribution` §3 already names, downloadable without a token.
 *
 * Every name is a function of (repository, pin, harness) alone, so a consumer
 * computes where to look and never lists releases.
 */

/** The tag a subgraph index package's manifest carries. */
export const SUBGRAPH_INDEX_PACKAGE_SCHEMA_TAG = "folio-subgraph-index/v1";
/** The manifest at the package root. */
export const SUBGRAPH_INDEX_MANIFEST_FILE = "subgraph-index.json";

const Sha40 = z.string().regex(/^[0-9a-f]{40}$/, "a full 40-character commit SHA");
const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, "a sha256 digest is 64 lowercase hex characters");

/** One published file in the package. */
export const SubgraphIndexFileSchema = z
  .object({
    /** Package-relative and instance-relative: `<docs>/subgraph/<harness>/<subgraph>/<file>`. */
    path: z.string().min(1),
    /** The subgraph's instance-relative path, no trailing slash; `""` is the harness root (index only). */
    subgraph: z.string(),
    file: z.enum([SUBGRAPH_INDEX_FILE, SUBGRAPH_HYDRATED_FILE]),
    bytes: z.number().int().nonnegative(),
    sha256: Sha256Hex,
  })
  .strict();
export type SubgraphIndexFile = z.infer<typeof SubgraphIndexFileSchema>;

/**
 * `subgraph-index.json`: which pin of which layer the files are, and a
 * sha256 per file. A consumer refuses a package whose manifest names another
 * repository, pin or harness than the one it fetched for, and a file whose
 * bytes do not hash to its entry.
 */
export const SubgraphIndexManifestSchema = z
  .object({
    $schema: z.literal(SUBGRAPH_INDEX_PACKAGE_SCHEMA_TAG),
    repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "owner/name"),
    ref: Sha40,
    harness: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "an instance name"),
    /** The layer's declared `docs` directory, no trailing slash. */
    docs: z.string().min(1),
    /** What the files were built in — they are computed over a checkout's layers, so the checkout is provenance. */
    builtIn: z.object({ repository: z.string().min(1), ref: z.string().min(1) }).strict().optional(),
    files: z.array(SubgraphIndexFileSchema).min(1),
  })
  .strict()
  .superRefine((m, ctx) => {
    const seen = new Set<string>();
    m.files.forEach((f, i) => {
      if (seen.has(f.path)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["files", i, "path"], message: `\`${f.path}\` is listed twice` });
      seen.add(f.path);
      const want = f.subgraph === "" ? `${m.docs}/subgraph/${m.harness}/${f.file}` : `${publishedSubgraphDir(m.docs, m.harness, f.subgraph)}/${f.file}`;
      if (f.path !== want) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["files", i, "path"], message: `\`${f.path}\` is not where \`${f.subgraph || "(root)"}\` publishes \`${f.file}\` (\`${want}\`)` });
      if (f.subgraph === "" && f.file === SUBGRAPH_HYDRATED_FILE) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["files", i], message: "the root publishes index.jsonld only (f233)" });
    });
  });
export type SubgraphIndexManifest = z.infer<typeof SubgraphIndexManifestSchema>;

/** Where one pin's subgraph index package is published: every name, computed. */
export interface SubgraphIndexPackageRef {
  /** npm package name. */
  name: string;
  /** npm version: `0.0.0-pin.<sha>`. */
  version: string;
  /** The GitHub release tag holding it. */
  tag: string;
  /** The `.tgz` asset — `bun pm pack`'s name for `name@version`. */
  tarball: string;
  /** Its `folio-binary-release/v1` record. */
  record: string;
  tarballUrl: string;
  recordUrl: string;
}

/**
 * Every name of the subgraph index package `harness` publishes at `ref` in
 * `repository`. Throws on a ref that is not a full 40-character SHA: a branch
 * or a short SHA is not a pin.
 */
export function subgraphIndexPackage(repository: string, ref: string, harness: string): SubgraphIndexPackageRef {
  if (!Sha40.safeParse(ref).success) throw new Error(`\`${ref}\` is not a pin: a subgraph index package is published per full 40-character commit`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(harness)) throw new Error(`\`${harness}\` is not an instance name`);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error(`\`${repository}\` is not owner/name`);
  const name = `${harness}-subgraph-index`;
  const version = `0.0.0-pin.${ref}`;
  const tag = `subgraph-index-${ref}`;
  const tarball = `${name}-${version}.tgz`;
  const record = `${tarball}.release.json`;
  const base = `https://github.com/${repository}/releases/download/${tag}`;
  return { name, version, tag, tarball, record, tarballUrl: `${base}/${tarball}`, recordUrl: `${base}/${record}` };
}
