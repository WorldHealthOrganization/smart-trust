/**
 * Input-hash staleness skipping for `bun run cat regen` and `bun run cat gates`.
 *
 * @module scripts/input-hash
 * @graphNode none — a local-only cache helper for `regen-after-merge.ts` and `gates.ts`
 *
 * ## What it answers
 *
 * *"Has anything this verify/write pair depends on changed since the last time
 * it came back green?"* If not, `regen` skips it.
 *
 * The fingerprint of a pair is a hash over:
 *
 * - every file matched by its DECLARED inputs and outputs (`task-io.ts`) —
 *   path and content, sorted, so the order a glob walks in does not matter;
 * - the package.json command line of the check and of the writer;
 * - the source of every script those commands run, plus every module those
 *   scripts import by a relative path, transitively;
 * - `bun.lock`, so a dependency bump invalidates everything;
 * - when the declaration names {@link TRACKED}, the whole working tree as
 *   version control sees it — for the scripts that walk every layer;
 * - for every `--against <ref>` a command passes, the IDENTITY of the baseline
 *   that ref resolves to on the `qa-reports` branch (see {@link againstRefsOf}).
 *
 * ## A baseline is an input that is not in the tree
 *
 * Gates run with `--check --against main` judge the fresh run against the
 * latest `main` entry on the `qa-reports` branch, which moves while the tree
 * does not. So the baseline's identity (the resolved entry key and its
 * verified payload tree) is hashed like any other input, and a baseline that
 * cannot be resolved — offline, no branch, a corrupt entry — is undetermined,
 * so the pair runs.
 *
 * ## What it cannot see is AUDITED, not assumed
 *
 * Every fingerprint also walks the script's import closure through
 * `input-sites.ts`: a line that reads the environment, the network, the
 * clock, git history, a spawned process or a computed module must carry a
 * pinned `// input-site:` annotation, or the fingerprint is undetermined.
 * What an annotation names is then hashed here — environment VALUES, the
 * `HEAD` / ref commit ids and the shallow boundary — and every fingerprint
 * carries the `bun` and `git` versions and the variables that change how they
 * run. Under {@link TRACKED} the digest covers IGNORED files too (path, size,
 * mtime), since a directory walk reads them whether or not git does. A site no
 * check is known to reach may instead be `traced` (`input-trace.ts`): a run
 * that reaches it records nothing.
 *
 * ## "Could not determine" is never "clean"
 *
 * Every way of not knowing returns `{ undetermined: reason }`, and the caller
 * RUNS the pair:
 *
 * - the pair has no input declaration;
 * - a declared input or output glob matches **no file** (a declaration over
 *   nothing would make the fingerprint constant);
 * - a command does not resolve to script files this module can read (a binary
 *   such as `tsc`, an inline shell expression);
 * - an imported module uses a NON-LITERAL dynamic import, whose target cannot
 *   be followed.
 *
 * ## Two kinds of entry, one file
 *
 * `pairs` is regen's: a verify/write pair (check AND writer) at a green run.
 * `checks` is a CHECK SCRIPT ALONE, recorded from a run of that script that
 * exited 0 with its inputs unmoved across the run ({@link recordCheckRun}) —
 * by `gates`, or by `regen` asking the check. Both commands read it, so a
 * `gates` run after a `regen` on the same tree does not ask again, and a gate
 * listed twice in the workflow is asked once.
 *
 * ## The cache is local, never committed, and off in CI
 *
 * It lives at `build/regen-cache/input-hashes.json`, and `build/` is
 * git-ignored. A hash is recorded only for a pair that ended `current` or
 * `regenerated` in a run that reached its fixed point — a pair that was
 * skipped keeps the hash it had. `CI` set in the environment disables it, as
 * does `--no-cache`.
 *
 * CI's own skip is the CI cone (`ci-cone.ts`, not yet wired), under the same
 * rule: an input set is **declared or derived (computed from the run itself,
 * never stored), never inferred**. The cone derives each check's read set by
 * tracing main's green run, and reuses {@link fingerprint} without the tree for
 * everything else.
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { readQaManifest, type QaStoreOptions } from "./qa-store.ts";
import { auditClosure, followedSpecifier, outsideTemplates, SiteMemo } from "./input-sites.ts";
import { DeclaredImports } from "./declared-imports.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

/** Where the cache lives, relative to the repository root. `build/` is git-ignored. */
// input-site: inert #9a24257c — names a build-output directory only to leave it out of a walk
export const CACHE_FILE = join("build", "regen-cache", "input-hashes.json");

/** Bump to invalidate every recorded hash when the fingerprint's recipe changes. */
export const RECIPE_VERSION = 6;

export type Fingerprint =
  | {
      hash: string;
      files: number;
      wholeTree?: boolean;
      /** A traced fingerprint's modules reached only through a computed load, left to the trace (`auditClosure`'s `deferComputed`). */
      deferred?: string[];
    }
  | { undetermined: string };

