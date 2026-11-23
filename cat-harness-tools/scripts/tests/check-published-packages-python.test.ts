/**
 * The Python half of a published package is tested without writing into its
 * directory: no `__pycache__/` and no `.pytest_cache/`. In an index checkout
 * that directory is inside a remote mount, and one byte written there makes
 * the mount read as edited to every later `state:mount` (bean `cat-tools-sm8r`).
 */
import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PYTEST_ARGS, PYTHON_ENV } from "../check-published-packages.ts";

const PKG = mkdtempSync(join(tmpdir(), "py-pkg-"));
afterAll(() => rmSync(PKG, { recursive: true, force: true }));

const hasPytest = spawnSync("python3", ["-c", "import pytest"], { encoding: "utf-8" }).status === 0;

test.skipIf(!hasPytest)("pytest run the way the gate runs it leaves no cache in the package", () => {
  mkdirSync(join(PKG, "pkg"));
  writeFileSync(join(PKG, "pkg", "__init__.py"), "def one():\n    return 1\n");
  mkdirSync(join(PKG, "tests"));
  writeFileSync(join(PKG, "tests", "test_one.py"), "from pkg import one\n\ndef test_one():\n    assert one() == 1\n");
  writeFileSync(join(PKG, "pyproject.toml"), '[tool.pytest.ini_options]\npythonpath = ["."]\n');
  const r = spawnSync("python3", [...PYTEST_ARGS], { cwd: PKG, encoding: "utf-8", env: { ...process.env, ...PYTHON_ENV } });
  expect(r.status).toBe(0);
  const walk = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? [e.name, ...walk(join(d, e.name)).map((x) => `${e.name}/${x}`)] : [e.name]));
  const written = walk(PKG).filter((p) => /(^|\/)(__pycache__|\.pytest_cache)(\/|$)/.test(p));
  expect(written).toEqual([]);
  expect(existsSync(join(PKG, ".pytest_cache"))).toBe(false);
});
