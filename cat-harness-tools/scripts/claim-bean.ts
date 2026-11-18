#!/usr/bin/env bun
/**
 * Claim a bean by pushing its `in-progress` status to the DEFAULT BRANCH.
 *
 * A claim committed on a feature branch is invisible to sibling sessions,
 * which read `origin/main`. This pushes the claim ALONE, built in a detached
 * `git worktree` on `origin/<default>` (removed afterwards, whatever happens),
 * so the caller's working tree is never disturbed.
 *
 * Protection cannot be detected in advance, so the push is ATTEMPTED and its
 * rejection handled:
 *
 * - **`pushed`** — the claim is on the default branch and every session sees
 *   it. Exit 0.
 * - **`already-claimed`** — somebody else holds it. Nothing is written; the
 *   holder is named. Exit 0: the question "may I take this" was answered.
 * - **`held-unknown`** — the branch was read, but who holds the bean could
 *   not be determined. Exit 4.
 * - **`fell-back`** — the push was rejected (protection, permissions). The
 *   claim is NOT on the default branch; the caller is told to claim on its
 *   branch and open a PR early. Exit 3.
 * - **`unknown`** — the default branch could not be read. Exit 2. Never
 *   rendered as "the bean is free".
 *
 * Other exits: 5 when run from a checkout other than the one doing the work
 * (override with `--any-branch`), 64 on a usage error.
 *
 * A non-fast-forward is the expected race, not a failure: it re-reads the
 * branch and retries, and may then find the bean claimed.
 *
 * After a successful push the claim COMMIT joins the caller's branch
 * ({@link joinClaim}): a fast-forward when the branch has no commits of its
 * own yet, otherwise a merge commit, so later edits to the bean merge cleanly.
 * When that cannot be done safely (a detached checkout, local edits in the
 * way, or a conflicting merge) the merge is aborted, the claim's text is
 * mirrored instead (`mirrorClaimNote`), and the outcome says so.
 *
 * Usage:
 * ```sh
 * bun run cat-harness-tools/scripts/claim-bean.ts <bean-id>            # claim on the default branch
 * bun run cat-harness-tools/scripts/claim-bean.ts <bean-id> --dry-run  # say what would happen
 * ```
 * `--repo <folio>` names the store (default: the current directory's checkout).
 *
 * @module scripts/claim-bean
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { CLOSED_STATUSES } from "./bean-store-read.ts";
import { appendNoteToText, findBean, noteBean, setFieldInText, updateBean } from "./beans-fallback.js";
import { BranchStore, resolveTipLocation, type BranchStoreOptions } from "./branch-store.ts";
import { graphReadPath } from "./graph-read.ts";
import { HOMES_LINE, originRepo, retiredBeanStore } from "./lib/bean-homes.ts";
import { TOOLS_ROOT } from "./lib/roots.ts";

/** The claim line `noteBean` just appended, exactly as it was written. */
const CLAIM_NOTE = /^_\d{4}-\d{2}-\d{2}T[\d:]+Z_ — Claimed by \S+ —.*$/m;

/** How {@link joinClaim} brought the claim to the caller's branch, or why it did not. */
export interface JoinResult {
  how: "fast-forward" | "merged" | "not-joined";
  /** Why not, when `not-joined`. */
  reason?: string;
}

/**
 * Bring the pushed claim COMMIT into the branch checked out in `repo` (bean
 * `24fa`). A fast-forward when the branch has nothing of its own, else a merge
 * commit; a merge that does not complete is aborted, so the branch is exactly
 * as it was. Never rewrites history and never forces anything.
 */
export function joinClaim(repo: string, claim: string, id: string, defaultName: string): JoinResult {
  const head = git(repo, ["symbolic-ref", "-q", "--short", "HEAD"]);
  if (head.code !== 0) return { how: "not-joined", reason: "the checkout is detached, so there is no branch to bring the claim into" };
  const ff = git(repo, ["merge", "--ff-only", "--quiet", claim]);
  if (ff.code === 0) return { how: "fast-forward" };
  const merged = git(repo, [
    "-c", "user.name=claim-bean", "-c", "user.email=noreply@anthropic.com",
    "merge", "--no-edit", "--quiet", "-m",
    `Merge the claim of ${id} from ${defaultName}\n\nBrings the claim commit into this branch so later edits to the bean merge\ncleanly (bean 24fa).`,
    claim,
  ]);
  if (merged.code === 0) return { how: "merged" };
  // Leave the branch exactly as it was: abort whatever the merge started.
  git(repo, ["merge", "--abort"]);
  const why = `${merged.err.trim()} ${merged.out.trim()}`.trim().split("\n")[0];
  return { how: "not-joined", reason: `merging ${defaultName}'s claim commit into ${head.out.trim()} did not complete (${why}); merge ${defaultName} in yourself before editing the bean` };
}

