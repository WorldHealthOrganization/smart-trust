---
name: deletion-requires-confirmation
description: >
  An agent never removes a durable artefact on its own initiative. Report what
  would go, with sizes and ages, and wait for the user to say so. Covers what
  counts as durable, the non-destructive move for each kind, and the rule that
  a workflow whose shape deletes something counts as a deletion nobody decided.
allowed-tools: Read Grep Glob Bash
---

# Deletion requires explicit confirmation

**One rule:**

> **An agent does not remove a durable artefact on its own initiative. It
> reports what it would remove — with sizes, ages and what each one is — and
> waits for the user to say so.**

The rule is about the gap between *an agent decided this was no longer needed*
and *a person decided it*: the second is cheap to obtain, and the first is
never recoverable from the outside.

**A waiver is not an exception to it.** The owner may grant the `deletion` gate
in advance — for a session, a process run, or a named artefact class — and that
grant is the person deciding. The agent never supplies the decision itself. A
waiver carries the grantor, their **verbatim words**, one gate class, a scope
and an expiry; one missing field means there is no waiver
([`confirmation-waiver`](confirmation-waiver.md)). A `deletion` waiver **is
never blanket** — a grant over build artefacts is not a grant over content —
and **it never reaches a work item**: *never delete a work item* is a prohibition, and
`scrapped`, with reasons, is always available.

## Why removing something is not the inverse of creating it

**A deletion destroys the evidence that it happened.** A wrong file is visible
and gets fixed; a removed one looks exactly like "there was never anything
here".

**The person who pays is not the person who acted.** A sibling session, a
reviewer following a link, the next agent — none can tell a deliberate removal
from an accident. A scrapped work item records that something was considered and
rejected; a deleted one leaves a sibling unable to tell abandonment from
accident. The same holds for a staging preview, a witness or a library source.

**Asking is nearly free and reverting often is not.** Confirming costs one line
in a report and one word back; a wrong deletion costs whatever it took to
produce the thing, and may never be discovered.

This skill is the general rule; the work item rule in
`todo-manager` (opt-in `cat-harness.work-plan`) is one
instance of it.

## What counts as durable

The test is not "is it committed" and not "is it large". It is:

> **Could somebody other than me want this later, and would they be able to
> tell it was removed on purpose?**

If the answer to the first is yes and to the second is no, it is durable.

**Durable — confirm before removing:**

| artefact | why | the non-destructive move |
|---|---|---|
| a **work item** (`beans/defs/*.md`) | records that something was considered; ids are referenced from commits, issues and other work items | set `status: scrapped` with the reasons; `beans archive` MOVES resolved ones |
| a **todo** (`todos/items/*.md`) | it is a *person's* outstanding work, not an agent's | ask the person; an agent may neither close nor remove one |
| a **staging preview** (`branches/<slug>/` on the publish branch) | it is the artefact a human assesses a rendered change from — **unless the PR merged**, when the main site now shows the same thing | **merged → removed automatically; the merge IS the confirmation.** Otherwise: while the PR is open, the `staging:cleanup` label applied by a person; once closed unmerged, a `feature-staging.yml` dispatch with `cleanup_slug` + a matching `cleanup_confirm`, since the label cannot reach a closed PR |
| a **published page** on the site | a URL somebody has linked or bookmarked | say what would 404 and let the owner decide; a redirect is often the answer |
| a **QA verdict or witness** | the previous answer is what separates "this broke today" from "this has been broken since it was written" | regenerate it in place; never remove it to make a sweep clean. Its record is the commit-keyed entry on the `qa-reports` branch; an entry there is removed only by `qa:prune`'s declared retention, never by hand |
| a **QA attestation** (`test/attestations/**`) | a judgement — agent, human or baseline pair — that no regeneration can reproduce | never removed to clear a finding; a stale one is re-judged, and the new judgement replaces it through its writer |
| **library / uploads content** | every knowledge-graph reference to a source resolves through `library/`; a file in `uploads/` reads as absent to every consumer while still on disk | move it forward through the pipeline, or ask |
| a **workflow instance** (`beans/workflows/*.json`) | it is where a running process got to; a sibling session is reading it | complete or discard the instance through the engine, which records the fact |
| a **branch, tag or ref** somebody else pushed | it is the only copy of work that is not on `main` | leave it; say it looks finished with |

**Not durable — rewrite or remove freely:**

- scratch files in a scratchpad or temp directory, and anything you created
  this session that nothing else has seen;
- build output: `_site/`, `_kg/`, `dist/`, `node_modules/`, `test-results/`;
- **a generated artefact being rewritten in place by its own generator.** The
  distinction is *in place*: writing a fresh `kg-qa` sidecar over the old one
  is regeneration; removing a sidecar whose subject you could not load is a
  deletion, and a false pass besides.

