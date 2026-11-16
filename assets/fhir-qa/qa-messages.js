(function () {
  "use strict";
  var COLOR = { fatal: "#ff9999", error: "#ffdddd", warning: "#ffebcc", information: "#ffffe6" };
  var boxes = document.querySelectorAll(".ig-qa-publisher");
  if (boxes.length && !document.getElementById("ig-qa-publisher-css")) {
    var css = document.createElement("style");
    css.id = "ig-qa-publisher-css";
    css.textContent =
      ".ig-qa-publisher table.grid{border-collapse:collapse;margin:0 0 1em;font-size:.85em;width:auto}" +
      ".ig-qa-publisher table.grid td{border:1px solid #888;padding:3px 6px;vertical-align:top;color:#000}" +
      ".ig-qa-publisher table.grid td.plain{color:inherit}" +
      ".ig-qa-publisher .mid{font-size:8px;color:navy;display:none}" +
      ".ig-qa-publisher.show-ids .mid{display:inline}" +
      ".ig-qa-publisher .en{display:none;font-weight:normal;font-size:.9em;color:#333}" +
      ".ig-qa-publisher.show-en .en{display:block}" +
      ".ig-qa-publisher .mt{font-size:.75em;font-weight:normal;color:#555;margin-inline-start:.5em}" +
      ".ig-qa-publisher tr:target td{outline:2px solid #276749}" +
      ".ig-qa-publisher .grid-wrap{overflow-x:auto}";
    document.head.appendChild(css);
  }
  for (var i = 0; i < boxes.length; i++) run(boxes[i]);

  /** The box's words, in the page's language (data-labels, ig-qa-page-i18n.ts), English otherwise. */
  function labels(box) {
    var EN = {
      jsResultsFor: "Validation Results for {title}", jsThisIg: "this IG", jsGenerated: "Generated {date}, FHIR version {version} for ",
      jsCanonical: " (canonical = ", jsQualityChecks: "Quality Checks", jsPublisherVersion: "Publisher Version:", jsSummary: "Summary:",
      jsCounts: " errors = {errs}, warn = {warn}, info = {info}, broken links = {links}.  ", jsShowIds: "Show Message Ids", jsHideIds: "Hide Message Ids",
      jsShowEnglish: "Show English", jsHideEnglish: "Hide English", jsFilename: "Filename", jsErrors: "Errors", jsWarnings: "Warnings", jsHints: "Hints",
      jsBuildErrors: "Build Errors", jsPage: "(page)", jsSource: "(source)", jsUpFiles: "\u2191 files", jsGroupCounts: "  ({err} errors, {warn} warnings, {info} hints) ",
      jsPath: "Path", jsSeverity: "Severity", jsMessage: "Message", jsNoMessages: "No messages: {why}.", jsNoneReported: "The Publisher reported no messages.",
      jsCouldNotLoad: "Could not load the Publisher's messages ({error}).", jsMachine: "machine translation",
      jsSevFatal: "fatal", jsSevError: "error", jsSevWarning: "warning", jsSevInformation: "information"
    };
    var given = {};
    try { given = JSON.parse(box.getAttribute("data-labels") || "{}") || {}; } catch (e) { given = {}; }
    return function (k, vars) {
      var s = typeof given[k] === "string" ? given[k] : EN[k] || k;
      return s.replace(/\{([A-Za-z]\w*)\}/g, function (m, n) { return vars && Object.prototype.hasOwnProperty.call(vars, n) ? String(vars[n]) : m; });
    };
  }
  var SEV = { fatal: "jsSevFatal", error: "jsSevError", warning: "jsSevWarning", information: "jsSevInformation" };

  function el(tag, text, attrs) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = String(text);
    for (var k in attrs || {}) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    return e;
  }
  function getJson(u) {
    return fetch(u).then(function (r) {
      if (!r.ok) throw new Error(u + " answered HTTP " + r.status);
      return r.json();
    });
  }
  function row(cells, color, bold) {
    var tr = el("tr", null, color ? { style: "background-color: " + color } : null);
    cells.forEach(function (c) {
      var td = el("td", null, color ? null : { "class": "plain" });
      if (c && c.nodeType) td.appendChild(c);
      else if (bold) td.appendChild(el("b", c));
      else td.textContent = c == null ? "" : String(c);
      tr.appendChild(td);
    });
    return tr;
  }
  function wrap(table) {
    var d = el("div", null, { "class": "grid-wrap" });
    d.appendChild(table);
    return d;
  }
  function counts(g) {
    var c = { err: 0, warn: 0, info: 0 };
    g.messages.forEach(function (m) {
      if (m.severity === "error" || m.severity === "fatal") c.err++;
      else if (m.severity === "warning") c.warn++;
      else c.info++;
    });
    return c;
  }

  function run(box) {
    var pagesUrl = box.getAttribute("data-pages");
    Promise.all([
      getJson(box.getAttribute("data-summary")).catch(function () { return {}; }),
      getJson(box.getAttribute("data-messages")),
      pagesUrl ? getJson(pagesUrl).catch(function () { return []; }) : Promise.resolve([]),
    ])
      .then(function (r) {
        var pages = {};
        (Array.isArray(r[2]) ? r[2] : []).forEach(function (p) { pages[p] = true; });
        var q = r[0] || {};
        var canon = typeof q.url === "string" ? q.url.replace(/\/ImplementationGuide\/[^\/]+$/, "") : "";
        draw(box, q, r[1] || {}, labels(box), {
          pages: pages,
          artifacts: box.getAttribute("data-artifacts") || "artifact/",
          source: box.getAttribute("data-source") || "",
          canon: canon,
        });
      })
      .catch(function (e) {
        box.textContent = "";
        box.appendChild(el("p", labels(box)("jsCouldNotLoad", { error: e.message })));
      });
  }

  /** The site's page for a resource named Type-id, when the site has one. */
  function pageFor(L, name) {
    return L.pages[name + ".html"] ? L.artifacts + name + ".html" : null;
  }
  /** A message file: its artifact page on this site, and its source at the built commit when it is tracked (input/...). */
  function fileCell(L, file, label, T) {
    var span = el("span", null, file ? { dir: "ltr" } : null);
    var base = file ? file.replace(/^.*\//, "").replace(/\.(json|xml|fsh)$/, "") : "";
    var page = base && pageFor(L, base);
    span.appendChild(page ? el("a", label, { href: page }) : document.createTextNode(label));
    if (file && L.source && /^input\//.test(file)) {
      span.appendChild(document.createTextNode(" "));
      span.appendChild(el("a", T("jsSource"), { href: L.source + file.split("/").map(encodeURIComponent).join("/") }));
    }
    return span;
  }
  /** Message text with each URL linked: one of this IG's canonicals to its page here, any other to itself. */
  function linkText(L, text) {
    var out = el("b");
    var re = /https?:\/\/[^\s'"<>()|]+[^\s'"<>()|.,;:]/g;
    var last = 0;
    var m;
    while ((m = re.exec(text))) {
      out.appendChild(document.createTextNode(text.slice(last, m.index)));
      var u = m[0].replace(/\|.*$/, "");
      var href = u;
      if (L.canon && u.indexOf(L.canon + "/") === 0) {
        var rest = u.slice(L.canon.length + 1).split("/");
        if (rest.length === 2) href = pageFor(L, rest[0] + "-" + rest[1]) || u;
      }
      out.appendChild(el("a", m[0], { href: href }));
      last = m.index + m[0].length;
    }
    out.appendChild(document.createTextNode(text.slice(last)));
    return out;
  }

  function draw(box, q, m, T, L) {
    box.textContent = "";
    var groups = Array.isArray(m.groups) ? m.groups : [];
    var hasEn = groups.some(function (g) { return g.messages.some(function (x) { return typeof x.en === "string"; }); });
    box.appendChild(el("h4", T("jsResultsFor", { title: q.title || q.name || T("jsThisIg") })));
    var p = el("p");
    p.appendChild(document.createTextNode(T("jsGenerated", { date: q.date || q.dateISO8601 || "?", version: q.version || "?" })));
    var igName = (q["package-id"] || "?") + "#" + (q["ig-ver"] || "?");
    var igPage = q["package-id"] && pageFor(L, "ImplementationGuide-" + q["package-id"]);
    p.appendChild(igPage ? el("a", igName, { href: igPage }) : document.createTextNode(igName));
    if (q.url) {
      p.appendChild(document.createTextNode(T("jsCanonical")));
      var a = el("a", q.url, { href: q.url });
      p.appendChild(a);
      p.appendChild(document.createTextNode(")"));
    }
    p.appendChild(document.createTextNode("."));
    box.appendChild(p);

    var qc = el("table", null, { "class": "grid" });
    var head = el("tr");
    var th = el("td", null, { colspan: "2", "class": "plain" });
    th.appendChild(el("b", T("jsQualityChecks")));
    head.appendChild(th);
    qc.appendChild(head);
    qc.appendChild(row([T("jsPublisherVersion"), q.tool || "?"]));
    function toggle(cls, on1, off1) {
      var b = el("button", T(off1), { type: "button" });
      b.addEventListener("click", function () {
        var on = (" " + box.className + " ").indexOf(" " + cls + " ") < 0;
        box.className = on ? box.className + " " + cls : box.className.replace(new RegExp(" ?" + cls + "\\b"), "");
        b.textContent = T(on ? on1 : off1);
      });
      return b;
    }
    var sum = el("span");
    var na = function (v) { return v != null ? v : "?"; };
    sum.appendChild(document.createTextNode(T("jsCounts", { errs: na(q.errs), warn: na(q.warnings), info: na(q.hints), links: na(q["broken-links"]) })));
    sum.appendChild(toggle("show-ids", "jsHideIds", "jsShowIds"));
    if (hasEn) {
      sum.appendChild(document.createTextNode(" "));
      sum.appendChild(toggle("show-en", "jsHideEnglish", "jsShowEnglish"));
    }
    qc.appendChild(row([T("jsSummary"), sum]));
    box.appendChild(wrap(qc));

    var files = el("table", null, { "class": "grid", id: "qa-files" });
    files.appendChild(row([T("jsFilename"), T("jsErrors"), T("jsWarnings"), T("jsHints")], null, true));
    groups.forEach(function (g, i) {
      var c = counts(g);
      var b = el("b");
      b.appendChild(el("a", g.file || T("jsBuildErrors"), g.file ? { href: "#qa-f" + i, dir: "ltr" } : { href: "#qa-f" + i }));
      var base = g.file ? g.file.replace(/^.*\//, "").replace(/\.(json|xml|fsh)$/, "") : "";
      var page = base && pageFor(L, base);
      if (page) {
        b.appendChild(document.createTextNode(" "));
        b.appendChild(el("a", T("jsPage"), { href: page }));
      }
      files.appendChild(row([b, String(c.err), String(c.warn), String(c.info)], c.err ? COLOR.error : "#EFFFEF"));
    });
    box.appendChild(wrap(files));
    if (!groups.length) box.appendChild(el("p", m.absent ? T("jsNoMessages", { why: m.absent }) : T("jsNoneReported")));

    groups.forEach(function (g, i) {
      box.appendChild(el("hr"));
      var c = counts(g);
      var h = el("h5", null, { id: "qa-f" + i });
      h.appendChild(fileCell(L, g.file, g.file || T("jsBuildErrors"), T));
      h.appendChild(document.createTextNode(T("jsGroupCounts", { err: c.err, warn: c.warn, info: c.info })));
      h.appendChild(el("a", T("jsUpFiles"), { href: "#qa-files" }));
      box.appendChild(h);
      var t = el("table", null, { "class": "grid" });
      t.appendChild(row([T("jsPath"), T("jsSeverity"), T("jsMessage")], null, true));
      g.messages.forEach(function (msg, j) {
        var where = (msg.path || "") + (msg.line > 0 ? " (l" + msg.line + "/c" + msg.col + ")" : "");
        var text = el("span");
        text.appendChild(linkText(L, msg.text));
        if (msg.origin === "machine") text.appendChild(el("span", T("jsMachine"), { "class": "mt" }));
        if (msg.messageId) {
          text.appendChild(document.createTextNode(" "));
          text.appendChild(el("span", msg.messageId, { "class": "mid" }));
        }
        // The Publisher's own words, for a reader checking the translation ("Show English").
        if (typeof msg.en === "string") text.appendChild(el("span", msg.en, { "class": "en", lang: "en", dir: "ltr" }));
        // Paths and file names are Latin text: isolated left-to-right, so a right-to-left page does not flip their punctuation.
        var pw = el("b", where, { dir: "ltr" });
        var sv = el("b", SEV[msg.severity] ? T(SEV[msg.severity]) : msg.severity);
        var tr = row([pw, sv, text], COLOR[msg.severity] || COLOR.information);
        // Each row addressable, so a catalogue's "rendered at" link and the where-used report land on it.
        tr.id = "qa-m" + i + "-" + j;
        t.appendChild(tr);
      });
      box.appendChild(wrap(t));
    });
  }
})();
