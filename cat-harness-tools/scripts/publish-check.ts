#!/usr/bin/env bun
/**
 * publish:check — the gate for a generator whose output is (partly) BUILT AT
 * PUBLISH: run it, then ask what a committed-bytes `--check` can no longer ask.
 *
 * @module scripts/publish-check
 * @covers none — it runs one declared writer and judges what it wrote; it reads no graph of its own
 *
 * An artefact a layer declares in `builtAtPublish`
 * (`@litlfred/cat-harness/schemas/kg/built-at-publish.ts`) has no committed
 * bytes: it is computed over the checkout's other layers, or from a
 * branch-kept graph, so comparing with a commit would go red on every re-pin.
 *
 * ## What it asks instead, in order
 *
 * 1. **The writer runs and exits 0** — a generator that throws is caught on the
 *    PR, not at publish.
 * 2. **The generator's own `--check` then passes against what it just wrote**,
 *    which still catches a generator that does not reach a fixed point (two
 *    runs disagree), an orphan it refuses, and every structural refusal the
 *    `--check` path already makes.
 * 3. **Every declared artefact of this writer was built**: present, and a
 *    directory not empty.
 * 4. **No COMMITTED file moved.** A generator that writes both kinds — the
 *    BPMN renderer draws this layer's own diagrams (committed, so its README
 *    renders on github.com) and other layers' (built at publish) — is still
 *    held to the committed half: any file that changed, appeared or vanished,
 *    is not under a declared path and is not ignored by ITS LAYER's own
 *    `.gitignore`, is stale (see
 *    {@link ignoredBy} for why the enclosing checkout's rules are not asked).
 *    A file in a mount but outside every path the lock mounts is not
 *    committed here either ({@link outsideMounts}).
 *
 * ```
 * bun run cat publish:check <writer-script>     # e.g. auto:docs
 * ```
 * With no declaration naming the writer it is the plain gate: the writer's
 * own `--check`, against committed bytes.
 *
 * ## It writes into a scratch copy, never into the checkout
 *
 * The writer runs in a copy of the checkout made for the run and deleted after
 * it ({@link scratchCopy}), and every question above is asked of the copy. A
 * check never writes into a mount: written files would show as "modified" to
 * `mount:remote:check`, and a machine that cannot re-clone a layer could not
 * repair it.
 *
 * Exit: 0 pass · 1 fail · 2 could not run (unknown script).
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

import { readDeclaration } from "../schemas/kg/cat-harness.ts";
import { scriptsOf } from "../schemas/sdlc/script-table.ts";
import { built, declaredPlan } from "./derive-at-publish.ts";
import { readInstances } from "./check-import-direction.ts";
import { BUILD_OUTPUT_DIRS } from "./input-hash.ts";
import { gateOwnInstances, gateOwnsFile } from "./lib/gate-own.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

const REPO_ROOT = resolve(dirname(HARNESS_ROOT));
/** Never content: install artefacts, git, and the scratch a build writes. */
// input-site: inert #062e600e — the directories a snapshot never reads; their contents never reach the answer
const SKIP_DIRS = new Set(["node_modules", ".git", "_site", "build"]);

/** sha256 of every file under each root, keyed repo-relative. */
export function snapshot(roots: readonly string[], repoRoot = REPO_ROOT): Map<string, string> {
  const rootAbs = resolve(repoRoot);
  const out = new Map<string, string>();
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      // Top-level build-output directories (`_kg/`, `dist/`, …) are written by
      // `kg:export` during `qa:refresh` with a fresh timestamp; in a content
      // root that declares a layer at `.` (`repoRoot` is in `roots`), they
      // sit at `rootAbs` without belonging to the root layer's commit.
      if (d === rootAbs && (BUILD_OUTPUT_DIRS as readonly string[]).includes(e.name)) continue;
      const abs = join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile()) out.set(relative(repoRoot, abs), createHash("sha256").update(readFileSync(abs)).digest("hex"));
    }
  };
  for (const r of roots) if (existsSync(r)) walk(resolve(r));
  return out;
}

/** Paths whose bytes differ between two snapshots: changed, added or removed. */
export function moved(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): string[] {
  const all = new Set([...before.keys(), ...after.keys()]);
  return [...all].filter((p) => before.get(p) !== after.get(p)).sort();
}

