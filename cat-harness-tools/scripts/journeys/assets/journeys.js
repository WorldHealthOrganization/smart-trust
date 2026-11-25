/* The journeys viewer's one script (cat-harness-tools scripts/journeys/).
   Dependency-free. Every page is complete without it; it adds:
   - the stepper on a journey page: one step at a time, prev/next, arrow keys,
     the step's column lit in the journey map, the step kept in the URL hash;
   - the filter on an index page;
   - a table's assessment ticks, remembered in this browser only;
   - the print buttons. */
(function () {
  "use strict";
  var doc = document;

  // The page's catalogue for the words this script writes (`journeys/locales.ts`); English without one.
  var I18N = (function () {
    try {
      var n = typeof document !== "undefined" && document.getElementById("jv-i18n");
      return n ? JSON.parse(n.textContent) : {};
    } catch (_e) {
      return {};
    }
  })();
  function T(s) {
    return I18N[s] || s;
  }

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (_e) {
      return null;
    }
    return null;
  }

  function stepper(root) {
    var steps = Array.prototype.slice.call(root.querySelectorAll(".jv-step"));
    if (steps.length < 2) return;
    var nav = root.querySelector(".jv-stepnav");
    var bar = root.querySelector(".jv-actions");
    var all = doc.createElement("button");
    all.type = "button";
    all.className = "jv-btn";
    all.textContent = T("Show all steps");
    all.setAttribute("aria-pressed", "false");
    if (bar) bar.insertBefore(all, bar.firstChild);
    var showingAll = false;

    function idOf(el) {
      return el.getAttribute("data-step");
    }
    function show(i, focus) {
      if (i < 0 || i >= steps.length) return;
      var id = idOf(steps[i]);
      steps.forEach(function (s, k) {
        s.hidden = !showingAll && k !== i;
      });
      if (nav) {
        Array.prototype.forEach.call(nav.querySelectorAll("a"), function (a) {
          if (a.getAttribute("data-step") === id) a.setAttribute("aria-current", "step");
          else a.removeAttribute("aria-current");
        });
      }
      Array.prototype.forEach.call(doc.querySelectorAll(".jv-map .jv-cell"), function (c) {
        c.classList.toggle("is-current", c.getAttribute("data-step") === id);
      });
      current = i;
      if (focus) {
        steps[i].focus({ preventScroll: true });
        steps[i].scrollIntoView({ block: "start" });
      }
    }
    function indexOfHash() {
      var h = decodeURIComponent(location.hash.slice(1));
      for (var k = 0; k < steps.length; k++) if (steps[k].id === h) return k;
      return -1;
    }
    var current = Math.max(0, indexOfHash());
    all.addEventListener("click", function () {
      showingAll = !showingAll;
      all.setAttribute("aria-pressed", String(showingAll));
      all.textContent = showingAll ? T("One step at a time") : T("Show all steps");
      show(current, false);
    });
    window.addEventListener("hashchange", function () {
      var k = indexOfHash();
      if (k >= 0) show(k, true);
    });
    doc.addEventListener("keydown", function (ev) {
      var t = ev.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (ev.key === "ArrowRight" && current < steps.length - 1) location.hash = steps[current + 1].id;
      if (ev.key === "ArrowLeft" && current > 0) location.hash = steps[current - 1].id;
    });
    show(current, indexOfHash() >= 0);
    window.addEventListener("beforeprint", function () {
      steps.forEach(function (s) {
        s.hidden = false;
      });
    });
    window.addEventListener("afterprint", function () {
      show(current, false);
    });
  }

  function filter(input) {
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      // A list item stays when its own card or any card below it matches.
      Array.prototype.forEach.call(doc.querySelectorAll("li"), function (li) {
        var cards = li.querySelectorAll("[data-jv-text]");
        if (!cards.length) return;
        var hit = !q;
        for (var k = 0; !hit && k < cards.length; k++) hit = cards[k].getAttribute("data-jv-text").indexOf(q) >= 0;
        li.classList.toggle("jv-hidden", !hit);
      });
    });
  }

  function remember(input) {
    var key = "jv:" + input.name;
    if (store(key) === input.value) input.checked = true;
    input.addEventListener("change", function () {
      if (input.checked) store(key, input.value);
    });
  }

  function init() {
    Array.prototype.forEach.call(doc.querySelectorAll("[data-jv-stepper]"), stepper);
    Array.prototype.forEach.call(doc.querySelectorAll("[data-jv-filter]"), filter);
    Array.prototype.forEach.call(doc.querySelectorAll("input[data-jv-store]"), remember);
    Array.prototype.forEach.call(doc.querySelectorAll("[data-jv-print]"), function (b) {
      b.addEventListener("click", function () {
        window.print();
      });
    });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})();
