/**
 * `check-workflow-submodules` — the rule, and the three things it must not do.
 *
 * The fixtures are written as workflow YAML rather than as parsed objects,
 * because the module reads TEXT: a test over a hand-built tree would pass
 * while the regexes that do the actual work went wrong.
 */

import { describe, expect, test } from "bun:test";

import { actionDirOf, auditWorkflow, bunRunsOf, checkoutsOf, jobsOf, pinnedMountsOf } from "../../check-workflow-submodules.ts";

/** The defect as it actually appeared in `feature-staging.yml`'s `cleanup` job. */
const BROKEN = `name: staging
on: [push]
jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Check out the platform
        uses: actions/checkout@v7
        with:
          path: source
      - run: |
          bun run source/cat-harness/scripts/staging-record.ts retire --out x.json
`;

/** Since bean `nn8e` (#2462) the cure is a lock replay into the checkout's path. */
const REPLAY = "      - run: bun \"source/cat-harness/scripts/mount-from-lock.ts\" --root \"source\"\n";
const FIXED = BROKEN.replace("      - run: |\n", `${REPLAY}      - run: |\n`);

describe("the rule", () => {
  test("a job running a platform script from a submodule-less checkout is a finding", () => {
    const { findings } = auditWorkflow("staging.yml", BROKEN);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.job).toBe("cleanup");
    expect(findings[0]?.detail).toContain("staging-record.ts");
  });

  test("a lock replay into the checkout's path clears it", () => {
    expect(auditWorkflow("staging.yml", FIXED).findings).toHaveLength(0);
  });

  test("the index checkout's `.github/mount-from-lock.sh` wrapper is a lock replay too", () => {
    const wrapped = BROKEN.replace("      - run: |\n", '      - run: bash "./.github/mount-from-lock.sh" --root "source"\n      - run: |\n');
    expect(auditWorkflow("staging.yml", wrapped).findings).toHaveLength(0);
    const elsewhere = BROKEN.replace("      - run: |\n", "      - run: bash .github/mount-from-lock.sh --root other\n      - run: |\n");
    expect(auditWorkflow("staging.yml", elsewhere).findings).toHaveLength(1);
  });

  test("`submodules: true` alone no longer clears it — there is no `.gitmodules` to read", () => {
    const sub = BROKEN.replace("          path: source", "          submodules: true\n          path: source");
    expect(auditWorkflow("staging.yml", sub).findings).toHaveLength(1);
  });

  test("a replay into a DIFFERENT path does not clear it", () => {
    const other = BROKEN.replace("      - run: |\n", `${REPLAY.replaceAll("source", "elsewhere")}      - run: |\n`);
    expect(auditWorkflow("staging.yml", other).findings).toHaveLength(1);
  });

  test("a step-output path reached through `env:` is followed to its value (folio-staging.yml)", () => {
    const out = `jobs:
  stage:
    steps:
      - uses: actions/checkout@v7
        with:
          path: \${{ steps.platform.outputs.checkout }}
      - name: Mount
        env:
          PLATFORM_CHECKOUT: \${{ steps.platform.outputs.checkout }}
        run: bun "$PLATFORM_CHECKOUT/cat-harness/scripts/mount-from-lock.ts" --root "$PLATFORM_CHECKOUT"
      - run: bun run "$PLATFORM_CHECKOUT/cat-harness/scripts/x.ts"
`;
    expect(auditWorkflow("w.yml", out).findings).toHaveLength(0);
    expect(auditWorkflow("w.yml", out.replace("          PLATFORM_CHECKOUT: ${{ steps.platform.outputs.checkout }}", "          PLATFORM_CHECKOUT: ${{ inputs.other }}")).findings).toHaveLength(1);
  });

  test("a job that runs NO platform script is not a finding, however it checked out", () => {
    const none = BROKEN.replace(/      - run: \|\n.*\n/s, "      - run: echo hello\n");
    expect(auditWorkflow("staging.yml", none).findings).toHaveLength(0);
  });
});

describe("what it must NOT flag", () => {
  test("a PUBLISH-branch checkout is exempt — it holds built output, not the platform", () => {
    const pages = `jobs:
  deploy:
    steps:
      - uses: actions/checkout@v7
        with:
          ref: gh-pages
          path: pages
      - run: bun run pages/whatever.ts
`;
    expect(auditWorkflow("w.yml", pages).findings).toHaveLength(0);
  });

  test("the `publish_branch` input is exempt for the same reason", () => {
    const pub = `jobs:
  deploy:
    steps:
      - uses: actions/checkout@v7
        with:
          ref: \${{ inputs.publish_branch }}
          path: pages
      - run: bun run pages/whatever.ts
`;
    expect(auditWorkflow("w.yml", pub).findings).toHaveLength(0);
  });

  test("a `package.json` script name is not a platform script path", () => {
    const named = BROKEN.replace(
      "          bun run source/cat-harness/scripts/staging-record.ts retire --out x.json",
      "          bun run cat gates",
    );
    expect(auditWorkflow("staging.yml", named).findings).toHaveLength(0);
  });
});

