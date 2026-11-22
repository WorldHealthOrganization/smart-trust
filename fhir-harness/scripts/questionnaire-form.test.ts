/**
 * One LHC-Forms form page per Questionnaire, from a synthetic AST: this layer
 * names no real IG.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { astFileUrl, BUILDER_AT, BUILDER_OWN, BUNDLE_AT, builderIndexHtml, QFORM_EDIT_LINKS, checkerModule, formPageHtml, LHC_FORMS_VERSION, lformsFhirVersion, questionnaireFormPages, SMART_FORMS_URL, swUrl } from "./questionnaire-form.ts";

const made: string[] = [];
afterAll(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));
const tmp = (p: string) => {
  const d = mkdtempSync(join(tmpdir(), p));
  made.push(d);
  return d;
};
const put = (root: string, rel: string, text: string) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};

function ast(resources: Array<{ type: string; id: string; json: object; source?: string }>, expansions?: object): string {
  const dir = tmp("q-ast-");
  if (expansions) put(dir, "expansions.json", JSON.stringify(expansions));
  const rs = resources.map((r) => {
    const file = `resources/${r.type}/${r.id}.json`;
    put(dir, file, JSON.stringify({ resourceType: r.type, id: r.id, ...r.json }));
    return { key: `${r.type}/${r.id}`, canonical: null, version: null, resourceType: r.type, id: r.id, file, source: r.source ?? null };
  });
  put(dir, "manifest.json", JSON.stringify({ $schema: "ig-ast/v1", authority: "cache", provisional: ["indices", "dependencies", "versions"], resources: rs }));
  put(dir, "dependencies.json", JSON.stringify({ $schema: "ig-ast-dependencies/v1", dependencies: [] }));
  return dir;
}

const intake = { title: "Client intake", item: [{ linkId: "1", type: "string", text: "Name" }] };

describe("questionnaireFormPages", () => {
  test("pagePerQuestionnaire", () => {
    const out = tmp("q-site-");
    const pages = questionnaireFormPages(
      ast([
        { type: "Questionnaire", id: "intake", json: intake, source: "input/fsh/intake.fsh" },
        { type: "Patient", id: "p1", json: {} },
      ]),
      out,
      { editBase: "https://github.com/o/ig/edit/main", fhirVersion: "4.0.1", slug: "example.ig" },
    );
    expect(pages).toEqual([{ id: "intake", page: "Questionnaire-intake-form.html", json: "questionnaires/Questionnaire-intake.json", source: "input/fsh/intake.fsh" }]);
    const cfg = JSON.parse(/id="fa-edit-cfg">(.*?)<\/script>/.exec(readFileSync(join(out, "Questionnaire-intake-form.html"), "utf-8"))![1]!);
    expect(cfg.suggest.builder).toBe(`${BUILDER_AT}window-open`);
    expect(cfg.suggest.sw).toEqual({ url: `${BUILDER_AT}${swUrl("index.json")}`, scope: BUILDER_AT });
    expect(JSON.parse(readFileSync(join(out, "questionnaires/Questionnaire-intake.json"), "utf-8"))).toEqual({ resourceType: "Questionnaire", id: "intake", ...intake });
    for (const f of [
      `assets/lhc-forms/${LHC_FORMS_VERSION}/webcomponent/main.js`,
      `assets/lhc-forms/${LHC_FORMS_VERSION}/fhir/lformsFHIRAll.min.js`,
      `assets/lhc-forms/${LHC_FORMS_VERSION}/LICENSE.md`,
      "assets/js/questionnaire-form.js",
      "assets/js/questionnaire-mode.js",
      "assets/js/check-wireframe-questionnaire.js",
      QFORM_EDIT_LINKS,
      `${BUILDER_AT}index.html`,
      `${BUILDER_AT}window-open.html`,
      `${BUILDER_AT}fa-terminology-sw.js`,
      `${BUILDER_AT}fa-terminology-map.js`,
      `${BUNDLE_AT}main.dd0ec5f4ab3ef14c.js`,
      `${BUNDLE_AT}assets/fhir.schema.json`,
      "assets/jquery/3.6.0/jquery.min.js",
      "assets/terminology/index.json",
      "assets/terminology/ucum.json",
    ])
      expect(existsSync(join(out, f))).toBe(true);
    // The builder's directory keeps only its pages and the worker; the bundle is beside it, unchanged.
    expect(readdirSync(join(out, BUILDER_AT)).sort()).toEqual([...BUILDER_OWN].sort());
    expect(existsSync(join(out, BUNDLE_AT, "index.html"))).toBe(false);
    expect(existsSync(join(out, "Questionnaire-p1-form.html"))).toBe(false);
    // The platform chrome's path, which an IG repository's site composes at the same root.
    expect(existsSync(join(out, "assets/js/edit-links.js"))).toBe(false);
  });
  test("noQuestionnaireNothingWritten", () => {
    const out = tmp("q-site-");
    expect(questionnaireFormPages(join(out, "absent"), out)).toEqual([]);
    expect(questionnaireFormPages(ast([{ type: "Patient", id: "p", json: {} }]), out)).toEqual([]);
    expect(existsSync(join(out, "assets"))).toBe(false);
  });
  test("sourceReadFromAstCacheCommit", () => {
    const raw = "https://raw.githubusercontent.com/o/ig/0123456789abcdef0123456789abcdef01234567";
    const copied = tmp("q-site-");
    const byUrl = tmp("q-site-");
    const dir = ast([{ type: "Questionnaire", id: "intake", json: intake, source: "input/fsh/intake.fsh" }]);
    questionnaireFormPages(dir, copied, { editBase: "https://github.com/o/ig/edit/main" });
    questionnaireFormPages(dir, byUrl, { editBase: "https://github.com/o/ig/edit/main", astRaw: `${raw}/` });
    const host = (out: string) => /<div id="fa-qform"[^>]*>/.exec(readFileSync(join(out, "Questionnaire-intake-form.html"), "utf-8"))![0];
    // No AST commit: the unexpanded copy is in the site, and the page reads it there.
    expect(existsSync(join(copied, "questionnaires/Questionnaire-intake.source.json"))).toBe(true);
    expect(host(copied)).toContain('data-suggest-text="questionnaires/Questionnaire-intake.source.json"');
    // The AST read by URL: the page reads the manifest's file at the commit, and no copy is written.
    expect(host(byUrl)).toContain(`data-suggest-text="${raw}/resources/Questionnaire/intake.json"`);
    expect(existsSync(join(byUrl, "questionnaires/Questionnaire-intake.source.json"))).toBe(false);
    expect(readdirSync(join(byUrl, "questionnaires"))).toEqual(["Questionnaire-intake.json"]);
  });
  test("astFileUrlEncodesSegments", () => {
    expect(astFileUrl("https://raw.githubusercontent.com/o/r/abc", "resources/Questionnaire/Q #1--ab.json")).toBe("https://raw.githubusercontent.com/o/r/abc/resources/Questionnaire/Q%20%231--ab.json");
  });
});

test("answerValueSetExpandedInCopy", () => {
  const out = tmp("q-site-");
  const q = { item: [{ linkId: "s", type: "choice", answerValueSet: "http://example.org/ig/ValueSet/sex" }, { linkId: "t", type: "choice", answerValueSet: "http://example.org/ig/ValueSet/none" }] };
  const vs = { resourceType: "ValueSet", url: "http://example.org/ig/ValueSet/sex", expansion: { contains: [{ system: "http://example.org/cs", code: "f", display: "Female" }] } };
  const dir = ast([{ type: "Questionnaire", id: "q", json: q }], { resourceType: "Bundle", entry: [{ resource: vs }] });
  const [p] = questionnaireFormPages(dir, out);
  expect(p).toMatchObject({ expanded: ["s"], notExpanded: ["t"] });
  const copy = JSON.parse(readFileSync(join(out, p!.json), "utf-8"));
  expect(copy.item[0].answerOption).toEqual([{ valueCoding: { system: "http://example.org/cs", code: "f", display: "Female" } }]);
  expect(JSON.parse(readFileSync(join(dir, "resources/Questionnaire/q.json"), "utf-8")).item[0].answerValueSet).toBe("http://example.org/ig/ValueSet/sex");
  const index = JSON.parse(readFileSync(join(out, "assets/terminology/index.json"), "utf-8"));
  expect(index.codes).toEqual([["http://example.org/cs", "f", "Female"]]);
});

describe("the Form Builder's index.html, as this site serves it", () => {
  const original = readFileSync(join(import.meta.dir, "assets/vendor/formbuilder-lhcforms/12.9.0/index.html"), "utf-8");
  const html = builderIndexHtml(original, swUrl("index.json"));
  test("builderIndexLoadsNothingRemote", () => {
    expect(original).toContain("https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js");
    expect(original).toContain("fonts.gstatic.com");
    expect(html).not.toMatch(/(src|href)="https?:\/\//);
    expect(html).not.toMatch(/url\(https?:/);
    expect(html).toContain('src="../../jquery/3.6.0/jquery.min.js"');
  });
  test("workerGuardFirst", () => {
    expect(html.indexOf("serviceWorker")).toBeLessThan(html.indexOf("<script src="));
    expect(html).toContain(JSON.stringify(swUrl("index.json")));
  });
});

describe("the page", () => {
  const html = formPageHtml({ id: "intake", title: "Client <intake>" }, { json: "questionnaires/Questionnaire-intake.json", text: "questionnaires/Questionnaire-intake.source.json", source: "input/fsh/intake.fsh", editBase: "https://github.com/o/ig/edit/main", fhirVersion: "5.0.0", slug: "example.ig" });
  test("pageLinksAndLocalScripts", () => {
    expect(html).toContain('data-fa-link="edit"');
    expect(html).toContain('data-fa-link="feedback"');
    expect(html).toContain("✍ suggest a change");
    expect(html).toContain(`href="${SMART_FORMS_URL}"`);
    expect(html).toContain('data-fhir="R5"');
    expect(html).toContain("Client &lt;intake&gt;: the form");
    expect(html.match(/<script[^>]+src="([^"]+)"/g)!.every((s) => !/src="(https?:)?\/\//.test(s))).toBe(true);
  });
  test("linksArtefactPage", () => {
    // The form page sits at the site root and the artefact page at artifact/<Type>-<id>.html.
    expect(html).toContain('<a href="artifact/Questionnaire-intake.html">Questionnaire/intake</a>');
  });
  test("suggestConfigNamesMode", () => {
    const cfg = JSON.parse(/<script type="application\/json" id="fa-edit-cfg">(.*?)<\/script>/.exec(html)![1]!);
    expect(cfg).toEqual({
      repo: "o/ig",
      branch: "main",
      suggest: {
        profiles: [{ id: "questionnaire", module: "assets/js/questionnaire-mode.js", extensions: [".json"], kinds: ["questionnaire"] }],
        fhirVersion: "R5",
        source: "input/fsh/intake.fsh",
        slug: "example.ig",
      },
    });
    expect(cfg.suggest).not.toHaveProperty("mode");
    expect(cfg.suggest).not.toHaveProperty("checker");
  });
  test("formHostNamesModeAndBlock", () => {
    expect(html).toContain('<div id="fa-qform" class="fa-qform"');
    expect(/<div id="fa-qform"[^>]*>/.exec(html)![0]).toContain('data-src="input/fsh/intake.fsh" data-suggest-text="questionnaires/Questionnaire-intake.source.json" data-block="questionnaire:intake" data-suggest-mode="questionnaire"');
  });
  test("modeEditsUnexpandedJson", () => {
    const host = /<div id="fa-qform"[^>]*>/.exec(html)![0];
    expect(host).toContain('data-suggest-text="questionnaires/Questionnaire-intake.source.json"');
    expect(host).not.toContain('data-suggest-text="questionnaires/Questionnaire-intake.json"');
  });
  test("noRepoNoLinks", () => {
    const bare = formPageHtml({ id: "x" }, { json: "questionnaires/Questionnaire-x.json" });
    expect(bare).not.toContain("data-fa-link");
    expect(bare).not.toContain("fa-qform-suggest");
  });
});

test("lformsFhirVersionNames", () => {
  expect(["3.0.2", "4.0.1", "4.3.0", "5.0.0", undefined].map(lformsFhirVersion)).toEqual(["STU3", "R4", "R4B", "R5", "R4"]);
});

test("checkerBrowserModule", async () => {
  const js = checkerModule();
  expect(js).not.toContain(": string");
  expect(js).not.toMatch(/^import .*node:/m);
  const dir = tmp("q-mod-");
  writeFileSync(join(dir, "c.mjs"), js);
  const m = await import(join(dir, "c.mjs"));
  expect(m.checkSuggestion('{"resourceType":"Questionnaire"}', "{").errors).toHaveLength(1);
});

describe("the worker's configuration", () => {
  test("swUrlNamesTheBundleBesideTheBuilder", () => {
    const q = new URLSearchParams(swUrl("index.json").split("?")[1]);
    expect(q.get("bundle")).toBe("../../formbuilder-bundle/12.9.0/");
    // Percent-encoded, as a shared-asset rewrite finds a relative query value.
    expect(swUrl("index.json")).toContain("bundle=..%2F..%2Fformbuilder-bundle%2F12.9.0%2F");
  });
});
