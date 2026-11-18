/**
 * The `.po` parser, and the two rules the status page rests on.
 *
 * @module scripts/tests/gen-translation-status.test
 *
 * Bean `lnur`. The page itself is a table; the thing that can be WRONG is the
 * parse behind it, and wrong quietly — every failure mode below produces a
 * plausible number rather than an error. So each awkward case gets a fixture
 * rather than trusting one regex over the real corpus, where a miscount would
 * simply look like a different coverage figure.
 */
import { describe, expect, test } from "bun:test";

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { countCatalogue, languageName, localeOfficiality, localeStatuses, officialityLabel, otherInstances, reviewLayers, reviewProjection, share, statusPage } from "../gen-translation-status.ts";
import { unscopedSelectors } from "../lib/themed-page.ts";

/** A minimal catalogue header — every real `.po` opens with one. */
const HEADER = `# Some translation
msgid ""
msgstr ""
"Project-Id-Version: folio-assistant\\n"
"Language: es\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
`;

describe("the header entry is metadata, not a string", () => {
  test("a catalogue with ONLY a header has no entries", () => {
    // Counting it inflates every locale by exactly one, invisibly, and in the
    // direction that flatters. A file with nothing translated would report
    // one translated string.
    expect(countCatalogue(HEADER)).toEqual({
      entries: 0,
      translated: 0,
      fuzzy: 0,
      untranslated: 0,
    });
  });

  test("and it does not shift the count of the entries that follow", () => {
    const c = countCatalogue(`${HEADER}
msgid "Hello"
msgstr "Hola"
`);
    expect(c.entries).toBe(1);
    expect(c.translated).toBe(1);
  });
});

describe("fuzzy is counted APART from translated", () => {
  test("a fuzzy entry is neither translated nor untranslated", () => {
    // The single most misleading thing this parser could do is fold fuzzy
    // into translated: fuzzy entries are exactly the ones a reviewer must
    // look at, so hiding them defeats the page.
    const c = countCatalogue(`${HEADER}
#, fuzzy
msgid "Hello"
msgstr "Hola"
`);
    expect(c).toEqual({ entries: 1, translated: 0, fuzzy: 1, untranslated: 0 });
  });

  test("a flag line carrying other flags still registers fuzzy", () => {
    const c = countCatalogue(`${HEADER}
#, fuzzy, c-format
msgid "%s items"
msgstr "%s elementos"
`);
    expect(c.fuzzy).toBe(1);
  });

  test("a comment merely CONTAINING the word fuzzy is not a flag", () => {
    // `#,` is the flag line; `#` alone is a translator note. Matching the
    // word anywhere would mark an entry fuzzy because somebody wrote about
    // fuzziness in a note.
    const c = countCatalogue(`${HEADER}
# this one was fuzzy last week
msgid "Hello"
msgstr "Hola"
`);
    expect(c.fuzzy).toBe(0);
    expect(c.translated).toBe(1);
  });
});

describe("plural forms live in msgstr[n], not msgstr", () => {
  test("a translated plural counts as translated", () => {
    // A parser that only knows `msgstr` reports EVERY plural entry as
    // untranslated — a whole category silently marked undone.
    const c = countCatalogue(`${HEADER}
msgid "one file"
msgid_plural "%d files"
msgstr[0] "un archivo"
msgstr[1] "%d archivos"
`);
    expect(c).toEqual({ entries: 1, translated: 1, fuzzy: 0, untranslated: 0 });
  });

  test("an empty plural set counts as untranslated", () => {
    const c = countCatalogue(`${HEADER}
msgid "one file"
msgid_plural "%d files"
msgstr[0] ""
msgstr[1] ""
`);
    expect(c).toEqual({ entries: 1, translated: 0, fuzzy: 0, untranslated: 1 });
  });
});

