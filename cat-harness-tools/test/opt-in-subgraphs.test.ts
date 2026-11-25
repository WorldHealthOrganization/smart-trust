/**
 * Opt-in named sub-graphs (cat-harness#991 step 23.1): off in every layer,
 * the declaring one included, unless that layer — the FOLIO ROOT a reader
 * resolves for — enables it; `CAT_SUBGRAPHS` overrides per process.
 *
 * No corpus file is opt-in yet, so the behaviour is only observable on a
 * fixture: `b` needs `a`; `a` declares `x` opt-in (its `graph.json` names a
 * skills graph and a tools graph holding one Tool node from within) and
 * `api`, an ordinary named sub-graph laid out the same way.
 *
 * @module test/opt-in-subgraphs.test
 */
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { CatHarnessDeclarationSchema, ownDirectories, readDeclaration, resolveDirectories } from "../schemas/kg/cat-harness.ts";
import { clearCheckoutCache, declarationChain, resolveSkillDirs } from "../schemas/kg/harness-config.ts";
import {
  closeOverRequires,
  enabledSubgraphs,
  enabledSubgraphsFrom,
  enableSubgraphsProblems,
  requiredBy,
  requiresDeclared,
  requiresProblems,
  parseSubgraphsEnv,
  SUBGRAPHS_ENV,
  switchedOff,
} from "../schemas/kg/opt-in-subgraphs.ts";
import { IndexConfigSchema } from "../schemas/kg/index-config.ts";
import { servedToolGroups } from "../src/tool-groups.ts";
import { checkDeclarationResolution } from "../scripts/check-declaration-resolution.ts";
import { defaultMountDirectoryIds } from "../scripts/remote-mount.ts";

const made: string[] = [];
afterAll(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));

const savedEnv = process.env[SUBGRAPHS_ENV];
afterEach(() => {
  if (savedEnv === undefined) delete process.env[SUBGRAPHS_ENV];
  else process.env[SUBGRAPHS_ENV] = savedEnv;
  clearCheckoutCache();
});

function write(root: string, files: Record<string, string | object>): void {
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), typeof body === "string" ? body : JSON.stringify(body, null, 2));
  }
}

const tool = (id: string, mcp: string) => ({
  $schema: "tool-definition/v1",
  tool: {
    id,
    title: `${id} tool`,
    description: `The fixture Tool \`${id}\`.`,
    install: { none: true },
    invoke: { mcp: { tool: mcp }, inProcess: { module: `src/${id}.ts` } },
    io: { inputs: [], outputs: [] },
    satisfies: [id],
    requires: { runtime: ["bun"], network: false },
  },
});

const A_DECL = {
  name: "a",
  needs: [],
  directories: [
    { id: "tools", path: "tools/", graphTypologies: ["tools"] },
    { id: "x", path: "x/", graphTypologies: ["cat-harness"], optIn: true },
    { id: "api", path: "api/", graphTypologies: ["cat-harness"] },
  ],
};

/** A private checkout holding `a` and `b`; returns their roots. */
function checkout(bExtra: object = {}, aExtra: object = {}): { a: string; b: string; parent: string } {
  const parent = mkdtempSync(join(tmpdir(), "opt-in-subgraphs-"));
  made.push(parent);
  write(parent, {
    "a/a.json": { ...A_DECL, ...aExtra },
    "a/tools/at/at.json": tool("at", "a_tool"),
    "a/x/graph.json": {
      directories: [
        { id: "x-skills", path: "skills/", subgraph: true, graphTypologies: ["skills"] },
        { id: "x-tools", path: "tools/", subgraph: true, graphTypologies: ["tools"] },
      ],
    },
    "a/x/skills/xs/SKILL.md": "---\nname: xs\ndescription: x\n---\n# xs\n",
    "a/x/tools/xt/xt.json": tool("xt", "x_tool"),
    "a/api/graph.json": { directories: [{ id: "api-skills", path: "skills/", subgraph: true, graphTypologies: ["skills"] }] },
    "a/api/skills/as/SKILL.md": "---\nname: as\ndescription: a\n---\n# as\n",
    "b/b.json": { name: "b", needs: ["a"], directories: [], ...bExtra },
    // b's own member of `x`: off with `x`, on with it.
    "b/x/note.md": "b's member of x\n",
  });
  return { a: join(parent, "a"), b: join(parent, "b"), parent };
}

