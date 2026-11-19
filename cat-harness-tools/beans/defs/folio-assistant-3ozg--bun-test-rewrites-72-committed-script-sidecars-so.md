---
# folio-assistant-3ozg
$schema: bean/1.0.0
title: bun test rewrites 72 committed script-sidecars, so bun run cat gates reports NOT clean on every branch, main included
status: completed
type: bug
priority: normal
created_at: 2026-09-27T05:06:01Z
updated_at: 2026-09-27T07:15:00Z
parent: folio-assistant-1xhc
---

Measured 2026-09-27 on pristine main `c6960465301`, and the same on 2026-09-26 at `8fb8a041a8e`.

## What happens

A full `bun test` rewrites all 72 files under `cat-harness/content/pipeline/script-sidecars/`, changing only three fields in each:

    last_run_at     wall-clock time of this run
    last_run_sha    the checked-out HEAD
    engine_version  the local bun (bun-1.3.11 here; the committed copies say bun-1.3.14)

Nothing else in the tree changes. The writer is `saveQaScriptSidecar` (`qa-utils.ts`), and its callers are `script-sweep.ts` and `qa-sweep.ts`.

## Why it matters

`bun run cat gates` has a tree-mutation detector, which is how bean `ymsu` was made visible. It therefore ends *'every gate passed, and the run is NOT clean — 1 gate(s) changed the tree'* with exit 1, on every branch, pristine main included. A signal that is always red is one people stop reading, and then it cannot report the next real in-run repair, which is the `ymsu` failure class this detector exists for. This is the same class as `ymsu` (in-progress, another session's), but a different writer, and `ymsu` does not mention these files.

## Not yet isolated

Run alone, none of these writes the sidecars: `qa-review`, `profile-conformance-axis`, `corpus-gate`, `check-command-paths`, `lean-ref-coverage`, `qa-checker-discovery`, `pipeline-resolution`, `qa-sweep-merge`, `qa-witness`, `qa-tools`, `usage-paths-self-reference`, `publish-block-qa`. The full suite always does. So it is either an untried file or an interaction between files.

## Done when

- [x] the test that triggers the write is named — `init-folio-qa.test.ts`, by bisection (below)
- [x] the volatile fields stop causing writes — `saveQaScriptSidecar` no longer counts `engine_version` as a change (owner chose this over a temp-root override for the test alone)
- [x] `bun run cat gates` ends clean — 167 of 167, exit 0, no tree mutation (measured on this branch, based on main)

_2026-09-27T05:19:35Z_ — Claimed by claude/sleepy-babbage-ls90iz — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## `rmcf` is the same defect, filed a day earlier — and it holds four unanswered remedies

Cross-reference added by another session; **status untouched, this is not mine to
resolve.** `rmcf` (2026-09-26) records the identical churn: 72 files, the same three
fields, the same `bun-1.3.14` committed against `bun-1.3.11` local.

**This bean is the better record** — `rmcf` never named the writer, and it only saw
the churn on a branch, where this one measured pristine `main` at two commits. So
work this one.

What `rmcf` has that this does not is **four remedies put to the owner and still
unanswered**:

1. stop recording `engine_version` at all;
2. stamp only on a real change (the `script_hash` / `source_file` fields, which do
   **not** move — verified across all 72 on 2026-09-27);
3. move run provenance out of the committed sidecar entirely;
4. document the discard as intended behaviour.

Option 2 looked right to the session that filed `rmcf`, on the ground that the three
churning fields are provenance while the two stable ones are the measurement — so a
sidecar that stamped only on a real change would stop moving without losing anything
a reader uses.

One caution that belongs with the remedy, from `#1430`'s `sfjo` rule: **read what a
regeneration writes before committing it.** Committing this churn stamps a
*downgrade* — `engine_version` goes backwards whenever the local bun is older than
main's — as though it were a fresh measurement. That is why the standing practice has
been to discard rather than commit, and why option 4 is not merely a cop-out: it at
least makes the discard deliberate.
## Independent confirmation from a SECOND container, 2026-09-27
Measured on the session branch `claude/3x2o-remote-stub-banner` while
establishing whether the tree-guard finding on PR #1437 was that branch's: a
detached `git worktree` of pristine `origin/main` at `81586293ea5`, full
`bun test`, then `git status`. **72 paths, exactly the ones above**, with
`bun-1.3.11` locally against the committed `bun-1.3.14`, and `script_hash`
unchanged throughout.
Recorded only as evidence that the shape is not container-local. The reading
that went with it -- that the fix had to be on the writer side rather than a
pin -- is **superseded by the entry below**, which is later and has the part
this measurement lacked: `saveQaScriptSidecar` already skips the write unless a
substantive field changes, so `engine_version` was the whole cause and pinning
it is the cause-level fix.
---

## 2026-09-27 — the CAUSE is pinned. Not closed, and the reason is precise.

The owner chose "pin the runtime" from a set of options. Landed: `.bun-version`
holding `1.3.14`, all **22** `oven-sh/setup-bun@v2` sites across 12 workflow
files carrying that literal explicitly (18 said `latest`; **four said nothing at
all** and took the action's default), a `bun` row in `upstream-pins.json`, and
`check:bun-pin` asserting the 22 agree with the file.

### What this bean was missing, and it is the reason a pin is the cause-level fix

This entry lists three volatile fields — `last_run_at`, `last_run_sha`,
`engine_version` — as though all three had to be dealt with. They do not.
`saveQaScriptSidecar` **skips the write entirely** unless a SUBSTANTIVE field
moved, and its own docblock records that guard being added for this exact churn
("76 modified files after one qou run, none of them a real change"). The two
`last_run_*` fields are excluded from that comparison. `engine_version` is not —
correctly, since a verdict produced by a different engine is a different verdict.

So `engine_version` is the only field that was ever *causing* a write, and the
other two were passengers. Remove the difference and all three stop moving. That
also means the bean's own remedy — "it writes into a temp directory" — would
have treated a symptom.

### The measurement that shifts the blame off agents

Upstream Bun's newest release is **`bun-v1.4.2`** (`git ls-remote`, 241
`bun-vX.Y.Z` tags). CI ran `bun-version: latest`, so **CI itself would have
rewritten all 86 sidecars to `bun-1.4.2` on its next sweep**, whatever any agent
did. The 86 already held two values — 72 at `bun-1.3.14`, 14 at `bun-1.3.11` —
so the committed record was mixed before any of this.

And that is where the `72` in this bean's title comes from: it is not a blast
radius, it is the count of sidecars NOT already at the local Bun (1.3.11 in this
container). A container at 1.3.14 would see 14 move instead.

### One defect found in the machinery while using it

`upstream-pins.json` could not express Bun at all. `assessPin` compared the pin
literal to the tag list with `rel.includes(pinned)`, and `setup-bun` takes
`1.3.14` while upstream tags `bun-v1.3.14` — so the verdict was `unknown`, which
sets exit 2, which would have made the weekly watchdog report itself **blind
forever**. That is its documented failure mode pointing the other way: not
claiming health while blind, but crying blind while healthy, which trains a
reader to stop looking.

Fixed with an optional `PinDef.tagPrefix`, compared on the tag form while every
message still reports the literal a reader will find in `pinnedIn`. The existing
`just-the-docs` pin has no prefix and its 15 tests pass unchanged. The checker now
reports `▲ Bun runtime | 1.3.14 | bun-v1.4.2 | behind` — which is the machinery
working: `behind` maintains the tracking issue and only `unknown` fails the job,
and `check:upstream-pins` is deliberately NOT a step in `code-quality-gates.yml`,
so a behind pin does not redden CI.

### Why the boxes are still unticked

- **"the test (or interaction) that triggers the write is named"** — still not
  named. The pin makes it not matter in CI; it does not identify the caller.
- **"it writes into a temp directory, or the three volatile fields stop being
  committed"** — neither. The fields stay, and the difference that made them move
  is gone instead.
- **"`bun run cat gates` on pristine main ends clean, not 'NOT clean'"** — **in CI,
  yes**, once CI runs 1.3.14. **In an agent container whose Bun differs, no.**
  This container runs 1.3.11, so `bun test` here still rewrites 72 files. The pin
  cannot reach a container image the repository does not control.

So the always-red signal is fixed where CI observes it and survives where agents
observe it, and agents are who reported it. Stating that rather than ticking the
box.

### The version is a judgement, and it is the owner's

`1.3.14` is the version the repository's own artefacts were produced with — the
status quo made explicit, requiring no mass regeneration. The alternative is
`1.3.11`: it would make BOTH CI and today's agent containers clean, at the cost
of one commit regenerating 72 sidecars and of pinning an older patch than the
artefacts record. Pinning `1.4.2` is not on the table here at all — that is
ADOPTION, and `processes/upstream-version-adoption.bpmn` makes the accepting step
a `bpmn:userTask` in a person-only lane.

Put to the owner as a follow-up rather than decided here.


---

## Duplicate found on merge: `rmcf` is the same defect

Merging `origin/main` brought in bean `rmcf` — *"72 script sidecars churn on
every gates run because engine_version records the CONTAINER, and it went
1.3.14 -> 1.3.11"* — opened by another session with the **same measurement**:
72 files, the same three changed fields, the same two engine values.

Not deleted and not merged. Neither is wrong, and a scrapped or deleted bean
stops a sibling reconstructing the reasoning. This one holds the claim and the
fix (the Bun pin, `check:bun-pin`, and `PinDef.tagPrefix`), so `rmcf` carries a
pointer here rather than the reverse.

Worth noting that THREE beans reached this population independently within a
day — `3ozg`, `rmcf`, and `ymsu` for a different defect over the same files.
That is not three people being careless; it is what an always-red signal does:
every session that runs `bun run cat gates` on a clean tree sees it, and nothing
told them it was already written down.

## Named, 2026-09-27: `init-folio-qa.test.ts`, and why

Bisection over `cat-harness/scripts/tests/` (432 files, 9 halvings) ends at one file, and that file alone reproduces all 72 rewrites. Its second test, *"swept from the repository root, as CI does, a subfolder folio's verdicts land at ITS root"*, spawns the real `qa-sweep.ts` against a throwaway folio in a temp directory.

The sweep then saves every script sidecar under its **own** `REPO_ROOT` (`qa-sweep.ts` near line 745, `saveQaScriptSidecar(sidecar, REPO_ROOT)`), which is the platform checkout, whatever it swept. The code comment says this is deliberate: those sidecars describe the platform's own checker scripts. So a sweep of **any** folio, including a test fixture, restamps the platform's committed sidecars with the current time, HEAD and bun version.

That is why none of the other candidates wrote them alone: this is the one test that runs a real sweep rather than a helper.


## Summary of Changes

The cause was already half-fixed: `saveQaScriptSidecar` skipped a write when nothing substantive changed. But it counted `engine_version` as substantive, and the committed sidecars carry CI's `bun-1.3.14`, so any run under another bun rewrote all 72. `init-folio-qa.test.ts` performs a real sweep, which is how `bun test` came to do it.

- `engine_version` is dropped from the comparison, together with the two `last_run_*` fields. All three describe the run rather than the checker, and no reader uses a script sidecar's `engine_version` for freshness.
- The test that asserted *"DOES rewrite when the engine version changes"* now asserts the opposite, and its comment says why the reversal was made. A new test checks that a real content change still records the engine it ran under.
- Verified: the sidecar tests pass 9/9; `init-folio-qa.test.ts` now leaves 0 sidecars changed; and `bun run cat gates` passes 167/167 and ends clean, which it has not done on any branch while this bean was open.

**This implements `rmcf`'s option 2** (stamp only on a real change), on the owner's choice of "skip no-op writes" put to them in this session. It was built before the cross-reference above was seen, and arrived at the same remedy independently. `rmcf`'s option 1 (stop recording `engine_version`) is NOT taken: the field is still written whenever a real change writes, so a reader still sees the engine of the last content change. The `sfjo` caution holds too: this fix means there is no churn left to commit or discard.

## Combined with #1442's pin, 2026-09-27 — owner's choice "keep both"

#1442 pinned Bun to 1.3.14, which makes CI consistent, and left this bean open for the residual: *"This container runs 1.3.11, so `bun test` here still rewrites 72 files. The pin cannot reach a container image the repository does not control."* The write-skip change above closes that residual. The owner chose to keep both: the pin makes the recorded engine consistent where the repository controls it, and the skip stops a run under any other engine from rewriting files whose checker did not change.

On #1442's reason for keeping `engine_version` substantive (*"a verdict produced by a different engine is a different verdict"*): script sidecars hold no verdicts. Verdicts live in block sidecars, and nothing reads a script sidecar's `engine_version` for freshness; `entryIsFresh` compares hashes. So the field now records the engine of the last real checker change, and the two changes do not conflict.

## Done-when 1 has no test to name — 2026-09-27, from a different session

`[ ] the test (or interaction) that triggers the write is named`

**There is no such test.** The trigger is the `engine_version` term in
`saveQaScriptSidecar`'s write-skip guard plus an off-pin engine. That was
already implicit in `df579167c71`'s own analysis; it is stated here because the
Done-when list still asks for a test and the next agent will go looking.

I went looking. Bisecting `bun test` by directory, resetting the sidecars
between each:

    cat-harness/schemas      dirty=0
    cat-harness/src          dirty=0
    cat-harness/test         dirty=0
    cat-harness/adapters     dirty=0
    folio-assistant-core     dirty=0
    who-iris                 dirty=0
    large-datasets           dirty=0
    smart-trust              dirty=0

which narrows it to `cat-harness/scripts/tests/` — 435 files — and would never
have terminated, because the cause is not in any of them. Reading
`.bun-version`'s git log took one command and answered it.

## What made the hunt possible, and it is now fixed

`qa-utils.ts` justified the guard with *"Everything except the two
`last_run_*` fields is content-derived, so comparing on those alone is the
right test."* That sentence rules the environment out **by construction**, so
both `rmcf` and this bean concluded a test must be doing it. PR #1451 corrects
it in place — not by deleting it, since deleting leaves the term unexplained and
re-opens the DROP-the-field fix the owner already rejected.

## The residue, measured, and I cannot fix it here

The pin is 1.3.14 and CI runs it. The committed corpus does not agree with it:

    72 sidecars   engine_version: bun-1.3.14
    14 sidecars   engine_version: bun-1.3.11   <- pre-pin residue

The 14: detangler-archimedean-wall, framework-canonical, proof-compile-cost,
proof-no-cost-regression, proof-no-placeholder-stub, q-usage-archimedean-in-
categorical-chapter, q-usage-fixed-q0-leak, q-usage-modulus-vs-real-mismatch,
q-usage-narrative-chapter-mismatch, q-usage-positivity-implicit,
q-usage-regime-detected, q-usage-root-of-unity-undeclared, wall-base-ring-minimal,
wall-side-correct.

They need one `qa:sweep` on a machine at the pin. **This container is at 1.3.11**
and installing 1.3.14 is refused by the environment's network policy (403 from
the proxy on `bun.sh/install`), so I cannot produce them. Hand-writing
`bun-1.3.14` into them would assert that an engine which never ran produced the
measurement — a worse defect than the one it tidies, and precisely the
`sfjo` caution recorded above (*read what a regeneration writes before
committing it*).

