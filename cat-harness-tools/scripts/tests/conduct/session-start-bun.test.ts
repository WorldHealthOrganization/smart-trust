/**
 * Bean `p3zo` — ensure agent containers align Bun runtime to `.bun-version`.
 *
 * In agent containers, the environment default may be an unpinned version (e.g. 1.4.2)
 * rather than the pinned version in `.bun-version` (e.g. 1.3.14).
 * This causes tool drift (e.g. navbar-assets minification differences).
 *
 * The session-start hook sweeps check `bun --version` against `.bun-version`
 * and install the pinned Bun via `npm pack @oven/bun-<os>-<arch>@<pin>` into
 * `$HOME/.local/bin/bun` so it precedes the container Bun on PATH.
 *
 * @module scripts/tests/session-start-bun.test
 */

import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const SCRIPTS_DIR = resolve(import.meta.dir, "..", "..");
const PIN_FILE = join(HARNESS_ROOT, ".bun-version");  // bean 70lx: the pin stayed with the harness
const INSTALL_SH = join(SCRIPTS_DIR, "install-bun.sh");
const INSTALL_BAT = join(SCRIPTS_DIR, "install-bun.bat");
const SWEEP_SH = join(SCRIPTS_DIR, "session-start-coord-sweep.sh");

describe("bun version pin and alignment (folio-assistant-p3zo)", () => {
  test(".bun-version exists and holds a bare X.Y.Z version", () => {
    expect(existsSync(PIN_FILE)).toBe(true);
    const text = readFileSync(PIN_FILE, "utf-8").trim();
    expect(text).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("install-bun.sh exists and is executable", () => {
    expect(existsSync(INSTALL_SH)).toBe(true);
    const stats = statSync(INSTALL_SH);
    // Check executable bits (at least user executable)
    expect((stats.mode & 0o111) !== 0).toBe(true);
  });

  test("install-bun.bat exists beside install-bun.sh", () => {
    expect(existsSync(INSTALL_BAT)).toBe(true);
  });

  test("install-bun.sh syntax is valid bash", () => {
    const r = execFileSync("bash", ["-n", INSTALL_SH], { encoding: "utf-8" });
    expect(r).toBe("");
  });

  test("session-start-coord-sweep.sh syntax is valid bash", () => {
    const r = execFileSync("bash", ["-n", SWEEP_SH], { encoding: "utf-8" });
    expect(r).toBe("");
  });

  test("install-bun.sh reports already installed when target version matches running bun", () => {
    const currentVer = process.versions.bun;
    const out = execFileSync(INSTALL_SH, [currentVer], { encoding: "utf-8" });
    expect(out).toContain(`Bun ${currentVer} is already installed and matches target.`);
  });

  test("install-bun.sh rejects invalid version format with exit code 2", () => {
    for (const badVer of ["invalid", "v1.3.14", "latest", "1.3"]) {
      try {
        execFileSync(INSTALL_SH, [badVer], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
        expect.unreachable("expected error for " + badVer);
      } catch (err) {
        const e = err as { status?: number; stderr?: unknown };
        expect(e.status).toBe(2);
        const stderr = String(e.stderr ?? "");
        expect(stderr).toContain("not a valid bare X.Y.Z version");
      }
    }
  });

  test("session-start-coord-sweep.sh includes Bun alignment section and check-bun-runtime invocation", () => {
    const content = readFileSync(SWEEP_SH, "utf-8");
    expect(content).toContain("3-ter. Bun runtime vs the pin");
    expect(content).toContain("bun_pin_file=");
    expect(content).toContain("install-bun.sh");
    expect(content).toContain("check-bun-runtime.ts");
    expect(content).toContain("Bun runtime aligned (folio-assistant-p3zo)");
    expect(content).toContain("Bun runtime alignment warning");
  });
});