const ids = (root: string) => resolveDirectories(declarationChain(root)).map((d) => d.id);
const paths = (root: string) => resolveDirectories(declarationChain(root)).map((d) => d.absPath);
function servedModules(root: string): string[] {
  const { sets, failures } = servedToolGroups(root);
  expect(failures).toEqual([]);
  return sets.flatMap((s) => s.groups.map((g) => g.module)).sort();
}

describe("the switch", () => {
  test("CAT_SUBGRAPHS: `+` adds, `-` removes, a bare id adds", () => {
    expect(parseSubgraphsEnv(" +a.x, -b.y ,c.z,")).toEqual({ add: ["a.x", "c.z"], remove: ["b.y"] });
    expect([...enabledSubgraphsFrom(["a.x", "b.y"], { [SUBGRAPHS_ENV]: "-a.x,+c.z" })].sort()).toEqual(["b.y", "c.z"]);
    expect([...enabledSubgraphsFrom(undefined, {})]).toEqual([]);
  });

  test("switchedOff walks `within` to the opt-in ancestor", () => {
    const x = { id: "x", optIn: true, declaredBy: "a" };
    const parentOf = (id: string) => (id === "x" ? x : undefined);
    const child = { id: "x-skills", within: "x", declaredBy: "a" };
    expect(switchedOff(child, new Set(), parentOf)).toBe(true);
    expect(switchedOff(child, new Set(["a.x"]), parentOf)).toBe(false);
    expect(switchedOff(child, "all", parentOf)).toBe(false);
    expect(switchedOff({ id: "api", declaredBy: "a" }, new Set())).toBe(false);
  });
});

describe("off by default in the layer above", () => {
  test("not resolved, no skills, no Tool served — the sub-graph and its members", () => {
    const { b } = checkout();
    expect(ids(b)).not.toContain("x");
    expect(ids(b)).not.toContain("x-skills");
    expect(ids(b)).not.toContain("x-tools");
    expect(paths(b).some((p) => p.endsWith("/b/x"))).toBe(false);
    expect(resolveSkillDirs(b).some((d) => d.includes("/x/"))).toBe(false);
    expect(servedModules(b)).toEqual(["src/at.ts"]);
  });

  test("a non-opt-in named sub-graph is unaffected", () => {
    const { b } = checkout();
    expect(ids(b)).toContain("api");
    expect(ids(b)).toContain("api-skills");
  });
});

describe("on when the folio enables it", () => {
  test("`b` listing `a.x` resolves it, its from-within graphs, its skills and its Tool", () => {
    const { b } = checkout({ enableSubgraphs: ["a.x"] });
    const r = resolveDirectories(declarationChain(b));
    expect(r.find((d) => d.id === "x")?.optInSubgraph).toBe("a.x");
    expect(r.find((d) => d.id === "x-skills")?.optInSubgraph).toBe("a.x");
    expect(r.some((d) => d.absPath.endsWith("/b/x"))).toBe(true);
    expect(resolveSkillDirs(b).some((d) => d.endsWith("/a/x/skills"))).toBe(true);
    expect(servedModules(b)).toEqual(["src/at.ts", "src/xt.ts"]);
  });

  test("CAT_SUBGRAPHS `+a.x` turns it on, `-a.x` off", () => {
    const off = checkout();
    process.env[SUBGRAPHS_ENV] = "+a.x";
    expect(enabledSubgraphs(off.b).has("a.x")).toBe(true);
    expect(ids(off.b)).toContain("x-tools");
    expect(servedModules(off.b)).toContain("src/xt.ts");
    expect(resolveSkillDirs(off.b).some((d) => d.endsWith("/a/x/skills"))).toBe(true);

    clearCheckoutCache();
    const on = checkout({ enableSubgraphs: ["a.x"] });
    process.env[SUBGRAPHS_ENV] = "-a.x";
    expect(ids(on.b)).not.toContain("x");
    expect(servedModules(on.b)).toEqual(["src/at.ts"]);
    expect(resolveSkillDirs(on.b).some((d) => d.includes("/x/"))).toBe(false);
  });

  test("the folio decides, not the layer below: `a` enabling itself does not switch it on for `b`", () => {
    const { b } = checkout({}, { enableSubgraphs: ["a.x"] });
    expect(ids(b)).not.toContain("x");
    expect(servedModules(b)).toEqual(["src/at.ts"]);
  });
});

