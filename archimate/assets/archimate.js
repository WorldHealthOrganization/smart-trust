// The Contents card: a neutral card listing a page's `<h2>` headings, the
// same card the IG sites draw at the top right of a page (fhir-harness#361,
// owner 2026-11-10: "like how IGs have TOC on RHS ... not yellow, but more
// like a card"). Shared here so every generator in or above this layer draws
// the same card (issue #1885); the class names are the IG card's, so its
// stylesheet (`contents-card.css`) is the one both use.
//
// `faContentsCard(scope)` builds the card from the headings inside `scope`
// and puts it first in `scope`. A heading ending in "(n)" shows n as a count.
// Fewer than two headings, or a card already there, and it does nothing.
// Every string is set as text, never as markup.
(function () {
  function card(scope) {
    if (!scope || scope.querySelector(".igi-contents")) return null;
    var hs = Array.prototype.filter.call(scope.querySelectorAll("h2"), function (h) {
      return !h.closest(".igi-contents") && h.textContent.trim();
    });
    if (hs.length < 2) return null;
    var used = {};
    function slug(t) {
      var b = t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section", s = b, i = 1;
      while (used[s] || document.getElementById(s)) s = b + "-" + (++i);
      used[s] = 1;
      return s;
    }
    var nav = document.createElement("nav");
    nav.className = "igi-contents";
    nav.setAttribute("aria-label", "Contents");
    var t = document.createElement("p");
    t.className = "igi-contents-title";
    t.textContent = "Contents";
    nav.appendChild(t);
    var ul = document.createElement("ul");
    hs.forEach(function (h) {
      var label = h.textContent.replace(/\s+/g, " ").trim();
      var count = /^(.*\S)\s*\((\d+)\)$/.exec(label);
      if (!h.id) h.id = slug(count ? count[1] : label);
      var li = document.createElement("li"), a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = count ? count[1] : label;
      li.appendChild(a);
      if (count) {
        var n = document.createElement("span");
        n.className = "igi-n";
        n.textContent = count[2];
        li.appendChild(n);
      }
      ul.appendChild(li);
    });
    nav.appendChild(ul);
    scope.insertBefore(nav, scope.firstChild);
    return nav;
  }
  window.faContentsCard = card;
})();

