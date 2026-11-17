import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { instanceNs } from "./glossary-page.ts";
import { archimateIriOf, validate } from "./glossary-validate.ts";

function scheme(id: string, terms: object[]) {
  return JSON.stringify({ $schema: "folio-glossary/v1", id, title: id, source: "test", terms });
}

function term(id: string, prefLabel: string, extra: object = {}) {
  return { id, prefLabel, definition: `${prefLabel}.`, status: "candidate", source: "test", ...extra };
}

/** A repo holding layer `pc`, which mounts layer `sc` at `sc/`. */
function fixture(pcTerms: object[], block?: object): string {
  const repo = mkdtempSync(join(tmpdir(), "glossary-validate-"));
  writeFileSync(join(repo, "pc.json"), JSON.stringify({ name: "pc" }));
  mkdirSync(join(repo, "glossary"));
  writeFileSync(join(repo, "glossary/pc.glossary.json"), scheme("pc", pcTerms));
  mkdirSync(join(repo, "sc/glossary"), { recursive: true });
  writeFileSync(join(repo, "sc/sc.json"), JSON.stringify({ name: "sc" }));
  writeFileSync(join(repo, "sc/glossary/sc.glossary.json"), scheme("sc", [term("traceability", "Traceability")]));
  if (block) {
    mkdirSync(join(repo, "folio/pc/ch01"), { recursive: true });
    writeFileSync(join(repo, "folio/pc/ch01/b.ts"), `export default prose({\n  meta: ${JSON.stringify(block)},\n});\n`);
  }
  return repo;
}

const sc = `${instanceNs("sc")}glossary/sc/`;

describe("glossary-validate", () => {
  test("resolvedSchemePasses", async () => {
    const repo = fixture([
      term("trade-item", "Trade Item", { broadMatch: ["https://www.gs1.org/standards/id-keys/gtin"] }),
      term("generic-product", "Generic Product", { related: ["trade-item"], closeMatch: [`${sc}traceability`] }),
    ]);
    const r = await validate(repo, "pc", { capitalized: true });
    expect(r.errors).toEqual([]);
    expect(r.notes.join("\n")).toContain("mounted instances: sc");
  });

  test("unknownMountedIriFails", async () => {
    const r = await validate(fixture([term("trade-item", "Trade Item", { exactMatch: [`${sc}missing`] })]), "pc");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain("is not a term in sc");
  });

  test("unparsedSchemeReported", async () => {
    const r = await validate(fixture([term("trade-item", "Trade Item", { related: ["no-such"] })]), "pc");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain("no-such");
  });

  test("capitalizedRefusesLowercase", async () => {
    const repo = fixture([term("trade-item", "trade item")]);
    expect((await validate(repo, "pc", { capitalized: true })).errors[0]).toContain("is not Capitalized");
    expect((await validate(repo, "pc")).errors).toEqual([]);
  });

  test("capitalizedAcceptsOwnerSpelling", async () => {
    const repo = fixture([term("ihris", "iHRIS"), term("mhealth", "mHealth")]);
    expect((await validate(repo, "pc", { capitalized: true })).errors).toEqual([]);
  });

  test("blockGlossaryLinkChecked", async () => {
    const repo = fixture([term("trade-item", "Trade Item")], {
      glossary: [{ iri: `${sc}traceability` }, { iri: `${sc}gone` }],
      archimate: { elements: [{ iri: "https://x/archimate/m/elements/e.jsonld", name: "E" }] },
    });
    const r = await validate(repo, "pc");
    expect(r.errors.length).toBe(1);
    expect(r.errors[0]).toContain(`${sc}gone`);
    expect(r.notes.join("\n")).toContain("no mounted instance holds a model: not checked");
  });
});

/** A plain-XML Archi model: elements `[id, name, props]`, one relationship. */
function archi(elements: Array<[string, string, Record<string, string>]>, rel?: [string, string, string, Record<string, string>]): string {
  const props = (p: Record<string, string>) => Object.entries(p).map(([k, v]) => `<property key="${k}" value="${v}"/>`).join("");
  const els = elements.map(([id, n, p]) => `<element xsi:type="archimate:ApplicationComponent" id="${id}" name="${n}">${props(p)}</element>`).join("");
  const r = rel ? `<element xsi:type="archimate:ServingRelationship" id="${rel[0]}" source="${rel[1]}" target="${rel[2]}">${props(rel[3])}</element>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="m" id="m"><folder name="Application" type="application">${els}</folder><folder name="Relations" type="relations">${r}</folder><folder name="Views" type="diagrams"/></archimate:model>`;
}

function withModel(root: string, id: string, xml: string) {
  mkdirSync(join(root, "archimate", id), { recursive: true });
  writeFileSync(join(root, "archimate", id, "m.archimate"), xml);
  writeFileSync(
    join(root, "archimate/cat-archimate.config.json"),
    JSON.stringify({ $schema: "cat-archimate-config/v1", directory: "archimate", models: [{ id, file: `${id}/m.archimate` }] }),
  );
}

/** The `archimate` directory a layer holding a model declares: the config is found through it. */
const ARCHIMATE_DIRS = [{ id: "archimate", path: "archimate/", graphTypologies: ["archimate"] }];

