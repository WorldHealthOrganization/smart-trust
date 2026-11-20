/**
 * A `publish: "staging-only"` visualisation reaches a preview and never the
 * canonical deploy.
 *
 * Owner, 2026-09-21, on `fsh-guts`: **render it, exclude it from canonical.**
 * They had asked to see a graph whose own declaration says it is
 * *"DELIBERATELY absent from the rendered site … so that something can be kept
 * without being published"*, and both halves were meant.
 *
 * ## Why these assertions are shaped the way they are
 *
 * This feature fails in two directions and they are not symmetric. Withholding
 * too much loses a page from a preview, where the person looking at the
 * preview sees it missing. Withholding too little **publishes content somebody
 * chose not to publish**, which is visible nowhere in the build and is not
 * undone by deleting the page afterwards.
 *
 * So the default is tested as hard as the feature: a compose with NO options
 * must withhold. A test that only ever passed an explicit flag would pass just
 * as happily if the default were reversed, which is the single most expensive
 * thing that could be wrong here.
 *
 * The layer-root guard has its own test for the same reason. A visualiser ref
 * sitting directly in `cat-harness/docs/` is an ordinary declaration, and
 * without the guard one such ref marked staging-only would withhold `""` —
 * emptying the canonical deploy. That is a whole-site outage reachable from a
 * one-word declaration, and it is exactly the kind of thing that is obvious
 * once written down and invisible until then.
 *
 * @module cat-harness/scripts/tests/staging-only-publish.test
 *
 * The tests that read the real declaration and compose the real tree live in
 * `cat-harness-tools/test/coordinator/staging-only-publish-repo-root.test.ts`
 * (bean `ho66`). The ones that read the index repository's own
 * `.github/workflows/` — that the preview composes with `--staging` and the
 * canonical publisher without it — live in that repository's
 * `test/workflows/staging-only-publish.test.ts` (owner's ruling 2026-10-09,
 * litlfred/folio-assistant#2521, ruling 1(c)). The ones that read the
 * `fsh-guts` trashcan, kept on a state branch only a composed checkout
 * mounts, report themselves not applicable standing alone.
 */
import { beforeAll, describe, expect, it } from "bun:test";
import { spawnBounded } from "../../../test/support/bounded-spawn.ts";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { baseDocsDir, compose, isWithheld, withheldFromCanonical, withheldPathFor } from "../../compose-docs.js";
import { gutsDir, gutsFiles, page, pageRelPath } from "../../gen-fsh-guts-viz.js";
import { notApplicableAlone } from "../../../test/support/checkout.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));

// The page is BUILT AT PUBLISH (bean 0b8c, #2230): derived from a graph kept on
// a branch, so it is never committed. Build it with the writer cat-harness
// declares for it (`visualisers`: fsh-guts, writer `scripts/gen-fsh-guts-viz.ts`,
// the `fsh-guts:viz` script), so the compose below sees the page a real build
// writes. Fails loudly, like the build, when fsh-guts is unmounted. Where it
// cannot be built (no mount; a standalone layer with no root script), the
// tests that need the page fail on their own, by name, rather than this hook
// failing the whole file.
//
// Not the whole `derive:publish`. Since B1 (owner, 2026-10-14) that runs
// every declared `builtAtPublish` writer of every layer: 112 s on run
// 38696377785's publish job, and past this hook's 300 s budget in bun-test
// shards 3 and 4 of main 03ded48, which failed as "(unnamed) a beforeAll hook
// timed out" with no assertion run. It also rewrote, mid-shard, artefacts
// other test files were reading. This file needs one page; it builds one page.
//
// Built only when the page is ABSENT (bean `cat-tools-sm8r` item 4): the
// layer commits a copy, and a rebuild from the live state branch rewrote
// those committed bytes inside a mounted layer. These tests need the page to
// exist, not to be drawn from today's state.
const BUILD_BUDGET_MS = 60_000;
beforeAll(() => {
  const rel = pageRelPath(REPO);
  if (rel !== undefined && existsSync(join(baseDocsDir(REPO), rel))) return;
  // Bounded, and its whole process group killed on a timeout (`spawnBounded`):
  // a writer left running would keep writing into the tree after this hook.
  const r = spawnBounded(["bun", "run", "cat", "fsh-guts:viz"], REPO, BUILD_BUDGET_MS);
  if (r.timedOut) console.warn(`fsh-guts:viz did not finish within ${BUILD_BUDGET_MS} ms; its process group was killed`);
  else if (r.status !== 0) console.warn(`fsh-guts:viz did not build the page (is fsh-guts mounted? \`bun run cat state:mount\`):\n${r.stdout}${r.stderr}`);
}, BUILD_BUDGET_MS);

function composeTo(opts: { staging?: boolean }): { dir: string; report: ReturnType<typeof compose> } {
  const dir = mkdtempSync(join(tmpdir(), "compose-"));
  return { dir, report: compose(dir, REPO, opts) };
}

