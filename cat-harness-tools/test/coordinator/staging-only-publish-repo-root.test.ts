/**
 * `staging-only-publish` tests that read the aggregate repository's own root —
 * the root-declared `fsh-guts` trashcan and
 * `.github/workflows/feature-staging.yml` — moved here from
 * `cat-harness-tools/scripts/tests/sdlc/staging-only-publish.test.ts` (bean `ho66`), as
 * `merge-guard-workflows.test.ts` was: a standalone cat-harness layer has no
 * such root, and `check:cat-harness-standalone` collects every test in that
 * layer. The rest of that file's tests stay there.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { beforeAll, describe, expect, it } from "bun:test";
import { spawnBounded } from "../support/bounded-spawn.ts";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { baseDocsDir, compose, isWithheld, withheldFromCanonical } from "../../scripts/compose-docs.js";
import { gutsDir, gutsFiles, pageRelPath } from "../../scripts/gen-fsh-guts-viz.js";

/**
 * The directory this test was written in (`cat-harness/scripts/tests/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = resolve(ORIGIN_DIR, "..", "..", "..");

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
// Built only when the page is ABSENT (bean `cat-tools-sm8r` item 4). The
// layer commits a copy, so in a mounted checkout it is there, and a rebuild
// from the live state branch rewrote those committed bytes: the mount read
// `edited` after one `bun test`. These tests need the page to exist; which
// state it was drawn from is not what they assert.
const BUILD_BUDGET_MS = 60_000;
beforeAll(() => {
  const page = pageRelPath(REPO);
  if (page !== undefined && existsSync(join(baseDocsDir(REPO), page))) return;
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
  /**
   * Against the REAL tree rather than a fixture. A fixture would prove the
   * function works on data the test wrote; the question that matters is
   * whether this repository's own declaration produces the intended set.
   */
  it("withholds exactly the fsh-guts page directory", () => {
    // At both addresses since the locale routes (folio-assistant#2527): the
    // localised route the page is written to, and the old one, where a site
    // not yet regenerated still holds it (compose-docs `withheldFromCanonical`).
    expect(withheldFromCanonical(REPO)).toEqual(["cat-harness/fsh-guts/", "en/cat-harness/fsh-guts/"]);
  });
});

describe("composing honours the default, which is the restrictive one", () => {
  it("a compose with NO options withholds — the default is not permissive", () => {
    // THE ASSERTION THIS FILE EXISTS FOR. Passing no options is what
    // `docs-site.yml` does, so this is the canonical publisher's own call.
    const { dir, report } = composeTo({});
    // Where the generator writes the page, in the composed tree too.
    const page = pageRelPath(REPO)!;
    try {
      expect(existsSync(join(dir, page))).toBe(false);
      expect(report.withheld).toContain(page);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("an explicit staging compose includes the page", () => {
    const { dir, report } = composeTo({ staging: true });
    try {
      expect(existsSync(join(dir, pageRelPath(REPO)!))).toBe(true);
      expect(report.withheld).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the two trees differ by exactly the withheld files", () => {
    const canon = composeTo({});
    const stage = composeTo({ staging: true });
    try {
      const a = Object.keys(canon.report.suppliedBy).length;
      const b = Object.keys(stage.report.suppliedBy).length;
      expect(b - a).toBe(canon.report.withheld.length);
      expect(canon.report.withheld.length).toBeGreaterThan(0);
      // By name, not only by count: the canonical tree is the staging tree
      // with exactly the withheld files taken out.
      const canonKeys = new Set(Object.keys(canon.report.suppliedBy));
      const stageKeys = new Set(Object.keys(stage.report.suppliedBy));
      expect([...canonKeys].filter((k) => !stageKeys.has(k))).toEqual([]);
      expect([...stageKeys].filter((k) => !canonKeys.has(k)).sort()).toEqual([...canon.report.withheld].sort());
    } finally {
      rmSync(canon.dir, { recursive: true, force: true });
      rmSync(stage.dir, { recursive: true, force: true });
    }
    // Two full composes of the real tree in one body: ~5 s on an idle runner,
    // so bun's 5 s default times it out under any load (measured 5.1-6.2 s).
  }, 30_000);
});

describe("the fsh-guts page reports the declaration gap rather than hiding it", () => {
  const dir = gutsDir(REPO);
  const files = dir ? gutsFiles(dir) : [];

  it("reads a non-empty corpus", () => {
    // Vacuity guard: every assertion below is over `files`.
    expect(dir).toBeDefined();
    expect(files.length).toBeGreaterThan(0);
  });

  it("a file that CANNOT carry front matter, with a tagged sidecar, is `sidecar`", () => {
    // The distinction the page is built on: a file whose format has no YAML
    // header cannot carry the tag, so filing it beside a `.md` that simply
    // omitted the line would make the format's limit and somebody's omission
    // look the same.
    //
    // This asserted `/\.(py|ts|sh)$/` until 2026-09-30, which is the SAME
    // too-narrow rule the generator had — so the test could not have caught
    // it, and `detangle-schema-viewer.html` read as `undeclared` from the day
    // it arrived. The invariant is "not markdown", not a list of extensions;
    // bean `q7ey`'s sweep of 33 archived PDFs is what made the gap visible.
    const viaSidecar = files.filter((f) => f.state === "sidecar");
    expect(viaSidecar.length).toBeGreaterThan(0);
    for (const f of viaSidecar) expect(f.rel.endsWith(".md")).toBe(false);
  });
});

describe("the generator writes exactly what the withholding protects", () => {
  /**
   * THE INVARIANT THE WHOLE DESIGN RESTS ON, and the one a reader cannot check
   * by eye. Two independent readers of the same declaration:
   *
   * - `pageRelPath` decides where the generator WRITES the page;
   * - `withheldFromCanonical` decides which path the canonical build WITHHOLDS.
   *
   * If they ever disagree — a literal reintroduced on either side, a ref moved
   * and one reader updated — the generator writes a page that nothing protects
   * and the canonical deploy publishes it. Nothing about that failure is
   * visible from the build: the page renders, the gate passes, the withholding
   * reports a file it protected, and the wrong file ships.
   *
   * So it is asserted as AGREEMENT rather than against either path's value. A
   * test naming `fsh-guts/index.md` twice would be a third copy of the literal
   * the `check:declared-paths` gate just removed.
   */
  it("the written page is covered by the withheld set", () => {
    const rel = pageRelPath(REPO);
    expect(rel).toBeDefined();
    expect(isWithheld(rel!, withheldFromCanonical(REPO))).toBe(true);
  });

  it("and it is genuinely absent from a canonical compose", () => {
    // The same fact from the other end, against the composed tree rather than
    // the path arithmetic, so a bug shared by both readers still fails here.
    const rel = pageRelPath(REPO)!;
    const { dir } = composeTo({});
    try {
      expect(existsSync(join(dir, rel))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("and present in a staging compose", () => {
    const rel = pageRelPath(REPO)!;
    const { dir } = composeTo({ staging: true });
    try {
      expect(existsSync(join(dir, rel))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
