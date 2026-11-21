import { describe, expect, test } from "bun:test";

import { missingTopLevelKeys } from "../lib/json-shape.ts";

describe("missingTopLevelKeys — a verdict projection's SHAPE is gated, its contents are not (bean 324x)", () => {
  test("a field the generator now writes and the committed copy lacks is reported", () => {
    expect(missingTopLevelKeys(`{"items":[],"plan":{}}`, `{"items":[1],"edges":[],"plan":{}}`)).toEqual(["edges"]);
  });

  test("contents that moved are NOT a finding", () => {
    expect(missingTopLevelKeys(`{"items":[1,2],"edges":[]}`, `{"items":[3],"edges":[9]}`)).toEqual([]);
  });

  test("a field the committed copy has and the generator dropped is not this check's question", () => {
    expect(missingTopLevelKeys(`{"items":[],"old":1}`, `{"items":[]}`)).toEqual([]);
  });

  test("anything that is not a JSON object on both sides yields nothing", () => {
    expect(missingTopLevelKeys("not json", `{"a":1}`)).toEqual([]);
    expect(missingTopLevelKeys(`[1]`, `{"a":1}`)).toEqual([]);
  });
});
