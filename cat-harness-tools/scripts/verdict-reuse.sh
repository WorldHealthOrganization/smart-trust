#!/usr/bin/env bash
#
# Has the tree this push to `main` carries ALREADY been judged green? Bean
# `qbco`, issue #2456 (owner, 2026-10-07: "1y, 2y, 3y, 4y"). CI only; not
# wrapped by `bat:sync`.
#
# ## Why
#
# A PR merged with GitHub's merge button, up to date with `main`, produces a
# merge commit whose TREE is the tree CI already tested: the PR's
# `refs/pull/N/merge` commit, or — when `merge-main` brought `main` in first
# and dispatched this workflow on the branch — the branch head itself. Running
# the four `bun test` shards, the three e2e shards and the standalone ratchet
# again on `main` asks questions whose answers are already recorded. On
# 2026-10-07 there were 34 push runs on `main`, all queued behind PR runs in a
# fixed concurrent-job budget.
#
# ## The rule — tree equality, read from the record, never assumed
#
# Reuse only when ALL of these hold, and say which run it was:
#
#   1. HEAD is a two-parent merge commit and its second parent is the PR
#      head; or HEAD has one parent and is the `merge_commit_sha` of exactly
#      one merged PR (a squash or rebase merge), whose head is the PR head.
#   2. A run of this workflow on that head concluded `success`.
#   3. The tree that run TESTED equals `git rev-parse HEAD^{tree}`:
#      - `pull_request`: the merge commit it checked out, whose tree its
#        `qa-working-copy` job records as the NAME of an artifact,
#        `tested-tree-<sha>`, which the artifacts API lists without the log
#        host;
#      - `workflow_dispatch` / `push`: the head itself, whose tree is local.
#   4. In that run, every job this reuse would skip — 4 test shards, 3 e2e
#      shards, the standalone ratchet — exists and concluded `success`, so a
#      verdict is never inherited from a run that itself did not ask.
#
# Anything else — a direct push, a missing record, an API error, an unreadable
# answer — is `reuse=false`, and every job runs. Could-not-determine is never
# green. The script exits 0 in every state so a crash here cannot skip
# anything either: the jobs it gates run unless its output is exactly `true`.
#
# Env: GH_TOKEN, REPO (owner/name), WORKFLOW (file name), PRODUCER_JOB (the
# `qa-working-copy` job's name). Writes `reuse`, `run_id`, `run_url` to
# $GITHUB_OUTPUT and a summary to $GITHUB_STEP_SUMMARY. HEAD_REF (default
# HEAD) names the commit judged, so the script can be tried on a past merge.
set -uo pipefail

# The jobs a reuse skips, by name. If a name here drifts from the workflow,
# rule 4 finds fewer than EXPECTED_SKIPPABLE and nothing is reused — the safe
# direction.
SKIPPABLE='^(TypeScript — bun test, shard [0-9]+/4|End-to-end \+ accessibility, shard [0-9]+/3|Repository gates — cat-harness standalone ratchet \(hard\))$'
EXPECTED_SKIPPABLE=8

output() { [ -n "${GITHUB_OUTPUT:-}" ] && echo "$1=$2" >> "$GITHUB_OUTPUT"; return 0; }
summary() { if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then printf '%s\n' "$@" >> "$GITHUB_STEP_SUMMARY"; else printf '%s\n' "$@"; fi; }

no_reuse() {
  output reuse false
  summary "### Verdict reuse: none — every job runs (bean \`qbco\`)" "" "$1"
  echo "verdict-reuse: no — $1"
  exit 0
}

: "${REPO:?}" "${WORKFLOW:?}" "${PRODUCER_JOB:?}"

ref="${HEAD_REF:-HEAD}"
tree=$(git rev-parse "$ref^{tree}" 2>/dev/null) || no_reuse "Could not read this commit's tree, so it could not be determined whether it was judged before."
head=$(git rev-parse "$ref")
read -r _ p1 p2 extra <<< "$(git rev-list --parents -n 1 "$ref" 2>/dev/null)"
if [ -n "${extra:-}" ]; then
  no_reuse "\`$head\` is an octopus merge, so there is no single PR head whose run could have tested this tree."
fi
if [ -z "${p2:-}" ]; then
  # One parent: a squash or rebase merge, or a direct push. Rule 1's PR head is
  # then the head of the PR GitHub recorded as merged AS this commit
  # (`merge_commit_sha`), read from the API rather than guessed. Measured
  # 2026-10-30: 40 of the last 60 first-parent commits on folio-assistant's
  # `main` were squash merges, and every one of them was refused reuse here,
  # so main re-ran the eight jobs for a tree a PR run may already have tested.
  # Rule 3 is unchanged and is what makes this sound: the run's recorded
  # tested tree must still equal this commit's tree, which holds only when
  # `main` did not move between that PR run and the merge.
  [ -n "${p1:-}" ] || no_reuse "Could not read \`$head\`'s parents, so it could not be determined whether it was judged before."
  prs=$(gh api "repos/$REPO/commits/$head/pulls" \
    --jq ".[] | select(.merged_at != null and .merge_commit_sha == \"$head\") | .head.sha" 2>&1) \
    || no_reuse "Could not list the PRs merged as \`$head\` (\`$prs\`) — could not determine, so nothing is reused."
  [ "$(printf '%s\n' "$prs" | grep -c .)" -eq 1 ] \
    || no_reuse "\`$head\` has one parent and is not the recorded merge commit of exactly one merged PR (a direct push, or an ambiguous record), so there is no PR head whose run could have tested this tree."
  p2=$prs
