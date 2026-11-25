/**
 * `consulted: true` — the axis that says a skill is READ, not performed.
 *
 * ## What these guard
 *
 * The field exempts a skill from `kg-audit`'s `skill-in-role-or-process`,
 * and an exemption nobody can falsify is worse than the over-reporting it
 * replaces. So the assertions here are about the axis being REAL in both
 * directions: annotated where it should be, absent where it should not, and
 * spelled one way.
 *
 * The bidirectional guard itself — a consulted skill that a lane claims —
 * lives in the audit as `consulted-skill-not-performed`, because it is a
 * finding about the corpus rather than a property of this reader.
 *
 * @module scripts/tests/consulted-skills.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Glob } from "bun";

import { consultedSkills, knownSkills } from "../known-skills.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

describe("the annotation is read, and by more than nothing", () => {
  const consulted = consultedSkills(ROOT);

  test("the set is non-empty, or the exemption is invisible either way", () => {
    // The `qif9` failure in one assertion: that field carried 288
    // annotations for three months and was consumed by nothing. An empty
    // set here means the corpus lost its annotations OR the reader stopped
    // finding them, and from the criterion's output those look identical.
    expect(consulted.size).toBeGreaterThan(10);
    for (const ref of ["directory-conventions", "untrusted-input", "turn-reporting"]) {
      expect(`${ref}: ${consulted.has(ref)}`).toBe(`${ref}: true`);
    }
  });

  test("a PERFORMED skill is not annotated, or the axis says nothing", () => {
    // The other half of non-vacuity. If everything were consulted the
    // exemption would empty the criterion rather than sharpen it.
    for (const performed of ["build-pdf", "proof-triage", "lean-generation", "todo-manager"]) {
      expect(`${performed}: ${consulted.has(performed)}`).toBe(`${performed}: false`);
    }
  });

  test("it annotates a minority — an axis that swallows the corpus is not an axis", () => {
    const all = knownSkills(ROOT).size;
    expect(all).toBeGreaterThan(100);
    expect(consulted.size).toBeLessThan(all / 2);
  });

  test("every annotation resolves to a skill this instance knows", () => {
    // A `blv9` guard on the axis itself: the reader derives names from
    // filenames, so a stray annotation on a non-skill would mint an id that
    // exempts nothing and resolves to nothing.
    const all = knownSkills(ROOT);
    for (const c of consulted) expect(`${c}: ${all.has(c)}`).toBe(`${c}: true`);
  });
});

describe("the spelling", () => {
  test("`consulted: true` is not written any other way", () => {
    // The reader matches exactly. `yes`, `True` or a list would read as
    // ABSENT — a silent non-annotation, which is this repository's own
    // failure mode: a declaration-shaped value that does nothing.
    const bad: string[] = [];
    for (const root of ["skills", "src/skills"]) {
      const dir = resolve(ROOT, root);
      if (!existsSync(dir)) continue;
      for (const rel of new Glob("**/*.md").scanSync(dir)) {
        const m = /^consulted:(.*)$/m.exec(readFileSync(resolve(dir, rel), "utf-8"));
        if (m && m[1]!.trim() !== "true") bad.push(`${rel}: "${m[1]!.trim()}"`);
      }
    }
    expect(bad).toEqual([]);
  });
});
