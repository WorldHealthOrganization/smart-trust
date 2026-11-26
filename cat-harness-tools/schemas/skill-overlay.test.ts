/**
 * The skill overlay reads declarations and keeps every layer's contribution.
 *
 * @module schemas/skill-overlay.test
 *
 * **These need a synthetic fixture and that is the point.** This repository
 * declares no dependencies, so every assertion here would pass vacuously
 * against the broken version if it ran on the real tree. A two-instance
 * fixture is the only way to observe the behaviour at all.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isKgOnlyDirectory, ownDirectories, resolveDirectories } from "./kg/cat-harness.js";
import { resolveSkillDirs } from "./kg/harness-config.js";
import { writeInstanceConfig } from "../test/support/instance-fixture.js";
import { writeDeclaration } from "../test/support/instance-fixture.js";

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

/**
 * A fresh directory for ONE fixture layer, alone in a private parent.
 *
 * Not `mkdtempSync(tmpdir())` itself: a leaf layer's checkout is its
 * PARENT (`checkoutRootFor`), so a fixture made directly in the system temp
 * directory is resolved as a sibling of everything else there. Measured
 * 2026-10-09 with ~22,000 entries in `/tmp` left by other runs: one
 * `resolveSkillDirs` took 62 s there against 0.14 s in a private parent —
 * the 55 s "a knowledge graph NOT at skills/" timeout — and every leftover
 * declared fixture in `/tmp` was read as part of this one's checkout. A clean
 * CI runner hid both. The fixture now decides its own checkout.
 */
function fixtureRoot(prefix: string): string {
  const parent = mkdtempSync(join(tmpdir(), prefix));
  roots.push(parent);
  const root = join(parent, "instance");
  mkdirSync(root);
  return root;
}

/** A layer whose knowledge graph sits at `kgPath` — deliberately NOT always "skills". */
function instance(name: string, kgPath: string): string {
  const root = fixtureRoot(`overlay-${name}-`);
  mkdirSync(join(root, kgPath), { recursive: true });
  writeDeclaration(root, JSON.stringify({
      name,
      directories: [{ id: "cat-harness", path: kgPath, graphTypologies: ["cat-harness"] }],
    }));
  return root;
}

function dependsOn(root: string, dep: string, provides?: string[]): void {
  // `root` is a FIXTURE layer root; its config belongs IN it, under the
  // name `root`'s own `harness.json` declares — `instance()` above wrote one,
  // and `writeInstanceConfig` reads that name rather than imposing a new one.
  writeInstanceConfig(
    root,
    JSON.stringify({
      dependencies: { folioAssistant: [{ name: "dep", path: dep, ...(provides ? { provides } : {}) }] },
    }),
  );
}

