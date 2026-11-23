/**
 * Six pipeline entry points imported the bibliography as
 * `../../schemas/references` — a path that does not exist in this repo. The
 * reference database is CONTENT (in qou it is `folio/schema/references.ts`,
 * ~7900 lines of CSL-JSON), so it belongs to the folio the same way the values
 * registry and the Lake package list do.
 *
 * They did not merely fail to type-check. **Every one threw `Cannot find
 * module` at import**, so `validate-bib`, `bib-qa`, `export-bibtex`,
 * `export-json`, `validate-references` and `validate-references-human-review`
 * could not run at all. The whole bibliography subsystem was dead, and nothing
 * reported it: `folio/**` was outside the tsconfig program, and nothing else
 * imports these entry points.
 *
 * Downstream cost, measured: qou's committed `references.bib` carries 372
 * entries against 463 in the CSL source, and a DOI corrected on 2026-07-06 is
 * absent from it. Its generator is `export-bibtex.ts`, which has been unable
 * to run since the split — so the LaTeX bibliography the paper builds from
 * silently froze on 2026-07-04.
 *
 * These pin the DI contract that replaces the direct import. The Proxy is what
 * lets the six consumers keep reading `references` as a plain array, so the
 * array-ness is the part worth testing.
 */
import { describe, test, expect, beforeAll } from "bun:test";
import {
  configureReferenceRegistry,
  getReferenceRegistry,
  references,
  referenceMap,
} from "../../../pipeline/references-registry-di";
import type { Data as CSLData } from "csl-json";

const ENTRIES: CSLData[] = [
  { id: "alpha2020", type: "article-journal", title: "Alpha", DOI: "10.1/a" },
  { id: "beta2021", type: "book", title: "Beta" },
  { id: "gamma2022", type: "article-journal", title: "Gamma", DOI: "10.1/c" },
];

describe("reference registry DI", () => {
  test("is unconfigured before injection, and says so", () => {
    // The message has to name the remedy: this is what a folio author sees
    // when they invoke a pipeline entry point without a runner script.
    expect(() => getReferenceRegistry()).toThrow(/configureReferenceRegistry/);
  });
});

describe("reference registry DI — once configured", () => {
  beforeAll(() => {
    configureReferenceRegistry({
      references: ENTRIES,
      referenceMap: new Map(ENTRIES.map((e) => [e.id as string, e])),
      CSLEntrySchema: { parse: (v: unknown) => v } as never,
    });
  });

  test("`references` behaves as the array the consumers expect", () => {
    // Each of these is a real access pattern in the six files. A Proxy that
    // only forwarded property reads would fail every method call here.
    expect(references.length).toBe(3);
    expect(references[0].id).toBe("alpha2020");
    expect(references.map((r) => r.id)).toEqual(["alpha2020", "beta2021", "gamma2022"]);
    expect(references.filter((r) => !!r.DOI).length).toBe(2);
    expect([...references].length).toBe(3);
    expect(references.find((r) => r.id === "beta2021")?.type).toBe("book");
  });

  test("`for…of` iterates it", () => {
    const ids: string[] = [];
    for (const r of references) ids.push(r.id as string);
    expect(ids).toEqual(["alpha2020", "beta2021", "gamma2022"]);
  });

  test("`referenceMap` behaves as a Map", () => {
    expect(referenceMap.size).toBe(3);
    expect(referenceMap.get("gamma2022")?.title).toBe("Gamma");
    expect(referenceMap.has("nope")).toBe(false);
  });

  test("re-injection swaps the data", () => {
    // A runner may configure once per process; nothing should cache the first
    // array by identity.
    configureReferenceRegistry({
      references: [ENTRIES[0]],
      referenceMap: new Map([["alpha2020", ENTRIES[0]]]),
      CSLEntrySchema: { parse: (v: unknown) => v } as never,
    });
    expect(references.length).toBe(1);
    expect(referenceMap.size).toBe(1);
    // Restore for any later test in this file.
    configureReferenceRegistry({
      references: ENTRIES,
      referenceMap: new Map(ENTRIES.map((e) => [e.id as string, e])),
      CSLEntrySchema: { parse: (v: unknown) => v } as never,
    });
  });
});
