/**
 * Tests for the Overfull-\hbox log reporter: it must extract each box's
 * magnitude + source line and attribute it to the right file via TeX's
 * `(file … )` open/close convention.
 */

import { describe, test, expect } from "bun:test";
import { parseOverfull } from "../../pipeline/latex-overfull-report";

describe("latex-overfull-report", () => {
  test("parses boxes and tracks the source file across (file …) nesting", () => {
    const log = [
      "(./chapters/intro.tex",
      "Overfull \\hbox (12.5pt too wide) in paragraph at lines 10--12",
      "(./chapters/tables.tex",
      "Overfull \\hbox (187.34pt too wide) in paragraph at lines 200--205",
      ")",
      "Overfull \\hbox (5.0pt too wide) in paragraph at lines 30--31",
      ")",
    ].join("\n");

    const boxes = parseOverfull(log);
    expect(boxes.length).toBe(3);

    const big = boxes.find((b) => b.pt > 100)!;
    expect(big.pt).toBeCloseTo(187.34, 2);
    expect(big.file).toBe("tables.tex"); // attributed to the nested file
    expect(big.line).toBe(200);

    // after tables.tex's ")" we are back in intro.tex
    const last = boxes.find((b) => b.pt === 5)!;
    expect(last.file).toBe("intro.tex");
  });

  test("a clean log yields no boxes", () => {
    expect(parseOverfull("This is a clean run.\nNo warnings here.\n").length).toBe(0);
  });
});
