/**
 * The visual diff Tool (bean 0rxe), run for real in Chromium on two tiny
 * sites: one figure whose colour changed, one that did not, one that is new,
 * and one whose anchor is missing from the preview.
 */
import { test, expect } from "@playwright/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { run } from "../../scripts/block-screenshots.ts";

const page = (blocks: Array<[string, string]>) =>
  `<!doctype html><html><body style="margin:0;font:16px sans-serif"><main style="width:600px;margin:0 auto">` +
  blocks.map(([id, color]) => `<a id="${id}"></a><div style="height:120px;background:${color}"></div>`).join("") +
  `<a id="end"></a><p>end</p></main></body></html>`;

test("pictures each changed visual block, compares them, and says what it could not picture", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vis-"));
  try {
    for (const [side, blocks] of [
      ["base", [["fig:a", "#1c5cab"], ["fig:same", "#aaaaaa"], ["fig:gone-from-head", "#333"]]],
      ["head", [["fig:a", "#d33"], ["fig:same", "#aaaaaa"], ["fig:new", "#3a3"]]],
    ] as const) {
      mkdirSync(join(dir, side, "doc"), { recursive: true });
      writeFileSync(join(dir, side, "doc", "index.html"), page(blocks as Array<[string, string]>));
    }
    const at = (kind: string) => ({ file: "doc/x.ts", kind });
    writeFileSync(join(dir, "changeset.json"), JSON.stringify({ changes: [
      { change: "changed", label: "fig:a", aspects: ["manifest"], base: at("figure"), head: at("figure") },
      { change: "changed", label: "fig:same", aspects: ["manifest"], base: at("figure"), head: at("figure") },
      { change: "added", label: "fig:new", head: at("figure") },
      { change: "changed", label: "fig:gone-from-head", aspects: ["manifest"], base: at("figure"), head: at("figure") },
      { change: "changed", label: "prose:skip", aspects: ["prose"], base: at("prose"), head: at("prose") },
    ] }));
    const out = join(dir, "out");
    const f = await run({ changeset: join(dir, "changeset.json"), base: join(dir, "base"), head: join(dir, "head"), out });

    expect(Object.keys(f.blocks)).toEqual(["fig:a", "fig:same", "fig:new", "fig:gone-from-head"]);
    // The recoloured block changed almost entirely; the untouched one not at all.
    expect(f.blocks["fig:a"]!.changed!).toBeGreaterThan(0.9);
    expect(f.blocks["fig:same"]!.changed).toBe(0);
    expect(existsSync(join(out, f.blocks["fig:a"]!.diff!))).toBe(true);
    // A new block has an after picture only, and nothing is compared.
    expect(f.blocks["fig:new"]!.before).toBeNull();
    expect(f.blocks["fig:new"]!.after!.png).toBe("visual/fig_new.after.png");
    expect(f.blocks["fig:new"]!.changed).toBeNull();
    // An anchor missing from the preview is SAID, not drawn blank.
    expect(f.blocks["fig:gone-from-head"]!.after).toEqual({ png: null, missing: "anchor" });
    // What was written is what was returned.
    expect(JSON.parse(readFileSync(join(out, "visual-diff.json"), "utf-8"))).toEqual(JSON.parse(JSON.stringify(f)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
