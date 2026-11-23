/**
 * A folder corresponds to a subgraph, and subgraphs should be disconnected.
 *
 * Bean `x4v4`, settled by the owner 2026-09-20. The properties worth pinning
 * are the ones that were WRONG at some point while this was written, because
 * each was wrong in a way that looked like a clean result:
 *
 *  - `owningDirectory` keyed on `absPath` unconditionally, so every relative
 *    query returned `undefined`. `undefined` is a legitimate answer here (a
 *    node in no declared directory), so the bug read as a finding, and a
 *    sweep built on it would have reported an empty, healthy corpus.
 *  - `scanSubgraphs` skipped links whose target does not exist, on the
 *    reasoning that a dangling link belongs to `blv9`. That hid 13 broken
 *    links left by relocating CRDM (bean `g43o`) — a half-finished move
 *    reading as a clean disconnection.
 *
 * The tests of this file that read the whole checkout (attributes the
 * directories smart-base and the root layer declare) live in
 * `test/subgraphs-checkout.test.ts` (bean `7zz1`): standing alone, cat-harness
 * has none of it.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  CatHarnessDeclarationSchema,
  isDerivedGraph,
  owningDirectory,
  resolveDirectories,
  siteDirFor,
  subgraphTree,
} from "../../schemas/kg/cat-harness.ts";
import { addressesPublishedTree, beanArchiveViews, danglingLinksIn, declaredMoves, overDeepLinks, resolveAcrossArchive, resolveThroughMove, scanSubgraphs, unbuiltPublishPaths, type LinkContext } from "../check-subgraphs.ts";
import { GraphTypologyRegistry, type GraphTypologyDef } from "../../schemas/kg/graph-typology-registry.ts";
import { checkoutDirectories } from "../../schemas/kg/harness-config.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { siteNotBuilt } from "../../test/support/checkout.ts";

const ROOT = resolve(HARNESS_ROOT);
const dirs = resolveDirectories([{ name: "(local)", root: ROOT, own: true }]);
// The real corpus, scanned ONCE at module scope (bean sff8's remedy, as in
// instance-render.test.ts). Four tests read it; two scanned it again inside
// the test body, where a whole-repo walk (~6 s measured 2026-10-05) ran
// against bun's 5 s per-test limit and timed out in CI. Nothing in this file
// writes to the tree, so one scan answers every test exactly as four did.
const REAL = scanSubgraphs(ROOT);

describe("subgraph containment is derived from declared paths", () => {
  test("the declaration was read — otherwise nothing below holds", () => {
    expect(dirs.length, "no directories resolved").toBeGreaterThan(10);
  });

  test("`methodologies/` nests nothing — the thing this branch actually achieved", () => {
    // THIS ASSERTED A GLOBAL PROPERTY AND SHOULD NOT HAVE. Until 2026-09-22 it
    // read `expect(subgraphTree(dirs)).toEqual([])` — "this instance nests
    // nothing" — which was true the hour it was written and false by the next
    // merge: `main` declared `test/` as a `code` graph (#963), so `test/` now
    // contains the declared `test/results`, through no change of this branch's.
    //
    // An assertion any other branch can invalidate is not a regression guard,
    // it is a tripwire on somebody else's work. The durable claim is the
    // narrow one: the methodology subgraphs this branch un-buried stay
    // un-buried. Corpus-wide nesting is `check:layout-norms`'s question, where
    // it is a ratchet with a baseline rather than an absolute.
    // Scoped to the id `methodologies` EXACTLY — this layer's own graph.
    // A /methodolog/ substring also matches `smart-base-methodologies`, which
    // `main` landed in #881 with a nested `smart-base-processes` inside it.
    // That is a real finding, it is baselined in `check:layout-norms`, and it
    // belongs to whoever owns smart-base — not to a test about this branch.
    const nested = subgraphTree(dirs).flatMap((r) => [r.parent, ...r.children]);
    expect(nested.filter((id) => id === "methodologies")).toEqual([]);
    const methodologies = dirs.find((d) => d.id === "methodologies");
    expect(methodologies, "the methodology graph did not resolve — the check above is vacuous").toBeDefined();
  });

  // The real declaration no longer nests anything, so the two properties
  // below have no witness in this corpus. They are pinned against a SYNTHETIC
  // pair instead of dropped: `subgraphTree` and `owningDirectory` are shared
  // machinery that any layer may exercise, and deleting their only tests
  // because this layer stopped nesting would retire a guard for a defect
  // that is still reachable.
  const NESTED = [
    { id: "outer", path: "outer/", absPath: `${ROOT}/outer`, graphTypologies: ["cat-harness"] },
    { id: "inner", path: "outer/inner/", absPath: `${ROOT}/outer/inner`, graphTypologies: ["cat-harness"] },
  ];

  test("a node belongs to its DEEPEST subgraph, not to the outer one", () => {
    // This IS the x4v4 defect in concrete form: attributing an inner node to
    // the outer graph makes every count computed from that sweep wrong.
    expect(owningDirectory(NESTED, "outer/inner/node.md")?.id).toBe("inner");
    expect(owningDirectory(NESTED, "outer/node.md")?.id).toBe("outer");
    // ...and immediate containment only: with `a/`, `a/b/` and `a/b/c/` all
    // declared, `a` has one child, not two.
    const tree = subgraphTree(NESTED);
    expect(tree.find((r) => r.parent === "outer")?.children).toEqual(["inner"]);
  });

  test("relative and absolute queries agree", () => {
    // The bug that made every probe answer "no owner" while looking healthy.
    // Run against the REAL declaration, because that is where the absPath
    // keying actually bit — a fixture would not have caught it.
    const rel = owningDirectory(dirs, "methodologies/kepner-tregoe.md");
    const abs = owningDirectory(dirs, `${ROOT}/methodologies/kepner-tregoe.md`);
    expect(rel?.id).toBe("methodologies");
    expect(abs?.id).toBe(rel?.id);
  });
});

describe("the entanglement report", () => {
  const report = REAL;

  test("it attributed files — a report over nothing is not a clean corpus", () => {
    expect(report.scanned, "no markdown attributed to any declared directory").toBeGreaterThan(100);
  });

  test("a DERIVED graph's unresolved links are never dangling", () => {
    // A library section is machine-produced FROM a source document, so a
    // markdown link inside it is whatever the derivation carried across. Five
    // documents ingested on 2026-09-23 printed `./REFERENCE.md`, `./FORMS.md`
    // and `./advanced.md` inside EXAMPLES of a skill directory — 12 findings,
    // every one asking somebody to edit a transcription of a document this
    // project did not write.
    //
    // `schemas/kg/cat-harness.ts` already said so of the `derived` layer — *"a QA
    // finding against a derived section is a finding against its GENERATOR,
    // not against the corpus, and it sends a reviewer to fix the wrong file"*
    // — and this check simply was not applying it.
    //
    // Asserted as an INVARIANT rather than a count. `derivedLinks.length > 0`
    // would be the same trap the test above documents: it would fail the day
    // somebody drains it, punishing the fix. This holds whether the corpus
    // carries twelve or none.
    // Same call shape as `scanSubgraphs` itself — it takes a layer CHAIN,
    // not a path, and passing the root produced a `chain.find is not a
    // function` rather than a wrong answer.
    // Over the CORPUS the sweep reads since placement PR0 (bean `ejye`), with
    // a foreign directory labelled `<member>/<id>`, as the report labels it.
    const dirs = checkoutDirectories(ROOT, { stackedOn: ROOT });
    const derivedIds = new Set(
      dirs.filter((d) => d.graphTypologies.some((g) => isDerivedGraph(g))).flatMap((d) => [d.id, `${d.member}/${d.id}`]),
    );
    expect(derivedIds.size, "no derived directory is declared, so this proves nothing").toBeGreaterThan(0);

    // Nothing from a derived directory may be reported as dangling …
    expect(report.dangling.filter((d) => derivedIds.has(d.fromDir))).toEqual([]);
    // … and everything in the derived bucket must come from one.
    expect(report.derivedLinks.filter((d) => !derivedIds.has(d.fromDir))).toEqual([]);
  });

  test("CRDM's relocations left no broken links behind — both of them", () => {
    // 13 were left by `g43o` (into `methodologies/crdm/`) and repaired when
    // this check first surfaced them. CRDM moved AGAIN on 2026-09-22, into
    // `sdlc/skills/crdm/`, and on 2026-11-12 into `skills/process/crdm/`
    // (cat-harness#1266), so this guard is re-keyed each time: a filter on the
    // old place would match nothing and pass for the wrong reason — a guard
    // that cannot fail, which is worse than one that is absent because it
    // reads as coverage.
    const crdm = report.dangling.filter((d) => d.from.includes("skills/process/crdm/"));
    expect(crdm.map((d) => `${d.from} → ${d.target}`)).toEqual([]);
    const raci = report.dangling.filter((d) => d.from.includes("skills/process/raci/"));
    expect(raci.map((d) => `${d.from} → ${d.target}`)).toEqual([]);
  });

  test("an illustrative placeholder is not counted as a broken link", () => {
    // `[main](…)` in an example table never named a file. Counting it is a
    // standing false finding, which is the wolf-crying this repo refuses.
    expect(report.dangling.filter((d) => /^[….]+$/.test(d.target))).toEqual([]);
  });
});

/**
 * Attribution spans the whole repository, not just this layer.
 *
 * Bean `3ye4`. `owningDirectory` compares in the space of the path it is
 * given, and `scanSubgraphs` handed it INSTANCE-RELATIVE paths — so a
 * `scope: "repository"` directory yielded `../…`, matched no declared
 * prefix, and every file in it was attributed to nothing. Six declared
 * directories were swept past in silence.
 *
 * The symptom was the dangerous kind: the sweep reported **0 dangling
 * links** over a corpus that had 26. It looked like success. It was
 * discovered only because moving one file made the number drop
 * implausibly.
 */
