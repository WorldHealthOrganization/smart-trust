---
# folio-assistant-vzo5
$schema: bean/1.0.0
title: check:reference-direction runs in NO workflow, so its PENDING guard — the half its docblock calls enforced — fires nowhere
status: completed
type: bug
priority: high
created_at: 2026-09-29T22:16:35Z
updated_at: 2026-10-06T14:30:00Z
parent: folio-assistant-1xhc
---

Found by a goal-review sweep, 2026-09-29, on `origin/main` @ `35402147f55`.

`zhg2` shipped `check:reference-direction` (PR #1222, merged 2026-09-26) and
registered it in `gates.ts` as `kind: "report"` — advisory, deliberately,
because the wrong-direction count is 574 and *"a gate that fails on a backlog
is a gate somebody switches off"*. That reasoning is sound and is not what
this bean disputes.

What it disputes is the sentence beside it. The registration's own `reason`
says:

> What IS enforced on every run today, without waiting: the PENDING set,
> which fails on a stale entry, and the IMPORT half of the same arrow

**Nothing enforces it.** Measured:

```
$ grep -rn "reference-direction" .github/workflows/ | wc -l
0
$ bun run cat check:reference-direction >/dev/null 2>&1; echo $?
1
```

The script appears in **no workflow file**, so no CI run ever invokes it —
and it is exiting **1 right now** on a stale exemption:

```
✗ 1 PENDING entr(y/ies) no longer qualify — delete them:
    cat-harness/scripts/gen-object-model-uml.ts — now names ONE instance,
    so it has a destination and is not pending
```

A `kind: "report"` entry does not make the PENDING half enforced and the
wrong-direction half advisory. It makes the **whole script** advisory. The
two halves cannot have different enforcement while they share one exit code
and one registration.

## Why this is `1xhc` and not a wording nit

This epic's sentence is *a gate that does not fire is indistinguishable from
one that passed*. Here a check that fires nowhere is described, in the
repository's own registration table, as firing on every run — so a reader
looking for whether the PENDING set is guarded finds a confident yes and
stops. The stale entry above is the proof the guard is not there: it is
exactly the failure the prose promises to catch, sitting uncaught.

It is also the same shape as `9x9r` one level out. There, a check reported a
✓ because it asked a weaker question than the operator's. Here, a check
reports nothing at all because nothing asks it, while prose asserts it was
asked.

## Not proposing the fix

`zhg2`'s own Done-when is owner-gated (the ruling on 116 single-destination
files), and how to split enforcement is a design choice with at least two
shapes — a separate `check:reference-direction:pending` script wired as a
gate, or one script with a flag and two registrations. Naming one here would
be guessing at `zhg2`'s intent.

## Done when

- [x] the PENDING staleness guard either runs in CI, or the registration's
      `reason` stops saying it does — whichever the owner rules
- [x] the stale `gen-object-model-uml.ts` entry is resolved
- [x] whatever is chosen, the claim and the wiring agree: no `reason` text
      describes enforcement that no workflow performs


## Step 0 done, 2026-09-29 — and it unmasked a second exit-1

The stale entry is deleted. `check:reference-direction` now exits 1 on a
DIFFERENT condition, which the stale-PENDING branch had been masking because
it `process.exit(1)`s before the `missing` check is reached:

**31 multi-destination files name several instances above them and are not in
PENDING.** That is not a regression — it is the next layer of the same backlog
becoming visible for the first time.

### They are not one kind of file, and that matters

| | count | |
|---|---:|---|
| **generator output** | **14** | 5 `docs/glossary/*/index.md`, 3 `glossary/generated/*.glossary.json`, 3 `*.skos.jsonld`, 3 translated `docs/{zh,ar,ru}/publication-workflow.md` |
| **authored** | **17** | 6 `.ts`, 2 skills, 7 docs (4 of them `docs/architecture/*`) |

**Do NOT bulk-add these to PENDING.** `zhg2` states the reason itself: PENDING
*"compares as a set, so a fixed leak fails too — a PENDING that only grows
stops meaning anything."* Thirty-one entries added at once would retire it as
an instrument.

The 14 generated ones already have a mechanism and are not a ruling: the check
skips a file that declares itself generator output, and **476 files already
take that route**. These fourteen do not declare it — which is bean `ws99`
(*"every generator's output should declare its writer — five write into docs/
and none did"*) meeting `zhg2` at the same 31 files. Fixing `ws99` removes 14
of the 31 with no owner input at all.

The 17 authored ones are `zhg2`'s multi-destination class and genuinely need
the ruling. Four are `docs/architecture/*`, whose subject IS the layering —
the same shape as `schemas/dak-content-type.ts`, where a file below the
boundary describes the boundary, and both *move* and *reword* are wrong.

One of the 17 is `skills/kg/kg-core/instance-publication.md`, written in this
same arc four days ago. The check had no way to say so at the time, because
nothing ran it.

_2026-10-01T17:46:56Z_ — Claimed by claude/rulings-2026-10-01-late — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Closed on evidence, 2026-10-06 (session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92)
Re-derived, not quoted. The claim by `claude/rulings-2026-10-01-late` has no open PR, so this is landed work (bean-coordination §"Closing a bean whose work has already landed").
- `.github/workflows/code-quality-gates.yml` runs `bun run cat check:reference-direction:check --against main`. That ratchet grades `pending-stale`, so the PENDING guard now fires in CI.
- Run on main 713b9d3+: `0 NEW finding(s), 938 inherited, 5 resolved … OK`.
- `gen-object-model-uml.ts` no longer appears in `check-reference-direction.ts`.
- The `gates.ts` reason for `check:reference-direction` now says it is SUBSUMED by the `:check` form that CI runs, so the claim and the wiring agree.
