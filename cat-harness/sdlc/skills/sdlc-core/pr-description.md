---
name: pr-description
description: >
  Write or update a pull request's description so that someone who has never
  seen the work can follow it: the problem, why it matters, how it was
  approached, what constrained it, the solution, how to use it, and what is not
  done. Read before opening a PR, before rewriting its body, and whenever the
  PR's scope changes.
allowed-tools: Read Grep Glob
---

# pr-description — a PR body a first-time reader can follow

## What a PR description is for

**The reader has not been here.** A reviewer, the owner coming back a week
later, or the next agent opens the PR cold. The description is the one place
they can learn what the change is *for*, without the chat, the work item or the
commit log. If they need any of those to follow it, it has failed.

It is not a **change log** of commit titles turned into bullets ("fix
fsh-index path", "one file per key"): every line is true, and only the author
can read it.

## The sections, in order

| # | section | answers | test |
|---|---|---|---|
| 1 | **The problem** | what is wrong or missing today, concretely | a reader could explain it to a colleague without reading the code |
| 2 | **Why it matters** | who it hurts, and what it blocks | names a person, a process or a measured cost, not "improves quality" |
| 3 | **The approach** | the shape of the solution, and the alternatives set aside | says why THIS shape, not only what |
| 4 | **Constraints** | what the solution had to respect: owner rulings, invariants, things it must not change | each one is a reason a reviewer would otherwise ask "why not just…?" |
| 5 | **The solution** | what changed, grouped by idea, not by commit | a table or short list, at most one line per idea |
| 6 | **How to use it** | the commands, flags or pages a reader runs or opens | copy-pasteable, with prerequisites stated |
| 7 | **What is not done** | untested paths, known gaps, follow-ups | nothing a reviewer would be surprised by later |
| 7a | **Content review** (`content` PRs only) | which review process the content went through, and where its record is: owner card id, committee or review-log link, editing-hci-validation instance, review page | a `## Content review` section with at least one pointer; `merge:guard` check 9 reads it ([`prepare-merge`](prepare-merge.md) §"Content PRs") |
| 8 | **Status** | the live checklist ([`continual-progress`](../../../skills/conduct/conduct-core/continual-progress.md) invariant 3) | CI state on the CURRENT head |

Scale it to the change. A one-file fix can be three short paragraphs:
problem, fix, verified by. The order still holds, and so does "why", because
"why" is the section a reviewer cannot reconstruct from the diff.

These are the questions [`opening-brief`](../../../skills/conduct/conduct-core/opening-brief.md) asks in chat
before the work starts. The PR description is their durable form, updated
with what the work found.

## Rules

1. **Expand every identifier on first use.** Not "fixes `wnhh`" but "bean
   `wnhh`: SUSHI and the IG Publisher cannot run locally without
   packages.fhir.org". Not "W7", but "W7, the incremental rebuild".
2. **Every number carries its provenance:** measured on which head, by
   which command, or carried from where. The table in
   [`opening-brief`](../../../skills/conduct/conduct-core/opening-brief.md) §"The four parts" applies unchanged.
3. **Say what is not verified in its own section.** Not as a hedge buried in
   a bullet. [`continual-progress`](../../../skills/conduct/conduct-core/continual-progress.md) §"What to do with
   the thing you could not verify" is the rule; this is where it goes.
4. **A decision you hand the reader follows
   [`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md)
   §4.1:** context, then options, then a recommendation, then the question.
   The test is whether the reader can answer without opening anything.
5. **Link, never paste.** A long log, a full diff or a measurement table goes
   in a comment, a committed sidecar or a linked page. The description
   carries the conclusion and the link.

## Updating a PR: comments, not edits

A reader who has already read the description must be able to trust that it
still says what it said. A change they need to see goes
where GitHub shows it as new, which is a comment: a push, a CI round, a
review answered, a decision taken.

**Two exceptions are edited in the description itself:**

1. **Status is updated in place.** It has two parts, and both stay current:
   - **structured:** the status checklist
     ([`continual-progress`](../../../skills/conduct/conduct-core/continual-progress.md) invariant 3), with the
     work item and its epic, each linked, and the CI state on the current head;
   - **narrative:** two or three sentences on where the work stands and what
     it waits on.
2. **Scope changes are recorded, never overwritten.** Keep the original
   problem and solution text. Add a dated entry under `## Scope history`:
   what changed, why, who decided, and what it supersedes. Strike through
   (`~~…~~`) any original line it invalidates, instead of deleting it. A
   reader can then see both what was first proposed and what is being
   merged.

Anything else, such as a better phrasing or a fact found later, goes in a
comment.

## Cross-reference everything

Every identifier is a link:

| thing | link to |
|---|---|
| work item | its file, `beans/defs/<id>--<slug>.md`, on the PR's head branch |
| epic or milestone | the same, plus the work items dashboard at `<site>/beans/` (for this repository, <https://litlfred.github.io/folio-assistant/beans/>) |
| issue or PR | a full `owner/repo#N` link, never a bare `#N` across repositories |
| skill or process | its file, or its page under `<site>/reference/` |
| a measurement | the committed sidecar or the CI run that produced it |

**The dashboard has no per-bean deep link**, because its epic scope lives only
in page memory. A link opens the whole board, so link the work item's file for the
work item, and the dashboard for the overview.

## What never goes in it

- **Credentials, tokens, internal hostnames, or anything outside the diff.**
  The same rule as for PR templates.
- **Model identifiers.** The footer carries the session link, not the model.
- **Chat shorthand** that only the session understood: "per the 2y ruling",
  "Q4", "round 3". Say what the ruling was.

## Worked example

A PR adding an incremental-build library to the FHIR IG Publisher, before
and after.

- **Before:** "What's in it": twelve bullets, one per commit ("W1:", "W2:",
  "`-fsh-users`:", …), then "Housekeeping". Accurate, and unreadable to anyone
  who did not write it.
- **After:**
  - **The problem:** the Publisher is all-or-nothing, and what a build knew
    is thrown away.
  - **Why it matters:** folio-assistant needs a structured record of a build
    to detect staleness, review changes and eventually rebuild part of an IG.
  - **The approach:** a library on top of the Publisher, staged W1 to W7,
    with a table of what each stage adds and its state.
  - **Constraints:** the Publisher is not modified; an AST is a cache, never
    an authority; "cannot tell" means a full build.
  - **How to use it:** three commands.
  - **What is not done:** W7 has never run end to end, and a stray `.pyc`
    was committed.

## Relationship to other skills

- [`continual-progress`](../../../skills/conduct/conduct-core/continual-progress.md) owns the **status checklist**
  and the rule to open the PR at the first commit. This skill owns everything
  above that checklist.
- [`opening-brief`](../../../skills/conduct/conduct-core/opening-brief.md) asks the same questions in chat before
  the work starts. The description answers them for a reader after it.
- [`prepare-merge`](prepare-merge.md) records gate results in the body, in
  the gate's own terms, and adds them under **Status**.
- [`issue-working`](issue-working.md): the issue holds the request and its
  sign-off, and the PR description links it in the first line rather than
  restating it.

## Staging links

When a staging preview exists, every request this skill makes for feedback,
review or sign-off carries it: one deep link per changed page, to the anchor
where the change sits, with the same page on main as *before*. Where the skill
declares an output contract, they go in its `stagingLinks` field. The rule, and
where the page list comes from:
[`feedback-deep-links`](../../../skills/authoring/content-lifecycle/feedback-deep-links.md).