describe("continuation lines are part of the value", () => {
  test("a long translation split over lines is translated", () => {
    // Emptiness cannot be judged from the keyword's own line: a wrapped
    // string has `msgstr ""` on the first line and the content beneath it.
    const c = countCatalogue(`${HEADER}
msgid "A long sentence that was wrapped"
msgstr ""
"Una frase larga "
"que fue envuelta"
`);
    expect(c.translated).toBe(1);
    expect(c.untranslated).toBe(0);
  });

  test("a genuinely empty msgstr is still untranslated", () => {
    // The control for the case above — without it, a rule that treated
    // `msgstr ""` as "probably continued" would pass.
    const c = countCatalogue(`${HEADER}
msgid "Not done yet"
msgstr ""
`);
    expect(c).toEqual({ entries: 1, translated: 0, fuzzy: 0, untranslated: 1 });
  });
});

describe("the whole is the sum of its entries", () => {
  test("a mixed catalogue adds up, and the three states partition the entries", () => {
    const c = countCatalogue(`${HEADER}
msgid "One"
msgstr "Uno"

#, fuzzy
msgid "Two"
msgstr "Dos"

msgid "Three"
msgstr ""
`);
    expect(c).toEqual({ entries: 3, translated: 1, fuzzy: 1, untranslated: 1 });
    // The partition is the invariant that makes the table readable: a reader
    // adding the last three columns must get the entries column.
    expect(c.translated + c.fuzzy + c.untranslated).toBe(c.entries);
  });
});

describe("a share over an empty denominator has NO BASIS", () => {
  test("zero denominator is null, never 0", () => {
    // Rendering it as 0% reports a measurement that was not made. This is the
    // could-not-determine rule the repository holds everywhere, in the one
    // place it is easiest to lose — a division.
    expect(share(0, 0)).toBeNull();
    expect(share(5, 0)).toBeNull();
  });

  test("a real share is a percentage to one decimal", () => {
    expect(share(1, 3)).toBe(33.3);
    expect(share(19, 318)).toBe(6);
    expect(share(4, 4)).toBe(100);
  });

  test("zero of something is 0, which is NOT the same as no basis", () => {
    // The distinction the null exists for: "none of 40 done" is a
    // measurement; "none of 0" is not.
    expect(share(0, 40)).toBe(0);
  });
});

describe("the date on the page is when the numbers CHANGED", () => {
  const locales = [
    { locale: "es", templates: 10, catalogues: 2, entries: 40, translated: 30, fuzzy: 2, untranslated: 8, unreadable: [] },
  ];

  test("two runs on different days render identically apart from the date", () => {
    // The gate this protects: `--check` compares the artefacts with every ISO
    // date blanked. Without that, a committed page goes stale at midnight
    // with not one catalogue touched, and CI is red on every branch until
    // somebody re-runs a generator that changes one line. A gate that fails
    // for a reason nobody can act on is a gate people learn to re-run rather
    // than read.
    const a = statusPage({ locales, changedAt: "2026-01-05", scope: "cat-harness/translations" });
    const b = statusPage({ locales, changedAt: "2026-09-22", scope: "cat-harness/translations" });
    expect(a).not.toBe(b);
    const blank = (t: string) => t.replace(/\d{4}-\d{2}-\d{2}/g, "<date>");
    expect(blank(a)).toBe(blank(b));
  });

  test("a changed COUNT survives the blanking, so the check still fires", () => {
    // The control. A normaliser that blanked too much would make every page
    // compare equal, and the gate would pass over a real change — which is
    // the failure that looks exactly like success.
    const more = [{ ...locales[0]!, translated: 31, untranslated: 7 }];
    const blank = (t: string) => t.replace(/\d{4}-\d{2}-\d{2}/g, "<date>");
    expect(blank(statusPage({ locales, changedAt: "2026-01-05", scope: "x" }))).not.toBe(
      blank(statusPage({ locales: more, changedAt: "2026-01-05", scope: "x" })),
    );
  });

  test("the page is THEMED, so it carries the site's top band (2026-10-07)", () => {
    const html = statusPage({ locales, changedAt: "2026-01-05", scope: "cat-harness/translations" });
    expect(html.startsWith("---\nlayout: default\n")).toBe(true);
    expect(html).not.toMatch(/<!doctype|<html|<head|<body|<main\b/i);
    expect(html).toContain('<h1 id="ts-title">');
    expect(unscopedSelectors(html, ".ts-page")).toEqual([]);
    // Still no JavaScript: the numbers are known at generate time.
    expect(html).not.toContain("<script");
  });

  test("the skill link climbs to the SITE ROOT from the page's own depth (folio-assistant#2527)", () => {
    // The page is `<locale>/<harness>/translation-status/`, three directories
    // deep; the reference pages are at the site root. A hand-counted `../`
    // resolved to `<harness>/reference/…`, which does not exist.
    const html = statusPage({ locales, changedAt: "2026-01-05", scope: "x" });
    expect(html).toContain('href="../../../reference/skill-instructions/translation-manager.html"');
    expect(html).not.toContain('href="../reference/');
    const given = statusPage({ locales, changedAt: "2026-01-05", scope: "x", siteRoot: "../../" });
    expect(given).toContain('href="../../reference/skill-instructions/translation-manager.html"');
  });

  test("the SCOPE is on the page, so a number cannot be read as covering everything", () => {
    const html = statusPage({ locales, changedAt: "2026-01-05", scope: "cat-harness/translations" });
    expect(html).toContain("cat-harness/translations");
  });
});

