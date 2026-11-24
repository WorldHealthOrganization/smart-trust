/**
 * `remedies` on a Tool — what to reach for when a host refuses it (bean `6mk7`).
 *
 * Synthetic Tools only: the real graph's answer is asserted in
 * `test/tools-checkout.test.ts`, since the Tools that need packages.fhir.org
 * live in another layer and cat-harness standing alone has none of them.
 */
import { describe, expect, test } from "bun:test";

import {
  ToolDefinitionSchema,
  ToolRemedySchema,
  danglingRemedies,
  networkToolsWithoutRemedies,
  remediesFor,
  type ToolDefinition,
} from "../../../schemas/tools/tool.js";

function tool(id: string, extra: Partial<ToolDefinition> = {}): ToolDefinition {
  return ToolDefinitionSchema.parse({
    id,
    title: id,
    description: id,
    install: { none: true },
    invoke: { shell: `run-${id}` },
    io: { inputs: [], outputs: [] },
    satisfies: ["some-skill"],
    ...extra,
  });
}

describe("ToolRemedySchema", () => {
  test("names exactly one of tool or none", () => {
    expect(ToolRemedySchema.safeParse({ host: "packages.fhir.org", tool: "seeder" }).success).toBe(true);
    expect(ToolRemedySchema.safeParse({ host: "github.com", none: "a push needs GitHub" }).success).toBe(true);
    expect(ToolRemedySchema.safeParse({ host: "github.com" }).success).toBe(false);
    expect(ToolRemedySchema.safeParse({ host: "github.com", tool: "x", none: "y" }).success).toBe(false);
  });

  test("a host is a bare host name, not a URL", () => {
    expect(ToolRemedySchema.safeParse({ host: "https://packages.fhir.org", none: "n" }).success).toBe(false);
    expect(ToolRemedySchema.safeParse({ host: "packages.fhir.org/x", none: "n" }).success).toBe(false);
    expect(ToolRemedySchema.safeParse({ host: "localhost", none: "n" }).success).toBe(false);
  });
});

describe("the gate: a network Tool states its remedies", () => {
  test("network: true with no remedies is reported; with remedies, or offline, it is not", () => {
    const set = [
      tool("bare", { requires: { network: true } }),
      tool("empty", { requires: { network: true }, remedies: [] }),
      tool("stated", { requires: { network: true }, remedies: [{ host: "github.com", none: "needs GitHub" }] }),
      tool("offline", { requires: { network: false } }),
      tool("unspecified"),
    ];
    expect(networkToolsWithoutRemedies(set)).toEqual(["bare", "empty"]);
  });

  test("a remedy naming no declared Tool is dangling", () => {
    const set = [
      tool("sushi-ish", { requires: { network: true }, remedies: [{ host: "packages.fhir.org", tool: "seeder" }] }),
    ];
    expect(danglingRemedies(set)).toEqual([{ tool: "sushi-ish", host: "packages.fhir.org", remedy: "seeder" }]);
    expect(danglingRemedies([...set, tool("seeder")])).toEqual([]);
  });
});

describe("remediesFor — from the symptom in hand", () => {
  const set = [
    tool("seeder"),
    tool("ig", {
      requires: { network: true },
      remedies: [
        { host: "packages.fhir.org", tool: "seeder" },
        { host: "tx.fhir.org", none: "no terminology server here" },
      ],
    }),
    tool("lean", {
      requires: { network: true },
      remedies: [{ host: "release.lean-lang.org", error: "Host not in allowlist", tool: "seeder" }],
    }),
  ];

  test("a bare host finds its Tool and the Tool's command", () => {
    expect(remediesFor(set, "packages.fhir.org")).toEqual([
      { needed_by: "ig", host: "packages.fhir.org", tool: "seeder", invoke: "run-seeder" },
    ]);
  });

  test("a URL or a pasted error line containing the host matches, case-insensitively", () => {
    const line = "error Failed to download HTTPS://PACKAGES.FHIR.ORG/hl7.fhir.r4.core/4.0.1: 403";
    expect(remediesFor(set, line).map((m) => m.tool)).toEqual(["seeder"]);
  });

  test("the error text matches when the host is not in the message", () => {
    expect(remediesFor(set, "403 Host not in allowlist").map((m) => m.needed_by)).toEqual(["lean"]);
  });

  test("a stated none is an answer, not an absence", () => {
    expect(remediesFor(set, "tx.fhir.org")).toEqual([{ needed_by: "ig", host: "tx.fhir.org", none: "no terminology server here" }]);
  });

  test("an unrelated host matches nothing", () => {
    expect(remediesFor(set, "example.org")).toEqual([]);
  });
});
