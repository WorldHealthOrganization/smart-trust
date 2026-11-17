/**
 * "No published viewer" and "a viewer nothing links" are different findings.
 *
 * `harness-tiles.ts` discovers a kind's viewer by CONVENTION — a page at
 * `/<handler>/<kind>/<name>/`, or `/<kind>/` for the layer that owns the
 * site. A viewer published anywhere else is real, on disk, and invisible to
 * that search.
 *
 * ## The false finding this exists to prevent
 *
 * Measured 2026-09-22. `who-iris/catalogue` gained a viewer at
 * `who-iris/docs/catalogue.html` — declared, resolving, gated. The tile
 * generator went on reporting *"declares N graph(s) with no published
 * viewer — catalogue, …"*, while the declared-ref check twenty lines further
 * down in the same file reported that same declaration as perfectly fine.
 *
 * Two halves of one generator disagreeing about one graph, with the artefact
 * asserting the false half. That is worse than a missing tile: a report that
 * claims a gap which has been filled teaches its reader to discount it, and
 * this repository's findings are only worth anything if they are believed.
 *
 * Splitting the finding immediately turned up a case that predates the change
 * — `uploads` declares a viewer at
 * `cat-harness/docs/cat-harness/library/who-iris/index.html` which exists and
 * which no tile links. So the defect was live before it was noticed, which is
 * the usual shape.
 *
 * ## What is NOT asserted here
 *
 * That the undiscovered viewer gets linked. It does not, deliberately: making
 * an instance-relative ref linkable means resolving it through `withRoutes`,
 * which changes how every tile resolves and belongs in its own change. These
 * assertions pin the HONESTY of the report, not the reach of the discovery.
 *
 * @module cat-harness/scripts/tests/viewer-undiscovered.test
 */
import { describe, expect, it } from "bun:test";
// Publish-time files are written to the layer output overlay (bean sm8r);
// these read the copy a site reader sees, falling back to the path given.
import { existsSync, readFileSync } from "../../../test/support/site-fs.ts";
import { join, resolve } from "node:path";

import { baseDocsDir } from "../../compose-docs.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { notApplicableAlone, siteNotBuilt } from "../../../test/support/checkout.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));
/** The base docs layer — asked, never spelled. `site-dir-single-answer` refuses a literal. */
const BASE_DOCS = baseDocsDir(REPO);
const HARNESS = join(BASE_DOCS, "_data", "harness.json");

interface Harness {
  /** The layer's DIRECTORY name — stable. See the lookup below. */
  name?: string;
  title?: string;
  findings?: string[];
  visualisations?: { kind: string; path?: string }[];
}

/** The harness report is written at publish and gitignored (bean w1gy F18). */
const NOT_BUILT = siteNotBuilt("the harness data `docs:harness` writes at publish (gitignored)", HARNESS);
/** Layers above the harness, which a standalone checkout does not hold. */
const absentAbove = (names: string[]): boolean =>
  names.some((n) => !existsSync(join(REPO, n))) &&
  notApplicableAlone(`${names.join(" and ")}, the higher instance(s) whose report entries this reads`);

const data = (NOT_BUILT ? {} : JSON.parse(readFileSync(HARNESS, "utf-8"))) as { harnesses?: Harness[] };
const harnesses = data.harnesses ?? [];

const findingsOf = (h: Harness): string[] => h.findings ?? [];
const unbuilt = (h: Harness) => findingsOf(h).find((f) => f.includes("no published viewer"));
const undiscovered = (h: Harness) => findingsOf(h).find((f) => f.includes("not at a conventional path"));

