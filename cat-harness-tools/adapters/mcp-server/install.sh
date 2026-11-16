#!/usr/bin/env bash
#
# QOU Paper Writing Assistant — Dependency Installer
#
# Detects the OS and installs all required + optional dependencies:
#   Required: bun, latexmk, pdflatex (TeX Live)
#   Optional: pandoc, poppler-utils, lean/elan, uv, ripgrep
#
# Supported platforms:
#   - ChromeOS / Crostini (Debian-based)
#   - Ubuntu 22.04+ / Debian 12+
#   - macOS with MacPorts
#   - macOS with Homebrew (fallback)
#
# Usage:
#   ./scripts/mcp-server/install.sh [--minimal]
#
#   --minimal   Only install required deps (bun, TeX Live, latexmk)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

MINIMAL=false
[[ "${1:-}" == "--minimal" ]] && MINIMAL=true

# ── OS detection ─────────────────────────────────────────────────

detect_os() {
  if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    case "$ID" in
      debian|ubuntu|linuxmint)
        # Check for ChromeOS/Crostini
        if [[ -d /mnt/chromeos ]] || grep -qi "chrome" /proc/version 2>/dev/null; then
          echo "chromeos"
        else
          echo "debian"
        fi
        ;;
      *)
        echo "linux-other"
        ;;
    esac
  elif [[ "$(uname)" == "Darwin" ]]; then
    if command -v port &>/dev/null; then
      echo "macos-macports"
    elif command -v brew &>/dev/null; then
      echo "macos-homebrew"
    else
      echo "macos-none"
    fi
  else
    echo "unknown"
  fi
}

OS=$(detect_os)
echo "Detected OS: $OS"
echo "Repo root: $REPO_ROOT"
echo ""

# ── Helpers ──────────────────────────────────────────────────────

installed() { command -v "$1" &>/dev/null; }

section() {
  echo ""
  echo "── $1 ─────────────────────────────────────────"
}

skip() {
  echo "  ✓ $1 already installed"
}

# ── Bun ──────────────────────────────────────────────────────────

section "Bun (JavaScript runtime)"
if installed bun; then
  skip "bun $(bun --version)"
else
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
  echo "  ✓ bun installed: $(bun --version)"
fi

# ── TeX Live + latexmk ──────────────────────────────────────────

section "TeX Live + latexmk"
if installed latexmk && installed pdflatex; then
  skip "latexmk + pdflatex"
else
  case "$OS" in
    chromeos|debian)
      echo "  Installing texlive and latexmk (this may take a while)..."
      sudo apt-get update -qq
      sudo apt-get install -y -qq \
        texlive-latex-base \
        texlive-latex-recommended \
        texlive-latex-extra \
        texlive-fonts-recommended \
        texlive-fonts-extra \
        texlive-science \
        texlive-pictures \
        latexmk \
        cm-super
      ;;
    macos-macports)
      sudo port install texlive texlive-latex-extra texlive-fonts-extra latexmk
      ;;
    macos-homebrew)
      brew install --cask mactex-no-gui
      brew install latexmk
      ;;
    *)
      echo "  ⚠ Cannot auto-install TeX Live on $OS. Install manually:"
      echo "    https://www.tug.org/texlive/"
      ;;
  esac
  echo "  ✓ TeX Live installed"
fi

if $MINIMAL; then
  section "Minimal install complete"
  echo "  Installed: bun, TeX Live, latexmk"
  echo "  Run without --minimal for pandoc, Lean, ripgrep, etc."
  exit 0
fi

# ── Pandoc ───────────────────────────────────────────────────────

section "Pandoc (LaTeX → HTML)"
if installed pandoc; then
  skip "pandoc $(pandoc --version | head -1)"
else
  case "$OS" in
    chromeos|debian)
      sudo apt-get install -y -qq pandoc
      ;;
    macos-macports)
      sudo port install pandoc
      ;;
    macos-homebrew)
      brew install pandoc
      ;;
  esac
  echo "  ✓ pandoc installed"
fi

# ── poppler-utils (PDF → PNG) ───────────────────────────────────

section "poppler-utils (PDF → PNG conversion)"
if installed pdftoppm; then
  skip "pdftoppm"
else
  case "$OS" in
    chromeos|debian)
      sudo apt-get install -y -qq poppler-utils
      ;;
    macos-macports)
      sudo port install poppler
      ;;
    macos-homebrew)
      brew install poppler
      ;;
  esac
  echo "  ✓ poppler-utils installed"
fi

# ── ripgrep ──────────────────────────────────────────────────────

section "ripgrep (fast search)"
if installed rg; then
  skip "rg $(rg --version | head -1)"
else
  case "$OS" in
    chromeos|debian)
      sudo apt-get install -y -qq ripgrep
      ;;
    macos-macports)
      sudo port install ripgrep
      ;;
    macos-homebrew)
      brew install ripgrep
      ;;
  esac
  echo "  ✓ ripgrep installed"
fi

# ── uv (Python package manager) ─────────────────────────────────

section "uv (Python package manager)"
if installed uv; then
  skip "uv $(uv --version)"
else
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
  echo "  ✓ uv installed: $(uv --version)"
fi

# ── Lean 4 (via elan) ───────────────────────────────────────────

section "Lean 4 (via elan)"
if installed lean; then
  skip "lean $(lean --version 2>/dev/null || echo 'version unknown')"
else
  echo "  Installing elan + Lean toolchain..."
  curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | \
    sh -s -- -y --default-toolchain none
  export PATH="$HOME/.elan/bin:$PATH"

  # Install pinned toolchain
  if [[ -f "$REPO_ROOT/lean/lean-toolchain" ]]; then
    TC=$(cat "$REPO_ROOT/lean/lean-toolchain")
    elan toolchain install "$TC"
    echo "  ✓ Lean toolchain installed: $TC"
  fi
fi

# ── Bun dependencies ────────────────────────────────────────────

section "Installing Bun dependencies"

echo "  MCP server deps..."
cd "$REPO_ROOT/scripts/mcp-server" && bun install --frozen-lockfile 2>/dev/null || bun install

echo "  Content pipeline deps..."
cd "$REPO_ROOT/content" && bun install --frozen-lockfile 2>/dev/null || bun install

echo "  Test harness deps..."
cd "$REPO_ROOT/scripts/tests" && bun install --frozen-lockfile 2>/dev/null || bun install

# ── xdg-utils (browser opening) ─────────────────────────────────

section "xdg-utils (browser preview)"
if installed xdg-open || installed open; then
  skip "browser opener"
else
  case "$OS" in
    chromeos|debian)
      sudo apt-get install -y -qq xdg-utils
      ;;
  esac
fi

# ── Summary ──────────────────────────────────────────────────────

section "Installation complete"
echo ""
echo "  To start the MCP server:"
echo "    ./scripts/start-folio-assistant.sh"
echo ""
echo "  To check dependencies:"
echo "    ./scripts/start-folio-assistant.sh --check"
echo ""
echo "  To set up Lean (lake build, Mathlib cache):"
echo "    cd $REPO_ROOT/lean && lake update && lake exe cache get && lake build"
echo ""
