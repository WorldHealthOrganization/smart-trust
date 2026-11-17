/**
 * `check:voices` — a vendor voice must specialise a voice that resolves.
 *
 * The `voice-vendors` criterion added on PR #2094: one fixture that FIRES for
 * each failure (no `extends`, a missing base, a cycle) and one that is clean,
 * plus the corpus as it stands.
 */
import { describe, expect, test } from "bun:test";

import { vendorVoiceFindings } from "../check-voices.ts";
import type { VoiceProfile } from "@litlfred/cat-harness-tools/schemas/content/voices.js";

const voice = (id: string, base?: string): VoiceProfile =>
  ({ id, rules: [], sources: [], ...(base ? { extends: { voiceId: base } } : {}) }) as unknown as VoiceProfile;

describe("vendorVoiceFindings", () => {
  test("vendorWithoutExtends", () => {
    const out = vendorVoiceFindings([{ where: "v.json", voice: voice("vendor") }], new Map());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/declares no `extends`/);
  });

  test("baseNoInstanceShips", () => {
    const out = vendorVoiceFindings([{ where: "v.json", voice: voice("vendor", "missing") }], new Map());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/which no instance serves/);
  });

  test("extendsCycle", () => {
    const a = voice("a", "b");
    const b = voice("b", "a");
    const out = vendorVoiceFindings([{ where: "a.json", voice: a }], new Map([["a", a], ["b", b]]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/cycle/);
  });

  test("resolvedBaseClean", () => {
    const base = voice("base");
    const out = vendorVoiceFindings([{ where: "v.json", voice: voice("vendor", "base") }], new Map([["base", base]]));
    expect(out).toEqual([]);
  });
});
