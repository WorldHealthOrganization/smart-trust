/**
 * The untainted-dispatch mechanism, falsified in both directions.
 *
 * Every test here exists because the failure it names produces a GREEN result
 * rather than an error. A checker shown what the adjudicator is ruling against
 * passes vacuously; a "could not dispatch" record read as `n/a` passes
 * silently. Neither shows up as a crash, so neither shows up at all unless
 * something asks.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { attestationPath, blockAttestationKey, readCriteriaAttestations } from "../../schemas/sdlc/qa-attestations.ts";

import { COMPANION_ROLES, untaintedPartitionDefects } from "../../schemas/sdlc/block-qa.ts";
import { ROUNDTRIP_DISPATCH, TRANSLATION_ARTEFACTS } from "../../pipeline/translation-block-qa.ts";
import type { UntaintedDispatch } from "../../schemas/sdlc/block-qa.ts";
import {
  couldNotDispatchEntry,
  isCouldNotDispatch,
  isVerified,
  mergeUntainted,
  recordUntainted,
  untaintedEntries,
} from "../../pipeline/untainted-verification.ts";
import type { QaCriterionEntry } from "../../schemas/sdlc/block-qa.ts";

const SOUND: UntaintedDispatch = {
  // The checker reads the formalisation; the adjudicator reads the prose
  // claim. Disjoint, which is the whole discipline in one line.
  checker_sees: ["lean"],
  checker_withheld: ["md", "ts"],
  adjudicator_sees: ["md"],
  drift: "A restated hypothesis or a weakened conclusion is drift; renaming a bound variable is not.",
};

const FIELD_HASH = { md: "aaaaaaaaaaaa", lean: "bbbbbbbbbbbb" };

describe("untaintedPartitionDefects", () => {
  test("a sound declaration has no defects", () => {
    expect(untaintedPartitionDefects({ id: "c", untainted: SOUND }, ["md", "ts", "lean"])).toEqual([]);
  });

  test("undeclared is reported, not skipped — nobody-said is not nothing-to-check", () => {
    const d = untaintedPartitionDefects({ id: "c" }, ["md"]);
    expect(d).toHaveLength(1);
    expect(d[0]).toContain("undeclared");
  });

  test("overlap: a role visible to BOTH parties is the vacuous pass", () => {
    const d = untaintedPartitionDefects({ id: "c", untainted: { ...SOUND, adjudicator_sees: ["md", "lean"] } }, [
      "md",
      "ts",
      "lean",
    ]);
    expect(d.some((m) => m.includes("grading its own input"))).toBe(true);
  });

  test("unpartitioned: a companion added to depends_on later lands in neither set", () => {
    // `bpmn` is new to this criterion's universe and the declaration has not
    // been updated.
    const d = untaintedPartitionDefects({ id: "c", untainted: SOUND }, ["md", "ts", "lean", "bpmn"]);
    expect(d.some((m) => m.includes("unpartitioned") && m.includes("bpmn"))).toBe(true);
  });

  test("phantom: the declaration describes a criterion other than this one", () => {
    const d = untaintedPartitionDefects(
      { id: "c", untainted: { ...SOUND, checker_sees: ["cql"], checker_withheld: ["md", "ts"] } },
      ["md", "ts"],
    );
    expect(d.some((m) => m.includes("phantom") && m.includes("cql"))).toBe(true);
  });

  test("an empty drift statement is a defect — it yields a style review", () => {
    const d = untaintedPartitionDefects({ id: "c", untainted: { ...SOUND, drift: "   " } }, ["md", "ts", "lean"]);
    expect(d.some((m) => m.includes("drift"))).toBe(true);
  });
});

describe("the translation round trip as an INSTANCE — the genericity, demonstrated", () => {
  // The case the spine was generalised FROM. It is here because instantiating
  // it is what proves the abstraction fits: asserting genericity is the move
  // this whole epic exists to stop.
  test("the founding case declares cleanly against the generic type", () => {
    expect(untaintedPartitionDefects({ id: "translation-semantic-roundtrip", untainted: ROUNDTRIP_DISPATCH }, TRANSLATION_ARTEFACTS)).toEqual([]);
  });

  test("its central artefact is NOT a CompanionRole — which is why `universe` is a parameter", () => {
    // `po` is deliberately absent from COMPANION_ROLES: a PO is a companion of
    // a (block, locale) pair, not of a block. Typed over CompanionRole alone,
    // the spine could not express the very round trip it came from.
    expect(COMPANION_ROLES as readonly string[]).not.toContain("po");
    expect(ROUNDTRIP_DISPATCH.checker_sees).toEqual(["po"]);
  });

  test("the two visible sets are disjoint — the whole rule in one line", () => {
    const both = ROUNDTRIP_DISPATCH.checker_sees.filter((r) => ROUNDTRIP_DISPATCH.adjudicator_sees.includes(r));
    expect(both).toEqual([]);
  });

  test("showing the back-translator the source is caught, not merely discouraged", () => {
    // The vacuous pass translation-manager warns about: handed the `.md`, a
    // back-translator writes the source back and the check measures nothing.
    const d = untaintedPartitionDefects(
      { id: "translation-semantic-roundtrip", untainted: { ...ROUNDTRIP_DISPATCH, checker_sees: ["po", "md"] } },
      TRANSLATION_ARTEFACTS,
    );
    expect(d.some((m) => m.includes("grading its own input"))).toBe(true);
  });
});

describe("untaintedEntries", () => {
  const entries = untaintedEntries(
    {
      subject: "content/x.md",
      criterion: "c",
      intermediate: "the checker's rendering",
      checker: { id: "checker", tools_used: "none" },
      adjudicator: { id: "adjudicator" },
      verdict: "fail",
      findings: ["the conclusion is weakened"],
      reasoning: "ruled on the claim, not the wording",
    },
    FIELD_HASH,
    "deadbeef",
  );

  test("the adjudicator leads — the first entry is the operative one", () => {
    expect(entries[0].reviewer?.id).toBe("adjudicator");
    expect(entries[0].result).toBe("fail");
  });

  test("the checker ruled on nothing and must not read as a verdict", () => {
    expect(entries[1].reviewer?.id).toBe("checker");
    expect(entries[1].result).toBe("n/a");
    expect(entries[1].notes).toContain("the checker's rendering");
  });

  test("tools_used is recorded rather than assumed", () => {
    expect(entries[1].metrics?.tools_used).toBe("none");
  });

  test("a checker's n/a is NOT a could-not-dispatch record", () => {
    expect(isCouldNotDispatch(entries[1])).toBe(false);
  });
});

describe("could not dispatch — the third state", () => {
  const p = {
    subject: "content/x.md",
    criterion: "c",
    reason: "no subagent capability in this environment",
    recorded_by: { id: "coder" },
  };

  test("it is structurally distinguishable from every other n/a", () => {
    const e = couldNotDispatchEntry(p, FIELD_HASH, "deadbeef");
    expect(e.result).toBe("n/a");
    expect(isCouldNotDispatch(e)).toBe(true);
    expect(e.notes).toContain("no subagent capability");
  });

  test("a reasonless record is refused — it cannot be told from declining to try", () => {
    expect(() => couldNotDispatchEntry({ ...p, reason: "  " }, FIELD_HASH)).toThrow(/needs a reason/);
  });

  test("it is NEVER a pass", () => {
    expect(isVerified([couldNotDispatchEntry(p, FIELD_HASH)])).toBe(false);
  });

  test("not attempted is not a pass either", () => {
    expect(isVerified(undefined)).toBe(false);
    expect(isVerified([])).toBe(false);
  });

  test("a real verdict IS verified", () => {
    expect(
      isVerified(
        untaintedEntries(
          {
            subject: "s",
            criterion: "c",
            intermediate: "i",
            checker: { id: "checker" },
            adjudicator: { id: "adjudicator" },
            verdict: "pass",
          },
          FIELD_HASH,
        ),
      ),
    ).toBe(true);
  });
});

describe("mergeUntainted", () => {
  const human: QaCriterionEntry = {
    field_hash: FIELD_HASH,
    result: "pass",
    reviewer: { kind: "human", id: "litlfred" },
    reviewed_at: "2026-09-21T00:00:00Z",
  };
  const staleAgent: QaCriterionEntry = {
    field_hash: FIELD_HASH,
    result: "fail",
    reviewer: { kind: "agent", id: "an earlier pair" },
    reviewed_at: "2026-09-21T00:00:00Z",
  };

  test("a sweep replaces only entries whose reviewer is itself", () => {
    const fresh = untaintedEntries(
      {
        subject: "s",
        criterion: "c",
        intermediate: "i",
        checker: { id: "checker" },
        adjudicator: { id: "adjudicator" },
        verdict: "pass",
      },
      FIELD_HASH,
    );
    const merged = mergeUntainted([staleAgent, human], fresh);
    // The human ruling survives; the earlier agent pair does not.
    expect(merged.map((e) => e.reviewer?.id)).toEqual(["adjudicator", "checker", "litlfred"]);
  });
});

/**
 * Bean `8iqt`: the recorder writes the attestation store, not the derived
 * report. Every case runs in a throwaway layer with no declaration, so its
 * store is the convention path `test/attestations/`.
 */