/**
 * Copy the claim note from what was PUSHED onto the local branch, byte for byte.
 *
 * Bean `24fa`. The status is already mirrored below, and for a bare claim that
 * is enough: `status` changes identically on both sides so git merges it, and
 * `updated_at` and the note are one-sided. **The conflict appears once the
 * branch edits the bean too**, which is the normal path — claim it, work it,
 * complete it. Then both sides have appended to the end of the same body and
 * both have bumped the same front-matter fields.
 *
 * Mirroring the note fixes the BODY half: with main's line already present, the
 * branch's later `## Summary of Changes` lands *after* it rather than racing
 * it. Measured by hand on #1943 — carrying this one line across took the
 * conflict from two hunks to one.
 *
 * **It must be byte-identical, which is why this copies rather than re-notes.**
 * `noteBean` stamps `nowStamp()`, so calling it again here would write a
 * different second and git would see two different additions — the opposite of
 * the intent.
 *
 * What this deliberately does NOT fix: `status` and `updated_at` once the
 * branch changes them (`in-progress` on the default branch against
 * `completed` on the branch). Both sides then differ from a merge base that
 * predates the claim, so it is a real divergence and it SHOULD be resolved by
 * a person — keep the completing branch's value, keep the note. Only moving
 * the merge base (merging the default branch in after claiming) removes it,
 * and that is the session's decision rather than this tool's.
 *
 * Now the FALLBACK, used only when {@link joinClaim} cannot bring the claim
 * commit in: it narrows the conflict, it does not remove it.
 */
export function mirrorClaimNote(repo: string, work: string, id: string): "mirrored" | "already-there" | "no-note" {
  const from = findBean(work, id);
  const onto = findBean(repo, id);
  if (!from || !onto) return "no-note";
  const note = CLAIM_NOTE.exec(readFileSync(from.path, "utf-8"))?.[0];
  if (note === undefined) return "no-note";
  const local = readFileSync(onto.path, "utf-8");
  if (local.includes(note)) return "already-there";
  writeFileSync(onto.path, `${local.replace(/\s*$/, "")}\n\n${note}\n`, "utf-8");
  return "mirrored";
}

/** How many times a non-fast-forward is re-tried before giving up. */
export const MAX_ATTEMPTS = 3;

export type ClaimState = "pushed" | "already-claimed" | "held-unknown" | "already-closed" | "new-on-branch" | "fell-back" | "unknown";

export interface ClaimOutcome {
  state: ClaimState;
  /** Branch recorded in the existing claim, when `already-claimed`. */
  heldBy?: string;
  /** The status found on the default branch, when `already-closed`. */
  closedAs?: string;
  /** Why, for `fell-back` and `unknown`. Always present for those. */
  reason?: string;
  /** Attempts spent. 2+ means a real race happened. */
  attempts: number;
  /** How a pushed claim reached the caller's branch (bean `24fa`); see {@link joinClaim}. */
  joined?: JoinResult["how"];
}

interface Ran {
  code: number;
  out: string;
  err: string;
}

