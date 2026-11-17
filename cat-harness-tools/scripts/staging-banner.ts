/**
 * Inject the staging banner as a CONSTANT fragment, and put the per-preview
 * facts in one `staging.json` the browser reads. Bean `g196`.
 *
 * ## The problem this exists to fix
 *
 * The banner used to be composed in `feature-staging.yml` as a bash string and
 * `sed`-ed into every page with the commit SHA and a `date -u` build timestamp
 * baked in. Measured on `origin/gh-pages`, 2026-09-19: 9 previews, **346.1 MB**,
 * of which **27.5 MB of each 37.5 MB preview is HTML** — and **zero HTML blobs
 * are shared between any two previews** (git `ls-tree` blob-hash intersection:
 * 0 of ~390 HTML objects, against 185 of ~780 overall, the shared ones being
 * images, fonts and vendor JS).
 *
 * The timestamp is the sharp end. Because it is `date -u +%Y-%m-%dT%H:%M:%SZ`,
 * **every page is unique even across two builds of ONE branch**, so each
 * re-push adds ~27.5 MB of permanently new objects and the history grows even
 * when the preview count does not. Run 597's log: *"Injected staging banner
 * into 530 HTML files"*.
 *
 * ## The shape
 *
 * Emit the facts once, to `<site>/staging.json`, and inject a fragment that is
 * **byte-identical on every page and across every rebuild**. The browser
 * derives its preview root from `location.pathname`, fetches the JSON and
 * fills the banner in.
 *
 * This is not a new idea here — `head_custom.html` already records the sidebar
 * QR as *"generated in the browser from `window.location.href` rather than
 * baked per page at build time"*, for the neighbouring reason.
 *
 * ## Why the compare link did not defeat it
 *
 * Exactly one fragment of the old banner was genuinely per-page: the link
 * putting this page beside its counterpart on `main`, which has three states
 * (present on main → deep link; absent → site root, and SAY the page is new;
 * publish ref unread → site root, worded neutrally). That looked like
 * build-time per-page data.
 *
 * It is not. The client knows its own path, and the only thing it cannot
 * compute is *which pages main has* — so `staging.json` carries `newPages`,
 * the pages with **no** counterpart, which is the short list rather than the
 * long one. Membership is then a client-side check and the fragment stays
 * constant. Had this not worked the whole approach would have collapsed to a
 * much smaller saving, so it was the first thing checked.
 *
 * ## What is deliberately NOT fixed here
 *
 * Cause 2 in `g196`: Jekyll's `relative_url` prepends `baseurl` to ~235 hrefs
 * per page. Pages therefore still differ **between** previews by slug. They no
 * longer differ **across rebuilds of one preview**, which is the unbounded
 * half.
 *
 * Cause 3 — the `fa-translation-index` island publishing `site.baseurl` to
 * JavaScript — is **done** as of 2026-10-02: the island is gone and the facts
 * are fetched once from `assets/harness/site.json`, the same move this file
 * made for the banner. Measured on a local build the day it landed: 2356 pages
 * carried it at 9482 B each, 22.34 MB on ONE distinct payload.
 *
 * ## The footer carries the same stamp, and it is filled the same way
 *
 * `docs/_includes/footer_custom.html` renders `short_sha`, `built_at` and
 * `run_url` from `docs/_data/build.yml` into the footer of EVERY page. A fresh
 * `date -u` there made every page unique on every run — the same defect as the
 * banner, one include away — and it SURVIVED the banner fix. Measured on two
 * deploys of one branch three minutes apart, both already shipping the
 * constant banner: **1466 insertions, 1465 deletions across 613 files, every
 * page changed by exactly one line**.
 *
 * So the staging build no longer writes those three keys; Jekyll renders the
 * footer identically every time, and {@link CLIENT}'s `stamp()` fills the real
 * values from the same `staging.json` the banner already fetches. The reader
 * loses nothing — only the moment the value is bound moves from build time to
 * load time. `docs-site.yml` still stamps the MAIN site, where there is one
 * copy and nothing to deduplicate.
 *
 * That this was missed until the deployed artefact was measured is the point
 * worth keeping: the unit test proved the FRAGMENT constant and was right,
 * and the page still was not. A test of the part is not a measurement of the
 * whole.
 *
 * ## Two rules the client script must not break
 *
 * **A failed fetch must still say PREVIEW.** The banner exists so a reviewer
 * cannot mistake staged content for the published site; if `staging.json`
 * cannot be read, the page must still announce itself. *"Could not determine"
 * is never rendered as "this is the real site"* — the same third-state rule
 * the rest of this repository runs on, and here the failure mode is a
 * reviewer approving the wrong artefact. So the static markup carries
 * "FEATURE BRANCH" and the fetch only ever ADDS detail.
 *
 * **Every value from the JSON goes in as `textContent`, never as markup.**
 * Git ref names may contain `<`, `>` and `"` — they are not in git's
 * forbidden set, which stops at space, `~`, `^`, `:`, `?`, `*`, `[`, `\` and
 * the control characters. A branch name is therefore attacker-influenced
 * markup if it is ever concatenated into HTML. The old bash banner
 * interpolated `$BRANCH` into a string; this one builds nodes.
 */