## And nothing checks it, which is the gap worth a decision

`check:bun-pin` verifies that **22 workflow sites** agree with `.bun-version`.
Nothing verifies that the **86 sidecars** do. So the 14 are invisible to every
gate: `1xhc` again — a disagreement no check can see is indistinguishable from
agreement.

The gate is easy; making it green is not, because it reddens `main` until the
14 are regenerated. That is the owner's call, not mine, so it is recorded rather
than shipped. NOT taken unilaterally and NOT filed as a separate bean, because
it is the same fact this bean is already about.

### Reconciled on merge, 2026-09-27 — the section above predates #1452

Written without seeing the sections before it. Kept as written, with two corrections:

- **There is such a test.** `init-folio-qa.test.ts:41` spawns the real `qa-sweep.ts`
  (not `--dry-run`), and a sweep saves script sidecars under the platform's
  `REPO_ROOT` whatever it swept. The directory bisection above stopped at
  `cat-harness/scripts/tests/`; halving inside it ends at that one file in nine
  steps. Both halves are true: the test is the WRITER, the `engine_version` term
  plus an off-pin engine was the TRIGGER — which is the point the corrected
  `qa-utils.ts` comment now makes.
- **The 14 pre-pin sidecars are now harmless.** Since #1452 no run rewrites a
  sidecar for its engine alone and no reader uses `engine_version` for freshness,
  so the residue changes on the next real checker change. The proposed
  sidecar-vs-pin gate is therefore not needed to stop churn; it stays the owner's
  call, unshipped.

