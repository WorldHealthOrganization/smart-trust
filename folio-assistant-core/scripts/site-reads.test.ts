/**
 * What each document-site builder says it reads (bean `ehh6`). smart-ra#26's
 * second run declared `beans/` and `todos/`: the builders, not the declaration,
 * are asked. Since bean `ujiv` a bean is a node kind, so a `bean-defs`
 * directory on the checkout is read like `todos/`.
 */
import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { siteReads as nodeKindPages } from "@litlfred/cat-harness-tools/scripts/gen-node-kind-pages.ts";
import { siteReads as documentSite } from "./build-document-site.ts";
import { siteReads as publicCommentSite } from "./public-comment-site.ts";

const R = mkdtempSync(join(tmpdir(), "site-reads-"));
afterAll(() => rmSync(R, { recursive: true, force: true }));
for (const d of ["folio/doc", "review/public-comment", "todos/items", "beans"]) mkdirSync(join(R, d), { recursive: true });
writeFileSync(
  join(R, "x.json"),
  JSON.stringify({
    name: "x",
    directories: [
      { id: "folio", path: "folio/", graphTypologies: ["folio"] },
      { id: "public-comments", path: "review/public-comment/", graphTypologies: ["todo-items", "public-comments"] },
      { id: "todos", path: "todos/", graphTypologies: ["todo-items"] },
      { id: "beans", path: "beans/", graphTypologies: ["bean-defs"] },
    ],
  }),
);

test("documentSiteReadsFolio", () => {
  expect(documentSite(R, ["--out", "_site"])).toEqual(["folio"]);
});

test("publicCommentSiteReads", () => {
  expect(publicCommentSite(R, ["--out", "_site"])).toEqual(["review/public-comment", "folio"]);
  expect(publicCommentSite(R, ["--store", "other/store"])).toEqual(["other/store", "folio"]);
});

test("nodeKindPagesReads", async () => {
  const got = await nodeKindPages(R, ["--root", "."]);
  expect(got).toContain("todos");
  expect(got).toContain("review/public-comment");
  expect(got.some((d) => d.startsWith("beans"))).toBe(true);
  expect(got).not.toContain("folio");
});
