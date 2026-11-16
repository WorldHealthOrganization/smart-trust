/**
 * The topology axes, and the five combinations a declaration may not name.
 *
 * Bean `folio-assistant-g7vb`, issue #363. Its first two criteria were met by
 * `cat-harness/docs/proposals/deployment-topologies.md` §3–§4: the scenarios are all
 * expressible as points in the axis product, and the incompatible pairs are
 * listed with their reasons. The third was not, and it is the one that needs
 * code: *"a declaration naming an incompatible pair is refused, not silently
 * accepted."*
 *
 * A constraint nobody enforces is a comment. These are the tests that make
 * the five rows of §3 into a refusal — and, more importantly, the tests that
 * make sure the refusal cannot reach a deployment that is working.
 *
 * @module scripts/tests/topology-conflicts.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { FORGES, MODEL_PROVENANCES, NETWORK_REACHES, PUBLICATION_HOSTS, TopologyConflictError, readDeclaration, topologyConflicts } from "../../schemas/kg/cat-harness.ts";
import {  } from "../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
const temps: string[] = [];

/** A layer root whose `harness.json` is exactly `body`. */
function instance(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "topology-"));
  temps.push(dir);
  writeDeclaration(dir, body);
  return dir;
}

afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

describe("topology axes — absent is a third state", () => {
  // This is the test that would have falsified the whole approach, so it goes
  // first. Nothing in existence declares a topology; a check that treated an
  // absent axis as a value would refuse every layer the day it shipped.
  test("a declaration with no topology at all names no conflict", () => {
    expect(topologyConflicts(undefined, undefined)).toEqual([]);
    expect(topologyConflicts({}, undefined)).toEqual([]);
  });

  test("THIS repository's own declaration is still readable", () => {
    // The strongest form of the above: not a fixture, the real file. If this
    // fails, the check has refused a working setup, which is the one outcome
    // the owner ruled out by name.
    expect(() => readDeclaration(ROOT)).not.toThrow();
  });

  test("a declared axis with nothing to conflict WITH is fine", () => {
    // Half a pair is not a pair. Each of these names one side of a real rule
    // and must still pass, because the other side has not been said.
    expect(topologyConflicts({ network: "air-gapped" }, undefined)).toEqual([]);
    expect(topologyConflicts({ forge: "none" }, undefined)).toEqual([]);
    expect(topologyConflicts({ outwardFacing: true }, undefined)).toEqual([]);
    expect(topologyConflicts({}, "github-pages")).toEqual([]);
  });

  test("every axis value is accepted on its own", () => {
    // Vacuity guard for the loops below: a value the enum rejects would make
    // the conflict rules untestable rather than satisfied.
    for (const forge of FORGES) expect(topologyConflicts({ forge }, undefined)).toEqual([]);
    for (const network of NETWORK_REACHES) {
      expect(topologyConflicts({ network }, undefined)).toEqual([]);
    }
    for (const modelProvenance of MODEL_PROVENANCES) {
      expect(topologyConflicts({ modelProvenance }, undefined)).toEqual([]);
    }
  });
});

describe("the five incompatible pairs", () => {
  test("Pages with any forge that is not GitHub", () => {
    for (const forge of FORGES.filter((f) => f !== "github")) {
      const found = topologyConflicts({ forge }, "github-pages");
      expect(found).toHaveLength(1);
      expect(found[0]!.reason).toContain("GitHub Pages");
    }
    // …and the one that is fine, so the rule is not simply "Pages is banned".
    expect(topologyConflicts({ forge: "github" }, "github-pages")).toEqual([]);
  });

  test("air-gapped with a GitHub forge", () => {
    const found = topologyConflicts({ network: "air-gapped", forge: "github" }, undefined);
    expect(found).toHaveLength(1);
    expect(found[0]!.pair).toEqual(["topology.network: air-gapped", "topology.forge: github"]);
  });

  test("air-gapped with hosted inference", () => {
    const found = topologyConflicts(
      { network: "air-gapped", modelProvenance: "hosted" },
      undefined,
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.reason).toContain("airlock");
  });

  test("egress-restricted with hosted inference is EXPRESSIBLE — it is #363's own mix", () => {
    // "self-sovereign cloud except models could be closed not openweight".
    // The proposal's central claim is that this needs no new vocabulary, and
    // that it is legal at `egress-restricted` and only there. If this ever
    // starts conflicting, the model has lost the case it was built for.
    expect(
      topologyConflicts({ network: "egress-restricted", modelProvenance: "hosted" }, undefined),
    ).toEqual([]);
  });

  test("air-gapped with Pages — and it fires without `forge` being declared", () => {
    // The proposal calls this a consequence of the other two. It is not, when
    // `forge` is absent: this is then the only rule that catches the pair.
    const found = topologyConflicts({ network: "air-gapped" }, "github-pages");
    expect(found).toHaveLength(1);
    expect(found[0]!.pair[1]).toBe("publication.host: github-pages");
  });

  test("outward-facing with nothing published", () => {
    const found = topologyConflicts({ outwardFacing: true }, "none");
    expect(found).toHaveLength(1);
    // `false` is a declared answer and must not trip it.
    expect(topologyConflicts({ outwardFacing: false }, "none")).toEqual([]);
  });

  test("several conflicts are all reported, not just the first", () => {
    // A declaration this wrong should hear about everything wrong with it;
    // fixing one and being refused again teaches nothing about the rest.
    const found = topologyConflicts(
      { network: "air-gapped", forge: "self-hosted", modelProvenance: "hosted" },
      "github-pages",
    );
    expect(found.length).toBeGreaterThan(2);
  });
});

