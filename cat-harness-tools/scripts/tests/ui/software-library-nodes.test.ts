/**
 * Software libraries are nodes with a row (owner, 2026-11-13, node-kind audit:
 * every listed node kind has an IRI, a JSON-LD document, a row and a page, no
 * waivers). Each `<id>.library.json` is minted `softwareLibrary/<id>` by the
 * export (`lib/software-library-nodes.ts`), and the layer's software-libraries
 * page lists it, linking its node-kind page, its IRI and its `.jsonld`.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SOFTWARE_LIBRARY_KIND, SOFTWARE_LIBRARY_SUBJECT_KIND, describeLibrary, softwareLibraryNodes } from "../../lib/software-library-nodes.ts";
import { SUBJECT_KINDS, subjectIri } from "../../lib/subject-iri.ts";
import { LISTED_KINDS, registryRowsOf, registryTable, withSubjectIris } from "../../state-visualizer.ts";
import { CLASS_GLOSSES } from "../../../schemas/content/vocabulary.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const LIB = { $schema: "software-library/1.0.0", name: "@acme/widget", version: "1.5.15", dev: true, licence: "MIT" };

function layer(): string {
  const root = mkdtempSync(join(tmpdir(), "swlib-"));
  made.push(root);
  writeFileSync(
    join(root, "acme.json"),
    JSON.stringify({ name: "acme", version: "0.1.0", directories: [{ id: "acme-libraries", path: "libraries/", graphTypologies: [SOFTWARE_LIBRARY_KIND] }] }),
  );
  mkdirSync(join(root, "libraries"), { recursive: true });
  writeFileSync(join(root, "libraries", "acme__widget.library.json"), JSON.stringify(LIB));
  writeFileSync(join(root, "libraries", "README.md"), "not a node");
  return root;
}

describe("a software library's IRI", () => {
  test("is a subject kind kg-export may mint, and its class is glossed", () => {
    expect(SUBJECT_KINDS).toContain(SOFTWARE_LIBRARY_SUBJECT_KIND);
    expect(subjectIri("https://e.org/fa/acme/acme.jsonld", SOFTWARE_LIBRARY_SUBJECT_KIND, "acme__widget")).toBe(
      "https://e.org/fa/acme/softwareLibrary/acme__widget",
    );
    expect(CLASS_GLOSSES.SoftwareLibrary?.gloss).toBeTruthy();
  });
});

describe("the libraries a layer declares", () => {
  test("one node per `.library.json`, its id the file's name, its title `name@version`", () => {
    const nodes = softwareLibraryNodes(layer());
    expect(nodes.map((n) => [n.id, n.sourcePath, n.title])).toEqual([["acme__widget", "libraries/acme__widget.library.json", "@acme/widget@1.5.15"]]);
    expect(nodes[0]!.description).toContain("a dev dependency");
  });
  test("a file that does not parse is still a node, and says so", () => {
    expect(describeLibrary(undefined, "x").description).toContain("does not parse");
  });
});

describe("the software-libraries page lists each library", () => {
  test("software-library is a listed kind", () => {
    expect(LISTED_KINDS).toContain(SOFTWARE_LIBRARY_KIND);
  });

  test("each library is a row: its id, name@version, its node-kind page, its IRI and its .jsonld", () => {
    const dir = join(layer(), "libraries");
    const rows = registryRowsOf(dir);
    expect(rows.map((r) => [r.id, r.text])).toEqual([["acme__widget", "@acme/widget@1.5.15"]]);
    const linked = withSubjectIris(rows, dir, [SOFTWARE_LIBRARY_KIND], (_f, kind, id) => `https://e.org/fa/acme/${kind}/${id}`, {
      instance: "acme",
      layerPath: "libraries",
    });
    expect(linked[0]!.iri).toBe("https://e.org/fa/acme/softwareLibrary/acme__widget");
    expect(linked[0]!.page).toBe("../../software-library/acme/libraries/acme__widget.library/");
    const html = registryTable(linked);
    expect(html).toContain('<a href="../../software-library/acme/libraries/acme__widget.library/"><code>acme__widget</code></a>');
    expect(html).toContain('href="https://e.org/fa/acme/softwareLibrary/acme__widget.jsonld"');
  });
});
