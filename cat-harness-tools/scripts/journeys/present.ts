/**
 * The journeys viewer's presentation pages: a workshop told in a room, the
 * way the VaxLink walkthrough tells it — an overview, then one page per step.
 *
 * @module scripts/journeys/present
 * @covers user-scenario, workshop
 *
 * These pages wear NO site chrome (owner, 2026-11-05: "if site chrome went
 * away, it should match"). They draw their own app frame — a top bar with the
 * occasion, the subject, the step range and the presenter toggle, then an app
 * bar with the name and the outward links — and the view tabs under it, in
 * the walkthrough's palette (`present.css`). Everything on them is read from
 * the graph: the workshop (its teaching order, its `presentation` words and
 * each step's questions, cue and capabilities), the journeys it teaches from
 * (steps, people, feelings, record, hand-off, what-ifs, building blocks, BPMN)
 * and the actors (`meta.persona`: initials and colour).
 *
 * ## Routes, under the workshop's own `<instance>/workshops/<id>/`
 *
 * | path | page |
 * |---|---|
 * | `overview/index.html` | the story in one sentence, a card per chapter, the cast, the trust ladder |
 * | `walkthrough/<step>/index.html` | one step: the chapter progress bar, the story card, the people, the record, ask the room, what if, the policy layer, under the hood |
 * | `assets/present.css`, `assets/present.js`, `assets/gap-report.js` | the style, and the keys (← → W T), presenter mode, the gap strip's memory and the discussion page's gap report |
 *
 * ## Chapters
 *
 * The workshop's `scenarios` are the steps, in teaching order. They are
 * grouped into chapters by their parents (`parts`; `partOf` in an older file), one level below what they all share:
 * five journeys of which two are part of a third make four chapters
 * (smart-trust-demo), and eight journeys all part of one make eight
 * ({@link chapterRoots}).
 *
 * Pure, like `render.ts`: a corpus in, files out.
 */
import { escHtml } from "../thin-page.ts";
import { renderViewPages, VIEW_SEGMENTS } from "./present-views.ts";
import { scheduleFor, scheduleGlanceHtml, scheduleHtml } from "./schedule.ts";
import { demoScreensOf, DEVICE_GLYPH, type DemoScreen, type DemoSource } from "./screens.ts";
import { NAVBAR_OPT_OUT } from "../viewer-page.ts";
import { withRenderedBy } from "../viewer-declarations.ts";
import { screenExamples } from "../../schemas/process/device-screen.ts";
import type { ScenarioStep } from "../../schemas/process/user-scenario.ts";
import type { WorkshopPresentation, WorkshopStep } from "../../schemas/process/workshop.ts";
import { blockFor, fromSite, journeyById, lookup, processName, siteRootFrom, type Journey, type JourneyCorpus, type WorkshopEntry } from "./read.ts";
import { artifactPage, DAK_ATTR, dakGroups, linkedProcessDrawing, type DakGroup } from "./dak-links.ts";
import {
  bpmnFigure,
  childrenOf,
  illustrationPath,
  mdHtml,
  moduleSegment,
  panelHead,
  parentOf,
  personaOf,
  ROOT_MARK,
  sourceHref,
  TOOL_ID,
  type PageFile,
  type PersonaView,
  type SiteLinks,
} from "./render.ts";

export { PRESENT_ASSETS } from "./present-assets.ts";
/** The workshop segments these pages take: a module may not be called either. */
export const PRESENT_SEGMENTS = ["overview", "walkthrough", ...VIEW_SEGMENTS] as const;

const e = escHtml;

// ── the model: chapters and steps in teaching order ───────────────────────

export interface PresentedStep {
  journey: Journey;
  step: ScenarioStep;
  /** The URL segment: the step id, or `<scenario>-<id>` when two journeys share an id. */
  key: string;
  /** Position in the whole walkthrough, from 0. */
  index: number;
  /** Position of its chapter, from 0. */
  chapter: number;
  /** The workshop's entry for this step, if it has one. */
  ws?: WorkshopStep;
}

export interface Chapter {
  journey: Journey;
  /** Its title in the room: `presentation.chapterTitles` for its journey, else the journey title without the code in front ("Born abroad" for "J1 — Born abroad"). */
  title: string;
  steps: PresentedStep[];
}

export interface Presentation {
  w: WorkshopEntry;
  chapters: Chapter[];
  steps: PresentedStep[];
  /** Everyone a step names, in the declared order (`presentation.cast`) then of first appearance, with a stable colour each. */
  cast: PersonaView[];
  /** The Device Demo's screens (`screens.ts`), and whether they are drawn or framed. */
  screens: DemoScreen[];
  demo: DemoSource;
}

/**
 * The cast in the order the presentation declares (`presentation.cast`), then
 * everyone else in order of first appearance. An id the declared order names
 * and no step does is dropped: the cast is the people the steps name.
 */
export function castOrder(appearing: readonly string[], declared: readonly string[] | undefined): string[] {
  if (!declared?.length) return [...appearing];
  const first = declared.filter((id, i) => appearing.includes(id) && declared.indexOf(id) === i);
  return [...first, ...appearing.filter((id) => !first.includes(id))];
}

/** "J1 — Born abroad" → "Born abroad": a step code ("J4.0", "P2", "T") and a dash or a middle dot in front are dropped. */
export function shortTitle(title: string): string {
  const m = /^(?:[A-Z]{1,3}[0-9][A-Za-z0-9.]*|[A-Z]{1,3})\s+[—–·-]\s+(.+)$/.exec(title.trim());
  return m ? m[1]!.trim() : title.trim();
}

/** The chain of journeys from the top of a journey's tree of parts down to it, through its first parent. */
function ancestry(corpus: JourneyCorpus, j: Journey): Journey[] {
  const chain: Journey[] = [j];
  for (let p = parentOf(corpus, j); p !== undefined && !chain.includes(p); p = parentOf(corpus, p)) chain.unshift(p);
  return chain;
}

/**
 * Each taught journey's chapter: its ancestor one level below the deepest one
 * they ALL share. A journey at that level or above is its own chapter.
 */
export function chapterRoots(corpus: JourneyCorpus, taught: readonly Journey[]): Journey[] {
  const chains = taught.map((j) => ancestry(corpus, j));
  let shared = 0;
  while (chains.length > 0 && chains.every((c) => c.length > shared + 1 && c[shared] === chains[0]![shared])) shared++;
  return chains.map((c) => c[Math.min(shared, c.length - 1)]!);
}

