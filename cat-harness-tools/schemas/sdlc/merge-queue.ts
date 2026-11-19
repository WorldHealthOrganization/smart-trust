#!/usr/bin/env bun
/**
 * The MERGE QUEUE — what the merge steward DECIDED about each open pull
 * request, and nothing GitHub already knows.
 *
 * ## The core rule: decisions are stored, facts are read live
 *
 * **A queue entry records a decision. It never records a fact GitHub owns.**
 *
 * | stored here (a decision) | read live, never stored (GitHub's fact) |
 * |---|---|
 * | priority class, rank or override position | CI status of the head |
 * | the reason, who decided, when | mergeability (`clean`, `dirty`, `unstable`) |
 * | a hold, with its expiry | labels (`ready-to-merge`, `merge-main`) |
 * | the train it was assigned to | the head SHA |
 * | an ejection from a train, with its evidence link | the PR's own CI verdict, and whether CI saw the head |
 * | links to beans and epics | the changed-file list, and what it touches |
 *
 * A stored GitHub fact goes stale the moment anybody pushes. The steward
 * computes the right-hand column at decision time (`scripts/merge-queue.ts`
 * `deriveFacts`), and the queue tile joins it in the reader's browser at view
 * time; neither writes it back.
 *
 * {@link MergeQueueEntrySchema} enforces it structurally: the object is
 * `strict`, and the keys a well-meaning writer would reach for first
 * ({@link FORBIDDEN_FACT_KEYS}) are refused by name with this rule as the
 * message.
 *
 * **Where a fact MAY be written down:** as a dated evidence snapshot on a
 * FINISHED train run — a workflow instance of `Process_MergeTrain` under
 * `beans/workflows/` — recording what the steward saw when it acted
 * ({@link TrainMemberEvidenceSchema}).
 *
 * ## Where the fields come from
 *
 * - `ejection` — *eject a failing member and re-run the rest* (SQ19 §2.2:
 *   a failed batch is split and retried without the faulty change; §3.2: a
 *   refused change returns to its author *with the reason*). `evidenceUrl` is
 *   that reason's evidence.
 * - {@link MemberFactsSchema}`.authoredPaths` / `.touchesShared` — *predict
 *   which PRs conflict, cheap form* (SQ19 §5.2: decide independence from the
 *   build graph); generated paths are excluded, or every pair predicts as
 *   conflicting. COMPUTED live from the PR's file list, never stored.
 * - {@link MemberFactsSchema}`.ownCi` / `.headShaMatchesCi` — *attribute a
 *   red train from each member's own CI before bisecting*. GitHub facts: read
 *   live, or snapshotted on a finished run only.
 *
 * SQ19 = Ananthanarayanan et al., *Keeping Master Green at Scale*, EuroSys '19.
 *
 * ## What it is not
 *
 * Not GitHub's merge queue — that is unavailable on a personal-account
 * repository. Not the order itself: the order is COMPUTED, by
 * `processes/decisions/merge-priority.dmn` over live facts, and an entry
 * records the outcome the steward acted on, or an owner override with its
 * reason. Not the merge SOP (`merge-manager`) nor the gates: those say how a
 * merge is done and what it must prove; this says which PR goes next and why.
 *
 * @module cat-harness/schemas/merge-queue
 * @graphNode schema
 */
import { z } from "zod";

/** The tag every queue entry carries, so the file declares what it is. */
export const MERGE_QUEUE_ENTRY_TAG = "folio-merge-queue-entry/v1";

/**
 * The priority classes the reprioritisation table can return, in the order a
 * train takes them. `override` is the owner's; `hand-back` is not a place in a
 * train at all but a route out of it (to `merge-refusal.bpmn`, PR #1888).
 *
 * The table (`merge-priority.dmn`) is the authority for which class a PR gets;
 * this list is the vocabulary it may answer in, and
 * `tests/merge-priority-table.test.ts` asserts the two agree.
 *
 * **That last sentence was false until 2026-10-04**, and it cost the table its
 * only caller. `PRIORITY_CLASSES` was referenced from nowhere but this file: no
 * test compared it with the diagram, and `ci-not-green` — which rule 3 returns
 * for any PR whose CI is not green, so most of them — was missing here. The
 * first `placeAll` ever run against the live queue died in `PriorityClassSchema
 * .parse`. A docblock that claims a test is not a test, and the claim is worse
 * than silence because a reader checking whether the two agreed would have
 * found the promise and stopped looking.
 */
export const PRIORITY_CLASSES = [
  "override",
  "harness-seed",
  "unblocker",
  "mvp",
  "standard",
  "hand-back",
  /** Rule 3: handed back because its own CI is not green — a different reason from a refusal. */
  "ci-not-green",
] as const;
export const PriorityClassSchema = z.enum(PRIORITY_CLASSES);

