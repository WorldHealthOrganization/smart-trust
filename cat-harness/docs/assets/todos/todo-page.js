/*
  One todo's page — issue #1908. A page at <site>/todo/<id>/ DECLARES its
  todo (cat-harness-tools#1830): RDFa resource/typeof (ical:Vtodo) on
  #fa-todo-page, a JSON-LD stub beside it, the todo's JSON-LD as the head's
  rel="alternate", and what else it needs as data-kg-* on the same element.
  The generic renderer (assets/kg-render.js) hands that element here. A page
  written before that, at <site>/todos/<id>/, carries a config block
  (`fa-todo-page-config`) instead, and is still drawn from it until the site
  is regenerated. This script loads the todo's published JSON-LD and draws
  it. Nothing about the todo is written into the page itself: the JSON-LD is
  the one copy (cat-harness-tools scripts/todo-page.ts).

  Every value reaches the DOM through textContent, and every href through
  safeHref, because a todo's text is authored and its links come from data.
*/
(function () {
  "use strict";
  var VTODO = "http://www.w3.org/2002/12/cal/ical#Vtodo";
  var cfg;

  function $(id) { return document.getElementById(id); }
  function el(tag, text, cls) {
    var n = document.createElement(tag);
    if (text != null) n.textContent = String(text);
    if (cls) n.className = cls;
    return n;
  }
  // An href is resolved against the page and kept only if it is http(s):
  // the URL's own parse decides the scheme, so no "javascript:" survives.
  function safeHref(h) {
    if (typeof h !== "string" || h === "") return null;
    var u;
    try { u = new URL(h, document.baseURI); } catch (_e) { return null; }
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  }
  function link(text, href) {
    var safe = safeHref(href);
    if (!safe) return el("span", text);
    var a = el("a", text);
    a.href = safe;
    return a;
  }
  function list(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }
  function idOf(v) { return v && typeof v === "object" ? v["@id"] : v; }

  function meta(dt, dd) {
    var dl = $("fa-todo-meta");
    dl.appendChild(el("dt", dt));
    var d = el("dd");
    if (typeof dd === "string") d.textContent = dd; else d.appendChild(dd);
    dl.appendChild(d);
  }

  function edge(axis, node) {
    var li = el("li");
    li.appendChild(el("span", axis + ": ", "fa-todo-page-axis"));
    var text = (node && (node.name || node.identifier)) || String(idOf(node) || node);
    li.appendChild(link(text, idOf(node)));
    $("fa-todo-edges").appendChild(li);
  }

  function draw(todo) {
    document.title = todo.summary + " — todo";
    $("fa-todo-summary").textContent = todo.summary;
    $("fa-todo-status").textContent = "";
    meta("Status", String(todo.status));
    meta("Priority", String(todo.priority));
    if (todo.origin) meta("Raised by", String(todo.origin));
    meta("Created", String(todo.created));
    if (todo.target) {
      var about = el("span");
      if (cfg.targetHref) {
        about.appendChild(link(todo.target.label || idOf(todo.target), cfg.targetHref));
        about.appendChild(document.createTextNode(" ("));
        about.appendChild(link("node JSON-LD", idOf(todo.target)));
        about.appendChild(document.createTextNode(")"));
      } else {
        about.appendChild(link(todo.target.label || idOf(todo.target), idOf(todo.target)));
      }
      meta("About", about);
    } else if (todo.label) {
      meta("About", String(todo.label) + " (no block in this build carries this label)");
    }
    var body = $("fa-todo-body");
    var paras = String(todo.description || "").split(/\n{2,}/).filter(function (p) { return p.trim() !== ""; });
    if (paras.length === 0) body.appendChild(el("p", "No detail recorded.", "fa-todo-page-empty"));
    paras.forEach(function (p) { body.appendChild(el("p", p.trim())); });

    list(todo.assignee).forEach(function (n) { edge("who", n); });
    list(todo.bean).forEach(function (n) { edge("bean", n); });
    list(todo.pullRequest).forEach(function (n) { edge("PR", n); });
    list(todo.issue).forEach(function (n) { edge("issue", n); });
    list(todo.process).forEach(function (n) { edge("process", n); });
    if (todo.source) edge("source", { "@id": todo.source, name: "View source" });
    edge("JSON-LD", { "@id": cfg.jsonld, name: todo["@id"] });
  }

  function siblings(todo) {
    if (!todo.target || !cfg.graph) return;
    var at = idOf(todo.target);
    fetch(cfg.graph).then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return r.json();
    }).then(function (g) {
      var others = list(g["@graph"]).filter(function (t) {
        return t["@id"] !== todo["@id"] && t.target && idOf(t.target) === at;
      });
      if (others.length === 0) return;
      var ul = $("fa-todo-sibling-list");
      others.forEach(function (t) {
        var li = el("li");
        li.appendChild(link(t.summary, cfg.pages + encodeURIComponent(t.identifier) + "/"));
        ul.appendChild(li);
      });
      $("fa-todo-siblings").hidden = false;
    }).catch(function () { /* the todo itself is drawn; siblings are an extra */ });
  }

  function load() {
    return fetch(cfg.jsonld).then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return r.json();
    }).then(function (todo) {
      draw(todo);
      siblings(todo);
    }).catch(function (e) {
      // "Could not load" is not "nothing to show", and the page says which.
      $("fa-todo-status").textContent = "Could not load this todo from " + cfg.jsonld + ": " + e.message;
    });
  }

  // A page from before the declaration: its config block names the todo.
  var cfgEl = document.getElementById("fa-todo-page-config");
  if (cfgEl) {
    try { cfg = JSON.parse(cfgEl.textContent || "{}"); } catch (_e) { return; }
    load();
    return;
  }
  // A page that declares its todo: drawn when the generic renderer hands it over.
  (window.kgRenderers = window.kgRenderers || []).push({
    match: VTODO,
    render: function (c) {
      var a = function (k) { return c.element.getAttribute("data-kg-" + k); };
      cfg = {
        jsonld: c.alternates["application/ld+json"] || c.iri + ".jsonld",
        graph: a("graph"),
        pages: a("pages") || "../",
        targetHref: a("target-href"),
      };
      return load();
    },
  });
})();