/**
 * The subset each path's OWN LAYER ignores — asked of git with that
 * layer's `.gitignore` as the only exclude file, in a scratch repository.
 *
 * Not the enclosing checkout's ignore rules: an index ignores every mount
 * wholesale (`/cat-harness/` in folio-assistant's `.gitignore`), so asking the
 * checkout would call every file in a mount ignored, and the committed half of
 * this gate would pass vacuously (measured 2026-10-14). The question is "could
 * the instance's commit contain this file", and only the layer's own rules
 * answer it. Paths are repo-relative in, and grouped by the layer root that
 * contains them (`roots`, deepest first wins).
 */
export function ignoredBy(paths: readonly string[], roots: readonly string[], repoRoot = REPO_ROOT): Set<string> {
  const out = new Set<string>();
  if (paths.length === 0) return out;
  const sorted = [...roots].map((r) => resolve(r)).sort((a, b) => b.length - a.length);
  const byRoot = new Map<string, string[]>();
  for (const p of paths) {
    const abs = resolve(repoRoot, p);
    const root = sorted.find((r) => abs.startsWith(r + sep));
    if (root === undefined) continue; // outside every layer: not a layer's commit, so never "committed" here
    byRoot.set(root, [...(byRoot.get(root) ?? []), p]);
  }
  for (const [root, ps] of byRoot) {
    // A scratch repository holding ONLY this layer's `.gitignore` files, at
    // their own relative paths, so nested ones apply exactly as they do in the
    // layer's own repository, and nothing above the layer does.
    // input-site: inert #0c7d0248 — a scratch directory, removed before this returns; its path never reaches the answer
    const scratch = mkdtempSync(join(tmpdir(), "publish-check-"));
    try {
      // input-site: inert #a52cbc90 — initialises the empty scratch repository; nothing it answers is read
      spawnSync("git", ["init", "-q"], { cwd: scratch });
      for (const g of gitignoresUnder(root)) {
        mkdirSync(dirname(join(scratch, g)), { recursive: true });
        copyFileSync(join(root, g), join(scratch, g));
      }
      const rel = ps.map((p) => relative(root, resolve(repoRoot, p)).split(sep).join("/"));
      // input-site: tree #b7962d6a — `git check-ignore --no-index` against copies of the layer's own `.gitignore` files: a function of the working tree
      const r = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], { cwd: scratch, input: rel.join("\n"), encoding: "utf-8" });
      // 0: some ignored, 1: none; anything else is "could not ask", which must not read as "none".
      if (r.status !== 0 && r.status !== 1) throw new Error(`git check-ignore failed: ${r.stderr.trim()}`);
      const hit = new Set(r.stdout.split("\n").filter(Boolean));
      rel.forEach((x, i) => hit.has(x) && out.add(ps[i]!));
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
  return out;
}

/** Every `.gitignore` under `root`, root-relative (install artefacts and `.git` skipped). */
function gitignoresUnder(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      if (e.isDirectory()) walk(join(d, e.name));
      else if (e.name === ".gitignore") out.push(relative(root, join(d, e.name)));
    }
  };
  walk(root);
  return out;
}

/** Paths outside every layer root: never a layer's committed file. */
export function outsideInstances(paths: readonly string[], roots: readonly string[], repoRoot = REPO_ROOT): Set<string> {
  const rs = roots.map((r) => resolve(r) + sep);
  return new Set(paths.filter((p) => !rs.some((r) => resolve(repoRoot, p).startsWith(r))));
}

/**
 * The subset that lies in a MOUNTED layer but outside everything its mount
 * carries: no locked directory, asset or declaration file covers it.
 *
 * A mount holds only what the lock names (`index.lock.json`, each layer's
 * `directories`, `assets` and `declaration`), so a file a writer leaves
 * anywhere else in it is not in the index and no re-pin can bring a committed
 * copy of it here. Calling it a COMMITTED artefact that moved is false, and
 * the old remedy ("run the writer and commit it") cannot work: committing it
 * upstream does not mount it (folio-assistant#2781, where `check-l1-complete`
 * wrote a trust IG's `test/results/library-qa/`, a path that IG does not
 * declare). A layer the lock does not list (this checkout's own) is not a
 * mount and is left to {@link ignoredBy}.
 */
