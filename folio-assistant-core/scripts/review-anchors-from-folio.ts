#!/usr/bin/env bun
/**
 * Write a document folio's `review-anchors.json` from the working document.
 *
 *   bun run folio-assistant-core/scripts/review-anchors-from-folio.ts \
 *     --document <id> [--library <entry> --source <file> --source-label <text>] \
 *     [--repo <dir>] [--check]
 *
 * A document under public review has a frozen version, and `docx-to-folio.ts`
 * writes its anchors once from that version's .docx and line-numbered PDF
 * (smart-ra). A document still being drafted has none: its reviewers comment
 * on the working document as it stands (dth-hrh's working group). This writes
 * the same `folio-review-anchors/v1` index from the folio instead: every
 * chapter, section and block in reading order. The comment intake, placement
 * and dashboard read it unchanged. A comment that cites "7.3" is placed on
 * section 7.3's first block (anchor method `section`); one made from a block's
 * feedback link names the block directly.
 *
 * `--library` names the library entry the document was seeded from, and
 * `--source` the file in it that stands as the source of record until a
 * frozen version exists. All three are optional: a document authored from
 * scratch (dth-pc, dth-sc) has no seed file, and its anchors simply name no
 * library entry, so no library page claims it. Re-run after a structural change (a block added,
 * moved or relabelled); `--check` fails when the committed file is stale.
 *
 * Moved here from dth-hrh's `scripts/review/review-anchors.ts` so that every
 * drafting folio uses one builder (cat-harness-tools#1038, phase 3).
 *
 * @module folio-assistant-core/scripts/review-anchors-from-folio
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { folioDir } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";

import { ANCHORS_SCHEMA } from "./docx-to-folio.ts";

type Sec = { title: string; label?: string; blocks: string[]; subsections?: Sec[] };

export type FolioAnchorsOptions = {
  repo: string;
  document: string;
  /** The library entry it was seeded from; absent for a document authored from scratch. */
  library?: string;
  source?: string;
  sourceLabel?: string;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const hash = (s: string) => createHash("sha256").update(norm(s)).digest("hex").slice(0, 12);
const plain = (md: string) =>
  md.replace(/[*_>#|`]/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();

/** The anchors file's text, built from the folio at `repo/folio/<document>/`. */
export async function folioAnchors(o: FolioAnchorsOptions): Promise<string> {
  const folio = join(folioDir(o.repo), o.document);
  const paper = (await import(join(folio, `${o.document}.ts`))).default as { chapters: Array<{ dir: string }> };
  const chapters: Array<{ dir: string; title: string; number?: number; label: string }> = [];
  const sections: Array<{ label: string; number?: string; title: string; chapter: string; parent?: string }> = [];
  const blocks: Array<Record<string, unknown>> = [];

  for (const { dir } of paper.chapters) {
    const ch = (await import(join(folio, dir, `${dir}.ts`))).default as {
      title: string; number?: number; label: string; sections: Sec[];
    };
    chapters.push({ dir, title: ch.title, ...(ch.number !== undefined ? { number: ch.number } : {}), label: ch.label });
    const walk = async (s: Sec, path: string[], parent?: string): Promise<void> => {
      const label = s.label ?? `sec:${dir}-${sections.length}`;
      const num = s.title.match(/^(\d+(?:\.\d+)*)\s/)?.[1];
      sections.push({ label, ...(num ? { number: num } : {}), title: s.title, chapter: dir, ...(parent ? { parent } : {}) });
      for (const root of s.blocks) {
        const m = ((await import(join(folio, dir, `${root}.ts`))) as { default: { kind: string; label?: string; caption?: string } }).default;
        const mdPath = join(folio, dir, `${root}.md`);
        const text = plain(existsSync(mdPath) ? readFileSync(mdPath, "utf-8") : "");
        blocks.push({
          label: m.label ?? root,
          kind: m.kind,
          chapter: dir,
          root,
          sections: [...path, label],
          ...(m.caption ? { caption: m.caption } : {}),
          hash: hash(text),
          excerpt: text.slice(0, 160),
          method: "folio-snapshot",
        });
      }
      for (const sub of s.subsections ?? []) await walk(sub, [...path, label], label);
    };
    for (const s of ch.sections) await walk(s, []);
  }

  const anchors = {
    $schema: ANCHORS_SCHEMA,
    document: o.document,
    ...(o.library ? { library: o.library } : {}),
    // What the library entry is to this folio (shown on its library page).
    ...(o.sourceLabel ? { sourceLabel: o.sourceLabel } : {}),
    // No frozen review version yet: the working document is the review text,
    // and the file it was seeded from (if any) stands as the source of record.
    ...(o.source
      ? {
          source: {
            docx: { file: o.source, sha256: createHash("sha256").update(readFileSync(join(o.repo, o.source))).digest("hex") },
            pdf: { file: "", sha256: "", pages: 0 },
          },
        }
      : {}),
    note: "Generated from the working document by folio-assistant-core/scripts/review-anchors-from-folio.ts (no frozen review version yet).",
    chapters,
    sections,
    blocks,
  };
  return JSON.stringify(anchors, null, 1) + "\n";
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const document = arg("document");
  const library = arg("library");
  const source = arg("source");
  const sourceLabel = arg("source-label");
  if (!document || (source && !sourceLabel)) {
    console.error("usage: review-anchors-from-folio.ts --document <id> [--library <entry> --source <file> --source-label <text>] [--repo <dir>] [--check]");
    process.exit(2);
  }
  const repo = resolve(arg("repo") ?? ".");
  const out = join(folioDir(repo), document, "review-anchors.json");
  const text = await folioAnchors({ repo, document, library, source, sourceLabel });
  if (process.argv.includes("--check")) {
    const ok = existsSync(out) && readFileSync(out, "utf-8") === text;
    console.log(ok ? "✓ review-anchors.json is current" : "✗ review-anchors.json is stale: run the review:anchors script");
    process.exit(ok ? 0 : 1);
  }
  writeFileSync(out, text);
  const n = JSON.parse(text) as { chapters: unknown[]; sections: unknown[]; blocks: unknown[] };
  console.log(`review-anchors: ${n.chapters.length} chapters, ${n.sections.length} sections, ${n.blocks.length} blocks`);
}
