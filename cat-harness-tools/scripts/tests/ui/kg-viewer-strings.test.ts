/**
 * The viewer's words and its table say the same thing.
 *
 * ## Why a test rather than a convention
 *
 * The page looks up a string BY ITS ENGLISH TEXT — that is what a gettext
 * msgid is, and it is what makes a `.po` readable without the page beside it.
 * The cost is that the join is a string literal in two files, and a typo in
 * either one fails SILENTLY: `T("Select a node")` without its full stop finds
 * no entry, falls back to itself, and renders in English forever in every
 * language, looking exactly like a string nobody has translated yet.
 *
 * Nothing else in the pipeline can see that. `--check` compares the table with
 * the catalogues; the e2e suite drives the page in one language at a time and
 * would have to assert every string to notice. This compares the table with
 * the page's own calls, in both directions:
 *
 *   - every `T(...)` in the generator names a string the table declares, so a
 *     typo cannot quietly become an untranslatable string;
 *   - every string the table declares is asked for by the generator, so a
 *     removed line does not leave translators maintaining a dead entry.
 *
 * ## Reading the call sites rather than running them
 *
 * The page's script is a template literal inside `kg-viewer.ts`: it is text
 * here and JavaScript only in a browser, so its calls cannot be executed from
 * a unit test. They are read instead — a literal or a run of adjacent literals
 * joined by `+`, which is how the two long sentences are written to stay
 * inside the line length. A call with a computed argument would not be found
 * by this, and `T(cond ? a : b)` is deliberately written as two separate calls
 * in the generator so that it is.
 *
 * @module scripts/tests/kg-viewer-strings
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { directoryForGraph, deferResolution} from "../../../schemas/kg/cat-harness.js";

import { parsePoEntries } from "../../../pipeline/po-inject.ts";
import {
  UI_STRINGS,
  loadCatalogues,
  localeDir,
  localeName,
  plannedLocales,
  poHeader,
  potEntries,
} from "../../kg-viewer-strings.ts";
import { viewerHtml } from "../../kg-viewer.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../lib/roots.ts";

const ROOT = join(HARNESS_ROOT);

// The catalogues live where the DECLARATION says, not at a composed path. These
// three assertions read `join(ROOT, "translations/…")` until `wggr` moved the
// directory under the layer stub and they failed ENOENT — correctly, and for
// the reason the slice exists to surface: a reader that composes a declared path
// is a reader that has to be edited every time the layout moves.
// declared-path-literal: the convention fallback for a layer that declares
// nothing, matching `translationSourcesDir` in src/tools/translation.ts.
const TRANSLATIONS = deferResolution(() => directoryForGraph(ROOT, "translation-sources") ?? join(ROOT, "translations"), {
  moduleUrl: import.meta.url,
  what: "TRANSLATIONS",
  under: ROOT,
});
const GENERATOR = readFileSync(join(TOOLS_ROOT, "scripts", "kg-viewer.ts"), "utf-8");

/** A double-quoted JS string literal, with escapes. */
const LITERAL = String.raw`"(?:[^"\\]|\\.)*"`;
/** A `T(` call whose first argument is a literal or a run of them joined by `+`. */
const CALL = new RegExp(String.raw`\bT\(\s*(${LITERAL}(?:\s*\+\s*${LITERAL})*)`, "g");

/** The msgids the generator actually asks for. */
function calledStrings(): string[] {
  const out: string[] = [];
  for (const m of GENERATOR.matchAll(CALL)) {
    const parts = m[1].match(new RegExp(LITERAL, "g")) ?? [];
    out.push(parts.map((p) => JSON.parse(p) as string).join(""));
  }
  return out;
}

