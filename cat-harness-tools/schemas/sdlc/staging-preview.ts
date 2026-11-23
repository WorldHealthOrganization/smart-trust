/**
 * `staging-preview` — a node of the trashcan that describes one review preview.
 *
 * @module schemas/staging-preview
 * @graphNode schema
 *
 * ## Why this is a trashcan node and not a first-class one
 *
 * A staging preview is SDLC churn by definition: it exists for one review and
 * is meant to die. `fsh-guts` is the declared non-renderable graph for exactly
 * that (bean `t0i3`), and `UNPUBLISHED_GRAPH_TYPOLOGIES` keeps it out of every other
 * published artefact while `<base>/fsh-guts.jsonld` stays reachable BY NAME.
 * So these records are addressable without a crawler ever arriving at one by
 * following an edge — which is the property you want for something whose whole
 * point is that it is temporary.
 *
 * ## The node owns its lifecycle — that is the whole design
 *
 * Owner, 2026-09-19, on where the write and remove logic belongs: *"that's part
 * of the behaviour of that node type."*
 *
 * So creation, enrichment and retirement are functions HERE, and the things
 * that happen to touch a preview — the deploy, the label cleanup, the dispatch
 * cleanup, the health sweep — invoke them rather than each reimplementing the
 * rule. Put the rule in the workflow and there are three answers to "is this
 * preview still live", free to disagree.
 *
 * **This shape is already latent in the code, arrived at from the other
 * direction.** `previewLiveness` in `test/health/checks.ts` is a single
 * function called from both the sweep and the removal preflight, written that
 * way precisely so the two cannot disagree. What is missing is the declaration
 * saying the node type owns it, and a published document letting anything else
 * read the answer.
 *
 * ## Two moments know different things, and neither knows everything
 *
 * | | knows | does not know |
 * |---|---|---|
 * | deploy (`feature-staging.yml`) | branch, commit, PR, issue, host, built-at | size, liveness |
 * | sweep (`test/health/probes.ts`) | size, file count, liveness | the PR and issue |
 *
 * Hence {@link createStagingPreview} takes the first set and
 * {@link enrichStagingPreview} adds the second. The record exists from the
 * moment the preview does, which is what makes "cannot outlive the preview"
 * enforceable rather than aspirational: a record that only appears at the next
 * sweep cannot be checked against a preview that was removed before it.
 *
 * ## Retirement is a state, never a deletion
 *
 * Same rule as a bean's `scrapped` and a memory node's `archived`, and for the
 * same reason: a removed record leaves the next reader unable to tell
 * "deliberately cleaned up" from "lost". {@link retireStagingPreview} sets
 * `retiredOn` and a reason and keeps everything else, so the record of a
 * preview that is gone still says what it was for.
 *
 * ## Two measured facts about the trashcan — one since fixed, one still real
 *
 * Both were probed rather than assumed. When this module shipped they were
 * why it carried its own reader; one of them is now gone.
 *
 * 1. **FIXED 2026-09-20.** `FshGutsNodeSchema` was a plain `z.object`, so zod
 *    dropped unknown keys and `readFshGutsNode` returned a node with no
 *    `staging` at all, silently. It now carries `.passthrough()`: `kind` is
 *    open, so the field set could not stay closed.
 * 2. **STILL TRUE.** `schemas/kg/front-matter.ts` is a FLAT parser
 *    (`Record<string, string | string[]>`). A nested `staging:` block parses
 *    to `[]` before any schema sees it — so a markdown node survives the
 *    schema and still loses the data, which is worse than losing it outright
 *    because `[]` looks like an answer.
 *
 * (2) is why the carrier is JSON, and that has not changed. What has changed
 * is that `<base>/fsh-guts.jsonld` now DOES carry these records: the exporter
 * reads a JSON node of this graph and emits a kind's own fields under `data`.
 * The log exclusion is untouched — membership is still `$schema`, so a
 * `folio-log/v1` entry is excluded by what it says it is.
 *
 * {@link readStagingPreview} therefore stays as a TYPED reader — it returns a
 * `StagingPreviewNode` and refuses another kind by name — rather than as a
 * workaround for a reader that could not see the fields.
 */

import { z } from "zod";

import { FshGutsNodeSchema, FSH_GUTS_SCHEMA_ID } from "../kg/fsh-guts";
import { previewPath } from "./preview-prefix.ts";

/** The `kind` a trashcan node carries when it describes a staging preview. */
export const STAGING_PREVIEW_KIND = "staging-preview";

