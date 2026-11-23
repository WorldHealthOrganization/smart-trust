/**
 * The no-upward-reference rule, exercised on SYNTHETIC trees.
 *
 * **Never the real corpus, and that is a measured constraint rather than a
 * preference.** A prior session's tests walked the real tree five times and
 * pushed a sibling test past its 5 s timeout. Every tree here is three or
 * four tiny files in a temp directory, built to make exactly one distinction
 * and thrown away — so a failure names a rule rather than a file somebody
 * edited, and the suite costs milliseconds.
 *
 * The pure half (`schemas/kg/reference-direction.ts`) needs no tree at all,
 * which is why it is a separate module.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ancestorsOf, flattenDependencies } from "../../../schemas/kg/dependency-order.ts";
import { allowedFromNeeds, type LayerRule } from "../../../schemas/kg/layer-direction.ts";
import {
  classifyReference,
  occurrencesOf,
  type NameCollision,
  type Occurrence,
  type ReferenceExemption,
} from "../../../schemas/kg/reference-direction.ts";
import {
  analyse,
  buildDirectionResult,
  CENSUS_FAMILY,
  CHECK_FAIL_ON_NEW,
  declaresTranslationMirror,
  DATED_PROPOSAL_INDEX_ROW,
  DATED_PROPOSAL_RECORD,
  declaresSubgraphIndex,
  SUBGRAPH_INDEX_BEGIN,
  DEFINITION_NAMES_IMPLEMENTATION,
  DEFINITION_POINTS_TO_IMPLEMENTATION_JSON,
  DEFINITION_POINTS_TO_IMPLEMENTATION_MD,
  DEFINITION_POINTS_TO_IMPLEMENTATION_TS,
  exemptionCounts,
  movedTo,
  rekeyMovedPairs,
  subgraphMachineWritten,
  rekeyToolSplits,
  type MoveEvidence,
  EXEMPTIONS_DECLARED,
  INSTANCE_UPLOADS_DATA,
  PROVENANCE_LOG,
  directionCensus,
  directionSidecarState,
  directionStates,
  SIDECAR_STEM,
  type PendingEntry,
  WORKFLOW_USES_ADDRESS,
} from "../../check-reference-direction.ts";
import { judgeQaResult, qaResultPath, writeQaResult, type QaResult } from "../../qa-results.ts";

// ── The rule, with no filesystem ────────────────────────────────

/** `low` <- `mid` <- `high`: each needs the one before, so references may only point DOWN. */
const NEEDS = new Map<string, readonly string[] | undefined>([
  ["low", []],
  ["mid", ["low"]],
  ["high", ["mid"]],
  ["floating", undefined],
]);
const RULE: LayerRule = {
  allowed: allowedFromNeeds(
    NEEDS,
    ancestorsOf(
      flattenDependencies(
        [...NEEDS].map(([id, needs]) => ({ id, needs: [...(needs ?? [])], fatal: false })),
      ).order,
    ),
  ),
};
const occ = (from: string, to: string, text = "some prose", file = "a.md"): Occurrence => ({
  file,
  line: 1,
  text,
  from,
  to,
});
/** No collision at all: the target's name is not the repository's, so the arrow decides. */
const never = (): NameCollision | undefined => undefined;

describe("occurrencesOf is bounded, because one instance name may prefix another", () => {
  test("a name inside a longer name is NOT an occurrence of it", () => {
    // The whole 6,778-vs-3,651 discrepancy in the opening measurement.
    expect(occurrencesOf("see folio-assistant-core for this", "folio-assistant")).toEqual([]);
  });

  test("the longer name IS found on that same line", () => {
    expect(occurrencesOf("see folio-assistant-core for this", "folio-assistant-core")).toHaveLength(1);
  });

  test("ordinary punctuation and path separators still bound a name", () => {
    for (const line of ["`smart-base`", "smart-base/schemas/x.ts", "(smart-base)", "smart-base."]) {
      expect(`${line}: ${occurrencesOf(line, "smart-base").length}`).toBe(`${line}: 1`);
    }
  });

  test("one occurrence per LINE, so a line is never counted twice for one name", () => {
    expect(occurrencesOf("smart-base and smart-base again", "smart-base")).toHaveLength(1);
  });

  test("line numbers are 1-based and point at the right line", () => {
    expect(occurrencesOf("a\nb\nsmart-base\n", "smart-base")[0]!.line).toBe(3);
  });
});

describe("classifyReference follows the dependency arrow", () => {
  test("naming what you depend on is allowed", () => {
    expect(classifyReference(occ("high", "mid"), RULE, never).verdict).toBe("allowed");
  });

  test("naming it TRANSITIVELY is allowed too — the rule is the closure, not the direct edge", () => {
    expect(classifyReference(occ("high", "low"), RULE, never).verdict).toBe("allowed");
  });

  test("naming an instance that depends on you is wrong-direction", () => {
    const v = classifyReference(occ("low", "high"), RULE, never);
    expect(v.verdict).toBe("wrong-direction");
    expect(v.basis).toContain("may not name it");
  });

  test("an instance that declares no `needs` is undetermined, never clean and never a finding", () => {
    // `[]` is the floor; absent is nobody-has-said. Collapsing the two would
    // make every undeclared layer look either tangled or spotless.
    expect(classifyReference(occ("floating", "high"), RULE, never).verdict).toBe("undetermined");
  });
});