export function outsideMounts(paths: readonly string[], repoRoot = REPO_ROOT): Set<string> {
  const out = new Set<string>();
  const lockFile = join(repoRoot, "index.lock.json");
  if (paths.length === 0 || !existsSync(lockFile)) return out;
  type Locked = { path?: string; directories?: Array<{ path: string }>; assets?: Array<{ src: string }>; declaration?: { file: string } };
  const lock = JSON.parse(readFileSync(lockFile, "utf-8")) as { instances?: Locked[] };
  const mounts = (lock.instances ?? [])
    .filter((i): i is Locked & { path: string } => typeof i.path === "string" && i.path !== "")
    .sort((a, b) => b.path.length - a.path.length);
  for (const p of paths) {
    const rel = relative(repoRoot, resolve(repoRoot, p)).split(sep).join("/");
    const m = mounts.find((i) => rel.startsWith(`${i.path}/`));
    if (m === undefined) continue;
    const carried = [
      ...(m.directories ?? []).map((d) => d.path.replace(/\/+$/, "")),
      ...(m.assets ?? []).map((a) => `${m.path}/${a.src}`),
      ...(m.declaration ? [`${m.path}/${m.declaration.file}`] : []),
    ];
    if (!carried.some((c) => rel === c || rel.startsWith(`${c}/`))) out.add(p);
  }
  return out;
}

function run(cmd: string, cwd = REPO_ROOT): number {
  // input-site: traced #120f94a1 — a writer's command line from the script table, a list no annotation can name; a run that reaches it records no hash
  inputSiteReached("publish-check: run");
  const r = spawnSync("sh", ["-c", cmd], { cwd, stdio: "inherit" });
  return r.status ?? 1;
}

/**
 * A copy of the checkout for one run, so a writer never touches the real one.
 *
 * Everything is copied except `node_modules` directories, which are linked:
 * they are installed, not authored, and copying them would multiply the cost.
 * The one exception is the top-level `node_modules/@litlfred`. Its workspace
 * links are relative (`../../cat-harness`), so they are copied as links and
 * resolve to the LAYERS IN THE COPY. Linking that folder to the original would
 * load the original layers, and a module there that locates files from its
 * own path would write into the real mounts again.
 *
 * Returns the copy's root. The caller removes it. A copy that fails partway
 * (a full disk, a FIFO in the tree) is removed here before the error is
 * rethrown: its root never reaches a caller, so nothing else could remove it,
 * and a 5 GB tree left in `os.tmpdir()` is what makes the next copy fail too.
 */
export function scratchCopy(repoRoot = REPO_ROOT): string {
  // input-site: inert #3d98cecf — the scratch copy's directory, which the caller removes; its path never reaches the answer
  const dest = mkdtempSync(join(tmpdir(), "publish-check-tree-"));
  try {
    fillScratchCopy(repoRoot, dest);
  } catch (e) {
    rmSync(dest, { recursive: true, force: true });
    throw e;
  }
  return dest;
}

function fillScratchCopy(repoRoot: string, dest: string): void {
  const linked: Array<[string, string]> = [];
  cpSync(repoRoot, dest, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (src) => {
      if (src !== repoRoot && src.split(sep).at(-1) === "node_modules") {
        linked.push([src, join(dest, relative(repoRoot, src))]);
        return false;
      }
      return true;
    },
  });
  for (const [src, to] of linked) {
    if (dirname(src) === repoRoot) {
      // The top-level install: link every package to the original, except the
      // workspace links, which stay relative so they resolve inside the copy.
      mkdirSync(to, { recursive: true });
      for (const e of readdirSync(src)) {
        if (e === "@litlfred") cpSync(join(src, e), join(to, e), { recursive: true, verbatimSymlinks: true });
        else symlinkSync(join(src, e), join(to, e));
      }
    } else {
      symlinkSync(src, to);
    }
  }
}

