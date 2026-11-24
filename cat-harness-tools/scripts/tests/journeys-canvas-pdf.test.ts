/**
 * The canvas, written out as an editable, pre-filled PDF
 * (`scripts/journeys/assets/canvas-pdf.js`, owner 2026-11-17): from the model
 * `canvas-form.ts` makes, every key an AcroForm field named by it and filled
 * with what the browser kept under it; written by hand, so its structure
 * (objects, the xref table, the trailer) is checked here byte by byte.
 *
 * @module scripts/tests/journeys-canvas-pdf
 */
import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

import { canvasModel, type AnnexQuestion } from "../journeys/canvas-form.ts";
import type { WorkshopCanvas } from "../../schemas/process/workshop.ts";

const lib = createRequire(import.meta.url)("../journeys/assets/canvas-pdf.js") as { build: (model: unknown, get: (k: string) => string | null) => Uint8Array };

const canvas: WorkshopCanvas = {
  title: "Country Canvas",
  size: "A3",
  sheets: [
    {
      id: "cover",
      label: "Cover",
      title: "Who we are",
      intro: "Fill this in first — together.",
      sections: [
        {
          id: "table",
          title: "The table",
          fields: [
            { id: "country", type: "text", label: "Country", lines: 1 },
            { id: "usecase", type: "text", label: "Our use case", lines: 4 },
            { id: "stage", type: "choice", label: "Where we are", options: [{ id: "pilot", label: "Pilot" }, { id: "scale", label: "At scale" }] },
            { id: "std", type: "ticks", label: "Standards", options: [{ id: "fhir", label: "FHIR" }, { id: "icao", label: "ICAO VDS" }] },
          ],
        },
      ],
    },
    {
      id: "s1",
      label: "Sheet 1",
      title: "Who decides",
      modules: ["M5"],
      sections: [
        {
          id: "rights",
          fields: [
            {
              id: "rights",
              type: "grid",
              label: "Decision rights",
              rows: Array.from({ length: 60 }, (_, i) => ({ id: `r${i}`, label: `Right number ${i}, which a ministry or an agency holds` })),
              columns: [{ id: "today", label: "Today", cell: "text" }, { id: "signed", label: "Signed?", cell: "tick" }],
            },
            { id: "gap", type: "gap", label: "Gap strip", rows: [{ id: "anchor", label: "Trust anchor" }], options: [{ id: "yes", label: "Exists" }, { id: "part", label: "Partly" }, { id: "no", label: "Absent" }] },
          ],
        },
      ],
    },
  ],
};
const annex: AnnexQuestion[] = [{ step: "J4.0b", stepKey: "J4.0b", module: "M5", text: "Who may read it?", key: "track:q:j4-home:J4.0b:t1" }];
const model = canvasModel("track", canvas, annex);
const kept: Record<string, string> = {
  "track:cv:cover:country": "Taifafeki — 中文 (north)",
  "track:cv:cover:stage": "scale",
  "track:cv:cover:std:icao": "1",
  "track:cv:s1:rights:r3:today": "Ministry of Health",
  "track:cv:s1:rights:r3:signed": "1",
  "track:cv:s1:gap:anchor": "part",
  "track:q:j4-home:J4.0b:t1": "the nurse",
};
const bytes = lib.build(model, (k) => kept[k] ?? null);
const pdf = new TextDecoder("latin1").decode(bytes);
const hex = (s: string) => `<FEFF${[...s].map((c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")).join("")}>`;
/** The body of object `n`. */
const obj = (n: number) => new RegExp(`(?:^|\\n)${n} 0 obj\\n([\\s\\S]*?)\\nendobj`).exec(pdf)?.[1] ?? "";
/** The field whose /T is `key`. */
const fieldOf = (key: string) => pdf.split("\nendobj\n").find((o) => o.includes(`/T ${hex(key.replace(/\./g, "_"))}`)) ?? "";

