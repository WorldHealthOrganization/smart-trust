/**
 * check-translation-supplements: the FSH split, the pins, the read scope,
 * and real SUSHI runs over the fixture IG in
 * `test/support/translation-supplements/` (one CodeSystem and its French
 * supplement) with each bad supplement beside it.
 *
 * The SUSHI runs install the pinned SUSHI from `scripts/sushi/`'s lockfile
 * into a temporary directory (`npm ci --ignore-scripts`), never into the
 * layer's own tree, and fetch the pinned FHIR core package once for the file.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkTranslationSupplements,
  compilableFsh,
  exitCode,
  fhirVersionOf,
  fshEntities,
  judge,
  lockedSushiVersion,
  pinnedCorePackage,
  pinnedSushiVersion,
  readIgInputs,
  render,
  SUSHI_DIR,
} from "./check-translation-supplements.ts";

const FIXTURE = join(import.meta.dir, "..", "test", "support", "translation-supplements");
const IG = join(FIXTURE, "ig");

/** A copy of the fixture IG, with `extra` supplement files added to its translations. */
function igWith(...extra: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "ts-ig-"));
  cpSync(IG, dir, { recursive: true });
  for (const f of extra) copyFileSync(join(FIXTURE, "supplements", f), join(dir, "input", "fsh", "translations", f));
  return dir;
}

describe("pins", () => {
  test("the lockfile installs the SUSHI ig-toolchain.env pins", () => {
    expect(lockedSushiVersion()).toBe(pinnedSushiVersion());
  });
  test("the lockfile pins every package by integrity", () => {
    const lock = JSON.parse(readFileSync(join(SUSHI_DIR, "package-lock.json"), "utf8")) as {
      packages: Record<string, { integrity?: string; inBundle?: boolean }>;
    };
    for (const [k, p] of Object.entries(lock.packages)) {
      // A bundled package is inside its parent's tarball, which the parent's integrity covers.
      if (k === "" || p.inBundle) continue;
      expect(p.integrity, k).toMatch(/^sha512-/);
    }
  });
  test("the core packages for R4 and R5 are pinned by sha512; another version is not", () => {
    expect(pinnedCorePackage("4.0.1")?.integrity).toMatch(/^sha512-/);
    expect(pinnedCorePackage("5.0.0")?.name).toBe("hl7.fhir.r5.core");
    expect(pinnedCorePackage("3.0.2")).toBeUndefined();
  });
});

describe("the FSH split", () => {
  const text = readFileSync(join(IG, "input", "fsh", "codesystems.fsh"), "utf8");
  test("finds the entities, not a keyword inside a string or a comment", () => {
    expect(fshEntities(text).map((e) => `${e.keyword}:${e.name}`)).toEqual([
      "Alias:$colour",
      "RuleSet:Draft",
      "CodeSystem:ColourCS",
      "ValueSet:ColourVS",
    ]);
    expect(fshEntities(text).find((e) => e.keyword === "CodeSystem")?.id).toBe("colour");
  });
  test("keeps CodeSystems, Aliases and RuleSets only", () => {
    const kept = compilableFsh(text);
    expect(kept).toContain("CodeSystem: ColourCS");
    expect(kept).toContain("RuleSet: Draft");
    expect(kept).not.toContain("ValueSet: ColourVS");
  });
  test("a CodeSystem without Id: takes its name", () => {
    expect(fshEntities("CodeSystem: Plain\n* #a").at(0)?.id).toBe("Plain");
  });
});

describe("what is read", () => {
  test("the fixture's translations and definitions", () => {
    const ig = readIgInputs(IG)!;
    expect(ig.translations.map((t) => `${t.locale}:${t.rel}`)).toEqual(["fr:input/fsh/translations/fr.fsh"]);
    expect(ig.definitions.map((d) => d.rel)).toEqual(["input/fsh/codesystems.fsh"]);
    expect(fhirVersionOf(ig.sushiConfig)).toBe("4.0.1");
  });
  test("no translations directory is not applicable", async () => {
    const dir = igWith();
    rmSync(join(dir, "input", "fsh", "translations"), { recursive: true });
    const r = await checkTranslationSupplements(dir);
    expect(r.status).toBe("not-applicable");
    expect(exitCode(r)).toBe(0);
    rmSync(dir, { recursive: true });
  });
  test("a translations directory outside the declared scope is not read", async () => {
    const dir = igWith();
    writeFileSync(
      join(dir, "index.config.json"),
      JSON.stringify({ $schema: "folio-index-config/v1", instances: [], contentTypes: { ig: { include: ["sushi-config.yaml", "input/fsh/codesystems.fsh"] } } }),
    );
    expect(readIgInputs(dir)).toBeUndefined();
    expect((await checkTranslationSupplements(dir)).status).toBe("not-applicable");
    rmSync(dir, { recursive: true });
  });
  test("an undeclared sushi-config.yaml cannot run", async () => {
    const dir = igWith();
    writeFileSync(
      join(dir, "index.config.json"),
      JSON.stringify({ $schema: "folio-index-config/v1", instances: [], contentTypes: { ig: { include: ["input/fsh/"] } } }),
    );
    const r = await checkTranslationSupplements(dir);
    expect(r.status).toBe("cannot-run");
    expect(exitCode(r)).toBe(2);
    rmSync(dir, { recursive: true });
  });
});

