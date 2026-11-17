#!/usr/bin/env bun
/**
 * Is this lock fresh, and do its harness pins agree with the pinned harnesses' own locks (reported; gating only with `--agreement`)?
 *
 * A layer's lock pins every harness it mounts: `mounts[]`, one
 * `{ harness, repository, ref }` each. Each pinned harness Y has its OWN
 * `index.lock.json` at its pinned commit, which pins the harnesses below it.
 * The pins disagree when the layer pins harness X at A while Y, at the commit
 * the layer pins, pins X at B and A does not contain B: A is older than B, or
 * on another line of history. Y was built and tested against X at B; mounting
 * Y with X at an older A runs Y against an X it never saw.
 *
 * ## Why "A contains B", not "A = B"
 *
 * Re-pins go upward one layer at a time: X moves, then Y re-pins X, then the
 * layer re-pins both. A layer that is AHEAD of Y on X (A descends from B) runs
 * Y against a newer X, which is what every re-pin of X does until Y follows,
 * and is what the standing re-pinner produces. Equality would fail every
 * layer between the two re-pins. A layer BEHIND Y on X is the skew that broke
 * a content layer's main (owner, 2026-11-11): the PR's fast tier was green,
 * its pins were half new mains and half old, and 7 tests failed on main until
 * a re-pin moved all five to current mains.
 *
 * ## Fresh: every pin at its repository's main, or ahead of it
 *
 * Agreement alone does not catch that skew itself: the layer pinned
 * cat-harness and cat-harness-tools AHEAD of its content core's own pins
 * of them, while the core was left at an old commit, and no lock records that a
 * lower layer moved past what an upper one was built for. So the second rule
 * (owner, 2026-11-11, card "A: Agree check + freshness"): on a pull request
 * that changes `index.lock.json`, every pinned harness is at its
 * repository's `main` HEAD as the run finds it, or at a descendant of it. A
 * pin behind main, or diverged from it, fails, naming the harness, the
 * pinned SHA, main's SHA and the fix (re-pin to main). A re-pin therefore
 * moves every layer together, which is what turned that main green.
 * "As the run finds it" is now "as the lock was written" (the next section,
 * owner, 2026-11-13, card "Lock gate", "Fresh at re-pin time").
 * `--no-freshness` judges agreement alone.
 *
 * ## Fresh at re-pin time (owner, 2026-11-13, card "Lock gate")
 *
 * "At main as the run finds it" raced the layers' own merges: with mains
 * moving every few minutes, a re-pin that was current when written went red
 * before its CI finished, because main gained a merge made after the re-pin.
 * The owner's ruling, option "Fresh at re-pin time": "Pass a pin that was
 * main when the lock was written (every commit main gained since is newer
 * than the re-pin commit). Kills the race, keeps 'all layers at main
 * together'." So the rule judges against T, the committer date of the last
 * commit that changed the lock (`git log -1 --format=%cI -- index.lock.json`
 * in the repository that holds `--lock`; merging main into the pull request
 * leaves T alone unless it touches the lock; an uncommitted lock is being
 * written now, so T is now). A pin P is fresh when it is main or descends
 * from it, or when P is behind main and every commit on main's first-parent
 * chain after P (`P..main --first-parent`) has a committer date after T: P
 * was main's tip when the lock was written. A pin behind main with a
 * first-parent commit dated at or before T was already behind when written,
 * and is stale; a diverged pin is stale. A T, or a main history, that
 * cannot be read is could-not-determine. Committer dates come from different
 * machines, so clock skew between them can move a commit to the wrong side
 * of T by that skew; that is accepted, since the window it opens is minutes
 * and the next re-pin closes it. `--at-run-time` keeps the strict rule
 * above, every pin at main as the run finds it, for an audit.
 *
 * ## Three states, never two
 *
 * A lower lock that is absent at the pin (bootstrap-tools has none) has
 * nothing to disagree with. A fetch that failed, or an ancestry git could not
 * evaluate, is `could-not-determine`, reported with its reason and never
 * read as agreement; a main that could not be read is never read as fresh.
 * Exit: 0 every pin is fresh · 1 a pin is stale · 2 neither, but something
 * could not be determined. Agreement counts toward the exit only with
 * `--agreement` (see "Only the top-level lock decides").
 *
 * ## Only the top-level lock decides (owner, 2026-11-13: "3y 1y")
 *
 * A composition mounts each harness ONCE, at the pin of the top-level index
 * (the instance being built, or the hub). The locks inside the mounted
 * layers are what each layer was last tested with on its own; they are not
 * read by the mount. Requiring them to agree with the top-level pins made
 * every re-pin a serial, bottom-up cascade, and concurrent merges kept
 * making it stale again. So agreement is REPORTED, as a note on what a lower
 * layer was last tested with, and does not fail the run. The one rule that
 * gates is freshness: a pull request that changes the lock pins every harness
 * at its main or ahead of it, so the top-level composition is current. This
 * replaces the owner's 2026-11-11 card "A: Agree check + freshness" for the
 * agreement half. The skew it guarded against (committed generated files
 * computed from an older lower layer) goes away as option 3 of the same
 * ruling moves those files from commits to build time.
 * `--agreement` restores the old gate for a one-off audit.
 *
 * ## The network
 *
 * Each repository is fetched once, with git, into a bare repository under the
 * cache directory (`--cache`, default `$RUNNER_TEMP` or the OS temp
 * directory), commits only (`--filter=tree:0`); a lower lock is read at its
 * pin with `git show`, which fetches just that tree and blob. Ancestry is
 * `git-ancestry.ts`' `relate`, so a shallow or partial history is never a
 * "no".
 *
 * Usage:
 *   bun run cat lock:coherence:check                        # ./index.lock.json: freshness gates, agreement reported
 *   bun run cat lock:coherence:check -- --agreement         # agreement gates too (an audit)
 *   bun run cat lock:coherence:check -- --no-freshness      # agreement alone, reported
 *   bun run cat lock:coherence:check -- --at-run-time       # every pin at main as the run finds it (an audit)
 *   bun run cat lock:coherence:check -- --lock <file>       # another lock file
 *   bun run cat lock:coherence:check -- --repo <owner>/<layer>@main
 *                                                           # a repository's lock at a ref, read with git
 *   bun run cat lock:coherence:check -- --changed-from <base>
 *                                                           # pass at once when index.lock.json is unchanged since <base>
 *   bun run cat lock:coherence:check -- --json              # the report as JSON
 *
 * CI: job `lock-coherence` of `layer-pr-checks.yml`, on every pull request
 * that changes the caller's `index.lock.json`.
 *
 * @module scripts/check-lock-coherence
 * @covers none — it judges a lock's pins against the pinned layers' own locks, not a declared graph typology
 * @graphNode tool
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import { relate as gitRelate, type Relation } from "./git-ancestry.ts";
import { readLockFile, repositoryOwner, resolveLockJson } from "../schemas/kg/repo-owner.ts";

/** One `mounts[]` entry of a lock. */
export interface Pin {
  harness: string;
  repository: string;
  ref: string;
}

