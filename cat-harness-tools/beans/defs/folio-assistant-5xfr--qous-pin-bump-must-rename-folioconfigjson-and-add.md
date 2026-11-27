---
# folio-assistant-5xfr
$schema: bean/1.0.0
title: qou's pin bump must rename folio.config.json AND add qaAxes in the same commit, or it silently loses both
status: completed
type: task
priority: normal
created_at: 2026-09-20T14:37:58Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-1swy
---


## What is true TODAY, measured, because I got it wrong first

I reported in session chat that "qou is running without that axis as of this
merge", after fencing `detangler-archimedean-wall` behind `qaAxes`. **That was
wrong, and the reason is the pin.**

`qou/.folio-assistant-pin` → `df28d02` (2026-09-07). Read at that commit:

- `folioOptionalAxes()` exists and reads `join(findContentRepoRoot(), "folio.config.json")`
  — literally, not through a constant.
- `detangler-archimedean-wall` is registered **unconditionally**.

qou carries `folio.config.json`. So at its pin qou is correctly configured and
gets the criterion. Nothing broke when #523 merged. The pin is doing exactly
the job `.folio-assistant-pin`'s own header describes — *"every number this repo
quotes is a function of BOTH the corpus commit and the platform commit"* — and
it bought the time this bean is written in.

## What breaks at the bump, and it is two independent things

The platform renamed `folio.config.json` → `harness.config.json` on 2026-09-18
(`6nfy`), **eleven days after qou's pin**, and made the old name a hard break
rather than a fallback — on the author's explicit instruction, recorded in
`6nfy`. So a bump past 2026-09-18 does two things at once:

1. **qou loses its entire harness config.** Not just the axis:
   `contentType`, `adapter`, `adapterModule`, `feedbackDir`, `viewer{dir,port}`,
   `simulators{dir,pyodideCache}`, `readme{linkStyle,publishRef,pagesBaseUrl}`.
   `readDeclaredFolioProfile` goes to the third state, which the platform's own
   config comment says "runs every criterion, and the paper adapter's
   LaTeX-shaped axes fire `critical` on prose that never reaches pdflatex."
   `contentType: "paper"` happens to be restored by `src/index.ts`'s default —
   **by accident, not by declaration**, which is the worst kind of working.
