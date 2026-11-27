---
name: term-disagreement
description: >
  When a glossary term the extractor minted and an authorised terminology
  disagree — the corpus spells a concept differently from the authority, or
  uses a word the authority does not carry — decide among three outcomes:
  change the prose, author a local term with its reason, or record that the
  vocabulary is wrong for this domain. Says which disagreements need a
  decision at all, how to choose, what each outcome writes and where, and
  what is NOT this skill (two judges disagreeing about a mapping).
consulted: true
graph-typologies:
  - glossary
---

# Term disagreement — the extractor and the terminology disagree

> Skill id: `term-disagreement` · Package: `library-core`

The outcome schema is
[`schemas/content/term-adjudication.ts`](https://github.com/litlfred/cat-harness-tools/blob/main/schemas/content/term-adjudication.ts)
(`folio-term-adjudications/v1`). That file holds the table of what each
outcome writes, as data. This skill says when to use it and how to choose.

## Two disagreements, kept apart

1. **The extractor and the terminology disagree.** This skill. It is a
   CONTENT decision: what the corpus should say.
2. **Two judges disagree about a mapping.** That includes a person who
   thinks an automated match is wrong. It is
   [`adjudication`](../../../skills/process/process-core/adjudication.md) plus
   `untainted-verification`,
   and it is **not built**; it waits until something maps. Do not answer it
   with an outcome from this skill:
   `vocabulary-wrong` says a vocabulary does not serve a domain, not that
   one match is mistaken.

## Which rows are disagreements

`check:term-mapping` reports each candidate on each target as an
`exact` / `concept` pair. Only two determined pairs are disagreements:

| `exact` | `concept` | reading | a decision? |
|---|---|---|---|
| mapped | mapped | the label IS the authorised one | no: agreement |
| unmapped | mapped | the right concept, under a label that is not its authorised one | **yes, always** |
| unmapped | unmapped | the authority carries no such label | **only if the authority is MEANT to cover this** |
| undetermined | — | nobody answered | **no.** Fix the reachability; the schema refuses it |

**The third row is the one to be careful with.** Almost every candidate is
`unmapped` on both targets, because most are names for this repository's own
assets: skills, Tool nodes, BPMN activities, schema fields. No authority is
expected to carry them, so they are not disagreements. They are terms this
corpus is right to coin.

The test for the third row: **would a reader in this domain expect the
consulted vocabulary to have a word for this?** "Wombat sorter" against WHO
SMART base: no, so there is no record. "Immunization" against WHO SMART base:
yes. A miss there is a disagreement worth a decision.

**Never generate records in bulk.** One record is one decision somebody
took. The rule is the same as for work items, which are not sidecars: a
machine-written queue of thousands of "undecided" rows would bury the few
decisions that matter. Rows with no decision simply have no record.

## Choosing the outcome

Ask in order. The first "yes" decides.

1. **Does the authority's concept mean exactly what the corpus means?** Then
   the corpus should use the authority's word: **`change-prose`**. This is
   the usual answer to a concept-only match.
2. **Is the corpus's sense real, but narrower, broader or merely related?**
   Keep a word of our own and say how it relates: **`local-term`**, with a
   `relation` of `closeMatch`, `broadMatch` or `narrowMatch`. These are the
   predicates an authored term can carry. Use `none` when nothing in the
   authority is close. `exactMatch` is refused: if the concept IS ours, the
   answer was (1).
3. **Is the vocabulary itself the wrong authority for this domain?** For
   example, a clinical IG consulted for agent-tooling words. Record it:
   **`vocabulary-wrong`**, naming the vocabulary and the domain. Nothing in
   the corpus changes.

If none fits, there is no decision yet. Leave no record, and say so where
the work is tracked.

## What each outcome writes, and where

The table is `OUTCOME_WRITES` in the schema. In short:

| outcome | writes | where | afterwards |
|---|---|---|---|
| `change-prose` | the authorised label | the source asset the extractor read, listed in `changed` | re-extraction mints that label, and the check reports `exact: mapped` |
| `local-term` | an **authored** term, with the `reason` | an authored glossary (`localTerm.glossary`) | the candidate is promoted (`glossary-terms`); its mapping to the authority is a person's |
| `vocabulary-wrong` | nothing in the corpus | the record itself | the check keeps reporting the miss, and the record says why it is not acted on |

Every outcome also writes **the record**: one entry in a
`*.term-adjudications.json` file beside the glossary schemes, with the
`subject` (scheme, term, target, and the pair the check observed), who
decided, when, and a `ref` to where it was discussed.

## Who decides

**A person.** An agent may find a disagreement, propose an outcome and draft
the record. Choosing between "our word" and "their word" is a content
decision, so `decidedBy` names the person who took it. Put the proposal to
them in the form of
[`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md)
§4.1: the candidate, the concept it reached and by which label, the three
outcomes, and the one you recommend.

## Automated matches and confirmed ones

Each scheme's SKOS JSON-LD publishes what the check found:
`skos:exactMatch` for an exact match and `skos:closeMatch` for a
concept-only one. They sit in a **named graph** (`<scheme>/_automated-matches`)
whose PROV says a program produced it (see `toSkos` in
the content core's `schemas/glossary.ts`). The default graph holds only
what people wrote.

That is why `local-term` is the one route to a CONFIRMED mapping. The
authored term's own `exactMatch` / `closeMatch` / `broadMatch` / `narrowMatch`
is published in the default graph. `change-prose` makes the label agree, but
the candidate's match stays automated until somebody authors it.

## Checking the record

`bun run cat check:term-mapping` validates every `*.term-adjudications.json` and
**fails** on one that does not satisfy the schema. It then sets each record
against what it found:

| status | meaning |
|---|---|
| `applied` | `change-prose` / `local-term` took effect: the candidate maps exactly, or is gone |
| `pending` | decided, but the check still reports what it reported then |
| `holds` | `vocabulary-wrong`, and the miss it explains is still there |
| `stale` | the check now reports something the decision was not taken against. Look again |

`stale` is reported, never fatal. A decision taken against a state that has
moved is still a decision, and it has become a question to look at again.

## Not here

- **Two judges, one mapping**: `adjudication` and `untainted-verification`,
  once something maps.
- **Which vocabulary is authoritative for which fact**:
  [`vocabulary-authority`](../../../skills/kg/kg-core/vocabulary-authority.md).
- **How a term is authored**: `glossary-terms`.