/** A pinned harness's own lock at its pin: read, absent, or not determinable. */
export type LowerLock =
  | { state: "lock"; pins: Pin[] }
  | { state: "absent" }
  | { state: "could-not-determine"; reason: string };

/** A pair whose pins disagree: the layer pins `pinned` at `layerRef`; `via`, at its pin, pins it at `lowerRef`. */
export interface Disagreement {
  /** The harness both pin. */
  harness: string;
  repository: string;
  /** A: the layer's pin of it. */
  layerRef: string;
  /** Y: the pinned harness whose own lock disagrees. */
  via: Pin;
  /** B: Y's pin of it. */
  lowerRef: string;
  /** `behind`: A is an ancestor of B · `diverged`: neither contains the other. */
  relation: "behind" | "diverged";
  /** What makes the pair agree. */
  fix: string;
}

/** A pair, or a lower lock, whose answer could not be determined. */
export interface Undetermined {
  harness: string;
  via: Pin;
  lowerRef?: string;
  reason: string;
}

/** A pin that is not at its repository's main, nor ahead of it. */
export interface Stale {
  harness: string;
  repository: string;
  /** The lock's pin. */
  ref: string;
  /** Main's HEAD when the run looked. */
  main: string;
  /** `behind`: the pin is an ancestor of main · `diverged`: neither contains the other. */
  relation: "behind" | "diverged";
  fix: string;
  /** At re-pin time: the latest first-parent commit after the pin that main already had when the lock was written. */
  hadAtT?: MainCommit;
}

/** Main's HEAD of a repository, or why it could not be read. */
export type MainHead = { sha: string } | { reason: string };

