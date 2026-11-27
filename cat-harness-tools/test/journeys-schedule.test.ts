/**
 * A workshop's days as a calendar — owner, 2026-11-18: the two-day timetable
 * of the policy and technical tracks, side by side, came back to the viewer as
 * a grid drawn from data, and the overview's hero stopped drawing the whole
 * description (headings, tables) as one heading.
 *
 * @module cat-harness-tools/test/journeys-schedule.test
 * @graphNode none — a test
 */
import { describe, expect, test } from "bun:test";

import { parseWorkshop, type WorkshopSchedule } from "../schemas/process/workshop.ts";
import { storyOf } from "../scripts/journeys/present.ts";
import type { JourneyCorpus, WorkshopEntry } from "../scripts/journeys/read.ts";
import { layoutDay, scheduleFor, scheduleHtml, scheduleTitle, tableRows } from "../scripts/journeys/schedule.ts";

const tracks = [{ id: "policy", label: "Policy track", workshop: "policy" }, { id: "technical", label: "Technical track" }];
const day1: WorkshopSchedule["days"][number] = {
  day: 1,
  summary: "Concepts and the stack.",
  slots: [
    { start: "08:30", end: "09:00", kind: "logistics", title: "Registration", note: "Support crew" },
    { start: "09:00", end: "10:30", kind: "joint", title: "The story we follow", sessions: ["P1.1 Welcome", "P1.2 Remarks"] },
    { start: "10:30", end: "11:00", kind: "break", title: "Coffee" },
    { start: "11:40", end: "12:30", kind: "session", track: "technical", module: "T2", title: "Lab 1", type: "Lab" },
    { start: "11:00", end: "11:40", kind: "session", track: "technical", module: "T1", title: "Talk 1", type: "Talk" },
    { start: "11:00", end: "12:30", kind: "session", track: "policy", module: "M1", title: "From journey to capabilities" },
  ],
};
const schedule: WorkshopSchedule = { tracks, days: [day1, { day: 2, slots: [{ start: "09:00", end: "10:00", kind: "joint", title: "Recap" }] }] };

describe("layoutDay: a day's slots on the grid", () => {
  const lay = layoutDay(day1.slots, tracks);
  test("one row per interval between consecutive times", () => {
    expect(lay.times).toEqual(["08:30", "09:00", "10:30", "11:00", "11:40", "12:30"]);
  });
  test("a slot spans the rows from its start to its end", () => {
    const m1 = lay.slots.find((p) => p.slot.module === "M1")!;
    expect([m1.row, m1.rowEnd, m1.track]).toEqual([4, 6, 0]);
    const t2 = lay.slots.find((p) => p.slot.module === "T2")!;
    expect([t2.row, t2.rowEnd, t2.track]).toEqual([5, 6, 1]);
  });
  test("joint sessions, breaks and logistics span every track: no track", () => {
    for (const p of lay.slots.filter((x) => x.slot.kind !== "session")) expect(p.track).toBeUndefined();
  });
  test("reading order is by time, then a spanning slot, then track order", () => {
    expect(lay.slots.map((p) => p.slot.module ?? p.slot.title)).toEqual(["Registration", "The story we follow", "Coffee", "M1", "T1", "T2"]);
  });
});

describe("tableRows: the day as table rows", () => {
  const rows = tableRows(layoutDay(day1.slots, tracks), 2);
  const shape = rows.map((r) => [r.time, r.cells.map((c) => ("empty" in c ? "·" : `${c.slot.slot.module ?? c.slot.slot.kind}${c.rowspan > 1 ? `↓${c.rowspan}` : ""}${c.colspan > 1 ? `→${c.colspan}` : ""}`)).join(" ")]);
  test("a row per interval; a spanning slot takes every track; a long block rowspans opposite shorter ones", () => {
    expect(shape).toEqual([
      ["08:30", "logistics→2"],
      ["09:00", "joint→2"],
      ["10:30", "break→2"],
      ["11:00", "M1↓2 T1"],
      ["11:40", "T2"],
    ]);
  });
  test("a track with nothing in an interval gets an empty cell", () => {
    const r = tableRows(layoutDay([{ start: "09:00", end: "10:00", kind: "session", track: "technical", title: "x" }], tracks), 2);
    expect(r[0]!.cells.map((c) => "empty" in c)).toEqual([true, false]);
  });
});

