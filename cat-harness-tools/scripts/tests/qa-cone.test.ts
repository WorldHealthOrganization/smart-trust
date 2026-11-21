/**
 * The QA working copy's dependency cone (owner card Q-CONE-2 B, 2026-11-01):
 * main records each `qa:refresh` step's reads, a preview reruns only the
 * steps whose reads changed and puts back main's outputs for the rest.
 * @covers scripts/qa-cone.ts
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { coneMode, globMatcher, QaCone, qaKey, QA_RECORD_FILE, type ConeStep, type StepRun } from "../qa-cone.ts";
import { loadWriterRecords } from "../writer-cone.ts";

const HAS_STRACE = Bun.which("strace") !== null && Bun.spawnSync(["strace", "-f", "-qq", "-o", "/dev/null", "true"], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;

describe("globMatcher", () => {
  test("`*` is one segment, `**` any depth", () => {
    const m = globMatcher(["cat-harness/test/results/detangle/**", "cat-harness/test/results/*.qa-results.json"]);
    expect(m("cat-harness/test/results/detangle/a/b.json")).toBe(true);
    expect(m("cat-harness/test/results/x.qa-results.json")).toBe(true);
    expect(m("cat-harness/test/results/sub/x.qa-results.json")).toBe(false);
    expect(m("cat-harness/test/results/detangle")).toBe(false);
  });
});

describe("coneMode", () => {
  test("records only where strace runs; skips only when asked; otherwise off", () => {
    expect(coneMode({ CAT_WRITER_RECORD: "1" }, () => true)).toBe("record");
    expect(coneMode({ CAT_WRITER_RECORD: "1", CAT_WRITER_SKIP: "1" }, () => false)).toBe("off");
    expect(coneMode({ CAT_WRITER_SKIP: "1" }, () => true)).toBe("skip");
    expect(coneMode({}, () => true)).toBe("off");
  });

  test("off runs every step, unprefixed", () => {
    const cone = new QaCone("/nowhere", {}, [], "off", "sha");
    const seen: (readonly string[])[] = [];
    const r = cone.step({ id: "a", run: ["a"], writes: [] }, (prefix) => {
      seen.push(prefix);
      return { id: "a", exit: 0, seconds: 0 };
    });
    expect(r.exit).toBe(0);
    expect(seen).toEqual([[]]);
  });
});

describe.skipIf(!HAS_STRACE)("record on main, skip in a preview, under a real strace", () => {
  let root: string;
  const step: ConeStep = { id: "a", run: ["a"], writes: ["res/out/**"] };
  const scripts = { a: "bun scripts/a.ts" };
  const runner = (prefix: readonly string[], env?: Record<string, string | undefined>): StepRun => {
    const r = Bun.spawnSync([...prefix, "bun", "scripts/a.ts"], { cwd: root, env: env ?? process.env, stdout: "ignore", stderr: "ignore" });
    return { id: "a", exit: r.exitCode, seconds: 0 };
  };
  const write = (rel: string, text: string) => writeFileSync(join(root, rel), text);
  const record = () => {
    const cone = new QaCone(root, scripts, [step], "record", "mainsha");
    expect(cone.step(step, runner).exit).toBe(0);
    cone.finish();
  };
  const preview = () => {
    let ran = 0;
    const cone = new QaCone(root, scripts, [step], "skip", "prsha");
    cone.step(step, (p, e) => {
      ran++;
      return runner(p, e);
    });
    return { ran, log: cone.log };
  };

  // `build/` exists before the first run, as in CI: the records are written there, and bun lists the root.
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "qa-cone-"));
    for (const d of ["scripts", "in", "elsewhere", "res", "build"]) mkdirSync(join(root, d));
    write("package.json", JSON.stringify({ name: "fixture", scripts }));
    write("scripts/a.ts", 'import { mkdirSync, readFileSync, writeFileSync } from "node:fs";\nmkdirSync("res/out", { recursive: true });\nwriteFileSync("res/out/a.json", readFileSync("in/x.txt", "utf-8").toUpperCase());\n');
    write("in/x.txt", "one");
    write("elsewhere/y.txt", "y");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("a recorded step is skipped in a fresh tree and its outputs are put back", () => {
    record();
    const recs = loadWriterRecords(root, join(root, QA_RECORD_FILE));
    expect(recs?.writers[qaKey("a")]?.reads["in/x.txt"]).toStartWith("file ");
    expect(Object.keys(recs?.writers[qaKey("a")]?.outputs ?? {})).toContain("res/out/a.json");
    rmSync(join(root, "res/out"), { recursive: true });
    const p = preview();
    expect(p.ran).toBe(0);
    expect(p.log[0]?.did).toBe("skipped");
    expect(readFileSync(join(root, "res/out/a.json"), "utf-8")).toBe("ONE");
  });

  test("a change it never read keeps the skip; a change to what it read, or to its script, reruns it", () => {
    record();
    rmSync(join(root, "res/out"), { recursive: true });
    write("elsewhere/y.txt", "changed");
    expect(preview().ran).toBe(0);
    rmSync(join(root, "res/out"), { recursive: true });
    write("in/x.txt", "two");
    const p = preview();
    expect(p.ran).toBe(1);
    expect(p.log[0]?.why).toContain("in/x.txt changed");
    expect(readFileSync(join(root, "res/out/a.json"), "utf-8")).toBe("TWO");
    write("in/x.txt", "one");
    write("scripts/a.ts", readFileSync(join(root, "scripts/a.ts"), "utf-8") + "// edited\n");
    expect(preview().ran).toBe(1);
  });

  test("no records from main: every step runs", () => {
    expect(existsSync(join(root, QA_RECORD_FILE))).toBe(false);
    const p = preview();
    expect(p.ran).toBe(1);
    expect(p.log[0]?.why).toBe("no writer records from a full deploy");
  });
});
