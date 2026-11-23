/**
 * `todos` tests that read the aggregate repository's own root — the
 * root-declared `todos/` and `beans/` graphs, and the processes every layer
 * stacks — moved here from `cat-harness/scripts/tests/todos.test.ts` (bean
 * `ho66`), as `merge-guard-workflows.test.ts` was: a standalone cat-harness
 * layer has no such root, and `check:cat-harness-standalone` collects every
 * test in that layer. Every test there that read the real corpus moved,
 * including the ones that passed standalone only because they iterated over
 * nothing. The rest of that file's tests stay there.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readDeclaration, repoRootFor } from "../../schemas/kg/cat-harness.js";
import { BEAN_GRAPH_FILE, parseBeanGraph } from "../../schemas/sdlc/bean-graph.js";
import { contentIsOffCheckout, resolveSubgraphSource } from "../../schemas/kg/subgraph-source.js";
import { TODO_GRAPH_FILE, parseTodoGraph } from "../../schemas/sdlc/todo-graph.js";
import { ROOT, TODO_ROOT, readTodos, todoDirs } from "../../scripts/todos.js";
import { siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { workflowFiles } from "../../scripts/known-skills.js";
import { loadProcessModel, processDiagrams } from "../../src/workflow/process-model.js";
import { buildDocsProjections } from "../support/checkout.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * The checkout's diagrams as the real parser reads them — each one's process id
 * and the processes it calls, in `processDiagrams` order — loaded ONCE at module
 * scope for the two published-hierarchy tests below.
 *
 * Bean `sff8`. Each of those tests walked the whole corpus through
 * `loadProcessModel` for the same answer, two corpus passes charged one apiece
 * to a 5000 ms budget. Only the derived ids and edges are kept, never a model.
 */
const CORPUS: ReadonlyArray<{ id: string; calls: string[] }> = await (async () => {
  const out: Array<{ id: string; calls: string[] }> = [];
  for (const f of processDiagrams(workflowFiles(ROOT, "checkout"))) {
    const m = await loadProcessModel(f);
    const calls = new Set<string>();
    for (const n of m.nodes.values()) if (n.calledElement) calls.add(n.calledElement);
    out.push({ id: m.id, calls: [...calls].sort() });
  }
  return out;
})();

