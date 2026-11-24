---
name: integration-watcher
user_invocable: false
description: >
  Abstract parent skill for domain-specific **integration watchers**.
  Encodes the shared mechanics — Monitor on `origin/main`, PR
  subscriptions, per-event QA dispatch, queue + ledger, idle backlog
  sweep, idle author-ask dispatcher, watch-PRs-you-prepare protocol,
  voice-pass on PR diff, witness-drift CI recovery, billing-quick-fail
  flake handling — that every concrete watcher inherits. Children
  fill nine domain-specific slots; everything else is shared here.
allowed-tools: Read Edit Write Bash Grep Glob Agent Monitor Skill
consulted: true
---

# integration-watcher (abstract parent)

A concrete watcher (this skill's child) **watches incoming activity**
on a focused content axis — proofs, derivation discipline,
compute-chain wiring, voice, structure, or any future domain — runs a
domain QA pipeline on every detected change, queues findings, attempts
auto-discharge where possible, and asks the author for the rest.

Concrete children fill the slots below for one QA axis each. Typical
axes (a project picks the ones it needs):

| Child | Domain | Goal |
|-------|--------|------|
| children a content type's layer ships | e.g. for a paper folio: proof QA, cross-layer compute wiring, structural QA (graph + density) | That layer names this parent from its side and lists its children; this table does not name them |
| `canonical-watcher` | Derivation discipline | No undisclosed free parameters, no numerology, no coefficient fits (per the project's derivation-discipline statement) |
| `one-voice-integration-watcher` | Content-block voice + fit + framework | Scholarly voice (narrative + proof bodies), zero AI-slop, block fit to section/chapter, canonical-vs-deprecated notation; persists per-block `<block>.qa.json` audit reports (multi-reviewer, hash-keyed staleness) |
| `devils-advocate-watcher` | Adversarial "why is this wrong" review | For every block + formal sibling, construct the strongest referee objection; multiple adversarial lenses + adjudicator; emits `da-*` sidecars; gated by the refutation-scope rule + corpus-grep checklist |

## Domain slots (every child must fill)

| Slot | Where in this parent | What the child provides |
|------|----------------------|-------------------------|
| **A. Goal statement** | top of child | One-paragraph driving function |
| **B. §3 trigger filter** | §3 | Domain-specific patterns: which file paths / commit subjects / PR comment keywords trigger the §4 pipeline |
| **C. §4b dispatch table** | §4b | Which specialist skills/scripts to invoke per event, in parallel |
| **D. §4c finding taxonomy** | §4c | The set of violation/finding kinds the domain recognizes |
| **E. §4d discharge bands** | §4d | Domain-specific examples of Auto-discharge / Author-assist / Defer findings |
| **F. §4e author-ask templates** | §4e | Domain-specific question forms (numbered choices, file/line citations) |
| **G. §5a backlog discovery** | §5a | What to enumerate from the codebase at backlog-sweep time |
| **H. §5b prioritisation** | §5b | Domain-specific ranking rule for the backlog |
| **I. §6 invariants** | §6 | Per-commit checks the watcher enforces on its own branch |

Everything else — §1, §2, §4a, §4f, §5c-§5m, §7-§9, anti-patterns,
checklist — is defined here and inherited verbatim.

## 0. Invocation as `/integration-watch [args]`

This parent skill is **abstract — `user_invocable: false`**.
The `/integration-watch` slash command is implemented by
[`integration-watch`](integration-watch.md), which acts as the single
entry point and dispatches to one or more concrete children. Keeping
the dispatcher and the abstract parent separate avoids duplicating
the slash-command routing.

This section documents the **invocation grammar** that the dispatcher
must implement; the parent only describes shared mechanics that every
concrete watcher inherits.

When the user invokes `/integration-watch` directly the dispatcher:

| User input | Behaviour |
|------------|-----------|
| `/integration-watch` (no arg) | **Ask which.** Use `AskUserQuestion` capped at 4 chips, role-gated. Do NOT auto-pick. |
| `/integration-watch <axis>` | Dispatch the named child watcher |
| `/integration-watch all` or comma/space list | Dispatch **all** named watchers in parallel — each gets its own Monitor, its own queue/ledger, its own PR subscription set (deduped). |
| `/integration-watch <unknown>` | List the available children, reject the unknown name, re-prompt via `AskUserQuestion`. |

**No-arg full-context preamble (per §4e rule):** before the
`AskUserQuestion`, write a short chat message naming each available
watcher and its one-line QA axis, then surface the structured chip set.

## 0a. Repo-owner preferences (binding for all watchers)

Per [`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md) the repo owner types with
difficulty and prefers a small set of binding behavioural defaults.
Every child inherits them.

1. **One branch / one PR for related things.** Group many related
   fixes (especially backlog items) into a single branch + single PR.
   Don't open small per-item PRs. See §5j step 1 ("Cluster
   aggressively") and §5g step 5 for the merge-prompt sequencing.
2. **Don't spawn more than one agent at a time without explicit
   consent.** Sequential foreground work is the default; parallel
   agent dispatch requires affirmative user approval per batch. See
   §5m for the full rule and the narrow exceptions (read-only tool
   calls in one response are still fine; agent spawns are the
   constraint).
3. **Group a lot — backlog batches are large by default.** When the
   backlog has 4-20 related items in the same finding bucket, do them
   all in one branch, stacked as multiple commits if they need
   different commit messages. Don't split into N small branches.

When in doubt: cluster more, dispatch fewer agents, ask before
parallelising.

## 0c. Sibling coordination

Per [`coordinate`](coordinate.md), on coordinating intent with sibling
branches:

- **At workplan start** (new branch / new tranche), list active
  sibling PRs via `mcp__github__list_pull_requests` (open) and
  recently-updated `claude/*` branches via `mcp__github__list_branches`.
  Identify siblings whose scope overlaps (same chapter, same source
  file, same domain).
- **Post a 1-3 sentence intent comment** on each genuinely-overlapping
  sibling PR. Format: "Starting <theme> on <branch>; will touch
  <file or scope>; flag conflicts to me." Don't comment on every
  sibling; don't make noise on the PR. Skip if no overlap.
- **Inform siblings of critical findings** as they land. If you
  discover something a sibling is waiting on, post on the sibling PR
  proactively — don't wait for them to step on the rake.
- **During idle (per §0b 5-minute trigger)** ALSO check sibling PRs
  for coordination updates that affect your branch's scope.
  `mcp__github__pull_request_read get_comments` on each watched
  sibling; new comments addressed to "all watchers" or referencing
  your branch's keywords are actionable backlog items.

## 0d. AskUserQuestion accessibility

Per [`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md) and its `low-dexterity`
profile, which defaults `AskUserQuestion` to `multiSelect: true`: the repo
owner types with difficulty.

- **Default `multiSelect: true`.** Single-select forces the user to
  type "1, 2" as free text when multiple options apply. Most watcher
  decision points are not mutually exclusive, so multi-select is the
  safer default.
- **Prefix questions with 🟡** to mark the agent as waiting / blocked
  on input. Consistent use lets the user scan chat history and find
  every pending decision.
- **Phrase questions to allow optional notes**: "Pick all that apply;
  add 'Other' with a free-text note if needed."
- Single-select is OK only for genuinely mutually-exclusive actions.


## Where each section lives

The parts that apply to one phase are in files beside this one, so an agent
reading this file before acting reads all of it. Section
numbers are shared across them, because children cite the parent by number
(`parent §4b`, `parent §5m`).

| § | what | where |
|---|---|---|
| `0`, `0a`, `0c`, `0d` | invocation, and the policies binding on every watcher | **here** — read before you start |
| `0b` | idle-time backlog policy (5-minute trigger) | [`integration-watcher/idle-backlog.md`](integration-watcher/idle-backlog.md) |
| `1`–`4` | setup, active watching, trigger filter, per-event QA pipeline | [`integration-watcher/lifecycle.md`](integration-watcher/lifecycle.md) |
| `5` | idle backlog sweep, and the handover issue template | [`integration-watcher/idle-backlog.md`](integration-watcher/idle-backlog.md) |
| `6`–`9`, anti-patterns, checklist | invariants, output style, integration, role gating | **here** |

**Running a watcher:** read this file, then `lifecycle.md`. You reach
`idle-backlog.md` only when the queue is empty and the idle trigger fires.

## 6. Goal-driven invariants

Children fill **Slot I** with the domain's invariant checks. The parent
enforces this pattern: every invariant is checked before every
own-branch commit; failure blocks the commit, queues the violation as
`critical`, and asks the author.

## 7. Output style

- One line per event when nothing changed (`<sha>  no <domain> scope`).
- A short structured block when findings exist:

  ```
  <source> <sha> — <msg>
    findings: N critical, N major
    discharged: N  asked: N  deferred: N
    queue: M (K in-progress)
  ```
- An author ask when escalating (see §4e).
- End-of-session: tail of the ledger + queue stats.

## 8. Integration

- **Built on**: `watch` (Monitor scaffolding), `coordinate` (PR triage
  helpers).
- **Dispatches**: see each child's Slot C.
- **Produces**: `beans/${NAME}-queue.json` (live state) +
  `beans/${NAME}-ledger.md` (event log).
- **Complements** other watchers — each owns one axis. Coordinate via
  `/coordinate` if the user is running more than one.

## 9. Role gating

- **reader**: may run in audit-only mode (queue + ask; no edits, no
  commits, no PR comments).
- **collaborator**: may auto-discharge Auto-discharge band findings, may
  commit on this branch, may post asks on PRs.
- **owner**: same as collaborator plus may commit to main when
  explicitly requested (still requires per-commit user approval).

## Anti-patterns (shared across all children)

- ❌ Re-implement scanner/analyser logic here. Always delegate to
  existing specialists / scripts.
- ❌ Subscribe to **every** open PR. Only last-7-day-active set + own PR
  + newly-opened (per TICK).
- ❌ Open > 1 ask per round on the same block. Batch findings.
- ❌ Edit `.ts` manifests to add a `status:` field (status is derived).
- ❌ Touch protected files (the deployment whitelist files, etc.).
- ❌ Hand-edit witness JSON to "fix" drift.
- ❌ Auto-merge a PR without explicit author approval.

Children add their own domain-specific anti-patterns.

## Checklist (shared across all children)

- [ ] Queue + ledger initialised under `beans/`
- [ ] Main baseline SHA stashed
- [ ] Monitor armed on `origin/main` with TICK heartbeat
- [ ] Subscribed to own PR + every sibling PR active in 7 days
- [ ] Auto-subscribe on every TICK for newly-opened PRs
- [ ] Per-event pipeline delegates to specialists in parallel
- [ ] Auto-discharge band uses scanner-verified mechanical fixes
- [ ] Author asks are one-per-block, batched per round
- [ ] Backlog sweep prioritised per Slot H
- [ ] Invariants checked before every own-branch commit
- [ ] GitHub blob URLs (`.md` first) included in every author ask
- [ ] Prepared PRs followed up per §5g (subscribe + copilot review +
      merge prompt)
- [ ] Voice sweep applied or noted n/a on every prepared PR before merge
      prompt (§5h)

