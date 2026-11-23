#!/usr/bin/env bash
#
# Hook script: re-render content on .ts/.md changes and sync to Google Drive.
#
# Called by Claude Code PostToolUse hook after Edit/Write operations.
# Checks if any files under content/ were modified and triggers:
#   1. TeX block rendering (local pdflatex or Docker paper-assistant fallback)
#   2. JSON export for the viewer
#   3. Per-block standalone PDF render for each changed block  [if latexmk available]
#   4. Push changed block PDFs to Google Drive                 [if Drive configured]
#
# Exit 0 always — rendering failures should not block the edit.
#
set -uo pipefail

REPO_ROOT="$(bash "$(dirname "$0")/lib/harness-root.sh")"
source "$REPO_ROOT/scripts/lib/docker-tex.sh"

# Only trigger for content file changes (.ts or .md under content/)
if ! git diff --name-only 2>/dev/null | grep -q '^content/.*\.\(md\|ts\)$'; then
  exit 0
fi

echo "[render-on-change] Content file changed, re-rendering..."

# ── Step 1: Re-render TeX inline blocks (```tex…``` → SVG) ───────────────────
if git diff --name-only 2>/dev/null | grep -q '^content/.*\.md$'; then
  if tex_local; then
    bun run "$REPO_ROOT/scripts/render-tex/render-tex-blocks.ts" 2>&1 | sed 's/^/  /' || true
  elif tex_docker_ready; then
    echo "[render-on-change] Using Docker paper-assistant image for TeX rendering..."
    docker_tex_run bun run cat-harness-tools/scripts/render-tex/render-tex-blocks.ts 2>&1 | sed 's/^/  /' || true
  elif tex_docker_available; then
    echo "[render-on-change] WARNING: TeX not installed locally and Docker image not pulled."
    echo "[render-on-change] Run: docker pull $PAPER_IMAGE"
  else
    echo "[render-on-change] WARNING: No TeX available (local or Docker), SVGs may be stale"
  fi
fi

# ── Step 2: Re-export JSON for viewer ────────────────────────────────────────
if command -v bun &>/dev/null; then
  bun run "$REPO_ROOT/pipeline/export-json.ts" 2>&1 | sed 's/^/  /' || true
fi

# ── Step 3 + 4: Per-block standalone PDF render + optional Drive push ─────────
# Local latexmk only: render-changed-blocks needs bun + latexmk in-process.
#
# NOTE ON EGRESS: when Drive is configured, this pushes rendered block PDFs
# to a third-party service on EVERY content edit, with no per-upload
# confirmation. Configuring `googleDrive.folderPath` (or GDRIVE_FOLDER_PATH)
# is what turns that on; leaving it unset keeps everything local.
if command -v bun &>/dev/null && tex_local; then
  echo "[render-on-change] Rendering changed block PDFs..."

  # Check whether Drive is configured
  DRIVE_CONFIGURED=false
  if [[ -n "${GDRIVE_FOLDER_PATH:-}" ]]; then
    DRIVE_CONFIGURED=true
  elif [[ -f "$REPO_ROOT/harness.config.json" ]]; then
    FOLDER="$(python3 -c "
import json
try:
  cfg=json.load(open('$REPO_ROOT/harness.config.json'))
  print((cfg.get('googleDrive') or {}).get('folderPath',''))
except Exception:
  pass
" 2>/dev/null || true)"
    [[ -n "${FOLDER:-}" ]] && DRIVE_CONFIGURED=true
  fi

  DRIVE_FLAG=""
  if [[ "$DRIVE_CONFIGURED" == "true" ]]; then
    DRIVE_FLAG="--upload-drive"
    echo "[render-on-change] Google Drive configured — will push block PDFs"
  fi

  # shellcheck disable=SC2086
  bun run "$REPO_ROOT/scripts/render-changed-blocks.ts" \
    $DRIVE_FLAG \
    2>&1 | sed 's/^/  /' || true
elif tex_docker_ready && command -v bun &>/dev/null; then
  echo "[render-on-change] latexmk not local — block PDF render skipped (Docker tex available but render-changed-blocks needs local bun+latexmk)"
fi

echo "[render-on-change] Done."
