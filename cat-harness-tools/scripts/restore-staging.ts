#!/usr/bin/env bun
/**
 * Carry the open PRs' `branches/` previews across a full-replace `gh-pages` deploy.
 *
 * ## The defect this exists for — bean `plj1`
 *
 * `peaceiris/actions-gh-pages@v4` with `keep_files: false` and no
 * `destination_dir` does exactly this at push time (its own
 * `src/git-utils.ts`, `setRepo`):
 *
 * ```
 * git clone --depth=1 --single-branch --branch gh-pages <remote> workDir
 * git rm -r --ignore-unmatch '*'      # ← everything on the branch, branches/ included
 * cp -R publish_dir/* workDir/
 * ```
 *
 * `docs-site.yml` is the ONLY `gh-pages` publisher in this repository without
 * `keep_files: true` — measured against all six, 2026-09-19 — and it is the one
 * that fires on every push to `main` touching `docs/`, `processes/`,
 * `schemas/` or four scripts. So the most frequently run publisher was the only
 * one that wiped, and what it wiped was every open PR's review preview.
 *
 * Measured on the real `gh-pages` history, 2026-09-19 — every `docs(gh-pages)`
 * commit in the window deleted every preview its own parent carried:
 *
 * | deploy | previews on parent | previews after |
 * |---|---|---|
 * | `a9c58f8ec` | 1 | 0 |
 * | `498edc4d1` | 3 | 0 |
 * | `d98ad6c82` | 1 | 0 |
 *
 * It is silent: the staging push succeeds, the bot comments the URL on the PR,
 * the check run is green, and an unrelated merge to `main` removes the artefact
 * minutes later. A reviewer following the link gets a 404 with nothing anywhere
 * saying why — and `AGENTS.md`'s merge discipline turns on staging being the
 * place a human assesses a rendered artefact.
 *
 * ## Why not `keep_files: true`
 *
 * Because `keep_files` is not path-scoped and the action offers nothing that
 * is — its `action.yml` has `keep_files`, `force_orphan` and `exclude_assets`,
 * and `exclude_assets` filters the SOURCE directory, not the branch. So
 * `keep_files: true` would also stop the main site's own deleted pages from
 * ever disappearing: rename a doc and both the old and the new URL serve
 * forever, and nothing would ever report it.
 *
 * Restoring `branches/` into the publish directory keeps both halves: the main
 * site is still a full replace, so a removed page goes; the previews are part
 * of what is published, so they stay.
 *
 * ## "Could not determine" is a third state, and it is the important one
 *
 * An unreadable `gh-pages` must NEVER render as "there are no previews to
 * keep" — that reading deploys the wipe this module exists to stop. Four
 * outcomes, and only the first three are allowed to continue:
 *
 * - **`restored`** — the branch was read and carries previews; they are now in
 *   the publish directory.
 * - **`empty`** — the branch was read and carries none. A determined empty.
 * - **`no-branch`** — the branch positively does not exist (first deploy).
 *   `git ls-remote --exit-code` says so with exit 2, which is distinct from a
 *   failure.
 * - **`unknown`** — the branch could not be read. Exit **2**, which fails the
 *   deploy step on purpose, the same way `translation:index` fails it rather
 *   than publish a navbar whose translation set could not be determined.
 *
 * ## `--verify`, because a green run proves nothing here
 *
 * The action re-clones `gh-pages` itself at push time, so there is a window of
 * a few seconds between this restore and that clone in which a
 * `feature-staging` deploy can land a preview that the push then removes. That
 * window is seconds against the whole of every deploy before this change, but
 * it is not zero, and a loss inside it would be exactly as silent as the defect.
 *
 * So the restore records what it restored (`--state`), and `--verify` re-reads
 * the branch afterwards and exits non-zero naming any preview that did not
 * survive. A new preview pushed in the window is ADDED, never missing, so the
 * comparison has no false positives. `unknown` there is exit 2 again — a
 * verifier that has gone blind must not read as a pass.
 *
 * Usage:
 * ```sh
 * bun run cat-harness-tools/scripts/restore-staging.ts --site ./_site --state ./.staging-state.json
 * bun run cat-harness-tools/scripts/restore-staging.ts --verify --state ./.staging-state.json
 * ```
 *
 * @module scripts/restore-staging
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { RENDER_LOG_DIR } from "../schemas/ui/render-log.ts";
import { PC_PREFIX } from "./publish-main-site.ts";
import { LEGACY_PREVIEW_PREFIX, PREVIEW_PREFIX, PREVIEW_PREFIXES } from "./lib/preview-prefix.ts";

/** Where the previews are written on the publish branch (`lib/preview-prefix.ts`); the old name, kept for its importers. */
export const STAGING_PREFIX = PREVIEW_PREFIX;

