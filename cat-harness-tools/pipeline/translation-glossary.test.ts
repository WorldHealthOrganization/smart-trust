/**
 * `translation:glossary:check` — the layered term base and its three rules,
 * and the "Glossary consistency" section of the KG QA report.
 *
 * Run: bun test pipeline/translation-glossary.test.ts
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { TOOLS_ROOT } from "../scripts/lib/roots.ts";
import { glossaryConsistencyMarkdown } from "../scripts/kg-qa-report.ts";
import { GlossarySenseStoreSchema, senseKey, type GlossarySenseVerdict } from "../schemas/kg/glossary-sense.ts";
import {
  cataloguePatternOf,
  checkLocale,
  glossaryResult,
  glossarySources,
  keptAsName,
  msgidSha256,
  ownTranslationRoots,
  patternCatalogues,
  pendingQuestions,
  readSchemeScope,
  renders,
  termBase,
  uses,
  type GlossarySource,
} from "./translation-glossary.ts";

const HEADER = 'msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n';
/** A scheme entry: a label (`#.` comment) or definition. */
const label = (id: string, str: string, flags = "") =>
  `\n#. Glossary term label: https://example.org/t/${id.toLowerCase()}\n${flags ? `#, ${flags}\n` : ""}msgid "${id}"\nmsgstr "${str}"\n`;
const plain = (id: string, str: string) => `\nmsgid "${id}"\nmsgstr "${str}"\n`;

let base: string;
const w = (rel: string, text: string): string => {
  const p = join(base, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, text);
  return p;
};

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "translation-glossary-"));
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe("matching", () => {
  test("a term is a whole word of the prose, case-insensitive", () => {
    expect(uses("Health worker", "Every health worker signs in.")).toBe(true);
    expect(uses("Actor", "The cat-harness-actor list")).toBe(false); // part of an identifier
    expect(uses("Actor", "See `Actor` in code")).toBe(false); // inside code
  });
  test("a short all-caps acronym is case-sensitive", () => {
    expect(uses("DID", "a DID document")).toBe(true);
    expect(uses("DID", "what did it do")).toBe(false);
  });
  test("a rendering is found by stem, or by substring in zh and ar", () => {
    expect(renders("agent de santé", "Les agents de santé arrivent", "fr")).toBe(true);
    expect(renders("agent de santé", "Le soignant arrive", "fr")).toBe(false);
    expect(renders("卫生工作者", "每位卫生工作者登录", "zh")).toBe(true);
    expect(renders("العامل الصحي", "يسجل العامل الصحي الدخول", "ar")).toBe(true);
  });
  test("a Russian noun with a fleeting vowel is found in its oblique cases", () => {
    expect(renders("Узел", "Из какого одного узла могут происходить все они?", "ru")).toBe(true);
    expect(renders("Узел", "узлы графа", "ru")).toBe(true);
    expect(renders("Узел", "Узел графа", "ru")).toBe(true);
    expect(renders("Узел", "вершина графа", "ru")).toBe(false);
    expect(renders("Обвязка", "слой обвязки", "ru")).toBe(true);
  });
});

describe("Arabic: a fixed rendering in its plural, possessive and broken-plural forms (owner, Q-GLOSS-REST A)", () => {
  // The 13 Arabic uses cat-harness#1279 left reported, as they stand in
  // cat-harness's translations/ar catalogues. Twelve render the fixed term in
  // correct inflected Arabic, which the substring match after stripping «ال»
  // could not see. The thirteenth uses «Reference» in another sense (the
  // verb), and stays unmatched: it needs a translator's other-sense verdict,
  // not a looser matcher.
  const rendered: Array<[term: string, fixed: string, msgstr: string]> = [
    ["Skill", "المهارة", "إن folio-assistant قابل للتوسيع — تتم معالجة كل نوع محتوى بواسطة محول محتوى وحزمة مهارات مطابقة."],
    ["Skill", "المهارة", "حزمة المهارات"],
    ["Skill", "المهارة", "قابل للتوسيع — أضف محولاً جديدًا + حزمة مهارات"],
    ["Skill", "المهارة", "البدء — توصيل خادم MCP بنموذجك اللغوي وتشغيل مهاراتك الأولى."],
    ["Role", "الدور", "المهارات والأدوار — جميع المهارات والأدوار، وكيفية عملها مع النموذج اللغوي الكبير."],
    ["Skill", "المهارة", "المهارات والأدوار — جميع المهارات والأدوار، وكيفية عملها مع النموذج اللغوي الكبير."],
    ["Role", "الدور", "تعيين الأدوار"],
    ["Skill", "المهارة", "إن folio-assistant هو خادم MCP يضم طبقة محولات محتوى قابلة للتوصيل، ونظام مهارات، ونموذج كائنات محتوى"],
    ["Skill", "المهارة", "المهارات وحزم المهارات"],
    ["Skill", "المهارة", "ويتم دعم كل نوع من أنواع المحتوى بواسطة حزمة مهارات"],
    ["Task", "المهمة", "مفروضة: دور المسار فقط هو المخول بتنفيذ مهمته"],
    ["Skill", "المهارة", "مراجع المهارات المجمعة"],
  ];
  test.each(rendered)("%s «%s» is rendered in «%s»", (_term, fixed, msgstr) => {
    expect(renders(fixed, msgstr, "ar")).toBe(true);
  });

  test("Reference in another sense (the verb) is still not rendered", () => {
    expect(renders("المرجع", "الإشارة إلى المصدر في التعليق على المسألة (برابط أو مرفق)", "ar")).toBe(false);
  });

  test("a different word sharing the stem is not a form of it", () => {
    // «مهم» / «المهم» ("important") are not «المهمة» ("the task").
    expect(renders("المهمة", "هذا أمر مهم", "ar")).toBe(false);
    expect(renders("المهمة", "المهم هو الاختبار", "ar")).toBe(false);
    expect(renders("المهارة", "مهارة", "ar")).toBe(true);
  });
});

