"use strict";
var G = null, SORT = { key: "id", dir: 1 }, VIEW = "list";
/* THE PAGE'S IDENTITY, and the only thing a page carries -- owner,
   2026-10-02 (#1881): every page is a thin shell that loads its content from
   the published assets. Attributes on the page's own element rather than script, so a shell
   holds no code of its own. DATA_HREF is made ABSOLUTE here, once, before
   anything can rewrite the address bar (see honourAddress). */
var CONFIG = (function(){
  /* data-kg-* on the page's .lib-page element (issue #1830) -- no private block. */
  var el = document.querySelector(".lib-page");
  var d = el ? el.dataset : {};
  var c = { data: d.kgData || "", scope: d.kgScope || "", libRoot: d.kgLibRoot };
  if (d.kgEntry !== undefined) c.entry = d.kgEntry;
  return c;
})();
var DATA_HREF = new URL(String(CONFIG.data || ""), location.href).href;
/* ARRIVING AT #lib-view OPENS THE VIEW PANEL -- the folio glass's eye links
   here (owner, 2026-10-16: "there should be [eye] icon to look at it"), and a
   reader who pressed it came to look, not to press a second toggle. Opening
   the panel is what loads the viewer (pdf-viewer's toggle rule). */
function openViewPanel(){
  if (location.hash !== "#lib-view") return;
  var d = document.querySelector("#lib-view details");
  if (d && !d.open) d.open = true;
}
openViewPanel();
window.addEventListener("hashchange", openViewPanel);
/* The SUBJECT this page is scoped to, or "" for the handler's whole view.
   One projection serves both — a second JSON per subject would be the same
   facts written N+1 times, free to disagree the moment one is regenerated. */
var SCOPE = typeof CONFIG.scope === "string" ? CONFIG.scope : "";
function inScope(x){ return !SCOPE || x.instance === SCOPE; }
/* THE SITE ROOT, derived from the projection's own relative address rather
   than declared -- the page is served at more than one depth, and DATA_HREF
   is already the one path that is right at every one of them. */
var SITE_ROOT = new URL(DATA_HREF.slice(0, DATA_HREF.length - "assets/library/index.json".length)).pathname;
/* An entry's avatar URL, or "". The projection carries a SITE-ROOT path
   (library-graph.ts avatarOf), absent when there is no picture or the site
   does not serve it; nothing is guessed here either. */
function avatarUrl(e){
  var h = e.avatar && typeof e.avatar.href === "string" ? e.avatar.href : "";
  return h.charAt(0) === "/" ? SITE_ROOT + h.slice(1) : "";
}
var BOOK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>';
/* A cover that fails to load falls back to the glyph. ONE capturing listener
   rather than an inline onerror per image: 'error' does not bubble, and an
   inline handler is a script-src relaxation this site does not make. */
document.addEventListener("error", function(ev){
  var t = ev.target;
  if (t && t.tagName === "IMG" && t.parentNode && t.parentNode.classList &&
      t.parentNode.classList.contains("lib-ava")) t.parentNode.innerHTML = BOOK_SVG;
}, true);
function avatarHtml(e){
  var u = avatarUrl(e);
  return '<span class="lib-ava">' + (u
    ? '<img src="' + esc(u) + '" alt="" loading="lazy">'
    : BOOK_SVG) + "</span>";
}
/* A REFERENCED entry's own links -- the published IG, this site's artefact
   index. Owner, 2026-10-02. An entry recorded by reference holds nothing to
   open, so without these its row names a thing and goes nowhere. A site path
   (leading slash) is composed against SITE_ROOT like an avatar; anything
   else must be http(s), so a record cannot put a script URL in an href. */
function linkHref(h){
  h = typeof h === "string" ? h : "";
  if (h.charAt(0) === "/") return SITE_ROOT + h.slice(1);
  return /^https?:[/][/]/i.test(h) ? h : "";
}
function linksHtml(e){
  return (e.links || []).map(function(l){
    var h = linkHref(l.href);
    return h ? ' <a class="src" href="' + esc(h) + '">' + esc(l.label) + "</a>" : "";
  }).join("");
}
/* EVERY ENTRY HAS ITS OWN IRI, AND IT IS A PATH -- owner, 2026-10-02
   (#1881): "each asset gets its own IRI", "no query strings", materialized
   on gh-pages rather than routed by a 404. The generator writes a shell at
   <library>/<instance>/<id>/ for every entry, so a row links there. LIB_ROOT
   is the library's own directory, given relative to the page by CONFIG and
   resolved once against where the page was LOADED. */
var LIB_ROOT = new URL(String(CONFIG.libRoot || "./"), location.href).pathname;

