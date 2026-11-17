#!/usr/bin/env bash
#
# Start the Folio Assistant MCP server.
#
# Usage:
#   ./scripts/start-folio-assistant.sh              # stdio mode (for .mcp.json)
#   ./scripts/start-folio-assistant.sh --http       # HTTP mode (for remote/Docker)
#   ./scripts/start-folio-assistant.sh --install    # install deps first, then start
#   ./scripts/start-folio-assistant.sh --check      # just check deps, don't start
#
# Works on: ChromeOS/Crostini, macOS, Ubuntu, any POSIX system with bun.
#
set -euo pipefail

TARGET_REPO="${PWD}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(bash "$SCRIPT_DIR/lib/harness-root.sh")"
ASSISTANT_DIR="$REPO_ROOT"
# Legacy path (fallback if folio-assistant/ not yet set up)
MCP_DIR="$REPO_ROOT/scripts/mcp-server"

# ── Auto-commit dirty feedback files before anything else ──────
# Prevents "untracked working tree files would be overwritten" errors
# when switching branches.
if [ -d "$REPO_ROOT/feedback" ]; then
  cd "$REPO_ROOT"
  if git diff --name-only HEAD -- feedback/ 2>/dev/null | grep -q . ||
     git diff --cached --name-only -- feedback/ 2>/dev/null | grep -q . ||
     git ls-files --others --exclude-standard -- feedback/ 2>/dev/null | grep -q .; then
    git add feedback/
    git commit -m "auto-save feedback before startup" --no-verify -- feedback/ 2>/dev/null && \
      echo "[start-folio-assistant] auto-committed dirty feedback files" >&2 || true
  fi
fi

MODE="--stdio"
DO_INSTALL=false
CHECK_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --http)    MODE="--http" ;;
    --stdio)   MODE="--stdio" ;;
    --install) DO_INSTALL=true ;;
    --check)   CHECK_ONLY=true ;;
    --help|-h)
      echo "Usage: $0 [--stdio|--http] [--install] [--check]"
      echo ""
      echo "  --stdio    Start in stdio mode (default, for .mcp.json)"
      echo "  --http     Start in HTTP mode (for remote/Docker, port 8080)"
      echo "  --install  Run full dependency install before starting"
      echo "  --check    Just check dependencies, don't start the server"
      exit 0
      ;;
  esac
done

# ── Ensure tool PATH (bun + lean toolchain + uv) ────────────────
#
# The MCP server's lean_* tools probe for `lean`/`lake`/`elan` via
# `command -v`, so they need `~/.elan/bin` on PATH. Similarly,
# `uv` (used by paper-search-mcp etc.) lives at `~/.local/bin`.
# Prepend both unconditionally — harmless if the directories
# don't exist; required if they do.

export PATH="$HOME/.bun/bin:$HOME/.elan/bin:$HOME/.local/bin${PATH:+:${PATH}}"

if ! command -v bun &>/dev/null; then
  echo "[start-folio-assistant] bun not found. Installing..." >&2
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# ── Full install if requested ────────────────────────────────────

if $DO_INSTALL; then
  echo "[start-folio-assistant] Running full install..." >&2
  bash "$MCP_DIR/install.sh"
fi

# ── Determine which server to use ─────────────────────────────────
# Prefer folio-assistant/ (new architecture) over scripts/mcp-server/ (legacy).

USE_NEW=false
if [ -f "$ASSISTANT_DIR/package.json" ] && [ -f "$ASSISTANT_DIR/src/index.ts" ]; then
  USE_NEW=true
  SERVER_DIR="$ASSISTANT_DIR"
else
  SERVER_DIR="$MCP_DIR"
fi

# ── Ensure server node_modules are up to date ────────────────────
# Re-run bun install if node_modules is missing OR package.json is
# newer than the lockfile (i.e. a dependency was added/changed).

if [ ! -d "$SERVER_DIR/node_modules" ] \
  || [ "$SERVER_DIR/package.json" -nt "$SERVER_DIR/bun.lock" ] 2>/dev/null \
  || [ ! -f "$SERVER_DIR/bun.lock" ]; then
  echo "[start-folio-assistant] Installing server dependencies..." >&2
  cd "$SERVER_DIR" && bun install 2>&1 >&2
fi

# ── Ensure content pipeline node_modules exist ───────────────────

if [ -d "$REPO_ROOT/content" ] && [ ! -d "$REPO_ROOT/content/node_modules" ]; then
  echo "[start-folio-assistant] Installing content pipeline dependencies..." >&2
  cd "$REPO_ROOT/content" && bun install 2>&1 >&2
fi

# ── Quick dependency status ─────────────────────────────────────
# Always show what's available so the user knows what features work.

_check() { command -v "$1" &>/dev/null && echo "✓" || echo "✗"; }

echo "" >&2
echo "[start-folio-assistant] Dependency status:" >&2

# Required
for cmd in bun latexmk pdflatex; do
  printf "  %s %-12s (required)\n" "$(_check "$cmd")" "$cmd" >&2
done

# Optional
for cmd in pandoc pdftoppm lean lake uv rg xdg-open; do
  printf "  %s %-12s (optional)\n" "$(_check "$cmd")" "$cmd" >&2
done

# Count missing required
MISSING=0
for cmd in bun latexmk pdflatex; do
  command -v "$cmd" &>/dev/null || MISSING=$((MISSING + 1))
done
if [ "$MISSING" -gt 0 ]; then
  echo "" >&2
  echo "  ⚠  $MISSING required dep(s) missing — some features disabled." >&2
  echo "     Run: ./scripts/start-folio-assistant.sh --check  for install hints" >&2
fi
echo "" >&2

# ── Check-only mode ─────────────────────────────────────────────

if $CHECK_ONLY; then
  if $USE_NEW; then
    cd "$ASSISTANT_DIR"
    exec bun run cat-harness-tools/src/index.ts --check-deps
  else
    cd "$MCP_DIR"
    exec bun run server.ts --check-deps
  fi
fi

# ── Start server ─────────────────────────────────────────────────

if $USE_NEW; then
  echo "[start-folio-assistant] Starting folio-assistant (new architecture)..." >&2
  cd "$ASSISTANT_DIR"
  exec bun run cat-harness-tools/src/index.ts "$MODE" --repo "$TARGET_REPO"
else
  echo "[start-folio-assistant] Starting legacy MCP server..." >&2
  cd "$MCP_DIR"
  exec bun run server.ts "$MODE" --repo "$TARGET_REPO"
fi
