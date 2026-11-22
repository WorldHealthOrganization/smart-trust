/**
 * The registry warns once, on stderr, when it is read before a folio configures
 * it (qou bean `qou-i2ed`). Each case runs in a fresh process because the
 * registry is module-level state.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

const MOD = resolve(import.meta.dir, "../../schemas/lean-packages.ts");

function run(body: string): { stdout: string; stderr: string } {
  const r = Bun.spawnSync(["bun", "-e", `import * as m from ${JSON.stringify(MOD)};\n${body}`]);
  return { stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

describe("lean-packages unconfigured guard", () => {
  test("a lookup before configuring warns exactly once, on stderr", () => {
    const r = run(`m.leanPackageByName("qou"); m.leanPackageByPaperDir("x"); m.isLeanPackageName("y"); console.log("done");`);
    expect(r.stdout.trim()).toBe("done");
    expect(r.stderr.match(/\[lean-packages\]/g)?.length).toBe(1);
    expect(r.stderr).toContain("leanPackageByName ran before configureLeanPackages()");
  });

  test("iterating LEAN_PACKAGES before configuring warns", () => {
    const r = run(`for (const p of m.LEAN_PACKAGES) console.log(p.name);`);
    expect(r.stderr).toContain("LEAN_PACKAGES ran before configureLeanPackages()");
  });

  test("no warning once configured, even with an empty list", () => {
    const r = run(`m.configureLeanPackages([]); m.leanPackageByName("qou"); [...m.LEAN_PACKAGES];`);
    expect(r.stderr).not.toContain("[lean-packages]");
  });
});
