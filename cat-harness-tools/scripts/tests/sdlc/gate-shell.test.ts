/**
 * `gate-shell.sh` is the shell every `run:` step in `code-quality-gates.yml`
 * runs under, so a bug in it is a bug in every gate at once — and the two
 * that matter most are INVISIBLE from a green run:
 *
 * 1. Taking the exit status from `tee` instead of from the step script. `tee`
 *    succeeds almost always, so the whole gate set would pass and judge
 *    nothing. A workflow cannot detect this about itself.
 * 2. Adding `-o pipefail`. GitHub's default for a `run:` step is `bash -e`,
 *    NOT `bash -eo pipefail`; adding it reddens steps that pass today, and
 *    the breakage looks like a real finding rather than like this file.
 *
 * Bean `yqc4`.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SHELL = join(import.meta.dir, "..", "..", "gate-shell.sh");

/** Run `gate-shell.sh` over a step script, as the workflow's `{0}` would. */
function runStep(body: string, opts: { summary?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "gate-shell-test-"));
  const script = join(dir, "step.sh");
  writeFileSync(script, body);
  const summary = join(dir, "summary.md");
  if (opts.summary !== false) writeFileSync(summary, "");
  const env: Record<string, string> = { ...process.env as Record<string, string>, GITHUB_JOB: "gates" };
  if (opts.summary !== false) env.GITHUB_STEP_SUMMARY = summary;
  else delete env.GITHUB_STEP_SUMMARY;
  const r = spawnSync(SHELL, [script], { encoding: "utf-8", env });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    summary: opts.summary !== false && existsSync(summary) ? readFileSync(summary, "utf-8") : "",
  };
}

