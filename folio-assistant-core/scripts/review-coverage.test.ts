/**
 * The `folio-review-coverage` Tool (bean px0t): the computation as a pure
 * function, then the command, offline, including the feature-branch refusal.
 */
import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { buildReviewComments } from "./review-comments";
import { buildCoverage, pinMaps, renderedFacts } from "./review-coverage";

const SCRIPT = resolve(import.meta.dir, "review-coverage.ts");
const pc = (id: number, body: string) => ({ id, body, user: "sme1", createdAt: "2026-09-23T07:00:00Z", url: `https://github.com/o/r/pull/7#issuecomment-${id}` });
const blocks = { "prose:a": { hash: "ha", renamedFrom: [] }, "prose:b": { hash: "hb", renamedFrom: [] } };
const changeset = { changes: [{ change: "changed", label: "prose:a" }, { change: "added", label: "prose:b" }] };
const rc = buildReviewComments({
  repo: "o/r",
  pr: 7,
  commit: "c1",
  blocks,
  now: "2026-09-23T08:00:00Z",
  comments: [pc(1, "block: prose:a\nverdict: ok"), pc(2, "block: prose:b\nkind: defect\n\nWrong.")],
});

describe("buildCoverage", () => {
  it("oneUnreadOneDefect", () => {
    const f = buildCoverage({ changeset, blocks, reviewComments: rc });
    expect(f.facts).toEqual({ uncoveredBlocks: 1, openDefects: 1, rendered: "absent", unreviewedPages: 0, undeterminedInputs: 0, measured: "absent", missedPages: 0 });
    expect(f.uncovered).toEqual(["prose:b"]);
  });

  it("editReopensBlock", () => {
    const f = buildCoverage({ changeset, blocks: { ...blocks, "prose:a": { hash: "ha2" } }, reviewComments: rc });
    expect(f.uncovered).toEqual(["prose:a", "prose:b"]);
    expect(f.stale).toHaveLength(1);
  });
});

describe("the rendered half (bean bnjs)", () => {
  const impact = {
    $schema: "rendered-impact/v1",
    renderer: "document-site",
    method: "cone",
    inputs: ["folio/doc/doc.ts"],
    files: [
      { path: "doc/index.html", change: "changed", role: "content", via: ["folio/doc/doc.ts"], hash: "pin-doc" },
      { path: "outline.json", change: "changed", role: "index", via: ["folio/doc/doc.ts"], hash: "pin-doc" },
    ],
    undetermined: [{ input: "_config.yml", reason: "site-wide", scope: "all", hash: "pin-cfg" }],
  };
  const measured = {
    $schema: "rendered-measured/v1",
    status: "known",
    baseCommit: "b",
    beforeCommit: "b",
    measured: { $schema: "rendered-impact/v1", renderer: "build-diff", method: "build-diff", files: [{ path: "x.html", change: "changed", role: "content", hash: "pin-x" }] },
    check: { missed: ["x.html"], confirmed: [], unconfirmed: [] },
  };

  it("renderedKnown", () => {
    const f = buildCoverage({ changeset, blocks, reviewComments: rc, rendered: renderedFacts([impact], measured) });
    expect(f.facts).toEqual({ uncoveredBlocks: 1, openDefects: 1, rendered: "known", unreviewedPages: 1, undeterminedInputs: 1, measured: "known", missedPages: 1 });
  });

  it("pinsIncludeMissedPages", () => {
    const m = pinMaps(renderedFacts([impact], measured));
    expect([...m.pages]).toEqual([["doc/index.html", "pin-doc"], ["outline.json", "pin-doc"], ["x.html", "pin-x"]]);
    expect([...m.inputs]).toEqual([["_config.yml", "pin-cfg"]]);
  });
});

describe("the command", () => {
  let dir = "";
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  const setup = () => {
    dir = mkdtempSync(join(tmpdir(), "coverage-"));
    const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, stdio: "pipe" });
    git("init", "-q", "-b", "main");
    git("config", "user.email", "t@example.org");
    git("config", "user.name", "t");
    mkdirSync(join(dir, "todos", "verdicts"), { recursive: true });
    writeFileSync(join(dir, "todos", "todos.json"), JSON.stringify({ name: "t", directories: [{ id: "verdicts", path: "verdicts", graphTypologies: ["review-verdicts"] }] }));
    writeFileSync(join(dir, "changeset.json"), JSON.stringify(changeset));
    writeFileSync(join(dir, "blocks.json"), JSON.stringify(blocks));
    writeFileSync(join(dir, "review-comments.json"), JSON.stringify(rc));
    git("add", "-A");
    git("commit", "-qm", "init");
    return git;
  };
  const run = (...extra: string[]) =>
    spawnSync("bun", ["run", SCRIPT, "--changeset", "changeset.json", "--blocks", "blocks.json", "--comments", "review-comments.json", "--todos", "todos", ...extra], { cwd: dir, encoding: "utf-8" });

  it("commandPrintsFacts", () => {
    setup();
    const r = run();
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ uncoveredBlocks: 1, openDefects: 1, rendered: "absent", unreviewedPages: 0, undeterminedInputs: 0, measured: "absent", missedPages: 0 });
  });

  it("refusesBaseBranchCommit", () => {
    setup();
    const r = run("--commit");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("FEATURE branch");
    expect(readdirSync(join(dir, "todos", "verdicts"))).toEqual([]);
  });

  it("commitsOnFeature", () => {
    const git = setup();
    git("switch", "-qc", "review/x");
    expect(run("--commit").status).toBe(0);
    expect(existsSync(join(dir, "todos", "verdicts", "verdict-pr7-c1-prose_a.json"))).toBe(true);
    expect(String(git("log", "--oneline")).split("\n").filter(Boolean)).toHaveLength(2);
    expect(run("--commit").stderr).toContain("nothing new to commit");
  });
});
