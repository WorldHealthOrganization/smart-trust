#!/usr/bin/env bun
/**
 * Every PUBLISHABLE package in this repository still builds and still passes
 * its own tests — in BOTH languages it ships.
 *
 * The set is DERIVED, never listed here: every `package.json` and every
 * `pyproject.toml` git accounts for, minus the repository root, minus
 * anything `private`. One directory shipping in both ecosystems is TWO
 * entries and two verdicts, since the halves fail independently.
 *
 * Nothing about a runner is hardcoded. A JavaScript half declares its steps
 * as `scripts.build` / `scripts.test`; a Python half declares pytest by
 * carrying `[tool.pytest.ini_options]`, and declares its own test
 * dependencies under `[project.optional-dependencies] test`, which is what
 * gets installed. A package that declares neither is REPORTED and skipped.
 * (Python tests run under pytest, not as bare scripts, which would execute
 * no test and exit 0.)
 *
 * **An empty set is a FINDING**, and so is **a missing interpreter**: "no
 * failures" over nothing examined must not read as a pass.
 *
 * Usage:
 *   bun run cat check:published-packages
 *
 * @covers cat-harness
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

import { mountedInstanceRoots } from "../schemas/kg/remote-mount.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";
import { writePathOf } from "./lib/layer-output.ts";

function findIndexLockRoot(): string {
  if (existsSync(join(process.cwd(), "index.lock.json"))) return process.cwd();
  let cur = import.meta.dir;
  for (let i = 0; i < 6; i++) {
    cur = dirname(cur);
    if (existsSync(join(cur, "index.lock.json"))) return cur;
  }
  return resolve(import.meta.dir, "..");
}

const ROOT = findIndexLockRoot();

/** Which registry a half ships to, and therefore whose tooling runs it. */
export type Ecosystem = "npm" | "pypi";

export interface PublishablePackage {
  /** Repository-relative directory holding the manifest. */
  dir: string;
  name: string;
  ecosystem: Ecosystem;
  /** `undefined` when the half declares no build step. */
  build: string | undefined;
  /** `undefined` when the half declares no test step. */
  test: string | undefined;
}

/**
 * git could not be asked what the corpus is. Bean `bnuy`.
 *
 * This existed as `return []` until 2026-09-30, which is the `dh4f` shape in
 * the gate whose whole subject is the packages this repository ships: an
 * unanswerable git and a repository that publishes nothing produced the same
 * value, so the check reported clean over a corpus it never read.
 *
 * Every neighbour already drew the line the other way — `gitCorpus` and
 * bootstrap's `gitFiles` return `undefined` and say in their docblocks why
 * `[]` would be wrong, `check-portable-paths` refuses, `kg-audit` reports
 * `result: "unknown"`. This one was the outlier.
 *
 * It throws rather than returning a third value because `publishablePackages`
 * calls {@link manifests} once per ecosystem and composes the results: an
 * `undefined` would have to be threaded through each call site, and a call
 * site that forgets is back to the silent empty. A throw cannot be forgotten.
 */
export class GitUnanswerable extends Error {
  constructor(
    readonly pathspec: string,
    readonly why: string,
  ) {
    super(`git could not list \`${pathspec}\` — ${why}. That is not "no packages"; nothing was checked.`);
    this.name = "GitUnanswerable";
  }
}

/**
 * The manifests of each REMOTE-MOUNTED layer, for one filename.
 *
 * In the index checkout every layer is a mount: another repository's bytes,
 * laid down from the lock and never tracked here, so `git ls-files` sees none
 * of them and this check found nothing — "not a pass" by its own rule, on a
 * checkout whose cat-harness mount carries `@litlfred/block-qa-schema`. A
 * mount is DECLARED (the lock), so walking it is the declaration answering,
 * as `viewer-declarations.ts` does for mounted pages. Each mount's own
 * top-level manifest is skipped — it is that repository itself, the same
 * reason the checkout root is — and `node_modules/`, `.venv/` and dot
 * directories are never entered (the `ramz` rule the index read exists for).
 */
function mountedManifests(root: string, filename: string): string[] {
  const out: string[] = [];
  for (const mountRoot of mountedInstanceRoots(root).values()) {
    const walk = (dir: string): void => {
      let entries: import("node:fs").Dirent[];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        // input-site: inert #6adcd2c8 — names the directories the walk skips; none of them is read
        if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "dist") continue;
        const abs = join(dir, e.name);
        if (e.isDirectory()) walk(abs);
        else if (e.name === filename && dir !== mountRoot) out.push(relative(root, abs).split(sep).join("/"));
      }
    };
    walk(mountRoot);
  }
  return out.sort();
}

