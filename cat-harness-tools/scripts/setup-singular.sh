#!/bin/bash
# Setup Singular for nuclear braid computations.
#
# Usage:
#   ./scripts/setup-singular.sh
#
# After install, run:
#   Singular folio-assistant/computations/singular-nuclear-braid.sing

set -e

echo "=== Singular setup for QOU nuclear braid computations ==="
echo

if command -v Singular &>/dev/null; then
    echo "Singular already installed:"
    Singular --version 2>&1 | head -1
    echo
    echo "Run:"
    echo "  Singular folio-assistant/computations/singular-nuclear-braid.sing"
    exit 0
fi

if [[ "$(uname)" == "Darwin" ]]; then
    if command -v brew &>/dev/null; then
        echo "Installing Singular via Homebrew..."
        brew install singular
        exit 0
    fi
fi

if command -v apt &>/dev/null; then
    echo "Installing Singular via apt..."
    sudo apt update
    sudo apt install -y singular
    exit 0
fi

if command -v conda &>/dev/null; then
    echo "Installing Singular via conda..."
    conda install -y -c conda-forge singular
    exit 0
fi

echo "Manual install: https://www.singular.uni-kl.de/index.php/singular-download.html"
exit 1
