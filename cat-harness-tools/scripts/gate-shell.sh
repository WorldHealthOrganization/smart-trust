#!/usr/bin/env bash
#
# THE SHELL every `run:` step in `code-quality-gates.yml` uses, so that a
# failing step says WHAT failed somewhere a reader can actually get at.
#
# Bean `yqc4`. A red check run here carried its diagnosis in exactly one
# place: the job log, on `productionresultssa*.blob.core.windows.net`. A
# cloud session whose network policy denies that host sees only
#
#     output.title    null
#     output.summary  null
#     annotations     "Process completed with exit code 1."
#
# Measured 2026-10-03 on PR #1949: a red `Skill-registration chain` gave
# exactly that, and `GET .../job-logs.txt` returned Forbidden. The gate whose
# whole purpose is to name which derived artefact went stale reported a bare
# exit code. `$GITHUB_STEP_SUMMARY` fixes it because it surfaces in the check
# run's `output.summary`, which is an API FIELD — readable with no access to
# the log host at all.
#
# ## Why a shell rather than 100 `if: failure()` steps
#
# The workflow has 100 `run:` steps across 14 jobs. A per-step block is 100
# edits, 100 chances to drift, and nothing that fails when the 101st step
# arrives without one. GitHub lets a job name its own shell as a command
# template whose `{0}` is the generated step script, so ONE wrapper covers
# every step in every job that opts in, and a new step is covered by being
# written.
#
# ## The semantics this MUST NOT change
#
# GitHub's default for a `run:` step on Linux is `bash -e {0}` — NOT
# `bash -eo pipefail`. So this runs `bash -e` and nothing more. Adding
# `pipefail` here would redden steps that are green today, for a reason
# unrelated to observability, and the breakage would look like a real
# finding. The step's own script is free to `set -o pipefail` itself, and
# many do.
#
# The exit status is taken from `PIPESTATUS[0]`, the status of the step
# script — never from `tee`, which succeeds almost always and would turn
# every failure green. That is the one bug in this file that would be
# invisible: the gate set would pass and judge nothing.
#
# Usage (from the workflow, not by hand):
#   defaults:
#     run:
#       shell: cat-harness/scripts/gate-shell.sh {0}

script="$1"

if [ -z "$script" ] || [ ! -f "$script" ]; then
  echo "gate-shell: expected a step script path, got ${script:-<nothing>}" >&2
  exit 2
fi

log="$(mktemp -t gate-shell.XXXXXX)"

# `bash -e`, exactly GitHub's default. 2>&1 into the pipe so the summary
# carries the stderr a failure actually prints; the Actions log merges the
# two streams anyway, so nothing a reader sees changes.
# THE CI CONE (bean `4rbc`, issue #2456). A job that ran `ci-cone.ts prepare`
# has `CI_CONE_MODE` set, and only a step that is EXACTLY `bun run [cat] <script>`
# is touched; every other step runs as written.
#
#   skip    (a pull request) `ci-cone.ts decide` exits 0 only when every path
#           the check read on main's green run, and its script fingerprint,
#           are unchanged here. Then the step prints
#           `SKIPPED — inputs unchanged since <sha>` and lists itself in the job
#           summary as SKIPPED, never as passed. Any other exit, an error
#           included, runs the step exactly as before.
#   record  (a push to main) the same command, run under `strace` by
#           `ci-cone.ts run`, which records what it read. The verdict is the
#           check's own exit status; recording never changes it.
cone=""
if [ -n "${CI_CONE_MODE:-}" ]; then
  body="$(grep -vE '^\s*(#|$)' "$script" || true)"
  if [ "$(printf '%s\n' "$body" | wc -l)" -eq 1 ] && [[ "$body" =~ ^[[:space:]]*bun\ run\ (cat\ )?([A-Za-z0-9:_-]+)[[:space:]]*$ ]]; then
    cone="${BASH_REMATCH[2]}"
  fi
fi
cone_cli="$(dirname "$0")/ci-cone.ts"
if [ -n "$cone" ] && [ "$CI_CONE_MODE" = "skip" ] && bun "$cone_cli" decide "$cone"; then
  rm -f "$log"
  exit 0
