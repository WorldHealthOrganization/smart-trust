/**
 * Measuring a staging build against main's published site (bean `bnjs`).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { RENDERED_IMPACT_TAG, RenderedImpactSchema } from "../../schemas/ui/rendered-impact.js";
import { measure, mergePredictions } from "../measure-rendered-impact.js";

const T = mkdtempSync(join(tmpdir(), "measure-rendered-"));
afterAll(() => rmSync(T, { recursive: true, force: true }));
const put = (rel: string, body: string) => {
  mkdirSync(dirname(join(T, rel)), { recursive: true });
  writeFileSync(join(T, rel), body);
};

// The publish root: main's site, plus another PR's preview and the render log.
put("pages/index.html", "home");
put("pages/doc/index.html", "old");
put("pages/other/index.html", "same");
put("pages/STAGING/other-pr/doc/index.html", "theirs");
put("pages/_render-log/1.json", "{}");
put("pages/_main-site.json", JSON.stringify({ $schema: "folio-main-site/v1", commit: "base1", files: ["index.html", "doc/index.html", "other/index.html"] }));
// The staging build: doc changed, other changed too (unpredicted), plus the job's own artefacts.
put("site/index.html", "home");
put("site/doc/index.html", "new");
put("site/other/index.html", "moved");
put("site/changeset.json", "{}");
put("site/rendered-impact.json", "[]");

const predicted = [
  RenderedImpactSchema.parse({ $schema: RENDERED_IMPACT_TAG, renderer: "document-site", method: "cone", files: [{ path: "doc/index.html", change: "changed", role: "content" }] }),
];

describe("measure", () => {
  test("compares main's published files only, never another preview, the render log or the job's own artefacts", () => {
    const m = measure({ before: join(T, "pages"), after: join(T, "site"), predicted, base: "base1" })!;
    expect(m.measured.files.map((f) => f.path)).toEqual(["doc/index.html", "other/index.html"]);
  });
  test("a measured change the prediction did not name is missed; the before side IS the base, so it counts", () => {
    const m = measure({ before: join(T, "pages"), after: join(T, "site"), predicted, base: "base1" })!;
    expect(m.status).toBe("known");
    expect(m.check.missed).toEqual(["other/index.html"]);
    expect(m.check.confirmed).toEqual(["doc/index.html"]);
  });
  test("a before side built from another commit is not-base: main's own changes are not the cone's misses", () => {
    const m = measure({ before: join(T, "pages"), after: join(T, "site"), predicted, base: "base2" })!;
    expect(m.status).toBe("not-base");
    expect(m.beforeCommit).toBe("base1");
  });
  test("no manifest, no measurement — never an empty one", () => {
    expect(measure({ before: join(T, "site"), after: join(T, "site"), predicted, base: "base1" })).toBeUndefined();
  });
});

describe("mergePredictions", () => {
  test("one prediction from several renderers, each file once", () => {
    const a = RenderedImpactSchema.parse({ $schema: RENDERED_IMPACT_TAG, renderer: "a", method: "cone", files: [{ path: "p.html", change: "changed", role: "content" }] });
    const b = RenderedImpactSchema.parse({ $schema: RENDERED_IMPACT_TAG, renderer: "b", method: "cone", files: [{ path: "p.html", change: "changed", role: "content" }, { path: "q.html", change: "changed", role: "content" }] });
    const m = mergePredictions([a, b]);
    expect(m.renderer).toBe("a+b");
    expect(m.files.map((f) => f.path)).toEqual(["p.html", "q.html"]);
  });
});
