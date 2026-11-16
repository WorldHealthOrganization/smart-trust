/**
 * `overrides.<instance>.tools` — Tools chosen by id for a runnable mount
 * (bean `mo75` G3; owner, 2026-10-24). The schema half only: what a Tool
 * brings is computed by the remote mount in cat-harness-tools.
 */
import { describe, expect, test } from "bun:test";

import { MountOverrideSchema, RemoteMountSchema } from "./kg/remote-mount.ts";

describe("MountOverrideSchema.tools", () => {
  test("names Tools by id, beside the other override fields", () => {
    const o = MountOverrideSchema.parse({ tools: ["bean-query", "agent-memory"], directories: ["skills"] });
    expect(o.tools).toEqual(["bean-query", "agent-memory"]);
    const m = RemoteMountSchema.parse({
      harness: "cat-harness-tools",
      repository: "litlfred/cat-harness-tools",
      ref: "0".repeat(40),
      overrides: { "cat-harness": { tools: ["bpmn-checklist"] } },
    });
    expect(m.overrides?.["cat-harness"]?.tools).toEqual(["bpmn-checklist"]);
  });

  test("refuses an id that is not a Tool id, an id named twice, and an empty list", () => {
    expect(MountOverrideSchema.safeParse({ tools: ["Bean_Query"] }).success).toBe(false);
    expect(MountOverrideSchema.safeParse({ tools: ["tools/bean-query"] }).success).toBe(false);
    expect(MountOverrideSchema.safeParse({ tools: ["bean-query", "bean-query"] }).success).toBe(false);
    expect(MountOverrideSchema.safeParse({ tools: [] }).success).toBe(false);
  });
});
