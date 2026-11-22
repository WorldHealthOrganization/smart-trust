#!/usr/bin/env bun
/**
 * A viewer over the intake QUEUE — the half of the library graph that is not
 * yet corpus.
 *
 * @module scripts/gen-uploads-viz
 * @graphNode none — a generator over the uploads half of the library graph
 * @covers none — writer — regenerates the visualisation; judges nothing
 *
 * Third sibling of `gen-schema-viz.ts` and `gen-library-viz.ts`, MINUS the
 * projection: zero-dependency, under `<site>/<handler>/<graph>/`, fetching the
 * projection relative to its own location.
 *
 * ## A separate viewer, not a tab on the library viewer
 *
 * A queue has none of what the library viewer reads (bib-slugs, `sections/`,
 * `structure.json`, the OCR three-state), and its job is the opposite: uploads
 * is the incoming queue and is **not greppable by the corpus checklist**
 * (`docs/source/guides-document-ingestion/uploads-and-library-are-two-stages-of-one-pipeline.md`),
 * so a paper still in `uploads/` makes a clean corpus grep read as "nobody
 * has done this". The headline here is therefore the UNINGESTED count.
 *
 * ## ONE DATASET, TWO VIEWERS
 *
 * The queue block is published inside `assets/library/index.json`
 * (`state-visualizer.ts`): two projections would be two answers to "how many
 * are queued". So this emits NO projection; `library:viz` owns the dataset and
 * this renders its queue half.
 *
 * ## Three states, not a tick and a cross
 *
 * `waiting` and `ingested` are the two the reader can determine. The third is
 * `sidecar-free`: an intake DIRECTORY declares which files are the capture, so
 * a loose file and a declared intake are different units and are labelled as
 * such (`UploadItem.kind`), never each counted as "a document".
 *
 * Usage:
 *   bun run cat uploads:viz          # write
 *   bun run cat uploads:viz:check    # fail if either artefact is stale
 */
import { basename, join } from "node:path";

import { readLibraryGraph, type UploadItem } from "./library-graph.ts";
import { viewerPlacement } from "./gen-schema-viz.ts";
import {
  checkoutRootFor,
  directoriesForGraph,
  layerRootsIn,
  readDeclaration,
  siteDirFor,
} from "../schemas/kg/cat-harness.ts";
import { makeEmit } from "./viewer-page.ts";
import { declaredPageRoute, withRenderedByFrontMatter } from "./viewer-declarations.js";
import { subjectNav, subjectNavCss, themedPage } from "./lib/themed-page.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { siteTarget } from "./lib/site-target.ts";

/** This generator's Tool node (`tools/viewers.ts`), named on every page it draws. */
const VIEWER_TOOL = "uploads-viewer";

const ROOT = join(HARNESS_ROOT);
const check = process.argv.includes("--check");
let stale = 0;

/** `waiting` | `ingested` — the two the reader can determine. */
export function itemState(u: UploadItem): "waiting" | "ingested" {
  return u.ingestedBy ? "ingested" : "waiting";
}

/**
 * The viewer. Zero dependencies, fetches its projection by a RELATIVE href so
 * the same bytes serve the canonical deploy and a branches/ preview — the
 * baseurl lesson #801 paid for, one layer along.
 *
 * A THEMED Jekyll page since 2026-10-07 (`lib/themed-page.ts`): on the
 * site's `default` layout, so it carries the top band (search, Folio,
 * language) that only that layout delivers. Every rule is scoped under
 * `.up-page` — on the layout a rule on `body`, `:root` or `a` would
 * restyle the theme. The two state hues are keyed on the site's own scheme
 * switch (`data-fa-scheme`, which `head_custom.html` always sets), dark
 * first because the site's ground is; everything else is neutral and
 * translucent, so it reads on either ground. Secondary text is secondary
 * by SIZE, never by opacity: an opacity lowers its contrast, and axe failed
 * the lead tag, the kind and the raw-capture rows on both grounds for it. `subjects` is the family's
 * subject pages, listed in the page because the theme's sidebar does not.
 */
