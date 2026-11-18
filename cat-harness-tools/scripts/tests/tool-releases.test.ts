import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, test } from "bun:test";

import { RunContextRefSchema, RunContextSchema, unprovisioned } from "../../schemas/sdlc/run-context.ts";
import { TOOL_RELEASE_SCHEMA_TAG, type ToolRelease } from "../../schemas/tools/tool-release.ts";
import { TOOL_PROFILE_SCHEMA_TAG, type ToolProfile } from "../../schemas/tools/tool-profile.ts";
import { TEST_RUN_SCHEMA_ID, type TestRun } from "../../schemas/sdlc/test-run.ts";
import { TEST_REPORT_SCHEMA_ID, type TestReport } from "../../schemas/sdlc/test-report.ts";
import type { ProvActivity } from "../../schemas/content/prov.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { assessPin, readPin, type PinDef } from "../../src/upstream/pins.ts";
import { resolvePlantumlRelease, PLANTUML } from "../plantuml-render.ts";
import {
  SPDX_3_0_1_CONTEXT_URL,
  attachProvUsedToActivity,
  buildRunContext,
  exportGitbTar,
  exportSpdxSbom,
  loadToolReleases,
  packageSpdxId,
  projectQaToolchain,
  provUsedFromRunContext,
  releaseArtefactPath,
  releaseCacheDir,
  resolveTools,
  whichTool,
  type LoadedToolReleases,
} from "../tool-releases.ts";

const REPO = resolve(dirname(HARNESS_ROOT));
const SEEDED = resolve(HARNESS_ROOT, "tool-releases");

const sha256Hex = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");

