/** The word diff the review page runs (bean d903). */
import { describe, expect, test } from "bun:test";

import { BLOCK_KINDS } from "../../schemas/content/block-kinds.js";
import { defaultRendererFor, DIFF_RENDERERS } from "../../schemas/ui/diff-renderers.js";
import { wordDiff } from "../word-diff.js";

const side = (ops: NonNullable<ReturnType<typeof wordDiff>>, keep: "ins" | "del") =>
  ops.filter((o) => o.op === "same" || o.op === keep).map((o) => o.text).join("");

describe("wordDiff", () => {
  test("a one-word edit is one del and one ins, with everything else same", () => {
    const ops = wordDiff("Give 5 mg daily.", "Give 10 mg daily.")!;
    expect(ops).toEqual([
      { op: "same", text: "Give " },
      { op: "del", text: "5" },
      { op: "ins", text: "10" },
      { op: "same", text: " mg daily." },
    ]);
  });

  test("either side is reconstructed exactly, whitespace and punctuation included", () => {
    const a = "One, two  three.\n\nFour — five?";
    const b = "One, three.\n\nFour — five! Six.";
    const ops = wordDiff(a, b)!;
    expect(side(ops, "del")).toBe(a);
    expect(side(ops, "ins")).toBe(b);
  });

  test("identical text is all same; empty sides are pure ins or del", () => {
    expect(wordDiff("same text", "same text")).toEqual([{ op: "same", text: "same text" }]);
    expect(wordDiff("", "new")).toEqual([{ op: "ins", text: "new" }]);
    expect(wordDiff("old", "")).toEqual([{ op: "del", text: "old" }]);
  });

  test("too large returns null, which the page SAYS rather than freezing", () => {
    expect(wordDiff("a b c d", "e f g h", 10)).toBeNull();
  });

  test("it is self-contained, so the page can embed exactly this function", () => {
    // input-site: inert #1cc5728c — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
    const embedded = new Function(`return (${wordDiff.toString()})`)() as typeof wordDiff;
    expect(embedded("a b", "a c")).toEqual(wordDiff("a b", "a c"));
  });
});

describe("the renderer registry", () => {
  test("exactly one fallback, unique ids, and a default for every kind", () => {
    expect(DIFF_RENDERERS.filter((r) => r.defaultFor.includes("*"))).toHaveLength(1);
    expect(new Set(DIFF_RENDERERS.map((r) => r.id)).size).toBe(DIFF_RENDERERS.length);
    // Every block opens inline (owner, 2026-10-31).
    expect(defaultRendererFor("table").id).toBe("inline");
    expect(defaultRendererFor("prose").id).toBe("inline");
    expect(defaultRendererFor("some-new-kind").id).toBe("inline");
    expect(DIFF_RENDERERS.find((r) => r.id === "inline")!.label).toBe("Inline");
  });

  test("a structured block opens inline too, not on the field table (owner, 2026-11-02)", () => {
    expect(defaultRendererFor("functional-requirement", DIFF_RENDERERS, true).id).toBe("inline");
    expect(defaultRendererFor("prose", DIFF_RENDERERS, true).id).toBe("inline");
    // The field table is still there, as the fallback when inline cannot run.
    expect(defaultRendererFor("x", DIFF_RENDERERS.filter((r) => r.id === "fields"), true).id).toBe("fields");
  });

  test("every kind a renderer defaults for is a real block kind", () => {
    for (const r of DIFF_RENDERERS) for (const k of r.defaultFor) if (k !== "*" && k !== "@structured") expect(BLOCK_KINDS as readonly string[]).toContain(k);
  });
});
