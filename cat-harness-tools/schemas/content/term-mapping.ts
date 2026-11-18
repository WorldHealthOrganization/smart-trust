/**
 * @graphNode schema
 *
 * Whether a glossary term the extractor MINTED already exists as a concept
 * somebody else is authoritative for.
 *
 * `glossary-extract.ts` mints a `candidate` from every knowledge-graph asset
 * carrying a title and a description, asserted by the extraction and checked
 * against nothing. This compares each one against existing terminology, using
 * the model
 * [`vocabulary-authority`](../skills/kg/kg-core/vocabulary-authority.md)
 * defines: SKOS the hub, `exactMatch` / `closeMatch` / `broadMatch` /
 * `relatedMatch` the predicates.
 *
 * ## TWO targets, and they are not interchangeable
 *
 * | target | authoritative for | resolved against |
 * |---|---|---|
 * | `skos` | what a term MEANS | SKOS concept schemes — the layer's own authored terms, plus any external scheme it declares |
 * | `fhir` | a clinical code's OPERATIONAL semantics | the pinned published IG snapshot (`cat-harness/external-schemas/who-smart-base.terminology.json`), a published IG at a version, not a live collection |
 *
 * A SKOS match and a FHIR match are **different assertions with different
 * authorities**, so a result carries which target it came from and the two
 * are never merged into one verdict. OCL is for FHIR only, never an authority
 * on meaning.
 *
 * ## Three states
 *
 * `mapped` · `unmapped` · `undetermined`. The third is NEVER rendered as
 * `unmapped`: a terminology that could not be reached has said nothing. The
 * `fhir` half resolves offline against the pinned snapshot, so both targets
 * return determined verdicts whenever the pin and snapshot are present and
 * valid; an absent or unusable snapshot yields `undetermined` with its
 * reason.
 *
 * ## `exact` and `concept` are a PAIR
 *
 * Both are always present, and the GAP between them is the finding. From
 * [`consensus-grounded-subject-evaluation`](../methodologies/consensus-grounded-subject-evaluation.md):
 * a high concept score with a low exact score means the right idea under the
 * wrong authorised label — a different outcome from no match at all. The
 * meanings are SKOS's own:
 *
 * - `exact` — the normalised `prefLabel` matches a concept's `prefLabel`.
 * - `concept` — the normalised label matches that concept's `prefLabel` **or
 *   any of its `altLabel`s**: the same concept reached by a different name.
 *
 * Normalisation: NFC, lower-case, whitespace collapsed, a trailing period
 * stripped.
 *
 * ## Validated in memory, committed as a projection
 *
 * The full file — two rows per candidate — is built and validated against
 * this schema on every run (so an `undetermined` row with no reason is
 * refused), then PROJECTED into
 * `test/results/term-mapping.qa-results.json`, which keeps the per-target
 * summaries and only the rows a reader can act on.
 *
 * ## It reports and never grades
 *
 * No ratio of mapped to total is computed: an unmapped candidate may be a
 * term this corpus is right to coin, and a mapped one a coincidence of
 * wording.
 */
import { z } from "zod";

/**
 * Which authority answered. See the table above — these are not two sources
 * for one question, they are two questions.
 */
export const MAPPING_TARGETS = ["skos", "fhir"] as const;
export type MappingTarget = (typeof MAPPING_TARGETS)[number];

/** `undetermined` is never rendered as `unmapped`. */
export const MATCH_STATES = ["mapped", "unmapped", "undetermined"] as const;
export type MatchState = (typeof MATCH_STATES)[number];

/** The SKOS mapping predicates, as `vocabulary-authority` declares them. */
export const MAPPING_PREDICATES = [
  "skos:exactMatch",
  "skos:closeMatch",
  "skos:broadMatch",
  "skos:relatedMatch",
] as const;

export const ConceptMatchSchema = z
  .object({
    /** The concept's URI, or its in-repo term id where it has no URI yet. */
    uri: z.string().min(1),
    predicate: z.enum(MAPPING_PREDICATES),
    /** The label that matched, so a reader can see WHY without re-deriving it. */
    via: z.string().min(1),
    /** The scheme the concept belongs to. */
    scheme: z.string().min(1),
  })
  .strict();

