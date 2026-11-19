/**
 * The inline PDF viewer: Mozilla's pdf.js generic viewer, pinned, installed
 * into a built site, and a fragment that embeds it on a page — search,
 * scroll, jump to page, print and download. The skill is
 * `ui-core/pdf-inline-viewer`; the Tool node is `pdf_viewer_embed`.
 *
 * ## Why the generic viewer and not the browser's own
 *
 * An `<iframe src="x.pdf">` works on desktop Chromium and Firefox, but iOS
 * Safari shows page one as an image and Android Chrome downloads the file.
 * The generic viewer gives the same features on every engine, from one set of
 * bytes.
 *
 * ## Installed at BUILD time, never committed
 *
 * {@link install} puts the pruned viewer (~12 MB) into `_site/` from a
 * release whose SHA-256 is written below, so it costs the site and not every
 * clone; the pin is one line that `upstream-pins.json` reads (`pdfjs` entry).
 *
 * ## The cross-origin open, and why it carries an allowlist
 *
 * The PDFs these pages show are served from a CDN, not from Pages. The
 * generic viewer refuses a cross-origin `?file=` (`validateFileURL` in
 * `web/viewer.mjs`), so a hosted viewer cannot be pointed at an arbitrary
 * document and lend it the host's address. So the shim
 * {@link openShim} opens `?src=` ONLY when it starts with a prefix the BUILD
 * named (`--allow`), plus the viewer's own origin. Every other value is
 * refused on screen, never opened. The prefixes are a caller's fact — the
 * workflow passes its own repository owner — so no folio's host is written
 * into the platform.
 *
 * ## The site root is derived in the browser
 *
 * As in `folio-mount.ts`, which this reuses: one generated page is served at
 * several depths (`/<instance>/`,
 * `/folio-assistant/<instance>/`, `/branches/<branch>/<instance>/`), so a relative
 * or absolute viewer URL is right on at most one of them. The caller passes
 * the route pattern; `siteRootOf` and the inlined client apply the same one.
 *
 * @covers none — a build step that installs third-party bytes, not an audit of a declared graph
 */

import { createHash } from "crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

/** The pinned pdf.js release. `upstream-pins.json` reads this line by pattern. */
export const PDFJS_VERSION = "6.5.438";

/**
 * SHA-256 of `pdfjs-<version>-legacy-dist.zip`, measured 2026-11-01 (v6.5.438). A
 * mismatch refuses the install.
 *
 * **The LEGACY build, on purpose.** The modern build calls
 * `Map.prototype.getOrInsertComputed`, which Chromium 140 does not have:
 * measured here, the viewer threw `getOrInsertComputed is not a function`
 * during startup and never opened the document. The legacy build carries its
 * polyfills, so a reader one browser release behind still gets a viewer.
 */
export const PDFJS_SHA256 = "55138aa33b5f1f6f68809895338b947f395f344eb6381d424b2420d6daa6a844";

export const PDFJS_ZIP_URL = `https://github.com/mozilla/pdf.js/releases/download/v${PDFJS_VERSION}/pdfjs-${PDFJS_VERSION}-legacy-dist.zip`;

/** Where the viewer lands, relative to the SITE ROOT. */
export const VIEWER_DIR = "assets/vendor/pdfjs";
export const VIEWER_PATH = `${VIEWER_DIR}/web/viewer.html`;

/**
 * Whether a site-relative path is inside the installed viewer — Mozilla's
 * bytes, which the site's own post-build passes (minify, id uniqueness) leave
 * alone rather than rewrite or judge.
 */
export function isVendoredViewer(siteRelative: string): boolean {
  return siteRelative.split(/[\\/]/).join("/").startsWith(`${VIEWER_DIR}/`);
}

/** The shim's filename, beside `viewer.html`. */
export const SHIM_FILE = "folio-open.js";

/** The marker an embed carries, so a gate can ask for it rather than for its text. */
export const MARKER = "data-fa-pdf-viewer";