if (import.meta.main) {
  const writer = process.argv[2];
  const scripts = scriptsOf(REPO_ROOT);
  if (!writer || scripts[writer] === undefined) {
    console.error(`publish:check: name a package script that writes (got ${JSON.stringify(writer)})`);
    process.exit(2);
  }
  const mine = declaredPlan(REPO_ROOT).filter((a) => a.writer.includes(writer));
  if (mine.length === 0) {
    // Nothing declares this writer yet (an index pinning a cat-harness from
    // before B1, or a generator whose output is all committed): its own
    // committed-bytes --check is still the right question, so ask exactly that.
    // This is what lets the tools land BEFORE any declaration flips.
    console.log(`publish:check ${writer}: no builtAtPublish entry names it — its own --check, against committed bytes`);
    process.exit(run(`${scripts[writer]} --check`));
  }
  const work = scratchCopy(REPO_ROOT);
  // `exit` also fires after an uncaught throw; a cancelled CI job or a timeout
  // sends SIGTERM (or SIGINT), which does not reach `exit`, so those remove
  // the copy too and then exit with the signal's conventional code.
  const removeWork = () => rmSync(work, { recursive: true, force: true });
  process.on("exit", removeWork);
  for (const [sig, n] of [["SIGINT", 2], ["SIGTERM", 15]] as const) {
    process.on(sig, () => {
      removeWork();
      process.exit(128 + n);
    });
  }
  const instances = readInstances(work);
  const roots = instances.map((i) => i.root);
  // Under ANY layer's declared publish-time path or branch-stored directory
  // (e.g. `test/results/` on `qa-reports`), not only this writer's: a writer may
  // also refresh another publish-time or branch-stored artefact, and that is not
  // a commit moving.
  const declared = declaredPlan(work);
  const storedDirs = instances.flatMap((i) => {
    const decl = readDeclaration(i.root) as { directories?: Array<{ path: string; storage?: unknown }> } | undefined;
    return (decl?.directories ?? [])
      .filter((d) => d.storage !== undefined)
      .map((d) => resolve(i.root, d.path));
  });
  const under = (p: string) => {
    const abs = resolve(work, p);
    return (
      declared.some((a) => (a.path.endsWith("/") ? (abs + sep).startsWith(resolve(a.abs) + sep) : abs === resolve(a.abs))) ||
      storedDirs.some((d) => (abs + sep).startsWith(d + sep) || abs === d)
    );
  };
  const PREREQ_WRITERS: Readonly<Record<string, readonly string[]>> = {
    "navbar:include": ["docs:harness"],
    "slice:sqlite": ["docs:pages", "library:viz", "subgraph:jsonld"],
    "uml:overview": ["glossary:page"],
  };
  const prereqs = new Set<string>([
    ...declared.filter((a) => a.writer.at(-1) === writer && a.writer.length > 1).flatMap((a) => a.writer.slice(0, -1)),
    ...(PREREQ_WRITERS[writer] ?? []),
  ]);
  for (const pre of prereqs) {
    if (scripts[pre] === undefined) continue;
    const preDeclared = declared.filter((a) => a.writer.includes(pre));
    if (preDeclared.length > 0 && preDeclared.every((a) => built(a, work))) continue;
    run(`bun run cat ${pre}`, work);
  }
  const before = snapshot(roots, work);

  if (run(`bun run cat ${writer}`, work) !== 0) {
    console.error(`✗ publish:check: \`${writer}\` exited non-zero`);
    process.exit(1);
  }
  if (run(`${scripts[writer]} --check`, work) !== 0) {
    console.error(`✗ publish:check: \`${writer}\`'s own --check fails against the output it just wrote — not a fixed point, or a refusal above`);
    process.exit(1);
  }
  // In a layer's PR checks, only artefacts the caller commits (owner ruling
  // 2026-11-05, "Move the checks", generator checks included; `lib/gate-own.ts`).
  // A lower layer's committed output gone stale is that layer's to regenerate,
  // in its own CI; it is counted here, never charged to the caller.
  const ownInstances = gateOwnInstances();
  const owns = (repoPath: string) => gateOwnsFile(repoPath) !== false;
  const empty = declared.filter(
    (a) => a.writer.includes(writer) && a.writer.at(-1) === writer && a.optional !== true && !built(a, work) && (!ownInstances || ownInstances.has(a.instance)),
  );
  for (const a of empty) console.error(`✗ publish:check: ${a.instance}/${a.path} is declared built by \`${writer}\` and is missing or empty`);

  const changed = moved(before, snapshot(roots, work)).filter((p) => !under(p));
  const ignored = ignoredBy(changed, roots, work);
  const outside = outsideInstances(changed, roots, work);
  const unmounted = outsideMounts(changed, work);
  const movedCommitted = changed.filter((p) => !ignored.has(p) && !outside.has(p) && !unmounted.has(p));
  const stale = movedCommitted.filter(owns);
  const othersStale = movedCommitted.length - stale.length;
  if (othersStale > 0) {
    console.log(`· ${othersStale} committed file(s) of other layers moved too — not this caller's; their own CI judges them`);
  }
  for (const p of stale) console.error(`✗ ${p} is a COMMITTED artefact and \`${writer}\` changed it — run \`bun run cat ${writer}\` and commit it`);

  if (empty.length + stale.length > 0) process.exit(1);
  const judged = ownInstances ? mine.filter((a) => ownInstances.has(a.instance)).length : mine.length;
  console.log(
    `✓ publish:check ${writer}: ran, its --check passes on its own output, ` +
      (ownInstances ? `${judged} of ${mine.length} declared artefact(s) are the caller's and built` : `${mine.length} declared artefact(s) built`) +
      ", 0 committed file(s) moved",
  );
}
