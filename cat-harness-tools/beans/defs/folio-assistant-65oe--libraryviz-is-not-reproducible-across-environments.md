---
# folio-assistant-65oe
$schema: bean/1.0.0
title: 'library:viz is not reproducible across environments: refScan.filesRead embeds a count of the files on disk'
status: completed
type: task
priority: normal
created_at: 2026-10-03T15:40:27Z
updated_at: 2026-10-04T06:08:20Z
parent: folio-assistant-1xhc
---

## The defect

`cat-harness/docs/assets/library/index.json` ends with

    "refScan": { "filesRead": 2663, "unreadable": [] }

`filesRead` is a COUNT OF THE FILES THE SCAN READ ON DISK. It is therefore a
property of the checkout, not of the library, and it is committed. Any two
environments whose trees differ by even one scanned file disagree, so
`library:viz:check` reports stale whenever the last writer ran somewhere else.

## Measured, 2026-10-03, on `claude/hfag-rest`

The same file across twelve commits, by author:

    d374638e5  2663  Claude (this container)
    8772ae40b  2555  github-actions[bot]
    6e979ebbc  2648  Claude (this container)
    755bad293  2540  github-actions[bot]
    a7738fb1b  2648  Claude (this container)
    fae928ce7  2647  Claude (this container)
    edfac6899  2646  Claude (this container)
    76244c5ec  2538  Claude (a different container)
    97c64796c  2537  Claude (a different container)
    9cf1c6220  2646  Claude (this container)

**Two clusters about 108 apart**, strictly by where the writer ran — CI around
2540–2555, this container around 2646–2663, an earlier session around 2537–2538.
The values ALTERNATE as the bot and this session push in turn. That is not drift;
it is two environments each correctly reporting their own disk.

## Why it went unnoticed

`library:viz` is one of the two inputs `regen` names as **UNGATED** (with
`schema:viz`), so no gate ever compares it and CI never goes red on it. The loop
is therefore silent: each side regenerates, commits, and the other side sees
stale. Four consecutive main merges on #1949 produced four such commits from this
session, which I first attributed to `merge-main-bot` failing to regenerate
ungated inputs. **That attribution was wrong** — the bot runs `regen` through
`merge-base.ts` (line 236) and commits its output. Nothing was failing to
regenerate. The artefact cannot agree across machines.

## Why it is a defect and not a quirk

The audit-coverage skill already carries the rule this breaks: **a measurement
must not be a term in itself.** `filesRead` is a measurement of the run, baked
into the run's output, where it then functions as content for a staleness
comparison.

`unreadable: []` beside it is a different thing and should stay: it names FILES,
is empty in the good case, and is the "could not determine" signal a consumer
needs.

## Options, not a decision

1. Drop `filesRead` from the committed artefact. It answers a question about a
   run, and a run's statistics belong in a tool-run sidecar, not in the index.
2. Keep it but exclude it from the staleness comparison, so the check ignores it.
3. Make the scan's denominator declared rather than observed, so the count is a
   property of the declaration and reproducible.

Option 1 is the one that matches the existing rule. Not acted on here: the owner
decides what a published index carries.

## Done when
- [x] owner picks an option  — 2026-10-03, *"resolve 65oe"*; option 1 (drop the
  field), the one matching "a measurement must not be a term in itself"
- [x] `library:viz` output is identical for the same tree on CI and locally  —
  measured by adding a scanned json file and regenerating: index hash
  `4becfade04c4` before, with the extra file, and after removing it. Identical
  in all three states, where previously the middle one incremented
- [x] a test fixes that, so it cannot regress silently while ungated  —
  `cat-harness/scripts/tests/library-refscan-reproducible.test.ts`, 6 tests,
  proven to bite: reintroducing `filesRead` fails 3 of the 6

## Summary of Changes

Landed on `main` in **#2035**, merged 2026-10-04T05:54:37Z by litlfred as
`5b88957fbe`. Verified with `git merge-base --is-ancestor`, not from the PR's
state field.

**What changed.** `refScan` is now `{ unreadable }` and still `.strict()`, so
`filesRead` is REFUSED rather than ignored if it returns. The type in
`library-graph.ts` follows; `gen-library-viz.ts` stops carrying it into the
projection and its badge no longer prints it.

**What deliberately did not.** `refScan` itself stays, because its PRESENCE is
how a reader knows the scan ran — the generator's own comment calls "nobody
looked" a third answer. `unreadable` stays, because it names FILES and is what
makes a zero provisional. And the count is not lost: it still prints on the
run's own console line, where a statistic about a run belongs.

**Verified on main after the merge**, which is the check that settles it:

    main:cat-harness/docs/assets/library/index.json
      refScan = {"unreadable": []}

**The badge reads better, not worse.** It used to lead with
`2663 json file(s) scanned for references` — a statistic about the machine.
Executing its code path against the committed index now gives
`48 entr(ies) referenced by nothing`: a finding about the library, from 66
entries. The `unreadable` pill and the no-badge third state both survive.

**Two things this cost, recorded because they outlive the bean.**

1. I committed the churn FOUR times before diagnosing it, and attributed it to
   `merge-main-bot` failing to regenerate. That was wrong: `merge-base.ts` runs
   `regen` and commits its output. Nothing failed to regenerate; the artefact
   could not agree with itself across machines.
2. The PR SELF-STARVED. Every bot merge into any branch regenerated this file
   with its own container's count and landed it on main, so the PR re-conflicted
   on that one file against almost every main commit — 372 behind, reflowed, 16
   more within minutes, conflicted again. The resolution was mechanical (take
   either side, run `bun run cat library:viz`), and the exit was landing it rather
   than reflowing it. Worth remembering for any future PR that removes a field
   from a frequently regenerated artefact.

**The class was checked, not just the instance.** `regen` now names THREE
ungated inputs where it named two. `uploads:viz` emits no artefact of its own
(its queue block publishes inside `library/index.json`), and `schema:viz`'s
`read*` keys are schema FIELD NAMES rather than counts. So `filesRead` was the
only instance of this defect.
