/**
 * Theme-art intake: every refusal proved to fire, and the reader proved on real files.
 *
 * The constraints were derived from failures this repository actually took, so
 * the tests are written the same way round: each one names the commit or the
 * declaration that is the live example, and the reader is checked against art
 * already on disk rather than only against fixtures it was written beside.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  HEAVY_IMAGE_BYTES,
  LAYOUT_ASPECT_BANDS,
  THEME_ART_LAYOUTS,
  contentDigest,
  formatIntakeReport,
  ingestThemeArt,
  measureImage,
  type ArtCandidate,
} from "./theme-art-intake.js";
import { CatHarnessDeclarationSchema, declarationPathIn } from "../kg/cat-harness.js";
import { THEME_LAYOUTS, type ThemeLayout } from "../ui/theme.js";

import { requireHarnessRoot } from "../harness-root.ts";
const INSTANCE = requireHarnessRoot();

/** A synthetic PNG header with the dimensions asked for. Enough to measure. */
function png(width: number, height: number, pad = 0): Uint8Array {
  const b = new Uint8Array(24 + pad);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(b.buffer).setUint32(16, width, false);
  new DataView(b.buffer).setUint32(20, height, false);
  // Pad bytes stay zero, which keeps two different sizes distinguishable by
  // digest only through their length — so the padding is varied where a test
  // needs two files that differ.
  if (pad > 0) b[24] = pad & 0xff;
  return b;
}

/** Shapes that sit inside each band, so a test varies one thing at a time. */
const GOOD: Record<ThemeLayout, [number, number]> = {
  laptop: [1671, 941],
  mobile: [941, 1670],
  card: [1254, 1254],
};

function candidates(
  over: Partial<Record<ThemeLayout, Uint8Array | null>> = {},
): ArtCandidate[] {
  const out: ArtCandidate[] = [];
  for (const [i, layout] of THEME_ART_LAYOUTS.entries()) {
    if (over[layout] === null) continue;
    const [w, h] = GOOD[layout];
    out.push({
      layout,
      sourcePath: `uploads/${layout}.png`,
      // Distinct padding per layout, so the good case is not accidentally
      // identical content — which would make the duplicate test pass for free.
      bytes: over[layout] ?? png(w, h, i + 1),
    });
  }
  return out;
}

const OK_INPUT = {
  role: "landing-engineer",
  destinationDir: "docs/assets/img/harness",
  declaredDirectories: ["docs/", "uploads/", "library/"],
};

describe("the happy path emits a declaration rather than accepting one", () => {
  test("three good layouts are accepted", () => {
    const r = ingestThemeArt({ ...OK_INPUT, candidates: candidates() });
    expect(r.ok).toBe(true);
  });

  test("the dimensions are MEASURED — the caller never supplies them", () => {
    // The 1px drift: `landing-engineer` is declared 1672x941 where its siblings
    // are 1671x941, because the numbers were composed by copying a neighbour.
    // Intake takes bytes and emits the declaration, so there is nowhere for a
    // retyped number to enter.
    const r = ingestThemeArt({ ...OK_INPUT, candidates: candidates() });
    if (!r.ok) throw new Error("expected acceptance");
    const laptop = r.images.find((i) => i.layout === "laptop")!;
    expect([laptop.width, laptop.height]).toEqual(GOOD.laptop);
  });

  test("one declaration per layout, under the requested role", () => {
    const r = ingestThemeArt({ ...OK_INPUT, candidates: candidates() });
    if (!r.ok) throw new Error("expected acceptance");
    expect(r.images.map((i) => i.layout).sort()).toEqual([...THEME_ART_LAYOUTS].sort());
    expect(new Set(r.images.map((i) => i.role))).toEqual(new Set(["landing-engineer"]));
  });

  test("`src` lands under the destination and carries the measured format", () => {
    const r = ingestThemeArt({ ...OK_INPUT, candidates: candidates() });
    if (!r.ok) throw new Error("expected acceptance");
    for (const i of r.images) {
      expect(i.src.startsWith("docs/assets/img/harness/")).toBe(true);
      expect(i.src.endsWith(".png")).toBe(true);
    }
  });
});

