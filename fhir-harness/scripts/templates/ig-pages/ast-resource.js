/*
 * ast-resource.js: the one shared loader for an artefact page drawn from the
 * IG Publisher AST cache (skill `visualizer-loading`, bean `wnhh`).
 *
 * The page carries identity, layout and a POINTER: a `[data-ast-src]` element
 * naming the resource's JSON in the restored AST, relative to the page. This
 * fetches it and shows what the Publisher's own resource page shows:
 *
 *   - the narrative (`text.div`), the Publisher's generated XHTML. First
 *     checked against the publish gate's injection rules (fhir-harness#330):
 *     a narrative that breaks one is shown as text under a warning, never
 *     rendered. Then sanitised: no script, no event handler, no
 *     `javascript:` URL;
 *     Its relative links name the Publisher's pages: one naming a page this
 *     site has (`data-ast-pages`, a list fetched once) stays; any other goes to
 *     the published IG (`data-ast-published`), or loses its href when there is
 *     none. A `file:` URL is a path on the machine that ran the build and is
 *     dropped — 29 in smart-trust, measured 2026-10-02;
 *   - the resource as `JSON.stringify(parsed, null, 2)`, as the Publisher's
 *     JSON view does, never the file's own bytes.
 *
 * `data-ast-view="json"` draws the JSON alone: an artefact's JSON tab page
 * (`ig-thin-pages.ts`, owner 2026-10-14: "3. Render them too").
 *
 * Three states, always visible: loading, loaded, and could-not-load naming the
 * file and the error. Completion is signalled for print and PDF: each load
 * counts itself in and out of `window.__kgLoads`, and the last to finish sets
 * `<html data-kg-loaded>`, on success or failure.
 *
 * No dependencies: `fetch`, `DOMParser` and `textContent` are the whole loader.
 */
