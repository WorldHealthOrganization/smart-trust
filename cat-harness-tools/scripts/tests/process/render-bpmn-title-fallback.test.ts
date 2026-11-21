/**
 * Every step title in the site's drawing is a link, on every site.
 *
 * A downstream site publishes no subject pages (#1581), so `subjectHref`
 * answers `undefined` there. Before this the step's title was then left
 * unlinked, and a guide's business-processes page showing the site's drawing
 * had no step affordance a process page on the host has. The title now falls
 * back to the process's page in the processes viewer, which every site that
 * publishes the drawing publishes.
 *
 * `render-bpmn.ts` runs on import, so this reads its source, as
 * `render-bpmn-single-writer.test.ts` does.
 *
 * @module scripts/tests/process/render-bpmn-title-fallback.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { TOOLS_ROOT } from "../../lib/roots.ts";
import { processTarget } from "../../process-presentations.js";
import { stepAnchor } from "../../gen-processes-viz.ts";

const src = readFileSync(join(TOOLS_ROOT, "scripts", "render-bpmn.ts"), "utf8");

describe("a step with no page of its own still has a title link", () => {
  test("the subject page wins, else the step's entry on its process's page", () => {
    expect(src).toMatch(/subjectHref\(file, "process", `\$\{s\.process\}\/node\/\$\{s\.id\}`\) \?\?\s*SITE_UP \+ stepOnProcessPage\(basename\(file, "\.bpmn"\), s\.id\)/);
    // The step's anchor, as the processes viewer writes it: without it a title in a drawing shown
    // ON that page linked the page itself, and a click did nothing (smart-trust-demo J3, 2026-11-11).
    expect(src).toContain("return `${processTarget(home, undefined)}#step-${step}`;");
    expect(stepAnchor("Task_Verify")).toBe("step-Task_Verify");
  });

  test("every step is linked, not only those with a subject page", () => {
    expect(src).toContain("titles.set(s.id, { href, name: s.name });");
    expect(src).not.toMatch(/if \(href\) titles\.set/);
  });

  test("the fallback is the processes viewer's page, never a docs section another site may not publish", () => {
    // A docs section presenting the diagram can be the host's alone; the
    // process page is written wherever the drawing is.
    const one = [{ page: "guides/x", href: "docs/cat-harness/guides/x.html", node: "n", pageTitle: "X" }];
    expect(processTarget("p", undefined)).toMatch(/\/p\.html$/);
    expect(processTarget("p", undefined)).not.toBe(processTarget("p", one));
  });
});
