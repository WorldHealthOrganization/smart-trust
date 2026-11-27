/**
 * The untainted round-trip report (bean folio-assistant-ktt2) is derived from
 * the agents' rulings and the catalogues as they are now. The rulings are
 * judgements and live in the `attestations` graph
 * (`test/attestations/translation-qa/`, owner 2026-11-03, bean
 * folio-assistant-7mwa); the report is derived and is published to the
 * qa-reports store, not committed. These tests keep the joins it relies on.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { buildReport, h12, pairRulings, parsePo, readRoundtrip } from "../translation-roundtrip-report.ts";
import { prune } from "../translation-qa-prune.ts";

const INSTANCE = join(import.meta.dir, "..", "..");
const LOCALES = ["ar", "es", "fr", "ru", "zh"];
const CATALOGUES = ["site/iris-site.po", "glossary/who-iris--who-terms.po"];

describe("translation round-trip report", () => {
  test("buildsFromAttestations", () => {
    const r = buildReport() as { $schema: string; totals: Record<string, Record<string, number>> };
    expect(r.$schema).toBe("qa-results/v1");
    expect(Object.keys(r.totals).sort()).toEqual(LOCALES);
  });

  test("backTranslatorsUseReadWriteOnly", () => {
    for (const [locale, f] of Object.entries(buildReport().families as Record<string, { summary: string }>)) {
      expect(f.summary, locale).toContain("Back-translator tools: Read,Write.");
    }
  });

  // Rulings are paired with strings by content (who-iris#260; owner, 2026-11-13).
  const str = (msgid: string, msgstr = `t:${msgid}`) => ({ catalogue: "x.po", msgid, msgstr });
  const rul = (index: number, msgid: string, msgstr = `t:${msgid}`, result: "pass" | "warn" | "fail" = "pass") => ({
    index,
    field_hash: { msgid: h12(msgid), msgstr: h12(msgstr) },
    result,
    findings: [],
    back_translation: msgid,
  });

  test("rulingsMayRunAheadButNotBehind", () => {
    const { pairs, unused } = pairRulings([str("a"), str("b")], [rul(0, "a"), rul(1, "b"), rul(2, "c")], "x");
    expect(pairs.map((p) => p.ruling.index)).toEqual([0, 1]);
    expect(unused.map((e) => e.index)).toEqual([2]);
    expect(() => pairRulings([str("a"), str("b"), str("c")], [rul(0, "a"), rul(1, "b")], "x")).toThrow("re-run the agents");
  });

  test("removingOrReorderingStringsKeepsEveryRuling", () => {
    const rulings = [rul(0, "a"), rul(1, "b", "t:b", "warn"), rul(2, "c")];
    const removed = pairRulings([str("a"), str("c")], rulings, "x");
    expect(removed.pairs.map((p) => [p.string.msgid, p.ruling.result])).toEqual([["a", "pass"], ["c", "pass"]]);
    expect(removed.unused.map((e) => e.index)).toEqual([1]);
    const reordered = pairRulings([str("c"), str("b"), str("a")], rulings, "x");
    expect(reordered.pairs.map((p) => [p.string.msgid, p.ruling.result])).toEqual([["c", "pass"], ["b", "warn"], ["a", "pass"]]);
  });

  test("changedTranslationIsStaleNotPassed", () => {
    const { pairs } = pairRulings([str("a", "new")], [rul(0, "a", "old")], "x");
    expect(pairs[0]!.stale).toBe(true);
  });

  test("pruneDropsRemovedKeepsAheadNeverChangesAVerdict", () => {
    const run = { scope: "run" as const, back_translation_trailer: {}, adjudication_trailer: {} };
    const entries = [run, rul(0, "a"), rul(1, "gone", "t:gone", "warn"), rul(2, "c", "t:c", "fail"), rul(3, "ahead")];
    const everHeld = new Set(["a", "gone", "c"].map(h12));
    const r = prune(entries, [str("a"), str("c")], everHeld, "x");
    expect(r.dropped.map((e) => e.index)).toEqual([1]);
    expect(r.ahead).toBe(1);
    expect(r.next[0]).toBe(run);
    expect(r.next.slice(1).map((e) => [(e as { index: number }).index, (e as { result: string }).result])).toEqual([[0, "pass"], [1, "fail"], [2, "pass"]]);
    // A string on the ref with no ruling is not prune's to paper over.
    expect(() => prune(entries, [str("a"), str("new")], everHeld, "x")).toThrow("re-run the agents");
  });

  test("parsePoJoinsLinesSkipsHeader", () => {
    const po = 'msgid ""\nmsgstr ""\n"Language: fr\\n"\n\n#. note\nmsgid "a "\n"b"\nmsgstr "c"\n';
    expect(parsePo(po, "x.po")).toEqual([{ catalogue: "x.po", msgid: "a b", msgstr: "c" }]);
  });
});

describe("the agents' rulings are attestations", () => {
  test("attestationPerCatalogueAndLocale", () => {
    for (const locale of LOCALES) {
      for (const cat of CATALOGUES) {
        const path = join(INSTANCE, "test", "attestations", "translation-qa", `${cat}.${locale}.attestations.json`);
        expect(existsSync(path), path).toBe(true);
        const file = JSON.parse(readFileSync(path, "utf-8"));
        expect(file.$schema).toBe("qa-attestations/v1");
        expect(file.family).toBe("translation-qa");
        expect(file.locale).toBe(locale);
        expect(file.subject).toEqual({ kind: "translation-catalogue", id: cat, path: `translations/${locale}/${cat}` });
        const strings = parsePo(readFileSync(join(INSTANCE, "translations", locale, cat), "utf-8"), cat);
        const { run, entries } = readRoundtrip(cat, locale);
        // Every string has a ruling, found by its msgid hash; rulings for
        // strings not on this branch yet, or removed from it, are unused.
        const { pairs } = pairRulings(strings, entries, `${locale} ${cat}`);
        expect(pairs.map((p) => h12(p.string.msgid))).toEqual(pairs.map((p) => p.ruling.field_hash.msgid));
        // A script entry is derived and may not sit in the attestation store.
        for (const e of [run, ...entries]) expect((e as { reviewer?: { kind?: string } }).reviewer?.kind).toBe("agent");
        expect(run.back_translation_trailer.TOOLS_USED).toBe("Read,Write");
      }
    }
  });

  test("derivedReportNotCommitted", () => {
    const tracked = Bun.spawnSync(["git", "ls-files", "test/results"], { cwd: INSTANCE }).stdout.toString().trim();
    expect(tracked).toBe("");
  });
});
