---
name: pdf-inline-viewer
description: >
  Show a published PDF inside a generated page — search, scroll, jump to page,
  print and download — with the pinned pdf.js viewer the site build installs.
  Which two Tools do it, the publication-gate rule that decides whether a page
  may embed a document at all, why the viewer opens only allowlisted hosts, and
  the three pdf.js behaviours that were measured rather than assumed. Read
  before putting a PDF on a page, before bumping the pdf.js pin, and when an
  embedded viewer shows an empty frame.
---

# Inline PDF viewer — a pinned pdf.js, installed at build time

> Skill id: `pdf-inline-viewer` · Package: `ui-core` · Tools
> `pdf-viewer-install`, `pdf-viewer-embed` · Code
> `cat-harness-tools/scripts/pdf-viewer.ts`

A lightweight inline viewer for PDFs on a CDN: search, scroll, jump to page,
print and download. pdf.js is copied onto the built site (not loaded from a
CDN) and loaded lazily.

## The two acts, and which Tool does each

| act | who does it | Tool |
|---|---|---|
| put the viewer into a built site | the site workflow, once per build | `pdf-viewer-install` |
| show one PDF on one page | a page generator, once per page | `pdf-viewer-embed` (TypeScript: `embed()` from `pdf-viewer.ts`) |

`docs-site.yml` and `feature-staging.yml` both run the install right after
`mount-instance-docs.ts`, passing `--allow` for the repository owner's
`cdn.jsdelivr.net/gh/<owner>/` and `raw.githubusercontent.com/<owner>/`. Nothing
of pdf.js is committed. The viewer lives at `<site root>/assets/vendor/pdfjs/`
in the built site only.

## May this page embed this document? The publication gate decides, not you

**An embed is a link that also renders.** So it follows the same rule as the
download link: if the bitstream's publication gates (`copyright`,
`restrictions`) are not `permitted`, the page gets no viewer: the embed returns
nothing whenever the download link would be withheld, and the page says only
"held here, not published". Never embed a document to "just preview" it.
A preview is publication.

## Why the viewer opens only allowlisted hosts

The pdf.js generic viewer refuses a cross-origin `?file=`. That is
`validateFileURL`, whose error is *"file origin does not match viewer's"*. It
refuses so that a hosted viewer cannot be pointed at any document and lend it
the host's address. Our PDFs are on a CDN, not on Pages, so the build adds a
shim (`folio-open.js`) that opens `?src=` instead. It opens a URL only when the
URL **starts with** an `--allow` prefix, or is on the viewer's own origin.
Anything else is refused on screen and never fetched.

- A prefix is a prefix, not a substring. `https://evil.example/cdn.jsdelivr.net/gh/<owner>/x.pdf`
  is refused, and a unit test pins that.
- An empty allowlist is a **usage error**, not a default. Forgetting `--allow`
  would otherwise ship a viewer that refuses every CDN document while the build
  reports success. Write `--allow same-origin-only` when that really is what you
  want.

## Three things measured rather than assumed (pdf.js 6.4.299)

All three are listed under `binds` in the
`pdfjs` entry of `upstream-pins.json`, so a version bump re-checks them.

1. **The modern build needs a very new browser.** It calls
   `Map.prototype.getOrInsertComputed`. Chromium 140 lacks it, threw during
   startup and never opened the document. The install uses the **legacy** build,
   which carries its own polyfills.
2. **`webviewerloaded` fires on `parent.document` when the viewer is framed by
   a same-origin page**, and on its own document only otherwise. An embed on
   this site is the same-origin case, so a listener on `document` alone never
   fires and the frame stays empty. The shim listens on both, and checks
   `detail.source`.
3. **`defaultUrl` is the tracemonkey sample paper.** The shim sets it to empty,
   so a missing or refused `?src=` shows an empty viewer rather than somebody
   else's document.

## The embed, and what it does when it cannot work

- **Site root from the browser.** One generated page is served at several
  depths (`/<folio>/`, `/folio-assistant/<folio>/`,
  `/branches/<branch>/<folio>/`). The caller passes the route pattern, using
  the `folio-mount.ts` convention (group 1 is the root), and the inlined client
  applies it. A page off the route gets a frame saying so, never a 404 inside
  the frame.
- **Lazy.** The frame is pointed at the viewer only when it comes within 200px
  of the viewport. This uses an `IntersectionObserver`, because how engines
  treat `loading="lazy"` on a script-set `src` varies. A reader who never
  scrolls there downloads nothing.
- **Plain links always.** "Open the PDF on its own" and "Download" sit under
  the frame whether or not the viewer works. They are not a fallback that
  appears on failure.

## Caching: why the frame's address carries a version tag

GitHub Pages serves every file with `max-age=600` through a CDN, so a hard
reload can still be answered from a copy up to ten minutes old.

- **The frame's address ends `&v=<rev>.<deploy>`.** `<rev>` is `VIEWER_REV`, a
  hash of the pinned release, the shim and the patch. `<deploy>` comes from the
  host page's `document.lastModified`, which Pages sets at deploy time. So the
  frame is exactly as fresh as the page around it. A reader who sees the new
  page gets the new viewer.
- **The shim is fetched as `folio-open.js?v=<rev>`**, so a change to it cannot be
  masked by a cached copy.
- Where a server sends no `Last-Modified` (a local preview), the browser reports
  the current time, so the frame is simply never cached there. That is correct,
  just slower.

The outer page itself is outside this. If the green staging banner shows an
older commit than the deploy, the whole page is a cached copy. Wait out the
ten minutes, or use a private window.

## The site's own post-build passes leave the viewer alone

`viewer.html` is Mozilla's markup with one `<script>` added. `minify-site.ts`
skips it (rewriting it would ship bytes no pdf.js release contains), and
`check:duplicate-ids` and `publish-verify`'s `html-unique-ids` count it **out of scope**, not passed. It
declares `id="buttons"` twice upstream. That finding is real, and nobody here
can fix it without forking pdf.js. They ask `isVendoredViewer()`, so there is
one answer to "is this ours".

**The two passes that INJECT into every page skip it too.** These are the
staging banner and the standalone navigation rail; otherwise both draw inside
the PDF frame. Any new pass that writes into every `*.html` in `_site` owes the
same exclusion. `standalone-rail.test.ts` and `pdf-viewer.test.ts` each assert
it for the existing two.

## Cost

About a 7 MB download per build, adding about 12 MB (404 files) to the built
site. The size matters most for staging previews, each of which carries its own
copy on `gh-pages`. `bun run cat health` reports the size of `gh-pages`. Nothing is
added to a clone.

## Verifying a change here

Unit tests (`cat-harness-tools/scripts/tests/pdf-viewer.test.ts`) run the **shipped**
shim and client against stubs: the allowlist, the parent-document listener, the
root derivation at three depths, and lazy loading. They cannot check that
pdf.js opens, searches and prints. For that, install into a scratch site with
`--zip`, serve it, and drive it in a browser (see `rendered-verification`).
Check, and screenshot for the author: the page count shows, a search finds
matches, the page box jumps, print and download are present, and a narrow
viewport does not load the viewer until it is scrolled to.