describe("a name colliding with the repository's is decided per OCCURRENCE, not per name", () => {
  // Until 2026-09-29 this was one blanket `undetermined` for the whole name,
  // which was 78 % of every occurrence in the real corpus. The resolver now
  // says which of three things THIS occurrence is, and each answer has a
  // different consequence — which is the whole point of having three.
  const collides = (answer: NameCollision) => (o: Occurrence) =>
    o.to === "high" ? answer : undefined;

  test('"unknown" is still `undetermined` — the honest residue survives', () => {
    // A bare prose mention: no path, no URL, nothing to tell the repository
    // from the layer. This test exists so the third state cannot be
    // optimised away as unreachable.
    const v = classifyReference(occ("low", "high"), RULE, collides("unknown"));
    expect(v.verdict).toBe("undetermined");
    expect(v.basis).toContain("repository's name");
  });

  test('"unknown" is not called clean either: it does NOT become `allowed`', () => {
    expect(classifyReference(occ("low", "high"), RULE, collides("unknown")).verdict).not.toBe("allowed");
  });

  test('"unknown" outranks every exemption, so no exemption can silently claim the credit', () => {
    const always: ReferenceExemption[] = [{ pattern: /.*/, reason: "would swallow everything" }];
    expect(classifyReference(occ("low", "high"), RULE, collides("unknown"), always).verdict).toBe("undetermined");
  });

  test('"repository" is `names-repository` — judged, and owing no direction', () => {
    const v = classifyReference(occ("low", "high"), RULE, collides("repository"));
    expect(v.verdict).toBe("names-repository");
    expect(v.basis).toContain("not a layer");
  });

  test('"repository" is NOT `allowed`, `exempt` or `undetermined` — it is its own statement', () => {
    const always: ReferenceExemption[] = [{ pattern: /.*/, reason: "would swallow everything" }];
    const v = classifyReference(occ("low", "high"), RULE, collides("repository"), always);
    expect(v.verdict).toBe("names-repository");
  });

  test('"instance" falls THROUGH to the arrow, so it can be wrong-direction', () => {
    // The case the blanket could not reach: a real reference to the layer
    // whose name happens to be the repository's.
    const v = classifyReference(occ("low", "high"), RULE, collides("instance"));
    expect(v.verdict).toBe("wrong-direction");
  });

  test('"instance" pointing DOWN the arrow is allowed, like any other reference', () => {
    const down = (o: Occurrence) => (o.to === "low" ? "instance" as const : undefined);
    expect(classifyReference(occ("high", "low"), RULE, down).verdict).toBe("allowed");
  });

  test('"instance" can be exempted, which the blanket verdict made impossible', () => {
    const url: ReferenceExemption[] = [{ pattern: /https?:\/\//, reason: "an address, not a reference" }];
    const v = classifyReference(occ("low", "high", "see https://x/high"), RULE, collides("instance"), url);
    expect(v.verdict).toBe("exempt");
  });
});

describe("exemptions are consulted only for a reference the rule would refuse", () => {
  const url: ReferenceExemption[] = [{ pattern: /https?:\/\//, reason: "an address, not a reference" }];

  test("a refused reference on an exempt line is exempt, carrying its reason", () => {
    const v = classifyReference(occ("low", "high", "see https://x/high"), RULE, never, url);
    expect(v.verdict).toBe("exempt");
    expect(v.basis).toContain("an address, not a reference");
  });

  test("an ALLOWED reference is never reported as exempt — which is what lets a caller find a stale exemption", () => {
    expect(classifyReference(occ("high", "low", "see https://x/low"), RULE, never, url).verdict).toBe("allowed");
  });

  test("a file-scoped exemption matches on the file, not the line", () => {
    const tests: ReferenceExemption[] = [{ file: /\.test\.ts$/, reason: "a test may reach anywhere" }];
    expect(classifyReference(occ("low", "high", "x", "a/b.test.ts"), RULE, never, tests).verdict).toBe("exempt");
    expect(classifyReference(occ("low", "high", "x", "a/b.ts"), RULE, never, tests).verdict).toBe("wrong-direction");
  });

  test("an exemption scoped to another target does not fire", () => {
    const other: ReferenceExemption[] = [{ pattern: /.*/, to: "mid", reason: "only mid" }];
    expect(classifyReference(occ("low", "high"), RULE, never, other).verdict).toBe("wrong-direction");
  });
});

// ── The scan, over a tree built for the purpose ─────────────────

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A repository holding `low` <- `high`, plus whatever files the caller wants. */
function tree(files: Record<string, string>, lowDirs: unknown[] = [], highDirs: unknown[] = []): string {
  const root = mkdtempSync(join(tmpdir(), "refdir-"));
  made.push(root);
  const decl = (name: string, needs: string[] | undefined, dirs: unknown[] = []) => {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(
      join(root, name, `${name}.json`),
      JSON.stringify({ name, ...(needs === undefined ? {} : { needs }), directories: dirs }),
    );
  };
  decl("low", [], lowDirs);
  decl("high", ["low"], highDirs);
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
}
const verdicts = (root: string) =>
  analyse(root).classified.map((c) => `${c.occurrence.file} ${c.verdict.verdict}`);

describe("analyse over a synthetic tree", () => {
  test("a lower instance naming a higher one is a finding", () => {
    expect(verdicts(tree({ "low/notes.md": "this is about high\n" }))).toEqual(["low/notes.md wrong-direction"]);
  });

  test("a higher instance naming a lower one is not", () => {
    expect(analyse(tree({ "high/notes.md": "this is about low\n" })).classified).toEqual([]);
  });

  test("a file belongs to the INNERMOST declaring root that contains it", () => {
    // `high/` sits inside the repository root but is its own layer, so its
    // files are high's — not the root's, and not counted for both.
    const r = tree({ "high/deep/nested/notes.md": "about low\n" });
    expect(analyse(r).classified).toEqual([]);
  });

  test("a directory DECLARED to hold a machine-written graph is not read", () => {
    const files = { "low/out/index.json": '{"x":"high"}\n', "low/notes.md": "about high\n" };
    // `qa` holds "state" — written by a process as it runs.
    const r = tree(files, [{ id: "out", path: "out/", graphTypologies: ["qa"] }]);
    expect(verdicts(r)).toEqual(["low/notes.md wrong-direction"]);
    expect(analyse(r).skippedMachineWritten).toBe(1);
  });

  test("a route another harness builds on this instance's site (builtOnHostSite) is not read as this instance's", () => {
    // `high`'s viewer built into `low`'s site: the page names `high`'s own
    // material, and `low` declares none of it.
    const files = { "low/docs/en/high/bibliography/references.jsonld": '{"x":"high"}\n', "low/notes.md": "about high\n" };
    const r = tree(files);
    expect(verdicts(r).sort()).toEqual(["low/docs/en/high/bibliography/references.jsonld wrong-direction", "low/notes.md wrong-direction"]);
    const withHostSite = analyse(r, [join(r, "low/docs/en/high/bibliography")]);
    expect(withHostSite.classified.map((c) => c.occurrence.file)).toEqual(["low/notes.md"]);
    expect(withHostSite.skippedMachineWritten).toBe(1);
  });

  test("a tree with no builtOnHostSite visualiser derives no host-site route", () => {
    expect(analyse(tree({ "low/notes.md": "about high\n" })).skippedMachineWritten).toBe(0);
  });

  test("a directory holding an AUTHORED graph is read — the exclusion is the declaration, not the shape", () => {
    const files = { "low/out/index.json": '{"x":"high"}\n' };
    // `docs` holds "content". Same file, same name, different declaration.
    const r = tree(files, [{ id: "out", path: "out/", graphTypologies: ["docs"] }]);
    expect(verdicts(r)).toEqual(["low/out/index.json wrong-direction"]);
  });

  test("an instance with no declared `needs` is reported as undeclared rather than assumed", () => {
    const root = mkdtempSync(join(tmpdir(), "refdir-"));
    made.push(root);
    for (const [n, body] of [["low", { name: "low", needs: [] }], ["adrift", { name: "adrift" }]] as const) {
      mkdirSync(join(root, n), { recursive: true });
      writeFileSync(join(root, n, `${n}.json`), JSON.stringify(body));
    }
    expect(analyse(root).undeclared).toEqual(["adrift"]);
  });

  test("a broken needs graph is REFUSED, not walked — a partial closure reports allowed references as findings", () => {
    const root = mkdtempSync(join(tmpdir(), "refdir-"));
    made.push(root);
    for (const [a, b] of [["x", "y"], ["y", "x"]]) {
      mkdirSync(join(root, a), { recursive: true });
      writeFileSync(join(root, a, `${a}.json`), JSON.stringify({ name: a, needs: [b] }));
    }
    expect(() => analyse(root)).toThrow(/needs graph is broken/);
  });
});

describe("a file whose own `$schema` is declared `generated` is not read", () => {
  /** `folio-schema-graph/v1` is declared `generated: true` in the graph-typology registry. */
  const GENERATED = "folio-schema-graph/v1";

  test("it is skipped even though its DIRECTORY holds authored content", () => {
    // The 429-false-finding case: a generator's output sitting in a `docs`
    // graph, which is `content` because the directory holds documentation.
    const r = tree({ "low/index.json": JSON.stringify({ $schema: GENERATED, x: "high" }) }, [
      { id: "d", path: "", graphTypologies: ["docs"] },
    ]);
    expect(analyse(r).classified).toEqual([]);
    expect(analyse(r).skippedGeneratorWritten).toBe(1);
  });

  test("an AUTHORED family is read — `folio-intake/v1` is not declared generated", () => {
    // It was skipped while the checker read `writtenBy`, which for this family
    // named its CONSUMER (library-graph.ts reads intake files; nothing writes them).
    const r = tree({ "low/index.json": JSON.stringify({ $schema: "folio-intake/v1", x: "high" }) }, [
      { id: "d", path: "", graphTypologies: ["docs"] },
    ]);
    expect(analyse(r).skippedGeneratorWritten).toBe(0);
    expect(verdicts(r)).toEqual(["low/index.json wrong-direction"]);
  });

  test("the same file with an UNDECLARED $schema is read", () => {
    const r = tree({ "low/index.json": JSON.stringify({ $schema: "something-nobody-declared/v1", x: "high" }) });
    expect(verdicts(r)).toEqual(["low/index.json wrong-direction"]);
  });

  test("only a TOP-LEVEL $schema counts — a file that MENTIONS one is still read", () => {
    // `docs/assets/schemas/index.json` carries `generatedAt` four times as a
    // field NAME inside a schema projection. What a file is, not what it names.
    const r = tree({ "low/notes.json": JSON.stringify({ describes: { $schema: GENERATED }, x: "high" }) });
    expect(verdicts(r)).toEqual(["low/notes.json wrong-direction"]);
  });

  test("an unparseable JSON file is read rather than skipped — a broken file is not a licence", () => {
    const r = tree({ "low/broken.json": "{ this is not json, and it mentions high" });
    expect(verdicts(r)).toEqual(["low/broken.json wrong-direction"]);
  });
});

describe("a file that DECLARES itself generated is not read", () => {
  test('a top-level "_generated" key in JSON — the convention sync-docs-harness.ts already emits', () => {
    const r = tree({ "low/d.json": JSON.stringify({ _generated: "scripts/x.ts", v: "high" }) });
    expect(analyse(r).classified).toEqual([]);
  });

  test("`generated:` front matter in Markdown — what the docs/reference mirrors now carry", () => {
    const r = tree({ "low/p.md": "---\nlayout: default\ngenerated: scripts/x.ts — do not hand-edit\n---\n\nabout high\n" });
    expect(analyse(r).classified).toEqual([]);
  });

  test("front matter with NO generated key is read", () => {
    expect(verdicts(tree({ "low/p.md": "---\nlayout: default\n---\n\nabout high\n" }))).toEqual(["low/p.md wrong-direction"]);
  });

  test("a page that merely DISCUSSES generation cannot exempt itself", () => {
    // The marker is front matter, not a word anywhere in the text.
    const r = tree({ "low/p.md": "# On generators\n\ngenerated: is a front-matter key. This page is about high.\n" });
    expect(verdicts(r)).toEqual(["low/p.md wrong-direction"]);
  });

  test('"_generated" nested deeper in the JSON does not count', () => {
    const r = tree({ "low/d.json": JSON.stringify({ describes: { _generated: "x" }, v: "high" }) });
    expect(verdicts(r)).toEqual(["low/d.json wrong-direction"]);
  });
});

// NO TEST OVER THE REAL TREE, and PENDING is the case that most invites one.
//
// Staleness both ways -- a listed file that no longer leaks, and an unlisted
// file that does -- is enforced by the CHECK, which exits 1 on either and
// runs in CI on every push. A test asserting the same thing would add a
// second full walk of the corpus for no extra coverage. Measured when it was
// briefly written that way: 5.89s for this file, against 198ms without it,
// and a sibling test's budget is 5s.

describe("the repository-name collision, resolved from the occurrence and the declaration", () => {
  // The root layer's name IS the repository's name, so a name match alone
  // cannot tell the two apart. What the occurrence CARRIES can: a URL around
  // it, an owner in front of it, a declared directory after it. On main
  // 2026-09-29 the blanket version of this test returned `undetermined` for
  // 11,090 of 14,299 occurrences — 78 % — of which 14 pointed into a directory
  // the root layer actually declares.
  //
  // `repo` here is declared AT the temp root, which is what makes it collide:
  // a layer rooted at the repository root shares the repository's name.

  /** `low` <- `repo` (rooted at the repo root, declaring `uploads/` and `tools/`) and `low` <- `high`. */
  function collidingTree(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "refdir-"));
    made.push(root);
    writeFileSync(
      join(root, "repo.json"),
      JSON.stringify({
        name: "repo",
        needs: ["low"],
        directories: [
          { id: "uploads", path: "uploads/", graphTypologies: ["docs"] },
          { id: "root-tools", path: "tools/", graphTypologies: ["code"] },
        ],
      }),
    );
    for (const [name, needs] of [["low", []], ["high", ["low"]]] as const) {
      mkdirSync(join(root, name), { recursive: true });
      writeFileSync(join(root, name, `${name}.json`), JSON.stringify({ name, needs, directories: [] }));
    }
    for (const [rel, body] of Object.entries(files)) {
      const abs = join(root, rel);
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, body);
    }
    return root;
  }
  const only = (root: string) => analyse(root).classified.map((c) => c.verdict.verdict);

  test("a URL naming the repository is `names-repository` — an address, not a layer", () => {
    expect(only(collidingTree({ "low/a.md": "see <https://litlfred.github.io/repo/guides/x.html>\n" }))).toEqual([
      "names-repository",
    ]);
  });

  test("`<owner>/<name>` is `names-repository` — a repository slug", () => {
    expect(only(collidingTree({ "low/a.md": "cloned from litlfred/repo last week\n" }))).toEqual(["names-repository"]);
  });

  test("`<name>/` before any OTHER path segment is `names-repository` — a path in the repository", () => {
    expect(only(collidingTree({ "low/a.md": "it lives at repo/docs/guides/x.md\n" }))).toEqual(["names-repository"]);
  });

  test("a path into a DECLARED directory is judged by the arrow, NOT `names-repository`", () => {
    // `uploads/` is one of the two directories `repo.json` declares, so this
    // names the LAYER. `low` is depended on by `repo`, so it may not.
    expect(only(collidingTree({ "low/a.md": "dropped in repo/uploads/x.pdf\n" }))).toEqual(["wrong-direction"]);
  });

  test("the OTHER declared directory too — it is read from the declaration, not from a literal", () => {
    expect(only(collidingTree({ "low/a.md": "the barrel is repo/tools/index.ts\n" }))).toEqual(["wrong-direction"]);
  });

  test("a URL that points INTO a declared directory is still the instance — order matters", () => {
    // Documented ordering: `instance` is tested before `repository`, so a URL
    // cannot decide this occurrence. Reversing the two would return
    // `names-repository`; instead it goes to the arrow, is refused, and is then
    // excused by the URL EXEMPTION — which carries a stated reason and is
    // counted in the summary, where the blanket verdict was neither.
    expect(only(collidingTree({ "low/a.md": "see https://x.test/repo/uploads/x.pdf\n" }))).toEqual(["exempt"]);
  });

  test("a bare prose mention is `undetermined` — the third state is still reachable", () => {
    // No path and no URL: genuinely undecidable, and this is the residue the
    // narrowing was NOT allowed to eliminate.
    const r = collidingTree({ "low/a.md": "this whole thing is about repo, in the end\n" });
    expect(only(r)).toEqual(["undetermined"]);
    expect(analyse(r).classified[0]!.verdict.basis).toContain("repository's name");
  });

  test("a NON-colliding target behaves exactly as before — the collision rule reaches nothing else", () => {
    // `high` is not rooted at the repository root, so none of the three
    // answers applies to it and every shape is judged by the arrow alone.
    for (const text of [
      "this is about high\n",
      "see https://litlfred.github.io/high/guides/x.html\n",
      "cloned from litlfred/high\n",
      "it lives at high/docs/guides/x.md\n",
    ]) {
      // The URL lines are `exempt` rather than `wrong-direction` by the URL
      // exemption, which is the pre-existing behaviour and not part of this
      // rule; what matters is that `names-repository` never appears.
      expect(only(collidingTree({ "low/a.md": text }))).not.toContain("names-repository");
    }
    expect(only(collidingTree({ "low/a.md": "this is about high\n" }))).toEqual(["wrong-direction"]);
  });
});

describe("a declared path resolves against the scope it declares, not against the declarer", () => {
  // `scope: "repository"` resolves against the REPO ROOT, via `rootForScope`.
  // 23 of the 45 entries in `cat-harness.json` carry it -- more than half,
  // including `beans/`, `todos/`, `issue-marks/` and six `*/library/` trees.
  // Composing `join(instanceRoot, path)` for those yields a directory that
  // does not exist, so nothing is excluded and every file in it is read as
  // authored prose: 923 files, measured 2026-09-24.

  test("a repository-scoped machine-written directory is excluded from ANOTHER instance's tree", () => {
    // `high` declares `low/out/` at repository scope. The files are low's by
    // tree, and they are skipped because high's declaration says a process
    // writes them.
    const r = tree({ "low/out/x.md": "about high\n", "low/keep.md": "about high\n" }, [], [
      { id: "out", path: "low/out/", scope: "repository", graphTypologies: ["qa"] },
    ]);
    expect(verdicts(r)).toEqual(["low/keep.md wrong-direction"]);
    expect(analyse(r).skippedMachineWritten).toBe(1);
  });

  test("the SAME entry at instance scope resolves under the declarer and excludes nothing", () => {
    // `high/low/out/` does not exist, so the directory is not found and
    // `low/out/x.md` is read -- the exact shape of the bug.
    const r = tree({ "low/out/x.md": "about high\n", "low/keep.md": "about high\n" }, [], [
      { id: "out", path: "low/out/", graphTypologies: ["qa"] },
    ]);
    expect(verdicts(r).sort()).toEqual(["low/keep.md wrong-direction", "low/out/x.md wrong-direction"]);
    expect(analyse(r).skippedMachineWritten).toBe(0);
  });
});

// ── The committed sidecar ───────────────────────────────────────
//
// Same constraint as everything above and for the same measured reason: every
// tree here is built for one distinction and thrown away. Nothing in this
// block reads the real corpus, and `scriptAbsPath` deliberately names a file
// that does not exist, so the producer hash is a stable `"unknown"` rather
// than a hash of whichever version of the script is on disk.

/** `low` <- `mid` <- `high`: `low` has TWO layers above it, which is what `names > 1` needs. */
function threeTier(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "refdir-"));
  made.push(root);
  for (const [name, needs] of [["low", []], ["mid", ["low"]], ["high", ["mid"]]] as const) {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, `${name}.json`), JSON.stringify({ name, needs, directories: [] }));
  }
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
}