---

## A second way the discard fails — and its own recommendation is RETRACTED

Appended from `claude/brave-hypatia-r820sf`, 2026-09-27, after the pin above had
landed as #1442. Status untouched: this is evidence, not a claim on the bean.

**The recommendation this note originally carried was wrong, and it is left named
rather than deleted.** It read: *"this strengthens remedies 2 and 3 over 4"* —
stamp only on a real change, or move run provenance out of the committed file. Both
were put to the owner from this branch before the pin was visible here, and the
measurement above refutes them:

- **Remedy 2 already exists.** `saveQaScriptSidecar`'s write-skip guard
  (`qa-utils.ts:1769`) is exactly "stamp only on a real change" — read directly,
  not taken on trust. It compares `source_file`, `script_hash`,
  `script_commit_sha`, `deps_hash`, `engine_version` and `extra_inputs`, and
  returns without writing when all agree.
- **`last_run_at` and `last_run_sha` are PASSENGERS, never causes.** The guard
  deliberately excludes them, and its own comment says so: *"Everything except the
  two `last_run_*` fields is content-derived, so comparing on those alone is the
  right test."* So moving them out of the committed file — remedy 3 — would change
  nothing about the churn.
- Moving `engine_version` out would be worse than a no-op: it is the one field the
  guard needs in order to notice that a different engine produced the sidecar.

