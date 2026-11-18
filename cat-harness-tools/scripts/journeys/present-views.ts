/**
 * The presentation frame's other views: the persona lens,
 * how it works, the discussion (with the table sheets) and the device demo — the
 * tabs of the VaxLink walkthrough after its overview and walkthrough
 * (`present.ts`), each a page of its own in the same frame.
 *
 * @module scripts/journeys/present-views
 * @covers user-scenario, workshop, building-blocks
 *
 * ## Routes, under the workshop's own `<instance>/workshops/<id>/`
 *
 * | path | view |
 * |---|---|
 * | `map/` | a redirect to `how/`, which carries what the journey map's technical layer showed: the building blocks per moment, the business processes, and what moves between the moments ("Data on the move") |
 * | `personas/`, `personas/<actor>/` | one person end to end: goal, needs, frustrations, how they feel along the way, their touchpoints (`personas/` is the first of the cast) |
 * | `how/`, `how/<block>/` | the catalogue's big ideas, the building blocks × moments grid by layer, a block's detail with the moments it makes possible, the ArchiMate views of the taught journeys, what moves between the moments, the business processes |
 * | `discuss/` | the closing questions with the moments to revisit, the questions module by module, the tables with the moments that force each row, the gap list the walkthrough's gap strips assembled, every moment's policy takeaway |
 * | `sheets/` | a redirect to the Table sheets, now an expanding panel of `discuss/` (`#sheets`): in the lab’s summary step, or at the discussion’s foot |
 * | `demo/`, `demo/<screen>/` | the Device Demo: a screen per page with the moments it shows, both ways. The `device-screen` nodes that show a step the workshop presents, each drawn in its device frame with its owner beside it (`screens.ts`); only when there are none, the layer's own app framed, as the workshop's `presentation.deviceDemo` names it |
 *
 * VaxLink's own addresses (`#/map`, `#/personas/khamla`, `#/how/gdhcn`,
 * `#/discuss`, `#/sheets`, `#/demo/S4`) open these from the overview
 * (`present.js`).
 *
 * Everything is read from the graph; a view whose data a layer does not
 * carry (no catalogue, no ArchiMate view, no device demo, no sheets) draws
 * what it has and says what it lacks, never a hard-coded stand-in.
 */
import { escHtml } from "../thin-page.ts";
import { journeyById, lookup, processName, type JourneyCorpus } from "./read.ts";
import { DAK_ATTR } from "./dak-links.ts";
import { canvasDownloads, canvasFiles, canvasHtml, canvasOf, moduleSegment, personaOf, sheetsHtml, sourceHref, TOOL_ID, type ArchimateElementLink, type ArchitecturePanel, type PageFile, type PersonaView, type SiteLinks } from "./render.ts";
import { DEVICE_FORM, DEVICE_LABEL, renderDevice, stateSwitch, type DemoScreen, type ScreenContext } from "./screens.ts";
import { screenExamples } from "../../schemas/process/device-screen.ts";
import { canvasFormHtml, canvasModel, canvasSummaryItems, type AnnexQuestion } from "./canvas-form.ts";
import { withRenderedBy } from "../viewer-declarations.ts";
import {
  avatar,
  stepsExampleKeys,
  viewDrawer,
  demoLabel,
  deviceGlyph,
  emotionBadge,
  examplePage,
  EMOTION,
  ext,
  frame,
  glyph,
  icon,
  iconPaths,
  LAYER_TONES,
  fromSite,
  personaHref,
  personaNameHtml,
  personaText,
  processLinks,
  screenHref,
  siteRootFrom,
  answerBox,
  questionKey,
  legacyQuestionKey,
  earlierKeys,
  type Presentation,
  type PresentedStep,
  type View,
} from "./present.ts";
import type { WorkshopLab, WorkshopLabStep, WorkshopTable } from "../../schemas/process/workshop.ts";

const e = escHtml;

/** The segments these views take under a workshop. */
export const VIEW_SEGMENTS = ["map", "personas", "how", "discuss", "demo"] as const;

/** Where a page `depth` levels below the workshop's directory is. */
interface At {
  root: string;
  toWorkshop: string;
  siteRoot: string;
}
/** The drawer of a view over these steps, every page's foot. */
const drawerOf = (corpus: JourneyCorpus, p: Presentation, a: At, steps: readonly PresentedStep[], stage: string, scope?: string): string => viewDrawer(corpus, p, stepsExampleKeys(steps), a.toWorkshop, a.siteRoot, scope, stage);

const at = (depth: number, links: SiteLinks): At => {
  const root = "../".repeat(3 + depth);
  return { root, toWorkshop: "../".repeat(depth), siteRoot: siteRootFrom(root, links) };
};

const walkHref = (a: At, s: PresentedStep): string => `${a.toWorkshop}walkthrough/${s.key}/`;

/** The presented step a workshop reference names: `scenario#step`, or a bare step id. */
export function stepByRef(corpus: JourneyCorpus, p: Presentation, ref: string): PresentedStep | undefined {
  const [scenario, step] = ref.includes("#") ? ref.split("#") : [undefined, ref];
  const j = scenario ? journeyById(corpus, p.w.instance, scenario) : undefined;
  return p.steps.find((s) => s.step.id === step && (j === undefined || s.journey === j));
}

const stepChip = (a: At, s: PresentedStep | undefined, ref: string, withTitle = false): string =>
  s
    ? `<a class="jp-revisit" href="${e(walkHref(a, s))}" title="${e(s.step.title)}">${icon("play")}<b>${e(s.step.id)}</b>${withTitle ? `<span>${e(s.step.title)}</span>` : ""}</a>`
    : `<span class="jp-revisit jp-unresolved" title="no such step in this walkthrough">${e(ref)}</span>`;

function note(p: Presentation, view: Exclude<View, "overview" | "walkthrough">): { note?: string } {
  const n = p.w.workshop.presentation?.notes?.[view];
  return n ? { note: n } : {};
}

const presentationName = (p: Presentation): string => p.w.workshop.presentation?.name ?? p.w.workshop.title;

/** The building-block catalogue a workshop's steps read: the workshop's layer's, else its first step's, else any. */
function catalogueOf(corpus: JourneyCorpus, p: Presentation) {
  return corpus.blocks.get(p.w.instance) ?? (p.steps[0] ? corpus.blocks.get(p.steps[0].journey.instance) : undefined) ?? [...corpus.blocks.values()][0];
}

/** Each step a block is used in, with the role it plays there. */
export function blockUsage(p: Presentation, block: string): { s: PresentedStep; role: string }[] {
  return p.steps.flatMap((s) => (s.step.uses ?? []).filter((u) => u.block === block).map((u) => ({ s, role: u.role })));
}

// ── the journey map, folded into How it works ────────────────────────

/**
 * Where `map/` was (owner, 2026-11-17: merge its "Under the hood" into How it
 * works and drop it): a redirect to `how/`. The map's technical rows were the
 * building blocks per moment (How it works' grid), the business processes (its
 * BPMN list) and the hand-offs, now How it works' "Data on the move".
 */
