import { describe, expect, test } from "bun:test";

import {
  RUN_CONTEXT_SCHEMA_TAG,
  RunContextRefSchema,
  RunContextSchema,
  runContextRef,
  toolchainFromRunContext,
  unprovisioned,
  type RunContext,
} from "./run-context";
import { TOOL_RUN_SCHEMA_ID, ToolRunRecordSchema } from "../tools/tool-run";
import { TEST_RUN_SCHEMA_ID, TestRunSchema } from "./test-run";
import { TEST_REPORT_SCHEMA_ID, TestReportSchema } from "./test-report";
import { QA_REPORT_SCHEMA_TAG, QaReportSchema } from "./qa-report";
import { KG_QA_MANIFEST_SCHEMA, KgQaManifestSchema } from "./kg-qa";
import { HEALTH_REPORT_SCHEMA, HealthReportSchema } from "./health-report";
import { addressBook, provJsonldDocument } from "../kg/prov-jsonld";
import type { ProvActivity } from "../content/prov";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { instanceDirectoryForGraph, layerRootsIn } from "../kg/cat-harness";

/** The `<name>@<version>` of the one release of `name` the checkout's `tool-release` graphs catalogue. */
function cataloguedRelease(repo: string, name: string): string {
  const refs = new Set<string>();
  for (const root of layerRootsIn(repo)) {
    const dir = instanceDirectoryForGraph(root, "tool-release");
    if (!dir) continue;
    for (const f of readdirSync(dir)) {
      if (!f.startsWith(`${name}-`) || !f.endsWith(".json")) continue;
      const n = JSON.parse(readFileSync(join(dir, f), "utf-8")) as { name?: unknown; version?: unknown };
      if (n.name === name && typeof n.version === "string") refs.add(`${name}@${n.version}`);
    }
  }
  expect([...refs]).toHaveLength(1);
  return [...refs][0]!;
}

const SHA = "a".repeat(64);
const COMMIT = "1".repeat(40);

function ctx(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    $schema: RUN_CONTEXT_SCHEMA_TAG,
    platform: { commit: COMMIT },
    mounts: {
      state: "locked",
      lock: { file: "folio-assistant.mount-lock.json", sha256: SHA },
      instances: [{ instance: "bootstrap", repository: "litlfred/bootstrap", sha: "2".repeat(40) }],
    },
    profile: { name: "default", sha256: SHA },
    releases: [
      { state: "provisioned", release: "plantuml@1.2026.9", digest: { algorithm: "sha256", digest: SHA } },
      { state: "provisioned", release: "temurin-jre@21.0.4+7", digest: { algorithm: "sha256", digest: "b".repeat(64) } },
    ],
    invoker: { kind: "system", id: "cat-harness/scripts/plantuml-render.ts", script_hash: "abcdef012345" },
    inputs: [{ hash: "abcdef012345", inputs: ["cat-harness/uml/a.puml"] }],
    prov: { activity: "urn:folio:activity:render-1" },
    ...over,
  };
}

const ok = (c: unknown) => RunContextSchema.safeParse(c).success;

