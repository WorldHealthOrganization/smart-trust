import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pushTriggerOf } from "../../../src/workflow/ci-health.ts";

/**
 * Exit-code contract for `check-ci-health.ts`.
 *
 * Two callers depend on it and want opposite things, which is the entire reason
 * `--out` exists as a separate flag from `--markdown`:
 *
 *   - `session-start-coord-sweep.sh` runs `--markdown` as
 *     `if ! bun run … --markdown; then <print "Not checked — treat as unknown">`.
 *     If `--markdown` ever exited non-zero on a red, the sweep would print the
 *     report AND declare it unchecked, every single time CI was red.
 *   - `ci-health.yml` needs the report body *and* a real verdict, and must
 *     never close its tracking issue on a repo it could not check.
 *
 * These run against a git repo with no `origin`, which drives the checker into
 * its `unreachable` branch without touching the network — so the tests are
 * deterministic and offline. Bean `ynu8`.
 */

const SCRIPT = resolve(import.meta.dir, "../../check-ci-health.ts");
let repo: string;

const run = (args: string[]): { code: number; stdout: string; stderr: string } => {
  const r = Bun.spawnSync(["bun", "run", SCRIPT, ...args], { cwd: repo });
  return {
    code: r.exitCode,
    stdout: new TextDecoder().decode(r.stdout),
    stderr: new TextDecoder().decode(r.stderr),
  };
};

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "ci-health-cli-"));
  // A git repo with no remote: `originSlug()` finds nothing to ask about.
  execFileSync("git", ["init", "-q"], { cwd: repo });
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("the exit-code contract", () => {
  test("a repo it cannot check exits 2 — not 0", () => {
    // Exiting 0 here would make "could not look" indistinguishable from
    // "looked and it was fine", which is the failure this module exists to
    // prevent, one level up.
    expect(run([]).code).toBe(2);
  });

  test("--markdown ALWAYS exits 0, even when it could not check", () => {
    // Load-bearing for session-start-coord-sweep.sh — see the header.
    expect(run(["--markdown"]).code).toBe(0);
  });

  test("--markdown prints the unknown report rather than nothing", () => {
    const { stdout } = run(["--markdown"]);
    expect(stdout).toContain("Not checked");
    expect(stdout).toContain("treat as unknown, not as green");
  });

  test("--warn reports without failing", () => {
    expect(run(["--warn"]).code).toBe(0);
  });
});

describe("--out: the report AND the verdict, from one API call", () => {
  test("writes the report and still exits 2 when it could not check", () => {
    const out = join(repo, "report.md");
    expect(run(["--out", out]).code).toBe(2);
    expect(readFileSync(out, "utf8")).toContain("Not checked");
  });

  test("--out=<path> is accepted too", () => {
    const out = join(repo, "report2.md");
    expect(run([`--out=${out}`]).code).toBe(2);
    expect(readFileSync(out, "utf8")).toContain("treat as unknown, not as green");
  });

  test("--out with no path is its own error, not the unreachable exit", () => {
    // Both exit 2 in this fixture, so the code alone proves nothing — the
    // message is what distinguishes a misused flag from a repo it could not
    // reach, and a flag that silently wrote nowhere would be the worse bug.
    const { code, stderr } = run(["--out"]);
    expect(code).toBe(2);
    expect(stderr).toContain("--out needs a file path");
  });
});

/**
 * A push trigger carrying a path filter cannot say whether THIS commit owed a
 * run, so it must answer "cannot tell" rather than "yes".
 *
 * Found by running the report against this repository, not by reasoning about
 * it: `jsonld-gen-check.yml` declares `on.push` under fifteen `paths:` entries,
 * and the first version of the trigger check returned `true` for it — which
 * put a false "no run has judged the current head" on a workflow that owed no
 * run. The guard the trigger check exists to provide had a hole the same shape
 * as the thing it guards.
 */
describe("triggersOnPush distinguishes an unfiltered push from a filtered one", () => {
  const cases: Array<[string, string, boolean | undefined]> = [
    ["a bare string", "on: push\njobs: {}\n", true],
    ["a list", "on: [push, pull_request]\njobs: {}\n", true],
    ["a mapping with an empty push", "on:\n  push:\njobs: {}\n", true],
    ["a mapping with branches only", "on:\n  push:\n    branches: [main]\njobs: {}\n", undefined],
    ["a mapping with paths", "on:\n  push:\n    paths:\n      - 'a/**'\njobs: {}\n", undefined],
    ["dispatch only", "on:\n  workflow_dispatch:\njobs: {}\n", false],
    ["pull_request only", "on:\n  pull_request:\njobs: {}\n", false],
  ];
  test.each(cases)("%s", (_label, yaml, expected) => {
    expect(pushTriggerOf(yaml)).toBe(expected as never);
  });
});