function makeSyntheticCatalog(): {
  loaded: Pick<LoadedToolReleases, "releases" | "profiles">;
  releases: ToolRelease[];
  profiles: ToolProfile[];
  artefacts: Map<string, Uint8Array>;
} {
  const jre17Bytes = new TextEncoder().encode("fake-jre-17-archive");
  const jre21Bytes = new TextEncoder().encode("fake-jre-21-archive");
  const plantumlBytes = new TextEncoder().encode("fake-plantuml-jar");
  const igPubBytes = new TextEncoder().encode("fake-ig-publisher-jar");
  const sushiBytes = new TextEncoder().encode("fake-fsh-sushi-tgz");
  const nodeBytes = new TextEncoder().encode("fake-node-22-archive");
  const leanBytes = new TextEncoder().encode("leanprover/lean4:v4.35.0\n");

  const jre17: ToolRelease = {
    $schema: TOOL_RELEASE_SCHEMA_TAG,
    name: "temurin-jre",
    version: "17.0.12+7",
    role: "runtime",
    kind: "archive",
    source: { type: "url", url: "https://example.invalid/jre-17.tar.gz" },
    digest: { algorithm: "sha256", digest: sha256Hex(jre17Bytes), verifiedAt: "2026-10-07" },
    licence: "GPL-2.0-only WITH Classpath-exception-2.0",
    licenceSource: "test fixture: no real artefact behind it",
    platform: { os: "linux", arch: "x64" },
    entry: { template: "{home}/bin/java", home: "jdk-17.0.12+7-jre" },
    runtimes: [],
  };

  const jre21: ToolRelease = {
    $schema: TOOL_RELEASE_SCHEMA_TAG,
    name: "temurin-jre",
    version: "21.0.4+7",
    role: "runtime",
    kind: "archive",
    source: { type: "url", url: "https://example.invalid/jre-21.tar.gz" },
    digest: { algorithm: "sha256", digest: sha256Hex(jre21Bytes), verifiedAt: "2026-10-07" },
    licence: "GPL-2.0-only WITH Classpath-exception-2.0",
    licenceSource: "test fixture: no real artefact behind it",
    platform: { os: "linux", arch: "x64" },
    entry: { template: "{home}/bin/java", home: "jdk-21.0.4+7-jre" },
    runtimes: [],
  };

  const node22: ToolRelease = {
    $schema: TOOL_RELEASE_SCHEMA_TAG,
    name: "node",
    version: "22.23.4",
    role: "runtime",
    kind: "archive",
    source: { type: "url", url: "https://example.invalid/node-22.tar.xz" },
    digest: { algorithm: "sha256", digest: sha256Hex(nodeBytes), verifiedAt: "2026-10-07" },
    licence: "MIT",
    licenceSource: "test fixture: no real artefact behind it",
    platform: { os: "linux", arch: "x64" },
    entry: { template: "{home}/bin/node", home: "node-v22.23.4-linux-x64" },
    runtimes: [],
  };

  const plantuml: ToolRelease = {
    $schema: TOOL_RELEASE_SCHEMA_TAG,
    name: "plantuml",
    version: "1.2026.9",
    role: "tool",
    kind: "jar",
    source: { type: "url", url: "https://example.invalid/plantuml-1.2026.9.jar" },
    digest: { algorithm: "sha256", digest: sha256Hex(plantumlBytes), verifiedAt: "2026-10-07" },
    licence: "GPL-3.0-or-later",
    licenceSource: "test fixture: no real artefact behind it",
    entry: { template: "java -jar {path}" },
    runtimes: [{ release: "temurin-jre@21.0.4+7", inject: "JAVA_HOME" }],
  };

  const igPublisher: ToolRelease = {
    $schema: TOOL_RELEASE_SCHEMA_TAG,
    name: "fhir-ig-publisher",
    version: "1.6.20",
    role: "tool",
    kind: "jar",
    source: { type: "url", url: "https://example.invalid/publisher-1.6.20.jar" },
    digest: { algorithm: "sha256", digest: sha256Hex(igPubBytes), verifiedAt: "2026-10-07" },
    licence: "Apache-2.0",
    licenceSource: "test fixture: no real artefact behind it",
    entry: { template: "java -jar {path}" },
    runtimes: [
      { release: "temurin-jre@17.0.12+7", inject: "JAVA_HOME" },
      { release: "fsh-sushi@3.21.0", inject: "PATH" },
    ],
  };

  const fshSushi: ToolRelease = {
    $schema: TOOL_RELEASE_SCHEMA_TAG,
    name: "fsh-sushi",
    version: "3.21.0",
    role: "tool",
    kind: "archive",
    source: { type: "url", url: "https://example.invalid/fsh-sushi-3.21.0.tgz" },
    digest: { algorithm: "sha256", digest: sha256Hex(sushiBytes), verifiedAt: "2026-10-07" },
    licence: "MIT",
    licenceSource: "test fixture: no real artefact behind it",
    entry: { template: "node {home}/dist/app.js", home: "package" },
    runtimes: [{ release: "node@22.23.4", inject: "PATH" }],
  };

  const lean: ToolRelease = {
    $schema: TOOL_RELEASE_SCHEMA_TAG,
    name: "lean-toolchain",
    version: "4.35.0",
    role: "tool",
    kind: "toolchain-file",
    source: { type: "url", url: "https://example.invalid/lean-4.35.0" },
    digest: { algorithm: "sha256", digest: sha256Hex(leanBytes), verifiedAt: "2026-10-07" },
    licence: "Apache-2.0",
    licenceSource: "test fixture: no real artefact behind it",
    entry: { template: "elan toolchain install --file {path}" },
    runtimes: [],
  };

  const profile: ToolProfile = {
    $schema: TOOL_PROFILE_SCHEMA_TAG,
    name: "dual-java",
    description: "PlantUML on Java 21 alongside IG Publisher on Java 17 and SUSHI on Node 22.",
    tools: {
      plantuml: "plantuml@1.2026.9",
      "fhir-ig-publisher": "fhir-ig-publisher@1.6.20",
      "fsh-sushi": "fsh-sushi@3.21.0",
      "lean-toolchain": "lean-toolchain@4.35.0",
    },
  };

  const releases = [jre17, jre21, node22, plantuml, igPublisher, fshSushi, lean];
  const profiles = [profile];

  const artefacts = new Map<string, Uint8Array>([
    [(jre17.source as { url: string }).url, jre17Bytes],
    [(jre21.source as { url: string }).url, jre21Bytes],
    [(node22.source as { url: string }).url, nodeBytes],
    [(plantuml.source as { url: string }).url, plantumlBytes],
    [(igPublisher.source as { url: string }).url, igPubBytes],
    [(fshSushi.source as { url: string }).url, sushiBytes],
    [(lean.source as { url: string }).url, leanBytes],
  ]);

  return {
    loaded: {
      releases: releases.map((r) => ({ file: `${r.name}-${r.version}.json`, release: r })),
      profiles: profiles.map((p) => ({ file: `${p.name}.profile.json`, profile: p })),
    },
    releases,
    profiles,
    artefacts,
  };
}