describe("the schedule in the workshop schema", () => {
  const base = { $schema: "workshop/0.1.0", id: "technical", title: "T", description: "d", scenarios: ["j1"], modules: [{ id: "T1", title: "One" }, { id: "T2", title: "Two" }] };
  test("a consistent schedule parses", () => {
    expect(parseWorkshop({ ...base, schedule }).schedule?.days).toHaveLength(2);
  });
  test("a session in an unlisted track, a break in a track, and a slot ending before it starts are refused", () => {
    const one = (slot: object) => ({ ...base, schedule: { tracks, days: [{ day: 1, slots: [slot] }] } });
    expect(() => parseWorkshop(one({ start: "09:00", end: "10:00", kind: "session", track: "nope", title: "x" }))).toThrow(/track "nope"/);
    expect(() => parseWorkshop(one({ start: "09:00", end: "10:00", kind: "break", track: "technical", title: "x" }))).toThrow(/drop its track/);
    expect(() => parseWorkshop(one({ start: "10:00", end: "09:00", kind: "joint", title: "x" }))).toThrow(/ends before it starts/);
  });
  test("a module of this workshop's own track must be one it lists; a sibling's track is not checked here", () => {
    const one = (slot: object) => ({ ...base, schedule: { tracks, days: [{ day: 1, slots: [slot] }] } });
    expect(() => parseWorkshop(one({ start: "09:00", end: "10:00", kind: "session", track: "technical", module: "T9", title: "x" }))).toThrow(/module "T9"/);
    expect(parseWorkshop(one({ start: "09:00", end: "10:00", kind: "session", track: "policy", module: "M9", title: "x" })).schedule).toBeDefined();
  });
  test("two slots of one track that overlap are refused, and a session under a joint one", () => {
    const slots = [
      { start: "09:00", end: "10:00", kind: "joint", title: "Joint" },
      { start: "09:30", end: "10:30", kind: "session", track: "technical", title: "Clash" },
    ];
    expect(() => parseWorkshop({ ...base, schedule: { tracks, days: [{ day: 1, slots }] } })).toThrow(/overlaps/);
  });
  test("a time is HH:MM", () => {
    expect(() => parseWorkshop({ ...base, schedule: { tracks, days: [{ day: 1, slots: [{ start: "9:00", end: "10:00", kind: "joint", title: "x" }] }] } })).toThrow(/HH:MM/);
  });
});

const entry = (id: string, modules: string[], sched?: WorkshopSchedule): WorkshopEntry =>
  ({ instance: "demo", file: `workshops/${id}.json`, workshop: { id, title: id, description: "d", scenarios: ["j1"], modules: modules.map((m) => ({ id: m, title: m })), ...(sched ? { schedule: sched } : {}) } }) as unknown as WorkshopEntry;

describe("scheduleFor and scheduleHtml", () => {
  const technical = entry("technical", ["T1", "T2"], schedule);
  const policy = entry("policy", ["M1"]);
  const corpus = { workshops: [policy, technical] } as unknown as JourneyCorpus;

  test("a workshop with no schedule shows the sibling's that names it as a track", () => {
    expect(scheduleFor(corpus, policy)?.owner).toBe(technical);
    expect(scheduleFor(corpus, technical)?.owner).toBe(technical);
    expect(scheduleFor({ workshops: [policy] } as unknown as JourneyCorpus, policy)).toBeUndefined();
  });

  test("the title says how many days", () => {
    expect(scheduleTitle(schedule)).toBe("The two days");
    expect(scheduleTitle({ ...schedule, title: "Our days" })).toBe("Our days");
  });

  test("each module links to its page, in its own track's workshop", () => {
    const fromPolicy = scheduleHtml({ corpus, here: policy, owner: technical, schedule, toWorkshops: "../../" });
    expect(fromPolicy).toContain(`href="../../policy/m1/"`);
    expect(fromPolicy).toContain(`href="../../technical/t1/"`);
    // The track the page belongs to is marked.
    expect(fromPolicy).toMatch(/jv-cal-session jv-cal-t0 is-here[^>]*>\s*<p class="jv-cal-when"><time>11:00<\/time>/);
  });

  test("a semantic table per day: caption, column headers, a row header per time; spanning rows colspan, long blocks rowspan", () => {
    const html = scheduleHtml({ corpus, here: technical, owner: technical, schedule, toWorkshops: "../" });
    expect(html).toContain(`<h2 id="the-days-h">The two days</h2>`);
    expect(html).toContain(`<caption><b>Day 1</b> <span class="jv-cal-sum">Concepts and the stack.</span></caption>`);
    expect(html).toContain(`<th scope="col" class="jv-cal-timeh">Time</th><th scope="col" class="jv-cal-head jv-cal-t0">Policy track</th><th scope="col" class="jv-cal-head jv-cal-t1 is-here">Technical track</th>`);
    expect(html).toContain(`<th scope="row" class="jv-cal-time"><time>11:40</time></th>`);
    expect(html).toMatch(/<td class="jv-cal-slot jv-cal-joint" colspan="2">/);
    expect(html).toMatch(/<td class="jv-cal-slot jv-cal-session jv-cal-t0" rowspan="2">\s*<p class="jv-cal-when"><time>11:00<\/time>–<time>12:30<\/time>/);
    expect(html).toContain(`<ul class="jv-cal-parts"><li>P1.1 Welcome</li><li>P1.2 Remarks</li></ul>`);
    expect((html.match(/<table /g) ?? []).length).toBe(2);
  });

  test("a module the corpus does not list is named, not linked", () => {
    const html = scheduleHtml({ corpus: { workshops: [technical] } as unknown as JourneyCorpus, here: technical, owner: technical, schedule, toWorkshops: "../" });
    expect(html).toContain(`<span class="jv-cal-code">M1</span>`);
  });
});

describe("storyOf: the overview's sentence when the workshop gives no story", () => {
  test("the first sentence of the first paragraph, as plain text", () => {
    const d = "The technical track of a [two-day](../x/) workshop, taught from **J1 to J4.1** of one family. It runs beside the policy track.\n\n## The two days\n\n| Time | Session |\n|---|---|\n| 08:30 | x |";
    expect(storyOf(d)).toBe("The technical track of a two-day workshop, taught from J1 to J4.1 of one family.");
  });
  test("a leading heading is skipped; one sentence with no stop is kept whole", () => {
    expect(storyOf("## Intro\n\nA story with no full stop")).toBe("A story with no full stop");
  });
});
