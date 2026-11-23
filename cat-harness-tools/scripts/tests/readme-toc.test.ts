/**
 * `readme_toc` — the folio contents table.
 *
 * The defect this replaces was not a crash: `generate-readme.sh` composed
 * `${PAGES}/papers/<paper>/chapters/<dir>.pdf` for every chapter and emitted
 * it as a link. The publish branch has no `chapters/` directory, so all
 * twenty-three links 404'd, in a table that had looked authoritative for
 * months. So the tests that matter here are the ones asserting a link is
 * emitted only when the target is actually published, and that the fallback
 * is a visible `—` rather than a plausible URL.
 */
import { describe, test, expect, afterEach } from "bun:test";
import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";

import {
  chaptersOf,
  discoverPapers,
  injectSection,
  loadReadmeConfig,
  renderToc,
  type ReadmeTocConfig,
} from "../../pipeline/readme-toc";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

/** A folio holding `papers`, each with the given chapter directories. */
function folio(papers: Record<string, string[]>, opts: { folioTs?: boolean } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "folio-toc-"));
  dirs.push(root);
  const content = join(root, "folio");
  mkdirSync(content, { recursive: true });

  for (const [paper, chapters] of Object.entries(papers)) {
    mkdirSync(join(content, paper), { recursive: true });
    const refs = chapters.map((c) => `    chapterRef({ dir: "${c}" }),`).join("\n");
    writeFileSync(
      join(content, paper, `${paper}.ts`),
      `export default paper({\n  title: "Title of ${paper}",\n  chapters: [\n${refs}\n  ],\n});\n`,
    );
    for (const c of chapters) {
      mkdirSync(join(content, paper, c), { recursive: true });
      writeFileSync(join(content, paper, c, `${c}.ts`), `export default chapter({ title: "${c} title" });\n`);
    }
  }

  if (opts.folioTs !== false) {
    const refs = Object.keys(papers)
      .map((p) => `    paperRef({ dir: "${p}" }),`)
      .join("\n");
    writeFileSync(join(content, "folio.ts"), `export default folio({\n  papers: [\n${refs}\n  ],\n});\n`);
  }
  return root;
}

/**
 * A git repo at `root` whose branch `ref` holds `paths`.
 *
 * The publish branch is built with plumbing (`write-tree` / `commit-tree`)
 * against a scratch work tree, so the folio's own files are never checked out
 * or stashed — a `git checkout` here fails the moment the fixture has
 * untracked content, which is always.
 */
function publish(root: string, ref: string, paths: string[]): void {
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid",
                GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
  const g = (args: string[], extra: Record<string, string> = {}, cwd = root): string =>
    execFileSync("git", ["-C", root, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf-8",
      env: { ...env, ...extra },
      cwd,
    }).trim();

  g(["init", "-q", "-b", "main"]);
  g(["remote", "add", "origin", "https://github.com/owner/repo.git"]);

  const pub = mkdtempSync(join(tmpdir(), "folio-pub-"));
  dirs.push(pub);
  for (const p of paths) {
    mkdirSync(dirname(join(pub, p)), { recursive: true });
    writeFileSync(join(pub, p), "%PDF-1.4\n");
  }
  const indexFile = join(pub, ".git-index");
  const withIndex = { GIT_INDEX_FILE: indexFile, GIT_WORK_TREE: pub };
  execFileSync("git", ["--git-dir", join(root, ".git"), "--work-tree", pub, "add", "-A"], {
    cwd: pub,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...env, ...withIndex },
  });
  const tree = g(["write-tree"], withIndex);
  const commit = g(["commit-tree", tree, "-m", "publish"], withIndex);
  g(["update-ref", `refs/heads/${ref}`, commit]);
}

/** Default config with overrides, without touching any folio on disk. */
function config(over: Partial<ReadmeTocConfig> = {}): ReadmeTocConfig {
  return { ...loadReadmeConfig(join(tmpdir(), "folio-toc-absent")), ...over };
}

describe("discovery", () => {
  test("papers come in folio.ts order, not readdir order", () => {
    const root = folio({ zeta: [], alpha: [], mu: [] });
    expect(discoverPapers(root).map((p) => p.dir)).toEqual(["zeta", "alpha", "mu"]);
  });

  test("a folio with no folio.ts falls back to the directory scan", () => {
    const root = folio({ solo: ["intro"] }, { folioTs: false });
    expect(discoverPapers(root).map((p) => p.dir)).toEqual(["solo"]);
  });

  test("chapters keep manifest order and are classified by prefix", () => {
    const root = folio({ p: ["intro", "appendix-tables", "index-of-definitions"] });
    expect(chaptersOf(root, "p").map((c) => c.kind)).toEqual(["chapter", "appendix", "index"]);
  });
});