describe("the declaring layer's own resolution", () => {
  test("off unless it enables itself", () => {
    const off = checkout();
    expect(resolveDirectories([{ name: "a", root: off.a, own: true }]).map((d) => d.id)).not.toContain("x");
    expect(ownDirectories({ name: "a", root: off.a }).map((d) => d.id)).not.toContain("x");
    const on = checkout({}, { enableSubgraphs: ["a.x"] });
    expect(resolveDirectories([{ name: "a", root: on.a, own: true }]).map((d) => d.id)).toEqual(expect.arrayContaining(["x", "x-skills", "x-tools"]));
    expect(ownDirectories({ name: "a", root: on.a }).map((d) => d.id)).toContain("x");
  });
});

describe("an enable id that names nothing opt-in is refused", () => {
  test("by the schema: not qualified, listed twice, or this instance's own non-opt-in entry", () => {
    const base = { name: "a", version: "0.1.0", directories: A_DECL.directories };
    expect(CatHarnessDeclarationSchema.safeParse({ ...base, enableSubgraphs: ["a.x"] }).success).toBe(true);
    expect(CatHarnessDeclarationSchema.safeParse({ ...base, enableSubgraphs: ["x"] }).success).toBe(false);
    expect(CatHarnessDeclarationSchema.safeParse({ ...base, enableSubgraphs: ["a.x", "a.x"] }).success).toBe(false);
    const own = CatHarnessDeclarationSchema.safeParse({ ...base, enableSubgraphs: ["a.api"] });
    expect(own.success).toBe(false);
    expect(own.error?.issues[0]?.message).toContain("not an opt-in sub-graph");
  });

  test("by check:declaration-resolution, across the needs closure", () => {
    const { parent } = checkout({ enableSubgraphs: ["a.x", "a.api", "a.nope", "zzz.x"] });
    const r = checkDeclarationResolution(parent);
    const mine = r.findings.filter((f) => f.field === "enableSubgraphs");
    expect(mine.map((f) => f.subject).sort()).toEqual(["a.api", "a.nope", "zzz.x"]);
    expect(mine.every((f) => f.instance === "b")).toBe(true);
    expect(r.examined.enableSubgraphs).toBe(4);
  });

  test("an entry declared from within can be named; a layer above cannot be", () => {
    const closure = [
      { name: "b", directories: [] },
      { name: "a", directories: [{ id: "x", optIn: true as const }, { id: "x-inner", optIn: true as const }] },
    ];
    expect(enableSubgraphsProblems("b", ["a.x-inner"], closure)).toEqual([]);
    expect(enableSubgraphsProblems("b", ["c.x"], closure)[0]?.detail).toContain("needs");
  });
});

