/**
 * `qa-agent-entry`: the evidence guard and the Lean field hash.
 *
 * Both fixes come from litlfred/qou's fork of this writer (2026-10-04, the T11
 * fork audit, owner-approved), and these tests are ported from that fork's
 * `qa-agent-entry.guard.test.ts` and `qa-agent-entry.fieldhash.test.ts`,
 * adapted to the results-tree layout this copy writes.
 *
 * 1. A `fail` or `warn` asserts a violation; without `--evidence` the writer
 *    used to record it with an empty reason, which no reader can check.
 * 2. The writer hashed only `.md` and `.ts`. The staleness reader hashes the
 *    block's Lean too, so an agent verdict on a Lean-reading criterion could
 *    never be fresh and re-queued forever.
 *
 * The CLI is top-level script code, so a spawn is the honest unit, run from
 * inside a throwaway content repository exactly as `qa-agent-write.test.ts`
 * does.
 */
import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { blockQaPath } from "./qa-paths";

const SCRIPT = resolve(import.meta.dir, "qa-agent-entry.ts");

/** About 1.5 s per cold spawn; a test runs at most two (bean `sff8`). */
const SPAWN_BUDGET_MS = 4 * 5_000;

interface Repo {
  root: string;
  base: string;
  cleanup: () => void;
}

/** A content repo (`.git` anchors `findContentRepoRoot`) with one block. */
function repo(siblings: { ts?: boolean; lean?: boolean } = {}): Repo {
  const root = mkdtempSync(join(tmpdir(), "qa-agent-entry-"));
  mkdirSync(join(root, ".git"));
  mkdirSync(join(root, "content", "ch1"), { recursive: true });
  const base = join(root, "content", "ch1", "blk");
  writeFileSync(`${base}.md`, "A remark.\n");
  if (siblings.ts) writeFileSync(`${base}.ts`, 'export default remark({ label: "rem:blk" });\n');
  if (siblings.lean) writeFileSync(`${base}.lean`, "theorem t : True := trivial\n");
  return { root, base, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function run(t: Repo, result: string, evidence?: string) {
  const argv = [SCRIPT, "--block", `${t.base}.md`, "--criterion", "da-overclaim", "--result", result, "--id", "local/test"];
  if (evidence !== undefined) argv.push("--evidence", evidence);
  const r = spawnSync("bun", argv, { cwd: t.root, encoding: "utf-8" });
  const qa = blockQaPath(t.root, t.base);
  const doc = existsSync(qa) ? JSON.parse(readFileSync(qa, "utf-8")) : null;
  return { code: r.status, stderr: r.stderr ?? "", wrote: existsSync(qa), entry: doc?.criteria?.["da-overclaim"]?.at(-1) };
}

describe("qa-agent-entry evidence guard", () => {
  describe.each(["fail", "warn"])("a %s verdict", (result) => {
    it("without --evidence is refused, and writes nothing", () => {
      const t = repo();
      try {
        const r = run(t, result);
        expect(r.code).toBe(2);
        expect(r.stderr).toContain("requires --evidence");
        expect(r.wrote).toBe(false);
      } finally {
        t.cleanup();
      }
    }, SPAWN_BUDGET_MS);

    it("with whitespace-only --evidence is refused", () => {
      const t = repo();
      try {
        const r = run(t, result, "   ");
        expect(r.code).toBe(2);
        expect(r.wrote).toBe(false);
      } finally {
        t.cleanup();
      }
    }, SPAWN_BUDGET_MS);

    it("with evidence is accepted and recorded", () => {
      const t = repo();
      try {
        const r = run(t, result, "blk.md:1 claims 'exact' on a float64 agreement");
        expect(r.code).toBe(0);
        expect(r.entry.evidence).toContain("float64");
      } finally {
        t.cleanup();
      }
    }, SPAWN_BUDGET_MS);
  });

  // The other half of the rule: a verdict that found nothing has nothing to
  // evidence, so pass and n/a keep working bare.
  it.each(["pass", "n/a"])("%s without --evidence still succeeds", (result) => {
    const t = repo();
    try {
      const r = run(t, result);
      expect(r.code).toBe(0);
      expect(r.entry.result).toBe(result);
      expect(r.entry.evidence).toBeUndefined();
    } finally {
      t.cleanup();
    }
  }, SPAWN_BUDGET_MS);
});

describe("qa-agent-entry field_hash", () => {
  it("hashes every sibling that exists, the .lean included", () => {
    const t = repo({ ts: true, lean: true });
    try {
      const r = run(t, "pass");
      expect(r.code).toBe(0);
      expect(r.entry.field_hash.md).toBeDefined();
      expect(r.entry.field_hash.ts).toBeDefined();
      expect(r.entry.field_hash.lean).toBeDefined();
    } finally {
      t.cleanup();
    }
  }, SPAWN_BUDGET_MS);

  // Absent, not present-and-empty: a consumer comparing hashes would read an
  // empty string as a value and call an unchanged block stale on every run.
  it("omits the lean keys when there is no Lean", () => {
    const t = repo({ ts: true });
    try {
      const r = run(t, "pass");
      expect(r.code).toBe(0);
      expect("lean" in r.entry.field_hash).toBe(false);
      expect("lean_statement" in r.entry.field_hash).toBe(false);
    } finally {
      t.cleanup();
    }
  }, SPAWN_BUDGET_MS);

  // A digest that never moved would satisfy both tests above and pin nothing.
  it("the lean hash tracks the .lean content, not its existence", () => {
    const t = repo({ lean: true });
    try {
      const before = run(t, "pass").entry.field_hash.lean;
      writeFileSync(`${t.base}.lean`, "theorem t : 1 = 1 := rfl\n");
      const after = run(t, "pass").entry.field_hash.lean;
      expect(after).toBeDefined();
      expect(after).not.toBe(before);
    } finally {
      t.cleanup();
    }
  }, SPAWN_BUDGET_MS);
});
