/**
 * Cross-paper `uses[]` / `foreshadows[]` references resolve against the
 * folio-wide label index, and a miss fails (a
 * Stepwise Toolkit document whose blocks link into a guidance document in the
 * same folio). Before this, `uses-resolve`, `foreshadows-resolve` and
 * `uses-editorial-hygiene` all accepted any `<slug>:<label>` unread, and the
 * hygiene checker's hand-written kind-prefix list had no `sec:`/`chap:`, so a
 * bare `sec:x` read as a cross-paper ref and was skipped too.
 *
 * Also pinned: the document validator reads subsections at every depth, as
 * the site renders them, rather than exactly one level.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  CONSTRAINT_RULES,
  KNOWN_LABEL_PREFIXES,
  UNRESOLVED_LOCAL,
  splitCrossPaperRef,
  unresolvedReference,
  type ConstraintContext,
} from "../../schemas/constraints.ts";
import { documentLabels, folioLabelIndex } from "../../pipeline/repo-root";
import { usesEntryProblem } from "../../pipeline/qa-checkers-uses";
import { listedSections, sectionBlockNames, validateObjects } from "../../pipeline/validate";
import type { Block, Chapter, ValidationIssue } from "../../schemas/types.ts";

const roots: string[] = [];
const tmp = (tag: string): string => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), `${tag}-`)));
  roots.push(d);
  return d;
};
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const index = new Map<string, Set<string>>([
  ["guidance", new Set(["def:indicator", "sec:scope", "rec:hand-hygiene"])],
  ["toolkit", new Set(["prose:step-1", "sec:step-one"])],
]);

describe("unresolvedReference", () => {
  const local = new Set(["def:here", "sec:intro", "def:foo:bar"]);
  const has = (l: string) => local.has(l);

  test("a bare label resolves locally or is a miss", () => {
    expect(unresolvedReference("def:here", has, index)).toBeUndefined();
    expect(unresolvedReference("def:nowhere", has, index)).toBe(UNRESOLVED_LOCAL);
  });

  test("an empty entry never resolves; a URL is a cross-folio ref", () => {
    expect(unresolvedReference("", has, index)).toBe("empty entry");
    expect(unresolvedReference("  ", has, index)).toBe("empty entry");
    expect(unresolvedReference("https://example.org/papers/x#def:y", has, index)).toBeUndefined();
  });

  test("a cross-paper ref resolves in THAT document of the folio", () => {
    expect(unresolvedReference("guidance:def:indicator", has, index)).toBeUndefined();
    expect(unresolvedReference("guidance:sec:scope", has, index)).toBeUndefined();
  });

  test("a cross-paper miss FAILS — label absent, or no such document", () => {
    expect(unresolvedReference("guidance:def:missing", has, index)).toContain('has no label "def:missing"');
    // The label exists, but in the OTHER document.
    expect(unresolvedReference("guidance:prose:step-1", has, index)).toContain('has no label "prose:step-1"');
    expect(unresolvedReference("nosuchdoc:def:indicator", has, index)).toContain('no document "nosuchdoc"');
  });

  test("with no folio index the cross-paper ref is not judged", () => {
    expect(unresolvedReference("guidance:def:missing", has)).toBeUndefined();
  });

  test("a leading kind prefix is a label, not a document", () => {
    expect(splitCrossPaperRef("def:foo:bar")).toBeUndefined();
    expect(unresolvedReference("def:foo:bar", has, index)).toBeUndefined();
    expect(unresolvedReference("def:foo:baz", has, index)).toBe(UNRESOLVED_LOCAL);
    expect(splitCrossPaperRef("guidance:sec:scope")).toEqual({ doc: "guidance", label: "sec:scope" });
  });

  test("structural prefixes are known label prefixes", () => {
    for (const p of ["sec:", "chap:", "app:", "bib:"]) expect(KNOWN_LABEL_PREFIXES).toContain(p);
    expect(unresolvedReference("sec:intro", has, index)).toBeUndefined();
    expect(unresolvedReference("sec:absent", has, index)).toBe(UNRESOLVED_LOCAL);
  });
});

describe("uses-resolve / foreshadows-resolve rules", () => {
  const rule = (id: string) => CONSTRAINT_RULES.find((r) => r.id === id)!;
  const ctx = (folioLabels?: Map<string, Set<string>>): ConstraintContext => ({
    rootName: "b",
    dir: "/nowhere",
    allLabels: new Set(["prose:step-1"]),
    fileExists: () => true,
    folioLabels,
  });
  const block = (field: "uses" | "foreshadows", refs: string[]) =>
    ({ kind: "prose", label: "prose:step-1", [field]: refs }) as unknown as Block;

  for (const [id, field] of [["uses-resolve", "uses"], ["foreshadows-resolve", "foreshadows"]] as const) {
    test(`${id}: a resolving cross-paper ref passes`, () => {
      expect(rule(id).check(block(field, ["guidance:def:indicator"]), ctx(index))).toBeNull();
    });
    test(`${id}: a cross-paper miss fails`, () => {
      const msg = rule(id).check(block(field, ["guidance:def:missing", "elsewhere:def:x"]), ctx(index));
      expect(msg).toContain("guidance:def:missing");
      expect(msg).toContain("elsewhere:def:x");
    });
    test(`${id}: a bare sec: miss fails`, () => {
      expect(rule(id).check(block(field, ["sec:absent"]), ctx(index))).toContain("sec:absent");
    });
  }
});

/** A folio of two documents: guidance, and a toolkit linking into it. */
function twoDocFolio(): string {
  const folio = join(tmp("folio"), "folio");
  const doc = (slug: string, chapter: object, blocks: Record<string, object>) => {
    const ch = join(folio, slug, "ch1");
    mkdirSync(ch, { recursive: true });
    writeFileSync(join(folio, slug, `${slug}.ts`), `export default ${JSON.stringify({ title: slug, chapters: [{ dir: "ch1" }] })};\n`);
    writeFileSync(join(ch, "ch1.ts"), `export default ${JSON.stringify(chapter, null, 2)};\n`);
    for (const [name, b] of Object.entries(blocks)) {
      writeFileSync(join(ch, `${name}.ts`), `export default {\n  kind: "prose",\n  label: "${(b as { label: string }).label}",\n};\n`);
      writeFileSync(join(ch, `${name}.md`), `Body \\label{eq:${name}}\n`);
      writeFileSync(join(ch, `${name}.qa.json`), JSON.stringify({ label: "criterion-not-content" }));
    }
  };
  doc(
    "guidance",
    {
      title: "G",
      label: "chap:guidance",
      sections: [
        { title: "S", label: "sec:scope", blocks: ["a"], subsections: [{ title: "T", label: "sec:deep", blocks: [], subsections: [{ title: "U", label: "sec:deeper", blocks: ["b"] }] }] },
      ],
    },
    { a: { label: "def:indicator" }, b: { label: "rem:note" } },
  );
  doc("toolkit", { title: "K", sections: [{ title: "S", blocks: ["s1"] }] }, { s1: { label: "prose:step-1" } });
  mkdirSync(join(folio, "not-a-doc")); // no not-a-doc.ts manifest
  return folio;
}

