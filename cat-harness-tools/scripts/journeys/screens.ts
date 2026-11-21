/**
 * Device screens, drawn: each `device-screen` node as a static device mock
 * in the journeys viewer's own tokens, and the model that links a workshop's
 * screens to the steps they show.
 *
 * @module scripts/journeys/screens
 * @covers device-screen
 *
 * ## One list of screens per workshop
 *
 * A workshop's Device Demo lists the screens that show a step it teaches
 * ({@link demoScreensOf}). When the checkout declares `device-screen` nodes
 * for any of those steps, the screens are those nodes, drawn here; only when
 * it declares none does the workshop's `presentation.deviceDemo` (an app of
 * the layer's own, framed) stand in. One list either way, so the step
 * pages' "See what X sees", the map's "Open screen" and the demo pages read
 * the same screens.
 *
 * ## The device
 *
 * {@link renderDevice} draws a screen's blocks inside a CSS frame for its
 * device (phone, tablet, scanner, desktop, kiosk), with the owner's avatar
 * and name beside it. Nothing in a screen is interactive: a toggle is drawn
 * in the state the node says, a button is a label. The one live control is
 * the switch between a screen's `states` (a valid card, a tampered one):
 * every state is drawn at build time, the first shown, and the viewer's
 * script shows one at a time (`?state=<id>` opens on one). Without the
 * script the page shows the first state and no switch. A `qr` block is a real QR code of its
 * payload, made at build time by the encoder the site chrome already vendors
 * (`assets/js/vendor/qrcode.js`, cross-checked by `scripts/tests/qr.test.ts`);
 * no package is added for it.
 *
 * Pure but for that encoder: a screen and a context in, HTML out.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { blocksIn, DEFAULT_STATE, isWide, screenStates, type BlockOf, type Device, type DeviceScreen, type ScreenBlock } from "../../schemas/process/device-screen.ts";
import { escHtml } from "../thin-page.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import type { JourneyCorpus, ScreenEntry, WorkshopEntry } from "./read.ts";
import type { PersonaView } from "./render.ts";
import { avatar, glyph, type PresentedStep } from "./present.ts";

const e = escHtml;

// ── the model ─────────────────────────────────────────────────────────────

/** A screen of a workshop's Device Demo, drawn from a node or framed from the layer's app. */
export interface DemoScreen {
  id: string;
  title: string;
  device: Device;
  try?: string;
  /** The walkthrough steps it shows, in walkthrough order. */
  steps: PresentedStep[];
  /** Step refs it names that the walkthrough does not present. */
  unresolved: string[];
  /** The node, when the screen is drawn. */
  node?: ScreenEntry;
}

/** What a Device Demo is made of: drawn screens, an app framed, or nothing. */
export type DemoSource = "screens" | "frame" | "none";

/**
 * A workshop's screens: the `device-screen` nodes that show a step it
 * presents, ordered by the first such step and then by id; else the
 * workshop's own `presentation.deviceDemo` screens; else none.
 */
export function demoScreensOf(corpus: JourneyCorpus, w: WorkshopEntry, steps: readonly PresentedStep[]): { source: DemoSource; screens: DemoScreen[] } {
  const at = (scenario: string, step: string) => steps.find((s) => s.journey.scenario.id === scenario && s.step.id === step);
  const drawn: DemoScreen[] = [];
  for (const node of corpus.screens) {
    const shown = node.screen.steps.map((x) => ({ x, s: at(x.scenario, x.step) }));
    if (!shown.some((y) => y.s !== undefined)) continue;
    drawn.push({
      id: node.screen.id,
      title: node.screen.title,
      device: node.screen.device,
      ...(node.screen.try ? { try: node.screen.try } : {}),
      steps: shown.flatMap((y) => (y.s ? [y.s] : [])).sort((a, b) => a.index - b.index),
      unresolved: shown.filter((y) => y.s === undefined).map((y) => `${y.x.scenario}#${y.x.step}`),
      node,
    });
  }
  if (drawn.length > 0) {
    const first = (d: DemoScreen) => d.steps[0]?.index ?? Number.MAX_SAFE_INTEGER;
    drawn.sort((a, b) => first(a) - first(b) || a.id.localeCompare(b.id, undefined, { numeric: true }));
    return { source: "screens", screens: drawn };
  }
  const d = w.workshop.presentation?.deviceDemo;
  if (d === undefined) return { source: "none", screens: [] };
  return {
    source: "frame",
    screens: d.screens.map((x) => ({
      id: x.id,
      title: x.title,
      device: x.device ?? "phone",
      ...(x.try ? { try: x.try } : {}),
      steps: x.steps.flatMap((id) => steps.filter((s) => s.step.id === id)),
      unresolved: x.steps.filter((id) => !steps.some((s) => s.step.id === id)),
    })),
  };
}

