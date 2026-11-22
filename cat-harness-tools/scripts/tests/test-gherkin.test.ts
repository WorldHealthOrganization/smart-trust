/**
 * The scanner behind `check:test-gherkin` and `test-has-gherkin`. Each test
 * here is named by a Scenario in `scripts/tests/features/test-gherkin.feature`
 * — the rule this module enforces, applied to itself.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  JS_ADAPTER,
  itbResolver,
  withoutXmlComments,
  KOTLIN_ADAPTER,
  PYTHON_ADAPTER,
  RUST_ADAPTER,
  joinTestsToScenarios,
  parseFeature,
  scanTree,
  unescapeJsString,
} from "../lib/test-gherkin";
import { auditTestGherkin } from "../test-plan-audit";
import { TEST_PLAN_SCHEMA_ID, TEST_PLAN_SCHEMA_ID_V1 } from "../../schemas/sdlc/test-plan";

const names = (ts: { name: string }[]) => ts.map((t) => t.name);

describe("language adapters", () => {
  test("rust: #[test] functions are named through their mod scopes", () => {
    const src = [
      "// #[test] fn in_a_comment() {}",
      'const S: &str = "#[test] fn in_a_string() {}";',
      "fn helper<'a>(x: &'a str) -> char { '{' }",
      "#[test]",
      "fn top_level() {}",
      "#[cfg(test)]",
      "mod tests {",
      "    use super::*;",
      "    #[tokio::test]",
      "    async fn async_one() {}",
      "    #[test]",
      "    #[should_panic]",
      "    fn panics() {}",
      "    mod inner { #[test] fn deep() {} }",
      "}",
      "#[test_case(1)]",
      "fn cased(n: u8) {}",
    ].join("\n");
    expect(names(RUST_ADAPTER.findTests("src/x.rs", src))).toEqual([
      "src/x.rs::top_level",
      "src/x.rs::tests::async_one",
      "src/x.rs::tests::panics",
      "src/x.rs::tests::inner::deep",
      "src/x.rs::cased",
    ]);
  });

  test("kotlin: @Test functions are named through their classes, backtick names normalised", () => {
    const src = [
      "class QrTest {",
      "    @Test fun decodes() {}",
      "    @Test",
      "    fun `reads a QR code`() { val s = \"}\" }",
      "    @Nested inner class Errors {",
      "        @ParameterizedTest @ValueSource(ints = [1]) fun rejects(n: Int) {}",
      "    }",
      "    fun notATest() {}",
      "}",
    ].join("\n");
    expect(names(KOTLIN_ADAPTER.findTests("app/QrTest.kt", src))).toEqual([
      "app/QrTest.kt::QrTest::decodes",
      "app/QrTest.kt::QrTest::reads_a_QR_code",
      "app/QrTest.kt::QrTest::Errors::rejects",
    ]);
  });

  test("kotlin: a quote inside a backtick name is part of the name, and the class scope survives it", () => {
    const src = [
      "class VectorsTest {",
      "    @Test fun `the vector's kid is the DSC's`() { val c = '{' }",
      "    @Test fun `the guide's DSC`() {}",
      "    @Test fun plain() {}",
      "}",
    ].join("\n");
    expect(names(KOTLIN_ADAPTER.findTests("app/VectorsTest.kt", src))).toEqual([
      "app/VectorsTest.kt::VectorsTest::the_vector's_kid_is_the_DSC's",
      "app/VectorsTest.kt::VectorsTest::the_guide's_DSC",
      "app/VectorsTest.kt::VectorsTest::plain",
    ]);
  });

  test("js: a file that declares @test-runner is read, and each call of its runner is a test", () => {
    const root = mkdtempSync(join(tmpdir(), "test-gherkin-runner-"));
    const suite = [
      "// @test-runner run",
      "export function runSuite(h) {",
      "  const run = (name, body) => body();",
      '  run("decodes the vector", () => true);',
      "  for (const k of keys) run(`cross[${k}]`, () => true);",
      "}",
    ].join("\n");
    writeFileSync(join(root, "suite.ts"), suite);
    writeFileSync(join(root, "helper.ts"), 'const run = (n) => n;\nrun("not a test");\n');
    expect(names(scanTree(root).tests)).toEqual(["suite.ts::decodes_the_vector", "suite.ts::cross[${k}]"]);
  });

  test("js: test() and it() are named through describe() titles, whitespace as _", () => {
    const src = [
      'import { describe, test } from "bun:test";',
      'describe("loader", () => {',
      '  test("reads a plan", () => { const s = "test(\\"no\\")"; });',
      '  describe("errors", () => {',
      '    it.skip("refuses junk", () => {});',
      '  });',
      '  test.each([1, 2])("each %d", (n) => {});',
      '});',
      'test(`top level`, () => {});',
      '// test("commented out", () => {});',
    ].join("\n");
    expect(names(JS_ADAPTER.findTests("scripts/loader.test.ts", src))).toEqual([
      "scripts/loader.test.ts::loader::reads_a_plan",
      "scripts/loader.test.ts::loader::errors::refuses_junk",
      "scripts/loader.test.ts::loader::each_%d",
      "scripts/loader.test.ts::top_level",
    ]);
    expect(JS_ADAPTER.matches("a/b.test.ts")).toBe(true);
    expect(JS_ADAPTER.matches("a/b.ts")).toBe(false);
  });

  test("js: a regex literal holding a quote or backtick opens no string", () => {
    const src = [
      "const name = (r: string) => /`([^`]+)`/.exec(r)![1];",
      "const spec = /from\\s*[\"']([^\"']+)[\"']/g;",
      'describe("after the regexes", () => {',
      '  test("first", () => {});',
      "});",
      "const mounted = true;",
      'describe.skipIf(!mounted)("a skipIf scope", () => {',
      '  test("second", () => {});',
      "});",
    ].join("\n");
    expect(names(JS_ADAPTER.findTests("r.test.ts", src))).toEqual([
      "r.test.ts::after_the_regexes::first",
      "r.test.ts::a_skipIf_scope::second",
    ]);
  });

  test("js: a regex literal inside a template's ${} hides no test, even ending in an escaped slash", () => {
    // `\//` closing the regex once read as a `//` comment, which swallowed the
    // `}` and the closing backtick: every test after it vanished, unreported.
    // A division inside ${} stays a division.
    const src = [
      "const urlFor = (r: string) => `file://${repos[r.replace(/^test\\//, \"\")]}`;",
      "const half = (n: number) => `${n / 2} of ${n / 1}`;",
      'describe("after the template", () => {',
      '  test("first", () => {});',
      '  test("second", () => {});',
      "});",
    ].join("\n");
    expect(names(JS_ADAPTER.findTests("r.test.ts", src))).toEqual([
      "r.test.ts::after_the_template::first",
      "r.test.ts::after_the_template::second",
    ]);
  });

  test("js: a template nested in a template's ${} does not close it; id[${key}] is a fixed name", () => {
    const src = [
      "const conn = (label: string) => `<g>${label ? `<text>${label}</text>` : \"\"}</g>`;",
      'describe("after a nested template", () => {',
      '  test("found", () => {});',
      "});",
      'describe("a second top-level scope", () => {',
      "  test(`looped[${key}]`, () => {});",
      "  describe(key, () => { test(`inLoop[${key}]`, () => {}); test(`case ${key}`, () => {}); });",
      "});",
    ].join("\n");
    const found = JS_ADAPTER.findTests("t.test.ts", src);
    expect(found.map((t) => [t.name, t.dynamic ?? false])).toEqual([
      ["t.test.ts::after_a_nested_template::found", false],
      ["t.test.ts::a_second_top-level_scope::looped[${key}]", false],
      ["t.test.ts::a_second_top-level_scope::inLoop[${key}]", false],
      ["t.test.ts::a_second_top-level_scope::<computed>::<computed_at_line_7>", true],
    ]);
  });

  test("js: a block comment mentioning a /* glob still closes", () => {
    const src = ["/** loads `schemas/**` and `x/*.ts` */", 'test("after the comment", () => {});'].join("\n");
    expect(names(JS_ADAPTER.findTests("c.test.ts", src))).toEqual(["c.test.ts::after_the_comment"]);
  });

  test("js: a division is not read as a regex literal", () => {
    const src = ["const half = total / 2; const q = a / b / c;", 'test("after division", () => {});'].join("\n");
    expect(names(JS_ADAPTER.findTests("d.test.ts", src))).toEqual(["d.test.ts::after_division"]);
  });

  test("js: modifiers with their own arguments chain before the title call", () => {
    const src = [
      'test.skipIf(cond).each([1, 2])("skip-if each %d", (n) => {});',
      'test.if(cond).each([1])("if each %d", () => {});',
      'it.skip.each([1])("skip each %d", () => {});',
      'test.skipIf(cond)("plain skip-if", () => {});',
      'describe.skipIf(cond)("scope", () => { test("inner", () => {}); });',
      'const t = test.each; t([1])("not a head", () => {});',
    ].join("\n");
    expect(names(JS_ADAPTER.findTests("c.test.ts", src))).toEqual([
      "c.test.ts::skip-if_each_%d",
      "c.test.ts::if_each_%d",
      "c.test.ts::skip_each_%d",
      "c.test.ts::plain_skip-if",
      "c.test.ts::scope::inner",
    ]);
  });

  test("js: a test with a computed title is found and reported, never dropped", () => {
    const src = [
      'for (const [name] of cases) {',
      '  test(name, () => {});',
      '  test(`case ${name}`, () => {});',
      '}',
      'describe(label, () => { test("inside", () => {}); });',
      'test(`fixed template`, () => {});',
    ].join("\n");
    const found = JS_ADAPTER.findTests("t.test.ts", src);
    expect(found.map((t) => [t.name, t.dynamic ?? false])).toEqual([
      ["t.test.ts::<computed_at_line_2>", true],
      ["t.test.ts::<computed_at_line_3>", true],
      ["t.test.ts::<computed>::inside", true],
      ["t.test.ts::fixed_template", false],
    ]);
    const r = joinTestsToScenarios(found, []);
    expect(r.findings.filter((f) => f.kind === "test-name-not-static").map((f) => f.line)).toEqual([2, 3, 5]);
    expect(r.findings.filter((f) => f.kind === "test-without-scenario").map((f) => f.test)).toEqual(["t.test.ts::fixed_template"]);
  });

  test("python: the name is pytest's node id", () => {
    const src = [
      "def helper():",
      "    def test_nested():",
      "        pass",
      "def test_load():",
      '    """',
      "    def test_in_docstring(): ...",
      '    """',
      "class TestPlan:",
      "    def test_parse(self):",
      "        pass",
      "class Helper:",
      "    def test_not_collected(self):",
      "        pass",
      "async def test_async():",
      "    pass",
    ].join("\n");
    expect(names(PYTHON_ADAPTER.findTests("tests/test_plan.py", src))).toEqual([
      "tests/test_plan.py::test_load",
      "tests/test_plan.py::TestPlan::test_parse",
      "tests/test_plan.py::test_async",
    ]);
  });
});

