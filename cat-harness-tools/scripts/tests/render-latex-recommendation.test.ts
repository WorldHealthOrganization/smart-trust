/**
 * A document folio's `recommendation` block in LaTeX (bean `55ao`).
 *
 * No document-profile preamble defines a `recommendation` environment, and
 * mapping it to `remark` would print the wrong word. So it renders as a
 * run-in `\paragraph` in the document's own words, anchored like a labelled
 * prose block. These tests pin that, and pin that it does not reach the
 * environment table, where an unknown kind throws.
 */
import { describe, expect, test } from "bun:test";

import type { Block } from "../../schemas/types.ts";

import { ENV_NAMES, renderBlock } from "../../pipeline/render-latex";

const rec = (extra: Record<string, unknown> = {}) =>
  ({ kind: "recommendation", label: "who-anc:rec-12", title: "Iron and folic acid", ...extra }) as unknown as Block;

describe("recommendation in LaTeX", () => {
  test("a run-in heading with its title, a referenceable label, and the body", () => {
    const out = renderBlock(rec(), "Daily oral iron and folic acid supplementation is recommended.\n");
    expect(out).toContain("\\paragraph{Recommendation. Iron and folic acid}");
    expect(out).toContain("\\phantomsection\\label{who-anc:rec-12}");
    expect(out).toContain("Daily oral iron and folic acid supplementation is recommended.");
  });

  test("the label is skipped when it is the enclosing section's own, as for prose", () => {
    const out = renderBlock(rec(), "Body.\n", undefined, undefined, "who-anc:rec-12");
    expect(out).not.toContain("\\label{who-anc:rec-12}");
  });

  test("is not a theorem-like environment", () => {
    expect(ENV_NAMES.recommendation).toBeUndefined();
    expect(renderBlock(rec(), "Body.\n")).not.toContain("\\begin{");
  });
});
