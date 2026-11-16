/**
 * The guard has to FAIL on each defect it claims to catch.
 * Every OPEN bean is placed under an epic or a milestone. This is what keeps
 * Written against temp stores rather than the real one on purpose: the real
 * corpus is clean, so a test that only asserts "the repo passes" would go on
 * passing if the checker were gutted to `return { problems: [] }`. Each case
 * here perturbs one thing and names what must appear in the finding.
 *
 * @module scripts/tests/check-bean-parents
 *
 * The tests here that read the aggregate repository's own root (the
 * root-declared `beans/` store) live in
 * `test/check-bean-parents-repo-root.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkBeanParents } from "../check-bean-parents.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A store of beans, each given as [id, status, type, parent]. */
function store(beans: Array<[string, string, string, string]>): string {
  const root = mkdtempSync(join(tmpdir(), "beanparents-"));
  made.push(root);
  // `root` IS a repository root — a fixture has no enclosing layer, so
  // `repoRootFor(root)` is `/tmp` and every store this made was the same one.
  const dir = join(root, "beans", "defs");
  mkdirSync(dir, { recursive: true });
  for (const [id, status, type, parent] of beans) {
    writeFileSync(
      join(dir, `${id}.md`),
      `---\n# ${id}\ntitle: '${id} title'\nstatus: ${status}\ntype: ${type}\n` +
        (parent ? `parent: ${parent}\n` : "") +
        `---\n\nbody\n`,
    );
  }
  return root;
}

const EPIC: [string, string, string, string] = ["ep1", "in-progress", "epic", ""];

describe("every open bean belongs to an epic", () => {
  test("passes when each open bean names a real epic", () => {
    const r = checkBeanParents(store([EPIC, ["a1", "todo", "task", "ep1"]]));
    expect(r.problems).toEqual([]);
    expect(r.open).toBe(1);
  });

  test("fails on an open bean with no parent, and names it", () => {
    const r = checkBeanParents(store([EPIC, ["a1", "todo", "task", ""]]));
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toContain("a1");
    expect(r.problems[0]).toContain("no `parent`");
  });

  test("fails on a parent that names no bean", () => {
    // Worse than no parent: the roadmap omits the child rather than listing
    // it under Miscellaneous, so it disappears from the plan entirely.
    const r = checkBeanParents(store([EPIC, ["a1", "todo", "task", "ghost"]]));
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toContain("names no bean");
  });

  test("fails on a parent that is not an epic", () => {
    const r = checkBeanParents(store([
      EPIC,
      ["a1", "todo", "task", "ep1"],
      ["a2", "todo", "task", "a1"],
    ]));
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toContain("a2");
    expect(r.problems[0]).toContain("not a milestone, epic or feature");
  });

  test("a CLOSED bean needs no parent — history is not back-filled", () => {
    const r = checkBeanParents(store([
      EPIC,
      ["done1", "completed", "task", ""],
      ["drop1", "scrapped", "task", ""],
    ]));
    expect(r.problems).toEqual([]);
    expect(r.open).toBe(0);
  });

  test("an epic needs no parent of its own — epics are roots", () => {
    expect(checkBeanParents(store([EPIC, ["ep2", "todo", "epic", ""]])).problems).toEqual([]);
  });

  test("no bean store is reported as such, never as a pass", () => {
    const root = mkdtempSync(join(tmpdir(), "beanparents-empty-"));
    made.push(root);
    const r = checkBeanParents(root);
    // `store: null` is the third state. It exits 0 because there is nothing to
    // check, and the report says so rather than claiming the plan is sound.
    expect(r.store).toBeNull();
    expect(r.problems).toEqual([]);
  });

  // A MILESTONE IS A ROOT, and until 2026-09-20 this checker did not know it.
  //
  // `beans prime` states the hierarchy as `milestone -> epic -> feature ->
  // task/bug`, so a milestone sits above an epic and has nothing to hang
  // from. Only `epic` was exempt, and the first three milestones ever created
  // (the owner's goals, bean `wqht`) failed on the day they landed, demanding
  // a parent that by the hierarchy cannot exist.
  //
  // Both directions are asserted. Without the second test, deleting
  // `PARENT_TYPES` and accepting ANY parent type would still pass the first.
  test("a milestone needs no parent of its own — milestones are roots too", () => {
    const r = checkBeanParents(store([["ms1", "in-progress", "milestone", ""]]));
    expect(r.problems).toEqual([]);
    // It is excluded from the population, not merely forgiven within it.
    expect(r.open).toBe(0);
  });

  test("an epic may hang from a milestone", () => {
    const r = checkBeanParents(store([
      ["ms1", "in-progress", "milestone", ""],
      ["ep1", "in-progress", "epic", "ms1"],
      ["t1", "todo", "task", "ep1"],
    ]));
    expect(r.problems).toEqual([]);
  });

  test("a task parented to a MILESTONE is accepted, to a task is not", () => {
    // Accepting a milestone as a parent is deliberate: it is a root, so a
    // bean hanging from one is placed. A task is not, and that is the
    // original reason the constraint exists.
    expect(checkBeanParents(store([
      ["ms1", "in-progress", "milestone", ""],
      ["t1", "todo", "task", "ms1"],
    ])).problems).toEqual([]);

    const bad = checkBeanParents(store([
      EPIC,
      ["t1", "todo", "task", "ep1"],
      ["t2", "todo", "task", "t1"],
    ]));
    expect(bad.problems).toHaveLength(1);
    expect(bad.problems[0]).toContain("not a milestone, epic or feature");
  });
});

