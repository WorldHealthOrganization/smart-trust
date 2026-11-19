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

function run(from: unknown, lower: string, index: string, state?: string): { same: string; why: string } {
  const d = mkdtempSync(join(tmpdir(), "stored-pins-"));
  const f = join(d, "from.json");
  if (from !== undefined) writeFileSync(f, typeof from === "string" ? from : JSON.stringify(from));
  const r = spawnSync("python3", ["-I", "-B", SCRIPT, f, lower, index, ...(state === undefined ? [] : [state])], {
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

/**
 * WHO dth-pc#3 (run 44489690657): a beans branch was copied in after main's
 * answer was stored, so the PR side mounted a workflow instance main's side
 * never read, and `check:prov-qaqc` charged the PR with its PROV outputs. The
 * branch-kept graphs are now part of what a stored answer must share.
 */
describe("stored-pins.py: the branch-kept graphs", () => {
  const STATE = "a".repeat(64);
  const stored = (state?: string) => ({ index: INDEX, lower: AT_ANSWER, ...(state === undefined ? {} : { state }) });

  test("the same graphs: used", () => {
    expect(run(stored(STATE), AT_ANSWER, INDEX, STATE).same).toBe("true");
  });

  test("other graphs: not used, and the why says so", () => {
    const r = run(stored("b".repeat(64)), AT_ANSWER, INDEX, STATE);
    expect(r.same).toBe("false");
    expect(r.why).toContain("branch-kept graphs bbbbbbbbbbbb");
    expect(r.why).toContain("this run mounts aaaaaaaaaaaa");
  });

  test("an answer stored before the graphs were kept is not used when this run names them", () => {
    const r = run(stored(), AT_ANSWER, INDEX, STATE);
    expect(r.same).toBe("false");
    expect(r.why).toContain("does not record which branch-kept graphs");
  });

  test("a caller that passes no digest compares as before", () => {
    expect(run(stored(), AT_ANSWER, INDEX).same).toBe("true");
  });
});

const DIGEST = resolve(import.meta.dir, "..", ".github", "scripts", "layer-pr-checks", "state-digest.py");

function digest(pins: unknown, live?: unknown): string {
  const d = mkdtempSync(join(tmpdir(), "state-digest-"));
  const p = join(d, "state.json"), l = join(d, "state-live.json");
  if (pins !== undefined) writeFileSync(p, JSON.stringify(pins));
  if (live !== undefined) writeFileSync(l, JSON.stringify(live));
  const r = spawnSync("python3", ["-I", "-B", DIGEST, p, ...(live === undefined ? [] : [l])], {
    // input-site: env PATH #613d8dbe — PATH handed to a child process, which decides which binaries it runs
    encoding: "utf-8", env: { PATH: process.env.PATH ?? "" },
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

describe("state-digest.py", () => {
  const REPO = "WorldHealthOrganization/dth-pc";
  const RECORD = { [REPO]: { "cat/dth-pc/todos": "1".repeat(40) } };

  test("a branch the pin does not name (copied in after main's record) changes the digest", () => {
    const before = digest(RECORD, RECORD);
    const after = digest(RECORD, { [REPO]: { ...RECORD[REPO], "cat/dth-pc/beans": "2".repeat(40) } });
    expect(after).not.toBe(before);
    expect(after).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a beans branch that moved past the pin changes it; another graph that moved does not", () => {
    const pinned = { [REPO]: { "cat/dth-pc/beans": "2".repeat(40), "cat/dth-pc/todos": "1".repeat(40) } };
    const same = digest(pinned, pinned);
    expect(digest(pinned, { [REPO]: { ...pinned[REPO], "cat/dth-pc/beans": "3".repeat(40) } })).not.toBe(same);
    // state-pin.sh keeps the pinned tip of a non-beans graph, so the digest does too.
    expect(digest(pinned, { [REPO]: { ...pinned[REPO], "cat/dth-pc/todos": "4".repeat(40) } })).toBe(same);
  });

  test("key order does not matter, and nothing pinned is `none`", () => {
    const a = { r: { x: "1", y: "2" } }, b = { r: { y: "2", x: "1" } };
    expect(digest(a)).toBe(digest(b));
    expect(digest(undefined)).toBe("none");
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

  test("main's side keys and keeps the branch-kept graphs it mounts, and a stored answer is compared on them", () => {
    const key = step("base-key").run!;
    expect(key).toContain("state-digest.py");
    expect(key).toContain('"$RUNNER_TEMP/pin/state-live.json"');
    expect(key).toContain('echo "state=$state_digest"');
    expect(base.outputs!.state).toBe("${{ steps.base-key.outputs.state }}");
    expect(step("stored-pins").env!.STATE).toBe("${{ steps.base-key.outputs.state }}");
    expect(step("stored-pins").run).toContain('"$INDEX" "$STATE"');
    const join = WF.jobs.compare!.steps!.find((s) => s.id === "join")!;
    expect(join.env!.STATE).toBe("${{ needs.prepare-base.outputs.state }}");
    expect(join.run).toContain('"state": os.environ.get("STATE", "")');
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