describe("termBase — the lower layer fixes, a higher one may only add", () => {
  let lower: string, higher: string, mine: string, ref: string;
  beforeAll(() => {
    lower = w("tb/lower/fr/glossary/core--terms.po", HEADER + label("Actor", "Acteur") + label("Skill", "Compétence"));
    higher = w(
      "tb/higher/fr/glossary/app--terms.po",
      HEADER +
        label("Actor", "Intervenant") + // a different translation of a term fixed below
        label("Health worker", "Agent de santé") + // a new term: allowed
        label("Localised", "x", "localised") + // fixes nothing
        label("Empty", "") + // fixes nothing
        label("A long label that is really a sentence of prose and not a term at all here", "x"),
    );
    mine = w("tb/mine/fr/glossary.po", HEADER + plain("Skill", "Savoir-faire") + plain("Clinic", "Clinique"));
    ref = w("tb/ref/fr/who.po", HEADER + label("Immunization", "Vaccination"));
  });
  const src = (): GlossarySource[] => [
    { layer: "who", file: ref, reference: true },
    { layer: "core", file: lower, reference: false },
    { layer: "app", file: higher, reference: false },
    { layer: "app", file: mine, reference: false },
  ];

  const get = (tb: ReturnType<typeof termBase>, label: string) => [...tb.terms.values()].filter((t) => t.term.toLowerCase() === label);

  test("each term binds in its scheme when no subject is declared; empty, localised and long labels fix nothing", () => {
    const tb = termBase("app", "fr", src());
    expect(get(tb, "actor").map((t) => [t.scope, t.fixed, t.inScope])).toEqual([
      ["core--terms", "Acteur", false],
      ["app--terms", "Intervenant", true],
    ]);
    expect(get(tb, "health worker")[0]).toMatchObject({ fixed: "Agent de santé", layer: "app", inScope: true });
    expect(get(tb, "immunization")[0]).toMatchObject({ layer: "who", scope: "reference:who", inScope: true });
    expect(get(tb, "localised")).toEqual([]);
    expect(get(tb, "empty")).toEqual([]);
    expect([...tb.terms.values()].some((t) => t.term.startsWith("A long label"))).toBe(false);
  });
  test("the instance translating another area's label otherwise is a sense check, not an override", () => {
    const tb = termBase("app", "fr", src());
    expect(tb.overrides).toEqual([]);
    expect(tb.senseOverrides.map((o) => `${o.term}:${o.fixed.scope}->${o.layer}`)).toEqual(["Actor:core--terms->app", "Skill:core--terms->app"]);
  });
  test("in ONE subject area the lower layer fixes, and a second translation is an override", () => {
    const shared = (x: GlossarySource): GlossarySource => ({ ...x, scope: "harness-vocabulary" });
    const tb = termBase("app", "fr", [shared(src()[1]!), shared(src()[2]!)]);
    expect(get(tb, "actor").map((t) => t.fixed)).toEqual(["Acteur"]);
    expect(tb.overrides.map((o) => `${o.term}:${o.fixed.layer}->${o.layer}`)).toEqual(["Actor:core->app"]);
  });
  test("a term's own subject overrides its scheme's; a term that is not authored fixes nothing", () => {
    const s = { ...src()[1]!, scope: "harness-vocabulary", termScopes: new Map<string, string | null>([["actor", "digital-health-trust"], ["skill", null]]) };
    const tb = termBase("app", "fr", [s]);
    expect(get(tb, "actor")[0]!.scope).toBe("digital-health-trust");
    expect(get(tb, "skill")).toEqual([]);
  });
  test("an instance binds in the subject areas it declares", () => {
    const tb = termBase("app", "fr", [{ ...src()[1]!, scope: "digital-health-trust" }], new Set(["digital-health-trust"]));
    expect(get(tb, "actor")[0]!.inScope).toBe(true);
  });
  test("a reference glossary binds every instance", () => {
    const tb = termBase("app", "fr", [
      ...src(),
      { layer: "app", file: w("tb/mine2/fr/glossary.po", HEADER + plain("Immunization", "Immunisation")), reference: false },
    ]);
    expect(tb.overrides.map((o) => o.term)).toEqual(["Immunization"]);
  });
});

