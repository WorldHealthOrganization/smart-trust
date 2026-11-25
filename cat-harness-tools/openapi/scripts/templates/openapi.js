// The OpenAPI renderer, published once at `assets/openapi.js` and loaded by
// every page `gen-openapi-pages.ts` writes (bean `s4ta`), after the generic
// renderer (`assets/kg-render.js`, issue #1830). The page DECLARES its node
// in RDFa — a `schema:WebAPI` or a `hydra:Operation` — and this registers for
// those two classes. It fetches the SERVED OpenAPI document (`data-kg-openapi`) and
// draws the operation Swagger-style — method and path, parameters, request
// body, responses, and their schemas with `$ref`s resolved — or, on a
// document's page, the list of its operations (`visualizer-loading`).
//
// No dependencies, and no `innerHTML` of anything read from the document:
// every string it shows is set as text, because the document is upstream's.
(function () {
  var WEB_API = "https://schema.org/WebAPI";
  var OPERATION = "http://www.w3.org/ns/hydra/core#Operation";
  // What the page drawing now is — set by `render`, one node per page. PRINT
  // AND PDF: the generic renderer counts this page's load in and out.
  var cfg, host;

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
    // Descriptions are markdown upstream; shown as text, paragraphs kept.
    return el("div", { class: "oa-text" }, String(s).split(/\n{2,}/).map(function (p) { return el("p", {}, [p]); }));
  }
  function getJson(href) {
    return fetch(href).then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return r.json();
    });
  }
  function fail(href, e) {
    host.textContent = "";
    host.appendChild(el("p", { class: "oa-error" }, ["Could not load " + href + ": " + e.message]));
  }

  // ── $ref resolution, local only ("#/components/schemas/X") ─────────────
  function resolve(doc, ref) {
    if (typeof ref !== "string" || ref.indexOf("#/") !== 0) return undefined;
    return ref.slice(2).split("/").reduce(function (o, k) {
      return o && o[k.replace(/~1/g, "/").replace(/~0/g, "~")];
    }, doc);
  }
  function deref(doc, node, seen) {
    while (node && node.$ref) {
      if (seen.indexOf(node.$ref) >= 0) return { $cycle: node.$ref };
      seen = seen.concat([node.$ref]);
      node = resolve(doc, node.$ref);
    }
    return node;
  }
  function refName(ref) {
    return ref.split("/").pop();
  }

  // ── A schema, as a tree: type, format, enum, required, description ─────
  function schemaTree(doc, node, seen, depth) {
    var name = node && node.$ref ? refName(node.$ref) : null;
    var s = deref(doc, node, seen);
    if (!s) return el("span", { class: "oa-type" }, ["(unresolved " + (node && node.$ref) + ")"]);
    if (s.$cycle) return el("span", { class: "oa-type" }, [refName(s.$cycle) + " (recursive)"]);
    if (node && node.$ref) seen = seen.concat([node.$ref]);
    var label = [];
    if (name) label.push(el("strong", {}, [name + " "]));
    var type = s.type || (s.properties ? "object" : s.items ? "array" : s.allOf ? "allOf" : s.oneOf ? "oneOf" : s.anyOf ? "anyOf" : "");
    if (type === "array" && s.items) {
      var it = s.items.$ref ? refName(s.items.$ref) : s.items.type || "";
      label.push(el("span", { class: "oa-type" }, ["array of " + it]));
    } else if (type) {
      label.push(el("span", { class: "oa-type" }, [type + (s.format ? " (" + s.format + ")" : "")]));
    }
    if (s.enum) label.push(el("span", { class: "oa-enum" }, [" one of: " + s.enum.join(", ")]));
    if (s.description) label.push(el("span", { class: "oa-desc" }, [" — " + s.description]));
    var kids = [];
    if (depth < 6) {
      if (s.properties) {
        var req = s.required || [];
        kids.push(
          el("ul", { class: "oa-props" }, Object.keys(s.properties).map(function (p) {
            return el("li", {}, [
              el("code", {}, [p]),
              req.indexOf(p) >= 0 ? el("span", { class: "oa-req", title: "required" }, ["*"]) : null,
              " ",
              schemaTree(doc, s.properties[p], seen, depth + 1),
            ]);
          })),
        );
      }
      if (type === "array" && s.items && deref(doc, s.items, seen) && (deref(doc, s.items, seen).properties || deref(doc, s.items, seen).allOf)) {
        kids.push(el("ul", { class: "oa-props" }, [el("li", {}, ["items: ", schemaTree(doc, s.items, seen, depth + 1)])]));
      }
      // A map: `additionalProperties` names what every value is.
      if (s.additionalProperties && typeof s.additionalProperties === "object") {
        kids.push(el("ul", { class: "oa-props" }, [el("li", {}, [el("code", {}, ["{key}"]), " ", schemaTree(doc, s.additionalProperties, seen, depth + 1)])]));
      }
      ["allOf", "oneOf", "anyOf"].forEach(function (k) {
        if (s[k]) kids.push(el("ul", { class: "oa-props" }, s[k].map(function (x) { return el("li", {}, [k + ": ", schemaTree(doc, x, seen, depth + 1)]); })));
      });
    }
    if (!kids.length) return el("span", {}, label);
    // Open at the top level, collapsed below it — Swagger's model view does the same.
    return el("details", depth === 0 ? { open: "" } : {}, [el("summary", {}, label)].concat(kids));
  }

  function contentBlock(doc, content) {
    return el("div", {}, Object.keys(content || {}).map(function (mt) {
      var c = content[mt];
      return el("div", { class: "oa-media" }, [
        el("p", {}, [el("code", {}, [mt])]),
        c.schema ? schemaTree(doc, c.schema, [], 0) : null,
        c.example !== undefined ? el("pre", {}, [JSON.stringify(c.example, null, 2)]) : null,
      ]);
    }));
  }

  // ── An operation ───────────────────────────────────────────────────────
  function drawOperation(doc) {
    var item = (doc.paths || {})[cfg.path];
    var op = item && item[cfg.method];
    if (!op) throw new Error(cfg.method.toUpperCase() + " " + cfg.path + " is not in the document");
    var out = [];
    if (op.deprecated) out.push(el("p", { class: "oa-deprecated" }, ["Deprecated."]));
    if (op.description) out.push(text(op.description));
    if (op.tags && op.tags.length) out.push(el("p", { class: "oa-tags" }, ["Tags: " + op.tags.join(", ")]));

    var params = (item.parameters || []).concat(op.parameters || []).map(function (p) { return deref(doc, p, []); });
    out.push(el("h2", {}, ["Parameters"]));
    out.push(
      params.length
        ? el("table", { class: "oa-params" }, [
            el("thead", {}, [el("tr", {}, ["Name", "In", "Type", "Description"].map(function (h) { return el("th", {}, [h]); }))]),
            el("tbody", {}, params.map(function (p) {
              return el("tr", {}, [
                el("td", {}, [el("code", {}, [p.name]), p.required ? el("span", { class: "oa-req", title: "required" }, ["*"]) : null]),
                el("td", {}, [p.in]),
                el("td", {}, [p.schema ? schemaTree(doc, p.schema, [], 1) : ""]),
                el("td", {}, [p.description || ""]),
              ]);
            })),
          ])
        : el("p", {}, ["None."]),
    );

    if (op.requestBody) {
      var body = deref(doc, op.requestBody, []);
      out.push(el("h2", {}, ["Request body" + (body.required ? " (required)" : "")]));
      if (body.description) out.push(text(body.description));
      out.push(contentBlock(doc, body.content));
    }

    out.push(el("h2", {}, ["Responses"]));
    var responses = op.responses || {};
    out.push(el("div", { class: "oa-responses" }, Object.keys(responses).map(function (code) {
      var r = deref(doc, responses[code], []);
      return el("section", { class: "oa-response" }, [
        el("h3", {}, [el("span", { class: "oa-code oa-code-" + code.charAt(0) }, [code]), " ", r.description || ""]),
        contentBlock(doc, r.content),
      ]);
    })));

    var sec = op.security || doc.security;
    if (sec && sec.length) {
      out.push(el("h2", {}, ["Security"]));
      out.push(el("ul", {}, sec.map(function (req) { return el("li", {}, [Object.keys(req).join(" + ") || "none"]); })));
    }
    out.push(el("p", { class: "oa-links" }, [
      el("a", { href: cfg.node }, ["This operation as JSON-LD"]), " · ",
      el("a", { href: cfg.openapi }, ["The OpenAPI document"]),
    ]));
    return out;
  }

  // ── A document: its operations, grouped by their first path segment ────
  function drawDocument(doc, node) {
    var out = [el("p", {}, ["Version " + doc.info.version + " · OpenAPI " + doc.openapi])];
    if (doc.info.description) out.push(text(doc.info.description));
    var groups = {};
    (node["hydra:supportedOperation"] || []).forEach(function (o) {
      var g = (o["schema:urlTemplate"].split("/")[1] || "/").replace(/[{}]/g, "");
      (groups[g] = groups[g] || []).push(o);
    });
    Object.keys(groups).forEach(function (g) {
      out.push(el("h2", {}, ["/" + g]));
      out.push(el("ul", { class: "oa-ops" }, groups[g].map(function (o) {
        var m = o["hydra:method"].toLowerCase();
        return el("li", {}, [
          el("a", { href: "./operation/" + encodeURIComponent(o["schema:identifier"]) + "/" }, [
            el("span", { class: "oa-m oa-m-" + m }, [o["hydra:method"]]), " ",
            el("code", {}, [o["schema:urlTemplate"]]),
          ]),
          o["hydra:title"] ? el("span", { class: "oa-desc" }, [" — " + o["hydra:title"]]) : null,
        ]);
      })));
    });
    out.push(el("p", { class: "oa-links" }, [
      el("a", { href: cfg.node }, ["This API as JSON-LD"]), " · ",
      el("a", { href: cfg.openapi }, ["The OpenAPI document"]),
    ]));
    return out;
  }

  function render(c) {
    var body = c.element.querySelector(".oa-body");
    if (!body) return;
    host = body;
    var a = function (k) { return c.element.getAttribute("data-kg-" + k); };
    cfg = {
      kind: c.types.some(function (t) { return t === WEB_API; }) ? "document" : "operation",
      node: c.alternates["application/ld+json"],
      openapi: a("openapi"),
      method: a("method"),
      path: a("path"),
    };
    var want = cfg.kind === "document" ? [getJson(cfg.openapi), getJson(cfg.node)] : [getJson(cfg.openapi)];
    return Promise.all(want)
      .then(function (r) {
        var parts = cfg.kind === "document" ? drawDocument(r[0], r[1]) : drawOperation(r[0]);
        host.textContent = "";
        parts.forEach(function (p) { host.appendChild(p); });
      })
      .catch(function (e) {
        fail(cfg.openapi, e);
      });
  }

  var q = (window.kgRenderers = window.kgRenderers || []);
  q.push({ match: WEB_API, render: render });
  q.push({ match: OPERATION, render: render });
})();
