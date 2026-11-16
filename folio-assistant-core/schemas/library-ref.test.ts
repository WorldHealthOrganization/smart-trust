/**
 * Cross-layer library references, against THIS checkout rather than fixtures.
 *
 * Fixtures would prove the code branches; this proves it resolves the real
 * layers, which is the claim that matters — bean `r1lz` predicted the defect
 * a year of fixtures would not have caught: *"a skill derived from a source
 * text in another repo would cite evidence its own instance cannot resolve."*
 */
import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { explainFailure, instanceRoots, libraryDirOf, libraryLeftOutByMount, resolveLibraryRef } from "./library-ref.js";
import { declarationPathIn } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../cat-harness-tools/test/support/instance-fixture.js";
import { libraryEntries } from "../scripts/lib/library-entries.ts";

const REPO = resolve(import.meta.dir, "../..");
const PLATFORM = resolve(REPO, "cat-harness");
/**
 * The layer that actually holds the WHO corpus, since bean `frs5`.
 *
 * Before the move `cat-harness` held it and every assertion below resolved
 * LOCALLY — the cross-layer path was exercised only by an unknown-instance
 * negative. That made this file's own opening claim ("this proves it resolves
 * the real instances") weaker than it read: the interesting case was the one
 * with no data behind it. Now the platform holds no library at all, so a
 * citation of a WHO document is a genuine cross-layer resolution, which is
 * exactly the situation bean `r1lz` predicted: *"a skill derived from a source
 * text in another repo would cite evidence its own instance cannot resolve."*
 */
const WHO_IRIS = resolve(REPO, "who-iris");

describe("instance discovery", () => {
  it("findsInstancesByDeclaredName", () => {
    const roots = instanceRoots(REPO);
    // This used to read "not by DIRECTORY name", witnessed by a declared
    // `folio-assist-core` in a directory called `folio-assistant-core`. After
    // the owner's 2026-09-20 ruling — `cat-harness`, `folio-assistant-core`
    // and `folio-assistant` are distinct layers — every name agrees with
    // its directory, so that witness is gone and a test asserting it would be
    // asserting a coincidence.
    //
    // The distinction that IS still live is name vs STUB. `cat-harness`
    // declares `stub: "folio-assistant"` — the stub names the published
    // artefact (`docs/folio-assistant/`, `_kg/folio-assistant.jsonld`) while
    // the name names the layer. A consumer reaching for a layer by its
    // stub gets the REPOSITORY, which is a different layer entirely.
    expect(roots.get("cat-harness")).toBe(PLATFORM);
    expect(roots.get("folio-assistant")).not.toBe(PLATFORM);
    expect(roots.has("folio-assistant-core")).toBe(true);
    expect(roots.get("folio-assistant-core")).toBe(resolve(REPO, "folio-assistant-core"));
  });

  it("findsPlatformInstance", () => {
    expect(instanceRoots(REPO).get("cat-harness")).toBe(PLATFORM);
  });

  it("indexRootIsNoInstance", () => {
    // Restated after the repository split. This read "the REPOSITORY is its
    // own instance": the root declared `folio-assistant` (owner 2026-09-20),
    // and the check was that it did not collide with the harness layer —
    // for a few hours both declared the name, `instanceRoots` is keyed on it,
    // the root won, and the harness layer became unreachable by name,
    // silently. The separation removed the root's declaration
    // (folio-assistant@3d4caf6e0f, "remove root toolchain and folio-assistant
    // declaration"): the root is now an INDEX that mounts layers from
    // `index.lock.json` and is not one itself. So the collision this guarded
    // can no longer arise from the root, and the live rule is the converse —
    // no name resolves to the index root, and the harness layer still
    // resolves to its own directory rather than to the checkout.
    const roots = instanceRoots(REPO);
    expect(roots.has("folio-assistant")).toBe(false);
    expect([...roots.values()]).not.toContain(REPO);
    expect(roots.get("cat-harness")).toBe(PLATFORM);
  });
});