/**
 * Resolve an `--against` ref to the identity of the baseline it names, or say
 * why it could not. Injected so tests need no `qa-reports` branch; the real
 * one is {@link qaBaselineIdentity}.
 */
export type BaselineResolver = (ref: string) => { id: string } | { undetermined: string };

/**
 * The real {@link BaselineResolver}: the `qa-reports` entry `ref` resolves to,
 * as `<key> <payloadTree>` — the same identity `qa-store` verifies an entry
 * by, so two reads that hash alike read byte-identical baselines. Not the
 * branch TIP: a tip moves on every PR publish, which would invalidate every
 * `--against main` pair for entries it never reads.
 *
 * Memoised per resolver, `unknown` included: one regen run asks the same ref
 * for several pairs, and an unreachable remote should cost one timeout, not
 * eight. Any state but a hit — `miss`, `corrupt`, `unknown` — is undetermined.
 */
export function qaBaselineIdentity(opts: QaStoreOptions = {}): BaselineResolver {
  const memo = new Map<string, { id: string } | { undetermined: string }>();
  return (ref) => {
    const hit = memo.get(ref);
    if (hit !== undefined) return hit;
    let out: { id: string } | { undetermined: string };
    if (ref === "") {
      out = { undetermined: "no ref given" };
    } else {
      try {
        const m = readQaManifest(ref, opts);
        out = m.state === "hit" ? { id: `${m.key} ${m.manifest.payloadTree}` } : { undetermined: `${m.state}: ${m.reason}` };
      } catch (e) {
        out = { undetermined: (e as Error).message };
      }
    }
    memo.set(ref, out);
    return out;
  };
}

/** What a pair declares about itself, in `task-io.ts`. */
export interface PairIO {
  inputs?: readonly string[] | undefined;
  outputs?: readonly string[] | undefined;
}

/**
 * The script files a package.json command runs, following `bun run <script>`.
 *
 * Returns `undefined` when any segment of the command runs something that is
 * not a readable script file — that is could-not-determine, not "no sources".
 */
export function entryFiles(
  root: string,
  scripts: Readonly<Record<string, string>>,
  script: string,
  seen: Set<string> = new Set(),
): string[] | undefined {
  if (seen.has(script)) return [];
  seen.add(script);
  const command = scripts[script];
  if (command === undefined) return undefined;
  const out: string[] = [];
  for (const segment of command.split(/&&|\|\||;/)) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    let found = false;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!.replace(/^["']|["']$/g, "");
      if (/\.(m?[jt]s|py|sh)$/.test(t) && existsSync(join(root, t))) {
        out.push(t);
        found = true;
      } else if (t === "run" && tokens[i - 1] === "bun" && tokens[i + 1] !== undefined) {
        // `bun run cat <name>` is the checkout-script runner (bean `ar1s` P4): the name follows it.
        const next = tokens[i + 1] === "cat" && tokens[i + 2] !== undefined ? tokens[i + 2]! : tokens[i + 1]!;
        if (scripts[next] !== undefined) {
          const nested = entryFiles(root, scripts, next, seen);
          if (nested === undefined) return undefined;
          out.push(...nested);
          found = true;
          i++;
        }
      }
    }
    if (!found) return undefined;
  }
  return out;
}

/**
 * Every `--against <ref>` (or `--against=<ref>`) the command of `script` passes,
 * following `bun run <script>` the way {@link entryFiles} does. Sorted and
 * de-duplicated. A bare `--against` with no ref is returned as `""`, which the
 * resolver cannot resolve — the script itself would refuse it, so running it
 * is the right answer.
 */
