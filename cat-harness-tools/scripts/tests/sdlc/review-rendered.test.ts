/**
 * The review page's rendered list (bean `bnjs`): the model it is drawn from.
 */
import { describe, expect, test } from "bun:test";

import { measuredModel, renderedModel } from "../../review-rendered.js";

const impacts = [
  {
    $schema: "rendered-impact/v1",
    renderer: "document-site",
    method: "cone",
    files: [
      { path: "outline.json", change: "changed", role: "index", via: [] },
      { path: "dpi-h-ra/index.html", change: "changed", role: "content", via: [], anchors: ["prose:a", "prose:b"] },
      { path: "dpi-h-ra/media/f.png", change: "added", role: "data", via: [] },
    ],
    undetermined: [{ input: "dpi-h-ra.config.json", reason: "site-wide", scope: "all" }],
  },
];

describe("renderedModel", () => {
  const m = renderedModel(impacts, "https://x.github.io/smart-ra");

  test("one row per anchor, linked on the preview and on the before side, index files counted not listed", () => {
    expect(m.rows.map((r) => [r.path, r.anchor ?? null, r.after, r.before ?? null])).toEqual([
      ["dpi-h-ra/index.html", "prose:a", "../dpi-h-ra/index.html#prose%3Aa", "https://x.github.io/smart-ra/dpi-h-ra/index.html#prose%3Aa"],
      ["dpi-h-ra/index.html", "prose:b", "../dpi-h-ra/index.html#prose%3Ab", "https://x.github.io/smart-ra/dpi-h-ra/index.html#prose%3Ab"],
      // An ADDED file has no before side to link.
      ["dpi-h-ra/media/f.png", null, "../dpi-h-ra/media/f.png", null],
    ]);
    expect(m.indexCount).toBe(1);
    expect(m.renderers).toEqual(["document-site"]);
  });

  test("an input no renderer could place is carried as not known, with its scope", () => {
    expect(m.unknown).toEqual([{ renderer: "document-site", input: "dpi-h-ra.config.json", reason: "site-wide", scope: "all" }]);
  });

  test("links each page from the site root the review page found, under the locale since #2527", () => {
    const deep = renderedModel([{ ...impacts[0], files: [{ path: "en/dpi-h-ra/index.html", change: "changed", role: "content", via: [], anchors: ["prose:a"] }] }], "https://x.github.io/smart-ra", "../../");
    expect(deep.rows.map((r) => [r.after, r.before])).toEqual([
      ["../../en/dpi-h-ra/index.html#prose%3Aa", "https://x.github.io/smart-ra/en/dpi-h-ra/index.html#prose%3Aa"],
    ]);
    expect(measuredModel({ status: "known", measured: { files: [] }, check: { missed: ["en/x/index.html"] } }, "../../").missed).toEqual([
      { path: "en/x/index.html", change: "changed", after: "../../en/x/index.html" },
    ]);
  });

  test("a single impact object is accepted as well as an array; no main site means no before links", () => {
    const one = renderedModel(impacts[0], null);
    expect(one.rows.length).toBe(3);
    expect(one.rows.every((r) => r.before === undefined)).toBe(true);
  });
});

describe("measuredModel (bean ehh6)", () => {
  const measured = (status: string, missed: string[]) => ({
    $schema: "rendered-measured/v1", status, baseCommit: "b".repeat(40), beforeCommit: "bcd7e92ab5b841eb",
    measured: { files: [{ path: "gone.js", change: "removed" }, { path: "a.html", change: "added" }] },
    check: { missed, confirmed: [], unconfirmed: [] },
  });

  test("known, with misses: each missed page linked on the preview, in path order; a removed one is not linked", () => {
    expect(measuredModel(measured("known", ["z/index.html", "gone.js", "a.html"]))).toEqual({
      state: "missed",
      missed: [
        { path: "a.html", change: "added", after: "../a.html" },
        { path: "gone.js", change: "removed" },
        { path: "z/index.html", change: "changed", after: "../z/index.html" },
      ],
    });
  });

  test("known, with none: clean", () => {
    expect(measuredModel(measured("known", [])).state).toBe("clean");
  });

  test("a before side that is not the base: the pages are shown and the commit named, but nothing is counted missed", () => {
    // smart-ra#26: main's site was built from bcd7e92, the base was b166ab7.
    const m = measuredModel(measured("not-base", ["index.html"]));
    expect(m.state).toBe("not-base");
    expect(m.beforeCommit).toBe("bcd7e92");
    expect(m.missed.map((r) => r.path)).toEqual(["index.html"]);
  });

  test("no file, or one without a check: not measured, never clean", () => {
    expect(measuredModel(null).state).toBe("not-measured");
    expect(measuredModel({ status: "known" }).state).toBe("not-measured");
  });
});
