/**
 * `document-kinds-viz` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/document-kinds-viz.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each reads the DAK document kind
 * smart-base declares, which only the checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. The rest of that file's tests stay there; every
 * path here is composed from ORIGIN_DIR, the directory they were written in,
 * so nothing they read changed.
 */
import { describe, expect, it } from "bun:test";
import { join, resolve } from "node:path";

import { pageHtml, readDocumentKinds } from "../../scripts/gen-document-kinds-viz.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = resolve(ORIGIN_DIR, "..", "..", "..");

describe("the committed DAK kind, drawn", () => {
  const { kinds } = readDocumentKinds(REPO);
  const dak = kinds.find((k) => k.instance === "smart-base" && k.kind.id === "dak");

  it("smart-base declares the DAK kind", () => {
    expect(dak).toBeDefined();
  });

  it("every section title appears, and the structure and sources are stated", () => {
    const html = pageHtml([dak!]);
    for (const s of dak!.kind.sections) expect(html).toContain(s.title.replace(/&/g, "&amp;"));
    expect(html).toContain("<b>fixed</b> structure");
    for (const s of dak!.kind.sources) expect(html).toContain(s.ref);
  });
});
