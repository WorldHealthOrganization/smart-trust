/**
 * `ingest-document.ts --instance <dir>`: ingest into a CONTENT instance's
 * library (e.g. litlfred/qou checked out beside the harness) rather than the
 * harness's own. Without the flag the harness is the instance, unchanged.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { resolveInstanceRoot } from "../../ingest-document.ts";

function instance(name: string): string {
  const root = mkdtempSync(join(tmpdir(), "ingest-instance-"));
  const dir = join(root, name);
  mkdirSync(join(dir, "library"), { recursive: true });
  writeFileSync(
    join(dir, `${name}.json`),
    JSON.stringify({ name, directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }] }),
  );
  return dir;
}

describe("resolveInstanceRoot", () => {
  test("no flag: the fallback (the harness) is the instance", () => {
    expect(resolveInstanceRoot(["bun", "x.ts", "file.pdf"], "/somewhere/cat-harness")).toBe(
      resolve("/somewhere/cat-harness"),
    );
  });

  test("--instance <dir> and --instance=<dir> both name a declared instance", () => {
    const dir = instance("folio1");
    expect(resolveInstanceRoot(["file.pdf", "--instance", dir], "/h")).toBe(dir);
    expect(resolveInstanceRoot(["file.pdf", `--instance=${dir}`], "/h")).toBe(dir);
  });

  test("a directory that declares no instance is refused, never guessed", () => {
    const bare = mkdtempSync(join(tmpdir(), "ingest-bare-"));
    expect(() => resolveInstanceRoot(["--instance", bare], "/h")).toThrow(/no instance declaration/);
  });
});