describe("repository-scoped directories are attributed", () => {
  const report = REAL;

  test("attribution reaches well past this instance's own tree", () => {
    // 636 before the fix, ~1139 after. A floor rather than the number,
    // because the corpus grows — but far enough above 636 that a regression
    // to instance-only attribution cannot pass.
    expect(report.scanned).toBeGreaterThan(900);
  });

  test("nothing declared is left unexamined without a reason", () => {
    // The whole point: a directory is either examined, or exempt BY
    // DECLARATION. "Skipped because a path comparison failed" is neither.
    expect(report.notExamined).toEqual([]);
  });
});

describe("the `../` too many count is COMPUTED (bean `syrl`)", () => {
  // The report carried this number as a STRING LITERAL for five days: "23
  // carry one `../` too many", measured once on 2026-09-20 and printed
  // unchanged beside a total that re-measured every run. When it was finally
  // computed it read **27** — so the literal had been wrong for most of its
  // life, and nothing could say so.
  //
  // Both halves are asserted, because a fix that returns nothing would pass
  // the first on its own and would be indistinguishable from a clean corpus.
  // ASKED, not spelled: `site-dir-single-answer` refuses a literal here, and
  // it is right to — a test naming the output root by hand is one more place
  // the answer can disagree with the declaration.
  const siteDir = resolve(ROOT, siteDirFor(ROOT));

  // The page it lands on is a generated skill reference page, written at
  // publish and gitignored (bean w1gy F18).
  test.skipIf(
    siteNotBuilt(
      "the skill reference pages `skills:docs` writes at publish (gitignored)",
      join(siteDir, "reference", "skill-instructions", "index.md"),
    ),
  )("a target that resolves after dropping one `../` IS one", () => {
    // From `docs/reference/skill-instructions/`, `../../skill-instructions/…`
    // lands in `docs/` — nothing there — while dropping one `../` lands on
    // the page's own directory, where `index.md` is.
    const found = overDeepLinks(ROOT, [
      {
        from: "docs/reference/skill-instructions/x.md",
        fromDir: "docs",
        target: "../../skill-instructions/index.md",
      },
    ]);
    expect(found.map((f) => f.repaired)).toEqual(["../skill-instructions/index.md"]);
  });

  test("a target that still does not resolve after dropping one is NOT", () => {
    const found = overDeepLinks(ROOT, [
      { from: "docs/x.md", fromDir: "docs", target: "../../no-such-directory/no-such-file.md" },
    ]);
    expect(found, "a repair is tested against disk, never inferred from shape").toEqual([]);
  });

  test("a target with no `../` at all is never one", () => {
    const found = overDeepLinks(ROOT, [
      { from: "docs/x.md", fromDir: "docs", target: "reference/index.md" },
    ]);
    expect(found).toEqual([]);
  });

  test("the real corpus carries none — the repair of `mi97` holds", () => {
    // Falsifier for `mi97`, which said the count must fall to zero once the
    // 27 were repaired. It is checkable ONLY because the number is live.
    expect(existsSync(siteDir), `${siteDir} must exist or this asserts nothing`).toBe(true);
    const { siteResolved } = REAL;
    expect(overDeepLinks(ROOT, siteResolved).map((l) => `${l.from} -> ${l.target}`)).toEqual([]);
  });
});