describe("subject areas are read from the glossary each scheme catalogue names", () => {
  test("readSchemeScope: the scheme's subject, a term's own, and non-authored terms", () => {
    const f = w(
      "scope/x.glossary.json",
      JSON.stringify({
        $schema: "folio-glossary/v1",
        id: "terms",
        title: "T",
        subject: "harness-vocabulary",
        terms: [
          { id: "actor", prefLabel: "Actor", altLabel: ["Participant"], status: "authored", definition: "d" },
          { id: "policy", prefLabel: { en: "Policy" }, subject: "digital-health-trust", status: "authored", definition: "d" },
          { id: "draft", prefLabel: "Draft", status: "candidate" },
        ],
      }),
    );
    const sc = readSchemeScope(f)!;
    expect(sc.subject).toBe("harness-vocabulary");
    expect(sc.terms.get("policy")).toBe("digital-health-trust");
    expect(sc.terms.get("draft")).toBeNull();
    expect(sc.terms.has("actor")).toBe(false); // the scheme's subject applies
    expect(readSchemeScope(w("scope/not.json", "{}"))).toBeUndefined();
  });
  test("readSchemeScope: a schema publishing its terms in $defs carries its subject as data", () => {
    const f = w(
      "scope/graph.schema.json",
      JSON.stringify({
        $schema: "http://json-schema.org/draft-07/schema#",
        subject: "harness-vocabulary",
        $defs: { Reference: { title: "Reference", description: "A Node's naming of another Node by its IRI." } },
      }),
    );
    const sc = readSchemeScope(f)!;
    expect(sc.subject).toBe("harness-vocabulary");
    expect(sc.terms.size).toBe(0); // every term takes the schema's subject
    const none = w("scope/plain.schema.json", JSON.stringify({ $defs: { Node: { title: "Node" } } }));
    expect(readSchemeScope(none)).toBeUndefined(); // no subject published: the scheme itself, as before
  });
  test("glossarySources finds the glossary from the catalogue's #: reference", () => {
    const root = join(base, "scoped");
    mkdirSync(join(root, "glossary"), { recursive: true });
    mkdirSync(join(root, "translations", "fr", "glossary"), { recursive: true });
    writeFileSync(
      join(root, "acme.json"),
      JSON.stringify({
        name: "acme",
        directories: [
          { id: "translations", path: "translations/", graphTypologies: ["translation-sources"] },
          { id: "glossary", path: "glossary/", graphTypologies: ["glossary"] },
        ],
      }),
    );
    writeFileSync(
      join(root, "glossary", "health.glossary.json"),
      JSON.stringify({ $schema: "folio-glossary/v1", id: "health", title: "H", subject: "who-health-guidance", terms: [{ id: "hw", prefLabel: "Health worker", status: "authored", definition: "d" }] }),
    );
    writeFileSync(
      join(root, "translations", "fr", "glossary", "acme--health.po"),
      HEADER + `\n#: glossary/health.glossary.json:1\n#. Glossary term label: https://example.org/t/hw\nmsgid "Health worker"\nmsgstr "Agent de santé"\n`,
    );
    const src = glossarySources(root, "fr").find((x) => x.file.endsWith("acme--health.po"))!;
    expect(src.scope).toBe("who-health-guidance");
  });
});

/** A one-instance checkout: `acme` with its own glossary and two content catalogues. */
function acme(dir: string, declare = true): string {
  const root = join(base, dir);
  mkdirSync(join(root, "translations", "fr", "glossary"), { recursive: true });
  writeFileSync(
    join(root, "acme.json"),
    JSON.stringify({ name: "acme", directories: declare ? [{ id: "translations", path: "translations/", graphTypologies: ["translation-sources"] }] : [] }),
  );
  writeFileSync(join(root, "translations", "fr", "glossary", "acme--terms.po"), HEADER + label("Health worker", "Agent de santé"));
  writeFileSync(
    join(root, "translations", "fr", "page.po"),
    HEADER +
      plain("Every health worker signs in.", "Chaque soignant se connecte.") + // not the fixed term
      plain("The clinic opens.", "La clinique ouvre.") +
      plain("Health worker", "Agent de santé") + // the term on its own
      plain("Actor", "Acteur"),
  );
  writeFileSync(
    join(root, "translations", "fr", "other.po"),
    HEADER + plain("A health worker arrives.", "Un agent de santé arrive.") + plain("Actor", "Intervenant"),
  );
  return root;
}