describe("folio-run-context/v1", () => {
  test("a valid context parses", () => {
    expect(ok(ctx())).toBe(true);
  });

  test("strict: an unknown top-level field is refused", () => {
    expect(ok(ctx({ engine_version: "1" }))).toBe(false);
  });

  test("the platform commit is a full SHA — an abbreviated one is ambiguous", () => {
    expect(ok(ctx({ platform: { commit: "1234567" } }))).toBe(false);
  });

  describe("releases — `could-not-provision` is a state with a reason", () => {
    test("could-not-provision WITH a reason parses, and is reported", () => {
      const c = RunContextSchema.parse(
        ctx({ releases: [{ state: "could-not-provision", release: "temurin-jre@21.0.4+7", reason: "no network: api.adoptium.net refused" }] }),
      );
      expect(unprovisioned(c).map((r) => r.release)).toEqual(["temurin-jre@21.0.4+7"]);
    });

    test("could-not-provision WITHOUT a reason is refused", () => {
      expect(ok(ctx({ releases: [{ state: "could-not-provision", release: "temurin-jre@21.0.4+7" }] }))).toBe(false);
      expect(ok(ctx({ releases: [{ state: "could-not-provision", release: "temurin-jre@21.0.4+7", reason: "" }] }))).toBe(false);
    });

    test("provisioned WITHOUT a digest is refused", () => {
      expect(ok(ctx({ releases: [{ state: "provisioned", release: "plantuml@1.2026.9" }] }))).toBe(false);
    });

    test("one release listed twice is refused", () => {
      const r = { state: "provisioned", release: "plantuml@1.2026.9", digest: { algorithm: "sha256", digest: SHA } };
      expect(ok(ctx({ releases: [r, r] }))).toBe(false);
    });
  });

  describe("mounts — none, locked, or could-not-determine", () => {
    test("`none` parses; `locked` with no instances does not", () => {
      expect(ok(ctx({ mounts: { state: "none" } }))).toBe(true);
      expect(ok(ctx({ mounts: { state: "locked", lock: { file: "x.mount-lock.json", sha256: SHA }, instances: [] } }))).toBe(false);
    });

    test("`could-not-determine` needs its reason", () => {
      expect(ok(ctx({ mounts: { state: "could-not-determine" } }))).toBe(false);
      expect(ok(ctx({ mounts: { state: "could-not-determine", reason: "the lock did not parse" } }))).toBe(true);
    });

    test("a mounted instance pinned by branch name is refused", () => {
      expect(ok(ctx({ mounts: { state: "locked", lock: { file: "x.mount-lock.json", sha256: SHA }, instances: [{ instance: "bootstrap", repository: "litlfred/bootstrap", sha: "main" }] } }))).toBe(false);
    });
  });

  describe("invoker", () => {
    test("a `system` invoker must give its script hash — `unknown` is allowed and is not a hash", () => {
      expect(ok(ctx({ invoker: { kind: "system", id: "scripts/x.ts" } }))).toBe(false);
      expect(ok(ctx({ invoker: { kind: "system", id: "scripts/x.ts", script_hash: "unknown" } }))).toBe(true);
      expect(ok(ctx({ invoker: { kind: "system", id: "scripts/x.ts", script_hash: "not-a-hash" } }))).toBe(false);
    });

    test("a person needs no script hash; an unknown actor kind is refused", () => {
      expect(ok(ctx({ invoker: { kind: "person", id: "litlfred" } }))).toBe(true);
      expect(ok(ctx({ invoker: { kind: "robot", id: "x" } }))).toBe(false);
    });
  });

  test("inputs reuse HashBasisSchema: a basis over nothing is refused", () => {
    expect(ok(ctx({ inputs: [{ hash: "abc", inputs: [] }] }))).toBe(false);
  });

  test("profile and prov are optional — a run may select no profile and record no PROV activity yet", () => {
    const { profile: _p, prov: _v, ...rest } = ctx();
    expect(ok(rest)).toBe(true);
  });
});

