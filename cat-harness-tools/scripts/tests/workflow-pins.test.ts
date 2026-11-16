/**
 * Shared-workflow calls follow index.lock.json (security audit S1, owner
 * 2026-11-01, card Q-SEC-4 "B").
 */
import { describe, expect, test } from "bun:test";

import { judgeFile } from "../workflow-pins.ts";

const TOOLS = "a".repeat(40);
const refs = new Map([["cat-harness-tools", TOOLS]]);
const judge = (text: string, own = "smart-x") => judgeFile("/r", "/r/.github/workflows/ci.yml", text, own, refs);

describe("workflow-pins", () => {
  test("a branch call to a mounted layer moves to the lock's commit", () => {
    const { findings, text } = judge("jobs:\n  checks:\n    uses: litlfred/cat-harness-tools/.github/workflows/layer-pr-checks.yml@main\n");
    expect(findings).toHaveLength(1);
    expect(text).toContain(`layer-pr-checks.yml@${TOOLS} # index.lock.json`);
  });

  test("a call already at the lock's commit is current", () => {
    expect(judge(`jobs:\n  c:\n    uses: litlfred/cat-harness-tools/.github/workflows/x.yml@${TOOLS} # index.lock.json\n`).findings).toHaveLength(0);
  });

  test("this repository's own workflow becomes a same-commit local call", () => {
    const { text } = judge("jobs:\n  b:\n    uses: litlfred/smart-x/.github/workflows/build.yml@main\n");
    expect(text).toContain("uses: ./.github/workflows/build.yml\n");
  });

  test("tools-ref: main under a layer-pr-checks call is dropped, other inputs stay", () => {
    const { text, findings } = judge("jobs:\n  c:\n    uses: litlfred/cat-harness-tools/.github/workflows/layer-pr-checks.yml@main\n    with:\n      mode: index\n      tools-ref: main\n");
    expect(findings.map((f) => f.why)).toEqual([expect.stringContaining("index.lock.json"), expect.stringContaining("tools-ref")]);
    expect(text).not.toContain("tools-ref");
    expect(text).toContain("mode: index");
  });

  test("an unmounted layer at a branch is reported and left for a hand pin", () => {
    const { findings, text } = judge("jobs:\n  c:\n    uses: litlfred/other/.github/workflows/x.yml@main\n");
    expect(findings[0].want).toBeNull();
    expect(text).toContain("@main");
  });

  test("an unmounted layer pinned by hand to a commit is accepted; comments are ignored", () => {
    expect(judge(`# uses: litlfred/other/.github/workflows/x.yml@main\njobs:\n  c:\n    uses: litlfred/other/.github/workflows/x.yml@${"b".repeat(40)}\n`).findings).toHaveLength(0);
  });
});

describe("workflow-pins: a commit pin behind the lock", () => {
  test("is a trailing finding (warn), and --write still moves it", () => {
    const old = "c".repeat(40);
    const { findings, text } = judge(`jobs:\n  c:\n    uses: litlfred/cat-harness-tools/.github/workflows/x.yml@${old}\n`);
    expect(findings).toHaveLength(1);
    expect(findings[0].trailing).toBe(true);
    expect(text).toContain(`x.yml@${TOOLS} # index.lock.json`);
  });

  test("a branch is never trailing", () => {
    expect(judge("jobs:\n  c:\n    uses: litlfred/cat-harness-tools/.github/workflows/x.yml@main\n").findings[0].trailing).toBeUndefined();
  });
});

describe("workflow-pins: layers under more than one owner", () => {
  const repos = new Map([
    ["cat-harness-tools", "litlfred/cat-harness-tools"],
    ["smart-base", "WorldHealthOrganization/smart-base"],
  ]);
  const BASE = "d".repeat(40);
  const refs2 = new Map([["cat-harness-tools", TOOLS], ["smart-base", BASE]]);
  const judgeAt = (text: string, ownOwner = "WorldHealthOrganization", own = "smart-x") =>
    judgeFile("/r", "/r/.github/workflows/ci.yml", text, own, refs2, repos, ownOwner);

  test("a call under the old owner moves to the owner the lock names, even at the right commit", () => {
    const { findings, text } = judgeAt(`jobs:\n  b:\n    uses: litlfred/smart-base/.github/workflows/ghbuild.yml@${BASE} # index.lock.json\n`);
    expect(findings).toHaveLength(1);
    expect(findings[0].trailing).toBeUndefined();
    expect(text).toContain(`uses: WorldHealthOrganization/smart-base/.github/workflows/ghbuild.yml@${BASE} # index.lock.json`);
  });

  test("a harness layer that stays under litlfred is judged from a WHO repository", () => {
    const { text } = judgeAt("jobs:\n  c:\n    uses: litlfred/cat-harness-tools/.github/workflows/layer-pr-checks.yml@main\n");
    expect(text).toContain(`uses: litlfred/cat-harness-tools/.github/workflows/layer-pr-checks.yml@${TOOLS} # index.lock.json`);
  });

  test("this repository's own workflow under a non-litlfred owner becomes a local call", () => {
    const { text } = judgeAt("jobs:\n  b:\n    uses: WorldHealthOrganization/smart-x/.github/workflows/build.yml@main\n");
    expect(text).toContain("uses: ./.github/workflows/build.yml\n");
  });

  test("third-party actions are not judged", () => {
    expect(judgeAt("jobs:\n  c:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node/sub@v4\n").findings).toHaveLength(0);
  });
});
