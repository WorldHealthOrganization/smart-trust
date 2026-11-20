/**
 * No file gains a hardcoded path that `harness.json` already declares.
 *
 * ## Why a test and not a CI flag
 *
 * Same answer as `activity-skill-coverage.test.ts`: the property was just
 * established and this asserts exactly it. The gate itself ships as a
 * ratchet — 125 sites of recorded debt that may only shrink — so what a test
 * can pin down is the *shape* of the property, not a clean slate.
 *
 * ## The three assertions, and what each would miss alone
 *
 *  - **The scan is non-empty.** Without it, renaming a source directory turns
 *    every assertion below into a vacuous pass. Same guard its sibling opens
 *    with, and for the same reason.
 *  - **No file exceeds its baseline.** The ratchet.
 *  - **Every marked site carries a reason.** The exemption is the escape
 *    hatch, and an exemption with no reason is a rubber stamp — the rule
 *    `<folio:no-skill reason="…"/>` already enforces at load time.
 *  - **Every literal classed as an artefact dereferences.** The classifier
 *    only admits a literal that resolved when it ran; re-asserting it here is
 *    what makes the `blv9` close (a link-shaped value that does not
 *    dereference) a property of the corpus rather than of one run.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { absentResultDirs, isTestFile, newWitnesses, relocatedWitnesses, scanDeclaredPaths, storedResultDirs, underAbsentResults, underBuiltAtPublish, witnessesOf } from "../../check-declared-paths.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../lib/roots.ts";

const root = resolve(HARNESS_ROOT);
const scan = scanDeclaredPaths(root);

/**
 * A recorded witness whose literal points into a declared `qa`/`health`
 * directory that is ABSENT from this checkout cannot be verified here — the
 * gate's own rule (`isUnverifiable` in `check-declared-paths.ts`), applied
 * the same way so the test does not assert on the committed QA corpus being
 * present (bean `cxcn`, reader audit F7). Unverifiable, never "resolves".
 */
const absentResults = [...new Set([...absentResultDirs(root), ...storedResultDirs(root)])];
const recordedWitnesses = new Set(
  (JSON.parse(readFileSync(join(TOOLS_ROOT, "scripts", "declared-path-baseline.json"), "utf-8")) as { resolves?: string[] }).resolves ?? [],
);
const unverifiable = (file: string, literal: string): boolean =>
  recordedWitnesses.has(`${file}::${literal}`) && underAbsentResults(root, literal, absentResults);