describe("feature files", () => {
  test("a Scenario's @test: tags are its links; Examples tags and doc strings are not", () => {
    const f = parseFeature(
      "f.feature",
      [
        "Feature: plans",
        "  @test:a.rs::one @test:b.rs::two @smoke",
        "  Scenario: two tests, one behaviour",
        "    Given a plan",
        '    """',
        "    @test:not.rs::a_tag",
        '    """',
        "  @manual",
        "  Scenario Outline: by hand",
        "    @test:c.rs::row",
        "    Examples:",
        "      | x |",
      ].join("\n"),
    );
    expect(f.scenarios.map((s) => [s.title, s.tests, s.manual])).toEqual([
      ["two tests, one behaviour", ["a.rs::one", "b.rs::two"], false],
      ["by hand", [], true],
    ]);
  });
});

describe("joining tests to Scenarios", () => {
  const t = (name: string) => ({ name, file: name.split("::")[0], line: 1, language: "rust" });

  test("orphans are reported both ways", () => {
    const feature = parseFeature(
      "f.feature",
      [
        "@test:x.rs::on_feature",
        "Feature: f",
        "  @test:x.rs::linked @test:x.rs::gone",
        "  Scenario: one",
        "  Scenario: unlinked",
        "  @test:x.rs::twice",
        "  Scenario: a",
        "  @test:x.rs::twice",
        "  Scenario: b",
      ].join("\n"),
    );
    const r = joinTestsToScenarios([t("x.rs::linked"), t("x.rs::orphan"), t("x.rs::twice")], [feature]);
    expect(r.findings.map((f) => [f.kind, f.test ?? f.line]).sort()).toEqual(
      [
        ["scenario-names-no-test", 5],
        ["tag-names-no-test", "x.rs::gone"],
        ["tag-on-feature", "test:x.rs::on_feature"],
        ["test-in-two-scenarios", "x.rs::twice"],
        ["test-without-scenario", "x.rs::orphan"],
      ].sort(),
    );
  });

  test("two tests that normalise to one name are ambiguous", () => {
    const r = joinTestsToScenarios([t("x.rs::a_b"), t("x.rs::a_b")], []);
    expect(r.findings.some((f) => f.kind === "ambiguous-test-name")).toBe(true);
  });

  test("a tree is scanned whole, and a clean tree has no findings", () => {
    const root = mkdtempSync(join(tmpdir(), "test-gherkin-"));
    mkdirSync(join(root, "tests"));
    writeFileSync(join(root, "tests", "hcert.rs"), "#[test]\nfn round_trip() {}\n");
    writeFileSync(join(root, "tests", "loader.test.ts"), 'test("reads a plan", () => {});\n');
    writeFileSync(
      join(root, "tests", "hcert.feature"),
      "Feature: hcert\n  @test:tests/hcert.rs::round_trip\n  Scenario: a certificate survives a round trip\n" +
        "  @test:tests/loader.test.ts::reads_a_plan\n  Scenario: a plan is read\n",
    );
    const r = scanTree(root);
    expect(r.tests.length).toBe(2);
    expect(r.findings).toEqual([]);
    expect(scanTree(root, { under: ["elsewhere"] }).tests).toEqual([]);
  });
});

