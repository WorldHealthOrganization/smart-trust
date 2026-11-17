---
name: todo-manager
description: >
  Maintain and display work-in-progress task lists using the `beans` CLI
  issue tracker. Track implementation progress, open tasks, missing
  artifacts, and blocked items across a session.
allowed-tools: Read Grep Glob TodoWrite AskUserQuestion
satisfies:
  - "req:agent-workflow#work-is-visible"
graph-typologies:
  - beans
  - board-positions
  - boards
  - todos
---

# Session Task Manager (`beans`)

> **Disambiguation:**
> - `beans` (`todo-manager`, this file) = the agent's **session work-plan**.
>   Managed entirely via the `beans` CLI issue tracker (data stored in `beans/`).
> - `sidecars` (`*.qa.json` and `*.witness.json` files) = **content state tracking**.
>   Work items and sidecars are NOT synonymous! Do NOT convert bulk QA queue items into
>   work items. They are completely separate workflow systems.
> - `todo-review` = triage of **content feedback** stored under
>   `feedback/<paper>/` and surfaced via the MCP `/todos`
>   dashboard. That is paper-content scope, not session scope.

Instead of an in-memory list or markdown checklists, we manage session work and cross-agent coordination using the `beans` CLI issue tracker.

**A work item is a memory record with more structure** (owner, 2026-11-03,
ruling Q17; the schemas are `memory-record-core` and `bean/1.0.0` in
cat-harness-tools `schemas/kg/memory-record.ts` and `schemas/sdlc/bean-graph.ts`).
It carries what every kept memory carries (an id, a title, tags, when it was
made and changed) and adds a status, a type, a priority, a parent and what it
blocks. So the memory Tools work on it as on any memory record:
`memory_note` and `memory_checkpoint` add a dated entry, `memory_recall` reads
them back, and the work-plan store adds what only a work item needs (`get`,
`list`, `create`, claiming). The glossary defines the term: **Work item**,
narrower than **Memory record**. The program and its files keep the name
`beans`; in prose, say *work item*.

This skill holds the **work item mechanics**: installing the CLI, the STRICT check
before `beans create`, the fallback when the CLI is absent, the status
vocabulary, and the coordination rules below. Report formats are elsewhere:

- `opening-brief.md` (opt-in `cat-harness.sdlc`) — what you say **before** starting a
  work item or a topic.
- `turn-reporting.md` — what you say **during and after**
  each turn, including the STRICT "next"-line rule.

## Installing beans (fresh sandbox / cloud container)

