---
name: crdm-detect
description: >
  Detect when a request needs requirements agreed before anything is built, and
  which of the two parallel requirements methodologies governs it.
input: schemas/skills/crdm-detect/input.schema.json
output: schemas/skills/crdm-detect/output.schema.json
---

# Feature-request detection (CRDM trigger)

Detect when a user request is a **feature request** (platform capability change)
rather than a **content request** (writing, editing, reviewing folio content).
When a feature request is detected, the agent works through requirements rather
than implementing directly.

## Applies when

Requirements that come from **stakeholders who must sign them off**, on work tied
to a folio's domain — WHO SMART Guidelines, an IG, a programme's content. The
requester is a content developer working through a BA, and the answer depends on
what the folio says. **Not** for a platform capability change raised by somebody
building the tooling with a content-agnostic answer — that is `spec-kit`.

## Which requirements methodology — the fork this detection now carries

**Detecting a feature request does not select CRDM by itself.** There are
**two** parallel requirements methodologies, and `methodology-adoption` forbids
blending them.
The signals below tell you a request needs requirements; this fork tells you
whose.

| | governs | requester | the answer depends on |
|---|---|---|---|
| **`crdm`** — this methodology | stakeholder-facing WHO/IG work: needs assessment, BPA, stakeholder sign-off | content developers, via a BA | a folio's subject matter |
| **`spec-kit` (opt-in `cat-harness.sdlc`)** | folio-assistant feature development; software-development best practice, closer to a scrum process | **tool developers** | nothing a folio says — **content-agnostic** |

**Most of the signals listed below are spec-kit's**, not CRDM's — the
"Platform-level change requests" and "Direct capability requests" categories
especially, since both describe somebody building the tooling. Read the
categories as *this needs requirements*, then apply the fork.

Two things bind under **either** methodology and are not a reason to pick one:
the issue-association rules at the end of this file, and the spec-before-code
gate.

## Detection signals

Scan every user request for these categories of phrasing. A single match is
enough to flag; two or more from different categories is high confidence.

### Direct capability requests

Phrases where the user explicitly asks for new functionality:

- "I need a way to …", "can you add …", "we need a tool that …"
- "there should be a skill for …", "add a QA check for …"
- "the renderer should support …", "make the pipeline do …"
- "can we add a new block kind for …", "we need a content type for …"
- "it would be great if the agent could …"
- "the agent should …", "the agent needs to …", "we will need to …"
- "build me …", "create a tool …", "develop a feature …"

### Workflow gap descriptions

Phrases where the user describes a process that does not work today:

- "right now I have to manually …", "there is no way to …"
- "the current process for … is broken", "this workflow doesn't handle …"
- "we can't do … yet", "it's missing …", "it doesn't support …"
- "every time I need to …, I have to …" (manual workaround pattern)
- "other people need to be able to …"

### Platform-level change requests

Phrases that imply changes to folio-assistant itself (not folio content):

- "change the schema to …", "modify the pipeline …"
- "add a new adapter …", "the constraint should …"
- "update the CI to …", "the workflow should fire when …"
- "the MCP tool needs to …", "register a new tool for …"
- "the upstream change requests to …", "upstream asks" — a change asked of a
  tool this platform DEPENDS ON is still a platform change; the folio is not
  where it lands either way
- References to files under `schemas/`, `pipeline/`, `adapters/`,
  `src/`, `scripts/`, `.github/workflows/`

### Cross-cutting concerns

Phrases that affect multiple folios or content types:

- "for all papers …", "every folio should …", "across all content types …"
- "when any user …", "the platform should …"
- "this needs to work for both document and paper folios"

### Review-surfaced needs

Phrases that emerge during content review:

- "this review process would be easier if …"
- "we need a way to triage these comments …"
- "the feedback workflow should …"
- "stakeholders need to be able to see …"
- "can we make the review process more …"

### A request for a plan

A request for a plan ALWAYS produces a requirements document and a work plan
for review before implementation.

- "plan", "make a plan", "plan the …"
- "approach", "what approach would you take"
- "proposal", "propose …"
- "how would you …"
- "come up with …"

**A plan request needs requirements under either methodology, and content
requests are not exempt**: "plan the edits to chapter 3" triggers it as
surely as "plan the new validator". The fork above still decides WHOSE
requirements — this signal never selects a methodology and never blends them.
The operation is the same for both and lives in the content layer, in the
`plan-request-gate` skill (`skill_fetch plan-request-gate`): produce a requirements document and a work plan, put them where this
methodology says (CRDM: committed under `docs/proposals/`), hand both over as
absolute GitHub permalinks, and **stop until sign-off is recorded on the
issue**. The definition of a requirement both methodologies share is
the `requirement-definition` skill (`skill_fetch requirement-definition`).

### Self-declared genre

The mirror of `"Migration record: …"` below. Some documents say what they are in
their own first line, and a **proposal** or a **design document** argues for a
change that does not exist yet — which is a feature request whichever category
its sentences fall into.

- "Proposal: …" as a document's OPENING line
- "design document for …"

Anchored to the opening line. On the adjudicated corpus an unanchored
`proposal` adds no false alarm and catches one more item (a change register
for pipeline changes not yet built). The anchor stays until an owner decides,
because changing a detector to fit its own 27-item eval set is tuning to the
test.

## What is NOT a feature request