describe("folio label index", () => {
  test("keys every document by slug; collects block, chapter, nested-section and \\label{} labels", () => {
    const idx = folioLabelIndex(twoDocFolio());
    expect([...idx.keys()]).toEqual(["guidance", "toolkit"]);
    const g = idx.get("guidance")!;
    for (const l of ["def:indicator", "rem:note", "chap:guidance", "sec:scope", "sec:deep", "sec:deeper", "eq:a"]) {
      expect(g.has(l)).toBe(true);
    }
    expect(g.has("criterion-not-content")).toBe(false);
    expect(g.has("prose:step-1")).toBe(false);
    expect(idx.get("toolkit")!.has("prose:step-1")).toBe(true);
  });

  test("an absent folio is an empty index", () => {
    expect(folioLabelIndex(join(tmp("nofolio"), "folio")).size).toBe(0);
    expect(documentLabels(join(tmp("nodoc"), "x")).size).toBe(0);
  });
});

describe("uses-editorial-hygiene entry resolution", () => {
  const g = { nodes: new Map([["prose:step-1", {}], ["def:indicator", {}]]) } as never;

  test("a cross-paper ref into the guidance document resolves", () => {
    expect(usesEntryProblem("guidance:def:indicator", g, index)).toBeUndefined();
    expect(usesEntryProblem("guidance:sec:scope", g, index)).toBeUndefined();
  });

  test("a cross-paper miss is broken, not accepted as external", () => {
    expect(usesEntryProblem("guidance:def:missing", g, index)).toBeDefined();
    expect(usesEntryProblem("ghost:def:indicator", g, index)).toBeDefined();
  });

  test("a bare sec: ref is checked, not read as external", () => {
    expect(usesEntryProblem("sec:step-one", g, index)).toBeUndefined();
    expect(usesEntryProblem("sec:nowhere", g, index)).toBe("no block or section in the folio has that label");
  });

  test("a URL is still accepted", () => {
    expect(usesEntryProblem("https://example.org/f#def:x", g, index)).toBeUndefined();
  });
});

