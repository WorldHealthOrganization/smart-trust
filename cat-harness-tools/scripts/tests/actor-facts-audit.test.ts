/**
 * Test actor-fact-has-consumer criterion implementation and vacuity guard.
 *
 * Bean `folio-assistant-bkje`, proposal
 * `cat-harness/docs/proposals/actor-facts-and-their-processes.md` §4 item 1.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { evaluateActorFactConsumers, matchesToken } from "../actor-facts.js";
import { KG_CRITERIA_BY_ID } from "../../schemas/sdlc/kg-qa.js";
import { readActors, actorsDir, type LoadedActor } from "../../schemas/process/role-graph.js";
import { readPolicyGrants, type OdrlPolicy } from "../../schemas/content/odrl.js";
import { workflowFiles, corpusScopeFor } from "../known-skills.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

describe("token matching helper", () => {
  test("matches distinct identifiers surrounded by non-alphanumeric/hyphen/underscore", () => {
    expect(matchesToken("git-push", "The task performs git-push to remote.")).toBe(true);
    expect(matchesToken("git-push", "<task name=\"git-push\"/>")).toBe(true);
    expect(matchesToken("git-push", "git-push-something-else")).toBe(false);
    expect(matchesToken("admin", "admin-settings")).toBe(false);
    expect(matchesToken("admin-settings", "exercising admin-settings")).toBe(true);
  });
});

describe("vacuity guard", () => {
  test("an empty actor set returns unknown rather than passing", () => {
    const res = evaluateActorFactConsumers({ actors: [] });
    expect(res.result).toBe("unknown");
    expect(res.findings).toHaveLength(1);
    expect(res.findings[0]?.detail).toContain("no actors declared");
  });

  test("actors with no declared capabilities and permissions returns unknown rather than passing", () => {
    const dummyActor: LoadedActor = {
      id: "dummy",
      title: "Dummy",
      kind: "person",
      looksLikeRole: false,
      path: "/dummy.json",
    };
    const res = evaluateActorFactConsumers({ actors: [dummyActor] });
    expect(res.result).toBe("unknown");
    expect(res.findings).toHaveLength(1);
    expect(res.findings[0]?.detail).toContain("no actor facts");
  });
});

describe("consumer detection", () => {
  test("passes when all declared facts are consumed in processes/gateways/tasks", () => {
    const actor: LoadedActor = {
      id: "signer",
      title: "Signer",
      kind: "agent",
      looksLikeRole: false,
      capabilities: ["signing-api"],
      permissions: ["role-management"],
      path: "/signer.json",
    };

    // A process naming neither fact: both are unconsumed, so it fails.
    const dir = mkdtempSync(join(tmpdir(), "actor-facts-"));
    try {
      const silent = join(dir, "silent.bpmn");
      writeFileSync(silent, '<bpmn:definitions><bpmn:process id="P"><bpmn:task id="T" name="Do the work"/></bpmn:process></bpmn:definitions>');
      const res = evaluateActorFactConsumers({ actors: [actor], workflowFiles: [], processes: [{ file: silent }] });
      expect(res.result).toBe("fail");
      expect(res.findings.map((f) => f.where)).toEqual(["role-management", "signing-api"]);

      // A process whose gateway consumes the capability and whose task
      // consumes the permission: every declared fact is consumed, so it passes.
      const consuming = join(dir, "consuming.bpmn");
      writeFileSync(
        consuming,
        '<bpmn:definitions><bpmn:process id="P">' +
          '<bpmn:exclusiveGateway id="G" name="signing-api reachable?"/>' +
          '<bpmn:task id="T" name="Grant under role-management"/>' +
          "</bpmn:process></bpmn:definitions>",
      );
      const res2 = evaluateActorFactConsumers({ actors: [actor], workflowFiles: [], processes: [{ file: consuming }] });
      expect(res2.result).toBe("pass");
      expect(res2.findings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("reports unconsumed capability and permission as findings", () => {
    const actor: LoadedActor = {
      id: "worker",
      title: "Worker",
      kind: "agent",
      looksLikeRole: false,
      capabilities: ["unconsumed-cap"],
      permissions: ["unconsumed-perm"],
      path: "/worker.json",
    };

    const res = evaluateActorFactConsumers({
      actors: [actor],
      workflowFiles: [],
    });

    expect(res.result).toBe("fail");
    expect(res.findings).toHaveLength(2);
    expect(res.findings.map((f) => f.where)).toEqual(["unconsumed-cap", "unconsumed-perm"]);
    expect(res.findings[0]?.detail).toContain("declared capability \"unconsumed-cap\"");
    expect(res.findings[0]?.detail).toContain("worker");
    expect(res.findings[1]?.detail).toContain("declared permission \"unconsumed-perm\"");
    expect(res.findings[1]?.detail).toContain("worker");
  });

  test("recognizes consumption in constrained ODRL policy rules", () => {
    const actor: LoadedActor = {
      id: "constrained-actor",
      title: "Constrained Actor",
      kind: "person",
      looksLikeRole: false,
      permissions: ["special-perm"],
      path: "/actor.json",
    };

    const policy: OdrlPolicy = {
      "@context": "http://www.w3.org/ns/odrl/2/",
      "@type": "Set",
      uid: "https://example.com/policy/test",
      profile: "https://example.com/profile",
      permission: [
        {
          assignee: "constrained-actor",
          action: "special-perm",
          constraint: [
            {
              leftOperand: "cat-harness:process",
              operator: "odrl:eq",
              rightOperand: "Process_Test",
            },
          ],
        },
      ],
      prohibition: [],
    };

    const res = evaluateActorFactConsumers({
      actors: [actor],
      policies: new Map([["test", policy]]),
    });

    expect(res.result).toBe("pass");
    expect(res.findings).toHaveLength(0);
  });
});

describe("criterion definition in KG_CRITERIA", () => {
  const def = KG_CRITERIA_BY_ID["actor-fact-has-consumer"];

  test("is registered with correct id, kind, and minor severity", () => {
    expect(def).toBeDefined();
    expect(def?.applies).toEqual(["graph"]);
    // Non-blocking mode initially
    expect(def?.severity).toBe("minor");
  });

  test("is repo-scoped with evidence-based scopeBasis", () => {
    expect(def?.scope).toBe("repo");
    expect((def?.scopeBasis ?? "").length).toBeGreaterThan(80);
    expect(/repoRootFor|repository root|repository-level|MEASURED/.test(def?.scopeBasis ?? "")).toBe(true);
  });
});

describe("real repository measurement", () => {
  test("measures baseline unconsumed actor facts count on the repository", () => {
    const ACTOR_DIR = actorsDir(ROOT) ?? "";
    const grants = readPolicyGrants(resolve(ROOT, "policies"));
    const actors = readActors(ACTOR_DIR, grants);
    const wfFiles = workflowFiles(ROOT, corpusScopeFor(ROOT));

    const res = evaluateActorFactConsumers({
      actors,
      workflowFiles: wfFiles,
      policiesDir: resolve(ROOT, "policies"),
    });

    expect(res.result).toBe("fail");
    // A RATCHET that fits both settings the test runs in. In the index, the
    // processes of the layers mounted beside cat-harness consume three more
    // facts than cat-harness's own do: lean-toolchain (folio-assistant-sci's
    // lean-docs-publish and authoring-a-paper), release-management
    // (fhir-harness's ig-incremental-build) and review-comments
    // (folio-assistant-core's content-change-review) — 13 there, 16 standing
    // alone. So the bound is 16 and may only fall, and every finding must be
    // one of the 16 known: a NEW unconsumed fact fails here in either setting.
    // `git-push` left the list when cat-harness's own copy-into-folio.bpmn
    // began probing it as a write capability.
    // `jekyll` left the must-be-unconsumed list below when cat-harness#1015's
    // sdlc/processes/docs-site-publish.bpmn began naming `bundle exec jekyll
    // build`. It stays in KNOWN: a checkout pinning cat-harness before #1015
    // still reports it, and either answer is right for its pin.
    const KNOWN = new Set([
      // capabilities
      "fhir-validator", "ig-publisher", "jekyll", "lean-toolchain", "sushi-compiler",
      // permissions
      "approval-authority", "clinical-validation", "content-authoring", "first-pass-review",
      "perform-task", "project-governance", "qa-reporting", "release-authorization",
      "release-management", "review-comments", "sme-coordination",
    ]);
    expect(res.findings.length).toBeLessThanOrEqual(16);
    const findingsWhere = res.findings.map((f) => f.where);
    expect(findingsWhere.filter((w) => !KNOWN.has(w))).toEqual([]);
    // Unconsumed in either setting: no process mounted anywhere consumes these yet.
    // `release-authorization` left this list when fhir-harness's
    // processes/content/ig-release.bpmn (fhir-harness#359) gave its owner lane
    // that permission. It stays in KNOWN: a checkout pinning fhir-harness
    // before #359 still reports it, and either answer is right for its pin.
    for (const w of [
      "content-authoring", "qa-reporting", "clinical-validation",
      "perform-task", "approval-authority", "project-governance", "first-pass-review", "sme-coordination"]) {
      expect(findingsWhere).toContain(w);
    }

    // The consumed facts MUST NOT be reported as findings:
    // signing-api, admin-settings, role-management, adjudication, translation, git-push
    expect(findingsWhere).not.toContain("git-push");
    expect(findingsWhere).not.toContain("signing-api");
    expect(findingsWhere).not.toContain("admin-settings");
    expect(findingsWhere).not.toContain("role-management");
    expect(findingsWhere).not.toContain("adjudication");
    expect(findingsWhere).not.toContain("translation");
  });
});