export function againstRefsOf(
  scripts: Readonly<Record<string, string>>,
  script: string,
  seen: Set<string> = new Set(),
): string[] {
  if (seen.has(script)) return [];
  seen.add(script);
  const command = scripts[script];
  if (command === undefined) return [];
  const refs = new Set<string>();
  const tokens = command.split(/\s+/).filter(Boolean).map((t) => t.replace(/^["']|["']$/g, ""));
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t === "--against") {
      const next = tokens[i + 1];
      refs.add(next === undefined || next.startsWith("--") || /^(&&|\|\||;)$/.test(next) ? "" : next);
    } else if (t.startsWith("--against=")) {
      refs.add(t.slice("--against=".length));
    } else if (t === "run" && tokens[i - 1] === "bun") {
      const name = tokens[i + 1] === "cat" ? tokens[i + 2] : tokens[i + 1];
      if (name !== undefined && scripts[name] !== undefined) for (const r of againstRefsOf(scripts, name, seen)) refs.add(r);
    }
  }
  return [...refs].sort();
}

const IMPORT_RE =
  /(?:^|[^\w$.])(?:import|export)\s[^'"`;]*?from\s*["']([^"']+)["']|(?:^|[^\w$.])import\s*["']([^"']+)["']|(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g;
const DYNAMIC_NONLITERAL_RE = /(?:^|[^\w$.])import\s*\(\s*(?!["'])[^)\s]/m;

/**
 * Source with comments that START A LINE removed — `/* … *\/` blocks and `//`
 * lines — so an `import("./x")` written in a docblock is not followed.
 * Deliberately not a tokenizer, and deliberately line-anchored: a `/*` inside a
 * string such as `"src/**\/*.md"` never starts a line, so it cannot swallow the
 * code after it. A comment that survives can only ADD an edge or an
 * undetermined — never hide a real import.
 */
export function stripComments(text: string): string {
  return text.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");
}

function resolveModule(fromFile: string, spec: string): string | undefined {
  const base = resolve(dirname(fromFile), spec);
  const candidates = [
    base,
    base.replace(/\.js$/, ".ts"),
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    join(base, "index.ts"),
    join(base, "index.js"),
  ];
  for (const c of candidates) {
    try {
      if (statSync(c).isFile()) return c;
    } catch {
      /* try the next */
    }
  }
  return undefined;
}

/**
 * Every source file reachable from `entries` by RELATIVE imports, repo-relative
 * and sorted. Bare specifiers (packages) are covered by `bun.lock` instead.
 */
export function sourceClosure(root: string, entries: readonly string[]): { files: string[] } | { undetermined: string } {
  const seen = new Set<string>();
  const stack = entries.map((e) => resolve(root, e));
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const d = directRelativeImports(file);
    if (d.doubt !== undefined) return { undetermined: `${relative(root, file)} ${d.doubt}` };
    stack.push(...d.targets);
  }
  return { files: [...seen].map((f) => relative(root, f)).sort() };
}

/**
 * The files one source file imports by a literal RELATIVE specifier,
 * absolute; a non-source file imports nothing. `doubt` says why that list may
 * be incomplete: a non-literal dynamic import, or an import that does not
 * resolve (Bun would fail to load the module). {@link sourceClosure} treats a
 * doubt as undetermined; a caller selecting tests walks what is literal.
 */
export function directRelativeImports(file: string): { targets: string[]; doubt?: string } {
  if (!/\.(m?[jt]sx?)$/.test(file)) return { targets: [] };
  const text = stripComments(outsideTemplates(readFileSync(file, "utf-8")));
  let doubt = DYNAMIC_NONLITERAL_RE.test(text) ? "has a non-literal dynamic import" : undefined;
  const targets: string[] = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!followedSpecifier(spec)) continue;
    const target = resolveModule(file, spec);
    if (target === undefined) doubt ??= `imports unresolvable ${spec}`;
    else targets.push(target);
  }
  return { targets, ...(doubt !== undefined ? { doubt } : {}) };
}

/** Expand declared globs to repo-relative files, sorted. A glob matching nothing is reported. */
export function expandGlobs(root: string, globs: readonly string[]): { files: string[] } | { undetermined: string } {
  const files = new Set<string>();
  for (const g of globs) {
    let hits = 0;
    if (!/[*?[{]/.test(g)) {
      // A plain path: a file, or a directory meaning everything under it.
      const abs = join(root, g);
      if (!existsSync(abs)) return { undetermined: `declared path ${g} does not exist` };
      if (statSync(abs).isFile()) {
        files.add(g);
        continue;
      }
      return expandGlobs(root, [...globs.filter((x) => x !== g), `${g.replace(/\/$/, "")}/**/*`]);
    }
    for (const f of new Bun.Glob(g).scanSync({ cwd: root, onlyFiles: true, dot: true })) {
      if (/(^|\/)(node_modules|\.git)\//.test(f)) continue;
      files.add(f);
      hits++;
    }
    if (hits === 0) return { undetermined: `declared glob ${g} matches no file` };
  }
  return { files: [...files].sort() };
}

/**
 * The input token that means "the whole working tree as version control sees
 * it": every tracked file's content and every untracked, non-ignored file's
 * content. For scripts that walk every layer, skill and bean — declaring a
 * narrower list for those would be a guess, and a guess that misses a file is
 * a false skip.
 */
export const TRACKED = "{tracked}";

/**
 * A digest of the working tree's tracked and untracked-but-not-ignored files.
 *
 * The digest is of CONTENT, not of git's bookkeeping: every file present is
 * entered as its path and its git blob id. An unmodified tracked file's id is
 * the one the index already holds; a modified or untracked file's is computed
 * by `git hash-object` in the checkout, so the checkout's attributes apply
 * exactly as they would on `git add`. Committing a file therefore does not
 * change the digest — measured 2026-10-06 (bean `7how`): the previous recipe
 * hashed a modified file as a sha256 and a clean one as its blob id, so the
 * merge commit `merge:main` makes turned a tree regen had just settled into
 * a "changed" one, and every `{tracked}` skip and the QA working copy's stamp
 * after it were lost. Submodules appear as their recorded commit; a submodule
 * with changes in its own tree cannot be hashed from here, so it makes the
 * digest UNDETERMINED rather than silently omitted.
 */
export function trackedTreeDigest(
  root: string,
  digests: FileDigests,
  /**
   * `false` leaves IGNORED files out — for a caller whose stamp is about the
   * SOURCE tree and whose own output is ignored (`qa-working-copy.ts`: the QA
   * copy is what it builds). A skip fingerprint always includes them.
   */
  opts: {
    ignored?: boolean;
    /**
     * Repo-relative paths (a file, or a directory and everything under it)
     * left out of the digest. For `derive:publish` (bean `0b8c`, issue #400):
     * its writers' DECLARED outputs are what each run rewrites, so a digest
     * over them would key a writer on its own last output. Never a hand-picked
     * list: the caller passes exactly the declared `builtAtPublish` paths.
     */
    exclude?: readonly string[];
  } = {},
): { hash: string } | { undetermined: string } {
  const excluded = (rel: string): boolean =>
    (opts.exclude ?? []).some((x) => {
      const d = x.replace(/\/$/, "");
      return rel === d || rel.startsWith(`${d}/`);
    });
  const git = (args: string[], stdin?: string): string | undefined => {
    // input-site: tree #e4bd9913 — ls-files listings of the index, the untracked and the ignored files, and hash-object of the files they name
    const r = Bun.spawnSync(["git", ...args], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      stdin: stdin === undefined ? undefined : new TextEncoder().encode(stdin),
    });
    return r.exitCode === 0 ? r.stdout.toString() : undefined;
  };
  const staged = git(["ls-files", "-s", "-z"]);
  const modified = git(["ls-files", "-m", "-z"]);
  const deleted = git(["ls-files", "-d", "-z"]);
  const untracked = git(["ls-files", "-o", "--exclude-standard", "-z"]);
  if (staged === undefined || modified === undefined || deleted === undefined || untracked === undefined) {
    return { undetermined: "could not list the working tree" };
  }
  const split = (s: string) => s.split("\0").filter(Boolean);
  const gone = new Set(split(deleted));
  const changed = new Set(split(modified).filter((p) => !gone.has(p)));
  const ids = new Map<string, string>();
  const toHash: string[] = [];
  for (const line of split(staged)) {
    // "<mode> <blob> <stage>\t<path>"
    const tab = line.indexOf("\t");
    const path = line.slice(tab + 1);
    const [mode, blob] = line.slice(0, tab).split(" ");
    if (gone.has(path)) continue;
    if (changed.has(path)) {
      if (mode === "160000") return { undetermined: `submodule ${path} has changes in its own tree` };
      toHash.push(path);
    } else {
      ids.set(path, `${mode === "160000" ? "commit" : "blob"} ${blob}`);
    }
  }
  // Every file is named by its git blob id, whatever its class: tracked
  // (the index), modified or untracked (`hash-object`), or ignored (the same
  // id, computed here, {@link fileForm}). A file's class depends on the
  // ignore rules THIS machine has (state:mount writes some) and on whether it
  // was committed yet, never on what it holds, so it must not move the
  // digest (RECIPE_VERSION 5).
  toHash.push(...split(untracked).filter((p) => !excluded(p)));
  if (toHash.length > 0) {
    const out = git(["hash-object", "--stdin-paths"], toHash.join("\n") + "\n");
    const got = out?.trim().split("\n") ?? [];
    if (out === undefined || got.length !== toHash.length) {
      return { undetermined: `could not hash ${toHash.length} modified or untracked file(s)` };
    }
    toHash.forEach((p, i) => ids.set(p, `blob ${got[i]}`));
  }
  // The root .gitignore without the block state:mount writes: that block
  // names where state branches are mounted on THIS machine, and the files
  // under them are hashed by content wherever they are.
  if (ids.has(".gitignore") || existsSync(join(root, ".gitignore"))) {
    try {
      ids.set(".gitignore", `file ${createHash("sha256").update(withoutStateIgnoreBlock(readFileSync(join(root, ".gitignore"), "utf-8"))).digest("hex")}`);
    } catch {
      ids.delete(".gitignore");
    }
  }
  if (opts.ignored !== false) {
    const ignored = git(["ls-files", "-o", "-i", "--exclude-standard", "--directory", "-z"]);
    if (ignored === undefined) return { undetermined: "could not list the ignored files" };
    for (const entry of split(ignored).sort()) {
      const r = ignoredDigest(root, entry, ids, digests, excluded);
      if (r !== undefined) return { undetermined: r };
    }
  }
  // One sorted list over tracked, untracked and ignored alike, so a file that
  // changes class keeps its place.
  const h = createHash("sha256");
  for (const p of [...ids.keys()].sort()) if (!excluded(p)) h.update(`${p} ${ids.get(p)}\n`);
  return { hash: h.digest("hex") };
}

/**
 * How an IGNORED path is named in the digest: `blob <git blob id>` of what
 * reading it gives (through a symlink, its target), the form a tracked or
 * untracked file has, so a file keeps its line when state:mount's ignore
 * block comes or goes. It equals `git hash-object` for any file no clean
 * filter rewrites. A symlink that resolves to nothing is `link <target>`.
 * `undefined` when it cannot be read at all.
 */
export function fileForm(root: string, rel: string, digests: FileDigests): string | undefined {
  try {
    return `blob ${digests.blobId(rel)}`;
  } catch {
    try {
      const abs = join(root, rel);
      if (lstatSync(abs).isSymbolicLink()) return `link ${readlinkSync(abs)}`;
    } catch {
      /* gone */
    }
    return undefined;
  }
}

/** The state-mounts block's markers (`state-mount.ts` STATE_IGNORE_BEGIN/END), restated: this module may not import that one. */
export const STATE_IGNORE_MARKERS = [
  "# BEGIN state mounts (generated by state:mount from the declared branch subgraphs — do not edit)",
  "# END state mounts",
] as const;

/**
 * `.gitignore` text with the state:mount block removed, markers included, and
 * the blank line `withStateIgnoreBlock` puts before an appended block. A text
 * without the block, or with unpaired markers, is returned as it is.
 */
export function withoutStateIgnoreBlock(text: string): string {
  const lines = text.split("\n");
  const begin = lines.indexOf(STATE_IGNORE_MARKERS[0]);
  const end = lines.indexOf(STATE_IGNORE_MARKERS[1]);
  if (begin < 0 || end < begin) return text;
  const before = lines.slice(0, begin);
  if (before.length > 0 && before[before.length - 1] === "" && (before.length < 2 || before[before.length - 2] !== "")) before.pop();
  const rest = [...before, ...lines.slice(end + 1)];
  const out = rest.join("\n");
  return out === "" ? "" : out.endsWith("\n") ? out : `${out}\n`;
}

/**
 * Ignored files are part of "the whole working tree" too: a check that walks a
 * directory with `readdirSync` or `Bun.Glob` reads them whether or not git
 * does — the shape of the `:pages:check` that passed locally on an untracked
 * loader and failed on a clean checkout. So each one's path and CONTENT is
 * hashed (memoised by size and mtime, like any file). Content, not mtime:
 * `gates` rebuilds the QA working copy under `test/results/` before its first
 * gate, rewriting every file with the bytes it had, and an mtime digest made
 * that rebuild invalidate every `{tracked}` check — measured 2026-10-06, a
 * warm `gates` after a warm `regen` skipped 0 of 250.
 *
 * Left out, each for a stated reason:
 * - `node_modules/` at any depth — its content is what `bun.lock` pins, and
 *   `bun.lock` is in every fingerprint;
 * - the input-hash cache itself, which every run rewrites;
 * - a directory holding its own `.git` — another checkout (an agent worktree
 *   under `.claude/worktrees/`), which is a different repository's tree.
 */
/**
 * Ignored BUILD OUTPUT directories at the top of the tree, left out of the
 * digest: every regen and gates run rewrites them (a KG export stamped with
 * its time, the qa:refresh report), so hashing them made every `{tracked}`
 * check miss — measured 2026-10-06, three such files were the whole
 * difference across a QA working-copy rebuild. Sound only because a source
 * line that names one of these directories is an input SITE (`input-sites.ts`,
 * risk `build`) and must be annotated, so a check that reads a build output is
 * refused unless a person has read that line.
 */
// input-site: inert #5e55a69c — the list of build-output directories the tree digest leaves out; it reads none of them
export const BUILD_OUTPUT_DIRS = ["build", "_kg", "_site", "dist"] as const;

function ignoredDigest(
  root: string,
  entry: string,
  ids: Map<string, string>,
  digests: FileDigests,
  excluded: (rel: string) => boolean = () => false,
): string | undefined {
  const rel = entry.replace(/\/$/, "");
  if (/(^|\/)node_modules$/.test(rel) || rel === dirname(CACHE_FILE) || rel === CACHE_FILE) return undefined;
  if ((BUILD_OUTPUT_DIRS as readonly string[]).includes(rel.split("/")[0]!)) return undefined;
  const walk = (r: string): string | undefined => {
    if (excluded(r)) return undefined;
    let st;
    try {
      st = statSync(join(root, r));
    } catch {
      return undefined; // gone between the listing and the stat: nothing to read
    }
    if (!st.isDirectory()) {
      if (r === CACHE_FILE) return undefined;
      const form = fileForm(root, r, digests);
      if (form !== undefined) ids.set(r, form); // undefined: gone between the stat and the read
      return undefined;
    }
    if (/(^|\/)node_modules$/.test(r) || r === dirname(CACHE_FILE) || existsSync(join(root, r, ".git"))) return undefined;
    let names: string[];
    try {
      names = readdirSync(join(root, r)).sort();
    } catch {
      return `could not list ignored ${r}`;
    }
    for (const n of names) {
      const bad = walk(`${r}/${n}`);
      if (bad !== undefined) return bad;
    }
    return undefined;
  };
  return walk(rel);
}

/**
 * What a `head` / `refs` site reads, named by commit id. A commit id is a hash
 * of its whole history, so "HEAD is the same commit" is "every `git log` from
 * HEAD answers the same" — except across a SHALLOW boundary, which `git fetch
 * --deepen` moves without moving HEAD; its file is hashed too. A ref that does
 * not resolve is hashed as missing, which is itself an answer the check sees.
 */
function historyLine(root: string, head: boolean, refs: readonly string[]): { line: string } | { undetermined: string } {
  // input-site: traced #b9c60d41 — the fingerprint machinery
  inputSiteReached("input-hash: history ids");
  const git = (args: string[]) => Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  let line = "";
  const names = [...(head ? ["HEAD"] : []), ...refs];
  for (const name of names) {
    const r = git(["rev-parse", "--verify", "--quiet", `${name}^{commit}`]);
    line += `ref ${name} = ${r.exitCode === 0 ? r.stdout.toString().trim() : "missing"}\n`;
  }
  const shallowPath = git(["rev-parse", "--git-path", "shallow"]);
  if (shallowPath.exitCode !== 0) return { undetermined: "could not locate the shallow file" };
  const sp = resolve(root, shallowPath.stdout.toString().trim());
  line += `shallow ${existsSync(sp) ? createHash("sha256").update(readFileSync(sp)).digest("hex") : "none"}\n`;
  return { line };
}

const RUNTIME_ENV = ["BUN_OPTIONS", "NODE_OPTIONS", "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "TZ", "LANG", "LC_ALL"] as const;

/** `bun` and `git` versions — a tool upgrade can change an answer with no file changing. */
let toolVersions: string | undefined;
export function toolsLine(): string {
  if (toolVersions === undefined) {
    // input-site: traced #69cae5db — the fingerprint machinery
    inputSiteReached("input-hash: git --version");
    const git = Bun.spawnSync(["git", "--version"], { stdout: "pipe", stderr: "pipe" });
    // The variables that change how bun or git behave for EVERY script, whatever it reads itself.
    // input-site: env BUN_OPTIONS,NODE_OPTIONS,GIT_DIR,GIT_WORK_TREE,GIT_INDEX_FILE,TZ,LANG,LC_ALL #841ddb83 — RUNTIME_ENV, hashed into every fingerprint
    const runtimeEnv = RUNTIME_ENV.map((n) => `${n}=${JSON.stringify(process.env[n] ?? null)}`).join(" ");
    toolVersions = `tools bun ${Bun.version} ${Bun.revision} ${git.exitCode === 0 ? git.stdout.toString().trim() : "git?"} ${runtimeEnv}\n`;
  }
  return toolVersions;
}

/** Memoised per-file content digests, keyed by path + size + mtime. */
export class FileDigests {
  private memo = new Map<string, { key: string; digest: string }>();
  /** The tracked-tree digest, computed at most once per layer. */
  tree: ReturnType<typeof trackedTreeDigest> | undefined;
  constructor(private root: string) {
    this.declared = new DeclaredImports(root);
  }
  digest(rel: string): string {
    const abs = join(this.root, rel);
    const st = statSync(abs);
    const key = `${st.size}:${st.mtimeMs}`;
    const hit = this.memo.get(rel);
    if (hit !== undefined && hit.key === key) return hit.digest;
    const digest = createHash("sha256").update(readFileSync(abs)).digest("hex");
    this.memo.set(rel, { key, digest });
    return digest;
  }
  private blobs = new Map<string, { key: string; id: string }>();
  /** The git blob id of a file's bytes (`git hash-object` without filters), memoised like {@link digest}. */
  blobId(rel: string): string {
    const abs = join(this.root, rel);
    const st = statSync(abs);
    const key = `${st.size}:${st.mtimeMs}`;
    const hit = this.blobs.get(rel);
    if (hit !== undefined && hit.key === key) return hit.id;
    const bytes = readFileSync(abs);
    const id = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    this.blobs.set(rel, { key, id });
    return id;
  }
  /** Per-file input-site scans (`input-sites.ts`), shared by every fingerprint of a run. */
  readonly sites = new SiteMemo();
  /** The modules a `declared` input-site verdict names, read from the declarations once per run (`declared-imports.ts`). */
  readonly declared: DeclaredImports;
  /** Forget everything — call after writers ran, since mtimes can tie within a tick. */
  clear(): void {
    this.memo.clear();
    this.blobs.clear();
    this.sites.clear();
    this.declared.clear();
    this.tree = undefined;
  }
}

/**
 * The fingerprint of one pair, or why it could not be computed.
 *
 * `scriptNames` are the npm scripts the pair runs (check, and writer if any).
 */
export function fingerprint(
  root: string,
  scripts: Readonly<Record<string, string>>,
  scriptNames: readonly string[],
  io: PairIO | undefined,
  digests: FileDigests = new FileDigests(root),
  baseline?: BaselineResolver,
  /**
   * `treeReplayed`: the caller answers git's view of the tree itself, by
   * replaying every git command the run executed (`ci-cone.ts`, bean `4rbc`),
   * so a `tree` site does not need a `{tracked}` declaration; and its
   * read set holds every module file the run opened, so the modules reached
   * only by a computed load (`input-sites.ts`, `computed`) are neither
   * audited nor hashed here: the result lists them in `deferred`, and the
   * cone audits the ones the run opened (`ci-cone.ts` `deferredInputsOf`).
   * Nothing else may pass it.
   */
  opts: { treeReplayed?: boolean } = {},
): Fingerprint {
  if (io?.inputs === undefined) return { undetermined: "no input declaration in task-io.ts" };
  const seenScripts = new Set<string>();
  const refs = [...new Set(scriptNames.flatMap((s) => againstRefsOf(scripts, s, seenScripts)))].sort();
  const baselines: string[] = [];
  for (const ref of refs) {
    if (baseline === undefined) return { undetermined: `\`--against ${ref}\` names a baseline and no resolver was given` };
    const b = baseline(ref);
    if ("undetermined" in b) return { undetermined: `baseline --against ${ref || "(no ref)"}: ${b.undetermined}` };
    baselines.push(`against ${ref} = ${b.id}\n`);
  }
  const wholeTree = io.inputs.includes(TRACKED);
  let tree: { hash: string } | undefined;
  if (wholeTree) {
    digests.tree ??= trackedTreeDigest(root, digests);
    if ("undetermined" in digests.tree) return digests.tree;
    tree = digests.tree;
  }
  const globs = [...io.inputs.filter((g) => g !== TRACKED), ...(io.outputs ?? [])];
  const declared = expandGlobs(root, globs);
  if ("undetermined" in declared) return declared;

  const entries: string[] = [];
  for (const s of scriptNames) {
    const e = entryFiles(root, scripts, s);
    if (e === undefined) return { undetermined: `\`${s}\` does not resolve to script files` };
    entries.push(...e);
  }
  // Every source the check runs is AUDITED (`input-sites.ts`): a line that can
  // read the environment, the network, the clock, git history or a computed
  // module must carry a reviewed, pinned annotation saying what it reads, or
  // the fingerprint is undetermined. Under TRACKED the files themselves are
  // already in the tree digest; the audit is what makes "the tree" the whole
  // input. A non-TypeScript script cannot be audited, so it is undetermined.
  const foreign = entries.find((e) => !/\.(m?[jt]sx?)$/.test(e));
  if (foreign !== undefined) return { undetermined: `${foreign} is not TypeScript/JavaScript, so its reads cannot be audited` };
  const audit = auditClosure(
    root,
    entries,
    digests.sites,
    undefined,
    (name) => entryFiles(root, scripts, name),
    (source) => digests.declared.resolve(source),
    opts.treeReplayed === true,
  );
  if ("undetermined" in audit) return audit;
  if (audit.needsTree && !wholeTree && opts.treeReplayed !== true) {
    return { undetermined: "a source reads the working tree through git (`tree` site), which only a {tracked} declaration covers" };
  }
  if (audit.spawnsChildren && opts.treeReplayed !== true) {
    return { undetermined: "a source runs a `bun` or `python3` child (`spawned` site), whose reads only a traced run shows" };
  }
  for (const name of audit.envUnset) {
    // input-site: traced #87c9a17e — the fingerprint machinery
    inputSiteReached("input-hash: fingerprint reads env-unset names");
    if ((process.env[name] ?? "") !== "") return { undetermined: `$${name} is set, and names something outside the tree` };
  }
  // A traced run's read set records every module file it opened, so the
  // modules it reached by a computed load are hashed there, as the ones THAT
  // run loaded; hashing every module the declarations could name would tie
  // each check to every other check's kinds and plugins (bean vgfp). Nor are
  // they audited above: the cone audits the ones a run opened, and records
  // what they read from the environment (`ci-cone.ts` `deferredInputsOf`).
  const computed = opts.treeReplayed === true ? new Set(audit.computed) : undefined;
  const closure = { files: wholeTree ? ([] as string[]) : computed === undefined ? audit.files : audit.files.filter((f) => !computed.has(f)) };

  const h = createHash("sha256");
  h.update(`recipe ${RECIPE_VERSION}\n`);
  h.update(toolsLine());
  // input-site: traced #44be6c16 — the fingerprint machinery; a check that only imports this module computes no fingerprint
  inputSiteReached("input-hash: fingerprint reads audited env");
  for (const name of audit.env) h.update(`env ${name} = ${JSON.stringify(process.env[name] ?? null)}\n`);
  if (audit.needsHead || audit.refs.length > 0) {
    const hist = historyLine(root, audit.needsHead, audit.refs);
    if ("undetermined" in hist) return hist;
    h.update(hist.line);
  }
  for (const s of scriptNames) h.update(`script ${s} = ${scripts[s]}\n`);
  h.update(`io ${JSON.stringify(io)}\n`);
  if (tree !== undefined) h.update(`tree ${tree.hash}\n`);
  for (const b of baselines) h.update(b);
  const all = new Set([...declared.files, ...closure.files]);
  if (existsSync(join(root, "bun.lock"))) all.add("bun.lock");
  const sorted = [...all].sort();
  for (const f of sorted) h.update(`${f}\0${digests.digest(f)}\n`);
  return { hash: h.digest("hex"), files: sorted.length, wholeTree: tree !== undefined, ...(audit.deferred.length ? { deferred: audit.deferred } : {}) };
}

export interface HashCache {
  version: number;
  /** Verify/write PAIR (`regen`'s key, check and writer) → fingerprint at its last green run. */
  pairs: Record<string, string>;
  /**
   * A CHECK SCRIPT ALONE → its fingerprint the last time it was RUN and
   * exited 0, by `regen` or by `gates` (bean `f017`). Shared, so a gate `regen`
   * just asked on this tree is not asked again by the `gates` run that
   * follows it, and vice versa. Absent in a cache written before it existed.
   */
  checks?: Record<string, string>;
}

/** Read the cache; anything unreadable is an empty cache, which makes every pair run. */
export function loadCache(root: string): HashCache {
  try {
    const raw = JSON.parse(readFileSync(join(root, CACHE_FILE), "utf-8")) as HashCache;
    if (raw.version === RECIPE_VERSION && typeof raw.pairs === "object" && raw.pairs !== null) {
      const checks = typeof raw.checks === "object" && raw.checks !== null ? raw.checks : {};
      return { ...raw, checks };
    }
  } catch {
    /* absent or corrupt — start empty */
  }
  return { version: RECIPE_VERSION, pairs: {}, checks: {} };
}

export function saveCache(root: string, cache: HashCache): void {
  const path = join(root, CACHE_FILE);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(cache, null, 2)}\n`);
}

/** Whether the cache may be used at all in this environment. */
export function cacheEnabled(argv: readonly string[], env: Readonly<Record<string, string | undefined>>): boolean {
  if (argv.includes("--no-cache")) return false;
  const ci = env.CI;
  if (ci !== undefined && ci !== "" && ci !== "0" && ci.toLowerCase() !== "false") return false;
  return true;
}

/** The decision for one pair, with the reason `--explain` prints. */
export type SkipDecision = { skip: true; why: string } | { skip: false; why: string };

function scope(fp: { files: number; wholeTree?: boolean }): string {
  return fp.wholeTree ? "the whole working tree" : `${fp.files} files`;
}

export function decide(cache: HashCache | undefined, key: string, fp: Fingerprint): SkipDecision {
  if (cache === undefined) return { skip: false, why: "cache disabled (--no-cache or CI)" };
  if ("undetermined" in fp) return { skip: false, why: `inputs could not be determined: ${fp.undetermined}` };
  const prev = cache.pairs[key];
  if (prev === undefined) return { skip: false, why: `no hash recorded at a previous green run (${scope(fp)})` };
  if (prev !== fp.hash) return { skip: false, why: `inputs changed since the last green run (${scope(fp)})` };
  return { skip: true, why: `inputs unchanged since the last green run (${scope(fp)})` };
}

/**
 * The fingerprint of ONE check script — what `gates` runs, and what a `regen`
 * pair's check runs — over the same inputs as {@link fingerprint}, minus any
 * writer. `io` is the script's own declaration (`task-io.ts`); without
 * `inputs` it is undetermined, so the script is always run.
 */
export function checkFingerprint(
  root: string,
  scripts: Readonly<Record<string, string>>,
  script: string,
  io: PairIO | undefined,
  digests: FileDigests = new FileDigests(root),
  baseline?: BaselineResolver,
  opts: { treeReplayed?: boolean } = {},
): Fingerprint {
  return fingerprint(root, scripts, [script], io, digests, baseline, opts);
}

/** Whether a check script may be skipped: its inputs hash to its last recorded pass. */
export function decideCheck(cache: HashCache | undefined, script: string, fp: Fingerprint): SkipDecision {
  if (cache === undefined) return { skip: false, why: "cache disabled (--no-cache or CI)" };
  if ("undetermined" in fp) return { skip: false, why: `inputs could not be determined: ${fp.undetermined}` };
  const prev = cache.checks?.[script];
  if (prev === undefined) return { skip: false, why: `no hash recorded at a previous pass of this check (${scope(fp)})` };
  if (prev !== fp.hash) return { skip: false, why: `inputs changed since this check last passed (${scope(fp)})` };
  return { skip: true, why: `inputs unchanged since this check last passed (${scope(fp)})` };
}

/**
 * Record — or forget — one RUN of a check script, in place.
 *
 * `before` is the fingerprint taken just before it ran and `after` just after
 * (with fresh digests). A hash is recorded only when the run exited 0 AND the
 * two agree: equal fingerprints mean nothing the check reads moved while it was
 * reading, so the pass is a fact about exactly the inputs that hash names. Any
 * other combination — red, undetermined, or inputs that moved underneath it
 * (a writer beside it, a person editing, the check writing its own input) —
 * DELETES the entry, so a later run cannot skip on the strength of it.
 */
export function recordCheckRun(
  cache: HashCache,
  script: string,
  passed: boolean,
  before: Fingerprint,
  after: Fingerprint,
): void {
  cache.checks ??= {};
  if (passed && "hash" in before && "hash" in after && before.hash === after.hash) cache.checks[script] = before.hash;
  else delete cache.checks[script];
}