export const TermMappingSchema = z
  .object({
    /** The candidate's id, as its glossary scheme records it. */
    term: z.string().min(1),
    /**
     * The layer that owns the scheme. A scheme id such as `kg-tools` is
     * shared by every layer's extraction, so a scheme is keyed by
     * (instance, scheme): bean `q3n9`, owner ruling A, 2026-10-24. The
     * layer is derived from the scheme's source, never from where its
     * glossary file sits, so a file that moves keeps its key.
     */
    instance: z.string().min(1),
    /** The scheme the candidate came from — `kg-skills`, `kg-tools`, … */
    scheme: z.string().min(1),
    target: z.enum(MAPPING_TARGETS),
    exact: z.enum(MATCH_STATES),
    concept: z.enum(MATCH_STATES),
    /** Present when either state is `mapped`; the concepts that matched. */
    matches: z.array(ConceptMatchSchema).min(1).optional(),
    /** Required when either state is `undetermined`. */
    undetermined_reason: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((m, ctx) => {
    const undetermined = m.exact === "undetermined" || m.concept === "undetermined";
    if (undetermined && !m.undetermined_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["undetermined_reason"],
        message:
          "an undetermined result must carry its reason — without one it cannot be told from a " +
          "bug, and a reader has no way to know the check did not run (bean dh4f)",
      });
    }
    if (!undetermined && m.undetermined_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["undetermined_reason"],
        message: "both states were determined, so there is no undetermined reason to give",
      });
    }
    if ((m.exact === "mapped" || m.concept === "mapped") && !m.matches) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["matches"],
        message: "a `mapped` result must name what it matched, or it is an assertion with no subject",
      });
    }
    // `exact` implies `concept`: a label that matches a prefLabel exactly also
    // matches the concept. The reverse does not hold, and that asymmetry is
    // the whole reason both are recorded.
    if (m.exact === "mapped" && m.concept === "unmapped") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["concept"],
        message:
          "`exact: mapped` with `concept: unmapped` is not reachable — an exact label match is a " +
          "concept match by construction",
      });
    }
  });

/** What a run consulted, per target. A result with no scope cannot be read. */
export const MappingScopeSchema = z
  .object({
    target: z.enum(MAPPING_TARGETS),
    /**
     * The schemes or collections consulted. **May be empty**, and an empty
     * list is a determined finding — this layer declares nothing to check
     * against for that target — rather than a missing field.
     */
    consulted: z.array(z.string().min(1)),
    /** How they were reached: `local` for in-repo schemes, a host for a service. */
    via: z.string().min(1),
    /** Present when the target could not be consulted at all. */
    unreachable_reason: z.string().min(1).optional(),
  })
  .strict();

export const TERM_MAPPINGS_SCHEMA_ID = "folio-term-mappings/v1";

export const TermMappingsFileSchema = z
  .object({
    $schema: z.literal(TERM_MAPPINGS_SCHEMA_ID),
    _comment: z.string().optional(),
    checked_at: z.string().min(1),
    /** One entry per target, always both, so a reader sees what was NOT asked. */
    scope: z.array(MappingScopeSchema).min(1),
    mappings: z.array(TermMappingSchema),
  })
  .strict()
  .superRefine((f, ctx) => {
    const targets = new Set(f.scope.map((s) => s.target));
    for (const t of MAPPING_TARGETS) {
      if (!targets.has(t)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scope"],
          message:
            `no scope recorded for target \`${t}\` — a run that did not ask must say so, or its ` +
            "silence reads as nothing to find",
        });
      }
    }
  });

export type ConceptMatch = z.infer<typeof ConceptMatchSchema>;
export type TermMapping = z.infer<typeof TermMappingSchema>;
export type MappingScope = z.infer<typeof MappingScopeSchema>;
export type TermMappingsFile = z.infer<typeof TermMappingsFileSchema>;

/**
 * NFC, lower-case, whitespace collapsed, one trailing period stripped.
 *
 * The benchmark's rule, so a term is judged on substance rather than
 * typography. Exported because the check and its tests must not each have
 * their own idea of what "the same label" means.
 */
export function normaliseLabel(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim().replace(/\.$/, "").trim();
}
