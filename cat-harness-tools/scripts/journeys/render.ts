/**
 * Draw the journeys viewer's pages: an index of every journey in the
 * checkout, one page per journey (a journey map with a swimlane and feeling
 * curve per persona, then the steps one at a time with their BPMN, stories,
 * requirements, examples and building blocks), and the workshop layer
 * (a page per workshop and per module, and the printable sheets).
 *
 * @module scripts/journeys/render
 * @covers user-scenario, workshop
 *
 * Pure: a {@link JourneyCorpus} in, `{ path, content }` files out, paths
 * relative to the visualiser's route. Deterministic, so a re-run writes the
 * same bytes. Every page is complete without JavaScript; the one small,
 * dependency-free script (`journeys.js`) only adds the stepper, the filter,
 * and remembering a table's assessment ticks in the browser.
 *
 * ## Routes, under `<locale>/<harness>/<visualiser>/`
 *
 * | path | page |
 * |---|---|
 * | `index.html` | every journey in the checkout, by layer, then by `partOf`, ordered along `follows`; every workshop |
 * | `<instance>/index.html` | the same for one layer: the sub-graph page |
 * | `<instance>/<journey id>/index.html` | one journey |
 * | `<instance>/workshops/<workshop id>/index.html` | one workshop |
 * | `<instance>/workshops/<workshop id>/<module>/index.html` | one module |
 * | `<instance>/workshops/<workshop id>/sheets/index.html` | the printable sheets |
 * | `<instance>/workshops/<workshop id>/overview/`, `…/walkthrough/<step>/` | the workshop told in a room, with no site chrome (`present.ts`) |
 * | `assets/journeys.css`, `assets/journeys.js` | the style and the script |
 * | `assets/calendar.css` | a workshop's days as a calendar (`schedule.ts`), on its page and its overview |
 * | `assets/present.css`, `assets/present.js` | the presentation pages' style and script |
 */
import { readFileSync } from "node:fs";
import { basename, extname, join, posix, relative, resolve } from "node:path";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

import { escHtml, DEFAULT_ICON } from "../thin-page.ts";
import { NAVBAR_LINKED } from "../lib/harness-rail.ts";
import { PANEL_CLIENT, PANEL_CSS, PANEL_SCRIPT } from "../lib/task-panel.ts";
import { withRenderedBy } from "../viewer-declarations.ts";
import type { Part, ScenarioStep } from "../../schemas/process/user-scenario.ts";
import { parentsOf, partsOf } from "./derive.ts";
import type { Workshop, WorkshopStep } from "../../schemas/process/workshop.ts";
import {
  blockFor,
  avatarFile,
  fromSite,
  instanceFile,
  journeyById,
  lookup,
  requirementFor,
  siteRootFrom,
  type Actor,
  type Journey,
  type JourneyCorpus,
  type WorkshopEntry,
} from "./read.ts";
import { igProcessPage, PRESENT_SEGMENTS, presentationOf, renderPresentationPages } from "./present.ts";
import { PRESENT_ASSETS } from "./present-assets.ts";
import { scheduleFor, scheduleHtml, scheduleTitle } from "./schedule.ts";
import { artifactPage, DAK_ATTR, dakGroups, igOf, linkedProcessDrawing, personaArtifact, type StepPageLinks } from "./dak-links.ts";
import { imageSize, type ImageSize } from "./image-size.ts";

export const TOOL_ID = "journeys-viewer";
const ASSET_DIR = join(import.meta.dir, "assets");
export const ASSETS = ["journeys.css", "journeys.js", "calendar.css", ...PRESENT_ASSETS] as const;

export interface PageFile {
  path: string;
  /** A page or an asset as text; an illustration copied from its layer as bytes. */
  content: string | Uint8Array;
}

/** An ArchiMate element's page, site-relative, with what to call it. */
export interface ArchimateElementLink {
  name: string;
  /** Its ArchiMate type, in words ("Application Component"). */
  type: string;
  page: string;
}

/** An ArchiMate view, drawn and paged, site-relative. */
export interface ArchimateViewLink {
  svg: string;
  page: string;
  name: string;
  /** The elements its boxes show, once each, in drawing order. */
  elements?: ArchimateElementLink[];
}

/** Where things are in the site, for links that leave the viewer. */
/** One system part in the architecture panel: its reference block names its kind and row. */
export interface ArchitectureBox extends ArchimateElementLink {
  /** The reference block its country's instance specializes (the box's small-capitals kind). */
  block: ArchimateElementLink;
  /** An `ig` property on the part: its page in the implementation guide. */
  ig?: string;
  /** BPMN files (layer-relative) of the processes its system serves, from their `bpmn` property. */
  bpmn: string[];
}
/** The architecture panel's model, read from the ArchiMate graph (JV-13). */
export interface ArchitecturePanel {
  countries: ArchimateElementLink[];
  /** One per child grouping of the root, in the model's order; `cells` one list of boxes per country. */
  rows: { layer: ArchimateElementLink; cells: ArchitectureBox[][]; blocks: ArchimateElementLink[] }[];
  shared?: { group: ArchimateElementLink; members: ArchimateElementLink[] };
}

export interface SiteLinks extends StepPageLinks {
  /** Site-relative route of the viewer, no trailing slash: `en/<harness>/<id>`. */
  route: string;
  /** Site-relative page of each process drawing's viewer, by layer; absent when no processes viewer is declared. */
  processesPage?: (instance: string) => string | undefined;
  /** Site-relative ⓘ panel sidecar of a BPMN file (instance-relative) the processes viewer draws; absent when no processes viewer is declared. */
  processPanel?: (instance: string, bpmn: string) => string | undefined;
  /** An ArchiMate view's drawing and page, and the elements it shows, site-relative; absent when it cannot be placed. */
  archimateView?: (instance: string, model: string, view: string) => ArchimateViewLink | undefined;
  /** The ArchiMate elements that deploy a building block (their `buildingBlocks` property names it), with their pages, site-relative. */
  archimateBlock?: (instance: string, block: string) => ArchimateElementLink[];
  /** The architecture panel a workshop's `presentation.architecture` declares, resolved; absent when the model or a ref cannot be. */
  archimateArchitecture?: (instance: string, spec: { model: string; root: string; countries: readonly { group: string }[]; shared?: string }) => ArchitecturePanel | undefined;
  /** Title of the site's declaring layer, for the index heading. */
  title: string;
}

// ── small helpers ─────────────────────────────────────────────────────────

const md = remark().use(remarkGfm).use(remarkHtml, { sanitize: true });

/** Markdown to HTML, sanitised: authored text never carries script. */
export function mdHtml(text: string): string {
  return String(md.processSync(text)).trim();
}

const e = escHtml;
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
/** An HTML id for a step: its code, kept readable (`step-J4.1`). */
export const stepAnchor = (id: string): string => `step-${id.replace(/[^A-Za-z0-9.-]/g, "-")}`;

const PALETTE = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed", "#0891b2", "#65a30d", "#dc2626"];
const FACES: Record<number, [string, string]> = {
  [-2]: ["😣", "distressed"],
  [-1]: ["😟", "worried"],
  [0]: ["😐", "neutral"],
  [1]: ["🙂", "reassured"],
  [2]: ["😄", "delighted"],
};

export interface PersonaView {
  id: string;
  name: string;
  role?: string;
  country?: string;
  initials: string;
  color: string;
  goal?: string;
  needs?: string[];
  frustrations?: string[];
  /** A glyph drawn in the avatar instead of the initials (`meta.persona.icon`). */
  icon?: string;
  /** The artefact-index key of the ActorDefinition it plays in the IG (`personaArtifact`), when the IG defines one. */
  artifact?: string;
  /** The persona's picture, copied beside the viewer: a path from the viewer's route root (`avatars/<instance>/<actor>.webp`). */
  avatar?: string;
}

/**
 * Where a page's route root is, in markup drawn before the page knows its
 * depth (an avatar's `src`): each page wrapper replaces it with its own path
 * to the root. Never reaches a written page.
 */
export const ROOT_MARK = "@@journeys-root@@/";

/** A persona's picture as the viewer copies it: `avatars/<instance>/<actor><ext>`, from the route root. */
export function avatarPath(corpus: JourneyCorpus, a: Actor): { from: string; to: string } | undefined {
  const from = avatarFile(corpus, a);
  return from === undefined ? undefined : { from, to: `avatars/${a.instance}/${a.id}${extname(from).toLowerCase()}` };
}

export function personaOf(corpus: JourneyCorpus, instance: string, id: string, i: number): PersonaView {
  const a: Actor | undefined = lookup(corpus.actors, instance, id);
  const p = a?.persona;
  const name = p?.name ?? a?.title ?? id;
  const initials =
    p?.initials ??
    name
      .split(/\s+/)
      .filter((w) => /^[A-Za-z]/.test(w))
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") ??
    id.slice(0, 2).toUpperCase();
  return {
    id,
    name,
    ...(p?.role ? { role: p.role } : {}),
    ...(p?.country ? { country: p.country } : {}),
    ...(p?.goal ? { goal: p.goal } : {}),
    ...(p?.needs?.length ? { needs: p.needs } : {}),
    ...(p?.frustrations?.length ? { frustrations: p.frustrations } : {}),
    ...(p?.icon ? { icon: p.icon } : {}),
    ...(a && avatarPath(corpus, a) ? { avatar: avatarPath(corpus, a)!.to } : {}),
    initials: initials || id.slice(0, 2).toUpperCase(),
    color: p?.color ?? PALETTE[i % PALETTE.length]!,
    ...(personaArtifact(corpus, instance, id) ? { artifact: personaArtifact(corpus, instance, id)! } : {}),
  };
}

function personasOf(corpus: JourneyCorpus, j: Journey): PersonaView[] {
  return j.scenario.personas.map((id, i) => personaOf(corpus, j.instance, id, i));
}

function avatar(p: PersonaView, size: "s" | "m" = "m"): string {
  const inner = p.avatar ? `<img src="${e(ROOT_MARK + p.avatar)}" alt="" loading="lazy">` : e(p.initials);
  return `<span class="jv-av jv-av-${size}${p.avatar ? " jv-av-img" : ""}" style="--c:${e(p.color)}" title="${e(p.name)}${p.role ? ` · ${e(p.role)}` : ""}" aria-hidden="true">${inner}</span>`;
}