/** The steps a workshop teaches, in its order, grouped into chapters. */
export function presentationOf(corpus: JourneyCorpus, w: WorkshopEntry): Presentation {
  const taught = w.workshop.scenarios.map((id) => journeyById(corpus, w.instance, id)).filter((j): j is Journey => j !== undefined);
  const roots = chapterRoots(corpus, taught);
  const chapters: Chapter[] = [];
  const seen = new Set<string>();
  const flat: { journey: Journey; step: ScenarioStep; chapter: number }[] = [];
  taught.forEach((j, k) => {
    const root = roots[k]!;
    let c = chapters.findIndex((x) => x.journey === root);
    if (c < 0) {
      chapters.push({ journey: root, title: w.workshop.presentation?.chapterTitles?.[root.scenario.id] ?? shortTitle(root.scenario.title), steps: [] });
      c = chapters.length - 1;
    }
    // A journey with no steps of its own is taught through its sub-journeys.
    const own = j.scenario.steps.length ? j.scenario.steps.map((step) => ({ journey: j, step })) : stepsUnder(corpus, j);
    for (const s of own) {
      const id = `${s.journey.instance}/${s.journey.scenario.id}#${s.step.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      flat.push({ ...s, chapter: c });
    }
  });
  const count = new Map<string, number>();
  for (const s of flat) count.set(s.step.id, (count.get(s.step.id) ?? 0) + 1);
  const steps: PresentedStep[] = flat.map((s, index) => {
    const ws = (w.workshop.steps ?? []).find((x) => x.step === s.step.id && journeyById(corpus, w.instance, x.scenario) === s.journey);
    return {
      ...s,
      key: (count.get(s.step.id) ?? 0) > 1 ? `${s.journey.scenario.id}-${s.step.id}` : s.step.id,
      index,
      ...(ws ? { ws } : {}),
    };
  });
  for (const s of steps) chapters[s.chapter]!.steps.push(s);
  const ids: string[] = [];
  const instanceOf = new Map<string, string>();
  for (const s of steps) {
    for (const id of [s.step.lead, ...s.step.experiences.map((x) => x.actor)]) {
      if (!ids.includes(id)) {
        ids.push(id);
        instanceOf.set(id, s.journey.instance);
      }
    }
  }
  const cast = castOrder(ids, w.workshop.presentation?.cast).map((id, i) => personaOf(corpus, instanceOf.get(id)!, id, i));
  const demo = demoScreensOf(corpus, w, steps);
  return { w, chapters: chapters.filter((c) => c.steps.length > 0), steps, cast, screens: demo.screens, demo: demo.source };
}

/** A journey's steps and its parts', in story order: each journey once (a part of two parents, or a cycle of parts). */
function stepsUnder(corpus: JourneyCorpus, j: Journey, seen = new Set<Journey>()): { journey: Journey; step: ScenarioStep }[] {
  if (seen.has(j)) return [];
  seen.add(j);
  return [...j.scenario.steps.map((step) => ({ journey: j, step })), ...childrenOf(corpus, j).flatMap((c) => stepsUnder(corpus, c, seen))];
}

// ── small helpers ─────────────────────────────────────────────────────────

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
/** "Four moments that matter". */
export const countWord = (n: number): string => WORDS[n] ?? String(n);

/** The chip colour of each country, in order of first appearance: as VaxLink's Thailand, Lao PDR, Cross-Border. */
const CHIP_TONES = ["amber", "sky", "indigo", "emerald", "rose", "violet"] as const;
export function countryTones(countries: readonly (string | undefined)[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of countries) if (c !== undefined && !out.has(c)) out.set(c, CHIP_TONES[out.size % CHIP_TONES.length]!);
  return out;
}

/** The colour of each building-block layer, in the catalogue's order: as VaxLink's apps, data, trust. */
export const LAYER_TONES = ["teal", "sky", "indigo", "violet", "rose", "amber"] as const;

/**
 * A sentence that names people, as text. The names are marked
 * (`.jp-named`) but no avatar is put inside the sentence (owner,
 * 2026-11-06: a chip mid-sentence reads as a stray icon); a card that wants
 * the people it names shows {@link mentioned} in its header instead.
 */
export function personaText(text: string, people: readonly PersonaView[], link?: (p: PersonaView) => string | undefined): string {
  const named = namedIn(people);
  if (named.length === 0) return e(text);
  return e(text).replace(namePattern(named, true), (m) => {
    const p = named.find((x) => e(x.name) === m);
    const href = p ? link?.(p) : undefined;
    return href ? `<a class="jp-named" href="${e(href)}" ${DAK_ATTR}>${m}</a>` : `<span class="jp-named">${m}</span>`;
  });
}

const namedIn = (people: readonly PersonaView[]): PersonaView[] => [...people].filter((p) => p.name.trim()).sort((a, b) => b.name.length - a.name.length);
const namePattern = (named: readonly PersonaView[], escaped = false): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}])(${named.map((p) => (escaped ? e(p.name) : p.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}\\p{N}])`, "gu");

/** The people a sentence names, in the cast's order, each once, leaving out `except` (the card's own person). */
export function mentioned(text: string, people: readonly PersonaView[], except?: string): PersonaView[] {
  const named = namedIn(people);
  if (named.length === 0) return [];
  const hit = new Set([...text.matchAll(namePattern(named))].map((m) => m[1]!));
  return people.filter((p) => p.id !== except && hit.has(p.name));
}

/** The avatars of the people a card's sentence names, for its header. */
export function mentionedChips(text: string, people: readonly PersonaView[], except?: string): string {
  const who = mentioned(text, people, except);
  return who.length ? `<span class="jp-mentions" title="${e(`With ${who.map((p) => p.name).join(", ")}`)}">${who.map((p) => avatar(p, "sm")).join("")}</span>` : "";
}

/** A person's avatar: their picture when the persona names one (from the route root, `ROOT_MARK`), else their glyph or initials on their colour. */
export function avatar(p: PersonaView, size: "sm" | "md" | "lg" = "md"): string {
  // A persona's picture where it names one; else its `icon` (the baby's face, as VaxLink draws
  // Somsack: owner's side-by-side review, 2026-11-11, row D05, superseding the 2026-11-06
  // initials-for-everyone rule); else its initials.
  const inner = p.avatar ? `<img src="${e(ROOT_MARK + p.avatar)}" alt="" loading="lazy">` : p.icon && GLYPH[p.icon] ? glyph(p.icon) : e(p.initials);
  return `<span class="jp-av jp-av-${size}${p.avatar ? " jp-av-img" : p.icon && GLYPH[p.icon] ? " jp-av-icon" : ""}" style="--c:${e(p.color)}" title="${e(p.name)}" aria-hidden="true">${inner}</span>`;
}

// Small line icons (24×24, stroked), drawn for these pages.
const ICON: Record<string, string> = {
  up: '<path d="M18 15l-6-6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>',
  code: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="M16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
  present: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4M8 21h8"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>',
  message: '<path d="M21 12a8.5 8.5 0 0 1-12.3 7.6L3 21l1.5-5.2A8.5 8.5 0 1 1 21 12z"/><path d="M10 9.5a2 2 0 1 1 2.5 2c-.5.2-.5.6-.5 1.5M12 16h.01"/>',
  printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  play: '<path d="M6 3l14 9-14 9z"/>',
  arrow: '<path d="M5 12h14M13 5l7 7-7 7"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  package: '<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>',
  ext: '<path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  alert: '<path d="M12 3L2 21h20zM12 10v4M12 17h.01"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 5-6 4-11 8"/>',
  landmark: '<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-6 10 6z"/>',
  chart: '<path d="M3 3v18h18M7 16v1M11 11v6M15 8v9M19 5v12"/>',
  scroll: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2h6v4H9zM9 14l2 2 4-4"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
  bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  workflow: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6.5h4a3 3 0 0 1 3 3V14"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M10 13l-1.5 2 1.5 2M14 13l1.5 2-1.5 2"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/>',
  wifioff: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01M3 3l18 18"/>',
  frown: '<circle cx="12" cy="12" r="10"/><path d="M8 16.5s1.5-2 4-2 4 2 4 2M9 9h.01M15 9h.01"/>',
  meh: '<circle cx="12" cy="12" r="10"/><path d="M8 15h8M9 9h.01M15 9h.01"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  laugh: '<circle cx="12" cy="12" r="10"/><path d="M8 13h8a4 4 0 0 1-8 0zM9 9h.01M15 9h.01"/>',
};
export type IconName = keyof typeof ICON;
export const icon = (name: IconName, cls = ""): string =>
  `<svg class="jp-i${cls ? ` ${cls}` : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

/**
 * The glyphs a journey's `scene` and a persona's `icon` name
 * (`JOURNEY_GLYPHS` of the user-scenario kind), drawn as the icons are.
 */
export const GLYPH: Record<string, string> = {
  baby: '<circle cx="12" cy="8" r="4.5"/><path d="M10.2 7.5h.01M13.8 7.5h.01M10.5 9.8a2 2 0 0 0 3 0M6 21v-1.5a6 6 0 0 1 12 0V21"/>',
  person: ICON.user!,
  family: ICON.users!,
  clinician: '<circle cx="12" cy="6" r="3.5"/><path d="M5 21v-3a7 7 0 0 1 14 0v3M9 14.5v3a3 3 0 0 0 6 0"/>',
  "health-worker": '<circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0M12 15v4M10 17h4"/>',
  hospital: '<path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M12 7v6M9 10h6M10 21v-4h4v4"/>',
  clinic: '<path d="M3 21h18M4 21V10l8-6 8 6v11M12 10v6M9 13h6"/>',
  home: '<path d="M3 11l9-8 9 8M5 9v12h14V9M10 21v-6h4v6"/>',
  phone: ICON.phone!,
  tablet: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 18h2"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  paper: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/>',
  "wifi-off": ICON.wifioff!,
  wifi: ICON.wifi!,
  battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2M5 10h9v4H5z"/>',
  "shield-check": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  "calendar-check": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
  stethoscope: '<path d="M5 3v6a4 4 0 0 0 8 0V3M9 13v2a5 5 0 0 0 10 0v-2"/><circle cx="19" cy="11" r="2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  transfer: '<path d="M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>',
  globe: ICON.globe!,
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="M11.5 11.5L21 2M17 6l3 3M15 8l2 2"/>',
  lock: '<rect x="4" y="11" width="16" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  tent: '<path d="M3 21L12 4l9 17zM12 4v17M9 21l3-6 3 6"/>',
  bus: '<rect x="4" y="3" width="16" height="15" rx="2"/><path d="M4 11h16M8 21v-3M16 21v-3M7 15h.01M17 15h.01"/>',
  plane: '<path d="M2 16l20-8-6 13-3-6z"/><path d="M13 15l-5 5"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.6-2.4-2.9-5.5-3"/>',
  shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  // The glyphs a device screen adds (`SCREEN_GLYPHS` of the device-screen kind).
  syringe: '<path d="M18 2l4 4M15 5l4 4M17 7l-9.5 9.5a2 2 0 0 1-2.8 0l-.2-.2a2 2 0 0 1 0-2.8L14 4M9 11l2 2M6 14l2 2M5 19l-3 3"/>',
  pill: '<path d="M10.5 20.5a5 5 0 0 1-7-7l10-10a5 5 0 0 1 7 7z"/><path d="M8.5 8.5l7 7"/>',
  "pill-off": '<path d="M10.5 20.5a5 5 0 0 1-7-7l10-10a5 5 0 0 1 7 7z"/><path d="M8.5 8.5l7 7"/><circle cx="12" cy="12" r="11"/><path d="M4.2 4.2l15.6 15.6"/>',
  pen: '<path d="M14 4l6 6M12 6l6 6-8 8H4v-6zM4 20l3-3M17 3l4 4"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  eye: ICON.eye!,
  unlock: '<rect x="4" y="11" width="16" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1.2"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  cross: '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>',
  question: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>',
  printer: ICON.printer!,
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  alert: ICON.alert!,
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  user: ICON.user!,
  users: ICON.users!,
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  layers: '<path d="M12 2L2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  "shield-alert": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4M12 16h.01"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  kiosk: '<rect x="6" y="2" width="12" height="14" rx="1"/><path d="M9 20h6M12 16v4M9 6h6"/>',
  scanner: '<path d="M7 2h10l1 9H6zM9 11l-1 11h5l1-11M10 5h4"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/>',
  "baby-new": '<circle cx="12" cy="8" r="4.5"/><path d="M10.2 7.5h.01M13.8 7.5h.01M10.5 9.8a2 2 0 0 0 3 0M6 21v-1.5a6 6 0 0 1 12 0V21M19 3v4M17 5h4"/>',
};
/** An icon's bare paths, for drawing it inside another SVG. */
export const iconPaths = (name: string): string => ICON[name] ?? "";

export const glyph = (name: string, cls = ""): string =>
  `<svg class="jp-i${cls ? ` ${cls}` : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[name] ?? ""}</svg>`;

/** A journey's small picture: its `scene` glyphs with arrows between (VaxLink `MomentIllustration`); empty when it has none. */
export function sceneStrip(scene: readonly { icon: string; label: string }[] | undefined, tone = "sky", size: "sm" | "md" = "md"): string {
  if (!scene?.length) return "";
  return `<figure class="jp-scene jp-scene-${size} jp-scene-${tone}" aria-label="${e(scene.map((x) => x.label).join(", then "))}">${scene
    .map((x, i) => `${i ? icon("arrow", "jp-scene-arrow") : ""}<span class="jp-scene-p" title="${e(x.label)}"><span class="jp-scene-i">${glyph(x.icon)}</span>${size === "md" ? `<span class="jp-scene-l">${e(x.label)}</span>` : ""}</span>`)
    .join("")}</figure>`;
}

export const EMOTION: Record<number, [string, keyof typeof ICON, string]> = {
  [-2]: ["Distressed", "frown", "rose"],
  [-1]: ["Worried", "frown", "amber"],
  [0]: ["Neutral", "meh", "slate"],
  [1]: ["Reassured", "smile", "emerald"],
  [2]: ["Delighted", "laugh", "emerald2"],
};
export function emotionBadge(v: number | undefined): string {
  if (v === undefined) return "";
  const [label, ic, tone] = EMOTION[v] ?? EMOTION[0]!;
  return `<span class="jp-emo jp-emo-${tone}" title="${label}">${icon(ic)}<span>${label}</span></span>`;
}

export const ext = (href: string, label: string, cls = "", attrs = ""): string =>
  `<a class="jp-ext${cls ? ` ${cls}` : ""}" href="${e(href)}"${attrs ? ` ${attrs}` : ""} target="_blank" rel="noopener noreferrer">${e(label)}${icon("ext")}</a>`;

/** A persona's IG page from a page at `siteRoot`: the ActorDefinition it plays, when the index lists it. */
export const personaHref = (corpus: JourneyCorpus, pr: WorkshopPresentation, siteRoot: string) => (p: PersonaView): string | undefined =>
  p.artifact ? artifactPage(corpus, pr, p.artifact, siteRoot) : undefined;

/** A persona's name, linked to its IG page when there is one. */
export function personaNameHtml(p: PersonaView, link?: (p: PersonaView) => string | undefined): string {
  const href = link?.(p);
  return href ? `<a href="${e(href)}" ${DAK_ATTR} title="${e(p.artifact ?? "")}">${e(p.name)}</a>` : e(p.name);
}

/** The width a drawing has at 100%: its root `<svg>`'s viewBox width, else its `width` in pixels. */
export function viewBoxWidth(svg: string): number | undefined {
  const tag = /<svg\b[^>]*>/.exec(svg)?.[0];
  if (tag === undefined) return undefined;
  const vb = /\sviewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)/.exec(tag);
  const w = vb ? Number(vb[1]) : Number(/\swidth="([\d.]+)(?:px)?"/.exec(tag)?.[1]);
  return Number.isFinite(w) && w > 0 ? Math.round(w) : undefined;
}

// ── links out: the site, the IG, the device demo ──────────────────────────

// The one resolver for an href a journey or a workshop names: `read.ts`.
export { fromSite, siteRootFrom } from "./read.ts";

/** `{type}` and `{id}` filled into a page pattern. */
export const fillPattern = (pattern: string, v: { type?: string; id: string }): string => pattern.split("{type}").join(v.type ?? "").split("{id}").join(v.id);

/**
 * A heading's anchor as kramdown (Jekyll's Markdown, the IG Publisher's
 * pages) writes it: lower case, every character but a letter, a digit, a
 * space, `-` or `_` dropped, then each space a `-`. "J1 — Born abroad
 * (Thailand, birth day)" is `j1--born-abroad-thailand-birth-day`.
 */
export function kramdownSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/ /g, "-");
}

