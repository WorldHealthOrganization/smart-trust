#!/usr/bin/env bash
# dak-pre-export.sh — the DAK pre-processing, as the OVERLAY fhir-harness's IG
# AST refresh runs before its AST export.
#
# fhir-harness owns the AST cache lifecycle and knows nothing about WHO
# (fhir-harness/AGENTS.md; owner, 2026-10-14: "that should be in fhir-harness
# then smart-* all use that"). Its reusable `ig-ast-refresh.yml` takes a
# generic `pre-export` command; smart-base's caller
# (`.github/workflows/ig-ast-refresh.yml`) passes this script. The steps are
# the ones skill `dak-preprocessing` lists, in the order WHO's `ghbuild.yml`
# runs them, from this checkout's own `input/scripts/` (never fetched from
# another repository's main):
#
#   1. generate_dak_from_sushi.py   contentTypes.dak from sushi-config.yaml + repo/branch
#   2. update_sushi_config.py       pages/menu entries and placeholder pages
#   4. dmn_questionnaire_generator.py   Questionnaires from the DMN tables
#   5. transform_dmn.py             DMN -> HTML
#   6. inject_translations.py       translated strings into diagram sources
#
# Step 3 (generate_dak_from_sushi.py again, "with the branch context") is not
# repeated: here the context is the same environment both times, and the
# skill says not to reproduce the double run when lifting the step.
# Steps 4-6 run only when the IG declares contentTypes.dak, as in ghbuild.yml.
#
# Any failure fails the run, so no AST is exported, let alone seeded, from a
# half-prepared tree. The changes it makes to the IG's inputs are not
# committed: fhir-harness records the AST against the CLEAN checkout's inputs
# and puts the tree back after the export.
#
#   bash smart-base/scripts/dak-pre-export.sh [<ig root>]   (default: .)
set -euo pipefail

cd "${1:-.}"
S=input/scripts
for f in generate_dak_from_sushi.py update_sushi_config.py dmn_questionnaire_generator.py transform_dmn.py inject_translations.py; do
  [ -f "$S/$f" ] || { echo "::error::dak-pre-export: $S/$f is missing" >&2; exit 2; }
done

# The same packages ghbuild.yml installs, in a venv of their own (a runner's
# system Python refuses pip installs); --user when venv is not available.
deps=("GitPython>=3.1.40" "PyYAML>=6.0" "requests>=2.28.0" lxml)
venv="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/dak-pre-export-venv"
if [ -x "$venv/bin/python" ] || python3 -m venv "$venv" > /dev/null 2>&1; then
  py="$venv/bin/python"
else
  py=python3
  pip_user=(--user --break-system-packages)
fi
"$py" -m pip install -q --disable-pip-version-check ${pip_user[@]+"${pip_user[@]}"} "${deps[@]}"

step() { echo "── dak-pre-export: $1"; "$py" "$S/$1"; }

# A legacy dak.json is read into index.config.json for this run, as in ghbuild.yml.
"$py" "$S/dak_index.py" --adopt-legacy .
step generate_dak_from_sushi.py
step update_sushi_config.py
if ! "$py" "$S/dak_index.py" .; then
  echo "dak-pre-export: no contentTypes.dak in the IG's index.config.json, so the DMN and translation steps are skipped (as in ghbuild.yml)"
  exit 0
fi
step dmn_questionnaire_generator.py
step transform_dmn.py
step inject_translations.py
echo "dak-pre-export: done"
