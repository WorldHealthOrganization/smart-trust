/**
 * Every generated skill page's "Generated from" and "Edit this page's source"
 * links RESOLVE to a file in this repository.
 *
 * Bean `folio-assistant-oe98`. 240 of 244 pages linked a path that did not
 * exist — 231 by the pre-split `skills/...` prefix, 9 by a `../bootstrap/...`
 * parent segment no GitHub URL can carry — while `gen-skill-docs --check` and
 * `auto:docs:check` were green throughout. Both compare bytes against what the
 * generator would write; a wrong generator agrees with its own output. This
 * test resolves the link instead, which is the only check that can see the
 * class.
 *
 * @module scripts/tests/skill-doc-source-links.test
 *
 * The tests of this file that read the whole checkout (resolves skill sources
 * across every layer in the checkout) live in
 * `test/skill-doc-source-links-checkout.test.ts` (bean `7zz1`): standing
 * alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";

import { repoRelative } from "../gen-skill-docs.ts";

describe("repoRelative", () => {
  test("a directory inside the checkout is named repository-relative", () => {
    expect(repoRelative("/repo/cat-harness/skills/folio-core", "/repo")).toBe("cat-harness/skills/folio-core");
  });

  test("a directory outside the checkout has no path, rather than a `..` one", () => {
    expect(repoRelative("/elsewhere/bootstrap/skills", "/repo")).toBeUndefined();
    expect(repoRelative("/repo", "/repo")).toBeUndefined();
  });

  test("a name that merely starts with two dots is still inside", () => {
    expect(repoRelative("/repo/..hidden/x", "/repo")).toBe("..hidden/x");
  });
});