2. **qou loses `detangler-archimedean-wall`**, now fenced behind
   `qaAxes: ["archimedean-wall"]` (#523). qou has no `qaAxes` key at all today,
   so this is an addition, not an edit.

Doing only (1) loses the axis silently. Doing only (2) is **inert** — the new
platform will not read `folio.config.json` at all. They have to land together.

## The bump recipe, one file

```sh
cd ~/space_cats/qou
git mv folio.config.json harness.config.json
# then add the key:
#   "qaAxes": ["archimedean-wall"]
```

Nothing else moves. `harness.json` (the instance declaration, added 2026-09-20
in qou#7445) is a **different file** and is already correct — that PR's own
message says it is "inert against qou's current pin … preparation for the bump",
which is the same discipline as this bean and the reason the two must be bumped
as one change.

Then, per `.folio-assistant-pin`'s standing rule, **state the before/after issue
counts in the bump commit message.** Expect the archimedean-wall verdicts to
survive; expect anything the third state was over-running to stop.

## Why this is a bean rather than a chat message

The hazard is invisible from either repository alone. From folio-assistant, qou's
pin is not in the tree; from qou, the platform's rename is eleven days in a
future it has not adopted. Nothing fails today and nothing will warn at the
bump — `9ici` records that the one reader which still accepts the old name reads
**voices only**, so the bump's symptom is fifteen settings quietly gone while
voices keep working.

That is bean `xom7`'s shape one repository boundary out: the broken state and
the working state look identical from inside.

## Done when

The qou pin bump past 2026-09-18 lands with the rename and the `qaAxes` key in
the same commit, and its message quotes before/after counts. **Not actionable
from this repository** — this session has read-only access to qou.

## Not in scope

Bumping the pin. That is a qou decision with eleven-plus days of platform change
behind it, and this bean says only what must ride along when somebody makes it.

## 2026-09-20 — measured in a qou checkout, and it is worse than "add an axis"

Push access to qou was granted this session and the repo is attached, so the
claims below are read off the real tree rather than inferred.

**`.folio-assistant-pin` is not a submodule.** qou links the platform as a
sibling checkout through `scripts/setup-folio-assistant.sh`, and the pin is one
SHA on the last line of `.folio-assistant-pin`. That file carries its own rule,
which this bump has to honour: *"When you bump it, state the before/after issue
counts in the commit message — a change in count is a platform behaviour change
and should be looked at, not absorbed silently."*

**The config name is already dead at `main`, independently of #567.**
`folioOptionalAxes()` on `origin/main` reads:

```ts
resolveHarnessConfigPath(findContentRepoRoot())?.path
  ?? join(findContentRepoRoot(), HARNESS_CONFIG)
```

`HARNESS_CONFIG` is `harness.config.json`, and `folio.config.json` is **not a
fallback** — `harness-dirs.test.ts` asserts that deliberately ("the old name is
dead, not deprecated"). qou carries `folio.config.json`. So a bump to current
main leaves qou's config **entirely unread**, not merely missing an axis:

| key in `qou/folio.config.json` | what goes unread | observable |
|---|---|---|
| `qaAxes` (absent) | the archimedean-wall opt-in | criteria silently stop running |
| `simulators.dir` | `"simulators"` | README simulators section → third state |
| `contentType` / `adapterModule` | `"paper"` | masked — `paper` is also the default |
| `readme.pagesBaseUrl` | `https://litlfred.github.io/qou` | masked — same answer from the git remote |
| `viewer.dir`, `feedbackDir` | platform subpaths | unread |

Three of those are masked by a default that happens to agree. That is what
makes it the bad kind of break: the two that are NOT masked are the two nobody
looks at on a normal day.

**qou still works only because its pin predates the rename.** `df28d02` is
2026-09-07; the global name changed 2026-09-18. Eleven days of drift that no
gate in either repo can see, because qou's CI runs the pinned platform and the
platform's CI never sees qou.

## The sequencing, and why it is not "do it now"

The rename target depends on whether #567 has merged:

```
against main today   folio.config.json -> harness.config.json  (+ qaAxes)
after #567 merges    folio.config.json -> qou.config.json      (+ qaAxes)
```

`qou/harness.json` declares `name: "qou"`, so the second is what the instance
is actually called. Doing it now means renaming twice inside a day and leaving
a commit in qou's history pointing at a filename the platform retired the next
morning. **One commit, after #567 merges.**

## Done when

- [ ] #567 is merged and a platform SHA containing it exists.
- [ ] One commit on a `claude/` branch in qou: `git mv folio.config.json
      qou.config.json`, add `"qaAxes": ["archimedean-wall"]`, bump
      `.folio-assistant-pin`.
- [ ] Before/after issue counts measured against the SAME corpus commit and
      written into that commit message, per `.folio-assistant-pin`'s own rule.
- [ ] The archimedean-wall criteria are confirmed RUNNING after the bump —
      the whole point, and the thing a green sweep would otherwise hide.

## 2026-09-20 — MEASURED END TO END, and the pin bump is not what this bean says

Owner: *"skip qou"* — stopped before pushing anything. qou's working tree is
clean; the work sits on an unpushed local branch
`claude/instance-config-and-split-pin` in a container that will be reclaimed,
so everything worth keeping is below.

**The config rename is a footnote. The split is the blocker.**

At `df28d02` the platform exposed `content/pipeline/`, `schemas/`, `adapters/`,
`viewer/`, `ui/`, `computations/` and `scripts/` **at its repo root**. At
`2133f72` **not one of them is there** — all seven moved under `cat-harness/`.
qou reaches the platform through an in-repo symlink
`qou/folio-assistant -> ../folio-assistant`, and **33 qou files** import through
it:

```
20  ../folio-assistant/content/…
18  ../folio-assistant/schemas/…
 1  ../folio-assistant/scripts/…
```

plus `deploy/provision.sh` (`viewer`, `ui`), `.github/workflows/build-lean-mcp.yml`
(`adapters/mcp-server/Dockerfile`) and `content/schema/types.ts`.

**It is a one-line fix, not a 33-file sweep.** Point the symlink at
`cat-harness/` instead of the repo root, in `scripts/setup-folio-assistant.sh`.
Verified by doing it: every import target resolved
(`content/pipeline/value-registry-di`, `references-registry-di`, `validate`,
`schemas/lean-packages`, `schemas/types`), and `run-validate` ran to completion.
`setup-folio-assistant.sh` already anticipated this in prose — *"if the
folio-assistant repo lays those out differently, fix the subpaths in those
consumers"* — and the symlink turns out to be the one consumer.

**A third thing is required and this bean did not know about it.**
`dependents` became a REQUIRED field on every declared directory. qou's
`harness.json` declares one entry (`folio` → `content/`) without it, so
`readDeclaration` THROWS and nothing runs at all:

```
error: /home/user/qou/harness.json: 1 directory entry is missing the required
`dependents` field: folio.
```

`"dependents": "reproduce"` is the right value — `content/` is qou's folio root,
and the error message's own example list names `folio/` under `reproduce`.

### The before/after `.folio-assistant-pin` asks for

Same corpus throughout: qou `0e1b226df`, `content/quantum-observable-universe`.

| platform | issues | what changed |
|---|---|---|
| `df28d02` (current pin) | **2** | bibliography info line; one lemma with no Lean declaration |
| `a92d880` (#567 head) *before* the config rename | **5** | +1 `no qou.config.json` third-state warning, +2 simulator-asset |
| `a92d880` *after* the rename + `qaAxes` | **4** | the config warning clears |

**2 → 4 is not a regression, and the difference is worth stating precisely.**
The two added are `descent-rate-probe-sim` and `multi-level-jet-sum-sim`, both
reporting `simulators/*.html` absent on disk. That check did not exist at
`df28d02` — it is bean `023p`, merged as folio-assistant#560, *"a simulator
block's html: target is never checked"*. So the new platform finds two genuinely
missing files that the old one could not see. Both blocks are tagged
`todo-html`, so the absence is intended; the check says so and still reports it.

**The rename is confirmed working, by the warning that clears.** Before it, the
new platform said:

> *Render/AST validation not performed: the folio declares no content profile …
> (undetermined (no qou.config.json))*

which is #567's third state naming the exact file. After `git mv
folio.config.json qou.config.json` the warning is gone AND the run takes ~3
minutes instead of seconds — because render/AST validation actually runs now.
That timing change is the strongest evidence the config is being read: an
unread config skipped a whole validation phase silently.

### What the one commit has to contain

1. `scripts/setup-folio-assistant.sh` — symlink target `../folio-assistant` →
   `../folio-assistant/cat-harness`.
2. `harness.json` — `"dependents": "reproduce"` on the `folio` entry.
3. `git mv folio.config.json qou.config.json`.
4. `"qaAxes": ["archimedean-wall"]` in it.
5. `.folio-assistant-pin` → `2133f720eb32bbf3ae76da407fb1c3e27e48e4c4`, with the
   table above in the message.

### Still unverified, and it is the point of the bean

**Whether the archimedean-wall criteria actually RUN after the opt-in.**
`run-validate` is not the sweep; confirming the axis needs `qa-sweep` against a
wall-side block, and that was not reached before the stop. Until somebody runs
it, `qaAxes` is a line in a file rather than a measured behaviour — which is
exactly the silent-off failure this bean exists to prevent.

## Done when

- [ ] All five changes above land in ONE commit on a `claude/` branch in qou.
- [ ] `qa-sweep` confirms an archimedean-wall criterion RUNS, on a named block.
- [ ] The before/after table is in that commit's message, per
      `.folio-assistant-pin`'s own rule.

## 2026-09-22 — MEASURED against qou's live file, not asked about

Read directly from `litlfred/qou@main:harness.config.json` (blob
`a2d53130`) rather than put to the owner as a question, per
`interaction-modality` §4.2: *"do not ask a question whose answer you could
look up."*

**Half of this bean has already landed, and the half that has not is the half
that silently loses a check.**

| | state |
|---|---|
| `folio.config.json` → `harness.config.json` | **DONE** — the file exists under the new name and carries a `_comment` explaining the rename and that the old name is not a fallback |
| `feedbackDir` corrected to `.folio-feedback` | **DONE** |
| `"qaAxes": ["archimedean-wall"]` | **ABSENT** — there is no `qaAxes` key at all |

### What is actually lost, which is LESS than this bean assumed

The bean says the archimedean-wall criteria "silently stop running". Checked
against the registry, that is true of one of the two domains and not the
other, and the distinction is written on the fence itself
(`qa-criteria-registry.ts`, above the `framework` block):

- **`wall` survives.** `q-usage-audit.ts` calls `checkWallSide` and
  `checkBaseRingMinimal` directly, so closing the axis leaves qou's own audit
  computing them. The registry comment calls this its "direct-call safety net".
- **`framework` does not.** `checkFrameworkCanonical` has no caller outside the
  registry's dispatch table, so with no `qaAxes` key qou is not running it at
  all, and nothing says so.

So the live consequence is one domain, not two — and it is the domain the
registry already flagged as having no net.

### The fix, and why it is not mine to apply

One key in one file:

```json
"qaAxes": ["archimedean-wall"]
```

`litlfred/qou` is a mathematics repository, where the owner's standing rule is
to ask before opening a PR and to make no speculative change without explicit
consent. So this is reported, not done.

## 2026-09-22 — the remaining half is in a PR, and the count was wrong here too

Owner said open it. `litlfred/qou` issue #7447, draft PR #7448, commit
`c44aed2a`: one key, `"qaAxes": ["archimedean-wall"]`, with the rationale
comment this file's house style asks for.

**Correction to the entry above.** It said the axis gates `framework` (1) and
`wall` (4). It gates **six** criteria, not five — `detangler-archimedean-wall`
is fenced on the SAME axis, deliberately, so a folio "cannot end up
half-fenced". Read off the five gate expressions in `qa-criteria-registry.ts`:

| domain | criteria |
|---|---|
| `framework` | `framework-canonical` |
| `wall` | `wall-side-correct`, `wall-side-statement`, `wall-side-proof`, `wall-base-ring-minimal` |
| `detangler` | `detangler-archimedean-wall` |

plus `DEVILS_ADVOCATE` and `DETANGLER_WATCHER_CRITERIA`, gated on the same axis
so a bucket cannot name a criterion the registry never registered.

The earlier entry's "`wall` survives" also needs narrowing: the COMPUTATION
survives where `q-usage-audit.ts` calls `checkWallSide` and
`checkBaseRingMinimal` directly, but the REGISTERED CRITERIA do not, so there
are no QA sidecar verdicts for any of the six.

### `q-usage` is a second absent axis, and NOT in the PR

Seven more criteria behind a separate `qaAxes` value. Equally absent, same
cause. Left out deliberately and raised in #7447 as its own decision — turning
on seven mathematics criteria nobody asked for is the speculative change this
owner's rules forbid.

### Method, stated

A STATIC read of the gate expressions, not a runtime before/after count:
`folioOptionalAxes()` resolves the folio from the working directory, so a
runtime flip needs a synthetic folio tree. The gates are exact and directly
readable, so the static read is the better evidence here — but it is a
different kind of evidence and the PR says so.

## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns litlfred/qou's `.folio-assistant-pin` bump (renaming `folio.config.json` and adding `qaAxes` in the same commit), a change made in qou. The copy in the `cat/cat-harness/beans` store (litlfred/folio-assistant) is the live one. Keep it open there.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository" (qou pin bump); no done-when met. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

## Kept from cat-harness-tools' copy (copy sync, 2026-10-24)

These notes were only in this copy. The newer copy from the bean branch is above them.

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns litlfred/qou's `.folio-assistant-pin` bump (renaming `folio.config.json` and adding `qaAxes` in the same commit), a change made in qou. The copy in the `cat/cat-harness/beans` store (litlfred/folio-assistant) is the live one. Keep it open there.


## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns litlfred/qou's `.folio-assistant-pin` bump (renaming `folio.config.json` and adding `qaAxes` in the same commit), a change made in qou. The copy in the `cat/cat-harness/beans` store (litlfred/folio-assistant) is the live one. Keep it open there.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository" (qou pin bump); no done-when met. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-29T08:00:00Z_ (drain lane E, https://claude.ai/code/session_01Qmmkt6hTCZSkeyx315exLo). **Closed. Re-derived on qou `main`, nothing new needed:**

- qou c44aed2a (2026-09-22) added `"qaAxes": ["archimedean-wall"]`. It opens all six fenced criteria, not just `detangler-archimedean-wall`.
- qou dad33d97 (2026-09-26) renamed the config to `qou.config.json` (`<name>.config.json`, since `harness.config.json` was retired too) and fixed `feedbackDir`.
- `folio.config.json` no longer exists on qou `main`. The config notes that it was removed in the same commit as the pin move to 26c5d37b9 (qou-8321), so the rename and the axis landed together, as this bean asked.
- `.folio-assistant-pin` is now `0fba270b`.




## Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns litlfred/qou's `.folio-assistant-pin` bump (renaming `folio.config.json` and adding `qaAxes` in the same commit), a change made in qou. The copy in the `cat/cat-harness/beans` store (litlfred/folio-assistant) is the live one. Keep it open there.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository" (qou pin bump); no done-when met. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
updated_at: 2026-10-29T08:00:00Z
parent: folio-assistant-1swy
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
updated_at: 2026-10-16T06:30:00Z
parent: folio-assistant-1swy
```