(function () {
  "use strict";

  var DROP = { SCRIPT: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1, META: 1, BASE: 1, FORM: 1 };

  // The page's shared load counter, the object every loader on it uses
  // (kg-render.js, ig-footer.js, ...): the last to finish marks the page loaded.
  function loads() {
    return (window.__kgLoads = window.__kgLoads || {
      pending: 0,
      done: function () {
        if (--this.pending === 0) document.documentElement.setAttribute("data-kg-loaded", "");
      },
    });
  }

  /*
   * The injection rules (fhir-harness#330): the same list as
   * `ig-content-qa.ts` INJECTION_RULES, which the publish gate runs, held
   * equal by `ig-content-qa.test.ts`. A narrative that breaks one is shown
   * as text with a warning and never rendered; the sanitiser stays behind it.
   */
  // INJECTION_RULES:BEGIN
  var INJECTION_RULES = [
    {"id":"script-tag","source":"<script\\b","flags":"i","says":"a <script> element"},
    {"id":"iframe-tag","source":"<iframe\\b","flags":"i","says":"an <iframe> element"},
    {"id":"object-tag","source":"<object\\b","flags":"i","says":"an <object> element"},
    {"id":"embed-tag","source":"<embed\\b","flags":"i","says":"an <embed> element"},
    {"id":"form-tag","source":"<form\\b","flags":"i","says":"a <form> element"},
    {"id":"base-tag","source":"<base\\b","flags":"i","says":"a <base> element"},
    {"id":"meta-http-equiv","source":"<meta\\b[^>]*http-equiv","flags":"i","says":"a <meta http-equiv> element"},
    {"id":"event-handler","source":"<[a-z][a-z0-9:-]*\\b[^>]*[\\s/\"']on[a-z]+\\s*=","flags":"i","says":"an on* event handler attribute"},
    {"id":"script-url","source":"(?:=\\s*[\"']?|\\]\\(\\s*<?|<|url\\(\\s*[\"']?)\\s*(?:javascript|vbscript|livescript)\\s*:","flags":"i","says":"a javascript:/vbscript: URL"},
    {"id":"data-html-url","source":"data\\s*:\\s*(?:text/html|application/xhtml\\+xml)","flags":"i","says":"a data: URL carrying HTML"},
    {"id":"srcdoc","source":"<[a-z][a-z0-9:-]*\\b[^>]*[\\s/\"']srcdoc\\s*=","flags":"i","says":"an srcdoc attribute"},
    {"id":"css-expression","source":"expression\\s*\\(","flags":"i","says":"a CSS expression()"},
    {"id":"bidi-control","source":"[\\u202A-\\u202E\\u2066-\\u2069]","flags":"","says":"a Unicode bidirectional control character"}
  ];
  // INJECTION_RULES:END

  var NAMED = { colon: ":", tab: "\t", newline: "\n", lpar: "(", rpar: ")", lt: "<", gt: ">", quot: "\"", apos: "'", amp: "&", sol: "/" };

  /* The text as a browser reads it: character references decoded twice, and tabs and newlines dropped. */
  function decoded(text) {
    var t = text;
    for (var i = 0; i < 2; i++) {
      t = t
        .replace(/&#x([0-9a-f]+);?/gi, function (_, h) {
          return String.fromCodePoint(parseInt(h, 16) % 0x110000);
        })
        .replace(/&#(\d+);?/g, function (_, d) {
          return String.fromCodePoint(parseInt(d, 10) % 0x110000);
        })
        .replace(/&([a-z]+);/gi, function (m, n) {
          return NAMED[n.toLowerCase()] || m;
        });
    }
    return t.replace(/[\t\n\r\0]+/g, "");
  }

  /* The rules a text breaks, by what each says. */
  function injectionHits(text) {
    var forms = [text, decoded(text)];
    var out = [];
    for (var i = 0; i < INJECTION_RULES.length; i++) {
      var re = new RegExp(INJECTION_RULES[i].source, INJECTION_RULES[i].flags);
      if (re.test(forms[0]) || re.test(forms[1])) out.push(INJECTION_RULES[i].says);
    }
    return out;
  }

  /* A flagged narrative: a warning, then its source as text. */
  function flagged(div, hits) {
    var holder = document.createElement("div");
    holder.className = "ast-narrative ast-narrative-flagged";
    var warn = document.createElement("p");
    warn.className = "ast-state ast-error";
    warn.setAttribute("role", "alert");
    warn.textContent = "This narrative was not rendered: it carries " + hits.join(", ") + ". Its source is shown as text.";
    var pre = document.createElement("pre");
    pre.textContent = div;
    holder.appendChild(warn);
    holder.appendChild(pre);
    return holder;
  }

  function begin() {
    loads().pending++;
  }
  function end() {
    loads().done();
  }

  function sanitise(node) {
    for (var i = node.childNodes.length - 1; i >= 0; i--) {
      var c = node.childNodes[i];
      if (c.nodeType !== 1) continue;
      if (DROP[c.tagName.toUpperCase()]) {
        node.removeChild(c);
        continue;
      }
      for (var j = c.attributes.length - 1; j >= 0; j--) {
        var a = c.attributes[j];
        var n = a.name.toLowerCase();
        if (n.indexOf("on") === 0) c.removeAttribute(a.name);
        else if ((n === "href" || n === "src" || n === "xlink:href") && /^\s*javascript:/i.test(a.value)) c.removeAttribute(a.name);
      }
      sanitise(c);
    }
    return node;
  }

  function narrative(resource) {
    var div = resource && resource.text && resource.text.div;
    if (typeof div !== "string" || !div.trim()) return null;
    var hits = injectionHits(div);
    if (hits.length) return { flagged: flagged(div, hits) };
    var doc = new DOMParser().parseFromString(div, "text/html");
    var holder = document.createElement("div");
    holder.className = "ast-narrative";
    // adoptNode MOVES each child out of the parsed document; importNode would
    // copy it and leave the list as long as it was, looping forever.
    while (doc.body.firstChild) holder.appendChild(document.adoptNode(doc.body.firstChild));
    return sanitise(holder);
  }

  var localPages = {};

  function pagesFrom(url) {
    if (!url) return Promise.resolve(null);
    if (!localPages[url]) {
      localPages[url] = fetch(url)
        .then(function (r) {
          return r.ok ? r.json() : [];
        })
        .then(function (list) {
          var set = {};
          for (var i = 0; i < list.length; i++) set[list[i]] = 1;
          return set;
        })
        .catch(function () {
          return {};
        });
    }
    return localPages[url];
  }

  function relink(node, local, published) {
    var els = node.querySelectorAll("[href],[src]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var attr = el.hasAttribute("href") ? "href" : "src";
      var v = el.getAttribute(attr);
      if (/^\s*file:/i.test(v)) {
        el.removeAttribute(attr);
        continue;
      }
      if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(v)) continue;
      if (local && local[v.split("#")[0]]) continue;
      // A site-relative base (`/<repo>/`, an IG site's own address) resolves against the page.
      if (published) el.setAttribute(attr, new URL(v, new URL(published, location.href)).href);
      else el.removeAttribute(attr);
    }
    return node;
  }

  function heading(text) {
    var h = document.createElement("h3");
    h.textContent = text;
    return h;
  }

  function load(el) {
    var src = el.getAttribute("data-ast-src");
    var state = el.querySelector(".ast-state");
    var local = null;
    begin();
    pagesFrom(el.getAttribute("data-ast-pages"))
      .then(function (set) {
        local = set;
        return fetch(src);
      })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (resource) {
        var frag = document.createDocumentFragment();
        var jsonOnly = el.getAttribute("data-ast-view") === "json";
        if (!jsonOnly) {
          var n = narrative(resource);
          if (n && n.flagged) n = n.flagged;
          else if (n) relink(n, local, el.getAttribute("data-ast-published"));
          frag.appendChild(heading("Narrative"));
          if (n) frag.appendChild(n);
          else {
            var none = document.createElement("p");
            none.textContent = "This resource carries no narrative.";
            frag.appendChild(none);
          }
          frag.appendChild(heading("JSON"));
        }
        var pre = document.createElement("pre");
        pre.className = "ast-json";
        pre.textContent = JSON.stringify(resource, null, 2);
        frag.appendChild(pre);
        if (state) state.remove();
        el.appendChild(frag);
        el.setAttribute("data-state", "loaded");
      })
      .catch(function (err) {
        if (state) {
          state.textContent = "Could not load " + src + ": " + (err && err.message ? err.message : String(err));
          state.className = "ast-state ast-error";
        }
        el.setAttribute("data-state", "error");
      })
      .then(end, end);
  }

  function start() {
    var els = document.querySelectorAll("[data-ast-src]");
    for (var i = 0; i < els.length; i++) load(els[i]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
