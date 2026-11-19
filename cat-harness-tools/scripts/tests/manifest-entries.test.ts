/**
 * The two resolvers — `adapters/mcp-server/server.ts` and
 * `adapters/paper/resolver.ts` — each carried their own copy of these helpers,
 * taking `any`, and the copies had drifted apart on the one question that
 * matters: which `sections[]` entries carry blocks.
 *
 * `resolveFolio` used `!("blocks" in sec) → skip`, and `resolvePaper` used
 * `"name" in sec && !("blocks" in sec) → skip`. They agree on a plain inline
 * section and on a plain reference, and disagree on exactly the case
 * `sectionBlockNames` exists to handle: a section that keeps every block in
 * its `subsections[]` and so declares no `blocks` of its own. The folio
 * landing page skipped those entirely and undercounted the paper; the viewer
 * kept them.
 *
 * These pin the shared predicate and the flattening, including that case.
 */
import { describe, test, expect } from "bun:test";
import type { Section, SectionRef } from "../../schemas/types.ts";
import { isSectionRef, sectionBlockNames } from "../../adapters/manifest-entries.ts";

/** `Section` requires `blocks`; authored manifests omit it. Model that. */
const entry = (o: Record<string, unknown>) => o as unknown as Section | SectionRef;

describe("isSectionRef", () => {
  test("a bare reference is a reference", () => {
    expect(isSectionRef(entry({ name: "preliminaries" }))).toBe(true);
    expect(isSectionRef(entry({ name: "prelim", uri: "./prelim/prelim.ts" }))).toBe(true);
  });

  test("an inline section is not", () => {
    expect(isSectionRef(entry({ title: "Preliminaries", blocks: ["def-x"] }))).toBe(false);
  });

  test("a section with only subsections is NOT a reference — the case the two copies disagreed on", () => {
    const sec = entry({ title: "Overview", subsections: [{ title: "A", blocks: ["def-a"] }] });
    expect(isSectionRef(sec)).toBe(false);
  });

  test("an entry that names a target AND carries blocks is inline", () => {
    // `name` alone does not make it a reference — the blocks are right there.
    expect(isSectionRef(entry({ name: "x", title: "X", blocks: ["def-x"] }))).toBe(false);
  });
});

describe("sectionBlockNames", () => {
  test("own blocks, in order", () => {
    expect(sectionBlockNames(entry({ title: "S", blocks: ["a", "b"] }) as Section)).toEqual(["a", "b"]);
  });

  test("own blocks first, then each subsection's, in declaration order", () => {
    // Mirrors render-latex: parent blocks, then each \subsection with its own.
    const sec = entry({
      title: "S",
      blocks: ["a"],
      subsections: [{ title: "S1", blocks: ["b", "c"] }, { title: "S2", blocks: ["d"] }],
    }) as Section;
    expect(sectionBlockNames(sec)).toEqual(["a", "b", "c", "d"]);
  });

  test("reaches blocks that exist ONLY in subsections", () => {
    // Without this the section renders empty in the viewer.
    const sec = entry({
      title: "S",
      subsections: [{ title: "S1", blocks: ["b"] }, { title: "S2", blocks: ["c"] }],
    }) as Section;
    expect(sectionBlockNames(sec)).toEqual(["b", "c"]);
  });

  test("skips a subsection that is a bare reference", () => {
    const sec = entry({
      title: "S",
      blocks: ["a"],
      subsections: [{ name: "elsewhere" }, { title: "S2", blocks: ["d"] }],
    }) as Section;
    expect(sectionBlockNames(sec)).toEqual(["a", "d"]);
  });

  test("tolerates a missing or non-array blocks/subsections", () => {
    expect(sectionBlockNames(entry({ title: "S" }) as Section)).toEqual([]);
    expect(sectionBlockNames(entry({ title: "S", blocks: "nope" }) as Section)).toEqual([]);
    expect(sectionBlockNames(entry({ title: "S", blocks: ["a"], subsections: "nope" }) as Section)).toEqual(["a"]);
  });

  test("tolerates a hole in subsections", () => {
    const sec = entry({ title: "S", subsections: [null, { title: "S1", blocks: ["b"] }] }) as Section;
    expect(sectionBlockNames(sec)).toEqual(["b"]);
  });
});
