/**
 * `folio-glossary-tables/v1`: which document blocks show which glossary as a
 * table, read by the Tool `glossary-table` (`scripts/glossary-table.ts`).
 *
 * ```json
 * { "$schema": "folio-glossary-tables/v1",
 *   "tables": [{ "glossary": "glossary/x.glossary.json", "block": "folio/doc/glossary/t.md", "kind": "terms" }] }
 * ```
 *
 * Paths are relative to the layer root. The file lives at
 * `<instance>/glossary/glossary-tables.json`, inside the `glossary` kind's
 * directory, so the kind lists this family beside `folio-glossary/v1`
 * (`typologies/glossary.json`) and `validators/glossary-tables.json` names
 * this schema as its validator. It lives here, not in the script, so a
 * validator node can name it the way every other one names a `schemas/` file.
 *
 * @module folio-assistant-core/schemas/glossary-tables
 * @graphNode schema
 */
import { z } from "zod";

export const GLOSSARY_TABLES_SCHEMA_ID = "folio-glossary-tables/v1" as const;

const RelPath = z
  .string()
  .min(1)
  .refine((f) => !f.startsWith("/") && !f.split("/").includes(".."), "relative to the instance root, without `..`");

export const GlossaryTablesSchema = z
  .object({
    $schema: z.literal(GLOSSARY_TABLES_SCHEMA_ID),
    tables: z
      .array(
        z
          .object({
            glossary: RelPath.refine((f) => f.endsWith(".json"), "a .json glossary"),
            block: RelPath.refine((f) => f.endsWith(".md"), "a document block, a .md file"),
            kind: z.enum(["terms", "acronyms", "element-types"]),
            /** `element-types` only: the ArchiMate model and the view whose placeholder elements are the types. */
            archimate: z
              .object({
                model: RelPath.refine((f) => f.endsWith(".archimate"), "an Archi model, a .archimate file"),
                view: z.string().min(1),
              })
              .strict()
              .optional(),
            /**
             * `element-types` only: the rows, in the document's order. `type` is
             * the ArchiMate type as the exchange format names it
             * (`ApplicationComponent`), and the view must show a placeholder
             * element of that type. `term` is the glossary term that defines it,
             * by default the one whose prefLabel is the type's name. `icon` is
             * the image the first column shows.
             */
            rows: z
              .array(z.object({ type: z.string().regex(/^[A-Z][A-Za-z]+$/), term: z.string().min(1).optional(), icon: z.string().min(1).optional() }).strict())
              .min(1)
              .optional(),
          })
          .strict()
          .refine((t) => (t.kind === "element-types") === (t.archimate !== undefined), {
            message: "`archimate` is given for an element-types table, and only for one",
            path: ["archimate"],
          })
          .refine((t) => t.kind === "element-types" || t.rows === undefined, { message: "`rows` is only for an element-types table", path: ["rows"] }),
      )
      .min(1),
  })
  .strict();
export type GlossaryTables = z.infer<typeof GlossaryTablesSchema>;
