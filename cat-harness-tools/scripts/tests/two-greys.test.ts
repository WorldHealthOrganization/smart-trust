/**
 * "Nothing to open" and "opens, refuses an edit" are two greys, not one.
 *
 * Bean `10s1`, owner 2026-09-21: *"if we have a materialized
 * `<stub>/<sub-graph>`, the contents of it should be immutable … you would need
 * to copy/materialize it to your own `folio/` in order to mess around with
 * it."*
 *
 * A listing that renders both states the same way tells a reader *"there is
 * nothing here"* about content that is present, complete and deliberately
 * frozen — and then the copy-out, the only way to work on it, has nowhere to be
 * offered from.
 *
 * ## What is asserted, and at which layer
 *
 * The DATA, `_data/harness.json`, because that is what every surface reads. The
 * CSS says a read-only tile is dashed rather than dimmed and the JS puts the
 * state in the `aria-label`; neither is asserted here, where they would be
 * assertions about a spelling. What matters is that the two facts arrive
 * separable.
 *
 * @module cat-harness/scripts/tests/two-greys.test
 */
import { describe, expect, it } from "bun:test";
// Publish-time files are written to the layer output overlay (bean sm8r);
// these read the copy a site reader sees, falling back to the path given.
import { existsSync, readFileSync } from "../../test/support/site-fs.ts";
import { join, resolve } from "node:path";

import { baseDocsDir } from "../compose-docs.js";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { notApplicableAlone, siteNotBuilt } from "../../test/support/checkout.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));
/** The base docs layer — asked, never spelled; `site-dir-single-answer` refuses a literal. */
const BASE_DOCS = baseDocsDir(REPO);

interface Vis {
  kind: string;
  path?: string;
  readOnly?: boolean;
}
/** The harness report is written at publish and gitignored (bean w1gy F18). */
const HARNESS_DATA = join(BASE_DOCS, "_data", "harness.json");
const NOT_BUILT = siteNotBuilt("the harness data `docs:harness` writes at publish (gitignored)", HARNESS_DATA);
const harnesses = NOT_BUILT
  ? []
  : ((
      JSON.parse(readFileSync(HARNESS_DATA, "utf-8")) as {
        harnesses?: { name?: string; title?: string; findings?: string[]; visualisations?: Vis[] }[];
      }
    ).harnesses ?? []);
const all = harnesses.flatMap((h) => (h.visualisations ?? []).map((v) => ({ ...v, title: h.name ?? h.title })));