// The ArchiMate renderer, published once at `assets/archimate.js` and loaded
// by every page `gen-archimate-pages.ts` writes, after the generic renderer
// (`assets/kg-render.js`, issue #1830). The page DECLARES its node in RDFa —
// `resource` = IRI, `typeof` = an `archimate:` class — and this registers for
// the ArchiMate namespace, so the generic renderer hands it the element. It
// fetches the SERVED model (`data-kg-model`, the model normalised) and draws
// from it: a model's views and elements by layer; a view's drawing and what
// it shows; an element's or a relationship's documentation, properties,
// relationships and views (`visualizer-loading`). Which of those a node is
// comes from its class and, for elements and relationships, from the kind in
// its IRI (`…/element/<id>`, `…/relationship/<id>`).
//
// No dependencies, and no `innerHTML` of anything read from the model: every
// string it shows is set as text, because the model is its authors'. A view's
// drawing is an <object>, never inlined, so its markup stays its own document.
(function () {
  var NS = "http://www.opengroup.org/xsd/archimate/3.0/";
  // What the page drawing now is — set by `render`, one node per page. PRINT
  // AND PDF: the generic renderer counts this page's load in and out.
  var cfg, host;

  var LAYERS = ["Strategy", "Business", "Application", "Technology", "Physical", "Motivation", "Implementation & Migration", "Other"];

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  function text(s) {
    return el("div", { class: "am-text" }, String(s).split(/\n{2,}/).map(function (p) { return el("p", {}, [p]); }));
  }
  function typeLabel(t) {
    return String(t).replace(/([a-z])([A-Z])/g, "$1 $2");
  }
  function getJson(href) {
    return fetch(href).then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return r.json();
    });
  }

  // Hrefs, relative to the page that is drawing.
  // A view's or an element's page is at its slug where the model gives one
  // (`slugs`, from the layer's slug ledger), else at its id.
  var root = "../../";
  var slugs = {};
  function seg(id) { return encodeURIComponent(Object.prototype.hasOwnProperty.call(slugs, id) ? slugs[id] : id); }
  function elHref(id) { return root + "element/" + seg(id) + "/"; }
  function relHref(id) { return root + "relationship/" + encodeURIComponent(id) + "/"; }
  function viewHref(id) { return root + "view/" + seg(id) + "/"; }

  function index(m) {
    var ix = { el: {}, rel: {}, view: {}, out: {}, inc: {} };
    m.elements.forEach(function (e) { ix.el[e.id] = e; });
    m.relationships.forEach(function (r) {
      ix.rel[r.id] = r;
      (ix.out[r.source] = ix.out[r.source] || []).push(r);
      (ix.inc[r.target] = ix.inc[r.target] || []).push(r);
    });
    m.views.forEach(function (v) { ix.view[v.id] = v; });
    return ix;
  }
  function endLink(ix, id) {
    var e = ix.el[id];
    if (e) return el("a", { href: elHref(id) }, [e.name || "(unnamed)"]);
    var r = ix.rel[id];
    return r ? el("a", { href: relHref(id) }, [typeLabel(r.type) + " relationship"]) : el("span", {}, [id + " (not in the model)"]);
  }
  function props(list) {
    if (!list || !list.length) return null;
    return el("table", { class: "am-props" }, [
      el("thead", {}, [el("tr", {}, [el("th", {}, ["Property"]), el("th", {}, ["Value"])])]),
      el("tbody", {}, list.map(function (p) { return el("tr", {}, [el("td", {}, [p.key]), el("td", {}, [p.value])]); })),
    ]);
  }
  function viewList(m, ix, ids) {
    if (!ids || !ids.length) return el("p", {}, ["Not drawn in any view."]);
    return el("ul", {}, ids.map(function (id) { return el("li", {}, [el("a", { href: viewHref(id) }, [ix.view[id] ? ix.view[id].name : id])]); }));
  }
  function relRows(ix, rels, dir) {
    return rels.map(function (r) {
      var other = dir === "out" ? r.target : r.source;
      return el("li", {}, [
        el("a", { href: relHref(r.id) }, [typeLabel(r.type)]),
        r.name ? " “" + r.name + "”" : "",
        dir === "out" ? " → " : " ← ",
        endLink(ix, other),
        ix.el[other] ? el("span", { class: "am-type" }, [" (" + typeLabel(ix.el[other].type) + ")"]) : null,
      ]);
    });
  }
  function links(extra) {
    return el("p", { class: "am-links" }, [el("a", { href: cfg.node }, ["This node as JSON-LD"])].concat(extra || []));
  }

  // ── A model: its views, and its elements by layer ──────────────────────
  function drawModel(m) {
    var out = [el("p", {}, [m.views.length + " views · " + m.elements.length + " elements · " + m.relationships.length + " relationships"])];
    if (m.documentation) out.push(text(m.documentation));
    out.push(props(m.properties));
    out.push(el("h2", {}, ["Views"]));
    out.push(el("ul", { class: "am-views" }, m.views.map(function (v) {
      return el("li", {}, [el("a", { href: viewHref(v.id) }, [v.name || "(unnamed view)"]), v.folder && v.folder.length > 1 ? el("span", { class: "am-type" }, [" — " + v.folder.slice(1).join(" / ")]) : null]);
    })));
    LAYERS.forEach(function (layer) {
      var es = m.elements.filter(function (e) { return e.layer === layer; });
      if (!es.length) return;
      es.sort(function (a, b) { return a.type === b.type ? (a.name || "").localeCompare(b.name || "") : a.type.localeCompare(b.type); });
      out.push(el("h2", { class: "am-layer am-layer-" + layer.replace(/\W+/g, "-").toLowerCase() }, [layer + " (" + es.length + ")"]));
      out.push(el("ul", { class: "am-els" }, es.map(function (e) {
        return el("li", {}, [el("a", { href: elHref(e.id) }, [e.name || "(unnamed)"]), el("span", { class: "am-type" }, [" " + typeLabel(e.type)]), (m.inViews[e.id] || []).length ? null : el("span", { class: "am-type" }, [" · in no view"])]);
      })));
    });
    // The model file sits in the DATA root beside `<m>/model.json`, not under
    // the page: resolve from the model's data URL, so it holds wherever a
    // site puts its pages (smart-ra serves pages under `en/dpi-h-ra/`).
    out.push(links([" · ", el("a", { href: new URL("../" + m.file.split("/").map(encodeURIComponent).join("/"), new URL(cfg.model, location.href)).href }, ["The Archi model file"])]));
    return out;
  }

  // ── A view: the drawing, and what it shows ─────────────────────────────
  function drawView(m) {
    var ix = index(m);
    var v = ix.view[cfg.id];
    if (!v) throw new Error("view " + cfg.id + " is not in the model");
    var out = [];
    if (v.viewpoint) out.push(el("p", { class: "am-type" }, ["Viewpoint: " + typeLabel(v.viewpoint)]));
    if (v.documentation) out.push(text(v.documentation));
    // A `bpmn-figure`, so docs-ui.js gives it the zoom, pan, full-width and copy controls every other figure has.
    out.push(el("figure", { class: "bpmn-figure am-figure" }, [
      el("object", { data: cfg.svg, type: "image/svg+xml", "aria-label": v.name }, [el("a", { href: cfg.svg }, ["The drawing of " + v.name])]),
    ]));
    var shown = Object.keys(m.inViews).filter(function (id) { return ix.el[id] && m.inViews[id].indexOf(v.id) >= 0; });
    if (shown.length) {
      out.push(el("h2", {}, ["Elements in this view (" + shown.length + ")"]));
      out.push(el("ul", { class: "am-els" }, shown.map(function (id) {
        return el("li", {}, [el("a", { href: elHref(id) }, [ix.el[id].name || "(unnamed)"]), el("span", { class: "am-type" }, [" " + typeLabel(ix.el[id].type)])]);
      })));
    }
    out.push(links([" · ", el("a", { href: cfg.svg }, ["The drawing (SVG)"])]));
    return out;
  }

  // ── An element ─────────────────────────────────────────────────────────
  function drawElement(m) {
    var ix = index(m);
    var e = ix.el[cfg.id];
    if (!e) throw new Error("element " + cfg.id + " is not in the model");
    var out = [];
    if (e.folder && e.folder.length) out.push(el("p", { class: "am-type" }, ["Filed under " + e.folder.join(" / ")]));
    out.push(e.documentation ? text(e.documentation) : el("p", { class: "am-type" }, ["No documentation."]));
    out.push(props(e.properties));
    var o = ix.out[e.id] || [];
    var i = ix.inc[e.id] || [];
    out.push(el("h2", {}, ["Relationships (" + (o.length + i.length) + ")"]));
    if (o.length + i.length) out.push(el("ul", { class: "am-rels" }, relRows(ix, o, "out").concat(relRows(ix, i, "in"))));
    else out.push(el("p", {}, ["None."]));
    out.push(el("h2", {}, ["Views"]));
    out.push(viewList(m, ix, m.inViews[e.id]));
    out.push(links());
    return out;
  }

  // ── A relationship ─────────────────────────────────────────────────────
  function drawRelationship(m) {
    var ix = index(m);
    var r = ix.rel[cfg.id];
    if (!r) throw new Error("relationship " + cfg.id + " is not in the model");
    var out = [el("p", { class: "am-ends" }, [endLink(ix, r.source), " → ", endLink(ix, r.target)])];
    if (r.accessType) out.push(el("p", { class: "am-type" }, ["Access: " + r.accessType]));
    if (r.strength) out.push(el("p", { class: "am-type" }, ["Strength: " + r.strength]));
    if (r.directed) out.push(el("p", { class: "am-type" }, ["Directed"]));
    if (r.documentation) out.push(text(r.documentation));
    out.push(props(r.properties));
    out.push(el("h2", {}, ["Views"]));
    out.push(viewList(m, ix, m.inViews[r.id]));
    out.push(links());
    return out;
  }

  function kindOf(c) {
    if (c.types.some(function (t) { return t === NS + "Model"; })) return "model";
    if (c.types.some(function (t) { return t === NS + "Diagram"; })) return "view";
    return { element: "element", relationship: "relationship" }[c.kind];
  }

  function render(c) {
    var kind = kindOf(c);
    var draw = { model: drawModel, view: drawView, element: drawElement, relationship: drawRelationship }[kind];
    var body = c.element.querySelector(".am-body");
    // The metamodel page declares its model but is drawn at build time: no body to fill.
    if (!draw || !body) return;
    host = body;
    cfg = {
      kind: kind,
      id: c.id,
      node: c.alternates["application/ld+json"],
      model: c.element.getAttribute("data-kg-model"),
      svg: c.element.getAttribute("data-kg-svg"),
    };
    root = kind === "model" ? "./" : "../../";
    return getJson(cfg.model)
      .then(function (m) {
        slugs = m.slugs || {};
        var parts = draw(m);
        host.textContent = "";
        parts.forEach(function (p) { if (p) host.appendChild(p); });
        // The IG sites' Contents card over the sections just drawn (issue #1885), bundled ahead of this file.
        if (window.faContentsCard) window.faContentsCard(host);
      })
      .catch(function (e) {
        host.textContent = "";
        host.appendChild(el("p", { class: "am-error" }, ["Could not load " + cfg.model + ": " + e.message]));
      });
  }

  (window.kgRenderers = window.kgRenderers || []).push({ match: NS, render: render });
})();
