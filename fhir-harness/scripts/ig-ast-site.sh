#!/usr/bin/env bash
# The full IG Publisher AST pipeline, end to end, for ANY FHIR IG:
#
#   restore  — the AST cache from the IG repository's `cat/fhir-harness/fhir-ast/<package>` branch
#   validity — whether it was built from the inputs the checkout has now
#   index    — the artefact index the AST describes (ast-to-artifact-index.ts)
#   parity   — where that index disagrees with the published-output index
#   pages    — the reader-facing site, by the SAME renderer as the published one
#   jekyll   — optional: the just-the-docs build, when `bundle` is available
#
# USAGE
#   fhir-harness/scripts/ig-ast-site.sh --ig-root DIR --instance DIR --out DIR
#       [--label NAME] [--chrome-owner INSTANCE] [--published-base URL]
#       [--remote REM] [--jekyll] [--publish-note TEXT] [--sidecar-label TEXT]
#       [-- <other gen-ig-pages.ts flags>]
#
#   --publish-note / --sidecar-label, and anything after `--`, are passed to
#   gen-ig-pages.ts unchanged: a publisher's own wording, which this layer
#   must not know.
#
#   --ig-root   a checkout of the IG source (the repository with sushi-config.yaml)
#   --instance  the folio layer directory holding fhir-artifact-index/ (menu,
#               published index for parity) — e.g. smart-trust
#   --out       where the pages, index and parity report are written
#
# EXIT CODES
#   0  pipeline ran; the report says what it found
#   1  no AST could be restored (a build is required)
#   2  usage error
#   3  the AST restored but could not be turned into pages
#
# A stale or cannot-tell validity verdict does NOT stop the pipeline: the
# pages are drawn and SAY they come from a cache, and the verdict is in the
# report. Refusing to render would hide exactly the drift this exists to show.
#
# Nothing here may know about WHO (fhir-harness/AGENTS.md).

set -uo pipefail

PROG="${0##*/}"
die() { printf '%s: %s\n' "$PROG" "$*" >&2; exit 2; }
step() { printf '\n== %s\n' "$*"; }

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

IG_ROOT="" INSTANCE="" OUT="" LABEL="" CHROME_OWNER="" PUBLISHED_BASE="" REMOTE="" JEKYLL=0
PAGE_EXTRA=()
while [ $# -gt 0 ]; do
  case "$1" in
    --) shift; PAGE_EXTRA+=("$@"); break ;;
    --ig-root) IG_ROOT="${2:-}"; shift 2 ;;
    --instance) INSTANCE="${2:-}"; shift 2 ;;
    --out) OUT="${2:-}"; shift 2 ;;
    --label) LABEL="${2:-}"; shift 2 ;;
    --chrome-owner) CHROME_OWNER="${2:-}"; shift 2 ;;
    --published-base) PUBLISHED_BASE="${2:-}"; shift 2 ;;
    --remote) REMOTE="${2:-}"; shift 2 ;;
    --jekyll) JEKYLL=1; shift ;;
    # Forwarded to gen-ig-pages.ts verbatim: the publisher's own wording,
    # which this layer passes on and never chooses.
    --publish-note|--sidecar-label) PAGE_EXTRA+=("$1" "${2:-}"); shift 2 ;;
    -h|--help) grep '^#' "$0" | cut -c 3-; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done
[ -n "$IG_ROOT" ] && [ -n "$INSTANCE" ] && [ -n "$OUT" ] || die "need --ig-root, --instance and --out (see --help)"
IG_ROOT=$(cd "$IG_ROOT" && pwd) || die "no such --ig-root"
INSTANCE=$(cd "$INSTANCE" && pwd) || die "no such --instance"
mkdir -p "$OUT" && OUT=$(cd "$OUT" && pwd)