export function mapRedirect(): string {
  const to = "../how/";
  return withRenderedBy(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Journey map: now in How it works</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${to}">
<script>location.replace("${to}" + location.search);</script>
<meta http-equiv="refresh" content="0; url=${to}">
</head><body><p>The journey map’s technical layer is in <a href="${to}">How it works</a>.</p></body></html>
`, TOOL_ID);
}

/**
 * What moves between the moments, one row per step that hands something on:
 * from whom to whom, how it travels, online or offline, and what the next step
 * receives. The rest of the map's technical layer is already in How it works.
 */
function dataOnTheMove(p: Presentation, a: At): string {
  const steps = p.steps.filter((s) => s.step.handoff);
  if (steps.length === 0) return "";
  const end = (v: string | undefined) => {
    if (!v) return undefined;
    const pv = p.cast.find((x) => x.id === v);
    return `${pv ? avatar(pv, "sm") : ""}${e(pv?.name ?? v)}`;
  };
  const rows = steps
    .map((s) => {
      const h = s.step.handoff!;
      const ends = [end(h.from), end(h.to)].filter(Boolean).join(" → ");
      const net = h.offline !== undefined ? `<span class="jp-net ${h.offline ? "is-off" : "is-on"}">${icon(h.offline ? "wifioff" : "wifi")}${h.offline ? "Offline" : "Online"}</span>` : "";
      return `<tr><th scope="row">${stepChip(a, s, s.step.id, true)}</th><td>${ends ? `<b>${ends}</b>` : ""}${h.carrier ? `<small>${e(h.carrier)}</small>` : ""}${net}</td><td><p class="jp-mhand">${icon("arrow")}<span>${personaText(h.summary, p.cast)}</span></p></td></tr>`;
    })
    .join("");
  return `<section class="jp-card jp-pad jp-move" id="data-on-the-move"><h3 class="jp-h2">${glyph("transfer")} Data on the move</h3><p class="jp-small">What each moment hands to the next: from whom to whom, how it travels, and what the next moment receives.</p>
<div class="jp-move-scroll"><table class="jp-move-t"><thead><tr><th scope="col">Moment</th><th scope="col">From → to, and how</th><th scope="col">Hand-off</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

// ── the persona lens ─────────────────────────────────────────────────────

/** The curve's vertical axis label: a small face, happy at the top, neutral, sad at the foot (VaxLink, ref/06). */
function axisFace(v: number, y: number): string {
  const [label, ic] = v > 0 ? ["happy", "smile"] : v < 0 ? ["sad", "frown"] : ["neutral", "meh"];
  return `<svg x="4" y="${y - 7}" width="14" height="14" viewBox="0 0 24 24" class="jp-cv-face" aria-label="${label}"><title>${label}</title>${iconPaths(ic)}</svg>`;
}

/** The curve's points: the steps a person is in, by position, with how they feel there. */
export function feelingPoints(p: Presentation, actor: string): { index: number; emotion: number }[] {
  return p.steps.flatMap((s) => {
    const x = s.step.experiences.find((y) => y.actor === actor);
    return x?.emotion === undefined ? [] : [{ index: s.index, emotion: x.emotion }];
  });
}

function curveSvg(p: Presentation, person: PersonaView, toWorkshop: string): string {
  const n = p.steps.length;
  const W = 960;
  const H = 230;
  const L = 40;
  const R = 20;
  const top = 20;
  const bottom = 160;
  const xOf = (i: number) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const yOf = (v: number) => top + ((2 - v) / 4) * (bottom - top);
  const pts = feelingPoints(p, person.id);
  const bands = p.chapters
    .map((c, ci) => {
      const first = c.steps[0]!.index;
      const last = c.steps[c.steps.length - 1]!.index;
      const half = n > 1 ? (W - L - R) / (n - 1) / 2 : 40;
      const x0 = Math.max(L - 14, xOf(first) - half);
      const x1 = Math.min(W - R + 14, xOf(last) + half);
      return `${ci % 2 ? `<rect x="${x0.toFixed(1)}" y="${top - 8}" width="${(x1 - x0).toFixed(1)}" height="${bottom - top + 16}" class="jp-cv-band"/>` : ""}<text x="${((x0 + x1) / 2).toFixed(1)}" y="${H - 6}" class="jp-cv-ch" text-anchor="middle">${ci + 1}. ${e(c.title)}</text>`;
    })
    .join("");
  const grid = [2, 0, -2].map((v) => `<line x1="${L - 10}" x2="${W - R + 10}" y1="${yOf(v)}" y2="${yOf(v)}" class="${v === 0 ? "jp-cv-zero" : "jp-cv-grid"}"/>${axisFace(v, yOf(v))}`).join("");
  const codes = p.steps.map((s) => `<text x="${xOf(s.index).toFixed(1)}" y="${bottom + 26}" class="jp-cv-code" text-anchor="middle">${e(s.step.id)}</text>`).join("");
  const segs = pts
    .slice(1)
    .map((q, k) => {
      const a = pts[k]!;
      const dashed = q.index - a.index > 1;
      return `<line x1="${xOf(a.index).toFixed(1)}" y1="${yOf(a.emotion)}" x2="${xOf(q.index).toFixed(1)}" y2="${yOf(q.emotion)}" class="jp-cv-line${dashed ? " is-gap" : ""}"/>`;
    })
    .join("");
  const dots = pts
    .map((q) => {
      const s = p.steps[q.index]!;
      return `<a href="${e(`${toWorkshop}walkthrough/${s.key}/`)}"><title>${e(`${s.step.id} ${s.step.title}: ${EMOTION[q.emotion]?.[0] ?? ""}`)}</title><circle cx="${xOf(q.index).toFixed(1)}" cy="${yOf(q.emotion)}" r="9" class="jp-cv-dot"/></a>`;
    })
    .join("");
  return `<svg class="jp-curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(`How ${person.name} feels at each step`)}" style="--c:${e(person.color)}">${bands}${grid}${codes}${segs}${dots}</svg>`;
}

function personaPage(corpus: JourneyCorpus, p: Presentation, links: SiteLinks, who: PersonaView, depth: 1 | 2): string {
  const a = at(depth, links);
  const toPersonas = depth === 1 ? "" : "../";
  const list = p.cast
    .map((x) => `<a class="jp-plist${x.id === who.id ? " is-on" : ""}" href="${e(`${toPersonas}${x.id}/`)}" style="--c:${e(x.color)}"${x.id === who.id ? ' aria-current="page"' : ""}>${avatar(x)}<span><b>${e(x.name)}</b>${x.role ? `<small>${e(x.role)}</small>` : ""}</span></a>`)
    .join("");
  const mine = p.steps.filter((s) => s.step.experiences.some((y) => y.actor === who.id));
  const touch = mine
    .map((s) => {
      const ex = s.step.experiences.find((y) => y.actor === who.id)!;
      return `<li><i style="background:${e(who.color)}"></i><div class="jp-card jp-tp"><div class="jp-tp-main"><div class="jp-small"><b class="jp-mono">${e(s.step.id)}</b>${s.step.when ? ` ${e(s.step.when)}` : ""}${s.step.where ? ` · ${e(s.step.where)}` : ""}</div><h4>${e(s.step.title)}</h4><p>${personaText(ex.doing, p.cast)}</p>${ex.feeling ? `<p class="jp-feel">${e(ex.feeling)}</p>` : ""}${s.step.touchpoint ? `<small>Touchpoint: ${e(s.step.touchpoint)}</small>` : ""}</div><div class="jp-tp-side">${emotionBadge(ex.emotion)}<a class="jp-present" href="${e(walkHref(a, s))}">${icon("play")} Present</a></div></div></li>`;
    })
    .join("");
  const listOf = (title: string, ic: string, items: string[] | undefined) =>
    items?.length ? `<div class="jp-pbox"><div class="jp-pbox-h">${ic} ${e(title)}</div><ul>${items.map((x) => `<li>${e(x)}</li>`).join("")}</ul></div>` : "";
  const body = `<div class="jp-lens">
<aside class="jp-lens-l"><h3 class="jp-h">Whose journey?</h3><nav class="jp-plists" aria-label="People">${list}</nav></aside>
<div class="jp-lens-r">
<section class="jp-card jp-phead" style="--c:${e(who.color)}"><div class="jp-phead-top">${avatar(who, "lg")}<div><h2>${personaNameHtml(who, personaHref(corpus, p.w.workshop.presentation ?? {}, a.siteRoot))}${who.role || who.country ? ` <small>${e([who.role, who.country].filter(Boolean).join(" · "))}</small>` : ""}</h2>${who.goal ? `<p class="jp-goal">${icon("compass")}<b>Goal:</b> ${e(who.goal)}</p>` : ""}</div></div>${who.needs?.length || who.frustrations?.length ? `<div class="jp-pboxes">${listOf("Needs", icon("smile", "jp-emerald"), who.needs)}${listOf("Frustrations", icon("alert", "jp-rose"), who.frustrations)}</div>` : ""}</section>
<section class="jp-card jp-pad"><div class="jp-row"><h3 class="jp-h">How ${e(who.name)} feels along the way</h3><span class="jp-small">A dashed line: not present in between · a point opens that moment</span></div>${feelingPoints(p, who.id).length ? curveSvg(p, who, a.toWorkshop) : `<p class="jp-small">No step says how ${e(who.name)} feels.</p>`}</section>
<section><h3 class="jp-h jp-h-pad">${e(who.name)}’s touchpoints (${mine.length})</h3><ol class="jp-tps">${touch}</ol></section>
</div>
</div>`;
  return frame({ p, root: a.root, toWorkshop: a.toWorkshop, view: "personas", title: `${who.name} — persona lens — ${presentationName(p)}`, ...note(p, "personas"), body, foot: drawerOf(corpus, p, a, mine, who.name, `in ${who.name}’s moments`) });
}

// ── how it works ─────────────────────────────────────────────────────────

/** The workshop's own ArchiMate views, then those of the taught journeys and their chapters, once each, in teaching order. */
function viewsOf(p: Presentation): { instance: string; model: string; view: string; label?: string }[] {
  const out: { instance: string; model: string; view: string; label?: string }[] = [];
  const seen = new Set<string>();
  for (const v of p.w.workshop.presentation?.views ?? []) {
    const k = `${p.w.instance}\0${v.model}\0${v.view}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ instance: p.w.instance, ...v });
    }
  }
  const journeys = [...p.chapters.map((c) => c.journey), ...p.steps.map((s) => s.journey)];
  for (const j of journeys) {
    for (const v of j.scenario.views ?? []) {
      const k = `${j.instance}\0${v.model}\0${v.view}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ instance: j.instance, ...v });
    }
  }
  return out;
}

function howPage(corpus: JourneyCorpus, p: Presentation, links: SiteLinks, selected: string | undefined): string {
  const depth = selected ? 2 : 1;
  const a = at(depth, links);
  const toHow = selected ? "../" : "";
  const pr = p.w.workshop.presentation ?? {};
  const cat = catalogueOf(corpus, p);
  const layers = cat?.layers ?? [];
  const toneOf = (layer: string) => LAYER_TONES[Math.max(0, layers.findIndex((l) => l.id === layer)) % LAYER_TONES.length]!;
  const chip = (id: string) => {
    const b = cat?.blocks.get(id);
    if (!b) return `<span class="jp-bchip jp-unresolved" title="not in the catalogue">${e(id)}</span>`;
    return `<a class="jp-bchip jp-layer-${toneOf(b.layer)}${selected === id ? " is-on" : ""}" href="${e(`${toHow}${id}/#jp-blocks`)}">${e(b.short ?? b.name)}</a>`;
  };
  const ideas = cat?.ideas ?? [];
  const ideasHtml = ideas.length
    ? `<section class="jp-ideas">${ideas.map((i) => `<div class="jp-card jp-idea${selected && i.blocks.includes(selected) ? " is-on" : ""}"><div class="jp-idea-h">${icon("bulb", "jp-amber")} ${e(i.title)}</div><p>${e(i.text)}</p><div class="jp-chips">${i.blocks.map(chip).join("")}</div></div>`).join("")}</section>`
    : "";
  const steps = p.steps;
  const blocks = cat ? [...cat.blocks.values()] : [];
  const used = new Set(steps.flatMap((s) => (s.step.uses ?? []).map((u) => u.block)));
  const shown = blocks.filter((b) => used.has(b.id));
  const matrix = cat
    ? `<section class="jp-card jp-matrix-scroll"><div class="jp-matrix" style="--n:${steps.length}">
<div class="jp-mx-corner">Building block ↓ / Moment →</div>${p.chapters.map((c, i) => `<div class="jp-mx-chap" style="grid-column:span ${c.steps.length}">${i + 1}. ${e(c.title)}</div>`).join("")}
<div class="jp-mx-exp"><b>Experience</b><small>A moment opens it in the walkthrough</small></div>${steps.map((s) => `<a class="jp-mx-step" href="${e(walkHref(a, s))}" title="${e(s.step.title)}"><b class="jp-mono">${e(s.step.id)}</b><span>${e(s.step.title)}</span></a>`).join("")}
${layers
  .map((l) => {
    const tone = toneOf(l.id);
    const rows = shown.filter((b) => b.layer === l.id);
    if (rows.length === 0) return "";
    return `<div class="jp-mx-layer jp-layer-${tone}">${e(l.label)}</div><div class="jp-mx-band jp-layer-${tone}" style="grid-column:span ${steps.length}"></div>${rows
      .map((b) => {
        const on = selected === b.id;
        const dim = selected !== undefined && !on;
        return `<a class="jp-mx-block${on ? " is-on" : ""}${dim ? " is-dim" : ""} jp-layer-${tone}" href="${e(`${toHow}${b.id}/#jp-blocks`)}"${on ? ' aria-current="true"' : ""}><i class="jp-dot jp-layer-${tone}"></i>${e(b.short ?? b.name)}</a>${steps
          .map((s) => {
            const u = (s.step.uses ?? []).find((x) => x.block === b.id);
            return `<div class="jp-mx-cell${on ? " is-on" : ""}${dim ? " is-dim" : ""} jp-layer-${tone}">${u ? `<a class="jp-dot jp-dot-lg jp-layer-${tone}" href="${e(walkHref(a, s))}" title="${e(`${s.step.id}: ${u.role}`)}" aria-label="${e(`${s.step.id}: ${u.role}`)}"></a>` : ""}</div>`;
          })
          .join("")}`;
      })
      .join("")}`;
  })
  .join("")}