import { isVendoredViewer } from "./pdf-viewer.ts";
import { BUILD_TYPES, type BuildType } from "./lib/build-type.ts";
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";

import { commentGuard } from "./html-comments.ts";

/** The per-preview facts. One file per build, read by the banner at load time. */
export interface StagingFacts {
  /** Raw branch name — the slug is sanitised, this is not. */
  branch: string;
  /** Short commit SHA of the build. */
  sha: string;
  /** `date -u +%Y-%m-%dT%H:%M:%SZ`. The reason the old banner defeated dedup. */
  built: string;
  /** PR number, or `"n/a"` when no open PR was found; the banner then says so in words, never "PR #n/a" (bean zvl0). */
  pr: string;
  prUrl: string;
  branchUrl: string;
  /** The issue the branch is FOR, or `null` — absent is a normal state. */
  issue: string | null;
  issueUrl: string | null;
  runUrl: string;
  /**
   * Where this build's CI results will appear (the PR's or the commit's
   * checks page), or `null`. A preview renders in parallel with CI and never
   * waits for it, so the banner links to the results instead of stating them.
   */
  checksUrl?: string | null;
  /**
   * Root of the PUBLISHED site this preview is compared with: `main`'s, or for
   * a stacked PR its base branch's preview (bean `5uuf`).
   */
  mainSite: string;
  /**
   * Which branch `mainSite` is the published site of, so a page can say which
   * "before" it used. `null` when the caller did not say: read as `main`, the
   * only before side there was until `5uuf`.
   */
  beforeRef?: string | null;
  /**
   * Whether the publish ref could be read at all. `false` collapses the
   * compare link to the site root, worded neutrally — "could not tell" must
   * never render as "this page is new", which would label every page new on
   * any run where the fetch failed.
   */
  mainPagesKnown: boolean;
  /**
   * The build type (`lib/build-type.ts`): `preview` borrows main's indexes,
   * `full` rebuilt them. `pc:release freeze` refuses a `preview`. Absent when
   * the caller did not say (a workflow from before the switch).
   */
  buildType?: BuildType;
  /**
   * Site-relative paths that exist in this build and NOT on main. The short
   * list; membership is checked in the browser. Empty and meaningless when
   * `mainPagesKnown` is false.
   */
  newPages: string[];
}

const CHIP =
  "font-family:var(--fa-font-mono,Menlo,Consolas,monospace);background:rgba(0,0,0,.22);color:#fff;padding:1px 6px;border-radius:3px";

/** A `preview` build's banner: muted sage, 5.63:1 against white (see below). */
export const PREVIEW_BACKGROUND = "#4F6F52";

/**
 * A `full` build's banner — a release (owner, 2026-11-05: *"not preview build
 * (green) but a release build (purple)"*). #6B3FA0 measures 7.4:1 against the
 * banner's white text, past WCAG AA as the sage is. Applied by the client from
 * `staging.json`'s `buildType`, so the injected fragment stays constant.
 */
export const RELEASE_BACKGROUND = "#6B3FA0";