/**
 * The retired-record store under {@link STAGING_PREFIX} — bean `6pfo`. A
 * directory beside the previews, never one of them: it belongs to no pull
 * request, so a liveness-gated carry would drop exactly the records of closed
 * ones it exists to keep. Every slug guard in `feature-staging.yml` refuses
 * this name, so no preview can be staged over it.
 */
export const RETIRED_DIR = "_retired";

/**
 * What a slug may contain.
 *
 * Exactly the characters `feature-staging.yml`'s own `Determine staging slug`
 * step can produce — `sed 's|[^a-zA-Z0-9._-]|-|g'`. A dispatch input is
 * arbitrary text from a person, and this value reaches `rm -rf` in the
 * workflow, so the shape is checked rather than assumed. `.` and `..` are
 * refused by name: both are spelled entirely out of permitted characters and
 * neither names a preview.
 */
export const SLUG_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * What else on the publish branch must survive a full replace.
 *
 * The previews above are carried because a reviewer's link would otherwise
 * 404. These are carried because they are the branch's own RECORD of itself,
 * and a record a deploy truncates is worse than no record — its whole value is
 * that entries persist and a reader will believe they did.
 *
 * **Unconditionally, and that is the difference from a preview.** A preview
 * belongs to an open pull request; a log entry about a CLOSED one is exactly
 * what a liveness-gated carry would drop, and exactly what somebody asking
 * "what happened to `branches/x`" needs most.
 *
 * A list rather than one constant because this is the second tenant of the
 * same rule — `skills/ui/ui-core/render-logging.md` for the first, and bean
 * `6pfo`'s retired-record store for the next. Adding one should be a row here,
 * not a third code path that can disagree with the other two.
 *
 * The third tenant is `PC/`, the frozen public comment releases
 * (`pc-release.ts`): the public cited their lines, so a deploy must never
 * drop one.
 */
export const CARRIED_PREFIXES: readonly string[] = [RENDER_LOG_DIR, ...PREVIEW_PREFIXES.map((p) => `${p}/${RETIRED_DIR}`), PC_PREFIX];

export interface RestoreOptions {
  /** Git working directory the commands run in. */
  repo: string;
  /** Remote name or URL holding the publish branch. */
  remote: string;
  /** The publish branch. */
  branch: string;
  /** The directory on the branch holding the previews. */
  prefix: string;
  /**
   * Older preview directories carried as well (`branches/`, `lib/preview-prefix.ts`).
   * Their previews are named `<legacy prefix>/<slug>` in the outcome, so a
   * slug under `prefix` keeps its bare name.
   */
  legacyPrefixes?: readonly string[];
  /** The publish directory the deploy will replace the branch with. */
  site: string;
}

/**
 * What happened to one {@link CARRIED_PREFIXES} entry.
 *
 * Two states here, not three: a carry that could not be DETERMINED collapses
 * into the outcome's own `unknown`, because a deploy that cannot tell whether
 * it kept the branch's record must not proceed. There is no third state a
 * caller could read as "fine".
 */
