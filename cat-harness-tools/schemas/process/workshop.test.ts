import { describe, expect, test } from "bun:test";
import { parseWorkshop } from "./workshop";

const base = {
  $schema: "workshop/0.1.0",
  id: "w",
  title: "W",
  description: "d",
  scenarios: ["j1"],
  modules: [{ id: "M1", title: "One", sheet: "s1", tables: ["rights"] }],
  tables: [{ id: "rights", title: "Rights", rows: [{ id: "anchor", label: "Trust anchor" }] }],
  sheets: [{ id: "s1", title: "Sheet", modules: ["M1"] }],
  steps: [{ scenario: "j1", step: "J1", questions: [{ module: "M1", text: "Who signs?" }], tags: [{ table: "rights", row: "anchor" }] }],
};

describe("workshop: every module, table, row and sheet it names is its own", () => {
  test("a consistent workshop parses, and a sheet defaults to A3", () => {
    expect(parseWorkshop(base).sheets![0]!.size).toBe("A3");
  });
  test("a question in an undeclared module is refused", () => {
    expect(() => parseWorkshop({ ...base, steps: [{ scenario: "j1", step: "J1", questions: [{ module: "M9", text: "?" }] }] })).toThrow(/module "M9"/);
  });
  test("a tag on an unknown row, and a module filling an unknown sheet, are refused", () => {
    expect(() => parseWorkshop({ ...base, steps: [{ scenario: "j1", step: "J1", tags: [{ table: "rights", row: "nobody" }] }] })).toThrow(/row "nobody"/);
    expect(() => parseWorkshop({ ...base, modules: [{ id: "M1", title: "One", sheet: "s9" }] })).toThrow(/sheet "s9"/);
  });
  test("the presentation's views, notes, IG pages and device demo parse; a screen with no step is refused", () => {
    const presentation = {
      notes: { map: "Read across." },
      closingQuestion: "What must countries agree on?",
      views: [{ model: "0.1.0", view: "id-1", label: "Systems" }],
      ig: { href: "", example: "artifact/{type}-{id}.html", processes: "business-processes.html" },
      deviceDemo: { href: "vaxlink/", screens: [{ id: "S1", title: "Birth", device: "tablet" as const, steps: ["J1"], try: "Print the cards" }] },
    };
    expect(parseWorkshop({ ...base, presentation }).presentation).toEqual(presentation);
    expect(() => parseWorkshop({ ...base, presentation: { deviceDemo: { href: "x/", screens: [{ id: "S1", title: "t", steps: [] }] } } })).toThrow();
    expect(() => parseWorkshop({ ...base, presentation: { notes: { overview: "no" } } })).toThrow();
  });
  test("the same step twice is refused", () => {
    expect(() => parseWorkshop({ ...base, steps: [base.steps[0], base.steps[0]] })).toThrow(/appears twice/);
  });
});

describe("workshop: the canvas files and the module × journey matrix (JV-05, JV-06)", () => {
  const two = {
    ...base,
    modules: [...base.modules, { id: "M2", title: "Two" }],
    steps: [
      ...base.steps,
      { scenario: "j1", step: "J2", questions: [{ module: "M2", text: "Who holds it?" }] },
    ],
  };
  test("sheetsSource names a Word file, a PDF or previews, and nothing else", () => {
    const sheetsSource = { title: "Country Canvas", docx: "../input/c.docx", pdf: "https://example.org/c.pdf", previews: ["../input/p1.png"], size: "A3" as const };
    expect(parseWorkshop({ ...base, sheetsSource }).sheetsSource).toEqual(sheetsSource);
    expect(() => parseWorkshop({ ...base, sheetsSource: { title: "No file" } })).toThrow(/names no file/);
    expect(() => parseWorkshop({ ...base, sheetsSource: { previews: [] } })).toThrow();
    expect(() => parseWorkshop({ ...base, sheetsSource: { docx: "c.docx", xlsx: "c.xlsx" } })).toThrow();
  });
  test("a matrix cell is asked where the module's question is, draws elsewhere, and names the workshop's own modules and steps", () => {
    const matrix = {
      cells: [
        { module: "M1", step: "J1", technical: "t", policy: "p" },
        { module: "M2", step: "j1#J1", kind: "draws" as const, policy: "p" },
        { module: "M2", step: "J2", technical: "t" },
      ],
      overlaps: { technical: [{ label: "One registry", modules: ["M1", "M2"], steps: ["J1", "J2"], text: "Read twice." }] },
    };
    expect(parseWorkshop({ ...two, matrix }).matrix).toEqual(matrix);
    expect(() => parseWorkshop({ ...two, matrix: { cells: [{ module: "M1", step: "J2", technical: "t" }] } })).toThrow(/mark it "draws"/);
    expect(() => parseWorkshop({ ...two, matrix: { cells: [{ module: "M1", step: "J1", kind: "draws", technical: "t" }] } })).toThrow(/drop the kind/);
    expect(() => parseWorkshop({ ...two, matrix: { cells: [{ module: "M3", step: "J1", technical: "t" }] } })).toThrow(/module "M3"/);
    expect(() => parseWorkshop({ ...two, matrix: { overlaps: { policy: [{ label: "x", modules: ["M1"], steps: ["J9"], text: "t" }] } } })).toThrow(/step "J9"/);
  });
  test("a lab step's matrix needs a step that asks a question", () => {
    const lab = { steps: [{ id: "map", label: "Map", title: "Where?", matrix: true }] };
    expect(parseWorkshop({ ...two, lab }).lab!.steps[0]!.matrix).toBe(true);
    expect(() => parseWorkshop({ ...two, steps: [{ scenario: "j1", step: "J1" }], lab })).toThrow(/draws the matrix/);
  });
});