describe("the real declaration withholds fsh-guts and nothing else", () => {

  it("never withholds a layer root, whatever is declared", () => {
    // A property of the OUTPUT: an empty string or a bare "/" would match
    // every path. True today because nothing declares a ref at a layer root —
    // which is exactly why the guard itself is tested directly below.
    for (const w of withheldFromCanonical(REPO)) {
      expect(w).not.toBe("");
      expect(w).not.toBe("/");
      expect(w.length).toBeGreaterThan(1);
    }
  });
});

describe("withheldPathFor — the layer-root guard, reachable", () => {
  /**
   * THE CASE NO TEST OVER THE REAL TREE CAN REACH. Nothing here declares a
   * visualiser ref directly in `cat-harness/docs/`, so the guard is dead code
   * from the corpus's point of view — and the failure it prevents is the
   * canonical deploy composing to an empty site, reachable from adding one
   * word to an ordinary declaration.
   */
  it("an index.* at the LAYER ROOT withholds only itself", () => {
    expect(withheldPathFor("index.md")).toBe("index.md");
    expect(withheldPathFor("index.html")).toBe("index.html");
  });

  it("an index.* in a subdirectory withholds that directory", () => {
    expect(withheldPathFor("fsh-guts/index.md")).toBe("fsh-guts/");
    expect(withheldPathFor("a/b/index.html")).toBe("a/b/");
  });

  it("a non-index page withholds only itself, at any depth", () => {
    expect(withheldPathFor("notes.md")).toBe("notes.md");
    expect(withheldPathFor("a/notes.md")).toBe("a/notes.md");
    // `index` as a stem but not the whole basename — not an index page.
    expect(withheldPathFor("a/index-of-things.md")).toBe("a/index-of-things.md");
  });

  it("what it returns can never match the whole tree", () => {
    // The property the guard exists for, over every shape above.
    for (const r of ["index.md", "index.html", "a/index.md", "notes.md", "a/b/index.html"]) {
      const w = withheldPathFor(r);
      expect(w).not.toBe("");
      expect(w).not.toBe("/");
      expect(isWithheld("some/other/page.md", [w])).toBe(false);
    }
  });
});

describe("isWithheld distinguishes a file from a directory prefix", () => {
  it("a directory entry matches everything beneath it", () => {
    expect(isWithheld("fsh-guts/index.md", ["fsh-guts/"])).toBe(true);
    expect(isWithheld("fsh-guts/assets/app.js", ["fsh-guts/"])).toBe(true);
  });

  it("a directory entry does not match a sibling with a shared prefix", () => {
    // `fsh-guts-notes.md` starts with `fsh-guts` and is a different file. The
    // trailing slash is what makes the prefix test safe, so it is asserted.
    expect(isWithheld("fsh-guts-notes.md", ["fsh-guts/"])).toBe(false);
  });

  it("a file entry matches only itself", () => {
    expect(isWithheld("a.md", ["a.md"])).toBe(true);
    expect(isWithheld("a.md.bak", ["a.md"])).toBe(false);
    expect(isWithheld("sub/a.md", ["a.md"])).toBe(false);
  });

  it("nothing is withheld when the list is empty", () => {
    expect(isWithheld("fsh-guts/index.md", [])).toBe(false);
  });
});

describe("composing honours the default, which is the restrictive one", () => {

  it("a withheld file is never also reported as supplied", () => {
    // The report has to stay coherent: naming a file the tree does not carry
    // is worse than not reporting it, because a reader checks the report.
    const { dir, report } = composeTo({});
    try {
      for (const w of report.withheld) expect(report.suppliedBy[w]).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// The page's corpus is the `fsh-guts` trashcan's content, kept on a state
// branch that only a composed checkout mounts: standing alone these are not
// applicable. Composed, they run, and an unmounted trashcan fails them.
const NO_TRASHCAN = notApplicableAlone(
  "the `fsh-guts` trashcan's content (kept on its state branch, mounted only in a composed checkout)",
);

describe.skipIf(NO_TRASHCAN)("the fsh-guts page reports the declaration gap rather than hiding it", () => {
  // Read inside the tests: `describe.skipIf` still runs this body, and
  // standing alone the scan throws on the absent directory.
  let read: ReturnType<typeof gutsFiles> | undefined;
  const corpus = (): ReturnType<typeof gutsFiles> => {
    if (read) return read;
    const dir = gutsDir(REPO);
    return (read = dir ? gutsFiles(dir) : []);
  };

  it("classifies every file into exactly one of the three states", () => {
    for (const f of corpus()) expect(["declared", "sidecar", "undeclared"]).toContain(f.state);
  });

  it("the page names the undeclared count rather than only the total", () => {
    const n = corpus().filter((f) => f.state === "undeclared").length;
    const html = page(corpus(), "https://example.invalid");
    expect(html).toContain(`| ${n} |`);
    if (n > 0) expect(html).toContain("undeclared");
  });

  it("every file in the corpus appears on the page", () => {
    const html = page(corpus(), "https://example.invalid");
    for (const f of corpus()) {
      const name = f.rel.slice(f.group === "." ? 0 : f.group.length + 1);
      expect(html).toContain(name);
    }
  });

  it("the page says it is not published, since that is not obvious from it", () => {
    expect(page(corpus(), "https://example.invalid")).toContain("not on the published site");
  });
});
