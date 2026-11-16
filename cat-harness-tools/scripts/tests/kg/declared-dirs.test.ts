/**
 * A declared directory exists, or says why it does not — both directions.
 *
 * @module scripts/tests/declared-dirs.test
 *
 * ## Why this check had to be written at all
 *
 * `resolveDirectories` is existence-filtered, so an absent declared directory
 * is dropped before any consumer sees it. Every consumer then reports a clean
 * run over nothing — the `dh4f` shape inside the resolver they all depend on.
 * Bean `8mbk`.
 *
 * ## The resolution rule is what this module got wrong first
 *
 * `scope: "repository"` resolves against the repository root, anything else
 * against the declaring layer's. A first measurement for `8mbk` joined
 * repo-scoped paths belonging to OTHER layers onto the layer root and
 * reported ten phantom absences out of 35 — every one the checker's own error.
 * So the rule gets a test of its own rather than living only inside the sweep.
 *
 * ## Falsified before it was trusted
 *
 * | break | result |
 * |---|---|
 * | phantom directory, no reason | **1 finding**, exit 1 |
 * | same, with `absent.reason` | 0 findings, exit 0 |
 * | `absent.reason` on a directory that EXISTS | **1 finding**, exit 1 |
 * | restored | 0 findings across 66 directories, 14 layers |
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { auditInstance, auditNested, auditUndeclaredState, conventionalStateDirectories, resolveDeclaredPath } from "../../check-declared-dirs.ts";
import { mayLeaveMain } from "../../qa-results.ts";
import { readDeclaration } from "../../../schemas/kg/cat-harness.ts";
import { notApplicableAlone } from "../../../test/support/checkout.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));
const made: string[] = [];

/** A layer declaring exactly the directories given. */
function instance(dirs: Array<Record<string, unknown>>): string {
  const root = mkdtempSync(join(tmpdir(), "declared-dirs-"));
  made.push(root);
  mkdirSync(root, { recursive: true });
  // The stem MUST equal `name`: `findDeclarationFile` matches on
  // `raw.name === stem`, so a `harness.json` declaring `name: "fixture"` is
  // not found at all — the fixture reads as a layer with no declaration,
  // and every assertion below passes over nothing.
  writeFileSync(
    join(root, "fixture.json"),
    JSON.stringify(
      { $schema: "cat-harness-declaration/1.0.0", name: "fixture", directories: dirs },
      null,
      2,
    ),
  );
  return root;
}

afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const dir = (over: Record<string, unknown> = {}) => ({
  id: "t",
  path: "somewhere/",
  graphTypologies: ["schemas"],
  ...over,
});

describe("the resolution rule", () => {
  test("`scope: repository` resolves against the repo, not the instance", () => {
    // `join` keeps the trailing slash a declared path carries.
    expect(resolveDeclaredPath({ path: "a/", scope: "repository" }, "/i", "/r")).toBe("/r/a/");
  });

  test("anything else resolves against the instance", () => {
    // The direction the first measurement got backwards.
    expect(resolveDeclaredPath({ path: "a/" }, "/i", "/r")).toBe("/i/a/");
    expect(resolveDeclaredPath({ path: "a/", scope: "instance" }, "/i", "/r")).toBe("/i/a/");
  });
});

describe("absent and unexplained is a finding", () => {
  test("a declared directory that is not on disk", () => {
    const root = instance([dir()]);
    const f = auditInstance(root, REPO);
    expect(f).toHaveLength(1);
    expect(f[0]!.kind).toBe("absent");
  });

  test("...and `absent.reason` clears it", () => {
    const root = instance([dir({ absent: { reason: "deliberate, and here is why" } })]);
    expect(auditInstance(root, REPO)).toEqual([]);
  });
});

