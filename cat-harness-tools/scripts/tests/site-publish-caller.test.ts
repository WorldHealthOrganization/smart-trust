/**
 * Every harnessed repository publishes on a push to main through the one
 * shared workflow, with the canonical caller (owner, 2026-11-11;
 * cat-harness-tools#1879).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { TEMPLATE, differences, invokesStageLocal, judge, sharedRef } from "../site-publish-caller.ts";

const template = readFileSync(TEMPLATE, "utf8");
const SHA = "b".repeat(40);
const pinned = template.replace(/folio-site-publish\.yml@\S+/, `folio-site-publish.yml@${SHA} # index.lock.json`);
const one = (text: string, file = "site-publish.yml") => judge(new Map([[file, text]]), template);

describe("site-publish-caller", () => {
  test("the template, pinned to a commit, is canonical", () => {
    expect(one(pinned)).toEqual([]);
  });

  test("comments and the pinned commit do not matter", () => {
    const other = pinned.replace(SHA, "c".repeat(40)).replace(/^# .*$/gm, "# another comment");
    expect(one(other)).toEqual([]);
  });

  test("no caller at all is a finding", () => {
    const f = judge(new Map([["checks.yml", "on: push\njobs:\n  c:\n    runs-on: ubuntu-latest\n    steps: [{ run: 'true' }]\n"]]), template);
    expect(f).toHaveLength(1);
    expect(f[0]!.why).toContain("is missing");
  });

  test("a manual-only caller (the old IG template's trigger) is named as such", () => {
    const manual = pinned.replace(/  push:\n(?:    #.*\n)*    branches: \[main, master\]\n/, "");
    const f = one(manual);
    expect(f).toHaveLength(1);
    expect(f[0]!.why).toContain("manual-only");
  });

  test("a path filter on push is a finding", () => {
    const f = one(pinned.replace("    branches: [main, master]\n", "    branches: [main, master]\n    paths: [docs/**]\n"));
    expect(f[0]!.why).toContain("filtered by path");
  });

  test("a hand-edited body is a finding naming where it differs", () => {
    const f = one(pinned.replace("plan: ${{ inputs.plan == true }}", "plan: true\n      qa: false"));
    expect(f).toHaveLength(1);
    expect(f[0]!.why).toContain("jobs.publish.with.plan");
    expect(f[0]!.why).toContain("jobs.publish.with.qa is not in the canonical caller");
  });

  test("an extra job is a finding", () => {
    const f = one(`${pinned}\n  extra:\n    runs-on: ubuntu-latest\n    steps: [{ run: 'true' }]\n`);
    expect(f[0]!.why).toContain("jobs.extra is not in the canonical caller");
  });

  test("a branch pin is a finding", () => {
    expect(one(template).map((f) => f.why).join(" ")).toContain("not a commit");
  });

  test("a hand-rolled publish (stage-local.ts in a step) is a finding, beside a missing caller", () => {
    const rolled = "on: workflow_dispatch\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: bun run cat-harness-tools/scripts/stage-local.ts --repo .\n";
    const why = judge(new Map([["site-publish.yml", rolled]]), template).map((f) => f.why);
    expect(why).toEqual([expect.stringContaining("is missing"), expect.stringContaining("hand-rolled")]);
  });

  test("a step that only NAMES stage-local.ts in a message or comment is not hand-rolled", () => {
    const named = "on: workflow_dispatch\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: |\n          # the root is published by stage-local.ts\n          echo \"::notice::the root is published by stage-local.ts.\"\n";
    const why = judge(new Map([["site-publish.yml", pinned], ["ghbuild.yml", named]]), template).map((f) => f.why);
    expect(why.join(" ")).not.toContain("hand-rolled");
  });

  test("invokesStageLocal tells a call from a mention", () => {
    expect(invokesStageLocal("bun run cat-harness-tools/scripts/stage-local.ts --repo .")).toBe(true);
    expect(invokesStageLocal("set -o pipefail\nbun run cat stage:local --repo . | tee log")).toBe(true);
    expect(invokesStageLocal("cd x && bun cat-harness-tools/scripts/stage-local.ts")).toBe(true);
    expect(invokesStageLocal('echo "published by stage-local.ts"')).toBe(false);
    expect(invokesStageLocal("printf '%s\\n' 'run stage-local.ts'")).toBe(false);
    expect(invokesStageLocal("# stage-local.ts publishes the root\ntrue")).toBe(false);
    expect(invokesStageLocal('echo "::notice::x" && echo "stage-local.ts"')).toBe(false);
  });

  test("two callers race for gh-pages", () => {
    const f = judge(new Map([["site-publish.yml", pinned], ["publish-again.yml", pinned]]), template);
    expect(f[0]!.why).toContain("race");
  });

  test("a canonical body under another file name is told to move", () => {
    expect(one(pinned, "pages.yml")[0]!.why).toContain("move it");
  });

  test("sharedRef reads only the shared workflow's calls", () => {
    expect(sharedRef(`litlfred/cat-harness-tools/.github/workflows/folio-site-publish.yml@${SHA}`)).toBe(SHA);
    expect(sharedRef("litlfred/cat-harness-tools/.github/workflows/layer-pr-checks.yml@main")).toBeUndefined();
  });

  test("differences names missing and extra keys by path", () => {
    expect(differences({ a: { b: 1 } }, { a: { c: 1 } })).toEqual(["a.b is missing", "a.c is not in the canonical caller"]);
  });
});