describe("PDF links are verified, not composed", () => {
  test("a published chapter links; an unpublished one renders an em dash", () => {
    const root = folio({ p: ["one", "two"] });
    publish(root, "gh-pages", ["papers/p/one.pdf"]);
    const md = renderToc(root, config()).markdown;

    expect(md).toContain("https://github.com/owner/repo/blob/gh-pages/papers/p/one.pdf");
    expect(md).not.toContain("two.pdf");
    // The row still exists — the chapter is not hidden, only its dead link is.
    expect(md).toContain("two title");
  });

  test("nothing published means no PDF link anywhere", () => {
    const root = folio({ p: ["one"] });
    publish(root, "gh-pages", ["index.html"]);
    const result = renderToc(root, config());
    expect(result.markdown).not.toContain(".pdf");
    expect(result.missingPdfs).toEqual([{ paper: "p", chapter: "one" }]);
  });

  test("an unreadable publish ref is reported, not silently rendered as unpublished", () => {
    const root = folio({ p: ["one"] });
    publish(root, "gh-pages", ["papers/p/one.pdf"]);
    const result = renderToc(root, config({ publishRef: "no-such-branch" }));
    expect(result.publishRefUnavailable).toBe(true);
    expect(result.markdown).toContain("PDF links unavailable");
    // Not counted as missing: we do not know that they are.
    expect(result.missingPdfs).toEqual([]);
  });
});

describe("link styles", () => {
  const styles = {
    blob: "https://github.com/owner/repo/blob/gh-pages/papers/p/one.pdf",
    raw: "https://raw.githubusercontent.com/owner/repo/gh-pages/papers/p/one.pdf",
    pages: "https://example.github.io/repo/papers/p/one.pdf",
  } as const;

  test.each(Object.entries(styles))("%s renders %s", (style, url) => {
    const root = folio({ p: ["one"] });
    publish(root, "gh-pages", ["papers/p/one.pdf"]);
    const md = renderToc(
      root,
      config({
        linkStyle: style as keyof typeof styles,
        pagesBaseUrl: "https://example.github.io/repo",
      }),
    ).markdown;
    expect(md).toContain(url);
  });

  test("pages and raw both warn that they need a public repository", () => {
    const root = folio({ p: ["one"] });
    publish(root, "gh-pages", ["papers/p/one.pdf"]);
    expect(renderToc(root, config({ linkStyle: "pages", pagesBaseUrl: "https://x.io" })).markdown)
      .toContain("only while Pages is public");
    expect(renderToc(root, config({ linkStyle: "raw" })).markdown)
      .toContain("public");
  });

  test("blob says it works for a private repository", () => {
    const root = folio({ p: ["one"] });
    publish(root, "gh-pages", ["papers/p/one.pdf"]);
    expect(renderToc(root, config()).markdown).toContain("private");
  });
});

describe("every paper in the folio gets a table", () => {
  test("three papers, three sections", () => {
    const root = folio({ first: ["a"], second: ["b"], third: [] });
    publish(root, "gh-pages", ["index.html"]);
    const md = renderToc(root, config()).markdown;
    expect(md).toContain("### Title of first");
    expect(md).toContain("### Title of second");
    expect(md).toContain("### Title of third");
    expect(md).toContain("_No chapters in this paper's manifest yet._");
  });

  test("source links are relative, so they resolve in a private repo's web UI", () => {
    const root = folio({ p: ["one"] });
    publish(root, "gh-pages", ["index.html"]);
    const md = renderToc(root, config()).markdown;
    expect(md).toContain("[`one/`](folio/p/one/)");
  });
});

describe("injectSection", () => {
  const readme = "# T\n\n<!-- folio:toc:begin -->\nold\n<!-- folio:toc:end -->\n\ntail\n";

  test("replaces the marked region and leaves the rest alone", () => {
    const { content, changed } = injectSection(readme, "new body", "folio:toc");
    expect(changed).toBe(true);
    expect(content).toContain("new body");
    expect(content).not.toContain("old");
    expect(content).toContain("tail");
  });

  test("re-injecting identical content is a no-op", () => {
    const once = injectSection(readme, "new body", "folio:toc").content;
    expect(injectSection(once, "new body", "folio:toc").changed).toBe(false);
  });

  test("missing markers throw rather than silently appending or doing nothing", () => {
    expect(() => injectSection("# T\n", "body", "folio:toc")).toThrow(/marker comments/);
  });
});
