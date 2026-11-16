import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { RESOLVE_MUTATION, resolveThreadArgv } from "../../github-resolve-thread.ts";

const SCRIPT = join(import.meta.dir, "..", "..", "github-resolve-thread.ts");

describe("github:resolve-thread calls gh with an argument array (4dbr)", () => {
  test("the id goes in as a raw string field, the query unexpanded", () => {
    expect(resolveThreadArgv("PRRT_kwDOAbCdEf4A1b2C3d")).toEqual([
      "api", "graphql", "-f", `query=${RESOLVE_MUTATION}`, "-f", "id=PRRT_kwDOAbCdEf4A1b2C3d",
    ]);
    expect(RESOLVE_MUTATION).toContain("$id");
  });

  test("a value that is not a review thread id is refused before gh runs", () => {
    for (const bad of ["-rf", "$(touch x)", "abc 12345", "short"]) expect(() => resolveThreadArgv(bad)).toThrow();
  });

  test("run as a command: gh receives exactly that argv; a bad id never reaches it", () => {
    const dir = mkdtempSync(join(tmpdir(), "fake-gh-"));
    const log = join(dir, "argv.json");
    writeFileSync(join(dir, "gh"), `#!/usr/bin/env bun\nrequire("node:fs").writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)));\n`);
    chmodSync(join(dir, "gh"), 0o755);
    const env = { ...process.env, PATH: `${dir}:${process.env.PATH}` };

    const ok = spawnSync("bun", [SCRIPT, "PRRT_kwDOAbCdEf4A1b2C3d"], { env });
    expect(ok.status).toBe(0);
    expect(JSON.parse(readFileSync(log, "utf-8"))).toEqual(resolveThreadArgv("PRRT_kwDOAbCdEf4A1b2C3d"));

    writeFileSync(log, "untouched");
    const bad = spawnSync("bun", [SCRIPT, "--hostname=evil"], { env });
    expect(bad.status).toBe(2);
    expect(readFileSync(log, "utf-8")).toBe("untouched");
  });
});
