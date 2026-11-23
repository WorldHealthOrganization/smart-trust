/**
 * The SDC build checks over a synthetic IG: this layer names no real one.
 * Each library runs for real; nothing reaches a server.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonicalBundle, checkBehaviour, contains, exitCode, sdcChecks, type SdcCheck, type SdcResult } from "./sdc-checks.ts";

const made: string[] = [];
afterAll(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));
const tmp = (p: string) => {
  const d = mkdtempSync(join(tmpdir(), p));
  made.push(d);
  return d;
};
const put = (root: string, rel: string, v: unknown) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), typeof v === "string" ? v : JSON.stringify(v));
};

const SDC = "http://hl7.org/fhir/uv/sdc/StructureDefinition/";
const X = "http://example.org/ig/Questionnaire/";

const obs = {
  resourceType: "Questionnaire", id: "obs", url: X + "obs", status: "draft",
  contained: [{ resourceType: "Observation", id: "wt", status: "final", code: { text: "Weight" },
    valueQuantity: { value: 0, unit: "kg", extension: [{ url: SDC + "sdc-questionnaire-templateExtractValue", valueString: "answer.value" }] } }],
  extension: [{ url: SDC + "sdc-questionnaire-launchContext", extension: [{ url: "name", valueCoding: { system: "http://hl7.org/fhir/uv/sdc/CodeSystem/launchContext", code: "patient" } }, { url: "type", valueCode: "Patient" }] }],
  item: [
    { linkId: "name", type: "string", text: "Name", extension: [{ url: SDC + "sdc-questionnaire-initialExpression", valueExpression: { language: "text/fhirpath", expression: "%patient.name.first().given.first()" } }] },
    { linkId: "weight", type: "decimal", text: "Weight", extension: [{ url: SDC + "sdc-questionnaire-templateExtract", extension: [{ url: "template", valueReference: { reference: "#wt" } }] }] },
  ],
};
const child = { resourceType: "Questionnaire", id: "child", url: X + "child", status: "draft", extension: [{ url: SDC + "sdc-questionnaire-assemble-expectation", valueCode: "assemble-child" }], item: [{ linkId: "c1", type: "string", text: "Child field" }] };
const root = (sub: string) => ({
  resourceType: "Questionnaire", id: "root", url: X + "root", status: "draft",
  extension: [{ url: SDC + "sdc-questionnaire-assemble-expectation", valueCode: "assemble-root" }],
  item: [{ linkId: "g", type: "group", text: "G", item: [{ linkId: "sub", type: "display", text: "sub", extension: [{ url: SDC + "sdc-questionnaire-subQuestionnaire", valueCanonical: sub }] }] }],
});

function ast(qs: object[]): string {
  const dir = tmp("sdc-ast-");
  const resources = (qs as Array<{ id: string; url: string }>).map((q) => {
    const file = `resources/Questionnaire/${q.id}.json`;
    put(dir, file, q);
    return { key: q.url, canonical: q.url, version: null, resourceType: "Questionnaire", id: q.id, file, source: null };
  });
  put(dir, "manifest.json", { $schema: "ig-ast/v1", authority: "cache", provisional: ["indices", "dependencies", "versions"], resources });
  put(dir, "dependencies.json", { $schema: "ig-ast-dependencies/v1", dependencies: [] });
  return dir;
}

const byCheck = (r: SdcResult, c: string): SdcCheck => r.checks.find((x) => x.check === c)!;

describe("assemble", () => {
  test("assembleRootWritesOut", async () => {
    const out = tmp("sdc-out-");
    const [r] = await sdcChecks(ast([root(X + "child"), child]), { ids: ["root"], out });
    expect(byCheck(r!, "assemble")).toMatchObject({ status: "pass", severity: "error" });
    expect(existsSync(join(out, "Questionnaire-root.assembled.json"))).toBe(true);
  });
  test("missingSubformFails", async () => {
    const rs = await sdcChecks(ast([root(X + "absent")]));
    expect(byCheck(rs[0]!, "assemble").status).toBe("fail");
    expect(exitCode(rs)).toBe(1);
  });
  test("nonRootNotApplicable", async () => {
    const [r] = await sdcChecks(ast([child]));
    expect(byCheck(r!, "assemble").status).toBe("not-applicable");
  });
});

describe("template extraction and population, against the IG's fixtures", () => {
  const fixtures = tmp("sdc-fx-");
  put(fixtures, "obs/response.json", { resourceType: "QuestionnaireResponse", status: "completed", questionnaire: X + "obs", item: [{ linkId: "weight", answer: [{ valueDecimal: 70 }] }] });
  put(fixtures, "obs/extract-expected.json", { resourceType: "Bundle", entry: [{ resource: { resourceType: "Observation", code: { text: "Weight" } } }] });
  put(fixtures, "obs/populate-context.json", { patient: { resourceType: "Patient", id: "p", name: [{ given: ["Ada"] }] } });
  put(fixtures, "obs/populate-expected.json", { resourceType: "QuestionnaireResponse", item: [{ linkId: "name", answer: [{ valueString: "Ada" }] }] });

  test("extractPopulatePass", async () => {
    const [r] = await sdcChecks(ast([obs]), { fixtures });
    expect(byCheck(r!, "template-extract").status).toBe("pass");
    expect(byCheck(r!, "populate").status).toBe("pass");
  });
  test("unmetExpectationNamed", async () => {
    const fx = tmp("sdc-fx-");
    put(fx, "obs/response.json", { resourceType: "QuestionnaireResponse", status: "completed", item: [{ linkId: "weight", answer: [{ valueDecimal: 70 }] }] });
    put(fx, "obs/extract-expected.json", [{ resourceType: "Condition" }]);
    put(fx, "obs/populate-context.json", { patient: { resourceType: "Patient", id: "p", name: [{ given: ["Bo"] }] } });
    put(fx, "obs/populate-expected.json", { resourceType: "QuestionnaireResponse", item: [{ linkId: "name", answer: [{ valueString: "Ada" }] }] });
    const [r] = await sdcChecks(ast([obs]), { fixtures: fx });
    expect(byCheck(r!, "template-extract")).toMatchObject({ status: "fail", findings: [expect.stringContaining("expected Condition not extracted")] });
    expect(byCheck(r!, "populate").findings[0]).toContain('item "name"');
  });
  test("noFixtureSaid", async () => {
    const [r] = await sdcChecks(ast([obs]));
    expect(byCheck(r!, "template-extract").status).toBe("no-fixture");
    expect(byCheck(r!, "populate").status).toBe("no-fixture");
  });
});

describe("behavioural tests are warn-only", () => {
  test("noTestFileWarns", () => {
    expect(checkBehaviour(undefined)).toMatchObject({ status: "no-fixture", severity: "warning" });
  });
  test("failingBehaviourNeverFails", async () => {
    const fx = tmp("sdc-fx-");
    put(fx, "child/behaviour.test.tsx", "test('x', () => {})");
    const [r] = await sdcChecks(ast([child]), { fixtures: fx });
    const b = byCheck(r!, "behaviour");
    // The toolkit is looked for on disk, never auto-installed.
    expect(b).toMatchObject({ status: "could-not-determine", severity: "warning" });
    expect(exitCode([{ questionnaire: "x", checks: [b] }])).toBe(0);
  });
  test("toolkitRunNoInstall", () => {
    const fx = tmp("sdc-fx-");
    put(fx, "node_modules/@aehrc/questionnaire-test-toolkit/package.json", { name: "@aehrc/questionnaire-test-toolkit" });
    put(fx, "q/behaviour.test.tsx", "test('x', () => {})");
    let argv: string[] = [];
    const b = checkBehaviour(join(fx, "q"), ((_cmd: string, args: string[]) => {
      argv = args;
      return { status: 1, stdout: "1 fail", stderr: "" };
    }) as never);
    expect(argv.slice(0, 2)).toEqual(["--no-install", "test"]);
    expect(b).toMatchObject({ status: "fail", severity: "warning", findings: ["1 fail"] });
    expect(exitCode([{ questionnaire: "q", checks: [b] }])).toBe(0);
  });
});

test("containsAndCanonicalBundle", () => {
  expect(contains({ a: 1, b: [{ c: 2 }, { d: 3 }] }, { b: [{ d: 3 }] })).toBe(true);
  expect(contains({ a: 1 }, { a: 2 })).toBe(false);
  expect(canonicalBundle(new Map([["k", { url: "u", version: "1" }]]), "u&version=2").entry).toEqual([]);
});