/**
 * The banner's own colours, kept from the bash version with their reasons.
 *
 * Muted sage (#4F6F52) with white text — 5.63:1, comfortably past the 4.5:1
 * WCAG AA threshold for normal text. It replaced #d946ef, which measured
 * 3.46:1 against its own white text and so FAILED AA: the banner was not
 * merely glaring, it was the least readable element on every staged page. Any
 * replacement must be checked the same way; the pale decorator sages
 * (#9CAF88, #87A96B) all land near 2.5:1.
 *
 * Every monospace chip is a `<span>`, deliberately NOT a `<code>`. The branch
 * name used to be `<code>`, which picks up the theme's own `code` rule — a
 * near-white background in LIGHT mode — while inheriting the banner's white
 * text. White on white: the one piece of information the banner exists to
 * convey was invisible to exactly the readers using the default theme.
 */
const BANNER_STYLE =
  `background:${PREVIEW_BACKGROUND};color:#fff;padding:8px 16px;font-size:14px;text-align:center;position:fixed;top:0;left:0;right:0;box-sizing:border-box;z-index:2147483001;font-family:var(--fa-font-sans,system-ui,sans-serif)`;

/**
 * The banner must PUSH THE FIXED SIDEBAR DOWN, not sit on top of it.
 *
 * just-the-docs makes `.side-bar` `position: fixed; top: 0`. A `position:
 * sticky` banner is in normal flow and moves nothing that is out of it, so the
 * banner covered the top of the sidebar: the site title, and part of the
 * toolbar row holding the theme, reading preferences, language and QR
 * controls. A reader reported the language selector "still not visible" — it
 * was under the banner.
 *
 * A fixed offset would be wrong: the banner wraps to two or three lines on a
 * narrow viewport, and its height is not knowable here. So measure it and
 * publish the value as a custom property, on load and on resize — and now
 * also after the fetch fills it in, which is a THIRD moment the height
 * changes and the bash version never had.
 *
 * ## Two things this used to assume about the page, and both were wrong
 *
 * Reported by the owner 2026-10-02 with a screenshot: the banner was **not at
 * the top**. Measured in Chromium against the served bytes of
 * `branches/…/cat-harness/library/<dak-base>/<dak-ig>/`, the banner rendered
 * at `top: 8, left: 64` where it should have been `0, 56`.
 *
 * **It assumed the page resets `body`'s margin.** `position: sticky; top: 0`
 * resolves against the element's flow position INSIDE the margin box, so the
 * browser's default `body { margin: 8px }` holds the banner 8px off every
 * edge. The arithmetic is the proof: that page sets `body{padding-left:56px}`
 * for its rail, and the banner measured `left: 64` — 56 + 8. just-the-docs
 * ships `body{margin:0` in `just-the-docs-default.css`, which is the only
 * reason this was invisible for ~2,400 pages; a layout that does not use the
 * theme never had it. So `body{margin:0}` is a NO-OP on the theme pages and
 * the fix everywhere else.
 *
 * **It assumed the fixed chrome is called `.side-bar`.** That is
 * just-the-docs' name for it. The library viewer's chrome is `.fa-nav`
 * (`position: fixed; top: 0; z-index: 2147483000`), which this rule never
 * matched, so the rail was never pushed down and sat level with the banner —
 * the exact defect the section above says this rule exists to prevent, on a
 * layout written after it. Naming both is the narrow fix; the general lesson
 * is that a selector list is a list of the layouts somebody remembered.
 *
 * Measured after, same page: banner `top: 0, left: 56, right: 1280` and
 * `.fa-nav` `top: 32` — pushed down by exactly the banner's height.
 *
 * ## Fixed, full width, since 2026-10-04 — it was still sticky inside body
 *
 * Owner, with three screenshots of an IRIS replica page: *"banner is wrong
 * on page load, scrolls, and then is at top. should always be at top"* and
 * *"upper left corner should be filled with green banner too"*. Both were the
 * banner living in `body`'s flow:
 *
 * - **Not at the top on load.** The folio glass band (`docs-ui.css`, bean
 *   `g9r2`) gives a replica's `body` `padding-top: 2.25rem`. A sticky banner
 *   is laid out inside that padding, so it rendered at `top: 36` and only
 *   reached 0 once the page scrolled. Measured on the served bytes:
 *   `banner [56, 36]` at load, `[56, 0]` after a 300px scroll.
 * - **The corner.** `body{padding-left:56px}` for the rail put the banner's
 *   left edge at 56, and the rail itself is pushed DOWN by the offset, so the
 *   56×(banner height) square above the rail was bare page.
 *
 * So the banner is `position: fixed; left: 0; right: 0` and the room it needs
 * is reserved on `html`, which no page pads. It is above the rail's z-index so
 * an expanded rail cannot paint over it. The `body{padding-left}` defect class
 * — "a selector list is a list of the layouts somebody remembered" — cannot
 * recur through padding any more, because nothing that pads `body` reaches it.
 */
