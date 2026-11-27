/**
 * The bibliography's search index: a static, sharded text index the reader's
 * browser loads a few small files of at a time (owner, 2026-11-15, card
 * Q-BIBSCALE-1: "A. Oxigraph + sharded text index"). A library too large to
 * list on one page (`LIST_LIMIT`, card Q-BIBSCALE-2) is searched instead.
 *
 * Files, under `<route>/search/`:
 * - `manifest.json`: how many references, how the files are cut, the sub-graphs;
 * - `terms-<n>.json`: word → the numbers of the references holding a word that
 *   starts with it, for the words whose first two letters hash to shard n;
 * - `refs-<n>.json`: the references numbered n·REFS_PER … (n+1)·REFS_PER − 1,
 *   each its citation text, year, sub-graph and the page that lists it;
 * - `facets.json`: each reference's sub-graph and year, for the counts.
 *
 * The tokenizer and the query run in the browser as written here: the page
 * script embeds them with `Function.prototype.toString`, so the index and its
 * reader cannot drift apart.
 */

/** One reference as the index holds it. */
export interface SearchRecord {
  /** Its key. */
  k: string;
  /** Its citation, as plain text. */
  c: string;
  /** Its year, or 0. */
  y: number;
  /** Its sub-graph's number in the manifest's `subgraphs`. */
  s: number;
  /** The page that lists it, relative to the route. */
  h: string;
}

export interface SearchManifest {
  v: 1;
  count: number;
  refsPer: number;
  termShards: number;
  subgraphs: string[];
}

export const REFS_PER = 100;
/** About this many references' words to a term shard. */
const REFS_PER_TERM_SHARD = 250;
const MAX_TERM_SHARDS = 256;

/**
 * The words of a text, as the index and a query both read them: letters and
 * digits, folded to lower case without accents; a word in a script written
 * without spaces (Han, kana, Hangul) is read as its overlapping pairs of
 * characters. Words shorter than two characters are not indexed.
 */
export function tokens(text: string): string[] {
  const s = String(text).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const words = s.match(/[\p{L}\p{N}]+/gu) || [];
  const out: string[] = [];
  for (const w of words) {
    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(w)) {
      for (let i = 0; i + 1 < w.length; i++) out.push(w.slice(i, i + 2));
    } else if (w.length >= 2) out.push(w);
  }
  return out;
}

