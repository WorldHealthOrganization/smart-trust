/**
 * Tests for the phase-contract detector — bean `folio-assistant-8v0y`.
 *
 * **Every test runs over a SYNTHETIC tree or a literal string.** Nothing here
 * reads `beans/`. That is a requirement rather than a preference: a prior
 * session's tests for this subject walked the real tree five times and pushed
 * a sibling test past its 5 s timeout, and a test that makes a sibling fail is
 * still that test's defect.
 *
 * The load-bearing pair is {@link KN0T_BEFORE} / {@link KN0T_AFTER}: the two
 * states of ONE bean, before and after PR #1185. A rule that cannot separate
 * them is not a rule, whatever else it scores.
 *
 * The rest pin DISCRIMINATIONS rather than the happy path, because every one
 * of them was a measured false positive of a looser rule — see the module docs
 * on `check-bean-restates-skill.ts` for the eight beans and their ids.
 *
 * @module scripts/tests/check-bean-restates-skill.test
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkBeanRestatesSkill,
  contractTables,
  formatReport,
  parseTables,
  skillPathsNamed,
} from "../check-bean-restates-skill.ts";

/**
 * `kn0t`'s body as it stood at `f8ed0c1a^` — the defect, verbatim.
 *
 * Trimmed to the structure under test; the phase table is byte-for-byte what
 * the bean carried. Note what it does NOT contain: any path into `skills/`.
 */
const KN0T_BEFORE = `
Reduce the IG Publisher to **AST + QA**, in phases with a stated exit criterion
each, so that publication and iteration stop depending on a full build.

## Proposed phases — NOT yet approved

| phase | does | exit criterion |
|---|---|---|
| P0 | lift the metadata->variables bridge | one IG's pages render with Publisher metadata |
| P1 | LHS navbar derived from \`sushi-config.yaml\` | navigation matches the Publisher's for one IG, derived not authored |
| P2 | JSON-only representations | no representation silently dropped |
| P3 | AST dump behind a flag on the fork | indices/deps marked stale-until-full-run |
| P4 | Publisher invoked for AST + QA only | a release still cut from a full build, and provably so |

## Done when
- [ ] the phases are approved by the owner, or replaced
`;

/** The same bean after PR #1185: a pointer, a drift record, and a Done-when. */
const KN0T_AFTER = `
## The plan is the SKILL. This bean is the work-plan entry.

> [\`fhir-harness/skills/fhir-ig-base/ig-publisher-reduction.md\`](../../fhir-harness/skills/fhir-ig-base/ig-publisher-reduction.md)

It carries the owner's ask verbatim, the five phases with their exit criteria,
the staleness contract, and what is not settled.

### The three drifts, recorded so the repair is checkable

| | this bean said | the skill says |
|---|---|---|
| **P1 exit** | "navigation matches the Publisher's for one IG" | the derived navigation is **diffed** and the difference is **empty or explained entry by entry** |
| **P4 exit** | "a release still cut from a full build, and provably so" | ...and the artefact **says which** build it came from |
| **open items** | 2 listed | **3** |

**Consequence for approval:** P3's exit criterion is not merely hard against
today's data, it is **unsatisfiable**: there are no edges to mark.

## Done when
- [ ] the phases are approved by the owner, or replaced — **as the SKILL states them**
`;

describe("the fixture that decides it — one bean, two states", () => {
  test("kn0t BEFORE PR #1185 is flagged", () => {
    const found = contractTables(KN0T_BEFORE);
    expect(found).toHaveLength(1);
    expect(found[0]!.raw).toBe("| phase | does | exit criterion |");
    expect(found[0]!.rows).toHaveLength(5);
  });

  test("kn0t AFTER PR #1185 is clean — though it still says 'exit criterion' twice", () => {
    expect(KN0T_AFTER).toContain("exit criteri");
    expect(contractTables(KN0T_AFTER)).toHaveLength(0);
  });

  test("the pre-repair bean named NO skill — so the pointer cannot be a CONDITION", () => {
    // The conjunction in the original specification, falsified. Requiring the
    // pointer would have caught none of the defect the gate was built for.
    expect(skillPathsNamed(KN0T_BEFORE)).toEqual([]);
    expect(skillPathsNamed(KN0T_AFTER)).toContain(
      "fhir-harness/skills/fhir-ig-base/ig-publisher-reduction.md",
    );
  });
});

