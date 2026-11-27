/**
 * Glossary candidate proposer (Phase C — curation step).
 *
 * Walks every block in a paper, identifies candidate glossary slugs
 * (Ch 8 `glossary-*` blocks supply the canonical seed list), and for
 * each unowned slug ranks the blocks that most plausibly *should*
 * own its `:defterm[…]{#slug}` site:
 *
 *   1. The Ch 8 glossary block itself (Mathlib-synonym → glossary).
 *   2. Any `definition` block whose `.md` mentions the term.
 *   3. Other blocks ranked by mention count.
 *
 * Output is JSON, served to the curator web UI:
 *
 *   bun run cat-harness-tools/pipeline/glossary-candidates.ts <paper-dir>
 *     → writes content/<paper>/glossary-candidates.json
 *
 * The UI lets a human pick the canonical owner per slug; choices are
 * written to `glossary-curation.json` (a sibling decision file) and
 * applied by `apply-glossary-curation.ts`.
 *
 * @module pipeline/glossary-candidates
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { basename, join, resolve } from "path";
import type { Block, Chapter, Paper, Section } from "../schemas/types.ts";
import { ChapterSchema, PaperSchema } from "../schemas/constraints.ts";

// ── Types ────────────────────────────────────────────────────────

export interface CandidateBlock {
  /** Block file root name (no extension). */
  name: string;
  /** Block label (e.g. "def:rigid-monoidal-category"). */
  label: string;
  /** Block kind. */
  kind: string;
  /** Chapter directory name. */
  chapter: string;
  /** Chapter title. */
  chapterTitle: string;
  /** Section title within chapter, if any. */
  section: string | null;
  /** Block title from manifest, if any. */
  title: string | null;
  /** Number of bare-text mentions of the slug in this block's `.md`. */
  mentions: number;
  /** Heuristic rank (lower is better — preferred owner first). */
  rank: number;
  /** Why this block is proposed (human-readable). */
  reason: string;
  /** Path to the block's `.ts` file (relative to repo root). */
  tsPath: string;
}

export interface CandidateSlug {
  /** Canonical slug. */
  slug: string;
  /** Visible label (best guess from glossary block title or slug). */
  visible: string;
  /** Candidate blocks, sorted by rank ascending. */
  candidates: CandidateBlock[];
}

export interface CandidatesReport {
  /** Build timestamp (ISO 8601). */
  generated: string;
  /** Source paper directory name. */
  paper: string;
  /** Slugs not yet declared in any `defines[]`. */
  unowned: CandidateSlug[];
  /** Slugs already declared (informational). */
  owned: { slug: string; ownerBlock: string }[];
}

// ── Helpers ──────────────────────────────────────────────────────

interface BlockInfo {
  name: string;
  label: string;
  kind: string;
  title: string | null;
  defines: string[];
  chapter: string;
  chapterTitle: string;
  section: string | null;
  mdPath: string;
  tsPath: string;
  mdContent: string;
}

function locateBlock(blockName: string, chapter: Chapter): { sectionTitle: string | null } {
  for (const sec of chapter.sections) {
    if ("blocks" in sec) {
      const s = sec as Section;
      if (s.blocks.includes(blockName)) {
        return { sectionTitle: s.title ?? null };
      }
    }
  }
  return { sectionTitle: null };
}

/** Infer a slug from a Ch 8 glossary block file name. */
function slugFromGlossaryName(name: string): string | null {
  if (!name.startsWith("glossary-")) return null;
  return name.slice("glossary-".length);
}

/** Convert "rigid-monoidal-category" → "rigid monoidal category". */
function visibleFromSlug(slug: string): string {
  return slug.replace(/-/g, " ");
}

/** Count whole-word, case-insensitive occurrences of `visible` in `text`. */
function countMentions(text: string, visible: string): number {
  // Word-boundary match on the visible form. Escape regex specials,
  // then allow the inner spaces to match any whitespace run.
  const escaped = visible.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const re = new RegExp(`\\b${escaped}\\b`, "gi");
  const m = text.match(re);
  return m ? m.length : 0;
}

// ── Main ─────────────────────────────────────────────────────────

