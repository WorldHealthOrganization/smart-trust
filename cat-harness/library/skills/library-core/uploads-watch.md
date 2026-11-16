---
name: uploads-watch
description: >
  Notice what has landed in the acquisition queue, and tell an arrival from a
  backlog. Reports; it never deletes, and never ingests on its own say-so.
---

# Watching the queue

`uploads/` is the acquisition queue —
[`content-acquisition`](content-acquisition.md) puts things in it,
[`library-ingestion`](library-ingestion.md) takes them out. This is the step
between: seeing that something arrived.

**The queue path is read from the declaration, never written down.** It is
`uploads/` relative to the *layer*, which is not where a repository-relative
consumer would look. `queueRepoRelative` in `scripts/upload-url.ts` is the one
place that arithmetic lives.

## An arrival is not a backlog

A file sitting in the queue says nothing on its own: it may have landed a minute
ago or been waiting since before this session. Do not report a queue's
*contents* as news: a watcher that does becomes noise that gets ignored, and an
ignored watcher reads as coverage.

So report against a **mark**: what was there when this session began, or when
the watch last ran. What is new since the mark is an arrival. Everything else is
the backlog, and the backlog is mentioned once, as a count.

**A backlog is still a finding.** A queue that has held the same file for weeks
means acquisition happened and ingestion did not, and nobody noticed. That is
worth one line — not silence, and not a repeated alarm.

## It reports; it does not act

**Never ingest on a watcher's say-so.** A drop is somebody handing over a file,
not an instruction to publish it: ingestion decides a bib slug, writes into
`library/`, and is a judgement call that
[`library-ingestion`](library-ingestion.md) owns.

**Never delete anything from the queue** — that is
[`deletion-requires-confirmation`](../../../skills/conduct/conduct-core/deletion-requires-confirmation.md) applied
where it is most tempting, because a processed file *looks* spent. It is not:
`uploads/` is the raw record of what was handed over, and the derived entry in
`library/` is not a substitute for it. Report what could go, with sizes and
ages, and wait to be told.

## What to say when something arrived

Name the file, say when it landed, say what it appears to be — and then say the
next step is ingestion and whether you are taking it. An arrival reported
without a next step hands the reader a fact and a chore.

## What to say when nothing did

Nothing, unless you were asked. A watch that reports every quiet interval trains
its reader to skip it, including the round that matters.
