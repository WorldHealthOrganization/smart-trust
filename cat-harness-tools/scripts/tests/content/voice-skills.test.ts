/**
 * `check:voice-skills` — the gate `schemas/content/voice-skill.ts` promised.
 *
 * Bean `n8br`. The doc comment said "`check:voice-skills` enforces it" from the
 * day it was written, and four `SKILL.md` files repeat the claim in their own
 * prose. The gate did not exist.
 *
 * **So this file's job is the falsification, not the pass.** A check that
 * reports zero findings over its whole corpus is indistinguishable from a check
 * that cannot fire, and the four voices here produce zero. Every signal below
 * is therefore asserted in BOTH directions: the corpus passes, and a body that
 * restates a rule does not.
 */

import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";

import { checkVoiceSkills, restatements } from "../../check-voice-skills.ts";
import { readVoicesGraph } from "../../voices-graph.ts";
import { repoRootFor } from "../../../schemas/kg/cat-harness.ts";

const REPO = repoRootFor(join(import.meta.dir, "..", "..", ".."));

/** A rule of the shape the checker reads. */
const RULE = {
  id: "who-ed-ize-preferred",
  title: "-ize, not -ise",
  source: { quote: "-ize, derived from the Greek “-izo”, is preferred in WHO publications" },
  terminology: [{ correct: "organize", incorrect: "organise" }],
};

/** A body with front matter, as every real one has. */
const body = (prose: string): string =>
  `---\nname: voice-x\ndescription: >\n  Write and review in the X voice.\n---\n\n# X\n\n${prose}\n`;

describe("the corpus passes", () => {
  test("no voice this repository ships restates its own rules", () => {
    expect(checkVoiceSkills(REPO)).toEqual([]);
  });

  test("...and there IS a corpus, so the pass is not vacuous", () => {
    // The distinction the whole file turns on. `checkVoiceSkills` returns `[]`
    // for a repository with no voices too, and reading that as "everything is
    // fine" is the false-clean this repository keeps paying for.
    const g = readVoicesGraph([REPO], REPO);
    expect(g).not.toBeNull();
    expect(g!.voices.length).toBeGreaterThan(0);
    expect(g!.voices.reduce((n, v) => n + v.rules.length, 0)).toBeGreaterThan(0);
  });
});

describe("each of the four restatement signals fires", () => {
  test("a body naming a rule id", () => {
    const f = restatements(body("The rules are listed as `who-ed-ize-preferred` and others."), [RULE]);
    expect(f.length).toBe(1);
    expect(f[0]).toContain("names the rule id");
  });

  test("a body restating a rule title", () => {
    const f = restatements(body("Remember: -ize, not -ise, in every publication."), [RULE]);
    expect(f.some((x) => x.includes("restates the rule"))).toBe(true);
  });

  test("a body copying the source passage", () => {
    const f = restatements(body(`The manual says: ${RULE.source.quote}`), [RULE]);
    expect(f.some((x) => x.includes("source passage"))).toBe(true);
  });

  test("a body giving both sides of a terminology pair", () => {
    const f = restatements(body("Write organize, never organise."), [RULE]);
    expect(f.some((x) => x.includes("terminology pair"))).toBe(true);
  });
});

describe("and it does not fire on what a body is FOR", () => {
  test("instructions about what to do with the rules are clean", () => {
    const prose =
      "Read the rules flagged `counterintuitive` before you draft, not at review.\n" +
      "A finding is upheld by opening the cited page, never by trusting the rule's\n" +
      "wording. The mechanical half runs from the rules' patterns and terminology.";
    expect(restatements(body(prose), [RULE])).toEqual([]);
  });

  test("ONE side of a terminology pair is not a restatement", () => {
    // A body may legitimately use a word the voice prefers — it is written in
    // the voice. Only naming both sides states the RULE, which is the thing
    // that belongs in the data with a pattern behind it.
    expect(restatements(body("We organize the review in two passes."), [RULE])).toEqual([]);
  });

  test("the front matter's description is not body", () => {
    // The summary legitimately paraphrases what the voice is for, and it is
    // the one place a summary belongs. Matching it would make the check fire
    // on every correct file.
    const withRuleInFm =
      `---\nname: voice-x\ndescription: >\n  ${RULE.title} — the X voice.\n---\n\n# X\n\nHow to use it.\n`;
    expect(restatements(withRuleInFm, [RULE])).toEqual([]);
  });

  test("a short title is not matched, because a short title can be ordinary prose", () => {
    const short = { ...RULE, title: "Be brief" };
    expect(restatements(body("Be brief when you summarise a finding."), [short])).toEqual([]);
  });
});