describe("checkLocale — the three rules, and scope", () => {
  test("flags a msgstr that does not use an in-scope fixed term, and a term rendered two ways", () => {
    const root = acme("chk");
    const platform = w("chk-platform/fr/glossary/core--terms.po", HEADER + label("Actor", "Acteur") + label("Clinic", "Centre"));
    const r = checkLocale(root, join(root, "translations"), "fr", [], [
      { layer: "core", file: platform, reference: false },
      ...glossarySources(root, "fr"),
    ]);
    expect(r.findings.map((f) => `${f.rule}:${f.term}`).sort()).toEqual([
      "inconsistent:Actor", // page.po «Acteur», other.po «Intervenant»
      "not-fixed-rendering:Health worker", // page.po: «soignant», not «agent de santé»
    ]);
    // Platform terms in health content: pending adjudication, not violations —
    // "Clinic" in a sentence, and "Actor" rendered otherwise in other.po.
    expect(r.pending.map((n) => n.term).sort()).toEqual(["Actor", "Clinic"]);
  });
  test("a clean locale has no findings", () => {
    const root = join(base, "clean");
    mkdirSync(join(root, "translations", "fr", "glossary"), { recursive: true });
    writeFileSync(
      join(root, "acme.json"),
      JSON.stringify({ name: "acme", directories: [{ id: "translations", path: "translations/", graphTypologies: ["translation-sources"] }] }),
    );
    writeFileSync(join(root, "translations", "fr", "glossary", "acme--terms.po"), HEADER + label("Health worker", "Agent de santé"));
    writeFileSync(join(root, "translations", "fr", "page.po"), HEADER + plain("A health worker arrives.", "Un agent de santé arrive."));
    const r = checkLocale(root, join(root, "translations"), "fr", [], glossarySources(root, "fr"));
    expect(r.findings).toEqual([]);
    expect(r.fixedTerms).toBe(1);
  });
});

describe("a declared `catalogues` pattern (a smart-base IG's input/<area>/translations/<locale>.po)", () => {
  /** A layer whose catalogues sit where smart-base's injector reads them, not under translations/<locale>/. */
  function ig(dir: string): string {
    const root = join(base, dir);
    mkdirSync(join(root, "translations", "fr", "glossary"), { recursive: true });
    writeFileSync(
      join(root, "acme.json"),
      JSON.stringify({
        name: "acme",
        directories: [
          {
            id: "translations",
            path: "translations/",
            graphTypologies: ["translation-sources"],
            catalogues: "input/*/translations/{locale}.po",
          },
        ],
      }),
    );
    writeFileSync(join(root, "translations", "fr", "glossary", "acme--terms.po"), HEADER + label("Health worker", "Agent de santé"));
    w(`${dir}/input/pagecontent/translations/fr.po`, HEADER + plain("Every health worker signs in.", "Chaque soignant se connecte."));
    w(`${dir}/input/images/translations/fr.po`, HEADER + plain("A health worker arrives.", "Un agent de santé arrive."));
    w(`${dir}/input/images/translations/images.pot`, HEADER + plain("A health worker arrives.", ""));
    w(`${dir}/input/images/translations/es.po`, HEADER + plain("Every health worker signs in.", "Cada trabajador sanitario entra."));
    return root;
  }
  test("the pattern's files are the locale's catalogues, and its locales are the layer's", () => {
    const root = ig("igpat");
    expect(cataloguePatternOf(root)).toBe("input/*/translations/{locale}.po");
    expect(patternCatalogues(root, "input/*/translations/{locale}.po").map((c) => `${relative(root, c.file)}=${c.locale}`)).toEqual([
      "input/images/translations/es.po=es",
      "input/images/translations/fr.po=fr",
      "input/pagecontent/translations/fr.po=fr",
    ]);
    const r = checkLocale(root, join(root, "translations"), "fr", [], glossarySources(root, "fr"));
    // pagecontent/fr.po renders "health worker" as «soignant», not the fixed «agent de santé».
    expect(r.findings.map((f) => `${f.rule}:${f.term}:${f.catalogue}`)).toEqual([
      "not-fixed-rendering:Health worker:input/pagecontent/translations/fr.po",
    ]);
  });
  test("without the field, only translations/<locale>/ is read", () => {
    const root = ig("igpat-none");
    const decl = JSON.parse(readFileSync(join(root, "acme.json"), "utf-8"));
    delete decl.directories[0].catalogues;
    writeFileSync(join(root, "acme.json"), JSON.stringify(decl));
    expect(cataloguePatternOf(root)).toBeUndefined();
    expect(checkLocale(root, join(root, "translations"), "fr", [], glossarySources(root, "fr")).findings).toEqual([]);
  });
});

