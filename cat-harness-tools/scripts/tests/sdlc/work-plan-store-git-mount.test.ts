/**
 * The git state branch Tool on its mount — what the engine calls — held to the
 * work-plan store's conformance suite (cat-harness#991 step 3).
 *
 * The CLI is turned off, so the suite checks this Tool's own bytes rather than
 * whichever `beans` binary the runner has. Two writers are two instances over
 * one mounted directory: the race between sessions is the push to the branch,
 * which `work-plan-store-git.test.ts` holds to the same suite.
 *
 * @module scripts/tests/sdlc/work-plan-store-git-mount
 */
import { afterAll } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MountedGitBranchStore } from "../../../src/workflow/work-plan-store-git-mount.ts";
import { workPlanStoreConformance } from "./work-plan-store-conformance.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

workPlanStoreConformance({
  name: "git state branch, on its mount (beans-git-branch)",
  fresh() {
    const repo = mkdtempSync(join(tmpdir(), "wps-mount-"));
    made.push(repo);
    mkdirSync(join(repo, "beans", "defs"), { recursive: true });
    mkdirSync(join(repo, "beans", "workflows"), { recursive: true });
    writeFileSync(
      join(repo, "beans", "beans.json"),
      JSON.stringify({
        name: "f",
        directories: [
          { id: "defs", path: "defs", graphTypologies: ["bean-defs"] },
          { id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] },
        ],
      }),
    );
    // A checkout that keeps `beans/` itself, so its history is the checkout's
    // `git log`; `settle` commits, as a push makes a mount's writes history.
    const git = (...args: string[]): void => {
      const r = spawnSync("git", ["-C", repo, ...args], {
        encoding: "utf-8",
        env: { ...process.env, GIT_AUTHOR_NAME: "writer", GIT_AUTHOR_EMAIL: "w@w", GIT_COMMITTER_NAME: "writer", GIT_COMMITTER_EMAIL: "w@w" },
      });
      if (r.status !== 0) throw new Error(`git ${args[0]}: ${r.stderr}`);
    };
    git("init", "-q", "-b", "main");
    return {
      settle: () => {
        git("add", "-A");
        git("commit", "-q", "--allow-empty", "-m", "settle");
      },
      a: new MountedGitBranchStore(repo, { cli: false }),
      b: new MountedGitBranchStore(repo, { cli: false }),
      seedInstance: (s) => writeFileSync(join(repo, "beans", "workflows", `${s.id}.json`), `${JSON.stringify({ $schema: "folio-workflow-instance/v1", ...s }, null, 2)}\n`),
    };
  },
});
