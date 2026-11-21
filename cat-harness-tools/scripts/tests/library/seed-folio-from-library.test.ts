/**
 * Markdown to KG, end to end through the platform's own steps (owner,
 * 2026-10-14): a text source becomes a library entry (text-structure.ts), the
 * entry seeds a folio document, and every seeded block is a current KG node.
 * The source is read, never written.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { initFolio } from "../../init-folio";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { nest, sectionBody } from "../../seed-folio-from-library";

const REPO_ROOT = resolve(dirname(HARNESS_ROOT));
const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const SOURCE = `# Part one

Opening words.

## Chapter A

A's text.

### A detail

Detail text.

# Part two

Closing words.
`;

const run = (cwd: string, script: string, args: string[]) =>
  spawnSync("bun", ["run", join(REPO_ROOT, "cat-harness-tools", script), ...args], { cwd, encoding: "utf-8", env: { ...process.env } });

describe("seed-folio-from-library", () => {
  test("nests by level and strips a section's front matter and heading", () => {
    const s = (id: string, level: number) => ({ id, number: null, title: id, level, n_chars: 0, n_words: 0, locator: {} as never });
    const t = nest([s("a", 1), s("b", 2), s("c", 3), s("d", 2), s("e", 1)]);
    expect(t.map((n) => n.s.id)).toEqual(["a", "e"]);
    expect(t[0]!.children.map((n) => n.s.id)).toEqual(["b", "d"]);
    expect(t[0]!.children[0]!.children.map((n) => n.s.id)).toEqual(["c"]);
    expect(sectionBody("---\nx: 1\n---\n# Title\n\nBody.\n")).toBe("Body.");
  });

  test("Markdown → library entry → folio document, every block a current KG node", () => {
    const repo = mkdtempSync(join(tmpdir(), "seed-folio-"));
    dirs.push(repo);
    const folio = join(repo, "doc");
    initFolio({ targetDir: folio, contentType: "document", slug: "starter", title: "Starter", authors: ["A"], link: "sibling", assistantPath: "../platform", skipVcs: true });
    symlinkSync(REPO_ROOT, join(repo, "platform"));
    const src = join(repo, "src");
    mkdirSync(src);
    writeFileSync(join(src, "outline.md"), SOURCE);

    const ingest = run(folio, "scripts/text-structure.ts", ["-o", join(folio, "library"), "--doc-id", "outline", "--base", src, join(src, "outline.md")]);
    expect(ingest.status, ingest.stderr).toBe(0);

    const seed = run(folio, "scripts/seed-folio-from-library.ts", ["--entry", "library/outline", "--slug", "seeded", "--author", "A"]);
    expect(seed.status, seed.stderr).toBe(0);
    expect(seed.stdout).toContain("2 chapter(s), 4 block(s), 4 KG node(s)");
    const block = join(folio, "folio", "seeded", "ch01-part-one", "p-s003-a-detail.md");
    expect(existsSync(block)).toBe(true);
    expect(readFileSync(block, "utf-8")).toBe("Detail text.\n");
    expect(existsSync(block.replace(/\.md$/, ".jsonld"))).toBe(true);

    const check = run(folio, "pipeline/gen-block-jsonld.ts", ["--paper", "seeded", "--check"]);
    expect(check.stdout + check.stderr).toContain("4 sibling(s) up to date");
    // The source is untouched, and a second seed is refused without --force.
    expect(readFileSync(join(src, "outline.md"), "utf-8")).toBe(SOURCE);
    const again = run(folio, "scripts/seed-folio-from-library.ts", ["--entry", "library/outline", "--slug", "seeded"]);
    expect(again.status).toBe(1);
    expect(again.stderr).toContain("one-time");
  });
});
