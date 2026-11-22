import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { requestReviewArgv } from "../gitlab-request-review.ts";

const SCRIPT = join(import.meta.dir, "..", "gitlab-request-review.ts");

describe("gitlab:request-review adds reviewers and keeps the existing ones (4dbr)", () => {
  test("each name gets glab's '+' (add) prefix; the number, when given, comes first", () => {
    expect(requestReviewArgv(["12", "jane.doe", "ci_bot"])).toEqual(["mr", "update", "12", "--reviewer", "+jane.doe", "--reviewer", "+ci_bot"]);
    expect(requestReviewArgv(["litlfred"])).toEqual(["mr", "update", "--reviewer", "+litlfred"]);
  });

  test("no name, or a name that is not a GitLab username, is refused before glab runs", () => {
    expect(() => requestReviewArgv([])).toThrow();
    expect(() => requestReviewArgv(["12"])).toThrow();
    for (const bad of ["-rf", "--reviewer", "+jane", "!jane", "a b", "$(x)", "repo.git"]) {
      expect(() => requestReviewArgv([bad])).toThrow();
    }
  });

  test("run as a command: glab gets that argv; a bad name never reaches it", () => {
    const dir = mkdtempSync(join(tmpdir(), "fake-glab-"));
    const log = join(dir, "argv.json");
    writeFileSync(join(dir, "glab"), `#!/usr/bin/env bun\nrequire("node:fs").writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)));\n`);
    chmodSync(join(dir, "glab"), 0o755);
    const env = { ...process.env, PATH: `${dir}:${process.env.PATH}` };
    const ok = spawnSync("bun", [SCRIPT, "3", "jane.doe"], { env });
    expect(ok.status).toBe(0);
    expect(JSON.parse(readFileSync(log, "utf-8"))).toEqual(["mr", "update", "3", "--reviewer", "+jane.doe"]);
    const dir2 = mkdtempSync(join(tmpdir(), "fake-glab-"));
    const log2 = join(dir2, "argv.json");
    writeFileSync(join(dir2, "glab"), `#!/usr/bin/env bun\nrequire("node:fs").writeFileSync(${JSON.stringify(log2)}, "ran");\n`);
    chmodSync(join(dir2, "glab"), 0o755);
    const bad = spawnSync("bun", [SCRIPT, "--assignee=x"], { env: { ...process.env, PATH: `${dir2}:${process.env.PATH}` } });
    expect(bad.status).toBe(2);
    expect(existsSync(log2)).toBe(false);
  });
});