describe("gate-shell.sh", () => {
  test("is executable, or the workflow cannot use it as a shell", () => {
    const r = spawnSync("test", ["-x", SHELL]);
    expect(r.status).toBe(0);
  });

  test("passes a step's non-zero exit through — NOT tee's zero", () => {
    // The invisible bug. If this returns 0 the entire gate set is vacuous.
    expect(runStep("echo working\nexit 7\n").status).toBe(7);
    expect(runStep("exit 1\n").status).toBe(1);
  });

  test("a succeeding step still exits 0", () => {
    expect(runStep("echo fine\n").status).toBe(0);
  });

  test("does NOT add pipefail — bash -e is GitHub's default, and only that", () => {
    // `false | true` is 0 under `bash -e` and 1 under `bash -eo pipefail`.
    expect(runStep("false | true\necho reached\n").status).toBe(0);
  });

  test("keeps -e: a failing command aborts the rest of the step", () => {
    const r = runStep("false\necho NOT-REACHED\n");
    expect(r.status).toBe(1);
    // The STEP's own output, not the whole of stdout: the `::error::`
    // annotation quotes the command, so it legitimately contains the text of
    // a line that never ran. Asserting over all of stdout made this test fail
    // when the annotation was added — the test was too broad, not the code
    // wrong.
    const stepOutput = r.stdout.split("\n").filter((l) => !l.startsWith("::")).join("\n");
    expect(stepOutput).not.toContain("NOT-REACHED");
  });

  test("writes nothing to the summary when the step passes", () => {
    expect(runStep("echo fine\n").summary).toBe("");
  });

  test("names the step and keeps its output when the step fails", () => {
    const r = runStep("echo distinctive-marker\necho to-stderr >&2\nexit 3\n");
    expect(r.status).toBe(3);
    expect(r.summary).toContain("exit 3");
    expect(r.summary).toContain("gates");
    // the step body identifies WHICH step, since Actions exposes no step name
    expect(r.summary).toContain("echo distinctive-marker");
    // both streams, because a gate's verdict is as often on stderr
    expect(r.summary).toContain("distinctive-marker");
    expect(r.summary).toContain("to-stderr");
  });

  test("strips comments from the step it echoes, so the command is legible", () => {
    const r = runStep("# an explanatory comment\n\nbun run check:nothing\nexit 1\n");
    expect(r.summary).toContain("bun run check:nothing");
    expect(r.summary).not.toContain("an explanatory comment");
  });

  test("says a silent failure was silent rather than printing an empty block", () => {
    const r = runStep("false\n");
    expect(r.summary).toContain("printed nothing before failing");
  });

  test("bounds the output, because GitHub DROPS a step summary over 1 MiB", () => {
    // Losing the whole summary to a verbose gate is the failure mode that
    // would hit exactly when it is most needed.
    const r = runStep("for i in $(seq 1 5000); do echo \"line $i padding padding padding\"; done\nexit 1\n");
    expect(r.status).toBe(1);
    expect(r.summary.length).toBeLessThan(200_000);
    // the TAIL is what is kept: a gate prints its verdict last
    expect(r.summary).toContain("line 5000");
    expect(r.summary).not.toContain("line 1 padding");
  });

  test("still runs the step when GITHUB_STEP_SUMMARY is unset (local use)", () => {
    const r = runStep("echo local\nexit 4\n", { summary: false });
    expect(r.status).toBe(4);
    expect(r.stdout).toContain("local");
  });

  // ANNOTATIONS, which is the channel that actually reaches a reader outside
  // the log host. `$GITHUB_STEP_SUMMARY` does NOT populate a check run's
  // `output.summary` — measured on #2016 against a real red `Repository gates`:
  // title null, summary null, annotations only "Process completed with exit
  // code 1". The premise this script was first written on was false, so these
  // tests cover the mechanism that replaced it.
  test("emits exactly ONE ::error:: line, since the command takes a single line", () => {
    const lines = runStep("echo a\necho b\nexit 1\n").stdout.split("\n").filter((l) => l.startsWith("::error"));
    expect(lines.length).toBe(1);
  });

  test("escapes newlines as %0A — a literal one would end the command early", () => {
    const line = runStep("echo first\necho second\nexit 1\n").stdout.split("\n").find((l) => l.startsWith("::error"))!;
    expect(line).toContain("%0A");
    expect(line).toContain("first");
    expect(line).toContain("second");
  });

  test("escapes a literal % as %25, in the OUTPUT and in the command", () => {
    // Found by test rather than by reading: the command half was unescaped at
    // first, so a gate printing `50%` corrupted its own annotation.
    const line = runStep('echo "stale: 50% of files"\nexit 1\n').stdout.split("\n").find((l) => l.startsWith("::error"))!;
    expect(line).toContain("50%25 of files");
    expect(line).not.toMatch(/50% of/);
  });

  test("bounds the annotation — GitHub truncates a long one silently", () => {
    const line = runStep("for i in $(seq 1 4000); do echo \"line $i padding\"; done\nexit 1\n")
      .stdout.split("\n").find((l) => l.startsWith("::error"))!;
    expect(line.length).toBeLessThan(6000);
    expect(line).toContain("line 4000");   // the tail is what survives
  });

  test("a passing step emits no annotation at all", () => {
    expect(runStep("echo fine\n").stdout).not.toContain("::error");
  });

  test("says so in the annotation when the step printed nothing", () => {
    const line = runStep("false\n").stdout.split("\n").find((l) => l.startsWith("::error"))!;
    expect(line).toContain("printed nothing");
  });

  test("refuses a missing step script rather than passing vacuously", () => {
    const r = spawnSync(SHELL, [join(tmpdir(), "definitely-not-here.sh")], { encoding: "utf-8" });
    expect(r.status).toBe(2);
  });
});

/**
 * The CI cone hook (bean `4rbc`). The wrapper is copied beside a STUB
 * `ci-cone.ts`, so these tests pin the shell's half alone: what it does with
 * the stub's answer. `ci-cone.test.ts` pins the decision itself.
 */
