/**
 * `audit-coverage` — the parses it depends on, and the three states it exists
 * to keep apart.
 *
 * Bean `folio-assistant-xutg`. The report's whole value is that a zero in one
 * column cannot be read as a gap, so most of what is asserted here is that
 * "no directory", "a directory with no files" and "files nothing audits" come
 * out as three different answers. A test that only checked the counts would
 * pass over the collapse this guards against.
 *
 * The tests here that read the aggregate repository's own root
 * (`.github/workflows/code-quality-gates.yml`) live in
 * `test/audit-coverage-workflows.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { asRecord, census, coverage, coversIn, kindUniverse, scriptsFor } from "../audit-coverage.js";
import { KG_CRITERIA, KG_SUBJECT_GRAPH_TYPOLOGIES } from "../../schemas/sdlc/kg-qa.js";
import { defaultGraphTypologies } from "../../schemas/kg/cat-harness.js";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { pathToFileURL } from "node:url";
import { HARNESS_ROOT } from "../lib/roots.ts";

const INSTANCE = pathToFileURL(HARNESS_ROOT + "/").pathname.replace(/\/$/, "");
const REPO = repoRootFor(INSTANCE);

describe("coversIn — the declaration a gate makes about itself", () => {
  test("a single kind", () => {
    expect(coversIn("/**\n * x\n * @covers tools\n */")).toEqual(["tools"]);
  });

  test("a comma-separated list", () => {
    expect(coversIn("/**\n * @covers bean-defs, beans\n */")).toEqual(["bean-defs", "beans"]);
  });

  test("an em-dash reason is not mistaken for a kind", () => {
    // The reason is the part a reader needs most and the part a naive split
    // would turn into four invented kinds.
    expect(coversIn("/**\n * @covers none — .github/workflows/ is not a declared graph typology\n */")).toEqual(["none"]);
  });

  test("a wrapped reason contributes nothing", () => {
    const block = "/**\n * @covers computed — it sweeps whichever kinds declare\n *   `nodeSchemas`, so a list goes stale\n */";
    expect(coversIn(block)).toEqual(["computed"]);
  });

  test("several lines accumulate, without duplicates", () => {
    expect(coversIn("/**\n * @covers processes\n * @covers processes, skills\n */")).toEqual(["processes", "skills"]);
  });

  test("an INDENTED @covers is a mention, not a declaration", () => {
    // This file's own docblock documents the syntax by showing it. A lenient
    // pattern read those samples as declarations and credited the coverage
    // report with auditing the bean store — caught by the self-test below,
    // which is the only reason it is not in the committed sidecar.
    const block = "/**\n * x\n *     @covers bean-defs, beans\n *     @covers none — an example\n */";
    expect(coversIn(block)).toBeUndefined();
  });

  test("a continuation line does not leak into the list", () => {
    const block = "/**\n * @covers tools — because it reads\n *   every Tool node and beans too\n */";
    expect(coversIn(block)).toEqual(["tools"]);
  });

  test("absent is UNDEFINED, not an empty list", () => {
    // The distinction the whole gate half rests on: `[]` is `@covers none`, a
    // decision; `undefined` is a gate that has not said. Collapsing them would
    // credit every unannotated gate with having decided it audits nothing.
    expect(coversIn("/**\n * a gate with no declaration\n */")).toBeUndefined();
    expect(coversIn("/**\n * @covers none\n */")).toEqual(["none"]);
  });
});