function entryFromPath(pathname, libRoot){
  if (typeof pathname !== "string" || typeof libRoot !== "string" || !libRoot) return null;
  if (pathname.indexOf(libRoot) !== 0) return null;
  var rest = pathname.slice(libRoot.length).replace(/index\.html$/, "").replace(/\/+$/, "");
  var parts = rest.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    return { instance: decodeURIComponent(parts[0]), id: decodeURIComponent(parts[1]) };
  } catch (_e) {
    return null;
  }
}
function legacyKey(hash){
  var raw = String(hash || "").replace(/^#/, "");
  if (!raw) return "";
  var key;
  try { key = decodeURIComponent(raw); } catch (_e) { key = raw; }
  return /^[^/]+\/[^/]+$/.test(key) ? key : "";
}

function entryHref(e){
  return LIB_ROOT + encodeURIComponent(e.instance) + "/" + encodeURIComponent(e.id) + "/";
}
function $(i){ return document.getElementById(i); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function kb(n){ return n >= 1048576 ? (n/1048576).toFixed(1)+" MB" : Math.round(n/1024)+" KB"; }

/* The three-state OCR display jbx2 asks for. "Never scanned" is a DETERMINED
   answer, not a failure, and an ocr/ directory that exists and is empty is a
   third answer again — so none of the three is styled as an error. */
function ocrState(e){
  if (!e.hasOcr) return { label: "not scanned", cls: "" };
  if (e.ocrPages > 0) return { label: e.ocrPages + " OCR pages", cls: "info" };
  return { label: "ocr/ present, empty", cls: "warn" };
}
/* Three states again, and the middle one is the point of the whole column.
   The library is L1 because every reference to a source resolves through it,
   so a slug nothing names is a slug that claim is NOT true of -- a finding
   rather than a blank. A scan that did not run is a third answer: the
   projection carries no refScan, so nobody looked.
   (No backticks in here. See the warning at the top of viewerHtml.) */
function refState(e){
  if (!e.referencedBy) return { label: "not scanned", cls: "", n: -1 };
  var n = e.referencedBy.length;
  if (n === 0) return { label: "referenced by nothing", cls: "warn", n: 0 };
  var kinds = {};
  e.referencedBy.forEach(function(r){ kinds[r.kind] = (kinds[r.kind]||0) + 1; });
  var parts = Object.keys(kinds).sort().map(function(k){ return kinds[k] + " " + k; });
  return { label: parts.join(", "), cls: "ok", n: n };
}
function uploadState(e){
  return {
    match:   { label: "source verified", cls: "ok" },
    differs: { label: "source DIFFERS", cls: "warn" },
    absent:  { label: "source not in a queue", cls: "warn" },
    unknown: { label: "no source named", cls: "" }
  }[e.upload] || { label: e.upload, cls: "" };
}
/* THE PAGE'S LANGUAGE: ?lang=, else the locale segment of its path
   (/en/.../library/), else the page's own lang, else English. */
var LOCALE = (function(){
  var l = "";
  try { l = new URL(location.href).searchParams.get("lang") || ""; } catch (_e) {}
  if (!l) { var m = /[/]([a-z]{2})(?:-[A-Za-z]{2})?[/]/.exec(location.pathname); l = m ? m[1] : ""; }
  if (!l && document.documentElement) l = document.documentElement.getAttribute("lang") || "";
  return (l || "en").toLowerCase().split("-")[0];
})();
/* A TITLE NOT IN THE PAGE'S LANGUAGE SHOWS THE READER'S UNDER IT -- owner,
   2026-11-13: "when display title not in locale, then display locale if
   present under original". Only an official edition's title (e.titles, from
   the projection); nothing when there is none, and nothing is translated.
   A long title is capped to three lines by CSS; the whole of it is in the
   DOM for a screen reader and in a title attribute for a pointer. */
function titleHtml(e, href){
  var t = String(e.title == null ? "" : e.title);
  var h = '<a class="lib-title" href="'+esc(href)+'" title="'+esc(t)+'"'+(e.lang ? ' lang="'+esc(e.lang)+'"' : "")+">"+esc(t)+"</a>";
  var mine = e.lang && e.lang !== LOCALE && e.titles && typeof e.titles[LOCALE] === "string" ? e.titles[LOCALE] : "";
  return mine ? h + '<span class="lib-title-locale" lang="'+esc(LOCALE)+'" title="'+esc(mine)+'">'+esc(mine)+"</span>" : h;
}

var COLS = [
  /* THE SLUG OPENS THE ENTRY'S VISUALISER -- e.view, generated per entry by
     the projection (owner, 2026-10-02, paraphrased: clicking an entry's slug
     should open its visualiser). A site-root path, composed like an avatar; an entry
     whose projection carries none keeps a plain slug. */
  { k:"id",       t:"slug",     n:false, f:function(e){
      var v = typeof e.view === "string" && e.view.charAt(0) === "/" ? SITE_ROOT + e.view.slice(1) : "";
      var s = '<span class="slug">'+esc(e.id)+"</span>";
      return avatarHtml(e) + (v ? '<a class="lib-view" href="'+esc(v)+'">'+s+"</a>" : s); } },
  /* Bean qgjh: an entry can be OPENED. The title is a link to the item's own
     page (its generated README) where one exists, and the document's upstream
     record rides beside it: arXiv or DOI, from the identifier its manifest
     records. Nothing is linked that the projection does not carry. */
  { k:"title",    t:"title",    n:false, c:"t-title", f:function(e){
      /* THE TITLE OPENS THE ENTRY'S OWN PAGE -- its path IRI (#1881). It
         used to open the item's README on GitHub, which a referenced entry
         may not have (owner, 2026-10-02: a DAK IG's title went to a
         404). The README stays as a secondary link, only when one exists. */
      var t = titleHtml(e, entryHref(e));
      var src = e.arxiv ? "https://arxiv.org/abs/"+encodeURIComponent(e.arxiv) : e.doi ? "https://doi.org/"+e.doi : "";
      return t + (src ? ' <a class="src" href="'+esc(src)+'">source</a>' : "") +
        (e.readme ? ' <a class="src" href="'+esc(e.readme)+'">README</a>' : "") + linksHtml(e);
    } },
  { k:"instance", t:"instance", n:false, f:function(e){ return '<span class="pill">'+esc(e.instance)+"</span>"; } },
  { k:"rung",     t:"rung",     n:false, f:function(e){ return '<span class="pill '+(e.rung==="none"?"warn":"ok")+'">'+esc(e.rung)+"</span>"; } },
  { k:"sections", t:"sections", n:true },
  { k:"blocks",   t:"blocks",   n:true },
  { k:"images",   t:"images",   n:true },
  { k:"figures",  t:"figures",  n:true, f:function(e){ return e.figures==null?'<span class="pill">—</span>':esc(String(e.figures)); } },
  { k:"ocrPages", t:"ocr",      n:true, f:function(e){ var s=ocrState(e); return '<span class="pill '+s.cls+'">'+esc(s.label)+"</span>"; } },
  { k:"pageEnd",  t:"pages",    n:true, f:function(e){ return e.pageStart==null?'<span class="pill">—</span>':esc(e.pageStart+"–"+e.pageEnd); } },
  { k:"words",    t:"words",    n:true, f:function(e){ return e.words.toLocaleString(); } },
  { k:"bytes",    t:"size",     n:true, f:function(e){ return kb(e.bytes); } },
  { k:"refCount", t:"referenced by", n:true, c:"t-refs", f:function(e){ var s=refState(e);
      /* The referencing files used to ride in a title attribute, which touch
         and keyboard readers cannot reach (bean gnqa, finding 6). A details
         element is focusable and opens on tap, Enter or Space. */
      var refs = e.referencedBy || [];
      var pill = '<span class="pill '+s.cls+'">'+esc(s.label)+"</span>";
      if (!refs.length) return pill;
      return '<details class="refs"><summary>'+pill+'</summary><ul>' + refs.map(function(r){
        return "<li>"+esc(r.from)+" ("+r.count+")</li>"; }).join("") + "</ul></details>"; } },
  /* THE SOURCE FILE NAME OPENS IT -- owner, 2026-10-30: "the link to the
     source should be clickable to view under source". An entry whose held
     source has a viewer (e.viewable, set by the projection from viewableOf)
     links to its own page's view panel, #lib-view, which opens on arrival,
     in a NEW TAB (owner, 2026-10-30, option B) so the listing stays where the
     reader left it. Any other entry keeps the plain name. */
  { k:"upload",   t:"source",   n:false, c:"t-source", f:function(e){ var s=uploadState(e);
      var name = '<span class="slug" style="font-size:.72rem;color:var(--muted)">'+esc(e.sourceFile)+"</span>";
      if (e.sourceFile && e.viewable) name = '<a class="src lib-src" href="'+esc(entryHref(e))+'#lib-view" target="_blank" rel="noopener">'+esc(e.sourceFile)+"</a>";
      /* Owner, 2026-11-13: every source file name is a link. One not viewable
         here opens its entry page, which says where the file is held. */
      else if (e.sourceFile) name = '<a class="src lib-src" href="'+esc(entryHref(e))+'">'+esc(e.sourceFile)+"</a>";
      return '<span class="pill '+s.cls+'">'+esc(s.label)+"</span>"+(e.sourceFile?"<br>"+name:""); } }
];

function rows(){
  var q = $("q").value.trim().toLowerCase();
  var r = G.entries.filter(function(e){
    if (!inScope(e)) return false;
    if (!q) return true;
    return (e.id+" "+e.title+" "+(e.extractedTitle||"")+" "+e.sourceFile+" "+e.docId+" "+e.instance).toLowerCase().indexOf(q) >= 0;
  });
  var k = SORT.key, d = SORT.dir;
  return r.sort(function(a,b){
    var x=a[k], y=b[k];
    if (typeof x === "number" && typeof y === "number") return (x-y)*d;
    return String(x==null?"":x).localeCompare(String(y==null?"":y))*d;
  });
}

function renderList(){
  var r = rows();
  var h = "<table><thead><tr>" + COLS.map(function(c){
    var sorted = SORT.key === c.k;
    return "<th" + (sorted ? ' aria-sort="'+(SORT.dir>0?"ascending":"descending")+'"' : "") +
      '><button type="button" data-k="'+c.k+'">'+esc(c.t)+"</button></th>";
  }).join("") + "</tr></thead><tbody>";
  h += r.map(rowHtml).join("") || '<tr><td colspan="'+COLS.length+'"><p class="empty">Nothing matches.</p></td></tr>';
  $("listing").innerHTML = h + "</tbody></table>";
}

/* THE ENTRY'S OWN ROW, AT THE TOP OF ITS PAGE -- owner, 2026-11-14: "i
   wanted this at the top of the page". The row the whole-library listing
   draws for this entry was the only place its counts were said, and on an
   entry page that listing is folded away at the bottom. The same COLS and
   the same rowHtml, so the two rows cannot disagree; a plain header, since
   one row has nothing to sort. */
function renderEntryRow(e){
  var el = $("entry-row");
  if (!el) return;
  el.hidden = false;
  el.innerHTML = '<table class="entry-row"><thead><tr>' + COLS.map(function(c){ return "<th>" + esc(c.t) + "</th>"; }).join("") +
    "</tr></thead><tbody>" + rowHtml(e) + "</tbody></table>";
}

function rowHtml(e){
    /* THE ROW DECLARES ITSELF, and the folio reads nothing else.
       A selector guessing at cell positions would bind to this generator's
       markup and break silently the next time a column moves; an attribute
       is a contract. docs-ui.js decorates any row carrying these and
       ignores every page that has none -- so this generator knows nothing
       about the folio beyond emitting three attributes. R30, bean j2if. */
    var key = e.instance + "/" + e.id;
    /* THE HREF IS THIS PAGE, ANCHORED -- and it is composed from
       location.pathname rather than declared anywhere.

       Measured 2026-09-22 before choosing: an ingested library document has
       NO published page of its own. Nothing writes one; this viewer is the
       only thing that renders these entries at all. So there was no stale
       URL to fix, there was no URL. The owner named the reason a per-asset
       route was the wrong shape -- "asset has too much drift" -- and ruled
       the route belongs to the HARNESS.

       cat-harness owns this viewer, so the viewer IS the asset's address.
       Composing it from the page's own location means the same generator
       emits both the row and the page it points at, and a reader arriving
       at the anchor gets the row selected rather than a 404. Nothing to
       declare, so nothing to drift -- the folio-mount's argument for
       deriving its root, applied one level in.

       Since 2026-10-02 the address is the entry's PATH (entryHref above),
       which the generator backs with a page that lands on this same anchor
       -- so the anchor is still the contract, and the path is a name a
       person can type and share. */
    var href = entryHref(e);
    /* data-fa-pullout-host puts the pull-out control in the FIRST cell.
       It used to land in the last one, which on a table wider than the
       screen is past its right edge -- the owner could not find a way onto
       the glass at all (issue #1006). */
    return '<tr data-fa-library-item="' + esc(key) + '"' +
      ' data-fa-library-href="' + esc(href) + '"' +
      ' data-fa-library-avatar="' + esc(avatarUrl(e)) + '"' +
      ' data-fa-library-title="' + esc(e.title || e.id) + '">' + COLS.map(function(c, i){
      var cls = i === 0 ? "lib-first" : [c.n ? "num" : "", c.c || ""].join(" ").trim();
      return "<td" + (cls ? ' class="'+cls+'"' : "") + (i === 0 ? " data-fa-pullout-host" : "") +
        ' data-label="'+esc(c.t)+'">' + (c.f ? c.f(e) : esc(e[c.k])) + "</td>";
    }).join("") + "</tr>";
}

function renderDesk(){
  var r = rows();
  $("desktop").innerHTML = r.map(function(e){
    var o = ocrState(e), u = uploadState(e);
    /* The SAME three attributes the listing row carries, so a card is a
       library item too and the folio's pull-out finds it in either view. */
    var key = e.instance + "/" + e.id;
    return '<article class="card" data-fa-library-item="' + esc(key) + '"' +
      ' data-fa-library-href="' + esc(entryHref(e)) + '"' +
      ' data-fa-library-avatar="' + esc(avatarUrl(e)) + '"' +
      ' data-fa-library-title="' + esc(e.title || e.id) + '"><div class="spine"></div>' +
      '<div data-fa-pullout-host style="display:flex;gap:8px;align-items:flex-start">' + avatarHtml(e) +
      "<h3>"+esc(e.title)+"</h3></div>" +
      '<div class="slug">'+esc(e.instance)+" / "+esc(e.id)+"</div>" +
      '<div class="rows">' +
        "<span>sections</span><b>"+e.sections+"</b>" +
        "<span>blocks</span><b>"+e.blocks+"</b>" +
        (e.summaries && e.summaries.prose ? "<span>summarised</span><b>"+e.summaries.summarised+" / "+e.summaries.prose+"</b>" : "") +
        "<span>images</span><b>"+e.images+"</b>" +
        "<span>figures</span><b>"+(e.figures==null?"—":e.figures)+"</b>" +
        "<span>pages</span><b>"+(e.pageStart==null?"—":e.pageStart+"–"+e.pageEnd)+"</b>" +
        "<span>words</span><b>"+e.words.toLocaleString()+"</b>" +
        "<span>size</span><b>"+kb(e.bytes)+"</b>" +
      "</div>" +
      '<div class="tags"><span class="pill '+(e.rung==="none"?"warn":"ok")+'">'+esc(e.rung)+"</span>" +
        '<span class="pill '+o.cls+'">'+esc(o.label)+"</span>" +
        '<span class="pill '+u.cls+'">'+esc(u.label)+"</span>" +
        '<span class="pill '+refState(e).cls+'">'+esc(refState(e).label)+"</span></div>" +
      "</article>";
  }).join("") || '<p class="empty">Nothing matches.</p>';
}


/* LAZY on an entry page (owner, 2026-11-14: "do lazy load content"): the
   whole library's listing sits in a closed <details> under the entry, and
   drawing every row there is work for a reader who never opens it. It is
   drawn on the first open; until then nothing is. */
function render(){
  var fold = $("listing").closest("details.lib-all");
  if (fold && !fold.open) {
    if (!fold.getAttribute("data-lazy")) {
      fold.setAttribute("data-lazy", "1");
      fold.addEventListener("toggle", function(){ if (fold.open) render(); });
    }
    return;
  }
  if (VIEW === "list") renderList(); else renderDesk();
}

/* WHICH ENTRY THIS PAGE IS ABOUT -- read off its own PATH (#1881).

   THREE OUTCOMES, and the middle one is why this is not a one-liner. The
   path names an entry of this page's library and it is selected; the path
   names something the library does not hold, and the page says "not found"
   with a link to the library rather than showing an unfiltered table as if
   it had worked (pb04); or the page is a library page, with no entry, and
   nothing happens.

   A LEGACY #<instance>/<id> link is honoured ONCE and normalised to the path
   IRI: replaceState when the entry is this page's own, a real navigation
   when it belongs to another library page. Nothing emits the fragment form
   any more. Every URL composed here is built from an entry the PROJECTION
   holds, never from the address bar's text. */
function byKey(key){
  return G.entries.filter(function(e){ return e.instance + "/" + e.id === key; })[0];
}
function selectEntry(known){
  if (VIEW !== "list") setView("list");
  $("q").value = known.id;
  render();
  /* The entry's own row is drawn at the top first, so on an entry page --
     where the whole-library listing is folded and drawn only when opened --
     the anchored row is that one; a listing row, when drawn, is anchored too. */
  renderEntryRow(known);
  var key = known.instance + "/" + known.id;
  var rows = document.querySelectorAll('[data-fa-library-item="' + key.replace(/"/g, '\"') + '"]');
  Array.prototype.forEach.call(rows, function(r){ r.setAttribute("data-fa-anchored", "1"); });
  var listed = $("listing") && $("listing").querySelector('[data-fa-anchored="1"]');
  if (listed && !listed.closest("details:not([open])")) listed.scrollIntoView({ block: "center" });
  document.title = (known.title || known.id) + " — " + known.instance + " library";
  /* The graph of the thing the reader just opened -- bean 7nvr. */
  loadDocument(known.id);
  loadBlocks(known.id, known);
}
function honourAddress(){
  var legacy = legacyKey(location.hash);
  if (legacy) {
    var old = byKey(legacy);
    if (old) {
      var to = entryHref(old);
      if (SCOPE && old.instance === SCOPE) history.replaceState(null, "", to);
      else { location.replace(to); return; }
    }
  }
  var at = entryFromPath(location.pathname, LIB_ROOT);
  if (!at) return;
  var known = at.instance === SCOPE ? byKey(at.instance + "/" + at.id) : undefined;
  if (!known) {
    var lib = LIB_ROOT + encodeURIComponent(SCOPE) + "/";
    $("status").innerHTML = "No entry at this address in the " + esc(SCOPE) + ' library. <a href="' + esc(lib) +
      '">Open the ' + esc(SCOPE) + " library</a>.";
    $("status").setAttribute("data-fa-not-found", "1");
    return;
  }
  selectEntry(known);
}

/* THE BLOCK GRAPH OF ONE ENTRY, fetched only when a reader opens one.
   Bean 7nvr.

   The index carries a COUNT of blocks; this is what they are. It is a
   separate fetch because the corpus holds 1715 blocks over about a megabyte
   of JSON-LD against a 44 KB index, so inlining would multiply the cost of
   the page that answers "what is in here" to serve a question asked about
   one entry at a time.

   THREE OUTCOMES, like honourAnchor above. The file loads and the blocks are
   listed; the file loads and the entry genuinely has none, which is a
   determined answer and says so; or the fetch fails, which is reported as a
   failure rather than rendered as an empty document. An entry with no blocks
   and an entry we could not read must never look the same. */
function blocksHref(id){
  var dir = DATA_HREF.slice(0, DATA_HREF.lastIndexOf("/") + 1);
  return dir + "entries/" + encodeURIComponent(id) + ".json";
}
function renderBlocks(id, data, err, entry){
  var el = $("blocks");
  el.hidden = false;
  if (err) {
    el.innerHTML = '<h2>Blocks</h2><p class="empty">Could not read the block graph for ' +
      esc(id) + ' — ' + esc(err) + '. This is a failure to read, not an empty document.</p>';
    return;
  }
  var bs = (data && data.blocks) || [];
  /* The Contents tree's leaves (library-document.ts) come from these. */
  DOC_BLOCKS = bs;
  if (DOC && DOC_ID === id && DOC_TAB === "contents") renderDocument(id, DOC, null);
  if (!bs.length) {
    el.innerHTML = '<h2>Blocks</h2><p class="empty">' + esc(id) +
      ' has no blocks. Nothing failed — the entry carries none.</p>';
    return;
  }
  /* THE DRAIN, for this entry -- counted over the rows below, so the line and
     the table cannot disagree. Advisory: a backlog is work nobody has done
     yet, not a defect. */
  var sums = bs.filter(function(b){ return b.summary; }).map(function(b){ return b.summary.status; });
  var prose = sums.filter(function(x){ return x !== "empty" && x !== "unreadable"; }).length;
  var done = sums.filter(function(x){ return x === "draft" || x === "confirmed"; }).length;
  var drain = prose ? '<p class="note">Agent summaries: <b>' + done + '</b> of ' + prose +
    ' prose block(s) summarised, <b>' + (prose - done) + '</b> still in the queue. ' +
    'Summaries are drafted by an agent a few at a time and confirmed only by a person.</p>' : '';
  el.innerHTML = '<h2>Blocks — ' + esc(id) + ' <span class="note">(' + bs.length +
    ', in page order)</span></h2>' + withheldBanner(entry, bs) + drain + '<table><thead><tr>' +
    '<th>page</th><th>kind</th><th>types</th><th>title</th><th>narrative / summary</th></tr></thead><tbody>' +
    bs.map(function(b){
      /* BOTH types, never one. A block is dual-typed so a DoCO reader gets
         something without knowing our vocabulary, and showing only ours
         would hide the half this project did not invent. */
      var pages = b.pageStart == null ? '—'
        : (b.pageEnd != null && b.pageEnd !== b.pageStart ? b.pageStart + '–' + b.pageEnd : String(b.pageStart));
      /* A narrative state is three-valued and none of them is an error:
         not-authored means nobody has written one, which is a fact rather
         than a gap. Rendered as plain text for that reason. */
      var nar = b.summary ? summaryDisclosure(b.summary)
        : b.narrative == null ? '—' : esc(b.narrative);
      /* THE CONTENT IS BEHIND A NATIVE <details> — bean lrmo.
         The owner opened this view and said "i expected to be able to see
         narrative content of extracted node": a row carrying only a state
         says a description exists without saying what it is.

         <details> rather than a scripted panel because it expands, collapses
         and takes focus from the keyboard with no JavaScript at all, which is
         one less thing to get wrong and one less thing to test. gjli.

         TRUNCATION IS DECLARED, never inferred from length. A reader who
         cannot tell a short section from a cut one is being shown a claim the
         data does not support. */
      /* THE CONTENT CELL is blockBody -- summary, withheld line, or the
         neutral "(no content carried)", in that order (issue #1794). Its
         text lives in scripts/lib/library-withheld-view.ts so a test runs
         exactly what this page runs. */
      var body = blockBody(b, entry);
      return '<tr id="' + esc(blockAnchor(b.id)) + '"><td class="num">' + esc(pages) + '</td><td>' + esc(b.kind) +
        '</td><td>' + esc((b.types || []).join(' + ')) + '</td><td class="bt">' + body +
        '</td><td>' + nar + '</td></tr>';
    }).join("") + '</tbody></table>';
}
/* A BLOCK SUMMARY'S STATE, in words. Owner, 2026-09-24. Every state is said
   as text rather than colour alone, and none is styled as an error: "not yet
   summarised" is the drain's backlog, which is expected and slow on purpose.
   A draft names its MODEL, because "a model wrote this" without which one is
   the provenance gap schemas/content/attribution.ts closes. */
function summaryLabel(s){
  var d = s.draftedBy;
  switch (s.status) {
    case "draft":
      return { cls: "info", t: d && d.kind === "agent"
        ? (d.model === "not-disclosed" ? "agent draft (model not disclosed)" : "agent draft (model " + (d.model || "unknown") + ")")
        : "draft by " + (d ? d.id : "unknown") };
    case "confirmed": return { cls: "ok", t: "confirmed by " + (s.confirmedBy || "a person") };
    case "stale": return { cls: "warn", t: "stale: source changed" };
    case "rejected": return { cls: "warn", t: "rejected — back in the queue" };
    case "empty": return { cls: "", t: "no text to summarise" };
    case "unreadable": return { cls: "warn", t: "text unreadable" };
    default: return { cls: "", t: "not yet summarised" };
  }
}

/* WITHHELD ENTRIES -- issue #1794. See scripts/lib/library-withheld-view.ts. */
var GATE_VERDICT_WORDS = { refused: "not granted" };
function joinAnd(xs){
  return xs.length > 1 ? xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1] : (xs[0] || "");
}
/* "copyright and restrictions not granted", from the recorded gates; "" when
   the list carried none, and the caller then says the recorded sentence. */
function withheldGateText(e){
  var gs = e && e.withheldBy && e.withheldBy.gates;
  if (!gs || !gs.length) return "";
  var by = {}, order = [];
  gs.forEach(function(g){
    var v = GATE_VERDICT_WORDS[g.verdict] || g.verdict;
    if (!by[v]) { by[v] = []; order.push(v); }
    by[v].push(g.gate);
  });
  return order.map(function(v){ return joinAnd(by[v]) + " " + v; }).join("; ");
}
function withheldLine(e){
  return "Withheld \u2014 " + (withheldGateText(e) || (e && e.withheld) || "not published");
}
/* The catalogue record: its published page first (a SITE-ROOT path, resolved
   the way an avatar is), its upstream URI second, nothing rather than a guess. */
function withheldRecord(e){
  var r = e && e.withheldBy && e.withheldBy.record;
  if (!r) return null;
  if (typeof r.page === "string" && r.page.charAt(0) === "/")
    return { href: SITE_ROOT + r.page.slice(1), label: "catalogue record" };
  if (typeof r.uri === "string" && r.uri) return { href: r.uri, label: "catalogue record (" + r.uri + ")" };
  return null;
}
function hasSummaryText(b){ return !!(b && b.summary && b.summary.text); }
/* ONE ROW'S CONTENT CELL. e is the entry the row belongs to. */
function blockBody(b, e){
  var title = esc(b.title || "\u2014");
  if (b.content) {
    var extract = "<pre>" + esc(b.content) + "</pre>" +
      (b.truncated ? '<p class="note">Excerpt \u2014 the first 600 characters. The section file holds the rest.</p>' : "");
    return "<details><summary>" + title + '</summary><div class="block-body">' +
      (b.summary
        ? '<div class="pair"><div><p class="lbl">Extract</p>' + extract + "</div>" +
          '<div><p class="lbl">Agent summary</p>' + summaryPanel(b.summary) + "</div></div>"
        : extract) +
      "</div></details>";
  }
  if (hasSummaryText(b)) {
    return "<details><summary>" + title + '</summary><div class="block-body">' +
      '<p class="lbl">Summary \u2014 an account of this section, not its text</p>' +
      summaryPanel(b.summary) + "</div></details>";
  }
  if (e && e.withheld) {
    var rec = withheldRecord(e);
    return title + ' <span class="wh-line">' + esc(withheldLine(e)) +
      (rec ? ' \u2014 <a href="' + esc(rec.href) + '">' + esc(rec.label) + "</a>" : "") + "</span>";
  }
  /* No content is a DETERMINED answer for a page-scan or an image with no
     description, and is said plainly rather than left blank. */
  return title + ' <span class="note">(no content carried)</span>';
}
/* THE BANNER over a withheld entry's rows, or "" for any other entry. */
function withheldBanner(e, bs){
  if (!e || !e.withheld) return "";
  var n = bs.filter(hasSummaryText).length;
  var gates = withheldGateText(e);
  var rec = withheldRecord(e);
  return '<div class="wh-banner" role="note" title="' + esc(e.withheld) + '">' +
    "<p><b>" + esc(withheldLine(e)) + ".</b> This work's text is held here but is not published: " +
    (gates ? "the publication gates named above did not grant it." : esc(e.withheld) + ".") +
    " Each section is listed by page and title only. Where a section has a summary \u2014 an account of it, not its words \u2014 the summary is shown instead.</p>" +
    "<p>" + (rec ? 'What the work is, and who holds it: <a href="' + esc(rec.href) + '">' + esc(rec.label) + "</a>. " : "") +
    "<b>" + n + "</b> of " + bs.length + " section" + (bs.length === 1 ? "" : "s") + " summarised.</p></div>";
}

/* The shared edit/feedback recipe (bean v433) builds the Document panel's
   [source], [feedback] and [edit] links (bean zcak). It is NOT inlined here
   any more: every library page is a themed Jekyll page, whose head already
   loads assets/js/edit-links.js, so the inline copy was about 79 KB every
   library page downloaded and parsed twice (owner, 2026-11-14: "do lazy load
   content and libs"). withEditLinks, in DOCUMENT_VIEW_JS, waits for that copy
   and loads it itself on a host that has none. */

/* THE DOCUMENT PANEL -- issue #2302. See scripts/lib/library-document.ts. */
var DOC = null, DOC_ID = null, DOC_TAB = "contents";
function docHref(id){
  var dir = DATA_HREF.slice(0, DATA_HREF.lastIndexOf("/") + 1);
  return dir + "entries/" + encodeURIComponent(id) + ".doc.json";
}
function pageText(phys, label){
  /* The label a reader sees first; the physical index beside it when they
     differ, because that is what a PDF viewer's page box takes. */
  if (phys == null) return "\u2014";
  return label && String(label) !== String(phys) ? esc(label) + ' <span class="note">(p' + phys + ')</span>' : 'p' + phys;
}
function confPill(c, ev){
  if (c == null) return "";
  var cls = c >= 0.8 ? "ok" : c >= 0.6 ? "info" : "warn";
  return '<span class="pill ' + cls + '" title="' + esc((ev || []).join(", ")) + '">' + c.toFixed(2) + '</span>';
}
function notRecorded(what){
  return '<p class="empty">' + esc(what) + ' not recorded for this entry \u2014 it was ingested before this field existed. Re-ingest to add it.</p>';
}
/* THE CONTENTS TREE. Owner, 2026-11-13: "a hierarchy tree expandable
   browser of sections on library items ... that shows blocks within". From
   the outline when there is one, else from the sections, nested by level; a
   section's blocks are its leaves. A node's children are built when it is
   first opened, so a document of a thousand sections stays fast. */
var DOC_BLOCKS = null, DOC_TREE = [];
/* Section id -> its blocks: the ids its own node contains, then any block
   whose target is that section's file. A block placed by neither is left to
   the Blocks panel rather than guessed into a section. */
function docBlocksBySection(d){
  var out = {}, byId = {}, placed = {};
  (DOC_BLOCKS || []).forEach(function(b){ byId[b.id] = b; });
  d.sections.forEach(function(s){
    (s.blocks || []).forEach(function(id){
      if (placed[id]) return;
      placed[id] = 1; (out[s.id] = out[s.id] || []).push(byId[id] || { id: id });
    });
  });
  var known = {};
  d.sections.forEach(function(s){ known[s.id] = 1; });
  (DOC_BLOCKS || []).forEach(function(b){
    var m = !placed[b.id] && /(?:^|\/)sections\/([^\/]+)\.md$/.exec(b.target || "");
    if (m && known[m[1]]) { placed[b.id] = 1; (out[m[1]] = out[m[1]] || []).push(b); }
  });
  return out;
}
function blockAnchor(id){ return "blk-" + String(id).split("/").pop(); }
function blockLeaf(b, secTitle){
  var words = String(b.content || (b.summary && b.summary.text) || "").replace(/\s+/g, " ").trim().split(" ").slice(0, 10).join(" ");
  var t = b.title && b.title !== secTitle ? b.title : words ? words + "\u2026" : b.title || String(b.id).split("/").pop();
  return '<li class="leaf blk"><span class="pill">' + esc(b.kind || "block") + '</span> <a href="#' + esc(blockAnchor(b.id)) +
    '" data-blk="' + esc(blockAnchor(b.id)) + '">' + esc(t) + '</a></li>';
}
/* Nest a flat list by its levels: node = { item, kids: [node index] }. */
function docNest(items){
  var nodes = [], i = 0;
  function level(lv){
    var out = [];
    while (i < items.length && (items[i].level || 1) >= lv) {
      var n = nodes.push({ item: items[i++], kids: [] }) - 1;
      if (i < items.length && (items[i].level || 1) > (nodes[n].item.level || 1)) nodes[n].kids = level((nodes[n].item.level || 1) + 1);
      out.push(n);
    }
    return out;
  }
  /* From the shallowest level, so an item above the first one's is not dropped. */
  var top = items.length ? level(Math.min.apply(null, items.map(function(x){ return x.level || 1; }))) : [];
  return { nodes: nodes, top: top };
}
/* The <li> of each node in ns. A node that is the ONLY one at its level
   starts open (an outline whose single root is the book's title would
   otherwise collapse to one line, 9789241548960-eng), so its children are
   built now; every other node's are built on its first toggle. */
function docTreeItems(ns){
  var only = ns.length === 1;
  return ns.map(function(k){
    var n = DOC_TREE[k];
    if (!n.kids.length && !n.blocks.length) return '<li class="leaf">' + n.line + '</li>';
    return '<li><details data-node="' + k + '"' + (only ? ' open' : '') + '><summary>' + n.line + '</summary><ul data-kids="' + k + '"' +
      (only ? ' data-built="1">' + docTreeKids(k) : '>') + '</ul></details></li>';
  }).join("");
}
function docTreeKids(k){
  var n = DOC_TREE[k];
  return docTreeItems(n.kids) + n.blocks.map(function(b){ return blockLeaf(b, n.title); }).join("");
}
function docTreeBuild(details){
  var ul = details.querySelector("ul[data-kids]");
  if (!ul || ul.getAttribute("data-built")) return;
  ul.setAttribute("data-built", "1");
  ul.innerHTML = docTreeKids(Number(ul.getAttribute("data-kids")));
}
/* An INFERRED contents lists what the contents pages print. A section the
   rung cut that no entry names -- the front matter, or the 30 chapters of
   Parts 2 and 3 that 10665-75211's oversized split cut by running heads --
   was not in the tree at all. Each is placed among the entries by its first
   page, at its own level, and says it is not listed. An outline is the
   PDF's own and is shown as it is. */
function docTocWithSections(d){
  if (d.tocSource === "outline") return d.toc;
  var named = {};
  d.toc.forEach(function(e){ if (e.section) named[e.section] = true; });
  var extra = d.sections.filter(function(s){ return !named[s.id] && s.pageStart != null; }).map(function(s){
    return { level: s.level || 1, title: s.title, number: s.number, page: s.pageStart, pageLabel: s.labelStart, section: s.id, unlisted: true };
  });
  if (!extra.length) return d.toc;
  var out = [], j = 0;
  d.toc.forEach(function(e){
    while (j < extra.length && e.page != null && extra[j].page < e.page) out.push(extra[j++]);
    out.push(e);
  });
  return out.concat(extra.slice(j));
}
function docContents(d){
  var bySec = {};
  d.sections.forEach(function(s){ bySec[s.id] = s; });
  var blocksOf = docBlocksBySection(d);
  var useToc = d.toc.length > 0, items = useToc ? docTocWithSections(d) : d.sections;
  if (!items.length) return d.variant && d.variant !== "pdf"
    ? '<p class="empty">No sections: the source has no headings.</p>'
    : '<p class="empty">No table of contents: the PDF carries no outline and none could be inferred.</p>';
  function line(e){
    var sid = useToc ? e.section : e.id, s = sid && bySec[sid];
    var t = (e.number ? esc(e.number) + ' ' : '') + esc(e.title);
    var link = sid ? '<a href="#sec-' + esc(sid) + '" data-sec="' + esc(sid) + '">' + t + '</a>' : t;
    var where = useToc && e.unlisted ? ' <span class="note">' + pageText(e.page, e.pageLabel) + ' \u00B7 a section the contents do not list</span>'
      : useToc ? ' <span class="note">' + pageText(e.page, e.pageLabel) + '</span> ' + confPill(e.confidence, e.evidence)
      : e.pageStart != null ? ' <span class="note">' + pageText(e.pageStart, e.labelStart) + '</span>' : '';
    return link + where + (s && s.edit && d.links ? ' ' + editHost(s) : '');
  }
  var t = docNest(items);
  DOC_TREE = t.nodes.map(function(n){
    var sid = useToc ? n.item.section : n.item.id;
    return { line: line(n.item), title: n.item.title, kids: n.kids, blocks: (sid && blocksOf[sid]) || [] };
  });
  var how = !useToc
    ? (d.variant && d.variant !== "pdf" ? "Contents: the source\u2019s own headings."
      : "No outline: the PDF carries none and none could be inferred, so its sections are listed.") + ' ' + d.sections.length + ' sections.'
    : 'Source: ' + (d.tocSource === "outline" ? "the PDF\u2019s own outline"
      : "inferred (" + esc(d.tocMethod || "unknown") + "); each entry\u2019s confidence and the evidence behind it are shown") + '. ' + d.toc.length + ' entries.' +
      (items.length > d.toc.length ? ' ' + (items.length - d.toc.length) + ' section(s) the contents do not list are shown at their place.' : '');
  return '<p class="note">' + how + (DOC_BLOCKS ? '' : ' Blocks are listed once the block graph has loaded.') + '</p>' +
    '<p><button type="button" data-toc="open">Expand all</button> <button type="button" data-toc="close">Collapse all</button></p>' +
    '<ul class="toc">' + docTreeItems(t.top) + '</ul>';
}
function docPages(d){
  if (!d.pageLabels) return notRecorded("Page labels");
  var secAt = {}, figAt = {};
  d.sections.forEach(function(s){ if (s.pageStart != null) (secAt[s.pageStart] = secAt[s.pageStart] || []).push(s); });
  (d.figures || []).forEach(function(f){ (figAt[f.page] = figAt[f.page] || []).push(f); });
  return '<table><thead><tr><th>page</th><th>printed label</th><th>sections starting</th><th>figures &amp; tables</th></tr></thead><tbody>' +
    d.pageLabels.map(function(p){
      var secs = (secAt[p.physical] || []).map(function(s){
        return '<a href="#sec-' + esc(s.id) + '" data-sec="' + esc(s.id) + '">' + esc((s.number ? s.number + ' ' : '') + s.title) + '</a>'; }).join('<br>');
      var figs = (figAt[p.physical] || []).map(function(f){ return esc(f.kind + ' ' + f.number); }).join(', ');
      var lab = p.label ? esc(p.label) + ' <span class="note">' + esc(p.source) + '</span>' : '<span class="note">none printed</span>';
      return '<tr><td class="num">' + p.physical + '</td><td>' + lab + '</td><td>' + secs + '</td><td>' + figs + '</td></tr>';
    }).join("") + '</tbody></table>';
}
/* FIGURES AND TABLES SHOWN -- who-iris#224. Each kept figure as its picture
   with its description in the page's language (else English, else the first),
   and each transcribed table drawn from its cells. Every description is an
   agent draft until a person confirms it, and the page says so. */
function docLang(){
  var l = (document.documentElement.getAttribute("lang") || "en").toLowerCase().split("-")[0];
  return l || "en";
}
function pickNarrative(m){
  if (!m) return "";
  var l = docLang();
  if (m[l]) return m[l];
  if (m.en) return m.en;
  for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k)) return m[k];
  return "";
}
function docFileHref(id, file){
  var dir = DATA_HREF.slice(0, DATA_HREF.lastIndexOf("/") + 1);
  return dir + "files/" + encodeURIComponent(id) + "/" + file.split("/").map(encodeURIComponent).join("/");
}
/* A FIGURE'S SHORT NAME -- owner, 2026-11-14: "very duplicative and long
   text. blue figure titles should be shortened". The description opens with
   the figure's own label as the caption gives it ("Fig. 10, 'Product
   packaging hierarchy' (source: ...)"), so that label is the name. Failing
   it, the caption the text carries on the same page; failing that, the
   description's first words. Never the whole description. */