export interface Carried {
  prefix: string;
  /** `absent` is a DETERMINED absence — the branch was read and has no such directory. */
  state: "carried" | "absent";
}

export type RestoreOutcome =
  | { state: "restored"; previews: string[]; carried: Carried[] }
  | { state: "empty"; previews: []; carried: Carried[] }
  | { state: "no-branch"; previews: []; carried: [] }
  | { state: "unknown"; previews: []; carried: []; reason: string };

export type VerifyOutcome =
  | { state: "ok"; expected: string[]; present: string[]; lostPrefixes?: string[] }
  | { state: "lost"; expected: string[]; present: string[]; lost: string[]; lostPrefixes?: string[] }
  | { state: "unknown"; expected: string[]; reason: string };

interface Ran {
  code: number;
  out: string;
  err: string;
  spawned: boolean;
}

function git(cwd: string, args: string[]): Ran {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error !== undefined || r.status === null) {
    return { code: -1, out: "", err: String(r.error ?? "git did not run"), spawned: false };
  }
  return { code: r.status, out: r.stdout ?? "", err: r.stderr ?? "", spawned: true };
}

/**
 * Does the publish branch exist?
 *
 * `--exit-code` is what separates the two answers that matter: **2** is
 * "asked, and there is no such ref", anything else non-zero is "could not
 * ask". Collapsing them is the whole bug in miniature.
 */
function branchState(o: RestoreOptions): "present" | "absent" | { reason: string } {
  const r = git(o.repo, ["ls-remote", "--exit-code", "--heads", o.remote, o.branch]);
  if (r.code === 0 && r.out.trim() !== "") return "present";
  if (r.code === 2) return "absent";
  return { reason: `git ls-remote ${o.remote} ${o.branch} exited ${r.code}: ${r.err.trim() || r.out.trim()}` };
}

/**
 * The slugs that have been RETIRED, read from {@link RETIRED_DIR} at `rev`.
 *
 * A retirement record is `<slug>.json`, so the store IS the set and no second
 * list has to be kept in step with it.
 *
 * **A missing store is a determined empty set; an unreadable one is a reason.**
 * Those must not collapse: "could not read the retirements" answered as "there
 * are none" restores every retired preview, which is the exact defect this
 * function exists to stop.
 */
function retiredSlugs(repo: string, rev: string, prefix: string): Set<string> | { reason: string } {
  const dir = `${prefix}/${RETIRED_DIR}`;
  const has = prefixExists(repo, rev, dir);
  if (typeof has === "object") return has;
  if (!has) return new Set();
  const kids = git(repo, ["ls-tree", "--name-only", `${rev}:${dir}`]);
  if (kids.code !== 0) return { reason: `git ls-tree ${rev}:${dir} exited ${kids.code}: ${kids.err.trim()}` };
  return new Set(
    kids.out
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.endsWith(".json"))
      .map((s) => s.slice(0, -".json".length)),
  );
}

/**
 * The preview directory names under `prefix` at `rev` that a deploy must carry,
 * or a reason they could not be read.
 *
 * **A RETIRED preview is not one of them**, and that is the whole point of this
 * function rather than a tidy-up in it. `feature-staging.yml`'s cleanup removes
 * the directory and writes `_retired/<slug>.json` in ONE commit; a full-replace
 * deploy then restored the branch's previews from a read taken before that
 * commit and put all of them back. Measured 2026-10-02 on `gh-pages`:
 * `a46c58ca9df` removed 1615 files under
 * `branches/claude-fervent-brahmagupta-rbwhzm/` and `93ffa64488c`, the next
 * `docs(gh-pages)` full replace, re-added all 1615 — leaving a retirement
 * record asserting a removal that had been undone.
 *
 * The record is what settles it. It is carried UNCONDITIONALLY
 * ({@link CARRIED_PREFIXES}) precisely so it outlives the preview, so it is on
 * the branch at restore time and says what a reader needs: this slug is gone on
 * purpose. Consulting it makes the record authoritative rather than decorative.
 */
