/**
 * Voice inheritance, applicability and provenance.
 *
 * The three axes added 2026-09-20 on the owner's rulings: *"for model specific
 * sources, make those model specific voices"* and *"specialized voices
 * depending on context/process or user scenario/requirements like in CRDM"*.
 */
import { describe, expect, test } from "bun:test";

import {
  VOICE_PROVENANCE,
  VoiceApplicabilitySchema,
  VoiceProfileSchema,
  VoiceSupersessionSchema,
  explainVoiceFailure,
  resolveVoice,
  ruleAppliesHere,
  voiceActiveIn,
  type VoiceProfile,
  type VoiceRef,
} from "./content/voices.js";

function voice(id: string, rules: string[], rest: Partial<VoiceProfile> = {}): VoiceProfile {
  return VoiceProfileSchema.parse({
    $schema: "folio-voice/v1",
    id,
    title: id,
    description: `the ${id} voice`,
    provenance: "assertion",
    sources: [{ title: "a source", path: "schemas/content/voices.ts" }],
    rules: rules.map((r) => ({
      id: r,
      title: r,
      description: `rule ${r}`,
      category: "register",
      severity: "minor",
      source: { path: "schemas/content/voices.ts", quote: "a quote long enough to check against" },
    })),
    ...rest,
  });
}

/** A lookup over a fixed set, as a layer's declaration would supply. */
function lookupOver(vs: Record<string, VoiceProfile>) {
  return (ref: VoiceRef, citing: string) => {
    const v = vs[ref.voiceId];
    return v ? { instance: ref.instance ?? citing, voice: v } : undefined;
  };
}

