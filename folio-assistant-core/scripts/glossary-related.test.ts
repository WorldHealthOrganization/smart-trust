/**
 * A term's `related` terms are listed under it on its layer's page, with
 * their definitions and sources: a handbook's consolidated term shows the
 * candidate definitions its working group is choosing between
 * (cat-harness-tools#1038, the page dth-hrh had drawn for itself).
 */
import { describe, expect, test } from "bun:test";

import { renderAuthoredPage, type GlossarySource } from "./glossary-page.ts";

const ns = "https://example.org/hb/v0/ns#";
const source = (id: string, terms: GlossarySource["glossary"]["terms"]): GlossarySource => ({
  instance: "hb",
  ns,
  file: `glossary/${id}.glossary.json`,
  declaredBy: "hb",
  glossary: { $schema: "folio-glossary/v1", id, title: id === "hb" ? "Handbook" : "Candidates", terms } as GlossarySource["glossary"],
});

const consolidated = source("hb", [
  {
    id: "attrition",
    prefLabel: "Attrition",
    status: "candidate",
    scopeNote: "Open for review: 1 candidate.",
    related: [`${ns}glossary/cands/attrition--src`, `${ns}glossary/cands/missing`],
  },
  { id: "registry", prefLabel: "Registry", status: "authored", definition: "A list.", related: [`${ns}glossary/cands/registry--src`] },
]);
const candidates = source("cands", [
  { id: "attrition--src", prefLabel: "Attrition", status: "candidate", definition: "Workers leaving.", scopeNote: "Cited as: WHO 2021, https://example.org/w." },
  { id: "registry--src", prefLabel: "Registry", status: "candidate", definition: "A register." },
]);
const page = renderAuthoredPage({ glossaries: [consolidated, candidates] } as never, "@hb");
const entry = (id: string) => page.slice(page.indexOf(`<dt id="hb--hb--${id}"`), page.indexOf("</dd>", page.indexOf(`<dt id="hb--hb--${id}"`)));

describe("related terms on an instance's page", () => {
  test("openTermListsCandidates", () => {
    const e = entry("attrition");
    expect(e).toContain('<details class="fa-gloss-related" open><summary>Candidate definitions (1)</summary>');
    expect(e).toContain('<a href="#hb--cands--attrition--src">Attrition</a>');
    expect(e).toContain("<p>Workers leaving.</p>");
    expect(e).toContain('<a href="https://example.org/w">example.org/w</a>');
  });
  test("deadIriLeftOut", () => {
    expect(entry("attrition")).not.toContain("missing");
  });
  test("authoredKeepsCandidatesCollapsed", () => {
    expect(entry("registry")).toContain('<details class="fa-gloss-related"><summary>Candidate definitions (1)</summary>');
  });
  test("scopeNoteShown", () => {
    expect(entry("attrition")).toContain('<p class="fa-gloss-note">Open for review: 1 candidate.</p>');
  });
});