/** The glyph a device is drawn with in a list. */
export const DEVICE_GLYPH: Record<Device, string> = { phone: "phone", tablet: "tablet", scanner: "scanner", desktop: "monitor", kiosk: "kiosk" };
export const DEVICE_LABEL: Record<Device, string> = { phone: "Phone", tablet: "Tablet", scanner: "Scanner", desktop: "Computer", kiosk: "Kiosk" };

// ── QR codes ──────────────────────────────────────────────────────────────

interface QrModel {
  addData(data: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
}
type QrFactory = ((typeNumber: number, level: string) => QrModel) & { stringToBytes?: unknown };
let qrFactory: QrFactory | undefined;

/** The site chrome's vendored encoder, loaded once into a sandbox (as `qr.test.ts` loads it). */
function encoder(): QrFactory {
  if (qrFactory) return qrFactory;
  const ctx: { qrcode?: QrFactory } = {};
  createContext(ctx);
  runInContext(readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/js/vendor/qrcode.js")), "utf8"), ctx);
  // After the encoder: without it a non-ASCII payload encodes to mojibake.
  runInContext(readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/js/vendor/qrcode_UTF8.js")), "utf8"), ctx);
  if (!ctx.qrcode) throw new Error("the vendored qrcode.js did not attach `qrcode`");
  qrFactory = ctx.qrcode;
  return qrFactory;
}

/** A QR code of `text` (level M) as rows of dark modules. */
export function qrMatrix(text: string): boolean[][] {
  const q = encoder()(0, "M");
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}

/** A QR matrix as one SVG path, with a quiet zone of `margin` modules. */
export function qrSvg(m: readonly (readonly boolean[])[], margin = 2): string {
  const n = m.length + margin * 2;
  let d = "";
  m.forEach((row, r) => row.forEach((dark, c) => {
    if (dark) d += `M${c + margin} ${r + margin}h1v1h-1z`;
  }));
  return `<svg class="ds-qr-svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#0f172a"/></svg>`;
}

// ── rows from a FHIR example ──────────────────────────────────────────────

export type Row = NonNullable<BlockOf<"recordList">["rows"]>[number];

type Res = { resourceType?: string; status?: string; clinicalStatus?: Concept; code?: Concept; vaccineCode?: Concept; medicationCodeableConcept?: Concept; medication?: { concept?: Concept }; occurrenceDateTime?: string; lotNumber?: string; entry?: { resource?: Res }[] };
type Concept = { text?: string; coding?: { code?: string; display?: string }[] };

const ROW_ICON: Record<string, Row["icon"]> = {
  Immunization: "syringe",
  MedicationStatement: "pill",
  MedicationRequest: "pill",
  AllergyIntolerance: "pill-off",
  Condition: "heart",
  Patient: "user",
  Consent: "shield",
  Provenance: "shield-check",
};

/**
 * The rows a record list shows for a FHIR example: a Bundle's entries (its
 * Composition aside), else the resource itself. A row is the resource's own
 * words: its code's text (or first coding's display), the code, its date and
 * lot, its status. An allergy is drawn struck through.
 */
export function rowsFromExample(json: string): Row[] {
  let r: Res;
  try {
    r = JSON.parse(json) as Res;
  } catch {
    return [];
  }
  const list = r.resourceType === "Bundle" ? (r.entry ?? []).flatMap((x) => (x.resource && x.resource.resourceType !== "Composition" ? [x.resource] : [])) : [r];
  return list.map((x) => {
    const concept = x.vaccineCode ?? x.medicationCodeableConcept ?? x.medication?.concept ?? x.code;
    const label = concept?.text ?? concept?.coding?.[0]?.display ?? x.resourceType ?? "Resource";
    const code = concept?.coding?.[0]?.code;
    const detail = [x.occurrenceDateTime, x.lotNumber ? `Lot ${x.lotNumber}` : undefined].filter(Boolean).join(" · ");
    const status = x.status ?? x.clinicalStatus?.coding?.[0]?.code;
    const icon = ROW_ICON[x.resourceType ?? ""];
    return {
      ...(icon ? { icon } : {}),
      label,
      ...(code ? { code } : {}),
      ...(detail ? { detail } : {}),
      ...(status ? { status: { text: status, tone: "neutral" as const } } : {}),
      ...(x.resourceType === "AllergyIntolerance" ? { struck: true } : {}),
    };
  });
}

// ── drawing a screen ──────────────────────────────────────────────────────

/** What drawing a screen needs from outside it. */
export interface ScreenContext {
  /** A person: the presentation's cast first, so colours agree with the walkthrough. */
  person(id: string): PersonaView | undefined;
  /** An example's page, when it has one. */
  exampleHref(key: string): string | undefined;
  /** An example's JSON, when the checkout has it. */
  exampleJson(key: string): string | undefined;
  /** True when the page's payload drawer has a tab for the example: the block then offers "Inspect JSON". */
  inspectable?(key: string): boolean;
}

/** "Inspect JSON" for a block's example, opening the page's drawer on its tab; empty when the drawer has none. */
const inspectBtn = (key: string | undefined, ctx: ScreenContext): string =>
  key !== undefined && ctx.inspectable?.(key) ? `<button type="button" class="jp-inspect ds-inspect" data-jp-inspect="${e(key)}">Inspect JSON</button>` : "";

type Chip = { text: string; tone?: string; icon?: string };
const chip = (c: Chip | undefined, cls = ""): string =>
  c ? `<span class="ds-chip ds-tone-${c.tone ?? "neutral"}${cls ? ` ${cls}` : ""}">${c.icon ? glyph(c.icon) : ""}${e(c.text)}</span>` : "";
const fieldsHtml = (rows: readonly { label: string; value: string; mono?: boolean }[] | undefined, cols = 2): string =>
  rows?.length ? `<dl class="ds-fields ds-cols-${cols}">${rows.map((f) => `<div><dt>${e(f.label)}</dt><dd${f.mono ? ' class="ds-mono"' : ""}>${e(f.value)}</dd></div>`).join("")}</dl>` : "";
const titleRow = (title: string | undefined, ic: string | undefined, right = ""): string =>
  title || right ? `<div class="ds-title">${title ? `<h4>${ic ? glyph(ic) : ""}<span>${e(title)}</span></h4>` : "<span></span>"}${right}</div>` : "";

const STATUS: Record<BlockOf<"statusBadge">["status"], { tone: string; icon: string }> = {
  verified: { tone: "success", icon: "shield-check" },
  unverified: { tone: "warning", icon: "alert" },
  failed: { tone: "danger", icon: "cross" },
  emergency: { tone: "danger", icon: "unlock" },
  info: { tone: "info", icon: "shield" },
};
const SEVERITY: Record<BlockOf<"alert">["severity"], { tone: string; icon: string }> = {
  info: { tone: "info", icon: "shield" },
  success: { tone: "success", icon: "check" },
  warning: { tone: "warning", icon: "alert" },
  danger: { tone: "danger", icon: "shield-alert" },
};

/** One block, as HTML. */
export function blockHtml(b: ScreenBlock, ctx: ScreenContext): string {
  switch (b.type) {
    case "header":
      return `<header class="ds-hdr"><span class="ds-hdr-i"${b.brand ? ` style="--brand:${e(b.brand)}"` : ""}>${glyph(b.icon ?? "building")}</span><div class="ds-hdr-t"><b>${e(b.app)}</b>${b.subtitle ? `<small>${e(b.subtitle)}</small>` : ""}${b.chips?.length ? `<span class="ds-chips">${b.chips.map((c) => chip(c)).join("")}</span>` : ""}</div>${chip(b.status, "ds-hdr-status")}</header>`;
    case "personCard": {
      const pv = ctx.person(b.actor);
      const name = b.name ?? pv?.name ?? b.actor;
      const av = pv ? avatar(pv, "md") : `<span class="jp-av jp-av-md ds-unresolved" title="no such actor">?</span>`;
      return `<section class="ds-person${b.banner ? " ds-banner" : " ds-card"}">${av}<div class="ds-person-t"><div class="ds-person-n"><b>${e(name)}</b>${b.chips?.length ? b.chips.map((c) => chip(c)).join("") : ""}</div>${b.subtitle ? `<small>${e(b.subtitle)}</small>` : ""}${fieldsHtml(b.fields)}</div></section>`;
    }
    case "qr": {
      const href = b.example ? ctx.exampleHref(b.example) : undefined;
      const link = b.example ? (href ? `<a class="ds-ex" href="${e(href)}" target="_blank" rel="noopener noreferrer">${glyph("file")}${e(b.example)}</a>` : `<span class="ds-ex">${glyph("file")}${e(b.example)}</span>`) : "";
      if (b.mode === "scan") {
        return `<section class="ds-scan"><div class="ds-reticle">${qrSvg(qrMatrix(b.payload), 1)}<i></i><i></i><i></i><i></i></div><div class="ds-scan-bar">${glyph("camera")}<span>${e(b.label ?? "Camera")}</span>${chip(b.badge)}</div>${b.caption ? `<p class="ds-caption">${e(b.caption)}</p>` : ""}${link}${inspectBtn(b.example, ctx)}</section>`;
      }
      return `<section class="ds-card ds-qr">${b.title ? `<div class="ds-qr-h">${e(b.title)}</div>` : ""}${b.holder ? `<div class="ds-qr-who"><b>${e(b.holder)}</b>${b.holderNote ? `<small>${e(b.holderNote)}</small>` : ""}</div>` : ""}${b.label ? `<div class="ds-qr-l">${e(b.label)}</div>` : ""}<div class="ds-qr-code">${qrSvg(qrMatrix(b.payload))}</div>${chip(b.badge, "ds-qr-badge")}${b.caption ? `<p class="ds-caption">${e(b.caption)}</p>` : ""}${link}${inspectBtn(b.example, ctx)}</section>`;
    }
    case "passcode": {
      const digits = [...b.digits].map((d) => `<span class="ds-digit${b.shown ? "" : " is-hidden"}">${b.shown ? e(d) : "•"}</span>`).join("");
      return `<section class="ds-card ds-pass${b.entry ? " is-entry" : ""}"><div class="ds-title"><h4>${glyph(b.shown ? "unlock" : "lock")}<span>${e(b.label)}</span></h4><span class="ds-eye">${glyph("eye")}${b.shown ? "Shown" : "Hidden"}</span></div><div class="ds-digits">${digits}</div>${b.note ? `<p class="ds-caption">${e(b.note)}</p>` : ""}</section>`;
    }
    case "statusBadge": {
      const s = STATUS[b.status];
      return `<section class="ds-status ds-tone-${s.tone} ds-status-${b.status}"><div class="ds-status-h">${glyph(s.icon, "ds-status-i")}<b>${e(b.text)}</b>${b.verdict ? `<span class="ds-verdict">${e(b.verdict)}</span>` : ""}</div>${fieldsHtml(b.fields)}${b.detail ? `<p>${e(b.detail)}</p>` : ""}</section>`;
    }
    case "recordList": {
      const rows = b.rows ?? (b.example ? rowsFromExample(ctx.exampleJson(b.example) ?? "") : []);
      const href = b.example ? ctx.exampleHref(b.example) : undefined;
      const body = rows.length
        ? `<ul class="ds-rows">${rows.map((r) => `<li${r.struck ? ' class="is-struck"' : ""}>${r.icon ? `<span class="ds-row-i">${glyph(r.icon)}</span>` : ""}<div class="ds-row-t"><div class="ds-row-top"><b>${e(r.label)}</b>${chip(r.status)}</div>${r.code ? `<code>${e(r.code)}</code>` : ""}${r.detail ? `<small>${e(r.detail)}</small>` : ""}</div></li>`).join("")}</ul>`
        : `<p class="ds-caption ds-unresolved">${b.example ? `No rows: ${e(b.example)} is not on disk here` : "No rows"}</p>`;
      const link = b.example ? (href ? `<a class="ds-ex" href="${e(href)}" target="_blank" rel="noopener noreferrer">${glyph("file")}${e(b.example)}</a>` : `<span class="ds-ex">${glyph("file")}${e(b.example)}</span>`) : "";
      return `<section class="ds-card ds-list">${titleRow(b.title, b.icon, chip(b.summary))}${body}${b.footnote ? `<p class="ds-caption">${e(b.footnote)}</p>` : ""}${link}${inspectBtn(b.example, ctx)}</section>`;
    }
    case "fields":
      return `<section class="ds-card">${titleRow(b.title, b.icon)}${fieldsHtml(b.rows, b.columns ?? 1)}</section>`;
    case "consent":
      return `<section class="ds-card ds-consent">${titleRow(b.title ?? "Sharing", b.icon ?? "shield")}<dl class="ds-consent-l"><div>${glyph("eye")}<dt>Who can see</dt><dd>${e(b.who)}</dd></div><div>${glyph("file")}<dt>What</dt><dd>${e(b.what)}</dd></div>${b.until ? `<div>${glyph("calendar")}<dt>Until</dt><dd>${e(b.until)}</dd></div>` : ""}</dl><div class="ds-toggle${b.granted ? " is-on" : ""}"><span class="ds-switch" aria-hidden="true"><i></i></span><span>${b.granted ? "Shared" : "Not shared"}</span></div></section>`;
    case "alert": {
      const s = SEVERITY[b.severity];
      return `<section class="ds-alert ds-tone-${s.tone}">${glyph(b.icon ?? s.icon)}<div>${b.title ? `<b>${e(b.title)}</b>` : ""}<p>${e(b.text)}</p></div></section>`;
    }
    case "actions":
      return `<footer class="ds-actions"><div>${b.buttons.map((x) => `<span class="ds-btn ds-btn-${x.style}" role="button" aria-disabled="true">${x.icon ? glyph(x.icon) : ""}${e(x.label)}</span>`).join("")}</div>${b.caption ? `<p class="ds-caption">${e(b.caption)}</p>` : ""}</footer>`;
    case "note":
      return `<p class="ds-note${b.mono ? " ds-mono" : ""}">${b.icon ? glyph(b.icon) : ""}<span>${e(b.text)}</span></p>`;
  }
}

/** Blocks drawn across the whole screen, whatever their column: the bar on top, a patient banner, the action bar. */
const fullWidth = (b: ScreenBlock): boolean => b.type === "header" || b.type === "actions" || (b.type === "personCard" && b.banner === true);

/**
 * A screen inside its device frame, the owner beside it. On a wide device
 * the blocks marked `column: "side"` go in a second column; full-width
 * blocks (header, banner, actions) stay where they are in the order.
 */
export const DEVICE_FORM: Record<Device, string> = { phone: "Phone 390px", tablet: "Tablet / Web 1024px", scanner: "Handheld scanner", desktop: "Desktop / Web 1280px", kiosk: "Kiosk 600px" };

/**
 * The device's status bar (JV-17): on a phone the clock, the notch and the
 * signal; on anything wider a dark bar with the app's name and version from
 * the screen's `client`, the clock, signal and battery.
 */
export function statusBar(screen: DeviceScreen): string {
  const c = screen.client;
  const sys = `${glyph("wifi")}${glyph("battery")}`;
  if (screen.device === "phone") return `<div class="ds-statusbar" aria-hidden="true"><span>${e(c?.time ?? "9:41")}</span><span class="ds-notch"></span><span>${sys}</span></div>`;
  return `<div class="ds-statusbar ds-statusbar-wide" aria-hidden="true"><span class="ds-client">${c ? `<b>${e(c.name)}</b>${c.version ? `<small>v${e(c.version.replace(/^v/, ""))}</small>` : ""}` : ""}</span><span class="ds-sys"><span>${e(c?.time ?? "9:41 AM")}</span>${sys}</span></div>`;
}

/** One state's blocks, laid out: the side column on a wide device, full-width blocks across. */
function screenBody(screen: DeviceScreen, blocks: readonly ScreenBlock[], ctx: ScreenContext): string {
  const wide = isWide(screen.device) && screen.blocks.some((b) => b.column === "side");
  const parts: string[] = [];
  let main: string[] = [];
  let side: string[] = [];
  const flush = () => {
    if (main.length || side.length) {
      parts.push(wide ? `<div class="ds-split"><div class="ds-col">${main.join("")}</div><div class="ds-col ds-col-side">${side.join("")}</div></div>` : `<div class="ds-col">${main.join("")}</div>`);
    }
    main = [];
    side = [];
  };
  for (const b of blocks) {
    if (fullWidth(b)) {
      flush();
      parts.push(blockHtml(b, ctx));
    } else (wide && b.column === "side" ? side : main).push(blockHtml(b, ctx));
  }
  flush();
  return parts.join("");
}

/**
 * The switch between a screen's states, drawn above the device: one button
 * per state, the first pressed, and each state's "try" under it. Hidden
 * until the viewer's script wires it, so a page without the script shows
 * no switch that does nothing. Empty for a screen with no states.
 */
export function stateSwitch(screen: DeviceScreen): string {
  const states = screenStates(screen);
  if (!states.length) return "";
  const btns = states
    .map((st, i) => `<button type="button" class="ds-state-btn${i === 0 ? " is-on" : ""}" data-ds-show="${e(st.id)}" aria-pressed="${i === 0}">${e(st.label)}</button>`)
    .join("");
  const tries = states
    .map((st, i) => (st.try ? `<p class="ds-state-try jp-try" data-ds-state="${e(st.id)}"${i === 0 ? "" : " hidden"}>${glyph("sparkles")} ${e(st.try)}</p>` : ""))
    .join("");
  return `<div class="ds-states" data-ds-switch="${e(screen.id)}" hidden><span class="ds-states-l">Show</span><div class="ds-states-b" role="group" aria-label="Screen state">${btns}</div>${tries}</div>`;
}

export function renderDevice(screen: DeviceScreen, ctx: ScreenContext, opts: { caption?: boolean } = {}): string {
  const states = screenStates(screen);
  const chrome = statusBar(screen);
  const inner = states.length
    ? states
        .map((st, i) => `<div class="ds-state" data-ds-state="${e(st.id)}"${i === 0 ? "" : " hidden"}>${screenBody(screen, blocksIn(screen, st.id), ctx)}</div>`)
        .join("")
    : screenBody(screen, blocksIn(screen, DEFAULT_STATE), ctx);
  const owner = ctx.person(screen.owner);
  const ownerHtml = owner
    ? `<figcaption class="ds-owner" style="--c:${e(owner.color)}">${avatar(owner, "lg")}<span><b>${e(owner.name)}</b><small>${e(DEVICE_LABEL[screen.device])}${owner.role ? ` · ${e(owner.role)}` : ""}</small></span></figcaption>`
    : `<figcaption class="ds-owner ds-unresolved">${e(screen.owner)}</figcaption>`;
  return `<figure class="ds-device ds-${screen.device}" data-screen="${e(screen.id)}">${opts.caption === false ? "" : ownerHtml}<div class="ds-frame"><div class="ds-screen">${chrome}${inner}</div></div></figure>`;
}
