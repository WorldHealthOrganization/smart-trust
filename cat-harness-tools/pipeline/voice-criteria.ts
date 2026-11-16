/**
 * The voice-overlay QA criteria, DERIVED from the voices rather than written
 * out one per voice.
 *
 * ## What was here before, and what it cost
 *
 * `qa-criteria-registry.ts` carried four hand-written entries —
 * `voice-overlay-who-editorial`, `-who-guideline-development`,
 * `-who-publication-design` and `-milnor` — each restating that voice's rules
 * in prose. Three of them described files in ANOTHER LAYER
 * (`who-style-guide`), and every one of them restated rules **without the
 * citation the voice itself carries**. So the platform held an uncited copy of
 * rules the owning layer holds cited, in the one subsystem whose whole
 * argument is that a voice is auditable rather than asserted. Bean `btuv`;
 * `check-voices.ts` exists because PR #210 shipped ten plausible rules with
 * `source: null`.
 *
 * It was generic machinery HAND-INSTANTIATED per voice, which is why the
 * content leaked in: there was no way for a layer to contribute a
 * criterion, so a voice shipping anywhere had to be written into the platform
 * by hand. Now a voice shipping in any layer gets its criterion with no
 * platform edit at all, and the platform holds no layer's rules.
 *
 * ## The description names the voice; it does not restate it
 *
 * The four hand-written descriptions enumerated each voice's rules — 402 to 602
 * characters of prose per voice. The derived one says what the voice IS, where
 * it came from, how many rules it carries and where to read them. That is a
 * deliberate loss of detail: the detail was exactly the uncited restatement,
 * and a reader who needs it follows the citation to the rule that carries its
 * page and quote.
 *
 * ## Lazy, and that is forced rather than preferred
 *
 * Deriving means reading the filesystem. `QA_CRITERIA_REGISTRY` is a
 * module-scope `const`, and module-scope filesystem work is what bean `1hkj`
 * deferred and what `check:module-scope-resolution` now gates — a malformed
 * declaration must not be able to abort a module and strand its exports. So
 * these are computed on first call and memoised per layer root, never at
 * import.
 *
 * @module pipeline/voice-criteria
 */

import { loadVoices, VOICE_ARTEFACT_KINDS, type VoiceProfile } from "../schemas/content/voices.ts";
import { layerRootsIn, readDeclaration, siblingScopeFor } from "../schemas/kg/cat-harness.ts";
import type { QaCriterionDefinition } from "../schemas/sdlc/block-qa.ts";

/**
 * A voice, plus the layer that ships it.
 *
 * The layer is carried because the criterion's description names it: a
 * reader of a finding has to know which repository to open, and three of the
 * four voices here are not in the one running the check.
 */
export interface OwnedVoice {
  voice: VoiceProfile;
  /** The declared name of the layer shipping it. */
  instance: string;
}

/**
 * Every voice shipped anywhere in this repository, sorted by id.
 *
 * Across layers rather than `loadVoices(root)` alone, because a voice is
 * owned by whoever DERIVED it and the platform derives none. `loadVoices`
 * reads one layer; this asks every layer the repository declares.
 *
 * **A layer whose voices will not load throws**, as `loadVoices` does. A
 * malformed voice must not present as a folio with fewer voices: the second is
 * a legitimate state and the first is a defect, and collapsing them is the
 * false-clean this repository keeps paying for.
 */
export function shippedVoices(instanceRoot: string): OwnedVoice[] {
  // `siblingScopeFor`, not `repoRootFor`: for the root layer `dirname` is
  // outside the checkout and lists no layer at all — zero voices (g43f).
  const repo = siblingScopeFor(instanceRoot);
  const out: OwnedVoice[] = [];
  for (const root of layerRootsIn(repo)) {
    const name = readDeclaration(root)?.name;
    if (name === undefined) continue;
    for (const voice of loadVoices(root)) out.push({ voice, instance: name });
  }
  return out.sort((a, b) => a.voice.id.localeCompare(b.voice.id));
}

/** The overlay criterion id for a voice. One rule, one place. */
export function overlayCriterionId(voiceId: string): string {
  return `voice-overlay-${voiceId}`;
}