describe("one sub-graph requires another (owner, 2026-11-13: implied)", () => {
  // `a` gains `y`, opt-in, which requires `a.x`.
  const withY = {
    directories: [...A_DECL.directories, { id: "y", path: "y/", graphTypologies: ["cat-harness"], optIn: true, requires: ["a.x"] }],
  };

  test("closeOverRequires is transitive and adds only what is required", () => {
    const req = new Map([["l.c", ["l.b"]], ["l.b", ["l.a"]], ["l.z", ["l.q"]]]);
    expect([...closeOverRequires(new Set(["l.c"]), req)].sort()).toEqual(["l.a", "l.b", "l.c"]);
    expect([...closeOverRequires(new Set(["l.a"]), req)]).toEqual(["l.a"]);
    expect([...requiredBy("l.c", req)].sort()).toEqual(["l.a", "l.b"]);
    // A cycle ends.
    expect([...closeOverRequires(new Set(["l.p"]), new Map([["l.p", ["l.r"]], ["l.r", ["l.p"]]]))].sort()).toEqual(["l.p", "l.r"]);
  });

  test("a folio enabling `a.y` gets `a.x` too: its graphs, skills and Tool", () => {
    const { b } = checkout({ enableSubgraphs: ["a.y"] }, withY);
    expect([...enabledSubgraphs(b)].sort()).toEqual(["a.x", "a.y"]);
    expect(ids(b)).toContain("x-skills");
    expect(resolveSkillDirs(b).some((d) => d.endsWith("/a/x/skills"))).toBe(true);
    expect(servedModules(b)).toEqual(["src/at.ts", "src/xt.ts"]);
  });

  test("the requirement implies one way only: enabling `a.x` does not switch `a.y` on", () => {
    const { b } = checkout({ enableSubgraphs: ["a.x"] }, withY);
    expect([...enabledSubgraphs(b)]).toEqual(["a.x"]);
  });

  test("the schema accepts it; requiresProblems refuses a non-opt-in carrier, an unknown id and itself", () => {
    expect(CatHarnessDeclarationSchema.safeParse({ $schema: "cat-harness-declaration/1.0.0", version: "0.1.0", ...A_DECL, ...withY }).success).toBe(true);
    const closure = [{ name: "a", directories: [{ id: "x", optIn: true }, { id: "y", optIn: true }, { id: "api" }] }];
    expect(requiresProblems("a", [{ id: "y", optIn: true, requires: ["a.x"] }], closure)).toEqual([]);
    expect(requiresProblems("a", [{ id: "api", requires: ["a.x"] }], closure)[0]?.detail).toContain("not an opt-in sub-graph");
    expect(requiresProblems("a", [{ id: "y", optIn: true, requires: ["a.api"] }], closure)[0]?.detail).toContain("not an opt-in sub-graph");
    expect(requiresProblems("a", [{ id: "y", optIn: true, requires: ["c.x"] }], closure)[0]?.detail).toContain("needs");
    expect(requiresProblems("a", [{ id: "y", optIn: true, requires: ["a.y"] }], closure)[0]?.detail).toContain("itself");
  });

  test("check:declaration-resolution reports a `requires` that names nothing opt-in", () => {
    const { parent } = checkout({}, { directories: [...A_DECL.directories, { id: "y", path: "y/", graphTypologies: ["cat-harness"], optIn: true, requires: ["a.api"] }] });
    const r = checkDeclarationResolution(join(parent, "a"));
    expect(r.findings.filter((f) => f.subject === "y.requires")).toEqual([
      expect.objectContaining({ instance: "a", field: "enableSubgraphs", detail: expect.stringContaining("a.api") }),
    ]);
  });
});

describe("an opt-in group declared FROM WITHIN may require too (owner, 2026-11-13: L2/L3 own collab)", () => {
  // `x/graph.json` declares `x-collab`, opt-in inside the opt-in `x`, which
  // requires `a.x` (its level) and `a.y` (a top-level opt-in).
  const withY = {
    directories: [...A_DECL.directories, { id: "y", path: "y/", graphTypologies: ["cat-harness"], optIn: true }],
  };
  const X_GRAPH = {
    directories: [
      { id: "x-skills", path: "skills/", subgraph: true, graphTypologies: ["skills"] },
      { id: "x-tools", path: "tools/", subgraph: true, graphTypologies: ["tools"] },
      { id: "x-collab", path: "collab/", subgraph: true, graphTypologies: ["cat-harness"], optIn: true, requires: ["a.x", "a.y"] },
    ],
  };

  test("requiresDeclared reads the top level and every from-within file, keyed by the entry's own id", () => {
    const files: Record<string, string> = {
      "x/graph.json": JSON.stringify(X_GRAPH),
      // Deeper: a group inside `x/collab/`, by the `<dir>/<dir>.json` name.
      "x/collab/collab.json": JSON.stringify({ directories: [{ id: "x-collab-deep", path: "deep/", optIn: true, requires: ["a.x-collab"] }] }),
      "api/graph.json": "{ not json",
    };
    const req = requiresDeclared("a", withY.directories.map((d) => (d.id === "y" ? { ...d, requires: ["a.x"] } : d)), (rel) => files[rel]);
    expect(Object.fromEntries(req)).toEqual({
      "a.y": ["a.x"],
      "a.x-collab": ["a.x", "a.y"],
      "a.x-collab-deep": ["a.x-collab"],
    });
  });

  test("a folio enabling `a.x-collab` gets its level `a.x` and `a.y` too", () => {
    const { a, b } = checkout({ enableSubgraphs: ["a.x-collab"] }, withY);
    write(a, { "x/graph.json": X_GRAPH });
    expect([...enabledSubgraphs(b)].sort()).toEqual(["a.x", "a.x-collab", "a.y"]);
  });

  test("check:declaration-resolution holds a from-within `requires` to the same rule", () => {
    const { a, parent } = checkout({}, withY);
    write(a, {
      "x/graph.json": {
        directories: [
          ...X_GRAPH.directories.slice(0, 2),
          { id: "x-collab", path: "collab/", subgraph: true, graphTypologies: ["cat-harness"], optIn: true, requires: ["a.api"] },
        ],
      },
    });
    const r = checkDeclarationResolution(join(parent, "a"));
    expect(r.findings.filter((f) => f.subject === "x-collab.requires")).toEqual([
      expect.objectContaining({ instance: "a", field: "enableSubgraphs", detail: expect.stringContaining("a.api") }),
    ]);
  });
});

