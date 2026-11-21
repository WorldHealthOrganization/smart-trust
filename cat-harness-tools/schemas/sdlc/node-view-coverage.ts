/**
 * The node-view coverage report: for each node a declared directory holds,
 * whether it has an IRI, its JSON-LD, a view page and a row on its folder page.
 *
 * Owner, 2026-11-13 (card A): build the `node-view-coverage` QA report as
 * proposed in the node-kind view audit, and every listed node kind owes pages
 * (IRI, `.jsonld`, view page) — no waivers for themes, voices, translation
 * sources, code, QA or software libraries. So those count as `missing` until
 * they are built, never as `waived`.
 *
 * The rule it measures is `kg-viewer`'s §"Every asset has its own IRI": each
 * node owes
 *
 * 1. an IRI — an `@id` in its layer's export, extensionless;
 * 2. its JSON-LD at `<iri>.jsonld` (and `<iri>.json` where its source is JSON);
 * 3. a view page at `<base>/<locale>/<harness>/<vis>/<instance>/<id>/`;
 * 4. a row on the folder page that links to that page.
 *
 * ## A report, not a gate
 *
 * `node-views:report` always exits 0, like `render:bpmn:check`. It is in no
 * index gate list and not always-green. `node-views:judge` is the author's
 * check: `JUDGEMENT_EXIT`, 1 only for a finding NEW against the baseline.
 *
 * ## Unknown is never zero
 *
 * A directory not in this checkout (a `qa` directory kept on `qa-reports`, say)
 * has `declared: "unknown"` and a reason. A count that could not be taken
 * (no site to read, a probe over the limit) is `"unknown"` too.
 *
 * @graphNode schema
 * @module schemas/sdlc/node-view-coverage
 */
import { z } from "zod";

import { nodeKind } from "../kg/node-kind.ts";

export const NODE_VIEW_COVERAGE_SCHEMA = "node-view-coverage/v1";

/** A count, or `"unknown"` when it could not be taken. Never a 0 for unknown. */
export const CountSchema = z.union([z.number().int().nonnegative(), z.literal("unknown")]);
export type Count = z.infer<typeof CountSchema>;

/**
 * What a node lacks. `iri` — no `@id` in its layer's export; `iri-extension` —
 * its `@id` ends in a file extension (the IRI is not extensionless); `jsonld`
 * and `json` — `<iri>.jsonld` / `<iri>.json` does not resolve; `page` — no
 * page at its path IRI or anywhere the folder page links; `canonical-page` —
 * a page exists, but not at the path IRI; `listed` — the folder page names no
 * link to it.
 */
export const NodeLackSchema = z.enum(["iri", "iri-extension", "jsonld", "json", "page", "canonical-page", "listed"]);
export type NodeLack = z.infer<typeof NodeLackSchema>;

export const NodeRowSchema = z.object({
  /** The node's id inside its directory (a file stem, an entry folder, an export `name`). */
  id: z.string().min(1),
  /** Layer-relative source path, when the node is a file or folder. */
  path: z.string().min(1).optional(),
  /** Its `@id` in the layer's export, when it has one. */
  iri: z.string().min(1).optional(),
  /** Its page, when one was found (site-relative). */
  page: z.string().min(1).optional(),
  /** `ok`, `missing` (see `missing`) or `unknown` (see `reason`). */
  verdict: z.enum(["ok", "missing", "unknown"]),
  missing: z.array(NodeLackSchema).optional(),
  reason: z.string().min(1).optional(),
});
export type NodeRow = z.infer<typeof NodeRowSchema>;

/** Is a folder viewed? `waived` needs a ruling; none is recorded today (owner, 2026-11-13). */
export const ViewerStateSchema = z.object({
  state: z.enum(["declared", "none", "waived"]),
  /** The visualiser's `<harness>/<id>` when declared. */
  id: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  ruling: z.string().min(1).optional(),
});

/** One layer × declared directory × kind. */
export const CoverageRowSchema = z.object({
  layer: z.string().min(1),
  /** The declared directory's `id`. */
  directory: z.string().min(1),
  /** Its layer-relative path. */
  path: z.string().min(1),
  kind: z.string().min(1),
  viewer: ViewerStateSchema,
  /** The folder page the rows should be on, site-relative; absent with no viewer. */
  folderPage: z.string().min(1).optional(),
  /** Whether the folder page answered. */
  folderPageFound: z.union([z.boolean(), z.literal("unknown")]),
  /** How the nodes were counted: `export` (the layer's KG), or the file rule named. */
  census: z.string().min(1),
  declared: CountSchema,
  withIri: CountSchema,
  withJsonld: CountSchema,
  /** Only where the kind's source is JSON, so a `.json` twin is owed. */
  withJson: CountSchema.optional(),
  withPage: CountSchema,
  listed: CountSchema,
  /** Folder-page links (HTML or data file) that do not resolve. */
  deadLinks: z.array(z.string()),
  /** Folder-page links to `github.com/<o>/<r>/blob|tree/…` instead of a page. */
  rawRepoLinks: CountSchema,
  /** Why the row, or a count in it, is unknown. */
  reason: z.string().min(1).optional(),
  nodes: z.array(NodeRowSchema),
});
export type CoverageRow = z.infer<typeof CoverageRowSchema>;

export const NodeViewCoverageSchema = z.object({
  $schema: z.literal(NODE_VIEW_COVERAGE_SCHEMA),
  layer: z.string().min(1),
  /** What was read: a built site directory or a live base URL. */
  site: z.object({ kind: z.enum(["dir", "url", "none"]), at: z.string().optional() }),
  generatedAt: z.string().min(1),
  totals: z.object({
    rows: z.number().int().nonnegative(),
    nodes: CountSchema,
    ok: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative(),
    deadLinks: z.number().int().nonnegative(),
  }),
  rows: z.array(CoverageRowSchema),
});
export type NodeViewCoverage = z.infer<typeof NodeViewCoverageSchema>;

/**
 * `node-view-coverage/v1` as a node kind, for the `folio-validator/v1` node
 * that will name it (`validators/node-view-coverage.json` in cat-harness), so
 * `node-kinds:check` files the family under a kind rather than grandfathering
 * it as unkinded. Unversioned, as `QaScriptKind` is: the family tag is
 * `node-view-coverage/v1`, so `$schema` stays a field of the shape.
 *
 * NOT YET LISTED under `qa`'s `nodeSchemas`. Listing the family here and
 * declaring its validator node in cat-harness must land together: each
 * repository's CI reads the other at `main`, and either half alone is red
 * (a listed family with no validator node; a validator node for an unlisted
 * family). That pair is a separate, sequenced change.
 */
export const NodeViewCoverageKind = nodeKind("node-view-coverage", [], NodeViewCoverageSchema.shape);