`beans` is the [`hmans/beans`](https://github.com/hmans/beans) Go binary — a
flat-file issue tracker storing issues as markdown under `beans/`. Cloud
sandboxes do **not** ship it, so reinstall on demand (Go ships in the sandbox):

```bash
cat-harness-tools/scripts/install-beans.sh          # idempotent; installs into a PATH dir
# equivalently, the one-liner it runs:
GOBIN="$HOME/.local/bin" go install github.com/hmans/beans@latest
```

Note: the npm package named `beans` is an unrelated abandoned tool — do **not**
`npm install beans`. Verify with `beans list && beans check`.

## What the session-start sweep emits, and why in that order

A session-start hook runs the sweep where a hook runs at all. **It installs the
CLI when it is genuinely missing** — bounded and quiet, falling through to the
degraded reader rather than failing the hook — and prepends the install
directory when the binary is already there, so a second session does not
reinstall. If the sweep still reports the CLI missing, it could not be installed
there. The sweep installs rather than recommends, because an instruction
somebody has to act on is weaker than the act itself.

The order is not arbitrary:

1. **Interaction preferences — first**, because they change the *form* of every
   question that follows. A question asked before them may have to be asked
   again.
2. Work-plan priming and the open list.
3. **The roadmap.** A flat list of a hundred ids in creation order is **data,
   not a plan**; the milestone/epic structure is what lets an end-of-turn report
   say what is *next* and why.
4. **The commands the person can run themselves**, the interactive browser
   first. An agent cannot drive a TUI on somebody's behalf, so the only useful
   thing to do with one is print it where they will see it — with a
   copy-pasteable line whose path and branch are **computed, never written in**.
5. Default-branch delta, sibling branch activity, CI health.

**Heavy triage of new commits belongs in a background subagent, not the
foreground.** The sweep's job is to tell you what changed, not to spend your
first minutes reading it.

## Core Directives for Sessions

1. **A session is a LOG, never an epic or a milestone.** Do **not** create a
   `Session: …` work item. What one sitting did is recorded in two places that
   already exist and are already read: the **PR body** (`## Intent` /
   `## Session results`, `session-intent`) and a **work item
   note** on each work item you worked — `bun run cat beans:note <id> --title "…"`,
   written to the declared `notes` directory of `beans/beans.json` and keyed by
   branch, so it is one file per session per work item by construction
   ([`bean-coordination`](bean-coordination.md) §"Adding to a bean"). See
   §"A session is a log, not a parent" below for why.
2. **Every todo is a work item, parented by SUBJECT.** Each task, probe or action
   item is a work item (`--type task`) under the epic whose subject it is —
   §"WHICH parent" — not under anything representing the session.
   `beans create "<Task Title>" --type task --parent <subject-epic-id>`
3. **No manual `.md` checklists:** Never use `session-beans.md` or raw Markdown `- [ ]` checklists to track global tasks. Always use the `beans` CLI to prevent namespace pollution and maintain the official project tracking.
4. **Check before you create:** `beans create` is **not** idempotent. Run the existence check below before every `beans create` — no exceptions.
5. **Brief before you work:** claiming a work item records *which* item is taken; the opening brief records what it is taken **for**. Write it before the first tool call, in the chat. See §"Opening brief" below.
6. **Write work items to the work-plan store, never into a code PR:** create, claim, note and status changes go to the store through its Tool. The store's operations are in [`work-plan-store`](work-plan-store.md); how the Tool in use performs them (today the git state branch, [`work-plan-store-git-branch`](work-plan-store-git-branch.md)) is on that Tool's page. Do **not** commit work item files to code PR branches on `main`.

## Where beans live

The work plan is a data store with a contract,
[`work-plan-store`](work-plan-store.md), and this skill uses it only through
that contract's operations (`get`, `list`, `create`, `update`, `note`,
`history`, `positions`). Which Tool backs it is the deployment's choice
Today every checkout uses the git state branch;
how to mount it, which commands perform each operation and how changes are
pushed are on its page,
[`work-plan-store-git-branch`](work-plan-store-git-branch.md).

- **Never bundle work items in code PR commits.** Code PRs touch code and
  documentation; work item changes go to the store, which keeps the work plan
  current for every session without merge conflicts or spurious CI runs.

## Check before you create — `beans create` is not idempotent (STRICT)

`beans create` mints a **fresh random ID on every call** and dedupes on
nothing. Re-running a work-plan step is therefore *not* a no-op — it creates a
second work item. **Before every `beans create`, check whether the work item exists:**

```bash
T="Prove Foo.bar"
beans list --json --search "title:\"$T\"" | python3 -c '
import json, sys
t = sys.argv[1]
m = [b for b in json.load(sys.stdin) if b["title"] == t]
print(f"{len(m)} exact match(es)")
[print(" ", b["id"], b["status"]) for b in m]' "$T"
```

- **≥ 1 match** → do **not** create. Claim the existing work item instead, with
  **`bun run cat beans:claim <id>`** — which reads the shared store first,
  refuses a work item a sibling holds or one already closed, and records a holder
  note so the next session's check can see you.

  **Not `beans update <id> --status in-progress`.** It writes no holder note,
  so the claim is invisible to `beans:claim`'s own `already-claimed` check.

  Read the outcome — three of them are refusals, and `held-unknown` means it
  could not tell a live sibling from an abandoned claim:
  [`bean-coordination.md` §"`bun run cat beans:claim <id>` — how it behaves"](bean-coordination.md).
- **0 matches** → run the **semantic** check before creating:

  ```bash
  bun run cat lsi:near "$T"          # add --body "<first paragraph>" when you have one
  ```

  The exact-title check above catches the same WORDS; this catches the same
  work in other words. It folds the title into an LSI index of every work item (all
  statuses — a completed one is often the answer) and prints the nearest five
  plus the closest epic. **Read every hit marked `←` (cosine ≥ 0.7) before
  creating.** If one is the same work, claim or reopen it rather than create;
  if it is related, create and say so in the body. The score proposes; whether a hit IS the same work is your call
  (method [`lsi`](../../../methodologies/lsi.md), refusal 3).
