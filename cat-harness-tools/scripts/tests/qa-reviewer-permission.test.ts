/**
 * `qa-reporting`'s first consumer, falsified.
 *
 * The gate's whole risk is collapsing three outcomes into two. Fold
 * `unresolved` into `permitted` and it is decorative; fold it into `forbidden`
 * and it fails on a corpus nobody has migrated. Both failures look like a
 * working gate from the outside, so each is pinned here.
 */

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  absentCorpusIsNotOurs,
  baselineKey,
  notOwnedReason,
  readActors,
  report,
  reviewerOutcome,
  scan,
  scanCounted,
} from "../check-qa-reviewer-permission.ts";
import { couldNotDispatchEntry } from "../../pipeline/untainted-verification.ts";
import type { QaCriterionEntry } from "../../schemas/sdlc/block-qa.ts";

function fixture(): { results: string; actors: string } {
  const root = mkdtempSync(join(tmpdir(), "qa-perm-"));
  const actors = join(root, "actors");
  const results = join(root, "results");
  mkdirSync(actors);
  mkdirSync(results, { recursive: true });
  writeFileSync(
    join(actors, "qc.json"),
    JSON.stringify({ id: "qc-reviewer", permissions: ["qa-reporting"] }),
  );
  writeFileSync(
    join(actors, "author.json"),
    JSON.stringify({ id: "author", permissions: ["content-authoring"] }),
  );
  return { results, actors };
}

function sidecar(dir: string, name: string, entries: QaCriterionEntry[]) {
  writeFileSync(join(dir, name), JSON.stringify({ criteria: { "some-criterion": entries } }));
}

const HASH = { md: "aaaaaaaaaaaa" };
const T = "2026-09-21T00:00:00Z";

describe("reviewerOutcome — three states, never two", () => {
  const actors = new Map([
    ["qc-reviewer", new Set(["qa-reporting"])],
    ["author", new Set(["content-authoring"])],
  ]);

  test("an actor holding the permission is permitted", () => {
    expect(reviewerOutcome({ kind: "agent", id: "x", actor: "qc-reviewer" }, actors)).toBe("permitted");
  });

  test("an actor WITHOUT it is forbidden — the producer writing its own verdict", () => {
    expect(reviewerOutcome({ kind: "agent", id: "x", actor: "author" }, actors)).toBe("forbidden");
  });

  test("no actor named is UNRESOLVED, not permitted", () => {
    expect(reviewerOutcome({ kind: "script", id: "some-checker.ts" }, actors)).toBe("unresolved");
  });

  test("an actor naming nothing declared is UNRESOLVED, not forbidden", () => {
    // It matters which way this falls: reading a typo'd actor id as `forbidden`
    // would report a discipline breach where there is a spelling mistake.
    expect(reviewerOutcome({ kind: "agent", id: "x", actor: "qc-reviewr" }, actors)).toBe("unresolved");
  });

  test("a missing reviewer is unresolved", () => {
    expect(reviewerOutcome(undefined, actors)).toBe("unresolved");
  });
});

