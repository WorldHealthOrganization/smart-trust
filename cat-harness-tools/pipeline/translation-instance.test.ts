/**
 * `--instance <dir>` on the translation scripts, and the catalogue pass of
 * `translation-block-qa.ts`, run against a downstream layer that is not this
 * one: it declares `translation-sources`, has no Jekyll site, and its pages live
 * outside any site (as an IG's `input/pagecontent/` do).
 *
 * Each script is run as its CLI, because the option is a CLI fact: the resolved
 * root, the exit code and what is written are what a translation watcher sees.
 *
 * Run: bun test pipeline/translation-instance.test.ts
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { explicitInstanceRoot, TOOLS_ROOT } from "../scripts/lib/roots.ts";
import { catalogueDriftFor } from "./translation-drift.ts";
import { cataloguePairs } from "./translation-block-qa.ts";

const HEADER = 'msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n';
const entry = (ref: string, id: string, str: string) => `\n#: ${ref}\nmsgid "${id}"\nmsgstr "${str}"\n`;

/** A downstream layer: one page, its template, and a French catalogue one source change behind. */
function makeInstance(root: string, opts: { declare?: boolean } = {}): void {
  mkdirSync(join(root, "input"), { recursive: true });
  mkdirSync(join(root, "translations", "fr", "glossary"), { recursive: true });
  writeFileSync(
    join(root, "acme.json"),
    JSON.stringify({
      name: "acme",
      directories:
        opts.declare === false
          ? []
          : [{ id: "translations", path: "translations/", graphTypologies: ["translation-sources"] }],
    }),
  );
  writeFileSync(join(root, "input", "page.md"), "# Title\n\nFirst sentence here.\n\nSecond sentence, see WHO 2024.\n");
  writeFileSync(
    join(root, "translations", "fr", "page.pot"),
    HEADER +
      entry("input/page.md:1", "Title", "") +
      entry("input/page.md:3", "First sentence here.", "") +
      entry("input/page.md:5", "Second sentence, see WHO 2024.", ""),
  );
  // Behind its template: it lacks the new sentence and still offers a dropped one.
  writeFileSync(
    join(root, "translations", "fr", "page.po"),
    HEADER +
      entry("input/page.md:1", "Title", "Titre") +
      entry("input/page.md:3", "First sentence here.", "Première phrase ici.") +
      entry("input/page.md:9", "A sentence the page dropped.", "Une phrase retirée."),
  );
  // A glossary scheme: catalogued, in step with its template, and on no page.
  const g = entry("glossary/terms.json", "Health worker", "");
  writeFileSync(join(root, "translations", "fr", "glossary", "terms.pot"), HEADER + g);
  writeFileSync(
    join(root, "translations", "fr", "glossary", "terms.po"),
    HEADER + entry("glossary/terms.json", "Health worker", "Agent de santé"),
  );
  // A terminology file with no template: nothing to measure it against.
  writeFileSync(join(root, "translations", "fr", "glossary.po"), HEADER + entry("x", "WHO", "OMS"));
}

function run(script: string, args: string[], cwd: string): { code: number | null; out: string } {
  const r = spawnSync("bun", [join(TOOLS_ROOT, script), ...args], { cwd, encoding: "utf-8" });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

let base: string;
let inst: string;
let bare: string;
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "translation-instance-"));
  inst = join(base, "acme");
  bare = join(base, "bare");
  makeInstance(inst);
  makeInstance(bare, { declare: false });
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe("explicitInstanceRoot — the flag, or nothing", () => {
  test("absent means the caller keeps its own root", () => {
    expect(explicitInstanceRoot(["bun", "x.ts", "--check"])).toBeUndefined();
  });
  test("present names a declared instance", () => {
    expect(explicitInstanceRoot(["bun", "x.ts", "--instance", inst])).toBe(inst);
    expect(explicitInstanceRoot(["bun", "x.ts", `--instance=${inst}`])).toBe(inst);
  });
  test("a directory with no declaration is refused where it is named", () => {
    expect(() => explicitInstanceRoot(["bun", "x.ts", "--instance", join(base, "nowhere")])).toThrow(/no instance declaration/);
  });
});

describe("catalogueDriftFor — each catalogue against the template beside it", () => {
  test("reports what the template gained and what the catalogue still offers", () => {
    const r = catalogueDriftFor(inst)!;
    expect(r.compared).toBe(2); // page.po and glossary/terms.po; glossary.po has no .pot
    expect(r.drifted).toEqual([
      { po: "translations/fr/page.po", missing: ["Second sentence, see WHO 2024."], extra: ["A sentence the page dropped."] },
    ]);
  });
  test("an instance that declares no translations is undefined, never an empty list", () => {
    expect(catalogueDriftFor(bare)).toBeUndefined();
  });
});

