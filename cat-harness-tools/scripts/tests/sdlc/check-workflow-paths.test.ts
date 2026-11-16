/**
 * Tests for the workflow-script-path check.
 *
 * Each pins a REFUSAL or a discrimination the check has to make, rather than
 * the happy path: the check's whole value is that it does not report a
 * working workflow as broken (which teaches readers to skim it) and does not
 * report a broken one as working (which is the defect it exists for).
 *
 * @module scripts/tests/check-workflow-paths.test
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  FOLIO_PATHS,
  Verdict,
  allWorkDirs,
  allowlistsNotOursReason,
  cdTarget,
  cwdFlag,
  githubPathFindingsFrom,
  invocationsFrom,
  invokedPath,
  isAllowedGithubInvocation,
  workDirBaseline,
  workDirKey,
  workDirsFrom,
} from "../../check-workflow-paths.js";

/** A workflow with one job and one step running `body`. */
function wf(body: string, extra = ""): string {
  return `
jobs:
  j:
    steps:
${extra}      - name: s
        run: |
${body
  .split("\n")
  .map((l) => `          ${l}`)
  .join("\n")}
`;
}

describe("invokedPath", () => {
  test("takes a script path", () => {
    expect(invokedPath("bun run cat-harness/scripts/x.ts")).toBe("cat-harness/scripts/x.ts");
  });

  test("an npm SCRIPT NAME is not a path — it is the recommended fix", () => {
    // `bun run cat check:ci-health` puts the path in package.json once. Treating
    // it as a path would report the fix as a finding.
    expect(invokedPath("bun run cat check:ci-health --out /tmp/x.md")).toBeUndefined();
    expect(invokedPath("bun run cat health")).toBeUndefined();
  });

  test("ignores lines that are not bun invocations", () => {
    expect(invokedPath("echo bun run x.ts")).toBeUndefined();
    expect(invokedPath("# bun run x.ts")).toBeUndefined();
  });

  test("sees past --cwd to the script", () => {
    expect(invokedPath("bun run --cwd content pipeline/a.ts")).toBe("pipeline/a.ts");
    expect(cwdFlag("bun run --cwd content pipeline/a.ts")).toBe("content");
  });
});

