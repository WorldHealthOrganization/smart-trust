#!/usr/bin/env bun
/**
 * A PUBLISHED SURVEY of a commit window — so the next session reads it instead
 * of re-deriving it.
 *
 * Several sessions re-orienting against the same window of new commits each
 * spend the time reading the same thing, and nothing else shows it: a survey
 * is not a claimable bean, and nothing is pushed while surveying.
 *
 * ## The two edge commits
 *
 * A published survey is only safe to reuse if **staleness is decidable**, so
 * it records the window's own endpoints. A later session computes
 * `to..origin/main` — the delta it is NOT covered for — and surveys only that.
 *
 * So {@link SessionSurveySchema} makes `from` and `to` REQUIRED, as full
 * 40-character object names rather than refs: `origin/main` recorded as the
 * upper edge names a different commit tomorrow. A survey that cannot be
 * checked for staleness is worse than no survey, because siblings trust it
 * INSTEAD of looking.
 *
 * ## What it is not
 *
 * Not a claim on the window and not a division of labour (which would need a
 * live channel between sessions). It is an artefact: one session writes what
 * it found, and a later one decides for itself whether that still covers its
 * question.
 *
 * @module cat-harness/schemas/session-survey
 * @graphNode schema
 */
import { z } from "zod";

/** The tag every published survey carries, so the file declares what it is. */
export const SESSION_SURVEY_TAG = "folio-session-survey/v1";

/** A full git object name — never a ref, for the reason in the module docblock. */
const ObjectName = z
  .string()
  .regex(/^[0-9a-f]{40}$/, "a full 40-character git object name, not a ref or an abbreviation");

/**
 * One axis the survey actually covered, and what it concluded.
 *
 * `covered: false` with a reason is a first-class answer: a survey that looked
 * at four of six axes is useful, and a reader must be able to tell which two
 * it cannot rely on. Recording only what was done would let a partial survey
 * read as a complete one, which is the `1xhc` shape — absence taken for a
 * clean result.
 */
export const SurveyAxisSchema = z
  .object({
    /** What was examined — `beans`, `ci`, `prs`, `issues`, `branches`, … */
    axis: z.string().min(1),
    /** False means NOT LOOKED AT; `finding` then says why, not what was found. */
    covered: z.boolean(),
    /** What it found, or — when `covered` is false — why it was skipped. */
    finding: z.string().min(1),
  })
  .strict();
export type SurveyAxis = z.infer<typeof SurveyAxisSchema>;

/** A survey of one commit window, published for other sessions to reuse. */
export const SessionSurveySchema = z
  .object({
    $schema: z.literal(SESSION_SURVEY_TAG),
    /**
     * The window's LOWER edge — the last commit the surveyor already knew.
     * Exclusive, matching `git rev-list from..to`.
     */
    from: ObjectName,
    /** The window's UPPER edge — the newest commit the survey actually read. Inclusive. */
    to: ObjectName,
    /** The branch the window is on, so a reader knows which history `from`/`to` live in. */
    branch: z.string().min(1),
    /** When it was taken, ISO-8601. Not the staleness test — `to` is — but it dates the prose. */
    takenAt: z.string().min(1),
    /** Who took it, so a reader can ask. A session URL or id. */
    by: z.string().min(1),
    /** How many commits the window held, as counted at publication. */
    commits: z.number().int().nonnegative(),
    /** Per-axis findings. Empty is refused: a survey that covered nothing is not a survey. */
    axes: z.array(SurveyAxisSchema).min(1),
  })
  .strict();
export type SessionSurvey = z.infer<typeof SessionSurveySchema>;
