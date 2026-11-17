/**
 * Tests for the quiet-claim liveness sweep.
 *
 * The falsifier this file is shaped around is the one the first working version
 * of the script FAILED: **a signal must appear only for the bean it is about.**
 * A test that merely checked "some beans are live" passed against a version that
 * named one branch as the signal for 25 unrelated beans — the exact defect, and
 * the one an advisory sweep is least likely to have caught in.
 */
import { describe, it, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  referencesBean,
  refsChangingBeans,
  refAgeMinutes,
  originSlug,
  formatReport,
  BULK_BEAN_CHANGES,
  REF_FRESHNESS_MINUTES,
  type SweepResult,
} from "../check-quiet-claim-liveness";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@e",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@e",
    },
  });
}

/** A throwaway repo with `origin/main` plus the named side branches. */
function repo(branches: Record<string, string[]>): { root: string; cleanup: () => void } {
  const base = mkdtempSync(join(tmpdir(), "quiet-"));
  const origin = join(base, "origin");
  mkdirSync(join(origin, "beans", "defs"), { recursive: true });
  git(origin, ["init", "-q", "-b", "main"]);
  writeFileSync(join(origin, "beans", "defs", "folio-assistant-aaaa--seed.md"), "seed\n");
  git(origin, ["add", "-A"]);
  git(origin, ["commit", "-qm", "seed"]);
  for (const [name, files] of Object.entries(branches)) {
    git(origin, ["checkout", "-q", "-b", name, "main"]);
    for (const f of files) {
      writeFileSync(join(origin, "beans", "defs", f), `touched by ${name}\n`);
    }
    git(origin, ["add", "-A"]);
    git(origin, ["commit", "-qm", `work on ${name}`]);
  }
  git(origin, ["checkout", "-q", "main"]);
  const clone = join(base, "clone");
  git(base, ["clone", "-q", origin, clone]);
  git(clone, ["fetch", "-q", "origin"]);
  return { root: clone, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

describe("a reference to a bean is bean-SHAPED, never a bare id (thux's trap)", () => {
  it("the qualified form is a reference", () => {
    expect(referencesBean("fixes folio-assistant-2634 at last", "2634")).toBe(true);
  });

  it("the backticked bare id is a reference — how beans are cited in prose here", () => {
    expect(referencesBean("bean `2634` is the cause", "folio-assistant-2634")).toBe(true);
  });

  it("a bare id inside a version string is NOT — the measured false positive", () => {
    // `thux`, 2026-09-23: a naive substring match on a four-character id matched
    // a dependabot pull request, because a digit run of that length occurs in
    // version numbers. A manufactured signal EXCUSES a claim nobody is on, so
    // this direction of error is the worse one.
    expect(referencesBean("bump foo from 1.2634.0 to 1.2635.0", "2634")).toBe(false);
  });

  it("a bare id as a plain word is not a reference either", () => {
    expect(referencesBean("see 2634 for details", "2634")).toBe(false);
  });

  it("an id that is a regex metacharacter run does not throw or match everything", () => {
    expect(referencesBean("anything at all", "a.*b")).toBe(false);
  });
});

describe("the branch signal names the bean it is about", () => {
  it("a branch changing one bean file is a signal for THAT bean only", () => {
    const { root, cleanup } = repo({
      "feature-x": ["folio-assistant-bbbb--x.md"],
      "feature-y": ["folio-assistant-cccc--y.md"],
    });
    const changes = refsChangingBeans(root, "origin/main", "beans/defs");
    const x = changes.find((c) => c.ref.endsWith("feature-x"));
    const y = changes.find((c) => c.ref.endsWith("feature-y"));
    expect(x?.files).toEqual(["beans/defs/folio-assistant-bbbb--x.md"]);
    expect(y?.files).toEqual(["beans/defs/folio-assistant-cccc--y.md"]);
    cleanup();
  });

  it("a branch that merged main in does NOT inherit main's bean churn", () => {
    // THE DEFECT THIS PINS, and it shipped in the first working version:
    // `git log ref --not main -- beans/defs` counted main's own commits as the
    // branch's on any branch with main merged in, giving refs that "touched"
    // 155-263 bean files. A merge-base diff asks what the branch CHANGES.
    const { root, cleanup } = repo({ "feature-x": ["folio-assistant-bbbb--x.md"] });
    const origin = resolve(root, "..", "origin");
    // main moves on, touching many beans; the branch merges it in.
    for (const f of ["folio-assistant-d1--a.md", "folio-assistant-d2--b.md", "folio-assistant-d3--c.md"]) {
      writeFileSync(join(origin, "beans", "defs", f), "main churn\n");
    }
    git(origin, ["add", "-A"]);
    git(origin, ["commit", "-qm", "main churns beans"]);
    git(origin, ["checkout", "-q", "feature-x"]);
    git(origin, ["merge", "-q", "--no-edit", "main"]);
    git(origin, ["checkout", "-q", "main"]);
    git(root, ["fetch", "-q", "origin"]);

    const changes = refsChangingBeans(root, "origin/main", "beans/defs");
    const x = changes.find((c) => c.ref.endsWith("feature-x"));
    expect(x?.files).toEqual(["beans/defs/folio-assistant-bbbb--x.md"]);
    cleanup();
  });

  it("a merged branch is not live work at all", () => {
    const { root, cleanup } = repo({ "feature-x": ["folio-assistant-bbbb--x.md"] });
    const origin = resolve(root, "..", "origin");
    git(origin, ["merge", "-q", "--no-edit", "feature-x"]);
    git(root, ["fetch", "-q", "origin"]);
    const changes = refsChangingBeans(root, "origin/main", "beans/defs");
    expect(changes.map((c) => c.ref)).not.toContain("origin/feature-x");
    cleanup();
  });

  it("carries the ref's tip age, so an abandoned branch is visible rather than counted blind", () => {
    const { root, cleanup } = repo({ "feature-x": ["folio-assistant-bbbb--x.md"] });
    const changes = refsChangingBeans(root, "origin/main", "beans/defs");
    expect(changes[0]?.tipAgeHours).toBeGreaterThanOrEqual(0);
    cleanup();
  });
});

describe("a bulk ref is excluded from the signal and REPORTED", () => {
  it("a ref changing more than 11 bean files is bulk", () => {
    const many = Array.from({ length: BULK_BEAN_CHANGES + 1 }, (_, i) => `folio-assistant-b${i}--f.md`);
    const { root, cleanup } = repo({ sweep: many });
    const changes = refsChangingBeans(root, "origin/main", "beans/defs");
    const s = changes.find((c) => c.ref.endsWith("sweep"));
    expect(s?.files.length).toBeGreaterThan(BULK_BEAN_CHANGES);
    cleanup();
  });

  it("the threshold sits AT the measured gap, not at a round number", () => {
    // The basis on BULK_BEAN_CHANGES records the distribution it came from:
    // 27 refs change 1 file, ..., 1 changes 11, then a gap to 30 and 198. A
    // round 10 or 25 would cut inside a populated band or past the gap; the
    // gap is the thing with evidence behind it. This test exists so a later
    // "tidy up to 10" has to argue with the measurement.
    expect(BULK_BEAN_CHANGES).toBe(11);
  });

  it("the excluded refs reach the report — an exclusion nobody sees is a silence list", () => {
    const r: SweepResult = {
      verdict: "checked",
      live: [],
      quiet: [],
      claimed: 1,
      parenting: 0,
      refsSeen: 1,
      bulkRefs: [{ ref: "origin/claude/BULK-REF-NAME", files: 198 }],
    };
    const out = formatReport(r);
    expect(out).toContain("BULK-REF-NAME");
    expect(out).toContain("198");
  });
});

describe("could not determine is never a clean run", () => {
  it("an undetermined sweep reports no quiet claims at all", () => {
    const r: SweepResult = {
      verdict: "undetermined",
      reason: "THE-STATED-REASON",
      live: [],
      quiet: [],
      claimed: 0,
      parenting: 0,
      refsSeen: 0,
      bulkRefs: [],
    };
    const out = formatReport(r);
    expect(out).toContain("COULD NOT DETERMINE");
    expect(out).toContain("THE-STATED-REASON");
    expect(out).toContain("not a clean run");
    // The discrimination: it must not also print a "0 quiet claims" line, which
    // is what a reader would take for a pass.
    expect(out).not.toContain("QUIET — no open PR");
  });

  it("ref freshness is part of the evidence, and the limit is short on purpose", () => {
    // `pomp`: two confident, specific, FALSE findings in one session, both from
    // reading refs older than the claim. The window is short because sibling
    // sessions here merge every few minutes.
    expect(REF_FRESHNESS_MINUTES).toBeLessThanOrEqual(30);
  });

  it("a repo with no GitHub origin is undetermined, not quiet", () => {
    const { root, cleanup } = repo({});
    // The clone's origin is a local path, so no slug can be derived.
    expect(originSlug(root)).toBeUndefined();
    cleanup();
  });
});

/** This layer's root: inside the checkout whether it is the repository root or a layer in one. */
const THIS_REPO = resolve(import.meta.dir, "..", "..");

/**
 * Whether this checkout has what the probe reads — `origin` refs and a
 * FETCH_HEAD — established with git directly rather than through the function
 * under test, so a probe that cannot read them fails instead of skipping. A
 * linked worktree that has never fetched has no FETCH_HEAD of its own.
 */
function hasFetchedRefs(root: string): boolean {
  try {
    return (
      git(root, ["for-each-ref", "--count=1", "refs/remotes/origin"]).trim() !== "" &&
      git(root, ["rev-parse", "--verify", "-q", "FETCH_HEAD"]).trim() !== ""
    );
  } catch {
    return false;
  }
}

describe("this repository", () => {
  // Skipped, not passed, when the checkout has no origin refs or has never
  // fetched: undetermined is not a clean run.
  it.skipIf(!hasFetchedRefs(THIS_REPO))("can establish how stale its own refs are", () => {
    // Against the real repo rather than a fixture: the freshness probe reads
    // FETCH_HEAD, which a fixture clone has and a bare `git init` does not, so
    // only the real tree exercises the path the script actually takes.
    const age = refAgeMinutes(THIS_REPO);
    expect(age).toBeNumber();
    expect(age).toBeGreaterThanOrEqual(0);
  });
});