describe("the viewer's strings and its table", () => {
  test("every T() call names a string the table declares", () => {
    const declared = new Set(UI_STRINGS.map((s) => s.en));
    const unknown = [...new Set(calledStrings())].filter((s) => !declared.has(s));
    expect(unknown).toEqual([]);
  });

  test("every declared string is asked for by the page", () => {
    const called = new Set(calledStrings());
    const unused = UI_STRINGS.map((s) => s.en).filter((s) => !called.has(s));
    expect(unused).toEqual([]);
  });

  test("the generator finds the calls at all", () => {
    // A guard on the guard: if the regex stopped matching, both assertions
    // above would pass over an empty set and report nothing.
    expect(calledStrings().length).toBeGreaterThanOrEqual(UI_STRINGS.length);
  });

  test("every entry carries a translator comment, and names its placeholders", () => {
    for (const s of UI_STRINGS) {
      expect(s.comment.length).toBeGreaterThan(20);
      for (const m of s.en.matchAll(/\{([a-zA-Z]\w*)\}/g)) {
        // A translator sees the msgid and the comment and nothing else. A
        // placeholder the comment does not explain is a slot they must guess.
        expect(s.comment).toContain(m[1]);
      }
    }
  });

  test("the POT entries point at real lines of the table", () => {
    const source = readFileSync(join(TOOLS_ROOT, "scripts", "kg-viewer-strings.ts"), "utf-8");
    const lines = source.split("\n");
    const entries = potEntries(source);
    expect(entries.length).toBe(UI_STRINGS.length);
    for (const e of entries) {
      expect(e.line).toBeGreaterThan(1);
      expect(lines[e.line - 1]).toContain(JSON.stringify(e.msgid).slice(1, -1));
    }
  });
});