var FIG_LABEL = /^\s*((?:Fig(?:ure)?|Graph|Chart|Map|Box)\.?\s*[A-Z]?\d+[a-z]?)\s*[,:.\u2013-]?\s*['\u2018"\u201C]([^'\u2019"\u201D]{1,120})['\u2019"\u201D]\s*[.,;:]?\s*/i;
function figName(im, d){
  var text = pickNarrative(im.narratives);
  var m = FIG_LABEL.exec(text);
  if (m) return m[1] + " \u00B7 " + m[2];
  var c = (d.figures || []).filter(function(f){ return f.page === im.page && /fig/i.test(f.kind) && f.title; })[0];
  if (c) return (c.number ? c.kind + " " + c.number + " \u00B7 " : "") + c.title;
  var w = text.split(/\s+/).slice(0, 8).join(" ");
  return w ? w + (text.length > w.length ? "\u2026" : "") : im.id;
}
/* THE GALLERY: a THUMBNAIL that pops out -- owner, 2026-11-14: "i wanted to
   actually see the figure thumbnail as a popout", "figures should be
   vertically stacked". One figure per row: its thumbnail, its short name on
   one line and its page; the description is in the
   popout only, so it is said once. Thumbnails load as they scroll near
   (loading="lazy"); the popout is one <dialog>, built on first use. */