describe("scriptsFor — a gate command to the files it runs", () => {
  const scripts = {
    "check:x": "bun run cat-harness/scripts/check-x.ts",
    "check:x:check": "bun run check:x -- --check",
    lint: "eslint .",
  };

  test("a direct path", () => {
    expect(scriptsFor("bun run cat-harness/scripts/check-x.ts", scripts)).toEqual(["cat-harness/scripts/check-x.ts"]);
  });

  test("one hop through package.json", () => {
    expect(scriptsFor("bun run check:x", scripts)).toEqual(["cat-harness/scripts/check-x.ts"]);
  });

  test("two hops", () => {
    // `check:*:check` scripts delegate, and a gate that resolved to nothing
    // would be filed as "runs no script here" — silently uncoverable.
    expect(scriptsFor("bun run check:x:check", scripts)).toEqual(["cat-harness/scripts/check-x.ts"]);
  });

  test("through publish-check to the writer it runs (B1)", () => {
    // The gate audits what the writer writes, so the writer's `@covers` is the
    // gate's; publish-check's own `@covers none` must not be all it reads.
    const routed = {
      "docs:x": "bun run cat-harness-tools/scripts/gen-x.ts",
      "docs:x:check": "bun run cat-harness-tools/scripts/publish-check.ts docs:x",
    };
    expect(scriptsFor("bun run cat docs:x:check", routed)).toEqual([
      "cat-harness-tools/scripts/publish-check.ts",
      "cat-harness-tools/scripts/gen-x.ts",
    ]);
  });

  test("through run-script.ts to the layer script it runs (run-gates.py)", () => {
    const routed = {
      "libraries:check": "bun run cat-harness-tools/scripts/libraries.ts --check",
    };
    expect(scriptsFor("bun cat-harness-tools/scripts/run-script.ts libraries:check", routed)).toEqual([
      "cat-harness-tools/scripts/run-script.ts",
      "cat-harness-tools/scripts/libraries.ts",
    ]);
  });

  test("a command with no script resolves to nothing, rather than guessing", () => {
    expect(scriptsFor("bun run cat lint", scripts)).toEqual([]);
    expect(scriptsFor("bunx tsc --noEmit -p tsconfig.json", scripts)).toEqual([]);
  });
});

describe("census — what counts as a file of a kind", () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-coverage-"));

  test("a verdict ABOUT a node is not a node", () => {
    // Counting sidecars would make a directory look FULLER the more of it had
    // been audited, which inverts the measurement.
    writeFileSync(join(dir, "a.md"), "x");
    writeFileSync(join(dir, "a.kg-qa.json"), "{}");
    writeFileSync(join(dir, "b.qa.json"), "{}");
    const c = census(dir);
    expect(c.files).toBe(1);
    expect(c.sidecars).toBe(2);
  });

  test("dot-prefixed paths are skipped, at every segment", () => {
    mkdirSync(join(dir, ".cache"), { recursive: true });
    writeFileSync(join(dir, ".cache", "c.md"), "x");
    writeFileSync(join(dir, ".hidden"), "x");
    expect(census(dir).files).toBe(1);
  });

  test("an unreadable directory says so rather than reporting zero", () => {
    const c = census(join(dir, "does-not-exist"));
    expect(c.readable).toBe(false);
    expect(c.files).toBe(0);
  });
});