Do not trigger CRDM for:

- "Write the next section of chapter 3" — content authoring (but "**plan** the
  next section" is a plan request — see §"A request for a plan")
- "Fix the typo in the overview" — content editing
- "Run content_validate" — tool invocation
- "What does this block kind mean?" — information request
- "Review chapter 5" — content review within existing workflow
- "Create a bean for …" — work-plan management
- "Migration record: …" — a record of work already DONE, not a request for
  work; the tense is the signal
- Bug reports about existing features (unless they imply a redesign)

## On detection — what to do

Do NOT use the term "CRDM" with the user. It is internal methodology jargon.

**If new session** and the first request is a feature:
1. Acknowledge the request as a feature/capability change
2. Explain that you will help them work through the requirements before building
3. Start Phase 1 (needs assessment)

**If existing session** and the user is already in a CRDM cycle:
1. Incorporate the new request into the current requirements document
2. Continue with the current phase

**If existing session** and the user is doing content work (not in CRDM):
1. Synthesise what you have heard as a feature need
2. Ask the user:
   - "This sounds like a platform change rather than content work. Would you
     like to pause and work through the requirements now, or should I note it
     for later?"
   - If **pause**: enter CRDM Phase 1, return to content work when done
   - If **later**: create a work item with as much context as possible, linking to
     any relevant GitHub issue

## Issue association

Feature work should be linked to a GitHub issue:

1. **Scan open issues** for a match — search by title/body keywords
2. **If match found** — ask user: "This looks related to #NNN — should I add
   your requirements there?"
3. **If no match in open issues** — scan recently closed issues
4. **If no match at all** — ask the user to create an issue (do NOT create
   without permission)
5. **Do not proceed without an issue link** — the issue is where stakeholders
   do feature sign-off; without it, there is no review surface

Requirements may span multiple issues. The agent should link to all relevant
ones and note the relationship.

## After implementation

When a PR is merged that addresses a feature from this process:

1. **Post a summary comment** on the linked GitHub issue describing what the
   PR accomplished
2. **PRs are for code review** (agent and human coders, code reviewers)
3. **Issues are for CRDM stakeholders** — the requestor, the BA, and updates
   from the coding team for feature sign-off
4. Many work items per issue — they are not synonymous

## A feature is a COLLABORATION you are joining, not a fix you are making

When a feature comes up in conversation, it starts or joins a collaborative
design between this user, other users and authors, and other agents. It is
not a one-off fix: put it into epics and stories, create or update the
artefacts it needs, and link them from the owning harness's `docs/` page.

### The default that is wrong

A feature surfaces mid-conversation, the agent understands it, and the agent
builds it, with the conversation standing in for requirements. Everything
needed to review the decision — the alternatives, the reason, who else it
affects — stays in a chat log nobody else will read.

### What to do instead

**1. Assume the conversation is not the first.** Before treating a feature as
new, look for the collaboration it belongs to: an open issue, an epic, a work item,
a sibling session's branch, a spec. This repository has many of each and they
are cheap to search. A feature that arrives without a home usually has one.

**2. There are OTHER PARTICIPANTS, and they are not all present.** Other
authors, other users, other agents working other branches. Two consequences:

- the record has to be legible to somebody who was not in the conversation —
  which is what the issue is FOR, as against the PR (code review) and the
  work item (work plan);
- a sibling session may already be solving it. Check before you build, and if
  their answer differs from yours, that is a design discussion to have on the
  issue rather than a merge conflict to win.

**3. Structure it: epics and stories, not a task.** A feature that is worth
doing is worth a place in the roadmap. This store's hierarchy is
`milestone → epic → feature → task`, and `check-bean-parents` enforces that
every open work item has a home. A feature filed as a bare task with no parent
lands in the roadmap's Miscellaneous section, where it stops being planned.

**An epic cannot parent an epic here.** When the subject already has an epic,
the new work is a FEATURE under it — a second epic beside it splits one
subject across two roots, which is how a roadmap becomes unreadable.

**4. Write the artefacts, and LINK them from `docs/`**, because an artefact
nobody can navigate to is one nobody reads. The harness that owns
the capability owns the link — so a change to cat-harness's
pipeline is linked from cat-harness's `docs/`, not from wherever the agent
happened to be working. Which harness owns it is usually answered by which
layer declares the directory the change lands in.

### The test

> **If this session ended now, could somebody who was not in it pick the
> feature up — find what was decided, what is still open, and who else is
> affected — without reading the chat?**

If the answer is no, the collaboration has not been joined yet, whatever has
been built.

### What this does NOT mean

It does not mean every small change becomes an epic. The trigger is the same
one `opening-brief` uses: **irreversibility and surprise**, not size. A
one-line fix to a typo in a generated file is a fix. A one-line change to a
schema that three layers resolve against is a feature, because other people
have to live with it.

Nor does it mean stopping work to do paperwork first. `continual-progress`
still holds — branch, commit, push, open the PR from commit #1. The point is
that the *record* is collaborative, not that the *work* pauses.

## Related work first

When a requirement is **initiated or updated** in chat, find the related work before anything else. That means work items, issues and open PRs, each categorized and summarized, followed by one question to the user about whether and how to coordinate. The procedure is `related-work-coordination` (opt-in `cat-harness.sdlc`), and `crdm-issue-linking.bpmn` calls it as `Process_RelatedWork`.
