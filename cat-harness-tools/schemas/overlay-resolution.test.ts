import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { repoRootFor, siblingScopeFor } from "./kg/cat-harness";
import { dependenciesFromNeeds, resolveInstanceGraph, resolveSkillDirs } from "./kg/harness-config";

/**
 * Throwaway trees, never the live repository.
 *
 * `yag0` this week was an assertion derived from the very data it was meant to
 * check — it passed on broken data. These build the shape under test so the
 * assertion survives the repository's own layers changing.
 */
function tree(instances: Record<string, object>): string {
  const root = mkdtempSync(join(tmpdir(), "overlay-"));
  for (const [name, body] of Object.entries(instances)) {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, `${name}.json`), JSON.stringify(body));
  }
  return root;
}

/** A layer declared AT a directory, rather than one level under it. */
function rootInstance(at: string, name: string, body: object): void {
  writeFileSync(join(at, `${name}.json`), JSON.stringify({ name, ...body }));
}

function withTree<T>(instances: Record<string, object>, fn: (root: string) => T): T {
  const root = tree(instances);
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("siblingScopeFor — which directory a sibling is looked up in", () => {
  /**
   * The case `repoRootFor` cannot serve, and the one this repository actually
   * has: `folio-assistant` is declared AT the repository root, so `dirname`
   * climbs out of the checkout and finds no siblings at all.
   */
  test("an instance root that CONTAINS other instances is its own scope", () => {
    withTree({ alpha: { name: "alpha", directories: [] } }, (root) => {
      rootInstance(root, "container", { directories: [] });
      expect(siblingScopeFor(root)).toBe(resolve(root));
      // ...and that is NOT what `repoRootFor` says, which is the whole point.
      expect(repoRootFor(root)).not.toBe(resolve(root));
    });
  });

  test("the ROOT instance of a checkout never looks outside it (owner, 2026-10-11, bean 68k7)", () => {
    // A checkout holding one layer at its root, cloned into a directory that
    // ALSO holds a layer — the `/tmp` case. Its siblings are not out there.
    withTree({ stray: { name: "stray", directories: [] }, repo: { name: "repo", directories: [] } }, (root) => {
      const repo = join(root, "repo");
      mkdirSync(join(repo, ".git"));
      expect(siblingScopeFor(repo)).toBe(resolve(repo));
      // ...and without its own `.git` the same directory is a nested leaf again.
      rmSync(join(repo, ".git"), { recursive: true });
      expect(siblingScopeFor(repo)).toBe(resolve(root));
    });
  });

  test("a declared SUBMODULE with its own `.git` is still nested — it looks in its parent", () => {
    withTree({ sub: { name: "sub", directories: [] }, other: { name: "other", directories: [] } }, (root) => {
      mkdirSync(join(root, "sub", ".git"));
      mkdirSync(join(root, ".git"));
      writeFileSync(join(root, ".gitmodules"), '[submodule "sub"]\n\tpath = sub\n\turl = https://example.org/sub\n');
      expect(siblingScopeFor(join(root, "sub"))).toBe(resolve(root));
    });
  });

  test("a LEAF instance resolves siblings one level up, as `repoRootFor` assumes", () => {
    withTree(
      { alpha: { name: "alpha", directories: [] }, beta: { name: "beta", directories: [] } },
      (root) => {
        expect(siblingScopeFor(join(root, "alpha"))).toBe(resolve(root));
      },
    );
  });

  test("the two agree for every nested instance — this does not replace `repoRootFor`", () => {
    withTree({ alpha: { name: "alpha", directories: [] } }, (root) => {
      const leaf = join(root, "alpha");
      expect(siblingScopeFor(leaf)).toBe(resolve(repoRootFor(leaf)));
    });
  });
});

describe("dependenciesFromNeeds resolves siblings of a ROOT-declared instance", () => {
  /**
   * Measured on `main` at `80c18ac` before the fix: the repository root's
   * `needs: ["folio-assistant-core"]` derived NOTHING and came back
   * `unresolved`, while its authored config edge still resolved — so the
   * overlay held one directory and read as if it worked.
   */
  test("a `needs` name resolves from an instance declared at the containing root", () => {
    withTree({ base: { name: "base", directories: [] } }, (root) => {
      rootInstance(root, "top", { needs: ["base"], directories: [] });
      const out = dependenciesFromNeeds(root);
      expect(out.unresolved).toEqual([]);
      expect(out.dependencies.map((d) => d.name)).toEqual(["base"]);
    });
  });

  test("and the overlay it feeds reaches that dependency's skills", () => {
    withTree({ base: { name: "base", directories: [{ id: "skills", path: "skills/", graphTypologies: ["skills"] }] } }, (root) => {
      mkdirSync(join(root, "base", "skills"), { recursive: true });
      rootInstance(root, "top", { needs: ["base"], directories: [] });
      const dirs = resolveSkillDirs(root);
      expect(dirs).toContain(resolve(join(root, "base", "skills")));
    });
  });
});

describe("an unresolvable `needs` name is REPORTED, never dropped", () => {
  /**
   * `dependenciesFromNeeds` always returned these in `unresolved`;
   * `resolveInstanceGraph` threw the array away, so `problems` came back empty
   * and `check:instance-graph` printed *"every dependency resolves"* over one
   * that did not. A gate asserting the opposite of what it exists to catch is
   * worse than no gate.
   */
  test("a name matching no instance becomes a `missing` problem", () => {
    withTree(
      {
        base: { name: "base", directories: [] },
        top: { name: "top", needs: ["base", "nowhere"], directories: [] },
      },
      (root) => {
        const g = resolveInstanceGraph(join(root, "top"));
        const missing = g.problems.filter((p) => p.kind === "missing");
        expect(missing).toHaveLength(1);
        expect(missing[0]).toMatchObject({ name: "nowhere" });
        // The resolvable half is unaffected — the run continues without the
        // absent layer, which is the owner's `a1lq` ruling.
        expect(g.order.map((o) => o.dependency.name)).toEqual(["base"]);
      },
    );
  });

  test("a fully resolvable tree raises nothing — falsified in both directions", () => {
    withTree(
      {
        base: { name: "base", directories: [] },
        top: { name: "top", needs: ["base"], directories: [] },
      },
      (root) => {
        expect(resolveInstanceGraph(join(root, "top")).problems).toEqual([]);
      },
    );
  });

  /**
   * The config supplies what a bare name cannot — a git URL, a version, a
   * `provides` narrowing. An edge the config already carries is not missing
   * just because the name did not resolve to a sibling directory.
   */
  test("a name the CONFIG already authors is not reported as missing", () => {
    withTree({ base: { name: "base", directories: [] } }, (root) => {
      mkdirSync(join(root, "top"), { recursive: true });
      writeFileSync(
        join(root, "top", "top.json"),
        JSON.stringify({ name: "top", needs: ["elsewhere"], directories: [] }),
      );
      writeFileSync(
        join(root, "top", "top.config.json"),
        JSON.stringify({ dependencies: { folioAssistant: [{ name: "elsewhere", path: "../base" }] } }),
      );
      const g = resolveInstanceGraph(join(root, "top"));
      expect(g.problems.filter((p) => p.kind === "missing")).toEqual([]);
    });
  });
});