describe("the overlay is read from declarations, not from a literal", () => {
  test("a knowledge graph NOT at skills/ is still found", () => {
    // The whole reason the old `join(root, "skills")` was wrong. A layer
    // may declare its kg anywhere; here the id is `cat-harness` and the path
    // is `kg/`, which is exactly the id/path split the declaration absorbs.
    const root = instance("solo", "kg");
    expect(resolveSkillDirs(root)).toEqual([join(root, "kg")]);
  });

  test("a dependency's graph AND the root's both survive — deepest first", () => {
    // The defect `resolveDirectories` would have introduced: it overrides by
    // id, so a dependency and a root both declaring `cat-harness` collapse to
    // the root alone and the dependency's skills vanish silently.
    const dep = instance("dep", "skills");
    const root = instance("root", "skills");
    dependsOn(root, dep);

    expect(resolveSkillDirs(root)).toEqual([join(dep, "skills"), join(root, "skills")]);
  });

  test("resolveDirectories keeps both as MEMBERS, but not in overlay order — why it is not used", () => {
    // Before option A (2026-09-30) resolveDirectories overrode by id and the
    // dependency's graph vanished. It now keeps every layer's directory as
    // a member of the one subgraph — but the declaring (root) member comes
    // first, while the overlay is deepest-first, and it knows nothing of
    // `provides`. Pinned so a later "simplification" sees what it would break.
    const dep = instance("dep2", "skills");
    const root = instance("root2", "skills");
    const members = resolveDirectories([
      { name: "dep", root: dep },
      { name: "(root)", root, own: true },
    ]).filter(isKgOnlyDirectory);

    expect(members.map((d) => d.absPath)).toEqual([join(root, "skills"), join(dep, "skills")]);
    expect(resolveSkillDirs(root)).not.toEqual(members.map((d) => d.absPath));
  });

  test("`provides` without 'skills' opts a dependency out", () => {
    // The only way to depend on another layer for content or translations
    // without inheriting its skills.
    const dep = instance("dep3", "skills");
    const root = instance("root3", "skills");
    dependsOn(root, dep, ["content"]);

    expect(resolveSkillDirs(root)).toEqual([join(root, "skills")]);
  });

  test("a directory declared but absent is not returned", () => {
    // `AGENTS.md`: a declared-but-absent directory is the `dh4f` defect, where
    // a consumer scans nothing and reports a clean run over it.
    const root = fixtureRoot("overlay-absent-");
    writeDeclaration(root, JSON.stringify({
        name: "absent",
        directories: [{ id: "cat-harness", path: "nope", graphTypologies: ["cat-harness"] }],
      }));
    expect(resolveSkillDirs(root)).toEqual([]);
  });

  test("an UNDECLARED instance still falls back to the conventions", () => {
    // A regression I introduced and the existing suite caught: the first
    // version returned [] for a layer with no `harness.json`, which
    // silently dropped every unmigrated dependency's skills.
    //
    // `AGENTS.md`: "Absent declaration is fine — an unmigrated instance falls
    // back to today's conventions." Reading a declaration is the improvement;
    // REQUIRING one would be a breaking change wearing its clothes.
    const root = fixtureRoot("overlay-undeclared-");
    mkdirSync(join(root, "skills"), { recursive: true });

    expect(resolveSkillDirs(root)).toEqual([join(root, "skills")]);
    expect(ownDirectories({ name: "x", root }).map((d) => d.declaredBy)).toContain("(default)");
  });

  test("an undeclared instance with NO conventional directory yields nothing", () => {
    // Existence-filtered: a default that is not there is the `dh4f` defect,
    // where a consumer scans nothing and reports a clean run over it.
    const root = fixtureRoot("overlay-bare-");
    expect(resolveSkillDirs(root)).toEqual([]);
  });

  test("a directory holding more than the kg is excluded", () => {
    // `schemas/` declares ["schemas", "cat-harness"]: its .md files are
    // READMEs, so including it put 150 skills where the corpus has 149.
    const root = fixtureRoot("overlay-mixed-");
    mkdirSync(join(root, "schemas"), { recursive: true });
    writeDeclaration(root, JSON.stringify({
        name: "mixed",
        directories: [{ id: "schemas", path: "schemas", graphTypologies: ["schemas", "cat-harness"] }],
      }));
    expect(resolveSkillDirs(root)).toEqual([]);
  });
});

describe("a REPOSITORY-scoped directory resolves against the repository", () => {
  /**
   * A layer nested one level inside a checkout, declaring a kg directory
   * that lives BESIDE it rather than inside it — the `bootstrap/skills/` shape,
   * as a fixture, because the real tree has exactly one instance of it and an
   * assertion against the real tree would pin today's layout rather than the
   * rule.
   */
  function nested(kgPath: string, scope?: "repository"): { repo: string; inst: string } {
    const repo = mkdtempSync(join(tmpdir(), "overlay-scoped-"));
    roots.push(repo);
    const inst = join(repo, "inst");
    mkdirSync(join(repo, kgPath), { recursive: true });
    mkdirSync(inst, { recursive: true });
    writeDeclaration(inst, JSON.stringify({
        name: "inst",
        directories: [{ id: "cat-harness", path: kgPath, graphTypologies: ["cat-harness"], ...(scope ? { scope } : {}) }],
      }));
    return { repo, inst };
  }

  test("ownDirectories resolves `scope: repository` one level out", () => {
    // The defect this suite exists for. `ownDirectories` composed
    // `resolve(link.root, dir.path)` and never called `rootForScope`, so a
    // repository-scoped entry pointed INSIDE the layer — at a directory
    // that is not there. Nothing threw: `resolveSkillDirs` existence-filters,
    // so the graph was dropped and the run reported clean over it. That is
    // `dh4f`, and in the real tree it is why `skill_fetch` answered "package
    // not found" for every skill in `bootstrap/skills/` while the declaration
    // naming them was present and correct.
    const { repo, inst } = nested("sibling", "repository");
    const dirs = ownDirectories({ name: "inst", root: inst, own: true });
    expect(dirs.map((d) => d.absPath)).toEqual([join(repo, "sibling")]);
    expect(resolveSkillDirs(inst)).toEqual([join(repo, "sibling")]);
  });

  test("...and WITHOUT the scope the same declaration resolves inside", () => {
    // The other half of the measurement: the fix must not relocate an entry
    // that never asked to be relocated. Same fixture, same path, no `scope` —
    // and the directory it names is not there, so nothing is returned.
    const { inst } = nested("sibling");
    expect(ownDirectories({ name: "inst", root: inst, own: true }).map((d) => d.absPath)).toEqual([
      join(inst, "sibling"),
    ]);
    expect(resolveSkillDirs(inst)).toEqual([]);
  });

  test("a DEPENDENCY's repository-scoped entry is not inherited", () => {
    // `resolveDirectories` already refused this and said why: a dependency's
    // repository is a different checkout, so inheriting its entry points every
    // consumer at somebody else's store. Honouring the scope in
    // `ownDirectories` without honouring the refusal would have reached into
    // the dependency's checkout for the first time.
    const { repo, inst } = nested("sibling", "repository");
    const root = instance("scoped-root", "skills");
    writeInstanceConfig(
      root,
      JSON.stringify({ dependencies: { folioAssistant: [{ name: "dep", path: inst }] } }),
    );
    expect(resolveSkillDirs(root)).toEqual([join(root, "skills")]);
    expect(resolveSkillDirs(root)).not.toContain(join(repo, "sibling"));
  });
});

