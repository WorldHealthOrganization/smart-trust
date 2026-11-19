---
layout: null
---
// just-the-docs 0.12.0's own `assets/js/just-the-docs.js`, copied VERBATIM from
// the gem so this site's copy takes precedence over the theme's, with TWO
// changes, both bean `2tfy`: the search index is built on the reader's first
// focus of the search box instead of on every page load; and it is the index
// of the page's own SCOPE (issue #1972 — `search-split.ts`'s manifest), with a
// "Search everywhere" button that widens to the whole site, and a link to
// each identifier lookup the manifest names (bean `1br0`). A scope the
// manifest publishes with a PREBUILT index is loaded rather than built (bean
// `lrzn`).
//
// Why. Measured 2026-10-03 on a local build in headless Chromium: the theme
// fetched `search-data.json` (12,040 entries, 13.7 MB raw, 2.8 MB gzip) and
// built the lunr index on EVERY page view, costing ~4.7 s of main-thread script
// and ~315 MB of JS heap before anybody searched; with the index withheld the
// same page used 42 ms and 1 MB. A reader who never searches now pays nothing;
// one who does pays once, on that page, when they reach for it.
//
// Keeping it in step. `remote_theme` in `_config.yml` pins v0.12.0; when that
// pin moves, re-copy the new version's file and re-apply every hunk marked
// `2tfy`, `mm2n`, `1br0`, `lrzn` or `fa-theme-switch` (cat-harness#820) — `initSearch` and the helpers above it, the setter at the top of
// `searchLoaded`, and the focus trigger in `jtd.onReady`. Everything else must
// stay byte-identical to the gem.
(function (jtd, undefined) {

// Event handling

jtd.addEvent = function(el, type, handler) {
  if (el.attachEvent) el.attachEvent('on'+type, handler); else el.addEventListener(type, handler);
}
jtd.removeEvent = function(el, type, handler) {
  if (el.detachEvent) el.detachEvent('on'+type, handler); else el.removeEventListener(type, handler);
}
jtd.onReady = function(ready) {
  // in case the document is already rendered
  if (document.readyState!='loading') ready();
  // modern browsers
  else if (document.addEventListener) document.addEventListener('DOMContentLoaded', ready);
  // IE <= 8
  else document.attachEvent('onreadystatechange', function(){
      if (document.readyState=='complete') ready();
  });
}

// Show/hide mobile menu

function initNav() {
  jtd.addEvent(document, 'click', function(e){
    var target = e.target;
    while (target && !(target.classList && target.classList.contains('nav-list-expander'))) {
      target = target.parentNode;
    }
    if (target) {
      e.preventDefault();
      target.ariaExpanded = target.parentNode.classList.toggle('active');
    }
  });

  const siteNav = document.getElementById('site-nav');
  const mainHeader = document.getElementById('main-header');
  const menuButton = document.getElementById('menu-button');

  disableHeadStyleSheets();

  jtd.addEvent(menuButton, 'click', function(e){
    e.preventDefault();

    if (menuButton.classList.toggle('nav-open')) {
      siteNav.classList.add('nav-open');
      mainHeader.classList.add('nav-open');
      menuButton.ariaExpanded = true;
    } else {
      siteNav.classList.remove('nav-open');
      mainHeader.classList.remove('nav-open');
      menuButton.ariaExpanded = false;
    }
  });

  {%- if site.search_enabled != false and site.search.button %}
  const searchInput = document.getElementById('search-input');
  const searchButton = document.getElementById('search-button');

  jtd.addEvent(searchButton, 'click', function(e){
    e.preventDefault();

    mainHeader.classList.add('nav-open');
    searchInput.focus();
  });
  {%- endif %}
}

// The <head> element is assumed to include the following stylesheets:
// - a <link> to /assets/css/just-the-docs-head-nav.css,
//             with id 'jtd-head-nav-stylesheet'
// - a <style> containing the result of _includes/css/activation.scss.liquid.
// To avoid relying on the order of stylesheets (which can change with HTML
// compression, user-added JavaScript, and other side effects), stylesheets
// are only interacted with via ID

function disableHeadStyleSheets() {
  const headNav = document.getElementById('jtd-head-nav-stylesheet');
  if (headNav) {
    headNav.disabled = true;
  }

  const activation = document.getElementById('jtd-nav-activation');
  if (activation) {
    activation.disabled = true;
  }
}

{%- if site.search_enabled != false %}
// Site search

// 2tfy (#1972 step A): load the page's SCOPE of the index, not the whole site.
// `search-split.ts` writes `assets/js/search/manifest.json` and one index per
// scope after the build; this reads it, picks the scope the page lives in by
// the same rule (instance, `<kind>/<instance>`, target locale, a platform
// section over the split's budget — bean `mm2n` — else platform), and loads
// only that. No manifest, or one that cannot be read:
// the whole index, exactly as the theme always did.
function searchUrl(path) {
  return '{{ "/" | relative_url }}'.replace(/\/?$/, '/') + String(path).replace(/^\//, '');
}

function scopeForPage(manifest) {
  var base = '{{ "/" | relative_url }}'.replace(/\/?$/, '/');
  var path = window.location.pathname;
  if (path.indexOf(base) === 0) path = path.slice(base.length);
  var seg = path.split('/').filter(function(s){ return s.length > 0; });
  var byId = {}, platform = null;
  (manifest.scopes || []).forEach(function(s){ byId[s.id] = s; if (s.kind === 'platform') platform = s; });
  var isInstance = function(id){ return byId[id] && byId[id].kind === 'instance'; };
  if (seg[0] && isInstance(seg[0])) return byId[seg[0]];
  if (seg[0] && byId['locale-' + seg[0]]) return byId['locale-' + seg[0]];
  if (seg[1] && isInstance(seg[1])) return byId[seg[1]];
  // mm2n: a platform section over the split's budget has a scope of its own.
  // Same rule as `sectionOfPath` in search-split.ts: below the section, or its
  // index (a path ending in `/`).
  var section = seg[0] && (seg.length > 1 || /\/$/.test(path)) ? byId['section-' + seg[0]] : null;
  if (section && section.kind === 'section') return section;
  return platform;
}

function getJson(url, done) {
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.onload = function(){
    if (request.status >= 200 && request.status < 400) {
      try { done(JSON.parse(request.responseText)); } catch (e) { done(null); }
    } else {
      console.log('Error loading ajax request. Request status:' + request.status);
      done(null);
    }
  };
  request.onerror = function(){
    console.log('There was a connection error');
    done(null);
  };
  request.send();
}

function setSearchSeparator() {
  lunr.tokenizer.separator = {{ site.search.tokenizer_separator | default: site.search_tokenizer_separator | default: "/[\s\-/]+/" }}
}

// lrzn: a scope the manifest publishes with a prebuilt index is LOADED, not
// built — 5–8× less script on first search. `search-split.ts`'s `buildIndex`
// is the server's copy of `buildSearchIndex` below; keep the two in step.
// The separator still has to be set: it tokenizes the reader's query.
function loadSearchIndex(serialized) {
  setSearchSeparator();
  return lunr.Index.load(serialized);
}

function buildSearchIndex(docs) {
  setSearchSeparator();

  return lunr(function(){
    this.ref('id');
    this.field('title', { boost: 200 });
    this.field('content', { boost: 2 });
    {%- if site.search.rel_url != false %}
    this.field('relUrl');
    {%- endif %}
    this.metadataWhitelist = ['position']

    for (var i in docs) {
      {% include lunr/custom-index.js %}
      this.add({
        id: i,
        title: docs[i].title,
        content: docs[i].content,
        {%- if site.search.rel_url != false %}
        relUrl: docs[i].relUrl
        {%- endif %}
      });
    }
  });
}

// 2tfy: the reader focused the box (and may have typed) BEFORE the index was
// ready; the theme's focus handler runs the search on whatever is in the box,
// so replay it once.
function replaySearch() {
  var input = document.getElementById('search-input');
  if (input && (document.activeElement === input || input.value)) {
    input.dispatchEvent(new Event('focus'));
  }
}

// 2tfy: a scoped search can always be widened to the whole site — nothing that
// was findable before the split becomes unfindable. One button under the
// results; pressing it loads the whole index once and re-runs the query.
function offerEverywhere(manifest, scope) {
  var results = document.getElementById('search-results');
  if (!results || !manifest.source) return;
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'search-everywhere btn btn-outline';
  var mb = (manifest.source.bytes / 1e6).toFixed(1);
  button.textContent = 'Search everywhere (' + manifest.source.entries + ' entries, ' + mb + ' MB) — now searching ' + scope.id;
  button.addEventListener('click', function(){
    button.disabled = true;
    button.textContent = 'Loading the whole site index…';
    getJson(searchUrl(manifest.source.path), function(docs){
      if (!docs) { button.disabled = false; button.textContent = 'Search everywhere — could not load, try again'; return; }
      jtd.replaceSearchIndex(buildSearchIndex(docs), docs);
      button.remove();
      document.getElementById('search-input').focus();
      replaySearch();
    });
  });
  results.parentNode.insertBefore(button, results.nextSibling);
}

// 1br0 (#1972 step 3): an identifier lookup is a page of its own, never
// loaded here (the owner's ruling on bean `4pm8`). Each one the manifest
// names gets one link under the results, carrying the reader's query so the
// lookup opens with it already run.
function offerRemote(manifest) {
  var results = document.getElementById('search-results');
  var input = document.getElementById('search-input');
  if (!results || !input || !manifest.remote || !manifest.remote.length) return;
  var box = document.createElement('div');
  box.className = 'search-remote';
  var links = manifest.remote.map(function(r){
    var a = document.createElement('a');
    a.className = 'search-remote-link';
    a.textContent = 'Look up an identifier in ' + r.id + ' (' + r.entries + ' referenced entries) →';
    a.setAttribute('data-base', searchUrl(r.href));
    box.appendChild(a);
    return a;
  });
  var refresh = function(){
    var q = input.value.trim();
    links.forEach(function(a){ a.href = a.getAttribute('data-base') + (q ? '&q=' + encodeURIComponent(q) : ''); });
  };
  input.addEventListener('input', refresh);
  refresh();
  results.parentNode.appendChild(box);
}

function initSearch() {
  getJson(searchUrl('assets/js/search/manifest.json'), function(manifest){
    var scope = manifest ? scopeForPage(manifest) : null;
    var url = scope ? searchUrl(scope.path) : '{{ "assets/js/search-data.json" | relative_url }}';
    var ready = function(index, docs){
      searchLoaded(index, docs);
      replaySearch();
      if (scope && scope.entries < manifest.source.entries) offerEverywhere(manifest, scope);
      if (manifest) offerRemote(manifest);
    };
    getJson(url, function(docs){
      if (!docs) return;
      if (!scope || !scope.index) return ready(buildSearchIndex(docs), docs);
      // lrzn: an index that fails to load is rebuilt from the entries in hand.
      getJson(searchUrl(scope.index.path), function(serialized){
        var index = null;
        if (serialized) { try { index = loadSearchIndex(serialized); } catch (e) { index = null; } }
        ready(index || buildSearchIndex(docs), docs);
      });
    });
  });
}

function searchLoaded(index, docs) {
  var index = index;
  var docs = docs;
  // 2tfy: let "Search everywhere" swap in the whole index without binding the
  // handlers below a second time — they read `index` and `docs` from here.
  // `currentInput` is cleared too: `update` skips a query equal to the last
  // one, and the point of widening is to run the SAME query on more pages.
  jtd.replaceSearchIndex = function(newIndex, newDocs) { index = newIndex; docs = newDocs; currentInput = undefined; };
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  var mainHeader = document.getElementById('main-header');
  var currentInput;
  var currentSearchIndex = 0;

  {%- if site.search.focus_shortcut_key %}
  // add event listener on ctrl + <focus_shortcut_key> for showing the search input
  jtd.addEvent(document, 'keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === '{{ site.search.focus_shortcut_key }}') {
      e.preventDefault();

      mainHeader.classList.add('nav-open');
      searchInput.focus();
    }
  });
  {%- endif %}

  function showSearch() {
    document.documentElement.classList.add('search-active');
  }

  function hideSearch() {
    document.documentElement.classList.remove('search-active');
  }

  function update() {
    currentSearchIndex++;

    var input = searchInput.value;
    if (input === '') {
      hideSearch();
    } else {
      showSearch();
      // scroll search input into view, workaround for iOS Safari
      window.scroll(0, -1);
      setTimeout(function(){ window.scroll(0, 0); }, 0);
    }
    if (input === currentInput) {
      return;
    }
    currentInput = input;
    searchResults.innerHTML = '';
    if (input === '') {
      return;
    }

    var results = index.query(function (query) {
      var tokens = lunr.tokenizer(input)
      query.term(tokens, {
        boost: 10
      });
      query.term(tokens, {
        wildcard: lunr.Query.wildcard.TRAILING
      });
    });

    if ((results.length == 0) && (input.length > 2)) {
      var tokens = lunr.tokenizer(input).filter(function(token, i) {
        return token.str.length < 20;
      })
      if (tokens.length > 0) {
        results = index.query(function (query) {
          query.term(tokens, {
            editDistance: Math.round(Math.sqrt(input.length / 2 - 1))
          });
        });
      }
    }

    if (results.length == 0) {
      var noResultsDiv = document.createElement('div');
      noResultsDiv.classList.add('search-no-result');
      noResultsDiv.innerText = 'No results found';
      searchResults.appendChild(noResultsDiv);

    } else {
      var resultsList = document.createElement('ul');
      resultsList.classList.add('search-results-list');
      searchResults.appendChild(resultsList);

      addResults(resultsList, results, 0, 10, 100, currentSearchIndex);
    }

    function addResults(resultsList, results, start, batchSize, batchMillis, searchIndex) {
      if (searchIndex != currentSearchIndex) {
        return;
      }
      for (var i = start; i < (start + batchSize); i++) {
        if (i == results.length) {
          return;
        }
        addResult(resultsList, results[i]);
      }
      setTimeout(function() {
        addResults(resultsList, results, start + batchSize, batchSize, batchMillis, searchIndex);
      }, batchMillis);
    }

    function addResult(resultsList, result) {
      var doc = docs[result.ref];

      var resultsListItem = document.createElement('li');
      resultsListItem.classList.add('search-results-list-item');
      resultsList.appendChild(resultsListItem);

      var resultLink = document.createElement('a');
      resultLink.classList.add('search-result');
      resultLink.setAttribute('href', doc.url);
      resultsListItem.appendChild(resultLink);

      var resultTitle = document.createElement('div');
      resultTitle.classList.add('search-result-title');
      resultLink.appendChild(resultTitle);

      // note: the SVG svg-doc is only loaded as a Jekyll include if site.search_enabled is true; see _includes/icons/icons.html
      var resultDoc = document.createElement('div');
      resultDoc.classList.add('search-result-doc');
      resultDoc.innerHTML = '<svg viewBox="0 0 24 24" class="search-result-icon" aria-hidden="true"><use xlink:href="#svg-doc"></use></svg>';
      resultTitle.appendChild(resultDoc);

      var resultDocTitle = document.createElement('div');
      resultDocTitle.classList.add('search-result-doc-title');
      resultDocTitle.innerHTML = doc.doc;
      resultDoc.appendChild(resultDocTitle);
      var resultDocOrSection = resultDocTitle;

      if (doc.doc != doc.title) {
        resultDoc.classList.add('search-result-doc-parent');
        var resultSection = document.createElement('div');
        resultSection.classList.add('search-result-section');
        resultSection.innerHTML = doc.title;
        resultTitle.appendChild(resultSection);
        resultDocOrSection = resultSection;
      }

      var metadata = result.matchData.metadata;
      var titlePositions = [];
      var contentPositions = [];
      for (var j in metadata) {
        var meta = metadata[j];
        if (meta.title) {
          var positions = meta.title.position;
          for (var k in positions) {
            titlePositions.push(positions[k]);
          }
        }
        if (meta.content) {
          var positions = meta.content.position;
          for (var k in positions) {
            var position = positions[k];
            var previewStart = position[0];
            var previewEnd = position[0] + position[1];
            var ellipsesBefore = true;
            var ellipsesAfter = true;
            for (var k = 0; k < {{ site.search.preview_words_before | default: 5 }}; k++) {
              var nextSpace = doc.content.lastIndexOf(' ', previewStart - 2);
              var nextDot = doc.content.lastIndexOf('. ', previewStart - 2);
              if ((nextDot >= 0) && (nextDot > nextSpace)) {
                previewStart = nextDot + 1;
                ellipsesBefore = false;
                break;
              }
              if (nextSpace < 0) {
                previewStart = 0;
                ellipsesBefore = false;
                break;
              }
              previewStart = nextSpace + 1;
            }
            for (var k = 0; k < {{ site.search.preview_words_after | default: 10 }}; k++) {
              var nextSpace = doc.content.indexOf(' ', previewEnd + 1);
              var nextDot = doc.content.indexOf('. ', previewEnd + 1);
              if ((nextDot >= 0) && (nextDot < nextSpace)) {
                previewEnd = nextDot;
                ellipsesAfter = false;
                break;
              }
              if (nextSpace < 0) {
                previewEnd = doc.content.length;
                ellipsesAfter = false;
                break;
              }
              previewEnd = nextSpace;
            }
            contentPositions.push({
              highlight: position,
              previewStart: previewStart, previewEnd: previewEnd,
              ellipsesBefore: ellipsesBefore, ellipsesAfter: ellipsesAfter
            });
          }
        }
      }

      if (titlePositions.length > 0) {
        titlePositions.sort(function(p1, p2){ return p1[0] - p2[0] });
        resultDocOrSection.innerHTML = '';
        addHighlightedText(resultDocOrSection, doc.title, 0, doc.title.length, titlePositions);
      }

      if (contentPositions.length > 0) {
        contentPositions.sort(function(p1, p2){ return p1.highlight[0] - p2.highlight[0] });
        var contentPosition = contentPositions[0];
        var previewPosition = {
          highlight: [contentPosition.highlight],
          previewStart: contentPosition.previewStart, previewEnd: contentPosition.previewEnd,
          ellipsesBefore: contentPosition.ellipsesBefore, ellipsesAfter: contentPosition.ellipsesAfter
        };
        var previewPositions = [previewPosition];
        for (var j = 1; j < contentPositions.length; j++) {
          contentPosition = contentPositions[j];
          if (previewPosition.previewEnd < contentPosition.previewStart) {
            previewPosition = {
              highlight: [contentPosition.highlight],
              previewStart: contentPosition.previewStart, previewEnd: contentPosition.previewEnd,
              ellipsesBefore: contentPosition.ellipsesBefore, ellipsesAfter: contentPosition.ellipsesAfter
            }
            previewPositions.push(previewPosition);
          } else {
            previewPosition.highlight.push(contentPosition.highlight);
            previewPosition.previewEnd = contentPosition.previewEnd;
            previewPosition.ellipsesAfter = contentPosition.ellipsesAfter;
          }
        }

        var resultPreviews = document.createElement('div');
        resultPreviews.classList.add('search-result-previews');
        resultLink.appendChild(resultPreviews);

        var content = doc.content;
        for (var j = 0; j < Math.min(previewPositions.length, {{ site.search.previews | default: 3 }}); j++) {
          var position = previewPositions[j];

          var resultPreview = document.createElement('div');
          resultPreview.classList.add('search-result-preview');
          resultPreviews.appendChild(resultPreview);

          if (position.ellipsesBefore) {
            resultPreview.appendChild(document.createTextNode('... '));
          }
          addHighlightedText(resultPreview, content, position.previewStart, position.previewEnd, position.highlight);
          if (position.ellipsesAfter) {
            resultPreview.appendChild(document.createTextNode(' ...'));
          }
        }
      }

      {%- if site.search.rel_url != false %}
      var resultRelUrl = document.createElement('span');
      resultRelUrl.classList.add('search-result-rel-url');
      resultRelUrl.innerText = doc.relUrl;
      resultTitle.appendChild(resultRelUrl);
      {%- endif %}
    }

    function addHighlightedText(parent, text, start, end, positions) {
      var index = start;
      for (var i in positions) {
        var position = positions[i];
        var span = document.createElement('span');
        span.innerHTML = text.substring(index, position[0]);
        parent.appendChild(span);
        index = position[0] + position[1];
        var highlight = document.createElement('span');
        highlight.classList.add('search-result-highlight');
        highlight.innerHTML = text.substring(position[0], index);
        parent.appendChild(highlight);
      }
      var span = document.createElement('span');
      span.innerHTML = text.substring(index, end);
      parent.appendChild(span);
    }
  }

  jtd.addEvent(searchInput, 'focus', function(){
    setTimeout(update, 0);
  });

  // When the search bar is *not* focused, it should be hidden. This code
  // manages that - which is a bit tricky given that we can't just rely on
  // focusout, since we could be re-focusing within the search itself.
  const updateSearchFocus = function(evt) {
    const nextFocusedElement = evt.relatedTarget;

    // Re-focusing on search bar - "keep focus"
    if (nextFocusedElement.id === 'search-input') return;

    // Re-focusing on the next search result element - "keep focus"
    if (nextFocusedElement.classList.contains('search-result')) return;

    // Otherwise, we're not focused on the search bar anymore. Hide!
    hideSearch();
  }

  searchInput.addEventListener('focusout', updateSearchFocus);
  searchResults.addEventListener('focusout', updateSearchFocus);

  jtd.addEvent(searchInput, 'keyup', function(e){
    switch (e.keyCode) {
      case 27: // When esc key is pressed, hide the results and clear the field
        searchInput.value = '';
        break;
      case 38: // arrow up
      case 40: // arrow down
      case 13: // enter
        e.preventDefault();
        return;
    }
    update();
  });

  jtd.addEvent(searchInput, 'keydown', function(e){
    switch (e.keyCode) {
      case 38: // arrow up
        e.preventDefault();
        var active = document.querySelector('.search-result.active');
        if (active) {
          active.classList.remove('active');
          if (active.parentElement.previousSibling) {
            var previous = active.parentElement.previousSibling.querySelector('.search-result');
            previous.classList.add('active');
          }
        }
        return;
      case 40: // arrow down
        e.preventDefault();
        var active = document.querySelector('.search-result.active');
        if (active) {
          if (active.parentElement.nextSibling) {
            var next = active.parentElement.nextSibling.querySelector('.search-result');
            active.classList.remove('active');
            next.classList.add('active');
          }
        } else {
          var next = document.querySelector('.search-result');
          if (next) {
            next.classList.add('active');
          }
        }
        return;
      case 13: // enter
        e.preventDefault();
        var active = document.querySelector('.search-result.active');
        if (active) {
          active.click();
        } else {
          var first = document.querySelector('.search-result');
          if (first) {
            first.click();
          }
        }
        return;
    }
  });

  jtd.addEvent(document, 'click', function(e){
    if (e.target != searchInput) {
      hideSearch();
    }
  });
}
{%- endif %}

// Switch theme

// fa-theme-switch:begin (cat-harness#820)
// The gem's setTheme rewrites the first stylesheet's href. That unloads the
// sheet painting the page, and a script-set href does not hold paint, so the
// page shows unstyled (serif text, a page-wide search icon) until the new file
// arrives. Here the new sheet loads BESIDE the old one, render-blocking while
// the head parses, and the old one goes only once the new one has loaded.
// getTheme reports a sheet still loading, so a second call does not swap again.
jtd.getTheme = function() {
  var pending = document.querySelector('link[data-jtd-theme-pending]');
  var cssFileHref = (pending || document.querySelector('[rel="stylesheet"]')).getAttribute('href');
  return cssFileHref.substring(cssFileHref.lastIndexOf('-') + 1, cssFileHref.length - 4);
}

jtd.setTheme = function(theme) {
  var href = '{{ "assets/css/just-the-docs-" | relative_url }}' + theme + '.css';
  var pending = document.querySelector('link[data-jtd-theme-pending]');
  if (pending) pending.parentNode.removeChild(pending);
  var cssFile = document.querySelector('[rel="stylesheet"]');
  if (cssFile.getAttribute('href') === href) return;
  var next = document.createElement('link');
  next.rel = 'stylesheet';
  next.setAttribute('data-jtd-theme-pending', '');
  if (document.readyState === 'loading') next.setAttribute('blocking', 'render');
  next.onload = function() {
    next.removeAttribute('data-jtd-theme-pending');
    next.removeAttribute('blocking');
    if (cssFile.parentNode) cssFile.parentNode.removeChild(cssFile);
  };
  next.onerror = function() {
    if (next.parentNode) next.parentNode.removeChild(next);
  };
  next.href = href;
  cssFile.parentNode.insertBefore(next, cssFile.nextSibling);
}
// fa-theme-switch:end

// Note: pathname can have a trailing slash on a local jekyll server
// and not have the slash on GitHub Pages

function navLink() {
  var pathname = document.location.pathname;

  var navLink = document.getElementById('site-nav').querySelector('a[href="' + pathname + '"]');
  if (navLink) {
    return navLink;
  }

  // The `permalink` setting may produce navigation links whose `href` ends with `/` or `.html`.
  // To find these links when `/` is omitted from or added to pathname, or `.html` is omitted:

  if (pathname.endsWith('/') && pathname != '/') {
    pathname = pathname.slice(0, -1);
  }

  if (pathname != '/') {
    navLink = document.getElementById('site-nav').querySelector('a[href="' + pathname + '"], a[href="' + pathname + '/"], a[href="' + pathname + '.html"]');
    if (navLink) {
      return navLink;
    }
  }

  return null; // avoids `undefined`
}

// Scroll site-nav to ensure the link to the current page is visible

function scrollNav() {
  const targetLink = navLink();
  if (targetLink) {
    targetLink.scrollIntoView({ block: "center" });
    targetLink.removeAttribute('href');
  }
}

// Find the nav-list-link that refers to the current page
// then make it and all enclosing nav-list-item elements active.

function activateNav() {
  var target = navLink();
  if (target) {
    target.classList.toggle('active', true);
  }
  while (target) {
    while (target && !(target.classList && target.classList.contains('nav-list-item'))) {
      target = target.parentNode;
    }
    if (target) {
      target.classList.toggle('active', true);
      target = target.parentNode;
    }
  }
}

// Document ready

jtd.onReady(function(){
  if (document.getElementById('site-nav')) {
    initNav();
    activateNav();
    scrollNav();
  }
  {%- if site.search_enabled != false %}
  // 2tfy: build the index on first focus of the search box, not on load.
  var lazySearchInput = document.getElementById('search-input');
  if (lazySearchInput) {
    var lazySearchStarted = false;
    jtd.addEvent(lazySearchInput, 'focus', function(){
      if (lazySearchStarted) return;
      lazySearchStarted = true;
      initSearch();
    });
  }
  {%- endif %}
});

// Accessibility: set tabindex=0 on each code highlight block, so screenreaders
// can focus over (particularly important if there's horizontal scroll)
// see: https://dequeuniversity.com/rules/axe/4.9/scrollable-region-focusable?application=axeAPI

jtd.onReady(() => {
  document
    .querySelectorAll("div.highlight")
    .forEach(codeBlock => codeBlock.setAttribute("tabindex", "0"));
});

// Copy button on code

{%- if site.enable_copy_code_button != false %}

jtd.onReady(function(){

  if (!window.isSecureContext) {
    console.log('Window does not have a secure context, therefore code clipboard copy functionality will not be available. For more details see https://web.dev/async-clipboard/#security-and-permissions');
    return;
  }

  var codeBlocks = document.querySelectorAll('div.highlighter-rouge, div.listingblock > div.content, figure.highlight');

  // note: the SVG svg-copied and svg-copy is only loaded as a Jekyll include if site.enable_copy_code_button is true; see _includes/icons/icons.html
  var svgCopied =  '<svg viewBox="0 0 24 24" class="copy-icon"><use xlink:href="#svg-copied"></use></svg>';
  var svgCopy =  '<svg viewBox="0 0 24 24" class="copy-icon"><use xlink:href="#svg-copy"></use></svg>';

  codeBlocks.forEach(codeBlock => {
    var copyButton = document.createElement('button');
    var timeout = null;
    copyButton.type = 'button';
    copyButton.ariaLabel = 'Copy code to clipboard';
    copyButton.innerHTML = svgCopy;
    codeBlock.append(copyButton);

    copyButton.addEventListener('click', function () {
      if(timeout === null) {
        var code = (codeBlock.querySelector('pre:not(.lineno, .highlight)') || codeBlock.querySelector('code')).innerText;
        window.navigator.clipboard.writeText(code);

        copyButton.innerHTML = svgCopied;

        var timeoutSetting = 4000;

        timeout = setTimeout(function () {
          copyButton.innerHTML = svgCopy;
          timeout = null;
        }, timeoutSetting);
      }
    });
  });

});

{%- endif %}

})(window.jtd = window.jtd || {});

{% include js/custom.js %}
