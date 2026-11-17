/**
 * The judgement half of the vector arm, and the one field that makes it worth
 * having.
 *
 * @module scripts/tests/figure-description.test
 * @graphNode none — a test
 *
 * Bean `a8wy`. `basis` exists because a labels-only description of
 * `arxiv-2504.19675v2` Figure 2 got every proper name right and every relation
 * wrong, so a reader must be able to tell which kind of description they are
 * holding. These assertions are the ones that would go red if `basis` or its
 * `unread` companion were ever made optional "to keep it simple".
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  FIGURE_DESCRIPTIONS_FILE,
  FigureDescriptionSchema,
  FigureDescriptionsFileSchema,
} from "../../schemas/content/figure-description.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";
import { narrativesOfSlot } from "../../schemas/content/narrative.ts";

const REPO = join(dirname(HARNESS_ROOT));

const agent = { kind: "agent" as const, id: "claude", model: "claude-opus-5" };
const base = (over: Record<string, unknown> = {}) => ({
  page: 3,
  figure: "Figure 2",
  basis: "labels-and-render",
  described_by: agent,
  described_at: "2026-09-30",
  narrative: [{ state: "draft", lang: "en", text: "A diagram.", drafted_by: agent, drafted_at: "2026-09-30" }],
  ...over,
});

describe("basis is required and closed", () => {
  test("a description with no basis is refused", () => {
    const { basis: _drop, ...noBasis } = base();
    expect(FigureDescriptionSchema.safeParse(noBasis).success).toBe(false);
  });

  test("a third basis cannot be invented", () => {
    expect(FigureDescriptionSchema.safeParse(base({ basis: "skimmed" })).success).toBe(false);
  });

  test("labels-only WITHOUT saying what went unread is refused", () => {
    // Silence about arrows and glyph-only content reads as their absence.
    const r = FigureDescriptionSchema.safeParse(base({ basis: "labels-only" }));
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("could not read");
  });

  test("labels-only WITH it parses", () => {
    expect(
      FigureDescriptionSchema.safeParse(
        base({ basis: "labels-only", unread: "the arrows, and a glyph-only column" }),
      ).success,
    ).toBe(true);
  });

  test("labels-and-render needs no `unread`, and may still carry one", () => {
    expect(FigureDescriptionSchema.safeParse(base()).success).toBe(true);
    expect(FigureDescriptionSchema.safeParse(base({ unread: "nothing" })).success).toBe(true);
  });
});

describe("the narrative rules are the corpus's, not this file's", () => {
  test("an agent cannot confirm its own draft", () => {
    const r = FigureDescriptionSchema.safeParse(
      base({
        narrative: [
          {
            state: "confirmed",
            lang: "en",
            text: "A diagram.",
            drafted_by: agent,
            drafted_at: "2026-09-30",
            confirmed_by: agent,
            confirmed_at: "2026-09-30",
          },
        ],
      }),
    );
    expect(r.success).toBe(false);
  });
});

describe("one description per (page, figure)", () => {
  const file = (list: unknown[]) => ({
    $schema: "folio-figure-descriptions/v1",
    descriptions: { "arxiv-x": list },
  });

  test("the same page and figure twice is refused", () => {
    const r = FigureDescriptionsFileSchema.safeParse(file([base(), base()]));
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("described twice");
  });

  // `figure` is optional because a page may draw something the text never
  // labels. Keying those as `${page}\0""` made every unlabelled drawing on a
  // page the same object, so a page bearing TWO of them could not be
  // described: the second was refused as a duplicate of the first. A review
  // bot found it on #1633.
  test("TWO UNLABELLED figures on one page are both describable", () => {
    const a = base({ figure: undefined, narrative: [{ state: "draft", lang: "en", text: "A flow chart.", drafted_by: agent, drafted_at: "2026-09-30" }] });
    const b = base({ figure: undefined, narrative: [{ state: "draft", lang: "en", text: "A bar chart.", drafted_by: agent, drafted_at: "2026-09-30" }] });
    const r = FigureDescriptionsFileSchema.safeParse(file([a, b]));
    expect(r.success).toBe(true);
  });

  test("...but the SAME unlabelled description twice is still refused", () => {
    // The relaxation must not lose duplicate detection altogether. Two
    // different drawings get two different narratives; a record pasted twice
    // keeps its text, which is what the key uses.
    const a = base({ figure: undefined });
    const r = FigureDescriptionsFileSchema.safeParse(file([a, base({ figure: undefined })]));
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("identical narrative text");
  });

  test("an unlabelled figure does not collide with a LABELLED one on the same page", () => {
    const r = FigureDescriptionsFileSchema.safeParse(
      file([base(), base({ figure: undefined })]),
    );
    expect(r.success).toBe(true);
  });

  test("two figures on ONE page are fine — a page may draw more than one", () => {
    expect(
      FigureDescriptionsFileSchema.safeParse(file([base(), base({ figure: "Figure 3" })])).success,
    ).toBe(true);
  });

  test("an unknown key is refused, so a field cannot arrive unschema'd", () => {
    expect(FigureDescriptionSchema.safeParse(base({ role: "figure" })).success).toBe(false);
  });
});

describe("corpus — the committed file, so this cannot pass on fixtures alone", () => {
  const path = join(REPO, "cat-harness/library", FIGURE_DESCRIPTIONS_FILE);
  // No descriptions written yet is not a failure — but it is not a pass
  // either: the run reports a skip.
  const NO_DESCRIPTIONS = !existsSync(path);

  test.skipIf(NO_DESCRIPTIONS)("cat-harness/library/figure-descriptions.json validates", async () => {
    const f = Bun.file(path);
    const parsed = FigureDescriptionsFileSchema.parse(await f.json());
    const all = Object.values(parsed.descriptions).flat();
    expect(all.length).toBeGreaterThan(0);
    // Nothing is confirmed by an agent, here or ever.
    for (const d of all) {
      for (const n of narrativesOfSlot(d.narrative)) {
        if (n.state === "confirmed") expect(n.confirmed_by?.kind).toBe("human");
      }
    }
    // Every described page exists in that entry's measurement sidecar.
    for (const [doc, list] of Object.entries(parsed.descriptions)) {
      const labels = Bun.file(join(REPO, "cat-harness/library", doc, "vector-labels.json"));
      if (!(await labels.exists())) continue;
      const pages = new Set(
        (((await labels.json()) as { pages?: { page: number }[] }).pages ?? []).map((p) => p.page),
      );
      for (const d of list) {
        expect(pages.has(d.page), `${doc} p${d.page} has no labels recorded`).toBe(true);
      }
    }
  });
});
