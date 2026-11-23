/**
 * A methodology node's front matter — `folio-methodology/v1`.
 *
 * `methodology-adoption` requires an adopted methodology to be "external and
 * named", with "an origin: authors, a publication, a standards body"; a method
 * without one is a house process and is written as a skill. That distinction
 * rests on the front-matter fields checked here.
 *
 * ## `evidence` is optional
 *
 * A node may cite an origin whose source is not in any library. The schema
 * permits its absence and `check-methodology-evidence.ts` REPORTS it as a
 * finding, gated by nobody — the same division `check:subgraphs` uses for
 * cross-subgraph edges.
 *
 * @graphNode schema
 * @module schemas/methodology
 */
import { z } from "zod";

/** The tag a methodology node carries in its front matter. */
export const METHODOLOGY_SCHEMA_TAG = "folio-methodology/v1";

/**
 * Front matter of a methodology node.
 *
 * `strict()` is deliberate. A misspelled `applies_when` beside a correct
 * `applies-when` would otherwise validate, and the selection question would
 * silently never reach the node — a failure indistinguishable from a
 * methodology nobody selects because it genuinely does not apply.
 */
export const MethodologyFrontMatterSchema = z
  .object({
    $schema: z.literal(METHODOLOGY_SCHEMA_TAG),
    /** Stable id, referenced from skills and diagrams. Kebab-case, like a skill's. */
    name: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "a methodology `name` is kebab-case, like a skill id"),
    /** What a reader sees. Not the id with capitals — it may name the acronym's expansion. */
    title: z.string().min(1),
    /**
     * Authors, a publication, a standards body.
     *
     * REQUIRED, because it is the whole line between an adoption and a house
     * process, and `methodology-adoption` makes that line load-bearing. A node
     * with no origin should be a skill.
     *
     * It is free prose rather than a structured citation on purpose: one of
     * these origins is *contested* — `swot.md` records that no academic
     * reference supports the usual attribution — and a structured `author`
     * field would force that node to assert a single answer. A citation format
     * that cannot express "the literature disagrees" would make the corpus
     * wrong in exactly the case an evidence base exists for.
     */
    origin: z.string().min(1),
    /**
     * When this methodology applies, phrased so `methodology-adoption`'s
     * selection question can reach it — and saying what it is NOT for.
     *
     * Required. A methodology whose applicability is unstated is one an agent
     * picks by resemblance, which is how the house method gets in.
     */
    "applies-when": z.string().min(1),
    /**
     * The ingested sources, each as `library/<bib-slug>`.
     *
     * Optional — see the module docstring. Each entry must be a library
     * reference, not a URL and not a prose citation: the point is that a reader
     * can open it from this checkout, and a URL is precisely the thing that
     * resolves against nothing.
     *
     * ## An ARRAY, and it became one the day a second source arrived
     *
     * This was a single string until 2026-09-22, when `swot` gained a second
     * ingested source. A methodology adopted from secondary literature does not
     * have one canonical text — `swot` is rendered from a theoretical review
     * AND an encyclopedia chapter, which agree on the method, differ in what
     * they cover, and are silent on different things. Forcing a choice between
     * them would make the node cite less than it rests on.
     *
     * An array even for one, matching `graphTypologies` and for the same reason:
     * a field with two spellings is a field every consumer must branch on, and
     * the one-element case is the one that would silently become the default.
     * A present-but-empty array is refused — an empty list of sources is
     * `evidence` absent, said in a way that reads as answered.
     */
    evidence: z
      .array(
        z
          .string()
          .regex(/^library\/[a-z0-9][a-z0-9.-]*$/, "each `evidence` entry is a library reference: `library/<bib-slug>`"),
      )
      .min(1, "`evidence: []` is not `no evidence` — omit the field instead")
      .optional(),
  })
  .strict();

export type MethodologyFrontMatter = z.infer<typeof MethodologyFrontMatterSchema>;

/**
 * A SKILL'S EDGE TO THE METHODOLOGIES IT APPLIES — owner, 2026-10-16:
 * *"uses-methodology in Skill"*.
 *
 * Skills linked their method in prose (`Method: [wiregen](…)`), which no
 * reader of the graph could follow and no check could hold to a node that
 * exists. The edge is on the SKILL, pointing at the general node: a
 * methodology never lists the skills that apply it (a general node never names
 * its users, `data-modelling` step 8), and the methodologies viewer reads the
 * edge back to show, on each node's page, which skills apply it.
 *
 * Each entry is a methodology `name`, resolved across every layer that
 * declares a `methodology` graph. Only a skill that APPLIES the method carries
 * it; a skill that merely mentions one (a worked example, a related reading)
 * keeps its prose link.
 */
export const USES_METHODOLOGY_FIELD = "uses-methodology";

export const UsesMethodologySchema = z
  .array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "each `uses-methodology` entry is a methodology `name`, kebab-case"))
  .min(1, "`uses-methodology: []` says nothing — omit the field instead");
