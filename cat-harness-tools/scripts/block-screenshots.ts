#!/usr/bin/env bun
/**
 * block-screenshots — a picture of each changed VISUAL block on main and on
 * the branch, and how much of it changed.
 *
 * For a figure, a diagram or a table, the markup diff says little; the
 * reviewer needs to SEE before and after. The staging job and the review
 * process call this (the `visual-diff` skill says how).
 *
 * ## No new dependency
 *
 * Screenshots are taken with Playwright, and the comparison runs in
 * Chromium's own canvas: {@link comparePixels} is self-contained and is sent
 * into the page with `toString()`, so the function the unit tests call is the
 * one that runs. Nothing is added to THIRD-PARTY-NOTICES.
 *
 * ## What a block's picture IS
 *
 * The site build writes an empty `<a id="<label>">` before each labelled
 * block, with no wrapping element. So a block's region is from its anchor
 * down to the NEXT anchor, as wide as the anchor's container.
 * {@link blockRegion} computes it in the page.
 *
 * ## What the number means
 *
 * `changed` is the share of pixels, in the larger of the two pictures, that
 * differ by more than a small per-channel tolerance (which absorbs
 * anti-aliasing). A size change counts the uncovered area as changed. The
 * number says HOW MUCH moved, not whether the change is right.
 *
 * ## Output
 *
 * `<out>/visual-diff.json` (`folio-visual-diff/v1`), plus
 * `<out>/visual/<safe label>.{before,after,diff}.png`. A block present on
 * one side only has only that picture. A side whose page or anchor is
 * missing is SAID (`missing`), never drawn as blank.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { PAGE_LOCALE } from "./viewer-declarations.ts";

export const VISUAL_DIFF_SCHEMA = "folio-visual-diff/v1" as const;

/** Block kinds whose change is visual. Kept equal to the `visual` renderer's `defaultFor`. */
export const VISUAL_KINDS = ["figure", "diagram", "table", "equation", "simulator"] as const;

/** Per-channel difference (0–255) below which a pixel counts as unchanged. */
export const PIXEL_TOLERANCE = 24;

export interface VisualSide {
  png: string | null;
  /** Why there is no picture: the page is not in the site, or the anchor is not on the page. */
  missing?: "page" | "anchor";
  width?: number;
  height?: number;
}

export interface VisualEntry {
  label: string;
  kind: string;
  before: VisualSide | null;
  after: VisualSide | null;
  /** Changed pixels over all pixels of the larger picture, 0–1; null when either side has no picture. */
  changed: number | null;
  diff: string | null;
}

export interface VisualDiffFile {
  $schema: typeof VISUAL_DIFF_SCHEMA;
  tolerance: number;
  blocks: Record<string, VisualEntry>;
}

/** The changed blocks worth a picture, in ChangeSet order. */
export function visualChanges(changes: ReadonlyArray<{ change: string; label: string; from?: string; head?: { file: string; kind: string }; base?: { file: string; kind: string } }>) {
  return changes.filter((c) => (VISUAL_KINDS as readonly string[]).includes((c.head ?? c.base)?.kind ?? ""));
}

/**
 * The page a block is on, before the locale: its manifest's first path
 * segment, `<doc>/index.html`, where `build-document-site` wrote it until
 * folio-assistant#2527. {@link pageIn} is the page in a given site.
 */
export function pageOf(at: { file: string } | undefined): string | null {
  const seg = (at?.file ?? "").split("/")[0] ?? "";
  // `.` and `..` match the character class, and would climb out of the site.
  return /^[A-Za-z0-9._-]+$/.test(seg) && !/^\.+$/.test(seg) ? `${seg}/index.html` : null;
}

/**
 * The page a block is on IN `site`: under the locale, `en/<doc>/index.html`
 * (folio-assistant#2527), when that site has it; else `<doc>/index.html`. The
 * before side is main's published site, which keeps the old layout until it
 * is rebuilt, so each side is looked up on its own.
 */
export function pageIn(site: string, at: { file: string } | undefined): string | null {
  const old = pageOf(at);
  if (old === null) return null;
  const localised = `${PAGE_LOCALE}/${old}`;
  return existsSync(join(site, localised)) ? localised : old;
}

