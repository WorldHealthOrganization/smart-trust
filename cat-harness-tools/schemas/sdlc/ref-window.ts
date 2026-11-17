#!/usr/bin/env bun
/**
 * A COALESCING WINDOW over a watched ref — the writes a steward batched into
 * one push, and nothing the host already knows.
 *
 * Several workflows pushing `gh-pages` in a burst each trigger a Pages
 * deployment, and each cancels the one in flight. A concurrency group cannot
 * coalesce a burst: GitHub **cancels a PENDING job when a newer one queues for
 * the same group** (`cancel-in-progress: false` governs only the RUNNING
 * job). A steward can.
 *
 * The discipline is in the skill, not here —
 * `sdlc/skills/sdlc-core/ref-stewardship.md` carries what makes a ref need a
 * steward, why a window is a different object from a hold, and the composition
 * rule with the case that must still be reported.
 *
 * ## A SIBLING of the merge queue's hold
 *
 * {@link HoldSchema} in `./merge-queue.ts` already has this object's shape:
 * a lease with an expiry. But a hold is keyed by `repository` + `pr` and a
 * window by **ref**, so it is a sibling type.
 *
 * | `HoldSchema` | here | why |
 * |---|---|---|
 * | `waitsOn` (NonBlank prose) | `ref` (a declared special branch) | a window always waits on *more arrivals to one ref*, so the free-text field becomes a typed one |
 * | `since` | `since` | identical |
 * | `expires` | `expires` | identical, and the same `expires > since` refusal |
 * | `handoff` | `handoff` | identical |
 *
 * ## Decisions are stored; facts are read live
 *
 * The rule {@link MergeQueueEntrySchema} enforces applies here unchanged, and
 * {@link FORBIDDEN_REF_FACT_KEYS} refuses the tempting keys **by name**.
 *
 * | stored here (a decision) | read live, never stored (the host's fact) |
 * |---|---|
 * | when the window opened, when it must close | the ref's tip SHA |
 * | who holds it, and who takes over | whether the last deployment succeeded |
 * | which routes were requested, by whom, when | whether the site is currently live |
 *
 * ## `expires` is set once, at open
 *
 * A window waits for the absence of a future event, so the clock is the only
 * thing that can end it. A window that extends on every arrival never closes,
 * which is why {@link RefWindowSchema} has no "extend".
 *
 * ## Committed state, for handover
 *
 * An instance lives in the declared `workflow-state` graph under
 * `beans/workflows/`, committed, so a steward that takes over reads the same
 * window rather than waiting forever or opening a second one.
 *
 * @module schemas/ref-window
 * @graphNode schema
 */
import { z } from "zod";

/** This file's own declaration of what it is — extension is a coincidence. */
export const REF_WINDOW_TAG = "folio-ref-window/v1";

/**
 * Keys a well-meaning writer reaches for first, and every one of them is the
 * host's to answer. Refused by name, with the rule as the message.
 *
 * `headSha` and friends are here for the same reason they are on a queue
 * entry; `deploymentState` and `live` are the ones specific to a published ref,
 * and they are exactly what bean `xom7` is about — a workflow that failed 30
 * times while reporting its own exit code. Whether a publish SUCCEEDED is a
 * judgement read live, never a field carried forward.
 */
export const FORBIDDEN_REF_FACT_KEYS = [
  "headSha",
  "head_sha",
  "sha",
  "tip",
  "tipSha",
  "tip_sha",
  "deployment",
  "deploymentState",
  "deployment_state",
  "deploymentConclusion",
  "conclusion",
  "live",
  "published",
  "siteAsOf",
  "site_as_of",
] as const;

const NonBlank = z.string().refine((s) => s.trim().length > 0, "must not be blank");

/** An ISO-8601 timestamp with a zone, as everywhere else in the work plan. */
const Instant = z.iso.datetime({ offset: true });

/**
 * A watched ref, spelled as a declaring directory's `storage.branch` spells it.
 *
 * Either the declared `id` (`gh-pages`, `beans`) or the full `name`
 * (`cat/cat-harness/beans`) — both are accepted because the declaration itself
 * carries both and callers legitimately hold either. What is NOT accepted is a
 * feature branch: a ref with one writer and no downstream serialisation needs
 * no steward, and giving it one adds a single point of failure for nothing.
 * That membership check is the declaration's job, not this regex's — see
 * the declaration schema (`DirectoryStorageSchema`) — so this only refuses the shapes
 * that could never be a declared ref.
 */
