/**
 * The canvas laid out as its printed pages (owner, 2026-11-19: "look exactly
 * like source PDF … position with M1 M2 as appropriate … no additional
 * questions"), and the schedule at a glance near the top of a page ("how do
 * presenters and participants see schedule? should be towards top").
 *
 * @module scripts/tests/journeys-canvas-layout
 */
import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

import { annexOf, canvasFormHtml, canvasKeys, canvasModel, canvasPartsOf, canvasSummaryItems, mdLite, type AnnexQuestion } from "../journeys/canvas-form.ts";
import { glanceSlots, moduleSlots, scheduleGlanceHtml } from "../journeys/schedule.ts";
import type { JourneyCorpus, WorkshopEntry } from "../journeys/read.ts";
import { WorkshopCanvasSchema, WorkshopSchema, type Workshop, type WorkshopCanvas } from "../../schemas/process/workshop.ts";

const lib = createRequire(import.meta.url)("../journeys/assets/canvas-pdf.js") as {
  build: (model: unknown, get: (k: string) => string | null, drawings?: { title: string; w: number; h: number; hex: string }[]) => Uint8Array;
  localNames: (app: unknown, get: (k: string) => string | null) => Record<string, string>;
  hrefSlug: (href: string) => string;
};

const canvas: WorkshopCanvas = WorkshopCanvasSchema.parse({
  title: "Country Canvas",
  masthead: { title: "A workshop", subtitle: "Day 1 and Day 2" },
  annex: false,
  sheets: [
    { id: "cover", title: "Country Canvas", sections: [{ id: "t", fields: [{ id: "country", type: "text", label: "COUNTRY", lines: 1 }] }] },
    {
      id: "s1",
      label: "Sheet 1",
      kicker: "Day 1 · Module 1 · Sheet 1 of 2",
      title: "Our Journey",
      intro: "How it works **today**.",
      header: [{ id: "country", label: "Country", same: "cover:country" }],
      footer: "Based on the fixture.",
      modules: ["M1", "M2"],
      sections: [
        { id: "use", number: "1", title: "Our use case", minutes: 8, module: ["M1"], fields: [{ id: "use", type: "blanks", text: "A child vaccinated in ___ should be able to ___." }, { id: "d", type: "note", tone: "discuss", text: "Agree one sentence." }] },
        {
          id: "journey",
          number: "2",
          title: "The journey",
          minutes: 25,
          note: "write, then circle one rating",
          module: ["M2"],
          fields: [
            {
              id: "tp",
              type: "cards",
              items: [
                { id: "t1", badge: "1", title: "Vaccinated", text: "A child is vaccinated.", note: "Must be true: …", fields: [{ id: "today", type: "text", label: "IN OUR COUNTRY TODAY", lines: 3 }, { id: "rating", type: "choice", options: [{ id: "works", label: "Works" }, { id: "breaks", label: "Breaks" }] }] },
                { id: "t2", badge: "2", title: "Found", fields: [{ id: "rating", type: "choice", options: [{ id: "works", label: "Works" }, { id: "breaks", label: "Breaks" }] }] },
              ],
            },
          ],
        },
        {
          id: "map",
          layout: "columns",
          split: [1, 1],
          fields: [
            {
              id: "blocks",
              type: "grid",
              rowLabels: false,
              rows: [
                { id: "a", label: "Provider systems", group: ["APPLICATIONS", "Group: CLINIC"], values: { block: "**Provider systems**" } },
                { id: "b", label: "Registry", values: { block: "**Registry**" }, options: [{ id: "y", label: "Y" }, { id: "n", label: "N" }] },
              ],
              columns: [
                { id: "block", label: "Block", cell: "label" },
                { id: "system", label: "System we use today" },
                { id: "epa", label: "E / P / A", cell: "choice", options: [{ id: "e", label: "E" }, { id: "p", label: "P" }, { id: "a", label: "A" }] },
                { id: "basis", label: "Formal basis", cell: "ticks", options: [{ id: "law", label: "Law" }, { id: "none", label: "None" }] },
                { id: "now", label: "Blocks us now", cell: "option", group: "urgency" },
                { id: "wait", label: "Can wait", cell: "option", group: "urgency" },
              ],
            },
            { id: "std", type: "ticks", label: "**STANDARDS**", options: [{ id: "fhir", label: "HL7 FHIR" }, { id: "other", label: "Other", write: true }] },
          ],
        },
      ],
    },
    {
      id: "s2",
      label: "Sheet 2",
      title: "First move",
      modules: ["M2"],
      sections: [{ id: "who", layout: "row", fields: [{ id: "use", type: "blanks", label: "OUR USE CASE · FROM SHEET 1", text: "A child vaccinated in ___ should be able to ___.", same: "s1:use" }] }],
    },
  ],
});

