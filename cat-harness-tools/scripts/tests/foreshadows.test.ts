import { describe, expect, test } from "bun:test";
import { CONSTRAINT_RULES } from "../../schemas/constraints.ts";
import { parseForeshadows } from "../../pipeline/qa-checkers-extended";

const resolveRule = CONSTRAINT_RULES.find((r) => r.id === "foreshadows-resolve")!;
const selfRule = CONSTRAINT_RULES.find((r) => r.id === "foreshadows-not-self")!;

// `foreshadows-resolve` consults `ctx.allLabels`; `foreshadows-not-self` never
// touches the context.
const ctxWith = (...labels: string[]) =>
  ({ allLabels: new Set(labels) }) as Parameters<typeof resolveRule.check>[1];
const noCtx = {} as Parameters<typeof selfRule.check>[1];

describe("parseForeshadows", () => {
  test("reads a single-line declaration", () => {
    expect(
      parseForeshadows(`export default prose({ foreshadows: ["def:x"] });`),
    ).toEqual(["def:x"]);
  });

  test("reads a multi-line declaration", () => {
    const src = `export default prose({\n  foreshadows: [\n    "def:x",\n    "thm:y",\n  ],\n});\n`;
    expect(parseForeshadows(src)).toEqual(["def:x", "thm:y"]);
  });

  test("absent field yields nothing", () => {
    expect(parseForeshadows(`export default prose({ uses: ["def:x"] });`)).toEqual([]);
  });

  test("empty array yields nothing", () => {
    expect(parseForeshadows(`export default prose({ foreshadows: [] });`)).toEqual([]);
  });
});

describe("foreshadows-resolve", () => {
  // Replaces `foreshadows-subset-of-uses` (removed 2026-08-10, owner ruling).
  // That rule made the field an annotation ON a `uses[]` edge, which could not
  // express a chapter overview naming results it previews but does not depend
  // on. The two lists are now independent — and this rule inherits the
  // referential integrity the subset requirement had been providing for free.

  test("passes when the target exists and is NOT in uses[] — the case the old rule rejected", () => {
    const block = { kind: "prose", label: "rem:overview", foreshadows: ["thm:later"] };
    expect(resolveRule.check(block as never, ctxWith("thm:later"))).toBeNull();
  });

  test("passes when the target exists and is also in uses[]", () => {
    const block = {
      kind: "prose",
      label: "rem:a",
      uses: ["thm:later"],
      foreshadows: ["thm:later"],
    };
    expect(resolveRule.check(block as never, ctxWith("thm:later"))).toBeNull();
  });

  test("fails on a target that does not resolve", () => {
    // The drift the old subset rule used to catch on the `uses[]` side: the
    // target is renamed or deleted and the declaration lingers, pointing at
    // nothing while still looking deliberate.
    const block = { kind: "prose", label: "rem:a", foreshadows: ["thm:gone"] };
    expect(resolveRule.check(block as never, ctxWith("thm:other"))).toContain("thm:gone");
  });

  test("skips cross-paper qualified refs — resolved at folio level", () => {
    const block = {
      kind: "prose",
      label: "rem:a",
      foreshadows: ["unital-groebner-bases:cor:pbw"],
    };
    expect(resolveRule.check(block as never, ctxWith())).toBeNull();
  });

  test("skips full-URL cross-folio refs", () => {
    const block = {
      kind: "prose",
      label: "rem:a",
      foreshadows: ["https://folio.example.org/papers/foo#def:bar"],
    };
    expect(resolveRule.check(block as never, ctxWith())).toBeNull();
  });

  test("reports every offender, not just the first", () => {
    const block = { kind: "prose", label: "rem:a", foreshadows: ["thm:x", "def:y"] };
    const msg = resolveRule.check(block as never, ctxWith())!;
    expect(msg).toContain("thm:x");
    expect(msg).toContain("def:y");
  });

  test("no foreshadows is not a finding", () => {
    expect(resolveRule.check({ kind: "prose", label: "rem:a" } as never, ctxWith())).toBeNull();
  });

  test("empty foreshadows is not a finding", () => {
    const block = { kind: "prose", label: "rem:a", foreshadows: [] };
    expect(resolveRule.check(block as never, ctxWith())).toBeNull();
  });
});

describe("foreshadows-not-self", () => {
  test("fails when a block foreshadows itself", () => {
    const block = { kind: "prose", label: "rem:a", foreshadows: ["rem:a"] };
    expect(selfRule.check(block as never, noCtx)).toContain("rem:a");
  });

  test("passes when it foreshadows something else", () => {
    const block = { kind: "prose", label: "rem:a", foreshadows: ["thm:b"] };
    expect(selfRule.check(block as never, noCtx)).toBeNull();
  });

  test("a missing label is not a finding — another rule owns that", () => {
    const block = { kind: "prose", foreshadows: ["thm:b"] };
    expect(selfRule.check(block as never, noCtx)).toBeNull();
  });
});
