---
name: dispatch-agent
description: Dispatch one or more background sub-agents against parallel research/build fronts with a STANDARDIZED live progress contract, and monitor them on a 2-minute heartbeat. Every dispatched agent emits consistent DID/DOING/NEXT/BLOCKERS blocks with real log output (not static "still running"); the parent extracts the latest block from each agent every ~120 s and posts one consolidated synthesis table. Use when the user says "dispatch agents", "fan out", "run these in parallel with monitoring", "give me status every 2 minutes", or when you are about to launch ≥ 2 background Agents on independent work.
user_invocable: true
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, Agent, SendMessage, ScheduleWakeup, ToolSearch, AskUserQuestion
---

# /dispatch-agent — parallel dispatch with a live 2-minute status heartbeat

The expensive failure mode of multi-agent dispatch is **going dark**: you
launch N background agents, then can't say what any of them is doing until
it completes 20 minutes later. This skill fixes that with two halves that
MUST be used together:

1. **Agent-side progress contract** — every dispatched agent emits a
   consistent, machine-greppable progress block on a fixed cadence, with
   *live* evidence (log tails, exit codes, counts), never a static
   "still working on it".
2. **Parent-side 2-minute heartbeat** — the parent extracts the latest
   block from each running agent every ~120 s and posts ONE consolidated
   synthesis table to the user.

Do not dispatch without both: an agent that skips the contract cannot be
synthesized, and a parent that skips the heartbeat leaves the user blind.

---

## 0. When to use

- Launching **≥ 2 background `Agent` calls** on independent fronts
  (research routes, per-file proofs, per-isotope compute).
- The user asks for **periodic status** ("update me every 2 minutes",
  "keep me posted", "monitor these").
- A single long agent whose progress the user wants to watch live.

For a single quick synchronous agent whose result you need before the next
step, skip this — just call `Agent(run_in_background: false)`.

---

## 1. Agent-side progress contract (PASTE THIS into every dispatched agent)

Append the block below **verbatim** to every agent prompt you dispatch
through this skill. Fill in `<LABEL>` with a short stable tag (≤ 16 chars,
kebab-case: `a3-offblock`, `ctil-root`, `a4-interface`) — the parent keys
the synthesis table on it.

````text
## PROGRESS REPORTING CONTRACT (STRICT — the parent monitors you on this)

Your label is: <LABEL>

Emit a progress block **as a plain-text assistant message** (not a tool
call) at EVERY meaningful step, and **at least once every ~90 seconds of
wall time** even mid-step. Use this EXACT shape so the parent can grep and
synthesize it:

    ### ⟦PROGRESS⟧ <LABEL> · step N
    DID: <what you just finished — CONCRETE evidence only: file paths,
         lean exit codes, real-sorry counts, git shas, row counts, the
         tail of a log. NOT "worked on the proof".>
    DOING: <the step in flight right now. If a command is RUNNING, quote
         the last 3–8 relevant lines of its output / the key live metric
         (elapsed, % done, current goal state, error so far). NEVER a
         canned "still running" — show the live log.>
    NEXT: <the single concrete next action you will take.>
    BLOCKERS: <none | the precise blocker (missing lemma name, 403, ENOSPC,
         evicted oleans, ambiguous spec).>

Rules that keep updates LIVE, not semi-static:
- **Tee every long command to a log and quote its tail** in DOING:
  `<cmd> 2>&1 | tee /tmp/<LABEL>-<step>.log` then put the last lines in
  the block. A Lean check, a python compute, a git op > ~10 s all qualify.
- **Advance the step counter** every block; never repeat an identical
  block twice — if nothing changed, say what you are still waiting on and
  quote the newest log line.
- **Evidence or it didn't happen**: every DID line names a file / exit
  code / count / sha. No vague verbs.
- When you finish, emit a final block with marker `### ⟦DONE⟧ <LABEL>`
  carrying the verdict (closed / scope-(a) / scope-(b) / bean-the-gap),
  the exact .lean path(s), lean-direct exit code, real-sorry count, and
  the branch you pushed.
