/**
 * `readme_audit` — link verification over authored README prose.
 *
 * The finding that motivated this: qou's Published Artefacts table listed
 * `blueprint/` and `docs/`, neither of which has ever existed on `gh-pages`.
 * Both rows were dead in both columns, in a hand-maintained table nobody could
 * regenerate. So the tests worth having are the ones that pin *what counts as
 * checked* — a Pages URL resolves against the publish ref, an unreadable ref
 * makes its links unchecked rather than dead, and a shell example is not a
 * link.
 */
import { describe, test, expect, afterEach } from "bun:test";
import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";

// The auditor moved to harness (bean `cp3l`); `runReadmeAudit` is the
// README front end that stayed. Imported from their real homes rather than
// through the re-export, so this file fails if the move is ever undone by
// accident.
import { auditLinks, classify, parseLinks } from "../../src/core/markdown-links";
import { runReadmeAudit } from "../../pipeline/readme-links";

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const OPTS = {
  repoUrl: "https://github.com/owner/repo",
  pagesBaseUrl: "https://owner.github.io/repo",
  publishRef: "gh-pages",
};

/** A repo at a temp root, with `paths` present in the working tree. */
function repo(paths: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), "folio-links-"));
  dirs.push(root);
  for (const p of paths) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), "x");
  }
  return root;
}

/** Give `root` a git repo whose branch `ref` holds `paths`. */
function publish(root: string, ref: string, paths: string[]): void {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid",
    GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid",
  };
  const g = (args: string[], extra: Record<string, string> = {}): string =>
    execFileSync("git", ["-C", root, ...args], {
      stdio: ["ignore", "pipe", "pipe"], encoding: "utf-8", env: { ...env, ...extra },
    }).trim();

  g(["init", "-q", "-b", "main"]);
  g(["remote", "add", "origin", "https://github.com/owner/repo.git"]);

  const pub = mkdtempSync(join(tmpdir(), "folio-linkpub-"));
  dirs.push(pub);
  for (const p of paths) {
    mkdirSync(dirname(join(pub, p)), { recursive: true });
    writeFileSync(join(pub, p), "x");
  }
  const withIndex = { GIT_INDEX_FILE: join(pub, ".git-index"), GIT_WORK_TREE: pub };
  execFileSync("git", ["--git-dir", join(root, ".git"), "--work-tree", pub, "add", "-A"], {
    cwd: pub, stdio: ["ignore", "pipe", "pipe"], env: { ...env, ...withIndex },
  });
  const tree = g(["write-tree"], withIndex);
  const commit = g(["commit-tree", tree, "-m", "publish"], withIndex);
  g(["update-ref", `refs/heads/${ref}`, commit]);
}

