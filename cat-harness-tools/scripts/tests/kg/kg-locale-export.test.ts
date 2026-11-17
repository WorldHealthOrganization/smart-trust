/**
 * A translated graph is the SAME graph, and the core never learns it exists.
 *
 * @module scripts/tests/kg-locale-export.test
 *
 * Bean `jmpb`. Measured 2026-09-22: **58 of this layer's 62 `.pot`
 * templates are BPMN diagrams and none has a `.po` in any of the five
 * locales**, so the real corpus produces ZERO substitutions. A suite that only
 * ran against it would assert nothing at all — `6tkl` — so the machinery is
 * proven on fixtures carrying real translations, and the corpus is used for
 * the two properties it CAN still answer: that the core references no
 * translation, and that every locale is reported rather than silently
 * skipped.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { localeDirIn, translationsHomeFor } from "../../../schemas/kg/cat-harness.ts";
import { undeclaredRootTerms } from "../../kg-export.ts";
import {
  buildLocaleExports,
  catalogueFor,
  isIri,
  knownLocales,
  localeDocPath,
  localeDocumentsUnreferenced,
  projectedStems,
  translateDocument,
} from "../../kg-locale-export.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));
const HARNESS = join(REPO, "cat-harness");

/** A miniature core document — the shapes the real one carries, in five nodes. */
const CORE = {
  "@context": { name: "rdfs:label", skos: "http://www.w3.org/2004/02/skos/core#" },
  "@id": "https://x.test/cat-harness.jsonld",
  "@graph": [
    { "@id": "https://x.test/cat-harness.jsonld#process/P1", "@type": "cat:Process", name: "Review a change" },
    {
      "@id": "https://x.test/cat-harness.jsonld#process/P1/node/T1",
      "@type": "cat:ProcessNode",
      name: "Read the diff",
      nodeKind: "task",
      performedBy: "https://x.test/cat-harness.jsonld#role/Reviewer",
    },
    { "@id": "https://x.test/cat-harness.jsonld#role/Reviewer", "@type": "cat:Role", name: "Reviewer", notation: "Reviewer" },
    { "@id": "https://x.test/cat-harness.jsonld#process/P1/flow/F1", "@type": "cat:SequenceFlow", name: "yes" },
    { "@id": "https://x.test/cat-harness.jsonld#skill/x", "@type": "cat:Skill", name: "Untranslated title" },
  ],
} as const;

const FR = new Map<string, string>([
  ["Review a change", "Réviser une modification"],
  ["Read the diff", "Lire le diff"],
  ["Reviewer", "Relecteur"],
  ["yes", "oui"],
]);

type Node = Record<string, unknown>;
const graphOf = (d: Record<string, unknown>): Node[] => d["@graph"] as Node[];
const nodeById = (d: Record<string, unknown>, id: string): Node =>
  graphOf(d).find((n) => n["@id"] === id)!;

