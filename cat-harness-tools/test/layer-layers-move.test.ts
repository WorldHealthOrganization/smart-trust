/**
 * `layer-layers-move.yml`, the mover of a sandbox's layers commit, made
 * self-healing (owner, card 2026-11-18; WorldHealthOrganization/smart-ra#86,
 * dth-sfp#2). It ran only on the re-pin's first push, before `layers:publish`
 * had pushed `claude/cat-layers/<key>`, so the ref never moved and the full
 * tier's `layers-ref` stayed red. Now it runs on every event that starts the
 * full tier, keeps `contents: write` to itself, and never runs on
 * `pull_request_target`.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

const DIR = resolve(import.meta.dir, "..", ".github", "workflows");
const MOVE_SRC = readFileSync(resolve(DIR, "layer-layers-move.yml"), "utf-8");
type Job = { if?: string; permissions?: unknown; concurrency?: { group?: string; "cancel-in-progress"?: boolean } };
const MOVE = parse(MOVE_SRC) as { on: Record<string, unknown>; permissions: Record<string, string>; jobs: Record<string, Job> };
const CHECKS = parse(readFileSync(resolve(DIR, "layer-pr-checks.yml"), "utf-8"), { maxAliasCount: -1 }) as { jobs: Record<string, Job> };

/** The caller template in the header comment, uncommented, as YAML. */
function callerTemplate(): { on: { pull_request: { types: string[]; paths: string[] } }; permissions: Record<string, string> } {
  const lines = MOVE_SRC.split("\n");
  const start = lines.findIndex((l) => l.startsWith("#   name: Move a sandbox"));
  const body: string[] = [];
  for (const l of lines.slice(start)) {
    if (!l.startsWith("#   ")) break;
    body.push(l.slice(4));
  }
  return parse(body.join("\n"));
}

interface Event {
  event_name: string;
  action: string;
  label?: string;
  headRepo?: string;
}

/** Evaluate a job's `if` for one event: the expression's operators, translated to JS. */
function runs(expr: string, e: Event): boolean {
  const ctx = {
    event_name: e.event_name,
    repository: "WorldHealthOrganization/smart-ra",
    event: { action: e.action, label: { name: e.label ?? "" }, pull_request: { head: { repo: { full_name: e.headRepo ?? "WorldHealthOrganization/smart-ra" } } } },
  };
  const js = expr
    .replace(/^\$\{\{|\}\}$/g, "")
    .replace(/contains\(fromJSON\('([^']*)'\),\s*([^)]+)\)/g, (_m, list: string, v: string) => `${list}.includes(${v})`)
    .replace(/'([^']*)'/g, (_m, s: string) => JSON.stringify(s))
    .replace(/==/g, "===")
    .replace(/!===/g, "!==")
    .replace(/\n/g, " ");
  return new Function("github", `return (${js});`)(ctx) as boolean;
}

describe("layers-move: self-healing, minimal permissions", () => {
  const job = MOVE.jobs.move!;

  test("the caller template runs it on every event that starts the full tier", () => {
    const t = callerTemplate();
    expect(t.on.pull_request.types).toEqual(["opened", "synchronize", "reopened", "ready_for_review", "labeled"]);
    expect(t.on.pull_request.paths).toEqual(["index.lock.json"]);
    expect(t.permissions).toEqual({ contents: "write" });
  });

  test("a `release` label moves the ref; another label is a no-op; a fork's PR never runs it", () => {
    const at = (e: Event) => runs(job.if!, e);
    expect(at({ event_name: "pull_request", action: "synchronize" })).toBe(true);
    expect(at({ event_name: "pull_request", action: "ready_for_review" })).toBe(true);
    expect(at({ event_name: "pull_request", action: "labeled", label: "release" })).toBe(true);
    expect(at({ event_name: "pull_request", action: "labeled", label: "ready-to-merge" })).toBe(true);
    expect(at({ event_name: "pull_request", action: "labeled", label: "documentation" })).toBe(false);
    expect(at({ event_name: "pull_request", action: "synchronize", headRepo: "someone/smart-ra" })).toBe(false);
    expect(at({ event_name: "push", action: "" })).toBe(false);
  });

  test("every label that starts the full tier also starts the mover", () => {
    const head = CHECKS.jobs["prepare-head"]!.if!;
    const labels = [...head.matchAll(/github\.event\.label\.name == '([^']+)'/g)].map((m) => m[1]!);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(runs(head, { event_name: "pull_request", action: "labeled", label })).toBe(true);
      expect(runs(job.if!, { event_name: "pull_request", action: "labeled", label })).toBe(true);
    }
  });

  test("it asks for contents: write and nothing else, never on pull_request_target", () => {
    expect(MOVE.permissions).toEqual({ contents: "write" });
    expect(job.permissions).toBeUndefined();
    expect(Object.keys(MOVE.on)).toEqual(["workflow_call"]);
    expect(MOVE_SRC.split("\n").filter((l) => !l.trimStart().startsWith("#")).join("\n")).not.toContain("pull_request_target");
  });

  test("two runs for one PR never race: one concurrency group per PR, not cancelled", () => {
    expect(job.concurrency?.group).toContain("github.event.pull_request.number");
    expect(job.concurrency?.["cancel-in-progress"]).toBe(false);
  });
});
