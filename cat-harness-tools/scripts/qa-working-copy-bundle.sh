#!/usr/bin/env bash
#
# Carry ONE build of the QA working copy to every job of a CI run that reads
# it — bean `jtfk`, issue #2456. CI only; not wrapped by `bat:sync`.
#
# ## Why
#
# `bun run qa:working-copy` (bean `72a8`) ran in nine jobs of
# `code-quality-gates.yml`, and in run 37659324493 (PR #2363, 2026-10-07) it
# was 2,284 of the run's 4,714 runner-seconds — 48 %, each job computing the
# same tree from the same commit. Now the `qa-working-copy` job builds it once
# and the readers restore it.
#
# ## What is carried — measured, not declared
#
# Not a list of directories. `qa:working-copy` writes the declared `qa` roots,
# but its writers also regenerate docs projections, UML overviews, payloads and
# `build/` files beside them, restore some committed files and leave others;
# a hand-kept list is how a reader would one day get a partial tree. So the
# producer snapshots the checkout before and after the build, and the bundle is
# EVERYTHING that changed: every file whose (mtime, size) moved or which is
# new, every new directory, and every path that disappeared. A file a writer
# rewrote and `qa:refresh` restored is carried too, with the same bytes the
# checkout already has — harmless, and cheaper than being clever about it.
#
# ## Byte-identical, checked
#
# The bundle carries `manifest.txt`: a sha256 for every carried file, the new
# directories and the deleted paths. The producer prints the manifest's own
# sha256 as a job output; each reader checks the downloaded manifest against
# that hash BEFORE extracting, then `sha256sum -c` every carried file IN PLACE
# after extracting. A reader therefore judges exactly the tree the producer
# built, or goes red saying why — never a partial or substituted copy.
#
# What it does NOT carry: `bun install` (each job runs it; same lockfile) and
# the branch mount (`state:mount`, each job mounts as before) — both happen
# before the producer's first snapshot, so they are outside the bundle by
# construction, exactly as they were outside the build.
#
# Usage:
#   qa-working-copy-bundle.sh snapshot FILE
#   qa-working-copy-bundle.sh pack BEFORE OUTDIR      # prints the manifest sha256
#   qa-working-copy-bundle.sh restore DIR EXPECTED    # check the hash, extract, check every file
#   qa-working-copy-bundle.sh verify DIR EXPECTED     # check the hash and every file; extract nothing
#
# Exit: 0 done · 1 a check failed (named on stderr) · 2 usage.
set -euo pipefail

cmd="${1:-}"

# Every file, symlink and directory in the checkout except `.git` and
# `node_modules`, with mtime and size, one per line, sorted bytewise.
# Directories carry no mtime: adding a file to one changes it, and a moved
# directory mtime is not a change worth carrying.
snapshot() {
  find . \( -name .git -o -name node_modules \) -prune -o \
    \( -type f -o -type l \) -printf 'f\t%P\t%T@\t%s\n' -o \
    -type d -printf 'd\t%P\t-\t-\n' | LC_ALL=C sort
}

case "$cmd" in
  snapshot)
    [ $# -eq 2 ] || { echo "usage: $0 snapshot FILE" >&2; exit 2; }
    snapshot > "$2"
    echo "snapshot: $(wc -l < "$2") entries -> $2"
    ;;

  pack)
    [ $# -eq 3 ] || { echo "usage: $0 pack BEFORE OUTDIR" >&2; exit 2; }
    before="$2"; out="$3"
    mkdir -p "$out"
    after="$(mktemp)"
    snapshot > "$after"
    # New or changed entries (whole-line difference), and paths that vanished.
    LC_ALL=C comm -13 "$before" "$after" | awk -F'\t' '$1=="f"{print $2}' > "$out/files.txt"
    LC_ALL=C comm -13 "$before" "$after" | awk -F'\t' '$1=="d"{print $2}' > "$out/dirs.txt"
    LC_ALL=C comm -23 <(cut -f2 "$before" | LC_ALL=C sort -u) <(cut -f2 "$after" | LC_ALL=C sort -u) > "$out/deleted.txt"
    {
      while IFS= read -r p; do [ -n "$p" ] && echo "dir $p"; done < "$out/dirs.txt"
      while IFS= read -r p; do [ -n "$p" ] && echo "deleted $p"; done < "$out/deleted.txt"
      if [ -s "$out/files.txt" ]; then
        tr '\n' '\0' < "$out/files.txt" | xargs -0 sha256sum --
      fi
    } > "$out/manifest.txt"
    # Directories first and without recursion, so an empty one survives.
    { cat "$out/dirs.txt"; cat "$out/files.txt"; } | grep -v '^$' \
      | tar --no-recursion -cf "$out/qa-working-copy.tar" -T -
    rm -f "$after"
    echo "pack: $(wc -l < "$out/files.txt") file(s), $(wc -l < "$out/dirs.txt") new dir(s), $(wc -l < "$out/deleted.txt") deleted path(s), $(du -h "$out/qa-working-copy.tar" | cut -f1) tar" >&2
    sha256sum "$out/manifest.txt" | cut -d' ' -f1
    ;;

  restore|verify)
    [ $# -eq 3 ] || { echo "usage: $0 $cmd DIR EXPECTED" >&2; exit 2; }
    dir="$2"; expected="$3"
    if [ -z "$expected" ]; then
      echo "$cmd: no expected manifest hash — the producer job did not report one, so there is no copy to trust. NOT a pass." >&2
      exit 1
    fi
    for f in manifest.txt qa-working-copy.tar; do
      [ -f "$dir/$f" ] || { echo "$cmd: $dir/$f is missing — the artifact did not arrive whole. NOT a pass." >&2; exit 1; }
    done
    got="$(sha256sum "$dir/manifest.txt" | cut -d' ' -f1)"
    if [ "$got" != "$expected" ]; then
      echo "$cmd: manifest sha256 $got != producer's $expected — this is not the copy the producer built. NOT a pass." >&2
      exit 1
    fi
    if [ "$cmd" = restore ]; then
      tar -xf "$dir/qa-working-copy.tar"
      while IFS= read -r line; do
        case "$line" in
          "deleted "*) rm -rf -- "${line#deleted }" ;;
        esac
      done < "$dir/manifest.txt"
    fi
    # Verify IN PLACE: every carried file, every new directory, every deletion.
    bad=0
    grep -vE '^(dir|deleted) ' "$dir/manifest.txt" > "$dir/sums.txt" || true
    if [ -s "$dir/sums.txt" ] && ! sha256sum --quiet -c "$dir/sums.txt"; then bad=1; fi
    while IFS= read -r line; do
      case "$line" in
        "dir "*) [ -d "${line#dir }" ] || { echo "$cmd: directory ${line#dir } is absent" >&2; bad=1; } ;;
        "deleted "*) [ ! -e "${line#deleted }" ] || { echo "$cmd: ${line#deleted } should be gone and is not" >&2; bad=1; } ;;
      esac
    done < "$dir/manifest.txt"
    if [ "$bad" -ne 0 ]; then
      echo "$cmd: the tree on disk does not match the producer's manifest. NOT a pass." >&2
      exit 1
    fi
    echo "$cmd: $(wc -l < "$dir/sums.txt") file(s) byte-identical to the producer's build (manifest sha256 $got)"
    ;;

  *)
    echo "usage: $0 snapshot FILE | pack BEFORE OUTDIR | restore DIR EXPECTED | verify DIR EXPECTED" >&2
    exit 2
    ;;
esac