describe("invokedPath — the `bash` verb", () => {
  // Added after the class recurred in the same file within the hour, from a
  // different session: `bash cat-harness/scripts/render-log-union-attr.sh`
  // at the workspace root while the platform is at `source/`, twice, both
  // dying rc=127 under `bash -e`.
  test("takes a shell script", () => {
    expect(invokedPath("bash cat-harness/scripts/x.sh pages")).toBe("cat-harness/scripts/x.sh");
    expect(invokedPath("sh scripts/y.sh")).toBe("scripts/y.sh");
  });

  test("a flag or a `-c` string is not a path", () => {
    expect(invokedPath("bash -c 'echo hi'")).toBeUndefined();
    expect(invokedPath("bash -euo pipefail")).toBeUndefined();
  });

  test("a bare `bash` with no script is not a path", () => {
    expect(invokedPath("bash")).toBeUndefined();
  });

  test("it is the VERB that was missing, not the machinery", () => {
    // Same job shape as the bun case above; only the verb differs.
    const text = `
jobs:
  j:
    steps:
      - uses: actions/checkout@v4
        with:
          path: source
      - name: s
        run: bash cat-harness/scripts/x.sh pages
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.verdict).toBe(Verdict.Missing);
  });
});

describe("workflow-level defaults", () => {
  test("a workflow-level `defaults.run.working-directory` applies", () => {
    // `snappea_wasm.yml` sets its cwd here and not per job, so every path in
    // it was measured from the repository root — the wrong-frame error this
    // module exists to catch, inside the module that catches it.
    const text = `
defaults:
  run:
    working-directory: cat-harness-tools
jobs:
  j:
    steps:
      - name: s
        run: bun run scripts/gates.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.cwd).toBe("cat-harness-tools");
    expect(inv.verdict).toBe(Verdict.Resolves);
  });

  test("a JOB default overrides the workflow default", () => {
    const text = `
defaults:
  run:
    working-directory: nowhere
jobs:
  j:
    defaults:
      run:
        working-directory: cat-harness-tools
    steps:
      - name: s
        run: bun run scripts/gates.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.cwd).toBe("cat-harness-tools");
  });
});

describe("cdTarget", () => {
  test("a plain cd is followed", () => {
    expect(cdTarget("cd content")).toBe("content");
  });

  test("a cd naming a VARIABLE is unresolvable, not ignorable", () => {
    // null, not undefined: undefined means "not a cd", null means "a cd I
    // cannot follow". Collapsing them would silently resolve against the
    // wrong directory.
    expect(cdTarget('cd "$RUNNER_TEMP"')).toBeNull();
    expect(cdTarget("cd $HOME/x")).toBeNull();
    expect(cdTarget("cd build-*")).toBeNull();
  });

  test("a non-cd line is undefined", () => {
    expect(cdTarget("bun run x.ts")).toBeUndefined();
  });
});

describe("cwd tracking", () => {
  test("a cd earlier in the SAME run block moves the path", () => {
    const [inv] = invocationsFrom("f.yml", wf("cd content\nbun run pipeline/build.ts"));
    expect(inv.cwd).toBe("content");
  });

  test("`cd x && bun …` on one line is followed too", () => {
    const [inv] = invocationsFrom("f.yml", wf("cd content && bun run pipeline/build.ts"));
    expect(inv.cwd).toBe("content");
  });

  test("a cd does NOT leak into the next run block — each `run:` is its own shell", () => {
    // This is the misreading that makes an unprefixed path look correct.
    const text = `
jobs:
  j:
    steps:
      - name: install
        run: cd content && bun install
      - name: check
        run: bun run cat-harness/scripts/x.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.cwd).toBe("");
  });

  test("a step's working-directory applies", () => {
    const text = `
jobs:
  j:
    steps:
      - name: s
        working-directory: cat-harness-tools
        run: bun run scripts/gates.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.cwd).toBe("cat-harness-tools");
    expect(inv.verdict).toBe(Verdict.Resolves);
  });

  test("a job-level defaults.run.working-directory applies", () => {
    const text = `
jobs:
  j:
    defaults:
      run:
        working-directory: cat-harness-tools
    steps:
      - name: s
        run: bun run scripts/gates.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.verdict).toBe(Verdict.Resolves);
  });
});

describe("verdicts", () => {
  test("a path that is not there from the computed cwd is MISSING", () => {
    const [inv] = invocationsFrom("f.yml", wf("bun run scripts/check-ci-health.ts"));
    expect(inv.verdict).toBe(Verdict.Missing);
  });

  test("the same script WITH the cat-harness prefix resolves", () => {
    const [inv] = invocationsFrom("f.yml", wf("bun run cat-harness-tools/scripts/check-ci-health.ts"));
    expect(inv.verdict).toBe(Verdict.Resolves);
  });

  test("an unresolvable cd yields UNDETERMINED, never a pass", () => {
    const [inv] = invocationsFrom("f.yml", wf('cd "$RUNNER_TEMP"\nbun run scripts/x.ts'));
    expect(inv.verdict).toBe(Verdict.Undetermined);
    expect(inv.note).toContain("variable");
  });

  test("a declared folio path is NEEDS-FOLIO and carries its reason", () => {
    // The shipped table is empty since folio-assistant#3066, so the entry is
    // the test's own: what is pinned is the verdict a declaration produces.
    const table = [{ match: "pipeline/build.ts", reason: "a folio's own build, which this checkout has no copy of" }];
    const [inv] = invocationsFrom("f.yml", wf("cd content\nbun run pipeline/build.ts"), table);
    expect(inv.verdict).toBe(Verdict.NeedsFolio);
    expect(inv.note).toMatch(/folio/i);
  });
});

