/**
 * Regression tests for `scripts/pypdf_safe.py`.
 *
 * The bug: `pypdf` guards its optional `cryptography` import with
 * `except ImportError`, but a broken Rust binding raises pyo3's
 * `PanicException`, which derives from `BaseException`. The guard misses it
 * and `import pypdf` takes the whole process down — observed in this
 * project's containers with debian `cryptography` 41.0.7, where it made
 * `pdf-structure.py` unusable and had to be worked around by hand with a
 * `sitecustomize.py` shim.
 *
 * These tests poison `cryptography` the same way (a module that raises a
 * BaseException on import, planted ahead of the real one on PYTHONPATH) and
 * assert the PDF scripts still run. Without the fix they fail; the poison
 * subclasses BaseException directly, so an `except Exception` or
 * `except ImportError` guard cannot catch it.
 *
 * Run via the standard harness:
 *
 *     ./scripts/tests/run-tests.sh
 *     # or
 *     cd scripts/tests && bun test pypdf-safe.test.ts
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

const SCRIPTS = resolve(import.meta.dir, "..");

/** A `cryptography` package that explodes on import, exactly as pyo3 does. */
function plantPoisonedCryptography(root: string): void {
  const pkg = join(root, "cryptography");
  mkdirSync(join(pkg, "hazmat", "primitives", "ciphers"), { recursive: true });
  // PanicException is not an Exception; reproduce that, not a plain error.
  const boom = [
    "class PanicException(BaseException):",
    "    pass",
    "",
    "raise PanicException('Python API call failed')",
    "",
  ].join("\n");
  writeFileSync(join(pkg, "__init__.py"), boom);
  writeFileSync(join(pkg, "exceptions.py"), boom);
  writeFileSync(join(pkg, "hazmat", "__init__.py"), boom);
  writeFileSync(join(pkg, "hazmat", "primitives", "__init__.py"), boom);
  writeFileSync(join(pkg, "hazmat", "primitives", "ciphers", "__init__.py"), boom);
}

interface Run {
  code: number | null;
  stdout: string;
  stderr: string;
}

async function runPython(args: string[], env: Record<string, string>): Promise<Run> {
  const proc = Bun.spawn(["python3", ...args], {
    cwd: SCRIPTS,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { code, stdout, stderr };
}

let havePypdf = false;

beforeAll(async () => {
  const probe = await runPython(["-c", "import pypdf"], {});
  havePypdf = probe.code === 0;
});

describe("pypdf_safe", () => {
  test("imports pypdf when cryptography is healthy, without stubbing it", async () => {
    if (!havePypdf) return; // pypdf absent: nothing to assert about its import
    const r = await runPython(
      ["-c", "import pypdf_safe; print('STUBBED', pypdf_safe.CRYPTOGRAPHY_STUBBED)"],
      {},
    );
    expect(r.code).toBe(0);
    // Whether the real cryptography works is environment-dependent, so this
    // only pins that the module reports its branch rather than guessing.
    expect(r.stdout).toContain("STUBBED");
  });

  test("survives a cryptography that raises BaseException on import", async () => {
    if (!havePypdf) return;
    const dir = mkdtempSync(join(tmpdir(), "pypdf-safe-poison-"));
    try {
      plantPoisonedCryptography(dir);
      const r = await runPython(
        ["-c", "import pypdf_safe; print('READER', pypdf_safe.PdfReader.__name__)"],
        { PYTHONPATH: dir },
      );
      expect(r.stderr).not.toContain("PanicException");
      expect(r.code).toBe(0);
      expect(r.stdout).toContain("READER PdfReader");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("reports that it stubbed, when it stubbed", async () => {
    if (!havePypdf) return;
    const dir = mkdtempSync(join(tmpdir(), "pypdf-safe-flag-"));
    try {
      plantPoisonedCryptography(dir);
      const r = await runPython(
        ["-c", "import pypdf_safe; print('STUBBED', pypdf_safe.CRYPTOGRAPHY_STUBBED)"],
        { PYTHONPATH: dir },
      );
      expect(r.code).toBe(0);
      expect(r.stdout).toContain("STUBBED True");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("pdf-structure.py starts under a poisoned cryptography", async () => {
    if (!havePypdf) return;
    const dir = mkdtempSync(join(tmpdir(), "pypdf-safe-structure-"));
    try {
      plantPoisonedCryptography(dir);
      const r = await runPython(["pdf-structure.py", "--help"], { PYTHONPATH: dir });
      expect(r.stderr).not.toContain("PanicException");
      expect(r.code).toBe(0);
      expect(r.stdout).toContain("usage");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("split-pdf-by-chapter.py starts under a poisoned cryptography", async () => {
    if (!havePypdf) return;
    const dir = mkdtempSync(join(tmpdir(), "pypdf-safe-split-"));
    try {
      plantPoisonedCryptography(dir);
      const r = await runPython(["split-pdf-by-chapter.py", "--help"], { PYTHONPATH: dir });
      expect(r.stderr).not.toContain("PanicException");
      expect(r.code).toBe(0);
      expect(r.stdout).toContain("usage");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the poison actually reproduces the bug (a bare pypdf import dies)", async () => {
    if (!havePypdf) return;
    const dir = mkdtempSync(join(tmpdir(), "pypdf-safe-control-"));
    try {
      plantPoisonedCryptography(dir);
      // Control: this is what the scripts used to do. If this ever starts
      // passing, the poison stopped reproducing the failure and the tests
      // above have quietly stopped proving anything.
      const r = await runPython(
        ["-c", "from pypdf import PdfReader; print('SURVIVED')"],
        { PYTHONPATH: dir },
      );
      expect(r.stdout).not.toContain("SURVIVED");
      expect(r.code).not.toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