</div></section>`
    : `<section class="jp-card jp-pad"><p class="jp-small">No building-block catalogue is declared for ${e(p.w.instance)}: declare one (a directory of the <code>building-blocks</code> kind) and the grid draws.</p></section>`;
  const b = selected ? cat?.blocks.get(selected) : undefined;
  const elementList = (els: readonly ArchimateElementLink[]) =>
    `<ul class="jp-amels">${els.map((x) => `<li>${ext(a.siteRoot + x.page, x.name, "", DAK_ATTR)} <small>${e(x.type)}</small>${haveMark(p, x)}</li>`).join("")}</ul>`;
  const blockEls = b ? (links.archimateBlock?.(p.w.instance, b.id) ?? []) : [];
  const detail = b
    ? `<aside class="jp-card jp-bdetail"><span class="jp-lchip jp-layer-${toneOf(b.layer)}">${e(layers.find((l) => l.id === b.layer)?.label ?? b.layer)}</span><h3>${e(b.name)}</h3><small>${glyph("clinic")} ${e([b.owner, b.jurisdiction].filter(Boolean).join(" · "))}</small>
<div><div class="jp-label">What it is</div><p>${e(b.what)}</p></div>
${b.soWhat ? `<div class="jp-sowhat-box"><div class="jp-label jp-amber8">So what for the journey</div><p>${e(b.soWhat)}</p></div>` : ""}
${b.links?.length ? `<div><div class="jp-label">Learn more</div><ul class="jp-blinks">${b.links.map((l) => `<li>${ext(l.url, l.label)}</li>`).join("")}</ul></div>` : ""}
${blockEls.length ? `<div><div class="jp-label">In the architecture (ArchiMate)</div>${elementList(blockEls)}</div>` : ""}
<div><div class="jp-label">Moments it makes possible</div><ul class="jp-buses">${blockUsage(p, b.id)
        .map(({ s, role }) => `<li><a href="${e(walkHref(a, s))}"><span><b class="jp-mono">${e(s.step.id)}</b> ${e(s.step.title)}</span><small>${e(role)}</small></a></li>`)
        .join("") || `<li class="jp-small">No step of this walkthrough uses it.</li>`}</ul></div></aside>`
    : `<aside class="jp-bhint">${icon("bulb")}<p>Select a building block (left of the grid, or a chip in a big idea) to see what it is, why it matters, and which moments depend on it.</p></aside>`;
  const toSite = a.siteRoot;
  const views = viewsOf(p)
    .map((v) => ({ v, t: links.archimateView?.(v.instance, v.model, v.view) }))
    .filter((x): x is { v: (typeof x)["v"]; t: NonNullable<(typeof x)["t"]> } => x.t !== undefined);
  const viewsHtml = views.length
    ? `<section class="jp-card jp-pad jp-am"><h3 class="jp-h2">${icon("branch")} ArchiMate views</h3><p class="jp-small">The journeys and the systems that carry them as ArchiMate views. Every box in a drawing opens its element’s page.</p>
<div class="jp-amtabs" role="tablist">${views.map((x, i) => `<button type="button" role="tab" data-jp-tab="am-${i}" aria-selected="${i === 0}"${i === 0 ? ' class="is-on"' : ""}>${e(x.v.label ?? x.t.name)}</button>`).join("")}</div>
${views
  .map(
    (x, i) =>
      `<div class="jp-ampane" data-jp-pane="am-${i}"${i ? " hidden" : ""}><div class="jp-amlinks"><b>${e(x.t.name)}</b>${ext(toSite + x.t.page, "View page", "", DAK_ATTR)}${ext(`${toSite}${x.t.page}../../`, "All views and elements", "", DAK_ATTR)}</div><object type="image/svg+xml" data-jp-fit data="${e(toSite + x.t.svg)}" aria-label="${e(x.t.name)}"><a href="${e(toSite + x.t.page)}">${e(x.t.name)}</a></object>${x.t.elements?.length ? `<details class="jp-amel"><summary>The ${x.t.elements.length} element${x.t.elements.length === 1 ? "" : "s"} in this view</summary>${elementList(x.t.elements)}</details>` : ""}</div>`,
  )
  .join("")}</section>`
    : "";
  // The business processes the taught steps are carried out by, once each.
  const procs = new Map<string, { instance: string; journey: PresentedStep["journey"]; steps: PresentedStep[] }>();
  for (const s of steps) for (const r of s.step.realisedBy ?? []) {
    const k = `${s.journey.instance}\0${r.process}`;
    const x = procs.get(k) ?? { instance: s.journey.instance, journey: s.journey, steps: [] };
    if (!x.steps.includes(s)) x.steps.push(s);
    procs.set(k, x);
  }
  const procHtml = procs.size
    ? `<section class="jp-card jp-pad"><h3 class="jp-h2">${icon("workflow")} Business processes (BPMN)</h3><ul class="jp-procs">${[...procs]
        .map(([k, x]) => {
          const file = k.split("\0")[1]!;
          const src = sourceHref(corpus, x.instance, file);
          return `<li><b>${e(processName(corpus, x.instance, file) ?? file)}</b><span class="jp-chips">${x.steps.map((s) => stepChip(a, s, s.step.id)).join("")}</span><span class="jp-mproc-links">${processLinks(corpus, pr, x.journey, file, a.siteRoot)}${src ? ext(src, "BPMN source") : ""}</span></li>`;
        })
        .join("")}</ul></section>`
    : "";
  const archHtml = pr.architecture ? architectureHtml(p, a, pr.architecture, links.archimateArchitecture?.(p.w.instance, pr.architecture)) : "";
  const igLinks = (pr.links ?? []).filter((l) => l.frame).map((l) => ext(fromSite(l.href, a.siteRoot), l.label)).join(" · ");
  const body = `<section class="jp-vhead"><h2>How it works: from journey to architecture</h2><p>Every moment in the journey depends on a few standards and open tools. Pick a big idea or a building block to see which moments it makes possible, or a moment to present it with its technical layer.${igLinks ? ` Specified in ${igLinks}.` : ""}</p></section>
${archHtml}
${viewsHtml}
${ideasHtml}
<div class="jp-howgrid" id="jp-blocks">${matrix}${detail}</div>
${dataOnTheMove(p, a)}
${procHtml}`;
  return frame({ p, root: a.root, toWorkshop: a.toWorkshop, view: "how", title: `${b ? `${b.name} — ` : ""}How it works — ${presentationName(p)}`, ...note(p, "how"), body, foot: b ? drawerOf(corpus, p, a, blockUsage(p, b.id).map((x) => x.s), b.short ?? b.name, `where ${b.short ?? b.name} is used`) : drawerOf(corpus, p, a, steps, "How it works") });
}

// ── "we have this" (owner, 2026-11-17) ───────────────────────────────────

/** The ArchiMate type a room marks as its own. */
const MARKABLE = "Application Component";

/** An element's id for its keys: the last segment of its page (`…/element/<id>/`), kebab. */
export function elementSlug(x: ArchimateElementLink): string {
  const seg = x.page.replace(/\/(index\.html)?$/, "").split("/").pop() ?? x.name;
  return seg.replace(/\.html$/, "").replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "element";
}

/** Where a room's mark on an element is kept (`jv:` + this): `<workshop>:am:<element>:have` ("1") and `…:name` (its local name). */
export const elementKey = (workshop: string, x: ArchimateElementLink, part: "have" | "name"): string => `${workshop}:am:${elementSlug(x)}:${part}`;

/** An application component's "We have this" tick and the room's own name for it; nothing for any other element. */
function haveMark(p: Presentation, x: ArchimateElementLink): string {
  if (x.type !== MARKABLE) return "";
  const ws = p.w.workshop.id;
  return `<span class="jp-have"><label><input type="checkbox" name="${e(elementKey(ws, x, "have"))}" data-jv-check> We have this</label><input type="text" class="jp-answer jp-have-name" name="${e(elementKey(ws, x, "name"))}" data-jv-text placeholder="Our name for it" aria-label="${e(`Our name for ${x.name}`)}"></span>`;
}

/** The application components a workshop's How it works shows, once each: the architecture panel's, then its views'. */
function markableElements(p: Presentation, links: SiteLinks): ArchimateElementLink[] {
  const pr = p.w.workshop.presentation ?? {};
  const out = new Map<string, ArchimateElementLink>();
  const add = (x: ArchimateElementLink) => {
    if (x.type === MARKABLE && !out.has(elementSlug(x))) out.set(elementSlug(x), x);
  };
  const panel = pr.architecture ? links.archimateArchitecture?.(p.w.instance, pr.architecture) : undefined;
  for (const r of panel?.rows ?? []) for (const c of r.cells) for (const b of c) add(b);
  for (const v of viewsOf(p)) for (const x of links.archimateView?.(v.instance, v.model, v.view)?.elements ?? []) add(x);
  return [...out.values()];
}

// ── the architecture panel (JV-13) ───────────────────────────────────────

type ArchitectureSpec = NonNullable<NonNullable<Presentation["w"]["workshop"]["presentation"]>["architecture"]>;

/**
 * The countries side by side on the rows of the reference architecture, each
 * box a system part linked to its element page (and its IG page when it has
 * one), tagged with the moments whose processes its system serves; the shared
 * grouping as the foundation band beneath. All of it from the ArchiMate graph.
 */
function architectureHtml(p: Presentation, a: At, spec: ArchitectureSpec, panel: ArchitecturePanel | undefined): string {
  const title = spec.title ?? "Architecture: the countries on one trust foundation";
  if (!panel) return `<section class="jp-card jp-pad jp-arch"><h3 class="jp-h2">${e(title)}</h3><p class="jp-small jp-unresolved">The ArchiMate model <code>${e(spec.model)}</code> or a grouping the workshop names in <code>presentation.architecture</code> is not in this layer's ArchiMate graph.</p></section>`;
  const n = panel.countries.length;
  const el = (x: ArchimateElementLink, label = x.name) => ext(a.siteRoot + x.page, label, "", DAK_ATTR);
  const moments = (bpmn: readonly string[]) => p.steps.filter((s) => (s.step.realisedBy ?? []).some((r) => bpmn.includes(r.process)));
  const heads = panel.countries
    .map((c, i) => {
      const spc = spec.countries[i]!;
      const code = spc.code ?? c.name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
      return `<div class="jp-arch-c"><span class="jp-arch-code">${e(code)}</span><b>${el(c, spc.label ?? c.name)}</b></div>`;
    })
    .join("");
  const rows = panel.rows
    .map((r) => {
      const label = `<div class="jp-arch-l">${el(r.layer)}</div>`;
      if (r.cells.every((c) => c.length === 0)) {
        return `${label}<div class="jp-arch-std" style="grid-column:span ${n}">${r.blocks.length ? r.blocks.map((b) => el(b)).join("") : `<i>Not needed in this journey</i>`}</div>`;
      }
      return `${label}${r.cells
        .map(
          (cell) =>
            `<div class="jp-arch-cell">${
              cell.length
                ? cell
                    .map((b) => {
                      const ms = moments(b.bpmn);
                      return `<div class="jp-arch-box"><small>${el(b.block)}</small><b>${el(b)}</b>${b.ig ? ext(b.ig, "IG page", "jp-arch-ig") : ""}${ms.length ? `<span class="jp-arch-ms">${ms.map((s) => stepChip(a, s, s.step.id)).join("")}</span>` : ""}${haveMark(p, b)}</div>`;
                    })
                    .join("")
                : `<i>Not needed in this journey</i>`
            }</div>`,
        )
        .join("")}`;
    })
    .join("");
  const found = panel.shared
    ? `<div class="jp-arch-found"><div class="jp-arch-found-h">${glyph("shield-check")} <b>Foundation:</b> ${panel.shared.members.map((m) => el(m)).join(", ") || el(panel.shared.group)}</div>${spec.notes?.length ? `<ul>${spec.notes.map((x) => `<li>${e(x)}</li>`).join("")}</ul>` : ""}</div>`
    : "";
  return `<section class="jp-card jp-pad jp-arch"><h3 class="jp-h2">${e(title)}</h3>${spec.intro ? `<p class="jp-small">${e(spec.intro)}</p>` : ""}
<div class="jp-arch-scroll"><div class="jp-arch-grid" style="--n:${n}"><div></div>${heads}${rows}</div></div>${found}</section>`;
}

