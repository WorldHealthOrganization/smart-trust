/**
 * A remote declaration is not resolution — bean `nup0`.
 *
 * `manifest-skill-exists` is `critical`, and it used to PASS on a manifest entry
 * that only a file under `skills/remote-packages/` named. The reasoning was
 * sound in the abstract: "is this a real skill somewhere" and "can this instance
 * serve it" are different questions, and collapsing them would let one checker
 * demand a deletion the other forbids.
 *
 * What makes it wrong here is that nothing implements the "somewhere". Measured
 * 2026-09-19 on `f098b530`:
 *
 *  - `shallow-clone` exists only as a value in `RemoteSyncStrategySchema`;
 *    nothing performs a sync.
 *  - `src/tools/skill-fetch.ts` and `scripts/generate-registry.ts` contain no
 *    mention of `remote-packages/` at all.
 *  - the one consumer, `scripts/generate-docs.ts`, reads those files solely for
 *    Docker requirements — which is what `schemas/kg/skill-package.ts` documents
 *    them as providing.
 *
 * So an entry resolvable only that way publishes a registry name `skill_fetch`
 * answers "not found" for. That is the defect the criterion exists to catch, and
 * the allowance was letting it through.
 *
 * **Why this test and not a note.** The allowance was added to stop the
 * criterion demanding the deletion of three `authoring-math` entries. Those
 * three were deleted two hours later by a session that had not seen it — and
 * deleting them was right. Prose in two places disagreed for two hours and the
 * corpus followed whichever ran last. A test is what makes the answer hold
 * still.
 *
 * It asserts the RULE against a synthetic package rather than the current
 * corpus, which today has zero such entries: a criterion with nothing to find
 * cannot demonstrate that it would find it.
 *
 * (Was `cat-harness/scripts/tests/manifest-remote-resolution.test.ts`; moved here by bean `70lx` beside its other half, `manifest-remote-resolution.test.ts`.)
 * The test of this file that reads `skill_fetch`'s implementation — a file of
 * the tools layer above, not of this one — lives in that layer's
 * `scripts/tests/manifest-remote-resolution.test.ts` (bean `7zz1` follow-up,
 * owner 2026-10-06: a test reading an upper layer's files moves to that
 * layer's declared test home). Standing alone, cat-harness does not hold it.
 */
import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { knownSkills, manifestResolvableSkills, remotePackageSkills } from "../known-skills.js";
import { codeWithoutComments } from "../repo-files.js";
import { TOOLS_ROOT } from "../lib/roots.ts";

/** Every `.ts` under the roots a sync could plausibly live in, repo-relative. */
function tsFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    const abs = join(root, rel);
    if (!existsSync(abs)) return;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const next = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "generated") continue;
        walk(next);
      } else if (e.name.endsWith(".ts")) out.push(next);
    }
  };
  for (const d of ["scripts", "src", "content", "adapters", "schemas"]) walk(d);
  return out;
}

/** A throwaway layer: one package naming a skill only a remote file declares. */
function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "nup0-"));
  mkdirSync(join(root, "skills", "pkg-a"), { recursive: true });
  mkdirSync(join(root, "skills", "remote-packages"), { recursive: true });
  // A held body, so the package is a package by this repo's own test (it has a .md).
  writeFileSync(join(root, "skills", "pkg-a", "held-skill.md"), "# held\n");
  writeFileSync(
    join(root, "skills", "pkg-a", "package-manifest.json"),
    JSON.stringify({ name: "pkg-a", skills: ["held-skill", "remote-only-skill"] }),
  );
  writeFileSync(
    join(root, "skills", "remote-packages", "somewhere-else.json"),
    JSON.stringify({
      name: "somewhere-else",
      repo: "https://example.invalid/other",
      wrapper: { skills: ["remote-only-skill"] },
    }),
  );
  return root;
}