describe("library location is read from the declaration", () => {
  it("resolvesDeclaredLibrary", () => {
    expect(libraryDirOf(WHO_IRIS)).toBe(resolve(WHO_IRIS, "library"));
  });

  it("platformLibraryOnlyCitedSources", () => {
    // `cat-harness` held 1,431 files of somebody else's writing until bean
    // `frs5`. AGENTS.md states the rule — "folio-assistant is the platform,
    // not the content" — and until that move nothing checked it.
    //
    // This asserted `toBeUndefined()` for a few hours (`frs5` removed the
    // declaration with the content), then `toEqual([])` on the owner's
    // 2026-09-20 ruling, which kept the declaration so a DEPENDENT folio
    // inherits the convention (`wwi6`).
    //
    // IT IS NOW NARROWED RATHER THAN DROPPED, on the owner's ruling of
    // 2026-09-22: *"they should be under <stub>/library and appear in the
    // library visualizer for the harness. dont bury sub-graph assets."*
    // Methodology source literature is the harness's OWN grounding material,
    // not a folio's subject matter — the same relation `agent-skills/library/`
    // has to the agent-skills subgraph — so an empty-directory assertion would
    // now forbid the thing the owner asked for.
    //
    // The teeth are kept by inverting the question. Instead of "is it empty",
    // this asks "is every entry here cited by a methodology node" — which
    // still fails the moment folio content appears, and fails for a reason
    // that names the offending entry. An emptiness check could only ever say
    // "something is here".
    const dir = libraryDirOf(PLATFORM);
    expect(dir).toBeDefined();

    // DIRECTORIES, not every name in the directory. A library ENTRY is
    // `library/<bib-slug>/` — that is what a `libraryRef` resolves against and
    // what `check:l1-complete` walks. A library also holds root-level sidecars
    // that judge those entries rather than being one: `image-verdicts.json`,
    // which `apply-image-verdicts` reads keyed by doc id.
    //
    // This read every name until 2026-09-23, and passed throughout, because
    // `cat-harness/library/` was the one library with no verdict file — every
    // other one has had one since bean `frs5` split them. So the first
    // inspection filed here reported the sidecar as an uncited entry, which is
    // a false finding in the direction that looks like a violation. The `1xhc`
    // shape: the path nothing had walked.
    //
    // NOT a weakening. Folio content arriving in this library still arrives as
    // an entry directory, which is exactly what is still counted.
    // Flat or filed in a declared concern group (bean 6fez): a group folder
    // is not an entry, the entries filed in it are.
    const entries = libraryEntries(dir!).map((e) => e.slug);

    type LibraryEntryDecl = { path?: string; graphTypologies?: string[]; heldEntries?: string[]; awaitingCitation?: string[] };
    const decl = JSON.parse(readFileSync(declarationPathIn(PLATFORM)!, "utf8")) as { directories?: LibraryEntryDecl[] };
    // Sub-graph entries (`library/graph.json` since cat-harness#1032;
    // `research/graph.json` since cat-harness#1181) are declared FROM WITHIN
    // their sub-graph, with paths relative to the sub-graph directory.
    const nested = (decl.directories ?? []).flatMap((d) => {
      const f = d.path ? join(PLATFORM, d.path, "graph.json") : undefined;
      if (!f || !existsSync(f)) return [];
      const subs = (JSON.parse(readFileSync(f, "utf8")) as { directories?: LibraryEntryDecl[] }).directories ?? [];
      return subs.map((s) => ({ ...s, path: s.path ? join(d.path!, s.path) : d.path }));
    });
    const allDirs = [...(decl.directories ?? []), ...nested];

    // `evidence:` lines across the methodology graph (including opt-in
    // sub-graphs such as `research/methodologies/`), as bib-slugs.
    const methodologyDirs = allDirs
      .filter((d) => d.graphTypologies?.includes("methodology") && d.path)
      .map((d) => resolve(PLATFORM, d.path!))
      .filter((p) => existsSync(p));
    const cited = new Set<string>();
    for (const methodologies of methodologyDirs) {
      for (const f of readdirSync(methodologies).filter((f) => f.endsWith(".md"))) {
        const text = readFileSync(join(methodologies, f), "utf8");
        // BOTH SPELLINGS OF THE FIELD'S LAYOUT, not both shapes of the field.
        // `evidence` is an array in the schema; YAML writes a one-element array
        // inline (`evidence: [library/x]`) or as a block list, and `swot` uses
        // the block form. Matching only `evidence: library/x` read the block
        // form as ZERO citations, which failed this test by declaring a real
        // source uncited — a false finding, and in the direction that looks like
        // a violation.
        for (const m of text.matchAll(/^\s*(?:evidence:\s*)?-?\s*library\/(\S+?)\s*$/gm)) {
          cited.add(m[1]!);
        }
      }
    }

    // THE AGENT-SKILL CORPUS, admitted by the owner's ruling of 2026-10-01
    // (agent-skills dissolves into cat-harness; bean `j7ql`): literature
    // ABOUT the harness's own subject, read into the voices in
    // `skills/voices/`. Admitted by NAME, from the declaration's own
    // `heldEntries` list on the library entry — the owner's hold on those
    // documents — never by a pattern, so folio content arriving here still
    // fails, by name, exactly as before.
    //
    // And SOURCES AWAITING CITATION (bean `e0jh`): a source the owner asked to
    // ingest ahead of the methodology text that will cite it, listed by name
    // in `awaitingCitation`. Same rule — by name, never by pattern — but the
    // entry's summaries are not held back, which is why it is not folded into
    // `heldEntries`. Once a methodology cites it, it leaves the list.
    const admitted = new Set(
      allDirs
        .filter((d) => d.graphTypologies?.includes("library"))
        .flatMap((d) => [...(d.heldEntries ?? []), ...(d.awaitingCitation ?? [])]),
    );

    const uncited = entries.filter((e) => !cited.has(e) && !admitted.has(e));
    expect(uncited).toEqual([]);
  });

  it("noLibraryGraphUndefined", () => {
    // NOT the same as an empty directory, and not an error: `kg-navigation`
    // legitimately holds no corpus.
    expect(libraryDirOf(resolve(REPO, "kg-navigation"))).toBeUndefined();
  });
});