/** A commit on main's first-parent chain, with its committer date in epoch seconds. */
export interface MainCommit {
  sha: string;
  at: number;
}

/** The first-parent commits on main after a pin (`pin..main --first-parent`), or why they could not be read. */
export type MainSince = { commits: MainCommit[] } | { reason: string };

/** When the lock was written: T, the committer date of the last commit that changed it, or why it could not be found. */
export type WrittenAt = { at: number; sha: string } | { reason: string };

/** A pin behind main that was main's tip when the lock was written. */
export interface FreshAtRepin {
  harness: string;
  ref: string;
  main: string;
  /** The oldest first-parent commit main gained after the pin, dated after T. */
  firstAfter: MainCommit;
}

/** Judge at re-pin time: T, and the first-parent commits main gained after a pin. */
export interface RepinTime {
  writtenAt: WrittenAt;
  mainSince: (pin: Pin, main: string) => MainSince;
}

export interface FreshnessReport {
  checked: number;
  fresh: number;
  stale: Stale[];
  undetermined: Undetermined[];
  /** Absent when judged at run time (`--at-run-time`). */
  writtenAt?: WrittenAt;
  /** Pins behind main now that were main when the lock was written; counted in `fresh`. */
  freshAtRepin: FreshAtRepin[];
}

const iso = (at: number) => new Date(at * 1000).toISOString().replace(".000Z", "Z");

/**
 * Judge every pin against its repository's main: at main, or descending from
 * it, is fresh. With `repin`, a pin behind main is fresh too when every
 * first-parent commit main gained after it is dated after T (see "Fresh at
 * re-pin time"); without it, the rule is at run time. Pure, as
 * {@link judgeLockCoherence}.
 */
export function judgeFreshness(
  root: readonly Pin[],
  mainOf: (pin: Pin) => MainHead,
  relate: (repository: string, a: string, b: string) => Relation,
  repin?: RepinTime,
): FreshnessReport {
  const out: FreshnessReport = { checked: 0, fresh: 0, stale: [], undetermined: [], freshAtRepin: [] };
  if (repin) out.writtenAt = repin.writtenAt;
  for (const p of root) {
    out.checked++;
    const m = mainOf(p);
    if ("reason" in m) {
      out.undetermined.push({ harness: p.harness, via: p, reason: `main of ${p.repository}: ${m.reason}` });
      continue;
    }
    const r = relate(p.repository, p.ref, m.sha);
    if (r.rel === "same" || r.rel === "a-descends") {
      out.fresh++;
      continue;
    }
    if (r.rel === "unknown") {
      out.undetermined.push({ harness: p.harness, via: p, lowerRef: m.sha, reason: `against main: ${r.reason}` });
      continue;
    }
    let hadAtT: MainCommit | undefined;
    if (repin && r.rel === "b-descends") {
      const t = repin.writtenAt;
      if ("reason" in t) {
        out.undetermined.push({ harness: p.harness, via: p, lowerRef: m.sha, reason: `behind main, and when the lock was written is unknown: ${t.reason}` });
        continue;
      }
      const since = repin.mainSince(p, m.sha);
      if ("reason" in since || !since.commits.length) {
        const why = "reason" in since ? since.reason : "no first-parent commit after the pin";
        out.undetermined.push({ harness: p.harness, via: p, lowerRef: m.sha, reason: `main's history after the pin: ${why}` });
        continue;
      }
      const before = since.commits.filter((c) => c.at <= t.at);
      if (!before.length) {
        out.fresh++;
        out.freshAtRepin.push({ harness: p.harness, ref: p.ref, main: m.sha, firstAfter: since.commits.reduce((a, c) => (c.at < a.at ? c : a)) });
        continue;
      }
      hadAtT = before.reduce((a, c) => (c.at > a.at ? c : a));
    }
    out.stale.push({
      harness: p.harness,
      repository: p.repository,
      ref: p.ref,
      main: m.sha,
      relation: r.rel === "b-descends" ? "behind" : "diverged",
      fix: `re-pin ${p.harness} to main (${m.sha}), with the other layers in the same re-pin`,
      ...(hadAtT ? { hadAtT } : {}),
    });
  }
  return out;
}