/** The values of {@link MemberFactsSchema}`.readiness`, in the order a PR moves through them. */
export const READINESS = ["ready", "draft", "not-main", "no-marker", "foreign-marker", "stale-marker"] as const;
export type Readiness = (typeof READINESS)[number];
export type PriorityClass = z.infer<typeof PriorityClassSchema>;

/**
 * Keys that name a GitHub-owned fact. Refused on a queue entry BY NAME, so the
 * writer is told the rule rather than that a key is unrecognised. None of
 * these values is trustworthy once stored; `mergeable_state` in particular can
 * serve a pre-merge view (bean `fx5r`), which is why it is read live.
 */
export const FORBIDDEN_FACT_KEYS = [
  "headSha",
  "head_sha",
  "sha",
  "ci",
  "ciStatus",
  "ci_status",
  "checks",
  "ownCi",
  "own_ci",
  "headShaMatchesCi",
  "head_sha_matches_ci",
  "mergeable",
  "mergeableState",
  "mergeable_state", // read live only: bean `fx5r` measured it serving a pre-merge view
  "labels",
  "draft",
  "baseRef",
  "readySha",
  "readyBy",
  "readiness", // bean `uoob`: a comment can be edited and a PR re-drafted at any time
  "authoredPaths",
  "authored_paths",
  "touchesShared",
  "touches_shared",
  "files",
] as const;

const NonBlank = z.string().refine((s) => s.trim().length > 0, "must not be blank");

/** An ISO-8601 timestamp with a zone, as everywhere else in the work plan. */
const Instant = z.iso.datetime({ offset: true });

/** A bean id as the store writes it, e.g. `folio-assistant-hfag`. */
export const BeanIdSchema = z
  .string()
  .regex(/^[a-z0-9-]+-[a-z0-9]{4}$/, "a bean id such as `folio-assistant-hfag`");

/**
 * Where the PR sits, and on whose authority.
 *
 * `computed` — the reprioritisation table decided: the rule that fired, the
 * class and rank it returned. The rule id is the reason a reader can check.
 *
 * `override` — the owner placed it by hand. **Refused without a `reason`**:
 * an override nobody can explain is indistinguishable from a mistake, and the
 * next steward could neither honour nor safely undo it. The same rule the
 * process engine applies to a hand-supplied gateway outcome, which it refuses
 * unless it comes in as the table's owner-override input.
 */
export const PlacementSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("computed"),
      /** The decision table that placed it, `file.dmn#Decision_Id`. */
      decision: NonBlank,
      /** The rule id that fired, e.g. `Rule_HarnessSmallClean`. */
      rule: NonBlank,
      class: PriorityClassSchema,
      /** Lower goes first. Ties break on PR number, oldest first. */
      rank: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("override"),
      /** 1-based position in the queue the owner asked for. */
      position: z.number().int().positive(),
      /** Why. Required, non-blank: the schema's one hard refusal. */
      reason: NonBlank,
    })
    .strict(),
]);
export type Placement = z.infer<typeof PlacementSchema>;

/**
 * A hold — the entry stays in the queue but is not taken into a train.
 *
 * The four fields of `bean-blocking`'s `## Blocked on`, and for its reason: a
 * hold with no expiry cannot be told from an abandoned one. `expires` must be
 * after `since`.
 */
export const HoldSchema = z
  .object({
    waitsOn: NonBlank,
    since: Instant,
    expires: Instant,
    handoff: NonBlank,
  })
  .strict()
  .refine((h) => Date.parse(h.expires) > Date.parse(h.since), {
    message: "a hold must expire after it starts",
    path: ["expires"],
  });
export type Hold = z.infer<typeof HoldSchema>;

/**
 * The PR was taken out of a train (T1; R3, R4 — see the module docblock).
 * A DECISION about the PR, so it is stored; the CI run it points at is the
 * evidence, and stays GitHub's.
 */
export const EjectionSchema = z
  .object({
    trainId: NonBlank,
    /** What the steward concluded, e.g. "own CI red on `docs:harness:check`". */
    reason: NonBlank,
    /** The run, comment or log that shows it. */
    evidenceUrl: z.url(),
    at: Instant,
  })
  .strict();
export type Ejection = z.infer<typeof EjectionSchema>;

/** A full git object name — the commit a decision was given FOR. */
const ObjectName = z.string().regex(/^[0-9a-f]{40}$/, "a full 40-character object name");

/**
 * On whose word the release rests — quoted VERBATIM, with where it was said.
 *
 * `explicit` — the person said it about THIS pull request ("merge #2077").
 * `standing-ruling` — a general ruling the decision invokes ("you may merge
 * green PRs"), with the date it was ruled, because `merge-to-main.bpmn`
 * (formerly `Task_Release` in `merge-train.bpmn`) accepts a standing ruling
 * only when the steward "quotes [it] verbatim with its date".
 * A paraphrase is refused by construction: there is no field for one.
 */
