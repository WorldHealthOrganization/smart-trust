#!/usr/bin/env bun
/**
 * Run bootstrap-tools' standalone rehearsal when bootstrap arrives by remote
 * mount from lock.
 *
 * `rehearse-standalone.ts` tests that bootstrap-tools passes its checks when
 * isolated beside bootstrap in an empty scratch directory, and asks
 * `gitFiles()` which files a standalone clone would hold. Remote-mounted
 * bootstrap and bootstrap-tools are ignored by the enclosing repository's
 * `.gitignore` and `.git/info/exclude`, so `git ls-files` inside them returns
 * zero files.
 *
 * ## It works on COPIES, never on the mounts
 *
 * The gates run concurrently over one tree, and no gate may change it: a
 * `.git` inside a mount makes `layerRootsIn` (cat-harness
 * `schemas/kg/instance-roots.ts`) drop it as a foreign checkout, and
 * `closureOf` (`seed-ready.ts`) then skips the missing need silently.
 *
 * So bootstrap and bootstrap-tools are copied (without `.git` and
 * `node_modules`) into a fresh temporary directory, the COPIES are given git
 * metadata, the root `node_modules` is linked beside them, and the copy's own
 * rehearsal runs there. Nothing is written into a mount, and the directory is
 * removed afterwards.
 *
 * @module scripts/rehearse-bootstrap-standalone
 * @covers code — bootstrap-tools standalone rehearsal across remote-mounted bootstrap
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { HARNESS_ROOT } from "./lib/roots.ts";

const REPO = dirname(HARNESS_ROOT);

/** `name` copied from the checkout into `into`, as a git repository of its own. */
function copyAsRepository(name: string, into: string): void {
  const from = join(REPO, name);
  const to = join(into, name);
  cpSync(from, to, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (p) => !/(^|[\\/])(\.git|node_modules)$/.test(relative(from, p)),
  });
  for (const args of [["init", "-q"], ["add", "-A"]]) {
    const r = spawnSync("git", args, { cwd: to, encoding: "utf-8" });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")} in ${to}: ${r.stderr}`);
  }
}

const scratch = mkdtempSync(join(tmpdir(), "bootstrap-standalone-src-"));
try {
  copyAsRepository("bootstrap", scratch);
  copyAsRepository("bootstrap-tools", scratch);
  const nm = [join(REPO, "node_modules"), join(REPO, "bootstrap-tools/node_modules")].find((p) => existsSync(p));
  if (nm) symlinkSync(nm, join(scratch, "node_modules"), "dir");

  const proc = spawnSync("bun", ["run", join(scratch, "bootstrap-tools/scripts/rehearse-standalone.ts"), ...process.argv.slice(2)], {
    cwd: scratch,
    stdio: "inherit",
  });
  process.exitCode = proc.status ?? (proc.error ? 1 : 0);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