function run(args: string[], cwd: string) {
  const r = spawnSync("bun", [join(TOOLS_ROOT, "pipeline", "translation-glossary.ts"), ...args], { cwd, encoding: "utf-8" });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

describe("the CLI: one finding per line, exit 0 / 1 / 2", () => {
  test("findings exit 1, one per line", () => {
    const root = acme("cli");
    const r = run(["--check", "--instance", root, "--locale", "fr"], base);
    expect(r.code).toBe(1);
    // No layer below fixes "Actor" here, so only the layer's own term binds.
    expect(r.out.split("\n").filter((l) => l.startsWith("✗ fr "))).toEqual([
      '✗ fr not-fixed-rendering «Health worker» → «Agent de santé» (acme) not used in translations/fr/page.po: "Every health worker signs in."',
    ]);
    expect(existsSync(join(root, "test", "results", "glossary-consistency.qa-results.json"))).toBe(false);
  });
  test("an override by a --layer reference term exits 1", () => {
    const root = acme("cli-ref");
    writeFileSync(join(root, "translations", "fr", "glossary.po"), HEADER + plain("Immunization", "Immunisation"));
    const ref = w("cli-ref-who/fr/who.po", HEADER + label("Immunization", "Vaccination"));
    const r = run(["--check", "--instance", root, "--locale", "fr", "--layer", `who=${ref.replace("/fr/", "/{locale}/")}`], base);
    expect(r.out).toContain("✗ fr override «Immunization»: who fixes «Vaccination»");
    expect(r.code).toBe(1);
  });
  test("cannot determine: an undeclared instance, or an unknown locale, exits 2", () => {
    expect(run(["--check", "--instance", acme("cli-bare", false)], base).code).toBe(2);
    expect(run(["--check", "--instance", acme("cli-loc"), "--locale", "xx"], base).code).toBe(2);
  });
  test("a layer the instance needs is not on disk: exits 2, naming it, rather than judging its glossary as the instance's own", () => {
    const root = acme("cli-absent");
    const decl = JSON.parse(readFileSync(join(root, "acme.json"), "utf-8"));
    writeFileSync(join(root, "acme.json"), JSON.stringify({ ...decl, needs: ["foundation"] }));
    const r = run(["--check", "--instance", root, "--locale", "fr"], base);
    expect(r.code).toBe(2);
    expect(r.out).toContain("`foundation`");
    expect(r.out).toContain("mount the layers");
  });
  test("without --check it writes the qa-results record, one family per locale", () => {
    const root = acme("cli-write");
    run(["--instance", root], base);
    const rec = JSON.parse(readFileSync(join(root, "test", "results", "glossary-consistency.qa-results.json"), "utf-8"));
    expect(rec.$schema).toBe("qa-results/v1");
    expect(rec.subject).toEqual({ kind: "glossary-consistency", id: "acme" });
    expect(Object.keys(rec.families)).toEqual(["fr"]);
    expect(rec.families.fr.count).toBe(1);
  });
});

describe("the KG QA report's Glossary consistency section", () => {
  test("one sub-section per locale, its findings in a table", () => {
    const rec = glossaryResult("acme", [
      { locale: "fr", fixedTerms: 3, catalogues: 2, sense: [], pending: [], otherSense: [], exceptions: [], findings: [{ rule: "inconsistent", term: "Actor", rendering: ["a.po: Acteur", "b.po: Intervenant"] }] },
      { locale: "ar", fixedTerms: 3, catalogues: 2, sense: [], pending: [], otherSense: [], exceptions: [], findings: [] },
    ]);
    const md = glossaryConsistencyMarkdown(rec, { href: "assets/kg-qa/acme/glossary-consistency.qa-results.json", level: 3 }).join("\n");
    expect(md).toContain("### Glossary consistency");
    expect(md).toContain("#### fr");
    expect(md).toContain("#### ar");
    expect(md).toContain("| `inconsistent` | Actor |");
    expect(md).toContain("No findings.");
  });
});

// ── in sense: by rule, then by an adjudicator ───────────────────

const PLATFORM_IRI = "https://example.org/t/actor";
/** A scheme entry with its definition, as `glossary:pot` writes one. */
const schemeTerm = (id: string, str: string, def: string, defStr: string) =>
  `\n#. Glossary term label: https://example.org/t/${id.toLowerCase()}\nmsgid "${id}"\nmsgstr "${str}"\n` +
  `\n#. Glossary term definition: https://example.org/t/${id.toLowerCase()}\nmsgid "${def}"\nmsgstr "${defStr}"\n`;

/**
 * `sense`: a layer whose own glossary fixes "Health worker", below a
 * platform layer (`core`, another subject area) that fixes "Actor", and one
 * content catalogue per locale.
 */
function senseInstance(dir: string, locales: Record<string, { hw: string; actor: string; page: string }>): { root: string; sources: (l: string) => GlossarySource[] } {
  const root = join(base, dir);
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "acme.json"),
    JSON.stringify({ name: "acme", directories: [{ id: "translations", path: "translations/", graphTypologies: ["translation-sources"] }] }),
  );
  for (const [l, t] of Object.entries(locales)) {
    mkdirSync(join(root, "translations", l, "glossary"), { recursive: true });
    writeFileSync(join(root, "translations", l, "glossary", "acme--terms.po"), HEADER + label("Health worker", t.hw));
    writeFileSync(join(root, "translations", l, "page.po"), HEADER + t.page);
    w(`${dir}-core/${l}/glossary/core--terms.po`, HEADER + schemeTerm("Actor", t.actor, "A participant that takes on roles.", "x"));
  }
  return {
    root,
    sources: (l) => [{ layer: "core", file: join(base, `${dir}-core`, l, "glossary", "core--terms.po"), reference: false }, ...glossarySources(root, l)],
  };
}

