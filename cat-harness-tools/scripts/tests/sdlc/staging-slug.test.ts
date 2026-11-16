/**
 * The staging slug is one safe path segment, and the reasons are pinned here.
 *
 * @module scripts/tests/staging-slug
 *
 * Bean `fuzm`. `feature-staging.yml` builds `rm -rf "branches/$SLUG"` and
 * `git add -A "branches/$SLUG"` from a sanitised branch name. `.` is in the
 * permitted class and `sed` REPLACES rather than deletes, so input `..` gives
 * output `..` — and `branches/..` is the checkout root.
 *
 * The bean's finding was that the safety rested on invariants nothing stated
 * and no test pinned. These tests state them, and they RUN the real things
 * rather than asserting about them: the actual `sed` pipeline lifted from the
 * workflow, the actual `git check-ref-format`, the actual `rm`.
 *
 * Measuring rather than reasoning changed the conclusion twice:
 *   - `rm` refuses `.` and `..` operands outright, so nothing is deleted. The
 *     bean was written believing that was the hazard.
 *   - `git add -A` does NOT refuse, so a `..` slug stages the tree above. That
 *     is the residual, and it is why the guard is on the VALUE.
 *
 * The tests here that read the aggregate repository's own root
 * (`.github/workflows/feature-staging.yml`) live in
 * `test/staging-slug-workflows.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { repoRootFor } from "../../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const REPO = repoRootFor(resolve(HARNESS_ROOT));
const WORKFLOW = join(REPO, ".github", "workflows", "feature-staging.yml");

/** The sanitiser exactly as the workflow spells it. */
const SED = `sed 's|[^a-zA-Z0-9._-]|-|g' | sed 's|--*|-|g' | sed 's|^-||;s|-$||'`;

function slugify(branch: string): string {
  const r = spawnSync("bash", ["-c", `printf '%s' "$1" | ${SED}`, "bash", branch], {
    encoding: "utf-8",
  });
  return (r.stdout ?? "").trim();
}

describe("the sanitiser, run rather than described", () => {

  test("THE FINDING — input `..` survives as output `..`", () => {
    expect(slugify("..")).toBe("..");
  });

  test("a path separator can never survive: `/` is not in the permitted class", () => {
    // This is what bounds the hazard to two spellings. Every escape needing a
    // separator is already impossible.
    expect(slugify("../..")).toBe("..-..");
    expect(slugify("feat/../x")).toBe("feat-..-x");
    expect(slugify("a/b/c")).toBe("a-b-c");
  });

  test.each([["claude/my-branch", "claude-my-branch"], ["feat/ABC-1", "feat-ABC-1"], ["a..b", "a..b"]])(
    "%s -> %s",
    (input, expected) => {
      expect(slugify(input)).toBe(expected as string);
    },
  );
});

describe("GUARD 1 — git rejects every ref name containing `..`", () => {
  // Why a ref-derived slug cannot be `..`. Run against the real git, because
  // this is an invariant of somebody else's software and prose about it goes
  // stale silently.
  const accepts = (ref: string): boolean =>
    spawnSync("git", ["check-ref-format", "--branch", ref], { encoding: "utf-8" }).status === 0;

  test.each([[".."], ["a..b"], ["../.."], ["feat/../x"], ["..."], [".git"]])(
    "git refuses the branch name %s",
    (ref) => {
      expect(accepts(ref as string)).toBe(false);
    },
  );

  test("and it accepts the ordinary names this repo uses, so the check means something", () => {
    // A test that only ever asserts refusal would pass against a `git` that
    // refused everything, including a broken one.
    expect(accepts("claude/sleepy-babbage-ls90iz")).toBe(true);
    expect(accepts("main")).toBe(true);
  });
});

describe("GUARD 2 — `rm` refuses a `.` or `..` operand", () => {
  test("`rm -rf STAGING/..` deletes NOTHING and exits non-zero", () => {
    const root = mkdtempSync(join(tmpdir(), "slug-rm-"));
    mkdirSync(join(root, "STAGING", "keepme"), { recursive: true });
    writeFileSync(join(root, "STAGING/keepme/file.txt"), "x");

    const r = spawnSync("rm", ["-rf", "STAGING/.."], { cwd: root, encoding: "utf-8" });
    expect(r.status).not.toBe(0);
    // The preview is still there, which is the part that matters.
    expect(readFileSync(join(root, "STAGING/keepme/file.txt"), "utf-8")).toBe("x");
  });
});