/** A persona's name, linked to the ActorDefinition it plays in the IG when the IG's index lists one. */
function personaName(corpus: JourneyCorpus, j: Journey, p: PersonaView, toSite: string): string {
  const href = p.artifact ? artifactPage(corpus, igOf(corpus, j.instance), p.artifact, toSite) : undefined;
  return href ? `<a href="${e(href)}" ${DAK_ATTR} title="${e(p.artifact!)}">${e(p.name)}</a>` : e(p.name);
}

function face(emotion: number | undefined): string {
  if (emotion === undefined) return "";
  const [glyph, word] = FACES[emotion] ?? FACES[0]!;
  return `<span class="jv-face" role="img" aria-label="${word}" title="${word} (${emotion > 0 ? "+" : ""}${emotion})">${glyph}</span>`;
}

/** The step codes a journey covers, its own or its sub-journeys': `J4.0a–J4.1`. */
function codeRange(corpus: JourneyCorpus, j: Journey, seen = new Set<string>()): string {
  const codes = allSteps(corpus, j, seen).map((s) => s.id);
  if (codes.length === 0) return "";
  return codes.length === 1 ? codes[0]! : `${codes[0]}–${codes[codes.length - 1]}`;
}

export function allSteps(corpus: JourneyCorpus, j: Journey, seen = new Set<string>()): ScenarioStep[] {
  // A part of two parents is reached twice, and a cycle of parts would never end: each journey once.
  if (seen.has(`${j.instance}/${j.scenario.id}`)) return [];
  seen.add(`${j.instance}/${j.scenario.id}`);
  return [...j.scenario.steps, ...childrenOf(corpus, j).flatMap((c) => allSteps(corpus, c, seen))];
}

/** Siblings ordered along `follows`: each chain from its start, the rest by id. */
export function orderByFollows(journeys: readonly Journey[]): Journey[] {
  const ids = new Set(journeys.map((j) => j.scenario.id));
  const next = new Map<string, Journey[]>();
  for (const j of journeys) {
    const f = j.scenario.follows;
    if (f !== undefined && ids.has(f) && f !== j.scenario.id) (next.get(f) ?? next.set(f, []).get(f)!).push(j);
  }
  const out: Journey[] = [];
  const placed = new Set<string>();
  const walk = (j: Journey) => {
    if (placed.has(j.scenario.id)) return;
    placed.add(j.scenario.id);
    out.push(j);
    for (const n of (next.get(j.scenario.id) ?? []).sort((a, b) => a.scenario.id.localeCompare(b.scenario.id))) walk(n);
  };
  const starts = journeys.filter((j) => j.scenario.follows === undefined || !ids.has(j.scenario.follows));
  for (const s of [...starts].sort((a, b) => a.scenario.id.localeCompare(b.scenario.id))) walk(s);
  for (const j of [...journeys].sort((a, b) => a.scenario.id.localeCompare(b.scenario.id))) walk(j); // a cycle: still drawn
  return out;
}

/**
 * A journey's parts in story order: its `parts` (each with whether it is
 * optional or repeats), then, from an older file, the journeys whose `partOf`
 * names it, ordered along `follows`. A part that names no journey is left
 * out here; `check:journey-refs` reports it.
 */
export function partEntries(corpus: JourneyCorpus, j: Journey): { journey: Journey; part?: Part }[] {
  const listed = partsOf(j.scenario).flatMap((part) => {
    const k = journeyById(corpus, j.instance, part.scenario);
    return k ? [{ journey: k, part }] : [];
  });
  const legacy = orderByFollows(corpus.journeys.filter((c) => c.instance === j.instance && c.scenario.partOf === j.scenario.id && !listed.some((x) => x.journey === c)));
  return [...listed, ...legacy.map((journey) => ({ journey }))];
}

export function childrenOf(corpus: JourneyCorpus, j: Journey): Journey[] {
  return partEntries(corpus, j).map((x) => x.journey);
}

/** The first journey `j` is a part of; `parentsOf` (`derive.ts`) has every one. */
export function parentOf(corpus: JourneyCorpus, j: Journey): Journey | undefined {
  return parentsOf(corpus, j).find((p) => p.instance === j.instance) ?? parentsOf(corpus, j)[0];
}

/** "optional", "repeats": how a part sits in its parent's story, as a small mark. */
function partMarks(part: Part | undefined): string {
  const marks = [part?.optional ? ["optional", "The story may skip it"] : undefined, part?.repeats ? ["repeats", "It may happen more than once"] : undefined].filter((m): m is string[] => m !== undefined);
  return marks.map(([w, t]) => `<span class="jv-part-mark" title="${e(t!)}">${e(w!)}</span>`).join("");
}

/** The journeys of one layer at the top of its `partOf` tree. */
function rootsOf(corpus: JourneyCorpus, instance: string): Journey[] {
  const mine = corpus.journeys.filter((j) => j.instance === instance);
  return orderByFollows(mine.filter((j) => parentOf(corpus, j) === undefined));
}

function journeyHref(j: Journey, up: string): string {
  return `${up}${j.instance}/${j.scenario.id}/`;
}

export function workshopHref(w: WorkshopEntry, up: string): string {
  return `${up}${w.instance}/workshops/${w.workshop.id}/`;
}

export function moduleSegment(id: string): string {
  return slug(id);
}

/** The step a workshop names, resolved. */
function stepOf(corpus: JourneyCorpus, w: WorkshopEntry, scenario: string, step: string): { journey: Journey; step: ScenarioStep } | undefined {
  const j = journeyById(corpus, w.instance, scenario);
  const s = j?.scenario.steps.find((x) => x.id === step);
  return j && s ? { journey: j, step: s } : undefined;
}

function parseStepRef(ref: string): { scenario: string; step: string } | undefined {
  const i = ref.indexOf("#");
  return i > 0 ? { scenario: ref.slice(0, i), step: ref.slice(i + 1) } : undefined;
}

/** Workshop entries about one step of one journey, with the workshop they are in. */
function workshopsAt(corpus: JourneyCorpus, j: Journey, step: string): { w: WorkshopEntry; s: WorkshopStep }[] {
  const out: { w: WorkshopEntry; s: WorkshopStep }[] = [];
  for (const w of corpus.workshops) {
    for (const s of w.workshop.steps ?? []) {
      if (s.step !== step) continue;
      if (journeyById(corpus, w.instance, s.scenario) === j) out.push({ w, s });
    }
  }
  return out;
}

export function sourceHref(corpus: JourneyCorpus, instance: string, file: string): string | undefined {
  const repo = corpus.instances.get(instance)?.repository;
  return repo ? `https://github.com/${repo}/blob/HEAD/${file}` : undefined;
}

export function instanceTitle(corpus: JourneyCorpus, name: string): string {
  return corpus.instances.get(name)?.title ?? name;
}

// ── the page shell ────────────────────────────────────────────────────────

interface Crumb {
  label: string;
  href?: string;
}

/**
 * A journey page asks the site's chrome to leave out its version banner ("This
 * page is part of …"): the page is the viewer's, not a page of the guide
 * (owner, 2026-11-17). A site that stamps no banner ignores it.
 */
export const IG_BANNER_OPT_OUT = '<meta name="ig-version-banner" content="none">';

function page(o: { title: string; up: string; crumbs: Crumb[]; body: string; kind: string; print?: "sheets" }): string {
  const crumbs = o.crumbs
    .map((c) => (c.href !== undefined ? `<a href="${e(c.href)}">${e(c.label)}</a>` : `<span aria-current="page">${e(c.label)}</span>`))
    .join(`<span class="jv-sep" aria-hidden="true">›</span>`);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(o.title)}</title>
<link rel="canonical" href="./">
<link rel="icon" href="${e(DEFAULT_ICON)}">
${IG_BANNER_OPT_OUT}
${NAVBAR_LINKED}
<link rel="stylesheet" href="${o.up}assets/journeys.css">${o.body.includes('class="jv-cal"') ? `\n<link rel="stylesheet" href="${o.up}assets/calendar.css">` : ""}
<script src="${o.up}assets/journeys.js" defer></script>
${panelHead(o.body, `${o.up}assets/`)}
</head>
<body class="jv jv-${o.kind}${o.print ? ` jv-print-${o.print}` : ""}">
<nav class="jv-crumbs" aria-label="Breadcrumb">${crumbs}</nav>
<main class="jv-main">
${o.body.trim()}
</main>
<footer class="jv-foot">Drawn by the journeys viewer from the <code>user-scenario</code> and <code>workshop</code> nodes the checkout's instances declare. Every person is fictional.</footer>
</body>
</html>
`;
  return withRenderedBy(html.split(ROOT_MARK).join(o.up), TOOL_ID);
}

// ── index pages ───────────────────────────────────────────────────────────

function sparkline(steps: readonly ScenarioStep[]): string {
  const vals = steps
    .map((s) => {
      const em = s.experiences.map((x) => x.emotion).filter((v): v is number => v !== undefined);
      const lead = s.experiences.find((x) => x.actor === s.lead)?.emotion;
      return lead ?? (em.length ? em.reduce((a, b) => a + b, 0) / em.length : undefined);
    })
    .filter((v): v is number => v !== undefined);
  if (vals.length < 2) return "";
  const w = 80;
  const h = 22;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * (w - 4) + 2).toFixed(1)},${(h / 2 - (v / 2) * (h / 2 - 3)).toFixed(1)}`).join(" ");
  return `<svg class="jv-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-label="How the lead feels across the steps"><line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" class="jv-spark-zero"/><polyline points="${pts}"/></svg>`;
}

function journeyCard(corpus: JourneyCorpus, j: Journey, up: string, depth = 0, part?: Part, path: readonly Journey[] = []): string {
  const s = j.scenario;
  const personas = personasOf(corpus, j);
  // A cycle of parts is drawn once round, never forever (check:journey-refs reports it).
  const kids = path.includes(j) ? [] : partEntries(corpus, j);
  const steps = allSteps(corpus, j);
  const meta = [s.when, s.where].filter(Boolean).map((x) => e(x!)).join(" · ");
  const text = [s.title, s.description, ...s.steps.map((x) => `${x.id} ${x.title}`)].join(" ").toLowerCase();
  return `<li class="jv-node">
<a class="jv-card" href="${e(journeyHref(j, up))}" data-jv-text="${e(text)}">
<span class="jv-card-code">${e(codeRange(corpus, j) || s.id)}</span>
<span class="jv-card-title">${e(s.title)}${partMarks(part)}</span>
${meta ? `<span class="jv-card-meta">${meta}</span>` : ""}
<span class="jv-card-foot"><span class="jv-avs">${personas.map((p) => avatar(p, "s")).join("")}</span>${sparkline(steps)}<span class="jv-card-count">${s.steps.length ? `${s.steps.length} step${s.steps.length === 1 ? "" : "s"}` : kids.length ? `${kids.length} part${kids.length === 1 ? "" : "s"}` : "DAK user scenario"}</span></span>
</a>${kids.length ? `\n<ol class="jv-tree jv-tree-sub">${kids.map((k) => journeyCard(corpus, k.journey, up, depth + 1, k.part, [...path, j])).join("\n")}</ol>` : ""}
</li>`;
}

