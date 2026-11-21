/**
 * One string's translations in every locale: the statuses, the ranked default
 * pick, the strings projection a block's 🌐 pane reads, and its publication
 * into a folio's site (owner, 2026-11-18).
 *
 * @covers translation-sources
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { candidatesProblems, msgidHash, poEntries, poHash, type Candidate, type CandidatesEntry, type CandidatesFile } from "../lib/translation-adjudication.ts";
import {
  applyAutoPick,
  autoPickOf,
  defaultPick,
  entryFor,
  pickTier,
  qaFailures,
  rankCandidates,
  stringsProjection,
  stringStatus,
  STRING_STATUSES,
} from "../lib/translation-strings.ts";
import { layerStrings, reviewLayer, STRINGS_BASE } from "../lib/translation-review-page.ts";
import { publishTranslationReview } from "../publish-translation-review.ts";

const H = msgidHash({ msgid: "Save" });
const c = (text: string, kind: Candidate["source"]["kind"], id: string, extra: Partial<Candidate> = {}): Candidate => ({ text, source: { kind, id }, msgidHash: H, ...extra });
const entry = (candidates: Candidate[], chosen?: CandidatesEntry["chosen"]): CandidatesEntry => ({ msgid: "Save", candidates, ...(chosen ? { chosen } : {}) });
const SAVE = { msgid: "Save" };

describe("the auto-pick (owner, 2026-11-18: official 0, adjudicated 1, human 2, platform 3, agent 4, MT 5; +10 for a QA fail)", () => {
  test("rank order, whatever order the candidates were recorded in", () => {
    const e = entry([
      c("MT", "open-mt", "opus-mt-en-fr"),
      c("Svc", "web-service", "deepl"),
      c("Agent", "agent", "claude-opus-5-5"),
      c("Weblate", "web-service", "weblate"),
      c("Person", "human", "github:ana"),
      c("Official", "official", "who-glossary"),
    ]);
    expect(rankCandidates(e, H).map((r) => `${r.candidate.text}:${r.tier}:${r.score}`)).toEqual([
      "Official:official:0",
      "Person:human-proposed:2",
      "Weblate:platform:3",
      "Agent:agent:4",
      "MT:mt:5",
      "Svc:mt:5",
    ]);
    // The text a collaborator chose ranks as adjudicated.
    expect(pickTier(c("Agent", "agent", "x"), "Agent")).toBe("human-adjudicated");
  });
  test("a QA failure adds 10; a check not run is not a failure", () => {
    const e = entry([
      c("Person, wrong term", "human", "github:ana", { qa: { glossary: { pass: false, missing: ["immunization"] } } }),
      c("MT, clean", "open-mt", "opus", { qa: { roundtrip: { score: 0.95, threshold: 0.7, pass: true } } }),
      c("Agent, bad placeholders", "agent", "a", { qa: { placeholders: { pass: false } } }),
      c("MT, no QA run", "open-mt", "argos"),
    ]);
    const r = rankCandidates(e, H);
    expect(r.map((x) => `${x.candidate.text}:${x.score}`)).toEqual(["MT, clean:5", "MT, no QA run:5", "Person, wrong term:12", "Agent, bad placeholders:14"]);
    expect(qaFailures(e.candidates[0]!)).toEqual([expect.stringContaining("immunization")]);
    expect(qaFailures({ qa: { roundtrip: { score: 0.4, threshold: 0.7, pass: false } } })).toEqual([expect.stringContaining("round trip 0.40")]);
  });
  test("ties go to the newest; a stale candidate is listed last and never auto-picked", () => {
    const e = entry([
      c("Old", "human", "github:a", { source: { kind: "human", id: "github:a", at: "2026-11-01T00:00:00Z" } }),
      c("New", "human", "github:b", { source: { kind: "human", id: "github:b", at: "2026-11-17T00:00:00Z" } }),
      c("Stale official", "official", "who", { msgidHash: "0000000000000000" }),
    ]);
    expect(rankCandidates(e, H).map((r) => r.candidate.text)).toEqual(["New", "Old", "Stale official"]);
    expect(autoPickOf(e, H)!.candidate.text).toBe("New");
    expect(autoPickOf(entry([e.candidates[2]!]), H)).toBeUndefined();
  });
  test("a collaborator's choice is the pick; otherwise the auto-pick, unofficial unless an exact official match", () => {
    const e = entry([c("A", "agent", "a"), c("B", "human", "github:b")]);
    expect(defaultPick(e, SAVE)).toEqual({ kind: "auto", text: "B", index: 1, tier: "human-proposed", official: false, unofficial: true });
    const chosen = { text: "A", how: "adjudicated" as const, by: "github:col", at: "2026-11-18T00:00:00Z", issue: 1, candidate: { kind: "agent" as const, id: "a" } };
    expect(defaultPick(entry(e.candidates, chosen), SAVE)).toMatchObject({ kind: "adjudicated", text: "A" });
    expect(defaultPick(entry([c("Enregistrer", "official", "who", { sourceText: "Save" })]), SAVE)).toMatchObject({ official: true, unofficial: false });
    expect(defaultPick(undefined, SAVE)).toBeUndefined();
  });
});

describe("applying the auto-pick to a catalogue", () => {
  const po = (msgstr: string, flags = "") => `${flags}msgid "Save"\nmsgstr "${msgstr}"\n`;
  const at = "2026-11-18T12:00:00Z";
  const one = (text: string) => poEntries(text)[0]!;
  test("an exact official match is written without fuzzy, as auto-official", () => {
    const e = entry([c("Enregistrer", "official", "who-glossary", { sourceText: "Save" }), c("Sauver", "agent", "a")]);
    const r = applyAutoPick(po(""), e, one(po("")), at)!;
    expect(one(r.po)).toMatchObject({ msgstr: "Enregistrer", fuzzy: false });
    expect(r.chosen).toEqual({ text: "Enregistrer", how: "auto-official", at, candidate: { kind: "official", id: "who-glossary" } });
  });
  test("a near match (case, whitespace, punctuation, other wording) or no sourceText is fuzzy and auto", () => {
    for (const sourceText of ["save", "Save ", "Save.", "Store", undefined]) {
      const e = entry([c("Enregistrer", "official", "who", sourceText === undefined ? {} : { sourceText })]);
      const r = applyAutoPick(po(""), e, one(po("")), at)!;
      expect(one(r.po)).toMatchObject({ msgstr: "Enregistrer", fuzzy: true });
      expect(r.chosen.how).toBe("auto");
    }
  });
  test("a better candidate replaces an earlier auto-pick; an adjudicated entry is never re-picked; other text is left alone", () => {
    const first = applyAutoPick(po(""), entry([c("Sauver", "agent", "a")]), one(po("")), at)!;
    const e = entry([c("Sauver", "agent", "a"), c("Enregistrer", "human", "github:ana")], first.chosen);
    const better = applyAutoPick(first.po, e, one(first.po), at)!;
    expect(one(better.po)).toMatchObject({ msgstr: "Enregistrer", fuzzy: true });
    const adjudicated = entry(e.candidates, { text: "Sauver", how: "adjudicated", by: "github:col", at });
    expect(applyAutoPick(po("Sauver"), adjudicated, one(po("Sauver")), at)).toBeUndefined();
    expect(applyAutoPick(po("Garder"), e, one(po("Garder")), at)).toBeUndefined();
  });
});

describe("a string's status", () => {
  const po = (msgstr: string, flags = "") => poEntries(`${flags}msgid "Save"\nmsgstr "${msgstr}"\n`)[0]!;
  test("every status the ruling lists, and unattributed when nothing records provenance", () => {
    const chosen = { text: "Enregistrer", how: "adjudicated" as const, by: "github:col", at: "t", issue: 1 };
    const e = entry([c("Sauver", "agent", "a"), c("Sauvegarder", "open-mt", "m"), c("Garder", "human", "github:x"), c("Officiel", "official", "who")], chosen);
    expect(stringStatus(po(""), e, H)).toBe("missing");
    expect(stringStatus(po("Enregistrer"), e, H)).toBe("adjudicated");
    expect(stringStatus(po("Sauver", "#, fuzzy\n"), e, H)).toBe("agent");
    expect(stringStatus(po("Sauvegarder", "#, fuzzy\n"), e, H)).toBe("mt");
    expect(stringStatus(po("Garder", "#, fuzzy\n"), e, H)).toBe("proposed");
    // An official text that was not an exact match is a proposal until chosen; an auto-official one is official.
    expect(stringStatus(po("Officiel", "#, fuzzy\n"), e, H)).toBe("proposed");
    expect(stringStatus(po("Officiel"), entry(e.candidates, { text: "Officiel", how: "auto-official", at: "t" }), H)).toBe("official");
    expect(stringStatus(po("Texte"), undefined, H, { officialCatalogue: true })).toBe("official");
    expect(stringStatus(po("Texte"), undefined, H, { generatedBy: "agent" })).toBe("agent");
    expect(stringStatus(po("Texte"), undefined, H)).toBe("unattributed");
    expect(stringStatus(po("Vieux"), entry([c("Vieux", "agent", "a", { msgidHash: "0000000000000000" })]), H)).toBe("stale");
    expect(stringStatus(poEntries('#, fuzzy\n#| msgid "Sav"\nmsgid "Save"\nmsgstr "Sauver"\n')[0]!, e, H)).toBe("stale");
    expect(STRING_STATUSES).toEqual(["official", "adjudicated", "proposed", "agent", "mt", "missing", "stale", "unattributed"]);
  });
  test("candidates recorded for the previous source text (#| msgid) are found, and stale", () => {
    const side: CandidatesFile = { $schema: "translation-candidates/v1", locale: "fr", catalogue: "c", entries: [{ msgid: "Sav", candidates: [c("Sauver", "agent", "a", { msgidHash: msgidHash({ msgid: "Sav" }) })] }] };
    const e = poEntries('#, fuzzy\n#| msgid "Sav"\nmsgid "Save"\nmsgstr "Sauver"\n')[0]!;
    const found = entryFor(side, e);
    expect(found.previous).toBe(true);
    expect(rankCandidates(found.entry, msgidHash(e))[0]!.stale).toBe(true);
  });
});

describe("the candidates schema accepts the new fields and rejects bad ones", () => {
  const file = (cand: object, chosen?: object) => ({ $schema: "translation-candidates/v1", locale: "fr", catalogue: "c", entries: [{ msgid: "Save", candidates: [cand], ...(chosen ? { chosen } : {}) }] });
  test("accepts", () => {
    expect(candidatesProblems(file(
      { text: "Enregistrer", source: { kind: "official", id: "who", version: "2024", at: "2026-11-18T00:00:00Z", by: "github:ana", issue: 12 }, msgidHash: H, sourceText: "Save", qa: { glossary: { pass: true }, placeholders: { pass: true }, roundtrip: { score: 0.9, threshold: 0.7, pass: true, engine: "opus" }, at: "t" } },
      { text: "Enregistrer", how: "adjudicated", by: "github:ana", at: "t", issue: 12, reason: "glossary term", candidate: { kind: "official", id: "who" } },
    ))).toEqual([]);
  });
  test("rejects", () => {
    expect(candidatesProblems(file({ text: "x", source: { kind: "human", id: "github:a", issue: "https://x" } }))).toEqual([expect.stringContaining("issue must be an issue number")]);
    expect(candidatesProblems(file({ text: "x", source: { kind: "agent", id: "a" }, qa: { roundtrip: { score: 2 } } }))).toEqual([expect.stringContaining("roundtrip")]);
    expect(candidatesProblems(file({ text: "x", source: { kind: "agent", id: "a" } }, { text: "x", how: "decreed", at: "t" }))).toEqual([expect.stringContaining("how must be one of")]);
    expect(candidatesProblems(file({ text: "x", source: { kind: "agent", id: "a" } }, { text: "x", how: "adjudicated", at: "t" }))).toEqual([expect.stringContaining("by must be github:<login>")]);
  });
});

const POT = '#: docs/guide.md:3\nmsgid "Hello"\nmsgstr ""\n\n#: docs/guide.md:5\nmsgctxt "button"\nmsgid "Save"\nmsgstr ""\n';
const FR = '#: docs/guide.md:3\nmsgid "Hello"\nmsgstr "Bonjour"\n\n#: docs/guide.md:5\n#, fuzzy\nmsgctxt "button"\nmsgid "Save"\nmsgstr "Sauver"\n';
const AR = POT;
const SIDE: CandidatesFile = {
  $schema: "translation-candidates/v1",
  locale: "fr",
  catalogue: "docs/guide",
  entries: [
    {
      msgctxt: "button",
      msgid: "Save",
      candidates: [
        { text: "Sauver", source: { kind: "agent", id: "claude-opus-5-5", at: "2026-11-14T10:00:00Z" }, msgidHash: msgidHash({ msgctxt: "button", msgid: "Save" }) },
        { text: "Enregistrer", source: { kind: "human", id: "github:ana", issue: 3 }, msgidHash: msgidHash({ msgctxt: "button", msgid: "Save" }), qa: { roundtrip: { score: 0.9, threshold: 0.7, pass: true } } },
      ],
    },
  ],
};

describe("the strings projection", () => {
  test("every string in every locale: text, status, candidates ranked with provenance, the unofficial pick", () => {
    const p = stringsProjection({ layer: "demo", repository: "o/r", translations: "translations", catalogue: "docs/guide" }, {
      fr: { po: FR, sidecar: SIDE, poHash: poHash(FR), generatedBy: "agent" },
      ar: { po: AR, poHash: poHash(AR) },
    });
    expect(p.$schema).toBe("folio-translation-strings/v1");
    expect(p.hashes).toEqual({ ar: poHash(AR), fr: poHash(FR) });
    const save = p.strings.find((s) => s.msgid === "Save")!;
    expect(save).toMatchObject({ msgctxt: "button", sources: ["docs/guide.md"], hash: msgidHash({ msgctxt: "button", msgid: "Save" }) });
    expect(save.locales.ar).toMatchObject({ text: "", status: "missing", candidates: [] });
    const fr = save.locales.fr!;
    expect(fr).toMatchObject({ text: "Sauver", status: "agent", fuzzy: true, pick: { text: "Enregistrer", tier: "human-proposed", unofficial: true } });
    expect(fr.candidates.map((x) => [x.text, x.tier, x.current, x.stale])).toEqual([
      ["Enregistrer", "human-proposed", false, false],
      ["Sauver", "agent", true, false],
    ]);
    expect(fr.candidates[0]!.source.issue).toBe(3);
    expect(p.strings.find((s) => s.msgid === "Hello")!.locales.fr).toMatchObject({ text: "Bonjour", status: "agent" });
  });

  test("a layer's rows each name their projection, and an unreadable sidecar is left out", () => {
    const root = mkdtempSync(join(tmpdir(), "tr-str-"));
    for (const [l, po] of [["fr", FR], ["ar", AR]] as const) {
      mkdirSync(join(root, "translations", l, "docs"), { recursive: true });
      writeFileSync(join(root, "translations", l, "docs", "guide.po"), po);
    }
    writeFileSync(join(root, "translations/fr/docs/guide.candidates.json"), JSON.stringify(SIDE));
    writeFileSync(join(root, "translations/ar/docs/guide.candidates.json"), "{ nope");
    const count = (t: string) => ({ entries: poEntries(t).length, translated: poEntries(t).filter((e) => e.msgstr && !e.fuzzy).length, fuzzy: poEntries(t).filter((e) => e.fuzzy).length });
    const layer = reviewLayer({ name: "demo", repository: "o/r", layerRoot: root, translationsDir: join(root, "translations"), attestationFor: () => join(root, "none"), poHeader: () => undefined, count });
    expect(layer.rows[0]!.strings).toBe("demo/docs/guide.json");
    const all = layerStrings(layer, join(root, "translations"));
    const proj = all.get("demo/docs/guide.json")!;
    expect(proj.strings.find((s) => s.msgid === "Save")!.locales.fr!.candidates).toHaveLength(2);
    expect(proj.strings.find((s) => s.msgid === "Save")!.locales.ar!.candidates).toEqual([]);
  });
});

describe("a folio's site publishes the projections wherever translations exist", () => {
  const declare = (root: string, name: string, translations: boolean) => {
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, `${name}.json`),
      JSON.stringify({
        $schema: "cat-harness-declaration/1.0.0",
        name,
        repository: `o/${name}`,
        version: "0.1.0",
        directories: translations ? [{ id: `${name}-translations`, path: "translations/", graphTypologies: ["translation-sources"] }] : [],
      }),
    );
  };
  test("review.json and one strings file per catalogue; no review page linked where the site has none", () => {
    const root = mkdtempSync(join(tmpdir(), "tr-folio-"));
    declare(root, "folio", true);
    mkdirSync(join(root, "translations/fr/docs"), { recursive: true });
    writeFileSync(join(root, "translations/fr/docs/guide.po"), FR);
    const site = join(root, "_site");
    mkdirSync(site);
    const written = publishTranslationReview(root, site);
    expect(written).toEqual(["assets/translation-status/review.json", `${STRINGS_BASE}folio/docs/guide.json`]);
    const review = JSON.parse(readFileSync(join(site, "assets/translation-status/review.json"), "utf-8"));
    expect(review.$schema).toBe("folio-translation-review/v1");
    expect(review.reviewPage).toBeUndefined();
    expect(review.strings).toMatchObject({ schema: "folio-translation-strings/v1", base: STRINGS_BASE });
    expect(review.layers[0]).toMatchObject({ name: "folio", repository: "o/folio", rows: [{ catalogue: "docs/guide", strings: "folio/docs/guide.json" }] });
  });
  test("a checkout with no translations writes nothing", () => {
    const root = mkdtempSync(join(tmpdir(), "tr-folio-"));
    declare(root, "plain", false);
    const site = join(root, "_site");
    mkdirSync(site);
    expect(publishTranslationReview(root, site)).toEqual([]);
    expect(existsSync(join(site, "assets/translation-status/review.json"))).toBe(false);
  });
});