describe("a kind whose markdown a published page SHOWS addresses the published tree (smart-immunizations#81)", () => {
  // An IG annex is appended to its host page, so `business-processes.html#…`
  // in `annexes/` names the page the IG renders, not a file beside it.
  const reg = new GraphTypologyRegistry({
    site: { renderable: true, holds: "content", summary: "a site" },
    group: { renderable: false, within: "site", holds: "content", summary: "a group of the site's pages" },
    // Cast: the field is cat-harness#618's, absent from an older pinned GraphTypologyDef.
    annex: { renderable: false, shownOnPublishedPages: true, holds: "content", summary: "markdown appended to a page" } as GraphTypologyDef,
    data: { renderable: false, holds: "content", summary: "nothing shows it" },
  });

  test("renderable, within a renderable kind, and shown on a published page each do", () => {
    expect(addressesPublishedTree(["site"], reg)).toBe(true);
    expect(addressesPublishedTree(["group"], reg)).toBe(true);
    expect(addressesPublishedTree(["annex"], reg)).toBe(true);
    expect(addressesPublishedTree(["data", "annex"], reg)).toBe(true);
  });

  test("a kind that says none of the three does not, so its unresolved links stay dangling", () => {
    expect(addressesPublishedTree(["data"], reg)).toBe(false);
    expect(addressesPublishedTree([], reg)).toBe(false);
    expect(addressesPublishedTree(["unknown"], reg)).toBe(false);
  });
});