describe("another instance's catalogues are measured, in their own table — issue #2228", () => {
  // who-iris's catalogues moved into its own declared directory on 2026-10-04
  // and the page, which measured one directory, stopped counting them.
  test("a sibling instance that declares translation-sources is found, and the handler itself is not", () => {
    const repo = mkdtempSync(join(tmpdir(), "ts-inst-"));
    const plant = (name: string, withDir: boolean): void => {
      mkdirSync(join(repo, name, "translations", "fr"), { recursive: true });
      writeFileSync(
        join(repo, name, `${name}.json`),
        JSON.stringify({ name, directories: withDir ? [{ id: "t", path: "translations/", graphTypologies: ["translation-sources"] }] : [] }),
      );
      writeFileSync(join(repo, name, "translations", "fr", "x.po"), `${HEADER}\nmsgid "a"\nmsgstr "b"\n`);
    };
    plant("handler", true);
    plant("inst", true);
    plant("undeclared", false);
    const found = otherInstances(repo, join(repo, "handler"));
    expect(found.map((i) => i.instance)).toEqual(["inst"]);
    expect(found[0]!.locales[0]).toMatchObject({ locale: "fr", catalogues: 1, entries: 1, translated: 1 });
  });

  test("each instance is its own table, with ids that do not collide with the first", () => {
    const loc = { locale: "fr", templates: 1, catalogues: 1, entries: 2, translated: 2, fuzzy: 0, untranslated: 0, unreadable: [] };
    const html = statusPage({
      locales: [loc],
      changedAt: "2026-10-05",
      scope: "cat-harness/translations",
      instances: [{ instance: "who-iris", scope: "who-iris/translations", locales: [loc] }],
    });
    expect(html).toContain(`id="locale-fr"`);
    expect(html).toContain(`id="who-iris-locale-fr"`);
    expect(html).toContain("<code>who-iris/translations</code>");
  });
});