function workshopCard(w: WorkshopEntry, up: string): string {
  const ws = w.workshop;
  return `<li><a class="jv-card jv-card-ws" href="${e(workshopHref(w, up))}" data-jv-text="${e(`${ws.title} ${ws.description}`.toLowerCase())}">
<span class="jv-card-code">Workshop</span>
<span class="jv-card-title">${e(ws.title)}</span>
<span class="jv-card-meta">${ws.modules.length} module${ws.modules.length === 1 ? "" : "s"}${ws.sheets?.length ? ` · ${ws.sheets.length} printable sheet${ws.sheets.length === 1 ? "" : "s"}` : ""}${ws.resources?.length ? ` · ${ws.resources.length} resource${ws.resources.length === 1 ? "" : "s"}` : ""}</span>
</a></li>`;
}

function instanceSection(corpus: JourneyCorpus, instance: string, up: string, headingLink: boolean): string {
  const roots = rootsOf(corpus, instance);
  const ws = corpus.workshops.filter((w) => w.instance === instance);
  const n = corpus.journeys.filter((j) => j.instance === instance).length;
  const problems = corpus.problems.filter((p) => p.instance === instance);
  const title = instanceTitle(corpus, instance);
  return `<section class="jv-inst" id="${e(instance)}">
<h2>${headingLink ? `<a href="${e(`${up}${instance}/`)}">${e(title)}</a>` : e(title)} <span class="jv-muted">${e(instance)} · ${n} journey${n === 1 ? "" : "s"}${ws.length ? ` · ${ws.length} workshop${ws.length === 1 ? "" : "s"}` : ""}</span></h2>
${roots.length ? `<ol class="jv-tree">${roots.map((j) => journeyCard(corpus, j, up)).join("\n")}</ol>` : ""}
${ws.length ? `<h3>Workshops</h3><ul class="jv-tree jv-ws-list">${ws.map((w) => workshopCard(w, up)).join("\n")}</ul>` : ""}
${problems.length ? `<div class="jv-problems"><h3>Files that would not load</h3><ul>${problems.map((p) => `<li><code>${e(p.file)}</code>: ${e(p.message)}</li>`).join("")}</ul></div>` : ""}
</section>`;
}

/** The layers with anything to show, the declaring layer first. */
export function instancesWithJourneys(corpus: JourneyCorpus, first?: string): string[] {
  const names = new Set([...corpus.journeys.map((j) => j.instance), ...corpus.workshops.map((w) => w.instance), ...corpus.problems.map((p) => p.instance)]);
  return [...names].sort((a, b) => (a === first ? -1 : b === first ? 1 : a.localeCompare(b)));
}

function indexPage(corpus: JourneyCorpus, links: SiteLinks, declaring: string): string {
  const names = instancesWithJourneys(corpus, declaring);
  const total = corpus.journeys.length;
  const steps = corpus.journeys.reduce((a, j) => a + j.scenario.steps.length, 0);
  const body = `<header class="jv-hero">
<p class="jv-kicker">Journeys</p>
<h1>Every journey in ${e(links.title)}</h1>
<p class="jv-lede">${total} journey${total === 1 ? "" : "s"} and ${steps} step${steps === 1 ? "" : "s"} across ${names.length} instance${names.length === 1 ? "" : "s"} of this checkout, the mounted layers included. Each journey is a user scenario told as a journey map; a journey's parts sit under it, in the order the story follows.</p>
<label class="jv-filter"><span>Filter</span><input type="search" data-jv-filter placeholder="a title, a step code, a word" aria-label="Filter journeys"></label>
</header>
${names.length ? names.map((n) => instanceSection(corpus, n, "", true)).join("\n") : `<p class="jv-empty">No instance in this checkout declares a <code>user-scenario</code> or <code>workshop</code> directory with anything in it.</p>`}`;
  return page({ title: `Journeys — ${links.title}`, up: "", crumbs: [{ label: "Journeys" }], body, kind: "index" });
}

function instancePage(corpus: JourneyCorpus, instance: string): string {
  const body = `<header class="jv-hero">
<p class="jv-kicker">Journeys · sub-graph</p>
<h1>${e(instanceTitle(corpus, instance))}</h1>
<label class="jv-filter"><span>Filter</span><input type="search" data-jv-filter placeholder="a title, a step code, a word" aria-label="Filter journeys"></label>
</header>
${instanceSection(corpus, instance, "../", false)}`;
  return page({ title: `Journeys — ${instanceTitle(corpus, instance)}`, up: "../", crumbs: [{ label: "Journeys", href: "../" }, { label: instance }], body, kind: "index" });
}

// ── the journey page ──────────────────────────────────────────────────────

const COL = 232;
const LABEL = 150;

function journeyMap(corpus: JourneyCorpus, j: Journey, personas: PersonaView[], ladder: { code: string; label: string }[] | undefined): string {
  const steps = j.scenario.steps;
  const n = steps.length;
  const present = personas.filter((p) => steps.some((s) => s.experiences.some((x) => x.actor === p.id)));
  const cols = `grid-template-columns:${LABEL}px repeat(${n}, ${COL}px)`;
  const row = (label: string, cls: string, cells: string[]) =>
    `<div class="jv-row ${cls}" role="row"><div class="jv-rl" role="rowheader">${label}</div>${cells.map((c, i) => `<div class="jv-cell" role="cell" data-step="${e(steps[i]!.id)}">${c}</div>`).join("")}</div>`;
  const head = row(
    "Step",
    "jv-row-head",
    steps.map(
      (s) =>
        `<a href="#${e(stepAnchor(s.id))}" class="jv-colhead"><span class="jv-code">${e(s.id)}</span><b>${e(s.title)}</b>${s.when || s.where ? `<span class="jv-muted">${[s.when, s.where].filter(Boolean).map((x) => e(x!)).join(" · ")}</span>` : ""}${s.touchpoint ? `<span class="jv-touch">${e(s.touchpoint)}</span>` : ""}</a>`,
    ),
  );
  const lanes = present.map((p) =>
    row(
      `${avatar(p)}<span><b>${e(p.name)}</b>${p.role ? `<span class="jv-muted">${e(p.role)}</span>` : ""}</span>`,
      "jv-lane",
      steps.map((s) => {
        const x = s.experiences.find((y) => y.actor === p.id);
        if (!x) return `<span class="jv-absent" aria-label="not in this step">—</span>`;
        return `<div class="jv-exp${s.lead === p.id ? " jv-lead" : ""}" style="--c:${e(p.color)}">${face(x.emotion)}<p>${e(x.doing)}</p>${x.feeling ? `<q>${e(x.feeling.replace(/^[“"]|[”"]$/g, ""))}</q>` : ""}</div>`;
      }),
    ).replace('class="jv-row jv-lane"', `class="jv-row jv-lane" style="--c:${e(p.color)}"`),
  );
  // The feeling curve: one line per persona across the step columns.
  const H = 132;
  const y = (v: number) => (H / 2 - (v / 2) * (H / 2 - 14)).toFixed(1);
  const W = n * COL;
  const grid =
    [-2, -1, 0, 1, 2].map((v) => `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="${v === 0 ? "jv-zero" : "jv-grid"}"/>`).join("") +
    [2, 0, -2].map((v) => `<text x="6" y="${(Number(y(v)) + 4).toFixed(1)}">${FACES[v]![0]} ${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}</text>`).join("");
  const spread = (k: number) => (k - (present.length - 1) / 2) * 9;
  const lines = present
    .map((p, k) => {
      const pts = steps
        .map((s, i) => ({ i, v: s.experiences.find((x) => x.actor === p.id)?.emotion }))
        .filter((q): q is { i: number; v: number } => q.v !== undefined)
        .map((q) => ({ x: q.i * COL + COL / 2 + spread(k), y: y(q.v), v: q.v }));
      if (pts.length === 0) return "";
      return `<g class="jv-curve" style="--c:${e(p.color)}"><title>${e(p.name)}</title>${pts.length > 1 ? `<polyline points="${pts.map((q) => `${q.x},${q.y}`).join(" ")}"/>` : ""}${pts.map((q) => `<circle cx="${q.x}" cy="${q.y}" r="5"/>`).join("")}</g>`;
    })
    .join("");
  const curve = `<div class="jv-row jv-row-curve" role="row"><div class="jv-rl" role="rowheader">How they feel</div><div class="jv-curvecell" style="grid-column: span ${n}"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Feeling curve, one line per person">${grid}${lines}</svg></div></div>`;
  const text = (v: string | undefined) => (v ? `<p>${e(v)}</p>` : `<span class="jv-absent">—</span>`);
  const pain = row("Pain point", "jv-row-pain", steps.map((s) => text(s.painPoint)));
  const enabler = row("What makes it work", "jv-row-enabler", steps.map((s) => text(s.enabler)));
  const record = row(
    "The record",
    "jv-row-record",
    steps.map((s) => {
      if (!s.record) return `<span class="jv-absent">—</span>`;
      const i = ladder?.findIndex((c) => c.code === s.record!.state) ?? -1;
      const label = i >= 0 ? ladder![i]!.label : s.record.state;
      const bar = ladder && i >= 0 ? `<span class="jv-ladder" aria-hidden="true">${ladder.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</span>` : "";
      return `${bar}<b>${e(label)}</b><p>${e(s.record.description)}</p><span class="jv-muted">Held: ${e(s.record.heldWhere)}</span>`;
    }),
  );
  const handoff = row(
    "Hand-off",
    "jv-row-handoff",
    steps.map((s) =>
      s.handoff
        ? `<p>${e(s.handoff.summary)}</p>${s.handoff.carrier ? `<span class="jv-muted">${e(s.handoff.carrier)}</span>` : ""}${s.handoff.offline !== undefined ? `<span class="jv-badge ${s.handoff.offline ? "jv-off" : "jv-on"}">${s.handoff.offline ? "offline" : "online"}</span>` : ""}`
        : `<span class="jv-absent">—</span>`,
    ),
  );
  return `<section class="jv-map" aria-labelledby="jv-map-h">
<h2 id="jv-map-h">Journey map</h2>
<p class="jv-muted jv-hint">A column per step and a lane per person. The curve shows how each person feels; a step's column links to its detail below.</p>
<div class="jv-map-scroll" tabindex="0"><div class="jv-grid" role="table" style="${cols}">
${[head, ...lanes, curve, pain, enabler, record, handoff].join("\n")}
</div></div>
</section>`;
}