// ── the discussion ───────────────────────────────────────────────────────

// ── the canvas as a form (owner, 2026-11-17) ─────────────────────────────

/** Every journey question of the workshop, with the key its answer is kept under and the canvas field it is, if any. */
function journeyQuestions(p: Presentation): AnnexQuestion[] {
  const ws = p.w.workshop;
  return p.steps.flatMap((s) => (s.ws?.questions ?? []).map((q) => ({ step: s.step.id, stepKey: s.key, module: q.module, text: q.text, key: questionKey(ws.id, s.ws!, q), ...(q.canvas ? { canvas: q.canvas } : {}) })));
}

/** Per canvas field ref, the keys its answer may have been kept under before: the journey questions that are it. */
function canvasWas(p: Presentation): Map<string, string> {
  const ws = p.w.workshop;
  const out = new Map<string, string>();
  for (const s of p.steps) (s.ws?.questions ?? []).forEach((q, i) => {
    if (q.canvas && !out.has(q.canvas)) out.set(q.canvas, earlierKeys(ws.id, s.ws!, q, legacyQuestionKey(ws.id, s, i)));
  });
  return out;
}

/** The canvas sheets `ids` (all when absent) as the on-screen form. */
function canvasForm(p: Presentation, a: At, ids?: readonly string[]): string {
  const ws = p.w.workshop;
  if (!ws.canvas) return "";
  const qs = journeyQuestions(p);
  return `<div class="jp-cv">${canvasFormHtml(ws.id, ws.canvas, qs, {
    ...(ids ? { ids } : {}),
    scale: ws.assessment?.scales[0]?.options,
    was: canvasWas(p),
    stepLink: (q) => stepChip(a, p.steps.find((s) => s.key === q.stepKey), q.step),
    answerBox: (name, label) => answerBox(name, label, 2),
  })}</div>`;
}

/** The button that writes the canvas out as an editable, pre-filled PDF, and (once a page) the model it writes from. */
function canvasPdf(p: Presentation, withModel = true): string {
  const ws = p.w.workshop;
  if (!ws.canvas) return "";
  const model = canvasModel(ws.id, ws.canvas, journeyQuestions(p), ws.assessment?.scales[0]?.options);
  return `<div class="jp-cv-pdf jp-noprint"><button type="button" class="jp-btn-dark" data-jp-canvas-pdf>${icon("file")} Download the ${e(ws.canvas.title)} (editable PDF, ${e(ws.canvas.size ?? "A3")})</button><span class="jp-small">Filled in with this browser’s answers; every field stays editable in a PDF reader.</span>${withModel ? `<script type="application/json" data-jp-canvas-model>${jsonInHtml(model)}</script>` : ""}</div>`;
}

/** The discussion's head: the gap report's script, the sheets' styles when it carries the Table sheets, and the canvas PDF writer when the workshop has a canvas. */
function discussHead(p: Presentation, a: At, gap: boolean): { head?: string } {
  const head = [gap ? `<script src="${a.root}assets/gap-report.js" defer></script>` : "", hasSheets(p) ? `<link rel="stylesheet" href="${a.root}assets/journeys.css">` : "", p.w.workshop.canvas ? `<script src="${a.root}assets/canvas-pdf.js" defer></script>` : ""].filter(Boolean).join("\n");
  return head ? { head } : {};
}

function discussPage(corpus: JourneyCorpus, p: Presentation, links: SiteLinks): string {
  if (p.w.workshop.lab) return labPage(corpus, p, links, p.w.workshop.lab);
  const a = at(1, links);
  const ws = p.w.workshop;
  const pr = ws.presentation ?? {};
  const mod = (id: string | undefined) => (id ? `<a class="jp-mod" href="${e(`${a.toWorkshop}${moduleSegment(id)}/`)}" title="${e(ws.modules.find((m) => m.id === id)?.title ?? id)}">${e(id)}</a>` : "");
  const cards = (ws.discussion ?? [])
    .map((d, i) => `<div class="jp-card jp-dq"><div class="jp-dq-h"><span class="jp-dq-n">${i + 1}</span><b>${e(d.theme)}</b>${mod(d.module)}</div><p>${e(d.question)}</p>${d.steps?.length ? `<div class="jp-dq-rev"><span>Revisit:</span>${d.steps.map((r) => stepChip(a, stepByRef(corpus, p, r), r, true)).join("")}</div>` : ""}</div>`)
    .join("");
  const byModule = ws.modules
    .map((m) => {
      const qs = p.steps.flatMap((s) => (s.ws?.questions ?? []).filter((q) => q.module === m.id).map((q) => ({ s, q })));
      if (qs.length === 0) return "";
      const sheet = ws.sheets?.find((x) => x.id === m.sheet);
      return `<div class="jp-card jp-dm"><div class="jp-dm-h">${mod(m.id)}<b>${e(m.title)}</b><small>${m.day ? `<span class="jp-presenter-only">Day ${m.day}${sheet?.label ? " · " : ""}</span>` : ""}${e(sheet?.label ?? "")}</small></div>${m.carries ? `<p class="jp-dm-c">${e(m.carries)}</p>` : ""}<ul>${qs.map(({ s, q }) => `<li>${stepChip(a, s, s.step.id)}<span>${e(q.text)}</span></li>`).join("")}</ul></div>`;
    })
    .join("");
  const tables = (ws.tables ?? [])
    .map((t) => {
      const rows = t.rows
        .map((r) => {
          const forced = p.steps.filter((s) => (s.ws?.tags ?? []).some((g) => g.table === t.id && g.row === r.id));
          return `<div class="jp-card jp-dt"><b>${e(r.label)}</b>${r.question || r.what ? `<p>${e(r.question ?? r.what!)}</p>` : ""}${r.example ? `<small>e.g. ${e(r.example)}</small>` : ""}${forced.length ? `<div class="jp-dq-rev"><span>Forced by:</span>${forced.map((s) => stepChip(a, s, s.step.id)).join("")}</div>` : ""}</div>`;
        })
        .join("");
      return `<section class="jp-card jp-pad"><h3 class="jp-h">${icon("landmark", "jp-indigo")} ${e(t.title)}${t.module ? ` (${e(t.module)})` : ""}</h3>${t.description ? `<p class="jp-small">${e(t.description)}</p>` : ""}<div class="jp-dts">${rows}</div></section>`;
    })
    .join("");
  const scales = ws.assessment?.scales ?? [];
  const model = gapReportModel(p, (s) => walkHref(a, s));
  const gap = model
    ? `<section class="jp-card jp-pad jp-gapreport" data-jp-gapreport><div class="jp-row"><h3 class="jp-h">${icon("clipboard", "jp-rose")} Gap report</h3><span class="jp-gap-act jp-noprint"><span class="jp-small"><b data-jp-gap-count>0</b> of ${model.items.length} capabilities marked as gaps</span><button type="button" class="jp-btn-line" data-jp-report-print>${icon("printer")} Print / Save as PDF</button><button type="button" class="jp-btn-line" data-jp-report-csv>${icon("file")} Download CSV</button><button type="button" class="jp-btn-line" data-jp-gap-clear>Clear</button></span></div><p class="jp-small">Assembled from the gap strip on every moment of the walkthrough, <b>in this browser only</b>: nothing is sent anywhere, and another browser keeps its own answers. ${e(ws.assessment?.standingLine ?? "")}</p>
<script type="application/json" data-jp-gapreport-model>${jsonInHtml(model)}</script>
<div data-jp-gapreport-body></div><p class="jp-small jp-gap-none" data-jp-gap-none>Nothing marked ${e(scales[0]!.options.slice(1).map((o) => o.label.toLowerCase()).join(" or "))} yet. Open a moment in the walkthrough and use its gap strip.</p></section>`
    : "";
  const takeaways = p.steps.filter((s) => s.step.policy);
  const body = `<section class="jp-dhero"><span class="jp-kicker">${icon("message")} Questions for the room</span><h2>${e(pr.closingQuestion ?? "Closing discussion")}</h2></section>
${cards ? `<div class="jp-dqs">${cards}</div>` : ""}
${ws.promise ? `<section class="jp-promise"><b>The scope promise.</b> ${e(ws.promise)}</section>` : ""}
${byModule ? `<section class="jp-card jp-pad"><h3 class="jp-h">${icon("message", "jp-indigo")} The journey’s questions, module by module</h3><div class="jp-dms">${byModule}</div></section>` : ""}
${tables}
${ws.canvas ? `<section class="jp-card jp-pad jp-cv-wrap" id="canvas"><h3 class="jp-h">${icon("clipboard", "jp-indigo")} ${e(ws.canvas.title)}</h3>${ws.canvas.description ? `<p class="jp-small">${e(ws.canvas.description)}</p>` : ""}${canvasPdf(p)}${canvasForm(p, a)}</section>` : ""}
${gap}
${takeaways.length ? `<section class="jp-card jp-pad"><h3 class="jp-h">${icon("landmark", "jp-indigo")} Every moment’s policy takeaway</h3><ul class="jp-takes">${takeaways.map((s) => `<li>${stepChip(a, s, s.step.id)}<div><b>${e(s.step.title)}</b><p>${e(s.step.policy!)}</p></div></li>`).join("")}</ul></section>` : ""}
${sheetsPanel(corpus, p)}`;
  return frame({ p, root: a.root, toWorkshop: a.toWorkshop, view: "discuss", title: `Discussion — ${presentationName(p)}`, ...note(p, "discuss"), ...discussHead(p, a, Boolean(gap)), prev: `${a.toWorkshop}walkthrough/${p.steps[p.steps.length - 1]!.key}/`, body, foot: drawerOf(corpus, p, a, p.steps, "Discussion") });
}