describe("Step 2 — resolver, content-addressed cache & per-tool runtime injection", () => {
  test("provisions two tools on different Java runtimes (17 vs 21) in the same cache and injects each tool's own JAVA_HOME and PATH", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cat-tools-cache-"));
    try {
      const { loaded, artefacts } = makeSyntheticCatalog();
      const res = await resolveTools(
        loaded,
        { profile: "dual-java" },
        {
          cacheRoot,
          mode: "provision",
          fetcher: (rel) => {
            const url = rel.source.type === "url" ? rel.source.url : "";
            const b = artefacts.get(url);
            if (!b) throw new Error(`unexpected url ${url}`);
            return b;
          },
        },
      );

      expect(res.profile?.name).toBe("dual-java");
      expect(res.profile?.sha256).toMatch(/^[0-9a-f]{64}$/);

      // All 7 releases in the transitive closure (4 tools + 3 runtimes) are provisioned.
      expect(res.runReleases.map((r) => r.release).sort()).toEqual([
        "fhir-ig-publisher@1.6.20",
        "fsh-sushi@3.21.0",
        "lean-toolchain@4.35.0",
        "node@22.23.4",
        "plantuml@1.2026.9",
        "temurin-jre@17.0.12+7",
        "temurin-jre@21.0.4+7",
      ]);
      expect(res.runReleases.every((r) => r.state === "provisioned")).toBe(true);

      // Both Temurin 17 and Temurin 21 coexist under <cache>/temurin-jre/<version>-<sha256_prefix12>/
      const jreDirs = readdirSync(join(cacheRoot, "temurin-jre")).sort();
      expect(jreDirs).toHaveLength(2);
      expect(jreDirs[0]).toMatch(/^17\.0\.12\+7-[0-9a-f]{12}$/);
      expect(jreDirs[1]).toMatch(/^21\.0\.4\+7-[0-9a-f]{12}$/);

      // whichTool injects JAVA_HOME=jre21 for plantuml and JAVA_HOME=jre17 + PATH(fsh-sushi) for fhir-ig-publisher.
      const plantumlWhich = await whichTool(loaded, "plantuml", { profile: "dual-java", cacheRoot, mode: "resolve-only" });
      expect(plantumlWhich.env.JAVA_HOME).toContain("21.0.4+7-");
      expect(plantumlWhich.entryCommand).toContain("plantuml-1.2026.9.jar");

      const igWhich = await whichTool(loaded, "fhir-ig-publisher", { profile: "dual-java", cacheRoot, mode: "resolve-only" });
      expect(igWhich.env.JAVA_HOME).toContain("17.0.12+7-");
      expect(igWhich.env.PATH).toContain("fsh-sushi");

      const sushiWhich = await whichTool(loaded, "fsh-sushi", { profile: "dual-java", cacheRoot, mode: "resolve-only" });
      expect(sushiWhich.env.PATH).toContain("node-v22.23.4-linux-x64/bin");
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  test("refuses a sha256 mismatch with state `could-not-provision` and writes nothing to the cache", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cat-tools-tamper-"));
    try {
      const { loaded, releases, artefacts } = makeSyntheticCatalog();
      const res = await resolveTools(
        loaded,
        { refs: ["plantuml@1.2026.9"] },
        {
          cacheRoot,
          mode: "provision",
          fetcher: (rel) => {
            if (rel.name === "plantuml") {
              return new TextEncoder().encode("tampered-bytes-not-matching-digest");
            }
            const url = rel.source.type === "url" ? rel.source.url : "";
            return artefacts.get(url)!;
          },
        },
      );

      const puml = res.runReleases.find((r) => r.release === "plantuml@1.2026.9")!;
      expect(puml.state).toBe("could-not-provision");
      if (puml.state === "could-not-provision") {
        expect(puml.reason).toContain("sha256 mismatch");
      }
      const pumlRel = releases.find((r) => r.name === "plantuml")!;
      const targetFile = releaseArtefactPath(pumlRel, cacheRoot);
      expect(existsSync(targetFile)).toBe(false);
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  test("re-uses an already verified cache entry without re-fetching, and rejects a corrupted cache file", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cat-tools-reuse-"));
    try {
      const { loaded, releases } = makeSyntheticCatalog();
      const pumlRel = releases.find((r) => r.name === "plantuml")!;
      const jre21Rel = releases.find((r) => r.name === "temurin-jre" && r.version === "21.0.4+7")!;

      // Pre-populate jre21 with valid bytes and plantuml with corrupted bytes.
      const jrePath = releaseArtefactPath(jre21Rel, cacheRoot);
      mkdirSync(dirname(jrePath), { recursive: true });
      writeFileSync(jrePath, new TextEncoder().encode("fake-jre-21-archive"));

      const pumlDir = releaseCacheDir(pumlRel, cacheRoot);
      const pumlPath = releaseArtefactPath(pumlRel, cacheRoot);
      mkdirSync(pumlDir, { recursive: true });
      writeFileSync(pumlPath, new TextEncoder().encode("corrupted-plantuml-bytes"));

      const res = await resolveTools(
        loaded,
        { refs: ["plantuml@1.2026.9"] },
        {
          cacheRoot,
          mode: "provision",
        },
      );

      const jreState = res.runReleases.find((r) => r.release === "temurin-jre@21.0.4+7")!;
      const pumlState = res.runReleases.find((r) => r.release === "plantuml@1.2026.9")!;
      expect(jreState.state).toBe("provisioned");
      expect(pumlState.state).toBe("could-not-provision");
      if (pumlState.state === "could-not-provision") {
        expect(pumlState.reason).toContain("sha256 mismatch");
      }
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  test("plantuml-render resolves PlantUML's release from the declared tool-release directory", async () => {
    const resolved = await resolvePlantumlRelease(HARNESS_ROOT);
    expect(resolved.version).toBe(PLANTUML.version);
    expect(resolved.sha256).toBe(PLANTUML.sha256);
    expect(resolved.url).toBe(PLANTUML.url);
  });
});

describe("Step 3 — RunContext & PROV-O `prov:used` emission (`C1 = a`)", () => {
  test("buildRunContext produces a valid folio-run-context/v1, content-addressed ref, and omits unprovisioned releases from prov:used", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cat-tools-prov-"));
    try {
      const { loaded, artefacts } = makeSyntheticCatalog();
      const res = await resolveTools(
        loaded,
        { profile: "dual-java" },
        {
          cacheRoot,
          mode: "provision",
          fetcher: (rel) => {
            if (rel.name === "fsh-sushi") {
              throw new Error("registry unreachable");
            }
            const url = rel.source.type === "url" ? rel.source.url : "";
            return artefacts.get(url)!;
          },
        },
      );

      const built = buildRunContext({
        resolution: res,
        platformCommit: "1".repeat(40),
        invoker: { kind: "system", id: "cat-harness-tools/scripts/tool-releases.ts", script_hash: "abcdef012345" },
        inputs: [{ hash: "abcdef012345", inputs: ["cat-harness/uml/a.puml"] }],
        provActivity: "urn:folio:activity:test-1",
      });

      expect(RunContextSchema.safeParse(built.context).success).toBe(true);
      expect(RunContextRefSchema.safeParse(built.ref).success).toBe(true);
      expect(built.ref.sha256).toBe(sha256Hex(built.canonicalBytes));

      // fsh-sushi failed to provision, and fhir-ig-publisher depends on fsh-sushi so both are unprovisioned.
      const unprov = unprovisioned(built.context).map((r) => r.release);
      expect(unprov).toContain("fsh-sushi@3.21.0");
      expect(unprov).toContain("fhir-ig-publisher@1.6.20");

      const used = provUsedFromRunContext(built.context);
      expect(used).toContain("plantuml@1.2026.9");
      expect(used).toContain("temurin-jre@21.0.4+7");
      expect(used).toContain("temurin-jre@17.0.12+7");
      expect(used).toContain("node@22.23.4");
      expect(used).not.toContain("fsh-sushi@3.21.0");
      expect(used).not.toContain("fhir-ig-publisher@1.6.20");

      const baseActivity: ProvActivity = {
        "@type": "prov:Activity",
        "@id": "t--x#1",
        "prov:startedAtTime": "2026-10-07T00:00:00.000Z",
        "prov:qualifiedAssociation": {
          "prov:agent": "owner",
          "prov:hadRole": "authoring-agent",
          "prov:hadPlan": "code-change-review#Task_ClaimBean",
        },
        "cat-harness:underPolicy": "https://litlfred.github.io/folio-assistant/policies/folio-defaults",
        "prov:used": ["existing-entity"],
      } as ProvActivity;
      const attached = attachProvUsedToActivity(baseActivity, built.context);
      expect(attached["prov:used"]).toEqual(["existing-entity", ...used]);

      // When all releases provision, projectQaToolchain projects both publisher and sushi.
      const fullRes = await resolveTools(loaded, { profile: "dual-java" }, { cacheRoot, mode: "resolve-only" });
      const fullBuilt = buildRunContext({
        resolution: fullRes,
        platformCommit: "1".repeat(40),
        invoker: { kind: "system", id: "cat-harness-tools/scripts/tool-releases.ts", script_hash: "abcdef012345" },
      });
      expect(projectQaToolchain(fullBuilt.context, { fhirVersion: "4.0.1" })).toEqual({
        publisher: "1.6.20",
        sushi: "3.21.0",
        fhirVersion: "4.0.1",
      });
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });
});

describe("Step 4 — `tools:sbom` SPDX 3.0.1 JSON-LD export", () => {
  test("exports a self-contained SPDX 3.0.1 JSON-LD graph with packages, hashes, declared licences, dependsOn and usesTool relationships", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cat-tools-sbom-"));
    try {
      const { loaded, releases, profiles, artefacts } = makeSyntheticCatalog();
      const res = await resolveTools(
        loaded,
        { profile: "dual-java" },
        {
          cacheRoot,
          mode: "provision",
          fetcher: (rel) => {
            const url = rel.source.type === "url" ? rel.source.url : "";
            return artefacts.get(url)!;
          },
        },
      );
      const { context, ref } = buildRunContext({
        resolution: res,
        platformCommit: "2".repeat(40),
        invoker: { kind: "system", id: "cat-harness-tools/scripts/tool-releases.ts", script_hash: "abcdef012345" },
        provActivity: "urn:folio:activity:sbom-1",
      });

      const sbom = exportSpdxSbom({
        releases,
        profile: profiles[0],
        runContext: context,
        created: "2026-10-07T00:00:00Z",
      });

      expect(sbom["@context"]).toBe(SPDX_3_0_1_CONTEXT_URL);
      const graph = sbom["@graph"] as Record<string, unknown>[];

      const creationInfo = graph.find((n) => n.type === "CreationInfo")!;
      expect(creationInfo.specVersion).toBe("3.0.1");
      expect(creationInfo.created).toBe("2026-10-07T00:00:00Z");

      const packages = graph.filter((n) => n.type === "software_Package");
      expect(packages).toHaveLength(releases.length);
      const plantumlPkg = packages.find((p) => p.name === "plantuml")!;
      expect(plantumlPkg.spdxId).toBe(packageSpdxId("plantuml@1.2026.9"));
      expect(plantumlPkg.verifiedUsing).toEqual([
        {
          type: "Hash",
          algorithm: "sha256",
          hashValue: releases.find((r) => r.name === "plantuml")!.digest.digest,
        },
      ]);

      // Every package has a hasDeclaredLicense relationship to a simplelicensing_LicenseExpression.
      const licenseExprs = graph.filter((n) => n.type === "simplelicensing_LicenseExpression");
      expect(licenseExprs.length).toBeGreaterThanOrEqual(4);
      const licenseRels = graph.filter((n) => n.type === "Relationship" && n.relationshipType === "hasDeclaredLicense");
      expect(licenseRels).toHaveLength(releases.length);

      // Tools with runtimes emit dependsOn relationships to their runtime packages.
      const dependsOnRels = graph.filter((n) => n.type === "Relationship" && n.relationshipType === "dependsOn");
      const igDepends = dependsOnRels.find((r) => r.from === packageSpdxId("fhir-ig-publisher@1.6.20"))!;
      expect(igDepends.to).toEqual([
        packageSpdxId("temurin-jre@17.0.12+7"),
        packageSpdxId("fsh-sushi@3.21.0"),
      ]);

      // RunContext produces a build_Build and a LifecycleScopedRelationship usesTool (scope: "build").
      const buildNode = graph.find((n) => n.type === "build_Build")!;
      expect(buildNode.build_buildId).toBe(ref.sha256);
      const usesTool = graph.find((n) => n.type === "LifecycleScopedRelationship")!;
      expect(usesTool.relationshipType).toBe("usesTool");
      expect(usesTool.scope).toBe("build");
      expect(usesTool.from).toBe(buildNode.spdxId);
      expect((usesTool.to as string[]).length).toBe(releases.length);

      const sbomNode = graph.find((n) => n.type === "software_Sbom")!;
      expect(sbomNode.sbomType).toEqual(["build"]);
      const docNode = graph.find((n) => n.type === "SpdxDocument")!;
      expect(docNode.rootElement).toEqual([sbomNode.spdxId]);
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  test("exports SPDX 3.0.1 over the real seeded tool-releases/ directory", () => {
    const loaded = loadToolReleases([SEEDED], REPO);
    expect(loaded.problems).toEqual([]);
    const sbom = exportSpdxSbom({
      releases: loaded.releases.map((r) => r.release),
      created: "2026-10-07T00:00:00Z",
    });
    const graph = sbom["@graph"] as Record<string, unknown>[];
    const packages = graph.filter((n) => n.type === "software_Package");
    expect(packages.length).toBe(loaded.releases.length);
  });
});

describe("Step 6 — `upstream-pins` assessment for tool-release pins", () => {
  test("assesses tool-release pins in upstream-pins.json with three-state semantics", () => {
    // The pin as cat-harness's registry declares it, not a hand-written copy:
    // the registry is what `check:upstream-pins` reads, so this asserts the
    // real entry's `pinnedIn` and patterns against the real release file.
    const registry = JSON.parse(readFileSync(join(HARNESS_ROOT, "upstream", "upstream-pins.json"), "utf8")) as { pins: PinDef[] };
    const pinDef = registry.pins.find((p) => p.id === "plantuml");
    if (!pinDef) throw new Error("cat-harness upstream-pins.json declares no `plantuml` pin");
    const fileText = readFileSync(join(HARNESS_ROOT, pinDef.pinnedIn), "utf8");
    const pinned = readPin(fileText, pinDef.pattern);
    // The version itself is not asserted: this test runs against whichever
    // cat-harness is mounted, and moving the pin there must not break it here.
    // What is asserted is that the pattern reads a PlantUML version out of the
    // real release file, and that the tag pattern accepts it.
    if (pinned === undefined) throw new Error(`no version read from ${pinDef.pinnedIn}`);
    expect(pinned).toMatch(/^1\.\d{4}\.\d+$/);
    const year = Number(pinned.split(".")[1]);
    const older = `v1.${year - 1}.0`;
    const tag = `v${pinned}`;
    const newer = `v1.${year + 1}.0`;
    expect(new RegExp(pinDef.tagPattern).test(tag)).toBe(true);

    const current = assessPin(pinDef, pinned, [older, tag]);
    expect(current.state).toBe("current");

    const behind = assessPin(pinDef, pinned, [tag, newer]);
    expect(behind.state).toBe("behind");
    expect(behind.behindBy).toEqual([newer]);

    const unknown = assessPin(pinDef, pinned, undefined);
    expect(unknown.state).toBe("unknown");
  });
});

describe("Step 8 — `test:itb-export` GITB TAR projection", () => {
  test("exports a GITB Test Assertion Report carrying the RunContext sha256 reference and per-case results", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "cat-tools-tar-"));
    try {
      const { loaded, artefacts } = makeSyntheticCatalog();
      const res = await resolveTools(
        loaded,
        { refs: ["plantuml@1.2026.9"] },
        {
          cacheRoot,
          mode: "provision",
          fetcher: (rel) => {
            const url = rel.source.type === "url" ? rel.source.url : "";
            return artefacts.get(url)!;
          },
        },
      );
      const { context, ref } = buildRunContext({
        resolution: res,
        platformCommit: "3".repeat(40),
        invoker: { kind: "system", id: "scripts/eval.ts", script_hash: "abcdef012345" },
      });

      const testRun: TestRun = {
        $schema: TEST_RUN_SCHEMA_ID,
        skill: "crdm-detect",
        subject: "crdm",
        data: { hash: "abcdef012345", inputs: ["a.md"] },
        process: { hash: "fedcba543210", inputs: ["b.ts"] },
        outcome: { pass: 2, fail: 1, warn: 1 },
        updated_at: "2026-10-07T00:02:00Z",
      };

      const testReport: TestReport = {
        $schema: TEST_REPORT_SCHEMA_ID,
        plan: { id: "crdm-detect", version: "1.0" },
        sut: { kind: "agent" as const, model: "claude-opus-5", configuration: "harness", actor: "claude-code", version: "1.0", reach: "internet" },
        run: { id: "run-1", data: "abcdef012345", process: "fedcba543210" },
        status: "completed",
        started_at: "2026-10-07T00:00:00Z",
        completed_at: "2026-10-07T00:02:00Z",
        cases: {
          "case-pass": [{ result: "pass", reviewer: { kind: "script", id: "eval.ts" }, reviewed_at: "2026-10-07T00:01:00Z" }],
          "case-warn": [{ result: "warn", reviewer: { kind: "script", id: "eval.ts" }, reviewed_at: "2026-10-07T00:01:10Z", notes: "minor drift" }],
          "case-fail": [{ result: "fail", reviewer: { kind: "script", id: "eval.ts" }, reviewed_at: "2026-10-07T00:01:20Z", notes: "missed decision" }],
        },
        rollup: { pass: 1, fail: 1, warn: 1, "n/a": 0, skipped: 0 },
      };

      const tar = exportGitbTar(testRun, { runContext: context, testReport });
      expect(tar.$schema).toBe("gitb-tar/v1");
      expect(tar.result).toBe("FAILURE");
      expect(tar.counters).toEqual({
        nrOfAssertions: 3,
        nrOfErrors: 1,
        nrOfWarnings: 1,
      });
      expect(tar.context.runContext).toEqual(ref);
      expect(tar.context.platformCommit).toBe("3".repeat(40));
      expect(tar.context.releases).toHaveLength(2);
      expect(tar.reports.map((r) => [r.id, r.result])).toEqual([
        ["case-pass", "SUCCESS"],
        ["case-warn", "SUCCESS"],
        ["case-fail", "FAILURE"],
      ]);
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });
});
