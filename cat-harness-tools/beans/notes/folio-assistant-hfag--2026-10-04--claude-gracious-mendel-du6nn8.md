---
# note on folio-assistant-hfag from claude/gracious-mendel-du6nn8
$schema: folio-bean-note/v1
bean: folio-assistant-hfag
branch: "claude/gracious-mendel-du6nn8"
created: "2026-10-04"
---
## Merge Manager handover, 2026-10-04 ~10:00Z

The previous Merge Manager stalled. This session took over the role.

- **Owner release (2026-10-04, chosen from options):** "Land all 3". #2069 → `509cd43`, #2068 → `b54a447`. Each merge was pinned to its tested head, and `merge:steward` was re-run between merges.
- **#2059:** admitted but `dirty` after #2069 landed. It waits for its `merge:main` round. It is still released.
- **#1898:** held by the owner's `vqlp` block (09:10Z comment). The owner later delegated "when it lands" to the steward, but a content block is not a timing decision.
- **Owner instruction:** dispatch unblockers for the not-green PRs while the authors are paused, without spending GitHub resources. That is recorded as a new section in `merge-queue.md`: "When the authors stall: the steward dispatches unblockers".
- `merge:steward` crashed on a fresh clone until `git submodule update --init` was run.

## Standing release — owner, 2026-10-04 ~10:45Z, verbatim

> "as things come in and geen, then merge"

The steward lands every member that `merge:steward` admits (owed CI `green`, not `refused`), re-running the table after each merge. This replaces the earlier per-PR question on #2073 ("wait for ready:"). A content block the owner recorded on a PR, such as `vqlp` on #1898, still holds, because it is a ruling on that PR's content, not on its timing.

## Owner rulings, 2026-10-04 ~12:20–13:00Z, verbatim

> "my approcal - that counts for the PRs that are in queue.   new PRs need my approval exp-licity (through you or siblign)"

> "approve all 6" (#2075, #2076, #2078, #2079, #2080, #2082, all opened after 12:15Z)

> "as part of merge manager skill you need to ACK a new PR in queue on its bean"

Landed this session: #2069, #2068, #2059, #2073, #2062, #2070, #2052, #2079.

## 13:20Z: owner approvals, chosen from options

- "Approve all 4": #2083, #2084, #2085, #2086.
- "zmdo session drafts it": the typed record of the human merge decision (`release` on the queue entry: `releasedSha`, `merge:queue:decide`, `merge:guard` read-back). session_01Ga3HjmX3ag9vTgZWDSmsFi drafts it against #2065's branch.

Landed since: #2076 (`d2432b1`) and #1581 (`df31bb2`).

## 14:00Z: all-PR review, and owner answers

- Review: 26 open, 8 in the queue. Every open PR now has an entry with a `status` (#2096).
- "Approve all 6": #2089, #2090, #2093, #2094, #2095, and #2082 re-approved WITH its new scope (it had grown from a bean close into an 11-file code change after the first approval).
- On the 6 stale PRs (#1802, #1809, #1860, #1884, #1918, #1964), verbatim: "assume authors stalled out.  show detailed anayslis of what was supersceded.  anything salvagable?" Read-only analysis agents dispatched.

## 2026-10-04 ~17:15Z — owner ruling: #2094 admitted to Train B on train CI

Asked: #2094's head stays conflicted (main moves inside its ~8-min merge+regen),
so GitHub runs no pull_request CI on it. Locally 235/235 gates green, signed,
owner-approved via takeover. Admit to Train B with the train PR's CI standing
as its CI?
Owner: **"Admit on train CI (Recommended)"**. Train B = #1918 + #2093 + #2094;
the substitution is recorded on the train PR.

## 2026-10-04 ~17:40Z — owner ruling: trains must STACK; Train B dissolved

Owner: "We need to require that a merge train has PRs that are stacked one on
top of another. You're wasting too much time resolving conflicts in the train
and blocking other stuff from happening. Dissolve the train that you have and
just merge what you can."
Asked: #2113 was already green + signed; land it as the last train, or dissolve?
Owner: **"Land #2113, then no trains (Recommended)"**.
Train B (#1918, #2093, #2094) dissolved; each lands alone after merging main on
its own branch. Rule added to merge-queue §"A train admits only members that
STACK cleanly (STRICT)".

## 2026-10-04 ~18:42Z — owner ruling: prioritise #2066 to end the LSI treadmill

Asked: every landing re-conflicts every open PR on the LSI pair, LSI page and
harness.json (#1918, #2093, #2094, #1898 all conflicted after #2107, ~12 min
regen each). #2066 removes the LSI trio from main but is handed back (lb8h).
Owner: **"Prioritise #2066 (Recommended)"**. A Merge Manager takeover agent
finishes #2066 (merge main, CI green, sign); session 01VfkKoc lands it, since
my session's agent did the work (guard check 2).

## 2026-10-04 ~19:58Z — owner standing release for 8 hours

Owner: **"for next 8 hours, all thats green can merge. keep prodding siblings
(direct message) to keep the merge queue stoked"**. Standing release until
~2026-10-05 04:00Z: any PR that is signed, green, clean against main and passes
merge:guard may land without a per-PR yes. merge:guard is still never bypassed;
PRs my session or its agents authored are still landed by another session
(check 2).