/**
 * The severity of a finding against a voice as a whole.
 *
 * Read from the voice, with a documented default of `major` — NOT derived from
 * the rules. The obvious derivation, the worst rule's severity, agrees on two
 * of the four voices in this repository and disagrees on two:
 * `who-publication-design` carries `critical` rules and is registered `major`;
 * `milnor`'s worst rule is `major` and it is registered `minor`. Deriving it
 * would have silently re-graded half the corpus, which is why
 * `overlaySeverity` is a declared field. See `schemas/content/voices.ts`.
 */
export function overlaySeverityOf(v: VoiceProfile): "critical" | "major" | "minor" {
  const declared = (v as { overlaySeverity?: unknown }).overlaySeverity;
  return declared === "critical" || declared === "major" || declared === "minor"
    ? declared
    : "major";
}

/** How a voice's provenance reads in a criterion description. */
function provenancePhrase(v: VoiceProfile): string {
  const titles = (v.sources ?? []).map((s) => s.title).filter(Boolean);
  if (titles.length === 0) {
    // `provenance` is a required field, so this is "declares no source", not
    // "unknown" — and a voice asserting rules from nowhere is worth saying out
    // loud in the criterion a reviewer reads.
    return "It declares no source publication";
  }
  return `Derived from ${titles.join("; ")}`;
}

/**
 * One criterion per voice.
 *
 * Every field except `description` matches what the hand-written entries
 * carried, and `scripts/tests/content/voice-criteria.test.ts` asserts that against the
 * four this repository ships rather than trusting it.
 */
export function voiceOverlayCriteria(instanceRoot: string): QaCriterionDefinition[] {
  return shippedVoices(instanceRoot).filter(({ voice }) => judgesBlocks(voice)).map(({ voice, instance }) => {
    const n = voice.rules.length;
    const mechanical = voice.rules.filter((r) => (r.patterns?.length ?? 0) > 0).length;
    return {
      id: overlayCriterionId(voice.id),
      domain: "voice",
      description:
        `Prose conforms to the ${voice.title} voice — ${n} rule(s), ` +
        `${mechanical} with a mechanical half, shipped by \`${instance}\` at ` +
        `\`skills/voices/${voice.id}/\`. ${provenancePhrase(voice)}. ` +
        `EVERY RULE CARRIES THE PAGE AND QUOTE IT WAS READ FROM: uphold a ` +
        `finding by opening that citation, never by trusting a restatement. ` +
        `This description deliberately does not list the rules — the list used ` +
        `to live here, uncited, and that is the defect it was written to fix.`,
      default_severity: overlaySeverityOf(voice),
      voices: [voice.id],
      depends_on: ["md"],
      // The mechanical half belongs to the individual rules' `patterns`, run by
      // the voice checkers; the overlay itself is an adjudication.
      automated: false,
    } as QaCriterionDefinition;
  });
}

/**
 * Whether a voice judges folio BLOCKS at all. A voice scoped only to artefact
 * kinds (`appliesTo: ["skill"]` — the skill-authoring voices, bean `rkqp`) is
 * judged through its own axis (`skill-voice-review-current`), so a block
 * overlay criterion for it would ask an agent to hold prose to rules written
 * for a SKILL.md. Absent `appliesTo` means every kind, blocks included.
 */
export function judgesBlocks(voice: VoiceProfile): boolean {
  const scope = voice.appliesTo;
  return scope === undefined || scope.some((k) => !(VOICE_ARTEFACT_KINDS as readonly string[]).includes(k));
}

/** Memoised per layer root — the filesystem is read once per process. */
const CACHE = new Map<string, QaCriterionDefinition[]>();

/**
 * The voice criteria for a layer, computed once.
 *
 * Callers use this rather than {@link voiceOverlayCriteria} directly; the
 * uncached form stays exported for a test that wants a fresh read after
 * writing a fixture.
 */
export function voiceCriteriaFor(instanceRoot: string): QaCriterionDefinition[] {
  let hit = CACHE.get(instanceRoot);
  if (hit === undefined) {
    hit = voiceOverlayCriteria(instanceRoot);
    CACHE.set(instanceRoot, hit);
  }
  return hit;
}
