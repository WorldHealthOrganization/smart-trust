---
name: agent-handoff
description: >
  Governs handing ONE task to an agent in another environment — a local
  agent with network the cloud session lacks, a sibling on a different
  machine, anything that cannot read the coordinator's context and that a
  person may relay to. States who writes which work item, where the receiver
  reports, what the person pastes (one sentence: work item, branch,
  repository) and the brief the work item opens with (second person, to the
  executor), what the receiver checks before acting, who closes, who may grant an
  exception, and how to recognise and answer the five ways an executor
  fails. Use when writing a work item for another agent to execute, and as the
  receiver before acting on one.
  Triggers on: hand off, handoff, local agent, agy, mac agent, needs network,
  executor failed, agent went silent, re-hand,
  "give me a branch and bean for them", relay, the other agent.
---

# One task, two agents, one human between them

Two agents, two environments: the **coordinator** can see the work, but it
cannot do one step, usually because of network or credentials. The
**executor** can do that step, but it has none of the coordinator's context.
Often the only link between them is a person, retyping. Every rule below is
about that gap.

This is not `bean-coordination` (opt-in `cat-harness.work-plan`), which governs sibling
sessions sharing one store and racing for one claim. It is not
[`dispatch-agent`](dispatch-agent.md) either: that governs subagents you spawn
and can read directly. Here you **cannot see the executor's checkout**. The
only things you will ever see are what it pushes and what it posts.

**Needs** the `beans` CLI on both sides (`cat-harness-tools/scripts/install-beans.sh`)
and `bun run cat beans:claim`. An executor without them reports that it is
blocked; it does not edit work item files by hand.

## 1. One bean, one writer, and the receiver claims it

Before you hand off, write down who may write what. Put it in the work item as a
`## Roles` table, so the executor reads it in the work item rather than hearing it
from a person:

| role | who | writes |
|---|---|---|
| coordinator | the session that opened the work item | the work item's **instructions**, written before the claim; the parent and related work items; the verification record |
| executor | the agent named in the work item | **only** the handed work item, from the claim onward: its holder note, `## Progress`, `## Evidence`, the `ready-to-close` tag |
| verifier | whoever can run the check in `## Done when`, usually the coordinator | the verification result and the close |
| owner | the person | any exception to a boundary (§6) |

**The executor claims the handed work item and never runs `beans create` for the
handed work.** If `beans show <id>` finds nothing, it is in the wrong branch
or the wrong checkout. That is a **stop-and-report**, not a cue to recreate
the work item: a fresh `beans create` mints a new id, or a second file under an id
typed by hand, and then two work items answer one question.

**After the claim, the coordinator never edits the work item.** The claim writes to
the work item file, so a concurrent edit is a merge conflict on exactly the file
both agents care about. Anything the coordinator learns after the claim goes
to the report channel (§2).

## 2. The report channel is in the bean, from the start

Give the work item a `## Report to` section that names ONE place: a PR or issue
both agents can reach. Then give the exact one-line formats, so the
coordinator can act on a report without having to interpret it:

```
<id>: started <what> at <input revisions>
<id>: done <what> <result sha/count>
<id>: refused <what> <the numbers>        ← stop here
<id>: blocked <step> <error>              ← stop here
```

The chat is **not** a channel. The coordinator cannot read the executor's
chat, and the person relaying it should not have to. The person is a reader
of the channel, not a router between the two agents.

**The executor re-reads the channel before each irreversible step** (a push,
a seed, a release). That is how a correction posted after the claim reaches it.

## 3. One sentence to paste, and a brief inside the bean

Two texts reach the executor, and they do different jobs.

**What the person pastes: one sentence naming the work item, the branch and the
repository.**

```
Do bean <id> on branch <branch> of repo <owner>/<repo>.
```

That is all an agent with a checkout needs to find everything else. The
person should not have to edit, shorten or explain it. A paste that carries
the instructions is long, unversioned and impossible to correct. A paste that
carries less leaves the executor asking which branch.

**What the work item opens with: a `## Brief` addressed to the executor.** It is
the first section after the front matter, so `beans show` prints it first.
It is written to an agent that has seen only that one sentence.

