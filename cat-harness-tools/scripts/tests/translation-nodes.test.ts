/**
 * Translation sources are nodes (owner, 2026-11-13, node-kind audit: every
 * listed node kind has an IRI, a JSON-LD document, a row and a page, no
 * waivers). Each `.po` and `.pot` is minted
 * `translationSource/<path under the directory>` by the export
 * (`lib/translation-nodes.ts`); the translation-status viewer writes a page
 * per layer listing every string set, and one per string set.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TRANSLATION_SOURCES_KIND, TRANSLATION_SUBJECT_KIND, translationNodes } from "../lib/translation-nodes.ts";
import { SUBJECT_KINDS, subjectIri } from "../lib/subject-iri.ts";
import { byStem, sourcePages, statusPage } from "../gen-translation-status.ts";
import { CLASS_GLOSSES } from "../../schemas/content/vocabulary.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const PO = `msgid ""\nmsgstr "Content-Type: text/plain; charset=UTF-8\\n"\n\nmsgid "Hello"\nmsgstr "Hola"\n\nmsgid "Bye"\nmsgstr ""\n`;

function layer(): string {
  const root = mkdtempSync(join(tmpdir(), "tr-nodes-"));
  made.push(root);
  writeFileSync(
    join(root, "acme.json"),
    JSON.stringify({ name: "acme", version: "0.1.0", directories: [{ id: "acme-translations", path: "translations/", graphTypologies: [TRANSLATION_SOURCES_KIND] }] }),
  );
  mkdirSync(join(root, "translations", "xx", "processes"), { recursive: true });
  writeFileSync(join(root, "translations", "xx", "processes", "x.po"), PO);
  writeFileSync(join(root, "translations", "xx", "processes", "x.pot"), PO);
  writeFileSync(join(root, "translations", "xx", "index.po"), PO);
  writeFileSync(join(root, "translations", "README.md"), "not a node");
  return root;
}

describe("a translation source's IRI", () => {
  test("is a subject kind kg-export may mint, ending kept, and its class is glossed", () => {
    expect(SUBJECT_KINDS).toContain(TRANSLATION_SUBJECT_KIND);
    expect(subjectIri("https://e.org/fa/acme/acme.jsonld", TRANSLATION_SUBJECT_KIND, "xx/processes/x.pot")).toBe(
      "https://e.org/fa/acme/translationSource/xx/processes/x.pot",
    );
    expect(CLASS_GLOSSES.TranslationSource?.gloss).toBeTruthy();
  });
});

describe("the sources a layer declares", () => {
  test("every .po and .pot is a node, with its id, stem and locale; a catalogue and its template share a stem", () => {
    const nodes = translationNodes(layer());
    expect(nodes.map((n) => [n.id, n.stem, n.locale, n.template, n.sourcePath])).toEqual([
      ["xx/index.po", "xx/index", "xx", false, "translations/xx/index.po"],
      ["xx/processes/x.po", "xx/processes/x", "xx", false, "translations/xx/processes/x.po"],
      ["xx/processes/x.pot", "xx/processes/x", "xx", true, "translations/xx/processes/x.pot"],
    ]);
    expect([...byStem(nodes).keys()]).toEqual(["xx/index", "xx/processes/x"]);
  });
});

describe("each string set is a row and a page", () => {
  const nodes = translationNodes(layer());
  const iri = (n: { id: string }) => `https://e.org/fa/acme/translationSource/${n.id}`;
  const { pages } = sourcePages("acme", nodes, iri, () => PO);

  test("the layer's page lists each string set, linking its page, its IRI and its JSON-LD", () => {
    const html = pages.get("")!;
    expect(html).toContain('<a href="xx/processes/x/"><code>xx/processes/x</code></a>');
    expect(html).toContain('href="https://e.org/fa/acme/translationSource/xx/processes/x.po.jsonld"');
  });

  test("a string set's page names its catalogue's JSON-LD as the alternate, and counts its strings", () => {
    const html = pages.get("xx/processes/x")!;
    expect(html).toContain('alternate_jsonld: "https://e.org/fa/acme/translationSource/xx/processes/x.po.jsonld"');
    expect(html).toContain("1 translated · 0 fuzzy · 1 untranslated of 2");
    expect(html).toContain('<a href="../../../">every acme catalogue</a>');
  });

  test("the status page links each layer's page", () => {
    const html = statusPage({ locales: [], changedAt: "2026-11-16", scope: "acme/translations", layerPages: ["acme"] });
    expect(html).toContain('<a href="acme/">acme</a>');
  });
});