/**
 * What of the release the site needs. Everything else — source maps (8.8 MB),
 * the sample PDF, the debugger — is a cost nothing reads.
 *
 * `locale/` stays whole (3.3 MB): the viewer picks a language from the
 * reader's browser, and a pruned list is a reader whose language silently
 * fell back to English.
 */
export const KEEP: readonly string[] = [
  "LICENSE",
  // input-site: inert #2a1b588a — a path inside the downloaded pdf.js archive, not in this tree
  "build/pdf.mjs",
  // input-site: inert #3109a261 — a path inside the downloaded pdf.js archive, not in this tree
  "build/pdf.worker.mjs",
  // input-site: inert #aa1ecccc — a path inside the downloaded pdf.js archive, not in this tree
  "build/pdf.sandbox.mjs",
  "web/viewer.html",
  "web/viewer.mjs",
  "web/viewer.css",
  "web/images",
  "web/locale",
  "web/cmaps",
  "web/standard_fonts",
  "web/wasm",
  "web/iccs",
];

/**
 * The opening shim, as a classic script that runs before the viewer's module
 * scripts (modules are deferred). Exported as a builder so the test runs the
 * shipped bytes against the allowlist rather than a copy of the rule.
 */
export function openShim(allow: readonly string[]): string {
  return `/* GENERATED by cat-harness/scripts/pdf-viewer.ts — opens ?src= when it matches a build-time allowlist. */
(function () {
  "use strict";
  var ALLOW = ${JSON.stringify([...allow])};
  var src = new URLSearchParams(location.search).get("src");
  function allowed(href) {
    var u;
    try { u = new URL(href, location.href); } catch (e) { return null; }
    if (u.protocol !== "https:" && u.origin !== location.origin) return null;
    if (u.origin === location.origin) return u.href;
    for (var i = 0; i < ALLOW.length; i++) if (u.href.indexOf(ALLOW[i]) === 0) return u.href;
    return null;
  }
  function refuse(msg) {
    var c = document.getElementById("viewerContainer");
    var p = document.createElement("p");
    p.id = "folio-open-refused";
    p.setAttribute("role", "alert");
    p.style.cssText = "margin:2rem;font:1rem/1.5 system-ui,sans-serif;color:CanvasText;background:Canvas;padding:1rem;border:1px solid";
    p.textContent = msg;
    (c || document.body).prepend(p);
  }
  // pdf.js dispatches this on PARENT.document when the frame is same-origin
  // with its host page, and on its own document otherwise — measured at
  // v6.4.299 and v6.5.438, \`webViewerLoad\`. An embed on this site is exactly the
  // same-origin case, so listening on \`document\` alone never fires.
  var done = false;
  function onLoaded(e) {
    if (done || (e.detail && e.detail.source && e.detail.source !== window)) return;
    done = true;
    var opts = window.PDFViewerApplicationOptions;
    // No sample document: an empty viewer is honest, the tracemonkey paper is not.
    opts.set("defaultUrl", "");
    var app = window.PDFViewerApplication;
    app.initializedPromise.then(function () {
      if (!src) return;
      var href = allowed(src);
      if (!href) { refuse("This viewer opens only documents this site publishes. Refused: " + src); return; }
      // pdf.js shows NOTHING on screen when the fetch fails: "0 of 0" and a
      // console line (v6.4.299). A 403 from a CDN read as an empty viewer
      // (owner, 2026-10-15, on the IRIS replica). Say it, with the document's address.
      var opened = app.open({ url: href });
      if (opened && typeof opened.catch === "function") {
        opened.catch(function (err) {
          var m = err && err.message ? String(err.message) : "unknown error";
          refuse("This document could not be loaded (" + m + "). Open it directly: " + href);
        });
      }
    });
  }
  document.addEventListener("webviewerloaded", onLoaded);
  try { if (parent !== window) parent.document.addEventListener("webviewerloaded", onLoaded); } catch (e) { /* cross-origin host: the event comes to this document */ }
})();
`;
}

