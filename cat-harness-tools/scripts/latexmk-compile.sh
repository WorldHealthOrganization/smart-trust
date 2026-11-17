#!/usr/bin/env bash
# latexmk-compile.sh — Compile LaTeX with safe shell-escape handling.
#
# Determines whether to enable -shell-escape based on the CI event type
# (GITHUB_EVENT_NAME). Only trusted push events get shell-escape; PRs
# (pull_request_target) do not, to prevent arbitrary command execution
# from untrusted TeX content.
#
# Usage:
#   scripts/latexmk-compile.sh <tex-file> [latexmk-args...]
#
# Examples:
#   scripts/latexmk-compile.sh main.tex
#   scripts/latexmk-compile.sh diff.tex --quiet
#   scripts/latexmk-compile.sh standalone-glossary.tex

set -euo pipefail

if [ $# -lt 1 ] || [ -z "$1" ]; then
  echo "Usage: latexmk-compile.sh <tex-file> [latexmk-args...]" >&2
  exit 2
fi

TEX_FILE="$1"
shift

if [ ! -f "$TEX_FILE" ]; then
  echo "File not found: $TEX_FILE" >&2
  exit 2
fi

# Determine pdflatex command — only enable shell-escape on trusted events
PDFLATEX_CMD="pdflatex %O %S"
if [ "${GITHUB_EVENT_NAME:-}" = "push" ] || [ "${GITHUB_EVENT_NAME:-}" = "workflow_dispatch" ]; then
  PDFLATEX_CMD="pdflatex -shell-escape %O %S"
fi

exec latexmk -pdf -interaction=nonstopmode \
  -pdflatex="$PDFLATEX_CMD" "$@" "$TEX_FILE"