describe("subsections at every depth", () => {
  const sections = [
    {
      title: "A",
      label: "sec:a",
      blocks: ["a"],
      subsections: [{ title: "B", label: "sec:b", blocks: ["b"], subsections: [{ title: "C", label: "sec:c", blocks: ["c"] }] }],
    },
    { title: "D", blocks: ["d"] },
  ] as unknown as Chapter["sections"];

  test("sectionBlockNames descends past the first subsection level", () => {
    expect(sectionBlockNames(sections)).toEqual(["a", "b", "c", "d"]);
    expect(listedSections(sections).map((s) => s.label ?? s.title)).toEqual(["sec:a", "sec:b", "sec:c", "D"]);
  });

  function chapterDir(secs: unknown[], blocks: string[]): string {
    const dir = join(tmp("deep"), "ch");
    mkdirSync(dir);
    writeFileSync(join(dir, "ch.ts"), `export default ${JSON.stringify({ title: "Chapter", sections: secs })};\n`);
    for (const b of blocks) {
      writeFileSync(join(dir, `${b}.ts`), `export default { kind: "prose", label: "rem:${b}", title: "T", chapter: "ch" };\n`);
      writeFileSync(join(dir, `${b}.md`), `Body of ${b}.\n`);
    }
    return dir;
  }
  const tagged = (issues: ValidationIssue[], tag: string) => issues.filter((i) => i.message.includes(tag));

  test("a block listed two levels down is loaded and is not reported unlisted", async () => {
    const dir = chapterDir(
      [{ title: "S", blocks: ["alpha"], subsections: [{ title: "T", blocks: [], subsections: [{ title: "U", blocks: ["gamma"] }] }] }],
      ["alpha", "gamma"],
    );
    const { issues } = await validateObjects(dir);
    expect(tagged(issues, "[unlisted-block]")).toEqual([]);
  });

  test("a block listed two levels down but absent from disk is an error", async () => {
    const dir = chapterDir(
      [{ title: "S", blocks: ["alpha"], subsections: [{ title: "T", blocks: [], subsections: [{ title: "U", blocks: ["missing"] }] }] }],
      ["alpha"],
    );
    const { issues } = await validateObjects(dir);
    expect(issues.filter((i) => i.message.startsWith("Block manifest not found")).length).toBe(1);
  });

  test("a block listed in a section and again in a nested subsection is a duplicate", async () => {
    const dir = chapterDir(
      [{ title: "S", label: "sec:s", blocks: ["alpha"], subsections: [{ title: "T", label: "sec:t", blocks: [], subsections: [{ title: "U", label: "sec:u", blocks: ["alpha"] }] }] }],
      ["alpha"],
    );
    const { issues } = await validateObjects(dir);
    expect(tagged(issues, "[chapter-block-dedupe]").length).toBe(1);
  });
});