export const OFFSET_STYLE =
  "<style>:root{--fa-staging-offset:0px}" +
  // The UA default is 8px; a page that does not reset it holds the banner off
  // every edge. No-op wherever a theme already resets it.
  "body{margin:0}" +
  // Every fixed top chrome this repository ships. `.side-bar` is
  // just-the-docs'; `.fa-nav` is the viewer rail.
  ".side-bar,.fa-nav{top:var(--fa-staging-offset,0px)!important}" +
  // The banner is FIXED (see below), so it takes no room in flow: reserve its
  // measured height above the whole document instead. On `html`, not `body`,
  // because pages pad `body` for their own chrome — the rail's
  // `padding-left`, the folio glass band's `padding-top` — and the banner
  // must sit outside all of it.
  "html{padding-top:var(--fa-staging-offset,0px)}" +
  "</style>";

/** Where the preview root is, given a page's pathname. Exported to be tested. */
export function previewRootOf(pathname: string): string | null {
  const m = pathname.match(/^(.*\/(?:branches|STAGING)\/[^/]+\/)/);
  return m ? m[1]! : null;
}

/**
 * The client half, served ONCE per preview as {@link BANNER_SCRIPT} at the
 * preview root, beside `staging.json`.
 *
 * It used to be inlined into every page, because a `<script src>` would have
 * to be document-relative and so vary with the page's DEPTH. The loader in
 * {@link FRAGMENT} answers that the way this script already finds
 * `staging.json`: it derives the preview root from `location.pathname`, so
 * the fragment stays constant and only the root is named. Inlined, the client
 * was about 6.5 KB of every page's 12 KB on an IG's thin artefact pages
 * (757 of them on one IG preview, 2026-11-10; fhir-harness#325).
 *
 * `previewRootOf` above is the same expression; `staging-banner.test.ts`
 * asserts they agree, so the tested function cannot drift from the shipped
 * string.
 */
