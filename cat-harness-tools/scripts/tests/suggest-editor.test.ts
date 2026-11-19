/**
 * The ✍ suggest editor's site bundle: one entry module and one stylesheet,
 * nothing left for a CDN to resolve (owner, 2026-10-14: the CDN's split
 * modules loaded two copies of ProseMirror on the live site). Its own chunks
 * are fine: one build writes them, so they share one copy of everything.
 * They keep the download small (smart-ra, 2026-10-26: the editor took
 * seconds to open): code-block languages load only when a code block needs
 * one, and KaTeX's fonts are files, fetched only when a formula uses them.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { installSuggestEditor, SUGGEST_EDITOR_DIR } from "../suggest-editor";

const site = mkdtempSync(join(tmpdir(), "suggest-editor-"));
afterAll(() => rmSync(site, { recursive: true, force: true }));

describe("suggest-editor", () => {
  test("Crepe and KaTeX from one build, their CSS in one stylesheet, no import left unresolved", async () => {
    const r = await installSuggestEditor(site);
    expect(r.dir).toBe(join(site, ...SUGGEST_EDITOR_DIR.split("/")));
    expect(r.files).toContain("crepe.js");
    expect(r.files).toContain("crepe.css");
    const js = readFileSync(join(r.dir, "crepe.js"), "utf-8");
    // Self-contained: every import, static or dynamic, is one of this build's own chunks.
    // The output is minified, so an import has no spaces; a code snippet in a
    // language chunk ('import {${names}} from "${module}"') keeps its own.
    const specifiers = (code: string) => [...code.matchAll(/(?:\}from|\bimport\(|(?:^|[;\n])import)["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const f of r.files.filter((f) => f.endsWith(".js"))) {
      const code = readFileSync(join(r.dir, f), "utf-8");
      expect(code).not.toContain("cdn.jsdelivr.net");
      for (const s of specifiers(code)) expect(s).toMatch(/^\.\.?\//);
    }
    // Code-block languages are chunks of their own, not in the entry.
    expect(r.files.some((f) => f.startsWith("chunks/"))).toBe(true);
    expect(js).not.toContain("COBOL");
    const css = readFileSync(join(r.dir, "crepe.css"), "utf-8");
    expect(css).not.toContain("@import");
    expect(css).toContain(".katex");
    expect(css).toContain(".milkdown");
    // KaTeX's fonts are files beside it, not base64 in it.
    expect(css).not.toContain("url(data:font");
    expect(css).toContain("url(fonts/KaTeX_Main-Regular.woff2)");
    expect(r.files).toContain(join("fonts", "KaTeX_Main-Regular.woff2"));
    expect(css.length).toBeLessThan(200_000);
  }, 120000);
});