describe("rules UNION, because two vendors agreeing is evidence", () => {
  test("a child keeps the base's rules and adds its own", () => {
    const base = voice("skill-authoring", ["degrees-of-freedom", "concise"]);
    const child = voice("skill-authoring-claude", ["gerund-names"], {
      extends: { voiceId: "skill-authoring" },
    });
    const r = resolveVoice({ instance: "agent-skills", voice: child }, lookupOver({ "skill-authoring": base }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.voice.rules.map((x) => x.id)).toEqual(["degrees-of-freedom", "concise", "gerund-names"]);
  });

  test("and says WHERE each rule came from — otherwise the union is untraceable", () => {
    const base = voice("skill-authoring", ["degrees-of-freedom"]);
    const child = voice("skill-authoring-gemini", ["progressive-disclosure"], {
      extends: { voiceId: "skill-authoring" },
    });
    const r = resolveVoice({ instance: "agent-skills", voice: child }, lookupOver({ "skill-authoring": base }));
    if (!r.ok) throw new Error("should resolve");
    expect(r.voice.origin.get("degrees-of-freedom")).toBe("agent-skills/skill-authoring");
    expect(r.voice.origin.get("progressive-disclosure")).toBe("agent-skills/skill-authoring-gemini");
  });

  test("a child overrides ONLY by reusing a rule id, and the base rule keeps its place", () => {
    // Position matters: an override that moved the rule to the end would make
    // a diff of the resolved set look like a delete plus an add.
    const base = voice("base", ["a", "b", "c"]);
    const child = voice("child", ["b"], { extends: { voiceId: "base" } });
    child.rules[0]!.description = "the child's version";
    const r = resolveVoice({ instance: "i", voice: child }, lookupOver({ base }));
    if (!r.ok) throw new Error("should resolve");
    expect(r.voice.rules.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(r.voice.rules.find((x) => x.id === "b")?.description).toBe("the child's version");
    expect(r.voice.origin.get("b")).toBe("i/child");
  });
});

describe("what is NOT inherited", () => {
  test("provenance is the child's own — a vendor page does not become evidence", () => {
    // The failure this prevents: a voice read from a vendor page extending one
    // read from a measurement, and thereby acquiring the authority of a result.
    const paper = voice("measured", ["x"], { provenance: "evidence" });
    const vendor = voice("vendor", ["y"], { provenance: "assertion", extends: { voiceId: "measured" } });
    const r = resolveVoice({ instance: "i", voice: vendor }, lookupOver({ measured: paper }));
    if (!r.ok) throw new Error("should resolve");
    expect(r.voice.provenance).toBe("assertion");
  });

  test("supersession is the child's own — a live source does not die with its parent", () => {
    const dead = voice("dead", ["x"], {
      superseded: { on: "2026-06-18", by: "Antigravity CLI", quote: "was replaced by Antigravity CLI" },
    });
    const live = voice("live", ["y"], { extends: { voiceId: "dead" } });
    const r = resolveVoice({ instance: "i", voice: live }, lookupOver({ dead }));
    if (!r.ok) throw new Error("should resolve");
    expect(r.voice.superseded).toBeUndefined();
  });
});

describe("the chain has to terminate, and say so when it does not", () => {
  test("a cycle is reported rather than hanging", () => {
    const a = voice("a", ["x"], { extends: { voiceId: "b" } });
    const b = voice("b", ["y"], { extends: { voiceId: "a" } });
    const r = resolveVoice({ instance: "i", voice: a }, lookupOver({ a, b }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failure.kind).toBe("cycle");
    expect(explainVoiceFailure(r.failure)).toContain("cycle");
  });

  test("a voice extending one nothing serves names the id and the instance", () => {
    const child = voice("child", ["x"], { extends: { instance: "someone/elsewhere", voiceId: "missing" } });
    const r = resolveVoice({ instance: "i", voice: child }, lookupOver({}));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const said = explainVoiceFailure(r.failure);
    expect(said).toContain("someone/elsewhere/missing");
    expect(said).toContain("voices");
  });
});

describe("applicability — the CRDM axis", () => {
  test("absent means EVERYWHERE, including a context naming nothing", () => {
    expect(voiceActiveIn({}, {})).toBe(true);
    expect(voiceActiveIn({}, { process: "Process_Anything", role: "reviewer" })).toBe(true);
  });

  test("a declared list is an OR within itself", () => {
    const v = { activeIn: { processes: ["Process_Crdm", "Process_Review"] } };
    expect(voiceActiveIn(v, { process: "Process_Review" })).toBe(true);
    expect(voiceActiveIn(v, { process: "Process_Publication" })).toBe(false);
  });

  test("and an AND across the three — a lane-scoped voice is NOT in force anywhere its process runs", () => {
    // The distinction that makes this the CRDM shape rather than a union: an
    // activity sits in ONE lane of ONE process, so a voice naming both is in
    // force only at that intersection.
    const v = { activeIn: { processes: ["Process_Crdm"], roles: [{ role: "requirements-analyst" }] } };
    expect(voiceActiveIn(v, { process: "Process_Crdm", role: "requirements-analyst" })).toBe(true);
    expect(voiceActiveIn(v, { process: "Process_Crdm", role: "reviewer" })).toBe(false);
    expect(voiceActiveIn(v, { process: "Process_Crdm" })).toBe(false);
  });

  test("an EMPTY list is refused — it would switch the voice off silently", () => {
    expect(VoiceApplicabilitySchema.safeParse({ processes: [] }).success).toBe(false);
    expect(VoiceApplicabilitySchema.safeParse({ processes: ["Process_Crdm"] }).success).toBe(true);
  });

  test("an unknown key is refused, so a typo is not a voice that never activates", () => {
    expect(VoiceApplicabilitySchema.safeParse({ process: ["Process_Crdm"] }).success).toBe(false);
  });
});

describe("provenance and supersession are structural, the rules are not", () => {
  test("provenance is REQUIRED — a voice that did not classify itself does not parse", () => {
    // The owner asked for unstructured RULE content and agentic review. That
    // is about what a rule SAYS. Where it came from is not a judgement call.
    const bare = { ...voice("x", ["a"]) } as Record<string, unknown>;
    delete bare.provenance;
    expect(VoiceProfileSchema.safeParse(bare).success).toBe(false);
  });

  test("the three classes are the ones the corpus actually contains", () => {
    expect([...VOICE_PROVENANCE].sort()).toEqual(["assertion", "evidence", "house"]);
  });

  test("a supersession with no successor is VALID — the honest state", () => {
    // Measured: Antigravity's `Best practices` replaced the Gemini CLI product
    // without replacing the skill-authoring document, so "superseded,
    // successor unknown" is the truth and must be representable.
    const r = VoiceSupersessionSchema.safeParse({
      on: "2026-06-18",
      by: "Antigravity CLI",
      quote: "Gemini CLI was replaced by Antigravity CLI on June 18th, 2026.",
    });
    expect(r.success).toBe(true);
  });

  test("but a date that is not a date is refused", () => {
    const r = VoiceSupersessionSchema.safeParse({
      on: "June 2026",
      by: "Antigravity CLI",
      quote: "a quote",
    });
    expect(r.success).toBe(false);
  });

  test("a rule's CONTENT is unconstrained, deliberately", () => {
    // The falsifier for the owner's ruling: if this ever starts failing, some
    // gate has begun formalising rule text, and "best practice" drift will
    // then be pinned to whichever vintage was current when it was written.
    const v = voice("x", ["a"]);
    v.rules[0]!.description = "Anything at all — prose, a caveat, a contradiction of another vendor.";
    expect(VoiceProfileSchema.safeParse(v).success).toBe(true);
  });
});

describe("an inherited rule keeps the scope it was DECLARED under", () => {
  // The defect this pins, found by review 2026-09-20: `resolveVoice` dropped
  // `appliesTo` and took `activeIn` from the child alone, so a base voice
  // scoped to prose inside one process contributed rules to a child declaring
  // neither — and they applied to every block kind everywhere.
  const scoped = voice("scoped-base", ["base-rule"], {
    appliesTo: ["prose"],
    activeIn: { processes: ["Process_Crdm"] },
  });
  const open = voice("open-child", ["child-rule"], { extends: { voiceId: "scoped-base" } });
  const resolved = (() => {
    const r = resolveVoice({ instance: "i", voice: open }, lookupOver({ "scoped-base": scoped }));
    if (!r.ok) throw new Error("should resolve");
    return r.voice;
  })();

  test("both rules are present — inheritance still unions", () => {
    expect(resolved.rules.map((r) => r.id)).toEqual(["base-rule", "child-rule"]);
  });

  test("the BASE's rule is still confined to prose, and to its process", () => {
    expect(ruleAppliesHere(resolved, "base-rule", { blockKind: "prose", process: "Process_Crdm" })).toBe(true);
    // Escaping either half is the defect.
    expect(ruleAppliesHere(resolved, "base-rule", { blockKind: "theorem", process: "Process_Crdm" })).toBe(false);
    expect(ruleAppliesHere(resolved, "base-rule", { blockKind: "prose", process: "Process_Review" })).toBe(false);
  });

  test("the CHILD's rule is unconfined, because its author declared no scope", () => {
    // The other half, and why inheriting the parent's scope is not the fix
    // either: it would make the child's own rules answer to a scope nobody
    // wrote for them.
    expect(ruleAppliesHere(resolved, "child-rule", { blockKind: "theorem", process: "Process_Review" })).toBe(true);
  });

  test("a child overriding a rule id takes over its scope — it is the child's rule now", () => {
    const child = voice("child", ["base-rule"], { extends: { voiceId: "scoped-base" } });
    const r = resolveVoice({ instance: "i", voice: child }, lookupOver({ "scoped-base": scoped }));
    if (!r.ok) throw new Error("should resolve");
    expect(ruleAppliesHere(r.voice, "base-rule", { blockKind: "theorem" })).toBe(true);
  });

  test("an unknown rule id is FALSE, not 'everywhere'", () => {
    // absent-means-everywhere is about an absent SCOPE on a rule that exists.
    expect(ruleAppliesHere(resolved, "no-such-rule", { blockKind: "prose" })).toBe(false);
  });

  test("the voice-level fields are the START voice's own, and say so", () => {
    // Kept for a consumer reporting the voice as AUTHORED; conflating them
    // with the effective scope of the resolved rules is the original defect.
    expect(resolved.appliesTo).toBeUndefined();
    expect(resolved.activeIn).toBeUndefined();
    expect(resolved.scopeOf.get("base-rule")?.appliesTo).toEqual(["prose"]);
  });
});
