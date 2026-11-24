/**
 * Links from one document of a folio to another (issue #841): over a folio of
 * two hand-made documents, `guide` and `toolkit`, where the toolkit points
 * into the guide.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  crossCitation,
  crossDocumentIndex,
  exportCrossDocumentRefs,
  folioDocuments,
  siblingPage,
  siteCrossDocumentLinks,
  siteCrossDocumentRefs,
  splitCrossRef,
  type CrossDocumentIndex,
} from "./cross-document-refs.ts";

let root: string;
let index: CrossDocumentIndex;

const put = (path: string, value: unknown) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `export default ${JSON.stringify(value)};\n`);
};

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "cross-doc-"));
  const folio = join(root, "folio");
  // guide: two chapters; the second has a section with a subsection.
  put(join(folio, "guide", "guide.ts"), { title: "Cybersecurity Guidance", chapters: [{ dir: "intro" }, { dir: "controls" }] });
  put(join(folio, "guide", "intro", "intro.ts"), { title: "Introduction", label: "chap:intro", sections: [{ title: "Scope", label: "sec:scope", blocks: ["scope-1"] }] });
  put(join(folio, "guide", "intro", "scope-1.ts"), { label: "scope-para" });
  put(join(folio, "guide", "controls", "controls.ts"), {
    title: "Controls",
    label: "chap:controls",
    sections: [
      { title: "Access", label: "sec:access", blocks: [] },
      { title: "Backups", label: "sec:backups", blocks: ["rec-1"], subsections: [{ title: "Offsite", label: "sec:offsite", blocks: [] }] },
    ],
  });
  put(join(folio, "guide", "controls", "rec-1.ts"), { label: "rec:backup" });
  put(join(folio, "toolkit", "toolkit.ts"), { title: "Stepwise Toolkit", chapters: [{ dir: "steps" }] });
  put(join(folio, "toolkit", "steps", "steps.ts"), { title: "Steps", label: "chap:steps", sections: [{ title: "Step 1", label: "sec:step1", blocks: [] }] });
  mkdirSync(join(folio, "not-a-document")); // no manifest: not a document
  index = await crossDocumentIndex(folioDocuments(folio));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("the folio's documents", () => {
  test("every folio/<slug>/<slug>.ts, nothing else", () => {
    expect(folioDocuments(join(root, "folio")).map((d) => d.slug)).toEqual(["guide", "toolkit"]);
    expect(folioDocuments(join(root, "missing"))).toEqual([]);
  });

  test("places are counted in manifest order", () => {
    const g = index.get("guide")!;
    expect(g.title).toBe("Cybersecurity Guidance");
    expect(g.places.get("chap:intro")).toBe("Chapter 1");
    expect(g.places.get("sec:scope")).toBe("Section 1.1");
    expect(g.places.get("scope-para")).toBe("Section 1.1");
    expect(g.places.get("sec:access")).toBe("Section 2.1");
    expect(g.places.get("sec:backups")).toBe("Section 2.2");
    expect(g.places.get("rec:backup")).toBe("Section 2.2");
    expect(g.places.get("sec:offsite")).toBe("Section 2.2.1");
  });
});

describe("splitting a ref", () => {
  test("only a sibling slug makes a ref cross-document", () => {
    expect(splitCrossRef("guide:sec:access", index)).toEqual({ slug: "guide", label: "sec:access" });
    expect(splitCrossRef("sec:access", index)).toBeUndefined();
    expect(splitCrossRef("guide:", index)).toBeUndefined();
    expect(splitCrossRef(":x", index)).toBeUndefined();
  });

  test("the citation names the title and the place, or the label as written", () => {
    expect(crossCitation(index, "guide", "sec:backups")).toBe("Cybersecurity Guidance, Section 2.2");
    expect(crossCitation(index, "guide", "sec:nowhere")).toBe("Cybersecurity Guidance, sec:nowhere");
  });
});

describe("the site", () => {
  test("a sibling's page is beside this one", () => {
    expect(siblingPage("toolkit", "guide")).toBe("../guide/index.html");
  });

  test("\\ref{guide:…} links the guide's page, reading as its citation", () => {
    const md = "See \\ref{guide:sec:access} and \\eqref{eq:1} and \\ref{sec:step1}.";
    expect(siteCrossDocumentRefs(md, "toolkit", index)).toBe(
      'See <a href="../guide/index.html#sec:access" class="cross-document">Cybersecurity Guidance, Section 2.1</a> and \\eqref{eq:1} and \\ref{sec:step1}.',
    );
  });

  test("a ref to the page's own slug is a same-page anchor", () => {
    expect(siteCrossDocumentRefs("\\ref{toolkit:sec:step1}", "toolkit", index)).toBe('<a href="#sec:step1" class="cross-document">sec:step1</a>');
  });

  test("fenced code is left as written", () => {
    const md = "```\n\\ref{guide:sec:access}\n```";
    expect(siteCrossDocumentRefs(md, "toolkit", index)).toBe(md);
  });

  test("rendered #guide:… anchors go to the guide's page; others are unchanged", () => {
    const html = '<a href="#guide:sec:access">a</a> <a href="#guide%3Asec%3Abackups">b</a> <a href="#sec:step1">c</a> <a href="#toolkit:sec:step1">d</a> <a href="#fn-1">e</a>';
    expect(siteCrossDocumentLinks(html, "toolkit", index)).toBe(
      '<a href="../guide/index.html#sec:access">a</a> <a href="../guide/index.html#sec:backups">b</a> <a href="#sec:step1">c</a> <a href="#sec:step1">d</a> <a href="#fn-1">e</a>',
    );
  });

  test("a folio of one document is untouched", () => {
    const one: CrossDocumentIndex = new Map([["guide", { title: "G", places: new Map() }]]);
    expect(siteCrossDocumentLinks('<a href="#guide:x">x</a>', "guide", one)).toBe('<a href="#guide:x">x</a>');
    expect(siteCrossDocumentRefs("\\ref{guide:x}", "guide", one)).toBe("\\ref{guide:x}");
  });
});

describe("Word and PDF", () => {
  test("a cross-document ref is a readable citation", () => {
    const md = "Apply \\ref{guide:sec:backups}; see [the access controls](#guide:sec:access) and [](#guide:rec:backup).";
    expect(exportCrossDocumentRefs(md, "toolkit", index)).toBe(
      "Apply Cybersecurity Guidance, Section 2.2; see the access controls (Cybersecurity Guidance, Section 2.1) and Cybersecurity Guidance, Section 2.2.",
    );
  });

  test("same-document refs keep their anchor, without the slug", () => {
    expect(exportCrossDocumentRefs("\\ref{toolkit:sec:step1} [s](#toolkit:sec:step1) [t](#sec:step1)", "toolkit", index)).toBe("\\ref{sec:step1} [s](#sec:step1) [t](#sec:step1)");
  });

  test("an image is not a link", () => {
    const md = "![alt](#guide:sec:access)";
    expect(exportCrossDocumentRefs(md, "toolkit", index)).toBe(md);
  });
});