describe("however the path is spelled", () => {
  // The three spellings that defeated a pairing rule and are the whole reason
  // the check is conservative instead.
  test.each([
    ["plain", "bun run source/cat-harness/scripts/x.ts"],
    ["parent-relative", "bun run ../source/cat-harness/scripts/x.ts"],
    ["shell variable", 'bun run "$PLATFORM_DIR/cat-harness/scripts/x.ts"'],
  ])("%s is still seen as a platform script", (_name, cmd) => {
    const y = BROKEN.replace(
      "          bun run source/cat-harness/scripts/staging-record.ts retire --out x.json",
      `          ${cmd}`,
    );
    expect(auditWorkflow("staging.yml", y).findings).toHaveLength(1);
  });
});

describe("the readers", () => {
  test("jobs are split by their two-space header, and carry a line number", () => {
    const jobs = jobsOf(BROKEN);
    expect(jobs.map((j) => j.name)).toEqual(["cleanup"]);
    // `jobs:` is line 3, so the job header is line 4.
    expect(jobs[0]?.start).toBe(4);
  });

  test("a non-indented key ends the jobs block, so trailing YAML is not a job", () => {
    expect(jobsOf(`${BROKEN}\nconcurrency:\n  group: x\n`).map((j) => j.name)).toEqual(["cleanup"]);
  });

  test("a checkout's `with:` keys stop at the next step", () => {
    const two = `jobs:
  j:
    steps:
      - uses: actions/checkout@v7
        with:
          path: source
      - uses: actions/checkout@v7
        with:
          path: other
      - run: bun other/cat-harness/scripts/mount-from-lock.ts --root other
`;
    const c = checkoutsOf(jobsOf(two)[0]!);
    expect(c).toHaveLength(2);
    // The crux: the FIRST must not inherit the second's replay.
    expect(c[0]?.submodules).toBe(false);
    expect(c[1]?.submodules).toBe(true);
  });

  test("every platform script in a job is found, not just the first", () => {
    const many = BROKEN.replace(
      "          bun run source/cat-harness/scripts/staging-record.ts retire --out x.json",
      "          bun run source/a.ts\n          bun run source/b.ts\n          bun run source/c.ts",
    );
    expect(bunRunsOf(jobsOf(many)[0]!)).toHaveLength(3);
  });
});

describe("the blind spot is reported rather than implied", () => {
  test("a composite-action call from a submodule-less checkout is named", () => {
    const comp = `jobs:
  j:
    steps:
      - uses: actions/checkout@v7
        with:
          path: source
      - uses: ./.github/actions/do-a-thing
`;
    const { findings, composites } = auditWorkflow("w.yml", comp);
    // Not a finding — this file cannot read what the action runs...
    expect(findings).toHaveLength(0);
    // ...but not silence either.
    expect(composites).toHaveLength(1);
    expect(composites[0]?.detail).toContain(".github/actions/do-a-thing");
  });
});

describe("a checkout of the repository's own CI scripts alone", () => {
  // repin-train-verdict.yml checks out main's `.github/scripts` and nothing
  // else, so no platform source is there for a mount to be missing from.
  const sparse = (spec: string) => `jobs:
  verdict:
    steps:
      - uses: actions/checkout@v7
        with:
          ref: main
${spec}
      - run: bun .github/scripts/repin-train.ts verdict --sha "$SHA"
`;

  test("is not a finding, inline or as a block", () => {
    expect(auditWorkflow("w.yml", sparse("          sparse-checkout: .github/scripts")).findings).toHaveLength(0);
    expect(auditWorkflow("w.yml", sparse("          sparse-checkout: |\n            .github/scripts\n            .github/actions")).findings).toHaveLength(0);
  });

  test("a sparse checkout that also takes platform source still is", () => {
    expect(auditWorkflow("w.yml", sparse("          sparse-checkout: |\n            .github/scripts\n            cat-harness")).findings).toHaveLength(1);
  });
});