/** The manifests git accounts for, for one filename. */
function manifests(root: string, glob: string): string[] {
  // 64 MiB for the same reason `gitCorpus` carries it: node caps a child's
  // stdout at 1 MiB and sets ENOBUFS rather than truncating. This call is
  // pathspec-scoped so it is far from that limit, but it is the same class,
  // and this is the call site where the consequence was worst.
  // input-site: tree #3ebaf913 — the tracked files matching a package glob: git's index, which the cone replays
  const r = spawnSync("git", ["ls-files", "-z", "--", glob], { cwd: root, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error !== undefined || r.status !== 0) {
    throw new GitUnanswerable(glob, r.error?.message ?? ((r.stderr || "").trim() || `git exited ${String(r.status)}`));
  }
  return r.stdout.split("\0").filter((p) => p.length > 0);
}

/**
 * The publishable packages git accounts for, in every ecosystem this
 * repository ships to.
 *
 * Enumerated from the index rather than by walking the filesystem — the
 * `ramz` rule. A bare walk here would descend into every `node_modules/`
 * and every `.venv/` in the tree and report several thousand third-party
 * packages as this repository's own.
 */
/**
 * Why a `package.json` is not an npm manifest at all, or `undefined` when it
 * is one (cat-harness-tools#1701).
 *
 * A FHIR package shares the filename: an IG repository's
 * `local-template/package/package.json` declares `"type": "fhir.template"`,
 * the FHIR NPM package spec's type, and is read by the IG Publisher, never by
 * npm. npm's own `type` takes only `module` or `commonjs`, so any other
 * value says the manifest belongs to another ecosystem, and `bun install`
 * on it judges nothing this gate is about. An absent `type` is npm's.
 */
export function notAnNpmManifest(raw: Record<string, unknown>): string | undefined {
  const type = raw.type;
  if (type === undefined || type === "module" || type === "commonjs") return undefined;
  const what = typeof type === "string" && /^(fhir\.|IG|Conformance|Core|Examples|Group|Tool)/.test(type) ? "a FHIR package" : "not an npm package";
  return `its \`type\` is ${JSON.stringify(type)}, which npm does not define: ${what}, never installed or published by npm`;
}

/** A manifest {@link publishablePackages} found and did not take, with why. */
export interface ForeignManifest {
  dir: string;
  name: string;
  why: string;
}

export function publishablePackages(root: string = ROOT, foreign: ForeignManifest[] = []): PublishablePackage[] {
  const out: PublishablePackage[] = [];

  for (const rel of [...manifests(root, "*package.json"), ...mountedManifests(root, "package.json")]) {
    if (rel === "package.json") continue; // the repository itself is not published
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(readFileSync(join(root, rel), "utf-8")) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (raw.private === true || typeof raw.name !== "string") continue;
    const why = notAnNpmManifest(raw);
    if (why !== undefined) {
      foreign.push({ dir: dirname(rel), name: raw.name, why });
      continue;
    }
    const scripts = (raw.scripts ?? {}) as Record<string, string>;
    out.push({
      dir: dirname(rel),
      name: raw.name,
      ecosystem: "npm",
      build: scripts.build,
      test: scripts.test,
    });
  }

  for (const rel of [...manifests(root, "*pyproject.toml"), ...mountedManifests(root, "pyproject.toml")]) {
    let raw: Record<string, unknown>;
    try {
      raw = Bun.TOML.parse(readFileSync(join(root, rel), "utf-8")) as Record<string, unknown>;
    } catch {
      continue;
    }
    const project = (raw.project ?? {}) as Record<string, unknown>;
    if (typeof project.name !== "string") continue;
    // PEP 621 has no `private` flag; the Python convention for "never
    // published" is a Private classifier, so honour that rather than
    // inventing a field nobody writes.
    const classifiers = Array.isArray(project.classifiers) ? (project.classifiers as string[]) : [];
    if (classifiers.some((c) => c.startsWith("Private ::"))) continue;
    // Nothing about the runner is assumed: a package declares pytest by
    // carrying its config table. Absent, this reports rather than guesses.
    const tool = (raw.tool ?? {}) as Record<string, unknown>;
    const declaresPytest = Object.hasOwn(tool, "pytest");
    out.push({
      dir: dirname(rel),
      name: project.name,
      ecosystem: "pypi",
      // Deliberately undeclared: whether a WHEEL BUILD belongs in this gate is
      // a real question (it needs `python3 -m build` on the runner) and this
      // check does not answer it — so it is reported in the skipped channel
      // rather than passed over. Bean `872t`, which carries the argument that
      // matters: the tests import from `pythonpath`, not from the built wheel,
      // so a wheel whose `force-include`d schemas went missing would pass
      // every test there is. That is the `rsi6` shape — the thing under test
      // is not the thing that ships.
      build: undefined,
      test: declaresPytest ? "pytest" : undefined,
    });
  }

  return out;
}

/**
 * Make a Python half runnable, or say why not.
 *
 * Mirrors the `bun install` the npm half gets. The probe comes first so a
 * satisfied environment costs one interpreter start rather than a pip
 * resolution; the install reads the package's OWN `[project.optional-
 * dependencies] test`, so this function names no dependency of its own.
 */
/**
 * What the Python half runs under: no bytecode (`__pycache__/*.pyc`) and no
 * pytest cache (`.pytest_cache/`) written into the package directory. That
 * directory is inside a remote mount in an index checkout, and a byte written
 * there made the mount read as edited ("no longer hash to the lock") to every
 * later `state:mount` (bean `cat-tools-sm8r`, measured 2026-11-06).
 */
export const PYTHON_ENV = { PYTHONDONTWRITEBYTECODE: "1" } as const;
export const PYTEST_ARGS = ["-m", "pytest", "-q", "-p", "no:cacheprovider"] as const;

function preparePython(abs: string): { ok: true } | { ok: false; why: string } {
  // input-site: spawned #9fae058c — probes python3 for pytest with the environment handed whole; the cone audits the child from its read set
  const probe = spawnSync("python3", ["-c", "import pytest, sys"], { cwd: abs, encoding: "utf-8", env: { ...process.env, ...PYTHON_ENV } });
  if (probe.error !== undefined) {
    return { ok: false, why: `no \`python3\` on PATH — ${probe.error.message}` };
  }
  if (probe.status === 0) return { ok: true };
  // input-site: traced #42ef5791 — pip installs the package and its test extras from the network: a run that reaches it records no hash
  inputSiteReached("check-published-packages: pip install");
  const install = spawnSync("python3", ["-m", "pip", "install", "--quiet", "-e", ".[test]"], {
    cwd: abs,
    encoding: "utf-8",
  });
  if (install.error !== undefined || install.status !== 0) {
    const tail = `${install.stdout ?? ""}${install.stderr ?? ""}`.trimEnd().split("\n").slice(-6);
    return { ok: false, why: `\`pip install -e .[test]\` exited ${install.status ?? "?"}\n${tail.map((l) => `        ${l}`).join("\n")}` };
  }
  return { ok: true };
}

if (import.meta.main) {
  // `publishablePackages` asks git once per ecosystem and concatenates, so a
  // git that fails on ONE pathspec used to delete that ecosystem from the
  // corpus while the others still answered — and the vacuity guard below
  // cannot see that, because `pkgs.length` is not 0. A partial corpus wearing
  // a total's clothes is the failure this whole file was written about.
  let pkgs: PublishablePackage[];
  const foreign: ForeignManifest[] = [];
  try {
    pkgs = publishablePackages(ROOT, foreign);
  } catch (e) {
    if (!(e instanceof GitUnanswerable)) throw e;
    console.error(`\n✗ ${e.message}`);
    console.error("  The corpus is the git index, so an unanswerable git is not an empty");
    console.error("  repository. Nothing was examined and nothing is claimed.");
    process.exit(2);
  }

  // Vacuity before the verdict, for the same reason every sweep here does it.
  if (pkgs.length === 0) {
    console.error(
      "\n✗ FOUND NO PUBLISHABLE PACKAGE. This is not a pass: nothing was examined.\n" +
        "  Either the discovery is broken, or this repository stopped publishing —\n" +
        "  and those two need telling apart before anything here reads as green.",
    );
    process.exit(1);
  }

  const dirs = new Set(pkgs.map((p) => p.dir)).size;
  console.log(
    `Publishable packages — ${pkgs.length} across ${dirs} director${dirs === 1 ? "y" : "ies"},` +
      ` derived from the git index\n`,
  );
  for (const f of foreign) console.log(`  · ${f.name} (${f.dir}): not applicable here — ${f.why}`);

  const scratch: string[] = [];
  const workdirFor = (abs: string): string => {
    if (writePathOf(abs) === abs) return abs;
    const tmp = mkdtempSync(join(tmpdir(), "published-package-"));
    scratch.push(tmp);
    cpSync(abs, tmp, { recursive: true, filter: (src) => !/(^|[\\/])(dist|node_modules)$/.test(src) });
    if (existsSync(join(abs, "node_modules"))) symlinkSync(join(abs, "node_modules"), join(tmp, "node_modules"));
    return tmp;
  };
  process.on("exit", () => {
    for (const d of scratch) rmSync(d, { recursive: true, force: true });
  });
  const failed: string[] = [];
  const skipped: string[] = [];
  for (const pkg of pkgs) {
    // A package in a MOUNTED layer is built and tested in a scratch copy:
    // its build writes `dist/` (and an install `node_modules/`), and nothing
    // a check runs may write inside a mount (bean `cat-tools-sm8r`, item 4;
    // the `mounts:untouched` gate named `block-qa-schema/dist/` on its first
    // run in a layer's pull request). A layer's own checkout builds in place.
    const abs = workdirFor(join(ROOT, pkg.dir));
    const label = `${pkg.name} [${pkg.ecosystem}]`;

    if (pkg.ecosystem === "npm") {
      if (!existsSync(join(abs, "node_modules"))) {
        const install = spawnSync("bun", ["install"], { cwd: abs, encoding: "utf-8" });
        if (install.status !== 0) {
          failed.push(`${label}: \`bun install\` exited ${install.status ?? "?"}`);
          console.log(`  ✗ ${label}  (install failed)`);
          continue;
        }
      }
    } else if (pkg.test !== undefined) {
      const ready = preparePython(abs);
      if (!ready.ok) {
        // NOT a skip. An absent interpreter and a passing suite must never
        // render the same, or this gate reports on itself instead of on the
        // corpus — the `5rfy` shape, and the reason `1s5s` exists.
        failed.push(`${label}: ${ready.why}`);
        console.log(`  ✗ ${label}  (${pkg.dir})  — could not prepare`);
        continue;
      }
    }

    // BUILD then TEST. A package that compiles and does not work is the state
    // this gate was built during: `rsi6` fixed the build, and the `test`
    // script it left behind had never passed in the package's life — `vitest
    // run` reporting "No test files found, exiting with code 1". Checking only
    // the build would have gone green over exactly that.
    const steps: Array<{ name: "build" | "test"; declared: string | undefined }> = [
      { name: "build", declared: pkg.build },
      { name: "test", declared: pkg.test },
    ];
    let ok = true;
    for (const step of steps) {
      if (step.declared === undefined) {
        // Reported, never passed over: whether a shipped package should have
        // this script is a question this check does not answer, and silence
        // would answer it.
        if (step.name === "build" && pkg.ecosystem === "pypi") {
          skipped.push(`${label} (${pkg.dir}) — no \`build\` step (pure-Python hatchling; force-include schemas unverified by build)`);
        } else {
          skipped.push(`${label} (${pkg.dir}) — no \`${step.name}\` step declared`);
        }
        continue;
      }
      const r =
        pkg.ecosystem === "npm"
          ? spawnSync("bun", ["run", step.name], { cwd: abs, encoding: "utf-8" })
          : spawnSync("python3", [...PYTEST_ARGS], { cwd: abs, encoding: "utf-8", env: { ...process.env, ...PYTHON_ENV } });
      if (r.status === 0) continue;
      ok = false;
      const how = pkg.ecosystem === "npm" ? `bun run ${step.name}` : "python3 -m pytest";
      // pytest's exit 5 is "collected nothing", which is the `vitest run`
      // false-green in another costume — name it rather than leave a bare
      // exit code for a reader to look up.
      const gloss = pkg.ecosystem === "pypi" && r.status === 5 ? " — COLLECTED NO TESTS" : "";
      failed.push(`${label}: \`${how}\` exited ${r.status ?? "?"}${gloss}`);
      console.log(`  ✗ ${label}  (${pkg.dir})  — ${step.name}${gloss}`);
      // The error, not just the exit code: a reader must not have to re-run it.
      const tail = `${r.stdout ?? ""}${r.stderr ?? ""}`.trimEnd().split("\n").slice(-12);
      for (const line of tail) console.log(`        ${line}`);
    }
    if (ok) console.log(`  ✓ ${label}  (${pkg.dir})`);
  }

  if (skipped.length > 0) {
    console.log(`\n· ${skipped.length} step(s) a package does not declare, so none was run:`);
    for (const s of skipped) console.log(`    ${s}`);
    console.log("  Reported rather than passed over — whether a shipped package should");
    console.log("  build is a question this check does not answer, and silence would.");
  }

  if (failed.length > 0) {
    console.error(`\n✗ ${failed.length} publishable package half/halves do not build or pass:`);
    for (const f of failed) console.error(`    ${f}`);
    console.error(
      "\n  A package that ships and is neither built nor tested in CI is one whose\n" +
        "  next dependency bump lands green and broken. That already happened —\n" +
        `  see the header of ${relative(ROOT, import.meta.path)}.`,
    );
    process.exit(1);
  }

  console.log(`\n✓ ${pkgs.length} publishable package half/halves build and test.`);
}
