/**
 * A contact sheet of every declared `avatarRegion`, so a person can LOOK.
 *
 * `schemas/avatar-region.test.ts` already refuses a box that is out of bounds,
 * not square in pixels, or unverifiable, but none of that tells whether the
 * box is on the cat. So this tool PRINTS and never gates.
 *
 * The art is inlined as `data:` URIs, so the output is one file that opens
 * anywhere — a review comment, a chat panel, a browser with no server.
 *
 * Usage:  bun run cat avatar:crops [--out <file>]
 *
 * @module scripts/render-avatar-crops
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { readDeclaration, repoRootFor } from "../schemas/kg/cat-harness.js";
import type { ImageRegion } from "../schemas/kg/kg-node.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

export const MEDIA: Readonly<Record<string, string>> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

/** The file as a `data:` URI, or `undefined` when it cannot be read or typed. */
export function dataUri(abs: string): string | undefined {
  const dot = abs.lastIndexOf(".");
  const type = MEDIA[abs.slice(dot).toLowerCase()];
  if (type === undefined || !existsSync(abs)) return undefined;
  return `data:${type};base64,${readFileSync(abs).toString("base64")}`;
}

/**
 * The CSS that clips one image to its region inside a square frame.
 *
 * `background-size` is the inverse of the region — the image is blown up so
 * the region fills the frame — and `background-position` is expressed in the
 * percentage convention, where `p%` aligns the image's `p%` point with the
 * frame's. That is why it is `x / (1 - w)` rather than just `x`, and it is the
 * single arithmetic fact a renderer of this field has to get right.
 */
export function avatarClip(uri: string, r: ImageRegion): string {
  const px = r.w >= 1 ? 50 : (r.x / (1 - r.w)) * 100;
  const py = r.h >= 1 ? 50 : (r.y / (1 - r.h)) * 100;
  return [
    `background-image:url(${uri})`,
    `background-size:${(100 / r.w).toFixed(3)}% ${(100 / r.h).toFixed(3)}%`,
    `background-position:${px.toFixed(3)}% ${py.toFixed(3)}%`,
  ].join(";");
}

function row(
  img: { id: string; src: string; width?: number; height?: number; avatarRegion?: ImageRegion },
  root: string,
): string {
  const r = img.avatarRegion!;
  const uri = dataUri(join(root, img.src));
  if (uri === undefined) {
    return `<tr><td colspan="4"><strong>${img.id}</strong> — could not read <code>${img.src}</code>.
      Not the same as "no box declared": nothing was rendered here and nothing was cleared.</td></tr>`;
  }
  const wPx = img.width === undefined ? undefined : r.w * img.width;
  const hPx = img.height === undefined ? undefined : r.h * img.height;
  const size =
    wPx === undefined || hPx === undefined
      ? "dimensions not declared"
      : `${wPx.toFixed(0)}&times;${hPx.toFixed(0)}px`;
  return `<tr>
    <td>
      <div class="id">${img.id}</div>
      <code>x ${r.x} &nbsp; y ${r.y} &nbsp; w ${r.w} &nbsp; h ${r.h}</code>
      <div class="note">${size}</div>
    </td>
    <td>
      <div class="full">
        <img src="${uri}" alt="">
        <span class="box" style="left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%"></span>
      </div>
    </td>
    <td><div class="avatar big" style="${avatarClip(uri, r)}"></div></td>
    <td><div class="avatar nav" style="${avatarClip(uri, r)}"></div></td>
  </tr>`;
}

export function buildSheet(root: string): { html: string; count: number } {
  const images = (readDeclaration(root)?.images ?? []).filter((i) => i.avatarRegion !== undefined);
  const rows = images.map((i) => row(i, root)).join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Avatar crops</title>
<style>
  :root { color-scheme: light dark; --fg:#16181d; --bg:#fbfbf9; --line:#c9c9c2; --muted:#5d6068; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --fg:#ececee; --bg:#16181d; --line:#3a3d45; --muted:#9a9ea8; }
  }
  body { margin:0; padding:24px 16px; background:var(--bg); color:var(--fg);
         font:15px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .wrap { max-width:940px; margin:0 auto; }
  h1 { font-size:1.5rem; margin:0 0 .25rem; }
  p.lede { color:var(--muted); margin:0 0 1.5rem; max-width:62ch; }
  table { border-collapse:collapse; width:100%; }
  th, td { border-bottom:1px solid var(--line); padding:14px 10px; vertical-align:middle; text-align:left; }
  th { font-size:.78rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); font-weight:600; }
  .id { font-weight:650; margin-bottom:.3rem; }
  code { font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--muted); }
  .note { font-size:.78rem; color:var(--muted); margin-top:.3rem; }
  .full { position:relative; width:150px; }
  .full img { width:100%; display:block; border-radius:6px; }
  .box { position:absolute; border:2px solid #ff3b6b; box-shadow:0 0 0 1px rgba(255,255,255,.75); border-radius:2px; }
  .avatar { border-radius:50%; border:1px solid var(--line); background-repeat:no-repeat; }
  .big { width:120px; height:120px; }
  .nav { width:46px; height:46px; }
  @media (max-width:720px) {
    table, tbody, tr, td, th { display:block; }
    thead { display:none; }
    tr { border-bottom:1px solid var(--line); padding:14px 0; }
    td { border:0; padding:6px 0; }
  }
</style></head><body><div class="wrap">
<h1>Avatar crops</h1>
<p class="lede">Every declared <code>avatarRegion</code>, shown as the box on the card and as the
clip it produces. The schema already guarantees each box is square in pixels and inside the frame;
<strong>what it cannot tell is whether the box is on the cat</strong> — that is what this page is for.
The 46px circle is navbar size.</p>
<table>
  <thead><tr><th>image &amp; box</th><th>on the card</th><th>clipped, 120px</th><th>navbar, 46px</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>
</div></body></html>
`;
  return { html, count: images.length };
}

if (import.meta.main) {
  const root = HARNESS_ROOT;
  const i = process.argv.indexOf("--out");
  const out = resolve(
    i !== -1 ? process.argv[i + 1]! : join(repoRootFor(root), "_kg", "avatar-crops.html"),
  );
  const { html, count } = buildSheet(root);
  if (count === 0) {
    // A determined empty, said out loud. An empty sheet rendered as a clean
    // one is how "no theme declares a crop yet" reads as "every crop is fine".
    console.error("No image declares an avatarRegion. Nothing was rendered — that is not a clean run.");
    process.exit(2);
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`Avatar crops → ${out}\n  ${count} declared region(s)`);
}