describe("the reference a report carries (C1: by sha256)", () => {
  test("RunContextRefSchema is `{ sha256 }` and nothing else", () => {
    expect(RunContextRefSchema.safeParse({ sha256: SHA }).success).toBe(true);
    expect(RunContextRefSchema.safeParse({ sha256: SHA, context: {} }).success).toBe(false);
    expect(RunContextRefSchema.safeParse({ sha256: "abc" }).success).toBe(false);
  });

  test("the reference does not depend on the order a writer set fields in", () => {
    const a = RunContextSchema.parse(ctx()) as RunContext;
    const reordered = Object.fromEntries(Object.entries(ctx()).reverse());
    const b = RunContextSchema.parse(reordered) as RunContext;
    expect(runContextRef(a)).toEqual(runContextRef(b));
    expect(RunContextRefSchema.safeParse(runContextRef(a)).success).toBe(true);
  });

  test("a different context has a different reference", () => {
    const a = RunContextSchema.parse(ctx()) as RunContext;
    const b = RunContextSchema.parse(ctx({ platform: { commit: "3".repeat(40) } })) as RunContext;
    expect(runContextRef(a).sha256).not.toBe(runContextRef(b).sha256);
  });

  test("toolchainFromRunContext projects provisioned publisher and sushi releases and ignores could-not-provision", () => {
    const c = RunContextSchema.parse(
      ctx({
        releases: [
          { state: "provisioned", release: "fsh-sushi@3.21.0", digest: { algorithm: "sha256", digest: SHA } },
          { state: "could-not-provision", release: "fhir-ig-publisher@1.6.20", reason: "offline" },
        ],
      }),
    ) as RunContext;
    expect(toolchainFromRunContext(c, { fhirVersion: "4.0.1" })).toEqual({
      sushi: "3.21.0",
      fhirVersion: "4.0.1",
    });
  });

  test("run and report schemas accept optional `runContext: { sha256 }` and reject inline context objects (C1 = a)", () => {
    const ref = { sha256: SHA };
    const inline = RunContextSchema.parse(ctx());
    const records: [string, { safeParse: (v: unknown) => { success: boolean } }, Record<string, unknown>][] = [
      [
        "tool run",
        ToolRunRecordSchema,
        {
          $schema: TOOL_RUN_SCHEMA_ID,
          tool: "plantuml-render",
          target: "cat-harness/uml",
          outcome: "succeeded",
          inputFingerprint: "abcdef012345",
          releases: [{ state: "provisioned", release: "plantuml@1.2026.9", digest: { algorithm: "sha256", digest: SHA } }],
        },
      ],
      [
        "test run",
        TestRunSchema,
        {
          $schema: TEST_RUN_SCHEMA_ID,
          skill: "crdm-detect",
          subject: "crdm",
          data: { hash: "abcdef012345", inputs: ["a.md"] },
          process: { hash: "fedcba543210", inputs: ["b.ts"] },
          outcome: { pass: 1 },
          updated_at: "2026-10-07T00:00:00Z",
        },
      ],
      [
        "test report",
        TestReportSchema,
        {
          $schema: TEST_REPORT_SCHEMA_ID,
          plan: { id: "crdm-detect", version: "1" },
          sut: { kind: "agent" as const, model: "claude-opus-5", configuration: "harness", actor: "claude-code", version: "1.0", reach: "internet" },
          run: { id: "r1", data: "abcdef012345", process: "fedcba543210" },
          status: "completed",
          started_at: "2026-10-07T00:00:00Z",
          completed_at: "2026-10-07T00:01:00Z",
          cases: { c1: [{ result: "pass", reviewer: { kind: "script", id: "eval.ts" }, reviewed_at: "2026-10-07T00:01:00Z" }] },
          rollup: { pass: 1, fail: 0, warn: 0, "n/a": 0, skipped: 0 },
        },
      ],
      [
        "qa report",
        QaReportSchema,
        {
          $schema: QA_REPORT_SCHEMA_TAG,
          producer: "dak-script",
          source: { tool: "gen.py" },
          phase: "postprocessing",
          timestamp: "2026-10-07T00:00:00Z",
          status: "completed",
          summary: {
            total_successes: 0,
            total_warnings: 0,
            total_errors: 0,
            files_processed_count: 0,
            files_expected_count: 0,
            files_missing_count: 0,
            completion_timestamp: "2026-10-07T00:00:01Z",
          },
          details: { successes: [], warnings: [], errors: [], files_processed: [], files_expected: [], files_missing: [] },
        },
      ],
      [
        "kg qa manifest",
        KgQaManifestSchema,
        {
          $schema: KG_QA_MANIFEST_SCHEMA,
          auditor: { script: "scripts/kg-audit.ts", script_hash: "abcdef012345", engine_version: "1" },
        },
      ],
      [
        "health report",
        HealthReportSchema,
        {
          $schema: HEALTH_REPORT_SCHEMA,
          producer: { script: "test/health/run.ts", script_hash: "abcdef012345" },
          subject: { kind: "repository", id: "litlfred/cat-harness" },
          updated_at: "2026-10-07T00:00:00Z",
          verdict: "clean",
          checks: [{ id: "c1", state: "ok", summary: "s", thresholds: [], measurements: [], findings: [] }],
        },
      ],
    ];
    for (const [name, schema, record] of records) {
      const verdict = (runContext?: unknown) =>
        `${name}: ${schema.safeParse(runContext === undefined ? record : { ...record, runContext }).success}`;
      expect(verdict()).toBe(`${name}: true`);
      expect(verdict(ref)).toBe(`${name}: true`);
      expect(verdict(inline)).toBe(`${name}: false`);
      expect(verdict({ ...ref, context: inline })).toBe(`${name}: false`);
    }
  });

  test("addressBook resolves tool-release refs (`<name>@<version>`) as `prov:Entity` IRIs for `prov:used` (Step 3)", () => {
    const repo = resolve(import.meta.dir, "..", "..", "..");
    const book = addressBook(repo);
    // The PlantUML pin moves with cat-harness's catalogue, so read the version
    // it catalogues rather than hard-coding one that a re-pin retires.
    const plantumlRef = cataloguedRelease(repo, "plantuml");
    const plantuml = book.resolve("entity", plantumlRef);
    expect(plantuml).toEqual({
      iri: `https://litlfred.github.io/cat-harness/v0/tool-releases/${plantumlRef.replace("@", "-")}`,
    });
    const jre17 = book.resolve("entity", "temurin-jre@17.0.12+7");
    expect(jre17).toEqual({ iri: "https://litlfred.github.io/cat-harness/v0/tool-releases/temurin-jre-17.0.12_7-linux-x64" });
    const act: ProvActivity = {
      "@type": "prov:Activity",
      "@id": "t--x#1",
      "prov:startedAtTime": "2026-10-07T00:00:00.000Z",
      "prov:qualifiedAssociation": {
        "prov:agent": "owner",
        "prov:hadRole": "authoring-agent",
        "prov:hadPlan": "code-change-review#Task_ClaimBean",
      },
      "cat-harness:underPolicy": "https://litlfred.github.io/folio-assistant/policies/folio-defaults",
      "prov:used": [plantumlRef, "temurin-jre@21.0.4+7"],
    } as ProvActivity;
    const { unaddressed } = provJsonldDocument("t--x", [act], book);
    expect(unaddressed).toEqual([]);
  });
});
