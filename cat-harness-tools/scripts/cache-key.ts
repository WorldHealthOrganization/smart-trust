#!/usr/bin/env bun
/**
 * The key of a cached CI step, and a committer's way to publish one
 * (`cache:key`, `cache:publish`). The CI half is the `cached-step` composite
 * action of the checkout that runs it (folio-assistant
 * `.github/actions/cached-step`); the rule both follow is the skill
 * `cache-first-ci` (cat-harness, sdlc).
 *
 * @module scripts/cache-key
 * @graphNode none — a CI and committer helper, not a gate
 *
 * ## The key is DERIVED, never hand-declared (bean `4rbc`)
 *
 * `cache:key <script>` prints the `f017` fingerprint of a package script
 * (`input-hash.ts`): its import closure, audited for every environment,
 * network, clock and git read (`input-sites.ts`); the `bun` and `git`
 * versions; `bun.lock`; and its `task-io` declaration, where `{tracked}` is
 * the whole tree. Nothing is listed by hand here: what the fingerprint cannot
 * see, it refuses. So it prints either a 64-hex key (exit 0) or
 * `undetermined: <why>` (exit 3), which `cached-step` treats as a miss that is
 * never saved. A script that compares against a `qa-reports` baseline
 * (`--against <ref>`) has that baseline's identity in its key, read from the
 * store as `gates` reads it.
 *
 * `--hash-files <path>...` instead prints what the GitHub runner's
 * `hashFiles()` prints for those files: sha256 over the raw sha256 of each
 * file, in path order. It is for a step whose inputs a lock pins wholly (the
 * mounts: `index.lock.json`), so a committer gets the key CI computes.
 *
 * ## `cache:publish <step>` — a committer's entry, which CI only verifies
 *
 * For a class-(a) step only: its `verify` checks the output against a
 * reference derived from the TREE (the mounts against the lock's tree
 * digests), so a bad entry is only a miss. A bundle checked against the
 * manifest it carries is not one: a manifest proves it intact, not built from
 * these inputs, so such bundles need a source rule and are never published
 * by a committer. CI never consumes a published entry on main. The committer builds it locally and runs this, which commits the
 * output as a tree (`ws/<path>` for a path in the checkout, `home/<path>` for
 * one under `$HOME`) and pushes it to `refs/cache/cs1-<step>-<key>`. CI's
 * `cached-step` (with `committer-refs: true`) fetches it and accepts it only
 * if the step's `verify` passes. Verdicts are not published this way: CI
 * cannot check a verdict without re-running it (the local gate records,
 * #2957/#2958, re-verify those).
 *
 *   bun run cat cache:key <script>
 *   bun run cat cache:key --base <script>     # the cone's tree-free base (`coneFingerprint`)
 *   bun run cat cache:key --hash-files <path>...
 *   bun run cat cache:publish <step> [--dry-run] [--remote origin]
 *   bun run cat cache:publish <step> (--script <s> | --hash-files <p>...) --paths <p>... [--dry-run]
 *
 * `<step>` alone uses {@link STEPS}, which mirrors how the workflows call
 * `cached-step`; a test keeps the two equal.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { checkoutRootFor } from "../schemas/kg/cat-harness.ts";
import { coneFingerprint } from "./ci-cone.ts";
import { checkFingerprint, FileDigests, qaBaselineIdentity, type Fingerprint } from "./input-hash.ts";
import { collectTaskIo, pairIO } from "./task-io.ts";
import { scriptsOf } from "../schemas/sdlc/script-table.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** Bump with the `cs1` of `cached-step.sh`: the namespace of every entry. */
export const NS = "cs1";

/**
 * How a key is derived: from a script's fingerprint, from its TREE-FREE cone
 * base (`base`: the result store's and the cone's own key half, whose read-set
 * match stays in `ci-cone.ts`), or from files a lock pins.
 */
export type KeySource = { script: string; base?: boolean } | { hashFiles: readonly string[] };