function docGallery(d){
  if (!d.images || !d.images.length) return "";
  DOC_GALLERY = d;
  return '<h3>Figures <span class="note">(' + d.images.length + ')</span></h3>' +
    '<p class="note">Select a figure to see it large with its description. Descriptions are drafts written by an agent and not yet reviewed.</p>' +
    '<div class="doc-gallery">' + d.images.map(function(im, i){
      var name = figName(im, d);
      return '<figure class="doc-figure" id="fig-' + esc(im.id) + '">' +
        '<button type="button" class="fig-thumb" data-fig="' + i + '" title="' + esc(name) + '">' +
        '<img loading="lazy" decoding="async" src="' + esc(docFileHref(DOC_ID, im.file)) + '" alt="' + esc(name) + '"></button>' +
        '<figcaption><span class="fig-name" title="' + esc(name) + '">' + esc(name) + '</span> <span class="note">' +
        pageText(im.page, null) + '</span></figcaption></figure>';
    }).join("") + '</div>';
}
var DOC_GALLERY = null;
function figPopout(i){
  var d = DOC_GALLERY, im = d && d.images[i];
  if (!im) return;
  var dlg = document.getElementById("fig-pop");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "fig-pop"; dlg.className = "fig-pop";
    (document.querySelector(".lib-page") || document.body).appendChild(dlg);
    /* A click on the backdrop (the dialog itself, outside its box) closes it. */
    dlg.addEventListener("click", function(ev){ if (ev.target === dlg || (ev.target.closest && ev.target.closest("[data-fig-close]"))) dlg.close(); });
  }
  var rtl = { ar: 1, fa: 1, he: 1, ur: 1 }[docLang()] ? ' dir="rtl"' : '';
  var href = docFileHref(DOC_ID, im.file), name = figName(im, d), full = pickNarrative(im.narratives);
  /* The heading already names the figure: the description goes on from there. */
  var named = FIG_LABEL.test(full), text = named ? full.replace(FIG_LABEL, "") : full;
  var shows = named ? [] : (im.shows || []);
  dlg.innerHTML = '<div class="fig-pop-box"><button type="button" class="fig-pop-x" data-fig-close aria-label="Close">\u00D7</button>' +
    '<h3>' + esc(name) + ' <span class="note">' + pageText(im.page, null) + '</span></h3>' +
    '<img decoding="async" src="' + esc(href) + '" alt="' + esc(name) + '">' +
    '<p' + rtl + '>' + (shows.length ? '<strong>' + esc(shows.join(", ")) + '.</strong> ' : '') + esc(text) + '</p>' +
    '<p class="note">Agent draft, not yet reviewed. <a href="' + esc(href) + '" target="_blank" rel="noopener">Open the image on its own</a></p></div>';
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
}
function docTable(t){
  var groups = t.columns.some(function(c){ return c.group; });
  var head = "";
  if (groups) {
    var cells = [], i = 0;
    while (i < t.columns.length) {
      var g = t.columns[i].group || "", n = 1;
      while (i + n < t.columns.length && (t.columns[i + n].group || "") === g && g) n++;
      cells.push('<th' + (n > 1 ? ' colspan="' + n + '"' : '') + '>' + esc(g) + '</th>');
      i += n;
    }
    head += '<tr>' + cells.join("") + '</tr>';
  }
  head += '<tr>' + t.columns.map(function(c){ return '<th>' + esc(c.titles) + '</th>'; }).join("") + '</tr>';
  var body = t.rows.map(function(r){ return '<tr>' + r.map(function(c){ return '<td>' + esc(c) + '</td>'; }).join("") + '</tr>'; }).join("");
  var text = pickNarrative(t.narratives);
  return '<details class="doc-table"><summary><strong>' + esc(t.caption || t.label) + '</strong> <span class="note">' +
    (t.pages.length ? 'p' + t.pages.join("\u2013") : '') + ', ' + t.rows.length + ' rows</span></summary>' +
    (text ? '<p>' + esc(text) + '</p>' : '') +
    '<div class="doc-table-scroll"><table>' + '<thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
    (t.notes ? '<p class="note">' + esc(t.notes) + '</p>' : '') +
    '<p class="note"><a href="' + esc(docFileHref(DOC_ID, t.csv)) + '">CSV</a></p></details>';
}
function docTables(d){
  if (!d.tables || !d.tables.length) return "";
  return '<h3>Tables <span class="note">(' + d.tables.length + ', transcribed from the pages; drafts)</span></h3>' + d.tables.map(docTable).join("");
}
function docFigures(d){
  var shown = docGallery(d) + docTables(d);
  if (!d.figures) return shown + notRecorded("Figures and tables");
  if (!d.figures.length) return shown + '<p class="empty">No captions found. Nothing failed \u2014 none opens a line with a label and number.</p>';
  var gaps = (d.checks.figureSequenceGaps || []);
  return shown + (shown ? '<h3>Captions in the text</h3>' : '') + (gaps.length ? '<p class="note">Numbering gaps in the document: ' + esc(gaps.join(", ")) + '.</p>' : '') +
    '<table><thead><tr><th>kind</th><th>no.</th><th>caption</th><th>page</th><th>confidence</th></tr></thead><tbody>' +
    d.figures.map(function(f){
      return '<tr><td>' + esc(f.kind) + '</td><td>' + esc(f.number) + '</td><td>' + (f.title ? esc(f.title) : '<span class="note">withheld</span>') +
        '</td><td>' + pageText(f.page, f.pageLabel) + '</td><td>' + confPill(f.confidence, f.evidence) + '</td></tr>';
    }).join("") + '</tbody></table>';
}
function chips(ks){
  /* A keyword a heading also names is marked: the document saying it of itself. */
  if (!ks || !ks.length) return "";
  return '<p class="kw">' + ks.map(function(k){
    return '<span class="pill' + (k.heading ? ' ok' : '') + '"' + (k.heading ? ' title="also named by a heading"' : '') + '>' + esc(k.term) + '</span>';
  }).join(" ") + '</p>';
}
/* LINKS -- bean zcak, from the shared recipe (edit-links, bean v433). The
   library is frozen, so [source] and [feedback] are about the library's own
   section file, and [edit] opens the folio block MATERIALISED from the
   section, when there is one. Each is its own host, so the runtime builds
   every href from that host's data-src and nothing else. */
