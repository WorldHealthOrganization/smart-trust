---
name: translation-adjudication
description: >
  A person's verdict on a machine translation, carried from the translation
  review page to the record: the reviewer accepts a catalogue, or flags a
  mistranslation and picks a candidate or writes their own text; the verdict
  is filed as a `translation-adjudication/v1` issue; a workflow checks the
  author and the catalogue's hash, writes the records and opens a PR; a
  maintainer merges it. Use for "review the translations", "this string is
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

One catalogue, read by one person who can be held to it, against the exact
bytes they saw. Nothing more:

| verdict | what is written |
|---|---|
| **acceptable** | the catalogue's translation node gets `signedOffBy` / `signedOffAt`; the review page then shows it `reviewed`, and `stale` once its bytes change |
| **mistranslation** | each suggestion replaces its `msgstr`, marked `#, fuzzy`, so the catalogue is **flagged for review** — a person's text is not reviewed by being written |
| either | an entry appended to the catalogue's `translation-qa` attestation, criterion `human-adjudication`, naming the issue and the hash the person saw |

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

## The reviewer's lane

1. Open the review page (`review.html`, beside the translation status page).
   A cell is `machine`, `flagged`, `stale` or `reviewed` when it can be
   adjudicated; `none`, `empty` and `official` cannot.
2. Read the catalogue's strings against their source, with the candidates
   beside each.
3. Either mark the catalogue **acceptable**, or mark it a **mistranslation**
   and, for each wrong string, **pick a candidate** (its source is recorded
   with your suggestion) or **write your own** text.
4. Submit. The page opens GitHub's new-issue form prefilled with a readable
   summary and the `translation-adjudication/v1` JSON block, labelled
   `translation-adjudication` and titled `[translation review] …`; when the
   record is too long for a URL, it copies the body for you to paste. Filing
   the issue **is** the act of adjudicating, under your own login.

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
| author not an owner, member or collaborator | identity comes from `author_association`, never the body | a maintainer files the same review under their own name |
| invalid record, wrong repository, wrong translations directory | the record is not for this layer | file it from this layer's page |
| catalogue changed since the page showed it | the `poHash` no longer matches | reload the page and review it again |
| a suggestion's `current` text is no longer the catalogue's | the string moved under you | reload and review again |
| node or attestation will not parse | the attestation is append-only and never overwritten | fix the file; nothing is recorded for that catalogue |

When every item is refused, nothing is written and no PR is opened (exit 3).
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
| read and submit a verdict | `translation-review-page` |
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