function git(cwd: string, args: string[]): Ran {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", maxBuffer: 32 * 1024 * 1024 });
  if (r.error !== undefined || r.status === null) {
    return { code: -1, out: "", err: String(r.error ?? "git did not run") };
  }
  return { code: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
}

/**
 * The default branch's name, asked rather than assumed.
 *
 * `origin/HEAD` is the authoritative answer; `main` and `master` are fallbacks
 * for a clone whose remote HEAD was never fetched. Hardcoding `main` is how a
 * tool breaks silently in a repository that never adopted it.
 */
export function defaultBranch(repo: string): string | undefined {
  const sym = git(repo, ["symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD"]);
  if (sym.code === 0 && sym.out.trim() !== "") return sym.out.trim().replace(/^origin\//, "");
  for (const cand of ["main", "master"]) {
    if (git(repo, ["rev-parse", "-q", "--verify", `refs/remotes/origin/${cand}`]).code === 0) return cand;
  }
  return undefined;
}

/**
 * A remote URL a push from a TEMP WORKTREE can actually reach.
 *
 * `git remote get-url` returns the configured value verbatim, so a relative
 * local path comes back relative — and it resolves against the *worktree's*
 * directory, which is a temp dir. Measured twice: pushing by the remote NAME
 * failed, and pushing by the raw `get-url` value failed identically with
 * "'../remote.git' does not appear to be a git repository".
 *
 * A URL with a scheme (`https://`, `ssh://`, `file://`) or in scp form
 * (`git@host:owner/repo`) is already absolute and is returned untouched — which
 * is every real remote, so this only ever matters for a local mirror. It is
 * worth the six lines anyway: the failure it prevents looks like a permissions
 * problem and would be diagnosed as one.
 */
export function absoluteRemote(repo: string, configured: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(configured)) return configured;
  if (/^[^/]+@[^/]+:/.test(configured)) return configured;
  return resolve(repo, configured);
}

/** `status:` and any `Claimed by <branch>` note, as the DEFAULT BRANCH has them. */
function statusOnBranch(
  repo: string,
  branch: string,
  beanPath: string,
): { status?: string; heldBy?: string } | { absent: true } | { reason: string } {
  const show = git(repo, ["show", `origin/${branch}:${beanPath}`]);
  if (show.code !== 0) {
    // A bean that exists here and NOT on the default branch is a determined
    // state, not a failure to read one: it is new on this branch. Git says so
    // explicitly, and conflating it with "could not read" was measured — the
    // common case of `beans create` followed immediately by a claim reported
    // COULD NOT DETERMINE, which is the one reading this tool must never give
    // when it actually knows the answer.
    if (/exists on disk, but not in|does not exist in|path .* does not exist/i.test(`${show.err}${show.out}`)) {
      return { absent: true };
    }
    return { reason: `git show origin/${branch}:${beanPath} exited ${show.code}: ${show.err.trim()}` };
  }
  const status = /^status:\s*(\S+)\s*$/m.exec(show.out)?.[1];
  const heldBy = /Claimed by (\S+)/.exec(show.out)?.[1];
  return { status, heldBy };
}

/**
 * Claim `id` on the default branch, or report why not.
 *
 * `branch` is recorded in the claim note so a sibling can see WHO holds it —
 * a claim that does not say who made it cannot be told from an abandoned one.
 */
/**
 * Claim a bean on the BRANCH STORE — the post-cutover path.
 *
 * ## Why this exists, and why it is not a port
 *
 * #2042 landed a REFUSAL for the cut-over case and said so in its own words:
 * *"Claim through the branch store instead (bean `9ofm`: this script's own
 * migration row is still open)."* #2052 then named the consequence as the last
 * hard blocker on the cutover, correctly: `AGENTS.md`, `bean-coordination` and
 * the session-start sweep all require a claim before durable work, so a
 * repository where claiming is impossible is worse than one where it races.
 * The owner ruled 2026-10-04 that claims move *"when the readers and writers
 * are all ready for cutover"* — which is now.
 *
 * ## It is STRONGER than the default-branch path, not a fallback
 *
 * {@link claimOnDefaultBranch} fetches, commits and pushes, and detects a race
 * by losing one and retrying — up to {@link MAX_ATTEMPTS} times, reporting
 * `fell-back` when every attempt loses. The branch store carries `expect` (the
 * blob id this reader saw) on the write, so a sibling that got there first is
 * a **`conflict` on the first attempt**, atomically, with the competing blob
 * named. That is bean `35nj`'s race detected rather than survived.
 *
 * `attempts` is therefore 1 on this path, and that is not a cosmetic
 * difference: `attempts: 2+` on the old path means "a real race happened", and
 * here a real race is a `conflict` instead.
 *
 * **`fell-back` cannot arise here, and must not.** It means "the claim is on
 * this branch only" — and after the cutover a PR branch has no `beans/` to
 * hold one, so returning it would be a lie about where the claim is. #2052
 * raised exactly this. The states this path can return are `pushed`,
 * `already-claimed`, `already-closed`, `new-on-branch` and `unknown`.
 *
 * ## What it writes
 *
 * The bytes come from {@link setFieldInText} and {@link appendNoteToText} —
 * the same transforms the filesystem writer uses, extracted for this. The
 * store's contract is *"it is the same store, not a shadow copy"*, and the
 * only way a second writer keeps it is by sharing the transform rather than
 * reimplementing it: what lands here has to read back cleanly under the CLI.
 *
 * Everything is read from the BRANCH, including `beans.json` — so a claim
 * works whether or not this checkout has a mount.
 */
export function claimOnBranchStore(
  id: string,
  branch: string,
  opts: { repo?: string; dryRun?: boolean; store?: BranchStoreOptions } = {},
): ClaimOutcome {
  const repo = opts.repo ?? process.cwd();
  const unknown = (reason: string): ClaimOutcome => ({ state: "unknown", reason, attempts: 0 });

  let loc;
  try {
    loc = resolveTipLocation("beans", repo, "tip");
  } catch (e) {
    return unknown(`the bean graph is not a tip-keyed branch store here: ${(e as Error).message}`);
  }

  // A store that keeps no beans any more (#459): say where the bean lives
  // instead of reporting it missing, so the claim goes to its one home.
  const target = loc.repository ?? originRepo(repo);
  if (retiredBeanStore(target, loc.branch)) return unknown(`${target} ${loc.branch} keeps no beans any more; claim ${id} from a checkout of its home: ${HOMES_LINE}`);

  // `opts.store` is passed through for the same reason `mountTip` takes one:
  // the interesting behaviour here is what happens when a sibling writes
  // BETWEEN this read and this write, and `beforePush` is the only honest way
  // to stage that — otherwise the conflict branch is unreachable from a test
  // and the race detection is a claim rather than a verified property.
  // `BranchStore.open` THROWS on a repository with no `origin` (and on a
  // malformed branch name). `beans:claim` crashing with a stack trace instead
  // of reporting its third state is the failure this whole arc has been
  // removing, so it is caught and reported — found by the test that pins the
  // dispatch, which runs against a fixture with no remote.
  let store;
  try {
    store = BranchStore.open(loc.branch, { repoRoot: repo, log: () => {}, ...opts.store });
  } catch (e) {
    return unknown(`could not open the branch store for ${loc.branch}: ${(e as Error).message}`);
  }

  // The graph's own declaration, read FROM THE BRANCH: `beans/beans.json` says
  // where `defs` is within the graph, and after the cutover that file is only
  // on the branch. Composing `defs` here instead would be the second spelling
  // this arc has spent five PRs removing.
  const graph = store.readJson<{ directories?: Array<{ path: string; graphTypologies?: string[] }> }>(`${loc.path}/beans.json`);
  if (graph.state !== "hit") return unknown(`could not read ${loc.path}/beans.json on ${loc.branch}: ${graph.reason}`);
  const defs = graph.value.directories?.find((d) => (d.graphTypologies ?? []).includes("bean-defs"));
  if (!defs) return unknown(`${loc.path}/beans.json on ${loc.branch} declares no \`bean-defs\` directory`);
  const defsPath = `${loc.path}/${defs.path.replace(/\/+$/, "")}`;

  const dir = store.listDir(defsPath);
  if (dir.state !== "hit") return unknown(`could not list ${defsPath} on ${loc.branch}: ${dir.reason}`);
  // Accept the bare suffix as well as the full prefixed id, for the reason
  // `findBean` gives: an agent reading a report sees `p4vj`, not
  // `folio-assistant-p4vj`.
  const file =
    dir.entries.find((e) => e.type === "blob" && e.name.startsWith(`${id}--`)) ??
    dir.entries.find((e) => e.type === "blob" && /--/.test(e.name) && e.name.split("--")[0]!.endsWith(`-${id}`));
  if (!file) return unknown(`no bean matching "${id}" on ${loc.branch} under ${defsPath}`);

  const path = `${defsPath}/${file.name}`;
  const read = store.readFile(path);
  if (read.state !== "hit") return unknown(`could not read ${path} on ${loc.branch}: ${read.reason}`);

  const status = /^status:[ \t]*(.*)$/m.exec(read.text)?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
  if (CLOSED_STATUSES.has(status)) return { state: "already-closed", closedAs: status, attempts: 1 };
  if (status === "in-progress") {
    // Who holds it, from the claim note the writer below leaves. Reported
    // rather than guessed: this cannot tell a live sibling from a claim
    // abandoned five days ago, and inventing a staleness threshold would need
    // a basis nothing here has — the same rule the default-branch path states.
    const held = /Claimed by ([^\s—]+)/.exec(read.text)?.[1];
    return held ? { state: "already-claimed", heldBy: held, attempts: 1 } : { state: "held-unknown", attempts: 1 };
  }

  if (opts.dryRun === true) {
    return { state: "pushed", reason: `would claim ${id} on ${loc.branch} (currently ${status || "unknown"})`, attempts: 1 };
  }

  const next = appendNoteToText(
    setFieldInText(read.text, "status", "in-progress"),
    `Claimed by ${branch} — pushed to ${loc.branch} so sibling sessions see it before this branch has a PR (bean 35nj).`,
  );

  const w = store.write(
    [{ path, content: next, expect: read.blob }],
    `beans(${id}): claim in-progress from ${branch}\n\nClaim only, no work. Spliced onto ${loc.branch} with \`expect\` so a\nsibling that claimed first is a conflict rather than a lost write. Bean 35nj.`,
  );

  switch (w.state) {
    case "pushed":
      return { state: "pushed", attempts: w.attempts };
    case "unchanged":
      // The tip already carries these exact bytes. Someone claimed it for this
      // same branch; idempotent, so report it as done rather than as a race.
      return { state: "pushed", reason: "already in-progress for this branch on the tip", attempts: w.attempts };
    case "conflict":
      // THE RACE, caught on the first attempt. `expect` named the blob this
      // reader saw and the tip disagrees, so a sibling wrote between the read
      // and the write — which is exactly what bean `35nj` is about.
      return {
        state: "already-claimed",
        reason: `a sibling wrote ${path} on ${loc.branch} between this read and this write (expected ${read.blob.slice(0, 12)})`,
        attempts: w.attempts,
      };
    default:
      return { state: "unknown", reason: `${w.state} writing ${path} to ${loc.branch}: ${w.reason}`, attempts: w.attempts };
  }
}

export function claimOnDefaultBranch(id: string, branch: string, opts: { repo?: string; dryRun?: boolean } = {}): ClaimOutcome {
  const repo = opts.repo ?? process.cwd();

  // PRE-FLIGHT: is the default branch still where the bean store is?
  //
  // Bean `9ofm` row D. This whole mechanism is "push the claim to the DEFAULT
  // branch so a sibling session sees it before this branch has a PR" (bean
  // `35nj`). Once the bean graph is cut over to `cat/cat-harness/beans`, the
  // default branch no longer holds the store — so that push would land a claim
  // where no reader looks. Silent, and worse than not claiming at all: the
  // sibling reads `todo`, starts the same work, and `35nj`'s measured cost
  // (two sessions, 61 seconds apart, two PRs for one bean) comes back with the
  // guard that was supposed to stop it reporting success.
  //
  // `notCutOver` is the discriminator, and it is why that field exists: a
  // declaration naming the branch while the checkout still tracks the files
  // means the default branch IS the store, so today's behaviour is correct and
  // unchanged. A MOUNT, or an unreachable graph, means it is not.
  const where = graphReadPath("beans", repo);
  // CUT OVER → the branch store, which is where the beans now are. This was a
  // refusal in #2042 and is a WRITER since the owner's 2026-10-04 ruling that
  // claims move "when the readers and writers are all ready for cutover".
  // Dispatching here rather than at the call sites keeps `beans:claim` one
  // command: nothing a contributor runs changes at the cutover.
  //
  // `notCutOver` deliberately stays on the default branch: the declaration
  // names the branch but the checkout still tracks the files, so the default
  // branch IS the store and today's behaviour is correct.
  if (where.state === "refused" || (where.state === "ok" && where.from === "mount")) {
    return claimOnBranchStore(id, branch, opts);
  }

  const local = findBean(repo, id);
  if (local === undefined) {
    return { state: "unknown", reason: `no bean matching "${id}" in this store`, attempts: 0 };
  }
  const beanPath = local.path.startsWith(repo) ? local.path.slice(repo.length + 1) : local.path;

  const def = defaultBranch(repo);
  if (def === undefined) {
    return { state: "unknown", reason: "could not determine the default branch (no origin/HEAD, no origin/main or origin/master)", attempts: 0 };
  }

  let attempts = 0;
  let lastReason = "";
  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;

    const fetched = git(repo, ["fetch", "--quiet", "origin", def]);
    if (fetched.code !== 0) {
      return { state: "unknown", reason: `git fetch origin ${def} exited ${fetched.code}: ${fetched.err.trim()}`, attempts };
    }

    const onBranch = statusOnBranch(repo, def, beanPath);
    if ("reason" in onBranch) return { state: "unknown", reason: onBranch.reason, attempts };
    // Nobody else can see this bean yet, so there is nothing to race over and
    // nothing a pushed claim would tell them. Pushing the bean itself would be
    // pushing WORK to the default branch, which is not what a claim is.
    if ("absent" in onBranch) return { state: "new-on-branch", attempts };

    // Finished or deliberately rejected work is not claimable by accident.
    //
    // Found by running `--dry-run` against the real store: the tool offered to
    // claim a `completed` bean without comment. Re-opening finished work is bad;
    // re-entering a `scrapped` one is worse, because a scrapped bean exists
    // precisely to record that something was considered and rejected so the next
    // agent does not walk back into it (`AGENTS.md`, and never deleting a bean
    // is the same reasoning). Re-opening either is a real decision, so it must
    // be deliberate rather than a side effect of asking to claim.
    if (onBranch.status === "completed" || onBranch.status === "scrapped") {
      return { state: "already-closed", closedAs: onBranch.status, attempts };
    }

    // Somebody else holds it. Not an error — the question was answered.
    if (onBranch.status === "in-progress" && onBranch.heldBy !== undefined && onBranch.heldBy !== branch) {
      return { state: "already-claimed", heldBy: onBranch.heldBy, attempts };
    }
    // Ours already: idempotent, nothing to push.
    if (onBranch.status === "in-progress" && onBranch.heldBy === branch) {
      return { state: "pushed", attempts };
    }
    // In progress, and NOBODY RECORDED A HOLDER. This arm used to fall in with
    // the one above — `heldBy === branch || heldBy === undefined` — on the
    // reading that both are "ours, idempotent". They are not the same thing.
    //
    // `heldBy === branch` is a determined answer: we hold it. `heldBy ===
    // undefined` is *could not determine who holds it*, and the merged version
    // rendered it as `✓ claimed … every session can see it now` while pushing
    // nothing and warning nobody — could-not-determine wearing the costume of a
    // determined answer, which is the failure this file already refuses twelve
    // lines above for `absent`.
    //
    // It is not a rare arm. Measured on `origin/main` 2026-09-25: of the 100
    // non-epic beans marked `in-progress`, **97 record no holder**, because
    // `todo-manager.md` and `session-intent.md` still tell an agent to claim
    // with `beans update <id> --status in-progress`, which writes no note. So
    // the check that exists to stop claim-stomping answered "go ahead" for 97 %
    // of the store it was guarding.
    //
    // Reported rather than guessed either way: this cannot tell a live sibling
    // from a claim abandoned five days ago, and inventing a staleness threshold
    // would need a basis nothing here has.
    if (onBranch.status === "in-progress") {
      return { state: "held-unknown", attempts };
    }

    if (opts.dryRun === true) {
      return { state: "pushed", reason: `would claim ${id} on ${def} (currently ${onBranch.status ?? "unknown"})`, attempts };
    }

    const work = mkdtempSync(join(tmpdir(), "claim-bean-"));
    try {
      const added = git(repo, ["worktree", "add", "--quiet", "--detach", work, `origin/${def}`]);
      if (added.code !== 0) {
        return { state: "unknown", reason: `git worktree add exited ${added.code}: ${added.err.trim()}`, attempts };
      }
      // The store's own writers, so what lands is byte-identical to what the
      // CLI would write and reads back cleanly.
      updateBean(work, id, { status: "in-progress" });
      noteBean(work, id, `Claimed by ${branch} — pushed to ${def} so sibling sessions see it before this branch has a PR (bean 35nj).`);

      const staged = git(work, ["add", "--", beanPath]);
      if (staged.code !== 0) {
        return { state: "unknown", reason: `git add exited ${staged.code}: ${staged.err.trim()}`, attempts };
      }
      const committed = git(work, [
        "-c", "user.name=claim-bean",
        "-c", "user.email=noreply@anthropic.com",
        "commit", "--quiet", "-m",
        `beans(${id}): claim in-progress from ${branch}\n\nClaim only, no work. Pushed to ${def} so a sibling session sees it\nimmediately rather than when this branch opens a PR. Bean 35nj.`,
      ]);
      if (committed.code !== 0) {
        return { state: "unknown", reason: `git commit exited ${committed.code}: ${committed.err.trim()}`, attempts };
      }

      // Push to the RESOLVED URL, not to the remote NAME.
      //
      // A worktree inherits the repository's config, so `origin` is in scope —
      // but a remote configured with a RELATIVE path (`../remote.git`, common
      // for a local mirror or a submodule-style checkout) resolves against the
      // worktree's own directory, which is a temp dir somewhere else entirely.
      // Measured: the push died with "'../remote.git' does not appear to be a
      // git repository" while the same remote worked from the main checkout.
      // For an absolute URL this is identical; for a relative one it is the
      // difference between working and not.
      const configured = git(repo, ["remote", "get-url", "origin"]).out.trim();
      if (configured === "") {
        return { state: "unknown", reason: "no `origin` remote to push the claim to", attempts };
      }
      const target = absoluteRemote(repo, configured);
      const pushed = git(work, ["push", target, `HEAD:refs/heads/${def}`]);
      if (pushed.code === 0) {
        // BRING THE CLAIM INTO THIS BRANCH (bean `24fa`, owner option 1). The
        // claim landed on the default branch; until the branch has that commit
        // in its history, the branch's next edit to the bean conflicts with it,
        // and a conflicted PR gets no CI. See `joinClaim`.
        const claim = git(work, ["rev-parse", "HEAD"]).out.trim();
        const joined = joinClaim(repo, claim, id, def);
        if (joined.how !== "not-joined") return { state: "pushed", attempts, joined: joined.how };
        // FALLBACK: today's text mirror. Without at least this, committing the
        // branch's stale `todo` and merging would REVERT the claim (measured on
        // `t373`). Not committed: the session decides what to commit.
        try {
          updateBean(repo, id, { status: "in-progress" });
          mirrorClaimNote(repo, work, id);
        } catch {
          // The push already succeeded, which is the durable half. A local
          // write failing is worth reporting, not worth undoing a landed claim.
          return { state: "pushed", attempts, joined: "not-joined", reason: `${joined.reason}; and the local copy could not be updated — \`git fetch\` and check before committing this bean` };
        }
        return { state: "pushed", attempts, joined: "not-joined", reason: joined.reason };
      }

      const why = `${pushed.err.trim()}\n${pushed.out.trim()}`.trim();
      lastReason = `git push ${target} HEAD:${def} exited ${pushed.code}: ${why}`;
      // A non-fast-forward means somebody else's commit landed first. Retry —
      // the next read may find the bean claimed by them, which is the answer.
      if (/non-fast-forward|fetch first|rejected.*\(fetch first\)|stale info/i.test(why)) continue;
      // Anything else (protection, 403, no write access) will not improve.
      return { state: "fell-back", reason: lastReason, attempts };
    } finally {
      git(repo, ["worktree", "remove", "--force", work]);
      rmSync(work, { recursive: true, force: true });
    }
  }
  return { state: "fell-back", reason: `${MAX_ATTEMPTS} attempts all lost the race. Last: ${lastReason}`, attempts };
}

