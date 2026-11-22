---
layout: default
title: Reseeding the Lean cache
parent: Authoring guides
nav_order: 5
---

# Reseeding the Lean cache
{: .no_toc }

This is the procedure to rebuild the Lean cache branches when they lack
traces, own-package oleans or the toolchain's static libraries.

> **Branch names.** The scripts resolve a key to `cat-lake-cache/<key>` if it
> exists, otherwise to `lake-cache/<key>` if that exists — for a seed as well
> as a restore. The commands below name the `lake-cache/` branches explicitly;
> drop `--branch` and the script resolves the right one.

> **Network.** Step 1 needs neither elan nor elan's hosts
> (`elan.lean-lang.org`, `release.lean-lang.org`), which are unreachable from
> the cloud authoring container: `lake-cache.sh install-toolchain` fetches the
> toolchain from GitHub release assets. Step 2 needs Mathlib's cache CDN
> (`mathlib4.lean-cache.cloud`, `lakecache.blob.core.windows.net`), which is
> blocked from that container and has no GitHub-hosted mirror, so Step 2
> onward needs CI or a local machine. The two are independent egress
> restrictions: a working toolchain does **not** imply a reachable cache.

1. TOC
{:toc}

---

## What a broken cache looks like

Three independent defects:

| Defect | Effect |
|---|---|
| No `.trace` files | Lake reads `.trace`, not `.olean`, to decide staleness. Untraced modules are "out of date", so a build rebuilds them — and **evicts** them. |
| No own-package oleans | Every build recompiles the paper; sibling `.lean` files cannot elaborate standalone. |
| Toolchain branch has no `.a` files | `lean` elaborates but nothing **links**, so `lake exe …` fails — including `lake exe cache get`. |

## Just run the script

Everything below is automated:

```sh
# Dry run first — shows every command, changes nothing
folio-assistant/scripts/reseed-lean-cache.sh --repo ~/src/qou --dry-run

# Real run: stops after seeding to a -test branch and verifying it
folio-assistant/scripts/reseed-lean-cache.sh --repo ~/src/qou

# Publish, once you have read the verify output
folio-assistant/scripts/reseed-lean-cache.sh --repo ~/src/qou --promote
```

Runs from any branch, never switches your working tree, and refuses to
proceed on a dirty tree or a local branch collision. Chip across
sessions with `--target QOU.SubTree`, resume with `--phase <name>`.

The manual steps below are the same procedure, for when you want to
drive it yourself or something goes wrong.

## A from-source build seeds a NARROWER cache than the CDN

The two routes to a traced Mathlib do not produce the same tree, and the
seed guards cannot tell them apart:

| route | what lands |
|---|---|
| `lake exe cache get` | Mathlib's full published set (~7300 modules) |
| `lake build` from source | only the modules this package's imports reach |

Both are correctly traced, both satisfy `seed`'s guards — which check
that the package's own oleans exist and that the oleans present carry
their traces. Neither guard measures **breadth**, because there is no
baseline to measure against.

So a cache seeded from a source build makes *this* package build fast,
while anything reaching a Mathlib module outside its import closure still
rebuilds. That is fine for a single package's branch; say so before
publishing to a **shared** one, because the branch outlives the session that
seeded it.

If you have the CDN, prefer it: it is both faster and wider. Use the
source build when the CDN is unreachable, and say which route produced a
branch when you promote it.

## Prerequisites

- Network access to `github.com` release assets and Mathlib's cache host.
  elan's own hosts are **not** required — see step 1.
- `zstd` on PATH (release assets are `.tar.zst`; there is no `.tar.gz`).
- ~15 GB free disk, and hours for the first build.
- Both repos checked out.

## Step 0 — branches

Nothing here requires you to check out a `lake-cache/*` branch by hand.
`seed --push` creates the orphan branch inside a **detached worktree**,
so your working tree never leaves `main`. (Do not `git switch --orphan`
in the main tree — it leaves every file untracked and strands you.)

```sh
# Content repo — has the workflows, roster, and Lean packages
git -C ~/src/qou fetch origin
git -C ~/src/qou checkout main
git -C ~/src/qou pull --ff-only

# Platform — has the cache service
git -C ~/src/folio-assistant fetch origin
git -C ~/src/folio-assistant checkout main
git -C ~/src/folio-assistant pull --ff-only
```

Set one variable — everything below uses it:

```sh
export FA=~/src/folio-assistant          # or ~/src/qou/folio-assistant
export CACHE="$FA/scripts/lake-cache.sh"
cd ~/src/qou
```

## Step 1 — a real toolchain

