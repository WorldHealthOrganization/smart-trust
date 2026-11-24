/**
 * A workflow template that only runs on `workflow_dispatch` must not gate a
 * job or step on `github.event_name == 'push'`: that condition can never be
 * true, so the job silently never runs.
 *
 * Measured, not hypothetical (folio-assistant#1492): the paper templates
 * `blueprint.yml` and `lean_ci.yml` were dispatch-only while their deploy,
 * artifact-upload and doc-gen4 jobs were gated on `push`. Every folio
 * `folio_init` created got a blueprint and a Lean docs site that could not
 * publish, and no run failed to say so.
 */

import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "fs";
import { join } from "path";

const TEMPLATES = join(import.meta.dir, "..", "..", "..", "templates");

const workflows = [...new Glob("**/workflows/*.yml").scanSync({ cwd: TEMPLATES })].map((rel) => ({
  rel,
  text: readFileSync(join(TEMPLATES, rel), "utf-8"),
}));

/** `on:` declares a push trigger (the block form `on:\n  push:` or a list/flow form naming push). */
function triggersOnPush(yml: string): boolean {
  const on = yml.match(/^on:\s*(.*)\n((?:[ \t]+.*\n|\s*\n)*)/m);
  if (!on) return false;
  return /\bpush\b/.test(on[1] ?? "") || /^\s+push\s*:/m.test(on[2] ?? "");
}

describe("dispatch-only workflow templates never gate on push", () => {
  test("there are templates to check (the rule is not vacuous)", () => {
    expect(workflows.length).toBeGreaterThan(0);
  });

  test.each(workflows.filter((w) => !triggersOnPush(w.text)).map((w) => [w.rel, w.text] as const))("%s has no job or step that waits for a push", (_rel, text) => {
    const dead = text
      .split("\n")
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => /^\s*if:.*github\.event_name\s*==\s*'push'/.test(line))
      .map(({ n, line }) => `${n}: ${line.trim()}`);
    expect(dead, `a condition that can never be true in a dispatch-only workflow`).toEqual([]);
  });
});
