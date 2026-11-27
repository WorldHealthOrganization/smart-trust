/**
 * `layerRootNamed` — one rule for both layouts (bean `uxn1`).
 *
 * Three callers wrote `join(repoRoot, "cat-harness")`, which is right only in
 * the monorepo. Standalone, a layer IS its repository, so that path does not
 * exist and the callers found no actors and no skill-definitions directory.
 * Built from temp directories so the fixture is each layout, not this
 * checkout.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { layerRootNamed } from "./kg/instance-roots";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function writeDeclaration(dir: string, name: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.json`), JSON.stringify({ name }));
}

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "instance-root-named-"));
  made.push(d);
  return d;
}

describe("layerRootNamed", () => {
  test("monorepo: the instance one level down that declares the name", () => {
    const repo = tmp();
    writeDeclaration(repo, "folio-assistant");
    writeDeclaration(join(repo, "cat-harness"), "cat-harness");
    writeDeclaration(join(repo, "folio-assistant-core"), "folio-assistant-core");
    expect(layerRootNamed(repo, "cat-harness")).toBe(join(repo, "cat-harness"));
  });

  test("standalone: the repository root itself, when it declares the name", () => {
    const repo = tmp();
    writeDeclaration(repo, "cat-harness");
    expect(layerRootNamed(repo, "cat-harness")).toBe(repo);
  });

  test("a directory merely NAMED like the instance is not it — the declaration decides", () => {
    const repo = tmp();
    writeDeclaration(repo, "folio-assistant");
    mkdirSync(join(repo, "cat-harness"));
    expect(layerRootNamed(repo, "cat-harness")).toBeUndefined();
  });

  test("absent is undefined, never a guessed path", () => {
    const repo = tmp();
    writeDeclaration(repo, "folio-assistant");
    expect(layerRootNamed(repo, "cat-harness")).toBeUndefined();
  });
});
