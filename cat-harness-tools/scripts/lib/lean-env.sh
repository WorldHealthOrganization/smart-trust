#!/usr/bin/env bash
# Shared Lean environment helpers for session hooks.
#
# Source this file to get:
#   - PATH set up for elan/lean/lake/uv/bun
#   - LEAN_DIR pointing to the Lean project
#   - REPO_ROOT pointing to the repo root
#   - has()          — check if a command exists
#   - lean_mode()    — detect lean availability mode (local/remote/local-degraded/none)
#   - lean_fix_hint()— suggest what to run to fix missing lean
#
# Usage:
#   source "$(dirname "$0")/lib/lean-env.sh"

# ── Paths ──────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LEAN_DIR="$REPO_ROOT/content/quantum-observable-universe/lean"

export PATH="$HOME/.elan/bin:$HOME/.local/bin:$HOME/.bun/bin:$PATH"

# ── Helpers ────────────────────────────────────────────────────────
has() { command -v "$1" &>/dev/null; }

# ── Remote MCP URL (from lean-mcp.config.json) ────────────────────
_lean_remote_url() {
  local config="$REPO_ROOT/lean-mcp.config.json"
  if [ -f "$config" ] && has python3; then
    local domain
    domain=$(python3 -c "import json; print(json.load(open('$config')).get('folio',{}).get('domain',''))" 2>/dev/null || true)
    [ -n "$domain" ] && echo "https://$domain/mcp"
  fi
}

# ── Lean mode detection ───────────────────────────────────────────
# Sets these variables:
#   LEAN_OK        — lean binary found
#   LEAN_VER       — lean --version output
#   UV_OK          — uv binary found
#   DEPS_OK        — lake-manifest.json present and deps match
#   CACHE_OK       — Mathlib oleans present
#   LEAN_LOCAL_READY — fully ready for local use
#   LEAN_REMOTE_OK — remote MCP reachable
#   LEAN_MODE      — local / remote / local-degraded / none
lean_detect() {
  LEAN_OK=false; LEAN_VER=""; UV_OK=false
  DEPS_OK=true; CACHE_OK=true
  LEAN_LOCAL_READY=false; LEAN_REMOTE_OK=false
  LEAN_MODE="none"

  has uv && UV_OK=true
  if has lean; then
    LEAN_OK=true
    LEAN_VER=$(lean --version 2>&1 | head -1)

    # Check deps
    if [ -f "$LEAN_DIR/lakefile.toml" ] && [ ! -f "$LEAN_DIR/lake-manifest.json" ]; then
      DEPS_OK=false
    fi
    # Check Mathlib cache
    if [ ! -d "$LEAN_DIR/.lake/packages/mathlib/.lake/build/lib" ] 2>/dev/null; then
      CACHE_OK=false
    fi

    if [ "$UV_OK" = true ] && [ "$DEPS_OK" = true ] && [ "$CACHE_OK" = true ]; then
      LEAN_LOCAL_READY=true
      LEAN_MODE="local"
    else
      LEAN_MODE="local-degraded"
    fi
  fi

  # Check remote
  local remote_url
  remote_url=$(_lean_remote_url)
  if [ -n "$remote_url" ]; then
    if curl -sf --max-time 3 -o /dev/null "$remote_url" 2>/dev/null; then
      LEAN_REMOTE_OK=true
      [ "$LEAN_MODE" = "none" ] && LEAN_MODE="remote"
    fi
  fi
}

# ── Local Mathlib cache ──────────────────────────────────────────
# Uses git insteadOf to redirect mathlib4 fetches to a local clone,
# avoiding re-downloading on every fresh .lake/ build.
#
# Config: lean-mcp.config.json → lean.local_mathlib_path (relative to REPO_ROOT)
#         lean-mcp.config.json → lean.mathlib_git_url (upstream URL to redirect)