describe("the canvas as an editable, pre-filled PDF", () => {
  test("a well-formed PDF: every xref offset lands on its object, the trailer names the catalog, all ASCII after the header", () => {
    expect(pdf.startsWith("%PDF-1.7\n")).toBe(true);
    expect(pdf.endsWith("%%EOF\n")).toBe(true);
    const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(pdf)![1]);
    expect(pdf.slice(startxref, startxref + 5)).toBe("xref\n");
    const [, count] = /^xref\n0 (\d+)\n/.exec(pdf.slice(startxref))!;
    const entries = pdf.slice(startxref).split("\n").slice(3, 3 + Number(count) - 1);
    expect(entries).toHaveLength(Number(count) - 1);
    entries.forEach((line, i) => {
      const at = Number(line.slice(0, 10));
      expect(pdf.slice(at, at + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
    expect(/trailer\n<< \/Size (\d+) \/Root (\d+) 0 R/.exec(pdf)![1]).toBe(count);
    // Past the header's binary comment, every byte is ASCII, so a stream's /Length is its byte count.
    expect([...bytes.slice(15)].every((b) => b < 128)).toBe(true);
    for (const m of pdf.matchAll(/\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) expect(m[2]!.length).toBe(Number(m[1]));
  });
  test("an AcroForm with every field, drawn by the reader (/NeedAppearances), on A3 landscape pages; a long sheet runs on", () => {
    const root = Number(/\/Root (\d+) 0 R/.exec(pdf)![1]);
    expect(obj(root)).toMatch(/\/AcroForm << \/Fields \[[^\]]+\] \/NeedAppearances true \/DA \(\/Helv 0 Tf 0 g\) \/DR << \/Font << \/Helv \d+ 0 R \/ZaDb \d+ 0 R >> >> >>/);
    expect(pdf).toContain("/MediaBox [0 0 1190.55 841.89]");
    // The cover, and a 60-row sheet that does not fit one page.
    expect(Number(/\/Type \/Pages \/Count (\d+)/.exec(pdf)![1])).toBeGreaterThanOrEqual(2);
    expect((pdf.match(/\/FT \/Tx/g) ?? []).length).toBe(2 + 60 + 1);
    expect(lib.build({ ...model, size: "A4" }, () => null)).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder("latin1").decode(lib.build({ ...model, size: "A4" }, () => null))).toContain("/MediaBox [0 0 841.89 595.28]");
  });
  test("each field is named by its key and holds the browser's answer: text in UTF-16, a tick /Yes, a choice and a gap row as a radio group", () => {
    const country = fieldOf("track:cv:cover:country");
    expect(country).toContain(`/FT /Tx`);
    expect(country).toContain(`/V ${hex("Taifafeki — 中文 (north)")}`);
    expect(country).not.toContain("/Ff 4096");
    expect(fieldOf("track:cv:cover:usecase")).toContain("/Ff 4096");
    expect(fieldOf("track:cv:cover:usecase")).not.toContain("/V ");
    expect(fieldOf("track:cv:cover:std:icao")).toMatch(/\/FT \/Btn [\s\S]*\/V \/Yes \/AS \/Yes [\s\S]*\/AP << \/N << \/Yes \d+ 0 R \/Off \d+ 0 R >> >>/);
    expect(fieldOf("track:cv:cover:std:fhir")).toContain("/V /Off /AS /Off");
    expect(fieldOf("track:cv:s1:rights:r3:signed")).toContain("/V /Yes");
    expect(fieldOf("track:cv:s1:rights:r3:today")).toContain(`/V ${hex("Ministry of Health")}`);
    // A radio group: the parent holds the value, each option a kid with its own on-state.
    const stage = fieldOf("track:cv:cover:stage");
    expect(stage).toMatch(/\/FT \/Btn \/Ff 49152 .*\/V \/scale \/Kids \[\d+ 0 R \d+ 0 R\]/);
    const kids = [.../\/Kids \[([^\]]+)\]/.exec(stage)![1]!.matchAll(/(\d+) 0 R/g)].map((m) => obj(Number(m[1])));
    expect(kids.map((k) => [/\/AS (\/[\w-]+)/.exec(k)![1], /\/AP << \/N << (\/[\w-]+) /.exec(k)![1]])).toEqual([["/Off", "/pilot"], ["/scale", "/scale"]]);
    expect(fieldOf("track:cv:s1:gap:anchor")).toContain("/V /part");
    // An annex question, its "." a "_" in the field name.
    expect(fieldOf("track:q:j4-home:J4.0b:t1")).toContain(`/V ${hex("the nurse")}`);
  });
  test("the page's own text is WinAnsi: Latin kept, a dash in its code, a character outside it a question mark", () => {
    expect(pdf).toContain("(Fill this in first \\227 together.) Tj");
    const zh = lib.build({ ...model, sheets: [{ ...model.sheets[0], title: "中文 sheet" }] }, () => null);
    expect(new TextDecoder("latin1").decode(zh)).toContain("(?? sheet) Tj");
    // A symbol the printed sheets use and WinAnsi lacks is its nearest text, not "?".
    const sym = new TextDecoder("latin1").decode(lib.build({ ...model, sheets: [{ ...model.sheets[0], title: "★ Priority ✓ → next ☐" }] }, () => null));
    expect(sym).toContain("(* Priority v -> next [ ]) Tj");
  });
});
