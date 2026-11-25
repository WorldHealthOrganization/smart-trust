/**
 * Section verdicts — which ingested sections are not PROSE.
 *
 * @module schemas/section-verdicts
 * @graphNode schema
 *
 * The analogue, for a section, of `image-verdicts.json` for an image: one
 * inspection's judgement, recorded as DATA beside the documents it judges (a
 * library root's `section-verdicts.json`), so it can be reviewed line by line
 * and read by every consumer rather than re-decided by each.
 *
 * A style guide prints sample pages — Lorem-ipsum covers, font specimens,
 * table samples. They are the source's own content but not prose: a summary,
 * translation or index of them describes filler.
 *
 * ## Roles
 *
 * - `specimen` — the page exhibits a typographic or layout sample; its words
 *   are placeholder or sample text, not the document speaking.
 *
 * The enum is closed: each new role arrives with the consumer that honours it.
 *
 * ## Who reads it
 *
 * - `scripts/summaries.ts` — a specimen block has status `specimen`: neither
 *   prose nor backlog, so the drain does not summarise filler, and the block
 *   stays VISIBLE as a specimen rather than disappearing from the counts.
 * - `scripts/lsi.ts` `unitsOf` — a specimen section is not an index unit.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const SECTION_VERDICTS_FILE = "section-verdicts.json";

export const SECTION_ROLES = ["specimen"] as const;

export const SectionVerdictSchema = z.object({
  role: z.enum(SECTION_ROLES),
  /** What the inspector SAW — the reason for the role, checkable against the page. */
  saw: z.string().min(1),
});

export const SectionVerdictFileSchema = z.object({
  $schema: z.literal("folio-section-verdicts/v1"),
  _comment: z.string().optional(),
  inspected_by: z.object({ kind: z.enum(["agent", "human"]), id: z.string().min(1) }).passthrough(),
  inspected_at: z.string().min(1),
  /** entry slug → section id (the `sections/<id>.md` stem) → verdict. */
  verdicts: z.record(z.string(), z.record(z.string(), SectionVerdictSchema)),
});

export type SectionVerdictFile = z.infer<typeof SectionVerdictFileSchema>;

/**
 * The sections a library root marks `specimen`, as `entry/sectionId` keys.
 * An ABSENT file is an empty answer (no library has to have one); a present
 * file that does not parse or validate THROWS — "could not read the verdicts"
 * must never read as "nothing is a specimen".
 */
export function specimenSections(libraryRoot: string): Set<string> {
  const p = join(libraryRoot, SECTION_VERDICTS_FILE);
  if (!existsSync(p)) return new Set();
  const file = SectionVerdictFileSchema.parse(JSON.parse(readFileSync(p, "utf8")));
  const out = new Set<string>();
  for (const [entry, sections] of Object.entries(file.verdicts))
    for (const [id, v] of Object.entries(sections)) if (v.role === "specimen") out.add(`${entry}/${id}`);
  return out;
}