/** The viewer page, with the shim loaded ahead of the viewer's own modules. */
export function patchViewerHtml(html: string): string {
  const anchor = `<script src="../build/pdf.mjs" type="module"></script>`;
  if (!html.includes(anchor)) {
    throw new Error(
      `pdf-viewer: viewer.html no longer carries \`${anchor}\`. The release layout moved — ` +
        `re-measure the integration before bumping PDFJS_VERSION rather than shipping a viewer that ignores ?src=.`,
    );
  }
  return html.replace(anchor, `<script src="${SHIM_FILE}?v=${VIEWER_REV}"></script>\n${anchor}`);
}

/**
 * A short tag for the installed viewer's OWN bytes: the pinned release plus
 * the shim and the patch this file writes. It changes whenever either does,
 * and goes on the shim's `<script src>` so a reader's cached shim cannot
 * outlive a change to it.
 *
 * Owner, 2026-10-04, after a hard reload still showed a pre-fix frame: *"add
 * the version tag so cache doesn't bite"*. GitHub Pages serves with
 * `max-age=600` through a CDN, so a reload can be answered from a copy up to
 * ten minutes old.
 */
export const VIEWER_REV: string = createHash("sha256")
  .update(PDFJS_SHA256)
  .update(openShim.toString())
  .update(patchViewerHtml.toString())
  .digest("hex")
  .slice(0, 10);

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Install the viewer into `<site>/assets/vendor/pdfjs/`.
 *
 * `zip` is a local copy of the release when the caller has one (tests,
 * offline runs); otherwise it is fetched. Either way the hash is checked
 * before a byte is extracted.
 */
