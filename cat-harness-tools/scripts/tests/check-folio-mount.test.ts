/**
 * check:folio-mount honours an exemption that sits inside a root.
 *
 * who-iris declares the root `docs/` and exempts `docs/wireframes/`. The root
 * walk counted the wireframe page as missing its mount, so the exemption was
 * listed as used and the gate failed anyway (folio-assistant#2611).
 *
 * @module scripts/tests/check-folio-mount.test
 */
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reportFor } from "../check-folio-mount.ts";

const PAGE = "<!doctype html><html><body>no mount</body></html>";

/** Layer `x`: root `docs/`, exempt `docs/wireframes/`, one page in each. */
function fixture(): string {
  const repo = mkdtempSync(join(tmpdir(), "folio-mount-"));
  mkdirSync(join(repo, "x", "docs", "wireframes", "catalogue"), { recursive: true });
  writeFileSync(
    join(repo, "x", "x.json"),
    JSON.stringify({
      name: "x",
      folioMount: { roots: ["docs/"], exempt: [{ path: "docs/wireframes/", reason: "drawings of a page" }] },
    }),
  );
  writeFileSync(join(repo, "x", "docs", "wireframes", "catalogue", "as-is.html"), PAGE);
  writeFileSync(join(repo, "x", "docs", "page.html"), PAGE);
  return repo;
}

test("a page under an exemption inside a root is not reported missing", () => {
  const r = reportFor(fixture(), "x");
  expect(r.missing).toEqual(["x/docs/page.html"]);
  expect(r.exemptUsed.map((e) => e.path)).toEqual(["docs/wireframes/"]);
  expect(r.staleExemptions).toEqual([]);
});
