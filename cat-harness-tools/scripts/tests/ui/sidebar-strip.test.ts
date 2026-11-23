/**
 * The sidebar rests as an icon strip — and the two files that agree about it.
 *
 * Owner, 2026-09-21, on the round this replaces: *"clicking it away completelt
 * disappeared in who-iris. i expected the same behaviour as was in who-iris,
 * that it slides to the far left, icon width thick."*
 *
 * **CLOSED IS NOT GONE.** Asked to "have it start hidden", the previous version
 * removed the strip entirely and put a launcher on the glass, and this file
 * asserted — at length, and correctly for that design — that the launcher had
 * to live OUTSIDE the sidebar, since anything inside a hidden element is
 * hidden with it. That invariant was real and is now moot: the strip is always
 * on screen, so the controls belong in the sidebar and `footer_custom.html` is
 * clean again.
 *
 * Worth keeping as a caution: a test can be rigorous, falsifiable, and
 * defending the wrong design. Three of these assertions passed every
 * falsification and still had to go.
 *
 * The rendered result is not checked HERE, but it is no longer true that it
 * cannot be. `remote_theme` resolves on the runner, so the theme's compiled
 * selectors are not in this checkout, and this environment's proxy refuses the
 * published site over HTTP — but the branches/ PREVIEW IS COMMITTED TO
 * `gh-pages`, and git reaches it:
 *
 *     git fetch origin gh-pages
 *     git archive FETCH_HEAD:branches/<slug> | tar -x -C <dir>/<baseurl>/branches/<slug>
 *
 * Served at THAT path -- the pages address their assets under the staging
 * baseurl, and mounting them anywhere else 404s every stylesheet while still
 * rendering a page that a careless check calls a pass -- Playwright then drives
 * the real CI build, theme and all. Demonstrated 2026-09-23 on bean `vfr8`:
 * 10 stylesheets, 0 failed requests, 4 of 5 figures genuinely auto-expanded.
 *
 * These assertions stay a text check anyway, because a stylesheet invariant
 * wants to fail in the fast gate set rather than behind a 90 MB extract.
 */
import { describe, expect, it } from "bun:test";
// Publish-time files are written to the layer output overlay (bean sm8r);
// these read the copy a site reader sees, falling back to the path given.
import { readFileSync } from "../../../test/support/site-fs.ts";
import { join, resolve } from "node:path";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { dirname } from "node:path";
import { siteFileFor } from "../../../schemas/kg/cat-harness.js";
import { siteNotBuilt } from "../../../test/support/checkout.ts";

const REPO = resolve(dirname(HARNESS_ROOT));
const read = (p: string) => readFileSync(join(REPO, p), "utf-8");

const css = read("cat-harness/site-chrome/assets/css/docs-ui.css");
/**
 * Inside `.side-bar` — where all three controls now live.
 *
 * The GENERATED include, not `nav_footer_custom.html`, since `sjic`: that
 * template is now a single `{% include %}` and composes no markup, so reading
 * it here would assert over a file with no controls in it and pass by being
 * blind. The markup moved; the question this file asks did not.
 */
const INSIDE = "cat-harness/docs/_includes/generated/navbar-footer.html";
/** The generated include is written at publish and gitignored (bean w1gy F18). */
const INSIDE_NOT_BUILT = siteNotBuilt("the generated sidebar include `navbar:include` writes at publish (gitignored)", join(REPO, INSIDE));
const inside = INSIDE_NOT_BUILT ? "" : read(INSIDE);
/** Inside `.main` — which should carry none of them any more. */
const outside = read("cat-harness/site-chrome/_includes/footer_custom.html");

/**
 * The slice that owns this behaviour, WITH COMMENTS STRIPPED.
 *
 * Not fussiness: an earlier version matched the raw slice and reported a rule
 * as carrying `display: none` — which appeared in the COMMENT above it,
 * explaining why it is not used. A stylesheet that documents the declaration
 * it avoids fails any test that greps for the declaration.
 */
