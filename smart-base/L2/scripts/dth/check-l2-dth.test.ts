/**
 * Unit tests for the L2 DTH cross-layer glossary validator, ArchiMate-link
 * QA check, persona linkage QA check, DMN decision-table source-passage QA check,
 * and L1 coverage for anchored BPMN tasks and DMN tables (`smart-base#242`).
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkBlockArchimateLinks,
  checkNarrativeArchimateMentions,
  dthCoverageWithAnchoredArtefacts,
  hasDecisionTableSourceCitation,
  validateL2DthFolio,
  type ArchimateModelIndex,
} from "./check-l2-dth.ts";

function makeFixtureFolio(mutate?: (root: string) => void): string {
  const root = mkdtempSync(join(tmpdir(), "l2-dth-test-"));

  // 1. Self layer declaration (dth-sfp)
  writeFileSync(
    join(root, "dth-sfp.json"),
    JSON.stringify({
      name: "dth-sfp",
      version: "0.1.0",
      iriBase: "https://litlfred.github.io/dth-sfp/",
      needs: ["smart-base", "dpi-h-ra", "dth-sc"],
      directories: [
        { id: "glossary", path: "glossary/", graphTypologies: ["code-list"] },
      ],
    }),
  );

  // 2. Mounted dpi-h-ra (smart-ra) glossary
  mkdirSync(join(root, "dpi-h-ra", "glossary"), { recursive: true });
  writeFileSync(
    join(root, "dpi-h-ra", "dpi-h-ra.json"),
    JSON.stringify({
      name: "dpi-h-ra",
      version: "0.1.0",
      iriBase: "https://litlfred.github.io/smart-ra/",
      directories: [
        { id: "glossary", path: "glossary/", graphTypologies: ["code-list"] },
      ],
    }),
  );
  writeFileSync(
    join(root, "dpi-h-ra", "glossary", "dpi-h-ra.glossary.json"),
    JSON.stringify({
      $schema: "folio-glossary/v1",
      id: "dpi-h-ra",
      title: "DPI-H Reference Architecture Glossary",
      description: "Shared glossary concepts in smart-ra.",
      terms: [
        {
          id: "registry",
          prefLabel: "Registry",
          definition: "A governed, authoritative information system.",
          status: "authored",
        },
        {
          id: "pharmacovigilance",
          prefLabel: "Pharmacovigilance",
          definition: "Science and activities relating to adverse effects.",
          status: "authored",
        },
      ],
    }),
  );

  // 3. Mounted dth-sc glossary
  mkdirSync(join(root, "dth-sc", "glossary"), { recursive: true });
  writeFileSync(
    join(root, "dth-sc", "dth-sc.json"),
    JSON.stringify({
      name: "dth-sc",
      version: "0.1.0",
      iriBase: "https://litlfred.github.io/dth-sc/",
      directories: [
        { id: "glossary", path: "glossary/", graphTypologies: ["code-list"] },
      ],
    }),
  );
  writeFileSync(
    join(root, "dth-sc", "glossary", "dth-sc.glossary.json"),
    JSON.stringify({
      $schema: "folio-glossary/v1",
      id: "dth-sc",
      title: "Supply Chain Glossary",
      description: "Supply chain domain terms.",
      terms: [
        {
          id: "track-and-trace",
          prefLabel: "Track and trace",
          definition: "Determining current and past locations of a product.",
          status: "authored",
        },
      ],
    }),
  );

  // 4. Self glossary with cross-layer links to dpi-h-ra and dth-sc
  mkdirSync(join(root, "glossary"), { recursive: true });
  writeFileSync(
    join(root, "glossary", "dth-sfp.glossary.json"),
    JSON.stringify({
      $schema: "folio-glossary/v1",
      id: "dth-sfp",
      title: "SFP Glossary",
      description: "Substandard and falsified medical products glossary.",
      terms: [
        {
          id: "sf-report",
          prefLabel: "SF report",
          definition: "A report of a suspected substandard or falsified product.",
          status: "authored",
          broader: [
            "https://litlfred.github.io/smart-ra/v0/ns/glossary/dpi-h-ra/pharmacovigilance",
          ],
          related: [
            "https://litlfred.github.io/dth-sc/v0/ns/glossary/dth-sc/track-and-trace",
          ],
        },
      ],
    }),
  );

  // 5. Folio blocks: persona, business-process (.bpmn), decision-table (.dmn + source citation)
  const chDir = join(root, "folio", "dth-sfp", "ch04-requirements");
  mkdirSync(chDir, { recursive: true });

  const bpmnRel = "folio/dth-sfp/ch04-requirements/bp-sfp-bp-01-report.bpmn";
  writeFileSync(
    join(root, bpmnRel),
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Defs_1" targetNamespace="http://smart.who.int/dth/bpmn">
  <bpmn:process id="Process_SFP_BP_01" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_Reporter" name="Health care professional" partitionElementRef="pers:health-care-professional">
        <bpmn:flowNodeRef>Task_SubmitReport</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:userTask id="Task_SubmitReport" name="Submit SF report" />
  </bpmn:process>
</bpmn:definitions>
`,
  );

  writeFileSync(
    join(chDir, "pers-health-care-professional.ts"),
    `import { persona } from "../../schema/builders";
export default persona({
  label: "pers:health-care-professional",
  title: "Health care professional (reporter)",
  meta: {"roleId":"SFP-R-01","bpmnLanes":[{"processId":"SFP-BP-01","bpmnFile":"${bpmnRel}","laneId":"Lane_Reporter"}],"archimate":{"elements":[{"iri":"https://litlfred.github.io/smart-ra/archimate/0.2.0/elements/id-role-hcp.jsonld","name":"Health Worker"}]},"glossaryTerms":["https://litlfred.github.io/dth-sfp/v0/ns/glossary/dth-sfp/sf-report"]},
});
`,
  );

  writeFileSync(
    join(chDir, "bp-sfp-bp-01-report.ts"),
    `import { businessProcess } from "../../schema/builders";
export default businessProcess({
  label: "bp:sfp-bp-01-report",
  title: "Report suspected SF medical product",
  meta: {"processId":"SFP-BP-01"},
});
`,
  );

  writeFileSync(
    join(chDir, "dt-sfp-dt-01-report-routing.ts"),
    `import { decisionTable } from "../../schema/builders";
export default decisionTable({
  label: "dt:sfp-dt-01-report-routing",
  title: "Route SF report by report type",
  decisionId: "decision_sfp_dt_01",
  uses: ["prose:ch04-fig-4"],
  meta: {"source":{"library":"9789240120747-eng","section":"page-041","locator":"Chapter 4.3, Fig. 4 gateway 5, PDF p.41"}},
});
`,
  );

  writeFileSync(
    join(chDir, "dt-sfp-dt-01-report-routing.dmn"),
    `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="Definitions_sfp_dt_01" name="SFP-DT-01" namespace="http://smart.who.int/dth/dmn">
  <decision id="decision_sfp_dt_01" name="Route SF report">
    <decisionTable id="DecisionTable_sfp_dt_01" hitPolicy="FIRST">
      <input id="Input_1" label="ReportType">
        <inputExpression id="InputExpression_1" typeRef="string">
          <text>reportType</text>
        </inputExpression>
      </input>
      <output id="Output_1" label="Route" name="route" typeRef="string" />
      <rule id="Rule_1">
        <inputEntry id="UnaryTests_1"><text>"substandard"</text></inputEntry>
        <outputEntry id="LiteralExpression_1"><text>"quality-defect-workflow"</text></outputEntry>
      </rule>
      <rule id="Rule_2">
        <inputEntry id="UnaryTests_2"><text>-</text></inputEntry>
        <outputEntry id="LiteralExpression_2"><text>"falsified-investigation-workflow"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>
`,
  );

  if (mutate) mutate(root);
  return root;
}

describe("validateL2DthFolio", () => {
  it("passesCompleteL2DthFixture", async () => {
    const root = makeFixtureFolio();
    try {
      const res = await validateL2DthFolio({ rootDir: root });
      expect(res.errors).toEqual([]);
      expect(res.ok).toBe(true);
      expect(res.counts.glossaryTerms).toBe(1);
      expect(res.counts.personas).toBe(1);
      expect(res.counts.businessProcesses).toBe(1);
      expect(res.counts.bpmnLanes).toBe(1);
      expect(res.counts.decisionTables).toBe(1);
      expect(res.counts.decisionRules).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reportsBrokenCrossInstanceSkosMatch", async () => {
    const root = makeFixtureFolio((r) => {
      writeFileSync(
        join(r, "glossary", "dth-sfp.glossary.json"),
        JSON.stringify({
          $schema: "folio-glossary/v1",
          id: "dth-sfp",
          title: "SFP Glossary",
          description: "Broken cross-instance link test.",
          terms: [
            {
              id: "sf-report",
              prefLabel: "SF report",
              definition: "A report of a suspected product.",
              status: "authored",
              closeMatch: [
                "https://litlfred.github.io/smart-ra/v0/ns/glossary/dpi-h-ra/nonexistent-term",
              ],
            },
          ],
        }),
      );
    });
    try {
      const res = await validateL2DthFolio({ rootDir: root });
      expect(res.ok).toBe(false);
      expect(res.errors.join("\n")).toContain("nonexistent-term is not a term in mounted instance dpi-h-ra");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("failsPersonaMissingLinks", async () => {
    const root = makeFixtureFolio((r) => {
      const pFile = join(
        r,
        "folio",
        "dth-sfp",
        "ch04-requirements",
        "pers-health-care-professional.ts",
      );
      writeFileSync(
        pFile,
        `import { persona } from "../../schema/builders";
export default persona({
  label: "pers:health-care-professional",
  title: "Health care professional (reporter)",
  meta: {"roleId":"SFP-R-01"},
});
`,
      );
    });
    try {
      const res = await validateL2DthFolio({ rootDir: root });
      expect(res.ok).toBe(false);
      expect(res.errors.join("\n")).toContain("persona is missing meta.roleId or meta.bpmnLanes");
      expect(res.errors.join("\n")).toContain("persona is missing meta.archimate.elements");
      expect(res.errors.join("\n")).toContain("persona is missing glossary link");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("failsDecisionTableWithoutSource", async () => {
    const root = makeFixtureFolio((r) => {
      const dtFile = join(
        r,
        "folio",
        "dth-sfp",
        "ch04-requirements",
        "dt-sfp-dt-01-report-routing.ts",
      );
      writeFileSync(
        dtFile,
        `import { decisionTable } from "../../schema/builders";
export default decisionTable({
  label: "dt:sfp-dt-01-report-routing",
  title: "Route SF report by report type",
  decisionId: "decision_sfp_dt_01",
  meta: {"decisionId":"decision_sfp_dt_01"},
});
`,
      );
    });
    try {
      const res = await validateL2DthFolio({ rootDir: root });
      expect(res.ok).toBe(false);
      expect(res.errors.join("\n")).toContain("does not cite the source handbook passage");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("ArchiMate-link QA checks", () => {
  const archIndex: ArchimateModelIndex = {
    models: new Map([
      [
        "0.2.0",
        {
          elements: new Set(["id-prod-reg", "id-term-svc"]),
          views: new Set(["id-view-dhsc"]),
        },
      ],
    ]),
  };

  it("validatesArchimateIris", () => {
    const good = checkBlockArchimateLinks(
      "folio/dth-sc/ch02/p-1.ts",
      {
        elements: [
          {
            iri: "https://litlfred.github.io/smart-ra/archimate/0.2.0/elements/id-prod-reg.jsonld",
            name: "Product Registry",
          },
        ],
        views: [
          {
            iri: "https://litlfred.github.io/smart-ra/archimate/0.2.0/views/id-view-dhsc.jsonld",
            name: "DHSC View",
          },
        ],
        figures: [{ figure: "Figure 14", model: "0.2.0", view: "id-view-dhsc" }],
      },
      archIndex,
    );
    expect(good.errors).toEqual([]);
    expect(good.linkCount).toBe(2);
    expect(good.figureCount).toBe(1);

    const bad = checkBlockArchimateLinks(
      "folio/dth-sc/ch02/p-2.ts",
      {
        elements: [
          {
            iri: "https://litlfred.github.io/smart-ra/archimate/0.2.0/elements/id-missing.jsonld",
            name: "Missing Element",
          },
        ],
      },
      archIndex,
    );
    expect(bad.errors).toHaveLength(1);
    expect(bad.errors[0]).toContain("id-missing.jsonld");
  });

  it("flagsUnlinkedArchitectureMention", () => {
    const expected = [
      {
        name: "Product Registry",
        iri: "https://litlfred.github.io/smart-ra/archimate/0.2.0/elements/id-prod-reg.jsonld",
      },
    ];
    expect(
      checkNarrativeArchimateMentions(
        "p-ch02.md",
        "The reporting app queries the Product Registry for master data.",
        { elements: [] },
        expected,
      ),
    ).toHaveLength(1);
    expect(
      checkNarrativeArchimateMentions(
        "p-ch02.md",
        "The reporting app queries the Product Registry for master data.",
        { elements: [{ iri: expected[0]!.iri, name: "Product Registry" }] },
        expected,
      ),
    ).toEqual([]);
  });
});

describe("L1 coverage with anchored BPMN tasks and DMN decision tables", () => {
  it("countsAnchoredSentencesCaptured", () => {
    const pages = [
      {
        page: 13,
        text: "When a case of a substandard and falsified medical product is confirmed, relevant authorities should quickly remove the product from the supply chain. Countries should select a traceability model that matches their regulatory maturity.",
      },
    ];
    const reportWithoutAnchors = dthCoverageWithAnchoredArtefacts(pages, [], []);
    expect(reportWithoutAnchors.totals.normative).toBe(2);
    expect(reportWithoutAnchors.totals.captured).toBe(0);
    expect(reportWithoutAnchors.totals.unaccounted).toBe(2);

    const reportWithAnchors = dthCoverageWithAnchoredArtefacts(
      pages,
      [],
      [
        {
          artefactId: "bp:sfp-bp-01#Task_RemoveProduct",
          artefactKind: "bpmn-task",
          anchoredBlockId: "ch01/p-page-013",
          verbatimText:
            "When a case of a substandard and falsified medical product is confirmed, relevant authorities should quickly remove the product from the supply chain.",
        },
        {
          artefactId: "dt:sc-dt-02-traceability-model",
          artefactKind: "dmn-table",
          anchoredBlockId: "ch04/p-page-056",
          verbatimText:
            "Countries should select a traceability model that matches their regulatory maturity.",
        },
      ],
    );
    expect(reportWithAnchors.totals.normative).toBe(2);
    expect(reportWithAnchors.totals.captured).toBe(2);
    expect(reportWithAnchors.totals.unaccounted).toBe(0);
    expect(reportWithAnchors.totals.accountedForPct).toBe(100);
    expect(reportWithAnchors.sentences[0]!.node).toContain("bpmn-task:bp:sfp-bp-01#Task_RemoveProduct");
    expect(reportWithAnchors.sentences[1]!.node).toContain("dmn-table:dt:sc-dt-02-traceability-model");
  });

  it("recognisesSourceCitations", () => {
    expect(hasDecisionTableSourceCitation("export default decisionTable({})", undefined)).toBe(false);
    expect(
      hasDecisionTableSourceCitation(
        'export default decisionTable({ uses: ["prose:sec-4-3"] })',
        undefined,
      ),
    ).toBe(true);
    expect(
      hasDecisionTableSourceCitation(
        "export default decisionTable({})",
        { source: { section: "page-041" } },
      ),
    ).toBe(true);
    expect(
      hasDecisionTableSourceCitation(
        "export default decisionTable({})",
        undefined,
        "Source: Chapter 4, Fig. 4 (page-041)",
      ),
    ).toBe(true);
  });
});
