#!/usr/bin/env bash
# rename-special-branch.sh — rename a special branch (or a family of them) on
# a GitHub repository, safely. Bean folio-assistant-32f6; the names are
# declared on the owning directory's `storage` (special-branches.json is gone).
#
# Needs nothing but git and push access. It does NOT use your checkout: it
# fetches into a throwaway bare repository in a temp directory, so it does not
# matter what you have cloned, fetched or switched to.
#
# Usage:
#   rename-special-branch.sh <owner/repo> <old> <new>            # dry run: shows the plan
#   rename-special-branch.sh <owner/repo> <old> <new> --apply    # does it
#
#   <old> ending in "/" renames a FAMILY: every branch starting with <old>
#   gets <old> replaced by <new>  (e.g. lake-cache/ cat/<layer>/lake-cache/).
#
# Examples:
#   rename-special-branch.sh litlfred/folio-assistant state cat/cat-harness/state --apply
#   rename-special-branch.sh litlfred/smart-trust fhir-ast/ cat/fhir-harness/fhir-ast/ --apply
#
# Fail-safe, per branch, in this order — any failure stops before the next step:
#   1. the old branch is read and its commit (SHA) recorded;
#   2. if the new name already exists: same SHA -> only the old one is left to
#      remove; different SHA -> STOP, nothing is touched (someone wrote to it);
#   3. the new branch is created at exactly that SHA;
#   4. the new branch is read back from GitHub and must equal that SHA;
#   5. the old branch is deleted ONLY IF it still points at that SHA (a lease):
#      if anybody pushed to it in the meantime, the delete is refused and both
#      branches are kept for you to look at.
# Nothing is ever force-pushed. Re-running is safe: finished renames are skipped.
set -euo pipefail

usage() { sed -n '2,31p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-2}"; }
[ "$#" -ge 3 ] || usage
REPO="$1"; OLD="$2"; NEW="$3"; APPLY=0
[ "${4:-}" = "--apply" ] && APPLY=1
[ "${4:-}" = "" ] || [ "$APPLY" = 1 ] || usage
case "$REPO" in */*) ;; *) echo "repo must be owner/name, got: $REPO" >&2; exit 2;; esac
case "$OLD/$NEW" in *" "*) echo "branch names cannot contain spaces" >&2; exit 2;; esac
if [ "${OLD%/}" != "$OLD" ] && [ "${NEW%/}" = "$NEW" ]; then
  echo "a family rename needs both names to end in /: $OLD -> $NEW" >&2; exit 2
fi
[ "$OLD" != "$NEW" ] || { echo "old and new are the same" >&2; exit 2; }

URL="${RENAME_SPECIAL_BRANCH_URL:-https://github.com/$REPO}"   # override is for tests only
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git init -q --bare "$TMP/r.git"
G() { git -C "$TMP/r.git" "$@"; }

remote_sha() { git ls-remote --heads "$URL" "refs/heads/$1" | awk '{print $1}'; }

# The branches to rename: one, or every branch under the family prefix.
if [ "${OLD%/}" != "$OLD" ]; then
  mapfile -t BRANCHES < <(git ls-remote --heads "$URL" "refs/heads/${OLD}*" | sed 's#.*refs/heads/##')
else
  mapfile -t BRANCHES < <(git ls-remote --heads "$URL" "refs/heads/$OLD" | sed 's#.*refs/heads/##')
fi

if [ "${#BRANCHES[@]}" -eq 0 ]; then
  if [ -n "$(git ls-remote --heads "$URL" "refs/heads/${NEW}*")" ]; then
    echo "OK: nothing named $OLD on $REPO, and $NEW exists — already renamed."
    exit 0
  fi
  echo "STOP: no branch $OLD on $REPO (and no $NEW either). Check the names." >&2
  exit 1
fi

[ "$APPLY" = 1 ] && MODE="APPLY" || MODE="DRY RUN (add --apply to do it)"
echo "$MODE — $REPO: ${#BRANCHES[@]} branch(es)"
fail=0
for b in "${BRANCHES[@]}"; do
  n="$NEW${b#"$OLD"}"
  sha="$(remote_sha "$b")"
  have="$(remote_sha "$n")"
  printf '  %s (%s) -> %s\n' "$b" "${sha:0:12}" "$n"
  if [ -n "$have" ] && [ "$have" != "$sha" ]; then
    echo "    STOP: $n already exists at ${have:0:12}, a different commit. Nothing changed for this branch." >&2
    fail=1; continue
  fi
  [ "$APPLY" = 1 ] || continue

  if [ -z "$have" ]; then
    G fetch -q "$URL" "refs/heads/$b:refs/heads/$b"
    [ "$(G rev-parse "refs/heads/$b")" = "$sha" ] || { echo "    STOP: $b moved while fetching; re-run." >&2; fail=1; continue; }
    G push -q "$URL" "$sha:refs/heads/$n"
  else
    echo "    $n already at the same commit — only removing $b"
  fi
  if [ "$(remote_sha "$n")" != "$sha" ]; then
    echo "    STOP: $n did not read back as ${sha:0:12}; $b kept." >&2
    fail=1; continue
  fi
  echo "    created $n at ${sha:0:12} (verified)"
  if G push -q --force-with-lease="refs/heads/$b:$sha" "$URL" ":refs/heads/$b"; then
    echo "    removed $b"
  else
    echo "    KEPT $b: it changed since ${sha:0:12}, so it was not deleted. Both names exist; look before re-running." >&2
    fail=1
  fi
done

[ "$APPLY" = 1 ] && echo "Now on $REPO:" && git ls-remote --heads "$URL" "refs/heads/${OLD}*" "refs/heads/${NEW}*" | sed 's#.*refs/heads/#    #'
[ "$fail" = 0 ] && echo "DONE" || { echo "FINISHED WITH STOPS — see the lines marked STOP/KEPT above." >&2; exit 1; }