const ACTOR_SENTENCE = "Each actor signs the record.";
const verdict = (v: GlossarySenseVerdict["verdict"], msgid = ACTOR_SENTENCE, reason = "a person in the journey, not a platform actor"): GlossarySenseVerdict => ({
  term: PLATFORM_IRI,
  label: "actor",
  msgidSha256: msgidSha256(msgid),
  verdict: v,
  reason,
  decidedBy: "adjudicator-1",
});
const verdicts = (...vs: GlossarySenseVerdict[]) => new Map(vs.map((v) => [senseKey(v.term, v.msgidSha256), v]));

describe("in sense: by rule, then by an adjudicator", () => {
  const fr = {
    hw: "Agent de santé",
    actor: "Acteur",
    page: plain("Every health worker signs in.", "Chaque soignant se connecte.") + plain(ACTOR_SENTENCE, "Chaque intervenant signe le dossier."),
  };

  test("a use in the term's own subject area is in sense by rule, and a msgstr without the fixed term fails", () => {
    const { root, sources } = senseInstance("sense-rule", { fr });
    const r = checkLocale(root, join(root, "translations"), "fr", [], sources("fr"), new Map());
    expect(r.findings.map((f) => [f.rule, f.term, f.inSense])).toEqual([["not-fixed-rendering", "Health worker", "rule"]]);
  });

  test("a use of another area's term is pending: listed with its term id, definition and sentence, never a finding", () => {
    const { root, sources } = senseInstance("sense-pending", { fr });
    const r = checkLocale(root, join(root, "translations"), "fr", [], sources("fr"), new Map());
    expect(r.findings.some((f) => f.term === "Actor")).toBe(false);
    expect(r.pending).toHaveLength(1);
    expect(r.pending[0]).toMatchObject({
      term: "Actor",
      termId: PLATFORM_IRI,
      definition: "A participant that takes on roles.",
      msgid: ACTOR_SENTENCE,
      msgidSha256: msgidSha256(ACTOR_SENTENCE),
    });
  });

  test("an other-sense verdict checks nothing; an in-sense verdict is enforced", () => {
    const { root, sources } = senseInstance("sense-verdicts", { fr });
    const other = checkLocale(root, join(root, "translations"), "fr", [], sources("fr"), verdicts(verdict("other-sense")));
    expect(other.pending).toEqual([]);
    expect(other.otherSense.map((o) => o.term)).toEqual(["Actor"]);
    expect(other.findings.some((f) => f.term === "Actor")).toBe(false);
    const inSense = checkLocale(root, join(root, "translations"), "fr", [], sources("fr"), verdicts(verdict("in-sense")));
    expect(inSense.findings.filter((f) => f.term === "Actor").map((f) => f.inSense)).toEqual(["adjudicated"]);
  });

  test("a changed msgid invalidates its verdict: the use is pending again", () => {
    const { root, sources } = senseInstance("sense-changed", { fr });
    const r = checkLocale(root, join(root, "translations"), "fr", [], sources("fr"), verdicts(verdict("other-sense", "Each actor signs the old record.")));
    expect(r.otherSense).toEqual([]);
    expect(r.pending.map((o) => o.term)).toEqual(["Actor"]);
  });

  test("an exception passes and is listed, for an adjudicated use and for one in sense by rule", () => {
    const { root, sources } = senseInstance("sense-exception", { fr });
    const hw: GlossarySenseVerdict = {
      term: "https://example.org/t/health worker",
      msgidSha256: msgidSha256("Every health worker signs in."),
      verdict: "exception",
      reason: "the sign-in screen names the role as the app does",
      decidedBy: "adjudicator-1",
    };
    const r = checkLocale(root, join(root, "translations"), "fr", [], sources("fr"), verdicts(verdict("exception"), hw));
    expect(r.findings).toEqual([]);
    expect(r.exceptions.map((o) => [o.term, o.verdict?.reason]).sort()).toEqual([
      ["Actor", "a person in the journey, not a platform actor"],
      ["Health worker", "the sign-in screen names the role as the app does"],
    ]);
  });

  test("zh matches the fixed term as a substring; ru by stem, a 4-letter word by its first three letters", () => {
    expect(renders("行动者", "每个行动者签署记录", "zh")).toBe(true);
    expect(renders("行动者", "每个参与者签署记录", "zh")).toBe(false);
    expect(renders("сеть доверия", "в сети доверия", "ru")).toBe(true);
    expect(renders("медицинский работник", "медицинского работника", "ru")).toBe(true);
    expect(renders("сеть доверия", "в системе доверия", "ru")).toBe(false);
    const { root, sources } = senseInstance("sense-zh-ru", {
      zh: { hw: "卫生工作者", actor: "行动者", page: plain("Every health worker signs in.", "每位卫生工作者登录。") },
      ru: { hw: "медицинский работник", actor: "участник", page: plain("Every health worker signs in.", "Каждый медицинский работник входит.") },
    });
    for (const l of ["zh", "ru"]) expect(checkLocale(root, join(root, "translations"), l, [], sources(l), new Map()).findings).toEqual([]);
  });

  test("the English term kept verbatim renders it only as part of a code or resource name", () => {
    expect(keptAsName("WHO", "against WHO SMART Trust PHW", "par rapport à WHO SMART Trust PHW")).toBe(true);
    expect(keptAsName("verifier", "Provenance.agent (verifier)", "Provenance.agent (verifier)")).toBe(true);
    expect(keptAsName("Reference", "Reference(Patient)", "Reference(Patient)")).toBe(true);
    expect(keptAsName("Verifiable Health Link", 'its title, "Receiver of Verifiable Health Link"', 'son titre, « Receiver of Verifiable Health Link »')).toBe(true);
    expect(keptAsName("WHO", "the guidance WHO publishes", "les orientations que WHO publie")).toBe(false); // prose
    expect(keptAsName("health worker", "a health worker signs", "a health worker signe")).toBe(false);
  });
});