/** A file name for a label: labels contain `:`, which a Windows checkout cannot hold. */
export const safeName = (label: string) => label.replace(/[^A-Za-z0-9._-]/g, "_");

/**
 * The block's region in page coordinates, or null when the anchor is not on
 * the page. Self-contained: it runs in the page.
 */
export function blockRegion(label: string): { x: number; y: number; width: number; height: number } | null {
  const a = document.getElementById(label);
  if (!a) return null;
  const anchors = Array.from(document.querySelectorAll("a[id]"));
  const next = anchors[anchors.indexOf(a) + 1] as HTMLElement | undefined;
  const box = (a.parentElement || document.body).getBoundingClientRect();
  const top = a.getBoundingClientRect().top + window.scrollY;
  const bottom = next ? next.getBoundingClientRect().top + window.scrollY : document.documentElement.scrollHeight;
  const height = Math.max(1, Math.min(4000, Math.round(bottom - top)));
  return { x: Math.max(0, Math.round(box.left)), y: Math.max(0, Math.round(top)), width: Math.max(1, Math.round(box.width)), height };
}

/**
 * Compare two RGBA images. Self-contained: it runs in the page, on canvas
 * `ImageData`, and in the unit tests, on plain arrays.
 *
 * Returns the share of changed pixels over the larger canvas, and a diff
 * image: changed pixels opaque magenta, unchanged ones a faded grey of the
 * after picture, so the change stands out without hiding its context.
 */
export function comparePixels(
  a: { data: ArrayLike<number>; width: number; height: number },
  b: { data: ArrayLike<number>; width: number; height: number },
  tolerance: number,
): { changed: number; width: number; height: number; diff: Uint8ClampedArray } {
  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);
  const diff = new Uint8ClampedArray(w * h * 4);
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const inA = x < a.width && y < a.height;
      const inB = x < b.width && y < b.height;
      const ia = (y * a.width + x) * 4;
      const ib = (y * b.width + x) * 4;
      let changed = inA !== inB;
      if (inA && inB) {
        for (let c = 0; c < 4 && !changed; c++) if (Math.abs(a.data[ia + c]! - b.data[ib + c]!) > tolerance) changed = true;
      }
      if (changed) {
        n++;
        diff[o] = 214; diff[o + 1] = 51; diff[o + 2] = 132; diff[o + 3] = 255;
      } else {
        const src = inB ? b.data : a.data;
        const i = inB ? ib : ia;
        const g = Math.round((src[i]! + src[i + 1]! + src[i + 2]!) / 3);
        const faded = Math.round(255 - (255 - g) * 0.25);
        diff[o] = faded; diff[o + 1] = faded; diff[o + 2] = faded; diff[o + 3] = 255;
      }
    }
  }
  return { changed: w * h ? n / (w * h) : 0, width: w, height: h, diff };
}

type Page = import("@playwright/test").Page;

/** Screenshot one side. The page is loaded from `site` (a directory) by file URL. */
async function shoot(page: Page, site: string, rel: string | null, label: string, outPng: string): Promise<VisualSide> {
  if (!rel || !existsSync(join(site, rel))) return { png: null, missing: "page" };
  // A large document's index.html is a shell that loads its text as data
  // (bean v433), which a file URL cannot fetch; its whole text is index.hydrated.html.
  const full = rel.replace(/index\.html$/, "index.hydrated.html");
  await page.goto(pathToFileURL(join(site, full !== rel && existsSync(join(site, full)) ? full : rel)).href);
  const region = await page.evaluate(`(${blockRegion.toString()})(${JSON.stringify(label)})`);
  if (!region) return { png: null, missing: "anchor" };
  const r = region as { x: number; y: number; width: number; height: number };
  await page.screenshot({ path: outPng, clip: r, fullPage: true });
  return { png: outPng, width: r.width, height: r.height };
}