describe("the kg-audit criterion test-has-gherkin", () => {
  const plan = ($schema: string, cases: { id: string; feature?: string }[]) =>
    JSON.stringify({
      $schema,
      id: "p",
      title: "p",
      status: "draft",
      version: "1",
      scope: { kind: "tool", versionRange: "*" },
      requirements: ["req:r"],
      testCases: cases.map((c) => ({ ...c, assertions: [{ id: "a", type: "required" }] })),
      exitCriteria: { decision: "x.dmn#Decision_X" },
    });

  test("plan cases with no .feature, a missing one, or an empty one are findings; a linked tree passes", () => {
    const root = mkdtempSync(join(tmpdir(), "test-has-gherkin-"));
    writeFileSync(join(root, "a.test.ts"), 'test("works", () => {});\n');
    writeFileSync(join(root, "a.feature"), "Feature: a\n  @test:a.test.ts::works\n  Scenario: it works\n");
    writeFileSync(join(root, "empty.feature"), "Feature: nothing yet\n");
    writeFileSync(join(root, "old.json"), plan(TEST_PLAN_SCHEMA_ID_V1, [{ id: "no-feature" }]));
    writeFileSync(
      join(root, "new.json"),
      plan(TEST_PLAN_SCHEMA_ID, [
        { id: "linked", feature: "a.feature" },
        { id: "missing", feature: "gone.feature" },
        { id: "empty", feature: "empty.feature" },
      ]),
    );
    const entry = auditTestGherkin({ root, plans: [join(root, "old.json"), join(root, "new.json")] });
    expect(entry.result).toBe("fail");
    expect(entry.findings.map((f) => f.where).sort()).toEqual(["new.json#empty", "new.json#missing", "old.json#no-feature"]);

    const clean = auditTestGherkin({ root, plans: [] });
    expect(clean).toEqual({ result: "pass", findings: [] });
  });

  test("nothing to judge is n/a, and many orphans in one file are one finding", () => {
    const empty = mkdtempSync(join(tmpdir(), "test-has-gherkin-"));
    expect(auditTestGherkin({ root: empty, plans: [] }).result).toBe("n/a");

    const root = mkdtempSync(join(tmpdir(), "test-has-gherkin-"));
    writeFileSync(join(root, "m.test.ts"), Array.from({ length: 7 }, (_, i) => `test("t${i}", () => {});`).join("\n"));
    const entry = auditTestGherkin({ root, plans: [] });
    expect(entry.result).toBe("fail");
    expect(entry.findings).toHaveLength(1);
    expect(entry.findings[0].detail).toContain("test-without-scenario: 7");
    expect(entry.findings[0].detail).toContain("and 2 more");
  });
});

