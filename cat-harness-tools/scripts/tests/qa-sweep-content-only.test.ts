/**
 * A sweep runs on ACTIVE content, and the declaration says which that is.
 *
 * Owner, 2026-09-20: *"qa-sweep skips fsh-guts"*, and the general form in the
 * same breath — *"qasweep is only on active/working content, unless explicit
 * otherwise"*.
 *
 * ## It is the existing axis, not a new one
 *
 * `fsh-guts` declares `holds: "context"` — *"Read, never written by a
 * process"* — because what is in it is deprecated or superseded. So the rule
 * needs no directory name: `graphLayer` already answers it, and a graph
 * retired tomorrow is skipped the day it is declared.
 *
 * ## Why this is a guard and not a fix
 *
 * Measured 2026-09-20 before writing it: `walkBlocks` over `fsh-guts/` yields
 * **0** blocks, because the only `.ts` in there is a script rather than a
 * manifest. Nothing is wrong today. The rule exists for the day somebody
 * retires a real block into it — which is what the directory is FOR — at
 * which point a sweep would report findings about material nobody maintains,
 * and a reader could not tell those from live ones.
 *
 * @module cat-harness/scripts/tests/qa-sweep-content-only.test
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { harnessPath } from "../lib/harness-layout.ts";
import { graphLayer, isContentGraph, isContextGraph, isDerivedGraph, isStateGraph, processMayWrite, repoRootFor } from "../../schemas/kg/cat-harness.js";

import { walkBlocks } from "../../pipeline/qa-utils.js";
import {  } from "../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

/** A block manifest `walkBlocks` will admit without importing it. */
const MANIFEST = 'import { prose } from "./builders";\nexport default prose({ label: "probe", body: "x" });\n';

/**
 * A repo with one block in a `content` directory and one in a `context` one.
 *
 * `.git` so `findContentRepoRoot` stops here rather than walking out into the
 * real checkout and reading ITS declaration — which would make the fixture
 * depend on this repository's layout.
 */
function fixture(): { root: string } {
  const root = mkdtempSync(join(tmpdir(), "sweep-scope-"));
  mkdirSync(join(root, ".git"), { recursive: true });
  writeDeclaration(root, JSON.stringify({
      name: "probe",
      description: "one content directory and one retired one",
      directories: [
        { id: "folio", path: "folio/", graphTypologies: ["folio"] },
        { id: "fsh-guts", path: "fsh-guts/", graphTypologies: ["fsh-guts"] },
      ],
    }));
  for (const d of ["folio", "fsh-guts"]) {
    mkdirSync(join(root, d), { recursive: true });
    writeFileSync(join(root, d, "probe.ts"), MANIFEST);
  }
  return { root };
}

const walked = (root: string, opts = {}) =>
  [...walkBlocks(root, { verify: false, includeUnlabelled: true, ...opts })]
    .map((b) => b.ts.slice(root.length + 1));

describe("a sweep walks content and skips what is declared retired", () => {
  test("the fixture is real — both blocks exist and are admissible", () => {
    // A filter over nothing passes. Proved by asking for everything first.
    const all = walked(fixture().root, { includeNonContent: true });
    expect(all.sort()).toEqual(["folio/probe.ts", "fsh-guts/probe.ts"]);
  });

  test("by default the `fsh-guts` block is NOT walked", () => {
    expect(walked(fixture().root)).toEqual(["folio/probe.ts"]);
  });

  test("`includeNonContent` is the 'unless explicit otherwise'", () => {
    const { root } = fixture();
    expect(walked(root, { includeNonContent: true })).toContain("fsh-guts/probe.ts");
  });

  test("the FOLIO is never the thing skipped — the corpus is what a sweep is for", () => {
    // The failure that would matter most: a rule meant to exclude retired
    // material excluding the active corpus instead, and reporting clean.
    expect(walked(fixture().root)).toContain("folio/probe.ts");
  });

  test("an entry declaring NO graphs is walked — silence is not evidence of retirement", () => {
    const root = mkdtempSync(join(tmpdir(), "sweep-scope-bare-"));
    mkdirSync(join(root, ".git"), { recursive: true });
    writeDeclaration(root, JSON.stringify({
        name: "probe",
        description: "an entry with no graphs",
        directories: [{ id: "odd", path: "odd/", graphTypologies: [] }],
      }));
    mkdirSync(join(root, "odd"), { recursive: true });
    writeFileSync(join(root, "odd", "probe.ts"), MANIFEST);
    expect(walked(root)).toEqual(["odd/probe.ts"]);
  });

  test("a MALFORMED declaration walks everything rather than nothing", () => {
    // A walker that refuses to enumerate because a config is broken turns a
    // config fault into a total QA outage — reporting clean by looking at
    // nothing, which is the failure this repository names most often.
    const root = mkdtempSync(join(tmpdir(), "sweep-scope-bad-"));
    mkdirSync(join(root, ".git"), { recursive: true });
    writeDeclaration(root, "{ not json at all", "broken");
    mkdirSync(join(root, "folio"), { recursive: true });
    writeFileSync(join(root, "folio", "probe.ts"), MANIFEST);
    expect(walked(root)).toEqual(["folio/probe.ts"]);
  });
});