const resultFor = (root: string, pending: PendingEntry[], now = new Date("2026-01-01T00:00:00.000Z")) =>
  buildDirectionResult({
    report: analyse(root),
    pending,
    exemptionsDeclared: 4,
    script: "scripts/producer.ts",
    scriptAbsPath: join(root, "does-not-exist.ts"),
    now,
  });

describe("directionStates records the determinations, and each one separately", () => {
  test("a file naming SEVERAL instances above it, unlisted, is the state that exits 1", () => {
    const s = directionStates(analyse(threeTier({ "low/a.md": "about mid and high\n" })), []);
    expect(s.multiDestinationUnlisted).toEqual([{ file: "low/a.md", names: 2 }]);
  });

  test("the same file LISTED is not in that set — membership is the ruling", () => {
    const r = analyse(threeTier({ "low/a.md": "about mid and high\n" }));
    expect(directionStates(r, [{ file: "low/a.md", names: 2 }]).multiDestinationUnlisted).toEqual([]);
  });

  test("a file naming ONE instance above it is not multi-destination — it has a destination", () => {
    const s = directionStates(analyse(threeTier({ "low/a.md": "about high\n" })), []);
    expect(s.multiDestinationUnlisted).toEqual([]);
  });

  test("a PENDING entry with no wrong-direction reference left is reported stale", () => {
    const s = directionStates(analyse(threeTier({ "low/a.md": "nothing to see\n" })), [
      { file: "low/a.md", names: 2 },
    ]);
    expect(s.pendingStale).toEqual([{ file: "low/a.md", why: "no wrong-direction reference left" }]);
  });

  test("a PENDING entry that now names ONE instance is reported stale too — the set is checked BOTH ways", () => {
    const s = directionStates(analyse(threeTier({ "low/a.md": "about high\n" })), [
      { file: "low/a.md", names: 2 },
    ]);
    expect(s.pendingStale.map((p) => p.why)).toEqual([
      "now names ONE instance, so it has a destination and is not pending",
    ]);
  });

  test("an instance declaring no `needs` is carried as its own state, never folded into a count", () => {
    const root = mkdtempSync(join(tmpdir(), "refdir-"));
    made.push(root);
    for (const [n, body] of [["low", { name: "low", needs: [] }], ["adrift", { name: "adrift" }]] as const) {
      mkdirSync(join(root, n), { recursive: true });
      writeFileSync(join(root, n, `${n}.json`), JSON.stringify(body));
    }
    expect(directionStates(analyse(root), []).undeclaredInstances).toEqual(["adrift"]);
  });
});

describe("the census records VERDICT counts and no FILE count", () => {
  test("the four verdicts are all recorded, `undetermined` among them", () => {
    const r = analyse(threeTier({ "low/a.md": "about mid and high\n" }));
    const c = directionCensus(r, directionStates(r, []));
    for (const k of ["wrongDirection", "exempt", "namesRepository", "undetermined"]) {
      expect(`${k} present: ${k in c}`).toBe(`${k} present: true`);
    }
    expect(c.wrongDirection).toBe(2);
  });

  test("a count of FILES is NOT recorded — it is a census and stays printed", () => {
    // `audit-coverage`'s rule, applied here rather than rediscovered: a census
    // moves on any commit that adds a page and says nothing about direction.
    const r = analyse(threeTier({ "low/a.md": "about high\n" }));
    const c = directionCensus(r, directionStates(r, []));
    expect(Object.keys(c).filter((k) => k.startsWith("skipped"))).toEqual([]);
  });

  test("`undetermined` is carried as its own number, never merged with a pass or a finding", () => {
    // `adrift` declares no `needs`, and `dep` needs it — so `dep` is above
    // `adrift` and a reference from `adrift` to `dep` is a reference whose
    // direction NOBODY has declared. It is neither clean nor a finding, and
    // the sidecar has to keep saying so: 969 occurrences land here on the real
    // corpus, all bare mentions with no path and no URL.
    const root = mkdtempSync(join(tmpdir(), "refdir-"));
    made.push(root);
    for (const [n, body] of [["adrift", { name: "adrift" }], ["dep", { name: "dep", needs: ["adrift"] }]] as const) {
      mkdirSync(join(root, n), { recursive: true });
      writeFileSync(join(root, n, `${n}.json`), JSON.stringify(body));
    }
    writeFileSync(join(root, "adrift", "a.md"), "about dep\n");
    const r = analyse(root);
    const c = directionCensus(r, directionStates(r, []));
    expect(`undet ${c.undetermined} wrong ${c.wrongDirection} allowed ${c.allowed}`).toBe("undet 1 wrong 0 allowed 0");
  });
});

