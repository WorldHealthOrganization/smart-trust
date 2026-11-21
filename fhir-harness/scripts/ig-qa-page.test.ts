import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readQaRecords } from "../../cat-harness-tools/scripts/kg-qa-report.ts";
import { runInNewContext } from "node:vm";
import { fhirQaMarkdown, QA_MESSAGES_JS, readFhirQa, renderQaPage } from "./ig-qa-page.ts";

function dirWith(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), "ig-qa-"));
  for (const [f, s] of Object.entries(files)) writeFileSync(join(d, f), s);
  return d;
}

const RECORD = {
  $schema: "qa-results/v1",
  producer: { script: "x/check.ts" },
  subject: { kind: "fhir-ig", id: "an-ig" },
  families: {
    "lane-gap": { summary: "a lane with | a pipe", count: 2, entries: [{ persona: "A" }, { persona: "B", note: "{{ not liquid }}" }] },
    clean: { summary: "nothing", count: 0, entries: [] },
  },
  total: 2,
};

const MANIFEST = {
  generatedAt: "2026-11-05T17:28:37Z",
  authority: "cache",
  provisional: ["indices", "versions"],
  provisionalUntil: "a full IG Publisher run",
  toolchain: { publisher: "3.0.0", core: "7.0.1" },
  resources: [{}, {}],
};

