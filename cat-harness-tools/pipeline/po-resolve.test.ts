/**
 * Tests for pipeline/po-resolve.ts — PO source resolution.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePoSources, mergePoSources, availableLocales } from "./po-resolve";
import { parsePo } from "./po-inject";
import { writeInstanceConfig } from "../test/support/instance-fixture.js";

// Under the system temp directory, not beside this file (bean `dlqu`): an
// in-tree scratch directory is visible to every test that enumerates the
// checkout, and under `bun test --parallel` those run at the same time.
const TMP = mkdtempSync(join(tmpdir(), "test_po_resolve-"));

function mkpo(dir: string, name: string, content: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), content, "utf-8");
}

const BLOCK_PO = `
msgid "Hello"
msgstr "Bonjour"

msgid "World"
msgstr "Monde"
`.trim();

const CHAPTER_PO = `
msgid "Chapter title"
msgstr "Titre du chapitre"

msgid "Hello"
msgstr "Salut"
`.trim();

const GLOBAL_PO = `
msgid "Global term"
msgstr "Terme global"

msgid "Hello"
msgstr "Hé"
`.trim();

const DEP_PO = `
msgid "From dependency"
msgstr "De la dépendance"

msgid "Global term"
msgstr "Terme de dépendance"
`.trim();

beforeAll(() => {
  // Set up test folio structure
  mkdirSync(TMP, { recursive: true });

  // translations/fr/
  mkpo(join(TMP, "translations", "fr"), "my-block.po", BLOCK_PO);
  mkpo(join(TMP, "translations", "fr"), "chapter-01.po", CHAPTER_PO);
  mkpo(join(TMP, "translations", "fr"), "global.po", GLOBAL_PO);

  // translations/es/
  mkpo(join(TMP, "translations", "es"), "my-block.po", 'msgid "Hello"\nmsgstr "Hola"');

  // Dependency
  const depRoot = join(TMP, "dep-folio");
  mkpo(join(depRoot, "translations", "fr"), "my-block.po", DEP_PO);
  writeInstanceConfig(depRoot, JSON.stringify({
    translation: { translationDir: "translations" },
  }));

  // Folio config with dependency
  writeInstanceConfig(TMP, JSON.stringify({
    translation: { translationDir: "translations" },
    dependencies: {
      folioAssistant: [
        { name: "dep-folio", path: depRoot },
      ],
    },
  }));
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("resolvePoSources", () => {
  it("resolves block-level PO", () => {
    const result = resolvePoSources({
      folioRoot: TMP,
      locale: "fr",
      blockStem: "my-block",
    });
    expect(result.some((r) => r.resolution === "block")).toBe(true);
    expect(result.find((r) => r.resolution === "block")!.path).toContain("my-block.po");
  });

  it("resolves chapter-level PO", () => {
    const result = resolvePoSources({
      folioRoot: TMP,
      locale: "fr",
      blockStem: "my-block",
      chapterSlug: "chapter-01",
    });
    expect(result.some((r) => r.resolution === "chapter")).toBe(true);
  });

  it("resolves folio-level global PO", () => {
    const result = resolvePoSources({
      folioRoot: TMP,
      locale: "fr",
      blockStem: "my-block",
    });
    expect(result.some((r) => r.resolution === "folio")).toBe(true);
  });

  it("resolves dependency PO", () => {
    const result = resolvePoSources({
      folioRoot: TMP,
      locale: "fr",
      blockStem: "my-block",
    });
    expect(result.some((r) => r.resolution === "dependency")).toBe(true);
    expect(result.find((r) => r.resolution === "dependency")!.dependencyName).toBe("dep-folio");
  });

  it("returns all 4 levels in order", () => {
    const result = resolvePoSources({
      folioRoot: TMP,
      locale: "fr",
      blockStem: "my-block",
      chapterSlug: "chapter-01",
    });
    const resolutions = result.map((r) => r.resolution);
    expect(resolutions).toContain("block");
    expect(resolutions).toContain("chapter");
    expect(resolutions).toContain("folio");
    expect(resolutions).toContain("dependency");
    // block is first
    expect(resolutions[0]).toBe("block");
  });

  it("returns empty when no PO found", () => {
    const result = resolvePoSources({
      folioRoot: TMP,
      locale: "ar",
      blockStem: "nonexistent",
    });
    expect(result).toHaveLength(0);
  });

  it("uses explicit poSources when provided (no fallback)", () => {
    const explicitPath = join(TMP, "translations", "fr", "global.po");
    const result = resolvePoSources({
      folioRoot: TMP,
      locale: "fr",
      blockStem: "my-block",
      poSources: [explicitPath],
    });
    expect(result).toHaveLength(1);
    expect(result[0].resolution).toBe("explicit");
    expect(result[0].path).toBe(explicitPath);
  });

  it("handles relative poSources paths", () => {
    const result = resolvePoSources({
      folioRoot: TMP,
      locale: "fr",
      blockStem: "my-block",
      poSources: ["translations/fr/global.po"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].resolution).toBe("explicit");
  });

  it("skips nonexistent explicit poSources", () => {
    const result = resolvePoSources({
      folioRoot: TMP,
      locale: "fr",
      blockStem: "my-block",
      poSources: ["translations/fr/nonexistent.po"],
    });
    expect(result).toHaveLength(0);
  });
});

describe("mergePoSources", () => {
  it("merges PO files with block overriding global", () => {
    const sources = resolvePoSources({
      folioRoot: TMP,
      locale: "fr",
      blockStem: "my-block",
    });
    const merged = mergePoSources(sources, parsePo);

    // "Hello" appears in block PO as "Bonjour" and global as "Hé"
    // Block is more specific, should win
    expect(merged.get("Hello")).toBe("Bonjour");

    // "Global term" only in global PO
    expect(merged.get("Global term")).toBe("Terme global");

    // "World" only in block PO
    expect(merged.get("World")).toBe("Monde");
  });

  it("merges with chapter PO in the middle", () => {
    const sources = resolvePoSources({
      folioRoot: TMP,
      locale: "fr",
      blockStem: "my-block",
      chapterSlug: "chapter-01",
    });
    const merged = mergePoSources(sources, parsePo);

    // "Hello" in block="Bonjour", chapter="Salut", global="Hé"
    // Block wins (most specific)
    expect(merged.get("Hello")).toBe("Bonjour");

    // "Chapter title" only in chapter PO
    expect(merged.get("Chapter title")).toBe("Titre du chapitre");
  });
});

describe("availableLocales", () => {
  it("finds fr and es for my-block", () => {
    const locales = availableLocales(TMP, "my-block");
    expect(locales).toContain("fr");
    expect(locales).toContain("es");
    expect(locales).toHaveLength(2);
  });

  it("returns sorted", () => {
    const locales = availableLocales(TMP, "my-block");
    expect(locales).toEqual(["es", "fr"]);
  });

  it("returns empty for nonexistent stem", () => {
    const locales = availableLocales(TMP, "nonexistent");
    expect(locales).toHaveLength(0);
  });

  it("finds only fr for chapter-01", () => {
    const locales = availableLocales(TMP, "chapter-01");
    expect(locales).toEqual(["fr"]);
  });
});