- **A work item ABOUT ONE OBJECT is keyed on the object, not the title.** When the
  work targets a single named thing (a Lean declaration, a block label, a
  file), titles drift: "Prove Foo.bar", "PROVE(lean): Foo.bar", "close sorry
  in Foo.bar". Neither check above is guaranteed to pair them, and generator
  re-runs are the usual source of such duplicates. So write the
  key into the work item as a line of its own, `Target: lean:Foo.bar` (or
  `block:<label>`, `file:<path>`), and before creating search the WHOLE store
  for that line, archive included, because a completed work item is often the
  answer:

  ```bash
  grep -rlF "Target: lean:Foo.bar" beans/defs/   # the archive is beans/defs/archive/
  ```

  A hit is the same work: claim it, reopen it with a note, or link to it.
  **A generator that files work items MUST write the key and run this check**,
  since a re-run is exactly the case the title checks miss.
- **Still new** → `beans create "$T" --type task`, under the epic `lsi:near`
  printed if it fits (§"WHICH parent — the criterion nobody wrote down" below).

`--search` is a fuzzy Bleve query, so the exact-title comparison inside the
pipe is load-bearing — do not drop it and trust `--search` alone.

**Why this is STRICT.** Because `create` is unconditional, an agent that
re-runs a work-plan step in a loop mints thousands of duplicates: the sweep and
the backlog then read mostly noise, duplicates can collide with real work item ids,
and corpus searches over `beans/` are inflated. An unguarded `create` is what
the rule prevents. It is platform-level so every folio inherits it.

## Check before you UPDATE — `--body-file` REPLACES the body (STRICT)

`beans create` is not idempotent; `beans update` is not additive. They are
different failures and both cost a durable artefact, so they sit together.

**A work item's body is an append-only record of who found what, when.** Every note
in it is dated and signed, and later notes cite earlier ones. Replace the body
and you have deleted findings that other work items, commits and issues point at.

`beans update` offers four ways to write one, and **only one of them appends**:

| flag | what it does |
|---|---|
| `--body-append <text>` \| `--body-append -` | **appends.** `-` reads stdin |
| `--body-file <path>` | **REPLACES the whole body** with the file |
| `--body <text>` \| `--body -` | **REPLACES** |
| `--body-replace-old/-new` | replaces one substring; leaves the rest |

`--body-file` replaces with **exit 0, no warning, no diff, no prompt**: nothing
in the output distinguishes it from an append.

**For a long, multi-paragraph note, use `--body-append -`:**

```bash
beans update <id> --status completed --body-append - <<'NOTE'
_2026-09-22T06:51:22Z_ — what you found, and how you know it.
NOTE
```

Do not reach for `--body-file` because the note is long. (`beans create`
**rejects** `--body-file -` with a heredoc, so the two subcommands also
disagree about that flag.)

The timestamp prefix is an **authored convention, not a CLI feature** — no flag
adds it. Write it yourself or the note joins the previous paragraph undated.

**Recovery, if it has already happened.** The store is committed, which is the
whole reason this is survivable: `git show HEAD:<bean-file>` returns the body
as of the last commit, and the lost notes can be reassembled with the new front
matter. Recover from **git**, not from your own scrollback — a transcript is a
copy you made, and the repository is the artefact. Then say plainly what was
lost and restored; a silent repair leaves the next reader unable to tell a
reconstruction from an original.

## WHICH parent — the criterion nobody wrote down

**A work item's parent is the epic whose SUBJECT it is, not the epic you happen to
be working in.**

**Nothing catches a wrong parent.** `check-bean-parents` tests exactly two
things: that an open work item HAS a `parent`, and that the parent NAMES A WORK ITEM
THAT EXISTS. A work item filed under the wrong epic satisfies both, so it is
textually clean, the guard is green, and it is only findable by a person
reading the roadmap. **The check cannot distinguish a right parent from a
wrong one, so the criterion has to live here or nowhere.**

### How to choose