Three cases sit on the line and all resolve the same way — **ask**: a file you
believe to be an orphan, a directory you believe to be empty, and a file whose
only reference you have just removed, because in each the belief is exactly
what would be wrong if you are wrong.

**Establish which layer owns a node before you propose removing it.** In a
multi-layer layout a file that looks orphaned here may be declared from
somewhere else ([`placement`](../../kg/kg-core/placement.md)).

## What to do instead

**Report, do not act.** The report is the deliverable:

- **Name every artefact.** Assert by naming, never by counting — "4 previews
  are orphaned" is a statistic; "`branches/<slug>` (36.8 MB, last deployed 11
  days ago, its PR merged) matches no open pull request" is something a person
  can answer.
- **Give the size and the age.**
- **Say what is lost if it goes**, in terms of what would differ — a 404 on a
  link, a reviewer unable to compare, a sibling unable to tell abandonment from
  accident.
- **Recommend one option and mark it as your recommendation**, then say what
  happens if they say nothing — the frame
  [`interaction-modality`](interaction-modality.md) §4.1 requires of every
  handed-over decision.

**Prefer the move that keeps the record:** `scrapped` over deleted, archive
over remove, redirect over 404, regenerate over unlink, a label over a workflow
step.

**When the user does say so, do exactly that and no more.** A confirmation to
remove one thing is not a confirmation to remove the class it belongs to. If
the scope is ambiguous, ask again.

**A standing confirmation for a class is the owner's to give — never an
inference.** The worked case is the staging preview cap: the owner's standing
confirmation covers removing the oldest previews beyond a total size budget
(3 GB), so the `stage` job removes them without asking per preview. A class
confirmation covers the class as the owner last stated it; changing the rule
is theirs. It does not waive the record: each rotation names the artefact, its
age and its size — in the commit message, the job log and a `removed`
render-log entry — and retires its `staging-preview.json` into
`branches/_retired/` rather than deleting it. It covers rotation over the cap
and nothing else on the branch. See
[`staging-review`](../../ui/ui-core/staging-review.md) §"The cap — 3 GB
of previews in total, the oldest rotated off".

## A workflow whose shape deletes something

**A deletion nobody decided is still a deletion that requires confirmation.**
A publish step that clones the publish branch, removes everything on it and
copies the new build in (a full replace with no kept files) deletes every
artefact other workflows put there — for example every open PR's staging
preview — with no step anyone wrote with that intent, silently, and against
any explicit retention rule elsewhere. Since there is nobody to ask at push
time, the workflow must not be shaped that way: restore what it does not own
(e.g. `branches/`) into the publish directory before the push.

**A removal policy needs a removal that can actually be confirmed.** If the
only sanctioned remedy cannot reach the artefacts a report names (a label on
a PR that is already closed), the person is left with unsanctioned options. Give
the confirmation somewhere to go — e.g. a dispatch whose confirmation input
repeats the slug, and which re-evaluates liveness at removal time rather than
trusting the report.

**A report that names live work invites a deletion.** "No open pull request"
is not "abandoned"; check recent activity before naming a candidate.

## Name the instrument that produced the list

**A candidate list must say where it came from.** If a committed check computed
it, quote the check's finding and name the check. If you built the list by
hand, say so, so the person can see they are being asked to act on a
derivation rather than on a measurement.

A hand-derived list SHORTER than the instrument's is a harmless miss. One that
is LONGER extracts a permission the instrument never justified — for example a
slug rule re-implemented inline that names live previews of open PRs as
orphans. So **do not re-derive what a committed check already computes**
(`goal-review` rule 2, stated
there for the reviewing side).

## Applying it to your own code

**Does anything you are writing remove something as a side effect of doing
something else?** A full-replace publish, a `--prune`, a cleanup step, a cache
eviction, a `git rm` that globs. If so, name what it removes, in the code, and
make sure a person chose it.

**If it is a sweep, does it act or does it report?** A checker that finds
accumulation reports it: every finding's `action` names something a *person*
does, as in `bun run cat health`, whose workflow opens an issue and removes
nothing.

## Checklist

- [ ] Is the thing durable by the test above? If unsure, it is.
- [ ] Is there a non-destructive move — scrap, archive, redirect, regenerate,
      label? Prefer it, and say you preferred it.
- [ ] Have you **named** each artefact, with its size and age and what is lost?
- [ ] Does the list say **which instrument produced it** — or, if you built it by
      hand, does it say that?
- [ ] Have you given a recommendation, and said what happens on silence?
- [ ] Did the user confirm **this** removal, rather than a similar one?
- [ ] Does any code you wrote remove something as a side effect? Say so in the
      code, and check a person chose it.
