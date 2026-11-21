/**
 * Authored glossary terms reach gettext; candidates do not (bean `lqo9`, owner 2026-09-24).
 *
 * - the templates hold EXACTLY the authored terms' labels and definitions, with
 *   a floor so an empty glossary cannot pass;
 * - no candidate or could-not-extract text is a msgid;
 * - the committed `.pot` in every locale carries that same set.
 *
 * @module folio-assistant-core/scripts/glossary-pot.test
 */
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

import { GlossarySchema } from "../schemas/glossary.ts";
import { LOCALE_PAGE_STRINGS, LOCALE_PAGE_TEMPLATE, collect, type GlossarySource } from "./glossary-page.ts";
import { catalogueDir, potEntries, potForCheck, potPath, sourceText, templateName, templates } from "./glossary-pot.ts";

const c = collect();
const tpl = templates(c);

/** The msgids a `.pot` file carries (the header's empty msgid excluded). */
function msgidsIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/^msgid "((?:[^"\\]|\\.)*)"$/gm)) {
    if (m[1] !== "") out.add(m[1]!.replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  }
  return out;
}

describe("glossary .pot: authored terms only", () => {
  const authored = c.glossaries.flatMap((s) => s.glossary.terms.filter((t) => t.status === "authored").map((t) => ({ s, t })));
  const expected = new Set(
    authored.flatMap(({ t }) => [
      sourceText(t.prefLabel),
      ...(t.altLabel ?? []),
      ...(t.definition ? [sourceText(t.definition)] : []),
    ]),
  );
  // The TERM templates. The locale page's own chrome (bean c592) is a separate
  // template of ui-strings, pinned by the test after this block.
  const got = new Set(
    [...tpl.entries()].filter(([name]) => name !== LOCALE_PAGE_TEMPLATE).flatMap(([, es]) => es.map((e) => e.msgid)),
  );

  it("floorOfCoreTerms", () => {
    expect(authored.length).toBeGreaterThanOrEqual(7);
    expect(got.size).toBeGreaterThanOrEqual(14);
  });

  it("exactlyAuthoredText", () => {
    expect([...got].sort()).toEqual([...expected].sort());
  });

  it("noCandidateText", () => {
    for (const s of c.glossaries.filter((s) => s.extracted)) expect(tpl.has(templateName(s))).toBe(false);
    const candidateOnly = c.glossaries
      .flatMap((s) => s.glossary.terms.filter((t) => t.status !== "authored"))
      .flatMap((t) => [sourceText(t.prefLabel), ...(t.definition ? [sourceText(t.definition)] : [])])
      .filter((m) => !expected.has(m));
    // Vacuity: the repository has thousands of candidates to leave out.
    expect(candidateOnly.length).toBeGreaterThan(1000);
    for (const m of candidateOnly) expect(got.has(m)).toBe(false);
  });

  it("termIriIsComment", () => {
    const iris = [...tpl.values()].flat().filter((e) => e.comment?.startsWith("Glossary term label:")).map((e) => e.comment!);
    expect(iris.length).toBe(authored.length);
    expect(new Set(iris).size).toBe(iris.length);
  });

  it("everyLocaleCarriesSet", () => {
    for (const loc of ["ar", "es", "fr", "ru", "zh"]) {
      for (const [name, entries] of tpl) {
        const p = potPath(catalogueDir(name).dir, loc, name);
        expect(existsSync(p)).toBe(true);
        expect([...msgidsIn(readFileSync(p, "utf-8"))].sort()).toEqual([...new Set(entries.map((e) => e.msgid))].sort());
      }
    }
  });
});

describe("the locale page's chrome template (bean c592)", () => {
  it("localePageChromeTemplate", () => {
    const page = tpl.get(LOCALE_PAGE_TEMPLATE) ?? [];
    expect(page.map((e) => e.msgid).sort()).toEqual(Object.values(LOCALE_PAGE_STRINGS).sort());
    expect(page.every((e) => e.kind === "ui-string")).toBe(true);
  });
});

describe("potEntries on a mixed scheme", () => {
  const g = GlossarySchema.parse({
    $schema: "folio-glossary/v1",
    id: "mixed",
    title: "Mixed",
    terms: [
      { id: "a", prefLabel: { en: "alpha", fr: "alpha-fr" }, altLabel: ["first"], definition: "The first.", status: "authored" },
      { id: "b", prefLabel: "beta", definition: "Extracted beta.", status: "candidate" },
      { id: "c", prefLabel: "gamma", status: "could-not-extract", reason: "no text" },
    ],
  });
  const s: GlossarySource = { instance: "x", ns: "https://example.org/x/ns#", file: "none.glossary.json", glossary: g };
  it("mixedSchemeAuthoredOnly", () => {
    expect(potEntries(s).map((e) => e.msgid).sort()).toEqual(["The first.", "alpha", "first"]);
  });
});

describe("the check is blind to where a layer sits in the checkout (owner card Q-TRAIN-8)", () => {
  const at = (ref: string, msgid = "Trust domain") =>
    `msgid ""\nmsgstr ""\n"POT-Creation-Date: 2026-11-01T09:14:41.045Z\\n"\n\n#. Glossary term label\n#: ${ref}:83\nmsgid "${msgid}"\nmsgstr ""\n`;

  it("checkBlindToPath", () => {
    expect(potForCheck(at("glossary/gdhcn.glossary.json"))).toBe(potForCheck(at("smart-trust/glossary/gdhcn.glossary.json")));
  });

  it("changedMsgidOutOfDate", () => {
    expect(potForCheck(at("glossary/g.json", "Trust domain"))).not.toBe(potForCheck(at("glossary/g.json", "Trust network")));
  });
});