describe("scan", () => {
  test("a permitted entry produces no finding; forbidden and unresolved both do", () => {
    const { results, actors } = fixture();
    const a = readActors(actors);
    sidecar(results, "a.json", [
      { field_hash: HASH, result: "pass", reviewer: { kind: "agent", id: "ok", actor: "qc-reviewer" }, reviewed_at: T },
      { field_hash: HASH, result: "fail", reviewer: { kind: "agent", id: "bad", actor: "author" }, reviewed_at: T },
      { field_hash: HASH, result: "pass", reviewer: { kind: "script", id: "legacy.ts" }, reviewed_at: T },
    ]);
    const f = scan(results, a);
    expect(f.map((x) => x.outcome).sort()).toEqual(["forbidden", "unresolved"]);
  });

  test("a could-not-dispatch record is exempt — the owner's ruling, structurally identified", () => {
    const { results, actors } = fixture();
    const a = readActors(actors);
    // Written by the PRODUCER, which holds no qa-reporting. Exempt anyway.
    const e = couldNotDispatchEntry(
      { subject: "s", criterion: "c", reason: "no subagents here", recorded_by: { id: "the coder" } },
      HASH,
    );
    e.reviewer!.actor = "author";
    sidecar(results, "b.json", [e]);
    expect(scan(results, a)).toEqual([]);
  });

  test("the exemption cannot be claimed by asserting it", () => {
    const { results, actors } = fixture();
    const a = readActors(actors);
    // Same words, no structural marker — a plain n/a from a forbidden actor.
    sidecar(results, "c.json", [
      {
        field_hash: HASH,
        result: "n/a",
        notes: "Could not dispatch: trust me",
        reviewer: { kind: "agent", id: "sneaky", actor: "author" },
        reviewed_at: T,
      },
    ]);
    expect(scan(results, a).map((x) => x.outcome)).toEqual(["forbidden"]);
  });
});

describe("report — what is baselined and what never is", () => {
  const forbidden = { file: "f", criterion: "c", reviewer: "bad", actor: "author", outcome: "forbidden" as const };
  const unresolved = { file: "f", criterion: "c", reviewer: "legacy.ts", outcome: "unresolved" as const };

  test("a forbidden outcome is NEVER silenced by the baseline", () => {
    // Even with its key present, it must still be reported.
    const r = report([forbidden], new Set([baselineKey(forbidden)]));
    expect(r.forbidden).toHaveLength(1);
  });

  test("a baselined unresolved reviewer is not novel", () => {
    expect(report([unresolved], new Set([baselineKey(unresolved)])).novel).toEqual([]);
  });

  test("a NEW unresolved reviewer is novel — the backlog cannot grow quietly", () => {
    expect(report([unresolved], new Set()).novel).toHaveLength(1);
  });

  test("an entry that stops matching is reported stale — the file can only shrink", () => {
    expect(report([], new Set(["unresolved:gone.ts"])).stale).toEqual(["unresolved:gone.ts"]);
  });
});

describe("the checker/adjudicator split enforces itself", () => {
  // The owner's ruling, 2026-09-22: two new actors, and the CHECKER holds no
  // `qa-reporting` on purpose. That absence is what turns "a checker must not
  // rule" from a sentence in a skill into something the gate refuses.
  const actors = readActors();

  test("the adjudicator may rule; the checker may not", () => {
    expect(reviewerOutcome({ kind: "agent", id: "a", actor: "untainted-adjudicator" }, actors)).toBe("permitted");
    expect(reviewerOutcome({ kind: "agent", id: "c", actor: "untainted-checker" }, actors)).toBe("forbidden");
  });

  test("NEITHER holds content-authoring — the producer never writes the verdict", () => {
    for (const id of ["untainted-adjudicator", "untainted-checker"]) {
      expect(actors.get(id)?.has("content-authoring") ?? false).toBe(false);
    }
  });

  test("a checker's `n/a` witness is exempt — the honest half must not fail the gate", () => {
    const { results, actors: dir } = fixture();
    writeFileSync(
      join(results, "ok.json"),
      JSON.stringify({
        criteria: {
          c: [
            {
              field_hash: HASH,
              result: "n/a",
              metrics: { role: "checker" },
              reviewer: { kind: "agent", id: "checker", actor: "untainted-checker" },
              reviewed_at: T,
            },
          ],
        },
      }),
    );
    expect(scan(results, readActors(dir))).toEqual([]);
  });

  test("a checker emitting a REAL verdict is forbidden — the defect worth catching", () => {
    const { results, actors: dir } = fixture();
    writeFileSync(
      join(results, "bad.json"),
      JSON.stringify({
        criteria: {
          c: [
            {
              field_hash: HASH,
              // It ruled. That is the thing it may not do.
              result: "pass",
              metrics: { role: "checker" },
              reviewer: { kind: "agent", id: "checker", actor: "untainted-checker" },
              reviewed_at: T,
            },
          ],
        },
      }),
    );
    const a = readActors(dir);
    // The fixture's own actor dir has no untainted-* actors, so use the real
    // registry: this asserts the SHIPPED declarations, not a stand-in.
    expect(reviewerOutcome({ kind: "agent", id: "c", actor: "untainted-checker" }, actors)).toBe("forbidden");
    expect(scan(results, a).map((f) => f.outcome)).toEqual(["unresolved"]);
  });

  test("the exemption cannot be claimed without the structural marker", () => {
    // Same `n/a`, no `metrics.role` — so it is not a checker witness and the
    // permission question still applies.
    const { results, actors: dir } = fixture();
    writeFileSync(
      join(results, "sneaky.json"),
      JSON.stringify({
        criteria: {
          c: [
            {
              field_hash: HASH,
              result: "n/a",
              notes: "checker witness, honest",
              reviewer: { kind: "agent", id: "x", actor: "author" },
              reviewed_at: T,
            },
          ],
        },
      }),
    );
    expect(scan(results, readActors(dir)).map((f) => f.outcome)).toEqual(["forbidden"]);
  });
});

