---
name: translation-adjudication
description: >
  A person's word on a translation, carried from the translation review page
  or a block's 🌐 pane to the record: anyone proposes text, which joins the
  ranked candidates; an owner, member or collaborator adjudicates, by
  accepting a catalogue or choosing one string's translation with a reason;
  it is filed as a `translation-adjudication/v1` issue; a workflow checks the
  author and the catalogue's hash, writes the records, re-runs the auto-pick
  and opens a PR; a maintainer merges it. Use for "review the translations", "this string is
  mistranslated", "why was my review not recorded", and when wiring a layer
  for review. Locale sign-off is a separate act, not this one.
graph-typologies:
  - translation-sources
---

# Translation adjudication — the review loop

> Skill id: `translation-adjudication` · Package: `library-core`

The process is
[`translation-review-adjudication.bpmn`](../../processes/translation-review-adjudication.bpmn);
this page is what each lane of it needs to know.
[`translation-manager`](translation-manager.md) is the reference for every term
used here (catalogue, `msgstr`, fuzzy, translation node, official).

## What it records, and what it never does

What one person said about one catalogue, against the exact bytes they saw.
Who they are decides what it counts as: **anyone proposes; only an owner,
member or collaborator adjudicates**, and that is read from the issue
event's `author_association`, never from the body.

| what was filed | by | what is written |
|---|---|---|
| a suggestion | anyone | appended to the catalogue's candidates sidecar as a `human` candidate (`id: github:<login>`, `by`, `issue`, its `msgidHash` and placeholder QA), beside every other candidate; never refused for a changed catalogue |
| a suggestion with **Choose as the translation** (`choose: true`, `reason`) | a collaborator | the suggestion is also the string's `msgstr`, not fuzzy, and the sidecar entry's `chosen` records `how: adjudicated`, `by`, `at`, `issue`, `reason` and which candidate |
| the same | anyone else | refused as a choice, with a comment; kept as their proposal |
| **acceptable** | a collaborator | the catalogue's translation node gets `signedOffBy` / `signedOffAt`, and each fuzzy string in it is adjudicated as it stands; the review page shows it `reviewed`, and `stale` once its bytes change |
| **acceptable** | anyone else | refused, with a comment |
| any of the above | — | an entry appended to the catalogue's `translation-qa` attestation, criterion `human-adjudication` (or `human-proposal`), naming the issue and the hash the person saw |

After the writes, every string nobody has adjudicated is **auto-picked by
rank** (below).

It **never** makes a translation official. The PO header `X-Folio-Official`
and the locale's `status.json` are left alone: locale sign-off is the
translation coordinator's act in `human-translation-workflow`
(`Task_Signoff`), checked by `check-translation-officiality`. A reviewed
catalogue is evidence for that sign-off, not a substitute for it.

## Candidates are never a barrier to having a translation

A string may have several candidate translations, from several sources; they
live beside the catalogue in `<locale>/<catalogue>.candidates.json`
(`translation-candidates/v1`), and [`translation-candidate-source`](translation-candidate-source.md)
is how they are produced. The rule that binds every writer:

- the `.po` keeps **one** `msgstr`; the sidecar keeps the rest;
- when a string's `msgstr` is **empty**, the writer also puts the **first**
  candidate there, marked `#, fuzzy` — the page always has something to show,
  the status page counts it as needing review, and it stays the default until
  a person adjudicates;
- an existing `msgstr` is never replaced by a candidate, only offered beside it;
- a candidate is never a verdict, whoever produced it.

## The rank, and the default pick

When no collaborator has chosen, a string shows its best-ranked candidate.
The rank is one function, `rankCandidates`: the tool that writes the strings
projection ranks with it, the 🌐 pane restates it for a bare candidates
sidecar, and a test holds the two equal, fixture for fixture.

| tier | score |
|---|---|
| `official` — an official publication's text | 0 |
| `human-adjudicated` — the text a collaborator chose | 1 |
| `human-proposed` — a person's proposal | 2 |
| `platform` — a translation platform (Weblate, Crowdin, Transifex) | 3 |
| `agent` — an agent model | 4 |
| `mt` — open machine translation, or a machine-translation web service | 5 |

A QA failure (glossary, placeholders, round trip) adds **10**. A check not
run is not a failure. Ties go to the newest `source.at`, then the order
recorded. A **stale** candidate — its `msgidHash` is not the string's now,
because the source text changed — is listed after every other and is
**never auto-picked**.

The auto-pick fills an empty `msgstr`, or replaces one that is itself an
earlier auto-pick; it never overwrites a collaborator's choice, or text whose
provenance is not an auto-pick. It is written fuzzy and unofficial
(`chosen.how: auto`), except an `official` candidate whose `sourceText` is
the msgid **exactly**: whitespace, case and punctuation included. That one is
written without `fuzzy`, as `auto-official`.

## The reviewer's lane

There are two ways in, and both file the same issue.

- **The review page** (`review.html`, beside the translation status page):
  a layer's catalogues × locales. A cell is `machine`, `flagged`, `stale` or
  `reviewed` when it can be adjudicated; `none`, `empty` and `official`
  cannot.