describe("a manifest entry supplied only by a remote package", () => {
  test("is NOT servable by this instance", () => {
    const root = fixtureRoot();
    try {
      const servable = knownSkills(root);
      expect(servable.has("held-skill")).toBe(true);
      // The narrow question. If this ever answers true, `skill-servable` and
      // `check:workflow-refs` start calling an unfetchable ref resolved.
      expect(servable.has("remote-only-skill")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("is still recognised as declared, so a finding can say WHICH problem it is", () => {
    const root = fixtureRoot();
    try {
      expect(remotePackageSkills(root).has("remote-only-skill")).toBe(true);
      // The wider question is available and named, so the two readings are a
      // call-site choice rather than a property of whether some module happened
      // to scan a directory. That accident is what made a third definition.
      expect(manifestResolvableSkills(root).has("remote-only-skill")).toBe(true);
      expect(manifestResolvableSkills(root).has("held-skill")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the reason the allowance was closed is still true", () => {
  // Each of these is the evidence the change rests on. If one stops holding —
  // somebody implements the sync, or teaches the registry to read the directory
  // — then `manifest-skill-exists` should accept a remote declaration again, and
  // this test is where that argument is recorded rather than rediscovered.
  test("every reader of skills/remote-packages/ is accounted for, and none serves a body", () => {
    // The load-bearing fact, pinned rather than argued: a sync, a fetch or a
    // registry entry would all have to READ that directory. Five things do, and
    // each has a role that is not serving:
    //
    //   generate-docs.ts    documents the Docker requirements — what
    //                       schemas/kg/skill-package.ts says the wrappers are for
    //   gen-skill-docs.ts   EXCLUDES it, as a group holding non-skills
    //   known-skills.ts     remotePackageSkills(), the wider question
    //   kg-audit.ts         classifies the finding (which remedy), never excuses it
    //   repo-partition.ts   assigns the directory to a layer
    //
    // A sixth reader is where somebody either implements the sync — in which
    // case `manifest-skill-exists` should accept a remote declaration again, and
    // this list is where that argument is recorded instead of rediscovered — or
    // adds another partial one. Either way it should not be silent.
    //
    // Grepping for `shallow-clone` was the first attempt and is not evidence: it
    // cannot tell an implementation from a comment, and it flagged the comment
    // this very change added to `kg-audit.ts`.
    const readers = tsFiles(TOOLS_ROOT).filter((f) => {
      if (f.startsWith("schemas/") || f.includes(".test.")) return false;
      // The path as a path, not the words in prose — and CODE, not comments.
      // Quoting alone is not enough: a markdown code span in a comment is
      // backticked, and backticks quote strings in TypeScript, so a doc
      // comment naming the directory reads as a string literal. That is what
      // added `src/tools/skill-fetch.ts` to this list on 2026-09-19 while it
      // read nothing.
      const code = codeWithoutComments(readFileSync(join(TOOLS_ROOT, f), "utf8"));
      return /["'`][^"'`]*remote-packages[^"'`]*["'`]/.test(code);
    });
    // THREE, and it has been four and five. `scripts/gen-skill-docs.ts` came
    // off on 2026-09-19 — it never read the directory, and was counted only
    // because the pattern ran over prose.
    //
    // `scripts/generate-docs.ts` came off on 2026-09-20 for the opposite
    // reason: it really did read the directory, and was RETIRED to
    // `fsh-guts/scripts/` (bean `folio-assistant-3w0i`). It had been in this
    // repository since the root commit and had never run once — never in a
    // package.json script, never in a workflow, its output directory never
    // committed in any commit. So this list loses a reader that was real and
    // was never reached.
    //
    // The third entry RENAMED on 2026-09-20 rather than changing what it is:
    // `repo-partition.ts` was split into a generic engine and this layer's
    // data, and the literal travelled with the data. Still three, still the
    // same three readers — the invariant this test states is unchanged and
    // the assertion was not weakened to absorb the move.
    //
    // FOUR since 2026-09-24 (issue #556, bean `wlqd`): the sixth reader this
    // comment anticipated arrived, and it IS the sync —
    // `scripts/sync-remote-skills.ts`. It still serves no body itself. It
    // MATERIALIZES each declared skill as an ordinary local package, pinned and
    // fixity-checked, and `skill_fetch` serves that package as it serves any
    // other. So the allowance this file records as closed stays closed, for a
    // better reason than before: a synced skill resolves as a LOCAL skill,
    // and a remote declaration still resolves nothing on its own.
    expect(readers.sort()).toEqual([
      "scripts/kg-audit.ts",
      "scripts/known-skills.ts",
      "scripts/partition/instance-rules.ts",
      "scripts/sync-remote-skills.ts",
    ]);
  });

  test("kg-audit no longer excuses a remote-declared entry", () => {
    const audit = readFileSync(join(TOOLS_ROOT, "scripts", "kg-audit.ts"), "utf8");
    // The excusing form: filtering the entry out of the findings because a
    // remote package names it.
    expect(audit).not.toContain("!skills.has(e.skill) && !remote.has(e.skill)");
    // And it still distinguishes the two remedies.
    expect(audit).toContain("remote.has(e.skill)");
  });
});
