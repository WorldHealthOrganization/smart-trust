/**
 * No call site takes the FIRST directory of a graph without saying it expects
 * one — and saying it means an accessor that refuses, not an index.
 *
 * ## The history this guards
 *
 * `directoryForGraph` returned the first declaration silently and was excised
 * on 2026-09-20 after costing three bugs in a day. `directoriesForGraph`'s doc
 * comment then settled where the singular assumption belongs, and that
 * decision stands:
 *
 * > *A caller that genuinely wants one writes `directoriesForGraph(...)[0]`,
 * > so the assumption is visible where it is made and greppable across the
 * > repo.*
 *
 * Visible, yes. **Checked, no.** `[0]` states "I expect one home" and then
 * quietly takes the first when there are four — and `schemas` HAD four, with
 * four call sites indexing it, for as long as nobody looked. Bean `a02m`.
 *
 * ## Why a test and not a review habit
 *
 * The last fix of this shape was `schema-nodes.ts`, one site, and it left
 * thirty-one. A defect that is fixed one occurrence at a time is a defect that
 * comes back, because the fix is knowledge in one person's head at one moment.
 * `directoryForGraph` and `instanceDirectoryForGraph` make the assumption
 * enforceable; this makes it enforced.
 *
 * @module scripts/tests/no-silent-first-directory
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { writeDeclaration } from "../../test/support/instance-fixture.js";

import {
  instanceDirectoriesForGraph,
  optInDirectoriesForGraph,
  instanceDirectoryForGraph,
  layerRootsIn,
} from "../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

/** The repository root — this rule is about every layer, not one. */
const REPO = resolve(dirname(HARNESS_ROOT));

/** Directories that are not source we control. */
const SKIP = new Set(["node_modules", "_kg", "_site", "dist", "build"]);

/**
 * `directoriesForGraph(…)[0]` in CODE.
 *
 * Deliberately not matched inside a comment: the migrated call sites each
 * explain what they used to be, naming the old form, and a check that cannot
 * be written about is a check nobody can leave a note beside. Comment lines
 * are stripped before matching rather than excluded by a cleverer pattern,
 * because a pattern that tries to tell code from prose in one regex is the
 * kind of thing that silently stops matching.
 */
const OFFENDING = /directoriesForGraph\([^;]*?\)\s*\[\s*0\s*\]/;

/** Strip `//` and `/* *​/` comments, crudely but predictably. */
function withoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => (/^\s*(\/\/|\*)/.test(l) ? "" : l))
    .join("\n");
}

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.startsWith(".") || SKIP.has(e)) continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      if (e.endsWith(".ts")) out.push(p);
    }
  };
  walk(REPO);
  return out.sort();
}

describe("a call site that wants ONE directory says so with an accessor that refuses", () => {
  const files = sourceFiles();

  test("the scan found source — otherwise the assertion below proves nothing", () => {
    // A floor, not a count. The failure this guards against is the scan
    // matching nothing and the suite reporting a clean sweep over it, which is
    // the same shape as the defect the whole bean is about.
    expect(files.length).toBeGreaterThan(200);
  });

  test("no module indexes the first declared directory", () => {
    const offenders: string[] = [];
    for (const f of files) {
      // This file quotes the offending form in its own documentation.
      if (f.endsWith("no-silent-first-directory.test.ts")) continue;
      if (OFFENDING.test(withoutComments(readFileSync(f, "utf-8")))) {
        offenders.push(relative(REPO, f));
      }
    }
    // Named, not counted: a failure should say which file to open. The message
    // is part of the check — "2 offenders" sends the next person grepping for
    // the same thing this test already knows.
    expect(
      offenders,
      "use directoryForGraph (refuses when there are several), " +
        "instanceDirectoryForGraph (the one at this instance's own root), " +
        "or directoriesForGraph and scan them all",
    ).toEqual([]);
  });
});

/* ─────────── the other half: a PLURAL caller needs a plural accessor ─────────── */

const fixtures: string[] = [];
afterAll(() => {
  for (const d of fixtures) rmSync(d, { recursive: true, force: true });
});

/**
 * A layer declaring `schemas` at two directories of its own — the shape
 * `large-datasets` had (`schemas/` and `sources/`) until bean `j7ql`.
 */
function fixtureDeclaringSchemasTwice(): string {
  // A checkout of its own, as the audit expects one: a root `package.json`
  // beside the layer, and no sibling it did not make.
  const checkout = mkdtempSync(join(tmpdir(), "schemas-twice-"));
  fixtures.push(checkout);
  writeFileSync(join(checkout, "package.json"), JSON.stringify({ name: "fixture", scripts: {} }));
  const root = join(checkout, "schemas-twice");
  for (const d of ["schemas", "sources"]) {
    mkdirSync(join(root, d), { recursive: true });
    writeFileSync(join(root, d, ".keep"), "");
  }
  writeDeclaration(root, {
    name: "schemas-twice",
    version: "0.0.0",
    directories: [
      { id: "twice-schemas", path: "schemas/", graphTypologies: ["schemas"] },
      { id: "twice-sources", path: "sources/", graphTypologies: ["schemas"] },
    ],
  });
  return root;
}