// ── the discussion as a lab ──────────────────────────────────────────────

/** One answer the lab's summary reads back: a write-in, a choice on a scale, or a tick. */
export interface LabSummaryItem {
  label: string;
  /** The browser key, without `jv:`. */
  name: string;
  type: "text" | "choice" | "check";
  /** A choice's scale. */
  options?: { id: string; label: string }[];
  /** A write-in's text, or a tick's state ("1"), until the table changes it. */
  value?: string;
  /** The heading a choice is counted under ("Governance"). */
  group?: string;
}
export interface LabSummarySection {
  id: string;
  n: number;
  label: string;
  items: LabSummaryItem[];
}

/**
 * The use-case statement a table starts from: the lab's own text, then one
 * line per taught journey (its chapter title and description), so the room
 * edits what the journeys already say rather than a blank.
 */
export function labUseCaseText(p: Presentation, lab: WorkshopLab): string {
  const first = (t: string) => /^([\s\S]+?[.!?])(?=\s|$)/.exec(t.trim())?.[1] ?? t.trim();
  const lines = p.chapters.map((c) => `• ${c.title}: ${first(c.journey.scenario.description)}`);
  return [lab.useCaseText?.trim(), ...lines].filter(Boolean).join("\n");
}

const labKey = (ws: string, ...parts: string[]): string => [ws, ...parts].join(":");

function labTableRows(t: WorkshopTable, row: (r: WorkshopTable["rows"][number]) => string): string {
  const groups: { name: string | undefined; rows: WorkshopTable["rows"] }[] = [];
  for (const r of t.rows) {
    const last = groups[groups.length - 1];
    if (last && last.name === r.group) last.rows.push(r);
    else groups.push({ name: r.group, rows: [r] });
  }
  return groups
    .map((g) => `<div class="jp-lab-grp">${g.name ? `<h4>${e(g.name)}</h4>` : ""}${g.rows.map(row).join("")}</div>`)
    .join("");
}

/**
 * The Discussion view as a lab (`workshop.lab`): one tab per step, each with
 * its timer and DISCUSS prompt, the parts it names, and a summary assembled
 * from all of them in this browser. The journey's questions are answerable
 * here and on the walkthrough under one key (`questionKey`); the gap strip's
 * ratings likewise. Without script every step shows, one under the other.
 */