1. **`beans list` and read the EPICS first** — there are many, each with a
   thematic scope in its title. Do this BEFORE `beans create`, at the same time
   as §"Check before you create"; both are questions about where a work item
   belongs, and both are cheaper before the file exists.
2. **Ask what the work item is ABOUT, not what you were doing when you wrote it.**
   A visualiser whose blocker is an unrecorded ingest relation is an ingest
   work item. A sticky's art is a rendering work item. The topic that makes the work hard
   is usually the right epic.
3. **When two epics both fit, pick the one whose OTHER children you would want
   read alongside it**, and say in the body why the other was not chosen — a
   parent is a claim about where somebody should go looking.

### A session is a log, not a parent

Do not create a `Session: …` epic or milestone. It turns the roadmap's top
level into a diary, and:

- **An epic is a claim about where to look for a SUBJECT.** A session epic
  points at one sitting, which ended; nobody looks there for the work, so its
  children are lost to the next agent filing by subject.
- **It defeats the guards.** `check-bean-parents` passes a task parented to a
  session epic, because the parent exists and is an epic. The wrong parent is
  textually clean.
- **Its status lies.** A session epic stays `in-progress` after its session
  ends, so it is a stale claim from birth, and the quiet-claim findings fill
  with logs.

**Where the log goes instead** — each already declared, already read:

| what the session wants to keep | where |
|---|---|
| what it intended and what it got done | the PR body, `## Intent` / `## Session results` (`session-intent`) |
| what it found about a work item | a note: `bun run cat beans:note <id>` → `beans/notes/<bean>--<date>--<branch>.md` |
| a survey of a commit window it read | `beans/surveys/` (`session-survey`) — only if it surveyed one |
| a handover to whoever comes next | a note on the work item being handed over, plus `handover-report` |

**A handover is the same case.** A `Handoff: …` or `Handover: …` work item typed
`epic` or `milestone` is a session log with a different title.

**`bun run cat health` reports it** — the `bean-store` check's
`bean-session-log-roots` finding names every OPEN work item whose title starts
`Session`, `Handoff` or `Handover` and whose type is `epic` or `milestone`.
Report-only: the remedy is a person's (or a reviewed
[`work-plan-restructure`](work-plan-restructure.md) plan's) — re-parent the
children by subject, move the narrative into a note, then set the log to
`completed` or `scrapped` with a pointer. **Never `beans delete` it**: other
work items, commits and PRs cite its id.

## A GOAL is a `milestone` bean, and an epic joins one by parenting to it

A "goal-scoped" queue needs the goal to exist as an object, or every review
re-derives the classification from scratch.

> **A goal is a `milestone` work item, in the owner's own words, and the epics
> serving it are parented to it.**

```sh
beans create "<the goal, verbatim>" --type milestone   # after the existence check above
beans update <epic-id> --parent <milestone-id>
```

Three properties make this the cheap answer rather than a new mechanism:

- **The type exists** and `check-bean-parents` permits an epic under a
  milestone.
- **`beans roadmap` groups by `parent:`**, so the goals become the roadmap's
  top level the moment the epics are parented — which is what a roadmap was
  always for.
- **"Prioritise against the goals" becomes a query**: walk down from the
  milestone. An item under no goal is then *visible* as such, which is itself
  the finding a review wants.

**Verbatim, and this is not a style note.** A goal is the owner's sentence, and
a tidied paraphrase is a different claim that nobody agreed to — the same rule
[`confirmation-waiver`](../../../skills/conduct/conduct-core/confirmation-waiver.md) applies to a waiver's `quote`,
and for the same reason: the reader auditing the classification has only that
string to check it against. **If you do not have the owner's words, you do not
have the goal** — record the paraphrase as a paraphrase, say so, and ask.

**This does not conflict with filing by subject** (§"WHICH parent"). A
milestone sits ABOVE the epics; a work item is still parented to the epic whose
subject it is, and the epic is parented to the goal it serves. Two levels, one
criterion at each.

---

## A WORK PLAN is an epic or milestone that names the process it runs

Owner, 2026-11-05: *"At the beginning of a large process (like creating a new
collaborative document, or adding software features,) there should / may be a
work plan. Not every process needs a work plan. Docs/proposals/ once approved
become workplans"*, and on the card, **"Epic is the plan"**.

