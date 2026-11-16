/**
 * Which declared knowledge-graph roots an audit may write sidecars for —
 * bean `lps0`.
 *
 * `kg-audit.ts` walked the literal `join(root, "skills")`, so a skill in a
 * topical directory was **not audited and not reported as unaudited** — the
 * `dh4f` shape inside the tool whose job is finding that shape. Measured when
 * it was fixed: 219 skills under the literal, 229 under the declaration.
 *
 * The falsifier the bean asks for is two-directional, and both halves are
 * here: a skill in a declared topical directory IS reachable, and removing
 * that directory's declaration makes it stop being.
 */
import { describe, expect, test, afterEach } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { DECLARATION_SUFFIX } from "../../schemas/kg/cat-harness.ts";

import { kgRoots, ownKgRoots } from "../known-skills.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/**
 * A repo holding one layer, which declares `dirs` as `cat-harness` graphs.
 *
 * Two levels deep on purpose: the layer sits UNDER the repo root, which is
 * the arrangement that lets a declared path point at a sibling layer and
 * escape — the case the filter exists for.
 */
function repo(dirs: string[], opts: { sibling?: string[]; self?: boolean } = {}): { repoRoot: string; inst: string } {
  const repoRoot = mkdtempSync(join(tmpdir(), "own-kg-roots-"));
  made.push(repoRoot);
  const inst = join(repoRoot, "inst");
  mkdirSync(inst, { recursive: true });
  for (const d of dirs) mkdirSync(join(inst, d), { recursive: true });
  for (const d of opts.sibling ?? []) mkdirSync(join(repoRoot, d), { recursive: true });
  // `<name>.config.json`, with `name` equal to the stem — `findDeclarationFile`
  // requires both, and a bare `harness.json` is skipped outright (its stem is
  // empty). Composed from the constant rather than spelled, which is what
  // `check:declaration-filename` is for.
  writeFileSync(
    join(inst, `inst${DECLARATION_SUFFIX}`),
    JSON.stringify({
      name: "inst",
      directories: [
        ...dirs.map((d) => ({ id: d.replace(/\//g, "-"), path: `${d}/`, graphTypologies: ["cat-harness"] })),
        // The layer root itself, declared as a graph directory.
        ...(opts.self ? [{ id: "self", path: "./", graphTypologies: ["cat-harness"] }] : []),
        ...(opts.sibling ?? []).map((d) => ({
          id: `sib-${d.replace(/\//g, "-")}`,
          path: `${d}/`,
          scope: "repository",
          graphTypologies: ["cat-harness"],
        })),
      ],
    }),
  );
  return { repoRoot, inst };
}

const seen = (inst: string) => ownKgRoots(inst).map((r) => relative(inst, r)).sort();

describe("the walk follows the DECLARATION, not the literal `skills/`", () => {
  test("a declared topical directory is reachable", () => {
    const { inst } = repo(["skills", "methodologies/crdm"]);
    expect(seen(inst)).toContain("methodologies/crdm");
  });

  test("THE OTHER DIRECTION: undeclaring it removes it, though it is still on disk", () => {
    // Without this the test above passes against a walk that simply visits
    // everything, which is the failure mode it exists to rule out. The
    // directory is created and NOT declared, so only the declaration can be
    // what keeps it out.
    const { inst } = repo(["skills"]);
    mkdirSync(join(inst, "methodologies/crdm"), { recursive: true });
    expect(seen(inst)).not.toContain("methodologies/crdm");
  });

  test("`skills/` is a DEFAULT, so it survives being undeclared", () => {
    // Asserted because it surprised me, not because it is desirable:
    // `resolveDirectories` supplies the conventional directories alongside the
    // declaration, so a layer that declares only a topical directory still
    // gets `skills/` when the directory exists. A test written to the
    // intuition — "declare none, get none" — fails against correct behaviour,
    // which is how this one came to be written the wrong way round first.
    const { inst } = repo(["methodologies/raci"]);
    mkdirSync(join(inst, "skills"), { recursive: true });
    expect(seen(inst)).toEqual(["methodologies/raci", "skills"]);
  });

  test("and a root is never listed twice, however many ways it arrives", () => {
    // Declaring `skills/` explicitly ALSO gets it from the defaults. A caller
    // cannot tell a duplicate from two real roots by looking at the list.
    const { inst } = repo(["skills"]);
    expect(seen(inst)).toEqual(["skills"]);
  });
});

describe("another instance's roots are excluded — not this audit's to write", () => {
  test("a repository-scoped sibling directory is dropped", () => {
    // `kgRoots` resolves a DEPENDENCY's directories too. Walking them is what
    // `instance-graph-isolation.test.ts` guards against — one layer's graph
    // must not carry another's nodes.
    const { inst } = repo(["skills"], { sibling: ["other/skills"] });
    expect(seen(inst)).toEqual(["skills"]);
    for (const r of ownKgRoots(inst)) {
      expect(relative(inst, r).startsWith("..")).toBe(false);
    }
  });

  test("THE REASON IT MATTERS: every kept root mirrors INSIDE the results tree", () => {
    // `sidecarPath` composes `dirname(join(root, subject.path))` and mirrors it
    // under `test/results/kg-qa/`. A `../` subject normalises OUTSIDE that
    // tree — the escaping-path defect bean `chq5` fixed one store over. This
    // asserts the property rather than the filter, so a different
    // implementation of the same rule still passes.
    const { inst } = repo(["skills", "src/skills"], { sibling: ["other/skills"] });
    const results = join(inst, "test/results/kg-qa");
    for (const r of ownKgRoots(inst)) {
      expect(join(results, relative(inst, r)).startsWith(results)).toBe(true);
    }
  });

  test("the instance root itself is not a root of its own graph", () => {
    // `relative(here, here)` is "", which does not start with ".." — so a
    // layer declaring `./` would otherwise walk everything, its own results
    // tree included.
    const { inst } = repo(["skills"], { self: true });
    // The precondition, made visible: the declaration DOES resolve to the layer
    // root itself, so it is the filter, not the resolver, that keeps it out.
    expect(kgRoots(inst).map((r) => resolve(r))).toContain(resolve(inst));
    expect(seen(inst)).not.toContain("");
    expect(seen(inst)).toEqual(["skills"]);
  });
});