describe("the measured false positives, each pinned as clean", () => {
  test("`3pqn` — an exit-CODE table is not a contract", () => {
    expect(
      contractTables(`
| state | means | exit |
|---|---|---|
| has a run | a run names this exact \`head_sha\` | 0 |
| **no run** | GitHub answered, and nothing names it | 1 |
| could not ask | no remote, no network, 403, 404 | 2 |
`),
    ).toHaveLength(0);
  });

  test("`6f1x` — an exit column that IS the first column, still codes", () => {
    expect(
      contractTables(`
| exit | meaning |
|--:|---|
| **0** | every claim's artefact is a file in the tree |
| **1** | a claim names a path the built site does not carry |
| **2** | **could not determine** |
`),
    ).toHaveLength(0);
  });

  test("`3kbd` — QA criteria as identifiers are a design record, not a contract", () => {
    expect(
      contractTables(`
| criterion | severity | why |
|---|---|---|
| \`raci-role-resolves\` | \`critical\` | it **is** \`role-ref-resolves\` on a different edge |
| \`raci-single-accountable\` | \`major\` | every role named exists |
`),
    ).toHaveLength(0);
  });

  test("`5xfr` — a registry read-off keyed by domain is not a contract", () => {
    expect(
      contractTables(`
| domain | criteria |
|---|---|
| \`framework\` | \`framework-canonical\` |
| \`wall\` | \`wall-side-correct\`, \`wall-base-ring-minimal\` |
| \`detangler\` | \`detangler-archimedean-wall\` |
`),
    ).toHaveLength(0);
  });

  test("`jut3` — a measurement table has no criterion column at all", () => {
    expect(
      contractTables(`
| page kind | Publisher publishes | rendered here | gap |
|---|---|---|---|
| artefact detail | **673** | **19** | 654 |
| narrative pages | **could not determine** | 0 | **undetermined** |
`),
    ).toHaveLength(0);
  });
});

describe("the conditions, each falsified by mutation", () => {
  const phased = (criterionCol: string) => `
| phase | does | ${criterionCol} |
|---|---|---|
| P0 | one thing | it happened |
| P1 | another | it also happened |
`;

  test("drop the criterion column and it is an ordinary plan table", () => {
    expect(contractTables(phased("exit criterion"))).toHaveLength(1);
    expect(contractTables(phased("notes"))).toHaveLength(0);
  });

  test("drop the phase enumeration and it is an ordinary criterion table", () => {
    expect(
      contractTables(`
| area | exit criterion |
|---|---|
| navigation | it is diffed |
| terminology | it is diffed |
`),
    ).toHaveLength(0);
  });

  test("a numbered phase in the CELLS carries it when the header does not", () => {
    expect(
      contractTables(`
| what | does | exit criterion |
|---|---|---|
| Phase 1 | one thing | it is diffed |
| Phase 2 | another | it is diffed |
`),
    ).toHaveLength(1);
  });

  test("ONE numbered cell is not an enumeration — two are", () => {
    const one = `
| what | does | exit criterion |
|---|---|---|
| P0 | one thing | it is diffed |
| the rest | another | it is diffed |
`;
    expect(contractTables(one)).toHaveLength(0);
    expect(contractTables(one.replace("| the rest |", "| P1 |"))).toHaveLength(1);
  });

  test("a single data row is a heading in disguise, not a contract", () => {
    expect(
      contractTables(`
| phase | does | exit criterion |
|---|---|---|
| P0 | one thing | it happened |
`),
    ).toHaveLength(0);
  });

  test("a numeric criterion among prose rows still counts — the exclusion is ALL or nothing", () => {
    expect(
      contractTables(`
| phase | does | exit criterion |
|---|---|---|
| P0 | one thing | 0 |
| P1 | another | the difference is empty or explained entry by entry |
`),
    ).toHaveLength(1);
  });
});

