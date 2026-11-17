---
# folio-assistant-b94c
$schema: bean/1.0.0
title: 'Cross-platform support: detect Linux-specific assumptions and provide a Windows path'
status: completed
type: task
priority: high
created_at: 2026-09-21T16:15:47Z
updated_at: 2026-10-07T17:18:00Z
parent: folio-assistant-1xhc
---

Issue [#735](https://github.com/litlfred/folio-assistant/issues/735). CRDM
Phase 1 (needs assessment) — requester @costateixeira, sign-off @litlfred.

## What

A stated cross-platform policy, a mechanical check that detects Linux-specific
assumptions across scripts, tooling, docs and content pipelines, and a Windows
path wherever the check fires. Where Windows cannot be supported, a **declared**
exclusion rather than silence.

Not a port of the 54 `.sh` scripts. Porting them produces 54 files that rot,
because nothing stops the 55th landing next week.

## Measured 2026-09-21 on a Windows 11 checkout at 3953a35

54 `.sh`, **0** `.ps1`/`.cmd`/`.bat`. 81 of 82 CI jobs on `ubuntu-latest`.
**0** documentation mentions of Windows — a grep for `windows|powershell|winget|wsl`
over every `.md` returned 18 hits, all false positives (`board-windows`,
"context windows", `blob.core.windows.net`). 8 `.ts` files hardcode `/tmp`;
4 call `chmod`/`chown`. 88 `.ts` files match a broad `bash|sh|execSync` grep —
an **upper bound needing triage, not a defect count**, and triaging it is a
reason to build the check rather than an argument against.

0 of 175 npm scripts invoke a `.sh` directly — that layer is already portable.

## This generalises `en68`, it does not start from nothing

`en68` (completed, PR #683) fixed a Windows clone that failed outright — NTFS
rejects `:` in a path component and Git aborts the whole checkout, so the repo
produced **no working tree at all** on Windows after 869 MiB. It shipped
`check:portable-paths` over 5,907 tracked paths, wired into
`code-quality-gates.yml`.

@litlfred on that PR: *"seems to be only fixing one issue, not the pattern."*
The pattern argument is therefore already accepted; this is the same argument
one layer out.

## Why nothing catches the rest

Same shape as `en68`'s §"Why nothing caught it", which is why this parents to
`1xhc`: the author's machine is Linux and CI is Linux, so the failure is
invisible from both sides by construction. A gate that never fires on Windows
cannot be told from one that passed.

## Done when

Not yet settled — this is Phase 1. Requirements are agreed with the BA before
`## Done when` is written, per `crdm-requirements-workflow`. Three questions
are open on the issue: whether the `pyhecke-native-wheels.yml` exclusion stands,
whether the target is native Windows / Git Bash / documented WSL2, and whether
CI gains a Windows matrix leg and over which gates.

## Not doing

Not folding in the two stale-documentation defects found in the same session —
`installation.md` pointing at a `src/` that moved under `cat-harness/`, and the
Dockerfile `COPY`ing `schemas/`, `skills/` and `scripts/` from a root that no
longer holds them. Both are plain defects with an obvious fix and no policy
question attached; entangling them with a scope decision delays both.

## Completed on landed evidence
Landed on main in PR #683 (en68: the repository is unclonable on Windows — encode the sidecar stem, and gate the tree).
