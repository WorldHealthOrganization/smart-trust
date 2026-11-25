/**
 * A `[text](#sec:…)` link may target a nested section. `validateObjects`
 * collected only top-level section labels, so a link to a subsection was
 * reported as an undefined cross-reference although it resolves (found on
 * qou, 2026-10-10, when an Overview section gained titled subsections).
 */

import { describe, expect, test } from "bun:test";
import { sectionLabels } from "./validate";
import type { Chapter } from "../schemas/types.ts";

describe("sectionLabels", () => {
  test("collects labels at every depth, in document order", () => {
    const sections = [
      {
        title: "Overview",
        label: "sec:overview",
        blocks: ["intro"],
        subsections: [
          { title: "A", label: "sec:a", blocks: ["a"] },
          { title: "B", label: "sec:b", blocks: ["b"], subsections: [{ title: "C", label: "sec:c", blocks: [] }] },
        ],
      },
      { title: "Unlabelled", blocks: ["x"] },
      { title: "Last", label: "sec:last", blocks: [] },
    ] as unknown as Chapter["sections"];
    expect(sectionLabels(sections)).toEqual(["sec:overview", "sec:a", "sec:b", "sec:c", "sec:last"]);
  });

  test("an empty chapter has no labels", () => {
    expect(sectionLabels([] as Chapter["sections"])).toEqual([]);
  });
});