describe("translation status visualiser wireframe findings (bgrz)", () => {
  const sampleLocales = [
    { locale: "ar", templates: 63, catalogues: 4, entries: 168, translated: 124, fuzzy: 0, untranslated: 44, unreadable: [] },
    { locale: "es", templates: 63, catalogues: 3, entries: 85, translated: 41, fuzzy: 0, untranslated: 44, unreadable: [] },
    { locale: "fr", templates: 66, catalogues: 5, entries: 171, translated: 60, fuzzy: 0, untranslated: 111, unreadable: [] },
  ];

  test("finding 1: table has horizontal scroll wrapper, scroll hint, and mobile breathing room", () => {
    const html = statusPage({ locales: sampleLocales, changedAt: "2026-10-09", scope: "cat-harness/translations" });
    expect(html).toContain('class="ts-table-wrapper"');
    expect(html).toContain('class="ts-scroll-hint"');
    expect(html).toContain("overflow-x: auto");
    expect(html).toContain("min-width: 36rem");
    expect(html).toContain("fa-scroll-cue");
  });

  test("finding 2: styles support prefers-color-scheme: light without overriding explicit dark theme", () => {
    const html = statusPage({ locales: sampleLocales, changedAt: "2026-10-09", scope: "cat-harness/translations" });
    expect(html).toContain("@media (prefers-color-scheme: light)");
    expect(html).toContain(':root[data-fa-scheme="dark"]');
    expect(html).toContain(':root[data-fa-scheme="light"]');
  });

  test("finding 3: languageName renders human-readable language names alongside locale codes", () => {
    expect(languageName("ar")).toBe("Arabic");
    expect(languageName("es")).toBe("Spanish");
    expect(languageName("fr")).toBe("French");
    expect(languageName("ru")).toBe("Russian");
    expect(languageName("zh")).toBe("Chinese");
    expect(languageName("xyz-unknown-locale")).toBeUndefined();

    const html = statusPage({ locales: sampleLocales, changedAt: "2026-10-09", scope: "cat-harness/translations" });
    expect(html).toContain('<code>ar</code> <span class="ts-lang-name">Arabic</span>');
    expect(html).toContain('<code>es</code> <span class="ts-lang-name">Spanish</span>');
    expect(html).toContain('<code>fr</code> <span class="ts-lang-name">French</span>');
  });

  test("finding 4: visual separation between catalogue availability (Q1) and string metrics (Q2)", () => {
    const html = statusPage({ locales: sampleLocales, changedAt: "2026-10-09", scope: "cat-harness/translations" });
    expect(html).toContain('class="ts-questions-legend"');
    expect(html).toContain("Question 1 (Availability)");
    expect(html).toContain("Question 2 (Completeness)");
    expect(html).toContain('class="ts-col-catalogues"');
    expect(html).toContain('class="ts-col-strings"');
    expect(html).toContain("Q1: availability");
    expect(html).toContain("Q2: strings");
  });

  test("finding 5: onward links to translation-manager skill and source files", () => {
    const html = statusPage({ locales: sampleLocales, changedAt: "2026-10-09", scope: "cat-harness/translations" });
    // From the site root, which the page is three directories below
    // (`<locale>/<harness>/translation-status/`, folio-assistant#2527).
    expect(html).toContain('href="../../../reference/skill-instructions/translation-manager.html"');
    expect(html).toContain('id="onward-links"');
    expect(html).toContain("https://github.com/litlfred/folio-assistant/tree/main/cat-harness/translations");
    expect(html).toContain("https://github.com/litlfred/folio-assistant/tree/main/cat-harness/translations/fr");
  });

  test("finding 6: accessibility markup is preserved (th scope=col and th scope=row)", () => {
    const html = statusPage({ locales: sampleLocales, changedAt: "2026-10-09", scope: "cat-harness/translations" });
    const colHeaders = html.match(/<th\s+scope="col"[^>]*>/g) ?? [];
    const rowHeaders = html.match(/<th\s+scope="row"[^>]*>/g) ?? [];
    expect(colHeaders.length).toBe(7);
    expect(rowHeaders.length).toBe(sampleLocales.length);
  });
});

