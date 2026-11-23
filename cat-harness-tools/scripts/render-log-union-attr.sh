#!/usr/bin/env bash
# Make the render log survive the retry's rebase.
#
# Bean `pb4n`. The gh-pages push loops already handle a REJECTION — fetch,
# rebase, retry — and that is load-bearing, because a concurrency group only
# serialises the jobs that name it and six workflows push to this ref. What
# the retry cannot handle is a CONTENT CONFLICT, and `_render-log/<date>.jsonl`
# produces one BY CONSTRUCTION: every run appends a line to the same day's
# file, so two runs on one day whose pushes interleave conflict on it every
# time, not by bad luck. Measured on PR #603 and again on #616:
#
#     push rejected; rebasing onto origin/gh-pages and retrying
#     CONFLICT (content): Merge conflict in _render-log/2026-09-20.jsonl
#     error: could not apply ... staging(<slug>)
#
# `merge=union` takes the added lines from BOTH sides. For an append-only log
# that is not a heuristic to paper over a conflict — it is the correct
# semantics, and it is the reason the driver exists. The existing three-attempt
# loop then succeeds where it currently aborts.
#
# ## Why `.git/info/attributes` and not a committed `.gitattributes`
#
# `info/attributes` is per-checkout and needs no commit, so it works on the
# FIRST run rather than on the run after the one that seeds the file. It also
# leaves no artefact on the published site: gh-pages IS the site, and a
# `.gitattributes` at its root would be served.
#
# And the decisive one: a committed carrier on this branch would not merely be
# ugly, it would STOP WORKING. `docs-site` publishes as a FULL REPLACE, and
# `restore-staging.ts` records that mechanism deleting this very path —
# "`docs(gh-pages)` full replace, deleted `_render-log/2026-09-20.jsonl`".
# A committed `.gitattributes` would go the same way at the next publish and
# quietly stop applying, so the conflict would come back reading as a NEW
# defect rather than as a regression. A fix that disappears is worse than none.
# `info/` is local to the checkout and re-established every run by
# construction, rather than by anybody remembering. Bean `yzsj` reached this
# by the other route; both beans land on the same carrier.
#
# ## Why this is the whole fix for this conflict, despite six writers
#
# Only the four loops in `feature-staging.yml` write `_render-log` at all, so
# no other workflow can conflict on it. This does NOT stop the six workflows
# contending for the ref — that is `yzsj`, a different bean about PREVENTING
# the race rather than SURVIVING it.
#
# ## Scoped deliberately
#
# `_render-log/*.jsonl`, never `*.jsonl`. Widening it would silently
# union-merge files where a conflict is real information.
#
# Ordering is NOT preserved by union, and that was checked rather than assumed:
# nothing in this repository parses the log (only `readRenderLogEntry`, which
# validates a single entry), and every entry carries `at` as an RFC3339
# timestamp — so a future reader sorts by the entry rather than trusting file
# order. That is `pb4n`'s third "done when", answered.
set -euo pipefail

dir="${1:?usage: render-log-union-attr.sh <git-checkout-dir>}"

# `--absolute-git-dir` rather than `--git-dir`: the latter answers RELATIVE to
# the repository, so it is `.git` whatever directory the caller stands in and
# every use site would have to re-prefix it. It also resolves the case where
# `actions/checkout` leaves `.git` as a FILE pointing elsewhere.
gitdir=$(git -C "$dir" rev-parse --absolute-git-dir)

mkdir -p "$gitdir/info"
# `-x` so a LONGER line containing this rule as a substring is not mistaken for
# it; appending only when absent keeps this idempotent and does not clobber an
# attributes file somebody else put there.
if ! grep -qsxF '_render-log/*.jsonl merge=union' "$gitdir/info/attributes"; then
  printf '_render-log/*.jsonl merge=union\n' >>"$gitdir/info/attributes"
fi

# VERIFY, and fail loudly. A silent no-op is the whole failure mode this script
# exists to prevent: the conflict would come back reading as a NEW defect
# rather than as a regression, and the retry would abort exactly as before.
# `check-attr` answers for a path whether or not that path exists.
probe="_render-log/probe.jsonl"
got="$(git -C "$dir" check-attr merge -- "$probe")"
case "$got" in
  *": merge: union")
    echo "render-log: merge=union set in $gitdir/info/attributes" ;;
  *)
    echo "::error::render-log-union-attr: attribute did not take effect — $got" >&2
    exit 1 ;;
esac
