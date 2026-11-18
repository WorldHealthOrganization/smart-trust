/**
 * A repository-scoped store's nested declarations get an owner.
 *
 * `promoteFromWithin` never follows a `scope: "repository"` entry, because
 * such an entry usually points at ANOTHER layer's directory, and what that
 * directory declares from within belongs to its owner. In the index checkout
 * there is no other owner. Its root declares no layer (owner, 2026-10-08),
 * so `beans/beans.json`'s `defs` and `todos/todos.json`'s `items` were
 * attributed to `(root)`, a layer that does not exist (measured
 * 2026-10-09). These tests pin both halves: an undeclared root lets the
 * declarer own the nested entries, and a declared root keeps them away.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DECLARATION_SUFFIX, resolveDirectories } from "../../schemas/kg/cat-harness.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A checkout holding `inst/`, which declares the root's `beans/` repository-scoped. */
function checkout(opts: { rootDeclares: boolean }): { repoRoot: string; inst: string } {
  const repoRoot = mkdtempSync(join(tmpdir(), "repo-scope-within-"));
  made.push(repoRoot);
  const inst = join(repoRoot, "inst");
  mkdirSync(inst, { recursive: true });
  mkdirSync(join(repoRoot, "beans", "defs"), { recursive: true });
  writeFileSync(
    join(repoRoot, "beans", "beans.json"),
    JSON.stringify({ directories: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }] }),
  );
  writeFileSync(
    join(inst, `inst${DECLARATION_SUFFIX}`),
    JSON.stringify({
      name: "inst",
      directories: [{ id: "beans", path: "beans/", scope: "repository", graphTypologies: ["beans"] }],
    }),
  );
  if (opts.rootDeclares) {
    writeFileSync(join(repoRoot, `top${DECLARATION_SUFFIX}`), JSON.stringify({ name: "top", directories: [] }));
  }
  return { repoRoot, inst };
}

describe("a repository-scoped entry's from-within declarations", () => {
  test("are the declarer's when the repository root declares no instance", () => {
    const { inst } = checkout({ rootDeclares: false });
    const defs = resolveDirectories([{ name: "inst", root: inst, own: true }]).find((d) => d.id === "defs");
    expect(defs?.declaredBy).toBe("inst");
    expect(defs?.path).toBe("beans/defs/");
  });
  test("are NOT followed when the repository root is another, declared instance", () => {
    const { inst } = checkout({ rootDeclares: true });
    const defs = resolveDirectories([{ name: "inst", root: inst, own: true }]).find((d) => d.id === "defs");
    expect(defs?.declaredBy).not.toBe("inst");
  });
});
