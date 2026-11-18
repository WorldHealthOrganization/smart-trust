import { describe, expect, test } from "bun:test";

import { verdictOf } from "../jsonld-site-check.ts";

const row = (exit: number) => ({ layer: "l", exit, summary: "" });

describe("jsonld:site:check verdict (owner, 2026-11-13: merge fails if the JSON-LD does not render)", () => {
  test("every layer renders: 0", () => expect(verdictOf([row(0), row(0)])).toBe(0));
  test("one layer fails: 1, whatever the others", () => expect(verdictOf([row(0), row(2), row(1)])).toBe(1));
  test("could not determine is never a pass: 2", () => expect(verdictOf([row(0), row(2)])).toBe(2));
  test("no layer: not applicable", () => expect(verdictOf([])).toBe(78));
});
