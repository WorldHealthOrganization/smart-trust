/**
 * The `review/` page of a folio's preview site: what changed from `main`,
 * block by block.
 *
 * ## One static page that reads its data when it is opened
 *
 * `folio-staging.yml` builds the site FIRST and computes the ChangeSet AFTER
 * it, into `<site>/changeset.json`, and the banner step writes
 * `<site>/staging.json`. So this page carries no data: it fetches
 * `../changeset.json` and `../staging.json` in the reader's browser, and the
 * same file is correct on every build.
 *
 * ## The three states, each said in words
 *
 * - **A ChangeSet with changes.** The list, grouped by section.
 * - **A ChangeSet with none.** "No block changed," with the count of blocks
 *   compared.
 * - **No ChangeSet.** On `main`, or on any build that is not a preview. The
 *   page says there is nothing to compare against.
 *
 * ## Each change is a before/after pair
 *
 * A changed block links to its anchor on this preview AND to the same anchor
 * on `main` (`staging.json`'s `mainSite`). An added block has only the
 * preview link, and a removed block only the `main` link. Anchors are the
 * block labels that `build-document-site` writes, which the `id-unique` and
 * `id-stable` QA criteria guard.
 *
 * ## Review comments
 *
 * `../review-comments.json` is the `folio-review-comments` Tool's output:
 * `review-comment/1.0.0` todos, one per tagged PR comment. The page lists
 * each block's comments under it, and gives three more groups their own
 * headings:
 * - comments on blocks this PR did not change;
 * - ORPHANED comments, whose block is gone;
 * - tags nobody could read.
 *
 * Every changed block also shows the `block: <label>` line to start a new
 * comment with, and links to the PR, since GitHub cannot pre-fill a comment
 * box. A missing file is SAID, never shown as an empty list. The governing
 * skill is `review-comments`.
 *
 * ## Choosing how to see a change
 *
 * Every changed block has a "Show this change as" selector over the renderers
 * in `schemas/ui/diff-renderers.ts`: a word diff of the source, the block inline
 * as rendered, or the two published pages side by side. Each block opens
 * with its kind's default. A page-level selector overrides every block, and
 * that one choice is remembered for this viewer in `localStorage`. Every read
 * and write is wrapped, so a private window or blocked storage just means
 * the defaults.
 *
 * A renderer that cannot run on a block is still listed, disabled, with the
 * reason in its label. The renderers themselves are
 * `scripts/review-renderers.ts` and `scripts/word-diff.ts`, embedded here
 * with `toString()`, so the functions the tests drive are the ones that run.
 *
 * ## Where to look first: the heat map
 *
 * Above the list, a section-by-metric table: changed blocks, open review
 * comments (defects apart), and stale comments (the block changed after the
 * comment was made). Review coverage and QA are columns too, and say per row
 * that they are not measured or not published YET, never 0. The numbers are
 * `scripts/review-heat.ts`, embedded with `toString()`. The tint is a
 * one-hue sequential ramp, and every cell also shows its number, so colour
 * never carries meaning alone. Each row's header moves focus to that section.
 *
 * ## Finding your way: outline, breadcrumb, minimap
 *
 * A navigation pane sits beside the list, or above it on a narrow screen:
 * - the **outline** of each document, in manifest order, from the preview's
 *   `outline.json`, with word badges per section. On a page with the harness
 *   rail it is a section OF THE RAIL (`railOutline`); without a rail it stays
 *   in the pane;
 * - the **minimap**: one cell per block, a single tab stop, arrow keys to
 *   move, Enter to jump.
 *
 * Moving to an item announces where it is (document, chapter, section,
 * block) in the live status line. `n` and `p` jump to the next and previous
 * block with open comments, and `u` to the next changed block with no
 * reviewer verdict on its CURRENT version, each with a button twin. Every
 * changed block says in words whether it has a verdict, and whose. A verdict
 * on an older version is shown, and does not count. The pieces are
 * `scripts/review-nav.ts`, embedded with `toString()`.
 *
 * ## Accessibility
 *
 * - Every change kind is a WORD, never a colour alone.
 * - `j` and `k` move to the next and previous change, and each has a visible
 *   button twin.
 * - Focus is always visible.
 * - The status line is `aria-live`.
 * - The list is built with DOM APIs, never `innerHTML`: a block label is folio
 *   content and must not be able to become markup.
 */

import { DIFF_RENDERERS } from "../schemas/ui/diff-renderers.js";
import { PUBLISHED_LOCALES } from "../schemas/content/translation.js";
import { changeRuns, cleanRendered, FRAME_CHROME_CSS, imageChange, markInFrame, renderFields, renderInline, renderSideBySide, renderVisual, renderWordDiff } from "./review-renderers.js";
import { computeHeat, heatBucket, renderHeat } from "./review-heat.js";
import { crumbFor, railOutline, renderMinimap, renderOutline } from "./review-nav.js";
import { measuredModel, renderedModel, renderMeasured, renderRendered } from "./review-rendered.js";
import { wordDiff } from "./word-diff.js";
import { briefBlocks, briefInline, briefModel, briefRepo, briefText, closedIssue, renderBrief, whereToLook } from "./review-brief.js";
import { darkRules } from "./lib/scheme-css.ts";

