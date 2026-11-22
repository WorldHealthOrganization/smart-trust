/**
 * The `ig-publisher-service` role held to its contract,
 * `skills/content/fhir-ig-authoring/ig-publisher-service-contract.md`.
 *
 * Each `describe` quotes one numbered line of "What it must do" and checks it
 * against what this repository declares about the Actor that plays the role:
 * its actor file, the ODRL grant it holds, its two capabilities, and the
 * requirement statement the publisher capability says it satisfies.
 *
 * What cannot run here, and is therefore not claimed: the services
 * themselves. They run in a folio's build, in the image the actor names, not
 * in this repository (the contract's closing paragraph), so a build, a QA
 * report and a validation are held at the level of what the declarations
 * promise and demand.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { readPolicyGrants } from "@litlfred/cat-harness-tools/schemas/content/odrl.ts";

const ROOT = resolve(import.meta.dir, "..");
const HARNESS_ROOT = resolve(ROOT, "..", "cat-harness");
const json = <T = Record<string, unknown>>(rel: string, base: string = ROOT): T =>
  JSON.parse(readFileSync(join(base, rel), "utf-8")) as T;

interface Role { id: string; actorKinds: string[]; skills: string[] }
interface Capability { id: string; detection?: { method: string; command?: string }; requires?: string[]; satisfies?: string[] }
interface Statement { key: string; requirement: string; dependsOn?: string[] }

// declared-path-literal: a contract test whose subject IS these named nodes — the role,
// actor, capabilities and requirement set one external party's contract is made of.
const role = json<{ roles: Role[] }>("scenarios/roles.json").roles.find((r) => r.id === "ig-publisher-service")!;
const actor = json<{ id: string; kind: string; description: string; roles: string[]; capabilities: string[] }>("scenarios/actors/ig-publisher-service.json");
const publisher = json<Capability>("scenarios/capabilities/ig-publisher.json");
const validator = json<Capability>("scenarios/capabilities/fhir-validator.json");
const java = json<Capability>("scenarios/capabilities/java-runtime.json", HARNESS_ROOT);
const statements = json<{ statements: Statement[] }>("skills/requirements/fhir-validation.json").statements;

describe("the role is mechanical, and its contract is a skill it carries", () => {
  test("roleSystemOnlyCarriesContract", () => {
    expect(role.actorKinds).toEqual(["system"]);
    expect(role.skills).toContain("ig-publisher-service-contract");
  });

  test("actorPlaysRoleWithCapabilities", () => {
    expect(actor.kind).toBe("system");
    expect(actor.roles).toContain("ig-publisher-service");
    expect(actor.capabilities).toEqual(expect.arrayContaining(["ig-publisher", "fhir-validator"]));
  });
});

describe("1. build a FHIR Implementation Guide and report its QA", () => {
  test("actorDescriptionSaysBuildAndQa", () => {
    expect(actor.description).toMatch(/FHIR IG Publisher build and QA reporting/);
  });

  test("odrlGrantsQaReporting", () => {
    expect(readPolicyGrants(join(ROOT, "policies")).get("ig-publisher-service")).toContain("qa-reporting");
  });
});

describe("2. complete the IG Publisher build with no errors in qa.html, after SUSHI has compiled the FSH", () => {
  test("publisherSatisfiesQaRequirement", () => {
    expect(publisher.satisfies).toContain("req:fhir-validation#ig-publisher-qa");
  });

  test("qaStatementDemandsNoErrors", () => {
    const s = statements.find((x) => x.key === "ig-publisher-qa")!;
    expect(s.requirement).toMatch(/no errors in qa\.html/);
    expect(s.dependsOn).toEqual(["sushi-compile"]);
    expect(statements.some((x) => x.key === "sushi-compile")).toBe(true);
  });
});

describe("3. validate individual resources and profiles against a package — distinct from a whole-IG build", () => {
  test("validatorIsSeparateCapability", () => {
    expect(validator.id).toBe("fhir-validator");
    expect(validator.id).not.toBe(publisher.id);
    expect(validator.satisfies ?? []).not.toContain("req:fhir-validation#ig-publisher-qa");
  });
});

describe("4. be detectable: `--version` / `-version` on a machine with a Java runtime", () => {
  test("detectedByVersionCommand", () => {
    expect(publisher.detection?.method).toBe("command");
    expect(publisher.detection?.command).toMatch(/^java -jar \S+ --version$/);
    expect(validator.detection?.method).toBe("command");
    expect(validator.detection?.command).toMatch(/^java -jar \S+ -version$/);
  });

  test("bothRequireJavaRuntime", () => {
    expect(publisher.requires).toEqual(["java-runtime"]);
    expect(validator.requires).toEqual(["java-runtime"]);
    expect(java.id).toBe("java-runtime");
  });
});