describe("the canvas as its printed pages", () => {
  const html = canvasFormHtml("ws", canvas, [], { stepLink: () => "", answerBox: () => "", moduleLink: (id) => `<a class="jp-mod">${id}</a>` });

  test("a sheet: its band, title, intro, masthead, header write-ins sharing the cover's key, and footer", () => {
    expect(html).toContain('<span class="jp-cv-kick">Day 1 · Module 1 · Sheet 1 of 2</span> <span class="jp-cv-mods"><a class="jp-mod">M1</a><a class="jp-mod">M2</a></span><h3>Our Journey</h3><p>How it works <b>today</b>.</p>');
    expect(html).toContain('<p class="jp-cv-mast"><b>A workshop</b><span>Day 1 and Day 2</span></p>');
    expect(html.match(/name="ws:cv:cover:country"/g)?.length).toBe(2);
    expect(html).toContain('<footer class="jp-cv-foot">Based on the fixture.</footer>');
  });

  test("a section: its number, minutes and note, and the module it is worked in, linked", () => {
    expect(html).toContain('<span class="jp-cv-num">2</span><span class="jp-cv-stt">The journey</span> <span class="jp-cv-meta">25 min · write, then circle one rating</span> <span class="jp-cv-mods"><a class="jp-mod">M2</a></span>');
    expect(html).toContain('data-jp-cv-sec="use" id="canvas-s1-use" data-jp-cv-modules="M1"');
    expect(canvasPartsOf(canvas, "M1").map((x) => x.section.id)).toEqual(["use", "map"]);
    expect(canvasPartsOf(canvas, "M2").map((x) => `${x.sheet.id}:${x.section.id}`)).toEqual(["s1:journey", "s1:map", "s2:who"]);
  });

  test("blanks, cards with their own fields, a grid's printed, choice, ticks and option cells, group rows", () => {
    expect(html).toContain('name="ws:cv:s1:use:1"');
    expect(html).toContain('name="ws:cv:s1:use:2"');
    // A field showing another's blanks keeps no keys of its own.
    expect(html).not.toContain('name="ws:cv:s2:use:1"');
    expect(html.match(/name="ws:cv:s1:use:1"/g)?.length).toBe(2);
    expect(html).toContain('<textarea class="jp-answer jp-cv-in" name="ws:cv:s1:tp:t1:today" rows="3"');
    expect(html).toContain('name="ws:cv:s1:tp:t2:rating" value="breaks"');
    expect(html).toContain('<tr class="jp-cv-grp"><th colspan="6" scope="rowgroup">APPLICATIONS</th></tr><tr class="jp-cv-grp"><th colspan="6" scope="rowgroup">Group: CLINIC</th></tr>');
    expect(html).toContain('<td class="jp-cv-c-label"><b>Provider systems</b></td>');
    expect(html).toContain('name="ws:cv:s1:blocks:a:epa" value="p"');
    expect(html).toContain('name="ws:cv:s1:blocks:b:epa" value="n"');
    expect(html).toContain('name="ws:cv:s1:blocks:a:basis:law"');
    expect(html).toContain('<input type="radio" name="ws:cv:s1:blocks:a:urgency" value="wait"');
    expect(html).toContain('name="ws:cv:s1:std:other:text"');
    expect(html).toContain('<span class="jp-cv-lab"><b>STANDARDS</b></span>');
    expect(html).toContain('<span class="jp-cv-lab jp-cv-caps">IN OUR COUNTRY TODAY</span>');
  });

  test("every key once; the summary and the PDF's model name the same keys", () => {
    const keys = canvasKeys("ws", canvas);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining(["ws:cv:s1:tp:t1:today", "ws:cv:s1:blocks:a:urgency", "ws:cv:s1:std:other:text", "ws:cv:s1:use:2"]));
    const summary = canvasSummaryItems("ws", canvas).flatMap((x) => x.items.map((i) => i.name));
    expect(new Set(summary)).toEqual(new Set(keys));
    const model = canvasModel("ws", canvas, []);
    const modelKeys = new Set(JSON.stringify(model).match(/"key":"ws:cv:[^"]+"/g)!.map((k) => k.slice(7, -1)));
    expect(modelKeys).toEqual(new Set(keys));
    // The writer draws printed words, heading rows, headings alone and write-ins among ticks.
    const pdf = new TextDecoder("latin1").decode(lib.build(model, (k) => (k === "ws:cv:s1:blocks:a:urgency" ? "wait" : null)));
    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(pdf).toContain("(Group: CLINIC) Tj");
    expect(pdf).toContain("(Provider systems) Tj");
  });

  test("no annex when the canvas says so: nothing but the sheet's own fields", () => {
    const q: AnnexQuestion[] = [{ step: "J1", stepKey: "J1", module: "M1", text: "An extra question?", key: "ws:q:1" }];
    expect(annexOf(canvas.sheets[1]!, q, canvas)).toEqual([]);
    expect(annexOf(canvas.sheets[1]!, q, { ...canvas, annex: undefined })).toHaveLength(1);
    expect(canvasFormHtml("ws", canvas, q, { stepLink: () => "", answerBox: () => "" })).not.toContain("An extra question?");
  });

  test("Markdown-light: bold, italics and line breaks, nothing else", () => {
    expect(mdLite("**Narrow**: one *population*\n<b>x</b>")).toBe("<b>Narrow</b>: one <i>population</i><br>&lt;b&gt;x&lt;/b&gt;");
  });

  test("the schema refuses a split that does not add up, a lone option column, and a same that names nothing", () => {
    const base = { $schema: "workshop/0.1.0", id: "w", title: "W", description: "D", scenarios: ["j1"], modules: [{ id: "M1", title: "One" }, { id: "M2", title: "Two" }] };
    const ok = (c: unknown) => WorkshopSchema.safeParse({ ...base, canvas: c }).success;
    expect(ok(canvas)).toBe(true);
    const s1 = canvas.sheets[1]!;
    const withSection = (i: number, x: object) => ({ ...canvas, sheets: canvas.sheets.map((s) => (s.id === "s1" ? { ...s1, sections: s1.sections.map((y, j) => (j === i ? { ...y, ...x } : y)) } : s)) });
    expect(ok(withSection(2, { split: [2, 1] }))).toBe(false);
    expect(ok({ ...canvas, sheets: canvas.sheets.map((s) => (s.id === "s2" ? { ...s, sections: [{ id: "who", fields: [{ id: "use", type: "blanks", text: "___", same: "s1:nothing" }] }] } : s)) })).toBe(false);
    const lone = { ...canvas, sheets: [{ id: "x", title: "X", sections: [{ id: "x", fields: [{ id: "g", type: "grid", rows: [{ id: "r", label: "R" }], columns: [{ id: "a", label: "A", cell: "option", group: "g" }] }] }] }] };
    expect(ok(lone)).toBe(false);
  });
});

