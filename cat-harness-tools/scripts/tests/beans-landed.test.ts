/**
 * `beans:landed` ranks what it finds and never reads silence as clean — bean `4d22`.
 *
 * @module cat-harness/scripts/tests/beans-landed.test
 *
 * The tests here that read the aggregate repository's own root (the
 * root-declared `beans/` store) live in
 * `test/beans-landed-repo-root.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */
import { describe, expect, test } from "bun:test";

import { doneWhen, findings, type Merge, type OpenBean } from "../beans-landed.js";

const bean = (short: string, ticked: number, unticked: number): OpenBean => ({
  id: `folio-assistant-${short}`,
  short,
  title: short,
  status: "in-progress",
  type: "task",
  ticked,
  unticked,
});
const merge = (sha: string, subject: string, firstBodyLine = ""): Merge => ({ sha, subject, firstBodyLine });

describe("doneWhen", () => {
  test("counts only the Done-when checklist", () => {
    expect(
      doneWhen(`- [x] not in done-when

## Done when

- [x] one
- [X] two
- [ ] three

## Later

- [ ] not counted either
`),
    ).toEqual({ ticked: 2, unticked: 1 });
  });
});

describe("findings", () => {
  const ms = [
    merge("a1", "Merge pull request #9 from litlfred/branch", "wxyz: the PR title, in the body"),
    merge("b2", "Merge pull request #8: abcd + efgh — titled merge"),
    merge("c3", "mentions abcdef but not the short id alone"),
  ];

  test("a bean named in a titled merge's subject is found", () => {
    expect(findings([bean("abcd", 1, 1)], ms).map((f) => f.merge.sha)).toEqual(["b2"]);
  });
  test("a bean named only in a default merge's first body line (the PR title) is found", () => {
    expect(findings([bean("wxyz", 0, 0)], ms).map((f) => f.merge.sha)).toEqual(["a1"]);
  });
  test("a short id inside a longer token does not match", () => {
    expect(findings([bean("cdef", 1, 0)], ms)).toEqual([]);
  });
  test("ranked: every box ticked first, then partly ticked, then no checklist", () => {
    const fs = findings([bean("wxyz", 0, 0), bean("abcd", 1, 2), bean("efgh", 3, 0)], ms);
    expect(fs.map((f) => [f.bean.short, f.tier])).toEqual([
      ["efgh", "done-ticked"],
      ["abcd", "partly-ticked"],
      ["wxyz", "no-checklist"],
    ]);
  });
  test("a bean no merge names is not a finding", () => {
    expect(findings([bean("zzzz", 1, 0)], ms)).toEqual([]);
  });
});