const STYLE = `
  :root { color-scheme: light dark; --fg: #1b1b1b; --bg: #fdfdfb; --muted: #5b5b5b; --link: #0b5cad; --rule: #d8d8d4; }
  ${darkRules(`:root { --fg: #e8e8e6; --bg: #161616; --muted: #a8a8a4; --link: #7db4ff; --rule: #3a3a38; }`)}
  body { margin: 0; font: 1.05rem/1.6 system-ui, sans-serif; color: var(--fg); background: var(--bg); }
  /* Column and gutters belong to main: the harness rail owns body padding-left. */
  main { max-width: 78rem; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
  .layout { display: grid; grid-template-columns: 17rem minmax(0, 1fr); gap: 2rem; align-items: start; }
  /* Bean folio-assistant-xp72: at 2,000 changed blocks the page spent 1.8 s
     (3.6 s with no change text, two iframes per change) laying out entries
     nobody could see yet. content-visibility skips style, layout and paint for
     an entry until it nears the viewport, and keeps it in the DOM, the
     accessibility tree and find-in-page, so j/k, focus and links are unchanged.
     The intrinsic size is remembered once an entry has rendered. Measured:
     0.6-0.8 s for both cases (test/review-budget.e2e.ts). */
  #changes li[data-label] { content-visibility: auto; contain-intrinsic-size: auto 14rem; }
  /* The pane gets main's own gutters, so it does not sit flush on the rail. */
  .layout > aside { position: sticky; top: 1rem; max-height: calc(100vh - 2rem); overflow: auto; font-size: .95rem; padding: 2rem 0 1rem 1.5rem; }
  @media (max-width: 62rem) { .layout { grid-template-columns: 1fr; } .layout > aside { position: static; max-height: none; padding: 1rem 1.5rem 0; } }
  .outline ol { list-style: none; padding-left: .75rem; margin: .25rem 0; }
  .outline > ol { padding-left: 0; }
  .ol-doc { font-weight: 600; } .ol-ch { font-weight: 600; margin-top: .4rem; }
  .outline li { border: 0; padding: .1rem 0; }
  .badges { color: var(--muted); font-size: .9rem; }
  /* The minimap is a MAP: small square cells that wrap, one per block, so a
     900-block document fits in a screen instead of a 23,000px column of
     empty full-width bars. A cell with glyphs widens to fit them, so the
     glyphs still repeat the colour. On a narrow screen the pane sits above
     the list, so the map scrolls in its own box rather than pushing the
     changes off the screen. */
  .minimap h2 { margin-top: 1.5rem; }
  .minimap ol { list-style: none; padding: 2px; margin: 0; display: flex; flex-wrap: wrap; gap: 2px; }
  .minimap li { border: 0; padding: 0; display: block; }
  .minimap .cell { display: block; box-sizing: border-box; min-width: .85rem; height: .85rem; padding: 0 .1rem; font: 700 .6rem/.75rem system-ui, sans-serif; text-align: center; border: 1px solid var(--rule); border-radius: 2px; cursor: pointer; }
  .minimap .cell.h0 { background: transparent; color: var(--fg); }
  /* A cell with something to look at is filled (.h1-.h3 below). */
  .minimap .cell:not(.h0) { border-color: transparent; }
  .minimap .cell:focus-visible { outline: 3px solid var(--link); outline-offset: 1px; }
  .minimap .mm-ch { margin: .6rem 0 .15rem; font-size: .8rem; line-height: 1.3; font-weight: 600; }
  .minimap .mm-count { font-weight: 400; color: var(--muted); }
  @media (max-width: 62rem) { .minimap { max-height: 50vh; overflow: auto; } }
  a { color: var(--link); }
  a:focus-visible, button:focus-visible, li:focus-visible { outline: 3px solid var(--link); outline-offset: 2px; }
  .nav { display: flex; gap: .5rem; margin: 1rem 0; flex-wrap: wrap; align-items: center; }
  /* Control rules are scoped to .layout: the harness rail's own controls sit outside it.
     Minimap cells are excluded: this rule's transparent background beat the
     .h1-.h3 fills, so a changed block looked the same as an unchanged one. */
  .layout button:where(:not(.cell)) { font: inherit; padding: .5rem 1rem; min-height: 2.75rem; border: 1px solid var(--muted); border-radius: .4rem; background: transparent; color: var(--fg); cursor: pointer; }
  h2 { font-size: 1.05rem; margin-top: 2rem; border-bottom: 1px solid var(--rule); padding-bottom: .25rem; }
  ul { list-style: none; padding: 0; }
  li { padding: .5rem .25rem; border-bottom: 1px solid var(--rule); }
  .kind { font-weight: 600; margin-right: .5rem; }
  .label { font-family: var(--fa-font-mono,Menlo,Consolas,monospace); }
  .links a { margin-right: 1rem; }
  .muted { color: var(--muted); }
  .source-docs { margin: -.25rem 0 .75rem; font-size: 1.05rem; font-weight: 600; }
  .anchor-btn { float: right; margin-left: .5rem; min-width: 2rem; min-height: 2rem; font-size: .95rem; line-height: 1; padding: .2rem .35rem; border: 1px solid var(--rule); border-radius: .35rem; background: var(--bg); color: var(--fg); cursor: pointer; }
  .anchor-btn:focus-visible { outline: 3px solid var(--link); outline-offset: 2px; }
  h2 .anchor-btn { font-weight: 400; margin-top: -.3rem; }
  .anchor-target { display: block; }
  .meta-only { margin: .25rem 0 .5rem; padding: .4rem .7rem; border-left: 3px solid #b26b00; background: color-mix(in srgb, #ffb84d 18%, transparent); border-radius: 0 .3rem .3rem 0; }
  .comments { margin: .25rem 0 0 1rem; padding-left: .75rem; border-left: 3px solid var(--rule); }
  .comment { padding: .15rem 0; }
  .tagline { font-family: var(--fa-font-mono,Menlo,Consolas,monospace); font-size: .9rem; }
  .layout select { font: inherit; min-height: 2.75rem; padding: .25rem .5rem; color: var(--fg); background: var(--bg); border: 1px solid var(--muted); border-radius: .4rem; }
  .layout select:focus-visible { outline: 3px solid var(--link); outline-offset: 2px; }
  .viewrow { margin: .5rem 0 .25rem; display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
  .diff { margin: .25rem 0 .5rem; padding: .5rem .75rem; border: 1px solid var(--rule); border-radius: .4rem; overflow-x: auto; }
  pre.diff { white-space: pre-wrap; font: .95rem/1.5 ui-monospace, monospace; }
  ins { background: #d7f5dc; color: #0b3d17; text-decoration: underline; }
  del { background: #fbdada; color: #5c0b0b; text-decoration: line-through; }
  ${darkRules(`ins { background: #12391d; color: #c8f2d0; } del { background: #45181a; color: #f5caca; }`)}
  .diff-sbs { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
  .diff-fields table { border-collapse: collapse; width: 100%; font-size: .9rem; }
  .diff-fields caption { text-align: left; font-weight: 600; padding: .25rem 0; }
  .diff-fields th, .diff-fields td { border: 1px solid var(--rule); padding: .25rem .4rem; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  .diff-fields td:last-child { white-space: nowrap; font-weight: 600; }
  .diff-sbs iframe { width: 100%; height: 22rem; border: 1px solid var(--rule); border-radius: 0 0 .3rem .3rem; background: #fff; display: block; }
  .sbs-head { padding: .2rem .6rem; border-radius: .3rem .3rem 0 0; font-size: .85rem; line-height: 1.4; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sbs-side-base { background: #5f6368; }
  .sbs-side-head { background: #4F6F52; }
  .sbs-head a, .sbs-head code { color: #fff; }
  .sbs-head code { background: rgba(0,0,0,.25); padding: 0 .25rem; border-radius: .2rem; }
  @media (max-width: 40rem) { .diff-sbs { grid-template-columns: 1fr; } }
  /* Visual diff (0rxe): pictures on a white card, since they are screenshots
     of light pages; the mode buttons are native radios, one click each. */
  /* A changed picture: before and after, side by side (the text diff cannot
     see a new src). */
  .diff-figures { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; margin: .25rem 0 .75rem; }
  .diff-figure { margin: 0; border: 2px solid var(--rule); border-radius: .3rem; padding: .4rem; background: #fff; }
  .diff-figure figcaption { font-weight: 600; font-size: .85rem; margin-bottom: .3rem; color: #1f1f1f; }
  .diff-figure-base { border-color: #b3261e; }
  .diff-figure-head { border-color: #4F6F52; }
  .diff-figure img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  @media (max-width: 40rem) { .diff-figures { grid-template-columns: 1fr; } }
  .diff-visual img { max-width: 100%; height: auto; border: 1px solid var(--rule); border-radius: .3rem; background: #fff; display: block; }
  .visual-modes { border: 0; padding: 0; margin: .25rem 0 .5rem; display: flex; flex-wrap: wrap; gap: .25rem 1rem; }
  .visual-modes legend { float: left; margin-right: .5rem; font-weight: 600; }
  .visual-modes label { cursor: pointer; }
  /* Heat map (qbfi). Blue 250/400/550 on light and 600/500/400 on dark: an
     ordinal ramp that passes the dataviz validator, each fill paired with an
     ink that clears 4.7:1 against it. */
  .heatwrap { overflow-x: auto; margin: 1rem 0; }
  table.heat { border-collapse: separate; border-spacing: 2px; font-size: .95rem; }
  table.heat caption { text-align: left; color: var(--muted); padding-bottom: .4rem; }
  table.heat th, table.heat td { padding: .35rem .6rem; text-align: left; border-radius: .25rem; overflow-wrap: anywhere; }
  /* Fit the width rather than scroll sideways: a keyboard user cannot reach a
     scrolled-off column (the ojcx run clipped QA at 1000 px). The wrapper is
     still focusable, for the narrowest screens. */
  table.heat { width: 100%; }
  table.heat thead th { font-weight: 600; border-bottom: 1px solid var(--rule); }
  table.heat td { font-variant-numeric: tabular-nums; }
  .h1 { background: #86b6ef; color: #1b1b1b; } .h2 { background: #3987e5; color: #1b1b1b; } .h3 { background: #1c5cab; color: #ffffff; }
  ${darkRules(`.h1 { background: #184f95; color: #ffffff; } .h2 { background: #256abf; color: #ffffff; } .h3 { background: #3987e5; color: #161616; }`)}
  button.linklike { border: 0; padding: 0; min-height: 0; background: none; color: var(--link); text-decoration: underline; cursor: pointer; font: inherit; text-align: left; }
  /* What to expect (cat-harness-tools#1153): the PR's own summary, in a card. */
  #brief { border: 1px solid var(--rule); border-radius: .5rem; padding: .25rem 1rem .5rem; margin: 1rem 0; }
  #brief h2 { margin-top: .75rem; }
  #brief h3 { font-size: 1rem; margin: .75rem 0 .25rem; }
  #brief ul, #brief ol { padding-left: 1.25rem; }
  #brief ul { list-style: disc; }
  #brief li { border: 0; padding: .1rem 0; }
  #brief ul.brief-where { list-style: none; padding-left: 0; }
  .brief-body { max-height: 28rem; overflow: auto; }
  .brief-chip { font-weight: 600; padding: .05rem .45rem; border-radius: .3rem; background: #4F6F52; color: #fff; }
  h2:focus-visible { outline: 3px solid var(--link); outline-offset: 2px; }
`;

const SCRIPT = `
(function () {
  // Where the site root is, from this page's own path (folio-assistant#2527):
  // every data file and every page below is relative to it.
  var ROOT = reviewSiteRoot(location.pathname, LOCALES);
  var allDocs = document.getElementById("all-documents");
  if (allDocs) allDocs.href = ROOT + "index.html";
  // Back to the source document, at the top (owner, 2026-11-02: "you should
  // have link back to source document at top"). Each document the outline
  // names, by its title; the site's list of documents until it loads.
  var srcLink = document.getElementById("source-doc-link");
  if (srcLink) srcLink.href = ROOT + "index.html";
  // Named anchors (owner, 2026-11-02: "should have (named/semantic/slug) #
  // links for items in the page like #dth-hrh/ch05-user-personas-and-use-cases").
  // A chapter is its section key's path, a section that path plus "/" and its
  // label, a block its own label: the same id the document pages give it.
  // The link button copies the address and puts it in the address bar.
  function anchorButton(id, what) {
    var b = el("button", "\ud83d\udd17", "anchor-btn");
    b.type = "button";
    b.title = "Copy link to this " + what;
    b.setAttribute("aria-label", "Copy link to this " + what);
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      var url = location.href.replace(/#.*$/, "") + "#" + encodeURIComponent(id).replace(/%2F/g, "/").replace(/%3A/g, ":");
      try { history.replaceState(null, "", url); } catch (x) { /* the copy still works */ }
      var said = function (t) { status.textContent = t; };
      try {
        navigator.clipboard.writeText(url).then(function () { said("Link copied: " + url); }, function () { said("Link: " + url); });
      } catch (x) { said("Link: " + url); }
    });
    return b;
  }
  function goToHash() {
    var h = location.hash ? location.hash.slice(1) : "";
    if (!h) return;
    var t = null;
    try { t = document.getElementById(decodeURIComponent(h)); } catch (x) { t = document.getElementById(h); }
    if (!t) return;
    if (t.tabIndex < 0 && !t.hasAttribute("tabindex")) t.tabIndex = -1;
    t.scrollIntoView({ block: "start" });
    t.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", goToHash);
  function sourceLinks(outline) {
    var box = document.getElementById("source-docs");
    var ds = outline && outline.documents ? outline.documents : [];
    var ok = ds.filter(function (d) { var p = String(d.page || ""); return d.title && p && safePage(p); });
    if (!box || !ok.length) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    box.appendChild(document.createTextNode(ok.length > 1 ? "Back to the documents: " : "Back to the document: "));
    ok.forEach(function (d, i) {
      if (i) box.appendChild(document.createTextNode(" · "));
      var a = el("a", String(d.title));
      a.href = ROOT + d.page;
      box.appendChild(a);
    });
  }
  var status = document.getElementById("status");
  var summary = document.getElementById("summary");
  var list = document.getElementById("changes");
  var items = [];
  var at = -1;

  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  // The document a block belongs to is its manifest's first path segment,
  // which is the page build-document-site writes. Kept to one safe segment.
  function docOf(at) {
    var seg = String((at && at.file) || "").split("/")[0];
    // "." and ".." match the character class, and would climb out of the site.
    return /^[A-Za-z0-9._-]+$/.test(seg) && !/^\\.+$/.test(seg) ? seg : null;
  }
  // The page a document is on, relative to the site root: the outline's
  // \`page\` when this build published one (under the locale since
  // folio-assistant#2527), else \`<doc>/index.html\`, where
  // build-document-site wrote it before. Kept to safe segments, like docOf.
  function docPage(doc) {
    var ds = OUTLINE && OUTLINE.documents ? OUTLINE.documents : [];
    for (var i = 0; i < ds.length; i++) {
      var p = ds[i].slug === doc ? String(ds[i].page || "") : "";
      if (p && /^[A-Za-z0-9._\\/-]+$/.test(p) && p.split("/").every(function (s) { return s && !/^\\.+$/.test(s); })) return p;
    }
    return doc + "/index.html";
  }
  // A ChangeSet whose blocks are not a folio's says where each one is on the
  // site itself: \`page\` (site-relative; "" when the block is on no page,
  // such as an IG's source file) and \`anchor\` (the element id, when it is not
  // the label). An IG's preview writes them (the FHIR layer's ig-review-data).
  function safePage(p) {
    return /^[A-Za-z0-9._\\/-]+$/.test(p) && p.split("/").every(function (s) { return s && !/^\\.+$/.test(s); });
  }
  function href(base, at, label) {
    if (at && typeof at.page === "string") {
      if (!at.page || !safePage(at.page)) return null;
      return base + at.page + (at.anchor ? "#" + encodeURIComponent(at.anchor) : "");
    }
    var doc = docOf(at);
    return doc == null ? null : base + docPage(doc) + "#" + encodeURIComponent(label);
  }
  function kindWords(c) {
    if (c.change === "added") return ["added"];
    if (c.change === "removed") return ["removed"];
    var words = { renamed: "renamed", prose: "reworded", manifest: "edited", moved: "moved" };
    return c.aspects.map(function (a) { return words[a] || a; });
  }
  var OUTLINE = null;
  function focusItem(i) {
    if (!items.length) return;
    at = (i + items.length) % items.length;
    items[at].focus();
    // Where am I (eb4l): the breadcrumb goes into the one live region.
    var sec = items[at].getAttribute("data-section");
    var crumb = sec ? crumbFor(OUTLINE, sec) : null;
    var label = items[at].getAttribute("data-label");
    status.textContent = "Item " + (at + 1) + " of " + items.length + (crumb ? ": " + crumb : "") + (label ? " \u203a " + label : "");
  }
  // Next / previous item with open comments (eb4l), wrapping.
  function focusCommented(step) {
    var n = items.length;
    // Before anything is focused, "next" starts at the top and "previous" at the bottom.
    var start = at < 0 ? (step > 0 ? -1 : 0) : at;
    for (var k = 1; k <= n; k++) {
      var j = (((start + step * k) % n) + n) % n;
      if (Number(items[j].getAttribute("data-open") || 0) > 0) { focusItem(j); return; }
    }
    status.textContent = "No block has open comments.";
  }

  document.getElementById("next").addEventListener("click", function () { focusItem(at + 1); });
  document.getElementById("prev").addEventListener("click", function () { focusItem(at - 1); });
  // Next changed block with no verdict on its current version (px0t), wrapping.
  function focusUnreviewed() {
    var n = items.length;
    var start = at < 0 ? -1 : at;
    for (var k = 1; k <= n; k++) {
      var j = (start + k) % n;
      if (items[j].getAttribute("data-reviewed") === "no") { focusItem(j); return; }
    }
    status.textContent = VERDICTS ? "Every changed block has a verdict on its current version." : "No verdict data on this build.";
  }
  var VERDICTS = false;
  document.getElementById("nextu").addEventListener("click", focusUnreviewed);
  document.getElementById("nextc").addEventListener("click", function () { focusCommented(1); });
  document.getElementById("prevc").addEventListener("click", function () { focusCommented(-1); });
  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // A letter typed into a selector picks an option; it is not navigation.
    var tag = e.target && e.target.tagName;
    if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "j") { focusItem(at + 1); e.preventDefault(); }
    else if (e.key === "k") { focusItem(at - 1); e.preventDefault(); }
    else if (e.key === "n") { focusCommented(1); e.preventDefault(); }
    else if (e.key === "p") { focusCommented(-1); e.preventDefault(); }
    else if (e.key === "u") { focusUnreviewed(); e.preventDefault(); }
  });

  // One comment as a line of words: kind, status, who, what — never colour alone.
  function commentEl(c) {
    var d = el("div", null, "comment");
    var r = c.review || {};
    d.setAttribute("data-status", c.status || "");
    d.setAttribute("data-kind", r.kind || "");
    d.appendChild(el("span", (r.kind || "comment") + ", " + c.status, "kind"));
    d.appendChild(el("span", (r.reviewer || "?") + " as " + (r.role || "reviewer") + ": "));
    d.appendChild(el("span", c.summary));
    if (r.anchoredFrom && r.anchoredFrom.length) d.appendChild(el("span", " (made on " + r.anchoredFrom.join(", ") + ")", "muted"));
    if (r.decision) {
      if (/^https?:\\/\\//.test(r.decision)) { d.appendChild(el("span", " (")); var da = el("a", "decision"); da.href = r.decision; d.appendChild(da); d.appendChild(el("span", ")")); }
      else d.appendChild(el("span", " (decision: " + r.decision + ")", "muted"));
    }
    if (r.commentUrl) { d.appendChild(el("span", " ")); var a = el("a", "read on the pull request"); a.href = r.commentUrl; d.appendChild(a); }
    // Deciding it is a pull-request comment too (bean 423d, owner 2026-10-15):
    // the page is static and writes nothing. The words offered are the moves
    // the review-comment table allows from this status; the build applies
    // the tag for a repository owner, member or collaborator.
    var next = DECIDE[c.status];
    if (next && c.id) {
      var h = el("div", null, "muted");
      h.appendChild(el("span", "To decide it, comment "));
      h.appendChild(el("code", "resolve: " + c.id, "tagline"));
      h.appendChild(el("span", " with the line "));
      next.forEach(function (w, i) { if (i) h.appendChild(el("span", i === next.length - 1 ? " or " : ", ")); h.appendChild(el("code", "decision: " + w, "tagline")); });
      d.appendChild(h);
    }
    return d;
  }
  // From each status, the decisions the review-comment table allows (the content core's review-comment.ts).
  var DECIDE = { open: ["addressed", "adjudicated", "withdrawn"], addressed: ["resolved", "reopened", "adjudicated", "withdrawn"] };
  function commentList(cs) {
    var box = el("div", null, "comments");
    cs.forEach(function (c) { box.appendChild(commentEl(c)); });
    return box;
  }
  function section(title, nodes, key) {
    if (!nodes.length) return;
    var h = el("h2", title);
    h.tabIndex = -1;
    if (key) h.setAttribute("data-section", key);
    list.appendChild(h);
    var ul = el("ul");
    nodes.forEach(function (n) {
      var li = el("li");
      li.tabIndex = -1;
      ["data-label", "data-section", "data-open"].forEach(function (a) { if (n.getAttribute(a)) li.setAttribute(a, n.getAttribute(a)); });
      li.appendChild(n);
      ul.appendChild(li);
      items.push(li);
    });
    list.appendChild(ul);
  }

  // ── Diff renderers (bean d903) ─────────────────────────────────
  // v2 (owner, 2026-10-31, "default to inline"): a page-level choice made
  // before, such as Side by side, is not carried over to override the new default.
  // v3 (owner, 2026-11-02, "defaults to in-line for all elements"): the same,
  // for structured blocks, which opened on the field table before.
  var VIEW_KEY = "folio-review:view:v3";
  function loadView() { try { return window.localStorage.getItem(VIEW_KEY) || ""; } catch (e) { return ""; } }
  function saveView(v) { try { window.localStorage.setItem(VIEW_KEY, v); } catch (e) { /* the defaults, then */ } }
  function defaultFor(kind, structured) {
    var fb = null;
    // Every block opens inline, structured ones too (owner, 2026-11-02). A
    // structured block falls back to the field renderer (STRUCTURED, bean
    // f327) in pick() only when inline cannot run on it.
    for (var i = 0; i < RENDERERS.length; i++) {
      if (RENDERERS[i].defaultFor.indexOf(kind) >= 0) return RENDERERS[i].id;
      if (RENDERERS[i].defaultFor.indexOf("*") >= 0) fb = RENDERERS[i].id;
    }
    return fb || RENDERERS[0].id;
  }
  // Why a renderer cannot run on this block, or null when it can.
  function unavailable(r, ctx) {
    for (var i = 0; i < r.needs.length; i++) {
      var n = r.needs[i];
      if (n === "text" && !ctx.text) return "no prose on either side";
      if (n === "pages" && !ctx.before && !ctx.after) return "no page to show";
      if (n === "screenshots" && !ctx.visual) return "no pictures on this build";
      if (n === "structure" && !ctx.structure) return "no fields for this block";
    }
    return null;
  }
  function renderInto(panel, id, ctx) {
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    var t = ctx.text || {};
    var base = t.base || null;
    var head = t.head || null;
    var out;
    // Each side's HTML resolves relative links from its own page's directory.
    function dirOf(u) { return u ? String(u).replace(/[#?].*$/, "").replace(/[^\/]*$/, "") : ""; }
    var headDir = dirOf(ctx.after) || dirOf(ctx.before);
    var baseDir = dirOf(ctx.before) || headDir;
    function cleanHead(d, h) { return cleanRendered(d, h, headDir); }
    function cleanBase(d, h) { return cleanRendered(d, h, baseDir); }
    var figs = (id === "inline" || id === "side-by-side") && (base || head) ? imageChange(document, base ? base.html : null, head ? head.html : null, cleanBase, cleanHead) : null;
    if (figs) panel.appendChild(figs);
    if (id === "word") {
      var ops = wordDiff(base ? base.prose : "", head ? head.prose : "");
      out = ops === null ? "This block is too long for a word diff. Choose side by side." : renderWordDiff(document, ops);
    } else if (id === "inline") {
      // Words the same on both sides: say so, rather than show a diff with no
      // marks that reads as broken (owner, 2026-11-02, "no green or red").
      if (base && head && sameText(base, head)) {
        var note = el("div", null, "meta-only");
        note.appendChild(el("strong", "No visible text change. "));
        note.appendChild(el("span", (ctx.aspects || []).indexOf("manifest") >= 0 || (ctx.aspects || []).length === 0
          ? "Only this block's metadata changed, such as a linked element or its source."
          : "The change is to: " + (ctx.aspects || []).join(", ") + "."));
        if (ctx.structure) note.appendChild(renderFields(document, ctx.structure));
        panel.appendChild(note);
      }
      out = renderInline(document, base ? base.html : null, head ? head.html : null, wordDiff, head ? cleanHead : cleanBase);
    } else if (id === "side-by-side") {
      // The rendered text of each side, diffed, says where each pane scrolls to.
      var runs = null;
      if (base || head) {
        var bt = base ? cleanRendered(document, base.html).textContent || "" : "";
        var ht = head ? cleanRendered(document, head.html).textContent || "" : "";
        var sops = wordDiff(bt, ht);
        if (sops) runs = changeRuns(sops);
      }
      out = renderSideBySide(document, ctx.before, ctx.after, { beforeName: ctx.beforeName, facts: ctx.facts, runs: runs, mark: markInFrame });
    } else if (id === "visual") {
      out = renderVisual(document, ctx.visual, ROOT, "vis-" + panel.id);
    } else if (id === "fields") {
      out = renderFields(document, ctx.structure);
    }
    // The pictures are already shown, before and after; inline shows only
    // the text around them, and nothing when the picture was all that changed.
    if (figs && id === "inline" && out && typeof out !== "string") {
      out.querySelectorAll("img").forEach(function (i) { i.remove(); });
      if (!(out.textContent || "").trim()) out = null;
    }
    if (typeof out === "string") panel.appendChild(el("p", out, "muted"));
    else if (out) panel.appendChild(out);
  }
  function sameText(a, b) {
    if (a.html === b.html) return true;
    var ta = (cleanRendered(document, a.html || "").textContent || "").replace(/\\s+/g, " ").trim();
    var tb = (cleanRendered(document, b.html || "").textContent || "").replace(/\\s+/g, " ").trim();
    return ta === tb && (a.prose || "") === (b.prose || "");
  }
  var viewers = [];
  function viewSelector(ctx) {
    var row = el("div", null, "viewrow");
    var id = "view-" + viewers.length;
    var lab = el("label", "Show this change as");
    lab.htmlFor = id;
    var sel = document.createElement("select");
    sel.id = id;
    RENDERERS.forEach(function (r) {
      var why = unavailable(r, ctx);
      var o = el("option", r.label + (why ? " (unavailable: " + why + ")" : ""));
      o.value = r.id;
      o.title = r.description;
      if (why) o.disabled = true;
      sel.appendChild(o);
    });
    var panel = el("div");
    panel.id = "panel-" + viewers.length;
    function pick(v) {
      var r = RENDERERS.filter(function (x) { return x.id === v; })[0];
      if (!r || unavailable(r, ctx)) {
        // The chosen view cannot run here: fall back to the first one that
        // can, preferring those that list this block's kind (0rxe: a table
        // with no pictures opens side by side, not on a word diff), then the
        // field table for a structured block.
        var can = RENDERERS.filter(function (x) { return !unavailable(x, ctx); });
        r = can.filter(function (x) { return x.defaultFor.indexOf(ctx.kind) >= 0; })[0] ||
          (ctx.structure ? can.filter(function (x) { return x.defaultFor.indexOf("@structured") >= 0; })[0] : null) || can[0];
      }
      if (!r) { while (panel.firstChild) panel.removeChild(panel.firstChild); panel.appendChild(el("p", "Nothing to show for this change: it is to the manifest only.", "muted")); return; }
      sel.value = r.id;
      renderInto(panel, r.id, ctx);
    }
    sel.addEventListener("change", function () { pick(sel.value); });
    row.appendChild(lab);
    row.appendChild(sel);
    var v = { row: row, panel: panel, pick: pick, kind: ctx.kind, structured: !!ctx.structure };
    viewers.push(v);
    return v;
  }
  function applyView(global) {
    viewers.forEach(function (v) { v.pick(global || defaultFor(v.kind, v.structured)); });
  }
  var viewAll = document.getElementById("view");
  var none = el("option", "Each block's default");
  none.value = "";
  viewAll.appendChild(none);
  RENDERERS.forEach(function (r) { var o = el("option", r.label); o.value = r.id; o.title = r.description; viewAll.appendChild(o); });
  viewAll.value = loadView();
  if (viewAll.value !== loadView()) viewAll.value = "";
  viewAll.addEventListener("change", function () { saveView(viewAll.value); applyView(viewAll.value); });

  var COMMENT_FILTERS = [
    ["", "All comments"],
    ["open-addressed", "Open and addressed"],
    ["status:open", "Open"],
    ["status:addressed", "Addressed"],
    ["status:resolved", "Resolved"],
    ["status:adjudicated", "Adjudicated"],
    ["status:withdrawn", "Withdrawn"],
    ["kind:defect", "Defects"],
    ["kind:question", "Questions"],
    ["kind:suggestion", "Suggestions"],
    ["kind:editorial", "Editorial"]
  ];
  var commentFilter = document.getElementById("comment-filter");
  COMMENT_FILTERS.forEach(function (f) { var o = el("option", f[1]); o.value = f[0]; commentFilter.appendChild(o); });
  function applyCommentFilter(f, announce) {
    var boxes = list.querySelectorAll(".comments");
    var shownCount = 0;
    var totalCount = 0;
    for (var i = 0; i < boxes.length; i++) {
      var cs = boxes[i].querySelectorAll(".comment");
      var boxShown = 0;
      for (var j = 0; j < cs.length; j++) {
        totalCount++;
        var ok = matchesCommentFilter(cs[j].getAttribute("data-status") || "", cs[j].getAttribute("data-kind") || "", f);
        cs[j].hidden = !ok;
        if (ok) { boxShown++; shownCount++; }
      }
      boxes[i].hidden = !boxShown;
    }
    if (announce) status.textContent = "Showing " + shownCount + " of " + totalCount + " review comment(s).";
  }
  commentFilter.addEventListener("change", function () { applyCommentFilter(commentFilter.value, true); });

  function get(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  }

  // What to expect (cat-harness-tools#1153): the PR and the issue it closes,
  // live from GitHub, else the copy staged with the preview. Any branch has a
  // PR; a change set only adds detail. "Where to look" joins when the
  // ChangeSet loads.
  var briefBox = document.getElementById("brief");
  var BRIEF = null, WHERE = null, JUMP = null;
  function drawBrief() { if (BRIEF) renderBrief(document, briefBox, BRIEF, WHERE, JUMP); }
  function gh(path) {
    return fetch("https://api.github.com/" + path, { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  }
  get(ROOT + "staging.json").catch(function () { return {}; }).then(function (st) {
    var rp = briefRepo(st);
    var prn = st && /^\\d+$/.test(String(st.pr || "")) ? String(st.pr) : null;
    var live = rp && prn && typeof fetch === "function"
      ? gh("repos/" + rp.owner + "/" + rp.repo + "/pulls/" + prn).then(function (p) {
          var pr = { number: p.number, title: p.title || "", body: p.body || "", url: p.html_url || "" };
          var n = closedIssue(pr.body) || (st.issue && /^\\d+$/.test(String(st.issue)) ? Number(st.issue) : null);
          var issue = n ? gh("repos/" + rp.owner + "/" + rp.repo + "/issues/" + n).then(function (i) {
            return { number: i.number, title: i.title || "", url: i.html_url || "" };
          }).catch(function () { return { number: n, title: "", url: "https://github.com/" + rp.owner + "/" + rp.repo + "/issues/" + n }; }) : Promise.resolve(null);
          return issue.then(function (i) { return { pr: pr, issue: i, source: "live" }; });
        })
      : Promise.reject(new Error("no PR"));
    return live.catch(function () {
      return get(ROOT + "review-brief.json").then(function (b) {
        return { pr: b.pr || null, issue: b.issue || null, source: "snapshot", fetchedAt: b.fetchedAt || null };
      });
    }).catch(function () { return { pr: null, issue: null, source: "none" }; }).then(function (r) {
      // The main site, or a preview with no PR: nothing to summarise, so no pane.
      if (!r.pr && !prn) { briefBox.hidden = true; return; }
      BRIEF = briefModel({ staging: st, pr: r.pr, issue: r.issue, source: r.source, fetchedAt: r.fetchedAt });
      drawBrief();
    });
  });

  // The rendered list (bean bnjs): fetched on its own, so a preview with a
  // ChangeSet but no rendered impact still shows its blocks, and says why
  // the page list is missing rather than showing an empty one.
  var renderedBox = document.getElementById("rendered");
  // The build diff under it (bean ehh6): a missing file is "not measured", said.
  Promise.all([
    get(ROOT + "rendered-impact.json"),
    get(ROOT + "staging.json").catch(function () { return {}; }),
    get(ROOT + "rendered-measured.json").catch(function () { return null; }),
  ]).then(function (r) {
    renderRendered(renderedBox, renderedModel(r[0], r[1].mainSite, ROOT));
    renderMeasured(renderedBox, measuredModel(r[2], ROOT));
  }).catch(function () {
    renderedBox.textContent = "This build published no rendered-impact.json, so which rendered pages the change alters is not known (which is not the same as none).";
  });

  get(ROOT + "changeset.json").then(function (cs) {
    return Promise.all([
      get(ROOT + "staging.json").catch(function () { return {}; }),
      get(ROOT + "review-comments.json").catch(function () { return null; }),
      get(ROOT + "changeset-text.json").catch(function () { return null; }),
      get(ROOT + "blocks.json").catch(function () { return null; }),
      get(ROOT + "block-qa.json").catch(function () { return null; }),
      get(ROOT + "outline.json").catch(function () { return null; }),
      get(ROOT + "visual-diff.json").catch(function () { return null; }),
      get(ROOT + "changeset-structure.json").catch(function () { return null; }),
    ]).then(function (both) {
      var structureFile = both[7];
      var visualFile = both[6];
      OUTLINE = both[5];
      sourceLinks(OUTLINE);
      var blocksFile = both[3];
      var qaFile = both[4];
      // A summary that found NO verdict corpus (bean tfqf): every block in it
      // reads "unaudited", which is not what happened. The heat map gets no
      // QA data and the page says why, instead of a column of unaudited blocks.
      var qaUnavailable = !!(qaFile && qaFile.corpus && qaFile.corpus.state === "absent");
      if (qaUnavailable) qaFile = null;
      var st = both[0];
      var rc = both[1];
      var txt = both[2];
      var byLabel = {};
      var shown = {};
      // Verdicts by label (px0t). Counted only on the block's current hash.
      // A file written before verdicts existed has no field at all: "no data", never "none given".
      VERDICTS = !!(rc && Array.isArray(rc.verdicts) && blocksFile);
      var verdictsBy = {};
      ((rc && rc.verdicts) || []).forEach(function (v) { (verdictsBy[v.targetLabel] = verdictsBy[v.targetLabel] || []).push(v); });
      ((rc && rc.comments) || []).forEach(function (c) {
        if (c.review && c.review.orphaned) return;
        (byLabel[c.targetLabel] = byLabel[c.targetLabel] || []).push(c);
      });
      var main = st.mainSite ? String(st.mainSite).replace(/\\/?$/, "/") : null;
      // Which published site is the before side: main's, or a stacked PR's base preview (5uuf).
      var beforeName = st.beforeRef || "main";
      var s = cs.summary;
      // The head is "worktree" in CI (the checkout under review), which names
      // nothing a reader recognises; the banner's staging.json has the branch.
      var headName = cs.head.ref === "worktree" && st.branch ? st.branch : cs.head.ref;
      summary.textContent =
        cs.base.ref + " \\u2192 " + headName + ": " +
        s.added + " added, " + s.removed + " removed, " + s.changed + " changed (" +
        s.prose + " reworded, " + s.moved + " moved, " + s.renamed + " renamed, " + s.manifest + " edited), " +
        s.unchanged + " unchanged.";
      if (main) summary.textContent += " Before side: " + beforeName + "'s published site.";
      if (!rc) summary.textContent += " No comment data on this build.";
      else summary.textContent += " " + rc.comments.length + " review comment(s).";
      if (!cs.changes.length) {
        status.textContent = "No block changed. " + s.unchanged + " block(s) compared.";
      }
      var groups = {};
      var order = [];
      cs.changes.forEach(function (c) {
        var where = (c.head || c.base || {}).section || "(listed in no section)";
        if (!groups[where]) { groups[where] = []; order.push(where); }
        groups[where].push(c);
      });
      order.forEach(function (where) {
        var h2 = el("h2", where.replace("::", " \\u203a "));
        h2.tabIndex = -1;
        h2.setAttribute("data-section", where);
        var chap = where.split("::")[0];
        if (where.indexOf("::") > 0 && !document.getElementById(chap)) {
          var ca = el("span", null, "anchor-target");
          ca.id = chap;
          ca.tabIndex = -1;
          list.appendChild(ca);
        }
        if (!document.getElementById(where.replace("::", "/"))) h2.id = where.replace("::", "/");
        if (h2.id) h2.appendChild(anchorButton(h2.id, "section"));
        list.appendChild(h2);
        var ul = el("ul");
        groups[where].forEach(function (c) {
          var li = el("li");
          li.tabIndex = -1;
          li.setAttribute("data-label", c.label);
          li.setAttribute("data-section", where);
          if (!document.getElementById(c.label)) { li.id = c.label; li.appendChild(anchorButton(c.label, "block")); }
          li.setAttribute("data-open", String((byLabel[c.label] || []).filter(function (x) { return x.status === "open" || x.status === "addressed"; }).length));
          li.appendChild(el("span", kindWords(c).join(", "), "kind"));
          li.appendChild(el("span", c.label, "label"));
          if (VERDICTS && c.change !== "removed") {
            var cur = blocksFile[c.label] ? blocksFile[c.label].hash : null;
            var vs = verdictsBy[c.label] || [];
            var now = vs.filter(function (v) { return v.blockHash === cur; });
            var old = vs.length - now.length;
            li.setAttribute("data-reviewed", now.length ? "yes" : "no");
            var vd = el("div", null, now.length ? "verdict" : "verdict muted");
            vd.appendChild(el("span", now.length ? "Reviewed: " : "No verdict on this version yet", "kind"));
            if (now.length) vd.appendChild(el("span", now.map(function (v) {
              return (v.verdict === "waived" ? "waived (" + v.reason + ")" : v.verdict) + " by " + v.reviewer + " as " + v.role;
            }).join("; ")));
            if (old) vd.appendChild(el("span", " (" + old + " verdict" + (old > 1 ? "s" : "") + " on an earlier version, not counted)", "muted"));
            li.appendChild(vd);
          }
          if (c.from) li.appendChild(el("span", " (was " + c.from + ")", "muted"));
          var links = el("div", null, "links");
          var after = c.change !== "removed" ? href(ROOT, c.head, c.label) : null;
          var before = c.change !== "added" && main ? href(main, c.base, c.from || c.label) : null;
          if (after) { var a = el("a", "view on this preview"); a.href = after; links.appendChild(a); }
          if (before) { var b = el("a", "view on " + beforeName); b.href = before; links.appendChild(b); }
          if (!after && !before) links.appendChild(el("span", "no page to link to", "muted"));
          li.appendChild(links);
          var v = viewSelector({
            kind: (c.head || c.base || {}).kind || "",
            aspects: c.aspects || [],
            text: txt && txt.blocks ? txt.blocks[c.label] || null : null,
            visual: visualFile && visualFile.blocks ? visualFile.blocks[c.label] || null : null,
            structure: structureFile && structureFile.blocks ? structureFile.blocks[c.label] || null : null,
            before: before,
            after: after,
            beforeName: beforeName,
            facts: st && st.branch ? Object.assign({}, st, { baseSha: cs.base && cs.base.commit ? String(cs.base.commit) : "" }) : null,
          });
          li.appendChild(v.row);
          li.appendChild(v.panel);
          var mine = byLabel[c.label] || [];
          shown[c.label] = true;
          if (mine.length) li.appendChild(commentList(mine));
          if (c.change !== "removed") {
            var t = el("div", null, "muted");
            t.appendChild(el("span", "To comment, start a pull-request comment with "));
            t.appendChild(el("code", "block: " + c.label, "tagline"));
            t.appendChild(el("span", ". To record that you reviewed it, add the line "));
            t.appendChild(el("code", "verdict: ok", "tagline"));
            t.appendChild(el("span", " (or "));
            t.appendChild(el("code", "verdict: changes", "tagline"));
            t.appendChild(el("span", ")"));
            if (st.prUrl) { t.appendChild(el("span", " ")); var p = el("a", "open the pull request"); p.href = st.prUrl; t.appendChild(p); }
            li.appendChild(t);
          }
          ul.appendChild(li);
          items.push(li);
        });
        list.appendChild(ul);
      });
      if (rc) {
        var elsewhere = [];
        Object.keys(byLabel).forEach(function (label) {
          if (shown[label]) return;
          var d = el("div");
          d.setAttribute("data-label", label);
          var bs = blocksFile && blocksFile[label] && blocksFile[label].section;
          if (bs) d.setAttribute("data-section", bs);
          d.setAttribute("data-open", String(byLabel[label].filter(function (x) { return x.status === "open" || x.status === "addressed"; }).length));
          d.appendChild(el("span", label, "label"));
          d.appendChild(commentList(byLabel[label]));
          elsewhere.push(d);
        });
        section("Comments on blocks this pull request did not change", elsewhere, "(unchanged)");
        section("Orphaned: the block these were made on is gone", rc.comments
          .filter(function (c) { return c.review && c.review.orphaned; })
          .map(function (c) { var d = el("div"); d.appendChild(el("span", c.targetLabel, "label")); d.appendChild(commentList([c])); return d; }));
        section("Tags that could not be read or applied", rc.malformed.map(function (m) {
          var d = el("div");
          d.appendChild(el("span", m.error + " "));
          var a = el("a", "fix it on the pull request"); a.href = m.url; d.appendChild(a);
          return d;
        }));
      }
      if (!txt && cs.changes.length) summary.textContent += " No change text on this build, so only the views of the pages" + (visualFile ? " and the pictures" : "") + " are available.";
      applyView(viewAll.value);
      applyCommentFilter(commentFilter.value, false);
      goToHash();
      // The heat map (qbfi), above the list it indexes.
      var heat = computeHeat({ changes: cs.changes, comments: rc ? rc.comments : null, blocks: blocksFile, qa: qaFile ? qaFile.blocks : null, verdicts: rc && Array.isArray(rc.verdicts) ? rc.verdicts : null });
      if (heat.rows.length) {
        var wrap = document.getElementById("heat");
        wrap.appendChild(renderHeat(document, heat, heatBucket, function (sec) {
          var t = list.querySelector('h2[data-section="' + (window.CSS && CSS.escape ? CSS.escape(sec) : sec) + '"]') ||
            list.querySelector('h2[data-section="(unchanged)"]');
          if (t) { t.focus(); t.scrollIntoView({ block: "start" }); }
        }));
        wrap.appendChild(el("p", "Review coverage counts a changed block as reviewed only when a reviewer recorded a verdict on its current version: an edit after the verdict reopens it, and resolved comments are not a verdict. QA counts a block as failing only on a verdict newer than the block; an older verdict is counted as stale.", "muted"));
        if (qaUnavailable) wrap.appendChild(el("p", "QA not available for this build: the build found no QA results (its qa-reports fetch missed and no verdicts were in the checkout), so whether any block was audited is unknown. The QA column says \u201cnot published\u201d for that reason, not because nothing was checked.", "muted"));
      }
      // Navigation pane (eb4l): outline and minimap, when the build published an outline.
      var navPane = document.getElementById("navpane");
      function jumpSection(key) {
        var t = list.querySelector('h2[data-section="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]') ||
          list.querySelector('h2[data-section="(unchanged)"]');
        if (t) { t.focus(); t.scrollIntoView({ block: "start" }); }
      }
      WHERE = whereToLook(cs.changes, 6);
      JUMP = jumpSection;
      drawBrief();
      if (OUTLINE && OUTLINE.documents) {
        var rowBy = {};
        heat.rows.forEach(function (r) { rowBy[r.section] = r; });
        var badgesOf = function (key) {
          var r = rowBy[key];
          return r ? { changed: r.changed, open: r.open, qaFailing: r.qaFailing } : null;
        };
        // The outline goes in the harness RAIL when the page has one (owner,
        // 2026-10-07: "TOC in the LHS navbar, not LHS of displayed content");
        // without a rail, in the page's own pane as before.
        var railIn = document.querySelector("nav.fa-nav:not([data-fa-rail]) .fa-nav-in");
        var railHost = railIn && railIn.querySelector(".fa-nav-graphs");
        if (railIn && !railHost) {
          // No page section yet: open one where the rail puts it, after its top.
          railHost = document.createElement("div");
          railHost.className = "fa-nav-graphs";
          var top = railIn.querySelector(".fa-nav-top");
          railIn.insertBefore(railHost, top ? top.nextSibling : railIn.firstChild);
        }
        if (railHost) railHost.insertBefore(railOutline(document, OUTLINE, badgesOf, jumpSection, ROOT), railHost.firstChild);
        else navPane.appendChild(renderOutline(document, OUTLINE, badgesOf, jumpSection, ROOT));
        var changeOf = {};
        cs.changes.forEach(function (c) { if (c.change !== "removed") changeOf[c.label] = c.change === "added" ? "added" : "changed"; });
        navPane.appendChild(renderMinimap(document, OUTLINE, function (label) {
          var open = (byLabel[label] || []).filter(function (x) { return x.status === "open" || x.status === "addressed"; }).length;
          var q = qaFile && qaFile.blocks ? qaFile.blocks[label] : null;
          return { change: changeOf[label] || null, open: open, qaFailing: !!(q && q.state === "failing") };
        }, function (label, page) {
          for (var i = 0; i < items.length; i++) if (items[i].getAttribute("data-label") === label) { focusItem(i); items[i].scrollIntoView({ block: "center" }); return; }
          // Nothing to review here: open the block where it is published.
          window.location.href = ROOT + page + "#" + encodeURIComponent(label);
        }));
      } else {
        navPane.appendChild(el("p", "No outline on this build: the folio's build did not publish outline.json. Use Next and Previous.", "muted"));
      }
      if (items.length) status.textContent = items.length + " item(s). Press j for the next, k for the previous, n or p for the next or previous with open comments, u for the next unreviewed.";
    });
  }).catch(function () {
    status.textContent =
      "No ChangeSet on this build, so there is nothing to compare against main. " +
      "It appears on a staging preview, built for a pull request.";
  });
})();
`;

/**
 * The site root as seen from the review page, read from the page's own path
 * (folio-assistant#2527): `../` from `<root>/review/`, `../../` from
 * `<root>/<locale>/review/`, where `<locale>` is one of `locales`
 * (`PUBLISHED_LOCALES`). So the page carries no depth of its own: the same
 * bytes are right at either address, on the main site and under a staging
 * slug, and from `file://`.
 *
 * Read off the path's segments: the last is the file (or empty, after a
 * trailing slash), the one before it the page's directory, and the one before
 * THAT a locale or not. Like every relative link on the site, it expects the
 * page addressed as its directory (`…/review/`) or its file. Self-contained:
 * it runs in the page.
 */
export function reviewSiteRoot(pathname: string, locales: readonly string[]): string {
  const segs = String(pathname || "").split("/");
  return segs.length >= 4 && locales.indexOf(segs[segs.length - 3]!) >= 0 ? "../../" : "../";
}

/**
 * Whether a review comment with `status` and `kind` passes `filter` on the
 * review page (bean `423d`). Self-contained: embedded in the page via `toString()`.
 */
export function matchesCommentFilter(status: string, kind: string, filter: string): boolean {
  if (!filter) return true;
  if (filter === "open-addressed") return status === "open" || status === "addressed";
  if (filter.indexOf("status:") === 0) return status === filter.slice(7);
  if (filter.indexOf("kind:") === 0) return kind === filter.slice(5);
  return true;
}

/**
 * The review page. Static: all of its data is fetched when it is opened.
 *
 * `root` is the site root relative to the page, for the one link written into
 * the markup: "All documents", before the script corrects it from the page's
 * own path ({@link reviewSiteRoot}). It is what a link check reads, and what a
 * reader without scripts follows. The page's one writer, core's
 * build-document-site, puts it at `<site>/<locale>/review/`, hence `../../`;
 * the hard-coded `../` it had resolved to `<site>/<locale>/index.html`, which
 * no build writes.
 */
export function reviewPageHtml(root: string = "../../"): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review: what changed</title>
<style>${STYLE}</style>
</head>
<body>
<div class="layout">
<aside id="navpane" aria-label="Navigation"></aside>
<main>
<h1>What changed</h1>
<p id="source-docs" class="source-docs">Back to <a id="source-doc-link" href="${root}index.html">the document</a></p>
<section id="brief" aria-labelledby="brief-h"><h2 id="brief-h">What to expect in this review</h2><p class="muted">Loading the pull request's summary…</p></section>
<p id="summary" class="muted"></p>
<p id="status" role="status" aria-live="polite">Loading the ChangeSet…</p>
<div class="nav">
  <button type="button" id="prev">Previous (k)</button>
  <button type="button" id="next">Next (j)</button>
  <button type="button" id="prevc">Previous with comments (p)</button>
  <button type="button" id="nextc">Next with comments (n)</button>
  <button type="button" id="nextu">Next unreviewed (u)</button>
  <a id="all-documents" href="${root}index.html">All documents</a>
</div>
<div class="viewrow"><label for="view">Show every change as</label> <select id="view"></select> <label for="comment-filter">Show comments</label> <select id="comment-filter"></select></div>
<section aria-labelledby="rendered-h"><h2 id="rendered-h">Rendered pages this change alters</h2><div id="rendered" class="muted">Loading the rendered impact…</div></section>
<div id="heat" class="heatwrap" tabindex="0" role="region" aria-label="Heat map: where to look first"></div>
<div id="changes"></div>
</main>
</div>
<script>
var LOCALES = ${JSON.stringify(PUBLISHED_LOCALES).replace(/</g, "\\u003c")};
var reviewSiteRoot = ${reviewSiteRoot.toString()};
var matchesCommentFilter = ${matchesCommentFilter.toString()};
var RENDERERS = ${JSON.stringify(DIFF_RENDERERS).replace(/</g, "\\u003c")};
var wordDiff = ${wordDiff.toString()};
var cleanRendered = ${cleanRendered.toString()};
var imageChange = ${imageChange.toString()};
var renderWordDiff = ${renderWordDiff.toString()};
var renderInline = ${renderInline.toString()};
var renderFields = ${renderFields.toString()};
var FRAME_CHROME_CSS = ${JSON.stringify(FRAME_CHROME_CSS)};
var renderSideBySide = ${renderSideBySide.toString()};
var changeRuns = ${changeRuns.toString()};
var markInFrame = ${markInFrame.toString()};
var renderVisual = ${renderVisual.toString()};
var computeHeat = ${computeHeat.toString()};
var heatBucket = ${heatBucket.toString()};
var renderHeat = ${renderHeat.toString()};
var crumbFor = ${crumbFor.toString()};
var renderOutline = ${renderOutline.toString()};
var railOutline = ${railOutline.toString()};
var renderMinimap = ${renderMinimap.toString()};
var renderedModel = ${renderedModel.toString()};
var renderRendered = ${renderRendered.toString()};
var measuredModel = ${measuredModel.toString()};
var renderMeasured = ${renderMeasured.toString()};
var briefRepo = ${briefRepo.toString()};
var closedIssue = ${closedIssue.toString()};
var briefText = ${briefText.toString()};
var briefModel = ${briefModel.toString()};
var whereToLook = ${whereToLook.toString()};
var briefBlocks = ${briefBlocks.toString()};
var briefInline = ${briefInline.toString()};
var renderBrief = ${renderBrief.toString()};
</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