function previewsAt(repo: string, rev: string, prefix: string): string[] | { reason: string } {
  const has = prefixExists(repo, rev, prefix);
  if (typeof has === "object") return has;
  if (!has) return [];
  const retired = retiredSlugs(repo, rev, prefix);
  if (!(retired instanceof Set)) return retired;
  const kids = git(repo, ["ls-tree", "-d", "--name-only", `${rev}:${prefix}`]);
  if (kids.code !== 0) return { reason: `git ls-tree ${rev}:${prefix} exited ${kids.code}: ${kids.err.trim()}` };
  return kids.out
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s !== "" && s !== RETIRED_DIR && !retired.has(s))
    .sort();
}

/**
 * The previews under `o.prefix` (bare slugs) and under each legacy prefix
 * (`<legacy>/<slug>`), or a reason they could not be read.
 */
function allPreviewsAt(o: RestoreOptions, rev: string): string[] | { reason: string } {
  const found = previewsAt(o.repo, rev, o.prefix);
  if (!Array.isArray(found)) return found;
  const all = [...found];
  for (const legacy of o.legacyPrefixes ?? []) {
    if (legacy === o.prefix) continue;
    const old = previewsAt(o.repo, rev, legacy);
    if (!Array.isArray(old)) return old;
    all.push(...old.map((s) => `${legacy}/${s}`));
  }
  return all;
}

/** The branch path of an {@link allPreviewsAt} entry. */
function previewBranchPath(o: RestoreOptions, entry: string): string {
  return (o.legacyPrefixes ?? []).some((l) => l !== o.prefix && entry.startsWith(`${l}/`)) ? entry : `${o.prefix}/${entry}`;
}

/** Does `rev` carry anything at `prefix`? A reason rather than a bare false. */
function prefixExists(repo: string, rev: string, prefix: string): boolean | { reason: string } {
  const has = git(repo, ["ls-tree", "--name-only", rev, prefix]);
  if (has.code !== 0) return { reason: `git ls-tree ${rev} ${prefix} exited ${has.code}: ${has.err.trim()}` };
  return has.out.trim() !== "";
}

/**
 * Copy the given paths out of `rev` into `into`, or say why they could not be.
 *
 * `git archive` piped through `tar` rather than a checkout: the branch is
 * fetched at depth 1 into the CURRENT repository, which is the site's working
 * tree, so checking it out would replace the tree the deploy is about to
 * publish.
 *
 * **A LIST rather than one prefix**, because the previews are no longer carried
 * wholesale: a retired slug must not be laid back down, and archiving
 * `branches/` entire would copy it whatever the caller had decided. Naming the
 * paths keeps the decision in {@link previewsAt}, where it is tested, instead
 * of writing the directories out and deleting some again.
 *
 * **Refuses an empty list rather than archiving everything.** `git archive rev`
 * with no pathspec is the whole tree, so a caller whose filter removed every
 * path would silently publish a copy of the branch over the site it built.
 */
