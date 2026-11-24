---
name: swarm-monitor
description: >
  Supervises any active multi-agent swarm bound to a parent Swarm Work Item
  (`epic` or `milestone` in `beans`) on event-driven wakeups and a 2-to-4-minute
  fallback timer: maintains measurable exit criteria (`EC-1..EC-k`), structured
  child queues (`completed`, `active`, `queued`, `idle-backlog`), and a live
  Cold-Start Handover Runbook pushed to `cat/cat-harness/beans` on every routine
  check-in; checks CPU, disk, and compressed/swap memory headroom; keeps
  compute-bound workers productive on non-heavy `idle-backlog` work; hands
  verified pull requests to the merge steward; and publishes standardized
  two-table human status reports (`on-demand` or `periodic`) free of internal
  session shorthands.
user_invocable: true
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, Agent, SendMessage, ScheduleWakeup, ToolSearch, AskUserQuestion
---

# Supervising active swarms, maintaining cold-start handover continuity, and translating worker state for humans

- [1. Swarm = Parent Work Item & cold-start handover protocol (STRICT)](#1-swarm--parent-work-item--cold-start-handover-protocol-strict)
- [2. Role separation, reactive lifecycle, and reporting modes (`on-demand` vs `periodic`)](#2-role-separation-reactive-lifecycle-and-reporting-modes-on-demand-vs-periodic)
- [3. Human-consumable two-table status reporting contract (STRICT)](#3-human-consumable-two-table-status-reporting-contract-strict)
- [4. Worker health, memory/swap saturation, idle-on-compute backlog, and Andon-cord triage](#4-worker-health-memoryswap-saturation-idle-on-compute-backlog-and-andon-cord-triage)
- [5. Merge-steward handoff, merge-train batching, and shared `beans` slot refill](#5-merge-steward-handoff-merge-train-batching-and-shared-beans-slot-refill)
- [6. Reference portable CLI (`swarm-epic-sync`)](#6-reference-portable-cli-swarm-epic-sync)
- [7. Worked example — compliant two-table status report vs. shorthand violation](#7-worked-example--compliant-two-table-status-report-vs-shorthand-violation)

Three skills govern a multi-agent run, and each owns a distinct question:

- [`swarm-management`](swarm-management.md) decides **whether** to spawn parallel workers, against which parent Swarm Work Item and decomposition, at what count and model tier, and under which `swarm-spawn` permission or waiver;
- [`dispatch-agent`](dispatch-agent.md) defines **how** each worker is briefed in an isolated worktree and emits machine-greppable `⟦PROGRESS⟧` / `⟦DONE⟧` blocks;
- **this skill** runs the **Swarm Monitor** companion loop (`Process_SwarmDispatchAndMonitor` in [`sdlc/processes/swarm-dispatch-and-monitor.bpmn`](../../processes/swarm-dispatch-and-monitor.bpmn) and `Process_SwarmMonitorSweep` in [`sdlc/processes/swarm-dispatch-and-monitor-sweep.bpmn`](../../processes/swarm-dispatch-and-monitor-sweep.bpmn)) from startup or cold takeover until the parent Swarm Work Item's exit criteria are satisfied or cleanly parked.

Never run a swarm of two or more background workers without both a bound parent **Swarm Work Item** in `beans` and an active Swarm Monitor loop.

---

## 1. Swarm = Parent Work Item & cold-start handover protocol (STRICT)

### Why every swarm binds to a parent Swarm Work Item

Many distinct swarms can run across a repository over time for different goals — for example, a `'Stability'` epic for a repository stabilization and merge-drain swarm, a formal proof-closure swarm, a knowledge-graph detangling swarm, a literature-audit swarm, or an outreach/documentation swarm.

Every long-running Swarm Coordinator or Merge Steward will eventually hit context-window limits, token quota caps, container eviction, or session stalls. Holding the swarm's goals, queue order, worktree map, or owner rulings only inside an ephemeral chat transcript guarantees lost context, orphaned branches, or duplicate worker dispatches when the coordinator stalls.

### Mandatory parent Swarm Work Item (`Task_InitOrClaimSwarmEpic`)

Starting any swarm — or taking over cold after an active coordinator or merge steward has been silent past the liveness window (`> 20–30 min`, per [`merge-manager-watcher`](merge-manager-watcher.md) §"Liveness and stalls" and [`stalled-agent-triage`](stalled-agent-triage.md)) — MUST first bind to a parent **Swarm Work Item** (`--type epic` or `--type milestone` in `beans`, parameterized by `--epic-id <bean-id>` or `--swarm-title "<Title>"`):

1. **Check before you create (`STRICT`):** Query the mounted `beans` store (`beans list --json --search` with exact title comparison plus `lsi:near`, per `todo-manager` in `cat-harness.work-plan`) for an active Swarm Work Item matching the swarm's goal.
   - **Resuming after a stall:** Read `beans show <epic-id>` and its latest `handover:` note first, verify its listed branches, pull requests, and worktrees against live remote/host state, claim or update the holder note (`bun run cat beans:claim <epic-id>`), and resume without re-deriving settled work.
   - **Starting a new swarm:** Create the parent `epic` (under its goal `milestone` when one exists), tag it with `process:Process_SwarmDispatchAndMonitor`, claim it via `Process_BeanOpen`, and populate the three mandatory sections below before launching workers.

### Three required sections of every Swarm Work Item (`< 60 s` cold-reader test)

Any cold successor agent reading `beans show <epic-id>` (plus its branch-keyed `handover:` note) MUST be able to take over as Swarm Coordinator or Merge Steward in **under 60 seconds** without reading the prior session's chat transcript. Every active Swarm Work Item therefore maintains three sections:

1. **Defined Acceptance Criteria / End State (`EC-1..EC-k`):**
   Explicit, measurable exit gates stating what must hold for this swarm to close (for example: *"`EC-1`: `origin/main` green across all hard gates; `EC-2`: all 6 queued schema-migration PRs verified and merged; `EC-3`: zero orphaned worker worktrees or unpushed commits"*). Never run an open-ended swarm without checkable exit criteria.
2. **Structured Queues of Child Work Items & PR Waves:**
   Every child unit parented to `<epic-id>`, partitioned into four live buckets:
   - **`completed`:** Landed on `origin/<default-branch>` with merge SHA and verified metric.
   - **`active`:** Currently claimed in an isolated worker worktree (`bean-id`, branch, worker role/label).
   - **`queued`:** Unblocked `todo` child items and ordered PR waves (e.g. Wave A foundation fixes → Wave B dependent refactors → Wave C docs/cleanup) ready to refill freed slots.
   - **`idle-backlog`:** Right-scoped, **non-compute-heavy** child items (documentation, metadata, review checklists, small disjoint edits) reserved for workers waiting on single-core or long-running background compute (§4b).
3. **Continuously Updated Cold-Start Handover Runbook (`Task_RefreshSwarmHandover`):**
   Refreshed on **every routine monitor check-in tick** and at every milestone/wave transition using the [`swarm-epic-sync`](../../tools/swarm-epic-sync/swarm-epic-sync.json) Tool (or `bun run cat beans:note` + `bun run cat state:push`), and pushed immediately to `origin` on the shared `beans` state branch (`cat/cat-harness/beans` — never from a sparse checkout, per [`merge-manager-watcher`](merge-manager-watcher.md) §"Merging across dependent repositories" rule 7):
   - **Baseline header:** UTC timestamp, `origin/<default-branch>` 40-hex SHA, active coordinator/merge-steward session ID, and selected status reporting mode (`periodic` vs `on-demand`).
   - **PR wave & merge-train queues:** Merged in window, `Ready-to-Merge` (verified green, handed to merge steward for [`merge-queue`](merge-queue.md) / `Process_MergeTrain` batching and [`merge-to-main`](merge-to-main.md) / `merge:guard` landing), `Preparing` (active worker branches/drafts), and `Held / Blocked` (`content` PRs or owner cards).
   - **Live worktree & process map:** `worktree path -> branch -> 40-hex HEAD SHA -> clean/dirty state -> active worker role & live subprocess PID`.
   - **Standing owner directives & safety fences:** Verbatim owner rulings, active confirmation waivers (with dates and scope bounds), resource caps, and hands-off paths/branches.
   - **`< 60 s` cold-takeover runbook & copy-paste `DISPATCH LINES`:** The exact commands for a successor coordinator/merge-steward to fetch `origin`, mount `beans`, inspect live PIDs/PRs, and dispatch the next unstarted items using [`handover-report`](handover-report.md) rule 7 (`Do bean <id> on branch <branch-to-create> of repo <owner>/<repo>.`).

---

## 2. Role separation, reactive lifecycle, and reporting modes (`on-demand` vs `periodic`)

The Swarm Monitor lane (`swarm-monitor` role) sits between the worker agents (`authoring-agent`), the coordinator (`session-coordinator`), and the merge steward ([`merge-manager-watcher`](merge-manager-watcher.md)). One coordinator session normally holds both `session-coordinator` and `swarm-monitor`; in a multi-session run, a dedicated monitor or merge-steward session may hold `swarm-monitor` over the same shared `beans` store.

### Internal monitor cadence vs. user-selectable human status cadence

Separate **internal stall-safe supervision** (always active while workers run) from **human chat status emission** (controlled by the owner's preference):

| Mode | Internal sweep & `beans` handover sync (`Process_SwarmMonitorSweep`) | Human-Consumable Swarm Status Report (`Mon_Report`) |
|---|---|---|
| **`on-demand` (quiet background mode)** | Runs on every worker completion/message event + `2–4 min` one-shot fallback wakeup (`180 s` default), refreshing & pushing the Swarm Work Item's Cold-Start Handover Runbook on every check-in. | Emitted **whenever the owner requests status** (*"status"*, *"status table"*, *"swarm report"*), on blocking owner decision cards, and at final swarm closure — staying quiet in chat between requests. |
| **`periodic` (live scorecard mode)** | Runs on reactive worker events + routine check-in timer (for example `120–240 s` fallback wakeups or a recurring schedule such as `*/10 * * * *`), refreshing & pushing the Cold-Start Handover Runbook every tick. | Emitted automatically **on each scheduled periodic check-in** AND whenever requested on-demand or at milestone transitions. |

Ask or honour the owner's choice of `on-demand` vs `periodic` when starting the swarm, and record the active mode in the Swarm Work Item header so a cold successor preserves it. **Never skip `Task_RefreshSwarmHandover` in `on-demand` mode:** quiet chat output never means an un-synced handover runbook.

### Five steps of every monitor wake (zero busy-polling)

Never loop inside a turn or run a shell `sleep` to wait on workers. Each wake executes `Process_SwarmMonitorSweep` (`sdlc/processes/swarm-dispatch-and-monitor-sweep.bpmn`) followed by merge handoff and slot refill:

1. **Extract live worker blocks & measure queues/headroom (`Mon_Sweep`):** Run the targeted JSONL extractor ([`dispatch-agent`](dispatch-agent.md) §3a — never reading full `*.output` transcripts), fetch `origin/<default-branch>`, query forge REST pull requests/issues and `beans`, and measure CPU load, root disk free space (`df -h /`), and **total memory plus compressed/swap footprint** (§4a). **Could not determine is never rendered as zero or clean.**
2. **Intervene on leaks, stalls, or structural drift (`Mon_Triage`, §4a–4d):** `SIGKILL` runaway swap-leaking subprocesses, nudge silent workers, triage dead sessions, or pull the Andon cord.
3. **Assign non-heavy `idle-backlog` to compute-bound workers (`Task_AssignIdleComputeBacklog`, §4b):** Keep workers waiting on single-core builds/solvers productive without disrupting their running build checkout.
4. **Refresh & push the Swarm Work Item handover runbook (`Task_RefreshSwarmHandover`, §1 & §6):** Update the Cold-Start Handover Runbook on `<epic-id>` and push immediately to `cat/cat-harness/beans`.
5. **Publish the two-table status report (when due), hand off ready PRs, and refill slots (`Mon_Report` → `Steward_QueuePr` → `Mon_Refill`):** Emit the §3 report if requested or on `periodic` cadence, independently verify `[DONE]` branches before sending six-line merge requests to the merge steward, refill freed slots from `queued` child items, and re-arm one wakeup timer (or close via `Process_BeanClose` when `EC-1..EC-k` are all met).

---

## 3. Human-consumable two-table status reporting contract (STRICT)

### Why raw coordinator telemetry fails the human reader

Worker labels (`a3-parser`, `W2`, `W7`), bare pull-request lists (`#402, #405..#409`), raw work-item slugs (`idx4`, `cfg9`), and pasted `DID / DOING` log tables are **internal session shorthands**. To a human reader outside the worker transcripts, `"W2 merged (#405), W4 green (#408), W7 running step 4 on idx4"` says nothing about what capability or theorem was delivered, whether it passed verification, or which exit criteria remain — forcing the owner to open every pull request and work item by hand.

**The standalone reader test (`STRICT`):**

> **Can a reader who has never opened the worker sessions understand the swarm's end-state progress, what was proved/built/measured, what is ready to merge, what each worker is doing now, and what needs a decision — without clicking a single link?**

### Rule 1 — Ban naked shorthands (`STRICT`)

Never emit bare worker tags (`W2`, `worker-3`), bare pull-request numbers or ranges (`#104..#109`), or unglossed work-item IDs (`fa-idx4`) anywhere in a human-facing status report, PR comment, or turn summary:

- **Every referenced pull request, work item, exit criterion, or active worker MUST carry a plain-English statement of what concrete deliverable, proof, fix, or finding it achieves AND its key measured or verified outcome** (passing test/gate counts, runtime or size delta, coverage figure, or exact blocker).
- Expand every PR range individually or under a named track with each PR glossed in plain prose.
- Follow [`turn-reporting`](turn-reporting.md) rule 1 and [`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md) §4.1 whenever surfacing an owner decision: full context in chat first, options with trade-offs, recommendation marked first, stated default on silence, and a tappable card — never a one-line decision teaser.

### Rule 2 — Standardized Two-Table Swarm Status Report (Mandatory for both `on-demand` and `periodic` reports)

Every human-facing Swarm Status Report MUST present **Table 1** and **Table 2** (followed by brief plain-prose track highlights where helpful), in this exact order:

#### Table 1 — Live Repository Queue Scoreboard (`PRs | Work Items (beans) | Issues`)

Measure live from the forge and synced `beans` store against `origin/<default-branch>`:

| Queue slice | Pull Requests | Work Items (`beans`) | Issues |
|---|---:|---:|---:|
| **Open total** | `<n>` | `<n>` | `<n>` |
| ├─ **Ready-to-Merge queue** (verified green, handed to merge steward) | `<n>` | `<n>` *(done in branch, awaiting PR merge)* | `<n>` *(linked to ready PR)* |
| ├─ **External / Held (hands-off)** (`content` PRs, owner-held, outside swarm) | `<n>` | `<n>` | `<n>` |
| ├─ **Legacy / Backlog queue** (unclaimed `todo` + `idle-backlog` items) | `<n>` | `<n>` | `<n>` |
| └─ **Preparing (active worker branches)** (claimed `in-progress` / draft or CI running) | `<n>` | `<n>` | `<n>` |
| **Closed / Merged today** (current UTC date or stated window) | `<n>` | `<n>` | `<n>` |
| **Closed / Merged all-time** | `<n>` | `<n>` | `<n>` |

Directly beneath Table 1, state one provenance line naming: **Parent Swarm Epic ID & title**, **reporting mode** (`on-demand` or `periodic`), **`origin/<default-branch>` SHA**, **handover sync status** (`synced to cat/cat-harness/beans at <UTC>`), and **host headroom** (`CPU load`, `resident + compressed/swap memory`, and `/` free disk).

#### Table 2 — Full Multi-Track End-State, Queue & Worker Status Table

Present one structured row per exit track / sub-epic of the parent Swarm Work Item, with **zero opaque internal shorthands**:

| Track & Exit Criterion (`EC-k`) | Queue (`Done / Active / Queued / Idle-Backlog`) | Proved, Built, or Measured Outcomes (plain English + metrics) | Active Workers, Ready PRs & Next Queued Step |
|---|---|---|---|
| **<Track name>** — `EC-1`: <plain-English exit condition and pass/open state> | `<d> / <a> / <q> / <i>` | <Plain-English statement of landed/verified deliverables and measured numbers — never bare PR ranges> | <Each ready PR with link + 1-line summary; each active branch/worktree with plain-language step + live progress metric; next queued item glossed> |

When multiple milestones or epics are active, include the four-part plain-prose rollup beneath Table 2 where needed for narrative context: *(1) Verbatim track goal, (2) Landed/verified results with metrics, (3) Ready-for-merge PRs with one-line summaries, and (4) Currently computing/idle-backlog activity & next queued deliverables.*

---

## 4. Worker health, memory/swap saturation, idle-on-compute backlog, and Andon-cord triage

### 4a. Runaway memory, compressed pages, and swapfile disk exhaustion (`STRICT`)

**Never rely on `ps -o rss` alone to judge worker memory health.** On macOS and swap-backed Linux, the kernel compresses inactive pages and pages them out to swap files (for example `/System/Volumes/VM/swapfile*` on macOS or swap partitions/files on Linux). A leaking build, solver, headless browser, or test process can allocate tens of gigabytes while its resident set (`rss`) stays under `3 GB` — silently filling the root volume with swapfiles until every agent and git operation fails with `ENOSPC`.

Each monitor sweep MUST inspect **total memory footprint plus compressed/swap usage alongside root disk headroom**:

- **macOS:** Run `top -l 1 -o mem -stats pid,command,mem,cmprs | head -n 20` alongside `df -h /` (and `ls -lh /System/Volumes/VM/ 2>/dev/null` when swap grows). `mem` + `cmprs` exposes compressed regions that `ps -o rss` omits.
- **Linux:** Inspect `free -h`, `df -h /`, and per-worker `/proc/<pid>/status` (`VmRSS` + `VmSwap` + `VmPeak`).
- **CPU concurrency:** Check 1-minute load average (`uptime`) and active build/test subprocess counts against physical cores and any single-thread environment caps ([`swarm-management`](swarm-management.md) §"Sizing").

**Immediate action on ceiling breach:** When any worker subprocess exceeds its per-worker memory+swap ceiling or drives free root disk toward the host safety floor (default: `< 10 GB` free on `/` or swap growth `> 50%` of physical RAM):

1. Immediately `SIGKILL` (`kill -9 <pid>`) the runaway child subprocess so swap/disk space is reclaimed at once.
2. Send an urgent `SendMessage` to the owning worker naming the killed command, its measured `mem + cmprs` / `VmSwap` footprint, and forbidding an unbounded retry.
3. If two workers breach headroom or root disk remains below floor after reclamation, pull the **Andon cord** (halt new dispatches and pause remaining heavy builds) until headroom recovers.

### 4b. Idle-on-compute non-heavy backlog rule (`Task_AssignIdleComputeBacklog` / `idle-backlog` integration)

When a worker is waiting on a single-core or long-running background job (a compilation, formal proof build, solver run, or remote CI shard) and host CPU/memory/swap limits forbid launching another heavy build:

1. **Never let the worker sleep on passive polling timers** (`idle-backlog` in `cat-harness.work-plan`).
2. Pull a right-scoped, **non-compute-heavy** item from the Swarm Work Item's `idle-backlog` queue — such as documentation updates, provenance/schema metadata, QA review checklists, or small disjoint edits that require no heavy compile.
3. **Worktree isolation invariant (`STRICT`):** Never run `git checkout` or `git switch` inside the worktree where the background build is running — switching refs mid-build corrupts compiler artifacts and invalidates the run. Either edit non-conflicting doc/metadata files on the same branch when they belong to the same PR, or attach a separate `git worktree` for an independent `idle-backlog` branch.
4. Preempt back to the primary compute task immediately once the background build finishes.

### 4c. Silent stalls and reasoning drift

- **Silent worker:** No `⟦PROGRESS⟧` block after 3 minutes of wall time, or an identical step counter across two consecutive sweeps (when no verified background compute log is advancing). Send a targeted one-line `SendMessage` nudge ([`dispatch-agent`](dispatch-agent.md) §3c). If the next sweep still shows no live progress or surfaces a reasoning loop, terminate the worker early and route its footprint through [`stalled-agent-triage`](stalled-agent-triage.md), recording its branch SHA in the Swarm Work Item's Cold-Start Handover Runbook.
- **Shared-file or branch collision:** Two workers touching the same path or pushing conflicting updates violate the disjoint-slice precondition ([`swarm-management`](swarm-management.md)). Halt the later writer immediately and re-scope in `beans`.

### 4d. Structural Andon-cord halt

Pull the Andon cord and halt the swarm ([`swarm-management`](swarm-management.md) §"Andon-cord stopping") when early completed units reveal incompatible interface/schema assumptions or missing prerequisites across remaining sub-beans. Present any blocking architectural choice once in full to the owner ([`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md) §4.1) rather than letting $N$ workers invent $N$ incompatible answers.

---

## 5. Merge-steward handoff, merge-train batching, and shared `beans` slot refill

### Independent verification, merge-steward handoff, and `merge-train` / `merge-to-main` integration

Never invent a parallel or ad-hoc merge procedure inside a swarm. Every pull request produced by a swarm lands strictly through [`merge-manager-watcher`](merge-manager-watcher.md), [`merge-queue`](merge-queue.md) (`Process_MergeTrain`), and [`merge-to-main`](merge-to-main.md) (`Process_MergeToMain`):

1. **Never trust a worker's self-reported `⟦DONE⟧` verdict unverified.** Re-run the governing fast/targeted verification checks (`tsc`, targeted unit tests, `bpmn:detangle --check`, or gate checks) on the worker's pushed branch head before marking or requesting merge.
2. **Respect single-merge-steward discipline ([`merge-manager-watcher`](merge-manager-watcher.md) `STRICT`):** Neither workers nor the Swarm Monitor merge PRs directly unless this session holds the `merge-steward` lane under owner batch-card authorisation. Send each verified ready PR to the active merge steward using the six-line merge request (`Process_MergeRequest` / `merge-manager-watcher` §"The merge request: six lines"), or apply `ready-to-merge` / `needs-repin` (after the final head push, with a signed `ready: <full 40-hex head sha>` marker where required) when operating without direct chat.
3. **Batch ready swarm PRs through [`merge-queue`](merge-queue.md) (`Process_MergeTrain`) and [`merge-overlap`](../../tools/merge-overlap/merge-overlap.json) in EVERY repository (`>= 2` ready PRs):** Whenever two or more non-content swarm PRs are ready in the same repository — whether CI-runner-gated (`merge-train` label / `merge-train.yml`) OR local-gate / dispatch-only (`ciState: none`, composing `4–8` mutually independent PRs onto a clean `merge-train/<base>-<n>` branch with one regeneration of declared additive/generated regions and one combined `Task_LocalGates` run) — the merge steward classifies pairwise overlap on `authoredPaths` via `merge:overlap`, orders candidates with `merge-priority.dmn`, runs the gates once on the combined stack, bisects and ejects **only** any red culprit via [`merge-refusal.bpmn`](../../processes/merge-refusal.bpmn) (`Process_MergeRefusal`), and lands surviving members in train order instead of burning $O(N)$ serial runs.
4. **Land exclusively through [`merge-to-main`](merge-to-main.md) (`Process_MergeToMain`) with `merge:guard` or `verify-merge-replay`:** Every write to `main` evaluates live head-SHA evidence (`ciState` per owed job via `check-head-has-run`, `mergeable`, `review`), records explicit owner authorisation (`merge:queue:decide` or `merge-authorised:` block), lands pinned to the evaluated 40-hex head SHA (**never passing `--delete-branch`**), and completes post-merge base confirmation (including `verify-merge-replay` tree-parity check on local-gate trains), site republishing, and downstream re-pins.

### Shared `beans` queue discipline, mandatory launch briefing, and continuous slot refill

- **Zero private queue or handover state:** Every sub-bean creation, claim (`bun run cat beans:claim <id>`), `idle-backlog` assignment, deferral, blocker note, Cold-Start Handover Runbook refresh, and completion MUST be written to the shared `beans` store and pushed (`bun run cat state:push` or `swarm-epic-sync --push`), never kept only in `/tmp` or coordinator memory.
- **Mandatory fresh-context launch briefing on every spawn and slot refill (`STRICT`):** Spawned siblings start with a blank context and zero memory of prior session instructions. Every worker launched at `Task_DispatchWorker` or refilled at `Mon_Refill` MUST receive the canonical role-specific **Process & Skill Launch Block** from [`dispatch-agent`](dispatch-agent.md) §1b (Template A for a `merge-steward`; Template B for any authoring/proof/prose/compute sibling, explicitly requiring target-repo `.claude/skills/local/*.md` first, [`continual-progress`](../../../skills/conduct/conduct-core/continual-progress.md), `idle-backlog` without passive sleep timers or mid-build `git checkout`, [`merge-request.bpmn`](../../processes/merge-request.bpmn) / [`merge-queue`](merge-queue.md) never-self-merge 6-line handoff, [`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md) / [`hand-back-to-discussion`](../../../skills/conduct/conduct-core/hand-back-to-discussion.md), [`one-voice-style-guide`](../../../skills/authoring/authoring-core/one-voice-style-guide.md), and repo fences) alongside the `⟦PROGRESS⟧` telemetry contract.
- **Slot refill (`Mon_Refill`):** Whenever a worker completes (or parks on a documented blocker), exit criteria `EC-1..EC-k` are not yet all met, and host CPU/memory/swap/disk headroom is healthy, claim the highest-priority unblocked item from the Swarm Work Item's `queued` list, verify no sibling branch or open PR already holds it, dispatch a fresh isolated-worktree worker with [`dispatch-agent`](dispatch-agent.md) §1 + §1b, refresh the handover runbook, and re-arm the fallback timer.

---

## 6. Reference portable CLI (`swarm-epic-sync`)

The [`swarm-epic-sync`](../../tools/swarm-epic-sync/swarm-epic-sync.json) Tool node specifies the portable contract for `Task_InitOrClaimSwarmEpic` and `Task_RefreshSwarmHandover`. Because the `cat-harness` layer is declarative data only, save the standalone Python 3 standard-library reference script below as `/tmp/swarm_epic_sync.py` (or invoke `python3 -m swarm_epic_sync` when installed on `PYTHONPATH`) in any repository checkout to idempotently create/update any Swarm Work Item's Cold-Start Handover Runbook from live `git worktree list`, forge REST `/pulls`, `ps`/`top`, and `beans`, and push it to `cat/cat-harness/beans`:

````python
#!/usr/bin/env python3
"""swarm_epic_sync.py — Generic Swarm Work Item & Cold-Start Handover Runbook sync.

Works for ANY swarm epic/goal (e.g. --swarm-slug stability, proof-closure,
kg-detangle, literature-audit, outreach, or --epic-id <bean-id>).
"""
import argparse, datetime as dt, json, os, platform, re, shutil, subprocess, sys


def run(cmd: list[str], cwd: str | None = None, stdin: str | None = None) -> tuple[int, str]:
    p = subprocess.run(cmd, cwd=cwd, input=stdin, text=True, capture_output=True)
    return p.returncode, (p.stdout or "").strip()


def detect_repo(cwd: str) -> str:
    rc, url = run(["git", "remote", "get-url", "origin"], cwd=cwd)
    if rc != 0 or not url:
        return "unknown/unknown"
    cleaned = url[:-4] if url.endswith(".git") else url
    for sep in ("github.com:", "github.com/", "gitlab.com:", "gitlab.com/"):
        if sep in cleaned:
            return cleaned.split(sep, 1)[1].strip("/")
    return "unknown/unknown"


def collect_worktrees(cwd: str) -> list[dict[str, str]]:
    rc, out = run(["git", "worktree", "list", "--porcelain"], cwd=cwd)
    if rc != 0:
        return []
    rows, cur = [], {}
    for line in out.splitlines() + [""]:
        if not line.strip():
            if cur.get("path"):
                wt = cur["path"]
                _, st = run(["git", "status", "--porcelain"], cwd=wt)
                cur["state"] = "clean" if not st else f"dirty({len(st.splitlines())})"
                rows.append(cur)
            cur = {}
        elif line.startswith("worktree "):
            cur["path"] = line.split(" ", 1)[1]
        elif line.startswith("HEAD "):
            cur["head"] = line.split(" ", 1)[1]
        elif line.startswith("branch "):
            cur["branch"] = line.split(" ", 1)[1].removeprefix("refs/heads/")
        elif line == "detached":
            cur["branch"] = "(detached)"
    return rows


def collect_headroom() -> str:
    _, up = run(["uptime"])
    _, df_out = run(["df", "-h", "/"])
    disk = df_out.splitlines()[-1].split()[3] + " free on /" if df_out.splitlines() else "unknown disk"
    if platform.system() == "Darwin":
        _, top_out = run(["top", "-l", "1", "-o", "mem", "-stats", "pid,command,mem,cmprs"])
        mem_lines = [ln for ln in top_out.splitlines() if "PhysMem" in ln]
        mem = mem_lines[0].strip() if mem_lines else "top sampled"
    else:
        _, free_out = run(["free", "-h"])
        mem = free_out.splitlines()[1] if len(free_out.splitlines()) > 1 else "free sampled"
    return f"{up} · {mem} · {disk}"


def collect_active_pids() -> list[str]:
    rc, out = run(["ps", "-eo", "pid,etime,rss,command"])
    if rc != 0:
        return ["could not determine process list"]
    pat = re.compile(r"(?:^|/)(lake|lean|bun|pytest|python3?|cargo|tsc|playwright)(?:\s|$)")
    hits = []
    for ln in out.splitlines()[1:]:
        parts = ln.strip().split(None, 3)
        if len(parts) == 4 and pat.search(parts[3]) and "swarm_epic_sync" not in parts[3]:
            hits.append(f"PID {parts[0]} ({parts[1]}, rss={parts[2]} KB): `{parts[3][:90]}`")
    return hits[:12] or ["none active"]


def collect_prs(repo: str) -> tuple[list[dict], str]:
    if repo == "unknown/unknown" or not shutil.which("gh"):
        return [], "could not determine (gh or origin repo unavailable)"
    rc, out = run(["gh", "api", f"repos/{repo}/pulls?state=open&per_page=50"])
    if rc != 0:
        return [], "could not determine (forge API unreachable)"
    try:
        data = json.loads(out)
        return (data if isinstance(data, list) else []), "ok"
    except ValueError:
        return [], "could not determine (invalid JSON)"


def resolve_or_create_epic(cwd: str, epic_id: str | None, slug: str | None) -> tuple[str, list[dict]]:
    if not shutil.which("beans"):
        return epic_id or f"unmounted-{slug or 'swarm'}", []
    rc, out = run(["beans", "list", "--json"], cwd=cwd)
    beans_all = json.loads(out) if rc == 0 and out.startswith("[") else []
    if epic_id:
        return epic_id, beans_all
    title = f"Swarm Epic: {slug or 'general'}"
    matches = [b for b in beans_all if b.get("title", "").lower() in (title.lower(), (slug or "").lower())
               and b.get("status") not in ("completed", "scrapped")]
    if matches:
        return matches[0]["id"], beans_all
    rc, created = run(["beans", "create", title, "--type", "epic"], cwd=cwd)
    if rc == 0 and created:
        for tok in created.split():
            if "-" in tok or len(tok) >= 4:
                return tok.strip(":."), beans_all
    return f"pending-{slug or 'swarm'}", beans_all


def build_snapshot(cwd: str, epic_id: str, slug: str, repo: str, base: str, notes: str) -> str:
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    run(["git", "fetch", "origin", f"+refs/heads/{base}:refs/remotes/origin/{base}"], cwd=cwd)
    rc, base_sha = run(["git", "rev-parse", f"origin/{base}"], cwd=cwd)
    base_sha = base_sha if rc == 0 else "could-not-determine"
    resolved_id, beans_all = resolve_or_create_epic(cwd, epic_id or None, slug or None)
    children = [b for b in beans_all if b.get("parent") == resolved_id]
    by_status = {s: [b for b in children if b.get("status") == s] for s in ("completed", "in-progress", "todo", "draft")}
    prs, pr_status = collect_prs(repo)
    wts = collect_worktrees(cwd)
    pids = collect_active_pids()
    headroom = collect_headroom()

    wt_rows = "\n".join(
        f"| `{w.get('path')}` | `{w.get('branch', '?')}` | `{w.get('head', '?')[:12]}` | {w.get('state', '?')} |"
        for w in wts
    ) or "| _(none)_ | - | - | - |"

    pr_rows = "\n".join(
        f"- #{p['number']} (`{p['head']['ref']}` @ `{p['head']['sha'][:12]}`, {'draft' if p.get('draft') else 'ready'}): {p['title']}"
        for p in prs[:20]
    ) or f"- None open (forge check: {pr_status})"

    dispatch_lines = "\n".join(
        f"Do bean {b['id']} on branch claude/{b['id']}-{now[:10].replace('-', '')} of repo {repo}."
        for b in by_status["todo"][:10]
    ) or "# (no unstarted child beans queued under this swarm epic)"

    return f"""## Cold-Start Swarm Handover Runbook (`{resolved_id}`)

- **Updated:** `{now}`
- **Repository & Base:** `{repo}` · `origin/{base}` = `{base_sha}`
- **Host Headroom:** {headroom}
- **Child Queue Counts (`{resolved_id}`):** `{len(by_status['completed'])}` completed · `{len(by_status['in-progress'])}` active · `{len(by_status['todo'])}` queued · `{len(by_status['draft'])}` draft/decision

### 1. Live Worktree -> Branch -> HEAD Map
| Worktree | Branch | HEAD | Working Tree |
|---|---|---|---|
{wt_rows}

### 2. Active Compute / Build Processes
{chr(10).join('- ' + p for p in pids)}

### 3. Open Pull Requests (`{repo}`)
{pr_rows}

### 4. Standing Directives, Exit Criteria (`EC-1..EC-k`) & Fences
{notes.strip() or '_Preserve existing EC-1..EC-k exit gates, reporting mode (on-demand vs periodic), and owner fences recorded on this epic._'}

### 5. Cold-Takeover Commands (`< 60 s`) & Dispatch Lines
```sh
git fetch origin +{base}:refs/remotes/origin/{base}
bun run cat state:mount && beans show {resolved_id}
bun run cat merge:watch -- --repo {repo}
```
```text
{dispatch_lines}
```
""", resolved_id


def main() -> int:
    ap = argparse.ArgumentParser(description="Sync a generic Swarm Work Item handover runbook in beans.")
    ap.add_argument("--epic-id", default="", help="Parent Swarm Work Item ID in beans")
    ap.add_argument("--swarm-slug", default="swarm", help="Goal slug if --epic-id omitted (e.g. stability, proof-closure)")
    ap.add_argument("--repo", default="", help="Forge owner/repo (defaults to origin remote)")
    ap.add_argument("--base", default="main", help="Default branch name (default: main)")
    ap.add_argument("--state-branch", default="cat/cat-harness/beans", help="Shared beans state branch")
    ap.add_argument("--push", action="store_true", help="Push updated state to --state-branch")
    ap.add_argument("--dry-run", action="store_true", help="Print snapshot without writing or pushing")
    args = ap.parse_args()

    cwd = os.getcwd()
    repo = args.repo or detect_repo(cwd)
    notes = sys.stdin.read() if not sys.stdin.isatty() else ""
    snapshot, resolved_id = build_snapshot(cwd, args.epic_id, args.swarm_slug, repo, args.base, notes)

    if args.dry_run:
        print(snapshot)
        return 0

    if shutil.which("bun") and os.path.exists(os.path.join(cwd, "package.json")):
        rc, _ = run(["bun", "run", "cat", "beans:note", resolved_id, "--title", f"handover: swarm-monitor ({args.swarm_slug})", "--body", snapshot], cwd=cwd)
        if rc == 0:
            run(["bun", "run", "cat", "beans:notes"], cwd=cwd)
    elif shutil.which("beans"):
        run(["beans", "update", resolved_id, "--body-append", "-"], cwd=cwd, stdin="\n" + snapshot)

    if args.push:
        if shutil.which("bun") and os.path.exists(os.path.join(cwd, "cat-harness-tools/scripts/state-push.ts")):
            rc, out = run(["bun", "run", "cat", "state:push"], cwd=cwd)
            if rc != 0:
                sys.stderr.write(f"state:push failed: {out}\n")
                return 1
        else:
            rc, out = run(["git", "push", "origin", f"HEAD:{args.state_branch}"], cwd=cwd)
            if rc != 0:
                sys.stderr.write(f"git push to {args.state_branch} failed: {out}\n")
                return 1

    print(json.dumps({"epic": resolved_id, "state_branch": args.state_branch, "pushed": args.push}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
````

---

## 7. Worked example — compliant two-table status report vs. shorthand violation

**✗ Violation (naked shorthands, unglossed IDs, no end-state criteria, no handover provenance):**

> Swarm tick 4: W1, W3 merged (#412..#413). W2, W5 ready (#415..#416). W4 waiting on build; W6 started `cfg9`. Refilling W1 with `lnk2`.

**✓ Compliant Human-Consumable Swarm Status Report (works identically for `on-demand` requests and `periodic` check-ins):**

> ### Table 1 — Live Repository Queue Scoreboard
>
> | Queue slice | Pull Requests | Work Items (`beans`) | Issues |
> |---|---:|---:|---:|
> | **Open total** | 6 | 14 | 9 |
> | ├─ **Ready-to-Merge queue** (verified green, handed to merge steward) | 2 | 2 | 2 |
> | ├─ **External / Held (hands-off)** (`content` PRs, owner-held) | 2 | 3 | 4 |
> | ├─ **Legacy / Backlog queue** (`4` queued + `2` non-heavy `idle-backlog`) | 0 | 6 | 2 |
> | └─ **Preparing (active worker branches)** | 2 | 3 | 1 |
> | **Closed / Merged today (since 00:00Z)** | 2 | 2 | 1 |
> | **Closed / Merged all-time** | 411 | 286 | 194 |
>
> *Swarm Epic: `fa-91c2` ("Deterministic incremental site builds under 30 seconds") · Mode: `periodic` (10-min scorecard; also available `on-demand`) · `origin/main` `9f3a1c84…` · Handover runbook synced to `cat/cat-harness/beans` at `16:20Z` · Host headroom: load `2.1 / 8` cores, memory `9.8 GB` resident + `128 MB` compressed (`0` swapfiles), `/` `71 GB` free.*
>
> ### Table 2 — Full Multi-Track End-State, Queue & Worker Status Table
>
> | Track & Exit Criterion (`EC-k`) | Queue (`Done / Active / Queued / Idle-Backlog`) | Proved, Built, or Measured Outcomes (plain English + metrics) | Active Workers, Ready PRs & Next Queued Step |
> |---|---|---|---|
> | **Slice Manifest & Link Caching** — `EC-1`: Warm 420-page rebuild `< 30 s` with `0` stale links *(in review — `26.8 s` measured)* | `2 / 0 / 1 / 1` | Merged content-hash manifest diffing ([#412](https://github.com/example/repo/pull/412)) and incremental glossary slice caching ([#413](https://github.com/example/repo/pull/413)); warm fixture rebuild dropped from `74.2 s` to `26.8 s` (`18/18` invalidation tests passing, `0` stale outputs). | **Ready for merge:** [#415](https://github.com/example/repo/pull/415) (`idx4` — Incremental cross-reference link table recomputing anchors only for modified pages; `34/34` link tests green) and [#416](https://github.com/example/repo/pull/416) (`cfg9` — Config-schema digest in slice cache header; `12/12` unit tests green). **Next queued:** `lnk2` (Emit cache-hit summary in CI job report). |
> | **Diagram & Locale Cache Parity** — `EC-2`: Byte-identical SVG and `.pot` outputs across all 5 locales *(active)* | `0 / 2 / 1 / 1` | Baseline `.pot` catalogue check passed (`0` drift across `ar, es, fr, ru, zh`); headless SVG parity verified byte-identical on `19/24` diagrams so far. | **Active:** Branch `claude/bpmn-svg-digest` (`svg7` — Skip browser SVG re-render when `.bpmn` digest matches; `19/24` diagrams verified, `68 s` elapsed; while single-core browser batch runs, worker is advancing `idle-backlog` item `doc8` in separate worktree `wt-doc8` documenting cache-key inputs). **Active:** Branch `claude/locale-pot-cache` (`pot3` — Incremental `.pot` extraction check; running 5-locale fixture test). |
