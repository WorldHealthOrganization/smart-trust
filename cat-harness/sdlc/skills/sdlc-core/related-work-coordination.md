---
name: related-work-coordination
description: >
  Before new work takes shape, find the work it touches. Search work items, issues
  and open PRs for relevance; categorize and summarize every hit; then ask the
  user whether and how to coordinate. Judgement decides the categories and the
  recommendation, and the user decides the coordination. Called by CRDM when a
  requirement is initiated or updated in chat, and by methodology adoption.
  Process: processes/process/related-work.bpmn.
---

# Related work: find it, sort it, ask

## When

- **CRDM:** a requirement is **initiated or updated** in a human-agent chat. `crdm-issue-linking.bpmn` calls `Process_RelatedWork` before it scans for an issue to link.
- **Methodology adoption:** `methodology-from-source.bpmn` calls it after ingesting the source.
- Anywhere else a new piece of work is about to start and could collide with work in flight.

## Search (all three, every time)

| where | how | why |
|---|---|---|
| work items | `beans list --json`, then match on titles **and bodies**; include recently completed work items | a completed work item is a decision already made |
| issues | the repository's issues, open and closed | an open issue may already own the requirement |
| open PRs | the repository's open pull requests | a PR touching the same files is the collision worth finding first |

## Categorize and summarize (judgement)

Every hit gets exactly one category and a one-line summary giving its state and why it is in that category:

| category | meaning |
|---|---|
| **overlaps: coordinate** | the same thing, or changes the same files or process; left alone, the two will collide |
| **affected by** | this work will change what that item sees or does |
| **out of scope** | related, but deliberately not part of this work; say why |
| **unrelated** | a false match; list it only if a reader might assume otherwise |

This is judgement, not keyword matching. A title match is a lead, and the body decides the category.

## Ask

Put **one** question to the user, in the order context, then options, then recommendation (`interaction-modality` §4.1). Typical options:

- work in parallel and follow the other item's conventions;
- wait for it to land;
- build on its branch;
- note only.

Recommend one of them. **Do not link, block, merge or comment on another item before the answer.** Coordinating is a commitment made on behalf of that item's owners.

## Record

- Write the choice where it will be found: work item links (`--blocked-by`, `--parent`), a section in the issue or PR body, or "note only".
- A declined coordination is recorded too.
