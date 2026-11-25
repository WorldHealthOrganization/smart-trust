import { describe, expect, test } from "bun:test";
import { EDIT_LINKS_RUNTIME, compactActionsHtml, leanDataAttrs } from "../edit-links.ts";

// happy-dom is in the platform's tree (a transitive dependency), not this
// layer's own: without it the DOM tests skip and the attribute test still runs.
const HD = (await import("happy-dom").catch(() => undefined)) as typeof import("happy-dom") | undefined;

/** A page with one block, run through the runtime in happy-dom. */
function page(lean?: Parameters<typeof leanDataAttrs>[0]) {
  const w = new HD!.Window({ url: "https://example.test/doc/" });
  const d = w.document;
  d.body.innerHTML =
    `<div class="main-content"><a id="def:x"></a>` +
    compactActionsHtml({ label: "def:x", source: "folio/p/c/x.md", ...(lean ? { lean } : {}) }) +
    `<p>Text</p></div>`;
  d.head.innerHTML = `<script type="application/json" id="fa-edit-cfg">{"repo":"o/r","branch":"b"}</script>`;
  new Function("window", "document", "location", "history", "navigator", "CSS", EDIT_LINKS_RUNTIME)(
    w, d, w.location, w.history, w.navigator, { escape: (s: string) => s.replace(/["\\]/g, "\\$&") },
  );
  return { w, d, box: d.querySelector(".block-actions")! };
}

describe("∀ Lean icon in the block gutter (owner, 2026-11-19)", () => {
  test("the box carries the Lean facts as data attributes, and none without a declaration", () => {
    expect(leanDataAttrs(undefined)).toBe("");
    const a = leanDataAttrs({ decl: "A.b", status: "compiled", source: "https://x/y.lean#L3", docs: "../lean/A.html#A.b" });
    expect(a).toContain('data-lean="A.b"');
    expect(a).toContain('data-lean-status="compiled"');
    expect(a).toContain('data-lean-src="https://x/y.lean#L3"');
    expect(a).toContain('data-lean-doc="../lean/A.html#A.b"');
  });

});

describe.skipIf(!HD)("∀ Lean icon: the runtime, in happy-dom", () => {
  test("a block with a declaration gets a ∀ beside the 📣, which is not folded into it", () => {
    const { box } = page({ decl: "A.b", status: "drafted", source: "https://x/y.lean#L3" });
    const lean = box.querySelector(":scope > .ba-lean") as unknown as HTMLElement;
    expect(lean).not.toBeNull();
    expect(lean.textContent).toBe("\u2200");
    expect(lean.dataset.pane).toBe("lean");
    expect(lean.dataset.status).toBe("drafted");
    // The 📣 is still the trigger and counts nothing from the ∀.
    const trigger = box.querySelector(":scope > .ba-trigger") as unknown as HTMLElement;
    expect(trigger.dataset.pane).toBe("edit");
    expect(trigger.querySelector(".ba-n")).toBeNull();
  });

  test("a block without one has no ∀", () => {
    const { box } = page();
    expect(box.querySelector(".ba-lean")).toBeNull();
  });

  test("the ∀ opens a panel with the declaration, its status and both links, and nothing else", () => {
    const { d, box } = page({ decl: "A.b", status: "compiled", source: "https://x/y.lean#L3", docs: "../lean/A.html#A.b" });
    (box.querySelector(".ba-lean") as unknown as HTMLElement).click();
    const panel = d.querySelector(".fa-block-panel")!;
    expect(panel.classList.contains("open")).toBe(true);
    expect(panel.querySelector("h3")!.textContent).toContain("Lean formalisation");
    expect(panel.querySelector(".bp-lean-decl")!.textContent).toBe("A.b");
    expect(panel.querySelector(".bp-lean-status")!.textContent).toContain("Compiled");
    const hrefs = Array.from(panel.querySelectorAll("a.bp-lean-link")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["../lean/A.html#A.b", "https://x/y.lean#L3"]);
    // Not the 📣's links: the box stays where it was.
    expect(panel.querySelector("a[data-fa-link]")).toBeNull();
  });

  test("a declaration the rendered docs do not list shows only its source", () => {
    const { d, box } = page({ decl: "A.b", source: "https://x/y.lean#L3" });
    (box.querySelector(".ba-lean") as unknown as HTMLElement).click();
    const hrefs = Array.from(d.querySelectorAll(".fa-block-panel a.bp-lean-link")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["https://x/y.lean#L3"]);
  });
});
