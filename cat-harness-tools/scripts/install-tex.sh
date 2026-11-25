#!/usr/bin/env bash
#
# install-tex.sh — install TeX Live (full) in a sandbox where it is absent.
#
# Why this exists: the dev sandbox usually ships no pdflatex, so PDF builds
# (and the LaTeX build cache's Track-B compile verification) can't run. The
# base Ubuntu repos ARE reachable, but the launchpad PPAs (ondrej/php,
# deadsnakes) are firewalled (HTTP 403) and abort `apt-get update` — they must
# be disabled first. texlive-full (2023+) bundles BOTH packages the build
# cache requires: mylatexformat (preamble .fmt dump) and memoize (diagram box
# cache). See .claude/skills/local/latex-build-cache.md and
# .claude/skills/local/docs-generation.md.
#
# Usage:
#   scripts/install-tex.sh           # full install (~5 GB, ~10-20 min)
#   Run with run_in_background: true — pdflatex unpacks early but the LaTeX
#   packages aren't usable until the post-install mktexlsr/format build ends.
#
# Idempotent: no-op when pdflatex + memoize.sty are already present.
#
set -euo pipefail

if command -v pdflatex >/dev/null 2>&1 && kpsewhich memoize.sty >/dev/null 2>&1; then
  echo "install-tex: pdflatex + memoize already present — nothing to do"
  exit 0
fi

echo "install-tex: disabling firewalled launchpad PPAs (they 403 and break apt update)…"
sudo find /etc/apt/sources.list.d -type f \( -name '*.list' -o -name '*.sources' \) \
  -exec grep -liE 'launchpadcontent\.net|ppa\.launchpad' {} \; 2>/dev/null \
  | xargs -r -I{} sudo mv {} {}.disabled || true

echo "install-tex: apt-get update (base Ubuntu repos)…"
sudo apt-get update

echo "install-tex: installing texlive-full + latexmk (~5 GB)…"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  texlive-full latexmk latexdiff texlive-extra-utils

# Verify the packages the LaTeX build cache needs actually resolved.
missing=0
for p in mylatexformat.ltx memoize.sty tikz-cd.sty hyperref.sty; do
  if ! kpsewhich "$p" >/dev/null 2>&1; then
    echo "install-tex: ERROR — $p still missing after install" >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] || exit 1

echo "install-tex: OK — $(pdflatex --version | head -1)"
