/**
 * A mount renders the markdown pages it publishes — bean `mw5z`.
 *
 * Measured on who-iris's published site before this: `style-guide.md` served
 * as raw markdown and `style-guide.html` a 404, because a mounted directory is
 * copied after Jekyll and nothing rendered it.
 *
 * @module scripts/tests/mount-render-markdown.test
 */
import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { generatedOnlyFrontMatter, renderMountedMarkdown } from "../../mount-instance-docs.ts";
import { siteDir } from "../../../schemas/kg/cat-harness.ts";

function site(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "mount-md-"));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return dir;
}

describe("renderMountedMarkdown", () => {
  it("renders a hand-written page beside its source, tables and links included", async () => {
    const dir = site({
      "style-guide.md": "# The WHO style guide\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nSee [the agents page](style-guide-agents.md#rules).\n",
      "style-guide-agents.md": "# Working on a voice\n",
    });
    try {
      const { rendered } = await renderMountedMarkdown(dir);
      expect(rendered).toEqual(["style-guide-agents.html", "style-guide.html"]);
      const html = readFileSync(join(dir, "style-guide.html"), "utf-8");
      expect(html).toContain("<title>The WHO style guide</title>");
      expect(html).toContain("<table>");
      expect(html).toContain('href="style-guide-agents.html#rules"');
      expect(existsSync(join(dir, "style-guide.md"))).toBe(true); // the source stays reachable
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("never overwrites a generated page, and leaves a Jekyll page (front matter) alone", async () => {
    const dir = site({
      "index.html": "<html><body>generated</body></html>",
      "kg-to-portal.md": "# source of a generated page\n",
      "kg-to-portal.html": "<html><body>generated</body></html>",
      "site-home.md": "---\nlayout: default\npermalink: /\n---\n\n{% include landing.html %}\n",
      "README.md": "# Docs\n",
    });
    try {
      const { rendered } = await renderMountedMarkdown(dir);
      expect(rendered).toEqual(["README.html"]);
      expect(readFileSync(join(dir, "kg-to-portal.html"), "utf-8")).toContain("generated");
      expect(readFileSync(join(dir, "index.html"), "utf-8")).toContain("generated");
      expect(existsSync(join(dir, "site-home.html"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // bootstrap-tools#24 (owner, 2026-10-16, decision 4a): a README that
  // `subgraph-readmes` writes wholly opens with a `generated:` key. That is a
  // declaration, not a Jekyll page, so the README still gets its pages.
  it("renders a page whose front matter is only `generated:`, with the block stripped", async () => {
    const fm = '---\ngenerated: "scripts/subgraph-readmes.ts of the bootstrap toolset (https://github.com/litlfred/bootstrap-tools) — do not edit; regenerate"\n---\n';
    const dir = site({
      "sub/README.md": `${fm}<!-- kg:subgraph:begin -->\n# Sub\n\n| a | b |\n|---|---|\n| 1 | 2 |\n<!-- kg:subgraph:end -->\n`,
      "page.md": "---\ngenerated: x\ntitle: A Jekyll page\n---\n\n# Page\n",
    });
    try {
      const { rendered } = await renderMountedMarkdown(dir);
      expect(rendered).toEqual(["sub/README.html", "sub/index.html"]);
      const html = readFileSync(join(dir, "sub", "README.html"), "utf-8");
      expect(html).toContain("<title>Sub</title>");
      expect(html).toContain("<table>");
      expect(html).not.toContain("generated:");
      expect(html).not.toContain("<hr");
      // Any other key keeps it a Jekyll page, left alone as before.
      expect(existsSync(join(dir, "page.html"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("generatedOnlyFrontMatter: one top-level `generated` key, nothing else", () => {
    expect(generatedOnlyFrontMatter("---\ngenerated: x\n---\n# A\n")).toBe("---\ngenerated: x\n---\n");
    expect(generatedOnlyFrontMatter("---\r\ngenerated: x\r\n---\r\n# A\n")).toBe("---\r\ngenerated: x\r\n---\r\n");
    expect(generatedOnlyFrontMatter("---\n# why\ngenerated: >-\n  a long\n  value\n---\n")).toBeDefined();
    expect(generatedOnlyFrontMatter("---\ngenerated: x\nlayout: default\n---\n")).toBeUndefined();
    expect(generatedOnlyFrontMatter("---\ngenerated:\n---\n")).toBeUndefined();
    expect(generatedOnlyFrontMatter("---\nlayout: default\n---\n")).toBeUndefined();
    expect(generatedOnlyFrontMatter("# no front matter\n")).toBeUndefined();
  });

  it("a README becomes the directory's index when it has none, in subdirectories too", async () => {
    const dir = site({ "sub/README.md": "# Sub\n" });
    try {
      expect((await renderMountedMarkdown(dir)).rendered).toEqual(["sub/README.html", "sub/index.html"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a link leaving the mount becomes a repository URL; one leaving the instance is unresolved", async () => {
    const instance = mkdtempSync(join(tmpdir(), "mount-md-inst-"));
    const dest = mkdtempSync(join(tmpdir(), "mount-md-site-"));
    try {
      const text = "# Agents\n\n[library](../library/) [agents](../AGENTS.md#top) [sibling](style-guide.md) [root](../../AGENTS.md) [web](https://example.org/x.md) [assets](assets/) [guide](guide/)\n";
      // The layer's site directory, composed in one place (`site-dir-single-answer`).
      const docs = join(instance, siteDir({ name: "who-iris" }));
      mkdirSync(join(docs, "assets"), { recursive: true });
      mkdirSync(join(docs, "guide"), { recursive: true });
      writeFileSync(join(docs, "guide", "README.md"), "# Guide\n");
      writeFileSync(join(docs, "a.md"), text);
      // `dest` is the mount's copy of `docs`, as mount-instance-docs makes it.
      mkdirSync(join(dest, "assets"), { recursive: true });
      mkdirSync(join(dest, "guide"), { recursive: true });
      writeFileSync(join(dest, "guide", "README.md"), "# Guide\n");
      writeFileSync(join(dest, "a.md"), text);
      const { rendered, unresolved } = await renderMountedMarkdown(dest, {
        dir: docs,
        instanceDir: instance,
        repository: "example/who-iris",
      });
      expect(rendered).toEqual(["a.html", "guide/README.html", "guide/index.html"]);
      const html = readFileSync(join(dest, "a.html"), "utf-8");
      expect(html).toContain('href="https://github.com/example/who-iris/tree/HEAD/library/"');
      expect(html).toContain('href="https://github.com/example/who-iris/blob/HEAD/AGENTS.md#top"');
      expect(html).toContain('href="style-guide.html"');
      expect(html).toContain('href="https://example.org/x.md"');
      // A directory with no page of its own is cited by repository; one with a README renders as a page.
      expect(html).toContain('href="https://github.com/example/who-iris/tree/HEAD/docs/assets/"');
      expect(html).toContain('href="guide/"');
      expect(unresolved).toEqual(['a.md: "../../AGENTS.md" climbs out of the instance']);
    } finally {
      rmSync(instance, { recursive: true, force: true });
      rmSync(dest, { recursive: true, force: true });
    }
  });

  it("a link to what the copy left out, or to a Jekyll page it never renders, becomes a repository URL", async () => {
    // who-iris's docs README linked `catalogue/` (a held visualiser page) and
    // `site-home.md` (a Jekyll page): both were dead on smart-trust's site.
    const instance = mkdtempSync(join(tmpdir(), "mount-md-inst-"));
    const dest = mkdtempSync(join(tmpdir(), "mount-md-site-"));
    try {
      const text = "# Docs\n\n[catalogue](catalogue/) [home](site-home.md) [guide](style-guide.md)\n";
      const docs = join(instance, siteDir({ name: "who-iris" }));
      mkdirSync(join(docs, "catalogue"), { recursive: true });
      writeFileSync(join(docs, "catalogue", "index.html"), "<p>catalogue</p>");
      writeFileSync(join(docs, "site-home.md"), "---\nlayout: home\n---\n{% include x.html %}\n");
      writeFileSync(join(docs, "style-guide.md"), "# Style\n");
      writeFileSync(join(docs, "README.md"), text);
      // The copy: `catalogue/` held back, the rest as they are.
      writeFileSync(join(dest, "site-home.md"), "---\nlayout: home\n---\n{% include x.html %}\n");
      writeFileSync(join(dest, "style-guide.md"), "# Style\n");
      writeFileSync(join(dest, "README.md"), text);
      const { unresolved } = await renderMountedMarkdown(dest, { dir: docs, instanceDir: instance, repository: "example/who-iris" });
      const html = readFileSync(join(dest, "README.html"), "utf-8");
      expect(html).toContain('href="https://github.com/example/who-iris/tree/HEAD/docs/catalogue/"');
      expect(html).toContain('href="https://github.com/example/who-iris/blob/HEAD/docs/site-home.md"');
      expect(html).toContain('href="style-guide.html"');
      expect(unresolved).toEqual([]);
    } finally {
      rmSync(instance, { recursive: true, force: true });
      rmSync(dest, { recursive: true, force: true });
    }
  });
});
