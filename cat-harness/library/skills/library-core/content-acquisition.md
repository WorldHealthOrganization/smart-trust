---
name: content-acquisition
description: >
  Getting a resource INTO the graph in the first place — accepting one offered
  unprompted, or asking for one and then asking for it to be uploaded. The
  channels are plural and open: `uploads/` is one, the conversation is another.
  Runs before document ingestion, which begins only once a file has landed.
---

# Acquisition is the step before ingestion

`document-ingestion.bpmn` begins at **`StartEvent_Dropped` — "a file lands in
`uploads/`"**. This skill covers everything before that drop: noticing
something is needed, asking for it, telling somebody where to put it, seeing
it arrive.

## Channels are plural, and the set is open

| channel | what arrives | what it is good for |
|---|---|---|
| **`uploads/`** | a file, dropped or committed | PDFs, images, anything binary or large |
| **the conversation** | a link, a quotation, a narrative description | anything a person can say faster than they can find |

**Do not treat `uploads/` as the acquisition mechanism.** It is one, and the
most visible, which is why it gets mistaken for the whole. A description given
in chat is an acquired resource: it has a source, it can be wrong, and it
belongs in the graph with its provenance exactly as a PDF does.

Anything added later — a connector, a watched mailbox, a forge issue with
attachments — is another row, with no change to this skill.

## Two directions, and the unprompted one is easy to forget

**Unprompted.** A person offers something with no ask: they drop a file, paste a
link, or describe a paper. **Accept it.** Do not tell them to wait for a step,
and do not make them follow a process to hand you something they already have.
Record what it is and where it came from, then route it — a file to ingestion, a
link or a description to whatever will resolve it.

**Prompted.** Work has reached a point where a resource is needed. Then:

1. **Say what is needed and why**, specifically enough that somebody could go
   and find it. *"The WHO guideline this chapter cites"* is findable; *"more
   sources"* is not.
2. **Ask for what they can give**, and name both forms — **a link, or a
   description in their own words**. A person who cannot find the file often
   knows exactly what it is, and a description is an acquired resource, not a
   consolation prize.
3. **Only then ask for an upload**, with the place to put it — see below.
4. **Say what happens if they do nothing**, per
   [`decision-comparison`](../../../skills/conduct/conduct-core/decision-comparison.md) and
   [`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md) §4.1: which is usually that
   the work proceeds without the resource and says so.

Asking for all of it at once is what turns a request into a form. Asking for the
upload FIRST is worse: it demands the one thing they may not have, before the
cheaper answers have been offered.

## Never write the upload URL by hand

Use **`bun run cat-harness-tools/scripts/upload-url.ts [branch]`**, which composes it
from the declaration. A declared path is relative to its scope: with no
`scope`, `{ id: "uploads", path: "uploads/" }` resolves under the
**layer** (e.g. `cat-harness/uploads/` in an index checkout), while a forge
URL needs it relative to the **repository**. Pasting the declared path into
`/upload/<branch>/` drops the layer segment and mints a 404.

**Every failure is named rather than guessed.** No `origin` remote, a non-GitHub
forge, a declared-but-absent queue — each returns a reason and a remedy, because
a URL is believed and somebody sent to a wrong one cannot tell it from an empty
directory. When it cannot resolve, fall back to the conversation: that is what
the other channel is for.

## After the ask — watch, do not poll the person

A resource may arrive minutes or days later, and chasing is how an agent becomes
noise. [`uploads-watch`](uploads-watch.md) covers noticing an arrival; the rule
here is only that **the person is asked once**, and the next thing they hear is
either the work continuing or a report that it could not.

## What acquisition does NOT do

It does not ingest. The moment a file is in the queue, this is finished and
[`library-ingestion`](library-ingestion.md) owns it. Keeping the seam sharp is
what lets a resource acquired through a channel that does not exist yet reach
ingestion unchanged.