export const ReleaseAuthoritySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("explicit"), quote: NonBlank, source: z.url() }).strict(),
  z
    .object({
      kind: z.literal("standing-ruling"),
      quote: NonBlank,
      ruledAt: z.iso.date(),
      source: z.url(),
    })
    .strict(),
]);
export type ReleaseAuthority = z.infer<typeof ReleaseAuthoritySchema>;

/**
 * A PERSON's decision to merge this pull request — or not to (bean `ixmq`;
 * spec from the zmdo session, adopted by the Merge Manager 2026-10-04).
 *
 * Before this, `Task_Release` in `merge-train.bpmn` required "explicit
 * confirmation before merging to `main`, or a standing ruling the steward
 * quotes verbatim with its date" and nothing could hold it: the approval
 * lived in a chat, and nothing bound it to the code it approved. Measured the
 * same day: #2059, #2070 and #2075 each changed head between the steward's
 * green check and the merge.
 *
 * ## `releasedSha` is a decision's SCOPE, not a fact about now
 *
 * {@link FORBIDDEN_FACT_KEYS} refuses `headSha` because a stored head goes
 * stale on the next push. `releasedSha` is the opposite claim: it does not say
 * what the head IS, it says which commit the person said yes TO — so a later
 * push does not make it wrong, it makes it **void** ({@link releaseCovers}).
 * Named differently on purpose, so the fact rule still holds by name.
 *
 * `decidedBy` is the HUMAN. The agent that wrote the record down is
 * `capturedBy`; an agent recording its own decision as a person's is the one
 * thing this record exists to make impossible to do quietly.
 *
 * No `hold` verdict: a hold is already {@link HoldSchema}, with the expiry
 * and handoff a verdict field would lack.
 */
export const ReleaseSchema = z
  .object({
    verdict: z.enum(["merge", "do-not-merge"]),
    decidedBy: NonBlank,
    decidedAt: Instant,
    authority: ReleaseAuthoritySchema,
    releasedSha: ObjectName,
    capturedBy: NonBlank,
    reason: NonBlank.optional(),
  })
  .strict()
  .refine((r) => r.decidedBy !== r.capturedBy, {
    message: "decidedBy is the person who decided; capturedBy is who wrote it down — they cannot be the same actor",
    path: ["decidedBy"],
  });
export type Release = z.infer<typeof ReleaseSchema>;

/**
 * Whether the recorded release lets THIS head be merged — the question
 * `merge:guard` asks before it lands anything. Never `ok` on an absent
 * release: no decision is not a yes.
 */
export function releaseCovers(
  entry: Pick<MergeQueueEntry, "release"> | undefined,
  headSha: string,
): { ok: true } | { ok: false; why: "none" | "do-not-merge" | "void"; detail: string } {
  const r = entry?.release;
  if (!r) return { ok: false, why: "none", detail: "no human release is recorded for this pull request" };
  if (r.verdict === "do-not-merge") {
    return { ok: false, why: "do-not-merge", detail: `${r.decidedBy} decided not to merge (${r.decidedAt})` };
  }
  if (r.releasedSha !== headSha) {
    return {
      ok: false,
      why: "void",
      detail: `released at ${r.releasedSha.slice(0, 12)}, head is now ${headSha.slice(0, 12)} — the decision was for different code`,
    };
  }
  return { ok: true };
}

/**
 * Where the steward believes the PR stands, as a DECISION it records rather
 * than a GitHub fact. Owner, 2026-10-04: *"review all open PRs.... anything
 * not in merge queue? put in as status unknown any found. then try to figure
 * out where they are, what's stale"*.
 *
 * - `unknown`: the steward found the PR open and not in the queue; triage pending.
 * - `active`: its author pushed or commented within the stale window.
 * - `waiting-on-author`: handed back with a named ask, author not yet back.
 * - `blocked`: waits on another PR, bean or ruling, named in `reason`.
 * - `stale`: no push and no human comment for longer than the stale window.
 * - `approval-void`: the owner approved it, then its scope changed.
 * - `landed`: merged; the entry is kept as history, not deleted.
 */
export const QUEUE_STATUSES = [
  "unknown",
  "active",
  "waiting-on-author",
  "blocked",
  "stale",
  "approval-void",
  "landed",
] as const;
export const QueueStatusSchema = z.enum(QUEUE_STATUSES);
export type QueueStatus = z.infer<typeof QueueStatusSchema>;

