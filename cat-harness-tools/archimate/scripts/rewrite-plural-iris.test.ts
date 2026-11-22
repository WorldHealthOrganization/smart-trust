import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rewriteFiles, rewritePluralIris, textFilesUnder } from "./rewrite-plural-iris.ts";

const B = "https://example.org/layer/archimate/0.2.0/ra";

describe("rewritePluralIris", () => {
  it("makes each kind segment singular and keeps the rest of the link", () => {
    const { text, count } = rewritePluralIris(
      `[a](${B}/elements/id-1.jsonld) [b](${B}/views/id-2/) [c](${B}/relationships/id-3)`,
    );
    expect(text).toBe(`[a](${B}/element/id-1.jsonld) [b](${B}/view/id-2/) [c](${B}/relationship/id-3)`);
    expect(count).toBe(3);
  });

  it("rewrites a relative path under archimate/ as well as an absolute one", () => {
    expect(rewritePluralIris(`"archimate/0.2.0/ra/elements/x.jsonld"`).text).toBe(`"archimate/0.2.0/ra/element/x.jsonld"`);
  });

  it("leaves singular paths, and plural words outside an archimate path, alone", () => {
    const s = `${B}/element/x the elements/ of a view, https://example.org/other/elements/x`;
    expect(rewritePluralIris(s)).toEqual({ text: s, count: 0 });
  });

  it("does not reach across whitespace, quotes or brackets to find archimate/", () => {
    const s = `see archimate/ docs and "elements/x" (views/y)`;
    expect(rewritePluralIris(s)).toEqual({ text: s, count: 0 });
  });

  it("is idempotent", () => {
    const once = rewritePluralIris(`${B}/elements/x`).text;
    expect(rewritePluralIris(once)).toEqual({ text: once, count: 0 });
  });
});

describe("rewriteFiles", () => {
  const root = mkdtempSync(join(tmpdir(), "am-plural-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "docs"), { recursive: true });
  mkdirSync(join(root, "node_modules", "x"), { recursive: true });
  writeFileSync(join(root, "docs", "a.md"), `[e](${B}/elements/e1.jsonld)\n`);
  writeFileSync(join(root, "docs", "b.jsonld"), `{"overlay:base": "${B}/views/v1"}\n`);
  writeFileSync(join(root, "docs", "c.md"), "nothing to change\n");
  writeFileSync(join(root, "docs", "d.png"), `${B}/elements/e1`);
  writeFileSync(join(root, "node_modules", "x", "e.md"), `${B}/elements/e1`);

  it("walks text files only, skipping node_modules", () => {
    expect(textFilesUnder([root]).map((f) => f.slice(root.length + 1))).toEqual(["docs/a.md", "docs/b.jsonld", "docs/c.md"]);
  });

  it("under --check reports what would change and writes nothing", () => {
    const r = rewriteFiles([root], true);
    expect(r.map((c) => [c.file.slice(root.length + 1), c.count])).toEqual([["docs/a.md", 1], ["docs/b.jsonld", 1]]);
    expect(readFileSync(join(root, "docs", "a.md"), "utf8")).toContain("/elements/");
  });

  it("rewrites in place, after which --check finds nothing", () => {
    rewriteFiles([root], false);
    expect(readFileSync(join(root, "docs", "a.md"), "utf8")).toBe(`[e](${B}/element/e1.jsonld)\n`);
    expect(readFileSync(join(root, "docs", "b.jsonld"), "utf8")).toBe(`{"overlay:base": "${B}/view/v1"}\n`);
    expect(readFileSync(join(root, "docs", "d.png"), "utf8")).toContain("/elements/");
    expect(rewriteFiles([root], true)).toEqual([]);
  });
});