describe("checkout paths", () => {
  test("a step working in an actions/checkout `path:` resolves against the repo", () => {
    const text = `
jobs:
  j:
    steps:
      - uses: actions/checkout@v4
        with:
          path: source
      - name: s
        working-directory: source
        run: bun run cat-harness-tools/scripts/gates.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.verdict).toBe(Verdict.Resolves);
  });

  // The two shapes CI caught within an hour of the first version shipping.
  // Both are CORRECT invocations that were reported as broken, which is the
  // false-positive failure mode this module most has to avoid.
  test("the prefix may be in the PATH, from the workspace root", () => {
    const text = `
jobs:
  j:
    steps:
      - uses: actions/checkout@v4
        with:
          path: source
      - name: s
        run: bun run source/cat-harness-tools/scripts/gates.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.verdict).toBe(Verdict.Resolves);
  });

  test("the prefix may be reached RELATIVELY, through `..` from a sibling dir", () => {
    const text = `
jobs:
  j:
    steps:
      - uses: actions/checkout@v4
        with:
          path: source
      - name: s
        working-directory: pages
        run: bun run ../source/cat-harness-tools/scripts/gates.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.verdict).toBe(Verdict.Resolves);
  });

  // ── Bean `7iog`: knowing the prefixes is not knowing where the tree IS ──
  //
  // Collecting `path:` values only ever made this check MORE permissive. A
  // path under a checkout resolved; a path NOT under one resolved too,
  // because it fell through to the repository. Three of four backoff calls in
  // `feature-staging.yml` passed this check and aborted their step at run
  // time, and the retry those loops exist to provide therefore never ran.
  test("a path at the bare workspace root is BROKEN when the checkout went elsewhere", () => {
    const text = `
jobs:
  j:
    steps:
      - uses: actions/checkout@v4
        with:
          path: source
      - name: s
        run: bun run cat-harness-tools/scripts/gates.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.verdict).toBe(Verdict.Missing);
    // The generic "does not resolve from the repository root" would be FALSE
    // here — it resolves perfectly well, which is the whole trap.
    expect(inv.note).toContain("empty directory at run time");
  });

  test("...and is fine when the job ALSO checks out at the root", () => {
    const text = `
jobs:
  j:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/checkout@v4
        with:
          path: source
      - name: s
        run: bun run cat-harness-tools/scripts/gates.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.verdict).toBe(Verdict.Resolves);
  });

  test("a job with NO checkout keeps the old behaviour rather than inventing a layout", () => {
    // Most jobs in most workflows. Failing these would be a false positive
    // per step, which is the failure mode that teaches a reader to skim.
    const text = `
jobs:
  j:
    steps:
      - name: s
        run: bun run cat-harness-tools/scripts/gates.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.verdict).toBe(Verdict.Resolves);
  });

  test("a path landing in a checkout at ANOTHER ref is undetermined, never green", () => {
    // `pages` holds `gh-pages`. Stripping its prefix measures the path
    // against the wrong commit — how the third broken call kept passing
    // after the other two were caught.
    const text = `
jobs:
  j:
    steps:
      - uses: actions/checkout@v4
        with:
          path: source
      - uses: actions/checkout@v4
        with:
          ref: gh-pages
          path: pages
      - name: s
        working-directory: pages
        run: bun run cat-harness-tools/scripts/gates.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.verdict).toBe(Verdict.Undetermined);
    expect(inv.note).toContain("gh-pages");
  });

  test("...while reaching OUT of it to the HEAD checkout still resolves", () => {
    const text = `
jobs:
  j:
    steps:
      - uses: actions/checkout@v4
        with:
          path: source
      - uses: actions/checkout@v4
        with:
          ref: gh-pages
          path: pages
      - name: s
        working-directory: pages
        run: bun run ../source/cat-harness-tools/scripts/gates.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.verdict).toBe(Verdict.Resolves);
  });

  test("`ref: ${{ github.sha }}` is THIS tree, not another one", () => {
    const text = `
jobs:
  j:
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.sha }}
          path: source
      - name: s
        working-directory: source
        run: bun run cat-harness-tools/scripts/gates.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.verdict).toBe(Verdict.Resolves);
  });

  test("a checkout of a DIFFERENT repository is not collected", () => {
    // Nothing here can say whether a path in someone else's tree resolves,
    // so the prefix must not be stripped and the verdict must not be green.
    const text = `
jobs:
  j:
    steps:
      - uses: actions/checkout@v4
        with:
          repository: other/repo
          path: source
      - name: s
        working-directory: source
        run: bun run cat-harness-tools/scripts/gates.ts
`;
    const [inv] = invocationsFrom("f.yml", text);
    expect(inv.verdict).toBe(Verdict.Missing);
  });
});

describe("FOLIO_PATHS", () => {
  test("every entry carries a reason", () => {
    for (const f of FOLIO_PATHS) {
      expect(f.reason.length).toBeGreaterThan(20);
    }
  });

  test("build.ts is not exempt any more, and is not resolved to the platform's copy either", () => {
    // Its entry left with `publish.yml` (folio-assistant#3066). The trap it
    // recorded still holds: `pipeline/build.ts` exists in cat-harness-tools,
    // a DIFFERENT file with the same basename, and a folio's `cd content`
    // copy must not be read as that one. With no exemption it is MISSING —
    // a finding, not a pass and not a quiet NEEDS-FOLIO.
    expect(FOLIO_PATHS.find((f) => f.match === "pipeline/build.ts")).toBeUndefined();
    const [inv] = invocationsFrom("f.yml", wf("cd content\nbun run pipeline/build.ts"));
    expect(inv.verdict).toBe(Verdict.Missing);
  });
});

// ── The cwd itself: `working-directory` as a SUBJECT (bean `ai9u`) ─────────
//
// Until these, `working-directory` was read only to compute the frame a
// script path resolved against — trusted input, never checked. Eight
// declarations named absent directories across four workflows while this
// module printed `✓ every workflow script path resolves`.
//
// Each test below pins a DISCRIMINATION rather than the happy path, for the
// reason the header of this file gives: the criterion's whole value is that
// it separates the two `folio-assistant` TypeDoc steps (real, fixable) from
// the twenty-four folio declarations around them (absent on purpose).

/** A workflow with one job whose single step declares `dir` as its cwd. */
function wfCwd(dir: string, checkout = ""): string {
  return `
jobs:
  j:
    steps:
${checkout}      - name: s
        working-directory: ${dir}
        run: echo hi
`;
}

const verdictOf = (yaml: string): Verdict | undefined =>
  workDirsFrom("w.yml", yaml)[0]?.verdict;

describe("working-directory — does the cwd exist at all", () => {
  test("an ABSENT directory is Missing — the defect `ai9u` exists for", () => {
    expect(verdictOf(wfCwd("folio-assistant"))).toBe(Verdict.Missing);
  });

  test("a present one resolves", () => {
    expect(verdictOf(wfCwd("cat-harness"))).toBe(Verdict.Resolves);
  });

  test("a trailing slash and a leading ./ are the same directory", () => {
    expect(verdictOf(wfCwd("cat-harness/"))).toBe(Verdict.Resolves);
    expect(verdictOf(wfCwd("./cat-harness"))).toBe(Verdict.Resolves);
  });

  test("a computed value is Undetermined — NOT a pass, and not a defect", () => {
    // `${{ matrix.lake-root }}`. Reporting it Missing would be a false
    // positive on a workflow that is fine; reporting it Resolves would be
    // this module's own founding error.
    expect(verdictOf(wfCwd("${{ matrix.lake-root }}"))).toBe(Verdict.Undetermined);
  });

  // `tools/hecke-engine` rather than `content`: the `content` entry left
  // FOLIO_WORKDIRS under bean `52dz`, when the workflows that `cd content`
  // became `folio_init` templates, and `folio-assistant/snappea-wasm` left it
  // with `snappea_wasm.yml` (folio-assistant#3066).
  test("a folio directory is exempt WITH A REASON, not silently skipped", () => {
    const [wd] = workDirsFrom("w.yml", wfCwd("tools/hecke-engine"));
    expect(wd?.verdict).toBe(Verdict.NeedsFolio);
    expect(wd?.note ?? "").not.toBe("");
  });

  test("the exemption matches a subdirectory of a folio path too", () => {
    expect(verdictOf(wfCwd("tools/hecke-engine/src"))).toBe(Verdict.NeedsFolio);
  });
});

describe("working-directory — the checkout layout decides what exists", () => {
  const co = (spec: string) => `      - uses: actions/checkout@v4\n        with:\n${spec}`;

  test("a checkout `path:` MATERIALISES the cwd, so it resolves", () => {
    // `source/` is not in the repository and is correct anyway: the checkout
    // creates it. This is the `7iog` insight applied to the cwd.
    expect(verdictOf(wfCwd("source", co("          path: source\n")))).toBe(Verdict.Resolves);
  });

  test("a path UNDER a checkout is measured inside that tree", () => {
    expect(
      verdictOf(wfCwd("source/cat-harness", co("          path: source\n"))),
    ).toBe(Verdict.Resolves);
    expect(verdictOf(wfCwd("source/nope", co("          path: source\n")))).toBe(
      Verdict.Missing,
    );
  });

  test("a gh-pages checkout ROOT resolves — unlike the same prefix for a script path", () => {
    // The distinction this criterion turns on. For a script path the question
    // is what is IN that tree, which HEAD cannot answer. For a cwd the only
    // question is whether the directory exists, and checkout makes it.
    // Carrying the invocation rule across would have made `feature-staging`'s
    // `pages` a permanent unknown nobody could ever retire.
    const pages = co("          ref: gh-pages\n          path: pages\n");
    expect(verdictOf(wfCwd("pages", pages))).toBe(Verdict.Resolves);
  });

  test("...but a path BELOW it is still Undetermined", () => {
    const pages = co("          ref: gh-pages\n          path: pages\n");
    expect(verdictOf(wfCwd("pages/STAGING", pages))).toBe(Verdict.Undetermined);
  });

  test("checked out elsewhere, the workspace root is EMPTY at run time", () => {
    // `cat-harness` resolves against the repository and is still wrong: this
    // job never materialised it. Reads as correct, which is the whole point.
    expect(verdictOf(wfCwd("cat-harness", co("          path: source\n")))).toBe(
      Verdict.Missing,
    );
  });
});

describe("working-directory — where it is DECLARED", () => {
  test("a workflow-level default is ONE finding, not one per job", () => {
    // `snappea_wasm.yml` sets one covering four jobs. Emitting it per job
    // turns a single edit into four findings and makes the count read as a
    // severity — measured: 34 declarations reported where the file has 31.
    const yaml = `
defaults:
  run:
    working-directory: folio-assistant/snappea-wasm
jobs:
  a:
    steps:
      - name: s
        run: echo hi
  b:
    steps:
      - name: s
        run: echo hi
  c:
    steps:
      - name: s
        run: echo hi
`;
    const wds = workDirsFrom("w.yml", yaml);
    expect(wds.filter((w) => w.step === "(workflow defaults)")).toHaveLength(1);
  });

  test("...but a SECOND verdict is a second finding, not a duplicate", () => {
    // Folded only when identical. The same value can resolve in one job and
    // not another, because each job has its own checkout layout.
    const yaml = `
defaults:
  run:
    working-directory: cat-harness-tools
jobs:
  plain:
    steps:
      - name: s
        run: echo hi
  relocated:
    steps:
      - uses: actions/checkout@v4
        with:
          path: source
      - name: s
        run: echo hi
`;
    const wds = workDirsFrom("w.yml", yaml).filter((w) => w.step === "(workflow defaults)");
    expect(wds).toHaveLength(2);
    expect(new Set(wds.map((w) => w.verdict))).toEqual(
      new Set([Verdict.Resolves, Verdict.Missing]),
    );
  });

  test("job defaults and step-level are both read", () => {
    const yaml = `
jobs:
  j:
    defaults:
      run:
        working-directory: cat-harness-tools
    steps:
      - name: s
        working-directory: folio-assistant
        run: echo hi
`;
    const wds = workDirsFrom("w.yml", yaml);
    expect(wds.map((w) => w.step)).toEqual(["(job defaults)", "s"]);
    expect(wds.map((w) => w.verdict)).toEqual([Verdict.Resolves, Verdict.Missing]);
  });

  test("a step with NO cwd contributes nothing — the default is the root", () => {
    expect(workDirsFrom("w.yml", wf("bun run cat-harness/scripts/x.ts"))).toHaveLength(0);
  });
});

describe("working-directory — a `cd` target is deliberately NOT checked", () => {
  test("a directory the same block creates is not a finding", () => {
    // GitHub evaluates `working-directory` BEFORE the script runs, so it must
    // pre-exist. A `cd` need not — `publish.yml` does `mkdir -p appendices/`
    // and then works in it. Folding the two together reports a correct
    // workflow as broken, which this module's header calls worse than having
    // no check at all.
    const yaml = wf("mkdir -p appendices\ncd appendices\nbun run ../cat-harness/scripts/x.ts");
    expect(workDirsFrom("w.yml", yaml)).toHaveLength(0);
  });
});

describe("the baseline is a RATCHET", () => {
  test("every entry carries a reason, checked on load", () => {
    // An allowance nobody wrote a reason for is one nobody can retire.
    expect(() => workDirBaseline()).not.toThrow();
    expect(workDirBaseline().size).toBeGreaterThan(0);
  });

  test("it keys on workflow and value, not on a line number", () => {
    // So a step added above does not churn the file.
    const [wd] = workDirsFrom("publish.yml", wfCwd("folio-assistant"));
    expect(workDirKey(wd!)).toBe("publish.yml: folio-assistant");
  });

  test("MUTATION: a missing working-directory is actually detected", () => {
    // `t6s7` — the reconciliation that held by construction, where mutating
    // the derivation left every test green. The criterion is only worth
    // having if a missing directory actually produces a finding.
    //
    // Asserted on a FIXTURE rather than on the live tree, and the reason is
    // the whole point of this test: on 2026-09-22 the two real findings this
    // criterion had — `discoverability-docs.yml` and `publish.yml`, both
    // naming the stale `folio-assistant` prefix from the #223 split — were
    // REPAIRED on the owner's ruling. The live tree then held zero `Missing`
    // work-dirs, and a non-vacuity test reading the live corpus asserted
    // `length > 0` and went red **because the defect it was watching had been
    // fixed**. A test that fails when the repository improves is testing the
    // repository, not the checker.
    expect(verdictOf(wfCwd("folio-assistant"))).toBe(Verdict.Missing);
    expect(verdictOf(wfCwd("cat-harness"))).toBe(Verdict.Resolves);
  });

  test("RATCHET: every live Missing work-dir is baselined", () => {
    // The ratchet half, still read from the live tree, because that is the
    // property it exists to hold. Zero findings satisfies it vacuously and
    // that is CORRECT here — the test above is what keeps the criterion from
    // being vacuous, so this one does not also have to.
    const live = allWorkDirs().filter((w) => w.verdict === Verdict.Missing);
    expect(live.every((w) => workDirBaseline().has(workDirKey(w)))).toBe(true);
  });
});

describe("the allowlist ratchets are the harness root's (cat-harness-tools#1701)", () => {
  test("a content root (no gates workflow) excuses them, with a reason", () => {
    const root = mkdtempSync(join(tmpdir(), "wp-content-"));
    try {
      expect(allowlistsNotOursReason(root)).toContain("content root");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a harness root judges them as before", () => {
    const root = mkdtempSync(join(tmpdir(), "wp-harness-"));
    try {
      mkdirSync(join(root, ".github", "workflows"), { recursive: true });
      writeFileSync(join(root, ".github", "workflows", "code-quality-gates.yml"), "jobs: {}\n");
      expect(allowlistsNotOursReason(root)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("disallowed .github/ invocations (bean folio-assistant-dtda)", () => {
  test("a workflow run: invoking .github/skills/ fails the gate", () => {
    const findings = githubPathFindingsFrom(
      "skill-l2-dak.yml",
      wf("python .github/skills/cli/dak_skill.py run\nbun run .github/skills/bpmn_author/validate.ts"),
    );
    expect(findings.map((f) => f.githubPath)).toEqual([
      ".github/skills/cli/dak_skill.py",
      ".github/skills/bpmn_author/validate.ts",
    ]);
  });

  test("allows .github/workflows/, bootstrap pointers, CI plumbing and declared directories", () => {
    expect(isAllowedGithubInvocation(".github/workflows/helper.sh")).toBe(true);
    expect(isAllowedGithubInvocation(".github/mount-from-lock.sh")).toBe(true);
    expect(isAllowedGithubInvocation(".github/cat.ts")).toBe(true);
    expect(isAllowedGithubInvocation(".github/scripts/repin-train.ts")).toBe(true);
    expect(isAllowedGithubInvocation(".github/skills/cli/dak_skill.py")).toBe(false);
    expect(isAllowedGithubInvocation(".github/declared-tools/run.ts", new Set([".github/declared-tools"]))).toBe(true);
  });
});
