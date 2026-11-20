/**
 * Every artefact a new graph TYPOLOGY owes — the chain, and the two a person writes.
 *
 * @module scripts/tests/kind-register.test
 *
 * ## What this pins, against what it deliberately does not
 *
 * The command's value is that it names **the kind**, where every underlying
 * check names a generated file. Measured on #2022: adding `auto-docs`, six
 * hand-picked `check:*` commands passed while `bun run cat gates` found 5 failures
 * across 217 and `bun test` found two more — and not one of those failures said
 * "auto-docs". So the assertions below are about the KIND appearing in the
 * finding, not about any artefact's content.
 *
 * It does not assert a hue rule, because measuring the corpus removed one: 11
 * exact collisions across 58 kinds, all deliberate, two of them saying *"in WHO
 * blue"* in their own `reads` string. See `hueReport`.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { avatarFor } from "../../schemas/content/avatars.ts";
import { KIND_TABLE_DOC, KIND_TABLE_HEADER } from "../kind-table.ts";
import { STEPS, authoredGaps, hueReport } from "../kind-register.ts";
import { notApplicableAlone } from "../../test/support/checkout.js";

/** who-iris and smart-base declare their own avatars (bean sod4 #4); only a composed checkout holds them. */
const NO_WHO_INSTANCES = notApplicableAlone(
  "who-iris and smart-base, whose own declarations carry the WHO-blue avatars this convention is read from",
);

/**
 * A root whose graph-typology table has the header and NO rows — built here rather
 * than committed, and never a path outside the test's own temp dir: an absolute
 * fixture path that happens to exist on the author's machine is a test that
 * reddens CI on the first runner.
 *
 * The header is imported, not retyped, so renaming a column moves both.
 */
const FIXTURE_ROOT = (() => {
  const root = mkdtempSync(join(tmpdir(), "kind-register-"));
  const doc = join(root, KIND_TABLE_DOC);
  mkdirSync(join(doc, ".."), { recursive: true });
  writeFileSync(
    doc,
    `# A fixture whose graph-typology table has a header and no rows.\n\n${KIND_TABLE_HEADER}\n|---|---|---|---|\n\nProse after the table, so the reader's "stop at the first non-pipe line" holds.\n`,
  );
  return root;
})();

afterAll(() => rmSync(FIXTURE_ROOT, { recursive: true, force: true }));

describe("the chain", () => {
  test("every step names a writer and the check that asks the same question", () => {
    expect(STEPS.length).toBeGreaterThan(0);
    for (const s of STEPS) {
      expect(s.write.length).toBeGreaterThan(0);
      expect(s.verify.length).toBeGreaterThan(0);
      // A step with no reason is a step nobody can re-derive, which is the
      // failure mode `skill-registration` records: the list was recalled wrong
      // four times before it was measured.
      expect(s.because.length).toBeGreaterThan(20);
    }
  });

  test("a check is never the writer's own name", () => {
    // `bun run x` and `bun run x` would verify nothing. The repo convention is
    // a `--check` sibling, and `readme:subgraphs` → `readme:sync:check` shows
    // the two need not share a stem.
    for (const s of STEPS) expect(s.verify.join(" ")).not.toBe(s.write.join(" "));
  });
});

describe("the AUTHORED two are reported against the kind", () => {
  test("this repository has no authored gap", () => {
    // Not a vacuous pass: the mutation below proves the detector fires.
    expect(authoredGaps()).toEqual([]);
  });

  test("a kind-table row missing is reported, naming the kind", () => {
    // Driven through the real reader by pointing it at a root whose table omits
    // everything — the detector's `documented` set is then empty, so every
    // registered kind owes a row. A fixture rather than an edit to the real doc.
    const gaps = authoredGaps(FIXTURE_ROOT);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every((g) => g.owes === "kind-table-row")).toBe(true);
    // The whole point: the finding carries the KIND.
    expect(gaps[0]!.kind).toBeTruthy();
    expect(gaps[0]!.detail).toContain(KIND_TABLE_DOC);
  });
});

describe("hue is reported and never graded", () => {
  test("the shared tones are real, and are a family convention", () => {
    const { collisions } = hueReport();
    // Measured on main 2026-10-04: 11, across 58 kinds. Asserting ">0" rather
    // than "= 11" on purpose — the number moves with every kind added, and a
    // count in a test is the claim `audit-coverage` says not to make.
    expect(collisions.length).toBeGreaterThan(0);
  });

  test.skipIf(NO_WHO_INSTANCES)("the shared WHO tone is a convention declared in the data", () => {
    // The evidence that it is a convention is IN the data, not inferred.
    expect(avatarFor("who-iris").reads).toContain("WHO blue");
    expect(avatarFor("smart-base").reads).toContain("WHO blue");
    // Declared by each layer now (bean sod4 #4), so read through avatarFor.
    expect(avatarFor("who-iris").tone).toBe(avatarFor("smart-base").tone);
  });

  test("nearest-neighbour clearance is symmetric and circular", () => {
    const { nearest } = hueReport();
    expect(nearest.length).toBeGreaterThan(0);
    // Sorted closest-first, so the head is what a person choosing a tone reads.
    expect(nearest[0]!.degrees).toBeLessThanOrEqual(nearest[nearest.length - 1]!.degrees);
    for (const n of nearest) expect(n.degrees).toBeLessThanOrEqual(180);
  });
});