let figureSeq = 0;

/**
 * A process drawing as every page of the site shows one: `render:bpmn`'s
 * linked drawing, inlined, in the common BPMN block (`bpmn-figure
 * pt-diagram`, `scripts/lib/task-panel.ts`). The step's flow nodes are named
 * in `data-pt-highlight` and the task panel's client marks them; `panel` is
 * the processes viewer's sidecar for the drawing, so its ⓘ markers and [+]
 * links come too, and without one the drawing is highlighted only. The
 * scroll box takes keyboard focus, so a wide drawing scrolls from the keys.
 *
 * The XML prologue and doctype are dropped. Comments are left as they are:
 * they are harmless inside inline SVG, and a one-pass strip could JOIN the
 * pieces of a nested one (`<!<!---->--`) into a `<!--` that swallows the page.
 */
export function bpmnFigure(svg: string, tasks: readonly string[] | undefined, caption: string, panel?: string): string {
  const id = `jv-fig-${++figureSeq}`;
  const body = svg
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .trim();
  const hl = [...new Set(tasks ?? [])];
  const attrs = `${panel ? ` data-panel="${e(panel)}"` : ""}${hl.length ? ` data-pt-highlight="${e(hl.join(" "))}"` : ""}`;
  return `<figure class="bpmn-figure pt-diagram jv-bpmn" id="${id}"${attrs}><div class="jv-bpmn-scroll" tabindex="0" role="group" aria-label="Process drawing, scrolls with the arrow keys">${body}</div><figcaption>${caption}</figcaption></figure>`;
}

/** The task panel's client and styles, for a page that carries a {@link bpmnFigure}; nothing for one that does not. */
export function panelHead(body: string, assets: string): string {
  return body.includes("pt-diagram")
    ? `<link rel="stylesheet" href="${e(`${assets}${PANEL_CLIENT.style}`)}">\n<script src="${e(`${assets}${PANEL_CLIENT.script}`)}" defer></script>`
    : "";
}

function assessmentGrid(w: WorkshopEntry, s: WorkshopStep): string {
  const scales = w.workshop.assessment?.scales ?? [];
  const caps = s.capabilities ?? [];
  if (!caps.length) return "";
  const head = scales.length ? `<tr><th scope="col">What had to exist</th>${scales.map((sc) => `<th scope="col">${e(sc.label)}</th>`).join("")}</tr>` : "";
  const rows = caps
    .map((c) => {
      const key = `${w.workshop.id}:${s.scenario}:${s.step}:${c.id}`;
      return `<tr><th scope="row">${e(c.label)}</th>${scales
        .map(
          (sc) =>
            `<td><span class="jv-opts" role="radiogroup" aria-label="${e(`${c.label}: ${sc.label}`)}">${sc.options
              .map((o) => `<label><input type="radio" name="${e(`${key}:${sc.id}`)}" value="${e(o.id)}" data-jv-store><span>${e(o.label)}</span></label>`)
              .join("")}</span></td>`,
        )
        .join("")}</tr>`;
    })
    .join("");
  return `<table class="jv-assess">${head}${rows}</table>${w.workshop.assessment?.standingLine ? `<p class="jv-standing">${e(w.workshop.assessment.standingLine)}</p>` : ""}`;
}