So the pin is cause-level and the two remedies this branch argued for were
symptom-level. The one fact I had that the bean did not — 86 committed sidecars, 72
at `bun-1.3.14` and 14 at `bun-1.3.11` — also has a better explanation above than
the one offered with it. I inferred *"the churn has been committed at least once
before, partially"*; the sufficient explanation is that the write-skip guard
compares `engine_version`, so the 14 already matching the local Bun are skipped and
the 72 are not. **72 is the count not already at the local engine, not a blast
radius.** My extra hypothesis was never needed and was not established.

### What survives, because it is independent of the remedy

Remedy 4 — *"always discarded locally"* — relies on the agent being able to SEE the
churn at the moment it commits, and there is a timing window where it cannot:

1. `bun run cat gates` is started in the BACKGROUND while other work continues.
2. `git status --porcelain` is checked — clean, because the run has not reached the
   writer yet.
3. The run reaches `saveQaScriptSidecar` and rewrites the sidecars.
4. `git add -A` sweeps them into a commit about something else.

Measured here: 72 sidecars entered a commit about `check:anchor-names`, caught and
amended before any push. What nearly hid it is the inspection idiom itself —

    git status --porcelain | grep -v 'script-sidecars'

— the filter that makes the churn tolerable day to day is the same filter that
hides it at the moment it matters, and it is the pipeline remedy 4 invites. The
same run was contaminated a second way: committing a file while gates was live made
the detector report `bun run cat lint` as having "reverted" a path, attributing an
agent's own commit to a gate.

