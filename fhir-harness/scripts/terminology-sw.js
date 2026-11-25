/*
 * terminology-sw.js — the IG site's service worker for the self-hosted NLM
 * Form Builder: every request to another origin is answered from this site
 * (terminology-map.js says how), and none reaches the network. Owner,
 * 2026-10-14: "cache + ucum. this is gh-pages so no XSS".
 *
 * Registered with its configuration in its own URL, relative to itself:
 *   fa-terminology-sw.js?index=<terminology index>&ucum=<UCUM rows>&lhc=<LHC-Forms dir>&v=<LHC-Forms version>&bundle=<builder bundle dir>
 * Its scope is the Form Builder's directory, where the site build puts it.
 * That directory holds only the pages and this worker: every other file under
 * it is the builder's bundle, which the worker fetches from `bundle` (beside
 * it on this site, or on a shared host of the same origin).
 */
/* global importScripts, faTerminologyMap */
importScripts("fa-terminology-map.js");

var cfg = new URL(self.location.href).searchParams;
var at = function (rel) { return new URL(rel, self.location.href).href; };
var data = null;

function load(rel) {
  if (!rel) return Promise.resolve(null);
  return fetch(at(rel)).then(function (r) {
    if (!r.ok) throw new Error(rel + ": HTTP " + r.status);
    if (!/\.gz$/.test(rel)) return r.json();
    return new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).json();
  });
}

function ready() {
  if (!data)
    data = Promise.all([load(cfg.get("index")).catch(function () { return null; }), load(cfg.get("ucum")).catch(function () { return null; })]).then(function (got) {
      return { index: got[0], ucum: got[1] && got[1].rows };
    });
  return data;
}

self.addEventListener("install", function (e) { e.waitUntil(self.skipWaiting()); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

var OWN = /^(|index\.html|window-open(\.html)?|fa-terminology-(sw|map)\.js)$/;
var scope = self.registration ? self.registration.scope : at("./");

self.addEventListener("fetch", function (e) {
  var url = e.request.url;
  if (new URL(url).origin === self.location.origin) {
    var path = url.split(/[?#]/)[0];
    if (cfg.get("bundle") && e.request.method === "GET" && path.indexOf(scope) === 0 && !OWN.test(path.slice(scope.length)))
      e.respondWith(fetch(at(cfg.get("bundle")) + path.slice(scope.length)));
    return;
  }
  e.respondWith(
    ready().then(function (d) {
      var a = faTerminologyMap.answer(url, { origin: self.location.origin, index: d.index, ucum: d.ucum, lhcBase: at(cfg.get("lhc") || ""), lhcVersion: cfg.get("v") });
      if (!a)
        return new Response(
          JSON.stringify({
            resourceType: "OperationOutcome",
            issue: [{ severity: "error", code: "not-supported", diagnostics: "A request to " + new URL(url).origin + " is disabled on this site: it makes no cross-site calls" }],
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      if (a.kind === "local") return fetch(a.path);
      if (a.kind === "json") return new Response(JSON.stringify(a.body), { status: a.status, headers: { "Content-Type": "application/json" } });
      return new Response(a.body, { status: a.status, headers: { "Content-Type": a.type } });
    }),
  );
});