```sh
bash "$CACHE" install-toolchain          # reads ./lean-toolchain

export PATH="$HOME/.elan/toolchains/leanprover--lean4---v4.24.0/bin:$PATH"

# MUST show static libs, or `lake exe` will fail later:
find ~/.elan/toolchains -name 'libleancpp.a' | head -1
```

If that `find` prints nothing, stop — the rest cannot work.

`install-toolchain` downloads straight from
`github.com/leanprover/lean4/releases`, so it works where elan's hosts
are blocked. It also handles the trap that costs the most time here: an
**incomplete** toolchain tree (what `restore-toolchain` leaves behind)
sits at exactly the path elan expects, so elan concludes the toolchain is
installed, skips the download, and leaves you with a `lean` that
elaborates but cannot link. The command detects that by looking for the
static libs rather than the directory, and replaces it.

It verifies in a staging directory and only then publishes, so a
truncated download never lands at the installed path. Re-running is a
no-op; `--force` reinstalls. For a mirror or an air-gapped tree, set
`LEAN_RELEASE_BASE`.

Still prefer elan? It remains the right tool for **nightlies**, which are
not published as `lean4` release assets — `install-toolchain` declines
those and tells you so.

## Step 2 — a traced Mathlib, the fast way

```sh
cd content/quantum-observable-universe/lean
lake exe cache get
```

Mathlib's upstream cache ships oleans **with** their traces. It takes
minutes, versus hours to build Mathlib from source.

Check it landed traced:

```sh
bash "$CACHE" status --package qou
```

Look for `traces: … (≥90% coverage)`. If coverage is low, do not
continue — seeding would reproduce the current defect, and `seed`
will refuse anyway.

## Step 3 — build the paper's own modules

```sh
lake build            # ~1582 modules; hours on first run
```

This is the expensive step, and it is **one-time**. Once traces exist,
later builds are genuinely incremental.

### Chipping at it across sessions

You do not have to finish in one sitting. Build a subtree, seed, and
resume later — each seed accumulates:

```sh
lake build QOU.BraidKnot          # a subtree, not everything
bash "$CACHE" status --package qou   # own pkg: should now be > 0
```

Then seed (Step 4), and next session `restore` picks up where you left
off. Because `lake build` is incremental once traced, the next chip only
compiles what is new.

## Step 4 — seed safely

**Seed to a `-test` branch first and verify a restore from it.** A bad
force-push to the production branch breaks it for everyone, and the
branch carries no history to recover from.

```sh
SLUG=$(cut -d: -f2 lean-toolchain | tr -d '[:space:]' | tr . -)

# 1. Seed to a test branch
bash "$CACHE" seed --package qou --branch "lake-cache/qou-$SLUG-test" --push

# 2. Verify it restores into a clean tree
cd /tmp && rm -rf verify && git clone --depth 1 <qou-url> verify
cd verify/content/quantum-observable-universe/lean
bash "$CACHE" restore --package qou --branch "lake-cache/qou-$SLUG-test"
bash "$CACHE" status  --package qou
```

The verify run must show **all three** healthy:

```
oleans:     <big>
own pkg:    <non-zero>          <- not the current defect
traces:     <big> (100% coverage)
```

3. Only then cut over to production:

```sh
cd ~/src/qou/content/quantum-observable-universe/lean
bash "$CACHE" seed --package qou --branch "lake-cache/qou-$SLUG" --push
```

`seed` refuses to publish if own-package oleans are zero or trace
coverage is under 90%, so a bad seed fails loudly rather than silently
replacing a good branch with a useless one.

## Step 5 — the other packages

The roster (`.github/lake-packages.json`) lists four:

| Package | Lake root |
|---|---|
| `mathlib` | `.` |
| `qou` | `content/quantum-observable-universe/lean` |
| `ugb` | `content/unital-groebner-bases/lean` |
| `fred2005` | `content/fred2005-formal-groups/lean` |

Repeat Steps 2–4 per package, changing `--package` and the directory.
`mathlib` is exempt from the own-package guard — for that entry the
dependencies *are* the payload.

## Step 6 — the toolchain branch

`lake-cache/toolchain-<slug>` is missing its static libraries. Reseed it
from a real elan install:

```sh
cd ~/.elan/toolchains
tar czf - "leanprover--lean4---$(cat ~/src/qou/lean-toolchain | cut -d: -f2 | tr -d '[:space:]' | sed 's/^/leanprover--lean4---/;s/$//')" \
  | split -d -a 3 -b 90m - /tmp/lean-toolchain.tgz.part
```

Then push those parts to the branch the same way `seed --push` does.
Verify with `restore-toolchain`, which exits 3 if the `.a` files are
absent.

## Afterwards

Once a good branch exists, CI can keep it fresh: `lake-cache-refresh.yml`
(in the content repo) delegates to this same script, so the format cannot
drift and the guards apply there too.