This is an argument for the pin reaching agent containers too — the open question
in *"the version is a judgement"* above — rather than for either retracted remedy.
While an agent container's Bun differs from `.bun-version`, step 2 keeps lying, and
no amount of documenting the discard closes that window.


## The local guard the owner chose — landed 2026-09-27 (`claude/brave-hypatia-r820sf`)

Status untouched. The owner was given the residual question above — the pin cannot
reach an agent container — with four options, and chose **keep `1.3.14`, add a local
guard**: a check that says the running Bun differs from the pin, so an agent is told
at session start instead of finding out in a diff.

`bun run cat check:bun-runtime`, and a `## Bun runtime vs the pin` section in
`session-start-coord-sweep.sh`. On this container it prints, derived from the corpus
rather than quoted from this bean:

    This container runs Bun 1.3.11; .bun-version pins 1.3.14.
    bun test and bun run cat gates will rewrite 72 of 86 committed script sidecars here

**It is deliberately NOT a gate**, and the reason is the one that made the churn
worth fixing. `check:bun-pin` asks a question about the CORPUS — do the 22
`setup-bun` sites agree with `.bun-version`? — which every checkout answers
identically, so it is gateable. This asks about the ENVIRONMENT, and no commit can
change the answer. A gate failing on a fact about the machine would go red in every
agent container while every reviewer read it as a verdict on the diff: a second
always-red signal, which is what #1442 existed to remove.