describe("THE RESIDUAL — `git add` does not refuse, which is why the guard is on the VALUE", () => {
  test("`git add -A STAGING/..` stages the tree ABOVE the previews", () => {
    const root = mkdtempSync(join(tmpdir(), "slug-add-"));
    const git = (...a: string[]): void => {
      spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: root });
    };
    mkdirSync(join(root, "STAGING", "x"), { recursive: true });
    writeFileSync(join(root, "STAGING/x/f"), "a");
    writeFileSync(join(root, "rootfile"), "root");
    git("init", "-q", "-b", "gh-pages");
    git("add", "-A");
    git("commit", "-qm", "base");
    writeFileSync(join(root, "rootfile"), "changed");

    const r = spawnSync("git", ["add", "-A", "STAGING/.."], { cwd: root, encoding: "utf-8" });
    expect(r.status).toBe(0); // NOT refused — this is the finding
    const staged = spawnSync("git", ["diff", "--cached", "--name-only"], { cwd: root, encoding: "utf-8" });
    expect(staged.stdout.trim()).toBe("rootfile");
  });
});

describe("GUARD 3 — the workflow checks the VALUE, in every job that builds a path from it", () => {
  const yml = readFileSync(WORKFLOW, "utf-8");

  test("ALL THREE jobs that handle a slug refuse ``, `.` and `..`", () => {
    // Three, not two. A first draft expected two — `stage` and `cleanup` —
    // and `cleanup-dispatch` turned out to already carry the same guard on its
    // dispatch input, which is the case where guard 1 (git's ref rules) does
    // not hold at all.
    //
    // Asserted PER JOB, not as a count of occurrences
    // (`expect(guards.length).toBe(3)`, until 2026-09-20). Both forms pass
    // today, so this is not a bug fix; it is the weaker claim replaced by the
    // one the test's own NAME makes. A count cannot tell whether the guard
    // sits in the job that builds a path from the slug or in some other job
    // entirely, and three jobs now do — `stage` joined them once the deploy
    // moved off `peaceiris` and gained an `rm -rf` of its own slug.
    //
    // The exactness was there to catch a guard being REMOVED. A job-shaped
    // assertion still catches that, and additionally lets a job carry the
    // guard more than once — which the file now does. PR #563 added a SECOND
    // guard inside `stage`'s deploy step, re-checking the slug by value after
    // it crosses a job boundary as an output, immediately before the line
    // that deletes a directory.
    //
    // The count survived that only because the two are spelled differently
    // (`$STAGING_SLUG` and `""|.|..|*/*` against `$SLUG` and `""|.|..`), so
    // the regex misses the new one. That is luck, not coverage: normalising
    // the two spellings — an ordinary tidy-up — would take the count to four
    // and fail a test that is measuring nothing wrong. A guard added is not a
    // defect.
    const jobs = (
      Bun.YAML.parse(yml) as { jobs?: Record<string, { steps?: { run?: string }[] }> }
    ).jobs ?? {};
    const guarded = Object.entries(jobs)
      .filter(([, j]) =>
        (j.steps ?? []).some((s) => /case "\$SLUG" in\s*\n\s*""\|\.\|\.\.(?:\|_retired)?\)/.test(s.run ?? "")),
      )
      .map(([n]) => n)
      .sort();
    expect(guarded).toEqual(["cleanup", "cleanup-dispatch", "stage"]);
  });

  test("ALL THREE jobs also refuse `_retired` — the retired-record store is not a preview (bean 6pfo)", () => {
    // Staging a preview AT `branches/_retired` would replace every retired
    // record in one deploy, and cleaning one up would delete them all.
    const jobs = (
      Bun.YAML.parse(yml) as { jobs?: Record<string, { steps?: { run?: string }[] }> }
    ).jobs ?? {};
    const refusing = Object.entries(jobs)
      .filter(([, j]) => (j.steps ?? []).some((s) => /""\|\.\|\.\.(?:\|\*\/\*)?\|_retired\)/.test(s.run ?? "")))
      .map(([n]) => n)
      .sort();
    // The three that write or delete must refuse it. A job that only READS a
    // path built from the slug may refuse it too (conflict-gate's agent-build
    // check, folio-assistant#2881): a guard added is not a defect.
    expect(refusing).toEqual(expect.arrayContaining(["cleanup", "cleanup-dispatch", "stage"]));
  });

  test("every `rm -rf` on a slug is in a job whose slug was checked", () => {
    // The structural claim the bean asks for: no `rm -rf "branches/$X"` exists
    // in a job that did not first refuse an unsafe X.
    // The preview directory is a variable since previews moved to `branches/`
    // (`$PREVIEW_DIR`, or `$PD` for a legacy `STAGING/` one); a literal is still matched.
    const rms = yml.match(/rm -rf (?:-- )?"?(?:pages\/)?(?:STAGING|branches|\$PREVIEW_DIR|\$PD)\/\$\w+"?/g) ?? [];
    expect(rms.length).toBeGreaterThan(0);
    const guardCount = (yml.match(/""\|\.\|\.\.(?:\|_retired)?\)/g) ?? []).length;
    expect(guardCount).toBeGreaterThanOrEqual(rms.length);
  });
});
