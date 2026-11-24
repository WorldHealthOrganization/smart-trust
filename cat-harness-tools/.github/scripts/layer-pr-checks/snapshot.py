#!/usr/bin/env python3
"""Carry one side's prepared root from the prepare job to its shards.

cat-harness-tools#397. Every shard used to rebuild the same root: mount the
layers, take the lower ones at main, swap the caller in, mount the graphs kept
on branches, build the IG pages and run `derive:publish`. On smart-base run
38866215814 that was 6-10 minutes in each of eight shards, about 67 of the
run's 200 work-minutes, for one answer per side.

Now the prepare job of each side does it once and hands the shards what
changed. A shard mounts the same lock itself (the mount cache makes that a
few seconds), then applies this snapshot, so it holds the same tree.

  snapshot.py mark <root> <list>           every file under <root> now, with
                                           its inode, size and mtime
  snapshot.py save <root> <list> <out>     after preparing: <out>.tar (files
                                           new or changed since <list>) and
                                           <out>.deleted
  snapshot.py apply <root> <out>           in a shard: remove the deleted
                                           paths and the directories they
                                           leave empty, then unpack the tar
  snapshot.py diff <root> <list> <dir>...  the files under any <dir> written,
                                           changed or removed since <list>;
                                           exits 1 when there are any (bean
                                           `cat-tools-sm8r`, item 4, step 7)

`node_modules` and `.git` are left out: a shard installs for itself, and the
mounts carry no `.git`. The one exception is the root's `.git/branch-mounts`:
`mountTip` (branch-store.ts) files each graph's mount marker there, in the
git directory rather than the mount, and the shard's own checkout of the same
commit has none. A path that was replaced keeps its name in the tar and
loses its old copy. A file counts as changed when its inode, size or mtime
differs from the mark, not when it is newer than the mark: the caller is
swapped in with `mv`, which keeps the mtimes of its checkout, older than the
mark, but every moved-in file is a different inode.
"""
import os
import sys
import tarfile

SKIP = {"node_modules", ".git"}
KEEP = [os.path.join(".git", "branch-mounts")]


def walk(root):
    out = []
    tops = [root] + [os.path.join(root, k) for k in KEEP if os.path.isdir(os.path.join(root, k))]
    for d, dirs, files in (w for t in tops for w in os.walk(t)):
        dirs[:] = sorted(x for x in dirs if x not in SKIP)
        for f in sorted(files):
            p = os.path.join(d, f)
            if os.path.islink(p) or os.path.isfile(p):
                out.append(os.path.relpath(p, root))
    return out


def stamp(root, p):
    s = os.lstat(os.path.join(root, p))
    return f"{s.st_ino} {s.st_size} {s.st_mtime_ns}"


def mark(root, listing):
    with open(listing, "w") as f:
        for p in walk(root):
            f.write(f"{stamp(root, p)} {p}\n")


def save(root, listing, out):
    before = {}
    with open(listing) as f:
        for line in f:
            ino, size, mtime, p = line.rstrip("\n").split(" ", 3)
            before[p] = f"{ino} {size} {mtime}"
    now = walk(root)
    changed = [p for p in now if before.get(p) != stamp(root, p)]
    deleted = sorted(set(before) - set(now))
    with tarfile.open(out + ".tar", "w") as t:
        for p in changed:
            t.add(os.path.join(root, p), arcname=p, recursive=False)
    with open(out + ".deleted", "w") as f:
        f.write("\n".join(deleted) + ("\n" if deleted else ""))
    print(f"snapshot: {len(changed)} file(s) written or changed, {len(deleted)} removed, since the mount")


def apply(root, out):
    with open(out + ".deleted") as f:
        deleted = [x for x in f.read().split("\n") if x]
    for p in deleted:
        q = os.path.join(root, p)
        if os.path.lexists(q):
            os.remove(q)
        # A directory the PR emptied goes too: the prepared tree never had it
        # (the caller was swapped in whole), and a leftover empty folder is
        # not nothing to a reader. `tools()` takes `tools/<id>/` for a Tool
        # whose `<id>.ts` is missing (cat-harness#390).
        d = os.path.dirname(q)
        while os.path.abspath(d) != os.path.abspath(root) and os.path.isdir(d) and not os.listdir(d):
            os.rmdir(d)
            d = os.path.dirname(d)
    with tarfile.open(out + ".tar") as t:
        n = len(t.getnames())
        t.extractall(root, filter="tar")
    print(f"snapshot applied: {len(deleted)} removed, {n} unpacked")


def diff(root, listing, dirs):
    before = {}
    with open(listing) as f:
        for line in f:
            ino, size, mtime, p = line.rstrip("\n").split(" ", 3)
            before[p] = f"{ino} {size} {mtime}"
    prefixes = [d.strip("/") + "/" for d in dirs if d.strip("/")]
    inside = lambda p: any(p.startswith(x) for x in prefixes)
    now = [p for p in walk(root) if inside(p)]
    changed = [p for p in now if before.get(p) != stamp(root, p)]
    deleted = sorted(p for p in set(before) - set(now) if inside(p))
    for p in changed:
        print(f"written  {p}")
    for p in deleted:
        print(f"removed  {p}")
    print(f"{len(changed)} file(s) written or changed, {len(deleted)} removed inside {len(prefixes)} mount(s)")
    return 1 if changed or deleted else 0


def main():
    a = sys.argv[1:]
    if len(a) == 3 and a[0] == "mark":
        mark(a[1], a[2])
    elif len(a) == 4 and a[0] == "save":
        save(a[1], a[2], a[3])
    elif len(a) == 3 and a[0] == "apply":
        apply(a[1], a[2])
    elif len(a) >= 3 and a[0] == "diff":
        sys.exit(diff(a[1], a[2], a[3:]))
    else:
        print(__doc__, file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