describe("the sidecar is idempotent, and `--check` grades the states rather than the counts", () => {
  /** A layer root with a `test/results/` the writer can fill. */
  const instanceRoot = (): string => {
    const d = mkdtempSync(join(tmpdir(), "refdir-side-"));
    made.push(d);
    return d;
  };

  test("re-running the producer over the same tree yields the same bytes", () => {
    const corpus = threeTier({ "low/a.md": "about mid and high\n" });
    const out = instanceRoot();
    writeQaResult(out, SIDECAR_STEM, resultFor(corpus, []));
    const first = readFileSync(qaResultPath(out, SIDECAR_STEM), "utf-8");
    writeQaResult(out, SIDECAR_STEM, resultFor(corpus, [], new Date("2027-05-05T00:00:00.000Z")));
    expect(readFileSync(qaResultPath(out, SIDECAR_STEM), "utf-8")).toBe(first);
  });

  test("a fresh sidecar is `current`", () => {
    const corpus = threeTier({ "low/a.md": "about mid and high\n" });
    const out = instanceRoot();
    const fresh = resultFor(corpus, []);
    writeQaResult(out, SIDECAR_STEM, fresh);
    expect(directionSidecarState(out, fresh)).toBe("current");
  });

  test("no sidecar at all is `absent`, which is NOT `current`", () => {
    // `dh4f`: no record reading identically to a clean one is the whole defect.
    expect(directionSidecarState(instanceRoot(), resultFor(threeTier({}), []))).toBe("absent");
  });

  test("the state check does NOT write — bean `ymsu`, and this is what pins it", () => {
    const out = instanceRoot();
    directionSidecarState(out, resultFor(threeTier({ "low/a.md": "about mid and high\n" }), []));
    expect(existsSync(qaResultPath(out, SIDECAR_STEM))).toBe(false);
  });

  test("a hand-edited GRADED family is `stale`", () => {
    const corpus = threeTier({ "low/a.md": "about mid and high\n" });
    const out = instanceRoot();
    const fresh = resultFor(corpus, []);
    writeQaResult(out, SIDECAR_STEM, fresh);
    const p = qaResultPath(out, SIDECAR_STEM);
    const doc = JSON.parse(readFileSync(p, "utf-8")) as QaResult;
    doc.families["multi-destination-unlisted"]!.entries = [];
    doc.families["multi-destination-unlisted"]!.count = 0;
    writeFileSync(p, JSON.stringify(doc, null, 2) + "\n");
    expect(directionSidecarState(out, fresh)).toBe("stale");
  });

  test("a corpus whose STATES moved is `stale` — the sidecar cannot outlive its ruling", () => {
    const out = instanceRoot();
    writeQaResult(out, SIDECAR_STEM, resultFor(threeTier({ "low/a.md": "about mid and high\n" }), []));
    expect(directionSidecarState(out, resultFor(threeTier({ "low/b.md": "about mid and high\n" }), []))).toBe("stale");
  });

  test("a hand-edited CENSUS is still `current`, and that is the deliberate line", () => {
    // The counts are RECORDED so a reader can tell `audited clean` from `never
    // audited`; they are not GRADED because they move whenever anybody writes a
    // paragraph. Grading them would make a gate stale by default, which is what
    // `audit-coverage` already paid for. This test exists so that decision
    // cannot be reversed by accident.
    const corpus = threeTier({ "low/a.md": "about mid and high\n" });
    const out = instanceRoot();
    const fresh = resultFor(corpus, []);
    writeQaResult(out, SIDECAR_STEM, fresh);
    const p = qaResultPath(out, SIDECAR_STEM);
    const doc = JSON.parse(readFileSync(p, "utf-8")) as QaResult;
    (doc.families[CENSUS_FAMILY]!.entries[0] as Record<string, number>).wrongDirection = 999_999;
    writeFileSync(p, JSON.stringify(doc, null, 2) + "\n");
    expect(directionSidecarState(out, fresh)).toBe("current");
  });

  test("a producer that moved is `stale` — a result says what the code that wrote it found", () => {
    // `check:harness-state`'s rule for `health`: age is a proxy, the hash is
    // the fact. A result written by a producer that no longer exists states the
    // old code's answer.
    const corpus = threeTier({ "low/a.md": "about mid and high\n" });
    const out = instanceRoot();
    writeQaResult(out, SIDECAR_STEM, resultFor(corpus, []));
    const moved = { ...resultFor(corpus, []), producer: { script: "scripts/producer.ts", script_hash: "0123456789ab" } };
    expect(directionSidecarState(out, moved)).toBe("stale");
  });

  test("the timestamp alone never makes it stale", () => {
    const corpus = threeTier({ "low/a.md": "about mid and high\n" });
    const out = instanceRoot();
    writeQaResult(out, SIDECAR_STEM, resultFor(corpus, []));
    expect(directionSidecarState(out, resultFor(corpus, [], new Date("2030-12-31T23:59:59.000Z")))).toBe("current");
  });
});

// ── X1: a translation mirror is exempt by what the FILE declares ─

describe("X1 — a translation mirror is exempt by its own front matter, never by its path", () => {
  const mirror = (fm: string) => `---\n${fm}\n---\n\nabout high\n`;

  test("`lang:` other than en AND `translation_source:` is exempt, carrying the X1 reason", () => {
    const r = analyse(tree({ "low/fr/p.md": mirror("lang: fr\ntranslation_source: p.md") }));
    expect(r.classified.map((c) => c.verdict.verdict)).toEqual(["exempt"]);
    expect(JSON.stringify(r.classified[0]!.verdict)).toContain("X1, a TRANSLATION MIRROR");
  });

  test("`lang: en` with a `translation_source:` is still read — the English source is counted once", () => {
    expect(verdicts(tree({ "low/p.md": mirror("lang: en\ntranslation_source: p.md") }))).toEqual(["low/p.md wrong-direction"]);
  });

  test("a non-English `lang:` WITHOUT `translation_source:` is read — both halves are required", () => {
    expect(verdicts(tree({ "low/p.md": mirror("lang: fr") }))).toEqual(["low/p.md wrong-direction"]);
  });

  test("a page that merely MENTIONS the keys in its body cannot exempt itself", () => {
    const body = "# Translating\n\nlang: fr\ntranslation_source: x.md\n\nabout high\n";
    expect(verdicts(tree({ "low/p.md": body }))).toEqual(["low/p.md wrong-direction"]);
  });

  test("it is decided by the file, not the path: a locale directory alone exempts nothing", () => {
    expect(verdicts(tree({ "low/docs/fr/p.md": "about high\n" }))).toEqual(["low/docs/fr/p.md wrong-direction"]);
  });

  test("only Markdown is read for it — a JSON file with the same keys is not a mirror", () => {
    const root = tree({ "low/p.json": JSON.stringify({ lang: "fr", translation_source: "x", v: "high" }) });
    expect(declaresTranslationMirror(join(root, "low/p.json"))).toBe(false);
    expect(verdicts(root)).toEqual(["low/p.json wrong-direction"]);
  });

  test("it is consulted LAST: a line another exemption already covers keeps that exemption's reason", () => {
    const r = analyse(tree({ "low/fr/p.md": "---\nlang: fr\ntranslation_source: p.md\n---\n\nsee https://example.org/high\n" }));
    expect(r.classified).toHaveLength(1);
    expect(JSON.stringify(r.classified[0]!.verdict)).not.toContain("X1,");
  });

  test("the declared-exemption count includes it", () => {
    expect(EXEMPTIONS_DECLARED).toBeGreaterThan(0);
    const result = buildDirectionResult({
      report: analyse(tree({})),
      pending: [],
      exemptionsDeclared: EXEMPTIONS_DECLARED,
      script: "scripts/producer.ts",
      scriptAbsPath: "/does/not/exist.ts",
    });
    expect(result.families[CENSUS_FAMILY]!.summary).toContain(`${EXEMPTIONS_DECLARED} exemption(s) declared`);
  });
});

// ── A.10: every (file, target) pair is graded NEW against a baseline ─

/** Judge quietly, with the gate's own `failOnNew` list, against a baseline in `root`. */
function judgeNew(fresh: QaResult, baselineRoot: string) {
  const log = console.log;
  const err = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return judgeQaResult({
      gate: "check:reference-direction:check",
      fresh,
      failOnNew: [...CHECK_FAIL_ON_NEW],
      baseline: { root: baselineRoot, stem: SIDECAR_STEM, writer: "check:reference-direction" },
    });
  } finally {
    console.log = log;
    console.error = err;
  }
}

describe("A.10 — a wrong-direction pair NEW against the baseline fails `--check`, single or multi destination", () => {
  const baselineOf = (corpus: string): string => {
    const d = mkdtempSync(join(tmpdir(), "refdir-base-"));
    made.push(d);
    writeQaResult(d, SIDECAR_STEM, resultFor(corpus, []));
    expect(existsSync(qaResultPath(d, SIDECAR_STEM))).toBe(true);
    return d;
  };

  test("the family holds ONE entry per file and per instance above it", () => {
    const r = resultFor(threeTier({ "low/a.md": "about mid and high\n", "low/b.md": "about high\n" }), []);
    expect(r.families["wrong-direction"]!.entries).toEqual([
      { file: "low/a.md", target: "high" },
      { file: "low/a.md", target: "mid" },
      { file: "low/b.md", target: "high" },
    ]);
  });

  test("an unchanged tree is inherited, not new — exit 0", () => {
    const corpus = threeTier({ "low/a.md": "about high\n" });
    expect(judgeNew(resultFor(corpus, []), baselineOf(corpus)).exit).toBe(0);
  });

  test("a NEW file naming ONE instance above it fails — the single-destination half of A.10", () => {
    const base = baselineOf(threeTier({ "low/a.md": "about high\n" }));
    const v = judgeNew(resultFor(threeTier({ "low/a.md": "about high\n", "low/b.md": "about mid\n" }), []), base);
    expect(v.exit).toBe(1);
    expect(v.diff?.added["wrong-direction"]).toEqual([{ file: "low/b.md", target: "mid" }]);
  });

  test("a NEW file naming SEVERAL instances above it fails, one new entry per target", () => {
    const base = baselineOf(threeTier({ "low/a.md": "about high\n" }));
    const v = judgeNew(resultFor(threeTier({ "low/a.md": "about high\n", "low/c.md": "about mid and high\n" }), []), base);
    expect(v.exit).toBe(1);
    expect(v.diff?.added["wrong-direction"]).toEqual([
      { file: "low/c.md", target: "high" },
      { file: "low/c.md", target: "mid" },
    ]);
  });

  test("a KNOWN file naming a FURTHER instance fails on the added target only", () => {
    const base = baselineOf(threeTier({ "low/a.md": "about high\n" }));
    const v = judgeNew(resultFor(threeTier({ "low/a.md": "about high and mid\n" }), []), base);
    expect(v.exit).toBe(1);
    expect(v.diff?.added["wrong-direction"]).toEqual([{ file: "low/a.md", target: "mid" }]);
  });

  test("a FIXED pair is resolved, never a failure — the ratchet only tightens", () => {
    const base = baselineOf(threeTier({ "low/a.md": "about mid and high\n" }));
    const v = judgeNew(resultFor(threeTier({ "low/a.md": "about mid\n" }), []), base);
    expect(v.exit).toBe(0);
    expect(v.diff?.resolved).toBe(1);
  });

  test("a baseline that predates the family is UNKNOWN for it, never 'every pair is new'", () => {
    const corpus = threeTier({ "low/a.md": "about high\n" });
    const d = mkdtempSync(join(tmpdir(), "refdir-old-"));
    made.push(d);
    const old = resultFor(corpus, []);
    const { "wrong-direction": _dropped, ...families } = old.families;
    writeQaResult(d, SIDECAR_STEM, { ...old, families });
    const v = judgeNew(resultFor(threeTier({ "low/a.md": "about high\n", "low/b.md": "about mid\n" }), []), d);
    expect(v.exit).toBe(0);
    expect(v.unknowns.join(" ")).toContain("carries no `wrong-direction` family");
  });

  test("no baseline at all is UNKNOWN and not gated — not 'no new findings'", () => {
    const empty = mkdtempSync(join(tmpdir(), "refdir-none-"));
    made.push(empty);
    const v = judgeNew(resultFor(threeTier({ "low/b.md": "about mid\n" }), []), empty);
    expect(v.exit).toBe(0);
    expect(v.baseline.state).not.toBe("hit");
  });
});

