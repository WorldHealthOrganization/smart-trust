#!/usr/bin/env bash
# upload-to-uploads.sh — download a file (idempotently) and add it
# to the `uploads/` intake directory of the litlfred/qou repo.
#
# Usage:
#   scripts/upload-to-uploads.sh <source-url-or-path> [target-name] [-- <gh-pr-args>]
#   scripts/upload-to-uploads.sh --help
#
# Examples:
#   # Download a PDF from arxiv.org, upload as uploads/2402.12345v3.pdf
#   scripts/upload-to-uploads.sh https://arxiv.org/pdf/2402.12345v3
#
#   # Use a local file, custom target name, open a PR with title
#   scripts/upload-to-uploads.sh ~/Downloads/who-l2-2024.pdf who-l2-2024.pdf -- \
#       --title "intake: WHO L2 guideline 2024" --body "Source: who.int/..."
#
# Behaviour:
#   1. If <source> is a URL → curl it (resume-friendly, follows redirects,
#      User-Agent set). If a local path → cp.
#   2. Idempotency: if uploads/<target> already exists with the same
#      sha256, skip the download/copy step entirely.
#   3. Git remote is forced to SSH (git@github.com:litlfred/qou.git) if
#      it's currently HTTPS — needs ~/.ssh/id_* key set up for github.com.
#      ssh -T git@github.com is run as a connectivity smoke-test.
#   4. A new branch claude/upload-<basename>-<utc-ymd> is created off
#      the current default branch (main), uploads/<target> is committed
#      and pushed via SSH.
#   5. If `gh` CLI is available AND extra args after `--` are present,
#      `gh pr create` is invoked with those args to open a PR. Otherwise
#      the branch is left pushed for manual PR creation.
#
# Requires:
#   - bash >= 4
#   - curl (for URL downloads)
#   - sha256sum
#   - git with the litlfred/qou remote accessible over SSH
#   - ~/.ssh/id_* (or ssh-agent / ~/.ssh/config) authorised on github.com
#   - gh CLI (optional — only needed if you pass `-- --title ...` args)

set -euo pipefail

REPO_SLUG="litlfred/qou"
SSH_REMOTE="git@github.com:${REPO_SLUG}.git"
UPLOADS_DIR="uploads"
DEFAULT_BRANCH="main"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" || $# -eq 0 ]]; then
  sed -n '2,/^$/p' "$0" | sed 's/^# \?//'
  exit 0
fi

SOURCE="$1"; shift
TARGET=""
GH_PR_ARGS=()

