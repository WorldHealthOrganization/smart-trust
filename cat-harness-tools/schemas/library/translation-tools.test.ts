/**
 * Content-type translation profiles are declared by the instance that owns the
 * content type, and collected (bean `0r7u`, step 0 part 3).
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { collectContentTypeTranslations, CONTENT_TYPE_TRANSLATIONS } from "./translation-tools.ts";

const profile = (contentType: string) => ({
  contentType,
  name: contentType,
  formats: [{ id: "markdown", name: "Markdown", extensions: [".md"] }],
  rtlSupported: false,
});

describe("translation profiles come from the instances present", () => {
  let root: string;
  const writeInstance = (name: string, extra: Record<string, unknown> = {}) => {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, `${name}.json`), JSON.stringify({ name, version: "0.1.0", directories: [], ...extra }));
  };
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ctt-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("standalone, with no instance declaring a content type, nothing is translatable", () => {
    writeInstance("acme");
    expect(collectContentTypeTranslations(root)).toEqual([]);
  });

  test("a declared profile is collected with the instance that declared it", () => {
    writeInstance("acme", { contentTranslations: [profile("brochure")] });
    const got = collectContentTypeTranslations(root);
    expect(got.map((c) => c.contentType)).toEqual(["brochure"]);
    expect(got[0]!.declaredBy).toBe(join(root, "acme"));
  });

  test("a content type with two owners is refused, not merged", () => {
    writeInstance("acme", { contentTranslations: [profile("brochure")] });
    writeInstance("other", { contentTranslations: [profile("brochure")] });
    expect(() => collectContentTypeTranslations(root)).toThrow(/translation profile in both/);
  });
});

describe("in this checkout", () => {
  test("cat-harness declares only its own docs-site profile; every content type is declared by its owner", () => {
    const own = CONTENT_TYPE_TRANSLATIONS.filter((c) => c.declaredBy.split("/").pop() === "cat-harness").map((c) => c.contentType);
    expect(own).toEqual(["docs"]);
  });
});