describe("an index root enables it in index.config.json (step 23.4)", () => {
  /** The checkout's parent as an index: no declaration of its own, an index.config.json naming `a` and `b`. */
  function indexCheckout(enable: string[]): string {
    const { parent } = checkout();
    write(parent, {
      "index.config.json": {
        $schema: "folio-index-config/v1",
        instances: [{ name: "a", source: { local: { at: "a" } } }, { name: "b", source: { local: { at: "b" } } }],
        enableSubgraphs: enable,
      },
    });
    return parent;
  }

  test("the index's list is the root's list", () => {
    expect([...enabledSubgraphs(indexCheckout(["a.x"]))]).toEqual(["a.x"]);
    expect([...enabledSubgraphs(indexCheckout([]))]).toEqual([]);
  });

  test("the served Tool groups follow it", () => {
    expect(servedModules(indexCheckout(["a.x"]))).toEqual(["src/at.ts", "src/xt.ts"]);
    expect(servedModules(indexCheckout([]))).toEqual(["src/at.ts"]);
  });

  test("the schema takes it, and refuses an id listed twice or not qualified", () => {
    const base = { $schema: "folio-index-config/v1", instances: [{ name: "a", source: { local: { at: "a" } } }] };
    expect(IndexConfigSchema.safeParse({ ...base, enableSubgraphs: ["a.x"] }).success).toBe(true);
    expect(IndexConfigSchema.safeParse({ ...base, enableSubgraphs: ["a.x", "a.x"] }).success).toBe(false);
    expect(IndexConfigSchema.safeParse({ ...base, enableSubgraphs: ["x"] }).success).toBe(false);
  });

  test("check:declaration-resolution refuses an index id that names nothing opt-in", () => {
    const r = checkDeclarationResolution(indexCheckout(["a.x", "a.api", "a.nope"]));
    const mine = r.findings.filter((f) => f.field === "enableSubgraphs");
    expect(mine.map((f) => f.subject).sort()).toEqual(["a.api", "a.nope"]);
    expect(mine.every((f) => f.instance === "(index)")).toBe(true);
  });
});

describe("the mount planner's default list", () => {
  const decl = { directories: A_DECL.directories, mountDefaults: undefined };

  test("leaves out an opt-in sub-graph the downstream has not enabled", () => {
    expect(defaultMountDirectoryIds("a", decl, new Set())).toEqual(["tools", "api"]);
    expect(defaultMountDirectoryIds("a", decl, new Set(["a.x"]))).toEqual(["tools", "x", "api"]);
  });

  test("filters the harness's own mountDefaults too", () => {
    expect(defaultMountDirectoryIds("a", { ...decl, mountDefaults: { directories: ["x", "api"] } }, new Set())).toEqual(["api"]);
  });

  test("with nothing opt-in, the list is exactly what it was", () => {
    const plain = { directories: A_DECL.directories.map(({ optIn: _o, ...d }) => d as { id: string; path: string }) };
    expect(defaultMountDirectoryIds("a", plain, new Set())).toEqual(["tools", "x", "api"]);
  });
});

test("the fixture's declarations parse", () => {
  const { a, b } = checkout({ enableSubgraphs: ["a.x"] });
  expect(readDeclaration(a)?.directories.find((d) => d.id === "x")?.optIn).toBe(true);
  expect(readDeclaration(b)?.enableSubgraphs).toEqual(["a.x"]);
  expect(JSON.parse(readFileSync(join(b, "b.json"), "utf-8")).needs).toEqual(["a"]);
});