describe("the report over this repository", () => {
  const { rows, gates, universe } = coverage(REPO);

  test("it examined something — the vacuity guard's subject", () => {
    // A filter over nothing passes. This repository has paid for that three
    // times (`gates.ts` names them), so the denominators are asserted, not
    // assumed.
    expect(rows.length).toBeGreaterThan(0);
    expect(gates.length).toBeGreaterThan(0);
    expect(KG_CRITERIA.length).toBeGreaterThan(0);
  });

  test("every declared kind gets exactly one row", () => {
    const declared = universe.registered.length + universe.declaredOnly.length;
    expect(rows.length).toBe(declared);
    expect(new Set(rows.map((r) => r.kind)).size).toBe(rows.length);
  });

  test("typed-only is derived from the registry, and is NOT covered", () => {
    // Bean `3oqj`. `health` and `todos` read `unaudited` before this state
    // existed, which over-reported: both declare a validator and
    // `check:kind-validators` parses their nodes. They looked unreached only
    // because the gate that types them declares `@covers computed`.
    for (const r of rows) {
      const def = defaultGraphTypologies.get(r.kind);
      expect(r.typed).toBe(Boolean(def?.validator) || Boolean(def?.nodeSchemas));
      if (r.state === "typed-only") {
        expect(r.typed).toBe(true);
        // The whole point: typed is not judged.
        expect(r.criteria.length + r.gates.length).toBe(0);
        expect(r.files).toBeGreaterThan(0);
      }
      // A kind nothing reaches at all must NOT be typed, or it would be
      // `typed-only` — the two states must partition, not overlap.
      if (r.state === "unaudited") expect(r.typed).toBe(false);
    }
  });

  test("typed-only and unaudited are different findings, not one bucket", () => {
    // If these ever became the same set, the state would have bought nothing
    // and `--strict` would be grading one thing while reporting two.
    const typedOnly = rows.filter((r) => r.state === "typed-only").map((r) => r.kind);
    const unaudited = rows.filter((r) => r.state === "unaudited").map((r) => r.kind);
    for (const k of typedOnly) expect(unaudited).not.toContain(k);
  });

  test("the two kinds `3oqj` typed are typed, and their real nodes parse", () => {
    // The regression this guards: `cat-harness/memory/interaction.json` is read at the
    // start of every session by jq in a shell script whose failure branch
    // prints "(could not parse — read it by hand)". A malformed node degrades
    // to a line nobody acts on, so the schema is what makes it fail loudly.
    for (const kind of ["interaction", "issue-marks"]) {
      const r = rows.find((x) => x.kind === kind);
      expect(r, `${kind} has no row`).toBeDefined();
      expect(r!.typed, `${kind} declares no validator`).toBe(true);
      expect(r!.files).toBeGreaterThan(0);
    }
  });

  test("the three states are distinguishable, and all three occur here", () => {
    // If any of these is empty the report has stopped discriminating and the
    // remaining states are carrying a meaning they were not given.
    const states = new Set(rows.map((r) => r.state));
    expect(states.has("no-directory")).toBe(true);
    expect(states.has("covered")).toBe(true);
    // `unaudited` is a fact about the corpus and may legitimately go to zero
    // once criteria are written; what must hold is that it is DERIVED and not
    // conflated with the other two.
    for (const r of rows) {
      if (r.state === "no-directory") expect(r.directories.length).toBe(0);
      if (r.state === "empty") expect(r.files).toBe(0);
      if (r.state === "unaudited") {
        expect(r.files).toBeGreaterThan(0);
        expect(r.criteria.length + r.gates.length).toBe(0);
        expect(r.typed).toBe(false);
      }
      if (r.state === "covered") expect(r.criteria.length + r.gates.length).toBeGreaterThan(0);
    }
  });

  test("a nested kind resolves its own directory and is judged, not a gap", () => {
    // `bean-defs` is declared in `beans/beans.json`, one level inside the
    // `beans` graph. Until #2094 a nested declaration resolved only through the
    // skills-only `subgraph: true`, so this kind read `no-directory`. It now
    // resolves `beans/defs` itself, and must read as JUDGED by the gates that
    // audit the bean store, never as `unaudited` or `typed-only`.
    const beanDefs = rows.find((r) => r.kind === "bean-defs");
    expect(beanDefs?.state).toBe("covered");
    expect(beanDefs?.directories.some((d) => d.endsWith("beans/defs"))).toBe(true);
    expect(beanDefs?.gates.length).toBeGreaterThan(0);
  });

  test("a kind judged only by a check its own layer's CI runs is covered, not typed-only", () => {
    // `cache` is judged by `caches:viz:check`, which cat-harness-tools
    // exempts as `covered-by` (its own `layer-pr-checks.yml` runs it at
    // every pin). Before, the index read the kind as TYPED and judged by
    // nothing, and `audit:coverage:strict` failed every re-pin that mounted it.
    const cache = rows.find((r) => r.kind === "cache");
    expect(cache?.files).toBeGreaterThan(0);
    expect(cache?.gates).toContain("bun run cat caches:viz:check");
    expect(cache?.state).toBe("covered");
  });

  test("the bean store is reported as audited — the defect that prompted this", () => {
    // 2026-09-23: an agent read zero `kg-qa` sidecars over the bean store and
    // reported beans "effectively unaudited". This is the assertion that the
    // command answers that question correctly.
    const beans = rows.find((r) => r.kind === "beans");
    expect(beans?.files).toBeGreaterThan(0);
    expect(beans?.gates.length).toBeGreaterThanOrEqual(5);
    expect(beans?.state).toBe("covered");
  });

  test("criteria are attributed through the declared bridge, not guessed", () => {
    // Each kind's criterion count must be exactly the criteria whose `applies`
    // maps here through `KG_SUBJECT_GRAPH_TYPOLOGIES`.
    for (const r of rows) {
      const expected = KG_CRITERIA.filter((c) => c.applies.some((s) => KG_SUBJECT_GRAPH_TYPOLOGIES[s] === r.kind));
      expect(r.criteria.sort()).toEqual([...new Set(expected.map((c) => c.id))].sort());
    }
  });

  test("every gate CI runs has declared — bean `3srh`", () => {
    // While any gate was undeclared, every "unaudited" verdict was an UPPER
    // BOUND rather than a verdict, and the report said so. This is what keeps
    // that caveat discharged: a new gate arriving undeclared turns the findings
    // back into a bound, silently, unless something fails.
    const undeclared = gates.filter((g) => g.state === "undeclared");
    expect(undeclared.map((g) => g.command)).toEqual([]);
  });

  test("a gate's every declared kind is a kind that has a row", () => {
    // A typo in an `@covers` line would otherwise credit a kind that does not
    // exist, and the gate would count as covering something while covering
    // nothing.
    const known = new Set(rows.map((r) => r.kind));
    for (const g of gates) {
      for (const k of g.covers) expect(known.has(k), `${g.command} declares "${k}", which is not a declared kind`).toBe(true);
    }
  });

  test("every gate lands in exactly one state, and none is left unclassified", () => {
    for (const g of gates) {
      expect(["declared", "none", "computed", "undeclared", "no-script"]).toContain(g.state);
      if (g.state === "declared") expect(g.covers.length).toBeGreaterThan(0);
      else expect(g.covers).toEqual([]);
      if (g.state !== "declared" && g.state !== "none" && g.state !== "computed") expect(g.why).toBeTruthy();
    }
  });
});

