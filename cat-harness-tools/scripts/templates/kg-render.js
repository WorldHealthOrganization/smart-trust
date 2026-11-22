// The ONE generic renderer for pages that declare their node (issue #1830).
//
// A page says what it renders in standard markup, not in a script of ours:
//
//   <html prefix="archimate: http://www.opengroup.org/xsd/archimate/3.0/">   (or `prefix` on the element)
//   <link rel="alternate" type="application/ld+json" href="../E1.jsonld">
//   <main resource="https://…/elements/E1" typeof="archimate:ApplicationComponent">
//
// This script finds every element carrying `resource` and `typeof`, expands
// the classes over the `prefix` attributes in scope, and hands the element to the renderer a
// family registered for one of its classes (an exact class IRI) or for the
// class's namespace (an IRI ending in `/`), the longest match winning. A
// family registers without caring which script loads first:
//
//   (window.kgRenderers = window.kgRenderers || []).push({ match: NS, render: fn });
//
// `fn` receives { element, iri, id, kind, types, alternates } where `id` and
// `kind` are the IRI's last two path segments (`…/<kind>/<id>`, Q-THIN-2 A)
// and `alternates` maps a media type to the head's `rel="alternate"` href.
// It may return a promise; while any is pending the page is not marked
// loaded (`<html data-kg-loaded>`, shared with every other loader, for print).
//
// No dependencies; nothing read from a node is written as HTML here.
(function () {
  if (window.kgRender) return;
  var kg = (window.__kgLoads = window.__kgLoads || {
    pending: 0,
    done: function () {
      if (--this.pending === 0) document.documentElement.setAttribute("data-kg-loaded", "");
    },
  });
  var defs = [];

  // The prefixes in scope at `element`: every `prefix` attribute on it and its
  // ancestors, the nearest winning (RDFa 1.1). A themed page, whose layout
  // owns <html>, declares them on the element itself.
  function prefixes(element) {
    var out = {};
    for (var n = element; n && n.getAttribute; n = n.parentNode) {
      var parts = (n.getAttribute("prefix") || "").trim().split(/\s+/);
      for (var i = 0; i + 1 < parts.length; i += 2) {
        var k = parts[i].replace(/:$/, "");
        if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = parts[i + 1];
      }
    }
    return out;
  }
  function expand(curie, px) {
    var m = /^([A-Za-z][\w.-]*):(?!\/\/)(.*)$/.exec(curie);
    return m && Object.prototype.hasOwnProperty.call(px, m[1]) ? px[m[1]] + m[2] : curie;
  }
  function alternates() {
    var out = {};
    var links = document.querySelectorAll('link[rel~="alternate"][type][href]');
    for (var i = 0; i < links.length; i++) {
      var t = links[i].getAttribute("type");
      if (!out[t]) out[t] = links[i].getAttribute("href");
    }
    return out;
  }
  function find(types) {
    var best = null;
    defs.forEach(function (d) {
      types.forEach(function (t) {
        var hit = d.match === t || (d.match.slice(-1) === "/" && t.indexOf(d.match) === 0);
        if (hit && (!best || d.match.length > best.match.length)) best = d;
      });
    });
    return best;
  }
  function render(element) {
    if (element.hasAttribute("data-kg-rendered")) return;
    var px = prefixes(element);
    var types = element.getAttribute("typeof").trim().split(/\s+/).map(function (t) { return expand(t, px); });
    var def = find(types);
    if (!def) return;
    element.setAttribute("data-kg-rendered", "");
    var iri = element.getAttribute("resource");
    var segs = iri.replace(/\/$/, "").split("/");
    kg.pending++;
    var result;
    try {
      result = def.render({
        element: element,
        iri: iri,
        id: decodeURIComponent(segs[segs.length - 1] || ""),
        kind: decodeURIComponent(segs[segs.length - 2] || ""),
        types: types,
        alternates: alternates(),
      });
    } catch (e) {
      result = Promise.reject(e);
    }
    Promise.resolve(result)
      .catch(function (e) {
        if (window.console) console.error("kg-render: " + iri + ": " + (e && e.message));
      })
      .then(function () { kg.done(); });
  }
  function scan() {
    var nodes = document.querySelectorAll("[resource][typeof]");
    for (var i = 0; i < nodes.length; i++) render(nodes[i]);
  }
  function define(d) {
    defs.push(d);
    if (document.readyState !== "loading") scan();
  }

  var queued = window.kgRenderers || [];
  window.kgRenderers = { push: define };
  window.kgRender = { define: define, scan: scan };
  queued.forEach(define);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
})();
