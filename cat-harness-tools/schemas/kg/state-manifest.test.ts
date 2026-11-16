/**
 * `state-manifest/v1` — bean `esz4`. Fixtures are the real manifests' shapes,
 * trimmed: one per keying, the retired branch's extra keys, and the one
 * defect the schema found on its first run.
 */
import { describe, expect, test } from "bun:test";

import { StateManifestSchema } from "./state-manifest.ts";

const SHA = "3d4caf6e0f1c322b7a976150fe1f237bf36c927f";

const tip = {
  $schema: "state-manifest/v1",
  keyedBy: "tip",
  status: "active",
  authoritative: true,
  subgraph: "beans",
  source: { ref: "main", sha: SHA },
  seededAt: "2026-10-02T22:31:02Z",
  graphs: [{ path: "beans", tree: SHA, files: 1783 }],
};

const route = {
  $schema: "state-manifest/v1",
  keyedBy: "route",
  status: "seed",
  authoritative: false,
  seededFrom: SHA,
  seededAt: "2026-10-04T05:33:56Z",
  writer: "cat-harness/scripts/gen-uml-overview.ts",
  gate: "bun run uml:overview:check",
  directories: [{ id: "uml-overview-pages", path: "cat-harness/docs/uml/overview" }],
};

describe("state-manifest/v1", () => {
  test("a tip-keyed and a route-keyed manifest each parse as their own shape", () => {
    expect(StateManifestSchema.parse(tip).keyedBy).toBe("tip");
    expect(StateManifestSchema.parse(route).keyedBy).toBe("route");
  });

  test("a retired branch keeps the keys that record WHY", () => {
    const retired = { ...tip, status: "retired", authoritative: false, retiredAt: "2026-10-03", supersededBy: { todos: "cat/cat-harness/todos" } };
    const parsed = StateManifestSchema.parse(retired) as Record<string, unknown>;
    expect(parsed.supersededBy).toEqual({ todos: "cat/cat-harness/todos" });
  });

  test("a revision expression is not a seed commit — `<sha>^` names one only against a history", () => {
    // Found on cat/cat-harness/todos, 2026-10-12: `source.sha` reads `cd8293f…^`.
    const r = StateManifestSchema.safeParse({ ...tip, source: { ref: "main", sha: `${SHA}^` } });
    expect(r.success).toBe(false);
  });

  test("a route-keyed manifest without its writer or gate is refused — those are what make it regenerable", () => {
    const { writer: _w, ...noWriter } = route;
    expect(StateManifestSchema.safeParse(noWriter).success).toBe(false);
    const { gate: _g, ...noGate } = route;
    expect(StateManifestSchema.safeParse(noGate).success).toBe(false);
  });

  test("a status outside the four is refused", () => {
    expect(StateManifestSchema.safeParse({ ...tip, status: "live" }).success).toBe(false);
  });
});
