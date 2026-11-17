#!/usr/bin/env bash
# Install or align Bun to the pinned version in .bun-version via npm pack.
#
# Pinned version comes from .bun-version (or $BUN_VERSION / $1 if specified).
# Uses `npm pack @oven/bun-<os>-<arch>@<version>` and extracts to $TARGET_DIR/bun
# (default: $HOME/.local/bin, fallback: <checkout>/.local/bin).
#
# Usage:
#   scripts/install-bun.sh               # align to .bun-version if needed
#   scripts/install-bun.sh --force       # reinstall even if already matching
#   scripts/install-bun.sh 1.3.14        # install specific version
#
set -euo pipefail

REPO_ROOT="$(bash "$(dirname "${BASH_SOURCE[0]}")/lib/harness-root.sh")"
CHECKOUT_ROOT="$(cd "$REPO_ROOT/.." 2>/dev/null && pwd || echo "$REPO_ROOT")"

FORCE=0
TARGET_VERSION=""

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    *) if [ -z "$TARGET_VERSION" ]; then TARGET_VERSION="$arg"; fi ;;
  esac
done

if [ -z "$TARGET_VERSION" ]; then
  TARGET_VERSION="${BUN_VERSION:-}"
fi

if [ -z "$TARGET_VERSION" ]; then
  # Find .bun-version
  if [ -f "$CHECKOUT_ROOT/.bun-version" ]; then
    TARGET_VERSION="$(tr -d ' \t\r\n' < "$CHECKOUT_ROOT/.bun-version" 2>/dev/null || true)"
  elif [ -f "$REPO_ROOT/.bun-version" ]; then
    TARGET_VERSION="$(tr -d ' \t\r\n' < "$REPO_ROOT/.bun-version" 2>/dev/null || true)"
  elif [ -f "$CHECKOUT_ROOT/cat-harness/.bun-version" ]; then
    TARGET_VERSION="$(tr -d ' \t\r\n' < "$CHECKOUT_ROOT/cat-harness/.bun-version" 2>/dev/null || true)"
  fi
fi

if [ -z "$TARGET_VERSION" ]; then
  echo "ERROR: could not determine target Bun version (.bun-version not found or empty)." >&2
  exit 2
fi

# Validate target version format (bare X.Y.Z)
if ! printf '%s' "$TARGET_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "ERROR: target version '$TARGET_VERSION' is not a valid bare X.Y.Z version." >&2
  exit 2
fi

# Check if currently installed bun already matches
if [ "$FORCE" -eq 0 ]; then
  CURRENT_BUN=""
  if [ -x "$HOME/.local/bin/bun" ]; then
    CURRENT_BUN="$("$HOME/.local/bin/bun" --version 2>/dev/null | tr -d ' \t\r\n' || true)"
  elif command -v bun >/dev/null 2>&1; then
    CURRENT_BUN="$(bun --version 2>/dev/null | tr -d ' \t\r\n' || true)"
  fi
  if [ "$CURRENT_BUN" = "$TARGET_VERSION" ]; then
    echo "Bun $TARGET_VERSION is already installed and matches target."
    exit 0
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: 'npm' not found on PATH. npm is required to unpack @oven/bun." >&2
  exit 2
fi

if ! command -v tar >/dev/null 2>&1; then
  echo "ERROR: 'tar' not found on PATH." >&2
  exit 2
fi

# Detect platform
uname_s="$(uname -s 2>/dev/null | tr '[:upper:]' '[:lower:]')"
uname_m="$(uname -m 2>/dev/null | tr '[:upper:]' '[:lower:]')"

pkg_os=""
case "$uname_s" in
  linux*) pkg_os="linux" ;;
  darwin*) pkg_os="darwin" ;;
  msys*|mingw*|cygwin*) pkg_os="windows" ;;
  freebsd*) pkg_os="freebsd" ;;
  *)
    echo "ERROR: unsupported operating system '$uname_s'." >&2
    exit 2
    ;;
esac

pkg_arch=""
case "$uname_m" in
  x86_64|amd64) pkg_arch="x64" ;;
  aarch64|arm64) pkg_arch="aarch64" ;;
  *)
    echo "ERROR: unsupported architecture '$uname_m'." >&2
    exit 2
    ;;
esac

pkg_name="@oven/bun-${pkg_os}-${pkg_arch}@${TARGET_VERSION}"

# Select writable target directory
TARGET_DIR=""
for d in "$HOME/.local/bin" "$CHECKOUT_ROOT/.local/bin"; do
  if mkdir -p "$d" 2>/dev/null && [ -w "$d" ]; then
    TARGET_DIR="$d"
    break
  fi
done

if [ -z "$TARGET_DIR" ]; then
  echo "ERROR: neither \$HOME/.local/bin nor \$CHECKOUT_ROOT/.local/bin is writable." >&2
  exit 2
fi

TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'bun-pack.XXXXXX' 2>/dev/null || echo "")"
if [ -z "$TMP_DIR" ] || [ ! -d "$TMP_DIR" ]; then
  echo "ERROR: failed to create temporary directory for npm pack." >&2
  exit 2
fi

trap 'rm -rf "$TMP_DIR" 2>/dev/null || true' EXIT

echo "Fetching ${pkg_name} via npm pack..."
if ! (cd "$TMP_DIR" && npm pack "$pkg_name" --silent >/dev/null 2>&1); then
  echo "ERROR: failed to fetch ${pkg_name} via npm pack." >&2
  exit 1
fi

if ! (cd "$TMP_DIR" && tar xzf *.tgz 2>/dev/null); then
  echo "ERROR: failed to extract ${pkg_name} tarball." >&2
  exit 1
fi

BIN_SOURCE=""
if [ -f "$TMP_DIR/package/bin/bun" ]; then
  BIN_SOURCE="$TMP_DIR/package/bin/bun"
elif [ -f "$TMP_DIR/package/bun" ]; then
  BIN_SOURCE="$TMP_DIR/package/bun"
fi

if [ -z "$BIN_SOURCE" ]; then
  echo "ERROR: extracted package does not contain bun executable." >&2
  exit 1
fi

cp "$BIN_SOURCE" "$TARGET_DIR/bun"
chmod +x "$TARGET_DIR/bun"

INSTALLED_VER="$("$TARGET_DIR/bun" --version 2>/dev/null | tr -d ' \t\r\n' || true)"
if [ "$INSTALLED_VER" != "$TARGET_VERSION" ]; then
  echo "ERROR: installed binary at $TARGET_DIR/bun reported version '$INSTALLED_VER', expected '$TARGET_VERSION'." >&2
  exit 1
fi

echo "Successfully installed Bun $INSTALLED_VER into $TARGET_DIR/bun"
echo "Prepend to PATH: export PATH=\"$TARGET_DIR:\$PATH\""
