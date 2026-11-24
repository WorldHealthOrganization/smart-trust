/**
 * The layout norm, and proof that its ratchet bites.
 *
 * The owner, 2026-09-22: *"follow established norms on layout. qa to
 * enforce."* A check whose only test is that the current corpus passes is a
 * check nobody has shown can fail — the shape this repository keeps naming,
 * most recently in the CRDM relocation guard that filtered on an id the move
 * had deleted and would have passed over nothing forever.
 *
 * So the load-bearing test here is the NEGATIVE one: a synthetic layer that
 * nests a declared directory must be reported and must fail.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { GraphTypologyRegistry } from "../../../schemas/kg/graph-typology-registry.ts";

import { checkLayoutNorms, pairKey, readBaseline } from "../../check-layout-norms.ts";

const INSTANCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const REPO_ROOT = resolve(INSTANCE_ROOT, "..");

/** A throwaway repository with one layer declaring `dirs`. */
function fixture(dirs: Array<{ id: string; path: string; graphTypologies?: string[] }>): string {
  const repo = mkdtempSync(join(tmpdir(), "layout-norms-"));
  const inst = join(repo, "thing");
  for (const d of dirs) mkdirSync(join(inst, d.path), { recursive: true });
  writeFileSync(
    join(inst, "thing.json"),
    JSON.stringify({
      name: "thing",
      description: "fixture",
      directories: dirs.map((d) => ({
        graphTypologies: ["cat-harness"],
        ...d,
        description: "fixture",
      })),
    }),
  );
  return repo;
}

/**
 * A sub-graph KIND nested inside its parent's — bean `8pzh` item 1 (owner,
 * 2026-10-12: L1 extraction output lives beside its library entry). The kind is
 * the registry's, `within` the parent directory's kind, so the nesting is the
 * declared shape, not a root declaration reaching down.
 */