/**
 * The class-(a) steps a committer may publish, as the workflows call them.
 * Empty today: the mounts, the first class-(a) cache, have their own
 * committer path, the layers ref (`refs/cat/layers/<key>`, `layers:publish`),
 * whose replayer verifies per layer and serves every layer that did not
 * move. One committer path per cache, so the mounts are not published here.
 */
export const STEPS: Readonly<Record<string, { key: KeySource; paths: readonly string[] }>> = {};

/** What the runner's `hashFiles()` computes: sha256 over each file's RAW sha256, in path order. */
export function hashFiles(root: string, paths: readonly string[]): string | { undetermined: string } {
  const files = [...paths].map((p) => resolve(root, p)).sort();
  const outer = createHash("sha256");
  let n = 0;
  for (const f of files) {
    if (!existsSync(f) || !statSync(f).isFile()) return { undetermined: `${relative(root, f)} is not a file` };
    outer.update(createHash("sha256").update(readFileSync(f)).digest());
    n++;
  }
  if (n === 0) return { undetermined: "no file to hash" };
  return outer.digest("hex");
}

/** The derived key of `source`, or why it could not be derived. */
export function keyOf(root: string, source: KeySource): string | { undetermined: string } {
  if ("hashFiles" in source) return hashFiles(root, source.hashFiles);
  const scripts = scriptsOf(root);
  if (scripts[source.script] === undefined) return { undetermined: `no package script \`${source.script}\`` };
  const digests = new FileDigests(root);
  const baseline = qaBaselineIdentity({ repoRoot: root });
  // Exactly the arguments the callers whose keys this must equal pass: `gates`
  // (`GateSkipper.fingerprint`: `pairIO`, the `{inputs, outputs}` projection,
  // since the fingerprint hashes the io's JSON) and `ci-cone` (`coneFingerprint`
  // over `collectTaskIo()`). A test holds `cache:key` equal to `gates`'s key.
  const fp: Fingerprint = source.base === true
    ? coneFingerprint(root, scripts, source.script, collectTaskIo(root)[source.script], digests, baseline)
    : checkFingerprint(root, scripts, source.script, pairIO(source.script), digests, baseline);
  return "hash" in fp ? fp.hash : { undetermined: fp.undetermined };
}

/** `cs1-<step>-<key>`, as `cached-step.sh key` namespaces it. */
export function namespaced(step: string, key: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(step)) throw new Error(`step '${step}' is not [a-z0-9-]+`);
  return `${NS}-${step}-${key}`;
}

/** Where a path goes in a published tree: `ws/` inside the checkout, `home/` under $HOME. */
export function treePathOf(root: string, path: string, home: string = homedir()): string {
  const abs = path.startsWith("~/") ? join(home, path.slice(2)) : resolve(root, path);
  const inWs = relative(root, abs);
  if (!inWs.startsWith("..") && !isAbsolute(inWs)) return join("ws", inWs);
  const inHome = relative(home, abs);
  if (!inHome.startsWith("..") && !isAbsolute(inHome)) return join("home", inHome);
  throw new Error(`${path} is neither in the checkout nor under $HOME, so CI cannot put it back`);
}