export function formatFreshness(r: FreshnessReport, label: string): string {
  const verdict = r.stale.length ? "FAILED" : r.undetermined.length ? "COULD NOT DETERMINE" : "OK";
  const t = r.writtenAt;
  const when = !t ? "at run time" : "reason" in t ? "at re-pin time, T unknown" : `at re-pin time, T = ${iso(t.at)} (${t.sha.slice(0, 12)})`;
  const lines = [
    `lock:freshness ${label} (${when}): ${verdict} — ${r.checked} pin(s), ${r.fresh} fresh` +
      (r.freshAtRepin.length ? ` (${r.freshAtRepin.length} behind main but main moved after the lock was written)` : "") +
      `, ${r.stale.length} stale, ${r.undetermined.length} undetermined`,
  ];
  for (const f of r.freshAtRepin) {
    lines.push(
      `  ✓ ${f.harness}: ${f.ref.slice(0, 12)} behind main ${f.main.slice(0, 12)}, but main moved after the lock was written ` +
        `(${f.firstAfter.sha.slice(0, 12)} at ${iso(f.firstAfter.at)} > T): fresh at re-pin time`,
    );
  }
  for (const s of r.stale) {
    lines.push(
      `  ✗ ${s.harness}: pinned at ${s.ref}, main of ${s.repository} is ${s.main} ` +
        `(${s.relation === "behind" ? "the pin is BEHIND main" : "the pin has diverged from main"}` +
        (s.hadAtT ? `; main already had ${s.hadAtT.sha.slice(0, 12)} at ${iso(s.hadAtT.at)} ≤ T, so the lock was written behind main` : "") +
        `). Fix: ${s.fix}.`,
    );
  }
  for (const u of r.undetermined) lines.push(`  ? ${u.harness}@${u.via.ref.slice(0, 12)}: ${u.reason}`);
  return lines.join("\n");
}

export interface CoherenceReport {
  /** Pairs compared: (pinned harness Y, harness X both pin). */
  compared: number;
  agree: number;
  disagreements: Disagreement[];
  undetermined: Undetermined[];
  /** Pinned harnesses with no lock at their pin: nothing to disagree with. */
  noLock: string[];
}