/**
 * `ownDirectories` and `resolveDirectories` answer the same question the same
 * way. Bean `rday`.
 *
 * ## What they disagreed about, measured 2026-09-20
 *
 * Both read one declaration; they differed on what an EMPTY one means.
 * `resolveDirectories` seeded `DEFAULT_DIRECTORIES` at the root link whatever
 * the declaration said. `ownDirectories` seeded them only for a root with no
 * declaration **at all** — so the declaration's mere existence withdrew every
 * convention from its callers.
 *
 * `directories` defaults to `[]` in the schema, which made the minimal honest
 * declaration the worst case: `{ "name": "x" }` adds a name and silently
 * empties the result. `resolveSkillDirs` goes through `ownDirectories`, so a
 * fixture with a `skills/` directory sitting on disk went from **3 to 0**
 * the moment it was given a name — and a consumer reads that as "this
 * instance has no skills", not as "somebody named it".
 *
 * The rule now: **a declaration adds and overrides; it does not withdraw.**
 */
describe("the two resolvers agree about what a declaration means", () => {
  test("an instance that declares NOTHING keeps its conventional directories", () => {
    // The case that was broken. `instance()` writes a `harness.json` with a
    // name and one directory; here the point is the ones it does NOT declare.
    const root = instance("named-but-bare", "skills");
    mkdirSync(join(root, "beans"), { recursive: true });
    mkdirSync(join(root, "uploads"), { recursive: true });

    const ids = ownDirectories({ name: "x", root, own: true }).map((d) => d.id);
    // `beans` and `uploads` are in DEFAULT_DIRECTORIES and are on disk, so
    // they resolve even though this declaration never mentions them.
    expect(ids).toContain("beans");
    expect(ids).toContain("uploads");
  });

  test("a default that is NOT on disk is not resolved — dh4f, not generosity", () => {
    // The existence filter is what makes "seed the defaults always" safe: a
    // layer that genuinely owns none of them gets none, and a
    // declared-but-absent directory is the defect where a consumer scans
    // nothing and reports a clean run over it.
    const root = instance("no-conventions", "kg");
    const ids = ownDirectories({ name: "x", root, own: true }).map((d) => d.id);
    for (const absent of ["beans", "todos", "uploads", "library", "voices"]) {
      expect(ids, `${absent} is not on disk and must not resolve`).not.toContain(absent);
    }
  });

  test("a declared entry OVERRIDES the default of the same id", () => {
    // `skills` is the default id for `skills/`. Declaring it at `kg/`
    // must move it, not add a second entry.
    const root = instance("relocated", "kg");
    const dirs = ownDirectories({ name: "x", root, own: true });
    const kg = dirs.filter((d) => d.id === "skills");
    expect(kg).toHaveLength(1);
    expect(kg[0]!.absPath).toBe(join(root, "kg"));
    expect(kg[0]!.declaredBy).not.toBe("(default)");
  });

  test("and the two functions return the same ids for the same root", () => {
    // The invariant the bean is about. Asserted over a root that declares
    // something AND has conventional directories on disk, so a regression in
    // either direction shows up.
    const root = instance("agreeing", "skills");
    mkdirSync(join(root, "beans"), { recursive: true });
    mkdirSync(join(root, "uploads"), { recursive: true });

    const own = ownDirectories({ name: "x", root, own: true }).map((d) => d.id).sort();
    const res = resolveDirectories([{ name: "x", root, own: true }]).map((d) => d.id).sort();
    expect(own).toEqual(res);
    // Vacuity: two empty lists agree too.
    expect(own.length).toBeGreaterThan(2);
  });
});