describe("ig-qa-page", () => {
  test("fhirQaSummaryFromAst", () => {
    const ast = dirWith({ "qa.json": JSON.stringify({ errs: 3, warnings: 7, hints: 0, tool: "2.0.15", version: "5.0.0", date: "Wed, 05 Nov 2026" }), "manifest.json": JSON.stringify(MANIFEST) });
    const md = fhirQaMarkdown(readFhirQa(ast), { up: "" }).join("\n");
    expect(md).toContain("(IG Publisher 2.0.15, FHIR 5.0.0, on Wed, 05 Nov 2026)");
    expect(md).toContain("| errors | 3 |");
    expect(md).toContain("| hints | 0 |");
    expect(md).not.toContain("suppressed");
    expect(md).toContain("(assets/fhir-qa/qa.json)");
    expect(md).toContain("| generated | `2026-11-05T17:28:37Z` |");
    expect(md).toContain("| provisional | `indices`, `versions`, until a full IG Publisher run |");
  });

  test("markdownSectionFromAst", () => {
    const ast = dirWith({ "manifest.json": JSON.stringify(MANIFEST), "a.json": JSON.stringify({ resourceType: "ValueSet", id: "vs", description: "## Heading" }) });
    const q = readFhirQa(ast);
    expect(q.markdown?.scanned).toBe(1);
    const md = fhirQaMarkdown(q).join("\n");
    expect(md).toContain("### Markdown rendering");
    expect(md).toContain("| `ValueSet/vs` | `description` | heading |");
    expect(fhirQaMarkdown(readFhirQa(dirWith({ "manifest.json": JSON.stringify(MANIFEST) }))).join("\n")).not.toContain("### Markdown rendering");
  });

  test("fhirQaWithoutSummarySaysSo", () => {
    const ast = dirWith({ "manifest.json": JSON.stringify(MANIFEST) });
    const validity = join(dirWith({ "v.json": JSON.stringify({ verdict: "stale", detail: { verdict: "stale", why: "the inputs changed" }, recorded: { inputDigest: "a" }, current: { inputDigest: "b" } }) }), "v.json");
    const md = fhirQaMarkdown(readFhirQa(ast, validity)).join("\n");
    expect(md).toContain("holds no Publisher QA summary");
    expect(md).not.toContain("| errors |");
    expect(md).toContain("**Validity for this checkout:** `stale`. the inputs changed");
    expect(md).toContain("| inputDigest | `a` | `b` |");
  });

  test("pageRawHalvesKgRecords", () => {
    const d = dirWith({ "swim.qa-results.json": JSON.stringify(RECORD) });
    const page = renderQaPage({ title: "QA Report", fhir: {}, kg: { view: "en/h/qa/", instances: [{ instance: "an-ig", dirs: [d], records: readQaRecords([d]), page: "en/h/qa/an-ig/" }] } });
    expect(page.startsWith("---\ntitle: \"QA Report\"\nnav_exclude: true\n")).toBe(true);
    expect(page).toContain("{% raw %}");
    expect(page.indexOf("## FHIR QA")).toBeLessThan(page.indexOf("## Knowledge-graph QA"));
    expect(page).toContain("[Every instance's QA](en/h/qa/)");
    expect(page).toContain("2 finding(s), written by `x/check.ts`");
    expect(page).toContain("(assets/kg-qa/an-ig/swim.qa-results.json)");
    expect(page).toContain("a lane with \\| a pipe");
    expect(page).toContain("| B | {{ not liquid }} |");
    expect(page.trimEnd().endsWith("{% endraw %}")).toBe(true);
  });

  test("publisherLayoutFromTheMessageList", async () => {
    const qa = { title: "An IG", "package-id": "example.an-ig", "ig-ver": "0.9.9", version: "4.0.1", tool: "6.0.0", errs: 1, warnings: 1, hints: 1, "broken-links": 0, url: "http://x/ig" };
    const messages = {
      $schema: "ig-qa-messages/v1",
      groups: [
        { messages: [{ severity: "warning", text: "The build" }] },
        { file: "input/resources/Questionnaire-A.json", messages: [{ severity: "error", text: "value set http://x/ig/ValueSet/vs-a not found; see http://hl7.org/fhir/R4/x.html.", path: "Questionnaire.item[0]", line: 12, col: 4, messageId: "Q_LINKID" }, { severity: "information", text: "a hint" }] },
      ],
    };
    const ast = dirWith({ "qa.json": JSON.stringify(qa), "qa-messages.json": JSON.stringify(messages) });
    const md = fhirQaMarkdown(readFhirQa(ast), { up: "" }).join("\n");
    expect(md).toContain('class="ig-qa-publisher"');
    expect(md).toContain('data-messages="assets/fhir-qa/qa-messages.json"');
    expect(md).toContain('<script src="assets/fhir-qa/qa-messages.js"></script>');
    expect(md).not.toContain("| errors |");

    // The page script, over a fake DOM: the Publisher's tables, as text in order.
    const texts: string[] = [];
    const links: string[] = [];
    const node = (tag: string): Record<string, unknown> => ({
      tag,
      nodeType: 1,
      className: "ig-qa-publisher",
      set textContent(v: string) {
        if (v) texts.push(v);
      },
      appendChild: (c: unknown) => c,
      setAttribute: (k: string, v: string) => (k === "href" ? links.push(v) : undefined),
      getAttribute: (k: string) =>
        ({ "data-summary": "qa.json", "data-messages": "qa-messages.json", "data-pages": "pages.json", "data-artifacts": "artifact/", "data-source": "https://github.com/o/r/blob/abc/" })[k],
      addEventListener: () => {},
    });
    const document = {
      querySelectorAll: () => [node("div")],
      getElementById: () => null,
      head: node("head"),
      createElement: (t: string) => node(t),
      createTextNode: (t: string) => (texts.push(t), { nodeType: 3 }),
    };
    const pages = ["Questionnaire-A.html", "ValueSet-vs-a.html", "ImplementationGuide-example.an-ig.html"];
    const fetch = async (u: string) => ({ ok: true, json: async () => (u === "qa.json" ? qa : u === "pages.json" ? pages : messages) });
    runInNewContext(QA_MESSAGES_JS, { document, fetch, Promise, Error, String, Object, Array });
    for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
    const out = texts.join("\n");
    expect(out).toContain("Validation Results for An IG");
    expect(out).toContain("FHIR version 4.0.1 for \nexample.an-ig#0.9.9");
    expect(out).not.toContain("[object Object]");
    expect(out).toContain("errors = 1, warn = 1, info = 1, broken links = 0");
    for (const h of ["Filename", "Errors", "Warnings", "Hints", "Path", "Severity", "Message"]) expect(texts).toContain(h);
    expect(out).toContain("Build Errors");
    expect(out).toContain("input/resources/Questionnaire-A.json");
    expect(out).toContain("  (1 errors, 0 warnings, 1 hints) ");
    // Linked as far as the site allows: the IG's page, each file's page and source, its canonicals to their pages, other URLs to themselves.
    expect(links).toContain("artifact/ImplementationGuide-example.an-ig.html");
    expect(links).toContain("artifact/Questionnaire-A.html");
    expect(links).toContain("https://github.com/o/r/blob/abc/input/resources/Questionnaire-A.json");
    expect(links).toContain("artifact/ValueSet-vs-a.html");
    expect(links).toContain("http://hl7.org/fhir/R4/x.html");
    expect(links).toContain("#qa-files");
    expect(out).toContain("Questionnaire.item[0] (l12/c4)");
    expect(out).toContain("Q_LINKID");
  });
});