describe.skipIf(NOT_BUILT)("the harness report distinguishes unbuilt from undiscovered", () => {
  it("has harnesses to report on", () => {
    // Vacuity guard: every assertion below iterates this list.
    expect(harnesses.length).toBeGreaterThan(0);
  });

  it("no kind is named as BOTH unbuilt and undiscovered", () => {
    // The two sets partition the unlinked kinds. A kind in both would mean the
    // report contradicts itself, which is the failure being fixed, restated.
    for (const h of harnesses) {
      const a = unbuilt(h);
      const b = undiscovered(h);
      if (!a || !b) continue;
      const kindsIn = (f: string): string[] =>
        (/— (.+?)\. /.exec(f)?.[1] ?? "").split(", ").map((s) => s.replace(/\s*\(.*\)$/, "").trim());
      const overlap = kindsIn(a).filter((k) => k && kindsIn(b).includes(k));
      expect(overlap, `${h.title}: a kind reported both ways`).toEqual([]);
    }
  });

  it("every kind called unbuilt really has no declared viewer on disk", () => {
    // THE DIRECTION THAT WENT WRONG. A kind with a viewer sitting on disk must
    // never be reported as one nobody built.
    for (const h of harnesses) {
      const f = unbuilt(h);
      if (!f) continue;
      // The finding names paths only for the undiscovered case; for this one it
      // names bare kinds, so the check is that none of them carries a path in
      // the same report — a kind with a resolvable ref belongs in the other set.
      expect(f, `${h.title}: unbuilt finding should not carry a file path`).not.toMatch(/\(\S+\.(html|md)\)/);
    }
  });

  it("every path named as undiscovered exists on disk", () => {
    // The other direction: claiming a viewer exists when it does not would be
    // the mirror defect, and would send a reader looking for a file that is
    // not there.
    let checked = 0;
    for (const h of harnesses) {
      const f = undiscovered(h);
      if (!f) continue;
      for (const m of f.matchAll(/\(([^()]+\.(?:html|md))\)/g)) {
        checked++;
        expect(existsSync(join(REPO, m[1]!)), `${h.title}: ${m[1]} named but absent`).toBe(true);
      }
    }
    // Reported rather than silently skipped: zero checked means the corpus
    // currently has no undiscovered viewer, which is a legitimate state and a
    // different one from "the assertion ran".
    expect(checked).toBeGreaterThanOrEqual(0);
  });

  it("a kind WITH a conventional path is in neither finding", () => {
    for (const h of harnesses) {
      const linked = (h.visualisations ?? []).filter((v) => v.path !== undefined).map((v) => v.kind);
      for (const kind of linked) {
        for (const f of [unbuilt(h), undiscovered(h)]) {
          if (f) expect(f, `${h.title}: ${kind} is linked yet reported`).not.toContain(` ${kind},`);
        }
      }
    }
  });
});

/*
 * THE COUNT IS PINNED AT ZERO, and that is `ha78`'s own condition:
 *
 * > whichever way, the count in `docs/_data/harness.json` drops to zero and a
 * > test pins it there — a finding that is merely rarer is not fixed
 *
 * So this is a POLICY gate, not only an honesty check: a viewer declared
 * somewhere the convention does not look fails here, rather than being
 * reported and lived with. The two repairs the bean names are the two ways to
 * pass it — publish the page at `/<handler>/<kind>/<subject>/`, or teach the
 * tile model to resolve an instance-relative ref through `withRoutes`.
 *
 * The assertions above stay exactly as they were. They pin that the REPORT is
 * honest whatever the count is, which is a different property and one that
 * still has to hold the moment somebody re-opens this case.
 */
describe.skipIf(NOT_BUILT)("no viewer is built and unreachable", () => {
  it("no harness carries an undiscovered-viewer finding", () => {
    const offenders = harnesses
      .filter((h) => undiscovered(h) !== undefined)
      .map((h) => `${h.name ?? h.title}: ${undiscovered(h)}`);
    expect(
      offenders,
      "A declared viewer exists on disk that no tile links. Either publish it at " +
        "the conventional route `/<handler>/<kind>/<subject>/` — which is what " +
        "who-iris/catalogue did for issue #886 — or resolve instance-relative refs " +
        "through `withRoutes` so the tile can follow it. Reporting it and moving on " +
        "is what bean `ha78` ruled out.",
    ).toEqual([]);
  });
});