describe("the schedule at a glance", () => {
  const policy = { $schema: "workshop/0.1.0", id: "policy", title: "Policy", description: "D", scenarios: [], modules: [{ id: "M1", title: "From journey to capabilities" }] } as unknown as Workshop;
  const tech = {
    ...policy,
    id: "tech",
    title: "Tech",
    modules: [{ id: "T1", title: "Stack" }],
    schedule: {
      tracks: [{ id: "policy", label: "Policy track", workshop: "policy" }, { id: "technical", label: "Technical track" }],
      days: [
        {
          day: 1,
          slots: [
            { start: "09:00", end: "10:30", kind: "joint", title: "Welcome" },
            { start: "11:00", end: "12:30", kind: "session", track: "policy", module: "M1", title: "From journey to capabilities" },
            { start: "11:00", end: "12:30", kind: "session", track: "technical", module: "T1", title: "Stack" },
            { start: "10:30", end: "11:00", kind: "break", title: "Coffee" },
          ],
        },
        { day: 2, slots: [{ start: "09:00", end: "10:00", kind: "joint", title: "Recap" }] },
      ],
    },
  } as unknown as Workshop;
  const entry = (w: Workshop): WorkshopEntry => ({ instance: "top", file: `${w.id}.workshop.json`, dir: "/x", workshop: w });
  const here = entry(policy);
  const owner = entry(tech);
  const corpus = { workshops: [here, owner] } as unknown as JourneyCorpus;
  const d = { corpus, here, owner, schedule: tech.schedule!, toWorkshops: "../" };

  test("a day's slots of this workshop's own track and the shared ones, in time order; not the other track's", () => {
    const days = glanceSlots(d);
    expect(days[0]!.slots.map((s) => s.slot.title)).toEqual(["Welcome", "Coffee", "From journey to capabilities"]);
    expect(days[0]!.slots[2]).toMatchObject({ where: "Policy track", href: "../policy/m1/" });
    expect(moduleSlots(d, "M1").map((s) => `${s.day} ${s.slot.start}`)).toEqual(["1 11:00"]);
  });

  test("a tab per day, the first shown, the rest hidden, a line per slot with its time, module, title and track; the full timetable linked", () => {
    const html = scheduleGlanceHtml({ ...d, full: "#the-days" });
    expect(html).toContain('<button type="button" class="jv-glance-tab" data-jv-glance-day="1" aria-pressed="true">Day 1</button>');
    expect(html).toContain('<ol class="jv-glance-day" data-jv-glance-list="2" hidden>');
    expect(html).toContain('<li class="jv-glance-slot jv-cal-session" data-jv-start="11:00" data-jv-end="12:30"><span class="jv-glance-time"><time>11:00</time>–<time>12:30</time></span><span class="jv-glance-what"><a class="jv-cal-code" href="../policy/m1/">M1</a> From journey to capabilities</span><span class="jv-glance-where">Policy track</span>');
    expect(html).not.toContain("Stack");
    expect(html).toContain('<a class="jv-glance-full" href="#the-days">The two days: full timetable</a>');
    expect(html).toContain("data-jv-glance-now hidden");
  });
});

