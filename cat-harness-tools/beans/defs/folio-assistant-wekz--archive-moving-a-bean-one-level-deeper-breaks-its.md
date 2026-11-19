---
# folio-assistant-wekz
$schema: bean/1.0.0
title: 'ARCHIVE: moving a bean one level deeper breaks its relative links, and the CLI reports a path it did not write to'
status: completed
type: bug
priority: normal
created_at: 2026-09-23T21:44:21Z
updated_at: 2026-09-23T21:44:43Z
parent: folio-assistant-1xhc
---

Owner authorised `beans archive` 2026-09-23, the last outstanding
`bean-store` finding on [#860](https://github.com/litlfred/folio-assistant/issues/860).
It ran, it moved 631 beans, and it left two things behind that are worth
recording rather than quietly repairing.

## 1. A moved bean's relative links break — measured, not predicted

`check:subgraphs` was **GREEN before the archive and RED after**, with
**21 dangling links across 15 files**. Established by stashing the change and
re-running, rather than inferred from the diff.

The cause is arithmetic: a bean at `beans/defs/X.md` writes
`](../../cat-harness/skills/…)` — two levels up is the repository root. From
`beans/defs/archive/X.md` two levels up is `beans/`. Every such link in every
archived bean is off by one.

`beans` is third-party and rewrites nothing, so a corpus that links out of its
beans acquires 21 broken links the moment it tidies up. Nothing warned; only
the gate caught it.

**Repaired precisely rather than by bulk rewrite.** For each `../`-relative
link in an archived bean: if it still resolves, leave it; if it does not and
one more `../` makes it resolve, rewrite it; otherwise leave it and count it.
21 rewritten, 1 left — `docs/audits/...`, an ellipsis in prose rather than a
target, which is why the check is green with it still there.

## 2. The CLI names a path it did not write to

    $ beans archive
    Archived 631 bean(s) to .beans/archive/

It wrote to **`beans/defs/archive/`**. `.beans/` does not exist in this
repository and must not: AGENTS.md records that `.beans/` was MOVED to
`beans/` (bean `8xzw`) because this repository's own dot-prefix guard rejects a
dot-prefixed segment.

The behaviour is right — it honours `.beans.yml`'s `path: beans/defs` — and
only the message is wrong. Recorded because an agent that trusts the message
looks for 631 beans in a directory that does not exist, and concludes they were
lost. Upstream, not ours to patch here.

## What was verified before trusting it

A census, because a store-wide move is the one operation where "it printed a
number" is not evidence:

    before   670 defs + 219 archive = 889 files
    after    254 defs + 631 archive = 885 files

**Four short**, and each was found: `1feu`, `2tlx`, `3w0i`, `4j3h` were present
in BOTH `defs/` and `defs/archive/`, byte-identical, so archiving collapsed
each pair. 885 distinct beans before, 885 after — nothing lost, and four
duplicate pairs resolved as a side effect. A consumer globbing both directories
would previously have counted those four twice.

One `completed` bean stayed in `defs/`: `t3n8`, updated 2026-09-21 and not in
the archive. Left alone — it is the CLI's judgement and not obviously wrong.

`beans list` still reads the store (883 rows) and `beans show tyyc` still
resolves an ARCHIVED bean, which is what the archive promises: *"remain visible
in all queries."*

## Done when

- [x] The 21 links the move broke are repointed, each checked individually
- [x] The break is established as caused by the move, not pre-existing
- [x] The census reconciles, with every discrepancy named
- [x] The CLI's wrong path message is recorded rather than worked around silently
- [x] The archive is still queryable through the CLI

Parent `1xhc`.