describe("parsing", () => {
  test("finds inline links, images and reference definitions, with line numbers", () => {
    const links = parseLinks(
      "# T\n\nSee [one](a.md) and ![img](b.png).\n\n[ref]: c.md\n",
    );
    expect(links).toEqual([
      { line: 3, text: "one", target: "a.md" },
      { line: 3, text: "img", target: "b.png" },
      { line: 5, text: "ref", target: "c.md" },
    ]);
  });

  test("a fenced shell example is not a link, and line numbers survive it", () => {
    const links = parseLinks(
      "# T\n\n```bash\nrun [thing](not-a-link)\n```\n\n[real](after.md)\n",
    );
    expect(links).toEqual([{ line: 7, text: "real", target: "after.md" }]);
  });

  /**
   * Bean `t373`. HTML links were INVISIBLE to the parser, and the three it
   * missed were the `<img src>` BPMN diagrams at the top of the README — so a
   * reader met three broken images on the front page while the audit reported
   * five problems, none of them those. Silent omission is worse than the
   * unwired gate the same bean records, because it survives wiring the gate up.
   */
  test("HTML `<img src>` and `<a href>` are links too — the t373 hole", () => {
    const got = parseLinks(
      [
        '<img width="700" src="docs/a.svg" alt="x">',
        "<a href='docs/b.md'>text</a>",
        '<img alt="attrs before src" src="docs/c.png">',
      ].join("\n"),
    );
    expect(got.map((l) => l.target)).toEqual(["docs/a.svg", "docs/b.md", "docs/c.png"]);
    // The line number is what makes a finding actionable.
    expect(got.map((l) => l.line)).toEqual([1, 2, 3]);
  });

  test("the src attribute is found wherever it sits in the tag", () => {
    // `<img width="700" src="…">` is the README's own form, so a positional
    // match would have missed every real case while passing a naive fixture.
    expect(parseLinks('<img src="a.svg">')[0].target).toBe("a.svg");
    expect(parseLinks('<img class="c" width="9" src="b.svg" alt="z">')[0].target).toBe("b.svg");
    expect(parseLinks('<IMG SRC="c.svg">')[0].target).toBe("c.svg");
  });

  test("an HTML tag with no src or href contributes no link", () => {
    // A bare `<br>` or a wrapper `<div>` must not become an empty target that
    // then reports as dead — a false finding is as costly as a missed one.
    expect(parseLinks("<br>\n<div>\n<img alt=\"no src\">\n<a>no href</a>")).toEqual([]);
  });

  test("a link title is not part of the target", () => {
    expect(parseLinks('[x](a.md "Title")')[0].target).toBe("a.md");
  });
});

describe("classification", () => {
  test("a Pages URL resolves against the publish ref the site is served from", () => {
    expect(classify("https://owner.github.io/repo/lean/docs/", OPTS)).toEqual({
      kind: "ref", ref: "gh-pages", path: "/lean/docs/",
    });
  });

  test("blob, tree and raw links name their own ref", () => {
    for (const url of [
      "https://github.com/owner/repo/blob/gh-pages/a.pdf",
      "https://github.com/owner/repo/tree/gh-pages/a.pdf",
      "https://raw.githubusercontent.com/owner/repo/gh-pages/a.pdf",
    ]) {
      expect(classify(url, OPTS)).toMatchObject({ kind: "ref", ref: "gh-pages", path: "a.pdf" });
    }
    // A ref that is not the publish ref is honoured as written.
    expect(classify("https://github.com/owner/repo/blob/main/src/x.ts", OPTS))
      .toMatchObject({ ref: "main", path: "src/x.ts" });
  });

  test("another repo, an anchor and a mailto are unchecked, not dead", () => {
    for (const t of [
      "https://github.com/someone/else/blob/main/x.md",
      "https://example.com/",
      "#a-heading",
      "mailto:someone@example.invalid",
    ]) {
      expect(classify(t, OPTS).kind).toBe("unchecked");
    }
  });

  test("fragments and percent-encoding are stripped from the path", () => {
    expect(classify("docs/a%20b.md#sec", OPTS)).toEqual({ kind: "worktree", path: "docs/a b.md" });
  });
});

describe("auditing", () => {
  test("a missing relative path is dead, with the line it is on", () => {
    const root = repo(["real.md"]);
    const result = auditLinks(root, "a\n[ok](real.md)\n[bad](gone.md)\n", OPTS);

    expect(result.ok).toBe(1);
    expect(result.dead).toHaveLength(1);
    expect(result.dead[0]).toMatchObject({ line: 3, text: "bad", target: "gone.md" });
  });

  test("the qou case: a table row pointing at a path never published", () => {
    const root = repo();
    publish(root, "gh-pages", ["lean/docs/index.html"]);
    const src =
      "| Lean docs | [lean/docs/](https://github.com/owner/repo/tree/gh-pages/lean/docs) |\n" +
      "| Blueprint | [blueprint/](https://github.com/owner/repo/tree/gh-pages/blueprint) |\n";
    const result = auditLinks(root, src, OPTS);

    expect(result.ok).toBe(1);
    expect(result.dead.map((d) => d.text)).toEqual(["blueprint/"]);
  });

  test("a directory resolves when anything sits under it", () => {
    const root = repo();
    publish(root, "gh-pages", ["python-api/index.html"]);
    const result = auditLinks(
      root, "[api](https://owner.github.io/repo/python-api/)\n", OPTS,
    );
    expect(result.dead).toEqual([]);
    expect(result.ok).toBe(1);
  });

  test("an unreadable ref makes its links unchecked — never dead", () => {
    const root = repo();
    publish(root, "gh-pages", ["a.pdf"]);
    const result = auditLinks(
      root, "[x](https://github.com/owner/repo/blob/no-such-ref/a.pdf)\n", OPTS,
    );

    expect(result.dead).toEqual([]);
    expect(result.checked).toBe(0);
    expect(Object.keys(result.unchecked).join()).toContain("not readable");
  });

  test("external links are counted, not fetched", () => {
    const root = repo();
    const result = auditLinks(root, "[a](https://example.com/x)\n", OPTS);

    expect(result.checked).toBe(0);
    expect(result.unchecked["external URL (not fetched)"]).toBe(1);
  });
});

