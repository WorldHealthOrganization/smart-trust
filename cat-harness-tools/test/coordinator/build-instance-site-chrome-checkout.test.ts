/**
 * The site build runs the publish-time writers its chrome needs, read from
 * the declarations of THIS checkout (smart-ra, 2026-10-15: the link check
 * refused `/smart-ra/assets/css/avatars.css`, which `avatars:css` writes into
 * cat-harness's `site-chrome/` and nothing in a folio's site build ran).
 */
import { describe, expect, test } from "bun:test";
import { relative } from "node:path";

import { chromeArtefacts } from "../../scripts/build-instance-site.ts";
import { chromeLayers } from "../../scripts/compose-docs.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { dirname, resolve } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));

describe("the chrome's publish-time artefacts, from the declarations", () => {
  test("the chrome layer is site-chrome, not the harness's site directory", () => {
    expect(chromeLayers(REPO).map((l) => relative(REPO, l.dir).replace(/\/+$/, ""))).toEqual(["cat-harness/site-chrome"]);
  });

  test("avatars.css is one of them, written by avatars:css, and no page of the docs/ site is", () => {
    const a = chromeArtefacts(REPO);
    expect(a.map((x) => `${x.instance}/${x.path} <- ${x.writer.join(",")}`)).toContain("cat-harness/site-chrome/assets/css/avatars.css <- avatars:css");
    expect(a.filter((x) => !x.path.startsWith("site-chrome/"))).toEqual([]);
  });
});