/**
 * What the DEPLOY knows. Every field here is available at build time and at no
 * other moment — the PR and the issue in particular, which cannot be recovered
 * from the slug later because slugification is deliberately not invertible
 * (`stagingSlug`: an ambiguous inverse on a finding whose action is "consider
 * removing this" would name the wrong thing).
 */
export const StagingDeployFactsSchema = z.object({
  /** The `branches/<slug>` path segment. Derived, never reversed. */
  slug: z.string().min(1),
  /** Branch the preview was built from. */
  branch: z.string().min(1),
  /** Head commit at build time. */
  commit: z.string().min(1),
  /** Pull request number, where the deploy was triggered by one. */
  pr: z.number().int().positive().optional(),
  /** Issue the pull request is for, where it names one. */
  issue: z.number().int().positive().optional(),
  /** ISO-8601. When the preview was built. */
  builtAt: z.string().min(1),
  /**
   * WHICH HOST rendered it — never assumed to be gh-pages.
   *
   * Bean `1lfx` is this field's own bean: a staging deployment must report
   * where it landed rather than letting a reader infer it from a convention
   * that holds today. Optional here because a deploy that cannot determine its
   * host must say nothing rather than guess, per the three-state rule.
   */
  host: z.string().min(1).optional(),
});
export type StagingDeployFacts = z.infer<typeof StagingDeployFactsSchema>;

/**
 * What the SWEEP knows. Measured by walking the publish branch, so it is only
 * ever as fresh as the last sweep — hence `observedAt`, without which a stale
 * size is indistinguishable from a current one.
 */
export const StagingSweepFactsSchema = z.object({
  bytes: z.number().int().nonnegative(),
  files: z.number().int().nonnegative(),
  /**
   * The liveness verdict, as `previewLiveness` returns it.
   *
   * A STRING rather than a boolean, because liveness has three states and the
   * third is the point: `live`, `dead`, and `unknown` for a sweep that could
   * not see one of its signals. A blind check rendered as `dead` is how a live
   * collaborator's preview gets deleted.
   */
  liveness: z.enum(["live", "dead", "unknown"]),
  /** Which signals fired, for a reader who wants to know WHY. */
  signals: z.array(z.string()).optional(),
  /** ISO-8601. When the sweep looked. */
  observedAt: z.string().min(1),
});
export type StagingSweepFacts = z.infer<typeof StagingSweepFactsSchema>;

/** The staging block a `staging-preview` node carries. */
export const StagingPreviewBlockSchema = StagingDeployFactsSchema.extend({
  /** Absent until the first sweep has looked at this preview. */
  observed: StagingSweepFactsSchema.optional(),
  /** ISO-8601. Set when the preview is removed; the node itself stays. */
  retiredOn: z.string().min(1).optional(),
  /** Why it was retired. Required in practice whenever `retiredOn` is set. */
  retiredReason: z.string().min(1).optional(),
});
export type StagingPreviewBlock = z.infer<typeof StagingPreviewBlockSchema>;

/**
 * A trashcan node whose subject is one staging preview.
 *
 * `.extend` rather than a parallel schema, so a `staging-preview` IS an
 * `fsh-guts` node: everything that reads the trashcan generically keeps
 * working, and only a reader that wants the staging block needs this module.
 */
export const StagingPreviewNodeSchema = FshGutsNodeSchema.extend({
  kind: z.literal(STAGING_PREVIEW_KIND),
  staging: StagingPreviewBlockSchema,
});
export type StagingPreviewNode = z.infer<typeof StagingPreviewNodeSchema>;

/**
 * Create the record, at deploy time.
 *
 * `movedFrom` carries the preview's URL when the host is known. The base
 * schema calls that field "the field that earns the schema" — without it a
 * trashcan node is an orphan, a reader seeing what it says and not where it
 * came from. For a preview, where it came from is where it was served.
 */
export function createStagingPreview(facts: StagingDeployFacts): StagingPreviewNode {
  const f = StagingDeployFactsSchema.parse(facts);
  return {
    $schema: FSH_GUTS_SCHEMA_ID,
    kind: STAGING_PREVIEW_KIND,
    title: `Staging preview — ${f.slug}`,
    movedOn: f.builtAt.slice(0, 10),
    ...(f.host ? { movedFrom: `${f.host.replace(/\/$/, "")}/${previewPath(f.slug)}/` } : {}),
    ...(f.issue === undefined ? {} : { issue: f.issue }),
    summary:
      `Review preview of \`${f.branch}\` at \`${f.commit.slice(0, 7)}\`` +
      (f.pr === undefined ? "" : `, for PR #${f.pr}`) +
      `. Built ${f.builtAt}.`,
    staging: f,
  };
}

