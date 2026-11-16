---
name: requirement-definition
description: >
  What a requirement IS, said once for both requirements methodologies: a
  statement, a conformance level, a source, at least one success criterion
  with its verification method, and a sign-off owner. How that maps onto the
  `req:` schema's `successCriteria`, onto CRDM's REQ-### and spec-kit's
  FR/SC, and why a work plan is beans whose `## Done when` is copied from the
  success criteria of the statements they name.
---

# One definition of a requirement

Every requirement has success criteria. This is the one definition of a
requirement that both the CRDM and spec-kit templates use, and the `req:`
schema carries. **The methodologies stay separate**: what they share is the
unit, not the process.

## The six parts

| part | what it is | in the `req:` schema |
|---|---|---|
| **statement** | one sentence a reviewer can say yes or no to | `requirement` |
| **conformance** | `SHALL`, `SHOULD`, `MAY`, `SHALL NOT` — never inferred from tone | `conformance` |
| **source** | where it came from: the owner's words (verbatim, dated), a needs statement, an issue comment | the requirement's `proposedIn`, or the statement's `label`/text until a field exists |
| **success criteria** (≥ 1) | what would SHOW it is met, each with a key | `successCriteria[].key`, `.criterion` |
| **verification method** | per criterion: `test` (run, pass/fail), `inspection` (read the artefact, find it), `review` (a person's recorded judgement), `analysis` (derived from a model or measurement) | `successCriteria[].verification` |
| **sign-off owner** | who says it is met — a named person or role, not "the team" | the requirement's `actors`, or named in the document |

**A requirement without a success criterion can be filed and never judged.**
In the schema the field is optional for now, and `check:requirements` warns
when it is missing.

**A criterion is addressable**: `req:<id>#<statement>/<criterion>`. A test
run that checks one criterion points at it by that ref; the requirement never
lists its tests.

### A good criterion, and a bad one

> ✗ *"The detector works well for plan requests."* — nobody can say yes or no.
>
> ✓ *"Given the five phrasings in the dogfood plan, detection flags all five."* — `test`.
>
> ✓ *"`check:requirements` fails on a planted statement with no criteria, and CI shows it."* — `test`.
>
> ✓ *"The owner confirms on the issue that the template covers the measles L1 case."* — `review`.

## The document is a requirement set

The requirements document as a whole is a `RequirementSet`
(`bootstrap-tools/schemas/requirement-set.ts`): `reqset:<slug>`, its members (`req:` refs, each with its
own decision), a **stage** — `draft`, `proposed`, `approved`, `planned`,
`in-progress`, `delivered`, `accepted`, or `rejected`, `cancelled`,
`superseded` — its `workPlan` (bean ids) and its **sign-offs**. A sign-off is
an adjudication record — `kind`/`id`/`actor`, `at`, `scope`, `outcome`
(`approve`, `amend`, `reject`, `defer`, `cancel`), the `stage` it moves the set
to, `reason`, and `evidence` (the issue-comment permalink) — kept in the
`attestations` graph as the `requirement-signoff` family.

The set's stage and each member's `status` are independent; the one link
`check:requirements` enforces is that a set is `accepted` only when every
member it approved is `in-force`. It also refuses `approved` or `accepted`
without a **human** sign-off, `planned` without beans, and `cancelled` without
a reason. Worked example: the measles L1 set,
`cat-harness-tools/scripts/tests/fixtures/measles-l1.requirement-set.json`.

## In the CRDM template

CRDM's `REQ-###` keeps its own ID, priority, impact and scope fields
(`crdm-requirements-template` (opt-in `cat-harness.sdlc`)).
Its *Acceptance criteria* field IS the success criteria — at least one, each
with a verification method — and it gains *Source* and *Sign-off owner* rows
if it did not have them:

```markdown
- [ ] **REQ-001** (SHALL) — Beans filtered by epic type
  - _Source:_ needs statement §2; owner, 2026-10-07, "…"
  - _Success criteria:_
    - `SC-1` (test) — Given an epic with 3 child stories, `beans list --type epic` lists only the epic
  - _Sign-off owner:_ the BA
  - _Beans:_ `abcd`
```

## In the spec-kit spec

spec-kit's `FR-###` is the statement and conformance; its `SC-###` list is the
success criteria. The shared definition adds one rule spec-kit's upstream
template does not state: **every FR names at least one SC, and every SC says
its verification method.** An SC that belongs to no FR, or an FR with no SC,
is a gap to fix before the spec is posted.

```markdown
- **FR-001** (SHALL): … — _source:_ owner, 2026-10-07 — _criteria:_ SC-001, SC-002 — _sign-off:_ owner
- **SC-001** (test): …
```

## The work plan is beans

A work plan is **beans**, one or more per requirement — never a
numbered list in chat, which nobody can claim, block or close. Each bean:

1. **names the `req:` statements it delivers** in its body
   (`Delivers: req:<id>#<key>`, or the document's `REQ-###`/`FR-###` before a
   `req:` file exists);
2. carries a **`## Done when`** whose items are **copied from those
   statements' success criteria**, one checkbox per criterion, with the
   criterion's key — so that closing the bean IS judging the criteria, and a
   bean cannot close on a criterion nobody wrote down.

```markdown
Delivers: req:plan-request#detect

## Done when
- [ ] `req:plan-request#detect/five-phrasings` (test) — detection flags all five dogfood phrasings
- [ ] `req:plan-request#detect/no-blend` (inspection) — the fork in crdm-detect is unchanged
```

How a bean is created, parented and claimed is
`todo-manager` (opt-in `cat-harness.work-plan`)
and `bean-coordination`;
this section only says what its `## Done when` must contain when the bean
delivers a requirement.

## Cross-references

- [`plan-request-gate`](plan-request-gate.md) — when these are produced, where they go, and the stop
- `bootstrap-tools/schemas/requirement.ts` — `SuccessCriterionSchema`, `RequirementRefSchema`
- `cat-harness-tools/scripts/check-requirements.ts` — the warning
