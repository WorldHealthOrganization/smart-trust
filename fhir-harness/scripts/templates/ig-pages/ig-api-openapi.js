// The artefact page's IG API section — "API Information" and "Endpoints" —
// rendered in the browser from the artefact's OpenAPI sidecar in the served
// graph (bean `680p`, `visualizer-loading`). Published once at
// `assets/ig-api-openapi.js`.
//
// It builds what the IG's post-processing (an overlay's hub generator)
// (`_generate_html_content`) injects into the Publisher's page after the
// build: the same elements, classes, text and style, and the same fallbacks
// ("API", "No description available", "Unknown", "No summary"). Text is set
// with textContent, never as markup.
(function () {
  var host = document.querySelector("[data-ig-api-openapi-src]");
  if (!host) return;
  // PRINT AND PDF: the page prints what has loaded. Each loader counts itself
  // in and out, and the last one to finish marks <html data-kg-loaded> — the
  // signal a print or PDF step waits for (`visualizer-loading` §"Printing").
  var kg = (window.__kgLoads = window.__kgLoads || {
    pending: 0,
    done: function () {
      if (--this.pending === 0) document.documentElement.setAttribute("data-kg-loaded", "");
    },
  });
  kg.pending++;
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (k) { e.append(k); });
    return e;
  }
  var STYLE =
    "\n/* IG API documentation styling that integrates with IG theme */\n.ig-api-content {\n  margin: 1rem 0;\n}\n\n" +
    ".api-info .card, .endpoint-card {\n  background-color: #f8f9fa;\n  border: 1px solid #dee2e6;\n  border-radius: 0.375rem;\n  padding: 1rem;\n  margin: 1rem 0;\n}\n\n" +
    ".endpoint-card h3 {\n  color: #00477d;\n  margin-top: 0;\n}\n\n" +
    ".badge-get { background-color: #28a745; }\n.badge-post { background-color: #007bff; }\n" +
    ".badge-put { background-color: #ffc107; color: #212529; }\n.badge-delete { background-color: #dc3545; }\n" +
    ".badge-patch { background-color: #6f42c1; }\n";
  fetch(host.getAttribute("data-ig-api-openapi-src"))
    .then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return r.json();
    })
    .then(function (spec) {
      var info = spec.info || {};
      var content = el("div", { class: "ig-api-content" }, [
        el("div", { class: "api-info" }, [
          el("h2", {}, ["API Information"]),
          el("div", { class: "card" }, [
            el("div", { class: "card-body" }, [
              el("h5", { class: "card-title" }, [info.title || "API"]),
              el("p", { class: "card-text" }, [info.description || "No description available"]),
              el("p", {}, [el("strong", {}, ["Version:"]), " " + (info.version || "Unknown")]),
            ]),
          ]),
        ]),
      ]);
      var paths = spec.paths || {};
      if (Object.keys(paths).length) {
        var eps = el("div", { class: "api-endpoints" }, [el("h2", {}, ["Endpoints"])]);
        Object.keys(paths).forEach(function (p) {
          Object.keys(paths[p]).forEach(function (m) {
            var op = paths[p][m] || {};
            eps.append(
              el("div", { class: "endpoint-card" }, [
                el("h3", {}, [el("span", { class: "badge badge-" + m.toLowerCase() }, [m.toUpperCase()]), " " + p]),
                el("h4", {}, [op.summary || "No summary"]),
                el("p", {}, [op.description || "No description available"]),
              ]),
            );
          });
        });
        content.append(eps);
      }
      host.replaceChildren(
        content,
        el("style", {}, [STYLE]),
        el("p", {}, [el("em", {}, ["This documentation is automatically generated from the OpenAPI specification."])]),
      );
    })
    .catch(function (e) {
      host.textContent = "Could not load " + host.getAttribute("data-ig-api-openapi-src") + ": " + e.message;
    })
    .finally(function () {
      kg.done();
    });
})();
