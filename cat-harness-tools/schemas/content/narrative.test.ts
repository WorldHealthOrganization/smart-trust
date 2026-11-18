/**
 * One narrative per language, stage 1 (bean `cat-tools-e1lo`, owner ruling
 * 2026-10-20): the optional `lang`, the slot that holds one or a list, and the
 * one reader of a slot.
 *
 * @module schemas/narrative.test
 */
import { describe, expect, test } from "bun:test";

import { NOT_AUTHORED, NarrativeSchema, NarrativeSlotSchema, narrativeFor, narrativesOfSlot, type Narrative } from "./narrative.ts";

const person = { kind: "human" as const, id: "reviewer" };
const draft = (lang?: string): Narrative => ({
  text: lang ? `a description (${lang})` : "a description",
  state: "draft",
  drafted_by: person,
  ...(lang ? { lang } : {}),
});

describe("a narrative names its language", () => {
  test("a BCP 47 tag is accepted, with or without subtags", () => {
    for (const lang of ["en", "fr", "zh-Hant", "pt-BR"]) expect(NarrativeSchema.safeParse(draft(lang)).success).toBe(true);
  });

  test("a written narrative must name its language; the empty slot claims none (stage 4, ruling 1A)", () => {
    expect(NarrativeSchema.safeParse(draft()).success).toBe(false);
    expect(NarrativeSchema.safeParse(draft("en")).success).toBe(true);
    expect(NarrativeSchema.safeParse(NOT_AUTHORED).success).toBe(true);
  });

  test("something that is not a language tag is refused", () => {
    for (const lang of ["English", "en_US", "e", "EN"]) {
      expect({ lang, ok: NarrativeSchema.safeParse(draft(lang)).success }).toEqual({ lang, ok: false });
    }
  });
});

describe("a slot holds one narrative, or one per language", () => {
  test("the bare object is the empty slot only; a written one must be a list (stage 4)", () => {
    expect(narrativesOfSlot(NarrativeSlotSchema.parse(NOT_AUTHORED))).toEqual([NOT_AUTHORED]);
    expect(NarrativeSlotSchema.safeParse(draft("en")).success).toBe(false);
    expect(NarrativeSlotSchema.safeParse(draft()).success).toBe(false);
  });

  test("a list with one entry per language parses, and reads back in order", () => {
    const slot = NarrativeSlotSchema.parse([draft("en"), draft("fr")]);
    expect(narrativesOfSlot(slot).map((n) => n.lang)).toEqual(["en", "fr"]);
  });

  test("FALSIFIED: a list entry with no `lang` is refused", () => {
    expect(NarrativeSlotSchema.safeParse([draft("en"), draft()]).success).toBe(false);
  });

  test("FALSIFIED: the same language twice is refused", () => {
    expect(NarrativeSlotSchema.safeParse([draft("fr"), draft("fr")]).success).toBe(false);
  });

  test("an empty list is refused: no narrative is `not-authored`, not `[]`", () => {
    expect(NarrativeSlotSchema.safeParse([]).success).toBe(false);
  });

  test("each entry is still a narrative: an agent cannot confirm, whatever the language", () => {
    const agentConfirmed = { ...draft("fr"), state: "confirmed", confirmed_by: { kind: "agent", id: "a", model: "m" } };
    expect(NarrativeSlotSchema.safeParse([draft("en"), agentConfirmed]).success).toBe(false);
  });
});

describe("narrativeFor: the one entry a single-text display shows (locale match, else first)", () => {
  const slot = NarrativeSlotSchema.parse([draft("en"), draft("fr-CA"), draft("pt")]);

  test("the reader's language wins, exactly and case-insensitively", () => {
    expect(narrativeFor(slot, "pt").lang).toBe("pt");
    expect(narrativeFor(slot, "FR-ca").lang).toBe("fr-CA");
  });

  test("a regional locale finds its language, and a language finds its regional entry", () => {
    expect(narrativeFor(slot, "en-GB").lang).toBe("en");
    expect(narrativeFor(slot, "fr").lang).toBe("fr-CA");
  });

  test("no locale, or one the slot does not hold, gives the first entry", () => {
    expect(narrativeFor(slot).lang).toBe("en");
    expect(narrativeFor(slot, "ar").lang).toBe("en");
  });

  test("the empty slot is returned as it is", () => {
    expect(narrativeFor(NarrativeSlotSchema.parse(NOT_AUTHORED), "fr")).toEqual(NOT_AUTHORED);
  });
});