describe("resolution keeps four failures apart", () => {
  const local = { libraryId: "wpr-rdo-2020-003-eng", sectionId: "page-012" };

  it("resolvesBareAgainstCitingInstance", () => {
    const r = resolveLibraryRef(local, WHO_IRIS, REPO);
    expect(r.ok).toBe(true);
  });

  it("namedInstanceSameAsBare", () => {
    // The two forms must agree, or adding `instance` to an existing citation
    // would change what it means.
    const bare = resolveLibraryRef(local, WHO_IRIS, REPO);
    const named = resolveLibraryRef({ ...local, instance: "who-iris" }, WHO_IRIS, REPO);
    expect(named.ok).toBe(true);
    if (bare.ok && named.ok) expect(named.path).toBe(bare.path);
  });

  it("platformMustNameWhoIris", () => {
    // The case bean `r1lz` predicted, now real rather than hypothetical. A
    // bare citation from the platform cannot work any more (it declares no
    // library), and the named one crosses the layer boundary and lands.
    const named = resolveLibraryRef({ ...local, instance: "who-iris" }, PLATFORM, REPO);
    expect(named.ok).toBe(true);
    if (named.ok) expect(named.path).toContain("who-iris/library/wpr-rdo-2020-003-eng");
  });

  it("unknownInstanceNotLocal", () => {
    // The failure this rule exists for: falling back would turn "you cited
    // another repository and it is not here" into "that section is missing",
    // sending the reader to entirely the wrong place.
    const r = resolveLibraryRef({ ...local, instance: "no-such-instance" }, PLATFORM, REPO);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.kind).toBe("unknown-instance");
      expect(explainFailure(r.failure)).toContain("DECLARED NAME");
    }
  });

  it("noLibraryGraphFinding", () => {
    // `bootstrap` is declared and legitimately holds no corpus — distinct
    // from a missing section, and distinct from an unknown layer. It is the
    // zero-install floor, so it will never hold one. (This named
    // `kg-navigation` until bean `byql` folded that layer into cat-harness,
    // which made it an UNKNOWN layer and flipped the assertion.)
    //
    // This named `who-iris` until bean `frs5`, when who-iris gained the
    // library it had been deliberately withholding. Moving the assertion to a
    // layer that will never hold one is the point: an assertion that only
    // holds until somebody does the obvious next thing is not testing the
    // distinction, it is testing the schedule.
    const r = resolveLibraryRef({ ...local, instance: "bootstrap" }, PLATFORM, REPO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.kind).toBe("no-library-graph");
  });

  it("bareFromPlatformNotIngested", () => {
    // The two answers are a sentence apart and send a reader to different
    // places: "this layer has no corpus, name the one that does" versus
    // "that document was never ingested".
    //
    // Between `frs5` and the owner's ruling the platform declared no library,
    // so a bare citation got the FIRST and more useful answer. Re-declaring
    // the (empty) library to preserve `wwi6`'s inheritance guarantee replaced
    // it with the second: the graph is there, the document is not, so the
    // resolver correctly reports `not-ingested` — and sends the reader looking
    // for an ingestion that was never going to happen here, instead of telling
    // them to name `who-iris`.
    //
    // Asserted rather than lamented: this is a real cost of declaring a
    // directory a layer does not fill, it is the `dh4f` shape doing
    // exactly what that bean says it does, and the core relocation is what
    // ends it. Pinning it here means the day it changes back, this says so.
    const r = resolveLibraryRef(local, PLATFORM, REPO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.kind).toBe("not-ingested");
  });

  it("neverIngestedDistinct", () => {
    const r = resolveLibraryRef({ libraryId: "never-ingested" }, WHO_IRIS, REPO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.kind).toBe("not-ingested");
  });

  it("missingSectionFourthCase", () => {
    const r = resolveLibraryRef({ libraryId: "wpr-rdo-2020-003-eng", sectionId: "page-999" }, WHO_IRIS, REPO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.kind).toBe("no-such-section");
  });

  it("everyFailureExplainsItself", () => {
    for (const ref of [
      { ...local, instance: "nope" },
      { ...local, instance: "kg-navigation" },
      { libraryId: "never-ingested" },
      { libraryId: "wpr-rdo-2020-003-eng", sectionId: "page-999" },
    ]) {
      const r = resolveLibraryRef(ref, WHO_IRIS, REPO);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(explainFailure(r.failure).length).toBeGreaterThan(40);
    }
  });
});