/** An example's page: the artifact index's own, else the IG's pattern. */
export function examplePage(corpus: JourneyCorpus, pr: WorkshopPresentation, key: string, siteRoot: string): string | undefined {
  const x = corpus.examples.get(key);
  if (x?.url) return x.url;
  // An index was read and does not list it: the IG has no page for it.
  if (x === undefined && corpus.examples.size > 0) return undefined;
  const [type, id] = key.split("/");
  if (!pr.ig || !type || !id) return undefined;
  return fromSite(`${pr.ig.href}${fillPattern(pr.ig.example ?? "{type}-{id}.html", { type, id })}`, siteRoot);
}

/** A profile's page, by StructureDefinition id (or a canonical's last segment), in the IG. */
export function profilePage(pr: WorkshopPresentation, profile: string, siteRoot: string, corpus?: JourneyCorpus): string | undefined {
  if (!pr.ig) return undefined;
  const id = profile.replace(/.*\//, "");
  // An index was read and lists no such profile: the IG has no page for it.
  if (corpus && corpus.examples.size > 0 && !corpus.examples.has(`StructureDefinition/${id}`)) return undefined;
  return fromSite(`${pr.ig.href}${fillPattern(pr.ig.profile ?? "StructureDefinition-{id}.html", { id })}`, siteRoot);
}

const DAK_ICON: Record<DakGroup["rel"], IconName> = { data: "scroll", decides: "branch", measures: "chart", other: "file" };

/**
 * A step's DAK assets as one small row under the hood: "DAK", then each group
 * (Data, Decision logic, Indicators) with its assets as chips, each linked to
 * its page in the IG when the artefact index lists it. Empty for a step that
 * names none.
 */
export function dakRow(groups: readonly DakGroup[]): string {
  if (groups.length === 0) return "";
  const chip = (a: DakGroup["assets"][number]) => {
    const tip = e(a.description ? `${a.key} — ${a.description}` : a.key);
    return a.href
      ? `<a class="jp-dak-a" href="${e(a.href)}" ${DAK_ATTR} target="_blank" rel="noopener noreferrer" title="${tip}">${e(a.label)}</a>`
      : `<span class="jp-dak-a jp-dak-text" title="${tip}">${e(a.label)}</span>`;
  };
  const gs = groups
    .map((g) => `<div class="jp-dak-g" data-jp-dak-rel="${e(g.rel)}"><span class="jp-dak-l">${icon(DAK_ICON[g.rel])}${e(g.label)}</span><span class="jp-dak-as">${g.assets.map(chip).join("")}</span></div>`)
    .join("");
  return `<div class="jp-dak" data-jp-dak><span class="jp-label" title="The DAK assets this moment uses: its data sets, the decision tables that decide it, the indicators that measure it">DAK</span>${gs}</div>`;
}

/** The Device Demo's screens that show a step. */
export function screensFor(p: Presentation, s: PresentedStep): DemoScreen[] {
  return p.screens.filter((x) => x.steps.includes(s));
}

/** The glyph a screen's device is drawn with. */
export const deviceGlyph = (x: DemoScreen, cls = ""): string => glyph(DEVICE_GLYPH[x.device], cls);

/** The Device Demo's name on the frame: the workshop's word for it, else "Device Demo". */
export const demoLabel = (p: Presentation): string => p.w.workshop.presentation?.deviceDemo?.label ?? "Device Demo";

/** A framed screen's address in the layer's app. */
export function screenHref(pr: WorkshopPresentation, id: string, siteRoot: string): string | undefined {
  const d = pr.deviceDemo;
  if (!d) return undefined;
  return fromSite(`${d.href}${fillPattern(d.route ?? "#/demo/{id}", { id })}`, siteRoot);
}

/**
 * JSON as HTML with each token in a span (`jp-j-key`, `-str`, `-num`,
 * `-lit`, `-pun`), escaped: the payload drawer's syntax colouring, done once
 * at build so the page needs no highlighter. A view page's drawer loads the
 * JSON instead, and `assets/present.js` colours it with the same rule; the
 * two must agree (`journeys-viz.test.ts` checks they do).
 */
export function highlightJson(json: string): string {
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],])/g;
  let out = "";
  let last = 0;
  for (const m of json.matchAll(re)) {
    out += e(json.slice(last, m.index));
    if (m[1] !== undefined) out += m[2] !== undefined ? `<span class="jp-j-key">${e(m[1])}</span>${e(m[2])}` : `<span class="jp-j-str">${e(m[1])}</span>`;
    else if (m[3] !== undefined) out += `<span class="jp-j-num">${m[3]}</span>`;
    else if (m[4] !== undefined) out += `<span class="jp-j-lit">${m[4]}</span>`;
    else out += `<span class="jp-j-pun">${e(m[5]!)}</span>`;
    last = m.index! + m[0].length;
  }
  return out + e(json.slice(last));
}

// ── the frame ─────────────────────────────────────────────────────────────

export type View = "overview" | "walkthrough" | "personas" | "how" | "discuss" | "demo";

export interface FrameOpts {
  p: Presentation;
  /** From the page to the viewer's route root. */
  root: string;
  /** From the page to the workshop's directory. */
  toWorkshop: string;
  view: View;
  title: string;
  /** The presenter's note for this page. */
  note?: string;
  /** Where ← and → go. */
  prev?: string;
  next?: string;
  body: string;
  /** More for the `<head>` (a view's own stylesheet). */
  head?: string;
  /** More classes for the `<body>`. */
  bodyClass?: string;
  /** What sits under the page, fixed at the foot (the payload drawer). */
  foot?: string;
  /** A band under the app bar, above the presenter's note (the device demo's journey stages). */
  band?: string;
}

/** The step range and the scope: "J1 → J4.1 (Thailand ⇄ Lao PDR)". */
export function rangeLabel(steps: readonly { step: { id: string } }[], scope?: string): string {
  if (steps.length === 0) return scope ?? "";
  const first = steps[0]!.step.id;
  const last = steps[steps.length - 1]!.step.id;
  return `${first === last ? first : `${first} → ${last}`}${scope ? ` (${scope})` : ""}`;
}

/**
 * Give every section heading of a view (`h2`–`h4`) that has no `id` one, from
 * its text, so a section can be linked to (owner, 2026-11-11: "sections and
 * steps need anchors"). Unique on the page: a slug already used, by another
 * heading or any other element, takes `-2`, `-3`… Deterministic.
 */
export function anchorHeadings(html: string): string {
  const used = new Set([...html.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]!));
  return html.replace(/<(h[234])(\s[^>]*)?>([\s\S]*?)<\/\1>/g, (all, tag: string, attrs: string | undefined, inner: string) => {
    if (attrs && /\sid=/.test(attrs)) return all;
    const text = inner
      .replace(/<[^>]*>/g, " ")
      .replace(/&[a-z]+;|&#\d+;/gi, " ")
      .toLowerCase();
    const slug = text.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "section";
    let id = slug;
    for (let n = 2; used.has(id); n++) id = `${slug}-${n}`;
    used.add(id);
    return `<${tag} id="${id}"${attrs ?? ""}>${inner}</${tag}>`;
  });
}

/**
 * The fictional countries the workshop's journeys are set in, in order, once
 * each: the names a room may rename to its own (owner, 2026-11-17). The
 * architecture panel's country labels when the workshop declares them, since
 * those are the countries; otherwise the chapters' `country`, which may also
 * name a setting that is no country ("Cross-Border").
 */
export function countriesOf(p: Presentation): string[] {
  const out: string[] = [];
  const add = (c: string | undefined) => {
    if (c && !out.includes(c)) out.push(c);
  };
  const declared = p.w.workshop.presentation?.architecture?.countries ?? [];
  if (declared.length) for (const c of declared) add(c.label);
  else for (const c of p.chapters) add(c.journey.scenario.country);
  return out;
}

/** Where a room's own name for a country is kept (`jv:` + this). */
export const countryKey = (workshop: string, name: string): string => `${workshop}:country:${name.normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "x"}`;

