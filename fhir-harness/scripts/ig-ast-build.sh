#!/usr/bin/env bash
# Build an IG's AST in the checkout, with no runner: the "Build the IG and
# export its AST" step of .github/workflows/ig-ast-refresh.yml, as a script.
#
# WHY
#   A repository harnessed today (cat-harness-tools' instantiate-harness.ts)
#   has no cache branch yet, and its site is built from the AST and never from
#   the Publisher's HTML (ig-build-pipeline rules 1 and 2). Until this script
#   the only producer was the reusable workflow, so the first preview of a
#   newly harnessed IG waited on a dispatch. This is that build, run where the
#   checkout is. It is the checkout script `prepare:fhir-harness`, which
#   instantiate-harness runs before it renders.
#
# WHAT IT DOES, as the workflow does it
#   - installs SUSHI and Jekyll when they are not on PATH;
#   - builds AstExportCli from litlfred/fhir-ig-publisher at --ast-export-ref;
#   - installs the FHIR packages the IG's lock pins (--package-lock), each
#     hash verified, so neither SUSHI nor the Publisher fetches them;
#   - seeds the template an ig.ini names as `<id>#current` from its
#     repository (--template-repo, or IG_TEMPLATE_REPOS) before the Publisher
#     asks the CI build server for it;
#   - runs one full Publisher build through AstExportCli into output-ast/;
#   - puts the commit's IG inputs back, and removes the files the build left
#     untracked outside output-ast/ — on every exit, failure included;
#   - judges the AST (`ig-ast.ts validity`): exit 1 when it is not valid.
#
# WHAT IT DOES NOT
#   The incremental build, a pre-export overlay, or seeding the cache branch:
#   those stay the workflow's. `ig-cache.sh seed --ig-root . --push` seeds the
#   branch from the output-ast/ this writes, when the commit is on the default
#   branch.
#
# USAGE
#   bash fhir-harness/scripts/ig-ast-build.sh [--ig-root DIR] [--tx URL]
#        [--ast-export-ref SHA] [--work DIR] [--template-repo ID=OWNER/REPO]…
#        [--package-lock FILE]
#   --package-lock: the IG's FHIR package lock, relative to the IG root (default
#   fhir-packages.lock.json, used when present). Each package it pins is installed
#   from its URL, hash verified, before the Publisher runs; a mismatch stops the build.
#   IG_TEMPLATE_REPOS="ID=OWNER/REPO …" is read as more --template-repo values.
#
# NEEDS java, mvn, git, node, npm, ruby, gem, bun; the network the Publisher
# needs (packages.fhir.org, the terminology server, Maven Central).
set -euo pipefail

IG=.
TX=http://tx.fhir.org
# The ast-export commit ig-ast-refresh.yml builds with (its `ast-export-ref` default).
REF=b1f85fa101b343e625d69df54d939b1949a062cb
WORK="${TMPDIR:-/tmp}/ig-ast-build"
TEMPLATE_ARGS=()
PACKAGE_LOCK=fhir-packages.lock.json
for m in ${IG_TEMPLATE_REPOS:-}; do TEMPLATE_ARGS+=(--template-repo "$m"); done
while [ $# -gt 0 ]; do
  case "$1" in
    --ig-root) IG=$2; shift 2 ;;
    --tx) TX=$2; shift 2 ;;
    --ast-export-ref) REF=$2; shift 2 ;;
    --work) WORK=$2; shift 2 ;;
    --template-repo) TEMPLATE_ARGS+=(--template-repo "$2"); shift 2 ;;
    --package-lock) PACKAGE_LOCK=$2; shift 2 ;;
    -h|--help) grep '^#' "$0" | cut -c 3-; exit 0 ;;
    *) echo "ig-ast-build: unknown argument: $1" >&2; exit 2 ;;
  esac
done
IG=$(cd "$IG" && pwd)
HERE=$(cd "$(dirname "$0")" && pwd)
for c in java mvn git node npm ruby gem bun; do
  command -v "$c" > /dev/null || { echo "ig-ast-build: needs $c on PATH" >&2; exit 2; }
done
git -C "$IG" rev-parse --verify -q HEAD > /dev/null || { echo "ig-ast-build: $IG is not a git checkout with a commit" >&2; exit 2; }