describe("the verdict store and the adjudicator's entry points", () => {
  test("--pending --json asks each use once across locales, with term, definition and sentence; it exits 0", () => {
    // Sense is a property of the English: the same use pending in fr and es is one question.
    const occ = (l: string) => ({
      term: "Actor", termId: PLATFORM_IRI, definition: "A participant that takes on roles.", fixed: "x", layer: "core", scope: "core--terms",
      catalogue: `translations/${l}/page.po`, msgid: ACTOR_SENTENCE, msgidSha256: msgidSha256(ACTOR_SENTENCE), rendering: "y",
    });
    const result = (l: string) => ({ locale: l, fixedTerms: 1, catalogues: 1, findings: [], sense: [], pending: [occ(l)], otherSense: [], exceptions: [] });
    expect(pendingQuestions([result("fr"), result("es")])).toEqual([
      {
        term: PLATFORM_IRI,
        label: "Actor",
        definition: "A participant that takes on roles.",
        scope: "core--terms",
        layer: "core",
        msgid: ACTOR_SENTENCE,
        msgidSha256: msgidSha256(ACTOR_SENTENCE),
        locales: ["fr", "es"],
        catalogues: ["translations/<locale>/page.po"],
      },
    ]);
    const { root } = senseInstance("sense-cli-pending", { fr: { hw: "Agent de santé", actor: "Acteur", page: plain(ACTOR_SENTENCE, "Chaque intervenant signe.") } });
    const r = run(["--check", "--instance", root, "--all-locales", "--pending", "--json"], base);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toMatchObject({ instance: "acme", store: "translations/glossary-sense.json", pending: [] });
  });

  test("--record merges verdicts keyed by term and msgid hash; the check then lists them, and exits 1 only on an in-sense violation", () => {
    const { root } = senseInstance("sense-cli-record", {
      fr: { hw: "Agent de santé", actor: "Acteur", page: plain("Clinic hours", "Heures") + plain("A health worker arrives.", "Un agent de santé arrive.") },
    });
    // The layer's own terminology pins a term of its own area.
    writeFileSync(join(root, "translations", "fr", "glossary.po"), HEADER + "\n#. A place of care.\nmsgid \"Clinic\"\nmsgstr \"Clinique\"\n");
    const fails = run(["--check", "--instance", root, "--locale", "fr"], base);
    expect(fails.code).toBe(1);
    expect(fails.out).toContain("✗ fr not-fixed-rendering «Clinic» → «Clinique»");
    const file = w("sense-cli-record-verdicts.json", JSON.stringify([
      { term: "acme--terminology#clinic", msgid: "Clinic hours", verdict: "exception", reason: "the column header the app prints", decidedBy: "adjudicator-1" },
    ]));
    const rec = run(["--check", "--instance", root, "--record", file], base);
    expect(rec.code).toBe(0);
    const store = GlossarySenseStoreSchema.parse(JSON.parse(readFileSync(join(root, "translations", "glossary-sense.json"), "utf-8")));
    expect(store.verdicts.map((v) => [v.term, v.msgidSha256])).toEqual([["acme--terminology#clinic", msgidSha256("Clinic hours")]]);
    const passes = run(["--check", "--instance", root, "--locale", "fr"], base);
    expect(passes.code).toBe(0);
    expect(passes.out).toContain("· fr exception «Clinic»");
    // A verdict without its reason is refused, and nothing is written.
    const bad = w("sense-cli-record-bad.json", JSON.stringify([{ term: "x", msgid: "y", verdict: "in-sense", decidedBy: "a" }]));
    expect(run(["--check", "--instance", root, "--record", bad], base).code).toBe(2);
  });

  test("the store refuses two verdicts on one use", () => {
    const v = verdict("in-sense");
    expect(GlossarySenseStoreSchema.safeParse({ $schema: "glossary-sense/v1", verdicts: [v] }).success).toBe(true);
    expect(GlossarySenseStoreSchema.safeParse({ $schema: "glossary-sense/v1", verdicts: [v, { ...v, verdict: "other-sense" }] }).success).toBe(false);
  });

  test("the KG QA report lists in-sense violations, exceptions, pending and other-sense uses", () => {
    const occ = { term: "Actor", termId: PLATFORM_IRI, fixed: "Acteur", layer: "core", scope: "core--terms", catalogue: "translations/fr/page.po", msgid: ACTOR_SENTENCE, msgidSha256: msgidSha256(ACTOR_SENTENCE), rendering: "x" };
    const rec = glossaryResult("acme", [
      {
        locale: "fr",
        fixedTerms: 2,
        catalogues: 1,
        sense: [],
        findings: [{ rule: "not-fixed-rendering", term: "Health worker", fixed: "Agent de santé", layer: "acme", catalogue: "translations/fr/page.po", msgid: "m", rendering: "r", inSense: "rule" }],
        pending: [occ],
        otherSense: [{ ...occ, verdict: verdict("other-sense") }],
        exceptions: [{ ...occ, verdict: verdict("exception", ACTOR_SENTENCE, "the app's own label") }],
      },
    ]);
    expect(rec.total).toBe(1); // only the violation counts
    const md = glossaryConsistencyMarkdown(rec, { href: "r.json", level: 3 }).join("\n");
    expect(md).toContain("1 finding(s), 1 of them in-sense violation(s)");
    expect(md).toContain("| `not-fixed-rendering` (in sense by rule) | Health worker |");
    expect(md).toContain("##### Pending adjudication");
    expect(md).toContain("##### Other sense");
    expect(md).toContain("##### Exceptions");
    expect(md).toContain("the app's own label (adjudicator-1)");
  });
});

describe("in an index run, the gate judges the caller's own instances", () => {
  test("only own instance paths that declare translation-sources are judged; none named means the harness, as before", () => {
    acme("own-ig");
    acme("own-plain", false);
    const env = { CAT_GATE_OWN_PATHS: "own-ig,own-plain,missing" };
    expect(ownTranslationRoots(base, env)).toEqual([join(base, "own-ig")]);
    expect(ownTranslationRoots(base, { CAT_GATE_OWN_PATHS: "own-plain" })).toEqual([]);
    expect(ownTranslationRoots(base, {})).toBeUndefined();
  });
});

describe("a fixed translation's parenthetical gloss", () => {
  test("the term rendered without the fixed translation's parenthetical gloss still renders it", () => {
    expect(renders("Infrastructure à clés publiques (ICP)", "Gère l'infrastructure à clés publiques du participant.", "fr")).toBe(true);
    expect(renders("Servicio de confianza (Trusted Service)", "un servicio de confianza prestado por un nodo", "es")).toBe(true);
    expect(renders("Infrastructure à clés publiques (ICP)", "Gère les clés du participant.", "fr")).toBe(false);
    expect(renders("公钥基础设施（PKI）", "管理参与者的公钥基础设施。", "zh")).toBe(true);
  });
});