describe("what is deliberately NOT a conflict", () => {
  test("a private repository publishing to Pages", () => {
    // Settled by the owner 2026-09-19: a possible deployment scenario, not an
    // incompatibility. `visibility` is not a declared axis at all, so the
    // guard here is that nothing was quietly added to stand in for it.
    expect(topologyConflicts({ forge: "github" }, "github-pages")).toEqual([]);
  });

  test("air-gapped with MIXED provenance — settled, and not by the original reason", () => {
    // SETTLED by the owner 2026-09-20: "that is mixed already. its a
    // spectrum, based on the deployment archicutectur of each machine actor."
    //
    // At deployment level `mixed` MEANS THE ACTORS DIFFER. Refusing it would
    // refuse the normal case — a site where some machine actors reach out and
    // some do not — so there is no contradiction to catch. The deployment
    // value is an aggregate over participants that are each consistent.
    //
    // This test predates that and argued only "a counter-example is
    // conceivable". Right answer, weaker route. Kept as the record of both,
    // because the weaker argument is what a reader would otherwise
    // reconstruct and then talk themselves out of.
    expect(
      topologyConflicts({ network: "air-gapped", modelProvenance: "mixed" }, undefined),
    ).toEqual([]);
  });

  test("the refusals that DO hold are the uniform ones", () => {
    // The corollary of the settlement: a network x provenance rule is sound
    // only where the provenance value admits no local participant. `hosted`
    // is such a value, `mixed` is not — which is why one is refused and the
    // other cannot be, rather than the two being a close call.
    expect(
      topologyConflicts({ network: "air-gapped", modelProvenance: "hosted" }, undefined),
    ).toHaveLength(1);
    expect(
      topologyConflicts({ network: "air-gapped", modelProvenance: "open-weight-local" }, undefined),
    ).toEqual([]);
  });
});

describe("a contradictory declaration is refused, not returned", () => {
  test("readDeclaration throws, and the message names both sides and the reason", () => {
    const dir = instance(
      JSON.stringify({
        name: "airgapped-instance",
        publication: { host: "github-pages" },
        topology: { network: "air-gapped" },
        directories: [],
      }),
    );
    let err: unknown;
    try {
      readDeclaration(dir);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(TopologyConflictError);
    const msg = (err as Error).message;
    expect(msg).toContain("air-gapped");
    expect(msg).toContain("github-pages");
    // The reason, not only the pair — a refusal a reader cannot argue with is
    // the "wrong constraint" failure the owner's rule is about.
    expect(msg).toContain("cannot reach");
  });

  test("a consistent topology is returned intact", () => {
    const dir = instance(
      JSON.stringify({
        name: "sovereign-instance",
        publication: { host: "jurisdiction-endpoint" },
        topology: {
          forge: "jurisdiction-hosted",
          network: "egress-restricted",
          modelProvenance: "hosted",
          outwardFacing: true,
        },
        directories: [],
      }),
    );
    const d = readDeclaration(dir);
    expect(d?.topology?.forge).toBe("jurisdiction-hosted");
    expect(d?.topology?.outwardFacing).toBe(true);
  });

  test("an unknown axis value is refused by the schema, not silently dropped", () => {
    // `z.object` strips what it does not name, so a MISSPELLED axis would
    // vanish and read as "has not said" — the same silent-loss defect that
    // an undeclared `bean:` had in the fsh-guts schema.
    const dir = instance(
      JSON.stringify({
        name: "typo-instance",
        topology: { network: "airgapped" },
        directories: [],
      }),
    );
    expect(() => readDeclaration(dir)).toThrow();
  });
});

describe("the vocabulary matches the proposal", () => {
  test("each axis ranges over exactly the values the proposal lists", () => {
    // The proposal is what a reader reasons with and this is what a machine
    // reads; a value invented in one and not the other is a vocabulary nobody
    // agreed. Same guard `PUBLICATION_HOSTS` already carries.
    expect([...FORGES]).toEqual(["none", "github", "self-hosted", "jurisdiction-hosted"]);
    expect([...NETWORK_REACHES]).toEqual(["internet", "egress-restricted", "air-gapped"]);
    expect([...MODEL_PROVENANCES]).toEqual(["open-weight-local", "hosted", "mixed"]);
    expect(PUBLICATION_HOSTS).toContain("none");
  });
});