/** Compare two PNG files in the page, and write the diff PNG. */
async function compareInPage(page: Page, before: string, after: string, outPng: string, tolerance: number): Promise<number> {
  const uri = (p: string) => "data:image/png;base64," + readFileSync(p).toString("base64");
  await page.setContent("<!doctype html><title>compare</title>");
  const res = (await page.evaluate(
    `(async () => {
      const compare = ${comparePixels.toString()};
      const load = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
      const read = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height); };
      const [a, b] = await Promise.all([load(${JSON.stringify(uri(before))}), load(${JSON.stringify(uri(after))})]);
      const r = compare(read(a), read(b), ${tolerance});
      const c = document.createElement("canvas"); c.width = r.width; c.height = r.height;
      c.getContext("2d").putImageData(new ImageData(r.diff, r.width, r.height), 0, 0);
      return { changed: r.changed, png: c.toDataURL("image/png") };
    })()`,
  )) as { changed: number; png: string };
  writeFileSync(outPng, Buffer.from(res.png.replace(/^data:image\/png;base64,/, ""), "base64"));
  return res.changed;
}

export async function run(o: { changeset: string; base: string; head: string; out: string; tolerance?: number }): Promise<VisualDiffFile> {
  const cs = JSON.parse(readFileSync(o.changeset, "utf-8")) as { changes: Parameters<typeof visualChanges>[0] };
  const todo = visualChanges(cs.changes);
  const file: VisualDiffFile = { $schema: VISUAL_DIFF_SCHEMA, tolerance: o.tolerance ?? PIXEL_TOLERANCE, blocks: {} };
  const dir = join(o.out, "visual");
  if (todo.length) {
    mkdirSync(dir, { recursive: true });
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, colorScheme: "light" });
      for (const c of todo) {
        const name = safeName(c.label);
        const rel = (p: string) => `visual/${name}.${p}.png`;
        const before = c.change === "added" ? null : await shoot(page, o.base, pageIn(o.base, c.base), c.from ?? c.label, join(o.out, rel("before")));
        const after = c.change === "removed" ? null : await shoot(page, o.head, pageIn(o.head, c.head), c.label, join(o.out, rel("after")));
        let changed: number | null = null;
        let diff: string | null = null;
        if (before?.png && after?.png) {
          changed = await compareInPage(page, before.png, after.png, join(o.out, rel("diff")), file.tolerance);
          diff = rel("diff");
        }
        // Paths in the file are relative to `out`, which is the site root.
        const relSide = (s: VisualSide | null, p: string) => (s ? { ...s, png: s.png ? rel(p) : null } : null);
        file.blocks[c.label] = { label: c.label, kind: (c.head ?? c.base)!.kind, before: relSide(before, "before"), after: relSide(after, "after"), changed, diff };
      }
    } finally {
      await browser.close();
    }
  }
  mkdirSync(o.out, { recursive: true });
  writeFileSync(join(o.out, "visual-diff.json"), JSON.stringify(file, null, 2) + "\n");
  return file;
}

const USAGE = `usage: bun run cat-harness-tools/scripts/block-screenshots.ts
  --changeset <changeset.json> --base <main site dir> --head <preview site dir> --out <site dir>
  --changeset <changeset.json> --count   print how many changed blocks would be pictured, and stop
                                          (so a caller installs a browser only when there is work)
Pictures each changed figure, diagram, table, equation or simulator block on both
sides, and writes <out>/visual-diff.json and <out>/visual/*.png.`;

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const [changeset, base, head, out] = [opt("changeset"), opt("base"), opt("head"), opt("out")];
  if (changeset && args.includes("--count")) {
    console.log(visualChanges(JSON.parse(readFileSync(changeset, "utf-8")).changes).length);
    process.exit(0);
  }
  if (args.includes("--help") || !changeset || !base || !head || !out) {
    console.error(USAGE);
    process.exit(args.includes("--help") ? 0 : 2);
  }
  try {
    const f = await run({ changeset: resolve(changeset), base: resolve(base), head: resolve(head), out: resolve(out) });
    const entries = Object.values(f.blocks);
    const missing = entries.filter((e) => e.before?.missing || e.after?.missing).length;
    console.error(`✓ visual diff: ${entries.length} visual block(s) pictured${missing ? `, ${missing} with a side that could not be pictured` : ""} → ${join(out, "visual-diff.json")}`);
    for (const e of entries) {
      console.error(`  · ${e.label}: ${e.changed === null ? "one side only" : `${(e.changed * 100).toFixed(1)}% of pixels changed`}`);
    }
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
}