describe("recordUntainted — the attestation store is the home", () => {
  const fresh = () =>
    untaintedEntries(
      {
        subject: "content/b.md",
        criterion: "c",
        intermediate: "i",
        checker: { id: "checker" },
        adjudicator: { id: "adjudicator" },
        verdict: "fail",
      },
      FIELD_HASH,
    );

  function instance(): { root: string; derived: string; cleanup: () => void } {
    const root = mkdtempSync(join(tmpdir(), "untainted-"));
    mkdirSync(join(root, "content"), { recursive: true });
    writeFileSync(join(root, "content", "b.md"), "subject\n");
    const derived = join(root, "test", "results", "block-qa", "content", "b.qa.json");
    return { root, derived, cleanup: () => rmSync(root, { recursive: true, force: true }) };
  }

  test("with the derived report ABSENT, the verdict lands in the store and no report is invented", () => {
    const t = instance();
    try {
      expect(existsSync(t.derived)).toBe(false);
      const wrote = recordUntainted(t.derived, "c", fresh(), t.root);
      const key = blockAttestationKey(t.root, join(t.root, "content", "b"));
      expect(wrote).toBe(relative(t.root, attestationPath(t.root, key)));
      const read = readCriteriaAttestations(t.root, key);
      expect(read.state).toBe("hit");
      if (read.state !== "hit") return;
      expect(read.criteria.c!.map((e) => (e.reviewer as { id: string }).id)).toEqual(["adjudicator", "checker"]);
      expect(existsSync(t.derived)).toBe(false);
    } finally {
      t.cleanup();
    }
  });

  test("with the derived report present, the store is written and the projection keeps script entries", () => {
    const t = instance();
    try {
      const scriptEntry: QaCriterionEntry = {
        field_hash: FIELD_HASH,
        result: "pass",
        reviewer: { kind: "script", id: "sweep" },
        reviewed_at: "2026-09-21T00:00:00Z",
      };
      mkdirSync(join(t.derived, ".."), { recursive: true });
      writeFileSync(t.derived, JSON.stringify({ $schema: "block-qa/v1", criteria: { c: [scriptEntry] } }, null, 2));
      recordUntainted(t.derived, "c", fresh(), t.root);
      const key = blockAttestationKey(t.root, join(t.root, "content", "b"));
      const read = readCriteriaAttestations(t.root, key);
      expect(read.state).toBe("hit");
      const report = JSON.parse(readFileSync(t.derived, "utf-8"));
      expect(report.criteria.c.map((e: QaCriterionEntry) => e.reviewer?.id)).toEqual(["adjudicator", "checker", "sweep"]);
    } finally {
      t.cleanup();
    }
  });

  test("a corrupt store is UNKNOWN: refused, and neither file is written", () => {
    const t = instance();
    try {
      const key = blockAttestationKey(t.root, join(t.root, "content", "b"));
      const path = attestationPath(t.root, key);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, "{ not json");
      expect(() => recordUntainted(t.derived, "c", fresh(), t.root)).toThrow(/UNKNOWN .*corrupt/);
      expect(readFileSync(path, "utf-8")).toBe("{ not json");
      expect(existsSync(t.derived)).toBe(false);
    } finally {
      t.cleanup();
    }
  });

  test("a subject that does not exist is refused", () => {
    const t = instance();
    try {
      rmSync(join(t.root, "content", "b.md"));
      expect(() => recordUntainted(t.derived, "c", fresh(), t.root)).toThrow(/does not exist/);
      expect(existsSync(join(t.root, "test", "attestations"))).toBe(false);
    } finally {
      t.cleanup();
    }
  });
});
