/**
 * stage-folio-local: the `--slug` it is given names a directory on the publish
 * branch, and the check server it runs reads files for a browser. Both values
 * come from outside, so both are checked by value and refused, never repaired
 * (bean `folio-core-q7x7`).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveSitePath, serveSite, STAGING_SLUG_MAX, stagingSlugProblem } from "./stage-folio-local.js";

let roots: string[] = [];
afterEach(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  roots = [];
});

/** A site with one page, beside a file that is not part of it. */
function fixture(): { root: string; site: string } {
  const root = mkdtempSync(join(tmpdir(), "stage-local-"));
  roots.push(root);
  const site = join(root, "_site");
  mkdirSync(join(site, "a"), { recursive: true });
  writeFileSync(join(site, "index.html"), "home");
  writeFileSync(join(site, "a", "index.html"), "page a");
  writeFileSync(join(root, "outside.txt"), "not served");
  symlinkSync(join(root, "outside.txt"), join(site, "link.txt"));
  return { root, site };
}

describe("stagingSlugProblem", () => {
  test("acceptsBranchSlugs", () => {
    for (const s of ["qou", "feat-x", "v1.2.3", "a_b", "Main9", "a".repeat(STAGING_SLUG_MAX)]) {
      expect(stagingSlugProblem(s)).toBeUndefined();
    }
  });

  test("refusesUnsafeSlugs", () => {
    for (const s of ["", ".", "..", "../x", "a/b", "a\\b", "-x", ".hidden", "_retired", "a b", "a\0b", "a;b", "a".repeat(STAGING_SLUG_MAX + 1)]) {
      expect(stagingSlugProblem(s)).toBeString();
    }
    expect(stagingSlugProblem(undefined)).toBeString();
  });
});

describe("resolveSitePath", () => {
  test("resolvesPageAndDirectory", () => {
    const { site } = fixture();
    expect(resolveSitePath(site, "/")).toEndWith(join("_site", "index.html"));
    expect(resolveSitePath(site, "/a/?q=1")).toEndWith(join("_site", "a", "index.html"));
  });

  test("neverOutsideSite", () => {
    const { site } = fixture();
    for (const u of ["/../outside.txt", "/%2e%2e/outside.txt", "/a/..%2f..%2foutside.txt", "/link.txt", "/%00", "/%E0%A4%A", "/missing.html"]) {
      expect(resolveSitePath(site, u)).toBeUndefined();
    }
  });

  test("serverLoopback404", async () => {
    const { site } = fixture();
    const { server, port } = await serveSite(site);
    try {
      expect((server.address() as { address: string }).address).toBe("127.0.0.1");
      const ok = await fetch(`http://127.0.0.1:${port}/a/`);
      expect(ok.status).toBe(200);
      expect(await ok.text()).toBe("page a");
      for (const u of ["/link.txt", "/%2e%2e/outside.txt"]) {
        expect((await fetch(`http://127.0.0.1:${port}${u}`)).status).toBe(404);
      }
    } finally {
      server.close();
    }
  });
});
