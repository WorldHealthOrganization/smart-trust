#!/usr/bin/env bash
# FHIR AST cache service — restore, verify, seed, and diagnose the
# prebuilt AST JSON artifacts for a FHIR Implementation Guide.
#
# USAGE
#   scripts/ig-cache.sh status     [--ig-root DIR]
#   scripts/ig-cache.sh restore    [--ig-root DIR] [--package NAME] [--branch BR] [--commit SHA] [--record FILE]
#   scripts/ig-cache.sh seed       [--ig-root DIR] [--package NAME] [--branch BR] [--remote REM] [--push] [--force]
#   scripts/ig-cache.sh contribute [--ig-root DIR] [--package NAME] [--remote REM] [--force]
#   scripts/ig-cache.sh verify     [--ig-root DIR]
#   scripts/ig-cache.sh doctor     [--ig-root DIR]
#   scripts/ig-cache.sh list
#
# EXIT CODES
#   0  success / cache present
#   1  cache miss (nothing restored — a build is required)
#   2  usage or environment error (git missing, not a repo, bad roster)
#   3  cache present but UNUSABLE (corrupt or mismatched)
#
# WARM-START SUPPORT
#   The Publisher's tx cache (`input-cache/txcache/`) persists across runs.
#   This cache is restored alongside the AST JSON files, skipping terminology
#   expansion network round-trips for unchanged ValueSets.

set -uo pipefail

PROG="${0##*/}"
PRIVATE_REF="refs/ig-cache-restore"

die()  { printf '%s: %s\n' "$PROG" "$*" >&2; exit 2; }
info() { printf '  %s\n' "$*"; }
warn() { printf '  ! %s\n' "$*" >&2; }

command -v git >/dev/null 2>&1 || die "git not found on PATH"

# The harness this script ships in, found from the script itself — never
# from the caller's directory. A caller may run it from folio-assistant, from
# the IG checkout, or (after separation) from a repository that vendors it.
HARNESS_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
IG_AST_TS="$HARNESS_ROOT/fhir-harness/scripts/ig-ast.ts"
CALLER_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

# Every git operation targets the IG's OWN repository. Before 2026-10-02 they
# ran in the caller's directory, so `restore --ig-root X` started from
# folio-assistant fetched folio-assistant's origin and reported the cache
# "not found" while it sat on X's origin (bean wnhh).
IGIT_ROOT=""
igit() { git -C "$IGIT_ROOT" "$@"; }

CMD="${1:-}"; shift || true
IG_ROOT=""
PACKAGE=""
BRANCH=""
COMMIT=""
RECORD=""
REMOTE="origin"
PUSH=0
FORCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --ig-root) IG_ROOT="${2:-}"; shift 2 ;;
    --package) PACKAGE="${2:-}"; shift 2 ;;
    --branch)  BRANCH="${2:-}"; shift 2 ;;
    --commit)  COMMIT="${2:-}"; shift 2 ;;
    --record)  RECORD="${2:-}"; shift 2 ;;
    --remote)  REMOTE="${2:-}"; shift 2 ;;
    --push)    PUSH=1; shift ;;
    --force)   FORCE=1; shift ;;
    -h|--help) CMD="help"; shift ;;
    *) die "unknown option: $1" ;;
  esac
done

resolve_ig_root() {
  if [ -n "$IG_ROOT" ]; then
    printf '%s\n' "$(cd "$IG_ROOT" 2>/dev/null && pwd)" || die "no such --ig-root: $IG_ROOT"
    return
  fi
  local d="$PWD"
  while [ "$d" != "/" ]; do
    if [ -f "$d/sushi-config.yaml" ]; then
      printf '%s\n' "$d"; return
    fi
    d=$(dirname "$d")
  done
  printf '%s\n' "$CALLER_ROOT"
}

