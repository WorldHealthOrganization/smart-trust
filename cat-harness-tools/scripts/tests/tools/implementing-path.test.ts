/**
 * Owner rulings T1 and T7 (2026-10-01, bean `70lx`): a path the harness
 * DECLARES — a Tool's `invoke.inProcess.module`, a criterion's `source_file`,
 * a render target's `module` — stays as written, and is resolved against the
 * layer that IMPLEMENTS the declarer, found through that layer's own
 * `needs`. These tests pin the resolver the code move relies on, so that every
 * later batch is a pure `git mv`.
 *
 * Here rather than in the harness because the property only matters once
 * this layer exists, and a test in the harness importing it would be the
 * wrong direction.
 *
 * @module scripts/tests/implementing-path.test
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  clearCheckoutCache,
  implementingInstancesOf,
  implementingRootFor,
  resolveImplementingPath,
} from "../../../schemas/kg/harness-config.ts";
import { unresolvedPaths } from "../../check-tools.ts";
import { toolsOf } from "../../../tools/discover.ts";
import { layerRootsIn } from "../../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../lib/roots.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
  clearCheckoutCache();
});

function put(root: string, rel: string, body: unknown = ""): void {
  const p = join(root, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

/**
 * A checkout: an aggregate ROOT declared at the top that needs everything;
 * `base` (the harness's stand-in); `impl` and `twin`, which need `base`
 * directly; and `far`, which reaches `base` only through `impl`.
 */
function checkout(): string {
  const root = mkdtempSync(join(tmpdir(), "impl-path-"));
  made.push(root);
  put(root, "top.json", { name: "top", needs: ["base", "impl", "twin", "far"], directories: [] });
  put(root, "base/base.json", { name: "base", needs: [], directories: [] });
  put(root, "impl/impl.json", { name: "impl", needs: ["base"], directories: [] });
  put(root, "twin/twin.json", { name: "twin", needs: ["base"], directories: [] });
  put(root, "far/far.json", { name: "far", needs: ["impl"], directories: [] });
  return root;
}

describe("which instances implement a declarer", () => {
  test("those whose OWN needs name it — not transitive dependents, not the aggregate root", () => {
    const root = checkout();
    const names = implementingInstancesOf(join(root, "base")).map((i) => i.name).sort();
    // `far` depends on base only through impl; `top` contains base.
    expect(names).toEqual(["impl", "twin"]);
  });
});

describe("resolving a declared path", () => {
  test("the declaring instance first, so a path that has not moved resolves where it always did", () => {
    const root = checkout();
    put(root, "base/src/tools/x.ts");
    put(root, "impl/src/tools/x.ts"); // a mid-move duplicate does not make it ambiguous
    expect(resolveImplementingPath(join(root, "base"), "src/tools/x.ts")).toEqual({
      state: "found",
      root: resolve(root, "base"),
      instance: "base",
      via: "own",
    });
  });

  test("then the one implementer that holds it — the moved case", () => {
    const root = checkout();
    put(root, "impl/src/tools/x.ts");
    const r = resolveImplementingPath(join(root, "base"), "src/tools/x.ts");
    expect(r).toEqual({ state: "found", root: resolve(root, "impl"), instance: "impl", via: "needs" });
    expect(implementingRootFor(join(root, "base"), "src/tools/x.ts")).toBe(resolve(root, "impl"));
  });

  test("a transitive dependent's copy is not found", () => {
    const root = checkout();
    put(root, "far/pipeline/c.ts");
    const r = resolveImplementingPath(join(root, "base"), "pipeline/c.ts");
    expect(r.state).toBe("missing");
    if (r.state === "missing") {
      // The declarer first, then each direct implementer; never `far`.
      expect(r.looked[0]).toBe(resolve(root, "base"));
      expect([...r.looked].sort()).toEqual([resolve(root, "base"), resolve(root, "impl"), resolve(root, "twin")].sort());
    }
  });

  test("a file at the aggregate root under the same relative path is not found", () => {
    const root = checkout();
    put(root, "src/tools/x.ts");
    expect(resolveImplementingPath(join(root, "base"), "src/tools/x.ts").state).toBe("missing");
  });

  test("two implementers holding it is ambiguous, and never resolved by order", () => {
    const root = checkout();
    put(root, "impl/scripts/s.ts");
    put(root, "twin/scripts/s.ts");
    const r = resolveImplementingPath(join(root, "base"), "scripts/s.ts");
    expect(r.state).toBe("ambiguous");
    if (r.state === "ambiguous") expect(r.candidates.map((c) => c.name).sort()).toEqual(["impl", "twin"]);
    expect(() => implementingRootFor(join(root, "base"), "scripts/s.ts")).toThrow(/more than one implementing instance/);
  });

  test("missing returns the declaring root, so a caller's own miss report is unchanged", () => {
    const root = checkout();
    expect(implementingRootFor(join(root, "base"), "nowhere.ts")).toBe(resolve(root, "base"));
  });
});

describe("in this checkout", () => {
  test("this layer implements the harness, and is found through its needs", () => {
    const names = implementingInstancesOf(HARNESS_ROOT).map((i) => i.name);
    expect(names).toContain("cat-harness-tools");
    // The checkout's aggregate root needs the harness too, and is excluded.
    expect(names).not.toContain("folio-assistant");
  });

  test("a path that exists only in this layer resolves from a harness declaration", () => {
    // `scripts/lib/roots.ts` is in this layer and not in the harness: the
    // shape every moved module will have.
    expect(existsSync(join(HARNESS_ROOT, "scripts", "lib", "roots.ts"))).toBe(false);
    expect(resolveImplementingPath(HARNESS_ROOT, "scripts/lib/roots.ts")).toEqual({
      state: "found",
      root: TOOLS_ROOT,
      instance: "cat-harness-tools",
      via: "needs",
    });
  });

  test("every Tool module and every check:tools path resolves today", () => {
    // Each Tool's module is instance-relative, so it resolves from the
    // layer that DECLARES the node — the harness's from cat-harness, sci's
    // `lean-formal-edges` from folio-assistant-sci (bean riit, 3c). Resolving
    // every one from the harness asked a question no server asks.
    let count = 0;
    for (const inst of layerRootsIn(resolve(HARNESS_ROOT, ".."))) {
      for (const t of toolsOf(inst)) {
        const m = (t.invoke as { inProcess?: { module?: string } } | undefined)?.inProcess?.module;
        if (typeof m !== "string") continue;
        count++;
        expect([t.id, resolveImplementingPath(inst, m).state]).toEqual([t.id, "found"]);
      }
    }
    expect(count).toBeGreaterThan(10);
    expect(unresolvedPaths()).toEqual([]);
  });
});