// ── The falsifier, over the REAL tree ───────────────────────────
//
// The one test here that walks the real corpus, and it walks it ONCE: a scan
// takes 15-35 s in a contended container, so the generous timeout is the
// measured cost rather than slack. Every other test in this file stays
// synthetic for the reason the header gives.

describe("the real tree: a new doc naming two instances above it makes `--check` exit 1", () => {
  const REPO = join(import.meta.dir, "..", "..", "..", "..");
  test(
    "planted under cat-harness/docs/, it is NEW in `wrong-direction` against a baseline of the same tree without it",
    () => {
      const rel = `cat-harness/docs/zz-refdir-falsifier-${process.pid}.md`;
      const abs = join(REPO, rel);
      writeFileSync(abs, "# Falsifier\n\nThis page relies on smart-base and on who-iris.\n");
      let report: ReturnType<typeof analyse>;
      try {
        report = analyse(REPO);
      } finally {
        rmSync(abs, { force: true });
      }
      const without = { ...report, classified: report.classified.filter((c) => c.occurrence.file !== rel) };
      const mk = (r: typeof report) =>
        buildDirectionResult({ report: r, pending: [], exemptionsDeclared: EXEMPTIONS_DECLARED, script: "s.ts", scriptAbsPath: "/no/such.ts" });
      const base = mkdtempSync(join(tmpdir(), "refdir-real-"));
      made.push(base);
      writeQaResult(base, SIDECAR_STEM, mk(without));
      // Vacuity guard: the same tree WITHOUT the planted file passes.
      expect(judgeNew(mk(without), base).exit).toBe(0);
      const v = judgeNew(mk(report), base);
      expect(v.exit).toBe(1);
      expect(v.diff?.added["wrong-direction"]).toEqual([
        { file: rel, target: "smart-base" },
        { file: rel, target: "who-iris" },
      ]);
    },
    180_000,
  );
});

// ── Ruling (ii): a harness definition may name its tools script ──

describe("X4 — Markdown in cat-harness may name a cat-harness-tools script (owner, 2026-10-11, ruling (ii))", () => {
  // cat-harness <- cat-harness-tools <- smart-base: the harness names neither.
  const LAYERS = new Map<string, readonly string[]>([
    ["cat-harness", []],
    ["cat-harness-tools", ["cat-harness"]],
    ["smart-base", ["cat-harness-tools"]],
  ]);
  const LAYER_RULE: LayerRule = {
    allowed: allowedFromNeeds(
      LAYERS,
      ancestorsOf(flattenDependencies([...LAYERS].map(([id, needs]) => ({ id, needs: [...needs], fatal: false }))).order),
    ),
  };
  const verdict = (file: string, text: string, to = "cat-harness-tools") =>
    classifyReference(occ("cat-harness", to, text, file), LAYER_RULE, never, [DEFINITION_NAMES_IMPLEMENTATION]).verdict;
  const SKILL = "cat-harness/sdlc/skills/sdlc-core/x.md";

  test("a skill's command line naming a tools script is exempt", () => {
    expect(verdict(SKILL, "bun run cat-harness-tools/scripts/qa-refresh.ts --check")).toBe("exempt");
    expect(verdict(SKILL, "see `cat-harness-tools/scripts/partition/engine.ts` and `cat-harness-tools/scripts/gates.ts`")).toBe("exempt");
    expect(verdict(SKILL, "bun run <platform>/cat-harness-tools/archimate/scripts/check-archimate.ts --instance .")).toBe("exempt");
    expect(verdict(SKILL, "bun run cat-harness-tools/pipeline/graph-search.ts \"<q>\"")).toBe("exempt");
    // Other harness Markdown, not only skills: the coordinator's scope.
    expect(verdict("cat-harness/AGENTS.md", "bun run cat-harness-tools/scripts/mount-from-lock.ts")).toBe("exempt");
  });

  test("a Windows command line naming a tools script with backslashes is exempt", () => {
    // cmd.exe needs `\`, so the guide's Windows lines name the same script path.
    expect(verdict("cat-harness/docs/start/installation.md", ".\\cat-harness-tools\\scripts\\bootstrap.ps1")).toBe("exempt");
    expect(verdict("cat-harness/docs/start/installation.md", "powershell -File .\\cat-harness-tools\\scripts\\win\\setup.ps1 -Force")).toBe("exempt");
    // The separator widens; nothing else does — a backslashed source path still fails.
    expect(verdict(SKILL, "see `cat-harness-tools\\src\\core\\handover-screen.ts`")).toBe("wrong-direction");
  });

  test("FAILS for code and configuration in cat-harness naming the same script", () => {
    const line = "bun run cat-harness-tools/scripts/qa-refresh.ts --check";
    expect(verdict("cat-harness/schemas/kg/qa-record-shapes.ts", line)).toBe("wrong-direction");
    expect(verdict("cat-harness/.github/workflows/post-merge-regen.yml", line)).toBe("wrong-direction");
    expect(verdict("cat-harness/openapi/typologies/openapi.json", line)).toBe("wrong-direction");
  });

  test("FAILS for a skill naming a tools path that is not a script or a command", () => {
    expect(verdict(SKILL, "logic in `cat-harness-tools/src/core/handover-screen.ts`")).toBe("wrong-direction");
    expect(verdict(SKILL, "`cat-harness-tools/test/review-nav.e2e.ts` drives all of this")).toBe("wrong-direction");
    expect(verdict(SKILL, "repositories (cat-harness, cat-harness-tools, folio-assistant-core)")).toBe("wrong-direction");
  });

  test("FAILS when a script on the line sits beside a non-script mention of the layer", () => {
    expect(
      verdict(SKILL, "`cat-harness-tools/scripts/gates.ts` reads `cat-harness-tools/src/workflow/prov-record.ts`"),
    ).toBe("wrong-direction");
  });

  test("FAILS for a skill naming another layer's scripts, and outside cat-harness", () => {
    expect(verdict(SKILL, "bun run smart-base/scripts/dak-pdf.ts", "smart-base")).toBe("wrong-direction");
    expect(
      classifyReference(
        occ("cat-harness", "cat-harness-tools", "bun run cat-harness-tools/scripts/x.ts", "bootstrap/skills/x.md"),
        LAYER_RULE,
        never,
        [DEFINITION_NAMES_IMPLEMENTATION],
      ).verdict,
    ).toBe("wrong-direction");
  });
});

// ── Q6 (2026-10-14): X4 widened to pointers nothing runs ─────────