describe("the population travels with the verdict (bean `c8uq`)", () => {
  test("an ABSENT results tree examines nothing, and says it was absent", () => {
    const r = scanCounted(join(tmpdir(), `qa-perm-absent-${Date.now()}`), new Map());
    expect(r).toEqual({ findings: [], examined: 0, present: false });
  });

  test("permitted entries are counted as examined, though they are not findings", () => {
    const { results, actors } = fixture();
    const a = readActors(actors);
    sidecar(results, "x.qa.json", [
      { field_hash: HASH, result: "pass", reviewer: { kind: "agent", id: "x", actor: "qc-reviewer" }, reviewed_at: T },
      { field_hash: HASH, result: "pass", reviewer: { kind: "script", id: "s.ts" }, reviewed_at: T },
    ]);
    const r = scanCounted(results, a);
    expect(r.present).toBe(true);
    expect(r.examined).toBe(2);
    expect(r.findings.map((f) => f.outcome)).toEqual(["unresolved"]);
  });
});

/**
 * Owner, 2026-11-03 ("(b) policy: 78 downstream"): with the derived tree
 * absent, a content root (no gates workflow publishes the corpus there) does
 * not own it, so the gate does not apply (78); a harness root owns it and
 * still exits 2. A present tree is judged in either.
 */
describe("absentCorpusIsNotOurs — whose derived corpus is absent", () => {
  function root(harness: boolean): string {
    const r = mkdtempSync(join(tmpdir(), "qa-perm-root-"));
    if (harness) {
      mkdirSync(join(r, ".github", "workflows"), { recursive: true });
      writeFileSync(join(r, ".github", "workflows", "code-quality-gates.yml"), "name: gates\n");
    }
    return r;
  }

  test("a content root with the tree absent: not ours, not applicable", () => {
    expect(absentCorpusIsNotOurs(false, root(false))).toBe(true);
  });

  test("a harness root with the tree absent: ours, still could not determine", () => {
    expect(absentCorpusIsNotOurs(false, root(true))).toBe(false);
  });

  test("a present tree is judged in either root", () => {
    expect(absentCorpusIsNotOurs(true, root(false))).toBe(false);
    expect(absentCorpusIsNotOurs(true, root(true))).toBe(false);
  });

  test("the reason says what was and was not examined", () => {
    const why = notOwnedReason("cat-harness/test/results", 3, 8);
    expect(why).toContain("cat-harness/test/results is absent and this is a content root");
    expect(why).toContain("3 baselined reviewer id(s) were not evaluated and none is stale");
    expect(why).toContain("8 attested entr(y/ies) were examined and none is forbidden");
  });
});
