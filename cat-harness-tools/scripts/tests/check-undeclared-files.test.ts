/**
 * The reverse sweep: present-but-undeclared, which is `dh4f` inverted.
 *
 * Written against synthetic repositories rather than only against this one,
 * because a sweep tested solely on the tree it was written beside agrees with
 * whatever that tree happens to contain. The live assertions at the end are the
 * second half, not the whole test.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  ROOT_INFRASTRUCTURE,
  accountedRootPaths,
  holdsOnlyIgnored,
  humanBytes,
  undeclaredAtRoot,
} from "../check-undeclared-files.js";
import { findDeclarationFile } from "../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";

/** A repository with one layer, which declares a repository-scoped directory. */
function repo(): string {
  const root = mkdtempSync(join(tmpdir(), "undeclared-"));
  mkdirSync(join(root, "an-instance"), { recursive: true });
  writeDeclaration(join(root, "an-instance"), JSON.stringify(
      {
        name: "an-instance",
        directories: [
          { id: "work", path: "work/", graphTypologies: ["beans"], scope: "repository" },
          { id: "own", path: "own/", graphTypologies: ["schemas"] },
        ],
      },
      null,
      2,
    ));
  mkdirSync(join(root, "work"), { recursive: true });
  writeFileSync(join(root, "package.json"), "{}");
  return root;
}

describe("an instance is accounted for because it DECLARES itself", () => {
  test("a directory holding harness.json is not a finding", () => {
    const root = repo();
    expect(undeclaredAtRoot(root).map((e) => e.path)).not.toContain("an-instance");
  });

  test("and the reason says so, rather than naming it in a list", () => {
    // A new layer is accounted for the moment it exists, not when somebody
    // remembers to add it. That is the property; this is the evidence.
    expect(accountedRootPaths(repo()).get("an-instance")).toContain("declares itself");
  });
});

describe("a repository-scoped declared directory is accounted for", () => {
  test("`work/` at the root is named by the instance's declaration", () => {
    const root = repo();
    expect(undeclaredAtRoot(root).map((e) => e.path)).not.toContain("work");
    expect(accountedRootPaths(root).get("work")).toContain("an-instance");
  });

  test("an INSTANCE-scoped directory of the same name would NOT account for a root one", () => {
    // `own/` is declared without a scope, so it resolves inside the layer.
    // A root-level `own/` is a different directory, and conflating the two is
    // how a sweep reports a clean run over something nothing names.
    const root = repo();
    mkdirSync(join(root, "own"), { recursive: true });
    writeFileSync(join(root, "own", "stray.txt"), "x");
    expect(undeclaredAtRoot(root).map((e) => e.path)).toContain("own");
  });
});

describe("the ROOT may itself be an instance", () => {
  /** `repo()` plus a root `harness.json` declaring one directory of its own. */
  function repoWithRootInstance(): string {
    const root = repo();
    writeDeclaration(root, JSON.stringify(
        { name: "the-repo", directories: [{ id: "uploads", path: "uploads/", graphTypologies: ["uploads"] }] },
        null,
        2,
      ));
    mkdirSync(join(root, "uploads"), { recursive: true });
    writeFileSync(join(root, "uploads", "dropped.pdf"), "x");
    return root;
  }

  test("its declared directory is accounted for, and the reason names the declaration", () => {
    // Owner, 2026-09-20: "only uploads/ on this repo's root b/c acting as if it
    // was intialized". This sweep was written when the root was deliberately
    // NOT a layer and reported 19.4 MB of correctly declared content as
    // unaccounted the moment that changed.
    const root = repoWithRootInstance();
    expect(undeclaredAtRoot(root).map((e) => e.path)).not.toContain("uploads");
    expect(accountedRootPaths(root).get("uploads")).toContain("the-repo");
  });

  test("the root's own harness.json is accounted for", () => {
    expect(accountedRootPaths(repoWithRootInstance()).get(findDeclarationFile(repoWithRootInstance())!)).toContain("own declaration");
  });

  test("a root instance does NOT account for what it does not declare", () => {
    // The falsifier. Without this, "read the root declaration" is
    // indistinguishable from "stop reporting root directories".
    const root = repoWithRootInstance();
    mkdirSync(join(root, "undeclared-thing"), { recursive: true });
    writeFileSync(join(root, "undeclared-thing", "x.txt"), "x");
    expect(undeclaredAtRoot(root).map((e) => e.path)).toContain("undeclared-thing");
  });

  test("with NO root harness.json the same directory is still a finding", () => {
    // The other falsifier: it must be the DECLARATION doing the work, not the
    // name `uploads` being special.
    const root = repo();
    mkdirSync(join(root, "uploads"), { recursive: true });
    writeFileSync(join(root, "uploads", "dropped.pdf"), "x");
    expect(undeclaredAtRoot(root).map((e) => e.path)).toContain("uploads");
  });

  test("being an instance still outranks a root declaration naming the same directory", () => {
    // Same ordering argument as the two-pass fix: a layer is accounted for
    // BY ITSELF, and another declaration claiming its name does not unmake it.
    const root = repo();
    writeDeclaration(root, JSON.stringify(
        { name: "the-repo", directories: [{ id: "x", path: "an-instance/", graphTypologies: ["uploads"] }] },
        null,
        2,
      ));
    expect(accountedRootPaths(root).get("an-instance")).toContain("declares itself");
  });
});

