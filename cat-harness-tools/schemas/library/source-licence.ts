/**
 * A source's licence, as one record wherever it is written.
 *
 * @module schemas/source-licence
 * @graphNode schema
 *
 * The record `check:source-licence` reads from a library entry's
 * `manifest.jsonld` (as `licenceRecord`); an upload's `intake.json` carries
 * the SAME record rather than a second licence vocabulary.
 *
 * ## Three states, never two
 *
 * | `status`  | means                                        | must carry |
 * |-----------|----------------------------------------------|------------|
 * | `stated`  | the licence is known                         | `id` and `basis`: where it is stated |
 * | `unknown` | somebody looked and could not establish it   | `searched`: one entry per place tried |
 * | (absent)  | nobody has recorded anything                 | nothing |
 *
 * `unknown` and absent are different facts, and neither is ever reported as
 * cleared.
 */
import { z } from "zod";

export type LicenceSearched = { where: string; result: string; on?: string };
export type SourceLicence = { status?: string; id?: string; basis?: string; searched?: LicenceSearched[]; note?: string };

/** The problem with a record, or `undefined` when it is well formed. */
export function licenceProblem(l: SourceLicence): string | undefined {
  if (l.status === "stated") {
    if (!l.id?.trim()) return "`stated` with no `id`";
    if (!l.basis?.trim()) return "`stated` with no `basis`: where is it stated?";
    return undefined;
  }
  if (l.status === "unknown") {
    if (!Array.isArray(l.searched) || l.searched.length === 0)
      return "`unknown` with no `searched`: unknown means somebody looked, so say where";
    const bad = l.searched.find((s) => !s?.where?.trim() || !s?.result?.trim());
    return bad ? "a `searched` entry lacks `where` or `result`" : undefined;
  }
  return `status ${JSON.stringify(l.status)} is neither \`stated\` nor \`unknown\``;
}

/**
 * A library manifest's licence record, or `undefined` when it carries none.
 * Top-level `licenceRecord`, beside the `dcterms:license` it backs, and no
 * longer inside the `@json` `meta` (finding D4, bean `gzkt`).
 */
export function manifestLicence(manifest: unknown): SourceLicence | undefined {
  if (manifest === null || typeof manifest !== "object") return undefined;
  return (manifest as { licenceRecord?: SourceLicence }).licenceRecord;
}

/** The record as a schema: its shape, then {@link licenceProblem} as the one rule set. */
export const SourceLicenceSchema = z
  .object({
    status: z.enum(["stated", "unknown"]),
    id: z.string().optional(),
    basis: z.string().optional(),
    searched: z.array(z.object({ where: z.string(), result: z.string(), on: z.string().optional() })).optional(),
    note: z.string().optional(),
  })
  .superRefine((l, ctx) => {
    const p = licenceProblem(l);
    if (p) ctx.addIssue({ code: z.ZodIssueCode.custom, message: p });
  });