- **A block's 🌐 pane**, in the block's 📣 panel, on **every** page —
  source-language pages included. It lists every locale's current
  translation of the block: its status (`official`, `adjudicated`,
  `proposed`, `agent`, `mt`, `missing`, `stale`, `unattributed`) and how it
  came to be (`chosen.how`, `chosen.by`). On a translated page that page's
  locale comes first and the others are collapsed. It reads
  `assets/translation-status/review.json` and each catalogue's strings
  projection (`folio-translation-strings/v1`), which every site build
  publishes wherever the checkout has translations.

Then:

1. Read the strings against their source. **✎ Fix translation** shows, per
   locale, each string's candidates as a ranked table: the text; the
   source's kind, id and version; who, linked to the issue it came from; the
   date; the QA results; a stale mark; whether an official source's English
   matched exactly; and which one is the default.
2. Either mark the catalogue **acceptable**, or, for each wrong string, pick
   a row (its text fills an editable box, and its source is recorded while
   the text is unedited) or **write your own** text.
3. If you are an owner, member or collaborator and mean it as the
   translation, tick **Choose as the translation** and say why. Anyone else
   may tick it too, but only a collaborator's choice is recorded; anyone
   else's becomes a proposal. The help text says so.
4. Submit. The page opens GitHub's new-issue form prefilled with a readable
   summary — per string, whether you **propose** or **choose** — and the
   `translation-adjudication/v1` JSON block, labelled
   `translation-adjudication` and titled `[translation review] …`; when the
   record is too long for a URL, it copies the body for you to paste. Filing
   the issue is the act of proposing or, for a collaborator who chose, of
   adjudicating, under your own login.

Do not edit the JSON block by hand. It carries the hash of each catalogue you
saw, and a hand edit that changes what you reviewed is a record of something
you did not read.

## The workflow's lane — and every refusal

`layer-translation-adjudication.yml` (a reusable workflow; a layer's caller is
a few lines) runs `translation:adjudicate` on the `issues` event. It reads the
event file and parses the body only as JSON. It refuses rather than guesses,
and says why on the issue:

| refusal | why | what to do |
|---|---|---|
| already recorded | the issue's branch exists | nothing: one issue, one record |
| could not determine (exit 2) | no event, no issue author, or no declaration | the run FAILS; it is never read as "nothing to record" |
| an `acceptable` or a choice from an author who is not an owner, member or collaborator | identity comes from `author_association`, never the body | nothing: their suggestions are recorded as proposals; a collaborator can choose among them |
| invalid record, wrong repository, wrong translations directory | the record is not for this layer | file it from this layer's page |
| a choice or acceptance against a catalogue that changed since the page showed it | the `poHash` no longer matches | reload the page and choose again; the proposal is kept |
| a choice whose `current` text is no longer the catalogue's | the string moved under you | reload and choose again; the proposal is kept |
| node or attestation will not parse | the attestation is append-only and never overwritten | fix the file; nothing is recorded for that catalogue |

Proposals are never refused for a moved catalogue: the pins bind
adjudication only. When every item is refused, nothing is written and no PR
is opened (exit 3).
When some survive, those are recorded and the refusals are listed beside them
in the PR body and the issue comment — never a partial record dressed as a
whole one.

## The maintainer's lane

The workflow commits on `translation-adjudication/issue-<n>`, authored by the
issue's author, and opens a **ready** PR. A PR opened with the workflow's
token starts no other workflows, so the layer's checks run once a maintainer
pushes to it or re-opens it. The maintainer judges whether the PR writes down
what the issue decided and nothing else — not the translation, which was the
reviewer's verdict. Closing it records nothing.

## Tools

Every Tool here is one concrete way of doing a step; another forge or another
engine is another Tool satisfying the same skill.

| step | Tool |
|---|---|
| produce candidates | any [`translation-candidate-source`](translation-candidate-source.md) Tool: `translation-candidates-agent`, or the open machine-translation engines through `translation:candidates` |
| build the review page | `translation-status-viewer` (`translation:status` writes `review.html`) |
| read and submit a verdict | `translation-review-page`, or a block's 🌐 pane (cat-harness `site-chrome/assets/js/translation-review.js`) |
| publish what the pane reads | `publish-translation-review.ts`, run by every site build |
| carry the issue, run the workflow, hold the PR | `github` |
| the workflow itself | `translation-adjudication-workflow` |
| plan and write the records | `translation-adjudicate` |

## Do not

- Do not treat `reviewed` as `official`, or sign a locale off from this loop.
- Do not accept a catalogue whose suggestions you just wrote: they are fuzzy
  until somebody else reads them.
- Do not paste an issue body into a shell or an expression: it is untrusted
  text, read only as JSON from the event file.
- Do not let a candidate's source stand in for a verdict: an agent model's
  candidate is as unreviewed as an open model's.
- Do not treat a high rank as a review. The auto-pick is a default to show,
  fuzzy and unofficial, not a choice anyone made.
- Do not let a source change block a pull request on its translations: the
  strings go `stale` and re-enter this process.