Three states, `cannot-tell` exiting 2 rather than 0 — no pin, an unparseable pin, or
no Bun to ask are all *unknown*, never *matched*.

**One detail decided whether this worked at all.** A sidecar records
`engine_version: "bun-1.3.14"` while `.bun-version` holds the bare `1.3.14`.
Compared directly they never match, so a naive version would report every sidecar
due for a rewrite in every container including a correctly-matched one — firing
always, and therefore meaning nothing. That is the same shape as the
`PinDef.tagPrefix` defect #1442 found in the pin machinery while using it, so the
prefix is a named constant with its own test rather than an inline template.

11 tests, each BUILDING the state rather than describing it, because this check's
interesting states are unreachable by pointing it at this repository: in CI it always
matches and in an agent container it always mismatches.

### What this does and does not close

It closes the window in remedy 4 that no `git status` could: the agent is told before
step 1, not asked to notice between steps 2 and 4. It does **not** stop the churn —
72 files still move on every sweep here — so `bun run cat gates` is still locally 'NOT
clean' and the boxes above stay unticked. Repinning to `1.3.11` remains the option
that would make both CI and agent containers clean; it was declined in favour of
keeping the artefacts' own engine, and that is recorded rather than re-argued.


## The local guard's CLAIM is retracted by #1452 — the guard is kept, reworded

Appended from `claude/brave-hypatia-r820sf` after merging #1452. Status untouched.

The section above records a guard added on the owner's choice of "keep the pin at
1.3.14, add a local guard", because #1442's pin could not reach a container the
repository does not control and the churn therefore persisted locally. **#1452
removed `engine_version` from `saveQaScriptSidecar`'s write-skip comparison, which
fixes the churn at the writer for every container — so the thing the guard was
built to announce no longer happens, and its message was false the moment that
merged.**

Measured here rather than taken from #1452's commit message: sidecars clean, then
`bun test cat-harness/scripts/tests/init-folio-qa.test.ts` — the sweep #1452 names
as the trigger — then sidecars clean again. **0 rewritten, where this container had
produced 72 an hour earlier.**

### What was removed, in four places

The false claim was printed in four, which is the argument for fixing all of them
rather than the script alone: `check-bun-runtime.ts`'s message and module header,
`bun-runtime.test.ts`'s assertions, the `SCRIPT_EXEMPTIONS` reason in `gates.ts`,
and the `session-start-coord-sweep.sh` section comment. A retracted claim left
standing in three of four is a claim the next reader still finds.