describe("gate-shell.sh — the CI cone hook", () => {
  /** A wrapper beside a stub cone CLI; `decideExit` is what `decide` answers. */
  function coneStep(body: string, mode: string | undefined, decideExit: number, runExit = 5) {
    const dir = mkdtempSync(join(tmpdir(), "gate-shell-cone-"));
    const shell = join(dir, "gate-shell.sh");
    writeFileSync(shell, readFileSync(SHELL, "utf-8"));
    chmodSync(shell, 0o755);
    const calls = join(dir, "calls.txt");
    writeFileSync(
      join(dir, "ci-cone.ts"),
      `import { appendFileSync } from "node:fs";\n` +
        `const [cmd, script] = process.argv.slice(2);\n` +
        `appendFileSync(${JSON.stringify(calls)}, cmd + " " + script + "\\n");\n` +
        `if (cmd === "decide") process.exit(${decideExit});\n` +
        `console.log("recorded-run " + script);\nprocess.exit(${runExit});\n`,
    );
    const script = join(dir, "step.sh");
    writeFileSync(script, body);
    // input-site: inert #0062835b — sets the test's own variables, or hands the environment whole to a child; no value is read here
    const env: Record<string, string> = { ...(process.env as Record<string, string>), GITHUB_JOB: "gates" };
    delete env.GITHUB_STEP_SUMMARY;
    if (mode === undefined) delete env.CI_CONE_MODE;
    else env.CI_CONE_MODE = mode;
    const r = spawnSync(shell, [script], { encoding: "utf-8", env });
    const called = existsSync(calls) ? readFileSync(calls, "utf-8") : "";
    return { status: r.status, stdout: r.stdout ?? "", called };
  }

  test("off (no CI_CONE_MODE): the cone CLI is never asked, and the step runs as written", () => {
    const r = coneStep("bun run some:check\n", undefined, 0);
    expect(r.called).toBe("");
  });

  test("skip mode, and the cone says skip: the step does NOT run and exits 0", () => {
    const r = coneStep("# a comment\nbun run some:check\n", "skip", 0);
    expect(r.called).toBe("decide some:check\n");
    expect(r.status).toBe(0);
  });

  test("skip mode, and the cone says run (or fails): the step RUNS, and its own exit status is the verdict", () => {
    const r = coneStep("bun run some:check\n", "skip", 1);
    expect(r.called).toBe("decide some:check\n");
    // `bun run some:check` does not exist in this repo's package.json, so bun exits non-zero: the step ran.
    expect(r.status).not.toBe(0);
    const crashed = coneStep("exit 7\n", "skip", 0);
    expect(crashed.called).toBe(""); // not a `bun run` step: never asked
    expect(crashed.status).toBe(7);
  });

  test("`bun run cat <script>` (bean ar1s P4) is the same step, by the script's name", () => {
    expect(coneStep("bun run cat some:check\n", "skip", 0).called).toBe("decide some:check\n");
  });

  test("only a step that is EXACTLY one `bun run <script>` is touched", () => {
    for (const body of ["bun run a:check\nbun run b:check\n", "bun run a:check -- --flag\n", "bun --version\n", "set -e\nbun run a:check\n"]) {
      expect(coneStep(body, "skip", 0).called).toBe("");
    }
  });

  test("record mode: a recorder killed by a signal (>= 128) runs the step again, untraced", () => {
    const dir = coneStep("bun run some:check\n", "record", 0);
    expect(dir.called).toBe("run some:check\n");
    expect(dir.stdout).not.toContain("running the step untraced"); // exit 5: the check's own verdict
    const killed = coneStep("bun run some:check\n", "record", 0, 134);
    expect(killed.stdout).toContain("running the step untraced");
    expect(killed.status).not.toBe(134); // the untraced run's own status: bun's, for a script that does not exist
  });

  test("record mode runs the step through `ci-cone.ts run`, passing ITS exit status through", () => {
    const r = coneStep("bun run some:check\n", "record", 0);
    expect(r.called).toBe("run some:check\n");
    expect(r.stdout).toContain("recorded-run some:check");
    expect(r.status).toBe(5);
  });
});
