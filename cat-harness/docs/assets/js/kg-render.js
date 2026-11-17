/**
 * The shared client-side renderer — DOM construction, the three-state fetch,
 * and the one attribute that says whether this page has finished rendering.
 *
 * ## Why this file exists at all
 *
 * `docs/architecture/folio-board-requirements.md` §R4 was relaxed by the owner
 * on 2026-10-02 from *"reachable without JavaScript"* to *"reachable without
 * XSS"*. That permits a rendering to fetch its content and build it in the
 * browser, and it is what makes the obvious remedy legal: the dominant cost in
 * a published preview is site-wide data serialised into every page. Measured
 * 2026-10-02 over 1571 pages of one preview, the `fa-translation-index` island
 * alone was **14.26 MB of ONE byte-identical 9.3 KB payload**.
 *
 * The relaxation came with two obligations, and they are requirements rather
 * than implementation notes:
 *
 *   1. **print and PDF wait for load and render before printing**;
 *   2. **a load that FAILS says so** rather than rendering as empty.
 *
 * Neither can be met by each caller separately — the first is a property of
 * the whole PAGE, not of one region, and the second was already answered three
 * different ways in this repository. So both live here, once.
 *
 * ## Which pattern this is, and why not the other one
 *
 * Two patterns existed. `work-plan.js` is a shared external script that
 * self-mounts on a data attribute, takes its data URL from a `<meta>` the PAGE
 * declares, and reaches the DOM through `createElement`/`textContent` only.
 * The five `gen-*-viz.ts` generators inline a per-page `<script>` that assigns
 * `innerHTML` with a hand-rolled `esc()`.
 *
 * This is the first one, for the reason R4 keeps even while relaxing: an
 * `innerHTML` site is correct only as long as its escaper is, and five
 * hand-rolled escapers on the hot path is five chances to be wrong — one of
 * them, `kg-viewer.ts`, has already drifted to a different NAME for it
 * (`escape` against `esc`). `createElement`/`textContent` cannot be wrong
 * about escaping because it never serialises. A conversion that multiplied
 * `innerHTML` sites by the number of generators converted would be spending
 * R4's relaxation on the one thing R4 kept.
 *
 * The second pattern wins on exactly one thing, and it is the thing the first
 * got wrong: on a failed fetch `gen-folio-viz.ts` writes the failure INTO the
 * page, while `work-plan.js` only called `console.warn`. A reader does not
 * open the console, so a console warning is not "says so". {@link failureNote}
 * and {@link emptyNote} promote that generator's wording into the shared
 * contract, and `work-plan.js` now uses it.
 *
 * ## No dependencies, no CDN, no build step
 *
 * The same rule `work-plan.js` and `kg-viewer.ts` state for themselves: a view
 * of this repository's data must be openable from a file, reviewable offline,
 * and must not add a third party to its own trust boundary. ES5 syntax, for
 * the same reason the rest of `assets/js` is.
 */
