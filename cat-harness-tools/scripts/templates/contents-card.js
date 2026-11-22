// The Contents card: a neutral card listing a page's `<h2>` headings, the
// same card the IG sites draw at the top right of a page (fhir-harness#361,
// owner 2026-11-10: "like how IGs have TOC on RHS ... not yellow, but more
// like a card"). Shared here so every generator in or above this layer draws
// the same card (issue #1885); the class names are the IG card's, so its
// stylesheet (`contents-card.css`) is the one both use.
//
// `faContentsCard(scope)` builds the card from the headings inside `scope`
// and puts it first in `scope`. A heading ending in "(n)" shows n as a count.
// Fewer than two headings, or a card already there, and it does nothing.
// Every string is set as text, never as markup.
(function () {
  function card(scope) {
    if (!scope || scope.querySelector(".igi-contents")) return null;
    var hs = Array.prototype.filter.call(scope.querySelectorAll("h2"), function (h) {
      return !h.closest(".igi-contents") && h.textContent.trim();
    });
    if (hs.length < 2) return null;
    var used = {};
    function slug(t) {
      var b = t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section", s = b, i = 1;
      while (used[s] || document.getElementById(s)) s = b + "-" + (++i);
      used[s] = 1;
      return s;
    }
    var nav = document.createElement("nav");
    nav.className = "igi-contents";
    nav.setAttribute("aria-label", "Contents");
    var t = document.createElement("p");
    t.className = "igi-contents-title";
    t.textContent = "Contents";
    nav.appendChild(t);
    var ul = document.createElement("ul");
    hs.forEach(function (h) {
      var label = h.textContent.replace(/\s+/g, " ").trim();
      var count = /^(.*\S)\s*\((\d+)\)$/.exec(label);
      if (!h.id) h.id = slug(count ? count[1] : label);
      var li = document.createElement("li"), a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = count ? count[1] : label;
      li.appendChild(a);
      if (count) {
        var n = document.createElement("span");
        n.className = "igi-n";
        n.textContent = count[2];
        li.appendChild(n);
      }
      ul.appendChild(li);
    });
    nav.appendChild(ul);
    scope.insertBefore(nav, scope.firstChild);
    return nav;
  }
  window.faContentsCard = card;
})();
