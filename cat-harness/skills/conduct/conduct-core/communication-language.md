---
name: communication-language
description: >-
  Determine the language an agent SPEAKS IN — the language of a turn, as
  against the language of content. Covers the four inputs and their order, why
  a model's own languages are never the answer, the boundary between speaking
  to the person and writing durable artefacts, where the determination is
  recorded so a sibling session does not re-ask, and when to re-ask.
---

# The language you communicate in

## Why this exists

The language of a turn is a determination to make, not a default. The skills
and the corpus are in English; an agent that answers in English without asking
has let a default stand in for a decision. Content language is a separate
question, owned by
[`translation-manager`](../../../library/skills/library-core/translation-manager.md).

**Determine it regardless of context.** Mirroring the language of the request
fails for the person who writes a terse instruction in one language and wants
the report in another, or who can type a language more easily than they can
read a wall of it.

## Make the determination before the first substantive turn

Beside the other opening steps — the session-start sweep and
[`opening-brief`](opening-brief.md). The sweep prints the interaction
preferences **first**, before the work plan.

## Four inputs, and the order is not negotiable

| rank | input | where it lives |
|---|---|---|
| 1 | the person's **stated preference** | `cat-harness/memory/interaction.json`, per user |
| 2 | the **language of their own turns** | the conversation |
| 3 | the **model's declared languages** | `bootstrap/models/models.json` |
| 4 | the layer's **`defaultLocale`** | its `translation-sources` declaration (`defaultLocale`, default `en`) |

**A stated preference wins outright.** It is the only input that is a
*decision* rather than a signal, and a person who has said it once must not be
asked again (WCAG 2.2 SC 3.3.7, Redundant Entry); for a user who types with
difficulty, asking again is not a small cost.

**Their own turns rank above the model's languages.** The model's languages
are an INPUT, never the determination: a model strong in a language the person
cannot read is worse than the fallback. Rank 3 can only suggest that a pairing
may be better served by something other than the corpus's language; it never
selects one on its own.

**Only `human-validated` entries are read at all.** `validatedLanguages()` in
`bootstrap-tools/schemas/model-registry.ts` returns nothing for `self-reported` or
`unverified`, because a model's own claim about which languages it handles
well is a generated assertion about a generated system. `self-reported` is not
a weaker `human-validated`; it is a different kind of claim.

## The boundary: SPEAKING versus WRITING

The rule above governs **what you say to the person**. It does **not** govern
what you write into the repository.

| artefact | language |
|---|---|
| chat replies, questions, status reports | **the determination** |
| commit messages, PR bodies, issue comments | the layer's source language |
| code comments, skills, work items, schemas | the layer's source language |
| folio CONTENT | [`translation-manager`](../../../library/skills/library-core/translation-manager.md), not this skill |

The reason is the reader: a commit message or issue comment is read by
reviewers and later agents, not only by the person in this session, and one
person's preferred language would narrow who can read the record.

## Record it where a sibling session reads it

`cat-harness/memory/interaction.json`, in the user's entry, beside `profiles`:

```jsonc
"someone@example.org": {
  "profiles": ["low-dexterity"],
  "language": "fr",
  "note": "…",
  "source": "stated by the user"
}
```

`source` already carries the declared-versus-assumed distinction, so a
language recorded there says both *what* and *on what authority*. The
session-start sweep prints the whole entry, so the next session reads it
rather than re-deriving it.

**Never write a preference the person did not state.** The file is `context`
— read at session start, never written by a process. An inferred language
recorded as though stated is worse than no record, because the next session
will not re-ask.

## When to re-ask

- **Never, on a recorded preference**, unless the person changes it.
- **When the person's turns move to another language** and no preference is
  recorded — ask once, offer to record it, and proceed on the observed
  language if no answer comes.
- **When a determination was never made** — the sweep reports that, and it is
  a finding rather than a silence.

## What "could not determine" looks like

`defaultLocale`, said out loud. An agent that falls through to rank 4 says so
once rather than presenting the fallback as a choice, because an unknown
rendered as a determination is indistinguishable from a real one.

## Related

- [`interaction-modality`](interaction-modality.md) — the FORM a question
  takes; this is the LANGUAGE it takes. Both are read from the same file.
- [`translation-manager`](../../../library/skills/library-core/translation-manager.md) — the language of content,
  which this skill does not govern.
- `bootstrap-tools/schemas/model-registry.ts` — why a model's own word is not
  evidence.