describe("the structural half — what Zod cannot check", () => {
  test("every shipped voice's declared instruction body resolves", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const g = readVoicesGraph([REPO], REPO)!;
    for (const v of g.voices) {
      const raw = JSON.parse(readFileSync(join(REPO, v.path, "voice.json"), "utf-8")) as {
        $schema?: string;
        instructions?: { file?: string };
      };
      if (raw.$schema !== "folio-voice-skill/v1") continue;
      expect(raw.instructions?.file).toBeTruthy();
      expect(existsSync(join(REPO, v.path, raw.instructions!.file!))).toBe(true);
    }
  });

  test("a voice that promises NO body is not reported as missing one", async () => {
    // `voiceFilesIn` reads two layouts on purpose, so a bare `folio-voice/v1`
    // profile may carry no instruction body at all — its guidance may be a
    // separate skill it cites. This check asked every voice for a `SKILL.md`
    // and called a legitimate shape CRITICAL: found on 2026-09-21 by
    // relocating `technical-writer`, which is exactly that shape, and NOT by
    // a test. Hence this one.
    const { existsSync, readFileSync } = await import("node:fs");
    const g = readVoicesGraph([REPO], REPO)!;
    const bare = g.voices.filter((v) => {
      const raw = JSON.parse(readFileSync(join(REPO, v.path, "voice.json"), "utf-8")) as {
        $schema?: string;
        instructions?: { file?: string };
      };
      return raw.$schema !== "folio-voice-skill/v1" && raw.instructions?.file === undefined;
    });
    // The corpus must actually CONTAIN one, or this asserts nothing.
    expect(bare.length).toBeGreaterThan(0);
    // ONE run of the checker, asked about every bare voice. It was run once
    // PER voice: ~0.19 s a run over the composed checkout, and 43 bare voices
    // (cat-harness and folio-assistant-core, measured 2026-10-09) made this
    // 8.4 s against the 5 s budget — the same answer recomputed 43 times.
    const findings = checkVoiceSkills(REPO);
    for (const v of bare) {
      expect(existsSync(join(REPO, v.path, "SKILL.md"))).toBe(false);
      expect(findings.filter((f) => f.voice === v.id)).toEqual([]);
    }
  });

  test("the reader is told the repository root rather than deriving it wrongly", () => {
    // `repoRootFor` is `dirname` and takes a LAYER root, so a caller
    // starting from the repository root gets its PARENT and the reader finds
    // nothing — "no voices are declared" for a repository declaring three.
    // Found live while writing the checker. The explicit parameter is the fix,
    // and this is the regression.
    //
    // The pitfall is asserted as the DERIVATION, not as what the reader finds
    // in the parent. `readVoicesGraph([REPO])` scans `dirname(REPO)`, a
    // directory this repository does not own: its answer was `null` only when
    // that directory held nothing, and a checkout placed directly in `/tmp`
    // walked into another test's deliberately malformed fixture and threw
    // (bean `8zsb`, box 3). Whether the wrong root finds nothing is a fact
    // about the operator's filesystem; that it IS the wrong root is not.
    expect(repoRootFor(REPO)).toBe(dirname(REPO));
    expect(readVoicesGraph([REPO], REPO)).not.toBeNull();
  });
});