describe("declared-path literals", () => {
  test("the scan saw something — otherwise nothing below proves anything", () => {
    expect(scan.prefixes.length).toBeGreaterThan(5);
    expect(scan.artefacts.length + scan.marked.length + scan.refused.length).toBeGreaterThan(100);
  });

  test("no file exceeds its recorded baseline", () => {
    const baselinePath = join(TOOLS_ROOT, "scripts", "declared-path-baseline.json");
    expect(existsSync(baselinePath), "the ratchet needs a committed baseline").toBe(true);
    const prior = (JSON.parse(readFileSync(baselinePath, "utf-8")) as { files: Record<string, number> }).files;

    // Test files are governed by the witness list, not by this count — see
    // `witnessesOf`, and the guard below that pins it.
    const current: Record<string, number> = {};
    for (const r of scan.refused) {
      if (isTestFile(r.file) || unverifiable(r.file, r.literal)) continue;
      current[r.file] = (current[r.file] ?? 0) + 1;
    }

    const over = Object.entries(current)
      .filter(([f, n]) => n > (prior[f] ?? 0))
      .map(([f, n]) => `${f}: ${prior[f] ?? 0} → ${n}`);
    expect(over, "read the declaration, or mark the site with a reason").toEqual([]);
  });

  test("every exemption carries a reason", () => {
    const bare = scan.marked.filter((m) => m.reason.trim().length < 10).map((m) => `${m.file}:${m.line}`);
    expect(bare, "`declared-path-literal:` with no reason is a rubber stamp").toEqual([]);
  });

  /**
   * This replaces an assertion that was **structurally vacuous**, found
   * 2026-09-20 (bean `dhol`). It read:
   *
   *     const dead = scan.artefacts.filter((a) => !existsSync(join(root, a.literal)));
   *     expect(dead).toEqual([]);
   *
   * `scanDeclaredPaths` admits a literal to `artefacts` only when `existsSync`
   * is true, so the filter could never match. Worse than useless: relocate an
   * artefact and its literal silently leaves `artefacts` for `refused`, and
   * the assertion goes on passing over a shorter list — reporting health while
   * the exact defect it names happens underneath it.
   *
   * The witness list is what makes it mean something: membership is COMMITTED,
   * so a literal that stops resolving is missing from a set we already wrote
   * down rather than absent from a set we recompute.
   */
  test("every witnessed literal still resolves", () => {
    const baseline = JSON.parse(
      readFileSync(join(TOOLS_ROOT, "scripts", "declared-path-baseline.json"), "utf-8"),
    ) as { resolves?: string[] };
    const recorded = baseline.resolves ?? [];
    expect(recorded.length, "no witnesses recorded — the relocation guard is vacuous").toBeGreaterThan(50);

    const held = new Set(witnessesOf(scan));
    const lost = recorded.filter((w) => {
      if (held.has(w)) return false;
      const at = w.indexOf("::");
      // A publish-time artefact this checkout has not built is held by its
      // declaration, as in the gate (`underBuiltAtPublish`).
      return !unverifiable(w.slice(0, at), w.slice(at + 2)) && !underBuiltAtPublish(root, w.slice(at + 2));
    });
    expect(lost, "an artefact moved and the code naming it was not updated").toEqual([]);
  });

  test("a witness naming a declared publish-time artefact is held by the declaration", () => {
    // cat-harness declares uml/overview/ builtAtPublish (owner, 2026-10-14, B1).
    // declared-path-literal: test vectors for the builtAtPublish rule — paths the declaration names, asserted as such; whether they are on disk is what the rule is about.
    expect(underBuiltAtPublish(root, "uml/overview/cat-harness.mmd")).toBe(true);
    expect(underBuiltAtPublish(root, "docs/uml/overview/cat-harness.md")).toBe(true);
    expect(underBuiltAtPublish(root, "schemas/no-such-module.ts")).toBe(false);
  });

  /**
   * Bean `gz47`, owner ruling 2026-10-04: an existing file is not a stable
   * one, because a declared subgraph's source may move. The witness list only
   * shrinks, so a literal naming an existing file that the list does not
   * record is refused. Four had passed in silence before this ran.
   */
  test("no literal names an existing file the witness list does not record", () => {
    const added = newWitnesses([...recordedWitnesses], witnessesOf(scan));
    expect(added, "read the declaration, or mark the line `declared-path-literal: <reason>`").toEqual([]);
  });

  test("newWitnesses names exactly the unrecorded ones, in order", () => {
    const recorded = ["a.ts::nowhere/one.md", "b.ts::nowhere/two.md"];
    expect(newWitnesses(recorded, recorded)).toEqual([]);
    expect(newWitnesses(recorded, ["a.ts::nowhere/one.md", "c.ts::nowhere/three.md"])).toEqual(["c.ts::nowhere/three.md"]);
    // A witness that went is `lost`'s business, not this one's.
    expect(newWitnesses(recorded, ["b.ts::nowhere/two.md"])).toEqual([]);
  });

  /**
   * A move carries a witness; an edit does not (cat-harness #286 split
   * `tools/index.ts` into `tools/<id>/<id>.ts`). Falsified both ways: an
   * edited literal pairs with nothing, and one lost witness hands on to one
   * new one, never two.
   */
  test("relocatedWitnesses pairs a lost witness with the same literal in another file, one to one", () => {
    const lost = ["tools/index.ts::schemas/a.ts", "tools/index.ts::schemas/b.ts"];
    const added = ["tools/a/a.ts::schemas/a.ts", "tools/x/x.ts::schemas/a.ts", "tools/c/c.ts::schemas/c.ts"];
    expect(relocatedWitnesses(lost, added)).toEqual([{ from: "tools/index.ts::schemas/a.ts", to: "tools/a/a.ts::schemas/a.ts" }]);
    // `schemas/b.ts` edited to `schemas/c.ts` is a new literal, not a move.
    expect(relocatedWitnesses(["tools/index.ts::schemas/b.ts"], ["tools/c/c.ts::schemas/c.ts"])).toEqual([]);
  });

  /**
   * The false-fire case, pinned. A test that builds a fixture tree names
   * declared directories by necessity, and those literals correctly resolve to
   * nothing. Counting them would fire on every new test — which is the "a
   * check that cries wolf is a check somebody switches off" failure this
   * module's header names twice. Measured the same hour: a sibling's
   * `schemas/folio-dir.test.ts`, merged from main, tripped the count with two
   * literals that were both entirely correct.
   */
  test("a test file's unresolved literals are not counted as debt", () => {
    const baseline = JSON.parse(
      readFileSync(join(TOOLS_ROOT, "scripts", "declared-path-baseline.json"), "utf-8"),
    ) as { files: Record<string, number> };
    const counted = Object.keys(baseline.files).filter((f) => f.endsWith(".test.ts"));
    expect(counted, "tests belong to the witness list, not the count ratchet").toEqual([]);

    const unresolvedInTests = scan.refused.filter((r) => r.file.endsWith(".test.ts"));
    expect(
      unresolvedInTests.length,
      "no unresolved test literals at all — this guard is not exercising anything",
    ).toBeGreaterThan(50);
  });

  /**
   * `*.test.ts` was skipped from this module's first commit with no reason
   * recorded anywhere, and cost three breakages before anyone asked (bean
   * `dhol`). The worst was a test that composed a path to a moved diagram,
   * went ENOENT, and reported a FALSE FINDING ABOUT THE CORPUS.
   *
   * An exclusion that was never argued can be re-added by anyone who finds
   * the 407 test literals startling, and the startle is legitimate — so the
   * argument has to be pinned somewhere a re-adder trips over. The module
   * header carries it; this carries the consequence.
   */
  test("tests are scanned — the exclusion cost three breakages and had no reason", () => {
    const fromTests = [...scan.refused, ...scan.artefacts, ...scan.marked]
      .filter((s) => s.file.endsWith(".test.ts"));
    expect(fromTests.length, "*.test.ts is being skipped again — read the module header").toBeGreaterThan(100);
  });

  /**
   * The protection the inclusion actually buys, as a property rather than as
   * one run's result: a test naming a real artefact is checked to dereference,
   * so relocating that artefact without updating the test raises the file
   * above baseline. Verified by moving `crdm-deliver.bpmn` and watching
   * `bpmn-translate.test.ts` go 0 → 1.
   *
   * Asserted as a floor and not a count: the number churns with every test
   * that names a diagram, and a count in a test is the claim this repo
   * already refuses in prose.
   */
  test("test literals naming real artefacts are checked to dereference", () => {
    const guarded = scan.artefacts.filter((a) => a.file.endsWith(".test.ts"));
    expect(guarded.length, "no test names a real artefact — the relocation guard is vacuous").toBeGreaterThan(20);
  });
});

