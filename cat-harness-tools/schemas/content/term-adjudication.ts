/**
 * @graphNode schema
 *
 * What was decided when a minted glossary term and an authorised terminology
 * DISAGREE.
 *
 * The skill
 * [`term-disagreement`](../skills/library/library-core/term-disagreement.md)
 * says when a disagreement needs a decision and how to choose. This file says
 * what each outcome WRITES and WHERE, and refuses a record that cannot be
 * acted on.
 *
 * ## Which disagreement
 *
 * Only **the extractor vs. the terminology**: the corpus uses a word the
 * authorised vocabulary spells differently or does not carry. Two judges
 * disagreeing about a mapping is
 * [`adjudication`](../skills/process/process-core/adjudication.md) plus
 * [`untainted-verification`](../skills/process/process-core/untainted-verification.md),
 * not built yet; rejecting an automated match belongs there.
 *
 * ## The subject: a DETERMINED disagreement, as the check reported it
 *
 * A record names the candidate `(scheme, term)`, the `target` it was checked
 * on, and the `exact` / `concept` pair `check:term-mapping` reported:
 *
 * | observed | what it means |
 * |---|---|
 * | `exact: unmapped`, `concept: mapped` | the right concept under a label that is not its authorised one |
 * | `exact: unmapped`, `concept: unmapped` | the vocabulary carries no such label |
 *
 * `exact: mapped` is agreement. `undetermined` is refused: an unreachable
 * terminology has said nothing. The observed pair is kept so a reader can
 * tell when the check now reports something different and the record is
 * stale.
 *
 * ## Three outcomes
 *
 * {@link OUTCOME_WRITES} is the table, as data, so the skill and a test read
 * one copy. In short:
 *
 * - `change-prose`: the source asset is edited to the authorised label. The
 *   candidate is re-extracted, and the next check reports `exact: mapped`.
 * - `local-term`: an AUTHORED term is written to a glossary, with the reason
 *   the authority's concept does not serve. Where it is related to that
 *   concept, the term carries the SKOS mapping a person chose, so that
 *   mapping lands in the default graph rather than the automated one.
 * - `vocabulary-wrong`: nothing in the corpus changes. The record itself is
 *   the finding: this vocabulary is not authoritative for this domain.
 *
 * `local-term` may not use `exactMatch`: if the authority's concept IS the
 * term, the outcome is `change-prose`.
 *
 * ## Where a record lives
 *
 * In a `*.term-adjudications.json` file beside the glossary schemes that
 * `check:term-mapping` reads. That check validates every such file and fails
 * on one that does not satisfy this schema. A record is written when somebody
 * decides, never seeded.
 */
import { z } from "zod";

import { MAPPING_TARGETS } from "./term-mapping.ts";

export const TERM_ADJUDICATIONS_SCHEMA_ID = "folio-term-adjudications/v1";

/** A file of records, by name. The directory is the glossary directory the check walks. */
export const TERM_ADJUDICATIONS_SUFFIX = ".term-adjudications.json";