describe("officiality per locale, from BOTH records (bean cat-tools-bbnd)", () => {
  const po = (official?: string) =>
    `msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n${official ? `"X-Folio-Official: ${official}\\n"\n` : ""}\nmsgid "a"\nmsgstr "b"\n`;
  const locale = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), "tr-off-"));
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    return dir;
  };

  test("silence on both sides is unofficial, which is the state everywhere today", () => {
    expect(localeOfficiality(locale({ "a.po": po() }))).toEqual({ state: "unofficial", officialCatalogues: 0, findings: 0 });
  });

  test("status.json official, named, and every catalogue agreeing is official", () => {
    const o = localeOfficiality(locale({
      "a.po": po("yes"),
      "status.json": JSON.stringify({ official: true, signedOffBy: "Dr. A", signedOffAt: "2026-10-01" }),
    }));
    expect(o).toEqual({ state: "official", signedOffBy: "Dr. A", signedOffAt: "2026-10-01", officialCatalogues: 1, findings: 0 });
    expect(officialityLabel(o)).toBe("official, signed off by Dr. A on 2026-10-01");
  });

  test("a catalogue claiming official with no status.json is a DISAGREEMENT, never official", () => {
    const o = localeOfficiality(locale({ "a.po": po("yes"), "b.po": po() }));
    expect(o.state).toBe("disagree");
    expect(o.findings).toBe(1);
    expect(officialityLabel(o)).toContain("records disagree");
  });

  test("each catalogue is listed with its counts and its own header, for the per-row drawer", () => {
    const root = mkdtempSync(join(tmpdir(), "tr-files-"));
    mkdirSync(join(root, "fr"));
    writeFileSync(join(root, "fr", "a.po"), po("yes"));
    writeFileSync(join(root, "fr", "b.po"), po());
    const [fr] = localeStatuses(root);
    expect(fr!.files!.map((f) => [f.path, f.translated, f.official ?? null])).toEqual([["a.po", 1, "yes"], ["b.po", 1, null]]);
  });

  test("an unreadable status.json is could-not-determine, not unofficial", () => {
    expect(localeOfficiality(locale({ "a.po": po(), "status.json": "{not json" })).state).toBe("unreadable");
  });

  test("the status table carries a signed-off column with the state as data", () => {
    const html = statusPage({
      locales: [{
        locale: "fr", templates: 1, catalogues: 1, entries: 1, translated: 1, fuzzy: 0, untranslated: 0, unreadable: [],
        officiality: { state: "unofficial", officialCatalogues: 0, findings: 0 },
      }],
      changedAt: "2026-10-20",
      scope: "x/translations",
    });
    expect(html).toContain('data-fa-tr-locale="fr"');
    expect(html).toContain('data-fa-tr-officiality="unofficial"');
    expect(html).toContain("not signed off");
  });
});

describe("the review projection", () => {
  test("names the review page, the issue contract, and every catalogue's sources and state", () => {
    const root = mkdtempSync(join(tmpdir(), "tr-review-"));
    const layer = join(root, "lay");
    mkdirSync(join(layer, "translations", "fr"), { recursive: true });
    writeFileSync(join(layer, "lay.json"), JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "lay", repository: "acme/lay", directories: [{ id: "lay-tr", path: "translations/", graphTypologies: ["translation-sources"] }] }));
    writeFileSync(join(layer, "translations", "fr", "page.po"), '#: docs/no-such-review-page.md:1\nmsgid "Hi"\nmsgstr "Salut"\n');
    const layers = reviewLayers(root, layer);
    const p = JSON.parse(reviewProjection(layers, "en/h/translation-status/index.md"));
    expect(p.$schema).toBe("folio-translation-review/v1");
    expect(p.reviewPage).toBe("en/h/translation-status/review.html");
    expect(p.issue).toMatchObject({ schema: "translation-adjudication/v1", label: "translation-adjudication", fence: "json translation-adjudication", candidatesSchema: "translation-candidates/v1", candidatesSuffix: ".candidates.json" });
    const lay = p.layers.find((l: { name: string }) => l.name === "lay");
    expect(lay).toMatchObject({ repository: "acme/lay", translations: "translations", locales: ["fr"] });
    expect(lay.rows[0]).toMatchObject({ catalogue: "page", sources: ["docs/no-such-review-page.md"], cells: { fr: { state: "machine", translated: 1 } } });
  });
});
