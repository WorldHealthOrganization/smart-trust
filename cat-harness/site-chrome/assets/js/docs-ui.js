/*
 * Docs-site UI: a QR of the current page in the sidebar header, and zoom /
 * full-width controls on the workflow figures.
 *
 * Loaded as an external same-origin script with no inline handlers, so the
 * site needs no script-src relaxation. Nothing here interpolates a URL into
 * markup: the QR carries the address in module geometry, and the caption is
 * set through textContent. The only innerHTML assignment takes the vendored
 * encoder's own <svg>, which is built from bits rather than from the string.
 *
 * The QR encoder (vendor/qrcode.js, qrcode_UTF8.js) is loaded on first use by
 * navbar-row.js's `window.faEnsureQrcode`.
 * Cross-checked by scripts/tests/qr.test.ts, which decodes the encoder's
 * output with an independent reader.
 *
 * KNOWN LIMITATION, stated rather than hidden. Those tests cover the
 * ENCODER. Nothing tests the INTEGRATION -- whether the sidebar markup this
 * script hooks into is really what just-the-docs emits. `_config.yml` uses
 * `remote_theme: just-the-docs/just-the-docs` UNPINNED, so that markup can
 * change with no commit in this repo, and the site cannot be built in the
 * environment this was written in (no network for the remote theme, and no
 * DOM library to stand in for a browser).
 *
 * So the mount below DEGRADES LOUDLY rather than silently: several selectors
 * are tried, the control still mounts into the header when the title anchor
 * is not where it expects, and a miss warns to the console naming what was
 * looked for. A feature that quietly does nothing is indistinguishable from
 * a feature nobody clicked. This is mitigation, not verification.
 */
(function () {
  "use strict";

  /* THE SITE ROOT AS THIS SCRIPT WAS SERVED FROM IT — the last fallback for
   * a page that declares no base at all. A `who-iris` replica page carries no
   * `fa-baseurl` and no `fa-todo-src` (no Jekyll wrote it), but it loaded this
   * file from `<root>assets/js/docs-ui.js`, so the root is on the script's own
   * address. Read ONCE, here, because `document.currentScript` is only set
   * while the script is first evaluated. Empty for an inline copy (every e2e
   * fixture), which is the previous behaviour. Bean `zrvt`. */
  /* A PINNED COPY declares where the platform is (owner, 2026-10-15, "pinned
   * copy per site"). A folio's or an IG's site now ships this file itself, at
   * its pinned platform version, instead of loading it live from the
   * platform's site, so the script's own address is that site's, not the
   * platform's. The page then names the platform's base in
   * `<meta name="fa-platform-base">` (written by `rail-standalone-pages.ts
   * --foreign-site`), and it answers what the script's address used to. */
  var SCRIPT_BASE = (function () {
    try {
      var pm = document.querySelector('meta[name="fa-platform-base"]');
      var pv = pm && pm.getAttribute("content");
      if (pv) return pv.replace(/\/+$/, "");
      var cs = document.currentScript;
      if (!cs || !cs.src) return "";
      var path = new URL(cs.src, location.href).pathname;
      var suffix = "/assets/js/docs-ui.js";
      return path.slice(-suffix.length) === suffix ? path.slice(0, -suffix.length) : "";
    } catch (_e) {
      return "";
    }
  })();

  /* The address this document was fetched from: what a page-relative base
   * resolves against, even after a `history.replaceState` (see `absoluteBase`). */
  var LOADED_FROM = (function () {
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      if (nav && nav.name) return nav.name;
    } catch (_e) { /* older engines: the address bar at load is the best there is */ }
    return location.href;
  })();

  var ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3, 4];
  var DEFAULT_STEP = 3; // index of 1.0

  /* ═══ The site index ═════════════════════════════════════════════════════
   *
   * The translation index used to be inlined into the `<head>` of every page
   * as `<script type="application/json" id="fa-translation-index">`. Measured
   * 2026-10-02 over 1571 pages of one preview: **9.3 KB per page, 14.26 MB in
   * total, and ONE distinct payload** — the largest duplicated payload in a
   * published preview, by a wide margin. It is now published once at
   * `assets/harness/site.json` and fetched here.
   *
   * It was never reader-facing. `mountNavLocale` was its only consumer, so
   * nothing a reader sees moves behind a fetch, and nothing a link checker or
   * the site search index reads moves at all — a `<script>` body is not
   * indexed, and the nav hrefs this rewrites were ALREADY rewritten in the
   * browser before this change.
   *
   * The two obligations that come with building a rendering client-side are in
   * `skills/ui/ui-core/ui-accessibility.md` §"A rendering built client-side
   * owes two things the static one gave for free": print and PDF must wait for
   * load and render, and a load that FAILS must say so. `assets/js/kg-render.js`
   * carries both, and this file reports into it through {@link siteIndexRegion}.
   *
   * ## The island still wins where there is one
   *
   * `getTranslationIndex` reads its island FIRST and falls back to this
   * document. That is not a migration artefact, it is the contract
   * `assets/harness/tiles.json` already states for the tile list: one
   * declaration, two ways it reaches a page. A page Jekyll did not build
   * carries neither the island nor the `<meta>`; an e2e fixture carries the
   * island and has no server to fetch from. Both must work.
   *
   * ## Only `mountNavLocale` waits, and that is deliberate
   *
   * `init()` is a strictly ordered sequence and its own comments say why —
   * `mountActionTiles` before `mountNavIconRow` because the row proxies that
   * panel's button, and `mountDocumentIndex` before `mountInstanceGraphs`
   * because the second MOVES the node the first inserts against. Gating the
   * whole of it on a fetch would put every mount on this page — the figures,
   * the QA panels, the glass — behind one request, which is a far worse
   * failure than a navbar that is not localised.
   *
   * So the fetch gates exactly the one function that needs it.
   * `mountNavLocale` only sets attributes on `.site-nav` and rewrites nav
   * hrefs in place; nothing later in `init()` reads what it wrote.
   *
   * Started at script evaluation rather than at `DOMContentLoaded`: this file
   * is `defer`red, so evaluation happens before that event and the request is
   * usually resolved by the time anything wants it.
   *
   * `SITE_INDEX_WAIT_MS` is the cap. On timeout the index settles as `null`,
   * which `getTranslationIndex` already handles — it is the same answer as a
   * missing island, which is the state that function was written for, and it
   * leaves the navbar exactly as built rather than claiming the folio has no
   * translations.
   */
  var SITE_INDEX_WAIT_MS = 2500;

  /**
   * The fetched document, or `null` once we know we are not getting one.
   *
   * THREE states while loading and they are kept apart: `undefined` means the
   * request has not settled, `null` means it settled with no document (no
   * `<meta>`, a 404, a parse error or the timeout), and an object means it was
   * read. Nothing reads this until {@link withSiteIndex} has called back, so
   * `undefined` can never be mistaken for `null`.
   */
  var SITE_INDEX;

  var SITE_INDEX_WAITERS = [];
  var SITE_INDEX_SRC = (function () {
    var m = document.querySelector('meta[name="fa-site-index-src"]');
    return (m && m.getAttribute("content")) || "";
  })();

  /**
   * Tell `kg-render.js` how this region ended, so the PAGE can say whether it
   * finished rendering.
   *
   * A no-op where `kg-render.js` did not load — a generated dashboard that
   * writes its own `<head>`. Absent is a real answer there rather than a
   * failure to report: such a page declares no regions, so it carries no
   * `data-fa-render` either, and the two agree.
   */
  function siteIndexRegion() {
    return (window.faRender && window.faRender.region)
      ? window.faRender.region("site-index")
      : { ready: function () {}, empty: function () {}, failed: function () {} };
  }

  /**
   * Record how the site index turned out, and tell the page.
   *
   * THE REGION REPORTS ON EVERY PATH, including the one where there was
   * nothing to fetch. The three states of the DATA — never asked, asked and
   * failed, read — are not the same question as the three states of the PAGE,
   * and conflating them was a real defect caught by
   * `test/site-index.e2e.ts`: a page carrying no `fa-site-index-src` left the
   * region unregistered, so `kg-render.js` saw a declared region that never
   * registered and reported the whole page as `failed`. "This page never asked
   * for a site index" is a COMPLETE rendering — there is nothing pending and
   * nothing broken — so it is `ready`.
   *
   * Only the middle case is `failed`, and it is `failed` in the DOM as well as
   * in the console: `ui-accessibility` is explicit that a `console.warn` alone
   * reaches a developer with the console open and no reader ever. Both happen
   * rather than one replacing the other, because they reach different people.
   */
  function siteIndexSettled(doc, failure) {
    if (SITE_INDEX !== undefined) return;         // first answer wins
    SITE_INDEX = doc == null ? null : doc;
    if (SITE_INDEX === null && SITE_INDEX_SRC) {
      siteIndexRegion().failed();
      console.warn("docs-ui: could not read the site index at " + SITE_INDEX_SRC +
                   " (" + (failure || "no reason reported") + "); the navbar is left " +
                   "exactly as built. This is NOT a claim that the folio has no " +
                   "translations. Run: bun run cat translation:index");
    } else {
      // Read, or never asked. A document with `translations: null` lands here
      // too and belongs here: the build DETERMINED that there is no
      // translation data, which is an answer rather than a failure, and
      // `getTranslationIndex` turns it into the same `null` a missing island
      // gives. The navbar says `unknown`; the page is `ready`.
      siteIndexRegion().ready();
    }
    var waiting = SITE_INDEX_WAITERS;
    SITE_INDEX_WAITERS = [];
    for (var i = 0; i < waiting.length; i++) waiting[i]();
  }

  /** Call `done` once the site index has settled, or the cap has elapsed. */
  function withSiteIndex(done) {
    if (SITE_INDEX !== undefined) return done();
    SITE_INDEX_WAITERS.push(done);
  }

  (function startSiteIndex() {
    if (!SITE_INDEX_SRC) {
      // No `<meta>`: this page never asked for a site index, so the island is
      // the only source and this is exactly the pre-2026-10-02 path. NOT a
      // failure, and not reported as one.
      return siteIndexSettled(undefined, undefined);
    }
    var fetchJson = window.faRender && window.faRender.fetchJson;
    if (!fetchJson) {
      // `kg-render.js` did not load. Said rather than worked around: a second
      // copy of the three-state fetch would be a second answer to what a
      // failed load means.
      return siteIndexSettled(null, "kg-render.js did not load");
    }
    fetchJson(SITE_INDEX_SRC, siteIndexSettled);
    window.setTimeout(function () {
      siteIndexSettled(null, "the request did not settle within " + SITE_INDEX_WAIT_MS + " ms");
    }, SITE_INDEX_WAIT_MS);
  })();

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      // AN ABSENT VALUE MEANS AN ABSENT ATTRIBUTE. `setAttribute(k, undefined)`
      // writes the string "undefined", so `{ href: undefined }` produced
      // `href="undefined"` — a relative link to a page called `undefined`,
      // which is a link to somewhere wrong rather than no link at all.
      //
      // Two callers already relied on the intent: the language switcher passes
      // `href: undefined` for a locale that is not available, and `safeHref`
      // returns `undefined` for a URL a link may not carry. `pb04` in both
      // cases — no link beats a link to nowhere.
      if (attrs[k] === undefined || attrs[k] === null) return;
      node.setAttribute(k, attrs[k]);
    });
    if (text != null) node.textContent = text;
    return node;
  }

  /* THE CHROME'S OWN LANGUAGE, declared where it is written (bean `giiw`).
   *
   * Every string this file injects is authored in English, and none of it
   * goes through the page's translation pipeline. On an Arabic page that
   * English inherits `dir="rtl"` from <html>, and the bidi algorithm lays an
   * English sentence out right-to-left: its first words land at the RIGHT
   * end, and wherever the line is clipped the clip takes the sentence's
   * BEGINNING off the left edge. Measured on the unverified-translation
   * notice, from an owner screenshot of the Arabic staging preview.
   *
   * `lang` is the half a screen reader needs (it picks the voice), `dir` the
   * half the layout needs. Both are ATTRIBUTES rather than a CSS `direction`
   * rule, because the bidi algorithm reads `dir` and a stylesheet that fails
   * to load must not reverse a sentence. Applied to the element that holds
   * the English, never to a container whose ORDER should follow the page —
   * a row of badges still runs right-to-left on an Arabic page; each badge's
   * own text does not. */
  var CHROME_LANG = "en";
  function chromeText(node) {
    node.setAttribute("lang", CHROME_LANG);
    node.setAttribute("dir", "ltr");
    return node;
  }

  /* ── Language switcher ────────────────────────────────────────────────── */

  /* The bar picker's name, in the page's language (owner, 2026-11-10: the
     reference site reads "Select language" beside a translate glyph). One
     entry per UN language; any other locale falls back to English. */
  var SELECT_LANGUAGE = {
    "ar": "\u0627\u062E\u062A\u0631 \u0627\u0644\u0644\u063A\u0629",
    "zh": "\u9009\u62E9\u8BED\u8A00",
    "en": "Select language",
    "fr": "Choisir la langue",
    "ru": "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u044F\u0437\u044B\u043A",
    "es": "Seleccionar idioma"
  };

  // A translate glyph (a CJK character beside a Latin A), the reference
  // site's language mark. Material Icons "translate", Apache-2.0.
  var TRANSLATE_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>' +
    "</svg>";

  var CHEVRON_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";

  // Globe glyph for the toggle button
  var GLOBE_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<ellipse cx="12" cy="12" rx="4" ry="10" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.5"/>' +
    '<path d="M4.5 7h15M4.5 17h15" fill="none" stroke="currentColor" stroke-width="1"/>' +
    "</svg>";

  var LOCALE_NAMES = {
    "ar": "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", "zh": "\u4E2D\u6587", "en": "English",
    "fr": "Fran\u00E7ais", "ru": "\u0420\u0443\u0441\u0441\u043A\u0438\u0439", "es": "Espa\u00F1ol"
  };

  /* The six UN languages, matching `UN_LOCALES` in `schemas/content/translation.ts`.

     A FALLBACK, never the answer: `fa-translation-meta` carries the instance's
     own `supportedLocales`, and an instance may support more or fewer. This is
     what a page with no meta block falls back to, in one place, because the
     same array was written out three times below and the three were free to
     disagree with each other and with the schema. */
  var UN_LOCALES = ["ar", "zh", "en", "fr", "ru", "es"];

  /**
   * Every locale a reader can read THIS page in \u2014 the source language included.
   *
   * The source language is a language. An English page on a six-UN-language
   * site is available in one of them, not none, and the coverage badge read
   * `0/5` because both halves of that fraction excluded it: the denominator was
   * hardcoded to `supported.length - 1`, and the numerator came from
   * `available_locales`, which the generator derives by resolving
   * `translations/<locale>/<stem>.po` \u2014 a lookup the source language can never
   * satisfy, since there is no `translations/en/` and there never will be.
   *
   * So the page's own `lang` is folded in here rather than being expected in
   * the data, which also repairs the two front-matter conventions that had
   * drifted apart: generated source pages stamped the PO-derived list while the
   * hand-authored translated pages stamped the full supported set, and
   * `docs/fr/index.md` therefore rendered `6/5 languages`.
   *
   * Filtered by `supported` so a locale outside the declared set cannot inflate
   * a count taken against it, and ordered by `supported` so every page's bar
   * and badge read in the same order. Issue #687.
   */
  function localesAvailable(meta, supported) {
    var have = {};
    if (meta && meta.lang) have[meta.lang] = true;
    var declared = (meta && meta.availableLocales) || [];
    for (var i = 0; i < declared.length; i++) have[declared[i]] = true;
    return supported.filter(function (loc) { return have[loc] === true; });
  }

  function getGlobalLocale() {
    try { return localStorage.getItem("fa-locale") || "en"; } catch (_e) { return "en"; }
  }
  function setGlobalLocale(loc) {
    try { localStorage.setItem("fa-locale", loc); } catch (_e) { /* noop */ }
  }

  /* The remembered language, when it is worth pointing at: a locale the
     visitor previously chose, that is not the one they are already reading,
     and that this page actually has.

     `fa-locale` was WRITE-ONLY before this: the sidebar switcher stored the
     choice on click and nothing ever read it back, so picking French and
     navigating anywhere landed you in English again with the preference
     sitting in localStorage unused. It used to stop at marking the remembered
     language in the bar; since 2026-09-27 `followRememberedLocale` also takes
     the reader there, on the owner's call. */
  function rememberedLocale(currentLang, available) {
    var loc = getGlobalLocale();
    if (!loc || loc === currentLang) return null;
    // No `loc !== "en"` exemption: `available` carries the source language now,
    // so membership answers this on its own, and the exemption would have
    // offered English on a folio that has no English.
    if (available.indexOf(loc) === -1) return null;
    return loc;
  }

  /**
   * THE PAGE FOLLOWS THE CHOSEN LANGUAGE. Owner, 2026-09-27: *"user selects
   * locale in icon, then only those pages exist (if translated) otherwise
   * source language fallback"*, after an English page sat inside a French
   * navbar.
   *
   * This reverses the "does NOT redirect" note on `rememberedLocale` above:
   * a page whose remembered language differs from the one it is in, and that
   * HAS a page in the remembered one, is replaced by that page. Returns true
   * when it navigated, so `init` can stop.
   *
   * Three guards, each against a specific wrong jump:
   *  - only a STORED choice counts. `getGlobalLocale` answers "en" when
   *    nothing is stored, which would bounce every shared French link to
   *    English for a reader who never chose;
   *  - `?lang=` on the URL wins, because somebody asked for that page;
   *  - only a locale the page's own meta declares available, so the jump
   *    never lands on a 404. The language bar writes the choice on click,
   *    before it navigates, so choosing a language never fights this.
   */
  function followRememberedLocale(meta) {
    if (!meta) return false;
    var stored = null;
    try { stored = localStorage.getItem("fa-locale"); } catch (_e) { return false; }
    if (!stored) return false;
    if (cameFromLocaleFallback()) return false;
    try {
      if (new URL(window.location.href).searchParams.get("lang")) return false;
    } catch (_e) { return false; }
    var currentLang = meta.lang || "en";
    var available = localesAvailable(meta, meta.supportedLocales || UN_LOCALES);
    var target = rememberedLocale(currentLang, available);
    if (!target) return false;
    var dest = translationHref(deriveBasePath(window.location.pathname, currentLang), target, window.location.pathname, currentLang);
    if (dest === window.location.pathname) return false;
    window.location.replace(dest + window.location.search + window.location.hash);
    return true;
  }

  function localePath(basePath, locale) {
    if (locale === "en") return basePath;
    var parts = basePath.split("/");
    var filename = parts.pop();
    return parts.join("/") + "/" + locale + "/" + filename;
  }

  function deriveBasePath(path, currentLang) {
    if (currentLang === "en") return path;
    return path.replace(new RegExp("/" + currentLang + "/"), "/");
  }

  /**
   * The page's own translations, as it declares them: every
   * `<link rel="alternate" hreflang="xx" href="...">` in the document, keyed
   * by locale, each resolved to a same-origin path. A page that says where
   * its French version is has answered the question; the `/<locale>/`
   * convention below is a guess about a layout it may not have.
   *
   * Owner, 2026-11-13: the who-iris home's tabs linked `/who-iris/fr/`, a
   * 404, while the page's own alternates (and its own language links) named
   * `who-iris/fr/index.html`, which is there. The tabs guessed; the page knew.
   */
  function declaredAlternates() {
    var out = {};
    var links = document.querySelectorAll('link[rel~="alternate"][hreflang]');
    for (var i = 0; i < links.length; i++) {
      var type = links[i].getAttribute("type");
      if (type && type !== "text/html") continue;
      var raw = links[i].getAttribute("href");
      var lang = (links[i].getAttribute("hreflang") || "").toLowerCase();
      if (!raw || !lang) continue;
      try {
        var u = new URL(raw, document.baseURI);
        if (u.origin !== window.location.origin) continue;
        var p = u.pathname + u.search;
        if (!out[lang]) out[lang] = p;
        var primary = lang.split("-")[0];
        if (!out[primary]) out[primary] = p;
      } catch (_e) { /* an href we cannot resolve declares nothing */ }
    }
    return out;
  }

  /**
   * Where `locale`'s version of this page is: the page's declared alternate
   * when it has one, else the `/<locale>/` sibling the translation pipeline
   * writes. The publish link check (`build-instance-site.ts` `checkLinks`,
   * via `scripts/lib/lang-tabs.ts` in cat-harness-tools) computes the same
   * answer from the built HTML and refuses a publish where it is a 404.
   */
  function translationHref(basePath, locale, path, currentLang) {
    var declared = declaredAlternates();
    if (declared[locale]) return declared[locale];
    // A translated page's sibling in another translation is its own path with
    // the locale segment swapped, wherever that segment sits: `/r/fr/x/` (the
    // whole site under a locale) as well as `/r/x/fr/a.html`. Rebuilding it from
    // the English path put the segment before the file, a 404 for the first.
    var seg = "/" + currentLang + "/";
    if (currentLang !== "en" && locale !== "en" && path.indexOf(seg) !== -1) return path.replace(seg, "/" + locale + "/");
    return localePath(basePath, locale);
  }

  /* The 404 page's English fallback (cat-harness-tools
     `scripts/lib/locale-fallback-404.ts`) leaves the page it landed on here,
     so a remembered language never sends the reader straight back to the
     translation that was missing: that would be a loop. */
  function cameFromLocaleFallback() {
    try { return sessionStorage.getItem("fa-locale-fallback") === window.location.pathname; } catch (_e) { return false; }
  }

  /**
   * Put a disclosure panel where the sidebar header cannot clip it.
   *
   * just-the-docs hard-caps `.site-header` height at the desktop breakpoint,
   * so a panel left inside it is cut off. The QR panel solved this by moving
   * itself into `.side-bar` as a sibling of the header, where it joins the
   * flex column in NORMAL FLOW: it pushes the nav down instead of covering
   * anything, and inherits the sidebar's fixed positioning for free.
   *
   * The reading-preferences and language panels did not use that route. They
   * stayed inside the header — the language bar additionally opening UPWARD
   * (`bottom: 100%`) to escape the cap, which only traded one clipping for
   * another: it then ran off the top of the column and under the staging
   * banner. Both are reported broken by readers; the QR panel is not. Same
   * problem, one fix, so this is shared rather than copied a third time.
   *
   * Returns true when the panel reached the sidebar column, so a caller can
   * style the two cases differently.
   */
  function mountPanelInSidebarColumn(host, panel) {
    var sideBar = host.closest ? host.closest(".side-bar") : null;
    if (sideBar) {
      // The direct child of `.side-bar` that contains `host` — normally
      // `.site-header`. Walking up rather than assuming `host.parentNode`
      // keeps this correct if the host is nested any deeper.
      var anchor = host;
      while (anchor.parentNode && anchor.parentNode !== sideBar) anchor = anchor.parentNode;
      if (anchor.parentNode === sideBar) {
        sideBar.insertBefore(panel, anchor.nextSibling);
        panel.classList.add("fa-panel-in-sidebar");
        return true;
      }
    }
    // No sidebar of the expected shape: anchor to the host as before. The
    // control still works, it is just positioned less well.
    if (host.parentNode) host.parentNode.insertBefore(panel, host.nextSibling);
    else host.appendChild(panel);
    return false;
  }

  /**
   * The language bar, as content for an action tile's view.
   *
   * It used to mount its own header toggle and its own outside-click and
   * Escape handlers. Both now belong to the tile panel that contains it: two
   * things listening for Escape is two things that can disagree about whether
   * anything is open, and the bug this whole area already paid for was a
   * control fighting its container for position.
   */
  function buildLanguageBar() {
    var meta = getTranslationMeta();
    var currentLang = (meta && meta.lang) || "en";
    var supported = (meta && meta.supportedLocales) || UN_LOCALES;
    var available = localesAvailable(meta, supported);
    var path = window.location.pathname;
    var basePath = deriveBasePath(path, currentLang);

    // Horizontal language bar — shows all 6 UN languages. Inside a tile view
    // it is simply present: the view's own disclosure decides whether anyone
    // can see it, so the bar carries no open/closed state of its own.
    var bar = el("div", { class: "fa-lang-bar fa-tile-content", "data-open": "true" });

    var remembered = rememberedLocale(currentLang, available);

    for (var i = 0; i < supported.length; i++) {
      var loc = supported[i];
      // `available` now carries the source language, so membership is the whole
      // test. `loc === "en"` stood here, which made English clickable on a
      // folio authored in French and left French greyed out on its own page.
      var isAvailable = available.indexOf(loc) !== -1;
      var isCurrent = loc === currentLang;
      var isRemembered = loc === remembered;

      // Available = clickable <a>. Unavailable = disabled <span>.
      //
      // No inline colours. Every pair is a token in `docs-ui.css` with its
      // measured ratio beside it -- bean `rptk`, whose second half is this
      // function: the unavailable tab was `#475569` at `opacity:0.5`, which
      // composites to 1.39:1 on the tile panel, and the current tab was
      // #ffffff on #3b82f6 at 3.67:1. The per-page bar was fixed first and
      // this one kept the literals, because the gate never opened this view.
      var tab = el(isAvailable ? "a" : "span", {
        href: isAvailable ? safeHref(translationHref(basePath, loc, path, currentLang)) : undefined,
        // Says "unavailable" to a screen reader too, not only by its strike-through (Q-TRP-2).
        "aria-disabled": isAvailable ? undefined : "true",
        "data-locale": loc,
        title: isAvailable
          ? LOCALE_NAMES[loc] + (isRemembered ? " \u2014 your saved language" : "")
          : LOCALE_NAMES[loc] + " \u2014 not yet translated",
        class: "fa-lang-tab" +
               (isCurrent ? " is-current" : isAvailable ? "" : " is-unavailable") +
               (isRemembered ? " is-remembered" : "")
      }, loc.toUpperCase());

      // Hover is a CSS `:hover` rule now, for the same reason: a colour
      // written by `style.background` is a literal nothing can measure,
      // because it exists only while a pointer is over the tab.
      if (isAvailable && !isCurrent) {
        (function (locale, link) {
          link.addEventListener("click", function () { setGlobalLocale(locale); });
        })(loc, tab);
      }
      bar.appendChild(tab);
    }

    return bar;
  }

  /**
   * Per-page language bar — always visible inline in the main content area.
   * Shows all 6 UN languages as horizontal tabs. Available translations are
   * clickable links; unavailable are greyed-out disabled spans.
   * Does NOT change the global locale (that's the sidebar globe's job).
   */
  function mountPageLanguageBar() {
    var meta = getTranslationMeta();
    var currentLang = (meta && meta.lang) || "en";
    var supported = (meta && meta.supportedLocales) || UN_LOCALES;
    var available = localesAvailable(meta, supported);
    var path = window.location.pathname;
    var basePath = deriveBasePath(path, currentLang);

    // Or `main`, on a page that DECLARES its locales (#2219): a mounted page
    // (`mount-instance-docs.ts`) is finished HTML with no just-the-docs layout,
    // and `glassBandSlot` already falls back to `main`. Without the block it is
    // a page nobody said anything about, and it keeps its layout.
    var mainContent = document.querySelector(".main-content, #main-content") ||
      (meta ? document.querySelector("main") : null);
    // A page that offers the bar a place of its own (`localeSlot`) needs no
    // content column: the slot is where it goes.
    var slot = localeSlot();
    if (!mainContent && !slot) return;

    // No inline colours, here or below. Every one of this bar's pairs is a
    // per-scheme token in `docs-ui.css` with its measured ratio written beside
    // it -- bean `rptk`, where a literal written against the sidebar's dark
    // card came out at 1.34:1 on the page's light one.
    var container = el("div", { class: "fa-page-lang-bar", "data-open": "false" });

    /* A DISCLOSURE IN THE BAND -- issue #2201. The bar was six tabs under the
     * first heading; it now shares the band's row with search and the Folio
     * handle, which on a 390px phone leaves no room for six tabs beside a
     * magnifier. So the row shows the globe and the page's own language, and
     * the same button opens the tabs beside it and closes them again (`l4zi`:
     * the inverse is the same control in the same place). Its NAME is
     * "Language"; the state is `aria-expanded`, as on the magnifier.
     *
     * AT EVERY WIDTH, STARTING CLOSED. #2210 kept the six tabs always inline
     * above 40rem with no toggle; the owner then asked (2026-10-05) *"make
     * globe click open and closed the desktop view of the locale selector.
     * start closed too."* So the same toggle is drawn everywhere and starts
     * closed. Above 40rem it is the globe alone and opens the six tabs
     * inline beside it, one click each; at 40rem and below it reads
     * "globe EN" with a caret, as the phone dropdown it already was
     * (`docs-ui.css`). */
    var listId = "fa-page-lang-list";
    var toggle = el("button", {
      type: "button",
      class: "fa-page-lang-toggle",
      "aria-expanded": "false",
      "aria-controls": listId,
      "aria-label": "Language: " + (LOCALE_NAMES[currentLang] || currentLang.toUpperCase()),
      title: "Available translations for this page",
    });
    /* IN A PAGE'S OWN BAR, THE REFERENCE SITE'S CONTROL -- owner,
     * 2026-11-10: "have styling match who.int especially for language and
     * search parts". The bar's picker is a translate glyph, the words
     * "Select language" in the page's language, and a chevron; it opens a
     * dropdown of the languages, each named in its own language. The band's
     * globe-and-tabs picker, on a page with no bar, is unchanged. */
    if (slot) {
      var labelLang = SELECT_LANGUAGE[currentLang] ? currentLang : "en";
      var icon = el("span", { class: "fa-page-lang-glyph", "aria-hidden": "true" });
      icon.innerHTML = TRANSLATE_GLYPH;
      toggle.appendChild(icon);
      toggle.appendChild(el("span", { class: "fa-page-lang-label", lang: labelLang }, SELECT_LANGUAGE[labelLang]));
      var chevron = el("span", { class: "fa-page-lang-chevron", "aria-hidden": "true" });
      chevron.innerHTML = CHEVRON_GLYPH;
      toggle.appendChild(chevron);
    } else {
      toggle.appendChild(el("span", { class: "fa-page-lang-globe", "aria-hidden": "true" }, "\uD83C\uDF10"));
      toggle.appendChild(el("span", { class: "fa-page-lang-current" }, currentLang.toUpperCase()));
      toggle.appendChild(el("span", { class: "fa-page-lang-caret", "aria-hidden": "true" }, "\u25BE"));
    }
    container.appendChild(toggle);
    var list = el(slot ? "ul" : "span", { class: "fa-page-lang-list", id: listId });

    function paintLangOpen(open) {
      container.setAttribute("data-open", open ? "true" : "false");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      glassBandActive("locale", open);
    }
    toggle.addEventListener("click", function () {
      paintLangOpen(container.getAttribute("data-open") !== "true");
    });
    container.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || container.getAttribute("data-open") !== "true") return;
      e.preventDefault();
      e.stopPropagation();
      paintLangOpen(false);
      toggle.focus();
    });
    glassBandItem("locale", function () { paintLangOpen(false); });

    var remembered = rememberedLocale(currentLang, available);

    for (var i = 0; i < supported.length; i++) {
      var loc = supported[i];
      // `available` now carries the source language, so membership is the whole
      // test. `loc === "en"` stood here, which made English clickable on a
      // folio authored in French and left French greyed out on its own page.
      var isAvailable = available.indexOf(loc) !== -1;
      var isCurrent = loc === currentLang;
      var isRemembered = loc === remembered;

      var tab = el(isAvailable ? "a" : "span", {
        href: isAvailable ? safeHref(translationHref(basePath, loc, path, currentLang)) : undefined,
        // Says "unavailable" to a screen reader too, not only by its strike-through (Q-TRP-2).
        "aria-disabled": isAvailable ? undefined : "true",
        title: isAvailable
          ? LOCALE_NAMES[loc] + (isRemembered ? " \u2014 your saved language" : "")
          : LOCALE_NAMES[loc] + " \u2014 not yet translated",
        class: "fa-page-lang-tab" +
               (isCurrent ? " is-current" : isAvailable ? "" : " is-unavailable") +
               (isRemembered ? " is-remembered" : ""),
        // In the bar each language is named in its own language, so it is
        // marked with it: a screen reader then says "中文" in Chinese.
        lang: slot ? loc : undefined,
        hreflang: slot && isAvailable ? loc : undefined,
        "aria-current": slot && isCurrent ? "page" : undefined
      }, slot ? (LOCALE_NAMES[loc] || loc.toUpperCase()) : loc.toUpperCase());

      // Hover is a CSS `:hover` rule now. It was a pair of listeners writing
      // `style.background`, which is an inline colour literal with extra steps
      // -- and one nothing could measure, since it exists only while a pointer
      // is over the tab.
      if (isAvailable && !isCurrent) {
        (function (locale, link) {
          link.addEventListener("click", function () { setGlobalLocale(locale); });
        })(loc, tab);
      }
      if (slot) {
        var item = el("li");
        item.appendChild(tab);
        list.appendChild(item);
      } else {
        list.appendChild(tab);
      }
    }
    container.appendChild(list);

    // IN THE BAND, at its inline-start (issue #2201). It used to be inserted
    // after the first h1, guarded against an h1 outside `.main-content` that
    // made `insertBefore` throw and took the rest of `init()` down with it
    // (2026-09-22, 2026-09-27). Appending to a slot this file created has no
    // reference node to go stale.
    //
    // OR IN THE PAGE'S OWN SLOT (owner, 2026-10-15: "move the language
    // picker into the IG top bar"). A page whose own bar already holds its
    // search box marks a place beside it, `data-fa-slot="locale"`, and the
    // bar goes there instead of the band. A page without one keeps the band,
    // so every folio site that has no such bar is unchanged.
    if (slot) {
      container.setAttribute("data-fa-slotted", "");
      slot.appendChild(container);
      // A dropdown hangs over the page, so a press anywhere else closes it.
      document.addEventListener("click", function (e) {
        if (container.getAttribute("data-open") === "true" && !container.contains(e.target)) paintLangOpen(false);
      });
    } else {
      glassBandSlot("start").appendChild(container);
    }
  }

  /**
   * The place a page set aside for the language picker, or null: the first
   * element marked `data-fa-slot="locale"`. The page writes the slot and this
   * file fills it; nothing here knows which page, or which layer's bar,
   * offers one.
   */
  function localeSlot() {
    return document.querySelector('[data-fa-slot="locale"]');
  }

  /* ── Colour scheme ───────────────────────────────────────────────────── */

  // A lightbulb: glass, filament, and the screw base. Same 24x24 box and the
  // same currentColor fill as the QR glyph so the two sit as a pair.
  var BULB_ON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2zm-2 12.1A5 5 0 1 1 14 14.1l-.5.33V16h-3v-1.57l-.5-.33z"/>' +
    '<path d="M9 19h6v1.2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V19z"/>' +
    "</svg>";

  var BULB_OFF =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2zm-2 12.1A5 5 0 1 1 14 14.1l-.5.33V16h-3v-1.57l-.5-.33z" opacity="0.45"/>' +
    '<path d="M9 19h6v1.2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V19z" opacity="0.45"/>' +
    '<path d="M4.2 3.3 20.7 19.8l-1.4 1.4L2.8 4.7z"/>' +
    "</svg>";

  var SCHEME_KEY = "fa-color-scheme";

  // `site.color_scheme` from _config.yml, emitted by head_custom.html as a
  // JSON data block -- not executable script, so the page needs no
  // script-src relaxation for it.
  //
  // It matters because just-the-docs' first stylesheet is
  // `just-the-docs-default.css`, which is the CONFIGURED scheme compiled in.
  // `jtd.getTheme()` parses that filename, so on a fresh load it reports
  // "default", never "dark" -- and "default" means whatever this site chose.
  function configuredScheme() {
    var node = document.getElementById("fa-site-scheme");
    // No site declaration — a folio's page, outside the theme: its sheet
    // follows the OS until the reader picks, so the switch starts from there.
    if (!node) return osScheme();
    try {
      var scheme = JSON.parse(node.textContent).scheme;
      return scheme === "dark" ? "dark" : "light";
    } catch (_e) {
      return "light";
    }
  }

  /**
   * Is just-the-docs' switchable sheet on THIS page? `jtd.setTheme` swaps the
   * page's FIRST stylesheet. On a page the theme did not lay out, the theme's
   * script can still be present — the top bar's search loads it (cat-harness-tools
   * `lib/site-bar.ts`, 2026-10-15) — and its first stylesheet is the rail's
   * own: swapped, the rail lost its style. So the switch is the theme's only
   * where its sheet comes first.
   */
  function themeSheet() {
    if (!window.jtd || typeof window.jtd.setTheme !== "function" || typeof window.jtd.getTheme !== "function") return false;
    var first = document.querySelector('[rel="stylesheet"]');
    return !!first && /just-the-docs-[a-z]+\.css/.test(first.getAttribute("href") || "");
  }

  function osScheme() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch (_e) {
      return "light";
    }
  }

  function storedScheme() {
    try { return window.localStorage.getItem(SCHEME_KEY); } catch (_e) { return null; }
  }

  function currentScheme() {
    var stored = storedScheme();
    if (stored === "light" || stored === "dark") return stored;
    // WHAT THE FIRST-PAINT SNIPPET DECIDED (`head_custom.html`, the one
    // source of the rule), before this deferred bundle existed: stored, else
    // the OS, else light (owner, 2026-10-15). Asked second,
    // because a page that painted in a scheme must not be re-decided by a
    // later, weaker guess — that re-decision IS a flash.
    var painted = document.documentElement.getAttribute("data-fa-scheme");
    if (painted === "light" || painted === "dark") return painted;
    if (themeSheet()) {
      var t = window.jtd.getTheme();
      if (t === "light" || t === "dark") return t;
    }
    // No snippet ran (a page that carries neither it nor a stored choice):
    // the same rule it applies -- the OS, else light. The site's declared
    // scheme is only which sheet shipped first (`jtdShows`), never the
    // reader's scheme.
    return osScheme();
  }

  function applyScheme(name) {
    // A FOLIO's page has no just-the-docs (issue #2208): it is styled by its
    // own sheet, which follows `data-fa-scheme` (`lib/scheme-css.ts`), so the
    // attribute alone IS the switch there. Owner, 2026-10-05, on smart-ra:
    // the light bulb did nothing, because this returned before setting it.
    if (!themeSheet()) {
      document.documentElement.setAttribute("data-fa-scheme", name);
      return true;
    }
    // Always explicit. Passing "default" would work today and would break the
    // day _config.yml's color_scheme changes, because "default" is a moving
    // target and "dark" is not.
    //
    // BUT ONLY WHEN THE SHEET IS NOT ALREADY THAT SCHEME — owner, 2026-09-24:
    // *"when any page/foio-asst/cat-harness first loads if flashes white
    // before goignt o dark mode."* `setTheme` swaps the theme's first
    // stylesheet, and a swap UNLOADS the sheet painting the page until the new
    // file arrives: the white canvas shows through. Applying a stored "dark"
    // on this dark-configured site swapped `-default.css` for `-dark.css` —
    // the same colours — on every load, for every reader who had ever pressed
    // the toggle. Measured by `first-paint-scheme.e2e.ts`, which holds the
    // new file in flight and reads the ground: `rgb(255, 255, 255)`.
    if (!jtdShows(name)) window.jtd.setTheme(name);
    document.documentElement.setAttribute("data-fa-scheme", name);
    return true;
  }

  /** Is the theme's loaded stylesheet already `name`? "default" means the configured scheme. */
  function jtdShows(name) {
    if (typeof window.jtd.getTheme !== "function") return false;
    var t = window.jtd.getTheme();
    return t === name || (t === "default" && configuredScheme() === name);
  }

  /* ── ONE scheme, TWO controls that must never disagree ─────────────────
   *
   * The light/dark switch now exists in two places: the Settings tile it has
   * always had, and a mini-button in the header row (owner, 2026-09-21:
   * *"can you put dark/light mode switch in mini-icon on top as well as
   * language icon. to right of folio-asst, to left of the [3x3 checkboard]"*).
   *
   * Two buttons over one fact is how a control starts lying: press the header
   * one and the tile still shows the old bulb, so the next reader to open
   * Settings sees "Light" on a dark page. So NEITHER button owns the state.
   * Each REGISTERS a painter here, one click path mutates, and every
   * registered painter repaints. Adding a third control is one more
   * `registerSchemePainter` call and no new coordination.
   *
   * This is the same rule the search field is moved rather than rebuilt for:
   * a second copy that looks identical and disagrees is worse than no copy.
   */
  var schemePainters = [];
  var schemeInitialised = false;

  /**
   * Apply the reader's STORED choice once, before any control paints.
   *
   * Idempotent, because both controls call it and either may mount first --
   * and their order is not fixed: the tile is built lazily when Settings is
   * first opened, while the header button mounts on load. `jtd.getTheme()`
   * reflects the stylesheet the SERVER sent, which does not know what this
   * reader picked last visit, so without this the page paints in the
   * configured scheme and then flips.
   */
  function initScheme() {
    if (schemeInitialised) return;
    schemeInitialised = true;
    var scheme = currentScheme();
    // Applied whenever the theme can be switched — not only for a stored
    // choice — because the first-paint snippet may have decided from the OS.
    // `applyScheme` leaves a sheet that already shows the scheme alone, so
    // this costs no swap in the common case.
    if (themeSheet()) applyScheme(scheme);
    else document.documentElement.setAttribute("data-fa-scheme", scheme);
  }

  /** Register a control's painter and paint it immediately, so it is never
   *  briefly showing a scheme the page is not in. */
  function registerSchemePainter(paint) {
    initScheme();
    schemePainters.push(paint);
    paint(currentScheme());
  }

  /** The ONE mutation path. Every control calls this and none sets the
   *  scheme itself. */
  function toggleScheme() {
    var next = currentScheme() === "light" ? "dark" : "light";
    if (!applyScheme(next)) return;
    try { window.localStorage.setItem(SCHEME_KEY, next); } catch (_e) { /* private mode */ }
    for (var i = 0; i < schemePainters.length; i++) schemePainters[i](next);

    // No reload. Diagrams are pinned to Mermaid's LIGHT palette on a white
    // card in both schemes (site-chrome/_includes/mermaid_config.js), so nothing on
    // the page needs re-rendering when the scheme changes. An earlier version
    // reloaded here because the diagram palette followed the scheme; that
    // coupling is gone and the reload went with it.
  }

  /**
   * The light/dark control, as a tile.
   *
   * The owner originally placed it "under settings" rather than in the top
   * row, and that reasoning still holds for the TILE: it is a control a
   * reader sets once, so it does not earn prime space on its own. What
   * changed 2026-09-21 is that the owner asked for a header mini-button TOO
   * -- so this is no longer the only way in, and it keeps its class because
   * the e2e spec and the stylesheet still find it by that name.
   */
  function buildThemeTile() {
    var btn = el("button", { type: "button", class: "fa-tile fa-theme-toggle" });
    var caption = el("span", { class: "fa-tile-caption" });

    registerSchemePainter(function (name) {
      // The icon shows the scheme you are IN, not the one you would get. A
      // lit bulb for light, a struck-through one for dark. Labelling it with
      // the destination instead is the other convention and is a coin-flip
      // either way; what is not optional is that the label says which.
      btn.innerHTML = name === "light" ? BULB_ON : BULB_OFF;
      btn.appendChild(caption);
      // The caption is the visible half of the same fact the label states, so
      // a reader who cannot tell the two bulbs apart at 16px does not have to.
      caption.textContent = name === "light" ? "Light" : "Dark";
      btn.setAttribute("aria-label",
        name === "light" ? "Light mode is on — switch to dark" : "Dark mode is on — switch to light");
      btn.setAttribute("aria-pressed", name === "dark" ? "true" : "false");
    });

    btn.addEventListener("click", toggleScheme);
    return btn;
  }

  /**
   * The same switch as a HEADER MINI-BUTTON, beside the tiles launcher.
   *
   * No caption -- the header row is capped at 3.75rem and shares its width
   * with the site title, which is the whole reason `1le7` collapsed four
   * header icons into one launcher. Two icons come back here because the
   * owner asked for them by name; the launcher stays, so the row is three
   * rather than the six that decision was avoiding.
   *
   * The bulb alone therefore has to carry the state, which is why the
   * `aria-label` is a sentence rather than a word: a reader who cannot see
   * the glyph gets the same fact the tile's caption gives.
   */
  function buildSchemeMini() {
    var btn = el("button", { type: "button", class: "fa-qr-toggle fa-scheme-mini" });
    registerSchemePainter(function (name) {
      btn.innerHTML = name === "light" ? BULB_ON : BULB_OFF;
      btn.setAttribute("aria-label",
        name === "light" ? "Light mode is on — switch to dark" : "Dark mode is on — switch to light");
      btn.setAttribute("aria-pressed", name === "dark" ? "true" : "false");
    });
    btn.addEventListener("click", toggleScheme);
    return btn;
  }

  /* ── Header QR ───────────────────────────────────────────────────────── */

  // A static glyph: three finder squares and a scatter of modules. Inline so
  // it needs no extra request and inherits the header's colour.
  var QR_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">' +
    '<path d="M3 3h7v7H3V3zm2 2v3h3V5H5zm9-2h7v7h-7V3zm2 2v3h3V5h-3zM3 14h7v7H3v-7zm2 2v3h3v-3H5z"/>' +
    '<path d="M13 13h3v3h-3v-3zm5 0h3v2h-3v-2zm-5 5h2v3h-2v-3zm4 1h4v2h-4v-2zm2-3h2v2h-2v-2z"/>' +
    "</svg>";
  var GLYPH = QR_GLYPH;

  // Ordered most specific first. just-the-docs has used `.site-title` across
  // many versions, but the theme is unpinned, so a miss here is configuration
  // drift rather than an impossible state.
  var TITLE_SELECTORS = [".site-title", "#site-title", ".site-header .site-title",
                         ".side-bar .site-title", ".site-header a"];
  var HEADER_SELECTORS = [".site-header", ".site-header-container", ".side-bar header",
                          ".side-bar"];


  /* ── Reading preferences ─────────────────────────────────────────────── */

  /*
   * Four reader-facing affordances behind one gear, all WCAG 2.2 AA criteria a
   * static site can actually satisfy:
   *
   *   large-type   1.4.4 Resize text. The criterion is 200 % without loss of
   *                content; the step here is a modest one a reader can take
   *                twice on top of browser zoom, not a replacement for it.
   *   contrast     1.4.3 Contrast (Minimum) and 2.4.7 Focus Visible.
   *   underline    1.4.1 Use of Colour. A link distinguished only by hue is
   *                invisible to a reader with a colour-vision deficiency, and
   *                just-the-docs styles links exactly that way.
   *   motion       2.3.3 Animation from Interactions. Defaults ON when the OS
   *                already says `prefers-reduced-motion`, because a user who
   *                has set that should not have to set it again.
   *
   * THIS IS NOT `.folio/interaction.json`, and conflating the two would be a
   * real bug. This is per-viewer and per-browser, in localStorage, and it never
   * reaches an agent — a reader who is not the author picking large type must
   * not silently reconfigure how an agent talks to the author. The agent-facing
   * record is the committed file; see skills/conduct/conduct-core/interaction-modality.md.
   *
   * Every read and write is wrapped: localStorage throws in a private window
   * with site data blocked, and the panel must still work when it does.
   */

  var A11Y_KEY = "fa-reading-prefs";

  var A11Y_OPTIONS = [
    { id: "large-type", label: "Larger text", hint: "Bigger body text and wider line spacing" },
    { id: "contrast", label: "Higher contrast", hint: "Stronger text and a thicker focus ring" },
    { id: "underline", label: "Underline links", hint: "Never colour alone (WCAG 1.4.1)" },
    { id: "reduce-motion", label: "Reduce motion", hint: "Turn off transitions and animation" }
  ];

  var GEAR_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6' +
    'M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7L5.4 5.4" ' +
    'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
    "</svg>";

  /* ── TWO SETTINGS PANELS, TWO NAMES, EACH POINTS TO THE OTHER ──────────
   *
   * Bean `ob3m` finding 12. Two unrelated panels were both called "Settings"
   * and both wore a gear: the GLASS's (theme, avatars, opacity, blur) and the
   * ▦ Actions launcher's (scheme, reading preferences, Discarded, Declared
   * kinds). A reader wanting the Discarded fish who opened the glass one found
   * nothing there and nothing saying where else to look.
   *
   * Owner, 2026-10-01, option 2 of 4: *"Rename: 'Glass settings' and 'Page
   * settings', each with a link to the other."* The names live HERE, once,
   * because each panel's cross-link names the OTHER panel — a rename made in
   * one place only would leave a link announcing a panel that no longer
   * exists under that name.
   *
   * The openers are a registry rather than a call from one mount into the
   * other: the launcher and the glass mount independently, and a page with no
   * sidebar (a replica, the harness page) has a glass and no launcher. A
   * cross-link is drawn only when its target registered, so no link can open
   * nothing — the `dh4f` rule for controls. */
  var SETTINGS_NAMES = { page: "Page settings", glass: "Glass settings" };
  var SETTINGS_SCOPES = {
    page: "scheme, reading, Discarded",
    glass: "theme, avatars, opacity, blur",
  };
  var settingsOpeners = { page: null, glass: null };

  /**
   * The link at the top of one settings panel that opens the other. A BUTTON:
   * it opens a panel in place rather than navigating, so a link's semantics
   * (and a middle-click that opens nothing) would be wrong. Null when the
   * target is not on this page.
   */
  function settingsCrossLink(target, beforeOpen) {
    if (!settingsOpeners[target]) return null;
    var b = el("button", {
      type: "button",
      class: "fa-settings-crosslink",
      "data-fa-settings-crosslink": target,
    }, SETTINGS_NAMES[target] + " (" + SETTINGS_SCOPES[target] + ") →");
    b.addEventListener("click", function () {
      if (beforeOpen) beforeOpen();
      settingsOpeners[target]();
    });
    return b;
  }

  function storedPrefs() {
    try {
      var raw = localStorage.getItem(A11Y_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function defaultPrefs() {
    var prefs = {};
    // The OS has already been asked. Asking again is WCAG 3.3.7 (Redundant
    // Entry) applied to a setting rather than to a form field.
    var reduced = false;
    try {
      reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch { /* matchMedia absent: the default stays off. */ }
    prefs["reduce-motion"] = Boolean(reduced);
    return prefs;
  }

  function applyPrefs(prefs) {
    A11Y_OPTIONS.forEach(function (opt) {
      document.documentElement.toggleAttribute("data-fa-" + opt.id, Boolean(prefs[opt.id]));
    });
  }

  /** The reading-preference rows, as content for the settings tile's view. */
  function buildReadingPrefs() {
    var prefs = storedPrefs() || defaultPrefs();
    applyPrefs(prefs);

    var panel = el("div", { class: "fa-a11y-panel fa-tile-content", role: "group",
                            "aria-label": "Reading preferences" });

    A11Y_OPTIONS.forEach(function (opt) {
      var row = el("label", { class: "fa-a11y-row" });
      var box = el("input", { type: "checkbox" });
      box.checked = Boolean(prefs[opt.id]);
      box.addEventListener("change", function () {
        prefs[opt.id] = box.checked;
        applyPrefs(prefs);
        try {
          localStorage.setItem(A11Y_KEY, JSON.stringify(prefs));
        } catch {
          // Blocked storage: the setting still applies for this page view.
          // Saying nothing would be worse than a console note nobody reads,
          // because the reader will wonder why it did not stick.
          console.warn("docs-ui: reading preferences could not be saved (storage blocked); " +
                       "the change applies to this page view only.");
        }
      });
      var text = el("span", { class: "fa-a11y-text" });
      text.appendChild(el("span", { class: "fa-a11y-label" }, opt.label));
      text.appendChild(el("span", { class: "fa-a11y-hint" }, opt.hint));
      row.appendChild(box);
      row.appendChild(text);
      panel.appendChild(row);
    });

    var note = el("p", { class: "fa-a11y-note" },
      "Saved in this browser only. It is not sent anywhere.");
    panel.appendChild(note);

    return panel;
  }

  function firstMatch(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var found = document.querySelector(selectors[i]);
      if (found) return found;
    }
    return null;
  }


  /* ── Discarded items — the fsh-guts viewer ─────────────────────────────
   *
   * Owner, 2026-09-19: *"only available under settings at dead fish icon.
   * opening it shows a list of all the nodes in fsh-guts/ (has counter on
   * icon) and use can open dialog to select and display them."*
   *
   * ## Why it is fetched when SETTINGS opens, not on page load
   *
   * The document carries every node's body. Measured: 64 KB with them
   * against 5 KB without. The control lives inside Settings, so its count is
   * not needed until Settings is opened — fetching 64 KB on every page view
   * to populate a badge nobody has looked at would be indefensible. The
   * result is cached for the page, so opening Settings twice fetches once.
   *
   * ## Three states, and the middle one is the whole point
   *
   * The todo tile hides itself when the count is zero, which is right for
   * todos. Doing the same here would be wrong: a FAILED fetch and an empty
   * trashcan would look identical, and they are opposite facts. So
   *
   *   loaded, n > 0   the control, with n in its accessible name
   *   loaded, n === 0 a plain line saying the trashcan is empty
   *   failed          a plain line saying it could not be read, and why
   *
   * ## The body is rendered as TEXT
   *
   * `renderBody` splits on blank lines and emits paragraphs via textContent.
   * No markdown renderer and no sanitiser, deliberately: `fsh-guts/` is a
   * dumping ground anyone may drop a file into, and the safe thing to do
   * with content like that is not to interpret it. A link to the source on
   * the forge is offered for anyone who wants it rendered.
   */

  var FISH_GLYPH =
    '<svg class="fa-tile-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    // Body, tail, and an X for the eye — a dead fish, per the owner.
    '<path d="M2 12c3-4 7-6 11-6s7 2 9 6c-2 4-5 6-9 6s-8-2-11-6z" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M22 12l-3-3v6z" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linejoin="round"/>' +
    '<path d="M7.2 10.2l2 2m0-2l-2 2" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round"/></svg>';

  /** `{ nodes }` on success, `{ error }` when it could not be read. Cached. */
  var discardedCache = null;

  function fetchDiscarded(done) {
    if (discardedCache) return done(discardedCache);
    var src = document.querySelector('meta[name="fa-fsh-guts-src"]');
    var url = src && src.getAttribute("content");
    if (!url) {
      // Not an error and not an empty trashcan: this build published no
      // document, so there is nothing to say a count about.
      discardedCache = { absent: true };
      return done(discardedCache);
    }
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (doc) {
        var g = doc && doc["@graph"];
        if (!Array.isArray(g)) throw new Error("no @graph array");
        discardedCache = { nodes: g };
        done(discardedCache);
      })
      .catch(function (e) {
        discardedCache = { error: e.message, url: url };
        done(discardedCache);
      });
  }

  /**
   * Strip raw markdown code backticks, bold/heading markers from node names and
   * descriptions so text renders cleanly (folio-assistant-oi3h).
   */
  function cleanMarkdownText(str) {
    if (!str) return "";
    return String(str)
      .replace(/`([^`]+)`/g, "$1")
      .replace(/`/g, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/#+\s*/g, "")
      .trim();
  }

  /** One node's detail: what it was, where it came from, and its text. */
  function buildDiscardedDetail(node, onBack) {
    var wrap = el("div", { class: "fa-discarded-detail" });

    var back = el("button", { type: "button", class: "fa-discarded-back" },
                  "‹ All discarded items");
    back.addEventListener("click", onBack);
    wrap.appendChild(back);

    var h = el("h4", { class: "fa-discarded-title", tabindex: "-1" },
               cleanMarkdownText(node.name || node.sourcePath || "Untitled"));
    wrap.appendChild(h);

    // The metadata that makes it not an orphan. `movedFrom` first: a reader
    // asking "what is this" is usually asking where it used to be.
    var meta = el("dl", { class: "fa-discarded-meta" });
    function row(label, value) {
      if (!value) return;
      meta.appendChild(el("dt", null, label));
      meta.appendChild(el("dd", null, String(value)));
    }
    row("Was at", node.movedFrom);
    row("Moved", node.movedOn);
    row("Kind", node.nodeKind);
    row("Issue", node.issue ? "#" + node.issue : "");
    if (meta.childNodes.length) wrap.appendChild(meta);

    if (node.description) {
      wrap.appendChild(el("p", { class: "fa-discarded-summary" }, cleanMarkdownText(node.description)));
    }

    // NEVER A BLANK PANE. A node with no body says so; it does not render
    // nothing and leave the reader wondering whether it failed.
    if (node.body) {
      wrap.appendChild(renderBody(node.body));
    } else {
      wrap.appendChild(el("p", { class: "fa-discarded-none" },
        "This item carries no text — only the record of what it was and where it came from."));
    }

    var links = getSiteLinks();
    if (links.source && node.sourcePath) {
      wrap.appendChild(el("a", {
        class: "fa-discarded-source",
        href: safeHref(String(links.source).replace(/\/$/, "") + "/blob/main/" + node.sourcePath),
        target: "_blank",
        rel: "noopener noreferrer",
        title: "View on GitHub",
        "aria-label": "View the source of this item (opens on GitHub)",
      }, "View the source of this item ↗"));
    }
    return wrap;
  }

  /**
   * Stickies THIS BROWSER discarded, with a way to get each one back.
   *
   * A separate section from the repository's own nodes, and labelled as
   * such. They are different facts with different reach: one is committed
   * and visible to everyone, the other is `localStorage` and visible to
   * nobody else. Listing them together unlabelled would tell a reader they
   * had cleared something for the team.
   *
   * RESTORE is not a nicety. `fsh-guts` is "the trashcan that is kept" and
   * its rule is that a thing in it can be read, cited and restored — a
   * one-way dismiss would wear the crumpled icon while breaking the rule the
   * icon stands for.
   */
  function buildDiscardedTodos() {
    var wrap = el("section", { class: "fa-discarded-local",
                               "aria-label": "Stickies you discarded in this browser" });
    var ids = discardedTodoIds();
    if (ids.length === 0) return wrap;   // nothing to say, and no empty heading

    // "stickies", not "todos": a landing sticky goes to fsh-guts too (#1925).
    wrap.appendChild(el("h4", { class: "fa-discarded-local-title" },
      ids.length === 1 ? "1 sticky you discarded" : ids.length + " stickies you discarded"));
    wrap.appendChild(el("p", { class: "fa-discarded-local-note" },
      "Discarded in this browser only — saved here, not sent anywhere, and not " +
      "discarded for anyone else."));

    var byId = {};
    (todoState.items || []).forEach(function (t) { byId[t.id] = t; });
    var names = discardedTitles();

    var ul = el("ul", { class: "fa-discarded-list" });
    ids.forEach(function (id) {
      var todo = byId[id];
      var li = el("li", { class: "fa-discarded-local-row" });
      // The id is the fallback, not a blank: a discarded todo whose entry has
      // since left the published index still has to be nameable to be
      // restorable.
      var name = todo ? todo.summary : (names[id] || id);
      var home = id.indexOf("landing/") === 0 ? " to the stickies panel" : " to the todo board";
      li.appendChild(el("span", { class: "fa-discarded-item-name" }, name));
      var b = el("button", { type: "button", class: "fa-discarded-restore",
                             "aria-label": "Restore " + name + home }, "Restore");
      b.addEventListener("click", function () {
        restoreTodo(id);
        li.parentNode.removeChild(li);
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    return wrap;
  }

  /** The list, and the detail it swaps to. */
  function buildDiscardedView(state) {
    var wrap = el("div", { class: "fa-discarded fa-tile-content" });

    if (state.error) {
      wrap.appendChild(el("p", { class: "fa-discarded-error" },
        "The discarded-items document could not be read (" + state.error + "). " +
        "This is not the same as there being nothing discarded."));
      // The locally discarded stickies are a SEPARATE fact and are still
      // known: they live in this browser, not in the document that failed.
      wrap.appendChild(buildDiscardedTodos());
      return wrap;
    }
    var nodes = state.nodes || [];
    if (nodes.length === 0) {
      wrap.appendChild(el("p", { class: "fa-discarded-none" },
        "Nothing has been discarded in the repository. Items moved here instead of being deleted would appear in this list."));
      wrap.appendChild(buildDiscardedTodos());
      return wrap;
    }

    var list = el("ul", { class: "fa-discarded-list" });
    var detail = el("div", { hidden: "hidden" });
    wrap.appendChild(buildDiscardedTodos());

    function showList() {
      detail.setAttribute("hidden", "hidden");
      detail.innerHTML = "";
      list.removeAttribute("hidden");
      var tilesBack = wrap.closest(".fa-tiles-view") ? wrap.closest(".fa-tiles-view").querySelector(".fa-tiles-back") : null;
      if (tilesBack) tilesBack.removeAttribute("hidden");
      var first = list.querySelector("button");
      if (first) first.focus();
    }

    nodes.forEach(function (node) {
      var li = el("li");
      var b = el("button", { type: "button", class: "fa-discarded-item" });
      b.appendChild(el("span", { class: "fa-discarded-item-name" },
                       cleanMarkdownText(node.name || node.sourcePath || "Untitled")));
      if (node.nodeKind) {
        b.appendChild(el("span", { class: "fa-discarded-item-kind" }, String(node.nodeKind)));
      }
      b.addEventListener("click", function () {
        list.setAttribute("hidden", "hidden");
        detail.innerHTML = "";
        detail.appendChild(buildDiscardedDetail(node, showList));
        detail.removeAttribute("hidden");
        var tilesBack = wrap.closest(".fa-tiles-view") ? wrap.closest(".fa-tiles-view").querySelector(".fa-tiles-back") : null;
        if (tilesBack) tilesBack.setAttribute("hidden", "hidden");
        // Focus the heading, not the top of the pane: the reader chose this
        // item and the first thing they should be told is which one opened.
        var h = detail.querySelector(".fa-discarded-title");
        if (h) h.focus();
      });
      li.appendChild(b);
      list.appendChild(li);
    });

    wrap.appendChild(list);
    wrap.appendChild(detail);
    return wrap;
  }


  /* ── fsh-guts in the navbar's TOP — issue #1925 ─────────────────────────
   *
   * Owner, 2026-10-02: *"(also add fsh-guts icon to LHS top navbar)"*. It is
   * where a sticky sent to fsh-guts is restored from, so the send's
   * confirmation can point at something a reader can see on every page,
   * rather than at a control two levels inside ▦ Actions.
   *
   * The button is GENERATED into `.fa-nav-top` (`gen-navbar-include.ts`), with
   * `hidden`, because everything behind it is script: the list is fetched and
   * the restore writes `localStorage`. With no script it stays absent rather
   * than being a button that does nothing (`pb04`).
   *
   * THE COUNT HAS FOUR STATES, and three of them are the ones that must not
   * collapse (the same rule `7vhe` set for the Settings control):
   *
   *   absent   this build published no fsh-guts document and nothing was
   *            discarded here — "–", never "0", because there is nothing to
   *            count, which is a different fact from counting nothing
   *   zero     the document says the trashcan is empty, and so does this browser
   *   some     n, the document's nodes plus this browser's discards
   *   error    the document could not be read — "?", never "0"
   *
   * THE FETCH NOW HAPPENS ON EVERY PAGE, and that reverses a recorded trade:
   * the Settings control fetched only on open because the document is ~64 KB.
   * A count that is always on screen cannot wait for a click. So the fetch
   * waits for idle instead of for load, and the browser's HTTP cache serves
   * the repeat views; the bytes are paid once per cache lifetime, not per page.
   */
  function fshGutsCount(state) {
    var local = discardedTodoIds().length;
    if (state.error) return { state: "error", text: "?", words: "could not be read (" + state.error + ")" };
    if (state.absent && local === 0) {
      return { state: "absent", text: "–", words: "no discarded-items document is published here" };
    }
    var n = (state.nodes || []).length + local;
    return { state: n === 0 ? "zero" : "some", text: String(n),
             words: n === 0 ? "empty" : n === 1 ? "1 item" : n + " items" };
  }

  function openFshGutsDialog(opener) {
    fetchDiscarded(function (state) {
      var dialog = el("dialog", { class: "fa-fsh-guts-dialog", "aria-labelledby": "fa-fsh-guts-dialog-title" });
      var head = el("div", { class: "fa-fsh-guts-dialog-head" });
      head.appendChild(el("h2", { id: "fa-fsh-guts-dialog-title" }, "fsh-guts — discarded items"));
      var close = el("button", { type: "button", class: "fa-fsh-guts-dialog-close",
                                 "aria-label": "Close fsh-guts", title: "Close" }, "×");
      head.appendChild(close);
      dialog.appendChild(head);
      // THE SAME list and restore the Settings control opens, not a second one.
      dialog.appendChild(buildDiscardedView(state.absent ? { nodes: [] } : state));
      function done() {
        if (dialog.open && typeof dialog.close === "function") dialog.close();
        if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
        if (opener && opener.isConnected) opener.focus();
      }
      close.addEventListener("click", done);
      dialog.addEventListener("cancel", function (e) { e.preventDefault(); done(); });
      dialog.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(); }
      });
      document.body.appendChild(dialog);
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      var first = dialog.querySelector(".fa-discarded-restore, .fa-discarded-item") || close;
      first.focus();
    });
  }

  function mountFshGutsNav() {
    var buttons = Array.prototype.filter.call(
      document.querySelectorAll("[data-fa-fsh-guts-open]"),
      function (b) { return !b.hasAttribute("data-fa-fsh-guts-wired"); });
    if (!buttons.length) return;
    buttons.forEach(function (b) { b.setAttribute("data-fa-fsh-guts-wired", ""); });
    function paint() {
      fetchDiscarded(function (state) {
        var c = fshGutsCount(state);
        Array.prototype.forEach.call(buttons, function (b) {
          var count = b.querySelector(".fa-nav-count");
          if (count) {
            count.textContent = c.text;
            count.setAttribute("data-fa-count-state", c.state);
          }
          b.setAttribute("data-fa-count-state", c.state);
          // The hover tip IS the accessible name — one string, not two that
          // can disagree (`rail-tips`: "the tooltip is the aria-label").
          var name = "fsh-guts, discarded items — " + c.words;
          b.setAttribute("aria-label", name);
          if (b.hasAttribute("data-fa-tip")) b.setAttribute("data-fa-tip", name);
        });
      });
    }
    Array.prototype.forEach.call(buttons, function (b) {
      b.removeAttribute("hidden");
      b.addEventListener("click", function (e) {
        e.preventDefault();
        openFshGutsDialog(b);
      });
    });
    document.addEventListener("fa:todos-discarded", paint);
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(paint, { timeout: 2000 });
    else setTimeout(paint, 0);
  }

  /* ── The kind fan (bean `4kj4`) ────────────────────────────────────────
   *
   * Owner, 2026-09-19: *"each content type should have an avatar in and out
   * of trash"*, *"if more than one kind then it fades through the avatars in
   * a loop"*, *"openning fan is panel. shows the DECLared kinds for that
   * instance, not inheritance"*, and — asked which of fan / autoplay-fade /
   * hover-fade they wanted — **all three**.
   *
   * ## The three layer rather than conflict, and that is what makes it legal
   *
   *   the fan        every kind visible AT ONCE — the base presentation
   *   the cycle      an emphasis moving through them, with a pause control
   *   hover / focus  drives the same emphasis, user-initiated
   *
   * **Nothing is conveyed by the motion.** The fan is already complete when
   * it is still: every avatar is present, and the accessible name lists
   * every kind in one string. The cycle only moves a highlight over a
   * display a reader can already read.
   *
   * That is what makes an autoplaying loop defensible here at all. WCAG
   * 2.2.2 requires motion over five seconds to be pausable — hence the
   * button — but the deeper requirement is that a reader who never sees the
   * animation loses nothing, and a cycling BADGE (one slot, swapping) would
   * have failed that no matter how many pause controls it carried.
   *
   * ## `prefers-reduced-motion` is checked in BOTH places
   *
   * The CSS suppresses the transition and the script never starts the timer.
   * Either alone is a bug: CSS-only leaves a timer mutating the DOM for no
   * visible reason, script-only leaves the transition running on whatever
   * the script does change. The media query is also LIVE — a reader who
   * turns the setting on mid-session has the loop stop, rather than having
   * to reload.
   */

  var KIND_CYCLE_MS = 2200;

  /** The kinds this instance declares, or [] when the page did not say. */
  function declaredKinds() {
    var node = document.getElementById("fa-declared-kinds");
    if (!node) return [];
    try {
      var parsed = JSON.parse(node.textContent || "[]");
      return Array.isArray(parsed) ? parsed.filter(function (k) { return typeof k === "string"; }) : [];
    } catch (_e) {
      console.warn("docs-ui: #fa-declared-kinds is not valid JSON; the kind fan was not mounted.");
      return [];
    }
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (_e) {
      // No matchMedia is not "the reader wants motion". Unknown resolves to
      // the safe answer, which is the same third-state rule as everywhere.
      return true;
    }
  }

  /**
   * One avatar. `trash` gives the discarded treatment.
   *
   * `aria-hidden` on every tile: the NAME is on the group, listing every
   * kind in one string. Sixteen focusable images would be sixteen stops for
   * a screen-reader user to walk through to learn one fact.
   */
  function avatarTile(kind, trash) {
    var a = el("span", { class: "fa-avatar", "data-fa-kind": kind, "aria-hidden": "true" });
    if (trash) a.setAttribute("data-fa-trash", "true");
    return a;
  }

  /**
   * The fan: every declared kind, with a cycling emphasis and a pause.
   *
   * Returns null when there is nothing to show — a caller must not mount an
   * empty control, and an instance that declares no kinds is a real state
   * rather than an error.
   */
  function buildKindFan(kinds, opts) {
    var list = (kinds || []).filter(Boolean);
    if (list.length === 0) return null;
    // Returns { fan, pause } rather than one element, and the caller places
    // them. The pause CANNOT live inside the fan when the fan is the face of
    // a button: a <button> inside a <button> is invalid, the parser closes
    // the outer one, and the whole control is destroyed at parse time. A
    // spec caught exactly that — after clicking pause, `.fa-kind-fan` was
    // "element(s) not found", because it had never survived parsing.
    //
    // It is also an accessibility fault in its own right: nested interactive
    // controls have no sane keyboard order and no agreed name computation.
    var trash = Boolean(opts && opts.trash);

    var wrap = el("div", {
      class: "fa-kind-fan",
      role: "img",
      // EVERY kind, in one string. The cycle conveys nothing a reader with
      // no sight of it would miss, because the name already said all of it.
      "aria-label":
        (trash ? "Discarded kinds: " : "Kinds this instance declares: ") + list.join(", "),
    });

    var strip = el("span", { class: "fa-kind-fan-strip" });
    list.forEach(function (kind) {
      var slot = el("span", { class: "fa-kind-fan-slot", "data-fa-kind-slot": kind });
      slot.appendChild(avatarTile(kind, trash));
      strip.appendChild(slot);
    });
    wrap.appendChild(strip);

    var slots = strip.querySelectorAll(".fa-kind-fan-slot");
    var at = 0;
    var timer = null;

    function paint(i) {
      for (var n = 0; n < slots.length; n++) {
        slots[n].setAttribute("data-fa-lit", n === i ? "true" : "false");
      }
    }

    function step() {
      at = (at + 1) % slots.length;
      paint(at);
    }

    function stop() {
      if (timer !== null) { clearInterval(timer); timer = null; }
      wrap.setAttribute("data-fa-cycling", "false");
    }

    function start() {
      // One kind has nothing to cycle THROUGH, and a "pause" on a still
      // image is a control that does nothing.
      if (slots.length < 2 || prefersReducedMotion() || timer !== null) return;
      timer = setInterval(step, KIND_CYCLE_MS);
      wrap.setAttribute("data-fa-cycling", "true");
    }

    paint(0);

    // ── The pause control — WCAG 2.2.2 ──────────────────────────────
    //
    // Only when the loop can actually run. A button that says "pause" beside
    // something already still is worse than no button: it tells a reader
    // there is motion they cannot see.
    var pause = null;
    if (slots.length > 1 && !prefersReducedMotion()) {
      pause = el("button", {
        type: "button",
        class: "fa-kind-fan-pause",
        "aria-label": "Pause the cycling highlight",
      }, "❙❙");
      pause.addEventListener("click", function () {
        if (timer === null) {
          start();
          pause.setAttribute("aria-label", "Pause the cycling highlight");
          pause.textContent = "❙❙";
        } else {
          stop();
          pause.setAttribute("aria-label", "Resume the cycling highlight");
          pause.textContent = "▶";
        }
      });
      start();
    }

    // ── Hover and focus drive it too ────────────────────────────────
    //
    // User-initiated, so it is outside 2.2.2 entirely — and it is why a
    // reader who paused gets the emphasis back on demand without unpausing.
    function nudge() {
      if (prefersReducedMotion()) return;
      step();
    }
    wrap.addEventListener("mouseenter", nudge);
    strip.addEventListener("focusin", nudge);

    // LIVE, not read once. A reader who turns reduced-motion on mid-session
    // should have the loop stop, not have to reload the page to be heard.
    try {
      var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      var onChange = function () {
        if (mq.matches) {
          stop();
          if (pause) pause.remove();
        }
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch (_e) {
      // No matchMedia: `prefersReducedMotion` already returned true, so the
      // loop never started and there is nothing to tear down.
    }

    return { fan: wrap, pause: pause, stop: stop };
  }

  /**
   * The panel the fan opens: every declared kind, named.
   *
   * The fan says HOW MANY and gives them a face; this says WHICH, in words.
   * A reader who cannot tell a spanner from a shield at 24px — which is
   * most readers, most of the time — gets the answer here rather than by
   * hovering each one.
   *
   * It states DECLARED vs INHERITED in the panel itself, because the
   * distinction is the owner's and is invisible from the list: a reader
   * seeing twelve kinds has no way to know the effective set is larger
   * unless the panel says so.
   */
  function buildKindsPanel(kinds) {
    var wrap = el("div", { class: "fa-kinds-panel fa-tile-content" });
    wrap.appendChild(el("p", { class: "fa-kinds-note" },
      "What this instance declares in its own harness. A dependency's kinds " +
      "are inherited at resolve time and are deliberately not listed here."));

    var ul = el("ul", { class: "fa-kinds-list" });
    kinds.forEach(function (kind) {
      var li = el("li", { class: "fa-kinds-row" });
      li.appendChild(avatarTile(kind, false));
      li.appendChild(el("span", { class: "fa-kinds-name" }, kind));
      // The discarded treatment, beside the live one. The owner asked for
      // an avatar "in and out of trash", and the pair is only legible as a
      // pair — shown apart, nobody can tell muted from a different colour.
      var t = avatarTile(kind, true);
      t.classList.add("fa-kinds-trash");
      li.appendChild(t);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    wrap.appendChild(el("p", { class: "fa-kinds-legend" },
      "Each kind is shown twice: as it appears normally, and as it appears " +
      "once discarded to the trashcan."));
    return wrap;
  }

  /* ── Action tiles ────────────────────────────────────────────────────── */

  // A three-by-three of rounded squares: the launcher. It says "there are
  // several things here" without naming one of them, which the gear and the
  // globe both did while standing for the whole row.
  // `fill="currentColor"` ON THE GROUP, and its absence was a live defect.
  //
  // Owner, 2026-09-23, with a screenshot of the dark-mode navbar: *"exploding
  // icon hard to see in dark mode"*. It was not hard to see — it was BLACK.
  // An SVG shape with no `fill` paints with the initial value, which is black,
  // and `color` never reaches it. On this panel (rgb(39,38,43)) that is about
  // **1.4:1** — measured by walking the rendered shapes, which is the only way
  // it shows: the element's own `color` computes to a perfectly good
  // rgb(230,225,232) and a contrast check that reads THAT reports 7.99:1 on an
  // invisible icon.
  //
  // The siblings escaped because they are strokes: every other glyph in this
  // row wraps its shapes in `fill="none" stroke="currentColor"`. These two are
  // the only FILLED ones, which is why they were the only two wrong.
  var TILES_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">' +
    '<rect x="3" y="3" width="6" height="6" rx="1.4"/>' +
    '<rect x="15" y="3" width="6" height="6" rx="1.4"/>' +
    '<rect x="3" y="15" width="6" height="6" rx="1.4"/>' +
    '<rect x="15" y="15" width="6" height="6" rx="1.4"/>' +
    '<rect x="9.5" y="9.5" width="5" height="5" rx="1.2"/>' +
    "</svg>";

  // A net: nodes joined by edges. The owner asked for "an icon of a net" for
  // the knowledge graph, which is also what the thing IS, so the glyph is not
  // a metaphor that has to be learned.
  var NET_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 4.5 5 9.5M12 4.5l7 5M5 9.5l3.5 8M19 9.5l-3.5 8M8.5 17.5h7M5 9.5h14" ' +
    'fill="none" stroke="currentColor" stroke-width="1.3"/>' +
    // FILLED NODES, so they need the colour said explicitly — the edges above
    // are strokes and already carry it. See TILES_GLYPH for what their absence
    // looked like: five black dots on a dark panel.
    '<g fill="currentColor">' +
    '<circle cx="12" cy="4.5" r="2.1"/><circle cx="5" cy="9.5" r="2.1"/>' +
    '<circle cx="19" cy="9.5" r="2.1"/><circle cx="8.5" cy="17.5" r="2.1"/>' +
    '<circle cx="15.5" cy="17.5" r="2.1"/></g>' +
    "</svg>";

  // Angle brackets and a slash: the source.
  var CODE_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M8.6 6.4 3 12l5.6 5.6 1.5-1.5L6 12l4.1-4.1zM15.4 6.4l-1.5 1.5L18 12l-4.1 4.1 1.5 1.5L21 12z"/>' +
    '<path d="M13.6 3.6 10 20.4l-1.9-.4L11.7 3.2z"/>' +
    "</svg>";

  // A braced document: the graph as DATA, as against the net (the graph as a
  // thing to browse) and the angle brackets (the code that produced it). The
  // three tiles are three different artefacts and must not share a glyph.
  var DATA_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.4"/>' +
    '<path d="M13 3v5h5" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
    '<path d="M10.2 12.3c-1 0-1.2.5-1.2 1.2v.9c0 .7-.3 1.1-1 1.1.7 0 1 .4 1 1.1v.9c0 .7.2 1.2 1.2 1.2" ' +
    'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M13.8 12.3c1 0 1.2.5 1.2 1.2v.9c0 .7.3 1.1 1 1.1-.7 0-1 .4-1 1.1v.9c0 .7-.2 1.2-1.2 1.2" ' +
    'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    "</svg>";

  /* ── The glyph a tile wears, by declared NAME ────────────────────────
   *
   * Every graph tile wore NET_GLYPH — the graph-as-a-thing-to-browse net —
   * because a tile had no way to say otherwise. `VisualisationSchema.icon`
   * gives it one, and this is the registry that name resolves against.
   *
   * A NAME rather than markup, and the reason is not style. `tileLink` assigns
   * its glyph with `innerHTML`, so a declaration carrying SVG would make
   * `<instance>.json` an HTML injection site — and a declaration is INHERITED,
   * reaching this instance from a dependency through `resolveSkillDirs`. The
   * markup would not even have to be authored by somebody with commit access
   * here. R17's rule, one surface along: allow-list, default-deny.
   *
   * `hasOwnProperty` and not `TILE_GLYPHS[name]`, because the name comes from
   * a declaration: `"constructor"` and `"toString"` are inherited properties
   * of every object literal, and a bare lookup would hand one of them to
   * `innerHTML`.
   *
   * An unknown name falls back rather than failing. The registry ships with
   * the site and the declaration is authored apart from it, so a folio may
   * name a glyph a slightly older platform has not got; a tile that vanished
   * over that would turn a cosmetic mismatch into a missing navigation entry.
   * The fallback is exactly what every tile rendered before this existed.
   */
  /*
   * TWO beans, not the four the owner's reference art has, and the count was
   * MEASURED rather than chosen. `.fa-tile svg` is `1.25rem` — 20px — so 20px
   * is the whole of this glyph's job. Five candidates were rendered at it:
   * three outlined beans crowd until the hilums merge into one grey mass;
   * three filled with an oval cut-out read as olives; a filled crescent
   * collapses to a speck. At two beans the shapes and their hilums stay
   * separate at 20px and the drawing still looks like the reference at 64.
   *
   * Which is the usual trade and worth naming: an icon is not a picture
   * shrunk, and fidelity to the source art at a size nobody views it at is
   * not fidelity to anything.
   */
  var BEANS_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
    '<g transform="translate(8.4,8.6) rotate(-32)">' +
    '<ellipse rx="5.6" ry="3.7"/><path d="M-1.9 0.7A2.3 2.3 0 0 1 1.9-0.4"/></g>' +
    '<g transform="translate(15.6,15.4) rotate(26)">' +
    '<ellipse rx="5.6" ry="3.7"/><path d="M-1.9 0.7A2.3 2.3 0 0 1 1.9-0.4"/></g>' +
    "</g></svg>";

  /*
   * A TRAY WITH SOMETHING DROPPING INTO IT — the intake queue, and
   * deliberately not a folder or a book. `uploads` and `library` are two
   * stages of one pipeline, so their tiles have to be told apart at a glance:
   * the library's is the corpus, this one is the inbox. Both tiles opened the
   * same page until 2026-09-21 and wore the same glyph, which is how a reader
   * came to think there was one thing under two names.
   *
   * Drawn for 20px like BEANS_GLYPH, for the reason recorded there: the arrow
   * is a single stroke and the tray a single closed path, because two nested
   * outlines merge into a grey block at the size this is actually rendered.
   */
  var UPLOADS_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<g fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M3.6 14.8v2.9a1.9 1.9 0 0 0 1.9 1.9h13a1.9 1.9 0 0 0 1.9-1.9v-2.9h-4.9' +
    'l-1.3 1.9h-3.4l-1.3-1.9z"/>' +
    '<path d="M12 3.6v7.7"/><path d="M8.7 8.1 12 11.4l3.3-3.3"/>' +
    "</g></svg>";

  // THE FACTORY FLOW — owner: *"one for processes viewer/ (the factory flow)"*.
  //
  // Two rounded tasks and the sequence flow between them: the smallest thing
  // that reads as BPMN rather than as a generic diagram. Drawn rather than
  // borrowed because every other glyph here is already spoken for, and two
  // icons sharing one drawing in a six-slot row is a row where two slots look
  // like one control.
  var PROCESS_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<rect x="2.5" y="8" width="7" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
    '<rect x="14.5" y="8" width="7" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
    '<path d="M9.5 11h5M13 9.5 14.5 11 13 12.5" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
    "</svg>";

  /*
   * SIX KIND GLYPHS, one per graph typology a declared tile opens (ob3m finding
   * 11: 12 of 14 declared tiles drew the same net, so the More panel told its
   * tiles apart by caption alone). One drawing per KIND rather than per tile:
   * "Skills — cat-harness" and "Skills — who-iris" are the same kind of place
   * in two harnesses, and the caption already says which harness.
   *
   * Drawn for 20px on the rule BEANS_GLYPH records — single strokes, no nested
   * outlines — and each was rendered at that size beside the other eight
   * before it went in.
   */
  var KIND_STROKE =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">';
  // A spanner: something you RUN.
  var TOOLS_GLYPH = KIND_STROKE +
    '<path d="M14.7 6.3a4 4 0 0 0 4.9 5.1l-8.6 8.6a2.1 2.1 0 0 1-3-3l8.6-8.6a4 4 0 0 0-1.9-2.1z"/>' +
    '<path d="M14.7 6.3 17.2 3.8"/></g></svg>';
  // Braces: a SHAPE that data is checked against.
  var SCHEMA_GLYPH = KIND_STROKE +
    '<path d="M9 4.5H8a2 2 0 0 0-2 2V10a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3.5a2 2 0 0 0 2 2h1"/>' +
    '<path d="M15 4.5h1a2 2 0 0 1 2 2V10a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3.5a2 2 0 0 1-2 2h-1"/></g></svg>';
  // An open book: instructions an agent READS.
  var SKILLS_GLYPH = KIND_STROKE +
    '<path d="M12 7c-2-1.6-4.7-2-8-1.6v12c3.3-.4 6 0 8 1.6 2-1.6 4.7-2 8-1.6v-12c-3.3-.4-6 0-8 1.6z"/>' +
    '<path d="M12 7v12"/></g></svg>';
  // A compass: a way of working, chosen before the work.
  var METHOD_GLYPH = KIND_STROKE +
    '<circle cx="12" cy="12" r="8.2"/>' +
    '<path d="M15.4 8.6 13.3 13.3 8.6 15.4 10.7 10.7z"/></g></svg>';
  // Axes and a cluster: an index that places things NEAR each other.
  var INDEX_GLYPH = KIND_STROKE +
    '<path d="M4.5 4.5v15h15"/>' +
    '<circle cx="10" cy="13" r="1.2"/><circle cx="14" cy="9.5" r="1.2"/><circle cx="16.5" cy="13.5" r="1.2"/></g></svg>';
  // A page with a folded corner: prose to read.
  var DOCS_GLYPH = KIND_STROKE +
    '<path d="M13.5 3.5H7a1.8 1.8 0 0 0-1.8 1.8v13.4A1.8 1.8 0 0 0 7 20.5h10a1.8 1.8 0 0 0 1.8-1.8V8.8z"/>' +
    '<path d="M13.5 3.5v5.3h5.3"/><path d="M8.8 13h6.4M8.8 16.4h4.2"/></g></svg>';

  // Three spines on a shelf: the CORPUS. Not a single book, which is SKILLS'
  // drawing, and not a tray, which is the uploads INBOX the library is fed from.
  var LIBRARY_GLYPH = KIND_STROKE +
    '<path d="M5 4.5v15M9 4.5v15"/><path d="M13.2 5.4l3.6 13.9"/><path d="M3.5 19.5h17"/></g></svg>';

  var TILE_GLYPHS = {
    beans: BEANS_GLYPH, uploads: UPLOADS_GLYPH, processes: PROCESS_GLYPH, library: LIBRARY_GLYPH,
    tools: TOOLS_GLYPH, schemas: SCHEMA_GLYPH, skills: SKILLS_GLYPH,
    methodologies: METHOD_GLYPH, index: INDEX_GLYPH, docs: DOCS_GLYPH
  };

  function glyphFor(name) {
    if (typeof name !== "string") return NET_GLYPH;
    return Object.prototype.hasOwnProperty.call(TILE_GLYPHS, name)
      ? TILE_GLYPHS[name]
      : NET_GLYPH;
  }

  // A magnifier: search. The owner asked for the search to leave the main
  // panel and become "a icon in navbar that expands" -- this is the icon, and
  // the launcher it lives in is the expansion.
  var SEARCH_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M15.2 15.2 20 20" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round"/>' +
    "</svg>";

  // Where just-the-docs puts its search. `.search` is the container holding
  // BOTH the input and the results list; moving the container keeps them
  // together and keeps the theme's own handlers, which are bound to the
  // elements rather than to their position.
  var SEARCH_SELECTORS = [".search", "#search", ".main-header .search"];

  /**
   * Where the knowledge-graph and source tiles point.
   *
   * Read from `#fa-site-links`, which `head_custom.html` fills from
   * `_config.yml` through `relative_url`. Hardcoding either here would put a
   * folio's own address inside shared client code and would break under a
   * `baseurl` -- this site serves from `/folio-assistant/`, so an absolute
   * `/kg/` is a 404 rather than a wrong-looking link.
   *
   * An unreadable or absent block returns an empty object and the affected
   * tile is NOT DRAWN. A tile that goes nowhere is worse than a missing one,
   * because the reader cannot tell a broken link from a broken site.
   */
  function getSiteLinks() {
    var node = document.getElementById("fa-site-links");
    if (!node) return {};
    try {
      var parsed = JSON.parse(node.textContent || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_e) {
      console.warn("docs-ui: #fa-site-links is not valid JSON; the knowledge-graph " +
                   "and source tiles were not mounted.");
      return {};
    }
  }

  /**
   * The header's controls, as ONE launcher over a grid of same-sized tiles.
   *
   * ## Why one, and not five
   *
   * There were four header buttons -- theme, reading preferences, language, QR
   * -- inside a row just-the-docs caps at `3.75rem` and shares with the site
   * title. The owner's words were "that navbar is getting crowded", and adding
   * the knowledge-graph viewer and the source link to that row would have made
   * it six. One launcher takes the row from four icons to one.
   *
   * The alternative reading of the request -- a row of icons that each open a
   * tile-sized panel -- takes it from four to five and makes the stated
   * problem worse, which is what decided it.
   *
   * ## The tile is the QR panel's footprint
   *
   * "build out to the size of the QR code. use that as kind of the template
   * size for action icons". So the panel is exactly the region the QR code
   * already occupies -- `16.5rem` in the sidebar column -- and every view
   * renders into it. Nothing here introduces a new place for content to appear.
   *
   * ## The panel is a SIBLING of the header
   *
   * Unchanged, and load-bearing: `.site-header` is a hard-capped row, so a
   * panel left inside it is clipped. `mountPanelInSidebarColumn` puts it in
   * `.side-bar`'s flex column where it pushes the nav down instead of covering
   * it. Three separate panels used to solve this three different ways, one of
   * them by opening upward into the staging banner; there is now one panel and
   * one answer.
   *
   * ## Accessibility (bean `gjli`)
   *
   * Tiles are 4rem tall, well over the 24px SC 2.5.8 floor, because this
   * instance's declared interaction profile is low-dexterity and a target that
   * is barely legal is a target that is hard to hit. Every tile is a real
   * `<button>` or `<a>`, so it comes with keyboard activation rather than
   * needing it added. Opening a view moves focus to the view's own heading and
   * Back returns it to the tile that was pressed -- a reader who cannot easily
   * point must never have to hunt for where the keyboard went.
   */
  function mountActionTiles() {
    var title = firstMatch(TITLE_SELECTORS);
    var header = title ? title.parentNode : firstMatch(HEADER_SELECTORS);
    if (!header) {
      // The one unrecoverable case: no sidebar header of any shape.
      console.warn("docs-ui: no site header found (tried " + HEADER_SELECTORS.join(", ") +
                   "); the action tiles were not mounted.");
      return;
    }
    if (!title) {
      // Degraded but usable: the control works, it just sits on its own
      // rather than beside a title it could not locate.
      console.warn("docs-ui: no site title found (tried " + TITLE_SELECTORS.join(", ") +
                   "); mounting the action tiles into the header without it.");
    }

    var host = el("div", { class: "fa-qr-host", "data-open": "false" });
    if (title) {
      title.parentNode.insertBefore(host, title);
      host.appendChild(title);
    } else {
      header.appendChild(host);
    }

    var toggle = el("button", {
      type: "button",
      class: "fa-qr-toggle fa-tiles-toggle",
      "aria-label": "Actions — settings, discarded items",
      title: "Actions — settings, discarded items",
      "data-fa-tip": "Actions — settings, discarded items",
      "aria-expanded": "false",
    });
    toggle.innerHTML = TILES_GLYPH; // static markup above, no input involved
    // The header's three buttons sit in a ROW whose order is the page's; each
    // one's English name and tooltip is marked on the button (bean `giiw`).
    chromeText(toggle);

    /* ── Two mini-icons, between the title and the launcher ──────────────
     *
     * Owner, 2026-09-21: *"can you put dark/light mode switch in mini-icon on
     * top as well as language icon. to right of folio-asst, to left of the
     * [3x3 checkboard]"* — the checkerboard being this launcher, confirmed in
     * the same exchange.
     *
     * ## This partly reverses `1le7`, deliberately and on the owner's word
     *
     * That bean collapsed FOUR header icons into one launcher because "that
     * navbar is getting crowded", and the comment on `tileButton` below still
     * refuses a dedicated search magnifier for exactly that reason. The two
     * are not in conflict and the difference is worth stating, because the
     * next reader will otherwise "fix" one of them:
     *
     *   - search was refused because it would save ONE PRESS on a control
     *     reached twice a session, and the owner answered "search is two";
     *   - these two were ASKED FOR by name.
     *
     * A row of three is not the row of six `1le7` was avoiding. If a fourth
     * is ever proposed, that is the point to go back and ask.
     *
     * ## Language OPENS the launcher rather than duplicating its view
     *
     * The button presses the same `showView("language")` the tile does, so
     * there is one language panel and one copy of its state. A second bar
     * built here would look identical and drift — the failure this file's
     * header calls out, and the reason the search field is MOVED rather than
     * rebuilt. The mini-button is a shortcut INTO the panel, not a second
     * panel.
     */
    host.appendChild(chromeText(buildSchemeMini()));

    var langMini = chromeText(el("button", {
      type: "button",
      class: "fa-qr-toggle fa-lang-mini",
      "aria-label": "Language",
    }));
    langMini.innerHTML = GLOBE_GLYPH;
    langMini.addEventListener("click", function () {
      // Open the launcher first: `showView` hides the grid and renders into
      // the panel, which is invisible while the host is closed, so a reader
      // pressing this on a closed launcher would otherwise get nothing and
      // conclude the button is dead.
      open(true);
      showView("language", "Language", langMini);
    });
    host.appendChild(langMini);

    host.appendChild(toggle);

    // ENGLISH AT THE ROOT (bean `giiw`): every caption, view and setting in
    // this panel is authored here in English and none is translated, so on an
    // Arabic page it is an English panel, not English laid out right-to-left.
    var panel = chromeText(el("div", {
      class: "fa-tiles",
      "data-open": "false",
      role: "region",
      "aria-label": "Actions",
      tabindex: "-1",
    }));
    var grid = el("div", { class: "fa-tiles-grid", role: "group", "aria-label": "Actions" });
    var view = el("div", { class: "fa-tiles-view", hidden: "hidden" });
    panel.appendChild(grid);
    panel.appendChild(view);
    mountPanelInSidebarColumn(host, panel);

    /* ── The search: a magnifier at the top of the display window ─────────
     *
     * Owner, 2026-09-30: *"search that should be a collsaible icon/avatar on
     * top of display window... that when open is full span width of all
     * avaioblae"* (issue #1715).
     *
     * ## THIS REPLACES THE NAVBAR/CORNER PAIR, and the old design is recorded
     *
     * 2026-09-21 (`rx6k`) put the field back in the display panel's top row
     * with a "Hide search" control that slid it to a FIXED upper-right card;
     * 2026-09-23 made it *"start open full top of display panel"*. Measured on
     * a local build before this change: the open row cost 48px of every page
     * at 1280px and 42px at 390px before the first line of content, results
     * were capped at the theme's 536px under a 992px field, on a phone the
     * "Hide search" button left the field 215px of 390, and Escape did
     * nothing. The fixed corner card was also the one control on the page
     * drawn over content at the top right, which on a phone is where the
     * theme's own menu button sits.
     *
     * So there is ONE place and TWO states, and the place does not move:
     *
     *   closed  the magnifier alone, at the inline-end of the glass band's
     *           row (issue #2201; it was floated in the panel until then).
     *           `aria-expanded="false"`.
     *   open    the field across the rest of the band, then the magnifier —
     *           in the SAME place, with the same look — and everything that
     *           is not the field (results, the theme's status lines, a
     *           preview's notice) dropped below it. Focus goes into the
     *           field. `aria-expanded="true"`.
     *
     * The magnifier is the toggle in both states, and Escape anywhere inside
     * closes and returns focus to it (`l4zi`: the inverse is always the same
     * control, in the same place). What survives from 2026-09-23 is the
     * owner's *"maginfyingglass avatar/braadning should be visibile always"*:
     * the glyph is on screen in both states.
     *
     * ## Why in the panel's flow and not fixed to the window
     *
     * PR #1709 puts a fixed strip (`.fa-glass-band`, z 89) behind the Folio
     * handle at the top CENTRE while the page scrolls. A second fixed control
     * at the top would have to negotiate that strip, the staging banner and
     * the phone header's menu button; one in flow negotiates none of them.
     * It sits at the top of the display panel, below the header band the
     * handle lives in, and scrolls UNDER the strip like any other content.
     * Mid-page, the Search tile in the launcher reveals it and the focus
     * scroll lands it below the strip (`scroll-padding-top`, same PR).
     *
     * ## Moved, never rebuilt — UNCHANGED, and still the load-bearing part
     *
     * The theme's own script binds to the input it rendered. A search box
     * reconstructed here would look identical and do nothing. So the theme's
     * `.search` container is MOVED, with its input, its label and its results
     * list intact, and every handler moves with it because handlers belong to
     * elements and not to positions.
     *
     * ## It must never leave the document — ALSO UNCHANGED
     *
     * just-the-docs looks its input up by id when it initialises, and
     * `getElementById` does not find a detached node. So the holder lives
     * inside `searchHome`, which is in the document from mount, and the two
     * states are an attribute on `searchHome` — closing is `display: none` on
     * the holder, never a removal.
     *
     * ## Absent is a real state
     *
     * `search_enabled: false`, or a theme that renamed the container, means
     * there is nothing to adopt. Nothing is mounted, no magnifier is drawn,
     * and the warning says what was looked for.
     */
    /* ALWAYS CLOSED ON ARRIVAL. Owner, 2026-10-05: *"start with search bar
     * closed"*. Until then an open search was remembered per viewer
     * (`fa-search-open`) and restored on the next page, which is exactly the
     * page that opened with the field already across the band. Nothing reads
     * or writes that key any more; a stale value left in a browser is inert.
     * What survives is #2202's: closing never clears, so within a page the
     * typed text is there again when the magnifier reopens it. */

    var searchHolder = null;
    var searchHome = null;
    var searchToggle = null;
    var adopted = firstMatch(SEARCH_SELECTORS);
    /* IN THE PAGE'S TOP BAR, IT STAYS THERE — owner, 2026-10-15, "Top bar,
     * like IG sites". cat-harness-tools' rail pass makes the theme's header
     * every page's top bar (`.fa-page-bar`, `lib/site-bar.ts`) with the search
     * box in it, so it is not moved into the band behind a magnifier. What
     * still applies here: the reader's text and the results are `dir="auto"`,
     * and the theme's scroll-to-top on every keystroke is refused while the
     * field has focus (#1732), since the bar is sticky. */
    var barSearch = adopted && typeof adopted.closest === "function" ? adopted.closest(".fa-page-bar") : null;
    if (barSearch) {
      Array.prototype.forEach.call(
        adopted.querySelectorAll("input, #search-results, .search-results"),
        function (n) { n.setAttribute("dir", "auto"); });
      var barNativeScroll = window.scroll;
      window.scroll = function (x, y) {
        if (arguments.length === 2 && x === 0 && (y === 0 || y === -1) && adopted.contains(document.activeElement)) return undefined;
        return barNativeScroll.apply(window, arguments);
      };
      adopted = null;
    }
    if (adopted) {
      searchHolder = el("div", { class: "fa-search-holder", id: "fa-search-holder" });
      searchHolder.appendChild(adopted);

      /* EVERYTHING THAT IS NOT THE FIELD DROPS BELOW IT — issue #2201.
       *
       * Owner, 2026-10-05: the status line *"Search everywhere (15601
       * entries, 16.9 MB) — now searching smart-trust"* was drawn ON TOP of
       * the field, so neither the placeholder nor the typed text could be
       * read. Measured on the gh-pages build of `smart-trust/index.html` at
       * 1280px: the `.search-everywhere` button at x=124, y=92, inside the
       * input's own box (x=124, y=92, 1124x36).
       *
       * The theme's script puts that button after `#search-results` and the
       * identifier-lookup links at the end of the results' parent, and it
       * does so when ITS fetch settles, which may be before or after this
       * runs. So the results list moves into one container under the field,
       * and the theme's own inserts land there by construction; anything
       * that landed first is moved in after it. The container hangs below
       * the field (`.fa-search-drop` in `docs-ui.css`), so nothing it holds
       * can share the field's box. */
      var searchDrop = el("div", { class: "fa-search-drop" });
      var results = adopted.querySelector("#search-results, .search-results");
      adopted.appendChild(searchDrop);
      if (results) searchDrop.appendChild(results);
      Array.prototype.forEach.call(
        adopted.querySelectorAll(".search-everywhere, .search-remote"),
        function (n) { if (n.parentNode !== searchDrop) searchDrop.appendChild(n); });

      /* The notice goes ON THE SEARCH SURFACE, not only in the staging banner.
       * Somebody who types into the box has not necessarily read the banner at
       * the top of the page — and the banner is about the PREVIEW, while this
       * is about the INDEX, which are different claims. `role="status"` so a
       * screen reader hears it when the field is reached, matching this
       * instance's declared low-dexterity / assistive interaction profile. */
      var searchNotice = searchIndexNotice(searchIndexState());
      if (searchNotice) {
        var noticeEl = el("p", { class: "fa-search-notice", role: "status" });
        noticeEl.textContent = searchNotice;
        searchDrop.appendChild(noticeEl);
      }

      /* ENGLISH CHROME, READER'S TEXT (bean `giiw`). The magnifier, its
       * tooltip, the theme's placeholder, the notice and "Search everywhere"
       * are English on every locale, so the search is marked English at its
       * root — which also keeps the magnifier on the RIGHT of the field on an
       * Arabic page, as the owner asked of it (#2201). The two things in it
       * that are NOT ours are given `dir="auto"`: what the reader types, and
       * the results, whose titles are pages in whatever language they are.
       * The search sits in the band's end slot either way; the BAND keeps the
       * page's direction. */
      searchHome = chromeText(el("div", { class: "fa-search-home", "data-open": "false" }));
      Array.prototype.forEach.call(
        adopted.querySelectorAll("input, #search-results, .search-results"),
        function (n) { n.setAttribute("dir", "auto"); });

      /* The magnifier: the one control, in both states. Its NAME stays
       * "Search" — the state is `aria-expanded`, which is what a screen
       * reader announces for a disclosure; renaming it per state as well
       * would say the state twice and change the name a voice user speaks. */
      searchToggle = el("button", {
        type: "button",
        class: "fa-search-peek",
        "aria-label": "Search",
        "aria-expanded": "false",
        "aria-controls": "fa-search-holder",
        title: "Search this site",
      });
      searchToggle.innerHTML = SEARCH_GLYPH;

      searchToggle.addEventListener("click", function () {
        if (searchHome.getAttribute("data-open") === "true") closeSearch(true);
        else revealSearch();
      });

      /* Escape from anywhere inside — the field, a result link, the
       * magnifier — closes and hands focus back to the magnifier, so a
       * keyboard reader is never left on a node that is now display:none. */
      searchHome.addEventListener("keydown", function (e) {
        if (e.key !== "Escape" || searchHome.getAttribute("data-open") !== "true") return;
        e.preventDefault();
        e.stopPropagation();
        closeSearch(true);
      });

      /* THE THEME'S SCROLL-TO-TOP, REFUSED WHILE OUR FIELD IS IN USE — #1732.
       *
       * just-the-docs, on EVERY keystroke in its search box, calls
       * `window.scroll(0, -1)` and then, a tick later, `window.scroll(0, 0)` —
       * an iOS Safari workaround for the full-screen overlay it draws search
       * in. docs-ui does not draw that overlay. With the magnifier pinned
       * (sticky) mid-page, each keystroke threw the reader back to the top of
       * the page they were reading.
       *
       * REFUSED, EXACTLY: a call to `window.scroll` with two arguments, x = 0
       * and y = 0 or -1, while the search is OPEN and focus is INSIDE it.
       * Every other call passes through unchanged — any other coordinates,
       * the one-argument options form, `scrollTo`, `scrollBy`, and every call
       * while search is closed or focus is elsewhere. It wraps the function
       * rather than editing the theme, because the theme is a pinned remote
       * dependency this repository does not vendor. */
      var nativeScroll = window.scroll;
      window.scroll = function (x, y) {
        if (arguments.length === 2 && x === 0 && (y === 0 || y === -1) &&
            searchHome.getAttribute("data-open") === "true" &&
            searchHome.contains(document.activeElement)) {
          return undefined;
        }
        return nativeScroll.apply(window, arguments);
      };

      /* FIELD FIRST, MAGNIFIER LAST — issue #2201. The owner: *"the
       * magnifier stays on the right always"*. It was first in the row, so
       * opening slid it from the inline-end (closed, floated) to the
       * inline-start (open, before the field). Last in DOM order, in a row
       * that sits at the band's inline-end, it is in the same place in both
       * states and the field opens towards the inline-start beside it. */
      searchHome.appendChild(searchHolder);
      searchHome.appendChild(searchToggle);

      /* IN THE BAND, at its inline-end — issue #2201. The band is the row the
       * page's own controls share with the Folio handle; `glassBandSlot`
       * says where it is mounted and why. */
      glassBandSlot("end").appendChild(searchHome);
      glassBandItem("search", function () { closeSearch(false); });

      paintSearchOpen(false);
    } else if (!barSearch) {
      console.warn("docs-ui: no site search found (tried " + SEARCH_SELECTORS.join(", ") +
                   "); search was not mounted and no magnifier was drawn.");
    }

    function paintSearchOpen(open) {
      if (!searchHome) return;
      searchHome.setAttribute("data-open", open ? "true" : "false");
      searchToggle.setAttribute("aria-expanded", open ? "true" : "false");
      // NO TOOLTIP WHILE OPEN — issue #2201. The owner's screenshot had
      // "Close search (Esc)" drawn over the lines under the field. Closed, the
      // tooltip is how a pointer reader learns what the glyph does; open, the
      // field beside it already says so, and Escape is announced by
      // `aria-keyshortcuts` instead.
      if (open) {
        searchToggle.removeAttribute("title");
        searchToggle.setAttribute("aria-keyshortcuts", "Escape");
      } else {
        searchToggle.setAttribute("title", "Search this site");
        searchToggle.removeAttribute("aria-keyshortcuts");
      }
      glassBandActive("search", open);
    }

    /** Close search and, when asked, put focus back on the magnifier. */
    function closeSearch(returnFocus) {
      if (!searchHome) return;
      paintSearchOpen(false);
      if (returnFocus) searchToggle.focus();
    }

    /**
     * Open search where it lives, and put the cursor in it.
     *
     * The one entry point for "I want to search": the magnifier presses it,
     * and so does the Search tile. Neither MOVES the field, because two
     * places search can be is two places a reader has to look for it.
     */
    function revealSearch() {
      if (!searchHome) return;
      paintSearchOpen(true);
      var input = searchHolder && searchHolder.querySelector("input");
      if (input) input.focus();
    }

    /**
     * Formerly: return the search field to its always-in-document holder.
     *
     * The field no longer travels into the tiles panel, so in the normal case
     * there is nothing to undo. It is KEPT as a safeguard rather than deleted
     * because `showGrid` wipes the view with `innerHTML = ""`, and that
     * DETACHES whatever is inside — if any future view ever borrows the
     * holder again, the wipe would silently kill search, which is the exact
     * failure the long comment above exists about. A no-op guard is cheap;
     * rediscovering that bug is not.
     */
    function parkSearch() {
      if (searchHolder && searchHome && searchHolder.parentNode !== searchHome) {
        searchHome.appendChild(searchHolder);
      }
    }

    /* ── The views ─────────────────────────────────────────────────────── */

    // Built once, on first open, and kept. Rebuilding on every open would
    // discard a half-set checkbox and re-encode the QR for nothing; building
    // at mount time would run the encoder on every page load for a panel most
    // readers never open.
    var built = false;
    var qrArt = el("span");
    var qrCaption = el("span", { class: "fa-qr-caption" });
    var views = {};
    var openTile = null;   // the tile to return focus to when Back is pressed

    // The encoder is loaded the first time the tile opens (owner, 2026-11-14:
    // "do lazy load content and libs"), by navbar-row.js's shared loader.
    function renderQr() {
      if (typeof qrcode === "function") { drawQr(); return; }
      qrCaption.textContent = "Loading the QR code\u2026";
      var ensure = window.faEnsureQrcode;
      if (typeof ensure !== "function") {
        qrCaption.textContent = "The QR code could not be drawn: its encoder is not available on this page.";
        return;
      }
      ensure(drawQr, function () {
        qrCaption.textContent = "The QR code could not be drawn: its encoder did not load.";
      });
    }

    function drawQr() {
      var url = window.location.href;
      var q = qrcode(0, "M");
      q.addData(url);
      q.make();
      // createSvgTag builds the tag from module bits; the URL is not present
      // in the string it returns.
      qrArt.innerHTML = q.createSvgTag({ scalable: true, margin: 4 });
      qrCaption.textContent = url;
    }

    function buildViews() {
      if (built) return;
      built = true;

      var settings = el("div", { class: "fa-tile-content" });
      // FIRST, above the scheme: a reader who came here for the glass's
      // opacity is told where it is before reading anything else (`ob3m` 12).
      // The launcher closes first, so focus lands on the glass panel's
      // heading rather than staying behind in a sidebar the glass covers.
      var toGlass = settingsCrossLink("glass", function () { open(false); });
      if (toGlass) settings.appendChild(toGlass);
      settings.appendChild(buildThemeTile());
      settings.appendChild(buildReadingPrefs());

      // The discarded-items control — UNDER SETTINGS, per the owner, which is
      // also why the 64 KB document is fetched here and not on page load.
      //
      // A placeholder goes in immediately and is replaced when the fetch
      // settles. A control that appeared later would move the rows under a
      // reader's cursor; one that showed a count of nothing and then changed
      // is the flicker the todo tile's comment already records.
      var discardedSlot = el("div", { class: "fa-discarded-slot" },
                             "Checking for discarded items\u2026");
      settings.appendChild(discardedSlot);

      // REBUILT whenever a sticky is discarded or restored, not once.
      //
      // `buildViews` runs when the LAUNCHER opens and caches forever, so a
      // reader who opens the launcher, discards a sticky and then opens
      // Settings would find the control absent — with no way back until
      // they reloaded the page. That is the one-way delete this whole
      // feature exists not to be, arriving through a cache. Found by a spec
      // that happened to open the launcher before discarding, which is also
      // the order a person uses.
      function paintDiscarded() {
        fetchDiscarded(renderDiscardedSlot);
      }
      document.addEventListener("fa:todos-discarded", paintDiscarded);

      function renderDiscardedSlot(state) {
        discardedSlot.innerHTML = "";
        // Re-attached because a previous pass may have removed it.
        if (!discardedSlot.parentNode) settings.appendChild(discardedSlot);
        // NOT A SECOND CONTROL when the navbar carries fsh-guts (#1925): the
        // same list, count and restore one click away at the top of the
        // navigation. A pointer instead, for the reader who looked here.
        // Pages with no generated navbar keep the control — it is then the
        // only way back.
        if (document.querySelector("[data-fa-fsh-guts-open]")) {
          discardedSlot.appendChild(el("p", { class: "fa-discarded-moved" },
            "Discarded items are in fsh-guts: the fish in the icon row at the top of the side navigation."));
          return;
        }
        var localCount = discardedTodoIds().length;
        if (state.absent) {
          // This build published no document. Not an error and not an empty
          // trashcan — there is nothing to report a count ABOUT.
          //
          // But a sticky this reader discarded is a fact that does not
          // depend on the document, and it has to stay reachable: `fsh-guts`
          // is the trashcan that is KEPT, so a discard with no way back is
          // a delete wearing a crumpled icon. Caught by a spec, in a harness
          // that published no document — which is also every folio that has
          // not deployed one yet.
          if (localCount === 0) {
            discardedSlot.remove();
            return;
          }
          state = { nodes: [] };
        }
        if (state.error) {
          // NOT hidden, and this is the case the todo tile's "count === 0 is
          // not a tile" rule would have got wrong: a failed fetch and an
          // empty trashcan are opposite facts.
          discardedSlot.appendChild(el("p", { class: "fa-discarded-error" },
            "Discarded items could not be read (" + state.error + ")."));
          return;
        }
        // BOTH sources. A badge counting only the published nodes would
        // read 0 on a site with no trashcan while the reader has three
        // stickies in it.
        var n = (state.nodes || []).length + localCount;
        var label = n === 1 ? "1 item" : n + " items";
        var btn = el("button", {
          type: "button",
          class: "fa-tile fa-discarded-open",
          // The accessible name says WHAT it is and HOW MANY. "Dead fish" is
          // the icon, not the name — a screen-reader user is told what the
          // control does, and the count is in the name rather than conveyed
          // by the badge alone.
          "aria-label": "Discarded items \u2014 " + label,
        });
        btn.innerHTML = FISH_GLYPH;
        btn.appendChild(el("span", { class: "fa-tile-caption" }, "Discarded"));
        btn.appendChild(el("span", { class: "fa-tile-count" }, String(n)));
        btn.addEventListener("click", function () {
          // Rebuilt per open, so a restore made in this view is reflected
          // the next time it is opened without a reload.
          views.discarded = buildDiscardedView(state);
          showView("discarded", "Discarded items", btn);
        });
        discardedSlot.appendChild(btn);
      }

      paintDiscarded();

      // ── The kind fan, and the panel it opens ──────────────────────
      //
      // Owner: *"openning fan is panel."* The fan is the CLOSED state and
      // the panel is the open one — not a tooltip, and not a badge that
      // cycles in place. So the fan is the face of a button, and pressing
      // it shows the same kinds listed with their names.
      //
      // Under Settings for the same reason the discarded control is: it is
      // something a reader consults once, not a thing they act on.
      var kinds = declaredKinds();
      if (kinds.length) {
        var fanBtn = el("button", {
          type: "button",
          class: "fa-kind-fan-open",
          // Names the COUNT and the fact, not the picture. A fan of glyphs
          // is meaningless to a screen reader; the panel behind it is not.
          "aria-label":
            "What this instance declares \u2014 " +
            (kinds.length === 1 ? "1 kind" : kinds.length + " kinds"),
        });
        // NOT `built` — that is `buildViews`'s memoisation flag, and a `var`
        // of the same name inside this function hoists over it, so
        // `if (built) return` would read `undefined` and rebuild every view
        // on every launcher open. eslint caught it by reporting the OUTER
        // one as unused, which is a subtler symptom than the cause.
        var fanParts = buildKindFan(kinds);
        if (fanParts) fanBtn.appendChild(fanParts.fan);
        fanBtn.appendChild(el("span", { class: "fa-tile-caption" }, "Declared kinds"));
        fanBtn.addEventListener("click", function () {
          views.kinds = buildKindsPanel(kinds);
          showView("kinds", "Declared kinds", fanBtn);
        });

        // A ROW, because the pause control must sit BESIDE the button and
        // not inside it — see `buildKindFan`. Two siblings, one subject.
        var row = el("div", { class: "fa-kind-fan-row" });
        row.appendChild(fanBtn);
        if (fanParts && fanParts.pause) row.appendChild(fanParts.pause);
        settings.appendChild(row);
      }

      views.settings = settings;

      views.language = buildLanguageBar();

      var qr = el("div", { class: "fa-qr-panel fa-tile-content", "data-open": "true" });
      qr.appendChild(qrArt);
      qr.appendChild(qrCaption);
      views.qr = qr;
    }

    /* ── Navigation between the grid and a view ────────────────────────── */

    function showGrid() {
      view.setAttribute("hidden", "hidden");
      // Before the wipe: `innerHTML = ""` DETACHES, and a detached search
      // input is one `getElementById` away from being dead.
      parkSearch();
      view.innerHTML = "";
      grid.removeAttribute("hidden");
      if (openTile) openTile.focus();
      openTile = null;
    }

    function showView(key, label, tile) {
      buildViews();
      openTile = tile;
      grid.setAttribute("hidden", "hidden");
      parkSearch();
      view.innerHTML = "";

      var head = el("div", { class: "fa-tiles-head" });
      var back = el("button", {
        type: "button",
        class: "fa-tiles-back",
        // The visible text is a chevron and the word; the accessible name says
        // WHERE back goes, because "Back" alone is a direction, not a place.
        "aria-label": "Back to all actions",
      }, "‹ All actions");
      back.addEventListener("click", showGrid);
      var heading = el("h3", { class: "fa-tiles-title", tabindex: "-1" }, label);
      head.appendChild(back);
      head.appendChild(heading);
      view.appendChild(head);
      // No `search` branch any more: search lives in the navbar and the tile
      // REVEALS it there rather than dragging it into the sidebar. A field
      // that moves to wherever you summoned it from is a field with no home.
      view.appendChild(views[key]);
      view.removeAttribute("hidden");

      if (key === "qr") renderQr();
      // The panel is rewritten in place, so a reader whose cursor did not move
      // would be told nothing at all about what just happened.
      //
      // Search is the exception, and deliberately: a reader who pressed a
      // magnifier is going to type. The input carries the theme's own label,
      // so a screen reader is still told what it landed on -- the heading is
      // reachable by Shift+Tab, one key away, rather than in the way of the
      // thing the tile exists for.
      heading.focus();
    }

    /* ── The grid ──────────────────────────────────────────────────────── */

    function tileButton(glyph, label, key) {
      var b = el("button", { type: "button", class: "fa-tile", "aria-label": label });
      b.innerHTML = glyph;
      b.appendChild(el("span", { class: "fa-tile-caption" }, label));
      b.addEventListener("click", function () { showView(key, label, b); });
      return b;
    }


    /* Search leads the grid, and the tile now REVEALS rather than moves.
     *
     * ## The comment that stood here refused what now ships
     *
     * It read, in part: *"the obvious 'improvement' is a second, dedicated
     * magnifier in the header row: one press instead of two. Do not make
     * it."* — citing the row's 3.75rem cap, bean `1le7`, and an answer of
     * "search is two" given by the owner on 2026-09-19.
     *
     * The owner reversed it on 2026-09-21: *"i want the search restored back
     * to the top display navbar, with option to slide out to the UR corner as
     * an icon."* Quoted rather than deleted, because the next agent to read a
     * prohibition the code plainly violates will assume the CODE is wrong and
     * revert working behaviour to satisfy a dead instruction.
     *
     * ## And the reversal did not cost the row
     *
     * Worth noting, because it is why the old objection does not simply
     * reapply in a new form: search did NOT come back as a fourth icon in the
     * capped sidebar header. It went to the MAIN DISPLAY navbar, which is
     * where just-the-docs renders it and which has the width. The sidebar row
     * is the mark, the scheme bulb, the globe and the launcher — three icons
     * beside the title, which is what `1le7` costed.
     *
     * ## Why this is an action and not a view
     *
     * The tile used to drag the live field into the sidebar panel. With
     * search visible in the navbar that is strictly worse: the same field
     * would be in two places depending on how you got to it, and a reader who
     * closed the panel would find search had moved. So the tile calls
     * `revealSearch`, which un-collapses the field where it lives and focuses
     * it. One search box, one home, two ways to reach it.
     */
    if (searchHolder) {
      grid.appendChild(tileAction(SEARCH_GLYPH, "Search", revealSearch));
    }
    var pageSettingsTile = tileButton(GEAR_GLYPH, SETTINGS_NAMES.page, "settings");
    pageSettingsTile.setAttribute("aria-label", SETTINGS_NAMES.page + " \u2014 " + SETTINGS_SCOPES.page);
    pageSettingsTile.setAttribute("title", SETTINGS_NAMES.page + " \u2014 " + SETTINGS_SCOPES.page);
    pageSettingsTile.setAttribute("data-fa-tip", SETTINGS_NAMES.page + " \u2014 " + SETTINGS_SCOPES.page);
    grid.appendChild(pageSettingsTile);
    // The glass's "Page settings →" lands HERE: the launcher opened and the
    // view shown, the same two steps a reader takes by hand (`ob3m` 12).
    settingsOpeners.page = function () {
      if (host.getAttribute("data-open") !== "true") open(true);
      showView("settings", SETTINGS_NAMES.page, pageSettingsTile);
    };
    grid.appendChild(tileButton(GLOBE_GLYPH, "Language", "language"));
    // The encoder is a separate vendor script, loaded when the tile first
    // opens (renderQr), so the tile is always offered. If it cannot load, the
    // QR view says so; the OTHER tiles never depend on it -- the old code
    // returned early from the whole mount when it was missing, so a failed
    // vendor request took the theme switch, the reading preferences and the
    // language switch down with the QR code.
    grid.appendChild(tileButton(GLYPH, "QR code", "qr"));

    // A tile that DOES something rather than opening a sidebar view. The board
    // lives in the main display, so `showView` is the wrong machinery for it.
    function tileAction(glyph, label, onClick) {
      var b = el("button", { type: "button", class: "fa-tile", "aria-label": label });
      b.innerHTML = glyph;
      b.appendChild(el("span", { class: "fa-tile-caption" }, label));
      b.addEventListener("click", function () { open(false); onClick(); });
      return b;
    }

    // The todo tile is added when the board reports itself ready, because the
    // index is fetched and the tile carries its COUNT. A tile that appeared
    // immediately would show no count, then change under the reader's cursor.
    function addTodoTile(board) {
      if (board.count === 0) return;   // nothing outstanding is not a tile
      var tile = tileAction(STICKY_GLYPH, "Todos", function () { board.toggle(); });
      tile.appendChild(el("span", { class: "fa-tile-count" }, String(board.count)));
      tile.setAttribute("aria-label", "Todos — " + board.count + " outstanding");
      grid.appendChild(tile);
    }
    if (window.__faTodoBoard) addTodoTile(window.__faTodoBoard);
    else document.addEventListener("fa:todos-ready", function (e) { addTodoTile(e.detail); });

    // The declared visualisations. `mountGraphTiles` is module-level so the
    // board mounts the SAME tiles from the same array — Q11, one declaration
    // and per-surface visibility.
    mountGraphTiles("navbar", grid, readerShownTiles());

    var links = getSiteLinks();
    if (links.kg) {
      grid.appendChild(tileLink(NET_GLYPH, "Knowledge graph", links.kg,
                                "browse this instance's skills, tools and schemas"));
    }
    // The owner: "the source goes to github, i wanted the jsonld and github
    // available." One affordance was doing two jobs. They are two artefacts --
    // the graph as data, and the code that produced it -- so they are two
    // tiles, each saying where it goes.
    if (links.jsonld) {
      grid.appendChild(tileLink(DATA_GLYPH, "JSON-LD", links.jsonld,
                                "this instance's knowledge graph as a JSON-LD document"));
    }
    if (links.source) {
      // A `github.com/<owner>/<repo>` link, never a `raw.githubusercontent`
      // one: raw 404s on a private repository and a browser session cookie
      // does not authenticate it, while the blob form follows the viewer's
      // own GitHub session. Same rule as `readme-toc`'s `linkStyle: "blob"`
      // default, and the reason it is the default there.
      grid.appendChild(tileLink(CODE_GLYPH, "Source", links.source,
                                "this site's repository on the forge"));
    }

    /* ── Disclosure ────────────────────────────────────────────────────── */

    function open(isOpen) {
      host.setAttribute("data-open", isOpen ? "true" : "false");
      // Mirrored onto the panel because the panel is no longer a DESCENDANT of
      // the host -- it lives in the sidebar column now, so a
      // `.fa-qr-host[data-open] .fa-tiles` selector would never match it.
      panel.setAttribute("data-open", isOpen ? "true" : "false");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen) {
        buildViews();
        panel.focus();
      } else {
        showGrid();
        toggle.focus();
      }
    }

    toggle.addEventListener("click", function () {
      open(host.getAttribute("data-open") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || host.getAttribute("data-open") !== "true") return;
      // Escape from a view returns to the grid rather than closing outright:
      // one keystroke should undo one step, not three.
      if (view.hasAttribute("hidden")) open(false);
      else showGrid();
    });
    // An in-page anchor changes the address without a reload, so a code left
    // open would go stale and point somewhere the reader is no longer at.
    window.addEventListener("hashchange", function () {
      if (host.getAttribute("data-open") === "true" && !view.hasAttribute("hidden") &&
          view.contains(qrArt)) renderQr();
    });
  }

  /* ── Figure zoom and full width ──────────────────────────────────────── */

  // A FULL-BLEED FIGURE COVERS THE SIDEBAR, and that is a painting-order fact,
  // not a guess: the theme sets `.side-bar { z-index: 0 }`, which makes it a
  // stacking context painted at 0, while `.main` is `position: relative` with
  // `z-index: auto` and comes LATER in tree order -- so `.main` paints on top.
  // A figure expanded to the full display width therefore hides anything in
  // the sidebar, the QR code included, and no z-index on the code can rescue
  // it from inside that stacking context.
  //
  // So the root carries a flag saying "something is full width right now", and
  // the stylesheet uses it to let the code out of the sidebar's stacking
  // context and pin it. Recomputed from the DOM rather than counted, because a
  // counter drifts the moment a figure is removed or re-mounted.
  /* ── Automatic full width ────────────────────────────────────────────── */

  /* A workflow diagram is drawn far wider than the text column it lands in, so
     it arrives shrunk to the point where the label inside a task box is not
     readable -- and the reader has to notice a toolbar and press a button
     before the page shows them the thing the page is about.

     So a figure that is genuinely wider than its column now starts expanded.
     Three conditions, because auto-expanding the wrong figure is worse than
     not auto-expanding at all:

       - the viewport is wide enough for full width to mean anything (the same
         50rem the CSS uses -- on a phone the column IS the display);
       - the drawing's own coordinate width exceeds the column by a clear
         margin, so a figure that already fits is left alone;
       - the reader has not turned it off. That last one is the difference
         between a default and an imposition: press "Full width" to collapse a
         figure and the choice is remembered, and nothing auto-expands again.

     The stored value is READ, not just written. `fa-locale` was stored by this
     same file for a week and never read back, which is the bug this deliberately
     does not repeat. */
  var FULLWIDTH_PREF = "fa-figure-fullwidth";
  var AUTO_MIN_VIEWPORT_PX = 800;   /* 50rem at the theme's 16px root */
  var AUTO_MIN_RATIO = 1.25;        /* drawing must be 25% wider than its column */

  function fullWidthPref() {
    try { return localStorage.getItem(FULLWIDTH_PREF); } catch (_e) { return null; }
  }
  function setFullWidthPref(v) {
    try { localStorage.setItem(FULLWIDTH_PREF, v); } catch (_e) { /* noop */ }
  }

  /* The drawing's intrinsic width in its own coordinates, from `viewBox`.
     `getBoundingClientRect` cannot answer this: it reports the width the
     figure was SQUEEZED to, which is the column width, so the ratio would be
     1 for every figure and nothing would ever qualify. */
  function intrinsicWidth(scope) {
    var svg = scope.querySelector("svg");
    if (!svg) return 0;
    var vb = svg.getAttribute("viewBox");
    if (!vb) return 0;
    var parts = vb.split(/[\s,]+/);
    var w = parseFloat(parts[2]);
    return isFinite(w) ? w : 0;
  }

  function shouldAutoExpand(scope) {
    if (fullWidthPref() === "off") return false;
    if (window.innerWidth < AUTO_MIN_VIEWPORT_PX) return false;
    var column = scope.clientWidth;
    if (!column) return false;
    // The width the drawing will be drawn at: its text-fitted width when it
    // has one, else its own coordinate width.
    var natural = parseFloat(scope.style.getPropertyValue("--fa-natural")) || intrinsicWidth(scope);
    if (!natural) return false;
    return natural / column >= AUTO_MIN_RATIO;
  }

  /* THE BAND A FULL-WIDTH FIGURE MAY USE: the viewport minus the nav rail.
     Owner, 2026-10-31, with a screenshot of a BPMN pool whose lane labels
     were under the rail: "full width images/diagrma/etc should not be cut off
     by LHS nav". Full width used to run from x=0, but from 50rem up the rail
     is `position: fixed` over that strip, so the figure's start edge was
     hidden. Below 50rem the theme's sidebar is an in-flow bar on top, takes
     no strip, and the band is the whole viewport, as before. The rail is
     MEASURED rather than read from `--fa-nav-collapsed`, so an open, pinned
     or RTL rail is right without knowing which state it is in. */
  function navRail() {
    return document.querySelector(".side-bar") || document.querySelector("nav.fa-nav");
  }

  function fullWidthBand() {
    var vw = document.documentElement.clientWidth;
    var band = { left: 0, right: vw };
    var rail = navRail();
    if (!rail) return band;
    var pos = getComputedStyle(rail).position;
    if (pos !== "fixed" && pos !== "sticky") return band;
    var r = rail.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return band;
    // A rail at the start edge (left in LTR, right in RTL). A rail that spans
    // most of the width is a top bar, not a side rail, and takes nothing.
    if (r.width >= vw / 2) return band;
    if (r.left <= 1) band.left = Math.max(0, r.right);
    else if (r.right >= vw - 1) band.right = Math.min(vw, r.left);
    return band;
  }

  function markFullWidthOnRoot() {
    document.documentElement.classList.toggle(
      "fa-has-fullwidth",
      !!document.querySelector(".fa-figure-scope.is-fullwidth"),
    );
  }


  /* ═══ Sticky todos ════════════════════════════════════════════════════
   *
   * A TODO is a person's outstanding item, published by `gen-docs-pages.ts`
   * to `/assets/todos/index.json`. This mounts three surfaces over it:
   *
   *   - a tile in the action launcher, carrying a COUNT;
   *   - a board in the MAIN display, with every sticky lined up;
   *   - a sticky that can be lifted off the board and pinned to the page.
   *
   * ## Why the board is not a tile view
   *
   * Every other tile renders into `.fa-tiles-view`, which is the QR panel's
   * footprint -- 16.5rem in the sidebar column. The owner asked for the board
   * "in the main display", and a wall of stickies at 16.5rem would be a
   * single column of slivers. So the tile is a LAUNCHER for a surface that
   * lives in `.main-content`, and the panel machinery is left alone rather
   * than widened for one caller.
   *
   * ## Content reaches the DOM through textContent, never innerHTML
   *
   * A todo's `summary` and `comment` are authored -- by a person, or by an
   * agent on their behalf -- and travel through a JSON file to this page. The
   * only glyphs built with `innerHTML` here are the static SVG constants
   * above, which no input touches. That is the same rule the QA panel's
   * evidence follows, and for the same reason: the string that closes a tag
   * is exactly the string somebody eventually writes.
   *
   * ## The pencil is `.fa-node-edit`, not an editor
   *
   * "default pattern for any content object in just-the-docs -- it should be
   * at that class level". `gen-docs-pages.ts` already emits that affordance
   * per node, and `editHref` is composed there at build time, so this file
   * carries no repo URL. A published page cannot write back to the repo, and
   * the honest control is the one that takes you where writing happens.
   */

  var STICKY_GLYPH =
    '<svg class="fa-tile-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M5 3h10l4 4v14H5z" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linejoin="round"/><path d="M15 3v4h4" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linejoin="round"/></svg>';

  var todoState = { items: [], processes: {}, themeArt: {} };

  /** What a reader filters AND groups the board by — the graph's edges and status. */
  var BOARD_AXES = ["node", "status", "person", "bean"];

  /* ═══ Semantic zoom and windows — TWO mechanisms, kept apart ═══════════
   *
   * |                   | trigger                                   | who       |
   * |-------------------|-------------------------------------------|-----------|
   * | **semantic zoom** | the card's RENDERED width crosses a number | automatic |
   * | **open / close**  | opening a card, or `[x]`                   | a person  |
   *
   * The owner, 2026-09-20: *"start everyrting in avatar"*, `[x]` closes to the
   * avatar, and on which mechanism wins —
   *
   *   open is like window, avatar/tiles project open panels onto window. sum
   *   functionality, need to handle z-order.. selecting any part raises
   *
   * **An open card is a WINDOW, not a zoom state.** It is projected ON TO the
   * board rather than being the card grown large, which is why the zoom code
   * below never asks what is open and the window code never asks how wide
   * anything is. A flag joining them would be the conflation made permanent —
   * and it is also what makes "an open window survives a zoom-out" true by
   * construction rather than by a special case.
   *
   * ## THE THRESHOLD IS DECLARED DATA, and its absence is a third state
   *
   * R2: *"the threshold SHALL be declared data, not a literal in the
   * renderer."* `gen-docs-pages.ts` publishes the folio's
   * `semantic-zoom.json` — and publishes NOTHING when the folio has not
   * declared one. So `zoomState.zoom === null` means *could not determine*,
   * and this file must never turn that into a number: with no declaration
   * every card keeps its words, and the console says why once.
   *
   * ## This mirrors `schemas/ui/window-stack.ts`, and that is a real cost
   *
   * The model is specified and unit-tested there; this is a browser script and
   * cannot import it. Two implementations of one rule can drift, so the
   * mitigation is named rather than hoped for: `test/board-windows.e2e.ts`
   * mirrors `window-stack.test.ts` case for case, against the real file.
   */
  var zoomState = { zoom: null, asked: false };

  /* ═══ Panel chrome — the kind declares, the platform fixes ════════════
   *
   * Owner: *"each content type controls its own avatar, visualtion/rendering.
   * but assume they can open a full screen panel w/ fixed controls like [x] or
   * [linksrc] or [edit] or what not depedning on conent."*
   *
   * CRDM Q7 settled the line: `[x]` is in the same place with the same
   * behaviour on every panel, so a reader learns the frame once; everything
   * else is the kind's to offer.
   *
   * THREE STATES, and collapsing any two loses a fact: not declared (this kind
   * does not offer it), declared and servable (the control), declared and
   * unservable (no control, AND a reason). The third is the one that gets
   * lost, and `pb04` is the case already paid for — an `[edit]` the pipeline
   * cannot perform 404s for exactly the reader who cannot edit, which reads as
   * "this page is broken" rather than "you cannot do this".
   *
   * Mirrors `schemas/ui/panel-chrome.ts`, which this file cannot import. Same
   * cost, same mitigation as `window-stack.ts`: the e2e asserts the browser's
   * answer against the model's, case for case.
   */
  var FIXED_CONTROLS = ["close"];
  var PANEL_CONTROLS = {
    close: { id: "close", label: "Close", needs: "none" },
    view: { id: "view", label: "View source", needs: "source-read" },
    edit: { id: "edit", label: "Edit", needs: "source-write" },
    pin: { id: "pin", label: "Pin to your folio glass", needs: "none" },
    discard: { id: "discard", label: "Send to fsh-guts", needs: "none" },
    move: { id: "move", label: "Move or resize", needs: "none" },
    relocate: { id: "relocate", label: "Send to the trashcan", needs: "none" },
  };
  var KIND_CONTROLS = {
    todo: ["view", "edit", "move", "pin", "discard", "relocate"],
    bean: ["view"],
  };

  /** The frame first and always, then what the kind declared. Unknowns dropped. */
  function controlsFor(kind) {
    var declared = (KIND_CONTROLS[kind] || []).filter(function (id) {
      return (
        Object.prototype.hasOwnProperty.call(PANEL_CONTROLS, id) &&
        FIXED_CONTROLS.indexOf(id) === -1
      );
    });
    return FIXED_CONTROLS.concat(declared).map(function (id) { return PANEL_CONTROLS[id]; });
  }

  /**
   * The badge for the CONTENT NODE a card is about, or null.
   *
   * R7: *a node rendered as its avatar carries the same badge, from the same
   * query as R6.* One function, called once per card, whose answer both the
   * avatar and the open window render — so the two surfaces cannot disagree
   * for the same reason the badge and its panel cannot (`1rta`).
   *
   * `null` when the card is about no node: a board card with no `targetLabel`
   * annotates nothing, and a badge of nothing is not a zero, it is absent.
   */
  function nodeBadge(todo) {
    var label = todo.targetLabel;
    if (!label) return null;
    var count = 0;
    for (var i = 0; i < todoState.items.length; i++) {
      if (todoState.items[i].targetLabel === label) count++;
    }
    // R5's threshold, and the same split: the chip takes `showCount`, the
    // accessible name takes the exact `count`.
    return { count: count, showCount: count > 1, label: label };
  }

  /** One badge, rendered the same way wherever it rides. */
  function badgeChip(badge, where) {
    var chip = el("span", {
      class: "fa-node-badge fa-node-badge--" + where,
      "data-fa-notes": String(badge.count),
      // A NAME needs a role: `aria-label` on a bare span is prohibited ARIA
      // (axe `aria-prohibited-attr`), found once the open window's bar was
      // measured (#1925). `img` is what the chip is — a mark with a name.
      role: "img",
      "aria-label":
        badge.count + (badge.count === 1 ? " note" : " notes") + " on this section",
    });
    if (badge.showCount) {
      chip.appendChild(el("span", { class: "fa-node-badge-count" }, String(badge.count)));
    }
    return chip;
  }

  /* ═══ The READER's filter, which commits nothing ══════════════════════
   *
   * Owner: *"be able to filter out by kind properties things on miror board"*.
   *
   * TWO FILTERS, AND THEY MUST NOT BECOME ONE FIELD. A board carries a
   * DECLARED filter (`schemas/ui/board.ts`) that says what the board IS, and it
   * lives in `boards/<id>.json` where everyone opening that board gets it.
   * This is the other one: a reader narrowing their own view, at view time.
   * Conflating them would make one reader's temporary view edit the board
   * everyone else opens — which is what happens the moment a filter control
   * writes to the file the other filter lives in.
   *
   * So this writes NOTHING: no file, no `localStorage`, no event anybody
   * persists. It is session state, like the window stack, and the absence is
   * the design rather than an omission.
   *
   * Mirrors `schemas/content/reader-filter.ts`, which this file cannot import — same
   * cost and same mitigation as its siblings: the e2e checks the browser's
   * answer against the model's.
   */
  var readerFilter = { properties: {} };

  /**
   * Tiles this READER has flipped from their declared default.
   *
   * Q9: *declared default, reader may override.* The folio says which tiles
   * start out of frame; this is the other half, and it is session state — no
   * file, no `localStorage`, nothing anybody else opens. A reader's view of
   * the navbar is not a change to the navbar, which is the same separation
   * `reader-filter.ts` holds between a reader's filter and a board's.
   */
  var readerTileOverrides = [];
  function readerShownTiles() { return readerTileOverrides; }

  /**
   * `1le7`'s tile, as a link. MODULE-LEVEL so both surfaces share one template.
   *
   * It was nested inside the action launcher until the board needed it too,
   * and the bean is explicit about the alternative: *"the tile template is
   * `1le7`'s, extended if it needs to be, never duplicated."* A second copy
   * would be two tiles that look alike until one of them is changed.
   */
  function tileLink(glyph, label, href, hint, qualifier, showQualifier) {
    // Every tile's href goes through the same check as every other link on
    // this page. A tile is the one place a declared value reaches an `href`
    // with no composition in between, so it is the one most worth checking.
    //
    // THE QUALIFIER IS APPENDED, never folded into the label — owner,
    // 2026-10-01, bean `ob3m` finding 6, "One name everywhere": the base
    // label is the destination's one name on every surface, and the harness
    // it belongs to rides beside it ("Docs · C@T Harness"). Both arrive from
    // `harness.json`; nothing here derives either.
    var named = qualifier ? label + " \u00b7 " + qualifier : label;
    var a = el("a", {
      class: "fa-tile",
      href: safeHref(href),
      "aria-label": named + " — " + hint,
    });
    a.innerHTML = glyph;
    if (qualifier) a.setAttribute("title", named);
    a.appendChild(el("span", { class: "fa-tile-caption" }, label));
    // SHOWN only where another tile carries the same name (`showQualifier`,
    // decided by the generator over the whole set). Everywhere else it is in
    // the accessible name and the tooltip: a square tile holds one line.
    if (qualifier && showQualifier) a.appendChild(el("span", { class: "fa-tile-qualifier" }, qualifier));
    return a;
  }

  /* ── Where a declared, site-root path is composed ────────────────────
   *
   * `graph-tiles.ts` stores a tile's href relative to the SITE ROOT — `/beans/`
   * — which is right, and is what `harness.links[].path` stores as well. Every
   * other consumer of such a path hands it to Liquid's `relative_url`, which
   * prepends `site.baseurl`. A tile cannot: it is composed here, after Liquid
   * has finished, from JSON on a `<meta>`.
   *
   * SO IT HAS TO BE DONE HERE, AND IT WAS NOT — issue #801. This site serves
   * from `/folio-assistant`, so an unprefixed `/beans/` resolves against the
   * ORIGIN and every one of the twelve tiles 404ed. The rule was already
   * written down 800 lines above, on the action tiles: *"an absolute `/kg/`
   * is a 404 rather than a wrong-looking link"*. Two tile families, one rule,
   * and only one of them was following it.
   *
   * NOT applied inside `tileLink`, which both families share. The action tiles
   * are handed `#fa-site-links` values that Liquid ALREADY composed, so
   * prefixing there would double the base and break the family that works.
   * The base belongs where the raw declared value enters, which is here.
   *
   * An ABSENT meta falls back to `baseurlFromTodoSrc`, and then to `""`. The
   * empty answer is the previous behaviour and is deliberate: a site with no
   * baseurl is the common case (the e2e fixtures, a local `jekyll serve`),
   * and it is indistinguishable from a declared empty one — `site.baseurl`
   * renders as the empty string for both. There is nothing here to report as
   * a finding.
   *
   * ## ONE function, because there were briefly two
   *
   * A second `siteBaseurl` was defined ~500 lines below this one, deriving
   * the prefix from `meta[name="fa-todo-src"]` for the sticky art. Same name,
   * same IIFE scope — so the later declaration silently replaced this one,
   * and `withBase` began asking a meta that the graph-tile fixtures do not
   * carry. Every tile lost its base, which is issue #801 coming straight back
   * on a merge that touched neither feature.
   *
   * The two were never different questions. `fa-baseurl` is the DECLARED
   * answer, written by Liquid from `site.baseurl`; the todo-src derivation is
   * a RECONSTRUCTION for a page that has the one meta and not the other. So
   * the declared value wins and the derivation is the fallback, which is the
   * only order that cannot make a page contradict its own server.
   */
  function siteBaseurl() {
    var meta = document.querySelector('meta[name="fa-baseurl"]');
    var v = (meta && meta.getAttribute("content")) || "";
    return v ? absoluteBase(v) : (absoluteBase(baseurlFromTodoSrc()) || SCRIPT_BASE);
  }

  /**
   * A base the page wrote RELATIVE to itself (`.`, `../..`), as the absolute
   * path every caller of `siteBaseurl` has always been given.
   *
   * Since bean `g196` (2026-10-23) a Jekyll page writes its same-site links
   * relative to itself, so a page that did not change is byte-identical in
   * every branches/ preview and on the live site; `fa-baseurl` and
   * `fa-todo-src` are relative too. Resolving here, once, keeps every
   * consumer's arithmetic as it was (`withBase`, `baseurlResolved`'s
   * prefix guard, `navKey`'s strip).
   *
   * Resolved against the address the document was LOADED from, not the
   * address bar: a page may `history.replaceState` to a different depth
   * before this runs, and a relative base resolved after that is one level
   * off (the same trap `navbar-row.js`'s `loadedFrom` records).
   * An absolute value, or `""`, comes back as it was, trailing slash dropped.
   */
  function absoluteBase(v) {
    if (!v) return "";
    if (v.charAt(0) === "/" || /^[a-z][a-z0-9+.-]*:/i.test(v)) return v.replace(/\/+$/, "");
    try {
      var u = new URL(v.replace(/\/*$/, "/"), LOADED_FROM);
      var path = u.pathname.replace(/\/+$/, "");
      return u.origin === location.origin ? path : u.origin + path;
    } catch (_e) {
      return v.replace(/\/+$/, "");
    }
  }

  /* ── Is this a branches/ preview? ──────────────────────────────────────
   *
   * Non-empty `fa-staging` means a `branches/<slug>/` preview; empty means the
   * canonical deploy, a local build, or a page whose `_data/build.yml` was
   * never written. All three of those are treated as canonical, which is the
   * SAFE direction: a build that cannot say it is a preview hides the tile
   * rather than advertising a page that may not be deployed.
   *
   * That matches `compose-docs.ts`, which withholds a staging-only page unless
   * positively told `--staging`. One direction in both places, so the page and
   * its tile cannot end up disagreeing about which deploy they are on — and if
   * they ever did, the failure would be a tile linking to a 404, which is the
   * thing this exists to prevent.
   */
  function isStagingPreview() {
    var meta = document.querySelector('meta[name="fa-staging"]');
    return !!(meta && (meta.getAttribute("content") || "").trim());
  }

  /* ── What the search box is actually searching ───────────────────────
   *
   * Bean `eof6`, on the owner's ruling of 2026-09-22: *"staging uses last
   * published index (w/ wanrnig)"*.
   *
   * That bean had first concluded the opposite — staging must DISABLE search,
   * "never inherit an old index" — because a stale hit is *"a wrong PASS,
   * BELIEVED"*. **Belief is the load-bearing word**, and a warning is what
   * attacks it. The narrower rule the ruling leaves standing:
   *
   *   Unmarked staleness is worse than absence. Marked staleness is not.
   *
   * So the swap is never silent. `searchIndexNotice` is a PURE function of the
   * stamped value precisely so it can be tested without a browser — the
   * rendering below needs a built page, the decision does not.
   *
   * `null` for every unrecognised value, INCLUDING the empty one. The empty
   * case is the canonical deploy, where the index is the site's own and there
   * is nothing to warn about; an unrecognised one is a stamp this build does
   * not understand, and inventing a warning for it would put words on the page
   * that no step wrote.
   */
  function searchIndexNotice(state) {
    if (state === "published") {
      return "Results come from the published site, not from this preview. " +
        "A page changed on this branch may be missing, stale, or absent from these hits.";
    }
    if (state === "unavailable") {
      return "Search is unavailable on this preview: the published index could not be fetched.";
    }
    return null;
  }

  /** The stamped search-index state, or "" when this build wrote none. */
  function searchIndexState() {
    var meta = document.querySelector('meta[name="fa-search-index"]');
    return (meta && (meta.getAttribute("content") || "").trim()) || "";
  }

  /**
   * A site-root path, composed against this deploy's base.
   *
   * Only a path that starts with `/` is composed. Anything else is already
   * relative to the page, or is not ours, and prefixing it would invent a URL.
   * No guard against a base that is already present: a tile whose declared
   * path genuinely begins with the base's spelling is a directory somebody
   * named that way, and skipping it would be this bug with the sign flipped.
   */
  /**
   * The PLATFORM DATA this script reads — themes, avatars, tiles, the glass
   * strip, the semantic zoom — from the site's own pinned copy when the page
   * says it has one (`<meta name="fa-pinned-data" content="<to root>">`,
   * written by cat-harness-tools' rail pass on a foreign site). Owner,
   * 2026-10-15, "Yes, ship with each site": a site never changes until it is
   * republished. Without the meta, the platform's base, as before.
   */
  function pinnedData(path) {
    var m = document.querySelector('meta[name="fa-pinned-data"]');
    var root = m && m.getAttribute("content");
    if (!root) return withBase(path);
    try {
      return new URL(root.replace(/\/?$/, "/") + String(path).replace(/^\//, ""), document.baseURI).href;
    } catch (_e) {
      return withBase(path);
    }
  }

  function withBase(href) {
    if (typeof href !== "string" || href.charAt(0) !== "/") return href;
    return siteBaseurl() + href;
  }

    /* ── The DECLARED visualisations, one tile each ──────────────────────
   *
   * Owner: *"if harness declares visaluzers, those should have tile"*, and
   * *"those should open their exisiting visualzaiton"*.
   *
   * Read from `_data/harness.json`, which `graph-tiles.ts` derives from the
   * `coverage.visualiser` obligation every instance already carries and
   * `check:subgraph-coverage` already audits. **There is no second list**: a
   * registry of "things that get tiles" would be free to disagree with the
   * audited one, and a tile missing because nobody added it there would look
   * exactly like a graph nobody declared.
   *
   * `1le7`'s `tileLink` — the template is not duplicated, and a tile with no
   * published href is not rendered as a link to nowhere (`pb04`).
   */
  /**
   * A tile's DECLARED count, or `null`.
   *
   * ## Absent is not zero, and this function is where that is enforced
   *
   * `schemas/ui/tile-count.ts` carries the argument: a projection that declares
   * no count, declares a malformed one, or could not be read is NOT a
   * projection over an empty graph. They are opposite facts, and `dh4f` is
   * this repository's name for scanning nothing and calling it clean.
   *
   * So every rejection below returns `null` and the tile renders with no
   * badge. None of them falls back to `0`. The test that matters is the one
   * that would FAIL if it did.
   *
   * `count` is checked with `isFinite` rather than `typeof === "number"`:
   * `NaN` and `Infinity` are both numbers and both render as a badge that
   * means nothing. `unit` must be present and non-blank -- a bare number is
   * the ambiguity the unit exists to remove, so half a declaration is
   * malformed rather than partly usable. The mirror of the same three checks
   * in `readTileCounts`, deliberately: this reads a tile the generator
   * already validated, and a reader that trusted its input would be a reader
   * that cannot be tested against a hand-written meta tag.
   */
  function tileCountOf(t) {
    if (!t || typeof t.count !== "number" || !isFinite(t.count)) return null;
    if (typeof t.unit !== "string" || t.unit.trim() === "") return null;
    return { count: t.count, unit: t.unit.trim() };
  }

  /** The declared tiles from the page's `<meta name="fa-tiles">`, or `null` when it carries none. */
  function declaredTilesFromMeta() {
    var meta = document.querySelector('meta[name="fa-tiles"]');
    var raw = meta && meta.getAttribute("content");
    // Filled by `assets/js/harness-data.js` (bean `gp2f`). Still named and
    // empty: that file did not load, which is not "declared no tiles".
    if (!raw && meta && meta.hasAttribute("data-fa-src")) {
      console.warn("docs-ui: the tiles' shared data (" + meta.getAttribute("data-fa-src") +
                   ".js) did not load; no tiles were mounted.");
      return null;
    }
    if (!raw) return null;
    try {
      var tiles = JSON.parse(raw);
      return Array.isArray(tiles) ? tiles : null;
    } catch (_e) {
      return null;
    }
  }

  function mountGraphTiles(surface, into, hiddenIds) {
    var tiles = declaredTilesFromMeta();
    return tiles ? renderGraphTiles(tiles, surface, into, hiddenIds) : 0;
  }

  /**
   * Render the declared tiles for one surface. Split out of `mountGraphTiles`
   * so the GLASS can hand it the same array fetched from
   * `assets/harness/tiles.json` on a page no Jekyll wrote a meta for — one
   * renderer and one declaration, whichever way the list arrived.
   */
  function renderGraphTiles(tiles, surface, into, hiddenIds) {
    var shown = 0;
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      if (!t.href) continue;                                   // pb04
      if ((t.surfaces || []).indexOf(surface) === -1) continue;
      // DECLARED default, then this READER's override. The reader's half is
      // theirs alone and is committed nowhere — `reader-filter.ts`'s rule on
      // another surface.
      if (t.hidden && hiddenIds.indexOf(t.id) === -1) continue;
      if (!t.hidden && hiddenIds.indexOf(t.id) !== -1) continue;
      // A tile whose PAGE is withheld from this deploy is not rendered at all.
      // Distinct from `hidden` above, which is a reader's own preference about
      // a page that exists: this one is about whether the page is there.
      // Conflating them would let "show hidden" resurrect a link to a 404.
      if (t.publish === "staging-only" && !isStagingPreview()) continue;
      // THE TWO GREYS. A tile with no `href` was skipped above — there is
      // nothing to open. This one opens perfectly and refuses an EDIT, so it
      // is rendered, marked, and says so. Collapsing the two would tell a
      // reader "there is nothing here" about content that is present,
      // complete and deliberately frozen.
      //
      // `=== true` and not truthiness: absent means NOT DECLARED, which is a
      // third state and not `false`. An undeclared directory gets neither the
      // read-only mark nor a claim that it is writable.
      //
      // IT RIDES THE SAME `hint` AS THE COUNT BADGE, which arrived from main in
      // the same merge, and for the same stated reason: the accessible name is
      // where a reader who cannot glance at the tile learns what it is. A
      // read-only state shown only as a dashed border is invisible to exactly
      // the reader the border was meant to inform.
      var frozen = t.readOnly === true;
      var hint = "the declared visualisation of " + t.directory;
      // THE COUNT IS PART OF THE ACCESSIBLE NAME, not an ornament hung beside
      // it. A badge a screen reader does not announce leaves exactly the
      // reader who cannot glance at the tile unable to tell an empty viewer
      // from a full one -- which is the whole defect, made worse.
      var badge = tileCountOf(t);
      if (badge) hint += ", " + badge.count + " " + badge.unit;
      if (frozen) hint += " — materialized content: readable, not editable here";
      var tile = tileLink(glyphFor(t.icon), t.title, withBase(t.href), hint, t.qualifier, t.showQualifier === true);
      if (frozen) tile.setAttribute("data-fa-readonly", "");
      if (badge) {
        // `aria-hidden` is belt and braces, not the mechanism: `tileLink` sets
        // `aria-label` on the anchor, and a label REPLACES the subtree as the
        // accessible name, so this span is already not announced. It is marked
        // anyway so the badge stays decorative if that label is ever dropped
        // -- the day it is, the count would otherwise be read twice.
        //
        // The count reaching the name at all is the part that matters, and it
        // happens above, in `hint`.
        var b = el("span", { class: "fa-tile-count", "aria-hidden": "true" },
                   String(badge.count));
        // ZERO is styled apart, because it is the state this whole feature
        // exists to surface and it is the one a reader is least expecting.
        // Distinct from NO badge, which is a projection that declared nothing.
        //
        // NOTE the opposite rule on `addTodoTile` below -- *"nothing
        // outstanding is not a tile"*, which drops the tile entirely at zero.
        // Not an inconsistency: that is an ACTION tile, and an action with
        // nothing to act on is worth hiding. A graph tile is a place the
        // reader navigates to, and hiding it at zero would take the answer
        // away exactly when it is surprising.
        if (badge.count === 0) b.setAttribute("data-fa-empty", "true");
        tile.appendChild(b);
        // WHAT THE NUMBER COUNTS, on hover too (bean `v215`): the unit was in
        // the accessible name only, so a sighted reader saw a bare "943" with
        // no word saying what it counted, beside an icon-row "541" whose tip
        // said "open". The icon row's tip names its count; so does this.
        tile.setAttribute("title", (tile.getAttribute("title") || t.title) +
          " — " + badge.count + " " + badge.unit);
      }
      tile.setAttribute("data-fa-tile", t.id);
      tile.setAttribute("data-fa-surface", surface);
      if (t.theme) tile.setAttribute("data-fa-theme", t.theme);
      into.appendChild(tile);
      shown++;
    }
    return shown;
  }


  /* ═══ Which URL schemes may reach an `href` ══════════════════════════
   *
   * R17, the owner: *"skill tool hints for XSSrsiction"*. `schemas/ui/safe-url.ts`
   * carries the argument; this is its mirror, and the rule is one line long:
   * **default-deny**. A blocklist has to enumerate every dangerous scheme and
   * is wrong the day a browser ships a new one; an allow-list is wrong only
   * about things it refuses, and a refusal is visible.
   *
   * TAB / LF / CR are removed EVERYWHERE before deciding, because the URL
   * parser removes exactly those three before parsing — so `java<TAB>script:`
   * is `javascript:` to the browser and a relative path to a naive test. That
   * is the classic bypass and the TypeScript version shipped it for one
   * commit.
   *
   * Same drift cost as every other mirror in this file, same mitigation: the
   * e2e checks this answer against the model's, case for case.
   */
  var ALLOWED_URL_SCHEMES = ["http:", "https:", "mailto:", "tel:"];

  function safeHref(url) {
    if (url === undefined || url === null) return undefined;
    var stripped = String(url).replace(/[\u0009\u000A\u000D]/g, "");
    var trimmed = stripped.replace(/^[\u0000- ]+/, "").replace(/[\u0000- ]+$/, "");
    if (trimmed === "") return undefined;
    // `//host/path` is absolute and looks like a path — excluded deliberately.
    if (trimmed.indexOf("//") === 0) return undefined;
    if (/^[#?./]/.test(trimmed) || !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
    var scheme = trimmed.slice(0, trimmed.indexOf(":") + 1).toLowerCase();
    return ALLOWED_URL_SCHEMES.indexOf(scheme) === -1 ? undefined : trimmed;
  }

  /**
   * A todo's values for one property, as a list. MULTI-VALUED properties — the
   * assignees and beans `todos.jsonld` gives a todo — are lists already; a
   * single value is a list of one; absent or empty is the empty list.
   * Mirrors `haveOf` in `schemas/content/reader-filter.ts`.
   */
  function valuesOf(todo, name) {
    var v = todo[name];
    if (Array.isArray(v)) return v.filter(function (x) { return x !== undefined && x !== null && x !== ""; });
    return v === undefined || v === null || v === "" ? [] : [v];
  }

  /** OR within a property's values, AND across properties — the board's logic. */
  function readerShows(filter, todo) {
    var props = filter.properties || {};
    for (var name in props) {
      if (!Object.prototype.hasOwnProperty.call(props, name)) continue;
      var values = props[name];
      if (!values || values.length === 0) continue;
      // A node that cannot answer has not answered YES. A multi-valued one
      // answers yes when ANY of its values is selected.
      var have = valuesOf(todo, name);
      var hit = false;
      for (var h = 0; h < have.length; h++) if (values.indexOf(have[h]) !== -1) hit = true;
      if (!hit) return false;
    }
    return true;
  }

  /** Every value present in the corpus for one property, sorted. */
  function propertyValues(items, name) {
    var seen = {};
    for (var i = 0; i < items.length; i++) {
      valuesOf(items[i], name).forEach(function (v) { seen[v] = true; });
    }
    return Object.keys(seen).sort();
  }

  /* ═══ Move and resize — keyboard FIRST, drag as the accelerator ═══════
   *
   * Owner: *"can resize open content, move around. drag and drop moving.."*
   * and, on the floor every board control sits on, *"ALWAYS collapsable to
   * linearly rendablee"*.
   *
   * **Drag is the accelerator, never the only way in.** This instance's
   * declared interaction profile is low-dexterity — it is why the Pin control
   * is a button rather than a drag — and a board whose only affordance is drag
   * excludes its own owner. So the keyboard path is built first and the
   * pointer path is added over it, rather than the other way round where the
   * keyboard half is the thing that never gets finished.
   *
   * ## A MODE, because arrows already mean something
   *
   * Arrow keys scroll. A window that moved whenever a reader pressed one while
   * reading it would have stolen the page's own navigation, so moving is a
   * mode: the `move` control turns it on, the window says so, arrows move,
   * `Shift`+arrows resize, and `Escape` or `Enter` leaves. The mode is
   * announced rather than merely styled — a reader who cannot see the outline
   * has to be told what their arrow keys now do.
   *
   * ## SESSION-ONLY, like the stack above it
   *
   * `schemas/ui/board-positions.ts` is where a move becomes durable, and
   * `moveBy` is the function that does it — for a tool or an agent, against
   * the repository. A published page cannot write that file, and the lesson
   * `db7g` settled applies unchanged: it is better to be a control over this
   * reader's view and say so than to look like it changed the folio.
   */
  var MOVE_STEP = 16;
  var RESIZE_STEP = 24;
  var MIN_WINDOW = 160;

  /** Turn the move mode on or off for one window, and say which it is. */
  function setMoveMode(panel, on, live) {
    panel.setAttribute("data-fa-moving", on ? "true" : "false");
    if (live) {
      live.textContent = on
        ? "Move mode on. Arrow keys move this window; hold Shift to resize; Escape to finish."
        : "Move mode off.";
    }
    if (on) panel.focus();
  }

  /** Current inline geometry, falling back to what the cascade laid out. */
  function geometryOf(panel) {
    var rect = panel.getBoundingClientRect();
    var parent = panel.offsetParent ? panel.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
    return {
      left: parseFloat(panel.style.left) || rect.left - parent.left,
      top: parseFloat(panel.style.top) || rect.top - parent.top,
      width: parseFloat(panel.style.width) || rect.width,
      height: parseFloat(panel.style.height) || rect.height,
    };
  }

  function applyGeometry(panel, g) {
    panel.style.left = g.left + "px";
    panel.style.top = g.top + "px";
    panel.style.width = g.width + "px";
    panel.style.height = g.height + "px";
  }

  /**
   * One arrow press in move mode.
   *
   * Returns true when it acted, so the caller knows whether to swallow the
   * key. Swallowing unconditionally would eat a reader's scrolling the moment
   * a window had focus and the mode did not.
   */
  function nudge(panel, key, shift, unbounded) {
    var g = geometryOf(panel);
    var step = shift ? RESIZE_STEP : MOVE_STEP;
    if (key === "ArrowLeft") { if (shift) g.width = Math.max(MIN_WINDOW, g.width - step); else g.left -= step; }
    else if (key === "ArrowRight") { if (shift) g.width += step; else g.left += step; }
    else if (key === "ArrowUp") { if (shift) g.height = Math.max(MIN_WINDOW, g.height - step); else g.top -= step; }
    else if (key === "ArrowDown") { if (shift) g.height += step; else g.top += step; }
    else return false;
    // NEVER off the top-left — FOR A WINDOW. A window moved past the origin is
    // a window a reader cannot reach the controls of, which is `l4zi` by
    // another route: the board window and the floating sticky sit in a frame
    // the size of the viewport, and nothing pans that frame.
    //
    // A CARD ON THE GLASS is `unbounded`. Owner, 2026-09-24: *"you shoud be
    // able to put things on folio w/ x,y <0, can't move negative right now."*
    // The glass pans and zooms (`b8eq`), so a card left of the origin is one
    // pan away rather than lost — and Home frames it, and Tidy regrids it.
    // The clamp protected controls from going off a surface that cannot move;
    // on one that can, it only stopped the reader using the whole surface.
    if (!unbounded) {
      g.left = Math.max(0, g.left);
      g.top = Math.max(0, g.top);
    }
    applyGeometry(panel, g);
    return true;
  }

  /**
   * The whole move interaction, wired onto one panel. ONE implementation.
   *
   * Bean `ivfw` is the second surface that needs this — a sticky lifted onto
   * the page, which until now had nowhere to go. The bean's own warning is
   * against giving it a second one: *"the two must agree rather than ship two
   * notions of position"*. So the board window and the floating sticky call
   * this, and neither owns the behaviour.
   *
   * `panel` takes the keyboard path and the geometry; `handle` is the region a
   * pointer may drag by, which is the title bar on a window and the head on a
   * sticky. They differ because dragging a card by its BODY would fight text
   * selection, and a reader who cannot select the text of a note cannot quote
   * it.
   */
  function wireMove(panel, handle, live, onSettle, opts) {
    // `onSettle(geometry)`, OPTIONAL: told where the panel came to rest, once
    // per arrow press and once per drag. The board window and the floating
    // sticky pass nothing and keep their session-only geometry; the GLASS
    // passes a saver, because an asset on the reader's glass is theirs across
    // pages (bean `zrvt`). One implementation of moving, and the callers
    // differ only in whether a position outlives the page.
    function settle() { if (onSettle) onSettle(geometryOf(panel)); }
    // `opts.unbounded`, OPTIONAL: the panel may go past the origin. Only the
    // GLASS passes it, because only the glass pans — see `nudge` for why a
    // window keeps its clamp (`l4zi`) and a card on the glass does not.
    var unbounded = !!(opts && opts.unbounded);
    // `opts.noResize`, OPTIONAL: Shift+arrows MOVE rather than resize. The
    // glass card passes it — owner, 2026-10-05: *"No keyboard resize thing.
    // Only the plus minus"* — so its size has one route, the card's −/+.
    var noResize = !!(opts && opts.noResize);

    // THE KEYBOARD PATH, and it acts only in the mode. Outside it the arrows
    // go on scrolling the page, which is what a reader expects of them.
    panel.addEventListener("keydown", function (e) {
      if (panel.getAttribute("data-fa-moving") !== "true") return;
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        setMoveMode(panel, false, live);
        panel.dispatchEvent(new CustomEvent("fa:move-mode", { detail: { on: false } }));
        return;
      }
      if (nudge(panel, e.key, e.shiftKey && !noResize, unbounded)) {
        e.preventDefault();
        e.stopPropagation();
        settle();
      }
    });

    /* THE ACCELERATOR, over the top of the path above rather than instead of
     * it. Everything it can do, the keyboard can already do.
     *
     * POINTER EVENTS, not mouse events — bean `c132`, owner 2026-09-23: *"tablet
     * should be like laptops"*. `mousedown` never fires for a finger drag, so on
     * a touch tablet the surface could not be arranged at all. One listener
     * set now serves mouse, pen and touch.
     *
     * A FINGER MUST STILL SCROLL. A touch that starts on a card's text is the
     * reader scrolling that text, and taking it for a drag would make long
     * notes unreadable on a tablet. So a non-mouse pointer drags only from a
     * declared GRIP (`[data-fa-grip]` — the glass card's face, a sticky's
     * head) or while the card is in move mode. The CSS gives exactly those
     * `touch-action: none`, which is what stops the browser claiming the
     * gesture as a scroll first. */
    var from = null;
    handle.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // Not on a control: a drag that started on `[x]` would fight the click
      // that closes the panel. Nor on a LINK: a drag that started on an
      // asset's name would swallow the press a reader meant as "open it".
      if (e.target.closest("[data-fa-control]") || e.target.closest("button") ||
          e.target.closest("a")) return;
      if (e.pointerType !== "mouse" && panel.getAttribute("data-fa-moving") !== "true" &&
          !e.target.closest("[data-fa-grip]")) return;
      // A drag still live from a release this page never heard ends here
      // rather than being silently replaced — it settles where it stood.
      if (from) finish();
      from = { x: e.clientX, y: e.clientY, g: geometryOf(panel), id: e.pointerId };
      listen(true);
      // NOT for a mouse. `preventDefault` on `pointerdown` suppresses the
      // compatibility `mousedown` that follows it, and the board windows RAISE
      // on `mousedown` — the switch to pointer events broke "selecting any part
      // raises it" until `board-windows.e2e.ts` said so. A mouse drag's text
      // selection is stopped on that `mousedown` instead, below, as it was
      // before. A touch drag is stopped here, where it has no mousedown.
      if (e.pointerType !== "mouse") {
        try { handle.setPointerCapture(e.pointerId); } catch (_e) { /* not capturable; document listeners still see it */ }
        e.preventDefault();
      }
    });
    handle.addEventListener("mousedown", function (e) {
      if (from) e.preventDefault();
    });

    /* EVERY DRAG ENDS — owner, 2026-09-24: *"drag drop avatar and cant
     * un-drag when not on avata"*.
     *
     * A drag used to end on exactly one thing: a `pointerup` on `document`.
     * A button released where the page cannot hear it — past the window's
     * edge, over the browser's own chrome, under a native menu — sends no
     * `pointerup` at all, and the card then followed a pointer with no button
     * held until the reader happened to press again. Measured: after such a
     * release the card went on following the pointer for 300px. So a drag
     * now ends on ANY of the ways a browser says the press is over:
     *
     *   - `pointerup` / `pointercancel`, wherever they land;
     *   - `lostpointercapture` — a finger's capture taken away;
     *   - a mouse `pointermove` with NO button held, which is what the unheard
     *     release looks like from inside the page;
     *   - the window losing focus mid-drag;
     *   - and `Escape`, which CANCELS: the card goes back where it was and
     *     nothing is saved. A drag the reader cannot take back is a gesture
     *     with no inverse, which is `l4zi` for pointers.
     *
     * The document listeners exist only WHILE a drag is live. They used to be
     * added once per card and never removed, and the glass rebuilds its cards
     * on every change — so each rebuild left three more listeners behind,
     * closed over cards no longer on the page. */
    function onMove(e) {
      if (!from || e.pointerId !== from.id) return;
      // A MOUSE only. A finger or a pen cannot be lifted unheard — its
      // contact ends in `pointerup` or `pointercancel`, and it is captured —
      // while a mouse button let go outside the window can be.
      if (e.pointerType === "mouse" && e.buttons === 0) { finish(); return; }
      // A SECOND FINGER made this a pinch of the whole glass (`b8eq`): the
      // card stands still rather than following one of two fingers.
      if (panel.closest && panel.closest("[data-fa-pinching]")) return;
      // ON A ZOOMED SURFACE a finger's pixels are not the card's pixels: at
      // 50% a card must move two of its own for every one the pointer moves,
      // or it slides out from under the finger.
      var host = panel.parentNode && panel.parentNode.closest ? panel.parentNode.closest("[data-fa-scale]") : null;
      var scale = (host && parseFloat(host.getAttribute("data-fa-scale"))) || 1;
      var left = from.g.left + (e.clientX - from.x) / scale;
      var top = from.g.top + (e.clientY - from.y) / scale;
      applyGeometry(panel, {
        left: unbounded ? left : Math.max(0, left),
        top: unbounded ? top : Math.max(0, top),
        width: from.g.width,
        height: from.g.height,
      });
    }
    function onEnd(e) {
      if (!from || (e && e.pointerId !== from.id)) return;
      finish();
    }
    function onKey(e) {
      if (!from || e.key !== "Escape") return;
      // CAPTURE PHASE, and stopped: the glass's own Escape puts the glass
      // away, and a reader cancelling a drag has not asked for that.
      e.preventDefault();
      e.stopPropagation();
      applyGeometry(panel, from.g);
      stop();
      if (live) live.textContent = "Move cancelled; back where it was.";
    }
    function onBlur() { if (from) finish(); }
    function listen(on) {
      var f = on ? "addEventListener" : "removeEventListener";
      document[f]("pointermove", onMove);
      document[f]("pointerup", onEnd);
      document[f]("pointercancel", onEnd);
      document[f]("keydown", onKey, true);
      window[f]("blur", onBlur);
      handle[f]("lostpointercapture", onEnd);
    }
    function stop() {
      from = null;
      listen(false);
    }
    function finish() {
      stop();
      settle();
    }

    // The same step an arrow key takes, for a caller that offers it as a
    // BUTTON — the glass's move bar, for a reader who cannot press arrows.
    return {
      step: function (key, shift) {
        if (!nudge(panel, key, shift && !noResize, unbounded)) return false;
        settle();
        return true;
      },
    };
  }

  /* ═══ The fishbone — relocate, behind a confirm that names the scope ═══
   *
   * Owner: *"confrim arctions [fishbones] on open content puts in fsh guts"*,
   * and CRDM Q5: **delete becomes MOVE**. `processes/board-relocate.bpmn`
   * is the drawn process; this is its reader-facing half.
   *
   * ## THE CONFIRM IS THE REQUIREMENT, AND IT MUST NOT OVERSTATE EITHER WAY
   *
   * `deletion-requires-confirmation` names the failure: a dialog that says
   * "remove?" when it means "unpublish everywhere". The same lie pointed the
   * other way is just as bad, and it is the one THIS surface could tell — a
   * published page cannot move a file in the repository, so a dialog
   * promising "off the site, everywhere" would be describing something that
   * did not happen.
   *
   * So the dialog says exactly two things: what this does (takes the card off
   * THIS BROWSER's board, reversibly, from the trashcan tile), and what it
   * does not (move the content out of the folio at all). Naming the second is
   * not an apology; it is the difference between a reader thinking they
   * cleared something for the team and knowing they did not.
   *
   * THE SCOPE IS THE OWNER'S, settled 2026-09-21 when `db7g` could not meet
   * its own first line: **reader-local is the whole feature.** The fishbone is
   * a control over one reader's view, and the durable relocation is not the
   * board's — so this dialog describes a per-reader action rather than
   * promising a repository change that is coming. `board-relocate.bpmn`'s
   * `A_MoveContent` is the AGENT's path to fsh-guts and is not wired to this
   * control; wiring them would re-open the question the owner just closed.
   *
   * ## ONE PATH, shared with `d1r6`
   *
   * The relocation itself is `discardTodo` — the same function, the same
   * `localStorage` key, the same `fa:todos-discarded` event the trashcan
   * counter already listens to. The bean asked for one path rather than a
   * second answer, and a second store would have been two counts of one thing.
   */
  function relocateDialog(todo, onConfirm) {
    var dialog = el("div", {
      class: "fa-relocate",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "fa-relocate-title",
      "aria-describedby": "fa-relocate-scope",
    });
    dialog.appendChild(el("h3", { class: "fa-relocate-title", id: "fa-relocate-title" },
      "Send \u201C" + todo.summary + "\u201D to the trashcan?"));

    var scope = el("div", { class: "fa-relocate-scope", id: "fa-relocate-scope" });
    // WHAT WILL HAPPEN, in the words of what it actually does.
    scope.appendChild(el("p", { class: "fa-relocate-does" },
      "This takes the card off your board in this browser. It is saved here, not " +
      "sent anywhere, and not removed for anyone else. You can put it back from " +
      "the trashcan tile."));
    // WHAT WILL NOT, which is the half a reader would otherwise assume.
    scope.appendChild(el("p", { class: "fa-relocate-does-not" },
      "It does not move the content out of the folio, and nothing on this page " +
      "does: the fishbone is a control over YOUR view of the board. Moving content " +
      "into fsh-guts is a change to the repository, made by whoever is editing it."));
    dialog.appendChild(scope);

    var row = el("div", { class: "fa-relocate-actions" });
    var cancel = el("button", { type: "button", class: "fa-relocate-cancel" },
      "Leave it where it is");
    var confirm = el("button", { type: "button", class: "fa-relocate-confirm" },
      "Send to the trashcan");
    row.appendChild(cancel);
    row.appendChild(confirm);
    dialog.appendChild(row);

    function close() {
      if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
    }
    cancel.addEventListener("click", function () { close(); });
    confirm.addEventListener("click", function () { close(); onConfirm(); });
    // ESCAPE IS THE CANCEL, never the confirm. A dialog whose dismissal
    // performs the action is a dialog that did not ask.
    dialog.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
    });
    // Focus lands on the SAFE choice. The reader who hits Enter without
    // reading has left the content where it is, which is the recoverable
    // outcome of the two.
    setTimeout(function () { cancel.focus(); }, 0);
    return dialog;
  }

  /**
   * One declared control, as a button the frame can place.
   *
   * The frame decides the SHAPE and the placement; `handlers` supplies the
   * behaviour, which the board already owns. A kind declares WHICH controls it
   * offers, never what they do — two panels whose `[x]` did different things
   * would be two frames, and the whole point of a fixed chrome is that a
   * reader learns it once.
   *
   * A control with no handler renders and does nothing rather than throwing.
   * That is deliberate: it is the visible half of a wiring gap, and a panel
   * that refused to build would hide which control was unwired.
   */
  /**
   * What a frame control shows, where a glyph is clearer than the words.
   *
   * The accessible name is always the control's LABEL — a glyph alone is a
   * guess, and `aria-label` is what a screen reader announces. `\u2A37` is the
   * owner's `[fishbones]`.
   */
  var CONTROL_GLYPHS = { close: "\u00D7", relocate: "\u2A37", move: "\u271C" };

  /* THE WINDOW BAR IS ICONS, the same ones the row under every sticky uses
   * (#1925: "icons are a mess on both. make compact"). Each icon-only
   * control carries its words twice — `aria-label` for a screen reader,
   * `title` on hover — never a glyph alone, and never a wide text button. */
  // A function, not a map: the glyphs are assigned further down this file.
  function controlSvg(id) {
    return ({ view: EYE_GLYPH, edit: PENCIL_GLYPH, pin: PIN_GLYPH, discard: FISH_GLYPH })[id];
  }

  function controlButton(control, todo, handlers) {
    if (control.id === "view" || control.id === "edit") {
      var link = el("a", {
        class: "fa-board-window-control fa-node-edit",
        "data-fa-control": control.id,
        // The platform's one link recipe rebuilds it on pointer/focus (edit-links.js, bean v433).
        "data-fa-link": control.id === "view" ? "source" : "edit",
        href: safeHref(control.id === "view" ? todo.viewHref : todo.editHref),
        "aria-label": control.label + " — " + todo.summary,
        title: control.label,
      });
      link.innerHTML = controlSvg(control.id);
      return link;
    }
    var svg = controlSvg(control.id);
    var b = el("button", {
      type: "button",
      class: "fa-board-window-control",
      "data-fa-control": control.id,
      "aria-label": control.label + " — " + todo.summary,
      title: control.label,
    }, svg ? null : (CONTROL_GLYPHS[control.id] || control.label));
    if (svg) b.innerHTML = svg;
    if (control.id === "pin") {
      // The pin is the folio toggle: its pressed state and name come from the
      // store, kept in step by `syncStickyPins` like the row's pin.
      var pk = stickyFolioKey("todos", todo.id);
      b.setAttribute("data-fa-folio-pin", pk);
      b.setAttribute("data-fa-pin-title", todo.summary);
      setPinButton(b, todo.summary, folioStateOf(pk) === "glass");
    }
    // The frame wires what the frame owns; everything else delegates to the
    // behaviour the board already has. A kind declares WHICH controls it
    // offers, never what they do — two panels whose `[x]` did different
    // things would be two frames.
    var act = handlers[control.id];
    if (act) {
      b.addEventListener("click", function (e) { e.stopPropagation(); act(todo, b); });
    }
    return b;
  }

  /** Split into what this node can serve and what it cannot, with reasons. */
  function servableControls(controls, capabilities) {
    var shown = [];
    var hidden = [];
    for (var i = 0; i < controls.length; i++) {
      var c = controls[i];
      if (c.needs === "none" || capabilities[c.needs] === true) shown.push(c);
      else {
        hidden.push({
          control: c,
          because: c.label + " needs " + c.needs + ", which this node does not have.",
        });
      }
    }
    return { shown: shown, hidden: hidden };
  }
  var windowStack = { open: [] };

  function isWindowOpen(id) { return windowStack.open.indexOf(id) !== -1; }

  /** Open at the top; opening an already-open card RAISES it, never duplicates. */
  function openWindowFor(id) {
    windowStack.open = windowStack.open.filter(function (o) { return o !== id; });
    windowStack.open.push(id);
  }

  function closeWindowFor(id) {
    windowStack.open = windowStack.open.filter(function (o) { return o !== id; });
  }

  /** Raising a card that is not open does NOT open it — selection is not opening. */
  function raiseWindow(id) { if (isWindowOpen(id)) openWindowFor(id); }

  /** One-based, bottom to top. `undefined` for a card that is not open. */
  function zIndexFor(id) {
    var at = windowStack.open.indexOf(id);
    return at === -1 ? undefined : at + 1;
  }

  /**
   * The declared threshold for a kind, with where it came from — or null.
   *
   * Returns the SOURCE alongside the number for the reason
   * `schemas/kg/semantic-zoom.ts` gives: an inherited value is still a fact
   * somebody must be able to trace, and a reviewer looking at a card that
   * flipped too early needs to tell a deliberate override from the folio's
   * default landing somewhere it does not fit.
   */
  function zoomThresholdFor(kind) {
    var z = zoomState.zoom;
    if (!z) return null;
    var o = z.byKind && z.byKind[kind];
    if (o) return { belowPx: o.belowPx, source: "kind", because: o.because };
    return { belowPx: z.belowPx, source: "folio" };
  }

  /** Strictly below, so the declared number is the last width that still shows words. */
  function rendersAvatar(kind, widthPx) {
    var t = zoomThresholdFor(kind);
    if (!t) return false;
    return widthPx < t.belowPx;
  }

  /**
   * WHAT A TEXT CARD SHOWS ONCE IT IS ITS AVATAR — the first words of it,
   * condensed. Owner, 2026-10-01: *"if todo is small zoomed, it shows no
   * content at all. instead it should cleanup whitespace and show condended
   * first part of todo that is dsplay."*
   *
   * A book's avatar is its cover, so zooming it out leaves a picture. A
   * todo's words ARE its face: hiding the title and the body below the
   * declared width left a blank square (or an empty button on the board),
   * with nothing to tell one note from another. So semantic zoom keeps the
   * mechanism and changes only what the small state draws for a text kind:
   * this gist, which the CSS clamps to what fits.
   *
   * Markdown noise is dropped rather than rendered — at this size a heading
   * or a bullet is a mark that costs a word — and every run of whitespace,
   * newlines included, becomes one space. `max` is a ceiling on what is
   * carried, not what is shown; the clamp decides that.
   */
  function plainGist(text) {
    return String(text || "")
      .replace(/```[^\n]*\n?/g, " ")
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/^[ \t]*(?:#{1,6}|>|[-*+]|\d+[.)])[ \t]+/gm, "")
      .replace(/\*\*|__|~~|[*`]/g, "")
      .replace(/(^|[^\w])_+|_+(?=[^\w]|$)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }
  function gistOf(parts, max) {
    var s = parts.map(plainGist).filter(function (p) { return p !== ""; }).join(" — ");
    max = max || 280;
    if (s.length <= max) return s;
    var cut = s.slice(0, max);
    var sp = cut.lastIndexOf(" ");
    return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + "…";
  }

  /**
   * THE SITE'S BASEURL, derived from a path the server already resolved —
   * the FALLBACK arm of `siteBaseurl`, never called directly.
   *
   * Every backdrop in the todo index was arriving as `/assets/img/...` —
   * site-ROOT-absolute with no baseurl — and this site is served from
   * `/folio-assistant/` on the canonical deploy and
   * `/folio-assistant/branches/<branch>/` on a preview. So every one of them
   * 404'd, and the owner saw todo cards with a broken-image placeholder
   * beside landing stickies that had their art: *"i want the theme on the
   * lower ones too. why are they dispalyed differently."*
   *
   * They were not displayed differently by design. The theme WAS applied —
   * `data-fa-sticky-theme` and `fa-sticky--backdrop` both set — and only the
   * picture failed to load. A styling answer would have been the wrong fix
   * for a broken path.
   *
   * ## Why derive it rather than read it
   *
   * `gen-docs-pages.ts` cannot write the baseurl in: the SAME index file is
   * served from the canonical prefix and from every staging prefix, so a
   * baked-in prefix is wrong on all but one. Liquid could pass it, and
   * the site index does carry `site.baseurl` — but that document is about
   * translations and may legitimately be absent, which would make the art
   * depend on an unrelated feature being switched on. It is now FETCHED as
   * well (2026-10-02), so reading it here would also make the art wait on a
   * request: a second reason for the same answer.
   *
   * `meta[name="fa-todo-src"]` is the honest source: it is emitted through
   * `relative_url`, so the SERVER has already resolved the prefix, and the
   * board does not mount at all without it. Stripping the known suffix gives
   * the prefix the same page used to fetch the index itself.
   */
  function baseurlFromTodoSrc() {
    var m = document.querySelector('meta[name="fa-todo-src"]');
    var src = m && m.getAttribute("content");
    var suffix = "/assets/todos/index.json";
    if (src && src.length >= suffix.length && src.slice(-suffix.length) === suffix) {
      return src.slice(0, -suffix.length);
    }
    return "";
  }

  /**
   * Prefix every art path in a `themeArt` map with the site's baseurl.
   *
   * Left alone: anything already absolute (`http:`, `//`) and anything that
   * already starts with the prefix. The second guard is what stops a
   * double-prefix if the generator is ever changed to resolve paths itself —
   * at which point this becomes a no-op rather than a bug.
   */
  function baseurlResolved(themeArt) {
    var base = siteBaseurl();
    if (!base) return themeArt;
    var out = {};
    Object.keys(themeArt).forEach(function (theme) {
      var layouts = themeArt[theme] || {};
      out[theme] = {};
      Object.keys(layouts).forEach(function (layout) {
        var src = layouts[layout];
        if (typeof src !== "string" || /^([a-z]+:)?\/\//i.test(src) || src.indexOf(base + "/") === 0) {
          out[theme][layout] = src;
        } else {
          out[theme][layout] = base + src;
        }
      });
    });
    return out;
  }

  /** Fetch the folio's declaration. Absent is a real answer and stays null. */
  function fetchZoom(done) {
    var src = document.querySelector('meta[name="fa-zoom-src"]');
    var url = src && src.getAttribute("content");
    if (!url) return done();
    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (doc) {
        if (doc && typeof doc.belowPx === "number") zoomState.zoom = doc;
        done();
      })
      .catch(function (e) {
        // Said once, and never replaced by a number. A board that guessed a
        // threshold would put the literal R2 forbids one layer further from
        // where anybody would look for it.
        console.warn("docs-ui: no semantic-zoom declaration at " + url + " (" + e.message +
                     "); cards keep their words at every width.");
        done();
      });
  }

  /** The published index, or `null` when it could not be read. */
  function fetchTodoIndex(done) {
    var src = document.querySelector('meta[name="fa-todo-src"]');
    var url = src && src.getAttribute("content");
    if (!url) return done(null);
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (doc) {
        if (!doc || !Array.isArray(doc.items)) return done(null);
        todoState.processes = doc.processes || {};
        // The art, per THEME rather than per todo — fifty todos sharing a
        // theme would otherwise carry fifty copies of the same three paths.
        // Absent is a real state: a theme with no backdrop renders a flat
        // themed card, which is correct rather than degraded.
        todoState.themeArt = baseurlResolved(doc.themeArt || {});
        done(doc.items);
      })
      .catch(function (e) {
        // Third state, reported rather than rendered as "no todos". A board
        // that opens empty is indistinguishable from a person with nothing
        // outstanding, and those are opposite facts.
        console.warn("docs-ui: could not read " + url + " (" + e.message + "); " +
                     "the todo board was not mounted.");
        done(null);
      });
  }

  /**
   * THE ONE READER OF `todos.jsonld` — follow-up 2 of #1941.
   *
   * The index above carries what a sticky LOOKS like (theme art, process
   * stacking, the forge links). The graph carries what a todo is CONNECTED
   * to, as typed edges: `target` (`schema:about`, the content node),
   * `assignee` (`schema:agent`, a person) and `bean` (`dcterms:isPartOf`).
   * Those are the axes a reader filters and groups the board by, so they are
   * read from the graph that states them rather than re-derived from the
   * index's `relations`, which are display chips and not edges.
   *
   * Calls back with `{ <todo id>: edges }`, or `null` when there is no graph
   * to read. `null` is the third state and is NOT "no edges": the board still
   * mounts from the index, it simply offers no node, person or bean control,
   * because a control built from nothing would offer a filter that matches
   * nothing. Said once on the console, like every other missing input here.
   *
   * Each todo's page, `todos/<id>/`, is resolved against the GRAPH's URL and
   * not taken from its `@id`, which names the production host — a staging
   * preview's sticky must open the staging preview's page.
   */
  function fetchTodoGraph(done) {
    var src = document.querySelector('meta[name="fa-todo-graph"]');
    var url = src && src.getAttribute("content");
    if (!url) return done(null);
    var base;
    try { base = new URL(url, document.baseURI); } catch (_e) { return done(null); }
    fetch(base.href)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (doc) {
        var nodes = doc && Array.isArray(doc["@graph"]) ? doc["@graph"] : null;
        if (!nodes) throw new Error("no @graph");
        var out = {};
        nodes.forEach(function (n) {
          if (!n || typeof n.identifier !== "string") return;
          var target = n.target && typeof n.target === "object" ? n.target : null;
          out[n.identifier] = {
            node: target ? (target.label || target["@id"]) : undefined,
            person: edgeIds(n.assignee),
            bean: edgeIds(n.bean),
            pageHref: new URL("todos/" + encodeURIComponent(n.identifier) + "/", base).href,
          };
        });
        done(out);
      })
      .catch(function (e) {
        console.warn("docs-ui: could not read " + url + " (" + e.message + "); " +
                     "the board cannot filter or group by node, person or bean.");
        done(null);
      });
  }

  /** An edge's targets as identifiers: `identifier` where given, else `@id`. */
  function edgeIds(v) {
    var list = Array.isArray(v) ? v : v ? [v] : [];
    var out = [];
    list.forEach(function (x) {
      var id = typeof x === "string" ? x : x && (x.identifier || x["@id"]);
      if (typeof id === "string" && id && out.indexOf(id) === -1) out.push(id);
    });
    return out;
  }

  /**
   * Paragraphs, split on blank lines. Text only -- see the header.
   *
   * `{ markdown: true }` renders the note's MARKDOWN instead, and only a
   * caller that owns its text may ask for it. Owner, 2026-09-24, on a sticky
   * popped out onto the folio glass: *"i expected to see themed square sticky
   * avatar faded with markdown overlayed"*. A todo's `comment` is authored
   * markdown in the declared `todos/` graph, and showing its asterisks and
   * hashes as text is showing the SOURCE, not the note. `fsh-guts/` keeps the
   * plain path, for the reason in the header: a dumping ground is not
   * interpreted.
   *
   * ONE body renderer with a switch, not a second one. And still no
   * `innerHTML`: the markdown is parsed into DOM nodes whose text is set with
   * `textContent`, and a link goes through `safeHref`, so an authored note
   * cannot carry markup or a hostile scheme into the page.
   */
  function renderBody(text, opts) {
    var wrap = el("div", { class: "fa-sticky-body" });
    if (opts && opts.markdown) {
      renderMarkdownInto(wrap, text);
    } else {
      var paras = String(text || "").split(/\n{2,}/);
      for (var i = 0; i < paras.length; i++) {
        var p = paras[i].trim();
        if (p !== "") wrap.appendChild(el("p", null, p));
      }
    }
    if (wrap.childNodes.length === 0) {
      wrap.appendChild(el("p", { class: "fa-sticky-empty" }, "No detail recorded."));
    }
    return wrap;
  }

  /**
   * The block half of a note's markdown: paragraphs, headings, lists.
   *
   * The subset a todo actually uses — measured over `todos/`: paragraphs,
   * `##` headings, `-` and `1.` lists, `**bold**`, `*emphasis*`, inline code
   * and links. Anything else stays as its text, which is the safe failure: a
   * construct this does not know is SHOWN, never dropped.
   *
   * A heading is a styled paragraph (`.fa-md-heading`), not an `<h2>`: a
   * note's `##` is structure inside a card, and minting a real heading would
   * put every sticky's sections into the PAGE's outline.
   */
  function renderMarkdownInto(wrap, text) {
    var lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
    var para = [];
    var list = null;
    var listTag = null;
    function flushPara() {
      if (!para.length) return;
      var p = el("p");
      appendInlineMarkdown(p, para.join(" "));
      wrap.appendChild(p);
      para = [];
    }
    function flushList() {
      if (!list) return;
      wrap.appendChild(list);
      list = null;
      listTag = null;
    }
    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, "");
      var m;
      if (!line.trim()) { flushPara(); flushList(); return; }
      m = line.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*$/);
      if (m) {
        flushPara(); flushList();
        var h = el("p", { class: "fa-md-heading" });
        appendInlineMarkdown(h, m[1]);
        wrap.appendChild(h);
        return;
      }
      m = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
      if (m) {
        flushPara();
        var tag = /\d/.test(m[1]) ? "ol" : "ul";
        if (!list || listTag !== tag) { flushList(); list = el(tag); listTag = tag; }
        var li = el("li");
        appendInlineMarkdown(li, m[2]);
        list.appendChild(li);
        return;
      }
      // An indented line under a list item continues that item.
      if (list && /^\s{2,}\S/.test(raw)) {
        list.lastChild.appendChild(document.createTextNode(" "));
        appendInlineMarkdown(list.lastChild, line.trim());
        return;
      }
      flushList();
      m = line.match(/^\s*>\s?(.*)$/);
      para.push((m ? m[1] : line).trim());
    });
    flushPara();
    flushList();
  }

  /**
   * The inline half: code, strong, emphasis, links — as nodes, never markup.
   *
   * `_underscore_` emphasis is deliberately NOT recognised: notes here name
   * files and identifiers (`human_todos`, `fa_first_paint`), and reading their
   * underscores as emphasis would silently eat characters out of a path.
   */
  function appendInlineMarkdown(parent, text) {
    var re = /(`+)([\s\S]*?)\1|\*\*([^*]+?)\*\*|\*([^*\s][^*]*?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
    var last = 0;
    var m;
    while ((m = re.exec(text))) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (m[1]) {
        parent.appendChild(el("code", null, m[2]));
      } else if (m[3]) {
        var s = el("strong");
        appendInlineMarkdown(s, m[3]);
        parent.appendChild(s);
      } else if (m[4]) {
        var em = el("em");
        appendInlineMarkdown(em, m[4]);
        parent.appendChild(em);
      } else {
        // A link a note may not carry is still its words — `pb04`: no link
        // beats a link to nowhere, and dropping the words would lose the note.
        var href = safeHref(m[6]);
        var a = href ? el("a", { href: href }) : el("span");
        appendInlineMarkdown(a, m[5]);
        parent.appendChild(a);
      }
      last = re.lastIndex;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  /**
   * Browser mirror of `schemas/ui/render-output.ts` (`renderToolOutput`, bean
   * `q2wm`, R17): renders one tool/skill output value according to its declared
   * `RENDER_AS` hint (`text`, `url`, `markdown`, `json`) as DOM nodes with no
   * raw HTML injection.
   */
  function renderToolOutput(value, hint) {
    var str = String(value == null ? "" : value);
    var as = (hint && hint.as) || "text";
    if (as === "url") {
      var outUrl = safeHref(str);
      return outUrl
        ? el("a", { href: outUrl, rel: "noopener noreferrer" }, str)
        : el("span", { class: "fa-tool-output-refused" }, str);
    }
    if (as === "markdown") {
      var md = el("div", { class: "fa-tool-output-markdown" });
      renderMarkdownInto(md, str);
      return md;
    }
    if (as === "json") {
      return el("pre", { class: "fa-tool-output-json" }, str);
    }
    return el("span", { class: "fa-tool-output-text" }, str);
  }

  function renderWindowOutputs(outputs) {
    if (!Array.isArray(outputs) || outputs.length === 0) return null;
    var box = el("div", { class: "fa-sticky-outputs" });
    for (var i = 0; i < outputs.length; i++) {
      var item = outputs[i];
      if (!item) continue;
      var as = (item.render && item.render.as) || "text";
      var row = el("div", { class: "fa-sticky-output", "data-render-as": as });
      if (item.name) {
        row.appendChild(el("span", { class: "fa-sticky-output-name" }, String(item.name)));
      }
      row.appendChild(renderToolOutput(item.value, item.render));
      box.appendChild(row);
    }
    return box;
  }

  /**
   * Lazy window detail fetch — bean `q2wm`:
   *
   * Rendering the board with `N` cards makes 0 per-card detail fetches up
   * front (`todoSlot` renders only the avatar/tile). When a reader opens a
   * card window (`openCard`), `fetchCardDetail` fetches that card's detail URL
   * once, caches the result by `todo.id`, and renders any body/tool outputs
   * through `renderBody(..., { markdown: true })` and `renderToolOutput`.
   */
  var cardDetailCache = {};
  var cardDetailPending = {};

  function cardDetailUrl(todo) {
    if (!todo) return undefined;
    return (
      todo.detailHref ||
      todo.bodyHref ||
      todo.artifactHref ||
      (!todo.comment ? todo.jsonldHref : undefined)
    );
  }

  function fetchCardDetail(todo, done) {
    if (!todo || !todo.id) return done(null, false);
    if (Object.prototype.hasOwnProperty.call(cardDetailCache, todo.id)) {
      return done(cardDetailCache[todo.id], true);
    }
    var rawUrl = cardDetailUrl(todo);
    if (!rawUrl) return done(null, false);
    var safeUrl = safeHref(rawUrl);
    if (!safeUrl) {
      var refused = {
        outputs: [{ name: "detail", value: rawUrl, render: { as: "url" } }],
      };
      cardDetailCache[todo.id] = refused;
      return done(refused, false);
    }
    if (cardDetailPending[todo.id]) {
      cardDetailPending[todo.id].push(done);
      return;
    }
    cardDetailPending[todo.id] = [done];
    fetch(safeUrl, { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (raw) {
        var parsed;
        var trimmed = String(raw || "").trim();
        if (trimmed.charAt(0) === "{") {
          try {
            parsed = JSON.parse(trimmed);
          } catch (_e) {
            parsed = { body: raw };
          }
        } else {
          parsed = { body: raw };
        }
        cardDetailCache[todo.id] = parsed;
        var waiters = cardDetailPending[todo.id] || [];
        delete cardDetailPending[todo.id];
        for (var w = 0; w < waiters.length; w++) waiters[w](parsed, false);
      })
      .catch(function (e) {
        console.warn("docs-ui: could not read detail for " + todo.id + " (" + e.message + ")");
        var waiters = cardDetailPending[todo.id] || [];
        delete cardDetailPending[todo.id];
        for (var w = 0; w < waiters.length; w++) waiters[w](null, false);
      });
  }

  function applyWindowDetail(cardEl, todo, detail) {
    var bodyText =
      (detail && (detail.comment || detail.description || detail.body)) ||
      todo.comment ||
      "";
    var oldBody = cardEl.querySelector(".fa-sticky-body");
    if (bodyText && oldBody && oldBody.parentNode) {
      var nextBody = renderBody(bodyText, { markdown: true });
      if (oldBody.hasAttribute("hidden")) nextBody.setAttribute("hidden", "hidden");
      oldBody.parentNode.replaceChild(nextBody, oldBody);
    }
    var outputs = (detail && detail.outputs) || todo.outputs;
    var oldOut = cardEl.querySelector(".fa-sticky-outputs");
    if (oldOut && oldOut.parentNode) oldOut.parentNode.removeChild(oldOut);
    var outBox = renderWindowOutputs(outputs);
    if (outBox) cardEl.appendChild(outBox);
  }


  /**
   * Board order: todos stacked by the BPMN subprocess hierarchy.
   *
   * "stacking should follow hiearchy od busines subprocesses". The diagrams
   * already carry that hierarchy as `calledElement` refs — `Process_Lifecycle`
   * calls `Process_Publication`, which calls `Process_Editing` — and the
   * generator publishes it beside the todos.
   *
   * ## Depth is the process's own, not the todo's
   *
   * A todo tagged `Process_Publication` sits at the depth `Process_Publication`
   * sits at, so two todos on the same process always land together and a todo
   * on a caller always sorts above one on its callee. Computing depth from the
   * todo would make the same process appear at different levels depending on
   * which todo reached it first.
   *
   * ## A todo on SEVERAL processes takes the shallowest
   *
   * `what-kick-off-means-for-a-ci-watcher` is tagged `Process_CodeReview` AND
   * `Process_Publication`, because its two dispatch points are in different
   * diagrams. It belongs where a reader would look first, which is the outer
   * one; listing it twice would double a single outstanding item.
   *
   * ## Untagged todos are not orphans
   *
   * They sort FIRST, not last. Most todos carry no process — both of the
   * others here do not — and sinking them below a process hierarchy they are
   * not part of would bury the common case under the rare one.
   */
  function processDepth(id, hierarchy) {
    // A process's depth is how many callers stand above it. Cycles are
    // possible in principle (two diagrams calling each other), so the walk is
    // bounded by the number of processes rather than trusting acyclicity.
    var parents = {};
    for (var p in hierarchy) {
      var kids = hierarchy[p] || [];
      for (var k = 0; k < kids.length; k++) if (!parents[kids[k]]) parents[kids[k]] = p;
    }
    var depth = 0;
    var at = id;
    var guard = 0;
    var limit = Object.keys(hierarchy).length + 1;
    while (parents[at] && guard++ < limit) { at = parents[at]; depth++; }
    return depth;
  }

  function stackTodos(items, hierarchy) {
    var rows = [];
    for (var i = 0; i < items.length; i++) {
      var t = items[i];
      var procs = (t.tags && t.tags.processes) || [];
      if (procs.length === 0) { rows.push({ todo: t, process: null, depth: -1 }); continue; }
      var best = procs[0];
      var bestD = processDepth(best, hierarchy);
      for (var j = 1; j < procs.length; j++) {
        var d = processDepth(procs[j], hierarchy);
        if (d < bestD) { best = procs[j]; bestD = d; }
      }
      rows.push({ todo: t, process: best, depth: bestD });
    }
    rows.sort(function (a, b) {
      if (a.depth !== b.depth) return a.depth - b.depth;
      if (a.process !== b.process) return String(a.process).localeCompare(String(b.process));
      return a.todo.id.localeCompare(b.todo.id);
    });
    return rows;
  }


  /* ── Discarding a sticky (bean `d1r6`) ─────────────────────────────────
   *
   * Owner, 2026-09-19: *"stikies have an [x] to close/restore to panel...
   * that should now be replaced with it going into the fsh-guts. icon there
   * should be crumpled sticky."*
   *
   * ## What "into the fsh-guts" can mean on a static site
   *
   * The published `fsh-guts.jsonld` is built from the repository; a page has
   * no way to write to it. So a discard here is **per-viewer and
   * per-browser**, in `localStorage`, exactly like the reading preferences.
   *
   * **The UI says so, in words, wherever a discarded item appears.** A reader
   * who thinks they have cleared a todo for the team when they have cleared
   * it for themselves has been misled by the control, and that is a worse
   * failure than not having the control.
   *
   * ## It is a discard, not a delete — `fsh-guts`'s whole rule
   *
   * "Delete means relocate", and a thing in the trashcan can be read, cited
   * and restored. So a discarded sticky is listed in the Discarded view with
   * a Restore control beside it. A one-way dismiss would carry the crumpled
   * icon while breaking the rule the icon stands for.
   *
   * ## Removing the × does not strand anyone
   *
   * The × returned a FLOATING sticky to the board, and the board already
   * offers that a second way: the greyed slot entry is a real button that
   * docks it (owner: *"can also return the sticky note by clicking
   * disabled"*). So the close control's old job survives without it.
   */

  /* THE CRUMPLED-STICKY GLYPH IS GONE (#1925). The owner, looking at it:
   * *"[x] is what? send to fsh-guts?"*. The send now wears fsh-guts' own dead
   * fish (`FISH_GLYPH`), the same mark as the place it goes and is restored
   * from, and its name says "Send … to fsh-guts". */

  var DISCARDED_TODOS_KEY = "fa-discarded-todos";

  /** Ids this browser has discarded. Never throws — storage may be blocked. */
  function discardedTodoIds() {
    try {
      var raw = localStorage.getItem(DISCARDED_TODOS_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
      return [];
    }
  }

  function setDiscardedTodoIds(ids) {
    try {
      localStorage.setItem(DISCARDED_TODOS_KEY, JSON.stringify(ids));
      return true;
    } catch (_e) {
      // Saying nothing would be worse than a console note nobody reads: the
      // reader will discard something, reload, and wonder why it came back.
      console.warn("docs-ui: the discard could not be saved (storage blocked); " +
                   "it applies to this page view only.");
      return false;
    }
  }

  /* THE NAME IT WENT IN UNDER, kept beside the id (#1925). A landing sticky
   * sent to fsh-guts from the home page is listed in fsh-guts on EVERY page,
   * and away from home there is no card to read its title from — a row that
   * said "landing/folio-assistant" would be restorable but not recognisable. */
  var DISCARDED_TITLES_KEY = "fa-discarded-titles";

  function discardedTitles() {
    try {
      var m = JSON.parse(localStorage.getItem(DISCARDED_TITLES_KEY) || "{}");
      return m && typeof m === "object" && !Array.isArray(m) ? m : {};
    } catch (_e) {
      return {};
    }
  }

  function discardTodo(id, title) {
    var ids = discardedTodoIds();
    if (ids.indexOf(id) === -1) ids.push(id);
    setDiscardedTodoIds(ids);
    if (title) {
      var names = discardedTitles();
      names[id] = String(title).slice(0, 200);
      try { localStorage.setItem(DISCARDED_TITLES_KEY, JSON.stringify(names)); } catch (_e) { /* the id still restores */ }
    }
    document.dispatchEvent(new CustomEvent("fa:todos-discarded", { detail: { id: id } }));
  }

  function restoreTodo(id) {
    setDiscardedTodoIds(discardedTodoIds().filter(function (x) { return x !== id; }));
    document.dispatchEvent(new CustomEvent("fa:todos-discarded", { detail: { id: id } }));
  }

  /**
   * The `<picture>` a themed sticky renders its art in.
   *
   * MARKUP, not a CSS background, and the reason is recorded on the stylesheet
   * rule this feeds: `<picture>` swaps the FILE at a breakpoint and
   * `background-image: url(...)` can only name one crop. Serving the wide crop
   * to a phone is a bug this repository has already shipped once.
   *
   * TWO sources, not three. The `card` crop is the default because a todo
   * sticky IS a board card — dense, roughly square — and `mobile` takes over
   * below 30rem where a square card has the least room on the tallest screen.
   * The `laptop` crop is deliberately unused here: it is composed for a
   * page-width surface, and handing it to a card would show the art's quiet
   * area in the wrong place. The landing sticky still uses all three, because
   * it really is a page-width surface at the top end.
   *
   * `alt=""` and `aria-hidden`: this is decoration behind text that already
   * says everything. A description of the cat would be read out before every
   * todo on the board.
   */
  /* THE SQUARE CROP, ON EVERY SCREEN, UNLESS THE TODO NAMES ONE.
   *
   * Owner, 2026-09-24: "i want sticky themes to by default use the square
   * avatar layout but mostly faded, if not specified." This used to swap in the
   * tall `mobile` crop below 30rem, which made one sticky show two different
   * pictures depending on the window — and the square is the crop the avatar
   * is cut from, so it is the one that reads as this theme's cat.
   *
   * "Mostly faded" is the theme's scrim, unchanged: `--fa-sticky-scrim` covers
   * 82–86% of the art, and its AAA-over-pure-black guarantee travels with it.
   *
   * `layout` on the todo picks another crop when an author asks for one. A
   * name the theme has no crop for falls back to the square rather than to no
   * art. */
  function buildBackdrop(art, layout) {
    var pic = el("picture", { "aria-hidden": "true" });
    // The generator only publishes complete sets, so the later fallbacks are
    // reached only by a hand-written index.
    var chosen = (layout && art[layout]) || art.card || art.mobile || art.laptop;
    pic.appendChild(el("img", { class: "fa-sticky-art", src: chosen, alt: "", loading: "lazy" }));
    return pic;
  }

  /* THE CROP FOLLOWS THE CARD'S SHAPE, on the glass — owner, 2026-09-27:
   * *"use laptop layout for the existing todos"* and then *"theme todos layout
   * should be dynamic in case user resized"*. A card on the glass is resized
   * freely, so one crop cannot suit it: the square `card` crop in a wide card
   * left the art as a picture in the middle of the text. So the shape picks:
   * wide takes `laptop`, tall takes `mobile`, near-square keeps `card`, and a
   * ResizeObserver re-picks as the reader resizes. A todo that NAMES a layout
   * keeps it. Board stickies follow the same rule (owner, same day: "board
   * stickies adapt too"), so a sticky reflowed wide by the board is wide.
   * The scrim is unchanged, so the fade does not depend on the crop. */
  function cropForShape(art, w, h) {
    var r = w / Math.max(h, 1);
    var pick = r >= 1.3 ? "laptop" : r <= 0.8 ? "mobile" : "card";
    return art[pick] || art.card || art.mobile || art.laptop;
  }
  function followCardShape(card, art, layout) {
    if (layout && art[layout]) return;
    var img = card.querySelector(".fa-sticky-art");
    if (!img) return;
    function fit() {
      var r = card.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var src = cropForShape(art, r.width, r.height);
      if (src && img.getAttribute("src") !== src) img.setAttribute("src", src);
    }
    fit();
    if (typeof ResizeObserver === "function") new ResizeObserver(fit).observe(card);
  }

  /* The pencil and the eye, as inline SVG rather than `✎` and `⎘`.
   *
   * Which glyph a font actually has for those two characters varies, and `⎘`
   * falls back to a box on several common stacks — a control that looks
   * broken without anybody changing it. An inline path draws the same shape
   * everywhere and takes `currentColor`. */
  var EYE_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 5c-5 0-8.6 4.2-9.6 6a1 1 0 0 0 0 1c1 1.8 4.6 6 9.6 6s8.6-4.2 9.6-6a1 1 0 0 0 0-1c-1-1.8-4.6-6-9.6-6zm0 11a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-2.2a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z"/>' +
    "</svg>";
  var PENCIL_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M4 16.5V20h3.5L17.8 9.7l-3.5-3.5L4 16.5zM20.7 7.3a1 1 0 0 0 0-1.4l-2.6-2.6a1 1 0 0 0-1.4 0l-1.7 1.7 3.5 3.5 1.7-1.7z"/>' +
    "</svg>";

  /**
   * View and Edit for a todo's source file, as a caption row.
   *
   * ## The SLOT owns these, not the card
   *
   * The owner asked for them below the sticky rather than inside it, and the
   * slot is what "below" means here — but there is a second reason the slot
   * is the right owner rather than merely a convenient one. A card can be
   * PINNED onto the glass, where it is positioned freely and has no "below"
   * to put a caption in. Hanging the links on the card would mean either
   * dragging a caption around the glass behind it or losing the links
   * whenever a sticky is pinned.
   *
   * On the slot they simply stay put: the card floats away, the greyed recall
   * button takes its place, and View and Edit are still exactly where the
   * reader left them. That is the same reasoning the board already uses for
   * keeping a floating sticky's slot in the grid rather than reflowing it.
   *
   * ## Absent, never disabled
   *
   * `sourceLinks` returns `undefined` for anything that is not a github.com
   * origin, so the keys are simply missing when the pipeline has no forge.
   * `pb04`: a dead link invites a click and then 404s for exactly the reader
   * who cannot edit, which reads as "this page is broken" rather than "you
   * cannot do this". Returns null so the caller appends nothing at all.
   */
  function buildSourceLinks(todo) {
    if (!todo.viewHref && !todo.editHref) return null;
    var row = el("p", { class: "fa-sticky-links" });
    if (todo.viewHref) {
      var v = el("a", {
        class: "fa-node-edit fa-sticky-view",
        "data-fa-link": "source",
        href: safeHref(todo.viewHref),
        title: "View this todo's source on GitHub",
        // No visible text, so the label and the title are BOTH needed and are
        // not interchangeable: the label names the action for a screen
        // reader, the title gives a pointer user the same words on hover.
        "aria-label": "View the source of " + todo.summary,
      });
      v.innerHTML = EYE_GLYPH;
      row.appendChild(v);
    }
    if (todo.editHref) {
      var e = el("a", {
        class: "fa-node-edit fa-sticky-edit",
        "data-fa-link": "edit",
        href: safeHref(todo.editHref),
        title: "Edit this todo's markdown on GitHub",
        "aria-label": "Edit " + todo.summary,
      });
      e.innerHTML = PENCIL_GLYPH;
      row.appendChild(e);
    }
    return row;
  }

  /* ═══ ONE STICKY — issue #1925 ═══════════════════════════════════════════
   *
   * Owner, 2026-10-02: *"dont treat stickies differently. combine best of
   * each. lower faded avatar/theme looks nicer. upper smaller same size
   * closed looks niceer. icons are a mess on both. make compact underneath.
   * [x] is what? send to fsh-guts? make sure confirmed by user"*.
   *
   * So a landing sticky and a todo sticky are drawn by the SAME two functions:
   *
   *   `stickyTile`     the closed sticky — small, every one the same size, the
   *                    theme's art behind a scrim (the todo stickies' faded
   *                    look), its title on top. Pressing it opens the shared
   *                    board window (`openWindowFor`).
   *   `stickyActions`  ONE compact icon row UNDER it, always in this order:
   *                    view, edit, pin, send to fsh-guts. Nothing inside the
   *                    card body.
   *
   * The two callers differ only in what the buttons DO — a landing sticky
   * pins a copy of its server-rendered card, a todo pins a built one — and
   * never in what the reader sees. View and Edit stay ABSENT, not disabled,
   * when the pipeline has no forge (`pb04`); the order of what is present
   * never changes.
   *
   * THE INVERSE OF EVERY ACTION IS ON THE SAME ROW OR ONE CLICK AWAY (`l4zi`).
   * Pin is a toggle: pressed, it returns the sticky from the glass. Send to
   * fsh-guts asks first (`confirmSendToFshGuts`) and the dialog names where
   * the sticky can be restored from.
   */
  var PIN_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    // A pushpin, head up-right, point down-left.
    '<path d="M14.6 2.6l6.8 6.8-1.9.5-3.6 3.6.4 4.6-1.9 1.9-4.2-4.2L4.6 21l-1.6-1.6 5.2-5.6' +
    '-4.2-4.2 1.9-1.9 4.6.4 3.6-3.6z"/></svg>';

  var PAGE_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    // A page with an arrow out of its corner: "go to this one's page".
    '<path d="M13 3h8v8M21 3l-9 9M18 14v6H4V6h6" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /** The closed sticky. `s`: kind, opens, title, theme, art, process, badge, onOpen. */
  function stickyTile(s) {
    var tile = el("button", {
      type: "button",
      // `fa-sticky-avatar` is kept because a tile IS the avatar that opens the
      // window (`board-windows`: "start everything in avatar"), and the window
      // code returns focus to it by that class.
      class: "fa-sticky-tile fa-sticky-avatar" + (s.art ? " fa-sticky--backdrop" : ""),
      "data-fa-sticky-kind": s.kind,
      "data-fa-sticky-theme": s.theme || undefined,
      "data-fa-opens": s.opens,
      "aria-label": "Open " + s.title,
      title: s.title,
    });
    if (s.art) {
      // The same `<picture>` + scrim the full card uses, so the fade is the
      // theme's `--fa-sticky-scrim` and not a second number.
      var pic = el("picture", { "aria-hidden": "true" });
      pic.appendChild(el("img", { class: "fa-sticky-art", src: s.art, alt: "", loading: "lazy" }));
      tile.appendChild(pic);
    }
    tile.appendChild(el("span", { class: "fa-sticky-tile-title" }, s.title));
    if (s.process) tile.appendChild(el("span", { class: "fa-sticky-tile-process" }, s.process));
    if (s.badge) tile.appendChild(s.badge);
    tile.addEventListener("click", s.onOpen);
    return tile;
  }

  /**
   * The icon row under every sticky. `s`: title, view {href, title, label},
   * edit {href, title, label}, onPin, onDiscard.
   *
   * Icon-only, so each control carries `aria-label` (the name a screen reader
   * announces) AND `title` (the same words on hover). Not interchangeable.
   */
  function stickyActions(s) {
    var row = el("div", {
      class: "fa-sticky-actions",
      role: "group",
      "aria-label": "Actions for " + s.title,
    });
    // `page` FIRST when given: the todo's own page on this site (#1941),
    // before the two that leave for the forge. Absent, never dead, like them.
    [["page", PAGE_GLYPH], ["view", EYE_GLYPH], ["edit", PENCIL_GLYPH]].forEach(function (pair) {
      var link = s[pair[0]];
      var href = link && safeHref(link.href);
      if (!href) return;            // absent, never a dead link (`pb04`)
      var a = el("a", {
        class: "fa-sticky-act fa-sticky-act-" + pair[0],
        "data-fa-act": pair[0],
        href: href,
        rel: "noopener",
        title: link.title,
        "aria-label": link.label,
      });
      // view and edit are GitHub links the platform's one recipe rebuilds (edit-links.js, bean v433).
      if (pair[0] !== "page") a.setAttribute("data-fa-link", pair[0] === "view" ? "source" : "edit");
      a.innerHTML = pair[1];
      row.appendChild(a);
    });
    // THE PIN IS A TOGGLE ONTO THE FOLIO GLASS (owner, 2026-10-02: *"pin to
    // glass should pin to folio glass"*). Its pressed state is the folio
    // store's answer for `s.folioKey`, set here and by `syncStickyPins`.
    var pin = el("button", {
      type: "button",
      class: "fa-sticky-act fa-sticky-act-pin",
      "data-fa-act": "pin",
      "data-fa-folio-pin": s.folioKey,
      "data-fa-pin-title": s.title,
      "aria-pressed": "false",
    });
    pin.innerHTML = PIN_GLYPH;
    pin.addEventListener("click", function () { toggleStickyPin(s.folioKey, s.onPin); });
    row.appendChild(pin);
    var discard = el("button", {
      type: "button",
      class: "fa-sticky-act fa-sticky-act-discard",
      "data-fa-act": "discard",
      title: "Send to fsh-guts",
      // WHERE IT GOES, in the name. The old control was a crumpled icon named
      // "Discard … to the trashcan", and the owner's question was "[x] is
      // what?" — a control a reader has to ask about has not said.
      "aria-label": "Send " + s.title + " to fsh-guts",
    });
    discard.innerHTML = FISH_GLYPH;
    discard.addEventListener("click", function () {
      confirmSendToFshGuts(s.title, s.onDiscard, discard);
    });
    row.appendChild(discard);
    setPinButton(pin, s.title, folioStateOf(s.folioKey) === "glass");
    wireStickyPins();
    return row;
  }

  /**
   * Pin is a toggle: its pressed state, name and tooltip say which way it
   * goes. Unpinned, it pins to the folio glass; pinned, it takes the sticky
   * off the glass — it stays in the reader's folio, and the same button puts
   * it back (`l4zi`).
   */
  function setPinButton(pin, title, pinned) {
    if (!pin) return;
    pin.setAttribute("aria-pressed", pinned ? "true" : "false");
    pin.setAttribute("aria-label", pinned
      ? "Take " + title + " off your folio glass"
      : "Pin " + title + " to your folio glass");
    pin.setAttribute("title", pinned ? "Take off your folio glass" : "Pin to your folio glass");
  }

  /** Where a sticky sent to fsh-guts is restored from, on THIS page, in words. */
  function fshGutsRestoreWhere() {
    return document.querySelector("[data-fa-fsh-guts-open]")
      ? "fsh-guts (the fish in the icon row at the top of the side navigation)"
      : "Page settings (under ▦ Actions), then Discarded";
  }

  /**
   * Ask before sending a sticky to fsh-guts. The owner: *"make sure confirmed
   * by user"*.
   *
   * The NATIVE `<dialog>`, opened modal: focus is trapped and returned by the
   * browser, Escape fires `cancel`, and the dialog sits in the top layer above
   * every board window. Escape and Cancel do nothing but close it — a dialog
   * whose dismissal performs the action did not ask. Focus starts on Cancel,
   * the recoverable choice.
   *
   * It names the sticky, says the send is restorable and per-browser, and says
   * WHERE it is restored from — a reversible action whose way back the reader
   * has to discover is one-way in practice (`l4zi`).
   */
  function confirmSendToFshGuts(title, onConfirm, opener) {
    var body = el("div");
    body.appendChild(el("p", null,
      "fsh-guts is the trashcan that is kept. This takes the sticky off your panel in " +
      "this browser only; nobody else's view changes."));
    body.appendChild(el("p", null,
      "It is restorable: open " + fshGutsRestoreWhere() + ", and choose Restore."));
    return confirmDialog({
      cls: "fa-fsh-confirm",
      title: "Send \u201c" + title + "\u201d to fsh-guts?",
      body: body,
      cancel: "Cancel",
      ok: "Send to fsh-guts",
      onConfirm: onConfirm,
      opener: opener,
    });
  }

  /**
   * THE ONE CONFIRM: every "are you sure" on the page is this dialog, so the
   * rules below are stated once and cannot drift between two copies (#1900
   * and #1926 each grew one; they were merged here).
   *
   * - A NATIVE `<dialog>` opened modal: the browser traps focus, makes the
   *   page behind it inert, and puts it in the top layer above every board
   *   window.
   * - Focus starts on Cancel, the recoverable choice.
   * - Escape (the browser's `cancel`, or by hand where no modal fires it) is
   *   the cancel, never the confirm, and is stopped here so it does not also
   *   reach a surface behind (the glass's own Escape puts the glass away).
   * - Dismissal returns focus to `opener`; confirming runs `onConfirm`, which
   *   owns where focus goes next.
   *
   * `cls` is the class prefix (`<cls>`, `<cls>-title`, `<cls>-actions`,
   * `<cls>-cancel`, `<cls>-ok`): each surface keeps its own look. `mount`
   * defaults to `document.body`; the glass mounts inside its layer so its
   * theme tokens reach the dialog.
   */
  var confirmSeq = 0;
  function confirmDialog(o) {
    var n = ++confirmSeq;
    var cls = o.cls;
    var attrs = {
      class: cls,
      "aria-labelledby": cls + "-title-" + n,
      "aria-describedby": cls + "-body-" + n,
    };
    if (o.live) attrs["aria-live"] = o.live;
    var dialog = el("dialog", attrs);
    dialog.appendChild(el("h2", { class: cls + "-title", id: cls + "-title-" + n }, o.title));
    var body = o.body;
    body.id = cls + "-body-" + n;
    dialog.appendChild(body);
    var row = el("div", { class: cls + "-actions" });
    var cancel = el("button", { type: "button", class: cls + "-cancel" }, o.cancel);
    var ok = el("button", { type: "button", class: cls + "-ok" }, o.ok);
    row.appendChild(cancel);
    row.appendChild(ok);
    dialog.appendChild(row);

    var confirmed = false;
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
      if (confirmed) o.onConfirm();
      else if (o.opener && o.opener.isConnected) o.opener.focus();
    }
    cancel.addEventListener("click", finish);
    ok.addEventListener("click", function () { confirmed = true; finish(); });
    // Escape: the browser fires `cancel` and closes; nothing else happens.
    dialog.addEventListener("cancel", function (e) { e.preventDefault(); finish(); });
    // And by hand, for a browser with no modal dialog to fire `cancel`.
    dialog.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(); }
    });
    (o.mount || document.body).appendChild(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    cancel.focus();
    return dialog;
  }

  /**
   * One line of text, from prose that was never one line.
   *
   * Owner, 2026-09-21, on what a CLOSED sticky shows: *"just the condensend
   * text"*, and then *"(strip whitesaplnce, newlines, bullets....)"*.
   *
   * ## Why this rather than an `aria-label`
   *
   * The first proposal was a visually-hidden name. The owner rejected it —
   * *"that's new data to maintain"* — and the rejection is the better
   * design: a hidden label is a SECOND string beside the visible one, and two
   * strings for one fact is the defect `1rta` and `6lb8` §6 already name about
   * a badge that can disagree with its own panel. The card's own text IS its
   * name; a screen reader and a sighted reader get the same string because
   * there is only one.
   *
   * ## What it strips, and what it deliberately does not
   *
   * Markdown list markers, blockquote carets, heading hashes and every run of
   * whitespace — the structure that makes prose readable DOWN a card and
   * unreadable ACROSS one. It does not truncate: cutting at a character count
   * puts the elision in the model, where a stylesheet cannot undo it for a
   * wider card. `text-overflow` is the renderer's job and stays there.
   */
  function condense(text) {
    if (!text) return "";
    return String(text)
      // List markers and blockquote carets, at the start of any line only —
      // a hyphen mid-sentence is a hyphen.
      .replace(/^[ \t]*(?:[-*+\u2022]|\d+[.)]|>)+[ \t]*/gm, "")
      // Heading hashes, same rule.
      .replace(/^[ \t]*#{1,6}[ \t]*/gm, "")
      // Every run of whitespace, newlines included, becomes one space.
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildSticky(todo) {
    var attrs = {
      class: "fa-sticky fa-sticky-p-" + (todo.priority || "medium"),
      "data-todo-id": todo.id,
    };
    // THE THEME IS A PROPERTY OF THE STICKY, NOT OF THE PINNED STATE.
    //
    // Bean `ivfw`, the owner: "when you unpin, sticky, it loses its theme".
    // Read from `todo.theme` HERE, in the one function that builds a card,
    // which is what makes the round-trip safe rather than the transitions
    // being careful: `float` constructs a second card on the layer and `dock`
    // destroys it, so any theme carried on the DOM node instead of on the todo
    // would be dropped by construction. Neither transition needs to know the
    // theme exists.
    //
    // The attribute is what `themes.css` selects on, so this is the same
    // mechanism the landing stickies use rather than a second one.
    if (todo.theme) attrs["data-fa-sticky-theme"] = todo.theme;
    // THE BACKDROP, when this todo's theme has art. Bean `5y4b`, the owner:
    // "todos need grump cat themeing based on content too."
    //
    // Until now the landing board carried two kinds of sticky side by side —
    // a harness card with per-theme art, a measured text region and a scrim,
    // and a todo that was a flat card with a coloured left border. On one page
    // they read as two systems, which is why this looked wrong rather than
    // merely plain.
    //
    // `fa-sticky--backdrop` is the SAME class the landing sticky uses, so the
    // art positioning, the clipping, the `isolation` stacking context and the
    // scrim all come from rules that already exist and are already measured.
    // Nothing here re-implements them, and nothing here sets a colour: the
    // scrim is `--fa-sticky-scrim` from `themes.css`, whose AAA-over-pure-black
    // guarantee travels with the value rather than being restated.
    var art = todo.theme && todoState.themeArt[todo.theme];
    if (art) attrs.class += " fa-sticky--backdrop";
    var card = el("article", attrs);
    if (art) {
      card.appendChild(buildBackdrop(art, todo.layout));
      // THE BOARD ADAPTS TOO — owner, 2026-09-27, the glass change carried to
      // the board: a sticky's crop follows its shape as the board reflows.
      followCardShape(card, art, todo.layout);
    }

    var head = el("div", { class: "fa-sticky-head" });
    var toggle = el("button", {
      type: "button",
      class: "fa-sticky-toggle",
      "aria-expanded": "false",
    });
    toggle.appendChild(el("span", { class: "fa-sticky-summary" }, condense(todo.summary)));
    head.appendChild(toggle);

    var chips = el("div", { class: "fa-sticky-chips" });
    chips.appendChild(el("span", { class: "fa-sticky-chip fa-sticky-status" }, todo.status));
    chips.appendChild(el("span", { class: "fa-sticky-chip fa-sticky-prio" }, todo.priority));
    head.appendChild(chips);

    // The EDGES. A todo carries six relationship axes -- who it is for, which
    // lane and process and task it sits in, what it points at in the knowledge
    // graph, and which issues, PRs and commits it concerns -- and a sticky that
    // showed only `status` and `priority` would waste all of it on two enums.
    //
    // Each edge is resolved to an href at BUILD time where one exists. An edge
    // that could not be resolved is still shown, as a chip with no link: a
    // dangling reference and no reference at all are different facts, and
    // dropping the first makes it look like the second.
    var rels = todo.relations || [];
    if (rels.length) {
      var relBox = el("ul", { class: "fa-sticky-rels", "aria-label": "Related" });
      for (var r = 0; r < rels.length; r++) {
        var rel = rels[r];
        var li = el("li", { class: "fa-sticky-rel" });
        li.appendChild(el("span", { class: "fa-sticky-rel-axis" }, rel.axis));
        // `safeHref`, not a truthiness test: `TodoRelationSchema.href` is
        // `z.string()`, so the schema permits a scheme this must refuse. A
        // refused edge falls through to the dangling branch below, which
        // already says why there is no link.
        var relHref = safeHref(rel.href);
        if (relHref) {
          li.appendChild(el("a", { class: "fa-sticky-rel-link", href: relHref }, rel.label));
        } else {
          // Title says WHY there is no link, so a reader is not left guessing
          // whether the chip is broken or the target simply is not reachable.
          // TWO REASONS THERE IS NO LINK, and they are different facts. The
          // edge may have resolved to nothing — nobody built the target — or
          // it may carry a scheme a link may not carry. Saying "nothing
          // resolves this" about the second would be wrong, and wrong in the
          // direction that hides a hostile value as a missing one.
          li.appendChild(el("span", {
            class: "fa-sticky-rel-dangling",
            title: rel.href
              ? "No link: " + rel.label + " points at a scheme a link may not carry"
              : "No link: nothing on this site resolves " + rel.label,
          }, rel.label));
        }
        relBox.appendChild(li);
      }
      head.appendChild(relBox);
    }

    var tools = el("div", { class: "fa-sticky-tools" });

    /* THREE ON THE FACE, ONE THAT HOLDS THE REST — bean `qefk`, the owner:
     * *"the todos controls are too clunky / take up too much real estate."*
     * Asked how far to go and answered **"3+1"**.
     *
     * The split is by WHAT THE GESTURE DOES, not by how often it is used:
     *
     *   face      Pin, Discard, and Move once the card is floating
     *             — the things you do to a card ON THE BOARD
     *   behind    View, Edit — the things that LEAVE for the forge
     *
     * That keeps `pb04` intact. Its rule was that View and Edit are two acts
     * and both must be present — *"a reader checking what a card says should
     * not land in a text box, and one who wants to fix it should not have to
     * find the button"*. Present is what it asked for; competing with a
     * one-line summary is not. Both are still here, still keyboard-reachable,
     * one keystroke further away.
     *
     * AND IT IS A `<details>`, not a scripted menu. The disclosure, the
     * keyboard path, the Escape behaviour and the accessible name are the
     * browser's; a hand-rolled popup would be four affordances to reimplement
     * and four ways to get them wrong. It also degrades to "everything
     * visible" with no JavaScript, which is `R4`'s floor rather than a
     * convenience.
     */
    // VIEW *AND* EDIT — two controls, because they are two acts. Bean `pb04`,
    // the owner: *"rendeding shows edit src icon (and also need view icon)"*.
    // `/blob/` is reading and `/edit/` opens GitHub's editor: a reader
    // checking what a card says should not land in a text box, and one who
    // wants to fix it should not have to find the button.
    //
    // BOTH ARE ABSENT, NOT BROKEN, when the rendering pipeline has no forge.
    // The keys are simply missing from the published index — `sourceLinks`
    // returns `undefined` for anything that is not a github.com `origin` — so
    // the test here is presence, and there is nothing to disable or grey out.
    // A dead link is worse than no link: it invites a click, and on a private
    // repository it 404s for exactly the reader who cannot edit, which reads
    // as "this page is broken" rather than "you cannot do this".
    // THE SOURCE LINKS ARE NOT IN THE CARD ANY MORE. Owner, 2026-09-21:
    // *"i want the [pencil] edit icon, (edit, view links can be below, not
    // inside stick)"*. `buildSourceLinks` renders them, and the SLOT places
    // them under the card — see the note on that function for why the slot
    // and not the card is the right owner.
    // An INLINE sticky is already beside the content it is about, so Pin and
    // Close have nothing to do: pinning it would move it AWAY from the thing
    // it annotates, and closing it would hide a block-level annotation with no
    // way back. The board is where those two controls mean something.
    // PIN AND DISCARD ARE NOT ON THE CARD ANY MORE — issue #1925, the owner:
    // *"icons are a mess on both. make compact underneath."* They are in the
    // one icon row under every sticky (`stickyActions`), with View and Edit,
    // in the same order on a landing sticky and a todo. The card keeps only
    // what it needs once FLOATING on the glass — Move and Return, added by
    // `float` — because a floating card has no row beneath it.

    /* THE `⋯` DRAWER IS GONE, and this note is why rather than a silence.
     *
     * `main` answered `qefk` by collapsing View and Edit into a `<details>`
     * on the card's face — the owner's *"3+1"*: three board gestures on the
     * face, the two forge links one level in. That was the right shape for
     * the instruction it had.
     *
     * The owner then went further, 2026-09-21: *"i want the [pencil] edit
     * icon, (edit, view links can be below, not inside stick)"*. The links
     * leave the card entirely, which is the same direction `qefk` was
     * pointing and one step past the drawer. A drawer with nothing to hold
     * is `pb04`'s failure in a new costume — an affordance that promises and
     * delivers nothing — so it goes rather than staying as an empty control.
     *
     * WHAT SURVIVES IS THE SPLIT ITSELF, and it is main's: board gestures
     * (Pin, Discard, Move) belong on the face because they act on the card;
     * the forge links act on the FILE and now sit below it, in the cell.
     * `buildSourceLinks` renders them and the slot places them.
     */

    head.appendChild(tools);

    card.appendChild(head);
    var body = renderBody(todo.comment);
    body.setAttribute("hidden", "hidden");
    card.appendChild(body);

    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", open ? "false" : "true");
      if (open) body.setAttribute("hidden", "hidden");
      else body.removeAttribute("hidden");
    });
    return card;
  }

  /**
   * The board, and the float layer.
   *
   * ## "Pick up and move" is a MOVE, not a drag
   *
   * The spec says the reader picks a sticky up off the panel and fixes it to
   * the page. A pointer drag cannot be operated from a keyboard without
   * reimplementing the whole interaction -- arrow-key nudging, a grab mode, an
   * escape hatch -- and this instance's declared interaction profile is
   * low-dexterity, where a drag is the single worst control to depend on.
   *
   * So the gesture is a BUTTON: Pin lifts the sticky onto the page, Close
   * returns it. It is one keystroke either way, it needs no pointer at all,
   * and nothing about it is harder with a mouse than a drag would have been.
   * Drag can be added ON TOP later as an accelerator; it must not be the only
   * way in.
   *
   * ## A floating sticky is greyed on the board, not removed from it
   *
   * The owner's words: "when floating, they are greyed out on sticky panel but
   * can also return the sticky note by clicking disabled." So the board keeps
   * every sticky in a stable position -- a list that reflows when you pin one
   * makes the next one you want move under your cursor -- and the greyed entry
   * is a real button that docks it again.
   */
  /**
   * THE GLASS — the reader's folio, pulled down over whatever they are
   * browsing. R25: *"the user in visualization should be able to pull down
   * their folio."*
   *
   * ## Why this is its own function, and what the move cost before it
   *
   * The layer already existed and was already `document.body`'s, fixed to the
   * viewport — structurally a glass. It was created INSIDE `mountTodoBoard`,
   * after two guards that have nothing to do with a glass:
   *
   *   mountTodoStickies -> fetchTodoIndex -> `if (items === null) return`
   *   mountTodoBoard    -> `if (!main) return null`   (#main-content / main)
   *
   * So the folio existed only on a page that had a just-the-docs main region
   * AND a readable todo index. A `who-iris` replica page has neither — its
   * own `<style>`, no Jekyll, no `<main>` — which is why bean `jpjt` measured
   * `docs-ui.js` 0 / boards 0 / tiles 0 there and concluded F8/F9 was blocked
   * on this. **A folio that only exists where a board mounted is not a folio
   * a reader carries between libraries.**
   *
   * ## Idempotent, and it returns the SAME layer the board floats into
   *
   * Called from `init` before anything else and again by `mountTodoBoard`.
   * One layer or the glass and the board would be two surfaces that agree
   * only by accident — the shape `harness-tiles` calls two registries.
   *
   * ## An empty glass still comes down
   *
   * `.fa-sticky-layer:empty { display: none }` hides a layer with no children,
   * which is right for a float layer and wrong for a glass: "nothing on your
   * glass" and "the glass is broken" are opposite facts, and the first is a
   * state a reader reaches by tidying. The open glass therefore always holds
   * its own chrome, so it is never `:empty` while open.
   */
  /**
   * THE READER'S FOLIO — which assets are theirs, and which are on the glass.
   *
   * R30, bean `j2if`. Owner, 2026-09-21:
   *
   * > pulling down folio panel = glass/window on which stikcy notes/avatrs of
   * > materialized assets … are visualized. they can also be closed and
   * > returned to their homes (e.g. "back in library", matieral asset still
   * > in folio/ but not displayed, need to go back to the library and pull it
   * > out to folio display window)
   *
   * ## THREE states, and the middle one is the whole point
   *
   * | state | here | how it got there |
   * |---|---|---|
   * | in the library | **no entry at all** | the default |
   * | in the folio, not displayed | an entry with `shown: false` | the reader closed it |
   * | on the glass | an entry with `shown: true` | the reader pulled it out |
   *
   * `board-windows`: *"A two-state model — in the folio, or not — makes
   * closing a sticky and un-materialising an asset the same gesture. A reader
   * tidying their glass would then silently discard work, and would have no
   * way to tell that they had."*
   *
   * **So `close` sets a flag and NEVER removes the entry.** That is why the
   * store keys on an object rather than holding an array of ids the way
   * `fa:todos-discarded` does: with an array, "closed" and "never pulled out"
   * are the same absence, and the middle state cannot be represented at all.
   * The data shape enforces the rule rather than the call sites remembering
   * it.
   *
   * ## The way back is from the LIBRARY, and that is checkable
   *
   * *"Putting it back on the glass is a separate act performed from the
   * library — not from the glass it just left."* So `shelve` is called by the
   * glass and `display` only ever by a library row. `l4zi` one level out: the
   * inverse of close must be reachable, and here it is reachable from a
   * DIFFERENT SURFACE than the one that closed it. The thing to check when
   * implementing close is that the library offers the way back.
   *
   * ## It is per-viewer and per-browser, and the UI says so
   *
   * A published page cannot write to the repository, so this is
   * `localStorage`, exactly like the reading preferences and the discarded
   * todos. The rule that mechanism already states applies unchanged and is
   * the reason it is restated here: *"A reader who thinks they have cleared a
   * todo for the team when they have cleared it for themselves has been
   * misled by the control, and that is a worse failure than not having the
   * control."*
   *
   * Every read and write is wrapped. `localStorage` throws in a private
   * window and returns null with site data cleared, and a folio that threw
   * would take the whole page's scripts with it.
   */
  var FOLIO_KEY = "fa-folio-assets";

  /** Every entry this browser holds, as `{ "<instance>/<id>": {shown, title, href} }`. */
  function folioAssets() {
    try {
      var raw = localStorage.getItem(FOLIO_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_e) {
      return {};
    }
  }

  function setFolioAssets(map) {
    try {
      localStorage.setItem(FOLIO_KEY, JSON.stringify(map));
      return true;
    } catch (_e) {
      // Silence would be worse than a note nobody reads: the reader pulls an
      // asset onto their glass, reloads, and finds it gone with no reason.
      console.warn("docs-ui: the folio could not be saved (storage blocked); " +
                   "this applies to the current page view only.");
      return false;
    }
  }

  /** Which of the three states `key` is in. Never throws, never guesses. */
  function folioStateOf(key) {
    var e = folioAssets()[key];
    if (!e) return "library";
    return e.shown ? "glass" : "folio";
  }

  function announceFolio(key, state) {
    document.dispatchEvent(new CustomEvent("fa:folio-changed",
      { detail: { key: key, state: state } }));
  }

  /**
   * Put an asset on the glass. Called from a LIBRARY row — never from the
   * glass, which is the asymmetry the three-state rule is made of.
   */
  function displayInFolio(key, meta) {
    var all = folioAssets();
    all[key] = {
      shown: true,
      title: (meta && meta.title) || (all[key] && all[key].title) || key,
      // THROUGH `safeHref`, and the store holds only what survived it.
      // The value originates in a library page's `data-fa-library-href`,
      // which is authored markup rather than a composed path, so
      // `javascript:` is reachable here in a way it is not at the render
      // points `safe-url.ts` was written against. Default-deny: a refused
      // scheme becomes no link, which `el` renders by omitting the
      // attribute entirely — `pb04`, no link beats a link to nowhere.
      href: safeHref((meta && meta.href) || (all[key] && all[key].href)) || "",
      // THE AVATAR — a book's cover, or whatever picture the library row
      // declared (bean `zrvt`). Same boundary as `href`: it came from authored
      // markup and it will reach an attribute, so it goes through the same
      // default-deny check, and an absent picture is stored as "" rather than
      // guessed. The glass draws the item's kind avatar for "".
      avatar: safeHref((meta && meta.avatar) || (all[key] && all[key].avatar)) || "",
      // WHAT KIND of thing it is — `library` or `todos`, the avatar kinds
      // `avatars.css` already declares — so the glass can draw the kind avatar
      // when there is no picture, or when the reader chose kind avatars.
      kind: (meta && meta.kind) || (all[key] && all[key].kind) || "library",
      // A PINNED BLOCK's graph kind (`glossary`, `bpmn`, `fhir-instance`, ...)
      // and the page or document it came from (#982). Only a kind-shaped word
      // is kept: it reaches a `data-` attribute and picks a kind avatar.
      nodeKind: kindWord((meta && meta.nodeKind) || (all[key] && all[key].nodeKind)),
      source: String((meta && meta.source) || (all[key] && all[key].source) || "").replace(/\s+/g, " ").trim(),
    };
    setFolioAssets(all);
    announceFolio(key, "glass");
  }

  /** A graph kind as a safe word, or "" (it reaches an attribute and a CSS selector). */
  function kindWord(v) {
    var w = String(v || "").trim().toLowerCase();
    return /^[a-z0-9][a-z0-9:_-]{0,63}$/.test(w) ? w : "";
  }

  /**
   * LIVE WINDOWS FOR PINNED BLOCKS, ONE LAZY VIEWER PER GRAPH KIND (#985).
   *
   * Owner, 2026-11-02 (bean `fbmk`): *"lazy load all visualizers ... can be a
   * lot if lots of different item types"*.
   *
   * Each graph kind registers `{ load, render }` with
   * `window.faFolio.viewer(kind, { load: () => import(url), render(node, el) })`.
   * Registering NEVER calls `load()`. When the reader opens a pinned block's
   * window on the glass (and only while that card is not zoomed to its avatar),
   * `load()` runs at most once for that kind and its promise is shared across
   * every open card of the same kind. Closed link cards and avatar-zoomed cards
   * load nothing.
   */
  var folioViewers = {};
  var folioViewerLoads = {};

  function defaultFolioRender(node, host) {
    var dl = el("dl", { class: "fa-glass-window-meta" });
    function row(k, v) {
      if (!v) return;
      dl.appendChild(el("dt", null, k));
      dl.appendChild(el("dd", null, v));
    }
    row("Title", node.title);
    row("Kind", node.nodeKind || node.kind);
    row("Source", node.source);
    row("ID", node.id);
    host.appendChild(dl);
    if (node.href) {
      host.appendChild(el("p", { class: "fa-glass-window-link" },
        el("a", { href: safeHref(node.href) }, "Open on page \u2192")));
    }
  }
  folioViewers["*"] = { load: null, render: defaultFolioRender };

  function registerFolioViewer(kind, spec) {
    var k = kind === "*" ? "*" : kindWord(kind);
    if (!k || !spec || typeof spec.render !== "function") return;
    folioViewers[k] = {
      load: typeof spec.load === "function" ? spec.load : null,
      render: spec.render,
    };
    delete folioViewerLoads[k];
    if (glassLayer && glassLayer.isConnected) {
      Array.prototype.forEach.call(
        glassLayer.querySelectorAll('.fa-glass-asset[data-fa-window="open"]'),
        function (card) {
          var ck = card.getAttribute("data-fa-node-kind") || card.getAttribute("data-fa-asset-kind") || "";
          if ((k === "*" || ck === k) && typeof card.__faOpenWindow === "function") {
            card.__faOpenWindow();
          }
        }
      );
    }
  }

  function loadFolioViewer(kind) {
    var k = kindWord(kind);
    var cacheKey = k && folioViewers[k] ? k : "*";
    var v = folioViewers[cacheKey];
    if (!v) return Promise.resolve(null);
    if (!folioViewerLoads[cacheKey]) {
      folioViewerLoads[cacheKey] = Promise.resolve()
        .then(function () { return v.load ? v.load() : null; })
        .then(
          function (mod) { return { viewer: v, mod: mod }; },
          function (err) { delete folioViewerLoads[cacheKey]; throw err; }
        );
    }
    return folioViewerLoads[cacheKey];
  }

  /**
   * Take it off the glass. THE ENTRY STAYS — it is still the reader's, and
   * removing it here is precisely the defect the middle state exists to
   * prevent. There is deliberately no `forgetFolioAsset` beside this:
   * un-adopting an asset is a different act with a different consequence, and
   * a function named next to this one would be called by mistake.
   */
  function shelveFromGlass(key) {
    var all = folioAssets();
    if (!all[key]) return;          // never the reader's; nothing to shelve
    all[key].shown = false;
    setFolioAssets(all);
    announceFolio(key, "folio");
  }

  /**
   * Where an asset sits ON the glass — this reader's, in this browser.
   *
   * Stored on the folio entry rather than in a second map, so an asset and
   * its place cannot disagree about whether the asset exists. DOES NOT
   * announce: announcing repaints the glass, and a repaint in the middle of
   * a move would rebuild the card under the reader's pointer and drop their
   * focus. A position is not a change of state.
   */
  function placeOnGlass(key, geom) {
    var all = folioAssets();
    if (!all[key]) return;
    // NO CLAMP AT ZERO. Owner, 2026-09-24: *"you shoud be able to put things
    // on folio w/ x,y <0"*. The glass pans (`b8eq`), so a negative place is a
    // place, and Home and Tidy are how a reader gets it back in view. A store
    // that clamped would move the card on the next page load, and the reader
    // would find it somewhere they never put it.
    all[key].geom = {
      left: Math.round(geom.left),
      top: Math.round(geom.top),
      width: Math.round(geom.width),
      height: Math.round(geom.height),
    };
    setFolioAssets(all);
  }

  /** Forget every position, so the glass lays itself out again. Nothing leaves the folio. */
  function tidyGlass() {
    var all = folioAssets();
    Object.keys(all).forEach(function (k) { delete all[k].geom; });
    setFolioAssets(all);
    announceFolio("*", "tidied");
  }

  /**
   * THE LIBRARY'S HALF: pull an item out onto the glass, and put it back.
   *
   * `board-windows`, R30: *"Putting it back on the glass is a separate act
   * performed FROM the library — not from the glass it just left."*
   *
   * That sentence is why this exists as its own mount rather than as a
   * control on the glass. It is `l4zi` one level out, and the skill says
   * exactly where it is easy to get wrong: *"When you implement close, the
   * thing to check is that the library offers the way back — not that the
   * glass does."* So the check on this code is not that the button works; it
   * is that a reader who closed something can find it again HERE.
   *
   * ## A row declares itself
   *
   * A library page marks each row `data-fa-library-item="<instance>/<id>"`
   * with a `data-fa-library-title`. Nothing is inferred from the DOM shape:
   * a selector guessing at table cells would bind to one generator's markup
   * and break silently when it changed, which is the mechanical half of
   * `check-invocation-parity`'s lesson.
   *
   * A page with no such rows mounts nothing at all — the guard every other
   * mount here uses, and the reason loading `docs-ui.js` on a replica page is
   * safe.
   */
  function mountLibraryPullouts() {
    // ONE listener each, on `document`, rather than a pair per row.
    //
    // The first version registered `document.addEventListener` inside the
    // per-row loop. With this file's own 18 specs that is correct and
    // bounded, because their fixture rows are static -- and the real library
    // view is NOT: `gen-library-viz` renders rows client-side and replaces
    // them WHOLESALE on every filter keystroke and every sort
    // (`$("listing").innerHTML = ...`). Each re-render would destroy the rows
    // and leave their listeners attached, closing over detached elements,
    // unbounded in the number of keystrokes. Bean `ebvl`.
    //
    // The specs could not have caught it: the shape that makes it a leak
    // never occurs in a fixture with no re-render. So the fix is structural
    // -- delegation cannot grow with the row count -- rather than a rule to
    // remember when adding the next control.
    if (document.__faPulloutsMounted) return;
    document.__faPulloutsMounted = true;

    document.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest(".fa-pullout");
      if (!btn) return;
      var row = btn.closest("[data-fa-library-item]");
      if (!row) return;
      displayInFolio(row.getAttribute("data-fa-library-item"), {
        title: row.getAttribute("data-fa-library-title") || row.getAttribute("data-fa-library-item"),
        href: safeHref(row.getAttribute("data-fa-library-href") || undefined) || "",
        avatar: safeHref(row.getAttribute("data-fa-library-avatar") || undefined) || "",
        kind: row.getAttribute("data-fa-library-kind") || "library",
      });
      // `displayInFolio` already fired `fa:folio-changed`, which repaints.
    });

    // Rows appear AFTER this runs, and again after every re-render, so the
    // decoration cannot be a one-shot pass at init. Observing the document
    // keeps the generated page ignorant of the folio: it emits attributes
    // and calls nothing.
    // THE OBSERVER MUST NOT SEE ITS OWN WORK. `paintLibraryRows` appends a
    // slot and writes `textContent`, both of which are `childList`
    // mutations, so an unguarded observer re-enters immediately and never
    // returns -- measured, not feared: the spec run hung and had to be
    // killed. Disconnect around the paint and reconnect after, which is the
    // only form that cannot loop regardless of what the paint does next.
    if (typeof MutationObserver === "function") {
      var observing = false;
      var obs = new MutationObserver(function () {
        if (observing) return;
        repaint();
      });
      var repaint = function () {
        observing = true;
        obs.disconnect();
        try {
          paintLibraryRows();
        } finally {
          obs.observe(document.body, { childList: true, subtree: true });
          observing = false;
        }
      };
      repaint();
      // The folio changing is not a DOM mutation, so it needs its own way in
      // -- and it must go through `repaint` rather than straight to the
      // paint, or the paint's own mutations reach a connected observer.
      document.addEventListener("fa:folio-changed", repaint);
      document.__faRepaintLibraryRows = repaint;
    } else {
      document.addEventListener("fa:folio-changed", paintLibraryRows);
      paintLibraryRows();
    }
  }

  /**
   * Give every library row its control and its state word.
   *
   * Idempotent and cheap to re-run: a row that already carries its slot is
   * repainted rather than rebuilt, so the observer firing on unrelated DOM
   * changes costs an attribute read per row and nothing else.
   */
  function paintLibraryRows() {
    var rows = document.querySelectorAll("[data-fa-library-item]");
    Array.prototype.forEach.call(rows, function (row) {
      var key = row.getAttribute("data-fa-library-item");
      var title = row.getAttribute("data-fa-library-title") || key;
      var slot = row.querySelector(".fa-pullout-slot");
      if (!slot) {
        slot = el("span", { class: "fa-pullout-slot" });
        slot.appendChild(el("button", { type: "button", class: "fa-pullout" }));
        slot.appendChild(el("span", { class: "fa-pullout-state" }));
        // WHERE IT GOES, in order: the host the row DECLARES
        // (`data-fa-pullout-host`), then the row's FIRST cell, then the row.
        //
        // It used to be the LAST cell, and that is issue #1006: on a table
        // wider than the screen the last cell is past the right edge, so the
        // owner looked at a library with their glass down and asked *"how do
        // i get stuff from library onto glass?"* — the control existed and
        // could not be seen. The first cell is where a reader's eye starts.
        //
        // A TABLE ROW takes no `<span>` child -- the browser hoists it out of
        // the table entirely, which is how a control disappears while the
        // markup looks right. So never the row itself when it is a `<tr>`.
        var host = row.querySelector("[data-fa-pullout-host]");
        if (!host) {
          var cell = row.firstElementChild;
          host = cell && cell.tagName === "TD" ? cell : row;
        }
        host.appendChild(slot);
      }
      var btn = slot.querySelector(".fa-pullout");
      var note = slot.querySelector(".fa-pullout-state");
      var state = folioStateOf(key);
      row.setAttribute("data-fa-folio-state", state);
      if (state === "glass") {
        // NOT a close control. Closing happens on the glass; offering it here
        // as well would make the same asset closeable from two surfaces and
        // leave "where does this go" answered twice.
        btn.hidden = true;
        note.textContent = "On your folio glass";
      } else if (state === "folio") {
        // THE WAY BACK, and the whole reason this mount exists.
        btn.hidden = false;
        btn.textContent = "Put back on glass";
        btn.setAttribute("aria-label", "Put " + title + " back on your folio glass");
        note.textContent = "In your folio, not displayed";
      } else {
        btn.hidden = false;
        btn.textContent = "Pull out to folio";
        btn.setAttribute("aria-label", "Pull " + title + " out to your folio glass");
        note.textContent = "";
      }
    });
  }

  /* ═══ THE READER'S GLASS SETTINGS ═════════════════════════════════════
   *
   * Bean `zrvt`, issue #1006. Owner, 2026-09-23: *"tile to change folio
   * settings (like background theme=now is glass theme, need usabiltiy themes
   * some may want exisritng new avatars. should be able to set opactiy"*, and
   * then *"start with the glass being 20% opaque with a blur effect"*.
   *
   * PER-VIEWER, like `fa-reading-prefs`: a reader's glass is theirs, and a
   * published page cannot write anything anybody else reads. Every read and
   * write is wrapped for the same reason the folio store's are.
   *
   * A THEME CARRIES ITS OWN STARTING OPACITY. "High contrast" at 20% would be
   * a contradiction in its own name, so choosing a theme moves the opacity to
   * that theme's value; the reader can still move it afterwards. The default
   * is the owner's: the glass theme, 20%, blurred.
   */
  var GLASS_PREFS_KEY = "fa-glass-prefs";
  var GLASS_THEMES = [
    // Each carries a jewelled purple pattern (owner, 2026-09-24: "Mix, per
    // theme"), and the hint names the sticky themes it suits. Contrast
    // stays plain: it is the usability theme.
    { id: "glass", label: "Glass", hint: "amethyst facets, see-through and blurred — suits Analyst, Operations", opacity: 20 },
    { id: "contrast", label: "High contrast", hint: "black and white, strong outlines, no pattern", opacity: 100 },
    { id: "paper", label: "Paper", hint: "iris haze, light and nearly solid — suits Pale sage, Dusty Carolina blue", opacity: 92 },
    { id: "night", label: "Night", hint: "opal night, dark and nearly solid", opacity: 92 },
    { id: "rose", label: "Rose window", hint: "cathedral stained glass — suits Library, Grumpy cat", opacity: 30 },
    { id: "leaded", label: "Leaded grid", hint: "modern stained glass panes — suits Architecture, Engineer", opacity: 30 },
  ];
  var GLASS_AVATAR_STYLES = [
    { id: "pictures", label: "Pictures", hint: "a book's cover, else its kind avatar" },
    { id: "kinds", label: "Kind avatars", hint: "each kind's avatar, never a picture" },
    { id: "text", label: "Text only", hint: "no pictures at all" },
  ];
  var GLASS_DEFAULTS = { theme: "glass", avatars: "pictures", opacity: 20, blur: true };

  function glassPrefs() {
    var p = { theme: GLASS_DEFAULTS.theme, avatars: GLASS_DEFAULTS.avatars,
              opacity: GLASS_DEFAULTS.opacity, blur: GLASS_DEFAULTS.blur };
    try {
      var raw = JSON.parse(localStorage.getItem(GLASS_PREFS_KEY) || "{}") || {};
      if (GLASS_THEMES.some(function (t) { return t.id === raw.theme; })) p.theme = raw.theme;
      if (GLASS_AVATAR_STYLES.some(function (a) { return a.id === raw.avatars; })) p.avatars = raw.avatars;
      if (typeof raw.opacity === "number" && isFinite(raw.opacity)) {
        p.opacity = Math.max(0, Math.min(100, Math.round(raw.opacity)));
      }
      if (typeof raw.blur === "boolean") p.blur = raw.blur;
    } catch (_e) { /* defaults */ }
    return p;
  }

  function setGlassPrefs(p) {
    try { localStorage.setItem(GLASS_PREFS_KEY, JSON.stringify(p)); } catch (_e) {
      console.warn("docs-ui: glass settings could not be saved (storage blocked); " +
                   "they apply to this page view only.");
    }
  }

  /** Paint the settings onto the layer. CSS reads the attributes and the one custom property. */
  function applyGlassPrefs(layer, p) {
    layer.setAttribute("data-fa-glass-theme", p.theme);
    layer.setAttribute("data-fa-glass-avatars", p.avatars);
    layer.setAttribute("data-fa-glass-blur", p.blur ? "on" : "off");
    layer.style.setProperty("--fa-glass-opacity", String(p.opacity / 100));
    // The handle wears the SAME stained glass as the layer (owner,
    // 2026-09-27: "appropriate theme stained glass, not solid purple"). It is
    // a sibling of the layer, not a child, so the theme is mirrored onto it.
    var h = document.querySelector(".fa-glass-handle");
    if (h) h.setAttribute("data-fa-glass-theme", p.theme);
  }

  /**
   * `avatars.css` on a page that did not load it — a replica page loads
   * `docs-ui.css` alone. The kind avatars are declared THERE, once, and the
   * glass borrows them rather than drawing a second set.
   */
  function ensureAvatarsCss() {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      if (/\/avatars\.css(\?|$)/.test(links[i].getAttribute("href") || "")) return;
    }
    document.head.appendChild(el("link", {
      rel: "stylesheet",
      href: safeHref(pinnedData("/assets/css/avatars.css")),
      "data-fa-glass-avatars-css": "",
    }));
  }

  /**
   * `themes.css` on a page that did not load it, for the same reason as
   * `avatars.css` above. A replica (who-iris) loads `docs-ui.css` alone, so a
   * themed todo on its glass had the theme's art but NOT its scrim or ink:
   * `--fa-sticky-scrim` is declared in `themes.css`, and without it the
   * backdrop fell back to an 8% grey and the picture sat unfaded behind the
   * text (owner, 2026-09-27: "it should be faded for legibility").
   */
  function ensureThemesCss() {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      if (/\/themes\.css(\?|$)/.test(links[i].getAttribute("href") || "")) return;
    }
    document.head.appendChild(el("link", {
      rel: "stylesheet",
      href: safeHref(pinnedData("/assets/css/themes.css")),
      "data-fa-glass-themes-css": "",
    }));
  }

  /** The declared kind avatar for `kind`, from `avatars.css`. */
  function kindAvatar(kind) {
    return el("span", {
      class: "fa-avatar fa-glass-kind-avatar",
      "data-fa-kind": kind || "library",
      "aria-hidden": "true",
    });
  }

  /**
   * A TODO'S AVATAR IS A STICKY NOTE — owner, 2026-09-23: *"todos should have
   * stick note avatar"* (bean `b8eq`, issue #1154).
   *
   * The declared `todos` kind glyph is a thin outline of a note, drawn as a
   * MASK in the accent colour — right for a navbar icon, and nearly invisible
   * filling a card on a 20%-opaque glass. A todo IS a sticky note everywhere
   * else on this site, so on the glass it is drawn as one: a yellow square
   * with a folded corner and ruled lines. Built from CSS alone — no asset to
   * 404, nothing to fetch.
   *
   * Decorative: the card's name carries the words, so this is `aria-hidden`.
   */
  function stickyNoteAvatar() {
    var n = el("span", { class: "fa-sticky-note-avatar", "data-fa-kind": "todos", "aria-hidden": "true" });
    n.appendChild(el("span", { class: "fa-sticky-note-lines" }));
    return n;
  }

  /** The avatar an item falls back to with no picture: a note for a todo, the kind glyph otherwise. */
  function fallbackAvatar(kind) {
    return kind === "todos" || kind === "sticky" ? stickyNoteAvatar() : kindAvatar(kind);
  }

  /**
   * An asset's avatar on the glass, honouring the reader's avatar style.
   * A picture that fails to load becomes the kind avatar — never a broken
   * image, which reads as "something failed" where the truth is "no picture".
   */
  function glassAvatarFor(a, style) {
    if (style === "text") return null;
    var box = el("span", { class: "fa-glass-avatar", "aria-hidden": "true" });
    var src = style === "pictures" ? safeHref(a.avatar) : "";
    if (src) {
      var img = el("img", { src: src, alt: "", loading: "lazy" });
      img.addEventListener("error", function () {
        if (img.parentNode) img.parentNode.replaceChild(fallbackAvatar(a.kind), img);
      });
      box.appendChild(img);
    } else {
      // A pinned block with no picture draws ITS GRAPH KIND's avatar.
      // A bookmark with no cover draws the `docs` kind: it marks a place in a document.
      box.appendChild(fallbackAvatar(a.kind === "pin" && kindWord(a.nodeKind) ? kindWord(a.nodeKind)
        : a.kind === "bookmark" ? "docs" : a.kind));
    }
    return box;
  }

  /**
   * The todo index's address. The declared meta when the page has one, and
   * otherwise the published index under the site root — a replica page
   * carries no meta, and the todos are the harness's, not the page's.
   */
  function todoIndexUrl() {
    var m = document.querySelector('meta[name="fa-todo-src"]');
    var v = m && m.getAttribute("content");
    return v || withBase("/assets/todos/index.json");
  }

  /** The declared tiles: the page's meta, else the published copy. `done(null)` when neither is readable. */
  function glassTileList(done) {
    var fromMeta = declaredTilesFromMeta();
    if (fromMeta) return done(fromMeta);
    fetch(pinnedData("/assets/harness/tiles.json"))
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (t) { done(Array.isArray(t) ? t : null); })
      .catch(function (e) {
        console.warn("docs-ui: the glass could not read its tiles (" + e.message + ").");
        done(null);
      });
  }

  /**
   * Where the handle lives: FIXED AT THE TOP CENTRE of the viewport, as a
   * short pill. Owner, 2026-09-27: *"i want purple folio button, not on
   * navbar but at top middle of display screen. not so tall"*.
   *
   * This reverses the 2026-09-24 placement in the left navbar (bean `269z`),
   * which rendered as a tall purple block with only a ▾ in the strip. The
   * overlap that placement was solving (a viewer's h1, `015u`; a replica's
   * banner, `269z`) is answered by HEIGHT instead: the pill is about 1.75rem
   * tall, and viewers still reserve its band in `docs-ui.css`.
   */
  function placeHandle(handle) {
    document.body.appendChild(handle);
    placeHandleBand(handle);
  }

  /**
   * THE HANDLE'S BAND, while the page is scrolled — issue #1693.
   *
   * At the top of a page the handle sits in space nobody reads: the theme
   * header's empty middle, or the band a viewer or replica reserves with
   * padding (`015u`, `g9r2`). Once the page scrolls, that space has gone and
   * the handle, still fixed, sat over the middle of a body line. Measured on
   * `platform.html` at 1280x900: the handle crossed a text line at 9 of 21
   * scroll positions. The line stayed readable either side of it, and a link
   * centred under it opened the glass instead.
   *
   * So while the page is scrolled, an opaque strip the handle's own height
   * runs across the content column behind it. Text scrolls UNDER the strip,
   * the way it scrolls under any sticky bar, rather than past the pill with
   * its middle missing. `scroll-padding-top` in `docs-ui.css` keeps an anchor
   * jump or a focus scroll from landing a target under the strip.
   *
   * Chosen over the issue's other two options on evidence and on the owner's
   * word. Hiding the handle on scroll-down still overlaps on scroll-up, the
   * moment it reappears. Docking it in the side bar is the 2026-09-24
   * placement the owner reversed on 2026-09-27: "not on navbar but at top
   * middle of display screen".
   *
   * The handle itself is untouched: same button, same place, same tab stop
   * and accessible name. The strip is decoration, `aria-hidden`, and absent
   * from the tab order. It sits BELOW the glass layer, so an open glass is
   * unchanged, and it starts at a FIXED side bar's right edge, so it never
   * covers the side bar's own controls.
   */
  function placeHandleBand(handle) {
    var band = glassBand();
    // A band that already holds the page's controls is in the content column
    // and sticky by its stylesheet; only the bare strip goes beside the handle.
    if (!band.hasAttribute("data-fa-band-tools")) document.body.insertBefore(band, handle);
    var queued = false;
    function update() {
      queued = false;
      if (!handle.isConnected) return;
      if (band.hasAttribute("data-fa-band-tools")) return;
      var on = (window.scrollY || document.documentElement.scrollTop || 0) > 0;
      if (!on) { band.hidden = true; return; }
      var hb = handle.getBoundingClientRect();
      var left = 0;
      var side = document.querySelector(".side-bar");
      if (side && getComputedStyle(side).position === "fixed") {
        var sb = side.getBoundingClientRect();
        // Only a side bar docked to the LEFT edge and narrower than the page.
        // Its RESTING edge, which is where the page content starts: hovered
        // or focused, `.side-bar` widens to the open nav (264 px) OVER the
        // content, and above this band (z-index 100 against 89). Taking that
        // edge left the text between the rail and 264 px readable beside the
        // handle -- CI's Chrome rests the pointer on the rail (#1693).
        if (sb.left <= 0 && sb.right < window.innerWidth / 2) {
          var main = side.nextElementSibling;
          var content = main && main.classList.contains("main") ? main.getBoundingClientRect().left : sb.right;
          var collapsedRaw = getComputedStyle(document.documentElement).getPropertyValue("--fa-nav-collapsed");
          var collapsedPx = 0;
          if (collapsedRaw) {
            var val = parseFloat(collapsedRaw);
            if (collapsedRaw.indexOf("rem") !== -1) {
              var rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
              collapsedPx = val * rootFs;
            } else if (collapsedRaw.indexOf("px") !== -1) {
              collapsedPx = val;
            }
          }
          var resting = collapsedPx > 0 ? collapsedPx : Math.min(sb.right, content);
          left = Math.max(0, Math.min(sb.right, content, resting));
        }
      }
      band.style.top = hb.top + "px";
      band.style.height = hb.height + "px";
      band.style.left = left + "px";
      band.hidden = false;
      // The COLOUR is the stylesheet's (`inline-colour.test.ts`): the band
      // inherits body's background. A page whose body paints none (a replica
      // may leave it to `html`) would get a see-through band, so that case is
      // MARKED here and coloured by a scheme token in `docs-ui.css`.
      var own = getComputedStyle(band).backgroundColor;
      var clear = !own || own === "transparent" || /rgba\([^)]*,\s*0\)$/.test(own);
      if (clear) band.setAttribute("data-fa-band-fallback", "");
      else band.removeAttribute("data-fa-band-fallback");
    }
    function queue() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    }
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    update();
  }

  /**
   * THE BAND HOLDS THE PAGE'S OWN CONTROLS — issue #2201.
   *
   * Owner, 2026-10-05: *"ideally, the search and the locale selector both
   * live in the fa-glass-band, so they are always on the page, at least
   * partially. While a fa-glass-band item is in use, the Folio tab hides so
   * it doesn't block them."*
   *
   * Before this the three were in three places: the magnifier floated at the
   * display panel's inline-end, the locale bar under the first heading, the
   * band a decorative strip behind the handle that existed only while the
   * page was scrolled. Opening search turned the floated magnifier into a
   * full-width row, which cleared the float and pushed the locale bar onto
   * the next line (y=96 to y=164 on the gh-pages `smart-trust/index.html` at
   * 1280px).
   *
   * Now there is ONE row: the band, `position: sticky` at the top of the
   * display panel with two slots, the locale selector at the inline-start and
   * search at the inline-end. At rest it is the panel's first line; scrolled,
   * it sticks at the handle's offset, so it is still the opaque strip the
   * handle sits on (#1693), and its controls are on screen at every scroll
   * position (#1732).
   *
   * TWO MODES, and the second is the old one unchanged. A page with none of
   * these controls (a replica, a viewer, a fixture) keeps the bare strip that
   * `placeHandleBand` shows behind the handle only while scrolled, so its
   * resting layout gains no empty row. The first control to arrive moves the
   * band into the content column and marks it `data-fa-band-tools`, which
   * `placeHandleBand`'s update then leaves alone.
   *
   * Mounted where the magnifier was: `.main-content-wrap`, never hidden by
   * the theme (`.main-header` is, below its nav breakpoint, which once made
   * search 0x0 at 700px). The fallbacks put it in the wrong place rather
   * than nowhere.
   */
  var glassBandEl = null;
  function glassBand() {
    if (glassBandEl) return glassBandEl;
    glassBandEl = el("div", { class: "fa-glass-band", "aria-hidden": "true", hidden: "" });
    glassBandEl.appendChild(el("div", { class: "fa-band-slot fa-band-start" }));
    glassBandEl.appendChild(el("div", { class: "fa-band-slot fa-band-end" }));
    return glassBandEl;
  }

  /**
   * Is this a REPLICA, which reserves the handle's 2.25rem strip at the top of
   * body? The marker `docs-ui.css` keys that padding on (`g9r2`), so the
   * overlay and the space it sits in cannot disagree. Viewers reserve the same
   * strip by another marker but are out of this bean's scope (`uvt0`).
   */
  function reservesHandleBand() {
    return !!document.querySelector("script[data-fa-folio-mount]");
  }

  /** The band's `start` or `end` slot, moving the band into the panel the first time. */
  function glassBandSlot(which) {
    var band = glassBand();
    if (!band.hasAttribute("data-fa-band-tools")) {
      band.setAttribute("data-fa-band-tools", "");
      // It holds controls now, so it is no longer decoration.
      band.removeAttribute("aria-hidden");
      band.setAttribute("role", "group");
      band.setAttribute("aria-label", "Page tools");
      band.hidden = false;
      // The strip mode's geometry, if it had run, is the stylesheet's now.
      band.style.top = "";
      band.style.height = "";
      band.style.left = "";
      band.removeAttribute("data-fa-band-fallback");
      var panelTop = firstMatch([".main-content-wrap", ".main-header", "#main-header"]);
      if (panelTop) panelTop.insertBefore(band, panelTop.firstChild);
      else if (reservesHandleBand()) {
        // A REPLICA: an OVERLAY, never a row in the flow
        // (bean `uvt0`, owner 2026-10-06: "Overlay, no shift"). These pages
        // already reserve a 2.25rem strip at the top of body for the handle
        // (`g9r2`, `015u`); the band's controls sit in that strip, fixed,
        // beside the handle. In the flow it pushed a replica's <main> 52px down.
        if (!band.parentNode || band.parentNode !== document.body) document.body.insertBefore(band, document.body.firstChild);
        band.setAttribute("data-fa-band-overlay", "");
      } else {
        var mainEl = firstMatch(["#main-content", ".main-content", "main"]);
        if (mainEl && mainEl.parentNode) mainEl.parentNode.insertBefore(band, mainEl);
        else document.body.insertBefore(band, document.body.firstChild);
      }
    }
    return band.querySelector(".fa-band-" + which);
  }

  /*
   * ONE BAND ITEM OPEN AT A TIME. Each item registers how to close itself;
   * opening one closes the others, so an open locale list never squeezes an
   * open search field to nothing on a phone. Closing never discards: search
   * keeps its text, because closing it is `display: none` on the holder.
   *
   * The open item is written to `<html data-fa-band-active>`, which is what
   * hides the Folio handle (`docs-ui.css`) — the owner's *"the Folio tab
   * hides so it doesn't block them"*. On the root, so the rule is one
   * attribute selector and needs no knowledge of where either control is.
   */
  var glassBandItems = {};
  function glassBandItem(name, close) { glassBandItems[name] = close; }
  function glassBandActive(name, open) {
    var root = document.documentElement;
    if (open) {
      Object.keys(glassBandItems).forEach(function (other) {
        if (other !== name && root.getAttribute("data-fa-band-active") === other) glassBandItems[other]();
      });
      root.setAttribute("data-fa-band-active", name);
    } else if (root.getAttribute("data-fa-band-active") === name) {
      root.removeAttribute("data-fa-band-active");
    }
  }

  var glassLayer = null;
  function mountGlass() {
    if (glassLayer && glassLayer.isConnected) return glassLayer;

    // ENGLISH AT THE ROOT (bean `giiw`). Everything on the glass — its sheet,
    // panels, tile strip, zoom and move bars, and the todos and library items
    // pulled onto it — is authored in English and translated by no locale.
    var layer = chromeText(el("div", {
      class: "fa-sticky-layer",
      "aria-live": "polite",
      "data-fa-glass": "closed",
    }));
    document.body.appendChild(layer);
    glassLayer = layer;
    var prefs = glassPrefs();
    applyGlassPrefs(layer, prefs);
    ensureAvatarsCss();
    ensureThemesCss();
    // THE ZOOM DECLARATION, for pages whose board never asked for it — a
    // replica page has no board and no `fa-zoom-src` meta. Asked once; absent
    // stays null, which keeps every card's words (see `zoomState`).
    if (!zoomState.zoom) {
      var zm = document.querySelector('meta[name="fa-zoom-src"]');
      var zurl = (zm && zm.getAttribute("content")) || pinnedData("/assets/semantic-zoom.json");
      fetch(zurl)
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (doc) {
          if (doc && typeof doc.belowPx === "number" && !zoomState.zoom) {
            zoomState.zoom = doc;
            Array.prototype.forEach.call(layer.querySelectorAll(".fa-glass-asset"), zoomGlassCard);
          }
        })
        .catch(function () { /* absent: every card keeps its words */ });
    }

    // The handle. A BUTTON, not a div with a click: the disclosure, the focus
    // ring and the keyboard path are the browser's, and this instance's
    // declared interaction profile is low-dexterity, so the way in is never a
    // pointer-only gesture.
    // "Folio ▾" is English too, and a sibling of the layer rather than inside
    // it, so it is marked on its own: on an Arabic page the mark and the word
    // swapped sides, unlike on every other locale (`giiw`).
    var handle = chromeText(el("button", {
      type: "button",
      class: "fa-glass-handle",
      "aria-expanded": "false",
      "aria-label": "Pull down your folio",
      title: "Pull down your folio",
    }));
    // A MARK and a LABEL, not one string, so the stylesheet can size the ▾
    // apart from the word. The accessible name is the aria-label.
    handle.appendChild(el("span", { class: "fa-glass-handle__mark", "aria-hidden": "true" }, "▾"));
    handle.appendChild(document.createTextNode(" "));
    handle.appendChild(el("span", { class: "fa-glass-handle__label" }, "Folio"));
    placeHandle(handle);
    applyGlassPrefs(layer, prefs);

    // The glass's own chrome, so an open glass is never `:empty`.
    var sheet = el("div", { class: "fa-glass-sheet", role: "region", "aria-label": "Your folio" });
    var empty = el("p", { class: "fa-glass-empty" },
      "Nothing on your folio glass yet. To add something: put your folio away, open a library, " +
      "and press “Pull out to folio” at the start of a row — or open Todos below.");
    sheet.appendChild(empty);
    layer.appendChild(sheet);

    /**
     * The assets the reader pulled out of a library, as closeable avatars.
     *
     * Separate from the float layer the board uses: a sticky the board floats
     * here belongs to THIS page, and an asset belongs to the READER and is on
     * every page they visit. Rendering them into one list would tell a reader
     * their page's stickies travel with them.
     */
    // `role="group"`: a NAME on a bare div is prohibited ARIA (axe
    // `aria-prohibited-attr`), found the first time axe measured an open
    // glass (`b8eq`). A group is what the shelf is — the cards, together.
    var shelf = el("div", { class: "fa-glass-shelf", role: "group", "aria-label": "Assets on your folio" });
    sheet.appendChild(shelf);
    var notes = el("div", { class: "fa-glass-notes" });
    sheet.appendChild(notes);

    /* ── A card ON the glass: placed, moved, sized, and zoomed ────────────
     *
     * The owner asked for the glass to be a SURFACE a note is placed on
     * (`pv6g`), not a list. So each card carries its own geometry, and moving
     * it is `wireMove` — the one implementation the board window and the
     * floating sticky already share: keyboard first (✥ enters move mode,
     * arrows move, Shift+arrows resize, Escape or Enter leaves), drag as the
     * accelerator. Size is a corner drag over the same keyboard path: in the
     * mode, + and − resize (Shift+arrow is a chord), and the move bar offers
     * them as buttons for the low-dexterity path (issue #1900 took the card's
     * own −/+ off it).
     *
     * ZOOM IS SEMANTIC AND AUTOMATIC: below the folio's DECLARED width for
     * the card's kind (`semantic-zoom.json`, via `rendersAvatar`), a card
     * shows its avatar alone. No literal here, and no declaration means the
     * card keeps its words at every size — `board-windows`: semantic zoom is
     * driven by size, and a person's act is only the size they chose. */
    var GLASS_CARD_W = 288;
    // Tall enough for the avatar (4.75rem) AND the tool row (2.75rem) with
    // padding. At 112 the cover overflowed the card's top edge and was
    // clipped — measured by the drag spec, whose press landed on the glass
    // behind a cover that was drawn outside its own card.
    var GLASS_CARD_H = 152;
    var GLASS_GAP = 12;
    var raiseAt = 1;

    // A pinned landing sticky (`sticky`) is a sticky note like a todo: square,
    // and zoomed by the same declared width (#1925).
    function zoomKindOf(a) {
      return a.kind === "todos" || a.kind === "sticky" ? "todo" : (a.kind || "library");
    }

    /** The size a card with no saved place starts at. */
    function defaultGlassSize(a) {
      var t = zoomThresholdFor(zoomKindOf(a));
      // A DEFAULT card never starts zoomed out: at least the declared width
      // plus a step, so the words show until the reader shrinks it.
      var w = t ? Math.max(GLASS_CARD_W, t.belowPx + RESIZE_STEP) : GLASS_CARD_W;
      // A BOOK IS PORTRAIT. The cover fills the card (owner, 2026-09-23:
      // *"artefact avatar should cover sheet"*), and a landscape card would
      // show a cover's middle band. 4:3 upright, which every rendered cover
      // here is near.
      // A STICKY IS SQUARE — owner, 2026-09-24: *"i expected to see themed
      // square sticky avatar"*. A todo is a sticky note everywhere else on
      // this site, and a sticky note is square; the wide 152px strip it used
      // to pop out as read as a list row, not as the note.
      // A BOOKMARK with its document's cover is portrait like the book it marks.
      var portrait = zoomKindOf(a) === "library" || (a.kind === "bookmark" && a.avatar);
      var h = portrait && prefs.avatars !== "text"
        ? Math.round(w * 4 / 3) : zoomKindOf(a) === "todo" ? w : GLASS_CARD_H;
      return { width: w, height: h };
    }

    /* WHERE CARDS WITH NO SAVED PLACE GO: a shelf, in key order, that
     * advances by each card's ACTUAL size. Issue #1780: each default place
     * used to be computed from the card's own size alone — a grid of its own
     * column width and row height — so a portrait library card (288×384) and
     * a square todo (324×324) placed together landed on each other. Now a
     * card goes right of the previous one, a row wraps when the next card
     * would pass the shelf's width, and the next row starts below the
     * tallest card of the last one.
     *
     * A card the READER placed is never moved: it is passed in as `fixed`,
     * and a default card that would land on one steps past it instead. */
    function glassPacker(fixed) {
      var avail = Math.max(GLASS_CARD_W, shelf.clientWidth || (window.innerWidth - 32));
      var x = 0, y = 0, rowH = 0;
      function hits(g) {
        for (var k = 0; k < fixed.length; k++) {
          var f = fixed[k];
          if (g.left < f.left + f.width + GLASS_GAP && f.left < g.left + g.width + GLASS_GAP &&
              g.top < f.top + f.height + GLASS_GAP && f.top < g.top + g.height + GLASS_GAP) return f;
        }
        return null;
      }
      function wrap() { x = 0; y += rowH + GLASS_GAP; rowH = 0; }
      return function next(size) {
        // Bounded: each step moves the cursor right or down past a card.
        for (var guard = 0; guard < 1000; guard++) {
          if (x > 0 && x + size.width > avail) wrap();
          var g = { left: x, top: y, width: size.width, height: size.height };
          var f = hits(g);
          if (!f) {
            x += size.width + GLASS_GAP;
            rowH = Math.max(rowH, size.height, GLASS_CARD_H);
            return g;
          }
          // Step past the reader's card; if that ends the row, the row is at
          // least as tall as the part of it this card would have shared.
          x = f.left + f.width + GLASS_GAP;
          if (x + size.width > avail) {
            rowH = Math.max(rowH, f.top + f.height - y);
            if (x > 0) wrap();
          }
        }
        return { left: 0, top: y, width: size.width, height: size.height };
      };
    }

    /** The shelf is as tall as its lowest card, so the notes and panel sit below the cards. */
    function fitShelf() {
      var bottom = 0;
      Array.prototype.forEach.call(shelf.querySelectorAll(".fa-glass-asset"), function (c) {
        var g = geometryOf(c);
        bottom = Math.max(bottom, g.top + g.height);
      });
      shelf.style.height = bottom ? bottom + GLASS_GAP + "px" : "";
    }

    function zoomGlassCard(card) {
      var kind = card.getAttribute("data-fa-zoom-kind");
      var w = card.getBoundingClientRect().width || parseFloat(card.style.width) || 0;
      var avatar = rendersAvatar(kind, w);
      card.setAttribute("data-fa-zoom", avatar ? "avatar" : "card");
      // The gist is clamped to the WHOLE lines its box holds, so the last
      // one shown ends in an ellipsis rather than being sliced through.
      // Both numbers are in the card's own (unscaled) pixels, so the ratio
      // is right at every view scale. Measured with the box GROWN to the room
      // it has, then let shrink to the clamped lines: a box left taller than
      // its clamp paints the lines after the ellipsis.
      var gist = card.querySelector(".fa-glass-asset-gist");
      if (gist && avatar) {
        gist.style.flex = "";
        var gcs = getComputedStyle(gist);
        var lh = parseFloat(gcs.lineHeight) || 0;
        var room = gist.clientHeight - (parseFloat(gcs.paddingTop) || 0) - (parseFloat(gcs.paddingBottom) || 0);
        var lines = lh ? Math.max(1, Math.floor((room + 1) / lh)) : 3;
        // A library card's gist is its TITLE, captioning the cover: two lines
        // at most, so the cover stays the face.
        if (kind === "library") lines = Math.min(lines, 2);
        gist.style.webkitLineClamp = String(lines);
        gist.style.lineClamp = String(lines);
        gist.style.flex = "0 1 auto";
      }
    }

    /* ── ZOOM AND PAN THE GLASS, AND SNAP BACK HOME ───────────────────────
     *
     * Owner, 2026-09-23 (bean `b8eq`, issue #1154): *"need to be able to zoom
     * in and out of folio and move it around (plus snap back to home). slider
     * and two finger."*
     *
     * ONE TRANSFORM ON THE SHELF, never a change to any card. A card's saved
     * left/top/width/height is where the READER put it; the view is how far
     * they are standing from the whole surface. Mixing the two would make
     * zooming out rewrite every card's geometry, and Home could not undo it.
     *
     * SEMANTIC ZOOM COMES FOR FREE, and that is the point of doing it this
     * way. `zoomGlassCard` measures a card's RENDERED width, which the scale
     * shrinks — so zooming out past the folio's declared threshold turns cards
     * into their avatars, exactly as the board promised (`6lb8`: *"switching
     * over to content avatars if content no longer legible"*).
     *
     * THREE WAYS IN, and only one of them is a gesture. The slider and the
     * −/+ buttons are the keyboard and low-dexterity path; a two-finger pinch
     * and a drag on empty glass are accelerators over it; Ctrl + wheel is a
     * laptop trackpad's pinch. Home is one press, always. */
    var VIEW_KEY = "fa-glass-view";
    var ZOOM_MIN = 25, ZOOM_MAX = 200, ZOOM_STEP = 10;
    function clampScale(v) { return Math.min(ZOOM_MAX / 100, Math.max(ZOOM_MIN / 100, v)); }
    function loadView() {
      try {
        var v = JSON.parse(localStorage.getItem(VIEW_KEY) || "null");
        if (v && isFinite(v.s) && isFinite(v.x) && isFinite(v.y)) return { s: clampScale(v.s), x: v.x, y: v.y };
      } catch (_e) { /* unreadable: start at home */ }
      return { s: 1, x: 0, y: 0 };
    }
    function saveView() {
      try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch (_e) { /* a view that resets next page is the safe failure */ }
    }
    var view = loadView();
    /* WHERE HOME IS, now that a card may sit left of or above the origin.
     *
     * Owner, 2026-09-24: *"you shoud be able to put things on folio w/ x,y
     * <0"*. Home used to be the origin, full stop — so a card the reader put
     * at x = −400 was still off the glass's left edge after Home, and the one
     * press that is meant to always find the folio did not find all of it.
     *
     * Home is now "100%, where your folio STARTS", and the folio starts at its
     * top-left-most card: the view shifts right and down just far enough to
     * bring that card's corner to the glass's corner. With every card at or
     * past the origin — the only case there was before — that shift is zero,
     * and Home is the origin exactly as it was. The cards' own places are
     * never touched; Tidy is the control that regrids them. */
    function homeView() {
      var minLeft = 0, minTop = 0;
      Array.prototype.forEach.call(shelf.querySelectorAll(".fa-glass-asset"), function (c) {
        // A card the reader's filter hides is not one Home should frame.
        if (c.hasAttribute("data-fa-filtered-out")) return;
        minLeft = Math.min(minLeft, parseFloat(c.style.left) || 0);
        minTop = Math.min(minTop, parseFloat(c.style.top) || 0);
      });
      return { s: 1, x: Math.round(-minLeft), y: Math.round(-minTop) };
    }
    function atHome() {
      var h = homeView();
      return view.s === 1 && view.x === h.x && view.y === h.y;
    }
    function atOrigin() { return view.s === 1 && view.x === 0 && view.y === 0; }

    var glassLive = el("p", { class: "fa-sr-only", "aria-live": "polite" });
    var zoomBar = el("div", { class: "fa-glass-zoom", role: "group", "aria-label": "Zoom and position of your folio" });
    var zoomOutBtn = el("button", { type: "button", class: "fa-glass-zoom-btn", "data-fa-zoom-control": "out",
      "aria-label": "Zoom out", title: "Zoom out" }, "−");
    var zoomSlider = el("input", { type: "range", class: "fa-glass-zoom-slider", id: "fa-glass-zoom",
      min: String(ZOOM_MIN), max: String(ZOOM_MAX), step: "5", "aria-label": "Zoom" });
    var zoomValue = el("output", { class: "fa-glass-zoom-value", for: "fa-glass-zoom" });
    var zoomInBtn = el("button", { type: "button", class: "fa-glass-zoom-btn", "data-fa-zoom-control": "in",
      "aria-label": "Zoom in", title: "Zoom in" }, "+");
    var homeBtn = el("button", { type: "button", class: "fa-glass-zoom-btn fa-glass-home",
      "data-fa-zoom-control": "home",
      "aria-label": "Snap back home — 100%, where your folio starts",
      title: "Home: 100%, where your folio starts" }, "⌂ Home");
    zoomBar.appendChild(zoomOutBtn);
    zoomBar.appendChild(zoomSlider);
    zoomBar.appendChild(zoomValue);
    zoomBar.appendChild(zoomInBtn);
    zoomBar.appendChild(homeBtn);
    sheet.insertBefore(zoomBar, empty);
    sheet.appendChild(glassLive);

    function applyView() {
      shelf.style.transformOrigin = "0 0";
      // No transform at the ORIGIN, rather than at home: home may now be a
      // shift (see `homeView`), and a shift has to be drawn.
      shelf.style.transform = atOrigin() ? "" :
        "translate(" + view.x + "px, " + view.y + "px) scale(" + view.s + ")";
      shelf.setAttribute("data-fa-scale", String(view.s));
      // Read by the avatar-state gist, which is drawn at a constant size ON
      // SCREEN: words scaled to 25% with the card would be there and unreadable.
      shelf.style.setProperty("--fa-glass-scale", String(view.s));
      var pct = Math.round(view.s * 100);
      zoomSlider.value = String(pct);
      zoomValue.textContent = pct + "%";
      layer.setAttribute("data-fa-glass-home", atHome() ? "true" : "false");
      // The scale changes a card's RENDERED width without resizing its box,
      // so the ResizeObserver never hears of it. Asked here instead.
      Array.prototype.forEach.call(shelf.querySelectorAll(".fa-glass-asset"), zoomGlassCard);
      placePanel();
      followMeta();
    }

    /* A TILE'S POP-OUT RIDES ON THE FOLIO — owner, 2026-09-24: *"dragging
     * folio should also drag todos/other tile popouts"*.
     *
     * WHICH "DRAGGING FOLIO". Two things here move: a CARD, by `wireMove`,
     * and the FOLIO — the glass the reader drags from empty space, which is
     * this view (`panFrom`, the pinch, and the zoom controls). The sheet is
     * labelled "Your folio" and the handle "Pull down your folio"; a folio
     * WINDOW (`.fa-board-window`) lives on board pages, not on the glass,
     * where the Todos pop-out is. So "dragging folio" is panning the glass,
     * and a pop-out must move as if it sat on it.
     *
     * The pop-out was a sibling of the shelf, in the sheet's flow, so the
     * view's transform — which is on the shelf alone — left it where it was
     * while every card slid away from it. It now takes the same view, as a
     * TRANSLATION ONLY: its corner goes where that point of the folio goes
     * (`view + P·(s − 1)`, P its place relative to the shelf's origin), but
     * it is never scaled — a pop-out zoomed to 25% is a list nobody can read
     * or press, and this instance's profile is low-dexterity. Home brings it
     * back with everything else; the keyboard reaches it exactly as before.
     * On a phone the column stands and nothing is transformed (`c132`). */
    function placePanel() {
      if (!panel) return;
      if (atOrigin() || !isSurface() || panel.hasAttribute("hidden")) { panel.style.transform = ""; return; }
      var px = panel.offsetLeft - shelf.offsetLeft, py = panel.offsetTop - shelf.offsetTop;
      panel.style.transform = "translate(" + Math.round(view.x + px * (view.s - 1)) + "px, " +
        Math.round(view.y + py * (view.s - 1)) + "px)";
    }

    /** Zoom to `s`, keeping the point under (cx, cy) where it is. No point: the middle of the glass. */
    function zoomAbout(s, cx, cy) {
      s = Math.round(clampScale(s) * 100) / 100;
      var r = shelf.getBoundingClientRect();
      // With the origin at 0 0, the transform moves the box's corner by
      // exactly the translation — so this is where the corner sits untransformed.
      var ox = r.left - view.x, oy = r.top - view.y;
      if (cx == null) {
        var sr = sheet.getBoundingClientRect();
        cx = sr.left + sr.width / 2;
        cy = sr.top + sr.height / 2;
      }
      var fx = cx - ox, fy = cy - oy;
      var px = (fx - view.x) / view.s, py = (fy - view.y) / view.s;
      view = { s: s, x: Math.round(fx - px * s), y: Math.round(fy - py * s) };
      applyView();
      saveView();
    }
    function sayZoom() { glassLive.textContent = "Zoom " + Math.round(view.s * 100) + "%."; }

    zoomOutBtn.addEventListener("click", function () { zoomAbout(view.s - ZOOM_STEP / 100); sayZoom(); });
    zoomInBtn.addEventListener("click", function () { zoomAbout(view.s + ZOOM_STEP / 100); sayZoom(); });
    zoomSlider.addEventListener("input", function () { zoomAbout(Number(zoomSlider.value) / 100); });
    homeBtn.addEventListener("click", function () {
      view = homeView();
      applyView();
      saveView();
      glassLive.textContent = "Back home: 100%, where your folio starts.";
    });

    // CTRL + WHEEL is how a laptop trackpad reports a pinch. A plain wheel is
    // left alone: it scrolls the glass, which is what a reader expects of it.
    sheet.addEventListener("wheel", function (e) {
      if (!e.ctrlKey || layer.getAttribute("data-fa-glass") !== "open") return;
      e.preventDefault();
      zoomAbout(view.s * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    }, { passive: false });

    /* PAN: a drag that starts on EMPTY glass. A drag on a card is that card's
     * (`wireMove`), and a drag on the sheet's scrollbar is a scroll — so only
     * the surface itself starts one. */
    function onEmptyGlass(e) {
      if (e.target === shelf || e.target === notes) return true;
      // The sheet's own box includes its scrollbar; a press there is a scroll.
      return e.target === sheet && e.offsetX < sheet.clientWidth && e.offsetY < sheet.clientHeight;
    }
    var panFrom = null;
    var touches = {};
    var pinch = null;
    function distance(a, b) { return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)); }
    /* Is this the laptop/tablet SURFACE, where the glass pans and zooms? On a
     * phone the column stands (`c132`): the zoom bar is not drawn, the shelf
     * carries no transform, and a finger must scroll the column — so nothing
     * below may take a finger there. Asked of the rendered zoom bar rather
     * than of a width literal, so the stylesheet stays the one place that
     * draws the line. */
    function isSurface() { return zoomBar.getClientRects().length > 0; }
    sheet.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (pinch) return;   // a second finger is a pinch, never a second pan
      /* A FINGER PANS FROM ANY EMPTY GLASS — owner, 2026-09-24: *"clicking on
       * glass, but not avatar, should pan the glass."*
       *
       * It used to pan only from the SHELF, the one element the stylesheet
       * tells the browser not to scroll. But the shelf is what the view
       * transforms: zoomed out it shrinks, panned it slides, and everywhere
       * it no longer covers is the sheet — empty glass to the reader, where a
       * finger did nothing at all. Measured at 50% on a 1024px tablet: the
       * right half of the glass. So a finger on the sheet pans too, and the
       * browser's own scroll is held off by `touchmove` below rather than by
       * `touch-action` — which could not be set on the sheet without also
       * stopping a finger scrolling a long panel, since a scroller's
       * `touch-action` binds everything inside it. A finger on a panel, a note
       * or a card still scrolls; only empty glass pans. */
      if (e.pointerType !== "mouse" && !isSurface()) return;
      if (!onEmptyGlass(e)) return;
      panFrom = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false,
                  touch: e.pointerType !== "mouse" };
    });
    sheet.addEventListener("mousedown", function (e) {
      // No text selection while dragging the surface.
      if (e.button === 0 && onEmptyGlass(e)) e.preventDefault();
    });
    // While a FINGER pans or pinches, the browser must not also scroll the
    // glass under it. Needed only for a pan that began on the sheet — the
    // shelf already says `touch-action: none` — and harmless on the shelf.
    document.addEventListener("touchmove", function (e) {
      if (pinch || (panFrom && panFrom.touch)) e.preventDefault();
    }, { passive: false });
    // TWO FINGERS, wherever they land on the shelf — over a card too — or on
    // the empty glass beside it, since that is glass the reader sees as the
    // same surface. Seen in the CAPTURE phase so a card's own drag cannot hide
    // the second finger; `data-fa-pinching` then tells that drag to stand
    // still (`wireMove`). Not on a panel or a note: a finger there scrolls.
    sheet.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "touch" || !isSurface()) return;
      if (!shelf.contains(e.target) && !onEmptyGlass(e)) return;
      touches[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(touches);
      if (ids.length === 2) {
        panFrom = null;
        var a = touches[ids[0]], b = touches[ids[1]];
        pinch = { d: distance(a, b) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
                  s: view.s, x: view.x, y: view.y };
        shelf.setAttribute("data-fa-pinching", "");
      }
    }, true);
    document.addEventListener("pointermove", function (e) {
      if (touches[e.pointerId]) touches[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pinch) {
        var ids = Object.keys(touches);
        if (ids.length < 2) return;
        var a = touches[ids[0]], b = touches[ids[1]];
        var s = clampScale(pinch.s * distance(a, b) / pinch.d);
        var r = shelf.getBoundingClientRect();
        var ox = r.left - view.x, oy = r.top - view.y;
        // The surface point that was under the fingers when they landed stays
        // under their midpoint: pinching zooms, and moving both fingers pans.
        var px = (pinch.mx - ox - pinch.x) / pinch.s, py = (pinch.my - oy - pinch.y) / pinch.s;
        var mx = (a.x + b.x) / 2 - ox, my = (a.y + b.y) / 2 - oy;
        view = { s: Math.round(s * 100) / 100, x: Math.round(mx - px * s), y: Math.round(my - py * s) };
        applyView();
        return;
      }
      if (panFrom && e.pointerId === panFrom.id) {
        // The button came up where this page could not hear it: the pan is
        // over, exactly as a card's drag is (`wireMove`).
        if (e.pointerType === "mouse" && e.buttons === 0) { endViewPointer(e); return; }
        var dx = e.clientX - panFrom.x, dy = e.clientY - panFrom.y;
        if (!panFrom.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        panFrom.moved = true;
        view = { s: view.s, x: Math.round(panFrom.vx + dx), y: Math.round(panFrom.vy + dy) };
        applyView();
      }
    });
    function endViewPointer(e) {
      if (touches[e.pointerId]) delete touches[e.pointerId];
      if (pinch && Object.keys(touches).length < 2) {
        pinch = null;
        shelf.removeAttribute("data-fa-pinching");
        saveView();
        sayZoom();
      }
      if (panFrom && e.pointerId === panFrom.id) {
        if (panFrom.moved) saveView();
        panFrom = null;
      }
    }
    document.addEventListener("pointerup", endViewPointer);
    document.addEventListener("pointercancel", endViewPointer);

    /* ── THE MOVE BAR: what ✜ is FOR, said and offered on screen ──────────
     *
     * Owner, 2026-09-24: *"exploding icon outlines the avatar but appears to
     * do nothing else."* The exploding icon is ✜, the card's Move control.
     * What it was meant to do is written on it and in `zrvt`: *"✥ enters move
     * mode, arrows move, Shift+arrows resize, Escape or Enter leaves"* — and
     * it did exactly that. But the only thing a SIGHTED reader was shown was
     * the dashed outline; the sentence saying what the arrow keys now do went
     * to a screen-reader live region and nowhere else. To a reader with a
     * mouse the mode looked like a button that draws a box.
     *
     * So while a card is in the mode this bar says the same sentence where it
     * can be read, and offers the mode's own step — the one `nudge` takes for
     * an arrow press — as four buttons, plus Done. Nothing new is decided
     * here: the steps, the resize chord and the ways out are the mode's, and
     * the buttons call the SAME step through `wireMove`'s controller. They are
     * the pointer path to the mode for a reader who cannot comfortably press
     * arrow keys, as its −/+ are for size, and the declared profile here
     * is low-dexterity (WCAG 2.5.7).
     *
     * In the ZOOM BAR's row, because that row is sticky to the top of the
     * glass: the bar stays on screen however far the glass is scrolled, and
     * at full size however far it is zoomed out — a bar drawn on the card
     * would shrink with it. */
    var moveBar = el("div", { class: "fa-glass-move-bar", role: "group", hidden: "hidden" });
    var moveSay = el("p", { class: "fa-glass-move-say" });
    moveBar.appendChild(moveSay);
    var moving = null;   // { card, mover, done } for the one card in the mode
    var STEPS = [
      { key: "ArrowLeft", glyph: "←", word: "left" },
      { key: "ArrowUp", glyph: "↑", word: "up" },
      { key: "ArrowDown", glyph: "↓", word: "down" },
      { key: "ArrowRight", glyph: "→", word: "right" },
    ];
    var stepButtons = STEPS.map(function (st) {
      var b = el("button", { type: "button", class: "fa-glass-zoom-btn fa-glass-move-step", "data-fa-step": st.key }, st.glyph);
      b.addEventListener("click", function () { if (moving) moving.mover.step(st.key, false); });
      moveBar.appendChild(b);
      return { b: b, st: st };
    });
    var moveDone = el("button", { type: "button", class: "fa-glass-zoom-btn fa-glass-move-done", "data-fa-step": "done" },
      "Done");
    moveDone.addEventListener("click", function () { if (moving) moving.done(); });
    moveBar.appendChild(moveDone);
    // The mode's KEYS work here too: arrows step, and Escape
    // leaves the mode — stopped, so the glass's own Escape does not also put
    // the glass away under a reader who only meant "stop moving".
    moveBar.addEventListener("keydown", function (e) {
      if (!moving) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        moving.done();
        return;
      }
      if (moving.mover.step(e.key, e.shiftKey)) e.preventDefault();
    });
    zoomBar.appendChild(moveBar);

    function showMoveBar(card, title, mover, done) {
      if (moving && moving.card !== card) moving.done();
      moving = { card: card, mover: mover, done: done };
      moveBar.setAttribute("aria-label", "Move " + title);
      moveSay.textContent = "Moving “" + title + "”: use these buttons or the arrow keys; " +
        "Escape or Done to finish.";
      stepButtons.forEach(function (x) {
        x.b.setAttribute("aria-label", "Move " + title + " " + x.st.word);
        x.b.title = "Move " + x.st.word;
      });
      moveDone.setAttribute("aria-label", "Done moving " + title);
      moveBar.removeAttribute("hidden");
    }
    function hideMoveBar(card) {
      if (card && moving && moving.card !== card) return;
      moving = null;
      moveBar.setAttribute("hidden", "hidden");
    }

    /* ── HOVERING (OR FOCUSING) A CARD SHOWS WHAT IT IS ───────────────────
     *
     * Owner, 2026-10-01: *"where is title of thing from library? hovering
     * should show metadata."* A card zoomed to its cover says nothing about
     * the document behind it, and a todo's gist is cut at a few lines.
     *
     * ONE POPOVER FOR THE GLASS, not one per card, and outside the shelf: a
     * card clips its overflow (the cover fills it) and the shelf is scaled,
     * so a popover inside either would be cut off or shrunk to 25% with the
     * view. Drawn at a constant size beside the card.
     *
     * HOVER AND FOCUS ALIKE (WCAG 1.4.13): it opens when the pointer is over
     * the card or focus is inside it (the title link, the tools), stays open
     * while the pointer moves onto it, and Escape dismisses it without also
     * putting the glass away. The same facts are the card's accessible
     * DESCRIPTION (`aria-describedby`), so the popover itself is
     * `aria-hidden` — a screen reader hears them once, from the card.
     *
     * Only what the published data says. The library index records no
     * author, publisher or year for any entry today, so the popover says
     * that rather than leaving a reader to wonder whether it was dropped. */
    var metaPop = el("div", { class: "fa-glass-meta", "aria-hidden": "true", hidden: "hidden" });
    layer.appendChild(metaPop);
    var metaFor = null;
    var metaSeq = 0;
    function hideMeta() {
      metaFor = null;
      metaPop.setAttribute("hidden", "hidden");
    }
    function showMeta(card) {
      var rows = card.__faMeta || [];
      if (!rows.length) return;
      // A card being MOVED is not a card being read — and the popover, drawn
      // beside the card, landed on the move bar's own −/+ (measured, #1900).
      if (card.getAttribute("data-fa-moving") === "true") { hideMeta(); return; }
      metaFor = card;
      while (metaPop.firstChild) metaPop.removeChild(metaPop.firstChild);
      var dl = el("dl", { class: "fa-glass-meta-list" });
      rows.forEach(function (r) {
        dl.appendChild(el("dt", null, r[0]));
        dl.appendChild(el("dd", null, r[1]));
      });
      metaPop.appendChild(dl);
      metaPop.removeAttribute("hidden");
      var rc = card.getBoundingClientRect();
      var pw = metaPop.offsetWidth, ph = metaPop.offsetHeight;
      var vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var left = rc.right + 8;
      if (left + pw > vw - 8) left = rc.left - pw - 8;
      if (left < 8) left = Math.max(8, Math.min(vw - pw - 8, rc.left));
      var top = Math.max(8, Math.min(vh - ph - 8, rc.top));
      metaPop.style.left = Math.round(left) + "px";
      metaPop.style.top = Math.round(top) + "px";
    }
    metaPop.addEventListener("mouseleave", function (e) {
      if (metaFor && !(e.relatedTarget && metaFor.contains(e.relatedTarget))) hideMeta();
    });
    // CAPTURE, so it runs before the glass's own Escape: one press dismisses
    // the popover, the next puts the glass away. A card in move mode keeps
    // Escape for leaving the mode.
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !metaFor || metaPop.hasAttribute("hidden")) return;
      if (metaFor.getAttribute("data-fa-moving") === "true") { hideMeta(); return; }
      hideMeta();
      e.stopPropagation();
    }, true);
    // The glass scrolled or zoomed under an open popover: it follows its card,
    // and goes when the card has left the screen.
    function followMeta() {
      if (!metaFor || metaPop.hasAttribute("hidden")) return;
      var rc = metaFor.getBoundingClientRect();
      if (!metaFor.isConnected || rc.bottom < 0 || rc.top > window.innerHeight) { hideMeta(); return; }
      showMeta(metaFor);
    }
    sheet.addEventListener("scroll", followMeta, { passive: true });

    /** Set what a card's popover and accessible description say: `[label, value]` rows. */
    function setCardMeta(card, rows) {
      rows = rows.filter(function (r) { return r && r[1] != null && String(r[1]).trim() !== ""; });
      card.__faMeta = rows;
      var desc = card.querySelector(".fa-glass-asset-desc");
      if (desc) desc.textContent = rows.map(function (r) { return r[0] + ": " + r[1]; }).join(". ");
      if (metaFor === card) showMeta(card);
    }
    function wireCardMeta(card) {
      var id = "fa-glass-desc-" + (++metaSeq);
      card.appendChild(el("span", { class: "fa-sr-only fa-glass-asset-desc", id: id }));
      card.setAttribute("aria-describedby", id);
      card.addEventListener("mouseenter", function () { showMeta(card); });
      card.addEventListener("mouseleave", function (e) {
        if (e.relatedTarget && metaPop.contains(e.relatedTarget)) return;
        if (card.contains(document.activeElement)) return;
        if (metaFor === card) hideMeta();
      });
      card.addEventListener("focusin", function () { showMeta(card); });
      card.addEventListener("focusout", function (e) {
        if (e.relatedTarget && card.contains(e.relatedTarget)) return;
        if (metaFor === card && !card.matches(":hover")) hideMeta();
      });
      // A card being dragged is not a card being read.
      card.addEventListener("pointerdown", function (e) {
        if (!(e.target && e.target.closest && e.target.closest("button, a"))) hideMeta();
      });
    }

    /** The library entry's facts, from the published index; `null` entry means only the stored title is known. */
    function libraryMetaRows(a, key, entry) {
      var rows = [["Title", (entry && entry.title && entry.title !== entry.id) ? entry.title : a.title]];
      if (!entry) {
        if (key.indexOf("linked/") === 0) {
          rows.push(["Disposition", "referenced (linked by URL)"]);
          if (a && a.href) rows.push(["URL", a.href]);
          return rows;
        }
        rows.push(["Library", key.split("/")[0]]);
        return rows;
      }
      var who = entry.authors || entry.author || entry.creator;
      if (Array.isArray(who)) who = who.join(", ");
      if (who) rows.push(["Author", who]);
      if (entry.publisher) rows.push(["Publisher", entry.publisher]);
      if (entry.year || entry.date) rows.push(["Year", entry.year || entry.date]);
      if (!who && !entry.publisher && !(entry.year || entry.date)) {
        rows.push(["Author, year", "not recorded in the library index"]);
      }
      rows.push(["Kind", entry.documentClass || "library document"]);
      rows.push(["Library", entry.instance]);
      if (entry.sourceFile) rows.push(["Source", entry.sourceFile]);
      if (entry.pageStart != null && entry.pageEnd != null) {
        rows.push(["Pages", entry.pageStart === entry.pageEnd ? String(entry.pageStart) : entry.pageStart + "–" + entry.pageEnd]);
      }
      if (typeof entry.words === "number") rows.push(["Words", entry.words.toLocaleString()]);
      if (entry.doi) rows.push(["DOI", entry.doi]);
      if (entry.arxiv) rows.push(["arXiv", entry.arxiv]);
      return rows;
    }

    /** The library index, fetched once per page, as `{ "<instance>/<id>": entry }`; `null` when unreadable. */
    var glassLibIdx;
    var glassLibWaiting = null;
    function glassLibraryIndex(done) {
      if (glassLibIdx !== undefined) return done(glassLibIdx);
      if (glassLibWaiting) { glassLibWaiting.push(done); return; }
      glassLibWaiting = [done];
      function settle(v) {
        glassLibIdx = v;
        var w = glassLibWaiting;
        glassLibWaiting = null;
        w.forEach(function (f) { f(v); });
      }
      var m = document.querySelector('meta[name="fa-library-src"]');
      fetch((m && m.getAttribute("content")) || withBase("/assets/library/index.json"))
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (doc) {
          var by = {};
          (doc && Array.isArray(doc.entries) ? doc.entries : []).forEach(function (e) {
            if (e && e.instance && e.id) by[e.instance + "/" + e.id] = e;
          });
          settle(by);
        })
        .catch(function (e) {
          console.warn("docs-ui: the glass could not read the library index (" + e.message +
                       "); library cards show their stored title only.");
          settle(null);
        });
    }


    /* WHERE A LIBRARY ASSET LIVES — issue #1900, owner 2026-10-02: *"as will
     * all library assets in folio, i cant click to open/view them"*.
     *
     * Derived from the card's KEY (`<instance>/<id>`, the same split
     * `libraryMetaRows` reads), never from the stored `href`: that one is
     * whatever page the reader happened to pull the asset out from, and a
     * value in `localStorage` is not a value this file may trust.
     *
     * THE ENTRY'S OWN PAGE is `/cat-harness/library/<instance>/<id>/` —
     * every entry its own path IRI (#1881/#1899, owner 2026-10-02: *"no query
     * strings... each asset gets its own IRI"*), a thin shell the shared
     * library viewer fills from the published index.
     *
     * BUT OPENING GOES TO THE ASSET'S VISUALIZER when it declares one —
     * owner, 2026-10-02: *"i also expected to be able to click on
     * "smart-trust" slug and open up the visualizer for smart-trust (which is
     * what i would expect also when opening the avatar on the folio glass)"*.
     * That is the index entry's `view` (`viewOf`); the entry page is the
     * fallback, so a card opens somewhere real before the index answers and
     * for every entry with no visualizer of its own. */
    function libraryPlaceOf(key) {
      var i = key.indexOf("/");
      if (i <= 0 || i === key.length - 1) return null;
      var instance = key.slice(0, i);
      if (instance === "linked") return null;
      var id = key.slice(i + 1);
      var library = withBase("/cat-harness/library/" + encodeURIComponent(instance) + "/");
      return { instance: instance, id: id, library: library,
               entry: library + id.split("/").map(encodeURIComponent).join("/") + "/" };
    }
    /** An index entry's declared visualizer, resolved as every projection href is (site-root → baseurl); "" when none. */
    function viewOf(entry) {
      var v = entry && typeof entry.view === "string" ? entry.view.trim() : "";
      if (!v) return "";
      return safeHref(v.charAt(0) === "/" ? withBase(v) : v) || "";
    }

    /* WHAT × SAYS BEFORE IT ACTS — issue #1900, owner 2026-10-02: *"[x]
     * should confirm returning back to library and tell them which library in
     * case they need again."*
     *
     * The confirm names the place the way back is, and links it — `l4zi` one
     * level out (`board-windows`: *"the thing to check is that the library
     * offers the way back"*), now said at the moment of closing rather than
     * left for the reader to remember. It also says what does NOT happen: the
     * asset stays in the folio, which is the three-state rule in words.
     *
     * THREE PLACES, because there are three kinds of card (#1926 added the
     * third): a LIBRARY card goes back to its instance's library, a TODO to
     * the Todos board, and a pinned LANDING STICKY to the page it was pinned
     * from. Calling a sticky "your Todos" sent the reader to a list it was
     * never on. `returnPlaceOf` is the one answer, read by the confirm, the
     * after-the-fact status and the x button's own label.
     *
     * The dialog is `confirmDialog`, the page's one confirm (focus on the
     * safe choice, Escape cancels and is stopped before the glass's own
     * Escape), mounted inside the layer for the glass's theme tokens and with
     * `aria-live="off"` so opening it is not also read out as a live change. */
    function returnPlaceOf(key, a) {
      var isLib = zoomKindOf(a) === "library";
      var lib = isLib ? libraryPlaceOf(key) : null;
      if (lib) {
        var libName = "the " + lib.instance + " library";
        return { kind: "library", name: libName, href: safeHref(lib.library), entry: safeHref(lib.entry),
                 heading: "Back to the library?", tip: "Back in " + libName };
      }
      if (a && PIN_KINDS[a.kind]) {
        var from = String(a.source || "").replace(/\s+/g, " ").trim();
        var fromName = from ? "its page, " + from : "the page it came from";
        return { kind: "sticky", name: fromName, href: safeHref(a.href) || safeHref(withBase("/")),
                 heading: "Back on its page?", tip: "Back on " + fromName };
      }
      if (a && a.kind === "sticky") {
        var page = String(a.label || "").replace(/\s+/g, " ").trim();
        var pageName = page ? "its page, " + page : "the page it came from";
        return { kind: "sticky", name: pageName, href: safeHref(a.href) || safeHref(withBase("/")),
                 heading: "Back on its page?", tip: "Back on " + pageName };
      }
      if (isLib) {
        return { kind: "library", name: "the library view", href: safeHref(withBase("/cat-harness/library/")),
                 heading: "Back to the library?", tip: "Back in the library view" };
      }
      return { kind: "todos", name: "your Todos", href: safeHref(withBase("/todos/")),
               heading: "Back to your Todos?", tip: "Back in your Todos" };
    }
    /** "in the X library" / "in your Todos" / "on its page, Y". */
    function backTo(place) { return (place.kind === "sticky" ? "on " : "in ") + place.name; }
    function confirmShelve(key, a, title, opener) {
      hideMeta();
      var place = returnPlaceOf(key, a);
      var body = el("div");
      body.appendChild(el("p", { class: "fa-glass-confirm-say" },
        "Put \u201c" + title + "\u201d back " + backTo(place) + "? It stays in your folio."));
      var again = el("p", { class: "fa-glass-confirm-again" }, "To put it on the glass again, open ");
      var backHref = safeHref(place.href);
      again.appendChild(el("a", { href: backHref }, place.name));
      var entryHref = safeHref(place.entry);
      if (entryHref) {
        again.appendChild(document.createTextNode(" \u2014 or go straight to "));
        again.appendChild(el("a", { href: entryHref }, "its entry"));
      }
      again.appendChild(document.createTextNode("."));
      body.appendChild(again);
      return confirmDialog({
        cls: "fa-glass-confirm",
        title: place.heading,
        body: body,
        cancel: "Keep it on the glass",
        ok: "Put it back",
        live: "off",
        mount: layer,
        opener: opener,
        onConfirm: function () {
          shelveFromGlass(key);
          sayShelved(title, place);
          handle.focus();
        },
      });
    }

    /* SAID AFTER, WITH THE SAME LINK — a status the reader can also SEE, not
     * only a live region: the card that was the reader's reference point has
     * just gone, and "where did it go" is answered where they are looking. */
    var shelvedSay = el("p", { class: "fa-glass-shelved-say", role: "status" });
    sheet.insertBefore(shelvedSay, empty);
    function sayShelved(title, place) {
      while (shelvedSay.firstChild) shelvedSay.removeChild(shelvedSay.firstChild);
      shelvedSay.appendChild(document.createTextNode("“" + title + "” is back " +
        (place.kind === "sticky" ? "on " : "in ")));
      var backHref = safeHref(place.href);
      shelvedSay.appendChild(el("a", { href: backHref }, place.name));
      shelvedSay.appendChild(document.createTextNode(" — it stays in your folio."));
    }

    function buildGlassCard(key, a) {
      // ONE LINE, for every accessible name and title built from it. A todo's
      // title is its summary, which may carry raw newlines; an `aria-label`
      // or a `title` with "\n" in it is announced or tooltipped broken, so
      // every run of whitespace becomes one space — as `plainGist` does, but
      // without its markdown stripping, which would mangle a title like
      // "C*-algebras". The visible name keeps `a.title`: rendering collapses it.
      var label = String(a.title || "").replace(/\s+/g, " ").trim();
      var isLibrary = zoomKindOf(a) === "library";
      var place = isLibrary ? libraryPlaceOf(key) : null;
      var href = place ? place.entry : safeHref(a.href);
      // WHERE A PRESS GOES: the entry page until the index names a visualizer,
      // or the external URL for a linked document (R28).
      var isPin = !!PIN_KINDS[a.kind];
      var opens = place ? place.entry : (isLibrary || isPin ? href || "" : "");
      var card = el("article", {
        class: "fa-glass-asset",
        "data-fa-asset": key,
        "data-fa-asset-kind": a.kind || "library",
        "data-fa-zoom-kind": zoomKindOf(a),
        "data-fa-node-kind": isPin ? kindWord(a.nodeKind) : "",
        "data-fa-source": isPin ? String(a.source || "") : "",
        "aria-label": label,
        // A library card OPENS (issue #1900), so it is a stop in the tab
        // order: zoomed to its cover the title link is not drawn, and Enter on
        // the card is then the only key into the entry.
        tabindex: opens ? "0" : "-1",
      });
      if (opens) card.setAttribute("data-fa-opens", opens);
      var live = el("span", { class: "fa-sr-only", "aria-live": "polite" });
      var face = el("div", { class: "fa-glass-asset-face", "data-fa-grip": "" });
      var ava = glassAvatarFor(a, prefs.avatars);
      if (ava) face.appendChild(ava);
      face.appendChild(href
        ? el("a", { class: "fa-glass-asset-name", href: href }, a.title)
        : el("span", { class: "fa-glass-asset-name" }, a.title));
      card.appendChild(face);
      // A BOOKMARK wears a ribbon and a PINNED BLOCK a pin, on the CARD's top
      // corner rather than inside the avatar: the avatar fills the card under
      // the title strip, which would cover a badge drawn in it. Decorative:
      // the card's name says what it is.
      if (isPin) {
        card.setAttribute("data-fa-badged", "");
        card.appendChild(el("span", { class: "fa-glass-badge", "data-fa-badge": a.kind, "aria-hidden": "true" },
          a.kind === "bookmark" ? "\uD83D\uDD16" : "\uD83D\uDCCC"));
      }
      // What the card shows once it is its avatar (`gistOf`). Drawn only in
      // that state — the CSS hides it at full size, where the title and the
      // body already say it — and a <p>, so it is read as text when shown.
      card.appendChild(el("p", { class: "fa-glass-asset-gist" }, gistOf([a.title])));

      var tools = el("div", { class: "fa-glass-asset-tools" });
      var moveBtn = el("button", {
        type: "button",
        class: "fa-glass-asset-tool",
        "data-fa-control": "move",
        "aria-label": "Move " + label + " around the glass",
        "aria-pressed": "false",
        title: "Move (arrow keys)",
      }, CONTROL_GLYPHS.move || "✜");
      // Leaving the mode by any route — Escape or Enter on the card, Escape or
      // Done on the move bar — is this one path, so the bar, the pressed state
      // and focus cannot disagree about whether the card is still moving.
      function leaveMoveMode() {
        setMoveMode(card, false, live);
        card.dispatchEvent(new CustomEvent("fa:move-mode", { detail: { on: false } }));
      }
      moveBtn.addEventListener("click", function () {
        var on = card.getAttribute("data-fa-moving") !== "true";
        if (!on) { leaveMoveMode(); return; }
        setMoveMode(card, true, live);
        live.textContent = "Move mode on. Arrow keys move this card; Escape to finish.";
        moveBtn.setAttribute("aria-pressed", "true");
        showMoveBar(card, label, mover, leaveMoveMode);
      });
      card.addEventListener("fa:move-mode", function () {
        moveBtn.setAttribute("aria-pressed", "false");
        hideMoveBar(card);
        moveBtn.focus();
      });
      /* SIZE has ONE route: the card's own − and + buttons. Owner,
       * 2026-10-05: *"No keyboard resize thing. Only the plus minus"* — so
       * the corner drag, the `+`/`−` keys in move mode, the move bar's size
       * buttons and Shift+arrows (`noResize` on `wireMove` below) are gone.
       * The card grows from its top-left corner. */
      function resizeTo(g) {
        g.width = Math.max(MIN_WINDOW, Math.round(g.width));
        g.height = Math.max(Math.round(MIN_WINDOW * 0.5), Math.round(g.height));
        applyGeometry(card, g);
        zoomGlassCard(card);
        return g;
      }
      function settleSize(g) {
        placeOnGlass(key, g);
        fitShelf();
        zoomGlassCard(card);
        live.textContent = (card.getAttribute("data-fa-zoom") === "avatar"
          ? "Smaller: showing the avatar only." : "Size " + g.width + " by " + g.height + ".");
      }
      /* THE PRESSED BUTTON STAYS UNDER THE POINTER. Owner, 2026-10-01:
       * *"when zoom in/out, the buttons dont stay same place so have to move
       * cursor"* — and this instance's profile is low-dexterity, so a target
       * that moves after each press is a re-aim per press. The card grows
       * from its top-left corner and the buttons sit on its right, so each
       * press would carry them; the card is shifted back by however far the
       * pressed button drifted, measured (the tool row wraps, and the avatar
       * state lays it out differently), in the shelf's own pixels. */
      function resizeBy(d, anchor) {
        var g = geometryOf(card);
        var before = anchor ? anchor.getBoundingClientRect() : null;
        var ratio = g.height / g.width;
        g.width = Math.max(MIN_WINDOW, g.width + d);
        g.height = Math.round(g.width * ratio);
        resizeTo(g);
        if (before) {
          var after = anchor.getBoundingClientRect();
          var sc = view.s || 1;
          g.left = Math.round(g.left + (before.left - after.left) / sc);
          g.top = Math.round(g.top + (before.top - after.top) / sc);
          applyGeometry(card, g);
        }
        settleSize(g);
      }
      card.addEventListener("keydown", function (e) {
        if (e.target !== card) return;
        if (card.getAttribute("data-fa-moving") === "true") return;
        // ENTER OPENS a library card — the keyboard half of the click below.
        // Not in move mode: there Enter is "done moving" (`wireMove`).
        if (opens && e.key === "Enter" && !e.defaultPrevented) {
          e.preventDefault();
          window.location.assign(opens);
        }
      });

      function sizeBtn(d, glyph, word) {
        var btn = el("button", {
          type: "button",
          class: "fa-glass-asset-tool",
          "data-fa-control": "size",
          "data-fa-size": word,
          "aria-label": "Make " + label + " " + word,
          title: word.charAt(0).toUpperCase() + word.slice(1),
        }, glyph);
        btn.addEventListener("click", function () { resizeBy(d * 2 * RESIZE_STEP, btn); });
        return btn;
      }
      var smaller = sizeBtn(-1, "\u2212", "smaller");
      var larger = sizeBtn(1, "+", "larger");

      // CLOSE, and the word matters. "Remove" and "delete" both say the
      // asset stops being the reader's, which is exactly what does NOT
      // happen -- `board-windows`: closing returns it to the middle state
      // and never to the first. The label says where it goes, and the
      // confirm (issue #1900) names which library and links it.
      var returnTo = returnPlaceOf(key, a);
      function closeLabel(t) {
        return "Put " + t + " back " + backTo(returnTo) + " — it stays in your folio";
      }
      var close = el("button", {
        type: "button",
        class: "fa-glass-asset-tool fa-glass-asset-close",
        "aria-label": closeLabel(label),
        title: returnTo.tip + " (stays in your folio)",
      }, "×");
      close.addEventListener("click", function () {
        confirmShelve(key, a, label, close);
      });
      var winBtn = null;
      var winBox = null;
      if (isPin) {
        winBtn = el("button", {
          type: "button",
          class: "fa-glass-asset-tool",
          "data-fa-control": "window",
          "aria-expanded": "false",
          "aria-label": "Open " + label + " in a window on the glass",
          title: "Open live window",
        }, "\u29c9");
        winBox = el("div", {
          class: "fa-glass-window",
          "data-fa-window-body": "",
          hidden: "",
        });
        function closeCardWindow() {
          card.removeAttribute("data-fa-window");
          winBtn.setAttribute("aria-expanded", "false");
          winBtn.setAttribute("aria-label", "Open " + label + " in a window on the glass");
          winBtn.title = "Open live window";
          winBox.setAttribute("hidden", "");
          live.textContent = "Closed live window of " + label + ".";
        }
        function openCardWindow() {
          if (card.getAttribute("data-fa-zoom") === "avatar") return Promise.resolve(false);
          card.setAttribute("data-fa-window", "open");
          winBtn.setAttribute("aria-expanded", "true");
          winBtn.setAttribute("aria-label", "Close live window of " + label);
          winBtn.title = "Close live window";
          winBox.removeAttribute("hidden");
          var g = geometryOf(card);
          if (g.height <= GLASS_CARD_H) {
            g.width = Math.max(g.width, 340);
            g.height = Math.max(g.height, 240);
            applyGeometry(card, g);
            fitShelf();
          }
          var nk = kindWord(a.nodeKind) || a.kind || "*";
          var rawId = key.replace(/^(bookmark|pin):/, "");
          var node = {
            "@id": rawId,
            id: rawId,
            key: key,
            title: a.title || rawId,
            href: href || "",
            kind: nk,
            nodeKind: kindWord(a.nodeKind) || "",
            source: a.source || "",
          };
          return loadFolioViewer(nk).then(function (loaded) {
            if (!loaded || card.getAttribute("data-fa-window") !== "open" || card.getAttribute("data-fa-zoom") === "avatar") {
              return false;
            }
            while (winBox.firstChild) winBox.removeChild(winBox.firstChild);
            loaded.viewer.render(node, winBox, loaded.mod);
            live.textContent = "Opened live window of " + label + ".";
            return true;
          }).catch(function (err) {
            while (winBox.firstChild) winBox.removeChild(winBox.firstChild);
            winBox.appendChild(el("p", { class: "fa-glass-window-error" },
              "Viewer failed to load: " + (err && err.message ? err.message : String(err))));
            return false;
          });
        }
        card.__faOpenWindow = openCardWindow;
        card.__faCloseWindow = closeCardWindow;
        winBtn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (card.getAttribute("data-fa-window") === "open") closeCardWindow();
          else openCardWindow();
        });
        tools.appendChild(winBtn);
      }
      tools.appendChild(moveBtn);
      tools.appendChild(smaller);
      tools.appendChild(larger);
      tools.appendChild(close);
      if (winBox) card.appendChild(winBox);
      card.appendChild(tools);
      card.appendChild(live);
      wireCardMeta(card);

      /* A CLICK OPENS a library card — anywhere on it but its controls, and
       * never at the end of a drag: a press that travelled is a move (or a
       * pan, or a resize), and opening the entry under a reader who was only
       * tidying would take them off the page mid-gesture. Same tab: the
       * glass is on every page, so the reader's folio comes with them. */
      var pressAt = null;
      card.addEventListener("pointerdown", function (e) { pressAt = { x: e.clientX, y: e.clientY }; });
      card.addEventListener("click", function (e) {
        if (!opens) return;
        if (card.getAttribute("data-fa-window") === "open") return;
        if (e.button !== 0 || e.defaultPrevented) return;
        if (e.target.closest && e.target.closest("button, a, [data-fa-control], [data-fa-window-body], input, select, textarea")) return;
        if (card.getAttribute("data-fa-moving") === "true") return;
        var p = pressAt;
        pressAt = null;
        if (p && Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) > 4) return;
        window.location.assign(opens);
      });

      if (isLibrary) {
        setCardMeta(card, libraryMetaRows(a, key, null));
        glassLibraryIndex(function (idx) {
          var entry = idx && idx[key];
          if (!entry) return;
          setCardMeta(card, libraryMetaRows(a, key, entry));
          // The asset's VISUALIZER, when it declares one, is what opening means.
          var view = viewOf(entry);
          if (view) {
            opens = view;
            card.setAttribute("data-fa-opens", opens);
            var link = card.querySelector("a.fa-glass-asset-name");
            if (link) link.setAttribute("href", opens);
          }
          /* THE EYE — owner, 2026-10-16: *"if somehting on folio has a viewer
           * (e.g. PDF) then there should be [eye] icon to look at it"*. Only
           * when the index says the entry's source has a viewer (`viewable`,
           * written by the library generator); it opens the entry page's own
           * view panel (`#lib-view`), which loads the viewer on arrival. */
          var viewable = entry.viewable === "pdf" || entry.viewable === "image" ? entry.viewable : "";
          var lookAt = safeHref(opens + "#lib-view");
          if (viewable && lookAt && !tools.querySelector('[data-fa-control="view"]')) {
            var word = viewable === "pdf" ? "the PDF" : "the image";
            var named = String(entry.title && entry.title !== entry.id ? entry.title : label).replace(/\s+/g, " ").trim();
            var eye = el("a", {
              class: "fa-glass-asset-tool",
              "data-fa-control": "view",
              href: lookAt,
              "aria-label": "View " + word + " of " + named,
              title: "View " + word,
            });
            eye.innerHTML = EYE_GLYPH;
            tools.insertBefore(eye, tools.firstChild);
          }
          /* THE INDEX'S TITLE WINS whenever it has a real one — issue #1900:
           * *"Title in popup is right but not avatar"*. The popover already
           * read the index; the caption only did when the stored title was
           * the bare key or id, so a row stored with another wrong title
           * ("Abies" for the WHO editorial style manual) kept it on the card.
           * Every surface built from the title is renamed together, and the
           * stored row is corrected — without announcing, which would repaint
           * the glass under the reader. */
          var better = entry.title && entry.title !== entry.id ? String(entry.title) : "";
          if (!better || better === a.title) return;
          label = better.replace(/\s+/g, " ").trim();
          var nm = card.querySelector(".fa-glass-asset-name");
          if (nm) nm.textContent = better;
          card.setAttribute("aria-label", label);
          var g = card.querySelector(".fa-glass-asset-gist");
          if (g) g.textContent = gistOf([better]);
          moveBtn.setAttribute("aria-label", "Move " + label + " around the glass");
          close.setAttribute("aria-label", closeLabel(label));
          zoomGlassCard(card);
          var all = folioAssets();
          if (all[key] && all[key].title !== better) {
            all[key].title = better;
            setFolioAssets(all);
          }
        });
      } else {
        setCardMeta(card, [["Title", label]]);
      }

      // SELECTING ANY PART RAISES IT — the owner's rule for windows,
      // 2026-09-20, and the same one here: a card the reader is touching is
      // never under another.
      function raise() { card.style.zIndex = String(++raiseAt); }
      card.addEventListener("mousedown", raise);
      card.addEventListener("focusin", raise);

      // UNBOUNDED: a card on the glass may go past the origin (see `nudge`).
      // Where it settles may also move Home, so the Home button's state is
      // asked again — `applyView` redraws nothing that did not change.
      var mover = wireMove(card, card, live, function (g) {
        placeOnGlass(key, g);
        fitShelf();
        applyView();
      }, { unbounded: true, noResize: true });
      if (a.kind === "todos" && key.indexOf("todo/") === 0) {
        var todoId = key.slice("todo/".length);
        glassTodoIndex(function (idx) {
          var item = idx && idx.byId[todoId];
          if (item) dressGlassSticky(card, item, idx.themeArt);
        });
      } else if (a.kind === "sticky" && key.indexOf("landing/") === 0) {
        // A PINNED LANDING STICKY, dressed by the same function as a todo
        // (#1925: one sticky). Its theme, picture and words were carried in
        // the folio entry when it was pinned, because they live on the landing
        // page rather than in an index; the picture is one crop, so it is the
        // `card` crop whatever the card's shape.
        if (a.label) card.setAttribute("data-fa-home-label", String(a.label));
        var landingArt = {};
        var artSrc = safeHref(a.art);
        if (a.theme && artSrc) landingArt[a.theme] = { card: artSrc };
        dressGlassSticky(card, { theme: a.theme, summary: a.title, comment: a.text || "" },
          landingArt, [["Sticky", label], ["Home", a.label || ""]]);
      }
      return card;
    }

    /* ── A POPPED-OUT STICKY IS THE STICKY ──────────────────────────────────
     *
     * Owner, 2026-09-24, on a todo pulled onto the glass: *"i expected to see
     * themed square sticky avatar faded with markdown overlayed when stikcy
     * poopped out."* What popped out was a wide card with a generic yellow
     * note in the middle and none of the note's words.
     *
     * THE SAME THEMED STICKY, NOT A SECOND LOOK. The card takes the todo's
     * `data-fa-sticky-theme` and `fa-sticky--backdrop`, and its art comes
     * from `buildBackdrop` — the attribute, class and function the board's
     * sticky (`buildSticky`) and the landing stickies already use. So the
     * art's crop and clipping, the SCRIM that fades it, and the theme's ink
     * all come from `themes.css` and the backdrop rules as they are; nothing
     * here sets a colour or restates a fade. The note's words are
     * `renderBody(comment, { markdown: true })` — the board's body renderer,
     * asked for markdown.
     *
     * The theme and the words live in the published todo index, not in the
     * reader's folio (which keeps a title and a link), so they are read from
     * the index when the card is drawn — once per page, cached. An index that
     * cannot be read leaves the plain card as it was: absent is a real state,
     * and a card with no theme stays the plain note. */
    var glassTodoIdx;
    var glassTodoWaiting = null;
    function glassTodoIndex(done) {
      if (glassTodoIdx !== undefined) return done(glassTodoIdx);
      if (glassTodoWaiting) { glassTodoWaiting.push(done); return; }
      glassTodoWaiting = [done];
      function settle(v) {
        glassTodoIdx = v;
        var w = glassTodoWaiting;
        glassTodoWaiting = null;
        w.forEach(function (f) { f(v); });
      }
      fetch(todoIndexUrl())
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (doc) {
          var byId = {};
          (doc && Array.isArray(doc.items) ? doc.items : []).forEach(function (t) { if (t && t.id) byId[t.id] = t; });
          settle({ byId: byId, themeArt: baseurlResolved((doc && doc.themeArt) || {}) });
        })
        .catch(function (e) {
          console.warn("docs-ui: the glass could not read the todo index (" + e.message +
                       "); popped-out stickies keep their plain card.");
          settle(null);
        });
    }

    function dressGlassSticky(card, todo, themeArt, metaRows) {
      if (card.classList.contains("fa-glass-sticky")) return;
      card.classList.add("fa-glass-sticky");
      var art = todo.theme && themeArt[todo.theme];
      if (todo.theme) card.setAttribute("data-fa-sticky-theme", todo.theme);
      // The reader's "text only" avatar style is honoured here as everywhere
      // on the glass: the theme's colours stay, its picture does not.
      if (art && prefs.avatars !== "text") {
        card.classList.add("fa-sticky--backdrop");
        card.insertBefore(buildBackdrop(art, todo.layout), card.firstChild);
        followCardShape(card, art, todo.layout);
        // The theme's art IS the avatar now; the generic yellow note goes.
        var generic = card.querySelector(".fa-glass-asset-face > .fa-glass-avatar");
        if (generic) generic.parentNode.removeChild(generic);
      }
      var body = renderBody(todo.comment, { markdown: true });
      body.classList.add("fa-glass-sticky-body");
      var tools = card.querySelector(".fa-glass-asset-tools");
      card.insertBefore(body, tools);
      // The small state's gist now has the note's words, not only its title.
      var gist = card.querySelector(".fa-glass-asset-gist");
      if (gist) gist.textContent = gistOf([todo.summary, todo.comment]);
      // And its popover / description: the WHOLE title, where it stands, and
      // the node it is attached to.
      var t = todo.target || {};
      var on = t.page ? t.page + (t.node ? " › " + t.node : "") : (todo.targetLabel || "");
      // A landing sticky has no status or priority: its caller says what it has.
      if (metaRows) { setCardMeta(card, metaRows); zoomGlassCard(card); return; }
      setCardMeta(card, [
        ["Todo", plainGist(todo.summary) || card.getAttribute("aria-label") || ""],
        ["Status", String(todo.status || "").replace(/_/g, " ")],
        ["Priority", todo.priority || ""],
        ["Attached to", on],
      ]);
      zoomGlassCard(card);
    }

    function renderShelf() {
      // The cards are about to be rebuilt; a bar for a card that is gone
      // would move nothing.
      hideMoveBar();
      hideMeta();
      while (shelf.firstChild) shelf.removeChild(shelf.firstChild);
      while (notes.firstChild) notes.removeChild(notes.firstChild);
      var all = folioAssets();
      var keys = Object.keys(all).filter(function (k) { return all[k].shown; });
      keys.sort();

      var placed = [];
      var nextSpot = glassPacker(keys.map(function (k) { return all[k].geom; })
        .filter(function (g) { return g && isFinite(g.left) && isFinite(g.top); }));
      keys.forEach(function (key) {
        var a = all[key];
        var card = buildGlassCard(key, a);
        shelf.appendChild(card);
        applyGeometry(card, a.geom || nextSpot(defaultGlassSize(a)));
        placed.push(card);
      });
      fitShelf();
      if (typeof ResizeObserver === "function") {
        if (shelf.__faZoomObs) shelf.__faZoomObs.disconnect();
        var zo = new ResizeObserver(function (entries) {
          entries.forEach(function (en) { zoomGlassCard(en.target); });
        });
        placed.forEach(function (c) { zo.observe(c); });
        shelf.__faZoomObs = zo;
      }
      placed.forEach(zoomGlassCard);
      // The reader's saved view, applied over the cards just drawn.
      applyView();

      // WHERE THE WAY BACK IS, said on the surface that cannot offer it.
      // `l4zi` one level out: the inverse of close is reachable from the
      // LIBRARY (or, for a todo, the Todos tile), not from the glass itself,
      // and a reader who is not told that reads a closed asset as one they
      // lost.
      //
      // "PUT YOUR FOLIO AWAY FIRST" is a measured fix rather than politeness:
      // while the glass is down the library row underneath takes no clicks.
      var shelved = Object.keys(all).filter(function (k) { return !all[k].shown; });
      /* ITS OWN CARD ON THE GLASS, not a strip across the bottom — owner,
       * 2026-09-27: *"lower tooltip should be its own todo"*. It moves and
       * resizes like every other card, and its × dismisses it until the
       * number of shelved items changes (a new one is news again). It is not
       * stored in the folio: it describes the folio, it is not in it, so its
       * place lasts for this view only. */
      if (shelved.length > 0 && shelvedNoteDismissedAt() !== shelved.length) {
        var noteTitle = shelved.length === 1
          ? "1 item in your folio is not on the glass"
          : shelved.length + " items in your folio are not on the glass";
        var noteCard = buildGlassCard("note/shelved", { title: noteTitle, kind: "todos" });
        noteCard.classList.add("fa-glass-sticky", "fa-glass-note-card");
        // Words only: the generic note picture sat behind the sentence.
        var noteAva = noteCard.querySelector(".fa-glass-asset-face > .fa-glass-avatar");
        if (noteAva) noteAva.parentNode.removeChild(noteAva);
        var noteWords = (shelved.length === 1
            ? "1 item is in your folio but not displayed. "
            : shelved.length + " items are in your folio but not displayed. ") +
          "Put your folio away, then open the library view to put it back on the glass " +
          "(for a todo, use the Todos tile below).";
        noteCard.insertBefore(el("p", { class: "fa-glass-shelved-note fa-glass-sticky-body" }, noteWords),
          noteCard.querySelector(".fa-glass-asset-tools"));
        noteCard.querySelector(".fa-glass-asset-gist").textContent = gistOf([noteTitle, noteWords]);
        // The shared close SHELVES an asset; this card is not one, so its ×
        // dismisses instead, and says so.
        var oldClose = noteCard.querySelector(".fa-glass-asset-close");
        var noteClose = oldClose.cloneNode(true);
        noteClose.setAttribute("aria-label", "Dismiss this note until another item leaves the glass");
        noteClose.title = "Dismiss";
        noteClose.addEventListener("click", function () {
          setShelvedNoteDismissedAt(shelved.length);
          if (noteCard.parentNode) noteCard.parentNode.removeChild(noteCard);
          handle.focus();
        });
        oldClose.parentNode.replaceChild(noteClose, oldClose);
        shelf.appendChild(noteCard);
        // SIZED TO ITS WORDS: measured at each candidate width with the height
        // left to the content, so no line is cut (a fixed 180px cut the last
        // one at 420px wide). Then placed where a card of that size is free.
        var noteGeom = nextSpot(defaultGlassSize({ kind: "todos" }));
        var shapes = [Math.max(noteGeom.width, 420), noteGeom.width].map(function (w) {
          noteCard.style.width = w + "px";
          noteCard.style.height = "auto";
          return { width: w, height: Math.ceil(noteCard.getBoundingClientRect().height / (view.s || 1)) + 2 };
        });
        applyGeometry(noteCard, freeSpotFor(shapes, placed, noteGeom));
        placed.push(noteCard);
        fitShelf();
        zoomGlassCard(noteCard);
      }

      // Saved in THIS BROWSER, said in words wherever the reader's own items
      // appear: a reader who thinks their folio follows them to another
      // machine has been misled by the control.
      //
      // DISMISSABLE — owner, 2026-09-23: *"need to be able to dismiss"*, and
      // *"should also say (no 'save' tool is currently enabled)"*. Said once
      // is enough; said on every open is noise the reader learns to skip. The
      // dismissal is itself a per-browser preference, and Settings offers the
      // way back ("Show the browser-only note again") — a close with no
      // reachable inverse is not a toggle.
      if ((keys.length > 0 || shelved.length > 0) && !localNoteDismissed()) {
        var localNote = el("p", { class: "fa-glass-local-note" },
          "Your folio is saved in this browser only \u2014 not sent anywhere, and not visible to anyone else. " +
          "(No \u201Csave\u201D tool is currently enabled.)");
        var dismissNote = el("button", {
          type: "button",
          class: "fa-glass-note-dismiss",
          "aria-label": "Dismiss this note \u2014 you can show it again from Settings",
          title: "Dismiss (Settings can show it again)",
        }, "\u00d7");
        dismissNote.addEventListener("click", function () {
          setLocalNoteDismissed(true);
          if (localNote.parentNode) localNote.parentNode.removeChild(localNote);
          handle.focus();
        });
        localNote.appendChild(dismissNote);
        notes.appendChild(localNote);
      }
      return keys.length;
    }

    /* WHERE A NEW CARD CAN BE SEEN — owner, 2026-09-27: the shelved-items
     * card was placed below every card and so started half under the tile
     * bar. This finds the first spot, scanning the VISIBLE glass top to
     * bottom and left to right, that overlaps no card and none of the glass's
     * own chrome (the Folio handle, the zoom bar, the tile dock). Measured on
     * screen and converted back through the view (`translate` then `scale`,
     * origin 0 0), so it is right at any pan or zoom. With no free spot it
     * falls back to below every card, which is where it used to go. */
    function freeSpotFor(shapes, cards, fallback) {
      var s = view.s || 1;
      var sh = shelf.getBoundingClientRect();
      var lay = layer.getBoundingClientRect();
      var blocks = cards.map(function (c) { return c.getBoundingClientRect(); });
      // The page's own navigation too: the glass spans the viewport, and a
      // card placed under the left rail or sidebar is a card nobody sees.
      [handle, zoomBar, dock, notes, document.querySelector(".fa-nav"), document.querySelector(".side-bar")].forEach(function (n) {
        if (n && n.isConnected) { var r = n.getBoundingClientRect(); if (r.width && r.height) blocks.push(r); }
      });
      var pad = GLASS_GAP;
      var dockTop = dock && dock.isConnected && dock.getBoundingClientRect().height
        ? dock.getBoundingClientRect().top : lay.bottom;
      var bottom = Math.min(lay.bottom, dockTop) - pad;
      // SHAPES TRIED IN TURN, as the caller orders them (wide and short
      // first: the free band on a full glass is usually a strip above or
      // beside the cards rather than a square).
      for (var k = 0; k < shapes.length; k++) {
        var w = shapes[k].width * s, h = shapes[k].height * s;
        for (var y = lay.top + pad; y + h <= bottom; y += 12) {
          for (var x = lay.left + pad; x + w <= lay.right - pad; x += 12) {
            var hit = blocks.some(function (r) {
              return x < r.right + pad && x + w + pad > r.left && y < r.bottom + pad && y + h + pad > r.top;
            });
            if (!hit) {
              return { left: (x - sh.left) / s, top: (y - sh.top) / s, width: shapes[k].width, height: shapes[k].height };
            }
          }
        }
      }
      var geom = { left: fallback.left, top: fallback.top, width: shapes[0].width, height: shapes[0].height };
      if (cards.length > 0) {
        var gs = cards.map(geometryOf);
        geom.top = Math.max.apply(null, gs.map(function (g) { return g.top + g.height; })) + GLASS_GAP;
        geom.left = Math.min.apply(null, gs.map(function (g) { return g.left; }));
      }
      return geom;
    }

    var SHELVED_NOTE_KEY = "fa-glass-shelved-note-dismissed";
    function shelvedNoteDismissedAt() {
      try { return Number(localStorage.getItem(SHELVED_NOTE_KEY) || "0"); } catch (_e) { return 0; }
    }
    function setShelvedNoteDismissedAt(n) {
      try { localStorage.setItem(SHELVED_NOTE_KEY, String(n)); } catch (_e) { /* back next view */ }
    }

    var NOTE_KEY = "fa-glass-local-note-dismissed";
    function localNoteDismissed() {
      try { return localStorage.getItem(NOTE_KEY) === "1"; } catch (_e) { return false; }
    }
    function setLocalNoteDismissed(on) {
      try {
        if (on) localStorage.setItem(NOTE_KEY, "1");
        else localStorage.removeItem(NOTE_KEY);
      } catch (_e) { /* a note that comes back next page is the safe failure */ }
    }

    /* ── THE PANEL a tile opens, above the strip ──────────────────────────
     * One at a time, and the tile that opened it closes it: `l4zi` — the
     * inverse is reachable from the same control. */
    var panel = el("section", {
      class: "fa-glass-panel",
      id: "fa-glass-panel",
      role: "region",
      hidden: "hidden",
    });
    sheet.appendChild(panel);
    var openPanelId = null;
    var panelButtons = {};

    function closePanel() {
      panel.setAttribute("hidden", "hidden");
      while (panel.firstChild) panel.removeChild(panel.firstChild);
      if (openPanelId && panelButtons[openPanelId]) {
        panelButtons[openPanelId].setAttribute("aria-expanded", "false");
      }
      openPanelId = null;
    }

    function openPanel(id, title, build) {
      if (openPanelId === id) { closePanel(); return; }
      closePanel();
      openPanelId = id;
      panel.setAttribute("data-fa-panel", id);
      panel.setAttribute("aria-label", title);
      var head = el("div", { class: "fa-glass-panel-head" });
      var h = el("h2", { class: "fa-glass-panel-title", tabindex: "-1" }, title);
      head.appendChild(h);
      var x = el("button", {
        type: "button",
        class: "fa-glass-panel-close",
        "aria-label": "Close " + title,
      }, "×");
      x.addEventListener("click", function () {
        var b = panelButtons[id];
        closePanel();
        if (b) b.focus();
      });
      head.appendChild(x);
      panel.appendChild(head);
      var body = el("div", { class: "fa-glass-panel-body" });
      panel.appendChild(body);
      build(body);
      panel.removeAttribute("hidden");
      fitPanel();
      // Opened on a folio already dragged away: open where the folio is.
      placePanel();
      if (panelButtons[id]) panelButtons[id].setAttribute("aria-expanded", "true");
      // `preventScroll`: the panel is placed in view, so focusing its title
      // has nothing to bring into view, and a scroll here would move the
      // cards under a panel that does not move with them.
      h.focus({ preventScroll: true });
    }

    /* THE PANEL OPENS IN VIEW, CLEAR OF THE DOCK — wireframe `navbar`
     * Findings ("seen on the build", #2295; first noted in #1810).
     *
     * It used to sit in the glass's FLOW, after the shelf. The shelf is at
     * least 50vh, so at 1280×800 Glass settings opened at y = 591 with its
     * body under the fixed tile dock, and the reader scrolled the glass to
     * reach the controls the tile had just opened. Now the stylesheet takes it
     * out of the flow (`position: fixed`) and this places it in the space the
     * glass actually shows: below the handle and the zoom bar, above the
     * dock's VISIBLE top edge. The panel's height is capped to that space and
     * its body scrolls inside it when the content is taller (Glass settings
     * on a phone), so the frame, its title and its × are never under the dock.
     *
     * The dock's top is read from its STATE, not from its box: it slides for
     * 0.25 s when the strip is shown or hidden, and a box measured mid-slide
     * would size the panel for neither state. Re-run when the strip toggles
     * and when the window resizes. */
    function fitPanel() {
      if (panel.hasAttribute("hidden")) return;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var top = 0;
      [handle, zoomBar].forEach(function (n) {
        if (!n || !n.isConnected) return;
        var r = n.getBoundingClientRect();
        if (r.width && r.height && r.bottom > top && r.bottom < vh / 2) top = r.bottom;
      });
      top += GLASS_GAP;
      var dockTop = vh;
      if (dock && dock.isConnected && dock.offsetHeight) {
        var shown = dock.getAttribute("data-fa-strip") !== "hidden";
        // Hidden, only the header row and the 2px edge stay on screen — the
        // same sum the stylesheet's `translateY` leaves showing.
        var showing = shown ? dock.offsetHeight : dockHead.offsetHeight + 2;
        dockTop = vh - showing;
      }
      panel.style.top = Math.round(top) + "px";
      panel.style.maxHeight = Math.max(0, Math.floor(dockTop - GLASS_GAP - top)) + "px";
    }
    window.addEventListener("resize", fitPanel);

    /* TODOS — the todo list, on the glass, each with a pull-out.
     *
     * Each row DECLARES itself a library item (`data-fa-library-item`), so
     * the one pull-out mechanism paints it, handles its click and reports its
     * three states. A second "pin a todo" path would be a second answer to
     * "how does something get onto the glass". */
    function buildTodos(body) {
      var status = el("p", { class: "fa-glass-panel-status" }, "Loading todos…");
      body.appendChild(status);
      var url = todoIndexUrl();
      fetch(url)
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (doc) {
          var items = doc && Array.isArray(doc.items) ? doc.items : null;
          if (!items) throw new Error("no items");
          var hidden = discardedTodoIds();
          var live = items.filter(function (t) { return t && t.id && hidden.indexOf(t.id) === -1; });
          status.textContent = live.length === 0
            ? "Nothing outstanding."
            : live.length + (live.length === 1 ? " todo" : " todos") +
              ". Press “Pull out to folio” to put one on your glass.";
          var list = el("ul", { class: "fa-glass-todo-list" });
          live.forEach(function (t) {
            var li = el("li", {
              class: "fa-glass-todo",
              "data-fa-library-item": "todo/" + t.id,
              "data-fa-library-title": t.summary || t.id,
              "data-fa-library-href": withBase("/todos/") + "#" + encodeURIComponent(t.id),
              "data-fa-library-kind": "todos",
            });
            var host = el("div", { class: "fa-glass-todo-row", "data-fa-pullout-host": "" });
            host.appendChild(stickyNoteAvatar());
            host.appendChild(el("span", { class: "fa-glass-todo-summary" }, t.summary || t.id));
            li.appendChild(host);
            list.appendChild(li);
          });
          body.appendChild(list);
          body.appendChild(el("a", { class: "fa-glass-panel-more", href: safeHref(withBase("/todos/")) },
            "Open the full todo board"));
          if (document.__faRepaintLibraryRows) document.__faRepaintLibraryRows();
          else paintLibraryRows();
        })
        .catch(function (e) {
          // A third state, said as one: "could not read" is not "nothing to do".
          status.textContent = "The todo list could not be read (" + e.message + "). " +
            "That is not the same as having nothing to do.";
        });
    }

    /* SETTINGS — theme, avatar style, opacity, blur.
     *
     * Radio groups and big buttons rather than a slider alone: the declared
     * interaction profile here is low-dexterity, so every setting is a
     * choice among a few large targets, and the opacity slider has step
     * buttons beside it. */
    function buildSettings(body) {
      function save() { setGlassPrefs(prefs); applyGlassPrefs(layer, prefs); }

      // FIRST: the way to the OTHER settings, where the Discarded fish and the
      // reading preferences are (`ob3m` 12). The glass shuts first, because
      // the launcher's panel lives in the sidebar and the open glass sits
      // over it — a panel opened underneath the glass has not opened.
      var toPage = settingsCrossLink("page", function () { setOpen(false); });
      if (toPage) body.appendChild(toPage);

      function radioGroup(legend, name, options, current, onPick) {
        var fs = el("fieldset", { class: "fa-glass-setting" });
        fs.appendChild(el("legend", {}, legend));
        options.forEach(function (o) {
          var id = "fa-glass-" + name + "-" + o.id;
          var lab = el("label", { class: "fa-glass-choice", for: id });
          var r = el("input", { type: "radio", name: "fa-glass-" + name, id: id, value: o.id });
          if (o.id === current) r.checked = true;
          r.addEventListener("change", function () { if (r.checked) onPick(o); });
          lab.appendChild(r);
          lab.appendChild(el("span", { class: "fa-glass-choice-label" }, o.label));
          lab.appendChild(el("span", { class: "fa-glass-choice-hint" }, o.hint));
          fs.appendChild(lab);
        });
        return fs;
      }

      var opacityOut = el("output", { class: "fa-glass-opacity-value", for: "fa-glass-opacity" });
      var slider = el("input", {
        type: "range", id: "fa-glass-opacity", min: "0", max: "100", step: "10",
        "aria-label": "Glass opacity, percent",
      });
      function showOpacity() {
        slider.value = String(prefs.opacity);
        opacityOut.textContent = prefs.opacity + "%";
      }
      function setOpacity(v) {
        prefs.opacity = Math.max(0, Math.min(100, Math.round(v / 10) * 10));
        showOpacity();
        save();
      }

      body.appendChild(radioGroup("Theme", "theme", GLASS_THEMES, prefs.theme, function (o) {
        prefs.theme = o.id;
        setOpacity(o.opacity);
      }));
      body.appendChild(radioGroup("Avatars", "avatars", GLASS_AVATAR_STYLES, prefs.avatars, function (o) {
        prefs.avatars = o.id;
        save();
        renderShelf();
      }));

      var fs = el("fieldset", { class: "fa-glass-setting" });
      fs.appendChild(el("legend", {}, "Opacity"));
      var row = el("div", { class: "fa-glass-opacity" });
      var less = el("button", { type: "button", class: "fa-glass-step", "aria-label": "Less opaque" }, "−");
      var more = el("button", { type: "button", class: "fa-glass-step", "aria-label": "More opaque" }, "+");
      less.addEventListener("click", function () { setOpacity(prefs.opacity - 10); });
      more.addEventListener("click", function () { setOpacity(prefs.opacity + 10); });
      slider.addEventListener("input", function () { setOpacity(Number(slider.value)); });
      row.appendChild(less);
      row.appendChild(slider);
      row.appendChild(more);
      row.appendChild(opacityOut);
      fs.appendChild(row);
      var blurLab = el("label", { class: "fa-glass-choice" });
      var blurBox = el("input", { type: "checkbox", id: "fa-glass-blur" });
      blurBox.checked = prefs.blur;
      blurBox.addEventListener("change", function () { prefs.blur = blurBox.checked; save(); });
      blurLab.appendChild(blurBox);
      blurLab.appendChild(el("span", { class: "fa-glass-choice-label" }, "Blur what is behind the glass"));
      fs.appendChild(blurLab);
      body.appendChild(fs);
      showOpacity();

      // THE ACTIONS, in one row of their own (bean `zpso`): with the panel
      // laid out in a grid so it fits between the zoom bar and the dock,
      // three full-width buttons stacked one per line were a third of its
      // height. Grouped, they wrap side by side under the settings.
      var actions = el("div", { class: "fa-glass-settings-actions" });
      body.appendChild(actions);

      // THE HARNESSES PANEL (issue #1146): each harness's properties and the
      // skill that edits each. A Settings view, as candidate H drew it.
      // SHORT VISIBLE LABELS, FULL WORDING AS THE TITLE. At 1280×800 in a
      // wide system face (DejaVu Sans, on the Linux CI runner) the long labels
      // wrapped this row onto a second line and pushed "Back to the default
      // glass" under the panel's frame. Each label is the start of its title,
      // so the accessible name is the visible text (WCAG 2.5.3, label in
      // name). The title becomes the button's accessible description, so a
      // screen reader still hears the full wording. No aria-label is set.
      var hc = el("button", { type: "button", class: "fa-glass-reset fa-glass-harnesses",
        title: "Harnesses — properties, and the skill that edits each" }, "Harnesses");
      hc.addEventListener("click", function () { openHarnesses(null); });
      actions.appendChild(hc);

      // THE WAY BACK FROM A MESSY GLASS. Every card returns to the grid;
      // nothing leaves the folio and nothing leaves the glass.
      var tidy = el("button", { type: "button", class: "fa-glass-reset fa-glass-tidy",
        title: "Tidy the glass (put every card back in the grid)" }, "Tidy the glass");
      tidy.addEventListener("click", tidyGlass);
      actions.appendChild(tidy);

      var reset = el("button", { type: "button", class: "fa-glass-reset fa-glass-defaults" }, "Back to the default glass");
      reset.addEventListener("click", function () {
        prefs = { theme: GLASS_DEFAULTS.theme, avatars: GLASS_DEFAULTS.avatars,
                  opacity: GLASS_DEFAULTS.opacity, blur: GLASS_DEFAULTS.blur };
        save();
        renderShelf();
        while (body.firstChild) body.removeChild(body.firstChild);
        buildSettings(body);
      });
      actions.appendChild(reset);
      // THE WAY BACK for the dismissed browser-only note.
      if (localNoteDismissed()) {
        var showNote = el("button", { type: "button", class: "fa-glass-reset fa-glass-note-restore" },
          "Show the browser-only note again");
        showNote.addEventListener("click", function () {
          setLocalNoteDismissed(false);
          renderShelf();
          showNote.parentNode.removeChild(showNote);
        });
        actions.appendChild(showNote);
      }
      actions.appendChild(el("p", { class: "fa-glass-local-note fa-glass-settings-note" },
        "Saved in this browser only."));
    }

    /* ── THE TILE STRIP, along the glass's BOTTOM edge ────────────────────
     *
     * Owner, 2026-09-23: *"where are the todo, fsh guts etc tiles on bottom
     * of glass?"* — which overrides `v0jv`'s *"the tiles must NOT be
     * projected onto the glass"*. The strip reads the SAME declaration the
     * navbar and the board read, filtered to the `glass` surface: one
     * declaration, per-surface visibility, never two registries.
     *
     * Two tiles are the glass's own chrome rather than a graph's viewer:
     * Todos and Settings. The declared `todos` tile is NOT drawn a second
     * time beside them; its page is the "Open the full todo board" link
     * inside the Todos panel. */
    var strip = el("nav", { class: "fa-glass-tiles", id: "fa-glass-strip", "aria-label": "Folio tiles" });

    /* THE STRIP SLIDES AWAY, BY ONE BUTTON — owner, 2026-09-23 (`b8eq`):
     * *"bottom flip panel should be togglebe to stay open, but should slide
     * away"*, and asked when, **"Only by a button"**: it never hides itself.
     *
     * The toggle rides ABOVE the strip in one fixed dock, so when the strip
     * slides down the tab is still on screen — `l4zi`: the inverse of hiding
     * is reachable from the same control. The choice is the reader's and is
     * remembered in this browser. A hidden strip is `inert`, so the keyboard
     * cannot land on a tile nobody can see.
     *
     * AND IT IS INSIDE THE PANEL — owner, 2026-09-24: *"HIDE/show tiles
     * should be inside of tiles panel."* It was a separate bordered tab on a
     * dock that painted nothing, so to the eye it hung outside the panel with
     * a second heavy border stacked on the strip's. Now the DOCK is the
     * panel: it paints the surface and the edge, the toggle sits in the
     * panel's own header row, and the strip below it is the tiles. Hidden,
     * the panel slides down to that header row — still the panel, still
     * holding the way back. */
    /* LINK A DOCUMENT (bean `95sk`, R28) — a reader action on the glass that
     * links an external document by URL onto their folio glass and shows the
     * `bun run cat folio:create --link` command that records it as a
     * `referenced` node in `library/<slug>/`. */
    function slugifyLinkTitle(s) {
      return String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
    function buildLinkDocument(body) {
      body.appendChild(el("p", { class: "fa-glass-panel-status" },
        "Link an external document by URL onto your folio glass. To commit it into the repository's library as a referenced source, run the command shown below."));
      var form = el("form", { class: "fa-glass-link-form", novalidate: "novalidate" });

      var urlField = el("div", { class: "fa-glass-link-field" });
      urlField.appendChild(el("label", { class: "fa-glass-choice-label", for: "fa-glass-link-url" }, "Document URL"));
      var urlInput = el("input", {
        type: "url",
        id: "fa-glass-link-url",
        class: "fa-glass-link-input",
        placeholder: "https://example.org/guideline",
        required: "required",
      });
      urlField.appendChild(urlInput);
      form.appendChild(urlField);

      var titleField = el("div", { class: "fa-glass-link-field" });
      titleField.appendChild(el("label", { class: "fa-glass-choice-label", for: "fa-glass-link-title" }, "Title"));
      var titleInput = el("input", {
        type: "text",
        id: "fa-glass-link-title",
        class: "fa-glass-link-input",
        placeholder: "Document title",
        required: "required",
      });
      titleField.appendChild(titleInput);
      form.appendChild(titleField);

      var slugField = el("div", { class: "fa-glass-link-field" });
      slugField.appendChild(el("label", { class: "fa-glass-choice-label", for: "fa-glass-link-slug" }, "Slug (optional)"));
      var slugInput = el("input", {
        type: "text",
        id: "fa-glass-link-slug",
        class: "fa-glass-link-input",
        placeholder: "my-guideline",
      });
      slugField.appendChild(slugInput);
      form.appendChild(slugField);

      var cmdWrap = el("p", { class: "fa-glass-panel-status fa-glass-link-cmd-wrap" }, "Repository command: ");
      var cmdCode = el("code", { "data-fa-link-command": "" });
      cmdWrap.appendChild(cmdCode);
      form.appendChild(cmdWrap);

      function resolvedSlug() {
        var raw = slugInput.value.trim();
        if (raw) return raw;
        var fromTitle = slugifyLinkTitle(titleInput.value);
        if (fromTitle) return fromTitle;
        return "linked-doc";
      }
      function updateCommandPreview() {
        var u = urlInput.value.trim() || "<url>";
        var t = (titleInput.value.trim() || "<title>").replace(/"/g, "\\\"");
        var s = resolvedSlug();
        cmdCode.textContent = "bun run cat folio:create --link \"" + u + "\" --slug " + s + " --title \"" + t + "\"";
      }
      urlInput.addEventListener("input", updateCommandPreview);
      titleInput.addEventListener("input", updateCommandPreview);
      slugInput.addEventListener("input", updateCommandPreview);
      updateCommandPreview();

      var err = el("p", { class: "fa-glass-link-error", role: "alert", hidden: "hidden" });
      form.appendChild(err);

      var submit = el("button", { type: "submit", class: "fa-glass-reset fa-glass-link-submit" }, "Link document");
      form.appendChild(submit);

      var listHost = el("div", { class: "fa-glass-linked-host" });
      function renderLinkedList() {
        while (listHost.firstChild) listHost.removeChild(listHost.firstChild);
        var all = folioAssets();
        var keys = Object.keys(all).filter(function (k) { return k.indexOf("linked/") === 0; }).sort();
        if (keys.length === 0) return;
        var ul = el("ul", { class: "fa-glass-todo-list fa-glass-linked-list" });
        keys.forEach(function (k) {
          var item = all[k];
          var li = el("li", {
            class: "fa-glass-todo",
            "data-fa-library-item": k,
            "data-fa-library-title": item.title || k,
            "data-fa-library-href": safeHref(item.href) || "",
            "data-fa-library-kind": "library",
          });
          var row = el("div", { class: "fa-glass-todo-row", "data-fa-pullout-host": "" });
          var a = safeHref(item.href)
            ? el("a", { class: "fa-glass-todo-summary", href: safeHref(item.href) }, item.title || k)
            : el("span", { class: "fa-glass-todo-summary" }, item.title || k);
          row.appendChild(a);
          li.appendChild(row);
          ul.appendChild(li);
        });
        listHost.appendChild(ul);
        paintLibraryRows();
      }

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var rawUrl = urlInput.value.trim();
        var rawTitle = titleInput.value.trim();
        var slug = resolvedSlug();
        // Bound straight from safeHref, so the `href: safe` below is checked by
        // construction (scripts/tests/href-safety.test.ts); safeHref(undefined)
        // is undefined, so a non-http(s) URL is still refused.
        var safe = safeHref(/^https?:\/\/\S+$/i.test(rawUrl) ? rawUrl : undefined);
        if (!safe) {
          err.textContent = "Enter an http:// or https:// URL to link a document.";
          err.removeAttribute("hidden");
          urlInput.focus();
          return;
        }
        if (!rawTitle) {
          err.textContent = "Enter a title for the linked document.";
          err.removeAttribute("hidden");
          titleInput.focus();
          return;
        }
        if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
          err.textContent = "Slug must use lower-case letters, digits and hyphens.";
          err.removeAttribute("hidden");
          slugInput.focus();
          return;
        }
        err.setAttribute("hidden", "hidden");
        err.textContent = "";
        displayInFolio("linked/" + slug, {
          title: rawTitle,
          href: safe,
          kind: "library",
        });
        glassLive.textContent = "Linked " + rawTitle + " onto your folio glass.";
        urlInput.value = "";
        titleInput.value = "";
        slugInput.value = "";
        updateCommandPreview();
        renderLinkedList();
      });

      body.appendChild(form);
      body.appendChild(listHost);
      renderLinkedList();
    }

    var dock = el("div", { class: "fa-glass-dock" });
    var dockHead = el("div", { class: "fa-glass-dock-head" });
    var linkDocBtn = el("button", {
      type: "button",
      class: "fa-glass-link-doc",
      "data-fa-glass-action": "link-document",
      "aria-expanded": "false",
      "aria-controls": "fa-glass-panel",
      title: "Link an external document by URL into your folio",
    }, "Link a document");
    panelButtons["glass-link-document"] = linkDocBtn;
    linkDocBtn.addEventListener("click", function () {
      openPanel("glass-link-document", "Link a document", buildLinkDocument);
    });
    dockHead.appendChild(linkDocBtn);
    var stripToggle = el("button", {
      type: "button",
      class: "fa-glass-strip-toggle",
      "aria-controls": "fa-glass-strip",
    });
    dockHead.appendChild(stripToggle);
    dock.appendChild(dockHead);
    dock.appendChild(strip);
    sheet.appendChild(dock);
    /* HIDDEN UNTIL ASKED FOR — owner, 2026-10-01: *"have folio bottom strip
     * tiles default to hidden away when folio first opened"*. So with no
     * stored choice the folio opens with the strip slid away and only this
     * tab showing, which says how many tiles are behind it. The tab is still
     * the one control both ways (`l4zi`), and a reader's choice either way is
     * remembered as "1" or "0". Unreadable storage counts as no choice:
     * hidden, the stated default, rather than a guess at a choice. */
    var STRIP_HIDDEN_KEY = "fa-glass-strip-hidden";
    function stripWasHidden() {
      try { return localStorage.getItem(STRIP_HIDDEN_KEY) !== "0"; } catch (_e) { return true; }
    }
    function labelStripToggle() {
      var h = dock.getAttribute("data-fa-strip") === "hidden";
      var total = typeof stripTotal === "function" ? stripTotal() : null;
      while (stripToggle.firstChild) stripToggle.removeChild(stripToggle.firstChild);
      stripToggle.appendChild(el("span", { "aria-hidden": "true" }, h ? "\u25B4 " : "\u25BE "));
      stripToggle.appendChild(document.createTextNode(h ? "Show tiles" : "Hide tiles"));
      if (h && total !== null) {
        stripToggle.appendChild(el("span", { class: "fa-glass-strip-count" }, " (" + total + ")"));
      }
      stripToggle.title = h ? "Bring the tiles back" : "Slide the tiles away \u2014 this tab brings them back";
    }
    function setStripHidden(h) {
      dock.setAttribute("data-fa-strip", h ? "hidden" : "shown");
      if (h) strip.setAttribute("inert", ""); else strip.removeAttribute("inert");
      stripToggle.setAttribute("aria-expanded", h ? "false" : "true");
      labelStripToggle();
      // An open panel's room changes with the dock's visible height.
      fitPanel();
    }
    stripToggle.addEventListener("click", function () {
      var h = dock.getAttribute("data-fa-strip") !== "hidden";
      setStripHidden(h);
      try {
        localStorage.setItem(STRIP_HIDDEN_KEY, h ? "1" : "0");
      } catch (_e) { /* next page: hidden, the default */ }
      glassLive.textContent = h ? "Tiles hidden. The Show tiles tab brings them back." : "Tiles shown.";
    });
    setStripHidden(stripWasHidden());

    /* A CHROME TILE IS DECLARED ONCE and drawn wherever the reader keeps it —
     * on the strip, or in More (owner, 2026-09-23: *"should be able to drag and
     * drop 'more' tiles between it and bottom"*). */
    var chromeDefs = {};
    function chromeTile(id, label, glyph, title, build) {
      chromeDefs[id] = { label: label, glyph: glyph, title: title, build: build };
    }
    /** A chrome tile's button. `onStrip`: the copy whose pressed state the panel reports. */
    function makeChromeTile(id, onStrip) {
      var d = chromeDefs[id];
      var b = el("button", {
        type: "button",
        // NOT `data-fa-tile` and not `.fa-tile`: those mark a DECLARED graph
        // tile, and every one of them opens "the declared visualisation of" a
        // directory. These two are the glass's own controls, and wearing the
        // graph tiles' marker would make them count as graph tiles.
        class: "fa-glass-chrome-tile",
        "data-fa-glass-chrome": id,
        "aria-expanded": "false",
        "aria-controls": "fa-glass-panel",
        "aria-label": d.title,
      });
      b.appendChild(el("span", { class: "fa-glass-tile-glyph", "aria-hidden": "true" }, d.glyph));
      b.appendChild(el("span", { class: "fa-tile-caption" }, d.label));
      b.addEventListener("click", function () { openPanel(id, d.title, d.build); });
      if (onStrip) panelButtons[id] = b;
      return b;
    }
    chromeTile("glass-todos", "Todos", "☑", "Todos — pull one onto your glass", buildTodos);
    /* ── THE FILTER — bean `7m6g`, issue #1075 ─────────────────────────────
     *
     * Owner, 2026-09-21: *"visualizer filter by document, library, graph, and
     * one each thing in folio (working space)"*. Owner, 2026-09-23, choosing
     * its shape: **"Kind + From + items"** — a Kind select, a From select, and
     * a checkbox per item, which keeps WHAT a thing is apart from WHERE it
     * came from. #764's finding was three axes conflated into one; this does
     * not repeat it one level down.
     *
     * THE READER'S, AND IT COMMITS NOTHING. Same rule as `reader-filter.ts`
     * on the board: session state, no store, no event anybody persists. Same
     * logic too — AND across axes, and a hidden item is simply not shown.
     *
     * OPTIONS COME FROM THE GLASS, never from a list: a Kind or a From that
     * nothing on the glass carries is not offered, so no choice can match
     * nothing (the board filter's `propertyValues` rule). */
    var glassFilter = { kind: "", from: "", hidden: {} };

    /** Every item on the glass, described by its two axes. */
    function glassItems() {
      var out = [];
      Array.prototype.forEach.call(layer.querySelectorAll(".fa-glass-asset"), function (c) {
        var key = c.getAttribute("data-fa-asset") || "";
        var kind = c.getAttribute("data-fa-asset-kind");
        // A PINNED STICKY is a folio asset like any other (#1925), so it is
        // read here with the rest — there is no second, floating list.
        var todo = kind === "todos";
        var sticky = kind === "sticky";
        var pinned = kind === "bookmark" || kind === "pin";
        out.push({
          el: c,
          key: key,
          title: c.getAttribute("aria-label") || key,
          kind: todo ? "todo" : sticky ? "sticky" : pinned ? kind : "book",
          from: todo ? "Todo board" : sticky ? (c.getAttribute("data-fa-home-label") || "Home page")
            : pinned ? (c.getAttribute("data-fa-source") || c.getAttribute("data-fa-node-kind") || "Pinned")
            : key.split("/")[0] + " library",
        });
      });
      return out;
    }

    var KIND_LABELS = { book: "Books", todo: "Todos", sticky: "Stickies", bookmark: "Bookmarks", pin: "Pinned blocks" };

    /** Show or hide each item; say so when a filter hides everything. */
    function applyGlassFilter() {
      var items = glassItems();
      var shown = 0;
      items.forEach(function (it) {
        var keep = (!glassFilter.kind || it.kind === glassFilter.kind) &&
          (!glassFilter.from || it.from === glassFilter.from) &&
          !glassFilter.hidden[it.key];
        if (keep) { it.el.removeAttribute("data-fa-filtered-out"); shown++; }
        else it.el.setAttribute("data-fa-filtered-out", "");
      });
      layer.setAttribute("data-fa-glass-shown", String(shown));
      var note = sheet.querySelector(".fa-glass-filtered-note");
      var active = glassFilter.kind || glassFilter.from || Object.keys(glassFilter.hidden).length;
      // A DETERMINED empty, and it says which: "nothing matches" and "nothing
      // is on your glass" are opposite facts about the same blank glass.
      if (active && items.length > 0 && shown === 0) {
        if (!note) {
          note = el("p", { class: "fa-glass-filtered-note", role: "status" },
            "Nothing on your glass matches this filter. Clearing it brings everything back.");
          sheet.insertBefore(note, shelf);
        }
      } else if (note) {
        note.parentNode.removeChild(note);
      }
      var status = panel.querySelector(".fa-glass-filter-status");
      if (status) status.textContent = "Showing " + shown + " of " + items.length + ".";
      return shown;
    }

    function buildFilter(body) {
      var items = glassItems();
      if (items.length === 0) {
        body.appendChild(el("p", { class: "fa-glass-panel-status" },
          "Nothing is on your glass yet, so there is nothing to filter."));
        return;
      }
      function selectFor(label, axis, values, labelOf) {
        var fs = el("fieldset", { class: "fa-glass-setting" });
        fs.appendChild(el("legend", {}, label));
        var sel = el("select", { class: "fa-glass-filter-select", id: "fa-glass-filter-" + axis,
                                 "aria-label": label });
        sel.appendChild(el("option", { value: "" }, "Any"));
        values.forEach(function (v) {
          var o = el("option", { value: v }, labelOf ? labelOf(v) : v);
          if (glassFilter[axis] === v) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener("change", function () { glassFilter[axis] = sel.value; applyGlassFilter(); });
        fs.appendChild(sel);
        return fs;
      }
      function uniq(key) {
        var seen = {};
        return items.map(function (i) { return i[key]; })
          .filter(function (v) { if (seen[v]) return false; seen[v] = true; return true; })
          .sort();
      }
      body.appendChild(selectFor("Kind", "kind", uniq("kind"), function (v) { return KIND_LABELS[v] || v; }));
      body.appendChild(selectFor("From", "from", uniq("from")));

      var fs = el("fieldset", { class: "fa-glass-setting" });
      fs.appendChild(el("legend", {}, "Items"));
      items.forEach(function (it) {
        var id = "fa-glass-item-" + it.key.replace(/[^A-Za-z0-9_-]/g, "_");
        var lab = el("label", { class: "fa-glass-choice", for: id });
        var box = el("input", { type: "checkbox", id: id, "data-fa-filter-item": it.key });
        box.checked = !glassFilter.hidden[it.key];
        box.addEventListener("change", function () {
          if (box.checked) delete glassFilter.hidden[it.key];
          else glassFilter.hidden[it.key] = true;
          applyGlassFilter();
        });
        lab.appendChild(box);
        lab.appendChild(el("span", { class: "fa-glass-choice-label" }, it.title));
        lab.appendChild(el("span", { class: "fa-glass-choice-hint" },
          (KIND_LABELS[it.kind] || it.kind).replace(/s$/, "") + " \u00b7 " + it.from));
        fs.appendChild(lab);
      });
      body.appendChild(fs);

      body.appendChild(el("p", { class: "fa-glass-filter-status", role: "status" }, ""));
      var clear = el("button", { type: "button", class: "fa-glass-reset fa-glass-filter-clear" },
        "Clear the filter \u2014 show everything");
      clear.addEventListener("click", function () {
        glassFilter = { kind: "", from: "", hidden: {} };
        applyGlassFilter();
        while (body.firstChild) body.removeChild(body.firstChild);
        buildFilter(body);
      });
      body.appendChild(clear);
      body.appendChild(el("p", { class: "fa-glass-local-note" },
        "This filter changes only your view, for now — nothing is saved or removed."));
      applyGlassFilter();
    }
    chromeTile("glass-filter", "Filter", "\u25BD", "Filter your glass \u2014 by kind, by where it came from, or item by item", buildFilter);

    // NAMED FOR WHAT IT SETS — bean `ob3m` finding 12, owner's ruling
    // 2026-10-01 (option 2 of 4): "Glass settings" here and "Page settings"
    // on the ▦ launcher, each with a link to the other at the top of its
    // panel. See `SETTINGS_NAMES` for why the names live in one place.
    //
    // This SUPERSEDES the comment that stood here, which renamed only this
    // tile ("Folio settings") and rejected cross-links as asserting "a
    // relationship between site chrome and board state that does not exist".
    // The relationship a reader needs is not between the settings but between
    // the PLACES: someone looking for the Discarded fish in the wrong panel
    // has to be told where the right one is. The owner chose the links.
    //
    // The TITLE leads with the name, because it is both the tile's accessible
    // name and the panel's heading — a heading reading "Theme, avatars,
    // opacity" under a tile captioned otherwise was a third name for it.
    //
    // The `id` stays `glass-settings`. Every glass test keys on
    // `data-fa-glass-chrome="glass-settings"` and the `glassStrip` pins resolve to it, so
    // the id is the contract and the label is the prose.
    chromeTile("glass-settings", SETTINGS_NAMES.glass, "⚙",
               SETTINGS_NAMES.glass + " \u2014 " + SETTINGS_SCOPES.glass, buildSettings);
    // The Page settings' "Glass settings →" lands here: the glass pulled down
    // and this panel open. Never a toggle — `openPanel` CLOSES a panel that is
    // already open, and a link that sometimes shuts its own target is not a link.
    settingsOpeners.glass = function () {
      if (layer.getAttribute("data-fa-glass") !== "open") setOpen(true);
      if (openPanelId === "glass-settings") {
        var h = panel.querySelector(".fa-glass-panel-title");
        if (h) h.focus();
        return;
      }
      var d = chromeDefs["glass-settings"];
      openPanel("glass-settings", d.title, d.build);
    };

    /* ── HARNESSES — the config panel, issue #1146 ────────────────────────
     *
     * Owner, 2026-09-23: *"add to cat-harness harness visualize a config
     * panel/popup which shows properties of cat-harness and other instances.
     * add in to render appropraite edit skills as well."* The design is the
     * owner's pick from `docs/wireframes/harness-config/`, **Hybrid**: this
     * glass panel, grouped Instantiated here / In this checkout / Associated
     * ↗ remote, with a property table and the skills that edit each property;
     * and a ⚙ on every sidebar divider that opens it with that harness chosen.
     *
     * Every value is GENERATED (`harness-panel.ts` → `_data/harness.json` →
     * `assets/harness/config.json`). This decides nothing but layout. */
    var harnessConfigData = null;
    function harnessConfig(done) {
      if (harnessConfigData) return done(harnessConfigData);
      fetch(withBase("/assets/harness/config.json"))
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (c) { harnessConfigData = c && Array.isArray(c.harnesses) ? c : null; done(harnessConfigData); })
        .catch(function (e) {
          console.warn("docs-ui: the harness config could not be read (" + e.message + ").");
          done(null);
        });
    }

    function buildHarnesses(body, selected) {
      var status = el("p", { class: "fa-glass-panel-status" }, "Loading…");
      body.appendChild(status);
      harnessConfig(function (c) {
        if (!c) {
          status.textContent = "The harness configuration could not be read. That is not the same as there being none.";
          return;
        }
        // `subscribed` (issue #1719) is absent from a harness.json built before
        // the field existed; absent reads as none, never as an error.
        var subscribed = c.subscribed || [];
        status.textContent = c.harnesses.length + " harnesses here, " + c.associated.length + " associated, " + subscribed.length + " subscribed.";
        var wrap = el("div", { class: "fa-hc", "data-fa-hc-view": selected ? "detail" : "list" });
        var list = el("div", { class: "fa-hc-list" });
        var detail = el("div", { class: "fa-hc-detail", "aria-live": "polite" });
        wrap.appendChild(list);
        wrap.appendChild(detail);
        body.appendChild(wrap);
        var skillsFor = {};
        c.properties.forEach(function (p) { skillsFor[p.key] = p; });
        var buttons = [];

        // An edit link the platform's one recipe rebuilds (edit-links.js, bean v433).
        function editLink(a) { a.setAttribute("data-fa-link", "edit"); return a; }
        function link(href, text, label) {
          var a = el("a", { href: safeHref(href), class: "fa-hc-link" }, text);
          if (label) a.setAttribute("aria-label", label);
          if (/^https?:/.test(href)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
          return a;
        }
        function skillCell(key) {
          var td = el("td", { class: "fa-hc-skills" });
          var p = skillsFor[key];
          if (!p) return td;
          if (p.gap) td.appendChild(el("span", { class: "fa-hc-gap" }, "no skill yet"));
          p.skills.forEach(function (s, i) {
            if (i > 0) td.appendChild(document.createTextNode(" "));
            td.appendChild(s.path ? link(withBase(s.path), s.name) : el("span", {}, s.name));
          });
          return td;
        }
        function table(rows) {
          var t = el("table", { class: "fa-hc-table" });
          var hr = el("tr", {});
          ["Property", "Value", "Edit with"].forEach(function (h) { hr.appendChild(el("th", { scope: "col" }, h)); });
          var th = el("thead", {}); th.appendChild(hr); t.appendChild(th);
          var tb = el("tbody", {});
          rows.forEach(function (r) {
            var tr = el("tr", {});
            var k = el("th", { scope: "row" });
            k.appendChild(el("code", {}, r.key));
            tr.appendChild(k);
            var v = el("td", {});
            if (r.node) v.appendChild(r.node); else v.textContent = r.value;
            tr.appendChild(v);
            tr.appendChild(skillCell(r.key));
            tb.appendChild(tr);
          });
          t.appendChild(tb);
          return t;
        }

        function show(kind, item, btn) {
          buttons.forEach(function (b) { b.setAttribute("aria-current", b === btn ? "true" : "false"); });
          while (detail.firstChild) detail.removeChild(detail.firstChild);
          wrap.setAttribute("data-fa-hc-view", "detail");
          var back = el("button", { type: "button", class: "fa-hc-back" }, "← Harnesses");
          back.addEventListener("click", function () {
            wrap.setAttribute("data-fa-hc-view", "list");
            if (btn) btn.focus();
          });
          detail.appendChild(back);
          var h = el("h3", { class: "fa-hc-title", tabindex: "-1" }, item.title + " ");
          h.appendChild(el("code", {}, item.name));
          detail.appendChild(h);
          var acts = el("p", { class: "fa-hc-actions" });
          if (kind === "subscribed") {
            acts.appendChild(link(item.url, "Open at the pin ↗", "Open " + item.title + " at its pinned commit"));
            acts.appendChild(editLink(link(item.editHref, "✎ Its repository", "Edit " + item.title + " in its own repository")));
            detail.appendChild(acts);
            var srows = [
              { key: "name", value: item.name },
              { key: "repository", value: item.repository },
              { key: "ref", value: item.ref },
              { key: "subscription", value: item.subscription },
              { key: "harness", value: item.chosen ? "chosen, not yet instantiated" : "not chosen: referenced only" },
            ];
            if (item.note) srows.push({ key: "note", value: item.note });
            srows.push({ key: "declared by", value: item.declaredBy.join(", ") });
            var st = table(srows);
            // The rows of a subscription are edited where it is DECLARED.
            Array.prototype.forEach.call(st.querySelectorAll("tbody td.fa-hc-skills"), function (td) {
              td.appendChild(link(withBase("/reference/skill-instructions/kg-subscription.html"), "kg-subscription"));
            });
            detail.appendChild(st);
            detail.appendChild(el("p", { class: "fa-hc-note" },
              "Subscribed: pinned, and not instantiated here. Its parts are copied only when chosen, through the five gates."));
          } else if (kind === "associated") {
            acts.appendChild(link(item.url, "Open ↗", "Open " + item.title + " (its own site)"));
            if (item.editHref) acts.appendChild(editLink(link(item.editHref, "✎ Its repository", "Edit " + item.title + " in its own repository")));
            detail.appendChild(acts);
            var rows = [
              { key: "name", value: item.name },
              { key: "url", value: item.url },
            ];
            if (item.repository) rows.push({ key: "repository", value: item.repository });
            if (item.relation) rows.push({ key: "relation", value: item.relation });
            if (item.note) rows.push({ key: "note", value: item.note });
            rows.push({ key: "declared by", value: item.declaredBy.join(", ") });
            var t = table(rows);
            // The rows of an association are edited where it is DECLARED.
            Array.prototype.forEach.call(t.querySelectorAll("tbody td.fa-hc-skills"), function (td) {
              td.appendChild(link(withBase("/reference/skill-instructions/associate-harness.html"), "associate-harness"));
            });
            detail.appendChild(t);
            detail.appendChild(el("p", { class: "fa-hc-note" },
              "Associated: referenced, never loaded. Nothing here builds or copies it."));
          } else {
            if (item.editHref) acts.appendChild(editLink(link(item.editHref, "✎ Edit " + item.declaredIn, "Edit " + item.title + "'s declaration, " + item.declaredIn)));
            else acts.appendChild(el("span", { class: "fa-hc-note" }, item.declaredIn));
            detail.appendChild(acts);
            var declared = {};
            item.declared.forEach(function (d) { declared[d.key] = d.summary; });
            detail.appendChild(table(item.declared.map(function (d) { return { key: d.key, value: d.summary }; })));
            var rest = c.properties.filter(function (p) { return !(p.key in declared); });
            if (rest.length) {
              var more = el("details", { class: "fa-hc-undeclared" });
              more.appendChild(el("summary", {}, rest.length + " properties not declared (inherited or default)"));
              more.appendChild(table(rest.map(function (p) { return { key: p.key, value: "—" }; })));
              detail.appendChild(more);
            }
          }
          h.focus();
        }

        var groups = [
          { id: "instantiated", label: "Instantiated here", items: c.harnesses.filter(function (x) { return x.group === "instantiated"; }) },
          { id: "checkout", label: "In this checkout", items: c.harnesses.filter(function (x) { return x.group === "checkout"; }) },
          { id: "associated", label: "Associated ↗ remote", items: c.associated },
          { id: "subscribed", label: "Subscribed ↗ remote", items: subscribed },
        ];
        var chosen = null;
        groups.forEach(function (g) {
          var sec = el("section", { class: "fa-hc-group", "data-fa-hc-group": g.id });
          var hid = "fa-hc-g-" + g.id;
          sec.appendChild(el("h3", { id: hid }, g.label + " (" + g.items.length + ")"));
          var ul = el("ul", { "aria-labelledby": hid });
          if (g.items.length === 0) ul.appendChild(el("li", { class: "fa-hc-note" }, "none"));
          g.items.forEach(function (item) {
            var li = el("li", {});
            var b = el("button", { type: "button", class: "fa-hc-item", "aria-current": "false" }, item.title);
            if (item.title !== item.name) b.appendChild(el("code", {}, item.name));
            var kind = g.id === "associated" || g.id === "subscribed" ? g.id : "local";
            b.addEventListener("click", function () { show(kind, item, b); });
            buttons.push(b);
            li.appendChild(b);
            ul.appendChild(li);
            if (selected && item.name === selected && !chosen) chosen = [kind, item, b];
          });
          sec.appendChild(ul);
          list.appendChild(sec);
        });
        if (c.findings && c.findings.length) {
          var f = el("details", { class: "fa-hc-findings" });
          f.appendChild(el("summary", {}, c.findings.length + " findings"));
          var ful = el("ul", {});
          c.findings.forEach(function (s) { ful.appendChild(el("li", {}, s)); });
          f.appendChild(ful);
          list.appendChild(f);
        }
        if (chosen) show(chosen[0], chosen[1], chosen[2]);
        else wrap.setAttribute("data-fa-hc-view", "list");
      });
    }
    var HARNESSES_TITLE = "Harnesses — each one's properties, and the skill that edits each";
    // NOT A STRIP TILE. Owner, 2026-09-23: *"too many tiles!"* — the strip is
    // the glass's four. The panel is reached from Settings (candidate H drew it
    // as a Settings view) and from the ⚙ on each sidebar divider.
    function openHarnesses(name) {
      if (openPanelId === "glass-harnesses") closePanel();
      openPanel("glass-harnesses", HARNESSES_TITLE, function (b) { buildHarnesses(b, name); });
    }
    // THE SIDEBAR'S ⚙ — one per divider, rendered by `nav_footer_custom.html`.
    // Delegated, because the sidebar is drawn by Jekyll and knows no script.
    document.addEventListener("click", function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest("[data-fa-harness-config]") : null;
      if (!t) return;
      ev.preventDefault();
      var name = t.getAttribute("data-fa-harness-config");
      setOpen(true);
      openHarnesses(name);
    });

    /* ── MORE, not twenty tiles — owner, 2026-09-23: *"too many tiles!"* ──
     *
     * The strip held every declared visualisation — twenty-one on this site —
     * which ran off the edge of a laptop screen. Offered three shapes, the
     * owner chose **"Few + a More tile"**: the glass's own tiles (Todos,
     * Filter, Settings) stay on the strip, and ONE More tile opens a panel
     * listing every declared visualisation.
     *
     * The list is the SAME declaration filtered to the `glass` surface and
     * drawn by the same `renderGraphTiles`: moving the tiles into a panel
     * changes where they are, not what they are. */
    /* THE READER ARRANGES THEM — owner, 2026-09-23 (`b8eq`): *"should be
     * able to drag and drop 'more' tiles between it and bottom"*, and asked
     * which may move, **"Only More is fixed"**. So every tile — the glass's
     * own and every declared visualisation — lives on the strip or in More,
     * as the reader chooses, and More itself never leaves the strip: it is the
     * way to everything that is not there.
     *
     * DRAGGING IS THE ACCELERATOR, never the only way (WCAG 2.5.7, and this
     * instance's declared low-dexterity profile). Every tile in More has a
     * "Strip" button and every strip tile is listed with a "More" button, so
     * the whole arrangement can be made by pressing.
     *
     * The arrangement is the READER'S and is remembered in this browser — a
     * view preference like the theme, never a change to the declaration. */
    var STRIP_KEY = "fa-glass-strip";
    /* THE DEFAULT STRIP IS DECLARED — owner, 2026-10-01, bean `ob3m` finding
     * 10, option 1 of 4: **"Pinned tiles first, plus '+N more'"**. The
     * instance's `glassStrip` declaration names the pins (Todos, Settings,
     * library, processes, tools, skills here), `sync-docs-harness.ts`
     * resolves each kind to one tile id, and the page reads the ids from
     * `<meta name="fa-glass-strip">` — or, on a page no Jekyll wrote, from
     * `assets/harness/glass-strip.json`. Nothing here names a kind.
     *
     * `STRIP_CHROME_ONLY` is what a page gets when NOTHING declared a strip:
     * the glass's own two controls, never a guess at which graphs matter. */
    var STRIP_CHROME_ONLY = ["glass-todos", "glass-settings"];
    function stripIdList(v) {
      return Array.isArray(v)
        ? v.filter(function (x) { return typeof x === "string" && x !== "glass-more"; })
        : null;
    }
    function declaredStripFromMeta() {
      var meta = document.querySelector('meta[name="fa-glass-strip"]');
      if (!meta) return null;
      try { return stripIdList(JSON.parse(meta.getAttribute("content") || "null")); } catch (_e) { return null; }
    }
    // True once the READER has arranged the strip: their arrangement then
    // wins over the declaration, as the theme does (Q9: declared default,
    // reader may override).
    var stripArranged = false;
    function loadStrip() {
      try {
        var v = stripIdList(JSON.parse(localStorage.getItem(STRIP_KEY) || "null"));
        if (v) { stripArranged = true; return v; }
      } catch (_e) { /* unreadable: the declared strip */ }
      return (declaredStripFromMeta() || STRIP_CHROME_ONLY).slice();
    }
    var stripIds = loadStrip();
    function saveStrip() {
      stripArranged = true;
      try { localStorage.setItem(STRIP_KEY, JSON.stringify(stripIds)); } catch (_e) { /* next page: the default */ }
    }

    /** The declared glass tiles, read once. `null` while unread or unreadable. */
    var declaredTiles = null;
    function withDeclared(done) {
      if (declaredTiles) return done(declaredTiles);
      glassTileList(function (tiles) {
        if (tiles) declaredTiles = tiles.filter(function (t) { return t && t.id !== "todos"; });
        done(declaredTiles);
      });
    }
    function declaredById(id) {
      if (!declaredTiles) return null;
      for (var i = 0; i < declaredTiles.length; i++) if (declaredTiles[i].id === id) return declaredTiles[i];
      return null;
    }
    /** One declared tile, drawn by the one template — or null if it is not for this surface. */
    function declaredTileEl(t) {
      var box = el("div");
      renderGraphTiles([t], "glass", box, readerShownTiles());
      return box.firstChild;
    }
    function labelOf(id) {
      if (chromeDefs[id]) return chromeDefs[id].label;
      var t = declaredById(id);
      if (!t || !t.title) return id;
      return t.qualifier ? t.title + " \u00b7 " + t.qualifier : t.title;
    }

    function renderStrip() {
      Array.prototype.slice.call(strip.querySelectorAll("[data-fa-strip-item]")).forEach(function (n) {
        strip.removeChild(n);
      });
      Object.keys(panelButtons).forEach(function (k) { if (k !== "glass-more" && k !== "glass-link-document") delete panelButtons[k]; });
      var waiting = false;
      stripIds.forEach(function (id) {
        var node = null;
        if (chromeDefs[id]) node = makeChromeTile(id, true);
        else if (declaredTiles) { var t = declaredById(id); node = t ? declaredTileEl(t) : null; }
        else waiting = true;
        if (!node) return;
        node.setAttribute("data-fa-strip-item", id);
        wireTileDrag(node, id);
        strip.insertBefore(node, moreBtn);
      });
      if (openPanelId && panelButtons[openPanelId]) panelButtons[openPanelId].setAttribute("aria-expanded", "true");
      // A declared tile on the strip needs the list; drawn when it arrives.
      if (waiting) withDeclared(function (t) { if (t) renderStrip(); });
      // The count needs the list too, even when no declared tile is pinned.
      else if (!declaredTiles) withDeclared(function (t) { if (t) fitStrip(); });
      fitStrip();
    }

    /* ── FIT, NOT SCROLL — owner, 2026-10-01, bean `ob3m` finding 10 ──────
     *
     * The strip once held 25 tiles in one row and scrolled them sideways
     * with no arrow, count or fade: 11 visible at 1280 px, about 2½ at 390,
     * and the rest off-screen with nothing saying so. The ruling: **no tile
     * may be silently off-screen.** So the strip never scrolls. It shows as
     * many pinned tiles as fit, in declared order, and the last tile says
     * "+N more", where N is EXACTLY the number of tiles not on screen —
     * pinned ones that did not fit at this width plus everything in More.
     * Shown + N is always the total, which is what the e2e test asserts.
     *
     * Refitted whenever the strip's box changes (a resize, the glass
     * opening), because "what fits" is a fact about this width only. */
    var overflowIds = [];
    /** Every tile the glass can draw, chrome and declared — or null while the list is unread. */
    function stripTotal() {
      if (!declaredTiles) return null;
      var n = 0;
      Object.keys(chromeDefs).forEach(function (id) { if (id !== "glass-more") n++; });
      declaredTiles.forEach(function (t) { if (declaredTileEl(t)) n++; });
      return n;
    }
    function stripItems() {
      return Array.prototype.slice.call(strip.querySelectorAll("[data-fa-strip-item]"));
    }
    function labelMore() {
      var total = stripTotal();
      var shown = stripItems().filter(function (n) { return !n.hasAttribute("hidden"); }).length;
      var cap = moreBtn.querySelector(".fa-tile-caption");
      if (total === null) {
        moreBtn.removeAttribute("data-fa-more-count");
        moreBtn.setAttribute("aria-label", chromeDefs["glass-more"].title);
        if (cap) cap.textContent = "More";
        return;
      }
      var n = Math.max(0, total - shown);
      moreBtn.setAttribute("data-fa-more-count", String(n));
      moreBtn.setAttribute("aria-label", n === 0 ? "More \u2014 every tile is on the strip"
        : n + (n === 1 ? " more tile" : " more tiles"));
      moreBtn.title = chromeDefs["glass-more"].title;
      if (cap) cap.textContent = n === 0 ? "More" : "+" + n + " more";
      labelStripToggle();
    }
    var lastOverflow = "";
    function fitStrip() {
      var items = stripItems();
      items.forEach(function (n) { n.removeAttribute("hidden"); n.removeAttribute("data-fa-overflow"); });
      overflowIds = [];
      labelMore();
      // Not laid out (the glass is down): nothing to measure, and hiding every
      // tile because the strip is 0 px wide would be a lie about the width.
      if (strip.clientWidth > 0) {
        var cs = getComputedStyle(strip);
        var rtl = cs.direction === "rtl";
        var box = strip.getBoundingClientRect();
        var edge = rtl ? box.left + parseFloat(cs.paddingLeft) : box.right - parseFloat(cs.paddingRight);
        var past = function () {
          var r = moreBtn.getBoundingClientRect();
          return rtl ? r.left < edge - 0.5 : r.right > edge + 0.5;
        };
        var shown = items.slice();
        while (shown.length && past()) {
          var last = shown.pop();
          last.setAttribute("hidden", "");
          last.setAttribute("data-fa-overflow", "");
          overflowIds.unshift(last.getAttribute("data-fa-strip-item"));
          labelMore();
        }
      }
      var sig = overflowIds.join(" ");
      if (sig !== lastOverflow) {
        lastOverflow = sig;
        // More lists what the strip cannot show, so it changes with the width.
        if (openPanelId === "glass-more") {
          var body = panel.querySelector(".fa-glass-panel-body");
          if (body) { while (body.firstChild) body.removeChild(body.firstChild); buildMore(body); }
        }
      }
    }
    var fitQueued = false;
    function queueFit() {
      if (fitQueued) return;
      fitQueued = true;
      (window.requestAnimationFrame || setTimeout)(function () { fitQueued = false; fitStrip(); });
    }
    if (typeof ResizeObserver === "function") new ResizeObserver(queueFit).observe(strip);
    else window.addEventListener("resize", queueFit);

    function moveTile(id, toStrip, index) {
      if (id === "glass-more") return;
      var was = stripIds.indexOf(id);
      if (was !== -1) stripIds.splice(was, 1);
      if (toStrip) {
        if (index == null || index < 0 || index > stripIds.length) index = stripIds.length;
        stripIds.splice(index, 0, id);
      }
      saveStrip();
      if (!toStrip && openPanelId === id) closePanel();
      renderStrip();
      if (openPanelId === "glass-more") {
        var body = panel.querySelector(".fa-glass-panel-body");
        if (body) {
          while (body.firstChild) body.removeChild(body.firstChild);
          // FOCUS FOLLOWS THE TILE: the button just pressed is gone, so the
          // keyboard lands on the same tile's button in its new place.
          buildMore(body, function () {
            var sel = toStrip ? '[data-fa-strip-row="' + id + '"] button'
                              : '[data-fa-more-item="' + id + '"] button.fa-glass-arrange';
            var f = body.querySelector(sel);
            if (f) f.focus();
          });
        }
      }
      glassLive.textContent = labelOf(id) + (toStrip ? " is on the strip." : " is in More.");
    }

    /* DRAG, by pointer — mouse, pen and finger alike. A mouse drags once it
     * has moved a few pixels; a finger PRESSES AND HOLDS first, because a
     * finger that moves at once is scrolling the strip or the panel. */
    var tileDrag = null;
    function wireTileDrag(node, id) {
      node.setAttribute("data-fa-draggable-tile", id);
      node.setAttribute("draggable", "false");
      node.addEventListener("dragstart", function (e) { e.preventDefault(); });
      node.addEventListener("contextmenu", function (e) { if (tileDrag) e.preventDefault(); });
      node.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        tileDrag = { id: id, node: node, x: e.clientX, y: e.clientY, type: e.pointerType,
                     pointerId: e.pointerId, active: false, timer: null, ghost: null };
        if (e.pointerType !== "mouse") {
          var d = tileDrag;
          d.timer = setTimeout(function () { if (tileDrag === d && !d.active) startTileDrag(d.x, d.y); }, 350);
        }
      });
    }
    function startTileDrag(x, y) {
      var d = tileDrag;
      d.active = true;
      var r = d.node.getBoundingClientRect();
      d.dx = x - r.left;
      d.dy = y - r.top;
      var g = d.node.cloneNode(true);
      g.removeAttribute("id");
      g.setAttribute("aria-hidden", "true");
      g.classList.add("fa-glass-tile-ghost");
      g.style.width = r.width + "px";
      g.style.height = r.height + "px";
      document.body.appendChild(g);
      d.ghost = g;
      d.node.setAttribute("data-fa-dragging", "");
      layer.setAttribute("data-fa-arranging", "true");
      moveTileGhost(x, y);
    }
    function moveTileGhost(x, y) {
      var d = tileDrag;
      d.ghost.style.left = x - d.dx + "px";
      d.ghost.style.top = y - d.dy + "px";
      var t = tileDropAt(x, y);
      layer.setAttribute("data-fa-drop", t ? (t.toStrip ? "strip" : "more") : "");
    }
    function stripIndexAt(x) {
      var items = Array.prototype.slice.call(strip.querySelectorAll("[data-fa-strip-item]"))
        .filter(function (n) { return n.getAttribute("data-fa-strip-item") !== tileDrag.id; });
      for (var i = 0; i < items.length; i++) {
        var r = items[i].getBoundingClientRect();
        if (x < r.left + r.width / 2) return i;
      }
      return items.length;
    }
    /** Where a tile let go at (x, y) would go — or null for nowhere. */
    function tileDropAt(x, y) {
      var under = document.elementFromPoint(x, y);
      if (!under || !under.closest) return null;
      // ONTO MORE's own tile means "into More", even with More's panel shut.
      if (under.closest('[data-fa-glass-chrome="glass-more"]')) return { toStrip: false };
      if (under.closest(".fa-glass-tiles")) return { toStrip: true, index: stripIndexAt(x) };
      if (under.closest('.fa-glass-panel[data-fa-panel="glass-more"]')) return { toStrip: false };
      return null;
    }
    function endTileDrag() {
      var d = tileDrag;
      tileDrag = null;
      if (!d) return;
      clearTimeout(d.timer);
      if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
      d.node.removeAttribute("data-fa-dragging");
      layer.removeAttribute("data-fa-arranging");
      layer.removeAttribute("data-fa-drop");
    }
    document.addEventListener("pointermove", function (e) {
      var d = tileDrag;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.active) {
        var moved = Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y);
        if (d.type === "mouse" && moved > 6) startTileDrag(e.clientX, e.clientY);
        else if (d.type !== "mouse" && moved > 10) endTileDrag();   // it was a scroll
        return;
      }
      moveTileGhost(e.clientX, e.clientY);
    });
    // A held finger must not scroll the strip out from under the drag.
    document.addEventListener("touchmove", function (e) {
      if (tileDrag && tileDrag.active) e.preventDefault();
    }, { passive: false });
    document.addEventListener("pointerup", function (e) {
      var d = tileDrag;
      if (!d || e.pointerId !== d.pointerId) return;
      if (d.active) {
        var t = tileDropAt(e.clientX, e.clientY);
        // The press that ended a drag is not also a press OF the tile.
        var swallow = function (ev) { ev.preventDefault(); ev.stopPropagation(); };
        document.addEventListener("click", swallow, true);
        setTimeout(function () { document.removeEventListener("click", swallow, true); }, 0);
        endTileDrag();
        if (t) moveTile(d.id, t.toStrip, t.index);
        return;
      }
      endTileDrag();
    });
    document.addEventListener("pointercancel", function (e) {
      if (tileDrag && e.pointerId === tileDrag.pointerId) endTileDrag();
    });

    function moreItem(id, node, overflowed) {
      var wrap = el("div", { class: "fa-glass-more-item", "data-fa-more-item": id });
      wireTileDrag(node, id);
      wrap.appendChild(node);
      if (overflowed) {
        // PINNED, and there is no room for it at this width. Its place on the
        // strip is kept; a "↓ Strip" button here would promise a move the
        // width cannot honour.
        wrap.setAttribute("data-fa-overflow", "");
        wrap.appendChild(el("span", { class: "fa-glass-arrange-note" }, "Pinned \u00b7 no room at this width"));
        return wrap;
      }
      var b = el("button", {
        type: "button",
        class: "fa-glass-arrange",
        "data-fa-arrange": "to-strip",
        "aria-label": "Move " + labelOf(id) + " to the strip",
        title: "Move to the strip",
      }, "↓ Strip");
      b.addEventListener("click", function () { moveTile(id, true); });
      wrap.appendChild(b);
      return wrap;
    }

    /* ── MORE, not twenty tiles — owner, 2026-09-23: *"too many tiles!"* ──
     *
     * Offered three shapes, the owner chose **"Few + a More tile"**. The
     * declared list is the SAME declaration filtered to the `glass` surface and
     * drawn by the same `renderGraphTiles`: moving a tile changes where it is,
     * not what it is. `then` runs once the list has been drawn. */
    function buildMore(body, then) {
      var status = el("p", { class: "fa-glass-panel-status" }, "Loading…");
      body.appendChild(status);
      body.appendChild(el("p", { class: "fa-glass-arrange-hint" },
        "Drag a tile between here and the strip below — or use its Strip and More buttons."));
      var grid = el("div", { class: "fa-glass-more", role: "group", "aria-label": "Visualisations" });
      body.appendChild(grid);
      var onStrip = el("div", { class: "fa-glass-on-strip" });
      body.appendChild(onStrip);
      // FIRST, the pinned tiles the strip had no room for, in pinned order:
      // they are what "+N more" counted ahead of everything else.
      overflowIds.forEach(function (id) {
        if (chromeDefs[id]) grid.appendChild(moreItem(id, makeChromeTile(id, false), true));
      });
      Object.keys(chromeDefs).forEach(function (id) {
        if (id === "glass-more" || stripIds.indexOf(id) !== -1) return;
        grid.appendChild(moreItem(id, makeChromeTile(id, false)));
      });
      withDeclared(function (tiles) {
        if (!tiles) {
          status.textContent = "The list of visualisations could not be read. That is not the same as there being none.";
        } else {
          var n = 0;
          var first = grid.querySelector(".fa-glass-more-item:not([data-fa-overflow])");
          overflowIds.forEach(function (id) {
            var t = declaredById(id);
            var node = t && declaredTileEl(t);
            if (node) grid.insertBefore(moreItem(id, node, true), first);
          });
          tiles.forEach(function (t) {
            var node = declaredTileEl(t);
            if (!node) return;
            n++;
            if (stripIds.indexOf(t.id) === -1) grid.appendChild(moreItem(t.id, node));
          });
          status.textContent = n === 0 ? "No visualisations are declared for the glass."
            : n + (n === 1 ? " visualisation" : " visualisations") + ".";
        }
        // THE PRESSING PATH BACK: every strip tile, with a button into More.
        if (stripIds.length) {
          onStrip.appendChild(el("h3", { class: "fa-glass-arrange-title" }, "On the strip"));
          var ul = el("ul", { class: "fa-glass-arrange-list" });
          stripIds.forEach(function (id) {
            if (!chromeDefs[id] && !declaredById(id)) return;
            var li = el("li", { class: "fa-glass-arrange-row", "data-fa-strip-row": id });
            li.appendChild(el("span", { class: "fa-glass-arrange-name" },
              labelOf(id) + (overflowIds.indexOf(id) !== -1 ? " (no room at this width)" : "")));
            var b = el("button", {
              type: "button",
              class: "fa-glass-arrange",
              "data-fa-arrange": "to-more",
              "aria-label": "Move " + labelOf(id) + " off the strip, into More",
              title: "Move into More",
            }, "↑ More");
            b.addEventListener("click", function () { moveTile(id, false); });
            li.appendChild(b);
            ul.appendChild(li);
          });
          onStrip.appendChild(ul);
        }
        if (then) then();
      });
    }
    chromeTile("glass-more", "More", "⋯", "More — every visualisation this folio declares, and where each tile lives", buildMore);
    // MORE IS FIXED, and last: the one tile that is always on the strip.
    var moreBtn = makeChromeTile("glass-more", true);
    moreBtn.setAttribute("data-fa-more", "");
    strip.appendChild(moreBtn);
    renderStrip();
    // A page no Jekyll wrote has no meta: read the published pins, unless the
    // reader has arranged the strip in the meantime.
    if (!stripArranged && !document.querySelector('meta[name="fa-glass-strip"]')) {
      fetch(pinnedData("/assets/harness/glass-strip.json"))
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (v) {
          var ids = stripIdList(v);
          if (ids && !stripArranged) { stripIds = ids; renderStrip(); }
        })
        .catch(function () { /* no declared strip: the glass's own chrome stays */ });
    }

    function setOpen(open) {
      layer.setAttribute("data-fa-glass", open ? "open" : "closed");
      handle.setAttribute("aria-expanded", open ? "true" : "false");
      labelHandle();
      // The EMPTY LINE is about the glass's contents, not about the sheet:
      // the sheet is chrome and is always present. Every card on the glass —
      // a pinned sticky included (#1925) — is a folio asset, so the shelf's
      // count is the whole answer.
      empty.hidden = renderShelf() > 0;
      applyGlassFilter();
      if (!open) closePanel();
    }

    // The glass is on EVERY page, so a pull-out performed on a library row
    // has to reach it without a reload. One listener rather than the row
    // calling in: the row does not know a glass is mounted.
    document.addEventListener("fa:folio-changed", function () {
      setOpen(layer.getAttribute("data-fa-glass") === "open");
    });

    setOpen(false);

    // `l4zi`: the inverse is reachable, and by the same control. The handle
    // stays on the page while the glass is open — a glass whose only way out
    // is Escape excludes a reader who never learned that Escape was a way out.
    handle.addEventListener("click", function () {
      setOpen(layer.getAttribute("data-fa-glass") !== "open");
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape") return;
      if (layer.getAttribute("data-fa-glass") !== "open") return;
      // Escape closes the innermost thing first: an open panel, then the glass.
      if (openPanelId) {
        var b = panelButtons[openPanelId];
        closePanel();
        if (b) b.focus();
        return;
      }
      setOpen(false);
      focusFolioControl(handle);
    });

    /* HOW MANY ARE WAITING, on the handle — bean `c132`. On a phone a closed
     * glass shows nothing over the page (there is no room for a floating card
     * there), so the handle is where a reader learns their folio holds
     * something. A data attribute the stylesheet prints, so the handle's text
     * and accessible name are unchanged on every other screen. Counted from
     * the folio store, which holds pinned stickies too (#1925). */
    var waiting = 0;
    function countWaiting() {
      var held = folioAssets();
      var n = Object.keys(held).filter(function (k) { return held[k].shown; }).length;
      waiting = n;
      if (n > 0) handle.setAttribute("data-fa-count", String(n));
      else handle.removeAttribute("data-fa-count");
      labelHandle();
    }

    /* THE COUNT IS SPOKEN TOO — owner, 2026-09-23: *"do the spoken count on
     * phone next"*. The `· N` above is drawn by `::after`, and a screen
     * reader reads the handle's `aria-label`, which REPLACES its content, so
     * the number was visible and silent. It now rides the accessible name
     * while the glass is closed, which is when the question "is anything
     * waiting?" is asked.
     *
     * ON EVERY SCREEN, not only a phone. A media query can hide a drawn
     * `::after`, but a spoken name has no breakpoint — and one name on every
     * device is the thing a reader who switches devices can rely on. Open, the
     * count is redundant: the cards are what the reader is now looking at. */
    function labelHandle() {
      var open = layer.getAttribute("data-fa-glass") === "open";
      var label = open ? "Put your folio away" : "Pull down your folio";
      if (!open && waiting > 0) {
        label += " \u2014 " + waiting + (waiting === 1 ? " item" : " items") + " on it";
      }
      handle.setAttribute("aria-label", label);
      handle.title = label;
      // THE MARK FOLLOWS THE STATE — `ob3m` finding 9: it stayed ▾ with the
      // glass down, so the one visible cue said "pull down" over a folio that
      // was already down. Only the accessible name changed. ▴ while open is
      // "put it away", the same pair the strip toggle already uses.
      var mark = handle.querySelector(".fa-glass-handle__mark");
      if (mark) mark.textContent = open ? "\u25B4" : "\u25BE";
    }
    countWaiting();
    document.addEventListener("fa:folio-changed", countWaiting);
    if (typeof MutationObserver === "function") {
      new MutationObserver(function () {
        countWaiting();
        applyGlassFilter();
      }).observe(layer, { childList: true });
    }

    layer.__faSetGlassOpen = setOpen;
    bindFolioIcon();
    return layer;
  }

  /* ═══ A STICKY'S HOME, AND PIN — the panel it came from, the glass it goes to
   *
   * Bean `pv6g`. Owner, 2026-09-21: *"stickies can detach from the panel and
   * placed on the 'display window/glass' and dont scroll when the
   * folio/document/page scrolls. when closed tehy returned to their home
   * display panel."* And 2026-09-23, choosing between three senses of "home":
   * **"Panel it came from"**.
   *
   * ## Pin puts the sticky on the FOLIO GLASS — owner, 2026-10-02
   *
   * *"pin to glass should pin to folio glass. its not working right."*
   *
   * Pin used to write a SECOND store (`fa-pinned-stickies`) and clone the
   * card into the layer as a page-level floating copy. That copy was never a
   * folio-glass item: no glass tools, no folio geometry, no shelve, and the
   * glass's filter and count had to special-case it. Two stores answering
   * "what is on my glass" is the defect.
   *
   * So a pinned sticky IS a folio asset now — `todo/<id>` (the key the glass's
   * own Todos panel already pulls a todo out under, so the two ways onto the
   * glass agree about which todo is there) or `landing/<slot>` — with
   * `shown: true`, drawn by the glass's own card path (`buildGlassCard` and
   * `dressGlassSticky`), placed by `placeOnGlass`. Unpin is `shelveFromGlass`:
   * the entry stays, and the row's pin is the way back (`l4zi`). The pin's
   * pressed state is `folioStateOf(key) === "glass"` — asked of the store,
   * never remembered by the button.
   *
   * ## The home is RECORDED, not remembered
   *
   *   a panel  `data-fa-home-panel="<panel>"`   (the landing board, the todo board)
   *   a slot   `data-fa-home-slot="<id>"`        (one per sticky it holds)
   */

  /** The folio key a sticky is pinned under. */
  function stickyFolioKey(panel, slot) {
    return (panel === "landing" ? "landing/" : "todo/") + slot;
  }

  /** A theme name as `themes.css` selects on it, or "". Never markup. */
  function cleanThemeName(t) {
    return String(t || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  }

  /**
   * Put a sticky on the folio glass. Keeps any place the reader already gave
   * it, so pin, unpin, pin puts it back where they left it.
   *
   * `meta`: title, kind (`todos` | `sticky`), href, and for a landing sticky
   * theme, art (one URL), text and label (its home page's title) — a landing
   * sticky's words and picture live in the landing page, not in an index, so
   * they are carried as TEXT and a URL, never as stored markup.
   */
  function pinStickyToGlass(key, meta) {
    var all = folioAssets();
    var prev = all[key] || {};
    var e = {
      shown: true,
      title: String((meta && meta.title) || prev.title || key).replace(/\s+/g, " ").trim().slice(0, 200),
      href: safeHref((meta && meta.href) || prev.href) || "",
      avatar: "",
      kind: (meta && meta.kind) || prev.kind || "todos",
    };
    var theme = cleanThemeName((meta && meta.theme) || prev.theme);
    if (theme) e.theme = theme;
    var art = safeHref((meta && meta.art) || prev.art);
    if (art) e.art = art;
    var text = String((meta && meta.text) || prev.text || "").replace(/\s+/g, " ").trim().slice(0, 600);
    if (text) e.text = text;
    var label = String((meta && meta.label) || prev.label || "").slice(0, 200);
    if (label) e.label = label;
    if (prev.geom) e.geom = prev.geom;
    all[key] = e;
    setFolioAssets(all);
    announceFolio(key, "glass");
  }

  /** Pin or unpin, by what the STORE says — the button is never the source. */
  function toggleStickyPin(key, pin) {
    if (folioStateOf(key) === "glass") shelveFromGlass(key);
    else pin();
  }

  /**
   * Every pin control on the page follows the store: the row's pin under each
   * sticky and the open window's pin. One listener, so shelving a card with
   * the glass's own × un-presses the row it came from.
   */
  function syncStickyPins() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-fa-folio-pin]"), function (b) {
      var on = folioStateOf(b.getAttribute("data-fa-folio-pin")) === "glass";
      setPinButton(b, b.getAttribute("data-fa-pin-title") || "", on);
      var row = b.closest(".fa-sticky-actions");
      var slot = row && row.parentNode;
      if (slot && slot.classList) slot.classList.toggle("fa-sticky-slot-floating", on);
    });
  }
  var stickyPinsWired = false;
  function wireStickyPins() {
    if (stickyPinsWired) return;
    stickyPinsWired = true;
    document.addEventListener("fa:folio-changed", syncStickyPins);
  }

  /**
   * ONE-TIME MIGRATION of the old pin store into the folio, so no reader's
   * pin is lost when Pin moved to the folio glass (#1925). Each old entry
   * becomes a shown folio asset, with its place, unless the folio already
   * holds that key. The old store is removed only once the folio saved —
   * a blocked write leaves it for the next page.
   */
  var OLD_PIN_KEY = "fa-pinned-stickies";
  function migratePinnedStickies() {
    var old;
    try {
      var raw = localStorage.getItem(OLD_PIN_KEY);
      if (!raw) return;
      old = JSON.parse(raw);
    } catch (_e) {
      return;
    }
    if (!old || typeof old !== "object" || Array.isArray(old)) old = {};
    var all = folioAssets();
    Object.keys(old).forEach(function (k) {
      var p = old[k];
      if (!p || typeof p.slot !== "string" || (p.panel !== "todos" && p.panel !== "landing")) return;
      var key = stickyFolioKey(p.panel, p.slot);
      if (all[key]) return;
      var todo = p.panel === "todos";
      var e = {
        shown: true,
        title: String(p.title || p.slot).replace(/\s+/g, " ").trim().slice(0, 200),
        href: todo ? withBase("/todos/") + "#" + encodeURIComponent(p.slot) : (safeHref(p.href) || ""),
        avatar: "",
        kind: todo ? "todos" : "sticky",
      };
      var text = String(p.text || "").replace(/\s+/g, " ").trim().slice(0, 600);
      if (!todo && text) e.text = text;
      if (!todo && p.label) e.label = String(p.label).slice(0, 200);
      var g = p.geom;
      if (g && isFinite(g.left) && isFinite(g.top) && isFinite(g.width) && isFinite(g.height)) {
        e.geom = { left: Math.round(g.left), top: Math.round(g.top),
                   width: Math.round(g.width), height: Math.round(g.height) };
      }
      all[key] = e;
    });
    if (setFolioAssets(all)) {
      try { localStorage.removeItem(OLD_PIN_KEY); } catch (_e) { /* next page tries again */ }
    }
  }

  /** The home panel element for `panel` on THIS page, or null. */
  function homePanelEl(panel) {
    var all = document.querySelectorAll("[data-fa-home-panel]");
    for (var i = 0; i < all.length; i++) {
      if (all[i].getAttribute("data-fa-home-panel") === panel) return all[i];
    }
    return null;
  }

  function homeSlotEl(panel, slot) {
    var p = homePanelEl(panel);
    if (!p) return null;
    var slots = ownSlots(p);
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].getAttribute("data-fa-home-slot") === slot) return slots[i];
    }
    return null;
  }

  /**
   * The slots that belong to THIS panel — its nearest home-panel ancestor is
   * the panel itself. Panels NEST: on the landing page the todo board is
   * mounted inside the landing board, and without this a todo's slot would
   * be read as a landing sticky's.
   */
  function ownSlots(panel) {
    return Array.prototype.filter.call(panel.querySelectorAll("[data-fa-home-slot]"), function (n) {
      return n.parentElement && n.parentElement.closest("[data-fa-home-panel]") === panel;
    });
  }

  /**
   * THE LANDING PANEL as a home: each landing sticky is the ONE sticky
   * component (#1925) — a tile with the icon row under it. Pin floats a copy
   * of the real card onto the glass and presses the row's pin; pressing it
   * again, or Return on the copy, brings it back. The owner's option text
   * (`pv6g`): *"Landing stickies get a Pin button too."*
   */
  function mountLandingHomes() {
    var panel = homePanelEl("landing");
    if (!panel) return;
    var gone = discardedTodoIds();
    ownSlots(panel).forEach(function (cell) {
      var slot = cell.getAttribute("data-fa-home-slot");
      var art = cell.querySelector(".fa-sticky");
      if (!art || cell.querySelector(".fa-sticky-actions")) return;
      var titleEl = art.querySelector("[id$='-summary']") || art.querySelector("h2, h3");
      var title = (titleEl && titleEl.textContent.trim()) || slot;
      // The server-rendered View/Edit caption is the no-JS floor; with script
      // its two links move INTO the row, in the row's order, and the caption goes.
      var links = cell.querySelector(".fa-sticky-links");
      function linkOf(cls) {
        var a = links && links.querySelector(cls);
        return a ? { href: safeHref(a.getAttribute("href")), title: a.getAttribute("title"),
                     label: a.getAttribute("aria-label") } : null;
      }
      var view = linkOf(".fa-sticky-view");
      var edit = linkOf(".fa-sticky-edit");
      if (links) links.parentNode.removeChild(links);
      tileLandingCell(panel, cell, slot, title, art);
      cell.appendChild(stickyActions({
        title: title,
        folioKey: stickyFolioKey("landing", slot),
        view: view,
        edit: edit,
        onPin: function () { pinLanding(slot, title, art); },
        onDiscard: function () { discardLanding(slot, title); },
      }));
      if (gone.indexOf(landingDiscardId(slot)) !== -1) cell.setAttribute("hidden", "hidden");
      // A pin migrated from the old store carried no picture: this page has
      // it, so the glass card is given its theme and art — quietly, since
      // nothing about whether it is on the glass changed.
      var key = stickyFolioKey("landing", slot);
      var held = folioAssets();
      if (held[key] && !held[key].art) {
        var src = landingArtSrc(art);
        var theme = cleanThemeName(art.getAttribute("data-fa-sticky-theme"));
        if (src) held[key].art = src;
        if (theme) held[key].theme = theme;
        setFolioAssets(held);
      }
    });
    syncStickyPins();
    // A RESTORE from fsh-guts puts the sticky straight back: its cell never
    // left the page, it was only hidden.
    document.addEventListener("fa:todos-discarded", function () {
      var now = discardedTodoIds();
      ownSlots(panel).forEach(function (cell) {
        var id = landingDiscardId(cell.getAttribute("data-fa-home-slot"));
        if (now.indexOf(id) === -1) cell.removeAttribute("hidden");
        else cell.setAttribute("hidden", "hidden");
      });
      syncLandingCount();
    });
    syncLandingCount();
  }

  /** Pin a landing sticky to the folio glass, carrying its words and picture. */
  function pinLanding(slot, title, art) {
    pinStickyToGlass(stickyFolioKey("landing", slot), {
      title: title,
      kind: "sticky",
      text: (art.querySelector(".fa-landing-sticky__body") || art).textContent,
      href: safeHref(location.pathname),
      label: document.title,
      theme: art.getAttribute("data-fa-sticky-theme"),
      art: landingArtSrc(art),
    });
  }

  /**
   * The landing sticky's square crop. `landing.html` names it on the article;
   * an older page without it falls back to whatever crop the browser chose.
   */
  function landingArtSrc(art) {
    var img = art.querySelector("img.fa-sticky-art");
    return safeHref(art.getAttribute("data-fa-art-card") ||
                    (img && (img.currentSrc || img.getAttribute("src"))) || "");
  }

  /** The id a landing sticky is discarded under: prefixed, so it can never be a todo's. */
  function landingDiscardId(slot) { return "landing/" + slot; }

  /** Send a landing sticky to fsh-guts. The row asked first. */
  function discardLanding(slot, title) {
    // Off the glass as well — shelved, so it is still in the reader's folio.
    var key = stickyFolioKey("landing", slot);
    if (folioStateOf(key) === "glass") shelveFromGlass(key);
    if (landingWindowEls["landing:" + slot]) closeLandingWindow(slot);
    var cell = homeSlotEl("landing", slot);
    if (cell) cell.setAttribute("hidden", "hidden");
    discardTodo(landingDiscardId(slot), title);
    // Focus would otherwise land on <body>: put it on the panel's next tile.
    var next = document.querySelector('[data-fa-home-panel="landing"] .fa-sticky-cell:not([hidden]) .fa-sticky-tile');
    if (next) next.focus();
  }

  /**
   * The panel's count is the number of stickies it SHOWS (`1rta`): the
   * server's number, less the landing stickies this browser sent to
   * fsh-guts, plus the todo cards the board mounted.
   */
  var landingTodoCount = 0;
  function syncLandingCount() {
    var panelCount = document.querySelector(".fa-sticky-panel__count");
    var panel = homePanelEl("landing");
    if (!panelCount) return;
    var declared = parseInt(panelCount.getAttribute("data-fa-sticky-count"), 10);
    // NaN when the attribute is missing or not a number. Falling back to 0
    // would report only the todos: a wrong number rather than a missing one.
    if (isNaN(declared)) return;
    var hidden = !panel ? 0 : ownSlots(panel).filter(function (c) { return c.hasAttribute("hidden"); }).length;
    panelCount.textContent = String(declared - hidden + landingTodoCount);
  }

  /* ═══ LANDING STICKIES START AS TILES — bean `z1ug` ═════════════════════
   *
   * Owner, 2026-09-21: *"they should be closed/tiled to start"*; 2026-09-20:
   * *"start everyrting in avatar"*. And 2026-09-23, choosing what a tile does:
   * **"Opens as a window"** — *"Same as the todo avatars next to it: the full
   * card opens as a movable window with × to close. 'Pin to glass' stays on
   * the tile."*
   *
   * ONE WINDOW MECHANISM. The window is the todo board's own: the same
   * `.fa-board-windows` layer class, the same `.fa-board-window` chrome, the
   * same stack (`openWindowFor` / `zIndexFor`, keyed `landing:<slot>` so a
   * landing window and a todo window raise over each other correctly) and
   * the same `wireMove`. Two window implementations on one panel would be two
   * notions of "on top" waiting to disagree.
   *
   * THE CARD STAYS IN ITS SLOT, hidden by the tile class rather than removed,
   * because it is still the sticky's home (`pv6g`): Pin clones it, and a page
   * with no script shows it whole — the tile is JS-built, so no-JS keeps the
   * full cards, which is R4's floor. */
  var landingWindows = null;
  var landingWindowEls = {};

  function landingWindowLayer(panel) {
    if (landingWindows && landingWindows.isConnected) return landingWindows;
    landingWindows = el("div", { class: "fa-board-windows fa-landing-windows", role: "group",
                                 "aria-label": "Open stickies" });
    panel.appendChild(landingWindows);
    return landingWindows;
  }

  function renderLandingStack() {
    Object.keys(landingWindowEls).forEach(function (id) {
      var z = zIndexFor(id);
      landingWindowEls[id].style.zIndex = z === undefined ? "" : String(z);
      landingWindowEls[id].setAttribute("data-fa-z", z === undefined ? "" : String(z));
    });
  }

  function tileLandingCell(panel, cell, slot, title, art) {
    if (cell.querySelector(".fa-sticky-tile")) return;
    cell.classList.add("fa-sticky-cell--tile");
    // THE SQUARE CROP, faded — the look the todo stickies had (#1925: "lower
    // faded avatar/theme looks nicer").
    var src = landingArtSrc(art);
    var tile = stickyTile({
      kind: "landing",
      opens: "landing:" + slot,
      title: title,
      // THE STICKY'S OWN THEME, so its surface, ink and edge are the ones the
      // card uses — a tile with no theme drew pale words on a pale surface.
      theme: art.getAttribute("data-fa-sticky-theme"),
      art: src || null,
      onOpen: function () { openLandingWindow(panel, cell, slot, title, art); },
    });
    cell.insertBefore(tile, cell.firstChild);
  }

  function closeLandingWindow(slot) {
    var id = "landing:" + slot;
    closeWindowFor(id);
    var w = landingWindowEls[id];
    if (w && w.parentNode) w.parentNode.removeChild(w);
    delete landingWindowEls[id];
    renderLandingStack();
    // Focus returns to the tile that opened it — the tile IS the way back (`l4zi`).
    var t = document.querySelector('.fa-sticky-tile[data-fa-opens="' + id.replace(/"/g, '\\"') + '"]');
    if (t) t.focus();
  }

  function openLandingWindow(panel, cell, slot, title, art) {

    var id = "landing:" + slot;
    openWindowFor(id);
    if (landingWindowEls[id]) { renderLandingStack(); landingWindowEls[id].focus(); return; }
    var win = el("div", {
      class: "fa-board-window fa-landing-window",
      tabindex: "-1",
      role: "group",
      "aria-label": title,
      "data-fa-window": id,
      // The sticky's theme, so the window's bar is the card's colours rather
      // than the page's — the same pairing the tile takes.
      "data-fa-sticky-theme": art.getAttribute("data-fa-sticky-theme") || undefined,
    });
    var live = el("span", { class: "fa-sr-only", "aria-live": "polite" });
    win.appendChild(live);
    var bar = el("div", { class: "fa-board-window-bar" });
    bar.appendChild(el("span", { class: "fa-board-window-title" }, title));
    var move = el("button", {
      type: "button", class: "fa-board-window-control", "data-fa-control": "move",
      "aria-label": "Move " + title, "aria-pressed": "false",
    }, CONTROL_GLYPHS.move);
    move.addEventListener("click", function () {
      var on = win.getAttribute("data-fa-moving") !== "true";
      setMoveMode(win, on, live);
      move.setAttribute("aria-pressed", on ? "true" : "false");
    });
    // The SAME toggle as the row's pin, on the same folio key, so the two
    // cannot disagree about whether the sticky is on the glass.
    var pinKey = stickyFolioKey("landing", slot);
    var pinIt = el("button", {
      type: "button", class: "fa-board-window-control", "data-fa-control": "pin",
      "data-fa-folio-pin": pinKey, "data-fa-pin-title": title,
    });
    pinIt.innerHTML = PIN_GLYPH;
    setPinButton(pinIt, title, folioStateOf(pinKey) === "glass");
    pinIt.addEventListener("click", function () {
      toggleStickyPin(pinKey, function () { pinLanding(slot, title, art); });
    });
    var close = el("button", {
      type: "button", class: "fa-board-window-control", "data-fa-control": "close",
      "aria-label": "Close " + title,
    }, CONTROL_GLYPHS.close);
    close.addEventListener("click", function () { closeLandingWindow(slot); });
    bar.appendChild(move);
    bar.appendChild(pinIt);
    bar.appendChild(close);
    win.appendChild(bar);
    // A COPY of the card, ids stripped — the original stays home in its slot.
    var copy = art.cloneNode(true);
    Array.prototype.forEach.call(copy.querySelectorAll("[id]"), function (n) { n.removeAttribute("id"); });
    copy.removeAttribute("aria-labelledby");
    copy.removeAttribute("hidden");
    win.appendChild(copy);
    win.addEventListener("mousedown", function () { openWindowFor(id); renderLandingStack(); });
    win.addEventListener("focusin", function () { openWindowFor(id); renderLandingStack(); });
    win.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && win.getAttribute("data-fa-moving") !== "true") {
        ev.preventDefault();
        closeLandingWindow(slot);
      }
    });
    wireMove(win, bar, live);
    landingWindowLayer(panel).appendChild(win);
    landingWindowEls[id] = win;
    renderLandingStack();
    win.focus();
  }

  function mountTodoBoard(items) {
    // THE LANDING FOLIO BOARD FIRST, when the page has one. The owner, 2026-09-20:
    // "i want todo board inside of the landing folio/board."
    //
    // The landing page is itself a board of sticky notes -- one card per
    // harness, each an initiation receipt -- so a second board floating above
    // it, hidden behind a launcher, put two boards of the same thing on one
    // page and made the todos the one you could not see. Mounted into the
    // landing board they are the same surface: the harness cards say what ran,
    // the todo stickies say what is outstanding, and both are stickies.
    //
    // Everywhere else the old target and the old behaviour are unchanged: the
    // board goes to the top of the main region and starts hidden, opened by its
    // launcher.
    var landing = firstMatch([".fa-landing-board"]);
    var main = landing || firstMatch(["#main-content", ".main-content", "main"]);
    if (!main) {
      console.warn("docs-ui: no main content region found; the todo board was not mounted.");
      return null;
    }

    // THE LAYER IS THE GLASS, and it is no longer created here. `mountGlass`
    // made it before this ran, because a folio that only exists where a board
    // mounted is not a folio a reader carries. See that function for what the
    // two guards above used to cost. A pinned todo is a folio asset (#1925),
    // so the board puts nothing on the layer itself; it only needs it to exist.
    mountGlass();

    // VISIBLE on the landing board, hidden everywhere else. On a page whose
    // whole content is a board of stickies, a hidden board of stickies is the
    // one thing a reader cannot find; anywhere else it is an overlay and must
    // not cover the page it was opened from.
    /* ONE PANEL, NOT TWO. Owner, 2026-09-21, on the staging preview:
     * *"why are there two panels???"*
     *
     * `.fa-sticky-board` carries a border, a background, padding, an `<h2>`
     * and a close button — correct when it is an overlay opened by a
     * launcher, and wrong the moment it is mounted INSIDE the landing
     * board, because the landing board is now itself inside
     * `.fa-sticky-panel`. The reader got panel-inside-panel: a bordered box
     * headed "Todos" sitting in a bordered panel headed "Stickies", with a
     * close button next to a summary that already toggles.
     *
     * So a board nested in the sticky panel renders BARE. The chrome is not
     * restyled smaller — it is the OUTER panel's job and is already there
     * once.
     */
    var bare = !!(landing && landing.closest && landing.closest(".fa-sticky-panel"));

    var boardAttrs = {
      class: "fa-sticky-board" + (landing ? " fa-sticky-board--inline" : "") +
             (bare ? " fa-sticky-board--bare" : ""),
      tabindex: "-1",
      role: "region",
      "aria-label": "Todos",
    };
    if (!landing) boardAttrs.hidden = "hidden";
    // A HOME PANEL (bean `pv6g`): its slots are where a pinned todo returns.
    boardAttrs["data-fa-home-panel"] = "todos";
    // English at the root (bean `giiw`): todo summaries, their windows and
    // the board's controls are English on every locale. Inside the landing
    // `.fa-sticky-panel` the panel itself already says so (`landing.html`);
    // the overlay board on any other page needs it said here.
    var board = chromeText(el("section", boardAttrs));
    var head = el("div", { class: "fa-sticky-board-head" });

    /* THE HEADING SURVIVES BARE, VISUALLY HIDDEN.
     *
     * Deleting it was the obvious move and is wrong twice. It is the focus
     * target for `discard()` and `setOpen()` — without it focus lands on
     * `<body>` and a keyboard reader loses their place, which is the defect
     * `l4zi` already records against this very board. And the section is
     * `role="region"`, so it owes an accessible name: "Stickies" on the
     * summary and "Todos" here are different facts, and a screen-reader user
     * moving by region needs the inner one.
     *
     * `fa-sr-only` is the clip-not-hide class the search label uses, for the
     * same reason spelled out there: `display: none` would take it out of the
     * accessibility tree along with the pixels. */
    var heading = el("h2", {
      class: "fa-sticky-board-title" + (bare ? " fa-sr-only" : ""),
      tabindex: "-1",
    }, "Todos");
    head.appendChild(heading);

    /* THE CLOSE BUTTON DOES NOT SURVIVE BARE, and that is not a lost control.
     *
     * Its inverse is the `<summary>` one line up, which closes the whole
     * panel — so `l4zi` is satisfied by the panel rather than by a second
     * button inside it. Keeping it would have given the reader two closes
     * doing different things at the same spot: one collapsing the panel, one
     * swapping the board for a "Todos (n)" reopen button INSIDE the still-open
     * panel. That second state is the one nobody would be able to describe. */
    var boardClose = el("button", {
      type: "button",
      class: "fa-sticky-board-close",
      "aria-label": "Close the todo board",
    }, "\u00d7");
    if (!bare) head.appendChild(boardClose);
    board.appendChild(head);

    /* THE READER'S FILTER, in the board's head and nowhere in any document.
     *
     * Two selects rather than a search box: the values come from the CORPUS
     * (`propertyValues`), so a reader picks from what is actually there rather
     * than guessing a spelling — and an option list built from the data cannot
     * offer a filter that matches nothing. */
    var filterRow = el("div", {
      class: "fa-board-filter",
      role: "group",
      "aria-label": "Filter this view",
    });
    board.appendChild(filterRow);

    /* NO TILE STRIP ON THE STICKY BOARD — owner, 2026-10-02, issue #1905,
     * bean `t6ht`: *"stickies panel shouldnt have all those icons"*.
     *
     * That REVERSES the 2026-09-21 ruling this spot used to cite (bean
     * `v0jv`: *"lets have the square tiles lined up on the top of the
     * folio-sicky-board-landingpanel whole slides up if user doesnt want"*),
     * which put a "\u25A6 Visualisations" `<details>` strip along the top of
     * every sticky board. It is gone from EVERY board, not only the landing
     * one: the ruling names the stickies panel, not a page.
     *
     * Nothing becomes unreachable. A tile is one declaration with per-surface
     * visibility (`harness-tiles`), and the navbar and the glass strip still
     * render it; the `board` surface value stays legal in `TILE_SURFACES` so
     * no existing declaration turns invalid, but no code mounts it. */

    var grid = el("div", { class: "fa-sticky-grid" });
    board.appendChild(grid);
    // APPEND on the landing board, insert-first everywhere else. The harness
    // cards are the page's first statement -- what this repository is, and
    // which layers initiated -- and putting the todos above them would answer
    // "what is outstanding" before "what is this".
    if (landing) main.appendChild(board);
    else main.insertBefore(board, main.firstChild);

    var slots = {};

    /**
     * Pin a todo to the folio glass — the key and the meta the glass's own
     * Todos panel uses, so a todo pulled out there and one pinned here are
     * the same folio asset. The glass draws it as the themed sticky
     * (`dressGlassSticky`) from the published index.
     */
    function pinTodo(todo) {
      pinStickyToGlass(stickyFolioKey("todos", todo.id), {
        title: todo.summary || todo.id,
        kind: "todos",
        href: safeHref(withBase("/todos/") + "#" + encodeURIComponent(todo.id)),
      });
    }

    /** Send it to fsh-guts (asked first, by the row), and take it off the board. */
    function discard(todo) {
      // Off the glass too — shelved, so it is still in the reader's folio.
      var key = stickyFolioKey("todos", todo.id);
      if (folioStateOf(key) === "glass") shelveFromGlass(key);
      if (windowEls[todo.id]) closeCard(todo);
      var slot = slots[todo.id];
      if (slot && slot.parentNode) slot.parentNode.removeChild(slot);
      delete slots[todo.id];
      discardTodo(todo.id, todo.summary);
      landingTodoCount = Math.max(0, landingTodoCount - 1);
      syncLandingCount();
      if (Object.keys(slots).length === 0 && !grid.querySelector(".fa-sticky-empty")) {
        grid.appendChild(el("p", { class: "fa-sticky-empty" }, "Nothing outstanding."));
      }
      // A group whose last sticky just left loses its heading too.
      applyReaderFilter();
      // Focus would otherwise land on <body>, which tells a reader nothing.
      heading.focus();
    }

    // Items this browser discarded are off the board. Filtered HERE rather
    // than at fetch, so `fa:todos-discarded` can re-render without refetching
    // and the published index stays the single source of what exists.
    var hidden = discardedTodoIds();
    var live = items.filter(function (t) { return hidden.indexOf(t.id) === -1; });
    var rows = stackTodos(live, todoState.processes);
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      slots[row.todo.id] = todoSlot(row);
      grid.appendChild(slots[row.todo.id]);
    }

    /* ONE STICKY (#1925): the same tile and icon row a landing sticky gets.
     * The full card stays in the slot, undrawn while the slot is a tile
     * (`fa-sticky-cell--tile`), because it is what the window and the glass
     * render; the no-JS floor is the generated todo listing, not this. */
    function todoSlot(row) {
      var todo = row.todo;
      var slot = el("div", {
        class: "fa-sticky-slot fa-sticky-cell--tile" + (row.process ? " fa-sticky-slot-in-process" : ""),
        "data-fa-home-slot": todo.id,
      });
      // The process is named ON the tile rather than as a run-in heading, so
      // the grid stays a grid and every tile stays the same size.
      if (row.process) slot.setAttribute("data-fa-depth", String(row.depth));
      var art = todo.theme && todoState.themeArt[todo.theme];
      var nb = nodeBadge(todo);
      slot.appendChild(stickyTile({
        kind: "todo",
        opens: todo.id,
        title: condense(todo.summary),
        theme: todo.theme,
        art: art ? (art.card || art.mobile || art.laptop) : null,
        process: row.process,
        // R7: the same badge as the open window, from the same query.
        badge: nb ? badgeChip(nb, "avatar") : null,
        onOpen: function () { openCard(todo); },
      }));
      slot.appendChild(buildSticky(todo));
      slot.appendChild(stickyActions({
        title: todo.summary,
        // Its own page, `todos/<id>/`, from the graph (`fetchTodoGraph`).
        page: todo.pageHref && { href: safeHref(todo.pageHref), title: "Open this todo's page",
                                 label: "Open the page for " + todo.summary },
        view: todo.viewHref && { href: safeHref(todo.viewHref), title: "View this todo's source on GitHub",
                                 label: "View the source of " + todo.summary },
        edit: todo.editHref && { href: safeHref(todo.editHref), title: "Edit this todo's markdown on GitHub",
                                 label: "Edit " + todo.summary },
        folioKey: stickyFolioKey("todos", todo.id),
        onPin: function () { pinTodo(todo); },
        onDiscard: function () { discard(todo); },
      }));
      return slot;
    }
    // Each slot's pin shows what the folio says — a todo pinned on an earlier
    // page is still on the reader's glass.
    syncStickyPins();
    if (live.length === 0) {
      grid.appendChild(el("p", { class: "fa-sticky-empty" }, "Nothing outstanding."));
    }

    /* ── Applying the reader's filter ─────────────────────────────────────
     *
     * It hides SLOTS and touches nothing else: no note, no position, no
     * stored preference. A filtered-out card keeps its place on the board and
     * comes back the moment the filter is cleared, because nothing about it
     * changed.
     *
     * `hidden` rather than a class, so the card leaves the accessibility tree
     * too. A reader using a screen reader who filtered to "open" should not
     * still be walked through the done ones.
     */
    function applyReaderFilter() {
      var shown = 0;
      for (var fi = 0; fi < rows.length; fi++) {
        var t = rows[fi].todo;
        var slot = slots[t.id];
        if (!slot) continue;
        var keep = readerShows(readerFilter, t);
        if (keep) { slot.removeAttribute("hidden"); shown++; }
        else slot.setAttribute("hidden", "hidden");
      }
      // A group heading with nothing visible under it is hidden with its
      // group: a heading over an empty run reads as "this group is empty",
      // which is the filter's doing, not the group's.
      var heads = grid.querySelectorAll(".fa-sticky-group-head");
      for (var gi = 0; gi < heads.length; gi++) {
        var any = false;
        for (var sib = heads[gi].nextElementSibling;
             sib && !sib.classList.contains("fa-sticky-group-head");
             sib = sib.nextElementSibling) {
          if (sib.hasAttribute("data-fa-home-slot") && !sib.hasAttribute("hidden")) { any = true; break; }
        }
        if (any) heads[gi].removeAttribute("hidden");
        else heads[gi].setAttribute("hidden", "hidden");
      }
      board.setAttribute("data-fa-filtered", String(shown));
      var none = grid.querySelector(".fa-sticky-filtered-out");
      if (shown === 0 && rows.length > 0 && !none) {
        // A DETERMINED empty, and it says which: "nothing matches this filter"
        // and "nothing outstanding" are opposite facts about the same blank
        // grid, and a reader who cannot tell them apart will clear the wrong
        // thing.
        grid.appendChild(el("p", { class: "fa-sticky-filtered-out" },
          "No card matches this filter. Clearing it brings them all back."));
      } else if (shown > 0 && none) {
        grid.removeChild(none);
      }
    }

    // One select per property a todo carries. Built from the corpus, so a
    // folio whose todos never set a priority simply gets no priority control.
    // `node`, `person` and `bean` are the graph's edges (`fetchTodoGraph`);
    // with no graph they are absent from every todo, so they get no control.
    BOARD_AXES.concat(["priority"]).forEach(function (name) {
      var values = propertyValues(live, name);
      if (values.length < 2) return;   // nothing to choose between
      var id = "fa-filter-" + name;
      var label = el("label", { class: "fa-board-filter-label", for: id }, name);
      var select = el("select", { class: "fa-board-filter-select", id: id });
      select.appendChild(el("option", { value: "" }, "any " + name));
      values.forEach(function (v) { select.appendChild(el("option", { value: v }, v)); });
      select.addEventListener("change", function () {
        if (select.value === "") delete readerFilter.properties[name];
        else readerFilter.properties[name] = [select.value];
        applyReaderFilter();
      });
      filterRow.appendChild(label);
      filterRow.appendChild(select);
    });

    /* ── Grouping, the reader's too ───────────────────────────────────────
     *
     * Re-ORDERS the slots under one heading per value and changes nothing
     * else — the same rule as the filter: a view, committed nowhere. "none"
     * puts back the board's own order, process stacking included.
     *
     * A todo with several values on the axis (two assignees, two beans) is
     * filed ONCE, under all of them joined: the slot is the todo's home slot
     * and a second copy would be a second home. A todo with none is filed
     * under "no <axis>", last, because "nobody" and "not loaded" differ and
     * the heading says which axis is empty.
     */
    var groupAxes = BOARD_AXES.filter(function (a) { return propertyValues(live, a).length > 0; });
    var groupBy = "";
    function applyGrouping() {
      var olds = grid.querySelectorAll(".fa-sticky-group-head");
      for (var oi = 0; oi < olds.length; oi++) grid.removeChild(olds[oi]);
      var order = rows.map(function (r) { return r.todo; })
        .filter(function (t) { return slots[t.id]; });
      if (!groupBy) {
        order.forEach(function (t) { grid.appendChild(slots[t.id]); });
      } else {
        var groups = {};
        var keys = [];
        order.forEach(function (t) {
          var k = valuesOf(t, groupBy).join(", ");
          if (!Object.prototype.hasOwnProperty.call(groups, k)) { groups[k] = []; keys.push(k); }
          groups[k].push(t);
        });
        keys.sort(function (a, b) { return a === "" ? 1 : b === "" ? -1 : a < b ? -1 : a > b ? 1 : 0; });
        keys.forEach(function (k) {
          grid.appendChild(el("h3", { class: "fa-sticky-group-head", "data-fa-group": k },
            k || "no " + groupBy));
          groups[k].forEach(function (t) { grid.appendChild(slots[t.id]); });
        });
      }
      // The determined-empty notes stay last, after every group.
      [".fa-sticky-empty", ".fa-sticky-filtered-out"].forEach(function (sel) {
        var n = grid.querySelector(sel);
        if (n) grid.appendChild(n);
      });
      board.setAttribute("data-fa-grouped", groupBy || "none");
      applyReaderFilter();
    }
    if (groupAxes.length) {
      var gLabel = el("label", { class: "fa-board-filter-label", for: "fa-group-by" }, "group by");
      var gSelect = el("select", { class: "fa-board-filter-select", id: "fa-group-by" });
      gSelect.appendChild(el("option", { value: "" }, "none"));
      groupAxes.forEach(function (a) { gSelect.appendChild(el("option", { value: a }, a)); });
      gSelect.addEventListener("change", function () {
        groupBy = gSelect.value;
        applyGrouping();
      });
      filterRow.appendChild(gLabel);
      filterRow.appendChild(gSelect);
    }
    applyReaderFilter();


    /* ── Windows, projected ON TO the board ───────────────────────────────
     *
     * A separate layer, and that is the design rather than an implementation
     * detail: an open card is not the card grown large, so it is not in the
     * grid at all. The grid goes on doing semantic zoom — its slot becomes an
     * avatar when the board shrinks — while the window it spawned stays
     * exactly where it was. "An open window survives a zoom-out" is then true
     * by construction, with nothing to special-case.
     */
    var windows = el("div", {
      class: "fa-board-windows",
      role: "group",
      "aria-label": "Open cards",
    });
    board.appendChild(windows);
    var windowEls = {};

    function renderStack() {
      for (var id in windowEls) {
        if (!Object.prototype.hasOwnProperty.call(windowEls, id)) continue;
        var z = zIndexFor(id);
        // `undefined` rather than 0 for a closed card, so "bottom of the
        // stack" and "not on it" cannot be confused — see `window-stack.ts`.
        windowEls[id].style.zIndex = z === undefined ? "" : String(z);
        windowEls[id].setAttribute("data-fa-z", z === undefined ? "" : String(z));
      }
    }

    function closeCard(todo) {
      closeWindowFor(todo.id);
      var w = windowEls[todo.id];
      if (w && w.parentNode) w.parentNode.removeChild(w);
      delete windowEls[todo.id];
      renderStack();
      // Focus returns to the avatar that opened it. A close that leaves focus
      // on <body> tells a reader who cannot see the page nothing at all, and
      // the avatar IS the way back — `l4zi`.
      var slot = slots[todo.id];
      var opener = slot && slot.querySelector(".fa-sticky-avatar");
      if (opener) opener.focus();
      else heading.focus();
    }

    function openCard(todo) {
      openWindowFor(todo.id);
      var existing = windowEls[todo.id];
      if (existing) { renderStack(); existing.focus(); return; }
      var panel = el("div", {
        class: "fa-board-window",
        tabindex: "-1",
        role: "group",
        "aria-label": todo.summary,
        "data-fa-window": todo.id,
      });
      var bar = el("div", { class: "fa-board-window-bar" });
      bar.appendChild(el("span", { class: "fa-board-window-title" }, todo.summary));
      // R7: THE SAME BADGE AS THE AVATAR, from the same query. Not a second
      // count — `nodeBadge` is called once per card and both surfaces render
      // what it returned, which is R6's rule carried onto a second surface.
      var nb = nodeBadge(todo);
      if (nb) bar.appendChild(badgeChip(nb, "window"));

      /* THE CONTROLS. The frame first, then what the kind declared, then what
       * this node can actually serve. A declared control the node cannot serve
       * is HIDDEN and the reason is reported — never rendered as a button that
       * would 404 for exactly the reader who cannot use it (`pb04`). */
      var caps = { "source-read": !!todo.viewHref, "source-write": !!todo.editHref };
      var split = servableControls(controlsFor("todo"), caps);
      // The live region the move mode announces through. One per window, so a
      // reader is told about the window they are in rather than the last one
      // anybody touched.
      var live = el("span", { class: "fa-sr-only", "aria-live": "polite" });
      panel.appendChild(live);

      var handlers = {
        close: function (t) { closeCard(t); },
        move: function () {
          setMoveMode(panel, panel.getAttribute("data-fa-moving") !== "true", live);
        },
        // The same toggle as the slot's pin, on the same folio key.
        pin: function (t) {
          toggleStickyPin(stickyFolioKey("todos", t.id), function () { pinTodo(t); });
        },
        // ASKED FIRST, like the row's own send (#1925): the window's Discard
        // is the same act, so it takes the same confirmation.
        discard: function (t, button) {
          confirmSendToFshGuts(t.summary, function () { discard(t); }, button);
        },
        // THE FISHBONE. The only control that asks first, because it is the
        // only one whose subject is the content rather than this reader's
        // view of it.
        relocate: function (t, button) {
          var dialog = relocateDialog(t, function () {
            closeCard(t);
            // ONE PATH, shared with `d1r6`: the same function, the same key,
            // the same event the trashcan counter already listens to.
            discard(t);
          });
          (button.closest(".fa-board-window") || document.body).appendChild(dialog);
        },
      };
      for (var ci = 0; ci < split.shown.length; ci++) {
        bar.appendChild(controlButton(split.shown[ci], todo, handlers));
      }
      if (split.hidden.length) {
        // Reported once per panel rather than swallowed: "this kind does not
        // offer edit" and "this deployment cannot serve edit" are different
        // facts, and only one of them is somebody's to fix.
        panel.setAttribute(
          "data-fa-hidden-controls",
          split.hidden.map(function (h) { return h.control.id; }).join(" "),
        );
        for (var hi = 0; hi < split.hidden.length; hi++) {
          console.info("docs-ui: " + todo.id + " — " + split.hidden[hi].because);
        }
      }
      panel.appendChild(bar);
      // The card's own rendering: the kind controls what its panel shows, the
      // platform fixes the frame around it. `compact` because the window
      // already carries the frame's `[x]` — a second Close inside it would be
      // two controls for one act, and they would not agree about what they
      // close. Which controls a kind may declare here is `t4my`'s.
      var cardEl = buildSticky(todo);
      panel.appendChild(cardEl);
      if (todo.outputs && todo.outputs.length) {
        applyWindowDetail(cardEl, todo, null);
      }
      if (cardDetailUrl(todo)) {
        panel.setAttribute("data-fa-detail-state", "loading");
        fetchCardDetail(todo, function (detail, fromCache) {
          if (detail) applyWindowDetail(cardEl, todo, detail);
          panel.setAttribute("data-fa-detail-state", fromCache ? "cached" : "loaded");
        });
      }
      // SELECTING ANY PART RAISES — the owner's words, so the listener is on
      // the panel rather than on its title bar. `mousedown` and not `click`,
      // so the raise happens before a control inside the panel acts on it.
      panel.addEventListener("mousedown", function () {
        raiseWindow(todo.id);
        renderStack();
      });
      panel.addEventListener("focusin", function () {
        raiseWindow(todo.id);
        renderStack();
      });

      // The keyboard path and the drag accelerator, both from `wireMove`.
      // They were written inline here first; `ivfw` needed the same behaviour
      // on a floating sticky, and two copies of a move interaction is two
      // notions of position waiting to disagree.
      wireMove(panel, bar, live);
      windows.appendChild(panel);
      windowEls[todo.id] = panel;
      renderStack();
      panel.focus();
    }

    /* ── No semantic zoom on the board any more — #1925 ─────────────────
     *
     * Every slot is its closed tile at every width (owner, 2026-10-02:
     * *"upper smaller same size closed looks niceer"*), so there is no width
     * at which a board slot would show more words; the tile already IS the
     * avatar that opens the window, and the window survives anything the
     * grid does because it is a separate layer. Semantic zoom still decides
     * what a card shows ON THE GLASS, where a card is resized freely. */

    /**
     * The way back, and on the landing board it has to be ON THE PAGE.
     *
     * Bean `l4zi`, the owner 2026-09-21: *"clicking on postit display panel,
     * hides it, no place to get it back."*
     *
     * Closing set `hidden` and stopped. On an OVERLAY page that is fine — the
     * board was covering what you were reading, and the launcher's Todos tile
     * re-opens it. On the LANDING board it is not: there the board is page
     * content, so closing it removes a section of the page and leaves nothing
     * where it was. A control two clicks deep inside a collapsed launcher is
     * not "a place to get it back"; it is a place a reader has to already know
     * about.
     *
     * So the inline board collapses to a button in its own position rather
     * than vanishing. Same rule `d1r6` follows for a discarded sticky, which
     * goes somewhere with a way back instead of being deleted: **an action
     * whose inverse is not reachable is not a toggle.**
     */
    var reopen = null;
    function reopenControl() {
      if (reopen) return reopen;
      reopen = el("button", {
        type: "button",
        class: "fa-sticky-board-reopen",
        "aria-label": "Show the todo board — " + live.length + " outstanding",
      }, "Todos (" + live.length + ")");
      reopen.addEventListener("click", function () { setOpen(true); });
      return reopen;
    }

    function setOpen(isOpen) {
      if (isOpen) {
        board.removeAttribute("hidden");
        if (reopen && reopen.parentNode) reopen.parentNode.removeChild(reopen);
        heading.focus();
      } else {
        board.setAttribute("hidden", "hidden");
        if (landing) {
          var b = reopenControl();
          if (!b.parentNode && board.parentNode) board.parentNode.insertBefore(b, board);
          // Focus follows the control that replaced the thing being closed.
          // Left alone it lands on <body>, which tells a reader nothing and
          // loses the keyboard position entirely.
          b.focus();
        }
      }
      return isOpen;
    }
    boardClose.addEventListener("click", function () { setOpen(false); });

    /* ESCAPE CLOSES AN OVERLAY. IT MUST NOT CLOSE A BARE BOARD.
     *
     * Everywhere else this board is an overlay over the page, so Escape
     * dismissing it is the standard gesture. Inside `.fa-sticky-panel` it is
     * page content with no close button (see above), and letting Escape run
     * would produce exactly the state that button was removed to prevent: the
     * board swapped for a "Todos (n)" reopen control INSIDE a panel that is
     * still open, reached by a key the reader pressed for some other reason.
     *
     * The panel's own `<summary>` is the way to close it, and it is one Tab
     * away. So: no handler at all when bare, rather than a handler that
     * checks and returns — an event listener that never acts is a thing the
     * next reader has to prove is dead. */
    if (!bare) {
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !board.hasAttribute("hidden")) setOpen(false);
      });
    }

    /* THE COLLAPSED PANEL'S COUNT has to include what THIS function just
     * mounted, or it understates the thing it exists to declare.
     *
     * `landing.html` renders the panel's summary server-side and can only
     * count the stickies Liquid knows about; the todo cards arrive here,
     * after a fetch. A collapsed panel saying "3" over six cards is the badge
     * defect `rta` pinned a test against — a count that is not the
     * cardinality of the thing it labels.
     *
     * Added to the SERVER'S number, read back from `data-fa-sticky-count`,
     * rather than recomputed from the DOM. The attribute is the one value
     * that does not change when this runs twice; counting `.fa-sticky` nodes
     * would double on a re-mount, and re-reading the text content would
     * compound whatever it wrote last time.
     *
     * No panel (an ordinary page, or a landing page with no stickies) is not
     * a failure — there is simply nothing to relabel, and the board's own
     * heading already carries the count there. */
    landingTodoCount = live.length;
    syncLandingCount();

    return {
      toggle: function () { return setOpen(board.hasAttribute("hidden")); },
      count: live.length,
    };
  }

  /**
   * Todos attached to a block ON THIS PAGE, rendered beside the block.
   *
   * Matched on `targetLabel` against the heading's `data-fa-label`, which is
   * PAGE-QUALIFIED (`sec:<page>-<node>`). The bare heading id cannot serve:
   * `what-is-not-built-yet` is a node on two different pages, so matching on
   * it would attach a todo to whichever page the reader opened.
   *
   * The count sits on a toggle beside the heading rather than at the top of
   * the page. The owner asked for "a sticky icon with a count" at the top and
   * for the stickies to appear "relative to content they are assigned to" —
   * and those pull apart once a page has blocks with different counts. One
   * badge per block says which block, which is the half that carries
   * information; a single page-level number cannot say where to look.
   */
  function mountPageStickies(items, board) {
    /* ── The two relations, from ONE pass ─────────────────────────────────
     *
     * Mirrors `notesAt()` in `schemas/ui/note-anchor.ts`, including the rule
     * that decides the overlap: a note both attached here AND also-about
     * here counts ONCE, as attached — the stronger relation wins, so a
     * self-referential declaration cannot inflate a badge past the length of
     * the list it labels.
     *
     * Two indexes rather than one because they are two relations, and
     * building them together is what stops a caller computing the badge from
     * one query and rendering the panel from another.
     */
    var attachedBy = {};
    var alsoAboutBy = {};
    for (var i = 0; i < items.length; i++) {
      var t = items[i];
      if (t.targetLabel) {
        (attachedBy[t.targetLabel] = attachedBy[t.targetLabel] || []).push(t);
      }
      var also = t.alsoAbout || [];
      for (var ai = 0; ai < also.length; ai++) {
        var lbl = also[ai] && also[ai].label;
        // The overlap rule: already attached here, so not counted again.
        if (!lbl || lbl === t.targetLabel) continue;
        (alsoAboutBy[lbl] = alsoAboutBy[lbl] || []).push(t);
      }
    }

    var heads = document.querySelectorAll("[data-fa-label]");
    var placed = 0;
    for (var h = 0; h < heads.length; h++) {
      var head = heads[h];
      var label = head.getAttribute("data-fa-label");
      var mine = attachedBy[label];
      if (!mine || mine.length === 0) continue;

      var host = el("div", { class: "fa-sticky-inline" });

      /* ── The panel FIRST, then the badge from what it rendered ──────────
       *
       * R6: *the badge's count SHALL be the cardinality of the query the
       * panel renders.* Stated as a requirement it is a property somebody
       * has to keep true; built this way it is one the code cannot break,
       * because the number is read off the panel's own children rather than
       * recomputed from anything. **A badge that can disagree with its own
       * panel is the defect to design out** — so there is no second count to
       * go out of step.
       */
      var list = el("div", { class: "fa-sticky-inline-list", hidden: "hidden" });
      (function (list, mine) {
        for (var k = 0; k < mine.length; k++) {
          /* A CELL, for the same reason the board uses a slot: the source
           * links live BELOW the sticky now, not inside it, so something has
           * to hold the pair. An inline sticky keeps them when it loses Pin,
           * Close and Discard — that is the point of the inline case, which
           * drops the BOARD's controls and keeps the content object's. */
          var cell = el("div", { class: "fa-sticky-cell" });
          cell.appendChild(buildSticky(mine[k]));
          var inlineLinks = buildSourceLinks(mine[k]);
          if (inlineLinks) cell.appendChild(inlineLinks);
          list.appendChild(cell);
        }
      })(list, mine);
      var shown = list.children.length;

      var badge = el("button", {
        type: "button",
        class: "fa-sticky-badge",
        "aria-expanded": "false",
        // THE EXACT NUMBER, always — R5's threshold is a DENSITY decision
        // about the visual, and a screen-reader user must not be told less
        // than a sighted one. `note`/`notes` rather than "todo(s)": a reader
        // hears the label, and "(s)" is a written convention.
        "aria-label": shown + (shown === 1 ? " note" : " notes") + " on this section",
        "data-fa-notes": String(shown),
      });
      badge.innerHTML = STICKY_GLYPH;
      // R5, the owner: *"badge of # if > 1"*. One note gets the icon and no
      // number — the icon already says there is something here.
      if (shown > 1) {
        badge.appendChild(el("span", { class: "fa-sticky-badge-count" }, String(shown)));
      }
      // The secondaries at this label, recorded and deliberately NOT added to
      // the badge. Published so a test can prove they were present and still
      // did not inflate it: an assertion over a page with no secondaries at
      // all would pass for an implementation that counted them.
      host.setAttribute("data-fa-also-about", String((alsoAboutBy[label] || []).length));

      (function (badge, list) {
        badge.addEventListener("click", function () {
          var open = badge.getAttribute("aria-expanded") === "true";
          badge.setAttribute("aria-expanded", open ? "false" : "true");
          if (open) list.setAttribute("hidden", "hidden");
          else list.removeAttribute("hidden");
        });
      })(badge, list);

      host.appendChild(badge);
      // A SIBLING of the heading, not a child: a <div> inside an <h2> is not
      // valid HTML and the browser would reparent it -- the same rule the QA
      // panel already follows for the same reason.
      head.parentNode.insertBefore(host, head.nextSibling);
      host.parentNode.insertBefore(list, host.nextSibling);
      // `shown`, not `mine.length`: the same rule one level out. `placed`
      // is reported as how many notes reached the page, and reading it off
      // the intent rather than the result would let the two disagree exactly
      // where the badge no longer can.
      placed += shown;
    }

    // Reported, not silent. A todo carrying a `targetLabel` that matches no
    // block on any page is a dangling edge, and the reader would otherwise
    // only ever see it on the board -- where nothing says it was SUPPOSED to
    // appear somewhere and did not.
    var tagged = 0;
    for (var j = 0; j < items.length; j++) if (items[j].targetLabel) tagged++;
    if (board) board.placed = placed;
    return { placed: placed, tagged: tagged };
  }

  /* ═══ The linear floor ════════════════════════════════════════════════
   *
   * `_includes/generated/todo-listing.html` puts every note into the bytes the
   * server sends, in document order. That listing is the ARTEFACT; the board
   * is an overlay over it. Owner: "this dymanic moving state is overlayed, its
   * an 'extra'. on stndard folio just simple tile based listing."
   *
   * ## Collapsed, never removed
   *
   * When the board is available this collapses the listing into a `<details>`
   * so the page is not showing the same notes twice. It does NOT remove it,
   * hide it from assistive technology, or set `display: none` on it, and the
   * reason is bean `l4zi`: an action whose inverse is not reachable is not a
   * toggle. A reader who cannot use the board — or who simply wants the
   * printable list — reaches it by opening one disclosure, with the keyboard,
   * from any page.
   *
   * ## Why this runs at mount rather than at page load
   *
   * The listing must stay OPEN when the board did not mount, and "did not
   * mount" includes the two cases a reader cannot distinguish from the
   * outside: the index failed to load, and this script never ran at all. Both
   * leave the floor exactly as the server sent it, which is the correct
   * result in both.
   */
  function collapseFloor(count) {
    var floor = document.getElementById("fa-todo-listing");
    if (!floor || floor.dataset.faCollapsed === "1") return;
    floor.dataset.faCollapsed = "1";
    // English, as the listing it folds is (`todo-listing.ts`; bean `giiw`).
    var details = chromeText(el("details", { class: "fa-todo-listing-details" }));
    var summary = el(
      "summary",
      { class: "fa-todo-listing-toggle" },
      "Linear listing (" + count + ")",
    );
    details.appendChild(summary);
    floor.parentNode.insertBefore(details, floor);
    // MOVED, not copied: two copies of a note in one document is two answers
    // to "how many are open", and a screen reader would read both.
    details.appendChild(floor);

    // PRINT. A printed page has no board, so the floor is the only listing
    // there is — and a closed `<details>` cannot be revealed by a stylesheet
    // in Chromium, which hides its contents with `content-visibility` on an
    // internal slot. A `@media print` rule would look like it worked and
    // print nothing, so the disclosure is opened here and put back after.
    if (typeof window.addEventListener === "function") {
      var wasOpen = false;
      window.addEventListener("beforeprint", function () {
        wasOpen = details.open;
        details.open = true;
      });
      window.addEventListener("afterprint", function () {
        details.open = wasOpen;
      });
    }
  }

  /** Fetch, then mount the board and hand the launcher a way to open it. */
  function mountTodoStickies() {
    // The threshold FIRST, because the board applies it as it mounts. Its
    // absence is a real answer and does not block anything: `fetchZoom` calls
    // back either way, and a board with no declaration keeps every card's
    // words rather than waiting for a number that is never coming.
    fetchZoom(function () {
    fetchTodoIndex(function (items) {
      if (items === null) return;
    fetchTodoGraph(function (edges) {
      // The graph's edges onto the index's items, by id. Written onto the
      // item itself so every surface that already takes a todo — the board,
      // its windows, the page stickies — has them without a second lookup.
      if (edges) {
        items.forEach(function (t) {
          var e = edges[t.id];
          if (!e) return;
          t.node = e.node;
          t.person = e.person;
          t.bean = e.bean;
          t.pageHref = e.pageHref;
        });
      }
      todoState.items = items;
      var board = mountTodoBoard(items);
      if (!board) return;
      mountPageStickies(items, board);
      collapseFloor(items.length);
      window.__faTodoBoard = board;
      document.dispatchEvent(new CustomEvent("fa:todos-ready", { detail: board }));
    });
    });
    });
  }

  /* ── Figure export: SVG, PNG and the clipboard (#1270) ───────────────── */

  /** The drawing in a figure: the inline <svg> once inlined, else the <img>. */
  function figureArt(scope) {
    return scope.querySelector("svg") || scope.querySelector("img");
  }

  /** A filename stem: the source file's name, else the page title. */
  function figureName(scope) {
    var art = figureArt(scope);
    var src = art ? (art.getAttribute("data-fa-src") || art.getAttribute("src") || "") : "";
    var stem = src.split("/").pop().replace(/[?#].*$/, "").replace(/\.svg$/i, "");
    if (!stem) stem = (document.title || "diagram").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return stem || "diagram";
  }

  /**
   * The figure as standalone SVG text.
   *
   * An inline <svg> is serialised from a clone, with the namespace and an
   * explicit size added so the file opens on its own. The size comes from the
   * viewBox, not from the page: zoom and full width are VIEW state, and a
   * downloaded diagram should be the diagram, not the reader's current zoom.
   * An <img> that was never inlined is fetched as the file it names.
   */
  function figureSvgText(scope) {
    var art = figureArt(scope);
    if (!art) return Promise.reject(new Error("no drawing in this figure"));
    if (String(art.nodeName).toLowerCase() === "img") {
      var src = art.getAttribute("src") || "";
      if (!/\.svg([?#]|$)/i.test(src)) return Promise.reject(new Error("the image is not an SVG"));
      return window.fetch(src).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      });
    }
    return Promise.resolve(inlineSvgText(art));
  }

  /** An inline <svg> serialised as a standalone file, at its own size. */
  function inlineSvgText(art) {
    var clone = art.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    clone.removeAttribute("style");
    clone.removeAttribute("data-fa-src");
    var size = svgSize(art);
    clone.setAttribute("width", String(size.w));
    clone.setAttribute("height", String(size.h));
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new window.XMLSerializer().serializeToString(clone);
  }

  /** The drawing's own size: its viewBox, else its width/height, else its box. */
  function svgSize(svg) {
    var vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { w: vb[2], h: vb[3] };
    var w = parseFloat(svg.getAttribute("width") || ""), h = parseFloat(svg.getAttribute("height") || "");
    if (w > 0 && h > 0) return { w: w, h: h };
    var box = svg.getBoundingClientRect();
    return { w: Math.max(1, Math.round(box.width)), h: Math.max(1, Math.round(box.height)) };
  }

  /** The page's own background, so a PNG of a dark-themed page is not transparent. */
  function pageBackground() {
    var c = getComputedStyle(document.body).backgroundColor;
    return !c || c === "transparent" || /rgba\([^)]*,\s*0\)$/.test(c) ? "#ffffff" : c;
  }

  /**
   * The figure rendered to a PNG blob at twice its size, for a sharp result
   * on a high-density screen or in a slide. Rejects — and the caller says so —
   * when the browser refuses (a drawing that references another origin taints
   * the canvas), rather than producing an empty image.
   */
  function figurePng(scope) {
    return figureSvgText(scope).then(function (text) {
      return new Promise(function (resolve, reject) {
        var dims = svgSize(new window.DOMParser().parseFromString(text, "image/svg+xml").documentElement);
        var url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
        var img = new Image();
        img.onload = function () {
          try {
            var scale = 2;
            var canvas = document.createElement("canvas");
            canvas.width = Math.round(dims.w * scale);
            canvas.height = Math.round(dims.h * scale);
            var ctx = canvas.getContext("2d");
            ctx.fillStyle = pageBackground();
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(function (blob) {
              URL.revokeObjectURL(url);
              if (blob) resolve(blob); else reject(new Error("the browser produced no image"));
            }, "image/png");
          } catch (e) {
            URL.revokeObjectURL(url);
            reject(e);
          }
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("the SVG would not render")); };
        img.src = url;
      });
    });
  }

  /**
   * The address of a figure's source .svg file, absolute, or "" when the
   * drawing has no file of its own (#915). The file is the committed
   * artefact, so its address can be bookmarked and shared.
   */
  function figureFileUrl(scope) {
    var art = figureArt(scope);
    if (!art) return "";
    var isImg = String(art.nodeName).toLowerCase() === "img";
    var src = art.getAttribute("data-fa-src") || (isImg ? art.getAttribute("src") : "") || "";
    if (!src) return "";
    try { return new URL(src, document.baseURI).href; } catch (_e) { return ""; }
  }

  /**
   * Set up a figure's "Open" link (#915). With a source file it is a plain
   * link to it, so a click, a middle-click and "Open link in new tab" all
   * work. A drawing with no file has nothing to link to, so the link acts as
   * a button instead and opens the serialised drawing as a blob: in a new tab.
   */
  function figureOpenTarget(scope, link) {
    var url = figureFileUrl(scope);
    if (url && safeHref(url)) {
      link.href = safeHref(url);
      link.removeAttribute("role");
      link.removeAttribute("tabindex");
      return;
    }
    link.removeAttribute("href");
    link.setAttribute("role", "button");
    link.setAttribute("tabindex", "0");
  }

  /** Open a figure with no file of its own as a blob: in a new tab. */
  function openFigureBlob(scope) {
    var art = figureArt(scope);
    if (!art || String(art.nodeName).toLowerCase() !== "svg") return false;
    var url = URL.createObjectURL(new Blob([inlineSvgText(art)], { type: "image/svg+xml" }));
    window.open(url, "_blank", "noopener");
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    return true;
  }

  /** Save a blob under a filename, through a transient link. */
  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: name }); // href-safe: a blob: URL this function minted over the figure's own bytes, never document data
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  /**
   * Copy the figure: as a PNG image where the browser allows writing images
   * to the clipboard, otherwise as SVG text. Resolves to a sentence saying
   * WHICH it was, because "copied" alone would leave a reader pasting text
   * where they expected a picture.
   */
  function copyFigure(scope) {
    var clip = navigator.clipboard;
    if (!clip) return Promise.resolve("Copy is not available here (the clipboard needs a secure page)");
    var asText = function () {
      return figureSvgText(scope)
        .then(function (text) { return clip.writeText(text); })
        .then(function () { return "Copied as SVG text — this browser does not accept images on the clipboard"; });
    };
    var attempt = typeof window.ClipboardItem === "function" && typeof clip.write === "function"
      ? clip.write([new window.ClipboardItem({ "image/png": figurePng(scope) })])
          .then(function () { return "Copied as a PNG image"; })
          .catch(asText)
      : asText();
    return attempt.catch(function (e) { return "Could not copy: " + e.message; });
  }

  /* A BPMN FIGURE'S LABELS READ AT THE SIZE OF THE TEXT AROUND IT (owner,
     2026-11-02: "bpmn diagrams should be scaled so the text size matches
     narrative text size"). The drawing used to fill the column with a 1200px
     floor, so a small process came out with labels bigger than the prose and
     a wide one with labels a third of its size. Now 100% means: the label
     size the drawing's task names use, scaled to 80% of the body text's size. A
     drawing wider than its card scrolls (and pans) inside it, and zoom still
     multiplies from there. The label size is read from the inlined SVG, so a
     figure that stayed an <img> keeps the old sizing. */
  // The size the task names use. bpmn-js draws a task name a step larger
  // than the "yes"/"no" and event labels beside it, and those labels can
  // carry more characters between them, so the most common size would be the
  // wrong one. So: the LARGEST size that carries at least a quarter of the
  // drawing's characters, which skips a lone title and keeps the task names.
  function labelFontPx(svg) {
    var chars = {}, total = 0;
    [].forEach.call(svg.querySelectorAll("text"), function (t) {
      var n = (t.textContent || "").replace(/\s+/g, "").length;
      if (!n) return;
      var px = Math.round(parseFloat(getComputedStyle(t).fontSize) * 10) / 10;
      if (!(px > 0)) return;
      chars[px] = (chars[px] || 0) + n;
      total += n;
    });
    var best = 0;
    Object.keys(chars).forEach(function (k) {
      var px = parseFloat(k);
      if (chars[k] >= total / 4 && px > best) best = px;
    });
    return best;
  }

  function bodyFontPx(scope) {
    var main = (scope.closest && scope.closest(".main-content")) || document.body;
    var p = main.querySelector("p");
    return parseFloat(getComputedStyle(p || main).fontSize) || 16;
  }

  // Owner, 2026-11-02 (follow-up): "make it 80% same size" -- the task names
  // are drawn at 80% of the body text size, a little quieter than the prose.
  var FIGURE_TEXT_RATIO = 0.8;

  function isBpmnSvg(scope) {
    var svg = scope.querySelector("svg");
    return !!(svg && svg.querySelector("[data-element-id]"));
  }

  // A plain figure that turns out to be a BPMN drawing is text-fitted. Also
  // called when the inlined <svg> lands in a figure mounted while it was
  // still an <object> (the Mermaid observer can mount mid-inlining).
  function fitBpmn(scope) {
    if (!isBpmnSvg(scope)) return false;
    fitTextToBody(scope);
    if (!scope.classList.contains("fa-textfit")) return false;
    scope.classList.remove("fa-plain");
    return true;
  }

  function fitTextToBody(scope) {
    var svg = scope.querySelector("svg");
    var width = intrinsicWidth(scope);
    if (!svg || !width) return;
    var label = labelFontPx(svg);
    if (!label) return;
    scope.classList.add("fa-textfit");
    scope.style.setProperty("--fa-natural", (width * FIGURE_TEXT_RATIO * bodyFontPx(scope) / label).toFixed(1) + "px");
  }

  function mountFigure(scope, isPlain) {
    if (scope.dataset.faTools === "1") return;
    scope.dataset.faTools = "1";
    scope.classList.add("fa-figure-scope");
    if (isPlain) scope.classList.add("fa-plain");
    // 100% IS THE DRAWING'S OWN SIZE, capped at the column (bean `n7f8`). A
    // plain figure used to be stretched to the full column whatever it was
    // drawn at, so a 555px PlantUML diagram arrived at more than twice its
    // size, text and all. The stylesheet reads this as `min(100%, natural)`;
    // with no natural size known it falls back to the column, as before.
    // EVERY BPMN drawing is text-fitted, not only one in a `.bpmn-figure`
    // (owner, 2026-11-12: "bpmn font size is 80% of main narrative size ...
    // applies all bpmn"). An IG page embeds its BPMN as a bare
    // `<object data="x.svg">`, which arrives here as a plain figure and was
    // stretched to the column, so its labels came out anywhere from 66% to
    // 95% of the body text. bpmn-js output is recognised by its
    // `data-element-id` shapes, an attribute `scopeSvg` leaves alone.
    if (isPlain && fitBpmn(scope)) isPlain = false;
    if (isPlain) {
      var art0 = scope.querySelector("svg, img, object");
      var natural = intrinsicWidth(scope) ||
        (art0 && art0.tagName.toLowerCase() === "img" ? art0.naturalWidth : 0) ||
        (art0 ? parseFloat(art0.getAttribute("width") || "") || 0 : 0);
      if (natural > 0) scope.style.setProperty("--fa-natural", natural + "px");
    } else {
      fitTextToBody(scope);
    }

    var step = DEFAULT_STEP;
    var tools = el("div", { class: "fa-figure-tools", role: "group", "aria-label": "Figure view controls" });
    var out = el("button", { type: "button", "aria-label": "Zoom out" }, "−");
    var level = el("span", { class: "fa-zoom-level", "aria-live": "polite" }, "100%");
    var into = el("button", { type: "button", "aria-label": "Zoom in" }, "+");
    var reset = el("button", { type: "button", "aria-label": "Reset zoom" }, "Reset");
    var wide = el("button", { type: "button", "aria-label": "Expand to the full display width", "aria-pressed": "false" }, "Full width");

    // The grab cursor is a PROMISE, so only make it when there is somewhere to
    // pan to. A figure that fits its card has no scroll room, and a `grab`
    // cursor over it says otherwise -- the drag would do nothing and the
    // cursor would be the only thing that had lied. Re-measured on every zoom
    // change, inside rAF because the custom property has to reach layout
    // before scrollWidth means anything. The +1 absorbs sub-pixel rounding,
    // which otherwise flickers the class on and off at exactly 100%.
    function markPannable() {
      requestAnimationFrame(function () {
        scope.classList.toggle("is-pannable", scope.scrollWidth > scope.clientWidth + 1);
      });
    }

    // Owner, 2026-11-01, after the drag grew the figure ("dragging now
    // rescales", "i want it to pan"): a drag never changes the size. On an
    // axis with scroll room it scrolls the figure; on an axis where the
    // drawing fits its card, it moves the drawing inside the card, by
    // `translate`, up to PAN_KEEP of the card from where it was drawn so it
    // cannot be lost. Zoom and Reset put the drawing back.
    var PAN_KEEP = 0.75;
    var shift = { x: 0, y: 0 };
    function art() { return scope.querySelector("svg, img, object"); }
    function setShift(x, y) {
      shift.x = x; shift.y = y;
      var a = art();
      if (a) a.style.translate = (x || y) ? x + "px " + y + "px" : "";
      // A moved drawing must not grow the card's scroll room, or the next
      // drag would scroll where it should move.
      scope.classList.toggle("is-shifted", !!(x || y));
    }
    function clampShift(v, room) { return Math.max(-room * PAN_KEEP, Math.min(room * PAN_KEEP, v)); }

    function apply() {
      var z = ZOOM_STEPS[step];
      setShift(0, 0);
      scope.style.setProperty("--fa-zoom", String(z));
      level.textContent = Math.round(z * 100) + "%";
      out.disabled = step === 0;
      into.disabled = step === ZOOM_STEPS.length - 1;
      markPannable();
    }
    out.addEventListener("click", function () { if (step > 0) { step--; apply(); } });
    into.addEventListener("click", function () { if (step < ZOOM_STEPS.length - 1) { step++; apply(); } });
    reset.addEventListener("click", function () { step = DEFAULT_STEP; apply(); });

    // THE KEYBOARD IS A WAY IN, NOT AN AFTERTHOUGHT (bean `n7f8`). This
    // instance's profile is low-dexterity, and `board-windows` §"The floor"
    // says drag is an accelerator and never the only way in. The toolbar's
    // buttons already zoom from the keyboard; PANNING was drag-only, because
    // the figure was a scroll container nobody could focus. So the figure
    // takes focus, and once focused: the arrow keys pan, `+` and `-` zoom, and
    // `0` resets, the same steps the buttons take. An arrow is taken only when
    // the figure can actually scroll that way, so a figure that fits does not
    // swallow the arrow that should scroll the page.
    scope.setAttribute("tabindex", "0");
    scope.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown + - 0");
    if (!scope.hasAttribute("title")) {
      scope.setAttribute("title", "Diagram: arrow keys pan, + and - zoom, 0 resets");
    }
    var PAN_FRACTION = 0.1;
    var MIN_PAN_PX = 40;
    scope.addEventListener("keydown", function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      // A control or a link inside the figure owns its own keys.
      if (e.target !== scope && e.target.closest && e.target.closest("a, button, input, select, textarea")) return;
      var k = e.key;
      var dx = Math.max(MIN_PAN_PX, scope.clientWidth * PAN_FRACTION);
      var dy = Math.max(MIN_PAN_PX, scope.clientHeight * PAN_FRACTION);
      var canX = scope.scrollWidth > scope.clientWidth + 1;
      var canY = scope.scrollHeight > scope.clientHeight + 1;
      if (k === "+" || k === "=") { if (step < ZOOM_STEPS.length - 1) { step++; apply(); } }
      else if (k === "-" || k === "_") { if (step > 0) { step--; apply(); } }
      else if (k === "0") { step = DEFAULT_STEP; apply(); }
      else if (k === "ArrowLeft" && canX) scope.scrollLeft -= dx;
      else if (k === "ArrowRight" && canX) scope.scrollLeft += dx;
      else if (k === "ArrowUp" && canY) scope.scrollTop -= dy;
      else if (k === "ArrowDown" && canY) scope.scrollTop += dy;
      else return;
      e.preventDefault();
    });
    // Full-bleed by MEASUREMENT, not by the centred-element margin trick. The
    // figure sits in a content column offset right by the sidebar, so
    // `margin-left: calc(-1 * (100vw - 100%) / 2)` overshoots by about the
    // sidebar width at each edge -- which is what "way oversize" looked like.
    // Reading the element's own left edge needs no assumption about the
    // theme's geometry, and clientWidth excludes the scrollbar, which 100vw
    // does not.
    function applyFullWidth() {
      scope.style.marginLeft = "";
      scope.style.marginRight = "";
      scope.style.width = "";
      if (!scope.classList.contains("is-fullwidth")) return;
      var box = scope.getBoundingClientRect();
      var band = fullWidthBand();
      // A block with a set width anchors to its START edge and ignores the
      // other margin, so RTL moves the right margin. Moving the left one in
      // RTL did nothing and the figure ran off the left of the window.
      if (getComputedStyle(scope).direction === "rtl") {
        scope.style.marginRight = (box.right - band.right) + "px";
      } else {
        scope.style.marginLeft = (band.left - box.left) + "px";
      }
      scope.style.width = (band.right - band.left) + "px";
      markPannable();
    }
    wide.addEventListener("click", function () {
      var on = scope.classList.toggle("is-fullwidth");
      wide.setAttribute("aria-pressed", on ? "true" : "false");
      // An explicit press is the reader overriding the default, in either
      // direction, and it sticks for the next page too.
      setFullWidthPref(on ? "on" : "off");
      applyFullWidth();
      markFullWidthOnRoot();
    });
    // The measured offset is only right for the width it was measured at.
    window.addEventListener("resize", applyFullWidth);
    // Opening the rail pushes the content column over, so the band moves
    // without the window resizing, and both slide on a CSS transition. Watch
    // the rail and the column: each fires on every frame of the slide, and
    // the last one lands after it, so the figure settles where they do.
    if (typeof ResizeObserver === "function") {
      var ro = new ResizeObserver(applyFullWidth);
      var rail = navRail();
      var column = document.querySelector(".main");
      if (rail) ro.observe(rail);
      if (column) ro.observe(column);
    }

    // Scroll pass-through in full width.
    //
    // `overflow-x: auto` on the figure makes it a scroll container on BOTH
    // axes -- CSS promotes the other axis from `visible` to `auto` -- so in
    // full width, where the figure spans the whole viewport, a wheel anywhere
    // in that band is eaten by the figure instead of moving the page. The
    // band is mostly empty: the drawing is centred and the rest is padding.
    //
    // So: if the pointer is NOT over the drawing, and the figure is short
    // enough that scrolling INSIDE it is not what the reader can have meant,
    // send the wheel to the page. The height cut-off is the caller's --
    // 80% of the viewport -- and it is the right shape: a figure taller than
    // that has real vertical travel of its own and should keep its wheel.
    //
    // Only the vertical component is taken. Horizontal wheel (shift-wheel, or
    // a trackpad swipe) is how you pan a wide diagram from the empty band,
    // and that still works.
    var MAX_PASSTHROUGH_FRACTION = 0.8;

    scope.addEventListener("wheel", function (e) {
      if (!scope.classList.contains("is-fullwidth")) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

      var viewport = document.documentElement.clientHeight;
      if (scope.getBoundingClientRect().height > MAX_PASSTHROUGH_FRACTION * viewport) return;

      var art = scope.querySelector("img, svg");
      if (art) {
        var a = art.getBoundingClientRect();
        if (e.clientX >= a.left && e.clientX <= a.right &&
            e.clientY >= a.top  && e.clientY <= a.bottom) return;
      }

      // deltaY is not always pixels: deltaMode 1 is lines and 2 is pages.
      // Scrolling by a raw line count moves the page by three pixels and
      // reads as the wheel being broken.
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;
      else if (e.deltaMode === 2) d *= viewport;

      e.preventDefault();
      window.scrollBy(0, d);
    }, { passive: false });

    // Click and drag to pan.
    //
    // The figure is already a scroll container, so panning is just moving its
    // scroll offsets — no transform, which means it composes with zoom and with
    // the subprocess links instead of fighting them.
    //
    // Two details keep a drag from eating a click. The 4px threshold means a
    // plain click never becomes a pan, so a subprocess link still navigates;
    // and once a pan HAS happened the following click is swallowed in the
    // capture phase, so releasing over a link does not follow it. Pointer
    // events rather than mouse events, so a touch drag works the same way.
    var drag = null;
    var panned = false;
    scope.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      // A control or a link owns its own press.
      if (e.target.closest && e.target.closest("a, button, input, select, textarea")) return;
      // Which axes scroll and which move the drawing is fixed for the drag,
      // measured without the drawing's own move, which adds scroll room.
      var a = art(), was = a ? a.style.translate : "";
      if (a) a.style.translate = "";
      var canX = scope.scrollWidth > scope.clientWidth + 1;
      var canY = scope.scrollHeight > scope.clientHeight + 1;
      if (a) a.style.translate = was;
      drag = {
        x: e.clientX, y: e.clientY, sl: scope.scrollLeft, st: scope.scrollTop, py: e.clientY, moved: false,
        canX: canX, canY: canY, tx: shift.x, ty: shift.y, touch: e.pointerType === "touch",
      };
      try { scope.setPointerCapture(e.pointerId); } catch (_e) { /* not captureable */ }
      // Owner, 2026-10-31, with a screenshot: *"i cant drag Figure"*. A mouse
      // press on an inline SVG's text started a text selection before the 4px
      // threshold put `is-panning` (and its `user-select: none`) on the scope,
      // so the drag selected labels instead. Cancelling the press stops the
      // selection from starting; it also cancels the focus the press would
      // give, so focus is taken here, without scrolling, to keep the arrow
      // keys working after a click.
      if (e.pointerType === "mouse") {
        e.preventDefault();
        try { scope.focus({ preventScroll: true }); } catch (_e) { /* not focusable */ }
      }
    });

    // Safari and Firefox fire `selectstart` from the compatibility mousedown
    // even when the pointerdown was cancelled. A selection never starts
    // inside a figure, except in a form control.
    scope.addEventListener("selectstart", function (e) {
      var t = e.target && e.target.nodeType === 3 ? e.target.parentNode : e.target;
      if (t && t.closest && t.closest("input, textarea")) return;
      e.preventDefault();
    });

    scope.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      drag.moved = true;
      scope.classList.add("is-panning");
      if (drag.canX) scope.scrollLeft = drag.sl - dx;
      if (drag.canY) scope.scrollTop = drag.st - dy;
      if (!drag.canX || (!drag.canY && !drag.touch)) {
        setShift(drag.canX ? 0 : clampShift(drag.tx + dx, scope.clientWidth),
          drag.canY || drag.touch ? 0 : clampShift(drag.ty + dy, scope.clientHeight));
      }
      // A finger on a figure that cannot scroll down still scrolls the page,
      // so a phone reader is never stuck on a figure.
      if (drag.touch && !drag.canY) {
        var dyStep = e.clientY - drag.py;
        drag.py = e.clientY;
        if (dyStep !== 0) window.scrollBy(0, -dyStep);
      }
      e.preventDefault();
    });

    function endPan() {
      if (!drag) return;
      panned = drag.moved;
      drag = null;
      scope.classList.remove("is-panning");
    }
    scope.addEventListener("pointerup", endPan);
    scope.addEventListener("pointercancel", endPan);
    scope.addEventListener("click", function (e) {
      if (!panned) return;
      panned = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    // Export (#1270, owner: "download rendered png, src svg or copy to
    // clipboard any diagrams"). On the same toolbar, so every figure that has
    // zoom has these too. The art is looked up at press time, not mount time:
    // an <img> is replaced by its inline <svg> after the toolbar mounts.
    var svgBtn = el("button", { type: "button", class: "fa-figure-export-start", "aria-label": "Download this diagram as SVG" }, "SVG");
    var pngBtn = el("button", { type: "button", "aria-label": "Download this diagram as PNG" }, "PNG");
    var copyBtn = el("button", { type: "button", "aria-label": "Copy this diagram to the clipboard" }, "Copy");
    var said = el("span", { class: "fa-figure-status", role: "status", "aria-live": "polite" });
    var saidTimer = 0;
    function say(msg) {
      said.textContent = msg;
      clearTimeout(saidTimer);
      saidTimer = setTimeout(function () { said.textContent = ""; }, 4000);
    }
    svgBtn.addEventListener("click", function () {
      figureSvgText(scope).then(function (text) {
        saveBlob(new Blob([text], { type: "image/svg+xml" }), figureName(scope) + ".svg");
        say("SVG downloaded");
      }).catch(function (e) { say("Could not export SVG: " + e.message); });
    });
    pngBtn.addEventListener("click", function () {
      figurePng(scope).then(function (blob) {
        saveBlob(blob, figureName(scope) + ".png");
        say("PNG downloaded");
      }).catch(function (e) { say("Could not export PNG: " + e.message); });
    });
    copyBtn.addEventListener("click", function () { copyFigure(scope).then(say); });

    // Open in a new tab (#915, owner: "with SVGs and such there is no 'view in
    // new tab' option"). Inlining an <img> as <svg> takes away the browser's
    // own "Open image in new tab", so this puts it back. It is a LINK, not a
    // button, so a click, a middle-click and the right-click "Open link in new
    // tab" all work.
    var openLink = el("a", { class: "fa-figure-open", target: "_blank", rel: "noopener", "aria-label": "Open this diagram in a new tab" }, "Open ↗");
    figureOpenTarget(scope, openLink);
    function openNoFile(e) {
      if (openLink.hasAttribute("href")) return;
      e.preventDefault();
      if (!openFigureBlob(scope)) say("Could not open this diagram");
    }
    openLink.addEventListener("click", openNoFile);
    openLink.addEventListener("keydown", function (e) {
      if (!openLink.hasAttribute("href") && (e.key === "Enter" || e.key === " ")) openNoFile(e);
    });

    [out, level, into, reset, wide, svgBtn, pngBtn, copyBtn, openLink, said].forEach(function (n) { tools.appendChild(n); });
    // One host holds the controls and the figure, so on a laptop the
    // controls can float over the figure and show only on hover (owner,
    // 2026-11-01: "controls should only appear ... on mouse hover", "tighten
    // up ... vertical space"). A touch screen keeps them in a row above.
    var host = el("div", { class: "fa-figure-host" });
    scope.parentNode.insertBefore(host, scope);
    host.appendChild(tools);
    host.appendChild(scope);

    // Drag the bottom edge down to make the figure longer (owner,
    // 2026-11-01: "you should also be able to drag bottom of figure down to
    // make longer"). The card is as tall as its drawing, so a longer card is
    // a bigger drawing: the handle sets the zoom so the drawing's height
    // follows the pointer, and up makes it shorter again. A full-width bar,
    // not the browser's corner grip, so it is easy to hit; focusable, so the
    // arrow keys do the same in zoom steps.
    var grip = el("div", {
      class: "fa-figure-grip", role: "separator", tabindex: "0",
      "aria-orientation": "horizontal", "aria-label": "Drag down to make the figure longer, up to make it shorter",
      title: "Drag down to make the figure longer",
    });
    host.appendChild(grip);
    var sizing = null;
    function setZoom(z) {
      z = Math.max(ZOOM_STEPS[0], Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], z));
      scope.style.setProperty("--fa-zoom", String(z));
      level.textContent = Math.round(z * 100) + "%";
      step = 0;
      while (step < ZOOM_STEPS.length - 1 && ZOOM_STEPS[step + 1] <= z + 1e-9) step++;
      out.disabled = z <= ZOOM_STEPS[0];
      into.disabled = z >= ZOOM_STEPS[ZOOM_STEPS.length - 1];
      markPannable();
    }
    grip.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      var art = scope.querySelector("svg, img, object");
      var h = art ? art.getBoundingClientRect().height : scope.clientHeight;
      if (!(h > 0)) return;
      var cur = parseFloat(scope.style.getPropertyValue("--fa-zoom")) || ZOOM_STEPS[step];
      sizing = { y: e.clientY, h: h, z: cur };
      try { grip.setPointerCapture(e.pointerId); } catch (_e) { /* not captureable */ }
      grip.classList.add("is-sizing");
      e.preventDefault();
    });
    grip.addEventListener("pointermove", function (e) {
      if (!sizing) return;
      setZoom(sizing.z * Math.max(0.1, sizing.h + (e.clientY - sizing.y)) / sizing.h);
      e.preventDefault();
    });
    function endSizing() { sizing = null; grip.classList.remove("is-sizing"); }
    grip.addEventListener("pointerup", endSizing);
    grip.addEventListener("pointercancel", endSizing);
    grip.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" && step < ZOOM_STEPS.length - 1) { step++; apply(); }
      else if (e.key === "ArrowUp" && step > 0) { step--; apply(); }
      else return;
      e.preventDefault();
    });
    apply();

    // After insertion, so `clientWidth` is the real column width rather than 0.
    if (shouldAutoExpand(scope)) {
      scope.classList.add("is-fullwidth");
      wide.setAttribute("aria-pressed", "true");
      applyFullWidth();
      markFullWidthOnRoot();
    }
  }

  function mountFigures() {
    document.querySelectorAll(".bpmn-figure").forEach(function (f) {
      if (f.querySelector("[data-fa-inline-pending]")) return;
      mountFigure(f, false);
    });

    // Any other SVG in the body gets the same controls -- but only if it is a
    // FIGURE. The first version of this matched `.main-content svg`, which in
    // just-the-docs also matches the anchor-heading link icons and the search
    // glyph, so every heading on the page grew a zoom toolbar squeezed into a
    // few pixels. An icon is distinguishable from a figure three ways, and all
    // three are cheap:
    //   - it lives inside something interactive or navigational;
    //   - it says so in its class name;
    //   - it is small.
    // Requiring all three to pass keeps a genuinely small diagram out of the
    // controls, which is the right failure direction: a missing toolbar is a
    // nuisance, a toolbar on every heading is unusable.
    var ICON_CONTEXT = "a, button, nav, label, summary, .search, .site-header, .site-footer, .breadcrumb-nav";
    var MIN_FIGURE_PX = 240;

    // A RASTER diagram is a figure only where the page SAYS its images are
    // figures (`data-fa-figure-images`, stamped by the IG site build — bean
    // `n7f8`). An IG's architecture drawings are `.drawio.png`, and the theme
    // shrinks a wide one to the column with nothing to zoom it back. On the
    // platform's own pages a raster image is as often a card face or a photo,
    // and a toolbar on those would be the heading-icon failure again, so the
    // opt-in is the page's and not a guess made here. Even opted in, only an
    // image the column has SHRUNK qualifies: one shown at its own size is
    // already readable and gains nothing but chrome.
    var rasterOk = !!document.querySelector("[data-fa-figure-images]");
    // A rendered DOCUMENT (`.fa-doc`, a handbook or guideline page) says the
    // same thing by being one: its images are the publication's figures, never
    // card faces, so every large one gets the controls, shrunk or not. A
    // reader still wants to zoom, pan and copy a figure shown at its own size.
    var docFigures = ".fa-doc img";
    var sel = ".main-content img[src$='.svg'], .main-content svg, .main-content object[data$='.svg'], " + docFigures +
      (rasterOk ? ", .main-content img" : "");

    document.querySelectorAll(sel).forEach(function (node) {
      // A drawing still waiting to be inlined is mounted once it is, by
      // `inlineDiagrams` calling back here: wrapped now, the scan would see
      // an <img> and size its controls for that.
      if (node.hasAttribute("data-fa-inline-pending")) return;
      if (node.closest(".bpmn-figure") || node.closest(".fa-qr-host")) return;
      if (node.closest(".fa-figure-scope")) return;
      // An <svg> nested in another is part of that drawing, never its own figure.
      if (node.parentElement && node.parentElement.closest("svg")) return;
      if (node.closest(ICON_CONTEXT)) return;
      if (/icon/i.test(node.getAttribute("class") || "")) return;
      var tag = node.tagName.toLowerCase();
      if (tag === "img" && !/\.svg($|[?#])/i.test(node.getAttribute("src") || "")) {
        // Not loaded yet: its size is unknown, so ask again once it is.
        if (!node.complete || !node.naturalWidth) {
          if (!node.dataset.faFigureWait) {
            node.dataset.faFigureWait = "1";
            node.addEventListener("load", function () { mountFigures(); }, { once: true });
          }
          return;
        }
        var shown = node.getBoundingClientRect().width;
        var column = node.parentElement ? node.parentElement.clientWidth : 0;
        if (shown < MIN_FIGURE_PX) return;
        if (!node.closest(".fa-doc") && (node.naturalWidth <= shown + 1 || shown < 0.9 * column)) return;
      }
      var box = node.getBoundingClientRect();
      if (box.width < MIN_FIGURE_PX && box.height < MIN_FIGURE_PX) return;
      // Mermaid renders into a wrapper element; wrap THAT rather than the
      // <svg>, so the scroll container and the zoom rules sit outside
      // everything the renderer owns and it is not fighting us for the
      // element's style.
      //
      // The selector is `.language-mermaid`, which is what THIS theme emits
      // and what it hands to `mermaid.run()` -- see just-the-docs
      // `_includes/components/mermaid.html`. It was `.mermaid`, Mermaid's own
      // conventional class, which this theme never sets: `closest` returned
      // null every time, so the <svg> was wrapped directly and the renderer
      // kept ownership of the element the zoom rules were trying to size.
      var target = node.closest(".language-mermaid") || node;
      var wrap = el("div", { class: "fa-figure-wrap" });
      target.parentNode.insertBefore(wrap, target);
      wrap.appendChild(target);
      mountFigure(wrap, true);
    });
  }

  /* ── Inline the diagram SVGs ─────────────────────────────────────────── */

  // An `<img src="...svg">` renders the drawing and is otherwise INERT: links
  // inside it never fire and nothing in it can be dragged. The subprocess boxes
  // in the workflow diagrams are `<a>` elements (added by scripts/render-bpmn.ts)
  // and they are dead for exactly that reason, so the figure has to be a real
  // `<svg>` in this document.
  //
  // Fetched rather than server-side included because the SVGs are build output
  // under assets/, which Jekyll's `include` cannot reach. Same-origin, and the
  // markup is our own build artefact.
  //
  // Degrades to the existing static image: if the fetch or the parse fails the
  // `<img>` is left exactly as it was, with one warning naming the file.
  // `<object data="x.svg">` IS THE SAME DRAWING BY ANOTHER TAG, and an IG page
  // uses it: the IG Publisher's convention for a pre-rendered SVG is
  // `<object data="x.svg" type="image/svg+xml">`, and the IG page the owner
  // reported (a sequence-diagrams page) carries three beside two inline ones.
  // Before bean `n7f8` this function and `mountFigures` looked only for
  // `<img>` and `<svg>`, so the inline two got the viewer and the three
  // objects got nothing: no zoom, no scroll container, and the widest ran past
  // the content column and was clipped. An `<object>`'s document is also not
  // this page's, so nothing here could have reached into it anyway; inlining
  // it is what puts it under the one viewer. Its fallback text, the only text
  // it carries, becomes the accessible name, as `alt` does for an `<img>`.
  // AN INLINED SVG'S STYLESHEET IS NO LONGER ITS OWN. Inside `<img>` a file's
  // `<style>` applies to that file alone; moved into this document it applies
  // to the whole PAGE. Visio exports (the WHO IGs' business-process figures)
  // all name their classes `.st1`…`.st30` and their markers `mrkr…`, with a
  // different meaning in every file, so a page holding eight of them rendered
  // each with whichever file's rules came last: black-filled gateways, lost
  // labels, a stray marker drawn as a large black wedge (reported 2026-10-10
  // on smart-immunizations' business-processes page). Each inlined drawing
  // therefore gets its own prefix on every class and id, and its `<style>`
  // selectors, `url(#…)` references and `#…` hrefs are rewritten to match.
  // The harness's OWN classes (`fa-…`, e.g. render-bpmn's `fa-subprocess-link`)
  // are not the file's private names: the page's stylesheet and scripts select
  // them, so they are left as written. Prefixing them broke every subprocess
  // link on the processes pages (subprocess-links.e2e.ts, 2026-10-10).
  var svgScopeSeq = 0;
  function scopeSvg(svg) {
    var pfx = "fa-svg" + ++svgScopeSeq + "-";
    function scoped(c) { return /^fa-/.test(c) ? c : pfx + c; }
    var ids = {};
    [].forEach.call(svg.querySelectorAll("[id]"), function (el) {
      var id = el.getAttribute("id");
      ids[id] = pfx + id;
      el.setAttribute("id", pfx + id);
    });
    function reId(text) {
      return text.replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, function (m, q, id) {
        return ids[id] ? "url(" + q + "#" + ids[id] + q + ")" : m;
      });
    }
    [].forEach.call(svg.querySelectorAll("*"), function (el) {
      var cls = el.getAttribute("class");
      if (cls) {
        el.setAttribute("class", cls.split(/\s+/).filter(Boolean).map(scoped).join(" "));
      }
      [].forEach.call([].slice.call(el.attributes), function (a) {
        if (a.value.indexOf("url(") !== -1) el.setAttribute(a.name, reId(a.value));
        if ((a.localName === "href") && a.value.charAt(0) === "#" && ids[a.value.slice(1)]) {
          el.setAttributeNS(a.namespaceURI, a.name, "#" + ids[a.value.slice(1)]);
        }
      });
    });
    var rootCls = svg.getAttribute("class");
    if (rootCls) svg.setAttribute("class", rootCls.split(/\s+/).filter(Boolean).map(scoped).join(" "));
    // Selectors are rewritten only OUTSIDE the declaration blocks, so a value
    // such as `font-size:0.83em` is never mistaken for a class.
    [].forEach.call(svg.querySelectorAll("style"), function (st) {
      var css = st.textContent, out = "", depth = 0, buf = "";
      for (var i = 0; i < css.length; i++) {
        var ch = css.charAt(i);
        if (ch === "{") {
          if (depth === 0) {
            out += buf.replace(/([.#])(-?[A-Za-z_][\w-]*)/g, function (m, sigil, name) {
              return sigil === "." ? "." + scoped(name) : (ids[name] ? "#" + ids[name] : m);
            });
            buf = "";
          }
          depth++;
          out += ch;
        } else if (ch === "}") {
          depth--;
          out += ch;
        } else if (depth === 0) {
          buf += ch;
        } else {
          out += ch;
        }
      }
      st.textContent = reId(out + buf);
    });
    return svg;
  }

  // LAZY, AS THEY NEAR THE VIEWPORT (owner, 2026-11-14: "do lazy load content
  // and libs"). Every drawing used to be fetched and parsed at load, wherever
  // it sat, and the figure controls of the whole page waited for the slowest.
  // Now `done` (mountFigures) runs at once for everything already drawable,
  // each drawing is inlined when it comes within INLINE_MARGIN of the
  // viewport, and its own controls are mounted when it is. A drawing still an
  // <img> carries `data-fa-inline-pending`, which mountFigures skips.
  //
  // PRINT (owner, 2026-11-14: "Make sure printing loads all of the content
  // before it renders the PDF"): an un-inlined drawing is still its own
  // <img>, which prints; `beforeprint` turns any `loading="lazy"` image in
  // the content eager and starts inlining every pending drawing, and
  // `faInlineAllDiagrams()` returns a promise for a caller that can wait
  // (a Print button would await it, then call window.print()).
  var INLINE_MARGIN = "1000px 0px";
  var inlineQueue = [];
  function inlineDiagrams(done) {
    var imgs = [].slice.call(
      document.querySelectorAll(
        '.bpmn-figure img[src$=".svg"], .main-content img[src$=".svg"], ' +
          '.main-content object[data$=".svg"], .main-content object[type="image/svg+xml"][data]',
      ),
    );
    if (!imgs.length || typeof window.fetch !== "function" || typeof window.DOMParser !== "function") {
      done();
      return;
    }
    imgs.forEach(function (img) { img.setAttribute("data-fa-inline-pending", ""); });
    inlineQueue = imgs;
    done();
    if (typeof window.IntersectionObserver !== "function") {
      // No observer: the old behaviour, every drawing now.
      inlineAll();
      return;
    }
    var io = new window.IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        inlineOne(e.target);
      });
    }, { rootMargin: INLINE_MARGIN });
    imgs.forEach(function (img) { io.observe(img); });
  }

  /** Inline every drawing not yet inlined; resolves when all have settled. */
  function inlineAll() {
    return Promise.all(inlineQueue.map(inlineOne));
  }
  window.faInlineAllDiagrams = inlineAll;

  window.addEventListener("beforeprint", function () {
    [].forEach.call(document.querySelectorAll('.main-content img[loading="lazy"], .bpmn-figure img[loading="lazy"]'), function (img) {
      img.loading = "eager";
    });
    inlineAll();
  });

  var remountPending = null;
  function remountSoon() {
    if (remountPending !== null) return;
    remountPending = window.setTimeout(function () { remountPending = null; mountFigures(); }, 30);
  }

  /** Inline one drawing, once; the same promise however often it is asked. */
  function inlineOne(img) {
    if (img.faInlined) return img.faInlined;
    if (!img.hasAttribute("data-fa-inline-pending")) return Promise.resolve();
    function settle() {
      img.removeAttribute("data-fa-inline-pending");
      remountSoon();
    }
    img.faInlined = (function () {
      var isObject = img.tagName.toLowerCase() === "object";
      var src = img.getAttribute(isObject ? "data" : "src");
      return window
        .fetch(src)
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.text();
        })
        .then(function (text) {
          var parsed = new window.DOMParser().parseFromString(text, "image/svg+xml");
          var svg = parsed.documentElement;
          if (!svg || String(svg.nodeName).toLowerCase() !== "svg") throw new Error("not an svg");
          // The alt text was the accessible name; keep it on the element that
          // replaces it, or the diagram becomes invisible to a screen reader.
          var alt = isObject
            ? img.getAttribute("aria-label") || img.getAttribute("title") || (img.textContent || "").trim()
            : img.getAttribute("alt");
          if (alt) {
            svg.setAttribute("role", "img");
            svg.setAttribute("aria-label", alt);
          }
          // The source file, kept for the export controls: "Download SVG"
          // names the file after it, and it is the committed artefact.
          svg.setAttribute("data-fa-src", src);
          // Links inside a drawing are written relative to the SVG FILE, so
          // one file works wherever it is embedded. Inlined, a relative href
          // would resolve against the PAGE instead — right from the docs
          // root, wrong from `processes/` (bean `xl55`) — so each is
          // re-anchored to the file's own URL, through the same check as
          // every other link here.
          var fileUrl = new URL(src, location.href);
          [].forEach.call(svg.querySelectorAll("a[href]"), function (a) {
            var checked = safeHref(a.getAttribute("href"));
            if (checked === undefined) a.removeAttribute("href");
            else a.setAttribute("href", new URL(checked, fileUrl).href);
          });
          var host = img.parentNode;
          host.replaceChild(scopeSvg(document.importNode(svg, true)), img);
          var mounted = host.closest && host.closest(".fa-figure-scope.fa-plain");
          if (mounted) fitBpmn(mounted);
        })
        .catch(function (e) {
          console.warn("docs-ui: could not inline " + src + " (" + e.message + "); it stays a static image, so its links will not work.");
        })
        .then(settle, settle);
    })();
    return img.faInlined;
  }

  /* ── The navbar filters by the selected locale ───────────────────────── */

  /*
   * THE BUG THIS EXISTS FOR, in the owner's words (2026-09-19):
   *
   *   "i have english selected, but i see the translated pages in LHS navbar."
   *
   * Two halves, and only the second is here.
   *
   * The first half is `nav_exclude: true` on every translated page. The nav is
   * built by just-the-docs AT BUILD TIME, from front matter, on a static site
   * that is serving the same HTML to every reader. It cannot know which locale
   * anybody selected, so a translated page left in it is in it FOR EVERYBODY.
   * No amount of client-side work fixes that: a script can swap a nav item,
   * it cannot un-render one without a flash of the wrong nav first. So the
   * translations leave the static nav entirely, and the navbar a reader gets
   * with no JavaScript at all is the SOURCE-LANGUAGE one -- which is the
   * correct degraded answer rather than an arbitrary one.
   *
   * The second half is this function. With a non-source locale selected, each
   * nav item that HAS a page in that locale is rewritten IN PLACE -- same
   * position, same parent, translated title, translated href. "In place of",
   * not "in addition to", is the requirement, and rewriting rather than
   * inserting is what makes it structurally true rather than something the
   * ordering has to be trusted to preserve.
   *
   * FALLBACK IS THE ABSENCE OF A REWRITE. An item with no page in the selected
   * locale is not touched, so it keeps its source-language title and link.
   * There is deliberately no code path for it: a fallback implemented as its
   * own branch is a branch that can be wrong, and this one cannot be.
   *
   * ## Three states, and the third is why the index is published as `null`
   *
   *   ok        -- the index parsed; filter the nav.
   *   empty     -- it parsed and holds no pages; nothing to swap, and every
   *                item correctly stays in the source language.
   *   unknown   -- no island, or it would not parse, or `index` is `null`
   *                because the data file was absent at build time. The nav is
   *                left EXACTLY as built and nothing is claimed.
   *
   * `empty` and `unknown` produce the same navbar and are not the same answer:
   * one is "this folio has no translations", the other is "this build could not
   * tell". They are recorded separately in `data-fa-nav-index` so that a
   * reader, a test, or the next person debugging this can distinguish them --
   * the same rule the README sections and the CI-health report follow.
   */

  /**
   * The key a nav `href` and an indexed page are matched on.
   *
   * MUST stay in step with `pageKey` in content/pipeline/translation-index.ts
   * — the two are one convention implemented twice, once in the generator and
   * once in the consumer, because they run in different languages on different
   * machines. Jekyll serves one page at several spellings (`/`, `/x.html`,
   * `/x/`) under a `baseurl` this script is told rather than guesses, so both
   * sides normalise to a bare extensionless path with no `index` and no
   * slashes at either end.
   */
  function navKey(href, baseurl) {
    if (!href) return null;
    var path;
    try {
      // Resolves relative hrefs against the current page, and rejects
      // `mailto:`/`#`/external links by their origin below.
      var u = new URL(href, window.location.href);
      if (u.origin !== window.location.origin) return null;
      path = u.pathname;
    } catch (_e) {
      return null;
    }
    if (baseurl && path.indexOf(baseurl) === 0) path = path.slice(baseurl.length);
    path = path.replace(/^\/+/, "").replace(/\/+$/, "");
    path = path.replace(/\.html?$/i, "");
    path = path.replace(/(^|\/)index$/i, "");
    return path.replace(/^\/+|\/+$/g, "");
  }

  /**
   * The published index, or null when this build could not determine one.
   *
   * ISLAND FIRST, then the site index, where the same two fields are
   * `baseurl` and `translations`. The island was 9.3 KB in every page's
   * `<head>` and the SAME 9.3 KB in all 1571 of them — 14.26 MB of one
   * answer, the largest duplicated payload in a published preview.
   *
   * `null` keeps meaning exactly what it meant: this build could not
   * determine an index. It covers `translations: null` (the data file was not
   * there when the site was built) and now also a site index that could not
   * be fetched. Those are different facts and `data-fa-render` is where they
   * are told apart — here they have the same consequence, which is to leave
   * the navbar exactly as built.
   */
  function getTranslationIndex() {
    var node = document.getElementById("fa-translation-index");
    var parsed;
    if (node) {
      try { parsed = JSON.parse(node.textContent); } catch (_e) { return null; }
      if (!parsed || typeof parsed !== "object") return null;
      parsed = { baseurl: parsed.baseurl, index: parsed.index };
    } else if (SITE_INDEX) {
      parsed = { baseurl: SITE_INDEX.baseurl, index: SITE_INDEX.translations };
    } else {
      return null;
    }
    // `index: null` is the deliberate signal that `docs/_data/translations.json`
    // was not there when the site was built. It is NOT an empty index.
    if (!parsed.index || typeof parsed.index !== "object") return null;
    if (!parsed.index.pages || typeof parsed.index.pages !== "object") return null;
    return { baseurl: typeof parsed.baseurl === "string" ? parsed.baseurl : "", data: parsed.index };
  }

  /**
   * Which locale the navbar should be in.
   *
   * In precedence order, and each step answers a question the next cannot:
   *
   *   1. `?lang=` on the URL -- an explicit, shareable request for one page
   *      view. It wins because somebody typed it.
   *   2. the page's own `lang`, when the page IS a translation. A reader
   *      looking at the French page is reading French, whatever a stale
   *      localStorage entry from another device says; a navbar in English
   *      around French prose is the mismatch this whole change is about.
   *   3. the remembered choice (`fa-locale`), which the sidebar language bar
   *      has been writing since it was built.
   *   4. the source language.
   *
   * A locale the index has never heard of is NOT honoured -- it would rewrite
   * nothing and merely label the nav with a language it is not in.
   */
  function navLocale(data, pageLang) {
    var sourceLocale = data.sourceLocale || "en";
    var known = (data.locales || []).concat([sourceLocale]);
    var wanted = null;
    try {
      var q = new URL(window.location.href).searchParams.get("lang");
      if (q) wanted = q;
    } catch (_e) { /* a URL we cannot parse simply does not ask for a locale */ }
    if (!wanted && pageLang && pageLang !== sourceLocale) wanted = pageLang;
    if (!wanted) wanted = getGlobalLocale();
    if (!wanted || known.indexOf(wanted) === -1) return sourceLocale;
    return wanted;
  }

  function mountNavLocale() {
    var nav = document.querySelector(".site-nav") || document.querySelector(".nav-list");
    if (!nav) return;

    var idx = getTranslationIndex();
    if (!idx) {
      // Degrade LOUDLY, the discipline this whole file follows: a feature that
      // quietly does nothing is indistinguishable from one nobody looked at.
      nav.setAttribute("data-fa-nav-index", "unknown");
      if (window.console && console.warn) {
        console.warn(
          "docs-ui: no readable translation index (#fa-translation-index, or " +
          "assets/harness/site.json). " +
          "The navbar is left exactly as built -- this is NOT a claim that " +
          "the folio has no translations. Run: bun run cat translation:index"
        );
      }
      return;
    }

    var data = idx.data;
    var pages = data.pages;
    var meta = getTranslationMeta();
    var locale = navLocale(data, meta && meta.lang);
    nav.setAttribute("data-fa-nav-index", Object.keys(pages).length === 0 ? "empty" : "ok");
    nav.setAttribute("data-fa-nav-locale", locale);

    // The source language needs no rewriting at all, and saying so explicitly
    // is cheaper than walking the nav to discover it.
    if (locale === (data.sourceLocale || "en")) return;

    var here = navKey(window.location.href, idx.baseurl);
    var links = nav.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var key = navKey(link.getAttribute("href"), idx.baseurl);
      if (key === null) continue;
      var entry = Object.prototype.hasOwnProperty.call(pages, key) ? pages[key] : null;
      var t = entry && entry.translations ? entry.translations[locale] : null;
      if (!t || !t.url) {
        // FALLBACK. Not a branch that does something -- a branch that does
        // nothing, on purpose, so the item keeps the source-language page it
        // already points at.
        link.setAttribute("data-fa-translated", "source");
        // MARKED, on the owner's call (2026-09-27): a source-language item in
        // a translated navbar says so, e.g. "CRDM methodology (EN)", so the
        // mix reads as a fallback rather than a mistake. `lang` makes a screen
        // reader pronounce the title as the language it is written in.
        var src = data.sourceLocale || "en";
        link.setAttribute("lang", src);
        link.setAttribute("data-fa-source-locale", src.toUpperCase());
        continue;
      }
      link.setAttribute("href", (idx.baseurl || "") + t.url);
      if (t.title) link.textContent = t.title;
      link.setAttribute("lang", locale);
      // Per-LINK direction, not per-page: an Arabic item inside an otherwise
      // English navbar has to carry its own, or the bracket and the trailing
      // "(AR)" render on the wrong side of it.
      link.setAttribute("dir", t.dir === "rtl" ? "rtl" : "ltr");
      link.setAttribute("data-fa-translated", locale);
      if (t.status) link.setAttribute("data-fa-translation-status", t.status);
      // just-the-docs computed "you are here" at build time against the SOURCE
      // page's url, so a reader on the translated page loses the marker unless
      // it is put back against the rewritten target.
      if (here !== null && navKey(t.url, "") === here) link.setAttribute("aria-current", "page");
    }
  }

  /* ── Translation badges ──────────────────────────────────────────────── */

  // Auto-injects language coverage badges and QA indicators on every page.
  // Reads from the fa-translation-meta JSON block in <head>, which is
  // stamped by the translation pipeline into page front matter and published
  // by head_custom.html. Nothing needs manual editing — the pipeline writes
  // the data, Jekyll publishes it, and this renders it.

  function getTranslationMeta() {
    var node = document.getElementById("fa-translation-meta");
    if (!node) return null;
    try { return JSON.parse(node.textContent); } catch (_e) { return null; }
  }

  /* ── Translation drawer — bean `cat-tools-bbnd` ──────────────────────
   *
   * Owner, 2026-10-10: *"i want to see in the translations warning somewhere
   * the ability to open panel w/ more translation info … on content blocks,
   * on a harnessed (sub)graph, etc."* Rulings: an inline drawer reusing the
   * QA panel (`fa-qa-panel`, `qaToggle`'s open/close contract); rendered by
   * JavaScript from data the page already points at, so the HTML stays slim;
   * officiality read from BOTH the PO headers and `status.json`, and a
   * disagreement shown as one (2026-10-11: one drawer per harness instance).
   *
   * Two scopes in one panel: THIS PAGE (from `fa-translation-meta`, already
   * inline) and THIS SITE (the instance's `folio-translation-status/v1`
   * projection, fetched on open). The projection's officiality is computed by
   * `check-translation-officiality.ts`'s own reader, so the drawer and the
   * gate cannot answer differently.
   */
  var TR_STATUS = {};
  var TR_SEQ = 0;

  /* The unreviewed-translation notice, in the six UN languages. The same
     words as fhir-harness `UNREVIEWED_NOTICE` (scripts/ig-page-translations.ts).
     These sentences are themselves not reviewed by native speakers, which is
     why English is always shown beside them. */
  var UNREVIEWED_NOTICE = {
    en: { title: "Machine translation \u2014 not reviewed by a person",
          body: "This page was translated automatically. No person has reviewed or adjudicated this translation, and it may contain errors. The source-language page is the authoritative text.",
          link: "Read the original (English)" },
    fr: { title: "Traduction automatique \u2014 non relue par une personne",
          body: "Cette page a \u00E9t\u00E9 traduite automatiquement. Aucune personne n\u2019a relu ni valid\u00E9 cette traduction, qui peut contenir des erreurs. Seule la page dans la langue source fait foi.",
          link: "Lire l\u2019original (anglais)" },
    es: { title: "Traducci\u00F3n autom\u00E1tica \u2014 no revisada por una persona",
          body: "Esta p\u00E1gina se tradujo autom\u00E1ticamente. Ninguna persona ha revisado ni validado esta traducci\u00F3n, que puede contener errores. Solo la p\u00E1gina en el idioma original es la de referencia.",
          link: "Leer el original (ingl\u00E9s)" },
    ru: { title: "\u041C\u0430\u0448\u0438\u043D\u043D\u044B\u0439 \u043F\u0435\u0440\u0435\u0432\u043E\u0434 \u2014 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u043E\u043C",
          body: "\u042D\u0442\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u043F\u0435\u0440\u0435\u0432\u0435\u0434\u0435\u043D\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438. \u041D\u0438 \u043E\u0434\u0438\u043D \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u043B \u0438 \u043D\u0435 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u043B \u044D\u0442\u043E\u0442 \u043F\u0435\u0440\u0435\u0432\u043E\u0434, \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u043E\u043D \u043C\u043E\u0436\u0435\u0442 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u043E\u0448\u0438\u0431\u043A\u0438. \u0410\u0432\u0442\u043E\u0440\u0438\u0442\u0435\u0442\u043D\u043E\u0439 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u043D\u0430 \u044F\u0437\u044B\u043A\u0435 \u043E\u0440\u0438\u0433\u0438\u043D\u0430\u043B\u0430.",
          link: "\u0427\u0438\u0442\u0430\u0442\u044C \u043E\u0440\u0438\u0433\u0438\u043D\u0430\u043B (\u0430\u043D\u0433\u043B\u0438\u0439\u0441\u043A\u0438\u0439)" },
    zh: { title: "\u673A\u5668\u7FFB\u8BD1\u2014\u2014\u672A\u7ECF\u4EBA\u5DE5\u5BA1\u6821", body: "\u672C\u9875\u9762\u4E3A\u81EA\u52A8\u7FFB\u8BD1\u3002\u5C1A\u65E0\u4EFB\u4F55\u4EBA\u5BA1\u6821\u6216\u88C1\u5B9A\u6B64\u8BD1\u6587\uFF0C\u53EF\u80FD\u5B58\u5728\u9519\u8BEF\u3002\u4EE5\u6E90\u8BED\u8A00\u9875\u9762\u4E3A\u51C6\u3002", link: "\u9605\u8BFB\u539F\u6587\uFF08\u82F1\u6587\uFF09" },
    ar: { title: "\u062A\u0631\u062C\u0645\u0629 \u0622\u0644\u064A\u0629 \u2014 \u0644\u0645 \u064A\u0631\u0627\u062C\u0639\u0647\u0627 \u0623\u064A \u0634\u062E\u0635", body: "\u062A\u064F\u0631\u062C\u0645\u062A \u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062D\u0629 \u0622\u0644\u064A\u064B\u0627. \u0644\u0645 \u064A\u0631\u0627\u062C\u0639 \u0623\u064A \u0634\u062E\u0635 \u0647\u0630\u0647 \u0627\u0644\u062A\u0631\u062C\u0645\u0629 \u0623\u0648 \u064A\u0639\u062A\u0645\u062F\u0647\u0627\u060C \u0648\u0642\u062F \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0623\u062E\u0637\u0627\u0621. \u0627\u0644\u0635\u0641\u062D\u0629 \u0628\u0644\u063A\u0629 \u0627\u0644\u0645\u0635\u062F\u0631 \u0647\u064A \u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u0631\u062C\u0639\u064A.", link: "\u0627\u0642\u0631\u0623 \u0627\u0644\u0646\u0635 \u0627\u0644\u0623\u0635\u0644\u064A (\u0628\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629)" }
  };
  var RTL_LOCALES = ["ar", "he", "fa", "ur"];

  var TR_PAGE_STATE = {
    unverified: "translated automatically; not reviewed by a subject-matter expert",
    verified: "reviewed and signed off",
    stale: "the source changed after this translation was made",
    missing: "not translated"
  };

  /** One line on who signed a locale off — the same words as the status page. */
  function trOfficialityLabel(o) {
    if (!o) return "not recorded";
    if (o.state === "official") return "official, signed off by " + (o.signedOffBy || "?") + " on " + (o.signedOffAt || "?");
    if (o.state === "disagree") return "records disagree (" + o.findings + "); run check:translation-officiality";
    if (o.state === "unreadable") return "status.json unreadable: could not determine";
    return "not signed off (machine or agent translation)";
  }

  function trPct(n, d) {
    return d > 0 ? Math.round((100 * n) / d) + "%" : "–";
  }

  /** The THIS-SITE half, from the fetched projection (or why it is absent). */
  function trSiteSection(status, src, err) {
    var sec = el("section", { class: "fa-tr-drawer__site" });
    sec.appendChild(el("h3", null, "This site’s translations"));
    if (err) {
      // 404 is a real state, "this site publishes no translation status";
      // anything else is "could not determine", and the two are kept apart.
      sec.appendChild(el("p", { class: "fa-qa-absent" }, err === "HTTP 404"
        ? "This site publishes no translation status."
        : "Could not load the translation status (" + err + ")."));
      sec.appendChild(el("code", null, src));
      return sec;
    }
    var locales = (status && status.locales) || [];
    if (!locales.length) {
      sec.appendChild(el("p", { class: "fa-qa-absent" }, "No locale is translated on this site."));
      return sec;
    }
    var table = el("table", { class: "fa-tr-drawer__table" });
    var head = el("tr");
    ["locale", "strings translated", "fuzzy", "signed off"].forEach(function (h) {
      head.appendChild(el("th", { scope: "col" }, h));
    });
    var thead = el("thead"); thead.appendChild(head); table.appendChild(thead);
    var tbody = el("tbody");
    locales.forEach(function (l) {
      var tr = el("tr", { "data-fa-tr-locale": l.locale });
      tr.appendChild(el("th", { scope: "row" }, l.locale));
      tr.appendChild(el("td", null, l.translated + " / " + l.entries + " (" + trPct(l.translated, l.entries) + ")"));
      tr.appendChild(el("td", null, String(l.fuzzy)));
      tr.appendChild(el("td", { "data-fa-tr-officiality": (l.officiality && l.officiality.state) || "absent" },
        trOfficialityLabel(l.officiality)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    sec.appendChild(table);
    if (status.page) {
      var root = src.replace(/assets\/translation-status\/index\.json$/, "");
      var more = el("p", { class: "fa-tr-drawer__more" });
      more.appendChild(el("a", { href: safeHref(root + status.page) }, "Full translation status \u2192"));
      sec.appendChild(more);
    }
    return sec;
  }

  /** The THIS-PAGE half, from the inline meta. */
  function trPageSection(meta, available, supported) {
    var sec = el("section", { class: "fa-tr-drawer__page" });
    sec.appendChild(el("h3", null, "This page"));
    var dl = el("dl", { class: "fa-tr-drawer__facts" });
    function fact(k, v) { dl.appendChild(el("dt", null, k)); dl.appendChild(el("dd", null, v)); }
    fact("Language", meta.lang || "en");
    if (meta.translationSource) fact("Translation of", meta.translationSource);
    if (meta.translationStatus) {
      fact("State", meta.translationStatus + (TR_PAGE_STATE[meta.translationStatus] ? " — " + TR_PAGE_STATE[meta.translationStatus] : ""));
    }
    var missing = supported.filter(function (l) { return available.indexOf(l) < 0; });
    fact("Available in", available.length ? available.join(", ") : "its source language only");
    if (missing.length) fact("Not yet in", missing.join(", "));
    sec.appendChild(dl);
    return sec;
  }

  function trBuildDrawer(meta, available, supported, panelId, toggle, status, err) {
    var panel = chromeText(el("div", {
      class: "fa-qa-panel fa-tr-drawer",
      id: panelId,
      role: "region",
      "aria-label": "Translation details",
      tabindex: "-1"
    }));
    var head = el("div", { class: "fa-qa-panel-head" });
    head.appendChild(el("strong", null, "Translations"));
    var close = el("button", { type: "button", class: "fa-qa-close", title: "Close this panel" }, "✕ Close");
    close.addEventListener("click", function () { trToggle(toggle, meta, available, supported); });
    head.appendChild(close);
    panel.appendChild(head);
    panel.appendChild(trPageSection(meta, available, supported));
    panel.appendChild(trSiteSection(status, meta.statusSrc || "", err));
    return panel;
  }

  /** The instance's status projection, fetched once per page: `cb(doc, err)`. */
  function trStatusFetch(src, cb) {
    if (!src) { cb(null, "no status path on this page"); return; }
    if (TR_STATUS[src]) { cb(TR_STATUS[src].doc || null, TR_STATUS[src].err || null); return; }
    fetch(src, { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (doc) { TR_STATUS[src] = { doc: doc }; cb(doc, null); })
      .catch(function (e) { TR_STATUS[src] = { err: e.message }; cb(null, e.message); });
  }

  /**
   * THE BLOCK SCOPE (bean `cat-tools-bbnd`): what a `TR` panel adds, per
   * locale its verdicts cover. Whether the verdict is STALE (a witness whose
   * `freshness` is not `fresh` judged a source that has since moved), and the
   * locale's signed-off state from the same projection the page drawer reads.
   * Plus the control that opens the page drawer, so a block reaches the rest.
   */
  function trBlockSection(doc) {
    var byLocale = {};
    (doc.criteria || []).forEach(function (c) {
      if (!c.locale) return;
      var e = byLocale[c.locale] || (byLocale[c.locale] = { stale: 0, witnesses: 0 });
      (c.witnesses || []).forEach(function (w) {
        e.witnesses += 1;
        if (w.freshness && w.freshness !== "fresh") e.stale += 1;
      });
    });
    var locales = Object.keys(byLocale).sort();
    var sec = el("section", { class: "fa-tr-drawer__block" });
    sec.appendChild(el("h3", null, "Translation of this block"));
    if (!locales.length) {
      sec.appendChild(el("p", { class: "fa-qa-absent" }, "No verdict here names a locale."));
      return sec;
    }
    var dl = el("dl", { class: "fa-tr-drawer__facts" });
    var cells = {};
    locales.forEach(function (l) {
      var e = byLocale[l];
      dl.appendChild(el("dt", null, l));
      var dd = el("dd", { "data-fa-tr-locale": l });
      dd.appendChild(el("span", { class: "fa-tr-drawer__fresh", "data-fa-tr-fresh": e.stale ? "stale" : "fresh" },
        e.stale
          ? "stale: the source changed after " + e.stale + " of " + e.witnesses + " verdict(s) were reached"
          : "current: every verdict was reached on the source as it is now"));
      var off = el("span", { class: "fa-tr-drawer__official" }, " \u00B7 signed off: \u2026");
      dd.appendChild(off);
      cells[l] = off;
      dl.appendChild(dd);
    });
    sec.appendChild(dl);
    var meta = getTranslationMeta() || {};
    trStatusFetch(meta.statusSrc, function (status, err) {
      var byL = {};
      ((status && status.locales) || []).forEach(function (x) { byL[x.locale] = x; });
      locales.forEach(function (l) {
        var x = byL[l];
        cells[l].textContent = " \u00B7 signed off: " +
          (err ? (err === "HTTP 404" ? "not published for this site" : "could not determine (" + err + ")")
               : x ? trOfficialityLabel(x.officiality) : "this site has no catalogue for " + l);
        if (x && x.officiality) cells[l].setAttribute("data-fa-tr-officiality", x.officiality.state);
      });
    });
    var open = el("button", { type: "button", class: "fa-translation-warning__details" }, "Open translation details");
    open.addEventListener("click", function () {
      var t = document.querySelector(".fa-tr-drawer-toggle");
      if (t && t.getAttribute("aria-expanded") !== "true") t.click();
      else if (t) { var d = document.getElementById(t.getAttribute("aria-controls")); if (d) d.focus(); }
    });
    sec.appendChild(open);
    return sec;
  }

  /** Open or close the drawer: `qaToggle`'s contract, so one behaviour for both. */
  function trToggle(toggle, meta, available, supported) {
    var panelId = toggle.getAttribute("aria-controls");
    var open = panelId && document.getElementById(panelId);
    if (open) {
      open.parentNode.removeChild(open);
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
      return;
    }
    if (!panelId) {
      panelId = "fa-tr-drawer-" + (++TR_SEQ);
      toggle.setAttribute("aria-controls", panelId);
    }
    toggle.setAttribute("aria-expanded", "true");
    var anchor = toggle.closest(".fa-translation-badges") || toggle;
    function mount(node) {
      toggle.removeAttribute("aria-busy");
      if (anchor.nextSibling) anchor.parentNode.insertBefore(node, anchor.nextSibling);
      else anchor.parentNode.appendChild(node);
      node.focus();
    }
    toggle.setAttribute("aria-busy", "true");
    trStatusFetch(meta.statusSrc, function (doc, err) {
      mount(trBuildDrawer(meta, available, supported, panelId, toggle, doc, err));
    });
  }

  /**
   * THE STATUS PAGE'S PER-ROW DRAWER (bean `cat-tools-bbnd`): each locale row
   * the translation-status visualiser draws (`tr[data-fa-tr-locale]`) gets a
   * control that opens, under it, the catalogues behind the row's numbers,
   * each with its own counts and `X-Folio-Official` header. Read from the same
   * projection as every other scope, so the row and its drawer cannot differ.
   */
  function mountTranslationStatusRows() {
    var rows = document.querySelectorAll(".ts-page tr[data-fa-tr-locale]");
    if (!rows.length) return;
    var meta = getTranslationMeta() || {};
    rows.forEach(function (row) {
      var locale = row.getAttribute("data-fa-tr-locale");
      var cell = row.querySelector("th");
      if (!cell || row.querySelector(".fa-tr-row-toggle")) return;
      var btn = chromeText(el("button", {
        type: "button", class: "fa-tr-drawer-toggle fa-tr-row-toggle", "aria-expanded": "false",
        title: "Catalogues behind the " + locale + " numbers"
      }, "ⓘ Details"));
      cell.appendChild(document.createTextNode(" "));
      cell.appendChild(btn);
      btn.addEventListener("click", function () {
        var next = row.nextElementSibling;
        if (next && next.classList.contains("fa-tr-row-drawer")) {
          next.parentNode.removeChild(next);
          btn.setAttribute("aria-expanded", "false");
          btn.focus();
          return;
        }
        btn.setAttribute("aria-expanded", "true");
        trStatusFetch(meta.statusSrc, function (status, err) {
          var tr = el("tr", { class: "fa-tr-row-drawer" });
          var td = el("td", { colspan: String(row.children.length) });
          var panel = chromeText(el("div", { class: "fa-qa-panel fa-tr-drawer", role: "region", "aria-label": "Catalogues for " + locale, tabindex: "-1" }));
          var loc = null;
          ((status && status.locales) || []).forEach(function (x) { if (x.locale === locale) loc = x; });
          if (err || !loc) {
            panel.appendChild(el("p", { class: "fa-qa-absent" }, err ? "Could not load the catalogue detail (" + err + ")." : "The status projection has no row for " + locale + "."));
          } else if (!loc.files) {
            panel.appendChild(el("p", { class: "fa-qa-absent" }, "This projection predates per-catalogue detail; regenerate it with translation:status."));
          } else {
            panel.appendChild(el("p", null, trOfficialityLabel(loc.officiality)));
            var t = el("table", { class: "fa-tr-drawer__table" });
            var h = el("tr");
            ["catalogue", "translated", "fuzzy", "X-Folio-Official"].forEach(function (x) { h.appendChild(el("th", { scope: "col" }, x)); });
            var th = el("thead"); th.appendChild(h); t.appendChild(th);
            var tb = el("tbody");
            loc.files.forEach(function (f) {
              var r = el("tr");
              r.appendChild(el("th", { scope: "row" }, f.path));
              r.appendChild(el("td", null, f.translated + " / " + f.entries + " (" + trPct(f.translated, f.entries) + ")"));
              r.appendChild(el("td", null, String(f.fuzzy)));
              r.appendChild(el("td", null, f.official || "(absent)"));
              tb.appendChild(r);
            });
            t.appendChild(tb);
            panel.appendChild(t);
            if (loc.unreadable && loc.unreadable.length) {
              panel.appendChild(el("p", { class: "fa-qa-absent" }, "Unreadable, so not counted: " + loc.unreadable.join(", ")));
            }
          }
          td.appendChild(panel);
          tr.appendChild(td);
          row.parentNode.insertBefore(tr, row.nextSibling);
          panel.focus();
        });
      });
    });
  }

  function mountTranslationBadges() {
    var meta = getTranslationMeta();
    if (!meta) return;

    var supported = meta.supportedLocales || UN_LOCALES;
    var available = localesAvailable(meta, supported);
    var totalLangs = supported.length;
    var availLangs = available.length;

    // Auto-detect available locales from the page's own language links if
    // the pipeline hasn't stamped availableLocales yet. Scans whatever carries
    // `data-locale`, which is what `buildLanguageBar` above emits — it used to
    // read a `_includes/language-selector.html`, deleted once this file did the
    // same job better (it greys out untranslated locales, which that include
    // only promised in a comment).
    //
    // The trigger is `<= 1`, not `=== 0`: a page whose only available locale is
    // its own source language has nothing stamped either, and under the old
    // `=== 0` test that case stopped reaching this fallback the moment the
    // source language joined the count. It also no longer drops `meta.lang`
    // from what it finds — the page's own language is one of the answers, which
    // is the whole correction here.
    if (availLangs <= 1) {
      var langLinks = document.querySelectorAll(".fa-lang-tab, [data-locale]");
      var found = {};
      if (meta.lang) found[meta.lang] = true;
      langLinks.forEach(function (link) {
        var loc = link.getAttribute("data-locale") || link.textContent.trim().toLowerCase();
        if (loc) found[loc] = true;
      });
      var detected = supported.filter(function (loc) { return found[loc] === true; });
      if (detected.length > availLangs) {
        availLangs = detected.length;
        available = detected;
      }
    }

    // Find the page title (first h1 in main content)
    var title = document.querySelector(".main-content h1, #main-content h1");
    if (!title) return;

    // Create badge container — block-level row below the title
    // No `style` here, and none on either badge below. Every colour this row
    // used to carry inline is a per-scheme token in `docs-ui.css` now, with its
    // measured ratio written beside it -- bean `n7vv`. The container is also
    // where those tokens are DECLARED, so a badge outside this row would resolve
    // none of them, which is the intended failure rather than a silent default.
    var container = el("span", { class: "fa-translation-badges" });

    // Language coverage badge — always shown.
    //
    // Green means EVERY supported language, not "all but one": the old test was
    // `availLangs >= totalLangs - 1`, the same off-by-one the fraction carried,
    // and it painted a page missing a whole language as complete. Amber is now
    // the source language plus at least one translation; grey is the source
    // language alone, which is the honest resting state of an untranslated page
    // and is no longer indistinguishable from "no languages at all".
    var langState = availLangs >= totalLangs
      ? "is-ok"
      : availLangs > 1 ? "is-partial" : "is-idle";

    var langBadge = el("span", {
      class: "fa-translation-badge fa-lang-coverage-badge " + langState,
      // Three wordings, because the fraction alone does not say which case it
      // is. The "of <every supported locale>" tail is what makes a partial
      // count actionable -- it names the languages still missing -- and is
      // dropped when the two lists are equal, where it read "available in:
      // ar, zh, en, fr, ru, es -- of ar, zh, en, fr, ru, es".
      title: availLangs >= totalLangs
        ? "Available in every supported language: " + available.join(", ")
        : availLangs > 1
          ? "Available in: " + available.join(", ") + " \u2014 of " + supported.join(", ")
          : "Available in " + (available[0] || meta.lang || "its source language") +
            " only; not yet translated"
    }, "\uD83C\uDF10 " + availLangs + "/" + totalLangs + " languages");
    // English text and an English tooltip: `lang`/`dir` on the badge, never on
    // the row, so the row's ORDER still follows the page (bean `giiw`).
    chromeText(langBadge);
    container.appendChild(langBadge);

    // The round-trip QA badge that stood here is gone, and the data behind it
    // with it. It read `page.qa_translation_*`, stamped from a node-level
    // `roundTripQA` whose back-translation map held 6 entries against 36
    // strings: every string nobody back-translated scored 0 similarity and was
    // published as semantic drift. Per-block translation QA replaces it —
    // `<stem>.<locale>.translation-qa.json`, opened from the `TR` icon beside
    // each block, where a verdict names the witness that reached it.

    // QA sweep completeness badge — indicates whether sidecars have been run
    var sweep = meta.sweep || {};
    var sweepState, sweepIcon, sweepLabel, sweepTitle;
    if (!sweep.run && typeof sweep.absent === "string" && sweep.absent) {
      // A FOLIO's site that publishes no sweep of its own (#2263 follow-up).
      // Not "not run" -- nobody said the folio's sweep was never run -- and
      // never the platform's ratio: the badge stays, inert, and says why.
      sweepState = "is-idle"; sweepIcon = "–";
      sweepLabel = "QA: not published";
      sweepTitle = "Translation QA: " + sweep.absent + ".";
    } else if (!sweep.run) {
      sweepState = "is-idle"; sweepIcon = "\u2B58";
      sweepLabel = "QA: not run";
      sweepTitle = "Translation QA sweep has not been run. " +
                   "Run: bun run content/pipeline/translation-qa-sweep.ts";
    } else if (sweep.complete && sweep.pagesWithTranslations > 0) {
      var ratio = sweep.pagesWithTranslations + "/" + sweep.totalPages;
      sweepState = "is-ok"; sweepIcon = "\u2705";
      sweepLabel = "Swept " + ratio;
      sweepTitle = "QA sweep complete. " + sweep.pagesWithTranslations + " of " +
                   sweep.totalPages + " pages have translations. Last run: " + sweep.sweptAt;
    } else {
      sweepState = "is-partial"; sweepIcon = "\u26A0\uFE0F";
      sweepLabel = "Swept 0/" + sweep.totalPages;
      sweepTitle = "QA sweep complete but no pages have translations yet. " +
                   "Last run: " + sweep.sweptAt;
    }

    var sweepBadge = el("span", {
      class: "fa-translation-badge fa-sweep-badge " + sweepState,
      title: sweepTitle
    }, sweepIcon + " " + sweepLabel);
    chromeText(sweepBadge);
    container.appendChild(sweepBadge);

    // The drawer's control (bean `cat-tools-bbnd`). A separate BUTTON, not the
    // coverage badge made clickable: the badges stay inert spans (`cursor:
    // default`, see docs-ui.css), and a control should look like one.
    var trToggleBtn = chromeText(el("button", {
      type: "button",
      class: "fa-tr-drawer-toggle",
      "aria-expanded": "false",
      title: "Translation details for this page and this site"
    }, "\u24D8 Translation details"));
    trToggleBtn.addEventListener("click", function () { trToggle(trToggleBtn, meta, available, supported); });
    container.appendChild(trToggleBtn);

    /* Unverified translation notice — ONE LINE, opening to the detail.
     *
     * Owner, 2026-09-21, on a translated page: *"should be a slim one line
     * '⚠️ Unverified translation — This page has been translated
     * automatically and has not been reviewed by a subject-matter expert.'
     * which then can open to the full trnslation QA report."*
     *
     * It was four lines of banner above the page title — the warning, the
     * source, and two tool names a reader cannot run from a browser. On a
     * translated page that is the first thing between the reader and the
     * content they came for, every page, permanently.
     *
     * ## `role="alert"` is gone, and that is not a downgrade
     *
     * An alert demands immediate announcement and is for something that has
     * just happened. This is a standing property of the page, true before
     * the reader arrived and still true when they leave. As a `<summary>`
     * it is in the tab order, states its own expanded/collapsed state, and
     * can be returned to — which an alert that fires once cannot.
     *
     * ## "The full report" is the EXISTING panel, not a second one
     *
     * The page already carries a Translation QA badge that opens a panel
     * over the real sidecar. Restating its contents here would be a second
     * answer to one question, free to disagree — the defect this file warns
     * about in several other places. So the drawer holds the two facts that
     * are NOT in that panel (which file this translates, and how to sign it
     * off) and a control that opens the panel itself.
     *
     * The badge is looked up AT CLICK TIME, not here: it is built further
     * down this same function, so it does not exist yet. When there is no
     * badge — a page with no projection — the control is not drawn at all
     * rather than drawn dead (`pb04`).
     */
    /* PROMINENT, and FAIL CLOSED (owner, 2026-11-13: "need VERY prominent
     * disclaimer when any translated text on page has not been human
     * translated/adjudicated"). This supersedes the 2026-09-21 one-line
     * notice: the line was easy to miss, and it appeared only for the one
     * status "unverified", so a translated page with no status, or a stale
     * one, said nothing.
     *
     * A page counts as a translation when it names its source or carries a
     * status; it counts as reviewed ONLY when its status is "verified". No
     * status, "unverified" and "stale" all get the notice. "missing" (no
     * translated words on the page) does not.
     *
     * The notice is in the page's language when there are words for it, then
     * in English, and links to the source-language page. The detail that the
     * one-line notice opened to is kept, behind a "Translation details"
     * disclosure under it. The IG layouts in fhir-harness render the same
     * notice server-side with the same words; a page that already carries one
     * (`.fa-translation-warning`) is left alone. */
    var trState = meta.translationStatus || "";
    var trIsTranslation = !!meta.translationSource || trState === "unverified" || trState === "stale";
    if (trIsTranslation && trState !== "verified" && trState !== "missing" && !document.querySelector(".fa-translation-warning")) {
      var trPageLang = meta.lang || "en";
      var warning = el("div", {
        class: "fa-translation-warning fa-translation-warning--prominent",
        role: "note",
        "aria-label": UNREVIEWED_NOTICE.en.title
      });
      var srcHref = safeHref(deriveBasePath(window.location.pathname, trPageLang));
      var noticeBlock = function (loc) {
        var n = UNREVIEWED_NOTICE[loc];
        var block = el("div", { class: "fa-translation-warning__lang" });
        block.setAttribute("lang", loc);
        block.setAttribute("dir", RTL_LOCALES.indexOf(loc) !== -1 ? "rtl" : "ltr");
        var title = el("p", { class: "fa-translation-warning__title" });
        title.appendChild(document.createTextNode("\u26A0\uFE0F "));
        title.appendChild(el("strong", null, n.title));
        block.appendChild(title);
        var body = el("p", { class: "fa-translation-warning__text" });
        body.appendChild(document.createTextNode(n.body + " "));
        if (srcHref) body.appendChild(el("a", { class: "fa-translation-warning__source", href: srcHref }, n.link));
        block.appendChild(body);
        return block;
      };
      if (trPageLang !== "en" && UNREVIEWED_NOTICE[trPageLang]) warning.appendChild(noticeBlock(trPageLang));
      warning.appendChild(noticeBlock("en"));
      var warnMore = chromeText(el("details", { class: "fa-translation-warning__more" }));
      warnMore.appendChild(el("summary", { class: "fa-translation-warning__line" }, "Translation details"));
      warning.appendChild(warnMore);

      var warnBody = el("div", { class: "fa-translation-warning__body" });
      if (meta.translationSource) {
        var srcP = el("p");
        srcP.appendChild(el("strong", null, "Source:"));
        srcP.appendChild(document.createTextNode(" " + meta.translationSource + " (English)"));
        warnBody.appendChild(srcP);
      }
      var howP = el("p");
      howP.appendChild(el("strong", null, "How to verify:"));
      howP.appendChild(document.createTextNode(" Run "));
      howP.appendChild(el("code", null, "translation_signoff"));
      howP.appendChild(document.createTextNode(" after SME review, or use "));
      howP.appendChild(el("code", null, "translation_validate"));
      howP.appendChild(document.createTextNode(" to check for staleness and coverage."));
      warnBody.appendChild(howP);
      // THE WARNING OPENS THE DRAWER (bean `cat-tools-bbnd`, owner 2026-10-10:
      // "in the translations warning … the ability to open panel w/ more
      // translation info"). The control is looked up at click time: it is
      // built further down this function, after the badge row exists.
      var openDrawer = el("button", { type: "button", class: "fa-translation-warning__details" },
        "Open translation details");
      openDrawer.addEventListener("click", function () {
        var t = document.querySelector(".fa-tr-drawer-toggle");
        if (t && t.getAttribute("aria-expanded") !== "true") t.click();
        else if (t) { var d = document.getElementById(t.getAttribute("aria-controls")); if (d) d.focus(); }
      });
      warnBody.appendChild(openDrawer);
      warnMore.appendChild(warnBody);

      if (meta.translationQa && meta.translationQa.src) {
        // Hidden until a badge with a projection behind it exists: since bean
        // `4l4d` the page always carries the PATHS, and only the published
        // list (`translationQa.list`) says whether there is a report to open.
        // An older page without `list` keeps the old meaning — paths were
        // emitted only where a projection existed — and shows it at once.
        var openReport = el("button", {
          type: "button",
          class: "fa-translation-warning__report",
        }, "Open the translation QA report");
        if (meta.translationQa.list) openReport.hidden = true;
        openReport.addEventListener("click", function () {
          var badge = document.querySelector('.fa-qa-badge[data-qa-family="translation"]');
          // Absent is a real state and is REPORTED, not swallowed: a button
          // that silently does nothing is worse than one that is not there,
          // and this path is only reachable if the badge failed to build
          // after `translationQa.src` promised it.
          if (badge) badge.click();
          else console.warn("docs-ui: no translation QA badge to open; the page declared a " +
                            "projection at " + meta.translationQa.src + " but no badge was built.");
        });
        warnBody.appendChild(openReport);
      }

      // First in the content. An empty content column still gets it: a notice
      // that needs the column to have a first child is one that can vanish.
      var mainContent = document.querySelector(".main-content, #main-content");
      if (mainContent) mainContent.insertBefore(warning, mainContent.firstChild);
      else document.body.insertBefore(warning, document.body.firstChild);
    }

    // A HAND-AUTHORED page has no generator to write its badge into the
    // markup, so it is built here from the paths `head_custom.html` published.
    // Those paths are STRUCTURE. Whether a projection exists is the fetched
    // `translation-qa-pages.json` list's answer (bean `4l4d`; it was a Jekyll
    // `_data` file baked into every page), never what the projection found —
    // so this badge is emitted only where there is something to open, and is
    // painted from the same `qa-index.json` every other badge uses.
    //
    // Deliberately identical markup to the generated one, down to the
    // `fa-qa-pending` class and the `…` glyph: one badge, one painter, one
    // panel. A second shape here would be a second set of states to keep in
    // step with the first.
    var tq = meta.translationQa;
    var showReport = function () {
      var r = document.querySelector(".fa-translation-warning__report");
      if (r) r.hidden = false;
    };
    if (tq && document.querySelector(".fa-page-qa-badges")) {
      // A generated page (or a translation of one) carries its own badge.
      showReport();
    } else if (tq && tq.src && tq.index) {
      var tqBadge = el("button", {
        type: "button",
        class: "fa-qa-badge fa-qa-pending fa-qa-fam-translation",
        // The generated badge's two attributes too (`qaBadgePlaceholder`).
        lang: CHROME_LANG,
        dir: "ltr",
        "data-qa-family": "translation",
        "data-qa-key": tq.key || "page.translation",
        "data-qa-label": "Translation QA",
        "data-qa-noun": "page",
        "data-qa-src": tq.src,
        "data-qa-index": tq.index,
        "aria-expanded": "false",
        "aria-busy": "true",
        title: "Translation QA: loading the verdict…",
        "aria-label": "Translation QA: loading the verdict…"
      });
      tqBadge.appendChild(el("span", { class: "fa-qa-tag" }, "TR"));
      tqBadge.appendChild(el("span", { class: "fa-qa-glyph", "aria-hidden": "true" }, "…"));
      if (!tq.list) {
        // An older `head_custom.html` emitted the paths only where a
        // projection existed; that page needs no list to ask.
        container.appendChild(tqBadge);
      } else {
        // WHICH authored pages have a projection is a published asset, fetched
        // here, never baked into the page (bean `4l4d`). Three answers:
        //   - the list names this page: build the badge and paint it from the
        //     page's `qa-index.json`, as every other badge is painted;
        //   - the list loaded, has the corpus, and does not name it: no
        //     projection, so no badge — the determined answer it always was;
        //   - the list says `corpus: "absent"`, or will not load: whether this
        //     page was swept is unknown, said as "not available in this build".
        fetch(tq.list, { credentials: "same-origin" })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (doc) {
            if (doc && doc.corpus !== "absent" && Array.isArray(doc.pages)) {
              if (doc.pages.indexOf(tq.slug) === -1) return;
              container.appendChild(tqBadge);
              showReport();
              paintQaBadges(container);
              return;
            }
            container.appendChild(tqBadge);
            qaPaintInert(tqBadge, "unavailable");
          })
          .catch(function () {
            container.appendChild(tqBadge);
            qaPaintInert(tqBadge, "unavailable");
          });
      }
    }

    // The page-level QA badges the generator emitted under the h1 join this
    // row rather than standing as a second one. They are SERVER-rendered,
    // because whether a page's blocks carry any translation verdict is
    // structure — the same argument `gen-docs-pages.ts` makes for the per-node
    // icons — and they are moved rather than rebuilt here so there is exactly
    // one place that knows their markup.
    var pageQa = document.querySelector(".fa-page-qa-badges");
    if (pageQa) {
      while (pageQa.firstChild) container.appendChild(pageQa.firstChild);
      // The now-empty span, and the paragraph kramdown wrapped it in when that
      // span was the whole line. Left behind, the paragraph keeps its margins
      // and opens a gap under the title that looks like a rendering fault.
      var host = pageQa.parentNode;
      pageQa.parentNode.removeChild(pageQa);
      if (host && host.tagName === "P" && host.textContent.trim() === "" &&
          host.children.length === 0 && host.parentNode) {
        host.parentNode.removeChild(host);
      }
    }

    // Place badges AFTER the h1, not inside it. Inside the h1 they were
    // invisible because kramdown's {: .fs-9 } makes the heading enormous
    // and the tiny badges got lost in it.
    if (title.nextSibling) {
      title.parentNode.insertBefore(container, title.nextSibling);
    } else {
      title.parentNode.appendChild(container);
    }
  }

  /* ── QA witness panels ───────────────────────────────────────────────── */

  // The icons beside each node's Edit link carry a state; this opens what is
  // UNDER the state. Two levels, both asked for directly: a criterion list for
  // the sidecar, and under each criterion every witness that has ruled on it --
  // which script, model, agent or person, when, at which SHA, and whether the
  // verdict still applies to the files as they stand.
  //
  // The data is the `qa-witness/v1` projection written by gen-docs-pages.ts,
  // fetched on first click and cached for the life of the page. The sidecars
  // themselves are not published: 14 of them are 392 KB and a reader opens one
  // criterion, not forty-eight.
  //
  // Nothing here interpolates fetched text into markup. Every value from the
  // JSON goes in through textContent, because a sidecar carries verbatim
  // evidence quoted out of the content -- which is exactly the string that
  // would close a tag if it were concatenated into HTML.

  var QA_CACHE = {};
  var QA_SEQ = 0;

  var QA_RESULT_LABEL = {
    fail: "fail", warn: "warn", pass: "pass", "n/a": "n/a", unknown: "no verdict"
  };

  // A criterion the sidecar holds with no verdict recorded is shown as loudly
  // as a failure, not filed with the passes: it is the case a reader cannot
  // otherwise tell from a clean one.
  var QA_LOUD = { fail: 1, warn: 1, unknown: 1 };

  var QA_KIND_LABEL = {
    script: "script", agent: "agent", human: "human"
  };

  var QA_FRESH_LABEL = {
    fresh: "current",
    partial: "current on files",
    stale: "STALE",
    unknown: "currency unknown"
  };

  /** Short SHA for display; the full value stays in the title attribute. */
  function shortSha(s) {
    if (!s) return null;
    var bare = s.indexOf(":") === -1 ? s : s.slice(s.indexOf(":") + 1);
    return bare.length > 12 ? bare.slice(0, 12) : bare;
  }

  /**
   * A timestamp as the reader's own locale renders it, plus how long ago.
   *
   * An absent timestamp returns null and the caller prints "not recorded" --
   * kg-audit.ts records none, and inventing one would make an undated witness
   * indistinguishable from a dated one.
   */
  function qaWhen(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return { text: iso, title: iso };
    var days = Math.floor((Date.now() - d.getTime()) / 86400000);
    var ago = days <= 0 ? "today" : days === 1 ? "yesterday" : days + " days ago";
    // `YYYY-MM-DD HH:MM`, not the locale's long form: it is one short line in a
    // grid cell, it sorts by eye, and the exact instant is in the title.
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    var stamp = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    return { text: stamp + " (" + ago + ")", title: iso };
  }

  /** One labelled field of a witness. Absent values are STATED, not dropped. */
  function qaField(label, value, opts) {
    var row = el("div", { class: "fa-qa-field" });
    row.appendChild(el("span", { class: "fa-qa-field-label" }, label));
    var v = el("span", { class: "fa-qa-field-value" }, value == null ? "not recorded" : value);
    if (value == null) v.className += " fa-qa-absent";
    if (opts && opts.title) v.setAttribute("title", opts.title);
    if (opts && opts.mono) v.className += " fa-qa-mono";
    row.appendChild(v);
    return row;
  }

  /**
   * The tree-to-commit index, fetched once per page and only when a witness
   * card with a tree is built (bean 69lr; owner card Q5, 2026-11-05). `null`
   * when it is absent or unreadable: the tree then stays plain text.
   */
  var treeCommitsPromise = null;
  function treeCommits() {
    if (!treeCommitsPromise) {
      treeCommitsPromise = fetch(siteBaseurl() + "/assets/qa/tree-commits.json")
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          return j && j.$schema === "folio-qa-tree-commits/v1" && j.commits ? j : null;
        })
        .catch(function () { return null; });
    }
    return treeCommitsPromise;
  }

  /** Turn a "repo tree at review" value into a link to main's commit with that tree, when the index has one. */
  function linkTreeToCommit(row, tree) {
    treeCommits().then(function (idx) {
      var commit = idx && idx.commits[tree];
      if (!commit || !/^[0-9a-f]{40}$/.test(commit) || typeof idx.repo !== "string") return;
      var href = safeHref(idx.repo + "/commit/" + commit);
      var v = row.querySelector(".fa-qa-field-value");
      if (!href || !v || !/^https:\/\/github\.com\//.test(href)) return;
      var a = el("a", { href: href, class: "fa-qa-mono", title: "The commit on main where tree " + tree +
        " first landed: " + commit }, shortSha(tree) + " (commit " + shortSha(commit) + ")");
      v.textContent = "";
      v.appendChild(a);
    });
  }

  /**
   * Date a "when" row from the reviewed tree (owner rulings 2026-11-06: card
   * "QA dates", option 1, and card "Date source", option 1, derive the date ON
   * READ). Writers no longer stamp a clock in a verdict, so the same verdict
   * over the same tree is the same bytes on a PR and on main; its date is the
   * commit date of the commit on main carrying that tree, from the index's
   * `dates`. A tree the index does not date leaves the row as it was: the
   * witness's own legacy date, or "not recorded" -- never now.
   */
  function dateRowFromTree(row, tree) {
    treeCommits().then(function (idx) {
      var iso = idx && idx.dates && idx.dates[tree];
      var when = typeof iso === "string" ? qaWhen(iso) : null;
      var v = row.querySelector(".fa-qa-field-value");
      if (!when || !v) return;
      v.textContent = when.text;
      v.className = v.className.replace(/\s*fa-qa-absent\b/, "");
      v.setAttribute("title", "The commit date of the commit on main carrying the reviewed tree " +
        tree + ": " + when.title);
    });
  }

  function qaWitnessCard(w) {
    var card = el("div", { class: "fa-qa-witness fa-qa-kind-" + (w.kind || "script") });

    var head = el("div", { class: "fa-qa-witness-head" });
    head.appendChild(el("span", { class: "fa-qa-chip fa-qa-chip-kind" },
      QA_KIND_LABEL[w.kind] || w.kind || "unrecorded"));
    head.appendChild(el("code", { class: "fa-qa-witness-id" }, w.id || "unrecorded"));
    if (w.version) head.appendChild(el("span", { class: "fa-qa-witness-ver" }, w.version));
    var fresh = w.freshness || "unknown";
    head.appendChild(el("span", {
      class: "fa-qa-chip fa-qa-fresh-" + fresh,
      title: fresh === "stale"
        ? "The files this verdict was measured against have changed since."
        : fresh === "unknown"
          ? "This verdict's currency could not be established -- it is not reported as current."
          : fresh === "partial"
            ? "Every file this verdict was measured against still matches. A derived input -- one computed rather than read off disk -- was not re-checked here."
            : "Measured against the files as they stand."
    }, QA_FRESH_LABEL[fresh] || fresh));
    card.appendChild(head);

    var why = null;
    if (fresh !== "fresh" && w.changed && w.changed.length) {
      why = el("div", { class: "fa-qa-changed" });
      why.appendChild(el("span", { class: "fa-qa-field-label" },
        fresh === "stale" ? "changed since review" : "could not compare"));
      var ul = el("ul");
      w.changed.forEach(function (c) { ul.appendChild(el("li", null, c)); });
      why.appendChild(ul);
      card.appendChild(why);
    }
    // Named, not implied: "current on files" is only readable next to WHICH
    // input went unchecked.
    if (w.notCompared && w.notCompared.length) {
      var nc = el("div", { class: "fa-qa-changed" });
      nc.appendChild(el("span", { class: "fa-qa-field-label" }, "not re-checked"));
      var ncl = el("ul");
      w.notCompared.forEach(function (c) { ncl.appendChild(el("li", null, c)); });
      nc.appendChild(ncl);
      card.appendChild(nc);
    }

    var when = qaWhen(w.at);
    var grid = el("div", { class: "fa-qa-field-grid" });
    var whenRow = qaField("when", when && when.text, { title: when && when.title });
    grid.appendChild(whenRow);
    if (w.tree) dateRowFromTree(whenRow, w.tree);
    // A verdict records the TREE it reviewed, not HEAD's commit (folio-assistant
    // bean 69lr; owner card Q4, 2026-11-05: "the tree is the identity"). On a
    // pull_request run HEAD is the synthetic refs/pull/<n>/merge commit, which
    // can vanish; the commit that lands on main has the same tree. Sidecars
    // written before that still carry only `sha`, so it is shown when there is
    // no tree. GitHub has no tree-to-commit lookup, so the link comes from
    // `assets/qa/tree-commits.json`, which the deploy writes from main's
    // first-parent history beside the evidence (owner card Q5, 2026-11-05,
    // option 1: a separate index, so the cached pages stay a function of the
    // tree). A tree the index does not hold, an index that is absent, or a
    // non-GitHub origin (`repo: null`) leaves the tree as plain text: absent,
    // never a dead link.
    if (w.tree) {
      var treeRow = qaField("repo tree at review", shortSha(w.tree),
        { mono: true, title: "Git tree id of the reviewed checkout: " + w.tree +
          ". Every commit with this tree has exactly these inputs." });
      grid.appendChild(treeRow);
      linkTreeToCommit(treeRow, w.tree);
    } else {
      grid.appendChild(qaField("repo SHA at review", shortSha(w.sha),
        { mono: true, title: w.sha || undefined }));
    }
    if (w.kind === "script" || w.scriptHash) {
      grid.appendChild(qaField("checker source hash", shortSha(w.scriptHash),
        { mono: true, title: w.scriptHash || undefined }));
      grid.appendChild(qaField("checker last commit", shortSha(w.scriptCommitSha),
        { mono: true, title: w.scriptCommitSha || undefined }));
    }
    if (w.depsHash) {
      grid.appendChild(qaField("extra-input hash", shortSha(w.depsHash), { mono: true }));
    }
    if (w.kind === "agent") {
      grid.appendChild(qaField("model", w.model, { mono: true }));
      grid.appendChild(qaField("session", w.session, { mono: true }));
      grid.appendChild(qaField("skill", w.skill, { mono: true }));
    }
    if (w.method) grid.appendChild(qaField("method", w.method));
    card.appendChild(grid);

    if (w.notes) {
      card.appendChild(el("p", { class: "fa-qa-notes" }, w.notes));
    }
    return card;
  }

  function qaCriterionRow(c, idx, panelId) {
    var li = el("li", { class: "fa-qa-crit-item" });
    var bodyId = panelId + "-c" + idx;

    var btn = el("button", {
      type: "button",
      class: "fa-qa-crit",
      "aria-expanded": "false",
      "aria-controls": bodyId
    });
    btn.appendChild(el("span", { class: "fa-qa-caret", "aria-hidden": "true" }, "▸"));
    btn.appendChild(el("span", { class: "fa-qa-chip fa-qa-res-" + (c.result || "unknown") },
      QA_RESULT_LABEL[c.result] || c.result || "no verdict"));
    if (c.severity) {
      btn.appendChild(el("span", { class: "fa-qa-chip fa-qa-sev-" + c.severity }, c.severity));
    }
    // On a page-level roll-up one panel carries verdicts about many blocks, so
    // the row has to say WHICH — a `fail` with no subject is a page-wide alarm
    // a reader cannot act on. Absent on a per-block panel, where the doc's own
    // subject already says it.
    if (c.block) {
      btn.appendChild(el("span", { class: "fa-qa-chip fa-qa-block" }, c.block));
    }
    if (c.locale) {
      btn.appendChild(el("span", { class: "fa-qa-chip fa-qa-locale" }, c.locale));
    }
    btn.appendChild(el("code", { class: "fa-qa-crit-id" }, c.id));
    var n = (c.witnesses || []).length;
    btn.appendChild(el("span", { class: "fa-qa-wcount" },
      n === 0 ? "no witness" : n === 1 ? "1 witness" : n + " witnesses"));

    var body = el("div", { class: "fa-qa-crit-body", id: bodyId, hidden: "hidden" });

    if (c.evidence && c.evidence.length) {
      var ev = el("div", { class: "fa-qa-evidence" });
      ev.appendChild(el("div", { class: "fa-qa-field-label" }, "evidence"));
      c.evidence.forEach(function (line) {
        ev.appendChild(el("pre", null, line));
      });
      body.appendChild(ev);
    }
    if (c.metrics) {
      var keys = Object.keys(c.metrics);
      if (keys.length) {
        var mg = el("div", { class: "fa-qa-field-grid" });
        keys.sort().forEach(function (k) {
          mg.appendChild(qaField(k, String(c.metrics[k])));
        });
        body.appendChild(mg);
      }
    }
    if (c.score) {
      body.appendChild(qaField("score", c.score.value + " / " + c.score.max));
    }

    if (n === 0) {
      // Not a blank space: a criterion carried with nothing behind it is a gap
      // in the audit, and saying so is the only way a reader learns of it.
      body.appendChild(el("p", { class: "fa-qa-absent" },
        "No witness recorded for this criterion — nobody has ruled on it."));
    } else {
      c.witnesses.forEach(function (w) { body.appendChild(qaWitnessCard(w)); });
    }

    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      if (open) body.setAttribute("hidden", "hidden");
      else body.removeAttribute("hidden");
      btn.firstChild.textContent = open ? "▸" : "▾";
    });

    li.appendChild(btn);
    li.appendChild(body);
    return li;
  }

  function qaCountsLine(doc) {
    var c = doc.counts || {};
    var parts = [];
    ["fail", "warn", "pass", "na", "unknown"].forEach(function (k) {
      var v = c[k] || 0;
      if (k === "unknown" && v === 0) return;
      parts.push(v + " " + (k === "na" ? "n/a" : k === "unknown" ? "no verdict" : k));
    });
    return parts.join(" · ");
  }

  function qaBuildPanel(doc, panelId, badge) {
    // English at the root (bean `giiw`): the criteria, verdicts and counts are
    // the QA corpus's English, and the subject is the SOURCE page's title,
    // which is what the projection was computed over.
    var panel = chromeText(el("div", {
      class: "fa-qa-panel fa-qa-panel-" + (doc.state || "unswept"),
      id: panelId,
      role: "region",
      "aria-label": "QA detail for " + (doc.subject || "this node"),
      tabindex: "-1"
    }));

    var head = el("div", { class: "fa-qa-panel-head" });
    head.appendChild(el("strong", null, (badge.getAttribute("aria-label") || "").split(":")[0]));
    head.appendChild(el("span", { class: "fa-qa-subject" }, doc.subject || ""));
    head.appendChild(el("span", { class: "fa-qa-counts" }, qaCountsLine(doc)));

    // Each result file's ADDRESS comes from the projection (`sidecarLinks`,
    // stamped by `qa-result-link.ts`), never composed here. This used to be
    // `blob/main/` + `p`, which was wrong twice (bean `bejf`, #2217). `p` is
    // relative to the instance, not the repository, and a derived result's
    // record is the `qa-reports` branch, keyed by commit, not `main`. A
    // projection with no stamped links shows the paths as plain text, because a
    // link that 404s invites the click that proves the page broken.
    var links = doc.sidecarLinks;
    if (links && links.length) {
      links.forEach(function (s) {
        var label = s.path + (s.addressedBy === "tip" ? " (newest stored entry)" : "");
        var title = s.addressedBy === "entry"
          ? "Stored on the qa-reports branch, entry " + s.key
          : s.addressedBy === "tip"
            ? "Stored on the qa-reports branch; this build did not record which entry, so this opens the branch's index of the newest entry per ref"
            : "Committed on main";
        head.appendChild(s.href
          ? el("a", { class: "fa-qa-sidecar-link", href: safeHref(s.href), rel: "noopener", title: title,
                      "data-qa-addressed-by": s.addressedBy }, label)
          : el("code", { class: "fa-qa-sidecar-link", title: "No forge to link to" }, s.path));
      });
    } else {
      (doc.sidecars || []).forEach(function (p) {
        head.appendChild(el("code", { class: "fa-qa-sidecar-link" }, p));
      });
    }

    var close = el("button", { type: "button", class: "fa-qa-close", title: "Close this panel" },
      "✕ Close");
    close.addEventListener("click", function () { qaToggle(badge); });
    head.appendChild(close);
    panel.appendChild(head);

    var loud = [];
    var quiet = [];
    (doc.criteria || []).forEach(function (c) {
      (QA_LOUD[c.result] ? loud : quiet).push(c);
    });

    var list = el("ul", { class: "fa-qa-crit-list" });
    var i = 0;
    loud.forEach(function (c) { list.appendChild(qaCriterionRow(c, i++, panelId)); });
    panel.appendChild(list);

    if (quiet.length) {
      // 48 criteria per block, 46 of them pass or n/a. Folding those behind one
      // control keeps the two that need reading at the top -- and the fold is
      // labelled with its count, so a clean sweep still says how much it checked.
      var more = el("button", {
        type: "button",
        class: "fa-qa-more",
        "aria-expanded": loud.length === 0 ? "true" : "false"
      }, (loud.length === 0 ? "▾ " : "▸ ") + "show " + quiet.length +
         " passing / not-applicable criteria");
      var quietList = el("ul", { class: "fa-qa-crit-list" });
      quiet.forEach(function (c) { quietList.appendChild(qaCriterionRow(c, i++, panelId)); });
      if (loud.length !== 0) quietList.setAttribute("hidden", "hidden");
      more.addEventListener("click", function () {
        var open = more.getAttribute("aria-expanded") === "true";
        more.setAttribute("aria-expanded", open ? "false" : "true");
        if (open) quietList.setAttribute("hidden", "hidden");
        else quietList.removeAttribute("hidden");
        more.textContent = (open ? "▸ show " : "▾ ") + quiet.length +
          (open ? " passing / not-applicable criteria" : " passing / not-applicable criteria");
      });
      panel.appendChild(more);
      panel.appendChild(quietList);
    }

    if (!doc.criteria || doc.criteria.length === 0) {
      panel.appendChild(el("p", { class: "fa-qa-absent" },
        "The sidecar holds no criteria — nothing about this subject has been checked."));
    }
    // A TRANSLATION panel is also the translation drawer's block scope (bean
    // `cat-tools-bbnd`): staleness and officiality per locale, one more control.
    if (doc.family === "translation" || badge.getAttribute("data-qa-family") === "translation") {
      panel.classList.add("fa-tr-drawer");
      panel.appendChild(trBlockSection(doc));
    }
    return panel;
  }

  /** Where a panel goes: after the block-level line holding the icon. */
  function qaAnchorFor(badge) {
    var p = badge.parentNode;
    while (p && p.parentNode && p.tagName !== "P" && p.tagName !== "LI" &&
           p.className !== "main-content" && p.id !== "main-content") {
      p = p.parentNode;
    }
    return p || badge;
  }

  function qaFail(badge, panelId, src, msg) {
    var panel = chromeText(el("div", { class: "fa-qa-panel fa-qa-panel-error", id: panelId, role: "region" }));
    // Loud, and specific about which file could not be read: a panel that opens
    // empty is indistinguishable from a subject with nothing to report.
    panel.appendChild(el("strong", null, "Could not load the QA detail"));
    panel.appendChild(el("p", null, msg));
    panel.appendChild(el("code", null, src));
    var close = el("button", { type: "button", class: "fa-qa-close" }, "✕ Close");
    close.addEventListener("click", function () { qaToggle(badge); });
    panel.appendChild(close);
    return panel;
  }

  function qaToggle(badge) {
    var panelId = badge.getAttribute("aria-controls");
    if (panelId) {
      var open = document.getElementById(panelId);
      if (open) {
        open.parentNode.removeChild(open);
        badge.setAttribute("aria-expanded", "false");
        badge.focus();
        return;
      }
    } else {
      panelId = "fa-qa-panel-" + (++QA_SEQ);
      badge.setAttribute("aria-controls", panelId);
    }

    var src = badge.getAttribute("data-qa-src");
    if (!src) return;
    badge.setAttribute("aria-expanded", "true");
    badge.setAttribute("aria-busy", "true");

    var anchor = qaAnchorFor(badge);
    function mount(node) {
      badge.removeAttribute("aria-busy");
      if (anchor.nextSibling) anchor.parentNode.insertBefore(node, anchor.nextSibling);
      else anchor.parentNode.appendChild(node);
      node.focus();
    }

    if (QA_CACHE[src]) { mount(qaBuildPanel(QA_CACHE[src], panelId, badge)); return; }

    fetch(src, { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (doc) {
        QA_CACHE[src] = doc;
        mount(qaBuildPanel(doc, panelId, badge));
      })
      .catch(function (e) {
        mount(qaFail(badge, panelId, src, e.message));
      });
  }

  /* ── Badge verdicts, fetched rather than baked in ─────────────────────── */

  /**
   * The state mark, and it has to say GOOD or BAD without a legend.
   *
   * Moved here from `scripts/gen-docs-pages.ts` when the badges stopped
   * carrying their verdict in the markup (bean `d2kp`). The reasoning is the
   * generator's and is kept verbatim because it was paid for:
   *
   * `● ◐ ○ ·` shipped in #274 and was reported unreadable by the first person
   * to use it: filled-vs-open circles encode a scale, but nothing in them says
   * which end is the good one, and at 0.75rem `●` and `·` differ only in size.
   * `✓ ! ✕` carry their meaning on their own, survive monochrome, and keep
   * colour as reinforcement rather than as the message.
   *
   * **Two states carry no mark at all, and they are not the same state.**
   * `empty` is a subject that WAS swept and whose every criterion came back
   * `n/a`; a subject nobody has swept never reaches this map: its key is in
   * the index's `unswept` list and `qaPaintInert` turns it into a dulled
   * `<span>` — there is nothing to fetch and nothing to open. (That was
   * server-rendered until bean `4l4d`; it moved to the index because whether a
   * sidecar exists is a fact about the fetched QA corpus, not the checkout.)
   * Any glyph on either would be a claim about a check that returned no
   * verdict.
   *
   * **`unknown` is the third state and it is NOT a quiet pass.** `?` is loud
   * on purpose: a badge that could not read its verdict must not look like one
   * that read a clean one. This repository has paid for that collapse before —
   * an absent simulators directory rendered as "this folio has no simulators",
   * replacing a correct nine-row table.
   */
  var QA_GLYPH = { fail: "✕", warn: "!", pass: "✓", empty: "", unknown: "?" };

  /** Every class this painter owns, so painting twice cannot leave two on. */
  var QA_STATE_CLASSES = [
    "fa-qa-pending", "fa-qa-fail", "fa-qa-warn", "fa-qa-pass",
    "fa-qa-empty", "fa-qa-unknown"
  ];

  /** One fetch per page index, shared by every badge that names it. */
  var QA_INDEX_CACHE = {};

  /**
   * The counts line, shared by the icon's tooltip and its accessible name.
   *
   * `n/a` and `unknown` are reported, never folded into the others: a criterion
   * that did not apply and one the sidecar holds no verdict for are different
   * facts, and both are the reader's business. Lifted from the generator with
   * its wording intact, so the badge reads as it always did.
   */
  function qaBadgeTitle(label, noun, state, counts, reason) {
    if (state === "unknown") {
      return label + ": could not determine — " + (reason === "no-row"
        ? "this page's verdict index has no row for this " + noun
        : "this page's verdict index is not available in this build");
    }
    if (state === "empty") {
      return label + ": swept, and no criterion applied to this " + noun +
        " — open for witnesses";
    }
    var c = counts || {};
    var parts = [
      (c.fail || 0) + " fail", (c.warn || 0) + " warn",
      (c.pass || 0) + " pass", (c.na || 0) + " n/a"
    ];
    if (c.unknown > 0) parts.push(c.unknown + " no verdict");
    return label + ": " + parts.join(", ") + " — open for witnesses";
  }

  /**
   * Paint one badge into one of the three determinable outcomes.
   *
   * `entry` is the index row for this badge, or null for could-not-determine.
   * A row whose `state` is the projector's `unswept` becomes `empty` here: the
   * projector uses one word for "nothing ruled on this" whatever the reason,
   * and by the time a row EXISTS the subject has demonstrably been swept.
   */
  function qaPaintBadge(badge, entry, reason) {
    var label = badge.getAttribute("data-qa-label") || "QA";
    var noun = badge.getAttribute("data-qa-noun") || "subject";
    var state = entry ? (entry.state === "unswept" ? "empty" : entry.state) : "unknown";
    if (!QA_GLYPH.hasOwnProperty(state)) state = "unknown";

    QA_STATE_CLASSES.forEach(function (c) { badge.classList.remove(c); });
    badge.classList.add("fa-qa-" + state);

    var title = qaBadgeTitle(label, noun, state, entry && entry.counts, reason);
    badge.setAttribute("title", title);
    badge.setAttribute("aria-label", title);
    badge.removeAttribute("aria-busy");

    // The glyph node is replaced rather than left in place with new text: a
    // state with no mark must contribute nothing to the accessible name, and
    // an empty `<span>` beside the tag still opens a gap in the flex row.
    var glyph = badge.querySelector(".fa-qa-glyph");
    var mark = QA_GLYPH[state];
    if (mark === "") {
      if (glyph) glyph.parentNode.removeChild(glyph);
      return;
    }
    if (!glyph) {
      glyph = el("span", { class: "fa-qa-glyph", "aria-hidden": "true" });
      badge.appendChild(glyph);
    }
    glyph.textContent = mark;
  }

  /**
   * Replace a placeholder with an inert mark: there is nothing to open.
   *
   * `unswept` — the index lists the key: no sidecar, nobody has ruled.
   * `unavailable` — the index says `corpus: "absent"`: this build was made
   * without the QA results, so whether anything was swept is UNKNOWN. Neither
   * is a verdict and neither carries a glyph; the class and the accessible
   * name say which absence it is.
   *
   * A `<span>` rather than a disabled `<button>`: a control that does nothing
   * when pressed is worse than a plain mark. The span drops `data-qa-src` and
   * `data-qa-index`, so neither the click delegate nor a repaint touches it.
   * Bean `4l4d` — this was server-rendered until the committed pages had to
   * stop depending on the QA corpus.
   */
  function qaPaintInert(badge, kind) {
    var label = badge.getAttribute("data-qa-label") || "QA";
    var noun = badge.getAttribute("data-qa-noun") || "subject";
    var family = badge.getAttribute("data-qa-family") || "";
    var title = kind === "unavailable"
      ? label + ": not available in this build — the QA results were not fetched, " +
        "so whether this was swept is unknown"
      : label + ": not swept — " + (noun === "page"
        ? "no block on this page carries a translation verdict"
        : "no sidecar for this " + noun);
    // A NEW element, so the button's `lang`/`dir` do not come with it unless
    // carried: an inert badge is English chrome too (bean `giiw`).
    var span = chromeText(document.createElement("span"));
    span.className = "fa-qa-badge fa-qa-unswept" +
      (kind === "unavailable" ? " fa-qa-unavailable" : "") +
      (family ? " fa-qa-fam-" + family : "");
    ["data-qa-family", "data-qa-key", "data-qa-label", "data-qa-noun"].forEach(function (a) {
      var v = badge.getAttribute(a);
      if (v !== null) span.setAttribute(a, v);
    });
    span.setAttribute("title", title);
    span.setAttribute("aria-label", title);
    var tag = badge.querySelector(".fa-qa-tag");
    if (tag) span.appendChild(tag);
    if (badge.parentNode) badge.parentNode.replaceChild(span, badge);
    return span;
  }

  /**
   * Fetch each page's verdict index and paint the badges that named it.
   *
   * **Why the page no longer carries the verdict.** `gen-docs-pages.ts` used
   * to write the state class, the glyph and the counts straight into
   * `docs/*.md`, which made a generated page stale every time a sweep changed
   * its mind. Bean `d2kp` measured both halves of the damage: twelve pages
   * stale on `main`, one of them because the graph got BETTER, and a published
   * page telling readers a knowledge-graph check failed on
   * `publication-workflow.md` when it passed. A document that carries a
   * measurement does not go stale loudly; it goes stale by lying.
   *
   * **One request per page, not one per badge.** `publication-workflow` has 39
   * badges over 21 projections totalling 376 KB. The index holds the state and
   * the counts only, so it is a few kilobytes; the projection behind a badge
   * is still fetched on click, by `qaToggle`, exactly as before.
   *
   * **A failure paints `unknown`, never a verdict.** No network, a 404, a body
   * that is not JSON, or an index that has no row for this badge all land in
   * the same honest place: the reader is told the verdict could not be
   * determined, and the badge still opens — `qaToggle` fetches the projection
   * itself and says which file it could not read if that fails too.
   */
  function paintQaBadges(root) {
    var scope = root || document;
    // English chrome (bean `giiw`). The generator writes `lang`/`dir` into the
    // markup now; a TRANSLATED copy of a generated page (`process/ar/…`) keeps
    // the markup it was translated from — which has neither, and on the
    // committed Arabic copies is an older generator's inert `<span>` with no
    // index to paint from — and the generator does not rewrite it. So every
    // badge in scope is marked here, painted or not.
    Array.prototype.forEach.call(scope.querySelectorAll(".fa-qa-badge"), chromeText);
    var badges = scope.querySelectorAll(".fa-qa-badge[data-qa-index]");
    if (badges.length === 0) return;

    var byIndex = {};
    Array.prototype.forEach.call(badges, function (b) {
      var src = b.getAttribute("data-qa-index");
      (byIndex[src] = byIndex[src] || []).push(b);
    });

    Object.keys(byIndex).forEach(function (src) {
      var group = byIndex[src];
      function paintAll(doc) {
        group.forEach(function (b) {
          var key = b.getAttribute("data-qa-key");
          // The build had no QA corpus: whether this was swept is unknown.
          if (doc && doc.corpus === "absent") { qaPaintInert(b, "unavailable"); return; }
          if (doc && key && Array.isArray(doc.unswept) && doc.unswept.indexOf(key) !== -1) {
            qaPaintInert(b, "unswept");
            return;
          }
          var row = doc && doc.badges && key ? doc.badges[key] : null;
          qaPaintBadge(b, row || null, doc ? "no-row" : "no-index");
        });
      }
      if (QA_INDEX_CACHE[src]) { paintAll(QA_INDEX_CACHE[src]); return; }
      fetch(src, { credentials: "same-origin" })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (doc) { QA_INDEX_CACHE[src] = doc; paintAll(doc); })
        .catch(function () { paintAll(null); });
    });
  }

  function mountQaPanels() {
    // Delegated, so icons added later (or by a future client-side render) work
    // without re-binding, and one listener serves a page with fifty of them.
    document.addEventListener("click", function (ev) {
      var badge = ev.target && ev.target.closest
        ? ev.target.closest(".fa-qa-badge[data-qa-src]")
        : null;
      if (!badge) return;
      ev.preventDefault();
      qaToggle(badge);
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape") return;
      var panel = ev.target && ev.target.closest ? ev.target.closest(".fa-qa-panel") : null;
      if (!panel) return;
      var badge = document.querySelector('.fa-qa-badge[aria-controls="' + panel.id + '"]');
      if (badge) qaToggle(badge);
    });
  }



  /* ── RETIRED 2026-10-15: the theme sidebar's own sections ─────────────────
   *
   * Owner, 2026-10-15, "folio rail everywhere" (option A): a pass after Jekyll
   * (cat-harness-tools `rail-standalone-pages.ts --theme-source`) replaces the
   * theme's `.side-bar` with the folio rail, built on the server. Its "On this
   * page", "Pages", "Folders" and "Harnesses" are the rail's own sections
   * (`lib/navbar.ts`, `lib/jekyll-pages-nav.ts`), so the browser no longer
   * builds them here: `mountDocumentIndex`, `mountInstanceGraphs`,
   * `scopeSiteNav` / `readRailScope` (#1902), `mountNavPagesHeading`,
   * `sortNavByLocale` and `mountSidebarRail` are gone, with their
   * `.side-bar` rules in `docs-ui.css`. */

  /* ── THE NAVBAR ICON ROW — line 2 of the fixed top ───────────────────────
   *
   * Owner, 2026-09-22: *"[x] should be on the navbar w/ other icons, can make
   * two lines avatar+name of harness/catalogue/sub-grrraph as approrirate, the
   * second line are the icons. max is 6 and one for todos one for beans one
   * for processes viewer/ (the factory flow) one for KG viewer"* — and on
   * where the list lives: *"should be in each harness config which are shown
   * (so some could show none, but make this default in cat-harness that is
   * inherited)."*
   *
   * WHICH ICONS IS NOT DECIDED HERE. `#fa-navbar-row` carries the resolved
   * list and the resolved destinations, from `sync-docs-harness.ts`. This
   * function draws what it is handed, in the order it is handed, and knows no
   * default — a fallback list here would be the hardcoded-names failure the
   * declaration exists to end, and it would silently outvote an instance that
   * chose `[]`.
   *
   * `null` IS A THIRD STATE. The instance has not decided and nothing up its
   * `needs` chain has either. It renders NO ROW and says so once, because
   * drawing an empty row would report an un-migrated instance as a deliberate
   * one — the distinction the schema's own docs are about.
   *
   * THE `[x]` IS NOT DRAWN HERE and is not missing. It is a `<label>` for the
   * pure-CSS open/close checkbox, and it must keep working with no script at
   * all; the stylesheet places it into this row's last slot while pinned. That
   * is the same "where a label is PAINTED is free" argument `.fa-nav-toggle`
   * already makes — the row is a layout, and a control does not have to be
   * built by the thing that positions it.
   */
  function _readNavbarRow() {
    var node = document.getElementById("fa-navbar-row");
    if (!node) return undefined;
    var text = (node.textContent || "").trim();
    // SHARED ROW DATA THAT DID NOT ARRIVE. A folio's railed page keeps the
    // island empty and names the file that fills it (`data-fa-row-src`,
    // `withNavbarRow` in harness-rail.ts); the file drops the name once it
    // has. Still named and still empty, the load FAILED — and that is not
    // "declared nothing", which an empty island otherwise means.
    if (text === "" && node.hasAttribute("data-fa-row-src")) {
      node.setAttribute("data-fa-row-state", "failed");
      console.warn("docs-ui: the navbar icon row's shared data (" +
                   node.getAttribute("data-fa-row-src") + ".js) did not load; the row was not mounted.");
      return undefined;
    }
    if (text === "" || text === "null") return null;   // declared nothing
    try {
      var parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_e) {
      console.warn("docs-ui: #fa-navbar-row is not valid JSON; the navbar icon row " +
                   "was not mounted.");
      return undefined;
    }
  }

  /* THE FOLIO IN THE ROW — owner, 2026-11-13: *"remove the folio purple tab
   * at top instead add an icon to the controls for the folio."* The icon
   * drives the EXISTING handle (one control over one state, `l4zi`): a click
   * clicks it, and its name and pressed state follow the handle's, count and
   * all. While the row carries it, `docs-ui.css` hides the handle; a page
   * with no row keeps the tab, so the glass is never out of reach. */
  var FOLIO_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<rect x="4" y="6.5" width="12" height="14.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M8 6.5V4.5A1.5 1.5 0 0 1 9.5 3H18.5A1.5 1.5 0 0 1 20 4.5V16.5A1.5 1.5 0 0 1 18.5 18H16" ' +
    'fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M7 11h6M7 14h6M7 17h4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
    "</svg>";
  function folioIcon() {
    var b = el("button", {
      type: "button", class: "fa-nav-icon fa-nav-folio", "aria-expanded": "false",
      "aria-label": "Pull down your folio", title: "Pull down your folio", "data-fa-tip": "Pull down your folio"
    });
    b.innerHTML = FOLIO_GLYPH;
    b.addEventListener("click", function () {
      var h = document.querySelector(".fa-glass-handle");
      if (h) h.click();
      bindFolioIcon();
    });
    return b;
  }
  /** Mirror the handle's name and state onto the row's folio icon. Idempotent; called from both sides, whichever mounts last. */
  function bindFolioIcon() {
    var b = document.querySelector(".fa-nav-folio");
    var h = document.querySelector(".fa-glass-handle");
    if (!b || !h) return;
    function sync() {
      var name = h.getAttribute("aria-label") || "Pull down your folio";
      b.setAttribute("aria-label", name);
      b.setAttribute("data-fa-tip", name);
      b.title = name;
      b.setAttribute("aria-expanded", h.getAttribute("aria-expanded") === "true" ? "true" : "false");
    }
    sync();
    if (b.__faFolioBound === h || typeof MutationObserver !== "function") return;
    b.__faFolioBound = h;
    new MutationObserver(sync).observe(h, { attributes: true, attributeFilter: ["aria-label", "aria-expanded"] });
  }
  /** Where focus goes back to when the glass closes: the handle, or the row's folio icon while the handle is hidden. */
  function focusFolioControl(handle) {
    var b = document.querySelector(".fa-nav-folio");
    if (b && handle.getClientRects().length === 0) b.focus();
    else handle.focus();
  }

  function mountNavIconRow() {
    // THE ROW IS DRAWN BY `navbar-row.js` — beans `lhvt`, `9rq1`. That file is
    // the one drawing for every navbar: it also runs on the 2,709 railed pages
    // that never load this script (measured on the built site after #2149,
    // where they carried the row's data and nothing drew it). Here it is
    // called in FULL mode, with the three things only this script owns: the
    // launcher's actions panel, the fsh-guts dialog and count (wired by
    // `mountFshGutsNav` through the button's `data-fa-fsh-guts-open`), and the
    // light/dark switch.
    var hooks = {
      full: true,
      // The launcher is the EXISTING control, moved -- not a second one.
      // `mountActionTiles` owns the panel and its open/close state, so this
      // clicks that button rather than minting a rival with its own idea of
      // whether the panel is open (`l4zi`).
      //
      // ONLY WHERE THE PANEL EXISTS (issue #2208). `mountActionTiles` runs
      // first and needs a sidebar header, which a folio's page does not have,
      // so there the slot is LEFT OUT -- the rule the LITE row already follows
      // (owner, 2026-10-05: *"1. Leave it out"*) -- rather than drawn as a
      // button that does nothing.
      launcher: document.querySelector(".fa-tiles-toggle") ? function () {
        var real = document.querySelector(".fa-tiles-toggle");
        if (real) real.click();
      } : undefined,
      after: function (host) {
        /* LIGHT / DARK IN THE ROW — owner, 2026-09-27: *"i want light dark
         * mode on main icon tab at top of LHS"*. The same switch as the
         * Settings tile and the header mini-button, so it REGISTERS a painter
         * rather than owning the state: three controls over one fact. */
        var scheme = el("button", { type: "button", class: "fa-nav-icon fa-nav-scheme" });
        registerSchemePainter(function (name) {
          scheme.innerHTML = name === "light" ? BULB_ON : BULB_OFF;
          var said = name === "light" ? "Light mode is on — switch to dark" : "Dark mode is on — switch to light";
          scheme.setAttribute("aria-label", said);
          scheme.setAttribute("data-fa-tip", said);
          scheme.title = said;
          scheme.setAttribute("aria-pressed", name === "dark" ? "true" : "false");
        });
        scheme.addEventListener("click", toggleScheme);
        host.appendChild(scheme);
        host.appendChild(folioIcon());
        // A row mounted LATE (the path below) has a fish nobody wired yet.
        // Idempotent per button, so the synchronous path is unaffected.
        mountFshGutsNav();
      }
    };
    if (window.FaNavbarRow) {
      window.FaNavbarRow.mount(hooks);
      return;
    }
    // `navbar-row.js` has not run yet. On a `folio-mount.ts` page this script
    // is appended from an inline script, so it can run first; leave the hooks
    // where `navbar-row.js` looks, and fetch it if no tag for it is coming.
    // Fetched beside THIS script's own file, and only when this script came
    // from one: an inlined copy (every e2e fixture) has no address to be
    // beside, and its page inlines `navbar-row.js` too.
    window.faNavbarRowHooks = hooks;
    if (document.querySelector('script[src*="/navbar-row.js"]')) return;
    var mine = document.querySelector('script[src*="/assets/js/docs-ui.js"]');
    if (!mine) return;
    var s = document.createElement("script");
    s.src = mine.getAttribute("src").replace(/\/assets\/js\/docs-ui\.js.*$/, "/assets/js/navbar-row.js");
    document.head.appendChild(s);
  }

  /* ── STAY CLOSED, REMEMBERED ─────────────────────────────────────────────
   *
   * Owner, 2026-09-23: *"need mechansim for closing harness navabar (e.g. w/
   * all pages)"*, with a screenshot of the bar open and nothing to press.
   *
   * ## The bar had ONE state bit and needed two
   *
   * `#fa-nav-open` is checked (pinned open) or clear (default). It ALSO opens
   * on hover and on focus, and `[x]` was shown only while pinned — so a bar
   * opened by a pointer had no control, and a touch reader, who has no
   * pointer to move away, had no way at all. Nothing persisted either: every
   * navigation started over.
   *
   * The owner chose the three-state answer over the two smaller ones:
   * pinned-open, default peek, and STAY CLOSED — remembered across pages.
   *
   * ## `[x]` cannot just be a label in the hover case
   *
   * It is a `<label for="fa-nav-open">` and a label TOGGLES. Pinned, that is
   * right and works with no script — a property this file protects. Open by
   * hover the checkbox is already clear, so the same click would CHECK it and
   * pin the bar open: the opposite of what the control says. So that click is
   * intercepted here, and the stylesheet only offers `[x]` in the hover case
   * when `.fa-nav-js` says this ran.
   *
   * ## What is stored, and what happens when it cannot be
   *
   * One key, one of two values, per browser. `localStorage` throws in a
   * private window and in previews, so every read and write is guarded and a
   * failure degrades to the previous behaviour rather than to a broken
   * navbar — the preference is a convenience, not state anything else needs.
   */
  var NAV_PREF_KEY = "fa-nav";

  function readNavPref() {
    try {
      return window.localStorage.getItem(NAV_PREF_KEY);
    } catch (_e) {
      return null;
    }
  }

  function writeNavPref(value) {
    try {
      if (value === null) window.localStorage.removeItem(NAV_PREF_KEY);
      else window.localStorage.setItem(NAV_PREF_KEY, value);
    } catch (_e) {
      // A reader in a private window still gets the close, for this page.
    }
  }

  function applyNavPref(value) {
    if (value === "closed") document.documentElement.setAttribute("data-fa-nav", "closed");
    else document.documentElement.removeAttribute("data-fa-nav");
  }

  function mountNavPreference() {
    var bar = document.querySelector(".side-bar");
    if (!bar) return;
    // The class the stylesheet keys the hover-case `[x]` on. Set FIRST, so a
    // control that needs this handler never appears without it.
    bar.classList.add("fa-nav-js");
    /* STAY-CLOSED IS NO LONGER REMEMBERED — owner, 2026-10-12: *"when LHS
     * navbar is slid open, the navbar remains collapsed. you then have to
     * click the avatar to open it"*. Once `[x]` went (#1762) the avatar was
     * the only close, so EVERY close stored "closed" and the hover peek was
     * withheld on every page after it. A close now holds the bar shut only
     * until the pointer leaves it (below), and a "closed" an earlier visit
     * stored is cleared rather than obeyed. */
    if (readNavPref() === "closed") writeNavPref(null);
    applyNavPref(null);

    var box = document.getElementById("fa-nav-open");
    // NO ☰ AND NO [x] (#1757 on the rail, ob3m finding 8 here). The avatar
    // below pins a closed bar open, and goes home from an open one.

    /* THE AVATAR OPENS AND CLOSES THE BAR — owner, 2026-09-27: *"navbar
     * starts hidden, click avatar opens for a split second then returns to
     * hidden"*. The avatar is the theme's home link, so a click RELOADED the
     * page: the bar peeked under the pointer, then came back at rest. With
     * stay-closed set it did not open at all.
     *
     * From 50rem up it is now the bar's toggle: pin open (lifting stay-closed),
     * or close (setting it, so the hover peek does not hold it open under the
     * pointer). (Superseded 2026-10-30, below: the ⌂ row is gone and an open
     * bar's avatar goes home.) Home was one click away, as ⌂ at the foot and
     * as the first page. Below 50rem the theme's ☰ owns the menu and the
     * avatar stays the home link. With no script it is the home link too. */
    var avatar = bar.querySelector(".site-title");
    if (avatar && box && window.matchMedia) {
      var wide = window.matchMedia("(min-width: 50rem)");
      var label = function () {
        if (!wide.matches) {
          avatar.removeAttribute("aria-expanded");
          avatar.removeAttribute("aria-controls");
          return;
        }
        avatar.setAttribute("aria-controls", bar.id || "");
        avatar.setAttribute("aria-expanded", box.checked ? "true" : "false");
        avatar.title = box.checked ? "Go to the landing page" : "Open navigation, or go to the landing page once it is open";
      };
      if (!bar.id) bar.id = "fa-side-bar";
      label();
      box.addEventListener("change", label);
      /* AN OPEN BAR'S AVATAR GOES HOME -- owner, 2026-10-30: *"who eblmen not
       * clicable to go to landing page. also dont need home on bottomof
       * harnes navbars."* The ⌂ row at the foot is gone, so the avatar is the
       * way home. It still pins a CLOSED bar open, which is the touch case
       * (no hover to peek it open); once the bar is open, by hover, focus or
       * the pin, the click is the theme's home link. */
      avatar.addEventListener("click", function (e) {
        if (!wide.matches) return;
        // `(hover: hover)`: a touch screen reports :hover on the tap itself,
        // which would send its first tap home instead of opening the bar.
        var canHover = window.matchMedia("(hover: hover)").matches;
        if (box.checked || (canHover && bar.matches(":hover")) || bar.matches(":focus-visible, :has(:focus-visible)")) return;
        e.preventDefault();
        box.checked = true;
        applyNavPref(null);
        label();
      });
      /* A PIN LIFTS WHEN THE MOUSE LEAVES -- owner, 2026-11-02 (Q-FMR-11 A).
       * Since an open bar's avatar goes home, nothing on the bar closes a
       * pin, so a bar pinned open stayed open until the reader left the page.
       * Now the mouse leaving the bar unpins it, and the bar goes back to the
       * hover peek. Only a MOUSE: a finger's pointerleave fires as it lifts,
       * which would undo the tap that pinned the bar. Nothing is stored. */
      bar.addEventListener("pointerleave", function (e) {
        if (e.pointerType !== "mouse" || !box.checked) return;
        box.checked = false;
        label();
      });
    }
  }

  /* A filter over every long table on the page -- bean 0fua.
   *
   * The glossary, processes, skills index and tools pages were each one flat
   * table of 48 to 270 rows with no way to find a row but scrolling: 67,046px
   * of it for the skills index at phone width, measured 2026-09-29. The owner
   * chose ONE site-wide filter over a per-visualiser one (2026-09-30), so this
   * lives here, where every page gets it, rather than in each generator.
   *
   * A table qualifies when it has more than TABLE_FILTER_MIN body rows at
   * load. Tables built later by a viewer's own script are not seen, and that
   * is deliberate: those viewers own their controls. `data-fa-no-filter` on
   * the table, or on anything around it, opts out.
   *
   * Matching is on the row's text, case-insensitive, and every word typed must
   * appear (AND), so "lean proof" narrows rather than widens. A hidden row is
   * `hidden`, not removed, so clearing the box restores the table exactly. The
   * count is a live region, because a sighted reader sees the table shrink and
   * a screen-reader user otherwise hears nothing at all. */
  var TABLE_FILTER_MIN = 25;

  function mountTableFilters() {
    var main = document.querySelector(".main-content");
    if (!main) return;
    var tables = main.querySelectorAll("table");
    for (var i = 0; i < tables.length; i++) {
      var table = tables[i];
      if (table.closest("[data-fa-no-filter]") || table.getAttribute("data-fa-filtered")) continue;
      var body = table.tBodies && table.tBodies[0];
      if (!body || body.rows.length <= TABLE_FILTER_MIN) continue;
      mountTableFilter(table, body, i);
    }
  }

  function mountTableFilter(table, body, index) {
    table.setAttribute("data-fa-filtered", "true");
    var rows = Array.prototype.slice.call(body.rows);
    var texts = rows.map(function (r) { return (r.textContent || "").toLowerCase(); });
    var id = "fa-table-filter-" + index;
    var box = el("div", { class: "fa-table-filter" });
    var label = el("label", { for: id }, "Filter this table");
    var input = el("input", { type: "search", id: id, autocomplete: "off", spellcheck: "false" });
    var count = el("span", { class: "fa-table-filter-count", "aria-live": "polite" });
    input.setAttribute("aria-describedby", id + "-count");
    count.id = id + "-count";
    box.appendChild(label);
    box.appendChild(input);
    box.appendChild(count);
    function apply() {
      var words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      var shown = 0;
      rows.forEach(function (row, n) {
        var hit = words.every(function (w) { return texts[n].indexOf(w) !== -1; });
        row.hidden = !hit;
        if (hit) shown++;
      });
      count.textContent = shown + " of " + rows.length + " rows";
    }
    input.addEventListener("input", apply);
    apply();
    // just-the-docs wraps tables in `.table-wrapper` for horizontal scroll; the
    // box goes before that, so it does not scroll sideways with the table.
    var anchor = table.parentNode && table.parentNode.classList &&
      table.parentNode.classList.contains("table-wrapper") ? table.parentNode : table;
    anchor.parentNode.insertBefore(box, anchor);
  }

  /* ── The footer's build stamp, filled from build.json ─────────────────
   *
   * `footer_custom.html` renders the stamp CONSTANTLY ("deployed dev") on
   * every build, the live site included, so a page that did not change is
   * byte-identical on every deploy and in every preview. A stamp baked in at
   * build time changed every page on every main deploy, which is what kept a
   * preview from sharing main's unchanged files and the cone deploy from
   * skipping anything (owner, 2026-10-31: "if asset not changed in staging
   * then link to main asset").
   *
   * The live site's facts are in `<base>/build.json`, which `docs-site.yml`
   * writes for client-side readers. A preview's are in `staging.json`, and
   * the staging banner's own script fills the stamp from it, so this leaves a
   * preview alone. A failed fetch leaves "dev" and says the details are
   * unavailable: it never shows a stamp it could not read.
   */
  function fillBuildStamp() {
    if (isStagingPreview()) return;
    var p = document.querySelector(".fa-build-stamp");
    if (!p || typeof fetch !== "function") return;
    fetch(withBase("/build.json"), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (b) {
        var sha = typeof b.sha === "string" ? b.sha : "";
        if (!/^[0-9a-f]{7,40}$/.test(sha)) return;
        while (p.firstChild) p.removeChild(p.firstChild);
        p.appendChild(document.createTextNode("deployed "));
        var a = document.createElement("a");
        a.href = (/^https:\/\//.test(b.runUrl || "") && safeHref(b.runUrl)) || "https://github.com/litlfred/folio-assistant/actions";
        var code = document.createElement("code");
        code.textContent = sha.slice(0, 7);
        a.appendChild(code);
        p.appendChild(a);
        if (typeof b.built === "string" && b.built) p.appendChild(document.createTextNode(" \u00b7 " + b.built));
      })
      .catch(function () { p.setAttribute("title", "build details unavailable"); });
  }

  /*
   * PIN ANY BLOCK, OF ANY GRAPH KIND, TO THE FOLIO — issue #982. Owner,
   * 2026-11-02: a bookmark icon in the block gutter puts *"a bookmark kind
   * [item] to the folio which is a link to the document at that point"*, and
   * *"user should also be able to add content blocks in general to folio so
   * they can return to them (e.g. glossary of a harness or ingested library,
   * a BPMN diagram, a FHIR resource instance, etc.)"* — *"any graph kind
   * really"*, *"core infra of the viewer/graph kind"*.
   *
   * So there is ONE contract, the same shape a library row uses, and no
   * per-kind code. Any rendered block declares itself:
   *
   *     <div data-fa-pin="<node IRI or page URL#anchor>"
   *          data-fa-pin-title="Health worker"
   *          data-fa-pin-href="<where opening it goes>"
   *          data-fa-pin-kind="bookmark | pin"          (default pin)
   *          data-fa-pin-node-kind="glossary"           (its graph kind)
   *          data-fa-pin-avatar="<the document's cover>"
   *          data-fa-pin-source="DTH-HRH">
   *       ... <button data-fa-pin-control>🔖</button> ...
   *
   * and a press on any `[data-fa-pin-control]` inside it toggles it on the
   * glass. A viewer that builds its controls in script (the block panel)
   * calls `window.faFolio.pin(key, meta)` instead of growing a second store.
   *
   * ON THE GLASS IT IS A LINK CARD (Q-BMK-1 = C): the avatar, the title and
   * where it came from, opening to `href`. Nothing of the block's own viewer
   * is loaded for it, so a glass holding many items of many kinds costs one
   * small card each (owner, 2026-11-02: *"lazy load all visualizers ... can
   * be a lot if lots of different item types"*).
   */
  var PIN_KINDS = { bookmark: 1, pin: 1 };

  function pinMetaOf(host) {
    var kind = host.getAttribute("data-fa-pin-kind");
    var key = host.getAttribute("data-fa-pin") || "";
    return {
      key: key,
      title: host.getAttribute("data-fa-pin-title") || key,
      href: safeHref(host.getAttribute("data-fa-pin-href") || undefined) || "",
      avatar: safeHref(host.getAttribute("data-fa-pin-avatar") || undefined) || "",
      kind: PIN_KINDS[kind] ? kind : "pin",
      nodeKind: host.getAttribute("data-fa-pin-node-kind") || "",
      source: host.getAttribute("data-fa-pin-source") || "",
    };
  }

  /** The store key of a pinned item: kind-prefixed, so it can never be read as a library `<instance>/<id>`. */
  function pinKeyOf(kind, key) {
    var k = String(key || "");
    return /^(bookmark|pin):/.test(k) ? k : (PIN_KINDS[kind] ? kind : "pin") + ":" + k;
  }

  /** Put it on the glass, or take it off when it is already there. Returns the new state. */
  function togglePin(key, meta) {
    var m = meta || {};
    if (!key) return "library";
    var k = pinKeyOf(m.kind, key);
    if (folioStateOf(k) === "glass") { shelveFromGlass(k); return "folio"; }
    displayInFolio(k, {
      title: m.title || key,
      href: safeHref(m.href || undefined) || "",
      avatar: safeHref(m.avatar || undefined) || "",
      kind: PIN_KINDS[m.kind] ? m.kind : "pin",
      nodeKind: m.nodeKind,
      source: m.source,
    });
    return "glass";
  }

  /** Every pin control shows its block's state, read from the store. */
  function paintBlockPins(root) {
    var r = root && root.querySelectorAll ? root : document;
    Array.prototype.forEach.call(r.querySelectorAll("[data-fa-pin-control]"), function (btn) {
      var host = btn.closest("[data-fa-pin]");
      var m = host ? pinMetaOf(host) : null;
      if (!m || !m.key) return;
      var on = folioStateOf(pinKeyOf(m.kind, m.key)) === "glass";
      var what = m.kind === "bookmark" ? "bookmark" : "pin";
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", (on ? "Remove the " + what + " of " : (what === "bookmark" ? "Bookmark " : "Pin ")) +
        m.title + (on ? " from your folio glass" : " to your folio glass"));
      btn.title = on ? "On your folio glass (press to take it off)" : (what === "bookmark" ? "Bookmark on your folio" : "Pin to your folio");
    });
  }

  function mountBlockPins() {
    if (document.__faPinsMounted) return;
    document.__faPinsMounted = true;
    // ONE delegated listener, for the same reason as the pull-outs (`ebvl`):
    // lazy pages and viewers fill their blocks after this runs.
    document.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest("[data-fa-pin-control]");
      if (!btn) return;
      var host = btn.closest("[data-fa-pin]");
      if (!host) return;
      ev.preventDefault();
      ev.stopPropagation();
      var m = pinMetaOf(host);
      togglePin(m.key, m);
    });
    document.addEventListener("fa:folio-changed", function () { paintBlockPins(); });
    paintBlockPins();
    function findPinCard(kindOrKey, maybeKey) {
      if (!glassLayer || !glassLayer.isConnected) return null;
      var k = maybeKey !== undefined ? pinKeyOf(kindOrKey, maybeKey) : String(kindOrKey || "");
      var cards = glassLayer.querySelectorAll(".fa-glass-asset");
      for (var i = 0; i < cards.length; i++) {
        var ak = cards[i].getAttribute("data-fa-asset") || "";
        if (ak === k || ak === "pin:" + k || ak === "bookmark:" + k) return cards[i];
      }
      return null;
    }
    window.faFolio = {
      pin: togglePin,
      stateOf: function (kind, key) { return folioStateOf(pinKeyOf(kind, key)); },
      paint: paintBlockPins,
      viewer: registerFolioViewer,
      openWindow: function (kindOrKey, maybeKey) {
        var c = findPinCard(kindOrKey, maybeKey);
        return c && typeof c.__faOpenWindow === "function" ? c.__faOpenWindow() : Promise.resolve(false);
      },
      closeWindow: function (kindOrKey, maybeKey) {
        var c = findPinCard(kindOrKey, maybeKey);
        if (c && typeof c.__faCloseWindow === "function") c.__faCloseWindow();
      },
    };
  }

  /**
   * THE BAR'S SEARCH IS A MAGNIFIER -- owner, 2026-11-10: "have styling
   * match who.int especially for language and search parts". On the
   * reference site the header shows a large magnifier, and the field opens
   * only when it is pressed. So a search box that sits in a page's own top
   * bar (`.fa-page-bar`: an IG's `.ig-search`, the site bar's theme
   * `.search`) is wrapped with a magnifier button that opens it as a panel
   * under the bar and closes it again (`l4zi`: the inverse is the same
   * control in the same place).
   *
   * MOVED, NEVER REBUILT, NEVER DETACHED: the box keeps its input, its
   * results and every handler bound to them, and stays in the document, so
   * a script that looks its input up by id still finds it. Closed is
   * `data-open="false"` on the wrapper and `display: none` in docs-ui.css.
   *
   * Idempotent: a box already wrapped is left alone.
   */
  function mountBarSearch() {
    var boxes = document.querySelectorAll(".fa-page-bar .ig-search, .fa-page-bar .search");
    Array.prototype.forEach.call(boxes, function (box, i) {
      if (box.parentNode && box.parentNode.classList && box.parentNode.classList.contains("fa-bar-search")) return;
      var input = box.querySelector("input");
      if (!input) return;
      if (!box.id) box.id = "fa-bar-search-box" + (i ? "-" + i : "");
      var wrap = el("span", { class: "fa-bar-search", "data-open": "false" });
      var toggle = chromeText(el("button", {
        type: "button",
        class: "fa-bar-search-toggle",
        "aria-label": "Search",
        "aria-expanded": "false",
        "aria-controls": box.id,
        title: "Search this site"
      }));
      toggle.innerHTML = BAR_SEARCH_GLYPH;
      box.parentNode.insertBefore(wrap, box);
      wrap.appendChild(toggle);
      wrap.appendChild(box);

      function paint(open, refocus) {
        wrap.setAttribute("data-open", open ? "true" : "false");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) input.focus();
        else if (refocus) toggle.focus();
      }
      toggle.addEventListener("click", function () {
        paint(wrap.getAttribute("data-open") !== "true", false);
      });
      wrap.addEventListener("keydown", function (e) {
        if (e.key !== "Escape" || wrap.getAttribute("data-open") !== "true") return;
        e.preventDefault();
        e.stopPropagation();
        paint(false, true);
      });
      document.addEventListener("click", function (e) {
        if (wrap.getAttribute("data-open") === "true" && !wrap.contains(e.target)) paint(false, false);
      });
    });
  }

  // The bar's magnifier: bolder than the band's, as the reference site's is.
  var BAR_SEARCH_GLYPH =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="3"/>' +
    '<path d="M15 15l5.5 5.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>' +
    "</svg>";

  function init() {
    // RTL detection — Arabic pages get dir="rtl" on <html> which
    // triggers the CSS rules in docs-ui.css for smooth sidebar slide.
    var meta = getTranslationMeta();
    if (followRememberedLocale(meta)) return;
    var pageLang = (meta && meta.lang) || "en";
    var RTL_LANGS = ["ar", "he", "fa", "ur"];
    if (RTL_LANGS.indexOf(pageLang) !== -1) {
      document.documentElement.setAttribute("dir", "rtl");
      document.documentElement.setAttribute("lang", pageLang);
    }

    // BEFORE the tiles and the rows: it adds the class the stylesheet keys the
    // close control on, and a control offered before its handler exists is a
    // control that does the wrong thing if pressed in that window.
    fillBuildStamp();
    mountNavPreference();
    // BEFORE the tiles: Page settings drops its own Discarded control when the
    // navbar already carries fsh-guts (#1925), and asks by looking for it.
    mountFshGutsNav();
    mountActionTiles();
    // AFTER the tiles: the row's launcher proxies that panel's button, so the
    // button has to exist before anything can click it.
    mountNavIconRow();
    // AGAIN, now that the row exists: the row's fsh-guts button is built by
    // `mountNavIconRow`, after the first call. Idempotent per button.
    mountFshGutsNav();
    // The theme sidebar's sections are the rail's now (see RETIRED above).
    // AFTER THE SITE INDEX, which is fetched rather than inlined since
    // 2026-10-02 — see the site-index block at the top of this file. It is the
    // ONE deferred call in this sequence: `mountNavLocale` sets attributes on
    // `.site-nav` and rewrites nav hrefs in place, and nothing below reads
    // what it wrote. `withSiteIndex` calls back synchronously once the fetch
    // has settled, so on a page carrying the island (every e2e fixture) or no
    // `<meta>` at all this runs exactly where it used to.
    //
    // It used to be ordered "before the badges: both read the same translation
    // metadata, and the nav is the thing a reader sees first". The badges read
    // `fa-translation-meta`, which is per-page and still inline, so that order
    // was a preference about paint rather than a dependency.
    withSiteIndex(mountNavLocale);
    mountTranslationBadges();
    mountTranslationStatusRows();
    mountQaPanels();
    paintQaBadges();
    // THE GLASS FIRST, and unconditionally. It is the reader's folio rather
    // than this page's furniture, so it must not inherit any of the guards
    // that decide whether a BOARD mounts — see `mountGlass`.
    // The old pin store becomes folio assets BEFORE the glass first paints.
    migratePinnedStickies();
    mountGlass();
    mountLandingHomes();
    mountLibraryPullouts();
    mountBlockPins();
    mountTodoStickies();
    // Before the picker: the magnifier comes first in the bar, then language.
    mountBarSearch();
    mountPageLanguageBar();
    mountTableFilters();
    // Figures are mounted only after the inlining settles, so the scan sees the
    // real <svg> rather than the <img> it replaces and does not wrap both.
    inlineDiagrams(mountFigures);
    // A diagram drawn LATER -- a Mermaid block rendered as it nears the
    // viewport (`_includes/components/mermaid.html`) -- says so, and gets its
    // controls then; the observer below stops watching after ten seconds.
    document.addEventListener("fa:figures-changed", remountSoon);

    // Mermaid renders AFTER this runs, and nothing tells us when.
    //
    // just-the-docs loads it as `<script type="module">` and calls
    // `mermaid.run()` after the dynamic import resolves, which is necessarily
    // later than DOMContentLoaded. So the single scan above sees a
    // `.language-mermaid` element holding source text and no <svg> at all --
    // which is why the diagrams on this site had no zoom, no full width and
    // no wrapper, while the BPMN figures (plain <img>, present in the HTML)
    // had all three. Re-scanning on a timer would work and would also be a
    // guess about how long the import takes.
    if (!("MutationObserver" in window)) return;
    var main = document.querySelector(".main-content") || document.body;
    var pending = null;
    var observer = new MutationObserver(function () {
      // Coalesce: Mermaid emits many mutations per diagram, and mountFigures
      // is idempotent but not free.
      if (pending !== null) return;
      pending = window.setTimeout(function () {
        pending = null;
        mountFigures();
      }, 50);
    });
    observer.observe(main, { childList: true, subtree: true });
    // Mermaid is the only thing expected to add a figure after load, so stop
    // watching once it has had its chance. An observer left on the document
    // body for the life of the page fires on every future DOM change,
    // including the ones mountFigures itself makes.
    window.setTimeout(function () { observer.disconnect(); }, 10000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
