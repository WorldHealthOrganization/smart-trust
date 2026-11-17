---
name: prepare-for-handover
description: >
  Prepare for a handover: commit and push everything you hold, then write a
  handover report that cites the commits. Use it when told a stall, timeout
  or container loss is coming ("you may stall in N minutes"), before a long
  or risky step, or whenever a steward or the owner says "prepare for
  handover". It is the producing half; `handover-report` is the format and
  `stalled-agent-triage` is the reader.
---

# Prepare for a handover

When a session stalls, what survives is what is **on the remote**: commits on
pushed branches, PRs and their comments, and work item notes. Everything else is
lost, including uncommitted edits, local-only commits, scratchpad plans,
running jobs and the chat. This skill moves the parts that matter onto the
remote, in an order where each step is worth something on its own if the
next one never runs.

**Order matters. Do it top to bottom, and push after each step.**

## 1. Commit work in progress on its own feature branch, with a brief status

For every worktree or checkout you have changed, including subagent
worktrees you own:

```sh
git -C <worktree> status --short          # see what is there
git -C <worktree> add -A
git -C <worktree> commit -m "WIP(handover): <one-line state>

Status: <what this commit holds, what is half-done, what is known broken>
Next: <the next concrete step>
Bean: <id>   PR: <#n or none>"
```

- **Commit on the feature branch the work belongs to.** Never on `main`, and
  never on somebody else's branch.
- **A red commit is fine. An unpushed one is not.** Say in the message that it
  is WIP and what is broken, so the next agent does not take it for done.
- **Mid-merge?** If the conflicts are resolved, commit the merge. If they are
  not, run `git merge --abort` and say so in the report: a half-resolved merge
  cannot be pushed, and guessing the resolution is worse than redoing it.
- **Generated files half-written** by an interrupted regenerate can be
  committed as WIP. The status line must say the regenerate did not finish.

## 2. Push every branch that has commits not on the remote

```sh
git -C <worktree> push -u origin HEAD:<branch>        # never --force
git -C <worktree> log --oneline @{u}..HEAD            # must print nothing
```

- **Push to the branch's own name.** A branch that never had a remote gets one
  with `-u`.
- **Never force-push or rebase** to make a push go through. If the remote has
  moved, merge it in (`git merge origin/<branch>`) and push.
- If a push is refused (permissions, a protected branch), stop and record the
  refusal in the report. Do not route around it.
- **Open a draft PR** for a branch that has none
  ([`continual-progress`](../../../skills/conduct/conduct-core/continual-progress.md)), so the work is findable
  from the PR list and not only from `git ls-remote`.

## 3. Note what cannot be pushed

List anything that lives only on this machine, and say for each whether it
can be rebuilt:

- running background jobs (a regenerate, a test run): what they were for, and
  whether a re-run reproduces them;
- scratchpad files: plans, logs, measurements. Copy anything worth keeping
  into the report or into a committed file;
- local tools state: the work items fallback, caches.

Secrets are never copied anywhere. Name them only.

## 4. Write the handover report, citing the commits

Use the [`handover-report`](handover-report.md) template, written as a work item
note on your work item or its epic, then commit and push it:

```sh
bun run cat beans:note <bean> --title "handover: <role> <date>" \
  --body-file <file> --branch <branch>
bun run cat beans:notes && git add -A && git commit -m "handover: <role>" && git push
```

**Cite every commit by SHA.** For each item in the report's "In flight" table,
give the branch, its head SHA as pushed in step 2, and its PR. A report that
says "the branch" without a SHA cannot be checked against reality by the
triage that reads it.

**And write a DISPATCH LINE for every unstarted item** — the fixed one-sentence
form in [`handover-report`](handover-report.md) rule 7, one line per work item,
naming a branch that does not exist yet. The report is not finished without
them, because a handover that hands nobody a way to pick the work up makes the
next reader re-derive the dispatch.

## 5. Tell whoever coordinates

One short message to the steward or the parent session: the bean-note path,
the PRs, and the one thing most at risk. That message is a pointer. The
report is the record.

## Done when

- `git log @{u}..HEAD` is empty in every worktree you touched;
- every branch with work has a PR, a draft one if need be;
- the handover report is pushed, and cites every head SHA;
- the coordinator has the pointer.