````

Why this exact shape: the parent's extractor (below) greps for the
`⟦PROGRESS⟧` / `⟦DONE⟧` markers and pulls the DID/DOING/NEXT/BLOCKERS
lines. Consistent markers → one-line-per-agent synthesis with zero
guessing. Deviating from the marker or the four keys breaks the monitor.

> This contract is **additive** to the task's own discipline (anti-fit,
> lean-direct verification, zero-sorry, bean-the-gap). It governs *how the
> agent reports*, never *what counts as done*. An agent still may not
> launder a fit or fake a closure to make its DID line look better —
> honesty over a pretty status.

---

## 2. Dispatch procedure

**Where the work comes from.** A handover report hands its unstarted items over
as DISPATCH LINES — one fixed sentence per work item, per
[`handover-report`](handover-report.md) rule 7:

```
Do bean folio-assistant-<id> on branch <branch-to-create> of repo <owner>/<repo>.
```

Take the front from that line rather than inventing a scope: the work item carries
its own Done-when, so the agent's result can be judged, which a theme does not
allow. If you are dispatching work that has no work item, work item it first.

1. **Scope each front** to one independent agent (no shared files between
   agents — worktree isolation makes parallel file writes safe; use
   `isolation: "worktree"` whenever agents mutate the tree).
2. **Assign each a `<LABEL>`** and paste the §1 contract block into its
   prompt, plus the task-specific brief (verification recipe, discipline,
   git/branch/PR rules — do not re-derive these; reuse the project's
   standing lean-direct recipe and "push branch, parent PRs+merges"
   convention).
