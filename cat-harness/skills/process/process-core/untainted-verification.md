---
name: untainted-verification
description: >-
  The party that produced an artefact does not write the verdict on it. How a
  checker and an adjudicator are dispatched with controlled context, the three
  rules that make it a measurement rather than a ritual, and the third state
  that lets it gate at all.
---

# Untainted verification — the producer never writes the verdict

> Skill id: `untainted-verification` · Package: `sdlc-core`

A secret scan, a schema validation, a back-translation and a systematic
literature search differ in what they read and in what counts as a finding.
They do not differ in this:

> **The party that produced the artefact does not get to write the verdict on
> it, and the checking party is given a controlled context rather than the run
> of the repository.**

Everything below is that sentence made operational, for any domain, because
taking the translation vocabulary out of it changes nothing structural;
`translation-manager.md` §"The agentic round trip" is the translation
instance.

## The parties

| party | is given | produces |
|---|---|---|
| **producer** | the task | the artefact |
| **checker** | the artefact's declared `checker_sees`, and nothing that would let it shortcut | an independent rendering or finding |
| **adjudicator** | `adjudicator_sees` and the checker's output — never the artefact itself | `pass` / `warn` / `fail`, each drift named |

## Three rules, and the failure each one stops

**1. Neither party sees what would let it shortcut.** A back-translator shown
the English writes the English back and the check passes vacuously. An
adjudicator shown the French can talk itself into any reading of the
back-translation. Neither failure raises an error; both produce a green verdict
that measured nothing, which is worse than a red one.

**2. The checker uses no tools, and says so.** The artefact is in the
repository. A checker with filesystem access can find what it was not given,
and the verdict then measures its search rather than the artefact. Ask for a
`TOOLS_USED` line and **record the answer** — `UntaintedParty.tools_used`.
Absent means nobody asked, which is not the same as "no".

**3. One party doing both halves is not this check.** It compares a thing with
its own paraphrase of itself.

## The context is declared, not composed

`UntaintedDispatch` on the criterion (`schemas/sdlc/block-qa.ts`) declares
`checker_sees`, `checker_withheld`, `adjudicator_sees` and `drift`. A caller
names a **subject** and a **criterion**; it does not hand-assemble a brief.

**That is not ceremony — the party composing a brief by hand is the producer**,
and rule 1 then breaks silently, one call site at a time. A declaration is also
checkable, and `untaintedPartitionDefects` checks it:

| defect | what it means |
|---|---|
| **undeclared** | no `untainted` block. Reported, never skipped: *nobody said* is not *nothing to check* |
| **overlap** | a role visible to both parties — one of them is grading its own input |
| **unpartitioned** | a companion in `depends_on` that is in neither visible set; usually a role added later. Nobody decided |
| **phantom** | a role named in the declaration that the criterion does not depend on — the declaration describes something else |

Totality is the point of `checker_withheld`. Without it a newly-added companion
role defaults into the checker's view, or out of it, and either way the
separation moves without anybody choosing. With it, the partition simply stops
being total, which has a name.

**`drift` must say both halves.** Told only what to look for, an adjudicator
returns a style review and everything fails. The translation round trip states
it well: *synonyms, articles and re-ordering are not drift; a claim added,
dropped, weakened, strengthened or reversed is.* The check verifies the string
is non-empty and **nothing more** — "states what is not drift as well as what
is" is a reading, and a gate pretending to measure it would be the exact defect
this skill exists to stop.

## Three states, and the third is what lets it gate

1. **verified** — the adjudicator ruled. Two entries, adjudicator first.
2. **could not dispatch** — no dispatch capability was available. One entry,
   `result: "n/a"`, `metrics.dispatch: "unavailable"`, and a **required**
   reason. **The producer may write this one, and only this one.**
3. **not attempted** — no entry at all.

Without state 2 the discipline cannot gate anywhere: a producer forbidden from
writing a verdict has *nothing* to write in an environment with no subagents,
so the gate reads an absence it cannot tell from negligence. Recording it keeps
"could not dispatch" distinguishable from "nobody tried".

**It is never a pass.** `isVerified()` is the predicate a gate asks, and it is
false for state 2 and for state 3 alike. A consumer that reads `n/a` as
"nothing to see" turns the honest gap straight back into the silent one.

## Recording

Both parties are written as witnesses. The **adjudicator leads** — the first
entry per criterion is the operative one everywhere in this repo. The checker
sits behind it with `result: "n/a"` and its output in `notes`, because a reader
asking *on what basis?* needs the intermediate and a reader asking *who did
this?* needs both names.

**Record `model` with `model_source`, or not at all.** A subagent's serving
model is not observable from the session that dispatched it: it inherits the
parent unless the harness overrides, and the hand-back does not say which model
served the turn. A bare model string is an inference printed as a fact. Absent
both, a reader gets "not recorded", which is true and acceptable.

**A sweep replaces only entries whose reviewer is itself.** `mergeUntainted`
carries everything else through, so an unrelated re-run never silently deletes
another party's verdict. A human ruling is never superseded here.

**A verdict is hashed to what it was about.** Edit the subject and the verdict
goes stale. This matters more for an agent ruling than a script one, because
nobody can cheaply re-run it.

### Where the verdict is kept: the attestation store, not the derived file

Both entries are **judgements** — `reviewer.kind` is `agent` (or `human`) —
so their durable home is the `attestations` graph,
`test/attestations/<family>/<mirrored subject path>.attestations.json`
(`qa-attestations/v1`), on `main`. The derived `test/results/` file beside
them is a working copy whose record lives on the `qa-reports` branch, and a
regeneration cannot reproduce an agent ruling.

`recordUntainted` writes the store **first**, through the same
`resolvePrior` / `finalizeCriteria` API as every other attesting writer, and
refreshes the derived report only if one already exists — it
never invents one. So the verdict lands whether or not the derived file is on
the branch, and the store file it returns is the one to commit. What puts a
subject in scope is the subject existing (`<subject>.md` or `.ts`), not its
derived report, which does not live beside it. A corrupt or unreadable store
reads UNKNOWN and is refused, with nothing written, rather than overwritten.

## Why the instrument is the thing to watch

**A measurement whose author has to explain it away is about the instrument,
not the subject** — for example a failure count that is really a count of
entries missing from the checker's reference map. Remove such a measurement
rather than publish it.
[`translation-manager`](../../../library/skills/library-core/translation-manager.md)
§"The instrument, not the translation" has the worked case.

## This is one rule with two homes

It is not a platform invention. Guideline methodology separates the systematic
review team from the guideline development group for the same reason, and the
identical rule applies to evidence-based literature review for living
guidelines. When adding a domain's rules here, run them through
`domain-fencing` (opt-in `cat-harness.kg-ops`)'s three questions
first: a rule that fails all three is a folio's rule, correctly located, and
fencing it and saying so is the honest move.

## Related

- `translation-manager.md` §"The agentic round trip" — the first instance, and
  the translation-specific drift definition that does *not* generalise.
- `permissions.json` `qa-reporting` — who may emit a verdict at all.
- `pipeline/untainted-verification.ts` — the recorder. It deliberately
  does **not** call a model: the payload is written by whatever ran the
  parties, so recording works the same for two subagents, two API calls, or two
  people.
