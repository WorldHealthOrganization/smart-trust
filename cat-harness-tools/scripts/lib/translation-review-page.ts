/**
 * The translation REVIEW page: every catalogue × locale of every layer, with
 * who (if anyone) has adjudicated it, and the controls to adjudicate.
 *
 * @module scripts/lib/translation-review-page
 * @covers translation-sources
 *
 * Written by `gen-translation-status.ts` beside the status page, as
 * `review.html` in the same directory, so it is built at publish with it and
 * needs no route of its own. The status page stays free of JavaScript; this
 * one needs it only to SUBMIT. The matrix itself is server-rendered and reads
 * without it.
 *
 * ## The states a cell can be in
 *
 * | state      | meaning                                                                 |
 * |------------|-------------------------------------------------------------------------|
 * | `none`     | a `.pot` template and no `.po`: nothing to review                       |
 * | `empty`    | a `.po` with no translated string                                       |
 * | `machine`  | translated by a machine or an agent; no person has adjudicated it       |
 * | `flagged`  | `flaggedForReview` — a mistranslation was reported, or QA flagged it    |
 * | `reviewed` | a person accepted it (`signedOffBy`/`signedOffAt` on the node)          |
 * | `stale`    | a person accepted it, and the catalogue has changed since               |
 * | `official` | the locale is signed off and this catalogue says `X-Folio-Official: yes` |
 *
 * `stale` is read from the audited record (`translation-qa`, criterion
 * `human-adjudication`): its last entry names the hash of the catalogue the
 * person saw. A review with no such entry (signed off before this record
 * existed) is shown as `reviewed`, with no claim either way about staleness.
 *
 * ## Where a string renders
 *
 * Each row names the source files its strings come from (the `#:` references
 * of the catalogue), linked to the layer's repository. Those are where the
 * strings are authored; the page a source file becomes is the site's to say.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import {
  ADJUDICATION_CRITERION,
  ADJUDICATION_LABEL,
  ADJUDICATION_SCHEMA,
  ADJUDICATION_TITLE_PREFIX,
  CANDIDATES_SCHEMA,
  CANDIDATES_SUFFIX,
  MAX_ISSUE_URL,
  poHash,
  sourceFilesOf,
} from "./translation-adjudication.ts";

export type CellState = "none" | "empty" | "machine" | "flagged" | "reviewed" | "stale" | "official";

/** States a person can adjudicate from the page. */
export const ADJUDICABLE: readonly CellState[] = ["machine", "flagged", "stale", "reviewed"];

export interface ReviewCell {
  state: CellState;
  entries: number;
  translated: number;
  fuzzy: number;
  /** {@link poHash} of the `.po`, when there is one. */
  hash?: string;
  by?: string;
  at?: string;
  /** What made it, from the node: `agent`, `machine`, a tool name. */
  generatedBy?: string;
  flagReason?: string;
}

export interface ReviewRow {
  /** Path inside the locale directory, without extension. */
  catalogue: string;
  /** Source files the strings come from. */
  sources: string[];
  cells: Record<string, ReviewCell>;
}

export interface ReviewLayer {
  name: string;
  /** `owner/name`, from the layer's declaration; without it nothing can be submitted. */
  repository?: string;
  /** The `translation-sources` directory, relative to the layer root. */
  translations: string;
  locales: string[];
  rows: ReviewRow[];
  /** Templates with no `.po` in any locale: counted, not listed. */
  templatesOnly: number;
}

const posix = (p: string) => p.split(sep).join("/");

function walk(dir: string, exts: readonly string[], base = dir): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, exts, base));
    else if (exts.some((e) => name.endsWith(e))) out.push(posix(relative(base, p)));
  }
  return out;
}

