/**
 * `gate-shell` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/sdlc/gate-shell.test.ts` (bean `7zz1`): they read
 * `.github/workflows/code-quality-gates.yml`, which only the checkout holds.
 * Standing alone, cat-harness has no workflows, and
 * `check:cat-harness-standalone` collects every test in that layer. The
 * script-level tests of `gate-shell.sh` stay there.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");
/** The checkout root, three levels up from the origin directory as before. */
const REPO = join(ORIGIN_DIR, "..", "..", "..");

/**
 * The workflow's side of the contract, which nothing local could otherwise
 * check. A custom `shell:` command is resolved THROUGH PATH, not against the
 * workspace — measured on #2016, where
 *
 *     shell: cat-harness/scripts/gate-shell.sh {0}
 *
 * made every one of the 13 jobs fail with `Could not find a part of the path
 * '/opt/pipx_bin/cat-harness/scripts'` — the runner's first PATH entry with
 * the relative path appended. Invoking the script directly, as the tests
 * above do, cannot reproduce that, so only this shape check stands between
 * the repository and a repeat.
 */
/**
 * ONE exception, and it is structural rather than a carve-out. Since the
 * split, cat-harness is a REMOTE MOUNT that the job's first step lays down
 * (`.github/mount-from-lock.sh`), so `gate-shell.sh` does not exist yet when
 * that step runs: it has to use a plain `shell: bash`. That is a BUILT-IN
 * shell, not a custom command, so the PATH lookup above cannot touch it. The
 * rule is therefore restated per step: a custom shell is always the absolute
 * form, and the plain built-in is legal only on a step that runs the mount.
 */
/** `bash .github/mount-from-lock.sh`, however the path is quoted or prefixed with `./`. */
const MOUNT_STEP = /^bash\s+["']?(?:\.\/)?\.github\/mount-from-lock\.sh["']?(?:\s|$)/;

interface Step { name?: string; shell?: string; run?: string }

describe("code-quality-gates.yml wires gate-shell.sh in a form a runner can resolve", () => {
  const WORKFLOW = join(REPO, ".github", "workflows", "code-quality-gates.yml");
  const doc = parse(readFileSync(WORKFLOW, "utf-8")) as { jobs: Record<string, { defaults?: { run?: { shell?: string } }; steps?: Step[] }> };
  const jobs = Object.entries(doc.jobs);
  // Every custom shell, job-level default or step override.
  const custom = jobs.flatMap(([, j]) => [j.defaults?.run?.shell, ...(j.steps ?? []).map((st) => st.shell)])
    .filter((x): x is string => typeof x === "string" && x.trim() !== "bash")
    .map((x) => x.trim());
  // Every step that overrides to the plain built-in.
  const plain = jobs.flatMap(([job, j]) => (j.steps ?? []).filter((st) => st.shell?.trim() === "bash").map((st) => ({ job, st })));

  test("at least one job opts in, or the whole mechanism is dead code", () => {
    expect(custom.length).toBeGreaterThan(0);
  });

  test("every custom `shell:` names bash and an ABSOLUTE path, never a relative one", () => {
    for (const s of custom) {
      // `bash` first: certainly on PATH, and `PIPESTATUS` is bash-only.
      expect(s.startsWith("bash ")).toBe(true);
      // The path must not be resolved against PATH or against the cwd.
      expect(s).toContain("${{ github.workspace }}/");
      expect(s).toMatch(/\{0\}$/);
      expect(s).not.toMatch(/bash\s+cat-harness\//);
    }
  });

  test("the plain built-in `bash` appears only on the step that mounts the script's own layer", () => {
    expect(plain.filter(({ st }) => !MOUNT_STEP.test((st.run ?? "").trim())).map(({ job, st }) => `${job}: ${st.name}`)).toEqual([]);
  });

  test("the script every custom `shell:` points at exists at that repo path", () => {
    for (const s of custom) {
      const rel = s.replace(/^bash\s+\$\{\{ github\.workspace \}\}\//, "").replace(/\s+\{0\}$/, "");
      expect(existsSync(join(REPO, rel))).toBe(true);
    }
  });
});