const EntryObjectSchema = z
  .object({
    $schema: z.literal(MERGE_QUEUE_ENTRY_TAG),
    /** `owner/name` — a PR number means nothing without its repository. */
    repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "`owner/name`"),
    pr: z.number().int().positive(),
    placement: PlacementSchema,
    /** Why this placement, in a sentence. For `computed`, the rule's description will do. */
    reason: NonBlank,
    /** Who decided — a session URL, `owner`, or an actor id. */
    decidedBy: NonBlank,
    decidedAt: Instant,
    hold: HoldSchema.optional(),
    /** Assigned once the PR is taken into a train; the train-run instance's id. */
    trainId: NonBlank.optional(),
    ejection: EjectionSchema.optional(),
    /** A person's decision to merge, or not — {@link ReleaseSchema}. */
    release: ReleaseSchema.optional(),
    /** The steward's triage verdict (see {@link QUEUE_STATUSES}). Absent on entries written before it existed. */
    status: QueueStatusSchema.optional(),
    /** Beans and epics this PR serves. Epics are beans, so one list. */
    beans: z.array(BeanIdSchema).default([]),
  })
  .strict();

/**
 * One queue entry, one file: `<merge-queue>/<owner>--<repo>--<pr>.json`.
 *
 * Refuses a GitHub fact by name first (the core rule), then parses strictly.
 */
export const MergeQueueEntrySchema = z
  .looseObject({})
  .superRefine((raw, ctx) => {
    for (const key of FORBIDDEN_FACT_KEYS) {
      if (key in raw) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message:
            `\`${key}\` is a fact GitHub owns. The merge queue stores DECISIONS only — ` +
            `read it live at decision or render time, or snapshot it on a finished ` +
            `train run (TrainMemberEvidenceSchema), never on a queue entry.`,
        });
      }
    }
  })
  .pipe(EntryObjectSchema);
export type MergeQueueEntry = z.infer<typeof EntryObjectSchema>;

/**
 * The live facts about one PR that the reprioritisation table reads.
 *
 * COMPUTED at decision time from GitHub and the checkout, NEVER stored on an
 * entry (see {@link FORBIDDEN_FACT_KEYS}). Declared here so the writer of the
 * facts (`merge:overlap`, branch `claude/merge-pipeline-tools`) and the reader
 * (the table, the tile) agree on one set of names.
 */
