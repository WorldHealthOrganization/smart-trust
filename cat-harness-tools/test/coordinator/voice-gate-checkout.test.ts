/**
 * `voice-gate` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/content/voice-gate.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each reads the voices folio-assistant-sci,
 * smart-base and who-iris ship, or the root layer's voice configuration,
 * which only the checkout holds. Standing alone, cat-harness has none of it,
 * and `check:cat-harness-standalone` collects every test in that layer. The
 * rest of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, test, expect } from "bun:test";
import { join } from "node:path";

import { readActiveVoices } from "../../schemas/content/voices.ts";
import { qaCriteriaByIdFor } from "../../pipeline/qa-criteria-registry.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

describe("readActiveVoices", () => {

  test("this instance activates the base skill-authoring voice", () => {
    // Issue #208: "the folio-asst's own docuemtnation conent doesnt have any
    // voice". Asserted so that activating one here is a deliberate act.
    //
    // The LAYER root, and it has to be: a config belongs to a layer
    // and is named after it, so the question "what does this activate" is
    // only answerable of something that declares itself. `cat-harness/` is
    // where `folio-assistant` is declared; its config sits one level up at
    // the checkout root, and the outward walk finds it there.
    //
    // RESTATED 2026-10-09: the two answers SWAPPED, because the decision
    // moved. The owner's round-5 activation (issue #1694) lived in the root's
    // `folio-assistant.config.json`; the owner removed that file with the root
    // declaration (3d4caf6, 2026-10-08), and the activation now lives on
    // cat-harness's own `index.config.json` entry (`voices.active`). So the
    // layer that judges this checkout's skills is the one that activates the
    // voice, and it is still a DECISION read from config, not a default.
    const inst = join(ORIGIN_DIR, "../..");
    expect(readActiveVoices(inst)).toEqual(["agent-skill-authoring"]);
  });

  test("the checkout root declares no instance, so it has no voices to answer", () => {
    // The other half of the change, asserted rather than left implicit: the
    // root is instantiated, so its answer is a DECISION rather than an
    // absence. Until 2026-09-30 that decision was "no voice"; the owner then
    // activated the base skill-authoring voice for this checkout's skills
    // (round 5, issue #1694). Still determined, which is the point here.
    //
    // RESTATED 2026-10-09, the other half of the swap: the root is an index
    // now, not an instantiated layer, so it has no config and the answer
    // is the third state -- `undefined`, never `[]`, which would be a decision
    // nobody made.
    const root = repoRootFor(join(ORIGIN_DIR, "../.."));
    expect(readActiveVoices(root)).toBeUndefined();
  });
});

describe("the four shipped voices each have a criterion", () => {
  // Issue #208: "make sure agentic sidecaras are set up for each". One criterion
  // per VOICE rather than per rule — 34 rules would put 30 permanently
  // `needs-agent` rows on every sidecar, a queue nobody drains.
  //
  // Read through `qaCriteriaByIdFor` rather than the static `QA_CRITERIA_BY_ID`:
  // since bean `btuv` these four are DERIVED from the voices the repository
  // ships, so the static index no longer carries them and a consumer that reads
  // it alone sees none. That is the consumer-facing half of the change, and this
  // block is where it is checked — `voice-criteria.test.ts` checks the
  // derivation itself.
  const byId = qaCriteriaByIdFor(join(ORIGIN_DIR, "../.."));
  test.each([
    ["voice-overlay-who-editorial"],
    ["voice-overlay-who-guideline-development"],
    ["voice-overlay-who-publication-design"],
    ["voice-overlay-milnor"],
  ])("%s is registered, voice-scoped and agent-adjudicated", (id) => {
    const def = byId[id];
    expect(def).toBeDefined();
    expect(def!.domain).toBe("voice");
    expect(def!.voices).toHaveLength(1);
    expect(def!.automated).toBe(false);
  });
});
