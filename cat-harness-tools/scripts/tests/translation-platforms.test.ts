/**
 * Translation platforms as candidate sources: the layout each platform
 * reads, and a platform's `.po` rewritten into candidates — never verdicts.
 * Fixtures only; nothing here touches the network.
 *
 * @covers translation-sources
 */
import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { candidatesProblems, poEntries, type CandidatesFile } from "../lib/translation-adjudication.ts";
import {
  blankTranslations,
  BRANCH_PREFIX,
  catalogueLayout,
  crowdinYml,
  declaredTranslationsDir,
  flagStateHints,
  importPlatformPo,
  platformFiles,
  poPathParts,
  resourceSlug,
  rewriteSubject,
  stateKey,
  transifexConfig,
  transifexYml,
  weblateComponents,
  weblateStateHints,
} from "../lib/translation-sources/platforms.ts";

const POT = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"

#: docs/index.md:3
msgid "Hello"
msgstr ""

#: docs/index.md:5
msgid "World"
msgstr ""

#: docs/index.md:7
msgctxt "menu"
msgid "File"
msgstr ""

msgid "One"
msgid_plural "Many"
msgstr[0] ""
msgstr[1] ""
`;

/** The base: "Hello" translated, the rest empty. */
const BASE = POT.replace('msgid "Hello"\nmsgstr ""', 'msgid "Hello"\nmsgstr "Bonjour"').replace('"Content-Type', '"Language: fr\\n"\n"Content-Type');

/** What a platform sends: a different Hello, a new World (fuzzy there), File, plural, and a string not in the base. */
const INCOMING = BASE.replace('msgstr "Bonjour"', 'msgstr "Salut"')
  .replace('msgid "World"\nmsgstr ""', '#, fuzzy\nmsgid "World"\nmsgstr "Monde"')
  .replace('msgid "File"\nmsgstr ""', 'msgid "File"\nmsgstr "Fichier"')
  .replace('msgstr[0] ""\nmsgstr[1] ""', 'msgstr[0] "Un"\nmsgstr[1] "Plusieurs"')
  .concat('\nmsgid "Extra"\nmsgstr "En plus"\n');

const AT = "2026-11-14T00:00:00.000Z";
const find = (text: string, msgid: string) => poEntries(text).find((e) => e.msgid === msgid)!;

function layer(): string {
  const root = mkdtempSync(join(tmpdir(), "tr-plat-"));
  writeFileSync(join(root, "layer.json"), JSON.stringify({
    $schema: "cat-harness-declaration/1.0.0",
    name: "layer",
    directories: [{ id: "tr", path: "translations/", graphTypologies: ["translation-sources"] }],
  }));
  for (const loc of ["fr", "pt-BR"]) {
    mkdirSync(join(root, "translations", loc, "docs"), { recursive: true });
    writeFileSync(join(root, "translations", loc, "docs", "index.pot"), POT);
  }
  mkdirSync(join(root, "translations", "fr", "guides"), { recursive: true });
  writeFileSync(join(root, "translations", "fr", "guides", "start.pot"), POT);
  writeFileSync(join(root, "translations", "fr", "docs", "index.po"), BASE);
  writeFileSync(join(root, "translations", "glossary-sense.json"), "{}");
  return root;
}

describe("push: the layout each platform reads", () => {
  test("the declared translations directory is read from the declaration", () => {
    const root = layer();
    expect(declaredTranslationsDir(root)).toBe(join(root, "translations/"));
    expect(declaredTranslationsDir(mkdtempSync(join(tmpdir(), "tr-none-")))).toBeUndefined();
  });

  test("catalogues come from the files: one per template, source in the first locale that has it", () => {
    const root = layer();
    const l = catalogueLayout(root, join(root, "translations"));
    expect(l.dir).toBe("translations");
    expect(l.locales).toEqual(["fr", "pt-BR"]);
    expect(l.catalogues).toEqual([
      { path: "docs/index", sourceLocale: "fr", translated: ["fr"] },
      { path: "guides/start", sourceLocale: "fr", translated: [] },
    ]);
    expect(l.divergent).toEqual([]);
  });

  test("template copies that differ in strings are reported; a header-only difference is not", () => {
    const root = layer();
    writeFileSync(join(root, "translations", "pt-BR", "docs", "index.pot"), POT.replace("charset=UTF-8", "charset=utf-8"));
    expect(catalogueLayout(root, join(root, "translations")).divergent).toEqual([]);
    writeFileSync(join(root, "translations", "pt-BR", "docs", "index.pot"), `${POT}\nmsgid "New"\nmsgstr ""\n`);
    expect(catalogueLayout(root, join(root, "translations")).divergent).toEqual(["docs/index"]);
  });

  test("crowdin.yml: a files entry per catalogue, tokens from the environment, region tags mapped", () => {
    const root = layer();
    const y = crowdinYml(catalogueLayout(root, join(root, "translations")));
    expect(y).toContain('project_id_env: "CROWDIN_PROJECT_ID"');
    expect(y).toContain('api_token_env: "CROWDIN_PERSONAL_TOKEN"');
    expect(y).toContain('- source: "/translations/fr/docs/index.pot"');
    expect(y).toContain('translation: "/translations/%two_letters_code%/docs/index.po"');
    expect(y).toContain('"pt-BR": "pt-BR"');
    expect(y).not.toMatch(/token:\s*"?[A-Za-z0-9]{20,}/);
  });

  test(".tx/config: placeholders until the owner names org and project; lang_map for region tags", () => {
    const root = layer();
    const l = catalogueLayout(root, join(root, "translations"));
    const t = transifexConfig(l);
    expect(t).toContain("[o:OWNER-SETS-ORGANIZATION:p:OWNER-SETS-PROJECT:r:docs--index]");
    expect(t).toContain("file_filter = translations/<lang>/docs/index.po");
    expect(t).toContain("source_file = translations/fr/docs/index.pot");
    expect(t).toContain("lang_map = pt_BR: pt-BR");
    expect(transifexConfig(l, { organization: "acme", project: "docs" })).toContain("[o:acme:p:docs:r:guides--start]");
    expect(transifexYml(l)).toContain("translation_files_expression: \"translations/<lang>/guides/start.po\"");
    expect(transifexYml(l)).toContain('pr_branch_name: "transifex_<br_unique_id>"');
  });

  test("resource slugs are safe and stay unique when long", () => {
    expect(resourceSlug("Processes/Bean Drain")).toBe("processes--bean_drain");
    const a = resourceSlug(`${"x".repeat(60)}/a`);
    const b = resourceSlug(`${"x".repeat(60)}/b`);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-z0-9_-]+$/);
  });

  test("Weblate: one gettext component per catalogue in the repository's layout, and the discovery rule", () => {
    const root = layer();
    const w = JSON.parse(weblateComponents(catalogueLayout(root, join(root, "translations")), { repository: "https://github.com/acme/layer.git" }));
    expect(w.components).toHaveLength(2);
    expect(w.components[0]).toMatchObject({
      file_format: "po",
      filemask: "translations/*/docs/index.po",
      new_base: "translations/fr/docs/index.pot",
      repo: "https://github.com/acme/layer.git",
      push_branch: BRANCH_PREFIX.weblate,
    });
    const re = new RegExp(`^${w.discovery.configuration.match.replace(/\(\?P</g, "(?<")}$`);
    expect(re.exec("translations/fr/docs/index.po")?.groups).toEqual({ language: "fr", component: "docs/index" });
  });

  test("every platform's files are named", () => {
    const root = layer();
    const l = catalogueLayout(root, join(root, "translations"));
    expect(platformFiles("crowdin", l).map((f) => f.path)).toEqual(["crowdin.yml"]);
    expect(platformFiles("transifex", l).map((f) => f.path)).toEqual([".tx/config", "transifex.yml"]);
    expect(platformFiles("weblate", l).map((f) => f.path)).toEqual(["weblate-components.json"]);
  });
});

describe("pull: a platform's strings become candidates, never verdicts", () => {
  const run = (extra: Partial<Parameters<typeof importPlatformPo>[0]> = {}) =>
    importPlatformPo({ platform: "crowdin", locale: "fr", catalogue: "docs/index", base: BASE, incoming: INCOMING, at: AT, ...extra });

  test("a translated string keeps the base's text; the platform's text is a candidate", () => {
    const r = run();
    expect(find(r.po, "Hello").msgstr).toBe("Bonjour");
    expect(find(r.po, "Hello").fuzzy).toBe(false);
    const e = r.candidates.entries.find((x) => x.msgid === "Hello")!;
    expect(e.candidates).toEqual([
      { text: "Salut", source: { kind: "web-service", id: "crowdin", at: AT }, metadata: { platformState: "translated" } } as never,
    ]);
    expect(candidatesProblems(r.candidates)).toEqual([]);
  });

  test("an empty msgstr takes the first candidate, fuzzy", () => {
    const r = run();
    expect(find(r.po, "World")).toMatchObject({ msgstr: "Monde", fuzzy: true });
    expect(find(r.po, "File")).toMatchObject({ msgctxt: "menu", msgstr: "Fichier", fuzzy: true });
    expect(r.filled.sort()).toEqual(["File", "World"]);
  });

  test("an 'approved' string on the platform is still only a candidate, with the state as metadata", () => {
    const hints = new Map([[stateKey("Hello"), "approved" as const]]);
    const r = run({ hints });
    expect(find(r.po, "Hello").msgstr).toBe("Bonjour");
    const c = r.candidates.entries.find((x) => x.msgid === "Hello")!.candidates[0] as unknown as { metadata: { platformState: string } };
    expect(c.metadata.platformState).toBe("approved");
    // The platform's own fuzzy wins over an export mode.
    const r2 = run({ exportMode: "approved" });
    const st = (id: string) => (r2.candidates.entries.find((x) => x.msgid === id)!.candidates[0] as unknown as { metadata: { platformState: string } }).metadata.platformState;
    expect(st("Hello")).toBe("approved");
    expect(st("World")).toBe("fuzzy");
  });

  test("an existing first candidate fills the empty msgstr, not the platform's", () => {
    const existing: CandidatesFile = {
      $schema: "translation-candidates/v1",
      locale: "fr",
      catalogue: "docs/index",
      entries: [{ msgid: "World", candidates: [{ text: "Univers", source: { kind: "agent", id: "claude" } }] }],
    };
    const r = run({ candidates: existing });
    expect(find(r.po, "World").msgstr).toBe("Univers");
    expect(r.candidates.entries.find((x) => x.msgid === "World")!.candidates.map((c) => c.text)).toEqual(["Univers", "Monde"]);
    expect(existing.entries[0]!.candidates).toHaveLength(1); // input untouched
  });

  test("plurals and strings not in the base are skipped, with reasons", () => {
    const r = run();
    expect(r.skipped.some((s) => s.includes('"One"') && s.includes("plural"))).toBe(true);
    expect(r.skipped.some((s) => s.includes('"Extra"') && s.includes("not in the base"))).toBe(true);
    expect(r.po).not.toContain("En plus");
    expect(find(r.po, "One").msgstr).toBe("");
  });

  test("importing the same strings twice adds no duplicate candidate", () => {
    const once = run();
    const twice = run({ base: once.po, candidates: once.candidates });
    expect(twice.added).toBe(0);
    expect(twice.candidates.entries.find((x) => x.msgid === "Hello")!.candidates).toHaveLength(1);
    expect(twice.po).toBe(once.po);
  });

  test("a catalogue the platform created starts blank, and only its strings' first candidates fill it, fuzzy", () => {
    const r = run({ base: undefined, platform: "weblate" });
    expect(find(r.po, "Hello")).toMatchObject({ msgstr: "Salut", fuzzy: true });
    expect(find(r.po, "One").msgstr).toBe("");
    expect(r.po).toContain('msgstr[1] ""');
    expect(r.candidates.entries.every((e) => e.candidates.every((c) => c.source.id === "weblate"))).toBe(true);
  });

  test("blankTranslations clears every msgstr, multi-line and plural, and keeps the rest", () => {
    const multi = `${BASE}\nmsgid "Long"\nmsgstr ""\n"une "\n"longue"\n`;
    const b = blankTranslations(multi.replace('msgstr[0] ""', 'msgstr[0] "Un"'));
    expect(poEntries(b).every((e) => e.msgstr === "")).toBe(true);
    expect(b).not.toContain('"longue"');
    expect(b).toContain('"Language: fr\\n"');
    expect(b).toContain("#: docs/index.md:3");
  });

  test("platform state exports", () => {
    const w = weblateStateHints({ results: [
      { source: ["Hello"], context: "", state: 30 },
      { source: ["File"], context: "menu", state: 20 },
      { source: ["World"], context: "", state: 10 },
    ] });
    expect(w.get(stateKey("Hello"))).toBe("approved");
    expect(w.get(stateKey("File", "menu"))).toBe("translated");
    expect(w.get(stateKey("World"))).toBe("fuzzy");
    const f = flagStateHints([{ msgid: "Hello", approved: true }, { msgid: "World", reviewed: false }]);
    expect(f.get(stateKey("Hello"))).toBe("approved");
    expect(f.get(stateKey("World"))).toBe("translated");
  });

  test("changed paths outside the translations directory, or escaping it, are not catalogues", () => {
    expect(poPathParts("translations", "translations/fr/docs/index.po")).toEqual({ locale: "fr", catalogue: "docs/index" });
    expect(poPathParts("translations", "docs/fr/index.po")).toBeUndefined();
    expect(poPathParts("translations", "translations/fr/../../x.po")).toBeUndefined();
    expect(poPathParts("translations", "translations/fr/not-a-catalogue.pot")).toBeUndefined();
    expect(poPathParts("translations", "translations/NOTALOCALE/x.po")).toBeUndefined();
  });
});

describe("the CLI on a platform's branch (a local git repository)", () => {
  const git = (cwd: string, ...a: string[]) => execFileSync("git", ["-C", cwd, "-c", "user.name=t", "-c", "user.email=t@example.invalid", ...a], { encoding: "utf-8" });
  const cli = join(import.meta.dir, "..", "translation-platforms.ts");

  test("import rewrites the branch's .po changes into candidates; export --check notices drift", () => {
    const root = layer();
    git(root, "init", "-q", "-b", "main");
    git(root, "add", ".");
    git(root, "commit", "-q", "-m", "base");
    git(root, "switch", "-q", "-c", "l10n_main");
    writeFileSync(join(root, "translations", "fr", "docs", "index.po"), INCOMING);
    writeFileSync(join(root, "translations", "pt-BR", "docs", "index.po"), INCOMING.replace("Language: fr", "Language: pt-BR"));
    git(root, "commit", "-q", "-am", "crowdin");
    git(root, "add", ".");
    git(root, "commit", "-q", "-m", "crowdin new catalogue");

    const summary = join(root, "summary.md");
    const r = spawnSync("bun", ["run", cli, "import", "--platform", "crowdin", "--base", "main", "--root", root, "--repo-root", root, "--summary", summary], { encoding: "utf-8" });
    expect(r.status).toBe(0);
    const fr = readFileSync(join(root, "translations", "fr", "docs", "index.po"), "utf-8");
    expect(find(fr, "Hello").msgstr).toBe("Bonjour");
    const side = JSON.parse(readFileSync(join(root, "translations", "fr", "docs", "index.candidates.json"), "utf-8"));
    expect(candidatesProblems(side)).toEqual([]);
    expect(side.entries.find((e: { msgid: string }) => e.msgid === "Hello").candidates[0].text).toBe("Salut");
    const pt = readFileSync(join(root, "translations", "pt-BR", "docs", "index.po"), "utf-8");
    // A catalogue the platform created in a region-tagged locale: its strings
    // are candidates like any other, the empty ones filled fuzzy, and its new
    // node is labelled `trans:pt-BR/…` (the owner, 2026-11-14: BCP 47 tags).
    expect(find(pt, "Hello")).toMatchObject({ msgstr: "Salut", fuzzy: true });
    const ptSide = JSON.parse(readFileSync(join(root, "translations", "pt-BR", "docs", "index.candidates.json"), "utf-8"));
    expect(candidatesProblems(ptSide)).toEqual([]);
    const ptNode = JSON.parse(readFileSync(join(root, "translations", "pt-BR", "docs", "index.json"), "utf-8"));
    expect(ptNode).toMatchObject({ label: "trans:pt-BR/docs/index", locale: "pt-BR", status: { locale: "pt-BR", official: false } });
    const said = readFileSync(summary, "utf-8");
    expect(said).toContain("never an adjudicator");
    expect(said).not.toContain("candidates NOT recorded");
    expect(said).toMatch(/pt-BR\/docs\/index\.po`: \d+ candidate\(s\) from crowdin/);
    const meta = side.entries.find((e: { msgid: string }) => e.msgid === "World").candidates[0];
    expect(meta).toMatchObject({ text: "Monde", source: { kind: "web-service", id: "crowdin" }, metadata: { platformState: "fuzzy" } });

    // Nothing new on a second run.
    git(root, "add", ".");
    git(root, "commit", "-q", "-m", rewriteSubject("crowdin"));
    const again = spawnSync("bun", ["run", cli, "import", "--platform", "crowdin", "--base", "main", "--root", root, "--repo-root", root], { encoding: "utf-8" });
    expect(again.status).toBe(3);
    expect(execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf-8" })).toBe("");

    // The platform syncs again (its own text back over ours): re-imported, no duplicate, state kept.
    writeFileSync(join(root, "translations", "fr", "docs", "index.po"), INCOMING);
    git(root, "commit", "-q", "-am", "crowdin sync");
    expect(spawnSync("bun", ["run", cli, "import", "--platform", "crowdin", "--base", "main", "--root", root, "--repo-root", root]).status).toBe(0);
    const fr2 = readFileSync(join(root, "translations", "fr", "docs", "index.po"), "utf-8");
    expect(find(fr2, "Hello").msgstr).toBe("Bonjour");
    expect(find(fr2, "File")).toMatchObject({ msgstr: "Fichier", fuzzy: true });
    const side2 = JSON.parse(readFileSync(join(root, "translations", "fr", "docs", "index.candidates.json"), "utf-8"));
    const file2 = side2.entries.find((e: { msgid: string }) => e.msgid === "File").candidates;
    expect(file2).toHaveLength(1);
    expect(file2[0].metadata.platformState).toBe("translated");

    // export --check: absent is fine, written is current, a new template is drift.
    const check = () => spawnSync("bun", ["run", cli, "export", "--platform", "crowdin", "--root", root, "--repo-root", root, "--check"], { encoding: "utf-8" }).status;
    expect(check()).toBe(0);
    expect(spawnSync("bun", ["run", cli, "export", "--platform", "crowdin", "--root", root, "--repo-root", root, "--write"]).status).toBe(0);
    expect(check()).toBe(0);
    mkdirSync(join(root, "translations", "fr", "extra"), { recursive: true });
    writeFileSync(join(root, "translations", "fr", "extra", "more.pot"), POT);
    expect(check()).toBe(1);
  });
});
