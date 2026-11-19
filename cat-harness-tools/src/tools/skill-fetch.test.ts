/**
 * Skill packages are discovered from declarations, including a dependency's.
 *
 * @module src/tools/skill-fetch.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { LOCAL_PACKAGES, REFERENCE_PACKAGES, discoverLocalPackages, locateLocalSkill } from "./skill-fetch.js";
import { writeInstanceConfig } from "../../test/support/instance-fixture.js";
import {  } from "../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";

const ROOT = resolve(import.meta.dir, "../..");

/** A layer with a declared kg directory and some package subdirectories. */
function instance(pkgs: Record<string, string>, kgPath = "skills"): string {
  const root = mkdtempSync(join(tmpdir(), "pkgs-"));
  writeDeclaration(root, JSON.stringify({
      name: "t",
      directories: [{ id: "cat-harness", path: kgPath, graphTypologies: ["cat-harness"] }],
    }));
  for (const [name, body] of Object.entries(pkgs)) {
    mkdirSync(join(root, kgPath, name), { recursive: true });
    writeFileSync(join(root, kgPath, name, "a.md"), body);
  }
  return root;
}

const SKILL = "---\nname: a\nsummary: does a thing\n---\n\n# A\n";
const NOT_A_SKILL = "---\n$schema: agent-memory/v1\n---\n\n# Not a skill\n";

describe("the live table", () => {
  test("every package resolves to a directory that exists", () => {
    // `content-lifecycle` was missing from the hand-written table until
    // 2026-09-18 while 52 `<folio:skill ref>` activities named its skills, so
    // `skill_fetch` answered "package not found" for every step of every
    // content-lifecycle process.
    expect(Object.keys(LOCAL_PACKAGES).length).toBeGreaterThan(0);
    for (const dir of Object.values(LOCAL_PACKAGES)) {
      expect(existsSync(dir)).toBe(true);
    }
  });

  test("the co-located skill is DISCOVERED, not hand-written", () => {
    // Three states of one question, kept as one test because the middle one
    // is the reason the last one is safe.
    //
    // Until 2026-09-19 this asserted the OPPOSITE, correctly: `src/skills/`
    // was an undeclared kg directory, so discovery could not see the one
    // skill it holds and `LOCAL_PACKAGES` carried a hand-written exception.
    // Bean `osbo` declared it, the exception went, and the package fell out
    // of the declaration like every other.
    //
    // 2026-09-21, issue #760: `src/skills/` is GONE. Its stated reason — a
    // skill beside the `.ts` that implements it — was already served by
    // `skills/folio-core/`, eight times over, and the separate directory's
    // only distinguishing property was that `discoverLocalPackages` named it
    // `cat-harness` while the declaration gave that id to `skills/`. One name,
    // two real directories.
    //
    // So the SUBJECT moved and the CLAIM did not: a co-located skill is still
    // discovered rather than hand-listed. Asserted on the skill rather than on
    // the directory, because the directory was the accident.
    //
    // And it moved again (bean `9umr`): `corpus-grep` is a KG skill, now in
    // `kg-core` inside the `kg` TOPIC — one level deeper, which is the second
    // thing this now proves discovery reaches.
    const dir = discoverLocalPackages(ROOT)["kg-core"];
    expect(dir).toBeDefined();
    expect(dir!).toContain(join("skills", "kg", "kg-core"));
    expect(readdirSync(dir!)).toContain("corpus-grep.md");
  });

  test("the name `cat-harness` denotes exactly one directory", () => {
    // The defect #760 closes, pinned so it cannot come back. `skill_fetch`
    // took `cat-harness` to mean `src/skills` (one skill) while the
    // declaration took it to mean `skills/` (sixteen sub-packages), and
    // nothing joined the two — so an agent reading the declaration and
    // calling `skill_fetch("cat-harness")` got the wrong directory silently,
    // with no error, because the name WAS valid in that namespace.
    expect(discoverLocalPackages(ROOT)["cat-harness"]).toBeUndefined();
  });

  test("a directly-held kg directory is named after its INSTANCE", () => {
    // Rule 1: a directory basenamed `skills` IS the layer's own package —
    // there is no subdirectory name to take — so it takes the layer's name.
    //
    // The subject was `src/skills/` until #760 folded it into
    // `skills/folio-core/`. THE TEST'S CLAIM IS UNCHANGED, which is the point:
    // the rule was never about that directory, so it is asserted here on a
    // live subject instead. `bootstrap/skills/` is basenamed `skills` and
    // takes its layer's name, exactly as `src/skills/` did. (The subject was
    // `kg-navigation/skills/` until bean `byql` folded that layer into
    // cat-harness as an ordinary `skills/kg/kg-navigation/` package.)
    expect(discoverLocalPackages(ROOT)["bootstrap"]).toContain("bootstrap/skills");
  });
});

