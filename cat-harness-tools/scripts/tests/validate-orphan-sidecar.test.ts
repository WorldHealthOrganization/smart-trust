import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "fs";
import { tmpdir } from "os";
import { join, basename } from "path";
import { validateObjects } from "../../pipeline/validate";

/**
 * A chapter directory containing `blocks` as `.ts` + `.md` pairs, plus any
 * bare `sidecars` written with no manifest behind them.
 */
function chapter(blocks: string[], sidecars: string[] = []): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "orphan-")));
  for (const b of blocks) {
    writeFileSync(
      join(root, `${b}.ts`),
      `export default { kind: "prose", label: "rem:${b}", title: "T", chapter: "c" };\n`,
    );
    writeFileSync(join(root, `${b}.md`), `Body of ${b}.\n`);
  }
  for (const s of sidecars) {
    writeFileSync(
      join(root, `${s}.qa.json`),
      JSON.stringify({ $schema: "block-qa/v1", label: `rem:${s}`, criteria: {} }),
    );
  }
  return root;
}

function orphanIssues(issues: Array<{ message: string }>) {
  return issues.filter((i) => i.message.includes("orphan QA sidecar"));
}

describe("no-orphan-sidecar", () => {
  test("flags a .qa.json whose .ts is gone", async () => {
    const dir = chapter(["alpha"], ["ghost"]);
    const { issues } = await validateObjects(dir);
    const found = orphanIssues(issues);
    expect(found.length).toBe(1);
    expect(found[0].message).toContain("ghost.qa.json");
    rmSync(dir, { recursive: true, force: true });
  });

  test("does not flag a sidecar that has its manifest", async () => {
    const dir = chapter(["alpha"], ["alpha"]);
    const { issues } = await validateObjects(dir);
    expect(orphanIssues(issues).length).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  test("clean chapter with no sidecars at all is fine", async () => {
    const dir = chapter(["alpha", "beta"]);
    const { issues } = await validateObjects(dir);
    expect(orphanIssues(issues).length).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  test("reports every orphan, not just the first", async () => {
    const dir = chapter(["alpha"], ["ghost-one", "ghost-two"]);
    const { issues } = await validateObjects(dir);
    expect(orphanIssues(issues).length).toBe(2);
    rmSync(dir, { recursive: true, force: true });
  });

  test("does not flag a paper-level audit artefact that shares the extension", async () => {
    // `qa-section-title-audit.ts` writes `folio/<paper>/section-title-audit.qa.json`,
    // keyed by paper and chapter rather than by block. It has no `.ts` by
    // design, and four live in the qou corpus. Bean `qou-efzm` had them
    // recorded as orphans left behind by a deleted block; the file shape says
    // they were never blocks. Deleting them would destroy live audit state the
    // producing tool would rewrite.
    const dir = chapter(["alpha"]);
    writeFileSync(
      join(dir, "section-title-audit.qa.json"),
      JSON.stringify({ criterion: "voice-section-title-coherence", paper: "p", chapters: {} }),
    );
    const { issues } = await validateObjects(dir);
    expect(orphanIssues(issues).length).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  test("still flags a genuine orphan sitting beside a paper-level artefact", async () => {
    // The discriminator must not become a blanket exemption for the directory.
    const dir = chapter(["alpha"], ["ghost"]);
    writeFileSync(
      join(dir, "section-title-audit.qa.json"),
      JSON.stringify({ criterion: "voice-section-title-coherence", paper: "p", chapters: {} }),
    );
    const { issues } = await validateObjects(dir);
    const found = orphanIssues(issues);
    expect(found.length).toBe(1);
    expect(found[0].message).toContain("ghost.qa.json");
    rmSync(dir, { recursive: true, force: true });
  });

  test("flags an unparseable sidecar rather than excusing it", async () => {
    // Treating unreadable as "not a block sidecar" would let a real orphan
    // hide behind a truncated write, so the helper fails toward reporting.
    const dir = chapter(["alpha"]);
    writeFileSync(join(dir, "corrupt.qa.json"), "{ this is not json");
    const { issues } = await validateObjects(dir);
    const found = orphanIssues(issues);
    expect(found.length).toBe(1);
    expect(found[0].message).toContain("corrupt.qa.json");
    rmSync(dir, { recursive: true, force: true });
  });

  test("is an error, not a warning", async () => {
    // An audit report for a block that does not exist is not a style nit — it
    // can never be refreshed and it corrupts corpus counts.
    const dir = chapter(["alpha"], ["ghost"]);
    const { issues } = await validateObjects(dir);
    expect(orphanIssues(issues)[0]).toMatchObject({ level: "error" });
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("no-orphan-sidecar in chapter mode", () => {
  /**
   * Chapter mode passes an explicit `blockNames` list; flat mode passes null.
   * The first version of this check was gated on `blockNames === null`, which
   * made it a silent no-op for every real paper — the unit tests above all
   * exercise flat mode and passed regardless. This fixture pins the real path.
   */
  function chapterMode(blocks: string[], sidecars: string[]): string {
    const root = mkdtempSync(join(tmpdir(), "orphan-ch-"));
    const name = basename(root);
    for (const b of blocks) {
      writeFileSync(
        join(root, `${b}.ts`),
        `export default { kind: "prose", label: "rem:${b}", title: "T", chapter: "${name}" };\n`,
      );
      writeFileSync(join(root, `${b}.md`), `Body of ${b}.\n`);
    }
    for (const s of sidecars) {
      writeFileSync(
        join(root, `${s}.qa.json`),
        JSON.stringify({ $schema: "block-qa/v1", label: `rem:${s}`, criteria: {} }),
      );
    }
    // `<dirname>.ts` exporting a Chapter makes validateObjects take the
    // chapter branch, which supplies blockNames from the section manifest.
    writeFileSync(
      join(root, `${name}.ts`),
      `export default { title: "T", sections: [{ title: "S", blocks: ${JSON.stringify(blocks)} }] };\n`,
    );
    return root;
  }

  test("still flags an orphan when blockNames is supplied", async () => {
    const dir = chapterMode(["alpha"], ["ghost"]);
    const { issues } = await validateObjects(dir);
    const found = orphanIssues(issues);
    expect(found.length).toBe(1);
    expect(found[0].message).toContain("ghost.qa.json");
    rmSync(dir, { recursive: true, force: true });
  });

  test("a sidecar whose manifest exists but was not requested is not an orphan", async () => {
    // Orphanhood is about the .ts existing ON DISK, not about being in the
    // caller's subset.
    const dir = chapterMode(["alpha"], []);
    writeFileSync(
      join(dir, "beta.ts"),
      `export default { kind: "prose", label: "rem:beta", title: "T", chapter: "c" };\n`,
    );
    writeFileSync(join(dir, "beta.qa.json"), JSON.stringify({ criteria: {} }));
    const { issues } = await validateObjects(dir);
    expect(orphanIssues(issues).length).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });
});

/**
 * The verdicts moved to `test/results/block-qa/<mirror of the block dir>/`
 * (bean `2634`), and the check that found them was PURE ADJACENCY — scan the
 * block directory, flag a `<base>.qa.json` with no `<base>.ts` beside it.
 * Adjacency is exactly what the move removed. Measured on this repo's own
 * corpus with a verdict planted in the results tree for a block that does not
 * exist, the unmodified check reported ZERO orphans: a silent no-op wearing a
 * clean bill of health.
 *
 * Every fixture above is a `mkdtemp` directory, which is OUTSIDE any layer
 * root — so none of them can reach a results tree at all, and none of them
 * would have noticed. That is not a flaw in those tests; it is why the ones
 * below build a whole miniature folio and run with the cwd inside it. The
 * check locates the results tree from `findContentRepoRoot()`, which walks up
 * from `process.cwd()`, so a fixture that does not look like a layer root
 * cannot exercise the half of the check that matters now.
 */
describe("no-orphan-sidecar in the results tree", () => {
  /**
   * A folio root holding `folio/demo/<chapter>/` block directories and a
   * mirrored `test/results/block-qa/content/demo/<chapter>/` verdict tree.
   *
   * @param chapters block stems per chapter — each gets a `.ts` and a `.md`
   * @param verdicts verdict stems per chapter, written to the MIRROR path
   */
  function folio(
    chapters: Record<string, string[]>,
    verdicts: Record<string, string[]>,
  ): string {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "orphan-folio-")));
    for (const [ch, blocks] of Object.entries(chapters)) {
      const dir = join(root, "folio", "demo", ch);
      mkdirSync(dir, { recursive: true });
      for (const b of blocks) {
        writeFileSync(
          join(dir, `${b}.ts`),
          `export default { kind: "prose", label: "rem:${b}", title: "T", chapter: "${ch}" };\n`,
        );
        writeFileSync(join(dir, `${b}.md`), `Body of ${b}.\n`);
      }
      writeFileSync(
        join(dir, `${ch}.ts`),
        `export default { title: "T", sections: [{ title: "S", blocks: ${JSON.stringify(blocks)} }] };\n`,
      );
    }
    for (const [ch, stems] of Object.entries(verdicts)) {
      const mirror = join(root, "test", "results", "block-qa", "folio", "demo", ch);
      mkdirSync(mirror, { recursive: true });
      for (const s of stems) {
        writeFileSync(
          join(mirror, `${s}.qa.json`),
          JSON.stringify({ $schema: "block-qa/v1", label: `rem:${s}`, criteria: {} }),
        );
      }
    }
    return root;
  }

  /** The mirror directory for a chapter of the fixture folio. */
  const mirrorOf = (root: string, ch: string) =>
    join(root, "test", "results", "block-qa", "folio", "demo", ch);

  /**
   * Run with the cwd inside the fixture folio, because that is the only input
   * `findContentRepoRoot()` has. Restored in `finally` — a leaked cwd would
   * silently repoint every later test in this process.
   */
  async function validateInFolio(root: string, dir: string) {
    const cwd = process.cwd();
    try {
      process.chdir(root);
      return await validateObjects(dir);
    } finally {
      process.chdir(cwd);
    }
  }

  test("the BLOCK-MOVED case: the verdict left behind at the old path is flagged", async () => {
    // `moved` used to live in ch-a and now lives in ch-b. The sweep wrote a
    // fresh verdict at the ch-b mirror path; the ch-a one stayed behind,
    // holding a judgement computed against content that has since changed.
    // This is the scenario the check exists for — 5 of the 18 orphans
    // measured in qou — and the one the move put most at risk, because
    // neither verdict file is anywhere near a block any more.
    const root = folio(
      { "ch-a": ["stays"], "ch-b": ["moved"] },
      { "ch-a": ["stays", "moved"], "ch-b": ["moved"] },
    );
    const found = orphanIssues(
      (await validateInFolio(root, join(root, "folio", "demo", "ch-a"))).issues,
    );
    expect(found.length).toBe(1);
    expect(found[0].message).toContain("moved.qa.json");
    // Names the results-tree path, not a sibling that was never there — with
    // two possible homes a reader cannot infer which file to delete from the
    // stem alone.
    expect(found[0].message).toContain(mirrorOf(root, "ch-a"));
    rmSync(root, { recursive: true, force: true });
  });

  test("...and the verdict at the block's NEW path is not flagged", async () => {
    // The other half of the same scenario. A check that fired on both would
    // be telling the author to delete the verdict that is actually current.
    const root = folio(
      { "ch-a": ["stays"], "ch-b": ["moved"] },
      { "ch-a": ["stays", "moved"], "ch-b": ["moved"] },
    );
    const found = orphanIssues(
      (await validateInFolio(root, join(root, "folio", "demo", "ch-b"))).issues,
    );
    expect(found.length).toBe(0);
    rmSync(root, { recursive: true, force: true });
  });

  test("a verdict in the results tree whose block exists is not an orphan", async () => {
    const root = folio({ "ch-a": ["alpha"] }, { "ch-a": ["alpha"] });
    const found = orphanIssues(
      (await validateInFolio(root, join(root, "folio", "demo", "ch-a"))).issues,
    );
    expect(found.length).toBe(0);
    rmSync(root, { recursive: true, force: true });
  });

  test("no mirror for THIS directory, inside a present results tree, is a determined ZERO", async () => {
    // Another chapter has verdicts, so the tree is here; this one has none
    // written. Nothing has been written for it, so nothing is orphaned there.
    const root = folio({ "ch-a": ["alpha"], "ch-b": ["beta"] }, { "ch-b": ["beta"] });
    const { issues } = await validateInFolio(root, join(root, "folio", "demo", "ch-a"));
    expect(orphanIssues(issues).length).toBe(0);
    expect(issues.some((i) => i.message.includes("could not read the results tree"))).toBe(false);
    expect(issues.some((i) => i.message.includes("could not determine orphans"))).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });

  test("an ABSENT results tree is UNKNOWN, said once, never a clean pass (C7)", async () => {
    // Bean `c8uq`. This used to be a determined zero "by design". Once the
    // derived corpus lives on `qa-reports`, every unfetched checkout looks
    // like this, and "no orphans" would be a verdict over nothing.
    const root = folio({ "ch-a": ["alpha"], "ch-b": ["beta"] }, {});
    const { issues } = await validateInFolio(root, join(root, "folio", "demo", "ch-a"));
    expect(orphanIssues(issues).length).toBe(0);
    const notices = issues.filter((i) => i.message.includes("could not determine orphans"));
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ level: "warning" });
    expect(notices[0]!.message).toContain("qa:fetch");
    // A warning, so validity still rests on the checks that DID run.
    rmSync(root, { recursive: true, force: true });
  });

  test("a LEGACY verdict beside its block is not flagged for being legacy", async () => {
    // A downstream folio has its verdicts committed beside its blocks. If
    // location alone were the finding, every unmigrated folio would get a wall
    // of them on the day it upgraded, which is worse than the gap.
    const root = folio({ "ch-a": ["alpha"] }, {});
    writeFileSync(
      join(root, "folio", "demo", "ch-a", "alpha.qa.json"),
      JSON.stringify({ $schema: "block-qa/v1", label: "rem:alpha", criteria: {} }),
    );
    const found = orphanIssues(
      (await validateInFolio(root, join(root, "folio", "demo", "ch-a"))).issues,
    );
    expect(found.length).toBe(0);
    rmSync(root, { recursive: true, force: true });
  });

  test("a genuinely orphaned LEGACY verdict is still caught inside a folio root", async () => {
    // The compatibility carve-out is about LOCATION, never about the rule.
    // An unmigrated folio must keep exactly the protection it had.
    const root = folio({ "ch-a": ["alpha"] }, {});
    writeFileSync(
      join(root, "folio", "demo", "ch-a", "ghost.qa.json"),
      JSON.stringify({ $schema: "block-qa/v1", label: "rem:ghost", criteria: {} }),
    );
    const found = orphanIssues(
      (await validateInFolio(root, join(root, "folio", "demo", "ch-a"))).issues,
    );
    expect(found.length).toBe(1);
    expect(found[0].message).toContain("ghost.qa.json");
    rmSync(root, { recursive: true, force: true });
  });

  test("a non-block artefact in the results tree keeps the carve-out", async () => {
    // `qa-section-title-audit.ts` still writes to the paper root, so this is
    // pre-emptive rather than live — but the discriminator is "does the file
    // say it is a block verdict", and answering that differently in two
    // directories is how the next non-block artefact under test/results/
    // becomes a false orphan.
    const root = folio({ "ch-a": ["alpha"] }, { "ch-a": ["alpha"] });
    writeFileSync(
      join(mirrorOf(root, "ch-a"), "section-title-audit.qa.json"),
      JSON.stringify({ criterion: "voice-section-title-coherence", paper: "p", chapters: {} }),
    );
    const found = orphanIssues(
      (await validateInFolio(root, join(root, "folio", "demo", "ch-a"))).issues,
    );
    expect(found.length).toBe(0);
    rmSync(root, { recursive: true, force: true });
  });

  test("an unparseable verdict in the results tree is reported, not excused", async () => {
    const root = folio({ "ch-a": ["alpha"] }, { "ch-a": ["alpha"] });
    writeFileSync(join(mirrorOf(root, "ch-a"), "corrupt.qa.json"), "{ this is not json");
    const found = orphanIssues(
      (await validateInFolio(root, join(root, "folio", "demo", "ch-a"))).issues,
    );
    expect(found.length).toBe(1);
    expect(found[0].message).toContain("corrupt.qa.json");
    rmSync(root, { recursive: true, force: true });
  });
});

describe("no-orphan-sidecar third state", () => {
  test("a directory outside the resolved root reports that it could not look", async () => {
    // `findContentRepoRoot()` always returns a path — it falls back to an
    // import-relative guess — so "no root" is not something it can report.
    // What IS detectable is that the root it returned does not contain the
    // directory, and `repo-root.ts` documents that exact failure: the walk-up
    // landing in the PLATFORM tree instead of the folio. Rendering that as a
    // clean results tree would turn a misresolved root into "nothing is
    // orphaned", which is the false-pass direction this repo refuses.
    const dir = chapter(["alpha"]);
    const { issues } = await validateObjects(dir);
    expect(issues.some((i) => i.message.includes("could not read the results tree"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  test("...and that notice is NOT counted as an orphan finding", async () => {
    // Every consumer counts orphans by grepping "orphan QA sidecar". A status
    // line wearing that string would inflate the census the check exists to
    // keep honest — the first draft of this change did exactly that, and the
    // suite above caught it.
    const dir = chapter(["alpha"]);
    const { issues } = await validateObjects(dir);
    expect(orphanIssues(issues).length).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  test("an EMPTY directory still reports the empty-corpus error, not the notice", async () => {
    // `validateObjects` decides "this run validated nothing, refuse to report
    // success" on `issues.length === 0`, so ANY issue raised by the orphan
    // check disarms it and `valid: false` becomes `valid: true`. The first
    // version of the third-state notice did that to every empty directory.
    // This pins the interaction, which no test of either check alone covers.
    const empty = mkdtempSync(join(tmpdir(), "orphan-empty-"));
    const { valid, issues } = await validateObjects(empty);
    expect(valid).toBe(false);
    expect(issues.some((i) => i.message.includes("refusing to report success"))).toBe(true);
    rmSync(empty, { recursive: true, force: true });
  });
});