3. **Name the skills that govern the front** in the brief, by path, and
   quote the rules they set that the work could touch — rendering, layering,
   what is forbidden. An agent cannot follow a rule it was never pointed at.
   **Always include [`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md)
   (and [`hand-back-to-discussion`](../../../skills/conduct/conduct-core/hand-back-to-discussion.md))**
   in every dispatched brief, and require the child to pass it on to any
   subagent it spawns: never ask the owner a question in prose alone without a
   tappable card (`AskUserQuestion`, `request_decision`, `ask_question`, or
   `post_widget`) after the full chat block (≤ 4 options, recommended first,
   stated default on silence), or return the question to the coordinating
   session in the `hand-back-to-discussion` schema format.
   If the skills are
   served over MCP and the server is unreachable, read them from the mounted
   layers (`<layer>/skills/**`) instead: an unreachable server is never a
   reason to work without them.
4. **Launch all agents in a single message** (multiple `Agent` tool calls)
   so they run concurrently. Record each returned `agentId` ↔ `<LABEL>`
   mapping in a scratch note (`/tmp/<session>-dispatch-map.txt`) so the
   heartbeat can label rows even before an agent's first block lands.
5. **Immediately arm the heartbeat** (§3). Do not end the turn without it.

---

## 3. Parent-side 2-minute heartbeat

### 3a. The extractor (targeted — never read the full JSONL)

Reading an agent's whole `*.output` transcript overflows context. Extract
ONLY the latest progress block per agent. Save this once as
`scripts/agent-progress.py` (or inline it):

```python
#!/usr/bin/env python3
# Usage: agent-progress.py <tasks-dir>
# Prints the latest ⟦PROGRESS⟧/⟦DONE⟧ block from each agent's *.output JSONL.
import json, re, sys, glob, os
tasks = sys.argv[1]
for f in sorted(glob.glob(os.path.join(tasks, "*.output"))):
    aid = os.path.basename(f)[:-7]
    last = None
    try:
        for line in open(f):
            try: o = json.loads(line)
            except Exception: continue
            for c in (o.get("message", {}).get("content") or []):
                if isinstance(c, dict) and c.get("type") == "text":
                    t = c.get("text", "")
                    if "⟦PROGRESS⟧" in t or "⟦DONE⟧" in t:
                        # keep only from the last marker onward
                        idx = max(t.rfind("⟦PROGRESS⟧"), t.rfind("⟦DONE⟧"))
                        last = t[t.rfind("###", 0, idx):] if idx >= 0 else t
    except FileNotFoundError:
        continue
    done = last and "⟦DONE⟧" in last
    print(f"===== {aid[:12]} {'[DONE]' if done else '[live]'} =====")
    print((last or "(no progress block yet — agent still spinning up)").strip()[:900])
    print()
```

Run it against the session tasks dir:
`python3 scripts/agent-progress.py "$TASKS_DIR"` where `$TASKS_DIR` is the
`tasks/` folder holding the `<agentId>.output` files (the dispatch tool
result names each `output_file`; its parent dir is `$TASKS_DIR`).

### 3b. The cadence

Every ~120 s while any agent is still `[live]`:

1. Run the extractor.
2. Post ONE consolidated synthesis to the user — a compact table, one row
   per agent, newest block only:

   | label | DID (evidence) | DOING (live) | NEXT | BLOCKERS |
   |-------|----------------|--------------|------|----------|
   | `agent-1` | pushed `abc1234` | running the tests | open the PR | none |

   Keep it to one screen. If a block is stale (same step counter as last
   heartbeat and > 3 min old), flag it `⚠ stale` and note you'll
   `SendMessage` the agent to nudge it.
3. **Re-arm** the next 120 s tick, then end the turn (do not busy-wait).

**Cadence mechanism** — do NOT foreground-`sleep` (blocked). Use one of:
- **`ScheduleWakeup`** with `delaySeconds: 120`, `prompt: "/dispatch-agent
  heartbeat"`, `reason: "2-min agent status heartbeat"` — the standard
  dynamic-loop tick. Call `ScheduleWakeup({stop:true})` once every agent
  is `[DONE]`.
- If the harness surfaces agent-completion notifications, those also wake
  you; run the extractor on each and treat it as an off-cadence heartbeat,
  then re-arm the 120 s fallback so quiet stretches still tick.

The 120 s tick is a *fallback heartbeat*; completion notifications arrive on
their own.

### 3c. Nudging a silent agent

If an agent shows `(no progress block yet)` for > 3 min, or its step
counter hasn't advanced across two heartbeats,
`SendMessage(to: <agentId>, ...)` with a one-line nudge: *"Emit a fresh ⟦PROGRESS⟧ block
with the live tail of whatever is running."* An agent that has genuinely
hung (evicted oleans, ENOSPC) will surface it as a BLOCKER once nudged.

---

## 4. On completion

When an agent emits `⟦DONE⟧` (or the harness notifies completion):

1. Drop it from the `[live]` set; keep its final block in the synthesis
   as a `[DONE]` row.
2. **Verify before trusting the DONE line.** The agent's self-reported
   "sorry-free / exit 0" is a claim — the parent re-runs lean-direct on
   each edited `.lean` itself (exit 0, no `declaration uses 'sorry'`)
   before merging, exactly as for any dispatched Lean work. A green DID
   line never substitutes for the parent's own verification.
3. When **all** agents are `[DONE]`: post a final consolidated synthesis
   (verdict per front + the merge/next-step queue), `ScheduleWakeup(
   {stop:true})`, and end the heartbeat.

---

## 5. Anti-patterns (each is a skill violation)

- **Going dark** — dispatching background agents without arming the
  heartbeat.
- **Semi-static updates** — "agent still running the proof" with no log
  tail, no step counter, no evidence. If a command is in flight, the
  block MUST carry its live output.
- **Reading the full transcript** — tailing/`cat`-ing the `*.output`
  JSONL into context instead of using the targeted extractor.
- **A brief with no governing skills** — dispatching a front without naming
  the skills that rule it (§2 step 3). The agent then decides a design
  question the owner already ruled on, and the PR carries it in.
- **Trusting the DONE line** — merging on an agent's self-reported
  "exit 0" without the parent's own lean-direct re-verification.
- **Wrong cadence** — 5-minute or "when I remember" ticks when the user
  asked for 2 minutes. Honor the literal cadence.