export const OUTCOMES = ["change-prose", "local-term", "vocabulary-wrong"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/**
 * What each outcome writes, and where. The skill renders this table, and a
 * test fails if an outcome is added without its row.
 */
export const OUTCOME_WRITES: Readonly<Record<Outcome, { writes: string; where: string; afterwards: string }>> = {
  "change-prose": {
    writes: "the authorised label, in place of the corpus's own word",
    where: "the source asset the extractor read (its title, name or label), listed in `changed`",
    afterwards: "re-extraction mints the authorised label; the next check reports `exact: mapped`",
  },
  "local-term": {
    writes: "an AUTHORED term with a definition, and the `reason` the authority's concept does not serve",
    where: "an authored glossary scheme (`localTerm.glossary`), as term `localTerm.id`",
    afterwards:
      "the candidate is promoted; any relation to the authority's concept is a person's mapping in the default graph",
  },
  "vocabulary-wrong": {
    writes: "nothing in the corpus; this record is the finding",
    where: "this record, naming the `vocabulary` and the `domain` it does not serve",
    afterwards: "the check keeps reporting the miss; the record says why it is not acted on",
  },
};

const LOCAL_ID = /^[a-z0-9][a-z0-9._-]*$/;
const ABSOLUTE_IRI = /^[a-z][a-z0-9+.-]*:\/\//i;
const Iri = z.string().regex(ABSOLUTE_IRI, "an absolute IRI — an in-repo `<scheme>:<id>` is not one");
const Reason = z.string().trim().min(1, "a decision with no reason cannot be reviewed or revisited");

/** The two disagreements, as `check:term-mapping` reported them. */
const Observed = z
  .object({
    exact: z.literal("unmapped"),
    concept: z.enum(["mapped", "unmapped"]),
  })
  .strict();

const Subject = z
  .object({
    /** The candidate's scheme id, as the mapping record keys it (`kg-tools`, …). */
    scheme: z.string().min(1),
    /** The candidate's term id within that scheme. */
    term: z.string().regex(LOCAL_ID),
    target: z.enum(MAPPING_TARGETS),
    observed: Observed,
  })
  .strict();

const Common = {
  subject: Subject,
  /** The actor who decided: an id under `scenarios/actors/`. A content decision is a person's. */
  decidedBy: z.string().min(1),
  decidedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  /** Where it was discussed: an issue, a PR, a bean. */
  ref: z.string().min(1).optional(),
};

export const ChangeProseSchema = z
  .object({
    ...Common,
    outcome: z.literal("change-prose"),
    /** The authorised concept the corpus now uses. */
    concept: Iri,
    /** Its authorised label, which the corpus now carries. */
    authorisedLabel: z.string().trim().min(1),
    /** The source assets that were edited, by repository path. */
    changed: z.array(z.string().min(1)).min(1, "say which source assets were changed, or nothing can be checked"),
  })
  .strict();

/**
 * A person's mapping from a local term to the authority's concept: the
 * predicates an authored term can carry (`folio-glossary/v1`), so that every
 * outcome is one that can be written. `exactMatch` is excluded on purpose
 * (see the header). `relatedMatch` is excluded because an authored term
 * cannot carry it yet, and a record naming a mapping nothing can write is a
 * record that cannot be applied.
 */
export const LOCAL_TERM_RELATIONS = ["closeMatch", "broadMatch", "narrowMatch", "none"] as const;

export const LocalTermSchema = z
  .object({
    ...Common,
    outcome: z.literal("local-term"),
    localTerm: z
      .object({
        /** The authored glossary file, by repository path. */
        glossary: z.string().min(1),
        id: z.string().regex(LOCAL_ID),
      })
      .strict(),
    /** Why the authority's concept does not serve, so the next reader need not re-derive it. */
    reason: Reason,
    relation: z.enum(LOCAL_TERM_RELATIONS),
    /** The authority's concept, required unless `relation` is `none`. */
    concept: Iri.optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.relation !== "none" && !r.concept) {
      ctx.addIssue({
        code: "custom",
        path: ["concept"],
        message: `\`relation: ${r.relation}\` needs the concept it relates to`,
      });
    }
    if (r.relation === "none" && r.concept) {
      ctx.addIssue({
        code: "custom",
        path: ["relation"],
        message: "a concept is named but no relation to it is given; say which, or drop the concept",
      });
    }
  });

export const VocabularyWrongSchema = z
  .object({
    ...Common,
    outcome: z.literal("vocabulary-wrong"),
    /** The vocabulary consulted, as the check's scope names it (`platform`, `who-smart-base@v1.0.0`, …). */
    vocabulary: z.string().min(1),
    /** The domain it does not serve. */
    domain: z.string().trim().min(1),
    reason: Reason,
    /** The concept the label reached, where it reached one. */
    concept: Iri.optional(),
  })
  .strict();

export const TermAdjudicationSchema = z.union([ChangeProseSchema, LocalTermSchema, VocabularyWrongSchema]);
export type TermAdjudication = z.infer<typeof TermAdjudicationSchema>;

export const TermAdjudicationsFileSchema = z
  .object({
    $schema: z.literal(TERM_ADJUDICATIONS_SCHEMA_ID),
    _comment: z.string().optional(),
    adjudications: z.array(TermAdjudicationSchema),
  })
  .strict()
  .superRefine((f, ctx) => {
    const seen = new Map<string, number>();
    f.adjudications.forEach((a, i) => {
      const k = `${a.subject.scheme}\0${a.subject.term}\0${a.subject.target}`;
      const first = seen.get(k);
      if (first !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["adjudications", i],
          message:
            `\`${a.subject.scheme}\`/\`${a.subject.term}\` on \`${a.subject.target}\` is already decided at ` +
            `index ${first}. One disagreement has one outcome; a changed decision replaces the old one`,
        });
      } else seen.set(k, i);
    });
  });
export type TermAdjudicationsFile = z.infer<typeof TermAdjudicationsFileSchema>;

/**
 * Each record set against what the check reports NOW, by outcome:
 *
 * - `change-prose` and `local-term` are APPLIED when the candidate is gone or
 *   now maps exactly, which is their stated aftermath. While the check still
 *   reports the observed pair, the decision is `pending`.
 * - `vocabulary-wrong` changes nothing, so it expects the observed pair to
 *   hold. Any other answer means it was decided against a state that has
 *   moved, and it is `stale`.
 *
 * Reported, never a failure: a stale decision is still a decision, and it
 * has become a question to look at again.
 */
export type AdjudicationStatus = "applied" | "pending" | "holds" | "stale";

export function adjudicationStatus(
  r: TermAdjudication,
  now: { exact: string; concept: string } | undefined,
): AdjudicationStatus {
  const o = r.subject.observed;
  const same = !!now && now.exact === o.exact && now.concept === o.concept;
  if (r.outcome === "vocabulary-wrong") return same ? "holds" : "stale";
  if (!now || now.exact === "mapped") return "applied";
  return same ? "pending" : "stale";
}
