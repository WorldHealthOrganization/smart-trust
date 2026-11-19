/**
 * `voices-viz` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/content/voices-viz.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each draws the voices folio-assistant-sci,
 * smart-base and who-iris ship, which only the checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. The rest of that file's tests stay there; every
 * path here is composed from ORIGIN_DIR, the directory they were written in,
 * so nothing they read changed.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { readVoicesGraph, type VoicesGraph } from "../../scripts/voices-graph.ts";
import { viewerHtml } from "../../scripts/gen-voices-viz.ts";
import { shippedVoices } from "../../pipeline/voice-criteria.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const INSTANCE = join(ORIGIN_DIR, "..", "..");

/** Read once — the reader touches the filesystem across every layer. */
const G: VoicesGraph = (() => {
  const g = readVoicesGraph([INSTANCE]);
  if (g === null) throw new Error("no voices directory is declared — the fixture is the corpus");
  return g;
})();

describe("the reader finds what the declarations say is there", () => {
  test("every voice this repository ships appears exactly once", () => {
    const shipped = shippedVoices(INSTANCE).map((s) => s.voice.id).sort();
    expect(G.voices.map((v) => v.id)).toEqual(shipped);
    expect(new Set(G.voices.map((v) => v.id)).size).toBe(G.voices.length);
  });

  test("a voice is attributed to the instance that DERIVED it, never to the platform", () => {
    // The whole point of the move this graph exists to render: the checkout's
    // root (`folio-assistant`) derives no voice; each is attributed to the
    // layer whose declared voices directory holds it. `cat-harness` is not
    // excluded: it ships voices of its own (`skills/voices/`).
    for (const v of G.voices) expect(v.instance).not.toBe("folio-assistant");
    const owners = new Set(G.voices.map((v) => v.instance));
    expect(owners.size).toBeGreaterThan(1);
  });

  test("the path it reports is the file a reader can actually open", async () => {
    const { existsSync } = await import("node:fs");
    const repo = join(INSTANCE, "..");
    for (const v of G.voices) {
      expect(existsSync(join(repo, v.path))).toBe(true);
    }
  });
});

describe("the provenance QA flag — a question for a person, not a gate", () => {
  test("`house` is never flagged, however its rules cite — the owner's ruling", () => {
    // Owner, 2026-09-21: "c) keep, but is a QA flag". `milnor` declares
    // `house` and all twelve rules cite an ingested paper, because the
    // citations are evidence FOR this project's standard rather than its
    // source. A flag here would reverse a decision that was actually made.
    const milnor = G.voices.find((v) => v.id === "milnor");
    expect(milnor).toBeDefined();
    expect(milnor!.provenance).toBe("house");
    expect(milnor!.rules.every((r) => r.citation === "library")).toBe(true);
    expect(milnor!.provenanceFlags).toEqual([]);
  });

  test("...and it fires on the voice that IS mixed, so the exemption is not a blanket", () => {
    // The falsification. A flag that fires on nothing is indistinguishable
    // from one that cannot fire, and the corpus contains exactly one case:
    // `technical-writer` declares `assertion` while three of its nine rules
    // cite a node of this project's own graph.
    const flagged = G.voices.filter((v) => v.provenanceFlags.length > 0);
    expect(flagged.map((v) => v.id)).toEqual(["technical-writer"]);
    const f = flagged[0]!.provenanceFlags[0]!;
    expect(f.code).toBe("declared-outside-cites-inside");
    expect(f.ruleIds.length).toBe(3);
    // Plain text: the detail is escaped into HTML by the viewer, so markup
    // here reaches the reader as literal characters.
    expect(f.detail).not.toContain("`");
  });

  test("the flag is advisory — nothing about it is a severity the sidecars carry", () => {
    // The distinction the owner's ruling turns on. An overlay criterion has a
    // severity and a QA sidecar; a provenance flag has neither, because a
    // voice that is a synthesis of composite sources is the NORMAL case and
    // refusing it would encode per-rule attribution one level down.
    for (const v of G.voices) {
      for (const f of v.provenanceFlags) {
        expect(f).not.toHaveProperty("severity");
      }
    }
  });

  test("the viewer renders provenance at all, which it did not before", () => {
    // It showed the layer, the path, the rule count, the overlay criterion
    // and the SKILL.md — and never the field this whole section is about.
    const html = viewerHtml("../../assets/voices/index.json");
    expect(html).toContain("renderFlags");
    expect(html).toContain("provenance <b>");
    expect(html).toContain("pflag");
  });
});
