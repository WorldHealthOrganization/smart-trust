/**
 * The large-document review fixture: a before/after pair of one synthetic
 * folio, 2,000 blocks on each side, with a known edit script between them.
 *
 * @module scripts/test-fixtures/scale-pair
 *
 * Bean `xp72`, epic `q4jm`. Every review child can pass on a ten-block fixture
 * and still fall over on a real handbook, so this one is handbook-sized:
 * 10 chapters × 10 sections × 20 blocks.
 *
 * ## Synthetic, by necessity
 *
 * There is no in-repo folio to borrow (roast R7: `folios/` is a README), and
 * the immunization DAK layer renders no HTML. So the pair is GENERATED, and it is
 * deterministic: no clock, no randomness. The same call writes the same bytes
 * every time, which is what lets `scale-pair.changeset.json` be a golden file.
 * The generator is committed rather than its 8,000 output files.
 *
 * ## The edit script, and what each edit must read as
 *
 * Every kind of change the ChangeSet distinguishes is applied, once per
 * chapter or twice. Each is placed so that it cannot disturb another's
 * reading. {@link EXPECTED} is derived from the script by hand, NOT from a
 * ChangeSet run, so the golden file is checked against an independent count
 * and cannot simply confirm itself.
 *
 * | edit | where, in every chapter | reads as |
 * |---|---|---|
 * | insert | top of sections 0 and 5 | `added`, and moves nothing |
 * | remove | last block of sections 2 and 7 | `removed` |
 * | move | section 3, index 10 → end of section 4 | `moved` |
 * | rename | section 1, index 5, with `renamedFrom` | `renamed` |
 * | reword | index 8 of sections 0 and 9 | `prose` |
 * | manifest edit | section 6, index 12, gains a field | `manifest` |
 * | all at once | section 8, index 15: renamed, reworded, moved to the top of section 9 | `renamed` + `prose` + `moved` |
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const CHAPTERS = 10;
export const SECTIONS = 10;
export const BLOCKS = 20;

const pad = (n: number) => String(n).padStart(2, "0");
const chapterDir = (c: number) => `ch-${pad(c)}`;
const sectionLabel = (s: number) => `sec-${pad(s)}`;
const slug = (c: number, s: number, b: number) => `b-${pad(c)}-${pad(s)}-${pad(b)}`;
const label = (c: number, s: number, b: number) => `def:${pad(c)}-${pad(s)}-${pad(b)}`;

interface Block {
  slug: string;
  label: string;
  prose: string;
  renamedFrom?: string;
  extra?: string;
}

const manifest = (b: Block) =>
  `export default definition({\n  label: "${b.label}",\n` +
  (b.renamedFrom ? `  renamedFrom: ["${b.renamedFrom}"],\n` : "") +
  (b.extra ? `  ${b.extra},\n` : "") +
  `});\n`;

const chapterManifest = (c: number, sections: string[][]) =>
  `export default chapter({\n  title: "Chapter ${c}",\n  sections: [\n` +
  sections
    .map((slugs, s) => `    { title: "Section ${s}", label: "${sectionLabel(s)}", blocks: [${slugs.map((x) => `"${x}"`).join(", ")}] },\n`)
    .join("") +
  `  ],\n});\n`;

const baseProse = (c: number, s: number, b: number) =>
  `Block ${b} of section ${s} in chapter ${c}. It states one requirement and gives its rationale.\n`;

/** One chapter's sections (slug lists) and blocks, before or after the edit script. */
function chapterSide(c: number, side: "before" | "after"): { sections: string[][]; blocks: Block[] } {
  const sections: string[][] = [];
  const blocks = new Map<string, Block>();
  for (let s = 0; s < SECTIONS; s++) {
    const slugs: string[] = [];
    for (let b = 0; b < BLOCKS; b++) {
      slugs.push(slug(c, s, b));
      blocks.set(slug(c, s, b), { slug: slug(c, s, b), label: label(c, s, b), prose: baseProse(c, s, b) });
    }
    sections.push(slugs);
  }
  if (side === "before") return { sections, blocks: [...blocks.values()] };

  const edit = (sl: string, patch: Partial<Block>) => blocks.set(sl, { ...blocks.get(sl)!, ...patch });

  // insert: a new block at the top of sections 0 and 5.
  for (const s of [0, 5]) {
    const sl = `${slug(c, s, 99)}`;
    blocks.set(sl, { slug: sl, label: label(c, s, 99), prose: `A block inserted at the top of section ${s}.\n` });
    sections[s]!.unshift(sl);
  }
  // remove: the last block of sections 2 and 7.
  for (const s of [2, 7]) blocks.delete(sections[s]!.pop()!);
  // move: section 3 index 10 to the end of section 4.
  const moved = slug(c, 3, 10);
  sections[3] = sections[3]!.filter((x) => x !== moved);
  sections[4]!.push(moved);
  // rename, declared.
  edit(slug(c, 1, 5), { label: `${label(c, 1, 5)}-renamed`, renamedFrom: label(c, 1, 5) });
  // reword.
  for (const s of [0, 9]) edit(slug(c, s, 8), { prose: `Block 8 of section ${s}, reworded in review.\n` });
  // manifest edit.
  edit(slug(c, 6, 12), { extra: `status: "draft"` });
  // all at once: renamed, reworded, and moved to the top of section 9.
  const all = slug(c, 8, 15);
  edit(all, { label: `${label(c, 8, 15)}-renamed`, renamedFrom: label(c, 8, 15), prose: "Renamed, reworded and moved.\n" });
  sections[8] = sections[8]!.filter((x) => x !== all);
  sections[9]!.unshift(all);

  return { sections, blocks: [...blocks.values()] };
}

/** Write one side of the pair as a folio at `folioRoot`. Overwrites; never deletes. */
export function writeSide(folioRoot: string, side: "before" | "after"): void {
  for (let c = 0; c < CHAPTERS; c++) {
    const dir = join(folioRoot, chapterDir(c));
    mkdirSync(dir, { recursive: true });
    const { sections, blocks } = chapterSide(c, side);
    writeFileSync(join(dir, `${chapterDir(c)}.ts`), chapterManifest(c, sections));
    for (const b of blocks) {
      writeFileSync(join(dir, `${b.slug}.ts`), manifest(b));
      writeFileSync(join(dir, `${b.slug}.md`), b.prose);
    }
  }
}

/** The block files the edit script deletes, relative to the folio root. */
export function removedFiles(): string[] {
  const out: string[] = [];
  for (let c = 0; c < CHAPTERS; c++)
    for (const s of [2, 7]) for (const ext of ["ts", "md"]) out.push(join(chapterDir(c), `${slug(c, s, BLOCKS - 1)}.${ext}`));
  return out;
}

/**
 * The ChangeSet summary the edit script must produce, counted from the table
 * above rather than from a run. Per chapter: 2 inserts, 2 removals, and 6
 * changed blocks (move, rename, 2 rewords, manifest edit, all-at-once).
 */
export const EXPECTED = {
  total: CHAPTERS * SECTIONS * BLOCKS,
  added: CHAPTERS * 2,
  removed: CHAPTERS * 2,
  changed: CHAPTERS * 6,
  unchanged: CHAPTERS * SECTIONS * BLOCKS - CHAPTERS * 2 - CHAPTERS * 6,
  renamed: CHAPTERS * 2,
  prose: CHAPTERS * 3,
  manifest: CHAPTERS * 1,
  moved: CHAPTERS * 2,
} as const;