function editHost(s){
  return '<span class="doc-actions" data-src="' + esc(s.edit.path) + '" data-block="' + esc(s.edit.label) + '">' +
    '<a data-fa-link="edit" title="Edit the folio block made from this section (the library copy is frozen)">\u270E edit</a></span>';
}
function secActions(d, s){
  if (!d.links) return '';
  var t = (s.number ? s.number + ' ' : '') + s.title;
  return ' <span class="doc-actions" data-src="' + esc(d.links.dir + '/sections/' + s.id + '.md') + '" data-block="' + esc(s.id) +
    '" data-sec="' + esc(t) + '"><a data-fa-link="source" title="This section as extracted, on GitHub">source</a> ' +
    '<a data-fa-link="feedback" title="Give feedback on this section (opens a GitHub issue)">\u{1f4e3} feedback</a></span>' +
    (s.edit ? ' ' + editHost(s) : '');
}
function docSections(d){
  if (!d.sections.length) return '<p class="empty">No sections.</p>';
  return d.sections.map(function(s){
    var range = s.pageStart == null ? "" : pageText(s.pageStart, s.labelStart) +
      (s.pageEnd != null && s.pageEnd !== s.pageStart ? ' \u2013 ' + pageText(s.pageEnd, s.labelEnd) : '');
    var body = s.summary
      ? '<div class="sum"><span class="pill info">summary \u00B7 ' + esc(s.summary.status) + '</span><p>' + esc(s.summary.text) + '</p></div>'
      : s.extract
        ? '<div class="sum"><span class="pill">extract \u2014 the section\u2019s own opening text' + (s.extractCut ? ', cut' : '') + '</span><p>' + esc(s.extract) + (s.extractCut ? '\u2026' : '') + '</p></div>'
        : '<p class="note">' + (d.withheld ? 'Withheld \u2014 no text published; no summary yet.' : 'No text and no summary.') + '</p>';
    return '<article id="sec-' + esc(s.id) + '" class="docsec"><h3>' + esc((s.number ? s.number + ' ' : '') + s.title) +
      ' <span class="note">' + range + ' \u00B7 ' + s.words + ' words</span>' + secActions(d, s) + '</h3>' + chips(s.keywords) + body + '</article>';
  }).join("");
}
function docChecks(d){
  var c = d.checks, rows = [];
  function row(name, n, items){
    var cell = !items || !items.length ? '<span class="note">none</span>'
      : '<details><summary>' + items.length + (n > items.length ? ' of ' + n : '') + ' shown</summary><ul>' +
        items.map(function(i){ return '<li>' + esc(i) + '</li>'; }).join("") + '</ul></details>';
    rows.push('<tr><td>' + esc(name) + '</td><td class="num">' + n + '</td><td>' + cell + '</td></tr>');
  }
  if (c.tocAlignment) {
    var names = { listed_not_found: "On the contents page, not found in the body",
      found_not_listed: "Numbered in the body, missing from the contents page", page_mismatch: "Page differs from the contents page" };
    Object.keys(names).forEach(function(k){ var v = c.tocAlignment[k]; if (v) row(names[k], v.count, v.items); });
  }
  if (c.figureSequenceGaps) row("Figure and table numbering gaps", c.figureSequenceGaps.length, c.figureSequenceGaps);
  if (c.pageLabelConflicts) row("Page-label conflicts (built-in label vs printed)", c.pageLabelConflicts.count, c.pageLabelConflicts.items);
  if (!rows.length) return '<p class="empty">No checks recorded for this entry.</p>';
  return '<p class="note">Findings about the DOCUMENT, reported and never corrected \u2014 drafts drift.</p>' +
    '<table><thead><tr><th>check</th><th>count</th><th>items</th></tr></thead><tbody>' + rows.join("") + '</tbody></table>';
}
/* WHAT WAS EXTRACTED -- one line of pills, kind by kind (owner,
   2026-11-14: "why no biblio, glossary, etc here"). Words, never colour
   alone: "none in the text" is a finding, "not extracted" is a gap. */