Gone: *"72 of 86 script sidecars will be rewritten by any sweep here … discard
them; do not commit them"*, and with it the `git checkout --` remedy and the
warning about `git status | grep -v script-sidecars`. A test now asserts the old
wording is ABSENT, so it cannot drift back.

### What the guard says now, and why it is still worth running

1. **You are not running the code that will judge your push.** `check:bun-pin`
   asserts all 22 `setup-bun` sites install `.bun-version`, so CI runs exactly the
   pin. A test passing at 1.3.11 can fail at 1.3.14 and the reverse. No commit
   changes this, which is why it is not a gate.
2. **A checker changed HERE stamps its sidecar with the older local engine.**
   `engine_version` is now a record of the last CONTENT change's engine, so a real
   content change on an older bun commits a stamp that goes backwards relative to
   the 72 carrying CI's — `rmcf`'s downgrade concern and `#1430`'s `sfjo` rule.
   Rare, because it needs a content change, and no longer an every-run event.

The printed count is now named `stampedElsewhere` rather than `willRewrite`, in the
type as well as the output, so it cannot be read as the churn prediction it used to
be.

### Retiring it entirely is the owner's call, and is NOT taken here

The purpose the guard was asked for is discharged. Keeping it is a judgement that
the two facts above earn a script, a test file, an exemption entry and a sweep
section; deleting it is defensible and would be one commit. Left in place because
the owner asked for a guard and it still reports something true, and flagged here
rather than decided quietly.

---

## 2026-09-27 — the owner asked where this belongs. It is a SKILL, and now it is one.

*"3ozg, that should be in tools/skills, no? how resolve?"* — two halves, and the
answers went in opposite directions.

**The `tools` half: the premise was wrong, and I was the one who made it wrong.**
`@covers` names the graph kind a gate **audits**, and `cat-harness/tools/` holds
Tool definitions. `check:bun-pin` and `check:red-gate-is-last` read
`.github/workflows/`, which is not a declared graph kind at all — the three gates
already doing exactly that (`check-ci-invocations`, `check-workflow-policy`,
`check-workflow-script-paths`) say `@covers none` with that reason in as many
words, and I had declared `tools` on both of mine without looking. The committed
`audit-coverage.qa-results.json` therefore attributed the `tools` kind to **five**
gates when three audit it — a false claim in the one artefact whose stated design
is that the gate half is *declared* so the number is a verdict rather than an
upper bound (`3srh`). Corrected in #1450; the row now reads three.