/** The countries' block every frame page carries: present.js puts the room's names in place of these throughout the page's text. */
function countriesBlock(p: Presentation): string {
  const names = countriesOf(p);
  if (!names.length) return "";
  return `<script type="application/json" id="jp-countries">${JSON.stringify(names.map((n) => ({ name: n, key: countryKey(p.w.workshop.id, n) }))).replace(/</g, "\\u003c")}</script>`;
}

/** The overview's renaming panel: a box per fictional country, kept in the browser, applied on every page. */
function countriesPanel(p: Presentation): string {
  const names = countriesOf(p);
  if (!names.length) return "";
  return `<section class="jp-card jp-pad jp-countries" id="your-countries"><h3 class="jp-h">${icon("globe", "jp-sky")} Make it your countries</h3><p class="jp-small">The journeys are set in fictional countries. Give each one the name of a country at your table: the new names replace the old ones throughout the journeys’ text, in this browser only.</p><div class="jp-countries-in">${names
    .map((n) => `<label><span>${e(n)}</span><input type="text" class="jp-answer" name="${e(countryKey(p.w.workshop.id, n))}" data-jv-text data-jp-country="${e(n)}" placeholder="${e(n)}" aria-label="${e(`Our name for ${n}`)}"></label>`)
    .join("")}</div></section>`;
}

export function frame(o: FrameOpts): string {
  const ws = o.p.w.workshop;
  const pr = ws.presentation ?? {};
  const name = pr.name ?? ws.title;
  const firstJourney = o.p.chapters[0]?.journey;
  const tabs: { id: View; label: string; hint: string; ic: keyof typeof ICON; href?: string }[] = [
    { id: "overview", label: "Overview", hint: "The story & the cast", ic: "compass", href: `${o.toWorkshop}overview/` },
    { id: "walkthrough", label: "Walkthrough", hint: "Present one moment at a time", ic: "present", href: o.p.steps[0] ? `${o.toWorkshop}walkthrough/${o.p.steps[0].key}/` : undefined },
    { id: "personas", label: "Persona lens", hint: "One person end-to-end", ic: "user", href: o.p.cast.length ? `${o.toWorkshop}personas/` : undefined },
    { id: "how", label: "How it works", hint: "Standards & tools behind each moment", ic: "cpu", href: `${o.toWorkshop}how/` },
    { id: "discuss", label: "Discussion", hint: "Policy questions to close", ic: "message", href: `${o.toWorkshop}discuss/` },
  ];
  void firstJourney;
  const nav = tabs
    .map((t) => {
      const cur = t.id === o.view;
      const inner = `${icon(t.ic)}<span><b>${e(t.label)}</b><small>${e(t.hint)}</small></span>`;
      if (t.href === undefined) return `<span class="jp-tab jp-tab-off" aria-disabled="true" title="Not drawn yet">${inner}</span>`;
      return `<a class="jp-tab${cur ? " is-on" : ""}" href="${e(t.href)}"${cur ? ' aria-current="page"' : ""}>${inner}</a>`;
    })
    .join("");
  const frameLinks = (pr.links ?? []).filter((l) => l.frame);
  const links = frameLinks
    .map((l, i) => `<a class="jp-btn-link${i === 0 ? " jp-btn-ig" : ""}" href="${e(l.href)}" target="_blank" rel="noopener noreferrer">${icon(i === 0 ? "book" : "code")}<span>${e(l.frame!)}</span></a>`)
    .join("");
  const range = rangeLabel(o.p.steps, pr.scope);
  const html = `<!doctype html>
<html lang="en" data-presenter="off">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(o.title)}</title>
${NAVBAR_OPT_OUT}
<link rel="stylesheet" href="${o.root}assets/present.css">
<script>try{if(localStorage.getItem("jp:presenter")==="on")document.documentElement.setAttribute("data-presenter","on")}catch(_){}</script>
<script src="${o.root}assets/present.js" defer></script>
${panelHead(o.body, `${o.root}assets/`)}
${o.head ?? ""}
${o.prev ? `<link rel="prev" href="${e(o.prev)}">` : ""}${o.next ? `<link rel="next" href="${e(o.next)}">` : ""}
${countriesBlock(o.p)}
</head>
<body class="jp jp-${o.view}${o.bodyClass ? ` ${o.bodyClass}` : ""}">
<header class="jp-head">
<div class="jp-top">
<div class="jp-top-l">${pr.occasion ? `<span class="jp-occasion">${icon("globe")}<span>${e(pr.occasion)}</span></span><span class="jp-bar">|</span>` : ""}<span>${e(pr.subject ?? ws.title)}</span>${range ? `<span class="jp-range">${e(range)}</span>` : ""}</div>
<div class="jp-top-r"><!--jv-langs-->${pr.status ? `<span class="jp-status"><i></i>${e(pr.status)}</span>` : ""}<button type="button" class="jp-presenter-btn" data-jp-presenter title="Show or hide the presenter's notes">${icon("eye")}<span class="jp-on-only">Presenter Mode: ON</span><span class="jp-off-only">Presenter Notes</span></button></div>
</div>
<div class="jp-app">
<div class="jp-brand"><span class="jp-logo" aria-hidden="true">${e(name.trim().charAt(0).toUpperCase())}</span><div><div class="jp-brand-name"><span class="jp-name">${e(name)}</span>${pr.badge ? `<span class="jp-badge">${e(pr.badge)}</span>` : ""}</div>${pr.tagline ? `<p class="jp-tagline">${e(pr.tagline)}</p>` : ""}</div></div>
<div class="jp-mode"><a${o.view === "demo" ? "" : ' class="is-on"'} href="${e(`${o.toWorkshop}overview/`)}">${icon("route", "jp-rose")}<span>Journeys</span></a>${
    o.p.screens.length
      ? `<a${o.view === "demo" ? ' class="is-on" aria-current="page"' : ""} href="${e(`${o.toWorkshop}demo/`)}">${icon("phone", "jp-sky")}<span>${e(demoLabel(o.p))}</span></a>`
      : `<span class="jp-mode-off" aria-disabled="true" title="No device screen shows a step of this workshop">${icon("phone", "jp-sky")}<span>Device Demo</span></span>`
  }</div>
<div class="jp-links">${links}<button type="button" class="jp-btn-link jp-reset jp-presenter-only" data-jp-reset="${e(ws.id)}" data-jp-reset-to="${e(`${o.toWorkshop}overview/`)}" title="Forget this workshop's answers and the presenter's choices in this browser, and go back to the overview">${icon("reset")}<span>Reset Simulation</span></button></div>
</div>
</header>
${o.band ?? ""}
${o.note ? `<div class="jp-note jp-presenter-only"><div><span class="jp-note-tag">PRESENTER NOTE</span><span>${e(o.note)}</span></div><button type="button" data-jp-dismiss>Dismiss</button></div>` : ""}
<main class="jp-main"><div class="jp-wrap">
${o.view === "demo" ? "" : `<nav class="jp-tabs" aria-label="Views">${nav}</nav>`}
${anchorHeadings(o.body.trim())}
</div></main>
${o.foot ?? ""}
<footer class="jp-foot">Drawn by the journeys viewer from the ${o.view === "demo" && o.p.demo === "screens" ? "<code>workshop</code>, <code>user-scenario</code> and <code>device-screen</code>" : "<code>workshop</code> and <code>user-scenario</code>"} nodes of ${e(o.p.w.instance)}. Every person is fictional.</footer>
</body>
</html>
`;
  return withRenderedBy(html.split(ROOT_MARK).join(o.root), TOOL_ID);
}

// ── the record's trust ladder ─────────────────────────────────────────────

export type Ladder = { code: string; label: string; definition?: string }[];

export function ladderOf(corpus: JourneyCorpus, j: Journey): Ladder | undefined {
  return j.scenario.trustLadder ? lookup(corpus.ladders, j.instance, j.scenario.trustLadder) : undefined;
}

/** The rung a step's record reaches, from 0; -1 when it names none or its state is not on the ladder. */
export function rungOf(ladder: Ladder | undefined, step: ScenarioStep): number {
  return ladder && step.record ? ladder.findIndex((c) => c.code === step.record!.state) : -1;
}

const TRUST = ["#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#0f172a"];
/** The neutral ramp of a rung, light to dark as trust grows (VaxLink `trustColor`). */
export const trustColor = (rung: number, of: number): string => TRUST[Math.round((rung / Math.max(1, of - 1)) * (TRUST.length - 1))] ?? TRUST[TRUST.length - 1]!;

export function meter(ladder: Ladder, level: number): string {
  return `<div class="jp-meter"><div class="jp-meter-bars">${ladder.map((r, i) => `<i style="${i <= level ? `background:${trustColor(i, ladder.length)}` : ""}" title="${e(`${r.label}: ${r.definition ?? ""}`)}"></i>`).join("")}</div><div class="jp-meter-labels">${ladder.map((r, i) => `<span${i === level ? ' class="is-on"' : ""}>${e(r.label)}</span>`).join("")}</div></div>`;
}

// ── the overview ──────────────────────────────────────────────────────────

export function pictureOf(corpus: JourneyCorpus, s: PresentedStep, root: string): string {
  const at = illustrationPath(corpus, s.journey, s.step);
  if (at === undefined) return "";
  const alt = s.step.illustration?.alt ?? "";
  return `<img class="jp-pic" src="${e(`${root}${s.journey.instance}/${s.journey.scenario.id}/${at.to}`)}" alt="${e(alt)}" title="${e(alt)}" loading="lazy">`;
}

/** A chapter's small picture: its own journey's `scene`, else the first of its steps' journeys that has one. */
export function chapterScene(c: Chapter): { icon: string; label: string }[] | undefined {
  return c.journey.scenario.scene ?? c.steps.find((s) => s.journey.scenario.scene)?.journey.scenario.scene;
}

/**
 * The hero's sentence when the workshop gives no `presentation.story`: the
 * first sentence of its description's first paragraph, as plain text. Never
 * the whole description, which is Markdown (headings, tables) and would be
 * drawn as one heading.
 */