describe("cataloguePairs — catalogues with a template, per locale", () => {
  test("finds page and glossary catalogues, skips one with no .pot", () => {
    const pairs = cataloguePairs(join(inst, "translations"), ["fr", "es"]);
    expect(pairs.map((p) => `${p.locale}/${p.rel}`)).toEqual(["fr/glossary/terms", "fr/page"]);
  });
});

describe("the four scripts take --instance", () => {
  test("translation:drift:check compares the instance's catalogues, and fails on drift", () => {
    const r = run("pipeline/translation-drift.ts", ["--instance", inst], base);
    expect(r.out).toContain("declares no Jekyll site");
    expect(r.out).toContain("translations/fr/page.po");
    expect(r.out).toContain("2 catalogue(s) in translations/ compared with their .pot, 1 drifted");
    expect(r.code).toBe(1);
  });
  test("translation:drift:check on an instance with no catalogues and no site cannot determine", () => {
    expect(run("pipeline/translation-drift.ts", ["--instance", bare], base).code).toBe(2);
  });
  test("translation:obsolete:check resolves an instance-relative source with no site", () => {
    const r = run("pipeline/obsolete-stale-po.ts", ["--check", "--instance", inst], base);
    expect(r.out).toContain("translations/fr/page.po  (source input/page.md)");
    expect(r.out).toContain("A sentence the page dropped.");
    expect(r.code).toBe(1);
  });
  test("translation:obsolete:check on an undeclared instance is not a pass", () => {
    expect(run("pipeline/obsolete-stale-po.ts", ["--check", "--instance", bare], base).code).toBe(2);
  });
  test("translation:index:check reports an instance with no site unreadable", () => {
    const r = run("pipeline/translation-index.ts", ["--check", "--instance", inst], base);
    expect(r.out).toContain("declares no Jekyll site");
    expect(r.code).toBe(2);
  });
  test("translation:status reports the instance's locales and writes nothing", () => {
    const r = run("scripts/gen-translation-status.ts", ["--instance", inst], base);
    expect(r.out).toContain("acme: translations/");
    // Three catalogues, two with a template: the terminology file has none.
    expect(r.out).toMatch(/fr\s+3 catalogue\(s\) of\s+2 template\(s\)/);
    expect(r.code).toBe(0);
    const j = run("scripts/gen-translation-status.ts", ["--instance", inst, "--json"], base);
    expect(JSON.parse(j.out).locales[0].locale).toBe("fr");
    expect(run("scripts/gen-translation-status.ts", ["--instance", bare], base).code).toBe(2);
  });
});

describe("translation:page-qa — catalogues with no block or page get a sidecar", () => {
  test("writes one translation-qa/v1 sidecar per translated catalogue, under the instance's QA tree", () => {
    const r = run("pipeline/translation-block-qa.ts", ["--catalogues", "--instance", inst], base);
    expect(r.code).toBe(0);
    const qa = join(inst, "test", "results", "translation-qa", "translations");
    const page = JSON.parse(readFileSync(join(qa, "page.fr.translation-qa.json"), "utf-8"));
    expect(page.$schema).toBe("translation-qa/v1");
    expect(page.label).toBe("trans:fr/page");
    expect(page.paths).toEqual({ pot: "translations/fr/page.pot" });
    expect(page.po).toBe("translations/fr/page.po");
    // 2 of the template's 3 strings: below 100, at or above 50 — the block rule.
    expect(page.criteria["translation-coverage"][0].result).toBe("warn");
    expect(page.criteria["translation-coverage"][0].metrics).toEqual({ translated: 2, total: 3, pct: 67 });
    expect(page.criteria["translation-semantic-roundtrip"]).toEqual([]);
    const gloss = JSON.parse(readFileSync(join(qa, "glossary", "terms.fr.translation-qa.json"), "utf-8"));
    expect(gloss.criteria["translation-coverage"][0].result).toBe("pass");
    // Nothing for the terminology file with no template.
    expect(existsSync(join(qa, "glossary.fr.translation-qa.json"))).toBe(false);
  });
  test("without --catalogues, nothing is written for them", () => {
    const fresh = join(base, "acme2");
    makeInstance(fresh);
    run("pipeline/translation-block-qa.ts", ["--instance", fresh], base);
    expect(existsSync(join(fresh, "test", "results", "translation-qa", "translations"))).toBe(false);
  });
});