**The `skills` half: yes, and this is the resolution.** What survived the pin was
never code, it was a *reading rule* — and it was living in my check-in prompts and
commit messages, which is to say nowhere a next session looks. New skill
[`gate-tree-mutation`](https://github.com/litlfred/cat-harness/blob/main/sdlc/skills/sdlc-core/gate-tree-mutation.md),
carried by the `authoring-agent` role, `platform-gates` pointing at it:

- `NOT clean` is a verdict about the **run**, not the diff — the gates after a
  mutation were handed a repaired tree (`ymsu`, 152 of 152).
- Two causes, told apart by `git status --short`: a missed regeneration, or a
  container whose Bun differs from `.bun-version`.
- The second is **discarded, never committed**, because it stamps a *downgrade*
  as a fresh measurement — `sfjo` applied to a regeneration that is faithful and
  still wrong to keep.
- The count is a fact about your container: 86 sidecars, 72 at `bun-1.3.14`, 14
  at `bun-1.3.11`, and what moves is whichever set disagrees with you. **This
  bean's title says 72 and that is not a constant.**

### Why it is a separate skill rather than a section in `platform-gates`

Because the first attempt WAS a section, and `kg:audit` refused it: 82 lines took
`platform-gates.md` from 334 to 416, past p90 (391), flipping
`skill-not-a-document` from `pass` to a `major` fail — *"at that length it is a
document, and an agent that skims it follows the part it happened to read."* Read
before committing, per `sfjo`, and reverted rather than pushed. The criterion was
right: the subject is distinct (how to read a run's cleanliness verdict, not which
gates to run), so it got a name findable by `skill_fetch`. 134 lines, 4 pass / 0
fail, and `platform-gates` keeps a 20-line pointer.

### The three boxes are still unticked, and this does not tick them

Nothing here names the triggering test, nothing moves the write to a temp
directory, and `bun run cat gates` in this container still rewrites 72 files. What
changed is that a session that sees it now finds it written down instead of
filing it a fourth time.

### Correction to the section above, after merging #1452 — 2026-09-27

Two claims in my own entry are now false, and one was never right. Correcting
rather than editing, because the reasoning is what a next session reads.

**False now, fixed by #1452:** *"nothing here names the triggering test"* — it is
`init-folio-qa.test.ts`, bisected over 432 files, and the entry above this one
says so. And *"`bun run cat gates` in this container still rewrites 72 files"* — it
does not; `engine_version` no longer counts as substantive.

**Never right:** my justification for keeping it substantive, carried into #1442,
was *"a verdict produced by a different engine is a different verdict"*. True, and
about a different artefact. A **script** sidecar holds no verdict — source file,
hashes, dependencies. Verdicts live in block sidecars. Verified independently
before accepting it: `entryIsFresh` compares `field_hash` and the script hashes,
and `engine_version` appears nowhere else in `qa-utils.ts`. So there was no
reader, and the field was provenance the whole time.

**The skill was revised, not merged as written.** `gate-tree-mutation` now carries
the general rule rather than this container's symptom:

> Does this field describe the SUBJECT the artefact is about, or the RUN that
> produced it? Only the first is a reason to write.

`3ozg` is its worked example, marked fixed, with both halves (#1442's pin, #1452's
skip) and what each one answers. Discarding a churn is documented as a
**workaround whose habit is the defect** — three filings in one day is what
discard-and-move-on produced — rather than as the standing practice my first draft
made it.

Not reopening: the boxes are closed on evidence I did not produce, which is
`bean-coordination`'s rule working as intended.

## CORRECTION 2026-09-27 — Done-when 1 DOES have an answer, and my earlier note here said it did not

An earlier append to this bean, from session `05ca3417`, said:

> **There is no such test.** The trigger is the `engine_version` term in
> `saveQaScriptSidecar`'s write-skip guard plus an off-pin engine.

The second sentence is right. The first is **wrong**, and `main` had the answer
before I wrote it: `init-folio-qa.test.ts` runs a real sweep. Verified — four
sweep-related references in that file.

Both facts are needed and they are compatible. A test does perform a sweep; the
`engine_version` term is what made that sweep WRITE rather than skip. I had the
second and concluded the first was false, which does not follow, and I asserted
it in three places (this bean, PR #1451's title and body, and a comment on
#1445). All three are corrected.

The reasoning error is the same shape as the one this session already recorded
on `qmqg`: I proved a mechanism and then denied a neighbouring fact that the
mechanism said nothing about. A measurement that explains a count does not
thereby rule out every other participant.

## And the residue reported here has changed

That append listed 14 sidecars at `bun-1.3.11` against 72 at `bun-1.3.14`, and
asked for a gate comparing all 86 against `.bun-version`. **Both are stale.**
`main` now carries `bun-1.3.11` in all 86, and `main` also dropped
`engine_version` from the comparison — so the split is gone and the churn is
fixed at the root rather than pinned around.

What survives is one question, smaller than the gate I proposed: all 86 now
record an engine that is NOT `.bun-version` (1.3.14, which CI runs). Since no
reader uses the field for freshness — `entryIsFresh` compares hashes, per
main's own comment — that may be exactly the intended "a record of the last
CONTENT change's engine". If so there is nothing to gate and nothing to
regenerate, and the gate I proposed would have been wrong. Recorded as a
question rather than a finding, because I cannot tell which from here and the
session that made the change can.
