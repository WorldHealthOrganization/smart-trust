/*
 * ig-annex.js renders a tabular annex where a page asks for one.
 *
 * A page carries `<div class="fa-annex" data-src="…json" data-columns="a|b">`.
 * The JSON is `{ title, source: { label }, sheets: [{ name, columns: [{ key,
 * label }], rows: string[][] }] }`, held in the layer's graph and copied to
 * `assets/annex/` by build-ig-site. Loaded on demand rather than baked into
 * the page (owner, 2026-10-10: "dynamically loaded … i dont want full excel").
 *
 * Every cell is set through `textContent`; nothing from the data is parsed as
 * markup. If the fetch fails, the mount keeps its fallback link to the JSON.
 */
(function () {
  "use strict";

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function render(mount, data) {
    var sheets = Array.isArray(data.sheets) ? data.sheets : [];
    var wanted = (mount.getAttribute("data-columns") || "").split("|").filter(Boolean);
    var total = sheets.reduce(function (n, s) { return n + (s.rows || []).length; }, 0);
    mount.textContent = "";

    var head = el("div", { class: "fa-annex-head" });
    head.appendChild(el("strong", null, data.title || "Annex"));
    if (data.source && data.source.label) head.appendChild(el("span", { class: "fa-annex-src" }, " (from " + data.source.label + ")"));
    mount.appendChild(head);

    var bar = el("p", { class: "fa-annex-bar" });
    var label = el("label", null, "Filter ");
    var input = el("input", { type: "search", placeholder: "id, label, description…", "aria-label": "Filter the annex" });
    label.appendChild(input);
    var count = el("span", { class: "fa-annex-count", "aria-live": "polite" });
    bar.appendChild(label);
    bar.appendChild(count);
    mount.appendChild(bar);

    var all = [];
    sheets.forEach(function (s) {
      var cols = s.columns || [];
      var shown = wanted.length
        ? wanted.map(function (k) { return cols.findIndex(function (c) { return c.key === k; }); }).filter(function (i) { return i >= 0; })
        : cols.slice(0, 6).map(function (_, i) { return i; });
      var det = el("details", { class: "fa-annex-sheet", open: "" });
      var sum = el("summary", null, s.name + " ");
      var n = el("span", { class: "fa-annex-n" });
      sum.appendChild(n);
      det.appendChild(sum);
      var wrap = el("div", { class: "fa-annex-wrap" });
      var table = el("table");
      var thead = el("thead");
      var hr = el("tr");
      hr.appendChild(el("th", { "aria-label": "Details" }));
      shown.forEach(function (i) { hr.appendChild(el("th", null, cols[i].label)); });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = el("tbody");
      var entries = [];
      (s.rows || []).forEach(function (row) {
        var tr = el("tr");
        var btnCell = el("td");
        var btn = el("button", { type: "button", class: "fa-annex-more", "aria-expanded": "false", "aria-label": "Show every field" }, "▸");
        btnCell.appendChild(btn);
        tr.appendChild(btnCell);
        shown.forEach(function (i) { tr.appendChild(el("td", null, row[i] || "")); });
        var more = el("tr", { class: "fa-annex-detail", hidden: "" });
        var cell = el("td", { colspan: String(shown.length + 1) });
        var dl = el("dl");
        cols.forEach(function (c, i) {
          var v = row[i];
          if (!v || shown.indexOf(i) >= 0) return;
          dl.appendChild(el("dt", null, c.label));
          dl.appendChild(el("dd", null, v));
        });
        cell.appendChild(dl);
        more.appendChild(cell);
        btn.addEventListener("click", function () {
          var open = more.hasAttribute("hidden");
          if (open) more.removeAttribute("hidden"); else more.setAttribute("hidden", "");
          btn.setAttribute("aria-expanded", String(open));
          btn.textContent = open ? "▾" : "▸";
        });
        tbody.appendChild(tr);
        tbody.appendChild(more);
        entries.push({ tr: tr, more: more, text: row.join(" ").toLowerCase() });
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      det.appendChild(wrap);
      mount.appendChild(det);
      all.push({ det: det, n: n, entries: entries });
    });

    function apply() {
      var q = input.value.trim().toLowerCase();
      var seen = 0;
      all.forEach(function (s) {
        var k = 0;
        s.entries.forEach(function (e) {
          var hit = !q || e.text.indexOf(q) >= 0;
          e.tr.hidden = !hit;
          if (!hit) e.more.setAttribute("hidden", "");
          if (hit) k++;
        });
        s.n.textContent = "(" + k + (q ? " of " + s.entries.length : "") + ")";
        // A sheet with nothing matching is hidden while filtering, not shown as an empty header.
        s.det.hidden = Boolean(q) && k === 0;
        seen += k;
      });
      count.textContent = " " + seen + " of " + total + " data elements";
    }
    input.addEventListener("input", apply);
    apply();
  }

  function mountAll() {
    [].forEach.call(document.querySelectorAll(".fa-annex[data-src]"), function (mount) {
      fetch(mount.getAttribute("data-src"))
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (data) { render(mount, data); })
        .catch(function (e) { console.warn("ig-annex: " + e.message + "; the fallback link stays."); });
    });
  }

  var style = document.createElement("style");
  style.textContent =
    ".fa-annex-bar{display:flex;gap:1rem;align-items:center;flex-wrap:wrap}" +
    ".fa-annex-bar input{min-width:18rem;padding:.25rem .5rem}" +
    ".fa-annex-src,.fa-annex-count,.fa-annex-n{opacity:.7;font-weight:normal}" +
    ".fa-annex-sheet>summary{cursor:pointer;font-weight:600;margin:.75rem 0 .25rem}" +
    ".fa-annex-wrap{overflow-x:auto}" +
    ".fa-annex table th:first-child,.fa-annex table td:first-child{width:2rem;min-width:2rem;padding-left:.25rem;padding-right:.25rem}" +
    ".fa-annex-more{background:none;border:0;color:inherit;cursor:pointer;font-size:1rem;padding:0 .25rem}" +
    ".fa-annex-detail dl{display:grid;grid-template-columns:max-content 1fr;gap:.2rem 1rem;margin:.25rem 0}" +
    ".fa-annex-detail dt{font-weight:600;opacity:.8}.fa-annex-detail dd{margin:0}";
  document.head.appendChild(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