export const MemberFactsSchema = z
  .object({
    pr: z.number().int().positive(),
    /** Changed paths a declared merge pattern would REFUSE — the authored ones (T3, R7). */
    authoredPaths: z.array(z.string()),
    /** Touches a shared declaration: a schema, generator, `<instance>.json`, BPMN or DMN (T3, R6). */
    touchesShared: z.boolean(),
    /**
     * An authored path under `cat-harness/` or its tools layer's directory. The raw
     * measurement behind input (a) — NOT input (a) itself: measured
     * 2026-10-02, it was true for 11 of the 11 PRs in that day's queue.
     */
    touchesHarness: z.boolean(),
    /**
     * Input (a): `touchesHarness` AND a linked bean descends from the
     * separation goal — the PR seeds the staging repos, which is the reason
     * the owner gave for (a). See `merge-priority.dmn`'s note.
     */
    seedsStaging: z.boolean(),
    /** Open PRs or beans this unblocks, or tangle edges it removes — input (b). */
    unblocks: z.number().int().nonnegative(),
    /** Tagged MVP / feature-priority, by epic or label — input (c). */
    mvp: z.boolean(),
    /** Changed files plus changed lines, banded — input (d). */
    sizeBand: z.enum(["small", "large"]),
    /**
     * Shares an AUTHORED path with another live queued PR — input (d), T3.
     *
     * Read {@link overlapKind} for which kind of collision it is. This field
     * said "or a shared declaration" until 2026-10-02 and the code never did:
     * `deriveFacts` compares `authoredPaths` only. A shared declaration is
     * carried separately by {@link touchesShared}, as its own DMN input, and
     * conflating them here would have made every pair that merely edits
     * `package.json` look like a pair needing a train.
     */
    conflictRisk: z.enum(["low", "high"]),
    /**
     * WHICH KIND of collision this PR has with the rest of the live queue.
     *
     * `conflictRisk` answers "is there one"; a steward building a train needs
     * "is it the kind a train is for". `merge:overlap` measured the gap on
     * 2026-10-02 across all 36 open PRs (459 pairs): **#1907 × #1909 have
     * `authored_overlap = 0` yet `independent: false`**, colliding only on
     * generated regions and shared declarations. A train built for that pair
     * is a train nobody needed, because regeneration resolves it.
     *
     * | value | means | what it needs |
     * |---|---|---|
     * | `none` | no path shared with any live member | nothing |
     * | `generated-only` | shares paths, every one resolved by a declared pattern | **regeneration**, not a train |
     * | `shared-declaration` | the only authored paths shared are shared DECLARATIONS | **coordination** — order them, do not train them |
     * | `authored` | shares an authored path that is not a declaration | **a train** |
     *
     * Four values, not three, and the reason is measured. A shared
     * declaration is a SUBSET of an authored path, not a sibling of one:
     * `classify("package.json").strategy` is `refuse`, so it is authored,
     * **and** `isSharedDeclaration("package.json")` is true (both measured
     * 2026-10-02). A three-value partition therefore files #1907 × #1909
     * under `authored` on the strength of `package.json` alone, which is
     * precisely the train nobody needed.
     *
     * By contrast `cat-harness/sdlc/skills/sdlc-core/merge-queue.md` is
     * `refuse` and NOT a shared declaration — a real content collision, and
     * the only one of the three that a train is the right answer to.
     *
     * The order is significant and the values are a partition: `authored`
     * wins over `shared-declaration`, which wins over `generated-only`,
     * because at each step the earlier kind is the one that cannot be
     * resolved by the later kind's remedy.
     */
    overlapKind: z.enum(["none", "generated-only", "shared-declaration", "authored"]),
    /** A declared merge pattern refuses a conflicted path, or GitHub reports it dirty. */
    refused: z.boolean(),
    /**
     * The PR's own CI on its head: T2's first evidence.
     *
     * **`green` means every workflow OWED FOR THE EVENT ran and succeeded** —
     * never "nothing is red". The three non-green states are kept apart
     * because collapsing any two of them is the defect, and they are exactly
     * the states `check-head-has-run.ts` distinguishes (bean `3pqn`):
     *
     * | value | means | `check:head-has-run` |
     * |---|---|---|
     * | `green` | every owed run present and successful | exit 0 |
     * | `red` | an owed run ran and failed | — |
     * | `missing-required` | it HAS runs, but not the ones owed | exit 1 |
     * | `none` | GitHub answered and nothing names this head | exit 1 |
     * | `unknown` | could not ask: no network, rate limit, HTTP error | exit 2 |
     *
     * `missing-required` is the value this enum existed without, and its
     * absence is why a steward could read a partial check set as a pass.
     * Measured 2026-10-02 on #1889's head `7ab6119405`: 9 check runs, all 9
     * gating job NAMES present, 3 of them `in_progress` with `conclusion:
     * null`, and 3 check SUITES `completed` with `conclusion:
     * action_required` and `latest_check_runs_count: 0` — suites that
     * completed having executed nothing. A filter for `conclusion ==
     * "failure"` finds zero. Counting runs does not catch it either; only
     * asking which runs are OWED does.
     *
     * **`unknown` is never a pass, and never a failure.** Telling somebody
     * their head is unverified when you merely could not look trains them to
     * ignore the signal, which costs more than the gap.
     */
    ownCi: z.enum(["green", "red", "missing-required", "none", "unknown"]),
    /** Did CI run on the head that would be merged (T2; bean `u7be` item 3). */
    headShaMatchesCi: z.boolean(),
    /**
     * Has the OWNING session signalled this PR is finished, against `main`?
     * Bean `uoob` (merge gate (f)), read by `Rule_NotReady`. `ready` is the
     * only admitting value, and the others stay apart because each has a
     * different remedy:
     *
     * | value | means | real case, 2026-10-03 |
     * |---|---|---|
     * | `ready` | not a draft, on `main`, and a `ready: <sha>` signed by the PR's own session names the head | — |
     * | `draft` | still a draft | — |
     * | `not-main` | based on another branch | #1937, on #1764's head after #1764 merged |
     * | `no-marker` | no `ready:` comment | #1960, #1957 |
     * | `foreign-marker` | the marker is unsigned, or signed by another session | #1937's was unsigned |
     * | `stale-marker` | the head moved past the marker | #1937 |
     *
     * Coarser than `merge:guard` on purpose: it cannot see that the commits
     * after a stale marker are merge-main bot merges, so it hands those back
     * where the guard would pass them. The guard is the gate; this keeps an
     * unfinished PR out of a train.
     */
    readiness: z.enum(READINESS),
  })
  .strict();
export type MemberFacts = z.infer<typeof MemberFactsSchema>;

/**
 * A DATED snapshot of the facts the steward acted on, for one member of a
 * FINISHED train run. Written into that run's workflow instance as evidence;
 * never onto a queue entry. `observedAt` is what makes it history rather than
 * a claim about now.
 */
export const TrainMemberEvidenceSchema = z
  .object({
    pr: z.number().int().positive(),
    headSha: z.string().regex(/^[0-9a-f]{40}$/, "a full 40-character object name"),
    ownCi: z.enum(["green", "red", "none"]),
    headShaMatchesCi: z.boolean(),
    observedAt: Instant,
    outcome: z.enum(["merged", "ejected", "handed-back", "held"]),
    evidenceUrl: z.url().optional(),
  })
  .strict();