export const CLIENT = `(function(){
function el(t,a,x){var e=document.createElement(t);if(a)for(var k in a)e.setAttribute(k,a[k]);if(x!=null)e.textContent=x;return e;}
function link(href,text,extra){var a=el('a',{href:href,style:'color:#fff;text-decoration:underline'},text);if(extra)a.setAttribute('style',a.getAttribute('style')+';'+extra);return a;}
function chip(text){return el('span',{style:${JSON.stringify(CHIP)}},text);}
function sep(){return document.createTextNode(' \\u00b7 ');}
function root(){var m=location.pathname.match(/^(.*\\/(?:branches|STAGING)\\/[^/]+\\/)/);return m?m[1]:null;}
// Release or preview (owner, 2026-11-05): a full build is a release and is
// drawn purple, a preview green. Set here from staging.json, not in the
// fragment, so the fragment stays byte-identical on every build.
function kind(f){if(f.buildType!=='full')return;var b=document.querySelector('[data-fa-staging-banner]');if(!b)return;b.style.background=${JSON.stringify(RELEASE_BACKGROUND)};b.setAttribute('data-fa-build-type','full');var t=b.querySelector('b');if(t)t.textContent='RELEASE BUILD';}
function measure(){var b=document.querySelector('[data-fa-staging-banner]');if(!b)return;document.documentElement.style.setProperty('--fa-staging-offset',b.getBoundingClientRect().height+'px');}
function fill(d,f,r){
  kind(f);
  while(d.firstChild)d.removeChild(d.firstChild);
  d.appendChild(document.createTextNode('\\u2014 '));
  var b=link(f.branchUrl,'');b.appendChild(chip(f.branch));d.appendChild(b);
  var rv=el('span',{'data-fa-staging-review':''});d.appendChild(rv);
  d.appendChild(sep());d.appendChild(document.createTextNode('commit '));d.appendChild(chip(f.sha));
  d.appendChild(sep());d.appendChild(document.createTextNode('built '+f.built));
  d.appendChild(sep());d.appendChild(link(f.prUrl,f.pr&&f.pr!=='n/a'?'PR #'+f.pr:'no open PR found'));
  if(f.issue){d.appendChild(sep());d.appendChild(link(f.issueUrl,'issue #'+f.issue));}
  d.appendChild(sep());
  var rel=location.pathname.slice(r.length);
  if(rel===''||rel.charAt(rel.length-1)==='/')rel+='index.html';
  if(!f.mainPagesKnown){
    d.appendChild(link(f.mainSite+'/','compare with '+(f.beforeRef||'main')+' \\u2197'));
  }else if(f.newPages.indexOf(rel)>=0){
    d.appendChild(link(f.mainSite+'/',(f.beforeRef||'main')+' \\u2197'));
    d.appendChild(document.createTextNode(' '));
    d.appendChild(el('span',{style:'opacity:.85'},'(new page)'));
  }else{
    d.appendChild(link(f.mainSite+'/'+rel,'compare with '+(f.beforeRef||'main')+' \\u2197'));
  }
  d.appendChild(sep());d.appendChild(link(f.runUrl,'build log'));
  if(f.checksUrl){d.appendChild(sep());d.appendChild(link(f.checksUrl,'CI results'));}
  stamp(f);
  measure();
  fresh(d,f);
  review(rv,r,rel);
}
// The preview's review page (owner, 2026-11-01, Q-REV-1): reviewers could not
// find it from a staging page. A folio writes it at <root>/<locale>/review/,
// an IG at <root>/review/. Asked with HEAD, which the staging worker passes
// through, so a 404 here is not answered with the live site's page. No review
// page, no link.
function review(s,r,rel){
  if(typeof fetch!=='function')return;
  var c=[],m=rel.match(/^([a-z]{2,3}(?:-[A-Za-z0-9]+)?)\\//);
  if(m)c.push(r+m[1]+'/review/');
  c.push(r+'review/');
  (function next(i){
    if(i>=c.length)return;
    fetch(c[i]+'index.html',{method:'HEAD',cache:'no-store'}).then(function(x){
      if(!x.ok)return next(i+1);
      s.appendChild(sep());
      s.appendChild(link(c[i],'\\ud83d\\udd0d Review changes','font-weight:bold'));
      measure();
    }).catch(function(){next(i+1);});
  })(0);
}
// Live staleness (owner, 2026-10-31, option C): ask GitHub for the branch's
// head now and say so when it has moved past the commit this preview was
// built from. Unauthenticated, one request per page view; on any failure
// (rate limit, offline, a deleted branch) it says nothing rather than guess.
function fresh(d,f){
  var m=String(f.branchUrl||'').match(/^https:\\/\\/github\\.com\\/([^/]+)\\/([^/]+)\\//);
  if(!m||!f.branch||!f.sha||typeof fetch!=='function')return;
  fetch('https://api.github.com/repos/'+m[1]+'/'+m[2]+'/commits/'+encodeURIComponent(f.branch),
    {headers:{Accept:'application/vnd.github.sha'},cache:'no-store'})
    .then(function(x){if(!x.ok)throw 0;return x.text();})
    .then(function(head){
      head=String(head).trim();
      if(!/^[0-9a-f]{7,40}$/.test(head)||head.indexOf(f.sha)===0)return;
      d.appendChild(sep());
      var w=el('strong',{'data-fa-staging-stale':'',style:'background:#b00020;padding:0 .4em;border-radius:3px'},'\\u26a0 stale: the branch is now at ');
      w.appendChild(chip(head.slice(0,7)));
      w.appendChild(document.createTextNode(', newer than this preview'));
      d.appendChild(w);measure();
    }).catch(function(){});
}
function stamp(f){
  var p=document.querySelector('.fa-build-stamp');if(!p)return;
  while(p.firstChild)p.removeChild(p.firstChild);
  p.appendChild(document.createTextNode('deployed '));
  var a=link(f.runUrl,'');a.appendChild(el('code',null,f.sha));p.appendChild(a);
  p.appendChild(document.createTextNode(' \u00b7 '+f.built));
}
function go(){
  measure();
  var d=document.querySelector('[data-fa-staging-detail]');if(!d)return;
  var r=root();
  if(!r){d.textContent='\\u2014 build details unavailable (not served from a preview path)';return;}
  fetch(r+'staging.json',{cache:'no-store'}).then(function(x){if(!x.ok)throw 0;return x.json();})
    .then(function(f){fill(d,f,r);})
    .catch(function(){d.textContent='\\u2014 build details unavailable';measure();});
}
// First visit to a preview: the shared stylesheets 404 until the worker is
// in control, so the page would paint unstyled (a page-wide search icon) for
// the moment before the reload. Hide it until then, only when a stylesheet
// in the head actually failed, and show it again if no reload comes.
function unstyled(){var l=document.querySelectorAll('link[rel="stylesheet"]');for(var i=0;i<l.length;i++){if(l[i].disabled)continue;try{if(!l[i].sheet||!l[i].sheet.cssRules.length)return true;}catch(e){}}return false;}
function share(){
  var r=root();if(!r||!('serviceWorker' in navigator))return;
  var k='fa-share:'+r,s=document.documentElement.style;
  var hide=!navigator.serviceWorker.controller&&!sessionStorage.getItem(k)&&unstyled();
  function show(){if(hide){hide=false;s.removeProperty('visibility');}}
  if(hide){s.setProperty('visibility','hidden');setTimeout(show,4000);}
  navigator.serviceWorker.register(r+'staging-sw.js',{scope:r}).then(function(){
    if(navigator.serviceWorker.controller||sessionStorage.getItem(k))return show();
    return navigator.serviceWorker.ready.then(function(){sessionStorage.setItem(k,'1');location.reload();});
  }).catch(show);
}
measure();share();
if(document.readyState!=='loading')go();else document.addEventListener('DOMContentLoaded',go);
window.addEventListener('resize',measure);window.addEventListener('load',measure);
})();`;