export function storyOf(description: string): string {
  const para =
    description
      .trim()
      .split(/\n\s*\n/)
      .find((b) => !/^\s*(#|\||[-*+] |\d+\. |>|```)/.test(b)) ?? "";
  const plain = para
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|`)(.+?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
  const first = plain.match(/^.+?[.!?](?=\s+[\p{Lu}\p{N}“"(]|$)/u)?.[0];
  return first ?? plain;
}

function overviewPage(corpus: JourneyCorpus, p: Presentation, links?: SiteLinks): string {
  const root = "../../../../";
  const pl = links ? personaHref(corpus, p.w.workshop.presentation ?? {}, siteRootFrom(root, links)) : undefined;
  const toWorkshop = "../";
  const ws = p.w.workshop;
  const pr = ws.presentation ?? {};
  const tones = countryTones(p.chapters.map((c) => c.journey.scenario.country));
  const chip = (country: string | undefined) => (country ? `<span class="jp-chip jp-chip-${tones.get(country)}">${e(country)}</span>` : "");
  const walk = (s: PresentedStep | undefined) => (s ? `../walkthrough/${s.key}/` : "#");
  const cards = p.chapters
    .map((c, i) => {
      const j = c.journey.scenario;
      const pic = c.steps.map((s) => pictureOf(corpus, s, root)).find(Boolean) ?? "";
      const scene = sceneStrip(chapterScene(c), tones.get(j.country ?? "") ?? "sky", "md");
      const people = p.cast.filter((x) => c.steps.some((s) => s.step.experiences.some((y) => y.actor === x.id)));
      return `<a class="jp-card jp-moment" href="${e(walk(c.steps[0]))}">${i < p.chapters.length - 1 ? `<span class="jp-moment-arrow">${icon("arrow")}</span>` : ""}
${pic}
<span class="jp-moment-top"><span class="jp-num">${i + 1}</span>${chip(j.country)}</span>
<span class="jp-moment-title">${e(c.title)}</span>
<span class="jp-moment-meta">${[j.when, j.where].filter(Boolean).map((x) => e(x!)).join(" · ")}</span>
<span class="jp-moment-sum">${e(j.description.replace(/\.md$/, ""))}</span>
<span class="jp-moment-foot">${scene}<span class="jp-stack">${people.map((x) => avatar(x, "sm")).join("")}</span></span>
</a>`;
    })
    .join("\n");
  const allLinks = pr.links ?? [];
  const band = pr.about
    ? `<section class="jp-card jp-band">${icon("book", "jp-sky jp-i-lg")}<div class="jp-band-text"><b>${e(pr.about.title)}</b>${pr.about.text ? `<p>${e(pr.about.text)}</p>` : ""}</div><div class="jp-band-links">${allLinks.map((l) => ext(l.href, l.label)).join("")}</div></section>`
    : "";
  const steps = p.steps.length;
  const castHtml = p.cast
    .map((x) => {
      const n = p.steps.filter((s) => s.step.experiences.some((y) => y.actor === x.id)).length;
      return `<div class="jp-person" style="--c:${e(x.color)}">${avatar(x)}<div><b>${personaNameHtml(x, pl)}</b><span class="jp-person-role">${[x.role, x.country].filter(Boolean).map((v) => e(v!)).join(" · ")}</span>${x.goal ? `<p>${e(x.goal)}</p>` : ""}<small>Appears in ${n} of ${steps} step${steps === 1 ? "" : "s"}</small></div></div>`;
    })
    .join("");
  const first = p.steps[0];
  const ladderJourney = p.steps.find((s) => ladderOf(corpus, s.journey))?.journey;
  const ladder = ladderJourney ? ladderOf(corpus, ladderJourney) : undefined;
  const ladderMeta = ladderJourney?.scenario.trustLadder ? corpus.ladderInfo.get(ladderJourney.instance)?.get(ladderJourney.scenario.trustLadder) : undefined;
  const ladderHtml = ladder
    ? `<section class="jp-card jp-pad jp-col-2"><h3 class="jp-h">${icon("package", "jp-emerald")} Follow the record</h3>${ladderMeta?.description ? `<p class="jp-small">${e(ladderMeta.description)}</p>` : ""}<ol class="jp-rungs">${ladder
        .map((r, level) => {
          const reached = p.steps.find((s) => rungOf(ladderOf(corpus, s.journey), s.step) === level);
          return `<li><span class="jp-rung" style="background:${trustColor(level, ladder.length)}">${level + 1}</span><div><b>${e(r.label)}</b>${r.definition ? `<span>${e(r.definition)}</span>` : ""}</div>${reached ? `<a href="../walkthrough/${e(reached.key)}/">${e(reached.step.id)}</a>` : ""}</li>`;
        })
        .join("")}</ol></section>`
    : "";
  const sched = scheduleFor(corpus, p.w);
  const calendar = sched ? `<div class="jp-card jp-pad jp-cal-wrap">${scheduleHtml({ corpus, here: p.w, owner: sched.owner, schedule: sched.schedule, toWorkshops: "../../", level: 3, md: mdHtml })}</div>` : "";
  // The schedule at a glance, first on the page (owner, 2026-11-19: "should be towards top"); the full calendar further down.
  const glance = sched ? scheduleGlanceHtml({ corpus, here: p.w, owner: sched.owner, schedule: sched.schedule, toWorkshops: "../../", level: 3, full: "#the-days" }) : "";
  const body = `${glance}<section class="jp-hero">
<div class="jp-hero-in">
<span class="jp-kicker">${icon("route")} The story in one sentence</span>
<h2>${e(pr.story ?? storyOf(ws.description))}</h2>
${pr.lede ? `<p>${e(pr.lede)}</p>` : ""}
<div class="jp-ctas">${first ? `<a class="jp-cta" href="${e(walk(first))}">${icon("play")} Start the walkthrough</a>` : ""}<a class="jp-cta jp-cta-2" href="../how/">See how it works ${icon("arrow")}</a></div>
</div>
</section>
<section class="jp-moments-sec">
<h3 class="jp-h">${e(countWord(p.chapters.length))} moment${p.chapters.length === 1 ? "" : "s"} that matter</h3>
<div class="jp-moments" style="--n:${Math.min(p.chapters.length, 4)}">${cards}</div>
</section>
${band}
<div class="jp-split">
<section class="jp-card jp-pad jp-col-3"><h3 class="jp-h">${icon("users", "jp-sky")} Meet the people</h3><div class="jp-people">${castHtml}</div></section>
${ladderHtml}
</div>
${calendar}
${countriesPanel(p)}`;
  return frame({
    p,
    root,
    toWorkshop,
    view: "overview",
    ...(calendar || glance ? { head: `<link rel="stylesheet" href="${root}assets/calendar.css">` } : {}),
    title: `${pr.name ?? ws.title} — overview`,
    ...(pr.presenterNote ? { note: pr.presenterNote } : {}),
    ...(first ? { next: walk(first) } : {}),
    body,
    foot: viewDrawer(corpus, p, stepsExampleKeys(p.steps), toWorkshop, links ? siteRootFrom(root, links) : root, undefined, "Overview"),
  });
}

// ── a walkthrough step ────────────────────────────────────────────────────

function progress(p: Presentation, s: PresentedStep, prev: string | undefined, next: string): string {
  const cols = p.chapters.map((c) => `${c.steps.length}fr`).join(" ");
  const chapters = p.chapters
    .map((c, ci) => {
      const dots = c.steps
        .map((x) => `<a href="../${e(x.key)}/" class="${x.index === s.index ? "is-on" : x.index < s.index ? "is-done" : ""}" aria-label="${e(`${x.step.id}: ${x.step.title}`)}" title="${e(`${x.step.id}: ${x.step.title}`)}"${x.index === s.index ? ' aria-current="step"' : ""}></a>`)
        .join("");
      return `<div><div class="jp-prog-label${ci === s.chapter ? " is-on" : ""}" title="${e(`${ci + 1}. ${c.title}`)}">${ci + 1}.<span> ${e(c.title)}</span></div><div class="jp-dots">${dots}</div></div>`;
    })
    .join("");
  const last = s.index === p.steps.length - 1;
  return `<div class="jp-card jp-prog">
${prev ? `<a class="jp-pbtn" href="${e(prev)}" aria-label="Previous moment">${icon("left")}</a>` : `<span class="jp-pbtn is-off" aria-hidden="true">${icon("left")}</span>`}
<div class="jp-prog-grid" style="grid-template-columns:${cols}">${chapters}</div>
<span class="jp-keys jp-presenter-only">${icon("keyboard")} ← → · W · T</span>
<a class="jp-pbtn jp-pbtn-next" href="${e(next)}" aria-label="${last ? "Go to discussion" : "Next moment"}" title="${last ? "Go to discussion" : "Next moment"}">${last ? "<span>Discuss</span>" : ""}${icon("right")}</a>
</div>`;
}

/**
 * A question's identity within its workshop step: `id` when the workshop names
 * one, else a hash of its text (case, spacing and punctuation aside). Never its
 * position, so adding or reordering questions moves no answer.
 */
export function questionId(q: { id?: string; text: string }): string {
  if (q.id) return q.id;
  const norm = q.text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  let h = 0x811c9dc5;
  for (let k = 0; k < norm.length; k++) h = Math.imul(h ^ norm.charCodeAt(k), 0x01000193) >>> 0;
  return `t${h.toString(36)}`;
}

/**
 * Where a table's answer to a step's question is kept (`jv:` + this, in the
 * browser): one key wherever the question is shown — its walkthrough step and
 * every lab step of the Discussion view that lists its module. Keyed by the
 * workshop, the journey and step the question belongs to, and the question's
 * own identity (`questionId`), never by page or position.
 */
export function questionKey(workshop: string, ws: WorkshopStep, q: { id?: string; text: string; canvas?: string }): string {
  // A question that is a canvas field keeps its answer under the field's key (`canvas-form.ts`).
  return q.canvas ? `${workshop}:cv:${q.canvas}` : ownQuestionKey(workshop, ws, q);
}

/** A question's own key, whether or not it names a canvas field: where its answer was kept before it did. */
export function ownQuestionKey(workshop: string, ws: WorkshopStep, q: { id?: string; text: string }): string {
  return `${workshop}:q:${ws.scenario}:${ws.step}:${questionId(q)}`;
}

/** The keys an answer may have been kept under before, space-separated, for `data-jv-was`. */
export function earlierKeys(workshop: string, ws: WorkshopStep, q: { id?: string; text: string; canvas?: string }, legacy?: string): string {
  return [q.canvas ? ownQuestionKey(workshop, ws, q) : undefined, legacy].filter(Boolean).join(" ");
}

/**
 * The key the same answer was kept under before (2026-11): the step's URL
 * segment and the question's position. present.js moves an answer kept there
 * to `questionKey` the first time the question is shown.
 */
export function legacyQuestionKey(workshop: string, s: PresentedStep, i: number): string {
  return `${workshop}:q:${s.key}:${i}`;
}

/** A write-in kept in the browser under `name` (present.js, `data-jv-text`); `value` is its text until the table writes its own. */
export function answerBox(name: string, label: string, lines = 2, value = "", was?: string): string {
  return `<textarea class="jp-answer" name="${e(name)}" rows="${lines}" data-jv-text${was ? ` data-jv-was="${e(was)}"` : ""} aria-label="${e(`Our answer: ${label}`)}" placeholder="Our answer…">${e(value)}</textarea>`;
}

/**
 * What a walkthrough step shows below the journey, in one of two views (owner,
 * 2026-11-17): **Policy** (the questions for the table, the tables the moment
 * touches, the gap strip) or **Technical** (under the hood: the standards,
 * data, logic and processes). A toggle switches them; Policy shows first, and
 * a browser that last chose Technical (`jp:hood = "on"`, also the T key) gets
 * that. A step with nothing for the table has only the technical toggle.
 */
function belowTheJourney(policy: string, technical: string): string {
  if (!policy) {
    return `<div class="jp-hood-toggle"><i></i><button type="button" data-jp-hood-toggle aria-controls="hood" aria-expanded="false">${icon("cpu")}<span class="jp-hood-hide">Hide the technical view</span><span class="jp-hood-show">Show the technical view</span></button><i></i></div>
${technical}`;
  }
  return `<div class="jp-lens jp-noprint" role="tablist" aria-label="Below the journey"><i></i><span class="jp-lens-in"><button type="button" role="tab" id="lens-policy" class="is-on" data-jp-lens="policy" aria-controls="policy" aria-selected="true">${icon("landmark")}<span>Policy view</span></button><button type="button" role="tab" id="lens-technical" data-jp-lens="technical" aria-controls="hood" aria-selected="false">${icon("cpu")}<span>Technical view</span></button></span><i></i></div>
<div class="jp-lens-pane" id="policy" role="tabpanel" aria-labelledby="lens-policy" data-jp-policy>${policy}</div>
${technical.replace('<section class="jp-hood" id="hood" data-jp-hood hidden>', '<section class="jp-hood" id="hood" role="tabpanel" aria-labelledby="lens-technical" data-jp-hood hidden>')}`;
}

function policyPanel(p: Presentation, s: PresentedStep, toWorkshop: string): string {
  const ws = s.ws;
  if (!ws) return "";
  const w = p.w.workshop;
  const mod = (id: string) => w.modules.find((m) => m.id === id);
  // Each question has a write-in: the same answer the Discussion view's lab shows, under one key per question (`questionKey`).
  const qs = (ws.questions ?? [])
    .map((q, i) => `<li><a class="jp-mod" href="${e(`${toWorkshop}${moduleSegment(q.module)}/`)}" title="${e(mod(q.module)?.title ?? q.module)}">${e(q.module)}</a><span>${e(q.text)}</span>${answerBox(questionKey(w.id, ws, q), q.text, 2, "", earlierKeys(w.id, ws, q, legacyQuestionKey(w.id, s, i)))}</li>`)
    .join("");
  // The rows of the card's foot: the workshop's `tagRows` (VaxLink's Forces / Cost driver /
  // If it is missing), else one row per table the step touches, in the workshop's table order.
  const groups: { label: string; icon?: string; tables: string[] }[] =
    w.presentation?.tagRows ?? (w.tables ?? []).map((t) => ({ label: t.title, tables: [t.id] }));
  const rows = groups
    .map((gr) => {
      const tags = gr.tables.flatMap((id) => (ws.tags ?? []).filter((g) => g.table === id));
      if (tags.length === 0) return "";
      const why = tags.find((g) => g.why);
      const chips = tags
        .map((g) => {
          const r = w.tables?.find((t) => t.id === g.table)?.rows.find((x) => x.id === g.row);
          return `<span class="jp-pill" title="${e(r?.question ?? r?.what ?? "")}">${e(r?.label ?? g.row)}${g.why ? " ★" : ""}</span>`;
        })
        .join("");
      return `<div><dt>${gr.icon ? glyph(gr.icon) : ""}${e(gr.label)}</dt><dd>${chips}${why ? `<span class="jp-why">— ${e(why.why!)}</span>` : ""}</dd></div>`;
    })
    .join("");
  const scales = w.assessment?.scales ?? [];
  const caps = (ws.capabilities ?? [])
    .map((c) => {
      const groups = scales
        .map((sc, si) => {
          const key = `${w.id}:${c.id}:${sc.id}`;
          return `<div class="jp-choices${si > 0 ? " jp-choices-more" : ""}" role="radiogroup" aria-label="${e(`${c.label}: ${sc.label}`)}">${sc.options
            .map((o, oi) => `<label class="jp-choice jp-choice-${oi}"><input type="radio" name="${e(key)}" value="${e(o.id)}" data-jv-store${oi === 0 ? ' class="jp-first"' : ""}><span>${e(o.label)}</span></label>`)
            .join("")}</div>`;
        })
        .join("");
      return `<div class="jp-cap"><div class="jp-cap-label">${e(c.label)}</div>${groups}</div>`;
    })
    .join("");
  if (!qs && !rows && !caps) return "";
  return `<section class="jp-card jp-pad jp-tone-indigo jp-policy">
${qs ? `<h3 class="jp-h jp-indigo">${icon("scroll")} Policy questions for the table</h3><ol class="jp-qs">${qs}</ol>` : ""}
${rows ? `<dl class="jp-forces">${rows}</dl>` : ""}
${caps ? `<div class="jp-gap"><h4 class="jp-h">${icon("clipboard", "jp-indigo")} Gap strip: what this moment needs, in your country</h4>${caps}${w.assessment?.standingLine ? `<p class="jp-standing">${e(w.assessment.standingLine)}</p>` : ""}</div>` : ""}
</section>`;
}

/**
 * The IG's own pages for a step's process: its section of the business
 * processes page (anchored by the BPMN process's name, as kramdown writes a
 * heading), and the journey's `references` with `rel: "scenario"`.
 */
/** A process's section in the IG's business-process page, from a page at `siteRoot`: undefined when the workshop names no such page. */
export function igProcessPage(corpus: JourneyCorpus, pr: WorkshopPresentation | undefined, instance: string, process: string, siteRoot: string): string | undefined {
  if (!pr?.ig?.processes) return undefined;
  const name = processName(corpus, instance, process);
  return `${fromSite(`${pr.ig.href}${pr.ig.processes}`, siteRoot)}${name ? `#${kramdownSlug(name)}` : ""}`;
}

export function processLinks(corpus: JourneyCorpus, pr: WorkshopPresentation, j: Journey, process: string, siteRoot: string): string {
  const out: string[] = [];
  const name = processName(corpus, j.instance, process);
  if (pr.ig?.processes) out.push(ext(`${fromSite(`${pr.ig.href}${pr.ig.processes}`, siteRoot)}${name ? `#${kramdownSlug(name)}` : ""}`, "Process in the IG", "", DAK_ATTR));
  for (const r of j.scenario.references ?? []) if (r.rel === "scenario") out.push(ext(fromSite(r.href, siteRoot), r.label));
  return out.join("");
}

/** The FHIR examples a step names, its own and its FHIR changes', once each, in order. */
export function stepExampleKeys(st: ScenarioStep): string[] {
  return [...new Set([...(st.examples ?? []), ...(st.fhirChanges ?? []).flatMap((c) => c.examples ?? [])])];
}

/** Where a view page loads a FHIR example's JSON from: one file per example, under the workshop's `payload/`, coloured by `present.js` as {@link highlightJson} colours it. */
export function payloadFile(key: string): string {
  return `payload/${key.replace("/", "-")}.json`;
}

export interface DrawerOpts {
  /** The example's page in the IG, when there is one. */
  pageOf?: (key: string) => string | undefined;
  /** What the count says the resources belong to: "at this moment", "on this screen", "in this view". */
  scope: string;
  /**
   * From the page to the workshop's directory. Given, each pane loads its
   * JSON from the shared {@link payloadFile} on first show instead of
   * carrying it, so a view page stays small however many moments it spans.
   */
  toWorkshop?: string;
  /** The bar's "Active Stage" chip: the step, the screen or the view the page shows. */
  stage?: string;
  /** The workshop's own words for the bar (`presentation.inspector`). */
  inspector?: WorkshopPresentation["inspector"];
}

/** A FHIR payload drawer: each example of `keys` whose JSON this build has, highlighted, with a copy button. Empty when none has JSON. */
export function drawerFor(corpus: JourneyCorpus, keys: readonly string[], o: DrawerOpts): string {
  const shown = [...new Set(keys)].filter((k) => corpus.examples.get(k)?.json);
  if (shown.length === 0) return "";
  const tabs = shown.map((k, i) => `<button type="button" role="tab" data-jp-tab="${e(k)}" aria-selected="${i === 0}"${i === 0 ? ' class="is-on"' : ""}>${e(k)}</button>`).join("");
  const code = (k: string) =>
    o.toWorkshop === undefined
      ? `<pre class="jp-json"><code>${highlightJson(corpus.examples.get(k)!.json!)}</code></pre>`
      : `<pre class="jp-json" data-jp-src="${e(o.toWorkshop + payloadFile(k))}"><code>Loading ${e(k)}…</code></pre>`;
  const panes = shown
    .map((k, i) => {
      const page = o.pageOf?.(k);
      return `<div class="jp-pane" role="tabpanel" data-jp-pane="${e(k)}"${i === 0 ? "" : " hidden"}>${page ? `<p class="jp-pane-link">${ext(page, `${k} in the IG`, "", DAK_ATTR)}</p>` : ""}${code(k)}</div>`;
    })
    .join("");
  return `<aside class="jp-drawer" data-jp-drawer aria-label="FHIR payload inspector">
<button type="button" class="jp-drawer-bar" data-jp-drawer-toggle aria-expanded="false" title="${e(`${shown.length} resource${shown.length === 1 ? "" : "s"} ${o.scope}`)}">${icon("code", "jp-sky3")}<b>${e(o.inspector?.title ?? "FHIR payload inspector")}</b>${o.stage ? `<span class="jp-drawer-chip">Active Stage: ${e(o.stage)}</span>` : ""}${o.inspector?.key ? `<span class="jp-drawer-key">${glyph("shield-check")}${e(o.inspector.key)}</span>` : ""}<span class="jp-drawer-n">${shown.length} resource${shown.length === 1 ? "" : "s"} ${e(o.scope)}</span><span class="jp-drawer-hint">${e(o.inspector?.hint ?? "Click to inspect the raw FHIR payload")}${icon("up")}</span></button>
<div class="jp-drawer-body" hidden><div class="jp-drawer-tabs" role="tablist">${tabs}<button type="button" class="jp-copy" data-jp-copy>Copy</button></div>${panes}</div>
</aside>`;
}

/** The FHIR payload drawer of a step: every example it names whose JSON this build has, highlighted, with a copy button. */
export function payloadDrawer(corpus: JourneyCorpus, st: ScenarioStep, pageOf?: (key: string) => string | undefined, inspector?: WorkshopPresentation["inspector"]): string {
  return drawerFor(corpus, stepExampleKeys(st), { scope: "at this moment", stage: st.id, ...(pageOf ? { pageOf } : {}), ...(inspector ? { inspector } : {}) });
}

/** A view's drawer: the examples of the steps it spans, loaded from the shared payload files. */
export function viewDrawer(corpus: JourneyCorpus, p: Presentation, keys: readonly string[], toWorkshop: string, siteRoot: string, scope = "in this view", stage?: string): string {
  const pr = p.w.workshop.presentation ?? {};
  return drawerFor(corpus, keys, { scope, toWorkshop, pageOf: (k) => artifactPage(corpus, pr, k, siteRoot), ...(stage ? { stage } : {}), ...(pr.inspector ? { inspector: pr.inspector } : {}) });
}

/** The examples of a run of steps, once each, in step order. */
export function stepsExampleKeys(steps: readonly PresentedStep[]): string[] {
  return [...new Set(steps.flatMap((s) => stepExampleKeys(s.step)))];
}

function hood(corpus: JourneyCorpus, p: Presentation, s: PresentedStep, links: SiteLinks, root: string): string {
  const st = s.step;
  const lead = p.cast.find((x) => x.id === st.lead);
  const leadDoing = st.experiences.find((x) => x.actor === st.lead)?.doing;
  const catalogue = corpus.blocks.get(s.journey.instance) ?? [...corpus.blocks.values()][0];
  const uses = (st.uses ?? []).map((u) => ({ u, b: blockFor(corpus, s.journey.instance, u.block) }));
  const layers = catalogue?.layers ?? [];
  const layerRows = layers
    .map((l, li) => {
      const tone = LAYER_TONES[li % LAYER_TONES.length];
      const here = uses.filter((x) => x.b?.block.layer === l.id);
      const cells = here.length
        ? here
            .map(({ u, b }) => {
              const first = b!.block.links?.[0];
              const inner = `<b>${e(b!.block.short ?? b!.block.name)}</b><span>${e(u.role)}</span>`;
              return first ? `<a class="jp-block" href="${e(first.url)}" target="_blank" rel="noopener noreferrer" title="${e(`${b!.block.name}: ${b!.block.what}`)}">${inner}</a>` : `<span class="jp-block" title="${e(`${b!.block.name}: ${b!.block.what}`)}">${inner}</span>`;
            })
            .join("")
        : `<span class="jp-none">Not involved at this moment</span>`;
      return `<div class="jp-layer jp-layer-${tone}"><div class="jp-layer-h"><b>${e(l.label)}</b>${l.question ? `<span>${e(l.question)}</span>` : ""}</div><div class="jp-layer-cells">${cells}</div></div>`;
    })
    .join("");
  const unplaced = uses.filter((x) => x.b === undefined || !layers.some((l) => l.id === x.b!.block.layer));
  const unplacedHtml = unplaced.length
    ? `<div class="jp-layer jp-layer-slate"><div class="jp-layer-h"><b>Other</b><span>Not in a catalogue layer</span></div><div class="jp-layer-cells">${unplaced.map(({ u, b }) => `<span class="jp-block${b ? "" : " jp-unresolved"}"><b>${e(b?.block.short ?? b?.block.name ?? u.block)}</b><span>${e(u.role)}</span></span>`).join("")}</div></div>`
    : "";
  const who = (id: string | undefined) => (id ? (p.cast.find((x) => x.id === id)?.name ?? lookup(corpus.actors, s.journey.instance, id)?.title ?? id) : undefined);
  const h = st.handoff;
  /** A hand-off end that is somebody of the cast wears their avatar. */
  const end = (id: string | undefined) => {
    const pv = id ? p.cast.find((x) => x.id === id) : undefined;
    return pv ? avatar(pv, "sm") : "";
  };
  const handoff = h
    ? `<div class="jp-box"><div class="jp-box-h"><span class="jp-label">Data hand-off</span>${h.offline !== undefined ? `<span class="jp-net ${h.offline ? "is-off" : "is-on"}">${icon(h.offline ? "wifioff" : "wifi")}${h.offline ? "Works offline" : "Online"}</span>` : ""}</div>
<div class="jp-flow">${who(h.from) ? `<span class="jp-end">${end(h.from)}${e(who(h.from)!)}</span>` : ""}<div class="jp-flow-mid"><span>${e(h.carrier ?? h.summary)}</span><i></i></div>${who(h.to) ? `<span class="jp-end">${end(h.to)}${e(who(h.to)!)}</span>` : ""}</div>
${h.payload ? `<div class="jp-payload">${e(h.payload)}</div>` : ""}</div>`
    : "";
  const pr = p.w.workshop.presentation ?? {};
  const siteRoot = siteRootFrom(root, links);
  const changes = st.fhirChanges ?? [];
  const examples = st.examples ?? [];
  const inspect = (k: string | undefined) => (k && corpus.examples.get(k)?.json ? `<button type="button" class="jp-inspect" data-jp-inspect="${e(k)}">Inspect JSON</button>` : "");
  const exLink = (k: string, label: string) => {
    const href = examplePage(corpus, pr, k, siteRoot);
    return href ? ext(href, label, "jp-exlabel", `${DAK_ATTR} title="${e(k)}"`) : `<span class="jp-small jp-exlabel" title="${e(k)}">${e(label)}</span>`;
  };
  // An example reads as words, as VaxLink's do: its title in the artifact index, else its id.
  const exLabel = (k: string) => corpus.examples.get(k)?.title ?? k.split("/")[1] ?? k;
  const profileChip = (profile: string | undefined, of?: string) => {
    if (!profile) return "";
    const href = profilePage(pr, profile, siteRoot, corpus);
    const label = of ? `${of} profile` : "Profile";
    return href ? `<a class="jp-prof" href="${e(href)}" ${DAK_ATTR} target="_blank" rel="noopener noreferrer" title="${e(profile)}">${e(label)}</a>` : `<span class="jp-prof" title="${e(profile)}">${e(label)}</span>`;
  };
  const rows = changes.length
    ? changes.map((c) => {
        const first = c.examples?.[0];
        const head = first && examplePage(corpus, pr, first, siteRoot) ? `<a class="jp-mono" href="${e(examplePage(corpus, pr, first, siteRoot)!)}" ${DAK_ATTR} target="_blank" rel="noopener noreferrer">${e(c.resource)}</a>` : `<span class="jp-mono">${e(c.resource)}</span>`;
        const json = (c.examples ?? []).find((k) => corpus.examples.get(k)?.json);
        const more = [...(c.examples ?? []).map((k) => exLink(k, exLabel(k))), c.spec ? ext(c.spec, "base standard", "jp-ext-soft") : ""].filter(Boolean).join("");
        return `<li>${icon("file", "jp-sky")}<div><div class="jp-fhir-row">${head}${profileChip(c.profile, c.profileOf)}<span class="jp-fhir-change">${e(c.change)}</span>${inspect(json)}</div>${c.why ? `<p class="jp-fhir-why">${e(c.why)}</p>` : ""}${more ? `<div class="jp-fhir-links">${more}</div>` : ""}</div></li>`;
      })
    : examples.map((k) => {
        const x = corpus.examples.get(k);
        const [type] = k.split("/");
        const href = examplePage(corpus, pr, k, siteRoot);
        return `<li>${icon("file", "jp-sky")}<div><div class="jp-fhir-row">${href ? `<a href="${e(href)}" class="jp-mono" ${DAK_ATTR} target="_blank" rel="noopener noreferrer">${e(type!)}</a>` : `<span class="jp-mono">${e(type!)}</span>`}${profileChip(x?.profiles?.[0])}<span class="jp-fhir-id">${e(x?.title ?? k)}</span>${inspect(k)}</div></div></li>`;
      });
  const fhir = `<div class="jp-box"><div class="jp-box-h"><span class="jp-label">FHIR resources created or changed</span></div>${
    rows.length ? `<ul class="jp-fhir">${rows.join("")}</ul>` : `<p class="jp-small">None: this moment reads data but writes nothing.</p>`
  }</div>`;
  const dak = dakRow(dakGroups(corpus, pr, st.dak, siteRoot));
  const toSite = root + "../".repeat(links.route.split("/").length);
  const procPage = links.processesPage?.(s.journey.instance)?.replace(/^(\.\.\/)+/, "");
  const procs = (st.realisedBy ?? [])
    .map((r) => {
      const d = linkedProcessDrawing(corpus, links, s.journey.instance, r.process, siteRoot, igProcessPage(corpus, pr, s.journey.instance, r.process, siteRoot));
      const src = sourceHref(corpus, s.journey.instance, r.process);
      const head = `<div class="jp-proc-h">${icon("workflow")}<span class="jp-label">Business process (BPMN)</span><span class="jp-small">${e(s.journey.scenario.title)}</span></div>
<div class="jp-proc-links">${processLinks(corpus, pr, s.journey, r.process, siteRoot)}${procPage ? `<a href="${e(toSite + procPage)}">Process viewer (tasks and skills)</a>` : ""}<a href="${e(`${root}${s.journey.instance}/${s.journey.scenario.id}/`)}">User scenario</a>${src ? ext(src, "BPMN source") : ""}</div>`;
      const zoom = `<div class="jp-zoom" role="group" aria-label="Zoom"><button type="button" data-jp-zoom="fit">Fit</button><button type="button" data-jp-zoom="1" class="is-on">100%</button><button type="button" data-jp-zoom="1.5">150%</button><button type="button" data-jp-zoom="2">200%</button><button type="button" data-jp-zoom="full">Full screen</button></div>`;
      const caption = `<code>${e(r.process)}</code>${r.tasks?.length ? ` · ${r.tasks.length} flow node${r.tasks.length === 1 ? "" : "s"} highlighted` : " · the whole process"}`;
      const vw = d ? viewBoxWidth(d.svg) : undefined;
      const panel = links.processPanel?.(s.journey.instance, r.process);
      const fig = d ? bpmnFigure(d.svg, r.tasks, caption, panel === undefined ? undefined : fromSite(panel, toSite)).replace("<figure ", `<figure${vw ? ` style="--vw:${vw}px"` : ""} `) : "";
      return `<div class="jp-box jp-proc">${head}${d ? `${zoom}${fig}` : `<p class="jp-small jp-unresolved">No drawing beside <code>${e(r.process)}</code> (run <code>render:bpmn</code>).</p>`}</div>`;
    })
    .join("");
  return `<section class="jp-hood" id="hood" data-jp-hood hidden>
<div class="jp-hood-h">${icon("cpu", "jp-sky3")}<h3>Under the hood</h3><span>What the standards and tools are doing at this moment</span></div>
<div class="jp-hood-in">
${st.technicalSummary ? `<div class="jp-sowhat">${icon("bulb", "jp-amber jp-i-lg")}<div><span class="jp-label jp-amber8">Technical so-what</span><p>${e(st.technicalSummary)}</p></div></div>` : ""}
<div class="jp-layers">
<div class="jp-layer jp-layer-rose"><div class="jp-layer-h"><b>${icon("users")} Experience</b><span>What people see and do</span></div><div class="jp-layer-cells jp-exp">${lead && leadDoing ? personaText(`${lead.name}: ${leadDoing}`, p.cast, personaHref(corpus, pr, siteRoot)) : ""}</div></div>
${layerRows}${unplacedHtml}
</div>
${handoff || rows.length ? `<div class="jp-two">${handoff}${fhir}</div>` : ""}
${dak}
${procs}
</div>
</section>`;
}

function stepPage(corpus: JourneyCorpus, p: Presentation, s: PresentedStep, links: SiteLinks): string {
  const root = "../../../../../";
  const toWorkshop = "../../";
  const st = s.step;
  const ws = p.w.workshop;
  const pr = ws.presentation ?? {};
  const chapter = p.chapters[s.chapter]!;
  const tones = countryTones(p.chapters.map((c) => c.journey.scenario.country));
  const country = chapter.journey.scenario.country;
  const prevS = p.steps[s.index - 1];
  const nextS = p.steps[s.index + 1];
  const prev = prevS ? `../${prevS.key}/` : undefined;
  const next = nextS ? `../${nextS.key}/` : `${toWorkshop}discuss/`;
  const people = [...st.experiences].sort((a, b) => (a.actor === st.lead ? -1 : b.actor === st.lead ? 1 : 0));
  const siteRoot = siteRootFrom(root, links);
  const pl = personaHref(corpus, pr, siteRoot);
  const personCards = people
    .map((x) => {
      const pv = p.cast.find((c) => c.id === x.actor)!;
      return `<div class="jp-who" style="--c:${e(pv.color)}"><div class="jp-who-h">${avatar(pv)}<div><b>${personaNameHtml(pv, pl)}</b>${pv.role ? `<span>${e(pv.role)}</span>` : ""}</div>${mentionedChips(x.doing, p.cast, x.actor)}${emotionBadge(x.emotion)}</div><p>${personaText(x.doing, p.cast, pl)}</p>${x.feeling ? `<p class="jp-feel">${e(x.feeling)}</p>` : ""}</div>`;
    })
    .join("");
  const ladder = ladderOf(corpus, s.journey);
  const level = rungOf(ladder, st);
  const prevLevel = prevS ? rungOf(ladderOf(corpus, prevS.journey), prevS.step) : -1;
  const subject = pr.recordOf ? p.cast.find((x) => x.id === pr.recordOf)?.name ?? lookup(corpus.actors, p.w.instance, pr.recordOf)?.persona?.name : undefined;
  const record = st.record
    ? `<section class="jp-card jp-pad jp-tone-emerald jp-record"><div class="jp-row"><h3 class="jp-h jp-emerald8">${icon("package")} ${subject ? `${e(subject)}’s record` : "The record"}</h3>${s.index > 0 && level > prevLevel ? `<span class="jp-moved">▲ Moved up</span>` : ""}</div>
${ladder && level >= 0 ? meter(ladder, level) : ""}
<div class="jp-state">${e(ladder && level >= 0 ? ladder[level]!.label : st.record.state)}</div>
<p>${personaText(st.record.description, p.cast, pl)}</p>
<p class="jp-small">Held in: ${e(st.record.heldWhere)}</p>
${st.handoff ? `<div class="jp-handoff">${icon("arrow")}<span><b>Hand-off:</b> ${personaText(st.handoff.summary, p.cast, pl)}</span></div>` : ""}</section>`
    : "";
  const ask = s.ws?.askTheRoom ? `<section class="jp-ask jp-presenter-only"><h3 class="jp-h">${icon("message")} Ask the room</h3><p>${e(s.ws.askTheRoom)}</p></section>` : "";
  const whatIf = (st.whatIf ?? [])
    .map(
      (wf) => `<section class="jp-card jp-pad jp-tone-amber jp-whatif" data-jp-whatif><h3 class="jp-h jp-amber8">${icon("branch")} What if…</h3><p class="jp-wf-q">${e(wf.scenario)}</p><button type="button" class="jp-reveal jp-presenter-only" data-jp-reveal>Let the room guess, then reveal</button><p class="jp-wf-a">${e(wf.outcome)}</p></section>`,
    )
    .join("");
  const policy = st.policy ? `<section class="jp-card jp-pad jp-tone-indigo"><h3 class="jp-h jp-indigo">${icon("landmark")} Policy takeaway</h3><p>${e(st.policy)}</p></section>` : "";
  const cue = s.ws?.facilitatorCue ? `<section class="jp-cue jp-presenter-only"><div class="jp-cue-h">${icon("mic")} Facilitator cue</div><p>${e(s.ws.facilitatorCue)}</p></section>` : "";
  const pic = pictureOf(corpus, s, root);
  const lead = p.cast.find((x) => x.id === st.lead);
  const screens = screensFor(p, s)
    .map((sc) => {
      // Whose device it is: a drawn screen's owner, else the step's lead.
      const ownerId = sc.node?.screen.owner;
      const who = (ownerId ? p.cast.find((x) => x.id === ownerId) ?? personaOf(corpus, sc.node!.instance, ownerId, p.cast.length) : undefined) ?? lead;
      // VaxLink's full-width button at the right column's foot: the device, then whose screen it is.
      return `<a class="jp-see" href="${e(`${toWorkshop}demo/${sc.id}/`)}">${deviceGlyph(sc)}<span>See what ${e(who?.name ?? "they")} ${who?.name ? "sees" : "see"} <small>(screen ${e(sc.id)})</small></span></a>`;
    })
    .join("");
  void siteRoot;
  const meta = [st.when ? `<span>🕒 ${e(st.when)}</span>` : "", st.where ? `<span>📍 ${e(st.where)}</span>` : "", st.touchpoint ? `<span>${icon("phone")} ${e(st.touchpoint)}</span>` : ""].join("");
  const body = `${progress(p, s, prev, next)}
<div class="jp-walk">
<div class="jp-walk-l">
<section class="jp-card jp-story">
<div class="jp-story-top"><span class="jp-chapter">Chapter ${s.chapter + 1} · ${e(chapter.title)}</span>${country ? `<span class="jp-chip jp-chip-${tones.get(country)}">${e(country)}</span>` : ""}<span class="jp-pos">${e(st.id)} · ${s.index + 1}/${p.steps.length}</span></div>
<div class="jp-story-head"><h2><a href="./" title="Link to this moment">${e(st.title)}</a></h2>${pic || chapterScene(chapter) ? `<div class="jp-story-pic">${pic}${sceneStrip(chapterScene(chapter), tones.get(country ?? "") ?? "sky", "sm")}</div>` : ""}</div>
${st.headline ? `<p class="jp-headline">${personaText(st.headline, p.cast, pl)}</p>` : ""}
${meta ? `<div class="jp-meta">${meta}</div>` : ""}
</section>
<section><h3 class="jp-h jp-h-pad">Who’s in this moment</h3><div class="jp-whos">${personCards}</div></section>
${st.painPoint || st.enabler ? `<section class="jp-pe">${st.painPoint ? `<div class="jp-pain"><div class="jp-h">${icon("alert")} Without this</div><p>${personaText(st.painPoint, p.cast, pl)}</p></div>` : ""}${st.enabler ? `<div class="jp-enable"><div class="jp-h">${icon("sparkles")} What makes it work</div><p>${personaText(st.enabler, p.cast, pl)}</p></div>` : ""}</section>` : ""}
</div>
<div class="jp-walk-r">
${screens ? `<div class="jp-sees">${screens}</div>` : ""}
${record}${ask}${whatIf}${policy}${cue}
</div>
</div>
${belowTheJourney(policyPanel(p, s, toWorkshop), hood(corpus, p, s, links, root))}`;
  return frame({
    p,
    root,
    toWorkshop,
    view: "walkthrough",
    title: `${st.id} ${st.title} — ${pr.name ?? ws.title}`,
    ...(s.ws?.facilitatorCue ? { note: `Moment ${st.id} — ${s.ws.facilitatorCue}` } : {}),
    ...(prev ? { prev } : { prev: "../../overview/" }),
    next,
    body,
    foot: payloadDrawer(corpus, st, (k) => artifactPage(corpus, pr, k, siteRoot), pr.inspector),
  });
}

// ── all of it ─────────────────────────────────────────────────────────────

/** The presentation pages of every workshop, paths relative to the viewer's route. */
export function renderPresentationPages(corpus: JourneyCorpus, links: SiteLinks): PageFile[] {
  const out: PageFile[] = [];
  for (const w of corpus.workshops) {
    const p = presentationOf(corpus, w);
    if (p.steps.length === 0) continue;
    const base = `${w.instance}/workshops/${w.workshop.id}`;
    out.push({ path: `${base}/overview/index.html`, content: overviewPage(corpus, p, links) });
    for (const s of p.steps) out.push({ path: `${base}/walkthrough/${s.key}/index.html`, content: stepPage(corpus, p, s, links) });
    for (const f of renderViewPages(corpus, p, links)) out.push({ ...f, path: `${base}/${f.path}` });
    // The JSON the views' drawers load: once per example, not once per page.
    const keys = new Set([...stepsExampleKeys(p.steps), ...p.screens.flatMap((x) => (x.node ? screenExamples(x.node.screen) : []))]);
    for (const k of keys) {
      const json = corpus.examples.get(k)?.json;
      if (json) out.push({ path: `${base}/${payloadFile(k)}`, content: json });
    }
  }
  return out;
}
