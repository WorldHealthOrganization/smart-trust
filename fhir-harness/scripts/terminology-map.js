/*
 * terminology-map.js — what the IG site's service worker answers, as a pure
 * function of the request URL. No network, no DOM: tested with bun, and
 * loaded by the worker with importScripts (it sets `self.faTerminologyMap`).
 *
 * Owner, 2026-10-14: "cache + ucum. this is gh-pages so no XSS" — the
 * self-hosted NLM Form Builder and LHC-Forms make no cross-site call. Every
 * request they make to another origin is answered here, from this site:
 *
 * - clinicaltables `/api/loinc_items/v3/search` → the IG's terminology index
 *   (LOINC only as the IG's cache holds it), in the CTSS shape
 *   `[total, codes, extraFields|null, displayRows]`. No hit: one row saying
 *   the code is not in this IG's cache and is added through the FSH source.
 * - clinicaltables `/api/ucum/v3/search` → the full UCUM list, same shape.
 * - lhcforms-static `/lforms-versions/` → a listing naming the vendored
 *   LHC-Forms version; `/lforms-versions/<v>/<path>` → that file, here.
 * - lforms-fhir.nlm.nih.gov (the builder's import and export) and every
 *   other origin → a local error saying it is disabled on this site.
 *
 * `answer(url, ctx)` returns null for this site's own requests (they go to the
 * network as usual), else one of
 *   { kind: "json", status, body }   { kind: "text", status, body, type }
 *   { kind: "local", path }          (serve this same-site path instead)
 */
(function (root) {
  "use strict";

  var LOINC = "http://loinc.org";
  var NOT_IN_CACHE = "not in this IG's terminology cache; add it via the FSH source";
  var DISABLED = "is disabled on this site: it makes no cross-site calls";

  var words = function (s) {
    return String(s || "").toLowerCase().split(/[^a-z0-9%\/.\[\]{}*^-]+/).filter(Boolean);
  };
  /** Every search term is the start of some word of the row's searchable text. */
  var matches = function (terms, hay) {
    if (!terms.length) return true;
    var ws = words(hay);
    return terms.every(function (t) {
      return ws.some(function (w) { return w.indexOf(t) === 0; });
    });
  };
  var num = function (v, d) {
    var n = parseInt(v, 10);
    return isNaN(n) || n < 0 ? d : n;
  };

  /**
   * A CTSS search over rows. `fields` maps each field name the client may ask
   * for (`df`, `ef`, `cf`) to a function of a row.
   */
  function ctss(rows, params, fields, defaults) {
    var terms = words(params.get("terms"));
    var df = (params.get("df") || defaults.df).split(",");
    var cf = params.get("cf") || defaults.cf;
    var ef = params.get("ef") ? params.get("ef").split(",") : [];
    var max = num(params.get("maxList") || params.get("count"), 7);
    var offset = num(params.get("offset"), 0);
    var hits = rows.filter(function (r) { return matches(terms, defaults.search(r)); });
    var page = hits.slice(offset, offset + max);
    var val = function (f, r) { return fields[f] ? fields[f](r) : ""; };
    var extra = null;
    if (ef.length) {
      extra = {};
      ef.forEach(function (f) {
        var name = f.split(":")[1] || f;
        extra[name] = page.map(function (r) { return val(f.split(":")[0], r); });
      });
    }
    return [
      hits.length,
      page.map(function (r) { return val(cf, r); }),
      extra,
      page.map(function (r) { return df.map(function (f) { return val(f, r); }); }),
    ];
  }

  function loinc(params, ctx) {
    var rows = (ctx.index && ctx.index.codes ? ctx.index.codes : []).filter(function (r) { return r[0] === LOINC; });
    var display = function (r) { return r[2]; };
    var fields = {
      LOINC_NUM: function (r) { return r[1]; },
      text: display,
      LONG_COMMON_NAME: display,
      COMPONENT: display,
      SHORTNAME: display,
      CONSUMER_NAME: display,
      code_system: function () { return LOINC; },
    };
    var out = ctss(rows, params, fields, {
      df: "text,LOINC_NUM",
      cf: "LOINC_NUM",
      search: function (r) { return r[1] + " " + r[2]; },
    });
    if (out[0] === 0 && words(params.get("terms")).length) {
      var df = (params.get("df") || "text,LOINC_NUM").split(",");
      out = [1, [""], null, [df.map(function (f, i) { return i === 0 ? NOT_IN_CACHE : ""; })]];
    }
    return out;
  }

  function ucum(params, ctx) {
    // [csCode, name, guidance, synonyms, printSymbol]
    var rows = ctx.ucum || [];
    var fields = {
      cs_code: function (r) { return r[0]; },
      name: function (r) { return r[1]; },
      guidance: function (r) { return r[2]; },
      synonyms: function (r) { return r[3]; },
      print_symbol: function (r) { return r[4]; },
      cs_code_tokens: function (r) { return r[0]; },
    };
    return ctss(rows, params, fields, {
      df: "cs_code,name",
      cf: "cs_code",
      search: function (r) { return r.join(" "); },
    });
  }

  var disabled = function (what) {
    return {
      kind: "json",
      status: 503,
      body: {
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "not-supported", diagnostics: what + " " + DISABLED }],
      },
    };
  };

  /** What the worker answers for `url`; null for this site's own requests. */
  function answer(url, ctx) {
    var u = new URL(url);
    if (ctx.origin && u.origin === ctx.origin) return null;
    var p = u.pathname;
    if (u.hostname === "clinicaltables.nlm.nih.gov") {
      if (/^\/api\/loinc_items\/v3\/search\/?$/.test(p)) return { kind: "json", status: 200, body: loinc(u.searchParams, ctx) };
      if (/^\/api\/ucum\/v3\/search\/?$/.test(p)) return { kind: "json", status: 200, body: ucum(u.searchParams, ctx) };
      return disabled("LOINC forms and other NLM table searches");
    }
    if (u.hostname === "lhcforms-static.nlm.nih.gov") {
      var m = /^\/lforms-versions\/([^/]+)\/(.+)$/.exec(p);
      if (m && m[1] === ctx.lhcVersion) return { kind: "local", path: ctx.lhcBase + m[2] };
      if (/^\/lforms-versions\/?$/.test(p))
        return { kind: "text", status: 200, type: "text/html", body: '<a href="lforms-' + ctx.lhcVersion + '.zip">lforms-' + ctx.lhcVersion + ".zip</a>" };
      return { kind: "text", status: 404, type: "text/plain", body: "LHC-Forms " + (m ? m[1] : p) + " is not served on this site; " + ctx.lhcVersion + " is" };
    }
    if (u.hostname === "lforms-fhir.nlm.nih.gov") return disabled("Import from and export to a FHIR server");
    return disabled("A request to " + u.origin);
  }

  var api = { answer: answer, ctss: ctss, NOT_IN_CACHE: NOT_IN_CACHE };
  root.faTerminologyMap = api;
})(typeof self !== "undefined" ? self : globalThis);