function labPage(corpus: JourneyCorpus, p: Presentation, links: SiteLinks, lab: WorkshopLab): string {
  const a = at(1, links);
  const ws = p.w.workshop;
  const pr = ws.presentation ?? {};
  const tables = new Map((ws.tables ?? []).map((t) => [t.id, t]));
  const mod = (id: string | undefined) => (id ? `<a class="jp-mod" href="${e(`${a.toWorkshop}${moduleSegment(id)}/`)}" title="${e(ws.modules.find((m) => m.id === id)?.title ?? id)}">${e(id)}</a>` : "");
  const forcedBy = (t: string, r: string) => p.steps.filter((s) => (s.ws?.tags ?? []).some((g) => g.table === t && g.row === r));
  const scales = ws.assessment?.scales ?? [];
  const summary: LabSummarySection[] = [];
  const useCaseText = labUseCaseText(p, lab);
  const model = gapReportModel(p, (s) => walkHref(a, s));

  const radios = (name: string, options: { id: string; label: string }[], label: string, more = false) =>
    `<div class="jp-choices${more ? " jp-choices-more" : ""}" role="radiogroup" aria-label="${e(label)}">${options
      .map((o, oi) => `<label class="jp-choice jp-choice-${oi}"><input type="radio" name="${e(name)}" value="${e(o.id)}" data-jv-store${oi === 0 ? ' class="jp-first"' : ""}><span>${e(o.label)}</span></label>`)
      .join("")}</div>`;

  const part = (st: WorkshopLabStep, items: LabSummaryItem[]): string => {
    const out: string[] = [];
    for (const f of st.fields ?? []) {
      const name = labKey(ws.id, "lab", st.id, f.id);
      items.push({ label: f.label, name, type: "text" });
      out.push(`<label class="jp-lab-field"><b>${e(f.label)}</b>${f.hint ? `<small>${e(f.hint)}</small>` : ""}<textarea class="jp-answer" name="${e(name)}" rows="${f.lines}" data-jv-text></textarea></label>`);
    }
    if (st.useCases && lab.useCases?.length) {
      const cards = lab.useCases
        .map((u, i) => {
          const name = labKey(ws.id, "uc", u.id);
          items.push({ label: u.label, name, type: "check", ...(u.journey ? { value: "1" } : {}), group: "Use cases" });
          return `<label class="jp-uc"><input type="checkbox" name="${e(name)}" data-jv-check${u.journey ? " checked" : ""}><span class="jp-uc-n">${i + 1}</span><b>${e(u.label)}</b>${u.description ? `<small>${e(u.description)}</small>` : ""}${u.journey ? `<em>From the journeys</em>` : ""}</label>`;
        })
        .join("");
      const name = labKey(ws.id, "lab", "use-case");
      items.push({ label: "Our use case", name, type: "text", value: useCaseText });
      out.push(`<h4 class="jp-lab-sub">Use case or health goal <small>Tick as many as apply</small></h4><div class="jp-ucs">${cards}</div>
<label class="jp-lab-field"><b>Our use case is…</b><small>Filled in from the journeys. Change it to your country’s words.</small><textarea class="jp-answer" name="${e(name)}" rows="${Math.min(12, useCaseText.split("\n").length + 1)}" data-jv-text data-jp-usecase>${e(useCaseText)}</textarea></label>
<button type="button" class="jp-btn-line jp-noprint" data-jp-text-reset="${e(name)}">${icon("reset")} Back to the journeys’ text</button>`);
    }
    for (const id of st.rate ?? []) {
      const t = tables.get(id)!;
      const sc = lab.scale!;
      const body = labTableRows(t, (r) => {
        const name = labKey(ws.id, "rate", t.id, r.id);
        items.push({ label: r.label, name, type: "choice", options: sc.options, ...(r.group ? { group: r.group } : {}) });
        return `<div class="jp-lab-row"><span title="${e(r.what ?? r.question ?? "")}">${e(r.label)}</span>${radios(name, sc.options, `${r.label}: ${sc.label}`)}</div>`;
      });
      out.push(`<div class="jp-lab-tbl">${t.description ? `<p class="jp-small">${e(t.description)}</p>` : ""}<div class="jp-lab-grps">${body}</div></div>`);
    }
    for (const id of st.holders ?? []) {
      const t = tables.get(id)!;
      const rows = t.rows
        .map((r) => {
          const name = labKey(ws.id, "hold", t.id, r.id);
          items.push({ label: `${t.title}: ${r.label}`, name, type: "text" });
          const f = forcedBy(t.id, r.id);
          return `<div class="jp-card jp-dt"><b>${e(r.label)}</b>${r.question || r.what ? `<p>${e(r.question ?? r.what!)}</p>` : ""}<input class="jp-answer" type="text" name="${e(name)}" data-jv-text aria-label="${e(`Who holds it today: ${r.label}`)}" placeholder="Who holds it today?">${f.length ? `<div class="jp-dq-rev"><span>Forced by:</span>${f.map((s) => stepChip(a, s, s.step.id)).join("")}</div>` : ""}</div>`;
        })
        .join("");
      out.push(`<h4 class="jp-lab-sub">${e(t.title)}${t.module ? ` ${mod(t.module)}` : ""}</h4>${t.description ? `<p class="jp-small">${e(t.description)}</p>` : ""}<div class="jp-dts">${rows}</div>`);
    }
    for (const id of st.pick ?? []) {
      const t = tables.get(id)!;
      const rows = t.rows
        .map((r) => {
          const name = labKey(ws.id, "pick", t.id, r.id);
          items.push({ label: r.label, name, type: "check", group: t.title });
          const f = forcedBy(t.id, r.id);
          return `<label class="jp-card jp-dt jp-pick"><span><input type="checkbox" name="${e(name)}" data-jv-check> <b>${e(r.label)}</b></span>${r.question || r.what ? `<p>${e(r.question ?? r.what!)}</p>` : ""}${r.example ? `<small>e.g. ${e(r.example)}</small>` : ""}${f.length ? `<div class="jp-dq-rev"><span>Forced by:</span>${f.map((s) => stepChip(a, s, s.step.id)).join("")}</div>` : ""}</label>`;
        })
        .join("");
      out.push(`<h4 class="jp-lab-sub">${e(t.title)}${t.module ? ` ${mod(t.module)}` : ""}</h4>${t.description ? `<p class="jp-small">${e(t.description)}</p>` : ""}<div class="jp-dts">${rows}</div>`);
    }
    if (st.capabilities && scales.length) {
      const rows = p.steps
        .filter((s) => s.ws?.capabilities?.length)
        .map((s) => `<div class="jp-lab-cmom"><div class="jp-lab-cmom-h">${stepChip(a, s, s.step.id, true)}</div>${s.ws!.capabilities!.map((c) => (items.push({ label: `${s.step.id} · ${c.label}`, name: `${ws.id}:${c.id}:${scales[0]!.id}`, type: "choice", options: scales[0]!.options, group: s.step.id }), c)).map((c) => `<div class="jp-cap"><div class="jp-cap-label">${e(c.label)}</div>${scales.map((sc, si) => radios(`${ws.id}:${c.id}:${sc.id}`, sc.options, `${c.label}: ${sc.label}`, si > 0)).join("")}</div>`).join("")}</div>`)
        .join("");
      out.push(`<div class="jp-gap jp-lab-caps">${rows}${ws.assessment?.standingLine ? `<p class="jp-standing">${e(ws.assessment.standingLine)}</p>` : ""}<p class="jp-small">The same ratings as each moment’s gap strip in the walkthrough. The gap report is in the summary.</p></div>`);
    }
    if (st.canvas?.length && ws.canvas) {
      for (const g of canvasSummaryItems(ws.id, ws.canvas, scales[0]?.options)) if (st.canvas.includes(g.sheet.id)) items.push(...g.items);
      const qs = journeyQuestions(p);
      for (const sh of ws.canvas.sheets.filter((x) => st.canvas!.includes(x.id))) for (const q of qs.filter((x) => x.canvas === undefined && (sh.modules ?? []).includes(x.module))) items.push({ label: `${q.step} · ${q.text}`, name: q.key, type: "text" });
      out.push(canvasPdf(p, st.id === lab.steps.find((x) => x.canvas?.length)?.id), canvasForm(p, a, st.canvas));
    }
    if (st.matrix) out.push(matrixHtml(corpus, p, a, mod));
    for (const m of st.modules ?? []) {
      const module = ws.modules.find((x) => x.id === m);
      const qs = p.steps.flatMap((s) => (s.ws?.questions ?? []).map((q, i) => ({ s, q, i })).filter((x) => x.q.module === m));
      if (!module || qs.length === 0) continue;
      for (const { s, q } of qs) items.push({ label: `${s.step.id} · ${q.text}`, name: questionKey(ws.id, s.ws!, q), type: "text" });
      out.push(`<div class="jp-card jp-dm"><div class="jp-dm-h">${mod(m)}<b>${e(module.title)}</b></div>${module.carries ? `<p class="jp-dm-c">${e(module.carries)}</p>` : ""}<ul class="jp-lab-qs">${qs.map(({ s, q, i }) => `<li>${stepChip(a, s, s.step.id)}<div><span>${e(q.text)}</span>${answerBox(questionKey(ws.id, s.ws!, q), q.text, 2, "", earlierKeys(ws.id, s.ws!, q, legacyQuestionKey(ws.id, s, i)))}</div></li>`).join("")}</ul></div>`);
    }
    if (st.discussion && ws.discussion?.length) {
      const cards = ws.discussion
        .map((d, i) => {
          const name = labKey(ws.id, "dq", d.id);
          items.push({ label: d.theme, name, type: "text" });
          return `<div class="jp-card jp-dq"><div class="jp-dq-h"><span class="jp-dq-n">${i + 1}</span><b>${e(d.theme)}</b>${mod(d.module)}</div><p>${e(d.question)}</p>${d.steps?.length ? `<div class="jp-dq-rev"><span>Revisit:</span>${d.steps.map((r) => stepChip(a, stepByRef(corpus, p, r), r, true)).join("")}</div>` : ""}${answerBox(name, d.question, 2)}</div>`;
        })
        .join("");
      out.push(`<div class="jp-dqs">${cards}</div>`);
    }
    if (st.resources?.length) {
      // A facilitator's job aid is the presenter's (owner, 2026-11-17).
      const rs = st.resources.map((id) => ws.resources!.find((r) => r.id === id)!).map((r) => {
        const link = r.href ? ext(fromSite(r.href, a.siteRoot), r.title) : `<span>${e(r.title)}</span>`;
        return r.kind === "job-aid" ? `<span class="jp-presenter-only">${link}</span>` : link;
      });
      out.push(`<p class="jp-lab-res">${icon("book")} ${rs.join(" ")}</p>`);
    }
    return out.join("\n");
  };

  // An answer shown in two steps (a module's questions in its own step and in the matrix step) is one answer: the summary lists it once, under the first.
  const listed = new Set<string>();
  const steps = lab.steps.map((st, n) => {
    const all: LabSummaryItem[] = [];
    const body = part(st, all);
    const items = all.filter((x) => !listed.has(x.name) && (listed.add(x.name), true));
    if (items.length) summary.push({ id: st.id, n, label: st.label, items });
    return { st, n, body };
  });
  // The application components the room marked as its own (How it works), in the summary too.
  const systems = markableElements(p, links);
  if (systems.length && lab.steps.some((x) => x.summary)) {
    summary.push({
      id: "systems",
      n: lab.steps.length,
      label: "Our systems",
      items: systems.flatMap((x) => [
        { label: `${x.name}: we have this`, name: elementKey(ws.id, x, "have"), type: "check" as const, group: "Our systems" },
        { label: `${x.name}: our name for it`, name: elementKey(ws.id, x, "name"), type: "text" as const },
      ]),
    });
  }
  const takeaways = p.steps.filter((s) => s.step.policy);
  const summaryBody = `${canvasPdf(p, !lab.steps.some((x) => x.canvas?.length))}<div class="jp-lab-sum-act jp-noprint"><button type="button" class="jp-btn-line" data-jp-lab-print>${icon("printer")} Print / Save as PDF</button><button type="button" class="jp-btn-line" data-jp-lab-csv>${icon("file")} Download CSV</button></div>
<p class="jp-small">Assembled from every step, <b>in this browser only</b>: nothing is sent anywhere.</p>
<script type="application/json" data-jp-lab-model>${jsonInHtml(summary)}</script>
<div class="jp-lab-sum" data-jp-lab-summary></div>
${model ? `<section class="jp-card jp-pad jp-gapreport" data-jp-gapreport><div class="jp-row"><h3 class="jp-h">${icon("clipboard", "jp-rose")} Gap report</h3><span class="jp-gap-act jp-noprint"><span class="jp-small"><b data-jp-gap-count>0</b> of ${model.items.length} capabilities marked as gaps</span><button type="button" class="jp-btn-line" data-jp-report-print>${icon("printer")} Print gap report</button><button type="button" class="jp-btn-line" data-jp-report-csv>${icon("file")} Gap report CSV</button><button type="button" class="jp-btn-line" data-jp-gap-clear>Clear</button></span></div><p class="jp-small">${e(ws.assessment?.standingLine ?? "")}</p>
<script type="application/json" data-jp-gapreport-model>${jsonInHtml(model)}</script>
<div data-jp-gapreport-body></div><p class="jp-small jp-gap-none" data-jp-gap-none>Nothing marked ${e(scales[0]!.options.slice(1).map((o) => o.label.toLowerCase()).join(" or "))} yet.</p></section>` : ""}
${takeaways.length ? `<section class="jp-card jp-pad"><h3 class="jp-h">${icon("landmark", "jp-indigo")} Every moment’s policy takeaway</h3><ul class="jp-takes">${takeaways.map((s) => `<li>${stepChip(a, s, s.step.id)}<div><b>${e(s.step.title)}</b><p>${e(s.step.policy!)}</p></div></li>`).join("")}</ul></section>` : ""}`;

  const tabs = steps.map(({ st, n }) => `<a class="jp-lab-tab" href="#lab-${e(st.id)}" data-jp-lab-tab="${e(st.id)}"><span>${n}</span>${e(st.label)}</a>`).join("");
  const sections = steps
    .map(({ st, n, body }) => {
      const next = steps[n + 1];
      return `<section class="jp-card jp-lab-step${st.summary ? " jp-lab-summary" : ""}" id="lab-${e(st.id)}" data-jp-lab-step="${e(st.id)}">
<div class="jp-lab-head"><div><span class="jp-lab-kick">${n}. ${e(st.label)}</span><h3>${e(st.title)}</h3>${st.lede ? `<p class="jp-lab-lede">${e(st.lede)}</p>` : ""}</div>${st.minutes ? `<button type="button" class="jp-lab-timer jp-noprint jp-presenter-only" data-jp-timer="${st.minutes}">${icon("clock")} <span>Start ${st.minutes} min timer</span></button>` : ""}</div>
${st.discuss ? `<div class="jp-lab-discuss jp-presenter-only"><b>Discuss</b><span>${e(st.discuss)}</span></div>` : ""}
${body}
${st.summary ? `${summaryBody}\n${sheetsPanel(corpus, p)}` : ""}
${st.note ? `<p class="jp-lab-note jp-presenter-only">${e(st.note)}</p>` : ""}
${next ? `<div class="jp-lab-nav jp-noprint"><a class="jp-btn-dark" href="#lab-${e(next.st.id)}" data-jp-lab-go="${e(next.st.id)}">${e(next.st.label)} ${icon("right")}</a></div>` : ""}
</section>`;
    })
    .join("\n");
  const aside = `<aside class="jp-card jp-lab-aside"><h4>Our use case</h4><p data-jp-usecase-show>${e(useCaseText.split("\n")[0] ?? "")}</p><div class="jp-lab-aside-ucs" data-jp-usecase-ticks></div>${ws.promise ? `<p class="jp-small"><b>The scope promise.</b> ${e(ws.promise)}</p>` : ""}</aside>`;
  const credit = lab.credit ? `<p class="jp-lab-credit">${lab.creditHref ? `${e(lab.credit)} ${ext(lab.creditHref, lab.creditLabel ?? lab.name ?? "Source")}` : e(lab.credit)}</p>` : "";
  const body = `<section class="jp-dhero"><span class="jp-kicker">${icon("message")} ${e(lab.name ?? "Questions for the room")}</span><h2>${e(pr.closingQuestion ?? "Closing discussion")}</h2>${lab.intro ? `<p>${e(lab.intro)}</p>` : ""}</section>
<nav class="jp-lab-tabs" aria-label="Steps">${tabs}</nav>
<div class="jp-lab" data-jp-lab="${e(ws.id)}"><div class="jp-lab-steps">${sections}</div>${aside}</div>
${lab.steps.some((st) => st.summary) ? "" : sheetsPanel(corpus, p)}
${credit}`;
  return frame({ p, root: a.root, toWorkshop: a.toWorkshop, view: "discuss", title: `Discussion — ${presentationName(p)}`, ...note(p, "discuss"), ...discussHead(p, a, Boolean(model)), prev: `${a.toWorkshop}walkthrough/${p.steps[p.steps.length - 1]!.key}/`, body, foot: drawerOf(corpus, p, a, p.steps, "Discussion") });
}

// ── the module × journey matrix (JV-05) ───────────────────────────────────

/** One cell of the matrix: whether the module's question is asked at the step, or the module only draws on it, and the workshop's words for it. */
export interface MatrixCellView {
  module: string;
  step: PresentedStep;
  kind: "asked" | "draws";
  questions: string[];
  technical?: string;
  policy?: string;
}

/**
 * The matrix's cells, modules in the workshop's order and steps in the
 * walkthrough's: `asked` wherever a step's questions name the module (from
 * `steps[].questions`), `draws` wherever `workshop.matrix` says the module
 * reads the step without asking; each with the cell's text, if any.
 */
