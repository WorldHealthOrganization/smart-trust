/**
 * Source-level dependency cones over an FSH tank.
 *
 * The behaviour worth pinning is the *direction* of each edge and what counts
 * as one. A cone that is too small is the dangerous failure — it tells an
 * incremental build it may skip something it must rebuild — so every edge form
 * the parser claims to recognise gets one fixture that exercises it, and the
 * expected cones are written out by hand rather than read back from the tool.
 *
 * The fixture is a tiny tank: a profile chain bound to a value set backed by a
 * local code system, an example instance of the derived profile, a
 * PlanDefinition that inserts a RuleSet and points at a Library whose CQL
 * includes a common library, plus an invariant the base profile obeys.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  backwardCone,
  buildFshGraph,
  changeImpact,
  coneSizes,
  filesOf,
  fileUsers,
  forwardCone,
  historyImpact,
  historyReport,
  report,
  toCsv,
  type FshGraph,
} from "./fsh-cone";

const ROOT = mkdtempSync(join(tmpdir(), "fsh-cone-"));
let g: FshGraph;

function put(rel: string, body: string): void {
  const p = join(ROOT, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, body);
}

beforeAll(() => {
  put("sushi-config.yaml", "id: example.tank\ncanonical: http://example.org/tank\n");
  put("input/fsh/aliases.fsh", "Alias: $SCT = http://snomed.info/sct\nAlias: $LOCAL = http://example.org/tank/CodeSystem/local-cs\n");
  put(
    "input/fsh/profiles/PersonA.fsh",
    [
      "Profile: PersonA",
      "Parent: Patient", // external base — must NOT become an edge
      "Id: person-a",
      "* name 1..1",
      "* gender from GenderVS (required)",
      "* obeys inv-1, inv-2",
      "",
    ].join("\n"),
  );
  put("input/fsh/profiles/PersonB.fsh", "Profile: PersonB\nParent: PersonA\nId: person-b\n* birthDate 1..1\n");
  put("input/fsh/valuesets/GenderVS.fsh", "ValueSet: GenderVS\nId: gender-vs\n* include codes from system LocalCS\n* $SCT#248153007 \"Male\"\n");
  put("input/fsh/codesystems/LocalCS.fsh", "CodeSystem: LocalCS\nId: local-cs\n* #m \"Male\"\n* #f \"Female\"\n");
  put("input/fsh/invariants/inv.fsh", "Invariant: inv-1\nDescription: \"has a name\"\nExpression: \"name.exists()\"\nSeverity: #error\n\nInvariant: inv-2\nDescription: \"x\"\nExpression: \"true\"\nSeverity: #warning\n");
  put("input/fsh/examples/ExPerson.fsh", "Instance: ExPerson\nInstanceOf: PersonB\nUsage: #example\n* name.given = \"Q\"\n* maritalStatus = $LOCAL#m\n");
  put("input/fsh/rulesets/CommonMeta.fsh", "RuleSet: CommonMeta\n* ^status = #active\n");
  // A PARAMETERISED RuleSet whose body carries the canonical — the shape every
  // PlanDefinition and Measure in an ingested IG uses (bean `f4gj`), and the one a
  // literal read of the body cannot resolve (`{library}Logic` names nothing).
  // `PlanDefOuter` forwards its parameter to `PlanDefInner`, so this also
  // exercises the nested case (measured max depth 2 in the real IG).
  put(
    "input/fsh/rulesets/PlanDefMeta.fsh",
    "RuleSet: PlanDefInner( library )\n* library = Canonical({library}Logic)\n\n"
    + "RuleSet: PlanDefOuter( library, version )\n* insert PlanDefInner( {library} )\n* version = \"{version}\"\n",
  );
  put("input/fsh/libraries/LibXLogic.fsh", "Instance: LibXLogic\nInstanceOf: Library\n* insert CommonMeta\n");
  put("input/cql/LibXLogic.cql", "library LibXLogic version '1.0.0'\n");
  // Its argument list spans lines, which a line-by-line scan cannot parse.
  put(
    "input/fsh/plandefinitions/PlanY.fsh",
    "Instance: PlanY\nInstanceOf: PlanDefinition\n* insert PlanDefOuter( LibX,\n  0.1.0 )\n",
  );
  put(
    "input/fsh/plandefinitions/PlanX.fsh",
    "Instance: PlanX\nInstanceOf: PlanDefinition\n* insert CommonMeta\n* library = Canonical(LibX)\n* action[0].definitionCanonical = \"http://example.org/tank/ActivityDefinition/act-1\"\n",
  );
  put("input/fsh/activitydefinitions/Act1.fsh", "Instance: Act1\nInstanceOf: ActivityDefinition\nId: act-1\n* subjectReference = Reference(ExPerson)\n");
  put("input/fsh/libraries/LibX.fsh", "Instance: LibX\nInstanceOf: Library\nId: LibX\n* type = http://terminology.hl7.org/CodeSystem/library-type#logic-library\n");
  // The SAME library shape with NO `Id:` line — SUSHI defaults the id to the
  // instance NAME. This is how every Library in an ingested IG is written
  // (279 of 279), and it was the shape no fixture had: the edge kind was dead
  // on real IGs while this suite stayed green (bean `f4gj`).
  put("input/fsh/libraries/LibY.fsh", "Instance: LibY\nInstanceOf: Library\n* insert CommonMeta\n");
  put("input/cql/LibY.cql", "library LibY version '1.0.0'\nusing FHIR version '4.0.1'\ninclude Common version '1.0.0' called C\n");
  put("input/cql/LibX.cql", "library LibX version '1.0.0'\nusing FHIR version '4.0.1'\ninclude Common version '1.0.0' called C\ninclude FHIRHelpers version '4.0.1'\n");
  put("input/cql/Common.cql", "library Common version '1.0.0'\nusing FHIR version '4.0.1'\n");
  g = buildFshGraph(ROOT);
});

afterAll(() => {
  try {
    rmSync(ROOT, { recursive: true, force: true });
  } catch {
    // best effort
  }
});

describe("graph construction", () => {
  test("everyDeclarationIsNode", () => {
    const names = [...g.nodes.keys()].sort();
    expect(names).toEqual(
      [
        "Act1", "CommonMeta", "ExPerson", "GenderVS", "LibX", "LibXLogic", "LibY", "LocalCS", "PersonA",
        "PersonB", "PlanDefInner", "PlanDefOuter", "PlanX", "PlanY",
        "cql:Common", "cql:LibX", "cql:LibXLogic", "cql:LibY", "inv-1", "inv-2",
      ].sort(),
    );
    expect(g.nodes.has("cql:FHIRHelpers")).toBe(false);
    expect(g.fshFiles).toBe(15);
    expect(g.cqlFiles).toBe(4);
    expect(g.canonical).toBe("http://example.org/tank");
  });

  test("edgeFormsPointUserToUsed", () => {
    const deps = (n: string) => [...g.nodes.get(n)!.deps].sort();
    expect(deps("PersonB")).toEqual(["PersonA"]); // Parent:
    expect(deps("PersonA")).toEqual(["GenderVS", "inv-1", "inv-2"]); // from, obeys a, b — not Patient
    expect(deps("GenderVS")).toEqual(["LocalCS"]); // include codes from system
    expect(deps("ExPerson")).toEqual(["LocalCS", "PersonB"]); // InstanceOf, $alias#code via URL alias
    expect(deps("PlanX")).toEqual(["Act1", "CommonMeta", "LibX"]); // canonical assignment (URL), insert, Canonical()
    expect(deps("Act1")).toEqual(["ExPerson"]); // Reference()
    expect(deps("LibX")).toEqual(["cql:LibX"]); // Library ↔ cql by name, via `Id:`
    // The parameterised canonical, through TWO levels and a multi-line argument
    // list: `insert PlanDefOuter(LibX, 0.1.0)` forwards `{library}` to
    // `PlanDefInner`, whose `Canonical({library}Logic)` becomes `LibXLogic`.
    expect(deps("PlanY")).toEqual(["LibXLogic", "PlanDefOuter"]);
    // ...and the RuleSets themselves gain NO such edge. `{library}Logic` names
    // nothing until a call site supplies the argument, and attributing the
    // artefact's dependency to the template is the defect this fixes.
    expect(deps("PlanDefInner")).toEqual([]);
    expect(deps("PlanDefOuter")).toEqual(["PlanDefInner"]);
    // ...and via SUSHI's name→id default, which is the case real IGs use.
    expect(deps("LibY")).toEqual(["CommonMeta", "cql:LibY"]);
    expect(deps("cql:LibX")).toEqual(["cql:Common"]); // cql include
    expect(deps("cql:Common")).toEqual([]);
    expect(deps("LocalCS")).toEqual([]);
  });
});

describe("cones", () => {
  test("codeSystemForwardCone", () => {
    // LocalCS ← GenderVS ← PersonA ← PersonB ← ExPerson ← Act1 ← PlanX ; and ExPerson directly
    expect([...forwardCone(g, "LocalCS")].sort()).toEqual(["Act1", "ExPerson", "GenderVS", "PersonA", "PersonB", "PlanX"]);
  });

  test("sharedCqlHubCone", () => {
    expect([...forwardCone(g, "cql:Common")].sort()).toEqual(["LibX", "LibY", "PlanX", "cql:LibX", "cql:LibY"]);
  });

  test("ruleSetInvalidatesUsers", () => {
    // PlanY is in here only because of the expanded parameter: CommonMeta ←
    // LibXLogic ← PlanY, and that last hop exists only once
    // `Canonical({library}Logic)` has been resolved against the call site.
    expect([...forwardCone(g, "CommonMeta")].sort()).toEqual(["LibXLogic", "LibY", "PlanX", "PlanY"]);
  });

  test("leafEmptyRootExcluded", () => {
    expect(forwardCone(g, "PlanX").size).toBe(0);
    expect(forwardCone(g, "LocalCS").has("LocalCS")).toBe(false);
  });

  test("backwardConeInFiles", () => {
    const b = backwardCone(g, "ExPerson");
    expect([...b].sort()).toEqual(["GenderVS", "LocalCS", "PersonA", "PersonB", "inv-1", "inv-2"]);
    const files = filesOf(g, ["ExPerson", ...b]);
    expect([...files].sort()).toEqual([
      "input/fsh/codesystems/LocalCS.fsh",
      "input/fsh/examples/ExPerson.fsh",
      "input/fsh/invariants/inv.fsh",
      "input/fsh/profiles/PersonA.fsh",
      "input/fsh/profiles/PersonB.fsh",
      "input/fsh/valuesets/GenderVS.fsh",
    ]);
    // two invariants share one file, so the file count is one less than the node count + 1
    expect(coneSizes(g).backwardFiles.get("ExPerson")).toBe(6);
  });

  test("coneSizesAgree", () => {
    const s = coneSizes(g);
    expect(s.forward.get("LocalCS")).toBe(6);
    expect(s.backward.get("ExPerson")).toBe(6);
    expect(s.forward.get("PlanX")).toBe(0);
    expect(s.backward.get("cql:Common")).toBe(0);
  });
});

describe("change impact — the incremental-build question", () => {
  test("editingValueSetImpact", () => {
    const impact = changeImpact(g, ["input/fsh/valuesets/GenderVS.fsh"]);
    expect([...impact.changed]).toEqual(["GenderVS"]);
    expect([...impact.rebuild].sort()).toEqual(["Act1", "ExPerson", "GenderVS", "PersonA", "PersonB", "PlanX"]);
    // the checkout must compile every rebuilt node: their files plus their dependencies' files
    expect([...impact.checkout].sort()).toEqual([
      "input/cql/Common.cql",
      "input/cql/LibX.cql",
      "input/fsh/activitydefinitions/Act1.fsh",
      "input/fsh/codesystems/LocalCS.fsh",
      "input/fsh/examples/ExPerson.fsh",
      "input/fsh/invariants/inv.fsh",
      "input/fsh/libraries/LibX.fsh",
      "input/fsh/plandefinitions/PlanX.fsh",
      "input/fsh/profiles/PersonA.fsh",
      "input/fsh/profiles/PersonB.fsh",
      "input/fsh/rulesets/CommonMeta.fsh",
      "input/fsh/valuesets/GenderVS.fsh",
    ]);
  });

  test("editingLeafRebuildsItself", () => {
    const impact = changeImpact(g, [join(ROOT, "input/fsh/plandefinitions/PlanX.fsh")]);
    expect([...impact.rebuild]).toEqual(["PlanX"]);
  });

  test("declaringNothingChangesNothing", () => {
    const impact = changeImpact(g, ["input/fsh/aliases.fsh"]);
    expect(impact.changed.size).toBe(0);
    expect(impact.rebuild.size).toBe(0);
  });
});

describe("reports", () => {
  test("reportHeadlinesAndCsv", () => {
    const r = report(g, 3);
    // two invariants share one file, so 20 nodes live in 18 files
    expect(r).toContain("nodes: 20 in 18 source files (15 .fsh, 4 .cql)");
    // the expanded-parameter edge is tallied under its own name, never folded
    // into plain `insert` — the two claims have different standing
    expect(r).toContain("insert (parameter expanded)");
    // Every Library instance reaches its CQL body — the one declaring `Id:` and
    // the two relying on SUSHI's name→id default (bean `f4gj`).
    expect(r).toContain("3  Library ↔ cql (by name)");
    expect(r).toContain("FORWARD cone");
    expect(r).toContain("LocalCS"); // the hub of this fixture heads the forward-cone table
    expect(r).toContain("cql include"); // and every edge form the fixture exercises is tallied
    expect(r).toContain("canonical assignment");
    const csv = toCsv(g).trim().split("\n");
    expect(csv[0]).toBe("name,kind,file,forward,backward,backward_files");
    expect(csv.length).toBe(1 + g.nodes.size);
  });

  test("historyScoresCommits", () => {
    // Runs last: it turns the fixture into a git repository and edits a file. The
    // graph `g` was built before and is not affected.
    const git = (args: string) => execSync(`git -c user.name=t -c user.email=t@example.org ${args}`, { cwd: ROOT, stdio: "ignore" });
    git("init -q");
    git("add -A");
    git("commit -q -m init");
    writeFileSync(join(ROOT, "input/fsh/valuesets/GenderVS.fsh"), "ValueSet: GenderVS\nId: gender-vs\n* include codes from system LocalCS\n");
    writeFileSync(join(ROOT, "input/fsh/rulesets/CommonMeta.fsh"), "RuleSet: CommonMeta\n* ^status = #draft\n");
    git("add -A");
    git("commit -q -m 'edit the value set and the ruleset'");
    writeFileSync(join(ROOT, "sushi-config.yaml"), "id: example.tank\ncanonical: http://example.org/tank\nversion: 0.2.0\n");
    git("add -A");
    git("commit -q -m 'bump version — touches no source file'");

    const rows = historyImpact(g, 10);
    // the root commit has no parent and the version bump touches no source file
    expect(rows.length).toBe(1);
    expect(rows[0].sourceFiles).toBe(2);
    expect(rows[0].changed).toBe(2); // GenderVS, CommonMeta
    // GenderVS ← PersonA ← PersonB ← ExPerson ← Act1 ← PlanX ; CommonMeta ← PlanX, LibY, LibXLogic
    expect(rows[0].rebuild).toBe(10);
    const text = historyReport(g, rows, 3);
    expect(text).toContain("commits touching input/fsh or input/cql: 1 of 3 inspected");
    expect(text).toContain("rebuild per commit (nodes, incl. changed): median 10");
    expect(text).toContain("zero-rebuild commits");
  });

  test("emptyTankDeterminedEmpty", () => {
    const empty = mkdtempSync(join(tmpdir(), "fsh-cone-empty-"));
    try {
      const eg = buildFshGraph(empty);
      expect(eg.nodes.size).toBe(0);
      expect(report(eg)).toContain("nodes: 0");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("file-level users, for the IG AST's incremental plan (bean a9tx)", () => {
  test("ruleSetFileNamesUsers", () => {
    const u = fileUsers(g);
    expect(u["input/fsh/rulesets/CommonMeta.fsh"]).toEqual([
      "input/fsh/libraries/LibXLogic.fsh",
      "input/fsh/libraries/LibY.fsh",
      "input/fsh/plandefinitions/PlanX.fsh",
    ]);
    // PlanDefOuter inserts PlanDefInner in the SAME file: that is not a user.
    expect(u["input/fsh/rulesets/PlanDefMeta.fsh"]).toEqual(["input/fsh/plandefinitions/PlanY.fsh"]);
  });

  test("unusedFileHasNoEntry", () => {
    expect(fileUsers(g)["input/fsh/plandefinitions/PlanY.fsh"]).toBeUndefined();
    // ...and a reference counts as use: Act1 names ExPerson.
    expect(fileUsers(g)["input/fsh/examples/ExPerson.fsh"]).toEqual(["input/fsh/activitydefinitions/Act1.fsh"]);
  });

  test("aliasFileNamesUsers", () => {
    // aliases.fsh declares $SCT (used by GenderVS in a code) and $LOCAL (used by ExPerson).
    expect(fileUsers(g)["input/fsh/aliases.fsh"]).toEqual([
      "input/fsh/examples/ExPerson.fsh",
      "input/fsh/valuesets/GenderVS.fsh",
    ]);
  });
});

describe("Title and Description are prose, not rules (bean c65n)", () => {
  // Shaped like a value set measured on an ingested IG, whose Description says
  // "ValueSet <NAME> for …" and so made the value set a dependent of the
  // PlanDefinition it is only named after.
  const T = mkdtempSync(join(tmpdir(), "fsh-cone-prose-"));
  let pg: FshGraph;
  beforeAll(() => {
    const w = (rel: string, body: string) => {
      mkdirSync(join(T, rel, ".."), { recursive: true });
      writeFileSync(join(T, rel), body);
    };
    w("sushi-config.yaml", "id: prose.tank\ncanonical: http://example.org/prose\n");
    w("input/fsh/Sched.fsh", "Instance: Sched\nInstanceOf: PlanDefinition\nUsage: #definition\n* status = #active\n");
    w("input/fsh/Other.fsh", "ValueSet: OtherVS\n* include codes from system http://loinc.org\n");
    w(
      "input/fsh/SchedVS.fsh",
      [
        "ValueSet: SchedVS",
        'Title: "SchedVS — see ValueSet Sched"',
        'Description: """',
        "ValueSet Sched for the schedule table.",
        "Codes from system Sched, valueset Sched.",
        '"""',
        // A real rule AFTER the multi-line value must still be read.
        "* include codes from valueset OtherVS",
        "",
      ].join("\n"),
    );
    w("input/fsh/OneLine.fsh", 'ValueSet: OneLineVS\nDescription: "ValueSet Sched, on one line"\n');
    pg = buildFshGraph(T);
  });
  afterAll(() => rmSync(T, { recursive: true, force: true }));

  test("proseIsNotARule", () => {
    expect([...forwardCone(pg, ["Sched"])]).toEqual([]);
    expect([...pg.nodes.get("SchedVS")!.deps]).toEqual(["OtherVS"]);
    expect([...pg.nodes.get("OneLineVS")!.deps]).toEqual([]);
  });
});
