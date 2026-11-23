/**
 * `library/<slug>/keywords.json` — an entry's keywords, read from the LSI
 * index's own log-entropy term weights. Written by
 * `scripts/library-keywords.ts`; read by the library viewer's Document panel.
 *
 * `evidence: ["heading"]` when every word of the keyword appears in a heading
 * the extraction found: the section's own title for a section keyword, a TOC
 * title or figure caption for a document keyword.
 *
 * @graphNode schema
 */
import { z } from "zod";

export const KEYWORDS_SCHEMA_ID = "folio-keywords/v1" as const;
/** The file each library entry carries. */
export const KEYWORDS_FILE = "keywords.json";

const ScoredKeywordSchema = z
  .object({
    term: z.string().min(1),
    /** Comparable within one library's matrix only. */
    score: z.number(),
    evidence: z.array(z.enum(["heading"])),
  })
  .strict();

export const KeywordsFileSchema = z
  .object({
    $schema: z.literal(KEYWORDS_SCHEMA_ID),
    entry: z.string().min(1),
    corpus: z
      .object({ library: z.string(), sections: z.number().int(), terms: z.number().int(), weighting: z.string() })
      .strict(),
    document: z.array(ScoredKeywordSchema),
    sections: z.record(z.string(), z.array(ScoredKeywordSchema)),
  })
  .strict();

export type ScoredKeyword = z.infer<typeof ScoredKeywordSchema>;
export type KeywordsFile = z.infer<typeof KeywordsFileSchema>;

/**
 * `folio-keywords/v2` — the DERIVED keywords graph, one node per library entry,
 * built at publish and never committed (owner, 2026-11-08, cat-harness#1144:
 * "it is extracted content so i dont want to live in orignial ingest record").
 *
 * Written by `bun run cat library:keywords` to
 * `<site>/assets/keywords/<instance>/<slug>.jsonld`, outside the entry. It links
 * to the document by `about` (the entry's id), so a reader joins it to the
 * ingest record without the record carrying it.
 *
 * Keyed by VARIANT so methods can be compared side by side: each variant names
 * its method and parameters, and `document` / `sections` hold one keyword list
 * per variant id.
 */
export const KEYWORDS_GRAPH_SCHEMA_ID = "folio-keywords/v2" as const;
/** Where the built graph goes, relative to the site's base docs directory. */
export const KEYWORDS_GRAPH_DIR = "assets/keywords";

export const KeywordVariantSchema = z
  .object({
    id: z.string().min(1),
    /** The methodology node the variant applies (`lsi`, …). */
    method: z.string().min(1),
    weighting: z.enum(["log-entropy", "tfidf", "raw"]),
    /** `surface`: the weighted term matrix. `latent`: its rank-k reconstruction. `latent-rerank`: latent scores over the words the text uses. */
    space: z.enum(["surface", "latent", "latent-rerank"]),
    k: z.number().int().positive().optional(),
  })
  .strict();

export const KeywordsGraphSchema = z
  .object({
    $schema: z.literal(KEYWORDS_GRAPH_SCHEMA_ID),
    "@type": z.literal("cat-harness:DerivedKeywords"),
    entry: z.string().min(1),
    instance: z.string().min(1),
    /** The library entry these keywords are about, as the library graph names it. */
    about: z.string().min(1),
    corpus: z.object({ library: z.string(), sections: z.number().int(), terms: z.number().int() }).strict(),
    variants: z.array(KeywordVariantSchema).min(1),
    document: z.record(z.string(), z.array(ScoredKeywordSchema)),
    sections: z.record(z.string(), z.record(z.string(), z.array(ScoredKeywordSchema))),
  })
  .strict();

export type KeywordVariant = z.infer<typeof KeywordVariantSchema>;
export type KeywordsGraph = z.infer<typeof KeywordsGraphSchema>;
