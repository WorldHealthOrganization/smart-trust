/*
 * Syntax colours for JSON (and XML) shown on a page — cat-harness#1241.
 *
 * Most JSON on the sites is written into the page by a script after it loads
 * (the IG's JSON, schema and JSON-LD views, tool outputs), so Rouge, which
 * colours Markdown code fences at build time, never sees it. This script
 * colours it in the browser instead.
 *
 * Loaded on demand (owner, Q-JSON-1 = B, "dynamic load"): a page with no
 * JSON or XML block fetches nothing. The first time a block with content
 * appears, the script loads vendor/highlight/highlight.min.js (highlight.js
 * core + json + xml, about 9 KB gzipped) and assets/css/code-highlight.css,
 * once, and the browser caches both.
 *
 * Blocks filled later are watched for: when a block's text changes, it is
 * coloured again. Only the markup changes; the text, and so copy and print,
 * stays exactly what the page wrote.
 */
(function () {
  "use strict";

  // Blocks this script colours. Rouge's own blocks (inside `.highlight`) are
  // already coloured at build time and are left alone.
  var SELECTOR = "code.language-json, code.language-xml, pre.fa-tool-output-json";

  var BASE = (function () {
    try {
      var cs = document.currentScript;
      if (!cs || !cs.src) return "";
      var path = new URL(cs.src, location.href).pathname;
      var suffix = "/assets/js/code-highlight.js";
      return path.slice(-suffix.length) === suffix ? path.slice(0, -suffix.length) : "";
    } catch (_e) {
      return "";
    }
  })();

  function languageOf(el) {
    return /\blanguage-xml\b/.test(el.className) ? "xml" : "json";
  }

  // Only text that looks like the language is coloured, so a status line such
  // as "Loading JSON source…" or "Could not load JSON: 404" stays plain.
  function looksRight(text, lang) {
    var t = text.replace(/^\s+/, "");
    return lang === "xml" ? t.charAt(0) === "<" : t.charAt(0) === "{" || t.charAt(0) === "[";
  }

  var loading = null;
  function loadLibrary() {
    if (window.hljs) return Promise.resolve(window.hljs);
    if (loading) return loading;
    var css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = BASE + "/assets/css/code-highlight.css";
    document.head.appendChild(css);
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = BASE + "/assets/js/vendor/highlight/highlight.min.js";
      s.onload = function () {
        if (window.hljs) resolve(window.hljs);
        else reject(new Error("highlight.js did not define hljs"));
      };
      s.onerror = function () {
        reject(new Error("could not load vendor/highlight/highlight.min.js"));
      };
      document.head.appendChild(s);
    });
    loading.catch(function (e) {
      console.warn("code-highlight: " + e.message);
    });
    return loading;
  }

  // What each block's text was when it was last coloured: a block whose text
  // is unchanged is not coloured again (our own change to its markup would
  // otherwise wake the observer forever).
  var done = typeof WeakMap === "function" ? new WeakMap() : null;
  if (!done) return;

  function pending() {
    var out = [];
    var all = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest(".highlight")) continue;
      var text = el.textContent;
      if (done.get(el) === text) continue;
      if (!looksRight(text, languageOf(el))) {
        el.classList.remove("hljs");
        continue;
      }
      out.push(el);
    }
    return out;
  }

  function colour(hljs, el) {
    var text = el.textContent;
    if (done.get(el) === text) return;
    try {
      el.innerHTML = hljs.highlight(text, { language: languageOf(el), ignoreIllegals: true }).value;
      el.classList.add("hljs");
    } catch (e) {
      console.warn("code-highlight: " + e.message);
    }
    done.set(el, el.textContent);
  }

  var queued = false;
  function scan() {
    queued = false;
    var els = pending();
    if (!els.length) return;
    loadLibrary().then(function (hljs) {
      for (var i = 0; i < els.length; i++) colour(hljs, els[i]);
    }, function () { /* warned once in loadLibrary */ });
  }

  function schedule() {
    if (queued) return;
    queued = true;
    (window.requestAnimationFrame || setTimeout)(scan);
  }

  // Exposed for a script that fills a block and wants it coloured at once.
  window.faHighlightCode = schedule;

  function start() {
    schedule();
    if (typeof MutationObserver !== "function") return;
    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