export PATH="$HOME/.npm-global/bin:$(ruby -e 'print Gem.user_dir')/bin:$PATH"
# SUSHI at the pinned version (ig-toolchain.env), never whatever is on PATH.
SUSHI_VERSION=$(sed -n 's/^SUSHI_VERSION=//p' "$HERE/ig-toolchain.env")
have=$(sushi --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true)
[ "$have" = "$SUSHI_VERSION" ] || npm install -g --prefix "$HOME/.npm-global" "fsh-sushi@$SUSHI_VERSION"
command -v jekyll > /dev/null 2>&1 || gem install --user-install jekyll --no-document

mkdir -p "$WORK"
[ -d "$WORK/igp/.git" ] || git clone -q --filter=blob:none https://github.com/litlfred/fhir-ig-publisher "$WORK/igp"
git -C "$WORK/igp" cat-file -e "$REF^{commit}" 2> /dev/null || git -C "$WORK/igp" fetch -q origin "$REF"
git -C "$WORK/igp" checkout -q "$REF"
(cd "$WORK/igp/ast-export" && mvn -q -B -DskipTests compile dependency:build-classpath -Dmdep.outputFile=cp.txt)
CP="$WORK/igp/ast-export/target/classes:$(cat "$WORK/igp/ast-export/cp.txt")"

cd "$IG"
# What was untracked before the build is the author's; what the build adds is not.
BEFORE=$(git ls-files --others --exclude-standard | sort)
restore_inputs() {
  for p in sushi-config.yaml ig.ini input; do
    if git ls-files --error-unmatch -- "$p" > /dev/null 2>&1; then git checkout -q HEAD -- "$p"; fi
  done
  git clean -fdq -- sushi-config.yaml ig.ini input
  comm -13 <(printf '%s\n' "$BEFORE") <(git ls-files --others --exclude-standard | sort) \
    | grep -v '^output-ast/' | while IFS= read -r f; do rm -f -- "$f"; done
}
trap restore_inputs EXIT

if [ -n "$PACKAGE_LOCK" ] && [ -f "$PACKAGE_LOCK" ]; then
  bun run "$HERE/fhir-cache-seed-npm.ts" --cache "$HOME/.fhir/packages" --lock "$PACKAGE_LOCK" \
    || { echo "ig-ast-build: a FHIR package $PACKAGE_LOCK pins was not installed as pinned" >&2; exit 1; }
elif [ "$PACKAGE_LOCK" != fhir-packages.lock.json ]; then
  echo "ig-ast-build: no package lock at $IG/$PACKAGE_LOCK" >&2; exit 2
fi

tpl=$(sed -n 's/^[[:space:]]*template[[:space:]]*=[[:space:]]*\([A-Za-z0-9._-]*#current\)[[:space:]]*$/\1/p' ig.ini 2> /dev/null | head -n 1)
if [ -n "$tpl" ] && [ ! -d "$HOME/.fhir/packages/$tpl" ]; then
  python3 -I "$WORK/igp/ast-export/scripts/seed-fhir-cache-from-npm.py" --cache "$HOME/.fhir/packages" "${TEMPLATE_ARGS[@]}" "$tpl" \
    || echo "ig-ast-build: could not seed the template $tpl from its repository; the Publisher tries the CI build server" >&2
fi

rm -rf output-ast
echo "ig-ast-build: one full IG Publisher build through AstExportCli (minutes to tens of minutes); log: $WORK/ast-build.log" >&2
java -Xmx10g -cp "$CP" org.hl7.fhir.igtools.ast.AstExportCli -ig "$IG" -ast-out "$IG/output-ast" -tx "$TX" > "$WORK/ast-build.log" 2>&1 \
  || { tail -n 80 "$WORK/ast-build.log" >&2; exit 1; }
[ -f output/expansions.json ] && cp output/expansions.json output-ast/expansions.json
# The Publisher's QA summary goes with the AST too: the site is built from the AST, never the Publisher's
# output, so this is the FHIR QA its QA report can show (ig-qa-page.ts).
[ -f output/qa.json ] && cp output/qa.json output-ast/qa.json
# And every message it reported (output/qa.xml), as JSON, for the report's qa.html layout.
bun run "$HERE/ig-qa-messages.ts" output/qa.xml output-ast/qa-messages.json >&2 || true
restore_inputs
bun run "$HERE/ig-ast.ts" validity output-ast --ig . > /dev/null \
  || { echo "ig-ast-build: the AST just built is not valid for $(git rev-parse --short HEAD)" >&2; exit 1; }
echo "ig-ast-build: output-ast/ is valid for $(git rev-parse --short HEAD)" >&2
