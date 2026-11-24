/**
 * The conformance check has to FAIL on each thing it claims to catch.
 *
 * Bean `z4mq` item 3. Written against temp layers rather than only this
 * repository, because the repository currently passes — and a test that only
 * asserts "the repo renders" would go on passing if the check were gutted to
 * `return { verdict: "rendered" }`. Each case below perturbs one thing.
 *
 * @module scripts/tests/instance-render.test
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { declaredKinds, formatReport, instancesIn, renderInstance } from "../../check-instance-render.ts";
import { repoRootFor, declarationPathIn, readDeclaration } from "../../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A throwaway layer. `decl === null` writes no declaration at all. */
function instance(decl: unknown | null, files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "render-"));
  made.push(root);
  if (decl !== null) writeDeclaration(root, JSON.stringify(decl));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}

describe("could not determine is a THIRD state, never a pass", () => {
  test("no declaration is undetermined, not failed and not rendered", () => {
    // The distinction that matters: a layer nobody declared has not been
    // shown to render badly, it has not been shown at all. Calling it `failed`
    // would be as wrong as calling it `rendered` — one invents a defect, the
    // other invents a clean run.
    return renderInstance(instance(null)).then((r) => {
      expect(r.verdict).toBe("undetermined");
      expect(r.reasons.join(" ")).toContain("nothing declares what this instance is");
    });
  });

  test("a declaration that will not parse is undetermined too", async () => {
    const root = mkdtempSync(join(tmpdir(), "render-bad-"));
    made.push(root);
    writeDeclaration(root, "{ not json", "broken");
    const r = await renderInstance(root);
    expect(r.verdict).toBe("undetermined");
    expect(r.nodeCount).toBe(0);
  });

  test("undetermined carries NO published kinds — it never looked", async () => {
    // Guard against the shape where an unreadable layer still reports an
    // empty `published` that a consumer reads as "publishes nothing".
    const r = await renderInstance(instance(null));
    expect(r.published).toEqual([]);
    expect(r.declared).toEqual([]);
  });
});

describe("an empty render is a failure, not an empty success", () => {
  test("zero nodes fails, and says why in those words", async () => {
    // THE DEFECT THIS WHOLE MODULE EXISTS FOR. `collectSkills` resolved
    // bootstrap's declared directory against the wrong root, found nothing,
    // and continued — the export succeeded and the graph silently lost every
    // skill. "Did it throw" cannot see that; a node count can.
    //
    // The fixture DECLARES a directory and renders nothing from it (its kind,
    // `fsh-guts`, is unpublished, so not even the directory's node is
    // emitted): the defect's shape. It declared `directories: []` until the
    // owner ruled a layer declaring no directories acceptable (C1,
    // 2026-10-15), which is the case below.
    const r = await renderInstance(instance({ name: "empty", directories: [{ id: "guts", path: "fsh-guts/", graphTypologies: ["fsh-guts"] }] }, { "fsh-guts/.keep": "" }));
    expect(r.verdict).toBe("failed");
    expect(r.nodeCount).toBe(0);
    expect(r.noDirectories).toBeUndefined();
    expect(r.reasons.join(" ")).toContain("empty graph is a failure");
  });
});