describe("X4 widened — a harness definition may POINT at its tools implementation when nothing runs it (owner, 2026-10-14, Q6 (a))", () => {
  const LAYERS = new Map<string, readonly string[]>([
    ["cat-harness", []],
    ["cat-harness-tools", ["cat-harness"]],
    ["smart-base", ["cat-harness-tools"]],
  ]);
  const LAYER_RULE: LayerRule = {
    allowed: allowedFromNeeds(
      LAYERS,
      ancestorsOf(flattenDependencies([...LAYERS].map(([id, needs]) => ({ id, needs: [...needs], fatal: false }))).order),
    ),
  };
  const X4_ALL = [
    DEFINITION_NAMES_IMPLEMENTATION,
    DEFINITION_POINTS_TO_IMPLEMENTATION_MD,
    DEFINITION_POINTS_TO_IMPLEMENTATION_TS,
    DEFINITION_POINTS_TO_IMPLEMENTATION_JSON,
  ];
  const judge = (file: string, text: string, to = "cat-harness-tools", from = "cat-harness") =>
    classifyReference(occ(from, to, text, file), LAYER_RULE, never, X4_ALL);
  const verdict = (file: string, text: string, to?: string, from?: string) => judge(file, text, to, from).verdict;
  const MD = "cat-harness/skills/process/process-core/x.md";
  const TS = "cat-harness/schemas/x.ts";
  const JSON_FILE = "cat-harness/scenarios/actors/x.json";

  test("Markdown: a path into the tools layer's code is a pointer — src/, pipeline/, a directory, a glob", () => {
    expect(verdict(MD, "(`cat-harness-tools/src/core/identity.ts`, bean `f1e1`): GitHub's answer is")).toBe("exempt");
    expect(verdict(MD, "`cat-harness-tools/pipeline/script-sidecars/` carry three such fields:")).toBe("exempt");
    expect(verdict(MD, "files in `cat-harness-tools/types/*.d.ts` and include them in")).toBe("exempt");
    expect(verdict(MD, "- cat-harness-tools/src/tools")).toBe("exempt");
  });

  test("Markdown: the layer named beside a code file, and a parenthetical wrapping after the layer's name", () => {
    expect(verdict(MD, "The full folio viewer (cat-harness-tools `gen-folio-viz.ts`) shows")).toBe("exempt");
    expect(verdict(MD, "files does this folio hold\". The full folio viewer (cat-harness-tools")).toBe("exempt");
  });

  test("Markdown: a script beside a src pointer is now exempt as a whole line (X4 alone refused it)", () => {
    const line = "`cat-harness-tools/scripts/gates.ts` reads `cat-harness-tools/src/workflow/prov-record.ts`";
    expect(
      classifyReference(occ("cat-harness", "cat-harness-tools", line, MD), LAYER_RULE, never, [DEFINITION_NAMES_IMPLEMENTATION]).verdict,
    ).toBe("wrong-direction");
    expect(verdict(MD, line)).toBe("exempt");
    // A script path alone keeps X4's own reason: it is consulted first.
    const v = judge(MD, "bun run cat-harness-tools/scripts/qa-refresh.ts --check");
    expect(v.verdict === "exempt" && v.exemption).toBe(DEFINITION_NAMES_IMPLEMENTATION);
  });

  test("Markdown: STILL READ when the mention is executed, imported or loaded", () => {
    expect(verdict(MD, "bun test cat-harness-tools/src/core/identity.test.ts")).toBe("wrong-direction");
    expect(verdict(MD, "python3 cat-harness-tools/pipeline/content-graph-analysis.py")).toBe("wrong-direction");
    expect(verdict(MD, "node cat-harness-tools/src/index.ts --stdio")).toBe("wrong-direction");
    expect(verdict(MD, "import { registerWorkflow } from \"cat-harness-tools/src/tools/workflow.ts\";")).toBe("wrong-direction");
    expect(verdict(MD, "const m = await import(\"cat-harness-tools/src/tools/workflow.ts\");")).toBe("wrong-direction");
    expect(verdict(MD, "\"args\": [\"run\", \"/path/to/folio-assistant/cat-harness-tools/src/index.ts\", \"--stdio\"]")).toBe("wrong-direction");
    expect(verdict(MD, "inProcess: { module: \"../cat-harness-tools/src/tools/workflow.ts\" }")).toBe("wrong-direction");
  });

  test("Markdown: STILL READ for the layer as such, its tests and its root files", () => {
    expect(verdict(MD, "repositories (cat-harness, cat-harness-tools, folio-assistant-core)")).toBe("wrong-direction");
    expect(verdict(MD, "cat-harness-tools is next.")).toBe("wrong-direction");
    expect(verdict(MD, "(cat-harness-tools)")).toBe("wrong-direction");
    expect(verdict(MD, "`cat-harness-tools/test/review-nav.e2e.ts` drives all of this")).toBe("wrong-direction");
    expect(verdict(MD, "Tools declare their runtime dependencies in `cat-harness-tools/package.json`.")).toBe("wrong-direction");
    expect(verdict(MD, "the layer (cat-harness-tools `review-nav.test.ts`)")).toBe("wrong-direction");
    // A pointer does not excuse a real reference on the same line.
    expect(verdict(MD, "`cat-harness-tools/src/core/identity.ts`, maintained in cat-harness-tools")).toBe("wrong-direction");
  });

  test("TypeScript: a COMMENT line pointing at the implementation is exempt", () => {
    expect(verdict(TS, "* PDF page (cat-harness-tools `_latex_headings.py`).")).toBe("exempt");
    expect(verdict(TS, "// The site slices `gen-slice-sqlite.ts` (cat-harness-tools) writes under")).toBe("exempt");
    expect(verdict(TS, "* it (`cat-harness-tools/scripts/extract-assets.ts`). Nothing here names a")).toBe("exempt");
    expect(verdict(TS, "/** see cat-harness-tools/src/crdm/detect-signals.ts */")).toBe("exempt");
  });

  test("TypeScript: STILL READ for code, directives, and a comment naming the layer as such", () => {
    expect(verdict(TS, "invoke: { shell: \"bun run cat-harness-tools/scripts/publish-block-qa.ts\" },")).toBe("wrong-direction");
    expect(verdict(TS, "const p = \"cat-harness-tools/src/core/identity.ts\";")).toBe("wrong-direction");
    expect(verdict(TS, "import { x } from \"cat-harness-tools/src/core/identity.ts\";")).toBe("wrong-direction");
    expect(verdict(TS, "/// <reference path=\"cat-harness-tools/types/bun.d.ts\" />")).toBe("wrong-direction");
    expect(verdict(TS, "* @type {import(\"cat-harness-tools/src/core/identity.ts\").Id}")).toBe("wrong-direction");
    expect(verdict(TS, "* cat-harness-tools checking `smart-ra`: `smart-base.json` declares the")).toBe("wrong-direction");
    expect(verdict(TS, "// run by bun run cat-harness-tools/pipeline/qa-sweep.ts")).toBe("wrong-direction");
  });

  test("JSON: a prose field, or a bare array element that is a sentence, pointing at the implementation is exempt", () => {
    expect(
      verdict(JSON_FILE, "\"description\": \"The mechanical implementation of the phrase signals (cat-harness-tools src/crdm/detect-signals.ts): given an issue's text it says whether.\","),
    ).toBe("exempt");
    expect(
      verdict(JSON_FILE, "\"requirement\": \"An evaluation SHALL score every issue of its corpus (cat-harness-tools/scripts/eval/crdm-detect-corpus.json: the whole population).\","),
    ).toBe("exempt");
    expect(
      verdict(JSON_FILE, "\"cat-harness-tools/pipeline/qa-utils.ts — `saveQaScriptSidecar` skips the write unless a substantive field moved.\","),
    ).toBe("exempt");
    expect(verdict(JSON_FILE, "\"_needs_comment\": \"the server half is implemented in cat-harness-tools/src/server.ts.\",")).toBe("exempt");
  });

  test("JSON: STILL READ for commands, bare paths a tool reads, and keys that are not prose", () => {
    expect(verdict(JSON_FILE, "\"command\": \"bun run cat-harness-tools/scripts/x.ts\",")).toBe("wrong-direction");
    expect(verdict(JSON_FILE, "\"module\": \"cat-harness-tools/src/tools/workflow.ts\",")).toBe("wrong-direction");
    expect(verdict(JSON_FILE, "\"cat-harness-tools/src/tools/workflow.ts\",")).toBe("wrong-direction");
    expect(verdict(JSON_FILE, "\"cat-harness-tools/scripts/preview-site.sh --port 4000\",")).toBe("wrong-direction");
    expect(verdict(JSON_FILE, "\"bun run cat-harness-tools/scripts/site-links.ts --site ./_site.\"")).toBe("wrong-direction");
    // A prose field followed on the same line by one that runs.
    expect(
      verdict(JSON_FILE, "\"description\": \"see cat-harness-tools/src/x.ts.\", \"run\": \"bun run cat-harness-tools/src/x.ts\""),
    ).toBe("wrong-direction");
  });

  test("only cat-harness → cat-harness-tools, and only the file types each entry names", () => {
    expect(verdict("bootstrap/skills/x.md", "(`cat-harness-tools/src/core/identity.ts`)")).toBe("wrong-direction");
    expect(verdict(MD, "(`smart-base/src/core/identity.ts`)", "smart-base")).toBe("wrong-direction");
    expect(verdict("cat-harness/.github/workflows/x.yml", "# see cat-harness-tools/src/core/identity.ts")).toBe("wrong-direction");
    expect(verdict("cat-harness/docs/x.jsonld", "\"description\": \"see cat-harness-tools/src/x.ts.\"")).toBe("wrong-direction");
  });

  test("each exemption is counted on its own line, the widened entries included", () => {
    const counted = (e: (typeof X4_ALL)[number]) => ({ verdict: { verdict: "exempt" as const, basis: "", exemption: e } });
    const counts = exemptionCounts([
      counted(DEFINITION_POINTS_TO_IMPLEMENTATION_MD),
      counted(DEFINITION_POINTS_TO_IMPLEMENTATION_MD),
      counted(DEFINITION_POINTS_TO_IMPLEMENTATION_JSON),
    ]);
    expect(counts.get(DEFINITION_POINTS_TO_IMPLEMENTATION_MD.reason)).toBe(2);
    expect(counts.get(DEFINITION_POINTS_TO_IMPLEMENTATION_JSON.reason)).toBe(1);
    expect(counts.get(DEFINITION_POINTS_TO_IMPLEMENTATION_TS.reason)).toBe(0);
    expect(counts.get(DATED_PROPOSAL_RECORD.reason)).toBe(0);
    expect(counts.size).toBe(EXEMPTIONS_DECLARED);
  });
});

// ── Q1 (2026-10-14): a dated decision record is not reworded ─────

describe("X5 — a dated proposal record may name the layers it was written about (owner, 2026-10-14, Q1)", () => {
  const LAYERS = new Map<string, readonly string[]>([
    ["cat-harness", []],
    ["cat-harness-tools", ["cat-harness"]],
    ["smart-base", ["cat-harness-tools"]],
  ]);
  const LAYER_RULE: LayerRule = {
    allowed: allowedFromNeeds(
      LAYERS,
      ancestorsOf(flattenDependencies([...LAYERS].map(([id, needs]) => ({ id, needs: [...needs], fatal: false }))).order),
    ),
  };
  const verdict = (file: string, to = "smart-base", text = `the ${to} layer, as measured that day`) =>
    classifyReference(occ("cat-harness", to, text, file), LAYER_RULE, never, [DATED_PROPOSAL_RECORD]).verdict;

  test("a dated record under docs/proposals/ is exempt, whichever layer it names and whatever the line says", () => {
    expect(verdict("cat-harness/docs/proposals/checkout-layout-2026-10-12.md")).toBe("exempt");
    expect(verdict("cat-harness/docs/proposals/checkout-layout-2026-10-12.md", "cat-harness-tools")).toBe("exempt");
    // The measurement a record carries, beside it.
    expect(verdict("cat-harness/docs/proposals/placement-audit-2026-10-01.json")).toBe("exempt");
    // Any layer's proposals, not only the harness's.
    expect(verdict("cat-harness-tools/docs/proposals/tools-split-2026-10-01.md")).toBe("exempt");
  });

  test("FAILS for the undated pages beside the records — the index and living proposals are edited, so they are read", () => {
    expect(verdict("cat-harness/docs/proposals/index.md")).toBe("wrong-direction");
    expect(verdict("cat-harness/docs/proposals/README.md")).toBe("wrong-direction");
    expect(verdict("cat-harness/docs/proposals/instance-versioning.md")).toBe("wrong-direction");
  });

  test("FAILS for a date that is not at the end of the name, or is not a date", () => {
    expect(verdict("cat-harness/docs/proposals/2026-10-12-checkout-layout.md")).toBe("wrong-direction");
    expect(verdict("cat-harness/docs/proposals/checkout-layout-2026-10-12-draft.md")).toBe("wrong-direction");
    expect(verdict("cat-harness/docs/proposals/checkout-layout-2026-13-40.md")).toBe("wrong-direction");
  });

  test("FAILS outside docs/proposals/, in a sub-directory of it, and for a file type a record is not written in", () => {
    expect(verdict("cat-harness/docs/requirements/checkout-layout-2026-10-12.md")).toBe("wrong-direction");
    expect(verdict("cat-harness/docs/proposals/old/checkout-layout-2026-10-12.md")).toBe("wrong-direction");
    expect(verdict("cat-harness/proposals/checkout-layout-2026-10-12.md")).toBe("wrong-direction");
    expect(verdict("cat-harness/docs/proposals/checkout-layout-2026-10-12.ts")).toBe("wrong-direction");
  });
});

