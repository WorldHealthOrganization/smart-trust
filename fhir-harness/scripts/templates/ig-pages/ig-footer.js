// The IG pages' footer, drawn as the IG Publisher draws its own (#1901), and
// published once at `assets/ig-footer.js` (`visualizer-loading`) — only for
// artefact pages that do NOT build into an IG site. In an IG site (`igSite`)
// the pages flag `ig_footer` instead and the site's own footer include draws
// them, from the IG's package AND source, so the two cannot differ. A page
// carries only an empty <footer id="ig-footer"> and, where it has them, its
// previous and next pages. The IG's publisher, package, FHIR version, build
// date and licence are read here from `assets/ig-footer.json`, which
// `gen-ig-pages.ts` writes once per IG from the IG's own package; that file
// and the IG's index page are found from this script's own URL, so no page
// repeats them. Thousands of pages carrying a copy each would be the same
// bytes thousands of times (bean `680p`).
//
// A value the data does not carry is left out of the sentence rather than
// filled in, and a link with no target here is not drawn: a footer that names
// a page that is not there is worse than a shorter footer.
(function () {
  var foot = document.getElementById("ig-footer");
  var self = document.currentScript;
  if (!foot || !self) return;
  var root = self.src.replace(/assets\/ig-footer\.js(?:[?#].*)?$/, "");
  var kg = (window.__kgLoads = window.__kgLoads || {
    pending: 0,
    done: function () {
      if (--this.pending === 0) document.documentElement.setAttribute("data-kg-loaded", "");
    },
  });
  kg.pending++;
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function link(href, text, external) {
    var a = el("a", undefined, text);
    a.href = href;
    if (external) a.rel = "external";
    return a;
  }
  // The <prev | top | next> row. Only "top" is always there.
  var nav = el("p", "ig-footer-nav");
  var prev = foot.getAttribute("data-prev");
  var next = foot.getAttribute("data-next");
  if (prev) nav.append(link(prev, "<prev"), " | ");
  nav.append(link("#", "top"));
  if (next) nav.append(" | ", link(next, "next>"));
  foot.append(nav);
  fetch(root + "assets/ig-footer.json")
    .then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return r.json();
    })
    .then(function (d) {
      var band = el("p", "ig-footer-band");
      if (d.publisher) {
        band.append("IG © ");
        band.append(d.publisherUrl ? link(d.publisherUrl, d.publisher, true) : d.publisher);
        band.append(". ");
      }
      if (d.packageId) {
        band.append("Package ");
        band.append(el("code", undefined, d.packageId + (d.version ? "#" + d.version : "")));
        if (d.fhirVersion) {
          band.append(" based on ");
          band.append(d.fhirUrl ? link(d.fhirUrl, "FHIR " + d.fhirVersion, true) : "FHIR " + d.fhirVersion);
        }
        band.append(". ");
      }
      if (d.generated) band.append("Generated " + d.generated);
      foot.append(band);
      var links = [];
      links.push(link(root, "Table of Contents"));
      if (d.licenseUrl) links.push(link(d.licenseUrl, "License", true));
      if (links.length) {
        var row = el("p", "ig-footer-links", "Links: ");
        links.forEach(function (a, i) {
          if (i) row.append(" | ");
          row.append(a);
        });
        foot.append(row);
      }
    })
    .catch(function (e) {
      foot.append(el("p", "ig-footer-band", "The IG's details could not be loaded (" + e.message + ")."));
    })
    .finally(function () {
      kg.done();
    });
})();
