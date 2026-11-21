---
layout: default
title: Voices — editorial overlays
parent: Authoring guides
nav_order: 5
---

# Voices — editorial overlays
{: .no_toc }

<details open markdown="block">
  <summary>On this page</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

## What voices are

Voices are **editorial overlays**, not content adapters or project profiles. The base scholarly standard of the platform is always active, and voices layer on top of this base to enforce specific editorial, grammatical, stylistic, or visual registers. They do not replace the base standard but rather add domain-specific rigor.

## Where voices come from

This layer ships the **mechanism** — the `folio-voice-skill/v1` shape, the
authoring and review skills, the BPMN process and the viewer — and **no
voice**. A voice is shipped by the layer that owns the register it encodes:
a house style by the layer that holds that organisation's style manuals, an
exposition standard by the science layer that holds its exemplar paper. Each of
those layers documents its own voices beside their `SKILL.md` and
`voice.json`, and links down to this page for the mechanism.

This page does not list them: every one sits **above** this layer, so a link
from here would point up the dependency arrow, and a list here would be a
second catalogue free to drift from the first. The catalogue is the
interactive viewer (`bun run cat voices:viz`, published at
`cat-harness/docs/cat-harness/voices/`), which re-reads every layer that
declares a `voices` graph on each run; `skill_list` answers the same question
from an agent.

## Activation

To activate voices, list them in your `folio.config.json` under `voices.active[]`.

```json
{
  "voices": {
    "active": [
      "who-editorial",
      "who-guideline-development"
    ]
  }
}
```

Platform docs themselves carry no voice, meaning their `voices.active[]` array is empty or absent.

## The authoring cycle

Voices are designed to be part of the entire document lifecycle:

- **Before writing:** Follow the [voice-authoring-guidance](../../skills/authoring/authoring-core/voice-authoring-guidance.md) skill, because honouring terminology and stylistic rules as you type is cheaper than retrofitting them.
- **After writing:** Use the [voice-overlay-review](../../skills/authoring/authoring-core/voice-overlay-review.md) skill. This reviews your blocks against the rules of your active voices and places findings on the QA sidecar.

## How voice review works

You can read about the formal review process in the [Voice overlay review BPMN process]({{ '/processes/voice-review.html' | relative_url }}) page.

Every rule inside a voice carries a `source` citation that resolves to a real document or reference. When reviewing, you must open the cited page. The mechanical half of a rule (its patterns or terminology) acts as a question. The reviewer must check the context to decide if the rule truly applies or if it's an exception (the judgement half). If a rule's own citation does not support it, the defect is in the rule itself, not the prose.