// ── Item 6a (2026-10-16): the generated index of the records ─────

describe("X5 index — a generated index's row for a dated record is read as the record (owner, 2026-10-16, item 6a)", () => {
  const INDEX = (rows: string) =>
    `${SUBGRAPH_INDEX_BEGIN}\n# proposals\n\nSee the high layer for more.\n\n| file | what it is | used by |\n|---|---|---|\n${rows}<!-- kg:subgraph:end -->\n`;
  const DATED_ROW = "| [`high-split-2026-10-01.md`](high-split-2026-10-01.md) | Split plan for high |  |\n";
  const UNDATED_ROW = "| [`high-notes.md`](high-notes.md) | Notes on high |  |\n";

  test("a row listing a dated record is exempt, carrying the index reason", () => {
    const r = analyse(tree({ "low/docs/proposals/README.md": INDEX(DATED_ROW) }));
    const rows = r.classified.filter((c) => c.occurrence.text.startsWith("|"));
    expect(rows.map((c) => c.verdict.verdict)).toEqual(["exempt"]);
    expect(JSON.stringify(rows[0]!.verdict)).toContain("X5 applied to the generated INDEX");
  });

  test("FAILS for the page's prose and for a row listing an undated proposal", () => {
    const r = analyse(tree({ "low/docs/proposals/README.md": INDEX(UNDATED_ROW) }));
    expect(r.classified.map((c) => c.verdict.verdict)).toEqual(["wrong-direction", "wrong-direction"]);
  });

  test("FAILS when the file does not declare itself the generator's index — the same row, hand-written", () => {
    const body = INDEX(DATED_ROW).replace(SUBGRAPH_INDEX_BEGIN, "");
    const root = tree({ "low/docs/proposals/README.md": body });
    expect(declaresSubgraphIndex(join(root, "low/docs/proposals/README.md"))).toBe(false);
    expect(verdicts(root).every((v) => v.endsWith("wrong-direction"))).toBe(true);
  });

  test("FAILS for a generated index outside the records' directory", () => {
    const root = tree({ "low/docs/requirements/README.md": INDEX(DATED_ROW) });
    expect(declaresSubgraphIndex(join(root, "low/docs/requirements/README.md"))).toBe(true);
    expect(verdicts(root).every((v) => v.endsWith("wrong-direction"))).toBe(true);
  });

  test("the row must link the dated name to itself, in the generator's shape", () => {
    const v = (text: string, file = "cat-harness/docs/proposals/README.md") =>
      classifyReference(occ("cat-harness", "smart-base", text, file), LAYER_RULE_X5I, never, [DATED_PROPOSAL_INDEX_ROW]).verdict;
    expect(v("| [`dak-kinds-contribution-2026-10-02.md`](dak-kinds-contribution-2026-10-02.md) | DAK block kinds as a smart-base contribution |  |")).toBe("exempt");
    expect(v("| [`dth-candidates-2026-10-02.json`](dth-candidates-2026-10-02.json) | data about smart-base |  |")).toBe("exempt");
    // Linked elsewhere, not a record row.
    expect(v("| [`dak-kinds-contribution-2026-10-02.md`](../smart-base/x.md) | smart-base |  |")).toBe("wrong-direction");
    // A sub-directory of docs/proposals/ is not X5's directory.
    expect(v("| [`a-2026-10-02.md`](a-2026-10-02.md) | smart-base |  |", "cat-harness/docs/proposals/old/README.md")).toBe("wrong-direction");
    // Prose quoting a row's first cell mid-line.
    expect(v("see | [`a-2026-10-02.md`](a-2026-10-02.md) | smart-base")).toBe("wrong-direction");
  });

  test("it is counted on its own line", () => {
    const counts = exemptionCounts([{ verdict: { verdict: "exempt" as const, basis: "", exemption: DATED_PROPOSAL_INDEX_ROW } }]);
    expect(counts.get(DATED_PROPOSAL_INDEX_ROW.reason)).toBe(1);
    expect(counts.size).toBe(EXEMPTIONS_DECLARED);
  });
});

const LAYER_RULE_X5I: LayerRule = (() => {
  const layers = new Map<string, readonly string[]>([
    ["cat-harness", []],
    ["smart-base", ["cat-harness"]],
  ]);
  return {
    allowed: allowedFromNeeds(
      layers,
      ancestorsOf(flattenDependencies([...layers].map(([id, needs]) => ({ id, needs: [...needs], fatal: false }))).order),
    ),
  };
})();

// ── Ruling 3a (2026-10-15): a workflow `uses:` names an address ──

describe("3a — a workflow `uses:` names the repository a reusable workflow lives in, not a layer (owner, 2026-10-15)", () => {
  const LAYERS = new Map<string, readonly string[]>([
    ["bootstrap", []],
    ["cat-harness", ["bootstrap"]],
    ["cat-harness-tools", ["cat-harness"]],
  ]);
  const LAYER_RULE: LayerRule = {
    allowed: allowedFromNeeds(
      LAYERS,
      ancestorsOf(flattenDependencies([...LAYERS].map(([id, needs]) => ({ id, needs: [...needs], fatal: false }))).order),
    ),
  };
  const WF = "cat-harness/.github/workflows/harness-pr-checks.yml";
  const REUSABLE = "uses: litlfred/cat-harness-tools/.github/workflows/layer-pr-checks.yml@main";
  // Trimmed, as `analyse` reports a line.
  const verdict = (text: string, file = WF, from = "cat-harness") =>
    classifyReference(occ(from, "cat-harness-tools", text, file), LAYER_RULE, never, [WORKFLOW_USES_ADDRESS]).verdict;

  test("the reusable-workflow caller each lower layer carries is exempt", () => {
    expect(verdict(REUSABLE)).toBe("exempt");
    expect(verdict(REUSABLE, "bootstrap/.github/workflows/harness-pr-checks.yml", "bootstrap")).toBe("exempt");
    expect(verdict(REUSABLE, "bootstrap-tools/.github/workflows/harness-pr-checks.yaml", "bootstrap")).toBe("exempt");
    // The repository root's own workflows, with no layer prefix.
    expect(verdict(REUSABLE, ".github/workflows/ci.yml")).toBe("exempt");
  });

  test("an action address is exempt too: as a step, quoted, at a SHA, with a path, with a version comment", () => {
    expect(verdict("- uses: litlfred/cat-harness-tools@main")).toBe("exempt");
    expect(verdict("uses: \"litlfred/cat-harness-tools/.github/actions/mount@v2\"")).toBe("exempt");
    expect(verdict("- uses: 'litlfred/cat-harness-tools/actions/mount@0123abcd'")).toBe("exempt");
    expect(verdict("- uses: litlfred/cat-harness-tools@0123456789abcdef0123456789abcdef01234567 # v1.2.3")).toBe("exempt");
    expect(verdict("uses: litlfred/cat-harness-tools/.github/workflows/x.yml@refs/heads/main")).toBe("exempt");
  });

  test("FAILS for a `run:` that executes the higher layer's scripts, and for every other key", () => {
    expect(verdict("run: bun run cat-harness-tools/scripts/check-reference-direction.ts")).toBe("wrong-direction");
    expect(verdict("- run: bun run cat-harness-tools/scripts/x.ts")).toBe("wrong-direction");
    expect(verdict("path: cat-harness-tools")).toBe("wrong-direction");
    expect(verdict("repository: litlfred/cat-harness-tools")).toBe("wrong-direction");
    expect(verdict("tools-ref: cat-harness-tools")).toBe("wrong-direction");
    expect(verdict("name: uses: litlfred/cat-harness-tools@main")).toBe("wrong-direction");
  });

  test("FAILS for a comment, even one that quotes a `uses:` line", () => {
    expect(verdict("# The checks themselves live in cat-harness-tools")).toBe("wrong-direction");
    expect(verdict(`# ${REUSABLE}`)).toBe("wrong-direction");
  });

  test("FAILS when the value is not a remote address, or carries more than one", () => {
    // A local action is a path in the checkout, which IS the higher layer's files.
    expect(verdict("- uses: ./cat-harness-tools/.github/actions/mount")).toBe("wrong-direction");
    expect(verdict("uses: ./cat-harness-tools/.github/workflows/layer-pr-checks.yml")).toBe("wrong-direction");
    expect(verdict("- uses: docker://ghcr.io/litlfred/cat-harness-tools:latest")).toBe("wrong-direction");
    // No ref: not an address GitHub resolves.
    expect(verdict("uses: litlfred/cat-harness-tools/.github/workflows/layer-pr-checks.yml")).toBe("wrong-direction");
    // A trailing comment that is not a version names something else on the line.
    expect(verdict(`${REUSABLE} # the checks live in cat-harness-tools`)).toBe("wrong-direction");
    // Unbalanced quotes.
    expect(verdict("uses: \"litlfred/cat-harness-tools@main'")).toBe("wrong-direction");
  });

  test("FAILS outside a `.github/workflows/` file: Markdown quoting it, an action.yml, a template, a nested directory", () => {
    expect(verdict(REUSABLE, "cat-harness/skills/kg/kg-core/index-config.md")).toBe("wrong-direction");
    expect(verdict(REUSABLE, "cat-harness/.github/actions/mount/action.yml")).toBe("wrong-direction");
    expect(verdict(REUSABLE, "cat-harness/templates/paper/github/workflows/blueprint.yml")).toBe("wrong-direction");
    expect(verdict(REUSABLE, "cat-harness/.github/workflows/old/harness-pr-checks.yml")).toBe("wrong-direction");
    expect(verdict(REUSABLE, "cat-harness/.github/workflows/harness-pr-checks.json")).toBe("wrong-direction");
  });

  test("it is counted on its own line", () => {
    const counts = exemptionCounts([
      { verdict: { verdict: "exempt" as const, basis: "", exemption: WORKFLOW_USES_ADDRESS } },
      { verdict: { verdict: "exempt" as const, basis: "", exemption: WORKFLOW_USES_ADDRESS } },
      { verdict: { verdict: "exempt" as const, basis: "", exemption: DATED_PROPOSAL_RECORD } },
    ]);
    expect(counts.get(WORKFLOW_USES_ADDRESS.reason)).toBe(2);
    expect(counts.get(DATED_PROPOSAL_RECORD.reason)).toBe(1);
    expect(counts.size).toBe(EXEMPTIONS_DECLARED);
  });
});

