/**
 * `init-folio --staged <path>`: a sub-KG staged INSIDE a host repository.
 *
 * Owner ruling 1, 2026-10-06 (bean `3tza`): it writes the staged layer's
 * declaration and its import seam, and NOTHING at the repository level. The
 * second half is the load-bearing assertion: `--instance` writes fifteen
 * repository-level files (`AGENTS.md`, `.mcp.json`, a beans store, …), and a
 * staged mode that wrote even one of them into the host would be the defect
 * this mode exists to avoid. So the test snapshots the whole host tree before
 * and after, rather than checking that the two expected files exist.
 *
 * @module cat-harness/scripts/tests/init-folio-staged.test
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { CatHarnessDeclarationSchema } from "../../schemas/kg/cat-harness.js";
import { initStaged } from "../init-folio.js";

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

/** A host that already looks like a harnessed repository. */
function host(): string {
  const d = mkdtempSync(join(tmpdir(), "init-staged-"));
  temps.push(d);
  writeFileSync(join(d, "host.json"), JSON.stringify({ name: "host", directories: [] }));
  writeFileSync(join(d, "AGENTS.md"), "# host\n");
  mkdirSync(join(d, "beans"));
  return d;
}

function tree(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir)) {
      const full = join(dir, e);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(root, full).split("\\").join("/"));
    }
  };
  walk(root);
  return out.sort();
}

const base = {
  path: "my-ig",
  slug: "my-ig",
  title: "My IG",
  repository: "owner/my-ig",
  hostRepository: "owner/host",
  needs: ["fhir-harness"],
};

describe("init-folio --staged", () => {
  test("writes exactly the declaration and the seam, and nothing at the repository level", () => {
    const h = host();
    const before = tree(h);
    const r = initStaged({ ...base, hostDir: h });
    const after = tree(h);
    const added = after.filter((f) => !before.includes(f));
    expect(added).toEqual(["my-ig/my-ig.json", "my-ig/platform.ts"]);
    expect(r.created.sort()).toEqual(["my-ig/my-ig.json", "my-ig/platform.ts"]);
    // Nothing outside the staged directory changed, byte for byte.
    expect(readFileSync(join(h, "AGENTS.md"), "utf-8")).toBe("# host\n");
    for (const f of after) if (!f.startsWith("my-ig/")) expect(before).toContain(f);
  });

  test("the declaration is a staged instance: repository differs from livesAt", () => {
    const h = host();
    initStaged({ ...base, hostDir: h, path: "folio/nested-ig", slug: "nested-ig" });
    const decl = CatHarnessDeclarationSchema.parse(
      JSON.parse(readFileSync(join(h, "folio/nested-ig/nested-ig.json"), "utf-8")),
    );
    expect(decl.name).toBe("nested-ig");
    expect(decl.repository).toBe("owner/my-ig");
    expect(decl.livesAt).toEqual({ repository: "owner/host", path: "folio/nested-ig" });
    expect(decl.needs).toEqual(["fhir-harness"]);
    expect(decl.directories).toEqual([]);
  });

  test("dry run writes nothing", () => {
    const h = host();
    const before = tree(h);
    const r = initStaged({ ...base, hostDir: h, dryRun: true });
    expect(r.created).toHaveLength(2);
    expect(tree(h)).toEqual(before);
  });

  test("a re-run leaves an existing declaration alone", () => {
    const h = host();
    initStaged({ ...base, hostDir: h });
    writeFileSync(join(h, "my-ig/my-ig.json"), "{}\n");
    const r = initStaged({ ...base, hostDir: h });
    expect(r.skipped).toContain("my-ig/my-ig.json");
    expect(readFileSync(join(h, "my-ig/my-ig.json"), "utf-8")).toBe("{}\n");
  });

  test("refuses the host root, an escaping path, no needs, and a planned home that is the host", () => {
    const h = host();
    expect(() => initStaged({ ...base, hostDir: h, path: "." })).toThrow(/INSIDE the host/);
    expect(() => initStaged({ ...base, hostDir: h, path: "../out" })).toThrow(/INSIDE the host/);
    expect(() => initStaged({ ...base, hostDir: h, needs: [] })).toThrow(/--needs/);
    expect(() => initStaged({ ...base, hostDir: h, repository: "owner/host" })).toThrow(/not staged/);
    expect(() => initStaged({ ...base, hostDir: h, repository: "nope" })).toThrow(/owner\/name/);
    expect(tree(h)).toEqual(["AGENTS.md", "host.json"]);
  });
});
