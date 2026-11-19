import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GraphTypologyNodeSchema } from "@litlfred/cat-harness-tools/schemas/kg/graph-typology-node.js";
import { resolveNodeSchemas } from "@litlfred/cat-harness-tools/schemas/kg/kind-validator.js";
import { toolsOf } from "@litlfred/cat-harness-tools/tools/discover.js";
import {
  DEFAULT_DSA_FIXTURE_DIR,
  computeSha256Hex,
  verifyDsaDirectory,
  DCAT_3_TERMS,
  DCTERMS_TERMS,
  loadPinnedContexts,
  ODRL_22_TERMS,
  OFFICIAL_CONTEXT_PROVENANCE,
  OFFICIAL_CONTEXTS_DIR,
  verifyDsaVersion,
} from "./check-dsa-hash.ts";

const CORE_ROOT = join(import.meta.dir, "..");

function loadWorkedVersion(ver: "v1" | "v2") {
  const dir = join(DEFAULT_DSA_FIXTURE_DIR, ver);
  return {
    legalText: readFileSync(join(dir, "agreement.md")),
    dcat: JSON.parse(readFileSync(join(dir, "dcat.jsonld"), "utf-8")) as Record<string, unknown>,
    agreement: JSON.parse(readFileSync(join(dir, "agreement.jsonld"), "utf-8")) as Record<string, unknown>,
  };
}

