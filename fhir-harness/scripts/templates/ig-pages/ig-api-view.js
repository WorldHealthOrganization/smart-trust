// The IG API view pages' one script, published once at `assets/ig-api-view.js` and
// loaded by every `<Name>.schema.json.html` / `<Name>.jsonld.html` (bean `680p`:
// the page carries layout, the content is fetched from the graph).
//
// It shows the file as the Publisher's view page does: fetched, parsed and
// re-serialised with `JSON.stringify(parsed, null, 2)` — so JavaScript's key
// order (integer-like keys first) applies here exactly as it does there.
(function () {
  // PRINT AND PDF: the page prints what has loaded. Each loader counts itself
  // in and out, and the last one to finish marks <html data-kg-loaded> — the
  // signal a print or PDF step waits for (`visualizer-loading` §"Printing").
  var kg = (window.__kgLoads = window.__kgLoads || {
    pending: 0,
    done: function () {
      if (--this.pending === 0) document.documentElement.setAttribute("data-kg-loaded", "");
    },
  });
document.querySelectorAll("code[data-ig-api-src]").forEach(function (el) {
  kg.pending++;
  fetch(el.getAttribute("data-ig-api-src"))
    .then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return r.json();
    })
    .then(function (d) {
      el.textContent = JSON.stringify(d, null, 2);
    })
    .catch(function (e) {
      el.textContent = "Could not load " + el.getAttribute("data-ig-api-src") + ": " + e.message;
    })
    .finally(function () {
      kg.done();
    });
});
})();