/**
 * Why a claim made from this checkout would be recorded against the wrong
 * work — or `undefined` when the checkout looks like the one doing it.
 *
 * Bean `ssfp`. The store defaults to the current directory, and a bean store
 * exists at EVERY checkout of the repository, so a claim run from the wrong
 * tree finds the bean, succeeds, records that tree's branch as the holder and
 * leaves the local status edit there as unexplained dirt. Nothing noticed.
 *
 * The tell is the branch. Work happens on a work branch; a checkout sitting on
 * the default branch, or detached, is not where anybody's work is — it is the
 * main checkout doing something else, or a scratch tree. So a claim from one is
 * refused, naming the tree it was about to write to, rather than attributed to
 * a branch that holds no work.
 */
export function wrongCheckout(root: string, branch: string): string | undefined {
  if (branch === "(detached)" || branch === "HEAD") {
    return `${root} has a detached HEAD, so the claim would name no branch as its holder`;
  }
  const def = defaultBranch(root);
  if (def !== undefined && branch === def) {
    return `${root} is on '${def}', the default branch, which holds nobody's work`;
  }
  return undefined;
}

export function describe(o: ClaimOutcome, id: string): string {
  switch (o.state) {
    case "pushed":
    {
      const claimed = `claimed ${id} on the default branch — every session can see it now${o.attempts > 1 ? ` (after ${o.attempts} attempts; a sibling claim landed mid-flight)` : ""}`;
      if (o.joined === "fast-forward" || o.joined === "merged") {
        return `${claimed}, and the claim commit is in this branch (${o.joined === "merged" ? "merge commit" : "fast-forward"}), so later edits to the bean merge cleanly`;
      }
      return o.reason === undefined ? claimed : `${claimed} — but NOT in this branch's history: ${o.reason}`;
    }
    case "held-unknown":
      return (
        `${id} is already in-progress on the default branch, and NOBODY RECORDED A HOLDER — so this cannot tell
` +
        `  a sibling working it right now from a claim somebody abandoned. NOT claimed, and nothing was written.
` +
        `  Read the bean and the open PR list before you take it. If it is genuinely free, claim it on your branch
` +
        `  (\`beans update ${id} --status in-progress\`) and open the PR at your FIRST commit.`
      );
    case "already-closed":
      return (
        `${id} is ${o.closedAs} on the default branch — NOT claimed, deliberately.\n` +
        `  ${o.closedAs === "scrapped"
          ? "A scrapped bean records that something was considered and REJECTED, which is what stops the next session re-entering the same dead end. Read its reasons before reviving it."
          : "It is finished work. Re-opening it is a decision, not a claim."}\n` +
        `  If you do mean to revive it, set the status yourself and say why in the bean.`
      );
    case "new-on-branch":
      return (
        `${id} is not on the default branch yet — it is new on this branch, so no sibling session can see it ` +
        `and there is nothing to race over. Claim it locally (\`beans update ${id} --status in-progress\`); ` +
        `it becomes visible when this branch's PR opens, which is why AGENTS.md says open the PR at the FIRST commit.`
      );
    case "already-claimed":
      return `${id} is ALREADY CLAIMED by ${o.heldBy}. Nothing written. Pick another item, or talk to that session before touching this one.`;
    case "fell-back":
      return (
        `could NOT push the claim to the default branch, so ${id} is NOT claimed anywhere a sibling can see.\n` +
        `  reason: ${o.reason}\n` +
        `  do this instead: claim it on your branch (\`beans update ${id} --status in-progress\`) and open the PR at your FIRST commit,\n` +
        `  which is what makes a branch-local claim visible at all. See work-plan/skills/work-plan/bean-coordination.md.`
      );
    case "unknown":
      return `COULD NOT DETERMINE whether ${id} is claimable: ${o.reason}. This is not "the bean is free" — do not start work on that reading.`;
  }
}