// cat-harness-tools#1248: `beans archive` moves a bean from `defs/` to
// `defs/archive/` and rewrites none of its links. The archive is a view of the
// store (bean `e8m3`), so both halves of the pair resolve a bean's links.
describe("the bean archive view resolves like the store it sits in", () => {
  const withStore = (fn: (root: string) => void) => {
    const root = mkdtempSync(join(tmpdir(), "archive-view-"));
    try {
      mkdirSync(join(root, "beans/defs/archive"), { recursive: true });
      mkdirSync(join(root, "beans/notes"), { recursive: true });
      writeFileSync(join(root, "AGENTS.md"), "x");
      writeFileSync(join(root, "beans/defs/archive/b.md"), "x");
      fn(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };
  const dirs = [
    { path: "beans/defs", graphTypologies: ["bean-defs"] },
    { path: "beans/defs/archive", graphTypologies: ["bean-defs"] },
    { path: "beans/notes", graphTypologies: ["bean-notes"] },
    { path: "docs", graphTypologies: ["docs"] },
    { path: "docs/archive", graphTypologies: ["docs"] },
  ];

  test("only a bean-defs directory inside another pairs up", () =>
    withStore((root) => {
      expect(beanArchiveViews(dirs, root)).toEqual([
        { store: join(root, "beans/defs"), view: join(root, "beans/defs/archive") },
      ]);
    }));

  test("a link FROM an archived bean resolves as if it sat in the store", () =>
    withStore((root) => {
      const views = beanArchiveViews(dirs, root);
      const file = join(root, "beans/defs/archive/b.md");
      expect(resolveAcrossArchive(file, "../../AGENTS.md", resolve(join(root, "beans/defs/archive"), "../../AGENTS.md"), views))
        .toBe(join(root, "AGENTS.md"));
    }));

  test("a link TO a bean that has since been archived still resolves", () =>
    withStore((root) => {
      const views = beanArchiveViews(dirs, root);
      const file = join(root, "beans/notes/README.md");
      expect(resolveAcrossArchive(file, "../defs/b.md", join(root, "beans/defs/b.md"), views))
        .toBe(join(root, "beans/defs/archive/b.md"));
    }));

  test("a link that names nothing in either half is still unresolved", () =>
    withStore((root) => {
      const views = beanArchiveViews(dirs, root);
      const file = join(root, "beans/defs/archive/b.md");
      expect(resolveAcrossArchive(file, "../../NOPE.md", resolve(join(root, "beans/defs/archive"), "../../NOPE.md"), views)).toBeUndefined();
      expect(resolveAcrossArchive(join(root, "beans/notes/README.md"), "../defs/c.md", join(root, "beans/defs/c.md"), views)).toBeUndefined();
    }));
});

// folio-assistant-tsh9: a layer that moves a path other layers link to keeps
// answering at the old path for a declared window, so the layers that link to
// it can switch in any order (sdlc skill `two-phase-move`).
describe("a declared move answers at the old path until its window closes", () => {
  const withMove = (until: string, fn: (inst: string) => void) => {
    const inst = mkdtempSync(join(tmpdir(), "moves-"));
    try {
      mkdirSync(join(inst, "sdlc/skills"), { recursive: true });
      writeFileSync(join(inst, "sdlc/skills/a.md"), "x");
      const name = inst.split("/").pop()!;
      writeFileSync(
        join(inst, `${name}.json`),
        JSON.stringify({ name, directories: [], moves: [{ from: "skills/sdlc", to: "sdlc/skills", until }] }),
      );
      fn(inst);
    } finally {
      rmSync(inst, { recursive: true, force: true });
    }
  };

  test("a link to the old path resolves at the new one", () =>
    withMove("2099-12-31", (inst) => {
      const moves = declaredMoves([inst], "2026-11-05");
      expect(moves.map((m) => [m.absFrom, m.absTo, m.expired])).toEqual([[join(inst, "skills/sdlc"), join(inst, "sdlc/skills"), false]]);
      expect(resolveThroughMove(join(inst, "skills/sdlc/a.md"), moves)?.resolved).toBe(join(inst, "sdlc/skills/a.md"));
    }));

  test("a file that is not at the new path either is still unresolved", () =>
    withMove("2099-12-31", (inst) => {
      expect(resolveThroughMove(join(inst, "skills/sdlc/b.md"), declaredMoves([inst], "2026-11-05"))).toBeUndefined();
      // and a path that merely shares the prefix's spelling is not under it
      expect(resolveThroughMove(join(inst, "skills/sdlc-x/a.md"), declaredMoves([inst], "2026-11-05"))).toBeUndefined();
    }));

  test("past `until` the move is expired and no longer honoured", () =>
    withMove("2026-11-04", (inst) => {
      const moves = declaredMoves([inst], "2026-11-05");
      expect(moves[0]!.expired).toBe(true);
      expect(resolveThroughMove(join(inst, "skills/sdlc/a.md"), moves)).toBeUndefined();
    }));

  test("the declaration refuses a move without a date", () => {
    const decl = { name: "x", directories: [], moves: [{ from: "a", to: "b", until: "soon" }] };
    expect(CatHarnessDeclarationSchema.safeParse(decl).success).toBe(false);
    decl.moves[0]!.until = "2026-12-31";
    expect(CatHarnessDeclarationSchema.safeParse(decl).success).toBe(true);
  });
});

// A link into a declared `builtAtPublish` path cannot be judged before the
// publish build has written it (owner ruling 2026-11-05, card "Built links",
// option 1): unverifiable while the path is absent, judged once it exists.
describe("a link into an unbuilt publish-time artefact is unverifiable, not dangling", () => {
  const withInstance = (built: boolean, fn: (inst: string, ctx: LinkContext) => void) => {
    const inst = mkdtempSync(join(tmpdir(), "bap-"));
    try {
      const name = inst.split("/").pop()!;
      mkdirSync(join(inst, "notes"), { recursive: true });
      if (built) {
        mkdirSync(join(inst, "schemas/kinds"), { recursive: true });
        writeFileSync(join(inst, "schemas/kinds/a.json"), "{}");
      }
      writeFileSync(
        join(inst, `${name}.json`),
        JSON.stringify({
          name,
          directories: [],
          builtAtPublish: [{ path: "schemas/kinds/", writer: ["kinds:build"], because: "checkout", reason: "fixture" }],
        }),
      );
      const dirs = [{ id: "notes", path: "notes", absPath: join(inst, "notes"), graphTypologies: [] as string[] }];
      const ctx = { root: inst, own: dirs, dirs, label: (d: { id: string }) => d.id, absentOffMain: [], archiveViews: [], unbuilt: unbuiltPublishPaths([inst]) } as unknown as LinkContext;
      fn(inst, ctx);
    } finally {
      rmSync(inst, { recursive: true, force: true });
    }
  };

  test("an absent declared path is listed, with its trailing slash", () =>
    withInstance(false, (inst) => {
      expect(unbuiltPublishPaths([inst])).toEqual([`${join(inst, "schemas/kinds")}/`]);
    }));

  test("while unbuilt, a link into it is not dangling; a link elsewhere still is", () =>
    withInstance(false, (inst, ctx) => {
      const text = "[k](../schemas/kinds/a.json) [d](../schemas/kinds/) [x](../nope.md)";
      expect(danglingLinksIn(ctx, join(inst, "notes/n.md"), text)).toEqual(["../nope.md"]);
    }));

  test("once built, a link to a file the build did not write is dangling again", () =>
    withInstance(true, (inst, ctx) => {
      expect(unbuiltPublishPaths([inst])).toEqual([]);
      const text = "[k](../schemas/kinds/a.json) [m](../schemas/kinds/missing.json)";
      expect(danglingLinksIn(ctx, join(inst, "notes/n.md"), text)).toEqual(["../schemas/kinds/missing.json"]);
    }));
});
