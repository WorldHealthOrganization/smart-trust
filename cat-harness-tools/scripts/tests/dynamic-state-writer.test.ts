/**
 * The dynamic-state document is written by whoever links it.
 *
 * Measured 2026-10-30 on litlfred/smart-ra (cat-harness-tools 9326f5d
 * onward): its instance-site build (`build-instance-site.ts`) ran the state
 * visualiser, whose workflow pages link `<site>/<harness>/state.jsonld`, but
 * only `render-pipeline.ts` (stage 3, `dynamic-state-export.ts`) wrote that
 * file. The link gate found 1 unresolved link and refused the publish.
 * cat-harness-tools#937 made the generator write the document whenever it
 * draws a workflow page; these tests hold it to the one writer stage 3 uses.
 *
 * @module scripts/tests/dynamic-state-writer.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { dynamicStateHref, dynamicStatePath, dynamicStateTarget, writeDynamicState } from "../state-visualizer.ts";
import { DYNAMIC_STATE_FILE, DYNAMIC_STATE_SCHEMA } from "../workflow-view.ts";

const SCRIPTS = join(import.meta.dir, "..");

describe("writeDynamicState: the one writer of state.jsonld", () => {
  test("writes a DynamicState document, creating the harness directory of a site that has none", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dynamic-state-"));
    try {
      // A root with no declaration has no layers: the document is still
      // written, and says so, rather than leaving the pages' link dangling.
      const root = join(dir, "empty-harness");
      const out = dynamicStatePath(join(dir, "site"), "cat-harness");
      const { doc, out: wrote } = await writeDynamicState(out, { root, now: new Date("2026-10-30T00:00:00Z") });
      expect(wrote).toBe(out);
      expect(existsSync(out)).toBe(true);
      const read = JSON.parse(readFileSync(out, "utf8")) as { $schema: string; graph: unknown[] };
      expect(read.$schema).toBe(DYNAMIC_STATE_SCHEMA);
      expect(read.graph).toEqual([]);
      expect(doc.graph).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a workflow page's link resolves to the file it writes by default", () => {
    const target = dynamicStateTarget();
    expect(target.endsWith(join("cat-harness", DYNAMIC_STATE_FILE)) || target.endsWith(DYNAMIC_STATE_FILE)).toBe(true);
    // The page at `<site>/en/<harness>/beans/<store>/workflows/<id>/`, as the smart-ra page was.
    const site = dirname(dirname(target));
    const pageDir = join(site, "en", "cat-harness", "beans", "cat-harness-tools", "workflows", "some-instance");
    const href = dynamicStateHref(pageDir);
    expect(href).toBe("../../../../../../cat-harness/state.jsonld");
    expect(resolve(pageDir, href)).toBe(target);
  });
});

describe("the generator writes the document whenever a workflow page links it", () => {
  // Read from source: the generator's main is a script run against a whole
  // checkout, so this pins the two facts the build depends on — every page
  // takes its link from `dynamicStateHref`, and a run that drew one writes it.
  const src = readFileSync(join(SCRIPTS, "state-visualizer.ts"), "utf8");
  test("every workflow page takes its link from dynamicStateHref", () => {
    expect(src).toContain("stateDocument: dynamicStateHref(pageDir)");
    expect(src.match(/stateDocument:/g)?.length).toBe(1);
  });
  test("a write run that drew a workflow page calls writeDynamicState", () => {
    const drawn = src.indexOf("workflowPagesDrawn++;");
    const written = src.indexOf("if (workflowPagesDrawn > 0) {");
    expect(drawn).toBeGreaterThan(0);
    expect(written).toBeGreaterThan(drawn);
    expect(src.slice(written, written + 120)).toContain("await writeDynamicState(");
  });
  test("stage 3 uses the same writer", () => {
    expect(readFileSync(join(SCRIPTS, "dynamic-state-export.ts"), "utf8")).toContain("await writeDynamicState(");
  });
});