describe("dsa kind and hash check (DSA B3, bean folio-assistant-2z1t)", () => {
  it("typologyExternalSchemasOnly", async () => {
    const raw = JSON.parse(readFileSync(join(CORE_ROOT, "typologies", "dsa.json"), "utf-8")) as unknown;
    const node = GraphTypologyNodeSchema.parse(raw);
    expect(node.kind).toBe("dsa");
    expect(node.schema).toBeUndefined();
    expect(node.validator).toBeUndefined();
    expect(node.nodeSchemas).toBeDefined();

    const resolved = await resolveNodeSchemas("dsa", CORE_ROOT);
    expect(resolved.length).toBeGreaterThanOrEqual(4);
    for (const entry of resolved) {
      expect(entry.state).toBe("external");
    }
    const tags = new Set(resolved.map((r) => r.tag));
    expect(tags.has("odrl:Agreement")).toBe(true);
    expect(tags.has("dcat:Resource")).toBe(true);
    expect(tags.has("dcat:Distribution")).toBe(true);
    expect(tags.has("dcterms:source")).toBe(true);
  });

  it("workedExamplePasses", () => {
    const dirResult = verifyDsaDirectory(DEFAULT_DSA_FIXTURE_DIR);
    expect(dirResult.ok).toBe(true);
    expect(dirResult.errors).toEqual([]);

    const v1 = dirResult.versions["v1"];
    const v2 = dirResult.versions["v2"];
    expect(v1?.ok).toBe(true);
    expect(v2?.ok).toBe(true);
    expect(v1?.computedSha256).toBeDefined();
    expect(v2?.computedSha256).toBeDefined();
    expect(v1?.computedSha256).not.toBe(v2?.computedSha256);
    expect(v2?.previousVersion).toBe(v1?.resourceId);
  });

  it("oneByteChangeFails", () => {
    const v1 = loadWorkedVersion("v1");
    const tampered = Buffer.from(v1.legalText);
    tampered[0] = tampered[0] === 0x23 ? 0x24 : 0x23;

    const res = verifyDsaVersion({
      legalText: tampered,
      dcat: v1.dcat,
      agreement: v1.agreement,
    });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("SHA-256 mismatch"))).toBe(true);
  });

  it("uidIsFixedVersionUrl", () => {
    const v1 = loadWorkedVersion("v1");
    const res = verifyDsaVersion({
      legalText: v1.legalText,
      dcat: v1.dcat,
      agreement: { ...v1.agreement, uid: "https://example.org/dsa/042/latest" },
    });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("fixed-version URL"))).toBe(true);
  });

  it("amendedNamesPrevious", () => {
    const tmp = mkdtempSync(join(tmpdir(), "dsa-prev-"));
    try {
      for (const ver of ["v1", "v2"] as const) {
        const w = loadWorkedVersion(ver);
        mkdirSync(join(tmp, ver));
        writeFileSync(join(tmp, ver, "agreement.md"), w.legalText);
        writeFileSync(join(tmp, ver, "agreement.jsonld"), JSON.stringify(w.agreement, null, 2));
        const dcat = { ...w.dcat };
        if (ver === "v2") delete dcat["dcat:previousVersion"];
        writeFileSync(join(tmp, ver, "dcat.jsonld"), JSON.stringify(dcat, null, 2));
      }
      const res = verifyDsaDirectory(tmp);
      expect(res.ok).toBe(false);
      expect(res.errors.some((e) => e.includes("dcat:previousVersion"))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("sourceNamesCheckedDistribution", () => {
    const v1 = loadWorkedVersion("v1");

    const wrongSourceAgreement = {
      ...v1.agreement,
      "dcterms:source": "https://example.org/dsa/042/v1/other-file.md",
    };
    const resWrong = verifyDsaVersion({
      legalText: v1.legalText,
      dcat: v1.dcat,
      agreement: wrongSourceAgreement,
    });
    expect(resWrong.ok).toBe(false);
    expect(resWrong.errors.some((e) => e.includes("dcterms:source"))).toBe(true);

    const missingSourceAgreement = { ...v1.agreement };
    delete missingSourceAgreement["dcterms:source"];
    const resMissing = verifyDsaVersion({
      legalText: v1.legalText,
      dcat: v1.dcat,
      agreement: missingSourceAgreement,
    });
    expect(resMissing.ok).toBe(false);
    expect(resMissing.errors.some((e) => e.includes("dcterms:source"))).toBe(true);
  });

  it("rejectsUnknownField", () => {
    const v1 = loadWorkedVersion("v1");

    const customInAgreement = {
      ...v1.agreement,
      customDsaField: "not-in-odrl-dcat-or-dcterms",
    };
    const resAgreement = verifyDsaVersion({
      legalText: v1.legalText,
      dcat: v1.dcat,
      agreement: customInAgreement,
    });
    expect(resAgreement.ok).toBe(false);
    expect(
      resAgreement.errors.some((e) =>
        e.includes('property "customDsaField" is not defined in ODRL 2.2, DCAT 3 or DCMI Terms'),
      ),
    ).toBe(true);

    const customInDcat = {
      ...v1.dcat,
      "ex:inventedProperty": "forbidden",
    };
    const resDcat = verifyDsaVersion({
      legalText: v1.legalText,
      dcat: customInDcat,
      agreement: v1.agreement,
    });
    expect(resDcat.ok).toBe(false);
    expect(
      resDcat.errors.some((e) =>
        e.includes('property "ex:inventedProperty" is not defined in ODRL 2.2, DCAT 3 or DCMI Terms'),
      ),
    ).toBe(true);
  });

  it("newVersionNewHash", () => {
    const tmp = mkdtempSync(join(tmpdir(), "dsa-hash-test-"));
    try {
      const v1 = loadWorkedVersion("v1");
      const textHash = computeSha256Hex(v1.legalText);

      mkdirSync(join(tmp, "v1"), { recursive: true });
      mkdirSync(join(tmp, "v2"), { recursive: true });

      writeFileSync(join(tmp, "v1", "agreement.md"), v1.legalText);
      writeFileSync(join(tmp, "v1", "dcat.jsonld"), JSON.stringify(v1.dcat, null, 2));
      writeFileSync(join(tmp, "v1", "agreement.jsonld"), JSON.stringify(v1.agreement, null, 2));

      // v2 has identical text and hash to v1
      const v2Dcat = {
        ...v1.dcat,
        "@id": "https://example.org/dsa/042/v2",
        "dcat:version": "2.0",
        "dcat:previousVersion": { "@id": "https://example.org/dsa/042/v1" },
        "dcat:distribution": [
          {
            "@type": "dcat:Distribution",
            "@id": "https://example.org/dsa/042/v2/agreement.md",
            "dcat:downloadURL": "https://example.org/dsa/042/v2/agreement.md",
            "spdx:checksum": {
              "@type": "spdx:Checksum",
              "spdx:algorithm": { "@id": "http://spdx.org/rdf/terms#checksumAlgorithm_sha256" },
              "spdx:checksumValue": textHash,
            },
          },
        ],
      };
      const v2Agreement = {
        ...v1.agreement,
        uid: "https://example.org/dsa/042/v2",
        "dcterms:source": "https://example.org/dsa/042/v2/agreement.md",
      };
      writeFileSync(join(tmp, "v2", "agreement.md"), v1.legalText);
      writeFileSync(join(tmp, "v2", "dcat.jsonld"), JSON.stringify(v2Dcat, null, 2));
      writeFileSync(join(tmp, "v2", "agreement.jsonld"), JSON.stringify(v2Agreement, null, 2));

      const res = verifyDsaDirectory(tmp);
      expect(res.ok).toBe(false);
      expect(res.errors.some((e) => e.includes("versioned DSA must get a new hash"))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("pinnedContextsRejectMadeUp", () => {
    expect(OFFICIAL_CONTEXT_PROVENANCE.length).toBe(5);
    expect(ODRL_22_TERMS.has("Agreement")).toBe(true);
    expect(ODRL_22_TERMS.has("odrl:Agreement")).toBe(true);
    expect(DCAT_3_TERMS.has("dcat:Resource")).toBe(true);
    expect(DCAT_3_TERMS.has("dcat:Distribution")).toBe(true);
    expect(DCAT_3_TERMS.has("spdx:checksum")).toBe(true);
    expect(DCAT_3_TERMS.has("adms:status")).toBe(true);
    expect(DCTERMS_TERMS.has("dcterms:source")).toBe(true);
    expect(DCTERMS_TERMS.has("dcterms:issued")).toBe(true);

    // Made-up terms in official prefixes must not be in the parsed sets and must fail verifyDsaVersion
    const v1 = loadWorkedVersion("v1");
    for (const madeUp of ["odrl:madeUpTerm", "dcat:madeUpTerm", "dcterms:madeUpTerm", "spdx:madeUpTerm"]) {
      const bad = verifyDsaVersion({
        legalText: v1.legalText,
        dcat: { ...v1.dcat, [madeUp]: "invented" },
        agreement: v1.agreement,
      });
      expect(bad.ok).toBe(false);
      expect(bad.errors.some((e) => e.includes(`property "${madeUp}" is not defined in ODRL 2.2, DCAT 3 or DCMI Terms`))).toBe(true);
    }

    // Tampering with a pinned official context file fails loadPinnedContexts with a SHA-256 mismatch
    const tmp = mkdtempSync(join(tmpdir(), "dsa-ctx-tamper-"));
    try {
      for (const entry of OFFICIAL_CONTEXT_PROVENANCE) {
        writeFileSync(join(tmp, entry.file), readFileSync(join(OFFICIAL_CONTEXTS_DIR, entry.file)));
      }
      writeFileSync(join(tmp, "provenance.json"), readFileSync(join(OFFICIAL_CONTEXTS_DIR, "provenance.json")));
      writeFileSync(join(tmp, "odrl-2.2.context.json"), '{"@context": {"madeUp": "http://www.w3.org/ns/odrl/2/madeUp"}}\n');
      expect(() => loadPinnedContexts(tmp)).toThrow(/SHA-256 mismatch/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("toolSatisfiesOnlyTheAlwaysOnDsaSkill", () => {
    // The Tool is always-on; the other DSA skills are in the opt-in `dsa`
    // sub-graph, which a downstream can switch off (owner, 2026-11-13).
    const coreTools = toolsOf(CORE_ROOT);
    const tool = coreTools.find((t) => t.id === "check-dsa-hash");
    expect(tool).toBeDefined();
    expect(tool!.satisfies).toEqual(["dsa-checksum"]);
    expect(tool!.invoke).toEqual({
      shell: "bun run folio-assistant-core/scripts/check-dsa-hash.ts",
    });
  });
});
