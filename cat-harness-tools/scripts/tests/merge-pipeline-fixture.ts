/**
 * A throwaway git repository for the merge-pipeline tests: local only, no
 * remote, no network (bean `blgm`).
 *
 * @module scripts/tests/merge-pipeline-fixture
 * @graphNode none — a test helper
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface Repo {
  dir: string;
  git: (...args: string[]) => string;
  /** Write files (path → content; `null` deletes) and commit them. Returns the commit. */
  commit: (files: Record<string, string | null>, message?: string) => string;
  cleanup: () => void;
}

export function makeRepo(): Repo {
  const dir = mkdtempSync(join(tmpdir(), "merge-pipeline-"));
  const git = (...args: string[]): string =>
    execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@invalid" },
    }).trim();
  git("init", "-q", "-b", "main");
  const commit = (files: Record<string, string | null>, message = "c"): string => {
    for (const [p, content] of Object.entries(files)) {
      const full = join(dir, p);
      if (content === null) git("rm", "-q", "--", p);
      else {
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
        git("add", "--", p);
      }
    }
    git("commit", "-q", "--allow-empty", "-m", message);
    return git("rev-parse", "HEAD");
  };
  return { dir, git, commit, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** A README with one generated region around `inner`, and authored `prose` outside it. */
export function readme(prose: string, inner: string): string {
  return `# Title\n\n${prose}\n\n<!-- kg:subgraph:begin -->\n${inner}\n<!-- kg:subgraph:end -->\n`;
}
