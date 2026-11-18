/**
 * @module bootstrap-tools/scripts/gen-bootstrap-schemas.test
 * @graphNode none — a test
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TOOLS = join(import.meta.dir, "..");
const BOOTSTRAP = join(TOOLS, "..", "bootstrap");

describe("the generator mints from the bootstrap checkout it is handed", () => {
  // A fork moves its address by changing `iriBase` in its own bootstrap.json.
  // Handed that checkout as `--root`, the generator must mint every `$id` from
  // it, never from whatever bootstrap happens to sit beside the tools.
  test("rootNamesTheRelease", () => {
    const fork = mkdtempSync(join(tmpdir(), "bootstrap-fork-"));
    try {
      cpSync(BOOTSTRAP, fork, { recursive: true, filter: (p) => !p.split(/[\\/]/).includes(".git") });
      const declPath = join(fork, "bootstrap.json");
      const decl = JSON.parse(readFileSync(declPath, "utf8")) as { iriBase: string; version: string };
      decl.iriBase = "https://example.org/fork/";
      writeFileSync(declPath, `${JSON.stringify(decl, null, 2)}\n`);

      const run = Bun.spawnSync(["bun", "run", join(TOOLS, "scripts", "gen-bootstrap-schemas.ts"), "--root", fork], { cwd: TOOLS });
      expect(run.exitCode).toBe(0);

      const major = Number(decl.version.split(".")[0]);
      const graph = JSON.parse(readFileSync(join(fork, "schemas", "graph.schema.json"), "utf8")) as { $id: string };
      expect(graph.$id).toBe(`https://example.org/fork/v${major}/schemas/graph.schema.json`);
    } finally {
      rmSync(fork, { recursive: true, force: true });
    }
  });
});
