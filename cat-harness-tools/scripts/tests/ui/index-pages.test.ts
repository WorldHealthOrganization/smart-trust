/**
 * `index:render` builds the declared pages first (owner, 2026-10-14: "Build
 * pages first"), so the README's links are computed against a built tree.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeDeclaration } from "../../../test/support/instance-fixture.js";
import { pagesBuildsFor } from "../../lib/index-pages.ts";

const ROOT = mkdtempSync(join(tmpdir(), "index-pages-"));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

function instance(name: string, docs: Record<string, unknown>, scripts: Record<string, string> = {}): { name: string; path: string } {
  const dir = join(ROOT, name);
  mkdirSync(dir, { recursive: true });
  writeDeclaration(dir, { name, directories: [{ id: `${name}-docs`, path: "docs/", graphTypologies: ["docs"], description: "pages", ...docs }] });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, scripts }));
  return { name, path: name };
}

describe("pagesBuildsFor: what index:render builds before it renders", () => {
  test("a built docs directory that is not on disk is built by its `<instance>:pages`", () => {
    const ig = instance("ig", { writer: ["fhir-harness/scripts/gen-ig-pages.ts"] }, { "ig:pages": "true" });
    expect(pagesBuildsFor(ROOT, [ig])).toEqual([{ instance: "ig", script: "ig:pages", dirs: ["docs/"] }]);
  });

  test("one already on disk is not rebuilt: only its presence is read", () => {
    const built = instance("built", { writer: ["w.ts"] }, { "built:pages": "true" });
    mkdirSync(join(ROOT, "built", "docs"), { recursive: true });
    expect(pagesBuildsFor(ROOT, [built])).toEqual([]);
  });

  test("an authored docs directory (no writer), or no pages script, asks for no build", () => {
    expect(pagesBuildsFor(ROOT, [instance("authored", {}, { "authored:pages": "true" })])).toEqual([]);
    expect(pagesBuildsFor(ROOT, [instance("noscript", { writer: ["w.ts"] })])).toEqual([]);
  });
});