function git(cwd: string, args: string[], env: Record<string, string> = {}): string {
  const r = Bun.spawnSync(["git", ...args], { cwd, env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.toString().trim()}`);
  return r.stdout.toString().trim();
}

/** Commit `paths` as a tree and (unless dry) push it to refs/cache/<ns key>. Returns the ref and commit. */
export function publish(root: string, step: string, key: string, paths: readonly string[], opts: { dryRun?: boolean; remote?: string } = {}) {
  const ref = `refs/cache/${namespaced(step, key)}`;
  const stage = mkdtempSync(join(tmpdir(), "cache-publish-"));
  const index = join(stage, ".index");
  try {
    for (const p of paths) {
      const src = p.startsWith("~/") ? join(homedir(), p.slice(2)) : resolve(root, p);
      if (!existsSync(src)) throw new Error(`${p} does not exist: build the step first`);
      cpSync(src, join(stage, "tree", treePathOf(root, p)), { recursive: true });
    }
    const env = { GIT_INDEX_FILE: index, GIT_WORK_TREE: join(stage, "tree") };
    const gitDir = git(root, ["rev-parse", "--absolute-git-dir"]);
    git(join(stage, "tree"), ["--git-dir", gitDir, "add", "-A", "--force", "."], env);
    const tree = git(join(stage, "tree"), ["--git-dir", gitDir, "write-tree"], env);
    // A fixed identity and date: the commit is a function of the tree and the
    // key alone, so two committers publishing the same output write the same
    // commit, and a runner with no git identity can still publish.
    const ident = {
      GIT_AUTHOR_NAME: "cache:publish", GIT_AUTHOR_EMAIL: "cache-publish@invalid", GIT_AUTHOR_DATE: "1970-01-01T00:00:00Z",
      GIT_COMMITTER_NAME: "cache:publish", GIT_COMMITTER_EMAIL: "cache-publish@invalid", GIT_COMMITTER_DATE: "1970-01-01T00:00:00Z",
    };
    const commit = git(root, ["commit-tree", tree, "-m", `cache:publish ${step}\n\nkey: ${key}\npaths: ${paths.join(" ")}\n`], ident);
    if (opts.dryRun !== true) git(root, ["push", "--quiet", opts.remote ?? "origin", `${commit}:${ref}`]);
    return { ref, commit, tree };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

function main(argv: string[]): number {
  const root = checkoutRootFor(join(HARNESS_ROOT));
  const [cmd, ...rest] = argv;
  const flag = (name: string) => rest.includes(name);
  const list = (name: string) => {
    const i = rest.indexOf(name);
    if (i < 0) return undefined;
    const out: string[] = [];
    for (let j = i + 1; j < rest.length && !rest[j].startsWith("--"); j++) out.push(rest[j]);
    return out;
  };
  const value = (name: string) => list(name)?.[0];
  const report = (k: string | { undetermined: string }) => {
    if (typeof k === "string") { console.log(k); return 0; }
    console.log(`undetermined: ${k.undetermined}`);
    return 3;
  };

  if (cmd === "key") {
    const hf = list("--hash-files");
    if (hf !== undefined) return report(keyOf(root, { hashFiles: hf }));
    const base = flag("--base");
    const script = rest.find((a) => !a.startsWith("--"));
    if (script === undefined) { console.error("usage: cache:key [--base] <script> | --hash-files <path>..."); return 2; }
    return report(keyOf(root, { script, base }));
  }

  if (cmd === "publish") {
    const step = rest[0];
    if (step === undefined || step.startsWith("--")) { console.error("usage: cache:publish <step> [--script s | --hash-files p...] [--paths p...] [--dry-run]"); return 2; }
    const known = STEPS[step];
    const hf = list("--hash-files");
    const script = value("--script");
    const source: KeySource | undefined = hf !== undefined ? { hashFiles: hf } : script !== undefined ? { script } : known?.key;
    const paths = list("--paths") ?? known?.paths;
    if (source === undefined || paths === undefined || paths.length === 0) {
      console.error(`cache:publish: '${step}' is not in STEPS; give --script or --hash-files, and --paths`);
      return 2;
    }
    const key = keyOf(root, source);
    if (typeof key !== "string") { console.error(`cache:publish: the key is undetermined (${key.undetermined}); nothing published`); return 3; }
    const r = publish(root, step, key, paths, { dryRun: flag("--dry-run"), remote: value("--remote") });
    console.log(`${flag("--dry-run") ? "would publish" : "published"} ${step}: ${r.ref} = ${r.commit} (tree ${r.tree})`);
    return 0;
  }

  console.error("usage: cache-key.ts key <script> | key --hash-files <path>... | publish <step> [...]");
  return 2;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
