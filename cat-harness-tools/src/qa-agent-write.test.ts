/**
 * `qa-agent-write` writes where `existingBlockQaPath` reads: bean `r7v6`
 * (reader audit row R50).
 *
 * The defect: the writer read and wrote `${base}.qa.json` beside the block.
 * Every reader prefers the results tree, so an agent verdict written there was
 * shadowed by the results-tree copy and never read. These tests run the CLI
 * itself against a throwaway content repository. The CLI is top-level script
 * code, so a spawn is the honest unit.
 */
import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { blockQaPath, existingBlockQaPath, legacyBlockQaPath } from "../pipeline/qa-paths";

const SCRIPT = resolve(import.meta.dir, "qa-agent-write.ts");

/**
 * Each spawn of the CLI is about 1.4 s cold, measured 2026-10-01. A test runs at
 * most two, so budget for four spawns rather than inherit bun's 5 s default
 * (bean `sff8`: an expensive test silently inheriting the default is the
 * population that times out under load).
 */
const SPAWN_BUDGET_MS = 4 * 5_000;

/** A content repo: `.git` anchors `findContentRepoRoot`, and one block under it. */
function repo(): { root: string; base: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "qa-agent-write-"));
  mkdirSync(join(root, ".git"));
  mkdirSync(join(root, "content", "ch1"), { recursive: true });
  const base = join(root, "content", "ch1", "blk");
  writeFileSync(`${base}.ts`, 'export default definition({ label: "def:blk" });\n');
  writeFileSync(`${base}.md`, "A definition.\n");
  return { root, base, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function write(base: string, criterion: string, cwd: string, extraArgs: string[] = []): void {
  const r = spawnSync("bun", [SCRIPT, "--block", base, "--criterion", criterion, "--result", "pass", ...extraArgs], {
    cwd,
    encoding: "utf-8",
  });
  if (r.status !== 0) throw new Error(`qa-agent-write exited ${String(r.status)}: ${r.stderr}`);
}

describe("qa-agent-write", () => {
  it("writes into the results tree, which is where the readers look first", () => {
    const t = repo();
    try {
      write(t.base, "c-one", t.root);
      expect(existsSync(blockQaPath(t.root, t.base))).toBe(true);
      // Nothing beside the block: the legacy path is read, never written.
      expect(existsSync(legacyBlockQaPath(t.base))).toBe(false);
      expect(existingBlockQaPath(t.root, t.base)).toBe(blockQaPath(t.root, t.base));
    } finally {
      t.cleanup();
    }
  }, SPAWN_BUDGET_MS);

  it("does not depend on the cwd it is run from", () => {
    const t = repo();
    try {
      write(t.base, "c-one", tmpdir());
      expect(existsSync(blockQaPath(t.root, t.base))).toBe(true);
    } finally {
      t.cleanup();
    }
  }, SPAWN_BUDGET_MS);

  it("migrates a legacy verdict: its entries are kept, and the new one lands in the results tree", () => {
    const t = repo();
    try {
      writeFileSync(
        legacyBlockQaPath(t.base),
        JSON.stringify({
          $schema: "block-qa/v1",
          label: "def:blk",
          kind: "definition",
          paths: { ts: "content/ch1/blk.ts" },
          source_hashes: {},
          criteria: {
            "c-legacy": [
              {
                field_hash: {},
                result: "pass",
                reviewer: { kind: "human", id: "owner" },
                reviewed_at: "2026-09-01T00:00:00Z",
                reviewed_sha: "x",
              },
            ],
          },
          updated_at: "2026-09-01T00:00:00Z",
        }),
      );
      write(t.base, "c-new", t.root);
      const out = JSON.parse(readFileSync(blockQaPath(t.root, t.base), "utf-8")) as { criteria: Record<string, unknown> };
      expect(Object.keys(out.criteria).sort()).toEqual(["c-legacy", "c-new"]);
    } finally {
      t.cleanup();
    }
  }, SPAWN_BUDGET_MS);

  it("appends to an existing results-tree verdict rather than to a shadowed legacy one", () => {
    const t = repo();
    try {
      write(t.base, "c-one", t.root);
      write(t.base, "c-two", t.root);
      const out = JSON.parse(readFileSync(blockQaPath(t.root, t.base), "utf-8")) as { criteria: Record<string, unknown> };
      expect(Object.keys(out.criteria).sort()).toEqual(["c-one", "c-two"]);
    } finally {
      t.cleanup();
    }
  }, SPAWN_BUDGET_MS);

  it("omits agent_model when --model is not supplied (bean gtx4)", () => {
    const t = repo();
    try {
      write(t.base, "c-nomodel", t.root);
      const out = JSON.parse(readFileSync(blockQaPath(t.root, t.base), "utf-8")) as {
        criteria: Record<string, Array<{ reviewer: { kind: string; agent_model?: string; agent_skill?: string } }>>;
      };
      const reviewer = out.criteria["c-nomodel"]![0]!.reviewer;
      expect(reviewer.kind).toBe("agent");
      expect(reviewer.agent_model).toBeUndefined();
      expect(reviewer.agent_skill).toBe("local/qa-agent-drain");
    } finally {
      t.cleanup();
    }
  }, SPAWN_BUDGET_MS);

  it("records agent_model when --model is supplied (bean gtx4)", () => {
    const t = repo();
    try {
      write(t.base, "c-withmodel", t.root, ["--model", "claude-sonnet-4-6"]);
      const out = JSON.parse(readFileSync(blockQaPath(t.root, t.base), "utf-8")) as {
        criteria: Record<string, Array<{ reviewer: { kind: string; agent_model?: string } }>>;
      };
      const reviewer = out.criteria["c-withmodel"]![0]!.reviewer;
      expect(reviewer.kind).toBe("agent");
      expect(reviewer.agent_model).toBe("claude-sonnet-4-6");
    } finally {
      t.cleanup();
    }
  }, SPAWN_BUDGET_MS);
});
