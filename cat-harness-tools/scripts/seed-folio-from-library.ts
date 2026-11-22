#!/usr/bin/env bun
/**
 * Seed a folio document from a library entry: its `structure.json` and
 * `sections/` become chapters, sections and prose blocks, and every block
 * leaves as a knowledge-graph node.
 *
 *   bun run cat-harness-tools/scripts/seed-folio-from-library.ts \
 *     --entry library/<doc-id> --slug <folio-doc> [--title T] [--author A]... [--force]
 *
 * Every block it writes ends with its KG node `.jsonld`, written by
 * `gen-block-jsonld`'s own `blockToJsonLd`, so the folio's site publishes a
 * graph.
 *
 * ## What it decides, and what it does not
 *
 * - **The structure is the source's.** Any `structure.json` variant the
 *   library reads (`pdf`, `text`, `notebook`, through `readStructure`): the
 *   top heading level becomes the chapters, deeper levels nest as sections.
 *   No division is inferred.
 * - **Every block is `prose`.** As `l1-blocks.ts` says of ingested text, a
 *   section IS prose until somebody reads it; no persona or requirement is
 *   guessed from a heading. A folio's own enrichment (structured assets,
 *   figures) is its own step.
 * - **Provenance on every block**: `meta.source` names the library, the
 *   section and its locator, with `method: "library-seed"`. The library's
 *   files are read, never written.
 * - **A one-time seed.** An existing document directory is refused unless
 *   `--force`, which discards hand edits, and says so.
 *
 * @module scripts/seed-folio-from-library
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { readStructure, type BaseSection } from "../schemas/content/document-structure.ts";
import { folioDir } from "../schemas/kg/cat-harness.js";
import { plainHeading } from "./lib/library-document.ts";
import { loadBlocksUnder } from "../pipeline/block-module.ts";
import { blockToJsonLd, serialise } from "../pipeline/gen-block-jsonld.ts";
import { findContentRepoRoot } from "../pipeline/repo-root.ts";

const q = (s: unknown) => JSON.stringify(s);
const slugify = (s: string, n = 48) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, n).replace(/-+$/, "");

/** A section's own text: its file without front matter and without its heading line. */
export function sectionBody(md: string): string {
  const body = md.replace(/^---\n[\s\S]*?\n---\n/, "");
  return body.replace(/^\s*#{1,6} [^\n]*\n/, "").trim();
}

interface Node {
  s: BaseSection;
  children: Node[];
}

/** Nest the flat, ordered sections by level: a section owns every deeper one after it. */
export function nest(sections: readonly BaseSection[]): Node[] {
  const top: Node[] = [];
  const stack: Node[] = [];
  for (const s of sections) {
    const n: Node = { s, children: [] };
    while (stack.length && stack[stack.length - 1]!.s.level >= s.level) stack.pop();
    (stack.length ? stack[stack.length - 1]!.children : top).push(n);
    stack.push(n);
  }
  return top;
}

export interface SeedResult {
  docDir: string;
  chapters: number;
  blocks: number;
  nodes: number;
}

export async function seedFolio(o: {
  repoRoot: string;
  entry: string;
  slug: string;
  title?: string;
  authors?: string[];
  force?: boolean;
}): Promise<SeedResult> {
  const entry = resolve(o.repoRoot, o.entry);
  const st = readStructure(entry);
  if ("reason" in st) throw new Error(`cannot seed from ${o.entry}: ${st.reason}`);
  const docDir = join(folioDir(o.repoRoot), o.slug);
  if (existsSync(docDir)) {
    if (!o.force) throw new Error(`${relative(o.repoRoot, docDir)} exists: a seed is one-time (--force discards its hand edits)`);
    rmSync(docDir, { recursive: true, force: true });
  }
  const library = basename(entry);
  const entryRel = relative(o.repoRoot, entry);
  const nodes = nest(st.sections);
  let blocks = 0;
  const written: string[] = [];

  const blockFor = (s: BaseSection, chDir: string): string | undefined => {
    const file = join(entry, "sections", `${s.id}.md`);
    const body = existsSync(file) ? sectionBody(readFileSync(file, "utf-8")) : "";
    if (!body) return undefined;
    const root = `p-${slugify(s.id)}`;
    const source = { library, entry: entryRel, section: s.id, locator: s.locator, method: "library-seed" };
    writeFileSync(
      join(chDir, `${root}.ts`),
      `import { prose } from "../../schema/builders";\n\nexport default prose({\n  label: ${q(`prose:${slugify(s.id)}`)},\n  uses: [],\n  meta: { source: ${q(source)}, title: ${q(plainHeading(s.title))} },\n});\n`,
    );
    writeFileSync(join(chDir, `${root}.md`), body + "\n");
    blocks++;
    return root;
  };

  // A section as builder source; its own text is its first block.
  const sectionSrc = (n: Node, chDir: string, indent: string): string => {
    const own = blockFor(n.s, chDir);
    const subs = n.children.map((c) => sectionSrc(c, chDir, indent + "    "));
    return (
      `${indent}section({\n${indent}  title: ${q(plainHeading(n.s.title))},\n${indent}  label: ${q(`sec:${slugify(n.s.id)}`)},\n` +
      `${indent}  blocks: ${q(own ? [own] : [])},\n` +
      (subs.length ? `${indent}  subsections: [\n${subs.join(",\n")},\n${indent}  ],\n` : "") +
      `${indent}})`
    );
  };

  mkdirSync(docDir, { recursive: true });
  const dirs: string[] = [];
  nodes.forEach((n, i) => {
    const dir = `ch${String(i + 1).padStart(2, "0")}-${slugify(plainHeading(n.s.title), 40) || slugify(n.s.id)}`;
    const chDir = join(docDir, dir);
    mkdirSync(chDir, { recursive: true });
    // The chapter's own text is its lead section; its children follow.
    const lead = blockFor(n.s, chDir);
    const sections = [
      ...(lead ? [`    section({\n      title: ${q(plainHeading(n.s.title))},\n      label: ${q(`sec:${dir}-lead`)},\n      lead: true,\n      blocks: ${q([lead])},\n    })`] : []),
      ...n.children.map((c) => sectionSrc(c, chDir, "    ")),
    ];
    writeFileSync(
      join(chDir, `${dir}.ts`),
      `import { chapter, section } from "../../schema/builders";\n\nexport default chapter({\n  title: ${q(plainHeading(n.s.title))},\n  label: ${q(`chap:${dir}`)},\n  sections: [\n${sections.join(",\n")},\n  ],\n});\n`,
    );
    dirs.push(dir);
  });
  const title = o.title ?? (st.title ? plainHeading(st.title) : o.slug);
  writeFileSync(
    join(docDir, `${o.slug}.ts`),
    `import { paper, chapterRef } from "../schema/builders";\n\n/**\n * Seeded from ${entryRel} by seed-folio-from-library.ts; edited by hand from then on.\n */\nexport default paper({\n  title: ${q(title)},\n  authors: ${q(o.authors?.length ? o.authors : ["Unknown"])},\n  date: ${q(new Date().toISOString().slice(0, 10))},\n  meta: { source: ${q({ library, entry: entryRel, method: "library-seed" })} },\n  chapters: [\n${dirs.map((d) => `    chapterRef({ dir: ${q(d)} }),`).join("\n")}\n  ],\n});\n`,
  );

  // Every block leaves as a KG node, written by the generator's own code.
  const { blocks: loaded, failures } = await loadBlocksUnder(docDir);
  if (failures.length) throw new Error(`seeded blocks did not load: ${failures.map((f) => `${f.file}: ${f.error}`).join("; ")}`);
  for (const b of loaded.values()) {
    const out = b.file.replace(/\.ts$/, ".jsonld");
    writeFileSync(out, serialise(blockToJsonLd(b, o.slug, [])));
    written.push(out);
  }
  return { docDir, chapters: dirs.length, blocks, nodes: written.length };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const one = (f: string) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const entry = one("--entry");
  const slug = one("--slug");
  if (!entry || !slug) {
    console.error("usage: seed-folio-from-library.ts --entry library/<doc-id> --slug <folio-doc> [--title T] [--author A]... [--force]");
    process.exit(2);
  }
  const authors = argv.flatMap((a, i) => (a === "--author" && argv[i + 1] ? [argv[i + 1]!] : []));
  seedFolio({ repoRoot: findContentRepoRoot(), entry, slug, title: one("--title"), authors, force: argv.includes("--force") })
    .then((r) => console.log(`✓ seeded ${relative(process.cwd(), r.docDir)}: ${r.chapters} chapter(s), ${r.blocks} block(s), ${r.nodes} KG node(s)`))
    .catch((e) => {
      console.error(`✗ ${(e as Error).message}`);
      process.exit(1);
    });
}
