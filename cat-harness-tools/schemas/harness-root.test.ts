/**
 * `harnessRoot()` takes the cat-harness beside this layer before the one a
 * linked `node_modules` resolves to (bean `g7ls`).
 *
 * The standalone rehearsal lays the closure out as siblings and links the
 * index's `node_modules` beside them. The package then resolved to the
 * index's cat-harness, outside the closure, and about 250 tests failed to
 * load. The layout is rebuilt here in miniature: a sibling cat-harness, and a
 * `node_modules` link to another checkout whose package is a different one.
 *
 * @module cat-harness-tools/schemas/harness-root.test
 */
import { describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DECL = JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "cat-harness", directories: [] });

function rootIn(layout: { sibling: boolean }): string {
  const ws = realpathSync(mkdtempSync(join(tmpdir(), "harness-root-")));
  try {
    // The index the linked node_modules belongs to, with its own cat-harness.
    const index = join(ws, "index");
    mkdirSync(join(index, "cat-harness"), { recursive: true });
    writeFileSync(join(index, "cat-harness", "cat-harness.json"), DECL);
    writeFileSync(join(index, "cat-harness", "package.json"), JSON.stringify({ name: "@litlfred/cat-harness" }));
    mkdirSync(join(index, "node_modules", "@litlfred"), { recursive: true });
    symlinkSync("../../cat-harness", join(index, "node_modules", "@litlfred", "cat-harness"));

    // The rehearsal: this layer's module, a sibling cat-harness, the index's node_modules linked in.
    const rehearsal = join(ws, "rehearsal");
    mkdirSync(join(rehearsal, "cat-harness-tools", "schemas"), { recursive: true });
    copyFileSync(join(import.meta.dir, "harness-root.ts"), join(rehearsal, "cat-harness-tools", "schemas", "harness-root.ts"));
    if (layout.sibling) {
      mkdirSync(join(rehearsal, "cat-harness"), { recursive: true });
      writeFileSync(join(rehearsal, "cat-harness", "cat-harness.json"), DECL);
    }
    symlinkSync(join(index, "node_modules"), join(rehearsal, "node_modules"));

    const env = { ...process.env };
    delete env.CAT_HARNESS_ROOT;
    const run = Bun.spawnSync(["bun", "-e", 'import { harnessRoot } from "./schemas/harness-root.ts"; console.log(harnessRoot())'], {
      cwd: join(rehearsal, "cat-harness-tools"),
      env,
    });
    expect(run.exitCode).toBe(0);
    return run.stdout.toString().trim().replace(ws, "<ws>");
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}

describe("harnessRoot", () => {
  test("the sibling cat-harness wins over a linked package from another checkout", () => {
    expect(rootIn({ sibling: true })).toBe("<ws>/rehearsal/cat-harness");
  });

  test("with no sibling, the linked package is still found", () => {
    expect(rootIn({ sibling: false })).toBe("<ws>/index/cat-harness");
  });
});
