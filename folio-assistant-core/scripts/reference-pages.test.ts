import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BIBLIOGRAPHY, ReferencePages } from "./reference-pages.ts";

/** Owner, 2026-11-15 (option A): references are shown by the Bibliography, not a generic page each. */
describe("the folio-reference kind's pages", () => {
  test("link to this layer's Bibliography at its declared route", () => {
    expect(ReferencePages.nodesShownBy.route("en")).toBe("en/folio-assistant-core/bibliography");
    expect(ReferencePages.nodesShownBy.label).toBe("Bibliography");
  });

  test("name a visualiser this layer declares", () => {
    const decl = JSON.parse(readFileSync(join(import.meta.dir, "..", "folio-assistant-core.json"), "utf8")) as { name: string; visualisers: { id: string }[] };
    expect(decl.name).toBe(BIBLIOGRAPHY.harness);
    expect(decl.visualisers.map((v) => v.id)).toContain(BIBLIOGRAPHY.visualiser);
  });

  test("the reference validator names this renderer", () => {
    const v = JSON.parse(readFileSync(join(import.meta.dir, "..", "validators", "reference.json"), "utf8")) as { pages?: string };
    expect(v.pages).toBe("folio-assistant-core:scripts/reference-pages.ts#ReferencePages");
  });
});

describe("on a node-kind writer that predates nodesShownBy", () => {
  test("it is still a renderer, and adds no section", () => {
    expect(typeof ReferencePages.dashboard).toBe("function");
    expect(ReferencePages.dashboard!([], { locale: "en", nodesOf: () => [], linkTo: () => undefined })).toEqual([]);
  });
});
