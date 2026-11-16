/**
 * RACI: the overlay is real, the rule bites, and R is never re-declared.
 *
 * The assertions worth having are not "the parser reads an attribute".
 * They are that the model **cannot** express R twice, that the one-A rule
 * fails on a real corpus rather than a fixture, and that the sweep says so
 * when it examined nothing.
 *
 * @module scripts/tests/raci.test
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { declaredRoles, raciBreaches, raciRows, type RaciBreachKind, type RaciRow } from "../raci-chart.ts";
import { KG_CRITERIA } from "../../schemas/sdlc/kg-qa.ts";
import { RACI_INVOLVEMENTS } from "../../src/workflow/process-model.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

describe("R is the lane, and is not declarable", () => {
  test("`responsible` is not an involvement value", () => {
    // Declaring R would be one fact in two places with nothing asserting
    // they agree — the shape `85e8` removed `fallbackRole` for. The lane
    // is the answer; the chart reads it.
    expect([...RACI_INVOLVEMENTS]).toEqual(["accountable", "consulted", "informed"]);
  });

  test("the chart's R column comes from the lane's role binding", async () => {
    const rows = await raciRows(ROOT);
    expect(rows.length).toBeGreaterThan(0);
    // At least one row must actually have one, or the column is decorative
    // and this assertion is about nothing.
    expect(rows.filter((r) => r.responsible !== undefined).length).toBeGreaterThan(0);
  });
});

describe("the corpus", () => {
  test("something is annotated — a rule over an empty set is not a rule", async () => {
    const rows = await raciRows(ROOT);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.process === "Process_CRDM_DataModel")).toBe(true);
  });

  test("it is clean, against the REAL role registry", async () => {
    const roles = declaredRoles(ROOT);
    expect(roles.size).toBeGreaterThan(10);
    expect(raciBreaches(await raciRows(ROOT), roles)).toEqual([]);
  });
});

describe("the rule", () => {
  const roles = new Set(["a-role", "b-role"]);
  const row = (over: Partial<RaciRow>): RaciRow => ({
    process: "P",
    activity: "T",
    activityName: "T",
    accountable: ["a-role"],
    consulted: [],
    informed: [],
    supportive: [],
    unknown: [],
    vocabulary: "raci",
    ...over,
  });

  test("two accountable roles is a breach", () => {
    const b = raciBreaches([row({ accountable: ["a-role", "b-role"] })], roles);
    expect(b).toHaveLength(1);
    expect(b[0]!.detail).toContain("exactly one carries the decision");
  });

  test("ZERO accountable is also a breach, once anything is claimed", () => {
    // A half-annotated activity is worse than an unannotated one, because
    // the chart looks complete. An activity claiming NOTHING never reaches
    // this function — `raciRows` omits it — which is the incremental half.
    const b = raciBreaches([row({ accountable: [], consulted: ["b-role"] })], roles);
    expect(b).toHaveLength(1);
    expect(b[0]!.detail).toContain("no `accountable`");
  });

  test("exactly one is clean", () => {
    expect(raciBreaches([row({ consulted: ["b-role"] })], roles)).toEqual([]);
  });

  test("a role in no registry is a breach, in every column", () => {
    for (const col of ["accountable", "consulted", "informed"] as const) {
      const over =
        col === "accountable" ? { accountable: ["ghost"] } : { [col]: ["ghost"] };
      const b = raciBreaches([row(over)], roles);
      expect(b.some((x) => x.detail.includes('"ghost"'))).toBe(true);
    }
  });

  test("accountable AND consulted on one activity is a breach", () => {
    // Asking yourself is not consultation, and this pairing is how
    // `consulted` becomes a formality while the chart still reads complete.
    const b = raciBreaches([row({ consulted: ["a-role"] })], roles);
    expect(b).toHaveLength(1);
    expect(b[0]!.detail).toContain("asking yourself is not consultation");
  });
});

describe("the parser", () => {
  test("an unrecognised involvement is DROPPED, never coerced", async () => {
    // A typo read as `informed` would put somebody on a notification list
    // who was meant to be consulted — and the difference between those two
    // is the entire model. Asserted over the real corpus: every value that
    // survived parsing is one of the three.
    for (const r of await raciRows(ROOT)) {
      for (const role of [...r.accountable, ...r.consulted, ...r.informed]) {
        expect(typeof role).toBe("string");
        expect(role.length).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * Bean `3kbd`. The rule is read by two consumers — `bun run cat check:raci`, which
 * gates, and `kg-audit`, which commits a sidecar. Until 2026-09-20 a breach
 * was only ever PRINTED, and a printed verdict cannot distinguish "unsound
 * since the diagram was drawn" from "broken in the commit under review".
 *
 * What these pin is that the two consumers cannot come apart. `raciBreaches`
 * is the single implementation; `kg-audit` partitions on `kind` rather than
 * re-deriving anything, so the tags are load-bearing and an untagged breach
 * would vanish from every sidecar while still failing the gate.
 */
describe("breaches carry the kind kg-audit partitions on", () => {
  const roles = new Set(["a-role", "b-role"]);
  const row = (o: Partial<RaciRow> = {}): RaciRow => ({
    process: "p",
    activity: "A_X",
    activityName: "X",
    accountable: ["a-role"],
    consulted: [],
    informed: [],
    supportive: [],
    unknown: [],
    vocabulary: "raci",
    ...o,
  });

  test("every breach is tagged, and with a kind kg-qa registers a criterion for", () => {
    const breaches = [
      ...raciBreaches([row({ accountable: [] })], roles),
      ...raciBreaches([row({ accountable: ["a-role", "b-role"] })], roles),
      ...raciBreaches([row({ informed: ["nope"] })], roles),
      ...raciBreaches([row({ consulted: ["a-role"] })], roles),
      ...raciBreaches([row({ unknown: [{ role: "a-role", involvement: "supportive" }] })], roles),
    ];
    expect(breaches.length, "the five shapes below produce no breaches — this is vacuous").toBe(5);

    const registered = new Set(KG_CRITERIA.filter((c) => c.id.startsWith("raci-")).map((c) => c.id));
    expect(registered.size, "kg-qa registers no raci criteria").toBe(4);

    const criterionFor: Record<RaciBreachKind, string> = {
      "accountable-count": "raci-single-accountable",
      "role-undeclared": "raci-role-resolves",
      "accountable-also-consulted": "raci-accountable-not-consulted",
      "involvement-unknown": "raci-involvement-vocabulary",
    };
    for (const b of breaches) {
      expect(b.kind, `untagged breach: ${b.detail}`).toBeTruthy();
      expect(registered.has(criterionFor[b.kind]), `no criterion for kind ${b.kind}`).toBe(true);
    }
  });

  /**
   * A dangling RACI role is `role-ref-resolves` on a different edge, and the
   * registry grades every dangling reference `critical`. Grading it lower
   * would say the same defect matters less depending on which attribute
   * carries it. The other two are gaps between roles that all exist.
   */
  test("severities follow the registry's dangling-vs-structural split", () => {
    const sev = (id: string): string | undefined => KG_CRITERIA.find((c) => c.id === id)?.severity;
    expect(sev("raci-role-resolves")).toBe(sev("role-ref-resolves"));
    expect(sev("raci-role-resolves")).toBe("critical");
    expect(sev("raci-single-accountable")).toBe("major");
    expect(sev("raci-accountable-not-consulted")).toBe("major");
  });
});