/**
 * Bean `g62s`, second pass. The conservative version answered `undefined` for
 * any filtered push trigger, which made `headUnjudged` inert: 0 of this repo's
 * 36 workflows were flaggable. Evaluating the filters is what makes it fire.
 *
 * The patterns below are the REAL ones, copied from the four workflows that
 * declare a filtered push on `main`. A matcher that passes invented globs and
 * fails these would be worse than the silence it replaced.
 */
describe("a filtered push trigger is decided, not waved away", () => {
  const branchOnly = "on:\n  push:\n    branches: [main]\njobs: {}\n";

  test("branches-only is decidable with no path data at all", () => {
    // `code-quality-gates.yml` is this shape, and it is the repo's main gate.
    expect(pushTriggerOf(branchOnly, { branch: "main" })).toBe(true);
    expect(pushTriggerOf(branchOnly, { branch: "release" })).toBe(false);
  });

  test("branches-only without a branch still claims nothing", () => {
    expect(pushTriggerOf(branchOnly)).toBeUndefined();
  });

  const docsSite =
    "on:\n  push:\n    branches: [main]\n    paths:\n" +
    "      - 'docs/**'\n      - 'schemas/**'\n      - '.github/workflows/docs-site.yml'\njobs: {}\n";

  test("docs-site: a docs change runs it, a src change does not", () => {
    const ctx = (files: string[]) => ({ branch: "main", changedFiles: files });
    expect(pushTriggerOf(docsSite, ctx(["docs/index.md"]))).toBe(true);
    expect(pushTriggerOf(docsSite, ctx(["docs/a/b/c.md"]))).toBe(true);
    expect(pushTriggerOf(docsSite, ctx([".github/workflows/docs-site.yml"]))).toBe(true);
    expect(pushTriggerOf(docsSite, ctx(["src/index.ts"]))).toBe(false);
    expect(pushTriggerOf(docsSite, ctx(["src/a.ts", "docs/b.md"]))).toBe(true);
  });

  test("the wrong branch short-circuits before paths are consulted", () => {
    expect(pushTriggerOf(docsSite, { branch: "other", changedFiles: ["docs/x.md"] })).toBe(false);
  });

  const jsonld =
    "on:\n  push:\n    paths:\n      - 'folio/**/*.ts'\n" +
    "      - 'schemas/kg/jsonld.ts'\n      - 'library/**/structure.json'\njobs: {}\n";

  test("`a/**/b` matches zero directories as well as many", () => {
    // The case a naive `.*` gets wrong: GitHub runs this for `folio/a.ts`.
    const ctx = (files: string[]) => ({ changedFiles: files });
    expect(pushTriggerOf(jsonld, ctx(["folio/a.ts"]))).toBe(true);
    expect(pushTriggerOf(jsonld, ctx(["folio/deep/er/a.ts"]))).toBe(true);
    expect(pushTriggerOf(jsonld, ctx(["library/x/structure.json"]))).toBe(true);
    expect(pushTriggerOf(jsonld, ctx(["library/structure.json"]))).toBe(true);
  });

  test("`*` does not cross a slash", () => {
    const one = "on:\n  push:\n    paths: ['folio/*.ts']\njobs: {}\n";
    expect(pushTriggerOf(one, { changedFiles: ["folio/a.ts"] })).toBe(true);
    expect(pushTriggerOf(one, { changedFiles: ["folio/deep/a.ts"] })).toBe(false);
  });

  test("an exact path is exact", () => {
    expect(pushTriggerOf(jsonld, { changedFiles: ["schemas/kg/jsonld.ts"] })).toBe(true);
    expect(pushTriggerOf(jsonld, { changedFiles: ["schemas/kg/jsonld.ts.bak"] })).toBe(false);
  });

  test("paths without the file list claims nothing", () => {
    expect(pushTriggerOf(jsonld, { branch: "main" })).toBeUndefined();
  });

  test("paths-ignore runs unless EVERY changed file is ignored", () => {
    const ig = "on:\n  push:\n    paths-ignore: ['docs/**']\njobs: {}\n";
    expect(pushTriggerOf(ig, { changedFiles: ["docs/a.md"] })).toBe(false);
    expect(pushTriggerOf(ig, { changedFiles: ["docs/a.md", "src/b.ts"] })).toBe(true);
    expect(pushTriggerOf(ig, { changedFiles: ["src/b.ts"] })).toBe(true);
  });

  test("syntax this cannot evaluate claims nothing rather than guessing", () => {
    for (const pat of ["!docs/**", "docs/?.md", "docs/[ab].md", "docs/+.md"]) {
      const y = `on:\n  push:\n    paths: ['${pat}']\njobs: {}\n`;
      expect(pushTriggerOf(y, { changedFiles: ["docs/a.md"] })).toBeUndefined();
    }
  });

  test("a tag filter is not a branch push", () => {
    const t = "on:\n  push:\n    tags: ['v*']\njobs: {}\n";
    expect(pushTriggerOf(t, { branch: "main", changedFiles: ["a.ts"] })).toBeUndefined();
  });
});
