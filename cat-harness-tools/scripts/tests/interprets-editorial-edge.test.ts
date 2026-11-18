import { describe, expect, test } from "bun:test";
import { parseStringField } from "../../pipeline/uses-field";

/**
 * `interprets` became an editorial edge on 2026-08-15 (owner decision, bean
 * `i8ad`). Before that the graph read `uses[]` alone while
 * `detangler-no-forward-ref` already refused to let a block precede one it
 * interprets — so a constraint was being enforced on a relation the graph did
 * not have, and 342 authored dependencies were absent from every cone, energy
 * and reachability measure.
 *
 * The field is parsed through the shared masked scanner rather than a fresh
 * regex, because a naive `/interprets:\s*"([^"]+)"/` falls to both traps this
 * area keeps producing: a comment before the field, and the field name quoted
 * inside prose. Neither is hypothetical here — this corpus discusses
 * `interprets:` by name in block bodies.
 */
describe("parseStringField", () => {
  test("reads a plain scalar field", () => {
    expect(parseStringField(`interprets: "def:x",`, "interprets")).toBe("def:x");
  });

  test("a comment before the field does not hide it", () => {
    // The extractUses defect, in the scalar case: an anchor whose \s* cannot
    // span a comment silently reports "no such field".
    const src = `title: "T",\n  // this remark is about the proposition below\n  interprets: "prop:y",`;
    expect(parseStringField(src, "interprets")).toBe("prop:y");
  });

  test("the field name quoted in prose does not win over the real field", () => {
    const src = `body: "set interprets: \\"def:ghost\\" on the remark", interprets: "def:real",`;
    expect(parseStringField(src, "interprets")).toBe("def:real");
  });

  test("a label mentioned only in a comment is not the value", () => {
    const src = `// interprets: "def:ghost" was removed in July\n  interprets: "def:real",`;
    expect(parseStringField(src, "interprets")).toBe("def:real");
  });

  test("an absent field is undefined", () => {
    expect(parseStringField(`label: "rem:x",`, "interprets")).toBeUndefined();
  });

  test("a non-string value is skipped rather than mis-read", () => {
    // A variable or template is not something this scanner can resolve; it must
    // say so rather than returning a fragment of source as a label.
    expect(parseStringField(`interprets: someVar,`, "interprets")).toBeUndefined();
  });

  test("the identifier boundary keeps a longer field name out", () => {
    expect(parseStringField(`reinterprets: "def:no", interprets: "def:yes",`, "interprets"))
      .toBe("def:yes");
  });
});