describe("a missing layout is refused — the landing-architecture case", () => {
  test("two of three is not two thirds of a backdrop", () => {
    const r = ingestThemeArt({ ...OK_INPUT, candidates: candidates({ mobile: null }) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failures.map((f) => f.kind)).toContain("missing-layout");
    expect(r.failures.find((f) => f.kind === "missing-layout")!.layout).toBe("mobile");
  });

  test("the remedy says WHY, not just what", () => {
    const r = ingestThemeArt({ ...OK_INPUT, candidates: candidates({ mobile: null }) });
    if (r.ok) throw new Error("expected refusal");
    // `resolveThemeBackdrop` refuses an incomplete backdrop wholesale, so the
    // theme renders with NO art. Somebody who thinks they shipped two thirds
    // has shipped none, and the remedy has to say so.
    expect(r.failures.find((f) => f.kind === "missing-layout")!.remedy).toContain("NO art");
  });

  test("the live case is CLOSED — architecture now declares all three", () => {
    // `landing-architecture` was declared with laptop and card only from
    // 2026-09-20 until the owner supplied the portrait crop on 2026-09-24.
    // Asserted as complete now, so the incident cannot silently return.
    const decl = CatHarnessDeclarationSchema.parse(
      JSON.parse(readFileSync(declarationPathIn(INSTANCE)!, "utf8")),
    );
    const arch = (decl.images ?? []).filter((i) => i.role === "landing-architecture");
    const layouts = new Set(arch.map((i) => i.layout));
    expect([...layouts].sort()).toEqual(["card", "laptop", "mobile"]);
  });
});

describe("byte-identical files are refused — the 1b62b57 case", () => {
  test("the same bytes under two layouts is a refusal, not a warning", () => {
    // Commit 1b62b57 supplied three files for three avatars of which two were
    // byte-identical: 2 distinct images for 3 named roles. Three layouts exist
    // BECAUSE they are different crops, so intake cannot tell which name is
    // wrong.
    const same = png(1254, 1254, 7);
    const r = ingestThemeArt({
      ...OK_INPUT,
      candidates: candidates({ card: same, mobile: same }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failures.map((f) => f.kind)).toContain("identical-content");
  });

  test("the digest distinguishes files that differ only in length", () => {
    expect(contentDigest(png(10, 10, 1))).not.toBe(contentDigest(png(10, 10, 2)));
  });

  test("and agrees with itself", () => {
    expect(contentDigest(png(10, 10, 3))).toBe(contentDigest(png(10, 10, 3)));
  });
});

describe("orientation is checked, because a crop is not a scale", () => {
  test("a landscape file offered as `mobile` is refused", () => {
    const r = ingestThemeArt({ ...OK_INPUT, candidates: candidates({ mobile: png(1671, 941, 9) }) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const f = r.failures.find((x) => x.kind === "wrong-orientation")!;
    expect(f.layout).toBe("mobile");
    expect(f.detail).toContain("1671");
  });

  test("a portrait file offered as `laptop` is refused", () => {
    const r = ingestThemeArt({ ...OK_INPUT, candidates: candidates({ laptop: png(941, 1670, 9) }) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failures.some((f) => f.kind === "wrong-orientation" && f.layout === "laptop")).toBe(true);
  });

  test("a non-square file offered as `card` is refused", () => {
    const r = ingestThemeArt({ ...OK_INPUT, candidates: candidates({ card: png(1600, 900, 9) }) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failures.some((f) => f.kind === "wrong-orientation" && f.layout === "card")).toBe(true);
  });

  test("the bands accept EVERY layout this repository already ships", () => {
    // The falsifier for the bands themselves. A band tight enough to look
    // rigorous but which refuses shipped art is a band that will be widened in
    // a hurry by whoever hits it next, with no record of why.
    const decl = CatHarnessDeclarationSchema.parse(
      JSON.parse(readFileSync(declarationPathIn(INSTANCE)!, "utf8")),
    );
    const shipped = (decl.images ?? []).filter(
      (i) => i.width && i.height && THEME_LAYOUTS.some((l) => l === i.layout),
    );
    expect(shipped.length).toBeGreaterThan(8);
    const refused: string[] = [];
    for (const i of shipped) {
      const band = LAYOUT_ASPECT_BANDS[i.layout as ThemeLayout];
      const aspect = i.width! / i.height!;
      if (aspect < band.min || aspect > band.max) {
        refused.push(`${i.role}/${i.layout} ${i.width}x${i.height} aspect ${aspect.toFixed(2)}`);
      }
    }
    expect(refused).toEqual([]);
  });
});

describe("the destination must be declared — the 0301fbd2 case", () => {
  test("art destined for the repository root is refused", () => {
    // Three PNGs sat at the repository root, undeclared, with spaces and commas
    // in their names, and no gate saw them: check-declared-assets walks
    // declared -> disk, and the root is not an instance.
    const r = ingestThemeArt({ ...OK_INPUT, destinationDir: ".", candidates: candidates() });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failures.map((f) => f.kind)).toContain("undeclared-destination");
  });

  test("a subdirectory of a declared directory is accepted", () => {
    const r = ingestThemeArt({
      ...OK_INPUT,
      destinationDir: "uploads/incoming/art",
      candidates: candidates(),
    });
    expect(r.ok).toBe(true);
  });

  test("a trailing slash does not change the answer", () => {
    const r = ingestThemeArt({
      ...OK_INPUT,
      destinationDir: "uploads/",
      declaredDirectories: ["uploads"],
      candidates: candidates(),
    });
    expect(r.ok).toBe(true);
  });

  test("a sibling that merely shares a prefix is NOT inside", () => {
    // `uploads-old/` starts with `uploads` as a string but is a different
    // directory. Matching on the string alone is the classic version of this
    // bug.
    const r = ingestThemeArt({
      ...OK_INPUT,
      destinationDir: "uploads-old",
      declaredDirectories: ["uploads"],
      candidates: candidates(),
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failures.map((f) => f.kind)).toContain("undeclared-destination");
  });
});

describe("weight and format are REPORTED, not refused", () => {
  test("a heavy file is accepted with a warning", () => {
    // It renders correctly; it just costs the reader. Refusing would block art
    // that works over a judgement about bandwidth.
    const heavy = png(1254, 1254, HEAVY_IMAGE_BYTES + 10);
    const r = ingestThemeArt({ ...OK_INPUT, candidates: candidates({ card: heavy }) });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.kind === "heavy" && w.layout === "card")).toBe(true);
  });

  test("png is accepted, with webp named as preferred", () => {
    const r = ingestThemeArt({ ...OK_INPUT, candidates: candidates() });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.kind === "heavy")).toBe(false);
    expect(r.warnings.some((w) => w.kind === "not-preferred-format")).toBe(true);
  });

  test("the heavy budget sits clear of both measured cases", () => {
    // ~100 KB webp siblings, ~1.6 MB arriving PNGs. A budget inside either
    // would fire on good art or miss the bad.
    expect(HEAVY_IMAGE_BYTES).toBeGreaterThan(150_000);
    expect(HEAVY_IMAGE_BYTES).toBeLessThan(1_000_000);
  });
});

describe("an unreadable file is reported, never guessed", () => {
  test("bytes that are not PNG or WebP are refused", () => {
    const r = ingestThemeArt({
      ...OK_INPUT,
      candidates: candidates({ card: new Uint8Array([1, 2, 3, 4, 5]) }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failures.map((f) => f.kind)).toContain("unreadable");
  });

  test("`measureImage` returns undefined rather than a guess", () => {
    expect(measureImage(new Uint8Array([0, 0, 0, 0]))).toBeUndefined();
    expect(measureImage(new Uint8Array(0))).toBeUndefined();
  });
});

describe("the reader is checked against art actually on disk", () => {
  // Fixtures the reader was written beside can agree with a wrong reader. These
  // are the files the site ships.
  const decl = CatHarnessDeclarationSchema.parse(
    JSON.parse(readFileSync(declarationPathIn(INSTANCE)!, "utf8")),
  );
  const shipped = (decl.images ?? []).filter((i) => i.src && i.width && i.height);

  test("there is real art to check", () => {
    expect(shipped.length).toBeGreaterThan(8);
  });

  test("every declared width and height matches the file's own header", () => {
    // This is the 1px-drift check turned around: instead of trusting the
    // declaration, read the files and compare. A mismatch is a false
    // declaration, whichever side is wrong.
    const mismatched: string[] = [];
    const unread: string[] = [];
    for (const img of shipped) {
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(readFileSync(join(INSTANCE, img.src)));
      } catch {
        unread.push(img.src);
        continue;
      }
      const m = measureImage(bytes);
      if (!m) {
        unread.push(img.src);
        continue;
      }
      if (m.width !== img.width || m.height !== img.height) {
        mismatched.push(`${img.src}: declared ${img.width}x${img.height}, file ${m.width}x${m.height}`);
      }
    }
    // Reported separately: "could not read" is never the same answer as
    // "matched", and folding them would let an unreadable file read as clean.
    expect({ mismatched, unread }).toEqual({ mismatched: [], unread: [] });
  });
});

describe("the report is the explanation, not the word `invalid`", () => {
  test("every failure carries a remedy", () => {
    const r = ingestThemeArt({
      ...OK_INPUT,
      destinationDir: ".",
      candidates: candidates({ mobile: null }),
    });
    if (r.ok) throw new Error("expected refusal");
    expect(r.failures.length).toBeGreaterThan(1);
    for (const f of r.failures) expect(f.remedy.length).toBeGreaterThan(20);
  });

  test("ALL failures are collected, not just the first", () => {
    // Art arrives as a batch. Reporting one problem at a time means three round
    // trips to learn three things.
    const r = ingestThemeArt({
      ...OK_INPUT,
      destinationDir: ".",
      candidates: candidates({ mobile: null }),
    });
    if (r.ok) throw new Error("expected refusal");
    expect(new Set(r.failures.map((f) => f.kind)).size).toBeGreaterThan(1);
  });

  test("the formatted report names the kind, the detail and the remedy", () => {
    const r = ingestThemeArt({ ...OK_INPUT, candidates: candidates({ mobile: null }) });
    const text = formatIntakeReport(r, "landing-engineer");
    expect(text).toContain("missing-layout");
    expect(text).toContain("mobile");
    expect(text).toContain("→");
  });

  test("a successful report lists what was accepted", () => {
    const text = formatIntakeReport(
      ingestThemeArt({ ...OK_INPUT, candidates: candidates() }),
      "landing-engineer",
    );
    expect(text).toContain("accepted");
    for (const l of THEME_ART_LAYOUTS) expect(text).toContain(l);
  });
});
