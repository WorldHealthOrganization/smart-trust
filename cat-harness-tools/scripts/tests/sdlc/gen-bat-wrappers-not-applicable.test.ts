/**
 * `bat:sync:check` in a CONTENT root (cat-harness-tools#1701).
 *
 * WRAPPED lists scripts of the harness index (the root carrying the gates
 * workflow) and of the layers it mounts. In a content root an absent entry
 * that no mounted instance holds is excused with a printed reason; an absent
 * entry under a MOUNTED instance is still an error (exit 2), and so is any
 * absent entry in a harness root. Each case runs the real script from a
 * throwaway tree laid out as a joined checkout.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPTS = resolve(import.meta.dir, "..", "..");
const roots: string[] = [];

/** A joined checkout holding only the generator and a harness, so every WRAPPED entry is absent. */
function tree(opts: { gatesWorkflow?: boolean; toolsInstance?: boolean }): string {
  const root = mkdtempSync(join(tmpdir(), "bat-na-"));
  roots.push(root);
  writeFileSync(join(root, "index.config.json"), "{}\n");
  mkdirSync(join(root, "cat-harness"));
  writeFileSync(join(root, "cat-harness", "cat-harness.json"), '{ "name": "cat-harness" }\n');
  mkdirSync(join(root, "cat-harness-tools", "scripts", "lib"), { recursive: true });
  copyFileSync(join(SCRIPTS, "gen-bat-wrappers.sh"), join(root, "cat-harness-tools", "scripts", "gen-bat-wrappers.sh"));
  copyFileSync(join(SCRIPTS, "lib", "harness-root.sh"), join(root, "cat-harness-tools", "scripts", "lib", "harness-root.sh"));
  if (opts.toolsInstance) writeFileSync(join(root, "cat-harness-tools", "cat-harness-tools.json"), "{}\n");
  if (opts.gatesWorkflow) {
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(join(root, ".github", "workflows", "code-quality-gates.yml"), "jobs: {}\n");
  }
  return root;
}

function check(root: string): { status: number | null; out: string } {
  const env = { ...process.env };
  delete env.CAT_HARNESS_ROOT;
  const r = spawnSync("bash", [join(root, "cat-harness-tools", "scripts", "gen-bat-wrappers.sh"), "--check"], {
    encoding: "utf-8",
    env,
  });
  return { status: r.status, out: r.stdout + r.stderr };
}

afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("bat:sync:check — entries this root does not hold", () => {
  test("a content root excuses entries no mounted instance holds, and says so", () => {
    const r = check(tree({}));
    expect(r.out).toContain("· .claude/skills/hooks/session-start.sh not applicable here");
    expect(r.out).toContain("not applicable here)");
    expect(r.status).toBe(0);
  });

  test("an absent entry under a MOUNTED instance is still an error", () => {
    const r = check(tree({ toolsInstance: true }));
    expect(r.status).toBe(2);
    expect(r.out).toContain("ERROR: cat-harness-tools/scripts/");
  });

  test("a harness root is judged as before: the root-level entry is an error", () => {
    const r = check(tree({ gatesWorkflow: true }));
    expect(r.status).toBe(2);
    expect(r.out).toContain("ERROR: .claude/skills/hooks/session-start.sh does not exist");
  });
});