describe("what discovery includes, and what it refuses", () => {
  test("a directory holding a skill is a package", () => {
    const root = instance({ alpha: SKILL });
    expect(Object.keys(discoverLocalPackages(root))).toEqual(["alpha"]);
    rmSync(root, { recursive: true, force: true });
  });

  test("a directory whose .md declares `$schema` is NOT a package", () => {
    // Declaration over location. Taken plainly, a scan of `skills/` adds seven
    // non-package directories, and `memory/` is the one already on record for
    // making `kg-audit` write 25 bogus sidecars against agent-memory nodes
    // that are not instruction bodies.
    const root = instance({ memory: NOT_A_SKILL });
    expect(discoverLocalPackages(root)).toEqual({});
    rmSync(root, { recursive: true, force: true });
  });

  test("a directory with no markdown at all is NOT a package", () => {
    // `skills/remote-packages/` holds two .json manifests and no body.
    const root = instance({});
    mkdirSync(join(root, "skills", "remote-packages"), { recursive: true });
    writeFileSync(join(root, "skills", "remote-packages", "x.json"), "{}");
    expect(discoverLocalPackages(root)).toEqual({});
    rmSync(root, { recursive: true, force: true });
  });

  test("a kg directory NOT at skills/ still yields its packages", () => {
    // The hardcoded `join(root, "skills")` this replaces could not do it.
    const root = instance({ alpha: SKILL }, "kg");
    expect(Object.keys(discoverLocalPackages(root))).toEqual(["alpha"]);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("a dependency's packages are served — the overlay", () => {
  test("a dependency contributes, and the root overrides by name", () => {
    // The point of the exercise: `AGENTS.md` records that a dependency's
    // skills are not reachable today. This is what reachable looks like.
    const dep = instance({ shared: SKILL, "dep-only": SKILL });
    const root = instance({ shared: SKILL });
    // `root` is a FIXTURE layer root; its config belongs IN it, under the
    // name `root` declares. The sweep sent this to the fixture's parent —
    // `/tmp` — and the name half is newer still: there is no global config
    // filename to join on any more.
    writeInstanceConfig(
      root,
      JSON.stringify({ dependencies: { folioAssistant: [{ name: "dep", path: dep }] } }),
    );

    const found = discoverLocalPackages(root);
    expect(Object.keys(found).sort()).toEqual(["dep-only", "shared"]);
    // Root last in overlay order, so the root's `shared` wins.
    expect(found["shared"]).toBe(join(root, "skills", "shared"));
    expect(found["dep-only"]).toBe(join(dep, "skills", "dep-only"));

    rmSync(dep, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  });
});

describe("a directly-held set is named by ITS instance, not by the caller's root", () => {
  test("two directly-held directories do not collapse onto one name", () => {
    // The defect: the name came from `readDeclaration(root)` — the root passed
    // IN — so every directly-held kg directory got the same key regardless of
    // which layer contributed it. With one such directory that is
    // indistinguishable from correct; with two, the later assignment wins and
    // the earlier package is found and then silently dropped. No collision is
    // reported, nothing throws, and `skill_fetch` answers "package not found"
    // for a package discovery had in hand. `dh4f` one layer up from the scope
    // defect that hid `bootstrap/skills/` in the first place.
    const repo = mkdtempSync(join(tmpdir(), "held-"));

    // The sibling, with its OWN declaration — this is what makes it nameable.
    mkdirSync(join(repo, "sibling", "skills"), { recursive: true });
    writeDeclaration(join(repo, "sibling"), JSON.stringify({
        name: "sibling",
        directories: [{ id: "cat-harness", path: "skills", graphTypologies: ["cat-harness"] }],
      }));
    writeFileSync(join(repo, "sibling", "skills", "s.md"), SKILL);

    // The layer, declaring its own kg directory AND the sibling's, the
    // second at repository scope — the `bootstrap/skills/` shape.
    const inst = join(repo, "inst");
    mkdirSync(join(inst, "kg"), { recursive: true });
    writeFileSync(join(inst, "kg", "i.md"), SKILL);
    writeDeclaration(inst, JSON.stringify({
        name: "inst",
        directories: [
          { id: "sib", path: "sibling/skills", graphTypologies: ["cat-harness"], scope: "repository" },
          { id: "cat-harness", path: "kg", graphTypologies: ["cat-harness"] },
        ],
      }));

    const found = discoverLocalPackages(inst);
    expect(Object.keys(found).sort()).toEqual(["inst", "sibling"]);
    expect(found["sibling"]).toBe(join(repo, "sibling", "skills"));
    expect(found["inst"]).toBe(join(inst, "kg"));

    rmSync(repo, { recursive: true, force: true });
  });

  test("FOUR directly-held directories in one instance, and none is dropped", () => {
    // The within-instance half of the same collision, which the test above
    // does not reach: it has one directly-held directory per layer, so
    // "named by its instance" and "named by first-wins" agree there.
    //
    // `cat-harness` really declared four — `src/skills/`, `sdlc/skills/crdm/` (now `skills/process/crdm/`)
    // and `skills/process/raci/` — and until bean `1hvo`
    // all four resolved to the name `folio-assistant` with the last winning.
    // Three packages were found and silently dropped: `kg:audit` reported six
    // `manifest-skill-exists` CRITICALs for theming and 27 MAJORs for CRDM
    // activities whose skills nothing could serve.
    const repo = mkdtempSync(join(tmpdir(), "four-"));
    const inst = join(repo, "inst");
    for (const d of ["src/skills", "theming", "a", "b"]) {
      mkdirSync(join(inst, d), { recursive: true });
      writeFileSync(join(inst, d, "s.md"), SKILL);
    }
    writeDeclaration(inst, JSON.stringify({
        name: "inst",
        directories: ["src/skills", "theming", "a", "b"].map((path, i) => ({
          id: `d${i}`,
          path,
          graphTypologies: ["cat-harness"],
        })),
      }));

    const found = discoverLocalPackages(inst);
    // `skills` takes the layer name; the other three take their basenames.
    // Four in, four out — the property is that NOTHING is dropped.
    expect(Object.keys(found).sort()).toEqual(["a", "b", "inst", "theming"]);
    expect(found["inst"]).toBe(join(inst, "src", "skills"));
    expect(found["theming"]).toBe(join(inst, "theming"));

    rmSync(repo, { recursive: true, force: true });
  });

  test("the rule is UNIQUENESS, not order — reversing the declaration changes nothing", () => {
    // First-wins was the defect, so "last one declared takes the name" would
    // pass every assertion above while remaining order-dependent. This is the
    // falsifier: the same four directories, declared backwards.
    const repo = mkdtempSync(join(tmpdir(), "rev-"));
    const inst = join(repo, "inst");
    for (const d of ["src/skills", "theming", "a", "b"]) {
      mkdirSync(join(inst, d), { recursive: true });
      writeFileSync(join(inst, d, "s.md"), SKILL);
    }
    writeDeclaration(inst, JSON.stringify({
        name: "inst",
        directories: ["b", "a", "theming", "src/skills"].map((path, i) => ({
          id: `d${i}`,
          path,
          graphTypologies: ["cat-harness"],
        })),
      }));
    const found = discoverLocalPackages(inst);
    expect(Object.keys(found).sort()).toEqual(["a", "b", "inst", "theming"]);
    expect(found["inst"]).toBe(join(inst, "src", "skills"));
    rmSync(repo, { recursive: true, force: true });
  });

  test("a SOLE directly-held directory still takes the instance name, whatever it is called", () => {
    // Rule 2, and the reason the fixture above names its directory `kg`: with
    // nothing to disambiguate from, the layer's name is the better one.
    const repo = mkdtempSync(join(tmpdir(), "sole-"));
    const inst = join(repo, "inst");
    mkdirSync(join(inst, "kg"), { recursive: true });
    writeFileSync(join(inst, "kg", "s.md"), SKILL);
    writeDeclaration(inst, JSON.stringify({
        name: "inst",
        directories: [{ id: "cat-harness", path: "kg", graphTypologies: ["cat-harness"] }],
      }));
    expect(Object.keys(discoverLocalPackages(inst))).toEqual(["inst"]);
    rmSync(repo, { recursive: true, force: true });
  });

  test("the live table names a directly-held set after its declaring instance", () => {
    // The falsifier for the change above, stated as its own test because the
    // whole claim is that this is a refactor: the name is derived from where
    // the skills LIVE rather than from who asked, so the nearest enclosing
    // declaration decides. If this goes red the change is a behaviour break.
    //
    // The subject was `src/skills/` until #760 removed it, then
    // `bootstrap/tools/` until bean `n350` (2026-09-23) folded its two skills
    // into `bootstrap/skills/` and removed the directory. A title naming the expected STRING
    // goes stale on a move that is not a behaviour change; one naming the RULE
    // does not — which is why only the subject moves.
    //
    // ## Why the subject moved again, and why it is NOT a behaviour break
    //
    // `needs` now derives the dependency overlay for edges inside one checkout
    // (bean `5kn6`), so `bootstrap/skills/` became reachable from here where
    // only `bootstrap/tools/` was before. That flips which rule applies:
    // rule 2 (the SOLE directly-held directory takes the layer name) gave
    // the name to `bootstrap/tools/` while it was alone; rule 1 (a directory
    // basenamed `skills` IS the layer's own package) takes precedence now
    // that the real one is in reach.
    //
    // The rule this test guards is unchanged and is the one in its title: a
    // directly-held set is named by ITS layer, not by the caller's root.
    // `bootstrap/skills/` resolves to `bootstrap` and not to `cat-harness`,
    // which is the whole claim.
    const live = discoverLocalPackages(ROOT);
    expect(live["bootstrap"]).toContain("bootstrap/skills");

    // AND NOTHING WAS DROPPED, which is the half worth asserting: the failure
    // mode this naming rule exists against is a second directory being found
    // and then silently losing its key — the `dh4f` shape one layer up.
    // `bootstrap/tools/` no longer exists (n350), so no key may point at it.
    expect(Object.values(live).some((p) => p.includes("bootstrap/tools"))).toBe(false);
    const paths = Object.values(live);
    expect(paths.length).toBe(new Set(paths).size);
  });
});

describe("locateLocalSkill — a skill asked for in a package that no longer holds it (bean 9umr)", () => {
  const dir = mkdtempSync(join(tmpdir(), "skill-locate-"));
  for (const [pkg, skills] of [["core", ["stays"]], ["kg", ["moved", "twice"]], ["lib", ["twice"]]] as const) {
    mkdirSync(join(dir, pkg));
    for (const s of skills) writeFileSync(join(dir, pkg, `${s}.md`), `# ${s}\n`);
  }
  const packages = { core: join(dir, "core"), kg: join(dir, "kg"), lib: join(dir, "lib") };

  test("the named package wins when it holds the skill", () => {
    expect(locateLocalSkill("stays", "core", packages)).toEqual({ package: "core", dir: packages.core });
  });
  test("a moved skill is found in the one package that holds it", () => {
    expect(locateLocalSkill("moved", "core", packages)).toEqual({ package: "kg", dir: packages.kg });
  });
  test("two holders is an error naming both, never a pick", () => {
    const r = locateLocalSkill("twice", "core", packages);
    expect("error" in r && r.error).toMatch(/kg, lib/);
  });
  test("a skill nobody holds is still unknown", () => {
    expect("error" in locateLocalSkill("nowhere", "core", packages)).toBe(true);
  });
});

describe("REFERENCE_PACKAGES — pinned to a commit, never a branch (bean c4lg / 0mpw)", () => {
  test("every reference package pins ref to a 40-hex commit SHA", () => {
    expect(Object.keys(REFERENCE_PACKAGES).length).toBeGreaterThan(0);
    for (const [pkg, entry] of Object.entries(REFERENCE_PACKAGES)) {
      expect(entry.ref, `${pkg} must pin ref to a 40-hex commit SHA`).toMatch(/^[0-9a-f]{40}$/);
    }
  });
});