/** The client's file at the preview root, written by {@link run} beside `staging.json`. */
export const BANNER_SCRIPT = "staging-banner.js";

/**
 * The inline half: reserve the banner's height before the first paint (the
 * banner is fixed, so the page would otherwise jump when the client loads),
 * then load {@link CLIENT} from the preview root. Off a preview path, or when
 * the client cannot be fetched, it says so in the banner: the static text
 * already says FEATURE BRANCH, and nothing here can make it say otherwise.
 */
export const LOADER = `(function(){
var b=document.querySelector('[data-fa-staging-banner]'),d=document.querySelector('[data-fa-staging-detail]');
if(b)document.documentElement.style.setProperty('--fa-staging-offset',b.getBoundingClientRect().height+'px');
var m=location.pathname.match(/^(.*\\/(?:branches|STAGING)\\/[^/]+\\/)/);
if(!m){if(d)d.textContent='\\u2014 build details unavailable (not served from a preview path)';return;}
var s=document.createElement('script');s.src=m[1]+'${BANNER_SCRIPT}';
s.onerror=function(){if(d)d.textContent='\\u2014 build details unavailable';};
(document.head||document.documentElement).appendChild(s);
})();`;

/**
 * The fragment injected after the opening `<body>` tag. **Constant** — it
 * takes no argument, which is the whole property this change buys and is why
 * it is a `const` rather than a function.
 *
 * The static text says FEATURE BRANCH before any fetch happens, so a page
 * served with a broken or missing `staging.json` still announces itself.
 *
 * `lang="en" dir="ltr"` (bean `giiw`): the banner is one English sentence on
 * every locale's page. Measured on the Arabic home page with it inheriting
 * `dir="rtl"`: the links kept their order and each `↗` its side, because
 * every run between them is strong LTR text — but the 🔀 that opens the
 * sentence is a neutral at the paragraph's edge, took the paragraph's
 * direction, and was drawn at the far right, after "build log". The attribute
 * is what makes that a property of the banner rather than of what happens to
 * be in it, and `lang` is what tells a screen reader to read it as English.
 */
export const FRAGMENT =
  `<div data-fa-staging-banner lang="en" dir="ltr" style="${BANNER_STYLE}">\u{1F500} <b>FEATURE BRANCH</b> ` +
  `<span data-fa-staging-detail>— loading build details…</span></div>` +
  OFFSET_STYLE +
  `<script>${LOADER}</script>`;

