/**
 * The CI half of bean `16ei`: the publish job, the prune workflow, and the
 * two rules that keep them honest.
 *
 * - `check:workflows` — `qa-reports-unretried`: a raw push to `qa-reports`
 *   anywhere in a workflow is a finding; the sanctioned writer is
 *   `qa-store.ts`, which owns the fetch → splice → push loop and refuses `-f`.
 * - `gates.ts` — a job holding `contents: write` is a publisher, so
 *   `bun run cat gates` never runs `qa:publish` on a contributor's machine.
 *
 * Read against the REAL workflow files, so a later edit that drops the
 * schedule, the dry-run default, or the job's separation fails here.
 *
 * @module scripts/tests/qa-reports-ci
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";

import { checkWorkflows, qaReportsUnretried } from "../check-workflows.js";
import { gatesFrom, GATES_WORKFLOW, loadGates, publishes, unclassifiedSteps } from "../gates.js";

const REPO = resolve(import.meta.dir, "../../..");
const wf = (name: string) => readFileSync(join(REPO, ".github", "workflows", name), "utf-8");

describe("qa-reports-unretried", () => {
  test.each([
    ["git push origin HEAD:refs/heads/qa-reports"],
    ["          git push -f origin \"$c:qa-reports\""],
    ["git -c pack.useSparse=false push origin $commit:refs/heads/qa-reports"],
    ["for attempt in 1 2 3; do git push origin x:qa-reports && break; done"],
    ["git push origin HEAD:refs/heads/cat-qa-reports"],
    ["git push origin x:cat-qa-reports"],
    ["git push origin x:refs/heads/cat/cat-harness/qa-reports"],
  ])("flags a raw push: %s", (line) => {
    expect(qaReportsUnretried(`jobs:\n  j:\n    steps:\n      - run: |\n          ${line}\n`, "x.yml").map((f) => f.kind)).toEqual(["qa-reports-unretried"]);
  });

  test.each([
    ["bun run cat qa:publish --github"],
    ["bun run cat qa:prune --apply"],
    ["# git push origin x:qa-reports — a comment"],
    ["git push origin x:qa-reports-spike"],
    ["git push origin x:cat-qa-reports-spike"],
    ["git fetch origin qa-reports"],
  ])("does not flag: %s", (line) => {
    expect(qaReportsUnretried(`jobs:\n  j:\n    steps:\n      - run: |\n          ${line}\n`, "x.yml")).toEqual([]);
  });

  test("the repository's own workflows carry none", () => {
    expect(checkWorkflows().filter((f) => f.kind === "qa-reports-unretried")).toEqual([]);
  });
});

describe("the publish job", () => {
  const doc = parse(wf("code-quality-gates.yml")) as {
    jobs: Record<string, { needs?: string[]; if?: string; permissions?: Record<string, string>; steps: { run?: string }[] }>;
    permissions?: Record<string, string>;
  };
  const job = doc.jobs["qa-publish"]!;

  test("is a separate job after the gates, run whatever they concluded, on push and pull_request", () => {
    // The two corpus parts of the repository gates, not the `gates` roll-up,
    // which also waits for the standalone ratchet (bean `doxj`) — and the job
    // that builds the QA working copy once, which it restores and publishes
    // rather than building a second time (bean `jtfk`).
    expect(job.needs).toEqual(["gates-kg", "gates-docs", "qa-working-copy"]);
    expect(job.if).toContain("always()");
    expect(job.if).toContain("'push'");
    expect(job.if).toContain("'pull_request'");
    expect(job.permissions).toEqual({ contents: "write" });
    expect(doc.permissions).toEqual({ contents: "read" });
    expect(job.steps.some((s) => s.run?.includes("bun run cat qa:publish --github"))).toBe(true);
  });

  test("is not a gate: `bun run cat gates` does not extract it, in either set", () => {
    expect(publishes(job)).toBe(true);
    expect(publishes({ permissions: { contents: "read" } })).toBe(false);
    expect(publishes({ permissions: "write-all" })).toBe(true);
    expect(publishes({})).toBe(false);
    for (const all of [false, true]) {
      expect(loadGates(REPO, { all }).filter((g) => g.command.includes("qa:publish"))).toEqual([]);
      expect(loadGates(REPO, { all }).some((g) => g.job === "gates-kg")).toBe(true);
    }
    // Scoped to the gates workflow: the raw reader still SEES the line, so a
    // caller asking "what does CI run" (commandsCiRuns) is not blinded.
    const text = readFileSync(join(REPO, GATES_WORKFLOW), "utf-8");
    expect(gatesFrom(text, { all: true }).some((g) => g.command.includes("qa:publish"))).toBe(true);
  });
});

describe("the prune workflow", () => {
  const doc = parse(wf("qa-reports-prune.yml")) as {
    on: { schedule?: { cron: string }[]; workflow_dispatch?: { inputs?: Record<string, { default?: unknown }> } };
    jobs: Record<string, { steps: { run?: string; env?: Record<string, string> }[] }>;
  };

  test("has a trigger that fires — a schedule — and a dispatch that defaults to a dry run", () => {
    expect(doc.on.schedule?.length).toBeGreaterThan(0);
    expect(doc.on.workflow_dispatch?.inputs?.apply?.default).toBe(false);
    const steps = Object.values(doc.jobs).flatMap((j) => j.steps);
    const prune = steps.find((s) => s.run?.includes("qa:prune"))!;
    expect(prune.env?.APPLY).toContain("github.event_name == 'schedule'");
    expect(prune.run).toContain("--pr-states");
  });

  test("its step is classified for `gates --all`, not left unclassified", () => {
    expect(unclassifiedSteps(REPO).filter((u) => u.step.command.includes("qa:prune"))).toEqual([]);
  });
});