// ── Ruling (i): a moved file keeps its baseline pairs ────────────

describe("ruling (i) — a baseline pair on a MOVED file is compared at the file's new path", () => {
  const ev = (present: readonly string[], pageMoves: MoveEvidence["pageMoves"] = []): MoveEvidence => ({
    exists: (p) => present.includes(p),
    instanceRoots: ["cat-harness", "cat-harness-tools", "smart-base"],
    pageMoves,
  });
  const PAGES = [{ now: "cat-harness/docs/en/cat-harness/processes/", before: ["cat-harness/docs/cat-harness/processes/", "cat-harness/docs/processes/"] }];

  test("between layers: the old path is gone and exactly one other instance holds the same path", () => {
    expect(movedTo("cat-harness/scripts/a.ts", ev(["cat-harness-tools/scripts/a.ts"]))).toBe("cat-harness-tools/scripts/a.ts");
  });

  test("a declared visualiser page: from its alias or forwarding address to its localised route", () => {
    const now = "cat-harness/docs/en/cat-harness/processes/p.md";
    expect(movedTo("cat-harness/docs/processes/p.md", ev([now], PAGES))).toBe(now);
    expect(movedTo("cat-harness/docs/cat-harness/processes/p.md", ev([now], PAGES))).toBe(now);
  });

  test("FAILS to re-key when the old path still exists — a file re-created at its home is a different file", () => {
    expect(movedTo("cat-harness/scripts/a.ts", ev(["cat-harness/scripts/a.ts", "cat-harness-tools/scripts/a.ts"]))).toBeUndefined();
  });

  test("FAILS to re-key when nothing exists at a new path, or when two places could be it", () => {
    expect(movedTo("cat-harness/scripts/a.ts", ev([]))).toBeUndefined();
    expect(
      movedTo("cat-harness/scripts/a.ts", ev(["cat-harness-tools/scripts/a.ts", "smart-base/scripts/a.ts"])),
    ).toBeUndefined();
  });

  test("end to end: an inherited pair on a moved file passes; a NEW target on it still fails", () => {
    const base = mkdtempSync(join(tmpdir(), "refdir-moved-"));
    made.push(base);
    const mk = (entries: { file: string; target: string }[]): QaResult =>
      ({
        $schema: "qa-results/v1",
        families: { "wrong-direction": { count: entries.length, entries }, "pending-stale": { count: 0, entries: [] }, "instances-undeclared": { count: 0, entries: [] } },
      }) as unknown as QaResult;
    writeQaResult(base, SIDECAR_STEM, mk([{ file: "cat-harness/scripts/a.ts", target: "smart-base" }]));
    const evidence = ev(["cat-harness-tools/scripts/a.ts"]);
    const judge = (fresh: QaResult, rekey: boolean) => {
      const log = console.log;
      console.log = () => {};
      try {
        return judgeQaResult({
          gate: "check:reference-direction:check",
          fresh,
          failOnNew: [...CHECK_FAIL_ON_NEW],
          baseline: { root: base, stem: SIDECAR_STEM, writer: "check:reference-direction" },
          ...(rekey ? { rekeyBaseline: (b: QaResult) => ({ result: rekeyMovedPairs(b, evidence).result }) } : {}),
        });
      } finally {
        console.log = log;
      }
    };
    const moved = mk([{ file: "cat-harness-tools/scripts/a.ts", target: "smart-base" }]);
    // Vacuity guard: without the re-key the same move reads as NEW.
    expect(judge(moved, false).exit).toBe(1);
    expect(judge(moved, true).exit).toBe(0);
    const grew = mk([
      { file: "cat-harness-tools/scripts/a.ts", target: "smart-base" },
      { file: "cat-harness-tools/scripts/a.ts", target: "who-iris" },
    ]);
    const v = judge(grew, true);
    expect(v.exit).toBe(1);
    expect(v.diff?.added["wrong-direction"]).toEqual([{ file: "cat-harness-tools/scripts/a.ts", target: "who-iris" }]);
  });
});

describe("a sub-graph's machine-written directories, declared from within, are not read", () => {
  test("cat-harness's corpus under library/graph.json is excluded like a top-level library entry", () => {
    const root = mkdtempSync(join(tmpdir(), "refdir-subgraph-"));
    made.push(root);
    mkdirSync(join(root, "library", "corpus"), { recursive: true });
    writeFileSync(
      join(root, "library", "graph.json"),
      JSON.stringify({
        directories: [
          { id: "library", path: "corpus/", graphTypologies: ["library"] },
          { id: "library-skills", path: "skills/", graphTypologies: ["skills"] },
        ],
      }),
    );
    const dirs = [{ path: "library/" }, { path: "skills/" }];
    expect(subgraphMachineWritten(root, dirs)).toEqual([join(root, "library", "corpus/")]);
    // Vacuity guard: without the sub-graph's graph.json nothing is added.
    rmSync(join(root, "library", "graph.json"));
    expect(subgraphMachineWritten(root, dirs)).toEqual([]);
  });
});

// ── Bean tdir: a Tool split into its folder keeps its baseline pairs ──

describe("bean tdir — a baseline pair on tools/index.ts is compared at the Tool's folder file", () => {
  const mk = (entries: { file: string; target: string }[]): QaResult =>
    ({ $schema: "qa-results/v1", families: { "wrong-direction": { count: entries.length, entries } } }) as unknown as QaResult;
  const files = (r: QaResult) => (r.families["wrong-direction"]!.entries as { file: string }[]).map((e) => e.file);

  test("from index.ts to the one tools/<id>/<id>.ts naming the same target", () => {
    const base = mk([{ file: "fhir-harness/tools/index.ts", target: "smart-trust" }]);
    const fresh = mk([{ file: "fhir-harness/tools/ig-ast/ig-ast.ts", target: "smart-trust" }]);
    const { result, rekeyed } = rekeyToolSplits(base, fresh);
    expect(rekeyed).toBe(1);
    expect(files(result)).toEqual(["fhir-harness/tools/ig-ast/ig-ast.ts"]);
  });

  test("from tools/<id>.ts only to that id's folder", () => {
    const base = mk([{ file: "core/tools/vocab-map.ts", target: "who-iris" }]);
    expect(rekeyToolSplits(base, mk([{ file: "core/tools/vocab-map/vocab-map.ts", target: "who-iris" }])).rekeyed).toBe(1);
    expect(rekeyToolSplits(base, mk([{ file: "core/tools/other/other.ts", target: "who-iris" }])).rekeyed).toBe(0);
  });

  test("FAILS to re-key when the old pair still holds, the target differs, or two folders could be it", () => {
    const base = mk([{ file: "x/tools/index.ts", target: "smart-base" }]);
    expect(rekeyToolSplits(base, mk([{ file: "x/tools/index.ts", target: "smart-base" }, { file: "x/tools/a/a.ts", target: "smart-base" }])).rekeyed).toBe(0);
    expect(rekeyToolSplits(base, mk([{ file: "x/tools/a/a.ts", target: "who-iris" }])).rekeyed).toBe(0);
    expect(rekeyToolSplits(base, mk([{ file: "x/tools/a/a.ts", target: "smart-base" }, { file: "x/tools/b/b.ts", target: "smart-base" }])).rekeyed).toBe(0);
    expect(rekeyToolSplits(base, mk([{ file: "x/tools/a/b.ts", target: "smart-base" }])).rekeyed).toBe(0);
  });
});

describe("an instance's uploads/ is its data store, not a reference (owner, 2026-11-03)", () => {
  // who-iris#176 stopped declaring uploads/ as a graph; its intakes record
  // provenance ("cited in DAK Component 1 … smart-base/scripts/…", "moved here
  // from … smart-immunizations"), which names layers above it.
  test("an intake under <instance>/uploads/ naming a higher instance is exempt, with the ruling as its reason", () => {
    const v = classifyReference(occ("low", "high", "basis: cited by high/scripts/x.ts", "low/uploads/item/intake.json"), RULE, never, [INSTANCE_UPLOADS_DATA]);
    expect(v.verdict).toBe("exempt");
    expect(v.basis).toContain("data store");
  });

  test("the same text outside uploads/ is still wrong-direction", () => {
    expect(classifyReference(occ("low", "high", "basis: cited by high/scripts/x.ts", "low/library/item/manifest.jsonld"), RULE, never, [INSTANCE_UPLOADS_DATA]).verdict).toBe("wrong-direction");
  });
});

describe("a provenance log quotes where a rule came from, not a reference (owner, 2026-11-05)", () => {
  // The Docs QA pass gave skills `<skill>.prov.jsonld` logs whose verbatim
  // quotes name the layers the owner was talking about (cat-harness#1037).
  test("a <document>.prov.jsonld naming a higher instance is exempt, with the ruling as its reason", () => {
    const v = classifyReference(occ("low", "high", "\"quote\": \"move it into high\"", "low/skills/kg/x.prov.jsonld"), RULE, never, [PROVENANCE_LOG]);
    expect(v.verdict).toBe("exempt");
    expect(v.basis).toContain("PROVENANCE LOG");
  });

  test("the same text in the document itself is still wrong-direction", () => {
    expect(classifyReference(occ("low", "high", "\"quote\": \"move it into high\"", "low/skills/kg/x.jsonld"), RULE, never, [PROVENANCE_LOG]).verdict).toBe("wrong-direction");
  });
});
