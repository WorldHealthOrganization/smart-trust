import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { diffPaths, mrFilesArgv, unquote } from "../gitlab-mr-files.ts";

const SCRIPT = join(import.meta.dir, "..", "gitlab-mr-files.ts");

const DIFF = [
  "diff --git a/src/a.ts b/src/a.ts",
  "index 1..2 100644",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -1,2 +1,2 @@",
  "--- a removed SQL comment line, not a header",
  "+++ an added line, not a header",
  " context",
  "diff --git a/gone.md b/gone.md",
  "deleted file mode 100644",
  "--- a/gone.md",
  "+++ /dev/null",
  "@@ -1 +0,0 @@",
  "-bye",
  "diff --git a/old name.txt b/new name.txt",
  "similarity index 100%",
  "rename from old name.txt",
  "rename to new name.txt",
  "diff --git a/img.png b/img.png",
  "Binary files a/img.png and b/img.png differ",
  'diff --git "a/tab\\there" "b/tab\\there"',
  'diff --git a/caf\\303\\251 b/caf\\303\\251',
  'new file mode 100644',
  '--- /dev/null',
  '+++ "b/caf\\303\\251"',
  "",
].join("\n");

describe("gitlab:mr-files lists a merge request's paths from glab's raw diff (4dbr)", () => {
  test("new side, deleted side, renames, binaries and quoted paths, each once", () => {
    expect(diffPaths(DIFF)).toEqual(["src/a.ts", "gone.md", "new name.txt", "img.png", "tab\there", "café"]);
  });

  test("hunk lines that look like headers are not paths", () => {
    const paths = diffPaths(DIFF);
    expect(paths.some((p) => p.includes("SQL") || p.includes("added line"))).toBe(false);
  });

  test("git's C-quoting is undone", () => {
    expect(unquote('"b/a\\"q\\\\"')).toBe('b/a"q\\');
    expect(unquote("plain")).toBe("plain");
  });

  test("the argv: a positive number or none; anything else is refused before glab runs", () => {
    expect(mrFilesArgv()).toEqual(["mr", "diff", "--raw", "--color", "never"]);
    expect(mrFilesArgv("42")).toEqual(["mr", "diff", "42", "--raw", "--color", "never"]);
    for (const bad of ["0", "-1", "--help", "4 2", "$(x)", "01"]) expect(() => mrFilesArgv(bad)).toThrow();
  });

  test("run as a command: glab gets that argv and the paths come out one per line", () => {
    const dir = mkdtempSync(join(tmpdir(), "fake-glab-"));
    const log = join(dir, "argv.json");
    const diff = join(dir, "diff.txt");
    writeFileSync(diff, DIFF);
    writeFileSync(join(dir, "glab"), `#!/usr/bin/env bun\nconst fs = require("node:fs");\nfs.writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)));\nprocess.stdout.write(fs.readFileSync(${JSON.stringify(diff)}, "utf-8"));\n`);
    chmodSync(join(dir, "glab"), 0o755);
    const env = { ...process.env, PATH: `${dir}:${process.env.PATH}` };
    const ok = spawnSync("bun", [SCRIPT, "7"], { env, encoding: "utf-8" });
    expect(ok.status).toBe(0);
    expect(JSON.parse(readFileSync(log, "utf-8"))).toEqual(["mr", "diff", "7", "--raw", "--color", "never"]);
    expect(ok.stdout.trim().split("\n")).toEqual(["src/a.ts", "gone.md", "new name.txt", "img.png", "tab\there", "café"]);
    const bad = spawnSync("bun", [SCRIPT, "--help"], { env, encoding: "utf-8" });
    expect(bad.status).toBe(2);
  });
});
