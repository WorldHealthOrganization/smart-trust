/**
 * Verification of the exit-2 contract for the LaTeX tooling family (folio-assistant-jh2j Finding 1).
 *
 * Each of these scripts must exit with code 2 (could-not-determine) when executed
 * in the platform context where no folio content / manifests exist, or when required
 * input arguments / files are absent:
 * 1. cat-harness/scripts/headless-render-qc.ts (no paper.json found)
 * 2. cat-harness/scripts/latexmk-compile.sh (missing argument or missing file)
 * 3. cat-harness/content/pipeline/generate-main-tex.ts (no paper manifest found in platform)
 *
 * validate-tex and audit-tex-source moved to folio-assistant-sci (bean `saqd`);
 * their two cases are in `folio-assistant-sci/pipeline/latex-exit2-contract.test.ts`.
 */

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

const ROOT = resolve(dirname(HARNESS_ROOT));

describe("LaTeX family exit-2 contract (Finding 1 on jh2j)", () => {
  test("headless-render-qc exits 2 on could-not-determine (no paper.json in platform)", () => {
    const res = Bun.spawnSync(["bun", "run", "cat-harness-tools/scripts/headless-render-qc.ts"], {
      cwd: ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(res.exitCode).toBe(2);
  });

  test("latexmk-compile.sh exits 2 on usage / missing file", () => {
    const noArgs = Bun.spawnSync(["cat-harness-tools/scripts/latexmk-compile.sh"], {
      cwd: ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(noArgs.exitCode).toBe(2);

    const missingFile = Bun.spawnSync(["cat-harness-tools/scripts/latexmk-compile.sh", "nonexistent-file.tex"], {
      cwd: ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(missingFile.exitCode).toBe(2);
  });

  test("generate-main-tex exits 2 on could-not-determine (no paper manifest in platform)", () => {
    const res = Bun.spawnSync(["bun", "run", "cat-harness-tools/pipeline/generate-main-tex.ts"], {
      cwd: ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(res.exitCode).toBe(2);
  });
});
