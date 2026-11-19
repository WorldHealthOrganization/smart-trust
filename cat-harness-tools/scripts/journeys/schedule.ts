/**
 * A workshop's days as a calendar: time down the side, a column per track,
 * and the joint sessions, breaks and logistics across every track.
 *
 * @module scripts/journeys/schedule
 * @covers workshop
 *
 * Drawn from the workshop's `schedule` (`schemas/process/workshop.ts`), data
 * and never markup, on the workshop's page and its overview. A workshop with
 * no schedule of its own shows the schedule of a sibling workshop (same
 * layer) that names it as a track's `workshop`, so the two tracks of one event
 * show one calendar.
 *
 * `layoutDay` is the pure part: a day's slots placed on a grid, one row per
 * interval between consecutive start and end times; `tableRows` turns that
 * into a table's rows of cells, with `rowspan` so the tracks' times line up
 * and `colspan` across every track for a joint session, a break or logistics.
 * `scheduleHtml` draws it as a semantic `<table>` per day (owner, 2026-11-18):
 * a caption, `<th scope>` for the tracks and each row's time, and each slot's
 * own time and track in its cell, so a phone (where each day stacks into one
 * column) and a screen reader read it whole. Every word is in the page's
 * text, so the viewer's translation catalogue and the presentation's
 * country renaming reach it with no hook of their own.
 */
import type { Workshop, WorkshopSchedule, WorkshopScheduleSlot } from "../../schemas/process/workshop.ts";
import { escHtml as e } from "../thin-page.ts";
import type { JourneyCorpus, WorkshopEntry } from "./read.ts";

export interface PlacedSlot {
  slot: WorkshopScheduleSlot;
  /** 1-based grid rows, `rowEnd` exclusive, counted from the first time row. */
  row: number;
  rowEnd: number;
  /** The track's index, 0-based; `undefined` for a slot across every track. */
  track?: number;
}

export interface DayLayout {
  /** Every start and end time of the day, sorted: row `i` runs from `times[i-1]` to `times[i]`. */
  times: string[];
  /** The slots in reading order: by start time, a slot across every track before a track's, then track order. */
  slots: PlacedSlot[];
}

/** A day's slots on the grid. Times are `HH:MM`, so they sort as strings. */
export function layoutDay(slots: readonly WorkshopScheduleSlot[], tracks: readonly { id: string }[]): DayLayout {
  const times = [...new Set(slots.flatMap((s) => [s.start, s.end]))].sort();
  const at = new Map(times.map((t, i) => [t, i + 1]));
  const index = new Map(tracks.map((t, i) => [t.id, i]));
  const placed = slots.map((slot): PlacedSlot => {
    const track = slot.kind === "session" && slot.track !== undefined ? index.get(slot.track) : undefined;
    return { slot, row: at.get(slot.start)!, rowEnd: at.get(slot.end)!, ...(track !== undefined ? { track } : {}) };
  });
  placed.sort((a, b) => a.row - b.row || (a.track ?? -1) - (b.track ?? -1) || a.rowEnd - b.rowEnd);
  return { times, slots: placed };
}

/** A cell of a table row: a slot starting in that row, or an empty cell where a track has nothing. */
export type TableCell = { slot: PlacedSlot; rowspan: number; colspan: number } | { empty: true };

/**
 * A day's table: one row per interval of `layoutDay`, each row's cells left
 * to right. A cell covered by a slot that started in an earlier row is left
 * out, as `rowspan` requires; a track with nothing in an interval gets an
 * empty cell. Slots of one track never overlap (the schema refuses it).
 */
export function tableRows(lay: DayLayout, tracks: number): { time: string; end: string; cells: TableCell[] }[] {
  const rows = Math.max(0, lay.times.length - 1);
  const covered: boolean[][] = Array.from({ length: rows + 1 }, () => Array<boolean>(tracks).fill(false));
  const startsAt = new Map<string, PlacedSlot>();
  for (const p of lay.slots) {
    const cols = p.track === undefined ? [...Array(tracks).keys()] : [p.track];
    startsAt.set(`${p.row}:${cols[0]}`, p);
    for (let r = p.row; r < p.rowEnd; r++) for (const c of cols) covered[r]![c] = true;
  }
  const out: { time: string; end: string; cells: TableCell[] }[] = [];
  for (let r = 1; r <= rows; r++) {
    const cells: TableCell[] = [];
    for (let c = 0; c < tracks; ) {
      const p = startsAt.get(`${r}:${c}`);
      if (p) {
        const colspan = p.track === undefined ? tracks : 1;
        cells.push({ slot: p, rowspan: p.rowEnd - p.row, colspan });
        c += colspan;
      } else {
        if (!covered[r]![c]) cells.push({ empty: true });
        c++;
      }
    }
    out.push({ time: lay.times[r - 1]!, end: lay.times[r]!, cells });
  }
  return out;
}

/** The schedule a workshop shows, and the workshop that holds it: its own, else a sibling's that names it as a track. */
export function scheduleFor(corpus: JourneyCorpus, w: WorkshopEntry): { schedule: WorkshopSchedule; owner: WorkshopEntry } | undefined {
  if (w.workshop.schedule) return { schedule: w.workshop.schedule, owner: w };
  const owner = corpus.workshops.find((x) => x.instance === w.instance && x !== w && x.workshop.schedule?.tracks.some((t) => t.workshop === w.workshop.id));
  return owner ? { schedule: owner.workshop.schedule!, owner } : undefined;
}