export type TrainMemberEvidence = z.infer<typeof TrainMemberEvidenceSchema>;

/**
 * The tag every would-have-blocked record carries.
 */
export const WOULD_HAVE_BLOCKED_TAG = "folio-would-have-blocked/v1";

/**
 * Adjudication verdict given by a human for an agentic review warning.
 *
 * "unknown" is strictly kept as a third state — never folded into true positive
 * (which would artificially deflate FPR) or false positive (which would
 * artificially inflate FPR).
 */
export const HUMAN_VERDICTS = ["true_positive", "false_positive", "unknown"] as const;
export const HumanVerdictSchema = z.enum(HUMAN_VERDICTS);
export type HumanVerdict = (typeof HUMAN_VERDICTS)[number];

/**
 * An individual finding from an agentic reviewer evaluated under the
 * warn-only pre-merge review regime.
 */
export const WouldHaveBlockedFindingSchema = z
  .object({
    id: NonBlank,
    rule: NonBlank,
    severity: z.literal("blocking"),
    explanation: NonBlank,
    humanVerdict: HumanVerdictSchema.optional(),
  })
  .strict();
export type WouldHaveBlockedFinding = z.infer<typeof WouldHaveBlockedFindingSchema>;

/**
 * Summary metrics of would-have-blocked findings on an evaluated PR.
 *
 * `empiricalFpr` is undefined if no findings have received a conclusive
 * human adjudication (i.e. confirmedTruePositives + confirmedFalsePositives === 0).
 */
export const WouldHaveBlockedMetricsSchema = z
  .object({
    warnedFindings: z.number().int().nonnegative(),
    confirmedTruePositives: z.number().int().nonnegative(),
    confirmedFalsePositives: z.number().int().nonnegative(),
    unknownCount: z.number().int().nonnegative(),
    empiricalFpr: z.number().min(0).max(1).optional(),
  })
  .strict();
export type WouldHaveBlockedMetrics = z.infer<typeof WouldHaveBlockedMetricsSchema>;

/**
 * An ISO date or date-time string validator that accepts standard ISO strings.
 */
const IsoDateString = z.string().refine((s) => {
  if (typeof s !== "string" || s.trim().length === 0) return false;
  return !isNaN(Date.parse(s));
}, "must be a valid ISO date or date-time string");

/**
 * A `would-have-blocked` record per warned PR, bound to the head SHA.
 *
 * Bean `h1uq`. Owner ruled agentic merge review warn-only on 2026-10-02/03.
 * Promotion to a hard gate requires an empirical false-positive rate (FPR),
 * which no published paper reports and only a counterfactual warn-only phase
 * can observe.
 */
export const WouldHaveBlockedRecordSchema = z
  .object({
    $schema: z.literal(WOULD_HAVE_BLOCKED_TAG).optional(),
    headSha: ObjectName,
    prNumber: z.number().int().positive(),
    evaluatedAt: IsoDateString,
    findings: z.array(WouldHaveBlockedFindingSchema),
    metrics: WouldHaveBlockedMetricsSchema,
  })
  .strict();
export type WouldHaveBlockedRecord = z.infer<typeof WouldHaveBlockedRecordSchema>;

/**
 * Criteria required to promote an agentic reviewer from warn-only to a blocking gate.
 *
 * Must be registered BEFORE data collection to prevent choosing thresholds to fit data.
 */
export const AgenticPromotionCriteriaSchema = z
  .object({
    /** Minimum number of PRs evaluated under warn-only mode (default 50). */
    minimumPrWindow: z.number().int().positive(),
    /** Maximum allowed empirical false-positive rate (default 0.05 / 5%). */
    maximumFalsePositiveRate: z.number().min(0).max(1),
    /** Minimum share of findings with conclusive (non-unknown) human adjudication (default 0.80 / 80%). */
    minimumReviewCoverage: z.number().min(0).max(1),
  })
  .strict();
export type AgenticPromotionCriteria = z.infer<typeof AgenticPromotionCriteriaSchema>;

/** Default pre-registered promotion criteria: 50 PR window, <= 5% FPR, >= 80% coverage. */
export const DEFAULT_AGENTIC_PROMOTION_CRITERIA: AgenticPromotionCriteria = {
  minimumPrWindow: 50,
  maximumFalsePositiveRate: 0.05,
  minimumReviewCoverage: 0.8,
};

/**
 * Compute would-have-blocked metrics from a list of findings.
 * Strictly maintains "unknown" as a third state without folding into true or false positive.
 */