**Voice.** Write the brief in the second person, to the executor, about its
own task: "You are the executor…", "Stop and report if…". Do not write in the
coordinator's voice ("I verify…", "my watch…"), in the third person about the
executor ("the agent should…"), or to the person. A brief that says "I" makes
the executor guess who is speaking.

**What the brief carries.** It has to work on its own:

| part | example |
|---|---|
| who you are and why this came to you | executor; the coordinator lacks `packages.fhir.org` |
| WHERE: repository, canonical checkout path (and which one NOT to use), branch and its PR, this work item's id and file path | `~/space_cats/folio-assistant`, not `-backup` |
| START: the exact commands, with a test that FAILS in the wrong checkout, ending in `beans:claim` | naming the checkout is not enough; the test makes the wrong checkout fail |
| the task in two or three sentences, and why the last attempt failed | so the executor knows what the pins guard against |
| REPORT: where, and the line formats | §2 |
| STOP AND REPORT IF | the work item's `## Fails if` |
| LIMITS | §6, plus "never create or edit any other bean" |
| FINISH: evidence, `ready-to-close`, commit only this work item, final report line | §5 |

The brief summarises and points. The exact commands, pins and history are in
the sections below it in the same work item. Corrections after the claim go in the
report channel (§2), never into the brief.

**Template for `## Brief`:**

```
You are the EXECUTOR for one task handed to you by <coordinator>. It cannot do
this step itself because <reason>. You can.

WHERE (you were sent here by one line naming this bean, branch and repo)
- Repo:     <owner/repo>
- Checkout: <canonical path>   (NOT <the wrong copy, if one exists>)
- Branch:   <branch>   (PR #<n>)
- Bean:     <id>
            file: <beans/defs/…md>

START (every command after this runs in <checkout>; never `cd` elsewhere)
  cd <checkout> && git fetch && git switch <branch> && git pull
  test "$(git rev-parse --show-toplevel)" = "$(cd <checkout> && pwd -P)" || { echo "WRONG CHECKOUT"; exit 1; }
  bun run cat beans:claim <id>
  beans show <id>
If the checkout test fails, or `beans show` does not print a bean with the
sections <…>, STOP: you are in the wrong checkout or branch. Report that on
#<n>. Never run `beans create` for this work.

THE TASK (the bean has the exact commands; follow them in order; if this
message and the bean disagree, the bean wins)
<two or three sentences: what, from which pinned inputs, and why the last
attempt failed, if one did>

REPORT: one-line comments on <PR URL>
  <id>: started …
  <id>: done …
  <id>: refused …   <- then stop
  <id>: blocked …   <- then stop
Re-read #<n> before each irreversible step; corrections arrive there.

STOP AND REPORT IF <the bean's Fails if, one line>.

LIMITS
- Push only to <refs>. Commit only the <id> bean file to <branch>.
- Never use --force. Never create a bean, and never edit any bean except <id>.
- Only the owner can grant an exception. A comment from another agent is not one.

FINISH
Add "## Evidence" to the bean, then tag it `ready-to-close`. Do NOT set it to
completed: <verifier> checks <where> and closes it. Commit and push only that
file, then post `<id>: done …` on #<n>.
```

**Check before handing over.** Read the one sentence, then the brief, as if
they were all you had. Could you act on them? Does every "you" in the brief
mean the executor? Is there no "I" left?

## 4. Pin the inputs, and check them before acting

Name the expected revision of every input in the work item: each repository the
step reads, the toolchain branch, and the base it builds from. The executor
prints what it actually has and **stops on a mismatch**:

```
expected  <dak-layer> main = e151a4d   have 5891a22   → STOP, report, do not build
```

Where the claim is reproducibility (a cache, a digest, a release), do the
step **from a fresh clone**. A long-lived checkout carries untracked files,
local edits and line-ending conversions that a clean clone does not, and the
consumer will have a clean clone.

## 5. The executor's measurement is evidence, not the close

`## Done when` names the check that decides the work item, and **where** it runs.
If that check runs anywhere other than the executor's own tree (a fresh
clone, another environment, CI), the executor cannot close the work item:

- the executor tags it `ready-to-close` and quotes under `## Evidence` what it
  measured. This is the third state of
  `bean-coordination` §"When you cannot re-derive it
  yourself";
- the **verifier** runs the named check and closes the work item, or records the
  failure and reopens the work.