export function matrixCells(corpus: JourneyCorpus, p: Presentation): MatrixCellView[] {
  const ws = p.w.workshop;
  const text = new Map<string, { kind?: "draws"; technical?: string; policy?: string }>();
  for (const c of ws.matrix?.cells ?? []) {
    const s = stepByRef(corpus, p, c.step);
    if (s) text.set(`${c.module} ${s.key}`, c);
  }
  const out: MatrixCellView[] = [];
  for (const m of ws.modules) {
    for (const s of p.steps) {
      if (!s.ws) continue;
      const questions = (s.ws.questions ?? []).filter((q) => q.module === m.id).map((q) => q.text);
      const t = text.get(`${m.id} ${s.key}`);
      if (questions.length === 0 && t?.kind !== "draws") continue;
      out.push({ module: m.id, step: s, kind: questions.length ? "asked" : "draws", questions, ...(t?.technical ? { technical: t.technical } : {}), ...(t?.policy ? { policy: t.policy } : {}) });
    }
  }
  return out;
}

/**
 * The module × journey matrix: a row per module that meets any step, a
 * column per step the workshop has, ● where the module's question is asked
 * and ○ where it only draws on the step. Each cell links to its step in the
 * walkthrough and shows its technical and policy text on hover or focus;
 * the same text, cell by cell, is under the matrix to expand (and print),
 * then the overlaps across modules.
 */
function matrixHtml(corpus: JourneyCorpus, p: Presentation, a: At, mod: (id: string) => string): string {
  const ws = p.w.workshop;
  const cells = matrixCells(corpus, p);
  const cols = p.steps.filter((s) => s.ws);
  const rows = ws.modules.filter((m) => cells.some((c) => c.module === m.id));
  const at = new Map(cells.map((c) => [`${c.module} ${c.step.key}`, c]));
  const words = (c: MatrixCellView) =>
    `${c.questions.length ? `<p class="jp-mx-q">${c.questions.map((q) => e(q)).join("<br>")}</p>` : ""}${c.technical ? `<p><b>Technical.</b> ${e(c.technical)}</p>` : ""}${c.policy ? `<p><b>Policy.</b> ${e(c.policy)}</p>` : ""}`;
  const label = (c: MatrixCellView) => `${c.module} × ${c.step.step.id}: ${c.kind === "asked" ? "the module’s question is asked here" : "the module draws on this step"}`;
  const head = `<tr><th scope="col" class="jp-mx-corner">Module</th>${cols.map((s) => `<th scope="col"><a href="${e(walkHref(a, s))}" title="${e(s.step.title)}">${e(s.step.id)}</a></th>`).join("")}</tr>`;
  const body = rows
    .map((m) => `<tr><th scope="row">${mod(m.id)} <span>${e(m.title)}</span></th>${cols
      .map((s) => {
        const c = at.get(`${m.id} ${s.key}`);
        if (!c) return `<td class="jp-mx-none"></td>`;
        const w = words(c);
        return `<td class="jp-mx-${c.kind}"><a class="jp-mx-cell" href="${e(walkHref(a, s))}" aria-label="${e(label(c))}"><span aria-hidden="true">${c.kind === "asked" ? "●" : "○"}</span></a>${w ? `<div class="jp-mx-pop" role="tooltip"><b>${e(c.module)} × ${e(c.step.step.id)}</b> <small>${e(c.step.step.title)}</small>${w}</div>` : ""}</td>`;
      })
      .join("")}</tr>`)
    .join("");
  const detail = rows
    .map((m) => {
      const mine = cells.filter((c) => c.module === m.id && (c.technical || c.policy));
      return mine.length ? `<div class="jp-mx-mod"><h4>${mod(m.id)} ${e(m.title)}</h4><ul>${mine.map((c) => `<li class="jp-mx-${c.kind}">${stepChip(a, c.step, c.step.step.id)}<span class="jp-mx-k">${c.kind === "asked" ? "● asked" : "○ draws"}</span><div>${c.technical ? `<p><b>Technical.</b> ${e(c.technical)}</p>` : ""}${c.policy ? `<p><b>Policy.</b> ${e(c.policy)}</p>` : ""}</div></li>`).join("")}</ul></div>` : "";
    })
    .join("");
  const ov = ws.matrix?.overlaps;
  const overlapList = (title: string, list: NonNullable<NonNullable<typeof ov>["technical"]> | undefined) =>
    list?.length
      ? `<div class="jp-mx-ov"><h4>${e(title)}</h4>${list.map((o) => `<div class="jp-card jp-dt"><b>${e(o.label)}</b><p>${e(o.text)}</p><div class="jp-dq-rev"><span>Modules:</span>${o.modules.map((x) => mod(x)).join("")}</div><div class="jp-dq-rev"><span>Steps:</span>${o.steps.map((r) => stepChip(a, stepByRef(corpus, p, r), r)).join("")}</div></div>`).join("")}</div>`
      : "";
  const overlaps = overlapList("Technical overlaps", ov?.technical) + overlapList("Policy overlaps", ov?.policy);
  return `<div class="jp-mx">${ws.matrix?.intro ? `<p class="jp-small">${e(ws.matrix.intro)}</p>` : ""}<div class="jp-mx-scroll"><table class="jp-mx-tbl"><thead>${head}</thead><tbody>${body}</tbody></table></div>
<p class="jp-small jp-mx-key"><span>● the module’s question is asked at this step</span>${cells.some((c) => c.kind === "draws") ? `<span>○ the module draws on this step without asking there</span>` : ""}<span>Each cell opens its step${detail ? "; hover or focus it for the technical and policy text" : ""}.</span></p>
${detail ? `<details class="jp-mx-detail"><summary>Every meeting point, technical and policy</summary>${detail}</details>` : ""}
${overlaps ? `<div class="jp-mx-ovs">${overlaps}</div>` : ""}</div>`;
}

// ── the gap report ───────────────────────────────────────────────────────

/** A scale of the workshop's assessment, as the report reads it. */
export interface GapScale {
  id: string;
  label: string;
  options: { id: string; label: string }[];
}

/** What the discussion page hands `assets/gap-report.js`: every capability the walkthrough rates, and where its answers are stored. */
export interface GapReportModel {
  status: GapScale;
  urgency?: GapScale;
  modules: { id: string; title: string }[];
  items: { name: { status: string; urgency?: string }; capability: { id: string; label: string }; step: { id: string; title: string; href: string }; module?: string }[];
}

/**
 * The gap report's model, or undefined when the workshop rates nothing. The
 * first scale is where a capability stands, the second (if any) how urgent a
 * gap is; each capability is filed under the first module its moment's
 * questions name. The storage names are the gap strip's own
 * (`<workshop>:<capability>:<scale>`), so the report reads what the strip wrote.
 */
export function gapReportModel(p: Presentation, href: (s: PresentedStep) => string): GapReportModel | undefined {
  const ws = p.w.workshop;
  const scales = ws.assessment?.scales ?? [];
  const items = p.steps.flatMap((s) =>
    (s.ws?.capabilities ?? []).map((c) => {
      const module = s.ws?.questions?.[0]?.module;
      return {
        name: { status: `${ws.id}:${c.id}:${scales[0]?.id}`, ...(scales[1] ? { urgency: `${ws.id}:${c.id}:${scales[1].id}` } : {}) },
        capability: { id: c.id, label: c.label },
        step: { id: s.step.id, title: s.step.title, href: href(s) },
        ...(module ? { module } : {}),
      };
    }),
  );
  if (items.length === 0 || scales.length === 0) return undefined;
  return { status: scales[0]!, ...(scales[1] ? { urgency: scales[1] } : {}), modules: ws.modules.map((m) => ({ id: m.id, title: m.title })), items };
}

/** JSON safe inside a `<script>` element: no `</script>` or `<!--` can end it early. */
const jsonInHtml = (v: unknown): string => JSON.stringify(v).replace(/</g, "\\u003c");

// ── the table sheets, folded into the discussion ─────────────────────────

/** The id of the Table sheets panel on the discussion page; `sheets/` redirects to it. */
export const SHEETS_PANEL = "sheets";

/** Whether a workshop has sheets to print: drawn ones, or its own canvas. */
export const hasSheets = (p: Presentation): boolean => Boolean(p.w.workshop.sheets?.length || p.w.workshop.sheetsSource);

/**
 * The Table sheets as an expanding panel (owner, 2026-11-17: fold them into the
 * discussion): folded, at the foot of the lab's summary step, or of the
 * discussion when the workshop has no lab. The workshop's own canvas when it
 * names one, the drawn sheets otherwise; its print button prints the sheets alone.
 */
function sheetsPanel(corpus: JourneyCorpus, p: Presentation): string {
  if (!hasSheets(p)) return "";
  const ws = p.w.workshop;
  const canvas = canvasOf(corpus, p.w);
  const sizes = [...new Set((ws.sheets ?? []).map((s) => s.size))].join(" and ");
  const label = canvas ? canvas.title : "Table sheets";
  const hint = canvas ? `Print the ${canvas.size} canvas, or download it` : `Print the ${sizes} sheets`;
  const body = canvas
    ? `<section class="jp-sheets-h jp-noprint"><div><h2>${e(canvas.title)}</h2><p class="jp-small">${canvas.description ? e(canvas.description) : `${canvas.previews.length ? `${canvas.previews.length} page${canvas.previews.length === 1 ? "" : "s"}, ` : ""}${e(canvas.size)} landscape. Print at 100% with background graphics on, or download the file to fill in on screen.`}</p></div><span class="jp-sheets-act">${canvasDownloads(canvas, "jp-btn-line", { file: icon("file") })}${canvas.previews.length ? `<button type="button" class="jp-btn-dark" data-jp-sheets-print>${icon("printer")} Print the canvas</button>` : ""}</span></section>
${canvasHtml(canvas)}`
    : `<section class="jp-sheets-h jp-noprint"><div><h2>Table canvas: ${e(sizes)} sheets</h2><p class="jp-small">A cover and ${(ws.sheets ?? []).length} sheet${(ws.sheets ?? []).length === 1 ? "" : "s"}, each with this journey’s questions for its module${(ws.sheets ?? []).some((s) => s.assessmentStrip) ? " and the gap strip at its foot" : ""}. Print on ${e(sizes)}, landscape, at 100% with background graphics on.</p></div><button type="button" class="jp-btn-dark" data-jp-sheets-print>${icon("printer")} Print the sheets</button></section>
<div class="jp-sheetlist">${sheetsHtml(corpus, p.w)}</div>`;
  return `<details class="jp-card jp-sheets-panel" id="${SHEETS_PANEL}" data-jp-sheets><summary class="jp-sheets-sum jp-noprint">${icon("printer", "jp-indigo")}<span><b>${e(label)}</b><small>${e(hint)}</small></span><span class="jp-sheets-chev" aria-hidden="true">${icon("right")}</span></summary>
<div class="jp-sheets-in">${body}</div></details>`;
}

/**
 * Where `sheets/` was: a redirect to the panel on the discussion page, keeping
 * an old address's own anchor (`sheets/#sheet-s1` opens that sheet there).
 */