describe("runReadmeAudit", () => {
  test("exits 1 and names the file and line when a link is dead", () => {
    const root = repo(["README.md"]);
    writeFileSync(join(root, "README.md"), "# T\n\n[gone](missing.md)\n");
    const result = runReadmeAudit({ root });

    expect(result.exitCode).toBe(1);
    expect(result.text).toContain("README.md:3");
    expect(result.text).toContain("1 dead");
  });

  /**
   * The integration half of the `t373` fix. The parse tests above prove the
   * links are SEEN; this proves they reach the checker and change the exit
   * code, which is the only thing CI reads. Without it the extraction could be
   * correct and the gate still green.
   */
  test("a dead HTML <img src> fails the audit, exactly as a dead Markdown link does", () => {
    const root = repo(["README.md", "live.svg"]);
    writeFileSync(
      join(root, "README.md"),
      '# T\n\n<img width="700" src="live.svg" alt="ok">\n<img width="700" src="gone.svg" alt="bad">\n',
    );
    const result = runReadmeAudit({ root });

    expect(result.exitCode).toBe(1);
    // Line 4, not line 3: the live one must not be blamed for the dead one.
    expect(result.text).toContain("README.md:4");
    expect(result.text).toContain("gone.svg");
    expect(result.text).toContain("2 link(s) checked");
    expect(result.text).toContain("1 dead");
  });

  test("exits 0 on a clean file and still reports what it could not check", () => {
    const root = repo(["README.md", "there.md"]);
    writeFileSync(join(root, "README.md"), "[a](there.md) [b](https://example.com)\n");
    const result = runReadmeAudit({ root });

    expect(result.exitCode).toBe(0);
    expect(result.text).toContain("1 not checked");
  });

  test("a missing file is an error, not a clean pass", () => {
    expect(runReadmeAudit({ root: repo() }).exitCode).toBe(2);
  });
});

// folio-assistant-tsh9: `readme:audit` honours a move the layer declares
// (sdlc skill `two-phase-move`) until its `until`, and not after.
describe("runReadmeAudit and a declared move", () => {
  const moved = (until: string): string => {
    const root = repo(["new/x.md"]);
    const name = root.split("/").pop()!;
    writeFileSync(join(root, `${name}.json`), JSON.stringify({ name, directories: [], moves: [{ from: "old", to: "new", until }] }));
    writeFileSync(join(root, "README.md"), "# T\n\n[x](old/x.md)\n");
    return root;
  };

  test("a link to the old path passes in the window, reported as moved", () => {
    const result = runReadmeAudit({ root: moved("2099-12-31") });
    expect(result.exitCode).toBe(0);
    expect(result.text).toContain("1 through a declared move");
  });

  test("an expired move gives no relief", () => {
    const result = runReadmeAudit({ root: moved("2020-01-01") });
    expect(result.exitCode).toBe(1);
    expect(result.text).toContain("1 dead");
  });
});