export const WatchedRefSchema = NonBlank.refine(
  (s) => !s.startsWith("claude/") && !s.startsWith("refs/"),
  "a watched ref is a declared branch (a directory's `storage`) — not a feature branch, and not a full refname",
);

/**
 * One write somebody asked for while the window was open.
 *
 * It records the ROUTE and who asked, never the content: the content is on the
 * ref after the push, and a copy here would be a second answer to what the
 * tree holds.
 */
export const WriteRequestSchema = z
  .object({
    /**
     * The route this write owns — `/` for the published site, `branches/<slug>/`
     * for a preview. Composition is per route: two different routes compose by
     * union, two of the same route take the newer.
     */
    route: NonBlank,
    /** Who asked — a workflow file, a session URL, or an actor id. */
    requestedBy: NonBlank,
    requestedAt: Instant,
    /**
     * Whether an AUTHOR wrote this route's content, as opposed to a generator
     * regenerating it.
     *
     * This is the field that keeps the discrimination the composition rule
     * exists for. "The newer generation wins" is correct for a regenerated page
     * and WRONG for authored content, so two same-route requests that are both
     * `authored` are a disagreement between two writers — reported, never
     * silently resolved by taking the newer. Defaults to `false` because every
     * route on a route-keyed store is regenerable by definition; a writer that
     * means otherwise has to say so.
     */
    authored: z.boolean().default(false),
  })
  .strict();
export type WriteRequest = z.infer<typeof WriteRequestSchema>;

const RefWindowObjectSchema = z
  .object({
    $schema: z.literal(REF_WINDOW_TAG),
    ref: WatchedRefSchema,
    /** Who holds the window — a session URL, `owner`, or an actor id. */
    heldBy: NonBlank,
    since: Instant,
    /**
     * The hard close. Set once, at open: there is no extend, because a window
     * that extends on every arrival never closes.
     */
    expires: Instant,
    /**
     * Who takes this window if the holder stops — the field that makes a
     * handover safe. Without it the next steward cannot tell "mine to close"
     * from "someone else's, in flight", and both wrong answers push twice.
     */
    handoff: NonBlank,
    requests: z.array(WriteRequestSchema).default([]),
    /**
     * When the steward actually performed the single write, if it has.
     *
     * Absent means open OR abandoned, and `expires` is what tells those apart —
     * which is the whole reason `expires` is required. A reader must never take
     * an absent `closedAt` for "still collecting".
     */
    closedAt: Instant.optional(),
  })
  .strict();

export const RefWindowSchema = z
  .looseObject({})
  .superRefine((raw: Record<string, unknown>, ctx) => {
    for (const key of FORBIDDEN_REF_FACT_KEYS) {
      if (key in raw) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message:
            `\`${key}\` is a fact the host owns. A ref window stores DECISIONS only — ` +
            `read it live when the steward acts, or snapshot it on a FINISHED window, ` +
            `never on an open one where it would be a claim about now.`,
        });
      }
    }
  })
  .pipe(RefWindowObjectSchema)
  .refine((w) => Date.parse(w.expires) > Date.parse(w.since), {
    message: "a window must expire after it opens",
    path: ["expires"],
  })
  .refine((w) => !w.closedAt || Date.parse(w.closedAt) >= Date.parse(w.since), {
    message: "a window cannot close before it opened",
    path: ["closedAt"],
  });
export type RefWindow = z.infer<typeof RefWindowObjectSchema>;

/**
 * The three lease fields this type shares with {@link HoldSchema}, verbatim.
 *
 * Declared here as the ONE list, and asserted against both schemas in
 * `ref-window.test.ts` — BEHAVIOURALLY, by removing each field and requiring
 * both to refuse. An earlier version of this reached into
 * `HoldSchema.def.innerType.shape` to compare key lists; it threw, because a
 * `.refine()` does not expose its inner object there. Reading a schema through
 * its own parse is the only method that cannot go stale against zod's
 * internals, and a parity check that throws is better than one that silently
 * compares two empty lists (the `dh4f` shape).
 *
 * `waitsOn` is deliberately absent — it is narrowed to `ref` here, and the
 * docblock's table above says why.
 */
export const SHARED_LEASE_FIELDS = ["since", "expires", "handoff"] as const;