/* PRINTING LOADS EVERYTHING FIRST -- owner, 2026-11-14: "Make sure printing
   loads all of the content before it renders the PDF on the browser". What
   this panel defers for the screen -- lazy thumbnails, figure descriptions
   kept for the popout, the contents tree built on toggle, summaries behind a
   disclosure -- is all made present before a print:
   - the "Print / PDF" button prepares, WAITS for every image, then prints;
   - the browser's own print (Ctrl+P) gets the same preparation on
     beforeprint; the images are switched to eager there too, and afterprint
     closes again what the preparation opened. */
var PRINT_OPENED = [];
function docPrintPrep(){
  var root = document.querySelector(".lib-page") || document;
  /* The contents tree and every disclosure in the panels, built and open. */
  for (var ds; (ds = root.querySelectorAll("ul.toc details:not([open])")).length;)
    Array.prototype.forEach.call(ds, function(x){ docTreeBuild(x); x.open = true; PRINT_OPENED.push(x); });
  Array.prototype.forEach.call(root.querySelectorAll("#document details:not([open]), #blocks details:not([open])"), function(x){ x.open = true; PRINT_OPENED.push(x); });
  /* Each figure's description, said in print as the popout says it on screen. */
  if (DOC_GALLERY) Array.prototype.forEach.call(root.querySelectorAll(".doc-figure button.fig-thumb[data-fig]"), function(b){
    var fig = b.closest(".doc-figure");
    if (!fig || fig.querySelector(".fig-print-desc")) return;
    var im = DOC_GALLERY.images[+b.getAttribute("data-fig")];
    var p = document.createElement("p");
    p.className = "fig-print-desc";
    p.textContent = im ? pickNarrative(im.narratives) : "";
    fig.appendChild(p);
  });
  /* Every image fetched now, not when it would have scrolled into view. */
  var imgs = Array.prototype.slice.call(root.querySelectorAll("img"));
  imgs.forEach(function(i){ if (i.loading === "lazy" || i.getAttribute("loading") === "lazy") i.loading = "eager"; });
  return Promise.all(imgs.map(function(i){
    if (i.complete && i.naturalWidth) return null;
    return new Promise(function(ok){
      var done = function(){ ok(null); };
      i.addEventListener("load", done, { once: true });
      i.addEventListener("error", done, { once: true });
      setTimeout(done, 15000);
    });
  }));
}
function docPrintDone(){
  PRINT_OPENED.forEach(function(x){ x.open = false; });
  PRINT_OPENED = [];
}
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("beforeprint", function(){ docPrintPrep(); });
  window.addEventListener("afterprint", docPrintDone);
}
var COVER_NAMES = { contents: "Contents", sections: "Sections", figures: "Figures", tables: "Tables",
  references: "References", glossary: "Glossary", footnotes: "Footnotes", summaries: "Summaries" };
