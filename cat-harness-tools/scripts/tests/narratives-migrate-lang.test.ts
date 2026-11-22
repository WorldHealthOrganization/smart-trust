import { describe, expect, test } from "bun:test";
import { migrateText } from "../narratives-migrate-lang.ts";

const draft = (text: string) => ({
  text,
  state: "draft",
  drafted_by: { kind: "agent", id: "a", model: "m" },
  drafted_at: "2026-10-21T00:00:00Z",
});
const file = (doc: unknown) => JSON.stringify(doc, null, 2) + "\n";

describe("narratives:migrate-lang (e1lo 3d)", () => {
  test("a written single narrative becomes a one-entry list naming its language, and nothing else changes", () => {
    const raw = file({ $schema: "x", other: [1, 2.5, "é"], narrative: draft("a figure") });
    const { text, result } = migrateText(raw, "en");
    expect(result).toEqual({ converted: 1, skippedNotAuthored: 0, alreadyList: 0 });
    const out = JSON.parse(text);
    expect(out.narrative).toEqual([{ ...draft("a figure"), lang: "en" }]);
    expect({ ...out, narrative: undefined }).toEqual({ ...JSON.parse(raw), narrative: undefined });
  });

  test("every slot of an images sidecar and a summaries file is converted", () => {
    const images = migrateText(file({ images: [{ id: "i1", narrative: draft("x") }, { id: "i2" }] }), "en");
    expect(images.result.converted).toBe(1);
    const sums = migrateText(file({ summaries: [{ block: "b", narrative: draft("y") }, { block: "c", narrative: draft("z") }] }), "en");
    expect(sums.result.converted).toBe(2);
    expect(JSON.parse(sums.text).summaries[1].narrative[0].lang).toBe("en");
  });

  test("an empty not-authored slot and an existing list are left as they are", () => {
    const empty = file({ narrative: { text: null, state: "not-authored" } });
    expect(migrateText(empty, "en")).toEqual({ text: empty, result: { converted: 0, skippedNotAuthored: 1, alreadyList: 0 } });
    const list = file({ narrative: [{ ...draft("x"), lang: "fr" }] });
    expect(migrateText(list, "en")).toEqual({ text: list, result: { converted: 0, skippedNotAuthored: 0, alreadyList: 1 } });
  });

  test("a file written with \\u escapes keeps them", () => {
    const raw = JSON.stringify({ narrative: draft("Figure 1 — a box") }, null, 2).replace("—", "\\u2014") + "\n";
    const { text, result } = migrateText(raw, "en");
    expect(result.converted).toBe(1);
    expect(text).toContain("\\u2014");
    expect(text).not.toContain("—");
  });

  test("a number written the Python way (`338.0`, `1e-05`) keeps its spelling", () => {
    const raw = file({ bbox: [48.96, 1, 2], narrative: draft("a figure") }).replace("1,", "338.0,").replace("2\n", "1e-05\n");
    expect(raw).toContain("338.0");
    const { text, result } = migrateText(raw, "en");
    expect(result).toEqual({ converted: 1, skippedNotAuthored: 0, alreadyList: 0 });
    expect(text).toContain("338.0,");
    expect(text).toContain("1e-05\n");
    expect(text).toContain("48.96,");
    expect(JSON.parse(text).narrative[0].lang).toBe("en");
  });

  test("every number Python's json writes survives: its repr, not JavaScript's", () => {
    // Written by Python's `json.dumps(..., indent=2)`: `338.0`, `1e-05`,
    // `-0.0`, `1e+20`, `1.5e-07`, `-2.0`, and an integer past 2**53.
    const spellings = ["338.0", "1e-05", "-0.0", "0", "0.1", "1e+20", "1.5e-07", "12345678901234567890", "-2.0"];
    const raw = `{\n  "v": [\n    ${spellings.join(",\n    ")}\n  ],\n  "narrative": ${JSON.stringify(draft("x"), null, 2).replace(/\n/g, "\n  ")}\n}\n`;
    const { text, result } = migrateText(raw, "en");
    expect(result.converted).toBe(1);
    expect(text.slice(0, text.indexOf('"narrative"'))).toBe(raw.slice(0, raw.indexOf('"narrative"')));
  });

  test("a file in neither JSON style is refused, unchanged", () => {
    const raw = '{"narrative": ' + JSON.stringify(draft("x")) + "}";
    const { text, result } = migrateText(raw, "en");
    expect(result.refused).toContain("round-trip");
    expect(text).toBe(raw);
  });
});