describe("an instance that declares no directories is accepted, and reported (C1)", () => {
  test("`directories: []` renders nothing of its own and is rendered, flagged noDirectories", async () => {
    // Owner, 2026-10-15: smart-immunizations declares `directories: []` (the
    // index mounts none of its directories, B1). Empty by declaration is not
    // a directory that resolved to nothing.
    const r = await renderInstance(instance({ name: "bare", directories: [] }));
    expect(r.verdict).toBe("rendered");
    expect(r.nodeCount).toBe(0);
    expect(r.noDirectories).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  test("leaving `directories` out is not declaring none: it still fails when it renders nothing", async () => {
    const r = await renderInstance(instance({ name: "unsaid" }));
    expect(r.verdict).toBe("failed");
    expect(r.noDirectories).toBeUndefined();
    expect(r.reasons.join(" ")).toContain("empty graph is a failure");
  });

  test("the report says so, in the instance's line and in the summary", async () => {
    const r = await renderInstance(instance({ name: "bare", directories: [] }));
    const text = formatReport([r]);
    expect(text).toContain("declares no directories");
    expect(text).toMatch(/1 rendered \(1 declare no directories: render-\w+\), 0 failed/);
  });
});

describe("declared means TRANSITIVELY declared", () => {
  test("a nested graph file's kinds count as the instance's", () => {
    // `beans/beans.json` declares `bean-defs` and `workflow-state`; reading
    // only `harness.json` reports them as kinds the layer smuggled in.
    // Measured before this was written: that mistake gives cat-harness five
    // undeclared kinds where the true figure is one.
    const root = instance(
      { name: "n", directories: [{ id: "beans", path: "beans/", graphTypologies: ["beans"] }] },
      {
        "beans/beans.json": JSON.stringify({
          name: "beans",
          directories: [
            { id: "defs", path: "defs", graphTypologies: ["bean-defs"] },
            { id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] },
          ],
        }),
      },
    );
    const kinds = declaredKinds(root, JSON.parse(readFileSync(declarationPathIn(root)!, "utf-8")));
    expect([...kinds].sort()).toEqual(["bean-defs", "beans", "workflow-state"]);
  });

  test("`kinds` is read as well as `graphs` — the bean graph uses both spellings", () => {
    const root = instance(
      { name: "n", directories: [{ id: "beans", path: "beans/", graphTypologies: ["beans"] }] },
      {
        "beans/beans.json": JSON.stringify({
          name: "beans",
          directories: [{ id: "defs", path: "defs", kinds: ["bean-defs"] }],
        }),
      },
    );
    const kinds = declaredKinds(root, JSON.parse(readFileSync(declarationPathIn(root)!, "utf-8")));
    expect([...kinds]).toContain("bean-defs");
  });

  test("an unparseable nested file does not manufacture an undeclared kind", () => {
    // Understating `declared` would invent a finding. That file's problem is
    // `check:harness-dirs`'s to report, and it does so loudly.
    const root = instance(
      { name: "n", directories: [{ id: "beans", path: "beans/", graphTypologies: ["beans"] }] },
      { "beans/beans.json": "{ not json" },
    );
    const kinds = declaredKinds(root, JSON.parse(readFileSync(declarationPathIn(root)!, "utf-8")));
    expect([...kinds]).toEqual(["beans"]);
  });
});

/**
 * Every layer in this repository, rendered ONCE at module scope.
 *
 * The same remedy bean `sff8` settled on for `tools.test.ts`: module scope
 * belongs to no test's timeout, while a raised budget decays as the corpus
 * grows. "every instance renders" rendered all of them inside one test and
 * timed out at 5073 ms of 5000 on CI (#2139) — the cost grows with every
 * layer added, which is a rate, not a flake. `renderInstance` only READS
 * (it collects nodes into memory and writes nothing), and nothing below
 * mutates the repository, so one render per layer gives every test the
 * answer it would have computed itself.
 */
const OWN_REPO = repoRootFor(resolve(import.meta.dir, "../../.."));
const OWN_RENDERS = new Map<string, Awaited<ReturnType<typeof renderInstance>>>();
for (const root of instancesIn(OWN_REPO)) OWN_RENDERS.set(root, await renderInstance(root));
const ownRender = (root: string) => OWN_RENDERS.get(root)!;

describe("this repository's own instances", () => {
  const REPO = OWN_REPO;

  test("every instance is found — otherwise everything below is vacuous", () => {
    // This asserted exactly `["cat-harness", "bootstrap"]`, and it PASSED for
    // the whole period that list was wrong: `instancesIn` returned a literal
    // and this test pinned the same literal, so the two agreed with each other
    // and neither looked at the repository. `folio-assist-core` and the root
    // were layers the gate never rendered (bean `6tkl`).
    //
    // The order is root-first then sorted, which is what `layerRootsIn`
    // promises so that a report is stable.
    //
    // Updated 2026-09-20 when it fired as designed: seven layers arrived on
    // one branch and `folio-assist-core` became `folio-assistant-core`. This
    // list is the new truth, and it is the SECOND place that truth is written
    // — `schemas/cat-harness.test.ts` holds the other. Two copies is a real
    // cost and it is taken deliberately: they assert different things (that
    // discovery finds them, and that each one RENDERS), and deriving either
    // from `layerRootsIn` would make the test agree with the function by
    // construction, which is exactly how the `["cat-harness", "bootstrap"]`
    // literal passed for the whole period it was wrong.
    // The root by its DECLARED name (bean `t5dm`): its last path segment is
    // the clone's folder, which a worktree names anything. Every other
    // layer is a path inside the repository and the same in every clone.
    const found = instancesIn(REPO).map((p) => (resolve(p) === resolve(REPO) ? readDeclaration(p)?.name : p.split("/").pop()));
    expect(found).toEqual([
      // `folio-assistant`, the ROOT, led this list until the owner removed its
      // declaration (3d4caf6, 2026-10-08: "should not need folio-assistant
      // declared at all"). The checkout root is an index now and declares no
      // layer, so discovery finds none there. It fired as designed.
      "bootstrap",
      // Added 2026-09-30 when it fired as designed: bootstrap's tools were
      // re-created as the sibling layer `bootstrap-tools/` (bean `xsqm`),
      // which declares `bootstrap-tools.json` and is therefore a layer.
      "bootstrap-tools",
      "cat-harness",
      // Added 2026-10-01 with bean `w2gr` (step 3a): the tool IMPLEMENTATION
      // layer, holding the MCP server while cat-harness keeps the Tool
      // definitions -- the bootstrap / bootstrap-tools split, on the owner's
      // option-A ruling. It sorts after `cat-harness` ("cat-harness" <
      // "cat-harness-tools").
      "cat-harness-tools",
      // `cat-openapi` (bean `s4ta`) folded into cat-harness as the `openapi`
      // subgraph, owner 2026-10-07.
      // Alphabetical, and the ORDER moved with the rename: `folio-assist-sci`
      // sorted BEFORE `folio-assistant-core` ("assist-" < "assista"), and
      // `folio-assistant-sci` sorts after it. The list is the assertion, so
      // the swap is the visible half of the rename.
      // Added 2026-09-22 with the owner's stack ruling
      // (`core->fhir-harness->smart-base->siblings{smart-l1, smart-dak,
      // smart-ig}`, issue #963). It is the BASE the note above is about: the
      // bare FHIR IG pipeline, with no WHO, DAK or SMART assumption, which is
      // what `nsbb` had been asking for since 2026-09-21. It sorts here rather
      // than beside the `smart-*` entries because it is deliberately NOT one
      // of them -- the WHO package may reference this layer and this layer may
      // never reference the WHO package.
      "fhir-harness",
      "folio-assistant-core",
      "folio-assistant-sci",
      // Added 2026-09-21 with the FHIR IG artefact-index ingest (issue #689).
      // It fired as designed, which is what this list is for: `smart-trust/`
      // declares a `harness.json` and is therefore a layer, sorting
      // between `large-datasets` and `who-iris`. A directory with no
      // `harness.json` is not a layer and is correctly absent — `smart-kg/`
      // was the example until it was removed (bean `wg7r`).
      // Added 2026-09-21 with the second ingested IG (bean qrnz). PROVISIONAL:
      // the owner has since ruled that a per-IG harness should not exist at all
      // (bean nsbb), so this entry and `smart-trust` below are both expected to
      // collapse into a `smart-base` layer. It is listed because it EXISTS
      // today, which is the only thing this assertion is about.
      // Added 2026-09-22 (issue #877) -- `smart-base`, the layer `nsbb`
      // called for. Listed here as well as in `schemas/cat-harness.test.ts`
      // because the two assert different things: that discovery FINDS it,
      // and that it RENDERS. The duplication is the deliberate cost noted
      // above.
      "smart-base",
      // `smart-ig` was the one sibling left of the owner's 2026-09-22 stack
      // ruling (issue #975) until the owner retired it too (cd8293f,
      // 2026-10-08). `smart-l1` and `smart-dak` went in stage D (#1767, owner
      // 2026-10-01): L1 and DAK are document KINDS inside smart-base.
      "smart-immunizations",
      "smart-trust",
      // Added 2026-10-31 when it fired as designed: folio-assistant#2761 mounted
      // `smart-trust-phw` (bean `nr5p`, PCF1) as a layer of the index.
      "smart-trust-phw",
      "who-iris",
      // `who-style-guide` was listed here until 2026-10-01, when the owner
      // folded it into who-iris as a subgraph (bean qsx4). It fired as designed.
    ]);
    // Named individually rather than only as a list: these two are the ones
    // the old literal omitted, so if a future edit narrows the set again, the
    // failure should say which layer stopped being checked.
    expect(found).toContain("folio-assistant-core");
    // The other was the ROOT, `folio-assistant`, whose declaration the owner
    // removed (3d4caf6, 2026-10-08). Pinned the other way now: discovery must
    // not find a layer at the checkout root, which holds an index.
    expect(found).not.toContain("folio-assistant");
    expect(instancesIn(REPO).map((p) => resolve(p))).not.toContain(resolve(REPO));
  });

  test("every instance renders, and none renders nothing unless it declares nothing", async () => {
    // A layer declaring `directories: []` (smart-immunizations here, owner
    // B1 and C1, 2026-10-15) renders zero nodes of its own BY DECLARATION and
    // is accepted, flagged; every other layer must render something.
    for (const root of instancesIn(REPO)) {
      const r = ownRender(root);
      expect({ [r.name]: r.verdict }).toEqual({ [r.name]: "rendered" });
      if (r.noDirectories) continue;
      expect({ [r.name]: r.nodeCount > 0 }).toEqual({ [r.name]: true });
    }
  });

  test("only an instance that declares no directories is let off rendering nothing", async () => {
    for (const root of instancesIn(REPO)) {
      const r = ownRender(root);
      if (!r.noDirectories) continue;
      expect(readDeclaration(root)?.directories).toEqual([]);
    }
  });

  test("bootstrap's OWN skills are in its render — the silent drop, pinned", async () => {
    // `confirm-harness` lives only in `bootstrap/skills/`. When `skillMdDirs`
    // resolved that repository-scoped directory against the layer root, the
    // skill vanished from the graph and `hasSkill` dangled. Nothing failed.
    const boot = instancesIn(REPO).find((p) => p.endsWith("bootstrap"))!;
    const r = ownRender(boot);
    expect(r.nodeCount).toBeGreaterThan(10);
  });

  test("an instance publishes only the kinds it declares — the count is now ZERO", async () => {
    // THIS TEST PREDICTED ITS OWN REPLACEMENT. It read, in #463:
    //
    //   "a check becomes an error once its count is zero. The count is 16
    //    because `collectGraphTypologies()` emits the global registry into every
    //    instance ... this test is what will fail, correctly, on the day
    //    somebody makes it fatal without clearing the count."
    //
    // Bean `3jj9` cleared the count: `collectGraphTypologies` now takes a root and
    // filters by `declaredKinds`, so bootstrap publishes the one kind it
    // declares instead of all 16. The finding is fatal from the same change,
    // which is the repository's standing rule applied rather than deferred.
    const boot = instancesIn(REPO).find((p) => p.endsWith("bootstrap"))!;
    const r = ownRender(boot);
    expect(r.verdict).toBe("rendered");
    expect(r.undeclared).toEqual([]);
    // `beans` was the named example of a kind bootstrap advertised and could
    // not reach. Keeping it named guards the specific regression.
    expect(r.undeclared).not.toContain("beans");
  });

  test("...and the guard is not vacuous — bootstrap really does publish kinds", async () => {
    // `undeclared: []` is satisfied trivially by publishing nothing at all,
    // which is the `dh4f` defect this whole check exists to refuse. So assert
    // the positive half too.
    const boot = instancesIn(REPO).find((p) => p.endsWith("bootstrap"))!;
    const r = ownRender(boot);
    expect(r.published.length).toBeGreaterThan(0);
    expect(r.declared.length).toBeGreaterThan(0);
    // Was `published > declared` — the 16-vs-1 gap, asserted as an inequality
    // so it would survive either number moving. The gap is closed, so the
    // relation that matters now is containment.
    for (const k of r.published) expect(r.declared).toContain(k);
  });
});
