/**
 * An index switches opt-in sub-graphs on in `index.config.json`
 * (`enableSubgraphs`, cat-harness#991 step 23.4), and every rewrite of the
 * index keeps it. A re-pin rewrites the index through `formatIndexConfig`,
 * and dropping the field there switched folio-assistant's sub-graphs off
 * (folio-assistant#2926).
 */
import { describe, expect, test } from "bun:test";

import { INDEX_CONFIG_SCHEMA, IndexConfigSchema, formatIndexConfig } from "./kg/index-config";

const base = { $schema: INDEX_CONFIG_SCHEMA, instances: [{ name: "a" }] };

describe("an index's enabled sub-graphs", () => {
  test("survive formatIndexConfig, and are absent when not declared", () => {
    const parsed = IndexConfigSchema.parse({ ...base, enableSubgraphs: ["cat-harness.sdlc", "cat-harness.work-plan"] });
    const again = JSON.parse(formatIndexConfig(parsed));
    expect(again.enableSubgraphs).toEqual(["cat-harness.sdlc", "cat-harness.work-plan"]);
    const bare = JSON.parse(formatIndexConfig(IndexConfigSchema.parse(base)));
    expect("enableSubgraphs" in bare).toBe(false);
  });

  test("a formatted index parses again, unchanged", () => {
    const parsed = IndexConfigSchema.parse({ ...base, enableSubgraphs: ["cat-harness.sdlc"] });
    const text = formatIndexConfig(parsed);
    expect(formatIndexConfig(IndexConfigSchema.parse(JSON.parse(text)))).toBe(text);
  });
});
