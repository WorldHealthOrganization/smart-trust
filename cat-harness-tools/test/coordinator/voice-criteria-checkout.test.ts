/**
 * `voice-criteria` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/content/voice-criteria.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each derives criteria from the
 * voices folio-assistant-sci, smart-base and who-iris ship, which only the
 * checkout holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  QA_CRITERIA_REGISTRY,
  qaCriteriaFor,
  qaCriteriaByIdFor,
} from "../../pipeline/qa-criteria-registry.ts";
import {
  judgesBlocks,
  shippedVoices,
  voiceOverlayCriteria,
} from "../../pipeline/voice-criteria.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const INSTANCE = join(ORIGIN_DIR, "..", "..");

/** Exactly what the four deleted entries declared. */
const AS_HAND_WRITTEN: Record<string, { severity: string }> = {
  "voice-overlay-who-editorial": { severity: "major" },
  "voice-overlay-who-guideline-development": { severity: "critical" },
  "voice-overlay-who-publication-design": { severity: "major" },
  "voice-overlay-milnor": { severity: "minor" },
};

describe("the derivation reproduces the hand-written criteria", () => {
  const derived = voiceOverlayCriteria(INSTANCE);
  const byId = new Map(derived.map((c) => [c.id, c]));

  test("every voice this repository ships that judges BLOCKS produces one criterion", () => {
    expect(derived.length).toBe(shippedVoices(INSTANCE).filter(({ voice }) => judgesBlocks(voice)).length);
    // Four when this landed. Asserted against the voices rather than as a
    // literal, so shipping a fifth voice is not a test failure — that is the
    // point of deriving them.
    expect(derived.length).toBeGreaterThan(0);
  });

  test.each(Object.entries(AS_HAND_WRITTEN))("%s keeps its severity, domain, voices, deps and automated flag", (id, want) => {
    const c = byId.get(id);
    expect(c).toBeDefined();
    expect(c!.default_severity).toBe(want.severity as never);
    expect(c!.domain).toBe("voice");
    expect(c!.voices).toEqual([id.replace("voice-overlay-", "")]);
    expect(c!.depends_on).toEqual(["md"]);
    expect(c!.automated).toBe(false);
  });

  test("no criterion appeared that was not registered before", () => {
    // The derivation is allowed to produce MORE as voices are added; what it
    // must not do is produce a differently-named version of one of these four,
    // which would leave a dangling id in every sidecar already written.
    for (const id of Object.keys(AS_HAND_WRITTEN)) expect(byId.has(id)).toBe(true);
  });
});

describe("the derived criteria reach the consumers", () => {
  test("`qaCriteriaFor` carries them and `QA_CRITERIA_REGISTRY` does not", () => {
    const all = qaCriteriaFor(INSTANCE);
    const staticOnly = QA_CRITERIA_REGISTRY.filter((c) => c.id.startsWith("voice-overlay-"));
    expect(staticOnly).toEqual([]);
    expect(all.filter((c) => c.id.startsWith("voice-overlay-")).length).toBeGreaterThan(0);
    expect(all.length).toBe(QA_CRITERIA_REGISTRY.length + voiceOverlayCriteria(INSTANCE).length);
  });

  test("the by-id index carries them too", () => {
    const idx = qaCriteriaByIdFor(INSTANCE);
    for (const id of Object.keys(AS_HAND_WRITTEN)) expect(idx[id]).toBeDefined();
  });

  test("every voice criterion is agent-adjudicated, which is why the drain queue had to change", () => {
    // All four are `automated: false`, so a consumer filtering the STATIC array
    // for agent work silently dropped four adjudications. `qa-agent-drain-queue`
    // was that consumer.
    for (const c of voiceOverlayCriteria(INSTANCE)) expect(c.automated).toBe(false);
  });
});

describe("the description names the voice and does not restate it", () => {
  test("it says where the voice lives and who ships it", () => {
    const c = voiceOverlayCriteria(INSTANCE).find((x) => x.id === "voice-overlay-milnor")!;
    expect(c.description).toContain("folio-assistant-sci");
    expect(c.description).toContain("skills/voices/milnor/");
  });

  test("it tells a reviewer to open the citation", () => {
    for (const c of voiceOverlayCriteria(INSTANCE)) {
      expect(c.description.toLowerCase()).toContain("citation");
    }
  });

  test("a WHO criterion no longer carries WHO editorial RULES", () => {
    // The point of the bean. Naming the voice is fine — restating its rules in
    // the platform, uncited, is what this removed. The two rules the old
    // descriptions spelled out are the check.
    const c = voiceOverlayCriteria(INSTANCE).find(
      (x) => x.id === "voice-overlay-who-guideline-development",
    )!;
    expect(c.description).not.toContain("not recommended");
    expect(c.description).not.toContain("PICO");
  });
});
