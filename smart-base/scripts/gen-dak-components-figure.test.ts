/**
 * Slide 3 of the living deck (`cat-harness/docs/source/concepts-harnessed-kg-overview/`):
 * the ten DAK components, and the squares figure generated from them.
 *
 * Moved from `cat-harness/scripts/tests/harnessed-kg-overview.test.ts` in bean
 * `1335`, with the generator and the DAK vocabulary it reads. The claims are
 * unchanged; only who makes them moved. The page itself is cat-harness's, so
 * this test reads it there — the allowed direction, since smart-base needs
 * cat-harness.
 *
 * @module smart-base/scripts/gen-dak-components-figure.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { DAK_COMPONENTS, DAK_UNFORMALIZED_COMPONENTS } from "../schemas/dak-kinds.ts";
import { DAK_CARDS, DAK_FIGURE_PATH, renderDakComponentsSvg } from "./gen-dak-components-figure.ts";

const DECK = resolve(import.meta.dir, "../../cat-harness/docs/source/concepts-harnessed-kg-overview");
const read = (p: string) => readFileSync(p, "utf-8");

describe("living deck slide 3: the DAK components", () => {
  test("tenComponentsSchedulingLogicUnformalized", () => {
    // The owner's count is 10 (2026-09-30). When WHO formalizes scheduling logic
    // it leaves the unformalized list, and slide 3's note must be revised.
    expect(DAK_COMPONENTS).toHaveLength(10);
    expect(DAK_COMPONENTS).toContain("test-scenarios");
    expect(DAK_UNFORMALIZED_COMPONENTS).toEqual(["scheduling-logic"]);
  });

  test("squaresFigureOneCardPerComponentCurrent", () => {
    expect(Object.keys(DAK_CARDS).sort()).toEqual([...DAK_COMPONENTS].sort());
    const svg = renderDakComponentsSvg();
    // One number badge per component, in vocabulary order.
    for (let i = 1; i <= DAK_COMPONENTS.length; i++) expect(svg).toContain(`>${i}</text>`);
    expect(svg).toContain("Not yet its own DAK model field");
    expect(read(DAK_FIGURE_PATH), "run smart-base/scripts/gen-dak-components-figure.ts").toBe(svg);
    // Through `relative_url`: the deck's page publishes under `docs/cat-harness/` (bean `kc7k`).
    expect(read(join(DECK, "slide-03.md"))).toContain("]({{ '/assets/img/dak-components.svg' | relative_url }})");
  });
});
