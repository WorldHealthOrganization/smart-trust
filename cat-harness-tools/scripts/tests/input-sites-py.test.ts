/**
 * `input-sites-py.ts`: the Python twin of the input-site audit, for the
 * sources a test's `python3` child ran (`ci-cone.ts` `childInputsOf`).
 */
import { describe, expect, test } from "bun:test";
import { auditPython, blankPython, scanPython } from "../input-sites-py.ts";
import { statementPin } from "../input-sites.ts";

/** A file whose line `at` (0-based) is annotated with `verdict` and pinned the way a reviewer would. */
const annotated = (lines: string[], at: number, verdict: string) => {
  const pin = statementPin(lines, at);
  return [...lines.slice(0, at), `# input-site: ${verdict} #${pin} — reviewed`, ...lines.slice(at)].join("\n");
};

describe("blankPython blanks strings and comments, never code", () => {
  test("a docstring, a quoted name and a comment hide their text", () => {
    const b = blankPython('"""os.environ in a docstring"""\nx = "subprocess"  # time.time()\ny = os.environ["A"]\n');
    expect(b[0]).not.toContain("environ");
    expect(b[1]).not.toContain("subprocess");
    expect(b[1]).not.toContain("time");
    expect(b[2]).toContain("os.environ[");
  });
});

describe("scanPython finds what a trace does not record", () => {
  test.each([
    ["env", 'v = os.environ.get("X")'],
    ["env", 'v = os.getenv("X")'],
    ["spawn", 'subprocess.run(["git", "log"])'],
    ["network", "import urllib.request"],
    ["clock", "t = time.time()"],
    ["clock", "d = datetime.now()"],
    ["random", "n = random.random()"],
    ["host", 'p = os.path.expanduser("~")'],
    ["computed", 'exec(src)'],
  ])("%s: %s", (risk, line) => {
    const s = scanPython("a.py", `${line}\n`);
    expect(s).toHaveLength(1);
    expect(s[0]!.risks).toContain(risk);
    expect(s[0]!.verdicts).toBeUndefined();
  });

  test("a module loaded by name is no site: its file is in the read set", () => {
    expect(scanPython("a.py", 'import importlib.util\nm = __import__("x")\nspec.loader.exec_module(m)\n')).toEqual([]);
  });

  test("importing subprocess, or naming its exceptions, runs nothing; a renaming import is a site", () => {
    expect(scanPython("a.py", "import subprocess\ntry:\n    pass\nexcept subprocess.SubprocessError:\n    pass\n")).toEqual([]);
    expect(scanPython("a.py", "from subprocess import run as r\n")[0]!.risks).toEqual(["spawn"]);
  });

  test("plain code, and a risk word in a string or comment, is no site", () => {
    expect(scanPython("a.py", 'import json\nprint(json.dumps({"os.environ": 1}))  # subprocess\n')).toEqual([]);
  });

  test("an annotation pinned to its statement answers it; an edit makes it stale", () => {
    const text = annotated(["import os", 'v = os.environ.get("X")'], 1, "env X");
    expect(scanPython("a.py", text)[0]!.verdicts).toEqual([{ kind: "env", names: ["X"] }]);
    expect(scanPython("a.py", text.replace('"X")', '"Y")'))[0]!.verdicts).toBe("stale");
  });

  test("a verdict the cone cannot answer for Python is malformed", () => {
    const text = annotated(["subprocess.run(cmd)"], 0, "runs scripts/*.ts");
    expect(scanPython("a.py", text)[0]!.malformed).toContain("a Python site takes only");
  });
});

describe("auditPython", () => {
  test("collects the variables, and refuses the first site nobody reviewed", () => {
    const ok = annotated(['v = os.environ.get("X")'], 0, "env X");
    expect(auditPython([{ file: "a.py", text: ok }])).toEqual({ env: ["X"], envUnset: [] });
    const r = auditPython([{ file: "a.py", text: ok }, { file: "b.py", text: "t = time.time()\n" }]);
    expect("undetermined" in r && r.undetermined).toContain("b.py:1");
  });
});