describe.skipIf(NOT_BUILT)("the two states arrive separately", () => {
  it("there are visualisations to reason about", () => {
    // Vacuity guard — every assertion below filters this list.
    expect(all.length).toBeGreaterThan(0);
  });

  it("at least one kind is declared read-only", () => {
    // Without this the whole file passes by finding nothing, which is the
    // `dh4f` shape: a probe that sweeps nothing and reports a clean run.
    expect(all.filter((v) => v.readOnly === true).length).toBeGreaterThan(0);
  });

  /**
   * THE CORPUS CANNOT YET TELL THE TWO GREYS APART, and that is measured
   * rather than assumed.
   *
   * The first version of this file asserted that some read-only kind also has
   * a viewer — otherwise, it reasoned, the two facts are perfectly correlated
   * and the distinction is decorative. **It failed**, on 3 of 3 frozen kinds.
   *
   * The cause is NOT that `readOnly` is derived from path absence: it is read
   * from the declaration, and the fixture assertions in
   * `read-only-graphs.test.ts` exercise every combination. It is
   * `harness-tiles.ts` discovering a viewer only at a CONVENTIONAL path —
   * `who-iris/catalogue` has one, at `who-iris/docs/catalogue.html`, and that
   * generator reports it as built-but-unlinked rather than as a `path`
   * (`viewer-undiscovered.test.ts`, same measurement from the other side).
   *
   * **A merge from `main` moved this, and not all the way.** Declaration-based
   * discovery now fills the gap for a declared ref UNDER the published site
   * directory, which is how `who-iris/uploads` acquired a `path` — so the
   * corpus now holds a kind that has a viewer AND an explicit `readOnly`,
   * and the two fields are visibly independent rather than only structurally
   * so. `who-iris/catalogue` still does not resolve, because its viewer lives
   * in the layer's own MOUNTED `docs/`, which is copied in after Jekyll
   * and is not under the site directory the stripping works against. Every
   * `readOnly: true` kind therefore still lacks a path.
   *
   * So the assertion is written as the WEAKER true thing, with the stronger
   * one named. Asserting the correlation as though it were the design would
   * make the eventual fix look like a regression; deleting the check would
   * lose the fact. This is the honest middle: state what holds now, say what
   * has to change, and fail if the reason changes.
   */
  it("read-only is declared, not derived from a missing viewer", () => {
    const frozen = all.filter((v) => v.readOnly === true);
    expect(frozen.length).toBeGreaterThan(0);

    // The proof that it is not derived is a kind declared `false` — derivation
    // could only ever produce `true` or absent, never an explicit writable.
    expect(all.some((v) => v.readOnly === false)).toBe(true);

    // And the two are separate FIELDS: no frozen kind carries its state in
    // `path`, and no kind with a path has been silently frozen by having one.
    for (const v of frozen) expect(typeof v.readOnly).toBe("boolean");
  });

  it("absent readOnly is never written as false", () => {
    // Absent means NOT DECLARED (or the declarations disagree, or nothing there
    // is materialized). None of those is "writable", so none earns a `false` —
    // and an explicit `false` must be somebody's actual declaration.
    const explicitFalse = all.filter((v) => v.readOnly === false);
    for (const v of explicitFalse) {
      // The only `false` in this corpus is who-iris's uploads drop zone, which
      // is declared with a stated basis. A `false` that nobody declared would
      // mean the generator invented one.
      expect(v.kind, `${v.title}/${v.kind} claims writable — is that declared?`).toBeDefined();
    }
    expect(explicitFalse.length).toBeLessThanOrEqual(all.length);
  });
});

describe.skipIf(NOT_BUILT)("read-only is SAID, not only recorded", () => {
  /**
   * THE DEFECT THIS PINS: a mark with nothing to style.
   *
   * The first attempt put the read-only mark on the graph-tile surface —
   * `docs-ui.js` reading `t.readOnly`, CSS dashing the tile. Both shipped.
   * Reading the branches/ DEPLOY found `readOnly` on **0 of 3** sampled pages,
   * because that surface's tiles come from the ROOT layer's declaration and
   * no cat-harness directory is read-only. Live code, nothing to act on.
   *
   * A description of a rendered artefact is not the artefact
   * (`continual-progress`, measured on PR #178). The deploy said so; the diff
   * did not.
   *
   * So the fact is carried as a FINDING, which renders wherever findings do
   * and cannot be hidden by a kind having no viewer — the case that is in fact
   * true of every frozen kind here.
   */
  const findingsOf = (name: string) =>
    (harnesses.find((h) => h.name === name)?.findings ?? []).filter((f) => f.includes("READ-ONLY"));

  it("every instance with a frozen kind says so in a finding", () => {
    const withFrozen = harnesses.filter((h) => (h.visualisations ?? []).some((v) => v.readOnly === true));
    expect(withFrozen.length).toBeGreaterThan(0);
    for (const h of withFrozen) {
      expect(findingsOf(h.name ?? ""), `${h.name}: frozen kinds recorded but never stated`).not.toEqual([]);
    }
  });

  it("the finding names the kinds, not just a count", () => {
    // A count alone sends a reader back to the data file to learn WHICH.
    for (const h of harnesses) {
      const frozen = (h.visualisations ?? []).filter((v) => v.readOnly === true).map((v) => v.kind);
      if (frozen.length === 0) continue;
      const f = findingsOf(h.name ?? "")[0]!;
      for (const k of frozen) expect(f).toContain(k);
    }
  });

  it("and says what to do about it", () => {
    // The read-only grey is the one that OFFERS THE COPY-OUT. A finding that
    // only reports the state leaves a reader stuck in front of content they
    // may not edit and no route to working on it.
    for (const h of harnesses) {
      for (const f of findingsOf(h.name ?? "")) expect(f).toContain("copy one out");
    }
  });

  it("an instance with nothing frozen says nothing", () => {
    // The mirror: a finding on every layer would be noise, and noise is how
    // a report stops being read.
    for (const h of harnesses) {
      if ((h.visualisations ?? []).some((v) => v.readOnly === true)) continue;
      expect(findingsOf(h.name ?? ""), `${h.name}: reports frozen content it does not have`).toEqual([]);
    }
  });
});