describe("bindings beyond @test:, and Gherkin dialects", () => {
  test("a translated .feature is read in its own dialect; an unknown dialect is reported", () => {
    const fr = parseFeature(
      "fr.feature",
      ["# language: fr", "Fonctionnalité: plans", "  @test:a.rs::un", "  Scénario: un plan est lu", "  @test:a.rs::deux", "  Plan du scénario: chaque ligne", "    Exemples:", "      | x |"].join("\n"),
    );
    expect(fr.scenarios.map((s) => [s.title, s.tests])).toEqual([
      ["un plan est lu", ["a.rs::un"]],
      ["chaque ligne", ["a.rs::deux"]],
    ]);
    const xx = parseFeature("xx.feature", "# language: xx-nope\nFeature: f\n  Scenario: s\n");
    expect(xx.unknownLanguage).toBe("xx-nope");
    expect(joinTestsToScenarios([], [xx]).findings.map((f) => f.kind)).toContain("unknown-dialect");
  });

  test("@itb: binds a GITB test case by suite and case id; a missing source is unresolved, never a pass", () => {
    const itb = mkdtempSync(join(tmpdir(), "itb-"));
    mkdirSync(join(itb, "suites", "hcert"), { recursive: true });
    writeFileSync(
      join(itb, "suites", "hcert", "suite.xml"),
      '<?xml version="1.0"?>\n<testsuite id="ts-hcert" xmlns="http://www.gitb.com/tdl/v1/">\n  <!-- <testcase id="commented"/> -->\n  <testcase id="tc-verify"/>\n</testsuite>\n',
    );
    const feature = parseFeature(
      "f.feature",
      ["Feature: f", "  @itb:ts-hcert/tc-verify", "  Scenario: held and present", "  @itb:ts-hcert/tc-gone", "  Scenario: held, absent", "  @itb:ts-hcert/commented", "  Scenario: only in a comment"].join("\n"),
    );
    expect(feature.scenarios[0].bindings).toEqual([{ scheme: "itb", target: "ts-hcert/tc-verify" }]);

    const held = joinTestsToScenarios([], [feature], [itbResolver(itb)]);
    expect(held.findings.map((f) => [f.kind, f.test])).toEqual([
      ["tag-names-no-target", "@itb:ts-hcert/tc-gone"],
      ["tag-names-no-target", "@itb:ts-hcert/commented"],
    ]);

    const notHeld = joinTestsToScenarios([], [feature], [itbResolver(undefined)]);
    expect(notHeld.findings.map((f) => f.kind)).toEqual(["binding-unresolved", "binding-unresolved", "binding-unresolved"]);
    expect(notHeld.findings[0].detail).toContain("source not held");
    expect(joinTestsToScenarios([], [feature]).findings.every((f) => f.kind === "binding-unresolved")).toBe(true);
    // An unterminated or nested-looking comment never leaves a case readable.
    expect(withoutXmlComments('a<!-- <testcase id="x"/> --><!--<!-- -->b')).toBe("ab");
    expect(withoutXmlComments('a<!-- <testcase id="x"/>')).toBe("a");
  });
});