function readJson(path: string): Record<string, unknown> | undefined {
  try {
    const v = JSON.parse(readFileSync(path, "utf-8"));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** The hash the last human adjudication saw (after its own suggestions), from the audited record. */
export function lastAdjudicatedHash(att: Record<string, unknown> | undefined): string | undefined {
  const list = (att?.criteria as Record<string, unknown[]> | undefined)?.[ADJUDICATION_CRITERION];
  const last = Array.isArray(list) ? (list[list.length - 1] as Record<string, unknown> | undefined) : undefined;
  if (!last) return undefined;
  const h = last.po_hash_after ?? last.po_hash;
  return typeof h === "string" ? h : undefined;
}

/**
 * One cell, from the catalogue's text (or `undefined` when there is no
 * `.po`), its translation node, the locale's `status.json`, and the audited
 * record. Pure.
 */
/** What `countCatalogue` (`gen-translation-status.ts`) answers, passed in to keep this module free of the harness. */
export type Count = (text: string) => { entries: number; translated: number; fuzzy: number };

export function cellState(
  count: Count,
  po: string | undefined,
  node: Record<string, unknown> | undefined,
  localeStatus: Record<string, unknown> | undefined,
  att: Record<string, unknown> | undefined,
  poOfficialHeader: string | undefined,
): ReviewCell {
  if (po === undefined) return { state: "none", entries: 0, translated: 0, fuzzy: 0 };
  const c = count(po);
  const hash = poHash(po);
  const base = { entries: c.entries, translated: c.translated, fuzzy: c.fuzzy, hash };
  const st = (node?.status ?? {}) as Record<string, unknown>;
  const generatedBy = typeof st.generatedBy === "string" ? st.generatedBy : typeof st.generator === "string" ? st.generator : undefined;
  const extra = { ...(generatedBy ? { generatedBy } : {}) };
  if (localeStatus?.official === true && poOfficialHeader === "yes") {
    return { state: "official", ...base, ...extra, ...(typeof localeStatus.signedOffBy === "string" ? { by: localeStatus.signedOffBy } : {}), ...(typeof localeStatus.signedOffAt === "string" ? { at: localeStatus.signedOffAt } : {}) };
  }
  if (st.flaggedForReview === true) {
    return { state: "flagged", ...base, ...extra, ...(typeof st.flagReason === "string" ? { flagReason: st.flagReason } : {}) };
  }
  if (c.translated === 0 && c.fuzzy === 0) return { state: "empty", ...base, ...extra };
  const by = [st.signedOffBy, st.adjudicatedBy, st.reviewedBy].find((v) => typeof v === "string" && v.length > 0) as string | undefined;
  const at = [st.signedOffAt, st.adjudicatedAt, st.reviewedAt].find((v) => typeof v === "string" && v.length > 0) as string | undefined;
  if (st.official === true && by && at) {
    const seen = lastAdjudicatedHash(att);
    return { state: seen !== undefined && seen !== hash ? "stale" : "reviewed", ...base, ...extra, by, at };
  }
  return { state: "machine", ...base, ...extra };
}

/**
 * The matrix for one layer. `attestationFor(catalogueFromRoot, locale)` is
 * the absolute path of the catalogue's `translation-qa` attestation.
 */
export function reviewLayer(opts: {
  name: string;
  repository?: string;
  layerRoot: string;
  translationsDir: string;
  attestationFor: (catalogueFromRoot: string, locale: string) => string;
  poHeader: (text: string, name: string) => string | undefined;
  count: Count;
}): ReviewLayer {
  const translations = posix(relative(opts.layerRoot, opts.translationsDir));
  const locales = readdirSync(opts.translationsDir)
    .filter((d) => statSync(join(opts.translationsDir, d)).isDirectory())
    .sort();
  const byCat = new Map<string, { pot: boolean; po: Set<string> }>();
  for (const l of locales) {
    for (const f of walk(join(opts.translationsDir, l), [".pot", ".po"])) {
      const cat = f.replace(/\.pot?$/, "");
      const e = byCat.get(cat) ?? { pot: false, po: new Set<string>() };
      if (f.endsWith(".pot")) e.pot = true;
      else e.po.add(l);
      byCat.set(cat, e);
    }
  }
  const rows: ReviewRow[] = [];
  let templatesOnly = 0;
  for (const [cat, e] of [...byCat].sort(([a], [b]) => a.localeCompare(b, "en"))) {
    if (e.po.size === 0) {
      templatesOnly += 1;
      continue;
    }
    const cells: Record<string, ReviewCell> = {};
    let sources: string[] = [];
    for (const l of locales) {
      const dir = join(opts.translationsDir, l);
      const poPath = join(dir, `${cat}.po`);
      let po: string | undefined;
      try {
        po = existsSync(poPath) ? readFileSync(poPath, "utf-8") : undefined;
      } catch {
        po = undefined;
      }
      if (po !== undefined && sources.length === 0) sources = sourceFilesOf(po);
      const catFromRoot = `${translations}/${l}/${cat}`;
      const att = readJson(opts.attestationFor(catFromRoot, l));
      cells[l] = cellState(opts.count, po, readJson(join(dir, `${cat}.json`)), readJson(join(dir, "status.json")), att, po === undefined ? undefined : opts.poHeader(po, "X-Folio-Official")?.toLowerCase());
    }
    if (sources.length === 0) {
      for (const l of locales) {
        const pot = join(opts.translationsDir, l, `${cat}.pot`);
        if (existsSync(pot)) {
          sources = sourceFilesOf(readFileSync(pot, "utf-8"));
          break;
        }
      }
    }
    rows.push({ catalogue: cat, sources, cells });
  }
  return { name: opts.name, ...(opts.repository ? { repository: opts.repository } : {}), translations, locales, rows, templatesOnly };
}

// ── Rendering ────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const STATE_LABEL: Record<CellState, string> = {
  none: "no catalogue",
  empty: "not translated",
  machine: "machine — not reviewed",
  flagged: "flagged for review",
  reviewed: "reviewed by a person",
  stale: "reviewed, changed since",
  official: "official",
};

function cellHtml(layerIx: number, layer: ReviewLayer, row: ReviewRow, locale: string): string {
  const c = row.cells[locale]!;
  if (c.state === "none") return `<td class="tr-cell" data-state="none"><span class="tr-dim">—</span></td>`;
  const who = c.by ? `<br><span class="tr-dim">${esc(c.by)}${c.at ? `, ${esc(c.at.slice(0, 10))}` : ""}</span>` : "";
  const made = c.state === "machine" && c.generatedBy ? `<br><span class="tr-dim">by ${esc(c.generatedBy)}</span>` : "";
  const why = c.flagReason ? ` title="${esc(c.flagReason)}"` : "";
  const counts = `<span class="tr-dim">${c.translated}/${c.entries}${c.fuzzy ? `, ${c.fuzzy} fuzzy` : ""}</span>`;
  const id = `tr-${layerIx}-${locale}-${row.catalogue}`.replace(/[^A-Za-z0-9_-]/g, "_");
  const can = layer.repository !== undefined && (ADJUDICABLE as readonly string[]).includes(c.state) && c.translated + c.fuzzy > 0;
  const controls = can
    ? `<div class="tr-controls"><label for="${esc(id)}"><input type="checkbox" id="${esc(id)}" class="tr-accept" data-layer="${layerIx}" data-cat="${esc(row.catalogue)}" data-locale="${esc(locale)}" data-hash="${esc(c.hash!)}"> acceptable</label>
<button type="button" class="tr-suggest" data-layer="${layerIx}" data-cat="${esc(row.catalogue)}" data-locale="${esc(locale)}" data-hash="${esc(c.hash!)}">mistranslation…</button></div>`
    : "";
  return `<td class="tr-cell" data-state="${c.state}"${why}><span class="tr-badge tr-${c.state}">${esc(STATE_LABEL[c.state])}</span><br>${counts}${who}${made}${controls}</td>`;
}

function layerTable(layer: ReviewLayer, ix: number): string {
  const repoBase = layer.repository ? `https://github.com/${layer.repository}/blob/main/` : undefined;
  const head = layer.locales
    .map((l) => {
      const any = layer.rows.some((r) => (ADJUDICABLE as readonly string[]).includes(r.cells[l]!.state));
      const all = any && layer.repository
        ? `<br><button type="button" class="tr-all" data-layer="${ix}" data-locale="${esc(l)}">tick all machine</button>`
        : "";
      return `<th scope="col"><code>${esc(l)}</code>${all}</th>`;
    })
    .join("");
  const rows = layer.rows
    .map((r) => {
      const src = r.sources.length === 0
        ? `<span class="tr-dim">no source reference</span>`
        : r.sources
            .slice(0, 4)
            .map((s) => (repoBase ? `<a href="${esc(repoBase + s)}">${esc(s)}</a>` : `<code>${esc(s)}</code>`))
            .join("<br>") + (r.sources.length > 4 ? `<br><span class="tr-dim">and ${r.sources.length - 4} more</span>` : "");
      return `<tr><th scope="row"><code>${esc(r.catalogue)}</code><div class="tr-src">renders from:<br>${src}</div></th>${layer.locales.map((l) => cellHtml(ix, layer, r, l)).join("")}</tr>`;
    })
    .join("\n");
  const counts = { machine: 0, reviewed: 0, stale: 0, flagged: 0 } as Record<string, number>;
  for (const r of layer.rows) for (const c of Object.values(r.cells)) if (c.state in counts) counts[c.state]! += 1;
  return `<section class="tr-layer" id="layer-${esc(layer.name)}">
<h2>${esc(layer.name)}</h2>
<p class="tr-dim">${layer.rows.length} catalogue(s) in <code>${esc(layer.translations)}</code>${layer.repository ? ` of <a href="https://github.com/${esc(layer.repository)}">${esc(layer.repository)}</a>` : ""}; ${layer.templatesOnly} template(s) have no catalogue in any locale and are not listed.
${counts.machine} machine, ${counts.flagged} flagged, ${counts.reviewed} reviewed, ${counts.stale} stale.${layer.repository ? "" : " <strong>This layer declares no repository, so its cells cannot be submitted.</strong>"}</p>
<div class="tr-wrap"><table>
<thead><tr><th scope="col">catalogue</th>${head}</tr></thead>
<tbody>
${rows}
</tbody>
</table></div>
</section>`;
}

/** The constants the page's script needs, from the one module that owns them. */
export function clientConfig(layers: ReviewLayer[]): string {
  return JSON.stringify({
    schema: ADJUDICATION_SCHEMA,
    label: ADJUDICATION_LABEL,
    prefix: ADJUDICATION_TITLE_PREFIX,
    maxUrl: MAX_ISSUE_URL,
    candidatesSchema: CANDIDATES_SCHEMA,
    candidatesSuffix: CANDIDATES_SUFFIX,
    layers: layers.map((l) => ({ name: l.name, repository: l.repository ?? null, translations: l.translations })),
  }).replace(/</g, "\\u003c");
}

/**
 * The page's script. It reads the ticked cells and the suggestions, builds a
 * `translation-adjudication/v1` record per layer, and opens GitHub's
 * new-issue form for it. The body's fence must match `parseIssueBody`.
 */
const SCRIPT = String.raw`
(function () {
  var cfg = JSON.parse(document.getElementById("tr-config").textContent);
  var picks = {}; // key layer|locale|cat -> item
  var out = document.getElementById("tr-out");
  function key(l, loc, c) { return l + "|" + loc + "|" + c; }
  function refresh() {
    var n = Object.keys(picks).length;
    document.getElementById("tr-count").textContent = n + " selected";
    document.getElementById("tr-submit").disabled = n === 0;
  }
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains("tr-accept")) return;
    var k = key(t.dataset.layer, t.dataset.locale, t.dataset.cat);
    if (t.checked) picks[k] = { layer: +t.dataset.layer, item: { catalogue: t.dataset.cat, locale: t.dataset.locale, verdict: "acceptable", poHash: t.dataset.hash } };
    else if (picks[k] && picks[k].item.verdict === "acceptable") delete picks[k];
    refresh();
  });
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains("tr-all")) {
      document.querySelectorAll('.tr-accept[data-layer="' + t.dataset.layer + '"][data-locale="' + t.dataset.locale + '"]').forEach(function (b) {
        if (b.closest("td").dataset.state !== "machine" || b.checked) return;
        b.checked = true; b.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
    if (t.classList && t.classList.contains("tr-suggest")) openSuggest(t);
  });

  function unq(s) { var m = /"(.*)"\s*$/.exec(s); return m ? m[1].replace(/\\(.)/g, function (_, c) { return c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c; }) : ""; }
  function parsePo(text) {
    var out = [];
    text.split(/\n\s*\n/).forEach(function (block) {
      var e = {}, f = null, obsolete = false;
      block.split("\n").forEach(function (l) {
        if (l.indexOf("#~") === 0) obsolete = true;
        if (l.charAt(0) === "#") return;
        var m = /^(msgctxt|msgid_plural|msgid|msgstr(?:\[(\d+)\])?)\s/.exec(l);
        if (m) { f = m[1] === "msgstr[0]" ? "msgstr" : m[1]; if (/^msgstr\[[1-9]/.test(m[1])) f = "skip"; if (f !== "skip") e[f] = unq(l); return; }
        if (f && f !== "skip" && /^\s*"/.test(l)) e[f] = (e[f] || "") + unq(l);
      });
      if (obsolete || e.msgid === undefined || (e.msgid === "" && e.msgctxt === undefined) || e.msgid_plural !== undefined) return;
      out.push(e);
    });
    return out;
  }
  async function sha16(text) {
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("").slice(0, 16);
  }
  var dlg = document.getElementById("tr-dialog");
  async function openSuggest(btn) {
    var layer = cfg.layers[+btn.dataset.layer];
    var path = layer.translations + "/" + btn.dataset.locale + "/" + btn.dataset.cat + ".po";
    var body = document.getElementById("tr-dialog-body");
    document.getElementById("tr-dialog-title").textContent = btn.dataset.locale + " · " + btn.dataset.cat;
    body.innerHTML = "<p>Loading the catalogue…</p>";
    dlg.showModal();
    var text;
    try {
      var r = await fetch("https://raw.githubusercontent.com/" + layer.repository + "/main/" + path);
      if (!r.ok) throw new Error("HTTP " + r.status);
      text = await r.text();
    } catch (err) { body.textContent = "Could not load " + path + ": " + err.message; return; }
    var cands = {};
    try {
      var rc = await fetch("https://raw.githubusercontent.com/" + layer.repository + "/main/" + path.replace(/\.po$/, cfg.candidatesSuffix));
      if (rc.ok) {
        var cf = await rc.json();
        if (cf && cf.$schema === cfg.candidatesSchema && Array.isArray(cf.entries)) cf.entries.forEach(function (e) {
          if (e && typeof e.msgid === "string" && Array.isArray(e.candidates)) cands[(e.msgctxt || "") + "\u0004" + e.msgid] = e.candidates.filter(function (c) { return c && typeof c.text === "string" && c.source && typeof c.source.id === "string"; });
        });
      }
    } catch (err) { /* no candidates: the reviewer types their own */ }
    var hash = await sha16(text);
    var warn = hash !== btn.dataset.hash ? '<p class="tr-warn">This catalogue has changed since the page was built; your suggestions are made against the newest version.</p>' : "";
    var entries = parsePo(text);
    var rows = entries.map(function (e, i) {
      return '<tr><td><div class="tr-msgid"></div></td><td><div class="tr-msgstr"></div></td><td><div class="tr-cands" data-i="' + i + '"></div><textarea data-i="' + i + '" rows="2" aria-label="suggested translation"></textarea></td></tr>';
    }).join("");
    body.innerHTML = warn + '<p>For each string you find wrong, pick one of the candidate translations (each names its source: an agent model, an open machine-translation model, a web service) or type your own. Leave the others empty.</p>' +
      '<div class="tr-wrap"><table class="tr-sugg"><thead><tr><th>source</th><th>current</th><th>your suggestion</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<label>Note (optional) <input type="text" id="tr-note"></label>';
    body.querySelectorAll(".tr-msgid").forEach(function (d, i) { d.textContent = entries[i].msgid + (entries[i].msgctxt ? " [" + entries[i].msgctxt + "]" : ""); });
    body.querySelectorAll(".tr-msgstr").forEach(function (d, i) { d.textContent = entries[i].msgstr || "(empty)"; });
    // Candidates from other sources (agent models, open MT, web services): a
    // choice fills the suggestion and records its source; editing the text
    // makes it the reviewer's own.
    body.querySelectorAll(".tr-cands").forEach(function (box) {
      var i = +box.dataset.i, e = entries[i], list = cands[(e.msgctxt || "") + "\u0004" + e.msgid] || [];
      var ta = body.querySelector('textarea[data-i="' + i + '"]');
      list.forEach(function (c, j) {
        if (c.text === e.msgstr) return;
        var lab = document.createElement("label"); lab.className = "tr-cand";
        var r = document.createElement("input"); r.type = "radio"; r.name = "tr-cand-" + i;
        r.onchange = function () { ta.value = c.text; ta.dataset.srcText = c.text; ta.dataset.src = JSON.stringify({ kind: c.source.kind, id: c.source.id }); };
        var t = document.createElement("span"); t.textContent = c.text;
        var w = document.createElement("span"); w.className = "tr-dim"; w.textContent = " — " + c.source.kind + " " + c.source.id;
        lab.append(r, t, w); box.appendChild(lab);
      });
    });
    document.getElementById("tr-dialog-save").onclick = function () {
      var sugg = [];
      body.querySelectorAll("textarea").forEach(function (ta) {
        var v = ta.value.trim(); if (!v) return;
        var e = entries[+ta.dataset.i];
        var s = { msgid: e.msgid, current: e.msgstr || "", suggested: v };
        if (ta.dataset.src && ta.dataset.srcText === v) s.source = JSON.parse(ta.dataset.src);
        if (e.msgctxt !== undefined) s.msgctxt = e.msgctxt;
        sugg.push(s);
      });
      var k = key(btn.dataset.layer, btn.dataset.locale, btn.dataset.cat);
      var box = document.querySelector('.tr-accept[data-layer="' + btn.dataset.layer + '"][data-locale="' + btn.dataset.locale + '"][data-cat="' + CSS.escape(btn.dataset.cat) + '"]');
      if (sugg.length === 0) { if (picks[k] && picks[k].item.verdict === "mistranslation") delete picks[k]; btn.textContent = "mistranslation…"; }
      else {
        var item = { catalogue: btn.dataset.cat, locale: btn.dataset.locale, verdict: "mistranslation", poHash: hash, suggestions: sugg };
        var note = document.getElementById("tr-note").value.trim(); if (note) item.note = note;
        picks[k] = { layer: +btn.dataset.layer, item: item };
        if (box) box.checked = false;
        btn.textContent = "mistranslation: " + sugg.length + " suggestion(s)";
      }
      dlg.close(); refresh();
    };
  }
  document.getElementById("tr-dialog-cancel").onclick = function () { dlg.close(); };

  function code(s) { s = String(s).replace(/\n/g, "⏎"); return s.indexOf("\x60") >= 0 ? "\x60\x60 " + s + " \x60\x60" : "\x60" + s + "\x60"; }
  function issue(layer, items) {
    var p = { $schema: cfg.schema, repository: layer.repository, layer: layer.name, translations: layer.translations, items: items };
    var acc = items.filter(function (i) { return i.verdict === "acceptable"; }), mis = items.filter(function (i) { return i.verdict !== "acceptable"; });
    var title = cfg.prefix + " " + layer.name + ": " + [acc.length ? acc.length + " acceptable" : "", mis.length ? mis.length + " mistranslation" + (mis.length === 1 ? "" : "s") : ""].filter(Boolean).join(", ");
    var L = ["Translation review of **" + layer.name + "** (\x60" + layer.translations + "\x60), filed from the translation status page.", "",
      "By filing this issue, I (its author) adjudicate the machine translations below. The workflow records my GitHub login as the reviewer and opens a pull request; nothing is recorded in anyone else's name.", ""];
    if (acc.length) { L.push("### Acceptable", ""); acc.forEach(function (i) { L.push("- [x] \x60" + i.locale + "\x60 " + code(i.catalogue)); }); L.push(""); }
    if (mis.length) {
      L.push("### Mistranslations, with suggestions", "");
      mis.forEach(function (i) {
        L.push("- \x60" + i.locale + "\x60 " + code(i.catalogue) + (i.note ? " — " + i.note : ""));
        i.suggestions.forEach(function (s) { L.push("  - " + code(s.msgid) + ": " + code(s.current) + " → " + code(s.suggested) + (s.source ? " (candidate from " + s.source.kind + " " + code(s.source.id) + ")" : "")); });
      });
      L.push("");
    }
    L.push("<details><summary>Machine-readable record (what the workflow reads; please don't edit)</summary>", "", "\x60\x60\x60json translation-adjudication", JSON.stringify(p, null, 1), "\x60\x60\x60", "", "</details>");
    return { title: title, body: L.join("\n"), repository: layer.repository };
  }
  document.getElementById("tr-submit").onclick = function () {
    var byLayer = {};
    Object.keys(picks).forEach(function (k) { var p = picks[k]; (byLayer[p.layer] = byLayer[p.layer] || []).push(p.item); });
    out.innerHTML = "";
    Object.keys(byLayer).forEach(function (ix) {
      var is = issue(cfg.layers[+ix], byLayer[ix]);
      var q = new URLSearchParams({ title: is.title, labels: cfg.label, body: is.body });
      var url = "https://github.com/" + is.repository + "/issues/new?" + q.toString();
      var div = document.createElement("div"); div.className = "tr-issue";
      if (url.length <= cfg.maxUrl) {
        var a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; a.className = "tr-big";
        a.textContent = "Open the GitHub issue for " + cfg.layers[+ix].name; div.appendChild(a);
        if (Object.keys(byLayer).length === 1) window.open(url, "_blank", "noopener");
      } else {
        var short = "https://github.com/" + is.repository + "/issues/new?" + new URLSearchParams({ title: is.title, labels: cfg.label }).toString();
        var ta = document.createElement("textarea"); ta.value = is.body; ta.rows = 6; ta.readOnly = true;
        var copy = document.createElement("button"); copy.type = "button"; copy.className = "tr-big"; copy.textContent = "1. Copy the issue text";
        copy.onclick = function () { navigator.clipboard.writeText(is.body).then(function () { copy.textContent = "1. Copied ✓"; }); };
        var a2 = document.createElement("a"); a2.href = short; a2.target = "_blank"; a2.rel = "noopener"; a2.className = "tr-big"; a2.textContent = "2. Open the issue for " + cfg.layers[+ix].name + " and paste";
        div.append("This review is too long for a link. ", copy, " ", a2, ta);
      }
      out.appendChild(div);
    });
  };
  refresh();
})();
`;

/** The review page's body: the matrix, and the controls. */
export function reviewBody(layers: ReviewLayer[], statusHref: string): string {
  return `<style>
.tr-page { --tr-dim: #c3c2b7; --tr-line: rgba(127,127,127,.4); --tr-warn: #f0b429; }
@media (prefers-color-scheme: light) { .tr-page { --tr-dim: #52514e; --tr-line: rgba(127,127,127,.25); --tr-warn: #8a6100; } }
:root[data-fa-scheme="dark"] .tr-page { --tr-dim: #c3c2b7; --tr-line: rgba(127,127,127,.4); --tr-warn: #f0b429; }
:root[data-fa-scheme="light"] .tr-page { --tr-dim: #52514e; --tr-line: rgba(127,127,127,.25); --tr-warn: #8a6100; }
.tr-page .tr-dim { color: var(--tr-dim); font-size: 0.8rem; }
.tr-page .tr-warn { color: var(--tr-warn); }
.tr-page .tr-wrap { overflow-x: auto; }
.tr-page table { border-collapse: collapse; width: 100%; }
.tr-page th, .tr-page td { border-bottom: 1px solid var(--tr-line); padding: 0.5rem; vertical-align: top; text-align: left; }
.tr-page .tr-src { font-weight: normal; font-size: 0.75rem; color: var(--tr-dim); margin-top: 0.25rem; }
.tr-page .tr-badge { font-size: 0.75rem; font-weight: 600; padding: 0.1rem 0.4rem; border-radius: 3px; border: 1px solid var(--tr-line); white-space: nowrap; }
.tr-page .tr-machine, .tr-page .tr-stale, .tr-page .tr-flagged { border-color: var(--tr-warn); }
.tr-page .tr-reviewed, .tr-page .tr-official { border-style: double; border-width: 3px; }
.tr-page .tr-controls { margin-top: 0.4rem; display: flex; flex-direction: column; gap: 0.35rem; }
.tr-page .tr-controls label { display: flex; align-items: center; gap: 0.4rem; min-height: 44px; cursor: pointer; }
.tr-page input[type="checkbox"] { width: 1.6rem; height: 1.6rem; }
.tr-page button, .tr-page .tr-big { min-height: 44px; padding: 0.4rem 0.8rem; font-size: 0.95rem; cursor: pointer; }
.tr-page .tr-bar { position: sticky; bottom: 0; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; padding: 0.75rem; border-top: 2px solid var(--tr-line); background: var(--fa-bg, Canvas); z-index: 2; }
.tr-page .tr-issue { margin: 0.5rem 0; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.tr-page .tr-issue textarea { width: 100%; }
.tr-page dialog { max-width: min(60rem, 95vw); width: 95vw; }
.tr-page .tr-sugg textarea { width: 100%; min-width: 12rem; font-size: 1rem; }
.tr-page .tr-cand { display: flex; gap: 0.4rem; align-items: center; min-height: 44px; cursor: pointer; }
.tr-page .tr-cand input { width: 1.4rem; height: 1.4rem; flex: none; }
</style>
<div class="tr-page">
<h1 id="tr-title">translations — review</h1>
<p>Every catalogue in every locale, and whether a person has reviewed it. Tick the machine translations you find
<strong>acceptable</strong>, or open <strong>mistranslation…</strong> on a cell to suggest better text for its strings, then press
<strong>Submit</strong>. That opens a GitHub issue prefilled with your review. Filing it makes <em>you</em>, by your
GitHub login, the reviewer, and a workflow turns it into a pull request recording your verdict. Owners, members
and collaborators of a layer's repository can adjudicate it. Submitting needs JavaScript; the table reads without it.</p>
<p class="tr-dim">A suggestion is applied as a <code>#, fuzzy</code> string and flags the catalogue for review: nobody
else has reviewed your text yet. Accepting sets the catalogue reviewed, pinned to the version you saw, and it
shows as <em>stale</em> once that catalogue changes. Coverage numbers are on the <a href="${esc(statusHref)}">status page</a>.</p>
${layers.map(layerTable).join("\n")}
<div class="tr-bar"><span id="tr-count">0 selected</span><button type="button" id="tr-submit" class="tr-big" disabled>Submit as a GitHub issue</button></div>
<div id="tr-out" aria-live="polite"></div>
<dialog id="tr-dialog" aria-labelledby="tr-dialog-title"><h2 id="tr-dialog-title"></h2><div id="tr-dialog-body"></div>
<p><button type="button" id="tr-dialog-save" class="tr-big">Keep these suggestions</button> <button type="button" id="tr-dialog-cancel" class="tr-big">Cancel</button></p></dialog>
<script type="application/json" id="tr-config">${clientConfig(layers)}</script>
<script>${SCRIPT}</script>
</div>`;
}
