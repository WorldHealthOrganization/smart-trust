/**
 * Tests for the journeys viewer in every language (`journeys/locales.ts`).
 *
 * The falsifier: a translated copy must sit at the SAME path under its locale,
 * and every page, English included, must name the others, or the language bar
 * links to a 404.
 */
import { describe, expect, it } from "bun:test";

import { LANGS_MARK, localizedFiles, mergeCatalogue, potEntries, runtimeStrings } from "../journeys/locales.ts";
import type { PageFile } from "../journeys/render.ts";

const page = (body: string) => `<!doctype html>
<html lang="en">
<head><title>Overview</title></head>
<body><div class="jp-top-r">${LANGS_MARK}</div><p>Ask the room</p>
<script type="application/json" data-jp-gapreport-model>{"items":[{"label":"Decision rights","id":"d1"}]}</script>
${body}</body>
</html>
`;

const FILES: PageFile[] = [
  { path: "en/top/journeys/index.html", content: page("") },
  { path: "en/top/journeys/w/overview/index.html", content: page("<p>Somsak</p>") },
  { path: "en/top/journeys/assets/journeys.css", content: "body{}" },
];

describe("potEntries", () => {
  it("takes every page's words, the JSON models' labels and the scripts' T() strings, each once", () => {
    const ids = potEntries(FILES).map((e) => e.msgid);
    expect(ids.filter((m) => m === "Ask the room")).toHaveLength(1);
    expect(ids).toContain("Decision rights");
    expect(ids).not.toContain("d1");
    for (const r of runtimeStrings()) expect(ids).toContain(r.msgid);
    expect(runtimeStrings().map((r) => r.msgid)).toContain("Copied");
  });
});

describe("localizedFiles", () => {
  const cat = new Map([
    ["Ask the room", "Demandez à la salle"],
    ["Decision rights", "Droits de décision"],
    ["Copied", "Copié"],
  ]);
  const { files, reports } = localizedFiles(FILES, new Map([["fr", cat]]));
  const at = (p: string) => files.find((f) => f.path === p)?.content as string;

  it("writes each file again at the same path under the locale", () => {
    expect(files.map((f) => f.path).sort()).toEqual(
      [...FILES.map((f) => f.path), ...FILES.map((f) => f.path.replace(/^en\//, "fr/"))].sort(),
    );
    expect(at("fr/top/journeys/index.html")).toContain("<p>Demandez à la salle</p>");
    expect(at("fr/top/journeys/index.html")).toContain('<html lang="fr">');
  });

  it("names every language on every page, as alternates and as links", () => {
    const en = at("en/top/journeys/w/overview/index.html");
    expect(en).toContain('<link rel="alternate" hreflang="fr" href="../../../../../fr/top/journeys/w/overview/">');
    expect(en).toContain('hreflang="fr" href="../../../../../fr/top/journeys/w/overview/"');
    expect(en).not.toContain(LANGS_MARK);
    const fr = at("fr/top/journeys/w/overview/index.html");
    expect(fr).toContain('"lang":"fr"');
    expect(fr).toContain('"translationStatus":"unverified"');
  });

  it("translates the JSON models' labels and carries the scripts' catalogue", () => {
    const fr = at("fr/top/journeys/index.html");
    expect(fr).toContain('"label":"Droits de décision","id":"d1"');
    expect(fr).toContain('<script type="application/json" id="jv-i18n">{"Copied":"Copié"}</script>');
  });

  it("reports what is left English", () => {
    expect(reports[0].locale).toBe("fr");
    expect(reports[0].untranslated).toBeGreaterThan(0);
    expect(reports[0].rejected).toEqual([]);
  });
});

describe("mergeCatalogue", () => {
  const POT = ['msgid ""', 'msgstr ""', '"Language: fr\\n"', "", "#: a.html:0", 'msgid "Kept"', 'msgstr ""', "", "#: a.html:0", 'msgid "From memory"', 'msgstr ""', "", "#: a.html:0", 'msgid "New"', 'msgstr ""', ""].join("\n");
  const PO = ['msgid "Kept"', 'msgstr "Gardé"', "", 'msgid "Gone"', 'msgstr "Parti"', ""].join("\n");

  it("keeps translations, fills from memory, drops what the template no longer has", () => {
    const r = mergeCatalogue(POT, PO, new Map([["From memory", "De mémoire"], ["Kept", "ignored"]]));
    expect(r.text).toContain('msgid "Kept"\nmsgstr "Gardé"');
    expect(r.text).toContain('msgid "From memory"\nmsgstr "De mémoire"');
    expect(r.text).toContain('msgid "New"\nmsgstr ""');
    expect(r.text).not.toContain("Gone");
    expect(r).toMatchObject({ fromMemory: 1, translated: 2, total: 3 });
  });
});
