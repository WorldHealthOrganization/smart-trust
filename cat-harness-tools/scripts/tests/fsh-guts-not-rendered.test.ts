/**
 * `fsh-guts/` is not rendered, and that is checked rather than reasoned.
 *
 * Bean `folio-assistant-t0i3`. The directory's whole purpose is that content
 * can be KEPT without being PUBLISHED — so "it is not rendered" is the
 * property, not a side effect, and a property nothing checks is a property
 * that lasts until somebody moves a directory.
 *
 * The first version of this claim was an argument: `fsh-guts/` sits at the
 * repository root, Jekyll's source root is `docs/<stub>`, therefore it cannot
 * be picked up. True, and exactly the kind of reasoning that stops being true
 * silently — the site root has already moved once this month (bean `x4a6`,
 * `docs/` → `docs/<stub>`), and a future move that happened to put the two in
 * the same tree would republish the trashcan with nothing complaining.
 *
 * The half that reads the publish WORKFLOWS — that no Jekyll `source:` a
 * workflow names contains the trashcan — checks the index repository's own
 * `.github/workflows/`, so it lives in that repository's
 * `test/workflows/fsh-guts-not-rendered.test.ts` (owner's ruling 2026-10-09,
 * litlfred/folio-assistant#2521). What stays here is the declared site
 * directory and the trashcan's own nodes.
 *
 * @module scripts/tests/fsh-guts-not-rendered.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { siteDirFor, repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { isWithheld, withheldFromCanonical } from "../compose-docs.ts";
import { pageRelPath } from "../gen-fsh-guts-viz.ts";
import {
  FROZEN_SUBTREE_FIELDS,
  frozenSubtreeNote,
  fshGutsDirectory,
  isFrozenSubtree,
} from "../../schemas/kg/fsh-guts.ts";
import { isDirectoryReadme } from "../../schemas/kg/kg-node.ts";
import { notApplicableAlone } from "../../test/support/checkout.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
// THE REPOSITORY root. `fsh-guts/` is declared `scope: "repository"` — it sits
// at the top of the checkout, beside the layer rather than inside it, which
// is what the first assertion below says in words and what `join(REPO_ROOT, GUTS)`
// stopped meaning at the move (bean `wggr`).
const REPO_ROOT = repoRootFor(ROOT);
/** The declared trashcan, resolved rather than spelled (bean 9c7h), so this follows it to its branch. */
const GUTS_DIR = fshGutsDirectory(REPO_ROOT);
/** Its path relative to the repository root: what a Jekyll source or the built site would contain. */
const GUTS = relative(REPO_ROOT, GUTS_DIR);

/**
 * Every markdown node under `fsh-guts/`, at any depth.
 *
 * Whole-tree rather than a named subdirectory, because naming one is how these
 * tests broke: they scanned `fsh-guts/proposals/` and went ENOENT the moment
 * the proposals moved out (2026-09-23), failing for a reason that had nothing
 * to do with what they assert.
 */
function fshGutsNodes(repoRoot: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, e.name);
      // A FROZEN subtree is one item and its sibling note is the node that
      // answers for it (sub-kg-lifecycle stage 13): the files inside are
      // another repository's, frozen at one commit, and are not asked to
      // declare themselves here. The note is still walked — it is a sibling.
      if (e.isDirectory()) {
        if (!isFrozenSubtree(abs)) walk(abs);
      }
      // A directory README is documentation about the directory, written by
      // `subgraph-readmes`, never one of the retired nodes this test audits.
      else if (e.name.endsWith(".md") && !isDirectoryReadme(abs)) out.push(abs);
    }
  };
  walk(fshGutsDirectory(repoRoot));
  return out;
}

/** Every frozen subtree under `fsh-guts/`, absolute — the directories {@link fshGutsNodes} does not enter. */
function frozenSubtrees(repoRoot: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const abs = join(dir, e.name);
      if (isFrozenSubtree(abs)) out.push(abs);
      else walk(abs);
    }
  };
  walk(fshGutsDirectory(repoRoot));
  return out;
}

/**
 * The trashcan's CONTENT is kept on a state branch that only a composed
 * checkout mounts. Standing alone it is not there, so the tests that read its
 * nodes are not applicable; composed, they run, and an unmounted trashcan
 * fails the first of them.
 */
const NO_TRASHCAN = notApplicableAlone(
  "the `fsh-guts` trashcan's content (kept on its state branch, mounted only in a composed checkout)",
);

