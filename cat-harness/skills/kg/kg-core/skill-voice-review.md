---
name: skill-voice-review
description: >
  Reviews a skill against a voice that judges skills — the base
  `agent-skill-authoring` voice or a vendor override such as Claude's, Gemini
  CLI's or OpenAI's — rule by rule, with each rule's citation open, and records
  the verdicts with `voice:review`. Use when `skill-voice-review-current` reports
  a skill never reviewed or reviewed before the skill or the voice changed, or
  when asked whether a skill follows a vendor's authoring guidance. The agent
  half of that axis; the mechanical half, in `scripts/skill-voice-review.ts`,
  only says whether a current review exists.
allowed-tools: Read Bash Grep Glob
graph-typologies:
  - voices
---

# Skill voice review

## What this axis is, and what it deliberately is not

A voice whose rules declare `appliesTo: ["skill"]` judges skill files. In
`agent-skills` that is the shared base `agent-skill-authoring` and one override
per vendor under `skills/voices/vendors/` (`vendors/vendors.json` lists them),
each extending the base. A voice counts
only once the harness config **activates** it (`voice.active` in
its `index.config.json` entry) — the same switch every other voice uses.

The boundary: **an agentic review, with no formal gate on rule content.**
"Best practice" drifts, and a vendor describing its own product is an
assertion, not evidence. So:

- the criterion `skill-voice-review-current` (`minor`, gated by nothing) asks
  only whether a review exists for the skill and voice **as they are now**;
- a rule you judge `fail` is recorded in the skill's attestation file and printed —
  it is **not** a finding, and it must not be turned into one here.

## Reviewing one skill against one voice

1. **Print the rules you are judging**, resolved through `extends`:

   ```sh
   bun run cat voice:review -- --rules agent-skill-authoring-claude
   ```

   A vendor voice lists its own rules and the base's, because an inherited rule
   keeps the scope it was declared under.

2. **Open each rule's citation before judging it.** Every rule carries the
   library entry, page and quote it was read from. Uphold a verdict from the
   source, never from the one-line title: the title is a summary, and the rule
   is what the quote says.

3. **Judge the skill as the platform would load it** — the front matter the
   router sees, the body, and the files the body points to. One verdict per rule:

   | verdict | when | note |
   |---|---|---|
   | `pass` | the skill does what the rule asks | optional |
   | `fail` | it does not | **required** — what is missing, where |
   | `n/a` | the rule cannot apply to this skill (a scripts rule, and the skill has no scripts) | **required** — why not |

   `n/a` is not a softer `fail`. If the rule could apply and the skill does not
   meet it, that is a `fail` with a note.

4. **Record it** — the writer refuses a set that misses a rule, judges one
   twice, or leaves a `fail`/`n/a` unexplained:

   ```sh
   bun run cat voice:review -- --sidecar <instance>/test/results/kg-qa/<skill path>.json \
     --voice agent-skill-authoring-claude --by agent --verdicts verdicts.json
   ```

   `verdicts.json` is `[{ "rule": "<id>", "result": "pass"|"fail"|"n/a", "note": "…" }]`.
   The review pins the skill's content hash and the hash of the voice's skill
   rules, and replaces any earlier review of that skill against that voice.

   **`--sidecar` names the subject, not where the review is written.** A voice
   review is a judgement, so it is kept as `voice_reviews` in the skill's
   attestation file, `<instance>/test/attestations/kg-qa/<skill path>.attestations.json`
   (`qa-attestations/v1`), on `main` — not in the derived kg-qa sidecar, whose
   record is on the `qa-reports` branch. Commit
   the attestation file. A store that cannot be read is UNKNOWN and the writer
   refuses rather than overwriting it.

5. **Run `bun run cat kg:audit`** so the sidecar's criterion reads the new review
   from the store.

## When the criterion reports stale

A review goes stale when **the skill changes** or **the voice's skill rules
change**. The earlier review is kept, not deleted — it is evidence of what was
checked — and the finding stays until a new review replaces it. Re-review the
whole voice rather than patching the one rule you suspect moved: a changed
skill can break a rule nobody was looking at.

## Fixing what you found

A `fail` verdict is information for whoever owns the skill. Editing the skill is
a separate change with its own review. Do not edit a skill to make your own
verdict pass in the same step: record the verdict first, change the skill, then
review again — so the sidecar shows both states.
