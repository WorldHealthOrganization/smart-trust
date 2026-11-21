/**
 * The FHIR IG renderer's rendered impact (bean `bnjs`), on a small IG whose
 * expected pages are written out by hand. The real-IG acceptance case
 * (smart-immunizations, bean `c65n`) is recorded in the bean: predicted 4,
 * measured 3, 0 missed, the 1 unconfirmed being the artefact page that loads
 * its resource in the browser.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { reviewList } from "@litlfred/cat-harness-tools/schemas/ui/rendered-impact";
import { igRenderedImpact } from "./ig-rendered-impact";

const IG = mkdtempSync(join(tmpdir(), "ig-impact-"));
afterAll(() => rmSync(IG, { recursive: true, force: true }));
const put = (rel: string, body: string) => {
  mkdirSync(dirname(join(IG, rel)), { recursive: true });
  writeFileSync(join(IG, rel), body);
};

put("sushi-config.yaml", "id: ex\ncanonical: http://example.org/ig\n");
put("input/fsh/aliases.fsh", "Alias: $LOINC = http://loinc.org\n");
put("input/fsh/rules.fsh", "RuleSet: Meta\n* status = #active\n");
put("input/fsh/vs.fsh", "ValueSet: DueVS\nId: due-vs\n* insert Meta\n* include codes from system $LOINC\n");
put("input/fsh/plan.fsh", "Instance: Sched\nInstanceOf: PlanDefinition\nUsage: #definition\n* action.definitionCanonical = Canonical(DueVS)\n");
put("input/fsh/other.fsh", "Instance: Lone\nInstanceOf: PlanDefinition\nUsage: #definition\n* status = #draft\n");
put("input/pagecontent/logic.md", "logic\n");
put("input/pagecontent/index.md", "home {% include logic.md %}\n");
put("fsh-generated/data/fsh-index.json", JSON.stringify([
  { outputFile: "ValueSet-due-vs.json", fshName: "DueVS", fshType: "ValueSet", fshFile: "vs.fsh" },
  { outputFile: "PlanDefinition-Sched.json", fshName: "Sched", fshType: "Instance", fshFile: "plan.fsh" },
  { outputFile: "PlanDefinition-Lone.json", fshName: "Lone", fshType: "Instance", fshFile: "other.fsh" },
]));

const paths = (changed: string[], opts: Record<string, string> = {}) =>
  igRenderedImpact({ ig: IG, changed, ...opts }).files.map((f) => `${f.role}:${f.path}`);

describe("igRenderedImpact — FSH through the cone to the AST pages", () => {
  test("valueSetReachesPagesAndIndexes", () => {
    expect(paths(["input/fsh/vs.fsh"])).toEqual([
      "data:ast-data/resources/PlanDefinition-Sched.json",
      "data:ast-data/resources/ValueSet-due-vs.json",
      "content:ast/artifact/PlanDefinition-Sched.html",
      "content:ast/artifact/ValueSet-due-vs.html",
      "index:ast/index.html",
      "index:assets/js/search-data.json",
    ].sort((a, b) => a.split(":")[1].localeCompare(b.split(":")[1])));
  });

  test("leafAndRuleSetAliasReach", () => {
    expect(paths(["input/fsh/other.fsh"]).filter((p) => p.startsWith("content:"))).toEqual(["content:ast/artifact/PlanDefinition-Lone.html"]);
    expect(paths(["input/fsh/rules.fsh"]).filter((p) => p.startsWith("content:"))).toContain("content:ast/artifact/ValueSet-due-vs.html");
    expect(paths(["input/fsh/aliases.fsh"]).filter((p) => p.startsWith("content:"))).toContain("content:ast/artifact/ValueSet-due-vs.html");
  });

  test("fileSaysHowReached", () => {
    const f = igRenderedImpact({ ig: IG, changed: ["input/fsh/vs.fsh"] }).files.find((x) => x.path === "ast/artifact/PlanDefinition-Sched.html")!;
    expect(f.via).toEqual(["input/fsh/plan.fsh", "Sched", "PlanDefinition/Sched"]);
  });

  test("prefixesPlacePages", () => {
    expect(paths(["input/fsh/other.fsh"], { sitePrefix: "ex" })).toContain("content:ex/ast/artifact/PlanDefinition-Lone.html");
  });

  test("noSushiIndexUndetermined", () => {
    const i = igRenderedImpact({ ig: IG, changed: ["input/fsh/vs.fsh"], fshIndex: join(IG, "missing.json") });
    expect(i.files).toEqual([]);
    expect(i.undetermined[0]).toMatchObject({ input: "input/fsh/vs.fsh", scope: "unknown" });
  });
});

describe("igRenderedImpact — pages and site-wide inputs", () => {
  test("pageChangeReachesIncluders", () => {
    expect(paths(["input/pagecontent/logic.md"])).toEqual(["index:assets/js/search-data.json", "content:index.html", "content:logic.html"]);
  });

  test("siteWideAndUnmappedListed", () => {
    const i = igRenderedImpact({ ig: IG, changed: ["sushi-config.yaml", "input/images/x.png"] });
    expect(i.files).toEqual([]);
    expect(i.undetermined.map((u) => [u.input, u.scope])).toEqual([["sushi-config.yaml", "all"], ["input/images/x.png", "unknown"]]);
  });

  test("reviewListWithoutIndexes", () => {
    expect(reviewList(igRenderedImpact({ ig: IG, changed: ["input/pagecontent/logic.md"] })).map((f) => f.path)).toEqual(["index.html", "logic.html"]);
  });
});