/**
 * Every `*.html` under `dir`, as absolute paths — except the pinned pdf.js
 * viewer's. That page is only ever seen inside a frame on one of ours, which
 * already carries the banner; a second banner inside the PDF frame is noise,
 * and it is Mozilla's markup besides (bean `folio-assistant-5ea6`).
 */
function htmlFiles(dir: string, out: string[] = [], root: string = dir): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) htmlFiles(full, out, root);
    else if (name.endsWith(".html") && !isVendoredViewer(relative(root, full))) out.push(full);
  }
  return out;
}

/**
 * The first `<body …>` that is REAL — i.e. not inside an HTML comment.
 *
 * ## Why this is not `html.search(/<body/i)`
 *
 * It was, and it put the banner inside a comment on 323 of 670 staged pages —
 * 48 % of a preview, measured on the deployed tree, 2026-09-21. The prose
 * comment in `docs/_includes/head_custom.html` that explains why a `<meta>`
 * is used rather than a `<div>` contains the words `<body>` as an EXAMPLE:
 *
 *     A browser hoists a stray `<div>` into `<body>` and the code still works
 *
 * `head_custom.html` is in the `<head>` of every just-the-docs page, so that
 * sentence is the first `<body>` in the file and the non-global `replace`
 * spent its one substitution on it. The real tag, hundreds of lines later,
 * got nothing. The IRIS replica's pages were fine because they are generated
 * without that include — which is why the failure looked like a replica
 * feature rather than a bug.
 *
 * **A comment about the banner broke the banner**, and nothing said so: the
 * page still contained `data-fa-staging-banner`, so every check that asked
 * "did the string land" answered yes.
 *
 * Returns the index just past the opening tag, or `-1` when the document has
 * no real `<body>` at all.
 */
export function bodyInsertionPoint(html: string): number {
  const inComment = commentGuard(html);
  for (const m of html.matchAll(/<body[^>]*>/gi)) {
    if (!inComment(m.index!)) return m.index! + m[0].length;
  }
  return -1;
}

/**
 * What happened to one page. THREE states, not two, and the third is the one
 * that was being reported as success: a page the injector could not place the
 * banner in looked exactly like a page it had just placed it in, because the
 * only question asked was "did the bytes change".
 */
export type Injection = "injected" | "already" | "no-body";

/**
 * Inject after the WHOLE opening tag, not the literal `<body`.
 *
 * Matching `<body` alone re-emitted `<body>` and left the original tag's own
 * `>` behind, so every staged page carried a stray `>` after the banner — and
 * any `<body>` carrying attributes came out as `<body>BANNER class="…"">`:
 * attributes orphaned as visible text, and the real tag stripped of them.
 *
 * Idempotent: a page that already carries the banner is left alone, so a
 * second pass over a tree is a no-op rather than a doubled banner.
 */
export function injectInto(html: string): { html: string; outcome: Injection } {
  // The banner ELEMENT, not the bare word: the review page names the attribute
  // in its own CSS and script (to hide the banner inside its preview frames),
  // and a plain substring test took that for a banner and left the page
  // without one (owner, 2026-10-31: "what happened to staging bar at top?").
  if (/<[a-z][a-z0-9-]*\s[^>]*data-fa-staging-banner[\s=>]/i.test(html)) return { html, outcome: "already" };
  const at = bodyInsertionPoint(html);
  if (at < 0) return { html, outcome: "no-body" };
  return { html: html.slice(0, at) + FRAGMENT + html.slice(at), outcome: "injected" };
}

export function run(
  site: string,
  facts: StagingFacts,
): { injected: number; skipped: number; noBody: string[]; redirects: number } {
  writeFileSync(join(site, "staging.json"), JSON.stringify(facts, null, 2) + "\n");
  writeFileSync(join(site, BANNER_SCRIPT), CLIENT + "\n");
  let injected = 0;
  let skipped = 0;
  let redirects = 0;
  const noBody: string[] = [];
  for (const f of htmlFiles(site)) {
    const before = readFileSync(f, "utf-8");
    const { html: after, outcome } = injectInto(before);
    // A bodiless redirect stub is never shown: the browser leaves it at once
    // for the page it names, which carries its own banner. Counted, not failed
    // (a downstream catalogue forwarding page, 2026-11-01).
    if (outcome === "no-body" && isRedirectStub(before)) redirects++;
    else if (outcome === "no-body") noBody.push(relative(site, f));
    else if (outcome === "already") skipped++;
    else {
      writeFileSync(f, after);
      injected++;
    }
  }
  return { injected, skipped, noBody, redirects };
}