describe("translateDocument — the same graph, in another language", () => {
  const { doc, report } = translateDocument(CORE as unknown as Record<string, unknown>, "fr", FR, "en");

  test("it substituted something — the suite is not vacuous", () => {
    expect(report.substitutions).toBeGreaterThan(0);
    expect(report.applicable).toBe(4);
  });

  test("a translated value carries its OWN language tag", () => {
    const p = nodeById(doc, "https://x.test/cat-harness.jsonld#process/P1");
    expect(p.name).toEqual({ "@value": "Réviser une modification", "@language": "fr" });
  });

  test("an untranslated string falls through, PLAIN and untagged", () => {
    // `parsePo` takes only non-empty msgstr and skips fuzzy, deliberately. A
    // second answer here would mean a string that survives in the rendered
    // diagram and vanishes in the graph describing the same diagram.
    const s = nodeById(doc, "https://x.test/cat-harness.jsonld#skill/x");
    expect(s.name).toBe("Untranslated title");
  });

  test("the document declares the SOURCE language, never this locale", () => {
    // A blanket `"@language": "fr"` would assert French over every
    // fall-through — and fall-through is the normal case here.
    expect(doc.sourceLanguage).toBe("en");
    expect((doc["@context"] as Record<string, unknown>)["@language"]).toBeUndefined();
    expect(doc["@language"]).toBeUndefined();
  });

  test("every @id is the core's — a translation is not a new term", () => {
    const before = graphOf(CORE as unknown as Record<string, unknown>).map((n) => n["@id"]);
    const after = graphOf(doc).map((n) => n["@id"]);
    expect(after).toEqual(before);
    expect(after.length).toBeGreaterThan(0);
  });

  test("identity-bearing keys are never rewritten, even on a msgid hit", () => {
    // `Reviewer` is in the catalogue AND is this node's `notation` — the code
    // it is cited by. Translating it would break every citation.
    const r = nodeById(doc, "https://x.test/cat-harness.jsonld#role/Reviewer");
    expect(r.notation).toBe("Reviewer");
    expect(r.name).toEqual({ "@value": "Relecteur", "@language": "fr" });
    expect(r["@type"]).toBe("cat:Role");
  });

  test("links are left alone, and the @context is not repointed", () => {
    const t = nodeById(doc, "https://x.test/cat-harness.jsonld#process/P1/node/T1");
    expect(t.performedBy).toBe("https://x.test/cat-harness.jsonld#role/Reviewer");
    expect(doc["@context"]).toEqual(CORE["@context"]);
  });

  test("a link is NOT rewritten even when the catalogue carries it as a msgid", () => {
    // A real risk rather than a hypothetical: a docs page's `.po` routinely
    // carries URLs and prefixed names as msgids, because they appear in the
    // prose. Rewriting one turns a resolvable link into a dangling string,
    // and `kg-export`'s dead-link walk would then fail on a graph nothing
    // authored wrongly.
    const withIris = new Map(FR);
    withIris.set("https://x.test/cat-harness.jsonld#role/Reviewer", "https://x.test/fr/role/Relecteur");
    withIris.set("cat:Role", "cat:Relecteur");
    const { doc } = translateDocument(CORE as unknown as Record<string, unknown>, "fr", withIris, "en");
    const t = nodeById(doc, "https://x.test/cat-harness.jsonld#process/P1/node/T1");
    expect(t.performedBy).toBe("https://x.test/cat-harness.jsonld#role/Reviewer");
    expect(nodeById(doc, "https://x.test/cat-harness.jsonld#role/Reviewer")["@type"]).toBe("cat:Role");
  });

  test("the core document itself is not mutated", () => {
    // The walk builds a new object. If it edited in place, every later locale
    // would translate an already-translated core.
    expect(nodeById(CORE as unknown as Record<string, unknown>, "https://x.test/cat-harness.jsonld#process/P1").name).toBe(
      "Review a change",
    );
  });
});

describe("isIri — prose is not a link", () => {
  test("both IRI forms are recognised", () => {
    expect(isIri("https://x.test/a#b")).toBe(true);
    expect(isIri("skos:Concept")).toBe(true);
  });
  test("a sentence with a colon is NOT", () => {
    // The failure this guard exists for: prose left untranslated because a
    // colon made it look like a link.
    expect(isIri("Note: this happens")).toBe(false);
    expect(isIri("Review a change")).toBe(false);
  });
});