describe("the summary reads each canvas answer by name (owner, 2026-11-19)", () => {
  const items = canvasSummaryItems("ws", canvas).flatMap((x) => x.items);
  test("a choice shows the option chosen, under its section, card and field; ticks gather under their row", () => {
    expect(items.find((i) => i.name === "ws:cv:s1:tp:t1:rating")).toMatchObject({ label: "The journey · 1 Vaccinated", type: "choice", each: true });
    expect(items.find((i) => i.name === "ws:cv:s1:tp:t1:today")).toMatchObject({ label: "The journey · 1 Vaccinated · In our country today", type: "text" });
    expect(items.find((i) => i.name === "ws:cv:s1:blocks:a:epa")).toMatchObject({ label: "Provider systems · E / P / A", each: true });
    expect(items.find((i) => i.name === "ws:cv:s1:blocks:a:basis:law")).toMatchObject({ label: "Law", type: "check", group: "Provider systems · Formal basis" });
    expect(items.find((i) => i.name === "ws:cv:s1:blocks:a:urgency")).toMatchObject({ label: "Provider systems", each: true });
    expect(items.every((i) => !i.label.startsWith(" ·") && !i.label.startsWith("·"))).toBe(true);
  });
});

describe("the PDF's appendix: our systems, the architecture, the drawings, under the table's own names (owner, 2026-11-19)", () => {
  const appendix = {
    systems: [
      { name: "Patient record (EHR)", slug: "patient-record-ehr", have: "ws:am:patient-record-ehr:have", local: "ws:am:patient-record-ehr:name" },
      { name: "VHL viewer", slug: "vhl-viewer", have: "ws:am:vhl-viewer:have", local: "ws:am:vhl-viewer:name" },
    ],
    panel: { title: "Architecture", countries: ["Taifafeki", "Onesa"], rows: [{ layer: "Point of service", cells: [[{ name: "Patient record (EHR)", slug: "patient-record-ehr" }], [{ name: "VHL viewer", slug: "vhl-viewer" }]] }] },
    figures: [{ kind: "archimate", title: "Systems", src: "x.svg" }],
  };
  const kept: Record<string, string> = { "ws:am:patient-record-ehr:name": "TaifaCare EHR", "ws:am:patient-record-ehr:have": "1" };
  const get = (k: string) => kept[k] ?? null;
  // A 1×1 JPEG, as the browser's canvas writes it.
  const jpeg = "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fbd3ffd9";
  const model = { ...canvasModel("ws", canvas, []), appendix };
  const pdf = new TextDecoder("latin1").decode(lib.build(model, get, [{ title: "ArchiMate view: Systems", w: 1, h: 1, hex: jpeg }]));
  const hex = (x: string) => `<FEFF${[...x].map((c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")).join("")}>`;

  test("the table's names, by element; an element page's address gives its slug", () => {
    expect(lib.localNames(appendix, get)).toEqual({ "patient-record-ehr": "TaifaCare EHR" });
    expect(lib.hrefSlug("../../../en/x/archimate/0.1.0/element/patient-record-ehr/")).toBe("patient-record-ehr");
  });
  test("our systems as fields, filled in: the tick and the name kept under How it works' keys", () => {
    expect(pdf).toContain("(Our systems) Tj");
    expect(pdf).toMatch(new RegExp(`/T ${hex("ws:am:patient-record-ehr:name")}[^\n]*/V ${hex("TaifaCare EHR")}`));
    expect(pdf).toMatch(new RegExp(`/T ${hex("ws:am:patient-record-ehr:have")}[^\n]*/V /Yes`));
  });
  test("the architecture panel with the table's name in place of the reference one", () => {
    expect(pdf).toContain("(TaifaCare EHR) Tj");
    expect(pdf).toContain("(VHL viewer) Tj");
  });
  test("each drawing on a page of its own, as a JPEG image", () => {
    expect(pdf).toContain("/Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode]");
    expect(pdf).toMatch(/\/XObject << \/Im1 \d+ 0 R >>/);
    expect(pdf).toContain("/Im1 Do Q");
    expect(pdf).toContain("(ArchiMate view: Systems) Tj");
  });
});
