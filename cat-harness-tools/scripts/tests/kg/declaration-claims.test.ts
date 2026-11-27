/**
 * Prose claims about which file declares a graph. Bean `hrv2`.
 *
 * Six of these are FALSE-POSITIVE guards, each closing a class measured on the
 * real corpus rather than imagined. That ratio is the one
 * `check-declaration-filename.test.ts` argues for: a check whose tests all
 * assert the happy path is a check whose false positives nobody looked for.
 *
 * @module folio-assistant/scripts/tests/declaration-claims
 */

import { describe, expect, test } from "bun:test";

import { claimsIn, type GraphSources } from "../../../src/docs/declaration-claims.ts";

/** `health` is declared in `cat-harness.json`, and nowhere else. */
const graphs: GraphSources = new Map([
  ["health", new Set(["cat-harness/cat-harness.json"])],
  ["cat-harness", new Set(["cat-harness/cat-harness.json"])],
]);

const claims = (md: string) => claimsIn(md, "t.md", graphs);

describe("a claim is found and checked against the declarations", () => {
  test("the defect that opened the bean", () => {
    const r = claims("declared in `folio-assistant.config.json` as the `health` graph\n");
    expect(r).toHaveLength(1);
    expect(r[0]!.agrees).toBe(false);
    expect(r[0]!.claimed).toBe("folio-assistant.config.json");
    expect(r[0]!.actual).toEqual(["cat-harness.json"]);
  });

  test("a correct claim agrees", () => {
    expect(claims("declared in `cat-harness.json` as the `health` graph\n")[0]!.agrees).toBe(true);
  });

  test("the PATH form agrees too — prose should be free to be clearer", () => {
    // A pattern rejecting the path form would make the better sentence
    // INVISIBLE rather than verified, which is a silent pass.
    expect(claims("declared in `cat-harness/cat-harness.json` as the `health` graph\n")[0]!.agrees).toBe(true);
  });

  test("a claim WRAPPED across source lines is still one claim", () => {
    // The live defect wrapped between "declared in" and the filename, and a
    // line-based scan saw neither half.
    const md = "Results are committed under `test/health/results/`, declared in\n`cat-harness.json` as the `health` graph, and carry a basis.\n";
    expect(claims(md)).toHaveLength(1);
    expect(claims(md)[0]!.agrees).toBe(true);
  });
});

describe("GUARD: two facts standing near each other are not a claim", () => {
  test("adjacent TABLE ROWS are not paired", () => {
    // Measured on AGENTS.md, and it was the first thing this check found after
    // the real defect was fixed: the actor/role table puts the `cat-harness`
    // graph in the Skill row and `scenarios/roles.json` in the Role row.
    // Different objects, one flattening apart.
    const md = [
      "| **Skill** | the instruction body | the `cat-harness` graph — here, `skills/` |",
      "| **Role** | the BPMN swimlane | `scenarios/roles.json` |",
    ].join("\n");
    expect(claims(md)).toEqual([]);
  });

  test("...and separate PARAGRAPHS are not paired either", () => {
    expect(claims("the `health` graph is a thing.\n\nSee `roles.json` for lanes.\n")).toEqual([]);
  });

  test("a filename beyond the window is not paired", () => {
    const far = "the `health` graph " + "x".repeat(200) + " `roles.json`";
    expect(claims(far)).toEqual([]);
  });

  test("an undeclared graph id is not a claim at all", () => {
    expect(claims("the `nonesuch` graph is declared in `whatever.json`")).toEqual([]);
  });

  test("a graph id NOT followed by the word `graph` is not an anchor", () => {
    // `health` appears constantly as an ordinary word; only `` `health` graph ``
    // is the shape that asserts something.
    expect(claims("run the `health` check, see `roles.json`")).toEqual([]);
  });

  test("examined nothing returns nothing — and the runner treats that as unknown", () => {
    expect(claimsIn("declared in `x.json` as the `health` graph", "t.md", new Map())).toEqual([]);
  });
});

/**
 * Bean `vzur`. A GENERIC skill has to write `<name>.json` — it describes any
 * layer, so this repository's concrete filename would be the wrong thing to
 * say. Until 2026-09-21 the filename pattern excluded `<` and `>`, so every
 * such sentence fell OUT of the corpus: clearing the backlog took the check
 * from 5 claims to 3, and each disappearance read as a fix.
 */
describe("a placeholder names a pattern — counted, never a contradiction", () => {
  test("`<name>.json` is a claim, and agrees by construction", () => {
    const r = claims("declared in `<name>.json` as the `health` graph\n");
    expect(r).toHaveLength(1);
    expect(r[0]!.placeholder).toBe(true);
    expect(r[0]!.agrees).toBe(true);
  });

  test("`<instance>.json` and `<slug>.config.json` too", () => {
    for (const f of ["<instance>.json", "<slug>.config.json"]) {
      const r = claims(`declared in \`${f}\` as the \`health\` graph\n`);
      expect(r).toHaveLength(1);
      expect(r[0]!.placeholder).toBe(true);
    }
  });

  test("a concrete filename is NOT a placeholder", () => {
    expect(claims("declared in `cat-harness.json` as the `health` graph\n")[0]!.placeholder).toBe(false);
  });

  test("generalising does not MASK a wrong concrete name beside it", () => {
    // The failure this guards is "fix the gate by making the sentence vague".
    const r = claims("the `health` graph is in `<name>.json`, never in `harness.json`\n");
    expect(r).toHaveLength(2);
    expect(r.find((c) => c.claimed === "harness.json")!.agrees).toBe(false);
    expect(r.find((c) => c.claimed === "<name>.json")!.placeholder).toBe(true);
  });

  test("a bare `<>` is not a placeholder, and not a filename either", () => {
    expect(claims("declared in `<>.json` as the `health` graph\n")[0]!.placeholder).toBe(false);
  });
});