describe("an instance's library is ITS OWN, not the first one declared", () => {
  // Found by review 2026-09-20. `libraryDirOf` used `dirs.find(...)` over
  // every entry declaring a `library` graph, and `cat-harness/harness.json`
  // declares FOUR — its own, plus `who-iris/`, `folio-assistant-sci/` and
  // `agent-skills/`, all three `scope: "repository"` because the consumers
  // that scan libraries run from the repository root.
  //
  // It happened to be right today only because cat-harness's own entry is
  // declared first. Reorder the file and `libraryDirOf("cat-harness")` starts
  // returning `cat-harness/who-iris/library` — a path that does not exist —
  // so a citation to an INGESTED who-iris document reports "never brought
  // through uploads/ -> library/". A correct answer resting on key order is
  // not a correct answer.
  function instance(dirs: unknown[]): string {
    const root = mkdtempSync(join(tmpdir(), "libdir-"));
    mkdirSync(join(root, "library"), { recursive: true });
    mkdirSync(join(root, "elsewhere", "library"), { recursive: true });
    writeDeclaration(root, JSON.stringify({ name: "x", directories: dirs }));
    return root;
  }

  it("ignoresRepositoryScopedFirst", () => {
    const root = instance([
      { id: "other", path: "elsewhere/library/", scope: "repository", graphTypologies: ["library"] },
      { id: "library", path: "library/", graphTypologies: ["library"] },
    ]);
    expect(libraryDirOf(root)).toBe(resolve(root, "library"));
    rmSync(root, { recursive: true, force: true });
  });

  it("orderDoesNotMatter", () => {
    // The whole point: the same declaration, written the other way round.
    const root = instance([
      { id: "library", path: "library/", graphTypologies: ["library"] },
      { id: "other", path: "elsewhere/library/", scope: "repository", graphTypologies: ["library"] },
    ]);
    expect(libraryDirOf(root)).toBe(resolve(root, "library"));
    rmSync(root, { recursive: true, force: true });
  });

  it("refusesTwoOwnLibraries", () => {
    // `undefined` would say "this layer declares no library", which is a
    // different and wrong fact. Two libraries of one's own has no answer to
    // "where does this instance keep its corpus".
    const root = instance([
      { id: "a", path: "library/", graphTypologies: ["library"] },
      { id: "b", path: "elsewhere/library/", graphTypologies: ["library"] },
    ]);
    expect(() => libraryDirOf(root)).toThrow(/no single answer/);
    rmSync(root, { recursive: true, force: true });
  });

  it("realInstancesResolveOwn", () => {
    // Over the real repository, so a future declaration that breaks it says so.
    // cat-harness keeps its corpus inside its `library` sub-graph since
    // cat-harness#1032, switched on for itself.
    const own: Record<string, string> = { "cat-harness": "library/corpus", "who-iris": "library", "folio-assistant-sci": "library" };
    for (const [inst, path] of Object.entries(own)) {
      expect({ inst, dir: libraryDirOf(resolve(REPO, inst)) })
        .toEqual({ inst, dir: resolve(REPO, inst, path) });
    }
    // Declares no corpus — a determined "none", not a failure. This was
    // `who-style-guide` (voices, no corpus) until it became a subgraph of
    // who-iris (bean qsx4); `smart-l1` declares no library either.
    expect(libraryDirOf(resolve(REPO, "smart-l1"))).toBeUndefined();
  });
});