const seg = (id: string): string => id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const KIND_LABEL: Record<WorkshopScheduleSlot["kind"], string> = { session: "Session", joint: "Joint, both tracks", break: "Break", logistics: "Logistics" };

export interface ScheduleDraw {
  corpus: JourneyCorpus;
  /** The workshop the page is about. */
  here: WorkshopEntry;
  /** The workshop that holds the schedule. */
  owner: WorkshopEntry;
  schedule: WorkshopSchedule;
  /** From the page to the instance's `workshops/` folder (`../../` from an overview). */
  toWorkshops: string;
  /** The page's heading level for the section; the days are one below it. */
  level?: 2 | 3;
  /** The section's id, the anchor the old timetable pages link to. */
  id?: string;
  /** Renders the intro's Markdown. */
  md?: (text: string) => string;
}

/** A module's page from the page drawing the calendar, when its workshop is in the corpus and lists it. */
function moduleHref(d: ScheduleDraw, workshopId: string, module: string): string | undefined {
  const ws: Workshop | undefined = d.corpus.workshops.find((x) => x.instance === d.owner.instance && x.workshop.id === workshopId)?.workshop;
  if (!ws?.modules.some((m) => m.id === module)) return undefined;
  return `${d.toWorkshops}${workshopId}/${seg(module)}/`;
}

function slotHtml(d: ScheduleDraw, c: { slot: PlacedSlot; rowspan: number; colspan: number }): string {
  const p = c.slot;
  const x = p.slot;
  const t = p.track === undefined ? undefined : d.schedule.tracks[p.track]!;
  const where = t ? t.label : KIND_LABEL[x.kind];
  const wid = t?.workshop ?? d.owner.workshop.id;
  const href = x.module ? moduleHref(d, wid, x.module) : undefined;
  const code = x.module ? (href ? `<a class="jv-cal-code" href="${e(href)}">${e(x.module)}</a> ` : `<span class="jv-cal-code">${e(x.module)}</span> `) : "";
  const here = t && wid === d.here.workshop.id ? " is-here" : "";
  const span = `${c.rowspan > 1 ? ` rowspan="${c.rowspan}"` : ""}${c.colspan > 1 ? ` colspan="${c.colspan}"` : ""}`;
  return `<td class="jv-cal-slot jv-cal-${x.kind}${t ? ` jv-cal-t${p.track! % 4}` : ""}${here}"${span}>
<p class="jv-cal-when"><time>${e(x.start)}</time>–<time>${e(x.end)}</time> <span class="jv-cal-where">${e(where)}</span></p>
<p class="jv-cal-title">${code}${e(x.title)}${x.type ? ` <span class="jv-cal-type">${e(x.type)}</span>` : ""}</p>${x.note ? `\n<p class="jv-cal-note">${e(x.note)}</p>` : ""}${x.sessions?.length ? `\n<ul class="jv-cal-parts">${x.sessions.map((s) => `<li>${e(s)}</li>`).join("")}</ul>` : ""}
</td>`;
}

/** The calendar's heading: its own title, else "The two days" (or "The N days"). */
export function scheduleTitle(sc: WorkshopSchedule): string {
  const n = sc.days.length;
  return sc.title ?? (n === 1 ? "The day" : `The ${n === 2 ? "two" : n === 3 ? "three" : String(n)} days`);
}

/** The calendar: a table per day. */
export function scheduleHtml(d: ScheduleDraw): string {
  const sc = d.schedule;
  const h = d.level ?? 2;
  const n = sc.tracks.length;
  const id = d.id ?? "the-days";
  const days = sc.days
    .map((day) => {
      const rows = tableRows(layoutDay(day.slots, sc.tracks), n);
      const dayId = `${id}-day-${day.day}`;
      const head = `<thead><tr><th scope="col" class="jv-cal-timeh">Time</th>${sc.tracks
        .map((t, i) => `<th scope="col" class="jv-cal-head jv-cal-t${i % 4}${(t.workshop ?? d.owner.workshop.id) === d.here.workshop.id ? " is-here" : ""}">${e(t.label)}</th>`)
        .join("")}</tr></thead>`;
      const body = rows
        .map((r) => `<tr><th scope="row" class="jv-cal-time"><time>${e(r.time)}</time></th>${r.cells.map((c) => ("empty" in c ? `<td class="jv-cal-empty"></td>` : slotHtml(d, c))).join("")}</tr>`)
        .join("\n");
      return `<table class="jv-cal-day" id="${e(dayId)}">
<caption><b>${e(day.title ?? `Day ${day.day}`)}</b>${day.summary ? ` <span class="jv-cal-sum">${e(day.summary)}</span>` : ""}</caption>
${head}
<tbody>
${body}
</tbody>
</table>`;
    })
    .join("\n");
  return `<section class="jv-cal" id="${e(id)}" aria-labelledby="${e(id)}-h">
<h${h} id="${e(id)}-h">${e(scheduleTitle(sc))}</h${h}>
${sc.intro ? `<div class="jv-cal-intro">${d.md ? d.md(sc.intro) : `<p>${e(sc.intro)}</p>`}</div>\n` : ""}${days}
</section>
`;
}