/** The term shard a word sits in: a hash of its first two characters. */
export function termShard(word: string, shards: number): number {
  const p = word.slice(0, 2);
  let h = 2166136261;
  for (let i = 0; i < p.length; i++) {
    h ^= p.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % shards;
}

/** The index's files, name → content, for the references in `records` (numbered in that order). */
export function buildSearchIndex(records: readonly SearchRecord[], subgraphs: readonly string[], words: (r: SearchRecord, i: number) => string): Map<string, string> {
  const termShards = Math.max(1, Math.min(MAX_TERM_SHARDS, Math.ceil(records.length / REFS_PER_TERM_SHARD)));
  const terms: Map<string, number[]>[] = Array.from({ length: termShards }, () => new Map());
  records.forEach((r, i) => {
    for (const w of new Set(tokens(words(r, i)))) {
      const m = terms[termShard(w, termShards)]!;
      const l = m.get(w);
      if (l) l.push(i);
      else m.set(w, [i]);
    }
  });
  const out = new Map<string, string>();
  const manifest: SearchManifest = { v: 1, count: records.length, refsPer: REFS_PER, termShards, subgraphs: [...subgraphs] };
  out.set("manifest.json", `${JSON.stringify(manifest)}\n`);
  terms.forEach((m, n) => {
    const sorted = Object.fromEntries([...m].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    out.set(`terms-${n}.json`, `${JSON.stringify(sorted)}\n`);
  });
  for (let n = 0; n * REFS_PER < records.length; n++) out.set(`refs-${n}.json`, `${JSON.stringify(records.slice(n * REFS_PER, (n + 1) * REFS_PER))}\n`);
  out.set("facets.json", `${JSON.stringify({ s: records.map((r) => r.s), y: records.map((r) => r.y) })}\n`);
  return out;
}

export interface SearchResult {
  /** How many references match. */
  total: number;
  /** The first `limit` of them, in the list's order. */
  hits: SearchRecord[];
  /** Matching references by sub-graph number, and by decade (0: no year). */
  bySubgraph: Record<number, number>;
  byDecade: Record<number, number>;
}

/**
 * A search: the references holding, for every word of the query, a word that
 * starts with it, in `scope` (a sub-graph number) and `decade` if set. `load`
 * fetches one of the index's files by name and parses it.
 */
export async function searchIndex(
  query: string,
  load: (name: string) => Promise<unknown>,
  opts: { limit?: number; scope?: number; decade?: number } = {},
): Promise<SearchResult> {
  const m = (await load("manifest.json")) as SearchManifest;
  const f = (await load("facets.json")) as { s: number[]; y: number[] };
  const qs = [...new Set(tokens(query))];
  let hit: number[] | undefined;
  if (qs.length === 0) hit = [];
  for (const q of qs) {
    const shard = (await load(`terms-${termShard(q, m.termShards)}.json`)) as Record<string, number[]>;
    const any = new Set<number>();
    for (const w in shard) if (w.indexOf(q) === 0) for (const i of shard[w]!) any.add(i);
    hit = hit === undefined ? [...any] : hit.filter((i) => any.has(i));
    if (!hit.length) break;
  }
  const decadeOf = (i: number) => (f.y[i] ? Math.floor(f.y[i]! / 10) * 10 : 0);
  const all = (hit ?? []).sort((a, b) => a - b);
  const bySubgraph: Record<number, number> = {};
  const byDecade: Record<number, number> = {};
  const inScope = all.filter((i) => opts.scope === undefined || f.s[i] === opts.scope);
  for (const i of all) bySubgraph[f.s[i]!] = (bySubgraph[f.s[i]!] || 0) + 1;
  for (const i of inScope) byDecade[decadeOf(i)] = (byDecade[decadeOf(i)] || 0) + 1;
  const kept = inScope.filter((i) => opts.decade === undefined || decadeOf(i) === opts.decade);
  const top = kept.slice(0, opts.limit ?? 50);
  const hits: SearchRecord[] = [];
  for (const i of top) {
    const refs = (await load(`refs-${Math.floor(i / m.refsPer)}.json`)) as SearchRecord[];
    hits.push(refs[i % m.refsPer]!);
  }
  return { total: kept.length, hits, bySubgraph, byDecade };
}

/** The search box on a page too long to list: `index` is the index's directory and `root` the route, from the page. */
export function searchHtml(opts: { index: string; root: string; scope?: number }): string {
  const scope = opts.scope === undefined ? "" : ` data-fa-bib-scope="${opts.scope}"`;
  return `<div class="fa-bib-search" data-fa-bib-index="${opts.index}" data-fa-bib-root="${opts.root}"${scope}>
<label for="fa-bib-s">Search references</label>
<input id="fa-bib-s" type="search" autocomplete="off" style="min-height:44px;width:100%;max-width:32rem" placeholder="Words of a title, an author, a year">
<p aria-live="polite" id="fa-bib-s-n"></p>
<div class="fa-bib-facets" id="fa-bib-s-facets"></div>
<ol class="fa-bib" id="fa-bib-s-hits"></ol>
</div>
${SEARCH_SCRIPT}`;
}

/* The client: tokens, termShard and searchIndex as written above (types are
 * gone at run time), and a small UI. Every text is set with textContent. */
const SEARCH_SCRIPT = `<script>
(function(){var box=document.querySelector(".fa-bib-search");if(!box)return;
var tokens=${tokens.toString()};
var termShard=${termShard.toString()};
var searchIndex=${searchIndex.toString()};
var base=box.getAttribute("data-fa-bib-index"),root=box.getAttribute("data-fa-bib-root")||"",sc=box.getAttribute("data-fa-bib-scope");
var cache={};function load(n){if(!cache[n])cache[n]=fetch(base+n).then(function(r){if(!r.ok)throw r.status;return r.json();});return cache[n];}
var q=document.getElementById("fa-bib-s"),n=document.getElementById("fa-bib-s-n"),fx=document.getElementById("fa-bib-s-facets"),ol=document.getElementById("fa-bib-s-hits");
var scope=sc===null?undefined:Number(sc),decade,seq=0,subs=[];load("manifest.json").then(function(m){subs=m.subgraphs;});
function el(t,x){var e=document.createElement(t);if(x!==undefined)e.textContent=x;return e;}
function chip(label,on,fn){var b=el("button",label);b.type="button";b.setAttribute("aria-pressed",on?"true":"false");b.style.minHeight="44px";b.onclick=fn;return b;}
function run(){var v=q.value,my=++seq;if(!v.trim()){n.textContent="";fx.replaceChildren();ol.replaceChildren();return;}
searchIndex(v,load,{limit:50,scope:scope,decade:decade}).then(function(r){if(my!==seq)return;
n.textContent=r.total+" found"+(r.total>r.hits.length?", the first "+r.hits.length+" shown":"");
var row=[];if(sc===null){Object.keys(r.bySubgraph).forEach(function(k){var i=Number(k);row.push(chip((subs[i]||k)+" ("+r.bySubgraph[k]+")",scope===i,function(){scope=scope===i?undefined:i;run();}));});}
Object.keys(r.byDecade).forEach(function(k){var d=Number(k);row.push(chip((d?d+"s":"no year")+" ("+r.byDecade[k]+")",decade===d,function(){decade=decade===d?undefined:d;run();}));});
fx.replaceChildren.apply(fx,row);
ol.replaceChildren.apply(ol,r.hits.map(function(h){var li=el("li"),a=el("a",h.c);a.href=root+h.h;li.appendChild(a);li.appendChild(el("small"," "+[h.y||"",subs[h.s]||"",h.k].filter(Boolean).join(" \\u00b7 ")));return li;}));
}).catch(function(){if(my===seq)n.textContent="The search index could not be loaded.";});}
var t;q.addEventListener("input",function(){clearTimeout(t);t=setTimeout(run,200);});
})();
</script>`;
