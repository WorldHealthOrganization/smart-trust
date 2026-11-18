/**
 * The kind table is an always-on page, so a kind description's link into an
 * opt-in sub-graph is written as its text alone (`check:optin-links`,
 * cat-harness main 65a51c0).
 *
 * @module scripts/tests/kind-table-optin.test
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { unlinkOptIn } from "../kind-table.ts";

const ROOT = "/checkout/cat-harness";
const ROOTS = [{ id: "cat-harness.sdlc", abs: join(ROOT, "sdlc") }];

describe("unlinkOptIn", () => {
  test("a link into an opt-in sub-graph keeps its text and loses its target", () => {
    expect(unlinkOptIn("see [the witness](../../../sdlc/skills/sdlc-core/qa-witness.md#x)", ROOT, ROOTS)).toBe("see the witness");
  });
  test("a link that stays outside every opt-in sub-graph is left as it is", () => {
    const text = "see [fencing](../graph-management/domain-fencing.md)";
    expect(unlinkOptIn(text, ROOT, ROOTS)).toBe(text);
  });
  test("an absolute URL, a site-rooted path and an anchor are left as they are", () => {
    const text = "[a](https://example.org/sdlc/) [b](/sdlc/x.md) [c](#sdlc)";
    expect(unlinkOptIn(text, ROOT, ROOTS)).toBe(text);
  });
  test("a sibling sharing the sub-graph's prefix is not inside it", () => {
    const text = "[s](../../../sdlc-extra/a.md)";
    expect(unlinkOptIn(text, ROOT, ROOTS)).toBe(text);
  });
});