describe("the report is a fixpoint", () => {

  test("census excludes only what it is told to", () => {
    const dir = mkdtempSync(join(tmpdir(), "audit-coverage-skip-"));
    writeFileSync(join(dir, "a.qa-results.json"), "{}");
    writeFileSync(join(dir, "b.qa-results.json"), "{}");
    expect(census(dir, new Set()).sidecars).toBe(2);
    expect(census(dir, new Set([join(dir, "a.qa-results.json")])).sidecars).toBe(1);
  });
});

describe("the committed record is the coverage relation, not the census", () => {
  const { rows } = coverage(REPO);

  test("a file count is never written", () => {
    // A census moves on any commit that adds a file to any graph, so a gate
    // keyed on it is stale by default — and people learn to regenerate a
    // stale-by-default sidecar without reading it. Regenerating the L1 verdicts
    // under `library/` turned this gate red once, which is a QA writer in one
    // graph breaking another graph's coverage gate.
    const r = asRecord(rows[0]!);
    expect(r).not.toHaveProperty("files");
    expect(r).not.toHaveProperty("sidecars");
  });

  test("hasFiles carries the only thing the census decides", () => {
    // The three states turn on whether a directory holds anything at all, never
    // on how much, so that one bit is all the record needs from the count.
    for (const r of rows) expect(asRecord(r).hasFiles).toBe(r.files > 0);
  });

  test("everything that DEFINES coverage is written", () => {
    const r = asRecord(rows.find((x) => x.state === "covered")!);
    expect(r.directories).toBeDefined();
    expect(r.criteria).toBeDefined();
    expect(r.gates).toBeDefined();
    expect(r.state).toBe("covered");
  });
});

describe("kindUniverse", () => {
  test("the registry is the denominator, and an instance may add to it", () => {
    const u = kindUniverse(REPO);
    expect(u.registered.length).toBeGreaterThan(0);
    // The registry is OPEN, so a kind a layer declares and the registry
    // does not know is reported separately rather than dropped — dropping it
    // would shrink the denominator without saying so.
    for (const k of u.declaredOnly) expect(u.registered).not.toContain(k);
  });
});
