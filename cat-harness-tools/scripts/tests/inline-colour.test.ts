/**
 * A colour written into an inline style fails HERE rather than shipping.
 *
 * Bean `folio-assistant-rptk`. The bean was filed against
 * `mountPageLanguageBar()`, that function was fixed, and its sibling
 * `buildLanguageBar()` kept the identical literals and the identical two
 * failing pairs — an unavailable tab at `opacity:0.5` compositing to 1.39:1
 * and a current tab at 3.67:1 — for two days afterwards. Nothing failed,
 * because nothing looks for a literal; the only thing that could have caught
 * it was an axe run over a tile view the gate did not open.
 *
 * ## Why a SOURCE check, when `test/content/a11y.e2e.ts` measures the real pixels
 *
 * axe measures what is on the screen. That is strictly better evidence and
 * strictly worse coverage: it proves the states somebody remembered to put
 * there, and this defect lived in the one state nobody clicked into. This
 * check is the complement — it proves nothing about contrast and everything
 * about WHERE A COLOUR MAY BE WRITTEN, over the whole file at once, including
 * the branches no fixture reaches.
 *
 * Together they say the thing neither says alone: every colour in the client
 * is a token in `docs-ui.css`, every token carries its measured ratio beside
 * it, and the rendered result is measured by axe in both schemes.
 *
 * ## `opacity` is called out by name, and it is not a style preference
 *
 * `skills/ui/ui-core/ui-accessibility.md` names it, and this bean paid for it
 * twice. `opacity` on text composites the glyph toward whatever is behind it,
 * so the colour that reaches the reader is not the colour in the source —
 * `#475569` at `0.5` is `#323f52` on one panel and `#373e4a` on another. A
 * dimmer tab is its own token with its own number. Dimming a whole BOX (an
 * icon, a disabled control's entire subtree) is a different gesture and is
 * only a problem when text is inside it, so this check reads inline styles
 * rather than the stylesheet, where the intent is declared and reviewable.
 *
 * @module scripts/tests/inline-colour.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { siteLayersFor } from "../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
// Every site layer's scripts: since slice 1 of the semantic subgraphs the
// chrome's (`site-chrome/`) and the harness pages' own (`docs/`) are two layers.
const CLIENT_DIRS = siteLayersFor(ROOT).map((l) => join(ROOT, l, "assets/js")).filter((d) => existsSync(d));

/**
 * EVERY client script this site ships, not `docs-ui.js` by name.
 *
 * Naming one file is how this bean happened: the fix landed on one of two
 * functions and the sibling kept the literals. A gate that names its subject
 * repeats that at one level up the moment a second script is added — and
 * `work-plan.js` already exists and is already clean, so the sweep costs
 * nothing today and covers the file nobody has written yet.
 *
 * `vendor/` is excluded: it is third-party code this repo does not author, and
 * a rule about where OUR colours may be written says nothing about it.
 */
function clientScripts(): string[] {
  return CLIENT_DIRS.flatMap((dir) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".js"))
      .map((e) => join(dir, e.name)),
  )
    .sort();
}

/** A hex, `rgb()`/`rgba()`, `hsl()`/`hsla()`, or a named colour declaration. */
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/;

/** The properties whose value IS a colour, written as a CSS declaration. */
const COLOUR_PROP = /\b(color|background(-color)?|border(-[a-z]+)?-color|box-shadow|fill|stroke)\s*:/;

/** A line's worth of inline style, and the way it was written. */
interface Site {
  line: number;
  text: string;
}

/**
 * Lines that put a style ON AN ELEMENT rather than in the stylesheet.
 *
 * Three forms, because all three have shipped here: the `style:` attribute in
 * an `el()` call, a direct `node.style.<prop> =` write, and
 * `setAttribute("style", …)`. Comment lines are skipped — this file's own
 * prose names the literals it removed, and a check that fired on the record of
 * a fix would make writing the record the expensive part.
 */
function inlineStyleSites(source: string): Site[] {
  return source
    .split("\n")
    .map((text, i) => ({ line: i + 1, text }))
    .filter(({ text }) => !/^\s*(\*|\/\/|\/\*)/.test(text))
    .filter(({ text }) =>
      /\bstyle\s*:/.test(text) ||
      /\.style\.[A-Za-z]+\s*=/.test(text) ||
      /setAttribute\(\s*["']style["']/.test(text));
}

/** Of those, the ones that carry a colour or an opacity. */
function offenders(sites: Site[]): Site[] {
  return sites.filter(({ text }) =>
    COLOUR.test(text) || COLOUR_PROP.test(text) || /\bopacity\s*[:=]/.test(text));
}

describe("no colour is written into an inline style in the client", () => {
  test("the detector finds the literals this bean removed", () => {
    // NON-VACUITY, and it has to be synthetic: the check passes at zero, so
    // the file itself can no longer demonstrate that the detector works. These
    // four lines are the exact shapes `buildLanguageBar()` carried on
    // 2026-09-21 — the `pzdv` shape, where a check that matches nothing reads
    // the same as a check over something clean.
    const sample = [
      `        style: "color:#93c5fd;cursor:pointer;"`,
      `        style: "color:#475569;cursor:default;opacity:0.5;"`,
      `          link.addEventListener("mouseenter", function () { link.style.background = "#334155"; });`,
      `        el("div", { style: "background:rgba(59,130,246,0.4)" })`,
    ].join("\n");
    expect(offenders(inlineStyleSites(sample)).map((o) => o.line)).toEqual([1, 2, 3, 4]);
  });

  test("geometry is NOT flagged — a position is not a colour", () => {
    // The client still writes `left`, `top`, `width`, `height`, `zIndex` and
    // `marginLeft` inline, and it must: those are computed per element from a
    // window's geometry and have no token to be. A check that swept them up
    // would be a check somebody switches off.
    const sample = [
      `    panel.style.left = g.left + "px";`,
      `        windowEls[id].style.zIndex = z === undefined ? "" : String(z);`,
      `      scope.style.width = document.documentElement.clientWidth + "px";`,
    ].join("\n");
    expect(offenders(inlineStyleSites(sample))).toEqual([]);
  });

  test("there ARE client scripts, so the sweep is over something", () => {
    // Without this, a move of `assets/js` empties the sweep and it passes over
    // nothing — the `pzdv` shape again, one directory up.
    expect(clientScripts().length).toBeGreaterThan(0);
  });

  test("the client has inline styles at all, so the sweep has a subject", () => {
    const total = clientScripts()
      .reduce((n, f) => n + inlineStyleSites(readFileSync(f, "utf-8")).length, 0);
    expect(total).toBeGreaterThan(3);
  });

  test.each(clientScripts().map((file) => [file.split("/").pop(), file] as const))("%s: none of them carries a colour or an opacity", (_name, file) => {
    // Named with the line and the text, because "3 offenders" does not say
    // which colour or where, and the fix is always a specific token.
    expect(offenders(inlineStyleSites(readFileSync(file, "utf-8")))
      .map((o) => `${o.line}: ${o.text.trim()}`)).toEqual([]);
  });
});
