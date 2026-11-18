// draft-banner.js: a DRAFT banner on every page served anywhere but the
// official published host (cat-harness-tools `scripts/page-layout.ts`, which
// links it beside page-layout.js on every railed page, folio and IG alike).
//
// Owner, 2026-11-17: "Every page published anywhere other than smart.who.int
// (worldhealthorganization.github.io/…, litlfred.github.io/…, branch
// previews) must show a clear DRAFT banner at the top. smart.who.int must
// not." Decided HERE, from `location.hostname` at load, never at build: one
// build is copied between hosts, so only the page knows where it is served.
//
// Rules this keeps:
// - "Could not tell" is DRAFT. Only an exact match on an official host hides
//   the banner; file://, localhost, a mirror and a preview all show it.
// - A branch preview already carries the staging banner, which is fixed at
//   the top and reserves its own room: the word DRAFT is put at its start,
//   not drawn as a second strip under or over it.
// - Otherwise the banner is FIXED at the top, above the rail, and its height
//   is published as `--fa-staging-offset`, the offset every fixed or sticky
//   top chrome here already reads (the rail, the page bar, anchor margins),
//   and `html` is padded by it, as the staging banner's own style does.
// - Text only, by textContent; no markup is built from a string.
// Plain ES5, no dependencies, idempotent.
(function () {
  "use strict";
  // The ONE official host. A page served from any other is a draft.
  var OFFICIAL_HOSTS = ["smart.who.int"];
  var root = document.documentElement;
  if (root.hasAttribute("data-fa-draft") || root.hasAttribute("data-fa-official")) return;
  var host = String(window.location.hostname || "").toLowerCase();
  if (OFFICIAL_HOSTS.indexOf(host) >= 0) {
    root.setAttribute("data-fa-official", "");
    return;
  }
  root.setAttribute("data-fa-draft", "");

  var BG = "#b3261e"; // white on it 6.5:1, past WCAG AA; distinct from the preview's sage and the release's purple
  var WORD = "DRAFT";
  var NOTE = "not an official publication";

  function chipInto(staging) {
    if (staging.querySelector("[data-fa-draft-chip]")) return;
    var chip = document.createElement("span");
    chip.setAttribute("data-fa-draft-chip", "");
    chip.setAttribute("style", "font-weight:700;letter-spacing:.06em;background:" + BG + ";color:#fff;padding:1px 8px;border-radius:3px;margin-inline-end:.5em");
    chip.textContent = WORD;
    staging.insertBefore(chip, staging.firstChild);
  }

  function strip() {
    var b = document.createElement("div");
    b.setAttribute("data-fa-draft-banner", "");
    b.setAttribute("role", "note");
    b.setAttribute("style",
      "position:fixed;top:0;left:0;right:0;z-index:2147483001;box-sizing:border-box;margin:0;padding:6px 16px;" +
      "background:" + BG + ";color:#fff;text-align:center;font:14px/1.5 var(--fa-font-sans,system-ui,sans-serif)");
    var w = document.createElement("strong");
    w.setAttribute("style", "letter-spacing:.08em");
    w.textContent = WORD;
    b.appendChild(w);
    b.appendChild(document.createTextNode(" — " + NOTE));
    var style = document.createElement("style");
    style.setAttribute("data-fa-draft-banner-style", "");
    style.textContent =
      "html{padding-top:var(--fa-staging-offset,0px)}" +
      ".side-bar,.fa-nav{top:var(--fa-staging-offset,0px)!important}";
    (document.head || root).appendChild(style);
    document.body.insertBefore(b, document.body.firstChild);
    function measure() {
      root.style.setProperty("--fa-staging-offset", Math.ceil(b.getBoundingClientRect().height) + "px");
    }
    measure();
    window.addEventListener("resize", measure);
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(measure).observe(b);
  }

  function mount() {
    if (document.querySelector("[data-fa-draft-banner]")) return;
    var staging = document.querySelector("[data-fa-staging-banner]");
    if (staging) chipInto(staging);
    else strip();
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