# Parse optional positional target + optional `-- <gh-args>`
if [[ $# -gt 0 && "${1:-}" != "--" ]]; then
  TARGET="$1"
  shift
fi
if [[ "${1:-}" == "--" ]]; then
  shift
  GH_PR_ARGS=("$@")
fi

# Derive target name if not given
if [[ -z "$TARGET" ]]; then
  TARGET="$(basename "$SOURCE" | sed 's/[?#].*$//')"
  if [[ -z "$TARGET" || "$TARGET" == "/" ]]; then
    echo "ERROR: could not derive target name from '$SOURCE'; pass it explicitly" >&2
    exit 2
  fi
fi

# Find repo root (script lives in scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(bash "$SCRIPT_DIR/lib/harness-root.sh")"
cd "$REPO_ROOT"

mkdir -p "$UPLOADS_DIR"
TARGET_PATH="$UPLOADS_DIR/$TARGET"

# ─── Idempotent fetch ──────────────────────────────────────────
if [[ -f "$TARGET_PATH" ]]; then
  echo "[skip] $TARGET_PATH already exists ($(du -h "$TARGET_PATH" | cut -f1))"
elif [[ "$SOURCE" =~ ^https?:// ]]; then
  echo "[curl] $SOURCE → $TARGET_PATH"
  TMP="$(mktemp)"
  trap 'rm -f "$TMP"' EXIT
  curl --fail --silent --show-error --location \
       --user-agent "qou-upload-to-uploads/1.0 (+https://github.com/${REPO_SLUG})" \
       --output "$TMP" \
       "$SOURCE"
  mv "$TMP" "$TARGET_PATH"
  trap - EXIT
elif [[ -f "$SOURCE" ]]; then
  echo "[cp]   $SOURCE → $TARGET_PATH"
  cp "$SOURCE" "$TARGET_PATH"
else
  echo "ERROR: '$SOURCE' is neither a URL nor an existing file" >&2
  exit 2
fi

SIZE="$(stat -c%s "$TARGET_PATH" 2>/dev/null || stat -f%z "$TARGET_PATH")"
SHA="$(sha256sum "$TARGET_PATH" | cut -d' ' -f1)"
echo "[file] $TARGET_PATH  size=${SIZE}B  sha256=${SHA:0:16}…"

# ─── Git remote setup (force SSH) ──────────────────────────────
CURRENT_REMOTE="$(git remote get-url origin 2>/dev/null || true)"
if [[ "$CURRENT_REMOTE" != "$SSH_REMOTE" ]]; then
  if [[ -z "$CURRENT_REMOTE" ]]; then
    echo "[git] adding origin → $SSH_REMOTE"
    git remote add origin "$SSH_REMOTE"
  else
    echo "[git] switching origin from '$CURRENT_REMOTE' to '$SSH_REMOTE'"
    git remote set-url origin "$SSH_REMOTE"
  fi
fi

# SSH connectivity smoke-test (non-fatal: github auth answers with exit 1
# but a recognisable success message).
SSH_PROBE="$(ssh -o StrictHostKeyChecking=accept-new -T git@github.com 2>&1 || true)"
if echo "$SSH_PROBE" | grep -qi "successfully authenticated"; then
  echo "[ssh] github.com auth OK ($(echo "$SSH_PROBE" | head -1))"
else
  echo "WARN: ssh -T git@github.com did not return the expected success message:" >&2
  echo "$SSH_PROBE" | head -3 >&2
  echo "      Make sure your ~/.ssh/id_* key is in ssh-agent (or ~/.ssh/config)" >&2
  echo "      and authorised on github.com. Continuing anyway." >&2
fi

# ─── Branch + commit + push ────────────────────────────────────
# Explicit refspec: the new branch is cut from origin/$DEFAULT_BRANCH below, and
# a bare `git fetch origin <branch>` refreshes that tracking ref only when the
# clone's configured refspec covers it — silently rooting the upload on a stale
# base otherwise. See bean 9giz.
git fetch origin "+refs/heads/$DEFAULT_BRANCH:refs/remotes/origin/$DEFAULT_BRANCH" --quiet 2>/dev/null || true

UTC_YMD="$(date -u +%Y-%m-%d)"
SAFE_NAME="$(echo "$TARGET" | sed 's/[^A-Za-z0-9._-]/-/g' | cut -c1-40)"
BRANCH="claude/upload-${SAFE_NAME}-${UTC_YMD}"
echo "[git] new branch: $BRANCH (off origin/$DEFAULT_BRANCH)"
if git rev-parse --verify --quiet "$BRANCH" >/dev/null; then
  # Idempotent re-run: branch already exists locally (Gemini #820).
  echo "[git] branch $BRANCH already exists locally; checking out"
  git checkout "$BRANCH"
else
  echo "[git] new branch: $BRANCH (off origin/$DEFAULT_BRANCH)"
  git checkout -b "$BRANCH" "origin/$DEFAULT_BRANCH"
fi

git add "$TARGET_PATH"
if git diff --cached --quiet; then
  echo "[git] nothing to commit (uploads/$TARGET unchanged); aborting"
  git checkout -
  git branch -D "$BRANCH"
  exit 0
fi

git commit -m "intake: upload ${TARGET} (size=${SIZE}B, sha256=${SHA:0:12})"

echo "[git] push -u origin $BRANCH"
git push -u origin "$BRANCH"

PUSHED_URL="https://github.com/${REPO_SLUG}/tree/${BRANCH}"
echo "[ok]  branch pushed: $PUSHED_URL"

# ─── Optional gh pr create ─────────────────────────────────────
if [[ ${#GH_PR_ARGS[@]} -gt 0 ]]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "WARN: gh CLI not found; cannot auto-open PR." >&2
    echo "      Open one manually at: $PUSHED_URL" >&2
    exit 0
  fi
  echo "[gh]  creating PR..."
  gh pr create --base "$DEFAULT_BRANCH" --head "$BRANCH" "${GH_PR_ARGS[@]}"
else
  echo "[ok]  pass extra '-- --title ... --body ...' args to auto-open a PR;"
  echo "      otherwise open manually at: $PUSHED_URL"
fi