/** `pc` (iriBase pc/) overlays `sc` (iriBase sc/), whose model 1.0 holds e1 and e2 serving e1. */
function overlayFixture(pc: string, block?: object): string {
  const repo = fixture([term("trade-item", "Trade Item")], block);
  writeFileSync(join(repo, "pc.json"), JSON.stringify({ name: "pc", iriBase: "https://x/pc/", version: "0.1.0", directories: ARCHIMATE_DIRS }));
  writeFileSync(join(repo, "sc/sc.json"), JSON.stringify({ name: "sc", iriBase: "https://x/sc/", version: "1.0.0", directories: ARCHIMATE_DIRS }));
  withModel(join(repo, "sc"), "1.0", archi([["e1", "One", {}], ["e2", "Two", {}]], ["r1", "e2", "e1", {}]));
  withModel(repo, "0.1", pc);
  return repo;
}

const base = (kind: string, id: string) => ({ "overlay:base": `https://x/sc/archimate/1.0/${kind}/${id}.jsonld` });
const mine = { "overlay:owner": "pc" };

describe("glossary-validate: the overlay rule and links into the instance's own model", () => {
  test("overlayPasses", async () => {
    const pc = archi([["e1", "One", base("elements", "e1")], ["p1", "Mine", mine], ["d1", "Borrowed", { "overlay:dth": "https://x/phc/archimate/0.1/elements/d1.jsonld" }]], ["pr1", "p1", "e1", mine]);
    const repo = overlayFixture(pc, {
      archimate: { elements: [{ iri: "https://x/pc/archimate/0.1/elements/p1.jsonld", name: "Mine" }, { iri: "https://x/sc/archimate/1.0/elements/e2.jsonld", name: "Two" }] },
    });
    const r = await validate(repo, "pc");
    expect(r.errors).toEqual([]);
    expect(r.notes.join("\n")).toContain("pc archimate 0.1 overlay on 1.0: 2 owned, 1 reference copies checked");
    expect(r.notes.join("\n")).toContain("1 item(s) of the pc overlay are overlay:dth copies");
    expect(r.notes.join("\n")).not.toContain("not checked\n· pc");
  });

  test("badOverlayItemsFail", async () => {
    const pc = archi([["e1", "One", mine], ["x9", "Gone", base("elements", "x9")], ["p1", "Bare", {}]], ["pr1", "p1", "e1", { "overlay:owner": "hr" }]);
    const r = await validate(overlayFixture(pc), "pc");
    const all = r.errors.join("\n");
    expect(all).toContain("its base model 1.0 already holds it; tag it overlay:base");
    expect(all).toContain("overlay:base names an item mounted model 1.0 does not hold");
    expect(all).toContain("has neither overlay:base nor overlay:owner=pc");
    expect(all).toContain("overlay:owner is hr, not pc");
  });

  test("slashIrisPassLikeTheOlderForm", async () => {
    // The slash IRI the site writes now, …/element/<id>, alongside the older …/elements/<id>.jsonld (Q-RAL-2 C).
    const slash = (kind: string, id: string) => ({ "overlay:base": `https://x/sc/archimate/1.0/${kind}/${id}` });
    const pc = archi([["e1", "One", slash("element", "e1")], ["e2", "Two", base("elements", "e2")], ["p1", "Mine", mine]], ["r1", "e2", "e1", slash("relationship", "r1")]);
    const repo = overlayFixture(pc, {
      archimate: { elements: [{ iri: "https://x/pc/archimate/0.1/element/p1", name: "Mine" }, { iri: "https://x/sc/archimate/1.0/element/e2", name: "Two" }] },
    });
    const r = await validate(repo, "pc");
    expect(r.errors).toEqual([]);
    expect(r.notes.join("\n")).toContain("pc archimate 0.1 overlay on 1.0: 1 owned, 3 reference copies checked");
    expect(archimateIriOf("https://x/sc/archimate/0.1.0-draft.1/view/v1")).toMatchObject({ model: "0.1.0-draft.1", kind: "views", id: "v1" });
    expect(archimateIriOf("https://x/sc/archimate/1.0/element/e1.jsonld")).toBeUndefined();
  });

  test("linkToMissingOwnItemFails", async () => {
    const pc = archi([["p1", "Mine", mine]]);
    const r = await validate(overlayFixture(pc, { archimate: { elements: [{ iri: "https://x/pc/archimate/0.1/elements/nope.jsonld", name: "No" }] } }), "pc");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain("is not in pc's ArchiMate model 0.1");
  });
});

describe("metaOf reads a block's meta", () => {
  test("metaOfReadsMeta", async () => {
    const { metaOf } = await import("./glossary-validate");
    expect(metaOf('x({\n  meta: {"a": 1, "b": "}"},\n})')).toEqual({ a: 1, b: "}" });
    expect(metaOf('x({\n  meta: {\n    "glossaryTerms": [\n      "t"\n    ]\n  },\n})')).toEqual({ glossaryTerms: ["t"] });
    expect(metaOf("x({ label: 1 })")).toBeUndefined();
    expect(metaOf("x({ meta: { documentKind: 1 } })")).toBeUndefined();
  });
});
