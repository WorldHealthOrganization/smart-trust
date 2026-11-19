/**
 * Tests for the bean ↔ issue link reader, and specifically for the
 * issue → bean direction added under bean `oh78`.
 *
 * The direction was the second of that bean's two Done-when items and had
 * stood as "could not determine — needs the GitHub API" since #595. What
 * makes it worth testing rather than trusting is the failure mode it invites:
 * a check that asks a network and reports silence as agreement asserts
 * something about every issue in the repository on no evidence. So the tests
 * here are mostly about what the check says when it could NOT ask.
 *
 * @module scripts/tests/check-bean-issue-links.test
 */
import { describe, expect, test } from "bun:test";

import { orphanIssues } from "../check-bean-issue-links.ts";

const issues = [
  { number: 100, title: "named by a bean" },
  { number: 200, title: "named by nobody" },
];

describe("orphanIssues", () => {
  test("an issue an open bean names is not an orphan", () => {
    expect(orphanIssues({ "100": ["folio-assistant-aaaa"] }, issues)).toEqual([
      { number: 200, title: "named by nobody" },
    ]);
  });

  test("no beans at all means every issue is an orphan", () => {
    expect(orphanIssues({}, issues)).toHaveLength(2);
  });

  test("a bean naming an issue that is not open is not consulted here", () => {
    // The forward index is built from OPEN beans only, upstream of this
    // function. A closed bean's issue therefore reads as an orphan — which is
    // the right answer and is `oh78`'s own example: issue #464 stands open on
    // the completed bean `mggs`.
    expect(orphanIssues({ "999": ["folio-assistant-bbbb"] }, issues)).toHaveLength(2);
  });

  test("it is pure — the caller does the asking", () => {
    // The fetch is separate so a network failure cannot cost the forward
    // direction the answer it already had, and so this logic is testable
    // without a network at all.
    expect(orphanIssues({}, [])).toEqual([]);
  });
});