function workshopPanel(corpus: JourneyCorpus, w: WorkshopEntry, s: WorkshopStep, up: string): string {
  const href = workshopHref(w, up);
  const mod = (id: string) => w.workshop.modules.find((m) => m.id === id);
  const byModule = new Map<string, string[]>();
  for (const q of s.questions ?? []) (byModule.get(q.module) ?? byModule.set(q.module, []).get(q.module)!).push(q.text);
  const questions = [...byModule]
    .map(([m, qs]) => `<li><a class="jv-mod" href="${e(`${href}${moduleSegment(m)}/`)}" title="${e(mod(m)?.title ?? m)}">${e(m)}</a><div>${qs.map((q) => `<p>${e(q)}</p>`).join("")}</div></li>`)
    .join("");
  const tables = new Map((w.workshop.tables ?? []).map((t) => [t.id, t]));
  const tags = (s.tags ?? [])
    .map((t) => {
      const table = tables.get(t.table);
      const row = table?.rows.find((r) => r.id === t.row);
      return `<li><span class="jv-muted">${e(table?.title ?? t.table)}</span> <b>${e(row?.label ?? t.row)}</b>${t.why ? ` — ${e(t.why)}` : ""}</li>`;
    })
    .join("");
  const resources = (w.workshop.resources ?? []).filter((r) => (r.steps ?? []).includes(`${s.scenario}#${s.step}`));
  return `<aside class="jv-ws" aria-label="Workshop: ${e(w.workshop.title)}">
<p class="jv-kicker">Workshop · <a href="${e(href)}">${e(w.workshop.title)}</a></p>
${s.askTheRoom ? `<blockquote class="jv-ask"><span>Ask the room</span>${e(s.askTheRoom)}</blockquote>` : ""}
${s.facilitatorCue ? `<p class="jv-cue"><b>Facilitator:</b> ${e(s.facilitatorCue)}</p>` : ""}
${questions ? `<h4>Questions, by module</h4><ol class="jv-qs">${questions}</ol>` : ""}
${s.capabilities?.length ? `<h4>Where does your country stand?</h4>${assessmentGrid(w, s)}` : ""}
${tags ? `<h4>What the step touches</h4><ul class="jv-tags">${tags}</ul>` : ""}
${resources.length ? `<h4>Job aids and resources</h4><ul class="jv-res">${resources.map((r) => `<li><a href="${e(`${href}#res-${r.id}`)}">${e(r.title)}</a> <span class="jv-badge">${e(r.kind)}</span></li>`).join("")}</ul>` : ""}
</aside>`;
}

/** Where a step's illustration is copied, relative to its journey's page; undefined when `src` names no file. */
export function illustrationPath(corpus: JourneyCorpus, j: Journey, s: ScenarioStep): { from: string; to: string } | undefined {
  const src = s.illustration?.src;
  const from = src === undefined ? undefined : instanceFile(corpus, j.instance, src);
  return from === undefined ? undefined : { from, to: `img/${stepAnchor(s.id)}${extname(from).toLowerCase()}` };
}

/**
 * A step's picture, or the brief for drawing one. The picture carries no
 * text (owner, 2026-11-05): the step's title is drawn above it and the `alt`
 * below it as page text, so both are translated with the page.
 */
function illustrationHtml(corpus: JourneyCorpus, j: Journey, s: ScenarioStep, personas: PersonaView[]): string {
  const il = s.illustration;
  if (il === undefined) return "";
  const at = illustrationPath(corpus, j, s);
  if (at !== undefined) {
    return `<figure class="jv-illus"><p class="jv-illus-title"><span class="jv-code">${e(s.id)}</span> ${e(s.title)}</p><img src="${e(at.to)}" alt="${e(il.alt)}" loading="lazy"><figcaption>${e(il.alt)}</figcaption></figure>`;
  }
  const style = j.scenario.illustrationStyle;
  const who = (id: string) => personas.find((p) => p.id === id)?.name ?? lookup(corpus.actors, j.instance, id)?.title ?? id;
  return `<details class="jv-brief"><summary>Illustration brief${il.src ? ` <span class="jv-badge jv-warn">no file at ${e(il.src)}</span>` : ""}</summary>
<p class="jv-muted">No picture yet: the brief for drawing one. The picture carries no text; the title and caption are the page's.</p>
<dl class="jv-dl"><dt>Title (page text)</dt><dd>${e(s.title)}</dd><dt>Caption (page text)</dt><dd>${e(il.alt)}</dd>${il.prompt ? `<dt>Scene</dt><dd>${e(il.prompt)}</dd>` : ""}${style ? `<dt>Style</dt><dd>${e(style.prompt)}</dd>` : ""}</dl>
${style?.cast?.length ? `<h5>Cast</h5><ul>${style.cast.map((c) => `<li><b>${e(who(c.actor))}</b>: ${e(c.description)}</li>`).join("")}</ul>` : ""}
${style?.notes?.length ? `<h5>Notes</h5><ul>${style.notes.map((n) => `<li>${e(n)}</li>`).join("")}</ul>` : ""}
</details>`;
}

function stepSection(corpus: JourneyCorpus, j: Journey, s: ScenarioStep, i: number, personas: PersonaView[], links: SiteLinks, up: string): string {
  const steps = j.scenario.steps;
  const toSite = siteRootFrom(up, links);
  const lead = personas.find((p) => p.id === s.lead);
  const st = s as ScenarioStep & { gaps?: string[]; references?: { label: string; href: string; rel?: string }[] };
  const story = [
    s.narrative ? `<div class="jv-prose">${mdHtml(s.narrative)}</div>` : "",
    s.preconditions?.length
      ? `<details class="jv-pre"><summary>Before this step (${s.preconditions.length})</summary>${s.preconditions.map((p) => `<h5>${e(p.title)}</h5><div class="jv-prose">${mdHtml(p.description)}</div>`).join("")}</details>`
      : "",
    s.whatIf?.length ? `<h4>What if…</h4><ul class="jv-whatif">${s.whatIf.map((w) => `<li><b>${e(w.scenario)}</b> ${e(w.outcome)}</li>`).join("")}</ul>` : "",
    st.gaps?.length ? `<h4>Not yet specified</h4><ul class="jv-gaps">${st.gaps.map((g) => `<li>${e(g)}</li>`).join("")}</ul>` : "",
    s.policy ? `<p class="jv-policy"><b>Policy point.</b> ${e(s.policy)}</p>` : "",
  ].join("\n");
  // Under the hood: building blocks by layer, then the edges.
  const uses = (s.uses ?? []).map((u) => ({ u, b: blockFor(corpus, j.instance, u.block) }));
  const layers = new Map<string, typeof uses>();
  for (const x of uses) {
    const key = x.b?.layer ?? "Other";
    (layers.get(key) ?? layers.set(key, []).get(key)!).push(x);
  }
  const usesHtml = uses.length
    ? `<h4>Building blocks used</h4>${[...layers]
        .map(
          ([layer, xs]) =>
            `<h5>${e(layer)}</h5><ul class="jv-blocks">${xs
              .map(
                ({ u, b }) =>
                  `<li class="jv-block${b ? "" : " jv-unresolved"}"><span class="jv-block-name">${b ? e(b.block.short ?? b.block.name) : e(u.block)}</span>${b ? `<span class="jv-badge">${e(b.block.kind)}</span><span class="jv-badge jv-jur">${e(b.block.jurisdiction)}</span>` : `<span class="jv-badge jv-warn">not in a catalogue</span>`}<span class="jv-role">${e(u.role)}</span>${b?.block.what ? `<details><summary>What it is</summary><p>${e(b.block.what)}</p>${b.block.soWhat ? `<p><b>So what:</b> ${e(b.block.soWhat)}</p>` : ""}${b.block.links?.length ? `<p>${b.block.links.map((l) => `<a href="${e(l.url)}">${e(l.label)}</a>`).join(" · ")}</p>` : ""}</details>` : ""}</li>`,
              )
              .join("")}</ul>`,
        )
        .join("")}`
    : "";
  const stories = (s.stories ?? []).map((id) => ({ id, s: lookup(corpus.stories, j.instance, id) }));
  const storiesHtml = stories.length
    ? `<h4>User stories</h4><ul class="jv-stories">${stories
        .map(({ id, s: story }) =>
          story
            ? `<li><span class="jv-code">${e(id)}</span> As a <b>${e(story.role.replace(/-/g, " "))}</b>, I want to ${e(story.want.charAt(0).toLowerCase() + story.want.slice(1))}${story.soThat ? `, so that ${e(story.soThat)}` : ""}.</li>`
            : `<li class="jv-unresolved"><span class="jv-code">${e(id)}</span> not found</li>`,
        )
        .join("")}</ul>`
    : "";
  const reqHtml = s.requirements?.length
    ? `<h4>Requirements exercised</h4><ul class="jv-reqs">${s.requirements
        .map((id) => {
          const r = requirementFor(corpus, id);
          const href = r ? sourceHref(corpus, r.instance, r.file) : undefined;
          return r
            ? `<li><${href ? `a href="${e(href)}"` : "span"} class="jv-code">${e(id)}</${href ? "a" : "span"}> ${e(r.title)}${r.statement ? `<details><summary>Statement</summary><p>${e(r.statement)}</p></details>` : ""}</li>`
            : `<li class="jv-unresolved"><span class="jv-code">${e(id)}</span> no <code>req:</code> node in this checkout</li>`;
        })
        .join("")}</ul>`
    : "";
  const exHtml = s.examples?.length
    ? `<h4>FHIR examples produced</h4><ul class="jv-examples">${s.examples
        .map((k) => {
          const x = corpus.examples.get(k);
          const href = artifactPage(corpus, igOf(corpus, j.instance), k, toSite);
          return `<li>${href ? `<a href="${e(href)}" class="jv-code" ${DAK_ATTR}>${e(k)}</a>` : `<span class="jv-code">${e(k)}</span>`}${x?.code ? ` ${e(x.code)}` : ""}</li>`;
        })
        .join("")}</ul>`
    : "";
  const dak = dakGroups(corpus, igOf(corpus, j.instance), s.dak, toSite);
  const dakHtml = dak.length
    ? `<h4>DAK assets</h4><dl class="jv-dl jv-dak">${dak
        .map(
          (g) =>
            `<dt>${e(g.label)}</dt><dd>${g.assets
              .map((a) => {
                const tip = e(a.description ? `${a.key} — ${a.description}` : a.key);
                return a.href ? `<a href="${e(a.href)}" class="jv-code" ${DAK_ATTR} title="${tip}">${e(a.label)}</a>` : `<span class="jv-code" title="${tip}">${e(a.label)}</span>`;
              })
              .join(" ")}</dd>`,
        )
        .join("")}</dl>`
    : "";
  const refsHtml = st.references?.length ? `<h4>References</h4><ul>${st.references.map((r) => `<li><a href="${e(fromSite(r.href, toSite))}">${e(r.label)}</a>${r.rel ? ` <span class="jv-muted">${e(r.rel)}</span>` : ""}</li>`).join("")}</ul>` : "";
  const handoffHtml =
    s.handoff && (s.handoff.carrier || s.handoff.payload)
      ? `<h4>What travels</h4><dl class="jv-dl">${s.handoff.carrier ? `<dt>Carrier</dt><dd>${e(s.handoff.carrier)}</dd>` : ""}${s.handoff.payload ? `<dt>Payload</dt><dd>${e(s.handoff.payload)}</dd>` : ""}</dl>`
      : "";
  const hood = [s.technicalSummary ? `<p class="jv-tech">${e(s.technicalSummary)}</p>` : "", usesHtml, handoffHtml, storiesHtml, reqHtml, exHtml, dakHtml, refsHtml].join("\n");
  const processes = (s.realisedBy ?? [])
    .map((r) => {
      const d = linkedProcessDrawing(corpus, links, j.instance, r.process, toSite, igProcessPage(corpus, igOf(corpus, j.instance), j.instance, r.process, toSite));
      const page = links.processesPage?.(j.instance);
      const caption = `<code>${e(r.process)}</code>${r.tasks?.length ? ` · ${r.tasks.length} flow node${r.tasks.length === 1 ? "" : "s"} highlighted: ${r.tasks.map((t) => `<code>${e(t)}</code>`).join(" ")}` : " · the whole process"}${page ? ` · <a href="${e(page)}">processes viewer</a>` : ""}`;
      const panel = links.processPanel?.(j.instance, r.process);
      return d ? bpmnFigure(d.svg, r.tasks, caption, panel === undefined ? undefined : fromSite(panel, toSite)) : `<p class="jv-unresolved">No drawing beside <code>${e(r.process)}</code> (run <code>render:bpmn</code>).</p>`;
    })
    .join("\n");
  const prev = steps[i - 1];
  const next = steps[i + 1];
  const ws = workshopsAt(corpus, j, s.id).map(({ w, s: ws }) => workshopPanel(corpus, w, ws, up)).join("\n");
  return `<article class="jv-step" id="${e(stepAnchor(s.id))}" data-step="${e(s.id)}" tabindex="-1">
<header class="jv-step-head">
<span class="jv-code jv-code-l">${e(s.id)}</span>
<div><h3>${e(s.title)}</h3>${s.headline ? `<p class="jv-headline">${e(s.headline)}</p>` : ""}
<p class="jv-muted">${[s.when, s.where, s.touchpoint].filter(Boolean).map((x) => e(x!)).join(" · ")}${lead ? ` · told through ${avatar(lead, "s")} ${e(lead.name)}` : ""}</p>${includesHtml(corpus, j, s, up)}</div>
</header>
${illustrationHtml(corpus, j, s, personas)}
<div class="jv-step-body">
<div class="jv-col">${story}</div>
<details class="jv-col jv-hood"><summary class="jv-hood-h">Under the hood</summary>${hood}</details>
</div>
${processes ? `<section class="jv-procs"><h4>Where it happens in the process</h4>${processes}</section>` : ""}
${ws}
<nav class="jv-pn">${prev ? `<a href="#${e(stepAnchor(prev.id))}" rel="prev">← ${e(prev.id)} ${e(prev.title)}</a>` : "<span></span>"}${next ? `<a href="#${e(stepAnchor(next.id))}" rel="next">${e(next.id)} ${e(next.title)} →</a>` : "<span></span>"}</nav>
</article>`;
}

/** A step that IS another journey (`includes`): a link to it, or the id, marked unresolved, when it names none. */
function includesHtml(corpus: JourneyCorpus, j: Journey, s: ScenarioStep, up: string): string {
  if (s.includes === undefined) return "";
  const k = journeyById(corpus, j.instance, s.includes);
  return `<p class="jv-includes">This step is the journey ${k ? `<a href="${e(journeyHref(k, up))}"><b>${e(k.scenario.title)}</b></a>` : `<span class="jv-unresolved"><code>${e(s.includes)}</code></span>`}.</p>`;
}

function journeyPage(corpus: JourneyCorpus, j: Journey, links: SiteLinks): string {
  figureSeq = 0;
  const up = "../../";
  const s = j.scenario;
  const personas = personasOf(corpus, j);
  const parent = parentOf(corpus, j);
  const parents = parentsOf(corpus, j);
  const kids = partEntries(corpus, j);
  // A part's neighbours are its parent's parts; outside a parent, `follows` says it.
  const siblings = parent ? childrenOf(corpus, parent) : [];
  const at = siblings.indexOf(j);
  const prev = siblings[at - 1] ?? (s.follows ? journeyById(corpus, j.instance, s.follows) : undefined);
  const nexts = siblings[at + 1] ? [siblings[at + 1]!] : orderByFollows(corpus.journeys.filter((x) => x.instance === j.instance && x.scenario.follows === s.id));
  const ladder = s.trustLadder ? lookup(corpus.ladders, j.instance, s.trustLadder) : undefined;
  const description = /\.md$/.test(s.description.trim())
    ? (() => {
        try {
          return mdHtml(readFileSync(join(corpus.instances.get(j.instance)!.root, s.description.trim()), "utf8"));
        } catch {
          return `<p>${e(s.description)}</p>`;
        }
      })()
    : mdHtml(s.description);
  const toSite = siteRootFrom(up, links);
  const views = (s.views ?? [])
    .map((v) => {
      const t = links.archimateView?.(j.instance, v.model, v.view);
      if (!t) return `<li class="jv-unresolved">ArchiMate view <code>${e(v.view)}</code> of model <code>${e(v.model)}</code>: not drawn in this site</li>`;
      // An <object>, as the view's own page shows it: the drawing's links are
      // written relative to the SVG and open with target="_top", so each
      // element opens its page; inside an <img> they were inert.
      return `<li><figure class="jv-am"><object type="image/svg+xml" data="${e(toSite + t.svg)}" aria-label="${e(v.label ?? t.name)}"><a href="${e(toSite + t.page)}" ${DAK_ATTR}>${e(v.label ?? t.name)}</a></object><figcaption><a href="${e(toSite + t.page)}" ${DAK_ATTR}>${e(v.label ?? t.name)}</a></figcaption></figure></li>`;
    })
    .join("");
  const src = sourceHref(corpus, j.instance, j.file);
  const stepNav = s.steps.length > 1 ? `<nav class="jv-stepnav" aria-label="Steps">${s.steps.map((x) => `<a href="#${e(stepAnchor(x.id))}" data-step="${e(x.id)}"><span class="jv-code">${e(x.id)}</span> ${e(x.title)}</a>`).join("")}</nav>` : "";
  const body = `<header class="jv-hero">
<p class="jv-kicker">Journey${codeRange(corpus, j) ? ` · ${e(codeRange(corpus, j))}` : ""} · ${e(instanceTitle(corpus, j.instance))}</p>
<h1>${e(s.title)}</h1>
<div class="jv-lede">${description}</div>
<dl class="jv-facts">${s.when ? `<div><dt>When</dt><dd>${e(s.when)}</dd></div>` : ""}${s.where ? `<div><dt>Where</dt><dd>${e(s.where)}</dd></div>` : ""}${s.country ? `<div><dt>Country</dt><dd>${e(s.country)}</dd></div>` : ""}<div><dt>Steps</dt><dd>${s.steps.length}</dd></div></dl>
<ul class="jv-people">${personas.map((p) => `<li>${avatar(p)}<span><b>${personaName(corpus, j, p, toSite)}</b>${p.role || p.country ? `<span class="jv-muted">${[p.role, p.country].filter(Boolean).map((x) => e(x!)).join(" · ")}</span>` : ""}${p.goal ? `<span class="jv-goal">${e(p.goal)}</span>` : ""}</span></li>`).join("")}</ul>
<nav class="jv-seq" aria-label="The story">${prev ? `<a href="${e(journeyHref(prev, up))}" rel="prev">← follows <b>${e(prev.scenario.title)}</b></a>` : "<span></span>"}${parents.map((p) => `<a href="${e(journeyHref(p, up))}" rel="up">↑ part of <b>${e(p.scenario.title)}</b></a>`).join("")}${nexts.map((n) => `<a href="${e(journeyHref(n, up))}" rel="next">followed by <b>${e(n.scenario.title)}</b> →</a>`).join("")}</nav>
</header>
${kids.length ? `<section class="jv-kids"><h2>Parts, in story order</h2><ol class="jv-tree">${kids.map((k) => journeyCard(corpus, k.journey, up, 0, k.part, [j])).join("\n")}</ol></section>` : ""}
${s.steps.length ? journeyMap(corpus, j, personas, ladder) : ""}
${s.steps.length ? `<section class="jv-steps" data-jv-stepper aria-labelledby="jv-steps-h"><div class="jv-steps-bar"><h2 id="jv-steps-h">Step by step</h2><span class="jv-actions"><button type="button" class="jv-btn" data-jv-print>Print (A3)</button></span></div>${stepNav}\n${s.steps.map((x, i) => stepSection(corpus, j, x, i, personas, links, up)).join("\n")}</section>` : ""}
${views ? `<section class="jv-views"><h2>Architecture</h2><ul class="jv-views-list">${views}</ul></section>` : ""}
${s.references?.length ? `<section><h2>References</h2><ul>${s.references.map((r) => `<li><a href="${e(fromSite(r.href, toSite))}">${e(r.label)}</a></li>`).join("")}</ul></section>` : ""}
<p class="jv-src">${src ? `Source: <a href="${e(src)}"><code>${e(j.file)}</code></a>` : `Source: <code>${e(j.file)}</code>`} (<code>${e(s.$schema)}</code>)</p>`;
  const crumbs: Crumb[] = [{ label: "Journeys", href: up }, { label: j.instance, href: `${up}${j.instance}/` }];
  const chain: Journey[] = [];
  for (let p = parent; p !== undefined && !chain.includes(p); p = parentOf(corpus, p)) chain.unshift(p);
  for (const p of chain) crumbs.push({ label: p.scenario.title, href: journeyHref(p, up) });
  crumbs.push({ label: codeRange(corpus, j) || s.title });
  return page({ title: `${s.title} — journeys`, up, crumbs, body, kind: "journey" });
}

// ── workshop pages ────────────────────────────────────────────────────────

function tableHtml(t: NonNullable<Workshop["tables"]>[number], tick = false): string {
  const cols = {
    question: t.rows.some((r) => r.question),
    what: t.rows.some((r) => r.what),
    example: t.rows.some((r) => r.example),
  };
  return `<table class="jv-table"><caption>${e(t.title)}${t.description ? `<span class="jv-muted"> — ${e(t.description)}</span>` : ""}</caption><thead><tr>${tick ? "<th></th>" : ""}<th scope="col">${e(t.title)}</th>${cols.what ? "<th scope=\"col\">What</th>" : ""}${cols.question ? "<th scope=\"col\">Question</th>" : ""}${cols.example ? "<th scope=\"col\">Example</th>" : ""}${tick ? "<th scope=\"col\">Ours</th>" : ""}</tr></thead><tbody>${t.rows
    .map(
      (r) =>
        `<tr>${tick ? `<td><span class="jv-box"></span></td>` : ""}<th scope="row">${e(r.label)}</th>${cols.what ? `<td>${e(r.what ?? "")}</td>` : ""}${cols.question ? `<td>${e(r.question ?? "")}</td>` : ""}${cols.example ? `<td>${e(r.example ?? "")}</td>` : ""}${tick ? `<td class="jv-write"></td>` : ""}</tr>`,
    )
    .join("")}</tbody></table>`;
}

function resourceItem(w: WorkshopEntry, r: NonNullable<Workshop["resources"]>[number], up: string, toWorkshop: string): string {
  const href = r.href === undefined ? undefined : /^[a-z]+:/i.test(r.href) ? r.href : `${toWorkshop}${r.href}`;
  return `<li class="jv-resource" id="res-${e(r.id)}"><span class="jv-badge">${e(r.kind)}</span> ${href ? `<a href="${e(href)}">${e(r.title)}</a>` : `<b>${e(r.title)}</b>`}${r.description ? `<p>${e(r.description)}</p>` : ""}${r.body ? `<div class="jv-jobaid">${mdHtml(r.body)}</div>` : ""}</li>`;
}

/** Every question of a workshop in one module, in teaching order, with its step. */
function questionsIn(corpus: JourneyCorpus, w: WorkshopEntry, module: string): { ref?: { journey: Journey; step: ScenarioStep }; scenario: string; step: string; text: string }[] {
  const order = new Map(w.workshop.scenarios.map((s, i) => [s, i]));
  const steps = [...(w.workshop.steps ?? [])].sort((a, b) => {
    const oa = order.get(a.scenario) ?? 999;
    const ob = order.get(b.scenario) ?? 999;
    if (oa !== ob) return oa - ob;
    const ja = journeyById(corpus, w.instance, a.scenario);
    return (ja?.scenario.steps.findIndex((x) => x.id === a.step) ?? 0) - (ja?.scenario.steps.findIndex((x) => x.id === b.step) ?? 0);
  });
  return steps.flatMap((s) =>
    (s.questions ?? [])
      .filter((q) => q.module === module)
      .map((q) => {
        const ref = stepOf(corpus, w, s.scenario, s.step);
        return { ...(ref ? { ref } : {}), scenario: s.scenario, step: s.step, text: q.text };
      }),
  );
}

function stepLink(q: { ref?: { journey: Journey; step: ScenarioStep }; step: string }, up: string): string {
  return q.ref
    ? `<a class="jv-code" href="${e(`${journeyHref(q.ref.journey, up)}#${stepAnchor(q.ref.step.id)}`)}" title="${e(q.ref.step.title)}">${e(q.step)}</a>`
    : `<span class="jv-code jv-unresolved" title="no such step">${e(q.step)}</span>`;
}

function workshopPage(corpus: JourneyCorpus, w: WorkshopEntry): string {
  const up = "../../../";
  const ws = w.workshop;
  const days = [...new Set(ws.modules.map((m) => m.day ?? 0))];
  const modulesHtml = days
    .map(
      (d) =>
        `${d ? `<h3>Day ${d}</h3>` : ""}<ol class="jv-modules">${ws.modules
          .filter((m) => (m.day ?? 0) === d)
          .map((m) => {
            const n = questionsIn(corpus, w, m.id).length;
            return `<li><a class="jv-card jv-card-mod" href="${moduleSegment(m.id)}/"><span class="jv-card-code">${e(m.id)}</span><span class="jv-card-title">${e(m.title)}</span>${m.carries ? `<span class="jv-card-meta">${e(m.carries)}</span>` : ""}<span class="jv-card-foot"><span class="jv-card-count">${n} question${n === 1 ? "" : "s"} on the journey${m.sheet ? ` · ${e(ws.sheets?.find((s) => s.id === m.sheet)?.label ?? m.sheet)}` : ""}</span></span></a></li>`;
          })
          .join("")}</ol>`,
    )
    .join("");
  const scenarios = ws.scenarios.map((id) => journeyById(corpus, w.instance, id));
  const sched = scheduleFor(corpus, w);
  const calendar = sched ? scheduleHtml({ corpus, here: w, owner: sched.owner, schedule: sched.schedule, toWorkshops: "../", md: mdHtml }) : "";
  const body = `<header class="jv-hero">
<p class="jv-kicker">Workshop · ${e(instanceTitle(corpus, w.instance))}</p>
<h1>${e(ws.title)}</h1>
<div class="jv-lede">${mdHtml(ws.description)}</div>
${ws.audience ? `<p><b>For:</b> ${e(ws.audience)}</p>` : ""}
${ws.promise ? `<p class="jv-promise">${e(ws.promise)}</p>` : ""}
${ws.useCaseStatement ? `<p class="jv-usecase">${e(ws.useCaseStatement)}</p>` : ""}
<p><a class="jv-btn" href="overview/">Present it: overview and walkthrough</a>${calendar ? ` <a class="jv-btn" href="#the-days">${e(scheduleTitle(sched!.schedule))}</a>` : ""}${ws.sheetsSource ? ` <a class="jv-btn" href="${sheetsAt(corpus, w)}">${e(ws.sheetsSource.title ?? "Table canvas")}</a>` : ws.sheets?.length ? ` <a class="jv-btn" href="${sheetsAt(corpus, w)}">Printable sheets (${ws.sheets.length})</a>` : ""}</p>
</header>
${calendar}
<section><h2>Taught from</h2><ol class="jv-tree">${scenarios.map((j, i) => (j ? journeyCard(corpus, j, up) : `<li class="jv-unresolved">${e(ws.scenarios[i]!)}: no such journey in this checkout</li>`)).join("\n")}</ol></section>
<section><h2>Modules</h2>${modulesHtml}</section>
${ws.tables?.length ? `<section><h2>Reference tables</h2>${ws.tables.map((t) => tableHtml(t)).join("\n")}</section>` : ""}
${ws.assessment ? `<section><h2>How a table rates what it needs</h2><ul>${ws.assessment.scales.map((s) => `<li><b>${e(s.label)}:</b> ${s.options.map((o) => e(o.label)).join(" · ")}</li>`).join("")}</ul>${ws.assessment.standingLine ? `<p class="jv-standing">${e(ws.assessment.standingLine)}</p>` : ""}</section>` : ""}
${ws.discussion?.length ? `<section id="discussion"><h2>Closing discussion</h2><ol class="jv-disc">${ws.discussion.map((d) => discussionItem(corpus, w, d, up, "")).join("")}</ol></section>` : ""}
${ws.resources?.length ? `<section><h2>Job aids and resources</h2><ul class="jv-resources">${ws.resources.map((r) => resourceItem(w, r, up, "")).join("")}</ul></section>` : ""}
<p class="jv-src">${(() => {
    const h = sourceHref(corpus, w.instance, w.file);
    return h ? `Source: <a href="${e(h)}"><code>${e(w.file)}</code></a>` : `Source: <code>${e(w.file)}</code>`;
  })()}</p>`;
  return page({ title: `${ws.title} — workshop`, up, crumbs: [{ label: "Journeys", href: up }, { label: w.instance, href: `${up}${w.instance}/` }, { label: ws.title }], body, kind: "workshop" });
}

function discussionItem(corpus: JourneyCorpus, w: WorkshopEntry, d: NonNullable<Workshop["discussion"]>[number], up: string, toWorkshop: string): string {
  const steps = (d.steps ?? [])
    .map((r) => {
      const p = parseStepRef(r);
      const ref = p ? stepOf(corpus, w, p.scenario, p.step) : undefined;
      return stepLink({ ...(ref ? { ref } : {}), step: p?.step ?? r }, up);
    })
    .join(" ");
  return `<li><p class="jv-theme">${d.module ? `<a class="jv-mod" href="${e(`${toWorkshop}${moduleSegment(d.module)}/`)}">${e(d.module)}</a> ` : ""}<b>${e(d.theme)}</b> ${steps}</p><p>${e(d.question)}</p></li>`;
}

function modulePage(corpus: JourneyCorpus, w: WorkshopEntry, moduleId: string): string {
  const up = "../../../../";
  const ws = w.workshop;
  const i = ws.modules.findIndex((m) => m.id === moduleId);
  const m = ws.modules[i]!;
  const qs = questionsIn(corpus, w, m.id);
  const tables = (ws.tables ?? []).filter((t) => t.module === m.id || (m.tables ?? []).includes(t.id));
  const resources = (ws.resources ?? []).filter((r) => (r.modules ?? []).includes(m.id));
  const disc = (ws.discussion ?? []).filter((d) => d.module === m.id);
  const sheet = ws.sheets?.find((s) => s.id === m.sheet);
  const prev = ws.modules[i - 1];
  const next = ws.modules[i + 1];
  const body = `<header class="jv-hero">
<p class="jv-kicker">Module ${e(m.id)}${m.day ? ` · day ${m.day}` : ""}${m.durationMinutes ? ` · ${m.durationMinutes} min` : ""} · <a href="../">${e(ws.title)}</a></p>
<h1>${e(m.title)}</h1>
${m.carries ? `<p class="jv-carries">${e(m.carries)}</p>` : ""}
${m.description ? `<div class="jv-lede">${mdHtml(m.description)}</div>` : ""}
${m.objectives?.length ? `<h2>By the end, a participant can</h2><ul class="jv-objectives">${m.objectives.map((o) => `<li>${e(o)}</li>`).join("")}</ul>` : ""}
${sheet ? `<p><a class="jv-btn" href="../${sheetsAt(corpus, w, `sheet-${sheet.id}`)}">${e(sheet.label ?? sheet.title)}: ${e(sheet.title)} (${e(sheet.size)})</a></p>` : ""}
</header>
<section><h2>The questions, along the journey</h2>${qs.length ? `<ol class="jv-modqs">${qs.map((q) => `<li>${stepLink(q, up)}<div><span class="jv-muted">${e(q.ref?.step.title ?? "")}</span><p>${e(q.text)}</p></div></li>`).join("")}</ol>` : `<p class="jv-muted">No step asks a question in this module.</p>`}</section>
${tables.length ? `<section><h2>Tables</h2>${tables.map((t) => tableHtml(t)).join("\n")}</section>` : ""}
${disc.length ? `<section><h2>Discussion</h2><ol class="jv-disc">${disc.map((d) => discussionItem(corpus, w, d, up, "../")).join("")}</ol></section>` : ""}
${resources.length ? `<section><h2>Job aids and resources</h2><ul class="jv-resources">${resources.map((r) => resourceItem(w, r, up, "../")).join("")}</ul></section>` : ""}
<nav class="jv-pn">${prev ? `<a href="../${moduleSegment(prev.id)}/" rel="prev">← ${e(prev.id)} ${e(prev.title)}</a>` : "<span></span>"}${next ? `<a href="../${moduleSegment(next.id)}/" rel="next">${e(next.id)} ${e(next.title)} →</a>` : "<span></span>"}</nav>`;
  return page({
    title: `${m.id} ${m.title} — ${ws.title}`,
    up,
    crumbs: [{ label: "Journeys", href: up }, { label: w.instance, href: `${up}${w.instance}/` }, { label: ws.title, href: "../" }, { label: m.id }],
    body,
    kind: "module",
  });
}

function lines(n: number): string {
  return `<span class="jv-lines">${"<i></i>".repeat(n)}</span>`;
}

/** The printable sheets of a workshop, one `<article class="jv-sheet">` each: on the sheets page, framed or not. */
/**
 * Where a workshop's sheets are, from its own directory: the Table sheets panel
 * of the discussion for a presented workshop (`present-views.ts`), the sheets
 * page otherwise; `anchor` is a sheet on it.
 */
export function sheetsAt(corpus: JourneyCorpus, w: WorkshopEntry, anchor?: string): string {
  return presentationOf(corpus, w).steps.length ? `discuss/#${e(anchor ?? "sheets")}` : `sheets/${anchor ? `#${e(anchor)}` : ""}`;
}

export function sheetsHtml(corpus: JourneyCorpus, w: WorkshopEntry): string {
  const ws = w.workshop;
  const scales = ws.assessment?.scales ?? [];
  return [coverSheet(w), ...(ws.sheets ?? [])
    .map((sh) => {
      const mods = sh.modules.map((id) => ws.modules.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => m !== undefined);
      const qBlocks = mods
        .map((m) => {
          const qs = questionsIn(corpus, w, m.id);
          return `<section class="jv-sheet-mod"><h3><span class="jv-mod">${e(m.id)}</span> ${e(m.title)}</h3>${m.carries ? `<p class="jv-carries">${e(m.carries)}</p>` : ""}<ol>${qs.map((q) => `<li><span class="jv-code">${e(q.step)}</span> ${e(q.text)}${lines(2)}</li>`).join("")}</ol></section>`;
        })
        .join("");
      const tables = (ws.tables ?? []).filter((t) => (t.module !== undefined && sh.modules.includes(t.module)) || mods.some((m) => (m.tables ?? []).includes(t.id)));
      const caps = new Map<string, string>();
      for (const s of ws.steps ?? []) if ((s.questions ?? []).some((q) => sh.modules.includes(q.module))) for (const c of s.capabilities ?? []) caps.set(c.id, c.label);
      const strip =
        sh.assessmentStrip && caps.size && scales.length
          ? `<footer class="jv-strip"><table><thead><tr><th>What had to exist</th>${scales.map((s) => `<th>${e(s.label)}</th>`).join("")}</tr></thead><tbody>${[...caps]
              .map(([, label]) => `<tr><th>${e(label)}</th>${scales.map((s) => `<td>${s.options.map((o) => `<span class="jv-tick"><span class="jv-box"></span>${e(o.label)}</span>`).join("")}</td>`).join("")}</tr>`)
              .join("")}</tbody></table>${ws.assessment?.standingLine ? `<p class="jv-standing">${e(ws.assessment.standingLine)}</p>` : ""}</footer>`
          : "";
      return `<article class="jv-sheet jv-sheet-${e(sh.size.toLowerCase())}" id="sheet-${e(sh.id)}">
<header class="jv-sheet-head"><div><p class="jv-kicker">${e(ws.title)}</p><h2>${sh.label ? `${e(sh.label)} · ` : ""}${e(sh.title)}</h2></div><div class="jv-sheet-who">Country / table${lines(1)}</div></header>
<div class="jv-sheet-body">${qBlocks}${tables.map((t) => tableHtml(t, true)).join("")}${(sh.fields ?? []).map((f) => `<section class="jv-field"><h3>${e(f.label)}</h3>${lines(f.lines)}</section>`).join("")}</div>
${strip}
</article>`;
    })].filter(Boolean)
    .join("\n");
}

/**
 * The cover the sheets open with (JV-14): the blanks a table fills in, the
 * workshop's scope promise, and the ways to start from the table the
 * presentation names. On its own page, the first sheet's size.
 */
export function coverSheet(w: WorkshopEntry): string {
  const ws = w.workshop;
  if (!ws.sheets?.length) return "";
  const cover = ws.presentation?.cover;
  const fields = cover?.fields ?? ["Country", "Delegation", "Table", "Facilitator"];
  const table = cover?.table ? ws.tables?.find((t) => t.id === cover.table) : undefined;
  const size = ws.sheets[0]!.size.toLowerCase();
  return `<article class="jv-sheet jv-sheet-${e(size)} jv-cover" id="sheet-cover">
<header class="jv-sheet-head"><div><p class="jv-kicker">${e(ws.title)}</p><h2>Cover</h2></div></header>
<div class="jv-cover-fields">${fields.map((f) => `<label class="jv-cover-field"><span>${e(f)}</span>${lines(1)}</label>`).join("")}</div>
${ws.promise ? `<p class="jv-promise"><b>The scope promise.</b> ${e(ws.promise)}</p>` : ""}
${table ? `<section class="jv-ways" aria-label="${e(table.title)}">${table.rows.map((r) => `<div class="jv-way"><b>${e(r.label)}</b>${r.what ? `<p>${e(r.what)}</p>` : ""}${r.example ? `<small>e.g. ${e(r.example)}</small>` : ""}</div>`).join("")}</section>` : ""}
</article>`;
}

// ── the workshop's own canvas (JV-06) ─────────────────────────────────────

/** One file of the canvas: where the sheets page links it, and, for a file of the layer, where it is copied from. */
export interface CanvasFile {
  /** Relative to the sheets page (`canvas/page-1.png`), or the URL as the workshop gave it. */
  href: string;
  /** The file in the layer, when it is copied beside the page. */
  from?: string;
  /** An image's pixel size, read from the file in the layer: the page never shows it wider. */
  size?: ImageSize;
}

/** The workshop's `sheetsSource`, every file resolved; what the Table sheets view shows in place of the drawn sheets. */
export interface Canvas {
  title: string;
  description?: string;
  size: "A3" | "A4";
  docx?: CanvasFile;
  pdf?: CanvasFile;
  previews: CanvasFile[];
  /** Hrefs the workshop names that are no file of its layer (check:journey-refs reports them too). */
  missing: string[];
}

const isUrl = (href: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("/");

/**
 * The workshop's own canvas, or undefined when it names none or none of its
 * files resolves (the drawn sheets are shown then). A relative href is read
 * from the workshop file's directory, inside its layer, and copied to
 * `canvas/<file name>` beside the sheets page; a URL is linked as given.
 */
export function canvasOf(corpus: JourneyCorpus, w: WorkshopEntry): Canvas | undefined {
  const src = w.workshop.sheetsSource;
  if (!src) return undefined;
  const root = corpus.instances.get(w.instance)?.root;
  const missing: string[] = [];
  const used = new Set<string>();
  const file = (href: string | undefined): CanvasFile | undefined => {
    if (href === undefined) return undefined;
    if (isUrl(href)) return { href };
    const from = root === undefined ? undefined : instanceFile(corpus, w.instance, relative(root, resolve(w.dir, href)));
    if (from === undefined) {
      missing.push(href);
      return undefined;
    }
    // Two files of one name (a.png in two folders) get the second a number.
    let name = basename(from);
    for (let i = 2; used.has(name); i++) name = `${basename(from, extname(from))}-${i}${extname(from)}`;
    used.add(name);
    const size = imageSize(from);
    return { href: `canvas/${name}`, from, ...(size ? { size } : {}) };
  };
  const docx = file(src.docx);
  const pdf = file(src.pdf);
  const previews = (src.previews ?? []).map(file).filter((f): f is CanvasFile => f !== undefined);
  if (!docx && !pdf && previews.length === 0) return undefined;
  return {
    title: src.title ?? "Table canvas",
    ...(src.description ? { description: src.description } : {}),
    size: src.size ?? "A3",
    ...(docx ? { docx } : {}),
    ...(pdf ? { pdf } : {}),
    previews,
    missing,
  };
}

/** The canvas files to copy beside a sheets page, paths relative to its directory (`sheets/`). */
export function canvasFiles(c: Canvas | undefined): PageFile[] {
  return c ? [c.docx, c.pdf, ...c.previews].filter((f): f is CanvasFile & { from: string } => f?.from !== undefined).map((f) => ({ path: f.href, content: new Uint8Array(readFileSync(f.from)) })) : [];
}

/** The canvas's download links, each with `cls`: the Word file, the PDF. */
export function canvasDownloads(c: Canvas, cls: string, icons: { file?: string } = {}): string {
  const link = (f: CanvasFile | undefined, label: string) => (f ? `<a class="${cls}" href="${e(f.href)}"${f.from ? " download" : ""}>${icons.file ?? ""}${e(label)}</a>` : "");
  return link(c.docx, "Download Word (.docx)") + link(c.pdf, "Download PDF");
}

/**
 * The canvas's pages: an image per page, one printed page each, never shown
 * wider than its pixels (a 72 dpi preview stretched to a wide column is what
 * made the canvas blurry, owner 2026-11-17; `check:journey-refs` warns on one); without
 * previews, the PDF itself in the page; with only the Word file, a line
 * saying so.
 */
export function canvasHtml(c: Canvas): string {
  const n = c.previews.length;
  const pages = n
    ? c.previews
        .map((f, i) => `<figure class="jv-canvas-page jv-canvas-${c.size.toLowerCase()}" id="canvas-page-${i + 1}"><img src="${e(f.href)}"${f.size ? ` width="${f.size.width}" height="${f.size.height}" style="max-width:${f.size.width}px"` : ""} alt="${e(`${c.title}, page ${i + 1} of ${n}`)}" loading="${i ? "lazy" : "eager"}"><figcaption class="jv-noprint">Page ${i + 1} of ${n}</figcaption></figure>`)
        .join("")
    : c.pdf
      ? `<object class="jv-canvas-pdf" type="application/pdf" data="${e(c.pdf.href)}" aria-label="${e(c.title)}"><p><a href="${e(c.pdf.href)}">${e(c.title)} (PDF)</a></p></object>`
      : `<p class="jv-muted">The canvas is a Word file: download it to print.</p>`;
  return `<section class="jv-canvas" aria-label="${e(c.title)}">${pages}</section>`;
}

function sheetsPage(corpus: JourneyCorpus, w: WorkshopEntry): string {
  const up = "../../../../";
  const ws = w.workshop;
  const canvas = canvasOf(corpus, w);
  const sheets = sheetsHtml(corpus, w);
  const body = canvas
    ? `<header class="jv-hero jv-noprint"><p class="jv-kicker"><a href="../">${e(ws.title)}</a></p><h1>${e(canvas.title)}</h1>${canvas.description ? `<p>${e(canvas.description)}</p>` : ""}<p>${canvas.previews.length ? `<button type="button" class="jv-btn" data-jv-print>Print the canvas (${e(canvas.size)} landscape)</button> ` : ""}${canvasDownloads(canvas, "jv-btn")}</p></header>
${canvasHtml(canvas)}`
    : `<header class="jv-hero jv-noprint"><p class="jv-kicker"><a href="../">${e(ws.title)}</a></p><h1>Printable sheets</h1><p>One sheet per page, ${[...new Set((ws.sheets ?? []).map((s) => s.size))].join(" and ")} landscape. Print from the browser at 100% with background graphics on.</p><p><button type="button" class="jv-btn" data-jv-print>Print the sheets</button></p></header>
${sheets || `<p class="jv-muted">This workshop has no sheets.</p>`}`;
  return page({
    title: `Sheets — ${ws.title}`,
    up,
    crumbs: [{ label: "Journeys", href: up }, { label: w.instance, href: `${up}${w.instance}/` }, { label: ws.title, href: "../" }, { label: "Sheets" }],
    body,
    kind: "sheets",
    print: "sheets",
  });
}

// ── all of it ─────────────────────────────────────────────────────────────

/** Every file of the viewer, paths relative to its route. */
export function renderJourneyPages(corpus: JourneyCorpus, links: SiteLinks, declaring: string): PageFile[] {
  const out: PageFile[] = [];
  out.push({ path: "index.html", content: indexPage(corpus, links, declaring) });
  for (const inst of instancesWithJourneys(corpus, declaring)) {
    out.push({ path: `${inst}/index.html`, content: instancePage(corpus, inst) });
  }
  for (const j of corpus.journeys) {
    if (j.scenario.id === "workshops") throw new Error(`${j.instance}/${j.file}: a journey may not be called "workshops", the viewer's own segment`);
    out.push({ path: `${j.instance}/${j.scenario.id}/index.html`, content: journeyPage(corpus, j, links) });
    for (const s of j.scenario.steps) {
      const il = illustrationPath(corpus, j, s);
      if (il !== undefined) out.push({ path: `${j.instance}/${j.scenario.id}/${il.to}`, content: readFileSync(il.from) });
    }
  }
  for (const w of corpus.workshops) {
    const base = `${w.instance}/workshops/${w.workshop.id}`;
    out.push({ path: `${base}/index.html`, content: workshopPage(corpus, w) });
    for (const m of w.workshop.modules) {
      const seg = moduleSegment(m.id);
      if (seg === "sheets" || (PRESENT_SEGMENTS as readonly string[]).includes(seg)) throw new Error(`${w.file}: a module may not be called "${seg}", the viewer's own segment`);
      out.push({ path: `${base}/${moduleSegment(m.id)}/index.html`, content: modulePage(corpus, w, m.id) });
    }
    // A workshop with steps to present has its sheets in the presentation frame (`present.ts`).
    if (presentationOf(corpus, w).steps.length === 0) {
      out.push({ path: `${base}/sheets/index.html`, content: sheetsPage(corpus, w) });
      for (const f of canvasFiles(canvasOf(corpus, w))) out.push({ path: `${base}/sheets/${f.path}`, content: f.content });
    }
  }
  out.push(...renderPresentationPages(corpus, links));
  // Every persona's picture, once, from the route root (`ROOT_MARK`).
  for (const actors of corpus.actors.values()) {
    for (const a of actors.values()) {
      const at = avatarPath(corpus, a);
      if (at !== undefined) out.push({ path: at.to, content: new Uint8Array(readFileSync(at.from)) });
    }
  }
  for (const a of ASSETS) out.push({ path: posix.join("assets", a), content: readFileSync(join(ASSET_DIR, a), "utf8") });
  // The common task panel's client and styles, the text the processes viewer writes beside its sidecars.
  out.push({ path: posix.join("assets", PANEL_CLIENT.script), content: `${PANEL_SCRIPT}\n` });
  out.push({ path: posix.join("assets", PANEL_CLIENT.style), content: `${PANEL_CSS}\n` });
  return out;
}