export function calculateWouldHaveBlockedMetrics(
  findings: readonly WouldHaveBlockedFinding[],
): WouldHaveBlockedMetrics {
  const warnedFindings = findings.length;
  let confirmedTruePositives = 0;
  let confirmedFalsePositives = 0;
  let unknownCount = 0;

  for (const f of findings) {
    if (f.humanVerdict === "true_positive") {
      confirmedTruePositives++;
    } else if (f.humanVerdict === "false_positive") {
      confirmedFalsePositives++;
    } else {
      unknownCount++;
    }
  }

  const adjudicatedCount = confirmedTruePositives + confirmedFalsePositives;
  const empiricalFpr = adjudicatedCount > 0 ? confirmedFalsePositives / adjudicatedCount : undefined;

  return {
    warnedFindings,
    confirmedTruePositives,
    confirmedFalsePositives,
    unknownCount,
    ...(empiricalFpr !== undefined ? { empiricalFpr } : {}),
  };
}

export interface PromotionEvaluationResult {
  decision: "promote_to_block" | "remain_warn_only";
  promoted: boolean;
  metrics: {
    prCount: number;
    totalWarnedFindings: number;
    totalConfirmedTruePositives: number;
    totalConfirmedFalsePositives: number;
    totalUnknownCount: number;
    reviewCoverage: number;
    empiricalFpr?: number;
  };
  checks: {
    prWindowMet: boolean;
    reviewCoverageMet: boolean;
    falsePositiveRateMet: boolean;
  };
  reasons: string[];
}

/**
 * Evaluates whether a set of would-have-blocked records satisfies the criteria
 * for promoting the agentic review gate from warn-only to blocking.
 */
export function evaluateAgenticPromotion(
  records: readonly WouldHaveBlockedRecord[],
  criteria: AgenticPromotionCriteria = DEFAULT_AGENTIC_PROMOTION_CRITERIA,
): PromotionEvaluationResult {
  const prCount = records.length;
  const totalWarnedFindings = records.reduce((acc, r) => acc + r.metrics.warnedFindings, 0);
  const totalConfirmedTruePositives = records.reduce((acc, r) => acc + r.metrics.confirmedTruePositives, 0);
  const totalConfirmedFalsePositives = records.reduce((acc, r) => acc + r.metrics.confirmedFalsePositives, 0);
  const totalUnknownCount = records.reduce((acc, r) => acc + r.metrics.unknownCount, 0);

  const totalAdjudicated = totalConfirmedTruePositives + totalConfirmedFalsePositives;
  const reviewCoverage = totalWarnedFindings > 0 ? totalAdjudicated / totalWarnedFindings : 1.0;
  const empiricalFpr = totalAdjudicated > 0 ? totalConfirmedFalsePositives / totalAdjudicated : undefined;

  const prWindowMet = prCount >= criteria.minimumPrWindow;
  const reviewCoverageMet = reviewCoverage >= criteria.minimumReviewCoverage;
  const falsePositiveRateMet = empiricalFpr !== undefined && empiricalFpr <= criteria.maximumFalsePositiveRate;

  const promoted = prWindowMet && reviewCoverageMet && falsePositiveRateMet;
  const reasons: string[] = [];

  if (!prWindowMet) {
    reasons.push(
      `PR window not met: evaluated ${prCount} PRs, minimum required is ${criteria.minimumPrWindow}.`,
    );
  }
  if (!reviewCoverageMet) {
    reasons.push(
      `Review coverage not met: ${(reviewCoverage * 100).toFixed(1)}% adjudicated (${totalAdjudicated}/${totalWarnedFindings}), minimum required is ${(criteria.minimumReviewCoverage * 100).toFixed(1)}%.`,
    );
  }
  if (empiricalFpr === undefined) {
    reasons.push("No adjudicated findings available to calculate empirical false-positive rate.");
  } else if (!falsePositiveRateMet) {
    reasons.push(
      `Empirical false-positive rate not met: ${(empiricalFpr * 100).toFixed(1)}% (${totalConfirmedFalsePositives}/${totalAdjudicated}) exceeds maximum threshold of ${(criteria.maximumFalsePositiveRate * 100).toFixed(1)}%.`,
    );
  }

  if (promoted) {
    reasons.push(
      `All criteria met: PR window (${prCount} >= ${criteria.minimumPrWindow}), review coverage (${(reviewCoverage * 100).toFixed(1)}% >= ${(criteria.minimumReviewCoverage * 100).toFixed(1)}%), and empirical FPR (${(empiricalFpr! * 100).toFixed(1)}% <= ${(criteria.maximumFalsePositiveRate * 100).toFixed(1)}%).`,
    );
  }

  return {
    decision: promoted ? "promote_to_block" : "remain_warn_only",
    promoted,
    metrics: {
      prCount,
      totalWarnedFindings,
      totalConfirmedTruePositives,
      totalConfirmedFalsePositives,
      totalUnknownCount,
      reviewCoverage,
      ...(empiricalFpr !== undefined ? { empiricalFpr } : {}),
    },
    checks: {
      prWindowMet,
      reviewCoverageMet,
      falsePositiveRateMet,
    },
    reasons,
  };
}