describe("the declaration and the directory agree", () => {
  test("cat-harness declares the checkout's `todos` graph, repository-scoped", () => {
    // It was the ROOT layer's from placement PR0 (bean `ejye`): `todos/`
    // sits at the checkout's root and belongs to the checkout, not to one
    // layer. RESTATED 2026-10-09: the owner removed the root declaration on
    // 2026-10-08 (3d4caf6), and the checkout-root state graphs are now
    // declared by cat-harness with `scope: "repository"` (coordinator decision
    // (b); cat-harness#10 gives their nested graphs that owner). What has not
    // changed is where the directory is -- the checkout root -- and that
    // exactly one declaration says so.
    expect(readDeclaration(repoRootFor(ROOT))).toBeUndefined();
    const entry = readDeclaration(ROOT)?.directories?.find((x) => x.graphTypologies?.includes("todos"));
    expect(entry?.path).toBe("todos/");
    expect(entry?.scope).toBe("repository");
  });

  test("the declared directory EXISTS — declare only what exists", () => {
    expect(existsSync(TODO_ROOT())).toBe(true);
    expect(existsSync(join(TODO_ROOT(), TODO_GRAPH_FILE))).toBe(true);
  });

  test("its own declaration parses, and names every node", () => {
    // FOUR now, not two. `boards` and `positions` joined on 2026-09-21 (bean
    // `8hg7`), and they are the OMG split rather than two more todo folders:
    // a board is the semantic model — what it shows — and the positions are
    // its Diagram Interchange, where each note was drawn. They share a `path`
    // deliberately, because the layout belongs beside the thing it lays out.
    const g = parseTodoGraph(
      JSON.parse(readFileSync(join(TODO_ROOT(), TODO_GRAPH_FILE), "utf8")),
    );
    expect(g.directories.map((d) => d.id).sort()).toEqual([
      "boards",
      "feedback",
      "items",
      "positions",
    ]);
  });

  test("every declared node directory is on disk", () => {
    // The `dh4f` shape one level down: a node declared inside the graph but
    // absent, so the reader walks nothing and reports no todos.
    //
    // This caught its own author. `todos/feedback/` existed locally and was
    // never committed — git does not track an empty directory — so the suite
    // passed here and failed on CI's fresh clone, which is the ONLY place the
    // defect is visible. A `.gitkeep` fixes it; the test is why anyone knew.
    for (const d of todoDirs()) expect({ dir: d, there: existsSync(d) }).toEqual({ dir: d, there: true });
  });

  test("the BEAN graph's declared directories are on disk too", () => {
    // Same assertion, same defect, different graph — and this one was
    // PRE-EXISTING: `beans/beans.json` has declared a `workflows` node since
    // the graph was written and the directory had never been committed.
    // Nothing checked it, because the bean graph had no equivalent of this
    // test. Found 2026-09-19 while fixing the todo layer.
    //
    // Asserted here rather than in a bean-graph test file so the two cannot
    // drift: the rule is about DECLARATIONS, not about todos.
    // ...EXCEPT a node whose content is not in the checkout at all. Bean
    // `najo` cut `queue` over to `cat/cat-harness/merge-queue`, so its
    // directory is a MOUNT POINT: present in a session that ran
    // `bun run cat state:mount`, absent in a fresh clone, and neither is a defect.
    // Asserting presence there is the inverse of the error this test is for —
    // it would demand a second copy of a graph that lives on a branch, which
    // is the state `check:declared-dirs` reports as `not-cut-over`. That gate
    // owns the off-checkout cases (unmounted, unmountable); this one keeps the
    // original assertion for every node that really is here.
    const decl = join(repoRootFor(ROOT), "beans", BEAN_GRAPH_FILE);
    const g = parseBeanGraph(JSON.parse(readFileSync(decl, "utf8")));
    const inCheckout = g.directories.filter((d) => !contentIsOffCheckout(d));
    // The filter must not silently empty the list: `beans.json` has four such
    // nodes and a day where it has none would make this test vacuous.
    expect(inCheckout.length).toBeGreaterThan(1);
    for (const d of inCheckout) {
      const dir = join(repoRootFor(ROOT), "beans", d.path);
      expect({ node: d.id, there: existsSync(dir) }).toEqual({ node: d.id, there: true });
    }
    // The complement, so the filter above is a stated rule rather than a hole:
    // every node it excludes must declare where its content is, as a branch.
    // Kept in this test rather than its own so a standalone run of the layer
    // (which has no `beans/`) fails no test the baseline does not list.
    for (const d of g.directories.filter((d) => contentIsOffCheckout(d))) {
      const src = resolveSubgraphSource(d as Parameters<typeof resolveSubgraphSource>[0]);
      expect({ node: d.id, kind: src.kind }).toEqual({ node: d.id, kind: "branch" });
    }
  });
});