describe("an entry declared FROM WITHIN is checked too", () => {
  /**
   * A layer whose `processes/` exists and carries a `processes.json`
   * declaring `nested` — the same from-within shape as `docs/docs.json` and
   * `beans/beans.json`.
   *
   * **`processes` rather than `docs`, deliberately.** `walkNested` reads only
   * the file a kind names as its `declarationFile`, and four kinds name one,
   * so any of them exercises the mechanism. `docs` was the first choice and is
   * the wrong one twice over: `check:site-dir-single-answer` refuses a source
   * file that writes the output site root as the literal `"docs"` — rightly,
   * since `siteDir()` is the single answer — and a docs-shaped fixture also
   * reads as if the nesting were a docs feature. It is not.
   */
  const PARENT = { id: "processes", path: "processes/", graphTypologies: ["processes"] };
  const withNested = (nested: Array<Record<string, unknown>>, makeDirs: readonly string[] = []): string => {
    const root = instance([PARENT]);
    const under = join(root, PARENT.id);
    mkdirSync(under, { recursive: true });
    for (const d of makeDirs) mkdirSync(join(under, d), { recursive: true });
    writeFileSync(join(under, "processes.json"), JSON.stringify({ name: "fixture", directories: nested }, null, 2));
    return root;
  };

  const decl = { directories: [PARENT] };

  test("absent and unexplained is a finding, where before it was invisible", () => {
    // The measured gap: `auditInstance` read `decl.directories` — top-level
    // only — so this entry was neither checked nor counted, and a path into
    // thin air reported exit 0.
    const root = withNested([{ id: "nested", path: "proposals", graphTypologies: ["proposals"] }]);
    const f = auditNested(root, REPO, decl);
    expect(f).toHaveLength(1);
    expect(f[0]!.kind).toBe("absent");
    expect(f[0]!.id).toBe("processes/nested");
  });

  test("...and it is clean once the directory is there", () => {
    const root = withNested([{ id: "nested", path: "proposals", graphTypologies: ["proposals"] }], ["proposals"]);
    expect(auditNested(root, REPO, decl)).toEqual([]);
  });

  test("`absent.reason` clears it, and an exemption that outlived its cause is caught", () => {
    const excused = { id: "nested", path: "proposals", graphTypologies: ["proposals"], absent: { reason: "why" } };
    expect(auditNested(withNested([excused]), REPO, decl)).toEqual([]);
    const stale = auditNested(withNested([excused], ["proposals"]), REPO, decl);
    expect(stale).toHaveLength(1);
    expect(stale[0]!.kind).toBe("stale-exemption");
  });

  test("the remedy names the DECLARING FILE, not the path's parent", () => {
    // The defect the first version of `declaringFile` shipped: it stripped the
    // last segment of the nested path, so a multi-segment path like
    // `assets/img/uml/overview` sent the reader to `assets/img/uml/` — a
    // directory holding no declaration at all. The parent's kind names the
    // file, so it is asked rather than composed.
    const root = withNested([{ id: "deep", path: "assets/img/uml/overview", graphTypologies: ["auto-docs"] }]);
    const f = auditNested(root, REPO, decl);
    expect(f).toHaveLength(1);
    expect(f[0]!.nestedIn?.file).toBe("processes/processes.json");
    expect(f[0]!.nestedIn?.file).not.toBe("processes/assets/img/uml/");
    expect(f[0]!.detail).toContain("processes/processes.json");
  });

  test("an off-checkout nested entry gets the SAME answer as a top-level one", () => {
    // The divergence this test exists to stop, and the reason
    // `offCheckoutFindings` is a function: the first version of `auditNested`
    // wrote `if (contentIsOffCheckout(e)) continue`, so a nested stored
    // directory got a silent skip while an identical top-level one got the
    // three states from `tipPresence`. Two answers to one question, decided by
    // where the entry happened to be declared.
    //
    // A `tip`-keyed entry is the one the keyings differ on, so it is the one
    // worth pinning. `walkNested` carries `storage` through, which is what
    // makes the nested side able to answer at all.
    //
    // **The two sides agree once the nested entry can actually BE mounted**,
    // and that is the amendment bean `najo` measured. A mount is keyed on a
    // directory id, and only a `"subgraph": true` entry has one at layer
    // level (bean `cmsl`): `resolveDirectories` lists it, so `tipLocations`
    // sees it and `state:mount` reaches it. Without the marker, `unmounted`
    // would print `bun run cat state:mount` for an entry that command cannot
    // touch — a remedy that does nothing — so that case is its own finding.
    // Neither side is ever silent, which is what this test is for.
    const stored = { id: "nested", path: "proposals", graphTypologies: ["proposals"], subgraph: true, storage: { branch: "cat/x", keyedBy: "tip" } };
    const nestedF = auditNested(withNested([stored]), REPO, decl);
    const topF = auditInstance(instance([{ id: "nested", path: "proposals", graphTypologies: ["proposals"], storage: { branch: "cat/x", keyedBy: "tip" } }]), REPO);
    // Same KINDS, whichever side declared it. Not the same ids or paths — those
    // differ by construction — and not necessarily empty: what matters is that
    // neither side silently returns nothing while the other reports.
    expect(nestedF.map((f) => f.kind)).toEqual(topF.map((f) => f.kind));
    expect(nestedF.length).toBeGreaterThan(0);
  });

  test("a nested branch entry that no mount can reach says SO, rather than naming the mount", () => {
    // The same entry without `"subgraph": true`. It is not listed at layer
    // level, so `state:mount` has no id to mount it under and `unmounted`'s
    // remedy would be false. Bean `najo`.
    const stored = { id: "nested", path: "proposals", graphTypologies: ["proposals"], storage: { branch: "cat/x", keyedBy: "tip" } };
    const f = auditNested(withNested([stored]), REPO, decl);
    expect(f.map((x) => x.kind)).toEqual(["unmountable"]);
    expect(f[0]!.detail).toContain('"subgraph": true');
  });

  test("auditInstance now reaches nested entries, so the sweep cannot miss them", () => {
    // The wiring, separately from the logic: a caller that only ever calls
    // `auditInstance` must still see a nested finding.
    const root = withNested([{ id: "nested", path: "proposals", graphTypologies: ["proposals"] }]);
    expect(auditInstance(root, REPO).filter((f) => f.id === "processes/nested")).toHaveLength(1);
  });
});

