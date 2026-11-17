/**
 * Bean `folio-assistant-dp1j` — the four affordances of a conformant knowledge
 * graph (`browse`, `materialise`, `instantiate`, `copy-into-folio`), their
 * write-capability gates and read-only degradations, the `folio-init` skill ->
 * Tool edge, and the `copy-into-folio.bpmn` process that stamps `KgAsset.source`.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { AssetSourceSchema, KgAssetSchema } from "./kg/kg-node.ts";
import { readRoleGraph, resolveRoleSkills } from "./process/role-graph.ts";
import { toolTypeIri } from "./tools/tool-types.ts";
import { toolFromJson } from "./tools/tool-folders.ts";

import { requireHarnessRoot } from "./harness-root.ts";
const INSTANCE = requireHarnessRoot();
const KG_CORE_DIR = join(INSTANCE, "skills", "kg", "kg-core");
const CAPABILITIES_DIR = join(INSTANCE, "scenarios", "capabilities");
const BASE = "https://litlfred.github.io/cat-harness";
const mint = (name: Parameters<typeof toolTypeIri>[0]) => `${BASE}/tool-types.schema.json#/$defs/${name}`;

describe("bean dp1j — KG affordances: browse, materialise, instantiate, copy-into-folio", () => {
  test("1. the four verbs are written down in kg-affordances and registered in kg-core", () => {
    const manifest = JSON.parse(readFileSync(join(KG_CORE_DIR, "package-manifest.json"), "utf8")) as {
      skills: string[];
    };
    expect(manifest.skills).toContain("kg-affordances");
    expect(manifest.skills).toContain("folio-init");
    expect([...manifest.skills].sort()).toEqual(manifest.skills);

    const skillPath = join(KG_CORE_DIR, "kg-affordances.md");
    expect(existsSync(skillPath)).toBe(true);
    const body = readFileSync(skillPath, "utf8");
    for (const verb of ["browse", "materialise", "instantiate", "copy-into-folio"]) {
      expect(body).toContain(`\`${verb}\``);
    }
  });

  test("2. folio-init skill exists and the folio-init Tool satisfies it", () => {
    const skillPath = join(KG_CORE_DIR, "folio-init.md");
    expect(existsSync(skillPath)).toBe(true);
    const body = readFileSync(skillPath, "utf8");
    expect(body).toContain("name: folio-init");
    expect(body).toContain("--dry-run");

    // Tool definitions are JSON data (y9r6 step 3); read them as data.
    const folioInitTool = toolFromJson(join(INSTANCE, "tools", "folio-init", "folio-init.json"), mint);
    const declarationResolutionTool = toolFromJson(
      join(INSTANCE, "tools", "declaration-resolution", "declaration-resolution.json"),
      mint,
    );
    expect(folioInitTool.id).toBe("folio-init");
    expect(folioInitTool.satisfies).toContain("folio-init");
    expect(declarationResolutionTool.satisfies).toContain("kg-affordances");
  });

  test("3. write capabilities exist and each writing verb declares its capability requirement and degradation", () => {
    for (const cap of ["git-read", "git-push", "github-api", "github-connector"]) {
      const p = join(CAPABILITIES_DIR, `${cap}.json`);
      expect(existsSync(p)).toBe(true);
      const parsed = JSON.parse(readFileSync(p, "utf8")) as { id: string };
      expect(parsed.id).toBe(cap);
    }

    const affordances = readFileSync(join(KG_CORE_DIR, "kg-affordances.md"), "utf8");
    const folioInit = readFileSync(join(KG_CORE_DIR, "folio-init.md"), "utf8");
    for (const cap of ["git-push", "github-api", "github-connector"]) {
      expect(affordances).toContain(`\`${cap}\``);
      expect(folioInit).toContain(`\`${cap}\``);
    }
    // Browse is provably useful with zero write capability.
    expect(affordances).toMatch(/\*\*`browse`\*\*\s*\|\s*\*\*none\*\*/);
    expect(affordances).toContain("zero write capabilities");
  });

  test("4. copy-into-folio.bpmn checks write capability, copies the asset, stamps KgAsset.source, and lets the author edit/comment/raise todos", () => {
    const bpmnPath = join(INSTANCE, "processes", "kg", "copy-into-folio.bpmn");
    expect(existsSync(bpmnPath)).toBe(true);
    const xml = readFileSync(bpmnPath, "utf8");

    expect(xml).toContain('id="Process_CopyIntoFolio"');
    expect(xml).toContain('id="Task_ProbeWriteCapability"');
    expect(xml).toContain('id="GW_CanWrite"');
    expect(xml).toContain('id="Task_InspectReadOnly"');
    expect(xml).toContain('id="End_ReadOnlyDegraded"');
    expect(xml).toContain('id="Task_ReadUpstreamAsset"');
    expect(xml).toContain('id="Task_CopyAndDeclareAsset"');
    expect(xml).toContain('id="Task_StampAssetSource"');
    expect(xml).toContain('id="Task_ValidateDeclaredAsset"');
    expect(xml).toContain('id="Task_WorkOnCopy"');
    expect(xml).toContain('id="End_CopiedAndEditable"');
    expect(xml).toContain("KgAsset.source");

    // Every lane's role carries the skills its tasks name.
    const graph = readRoleGraph(join(INSTANCE, "scenarios"))!;
    expect(resolveRoleSkills(graph, "author").map((s) => s.skill)).toEqual(
      expect.arrayContaining(["kg-affordances", "todo-manager"]),
    );
    expect(resolveRoleSkills(graph, "authoring-agent").map((s) => s.skill)).toEqual(
      expect.arrayContaining(["kg-affordances", "directory-conventions", "folio-init"]),
    );
    expect(resolveRoleSkills(graph, "corpus").map((s) => s.skill)).toContain("kg-affordances");
    expect(resolveRoleSkills(graph, "validation-pipeline").map((s) => s.skill)).toContain("kg-affordances");
  });

  test("5. KgAsset.source stamps provenance and keeps copied assets distinct from locally authored ones", () => {
    const copied = KgAssetSchema.parse({
      id: "adapted-guideline-table",
      src: "assets/adapted-guideline-table.json",
      role: "guideline-table",
      source: {
        instance: "litlfred/smart-base",
        path: "assets/guideline-table.json",
        ref: "0123456789abcdef0123456789abcdef01234567",
      },
    });
    expect(copied.source).toEqual({
      instance: "litlfred/smart-base",
      path: "assets/guideline-table.json",
      ref: "0123456789abcdef0123456789abcdef01234567",
    });

    const local = KgAssetSchema.parse({
      id: "authored-here",
      src: "README.md",
      role: "readme",
    });
    expect(local.source).toBeUndefined();

    // Invalid layer slug is refused by AssetSourceSchema.
    expect(() =>
      AssetSourceSchema.parse({
        instance: "not-a-repo-slug",
        path: "assets/x.json",
      }),
    ).toThrow();
  });
});
