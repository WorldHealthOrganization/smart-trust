/**
 * Shared-workflow calls follow index.lock.json (security audit S1, owner
 * 2026-11-01, card Q-SEC-4 "B").
 */
import { describe, expect, test } from "bun:test";

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { judgeFile, mergeGuardTrigger, MERGE_GUARD_TRIGGER_FILE, MERGE_GUARD_TRIGGER_NAME, MERGE_GUARD_TRIGGER_TEXT } from "../workflow-pins.ts";

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

describe("workflow-pins: a layer-pr-checks caller starts on `labeled`", () => {
  // The dth-* callers (2026-11-16): `types` without `labeled`, so adding
  // `release` started nothing and every PR ran the fast tier (full=false).
  const CALLER = [
    "on:",
    "  pull_request:",
    "    types: [opened, synchronize, reopened, ready_for_review]",
    "  push:",
    "    branches: [main]",
    "concurrency:",
    "  group: harness-pr-checks-${{ github.ref }}",
    "  cancel-in-progress: true",
    "jobs:",
    "  checks:",
    `    uses: litlfred/cat-harness-tools/.github/workflows/layer-pr-checks.yml@${TOOLS} # index.lock.json`,
    "    with:",
    "      mode: index",
    "",
  ].join("\n");

  test("--write adds `labeled`, the no-op label group and the job's if; a second pass is clean", () => {
    const { findings, text } = judge(CALLER);
    expect(findings).toHaveLength(3);
    expect(findings.every((f) => f.want !== null && !f.trailing)).toBe(true);
    expect(text).toContain("    types: [opened, synchronize, reopened, ready_for_review, labeled]\n");
    expect(text).toContain("group: harness-pr-checks-${{ (github.event.action == 'labeled' && github.event.label.name != 'release' && github.event.label.name != 'preview') && format('noop-label-{0}', github.run_id) || github.ref }}");
    expect(text).toContain("  checks:\n    if: github.event.action != 'labeled' || github.event.label.name == 'release' || github.event.label.name == 'preview'\n    uses:");
    expect(judge(text).findings).toHaveLength(0);
  });

  test("a pull_request with no types gets a types line", () => {
    const { text } = judge(CALLER.replace("    types: [opened, synchronize, reopened, ready_for_review]\n", ""));
    expect(text).toContain("  pull_request:\n    types: [opened, synchronize, reopened, ready_for_review, labeled]\n");
  });

  test("a block list of types gets `- labeled`", () => {
    const { text } = judge(CALLER.replace("    types: [opened, synchronize, reopened, ready_for_review]", "    types:\n      - opened\n      - synchronize"));
    expect(text).toContain("      - synchronize\n      - labeled\n");
  });

  test("a workflow that does not call layer-pr-checks, or not on pull_request, is not judged", () => {
    expect(judge(CALLER.replace("layer-pr-checks.yml", "other.yml")).findings).toHaveLength(0);
    expect(judge(CALLER.replace("  pull_request:\n    types: [opened, synchronize, reopened, ready_for_review]\n", "")).findings).toHaveLength(0);
  });

  test("a job if without the label clause is reported for a hand fix", () => {
    const { findings } = judge(CALLER.replace("  checks:\n", "  checks:\n    if: github.actor != 'bot'\n"));
    expect(findings.find((f) => f.have.startsWith("if:"))?.want).toBeNull();
  });
});

describe("workflow-pins: a merge-guard caller leaves pull_request_target", () => {
  // Owner, 2026-11-17: GitHub is changing pull_request_target's defaults, and
  // its 2026-11-16 brownout failed the guard. The caller runs from main only;
  // pull-request events arrive as the signal's completion.
  const CALLER = [
    "name: Merge guard",
    "on:",
    "  pull_request_target:",
    "    types: [opened, synchronize, labeled, unlabeled, edited]",
    "  issue_comment:",
    "    types: [created, edited]",
    "  workflow_run:",
    '    workflows: ["Layer PR checks"]',
    "    types: [completed]",
    "  workflow_dispatch:",
    "permissions: { statuses: write }",
    "jobs:",
    "  guard:",
    `    uses: litlfred/cat-harness-tools/.github/workflows/layer-merge-guard.yml@${TOOLS} # index.lock.json`,
    "",
  ].join("\n");

  test("--write drops pull_request_target and adds the signal to workflow_run; the findings trail; a second pass is clean", () => {
    const { findings, text } = judge(CALLER);
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.trailing && f.want !== null)).toBe(true);
    expect(text).not.toContain("pull_request_target");
    expect(text).toContain("  issue_comment:\n    types: [created, edited]\n  workflow_run:\n");
    expect(text).toContain(`    workflows: ["Layer PR checks", "${MERGE_GUARD_TRIGGER_NAME}"]\n`);
    expect(judge(text).findings).toHaveLength(0);
  });

  test("a block list of workflows gets the signal; a caller with no workflow_run gets one", () => {
    const block = judge(CALLER.replace('    workflows: ["Layer PR checks"]', '    workflows:\n      - "Layer PR checks"')).text;
    expect(block).toContain(`      - "Layer PR checks"\n      - "${MERGE_GUARD_TRIGGER_NAME}"\n`);
    const none = judge(CALLER.replace('  workflow_run:\n    workflows: ["Layer PR checks"]\n    types: [completed]\n', "")).text;
    expect(none).toContain(`  workflow_run:\n    workflows: ["${MERGE_GUARD_TRIGGER_NAME}"]\n    types: [completed]\npermissions:`);
    expect(judge(none).findings).toHaveLength(0);
  });

  test("a workflow that does not call layer-merge-guard is not judged", () => {
    expect(judge(CALLER.replace("layer-merge-guard.yml", "other.yml")).findings).toHaveLength(0);
  });

  test("the signal file is written when missing or changed, and is then current", () => {
    const root = mkdtempSync(join(tmpdir(), "wf-pins-signal-"));
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    expect(mergeGuardTrigger(root, false, true)).toHaveLength(0);
    const missing = mergeGuardTrigger(root, true, false);
    expect(missing.map((f) => [f.file, f.have, f.trailing])).toEqual([[MERGE_GUARD_TRIGGER_FILE, "(missing)", true]]);
    expect(existsSync(join(root, MERGE_GUARD_TRIGGER_FILE))).toBe(false);
    expect(mergeGuardTrigger(root, true, true)).toHaveLength(1);
    expect(readFileSync(join(root, MERGE_GUARD_TRIGGER_FILE), "utf8")).toBe(MERGE_GUARD_TRIGGER_TEXT);
    expect(mergeGuardTrigger(root, true, false)).toHaveLength(0);
    writeFileSync(join(root, MERGE_GUARD_TRIGGER_FILE), MERGE_GUARD_TRIGGER_TEXT.replace("permissions: {}", "permissions: write-all"));
    expect(mergeGuardTrigger(root, true, false)[0].have).toBe("(differs from the canonical signal)");
  });
});
