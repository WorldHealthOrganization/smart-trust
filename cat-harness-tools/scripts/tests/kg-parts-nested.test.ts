/**
 * A NESTED subgraph's byte copy: chosen by its parent's id, held by its path
 * (owner, 2026-10-24, cat-harness-tools#744 ruling 4). The layout keeps it
 * apart from the parent's own part, so re-materialising the parent — which
 * replaces the parent's directory whole — never takes the child with it.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { KG_PART_RECORD_SCHEMA } from "../../schemas/kg/substrate-snapshot.js";
import { NESTED_DIR, PART_RECORD_FILE, partDirOf } from "../kg-parts.ts";
import { partRecordsIn } from "../kg-subscribe.ts";

describe("nested subgraph parts", () => {
  test("partDirOf keys a nested part by its path under nested/, apart from its parent's part", () => {
    const snap = "/s";
    expect(partDirOf(snap, "sub", { kind: "subgraph", id: "skills", path: "skills" })).toBe("/s/sub/subgraphs/skills");
    expect(partDirOf(snap, "sub", { kind: "subgraph", id: "skills", path: "skills/voices", nested: true })).toBe(`/s/sub/${NESTED_DIR}/skills/voices`);
  });

  test("partRecordsIn reads a nested part as its own slot, and a file with no record under nested/ as a stray", () => {
    const snap = mkdtempSync(join(tmpdir(), "kg-parts-nested-"));
    const dir = partDirOf(snap, "sub", { kind: "subgraph", id: "skills", path: "skills/voices", nested: true });
    mkdirSync(join(dir, "tree"), { recursive: true });
    writeFileSync(join(dir, "tree", "v.md"), "# v\n");
    writeFileSync(
      join(dir, PART_RECORD_FILE),
      JSON.stringify({ $schema: KG_PART_RECORD_SCHEMA, part: { kind: "subgraph", id: "skills", path: "skills/voices", nested: true }, ref: "0".repeat(40), materialization: { state: "referenced" } }),
    );
    writeFileSync(join(snap, "sub", NESTED_DIR, "loose.md"), "x\n");
    const { parts, strays } = partRecordsIn(snap, "sub");
    expect(parts.map((p) => p.slot)).toEqual([{ kind: "nested", path: "skills/voices" }]);
    expect(parts[0]!.part).toMatchObject({ id: "skills", path: "skills/voices", nested: true });
    expect(strays).toEqual([`sub/${NESTED_DIR}/loose.md`]);
  });
});