// cat-harness-tools#1701: an IG repository that is its own index declares the
// root files its harness reads in `index.config.json` `contentTypes.ig.include`.
describe("a root index's content-type `include` accounts for the paths it lists", () => {
  const withIndex = (contentTypes: unknown): string => {
    const root = repo();
    writeFileSync(join(root, "sushi-config.yaml"), "id: x\n");
    writeFileSync(join(root, "ig.ini"), "[IG]\n");
    writeFileSync(join(root, "_genonce.sh"), "#!/bin/sh\n");
    writeFileSync(join(root, "index.config.json"), JSON.stringify({ contentTypes }));
    return root;
  };

  test("a listed file is accounted for, and the reason names the section", () => {
    const root = withIndex({ ig: { include: ["sushi-config.yaml", "ig.ini", "input/fsh/"] } });
    const found = undeclaredAtRoot(root).map((e) => e.path);
    expect(found).not.toContain("sushi-config.yaml");
    expect(found).not.toContain("ig.ini");
    expect(accountedRootPaths(root).get("sushi-config.yaml")).toContain("contentTypes.ig.include");
  });

  test("a file the section does not list is still a finding", () => {
    const root = withIndex({ ig: { include: ["sushi-config.yaml"] } });
    expect(undeclaredAtRoot(root).map((e) => e.path)).toContain("_genonce.sh");
  });

  test("a section with no `include` accounts for nothing", () => {
    const root = withIndex({ dak: { id: "x" } });
    expect(undeclaredAtRoot(root).map((e) => e.path)).toContain("sushi-config.yaml");
  });
});

describe("the check can fire — which is the whole point", () => {
  test("a stray file at the root IS reported", () => {
    const root = repo();
    writeFileSync(join(root, "Some Uploaded Thing.pdf"), "x".repeat(1234));
    const found = undeclaredAtRoot(root);
    expect(found.map((e) => e.path)).toContain("Some Uploaded Thing.pdf");
  });

  test("a name with spaces and commas survives the report intact", () => {
    // The measured incident: three PNGs at the root with spaces and commas in
    // their filenames. A sweep that mangles the name cannot be acted on.
    const root = repo();
    const name = "ChatGPT Image Sep 20, 2026, 08_26_47 AM.png";
    writeFileSync(join(root, name), "x");
    expect(undeclaredAtRoot(root).map((e) => e.path)).toContain(name);
  });

  test("a stray DIRECTORY is reported, with its recursive size", () => {
    const root = repo();
    mkdirSync(join(root, "dropped", "deep"), { recursive: true });
    writeFileSync(join(root, "dropped", "deep", "a.bin"), "x".repeat(100));
    writeFileSync(join(root, "dropped", "b.bin"), "x".repeat(50));
    const d = undeclaredAtRoot(root).find((e) => e.path === "dropped")!;
    expect(d.kind).toBe("directory");
    expect(d.bytes).toBe(150);
  });

  test("findings are ordered largest first, so the costly one is read first", () => {
    const root = repo();
    writeFileSync(join(root, "small.bin"), "x".repeat(10));
    writeFileSync(join(root, "large.bin"), "x".repeat(10_000));
    const found = undeclaredAtRoot(root).map((e) => e.path);
    expect(found.indexOf("large.bin")).toBeLessThan(found.indexOf("small.bin"));
  });
});

