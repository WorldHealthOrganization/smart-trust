/**
 * Placement PR0 (bean `ejye`): the three mechanisms the staged moves stand on,
 * each pinned on a THROWAWAY tree and then held against this checkout.
 *
 * - **0a, the checkout aggregates** (cmsl option A). A corpus-wide question is
 *   answered by the checkout's root layer, which `needs` every staged
 *   layer; the platform names none of its dependents.
 * - **0b, extension by id.** A dependent's `scenarios/` extends a lower role
 *   (skills), actor (roles, capabilities) or capability (requires), pointing
 *   DOWN at it the way a voice points at the role it addresses.
 * - **0c, concern groups for every grouping kind**, declared from within and
 *   inherited as members (option A one level down).
 * - **Ruling 6**: a Tool may name its own specific subprocesses.
 *
 * Fixtures first, because an assertion derived from the data it checks passes
 * on broken data (`yag0`). The live-checkout block carries the falsifiers the
 * proposal named.
 *
 * @module scripts/tests/placement-pr0-mechanisms
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { harnessRel } from "../lib/harness-layout.ts";

import { layerRootsIn, readDeclaration, resolveDirectories } from "../../schemas/kg/cat-harness.js";
import {
  checkoutDependentsOf,
  checkoutDirectories,
  checkoutDirectoriesForGraph,
  corpusDirectoriesForGraph,
  declarationChain,
  repositoryMirrors,
} from "../../schemas/kg/harness-config.js";
import { readRoleGraph, type LoadedActor, type RoleGraph } from "../../schemas/process/role-graph.js";
import {
  checkoutActors,
  checkoutCapabilities,
  checkoutRoleGraph,
  overlayRoleGraphs,
} from "../../schemas/process/scenario-overlay.js";
import { ToolDefinitionSchema } from "../../schemas/tools/tool.js";
import { ConcernGroupsSchema } from "../../schemas/kg/concern-groups.js";
import { declaredGroupsIn, groupedChildrenIn, groupingKinds, resolveGroups } from "../concern-groups.js";
import { packageDirsIn } from "../skill-topics.js";
import { knownSkills, workflowFiles } from "../known-skills.js";
import { collect as collectInstanceGraph } from "../check-instance-graph.js";
import { collect as collectConcernGroups } from "../check-concern-groups.js";

const REPO = resolve(import.meta.dir, "../../..");
const PLATFORM = join(REPO, "cat-harness");

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Write `rel` under `root` with JSON or text content. */
function put(root: string, rel: string, body: unknown): void {
  const p = join(root, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

/**
 * A checkout: a ROOT layer declared at the top, `base` (the platform's
 * stand-in), and two dependents `a` and `b` that each need `base`.
 */
function checkout(extra: (root: string) => void = () => {}): string {
  const root = mkdtempSync(join(tmpdir(), "pr0-"));
  made.push(root);
  put(root, "top.json", { name: "top", needs: ["a", "b", "base"], directories: [{ id: "beans", path: "beans/", graphTypologies: ["beans"] }] });
  mkdirSync(join(root, "beans"), { recursive: true });
  put(root, "base/base.json", {
    name: "base",
    needs: [],
    directories: [
      { id: "library", path: "library/", graphTypologies: ["library"] },
      { id: "skills", path: "skills/", graphTypologies: ["skills"] },
      { id: "scenarios", path: "scenarios/", graphTypologies: ["scenarios"] },
      { id: "processes", path: "processes/", graphTypologies: ["processes"] },
    ],
  });
  for (const d of ["library", "skills", "scenarios", "processes"]) mkdirSync(join(root, "base", d), { recursive: true });
  for (const n of ["a", "b"]) {
    put(root, `${n}/${n}.json`, { name: n, needs: ["base"], directories: [] });
    mkdirSync(join(root, n, "library"), { recursive: true });
  }
  extra(root);
  return root;
}

// ── 0a ──────────────────────────────────────────────────────────────

describe("0a — the checkout aggregates", () => {
  test("a corpus-wide question sees every staged instance's member", () => {
    const root = checkout();
    const libs = checkoutDirectoriesForGraph("library", root).map((p) => relative(root, p)).sort();
    expect(libs).toEqual(["a/library", "b/library", "base/library"]);
  });

  test("the platform resolved ALONE sees nothing above it (cmsl falsifier: a split checkout sees less)", () => {
    const root = checkout();
    const alone = resolveDirectories(declarationChain(join(root, "base"))).map((d) => relative(root, d.absPath));
    expect(alone.every((p) => p.startsWith("base/"))).toBe(true);
  });

  test("`corpusDirectoriesForGraph` is the instance plus what is stacked on it — never its dependencies", () => {
    const root = checkout();
    expect(corpusDirectoriesForGraph(join(root, "base"), "library").map((p) => relative(root, p)).sort()).toEqual([
      "a/library",
      "b/library",
      "base/library",
    ]);
    // `a` has nothing stacked on it, and does not see `base` or `b` by this question.
    expect(corpusDirectoriesForGraph(join(root, "a"), "library").map((p) => relative(root, p))).toEqual(["a/library"]);
  });

  test("checkout-level state declared by the root instance is reached from the platform", () => {
    const root = checkout();
    expect(corpusDirectoriesForGraph(join(root, "base"), "beans").map((p) => relative(root, p))).toEqual(["beans"]);
  });

  test("dependents are found from the checkout, deepest first", () => {
    const root = checkout();
    expect(checkoutDependentsOf(join(root, "base")).map((d) => d.name).sort()).toEqual(["a", "b", "top"]);
  });

  test("a `scope: repository` entry in a non-root instance is a mirror, and the gate refuses it", () => {
    const root = checkout((r) =>
      put(r, "base/base.json", {
        name: "base",
        needs: [],
        directories: [{ id: "a-library", path: "a/library/", scope: "repository", graphTypologies: ["library"] }],
      }),
    );
    expect(repositoryMirrors(root)).toEqual(["base#a-library"]);
    expect(collectInstanceGraph(root).problems.map((p) => p.problem.kind)).toContain("repository-mirror");
  });

  // cat-harness-tools#1701: a rooted checkout (an IG repository that is its
  // own index) mounts the platform, which declares checkout-level state for
  // every checkout. That is no mirror; naming another instance's directory,
  // or two platform instances claiming one path, still is.
  test("checkout-level state a platform instance declares for every checkout is not a mirror", () => {
    const root = checkout((r) =>
      put(r, "base/base.json", {
        name: "base",
        needs: [],
        directories: [{ id: "todos", path: "todos/", scope: "repository", graphTypologies: ["todos"] }],
      }),
    );
    expect(repositoryMirrors(root)).toEqual([]);
    expect(collectInstanceGraph(root).problems.map((p) => p.problem.kind)).not.toContain("repository-mirror");
  });

  test("two non-root instances claiming one repository path are both reported", () => {
    const root = checkout((r) => {
      put(r, "base/base.json", {
        name: "base",
        needs: [],
        directories: [{ id: "todos", path: "todos/", scope: "repository", graphTypologies: ["todos"] }],
      });
      put(r, "b/b.json", {
        name: "b",
        needs: ["base"],
        directories: [{ id: "todos-too", path: "todos", scope: "repository", graphTypologies: ["todos"] }],
      });
    });
    expect(repositoryMirrors(root)).toEqual(["b#todos-too", "base#todos"]);
  });

  test("an instance the root does not reach is unstaged, and the gate refuses it", () => {
    const root = checkout((r) => put(r, "top.json", { name: "top", needs: ["a"], directories: [] }));
    const kinds = collectInstanceGraph(root).problems.filter((p) => p.problem.kind === "unstaged");
    expect(kinds.map((p) => p.problem.detail).join("\n")).toContain("b");
  });

  test("a member's OWN declaration file is read: sci's skills.json declares its lean/ from within", () => {
    const root = checkout((r) => {
      mkdirSync(join(r, "a", "skills", "lean"), { recursive: true });
      put(r, "a/skills/skills.json", {
        $schema: "skill-topics/v1",
        topics: [],
        directories: [{ id: "lean-skills", path: "lean", subgraph: true, graphTypologies: ["skills"] }],
      });
    });
    const inA = resolveDirectories(declarationChain(join(root, "a")));
    const lean = inA.find((d) => d.id === "lean-skills");
    expect(lean && relative(root, lean.absPath)).toBe("a/skills/lean");
    expect(lean?.member).toBe("a");
    expect(lean?.within).toBe("skills");
    expect(checkoutDirectories(root).some((d) => relative(root, d.absPath) === "a/skills/lean")).toBe(true);
  });
});

// ── 0b ──────────────────────────────────────────────────────────────

const BASE_ROLES: RoleGraph = {
  name: "base",
  roles: [
    { id: "librarian", title: "Librarian", description: "Files sources.", actorKinds: ["person"], skills: ["library-ingestion"] },
    { id: "reviewer", title: "Reviewer", description: "Reviews.", actorKinds: ["person"], skills: [] },
  ] as RoleGraph["roles"],
};

describe("0b — roles, actors and capabilities extended by id", () => {
  test("an extension ADDS skills to a lower role and overrides nothing", () => {
    const { graph, extensions } = overlayRoleGraphs(BASE_ROLES, [
      { instance: "core", graph: { name: "core", roles: [], extensions: [{ role: "librarian", skills: ["filing-dublin-core", "library-ingestion"] }] } },
    ]);
    const lib = graph.roles.find((r) => r.id === "librarian")!;
    expect(lib.skills).toEqual(["library-ingestion", "filing-dublin-core"]);
    expect(lib.title).toBe("Librarian");
    expect(extensions).toEqual([{ instance: "core", role: "librarian", skills: ["filing-dublin-core"] }]);
    // the input is not mutated
    expect(BASE_ROLES.roles[0]!.skills).toEqual(["library-ingestion"]);
  });

  test("redeclaring a lower role is refused — extend it instead", () => {
    // A redeclaration that only ADDS is a move in flight, accepted with a
    // warning (owner, 2026-10-23); one that changes what the lower role says
    // is refused, and that is the case pinned here.
    expect(() =>
      overlayRoleGraphs(BASE_ROLES, [
        { instance: "core", graph: { name: "core", roles: [{ ...BASE_ROLES.roles[0]!, title: "Cataloguer" }] } },
      ]),
    ).toThrow(/already declared by base/);
  });

  test("an extension may point only DOWN: at a role declared below it", () => {
    expect(() =>
      overlayRoleGraphs(BASE_ROLES, [{ instance: "core", graph: { name: "core", roles: [], extensions: [{ role: "nobody", skills: ["x"] }] } }]),
    ).toThrow(/no instance below it declares/);
  });

  test("a higher instance's NEW role may inherit a lower one", () => {
    const { graph } = overlayRoleGraphs(BASE_ROLES, [
      {
        instance: "sci",
        graph: { name: "sci", roles: [{ id: "proof-reviewer", title: "Proof reviewer", description: "Reviews proofs.", actorKinds: ["agent"], inherits: ["reviewer"], skills: [] }] as RoleGraph["roles"] },
      },
    ]);
    expect(graph.roles.map((r) => r.id)).toEqual(["librarian", "reviewer", "proof-reviewer"]);
  });

  test("on a checkout: the platform's role graph gains a dependent's extension; identical without one", () => {
    const root = checkout((r) => {
      put(r, "base/scenarios/roles.json", { name: "base", roles: BASE_ROLES.roles });
      put(r, "a/a.json", { name: "a", needs: ["base"], directories: [{ id: "scenarios", path: "scenarios/", graphTypologies: ["scenarios"] }] });
      put(r, "a/scenarios/roles.json", { name: "a", roles: [], extensions: [{ role: "librarian", skills: ["filing-dublin-core"] }] });
    });
    const own = readRoleGraph(join(root, "base", "scenarios"))!;
    const seen = checkoutRoleGraph(join(root, "base"), own)!;
    expect(seen.graph.roles.find((r) => r.id === "librarian")!.skills).toEqual(["library-ingestion", "filing-dublin-core"]);
    // `b` extends nothing: its view of its own (absent) graph is unchanged.
    expect(checkoutRoleGraph(join(root, "b"), undefined)).toBeUndefined();
  });

  test("actors: an extension adds roles and capabilities; a new id is a new actor; a redeclared id is refused", () => {
    const root = checkout((r) => {
      put(r, "base/scenarios/actors/claude.json", { id: "claude", title: "Claude", kind: "agent", roles: ["reviewer"], capabilities: ["git-read"] });
      put(r, "a/a.json", { name: "a", needs: ["base"], directories: [{ id: "scenarios", path: "scenarios/", graphTypologies: ["scenarios"] }] });
      put(r, "a/scenarios/actors/claude.json", { extends: "claude", roles: ["proof-reviewer"], capabilities: ["lean-toolchain"] });
      put(r, "a/scenarios/actors/lean-mcp.json", { id: "lean-mcp", title: "Lean MCP", kind: "system" });
    });
    const actors = checkoutActors(join(root, "base"), join(root, "base", "scenarios", "actors"));
    const claude = actors.find((x) => x.id === "claude") as LoadedActor;
    expect(claude.roles).toEqual(["reviewer", "proof-reviewer"]);
    expect(claude.capabilities).toEqual(["git-read", "lean-toolchain"]);
    expect(claude.kind).toBe("agent");
    expect(actors.map((x) => x.id).sort()).toEqual(["claude", "lean-mcp"]);

    put(root, "a/scenarios/actors/dup.json", { id: "claude", title: "Claude again", kind: "agent" });
    expect(() => checkoutActors(join(root, "base"), join(root, "base", "scenarios", "actors"))).toThrow(/already declared below/);
  });

  test("an actor extension may not carry anything but roles and capabilities", () => {
    const root = checkout((r) => {
      put(r, "base/scenarios/actors/claude.json", { id: "claude", title: "Claude", kind: "agent" });
      put(r, "a/a.json", { name: "a", needs: ["base"], directories: [{ id: "scenarios", path: "scenarios/", graphTypologies: ["scenarios"] }] });
      put(r, "a/scenarios/actors/claude.json", { extends: "claude", kind: "person" });
    });
    expect(() => checkoutActors(join(root, "base"), join(root, "base", "scenarios", "actors"))).toThrow(/may not carry kind/);
  });

  test("capabilities: a new probe is added, an extension adds `requires`, a redeclared id is refused", () => {
    const root = checkout((r) => {
      put(r, "base/scenarios/capabilities/python3.json", { id: "python3", requires: [] });
      put(r, "a/a.json", { name: "a", needs: ["base"], directories: [{ id: "scenarios", path: "scenarios/", graphTypologies: ["scenarios"] }] });
      put(r, "a/scenarios/capabilities/lean-toolchain.json", { id: "lean-toolchain", requires: ["python3"] });
      put(r, "a/scenarios/capabilities/python3.json", { extends: "python3", requires: ["pip"] });
    });
    const caps = checkoutCapabilities(join(root, "base"), join(root, "base", "scenarios", "capabilities"));
    expect(caps.map((c) => c.id).sort()).toEqual(["lean-toolchain", "python3"]);
    expect(caps.find((c) => c.id === "python3")!.requires).toEqual(["pip"]);
  });
});

// ── 0c ──────────────────────────────────────────────────────────────

describe("0c — concern groups for every grouping kind", () => {
  test("the grouping kinds are read from the registry: skills, processes, schemas, library, uml and code (tests)", () => {
    expect(groupingKinds()).toEqual(["code", "library", "processes", "schemas", "skills", "uml"]);
  });

  test("a kind's declaration file names its groups by code, and a declared-but-absent group throws", () => {
    const root = checkout((r) => {
      mkdirSync(join(r, "base", "processes", "sdlc"), { recursive: true });
      put(r, "base/processes/processes.json", { $schema: "concern-groups/v1", groups: ["sdlc"] });
    });
    expect(declaredGroupsIn(join(root, "base", "processes"), "processes")).toEqual([{ code: "sdlc", path: "sdlc" }]);
    put(root, "base/processes/processes.json", { $schema: "concern-groups/v1", groups: ["sdlc", "kg"] });
    expect(() => declaredGroupsIn(join(root, "base", "processes"), "processes")).toThrow(/"kg" names kg\/, which does not exist/);
  });

  test("a group declared once below is INHERITED: the dependent's same-named directory is a member", () => {
    const root = checkout((r) => {
      put(r, "base/skills/skills.json", {
        $schema: "skill-topics/v1",
        topics: [{ id: "library", path: "library", title: "Library", description: "Library work." }],
      });
      put(r, "base/skills/library/library-core/library-ingestion.md", "# x\n");
      put(r, "a/a.json", { name: "a", needs: ["base"], directories: [] });
      put(r, "a/skills/library/cataloguing/bib-qa.md", "# y\n");
    });
    // core's `skills/library/` is read as a GROUP holding `cataloguing`, not a package called "library".
    expect(packageDirsIn(join(root, "a", "skills")).map((p) => [p.rel, p.topic])).toEqual([["library/cataloguing", "library"]]);
    const groups = resolveGroups("skills", root);
    expect(groups.map((g) => [g.within, g.code, g.declaredBy, g.members.map((m) => m.member)])).toEqual([
      ["skills", "library", "base", ["base", "a"]],
    ]);
  });

  test("the same walk serves processes: a dependent's `processes/<group>/` is grouped too", () => {
    const root = checkout((r) => {
      mkdirSync(join(r, "base", "processes", "tools"), { recursive: true });
      put(r, "base/processes/processes.json", { $schema: "concern-groups/v1", groups: ["tools"] });
      put(r, "b/processes/tools/my-tool/run.bpmn", "<x/>");
    });
    expect(groupedChildrenIn(join(root, "b", "processes"), "processes").map((c) => [c.rel, c.group])).toEqual([
      ["tools/my-tool", "tools"],
    ]);
  });

  test("a dependent that REDECLARES a group is reported: a higher instance adds no group of its own", () => {
    const root = checkout((r) => {
      for (const n of ["base", "a"]) {
        mkdirSync(join(r, n, "processes", "sdlc"), { recursive: true });
        put(r, `${n}/processes/processes.json`, { $schema: "concern-groups/v1", groups: ["sdlc"] });
      }
    });
    const g = resolveGroups("processes", root).find((x) => x.code === "sdlc")!;
    expect(g.declaredBy).toBe("base");
    expect(g.redeclaredBy).toEqual(["a"]);
  });

  test("the declaration shape is strict", () => {
    expect(ConcernGroupsSchema.safeParse({ $schema: "concern-groups/v1", groups: ["sdlc"] }).success).toBe(true);
    expect(ConcernGroupsSchema.safeParse({ $schema: "concern-groups/v1", groups: ["a/b"] }).success).toBe(false);
    expect(ConcernGroupsSchema.safeParse({ $schema: "concern-groups/v1", groups: [], topics: [] }).success).toBe(false);
  });
});

// ── Ruling 6 ────────────────────────────────────────────────────────

describe("ruling 6 — a Tool may describe its own specific subprocesses", () => {
  const tool = {
    id: "probe",
    title: "Probe",
    description: "A probe.",
    install: { none: true },
    invoke: { shell: "true" },
    io: { inputs: [], outputs: [] },
    satisfies: ["library-ingestion"],
  };
  test("`subprocesses` takes process ids", () => {
    expect(ToolDefinitionSchema.safeParse({ ...tool, subprocesses: ["probe-retry-loop"] }).success).toBe(true);
    expect(ToolDefinitionSchema.safeParse({ ...tool, subprocesses: ["Not An Id"] }).success).toBe(false);
  });
});

// ── This checkout: the falsifiers ───────────────────────────────────

describe("this checkout", () => {
  test("no instance but the root declares a repository-scoped entry, and every instance is staged", () => {
    expect(repositoryMirrors(REPO)).toEqual([]);
    const kinds = collectInstanceGraph(REPO).problems.map((p) => p.problem.kind);
    expect(kinds).not.toContain("unstaged");
    expect(kinds).not.toContain("repository-mirror");
  });

  test("falsifier 1: the corpus-wide answer still holds every dependent's skills and diagrams", () => {
    const corpus = knownSkills(PLATFORM, "checkout");
    // One skill from each owner the 19 mirrors used to reach.
    for (const s of ["lean-formal-edges", "reference-dataset-ingestion", "iris-dspace", "materialize-remote", "deep-document-research", "ig-build-pipeline"]) {
      expect(corpus.has(s)).toBe(true);
    }
    const files = workflowFiles(PLATFORM, "checkout").map((f) => relative(REPO, f));
    // DIIG's diagram moves to smart-base's opt-in `collab/` (owner, 2026-11-13).
    // Either place proves the corpus reaches the dependent's diagrams, and
    // accepting both lets this land before or after that move.
    expect(
      files.some((f) =>
        ["smart-base/collab/processes/diig-investment-path.bpmn", "smart-base/methodologies/processes/diig-investment-path.bpmn"].includes(f),
      ),
    ).toBe(true);
    expect(files).toContain("folio-assistant-core/processes/library/deep-document-research.bpmn");
  });

  test("falsifier 2: the platform resolved alone names nothing above it", () => {
    // RESTATED 2026-10-09. The checkout-root state graphs (`beans/`, `todos/`,
    // `fsh-guts/`, `issue-marks/`) were the ROOT layer's until the owner
    // removed that declaration (3d4caf6, 2026-10-08); the platform declares
    // them now, `scope: "repository"` (coordinator decision (b)), so they and
    // their nested nodes resolve from the platform alone. They sit at the
    // checkout root -- not inside any layer -- so they are not "above" it
    // in the sense this falsifier means: a dependent's directory. That stays
    // forbidden, and is checked directly: no hosted root may be a layer.
    const hosted = (readDeclaration(PLATFORM)?.directories ?? [])
      .filter((d) => d.scope === "repository")
      .map((d) => d.path.replace(/\/+$/, ""));
    expect(hosted.length).toBeGreaterThan(0);
    const instances = new Set(layerRootsIn(REPO).map((r) => relative(REPO, r)));
    expect(hosted.filter((h) => instances.has(h))).toEqual([]);
    const alone = resolveDirectories(declarationChain(PLATFORM)).map((d) => relative(REPO, d.absPath));
    const above = alone.filter(
      (p) => !/^(cat-harness|bootstrap|bootstrap-tools)(\/|$)/.test(p) && !hosted.some((h) => p === h || p.startsWith(`${h}/`)),
    );
    expect(above).toEqual([]);
    expect(knownSkills(PLATFORM, "instance").has("lean-formal-edges")).toBe(false);
  });

  test("the five libraries the mirrors named are all in the corpus", () => {
    // Six until bean `j7ql`: agent-skills/library dissolved into cat-harness/library (#1787).
    const libs = corpusDirectoriesForGraph(PLATFORM, "library").map((p) => relative(REPO, p));
    for (const l of [`cat-harness/${harnessRel("library/corpus", join(REPO, "cat-harness"))}`, `folio-assistant-core/${harnessRel("library/corpus", join(REPO, "folio-assistant-core"))}`, "folio-assistant-sci/library", "smart-base/library", "who-iris/library"]) {
      expect(libs).toContain(l);
    }
  });

  test("concern groups are clean: codes of the list, declared once", () => {
    const r = collectConcernGroups();
    expect(r.problems).toEqual([]);
    expect(r.codes).toEqual(["sdlc", "process", "tools", "kg", "library", "content", "ui", "conduct"]);
  });
});