describe("declared specifications", () => {
  test("testSpecifications on any contentTypes section marks its features as specifications; a bound one is still checked", () => {
    const spec = ["Feature: Immunization logic", "  Scenario: dose is due", "    Given a patient", "  @itb:ts-immz/tc-due", "  Scenario: bound to an external suite"].join("\n");
    const write = (root: string, config: unknown) => {
      mkdirSync(join(root, "input", "testing"), { recursive: true });
      mkdirSync(join(root, "tools"), { recursive: true });
      writeFileSync(join(root, "input", "testing", "IMMZ.feature"), spec);
      writeFileSync(join(root, "tools", "own.feature"), "Feature: own\n  Scenario: unbound\n");
      writeFileSync(join(root, "tools", "own.test.ts"), 'test("untagged", () => {});\n');
      if (config !== undefined) writeFileSync(join(root, "index.config.json"), JSON.stringify(config));
    };
    const kinds = (r: { findings: { kind: string; file: string }[] }) => r.findings.map((f) => `${f.kind} ${f.file}`).sort();
    const tree = (config: unknown) => {
      const root = mkdtempSync(join(tmpdir(), "specs-"));
      write(root, config);
      return root;
    };

    // No declaration: every unbound Scenario is a finding.
    const p = scanTree(tree(undefined));
    expect(p.specifications).toEqual([]);
    expect(kinds(p)).toEqual([
      "binding-unresolved input/testing/IMMZ.feature",
      "scenario-names-no-test input/testing/IMMZ.feature",
      "scenario-names-no-test tools/own.feature",
      "test-without-scenario tools/own.test.ts",
    ]);

    // Declared on a section of any type: only the features under its paths are specifications.
    for (const type of ["dak", "ig", "some-later-type"]) {
      const r = scanTree(tree({ contentTypes: { [type]: { testSpecifications: ["./input/testing/"] } } }));
      expect(r.specifications.map((s) => `${s.file} ${s.title}`)).toEqual(["input/testing/IMMZ.feature dose is due"]);
      expect(kinds(r)).toEqual([
        "binding-unresolved input/testing/IMMZ.feature",
        "scenario-names-no-test tools/own.feature",
        "test-without-scenario tools/own.test.ts",
      ]);
    }

    // A section without the key, however DAK-like, declares nothing.
    expect(scanTree(tree({ contentTypes: { dak: { resourceType: "DAK", id: "x" }, ig: { include: ["input/"] } } })).specifications).toEqual([]);

    // A malformed declaration is refused, not read as empty.
    expect(() => scanTree(tree({ contentTypes: { dak: { testSpecifications: "input/testing/" } } }))).toThrow(/testSpecifications must be a list/);
    expect(() => scanTree(tree({ contentTypes: { dak: { testSpecifications: ["https://example.org/x"] } } }))).toThrow(/repository-relative/);
  });
});

describe("a JS title is named by its runtime string", () => {
  test("escapes in a quoted or template title are read as the runner reads them; a looped id stays verbatim", () => {
    const src = [
      'describe("say \\"it\\" twice", () => {',
      "  test('can\\'t fail', () => {});",
      "  test(`a \\`tick\\``, () => {});",
      '  test("regex \\\\bq\\\\b and \\u00e9 and \\x41", () => {});',
      "  test(`case[${k}]`, () => {});",
      "});",
    ].join("\n");
    expect(names(JS_ADAPTER.findTests("t.test.ts", src))).toEqual([
      "t.test.ts::say_\"it\"_twice::can't_fail",
      "t.test.ts::say_\"it\"_twice::a_`tick`",
      "t.test.ts::say_\"it\"_twice::regex_\\bq\\b_and_é_and_A",
      "t.test.ts::say_\"it\"_twice::case[${k}]",
    ]);
    expect(unescapeJsString("a\\nb\\u{1F600}\\\nc\\q")).toBe("a\nb\u{1F600}cq");
  });
});