export async function install(opts: { site: string; allow: readonly string[]; zip?: string }): Promise<string> {
  const bytes = opts.zip
    ? new Uint8Array(readFileSync(opts.zip))
    : new Uint8Array(await (await fetchOrThrow(PDFJS_ZIP_URL)).arrayBuffer());
  const got = sha256(bytes);
  if (got !== PDFJS_SHA256) {
    throw new Error(`pdf-viewer: ${PDFJS_ZIP_URL} hashed ${got}, pinned ${PDFJS_SHA256}. Refusing to install.`);
  }
  // input-site: traced #b1917bb3 — a work directory for the download
  inputSiteReached("pdf-viewer: tmpdir");
  const work = mkdtempSync(join(tmpdir(), "pdfjs-"));
  try {
    const zipPath = join(work, "pdfjs.zip");
    writeFileSync(zipPath, bytes);
    // input-site: traced #f9d79865 — unpacks the download
    inputSiteReached("pdf-viewer: unzip");
    const unzip = spawnSync("unzip", ["-q", zipPath, "-d", join(work, "x")], { stdio: "inherit" });
    if (unzip.status !== 0) throw new Error("pdf-viewer: unzip failed");
    const out = join(opts.site, VIEWER_DIR);
    rmSync(out, { recursive: true, force: true });
    for (const rel of KEEP) {
      const from = join(work, "x", rel);
      if (!existsSync(from)) throw new Error(`pdf-viewer: release has no ${rel}. Re-measure KEEP before bumping the pin.`);
      cpSync(from, join(out, rel), { recursive: true });
    }
    const viewer = join(out, "web/viewer.html");
    writeFileSync(viewer, patchViewerHtml(readFileSync(viewer, "utf8")));
    writeFileSync(join(out, "web", SHIM_FILE), openShim(opts.allow));
    return out;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function fetchOrThrow(url: string): Promise<Response> {
  // input-site: traced #f91418c6 — downloads pdf.js
  inputSiteReached("pdf-viewer: network");
  const r = await fetch(url);
  if (!r.ok) throw new Error(`pdf-viewer: GET ${url} → ${r.status}`);
  return r;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type EmbedOptions = {
  /** The PDF's URL. Must fall under an allowlisted prefix at install time, or the viewer refuses it. */
  src: string;
  /** What the document is — the iframe's accessible name. */
  title: string;
  /**
   * Where the viewer is. Either the route pattern whose group 1 is the site
   * root (`folio-mount.ts`'s convention), for a page served at more than one
   * depth, or the viewer's href relative to the page, when the writer already
   * knows it (the library's entry pages: `hrefFrom(shellDir, VIEWER_PATH)`).
   */
  route: RegExp | { viewer: string };
  /** Open at this page (1-based). */
  page?: number;
  /** CSS height of the frame. */
  height?: string;
};

/**
 * The embed: a frame the inlined client points at `<root>/assets/vendor/pdfjs/web/viewer.html?src=…`,
 * and beneath it the two plain links that work without it.
 *
 * The links are not a fallback that appears on failure — they are always
 * there. A frame that 404s because the route did not match, or because the
 * build did not install the viewer, is otherwise an empty box; the reader
 * still has the document one click away, and the frame says why it is empty.
 */
export function embed(o: EmbedOptions): string {
  const hash = o.page && o.page > 1 ? `#page=${Math.floor(o.page)}` : "";
  const height = o.height ?? "80vh";
  return `<figure class="pdf-viewer" ${MARKER} style="margin:1rem 0">
<iframe title="${esc(o.title)} (PDF viewer)" data-src="${esc(o.src)}" data-hash="${esc(hash)}"
  style="width:100%;height:${esc(height)};border:1px solid #ccc" loading="lazy"
  allow="fullscreen" src="about:blank"></iframe>
<figcaption style="font-size:.9em">Search, page jump, print and download are in the viewer's toolbar.
  <a href="${esc(o.src)}" target="_blank" rel="noopener">Open the PDF on its own</a>
  &middot; <a href="${esc(o.src)}" download>Download</a></figcaption>
<script>${client(o.route instanceof RegExp ? { pattern: o.route.source } : { viewer: o.route.viewer })}</script>
</figure>`;
}

/**
 * The browser half of {@link embed}: derive the root, then point the frame at
 * the viewer when it comes within 200px of the viewport — not before.
 *
 * **Inside a closed `<details>`, not until it is opened** (owner, 2026-10-16:
 * *"wait on pdf viewer (or other viewer) library to load until panel opens so
 * page load is not heavy"*). The library's entry pages put the source in a
 * view panel under the heading, so it is in view on load; the observer alone
 * would fetch the viewer for every visitor. A frame in an open `<details>`, or
 * in none, is unchanged.
 *
 * Lazy by an observer rather than by `loading="lazy"` alone, because the
 * attribute's behaviour on a script-assigned `src` differs across engines,
 * and the viewer plus its worker is ~3 MB a reader who never scrolls that far
 * should not pay. Owner, 2026-10-04: *"lazyload"*.
 *
 * **The frame's address carries `&v=<rev>.<deploy>`.** `<rev>` is
 * {@link VIEWER_REV}; `<deploy>` is the HOST page's `document.lastModified`,
 * which GitHub Pages sets from the deploy. So the frame is exactly as fresh as
 * the page around it: a reader who sees the new page cannot get last deploy's
 * viewer from cache — the defect the owner hit on the first staging preview,
 * where a fixed `viewer.html` was masked by a cached one. The viewer ignores
 * the parameter; only caches see it.
 */
function client(at: { pattern: string } | { viewer: string }): string {
  const viewer = "viewer" in at
    ? `var v=${JSON.stringify(at.viewer)};`
    : `var m=location.pathname.match(new RegExp(${JSON.stringify(at.pattern)}));
if(!m||m[1]==null){f.srcdoc="<p style=\\"font:1rem system-ui\\">The viewer could not find this site's root from the page address. Use the links below.</p>";return;}
var v=m[1]+${JSON.stringify(VIEWER_PATH)};`;
  return `(function(){
var f=document.currentScript.parentNode.querySelector("iframe[data-src]");
if(!f)return;
${viewer}
var lm=Date.parse(document.lastModified);
var url=v+"?src="+encodeURIComponent(f.getAttribute("data-src"))+"&v="+${JSON.stringify(VIEWER_REV)}+"."+(lm>0?lm.toString(36):"0")+f.getAttribute("data-hash");
var d=f.closest?f.closest("details"):null;
if(d&&!d.open){d.addEventListener("toggle",function h(){if(d.open){d.removeEventListener("toggle",h);f.src=url;}});return;}
if(!("IntersectionObserver" in window)){f.src=url;return;}
var io=new IntersectionObserver(function(es){if(es.some(function(e){return e.isIntersecting;})){io.disconnect();f.src=url;}},{rootMargin:"200px"});
io.observe(f);
})();`;
}

function arg(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

function all(argv: string[], flag: string): string[] {
  const out: string[] = [];
  argv.forEach((a, i) => {
    if (a === flag && argv[i + 1]) out.push(argv[i + 1]!);
  });
  return out;
}

/**
 * Two modes, one script — the two Tool nodes `pdf-viewer-install` and
 * `pdf-viewer-embed` in `cat-harness/tools/index.ts`:
 *
 * `bun run cat-harness-tools/scripts/pdf-viewer.ts --site ./_site --allow <prefix> [--allow …] [--zip <file>]`
 *
 * `echo '{"src":…,"title":…,"route":…,"page":3}' | bun run cat-harness-tools/scripts/pdf-viewer.ts --embed`
 * prints the fragment {@link embed} returns, for a generator that is not
 * TypeScript or a person pasting it into a page by hand.
 *
 * Exit 2 on a usage error. An empty allowlist is a usage error, not a
 * default: a viewer that may open only same-origin files is a legitimate
 * build, but it has to be asked for (`--allow same-origin-only`), because
 * forgetting `--allow` would otherwise ship a viewer that refuses every
 * CDN document on every page while the build reports success.
 */
async function main(argv: string[]): Promise<number> {
  if (argv.includes("--embed")) {
    // The options arrive as ONE JSON object on stdin, not as words: a title
    // and a regular expression are free text, and free text on a command line
    // is a shell payload (`check:tools` refuses such a port).
    let o: Partial<EmbedOptions & { route: string }>;
    try {
      o = JSON.parse(await Bun.stdin.text());
    } catch (e) {
      console.error(`pdf-viewer --embed: stdin is not JSON: ${(e as Error).message}`);
      return 2;
    }
    const { src, title, route, page } = o;
    if (typeof src !== "string" || typeof title !== "string" || typeof route !== "string" ||
        (page !== undefined && !(Number.isInteger(page) && page >= 1))) {
      console.error('usage: echo \'{"src":"<pdf-url>","title":"<text>","route":"<regex, group 1 = site root>","page":<n ≥ 1>}\' | pdf-viewer.ts --embed');
      return 2;
    }
    let re: RegExp;
    try {
      re = new RegExp(route);
    } catch (e) {
      console.error(`pdf-viewer --embed: route is not a regular expression: ${(e as Error).message}`);
      return 2;
    }
    console.log(embed({ src, title, route: re, page }));
    return 0;
  }
  const site = arg(argv, "--site");
  const allow = all(argv, "--allow");
  if (!site || allow.length === 0) {
    console.error("usage: pdf-viewer.ts --site <dir> --allow <url-prefix>|same-origin-only [--allow …] [--zip <file>]");
    return 2;
  }
  if (!existsSync(site)) {
    console.error(`pdf-viewer: --site ${site} does not exist`);
    return 2;
  }
  const prefixes = allow.filter((a) => a !== "same-origin-only");
  for (const p of prefixes) {
    if (!/^https:\/\/[^/]+\/.+\/$/.test(p)) {
      console.error(`pdf-viewer: --allow ${p} must be an https URL prefix with a path, ending in "/"`);
      return 2;
    }
  }
  const out = await install({ site, allow: prefixes, zip: arg(argv, "--zip") });
  const files = countFiles(out);
  console.log(`pdf-viewer: pdf.js ${PDFJS_VERSION} → ${out} (${files} files); opens same-origin${prefixes.length ? ` + ${prefixes.join(", ")}` : " only"}`);
  return 0;
}

function countFiles(dir: string): number {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) n += e.isDirectory() ? countFiles(join(dir, e.name)) : 1;
  return n;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
