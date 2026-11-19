/**
 * A convention applies WHERE IT IS BOUND, and nowhere else.
 *
 * Bean `3190`, in the owner's words: *"coding conventions should also be part
 * of KG. its a specific type of context that should be set depending on the
 * process/workflow (e.g. in software development under CRDM) but not all
 * contexts should have it."*
 *
 * The load-bearing assertion is the NEGATIVE one — an unbound step carries
 * ZERO. A design defaulting to "all conventions" would be the unconditional
 * prose this replaces, wearing a schema, and every other test here would still
 * pass under it. So that case is first.
 *
 * @module scripts/tests/conventions.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { ConventionSchema, conventionsInForce } from "../../schemas/process/convention.ts";
import { loadProcessModel, processDiagrams } from "../../src/workflow/process-model.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { conventionsDir } from "../../schemas/kg/skill-definitions-dir.ts";
import { workflowFile, workflowFiles } from "../known-skills.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

// A real-corpus sweep: about five seconds already (4.5-4.7 s measured on
// main), past bun's 5s default once global tasks are indexed too.
const CORPUS_TIMEOUT = 60_000;

/** The harness root; diagrams are found by NAME through its declared `processes` graphs (bean `63wl`). */
const HARNESS = resolve(HARNESS_ROOT);

const INSTANCE = resolve(HARNESS_ROOT);
const REPO = repoRootFor(INSTANCE);
const BOUND = workflowFile(HARNESS, "code-change-review.bpmn");

describe("absent binding means NONE, not all", () => {
  test("a diagram that binds nothing gives every step zero conventions", async () => {
    // THE WHOLE DESIGN. If this returned "all", the scoping would be
    // decoration and the bean's problem would be untouched.
    const m = await loadProcessModel(workflowFile(HARNESS, "voice-review.bpmn"));
    const acts = [...m.nodes.values()].filter((n) => n.kind === "activity");
    expect(acts.length).toBeGreaterThan(0); // not vacuous
    expect(acts.filter((n) => n.conventions.length > 0)).toEqual([]);
  });

  test("a lane-scoped convention does NOT reach another lane", async () => {
    // The scoping proved by a negative rather than asserted in prose: the
    // authoring agent writes the checks, the pipeline does not, and only one
    // of them carries `no-clean-run-over-an-empty-set`.
    const m = await loadProcessModel(BOUND);
    const other = [...m.nodes.values()].find(
      (n) => n.kind === "activity" && n.lane && n.lane !== "Authoring agent",
    );
    expect(other).toBeDefined();
    const refs = other!.conventions.map((c) => c.ref);
    expect(refs).toContain("comment-why-not-what"); // process scope reaches it
    expect(refs).not.toContain("no-clean-run-over-an-empty-set"); // lane scope does not
  });
});

describe("the union along the scope chain", () => {
  test("process, then lane, then activity — in that order, de-duplicated", () => {
    expect(
      conventionsInForce({ process: ["a"], lane: ["b"], activity: ["c"] }),
    ).toEqual([
      { ref: "a", scope: "process" },
      { ref: "b", scope: "lane" },
      { ref: "c", scope: "activity" },
    ]);
  });

  test("a ref bound twice keeps its BROADEST scope, and appears once", () => {
    // Broadest wins because that is the true statement: a rule bound on the
    // process does apply process-wide, and re-binding it on one activity does
    // not narrow it. Reporting the narrow scope would tell an agent the rule
    // stops at the step, which is false.
    expect(conventionsInForce({ process: ["a"], activity: ["a"] })).toEqual([
      { ref: "a", scope: "process" },
    ]);
  });

  test("nothing bound anywhere is an empty list, not a throw", () => {
    expect(conventionsInForce({})).toEqual([]);
  });
});

describe("a convention is a declared KG node", () => {
  const dir = conventionsDir(REPO)!;

  test("the group exists and holds some — otherwise everything below is vacuous", () => {
    expect(existsSync(dir)).toBe(true);
    expect(readdirSync(dir).filter((f) => f.endsWith(".json")).length).toBeGreaterThan(0);
  });

  test("every one parses, and carries a statement a reader can act on", () => {
    // `statement` is required where `rationale` is not: a convention with no
    // statement is a name an agent cannot follow, and the point of moving
    // these out of prose was to make them readable where they apply.
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const parsed = ConventionSchema.safeParse(JSON.parse(readFileSync(join(dir, f), "utf-8")));
      expect({ [f]: parsed.success }).toEqual({ [f]: true });
      expect({ [f]: parsed.success && parsed.data.statement.length > 0 }).toEqual({ [f]: true });
    }
  });

  test("a convention with no statement is REFUSED", () => {
    expect(ConventionSchema.safeParse({ id: "x", title: "t" }).success).toBe(false);
  });
});

describe("every bound ref resolves to a convention that exists", () => {
  test("no diagram names a convention nobody wrote", async () => {
    // The dangling-reference direction. A ref pointing at nothing is the
    // `blv9` shape — a link-shaped value that does not dereference — and it
    // would leave an agent told to follow a rule it cannot read.
    const dir = conventionsDir(REPO)!;
    const known = new Set(
      readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)),
    );
    const dangling: string[] = [];
    let bound = 0;
    for (const f of processDiagrams(workflowFiles(HARNESS)).map((p) => relative(HARNESS, p))) {
      const m = await loadProcessModel(join(HARNESS, f));
      for (const n of m.nodes.values()) {
        for (const c of n.conventions) {
          bound++;
          if (!known.has(c.ref)) dangling.push(`${f}: ${c.ref}`);
        }
      }
    }
    expect(dangling).toEqual([]);
    // Non-vacuity: a corpus binding nothing would satisfy the check above and
    // prove the resolver was never exercised.
    expect(bound).toBeGreaterThan(0);
  }, CORPUS_TIMEOUT);
});
