(function () {
  "use strict";
  var box = document.querySelector(".ig-qa-render");
  if (!box) return;
  function el(tag, text) { var e = document.createElement(tag); if (text != null) e.textContent = String(text); return e; }
  fetch(box.getAttribute("data-src")).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (q) {
    box.textContent = "";
    if (q.unavailable) { box.append(el("p", "Not scanned: " + q.unavailable + ".")); return; }
    box.append(el("p", q.scanned + " page(s) scanned on " + q.generatedAt + ". Findings: " + (q.findings.length ? q.findings.length + " block(s) show markup as text." : "none.") + (q.unfinished.length ? " " + q.unfinished.length + " page(s) did not finish drawing." : "") + (q.notReached ? " " + q.notReached + " page(s) not reached: the scan's time budget ran out." : "")));
    if (q.findings.length) {
      var t = el("table"), h = el("tr");
      ["page", "left as text", "text"].forEach(function (c) { h.append(el("th", c)); });
      t.append(h);
      q.findings.forEach(function (f) {
        var tr = el("tr"), a = el("a", f.page), td = el("td");
        a.href = box.getAttribute("data-root") + f.page;
        td.append(a);
        tr.append(td, el("td", f.markup.join(", ")), el("td", f.excerpt));
        t.append(tr);
      });
      box.append(t);
    }
    if (q.unfinished.length) { box.append(el("p", "Did not finish drawing: " + q.unfinished.join(", "))); }
  }).catch(function (e) { box.textContent = "The page scan has no results on this site (" + e.message + "): it runs as the site build's last step."; });
})();
