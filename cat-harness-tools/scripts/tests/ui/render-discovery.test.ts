/**
 * The render target a folio validates against comes from its declared
 * profile, and every way of NOT having one is distinguishable from having one.
 *
 * The tests that matter here are the negative ones. A resolver that returns
 * `undefined` for all four misses would pass a "paper resolves to LaTeX" test
 * and still let `validate.ts` report a clean run over a folio whose renderer
 * failed to load.
 *
 * @module scripts/tests/render-discovery.test
 */
import { describe, test, expect } from "bun:test";

import { resolveRenderTarget } from "../../../pipeline/render-discovery.ts";
import { RENDER_TARGETS } from "../../../schemas/ui/render-targets.ts";
import { ContributionRegistry } from "../../../schemas/content/contributions.ts";

describe("the built-in targets", () => {
  test("paper renders to LaTeX and IS structurally checked", async () => {
    const { target, miss } = await resolveRenderTarget("paper");
    expect(miss).toBeUndefined();
    expect(target?.format).toBe("latex");
    expect(target?.validate).toBeDefined();
  });

  test("document renders to Markdown and is NOT structurally checked", async () => {
    // Absent `validate` is the honest report, not a gap to fill: Markdown
    // assembled from blocks has no invariant like LaTeX's environment stack.
    const { target, miss } = await resolveRenderTarget("document");
    expect(miss).toBeUndefined();
    expect(target?.format).toBe("markdown");
    expect(target?.validate).toBeUndefined();
  });

  test("a document block does not go through the LaTeX renderer", async () => {
    // The defect this whole module exists for: the generic validator rendered
    // every block to LaTeX, so a document folio got `LaTeX AST:` errors
    // against output its pandoc render path never produces.
    const paper = await resolveRenderTarget("paper");
    const doc = await resolveRenderTarget("document");
    expect(paper.target?.format).not.toBe(doc.target?.format);
  });

  test("every declared target actually loads", async () => {
    for (const profile of Object.keys(RENDER_TARGETS)) {
      const { miss } = await resolveRenderTarget(profile as "paper" | "document");
      expect(miss).toBeUndefined();
    }
  });
});

describe("no target is a reported state, never a pass", () => {
  test("an undeclared profile is `no-profile`, not defaulted to paper", async () => {
    // Guessing `paper` is exactly what made the LaTeX check generic.
    const { target, miss } = await resolveRenderTarget(undefined);
    expect(target).toBeUndefined();
    expect(miss?.reason).toBe("no-profile");
  });

  test("the miss carries a detail a reader can act on", async () => {
    const { miss } = await resolveRenderTarget(undefined);
    expect(miss?.detail).toMatch(/profile/);
  });
});

describe("contributed targets", () => {
  const registry = new ContributionRegistry();
  registry.register({
    name: "some-dependency",
    renderers: [
      {
        format: "latex",
        adapters: ["paper"],
        render: () => "CONTRIBUTED",
        validate: () => ({ valid: true, errors: [] }),
      },
    ],
  });

  test("a contributed target wins over the platform's built-in", async () => {
    // The opposite of the block-kind rule next door, and deliberately: a
    // shadowed `theorem` changes what every folio validates against, while a
    // shadowed render target changes only how this folio typesets.
    const { target } = await resolveRenderTarget("paper", registry);
    expect(target?.render({}, "")).toBe("CONTRIBUTED");
  });

  test("with no registry the built-in still resolves", async () => {
    const { target } = await resolveRenderTarget("paper");
    expect(target?.render({ kind: "prose", label: "p", title: "" }, "x")).not.toBe("CONTRIBUTED");
  });
});

describe("argStyle is declared, not sniffed", () => {
  test("both call shapes produce a string from a real block", async () => {
    // `renderBlock(block, md)` vs `renderBlockMarkdown({block, mdContent})`.
    // Calling either with the other's shape yields a plausible string rather
    // than an error, which is why the shape is written down.
    const block = { kind: "prose", label: "test-prose", title: "T" };
    for (const profile of ["paper", "document"] as const) {
      const { target } = await resolveRenderTarget(profile);
      expect(typeof target?.render(block, "Some body text.")).toBe("string");
    }
  });

  test("the Markdown renderer receives the body, not `[object Object]`", async () => {
    const { target } = await resolveRenderTarget("document");
    const out = target?.render({ kind: "prose", label: "p", title: "" }, "UNIQUE BODY MARKER");
    expect(out).toContain("UNIQUE BODY MARKER");
  });

  test("the LaTeX renderer receives the body too", async () => {
    const { target } = await resolveRenderTarget("paper");
    const out = target?.render({ kind: "prose", label: "p", title: "" }, "UNIQUE BODY MARKER");
    expect(out).toContain("UNIQUE BODY MARKER");
  });
});
