/**
 * The Indexing evidence page works for its reader (cat-harness#1144): every
 * indexing method has its section with its held evidence and the skills that
 * apply it, each skill row carries its Tools and processes, an indexing skill
 * with no method is listed as having no evidence yet, and every table row has
 * the columns its header promises.
 *
 * Drawn over a FIXTURE model, so nothing here depends on what the checkout
 * holds. The test over the whole checkout is in
 * `test/coordinator/gen-lsi-viz-checkout.test.ts` (bean `7zz1`).
 */
import { describe, expect, test } from "bun:test";
import { evidencePage, type EvidenceModel } from "../gen-lsi-viz.ts";

const MODEL: EvidenceModel = {
  methods: [
    {
      name: "lsi",
      title: "Latent Semantic Indexing",
      appliesWhen: "Finding units that discuss the same thing in different words.",
      instance: "cat-harness",
      evidence: ["library/deerwester-1990-indexing-by-lsa", "library/landauer-foltz-laham-1998-intro-lsa"],
      state: "ingested",
      skills: [
        { name: "lsi-indexing", instance: "cat-harness", description: "Build and query an index | with a pipe.", methods: ["lsi"], tools: ["lsi-index", "lsi-query"], processes: ["document-ingestion"] },
      ],
    },
    { name: "correspondence-analysis", title: "Correspondence analysis", appliesWhen: "Margins dominate.", instance: "cat-harness", evidence: [], state: "cited-only", skills: [] },
  ],
  unbacked: [{ name: "glossary-terms", instance: "fixture-core", description: "Add glossary terms.", methods: [], tools: ["glossary-from-source"], processes: [] }],
};

const page = evidencePage(MODEL);

describe("the Indexing evidence page", () => {
  test("is titled for what it is, not for the method", () => {
    expect(page).toContain('title: "Indexing evidence"');
    expect(page).toContain("rendered-by: lsi-viewer");
  });

  test("has a section per method, with its evidence and the skills that apply it", () => {
    expect(page).toContain("### Latent Semantic Indexing {#lsi}");
    expect(page).toContain("`library/deerwester-1990-indexing-by-lsa`");
    expect(page).toContain("| `lsi-indexing`<br><small>cat-harness</small> |");
    expect(page).toContain("`lsi-index`<br>`lsi-query`");
    expect(page).toContain("`document-ingestion`");
  });

  test("a method with no held source and no skill says both, rather than drawing nothing", () => {
    expect(page).toContain("**No held evidence.**");
    expect(page).toContain("nothing declares `uses-methodology: correspondence-analysis`");
  });

  test("an indexing skill with no method is listed as having no evidence yet", () => {
    const gap = page.slice(page.indexOf("## Indexing work with no evidence yet"));
    expect(gap).toContain("`glossary-terms`");
    expect(gap).toContain("`glossary-from-source`");
  });

  test("points index health at the repository health report", () => {
    expect(page).toContain("check `lsi-indexes`");
    expect(page).not.toContain("| graph | needs one |");
  });

  test("every table row has as many cells as its header — a `|` in a description is escaped", () => {
    expect(page).toContain("index \\| with a pipe");
    let cols = 0;
    for (const line of page.split("\n")) {
      if (!line.startsWith("|")) { cols = 0; continue; }
      const cells = line.replace(/\\\|/g, "").split("|").length - 2;
      if (cols === 0) cols = cells;
      else expect(cells).toBe(cols);
    }
  });
});

describe("the evidence page links the keyword viewer", () => {
  test("a reader on the LSI page can reach the Keywords page beneath it", () => {
    const model: EvidenceModel = { methods: [], unbacked: [] };
    const page = evidencePage(model);
    expect(page).toContain("[Keywords](keywords/)");
  });
});