So a work plan is not a new kind of file. It is the epic (or milestone) that
already groups the work, with two tags saying what it runs and where it came
from:

```sh
beans update <epic-id> --tag process:<bpmn:process id>        # what it instantiates; repeat for several
beans update <epic-id> --tag proposal:<repo-relative path>    # the approved proposal it was made from
beans list --tag process:<bpmn:process id>                    # every plan that runs that process
```

- **Tags, not front-matter fields.** The `beans` CLI drops every front-matter
  key it does not know on its next write (measured 2026-11-05), and keeps tags.
- **A `process:` tag is what makes it a plan.** A `proposal:` tag alone does
  not: a proposal with no process to run is not a plan yet. A plan filed as a
  feature or a story is reported, not refused (the work-plan schema in the
  tools layer reports it).
- **Start the process under the plan**: `workflow_start` with `plan: <epic-id>`
  (`bun run cat workflow:start <process> <subject> --plan <epic-id>`). The
  instance names its plan, as it names its work item; the plan does not list
  its instances, because where the work is lives in the instances.
- **Not every process needs one.** A small process tracked by one work item
  runs with no plan, exactly as before.
- **The work items under the plan are its work**: parented to the epic, as
  always. A work item is a memory record with more structure; a work plan is a
  work item that says which process it runs.

The work-plan page marks each plan in its tree with its process, its proposal
and how many instances are running under it.

### Approving a proposal seeds its plan

