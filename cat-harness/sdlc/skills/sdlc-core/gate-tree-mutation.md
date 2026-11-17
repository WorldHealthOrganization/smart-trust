---
name: gate-tree-mutation
description: >
  Reading `bun run cat gates`' "NOT clean" verdict. Why every gate can pass and the
  run still exit 1, the two causes and how to tell them apart in one command, and
  the question that settles whether a churning field is a defect in the writer:
  does it describe the SUBJECT or the RUN?
adapters: [document, paper, dak]
profiles: [document, paper]
---

# "NOT clean" is a verdict about the RUN, not about your diff

`bun run cat gates` snapshots the tree before the first gate and after every one, so
a gate that **repairs** something on its way past is named. Every gate can pass
and the run still exit 1:

```
✗ every gate passed, and the run is NOT clean — 1 gate(s) changed the tree.
```

The gates that ran after the mutation were handed the repaired tree, so their
verdicts describe a state you have not committed.

No gate can observe what another gate did, which is why the detector can only
live in the runner (`gate-tree-guard.ts`) and why its predicate is a per-gate
**delta** rather than "the tree is dirty": running gates over your own
uncommitted work is the normal case. A failure to read the tree is carried as
`undetermined` and reported rather than thrown, because `undetermined` is not
clean.

**Two causes, and they are answered differently. Read `git status --short`
before you decide which one you have.**

---

## Cause 1 — you changed an input and did not regenerate

The ordinary case, and [`platform-gates`](../../../skills/process/process-core/platform-gates.md) §"What a `*:check`
failure is telling you" is the whole of it: run the generator, commit its output,
and run the gates **after** the last edit. Never hand-edit the artefact into
agreement.

---

## Cause 2 — the artefact records the RUN, and your run differs

This is the one that looks like cause 1 and is not. The generator is behaving
correctly, the input has not changed, and the file still gets rewritten — because
a field in it describes **the run that produced it** rather than **the subject it
is about**, and your run is not the last one.

**The question that settles it:**

> Does this field describe the SUBJECT the artefact is about, or the RUN that
> produced it? **Only the first is a reason to write.**

A field that records the environment — a timestamp, the checked-out HEAD, the
runtime version — will differ on every machine, so counting it as a reason to
write makes the artefact churn everywhere and reports that churn as though an
input had moved.

### Example — QA script sidecars

The committed QA script sidecars under
`cat-harness-tools/pipeline/script-sidecars/` carry three run fields:

```
last_run_at     wall-clock time of this run
last_run_sha    the checked-out HEAD
engine_version  `bun-${Bun.version}` — the local runtime
```

`saveQaScriptSidecar` writes only when a **substantive** field moved, and none
of the three counts. Counting `engine_version` would make a run under any other
Bun rewrite every sidecar whose recorded engine disagrees, so that `bun test`
dirties the tree and `bun run cat gates` ends `NOT clean` on every branch.

Two measures are kept, and they answer different halves: `.bun-version` pins
Bun for CI (`check:bun-pin` holds every `oven-sh/setup-bun` site to it), which
makes the recorded engine consistent where the repository controls it; the
comparison skip stops any other engine — an agent container's image, which a
repository cannot pin — from rewriting a file whose checker did not change.

*"A verdict produced by a different engine is a different verdict"* is true,
and about a different artefact. A *script* sidecar holds no verdict — it
records a checker's source file, its hashes and its dependencies; verdicts
live in block sidecars. No reader consults a script sidecar's `engine_version`
for freshness: `entryIsFresh` compares `field_hash` and the script hashes,
nothing else. The same field can be load-bearing in one artefact and pure
provenance in another, so check the argument against the artefact in front of
you.

---
### Where the rule is already implemented

| where | the guard |
|---|---|
| `scripts/qa-results.ts` `writeQaResult` | compares `withoutTimestamp(prior)`, so only `updated_at` differing is not a write; shared by every `*.qa-results.json` family |
| `pipeline/qa-sweep.ts` | `wroteSomething = verdictChanged \|\| metadataDrifted`, and `updated_at` advances only then |
| `qa-utils.ts` `saveQaScriptSidecar` | content-derived fields only; `engine_version` and the two `last_run_*` fields are excluded |

`writeQaResult`'s docblock states the principle: *the timestamp answers "when
were these findings established", not "when did somebody last run the
script"*. A churn you meet is more likely a family that MISSED this rule than
a new question — look for the nearest of these three before designing
anything.

## If you meet a churn whose writer has not been fixed yet

Discard it rather than committing it, and then **fix the writer**:

```sh
git checkout -- <the churning paths>
```

Committing such a churn stamps whatever your environment happens to be as though
it were a fresh measurement — with an older local runtime, a *downgrade*. The
generator records your container correctly, and your container is not the
repository.

**Discarding is a workaround, not a fix.** A signal that is always red is one
nobody reads, and then it cannot report the next real in-run repair.

So the sequence is: discard, ask the question at the top of cause 2, and fix the
comparison. Do not add the paths to an ignore list — that removes the signal
instead of the cause.

---

## Do not read past the line

Cause 2 has a narrow signature. If `NOT clean` names paths outside the artefact
family you expect, or fields other than the run-provenance ones, it is **not**
this: the gate is telling you something new, and cause 1 is the likelier answer.

---

## Related

| | |
|---|---|
| [`platform-gates`](../../../skills/process/process-core/platform-gates.md) | which gates to run, and cause 1 in full |
| `scripts/gate-tree-guard.ts` | why the detector cannot live in a gate |
| `pipeline/qa-utils.ts` | `saveQaScriptSidecar`'s comparison |
| [`generalise-the-fix`](generalise-the-fix.md) | the same shape one level up: fix the class, not the instance |
| [`upstream-version-adoption`](../../../skills/process/process-core/upstream-version-adoption.md) | moving a pin forward — a person's decision, never a gate's |