resolve_package() {
  local root="$1"
  [ -n "$PACKAGE" ] && { printf '%s\n' "$PACKAGE"; return; }
  
  if [ -f "$root/sushi-config.yaml" ]; then
    local id
    # Carriage returns stripped too: smart-base's sushi-config.yaml has CRLF
    # line endings, and its id read as `smart.who.int.base<CR>`, naming a
    # cache branch nobody has (2026-10-02).
    id=$(grep '^id:' "$root/sushi-config.yaml" | head -1 | sed 's/^id:[[:space:]]*//' | tr -d '"'\''\r' | sed 's/[[:space:]]*$//')
    [ -n "$id" ] && { printf '%s\n' "$id"; return; }
  fi
  return 1
}

# The family's prefixes, newest first, each ending in `/` (bean rva2; owner,
# 2026-10-05: "make fhir and lean work same"). The IG checkout's own
# declaration goes first — a directory with graphTypology `ig-ast` and
# `storage.keyedBy: "family"` in its `<instance>.json` — exactly as
# lake-cache.sh reads the Lean folio's. The built-in names stay as fallbacks;
# no declaration, or no python3 to read one, leaves them as they were.
# IGIT_ROOT must be set.
ast_prefixes() {
  local declared="" p
  if command -v python3 >/dev/null 2>&1; then
    declared=$(python3 - "$IGIT_ROOT" <<'PY' 2>/dev/null
import glob, json, os, sys
for path in sorted(glob.glob(os.path.join(sys.argv[1], "*.json"))):
    try:
        d = json.load(open(path))
    except Exception:
        continue
    dirs = d.get("directories") if isinstance(d, dict) else None
    if not isinstance(dirs, list):
        continue
    for e in dirs:
        if not isinstance(e, dict):
            continue
        st = e.get("storage") if isinstance(e.get("storage"), dict) else {}
        kinds = e.get("graphTypologies") if isinstance(e.get("graphTypologies"), list) else []
        if "ig-ast" in kinds and st.get("keyedBy") == "family" and isinstance(st.get("branchPrefix"), str) and st["branchPrefix"]:
            print(st["branchPrefix"].rstrip("/") + "/")
            sys.exit(0)
PY
)
  fi
  [ -n "$declared" ] && printf '%s\n' "$declared"
  for p in "cat/fhir-harness/fhir-ast/"; do
    [ "$p" = "$declared" ] || printf '%s\n' "$p"
  done
}

cmd_list_names() {
  IGIT_ROOT=$(resolve_ig_root)
  local p pats=()
  while IFS= read -r p; do pats+=("refs/heads/${p}*"); done < <(ast_prefixes)
  igit ls-remote --heads "$REMOTE" "${pats[@]}" | sed -n 's#^.*refs/heads/\(.*\)$#\1#p'
}

# The cache branch for a package: `cat/fhir-harness/fhir-ast/<pkg>` (bean
# tlk2), or the folio's declared family first. The older `cat-fhir-ast/` and
# `fhir-ast/` names were retired on 2026-10-24, once `git ls-remote` showed
# no such head on any litlfred or WHO IG remote (bean folio-assistant-oycs).
# A first seed creates the branch. `--branch` overrides.
# IGIT_ROOT must be set. A remote that cannot be reached is an error, not
# "absent": reading it as absent would seed a second branch beside the first.
resolve_branch() {
  local pkg="$1"
  if [ -n "$BRANCH" ]; then printf '%s\n' "$BRANCH"; return; fi
  local name rc p first=""
  while IFS= read -r p; do
    name="$p$pkg"
    [ -n "$first" ] || first="$name"
    igit ls-remote --exit-code --heads "$REMOTE" "refs/heads/$name" >/dev/null 2>&1
    rc=$?
    if [ "$rc" -eq 0 ]; then printf '%s\n' "$name"; return; fi
    [ "$rc" -eq 2 ] || die "could not reach remote '$REMOTE' to look up $name (git ls-remote exit $rc)"
  done < <(ast_prefixes)
  printf '%s\n' "$first"
}

count_resources() {
  local dir="$1"
  find "$dir" -name '*.json' -not -path '*/ig-api/*' -not -path '*/fhir-artifact-index/*' -not -name 'manifest.json' -not -name 'dependencies.json' -not -name 'fsh-index.json' -not -name 'expansions.json' -type f 2>/dev/null | head -20000 | wc -l | tr -d ' '
}

cmd_status() {
  local root; root=$(resolve_ig_root)
  local pkg; pkg=$(resolve_package "$root")
  [ -z "$pkg" ] && pkg="(unknown)"
  
  local out="$root/output-ast"
  printf 'ig cache status\n'
  info "ig root: $root"
  info "package: $pkg"
  
  if [ ! -d "$out" ]; then
    printf '\n  cache ABSENT — run: %s restore\n' "$PROG"
    return 1
  fi
  
  local n; n=$(count_resources "$out")
  if [ "$n" -eq 0 ]; then
    warn "output-ast exists but has 0 resources — unusable."
    return 3
  fi
  
  printf '\n  cache PRESENT — %s resources on disk.\n' "$n"
  
  if ! bun run "$IG_AST_TS" validity "$out" --ig "$root" >/dev/null 2>&1; then
    warn "AST is stale for current inputs. Run \`$PROG seed\` after rebuilding."
    return 3
  fi
  return 0
}

# `restore --record` with an AST already in the checkout: the cache commit it
# came from, when that is knowable without downloading the AST again. The
# commit named (`--commit`, or the branch's tip) is fetched without its files
# (`--filter=blob:none`) and recorded when its manifest.json is byte for byte
# the one present. Otherwise nothing is recorded, and the site copies the
# resources as before (fhir-harness#327).
record_present() {
  local out="$1" ref="$2" here want sha url
  here=$(git hash-object "$out/manifest.json" 2>/dev/null) || return 0
  igit update-ref -d "$PRIVATE_REF" 2>/dev/null || true
  igit fetch -q --depth=1 --filter=blob:none "$REMOTE" "+$ref:$PRIVATE_REF" >/dev/null 2>&1 || { info "could not read $ref to record the AST already present"; return 0; }
  want=$(igit rev-parse "$PRIVATE_REF:manifest.json" 2>/dev/null) || want=""
  sha=$(igit rev-parse "$PRIVATE_REF" 2>/dev/null) || sha=""
  igit update-ref -d "$PRIVATE_REF" 2>/dev/null || true
  if [ -n "$sha" ] && [ "$here" = "$want" ]; then
    url=$(igit remote get-url "$REMOTE" 2>/dev/null | sed -E 's#//[^/@]*@#//#') || url=""
    printf '{"commit":"%s","remote":"%s"}\n' "$sha" "$url" > "$RECORD"
    info "the AST present is ${sha:0:12}'s: recorded"
  else
    info "the AST present is not $ref's tip: no commit recorded"
  fi
}

cmd_restore() {
  local root; root=$(resolve_ig_root)
  local pkg; pkg=$(resolve_package "$root") || die "could not resolve package id from $root/sushi-config.yaml"
  IGIT_ROOT="$root"
  # `--commit`: the AST at a PINNED commit of the cache branch (ig-ast.lock.json,
  # bean fwtz). Fetched by sha, so no branch is looked up and the tip is never read.
  local br
  if [ -n "$COMMIT" ]; then
    printf '%s' "$COMMIT" | grep -Eq '^[0-9a-f]{40}$' || die "--commit $COMMIT is not a full 40-character sha"
    br="$COMMIT"
  else
    br=$(resolve_branch "$pkg") || exit 2
  fi
  
  local out="$root/output-ast"
  if [ -d "$out" ] && [ "$(count_resources "$out")" -gt 0 ]; then
    local n; n=$(count_resources "$out")
    printf 'cache already present (%s resources) — nothing to do.\n' "$n"
    [ -n "$RECORD" ] && record_present "$out" "$br"
    return 0
  fi
  
  printf 'restoring %s -> %s\n' "$br" "$out"
  
  igit update-ref -d "$PRIVATE_REF" 2>/dev/null || true
  # One retry: a transfer refused by a proxy or rate limit is not a missing
  # branch, and the two used to print the same "not found". The error git
  # gave is shown either way, so the next reader can tell them apart.
  local ferr
  if ! ferr=$(igit fetch --depth=1 "$REMOTE" "+$br:$PRIVATE_REF" 2>&1); then
    sleep 5
    if ! ferr=$(igit fetch --depth=1 "$REMOTE" "+$br:$PRIVATE_REF" 2>&1); then
      if igit ls-remote --exit-code --heads "$REMOTE" "refs/heads/$br" >/dev/null 2>&1; then
        warn "cache branch '$br' EXISTS on $REMOTE but could not be fetched:"
        printf '%s\n' "$ferr" | tail -3 | sed 's/^/      /' >&2
        return 2
      fi
      warn "cache branch '$br' not found on $REMOTE."
      info "A build is required. Afterwards run: $PROG seed"
      return 1
    fi
  fi
  
  mkdir -p "$out"
  
  local tmp; tmp=$(mktemp -d) || die "mktemp failed"
  trap "rm -rf '$tmp'; git -C '$root' update-ref -d '$PRIVATE_REF' 2>/dev/null || true" RETURN
  
  # `--record`: the cache commit restored and the remote it came from, so a
  # site can read the AST's files by raw URL pinned to that commit instead of
  # copying them (fhir-harness#325). Written only on a restore that fetched.
  if [ -n "$RECORD" ]; then
    local sha url
    sha=$(igit rev-parse "$PRIVATE_REF" 2>/dev/null) || sha=""
    # Any credentials in the remote's URL are dropped: only the repository is wanted.
    url=$(igit remote get-url "$REMOTE" 2>/dev/null | sed -E 's#//[^/@]*@#//#') || url=""
    [ -n "$sha" ] && printf '{"commit":"%s","remote":"%s"}\n' "$sha" "$url" > "$RECORD"
  fi

  igit archive --format=tar "$PRIVATE_REF" | tar -xC "$tmp" 2>/dev/null || {
    warn "could not extract AST from '$br'."
    return 3
  }
  
  # The AST files sit at the root of the branch, along with txcache/
  # Move everything except txcache into output-ast
  for item in "$tmp"/*; do
    local base; base=$(basename "$item")
    [ "$base" = "txcache" ] && continue
    # A lock file is the seed's own scratch, never AST content.
    [ "$base" = "index.lock" ] && continue
    cp -R "$item" "$out/"
  done
  
  if [ -d "$tmp/txcache" ]; then
    info "restoring txcache -> $root/input-cache/txcache"
    mkdir -p "$root/input-cache"
    rm -rf "$root/input-cache/txcache"
    mv "$tmp/txcache" "$root/input-cache/txcache"
  fi
  
  local n; n=$(count_resources "$out")
  if [ "$n" -eq 0 ]; then
    warn "extract produced NO resources — cache is unusable."
    return 3
  fi
  
  printf '\nrestored %s resources from %s.\n' "$n" "$br"
  return 0
}

seed_subject() {
  printf 'AST %s | %s resources | %s edges | Publisher %s | src %s' "$1" "$2" "$3" "$4" "$5"
}

parse_counts() {
  local msg="$1"
  local resources edges
  resources=$(printf '%s' "$msg" | sed -n 's/.*| \([0-9]*\) resources .*/\1/p')
  edges=$(printf '%s' "$msg" | sed -n 's/.*| \([0-9]*\) edges .*/\1/p')
  if [ -n "$resources" ] && [ -n "$edges" ]; then
    printf '%s %s\n' "$resources" "$edges"
  fi
}

would_shrink() {
  local br="$1" cand_res="$2" cand_edges="$3"
  local ref="refs/ig-cache-prevcheck"
  igit update-ref -d "$ref" 2>/dev/null || true
  timeout 60 git -C "$IGIT_ROOT" fetch --depth=1 --filter=blob:none -q "$REMOTE" "+$br:$ref" 2>/dev/null || return 1
  local msg; msg=$(igit log -1 --format=%s "$ref" 2>/dev/null)
  igit update-ref -d "$ref" 2>/dev/null || true
  
  local prev; prev=$(parse_counts "$msg")
  [ -z "$prev" ] && return 1
  
  local po pw; po=${prev%% *}; pw=${prev##* }
  info "incumbent $br: $po resources, $pw edges"
  
  [ "$cand_res" -lt $(( po * 90 / 100 )) ] || [ "$cand_edges" -lt $(( pw * 90 / 100 )) ]
}

cmd_seed() {
  local root; root=$(resolve_ig_root)
  local pkg; pkg=$(resolve_package "$root") || die "pass --package NAME"
  IGIT_ROOT="$root"
  local br; br=$(resolve_branch "$pkg") || exit 2
  
  local out="$root/output-ast"
  
  info "Running AstExportCli..."
  local export_dir="$HARNESS_ROOT/fhir-ig-publisher/ast-export"
  [ ! -d "$export_dir" ] && export_dir="$PWD/fhir-ig-publisher/ast-export"
  if [ -d "$export_dir" ] && [ -f "$export_dir/target/classes/org/hl7/fhir/igtools/ast/AstExportCli.class" ]; then
    (cd "$export_dir" && java -cp "target/classes:$(cat cp.txt 2>/dev/null)" org.hl7.fhir.igtools.ast.AstExportCli -ig "$root" -ast-out "$out") || die "AstExportCli failed"
  else
    warn "AstExportCli not built or not found, assuming AST is already in $out"
  fi
  
  local n; n=$(count_resources "$out")
  [ "$n" -eq 0 ] && die "no resources under $out — build before seeding."
  
  local edges=0
  if [ -f "$out/dependencies.json" ]; then
    edges=$(grep -o '"target"' "$out/dependencies.json" 2>/dev/null | wc -l | tr -d ' ')
  fi
  
  # The exporter records its toolchain in the manifest; the subject reads it
  # from there rather than saying "Publisher unknown" (smart-trust#4).
  local pub_version="unknown"
  if [ -f "$out/manifest.json" ] && command -v python3 >/dev/null 2>&1; then
    pub_version=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("toolchain",{}).get("publisher") or "unknown")' "$out/manifest.json" 2>/dev/null || echo unknown)
  fi
  local sha; sha=$(igit rev-parse --short HEAD 2>/dev/null || echo "unknown")
  
  if [ "$PUSH" -eq 1 ] && would_shrink "$br" "$n" "$edges"; then
    if [ "$FORCE" -eq 0 ]; then
      die "refusing to publish '$br': candidate smaller than incumbent. Use --force."
    fi
    warn "--force: publishing a smaller cache than the incumbent"
  fi
  
  local subj; subj=$(seed_subject "$pkg" "$n" "$edges" "$pub_version" "$sha")
  
  local tmp; tmp=$(mktemp -d) || die "mktemp failed"
  trap "rm -rf '$tmp'" RETURN
  
  cp -R "$out/"* "$tmp/" 2>/dev/null || true
  rm -f "$tmp/index.lock"
  # `ig.root` is the builder's absolute path (`/Users/<name>/...`): it names a
  # machine, not the cache, and nothing reads it. Record it relative to the IG.
  if [ -f "$tmp/manifest.json" ] && command -v python3 >/dev/null 2>&1; then
    python3 - "$tmp/manifest.json" <<'PY' || die "could not normalise ig.root in manifest.json"
import json, sys
p = sys.argv[1]
m = json.load(open(p))
if isinstance(m.get("ig"), dict) and "root" in m["ig"]:
    m["ig"]["root"] = "."
    with open(p, "w") as f:
        json.dump(m, f, indent=2)
        f.write("\n")
PY
  fi
  # The Publisher's expansions go with the AST: its ValueSets carry no
  # expansion, and anything that enumerates a ValueSet's codes (a JSON Schema,
  # a vocabulary) needs the build's own expansion rather than a second call to
  # a terminology server. Restored into output-ast/ with the rest.
  if [ -f "$root/output/expansions.json" ] && [ ! -f "$tmp/expansions.json" ]; then
    cp "$root/output/expansions.json" "$tmp/expansions.json"
  fi
  # The Publisher's QA summary, for the site's QA report (ig-qa-page.ts): the
  # site never reads the Publisher's output/, so the AST carries it.
  if [ -f "$root/output/qa.json" ] && [ ! -f "$tmp/qa.json" ]; then
    cp "$root/output/qa.json" "$tmp/qa.json"
  fi
  # And every message it reported (output/qa.xml), as JSON (ig-qa-messages.ts).
  if [ -f "$root/output/qa.xml" ] && [ ! -f "$tmp/qa-messages.json" ]; then
    bun run "$(dirname "${BASH_SOURCE[0]}")/ig-qa-messages.ts" "$root/output/qa.xml" "$tmp/qa-messages.json" >&2 || true
  fi
  # The IG API: the sidecars a layer above generates from this AST
  # (`ig-site:sidecars`), committed with it so a site reads them by raw URL at
  # this commit instead of copying them (owner, 2026-11-10, card "A";
  # ig-api-cache.ts). Always regenerated, never carried from a restore. A
  # failure seeds without one, and a site built from the commit falls back to
  # generating them. IG_CACHE_IG_API=0 leaves it out.
  rm -rf "$tmp/ig-api"
  if [ "${IG_CACHE_IG_API:-1}" != "0" ] && command -v bun >/dev/null 2>&1; then
    bun run "$(dirname "${BASH_SOURCE[0]}")/ig-api-cache.ts" --ig "$root" --into "$tmp/ig-api" \
      || { warn "the IG API was not generated: seeding without it"; rm -rf "$tmp/ig-api"; }
  fi
  # The IG's artefact index, built from this AST (and the IG API above) with
  # paths in this tree, so a site reads it by raw URL at this commit instead
  # of publishing it (owner, 2026-11-10, card "A"; ig-index-cache.ts). A
  # failure seeds without it. IG_CACHE_INDEX=0 leaves it out.
  rm -rf "$tmp/fhir-artifact-index"
  if [ "${IG_CACHE_INDEX:-1}" != "0" ] && command -v bun >/dev/null 2>&1; then
    bun run "$(dirname "${BASH_SOURCE[0]}")/ig-index-cache.ts" --ig "$root" --tree "$tmp" \
      || { warn "the artefact index was not built: seeding without it"; rm -rf "$tmp/fhir-artifact-index"; }
  fi
  # txcache goes alongside AST on the branch
  if [ -d "$root/input-cache/txcache" ]; then
    cp -R "$root/input-cache/txcache" "$tmp/"
  fi
  
  if [ "$PUSH" -eq 1 ]; then
    info "committing to $br directly..."
    # The index lives OUTSIDE the tree being committed: inside it, `git add .`
    # picked up its own `index.lock` (the 2026-10-02 smart-trust seed carries
    # one). The env is scoped to these commands, never exported.
    local gitdir; gitdir=$(igit rev-parse --absolute-git-dir) || die "IG root is not a git repository: $root"
    local idx; idx=$(mktemp) && rm -f "$idx"
    local tree commit
    GIT_DIR="$gitdir" GIT_INDEX_FILE="$idx" GIT_WORK_TREE="$tmp" git add -A . \
      || die "git add failed"
    tree=$(GIT_DIR="$gitdir" GIT_INDEX_FILE="$idx" git write-tree) || die "git write-tree failed"
    rm -f "$idx"
    # Each seed is a CHILD of the branch's current tip, never a lone orphan
    # commit force-pushed over it: a site reads the AST's files by raw URL
    # pinned to the commit it was built from (owner, 2026-11-10, card "A";
    # fhir-harness#325), and a commit nothing points at is garbage-collected,
    # which would empty those pages. The lease refuses a push that raced
    # another seed instead of overwriting it.
    local parent=""
    parent=$(igit ls-remote "$REMOTE" "refs/heads/$br" 2>/dev/null | cut -f1) || parent=""
    if [ -n "$parent" ]; then
      igit fetch -q --depth 1 "$REMOTE" "$parent" >/dev/null 2>&1 || die "could not fetch $br's tip $parent to seed on top of it"
      commit=$(GIT_DIR="$gitdir" git commit-tree "$tree" -p "$parent" -m "$subj") || die "git commit-tree failed"
    else
      commit=$(GIT_DIR="$gitdir" git commit-tree "$tree" -m "$subj") || die "git commit-tree failed"
    fi
    igit push --force-with-lease="refs/heads/$br:$parent" "$REMOTE" "$commit:refs/heads/$br" >/dev/null 2>&1 \
      || die "push failed (another seed may have moved $br; re-run)"
    printf '\npushed %s (%s resources, %s edges)\n' "$br" "$n" "$edges"
  else
    printf '\nFiles written to %s\n' "$tmp"
    printf 'Push them to the cache branch manually or pass --push.\n'
  fi
}

cmd_contribute() {
  PUSH=1
  cmd_seed "$@"
}

cmd_verify() {
  local root; root=$(resolve_ig_root)
  local out="$root/output-ast"
  if [ ! -d "$out" ]; then
    printf '**cached-step `ig-ast`: miss** (exact) — no output-ast restored. Key `%s`.\n' \
      "$(bun run "$IG_AST_TS" digest --ig "$root" 2>/dev/null || echo unknown)"
    die "no output-ast found in $root"
  fi
  local rc=0
  bun run "$IG_AST_TS" validity "$out" --ig "$root" || rc=$?
  # The `fhir-ast` cache's summary line (caches/fhir-ast.cache.json).
  bun run "$IG_AST_TS" cache-line "$out" --ig "$root" || true
  return "$rc"
}

cmd_doctor() {
  local root; root=$(resolve_ig_root)
  printf 'ig cache doctor\n'
  
  if command -v java >/dev/null 2>&1; then
    info "java: $(java -version 2>&1 | head -1)"
  else
    warn "java not found"
  fi
  
  if command -v sushi >/dev/null 2>&1; then
    info "sushi: $(sushi -v 2>&1 | head -1)"
  else
    warn "sushi not found"
  fi
  
  local jar=$(find ~/.fhir -name 'org.hl7.fhir.publisher.jar' 2>/dev/null | head -1)
  if [ -n "$jar" ]; then
    info "publisher: $jar"
  else
    warn "publisher: org.hl7.fhir.publisher.jar not found in ~/.fhir"
  fi
  
  if command -v mvn >/dev/null 2>&1; then
    info "maven: $(mvn -v 2>&1 | head -1 | cut -d' ' -f1-3)"
  else
    warn "maven not found"
  fi
  
  probe_host packages.fhir.org
  probe_host tx.fhir.org
}

# Is a host reachable, and if not, what to do about it? Bean `6mk7`: a refused
# packages.fhir.org once left an agent concluding SUSHI could not run, while
# the seeder for exactly that refusal sat in the Tool graph. The answer is the
# graph's (`remedies` on each network Tool), not text kept here.
#
# The status is read as a CODE: the old `grep '200 OK'` never matches an
# HTTP/2 status line (`HTTP/2 200`), so a reachable host read as unreachable.
probe_host() {
  local host="$1" code
  code="$(curl -s -o /dev/null -I -w '%{http_code}' --max-time 15 "https://$host" 2>/dev/null || true)"
  case "$code" in
    2??|3??) info "network: $host reachable ($code)"; return 0 ;;
  esac
  warn "network: $host UNREACHABLE (${code:-no response})"
  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  if command -v bun >/dev/null 2>&1 && [ -f "$root/package.json" ]; then
    (cd "$root" && bun run --silent cat tools:remedy "$host" 2>/dev/null) | sed 's/^/    → /' >&2 || true
  else
    warn "  what to do instead: bun run cat tools:remedy $host"
  fi
}

cmd_list() {
  cmd_list_names
}

case "$CMD" in
  status)     cmd_status "$@" ;;
  restore)    cmd_restore "$@" ;;
  seed)       cmd_seed "$@" ;;
  contribute) cmd_contribute "$@" ;;
  verify)     cmd_verify "$@" ;;
  doctor)     cmd_doctor "$@" ;;
  list)       cmd_list "$@" ;;
  help)
    grep '^#' "$0" | cut -c 3-
    ;;
  *)
    die "unknown command: $CMD"
    ;;
esac