(function () {
  "use strict";

  /**
   * One element, with its attributes and its text.
   *
   * `textContent` rather than `innerHTML`, always. Lifted verbatim from
   * `work-plan.js`, which now consumes this one instead of keeping a copy:
   * two `el` helpers is two answers to how this site escapes.
   */
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] != null) node.setAttribute(k, attrs[k]);
      });
    }
    if (text != null) node.textContent = text;
    return node;
  }

  /**
   * Fetch JSON from `url`.
   *
   * THREE answers, and keeping them apart is the whole of this function:
   *
   *   - `undefined` — there is no url, so the page never asked for this graph.
   *   - `null` — there is a url and the fetch failed. Something is wrong.
   *   - the document — it was read.
   *
   * Collapsing the first two is how a page that deliberately shows only one
   * graph comes to report that the other one "could not be read", which is an
   * error message about a decision.
   *
   * `done` is called with `(doc, failure)` where `failure` is the reason
   * string on the `null` branch and `undefined` otherwise — because
   * {@link failureNote} needs the message and a caller that re-derives it from
   * the console cannot have it.
   */
  function fetchJson(url, done) {
    if (!url) return done(undefined);
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (doc) {
        done(doc == null ? null : doc, doc == null ? "the file held no document" : undefined);
      })
      .catch(function (e) {
        done(null, e && e.message ? e.message : String(e));
      });
  }

  /** {@link fetchJson}, with the url taken from `meta[name=<metaName>]`. */
  function fetchIndex(metaName, done) {
    var src = document.querySelector('meta[name="' + metaName + '"]');
    return fetchJson(src && src.getAttribute("content"), done);
  }

  /**
   * "Could not be loaded" is not "empty", and the note says which.
   *
   * The wording is `gen-folio-viz.ts:307-311`'s, promoted rather than
   * rewritten — it already says it well, and a second phrasing of one
   * distinction is two phrasings free to drift. `noun` names what the reader
   * was looking at ("folio", "glossary", "work plan") so the sentence reads as
   * a fact about THEIR page rather than about a fetch.
   *
   * The data file is linked, not just named: a reader who cannot see the
   * rendering can still read the artefact, which is the whole of what the
   * fallback prose was giving them before the fetch existed.
   */
  function failureNote(noun, url, message, cls) {
    var p = el("p", { class: cls || "fa-render-failed", role: "status" });
    p.appendChild(document.createTextNode("This " + noun + " could not be loaded from "));
    var safe = safeHref(url);
    if (safe === undefined) {
      p.appendChild(el("code", null, String(url)));
    } else {
      p.appendChild(el("a", { href: safe }, String(url)));
    }
    p.appendChild(document.createTextNode(
      ": " + (message || "no reason was reported") + ". That is not an empty " + noun +
      " — it is a " + noun + " that could not be loaded."
    ));
    return p;
  }

  /**
   * A DETERMINED empty, said as one.
   *
   * `gen-folio-viz.ts:281-283` already distinguishes *"a folio graph with no
   * nodes, not a graph that could not be read"*; this is that sentence, for
   * any noun. The pair is the point: either alone lets the two states look
   * identical to a reader, which is the third-state failure this repository
   * guards everywhere else.
   */
  function emptyNote(noun, cls) {
    return el("p", { class: cls || "fa-render-empty", role: "status" },
              "This " + noun + " holds nothing. That is a determined empty rather than a " +
              noun + " that could not be read.");
  }

  /**
   * The same allow-list the rest of the client uses, restated for this file.
   *
   * It is restated rather than imported because there is no module system
   * here, and `scripts/tests/href-safety.test.ts` is the join that stops the
   * two drifting. An escaper is the wrong tool for a scheme and looks like the
   * right one — see `schemas/safe-url.ts`.
   */
  var ALLOWED_URL_SCHEMES = ["http:", "https:", "mailto:", "tel:"];

  function safeHref(url) {
    if (url == null) return undefined;
    var trimmed = String(url).trim();
    if (trimmed === "") return undefined;
    // A relative reference carries no scheme and cannot smuggle one.
    if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed)) {
      return /^\s*\/\//.test(trimmed) ? undefined : trimmed;
    }
    var scheme = /^[A-Za-z][A-Za-z0-9+.-]*:/.exec(trimmed)[0].toLowerCase();
    return ALLOWED_URL_SCHEMES.indexOf(scheme) === -1 ? undefined : trimmed;
  }

  /* ═══ The render state ═══════════════════════════════════════════════════
   *
   * ONE declared attribute on `<html>`, three values, and the absent case is a
   * fourth answer rather than a missing one.
   *
   *   data-fa-render="pending"   a region on this page is still loading
   *                  "ready"     every region that registered has rendered
   *                  "failed"    a region could not load, or a region the
   *                              page declared never registered at all
   *   (absent)                   this page declares no dynamic region, so it
   *                              was never asked — the same third state
   *                              `fetchJson` keeps for `undefined`
   *
   * `head_custom.html` writes `pending` in `<head>`, from a script rather than
   * as a served attribute, because `scripts/set-html-lang.ts` rewrites the
   * `<html>` tag in the built tree and an attribute it does not know about
   * would be a thing for it to preserve. Set at first paint either way, which
   * is what the `@media print` rules in `docs-ui.css` need.
   *
   * ## Why not a fourth convention
   *
   * There were already three ready-signals for this one question —
   * `window.__faTodoBoard`, a `#status` element whose text stops saying
   * "Loading", and a `fa:todos-ready` event — and the only wrong move was to
   * add a fourth. So this is the UNION: every existing signal still fires,
   * and `data-fa-render` is the one a printer, a PDF renderer and a test can
   * read without knowing which regions a page happens to carry.
   *
   * ## Registration, and the declared MINIMUM that cross-checks it
   *
   * A region registers by calling {@link region} — `docs-ui.js` for the site
   * index at script evaluation, `work-plan.js` for its dashboard at mount.
   * Readiness is only evaluated once `DOMContentLoaded` has fired, because
   * before that a region that is going to register has not had its chance and
   * "nothing is pending" would be indistinguishable from "nothing has started".
   *
   * `meta[name="fa-render-regions"]` is the MINIMUM — how many regions the
   * page is certain of, which for a just-the-docs page is the site index. It
   * is a cross-check rather than the count itself: a page may carry more
   * regions than its `<head>` can know about, because the work-plan host comes
   * from the page's own body and Liquid has not rendered that yet when the
   * `<head>` is written.
   *
   * FEWER registrations than the minimum is `failed`, not `ready`. That is the
   * `dh4f` guard, which this repository names repeatedly: a consumer that
   * scans nothing and reports a clean run over it. A renderer that simply
   * counted what registered could not tell "this page has no regions" from
   * "the script that owns the region never ran", and would flip to `ready`
   * over a page that rendered nothing.
   */

  /** The declared MINIMUM, or `null` when the page declares no regions. */
  var MINIMUM = (function () {
    var m = document.querySelector('meta[name="fa-render-regions"]');
    var n = m ? parseInt(m.getAttribute("content"), 10) : NaN;
    return isNaN(n) || n < 0 ? null : n;
  })();

  /** Regions by name, each `false` until it settles — so a double report cannot miscount. */
  var REGIONS = {};
  var REGISTERED = 0;
  var SETTLED = 0;
  var ANY_FAILED = false;
  var DOM_READY = false;

  function renderState() {
    return document.documentElement.getAttribute("data-fa-render");
  }

  function setRenderState(value) {
    document.documentElement.setAttribute("data-fa-render", value);
  }

  /**
   * Flip the attribute if the page's state is now known.
   *
   * `failed` is STICKY and `ready` is not reachable from it: one region that
   * could not load makes this a page that did not fully render, and a PDF of
   * it is not re-checkable after the fact. The event fires once, with the
   * final state, so a consumer cannot see `ready` and then `failed`.
   */
  function evaluate(lastRegion) {
    if (MINIMUM === null) return;              // this page declares no regions
    if (ANY_FAILED) {
      // Said as soon as it is known rather than at the end: a reader reaching
      // the print command mid-load should see the failure, not `pending`.
      if (renderState() !== "failed") {
        setRenderState("failed");
        document.dispatchEvent(new CustomEvent("fa:render-failed", { detail: { region: lastRegion } }));
      }
      return;
    }
    if (!DOM_READY) return;
    if (REGISTERED < MINIMUM) {
      // A region the page was certain of never registered. The script that
      // owns it did not run, or ran and threw before registering — either way
      // this page has NOT rendered what it said it would, and saying `ready`
      // here is the one answer that cannot be recovered from downstream.
      setRenderState("failed");
      if (window.console && console.warn) {
        console.warn("kg-render: this page declared at least " + MINIMUM + " dynamic " +
                     "region(s) and only " + REGISTERED + " registered, so it is reported " +
                     "as failed rather than ready. A region whose script never ran is not " +
                     "a page with nothing to load.");
      }
      document.dispatchEvent(new CustomEvent("fa:render-failed",
                                             { detail: { region: "unregistered" } }));
      return;
    }
    if (SETTLED < REGISTERED) return;
    if (renderState() !== "ready") {
      setRenderState("ready");
      document.dispatchEvent(new CustomEvent("fa:render-ready", { detail: { regions: SETTLED } }));
    }
  }

  function settle(name, failed) {
    if (failed) ANY_FAILED = true;
    if (REGIONS[name] === false) {
      REGIONS[name] = true;
      SETTLED += 1;
    }
    evaluate(name);
  }

  /**
   * Register one region and get its handle.
   *
   * Three calls rather than two, because "it rendered", "it rendered and there
   * was nothing in it" and "it could not be read" are three different facts
   * and the first two must not be told apart by counting children.
   *
   * Calling this twice for one name registers once: `work-plan.js` mounts at
   * most one dashboard per page, and a renderer that re-mounted would
   * otherwise raise the bar it then has to clear.
   */
  function region(name) {
    if (REGIONS[name] === undefined) {
      REGIONS[name] = false;
      REGISTERED += 1;
    }
    return {
      /** It rendered, with content. */
      ready: function () { settle(name, false); },
      /**
       * It rendered, and the graph is empty. Still `ready` for the PAGE: a
       * determined empty is a complete rendering, and printing it is correct.
       */
      empty: function () { settle(name, false); },
      /** It could not be read. The page is `failed` from here on. */
      failed: function () { settle(name, true); },
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { DOM_READY = true; evaluate(null); });
  } else {
    DOM_READY = true;
  }

  /**
   * The declared minimum, or `null` when the page declared none.
   *
   * Exposed so a test can assert the generator and the renderer agree about
   * the number rather than inferring it from a timing.
   */
  function expectedRegions() { return MINIMUM; }

  window.faRender = {
    el: el,
    fetchJson: fetchJson,
    fetchIndex: fetchIndex,
    failureNote: failureNote,
    emptyNote: emptyNote,
    safeHref: safeHref,
    region: region,
    renderState: renderState,
    expectedRegions: expectedRegions,
  };
})();