const block = css
  .slice(css.indexOf("The sidebar rests as an icon strip"), css.indexOf("Edit-the-source affordance"))
  .replace(/\/\*[\s\S]*?\*\//g, "");

/** The whole stylesheet, comments stripped, for the regions outside `block`. */
const whole = css.replace(/\/\*[\s\S]*?\*\//g, "");
/** One rule's text in `whole`, found by a declaration only that rule carries. */
const ruleInWhole = (needle: string): string => {
  const at = whole.indexOf(needle);
  expect({ needle, found: at > -1 }).toEqual({ needle, found: true });
  return whole.slice(whole.slice(0, at).lastIndexOf("}") + 1, whole.indexOf("}", at) + 1);
};

/** One rule's text, found by a declaration only that rule carries. */
const ruleWith = (needle: string): string => {
  const at = block.indexOf(needle);
  expect({ needle, found: at > -1 }).toEqual({ needle, found: true });
  return block.slice(block.slice(0, at).lastIndexOf("}") + 1, block.indexOf("}", at) + 1);
};

describe("at rest it is a strip, not an absence", () => {
  it("keeps a visible width — the regression this file exists for", () => {
    // The previous design hid it outright. `width: var(--fa-nav-collapsed)`
    // and no `visibility: hidden` anywhere is what "slides to the far left,
    // icon width thick" means.
    expect(ruleWith("width: var(--fa-nav-collapsed)")).toBeTruthy();
    expect(block).not.toContain("visibility: hidden");
    expect(block).not.toContain("translateX(-100%)");
  });

  it("pads `.main` by THE SAME property it sizes the strip with", () => {
    // Two numbers that must agree, failing silently either way: too wide and
    // the nav overlaps the text, too narrow and the text floats.
    expect(block).toContain("width: var(--fa-nav-collapsed)");
    expect(block).toContain("margin-left: var(--fa-nav-collapsed)");
  });

  it("clips from the LEFT, or the strip shows the end of every label", () => {
    // The theme sets `align-items: flex-end` on this flex column. With a
    // narrow parent and wide children that puts the labels' right-hand ends in
    // the strip — which reads as mojibake rather than as a clip.
    expect(ruleWith("width: var(--fa-nav-collapsed)")).toContain("align-items: flex-start");
  });

  it("does NOT scroll as one box — the MIDDLE region does", () => {
    // REPLACES an assertion that required `overflow-y: auto` on `.side-bar`
    // itself. That was correct for the design it defended and is the defect
    // now: one scroll box means the harness tabs and home scroll off the
    // bottom with everything else, against the owner's *"KG libraries is a
    // scrollable stacks between fixed top an bottom parts"*. This file's own
    // header is about exactly this — a rigorous test defending the wrong
    // design.
    //
    // MEASURED in Chromium at 1280x900 before the change: `.side-bar`
    // scrollHeight 1200 against clientHeight 900, with `.site-nav` squeezed
    // to 64px holding 944px of navigation.
    expect(ruleWith("width: var(--fa-nav-collapsed)")).toContain("overflow: hidden");
    expect(ruleWith("width: var(--fa-nav-collapsed)")).not.toContain("overflow-y: auto");
  });

  it("gives the middle the scroll, a FLOOR, and room to shrink", () => {
    const nav = ruleWith("min-height: 8rem");
    expect(nav).toContain("flex: 1 1 auto");
    expect(nav).toContain("overflow-y: auto");
  });

  it("every other child is fixed, so neither edge region can scroll away", () => {
    expect(ruleWith("flex: 0 0 auto")).toContain(".side-bar > *");
  });

  it("the capped bottom region YIELDS to that floor", () => {
    // `0 1 auto`, not `0 0 auto`: it scrolls inside its own cap, so giving
    // space back costs no reachability — while refusing to took the middle to
    // 93px in a 900px column, measured with the document index open.
    //
    // ONE capped region, not two. The second was the theme sidebar's
    // document index (`.fa-doc-index`, `max-height: 25%`), which `docs-ui.js`
    // built in the browser. Owner, 2026-10-15, "folio rail everywhere"
    // (option A): the folio rail replaces the theme's side bar after the
    // Jekyll build and carries "On this page" as a server-built section, so
    // cat-harness #285 retired `mountDocumentIndex` and the rules only it used.
    // Asserting that cap now would defend a region the ruling removed; the
    // test below asserts it stays removed instead.
    //
    // Against the WHOLE stylesheet rather than `block`: the fixed bottom is
    // its own section, outside the strip slice this file otherwise reads.
    // Comments stripped for the reason `block` strips them — a stylesheet
    // that documents the declaration it avoids fails any test that greps for
    // the declaration.
    expect(ruleInWhole("max-height: 50%")).toContain("flex: 0 1 auto");
  });

  it("the browser-built document index is gone, rules and script alike (owner, 2026-10-15)", () => {
    // If it came back it would come back uncapped: the 25% cap went with it.
    expect(whole).not.toContain(".fa-doc-index");
    // The function, not the name: docs-ui.js's comments still say why it went.
    expect(read("cat-harness/site-chrome/assets/js/docs-ui.js")).not.toMatch(/function\s+mountDocumentIndex\b/);
  });

  it("is scoped above the theme's breakpoint, never applied to the phone", () => {
    // Below 50rem the theme is not `fixed` and has its own hamburger. Bound to
    // the RULE, not to the presence of the string: a later
    // `prefers-reduced-motion` block carries the same media text, so a
    // substring check went on passing when the collapse was unscoped.
    const at = block.indexOf("width: var(--fa-nav-collapsed)");
    const enclosing = block.slice(0, at).lastIndexOf("@media");
    expect(block.slice(enclosing, block.indexOf("{", enclosing))).toContain("min-width: 50rem");
  });

  it("carries no script", () => {
    expect(block.toLowerCase()).not.toContain("<script");
  });
});

describe("three ways in, one way back", () => {
  /** The one rule that widens the sidebar. */
  const opener = ruleWith("width: var(--fa-nav-open);\n    \n    z-index");

  it("opens on hover, on keyboard focus, and on the pinned checkbox", () => {
    // A pointer is not the only input: a tablet is ABOVE this breakpoint, so
    // it gets the strip and has no hover at all.
    expect(opener).toContain(".side-bar:hover");
    expect(opener).toContain(".side-bar:focus-within");
    expect(opener).toContain(".side-bar:has(.fa-nav-open:checked)");
  });

  it("overlays the page rather than reflowing it", () => {
    expect(opener).toMatch(/z-index:\s*\d+/);
  });

  it("draws no ☰ and no [x] — the avatar is the one control (ob3m finding 8)", () => {
    // Owner, 2026-10-01, option 1 of 4: remove them on theme pages as #1762
    // did on the rail. Every rule that styled them sat inside the 50rem
    // block, so below 800px a copy rendered unstyled. No rule may name them,
    // in the block or anywhere else in the file.
    const bare = read("cat-harness/site-chrome/assets/css/docs-ui.css").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(bare).not.toContain(".fa-nav-close");
    expect(bare).not.toContain(".fa-nav-toggle");
    expect(bare).not.toContain(".fa-nav-head");
  });
});

describe("the controls live inside the sidebar now", () => {
  it.skipIf(INSIDE_NOT_BUILT)("the checkbox is in the sidebar's own include, and no ☰ or [x] (#1757)", () => {
    // There were three controls: the checkbox, the `☰` (`fa-nav-head`) and the
    // `[x]` (`fa-nav-close`). The owner asked for the last two to go — they
    // duplicated the avatar, which `docs-ui.js` makes toggle this checkbox.
    expect(inside).toContain("fa-nav-open");
    expect(inside).not.toContain("fa-nav-close");
    expect(inside).not.toContain("fa-nav-head");
  });

  it("and `footer_custom.html` carries none of them", () => {
    // It held the launcher only while the sidebar was hidden. Leaving a stray
    // fixed-position control there would put a ☰ on the glass beside a strip
    // that already opens.
    expect(outside).not.toContain("fa-nav");
  });

  it.skipIf(INSIDE_NOT_BUILT)("no label drives the checkbox from the include — the avatar does", () => {
    // PER RENDERED VARIANT. The generated include carries the canonical and
    // staging renderings behind one Liquid conditional.
    const variants = inside.split("{%- else -%}");
    expect(variants).toHaveLength(2);
    for (const v of variants) expect(v).not.toMatch(/<label[^>]*for="fa-nav-open"/);
  });

  it("the checkbox is focusable, not `display: none`", () => {
    expect(ruleWith("clip-path: inset(50%)")).not.toContain("display: none");
  });

  it("and it is clipped in place, never parked off an edge (bean `2r2n`)", () => {
    // `left: -9999px` is on the SCROLLABLE side of a right-to-left page: it
    // made the Arabic onboarding guide 10,389px wide at a 390px viewport.
    expect(block).not.toMatch(/left:\s*-9{3,}px/);
  });

  it("the control that remains has an accessible name — this is navigation", () => {
    // With the ☰ and [x] gone (#1757), the one control is the theme's avatar
    // link, and `docs-ui.js` names it by what a click does: open the bar, or,
    // once it is open, go home (owner, 2026-10-30, cat-harness-tools#910).
    const js = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/js/docs-ui.js")), "utf8");
    expect(js).toContain('avatar.title = box.checked ? "Go to the landing page" : "Open navigation, or go to the landing page once it is open"');
    expect(js).toContain('avatar.setAttribute("aria-expanded"');
  });
});

describe("figures keep a white plate, with and without JavaScript", () => {
  /**
   * Owner, 2026-09-21: *"all drawings/figures need white backgroun in dark
   * mode"*, with a screenshot of a Mermaid graph whose NODES were legible and
   * whose EDGES were not — thin grey connectors on a near-black page.
   *
   * The white card is applied two ways on purpose: by `mountFigures()`, which
   * also supplies the scroll container and zoom controls, and declaratively
   * here. The JS path measures before it wraps and skips anything under 240px
   * in both axes — a guard a diagram can fail transiently, before layout
   * settles. The CSS path cannot be lost to a timing window.
   */
  /**
   * COMMENTS STRIPPED, for the second time in this file and for the same
   * reason: the prose here explains why a blanket `img[src$=".svg"]` rule is
   * wrong, so a test that greps for that selector finds it in the explanation.
   * A stylesheet that documents what it avoids defeats any raw-text match.
   */
  const figures = css
    .slice(css.indexOf(".fa-figure-scope {"), css.indexOf("Full-bleed."))
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("states the same white in both paths", () => {
    expect(figures).toContain("background: #fff !important"); // the JS-applied class
    expect(figures).toContain("background: #fff;"); // the declarative fallback
  });

  it("the fallback reaches the class this theme actually emits", () => {
    // It was `.mermaid` once — Mermaid's own conventional class, which
    // just-the-docs never sets. `closest` returned null every time and the
    // card was never attached. `.language-mermaid` is what the theme emits.
    expect(figures).toContain(".main-content .language-mermaid");
  });

  it("does NOT blanket every inline SVG — CSS cannot measure", () => {
    // A rule on `img[src$=".svg"]` would put a white plate behind every icon,
    // which is exactly what the JS path's 240px guard exists to prevent. CSS
    // has no size test, so it must not attempt that judgement at all.
    expect(figures).not.toMatch(/img\[src\$=/);
    expect(figures).not.toMatch(/^\s*svg\s*\{/m);
  });

  it("is white in BOTH schemes, not only under a dark-mode query", () => {
    // The settled rule: a schematic is a figure and figures are printed on
    // white, whatever the page is doing. Dark mode is where the failure is
    // visible, not where the rule changes. A `prefers-color-scheme` guard here
    // would also miss this site, which sets its scheme explicitly.
    expect(figures).not.toContain("prefers-color-scheme");
  });
});

/**
 * The sidebar can always paint above `.main` — bean `vfr8`.
 *
 * The open nav OVERLAYS the page rather than pushing it: `.side-bar + .main`
 * keeps `margin-left: var(--fa-nav-collapsed)` at every width, so the opened
 * 16.5rem column sits on top of content that is still there. That only reads
 * as a nav if the sidebar paints above `.main` — and the theme is against it,
 * setting `.side-bar { z-index: 0 }` while `.main` is `position: relative`
 * with `z-index: auto` and later in tree order, so `.main` wins on tie.
 *
 * `.side-bar:hover` answers that with `z-index: 100` and says so in a comment.
 * What broke was a SECOND rule, added for an unrelated reason —
 * `:root.fa-has-fullwidth .side-bar { z-index: auto }`, to let a panel escape
 * over a full-bleed figure. At (0,3,0) against the hover rule's (0,2,0) it won
 * the cascade in EVERY state, so on any page that auto-expands a figure the
 * nav opened behind the page. Measured on `/guides/document-ingestion.html`, which
 * expands 4 of its 5 figures: `elementFromPoint` inside the opened column
 * returned page content, not the nav.
 *
 * ## Why this is a text check and not a browser one
 *
 * The defect needs the THEME's stacking context to appear, and
 * `remote_theme` resolves on the runner — the compiled selectors are not in
 * this checkout, and every e2e spec here builds a fixture rather than a Jekyll
 * site. The rendered result CAN be reached, by the gh-pages route this file's
 * header now describes, and the fix was verified that way -- but a 90 MB
 * extract and a browser do not belong in the fast gate set, and they check a
 * PARTICULAR BUILD rather than the rule. What belongs here is the invariant
 * the defect violated, over the stylesheet itself.
 *
 * ## What it does NOT claim
 *
 * Not that 100 is the right number, and not that the sidebar wins against
 * every possible z-index in `.main` — both are rendering questions this check
 * cannot reach. It claims one thing: no rule may leave `.side-bar` unable to
 * rise above the page, which is what `auto` and any smaller value do.
 */
describe("no rule may stop the sidebar rising above `.main` (bean `vfr8`)", () => {
  const css = read("cat-harness/site-chrome/assets/css/docs-ui.css");

  /** Declarations whose SUBJECT is `.side-bar`, not a descendant of it. */
  const sidebarZRules = (): { selector: string; value: string }[] => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const out: { selector: string; value: string }[] = [];
    for (const m of bare.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const body = m[2]!;
      const z = /(?<![\w-])z-index\s*:\s*([^;!}]+)/.exec(body);
      if (!z) continue;
      for (const sel of m[1]!.split(",")) {
        const s = sel.trim();
        if (!s) continue;
        // The LAST compound decides the subject: `.side-bar .fa-nav-close`
        // styles a descendant and is none of this check's business.
        const last = s.split(/\s+|>(?![^(]*\))/).filter(Boolean).pop() ?? "";
        if (/\.side-bar(?![\w-])/.test(last)) out.push({ selector: s, value: z[1]!.trim() });
      }
    }
    return out;
  };

  it("every `z-index` on the sidebar itself is a number at or above the open-nav value", () => {
    const rules = sidebarZRules();
    // A sweep that matched nothing would pass silently — the `dh4f` shape in a
    // test. Two rules are known to exist: the hover one and the full-width one.
    expect(rules.length).toBeGreaterThanOrEqual(2);

    const open = rules.find((r) => /:hover/.test(r.selector));
    expect(open).toBeDefined();
    const floor = Number(open!.value);
    expect(Number.isFinite(floor)).toBe(true);

    const offenders = rules.filter((r) => !Number.isFinite(Number(r.value)) || Number(r.value) < floor);
    expect(offenders).toEqual([]);
  });

  it("`auto` in particular is refused — it is what the defect actually was", () => {
    // Stated separately because `Number("auto")` is NaN and would be caught
    // above by accident. This says the thing on purpose, so a future reader
    // sees the exact value that broke it rather than inferring it.
    expect(sidebarZRules().filter((r) => r.value === "auto")).toEqual([]);
  });
});