_mathlib_config() {
  local config="$REPO_ROOT/lean-mcp.config.json"
  if [ -f "$config" ] && has python3; then
    python3 -c "
import json, sys
c = json.load(open('$config')).get('lean', {})
print(c.get('$1', '$2'))
" 2>/dev/null
  else
    echo "$2"
  fi
}

# Resolve the local mathlib path (absolute).
mathlib_local_path() {
  local rel
  rel=$(_mathlib_config local_mathlib_path "../mathlib4")
  local abs_path
  # Resolve relative to REPO_ROOT
  abs_path=$(cd "$REPO_ROOT" && realpath -m "$rel" 2>/dev/null || echo "$REPO_ROOT/$rel")
  echo "$abs_path"
}

# The upstream git URL that Lake uses for mathlib.
mathlib_git_url() {
  _mathlib_config mathlib_git_url "https://github.com/leanprover-community/mathlib4"
}

# Check if local mathlib clone exists and is a git repo.
mathlib_local_available() {
  local mpath
  mpath=$(mathlib_local_path)
  [ -d "$mpath/.git" ]
}

# Check how stale the local mathlib clone is (days since last fetch).
# Returns the number of days, or "unknown" if can't determine.
mathlib_local_age_days() {
  local mpath
  mpath=$(mathlib_local_path)
  if [ -f "$mpath/.git/FETCH_HEAD" ]; then
    local fetch_time now_time
    fetch_time=$(stat -c %Y "$mpath/.git/FETCH_HEAD" 2>/dev/null || stat -f %m "$mpath/.git/FETCH_HEAD" 2>/dev/null)
    now_time=$(date +%s)
    if [ -n "$fetch_time" ]; then
      echo $(( (now_time - fetch_time) / 86400 ))
      return
    fi
  fi
  echo "unknown"
}

# Enable git insteadOf so Lake uses local mathlib clone.
# This sets a local (repo-level) git config, not global.
mathlib_enable_local_redirect() {
  local mpath git_url
  mpath=$(mathlib_local_path)
  git_url=$(mathlib_git_url)

  if ! mathlib_local_available; then
    echo "No local mathlib at $mpath — skipping redirect"
    return 1
  fi

  # Set repo-local git config (only affects this repo's .lake/ fetches)
  git -C "$LEAN_DIR" config --local "url.file://${mpath}.insteadOf" "$git_url" 2>/dev/null || true
  # Also handle SSH variant
  git -C "$LEAN_DIR" config --local "url.file://${mpath}.insteadOf" "git@github.com:leanprover-community/mathlib4.git" 2>/dev/null || true
  echo "Redirecting mathlib fetches to local clone: $mpath"
}

# Disable the redirect (restore normal GitHub fetching).
mathlib_disable_local_redirect() {
  local git_url
  git_url=$(mathlib_git_url)
  git -C "$LEAN_DIR" config --local --unset-all "url.file://$(mathlib_local_path).insteadOf" 2>/dev/null || true
}

# Update the local mathlib clone (git fetch).
mathlib_update_local() {
  local mpath
  mpath=$(mathlib_local_path)
  if mathlib_local_available; then
    echo "Updating local mathlib at $mpath..."
    git -C "$mpath" fetch --all --prune 2>&1 | tail -5
  else
    echo "No local mathlib at $mpath"
    return 1
  fi
}

# ── Fix hint ──────────────────────────────────────────────────────
lean_fix_hint() {
  case "$LEAN_MODE" in
    local) echo "" ;;
    local-degraded)
      if [ "$UV_OK" = false ]; then
        echo "Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh"
      elif [ "$DEPS_OK" = false ]; then
        echo "Run: cd content/quantum-observable-universe/lean && lake update"
      elif [ "$CACHE_OK" = false ]; then
        echo "Run: cd content/quantum-observable-universe/lean && lake exe cache get"
      fi
      ;;
    remote) echo "" ;;
    none) echo "Use paper-assistant MCP tool: lean_setup" ;;
  esac
}
