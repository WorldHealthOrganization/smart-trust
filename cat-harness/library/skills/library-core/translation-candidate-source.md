---
name: translation-candidate-source
description: >
  The one interface every candidate-translation engine meets: for a layer's
  catalogues, append candidate translations per string to the
  `translation-candidates/v1` sidecar, each carrying its source, and seed an
  empty `msgstr` with the first candidate marked fuzzy. An agent model and the
  open machine-translation engines (OPUS-MT, LibreTranslate / Argos) are
  interchangeable behind it. Use when adding an engine, choosing one, or
  producing candidates for review.
graph-typologies:
  - translation-sources
---

# Translation candidate source — one interface, many engines

> Skill id: `translation-candidate-source` · Package: `library-core`

A **candidate** is a translation somebody or something proposes for one
string. This skill states what producing candidates means, independent of
the engine. A Tool that `satisfies` it runs one engine or several — the
open machine-translation Tool picks its engine by flag — and which engine
produced a candidate is recorded on the candidate.
The reviewer's choice among candidates is a step of
[`translation-adjudication`](translation-adjudication.md).

## The contract

What makes engines interchangeable is what they WRITE, not how they are
called: every Tool of this skill walks a layer's catalogues for the locales
asked and leaves the same two things behind.

| | |
|---|---|
| **input** `instance` | the layer root whose catalogues to propose for |
| **input** locales | the target locales; absent means every locale the layer declares |
| **output** `candidates` | `translations/<locale>/<catalogue>.candidates.json`, `translation-candidates/v1`, appended to |
| **output** `catalogues` | the `.po` catalogues whose empty `msgstr` got the first candidate, `#, fuzzy` |

Engine-specific inputs (which engine, a server's URL, a model) belong to the
Tool that runs that engine. Each Tool states its `selection` — when to reach
for it, where it stops, what it costs — so an agent can choose among them.

The sidecar holds, per string (`msgid`, with `msgctxt` when there is one), a
list of `{ text, source }`. `source.kind` is one of `agent`, `open-mt`,
`web-service`, `human`; `source.id` names the model or service
(`opus-mt-en-fr`, a model id, a GitHub login); `version` and `at` when known.

## The rules every engine keeps

1. **Append, never overwrite.** Another engine's candidates stay.
2. **Seed an empty `msgstr`, marked fuzzy.** Candidates are never a barrier to
   having a translation: when a string has no translation, the first
   candidate also goes into the `.po` as its `msgstr` with `#, fuzzy`. An
   existing `msgstr` is never replaced.
3. **Keep what must not be translated.** Placeholders, code, math, URLs and
   tags shielded by extraction must survive; the deterministic gates of
   [`translation-manager`](translation-manager.md) judge the `.po` after any
   engine has written to it.
4. **Say what you are.** A candidate without a `source` is refused by the
   sidecar's schema; an engine that cannot name its model and version names
   what it can.
5. **A candidate is never a verdict.** Nothing an engine writes makes a
   catalogue reviewed or official.

## Adding an engine

A new engine is either a new value of an existing Tool's engine flag — the
open machine-translation engines are one Tool, `translation:candidates
--engine opus-mt,libretranslate` — or, when it is a different mechanism (a
person, an agent, a paid service), a new Tool node under
`tools/<id>/<id>.json` that satisfies this skill, writes the outputs above,
states a `selection`, and — when it reaches a host — `requires.network: true`
with a `remedies` entry naming what to do when that host is refused. Nothing in the process changes: the process names this
skill, never an engine.