function copyPaths(repo: string, rev: string, paths: readonly string[], into: string): true | { reason: string } {
  if (paths.length === 0) return { reason: `git archive ${rev} called with no paths — refusing a whole-tree archive` };
  mkdirSync(into, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), "restore-staging-"));
  const shown = paths.length === 1 ? (paths[0] ?? "") : `${paths.length} path(s)`;
  try {
    const tar = join(work, "carry.tar");
    const archived = git(repo, ["archive", "--format=tar", "-o", tar, rev, ...paths]);
    if (archived.code !== 0) {
      return { reason: `git archive ${rev} ${shown} exited ${archived.code}: ${archived.err.trim()}` };
    }
    const untar = spawnSync("tar", ["-xf", tar, "-C", into], { encoding: "utf-8" });
    if (untar.error !== undefined || untar.status !== 0) {
      return { reason: `tar -xf ${shown} exited ${untar.status ?? "?"}: ${String(untar.error ?? untar.stderr ?? "").trim()}` };
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return true;
}

/**
 * Fetch the publish branch and copy what must survive into the publish directory.
 *
 * Two things, and the difference between them is the point:
 *
 * - **the previews**, `branches/`, because a reviewer's link would 404;
 * - **{@link CARRIED_PREFIXES}**, UNCONDITIONALLY — before the preview check
 *   and whatever it says. The early `empty` return used to leave this function
 *   the moment there were no previews, which would carry the record of the
 *   branch only on the days it happened to still hold previews. A log kept
 *   only when something else is also kept is a log with no property worth
 *   relying on.
 *
 * Nothing is written to `site` unless the branch was READ. An `unknown` leaves
 * the tree exactly as it found it, so a caller that ignores the exit code
 * still does not publish a half-restored site.
 */
export function restoreStaging(o: RestoreOptions): RestoreOutcome {
  const present = branchState(o);
  if (present === "absent") return { state: "no-branch", previews: [], carried: [] };
  if (typeof present === "object") return { state: "unknown", previews: [], carried: [], reason: present.reason };

  const fetched = git(o.repo, ["fetch", "--depth=1", "--no-tags", o.remote, o.branch]);
  if (fetched.code !== 0) {
    return {
      state: "unknown",
      previews: [],
      carried: [],
      reason: `git fetch ${o.remote} ${o.branch} exited ${fetched.code}: ${fetched.err.trim()}`,
    };
  }

  const into = resolve(o.site);

  // BEFORE the preview check, deliberately — see the note above.
  const carried: Carried[] = [];
  for (const prefix of CARRIED_PREFIXES) {
    const exists = prefixExists(o.repo, "FETCH_HEAD", prefix);
    if (typeof exists === "object") {
      return { state: "unknown", previews: [], carried: [], reason: exists.reason };
    }
    if (!exists) {
      carried.push({ prefix, state: "absent" });
      continue;
    }
    const copied = copyPaths(o.repo, "FETCH_HEAD", [prefix], into);
    if (copied !== true) {
      // A carry that failed is not a warning. The deploy that follows is a
      // full replace, so continuing here DELETES the branch's own record of
      // itself, which is the exact class of silent loss bean `plj1` names.
      return { state: "unknown", previews: [], carried: [], reason: copied.reason };
    }
    carried.push({ prefix, state: "carried" });
  }

  const found = allPreviewsAt(o, "FETCH_HEAD");
  if (!Array.isArray(found)) return { state: "unknown", previews: [], carried: [], reason: found.reason };
  if (found.length === 0) return { state: "empty", previews: [], carried };

  // Only the previews `previewsAt` kept — naming them is what leaves a retired
  // slug on the branch instead of laying it back down.
  const copied = copyPaths(o.repo, "FETCH_HEAD", found.map((s) => previewBranchPath(o, s)), into);
  if (copied !== true) return { state: "unknown", previews: [], carried: [], reason: copied.reason };
  return { state: "restored", previews: found, carried };
}

/**
 * Did the previews the restore carried actually survive the deploy?
 *
 * Compares against what the restore RECORDED, not against the deploy commit's
 * parent: a preview pushed after ours only adds to the branch, so this cannot
 * report one as lost, and it needs no assumption about which commit is HEAD.
 */
/**
 * Did what the restore carried actually survive the deploy?
 *
 * Compares against what the restore RECORDED, not against the deploy commit's
 * parent: a preview pushed after ours only adds to the branch, so this cannot
 * report one as lost, and it needs no assumption about which commit is HEAD.
 *
 * `carried` names the {@link CARRIED_PREFIXES} entries the restore reported as
 * `carried`, and they are checked too. **Measured 2026-09-20, which is why
 * this argument is not hypothetical**: `gh-pages` commit `96926833b5`, a
 * `docs(gh-pages)` full replace, deleted `_render-log/2026-09-20.jsonl` —
 * present at its parent, `D` at the commit — and the deploy's own verify step
 * passed, because it only ever looked at `branches/`. A verifier blind to half
 * of what the restore carried reports a clean run over the loss it exists to
 * catch.
 */
export function verifyStaging(o: RestoreOptions, expected: string[], carried: string[] = []): VerifyOutcome {
  const present = branchState(o);
  if (typeof present === "object") return { state: "unknown", expected, reason: present.reason };
  if (present === "absent") {
    const lostPrefixes = [...carried];
    if (expected.length === 0 && lostPrefixes.length === 0) return { state: "ok", expected, present: [] };
    return { state: "lost", expected, present: [], lost: [...expected], lostPrefixes };
  }

  const fetched = git(o.repo, ["fetch", "--depth=1", "--no-tags", o.remote, o.branch]);
  if (fetched.code !== 0) {
    return { state: "unknown", expected, reason: `git fetch exited ${fetched.code}: ${fetched.err.trim()}` };
  }
  const now = allPreviewsAt(o, "FETCH_HEAD");
  if (!Array.isArray(now)) return { state: "unknown", expected, reason: now.reason };

  // A prefix whose presence cannot be READ is `unknown`, never "lost" and
  // never "fine" — the same three states the restore itself keeps.
  const lostPrefixes: string[] = [];
  for (const prefix of carried) {
    const still = prefixExists(o.repo, "FETCH_HEAD", prefix);
    if (typeof still === "object") return { state: "unknown", expected, reason: still.reason };
    if (!still) lostPrefixes.push(prefix);
  }

  const lost = expected.filter((p) => !now.includes(p));
  if (lost.length > 0 || lostPrefixes.length > 0) {
    return { state: "lost", expected, present: now, lost, lostPrefixes };
  }
  return { state: "ok", expected, present: now };
}

/** `unknown` is 2 — could not determine — and is never a pass. A loss is 1. */
export function exitCodeFor(outcome: RestoreOutcome | VerifyOutcome): 0 | 1 | 2 {
  if (outcome.state === "unknown") return 2;
  if (outcome.state === "lost") return 1;
  return 0;
}

export function describe(outcome: RestoreOutcome | VerifyOutcome): string {
  switch (outcome.state) {
    case "restored":
      return (
        `restored ${outcome.previews.length} preview(s) into the publish directory: ` +
        `${outcome.previews.join(", ")}${carriedNote(outcome.carried)}`
      );
    case "empty":
      return (
        "the publish branch was read and carries no previews — a determined empty, nothing to restore" +
        carriedNote(outcome.carried)
      );
    case "no-branch":
      return "the publish branch does not exist yet — nothing to restore";
    case "ok":
      return outcome.expected.length === 0
        ? "no previews were restored, so none could be lost"
        : `all ${outcome.expected.length} restored preview(s) survived the deploy: ${outcome.expected.join(", ")}`;
    // `ok` deliberately does not enumerate what ELSE it checked. The caller
    // passes the carried prefixes; a pass over an empty list is a pass over
    // nothing, and that is the state the deploy of 2026-09-20 was in.
    case "lost": {
      const parts: string[] = [];
      if (outcome.lost.length > 0) {
        parts.push(
          `${outcome.lost.length} preview(s) did NOT survive the deploy: ${outcome.lost.join(", ")}. ` +
            "The site itself deployed correctly; what was lost is a review preview that landed between " +
            "this job's restore and the publish action's own re-clone. Re-run Feature Staging on the " +
            "affected PR(s).",
        );
      }
      if ((outcome.lostPrefixes ?? []).length > 0) {
        // Worse than a lost preview, and said so: a preview can be rebuilt by
        // re-running its workflow, and the branch's own record of itself
        // cannot. Whatever it said about artefacts already gone is gone with it.
        parts.push(
          `${outcome.lostPrefixes?.length} carried director(ies) did NOT survive: ` +
            `${outcome.lostPrefixes?.join(", ")}. This is NOT recoverable by re-running anything — a ` +
            "preview can be rebuilt, a record of what was already removed cannot.",
        );
      }
      return parts.join(" ");
    }
    case "unknown":
      return `COULD NOT DETERMINE the state of the publish branch: ${outcome.reason}`;
  }
}

/**
 * What the unconditional carries did, said out loud even when nothing moved.
 *
 * A determined absence is REPORTED rather than omitted: "there is no log on
 * the branch yet" and "the carry never ran" look identical in a silent log,
 * and only the second is a defect.
 */
function carriedNote(carried: Carried[]): string {
  if (carried.length === 0) return "";
  return `. Carried: ${carried.map((c) => `${c.prefix} (${c.state})`).join(", ")}`;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

if (import.meta.main) {
  const opts: RestoreOptions = {
    repo: arg("repo", process.cwd()),
    remote: arg("remote", "origin"),
    branch: arg("branch", "gh-pages"),
    prefix: arg("prefix", PREVIEW_PREFIX),
    // With no `--prefix`, the previews still under the old directory are carried too.
    legacyPrefixes: process.argv.includes("--prefix") ? [] : [LEGACY_PREVIEW_PREFIX],
    site: arg("site", "./_site"),
  };
  const statePath = arg("state", "");

  if (process.argv.includes("--verify")) {
    let expected: string[] = [];
    if (statePath !== "" && existsSync(statePath)) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(statePath, "utf-8"));
        if (parsed !== null && typeof parsed === "object" && Array.isArray((parsed as { previews?: unknown }).previews)) {
          expected = (parsed as { previews: string[] }).previews;
        }
      } catch {
        console.error("✗ the restore state file could not be read — COULD NOT DETERMINE what to verify");
        process.exit(2);
      }
    } else if (statePath !== "") {
      // No state file means the restore step did not run to completion. That is
      // not "nothing to check"; it is not knowing.
      console.error(`✗ no restore state at ${statePath} — COULD NOT DETERMINE what to verify`);
      process.exit(2);
    }
    let carriedPrefixes: string[] = [];
    if (statePath !== "" && existsSync(statePath)) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(statePath, "utf-8"));
        const c = (parsed as { carried?: { prefix?: unknown; state?: unknown }[] }).carried;
        // Only the ones the restore said it CARRIED. A determined `absent` was
        // never there to lose, and asserting on it would fail every deploy
        // before the first entry is ever written.
        if (Array.isArray(c)) {
          carriedPrefixes = c
            .filter((e) => e?.state === "carried" && typeof e.prefix === "string")
            .map((e) => e.prefix as string);
        }
      } catch {
        console.error("✗ the restore state file could not be read — COULD NOT DETERMINE what to verify");
        process.exit(2);
      }
    }
    const outcome = verifyStaging(opts, expected, carriedPrefixes);
    const code = exitCodeFor(outcome);
    (code === 0 ? console.log : console.error)(`${code === 0 ? "✓" : "✗"} ${describe(outcome)}`);
    process.exit(code);
  }

  const outcome = restoreStaging(opts);
  const code = exitCodeFor(outcome);
  // Not written on `unknown`: an absent state file is what makes `--verify`
  // report "could not determine" rather than "nothing to check".
  if (statePath !== "" && outcome.state !== "unknown") {
    writeFileSync(
      statePath,
      `${JSON.stringify({ state: outcome.state, previews: outcome.previews, carried: outcome.carried }, null, 2)}\n`,
    );
  }
  (code === 0 ? console.log : console.error)(`${code === 0 ? "✓" : "✗"} ${describe(outcome)}`);
  process.exit(code);
}