function docCoverage(d){
  if (!d.coverage || !d.coverage.length) return "";
  return '<p class="doc-cover"><span class="note">What was extracted:</span> ' + d.coverage.map(function(c){
    var word = c.state === "found" ? (c.count != null ? String(c.count) : "found")
      : c.state === "partial" ? (c.count != null ? c.count + ", partial" : "partial")
      : c.state === "none" ? "none in the text" : "not extracted";
    var cls = c.state === "found" ? "ok" : c.state === "none" ? "" : "warn";
    return '<span class="pill ' + cls + '"' + (c.note ? ' title="' + esc(c.note) + '"' : '') + '>' +
      esc(COVER_NAMES[c.kind] || c.kind) + ': ' + esc(word) + '</span>';
  }).join(" ") + '</p>';
}
/* THE SHARED LINK RUNTIME (edit-links.js), which the page's head loads with
   defer: viewer.js runs before it, so the first document can render before
   it is there. Wait for it -- deferred scripts have all run by
   DOMContentLoaded -- and on a host whose head has none, load it from the
   site root, as navbar-row.js loads its vendor scripts. */
var EDIT_LINKS_WAIT = null;
function withEditLinks(fn){
  if (window.faEditLinks) { fn(window.faEditLinks); return; }
  if (!EDIT_LINKS_WAIT) EDIT_LINKS_WAIT = new Promise(function(done){
    function load(){
      if (window.faEditLinks) { done(window.faEditLinks); return; }
      var root = typeof SITE_ROOT === "string" ? SITE_ROOT : "/";
      var s = document.createElement("script");
      s.src = root + "assets/js/edit-links.js";
      s.onload = function(){ done(window.faEditLinks || null); };
      s.onerror = function(){ done(null); };
      document.head.appendChild(s);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
    else load();
  });
  EDIT_LINKS_WAIT.then(function(L){ if (L) fn(L); });
}
var DOC_TABS = [["contents","Contents",docContents],["pages","Pages",docPages],["figures","Figures & tables",docFigures],["sections","Sections",docSections],["checks","Checks",docChecks]];
function renderDocument(id, d, err){
  var el = $("document");
  /* No structure.json: nothing in this schema to show, a determined answer
     served as a file (absent: true), never a 404 to tell from a failure. */
  if (!err && d && d.absent) { el.hidden = true; return; }
  el.hidden = false;
  if (err) { el.innerHTML = '<h2>Document</h2><p class="empty">Could not read the document view for ' + esc(id) + ' \u2014 ' + esc(err) + '. This is a failure to read, not an empty document.</p>'; return; }
  DOC = d; DOC_ID = id;

  var tab = DOC_TABS.filter(function(t){ return t[0] === DOC_TAB; })[0] || DOC_TABS[0];
  var whole = d.links ? ' <span class="doc-actions" data-src="' + esc(d.links.dir) + '" data-block="' + esc(id) + '"><a data-fa-link="source">source</a> ' +
    '<a data-fa-link="feedback" title="Give feedback on this document (opens a GitHub issue)">\u{1f4e3} feedback</a></span>' : '';
  /* An unknown page count is said as unknown, never as "0 pages". */
  var size = d.variant && d.variant !== "pdf" ? d.sections.length + ' sections'
    : d.pages ? d.pages + ' pages'
    : d.pagesCovered ? 'page count not recorded; sections reach page ' + d.pagesCovered
    : 'page count not recorded';
  el.innerHTML = '<h2>Document \u2014 ' + esc(d.title || id) + ' <span class="note">(' + size + ')</span>' + whole +
    ' <button type="button" class="doc-print" title="Load every figure and section, then print or save as PDF">Print / PDF</button></h2>' +
    docCoverage(d) +
    '<div class="seg" role="tablist" aria-label="Document view">' + DOC_TABS.map(function(t){
      return '<button type="button" role="tab" aria-selected="' + (t[0] === tab[0]) + '" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join("") + '</div>' + (d.keywords && d.keywords.length ? '<div class="dockw"><span class="note">Keywords (LSI):</span> ' + chips(d.keywords) + '</div>' : '') +
    '<div class="docbody" role="tabpanel">' + tab[2](d) + '</div>';
  Array.prototype.forEach.call(el.querySelectorAll("[data-tab]"), function(b){
    b.addEventListener("click", function(){ DOC_TAB = b.getAttribute("data-tab"); renderDocument(id, DOC, null); });
  });
  Array.prototype.forEach.call(el.querySelectorAll("[data-toc]"), function(b){
    b.addEventListener("click", function(){
      if (b.getAttribute("data-toc") !== "open") {
        Array.prototype.forEach.call(el.querySelectorAll("ul.toc details"), function(x){ x.open = false; });
        return;
      }
      /* Opening builds children, which may be nodes of their own: repeat
         until every node is open. */
      for (var ds; (ds = el.querySelectorAll("ul.toc details:not([open])")).length;)
        Array.prototype.forEach.call(ds, function(x){ docTreeBuild(x); x.open = true; });
    });
  });
  /* toggle does not bubble, so it is caught on the way down; once per panel. */
  if (!el.getAttribute("data-tree")) {
    el.setAttribute("data-tree", "1");
    el.addEventListener("toggle", function(ev){
      var t = ev.target;
      if (t && t.matches && t.matches("ul.toc details[data-node]") && t.open) docTreeBuild(t);
    }, true);
    /* A block leaf scrolls to its row in the Blocks panel; the address is
       left alone, since a changed hash re-reads the whole entry. */
    el.addEventListener("click", function(ev){
      /* Print: prepare, wait for every image, then print. */
      if (ev.target && ev.target.closest && ev.target.closest("button.doc-print")) {
        docPrintPrep().then(function(){ window.print(); });
        return;
      }
      /* A figure's thumbnail opens its popout. */
      var fb = ev.target && ev.target.closest && ev.target.closest("button.fig-thumb[data-fig]");
      if (fb) { figPopout(+fb.getAttribute("data-fig")); return; }
      var a = ev.target && ev.target.closest && ev.target.closest("a[data-blk]");
      if (!a) return;
      ev.preventDefault();
      var r = document.getElementById(a.getAttribute("data-blk")); if (r) r.scrollIntoView({ block: "center" });
    });
  }
  /* Hrefs now, not on first hover: a keyboard reader tabs to these links.
     Configured and filled together, once the shared runtime is there. */
  if (d.links) withEditLinks(function(L){
    if (DOC !== d || DOC_ID !== id) return;   /* another entry or tab since */
    L.configure({ repo: d.links.repo, branch: d.links.branch, content: id });
    L.fill(el);
  });
  /* A section link from any tab opens the Sections tab at that section. Only
     <a>: a link HOST carries data-sec too (its section's name, for an issue). */
  Array.prototype.forEach.call(el.querySelectorAll("a[data-sec]:not([data-fa-link])"), function(a){
    a.addEventListener("click", function(ev){
      ev.preventDefault(); DOC_TAB = "sections"; renderDocument(id, DOC, null);
      var t = document.getElementById("sec-" + a.getAttribute("data-sec")); if (t) t.scrollIntoView();
    });
  });
}
/* An address naming a section (#sec-<id>), from the rail's contents or a
   link from anywhere, opens the Sections tab at it: the section exists only
   on that tab, so a bare fragment would scroll to nothing. */
function openSectionFromHash(){
  var h = decodeURIComponent(location.hash || "");
  if (h.indexOf("#sec-") !== 0 || !DOC) return;
  if (DOC_TAB !== "sections") { DOC_TAB = "sections"; renderDocument(DOC_ID, DOC, null); }
  var t = document.getElementById(h.slice(1)); if (t) t.scrollIntoView();
}
window.addEventListener("hashchange", openSectionFromHash);
/* "no-cache", not "no-store": revalidated every time, so never stale, but an
   unchanged structure.json is a 304 rather than its body again. */
function fetchDocument(id){
  return fetch(docHref(id), {cache: "no-cache"})
    .then(function(r){ if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
}
/* takeEarly is the viewer's (gen-library-viz.ts): the response the entry page
   started before its index arrived. Without it, this fetches. */
function loadDocument(id){
  (typeof takeEarly === "function" ? takeEarly("document", id, fetchDocument) : fetchDocument(id))
    .then(function(d){ renderDocument(id, d, null); openSectionFromHash(); })
    .catch(function(e){ renderDocument(id, null, String(e && e.message || e)); });
}

function summaryBadge(s){
  var l = summaryLabel(s);
  return '<span class="pill ' + l.cls + '">' + esc(l.t) + '</span>';
}
/* THE SUMMARY TEXT, BEHIND A DISCLOSURE -- owner, 2026-11-14: "disclosure
   agent summary even if not verified. just indicate". The cell used to carry
   the state alone, so 62 drafted summaries read as 62 identical pills. The
   pill stays as the disclosure's label, so an unconfirmed draft still says it
   is one before anyone opens it; summaryPanel inside says who drafted it and
   that no person has confirmed it. A state with no text keeps the bare pill. */
function summaryDisclosure(s){
  if (!s.text) return summaryBadge(s);
  return '<details class="sumd"><summary>' + summaryBadge(s) + '</summary>' + summaryPanel(s).replace(summaryBadge(s), '') + '</details>';
}
function summaryPanel(s){
  var why = {
    "not-summarised": "No agent has summarised this block yet. The queue is drained a few blocks at a time.",
    "empty": "The block holds no text, so there is nothing to summarise.",
    "unreadable": "The block names a text file that could not be read."
  }[s.status];
  var who = s.draftedBy
    ? "Drafted by " + s.draftedBy.kind + " " + s.draftedBy.id +
      (s.draftedBy.model === "not-disclosed" ? ", model not disclosed (recoverable from its session)" : s.draftedBy.model ? ", model " + s.draftedBy.model : "") + (s.draftedAt ? ", " + s.draftedAt : "") + ". " +
      (s.status === "confirmed" ? "Confirmed by " + (s.confirmedBy || "a person") + "."
        : s.status === "stale" ? "The block's text has changed since; this summary may no longer match it."
        : s.status === "rejected" ? "Rejected by a person: " + (s.rejectionReason || "no reason recorded") + "."
        : "Not yet confirmed by a person.")
    : "";
  return '<div class="sum">' + summaryBadge(s) +
    (s.text ? '<p>' + esc(s.text) + '</p>' : '<p>' + esc(why || "") + '</p>') +
    (who ? '<p class="note">' + esc(who) + '</p>' : '') + '</div>';
}
/* REVALIDATED, NOT REFETCHED: "no-cache" asks the server every time, as
   "no-store" did, so a page never shows a stale graph -- but an unchanged
   file comes back as a 304 rather than its whole body again (on who-iris,
   66 KB an entry on average and 2.3 MB at most). */
function fetchBlocks(id){
  return fetch(blocksHref(id), {cache: "no-cache"})
    .then(function(r){ if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
}
function loadBlocks(id, entry){
  DOC_BLOCKS = null;
  takeEarly("blocks", id, fetchBlocks)
    .then(function(d){ renderBlocks(id, d, null, entry); })
    .catch(function(e){ renderBlocks(id, null, String(e && e.message || e), entry); });
}

function setView(v){
  VIEW = v;
  $("vList").setAttribute("aria-pressed", String(v === "list"));
  $("vDesk").setAttribute("aria-pressed", String(v === "desk"));
  $("listing").hidden = v !== "list";
  $("desktop").hidden = v !== "desk";
  render();
}

/* THE ENTRY'S OWN FILES START NOW, beside the index rather than behind it.
   An entry page exists to show one document, and its id is in the page's own
   path: waiting for the whole library's index.json before asking for the
   entry's document and blocks put a full round trip, and the largest file on
   the page, in front of the thing the reader came for. The responses are
   held here and handed to loadDocument and loadBlocks when selectEntry
   (which needs the index, for the entry's row) calls them, so nothing is
   fetched twice. A path that names no entry of this library starts nothing:
   honourAddress still says "not found", from the index, as before. */
var EARLY = {};
function takeEarly(kind, id, start){
  var held = EARLY[kind];
  if (held && held.id === id) { EARLY[kind] = null; return held.p; }
  return start(id);
}
(function startEntry(){
  if (!SCOPE) return;
  var at = entryFromPath(location.pathname, LIB_ROOT);
  if (!at || at.instance !== SCOPE) return;
  /* A rejection is caught where it is TAKEN; this only stops an unhandled
     warning when it never is (an id the index turns out not to hold). */
  EARLY.blocks = { id: at.id, p: fetchBlocks(at.id) };
  EARLY.blocks.p.catch(function(){});
  EARLY.document = { id: at.id, p: fetchDocument(at.id) };
  EARLY.document.p.catch(function(){});
})();

fetch(DATA_HREF).then(function(r){
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}).then(function(data){
  G = data;
  /* A sortable number for the referenced-by column. -1 for "not scanned" so
     it sorts apart from a real zero rather than beside it. */
  G.entries.forEach(function(e){ e.refCount = e.referencedBy ? e.referencedBy.length : -1; });
  var scoped = G.entries.filter(inScope);
  var words = scoped.reduce(function(n,e){ return n + e.words; }, 0);
  $("status").textContent = (SCOPE ? SCOPE + " · " : "") + scoped.length + " entries · " +
    words.toLocaleString() + " words · " +
    scoped.reduce(function(n,e){ return n + e.sections; }, 0) + " sections";
  if (SCOPE) document.title = SCOPE + " — library";
  $("badges").innerHTML = G.queues.filter(inScope).map(function(q){
    return '<span class="badge q"><b>'+q.uningested+"</b> uningested in <code>"+esc(q.dir)+
      "</code> <span style=\"color:var(--muted)\">of "+q.total+"</span></span>";
  }).join("");
  /* THE SUMMARY DRAIN'S BACKLOG, for the entries this page shows. Advisory,
     like every drain here: styled as a count, never as a failure. Absent
     when the projection carries no count -- nobody counted is not zero. */
  var counted = scoped.filter(function(e){ return e.summaries; });
  if (counted.length) {
    var sb = counted.reduce(function(n,e){ return n + e.summaries.backlog; }, 0);
    var sp = counted.reduce(function(n,e){ return n + e.summaries.prose; }, 0);
    var sd = counted.reduce(function(n,e){ return n + e.summaries.draft; }, 0);
    $("badges").innerHTML += '<span class="badge"><b>' + sb + "</b> of " + sp +
      " prose block(s) not yet summarised" + (sd ? ", <b>" + sd + "</b> agent draft(s) awaiting a person" : "") + "</span>";
  }
  if (G.refScan) {
    var none = scoped.filter(function(e){ return e.refCount === 0 && e.provenance !== "catalogued"; }).length;
    $("badges").innerHTML += '<span class="badge">' +
      (none ? '<b>'+none+"</b> entr(ies) referenced by nothing" : "references scanned") +
      (G.refScan.unreadable.length
        ? ' <span class="pill warn" title="'+esc(G.refScan.unreadable.join("\n"))+'">'+
          G.refScan.unreadable.length+" unreadable — the zeros are provisional</span>"
        : "") + "</span>";
  }
  $("q").addEventListener("input", render);
  $("vList").addEventListener("click", function(){ setView("list"); });
  $("vDesk").addEventListener("click", function(){ setView("desk"); });
  $("listing").addEventListener("click", function(e){
    var b = e.target.closest("button[data-k]");
    if (!b) return;
    var k = b.getAttribute("data-k");
    SORT = { key: k, dir: SORT.key === k ? -SORT.dir : 1 };
    renderList();
  });
  render();
  // The uploads queue has its own page (gen-uploads-viz.ts); the library page shows the corpus only (owner, 2026-11-13).
  honourAddress();
  window.addEventListener("hashchange", honourAddress);
}).catch(function(e){
  $("status").textContent = "could not load the projection: " + e.message;
  $("listing").innerHTML = '<p class="empty">The projection at <code>' + esc(DATA_HREF) + '</code> could not be read. ' +
    "That is not an empty corpus \u2014 it is a corpus that could not be loaded, and the page says so rather than showing nothing.</p>";
});

(function(){
  var box = document.getElementById("lib-lang-toggle");
  var dataEl = document.getElementById("lib-versions-data");
  if (!box || !dataEl) return;
  var d; try { d = JSON.parse(dataEl.textContent || "{}"); } catch (_e) { return; }
  var vs = d.versions || [];
  var loc = "en"; try { loc = localStorage.getItem("fa-locale") || "en"; } catch (_e) {}
  var cur = vs.filter(function(v){ return v.id === d.current; })[0];
  var src = vs.filter(function(v){ return v.source; })[0];
  var mine = vs.filter(function(v){ return v.lang === loc; })[0];
  if (!cur || !src) return;
  var other = cur.source ? mine : src;
  if (cur.source && loc !== src.lang && !mine) {
    box.innerHTML = '<p class="note">No official WHO translation of this publication into your chosen language (' + esc(loc) + ').</p>';
    box.hidden = false; return;
  }
  if (!other || other.id === cur.id) return;
  var pair = cur.source ? [cur, other] : [other, cur];
  box.innerHTML = '<span class="seg" role="group" aria-label="Language">' + pair.map(function(v){
    var label = esc(v.name) + (v.source ? " (source)" : " (WHO official)");
    return v.id === cur.id
      ? '<button type="button" aria-pressed="true" lang="' + esc(v.lang) + '">' + label + "</button>"
      : '<a class="seg-link" role="button" aria-pressed="false" lang="' + esc(v.lang) + '" hreflang="' + esc(v.lang) + '" href="' + esc(v.href) + '">' + label + "</a>";
  }).join("") + "</span>";
  box.hidden = false;
})();
