/**
 * Viewer rows and pages name the node they show by its IRI (owner,
 * 2026-11-13, node-kind audit: "link existing IRIs"). Scenario, Tool and
 * process rows link the IRI and its `.jsonld`; Tool and process pages carry
 * `rel=alternate` to it (front matter `alternate_jsonld`, which
 * cat-harness's head_custom.html writes as the link). A folio sticky's link
 * to a platform docs page names the platform's site on a downstream's.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { registryTable, SUBJECT_ROWS, withSubjectIris, type RegistryRow } from "../../state-visualizer.ts";
import { page as toolsPage, type ToolRow } from "../../gen-tools-viz.ts";
import { toolPage, type ToolPageData } from "../../tool-page.ts";
import { page as processesPage, processPage, type ProcessRow } from "../../gen-processes-viz.ts";
import { platformDocHref } from "../../gen-folio-viz.ts";

const IRI = "https://e.org/fa/cat-harness";

describe("scenario rows link their actor's and capability's IRI", () => {
  const rows: RegistryRow[] = [
    { file: "actors/admin.json", id: "admin", text: "The admin" },
    { file: "capabilities/merge.json", id: "merge" },
    { file: "deployments/x/actors.json", id: "x" },
    { file: "stories.json", id: "stories" },
    { file: "actors/broken.json", id: "broken", note: "does not parse as JSON" },
  ];
  const iriOf = (file: string, kind: string, id: string) => (file.startsWith("/s/") ? `${IRI}/${kind}/${id}` : undefined);

  test("only files directly in actors/ and capabilities/ are subjects, as kg-export reads them", () => {
    expect(SUBJECT_ROWS.scenarios).toEqual([{ dir: "actors", kind: "actor" }, { dir: "capabilities", kind: "capability" }]);
    const out = withSubjectIris(rows, "/s", ["scenarios"], iriOf);
    expect(out.map((r) => r.iri)).toEqual([`${IRI}/actor/admin`, `${IRI}/capability/merge`, undefined, undefined, undefined]);
  });

  test("another listed kind, or a layer that mints nothing, is left as it was", () => {
    expect(withSubjectIris(rows, "/s", ["policies"], iriOf)).toEqual(rows);
    expect(withSubjectIris(rows, "/elsewhere", ["scenarios"], iriOf)).toEqual(rows);
  });

  test("the row links the IRI and its .jsonld; a table with no IRI keeps its four columns", () => {
    const html = registryTable(withSubjectIris(rows, "/s", ["scenarios"], iriOf));
    expect(html).toContain(`<a href="${IRI}/actor/admin"><code>admin</code></a>`);
    expect(html).toContain(`<a href="${IRI}/actor/admin.jsonld" type="application/ld+json">.jsonld</a>`);
    expect(html).toContain("<th>JSON-LD</th>");
    const plain = registryTable(rows);
    expect(plain).not.toContain("JSON-LD");
    expect(plain).toContain("<code>admin</code>");
  });
});

describe("Tool rows and pages name the Tool's JSON-LD", () => {
  const row: ToolRow = { id: "t1", title: "T one", description: "does", install: ["none"], invoke: ["shell"], satisfies: [], inputs: 0, outputs: 0 };

  test("the row links the Tool's document beside its page", () => {
    const md = toolsPage([row], new Set(), new Set(), "", { toolHref: () => "t1/", toolIri: (id) => `${IRI}/tools/${id}.jsonld` });
    expect(md).toContain(`[\`t1\`](t1/) · [JSON-LD](${IRI}/tools/t1.jsonld)`);
    expect(toolsPage([row], new Set(), new Set(), "", { toolHref: () => "t1/" })).not.toContain("JSON-LD](");
  });

  test("the page's front matter names it as the alternate", () => {
    const d = {
      def: { id: "t1", title: "T one", description: "does", install: {}, invoke: { shell: "x" }, io: { inputs: [], outputs: [] }, satisfies: [] },
      instance: "cat-harness",
      iri: `${IRI}/tools/t1.jsonld`,
      docIri: `${IRI}/cat-harness.jsonld`,
      typeIri: "https://e.org/ns#Tool",
      skills: new Map(),
      skillHref: () => undefined,
      toolHref: () => undefined,
      siblings: new Map(),
      alternatives: [],
      processes: [],
      processesRead: true,
      parts: [],
      moduleImports: [],
      mcpServers: [],
      mcpTools: [],
      workflows: [],
    } as unknown as ToolPageData;
    const fm = toolPage(d, "generated: x").split("\n---\n")[0]!;
    expect(fm).toContain(`alternate_jsonld: "${IRI}/tools/t1.jsonld"`);
    expect(toolPage({ ...d, iri: undefined }, "generated: x").split("\n---\n")[0]).not.toContain("alternate_jsonld");
  });
});

describe("process rows and pages name the process's IRI", () => {
  const row = { id: "Process_P", file: "procs/p.bpmn", stem: "p", name: "P", steps: [], skills: [], laneDetails: [], decisions: [], lanes: [], beanOps: [], activities: 0, activitiesWithoutSkill: [], group: "procs", enforcement: "advisory", enforcementDeclared: true } as unknown as ProcessRow;

  test("the row links the IRI and its .jsonld", () => {
    const md = processesPage([row], new Set(), undefined, { iriOf: (r) => `${IRI}/process/${r.id}` });
    expect(md).toContain(`[P](p.html) · [IRI](${IRI}/process/Process_P) · [JSON-LD](${IRI}/process/Process_P.jsonld)`);
    expect(processesPage([row], new Set(), undefined, { iriOf: () => undefined })).toContain("| [P](p.html) | 0 |");
  });

  test("the page's front matter names the .jsonld as the alternate", () => {
    const fm = processPage(row, [row], new Set(), [], undefined, () => {}, (r) => `${IRI}/process/${r.id}`).split("\n---\n")[0]!;
    expect(fm).toContain(`alternate_jsonld: "${IRI}/process/Process_P.jsonld"`);
    expect(processPage(row, [row], new Set(), [], undefined, () => {}, () => undefined).split("\n---\n")[0]).not.toContain("alternate_jsonld");
  });
});

describe("a sticky's link to a platform docs page (a downstream's /folio/, 2026-11-13)", () => {
  const site = mkdtempSync(join(tmpdir(), "folio-docs-"));
  mkdirSync(join(site, "concepts"), { recursive: true });
  writeFileSync(join(site, "concepts", "agentic-harness.md"), "---\ntitle: x\n---\n");
  const host = "https://e.org/fa";

  test("names the platform's site on a downstream's site, where the page is not published", () => {
    expect(platformDocHref(site, "/concepts/agentic-harness.html", { here: false, base: host })).toBe(`${host}/concepts/agentic-harness.html`);
  });
  test("stays site-rooted on the platform's own site, so a preview keeps its links", () => {
    expect(platformDocHref(site, "/concepts/agentic-harness.html", { here: true, base: host })).toBe("/concepts/agentic-harness.html");
  });
  test("a page the platform's docs do not hold, or an absolute link, is left as authored", () => {
    expect(platformDocHref(site, "/catalogue/", { here: false, base: host })).toBe("/catalogue/");
    expect(platformDocHref(site, "https://github.com/x", { here: false, base: host })).toBe("https://github.com/x");
  });
});

describe("subjectIri — the IRI a layer's document mints, wherever it is built", () => {
  test("a platform layer's subject is named on the platform's site, own canonicalUrl or not (cat-harness declares one there)", async () => {
    const { subjectIri, hostSiteBase } = await import("../../lib/subject-pages.ts");
    const { HARNESS_ROOT } = await import("../../lib/roots.ts");
    const host = hostSiteBase();
    expect(host).toMatch(/^https?:\/\//);
    expect(subjectIri(join(HARNESS_ROOT, "scenarios", "actors", "admin.json"), "actor", "admin")).toBe(`${host}/cat-harness/actor/admin`);
  });
  test("a file in no layer has none", async () => {
    const { subjectIri } = await import("../../lib/subject-pages.ts");
    expect(subjectIri(join(tmpdir(), "nowhere", "x.json"), "actor", "x")).toBeUndefined();
  });
});
