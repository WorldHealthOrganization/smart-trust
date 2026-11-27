---
# folio-assistant-dvcx
$schema: bean/1.0.0
title: '`bun test` carries the SAME deliberate-red assertion as the declared drift gate, and the matcher cannot see it'
status: completed
type: bug
priority: normal
created_at: 2026-09-27T10:33:16Z
updated_at: 2026-09-27T10:44:51Z
parent: folio-assistant-1xhc
---

## What

`check:red-gate-is-last` (bean `cpss`) makes one thing structural: a gate that is
red **by decision** must be the last step of its job, so the set it masks is
empty by construction rather than by a passing run.

Its declaration had **one** entry, `translation:drift:check`. There were **two**
gates carrying that assertion, and the second could not be declared.

`cat-harness/content/pipeline/translation-drift.test.ts:160` opens
`describe("the real corpus — and the gate can actually fail")`, and line 168 is
`test("no NEW drift, and nothing unreadable")` — the **same** assertion, over the
same real translations, as `translation:drift:check`. That test is the single
failure that made `main`'s typescript job red in run 36231943911, which is bean
`om30`'s whole subject. So `bun test` was a deliberate-red gate from the day the
first entry was written.

## Why it could not be declared — the gap was in the VOCABULARY, not the list

`invocations()` matched `/^\s*bun run\s+([^\s#]+)/`. `bun test` is a **bare
runner**: it takes no target, so that regex cannot name it, and a gate the
matcher cannot name is a gate `DELIBERATELY_RED` cannot declare. Adding a row
would have produced an `absent` finding, not a working rule.

That is why the fix is in the matcher rather than in the workflow. Spelling it
`bun run test` in CI to satisfy the check would have been the check bending the
corpus to fit its own vocabulary.

## Measured, on `origin/main` `63a465674a2`

Parsed from `.github/workflows/code-quality-gates.yml` rather than read:

| | |
|---|---|
| `bun test` | step **6 of 6** of the `typescript` job, **alone** in its step |
| occurrences of `bun test` anywhere in the workflow | **1** |
| `translation:drift:check` | step **55 of 55** of the `gates` job |
| steps behind either | **0** |

So it was already in the right place — **by coincidence, not by rule**, which is
precisely the distinction `cpss` was written to collapse. Declaring it changes
nothing today and refuses the append that would break it.

## Both carriers are GREEN today, and it is declared anyway

`bun run cat translation:drift:check` exits **0** — 70 compared, **0 newly drifted**,
0 unreadable, 8 uncatalogued **and recorded**. `translation-drift.test.ts` is
**18 pass / 0 fail**. Neither carrier is red right now.

Declared regardless, and the reason is `om30`'s own lesson, quoted from that bean:
*"the masked count is not a property of the split — it is a property of WHICH step
is red, and that moves."* A position rule that is only installed while the gate
happens to be red is a position rule installed at the worst possible time. The 8
uncatalogued entries are the `t8g3` backlog now **recorded** rather than failing,
so the assertion can return to red the moment that recording stops covering it.

## Verification — falsified by breaking, three ways

Mutation-tested rather than argued:

| mutation | fails |
|---|---|
| `invocations` no longer names a bare runner | **7** — including BOTH corpus tests |
| the `\b` in `bun\s+test\b` removed | **1** — `bun testing:check` reads as `bun test` |
| the `bun test` row removed from `DELIBERATELY_RED` | **1** |

The first is the load-bearing one: the two failures in `describe("the real
workflow")` are *"every declared red gate was LOCATED"* and *"each is the last
step of its job"*, so the declaration and the matcher cannot drift apart
silently — disagreement breaks the assertion about the real file.

The third earns its place for the opposite reason: every other new test supplies
its own fixture list, so without it the declaration could be reverted and the
whole block would still pass.

Then: **25 pass / 0 fail** (was 18), `check:red-gate-is-last` exits **0** and now
reports `2 gate(s) declared`, locating `bun test` at step 6 of 6 and
`translation:drift:check` at step 55 of 55.

## One deliberate over-match, argued in the code

`bun test <path>` is matched and named `bun test`. A narrowed run may no longer
carry the drift assertion, so the position rule may bind a step that no longer
needs it — harmless. The other direction is the masking this file exists to
refuse. Stated in `invocations`' docblock so the next reader does not take it for
an oversight.

## Done when

- [x] `bun test` is declarable at all — `invocations` names bare runners
- [x] It is declared, with why, and the check locates it
- [x] Falsified by breaking, and the mutation results recorded above
- [x] The docblock's *"One entry ... deliberately"* claim no longer says something
      untrue about its own list