/*
 * THE RULE IS REACHABLE — `itka`, issue #941.
 *
 * `check-bean-parents.ts` carried an epic-under-epic branch and built the set
 * it ran over by filtering `ROOT_TYPES` out, so no `b` in the loop was ever an
 * epic and the branch could not be taken. The summary printed it as verified.
 *
 * THE FIRST TEST HERE IS THE ONE THAT MATTERS, and it is written to fail if
 * the exclusion is ever widened back: it asserts a FINDING rather than the
 * absence of one, so it cannot pass vacuously the way the rule itself did.
 */
describe("an epic's parent is a milestone, not another epic", () => {
  test("catches an epic parented to an epic — the rule the filter made unreachable", () => {
    const r = checkBeanParents(
      store([
        ["ms1", "in-progress", "milestone", ""],
        ["ep1", "in-progress", "epic", "ms1"],
        ["ep2", "in-progress", "epic", "ep1"],
      ]),
    );
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toContain("ep2");
    // The REQUIREMENT, not the old negation. This read "not another epic"
    // until the rule was stated positively (owner's ruling, 2026-09-22); an
    // assertion on one forbidden case is exactly what let `epic -> feature`
    // through when `PARENT_TYPES` widened.
    expect(r.problems[0]).toContain("is a `milestone`");
  });

  test("an epic under a milestone is fine", () => {
    const r = checkBeanParents(
      store([
        ["ms1", "in-progress", "milestone", ""],
        ["ep1", "in-progress", "epic", "ms1"],
      ]),
    );
    expect(r.problems).toEqual([]);
  });

  /* THE EXCLUSION STILL DOES ITS JOB, which is the half a careless fix breaks:
   * deleting it outright would demand a parent of every root. A root is not
   * REQUIRED to carry one — it is only judged on the one it has. */
  test("a root with no parent is still excused", () => {
    const r = checkBeanParents(
      store([
        ["ms1", "in-progress", "milestone", ""],
        ["ep1", "in-progress", "epic", ""],
      ]),
    );
    expect(r.problems).toEqual([]);
  });

  /* `open` counts what sits BELOW the roots, and kept meaning that when the
   * loop widened to include them. A count that silently changed definition
   * would make every historical reading of this report wrong. */
  test("the open count still excludes roots", () => {
    const r = checkBeanParents(
      store([
        ["ms1", "in-progress", "milestone", ""],
        ["ep1", "in-progress", "epic", "ms1"],
        ["t1", "todo", "task", "ep1"],
      ]),
    );
    expect(r.open).toBe(1);
  });
});

/*
 * `feature` IS A TIER — the owner's ruling, 2026-09-22 (`itka` finding 2,
 * issue #941). `beans prime` states `milestone -> epic -> feature ->
 * task/bug`; `PARENT_TYPES` omitted `feature` while this file's own header
 * quoted that sentence, so the check cited the rule and contradicted it.
 */
describe("a feature may hold tasks, and still may not hold an epic", () => {
  test("a task under a feature is accepted", () => {
    const r = checkBeanParents(
      store([
        ["ms1", "in-progress", "milestone", ""],
        ["ep1", "in-progress", "epic", "ms1"],
        ["ft1", "in-progress", "feature", "ep1"],
        ["t1", "todo", "task", "ft1"],
      ]),
    );
    expect(r.problems).toEqual([]);
  });

  /* THE HOLE THE RULING OPENS, closed in the same change and pinned here.
   *
   * Widening `PARENT_TYPES` makes `epic -> feature` pass the type check, and
   * the epic rule USED to read `p.type === "epic"` — testing one wrong parent
   * out of the set rather than requiring the right one. That combination
   * inverts the hierarchy: a goal's child hanging off one of its own
   * grandchildren. Stated positively, it cannot be holed by a later addition.
   */
  test("an epic under a feature is still refused", () => {
    const r = checkBeanParents(
      store([
        ["ms1", "in-progress", "milestone", ""],
        ["ep1", "in-progress", "epic", "ms1"],
        ["ft1", "in-progress", "feature", "ep1"],
        ["ep2", "in-progress", "epic", "ft1"],
      ]),
    );
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toContain("ep2");
    expect(r.problems[0]).toContain("is a `milestone`");
  });

  test("the message names the offending parent's type rather than guessing an article", () => {
    // "is a epic" is what an article in a template gets you. The message
    // reports the type in backticks so there is no article to get wrong.
    const r = checkBeanParents(
      store([
        ["ms1", "in-progress", "milestone", ""],
        ["ep1", "in-progress", "epic", "ms1"],
        ["ep2", "in-progress", "epic", "ep1"],
      ]),
    );
    expect(r.problems[0]).toContain("has type `epic`");
    expect(r.problems[0]).not.toContain("is a epic");
  });
});