export function viewerHtml(dataHref: string, scope = "", subjects: readonly string[] = []): string {
  return themedPage({
    title: scope ? `uploads — the intake queue — ${scope}` : "uploads — the intake queue",
    generator: "cat-harness-tools/scripts/gen-uploads-viz.ts",
    command: "bun run uploads:viz",
    body: `<style>
.up-page{--line:rgba(127,127,127,.4);--card:rgba(127,127,127,.12);
      --wait:#e3b341;--waitbg:rgba(210,153,34,.18);--ing:#56d364;--ingbg:rgba(63,185,80,.16)}
:root[data-fa-scheme="light"] .up-page{--wait:#7d5300;--waitbg:#fff8c5;--ing:#116329;--ingbg:#dafbe1}
.up-page h1{margin:0 0 .25rem}
.up-page .sub{margin:0 0 1.25rem}
.up-page .badges{display:flex;gap:.75rem;flex-wrap:wrap;margin:0 0 1.5rem}
.up-page .badge{background:var(--card);border:1px solid var(--line);border-radius:.5rem;padding:.6rem .9rem;min-width:7rem}
.up-page .badge b{display:block;font-size:1.6rem;line-height:1.1}
.up-page .badge span{font-size:.8rem}
.up-page .badge.lead{border:2px solid var(--wait);background:var(--waitbg)}
.up-page .badge.lead b{color:var(--wait)}
.up-page .badge.lead .lead-tag{display:inline-block;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:.08rem .35rem;border-radius:.25rem;border:1px solid var(--wait);background:var(--card);vertical-align:middle;margin-left:.4rem}
.up-page table{display:table;border-collapse:collapse;width:100%;font-size:.9rem}
.up-page th,.up-page td{text-align:left;padding:.45rem .6rem;border:0;border-bottom:1px solid var(--line);vertical-align:top;background:transparent}
.up-page th{user-select:none;white-space:nowrap;font-weight:600}
.up-page th button{border:0;background:transparent;padding:0;font:inherit;font-weight:600;color:inherit;cursor:pointer;text-align:inherit;white-space:nowrap}
.up-page th button:hover{text-decoration:underline;opacity:1}
.up-page th button:focus-visible{outline:2px solid var(--wait);outline-offset:2px;border-radius:.2rem}
.up-page td.num,.up-page th.num{text-align:right;font-variant-numeric:tabular-nums}
.up-page td.size,.up-page th.size,.up-page .size{white-space:nowrap;min-width:6rem}
.up-page tr.group-row th,.up-page tr.group-row td{background:var(--card);font-size:.82rem;font-weight:600;padding:.35rem .6rem;border-top:1px solid var(--line);border-bottom:1px solid var(--line);text-align:left}
.up-page .capture-tag{display:inline-block;font-size:.7rem;font-weight:600;padding:.05rem .35rem;border-radius:.25rem;background:var(--card);border:1px solid var(--line);color:inherit;vertical-align:middle;margin-left:.35rem}
.up-page .capture-name{font-style:italic}
.up-page .pill{display:inline-block;border-radius:1rem;padding:.05rem .55rem;font-size:.78rem;font-weight:600}
.up-page .pill.waiting{background:var(--waitbg);color:var(--wait)}
.up-page .pill.ingested{background:var(--ingbg);color:var(--ing)}
.up-page .kind{font-size:.78rem}
.up-page .empty{background:var(--card);border:1px dashed var(--line);border-radius:.5rem;padding:1.5rem}
.up-page .add{background:var(--card);border:1px solid var(--line);border-radius:.5rem;padding:.9rem 1.1rem;margin:1rem 0}
.up-page .add h2{font-size:1rem;margin:0 0 .4rem}
.up-page .add p{margin:.35rem 0;font-size:.9rem}
.up-page .add pre{border:1px solid var(--line);border-radius:.35rem;padding:.55rem .7rem;overflow-x:auto;margin:.4rem 0;font-size:.85em}
${subjectNavCss("up-page")}
</style>
<div class="up-page">
<h1 id="up-title">uploads — the intake queue</h1>
${subjectNav({ subjects, current: scope || undefined, cls: "up-page" })}
<p class="sub">Raw files as dropped, before ingestion. A source here is <strong>not</strong>
reachable by the corpus checklist, which searches <code>library/</code> only — so a file
waiting here makes a clean grep read as &ldquo;nobody has done this&rdquo;.</p>
<div class="badges" id="badges"></div>
<div id="add"></div>
<div id="body"></div>
</div>
<script>
var SRC = ${JSON.stringify(dataHref)};
var SCOPE = ${JSON.stringify(scope)};
function $(i){ return document.getElementById(i); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function size(n){ return n >= 1048576 ? (n/1048576).toFixed(1)+"\u00a0MB" : Math.round(n/1024)+"\u00a0KB"; }
function inScope(x){ return !SCOPE || x.instance === SCOPE; }
function state(u){ return u.ingestedBy ? "ingested" : "waiting"; }
function isRawCapture(u){
  return !u.title && (/^ChatGPT[-_ ]Image/i.test(u.file) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(u.file));
}

var ITEMS = [], QUEUES = [], sortKey = "state", sortAsc = true;

var COLS = [
  { k:"file",    t:"File",     num:false },
  { k:"kind",    t:"Unit",     num:false },
  { k:"state",   t:"State",    num:false },
  { k:"ext",     t:"Type",     num:false },
  { k:"bytes",   t:"Size",     num:true  },
  { k:"instance",t:"Queue",    num:false }
];

function cell(u, k){
  if (k === "state") {
    var s = state(u);
    return '<span class="pill '+s+'">'+s+'</span>' +
      (u.ingestedBy ? ' <span class="kind">'+esc(u.ingestedBy)+'</span>' : '');
  }
  if (k === "kind") {
    return '<span class="kind">'+esc(u.kind)+
      (u.kind === "intake" && u.declaredFiles ? ' &middot; '+u.declaredFiles+' file(s)' : '')+'</span>';
  }
  if (k === "bytes") return size(u.bytes);
  if (k === "file") {
    var isRaw = isRawCapture(u);
    var rawTag = isRaw ? ' <span class="capture-tag">raw capture</span>' : '';
    var nameCls = isRaw ? ' class="capture-name"' : '';
    return '<span' + nameCls + '>' + esc(u.file) + '</span>' + rawTag +
      (u.title ? '<br><span class="kind">'+esc(u.title)+'</span>' : '');
  }
  if (k === "ext") return u.ext ? '<code>'+esc(u.ext)+'</code>' : '<span class="kind">&mdash;</span>';
  return esc(u[k]);
}

function sorted(){
  var rows = ITEMS.filter(inScope).slice();
  rows.sort(function(a,b){
    if (sortKey === "state") {
      var sa = state(a) === "waiting" ? 0 : 1;
      var sb = state(b) === "waiting" ? 0 : 1;
      if (sa !== sb) return sortAsc ? sa - sb : sb - sa;
      var ra = isRawCapture(a) ? 1 : 0;
      var rb = isRawCapture(b) ? 1 : 0;
      if (ra !== rb) return ra - rb;
      var fa = String(a.file || "").toLowerCase();
      var fb = String(b.file || "").toLowerCase();
      return fa < fb ? -1 : fa > fb ? 1 : 0;
    }
    var x = a[sortKey];
    var y = b[sortKey];
    if (typeof x === "number" && typeof y === "number") return sortAsc ? x-y : y-x;
    x = String(x).toLowerCase(); y = String(y).toLowerCase();
    return sortAsc ? (x<y?-1:x>y?1:0) : (x<y?1:x>y?-1:0);
  });
  return rows;
}

function render(){
  var qs = QUEUES.filter(inScope);
  var waiting = qs.reduce(function(n,q){ return n + q.uningested; }, 0);
  var total   = qs.reduce(function(n,q){ return n + q.total; }, 0);
  var ingested= qs.reduce(function(n,q){ return n + q.ingested; }, 0);
  // The uningested count LEADS, because it is the one that makes a clean
  // corpus grep lie. A total would read as reassurance.
  $("badges").innerHTML =
    '<div class="badge lead" role="status" aria-label="'+waiting+' waiting to be ingested">' +
      '<b><span class="lead-icon" aria-hidden="true">&#x23f3; </span>'+waiting+
      '<span class="lead-tag">action needed</span></b>' +
      '<span>waiting to be ingested</span>' +
    '</div>' +
    '<div class="badge"><b>'+ingested+'</b><span>ingested into library/</span></div>' +
    '<div class="badge"><b>'+total+'</b><span>queued units</span></div>' +
    '<div class="badge"><b>'+qs.length+'</b><span>queue(s)</span></div>';

  // ── ADDING TO THE QUEUE — the owner's 2026-09-23 ruling: a COMMIT FROM A
  // CHECKOUT. So the affordance is the path and the command, not a button: a
  // published page cannot write to somebody's working tree, and a control
  // that looked like it could would be the dead link pb04 forbids, one layer
  // up.
  //
  // NO BACKTICKS IN THIS COMMENT. It sits inside the page template literal,
  // and one here ends the string and turns the rest of the file into
  // TypeScript — which is what happened on the first draft, failing at a line
  // far from the mistake. The same warning is already written twice elsewhere
  // in this repository, which is how I knew where to look.
  //
  // PER QUEUE, because there are three with different paths. A single
  // hardcoded "put it in uploads/" would be wrong for two of them — the same
  // defect as ingest's printed -o, which named one directory for two arms
  // that wanted different ones (#1050).
  //
  // AND NO --library VALUE IS PRINTED, which is the part that had to be
  // measured rather than assumed. A sibling convention (<instance>/library)
  // looks obvious and the corpus contradicts it in ALL THREE queues:
  // uploads/ has landed files in agent-skills (5) AND the DAK base layer (7);
  // cat-harness/uploads in cat-harness (5) AND the formal-math layer (1);
  // the IRIS replica's uploads in none at all, where the convention would have
  // confidently said that replica's library. A QUEUE HAS NO SINGLE DESTINATION —
  // the choice is per document, which is exactly why ingest itself refuses to
  // guess it. The page says the same thing the tool says.
  $("add").innerHTML = qs.length === 0 ? "" :
    '<div class="add"><h2>Adding a source</h2>' +
    '<p>Sources are added by <b>committing them from a checkout</b> \u2014 this page shows the queue, it cannot write to it.</p>' +
    qs.map(function(q){
      return '<p>Into <code>' + q.dir + '/</code>:</p>' +
        '<pre>cp YOUR-FILE.pdf ' + q.dir + '/\\n' +
        'git add ' + q.dir + '/YOUR-FILE.pdf &amp;&amp; git commit\\n' +
        'bun run cat ingest ' + q.dir + '/YOUR-FILE.pdf --library &lt;destination&gt;</pre>';
    }).join("") +
    '<p><code>--library</code> is <b>chosen, never derived</b>: files from one queue have been ingested into several libraries, so a queue does not determine a destination. <code>ingest</code> lists the declared ones and refuses to guess.</p>' +
    '</div>';

  var rows = sorted();
  if (!rows.length) {
    // An empty queue is a DETERMINED answer and is not an error: nothing is
    // waiting. It is rendered as calm rather than as a gap.
    $("body").innerHTML = '<div class="empty">Nothing in the queue. Every source that arrived has been ingested into <code>library/</code>.</div>';
    return;
  }
  var h = '<table><thead><tr>' + COLS.map(function(c){
    var isSorted = sortKey === c.k;
    var sortAttr = isSorted ? (sortAsc ? ' aria-sort="ascending"' : ' aria-sort="descending"') : ' aria-sort="none"';
    var mark = isSorted ? (sortAsc ? " \\u25b4" : " \\u25be") : "";
    var thCls = (c.num ? "num " : "") + (c.k === "bytes" ? "size " : "") + "col-" + c.k;
    return '<th class="'+thCls+'"'+sortAttr+' data-k="'+c.k+'"><button type="button" data-k="'+c.k+'">'+esc(c.t)+mark+'</button></th>';
  }).join("") + '</tr></thead>';

  if (sortKey === "state") {
    var waitingRows = rows.filter(function(u){ return state(u) === "waiting"; });
    var ingestedRows = rows.filter(function(u){ return state(u) === "ingested"; });
    var groups = sortAsc ?
      [ { name: "Waiting to be ingested", rows: waitingRows }, { name: "Ingested into library/", rows: ingestedRows } ] :
      [ { name: "Ingested into library/", rows: ingestedRows }, { name: "Waiting to be ingested", rows: waitingRows } ];
    groups.forEach(function(g){
      if (!g.rows.length) return;
      h += '<tbody><tr class="group-row"><th colspan="6" scope="colgroup">' + esc(g.name) + ' &middot; <span class="kind">' + g.rows.length + ' unit(s)</span></th></tr>';
      h += g.rows.map(function(u){
        var isRaw = isRawCapture(u);
        return '<tr' + (isRaw ? ' class="raw-capture"' : '') + '>' + COLS.map(function(c){
          var cls = (c.num ? "num " : "") + (c.k === "bytes" ? "size " : "") + "col-" + c.k;
          return '<td class="'+cls+'">'+cell(u,c.k)+'</td>';
        }).join("") + '</tr>';
      }).join("");
      h += '</tbody>';
    });
  } else {
    h += '<tbody>' + rows.map(function(u){
      var isRaw = isRawCapture(u);
      return '<tr' + (isRaw ? ' class="raw-capture"' : '') + '>' + COLS.map(function(c){
        var cls = (c.num ? "num " : "") + (c.k === "bytes" ? "size " : "") + "col-" + c.k;
        return '<td class="'+cls+'">'+cell(u,c.k)+'</td>';
      }).join("") + '</tr>';
    }).join("") + '</tbody>';
  }
  h += '</table>';
  $("body").innerHTML = h;

  Array.prototype.forEach.call(document.querySelectorAll("th[data-k]"), function(th){
    th.addEventListener("click", function(){
      var k = th.getAttribute("data-k");
      if (k === sortKey) sortAsc = !sortAsc; else { sortKey = k; sortAsc = true; }
      render();
    });
  });
}

fetch(SRC).then(function(r){ return r.json(); }).then(function(d){
  // The library projection, read for its QUEUE HALF ONLY. "d.entries" is
  // deliberately untouched: rendering it here is how this becomes a second
  // library viewer, which is the thing the owner ruled against.
  // (No backticks in this comment on purpose -- it lives INSIDE the generator's
  //  template literal, where one would end the string. It already did once.)
  ITEMS = d.uploads || []; QUEUES = d.queues || []; render();
}).catch(function(e){
  // A failed fetch and an empty queue are OPPOSITE facts and must not look
  // alike — the same rule the todo board states for its own index.
  $("body").innerHTML = '<div class="empty">Could not read the queue projection (<code>'+esc(SRC)+
    '</code>). This is not the same as an empty queue.</div>';
  console.error(e);
});
</script>`,
  });
}

