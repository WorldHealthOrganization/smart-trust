/**
 * The graph-typology rows a REAL layer's rail is built from declare themselves
 * kind rows (#2151).
 *
 * Owner, 2026-10-05: *"alignment of harnesses is off"*. `fa-nav-kind`, the
 * strip-column indent, used to be inferred from "has an SVG glyph", and #2122
 * gave harness rows glyph marks too. It is now `NavItem.kind`, set by
 * `graphTypologyRowDecor`. `cat-harness-tools/scripts/tests/ui/navbar.test.ts` asserts the
 * markup from rows built by that function directly. This file asserts that
 * `declaredGraphs` threads the field through for a real layer.
 *
 * It lives HERE, not beside navbar.test.ts, because it reads who-iris's
 * declaration, which a standalone cat-harness layer does not carry
 * (`check:cat-harness-standalone`).
 */
import { describe, expect, it } from "bun:test";

import { declaredGraphs } from "../../mount-instance-docs.ts";

describe("declaredGraphs' rows are declared kind rows (#2151)", () => {
  const rows = declaredGraphs("who-iris", new Map([["docs", "../docs/who-iris/"]]));

  it("there are rows to check, so an empty instance is not a pass", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("every one carries kind: true", () => {
    expect(rows.filter((r) => r.kind !== true).map((r) => r.label)).toEqual([]);
  });
});