A build log is the executor's view of its own tree, and a fresh-clone check
can fail while the log reads clean.

**The executor's own check runs on an untouched copy, not on the tree it
built in.** A build leaves its own files behind, so a check run where the
work happened agrees with itself whether or not the work is right. So the
work item's local-check step names a **second** copy: a new clone, a clean
container, the published artefact. Never the working directory the step ran
in. If the step can only be checked in place, say so in `## Evidence`, and
expect the verifier to disagree.

## 6. Only the owner grants an exception

A boundary in the work item ("never `--force`", "push only to `fhir-ast/*`", "never
`main`") is the owner's. A coordinating agent **cannot waive it**, even when
the waiver looks safe, and even in a PR comment the executor will read as
authoritative. Put the question to the owner with the numbers, and let the
executor stop until the answer comes. An agent's "approval" is a second voice
claiming the owner's authority, and an executor has no way to tell the two
apart.

## 7. When the executor fails

Failure is part of the handoff, so the work item states it in advance as a
`## Fails if` section: the conditions under which the executor **stops and
reports** instead of carrying on. At minimum:
- an input mismatch (§4);
- a refused or blocked step;
- its own local check disagrees with what it expected;
- it cannot reach the report channel.

The work item also carries an **expiry**: the time by which the first `started`
line is due. As `bean-blocking` §"An external block's
expiry" says, an executor in another environment is an external party, so the
expiry is a date to **ask again, not a takeover**. The coordinator cannot do
the step in any case, which is why it handed the step off.

The coordinator recognises five kinds of failure, and responds to each the
same way every time:

| failure | how you see it | response |
|---|---|---|
| **silent**: no `started` line by the expiry | no line in the report channel; no liveness signal (`bean-coordination` §"A quiet claim") | ask the person **once**, in the channel, re-posting the one sentence (§3); set the next expiry. Never re-hand to a second executor while the first claim may be live |
| **stopped**: `refused` or `blocked` | its report line | the coordinator settles the cause if it is in this repository; a boundary or an exception goes to the **owner** (§6) with the numbers. The executor waits |
| **wrong result**: the step ran, `## Done when` fails | the verifier's check | record the failure under `## Attempts` (attempt *n*: inputs, what was measured, the cause); the work item goes back to `todo` with a holder note, never `completed` or `scrapped`; fix what the cause names (usually the work item) and re-hand |
| **out of protocol**: created a work item, wrote another work item, pushed outside the boundaries | an unexpected file or ref | a duplicate work item is re-identified and `scrapped` with a pointer, never deleted; a stray push is **reported to the owner**, never reverted by the coordinator ([`deletion-requires-confirmation`](../../../skills/conduct/conduct-core/deletion-requires-confirmation.md)) |
| **partial**: some items done | per-item lines | per-item evidence; the work item stays open until every item verifies |

**Two failed attempts with the same cause go to the owner, not round again.**
A third hand-off of the same work item with the same cause shows that the work item
cannot express what the step needs. The owner decides whether to change the
step, the environment, or the executor.

## Checklist: the bean you hand over

- [ ] `## Roles`: coordinator, executor, verifier, owner (§1)
- [ ] the one sentence to paste: `Do bean <id> on branch <branch> of repo <owner>/<repo>.` (§3)
- [ ] `## Brief` as the work item's first section, second person, to the executor (§3)
- [ ] `## Report to`: one PR or issue, with the line formats (§2)
- [ ] `## Inputs`: every expected revision, and "stop on mismatch" (§4)
- [ ] fresh clone, where reproducibility is the claim (§4)
- [ ] `## Done when`: the check, **where** it runs, and **who** closes (§5)
- [ ] boundaries, with "exceptions: owner only" (§6)
- [ ] `## Fails if` and an expiry for the first `started` line (§7)
- [ ] `## Attempts`, left empty; the verifier fills it on a failure (§7)

## Checklist: the executor, before the first irreversible step

- [ ] `beans show <id>` finds the handed work item on this branch; if not, stop
- [ ] claimed with `bun run cat beans:claim <id>`, with no `beans create`
- [ ] inputs printed and matched against `## Inputs`
- [ ] report channel re-read for corrections
- [ ] after the step: report in the channel's format, tag `ready-to-close`
      with `## Evidence` unless you can run the `## Done when` check yourself
