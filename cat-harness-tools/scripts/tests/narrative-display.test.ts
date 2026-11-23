import { describe, expect, test } from "bun:test";
import { displayNarrative } from "../lib/narrative-display.ts";

const draft = (lang?: string) => ({
  text: `text ${lang ?? "none"}`,
  state: "draft",
  drafted_by: { kind: "agent", id: "a", model: "m" },
  drafted_at: "2026-10-21T00:00:00Z",
  ...(lang ? { lang } : {}),
});

describe("displayNarrative: an untyped reader's one narrative (e1lo stage 3)", () => {
  test("the single form is returned exactly as it is", () => {
    const one = { text: "x", state: "draft", anything: 1 };
    expect(displayNarrative(one)).toBe(one);
  });

  test("a list goes through narrativeFor: locale match, else first", () => {
    const list = [draft("en"), draft("fr")];
    expect(displayNarrative(list)?.lang).toBe("en");
    expect(displayNarrative(list, "fr-CA")?.lang).toBe("fr");
  });

  test("a list that is not a valid slot shows nothing rather than a guess", () => {
    expect(displayNarrative([draft("en"), draft()])).toBeUndefined();
    expect(displayNarrative([])).toBeUndefined();
  });

  test("no narrative is no narrative", () => {
    for (const v of [undefined, null, "text", 3]) expect(displayNarrative(v)).toBeUndefined();
  });
});
