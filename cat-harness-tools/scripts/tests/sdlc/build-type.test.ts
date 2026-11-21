/**
 * The two build types (owner, 2026-11-01): a preview borrows main's indexes,
 * a full build rebuilds them, and any doubt builds full.
 *
 * @module scripts/tests/sdlc/build-type
 */
import { describe, expect, test } from "bun:test";

import { BUILD_TYPE_ENV, buildTypeOf, isIndexWriter } from "../../lib/build-type.ts";
import { BuiltAtPublishSchema } from "../../../schemas/kg/built-at-publish.ts";

describe("buildTypeOf", () => {
  test("unset builds full", () => {
    expect(buildTypeOf({})).toMatchObject({ type: "full" });
    expect(buildTypeOf({ [BUILD_TYPE_ENV]: " " })).toMatchObject({ type: "full" });
  });

  test("names preview or full", () => {
    expect(buildTypeOf({ [BUILD_TYPE_ENV]: "preview" })).toMatchObject({ type: "preview" });
    expect(buildTypeOf({ [BUILD_TYPE_ENV]: "full" })).toMatchObject({ type: "full" });
  });

  test("refuses anything else, so a typo cannot pass for a full build", () => {
    expect(buildTypeOf({ [BUILD_TYPE_ENV]: "previw" })).toHaveProperty("refused");
    expect(buildTypeOf({ [BUILD_TYPE_ENV]: "staging" })).toHaveProperty("refused");
  });
});

describe("isIndexWriter", () => {
  const plan = [
    { writer: ["lsi:viz"], index: true as const },
    { writer: ["slice:sqlite"], index: true as const },
    { writer: ["slice:sqlite", "docs:pages"] },
    { writer: ["docs:pages"] },
  ];

  test("a writer all of whose entries are indexes is borrowed", () => {
    expect(isIndexWriter("lsi:viz", plan)).toBe(true);
  });

  test("a writer that also writes a page is not: borrowing it would keep main's page", () => {
    expect(isIndexWriter("slice:sqlite", plan)).toBe(false);
    expect(isIndexWriter("docs:pages", plan)).toBe(false);
  });

  test("a writer nothing declares is not", () => {
    expect(isIndexWriter("kg:export", plan)).toBe(false);
  });
});

describe("the declaration field", () => {
  const entry = { path: "docs/x/", writer: ["lsi:viz"], because: "checkout", reason: "r" };

  test("index: true is accepted", () => {
    expect(BuiltAtPublishSchema.safeParse({ ...entry, index: true }).success).toBe(true);
  });

  test("index: false is refused: leave it out instead", () => {
    expect(BuiltAtPublishSchema.safeParse({ ...entry, index: false }).success).toBe(false);
  });
});
