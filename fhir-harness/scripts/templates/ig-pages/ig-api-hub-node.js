// The IG API hub's one loader, served at `assets/ig-api-hub-node.js`
// (`ig-api-hub.ts`). The page holds the label and a pointer to its node,
// `assets/ig-api-hub.json`; this fetches the node and draws the sidecars, each
// with its artefact and view page, and the enumeration documents
// (`visualizer-loading`). The node's hrefs are relative to the served root;
// `base` is the page's way there. Every string is set as text, never as HTML.
(function () {
  var kg = (window.__kgLoads = window.__kgLoads || {
    pending: 0,
    done: function () {
      if (--this.pending === 0) document.documentElement.setAttribute("data-kg-loaded", "");
    },
  });
  var cfgEl = document.getElementById("ig-api-hub");
  var host = document.querySelector(".ig-api-hub-body");
  if (!cfgEl || !host) return;
  var cfg = JSON.parse(cfgEl.textContent);

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  var base = cfg.base || "";
  function at(href) {
    return /^[a-z][a-z0-9+.-]*:|^\/|^#/i.test(href) ? href : base + href;
  }
  function link(href, label) {
    return href ? el("a", { href: at(href) }, [label]) : "";
  }

  kg.pending++;
  fetch(cfg.node)
    .then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return r.json();
    })
    .then(function (node) {
      host.textContent = "";
      var parts = node["schema:hasPart"] || [];
      var byKind = {};
      parts.forEach(function (p) {
        var k = p["schema:additionalType"] || "Other";
        (byKind[k] = byKind[k] || []).push(p);
      });
      Object.keys(byKind).sort().forEach(function (k) {
        var rows = byKind[k].map(function (p) {
          var about = p["schema:about"];
          return el("tr", {}, [
            el("td", {}, [link(p["schema:contentUrl"], p["schema:name"])]),
            el("td", {}, [about ? link(about["@id"], about["schema:identifier"]) : "bound to no artefact"]),
            el("td", {}, [p["schema:url"] ? link(p["schema:url"], "view") : ""]),
          ]);
        });
        host.appendChild(el("h2", {}, [k + " (" + rows.length + ")"]));
        // `fa-page-wide`: the list fills the page layout's column (cat-harness-tools `page-layout.ts`).
        host.appendChild(el("table", { class: "fa-page-wide" }, [el("thead", {}, [el("tr", {}, [el("th", {}, ["File"]), el("th", {}, ["Artefact"]), el("th", {}, ["View"])])]), el("tbody", {}, rows)]));
      });
      var docs = node["schema:workExample"] || [];
      if (docs.length) {
        host.appendChild(el("h2", {}, ["Enumerations"]));
        host.appendChild(el("ul", {}, docs.map(function (d) { return el("li", {}, [link(d["schema:contentUrl"], d["schema:name"])]); })));
      }
    })
    .catch(function (e) {
      host.textContent = "Could not load " + cfg.node + ": " + e.message;
    })
    .then(function () { kg.done(); });
})();
