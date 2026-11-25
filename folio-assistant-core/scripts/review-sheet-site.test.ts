import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildReviewSheetSite } from "./review-sheet-site.ts";

function folio() {
  const repo = mkdtempSync(join(tmpdir(), "rs-site-"));
  mkdirSync(join(repo, "review/drafting"), { recursive: true });
  writeFileSync(join(repo, "anchors.json"), JSON.stringify({
    chapters: [{ dir: "ch01", title: "Chapter 1. Why", number: 1 }],
    sections: [{ label: "sec:1-1", number: "1.1", title: "1.1 One", chapter: "ch01" }],
    blocks: [],
  }));
  writeFileSync(join(repo, "review/drafting/sheet-sync.json"), JSON.stringify({ mode: "drafting", anchors: "anchors.json", sectionUrl: "https://x.example/S#", sheet: "SHEETID" }));
  return repo;
}

describe("review-sheet-site", () => {
  const repo = folio();
  const out = join(repo, "_site");
  const r = buildReviewSheetSite(repo, out);
  const dir = join(out, "review-sheet");

  test("publishesScriptAndConfig", () => {
    expect(r.configs).toBe(1);
    const page = readFileSync(join(dir, "index.html"), "utf8");
    const code = readFileSync(join(dir, "Code.gs"), "utf8");
    const sha = createHash("sha256").update(code).digest("hex");
    expect(page).toContain(sha);
    const rows = JSON.parse(readFileSync(join(dir, "drafting.config-rows.json"), "utf8"));
    expect(rows.find((r: string[]) => !(/^Instructions/.test(r[0]) || ["Key", "EDITORS"].includes(r[0])))?.[0]).toBe("CFG");
    const g = JSON.parse(readFileSync(join(dir, "review-sheet.jsonld"), "utf8"))["@graph"];
    expect(g[0]["spdx:checksum"]["spdx:checksumValue"]).toBe(sha);
    expect(g[0]["schema:permissions"]).toHaveLength(3);
    expect(g[1]["schema:isPartOf"]["@id"]).toBe("https://docs.google.com/spreadsheets/d/SHEETID/edit");
  });

  test("noConfigNothing", () => {
    const empty = mkdtempSync(join(tmpdir(), "rs-empty-"));
    expect(buildReviewSheetSite(empty, join(empty, "_site")).configs).toBe(0);
  });
});