describe("judge, without SUSHI", () => {
  const ig = readIgInputs(IG)!;
  const base = { id: "colour", url: "http://example.org/fhir/translations/CodeSystem/colour", content: "complete", concept: [{ code: "red" }, { code: "blue", concept: [{ code: "navy" }] }] };
  test("a good supplement has no findings", () => {
    const fr = { id: "colour-fr", content: "supplement", supplements: `${base.url}|0.1.0`, language: "fr", concept: [{ code: "navy", designation: [{ language: "fr", value: "Bleu marine" }] }] };
    expect(judge(ig, [base, fr])).toEqual([]);
  });
  test("a CodeSystem in a translation file that is not a supplement", () => {
    const fr = { id: "colour-fr", content: "complete", language: "fr" };
    expect(judge(ig, [base, fr]).map((f) => f.message)).toEqual(["ColourFr (colour-fr): content is complete, not supplement"]);
  });
});

describe("with SUSHI", () => {
  let work = "";
  let sushi = "";
  let tarballs = "";
  beforeAll(() => {
    work = mkdtempSync(join(tmpdir(), "ts-sushi-"));
    copyFileSync(join(SUSHI_DIR, "package.json"), join(work, "package.json"));
    copyFileSync(join(SUSHI_DIR, "package-lock.json"), join(work, "package-lock.json"));
    const npm = spawnSync("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: work, encoding: "utf8" });
    if (npm.status !== 0) throw new Error(`npm ci failed: ${npm.stderr}`);
    sushi = join(work, "node_modules", ".bin", "sushi");
    tarballs = join(work, "tarballs");
  }, 300_000);
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  const run = async (...extra: string[]) => {
    const dir = igWith(...extra);
    try {
      return await checkTranslationSupplements(dir, { sushi, tarballs });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const messages = (r: Awaited<ReturnType<typeof run>>) =>
    r.status === "pass" || r.status === "fail" ? [...r.sushiErrors.map((l) => `sushi: ${l}`), ...r.findings.map((f) => `${f.where}: ${f.message}`)] : [r.reason];

  test("the good supplement compiles with 0 errors and passes", async () => {
    const r = await run();
    expect(messages(r)).toEqual([]);
    expect(r.status).toBe("pass");
    expect(render(r)).toContain(`SUSHI ${pinnedSushiVersion()} on hl7.fhir.r4.core#4.0.1; 0 SUSHI errors; 1 CodeSystem(s); supplements: fr 1`);
  }, 120_000);

  test("the bad supplement: unknown code, wrong language, a designation in a third language", async () => {
    const r = await run("es.fsh");
    expect(r.status).toBe("fail");
    expect(exitCode(r)).toBe(1);
    expect(messages(r)).toEqual([
      "input/fsh/translations/es.fsh: ColourEs (colour-es): codes not in colour: purple",
      "input/fsh/translations/es.fsh: ColourEs (colour-es): language is pt, the file's locale is es",
      "input/fsh/translations/es.fsh: ColourEs (colour-es): red has a designation in de, the supplement is in pt",
    ]);
  }, 120_000);

  test("a supplement of a CodeSystem the IG lacks fails on SUSHI's error and on the check", async () => {
    const r = await run("it.fsh");
    expect(r.status).toBe("fail");
    expect(messages(r)).toEqual([
      "sushi: Cannot use canonical URL of ShapeCS because it does not exist. Be sure that ShapeCS exists and it has a URL.",
      "input/fsh/translations/it.fsh: ShapeIt (shape-it): supplements nothing, which is not a CodeSystem of this IG",
    ]);
  }, 120_000);

  test("a duplicated id is named once, with both files", async () => {
    const r = await run("de.fsh");
    expect(r.status).toBe("fail");
    expect(messages(r)).toEqual([
      "sushi: Multiple code systems with id colour-fr. Each code system must have a unique id.",
      "input/fsh/translations/de.fsh: CodeSystem id colour-fr is used 2 times (input/fsh/translations/de.fsh, input/fsh/translations/fr.fsh)",
    ]);
  }, 120_000);

  test("a SUSHI that is not the pinned version is refused", async () => {
    const fake = join(work, "fake-sushi");
    writeFileSync(fake, "#!/bin/sh\necho 'SUSHI v9.9.9'\n", { mode: 0o755 });
    const dir = igWith();
    const r = await checkTranslationSupplements(dir, { sushi: fake, tarballs });
    rmSync(dir, { recursive: true, force: true });
    expect(r.status).toBe("cannot-run");
    expect(messages(r)[0]).toContain(`is SUSHI 9.9.9, not the pinned ${pinnedSushiVersion()}`);
  });
});