When the owner approves a proposal (owner, 2026-11-05, card **"Proposal seeds
plan"**), one command writes both ends, so neither is kept by hand:

```sh
bun run cat proposal:approve <path/to/proposal.md> --process <bpmn:process id> [--process …] \
    [--plan <epic or milestone id>] [--parent <goal id>] [--dry-run]
```

- **With no `--plan`** it creates an epic titled as the proposal. **With
  `--plan`** it tags that epic or milestone instead; a feature or a story is
  refused.
- The plan gets the `process:` and `proposal:` tags. The proposal's front
  matter gets `status: approved`, `approvedOn: <date>` and `plan: <id>`.
- At least one `--process` is required, unless `--plan` already names one: a
  plan is defined by what it runs.
- **Approve only on the owner's word.** The command records an approval; it
  does not decide one. Run it with `--dry-run` first and show the owner what
  it will write.
- `bun run cat proposal:approve --check <proposals dir>` checks the two ends
  against each other and reports rather than fails: an approved proposal with
  no plan, a plan id that is no work item, a plan that names no process, or a
  plan whose `proposal:` tag names another file.

---

## After you create — parent it, and re-run the guard before you push

`check-bean-parents` fails on an **open work item with no `parent`**, because such a
work item lands in the roadmap's Miscellaneous section where nobody looks for it.
Two ways past it:

1. **A multi-flag `beans update` can apply only some of its flags** and still
   report success (`-s in-progress --parent <epic>` can set the status and
   leave the parent unset). After setting several properties at once, **read
   the front matter back** —
   `grep -n "^status:\|^parent:\|^priority:" beans/defs/<file>.md` — rather than
   trusting the "Updated …" line.

2. **A work item created after your last test run is an unguarded work item.**

**So: `beans create` and the `--parent` that follows it are one action, and
touching the work item store invalidates your last test run.** Re-run at least
`bun test cat-harness-tools/scripts/tests/check-bean-parents.test.ts` before
pushing. **A green suite is green for the tree you ran it against.**

### A new bean also owes `readme:subgraphs` — and this is the most-missed step

`beans/README.md` is GENERATED and carries per-subdirectory counts, so creating
or archiving a work item makes it stale. Nothing in the `beans` CLI regenerates it,
and the gate that catches it is named for the generic case rather than for
work items:

```
Repository gates (hard) · step 65: "Every declared directory's README is current"
```

That is `readme:subgraphs:check`. Run its writer before you push:

```sh
bun run cat readme:subgraphs          # updates beans/README.md; push state via the store Tool
bun run cat readme:subgraphs:check    # must exit 0
bun run cat state:push                # when the store Tool is git-branch (work-plan-store-git-branch.md)
```

The check's name gives no hint that adding a work item dirtied it, so a session that
reads only the name looks at directories and never at the work item it just
created. Read the failing
STEP, and remember that `beans/` is a declared directory like any other.

The same shape applies one door along: **editing a skill owes
`bun run cat skill:register`**, which `skill-registration` carries in full. Both are
instances of one rule — a declared artefact has generated neighbours, and the
CLI that writes the artefact does not write them.

## When the `beans` CLI is not there — you are still not read-only

`scripts/beans-fallback.ts` writes the same store in the same layout: same
files, same front matter, same id shape, read from `.beans.yml`. The CLI reads
everything it writes once installed. There is no import step and no second
store.

```sh
bun run cat beans:fallback list --status todo
bun run cat beans:fallback show <id>
bun run cat beans:fallback claim <id>
bun run cat beans:fallback create "<title>" --status in-progress
bun run cat beans:fallback note <id> "<what you found>"
```

A read-only fallback would let a session see its plan but not claim it, so it
would do its work unclaimed.

Its `create` **refuses an exact duplicate title** and names the work item to claim
instead; the CLI's `create` does not. `--force` exists for a genuinely intended duplicate
and has to be typed.

## Check before you WORK — a checkbox is a claim, not a measurement (STRICT)

`beans create` is not idempotent, and §"Check before you create" above is the
guard. This is its twin at the other end: **a work item's stated state is a claim
somebody wrote down once, and the code has moved since.**

> **Re-measure a work item's open items against the code before you act on them.**

The cost of skipping this is not wasted effort; it is acting on a stale claim.

### The two failures this prevents, and they are different

**1. Doing work that exists.** Siblings finish items without ticking the box.

**2. Undoing a decision that was recorded elsewhere.** An open item can read
like a gap when the absence is deliberate and explained in a comment in the
file the work item is about. Doing the obvious thing then re-introduces the defect
the decision avoids. The decision is in the file, not the work item.

### What "re-measure" means, concretely

- **Run the thing** — the audit or check that measures the item.
- **Read the body, not just the boxes.**
- **Date it.** `git log -S` on the symbol or the file against the work item's
  `created_at` separates *fixed since* from *wrong when written*.
- **Read the file the work item is about**, for a comment saying why it is the way
  it is. That is where a deliberate absence lives.

### And a bean you re-measure, you record

Leave what you found in the work item, with the commits and the times — a stale
checkbox you silently worked around is one the next agent meets unchanged.
Tick what is done and name who did it; withdraw a done-when you no longer
believe, with reasons, rather than leaving it unmet. Where the work item and the
code disagree, **the code is what is true and the work item is what is wrong** —
the same rule [`AGENTS.md`](../../../AGENTS.md) states for a skill against
that file.

This is the work-plan half. The cross-session half is
[`bean-coordination`](bean-coordination.md) §"Claims are global via the branch store".

## Working with Beans

**1. Finding Tasks & Graph Analytics (`beans:query` / `bean_query`)**
Use `beans list` for simple listing, or `bun run beans:query` (and the `bean_query` MCP tool) for fast in-memory SPARQL 1.1 analytics over the work item store (loads ~1,000 work items into an Oxigraph store in ~70 ms):
- `bun run beans:query --named safe_drain_candidates`: leaves with >= 2 open siblings under their parent container (safe against `check:bean-rollup`)
- `bun run beans:query --named actionable_leaves`: open/todo leaf work items with zero open blockers, ready for an agent to claim immediately
- `bun run beans:query --named critical_path_blockers`: blockers ranked by how many open work items they directly hold up
- `bun run beans:query --named epic_burndown`: per-epic child status breakdown (total, open, completed, scrapped, and completion percentage)
- `bun run beans:query --named rollup_invariant_violations`: completed containers with open children, or in-progress containers with 0 open children
- `bun run beans:query --named stale_claims`: in-progress work items whose `updated_at` timestamp is older than 7 days
- `bun run beans:query --named unparented_open_tasks`: open non-epic work items that have no epic or milestone parent
- `bun run beans:query --named circular_blockers`: circular blocking deadlocks
- `bun run beans:query --named high_fanout_epics`: epics with high fanout (>= 15 direct children) that may need decomposition
- Arbitrary SPARQL: `bun run beans:query --sparql "SELECT ?id ?title WHERE { ?b bean:id ?id ; bean:title ?title }"`
- Export RDF graph: `bun run beans:query --export-nq beans.nq`

**2. Setting Dependencies**
You can map out sequence blockers using:
`beans update <id> --blocked-by <blocker-id>`
`beans update <id> --blocking <blocked-id>`

**3. Updating Status & Adding Comments**
- When starting work: `bun run cat beans:claim <id>` — a claim goes through the
  claim tool, never through `beans update`, so it is visible to the next
  session's check
- When completed: `beans update <id> --status completed`
- To add notes or discussion: `beans update <id> --body-append "Your note"`,
  or `--body-append -` with a heredoc when it runs to paragraphs. **Never
  `--body-file`** — it replaces the whole body, silently, exit 0:
  §"Check before you UPDATE".

**4. A work item that delivers a requirement copies its success criteria**
When a work item is part of a work plan — it delivers one or more `req:` statements
(or a plan's `REQ-###` / `FR-###`) — it names them in its body and its
`## Done when` is **copied from their success criteria**, one checkbox per
criterion, with the criterion's key. Closing the work item is then judging those
criteria. The work item ids are also listed in the requirement set's `workPlan` — a
set at `planned` with none is refused by `check:requirements`. The rule and an
example are in the content layer's `requirement-definition` skill (`skill_fetch requirement-definition`)
§"The work plan is beans".

## Archiving — two dispositions, and they answer different questions

`beans archive` moves every `completed` or `scrapped` work item out of the working
set. It **moves**, never deletes: an archived work item is still resolvable by id,
which is what makes it a disposal an agent may perform at all
([`deletion-requires-confirmation`](../../../skills/conduct/conduct-core/deletion-requires-confirmation.md)).

**There are two ways it can be driven, they are not alternatives, and a
process author needs to know which one they are reaching for.**

| | **a per-activity op** | **a periodic sweep** |
|---|---|---|
| what it is | a step inside one process — a fourth `<cat-harness.processes:bean op>` beside `claim`, `note`, `resolve` | a scheduled run over the whole store |
| the question it answers | *is **this item's** work over?* | *is **the store** still readable?* |
| what decides | the process reaching a step that means completion | a uniform, process-independent criterion — `completed` or `scrapped` |
| what the archive then records | **why** — "archived because the release shipped" | **when** — "archived in the sweep of that date" |
| what it cannot do | reach a work item no process resolved | know that *this* release is what terminated *this* item |

### Why neither replaces the other

**The op cannot cover the store.** A work item resolved by a process with no
archive step, by hand, or by a sibling session, is never reached; coverage
would depend on every path having been drawn, and paths are added faster than
they are wired.

**The sweep cannot carry authority.** It knows only status. It cannot say
that a requirement was archived *because the stakeholder signed off*, which
is the fact an audit of the CRDM close would want — and `crdm-close.bpmn` is
precisely where that authority exists.

So the honest shape is: **the sweep is the floor, the op is the exception.**
The sweep guarantees the store stays readable whatever anyone forgot; an op
is worth adding only where a process's completion is *itself* the reason, and
recording that reason is worth the extra edge on the diagram.

### Where this sits against `resolve` — two layers, not two spellings

`resolve` is the **process** saying *"I am done with this item."* Archiving
is the **store** saying *"this is no longer in the working set."* They are
different layers and they are allowed to be far apart in time — which is why
`resolve` must never imply an archive, and why the sweep is still needed.

**The per-activity op:** a step carrying
`<cat-harness.processes:bean op="archive"/>` moves the instance's work item into
`beans/defs/archive/`, with a line saying which process closed it. It does so
only once the process has finished and the work item is `completed` or `scrapped`;
otherwise it leaves the work item in place with a note saying why, because
`check:bean-archive` allows only terminal work items in the archive.

### Where the bean ops live — OPEN and CLOSE, called by every process

The claim, resolve and archive ops live in two called processes, and nowhere
else, so no process can open a work item it never closes:

| | process | what it does | ops it carries |
|---|---|---|---|
| **OPEN** | `Process_BeanOpen` (`sdlc/processes/bean-open.bpmn`) | check before you create, create, whose work item, claim — or leave it alone | `claim` |
| **CLOSE** | `Process_BeanClose` (`sdlc/processes/bean-close.bpmn`) | outcome: complete, or scrap with reasons, then **one shared archive step**; or record the blocker and hand back | `resolve`, `archive` (and a `note` for the blocker) |

`Process_BeanLifecycle` is OPEN → work → CLOSE, calling both.
`Process_BeanDrain` (`sdlc/processes/bean-drain.bpmn`) is the
same over a queue: build the queue grouped by owner, then for each work item OPEN →
work → CLOSE, and refill when a drainer's list runs dry. A work item OPEN finds is
someone else's is marked skip on the queue, not worked.

**How a process uses them.** Call `Process_BeanOpen` where the work item becomes
the process's own — usually its first step — and follow it with a gateway
(`claimed` / `not yours`): the engine hands a called process the caller's
work item but not its end event, so the caller reads which end OPEN reached, and
`not yours` stops at an end of its own without touching the work item. Call
`Process_BeanClose` straight before **each** end the process reaches after
OPEN. Straight before matters: `resolve` counts the process as finished when
nothing but archive steps is left (`onlyArchiveLeft`), and a CLOSE followed
by more work turns its resolve into a note. `note` ops stay where the work
happens.

**A called phase does not open or close again.** A process only ever called
by another (the CRDM phases under `crdm-requirements.bpmn`) runs on its
caller's work item, so the caller opens and closes it. A process that is both run
on its own and called (`code-change-review`, `upstream-version-adoption`,
`editing-hci-validation`) keeps its own pair: nested, OPEN's claim is
idempotent and CLOSE notes instead of closing while the outer process still
has work.

**The check.** `check:bean-calls` (also run inside `check:workflow-refs`,
which CI gates) fails on a `claim`, `resolve` or `archive` op outside OPEN
and CLOSE, on a process that calls one of them without the other, and on an
entry process that names a work item by `ref` without calling both. A process
whose only marks are `note` (or a bare `<cat-harness.processes:bean/>`) and
that nothing calls is **reported, not failed**: it writes on whatever work item
its instance was started with and never decides that work item's fate.

The sweep is still `beans archive`, run deliberately — the floor under every
process that never reached CLOSE. Note the CLI prints `.beans/archive/` but
honours `path:` from `.beans.yml`; here that means `beans/defs/archive/`.

## Status Display Format

When the user asks "status" or "show beans", run `beans list` and display the
work items this session touched **under their subject epics** — the epic is the
heading because it is where the work lives; the session is a filter, not a
node:

```
## Beans this session touched (branch <branch-name>)
- [abcd] PROCESS: how an agent decides what it is doing (epic)
  - [task-124] Task A (completed)
  - [task-125] Task B (in-progress)
- [efgh] QA: verdicts, sidecars and the audited review record (epic)
  - [task-126] Task C (todo)
```

## Coordination discipline

1. **Claim before you work**, with `bun run cat beans:claim <id>`, so sibling
   sessions working the same goal do not duplicate the effort. Also check the
   open PR list for the work item id and its subject before you start: a claim
   announces the item is taken, but a sibling may already have a PR. Full rule:
   [`bean-coordination.md` §"Claims are global via the branch store"](bean-coordination.md).
   **Brief it in the same turn you claim it** —
   `opening-brief.md`. The claim tells a sibling the item is
   taken; the brief tells them, and the author, what it is being taken *for*.
2. **One source of truth per concern.** Do not fork a work item into a parallel
   `todos/*.json` queue; link to the queue from the work item instead.
3. **Move wiring and script together.** When relocating a hook-backed script,
   move its hook reference in the same change — a script without its wiring, or
   a hook reference without its script, leaves a dangling reference.
4. **Close on landing.** When the work lands, close the tracking work item and update
   any cross-repo ownership note.

## Relationship to other surfaces

- [`bean-coordination.md`](bean-coordination.md) — the cross-session claim and
  handoff lifecycle, and why a claim is not a lock.
- [`bean-blocking.md`](bean-blocking.md) — a real block carries what it waits
  on, since when, an expiry and a handoff.
- `scripts/session-start-coord-sweep.sh` — the CLI-independent session-start
  surface: fetches `origin/main` and summarises sibling branch activity. Works
  even when the `beans` CLI is absent.
- `cat-harness-tools/scripts/install-beans.sh` — provisions the CLI.