/** `unknown` is 2, a failed push is 3, a live claim by somebody else is 0. */
export function exitCodeFor(o: ClaimOutcome): 0 | 2 | 3 | 4 {
  if (o.state === "unknown") return 2;
  if (o.state === "fell-back") return 3;
  // Its own code, and neither of its neighbours.
  //
  // Not 0, which `already-claimed` uses: that one is a DETERMINED refusal and
  // tells the caller to go pick another item. This one cannot tell them even
  // that, so a script treating 0 as "carry on" must not get it.
  //
  // Not 2 either: the default branch was read perfectly well. What could not be
  // determined is who holds the bean, not whether the remote could be reached,
  // and collapsing the two would make a readable remote look unreadable.
  if (o.state === "held-unknown") return 4;
  return 0;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const repoAt = argv.indexOf("--repo");
  const repo = repoAt >= 0 ? argv[repoAt + 1] : undefined;
  if (repoAt >= 0 && (repo === undefined || repo.startsWith("-"))) {
    console.error("--repo needs a path");
    process.exit(64);
  }
  // `repoAt + 1` is only the value slot when `--repo` is actually present;
  // guarding on `repoAt >= 0` matters because -1 + 1 is 0, which silently ate
  // the id itself — measured, the CLI printed its own usage on a valid call.
  const id = argv.filter((a, i) => !a.startsWith("-") && !(repoAt >= 0 && i === repoAt + 1))[0];
  if (id === undefined) {
    console.error(
      `usage: bun run ${TOOLS_ROOT}/scripts/claim-bean.ts <bean-id> [--repo <folio>] [--dry-run] [--any-branch]\n` +
        "       the store defaults to the CURRENT DIRECTORY, because beans live in the folio, not the platform",
    );
    process.exit(64);
  }
  // The checkout's TOP LEVEL, not the literal directory: run from a subdirectory
  // the store would otherwise not be found, and a worktree's top level is the
  // worktree — which is the tree this claim is about (bean `ssfp`).
  const start = repo ?? process.cwd();
  const top = git(start, ["rev-parse", "--show-toplevel"]).out.trim();
  const root = top !== "" ? top : start;
  const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).out.trim() || "(detached)";
  const wrong = wrongCheckout(root, branch);
  if (wrong !== undefined && !argv.includes("--any-branch")) {
    console.error(
      `✗ not claiming ${id}: ${wrong}.\n` +
        "  A claim records the branch holding the work. Run it from the worktree doing the work,\n" +
        "  or pass --repo <that worktree>. --any-branch overrides, for a claim that really is made from here.",
    );
    process.exit(5);
  }
  console.log(`  claiming from ${root} (branch ${branch})`);
  const outcome = claimOnDefaultBranch(id, branch, { repo: root, dryRun: argv.includes("--dry-run") });
  const code = exitCodeFor(outcome);
  (code === 0 ? console.log : console.error)(`${code === 0 ? "✓" : "✗"} ${describe(outcome, id)}`);
  process.exit(code);
}