export async function proposeCandidates(paperDir: string): Promise<CandidatesReport> {
  const paperName = basename(paperDir);
  const paperManifest = join(paperDir, `${paperName}.ts`);
  if (!existsSync(paperManifest)) {
    throw new Error(`Paper manifest not found: ${paperManifest}`);
  }

  const paperMod = await import(paperManifest);
  const paperParsed = PaperSchema.safeParse(paperMod.default);
  if (!paperParsed.success) {
    throw new Error(`Invalid paper manifest: ${paperManifest}`);
  }
  const paper: Paper = paperMod.default;

  // ── Pass 1: collect every block + its .md content ─────────────
  const blocks: BlockInfo[] = [];
  const ownedSlugs = new Map<string, string>(); // slug → owner block label

  for (const chRef of paper.chapters) {
    const chDir = join(paperDir, chRef.dir);
    const chManifest = join(chDir, `${chRef.dir}.ts`);
    if (!existsSync(chManifest)) continue;

    const chMod = await import(chManifest);
    const chParsed = ChapterSchema.safeParse(chMod.default);
    if (!chParsed.success) continue;
    const chapter: Chapter = chMod.default;

    const blockNames: string[] = [];
    for (const sec of chapter.sections) {
      if ("blocks" in sec) blockNames.push(...(sec as Section).blocks);
    }

    for (const name of blockNames) {
      const tsPath = join(chDir, `${name}.ts`);
      const mdPath = join(chDir, `${name}.md`);
      if (!existsSync(tsPath)) continue;
      try {
        const mod = await import(tsPath);
        const block: Block = mod.default;
        const defines = ("defines" in block ? block.defines : undefined) ?? [];
        const label = block.label ?? name;
        const title = block.title ?? null;
        const mdContent = existsSync(mdPath) ? readFileSync(mdPath, "utf-8") : "";

        const { sectionTitle } = locateBlock(name, chapter);

        blocks.push({
          name,
          label,
          kind: block.kind,
          title,
          defines,
          chapter: chRef.dir,
          chapterTitle: chapter.title ?? chRef.dir,
          section: sectionTitle,
          mdPath,
          tsPath,
          mdContent,
        });

        for (const slug of defines) {
          if (!ownedSlugs.has(slug)) ownedSlugs.set(slug, label);
        }
      } catch {
        // Skip unimportable blocks; main validator handles them.
      }
    }
  }

  // ── Pass 2: derive candidate slugs ────────────────────────────
  // Seed: every Ch 8 `glossary-*` block name → slug.
  const candidateSlugs = new Set<string>();
  const visibleByGlossaryBlock = new Map<string, string>(); // slug → block.title

  for (const b of blocks) {
    const slug = slugFromGlossaryName(b.name);
    if (!slug) continue;
    candidateSlugs.add(slug);
    if (b.title) visibleByGlossaryBlock.set(slug, b.title);
  }

  // ── Pass 3: rank candidate owners per unowned slug ────────────
  const unowned: CandidateSlug[] = [];

  for (const slug of [...candidateSlugs].sort()) {
    if (ownedSlugs.has(slug)) continue;

    const visible = visibleByGlossaryBlock.get(slug) ?? visibleFromSlug(slug);
    const candidates: CandidateBlock[] = [];

    for (const b of blocks) {
      const mentions = countMentions(b.mdContent, visible);
      const isGlossaryBlock = b.name === `glossary-${slug}`;

      if (mentions === 0 && !isGlossaryBlock) continue;

      let rank: number;
      let reason: string;
      if (isGlossaryBlock) {
        rank = 0;
        reason = "Chapter 8 glossary block — Mathlib synonym (recommended canonical site)";
      } else if (b.kind === "definition") {
        rank = 1 + (mentions > 0 ? 0 : 100);
        reason = `Definition block mentioning the term (${mentions}× in .md)`;
      } else if (b.kind === "remark" || b.kind === "example") {
        rank = 100 - mentions;
        reason = `${b.kind} mentioning the term (${mentions}×)`;
      } else {
        rank = 50 - mentions;
        reason = `${b.kind} mentioning the term (${mentions}×)`;
      }

      candidates.push({
        name: b.name,
        label: b.label,
        kind: b.kind,
        chapter: b.chapter,
        chapterTitle: b.chapterTitle,
        section: b.section,
        title: b.title,
        mentions,
        rank,
        reason,
        tsPath: b.tsPath,
      });
    }

    candidates.sort((a, b) => a.rank - b.rank || b.mentions - a.mentions);
    unowned.push({ slug, visible, candidates });
  }

  const owned = [...ownedSlugs.entries()]
    .map(([slug, ownerBlock]) => ({ slug, ownerBlock }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return {
    generated: new Date().toISOString(),
    paper: paperName,
    unowned,
    owned,
  };
}

// ── CLI ──────────────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);
  const paperArg = args.find(a => !a.startsWith("--"));
  if (!paperArg) {
    console.error("Usage: bun run cat-harness-tools/pipeline/glossary-candidates.ts <paper-dir>");
    process.exit(2);
  }

  const paperDir = resolve(paperArg);
  if (!existsSync(paperDir)) {
    console.error(`Not found: ${paperDir}`);
    process.exit(2);
  }

  proposeCandidates(paperDir).then(report => {
    const outPath = join(paperDir, "glossary-candidates.json");
    writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
    console.log(
      `[glossary-candidates] ${report.unowned.length} unowned slug(s), ` +
        `${report.owned.length} already owned → ${outPath}`,
    );
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
