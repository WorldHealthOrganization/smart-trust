/**
 * The todo graph is declared, present, and READ.
 *
 * All three, because the failure mode is the middle one going missing.
 * `schemas/sdlc/todo.ts`, `schemas/sdlc/todo-graph.ts` and the `todos` / `todo-items`
 * graph typologies existed before any todo did, and `harness.json` did not
 * declare `todos/`. A schema ahead of its graph is harmless. A **declared
 * directory nothing reads** is the bean `dh4f` defect — a consumer scans
 * nothing and reports a clean run over it.
 *
 * The tests here that read the aggregate repository's own root (the
 * root-declared `todos/` and `beans/` graphs, and the processes every layer
 * stacks) live in `test/todos-repo-root.test.ts`
 * (bean `ho66`): standing alone, cat-harness has no such root to read.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "../todos.js";
import { siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { ensureDocsPages, siteNotBuilt } from "../../test/support/checkout.ts";
import { overlayPath } from "../lib/layer-output.ts";

describe("the published process hierarchy", () => {
  beforeAll(() => {
    ensureDocsPages(ROOT);
  }, 180_000);
  const INDEX = join(ROOT, siteDirFor(ROOT), "assets/todos/index.json");
  // Standing alone the index is not built: `docs:pages` writes it at publish,
  // and it is gitignored (bean w1gy F18).
  const NOT_BUILT = (): boolean =>
    siteNotBuilt("the published todo index `docs:pages` writes at publish (gitignored)", overlayPath(INDEX));
  const index = () =>
    JSON.parse(
      readFileSync(overlayPath(INDEX), "utf8"),
    ) as { processes: Record<string, string[]>; items: Array<{ tags: { processes: string[] } }> };

  test.skipIf(NOT_BUILT())("real call edges are present — a silent regex failure would flatten the board", () => {
    // `processHierarchy()` reads `<bpmn:process id>` and `calledElement` with a
    // REGEX rather than through `loadProcessModel`, which is async and pulls in
    // bpmn-moddle for a generator that otherwise touches no XML. The risk of a
    // regex over XML is that it silently matches NOTHING: the hierarchy comes
    // out flat, the board stacks nothing, and every test above still passes
    // because a flat board is a valid board. These are the edges the diagrams
    // actually declare.
    const h = index().processes;
    expect(h["Process_Lifecycle"]).toContain("Process_Publication");
    expect(h["Process_Publication"]).toContain("Process_Editing");
    expect(h["Process_Review"]).toContain("Process_CodeReview");
    expect(Object.values(h).filter((v) => v.length > 0).length).toBeGreaterThan(5);
  });

  test.skipIf(NOT_BUILT())("every process a todo names exists in the hierarchy", () => {
    // A todo tagged with a process no diagram declares would stack at depth 0
    // beside the untagged ones and look correct — a dangling tag that renders
    // as a valid one.
    const { processes, items } = index();
    for (const t of items) {
      for (const p of t.tags.processes) {
        expect({ process: p, declared: p in processes }).toEqual({ process: p, declared: true });
      }
    }
  });
});