// ---------------------------------------------------------------------------
// The merge request a sibling sends the merge manager
// ---------------------------------------------------------------------------

/**
 * The six-line merge request (owner, 2026-11-07: "anything that indicated to
 * merge should have link to PR, claude session, explanation of changes,
 * preview URL"; "put that in chat then ask to merge by card"). A sibling
 * sends it; the merge manager posts it in its chat, then asks the owner by
 * card, and sends back a request with no rendered preview and no reason.
 *
 * It is a MESSAGE, not a queue entry: it carries the head SHA it was green
 * at, which {@link MergeQueueEntrySchema} must never store.
 *
 * The text form, one labelled line each, in this order:
 *
 * ```
 * ready: https://github.com/<owner>/<repo>/pull/<n> <40-hex head sha>
 * session: https://claude.ai/code/session_<id>
 * changes: <1-3 sentences>
 * preview: <rendered URL>          (or)   no preview: <reason>
 * look for: <what to check in the preview>
 * full tier green as judged
 * ```
 */
export const MERGE_REQUEST_GREEN_LINE = "full tier green as judged";

/** At most this many sentences in `changes`. */
export const MERGE_REQUEST_MAX_SENTENCES = 3;

const sentenceCount = (text: string): number =>
  text.split(/(?<=[.!?])\s+(?=\S)/).filter((s) => s.trim().length > 0).length;

export const MergeRequestPreviewSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: z.string().url() }).strict(),
  z.object({ kind: z.literal("none"), reason: z.string().trim().min(1) }).strict(),
]);
export type MergeRequestPreview = z.infer<typeof MergeRequestPreviewSchema>;

export const MergeRequestSchema = z
  .object({
    prUrl: z.string().regex(/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+$/, "a GitHub pull request URL"),
    headSha: z.string().regex(/^[0-9a-f]{40}$/, "the full 40-hex head SHA"),
    sessionUrl: z.string().regex(/^https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]+$/, "a claude.ai session URL"),
    changes: z
      .string()
      .trim()
      .min(1)
      .refine((t) => sentenceCount(t) <= MERGE_REQUEST_MAX_SENTENCES, {
        message: `the changes in at most ${MERGE_REQUEST_MAX_SENTENCES} sentences`,
      }),
    preview: MergeRequestPreviewSchema,
    /** What to look for in the preview. Required when there is one. */
    lookFor: z.string().trim().min(1).optional(),
    /** The sender's statement that the full tier is green as judged (every judge). */
    fullTierGreen: z.literal(true),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.preview.kind === "url" && !r.lookFor) {
      ctx.addIssue({ code: "custom", path: ["lookFor"], message: "say what to look for in the preview" });
    }
  });
export type MergeRequest = z.infer<typeof MergeRequestSchema>;

/** The six lines of a {@link MergeRequest}, in order. */
export function formatMergeRequest(r: MergeRequest): string {
  return [
    `ready: ${r.prUrl} ${r.headSha}`,
    `session: ${r.sessionUrl}`,
    `changes: ${r.changes}`,
    r.preview.kind === "url" ? `preview: ${r.preview.url}` : `no preview: ${r.preview.reason}`,
    `look for: ${r.lookFor ?? "-"}`,
    MERGE_REQUEST_GREEN_LINE,
  ].join("\n");
}

/**
 * Read a merge request from a message. Lines may come in any order and
 * other lines are ignored; what is missing or malformed is reported by
 * {@link MergeRequestSchema}, so the merge manager can send it back with
 * the reason.
 */
export function parseMergeRequest(text: string): ReturnType<typeof MergeRequestSchema.safeParse> {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const after = (label: string): string | undefined => {
    const line = lines.find((l) => l.toLowerCase().startsWith(`${label}:`));
    return line === undefined ? undefined : line.slice(label.length + 1).trim();
  };
  const ready = after("ready")?.split(/\s+/) ?? [];
  const url = after("preview");
  const none = after("no preview");
  const lookFor = after("look for");
  return MergeRequestSchema.safeParse({
    prUrl: ready[0],
    headSha: ready[1],
    sessionUrl: after("session"),
    changes: after("changes"),
    preview: url !== undefined ? { kind: "url", url } : none !== undefined ? { kind: "none", reason: none } : undefined,
    ...(lookFor !== undefined && lookFor !== "-" ? { lookFor } : {}),
    fullTierGreen: lines.some((l) => l.toLowerCase() === MERGE_REQUEST_GREEN_LINE) ? true : undefined,
  });
}