fi

runs=$(gh api "repos/$REPO/actions/workflows/$WORKFLOW/runs?head_sha=$p2&status=success&per_page=30" \
  --jq '.workflow_runs[] | [.id, .event, .head_sha, .html_url] | @tsv' 2>&1) \
  || no_reuse "Could not list this workflow's runs on the merged head \`$p2\` (\`$runs\`) — could not determine, so nothing is reused."
[ -n "$runs" ] || no_reuse "No run of this workflow on the merged head \`$p2\` concluded \`success\`."

checked=""
while IFS=$'\t' read -r id event sha url; do
  [ -n "$id" ] || continue
  jobs=$(gh api "repos/$REPO/actions/runs/$id/jobs?per_page=100" \
    --jq '.jobs[] | [.name, (.conclusion // ""), .check_run_url] | @tsv' 2>/dev/null) || { checked+=" $id(jobs unreadable)"; continue; }
  # The regex goes in through the environment, not `-v`: awk processes
  # backslash escapes in a `-v` value, and gawk turns `\+` into a bare `+`,
  # so the end-to-end job names stopped matching there (mawk keeps it).
  ok=$(printf '%s\n' "$jobs" | SKIPPABLE_RE="$SKIPPABLE" awk -F'\t' '$1 ~ ENVIRON["SKIPPABLE_RE"] && $2 == "success"' | wc -l)
  if [ "$ok" -ne "$EXPECTED_SKIPPABLE" ]; then checked+=" $id($ok/$EXPECTED_SKIPPABLE skippable jobs succeeded)"; continue; fi
  case "$event" in
    pull_request)
      cr=$(printf '%s\n' "$jobs" | awk -F'\t' -v n="$PRODUCER_JOB" '$1 == n {print $3; exit}')
      [ -n "$cr" ] || { checked+=" $id(no $PRODUCER_JOB job)"; continue; }
      # The record is the NAME of a one-file artifact the producer uploads,
      # `tested-tree-<sha>`: a name the artifacts API lists for the run, even
      # after the file itself has expired. Not the job's step summary: GitHub
      # does not expose a job summary as its check run's `output.summary`
      # (measured 2026-10-30: empty on every producer check run read, e.g.
      # 119505839921 of run 39681794429), so the old read found nothing and
      # no PR run's verdict was ever reusable. Exactly one such name, or none.
      tested=$(gh api "repos/$REPO/actions/runs/$id/artifacts?per_page=100" --jq '.artifacts[].name' 2>/dev/null \
        | grep -xE 'tested-tree-[0-9a-f]{40}' | sed 's/^tested-tree-//')
      [ "$(printf '%s\n' "$tested" | grep -c .)" -le 1 ] || { checked+=" $id(more than one tested-tree record)"; continue; }
      ;;
    workflow_dispatch|push)
      tested=$(git rev-parse "$sha^{tree}" 2>/dev/null)
      ;;
    *)
      checked+=" $id($event)"; continue
      ;;
  esac
  if [ -z "${tested:-}" ]; then checked+=" $id(tested tree not recorded)"; continue; fi
  if [ "$tested" = "$tree" ]; then
    output reuse true
    output run_id "$id"
    output run_url "$url"
    summary "### Verdict reuse: this tree was already judged green — run $id (bean \`qbco\`)" "" \
      "| | |" "| --- | --- |" \
      "| this push | \`$head\`, tree \`$tree\` |" \
      "| merged head | \`$p2\` |" \
      "| reused run | [$id]($url) (\`$event\`), tested tree \`$tested\`, concluded \`success\` |" "" \
      "Skipped on this push, their verdict being that run's: the 4 \`bun test\` shards, the 3 e2e shards and the cat-harness standalone ratchet. Every other job — lint and types, hygiene, the repository gates that read \`main\`-relative state (\`--against main\`, \`--base\`), the unrun-gates and skill-chain checks, and the QA publish for \`main/$head\` — runs as usual."
    echo "verdict-reuse: yes — run $id ($event) tested tree $tree"
    exit 0
  fi
  checked+=" $id(tree $tested)"
done <<< "$runs"

no_reuse "No successful run on the merged head \`$p2\` tested tree \`$tree\`. Checked:${checked:- nothing}."