PUBLISHED_INDEX="$INSTANCE/fhir-artifact-index/index.json"
# The published-output index says where the IG is published; use it unless
# told otherwise, so the AST pages link to the same bytes the published ones do.
if [ -z "$PUBLISHED_BASE" ] && [ -f "$PUBLISHED_INDEX" ]; then
  PUBLISHED_BASE=$(bun -e "const i=JSON.parse(require('fs').readFileSync('$PUBLISHED_INDEX','utf8'));if(i.source?.kind==='gh-pages'||i.source?.kind==='url')process.stdout.write(i.source.of)")
fi

T0=$(date +%s)
step "restore"
remote_args=()
[ -n "$REMOTE" ] && remote_args=(--remote "$REMOTE")
bash "$HERE/ig-cache.sh" restore --ig-root "$IG_ROOT" "${remote_args[@]}"
rc=$?
[ "$rc" -eq 0 ] || { echo "restore failed (exit $rc)"; exit 1; }
T1=$(date +%s)

step "validity"
bun run "$HERE/ig-ast.ts" validity "$IG_ROOT/output-ast" --ig "$IG_ROOT" > "$OUT/validity.json" 2>&1
VERDICT=$(bun -e "try{process.stdout.write(JSON.parse(require('fs').readFileSync('$OUT/validity.json','utf8')).verdict)}catch{process.stdout.write('cannot-tell')}")
echo "verdict: $VERDICT (details: $OUT/validity.json)"

step "index + parity"
compare_args=()
[ -f "$PUBLISHED_INDEX" ] && compare_args=(--compare "$PUBLISHED_INDEX" --report "$OUT/parity.json")
base_args=()
[ -n "$PUBLISHED_BASE" ] && base_args=(--published-base "$PUBLISHED_BASE")
bun run "$HERE/ast-to-artifact-index.ts" --ast "$IG_ROOT/output-ast" --instance-id "$(basename "$INSTANCE")" \
  "${base_args[@]}" --out "$OUT/fhir-artifact-index/index.json" "${compare_args[@]}" || exit 3

step "serve the AST's resources"
# The pages fetch each resource from here in the browser (skill
# `visualizer-loading`): served verbatim beside docs/, never copied into it.
rm -rf "$OUT/ast-data" && mkdir -p "$OUT/ast-data"
cp -R "$IG_ROOT/output-ast/resources" "$OUT/ast-data/resources" || exit 3
echo "$(find "$OUT/ast-data" -name '*.json' | wc -l | tr -d ' ') resource file(s) -> $OUT/ast-data"

step "pages"
page_args=(--instance "$INSTANCE" --index "$OUT/fhir-artifact-index/index.json" --out "$OUT/docs" --compiled-data ../ast-data)
[ -n "$LABEL" ] && page_args+=(--label "$LABEL")
[ -n "$CHROME_OWNER" ] && page_args+=(--chrome-owner "$CHROME_OWNER")
page_args+=("${PAGE_EXTRA[@]}")
bun run "$HERE/gen-ig-pages.ts" "${page_args[@]}" || exit 3
PAGES=$(find "$OUT/docs" -name '*.md' -not -name README.md | wc -l | tr -d ' ')
T2=$(date +%s)

if [ "$JEKYLL" -eq 1 ]; then
  step "jekyll"
  if command -v bundle >/dev/null 2>&1; then
    echo "jekyll build is left to the instance's own site config; see cat-harness-tools/scripts/compose-docs.ts"
  else
    echo "bundle not found — jekyll step skipped, and SAID to be skipped"
  fi
fi

step "summary"
printf '  ig root:   %s\n' "$IG_ROOT"
printf '  validity:  %s\n' "$VERDICT"
printf '  pages:     %s under %s/docs\n' "$PAGES" "$OUT"
printf '  restore:   %ss   index+pages: %ss\n' "$((T1 - T0))" "$((T2 - T1))"
[ -f "$OUT/parity.json" ] && printf '  parity:    %s\n' "$OUT/parity.json"
exit 0