describe("a typology declared `within` its parent's kind is sanctioned — `8pzh`", () => {
  const registry = (): GraphTypologyRegistry => {
    const reg = new GraphTypologyRegistry();
    reg.register("probe-extraction", { renderable: false, holds: "derived", summary: "x", within: "library" });
    reg.register("probe-elsewhere", { renderable: false, holds: "derived", summary: "x", within: "methodology" });
    return reg;
  };
  const nested = (kind: string): string =>
    fixture([
      { id: "library", path: "library/", graphTypologies: ["library"] },
      { id: "e1-out", path: "library/e1/out/", graphTypologies: [kind] },
    ]);

  it("is NOT reported when the child's kind is `within` the parent's", () => {
    const repo = nested("probe-extraction");
    try {
      const r = checkLayoutNorms(repo, join(repo, "none.json"), registry());
      expect(r.undetermined).toBe(false);
      expect(r.found).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("IS reported when the child's kind is `within` some OTHER kind", () => {
    const repo = nested("probe-elsewhere");
    try {
      const r = checkLayoutNorms(repo, join(repo, "none.json"), registry());
      expect(r.unexpected).toEqual([pairKey("thing", "library/", "library/e1/out/")]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("the ratchet bites — the test that matters", () => {
  it("REPORTS and FAILS a nested declaration that is not baselined", () => {
    const repo = fixture([
      { id: "outer", path: "skills/" },
      { id: "inner", path: "skills/voices/" },
    ]);
    try {
      // An empty baseline: nothing is known, so the pair is unexpected.
      const r = checkLayoutNorms(repo, join(repo, "no-such-baseline.json"));
      expect(r.undetermined).toBe(false);
      expect(r.found).toEqual([pairKey("thing", "skills/", "skills/voices/")]);
      expect(r.unexpected).toEqual(r.found);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("does NOT fail a pair that is in the baseline — outstanding work is not a wolf", () => {
    const repo = fixture([
      { id: "outer", path: "skills/" },
      { id: "inner", path: "skills/voices/" },
    ]);
    const baseline = join(repo, "baseline.json");
    writeFileSync(baseline, JSON.stringify({ pairs: [pairKey("thing", "skills/", "skills/voices/")] }));
    try {
      const r = checkLayoutNorms(repo, baseline);
      expect(r.found).toHaveLength(1);
      expect(r.unexpected).toEqual([]);
      expect(r.fixed).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("reports a baselined pair that is GONE as fixed, never as a failure", () => {
    // Removing a nesting is the outcome this check exists to encourage. A
    // guard that failed on it would punish the fix — the inversion bean
    // `rl3h` produced in `subgraphs.test.ts`, where a `> 0` assertion started
    // failing the moment the corpus was cleaned.
    const repo = fixture([{ id: "outer", path: "skills/" }]);
    const baseline = join(repo, "baseline.json");
    writeFileSync(baseline, JSON.stringify({ pairs: [pairKey("thing", "skills/", "skills/voices/")] }));
    try {
      const r = checkLayoutNorms(repo, baseline);
      expect(r.found).toEqual([]);
      expect(r.unexpected).toEqual([]);
      expect(r.fixed).toEqual([pairKey("thing", "skills/", "skills/voices/")]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("an instance with no nesting is clean, which is what `<stub>/<asset>` looks like", () => {
    const repo = fixture([
      { id: "skills", path: "skills/" },
      { id: "processes", path: "processes/" },
      { id: "library", path: "library/" },
    ]);
    try {
      expect(checkLayoutNorms(repo, join(repo, "none.json")).found).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("an empty repository is UNDETERMINED, not clean", () => {
    // Third state. An empty sweep and a clean sweep must not share a
    // spelling — `dh4f`, which is about exactly this.
    const repo = mkdtempSync(join(tmpdir(), "layout-norms-empty-"));
    try {
      expect(checkLayoutNorms(repo, join(repo, "none.json")).undetermined).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("the real corpus", () => {
  const r = checkLayoutNorms();

  it("read more than one instance — otherwise everything below is vacuous", () => {
    expect(r.undetermined).toBe(false);
    expect(r.instances).toBeGreaterThan(5);
  });

  it("has no unexpected nesting — every pair found is baselined", () => {
    expect(r.unexpected).toEqual([]);
  });

  it("NO METHODOLOGY ASSET IS BURIED — the point of the 2026-09-22 move", () => {
    // This asserted `cat-harness` is at zero, full stop. That was true for
    // about two hours: `main` declared `test/` as a `code` graph (#963), so
    // `cat-harness: test contains test/results` is now a real pair, arriving
    // from other work entirely.
    //
    // An assertion another branch can invalidate is a tripwire, not a guard.
    // Narrowed to the claim this branch is actually responsible for and can
    // actually keep: no methodology's skills, processes or library sit inside
    // another declared graph. Corpus-wide nesting stays the baselined ratchet
    // above, which is the mechanism built for exactly the case where somebody
    // else's layout is outstanding work.
    // SCOPED TO THIS LAYER'S OWN `methodologies/`, and the narrowing was
    // forced twice in one sitting. First by `main` declaring `test/`; then by
    // `main` again — #881 landed `smart-base`, whose `methodologies/` contains
    // a declared `methodologies/processes/`, so a filter on /methodolog/
    // matched somebody else's new nesting and failed on work this branch never
    // touched. Those two pairs are baselined and are bean material for
    // whoever owns smart-base, not this PR's to fix.
    //
    // What this branch is responsible for, and can keep: cat-harness's own
    // methodology graph holds nodes and no nested declaration.
    const ours = (p: string): boolean => p.startsWith("cat-harness: methodologies ");
    expect(r.found.filter(ours)).toEqual([]);
    expect(readBaseline().filter(ours)).toEqual([]);
  });

  it("the baseline names only pairs that are really there", () => {
    // A stale baseline entry silently widens the exemption. Anything listed
    // and not found is reported as `fixed`, and the list should be shrunk.
    expect(r.fixed, "baseline lists a pair that no longer exists — run --update").toEqual([]);
  });

  it("every pair found is named once", () => {
    // It said "the known pairs are the `skills/voices` ones" and listed a
    // shape, then "there is at least one". Both were copies of the corpus:
    // the shape drifted from the baseline within hours, and "at least one"
    // failed ON SUCCESS when smart-base's last nesting (`methodologies/
    // processes`) moved to `collab/` (owner, 2026-11-13) — the shape the
    // dangling guard in subgraphs-checkout.test.ts was rewritten away from.
    // That the sweep COMPUTES is pinned by the fixtures above ("REPORTS and
    // FAILS a nested declaration that is not baselined"), and that it read a
    // corpus by `instances > 5`, so an empty result here is a clean corpus,
    // not a vacuous one.
    expect(new Set(r.found).size).toBe(r.found.length);
  });

  it("each nesting is counted ONCE, however many ids resolve to it", () => {
    // `resolveDirectories` merges declared and conventional directories, so
    // one physical nesting can surface under several ids. A fixture's single
    // nesting was reported four times before `pairKey` moved onto paths.
    expect(new Set(r.found).size).toBe(r.found.length);
  });
});

describe("it asks the schema rather than computing geometry", () => {
  it("does not flag a two-segment path that is not inside a declared directory", () => {
    // `test/results/` is two segments from its layer root and is correct:
    // `test/` is not a graph. Depth is the wrong test, and this pins that the
    // check does not use it.
    const repo = fixture([
      { id: "skills", path: "skills/" },
      { id: "qa", path: "test/results/" },
    ]);
    try {
      expect(checkLayoutNorms(repo, join(repo, "none.json")).found).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("the repository root it defaults to is this checkout", () => {
    expect(REPO_ROOT).toBe(resolve(INSTANCE_ROOT, ".."));
  });
});
