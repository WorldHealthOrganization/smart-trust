#!/usr/bin/env bash
# Publish `_site` to `gh-pages` as a FULL REPLACE, surviving a lost push race.
#
# Replaces `peaceiris/actions-gh-pages@v4` in `docs-site.yml`. Bean `yzsj`,
# issue #605 half (a), on the owner's ruling.
#
# ## Why the action had to go
#
# `docs-site` fires on every push to `main` and is the busiest writer of
# `gh-pages` after `feature-staging`. It had NO retry: `peaceiris` clones,
# replaces and pushes in one step, so the race window is INSIDE the action and
# there is nothing to wrap. Measured failing on `main` 2026-09-20 at 19:53
# (run 308, 4af80f84cf):
#
#   ! [rejected]        gh-pages -> gh-pages (fetch first)
#
# It self-healed on the next merge, which is why it stayed invisible.
#
# ## Why a REBASE would have been the wrong retry — the part that matters
#
# `feature-staging` retries by rebasing, and that is right for IT: its commit
# adds or removes one `branches/<slug>/` directory, so replaying it onto whoever
# won touches nothing else.
#
# This commit replaces the WHOLE TREE. Rebasing it onto a newer `gh-pages`
# would re-apply that replacement over whatever landed in between — deleting a
# preview a sibling had just deployed. That is bean `plj1` exactly, re-created
# by the very mechanism meant to make the deploy safer.
#
# So each attempt REBUILDS instead of replaying: re-read the branch, re-run the
# restore against its CURRENT contents, lay `_site` down again, commit, push.
# `restore-staging.ts` reads `gh-pages` itself (`ls-remote` / `ls-tree`), so a
# second call sees the newer branch rather than a cached view.
#
# That makes the retry strictly BETTER than one attempt, not merely luckier.
# `docs-site.yml` already names the flaw it closes: the restore runs, then the
# action re-clones, and "everything between this read and that clone is a
# window in which a `feature-staging` deploy could land a preview this push
# then removes". Re-restoring per attempt shrinks that window to the last
# attempt's, instead of carrying the first attempt's stale read into a push
# minutes later.
#
# ## What is preserved from the action, deliberately
#
#   - FULL REPLACE, via `git rm -r --ignore-unmatch '*'` — the exact call
#     `peaceiris` makes in `src/git-utils.ts` (`setRepo`). Not `keep_files`:
#     `docs-site.yml` records at length why that is not the fix, and the
#     previews are kept by RESTORING them into `_site`, not by never deleting.
#   - the commit message `docs(gh-pages): site from <sha>`, which
#     `check-ci-health` and the render log both read.
#   - "nothing to commit" is success, not failure: a deploy that changes
#     nothing is a no-op, not a broken build.
#
# The `--verify` step in the workflow is untouched and still runs after this.
# A green push is not evidence here (`plj1`), and this script does not pretend
# otherwise — it publishes, and something else checks.
#
# Env: SITE, STATE, COMMIT_SHA, PAGES_DIR (all required; no defaults, because a
# silent default here publishes the wrong directory to the live site). STATE is
# restore-staging's record file; `$STATE.keep` is keep-shared-payloads' directory.
# Each may instead be passed as a flag (`--site`, `--state`, `--commit`,
# `--pages-dir`), the form the `publish-gh-pages` Tool projects for the CLI
# (`bun run cat pages:publish`) and MCP. A flag wins over the variable.
set -euo pipefail

while [ $# -gt 0 ]; do
  case "$1" in
    --site) SITE="$2"; shift 2 ;;
    --state) STATE="$2"; shift 2 ;;
    --commit) COMMIT_SHA="$2"; shift 2 ;;
    --pages-dir) PAGES_DIR="$2"; shift 2 ;;
    *) echo "::error::publish-gh-pages: unknown argument $1" >&2; exit 2 ;;
  esac
done

for v in SITE STATE COMMIT_SHA PAGES_DIR; do
  if [ -z "${!v:-}" ]; then echo "::error::publish-gh-pages: $v is unset" >&2; exit 2; fi
done
[ -d "$SITE" ] || { echo "::error::publish-gh-pages: SITE=$SITE is not a directory" >&2; exit 2; }
[ -d "$PAGES_DIR/.git" ] || [ -f "$PAGES_DIR/.git" ] || {
  echo "::error::publish-gh-pages: PAGES_DIR=$PAGES_DIR is not a git checkout" >&2; exit 2; }

git -C "$PAGES_DIR" config user.name 'github-actions[bot]'
git -C "$PAGES_DIR" config user.email '41898282+github-actions[bot]@users.noreply.github.com'

for attempt in 1 2 3; do
  # Re-read the branch. `--hard` because the previous attempt left a commit
  # that must NOT be replayed — see the rebase note above.
  git -C "$PAGES_DIR" fetch --depth=1 origin gh-pages
  git -C "$PAGES_DIR" reset --hard FETCH_HEAD

  # Re-restore against what is on the branch NOW. Exit 2 from the restore means
  # the branch could not be READ, which must never be published as "there are
  # no previews to keep" — so it is fatal here too rather than retried.
  # The exit status is captured on the line AFTER the command, before anything
  # else runs. `if ! cmd; then rc=$?` read the status of `! cmd` — always 0 in
  # that branch — so this refused to publish and then exited 0, a green step
  # that published nothing (bean `0s6w`).
  rc=0
  bun run cat-harness-tools/scripts/restore-staging.ts --site "$SITE" --state "$STATE" || rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "::error::publish-gh-pages: restore-staging exited $rc — refusing to publish a site whose preview set is unknown" >&2
    exit "$rc"
  fi

  # Payload blobs this build drops but an older preview may still borrow
  # (staging-share.ts) are carried over from the branch being replaced, until
  # those previews rotate off (keep-shared-payloads.ts, bean fwtz Q-S2-2).
  # STATE is restore-staging's record, a FILE; keep-shared-payloads keeps a
  # DIRECTORY of its own beside it. Handing it STATE made it mkdir over the
  # file (EEXIST), which failed every main deploy from 2026-11-02.
  bun run cat-harness-tools/scripts/keep-shared-payloads.ts --site "$SITE" --pages "$PAGES_DIR" --state "$STATE.keep"

  git -C "$PAGES_DIR" rm -r --ignore-unmatch -q '*'
  # `/.` copies the CONTENTS including dotfiles — `.nojekyll` is one, and
  # without it GitHub runs Jekyll over the published tree.
  cp -a "$SITE"/. "$PAGES_DIR"/
  git -C "$PAGES_DIR" add -A

  if git -C "$PAGES_DIR" diff --cached --quiet; then
    echo "nothing to publish — the built site matches gh-pages"
    exit 0
  fi
  git -C "$PAGES_DIR" commit -q -m "docs(gh-pages): site from $COMMIT_SHA"

  if git -C "$PAGES_DIR" push origin HEAD:gh-pages; then
    echo "published on attempt $attempt"
    exit 0
  fi
  if [ "$attempt" = 3 ]; then
    echo "::error::publish-gh-pages: could not publish after 3 attempts" >&2
    exit 1
  fi
  echo "push rejected; re-reading gh-pages and rebuilding"
  # The ONE backoff implementation (`06kg`). Path is relative to the job root,
  # which is where this script runs — `7iog` is the check that would catch it
  # if that ever stops being true.
  bun run cat-harness-tools/scripts/backoff-sleep.ts --attempt "$attempt"
done
