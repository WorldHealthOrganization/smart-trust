/**
 * Is one commit an ancestor of another — with "cannot tell" as its own answer.
 *
 * `git merge-base --is-ancestor A B` exits non-zero for TWO different facts:
 *
 * - **B does not descend from A.** A real answer — exit 1.
 * - **This repository cannot see enough history to say.** Not an answer. In a
 *   `--depth 1` clone the older commit is **absent**, so git exits **128 (bad
 *   object)**:
 *
 * ```
 * $ git -C shallow merge-base --is-ancestor <root> HEAD ; echo $?
 * 128                      # and <root> IS an ancestor
 * $ git -C full    merge-base --is-ancestor <root> HEAD ; echo $?
 * 0
 * ```
 *
 * A caller that reads the exit code as a boolean (a wrapper's `.ok`, or a
 * `try`/`catch`) turns 128 into "not an ancestor". CI checks out with
 * `fetch-depth`, agent containers clone `--depth 1`, and every submodule here
 * arrives shallow, so this is the normal case.
 *
 * This is the one implementation of the question; {@link resolveGitlink} in
 * `merge-base.ts` uses the same logic for the merge path.
 *
 * ## What this does NOT do
 *
 * It does not decide what `unknown` means for you: the union return makes the
 * caller branch on three cases. **Could-not-determine is never rendered as
 * clean**, nor as its negation.
 *
 * @module cat-harness/scripts/git-ancestry
 * @covers none — a git query helper; it judges no declared graph
 */
import { spawnSync } from "node:child_process";

/**
 * Three answers, because there are three.
 *
 * `unknown` carries its reason so a caller can report WHY it could not tell
 * rather than just that it could not — the difference between a finding a
 * person can act on and a shrug.
 */
export type Ancestry =
  | { known: true; ancestor: boolean }
  | { known: false; reason: string };

/** `true`/`false` only when known — otherwise the fallback, stated by the caller. */
export function ancestorOr(a: Ancestry, fallback: boolean): boolean {
  return a.known ? a.ancestor : fallback;
}

function run(repo: string, ...args: string[]) {
  return spawnSync("git", ["-C", repo, ...args], { encoding: "utf-8" });
}

function isShallow(repo: string): boolean {
  return run(repo, "rev-parse", "--is-shallow-repository").stdout?.trim() === "true";
}

/** Does `repo` have this object as a commit? */
function has(repo: string, oid: string): boolean {
  return run(repo, "cat-file", "-e", `${oid}^{commit}`).status === 0;
}

/**
 * Is `a` an ancestor of `b` in `repo`?
 *
 * Deepens a shallow repository ONCE before answering, and fetches a missing
 * object once, because the cheap failure is a history that was simply not
 * downloaded. A question still unanswerable after that is `unknown`, never
 * `false`.
 *
 * `deepen: false` for a caller that must not touch the network — it then gets
 * `unknown` rather than a guess, which is the whole contract.
 */
export function isAncestor(
  repo: string,
  a: string,
  b: string,
  opts: { deepen?: boolean } = {},
): Ancestry {
  const deepen = opts.deepen !== false;

  for (const oid of [a, b]) {
    if (has(repo, oid)) continue;
    if (!deepen) return { known: false, reason: `${oid.slice(0, 9)} is not in this checkout` };
    run(repo, "fetch", "-q", "origin", oid);
    if (!has(repo, oid)) {
      return { known: false, reason: `${oid.slice(0, 9)} could not be fetched from origin` };
    }
  }

  const ask = () => {
    const r = run(repo, "merge-base", "--is-ancestor", a, b);
    // 0 = yes, 1 = a real no, anything else is NOT an answer. 128 is the one
    // that actually occurs — a bad object on a shallow clone, measured above —
    // and `staging-cleanup` independently carries an `unevaluated` string for
    // an `--is-ancestor` that "exited 128: bad object".
    if (r.status === 0) return { known: true as const, ancestor: true };
    if (r.status === 1) return { known: true as const, ancestor: false };
    return null;
  };

  // A negative from a shallow repository is not trusted until the history is
  // whole. The 128 case is caught above by the object check, so this guards
  // the subtler one: both commits present, the path between them cut.
  // Order matters — the common case is a full clone, and a deepen is a
  // network round trip.
  const first = ask();
  if (first && (first.ancestor || !isShallow(repo))) return first;

  if (!deepen) {
    return first
      ? { known: false, reason: "a negative from a shallow repository, not deepened" }
      : { known: false, reason: "git could not evaluate the ancestry" };
  }

  if (isShallow(repo)) {
    run(repo, "fetch", "-q", "--unshallow", "origin");
    if (isShallow(repo)) run(repo, "fetch", "-q", "--deepen=2147483647", "origin");
  }

  const second = ask();
  if (!second) return { known: false, reason: "git could not evaluate the ancestry" };
  if (!second.ancestor && isShallow(repo)) {
    return { known: false, reason: "the history is shallow and could not be deepened" };
  }
  return second;
}

/**
 * Which of two commits descends from the other, if either.
 *
 * The question {@link resolveGitlink} actually asks, and the one a person
 * comparing two pins means. `"diverged"` is only ever returned on a history
 * whole enough to prove it, which is exactly the claim this module exists to
 * stop being made carelessly.
 */
export type Relation =
  | { rel: "same" }
  | { rel: "a-descends" | "b-descends" }
  | { rel: "diverged" }
  | { rel: "unknown"; reason: string };

export function relate(repo: string, a: string, b: string, opts: { deepen?: boolean } = {}): Relation {
  if (a === b) return { rel: "same" };
  const bInA = isAncestor(repo, b, a, opts);
  if (!bInA.known) return { rel: "unknown", reason: bInA.reason };
  if (bInA.ancestor) return { rel: "a-descends" };
  const aInB = isAncestor(repo, a, b, opts);
  if (!aInB.known) return { rel: "unknown", reason: aInB.reason };
  if (aInB.ancestor) return { rel: "b-descends" };
  return { rel: "diverged" };
}
