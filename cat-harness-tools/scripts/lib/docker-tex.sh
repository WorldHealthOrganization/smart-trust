#!/usr/bin/env bash
# Shared Docker-based TeX helpers for hooks and scripts.
#
# Uses the paper-assistant image (same image as the folio MCP server)
# as a fallback when pdflatex/dvisvgm aren't installed locally.
#
# Source this file to get:
#   - PAPER_IMAGE    — the Docker image name (read from lean-mcp.config.json)
#   - tex_available()— check if TeX is available (local or Docker)
#   - tex_exec()     — run a command with TeX available (local or Docker)
#   - docker_tex_run() — run a command inside the paper-assistant container
#
# Usage:
#   source "$(dirname "$0")/lib/docker-tex.sh"
#   if tex_available; then
#     tex_exec bun run cat-harness-tools/scripts/render-tex/render-tex-blocks.ts
#   fi

# ── Repo root ──────────────────────────────────────────────────────
REPO_ROOT="${REPO_ROOT:-$(bash "$(dirname "${BASH_SOURCE[0]}")/harness-root.sh")}"

# ── Image name (derived from lean-mcp.config.json, single source of truth) ─
_paper_image_from_config() {
  local config="$REPO_ROOT/lean-mcp.config.json"
  if [ -f "$config" ]; then
    # Extract "image" field; sed is always available (unlike jq/python)
    local img
    img=$(sed -n 's/.*"image"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$config" | head -1)
    if [ -n "$img" ]; then
      # Append :latest if no tag/digest present
      case "$img" in
        *@*|*:*) printf '%s\n' "$img" ;;
        *)       printf '%s:latest\n' "$img" ;;
      esac
      return 0
    fi
  fi
  # Fallback if config is missing or unparseable
  printf '%s\n' "ghcr.io/litlfred/qou/paper-assistant:latest"
}
PAPER_IMAGE="$(_paper_image_from_config)"

# ── Helpers ────────────────────────────────────────────────────────
_has() { command -v "$1" &>/dev/null; }

# Check if TeX tools are available locally.
tex_local() {
  _has pdflatex && _has dvisvgm
}

# Check if Docker is available and the paper-assistant image is pulled.
tex_docker_ready() {
  _has docker && docker image inspect "$PAPER_IMAGE" &>/dev/null
}

# Check if Docker is available (image may need pulling).
tex_docker_available() {
  _has docker
}

# Check if TeX is available via any method.
tex_available() {
  tex_local || tex_docker_ready
}

# Pull the paper-assistant image (if Docker is available).
# Returns 0 on success, 1 on failure.
tex_docker_pull() {
  if ! _has docker; then
    echo "[docker-tex] Docker not available" >&2
    return 1
  fi
  echo "[docker-tex] Pulling $PAPER_IMAGE ..." >&2
  local pull_log pull_status
  pull_log=$(mktemp) || return 1
  docker pull "$PAPER_IMAGE" >"$pull_log" 2>&1
  pull_status=$?
  tail -5 "$pull_log" >&2
  rm -f "$pull_log"
  return "$pull_status"
}

# Run a command inside the paper-assistant container with the repo mounted.
# The working directory inside the container matches the caller's relative
# position within the repo.
#
# Usage: docker_tex_run <command> [args...]
docker_tex_run() {
  if ! tex_docker_ready; then
    echo "[docker-tex] Image not available. Run: docker pull $PAPER_IMAGE" >&2
    return 1
  fi

  # Compute working directory relative to repo root
  local rel_cwd
  rel_cwd=$(realpath --relative-to="$REPO_ROOT" "$(pwd)" 2>/dev/null || echo ".")

  # Guard: reject paths outside the repo root
  if [[ "$rel_cwd" == ..* ]]; then
    echo "[docker-tex] Error: Current directory is outside the repository root" >&2
    return 1
  fi

  docker run --rm \
    --entrypoint "" \
    -v "$REPO_ROOT:/workspace" \
    -w "/workspace/$rel_cwd" \
    -e HOME=/root \
    "$PAPER_IMAGE" \
    "$@"
}

# Run a command with TeX available — uses local tools if present,
# falls back to Docker container.
#
# Usage: tex_exec <command> [args...]
tex_exec() {
  if tex_local; then
    "$@"
  elif tex_docker_ready; then
    docker_tex_run "$@"
  else
    echo "[docker-tex] No TeX available (local or Docker)" >&2
    return 1
  fi
}
