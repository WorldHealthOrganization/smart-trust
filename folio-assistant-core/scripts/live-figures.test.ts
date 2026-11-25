import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIGURE_SWITCH_STYLE, linkedSvgFigures, liveFiguresFor, withLiveFigures, type FigureTarget } from "./live-figures.ts";

const target: FigureTarget = {
  block: "folio/doc/ch1/f-1.md",
  label: "Figure 1",
  model: "1.0.0",
  view: "id-v1",
  viewName: "Overview",
  svg: "archimate/1.0.0/views/id-v1.svg",
  page: "en/inst/archimate/1.0.0/views/overview/",
};

describe("a figure that is a model view is drawn from the model", () => {
  const root = mkdtempSync(join(tmpdir(), "live-figures-"));
  mkdirSync(join(root, "folio/doc/ch1"), { recursive: true });
  writeFileSync(join(root, target.block), "![Figure](media/image1.png)\n");
  const live = liveFiguresFor([target, { ...target, block: "folio/doc/gone.md" }], root, "en/doc");

  it("findsBlockImage", () => {
    expect([...live.keys()]).toEqual(["media/image1.png"]);
    expect(live.get("media/image1.png")).toMatchObject({ svg: "../../archimate/1.0.0/views/id-v1.svg", page: "../inst/archimate/1.0.0/views/overview/" });
  });

  it("embedsObjectKeepsPng", () => {
    const html = withLiveFigures(`<p><img src="media/image1.png" alt="Figure"></p>\n<p><img src="media/other.png" alt="x"></p>`, live);
    expect(html).toContain(`<object class="fa-live-figure" type="image/svg+xml" data="../../archimate/1.0.0/views/id-v1.svg"`);
    // A link inside an SVG loaded through <img> is never clickable, and a link
    // around the drawing would take every click to the view page instead.
    expect(html).not.toContain(`<img src="../../archimate/1.0.0/views/id-v1.svg"`);
    expect(html).not.toContain(`<a class="fa-live-figure"`);
    expect(html).toContain(`><img src="media/image1.png" alt="Figure 1: view &quot;Overview&quot; of ArchiMate model 1.0.0, drawn from the model" loading="lazy"></object>`);
    expect(html).toContain(`<a href="../inst/archimate/1.0.0/views/overview/">view &ldquo;Overview&rdquo;</a> (1.0.0)`);
    expect(html).toContain(`<img src="media/other.png" alt="x">`);
  });

  it("noMappingNoChange", () => {
    expect(withLiveFigures(`<img src="media/image1.png">`, new Map())).toBe(`<img src="media/image1.png">`);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("a figure with an as-drawn source and a view gets the As drawn / ArchiMate switch", () => {
  const root = mkdtempSync(join(tmpdir(), "live-figures-switch-"));
  mkdirSync(join(root, "folio/doc/ch1"), { recursive: true });
  writeFileSync(join(root, target.block), "![Figure 3](media/fig-3-ecosystem-as-drawn.svg)\n");
  writeFileSync(join(root, "folio/doc/ch1/f-2.md"), "![Figure 4](media/image4.png)\n");
  const fromBlock = liveFiguresFor([target], root, "en/doc");
  const fromConfig = liveFiguresFor([{ ...target, block: "folio/doc/ch1/f-2.md", label: "Figure 4", asDrawn: "folio/doc/media/as-drawn-fig-4.svg" }], root, "en/doc");
  const html = withLiveFigures(
    `<p><img src="media/fig-3-ecosystem-as-drawn.svg" alt="Figure 3"></p>`,
    fromBlock,
  );

  it("asDrawnFromBlockOrConfig", () => {
    expect(fromBlock.get("media/fig-3-ecosystem-as-drawn.svg")?.asDrawn).toBe("media/fig-3-ecosystem-as-drawn.svg");
    expect(fromConfig.get("media/image4.png")?.asDrawn).toBe("media/as-drawn-fig-4.svg");
    // A plain screenshot is not an as-drawn source: no switch.
    const plain = liveFiguresFor([{ ...target, block: "folio/doc/ch1/f-2.md" }], root, "en/doc");
    expect(plain.get("media/image4.png")?.asDrawn).toBeUndefined();
    expect(withLiveFigures(`<img src="media/image4.png">`, plain)).not.toContain("fa-figure-switch");
  });

  it("switchDefaultsAsDrawn", () => {
    expect(html.indexOf(FIGURE_SWITCH_STYLE)).toBeGreaterThanOrEqual(0);
    expect(html).toContain(`<input type="radio" class="fa-figure-as-drawn" name="fa-figure-1" id="fa-figure-1-as-drawn" checked><label for="fa-figure-1-as-drawn">As drawn</label>`);
    expect(html).toContain(`<label for="fa-figure-1-archimate">ArchiMate</label>`);
    expect(html.indexOf("As drawn")).toBeLessThan(html.indexOf(">ArchiMate<"));
    expect(html).toContain(`<object class="fa-live-figure" type="image/svg+xml" data="../../archimate/1.0.0/views/id-v1.svg"`);
    expect(html).toContain(`<span class="fa-figure-pane fa-figure-pane-as-drawn"><img src="media/fig-3-ecosystem-as-drawn.svg" alt="Figure 1, as drawn"`);
    expect(FIGURE_SWITCH_STYLE).toContain("@media print");
    expect(FIGURE_SWITCH_STYLE).toContain("prefers-color-scheme: dark");
    // Two figures: one stylesheet, distinct radio groups.
    const two = withLiveFigures(`<img src="media/fig-3-ecosystem-as-drawn.svg"><img src="media/fig-3-ecosystem-as-drawn.svg">`, fromBlock);
    expect(two.split("<style data-fa-figure-switch>").length).toBe(2);
    expect(two).toContain(`id="fa-figure-2-archimate"`);
  });

  it("switchTogglesInBrowser", async () => {
    let chromium: typeof import("playwright").chromium;
    try {
      ({ chromium } = await import("playwright"));
    } catch {
      return; // no browser here; the markup tests above still hold
    }
    const browser = await chromium.launch().catch(() => undefined);
    if (browser === undefined) return;
    try {
      const page = await browser.newPage();
      await page.setContent(`<!doctype html><html><body><main>${html}</main></body></html>`);
      const drawn = page.locator(".fa-figure-pane-as-drawn");
      const archimate = page.locator(".fa-figure-pane-archimate");
      expect(await page.getByRole("radio", { name: "As drawn" }).isChecked()).toBe(true);
      expect(await drawn.isVisible()).toBe(true);
      expect(await archimate.isVisible()).toBe(false);
      // Keyboard: focus the checked radio, arrow to the next one.
      await page.getByRole("radio", { name: "As drawn" }).focus();
      await page.keyboard.press("ArrowRight");
      expect(await page.getByRole("radio", { name: "ArchiMate" }).isChecked()).toBe(true);
      expect(await drawn.isVisible()).toBe(false);
      expect(await archimate.isVisible()).toBe(true);
      await page.locator('label[for="fa-figure-1-as-drawn"]').click();
      expect(await drawn.isVisible()).toBe(true);
      // Print shows the as-drawn drawing, whichever radio is checked.
      await page.getByRole("radio", { name: "ArchiMate" }).check();
      await page.emulateMedia({ media: "print" });
      expect(await drawn.isVisible()).toBe(true);
      expect(await archimate.isVisible()).toBe(false);
      expect(await page.locator('label[for="fa-figure-1-as-drawn"]').isVisible()).toBe(false);
    } finally {
      await browser.close();
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("a linked SVG of the document's own is embedded so its links work", () => {
  const doc = mkdtempSync(join(tmpdir(), "linked-svg-"));
  mkdirSync(join(doc, "media"));
  writeFileSync(join(doc, "media/linked.svg"), '<svg><a href="https://x/entry/" target="_top"><title>Entry</title><rect/></a></svg>');
  writeFileSync(join(doc, "media/plain.svg"), '<svg><a href="#self"><rect/></a></svg>');

  it("linkedSvgBecomesObject", () => {
    const html = linkedSvgFigures('<p><img src="media/linked.svg" alt="DIIG phases"></p>', doc);
    expect(html).toBe('<p><object class="fa-live-figure" type="image/svg+xml" data="media/linked.svg" aria-label="DIIG phases"><img src="media/linked.svg" alt="DIIG phases"></object></p>');
  });

  it("unlinkedMissingOrOutsideStayImg", () => {
    for (const src of ["media/plain.svg", "media/gone.svg", "media/image.png", "../media/linked.svg", "https://x/linked.svg"]) {
      const tag = `<img src="${src}" alt="x">`;
      expect(linkedSvgFigures(tag, doc)).toBe(tag);
    }
  });

  it("modelViewFallbackNotWrappedAgain", () => {
    const html = '<object class="fa-live-figure" type="image/svg+xml" data="../v.svg"><img src="media/linked.svg" alt="x"></object>';
    expect(linkedSvgFigures(html, doc)).toBe(html);
  });
});
