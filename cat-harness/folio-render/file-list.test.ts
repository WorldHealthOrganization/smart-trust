/**
 * The harness's minimal folio renderer (bean `folio-assistant-ohx6`): one
 * listing, the same one the full viewer's 'list' view reads.
 */
import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FOLIO_PAGE, folioFileList, formatBytes, renderFolioPage } from "./file-list.ts";

const tmp = mkdtempSync(join(tmpdir(), "folio-file-list-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const put = (rel: string, text: string) => {
  mkdirSync(join(tmp, rel, ".."), { recursive: true });
  writeFileSync(join(tmp, rel), text);
};

describe("folioFileList", () => {
  put("cat-harness.json", "{}");
  put("notes/a b.md", "hello");
  put(FOLIO_PAGE, "the page itself");
  put("render/file-list.ts", "code");
  put(".hidden", "x");

  it("lists every file, recursively and sorted, but not the page or dot-files", () => {
    // `render/` is content now: the renderer moved out to `folio-render/`, so
    // nothing inside a folio is hidden by name any more.
    expect(folioFileList(tmp)).toEqual([
      { path: "cat-harness.json", bytes: 2 },
      { path: "notes/a b.md", bytes: 5 },
      { path: "render/file-list.ts", bytes: 4 },
    ]);
  });

  it("a folio directory that does not exist lists nothing, rather than throwing", () => {
    expect(folioFileList(join(tmp, "absent"))).toEqual([]);
  });
});

describe("renderFolioPage", () => {
  it("is a just-the-docs page that says what a folio is and links each file relatively", () => {
    const page = renderFolioPage("C@T Harness", [{ path: "notes/a b.md", bytes: 2048 }]);
    expect(page.startsWith('---\nlayout: default\ntitle: "C@T Harness — folio"\n---\n')).toBe(true);
    expect(page).toContain("A **folio** is an instance's authored content");
    expect(page).toContain("| [`notes/a b.md`](notes/a%20b.md) | 2.0 KB |");
  });

  it("an empty folio says so instead of drawing an empty table", () => {
    const page = renderFolioPage("X", []);
    expect(page).toContain("_This folio holds no files._");
    expect(page).not.toContain("| file | size |");
  });

  it("sizes read as a person would say them", () => {
    expect([formatBytes(12), formatBytes(1536), formatBytes(5 * 1024 * 1024)]).toEqual(["12 B", "1.5 KB", "5.0 MB"]);
  });
});
