/**
 * check:workflow-tools — every script a workflow runs is a Tool linked to a
 * process. Each case is a way the gate could read a workflow as clean while a
 * step runs something no Tool reaches.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "bun:test";

import { assess, invocations, pinnedCopies, processesOf, resolvePath, runBlocks, toolReach } from "../../check-workflow-tools.ts";
import type { ToolDefinition } from "../../../schemas/tools/tool.js";

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "workflow-tools-"));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), body);
  }
  return root;
}

const tool = (id: string, shell: string, satisfies: string[], subprocesses?: string[]) =>
  ({ id, invoke: { shell }, satisfies, subprocesses }) as unknown as ToolDefinition;

describe("runBlocks", () => {
  test("reads inline and block `run:`, and drops comment lines", () => {
    const yaml = [
      "jobs:",
      "  a:",
      "    steps:",
      "      - run: bash x/a.sh",
      "      - name: b",
      "        run: |",
      "          # bash x/commented.sh",
      "          bun run x/b.ts --flag",
      "      - run: echo done",
    ].join("\n");
    const blocks = runBlocks(yaml).join("\n");
    expect(blocks).toContain("bash x/a.sh");
    expect(blocks).toContain("bun run x/b.ts --flag");
    expect(blocks).not.toContain("commented");
  });
});

describe("resolvePath", () => {
  test("a workflow's checkout prefix is dropped until the rest is a file", () => {
    const root = tree({ "lay/.github/scripts/x.py": "", "lay/scripts/y.ts": "", ".github/m.sh": "" });
    expect(resolvePath("ci/.github/scripts/x.py", "lay", root)).toBe("lay/.github/scripts/x.py");
    expect(resolvePath("fa/.github/m.sh", ".", root)).toBe(".github/m.sh");
    expect(resolvePath("./lay/scripts/y.ts", ".", root)).toBe("lay/scripts/y.ts");
  });
  test("a path built at run time, or naming no file, resolves to nothing", () => {
    const root = tree({ "a.ts": "" });
    expect(resolvePath("$RUNNER_TEMP/a.ts", ".", root)).toBeUndefined();
    expect(resolvePath("nowhere/b.ts", ".", root)).toBeUndefined();
  });
});

describe("assess", () => {
  const files = {
    ".github/workflows/w.yml": [
      "jobs:",
      "  a:",
      "    steps:",
      "      - run: bash lay/scripts/linked.sh",
      "      - run: bun run lay/scripts/unlinked.ts",
      "      - run: python3 -I lay/scripts/bare.py",
      "      - run: bun run cat do:it",
    ].join("\n"),
    "lay/scripts/linked.sh": "",
    "lay/scripts/unlinked.ts": "",
    "lay/scripts/bare.py": "",
    "lay/scripts/keyed.ts": "",
    "package.json": JSON.stringify({ name: "root", scripts: { "do:it": "bun run lay/scripts/keyed.ts" } }),
  };
  const bySkill = new Map([["skill-a", new Set(["proc-a"])]]);

  test("a Tool with a process link is clean; one without is no-process; none is no-tool", () => {
    const root = tree(files);
    const defs = [
      tool("linked", "lay/scripts/linked.sh", ["skill-a"]),
      tool("unlinked", "bun run lay/scripts/unlinked.ts", ["skill-unused"]),
      tool("keyed", "bun run cat do:it", [], ["proc-b"]),
    ];
    const r = assess(invocations(root, [".github/workflows/w.yml"]), toolReach(defs, root), defs, bySkill);
    const kinds = Object.fromEntries(r.findings.map((f) => [f.subject, f.kind]));
    expect(kinds).toEqual({ "lay/scripts/unlinked.ts": "no-process", "lay/scripts/bare.py": "no-tool" });
    expect(r.ok.map((o) => o.subject).sort()).toEqual(["lay/scripts/keyed.ts", "lay/scripts/linked.sh"]);
  });

  test("processesOf joins satisfies to BPMN skill refs, and adds subprocesses", () => {
    expect(processesOf(tool("t", "x", ["skill-a"], ["proc-c"]), bySkill)).toEqual(["proc-a", "proc-c"]);
    expect(processesOf(tool("t", "x", ["nope"]), bySkill)).toEqual([]);
  });
});

describe("a script copied out of a pinned tree", () => {
  // The preview tier runs `scripts/preview-qa.ts` at the judging scripts' pin
  // by copying it beside the mount's scripts under a scratch name. The step
  // runs the source; the scratch name exists in no tree.
  const step = [
    "jobs:",
    "  a:",
    "    steps:",
    "      - run: |",
    '          tmp="fa/lay/scripts/.preview-qa-ci.ts"',
    '          git -C ci show "HEAD:scripts/preview-qa.ts" > "$tmp"',
    '          bun "$tmp" select --root src',
    '          rm -f "$tmp"',
  ].join("\n");

  test("pinnedCopies maps the scratch name to the copied path", () => {
    const [block] = runBlocks(step);
    expect([...pinnedCopies(block!)]).toEqual([["fa/lay/scripts/.preview-qa-ci.ts", "scripts/preview-qa.ts"]]);
  });

  test("the run is read as the source, not reported unresolved", () => {
    // The workflow is the layer's own, as layer-pr-checks.yml is, so the
    // copied path resolves in that layer.
    const root = tree({ "lay/.github/workflows/w.yml": step, "lay/scripts/preview-qa.ts": "" });
    const runs = invocations(root, ["lay/.github/workflows/w.yml"]);
    expect(runs.map((i) => i.script)).toEqual(["lay/scripts/preview-qa.ts"]);
  });

  test("a scratch name with no copy beside it is still unresolved", () => {
    const root = tree({
      "lay/.github/workflows/w.yml": ["jobs:", "  a:", "    steps:", "      - run: |", '          tmp="fa/lay/scripts/.gone.ts"', '          bun "$tmp"'].join("\n"),
      "lay/scripts/preview-qa.ts": "",
    });
    const runs = invocations(root, ["lay/.github/workflows/w.yml"]);
    expect(runs.map((i) => i.script)).toEqual([undefined]);
  });
});

describe("QC checks need no Tool", () => {
  test("a gate key, a --check run or a check-* file is exempt; a producing run of the same file is not", () => {
    const root = tree({
      ".github/workflows/w.yml": [
        "jobs:",
        "  a:",
        "    steps:",
        "      - run: bun run cat check:thing",
        "      - run: bun run lay/scripts/gen-a.ts --check",
        "      - run: bun run lay/scripts/gen-b.ts --check",
        "      - run: bun run lay/scripts/gen-b.ts --out x",
        "      - run: bun run lay/scripts/check-c.ts",
      ].join("\n"),
      "lay/scripts/thing.ts": "",
      "lay/scripts/gen-a.ts": "",
      "lay/scripts/gen-b.ts": "",
      "lay/scripts/check-c.ts": "",
      "package.json": JSON.stringify({ name: "root", scripts: { "check:thing": "bun run lay/scripts/thing.ts" } }),
    });
    const r = assess(invocations(root, [".github/workflows/w.yml"]), toolReach([], root), [], new Map());
    expect(r.findings.map((f) => f.subject)).toEqual(["lay/scripts/gen-b.ts"]);
    expect(r.qc).toBe(3);
  });

  test("a lint key, a `verify` subcommand and an audit/verify/gates segment are QC too", () => {
    const root = tree({
      ".github/workflows/w.yml": [
        "jobs:",
        "  a:",
        "    steps:",
        "      - run: bun run cat lint",
        "      - run: bash lay/scripts/sign.sh verify",
        "      - run: bash lay/scripts/determinism-audit.sh",
        "      - run: python3 lay/scripts/run-root-gates.py .",
        "      - run: bash lay/scripts/sign.sh file x",
      ].join("\n"),
      "lay/scripts/l.ts": "",
      "lay/scripts/sign.sh": "",
      "lay/scripts/determinism-audit.sh": "",
      "lay/scripts/run-root-gates.py": "",
      "package.json": JSON.stringify({ name: "root", scripts: { lint: "bun run lay/scripts/l.ts" } }),
    });
    const r = assess(invocations(root, [".github/workflows/w.yml"]), toolReach([], root), [], new Map());
    expect(r.findings.map((f) => f.subject)).toEqual(["lay/scripts/sign.sh"]);
    expect(r.qc).toBe(3); // sign.sh also has a producing run, so it is judged
  });

  test("a step a Tool's own script runs is covered by that Tool", () => {
    const root = tree({
      ".github/workflows/w.yml": "jobs:\n  a:\n    steps:\n      - run: bun run lay/scripts/step.ts\n",
      "lay/scripts/step.ts": "",
      "lay/scripts/main.ts": 'const STEP = "lay/scripts/step.ts";\n',
    });
    const defs = [tool("main", "bun run lay/scripts/main.ts", [], ["proc"])];
    const r = assess(invocations(root, [".github/workflows/w.yml"]), toolReach(defs, root), defs, new Map());
    expect(r.findings).toEqual([]);
    expect(r.ok.map((o) => o.tools)).toEqual([["main"]]);
  });
});

describe("a workflow Tool", () => {
  test("`gh workflow run <file>` covers the workflow's scripts and those of the reusable workflows it calls", () => {
    const root = tree({
      "lay/lay.json": "{}",
      "app/.github/workflows/caller.yml": "jobs:\n  c:\n    uses: org/lay/.github/workflows/reusable.yml@main\n",
      "lay/.github/workflows/reusable.yml": "jobs:\n  r:\n    steps:\n      - run: python3 lay/.github/scripts/helper.py\n",
      "lay/.github/scripts/helper.py": "",
    });
    const defs = [tool("ci-x", "gh workflow run caller.yml", [], ["proc"])];
    const r = assess(
      invocations(root, ["lay/.github/workflows/reusable.yml"]),
      toolReach(defs, root),
      defs,
      new Map(),
    );
    expect(r.findings).toEqual([]);
    expect(r.ok.map((o) => [o.subject, o.tools])).toEqual([["lay/.github/scripts/helper.py", ["ci-x"]]]);
  });
});