/**
 * An immediate `<meta http-equiv="refresh" content="0; url=…">` with no
 * real `<body>`: a forwarding stub, not a page a reader sees.
 */
export function isRedirectStub(html: string): boolean {
  return /<meta\s[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["']?\s*0\s*[;,]\s*url\s*=/i.test(html);
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function required(name: string): string {
  const v = flag(name);
  if (v === undefined || v === "") {
    console.error(`staging-banner: --${name} is required`);
    process.exit(2);
  }
  return v;
}

if (import.meta.main) {
  const site = required("site");
  const mainSite = required("main-site").replace(/\/+$/, "");
  const issue = flag("issue") || null;
  // `--build-type` names what this build is; a caller that does not pass it
  // writes no `buildType`, which `pc:release freeze` reads as "unstated".
  const bt = flag("build-type");
  if (bt && !(BUILD_TYPES as readonly string[]).includes(bt)) {
    console.error(`--build-type is ${BUILD_TYPES.join(" or ")}, not ${JSON.stringify(bt)}`);
    process.exit(2);
  }
  const buildType = (bt || undefined) as BuildType | undefined;

  // The publish ref's page list, one path per line, or absent. An EMPTY file
  // is not the same as no file: absent means the fetch failed and we do not
  // know, which is the third state `mainPagesKnown` carries.
  const mainPagesFile = flag("main-pages");
  let mainPagesKnown = false;
  let newPages: string[] = [];
  if (mainPagesFile) {
    const listed = new Set(
      readFileSync(mainPagesFile, "utf-8").split("\n").map((l) => l.trim()).filter(Boolean),
    );
    if (listed.size > 0) {
      mainPagesKnown = true;
      newPages = htmlFiles(site)
        .map((f) => relative(site, f))
        .filter((rel) => !listed.has(rel))
        .sort();
    }
  }

  const facts: StagingFacts = {
    branch: required("branch"),
    sha: required("sha"),
    built: required("built"),
    pr: required("pr"),
    prUrl: required("pr-url"),
    branchUrl: required("branch-url"),
    issue,
    issueUrl: issue ? `${required("issues-url").replace(/\/+$/, "")}/${issue}` : null,
    runUrl: required("run-url"),
    checksUrl: flag("checks-url") || null,
    mainSite,
    beforeRef: flag("before-ref") || null,
    mainPagesKnown,
    ...(buildType ? { buildType } : {}),
    newPages,
  };

  const { injected, skipped, noBody, redirects } = run(site, facts);
  console.log(
    mainPagesKnown
      ? `Read the publish ref; ${newPages.length} page(s) have no counterpart on main`
      : "Could not read the publish ref — compare links fall back to the site root",
  );
  console.log(
    `Injected the constant staging banner into ${injected} HTML file(s)` +
      (skipped ? ` (${skipped} already carried it)` : "") +
      (redirects ? `, skipped ${redirects} redirect stub(s)` : "") +
      ` and wrote staging.json`,
  );

  // A PAGE WITH NO BANNER IS INDISTINGUISHABLE FROM THE LIVE SITE, which is
  // the whole reason the banner exists — so this fails the build rather than
  // printing a warning nobody reads in a green job. Measured before making it
  // fatal: of 670 pages on the deployed preview, 0 had no `<body>`, so this
  // branch costs nothing today and catches the day a generator emits a
  // fragment as a page.
  if (noBody.length > 0) {
    console.error(
      `\n${noBody.length} page(s) have no <body> tag outside a comment, so they carry NO banner:`,
    );
    for (const f of noBody.slice(0, 20)) console.error(`  · ${f}`);
    if (noBody.length > 20) console.error(`  … and ${noBody.length - 20} more`);
    process.exit(1);
  }
}