describe("what is deliberately NOT reported", () => {
  test("infrastructure is accounted for, with a reason per entry", () => {
    const root = repo();
    expect(undeclaredAtRoot(root).map((e) => e.path)).not.toContain("package.json");
    // A reason per entry rather than a pattern: `*.json` would account for
    // harness.config.json and for any JSON anybody ever drops here, which is
    // the failure this sweep exists to catch.
    for (const [name, why] of Object.entries(ROOT_INFRASTRUCTURE)) {
      expect(why.length, `${name} has no reason`).toBeGreaterThan(10);
    }
  });

  test("dotfiles are skipped", () => {
    // A report whose first five lines are always `.gitignore` is a report
    // nobody reads.
    const root = repo();
    writeFileSync(join(root, ".somerc"), "x");
    expect(undeclaredAtRoot(root).map((e) => e.path)).not.toContain(".somerc");
  });

  test("a gitignored path is skipped, asked of git rather than listed", () => {
    // A real repository, because `git check-ignore` needs one — and an
    // assertion that cannot fail is not a test. `_kg/` is the live case this
    // exists for: a build output a hand-kept exclusion list would have had to
    // learn about, which git already knows.
    const root = repo();
    spawnSync("git", ["init", "-q"], { cwd: root });
    writeFileSync(join(root, ".gitignore"), "build-output/\n");
    mkdirSync(join(root, "build-output"), { recursive: true });
    writeFileSync(join(root, "build-output", "x.js"), "x");
    expect(undeclaredAtRoot(root).map((e) => e.path)).not.toContain("build-output");
  });

  test("...and that skip is real: the same directory unignored IS reported", () => {
    // The falsifier. Without this, the test above passes equally well for a
    // sweep that never reports a directory at all.
    const root = repo();
    spawnSync("git", ["init", "-q"], { cwd: root });
    writeFileSync(join(root, ".gitignore"), "something-else/\n");
    mkdirSync(join(root, "build-output"), { recursive: true });
    writeFileSync(join(root, "build-output", "x.js"), "x");
    expect(undeclaredAtRoot(root).map((e) => e.path)).toContain("build-output");
  });
});