/** `owner/name`, lower case, with no `.git` and no `https://github.com/`: the key two locks agree on. */
export function repoKey(repository: string): string {
  return repository
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

/** The `mounts[]` of a parsed lock, read loosely: a lower layer's lock may be an older shape than this one's schema. */
export function pinsOf(lock: unknown): Pin[] {
  const mounts = (lock as { mounts?: unknown })?.mounts;
  if (!Array.isArray(mounts)) throw new Error("the lock has no mounts[] array");
  const out: Pin[] = [];
  for (const m of mounts) {
    const { harness, repository, ref } = (m ?? {}) as Record<string, unknown>;
    if (typeof harness !== "string" || typeof repository !== "string" || typeof ref !== "string") {
      throw new Error(`a mounts[] entry is not { harness, repository, ref }: ${JSON.stringify(m)}`);
    }
    out.push({ harness, repository, ref });
  }
  return out;
}

/**
 * Judge a lock's pins against the pinned harnesses' own locks.
 *
 * Pure: the lower locks and the ancestry come from the caller, so the rule is
 * tested without the network. `relate(repository, a, b)` answers as
 * `git-ancestry.ts` does: `a-descends` when b is an ancestor of a.
 */
export function judgeLockCoherence(
  root: readonly Pin[],
  lowerLock: (pin: Pin) => LowerLock,
  relate: (repository: string, a: string, b: string) => Relation,
): CoherenceReport {
  const byRepo = new Map<string, Pin>();
  for (const p of root) byRepo.set(repoKey(p.repository), p);

  const report: CoherenceReport = { compared: 0, agree: 0, disagreements: [], undetermined: [], noLock: [] };
  for (const via of root) {
    const lower = lowerLock(via);
    if (lower.state === "absent") {
      report.noLock.push(via.harness);
      continue;
    }
    if (lower.state === "could-not-determine") {
      report.undetermined.push({ harness: "*", via, reason: `its index.lock.json at ${via.ref.slice(0, 12)}: ${lower.reason}` });
      continue;
    }
    for (const low of lower.pins) {
      const key = repoKey(low.repository);
      // The layer itself, or a harness the layer does not pin: no pair.
      if (key === repoKey(via.repository)) continue;
      const mine = byRepo.get(key);
      if (!mine) continue;
      report.compared++;
      const r = relate(mine.repository, mine.ref, low.ref);
      if (r.rel === "same" || r.rel === "a-descends") {
        report.agree++;
        continue;
      }
      if (r.rel === "unknown") {
        report.undetermined.push({ harness: mine.harness, via, lowerRef: low.ref, reason: r.reason });
        continue;
      }
      report.disagreements.push({
        harness: mine.harness,
        repository: mine.repository,
        layerRef: mine.ref,
        via,
        lowerRef: low.ref,
        relation: r.rel === "b-descends" ? "behind" : "diverged",
        fix:
          r.rel === "b-descends"
            ? `re-pin ${mine.harness} to ${low.ref} or a later commit (its current main)`
            : `re-pin ${mine.harness} to a commit that contains ${low.ref} (its current main), or re-pin ${via.harness} to a commit whose lock pins ${mine.harness} at or below ${mine.ref.slice(0, 12)}`,
      });
    }
  }
  return report;
}

/**
 * 0 fresh · 1 a pin is stale · 2 none stale but some could not be determined.
 * Agreement counts only with `{ agreement: true }`: then a disagreeing pair is
 * 1 and an undetermined pair 2, as freshness (owner, 2026-11-13: only the
 * top-level lock decides).
 */
export function exitCodeOf(r: CoherenceReport, f?: FreshnessReport, opts: { agreement?: boolean } = {}): 0 | 1 | 2 {
  const agreement = opts.agreement === true;
  if ((agreement && r.disagreements.length) || f?.stale.length) return 1;
  if ((agreement && r.undetermined.length) || f?.undetermined.length) return 2;
  return 0;
}

export function formatReport(r: CoherenceReport, label: string, gates = false): string {
  const lines: string[] = [];
  const verdict = r.disagreements.length
    ? gates ? "FAILED" : "DIFFERS (reported, not a failure: only the top-level lock decides)"
    : r.undetermined.length ? "COULD NOT DETERMINE" : "OK";
  lines.push(
    `lock:coherence:check ${label}: ${verdict} — ${r.compared} pair(s) compared, ${r.agree} agree, ` +
      `${r.disagreements.length} disagree, ${r.undetermined.length} undetermined` +
      (r.noLock.length ? `; no lock at the pin: ${r.noLock.join(", ")}` : ""),
  );
  for (const d of r.disagreements) {
    lines.push(
      `  ✗ ${d.harness}: this lock pins ${d.layerRef}, but ${d.via.harness}@${d.via.ref.slice(0, 12)} pins it at ${d.lowerRef} ` +
        `(${d.relation === "behind" ? "this lock's pin is OLDER" : "the two have diverged"}). Fix: ${d.fix}.`,
    );
  }
  for (const u of r.undetermined) {
    lines.push(
      `  ? ${u.harness} via ${u.via.harness}@${u.via.ref.slice(0, 12)}` +
        (u.lowerRef ? ` (pins ${u.lowerRef.slice(0, 12)})` : "") +
        `: ${u.reason}`,
    );
  }
  return lines.join("\n");
}

// ── git ────────────────────────────────────────────────────────────────────

function git(dir: string, ...args: string[]) {
  return spawnSync("git", ["-C", dir, ...args], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
}

/** One bare, commits-only repository per remote repository, made and fetched on demand. */
export class LockReader {
  private readonly fetched = new Set<string>();
  constructor(
    private readonly cache: string,
    private readonly urlOf: (repository: string) => string = (r) => `https://github.com/${repoKey(r)}.git`,
  ) {}

  dirOf(repository: string): string {
    const dir = join(this.cache, repoKey(repository).replace("/", "__") + ".git");
    if (!existsSync(join(dir, "HEAD"))) {
      mkdirSync(dir, { recursive: true });
      spawnSync("git", ["init", "-q", "--bare", dir]);
      git(dir, "remote", "add", "origin", this.urlOf(repository));
      git(dir, "config", "remote.origin.promisor", "true");
      git(dir, "config", "remote.origin.partialclonefilter", "tree:0");
    }
    return dir;
  }

  /** Make `refs` present; a branch name is fetched to `refs/heads/<name>`. Returns the reason on failure. */
  fetch(repository: string, refs: readonly string[]): string | null {
    const dir = this.dirOf(repository);
    const want = refs.filter((r) => !this.fetched.has(`${repoKey(repository)}@${r}`));
    if (!want.length) return null;
    const specs = want.map((r) => (/^[0-9a-f]{40}$/.test(r) ? r : `+${r}:refs/heads/${r}`));
    const f = git(dir, "fetch", "-q", "--filter=tree:0", "origin", ...specs);
    if (f.status !== 0) return `git fetch ${repoKey(repository)} ${want.join(" ")} failed: ${(f.stderr || "").trim().split("\n").pop()}`;
    for (const r of want) this.fetched.add(`${repoKey(repository)}@${r}`);
    return null;
  }

  /** The commit a ref names, once fetched. */
  resolve(repository: string, ref: string): string | null {
    const r = git(this.dirOf(repository), "rev-parse", "--verify", "-q", `${/^[0-9a-f]{40}$/.test(ref) ? ref : `refs/heads/${ref}`}^{commit}`);
    return r.status === 0 ? r.stdout.trim() : null;
  }

  /** `index.lock.json` at a commit: its pins, absent, or why it could not be read. */
  lockAt(repository: string, ref: string): LowerLock {
    const why = this.fetch(repository, [ref]);
    if (why) return { state: "could-not-determine", reason: why };
    const dir = this.dirOf(repository);
    const commit = this.resolve(repository, ref) ?? ref;
    const ls = git(dir, "ls-tree", commit, "--", "index.lock.json");
    if (ls.status !== 0) return { state: "could-not-determine", reason: `git ls-tree failed: ${(ls.stderr || "").trim()}` };
    if (!ls.stdout.trim()) return { state: "absent" };
    const show = git(dir, "show", `${commit}:index.lock.json`);
    if (show.status !== 0) return { state: "could-not-determine", reason: `git show failed: ${(show.stderr || "").trim()}` };
    try {
      return { state: "lock", pins: pinsOf(resolveLockJson(JSON.parse(show.stdout), repositoryOwner(repository))) };
    } catch (e) {
      return { state: "could-not-determine", reason: `index.lock.json is not a readable lock: ${(e as Error).message}` };
    }
  }

  /** Main's HEAD of `repository`, fetched now (`--filter=tree:0`). */
  mainOf(repository: string, branch = "main"): MainHead {
    const dir = this.dirOf(repository);
    const f = git(dir, "fetch", "-q", "--filter=tree:0", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`);
    if (f.status !== 0) return { reason: `git fetch ${branch} failed: ${(f.stderr || "").trim().split("\n").pop()}` };
    const r = git(dir, "rev-parse", "--verify", "-q", `refs/remotes/origin/${branch}^{commit}`);
    return r.status === 0 ? { sha: r.stdout.trim() } : { reason: `${branch} did not resolve after the fetch` };
  }

  relate(repository: string, a: string, b: string): Relation {
    if (a === b) return { rel: "same" };
    const why = this.fetch(repository, [a, b]);
    if (why) return { rel: "unknown", reason: why };
    return gitRelate(this.dirOf(repository), a, b);
  }

  /** `pin..main --first-parent` with committer dates; commits only, which the `tree:0` fetch keeps. */
  mainSince(repository: string, pin: string, main: string): MainSince {
    const why = this.fetch(repository, [pin, main]);
    if (why) return { reason: why };
    return firstParentSince(this.dirOf(repository), pin, main);
  }
}

/** The first-parent commits of `tip` not reachable from `base`, with committer dates. */
export function firstParentSince(dir: string, base: string, tip: string): MainSince {
  const r = git(dir, "log", "--first-parent", "--format=%H %ct", `${base}..${tip}`);
  if (r.status !== 0) return { reason: `git log ${base.slice(0, 12)}..${tip.slice(0, 12)} failed: ${(r.stderr || "").trim().split("\n").pop()}` };
  const commits: MainCommit[] = [];
  for (const line of r.stdout.split("\n")) {
    const [sha, at] = line.trim().split(" ");
    if (sha && at) commits.push({ sha, at: Number(at) });
  }
  return { commits };
}

/**
 * T: the committer date of the last commit that changed `file`, in the git
 * repository that holds it (bare or not), at `rev`. A shallow checkout (CI's) is deepened
 * once, commits and trees only, when the commit found is at its boundary,
 * since there git reads the boundary as adding the file. An uncommitted
 * change is being written now, so T is now.
 */
export function lockWrittenAt(file: string, rev = "HEAD", now: () => number = () => Math.floor(Date.now() / 1000)): WrittenAt {
  const dir = dirname(file);
  const name = basename(file);
  const bare = git(dir, "rev-parse", "--is-bare-repository");
  if (bare.status !== 0) return { reason: `${dir} is not in a git repository` };
  if (bare.stdout.trim() !== "true") {
    const st = git(dir, "status", "--porcelain", "--", name);
    if (st.status === 0 && st.stdout.trim()) return { at: now(), sha: "uncommitted" };
  }
  for (let deepened = false; ; deepened = true) {
    const r = git(dir, "log", "-1", "--format=%H %ct", rev, "--", name);
    if (r.status !== 0) return { reason: `git log -- ${name} failed: ${(r.stderr || "").trim().split("\n").pop()}` };
    const [sha, ct] = r.stdout.trim().split(" ");
    if (!sha || !ct) return { reason: `no commit at ${rev.slice(0, 12)} changes ${name}` };
    const shallow = git(dir, "rev-parse", "--git-path", "shallow");
    const shallowFile = resolve(dir, shallow.stdout.trim());
    const boundary = existsSync(shallowFile) && readFileSync(shallowFile, "utf-8").split("\n").includes(sha);
    if (!boundary) return { at: Number(ct), sha };
    if (deepened) return { reason: `the history is shallow at ${sha.slice(0, 12)} and could not be deepened` };
    git(dir, "fetch", "-q", "--unshallow", "--filter=blob:none", "origin");
  }
}

// ── CLI ────────────────────────────────────────────────────────────────────

function argOf(argv: readonly string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function main(argv: readonly string[]): number {
  if (argv.includes("--help")) {
    console.log("usage: lock:coherence:check [--lock <file> | --repo <owner/name>[@<ref>]] [--changed-from <base>] [--agreement] [--no-freshness] [--at-run-time] [--cache <dir>] [--json]");
    return 0;
  }
  const cache = resolve(argOf(argv, "--cache") ?? join(process.env.RUNNER_TEMP || tmpdir(), "cat-lock-coherence"));
  const reader = new LockReader(cache);
  const repoArg = argOf(argv, "--repo");
  let root: Pin[];
  let label: string;
  let writtenAt: () => WrittenAt;

  if (repoArg) {
    const [repository, ref = "main"] = repoArg.split("@") as [string, string?];
    const l = reader.lockAt(repository, ref);
    if (l.state !== "lock") {
      console.error(`lock:coherence:check: ${repository}@${ref}: ${l.state === "absent" ? "no index.lock.json" : l.reason}`);
      return 2;
    }
    root = l.pins;
    label = `${repository}@${ref}${/^[0-9a-f]{40}$/.test(ref) ? "" : ` (${(reader.resolve(repository, ref) ?? "?").slice(0, 12)})`}`;
    const commit = reader.resolve(repository, ref) ?? ref;
    writtenAt = () => lockWrittenAt(join(reader.dirOf(repository), "index.lock.json"), commit);
  } else {
    const file = resolve(argOf(argv, "--lock") ?? "index.lock.json");
    if (!existsSync(file)) {
      console.log(`lock:coherence:check: no ${file}: nothing to check`);
      return 0;
    }
    const base = argOf(argv, "--changed-from");
    if (base) {
      const dir = resolve(file, "..");
      const d = spawnSync("git", ["-C", dir, "diff", "--quiet", base, "HEAD", "--", file]);
      if (d.status === 0) {
        console.log(`lock:coherence:check: index.lock.json is unchanged since ${base}: nothing to check`);
        return 0;
      }
    }
    try {
      root = pinsOf(readLockFile(file));
    } catch (e) {
      console.error(`lock:coherence:check: ${file}: ${(e as Error).message}`);
      return 2;
    }
    label = file;
    writtenAt = () => lockWrittenAt(file);
  }

  const report = judgeLockCoherence(
    root,
    (p) => reader.lockAt(p.repository, p.ref),
    (repo, a, b) => reader.relate(repo, a, b),
  );
  const agreement = argv.includes("--agreement");
  const freshness = argv.includes("--no-freshness")
    ? undefined
    : judgeFreshness(
        root,
        (p) => reader.mainOf(p.repository),
        (repo, a, b) => reader.relate(repo, a, b),
        argv.includes("--at-run-time")
          ? undefined
          : { writtenAt: writtenAt(), mainSince: (p, m) => reader.mainSince(p.repository, p.ref, m) },
      );
  if (argv.includes("--json")) console.log(JSON.stringify({ lock: label, ...report, freshness }, null, 2));
  else {
    console.log(formatReport(report, label, agreement));
    if (freshness) console.log(formatFreshness(freshness, label));
  }
  return exitCodeOf(report, freshness, { agreement });
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
