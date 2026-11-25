/**
 * Tests for obsoleting the msgids a catalogue carries and its source no longer has.
 *
 * The falsifier this file is built around: **the rewrite must not touch anything
 * else.** It edits committed translation catalogues, so a passing "the stale entry
 * became obsolete" assertion is worth little beside a silent change to the 68
 * entries that were fine. The round-trip test below is the one that matters.
 */
import { describe, it, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SITE_DIR } from "./translation-index.ts";
import {
  activeMsgids,
  declaredSources,
  isUnresolved,
  obsoleteEntries,
  resolveSource,
  survey,
} from "./obsolete-stale-po.ts";

/** A catalogue with a header, two live entries and one that has gone stale. */
const PO = [
  '# Arabic translation',
  'msgid ""',
  'msgstr ""',
  '"Language: ar\\n"',
  '',
  '#: guides/page.md:10',
  'msgid "Heading one"',
  'msgstr "عنوان واحد"',
  '',
  '#: guides/page.md:14',
  'msgid "a fragment the merge removed"',
  'msgstr "جزء أزالته عملية الدمج"',
  '',
  '#: guides/page.md:20',
  'msgid "Still present"',
  'msgstr "لا يزال موجودا"',
  '',
].join("\n");

describe("obsoleteEntries", () => {
  it("leaves the file untouched when nothing is stale", () => {
    expect(obsoleteEntries(PO, [])).toBe(PO);
  });

  it("moves the stale entry to the end, `#~`-prefixed, keeping its translation", () => {
    const out = obsoleteEntries(PO, ["a fragment the merge removed"]);
    expect(out).toContain('#~ msgid "a fragment the merge removed"');
    expect(out).toContain('#~ msgstr "جزء أزالته عملية الدمج"');
    // At the END: gettext keeps obsolete entries there, and so must this.
    const obsoleteAt = out.indexOf("#~ msgid");
    expect(obsoleteAt).toBeGreaterThan(out.indexOf('msgid "Still present"'));
  });

  it("EVERY line that is not the stale entry survives byte-for-byte", () => {
    // The falsifier. A rewrite that reprints the file could change quoting,
    // spacing or ordering anywhere, and no other assertion here would notice.
    const out = obsoleteEntries(PO, ["a fragment the merge removed"]);
    // Excluding the obsoleted entry's OWN lines — msgid, msgstr and the `#:`
    // reference that belongs to it. The first version of this test forgot the
    // reference and so asserted the file kept a pointer another test asserts it
    // drops: a test contradicting its sibling, which is worse than no test.
    const before = PO.split("\n").filter(
      (l) => l !== "" && !l.includes("the merge removed") && !l.includes("أزالته") && l !== "#: guides/page.md:14",
    );
    for (const line of before) expect(out).toContain(line);
    // And the surviving entries keep their ORDER and their `#:` references.
    expect(out.indexOf('msgid "Heading one"')).toBeLessThan(out.indexOf('msgid "Still present"'));
    expect(out).toContain("#: guides/page.md:10");
    expect(out).toContain("#: guides/page.md:20");
  });

  it("drops the obsoleted entry's `#:` reference, which would now dangle", () => {
    const out = obsoleteEntries(PO, ["a fragment the merge removed"]);
    expect(out).not.toContain("#: guides/page.md:14");
    expect(out).not.toContain("#~ #: guides/page.md:14");
  });

  it("preserves a multi-line string as continuation lines", () => {
    const wrapped = ['msgid ""', 'msgstr ""', '', '#: p.md:1', 'msgid "first half "', '"second half"', 'msgstr "whole"', ''].join("\n");
    // The msgid is the CONCATENATION of its parts, with no space inserted — the
    // first version of this test guessed `"first half second half"` and so
    // matched nothing, hiding that the reader was truncating at the first line.
    expect(activeMsgids(wrapped)).toEqual(["first half second half"]);
    const out = obsoleteEntries(wrapped, ["first half second half"]);
    // The msgid is two quoted parts; both must carry the marker or the file breaks.
    expect(out).toContain('#~ msgid "first half "');
    expect(out).toContain('#~ "second half"');
  });

  it("is idempotent — a second run finds nothing to do", () => {
    const once = obsoleteEntries(PO, ["a fragment the merge removed"]);
    // `activeMsgids` must not see the entry it just obsoleted, or the tool would
    // re-obsolete its own output and grow `#~ #~ msgid` on every run.
    expect(activeMsgids(once)).not.toContain("a fragment the merge removed");
    expect(obsoleteEntries(once, activeMsgids(once).filter((m) => m.includes("merge removed")))).toBe(once);
  });
});

describe("activeMsgids", () => {
  it("excludes an entry that is already obsolete", () => {
    const po = ['msgid ""', 'msgstr ""', '', 'msgid "live"', 'msgstr "x"', '', '#~ msgid "dead"', '#~ msgstr "y"', ''].join("\n");
    expect(activeMsgids(po)).toEqual(["live"]);
  });

  it("excludes the header's empty msgid", () => {
    expect(activeMsgids(PO)).not.toContain("");
  });
});