describe("explained but present is ALSO a finding", () => {
  test("an exemption that outlived its cause", () => {
    // The direction that rots quietly: nothing goes wrong when it does, so
    // nobody notices the declaration still claims a deliberate absence.
    const root = instance([dir({ absent: { reason: "was deliberate once" } })]);
    mkdirSync(join(root, "somewhere"), { recursive: true });
    const f = auditInstance(root, REPO);
    expect(f).toHaveLength(1);
    expect(f[0]!.kind).toBe("stale-exemption");
  });
});

describe("a file at the declared path is not the directory being there", () => {
  test("it is still reported absent", () => {
    // `existsSync` alone passes on a file, and a consumer calling `readdirSync`
    // on it throws rather than reporting an empty graph.
    const root = instance([dir()]);
    writeFileSync(join(root, "somewhere"), "not a directory");
    const f = auditInstance(root, REPO);
    expect(f).toHaveLength(1);
    expect(f[0]!.kind).toBe("absent");
  });
});

describe("a repository-scoped entry inside another instance is a mirror", () => {
  test("refused", () => {
    const owner = mkdtempSync(join(tmpdir(), "declared-dirs-owner-"));
    made.push(owner);
    mkdirSync(join(owner, "library"), { recursive: true });
    const root = instance([dir({ path: join(owner, "library") + "/", scope: "repository" })]);
    const f = auditInstance(root, "/", [root, owner]);
    expect(f.map((x) => x.kind)).toEqual(["mirror"]);
  });

  test("...but not inside an instance that CONTAINS the declaring one", () => {
    const root = instance([dir({ path: "x/", scope: "repository", absent: { reason: "fixture" } })]);
    // The repo root is "/" here, and it contains every layer.
    expect(auditInstance(root, "/", [root, "/"]).filter((x) => x.kind === "mirror")).toEqual([]);
  });
});

/** Standing alone, the checkout-level directories a composed checkout holds are not here. */
const CHECKOUT_LEVEL_ABSENT = notApplicableAlone(
  "the composed checkout's own `scope: \"repository\"` directories (the index's `uploads/` queue), which a cat-harness clone does not hold",
);

