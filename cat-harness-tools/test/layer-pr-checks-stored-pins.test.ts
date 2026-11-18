/**
 * Main's STORED answer is used only when it was mounted at the PR's pins.
 *
 * A layer's PR on 2026-11-17 (run 44082781993) changed two workflow files and
 * was charged with two new failures. Its PR side pinned the lower layers to
 * main's newest CI cone record (06:19Z, cat-harness-tools 1b18760f); its
 * main side was the answer the 11:29Z push stored for its base
 * (cat-harness-tools 87cf0f35), whose record was saved after the PR pinned.
 * `check:foreign-paths` and `navbar:assets:check` were red at the one and
 * green at the other. `stored-pins.py` compares the lower layers and index the
 * stored answer kept in `from.json` with the run's, and the workflow computes
 * main's side when they differ. These drive the script through python3, as
 * the workflow does, and read the wiring out of the workflow.
 *
 * @module test/layer-pr-checks-stored-pins.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const SCRIPT = resolve(import.meta.dir, "..", ".github", "scripts", "layer-pr-checks", "stored-pins.py");
const WORKFLOW = resolve(import.meta.dir, "..", ".github", "workflows", "layer-pr-checks.yml");

const AT_RECORD = "bootstrap-tools=174a567db34db10b007a45b13f960f218a6b04f5 cat-harness=99f173e2c2fe4aeaab6f0560339a0e9688b27fb1 cat-harness-tools=1b18760f71c69bd391bf0d6c28c79c36603b6939";
const AT_ANSWER = "bootstrap-tools=174a567db34db10b007a45b13f960f218a6b04f5 cat-harness=99f173e2c2fe4aeaab6f0560339a0e9688b27fb1 cat-harness-tools=87cf0f35f53bcfca0be3f05699d4aac6e75e9346";
const INDEX = "5b7aaa32f48924d5b60597348bc611f681841864";

function run(from: unknown, lower: string, index: string): { same: string; why: string } {
  const d = mkdtempSync(join(tmpdir(), "stored-pins-"));
  const f = join(d, "from.json");
  if (from !== undefined) writeFileSync(f, typeof from === "string" ? from : JSON.stringify(from));
  const r = spawnSync("python3", ["-I", "-B", SCRIPT, f, lower, index], {
    // input-site: env PATH #613d8dbe — PATH handed to a child process, which decides which binaries it runs
    encoding: "utf-8", env: { PATH: process.env.PATH ?? "" },
  });
  if (r.status !== 0) throw new Error(r.stderr);
  const kv = Object.fromEntries(r.stdout.trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
  return { same: kv.same!, why: kv.why! };
}

describe("stored-pins.py", () => {
  test("the same lower layers and index: the stored answer is used", () => {
    // Order and spacing of the words do not matter.
    const r = run({ main: "08a4c3ea", index: INDEX, lower: AT_ANSWER }, ` ${AT_ANSWER.split(" ").reverse().join("  ")} `, INDEX);
    expect(r.same).toBe("true");
  });

  test("a layer PR of 2026-11-17: another cat-harness-tools is not used, and the why names both", () => {
    const r = run({ main: "08a4c3ea", index: INDEX, lower: AT_ANSWER }, AT_RECORD, INDEX);
    expect(r.same).toBe("false");
    expect(r.why).toContain("cat-harness-tools@87cf0f35f53b");
    expect(r.why).toContain("cat-harness-tools@1b18760f71c6");
  });

  test("another index is not used", () => {
    expect(run({ index: "aaaa", lower: AT_ANSWER }, AT_ANSWER, INDEX).same).toBe("false");
  });

  test("index mode: no index on either side", () => {
    expect(run({ index: "", lower: AT_ANSWER }, AT_ANSWER, "").same).toBe("true");
  });

  test("an answer that does not say which lower layers it mounted is not used", () => {
    expect(run({ main: "08a4c3ea", index: INDEX, pinned_at: "2026-11-17T11:29:13Z" }, AT_ANSWER, INDEX).same).toBe("false");
  });

  test("no from.json, or an unreadable one, is not used", () => {
    expect(run(undefined, AT_ANSWER, INDEX).same).toBe("false");
    expect(run("{not json", AT_ANSWER, INDEX).same).toBe("false");
  });
});

type Step = { id?: string; name?: string; if?: string; run?: string; env?: Record<string, string> };
type Job = { outputs?: Record<string, string>; steps?: Step[] };
const WF = parse(readFileSync(WORKFLOW, "utf-8"), { maxAliasCount: -1 }) as { jobs: Record<string, Job> };

describe("layer-pr-checks.yml wiring", () => {
  const base = WF.jobs["prepare-base"]!;
  const step = (id: string) => base.steps!.find((s) => s.id === id)!;

  test("main's side keeps its lower layers beside its answer", () => {
    expect(step("base-key").run).toContain('echo "lower=');
    expect(base.outputs!.lower).toBe("${{ steps.base-key.outputs.lower }}");
    const join = WF.jobs.compare!.steps!.find((s) => s.id === "join")!;
    expect(join.env!.LOWER).toBe("${{ needs.prepare-base.outputs.lower }}");
    expect(join.run).toContain('"lower": os.environ.get("LOWER", "")');
  });

  test("a stored answer is compared with this run's pins before it is handed on", () => {
    const ids = base.steps!.map((s) => s.id);
    expect(ids.indexOf("stored-pins")).toBeGreaterThan(ids.indexOf("stored-lookup"));
    expect(ids.indexOf("stored-pins")).toBeLessThan(ids.indexOf("base-answer"));
    expect(step("stored-pins").run).toContain("stored-pins.py");
    expect(step("base-answer").if).toContain("steps.stored-pins.outputs.same == 'true'");
    expect(step("base-hit").env!.SAME_PINS).toBe("${{ steps.stored-pins.outputs.same }}");
  });

  test("base-hit: a stored answer at other pins is a miss, said once", () => {
    const script = step("base-hit").run!;
    const go = (env: Record<string, string>) => {
      const d = mkdtempSync(join(tmpdir(), "base-hit-"));
      const out = join(d, "out"), sum = join(d, "sum");
      writeFileSync(out, ""); writeFileSync(sum, "");
      const r = spawnSync("bash", ["-c", script], {
        encoding: "utf-8",
        // input-site: env PATH #ad33ffbf — PATH handed to a child process, which decides which binaries it runs
        env: { PATH: process.env.PATH ?? "", GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: sum, DIR: d, KEY: "k", EXACT: "false", PUSH: "false", HANDED: "false", ...env },
      });
      if (r.status !== 0) throw new Error(r.stderr);
      return { out: readFileSync(out, "utf-8"), log: r.stdout };
    };
    const other = go({ STORED: "stored-key", SAME_PINS: "false", PINS_WHY: "main's stored answer mounted the lower layers X; this run mounts Y" });
    expect(other.out).toContain("hit=false");
    expect(other.out).toContain("key=\n");
    expect(other.log).toContain("is not used: main's stored answer mounted the lower layers X");
    expect(other.log).not.toContain("no answer for this PR's base commit is kept");
  });
});
