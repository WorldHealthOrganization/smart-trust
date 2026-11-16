// page-layout.js: the scrolling half of page-layout.css (cat-harness-tools
// `scripts/page-layout.ts`, which says why). Three things, each a no-op on a
// page that does not need it. Plain ES5, no dependencies, idempotent.
//
// 1. The stuck bar's height as `--fa-page-bar-h` on <html>, which the
//    stylesheet's `scroll-padding-top` reads, so an anchor or a focus scroll
//    lands below the bar rather than under it. 0 while the bar is not stuck.
// 2. A `#hash` whose target the page draws AFTER load (a thin page draws from
//    JSON): scrolled to once, when it appears. The browser tried at load, when
//    there was nothing to scroll to.
// 3. Back, forward and reload return to where the reader was. The browser's
//    own restore ran before the drawn content existed and stopped short.
// 4. A bar whose page made its BODY the centred column (a replica page's own
//    `body{max-width:…;margin:0 auto}`) is drawn full width anyway, from the
//    rail's edge to the window's and flush with the top, as on every other
//    page (owner, 2026-10-15: "the top bar must be FULL WIDTH").
(function () {
  "use strict";
  var root = document.documentElement;
  if (root.hasAttribute("data-fa-page-layout")) return;
  root.setAttribute("data-fa-page-layout", "");

  function bar() {
    return document.querySelector(".fa-page-bar");
  }

  function measure() {
    var b = bar();
    if (!b) return;
    var stuck = window.getComputedStyle(b).position === "sticky";
    root.style.setProperty("--fa-page-bar-h", stuck ? Math.ceil(b.getBoundingClientRect().height) + "px" : "0px");
  }

  // A jump this script makes is instant. The theme sets
  // `scroll-behavior: smooth` on <html>, and a smooth jump on a page still
  // drawing animates toward a spot that keeps moving: on a long document it
  // stopped thousands of pixels short, then jumped again (dth-hrh, 2026-10-31).
  function instantly(f) {
    var s = root.style, was = s.scrollBehavior;
    s.scrollBehavior = "auto";
    try { f(); } finally { s.scrollBehavior = was; }
  }

  // Stop helping the moment the reader scrolls on their own.
  var reader = false;
  function readerMoved() { reader = true; }
  ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (t) {
    window.addEventListener(t, readerMoved, { passive: true, once: true });
  });

  function settleHash() {
    var h = window.location.hash;
    if (!h || h.length < 2) return;
    var id;
    try { id = decodeURIComponent(h.slice(1)); } catch (_e) { return; }
    if (document.getElementById(id) || typeof MutationObserver === "undefined") return;
    var mo = new MutationObserver(function () {
      var t = document.getElementById(id);
      if (!t) return;
      mo.disconnect();
      if (!reader) instantly(function () { t.scrollIntoView(); });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(function () { mo.disconnect(); }, 15000);
  }

  var KEY = "fa-page-scroll:" + window.location.pathname;
  function navigationType() {
    try {
      var e = window.performance.getEntriesByType("navigation")[0];
      return e ? e.type : "";
    } catch (_e) { return ""; }
  }
  function remember() {
    try { window.sessionStorage.setItem(KEY, String(Math.round(window.scrollY || 0))); } catch (_e) { /* private mode */ }
  }
  function restore() {
    var type = navigationType();
    if (type !== "back_forward" && type !== "reload") return;
    var y = 0;
    try { y = Number(window.sessionStorage.getItem(KEY)) || 0; } catch (_e) { return; }
    if (y <= 0) return;
    var tries = 0;
    (function step() {
      if (reader || Math.abs((window.scrollY || 0) - y) <= 2) return;
      if (root.scrollHeight - window.innerHeight >= y) { instantly(function () { window.scrollTo(0, y); }); return; }
      if (++tries < 50) window.setTimeout(step, 100);
    })();
  }

  // The browser jumped to the hash before the bar was measured, so the
  // target may sit under the bar: once more, now the padding is known.
  function rejumpHash() {
    var h = window.location.hash;
    if (!h || h.length < 2 || reader) return;
    var t;
    try { t = document.getElementById(decodeURIComponent(h.slice(1))); } catch (_e) { return; }
    if (t) instantly(function () { t.scrollIntoView(); });
  }

  var bleedQueued = false;
  function fullBleed() {
    bleedQueued = false;
    var b = bar();
    if (!b || b.parentElement !== document.body) return;
    var bs = window.getComputedStyle(document.body);
    if (bs.maxWidth === "none" && parseFloat(bs.paddingTop) === 0 && parseFloat(bs.marginLeft) === 0) return;
    b.style.marginLeft = ""; b.style.marginRight = ""; b.style.width = ""; b.style.maxWidth = ""; b.style.marginTop = "";
    var nav = document.querySelector("nav.fa-nav");
    var vw = root.clientWidth;
    // On a right-to-left page the rail is on the RIGHT (`navbar.css` uses
    // logical properties), so its edge is measured from that side and the bar
    // is placed from it.
    var rtl = bs.direction === "rtl";
    // At rest the rail is a strip, and the bar starts at its edge; opened over
    // the page it covers the bar's start, as it covers the content's.
    var edge = nav ? Math.max(0, rtl
      ? Math.min(vw - nav.getBoundingClientRect().left, parseFloat(bs.paddingRight) + parseFloat(bs.marginRight) || 0)
      : Math.min(nav.getBoundingClientRect().right, parseFloat(bs.paddingLeft) + parseFloat(bs.marginLeft) || 0)) : 0;
    var r = b.getBoundingClientRect();
    b.style.maxWidth = "none";
    b.style.width = (vw - edge) + "px";
    if (rtl) b.style.marginRight = (r.right - (vw - edge)) + "px";
    else b.style.marginLeft = (edge - r.left) + "px";
    b.style.marginTop = "-" + bs.paddingTop;
  }
  function queueBleed() {
    if (bleedQueued) return;
    bleedQueued = true;
    (window.requestAnimationFrame || setTimeout)(fullBleed);
  }

  function start() {
    fullBleed();
    window.addEventListener("resize", queueBleed);
    if (bar() && bar().parentElement === document.body) {
      // The bar's start is the rail's edge, and the rail MOVES it: pointed
      // at, focused or pinned, the rail opens and `navbar.css` widens body's
      // padding-left to match (56px to 264px, with a transition). A body
      // whose own max-width fixes its content box does not resize when only
      // its padding does, so watching the content box alone left the bar
      // where the closed rail ended, under the open one (measured: bar at
      // 264..1488 in a 1280px window). So the border box, the rail itself,
      // and the end of a padding transition each re-place it.
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(queueBleed).observe(document.body, { box: "border-box" });
        var rail = document.querySelector("nav.fa-nav");
        if (rail) new ResizeObserver(queueBleed).observe(rail);
      }
      document.body.addEventListener("transitionend", function (e) {
        if (e.target === document.body) queueBleed();
      });
    }
    measure();
    var b = bar();
    if (b && typeof ResizeObserver !== "undefined") new ResizeObserver(measure).observe(b);
    window.addEventListener("resize", measure);
    if (navigationType() !== "back_forward" && navigationType() !== "reload") rejumpHash();
    settleHash();
    restore();
  }

  window.addEventListener("pagehide", remember);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