describe("parseTables", () => {
  test("two tables separated by prose are two tables, not one", () => {
    const t = parseTables(`
| a | exit |
|---|---|
| P0 | x |

prose between them

| b | criterion |
|---|---|
| P1 | y |
`);
    expect(t).toHaveLength(2);
    expect(t[0]!.header).toEqual(["a", "exit"]);
    expect(t[1]!.rows).toEqual([["P1", "y"]]);
  });

  test("a line of pipes with no separator row is not a table", () => {
    expect(parseTables("| not | a | table |\nsome prose\n")).toHaveLength(0);
  });
});

describe("the report names a disagreement, never a direction — `ekp9` point 4", () => {
  test("it does not tell anyone to delete the bean's copy", () => {
    const r = formatReport({
      store: true,
      examined: 1,
      findings: [{ id: "aaaa", table: "| phase | does | exit criterion |", line: 4, skills: ["cat-harness/work-plan/skills/work-plan/todo-manager.md"] }],
    });
    // The hand-check measured 5 drifted pairs and found the SKILL wrong in 3.
    // A report that says "delete the copy" sends somebody to edit the correct
    // text, so the word must not appear.
    expect(r).not.toContain("Delete the copy");
    expect(r).toContain("RECONCILE");
    expect(r).toContain("read both before editing either");
    // Both sides are named, so the reader can go and look at each.
    expect(r).toContain("aaaa");
    expect(r).toContain("cat-harness/work-plan/skills/work-plan/todo-manager.md");
  });

  test("the clean line claims only what was measured", () => {
    const r = formatReport({ store: true, examined: 258, findings: [] });
    // `ekp9` found 3 live restatements this rule cannot reach. A green that
    // read "no bean restates a skill" would be a clean run over what was
    // never examined.
    expect(r).toContain("no open bean carries a phase-contract table");
    expect(r).not.toContain("no bean restates");
  });
});

/** A synthetic store: `<tmp>/beans/defs/*.md`, and nothing else on disk. */
function store(beans: { id: string; status: string; body: string }[]): string {
  const root = mkdtempSync(join(tmpdir(), "restates-"));
  mkdirSync(join(root, "beans", "defs"), { recursive: true });
  for (const b of beans) {
    writeFileSync(
      join(root, "beans", "defs", `${b.id}.md`),
      `---\n# ${b.id}\ntitle: ${b.id}\nstatus: ${b.status}\ntype: feature\n---\n${b.body}`,
    );
  }
  return root;
}

describe("checkBeanRestatesSkill over a synthetic tree", () => {
  test("an open bean with the contract table is a finding; a closed one is history", () => {
    const r = checkBeanRestatesSkill(
      store([
        { id: "aaaa", status: "in-progress", body: KN0T_BEFORE },
        { id: "bbbb", status: "completed", body: KN0T_BEFORE },
        { id: "cccc", status: "todo", body: KN0T_AFTER },
      ]),
    );
    expect(r.examined).toBe(2);
    expect(r.findings.map((f) => f.id)).toEqual(["aaaa"]);
  });

  test("the finding says whether the contract has a home — the remedy differs", () => {
    const r = checkBeanRestatesSkill(
      store([
        { id: "aaaa", status: "todo", body: KN0T_BEFORE },
        {
          id: "bbbb",
          status: "todo",
          body: `See \`cat-harness/work-plan/skills/work-plan/todo-manager.md\`.\n${KN0T_BEFORE}`,
        },
      ]),
    );
    expect(r.findings.find((f) => f.id === "aaaa")!.skills).toEqual([]);
    expect(r.findings.find((f) => f.id === "bbbb")!.skills).toEqual([
      "cat-harness/work-plan/skills/work-plan/todo-manager.md",
    ]);
  });

  test("no bean store at all is `absent`, not a defect", () => {
    const r = checkBeanRestatesSkill(mkdtempSync(join(tmpdir(), "restates-empty-")));
    expect(r.store).toBe(false);
    expect(r.findings).toEqual([]);
  });

  test("a store with no OPEN bean examines nothing — the caller's vacuity guard exits 2", () => {
    // The report itself cannot fail here; what must hold is that `examined` is
    // 0 rather than the findings list merely being empty, because those are
    // the two facts the guard in `import.meta.main` tells apart.
    const r = checkBeanRestatesSkill(store([{ id: "aaaa", status: "completed", body: KN0T_BEFORE }]));
    expect(r.store).toBe(true);
    expect(r.examined).toBe(0);
    expect(r.findings).toEqual([]);
  });
});
