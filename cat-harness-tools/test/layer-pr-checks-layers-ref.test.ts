/**
 * `layer-pr-checks.yml`'s "Layers cache ref for a re-pinned lock", its step
 * script run for real against stub `git` and `bun` (owner, card 2026-11-18).
 *
 * The job failed in seconds on every WorldHealthOrganization sync PR
 * (dth-phc, dth-sc, dth-hrh): the re-pin is made in the litlfred fork, whose
 * session publishes `refs/cat/layers/<key>` THERE (dth-sc run 44201743500:
 * the ref is at litlfred/dth-sc, not at WorldHealthOrganization/dth-sc), and
 * it cannot push the downstream repository. Now a ref missing here but
 * published at that fork (or at the PR's head repository) is a warning; a
 * ref missing everywhere is still a failure on the full tier; and on the fast
 * tier (no `release` / `ready-to-merge`) the job is advisory.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const WORKFLOW = resolve(import.meta.dir, "..", ".github", "workflows", "layer-pr-checks.yml");
type Step = { name?: string; run?: string; env?: Record<string, string> };
const WF = parse(readFileSync(WORKFLOW, "utf-8"), { maxAliasCount: -1 }) as { jobs: Record<string, { steps?: Step[] }>; env: Record<string, string> };
const STEP = WF.jobs["layers-ref"]!.steps!.find((s) => s.name === "Is this lock's layers ref published?")!;

interface Opts {
  repo: string;
  /** Repositories (owner/name) at which the ref is published. */
  published: string[];
  advisory?: boolean;
  headRepo?: string;
  /** What `--check-layers` says when the ref is not at the asked remote. */
  failState?: "missing" | "error";
}

function run(o: Opts): { code: number; out: string; summary: string; asked: string[] } {
  const dir = mkdtempSync(join(tmpdir(), "layers-ref-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  mkdirSync(join(dir, "fa"));
  writeFileSync(join(dir, "fa", "index.lock.json"), "{}");
  const asked = join(dir, "asked.log");
  writeFileSync(asked, "");
  const stub = (name: string, body: string) => {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  };
  stub(
    "git",
    [
      `if [ "$1" = "-C" ]; then d="$2"; shift 2; else d=.; fi`,
      `case "$1" in`,
      `  rev-parse) exit 1;;`, // no HEAD^2: base is HEAD~1
      `  diff) exit 1;;`, // the lock changed
      `  init|fetch) exit 0;;`,
      `  checkout) mkdir -p "$d/scripts"; echo "--check-layers" > "$d/scripts/mount-from-lock.ts";;`,
      `esac`,
    ].join("\n"),
  );
  const fail = o.failState === "error" ? "layers:check: FAILED (error) — could not ask" : "layers:check: FAILED (missing) — refs/cat/layers/abc… is not at $CAT_LAYERS_URL";
  stub(
    "bun",
    [
      `if [ "$1" = "-e" ]; then echo "litlfred/cat-harness-tools 0123456789abcdef"; exit 0; fi`,
      `echo "$CAT_LAYERS_URL" >> "${asked}"`,
      `for r in ${o.published.map((p) => `"https://github.com/${p}.git"`).join(" ")}; do`,
      `  [ "$CAT_LAYERS_URL" = "$r" ] && { echo "layers:check: ok (published)"; exit 0; }`,
      `done`,
      `echo "${fail}"; exit 1`,
    ].join("\n"),
  );
  const summary = join(dir, "summary");
  writeFileSync(summary, "");
  const r = spawnSync("bash", ["-e", "-c", STEP.run!], {
    cwd: dir,
    encoding: "utf-8",
    env: {
      // input-site: env PATH #a1084daa — PATH handed to a child process, which decides which binaries it runs
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      GITHUB_STEP_SUMMARY: summary,
      GITHUB_REPOSITORY: o.repo,
      HARNESS_OWNER: WF.env.HARNESS_OWNER!,
      ADVISORY: o.advisory ? "true" : "false",
      HEAD_REPO: o.headRepo ?? o.repo,
    },
  });
  return {
    code: r.status ?? -1,
    out: r.stdout + r.stderr,
    summary: readFileSync(summary, "utf-8"),
    asked: readFileSync(asked, "utf-8").trim().split("\n").filter(Boolean),
  };
}

describe("layers-ref: a downstream copy whose re-pinner cannot push it", () => {
  test("published here: passes, and asks nowhere else", () => {
    const r = run({ repo: "litlfred/dth-sc", published: ["litlfred/dth-sc"] });
    expect(r.code).toBe(0);
    expect(r.asked).toEqual(["https://github.com/litlfred/dth-sc.git"]);
  });

  test("a WHO sync PR: missing at WHO, published at the litlfred fork, is a warning, not a failure", () => {
    const r = run({ repo: "WorldHealthOrganization/dth-sc", published: ["litlfred/dth-sc"] });
    expect(r.code).toBe(0);
    expect(r.out).toContain("::warning::this lock's layers cache ref is not at WorldHealthOrganization/dth-sc, but it is published at litlfred/dth-sc");
    expect(r.out).not.toContain("::error::");
    expect(r.summary).toContain("published at `litlfred/dth-sc`, not mirrored");
  });

  test("a fork PR: published at the PR's head repository is a warning", () => {
    const r = run({ repo: "WorldHealthOrganization/dth-hrh", headRepo: "someone/dth-hrh", published: ["someone/dth-hrh"] });
    expect(r.code).toBe(0);
    expect(r.out).toContain("published at someone/dth-hrh");
  });

  test("missing everywhere on the full tier is still a failure", () => {
    const r = run({ repo: "WorldHealthOrganization/dth-phc", published: [] });
    expect(r.code).toBe(1);
    expect(r.out).toContain("::error::this PR re-pins index.lock.json but its layers cache ref is not published");
    expect(r.asked).toEqual(["https://github.com/WorldHealthOrganization/dth-phc.git", "https://github.com/litlfred/dth-phc.git"]);
  });

  test("missing in the harness owner's own repository is a failure: there is no other source to defer to", () => {
    const r = run({ repo: "litlfred/dth-sc", published: [] });
    expect(r.code).toBe(1);
    expect(r.asked).toEqual(["https://github.com/litlfred/dth-sc.git"]);
  });

  test("an error (not `missing`) is never excused by another repository", () => {
    const r = run({ repo: "WorldHealthOrganization/dth-sc", published: ["litlfred/dth-sc"], failState: "error" });
    expect(r.code).toBe(1);
    expect(r.asked).toEqual(["https://github.com/WorldHealthOrganization/dth-sc.git"]);
  });

  test("the fast tier is advisory: missing everywhere is a warning there", () => {
    const r = run({ repo: "WorldHealthOrganization/dth-phc", published: [], advisory: true });
    expect(r.code).toBe(0);
    expect(r.out).toContain("::warning::fast tier (advisory; the full tier gates the merge)");
    expect(r.summary).toContain("advisory on the fast tier; the full tier fails on it");
  });
});