describe("an instance that declares a kind twice is auditable, not a crash", () => {
  /**
   * The refusal above is right, and it made a real caller CRASH rather than
   * report — which is the failure mode this file did not yet cover.
   *
   * Measured 2026-09-27: `kg:audit --instance ./large-datasets` never audited
   * anything. It threw inside `instanceDirectoryForGraph`, called from
   * `unclaimedSkillContracts`, because that layer declares TWO `schemas`
   * directories at its own root:
   *
   *     large-datasets-schemas → large-datasets/schemas
   *     large-datasets-sources → large-datasets/sources
   *
   * Both are legal; `cat-harness.json` declares `schemas` several times too. So
   * the singular was simply the wrong question for a caller that wants to scan
   * every contract directory, and the remedy is the plural accessor rather than
   * an index — `[0]` here would have hidden one layer's contracts from the
   * audit and reported a clean run, which is the `dh4f` shape this whole file
   * exists to prevent.
   */
  test("the singular refuses exactly when the plural finds several", () => {
    const disagreements: string[] = [];
    for (const inst of layerRootsIn(REPO)) {
      // The singular leaves out what sits inside a switched-on opt-in
      // sub-graph (an ADDITIONAL graph of the kind, `optInDirectoriesForGraph`),
      // and the plural keeps it, since a caller scanning every contract
      // directory needs it. The invariant is over the set both ask about:
      // smart-base's opt-in levels (`L1/` … `L4/`) each hold a `schemas/`.
      const optIn = new Set(optInDirectoriesForGraph(inst, "schemas"));
      const all = instanceDirectoriesForGraph(inst, "schemas").filter((d) => !optIn.has(d));
      let threw = false;
      try {
        instanceDirectoryForGraph(inst, "schemas");
      } catch {
        threw = true;
      }
      // The invariant that lets a caller choose: refusal and plurality are the
      // same fact. If they ever came apart, one of the two accessors would be
      // lying about the declaration.
      if (threw !== all.length > 1) {
        disagreements.push(
          `${relative(REPO, inst) || "."}: plural=${all.length} but singular ${threw ? "threw" : "returned"}`,
        );
      }
    }
    expect(disagreements).toEqual([]);
  });

  test("an instance that declares a kind twice really is plural, so the case above is live", () => {
    // Anti-vacuity. With no such layer the assertion above holds trivially
    // and would keep passing after a regression — the shape that let the
    // original `[0]` survive unnoticed. The real one was `large-datasets`
    // until bean `j7ql` (2026-10-01) dissolved it into cat-harness and its two
    // `schemas` directories went to two different owners, so the case is a
    // FIXTURE now: a live case must not depend on the corpus happening to
    // contain one.
    const twice = fixtureDeclaringSchemasTwice();
    expect(instanceDirectoriesForGraph(twice, "schemas")).toHaveLength(2);
    expect(() => instanceDirectoryForGraph(twice, "schemas")).toThrow();
  });

  /**
   * The test that would actually have caught it.
   *
   * The two above pin the ACCESSORS; neither would have failed on the real
   * defect, which was a caller choosing the singular where its question was
   * plural. No grep finds that — `instanceDirectoryForGraph(root, "schemas")`
   * is the correct call in several places and wrong in one. Only running the
   * thing shows it, so this runs the thing.
   *
   * `--check` writes nothing, verified: it reports staleness and exits non-zero
   * on a layer whose sidecars are not committed, which `large-datasets`'s
   * are not. The assertion is therefore about the CRASH and not the exit code.
   */
  test("kg:audit --instance runs on such an instance instead of throwing", async () => {
    const plural = fixtureDeclaringSchemasTwice();
    expect(instanceDirectoriesForGraph(plural, "schemas").length, "the fixture must declare `schemas` twice").toBe(2);
    const rel = plural;

    const p = Bun.spawn(
      ["bun", "run", "cat-harness-tools/scripts/kg-audit.ts", "--instance", rel, "--check"],
      { cwd: REPO, stdout: "pipe", stderr: "pipe" },
    );
    const out = await new Response(p.stdout).text();
    const err = await new Response(p.stderr).text();
    await p.exited;

    // The exact throw this regressed on, named so a failure points at the cause
    // rather than at a non-zero exit that `--check` produces legitimately.
    expect(
      err.includes("this call site expects one"),
      `the audit threw instead of auditing:\n${err.slice(0, 600)}`,
    ).toBe(false);
    // And it must have got far enough to report, not merely failed differently.
    expect(out, `no audit summary in:\n${out.slice(0, 300)}${err.slice(0, 300)}`).toMatch(
      /Knowledge-graph audit\s+\(\d+ subjects/,
    );
    // It spawns a whole audit of the checkout, which takes 10-15 s even warm.
  }, 60_000);
});