describe("the real corpus", () => {
  test("every declared directory in this repository resolves", async () => {
    const { layerRootsIn } = await import("../../../schemas/kg/cat-harness.ts");
    await import("../../../schemas/kg/folio-graph-typology.ts");
    const roots = layerRootsIn(REPO);
    // Vacuity guard: an empty discovery would make the assertion below pass
    // over nothing, which is the shape this whole check exists to catch.
    expect(roots.length).toBeGreaterThan(1);
    const all = roots.flatMap((r) => auditInstance(r, REPO, roots));
    // Whether the derived QA corpus is in this checkout is not this test's
    // question (bean `cxcn`, reader audit F7): it is leaving `main`. The GATE
    // still reports an absent off-main directory that declares no `storage`
    // — bean `16ei` kept that deliberately, and `5hox` adds the declaration —
    // so only that one finding is set aside here, and only for those kinds.
    const offMain = (f: (typeof all)[number]): boolean => {
      if (f.kind !== "absent") return false;
      const decl = readDeclaration(f.instance) as { directories?: Array<{ id: string; graphTypologies?: string[] }> } | undefined;
      const entry = decl?.directories?.find((d) => d.id === f.id);
      return entry !== undefined && mayLeaveMain(entry);
    };
    // And `unmounted` is not this test's question either, for the same reason
    // one state over. Bean `najo`: `beans/queue/` is kept at a branch tip, so
    // whether it is on disk depends on whether this RUNNER ran
    // `bun run cat state:mount` — a session has, a `bun test` shard has not. A unit
    // test whose verdict flips with the environment is worse than no test: it
    // reads as a defect in the tree when the tree is fine, which is how a suite
    // teaches people to re-run it until it passes.
    //
    // The question itself is kept, where it belongs: `check:declared-dirs` runs
    // as a GATE in a job that mounts first, and fails there. Only `unmounted`
    // is set aside — `not-cut-over` (two copies, nothing authoritative) and
    // `unmountable` (a declaration no mount can reach) are defects in the
    // declaration itself and stay failing here, whatever the environment.
    const unmounted = (f: (typeof all)[number]): boolean => f.kind === "unmounted";
    // And standing alone, a `scope: "repository"` directory that is simply
    // ABSENT is the composed checkout's, not a defect of this one — the index
    // checkout's own `uploads/` queue, which cat-harness declares on its
    // behalf (owner, 2026-10-08) and which a cat-harness clone does not hold.
    // Not applicable there, and said so; composed, it is checked like any
    // other directory.
    const composedOnly = (f: (typeof all)[number]): boolean => {
      if (!CHECKOUT_LEVEL_ABSENT || f.kind !== "absent") return false;
      const decl = readDeclaration(f.instance) as { directories?: Array<{ id: string; scope?: string }> } | undefined;
      return decl?.directories?.find((d) => d.id === f.id)?.scope === "repository";
    };
    expect(all.filter((f) => !offMain(f) && !unmounted(f) && !composedOnly(f))).toEqual([]);
  });
});

/**
 * `undeclared-state` (bean `hp54`): the REVERSE direction, for state only. A
 * folio carried `beans/` and `todos/` on main, declared nowhere; every check
 * above compares declarations to disk and could not see it.
 */
describe("undeclared-state — a state directory on disk that nothing declares (hp54)", () => {
  test("the conventional state paths are beans/ and todos/, and nothing that holds content", () => {
    const ids = conventionalStateDirectories().map((d) => d.id).sort();
    expect(ids).toContain("beans");
    expect(ids).toContain("todos");
    expect(ids).not.toContain("library");
    expect(ids).not.toContain("skills");
  });

  test("present and undeclared is a finding — named, with the declaration to add", () => {
    const root = instance([]);
    mkdirSync(join(root, "beans"));
    mkdirSync(join(root, "todos"));
    const f = auditUndeclaredState(root, root);
    expect(f.map((x) => `${x.id}:${x.kind}`).sort()).toEqual(["beans:undeclared-state", "todos:undeclared-state"]);
    expect(f[0]!.detail).toContain("cat/<instance>/");
    // It reports; it never removes.
    expect(f[0]!.detail).toContain("Nothing is removed");
  });

  test("declared — either source — is not a finding", () => {
    const root = instance([
      { id: "beans", path: "beans/", graphTypologies: ["beans"] },
      { id: "todos", path: "todos/", graphTypologies: ["todos"], source: { kind: "branch", branch: "cat/fixture/todos", keyedBy: "tip" } },
    ]);
    mkdirSync(join(root, "beans"));
    mkdirSync(join(root, "todos"));
    expect(auditUndeclaredState(root, root)).toEqual([]);
  });

  test("an undeclared uploads/ is the repository's data store, not a finding (owner, 2026-11-03)", () => {
    const root = instance([]);
    mkdirSync(join(root, "uploads"));
    mkdirSync(join(root, "beans"));
    expect(auditUndeclaredState(root, root).map((x) => x.id)).toEqual(["beans"]);
  });

  test("absent is not a finding, and neither is an instance with no declaration at all", () => {
    expect(auditUndeclaredState(instance([]), REPO)).toEqual([]);
    const bare = mkdtempSync(join(tmpdir(), "declared-dirs-bare-"));
    made.push(bare);
    mkdirSync(join(bare, "beans"));
    expect(auditUndeclaredState(bare, bare)).toEqual([]);
  });
});