/**
 * Add what only the sweep can measure.
 *
 * Returns a NEW node rather than mutating, so a caller cannot half-apply an
 * enrichment and leave a record that is neither the old one nor the new one.
 * Re-enriching is normal: every sweep overwrites `observed`, because the
 * previous sweep's size is not evidence about today.
 */
export function enrichStagingPreview(
  node: StagingPreviewNode,
  observed: StagingSweepFacts,
): StagingPreviewNode {
  return {
    ...node,
    staging: { ...node.staging, observed: StagingSweepFactsSchema.parse(observed) },
  };
}

/**
 * Retire the record. The node stays; `retiredOn` is what changes.
 *
 * Never a deletion — `deletion-requires-confirmation` and the never-delete rule
 * that governs the whole trashcan. A retired record still answers "what was
 * `branches/<slug>` for", which is exactly the question somebody asks after the
 * preview is gone and the link in a PR comment no longer resolves.
 *
 * Idempotent: retiring an already-retired node keeps the FIRST retirement, so a
 * cleanup that runs twice cannot rewrite when the preview actually went.
 */
export function retireStagingPreview(
  node: StagingPreviewNode,
  reason: string,
  at: string,
): StagingPreviewNode {
  if (node.staging.retiredOn !== undefined) return node;
  if (reason.trim() === "") {
    throw new Error(
      `staging-preview ${node.staging.slug}: retirement needs a reason — ` +
        `a record that says it is gone and not why is the ambiguity the ` +
        `never-delete rule exists to prevent`,
    );
  }
  return { ...node, staging: { ...node.staging, retiredOn: at, retiredReason: reason } };
}

/** Has this preview been retired? */
export function isRetired(node: StagingPreviewNode): boolean {
  return node.staging.retiredOn !== undefined;
}

/**
 * Serialise. **JSON, not markdown front matter**, and that is forced rather
 * than chosen.
 *
 * `schemas/kg/front-matter.ts` parses to `Record<string, string | string[]>` — a
 * FLAT map. A nested `staging:` block comes back as `[]`, measured, so every
 * structured field would be lost before any schema saw it. The trashcan's
 * markdown carrier was built for a note somebody dropped in; this record is
 * written by a workflow and read by a tool.
 *
 * The precedent is already here and named in `fsh-guts.ts`: a
 * `folio-workflow-instance/v1` declares itself at the JSON TOP LEVEL. Same
 * shape, same reason — extension is a coincidence, a declaration inside the
 * file is the contract.
 */
export function serializeStagingPreview(node: StagingPreviewNode): string {
  return `${JSON.stringify(StagingPreviewNodeSchema.parse(node), null, 2)}\n`;
}

/**
 * Read one, or a reason it is not a `staging-preview` node.
 *
 * A reason rather than a bare `undefined`, matching `readFshGutsNode`: "not a
 * staging preview" and "a staging preview that will not parse" want different
 * responses, and the second must never be reported as a clean skip.
 */
export function readStagingPreview(
  text: string,
): { node: StagingPreviewNode } | { node?: undefined; reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { reason: `is not JSON, so it is not a ${STAGING_PREVIEW_KIND} node` };
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { reason: `is JSON but not an object, so it declares nothing` };
  }
  const obj = raw as Record<string, unknown>;
  const declared = typeof obj["$schema"] === "string" ? (obj["$schema"] as string) : undefined;
  if (declared !== FSH_GUTS_SCHEMA_ID) {
    return {
      reason: declared
        ? `declares itself \`${declared}\`, which is not ${FSH_GUTS_SCHEMA_ID}`
        : `declares no $schema, so it is not a node of this graph`,
    };
  }
  const kind = typeof obj["kind"] === "string" ? (obj["kind"] as string) : undefined;
  if (kind !== STAGING_PREVIEW_KIND) {
    return {
      reason:
        `is a ${FSH_GUTS_SCHEMA_ID} node of kind \`${kind ?? "(none)"}\`, ` +
        `not \`${STAGING_PREVIEW_KIND}\``,
    };
  }
  const parsed = StagingPreviewNodeSchema.safeParse(obj);
  if (!parsed.success) {
    return {
      reason: `declares kind \`${STAGING_PREVIEW_KIND}\` but does not satisfy it: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"} ${i.message}`)
        .join("; ")}`,
    };
  }
  return { node: parsed.data };
}
