#!/usr/bin/env bun
/**
 * Publish the voices graph as a projection, and a viewer over it.
 *
 * @module scripts/gen-voices-viz
 * @covers voices
 * @graphNode none — a generator over the voices graph, not a schema itself
 *
 * The same three pieces as `gen-library-viz.ts` and `gen-schema-viz.ts`: a
 * reader (`voices-graph.ts`), a projection under `<site>/assets/<graph>/`, and
 * a zero-dependency viewer under `<site>/<handler>/<graph>/` that fetches the
 * projection relative to its own location. The published segment is the
 * DECLARED directory's own name.
 *
 * ## The page's one job: show the citations
 *
 * Every rule carries the page and the quote it was read from, machine-checked
 * by `check-voices.ts`. The rule row leads with the quote, and the citation is
 * the column that cannot be sorted away.
 *
 * ## A declared-but-absent directory gets a ROW, not silence
 *
 * `agent-skills` declares a `voices` graph and ships none; the directories
 * panel lists it as declared-but-absent rather than omitting it.
 *
 * Usage:
 *   bun run cat voices:viz          # write
 *   bun run cat voices:viz:check    # fail if either artefact is stale
 */
import { existsSync, rmSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

import { readVoicesGraph, type VoicesGraph } from "./voices-graph.ts";
import { orphanSubjectPages, viewerPlacement } from "./gen-schema-viz.ts";
import {
  directoriesForGraph,
  layerRootsIn,
  readDeclaration,
  repoRootFor,
  siteDirFor,
  sourceLinks,
} from "../schemas/kg/cat-harness.ts";
import { tileCounts } from "../schemas/ui/tile-count.js";
import { makeEmit } from "./viewer-page.ts";
import { declaredPageRoute, withRenderedByFrontMatter } from "./viewer-declarations.js";
import { subjectNav, subjectNavCss, themedPage } from "./lib/themed-page.ts";
import { libraryResolver, type LibraryResolver } from "./lib/library-links.ts";
import { SKILL_PAGES_DIR, skillPagesOf } from "./lib/skill-pages.ts";
import { detectRepoUrl } from "../src/core/git-refs.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { siteTarget } from "./lib/site-target.ts";

/** This generator's Tool node (`tools/viewers.ts`), named on every page it draws. */
const VIEWER_TOOL = "voices-viewer";

const ROOT = join(HARNESS_ROOT);
const check = process.argv.includes("--check");

/**
 * The projection. Everything the reader found; it is already small.
 *
 * `links`, when given, resolves a LIBRARY citation to the three places the
 * owner asked a library reference to go (bean `qgjh`, `lib/library-links.ts`):
 * the viewer opened on the item, the item's README, and its upstream record.
 * Each rule gets `links` only where its citation resolves, so an unresolved one
 * stays text on the page rather than becoming a 404.
 */
export function projection(
  g: VoicesGraph,
  links?: LibraryResolver,
  kgLinks?: (kgPath: string, instance: string | undefined) => { viewer?: string; source?: string } | undefined,
): unknown {
  const linked =
    links === undefined
      ? g
      : {
          ...g,
          voices: g.voices.map((v) => ({
            ...v,
            rules: v.rules.map((r) => {
              if (r.cites === undefined) return r;
              const l =
                r.citation === "library"
                  ? links.links(r.cites.split("#")[0]!, r.citesInstance)
                  : r.citation === "kg-node"
                    ? kgLinks?.(r.cites, r.citesInstance)
                    : undefined;
              return l === undefined ? r : { ...r, links: l };
            }),
          })),
        };
  return {
    $schema: "folio-voices-index/v1",
    // `totals.voices`, which the graph already computes for the badge row, so
    // the tile and the page cannot disagree — rather than `voices.length`,
    // which would be the same number arrived at twice. `directories` is the
    // container the voices were found in, not a count of voices.
    ...tileCounts({ voices: [g.totals.voices, "voices"] }),
    ...linked,
  };
}

/**
 * The viewer, as a THEMED Jekyll page since 2026-10-07 (`lib/themed-page.ts`):
 * on the site's `default` layout, so it carries the top band (search, Folio,
 * language) that only that layout delivers. `subjects` lists the family's
 * subject pages in the page, because the theme's sidebar does not.
 */
export function viewerHtml(dataHref: string, scope = "", subjects: readonly string[] = []): string {
  // NO BACKTICKS BELOW THIS LINE — not in strings, not in comments.
  //
  // The whole page is one template literal, so a backtick anywhere inside it
  // terminates the string and the rest becomes TypeScript. It has happened
  // twice in the sibling generator, both times in a COMMENT. `check:viz-backticks`
  // gates it (bean bmr0), and this file is in its scope.
  return themedPage({
    title: scope ? `Voices — what each rule cites — ${scope}` : "Voices — what each rule cites",
    generator: "cat-harness-tools/scripts/gen-voices-viz.ts",
    command: "bun run voices:viz",
    body: `<style>
/* THEMED since 2026-10-07: every rule is under .vo-page, because on the
   theme's layout a rule on body, :root or a would restyle the site. The
   palette is keyed on the site's own scheme switch (data-fa-scheme, which
   head_custom.html always sets), dark first because the site's ground is;
   surfaces are translucent so they sit on either ground. */
.vo-page {
  color-scheme:dark;
  --fg:currentColor; --muted:#bcbab3; --line:rgba(127,127,127,.4); --panel:rgba(127,127,127,.12);
  --accent:#c4a2e0; --accent-soft:rgba(196,162,224,.12); --warn:#e0b25e; --warn-soft:rgba(224,178,94,.12);
  --info:#8db4ec; --info-soft:rgba(122,167,232,.14); --box:transparent;
  --crit:#f2a0a0; --crit-soft:rgba(242,160,160,.12);
}
:root[data-fa-scheme="light"] .vo-page {
  color-scheme:light;
  --muted:#5b6168; --accent:#5b2d82; --accent-soft:#f0e9f7; --warn:#8a5300; --warn-soft:#fdf3e0;
  --info:#1a5fb4; --info-soft:#e7eefb; --crit:#9b1c1c; --crit-soft:#fdeaea;
}
.vo-page * { box-sizing:border-box; }
.vo-page .vo-head { padding:16px; border-bottom:1px solid var(--line); }
.vo-page h1 { margin:0 0 6px; }
.vo-page h2 { font-size:1rem; margin:0; }
.vo-page p.lede { margin:6px 0 0; color:var(--muted); max-width:62ch; font-size:.9rem; }
.vo-page .badges { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0 0; }
.vo-page .badge { border:1px solid var(--line); border-radius:8px; padding:5px 10px; font-size:.82rem; background:var(--panel); }
.vo-page .badge b { font-variant-numeric:tabular-nums; }
.vo-page .badge.warn { border-color:var(--warn); background:var(--warn-soft); }
.vo-page .toolbar { padding:10px 16px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;
  border-bottom:1px solid var(--line); }
.vo-page input, .vo-page select, .vo-page button { font:inherit; color:var(--fg); background:var(--box);
  border:1px solid var(--line); border-radius:6px; padding:6px 9px; }
.vo-page input { flex:1 1 220px; min-width:0; }
.vo-page .vo-main { padding:16px; }
.vo-page .voice { border:1px solid var(--line); border-radius:10px; margin:0 0 16px; background:var(--box); overflow:hidden; }
.vo-page .voice > summary { padding:12px 14px; cursor:pointer; background:var(--panel); list-style:none; }
.vo-page .voice > summary::-webkit-details-marker { display:none; }
.vo-page .voice > summary::before { content:"\\25B8"; display:inline-block; width:1em; color:var(--muted); }
.vo-page .voice[open] > summary::before { content:"\\25BE"; }
.vo-page .vhead { display:flex; flex-wrap:wrap; gap:10px; align-items:baseline; }
.vo-page .vhead .id { font-family:var(--fa-font-mono,Menlo,Consolas,monospace); font-size:.85rem; color:var(--muted); }
.vo-page .vmeta { margin:6px 0 0 1em; color:var(--muted); font-size:.84rem; }
.vo-page .vmeta code { font-size:.95em; }
.vo-page .rules { padding:4px 14px 14px; }
.vo-page .rule { border-top:1px solid var(--line); padding:12px 0 2px; }
.vo-page .rule:first-child { border-top:0; }
.vo-page .rtitle { font-weight:600; }
.vo-page .rid { font-family:var(--fa-font-mono,Menlo,Consolas,monospace); font-size:.8rem; color:var(--muted); margin-left:6px; }
.vo-page .rdesc { margin:4px 0 0; font-size:.9rem; }
.vo-page blockquote { margin:8px 0 6px; padding:8px 12px; border-left:3px solid var(--accent);
  background:var(--accent-soft); font-size:.9rem; }
.vo-page blockquote .cite { display:block; margin-top:6px; color:var(--muted); font-size:.82rem;
  font-family:var(--fa-font-mono,Menlo,Consolas,monospace); }
.vo-page .chips { display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 10px; }
.vo-page .chip { border:1px solid var(--line); border-radius:999px; padding:2px 9px; font-size:.78rem; background:var(--panel); }
.vo-page .chip.sev-critical { color:var(--crit); background:var(--crit-soft); border-color:var(--crit); }
.vo-page .chip.sev-major { color:var(--warn); background:var(--warn-soft); border-color:var(--warn); }
.vo-page .chip.mech { color:var(--info); background:var(--info-soft); border-color:var(--info); }
.vo-page .chip.ci { color:var(--warn); background:var(--warn-soft); border-color:var(--warn); }
/* A provenance FLAG is a question for a person, so it is warn and never crit —
   the same distinction .nocite below draws from the other side. Backticks stay
   OUT of this file's page template: it is one template literal, and a stray
   pair reads as a tagged template and fails the generator. */
.vo-page .pflag { color:var(--warn); background:var(--warn-soft); border:1px solid var(--warn);
  border-radius:6px; padding:.5rem .7rem; margin:.4rem 0 0; font-size:.86rem; }
.vo-page .pflag b { font-weight:700; }
.vo-page .nocite { color:var(--crit); background:var(--crit-soft); border:1px solid var(--crit);
  border-radius:6px; padding:8px 12px; font-size:.9rem; margin:8px 0; }
.vo-page table.dirs { display:table; border-collapse:collapse; width:100%; font-size:.86rem; margin:0 0 20px; }
.vo-page table.dirs th, .vo-page table.dirs td { border:0; background:transparent; text-align:left; padding:7px 10px; border-bottom:1px solid var(--line); }
.vo-page table.dirs code { font-size:.95em; }
.vo-page td.absent { color:var(--warn); font-weight:600; }
.vo-page .empty { color:var(--muted); padding:20px 0; }
.vo-page .vo-foot { margin:0; padding:14px 16px; border-top:1px solid var(--line); color:var(--muted); font-size:.82rem; }
${subjectNavCss("vo-page")}
</style>
<div class="vo-page">
<div class="vo-head">
  <h1 id="vo-title">Voices</h1>
  ${subjectNav({ subjects, current: scope || undefined, cls: "vo-page" })}
  <p class="lede">Every voice this repository's instances declare, with the passage each
    rule was read from. A voice is auditable rather than asserted: uphold a finding by
    opening the citation, never by trusting a restatement.</p>
  <div class="badges" id="badges"></div>
</div>
<div class="toolbar">
  <input id="q" type="search" placeholder="Search voices, rules, quotes…" aria-label="Search">
  <select id="inst" aria-label="Filter by instance"><option value="">every instance</option></select>
  <select id="sev" aria-label="Filter by rule severity">
    <option value="">every severity</option>
    <option value="critical">critical</option>
    <option value="major">major</option>
    <option value="minor">minor</option>
  </select>
  <button id="expand" type="button">expand all</button>
</div>
<div class="vo-main">
  <table class="dirs" id="dirs"><caption class="empty" style="text-align:left;padding:0 0 6px">
    Declared <code>voices</code> directories</caption></table>
  <div id="out"></div>
</div>
<p class="vo-foot" id="foot"></p>
</div>
<script>
var SCOPE = "${scope}";
// The site root, from where this page reads its data (assets/voices/),
// so a site-relative library link works under any base — the bare site, the
// project baseurl, or a staging preview.
var SITE_ROOT = (function (h) { var i = h.lastIndexOf("assets/"); return i < 0 ? "" : h.slice(0, i); })("${dataHref}");
var DATA = null;
var esc = function (s) {
  return String(s === undefined || s === null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
};

fetch("${dataHref}").then(function (r) { return r.json(); }).then(function (d) {
  DATA = d;
  var insts = [];
  d.voices.forEach(function (v) { if (insts.indexOf(v.instance) < 0) insts.push(v.instance); });
  insts.sort().forEach(function (i) {
    var o = document.createElement("option");
    o.value = i; o.textContent = i;
    document.getElementById("inst").appendChild(o);
  });
  if (SCOPE) { document.getElementById("inst").value = SCOPE; }
  renderBadges(); renderDirs(); render();
}).catch(function (e) {
  document.getElementById("out").innerHTML =
    '<p class="nocite">The projection could not be loaded: ' + esc(e.message) + "</p>";
});

function renderBadges() {
  var t = DATA.totals;
  var absent = DATA.directories.filter(function (d) { return !d.present; }).length;
  var b = [
    '<span class="badge"><b>' + t.voices + "</b> voice(s)</span>",
    '<span class="badge"><b>' + t.rules + "</b> rule(s)</span>",
    '<span class="badge"><b>' + t.citingLibrary + "</b> citing an ingested source</span>",
    '<span class="badge"><b>' + t.citingKgNode + "</b> citing a KG node</span>",
    '<span class="badge"><b>' + t.mechanical + "</b> with a mechanical half</span>"
  ];
  if (absent > 0) {
    b.push('<span class="badge warn"><b>' + absent + "</b> declared directory(ies) absent</span>");
  }
  document.getElementById("badges").innerHTML = b.join("");
}

function renderDirs() {
  var rows = ["<tr><th>instance</th><th>directory</th><th>voices</th></tr>"];
  DATA.directories.forEach(function (d) {
    rows.push(
      "<tr><td>" + esc(d.instance) + "</td><td><code>" + esc(d.dir) + "</code></td>" +
      (d.present
        ? "<td>" + d.voices.length + "</td>"
        : '<td class="absent">declared, not present</td>') +
      "</tr>"
    );
  });
  document.getElementById("dirs").innerHTML = rows.join("");
}

function ruleMatches(r, q, sev) {
  if (sev && r.severity !== sev) return false;
  if (!q) return true;
  var hay = (r.id + " " + r.title + " " + r.description + " " + r.quote + " " +
    (r.cites || "") + " " + r.category).toLowerCase();
  return hay.indexOf(q) >= 0;
}

function render() {
  var q = document.getElementById("q").value.trim().toLowerCase();
  var inst = document.getElementById("inst").value;
  var sev = document.getElementById("sev").value;
  var open = document.getElementById("expand").getAttribute("data-open") === "1";
  var html = [];
  var shownVoices = 0, shownRules = 0;

  DATA.voices.forEach(function (v) {
    if (inst && v.instance !== inst) return;
    var rules = v.rules.filter(function (r) { return ruleMatches(r, q, sev); });
    // A voice whose HEADER matches keeps all its rules: searching for a voice
    // by name should show you the voice, not an empty shell of it.
    var headHit = q && (v.id + " " + v.title + " " + v.description).toLowerCase().indexOf(q) >= 0;
    if (headHit && !sev) { rules = v.rules; }
    if (rules.length === 0 && !headHit) return;
    shownVoices++; shownRules += rules.length;

    var meta = [
      "shipped by <b>" + esc(v.instance) + "</b>",
      "<code>" + esc(v.path) + "</code>",
      v.rules.length + " rule(s)",
      "overlay <code>" + esc(v.criterion) + "</code> at <b>" + esc(v.overlaySeverity) + "</b>",
      v.hasInstructions ? "with a SKILL.md" : "<b>no SKILL.md</b>",
      "provenance <b>" + esc(v.provenance) + "</b>"
    ];
    if (v.sources && v.sources.length) {
      meta.push("derived from " + v.sources.map(function (s) {
        return esc(s.title) + (s.year ? " (" + s.year + ")" : "");
      }).join("; "));
    } else {
      meta.push("<b>declares no source publication</b>");
    }

    html.push(
      '<details class="voice"' + (open || q || sev ? " open" : "") + ">" +
      "<summary><span class=\\"vhead\\"><h2>" + esc(v.title) + '</h2><span class="id">' +
      esc(v.id) + "</span></span>" +
      '<div class="vmeta">' + esc(v.description) + "</div>" +
      '<div class="vmeta">' + meta.join(" &middot; ") + "</div></summary>" +
      renderFlags(v) +
      '<div class="rules">' + rules.map(renderRule).join("") + "</div></details>"
    );
  });

  document.getElementById("out").innerHTML = html.length
    ? html.join("")
    : '<p class="empty">No voice matches this filter.</p>';
  document.getElementById("foot").textContent =
    shownVoices + " voice(s), " + shownRules + " rule(s) shown" +
    (SCOPE ? " \\u2014 scoped to " + SCOPE : "");
}

// A provenance flag, where the declared value sits oddly against what the rules
// cite. Rendered as a QUESTION and never as a defect: the owner ruled on
// 2026-09-21 that this is "a QA flag", because a voice is a synthesis of
// composite voices with unclear attribution, so a mixed citation pattern is
// normal. Four of the five voices here carry none.
function renderFlags(v) {
  if (!v.provenanceFlags || !v.provenanceFlags.length) return "";
  return v.provenanceFlags.map(function (f) {
    return '<p class="pflag"><b>Provenance flag \u2014 for a person to settle.</b> ' +
      "This voice " + esc(f.detail) + ". Rule(s): " +
      f.ruleIds.map(function (id) { return "<code>" + esc(id) + "</code>"; }).join(", ") +
      ".</p>";
  }).join("");
}

function renderRule(r) {
  var chips = [
    '<span class="chip">' + esc(r.category) + "</span>",
    '<span class="chip sev-' + esc(r.severity) + '">' + esc(r.severity) + "</span>"
  ];
  if (r.patterns > 0) chips.push('<span class="chip mech">' + r.patterns + " pattern(s)</span>");
  if (r.terminology > 0) chips.push('<span class="chip mech">' + r.terminology + " term pair(s)</span>");
  if (r.judgementOnly) chips.push('<span class="chip">judgement only</span>');
  if (r.counterintuitive) chips.push('<span class="chip ci">counterintuitive</span>');

  // The citation is what this page exists for, so a rule with none is shown as
  // a FINDING rather than as an empty cell. The schema makes it unreachable;
  // if it ever appears, the schema stopped being enforced somewhere.
  var cite = r.citation === "none"
    ? '<p class="nocite">This rule cites nothing. The schema requires a source, ' +
      "so something is loading voices without validating them.</p>"
    : "<blockquote>" + esc(r.quote) + '<span class="cite">' +
      (r.citation === "library" ? "" : "KG node ") +
      (r.links && r.links.viewer
        ? '<a href="' + esc(SITE_ROOT + r.links.viewer) + '">' + esc(r.cites) + "</a>"
        : esc(r.cites)) +
      (r.pages ? ", p" + esc(r.pages) : "") +
      (r.citesInstance ? " \\u2014 in " + esc(r.citesInstance) : "") +
      (r.links && r.links.readme ? ' \\u00b7 <a href="' + esc(r.links.readme) + '">item page</a>' : "") +
      (r.links && r.links.source ? ' \\u00b7 <a href="' + esc(r.links.source) + '">source</a>' : "") +
      "</span></blockquote>";

  return '<div class="rule"><span class="rtitle">' + esc(r.title) +
    '</span><span class="rid">' + esc(r.id) + "</span>" +
    '<p class="rdesc">' + esc(r.description) + "</p>" +
    '<div class="chips">' + chips.join("") + "</div>" + cite +
    (r.commonError ? '<p class="rdesc"><b>The wrong instinct:</b> ' + esc(r.commonError) + "</p>" : "") +
    "</div>";
}

document.getElementById("q").addEventListener("input", render);
document.getElementById("inst").addEventListener("change", render);
document.getElementById("sev").addEventListener("change", render);
document.getElementById("expand").addEventListener("click", function () {
  var b = this;
  var open = b.getAttribute("data-open") === "1";
  b.setAttribute("data-open", open ? "0" : "1");
  b.textContent = open ? "expand all" : "collapse all";
  render();
});
</script>`,
  });
}

let stale = 0;

/**
 * The shared viewer `emit`, for the projection and the pages alike. No
 * `nav` since 2026-10-07: the pages are themed, so the theme's sidebar is
 * their navigation and there is no rail to inject.
 */
const emit = makeEmit({ check, onStale: () => { stale++; } });

if (import.meta.main) {
  const repoRoot = repoRootFor(ROOT);
  const g = readVoicesGraph([ROOT, repoRoot]);
  if (g === null) {
    console.log("  · no voices directory is declared — nothing to publish");
    process.exit(0);
  }

  const site = siteTarget(join(ROOT, siteDirFor(ROOT)));
  // The published segment is the DECLARED directory's own name, and THIS
  // layer declares no voices — it derives none, which is the whole point of
  // the move that produced this graph. So the segment is read from the
  // directories the graph found, whose basename is `voices` under every
  // layout that exists. Composing it here would be a second answer to a
  // question the declarations already answer, and `check:declared-paths`
  // would be right to say so.
  const own = directoriesForGraph(ROOT, "voices");
  const seg = own.length > 0
    ? basename(own[0]!)
    : g.directories.length > 0
      ? basename(g.directories[0]!.dir)
      : null;
  if (seg === null) {
    console.log("  · no voices directory to name the published segment — nothing to publish");
    process.exit(0);
  }

  // `<base>/<handler>/<kind>/` — the handler is THIS layer (the machinery),
  // the kind names what it renders. A subject page goes under it and never at
  // `<base>/<subject>/<kind>/`, which is the layer's own themed namespace.
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
  const { pageDir, dataDir, dataHref } = viewerPlacement(site, route, seg);
  // A KG-node citation is a file in the cited layer (bean `qgjh`): it links
  // to that file on the repository host, and a skill also to its published
  // instruction page. Resolved against the layer's root, and only where
  // the file exists; anything else stays text.
  const skillPages = skillPagesOf(repoRoot);
  const repoUrl = detectRepoUrl(repoRoot);
  const roots = new Map(layerRootsIn(repoRoot).map((r) => [readDeclaration(r)?.name ?? basename(r), r]));
  const kgLinks = (kgPath: string, instance: string | undefined) => {
    const root = instance === undefined ? undefined : roots.get(instance);
    if (root === undefined || !existsSync(join(root, kgPath))) return undefined;
    const rel = relative(repoRoot, join(root, kgPath)).split(sep).join("/");
    const out: { viewer?: string; source?: string } = { source: sourceLinks(repoUrl, rel, "main")?.viewHref };
    const skill = kgPath.endsWith(".md") ? basename(kgPath, ".md") : undefined;
    if (skill !== undefined && skillPages.has(skill)) out.viewer = `${SKILL_PAGES_DIR}/${skill}.html`;
    return out.source === undefined && out.viewer === undefined ? undefined : out;
  };
  emit(
    join(dataDir, "index.json"),
    JSON.stringify(projection(g, libraryResolver(repoRoot, ROOT), kgLinks), null, 2) + "\n",
  );
  const subjects = [...new Set(g.voices.map((v) => v.instance))].sort();
  emit(join(pageDir, "index.html"), withRenderedByFrontMatter(viewerHtml(dataHref, "", subjects), VIEWER_TOOL));

  // One page per SUBJECT — the layers whose voices this handler renders.
  // Read from the VOICES rather than from the directory list, so the layer
  // that declares a voices directory and ships none gets no page claiming to
  // show it. It still gets a row in the directories table, which is the
  // honest place for "declared, not present".
  for (const subject of subjects) {
    const sub = viewerPlacement(site, `${route}/${subject}`, seg);
    emit(join(sub.pageDir, "index.html"), withRenderedByFrontMatter(viewerHtml(sub.dataHref, subject, subjects), VIEWER_TOOL));
  }

  // ── ORPHANS (bean `ankg`) ──────────────────────────────────────────────
  //
  // A subject page the declaration no longer describes. `emit()` cannot see
  // one — it compares only the files it is about to write — so this is asked
  // separately, and in `--check` an orphan is a FINDING rather than silence.
  const { owned, foreign } = orphanSubjectPages(pageDir, subjects);
  for (const name of foreign) {
    // Reported and LEFT. Ownership could not be established from the file, and
    // `deletion-requires-confirmation` is about exactly this case.
    console.error(`  ! ${join(pageDir, name)} is not a subject and does not identify itself — left in place`);
  }
  for (const name of owned) {
    const dir = join(pageDir, name);
    if (check) {
      console.error(`  ✗ ${dir} is an orphan — it serves a subject the declaration no longer describes`);
      stale++;
      continue;
    }
    rmSync(dir, { recursive: true });
    console.log(`  ✗ pruned ${dir}`);
  }

  if (!check) {
    const absent = g.directories.filter((d) => !d.present).length;
    console.log(
      `  ${g.totals.voices} voice(s), ${g.totals.rules} rule(s), ` +
        `${g.totals.citingLibrary} citing an ingested source, ` +
        `${g.totals.citingKgNode} citing a KG node, ` +
        `${subjects.length} subject page(s)` +
        (absent > 0 ? `, ${absent} declared directory(ies) ABSENT` : ""),
    );
  }
  if (stale > 0) {
    console.error(`\n${stale} artefact(s) stale — run \`bun run cat voices:viz\``);
    process.exit(1);
  }
}