describe("a catalogue is scoped to the asset it was extracted from", () => {
  /** A throwaway layer: one diagram, and two catalogues in one locale. */
  function fixture(): string {
    const dir = mkdtempSync(join(tmpdir(), "kgloc-"));
    mkdirSync(join(dir, "workflows"), { recursive: true });
    writeFileSync(join(dir, "workflows", "demo.bpmn"), "<bpmn:definitions/>");
    mkdirSync(join(dir, "translations", "fr", "workflows"), { recursive: true });
    writeFileSync(
      join(dir, "translations", "fr", "workflows", "demo.po"),
      'msgid ""\nmsgstr ""\n\nmsgid "Review a change"\nmsgstr "Réviser une modification"\n',
    );
    // A DOCS PAGE catalogue, which must not reach the graph.
    writeFileSync(join(dir, "translations", "fr", "index.po"), 'msgid ""\nmsgstr ""\n\nmsgid "yes"\nmsgstr "oui"\n');
    return dir;
  }

  test("the diagram's catalogue is read; the docs page's is not", () => {
    // THE REGRESSION. The first version merged every `.po` under a locale and
    // reported "1 applicable msgid, 40 substitutions" against the real corpus
    // — the msgid was `"yes"` from `index.po`, matching 40 BPMN gateway branch
    // labels. `oui` is right French for that label, which is precisely why it
    // had to be caught by provenance rather than by reading the output.
    const dir = fixture();
    try {
      expect(projectedStems(dir)).toEqual(new Set(["demo"]));
      const cat = catalogueFor(dir, "fr");
      expect(cat.get("Review a change")).toBe("Réviser une modification");
      expect(cat.has("yes")).toBe(false);
      expect(cat.size).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an empty `msgstr` is not a translation", () => {
    const dir = mkdtempSync(join(tmpdir(), "kgloc-empty-"));
    try {
      mkdirSync(join(dir, "workflows"), { recursive: true });
      writeFileSync(join(dir, "workflows", "demo.bpmn"), "<bpmn:definitions/>");
      mkdirSync(join(dir, "translations", "fr", "workflows"), { recursive: true });
      writeFileSync(
        join(dir, "translations", "fr", "workflows", "demo.po"),
        'msgid ""\nmsgstr ""\n\nmsgid "Review a change"\nmsgstr ""\n',
      );
      expect(catalogueFor(dir, "fr").size).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("localeDocumentsUnreferenced — the owner's constraint, checked", () => {
  const LOCALES = ["ar", "es", "fr", "ru", "zh"];

  test("a clean core has no findings", () => {
    expect(localeDocumentsUnreferenced(CORE as unknown as Record<string, unknown>, LOCALES)).toEqual([]);
  });

  test("a translation property on a node is caught", () => {
    const bad = { "@graph": [{ "@id": "x", hasTranslation: ["y"] }] };
    expect(localeDocumentsUnreferenced(bad, LOCALES).length).toBe(1);
  });

  test("an availableLocales array is caught", () => {
    const bad = { "@graph": [{ "@id": "x", availableLocales: ["fr"] }] };
    expect(localeDocumentsUnreferenced(bad, LOCALES).length).toBe(1);
  });

  test("a locale key anywhere is caught, including in the @context", () => {
    const bad = { "@context": { fr: "https://x.test/fr" }, "@graph": [] };
    expect(localeDocumentsUnreferenced(bad, LOCALES).length).toBe(1);
  });

  test("a per-locale @id is caught", () => {
    const bad = { "@graph": [{ "@id": "https://x.test/cat-harness.fr.jsonld#role/r" }] };
    expect(localeDocumentsUnreferenced(bad, LOCALES).length).toBeGreaterThan(0);
  });
});

describe("the real corpus — what it can still answer with zero translations", () => {
  test("there are locales to report on", () => {
    // `6tkl`: a per-locale build over no locales asserts nothing.
    expect(knownLocales(HARNESS).length).toBeGreaterThan(0);
  });

  test("the core graph references no translation, and that is CHECKED", async () => {
    const b = await buildLocaleExports({});
    expect(b.coreProblems).toEqual([]);
    expect(b.idDrift).toEqual([]);
  }, 120_000);

  test("every locale is reported, emitted or not", async () => {
    // The third-state rule: a locale with nothing to say is REPORTED, never a
    // missing file a reader cannot tell from a broken build.
    const b = await buildLocaleExports({});
    expect(b.locales.map((l) => l.locale)).toEqual(knownLocales(HARNESS));
    for (const l of b.locales) expect(typeof l.catalogue).toBe("number");
  }, 120_000);

  test("--all-locales emits one document per locale, @ids unchanged", async () => {
    const b = await buildLocaleExports({ allLocales: true });
    expect(b.docs.size).toBe(knownLocales(HARNESS).length);
    expect(b.idDrift).toEqual([]);
  }, 180_000);

  // ---- `lvw0` -----------------------------------------------------------
  //
  // These documents are PUBLISHED, and `publish:verify` on the built site was
  // the first thing that noticed they were not publishable. Everything below
  // asks the question here instead, where it costs a test run rather than a
  // skipped deploy.

  test("no locale document carries a root field its own @context omits", async () => {
    const b = await buildLocaleExports({ allLocales: true });
    // The finding list AND the documents, because the list is produced by the
    // same walk it would have to be wrong about — a guard asserting only its
    // own output cannot fail the way this one did.
    expect(b.rootUndeclared).toEqual([]);
    for (const [locale, doc] of b.docs) {
      const ctx = (doc["@context"] ?? {}) as Record<string, unknown>;
      const declared = new Set(Object.keys(ctx).filter((k) => !k.startsWith("@")));
      const undeclared = Object.keys(doc).filter((k) => !k.startsWith("@") && !declared.has(k));
      expect(undeclared, `${locale} carries undeclared root field(s)`).toEqual([]);
    }
  }, 180_000);

  test("a locale document carries the QA findings the core strips — none of them", async () => {
    // The 16 of `lvw0`'s 20. Named individually rather than counted, because
    // `publishedDocument`'s job is these four fields and a count would pass
    // while three of them came back.
    const b = await buildLocaleExports({ allLocales: true });
    expect(b.docs.size).toBeGreaterThan(0);
    for (const [locale, doc] of b.docs) {
      for (const f of ["undeclaredTerms", "undeclaredSchemaModules", "danglingLinks", "problems"]) {
        expect(Object.keys(doc), `${locale} re-publishes ${f}`).not.toContain(f);
      }
    }
  }, 180_000);

  test("sourceLanguage IS carried, and IS declared", async () => {
    // The other 4. Stripping it would also pass the test above, and would be
    // wrong: the document has to say what language its untagged strings are
    // in, which is the source language and not this locale.
    const b = await buildLocaleExports({ allLocales: true });
    for (const [locale, doc] of b.docs) {
      expect(doc.sourceLanguage, `${locale} says nothing about its source language`).toBe(b.sourceLanguage);
      const ctx = (doc["@context"] ?? {}) as Record<string, unknown>;
      expect(Object.keys(ctx), `${locale}'s @context omits sourceLanguage`).toContain("sourceLanguage");
    }
  }, 180_000);

  test("the guard can actually fail — a planted root field is reported", () => {
    const ctx = { name: "x" } as Record<string, unknown>;
    const doc = { "@context": ctx, "@id": "urn:x", name: "n", plantedRootField: 1 } as Record<string, unknown>;
    expect(undeclaredRootTerms(doc, ctx)).toEqual(["plantedRootField"]);
    expect(undeclaredRootTerms({ "@context": ctx, "@id": "urn:x", name: "n" }, ctx)).toEqual([]);
  });

  test("`buildLocaleExports` actually asks it — the CALL, not just the function", () => {
    // Measured, not assumed. Deleting the guard's loop from
    // `buildLocaleExports` left all three corpus tests above GREEN, because
    // with the two fixes in place the documents really are clean and a
    // `rootUndeclared` of `[]` is then indistinguishable from a guard that
    // reports nothing. A guard whose removal no test notices is `1xhc`.
    //
    // WHAT THIS PROVES, exactly: that the call site still exists. It does not
    // prove the call is reached, nor that its findings reach the exit code —
    // the first needs a locale document with a planted root field, which this
    // layer's content cannot produce, and the second is asserted by reading
    // the CLI, where `bad > 0` exits before `mkdirSync`. Stated rather than
    // implied, because a structural test that is read as an end-to-end one is
    // worse than none.
    const src = readFileSync(join(TOOLS_ROOT, "scripts", "kg-locale-export.ts"), "utf-8");
    const fn = src.slice(src.indexOf("export async function buildLocaleExports"));
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).toContain("undeclaredRootTerms(");
    expect(fn).toContain("rootUndeclared.push(");
  });
});

describe("localeDocPath", () => {
  test("it sits beside the core document, suffixed by locale", () => {
    expect(localeDocPath("cat-harness", "fr")).toBe("cat-harness.fr.jsonld");
  });
});

describe("hosted translations — an instance's templates may live in its HOST's corpus", () => {
  /**
   * `bootstrap` declares no `translation-sources`. Its 15 `.pot` templates sit
   * in cat-harness's corpus under `<locale>/bootstrap/processes/`, because a
   * `.pot` is tooling output and bootstrap is a floor an agent reads.
   *
   * Three things are asserted separately because they fail separately, and the
   * middle one is the whole point: a hosted layer's locale set is its HOST's,
   * not an empty set and not the host's set unfiltered.
   */
  test("cat-harness owns its corpus — scope is empty", () => {
    const home = translationsHomeFor(HARNESS, HARNESS);
    expect(home.by).toBe("own");
    expect(home.scope).toEqual([]);
  });

  test("bootstrap is HOSTED by cat-harness, scoped by its stub", () => {
    const home = translationsHomeFor(join(REPO, "bootstrap"), HARNESS);
    expect(home.by).toBe("hosted");
    expect(home.scope).toEqual(["bootstrap"]);
    expect(home.root).toBe(join(HARNESS, "translations"));
  });

  test("with no host offered, bootstrap falls back to the convention and SAYS so", () => {
    const home = translationsHomeFor(join(REPO, "bootstrap"));
    expect(home.by).toBe("convention");
    expect(home.scope).toEqual([]);
  });

  test("a hosted instance's locales are its host's, and it finds them", () => {
    // The regression this whole change exists to stop: after the templates
    // moved, this returned [] and `6tkl`'s refusal took three CI jobs red.
    expect(knownLocales(join(REPO, "bootstrap")).length).toBeGreaterThan(0);
  });

  test("localeDirIn inserts the scope for a hosted instance and not for an owner", () => {
    const hosted = translationsHomeFor(join(REPO, "bootstrap"), HARNESS);
    const own = translationsHomeFor(HARNESS, HARNESS);
    expect(localeDirIn(hosted, "fr")).toBe(join(HARNESS, "translations", "fr", "bootstrap"));
    expect(localeDirIn(own, "fr")).toBe(join(HARNESS, "translations", "fr"));
  });

  /**
   * The anti-vacuity pair. Each test above passes for a resolver that answered
   * one constant shape; this asserts the two real layers DISAGREE on both
   * fields, which no constant satisfies.
   */
  test("the two real instances disagree on `by` AND on `scope`", () => {
    const hosted = translationsHomeFor(join(REPO, "bootstrap"), HARNESS);
    const own = translationsHomeFor(HARNESS, HARNESS);
    expect(hosted.by).not.toBe(own.by);
    expect(hosted.scope).not.toEqual(own.scope);
  });

  test("a directory that declares nothing and is hosted by nobody is the convention", () => {
    const dir = mkdtempSync(join(tmpdir(), "no-decl-"));
    try {
      const home = translationsHomeFor(dir, HARNESS);
      expect(home.by).toBe("convention");
      expect(home.root).toBe(join(dir, "translations"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