describe("an entry filed in a concern group resolves (bean 6fez)", () => {
  // Measured 2026-11-02: cat-harness filed its library into groups,
  // `library/<group>/<id>/`, and check:voices reported every one of its
  // sources "not ingested", because only `library/<id>/` was looked at.
  it("groupedEntryResolves", () => {
    const root = mkdtempSync(join(tmpdir(), "grouped-ref-"));
    try {
      mkdirSync(join(root, "library", "kg", "doc", "sections"), { recursive: true });
      mkdirSync(join(root, "library", "stray", "other"), { recursive: true });
      writeFileSync(join(root, "library", "kg", "doc", "structure.json"), "{}");
      writeFileSync(join(root, "library", "kg", "doc", "sections", "sec-001.md"), "x\n");
      writeFileSync(join(root, "library", "stray", "other", "structure.json"), "{}");
      writeFileSync(join(root, "library", "library.json"), JSON.stringify({ $schema: "concern-groups/v1", groups: ["kg"] }));
      writeDeclaration(root, JSON.stringify({ name: "x", directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }] }));

      const doc = resolveLibraryRef({ libraryId: "doc" }, root, root);
      expect(doc.ok).toBe(true);
      if (doc.ok) expect(doc.path).toBe(join(resolve(root, "library"), "kg", "doc", "structure.json"));
      const sec = resolveLibraryRef({ libraryId: "doc", sectionId: "sec-001" }, root, root);
      expect(sec.ok).toBe(true);
      // A folder the library does not declare as a group is not searched.
      const stray = resolveLibraryRef({ libraryId: "other" }, root, root);
      expect(stray.ok).toBe(false);
      if (!stray.ok) expect(stray.failure.kind).toBe("not-ingested");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("a corpus in an opt-in group the mount left out is not checked here", () => {
  // smart-ra mounts cat-harness without `library/corpus/` (`cat-harness.library`
  // is opt-in, and the lock lists it under `except`), yet cat-harness switches
  // the group on for itself. Its always-on voices cite that corpus, and
  // check:voices reported each citation as "declares no `library` graph": a
  // wrong fact about a group the mount deliberately did not take.
  function optInLayer(withCorpus: boolean, switchedOn = true): string {
    const root = mkdtempSync(join(tmpdir(), "libopt-"));
    mkdirSync(join(root, "library"), { recursive: true });
    if (withCorpus) mkdirSync(join(root, "library", "corpus"), { recursive: true });
    writeFileSync(
      join(root, "library", "graph.json"),
      JSON.stringify({
        name: "library",
        directories: [{ id: "library", path: "corpus/", subgraph: true, optIn: true, graphTypologies: ["library"] }],
      }),
    );
    writeDeclaration(
      root,
      JSON.stringify({
        name: "x",
        enableSubgraphs: switchedOn ? ["x.library"] : [],
        directories: [{ id: "library-graph", path: "library/", graphTypologies: ["cat-harness"] }],
      }),
    );
    return root;
  }
  const leftOut = () => ({ chosen: false, lock: "index.lock.json" });
  const taken = () => ({ chosen: true, lock: "index.lock.json" });
  const ref = { libraryId: "some-doc", sectionId: "sec-1" };

  it("leftOutByTheLockIsNotMounted", () => {
    const root = optInLayer(false);
    expect(libraryLeftOutByMount(root, leftOut)).toEqual({ dir: resolve(root, "library", "corpus"), lock: "index.lock.json" });
    const r = resolveLibraryRef(ref, root, root, leftOut);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.kind).toBe("library-not-mounted");
      expect(explainFailure(r.failure)).toContain("Not checked here");
    }
    rmSync(root, { recursive: true, force: true });
  });

  it("switchedOffAndLeftOutIsNotMounted", () => {
    // Resolution follows the MOUNTING root (cat-harness-tools#1967): where it
    // switches the group off, the corpus is not listed among the resolved
    // directories at all. The lock's answer still decides, as it does when the
    // layer switches the group on for itself (smart-ips-pilgrimage#66).
    const root = optInLayer(false, false);
    expect(libraryLeftOutByMount(root, leftOut)).toEqual({ dir: resolve(root, "library", "corpus"), lock: "index.lock.json" });
    expect(libraryLeftOutByMount(root, taken)).toBeUndefined();
    rmSync(root, { recursive: true, force: true });
  });

  it("takenByTheMountAndGoneIsStillAFinding", () => {
    // The case the third state must not swallow: the lock says the mount took
    // the corpus, and it is not there.
    const root = optInLayer(false);
    expect(libraryLeftOutByMount(root, taken)).toBeUndefined();
    const r = resolveLibraryRef(ref, root, root, taken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.kind).toBe("no-library-graph");
    rmSync(root, { recursive: true, force: true });
  });

  it("noLockIsStillAFinding", () => {
    // No mount placed this layer, so nothing says the absence was chosen.
    const root = optInLayer(false);
    expect(libraryLeftOutByMount(root, () => undefined)).toBeUndefined();
    rmSync(root, { recursive: true, force: true });
  });

  it("aMountedCorpusResolvesAsBefore", () => {
    const root = optInLayer(true);
    expect(libraryDirOf(root)).toBe(resolve(root, "library", "corpus"));
    expect(libraryLeftOutByMount(root, leftOut)).toBeUndefined();
    rmSync(root, { recursive: true, force: true });
  });
});
