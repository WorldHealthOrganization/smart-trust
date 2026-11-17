/**
 * **The glossary sense verdicts** of a layer: for a use of a glossary term
 * in the narrative that no rule decides, whether the term is used in its
 * glossary sense — the store `translation:glossary:check` reads and its
 * `--record` writes.
 *
 * Owner, 2026-11-07: "If a glossary term is used in the narrative in the
 * correct context, then the glossary translation is used in the translated
 * narrative." The context is decided by rule first (the catalogue's subject
 * area is the term's), then by an untainted adjudicator agent, who is given the
 * term, its definition and the source sentence and rules:
 *
 * | verdict | meaning | the check |
 * |---|---|---|
 * | `in-sense` | the sentence uses the glossary concept | the fixed translation is enforced |
 * | `other-sense` | the same word, another concept | nothing is checked |
 * | `exception` | in sense, but the fixed translation is wrong here; `reason` says why | passes, and is listed |
 *
 * Sense is a property of the English source, so one verdict serves every
 * locale. A verdict is keyed by the term's id (its IRI, or
 * `<subject area>#<label>` for a terminology pin) and the SHA-256 of the
 * msgid: a changed msgid has another hash, so its old verdict no longer
 * applies and the use is asked again. `decidedBy` names the agent or person
 * that ruled, never the model behind an agent.
 *
 * The file is `<translation-sources>/glossary-sense.json`, committed in the
 * layer.
 *
 * @module schemas/kg/glossary-sense
 * @graphNode schema
 */
import { z } from "zod";

/** The `$schema` of the store. */
export const GLOSSARY_SENSE_SCHEMA = "glossary-sense/v1";

/** The store's file name, in the layer's declared `translation-sources` directory. */
export const GLOSSARY_SENSE_FILE = "glossary-sense.json";

/** What an adjudicator may rule. */
export const SENSE_VERDICTS = ["in-sense", "other-sense", "exception"] as const;
export type SenseVerdictKind = (typeof SENSE_VERDICTS)[number];

/** One line of prose: no line break. */
const ONE_LINE = /^[^\r\n]+$/;

/** One verdict on one use of one term. */
export const GlossarySenseVerdictSchema = z
  .object({
    /** The term's id: its IRI, or `<subject area>#<label>` for a terminology pin. */
    term: z.string().min(1),
    /** The label that matched, for a reader. */
    label: z.string().min(1).optional(),
    /** SHA-256 (hex) of the msgid, exactly as the catalogue holds it. */
    msgidSha256: z.string().regex(/^[0-9a-f]{64}$/),
    /** The source sentence, for a reader; the hash is what is compared. */
    msgid: z.string().optional(),
    verdict: z.enum(SENSE_VERDICTS),
    /** One line: why. For an `exception`, why the fixed translation is wrong here. */
    reason: z.string().regex(ONE_LINE),
    /** The agent or person that ruled: an id, never a model name. */
    decidedBy: z.string().regex(/^\S+$/),
    /** When, as an ISO date. */
    decidedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  })
  .strict();
export type GlossarySenseVerdict = z.infer<typeof GlossarySenseVerdictSchema>;

/** The key a verdict is found by. */
export const senseKey = (term: string, msgidSha256: string): string => `${term}\u0000${msgidSha256}`;

/** The whole store: one verdict per (term, msgid hash). */
export const GlossarySenseStoreSchema = z
  .object({
    $schema: z.literal(GLOSSARY_SENSE_SCHEMA),
    verdicts: z.array(GlossarySenseVerdictSchema),
  })
  .strict()
  .superRefine((s, ctx) => {
    const seen = new Set<string>();
    s.verdicts.forEach((v, i) => {
      const k = senseKey(v.term, v.msgidSha256);
      if (seen.has(k)) ctx.addIssue({ code: "custom", path: ["verdicts", i], message: `a second verdict for ${v.term} on msgid ${v.msgidSha256.slice(0, 12)}` });
      seen.add(k);
    });
  });
export type GlossarySenseStore = z.infer<typeof GlossarySenseStoreSchema>;