describe("this repository, as it stands", () => {
  // Resolved from THIS FILE'S OWN LOCATION, not by walking up for a
  // `harness.json`. `instanceRootFor` walks up until it finds one, and this
  // suite creates `harness.json` files — eight test files in this directory do
  // — so a stray one left beside the tests moves the answer. Evaluated at
  // module load, that made the result depend on which tests ran first, which
  // is how this passed locally and failed in CI, where seven tests that skip
  // here do run.
  //
  // The walk-up is right for runtime code, which has no idea where it is. A
  // test does: tests/ -> scripts/ -> cat-harness/ -> the repository root.
  const REPO = resolve(import.meta.dir, "..", "..", "..");

  test("no two declarations in this repository share a `name`", () => {
    // MEASURED, not imagined: adding `harness.json` at the repository root
    // gave it `name: "folio-assistant"`, which `cat-harness/harness.json`
    // already used. Nothing failed. `resolveDirectories` sets
    // `declaredBy: decl.name` and a landing sticky carries `contributedBy`, so
    // both read `folio-assistant` with no way to tell WHICH — a directory can
    // be attributed to the wrong layer while the string looks right.
    //
    // Over the real repository on purpose. A fixture would pin the collision I
    // already fixed; this pins the property for whatever is declared next.
    // The ROOT's declaration is found the same way a subdirectory's is —
    // `findDeclarationFile`, never a bare suffix filter. This scanned for
    // `entry.name.endsWith(DECLARATION_SUFFIX)`, which was safe while that
    // suffix was `.config.json` and became wrong the moment it turned into a
    // bare `.json` on 2026-09-21: it then matched `tsconfig.json`, whose JSONC
    // comments threw a parse error, and would have matched `package.json` next.
    // The suffix is not the discriminator; agreeing with your own `name` is.
    const names = new Map<string, string[]>();
    const rootDecl = findDeclarationFile(REPO);
    if (rootDecl !== undefined) {
      const name = (JSON.parse(readFileSync(join(REPO, rootDecl), "utf-8")) as { name?: string }).name;
      if (name) names.set(name, [rootDecl]);
    }
    for (const entry of readdirSync(REPO, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sub = findDeclarationFile(join(REPO, entry.name));
      if (sub === undefined) continue;
      const rel = join(entry.name, sub);
      const name = (JSON.parse(readFileSync(join(REPO, rel), "utf-8")) as { name?: string }).name;
      if (name) names.set(name, [...(names.get(name) ?? []), rel]);
    }
    // The vacuity guard this repository asks for everywhere: a clean run over
    // zero declarations proves nothing, and there are at least three.
    expect(names.size).toBeGreaterThanOrEqual(3);
    const shared = [...names.entries()].filter(([, files]) => files.length > 1);
    expect(shared).toEqual([]);
  });

  test("the sweep runs over the real root without throwing", () => {
    expect(() => undeclaredAtRoot(REPO)).not.toThrow();
  });

  test("cat-harness and bootstrap are accounted for as instances", () => {
    const accounted = accountedRootPaths(REPO);
    // The diagnostic matters more than the assertion: when this fails, the
    // first question is "what did it actually look at", and a bare `undefined`
    // does not answer it.
    const seen = [...accounted.keys()].sort().join(", ");
    expect(accounted.get("cat-harness"), `REPO=${REPO}; saw: ${seen}`).toContain("declares itself");
    expect(accounted.get("bootstrap"), `REPO=${REPO}; saw: ${seen}`).toContain("declares itself");
  });

  test("beans/ and todos/ are accounted for by declaration, not by a list", () => {
    // They live at the root because they are declared repository-scoped — the
    // work plan belongs to the checkout rather than to any layer in it.
    const accounted = accountedRootPaths(REPO);
    expect(accounted.get("beans")).toContain("declared by");
    expect(accounted.get("todos")).toContain("declared by");
  });

  test("the root is clean, and stays that way", () => {
    // Pinned deliberately. If this list grows, something arrived at the root
    // that nobody declared — which is the event the sweep exists to surface.
    //
    // It was FOUR files when this sweep was written — the style guide's .pdf,
    // -info.pdf, .html and a 1.2 MB _files.zip, 1.8 MB in all. They were not
    // deleted: they had never been processed into `library/` (no slug for
    // them), so on the owner's ruling — *"if already processed, then delete"* —
    // they moved to `uploads/`, the declared ingestion queue, where document
    // ingestion can reach them and where a gate can see them. This expectation
    // was updated in the same change that dealt with them, as the note it
    // replaces asked.
    expect(undeclaredAtRoot(REPO).map((e) => e.path)).toEqual([]);
  });
});

describe("the size report is for a person", () => {
  test.each([
    [512, "512 B"],
    [1_500, "2 KB"],
    [232_840, "233 KB"],
    [1_234_660, "1.2 MB"],
  ])("%i renders as %s", (n, expected) => {
    expect(humanBytes(n as number)).toBe(expected);
  });
});

describe("an instance's own declaration outranks another instance naming it", () => {
  /**
   * The exact live shape, and the defect it exposed.
   *
   * `cat-harness/harness.json` declares `bootstrap/skills/` at REPOSITORY scope,
   * whose first path segment is `bootstrap` — which is itself a layer. A
   * single-pass implementation marked `bootstrap` "an instance", then walked
   * cat-harness's declarations and OVERWROTE it with "declared by". Which value
   * survived depended on the order `readdirSync` returned the two directories.
   *
   * That passed locally and failed in CI, on nothing but directory order. These
   * tests construct BOTH orders explicitly so neither can be the lucky one.
   */
  function pair(firstName: string, secondName: string): string {
    const root = mkdtempSync(join(tmpdir(), "outrank-"));
    // `outer` declares a repository-scoped directory INSIDE `inner`, which is
    // itself a layer.
    const outer = { name: "outer", directories: [{ id: "inner-skills", path: `${secondName}/skills/`, graphTypologies: ["cat-harness"], scope: "repository" }] };
    const inner = { name: "inner", directories: [] };
    const byName: Record<string, unknown> = { [firstName]: outer, [secondName]: inner };
    for (const [dir, decl] of Object.entries(byName)) {
      mkdirSync(join(root, dir), { recursive: true });
      writeDeclaration(join(root, dir), JSON.stringify(decl, null, 2));
    }
    mkdirSync(join(root, secondName, "skills"), { recursive: true });
    writeFileSync(join(root, "package.json"), "{}");
    return root;
  }

  test("the named instance still reads as an instance — declarer first", () => {
    const root = pair("a-outer", "z-inner");
    expect(accountedRootPaths(root).get("z-inner")).toContain("declares itself");
  });

  test("...and declarer second, which is the order that used to pass", () => {
    const root = pair("z-outer", "a-inner");
    expect(accountedRootPaths(root).get("a-inner")).toContain("declares itself");
  });

  test("neither is ever reported as undeclared", () => {
    for (const [a, b] of [["a-outer", "z-inner"], ["z-outer", "a-inner"]] as const) {
      expect(undeclaredAtRoot(pair(a, b))).toEqual([]);
    }
  });

  test("on the REAL repository, bootstrap reads as an instance", () => {
    // The live case. cat-harness declares bootstrap/skills/ at repository
    // scope, so this is the pair above, with real names.
    const REPO = resolve(import.meta.dir, "..", "..", "..");
    expect(accountedRootPaths(REPO).get("bootstrap")).toContain("declares itself");
  });
});

describe("a directory that only HOLDS ignored files", () => {
  // `scripts/` with nothing but a `__pycache__` in it. `gitIgnored` says no —
  // `.gitignore` names `__pycache__/`, not `scripts/` — so the husk was
  // reported. CI stayed green (a clean checkout has no bytecode) while every
  // contributor who ran the Python tests went red locally: the gate failing
  // for the people doing the work and passing for the machine that was not.
  function repoWithCacheHusk(): string {
    const root = repo();
    spawnSync("git", ["init", "-q"], { cwd: root });
    writeFileSync(join(root, ".gitignore"), "__pycache__/\n");
    mkdirSync(join(root, "scripts", "__pycache__"), { recursive: true });
    writeFileSync(join(root, "scripts", "__pycache__", "x.pyc"), "x");
    return root;
  }

  test("is not reported — it is git's business, not a finding", () => {
    expect(undeclaredAtRoot(repoWithCacheHusk()).map((e) => e.path)).not.toContain("scripts");
  });

  test("...and the skip is NARROW: one real file in it and it IS reported", () => {
    // The falsifier that matters. A skip wide enough to hide a genuine
    // undeclared file would be worse than the false positive it replaced,
    // because this sweep exists to catch exactly that.
    const root = repoWithCacheHusk();
    writeFileSync(join(root, "scripts", "genuinely-undeclared.ts"), "export {};");
    expect(undeclaredAtRoot(root).map((e) => e.path)).toContain("scripts");
  });

  test("a directory of TRACKED files is not mistaken for empty", () => {
    // `git status` alone reports nothing for tracked, unmodified files, so a
    // status-only check would call this directory empty and skip it.
    const root = repo();
    spawnSync("git", ["init", "-q"], { cwd: root });
    mkdirSync(join(root, "kept"), { recursive: true });
    writeFileSync(join(root, "kept", "a.ts"), "export {};");
    spawnSync("git", ["add", "-A"], { cwd: root });
    spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "x"], { cwd: root });
    expect(holdsOnlyIgnored(root, "kept")).toBe(false);
  });

  test("git unavailable means REPORT, never skip", () => {
    // Over-reporting is the safe direction: the failure guarded against is a
    // file going unseen. Same stance as `gitIgnored`.
    expect(holdsOnlyIgnored("/tmp", "no-such-directory-anywhere")).toBe(false);
  });
});
