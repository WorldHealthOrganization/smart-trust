/**
 * Every recorded process reference names a process a loaded diagram declares
 * (#1168 B8).
 *
 * Owner, 2026-09-30 (*"BPMN element id"*): a process is referred to by the id
 * its `<bpmn:process>` element declares — `Process_CRDM` — the form BPMN's own
 * `calledElement` uses and every committed reference already used. The schema
 * (`ProcessElementIdSchema`) checks the shape; this checks that it resolves —
 * workflow instances, workflow policies, and a voice's `activeIn.processes`.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Glob } from "bun";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));

/** Every `<bpmn:process id>` in the repository's diagrams. */
function declaredProcessIds(): Set<string> {
  const out = new Set<string>();
  for (const rel of new Glob("**/*.bpmn").scanSync({ cwd: REPO })) {
    if (rel.includes("node_modules/") || rel.includes("/docs/")) continue;
    for (const m of readFileSync(join(REPO, rel), "utf-8").matchAll(/<bpmn:process\b[^>]*\bid="([^"]+)"/g)) out.add(m[1]!);
  }
  return out;
}

describe("recorded process references resolve", () => {
  const ids = declaredProcessIds();
  const refs: { where: string; id: string }[] = [];
  const wfDir = join(REPO, "beans", "workflows");
  if (existsSync(wfDir)) {
    for (const rel of new Glob("*.json").scanSync({ cwd: wfDir })) {
      const doc = JSON.parse(readFileSync(join(wfDir, rel), "utf-8")) as { processId?: string };
      if (doc.processId) refs.push({ where: `beans/workflows/${rel}`, id: doc.processId });
    }
  }
  for (const rel of new Glob("**/workflow-policy.json").scanSync({ cwd: REPO })) {
    if (rel.includes("node_modules/")) continue;
    const text = readFileSync(join(REPO, rel), "utf-8");
    for (const m of text.matchAll(/"process":\s*"([^"]+)"/g)) refs.push({ where: rel, id: m[1]! });
  }

  // A voice scoped to processes names them by element id too. None does
  // today, so these add nothing yet; the scan is here so the first one is
  // checked rather than trusted.
  for (const rel of new Glob("**/skills/voices/**/*.json").scanSync({ cwd: REPO })) {
    if (rel.includes("node_modules/")) continue;
    const doc = JSON.parse(readFileSync(join(REPO, rel), "utf-8")) as { $schema?: string; activeIn?: { processes?: string[] } };
    if (!doc.$schema?.startsWith("folio-voice")) continue;
    for (const id of doc.activeIn?.processes ?? []) refs.push({ where: `${rel} activeIn.processes`, id });
  }

  test("the corpus is non-empty, so the assertion below is not vacuous", () => {
    expect(ids.size).toBeGreaterThan(10);
    if (existsSync(wfDir)) {
      expect(refs.length).toBeGreaterThan(0);
    }
  });

  test("every reference is a declared BPMN process element id", () => {
    const dangling = refs.filter((r) => !ids.has(r.id)).map((r) => `${r.where} → ${r.id}`);
    expect(dangling).toEqual([]);
  });

  test("the render log's writer records the element id, not the file stem", () => {
    const src = readFileSync(join(TOOLS_ROOT, "scripts", "render-log.ts"), "utf-8");
    const m = /process:\s*"([^"]+)"/.exec(src);
    expect(m?.[1] && ids.has(m[1])).toBe(true);
  });
});
