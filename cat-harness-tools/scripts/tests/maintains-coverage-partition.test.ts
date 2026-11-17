/**
 * No `maintains` claim may fall BETWEEN the two checks that reconcile them —
 * bean `6f1x`.
 *
 * Two checks answer "is this declared artefact really produced", and they
 * deliberately cover different artefacts:
 *
 * | check | covers | why not the rest |
 * |---|---|---|
 * | `artefactDeclarationDrift` (`kg:schema:check`) | artefacts whose declaring Tool invokes `bun run cat kg:schema` | it cannot see whether the site build wrote a file into `_site/` |
 * | `checkMaintainedArtefacts` (`docs-site.yml`, post-assembly) | every claim, against a built tree | needs a built tree, so it cannot be a local gate |
 *
 * The narrowing that created this split was right — *"a check that answers a
 * question it cannot see is worse than one that declines to"* — and
 * `artefact-declaration-drift.test.ts` pins the decline: `cat-harness/ns.jsonld`
 * and `ns/content/v1.jsonld` must NOT be reported as drift.
 *
 * ## The hole those two suites leave, which is why this third one exists
 *
 * **"Correctly declined here" and "covered over there" were asserted in separate
 * files, and their conjunction was asserted nowhere.** So if the site check
 * narrowed, was renamed, or stopped iterating every Tool, the drift test would
 * still pass — it asserts an ABSENCE — and the artefacts it declines would be
 * covered by nothing at all, silently. The bean states the cost exactly:
 * *"'right to decline' is not 'covered'."*
 *
 * That is `covered-is-not-reachable` one level out: each instrument reports
 * success over its own scope, and nobody asks whether the scopes tile.
 *
 * These tests therefore assert the PARTITION rather than either side of it, and
 * every one of them is preceded by a non-vacuity check — a partition assertion
 * over an empty set is the emptiest possible pass.
 *
 * @module scripts/tests/maintains-coverage-partition.test
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkMaintainedArtefacts } from "../check-maintained-artefacts.js";
import { artefactDeclarationDrift, declaredArtefacts } from "../harness-schema-export.js";

/**
 * The subjects each check actually judges.
 *
 * `declined` is derived from BEHAVIOUR, not from the `SELF_INVOCATION` constant:
 * passing an empty produced-list makes the drift check indict every artefact it
 * considers its own, so whatever it leaves alone is precisely what it declined.
 * Reading the constant instead would make this test agree with the implementation
 * by construction, which is the way a partition test goes quietly useless.
 */
function scopes() {
  const declared = [...declaredArtefacts().keys()];
  const driftJudges = new Set(artefactDeclarationDrift([]).unproduced.map((u) => u.artefact));
  const declined = declared.filter((a) => !driftJudges.has(a));

  const dir = mkdtempSync(join(tmpdir(), "maintains-partition-"));
  try {
    return { declared, driftJudges, declined, site: new Set(checkMaintainedArtefacts(dir).map((c) => c.artefact)) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("the two scopes are both real", () => {
  it("there are declarations, and BOTH sides of the split are non-empty", () => {
    // Every assertion below is a set relation, and all of them hold trivially
    // over nothing. This is the guard that makes the rest mean something: if the
    // declined side ever empties, the partition is no longer being tested and
    // this fails rather than passing silently.
    const { declared, driftJudges, declined } = scopes();
    expect(declared.length).toBeGreaterThan(0);
    expect(driftJudges.size).toBeGreaterThan(0);
    expect(declined.length).toBeGreaterThan(0);
  });
});

describe("the scopes TILE — nothing falls between them", () => {
  it("every artefact the drift check DECLINES is covered by the site check", () => {
    // The bean's remaining criterion, and the whole point of this file. An
    // artefact declined by one check and absent from the other is covered by
    // nothing, and can rot to a 404 with both suites green.
    const { declined, site } = scopes();
    expect(declined.filter((a) => !site.has(a))).toEqual([]);
  });

  it("every declared artefact is judged by at least one check", () => {
    // The partition stated as a whole, rather than as a property of the declined
    // subset. This is what would break if a THIRD producer appeared that neither
    // check enumerates.
    const { declared, driftJudges, site } = scopes();
    expect(declared.filter((a) => !driftJudges.has(a) && !site.has(a))).toEqual([]);
  });

  it("both checks read ONE declaration, so neither can see an artefact the other cannot", () => {
    // Set equality against `declaredArtefacts()`. The site check iterates
    // `tools()` directly while the drift check goes through `declaredArtefacts`,
    // so these are two readers of the same facts — and two readers of one fact
    // that disagree is the failure this repository names everywhere.
    const { declared, site } = scopes();
    expect([...site].sort()).toEqual([...declared].sort());
  });
});

describe("the artefacts that caused the narrowing are the ones to name", () => {
  it("a layer's `ns.jsonld` and `ns/content/v1.jsonld` are covered by the site check", () => {
    // Named explicitly, because they are why the gap existed: both declarations
    // true, both published by `docs-site.yml`, both reported as drift until the
    // narrowing, and then covered by nothing until the site check landed. A
    // regression here is the exact state bean `6f1x` was opened to close.
    const { site, driftJudges } = scopes();
    // `cat-harness/ns.jsonld` since the all-layers union was retired (2026-09-30).
    // declared-path-literal: the test's subject is this published context path itself, written as consumers see it.
    for (const a of ["cat-harness/ns.jsonld", "ns/content/v1.jsonld"]) {
      expect(site.has(a), `${a} is not a subject of the site check`).toBe(true);
      // And still correctly declined by the drift check — the other suite asserts
      // this too, and it is repeated here because the pairing is the invariant.
      expect(driftJudges.has(a), `${a} is claimed by the drift check`).toBe(false);
    }
  });
});
