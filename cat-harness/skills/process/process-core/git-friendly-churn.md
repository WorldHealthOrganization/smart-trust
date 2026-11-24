---
name: git-friendly-churn
description: >
  Write files that git keeps many versions of (caches, published sites,
  generated indexes) so each new version costs a small delta, not a whole
  copy. The rules: the same bytes when nothing changed, stable paths,
  per-build facts kept apart, no compressed blobs, and how to measure it.
---

# Files git keeps many versions of

A cache branch, a pages branch or a generated index is rewritten on every
build, and git keeps every version. Most of each rewrite is unchanged. Whether
that unchanged part costs nothing, a small delta or a whole new copy depends
on how the writer lays the file out and names it, and the writer is ours.

Use this skill before adding or changing any writer whose output is committed
more than once: a cache seed (`compiled-artefact-cache`), a site build, an
index, a sidecar, a lock.

## How git stores the next version

**Decided** (git's own behaviour, documented in `git-pack-objects(1)` and
`Documentation/technical/pack-heuristics.txt`):

1. **An unchanged file costs nothing.** A blob is named by its bytes, so the
   same bytes at any path, in any commit, are stored once.
2. **A changed file is stored as a delta only if git pairs it with its old
   version.** Packing sorts objects by type, then by a hash of the path's
   last characters, then by size, and looks for a delta base among the next
   few objects (the window, 10 by default). Two versions whose paths END
   differently land far apart in that order and are usually not paired. The
   new version is then stored whole, zlib-compressed.
3. **Deltas match bytes, not lines.** A minified one-line JSON file deltas
   about as well as a pretty-printed one. Pretty-printing helps people and
   line diffs, not the pack.
4. **Compressed bytes do not delta.** One changed byte in the input of a
   `.zip`, `.tgz` or `.gz` changes most of the output.
5. **Very large files are never deltified.** Files over `core.bigFileThreshold`
   (512 MiB by default) are stored whole.

So the rules below are about rules 1 and 2: emit the same bytes when nothing
changed, and keep the path of a changing file the same.

## The rules

### 1. The same input writes the same bytes

- No clock. A build time, a run id or a commit sha in a file makes every
  build a new blob, and if that file is every page, every page is new. Work item
  `g196` measured it: one timestamp in the staging banner made 0 of ~390 HTML
  blobs shared between previews.
- Sort what has no order of its own: object keys you build from a map,
  directory listings, resource lists. Never rely on hash-map or filesystem
  order.
- Fix the formatting: one indent, one newline at the end, one number format.
  Two writers of one file must agree byte for byte.
- An archive that must be committed is written reproducibly (fixed mtimes,
  owner and order, `gzip -n`), as https://github.com/litlfred/fhir-harness/issues/257 did for `package.tgz`.

### 2. A file that changes keeps its path

- **Never put a version, a content hash or a build number in the file NAME
  of something that is rewritten.** Put it in a manifest beside the files.
  A pinned URL already names the version: a commit sha in the URL makes a
  hash in the name redundant.
- Disambiguate only what needs it. When two records would share a path,
  give only those two a suffix, and derive it from what tells them apart, not
  from what changes over time.
- Keep a record in one file across builds. Do not shard by something that
  moves, such as a position in a list or a page number.

Measured on the WHO SMART Immunizations AST cache (https://github.com/litlfred/fhir-harness/issues/325,
2026-11-10): resources were written as `<id>--<hash of canonical|version>.json`,
so 712 of 756 paths changed on every version bump while their contents
barely did. They are now `<id>.json`, with the hash kept only for two
resources that share a type and id.

### 3. Per-build facts live in one small file

What really is different on every build (the sha, the time, the run, the
branch) goes in ONE small file that pages fetch at load time, not into every
page. The staging banner's `staging.json` and the main site's `build.json`
are the pattern (`staging-banner.ts`, work item `g196`). The code that reads
them is a constant file too, served once, so it is not repeated in every page
(https://github.com/litlfred/cat-harness-tools/pull/1763).

### 4. Large files with small internal churn

A large file that changes a little on each build (an index, a search index,
a manifest) is cheap when rules 1 and 2 hold: stable path, sorted content,
no stamp. Splitting it helps only when readers need part of it, or when one
volatile part (a count, a date) would otherwise touch it every build. Then
move that part out, under rule 3.

### 5. Keep compressed and binary outputs out

Commit the uncompressed text. Let the server or the reader compress it. A
binary that must be published goes where `ig-binary-artefacts` says, not on
a branch that keeps every version.

## Measure, don't assume

A test of one writer is not a measurement of the branch: the staging banner
was proven constant and the pages still changed every build, because of the
footer (work item `g196`). Measure the artefact.

```sh
# Bytes a new commit adds to a branch (run in a clone with both commits).
git rev-list --objects OLD..NEW | git cat-file --batch-check='%(objectsize:disk) %(rest)' \
  | sort -rn | head -20          # what is new, largest first
git count-objects -vH            # size-pack before and after a repack
git verify-pack -v .git/objects/pack/*.idx | awk '$4 ~ /^[0-9]+$/ && NF>=7' | wc -l
                                 # how many objects were stored as deltas
```

Two builds from the same input should add nothing. Two builds one small change
apart should add a few KB. If they add a whole copy, look for a stamp (rule
1) or a renamed path (rule 2).

## Before you add a writer

- [ ] Run it twice on the same input: are the bytes the same?
- [ ] Does any file name carry a version, hash or date of something that changes?
- [ ] Is every per-build fact in one small file, not in each output?
- [ ] Is anything committed compressed?
- [ ] Did you measure two consecutive commits of the real branch?

## Related

- [`compiled-artefact-cache`](compiled-artefact-cache.md): the cache branches
  these rules keep small.
- `cat-harness-tools/src/staging/staging-banner.ts` and `cat-harness-tools/src/staging/staging-share.ts`: the
  constant banner and the preview pages served from the live site.
- `ig-binary-artefacts`: where binary build outputs go.
