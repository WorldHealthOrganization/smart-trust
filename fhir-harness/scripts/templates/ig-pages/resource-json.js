// The JSON view pages' loader, published once at `assets/resource-json.js`
// (bean `680p`, `visualizer-loading`). It reads the IG's package.tgz from the
// served artefact-index graph — fetched once, cached by the browser, gunzipped
// with DecompressionStream and walked as a tar — takes the page's resource out
// of it, and shows it as the Publisher's page does: JSON.stringify(parsed, null, 2).
// The status line follows the Publisher's: "<Status> as of <date>", only when
// the resource carries a date.
(function () {
  var code = document.querySelector("code[data-package][data-entry]");
  if (!code) return;
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
  function tarEntry(buf, name) {
    var dec = new TextDecoder();
    for (var off = 0; off + 512 <= buf.length; ) {
      var header = buf.subarray(off, off + 512);
      var n = dec.decode(header.subarray(0, 100)).replace(/\0.*$/s, "");
      if (!n) return undefined;
      var prefix = dec.decode(header.subarray(345, 500)).replace(/\0.*$/s, "");
      var full = prefix ? prefix + "/" + n : n;
      var size = parseInt(dec.decode(header.subarray(124, 136)).replace(/\0.*$/s, "").trim() || "0", 8);
      if (full === name) return buf.subarray(off + 512, off + 512 + size);
      off += 512 + Math.ceil(size / 512) * 512;
    }
    return undefined;
  }
  var entry = code.getAttribute("data-entry");
  fetch(code.getAttribute("data-package"))
    .then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
    })
    .then(function (ab) {
      var bytes = tarEntry(new Uint8Array(ab), entry);
      if (!bytes) throw new Error(entry + " is not in the package");
      var d = JSON.parse(new TextDecoder().decode(bytes));
      code.textContent = JSON.stringify(d, null, 2);
      var status = document.querySelector(".json-view-status");
      if (status && d.date) {
        var s = String(d.status || "");
        status.textContent = s.charAt(0).toUpperCase() + s.slice(1) + " as of " + String(d.date).slice(0, 10);
        status.hidden = false;
      }
    })
    .catch(function (e) {
      code.textContent = "Could not load JSON: " + e.message;
    })
    .finally(function () {
      kg.done();
    });
})();