fi
if [ -n "$cone" ] && [ "$CI_CONE_MODE" = "record" ]; then
  bun "$cone_cli" run "$cone" 2>&1 | tee "$log"
  status="${PIPESTATUS[0]}"
  # A recorder killed by a signal (exit >= 128) has said nothing about the
  # check, so the step runs again exactly as written and that is the verdict.
  if [ "$status" -ge 128 ]; then
    echo "gate-shell: the CI cone recorder exited $status; running the step untraced"
    bash -e "$script" 2>&1 | tee "$log"
    status="${PIPESTATUS[0]}"
  fi
else
  bash -e "$script" 2>&1 | tee "$log"
  status="${PIPESTATUS[0]}"
fi

# A green step writes nothing. A green run's summary is noise, and noise in
# `output.summary` is worse than silence because it is read by tools.
if [ "$status" -ne 0 ] && [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### ✗ \`${GITHUB_JOB:-?}\` — exit ${status}"
    echo

    # WHAT RAN, because there is no env var naming the current step. The
    # script's own non-comment lines are the identification — for a
    # single-line step that is literally `bun run cat check:tools`.
    echo "<details><summary>the step</summary>"
    echo
    echo '````````sh'
    grep -vE '^\s*(#|$)' "$script" | head -40
    echo '````````'
    echo
    echo "</details>"
    echo

    # SAY SO when there was no output, rather than printing an empty fence.
    # `set -e` aborting on a bare `false` is exactly this case, and an empty
    # block reads as "the capture failed" — which is the one thing a reader
    # of this file must never have to wonder about.
    if [ -s "$log" ]; then
      # The tail, not the head: a gate that prints 400 green lines and then
      # one ✗ keeps the ✗. Bounded twice — GitHub caps a step summary at
      # 1 MiB and drops the WHOLE file when it is exceeded, so an unbounded
      # append loses the thing it was written for.
      echo "last 200 lines:"
      echo
      echo '````````'
      tail -n 200 "$log" | tail -c 60000
      echo '````````'
    else
      echo "The step printed nothing before failing — so the exit status above"
      echo "is the whole of what it reported. With \`bash -e\` that is typically"
      echo "a bare command returning non-zero rather than a gate's own verdict."
    fi
  } >> "$GITHUB_STEP_SUMMARY"
fi

# AND AN ANNOTATION, which is the part a reader outside the log host can
# actually fetch.
#
# This is here because the step summary ALONE does not do the job this script
# exists for. Measured on #2016, on a real red `Repository gates (hard)`:
#
#     output.title    null
#     output.summary  null
#     annotations     [failure] "Process completed with exit code 1."
#
# `$GITHUB_STEP_SUMMARY` renders on the run page and does NOT populate the
# check run's `output.summary`. The premise this script was first written on
# was simply false. Annotations ARE served -- by
# `GET /repos/{owner}/{repo}/check-runs/{id}/annotations` -- and that is how
# the previous failure on this branch was diagnosed from a container that
# cannot reach the log host at all.
#
# So the summary stays for a person reading the run page, and the annotation
# carries the same verdict to everyone else.
if [ "$status" -ne 0 ]; then
  # `::error::` takes ONE line. A literal newline would end the command and
  # spill the rest into the log as plain text, so newlines travel as `%0A` --
  # and `%` must be escaped FIRST or it would eat the escapes that follow.
  #
  # Bounded hard at 24 lines / 3500 characters. GitHub truncates a long
  # annotation silently and shows at most 10 error annotations per step, so a
  # generous limit loses the verdict rather than preserving it. The TAIL again:
  # a gate prints its ✗ last.
  detail=$(tail -n 24 "$log" | tail -c 3500 \
    | sed -e 's/%/%25/g' -e 's/\r/%0D/g' \
    | awk '{ printf "%s%%0A", $0 }')
  # The command needs the SAME escaping as the detail: a gate whose name or
  # output contains a `%` would otherwise corrupt the annotation. Found by
  # testing a step that prints `50%`.
  cmd=$(grep -vE '^\s*(#|$)' "$script" | head -3 | tr '\n' ' ' | cut -c1-200 \
    | sed -e 's/%/%25/g')
  if [ -n "$detail" ]; then
    echo "::error title=${GITHUB_JOB:-gate} failed (exit ${status})::${cmd}%0A%0A${detail}"
  else
    echo "::error title=${GITHUB_JOB:-gate} failed (exit ${status})::${cmd}%0A%0A(the step printed nothing before failing)"
  fi
fi

rm -f "$log"
exit "$status"
