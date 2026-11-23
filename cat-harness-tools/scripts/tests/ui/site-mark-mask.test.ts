/**
 * The site mark's mask, and the one number that can silently disagree again.
 *
 * Bean `nwrm`. The defect being fixed was two colour vocabularies for one
 * layer: `cat-harness` declared tone **268** while its mark was sage
 * (~hue 100), because the mark's colours were baked into an SVG that no CSS
 * could reach. The mask form takes its colour from CSS — so the hue now lives
 * in `docs-ui.css` as a literal, and a literal is exactly what drifted before.
 *
 * These assert the join rather than the values: the stylesheet's hue must BE
 * the declared tone, and the two schemes must use the avatar generator's own
 * lightness targets rather than a third set invented here.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { avatarFor } from "../../../schemas/content/avatars.js";
import { siteDirFor, siteFileFor } from "../../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const INSTANCE = resolve(HARNESS_ROOT);
const CSS = readFileSync(join(INSTANCE, siteFileFor(INSTANCE, "assets/css/docs-ui.css")), "utf8");
const DECL = JSON.parse(readFileSync(join(INSTANCE, "cat-harness.json"), "utf8")) as {
  images?: { id: string; role?: string; src: string }[];
};

/** Every `hsl(<h> <s>% <l>%)` the masked mark is painted with. */
function markColours(): { hue: number; sat: number; light: number }[] {
  const block = CSS.split(".fa-site-mark--masked");
  // `split` yields the text BEFORE the first occurrence too, which carries no
  // rule — dropping it is what keeps an unrelated `hsl()` elsewhere in the
  // file out of this assertion.
  return block
    .slice(1)
    .flatMap((chunk) => [...chunk.slice(0, 400).matchAll(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/g)])
    .map((m) => ({ hue: Number(m[1]), sat: Number(m[2]), light: Number(m[3]) }));
}

describe("the site mark is themed from the DECLARED tone", () => {
  test("the stylesheet's hue IS cat-harness's avatar tone — not a second number", () => {
    // THE WITNESS. If somebody retones the avatar and not this, the mark goes
    // back to disagreeing with its own layer, which is the whole defect.
    const tone = avatarFor("cat-harness").tone;
    const hues = [...new Set(markColours().map((c) => c.hue))];
    expect(hues.length).toBeGreaterThan(0);
    expect(hues).toEqual([tone]);
  });

  test("both schemes are painted, with the avatar generator's own targets", () => {
    // 46%/34% light and 42%/72% dark are `gen-avatars-css.ts`'s. Inventing a
    // third pair here would remove one colour vocabulary by adding another.
    const cs = markColours();
    expect(cs).toHaveLength(2);
    expect(cs.map((c) => `${c.sat}/${c.light}`).sort()).toEqual(["42/72", "46/34"]);
  });

  test("the mask asset is DECLARED, not just present on disk", () => {
    // A file nothing declares is a file the template cannot reach — the
    // `role: "browser-icon"` failure this repository already paid for.
    const mask = DECL.images?.find((i) => i.role === "mark-mask");
    expect(mask).toBeDefined();
    expect(mask!.src).toContain("cat-mark-mask.svg");
  });

  test("the declared mask file exists and cuts out rather than painting white", () => {
    // The face and whiskers must be HOLES. If they were white fills the mask
    // would show them as opaque and the cat would be a solid blob — the
    // failure mode that looks fine in a diff.
    // `siteDirFor`, never the literal `docs/` — `check:site-root` holds that
    // the site root is one answer, and it caught this exact line.
    const svg = readFileSync(
      join(INSTANCE, siteDirFor(INSTANCE), "assets", "img", "icons", "cat-mark-mask.svg"),
      "utf8",
    );
    expect(svg).toContain("<mask");
    expect(svg).toContain('mask="url(#markMask)"');

    // COMMENTS STRIPPED FIRST, and this test failed without it. The asset's
    // header explains the conversion by NAMING the sage it replaced, so the
    // literal is present in prose and absent from the drawing — which is
    // exactly the state the assertion wants to see, reported as a failure.
    //
    // `translation-badges.e2e.ts` records the same trap twice over, the
    // second time in the same file: *"the slice it matches against includes
    // the comment explaining why … Comments stripped, for the second time in
    // this file and for the same reason."* Third time, different file.
    const drawing = svg.replace(/<!--[\s\S]*?-->/g, "");
    expect(drawing).not.toContain("#6f8b66");
    expect(drawing).not.toContain("#cfe0c2");
    // ...and the premise, so the strip cannot make the case vacuous: the
    // prose DOES still name it.
    expect(svg).toContain("#6f8b66");
  });
});