const NO_IRIS = NOT_BUILT || absentAbove(["who-iris"]);
describe.skipIf(NO_IRIS)("who-iris/catalogue — the case that exposed it, now closed", () => {
  /* FOUND BY `name`, NOT BY `title`, and the difference cost a red gate.
   *
   * This looked up `title === "who-iris"` and stopped matching on 2026-09-22,
   * when bean `t3n8` gave every layer a declared DISPLAY title and
   * who-iris became "WHO IRIS". `find` returned undefined, and all three
   * assertions below failed on a repository where nothing about viewers had
   * changed.
   *
   * `title` is a display string the owner may rewrite at any time; `name` is
   * the layer's directory and is what every other consumer joins on. A
   * test keyed to a label is a test that fails when somebody renames a tab.
   */
  const iris = harnesses.find((h) => h.name === "who-iris");

  it("who-iris is in the report", () => {
    expect(iris).toBeDefined();
  });

  it("its catalogue viewer is LINKED, not merely un-reported", () => {
    /* THE POSITIVE ASSERTION, because the finding's absence is not the goal.
     *
     * This test used to require the built-but-unlinked finding to be PRESENT,
     * which was right while the gap was open: the report naming the gap was
     * the property worth pinning. Issue #886 closed it by moving the page to
     * the conventional route, so the finding is gone — and a test that only
     * checked it was gone would pass just as happily if the viewer had been
     * DELETED, or if the declaration had been quietly dropped.
     *
     * So the assertion is that the tile carries a path. That is the fact a
     * reader gets: something to click.
     */
    const v = (iris!.visualisations ?? []).find((x) => x.kind === "catalogue");
    expect(v, "who-iris declares a catalogue graph; the report should carry it").toBeDefined();
    expect(v!.path, "the catalogue tile has no path, so nothing links the viewer").toBeDefined();
  });

  it("and is reported as neither unbuilt nor undiscovered", () => {
    for (const f of [unbuilt(iris!), undiscovered(iris!)]) {
      if (f) expect(f).not.toContain("catalogue");
    }
  });
});

const NO_IGS = NOT_BUILT || absentAbove(["smart-trust", "smart-base"]);
describe.skipIf(NO_IGS)("fhir-artifact-index — a viewer inside a COMPOSED directory is linked", () => {
  /* Stage C of the smart-* separation (#1767). `gen-ig-pages` writes each IG
   * layer's artefact index to `<instance>/docs/index.md`, which
   * `compose-docs` publishes at `/<instance>/`. That ref is instance-relative,
   * not under the site prefix, so until the tile generator routed refs under a
   * `composed: true` directory it reported the page as "not at a conventional
   * path" — the finding the gate above pins at zero.
   *
   * Positive, for the reason the who-iris case gives: the finding's absence
   * would equally follow from the viewer being deleted.
   *
   * smart-trust's docs are `igSite` since bean `mftp`: its artefact index is
   * the IG site's own `artifacts` page, and the committed `docs/artifacts.md`
   * that carries the viewer declaration is laid onto it at build time.
   */
  // Since 2026-10-09 the tile opens the visualiser smart-base DECLARES over
  // the kind, per layer — `/smart-base/artifact-index/<instance>/`, a
  // route page that opens the IG site's own `artifacts` page. The IG keeps
  // its URL; the tile links the declared route (owner: "<base URL>/<harness>/
  // <visualizer>/<sub-graph>").
  // Not smart-immunizations: it declares no directories in this index since
  // the owner's B1 ruling (2026-10-15, `directories: []`).
  it.each(["smart-trust", "smart-base"])("%s's fhir-artifact-index tile links its declared route, which opens its IG site's artifacts page", (name) => {
    const h = harnesses.find((x) => x.name === name);
    expect(h, `${name} is not in the report`).toBeDefined();
    const v = (h!.visualisations ?? []).find((x) => x.kind === "fhir-artifact-index");
    expect(v?.path).toBe(`/smart-base/artifact-index/${name}/`);
  });
});