describe("fsh-guts stays out of the render pipeline", () => {
  test.skipIf(NO_TRASHCAN)("the declared trashcan exists", () => {
    // If this fails the rest is vacuous — a test suite that passes because
    // its subject is missing is the shape of `pzdv` (two hard gates passing
    // over an empty corpus).
    expect(existsSync(GUTS_DIR)).toBe(true);
    expect(GUTS).toBe("fsh-guts");
  });

  test("its CONTENT is not inside the declared site directory", () => {
    // The site root is `siteDirFor`'s answer, not a literal — so this keeps
    // holding if the site moves again, which is the case that motivated the
    // test.
    //
    // NARROWED FROM "nothing named fsh-guts is in the site directory" on
    // 2026-09-21, and narrowed rather than dropped. The owner asked to see
    // this graph and ruled: render an INDEX of it, exclude that index from the
    // canonical deploy. So `<site>/fsh-guts/` now exists and holds exactly one
    // generated page.
    //
    // The property this test was written for is untouched, and it is worth
    // stating precisely because the file count alone no longer shows it:
    // **no byte of the trashcan's content is in the site tree.** The index
    // links to each file on GitHub rather than copying it, so the graph stays
    // the one copy. What changed is that a reader can now find out what is in
    // there; what did not change is that the content is not republished.
    const site = join(ROOT, siteDirFor(ROOT), GUTS);
    const inSite = existsSync(site) ? readdirSync(site) : [];
    expect(inSite.filter((f) => f !== "index.md")).toEqual([]);
  });

  test("and the index that IS there is withheld from the canonical deploy", () => {
    // The other half of the same ruling, and the half that actually keeps the
    // trashcan unpublished now that a page for it exists. Without this
    // assertion the narrowing above would be a hole: a page in the site
    // directory that nothing withholds is a published page.
    //
    // Asserted through `withheldFromCanonical` rather than by reading the
    // declaration, because what matters is what the COMPOSER will do — the
    // declaration is an input to that, not a substitute for it.
    const rel = pageRelPath(REPO_ROOT);
    if (rel === undefined) {
      // No page declared is a legitimate state: the graph is then unrendered
      // exactly as it was before the ruling, which the test above covers.
      expect(existsSync(join(ROOT, siteDirFor(ROOT), GUTS))).toBe(false);
      return;
    }
    expect(isWithheld(rel, withheldFromCanonical(REPO_ROOT))).toBe(true);
  });

  test.skipIf(NO_TRASHCAN)("its nodes declare themselves", () => {
    // A directory is a place to look; the file says what it is. Without this
    // the graph is duck-typed on location, which is the coincidence-not-
    // contract problem the bean and workflow stores already fixed.
    // RETARGETED 2026-09-23. These scanned `fsh-guts/proposals/` until the
    // owner moved the proposals to the `docs/` of the stub that needs them —
    // *"proposals not in fsh-guts but docs/ for needed <stub>"*. They are no
    // longer fsh-guts nodes, so asking them for fsh-guts properties would be
    // asking the wrong population; their `$schema: folio-fsh-guts/v1` tags
    // were removed in the same change, because a tag that is false is worse
    // than none.
    //
    // Scanning the WHOLE of fsh-guts rather than a named subdirectory is the
    // durable form: the previous version went ENOENT the moment its one
    // subdirectory moved, which is a test that fails for the wrong reason.
    const files = fshGutsNodes(REPO_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const undeclared = files.filter(
      (f) => !readFileSync(f, "utf8").includes("$schema: folio-fsh-guts/v1"),
    );
    expect(undeclared).toEqual([]);
  });

  test.skipIf(NO_TRASHCAN)("no node here is an orphan — each says what put it here", () => {
    // The property is PROVENANCE, not the `movedFrom` key. A reader must be
    // able to tell why a file is in the trashcan rather than in the site, or
    // they cannot distinguish a considered move from an accident — the
    // ambiguity the never-delete rule exists to prevent.
    //
    // There are two honest answers, because there are two ways in. A node
    // that was MOVED says where it came from. A node BORN here — a proposal
    // written as working material, never published and never intended to be
    // — has no prior location, and demanding one would mean writing a
    // `movedFrom` that names a path the file never occupied. That is a
    // fabricated provenance, which is worse than none: it reads as evidence.
    //
    // So a born-here node carries the work that produced it instead, and the
    // check accepts either. It is not weaker — it is the same question asked
    // of both populations, where before it was asked only of one and the
    // other could not answer it truthfully.
    const orphans = fshGutsNodes(REPO_ROOT)
      .filter((f) => {
        const text = readFileSync(f, "utf8");
        const moved = /^movedFrom:/m.test(text);
        const born = /^issue:/m.test(text) || /^bean:/m.test(text);
        return !moved && !born;
      });
    expect(orphans).toEqual([]);
  });

  test.skipIf(NO_TRASHCAN)("a frozen subtree's note says what the copy is, so skipping its files hides nothing", () => {
    // The price of not walking a frozen subtree is that its note must answer
    // for all of it. A note missing the new repository or the commit the copy
    // matches would leave thousands of files whose provenance nobody can
    // check — so the four stage-13 fields are required of THIS kind, here,
    // rather than of every node by the schema (whose `kind` is open).
    const missing = frozenSubtrees(REPO_ROOT).flatMap((d) => {
      const note = frozenSubtreeNote(d)! as Record<string, unknown>;
      return FROZEN_SUBTREE_FIELDS.filter((k) => note[k] === undefined || note[k] === "").map(
        (k) => `${relative(REPO_ROOT, d)}.md lacks ${k}`,
      );
    });
    expect(missing).toEqual([]);
  });

  test.skipIf(NO_TRASHCAN)("a node that says it moved says when", () => {
    // `movedFrom` without `movedOn` dates the move to "sometime", which is
    // the state the two fields exist together to avoid: a reader comparing
    // the trashcan against the site's history needs a point to compare at.
    const undated = fshGutsNodes(REPO_ROOT)
      .map((f) => [f, readFileSync(f, "utf8")] as const)
      .filter(([, text]) => /^movedFrom:/m.test(text) && !/^movedOn:/m.test(text))
      .map(([f]) => f);
    expect(undated).toEqual([]);
  });
});