describe("a local composite action that mounts the lock (ci-setup, bean ay33)", () => {
  const job = (path: string | undefined) => `name: gates
on: [pull_request]
jobs:
  gates-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7${path === undefined ? "" : `\n        with:\n          path: ${path}`}
      - name: Set up from the prepared CI image
        uses: ./.github/actions/ci-setup
        with:
          registry-token: \${{ github.token }}
      - run: bun run cat-harness-tools/scripts/check-something.ts
`;
  const IMAGE = "runs:\n  using: composite\n  steps:\n    - shell: bash\n      run: |\n        bash .github/ci-image/fetch.sh x && bun run cat mount:lock:check\n";
  const REPLAY = "runs:\n  using: composite\n  steps:\n    - shell: bash\n      run: bash .github/mount-from-lock.sh --root .\n";
  const NOTHING = "runs:\n  using: composite\n  steps:\n    - shell: bash\n      run: bun install --frozen-lockfile\n";
  const reader = (text: string | undefined) => (dir: string) => (dir === ".github/actions/ci-setup" ? text : undefined);

  test("an action that runs `mount:lock:check` clears the root checkout", () => {
    expect(auditWorkflow("g.yml", job(undefined), reader(IMAGE)).findings).toHaveLength(0);
  });

  test("an action that replays the lock with `--root .` clears it", () => {
    expect(auditWorkflow("g.yml", job(undefined), reader(REPLAY)).findings).toHaveLength(0);
  });

  test("an action that neither replays nor checks the lock does not", () => {
    expect(auditWorkflow("g.yml", job(undefined), reader(NOTHING)).findings).toHaveLength(1);
  });

  test("an action that cannot be read does not — the job's own text is all there is", () => {
    expect(auditWorkflow("g.yml", job(undefined), reader(undefined)).findings).toHaveLength(1);
    expect(auditWorkflow("g.yml", job(undefined)).findings).toHaveLength(1);
  });

  test("it serves only a checkout at the workspace root: one at `source` is still a finding", () => {
    expect(auditWorkflow("g.yml", job("source"), reader(IMAGE)).findings).toHaveLength(1);
  });
});

describe("a remote action pinned to the commit the lock mounts", () => {
  const SHA = "55b19257830df716a86caf0ab22731acf9a604dc";
  const OTHER = "0000000000000000000000000000000000000001";
  const lock = {
    instances: [
      { instance: "cat-harness-tools", repository: "litlfred/cat-harness-tools", sha: SHA, upstreamRoot: "", path: "cat-harness-tools", directories: [{ id: "*", path: "cat-harness-tools", upstreamPath: "." }] },
      { instance: "part", repository: "litlfred/part", sha: SHA, upstreamRoot: "sub", path: "part", directories: [{ id: "*", path: "part", upstreamPath: "." }] },
    ],
  };
  const pinned = pinnedMountsOf(lock);
  const job = (uses: string) => `name: gates
on: [pull_request]
jobs:
  gates-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Set up from the prepared CI image
        uses: ${uses}
      - run: bun run cat-harness-tools/scripts/check-something.ts
`;
  const IMAGE = "runs:\n  using: composite\n  steps:\n    - shell: bash\n      run: bun run cat mount:lock:check\n";
  const reader = (dir: string) => (dir === "cat-harness-tools/.github/actions/ci-setup" ? IMAGE : undefined);

  test("only whole-repository mounts are read from the lock", () => {
    expect([...pinned.keys()]).toEqual(["litlfred/cat-harness-tools"]);
  });

  test("at the locked sha it is read from the mount", () => {
    expect(actionDirOf(`uses: litlfred/cat-harness-tools/.github/actions/ci-setup@${SHA} # index.lock.json`, pinned)).toBe("cat-harness-tools/.github/actions/ci-setup");
    expect(auditWorkflow("g.yml", job(`litlfred/cat-harness-tools/.github/actions/ci-setup@${SHA}`), reader, pinned).findings).toHaveLength(0);
  });

  test("at another sha, a branch, or with no lock, it clears nothing", () => {
    expect(auditWorkflow("g.yml", job(`litlfred/cat-harness-tools/.github/actions/ci-setup@${OTHER}`), reader, pinned).findings).toHaveLength(1);
    expect(auditWorkflow("g.yml", job("litlfred/cat-harness-tools/.github/actions/ci-setup@main"), reader, pinned).findings).toHaveLength(1);
    expect(auditWorkflow("g.yml", job(`litlfred/cat-harness-tools/.github/actions/ci-setup@${SHA}`), reader).findings).toHaveLength(1);
  });

  test("a repository the lock mounts only in part is not read", () => {
    expect(actionDirOf(`uses: litlfred/part/.github/actions/ci-setup@${SHA}`, pinned)).toBeUndefined();
  });

  test("a local action still resolves to its own directory", () => {
    expect(actionDirOf("uses: ./.github/actions/ci-setup", pinned)).toBe(".github/actions/ci-setup");
  });
});