describe("the catalogues that ship", () => {
  const LOCALES = ["ar", "es", "fr", "ru", "zh"];

  test("every locale has a stub carrying every msgid the viewer says", () => {
    const declared = UI_STRINGS.map((s) => s.en);
    for (const loc of LOCALES) {
      const po = readFileSync(join(TRANSLATIONS(), loc, "kg-viewer.po"), "utf-8");
      const entries = parsePoEntries(po);
      expect(entries.map((e) => e.msgid).sort()).toEqual([...declared].sort());
    }
  });

  test("and not one of them is filled in — that is the decision, not an omission", () => {
    // English only; translators fill these. A machine translation into a
    // language nobody here reads is an artefact whose correctness cannot be
    // checked here, and a header calling it unofficial does not change what a
    // reader sees. If this test ever fails because somebody translated a
    // catalogue by hand, delete the test rather than the translation.
    for (const loc of LOCALES) {
      const po = readFileSync(join(TRANSLATIONS(), loc, "kg-viewer.po"), "utf-8");
      for (const e of parsePoEntries(po)) expect(e.msgstr).toBe("");
    }
  });

  test("so the shipped page offers English and nothing else", () => {
    // An empty catalogue is not a language the page can show, so it is not
    // offered: a switcher listing a language that renders in English would be
    // a worse lie than no switcher.
    expect(loadCatalogues(ROOT)).toEqual([]);
  });

  test("...and shows every shipped locale as PLANNED, disabled (bean w6fu)", () => {
    // Owner's ruling 2026-10-02: the switcher is shown, disabled, so a reader
    // can see translations are planned. Each catalogue with no translated
    // string is a planned language — and none is a choice.
    expect(plannedLocales(ROOT).map((l) => l.locale)).toEqual([...LOCALES].sort());
    expect(plannedLocales(ROOT).find((l) => l.locale === "ar")?.dir).toBe("rtl");
  });

  test("a catalogue's first translated string enables it, with no code change", () => {
    // The two lists are decided by the catalogue's CONTENTS, read through one
    // loader, so a language cannot be in both and cannot be in neither.
    const root = mkdtempSync(join(tmpdir(), "kg-viewer-planned-"));
    const write = (loc: string, msgstr: string) => {
      mkdirSync(join(root, "translations", loc), { recursive: true });
      writeFileSync(join(root, "translations", loc, "kg-viewer.po"),
        'msgid ""\nmsgstr ""\n"Language: ' + loc + '\\n"\n\nmsgid "Nodes"\nmsgstr "' + msgstr + '"\n');
    };
    write("qaa", "");
    expect(loadCatalogues(root)).toEqual([]);
    expect(plannedLocales(root).map((l) => l.locale)).toEqual(["qaa"]);
    write("qaa", "NODES");
    expect(loadCatalogues(root).map((c) => c.locale)).toEqual(["qaa"]);
    expect(plannedLocales(root)).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  test("a catalogue is unofficial until its own file says otherwise", () => {
    // Read from the .po header rather than a second store, so the file
    // answers for its own status.
    expect(poHeader('"X-Folio-Official: yes\\n"', "X-Folio-Official")).toBe("yes");
    expect(poHeader('"Language: fr\\n"', "X-Folio-Official")).toBeUndefined();
    for (const loc of LOCALES) {
      const po = readFileSync(join(TRANSLATIONS(), loc, "kg-viewer.po"), "utf-8");
      expect((poHeader(po, "X-Folio-Official") ?? "").toLowerCase()).toBe("no");
    }
  });

  test("a half-written catalogue is taken at exactly its own word", () => {
    // The path every shipped locale is on, and the one the fixture page drives
    // in the browser. Written to a scratch tree and read back through the real
    // loader: what is translated is offered, an EMPTY msgstr is not a
    // translation, and a catalogue with nothing in it is no catalogue at all.
    const root = mkdtempSync(join(tmpdir(), "kg-viewer-cat-"));
    const write = (loc: string, body: string) => {
      mkdirSync(join(root, "translations", loc), { recursive: true });
      writeFileSync(join(root, "translations", loc, "kg-viewer.po"),
        'msgid ""\nmsgstr ""\n"Language: ' + loc + '\\n"\n\n' + body);
    };
    write("qaa", 'msgid "Nodes"\nmsgstr "NODES"\n\nmsgid "Kind"\nmsgstr ""\n');
    write("qab", 'msgid "Nodes"\nmsgstr ""\n');

    const loaded = loadCatalogues(root);
    expect(loaded.map((c) => c.locale)).toEqual(["qaa"]);
    expect(loaded[0].strings).toEqual({ Nodes: "NODES" });
    expect(loaded[0].translated).toBe(1);
    expect(loaded[0].official).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });

  test("the writing direction comes from the tag, so Arabic turns the page", () => {
    expect(localeDir("ar")).toBe("rtl");
    expect(localeDir("ar-EG")).toBe("rtl");
    expect(localeDir("fr")).toBe("ltr");
    expect(localeName("zh")).toBe("中文");
    // A tag we know nothing about is shown as itself rather than guessed at.
    expect(localeName("qaa")).toBe("qaa");
  });
});

describe("the generated page", () => {
  test("English is offered even when there is no catalogue at all", () => {
    // A checkout with no translations must still produce a working page, and
    // the switcher must not appear with a single choice in it.
    const html = viewerHtml("some-stub", []);
    expect(html).toContain('"locale":"en"');
    expect(html).toContain("const LOCALES = ");
    expect(html).toContain("const STRINGS = {}");
  });

  test("a planned language reaches the page as PLANNED, never as a choice", () => {
    const html = viewerHtml("some-stub", [], [{ locale: "xx", name: "Test", dir: "ltr" }]);
    expect(html).toContain('const PLANNED = [{"locale":"xx","name":"Test","dir":"ltr"}]');
    const locales = html.slice(html.indexOf("const LOCALES = "), html.indexOf("const PLANNED = "));
    expect(locales).not.toContain('"xx"');
  });

  test("a catalogue reaches the page, whole", () => {
    const html = viewerHtml("some-stub", [
      {
        locale: "xx",
        name: "Test",
        dir: "ltr",
        official: false,
        translated: 1,
        strings: { Nodes: "NODES-XX" },
      },
    ]);
    expect(html).toContain("NODES-XX");
    expect(html).toContain('"locale":"xx"');
  });

  test("nothing a catalogue carries can end the template literal or the script", () => {
    // The page is ONE template literal and a translation is text somebody
    // else wrote. A backtick would end it, a dollar-brace would interpolate
    // at generation time, and a closing script tag would escape the element.
    const hostile = "a " + String.fromCharCode(96) + " b ${x} c </script> d";
    const html = viewerHtml("some-stub", [
      {
        locale: "xx",
        name: "Test",
        dir: "ltr",
        official: false,
        translated: 1,
        strings: { Nodes: hostile },
      },
    ]);
    const payload = html.slice(html.indexOf("const STRINGS = "), html.indexOf("const LOCALES = "));
    expect(payload).not.toContain(String.fromCharCode(96));
    expect(payload).not.toContain("${");
    expect(payload).not.toContain("</script");
    // ...and the text still arrives: escaped, not dropped.
    expect(payload).toContain("\\u0060");
    expect(payload).toContain("\\u0024{x}");
  });
});