describe("a witness under an ABSENT results tree is unknown, not lost (bean `c8uq`)", () => {
  test("only a literal INSIDE an absent results directory qualifies", () => {
    const root = join("/", "r");
    const absent = [join(root, "test", "results"), join(root, "test", "health", "results") + "/"];
    // declared-path-literal: test vectors under the fixture root `/r`, never this checkout's; what they
    // name in a real layer is the qa working copy, which is not committed (bean `7mwa`).
    expect(underAbsentResults(root, "test/results/kg-qa.manifest.json", absent)).toBe(true);
    expect(underAbsentResults(root, "test/health/results/example.health-report.json", absent)).toBe(true);
    // A sibling whose name merely STARTS with the directory's is not inside it.
    expect(underAbsentResults(root, "test/results-old/x.json", absent)).toBe(false);
    expect(underAbsentResults(root, "processes/x.bpmn", absent)).toBe(false);
  });

  test("absentResultDirs names only declared qa/health directories that are missing", () => {
    // In this checkout the results trees are committed, so none is absent; the
    // gate's absent-corpus behaviour is exercised by moving them aside, which
    // a test must not do (bean `ymsu`).
    const root = resolve(HARNESS_ROOT);
    for (const d of absentResultDirs(root)) expect(existsSync(d)).toBe(false);
  });
});
