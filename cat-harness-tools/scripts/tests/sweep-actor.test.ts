/**
 * Which actor a script sweep records, and why there are two of them.
 *
 * The owner's ruling (2026-09-22) was to attribute by WHERE the sweep ran
 * rather than by what it is. A single actor would have been simpler and would
 * have said less: a CI verdict is reproducible from the `reviewed_sha` it
 * records, while a local one may rest on an uncommitted edit, so the same sha
 * addresses a tree that produced something else.
 */

import { describe, expect, test } from "bun:test";

import { CI_SWEEP_ACTOR, LOCAL_SWEEP_ACTOR, sweepActor } from "../../pipeline/qa-utils.ts";
import { readActors, reviewerOutcome } from "../check-qa-reviewer-permission.ts";

describe("sweepActor", () => {
  test("an empty environment is LOCAL, not unknown", () => {
    // There is deliberately no third state here: `CI` is set by every CI
    // system and absent locally, so the partition is total. An `unknown-sweep`
    // actor would manufacture a state that cannot occur, and a state that
    // cannot occur is one nobody maintains.
    expect(sweepActor({})).toBe(LOCAL_SWEEP_ACTOR);
  });

  test("`CI=true` resolves to the pipeline — any CI, not only GitHub's", () => {
    // `ci-pipeline` is declared generically ("the build and validation
    // system"), so a non-GitHub CI resolving to it is correct rather than a
    // near-miss.
    expect(sweepActor({ CI: "true" })).toBe(CI_SWEEP_ACTOR);
  });

  test("`GITHUB_ACTIONS=true` resolves to the pipeline", () => {
    expect(sweepActor({ GITHUB_ACTIONS: "true" })).toBe(CI_SWEEP_ACTOR);
  });

  test("`CI=false` is local — the value is read, not merely the key", () => {
    expect(sweepActor({ CI: "false" })).toBe(LOCAL_SWEEP_ACTOR);
  });
});

describe("both actors satisfy the permission the gate checks", () => {
  const actors = readActors();

  test("each is declared", () => {
    expect(actors.has(CI_SWEEP_ACTOR)).toBe(true);
    expect(actors.has(LOCAL_SWEEP_ACTOR)).toBe(true);
  });

  test("each holds qa-reporting, so a stamped verdict is `permitted`", () => {
    for (const id of [CI_SWEEP_ACTOR, LOCAL_SWEEP_ACTOR]) {
      expect(reviewerOutcome({ kind: "script", id: "x", actor: id }, actors)).toBe("permitted");
    }
  });

  test("NEITHER holds content-authoring — the separation this epic is about", () => {
    for (const id of [CI_SWEEP_ACTOR, LOCAL_SWEEP_ACTOR]) {
      expect(actors.get(id)?.has("content-authoring") ?? false).toBe(false);
    }
  });

  test("an unstamped reviewer is still unresolved — the hook is not retroactive", () => {
    expect(reviewerOutcome({ kind: "script", id: "pipeline/qa-checkers-voice.ts" }, actors)).toBe(
      "unresolved",
    );
  });
});