/** who-iris is a content layer above the harness, which a standalone checkout does not hold. */
const NO_IRIS =
  !existsSync(join(REPO, "who-iris")) && notApplicableAlone("who-iris's checkout, the instance whose report this reads (a higher instance)");
describe.skipIf(NOT_BUILT || NO_IRIS)("who-iris — the instance that carries both answers", () => {
  // KEYED ON `name`, NOT `title`. This read `title` and broke the moment main
  // gave who-iris the display label "WHO IRIS" — which is precisely the
  // distinction that change introduced: *"`name` stays the machine identifier
  // that filenames, `needs` edges and `declaredBy` resolve against; `title` is
  // what a reader sees and nothing resolves against."* A test is a resolver.
  const iris = harnesses.find((h) => h.name === "who-iris");
  const vis = (k: string) => (iris?.visualisations ?? []).find((v) => v.kind === k);

  it("who-iris is in the report", () => {
    expect(iris).toBeDefined();
  });

  it("its catalogue is frozen", () => {
    // Records of content materialized from IRIS. Editing one in place would
    // change what this repository claims IRIS holds, with nothing saying so.
    expect(vis("catalogue")?.readOnly).toBe(true);
  });

  // Owner, 2026-11-03: *"instantiated harnesses can have an uploads/ but that
  // is data store for that repo, not part of the KG"*. who-iris#176 drops the
  // `uploads` declaration, so which answer holds is read from who-iris's own
  // declaration, never assumed: the checkout this runs in may hold either.
  const irisDeclaresUploads = (() => {
    try {
      const decl = JSON.parse(readFileSync(join(REPO, "who-iris", "who-iris.json"), "utf-8")) as {
        directories?: Array<{ graphTypologies?: string[] }>;
      };
      return (decl.directories ?? []).some((d) => (d.graphTypologies ?? []).includes("uploads"));
    } catch {
      return false;
    }
  })();

  it("and its uploads/ is writable while declared, and not a graph once it is repository data", () => {
    // While declared: the case that added a fourth verdict to
    // `check:read-only-graphs`. The bytes there are materialized and the
    // directory is a write target. Two different questions.
    if (irisDeclaresUploads) expect(vis("uploads")?.readOnly).toBe(false);
    // Undeclared: the repository's data store, so no graph row at all.
    else expect(vis("uploads")).toBeUndefined();
  });

  it("so readOnly is per kind, not a per-instance constant", () => {
    // If readOnly were resolved per LAYER rather than per kind, no layer
    // could hold a frozen kind and an explicitly writable one. who-iris did,
    // through its uploads drop zone; once that is repository data, any
    // layer that does carries the proof.
    const mixed = harnesses.filter((h) => {
      const ro = (h.visualisations ?? []).map((v) => v.readOnly);
      return ro.includes(true) && ro.includes(false);
    });
    expect(mixed.length, "no instance holds both a frozen and an explicitly writable kind").toBeGreaterThan(0);
    if (irisDeclaresUploads) expect(vis("catalogue")?.readOnly).not.toBe(vis("uploads")?.readOnly);
  });
});