describe("declaredSources", () => {
  it("reads the `#:` references and de-duplicates them", () => {
    expect(declaredSources(PO)).toEqual(["guides/page.md"]);
  });

  it("returns nothing when the catalogue declares no source", () => {
    expect(declaredSources('msgid "x"\nmsgstr "y"\n')).toEqual([]);
  });
});

/** A throwaway layer: `docs/` plus whichever catalogues are given. */
function fixture(pages: Record<string, string>, cats: Record<string, string>): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "obsolete-po-"));
  // `siteRoot` CONFIRMS a site by finding `_config.yml` rather than trusting the
  // directory name, so the fixture carries one — which is the point: a tree that
  // merely looks like a site is reported as no site at all.
  mkdirSync(join(root, SITE_DIR), { recursive: true });
  writeFileSync(join(root, SITE_DIR, "_config.yml"), "title: fixture\n");
  for (const [rel, text] of Object.entries(pages)) {
    const abs = join(root, SITE_DIR, rel);
    mkdirSync(abs.slice(0, abs.lastIndexOf("/")), { recursive: true });
    writeFileSync(abs, text);
  }
  for (const [rel, text] of Object.entries(cats)) {
    const abs = join(root, "translations", rel);
    mkdirSync(abs.slice(0, abs.lastIndexOf("/")), { recursive: true });
    writeFileSync(abs, text);
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

describe("resolveSource — the declaration, not a guess", () => {
  it("resolves a reference that is abbreviated relative to the page's directory", () => {
    // A derived catalogue writes `agent-onboarding.md` for a page nested at
    // `docs/guides/agent-onboarding.md`, so the suffix has to be tried.
    const { root, cleanup } = fixture({ "guides/deep.md": "# Deep heading\n" }, {});
    const got = resolveSource(root, "deep.md");
    expect("path" in got && got.path.endsWith("guides/deep.md")).toBe(true);
    cleanup();
  });

  it("REFUSES an ambiguous suffix rather than picking one", () => {
    // This is the guard that the basename-matching version lacked: it paired
    // `kg-viewer.po` with a same-named page it had nothing to do with.
    const { root, cleanup } = fixture({ "a/same.md": "# One heading\n", "b/same.md": "# Two heading\n" }, {});
    expect(resolveSource(root, "same.md")).toEqual({ unresolved: "ambiguous" });
    cleanup();
  });

  it("reports an absent source rather than throwing", () => {
    const { root, cleanup } = fixture({ "x.md": "# X heading\n" }, {});
    expect(resolveSource(root, "nope.md")).toEqual({ unresolved: "source-absent" });
    cleanup();
  });

  it("never resolves to a page inside a locale directory, at any depth", () => {
    const { root, cleanup } = fixture({ "guides/ar/only.md": "# Arabic only\n" }, {});
    expect(resolveSource(root, "only.md")).toEqual({ unresolved: "source-absent" });
    cleanup();
  });
});

describe("survey classifies rather than counting zero", () => {
  it("marks a catalogue sourced from something other than markdown", () => {
    // `kg-viewer.po` declares `scripts/kg-viewer-strings.ts` — TypeScript UI
    // strings. Comparing it to any page is meaningless, and reporting it as
    // clean would be worse.
    const { root, cleanup } = fixture(
      { "p.md": "# A heading here\n" },
      { "ar/ui.po": '#: scripts/ui-strings.ts:4\nmsgid "Save"\nmsgstr "حفظ"\n' },
    );
    const rows = survey(root, { translationsDir: join(root, "translations") });
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("other-sourced");
    expect(isUnresolved(rows[0].source)).toBe(true);
    expect(rows[0].stale).toEqual([]);
    cleanup();
  });

  it("marks a catalogue that declares no source at all", () => {
    const { root, cleanup } = fixture({ "p.md": "# A heading here\n" }, { "ar/bare.po": 'msgid "Save"\nmsgstr "حفظ"\n' });
    expect(survey(root, { translationsDir: join(root, "translations") })[0].source).toBe("undeclared");
    cleanup();
  });

  it("finds the stale msgid when the source IS resolvable, and only that one", () => {
    const { root, cleanup } = fixture(
      { "guides/p.md": "# Heading one\n\nA paragraph of prose that is long enough.\n" },
      {
        "ar/p.po": [
          '#: p.md:1',
          'msgid "Heading one"',
          'msgstr "عنوان"',
          '',
          '#: p.md:3',
          'msgid "a fragment no longer present"',
          'msgstr "جزء"',
          '',
        ].join("\n"),
      },
    );
    const rows = survey(root, { translationsDir: join(root, "translations") });
    expect(rows[0].source).toBe(`${SITE_DIR}/guides/p.md`);
    expect(rows[0].stale).toEqual(["a fragment no longer present"]);
    expect(rows[0].live).toBe(1);
    cleanup();
  });
});