/**
 * The viewer `emit`. No `nav` since 2026-10-07: the pages are themed, so
 * the theme's sidebar is their navigation and there is no rail to inject
 * (`withViewerNav` passes a page with front matter through unchanged).
 */
const emitPage = makeEmit({ check, onStale: () => { stale++; } });

if (import.meta.main) {
  const repoRoot = checkoutRootFor(ROOT);
  const site = siteTarget(join(ROOT, siteDirFor(ROOT)));
  const g = readLibraryGraph(layerRootsIn(repoRoot), repoRoot);
  if (g === null) {
    console.log("  · no library graph could be read — nothing to publish");
    process.exit(0);
  }

  // The published segment is the DECLARED directory's own name, read rather
  // than written down, so a rename moves the source and the URL together —
  // the rule `gen-library-viz` states and the one `#801` is a case of.
  const upDirs = directoriesForGraph(ROOT, "uploads");
  const seg = upDirs.length > 0 ? basename(upDirs[0]!) : null;
  if (seg === null) {
    console.log("  · no uploads directory declared by this instance — nothing to publish");
    process.exit(0);
  }
  const handler = readDeclaration(ROOT)?.name;
  if (!handler) {
    console.log("  · this instance declares no name — no handler segment to publish under");
    process.exit(0);
  }

  // THE ROUTE IS DECLARED (owner, 2026-10-09): `<locale>/<harness>/<id>/`, from the
  // visualiser this harness declares `renderedBy` this Tool — never composed
  // here from the directory's name.
  const route = declaredPageRoute(ROOT, VIEWER_TOOL);
  if (route === undefined) {
    console.log(`  · no visualiser declared rendered by ${VIEWER_TOOL} — nothing to publish`);
    process.exit(0);
  }

  // `kind` is `library`, NOT `seg`. That is what makes the href point at the
  // ONE dataset rather than minting a second — see the header. The PAGE still
  // sits on the uploads route, so the tile opens a queue view.
  const { pageDir, dataHref } = viewerPlacement(site, route, "library");
  const subjects = [...new Set(g.queues.map((q) => q.instance))].sort();
  emitPage(join(pageDir, "index.html"), withRenderedByFrontMatter(viewerHtml(dataHref, "", subjects), VIEWER_TOOL));

  // One page per SUBJECT — read from the QUEUES rather than from the declared
  // directory list, so a declared-but-empty uploads directory gets no page
  // claiming to show it. `dh4f`, one layer along.
  for (const subject of subjects) {
    const sub = viewerPlacement(site, `${route}/${subject}`, "library");
    emitPage(join(sub.pageDir, "index.html"), withRenderedByFrontMatter(viewerHtml(sub.dataHref, subject, subjects), VIEWER_TOOL));
  }

  if (!check) {
    const waiting = g.queues.reduce((n, q) => n + q.uningested, 0);
    console.log(
      `  ${g.queues.length} queue(s), ${g.uploads.length} queued unit(s), ` +
        `${waiting} waiting, ${subjects.length} subject page(s)`,
    );
  }
  if (stale > 0) {
    console.error(`\n${stale} artefact(s) stale — run \`bun run cat uploads:viz\``);
    process.exit(1);
  }
}