export function sheetsRedirect(): string {
  const to = `../discuss/#${SHEETS_PANEL}`;
  return withRenderedBy(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Table sheets: now in the discussion</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${to}">
<script>location.replace("../discuss/" + location.search + (location.hash || "#${SHEETS_PANEL}"));</script>
<meta http-equiv="refresh" content="0; url=${to}">
</head><body><p>The Table sheets are in the <a href="${to}">discussion</a>.</p></body></html>
`, TOOL_ID);
}

// ── the device demo ──────────────────────────────────────────────────────

/**
 * The device demo's journey stages (JV-15): a pill per screen, labelled by
 * the steps it shows and its title, the current one filled; it sits in the
 * page's header band, above the presenter's note.
 */
function stageBar(p: Presentation, current: string | undefined): string {
  const toDemo = current ? "../" : "";
  return `<nav class="jp-stagebar" aria-label="Journey stage"><span class="jp-stagebar-l">Journey stage:</span>${p.screens
    .map(
      (x) =>
        `<a class="jp-stage-pill${x.id === current ? " is-on" : ""}" href="${e(`${toDemo}${x.id}/`)}" title="${e(`${x.id}: ${x.title}`)}"${x.id === current ? ' aria-current="page"' : ""}><code>${e([...x.steps.map((s) => s.step.id), ...x.unresolved].join(", ") || x.id)}</code> ${e(x.title)}</a>`,
    )
    .join(`<span class="jp-stage-sep" aria-hidden="true">›</span>`)}</nav>`;
}

/** Whose device a drawn screen is: the cast's view of its owner, else the owner's own persona. */
function ownerOf(corpus: JourneyCorpus, p: Presentation, x: DemoScreen): PersonaView | undefined {
  const node = x.node;
  if (node === undefined) return undefined;
  return p.cast.find((c) => c.id === node.screen.owner) ?? (lookup(corpus.actors, node.instance, node.screen.owner) ? personaOf(corpus, node.instance, node.screen.owner, p.cast.length) : undefined);
}

/** What drawing a screen needs: people (the cast's colours first), example pages and JSON. */
function screenContext(corpus: JourneyCorpus, p: Presentation, instance: string, siteRoot: string): ScreenContext {
  const extra: PersonaView[] = [];
  return {
    person: (id) => {
      const known = p.cast.find((c) => c.id === id) ?? extra.find((c) => c.id === id);
      if (known) return known;
      if (lookup(corpus.actors, instance, id) === undefined) return undefined;
      const pv = personaOf(corpus, instance, id, p.cast.length + extra.length);
      extra.push(pv);
      return pv;
    },
    exampleHref: (key) => examplePage(corpus, p.w.workshop.presentation ?? {}, key, siteRoot),
    exampleJson: (key) => corpus.examples.get(key)?.json,
    // The demo page's drawer carries a tab for every example with JSON.
    inspectable: (key) => corpus.examples.get(key)?.json !== undefined,
  };
}

function demoIndex(corpus: JourneyCorpus, p: Presentation, links: SiteLinks): string {
  const a = at(1, links);
  const pr = p.w.workshop.presentation ?? {};
  const label = demoLabel(p);
  const cards = p.screens
    .map((x) => {
      const who = ownerOf(corpus, p, x);
      const steps = [...x.steps.map((s) => `${s.step.id} ${s.step.title}`), ...x.unresolved];
      return `<a class="jp-card jp-screen" href="${e(`${x.id}/`)}"><span class="jp-screen-i">${deviceGlyph(x, "jp-i-lg")}</span><span><b class="jp-mono">${e(x.id)}</b> ${e(x.title)}</span>${who ? `<span class="jp-screen-who">${avatar(who, "sm")}<small>${e(who.name)} · ${e(DEVICE_LABEL[x.device])}</small></span>` : ""}<small>${steps.map((t) => e(t)).join(" · ")}</small>${x.try ? `<small class="jp-try">${e(x.try)}</small>` : ""}</a>`;
    })
    .join("");
  const lede =
    p.demo === "screens"
      ? `One screen per moment: what each person sees on their own device. A screen opens with the moments it shows, and each moment links back to it.`
      : `One screen per moment, in the instance’s own app. A screen opens framed here, with the moments it shows; ${ext(fromSite(pr.deviceDemo!.href, a.siteRoot), "open the app")} to use it on its own.`;
  const body = `<section class="jp-vhead"><h2>${e(label)}: what each person sees</h2><p>${lede}</p></section>
<div class="jp-screens">${cards}</div>`;
  return frame({ p, root: a.root, toWorkshop: a.toWorkshop, view: "demo", title: `${label} — ${presentationName(p)}`, ...note(p, "demo"), body, foot: drawerOf(corpus, p, a, p.screens.flatMap((x) => x.steps), label) });
}

function demoPage(corpus: JourneyCorpus, p: Presentation, links: SiteLinks, i: number): string {
  const a = at(2, links);
  const pr = p.w.workshop.presentation ?? {};
  const x = p.screens[i]!;
  // JV-16: VaxLink's compact header; the title and description move to the note and the Moments card.
  const first = x.steps[0];
  const back = first ? `<a class="jp-back" href="${e(walkHref(a, first))}">${icon("left")} Back to the user journey</a>` : "";
  const who = ownerOf(corpus, p, x);
  const role = who?.role?.split(" · ")[0];
  const looking = who ? `<span class="jp-looking">You are looking at what ${e(who.name)}${role ? ` (${e(role)})` : ""} sees at this moment.</span>` : "";
  const prev = p.screens[i - 1];
  const next = p.screens[i + 1];
  let device: string;
  let open = "";
  if (x.node) {
    device = `${stateSwitch(x.node.screen)}<div class="ds-stage" data-jp-stage>${renderDevice(x.node.screen, screenContext(corpus, p, x.node.instance, a.siteRoot), { caption: false })}</div>`;
    const src = sourceHref(corpus, x.node.instance, x.node.file);
    if (src) open = ext(src, "Screen source", "jp-devline-src");
  } else {
    const src = screenHref(pr, x.id, a.siteRoot)!;
    device = `<div class="jp-device-wrap"><iframe class="jp-device jp-device-${x.device}" src="${e(src)}" title="${e(`${x.id}: ${x.title}`)}" loading="lazy"></iframe></div>`;
    open = ext(src, "Open in a new tab", "jp-devline-src");
  }
  const desc = x.node?.screen.description;
  const config = x.node?.screen.client?.config;
  const moments = `<section class="jp-card ds-moments"><div class="ds-moments-h"><span class="jp-small"><b class="jp-mono">${e(x.id)}</b> · ${e(DEVICE_LABEL[x.device])}</span><h3>${e(x.title)}</h3>${desc ? `<p>${e(desc)}</p>` : ""}${x.try ? `<p class="jp-try">${icon("sparkles", "jp-amber")} ${e(x.try)}</p>` : ""}</div>${
    x.steps.length || x.unresolved.length
      ? `<h4 class="jp-h">${icon("route")} Moments this screen shows</h4><ul>${x.steps.map((s) => `<li><a href="${e(walkHref(a, s))}"><b class="jp-mono">${e(s.step.id)}</b> ${e(s.step.title)}</a>${s.step.headline ? `<p>${personaText(s.step.headline, p.cast)}</p>` : ""}</li>`).join("")}${x.unresolved.map((r) => `<li class="jp-unresolved" title="no such step in this walkthrough">${e(r)}</li>`).join("")}</ul>`
      : ""
  }</section>`;
  const body = `<section class="jp-screen-h"><div class="jp-screen-row">${back}${looking}</div>
<div class="jp-devline"><span>${deviceGlyph(x)} ${e(DEVICE_FORM[x.device])}${config ? ` <code>(${e(config)})</code>` : ""}</span><span class="jp-devline-r">${open}${x.node ? `<button type="button" class="jp-expand" data-jp-frame aria-pressed="true" hidden>${icon("phone")} Frame</button>` : ""}<button type="button" class="jp-expand" data-jp-expand>${icon("expand")} Expand</button></span></div></section>
${device}
${moments}`;
  const stage = [...x.steps.map((s) => s.step.id), ...x.unresolved].join(", ") || x.id;
  return frame({
    p,
    root: a.root,
    toWorkshop: a.toWorkshop,
    view: "demo",
    title: `${x.id} ${x.title} — ${presentationName(p)}`,
    // VaxLink's note: the stage, its title, and what the screen is about.
    note: `Stage ${stage} (${x.title})${desc ? ` — ${desc}` : x.try ? ` — ${x.try}` : ""}`,
    band: stageBar(p, x.id),
    ...(prev ? { prev: `../${prev.id}/` } : {}),
    ...(next ? { next: `../${next.id}/` } : {}),
    body,
    // The screen's own payloads first, so the drawer opens on what it shows.
    foot: viewDrawer(corpus, p, [...(x.node ? screenExamples(x.node.screen) : []), ...stepsExampleKeys(x.steps)], a.toWorkshop, a.siteRoot, "on this screen", [x.id, ...x.steps.map((s) => s.step.id)].join(" · ")),
  });
}

// ── all of them ──────────────────────────────────────────────────────────

/** The views' pages for one workshop, paths relative to its directory. */
export function renderViewPages(corpus: JourneyCorpus, p: Presentation, links: SiteLinks): PageFile[] {
  const out: PageFile[] = [];
  // The journey map is folded into How it works (owner, 2026-11-17); its address redirects there.
  if (p.steps.length) out.push({ path: "map/index.html", content: mapRedirect() });
  if (p.cast.length) {
    out.push({ path: "personas/index.html", content: personaPage(corpus, p, links, p.cast[0]!, 1) });
    for (const x of p.cast) out.push({ path: `personas/${x.id}/index.html`, content: personaPage(corpus, p, links, x, 2) });
  }
  out.push({ path: "how/index.html", content: howPage(corpus, p, links, undefined) });
  const cat = catalogueOf(corpus, p);
  for (const b of cat?.blocks.keys() ?? []) out.push({ path: `how/${b}/index.html`, content: howPage(corpus, p, links, b) });
  out.push({ path: "discuss/index.html", content: discussPage(corpus, p, links) });
  if (hasSheets(p)) {
    // The sheets are a panel of the discussion (owner, 2026-11-17); the old address redirects to it.
    for (const f of canvasFiles(canvasOf(corpus, p.w))) out.push({ path: `discuss/${f.path}`, content: f.content });
    out.push({ path: "sheets/index.html", content: sheetsRedirect() });
  }
  if (p.screens.length) {
    out.push({ path: "demo/index.html", content: demoIndex(corpus, p, links) });
    p.screens.forEach((x, i) => out.push({ path: `demo/${x.id}/index.html`, content: demoPage(corpus, p, links, i) }));
  }
  return out;
}

