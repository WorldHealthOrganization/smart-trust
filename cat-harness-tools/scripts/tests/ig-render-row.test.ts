/**
 * The `[fhir]` row: a FHIR IG rendered on the site gets a link to its index
 * page in the rail's Harnesses list (owner, 2026-10-31).
 *
 * @module scripts/tests/ig-render-row.test
 */
import { describe, expect, it } from "bun:test";

import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { IG_RENDER_GLYPH, IG_RENDER_LABEL, IG_RENDER_TONE, igRenderDir, withIgRenderRow } from "../lib/ig-render-row.ts";

function site(files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "ig-render-row-"));
  for (const f of files) {
    mkdirSync(join(root, f, ".."), { recursive: true });
    writeFileSync(join(root, f), "<html></html>");
  }
  return root;
}

const rows = [
  { label: "SMART Base", href: "../#harness-smart-base" },
  { label: "Acme IG", href: "./" },
  { label: "FHIR IG Harness", href: "../fhir-harness/" },
];

describe("where the IG render is", () => {
  it("an IG repository's own site: the root, when it holds the IG's toc", () => {
    expect(igRenderDir(site(["index.html", "toc.html"]), "acme", true)).toBe("");
  });

  it("prefers ig/ over the root, since the root is then the instance's own pages", () => {
    expect(igRenderDir(site(["index.html", "toc.html", "ig/index.html", "ig/toc.html"]), "acme", true)).toBe("ig/");
  });

  it("on the platform's site: <owner>/ig/ then <owner>/", () => {
    expect(igRenderDir(site(["acme/index.html", "acme/toc.html"]), "acme", false)).toBe("acme/");
    expect(igRenderDir(site(["acme/ig/index.html", "acme/ig/toc.html", "acme/index.html"]), "acme", false)).toBe("acme/ig/");
  });

  it("no toc beside the index is no render: a folio's landing is not an IG", () => {
    expect(igRenderDir(site(["index.html", "ig/index.html"]), "acme", true)).toBeUndefined();
  });
});

describe("the row", () => {
  it("goes right after the owner's row and links the render's index.html", () => {
    const out = withIgRenderRow(rows, { siteAbs: site(["index.html", "toc.html"]), owner: "acme", ownerLabel: "Acme IG", atRoot: true, toRoot: ".." });
    expect(out!.map((r) => r.label)).toEqual(["SMART Base", "Acme IG", IG_RENDER_LABEL, "FHIR IG Harness"]);
    expect(out![2]).toEqual({ label: "[fhir]", href: "../index.html", glyphPath: IG_RENDER_GLYPH, tone: IG_RENDER_TONE });
  });

  it("goes first when no row carries the owner's label", () => {
    const out = withIgRenderRow(rows, { siteAbs: site(["acme/ig/index.html", "acme/ig/toc.html"]), owner: "acme", atRoot: false, toRoot: "." });
    expect(out![0]).toMatchObject({ label: "[fhir]", href: "./acme/ig/index.html" });
  });

  it("is absent when the site renders no IG for the owner", () => {
    const out = withIgRenderRow(rows, { siteAbs: site(["index.html"]), owner: "acme", ownerLabel: "Acme IG", atRoot: true, toRoot: "." });
    expect(out).toEqual(rows);
  });

  it("wears the flame mark, a 24x24 path the rail strokes", () => {
    const out = withIgRenderRow(rows, { siteAbs: site(["index.html", "toc.html"]), owner: "acme", ownerLabel: "Acme IG", atRoot: true, toRoot: "." });
    const row = out!.find((r) => r.label === IG_RENDER_LABEL)!;
    expect(row.glyphPath).toBe(IG_RENDER_GLYPH);
    expect(row.glyphPath).toMatch(/^M[\d.\s a-zA-Z-]+z.*z$/);
    expect(row.tone).toBe(IG_RENDER_TONE);
  });

  it("is added once", () => {
    const o = { siteAbs: site(["index.html", "toc.html"]), owner: "acme", ownerLabel: "Acme IG", atRoot: true, toRoot: "." };
    const twice = withIgRenderRow(withIgRenderRow(rows, o), o);
    expect(twice!.filter((r) => r.label === IG_RENDER_LABEL)).toHaveLength(1);
  });
});
