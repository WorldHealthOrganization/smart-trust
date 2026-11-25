/**
 * Bean `vjbl` — the blinded packet leaks no label, and the agreement maths is right.
 */
import { describe, expect, test } from "bun:test";

import { kappa, pack, redact, type Item } from "../eval-crdm-detect-blind.ts";

const items: Item[] = [
  { number: 187, title: "A", isFeature: false, why: "w", text: "t" },
  { number: 199, title: "B", isFeature: true, why: "w", text: "u" },
];

describe("the packet an annotator is handed", () => {
  test("carries no label, no reason and no issue number", () => {
    const { blinded, key } = pack(items);
    for (const b of blinded) expect(Object.keys(b).sort()).toEqual(["id", "text", "title"]);
    expect(JSON.stringify(blinded)).not.toContain("187");
    expect(key).toEqual({ b01: 187, b02: 199 });
  });

  test("the skill loses only the paragraphs that name a CORPUS issue", () => {
    const md = "Intro.\n\n#187 is not a feature.\n\nSee #980 for the ruling.\n\nOutro.";
    expect(redact(md, [187, 199])).toBe("Intro.\n\nSee #980 for the ruling.\n\nOutro.");
  });
});

describe("Cohen's kappa", () => {
  test("perfect agreement is 1, and agreement at chance is 0", () => {
    expect(kappa([[true, true], [false, false]])).toBe(1);
    expect(kappa([[true, true], [true, false], [false, true], [false, false]])).toBeCloseTo(0);
  });
});
