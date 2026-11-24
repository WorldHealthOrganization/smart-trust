/**
 * An index declares who may consent to its mounts (`mountApprovers` in
 * `index.config.json`, folio-assistant#2389), and every rewrite of the index
 * keeps it — and the content-type sections beside it.
 */
import { describe, expect, test } from "bun:test";

import { INDEX_CONFIG_SCHEMA, IndexConfigSchema, formatIndexConfig } from "./kg/index-config";

const base = { $schema: INDEX_CONFIG_SCHEMA, instances: [{ name: "a" }] };

describe("an index's mount approvers", () => {
  test("parse as a non-empty list of distinct names", () => {
    expect(IndexConfigSchema.safeParse({ ...base, mountApprovers: ["litlfred"] }).success).toBe(true);
    for (const bad of [[], [""], ["a", "a"], "litlfred"]) {
      expect(IndexConfigSchema.safeParse({ ...base, mountApprovers: bad }).success).toBe(false);
    }
  });

  test("survive formatIndexConfig, with contentTypes, and are absent when not declared", () => {
    const parsed = IndexConfigSchema.parse({ ...base, mountApprovers: ["litlfred"], contentTypes: { dak: { id: "x" } } });
    const again = JSON.parse(formatIndexConfig(parsed));
    expect(again.mountApprovers).toEqual(["litlfred"]);
    expect(again.contentTypes).toEqual({ dak: { id: "x" } });
    const bare = JSON.parse(formatIndexConfig(IndexConfigSchema.parse(base)));
    expect("mountApprovers" in bare).toBe(false);
    expect("contentTypes" in bare).toBe(false);
  });
});
