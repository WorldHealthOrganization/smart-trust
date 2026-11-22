import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { historicalPrefixes } from "../src/docs/declaration-claims.js";

// A subscription snapshot holds somebody else's bytes at a pin. Its claims
// describe the upstream's declarations, so the walk must leave it out
// (folio-assistant#2862).
describe("historicalPrefixes", () => {
  test("leaves out a substrate-snapshot directory", () => {
    const root = mkdtempSync(join(tmpdir(), "decl-claims-"));
    const inst = join(root, "inst");
    mkdirSync(join(inst, "subscriptions"), { recursive: true });
    writeFileSync(
      join(inst, "inst.json"),
      JSON.stringify({
        name: "inst",
        directories: [{ id: "subscriptions", path: "subscriptions/", graphTypologies: ["substrate-snapshot"] }],
      }),
    );
    expect(historicalPrefixes(root)).toContain("inst/subscriptions/");
  });
});