describe("the published process hierarchy", () => {
  const INDEX = join(ROOT, siteDirFor(ROOT), "assets/todos/index.json");
  // The index is built at publish (cat-harness declares it `because: state`),
  // so a checkout has it only after `docs:pages` has run. These tests used to
  // pass only when another test file had already run the generator, so a
  // change in file order failed them (cat-harness-tools#411). Write it here
  // when it is missing, the way `gen-docs-pages-orphan-qa-checkout` does.
  // A generator that cannot run here (a standalone layer has no checkout to
  // publish) is not a failure of its own: the tests below then fail on the
  // missing index under their own names, as they always did.
  // The generator also re-renders every layer's committed pages and
  // witnesses, so it runs over a scratch copy of the checkout and only the
  // projections it builds at publish are copied back (bean `cat-tools-sm8r`).
  beforeAll(() => {
    if (!existsSync(overlayPath(INDEX))) buildDocsProjections(repoRootFor(ROOT));
  }, 180_000);
  const index = () =>
    JSON.parse(
      readFileSync(overlayPath(INDEX), "utf8"),
    ) as { processes: Record<string, string[]>; items: Array<{ tags: { processes: string[] } }> };

  test("no PHANTOM edge — the real parser is the oracle for the generator's regex", () => {
    // The reverse of the test above, and it was failing silently.
    // `processHierarchy()` matched `/calledElement="([^"]+)"/g` over the WHOLE
    // XML, so `upstream-version-adoption.bpmn` — which documents itself with
    // *"Callers invoke it with `calledElement="Process_UpstreamAdoption"`"* —
    // published `Process_UpstreamAdoption → itself`. A self-call that
    // `loadProcessModel` REFUSES outright: "A process cannot contain itself",
    // because an interpreter entering A → A settles forever. The published
    // hierarchy asserted an edge the engine rejects.
    //
    // The test above pins edges that must be PRESENT, so it could never have
    // caught this: a phantom edge is an addition, and every assertion there is
    // a `toContain`. Naming the one known phantom would pin the past — the
    // generator reads a regex and the next diagram to describe its own id in
    // prose would mint a new one. So the oracle is `loadProcessModel`, the
    // real parser: it is async and pulls in bpmn-moddle, which is exactly why
    // the GENERATOR does not use it and why a test can.
    const expected: Record<string, string[]> = {};
    for (const { id, calls } of CORPUS) expected[id] = calls;
    const published = index().processes;
    // Compared as whole objects rather than key by key: a diff naming the
    // process and both edge lists is what makes a failure here readable, and
    // the direction (phantom vs missing) is then obvious from the diff itself.
    expect(published).toEqual(expected);
  });

  test("the key order is the diagrams' sorted FILENAMES, not the directory's own order", () => {
    // Reproducibility, and it is not theoretical. `processHierarchy` builds
    // this object by walking `processes/`, and `readdirSync` under Bun
    // returns RAW directory order — on ext4, a hash of each filename against
    // the directory's own seed. `JSON.stringify` preserves insertion order, so
    // the published index came out byte-different on every checkout, and
    // `gen-docs-pages.ts --check` called a file stale that nobody had touched.
    //
    // It went unseen because that `--check` was a folded YAML continuation
    // line and had never run (bean `d2kp`); it failed on its FIRST run, on the
    // PR that un-folded it. Asserting the ORDER rather than merely the set is
    // the point — a set assertion passes under either enumeration.
    // EVERY declared knowledge-graph root, via the same helper the generator
    // uses — not the literal `processes`.
    //
    // This hardcoded that path and broke the moment a second root existed:
    // `bootstrap/processes/bootstrap.bpmn` is in the published hierarchy and
    // was not in this expectation, so the test called the GENERATOR wrong for
    // correctly reading the declaration. A test that pins an order must derive
    // it from the same source as the thing it pins, or it pins the past.
    //
    // Note `check:declared-paths` cannot catch this: it skips `*.test.ts`.
    // That exemption is worth revisiting — this is the second hardcoded path
    // in a test to break today.
    //
    // Ids come from `loadProcessModel`, NOT from a copy of the generator's
    // regex. Replicating it made this test agree with the generator's blind
    // spot: `/<bpmn:process id="…"/` misses `translation-workflow.bpmn`, which
    // binds the BPMN namespace as its default and writes a bare `<process>`,
    // so `Process_Translation` was missing from BOTH sides and the assertion
    // passed over a hole. Deriving from the same SOURCE is the rule; deriving
    // from the same IMPLEMENTATION is how a test blesses a bug.
    const expected: string[] = CORPUS.map((d) => d.id);
    expect(expected.length).toBeGreaterThan(5);
    expect(Object.keys(index().processes)).toEqual(expected);
  });
});

describe("reading", () => {
  test("there are todos to read — otherwise this proves nothing", () => {
    expect(readTodos().length).toBeGreaterThan(0);
  });

  test("every todo validates; a malformed one throws rather than being skipped", () => {
    // `readTodos` throws, so reaching here is the assertion. A malformed todo
    // is a person's outstanding item no consumer will ever show them, and a
    // clean run over it is worse than a failure.
    for (const t of readTodos()) expect(t.$schema).toBe("todo/1.0.0");
  });

  test("ids are unique", () => {
    const ids = readTodos().map((t) => t.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  test("an identity is provider-qualified, and survives the front matter", () => {
    // `- github:litlfred` is a SCALAR, not a mapping — YAML needs colon-space
    // for a mapping. Before the parser enforced that, every identity parsed as
    // `{github: "litlfred"}` and vanished: both seeded todos read "unassigned"
    // while their front matter plainly named someone.
    const withIdentity = readTodos().filter((t) => t.tags.identities.length > 0);
    expect(withIdentity.length).toBeGreaterThan(0);
    for (const t of withIdentity) {
      for (const i of t.tags.identities) {
        expect({ id: t.id, provider: i.provider }).toEqual({ id: t.id, provider: "github" });
        expect(i.id.length).toBeGreaterThan(0);
      }
    }
  });

  test("a `- kind: x` list DOES parse as a mapping", () => {
    // The other half of the colon-space rule: requiring it must not break the
    // real mappings. A reference or artefact silently dropping to a string
    // would be the same disappearance in the other direction.
    const refs = readTodos().flatMap((t) => [...t.tags.references, ...t.tags.artefacts]);
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) {
      expect(r.kind.length).toBeGreaterThan(0);
      expect(r.id.length).toBeGreaterThan(0);
    }
  });
});