describe("why the skip needs no 'unknown layer' arm", () => {
  test("an unknown graph typology THROWS in readDeclaration, so it never reaches the filter", async () => {
    // The first draft of the skip carried `l !== undefined` for the case of a
    // kind `graphLayer` cannot place. That case cannot arise, and this is the
    // measurement rather than the argument: an unknown kind is refused at the
    // declaration, and a registered one always has `holds` because the schema
    // requires it. Unreachable defensive code is the `no-runs` defect from
    // bean `lr7h`, one file along.
    const { readDeclaration } = await import("../../schemas/kg/cat-harness.js");
    const root = mkdtempSync(join(tmpdir(), "sweep-scope-unknown-"));
    writeDeclaration(root, JSON.stringify({
        name: "probe",
        description: "names a kind nothing registers",
        directories: [{ id: "x", path: "x/", graphTypologies: ["totally-made-up"] }],
      }));
    expect(() => readDeclaration(root)).toThrow(/unknown graph typology/);
  });

  test("...and such a repo is WALKED, not silently emptied", () => {
    // The throw is caught by the walker, which then skips nothing. A config
    // fault must not become a total QA outage.
    const root = mkdtempSync(join(tmpdir(), "sweep-scope-unknown2-"));
    mkdirSync(join(root, ".git"), { recursive: true });
    writeDeclaration(root, JSON.stringify({
        name: "probe",
        description: "names a kind nothing registers",
        directories: [{ id: "x", path: "x/", graphTypologies: ["totally-made-up"] }],
      }));
    mkdirSync(join(root, "x"), { recursive: true });
    writeFileSync(join(root, "x", "probe.ts"), MANIFEST);
    expect(walked(root)).toEqual(["x/probe.ts"]);
  });
});

describe("`derived` — the fourth layer, and why `library/` is on it (bean `hqku`)", () => {
  /**
   * Owner, 2026-09-20: *"library is static (only if we materialize assets or
   * not)"*, *"can duplicate asset into a folio and work there"*.
   *
   * The interesting part is not the ruling, it is that BOTH existing
   * candidates were ruled out by a rule rather than by taste — which is what
   * `content-context-and-state-graphs.md` means by "say so rather than
   * picking". These tests pin both eliminations, because a later reader who
   * only sees the outcome will reach for one of them again.
   */
  test("`library` is `derived`", () => {
    expect(graphLayer("library")).toBe("derived");
    expect(isDerivedGraph("library")).toBe(true);
  });

  test("...so a sweep skips it, with no directory name written down", () => {
    // The whole reason this is a declared layer rather than a hardcoded skip:
    // a path in a checker is what the declaration exists to remove.
    expect(isContentGraph("library")).toBe(false);
  });

  test("`context` is ruled out — a declared process WRITES library/", () => {
    // `context` carries "a step that writes to it is a defect, not an update".
    // `document-ingestion.bpmn` writes `library/`, so declaring it `context`
    // would have made a declared process a defect by the axis's own rule.
    // This is the elimination, asserted against the actual diagram.
    const bpmn = readFileSync(
      harnessPath("library/processes/document-ingestion.bpmn", join(repoRootFor(resolve(HARNESS_ROOT)), "cat-harness")),
      "utf-8",
    );
    expect(bpmn).toContain("library");
    expect(graphLayer("library")).not.toBe("context");
  });

  test("a `derived` graph is not writable-in-passing either — it is produced", () => {
    // `processMayWrite` is about bookkeeping writes a step performs in
    // passing. Producing a library section from a source is an ingestion
    // OUTPUT, the same way authoring content is, so it stays false — adding a
    // fourth layer must not quietly widen what a step may scribble on.
    expect(processMayWrite("library")).toBe(false);
  });

  test("the layer predicates stay mutually exclusive, and none is a negation", () => {
    // Narrowed deliberately when `context` arrived; the same must hold now
    // that there are four. A caller asking "is this the subject matter" and a
    // caller asking "may a step write this" must not share a predicate.
    for (const kind of ["library", "folio", "beans", "memory"]) {
      const hits = [isContentGraph(kind), isContextGraph(kind), isStateGraph(kind), isDerivedGraph(kind)].filter(
        Boolean,
      );
      expect(hits.length).toBeLessThanOrEqual(1);
    }
  });

  test("an unregistered kind is still not `derived` — absence says nothing", () => {
    expect(isDerivedGraph("not-a-kind")).toBe(false);
  });
});
