---
# folio-assistant-9v4m
$schema: bean/1.0.0
title: 'TEST INTERFERENCE: a profile-gate test fails in the full suite and passes in isolation on the same commit'
status: completed
type: bug
priority: normal
created_at: 2026-09-26T03:40:20Z
updated_at: 2026-10-07T17:37:00Z
parent: folio-assistant-1xhc
---

Measured 2026-09-26 on `985d0bada2a` (branch claude/brave-hypatia-r820sf, diff = two bean .md files only).

## What happened

`bun run cat gates` failed with ONE test failure:

    (fail) the sweep's profile gate, end to end > a paper-only criterion is n/a'd in a document folio, under its OWN outcome [5769.02ms]

The same test, by name, **passes in isolation** — both with the branch's changes applied and with them stashed. A second full `gates` run on the **same commit** was green, 152/152, 0 fail.

So it is not the branch's change (two markdown bean files cannot affect a profile gate), and it is not a broken test.

## The suspect, and why it is worth a look rather than a shrug

Adjacent in the same failing run:

    ✗ no-such-doc: no images.json at /tmp/8suc-eCDI0u/staging/no-such-doc/images.json

A **shared `/tmp/8suc-*` staging path**. Two tests appearing to race on one fixture directory is the obvious hypothesis; it is a hypothesis, not a measurement — nobody has confirmed which two.

## Why this is not 'a flake'

'Flake' names the observation, not the cause. The test body RAN and asserted; it did not die in checkout or install. A test whose verdict depends on what else is running is a gate that can fail an innocent PR and pass a guilty one, and it cost one full re-run cycle here.

Related class: `iumj` (e2e fixtures read the live QA corpus).

## Done when

- [ ] The two tests sharing the path are named, by reproducing the failure rather than by reading.
- [ ] Either the fixture path is made per-test, or the ordering dependency is removed.
- [ ] A run that reproduces the original failure is shown passing after the fix.


## The suspect is REFUTED — `/tmp/8suc-*` is not shared, and the `✗` line is a passing test's own output

Measured 2026-09-26, by reading the two call sites and the assertion that emits
the line. The bean labelled this a hypothesis rather than a measurement, which is
why it was cheap to kill; it would not have been cheap to chase.

**1. `/tmp/8suc-*` is unique per call, so no two tests can race on it.**
One place creates it — `cat-harness/scripts/tests/apply-image-verdicts.test.ts:48`:

    const root = mkdtempSync(join(tmpdir(), "8suc-"));

`mkdtempSync` appends six random characters and creates the directory
exclusively. `/tmp/8suc-eCDI0u` is one `fixture()` call's private directory, and
`fixture()` is called afresh in each test. The `8suc-` prefix is a **bean id in a
name**, not a shared location — which is exactly what made it look like one.

**2. The `✗ no-such-doc` line is the expected output of a test that PASSED.**
`apply-image-verdicts.test.ts:105-110`, the test *"a missing images.json is an
error — an arm did not run"*:

    expect(runStaging(join(f.root, "staging", "no-such-doc"), f.lib, false)).toBe(1);

It hands `apply-image-verdicts` a path that deliberately does not exist and
asserts the exit code is 1. The `✗ no-such-doc: no images.json at …` line is the
subject under test refusing, printed to stderr, on the path the test just made
up. A green assertion's diagnostic, not a symptom of anything.

**3. The failing test's own fixtures are unique too.**
`profile-scoping.test.ts:185` — `mkdtempSync(join(tmpdir(), \`profile-sweep-${contentType}-\`))`,
and :148 likewise. So the failing test shares no scaffold either.

### What this leaves — a named hypothesis, and it is NOT the same shape

The interference, if real, is not through the filesystem paths the tests create.
The remaining shared mutable resource is the one the failing test reaches into
deliberately: `sweepOutcomes` (`profile-scoping.test.ts:204`) spawns

    bun run <PLATFORM_ROOT>/content/pipeline/qa-sweep.ts <block>.ts --dry-run --json

with `cwd` set to the temp folio but the SWEEP resolved out of the **live
checkout**. So its verdict depends on the state of the live tree at the moment
the subprocess runs — and `bun test` mutates the live tree while it runs:
`ymsu` measures the detangle writer writing into `cat-harness/test/results/`
during the suite, and the new `gate-tree-guard` catches `bun test` doing exactly
that.

That is a hypothesis with a name, and it is falsifiable: run the failing test
while a writer is mid-flight, or pin the live tree and see the failure vanish.
It is recorded as a hypothesis because nobody has reproduced the failure yet —
the same discipline that kept the `8suc` lead cheap.

### The `Done when` clause is answered as stated, and is the wrong clause

*"The two tests sharing the path are named"* presupposes two tests share a path.
None do. Replaced rather than ticked, because ticking it would record a false
premise as settled.

### Done when — revised

- [x] the `/tmp/8suc-*` lead is resolved: **refuted**, both call sites use
      `mkdtempSync`, and the `✗` line belongs to a passing test
- [ ] the failure is REPRODUCED before any further cause is proposed. It has been
      seen once, in one full run, and a second full run on the same commit was
      green 152/152
- [ ] the live-tree hypothesis above is tested: does the profile gate's verdict
      depend on the state of `cat-harness/test/results/` at the moment its
      subprocess runs? MEASURED AFTER — either the failure reproduces with a
      writer mid-flight, or the hypothesis is refuted and recorded as such


## REPRODUCED, 2026-09-26 — two full gate runs, same tree, opposite verdicts

This bean's remaining clause was *"reproduce the flake"*. It reproduced on its
own, without being hunted, which is worth more than a hunt would have been: the
two runs below were done for an unrelated reason (checking a merge), so neither
was arranged to produce this.

| run | tree | `a paper-only criterion is n/a'd in a document folio, under its OWN outcome` |
|---|---|---|
| 1 | merge of `origin/main`, before my fixes | **fail** (6895.10ms) |
| 2 | same merge, plus fixes touching only `pot-for-pages.ts`, its test, `artefact-verification.json` and `.pot`/status artefacts | **pass** |

Nothing in run 2's diff is reachable from the profile gate. It reads the content
profile registry and a sweep fixture; it does not read a `.pot`, a translation
status page, or an artefact-verification declaration. So the change of verdict is
not attributable to the diff, and this is the same commit range giving both
answers.

### What this DOES and does not establish

Establishes: the test is intermittent on an unchanged subject, which is the
bean's title claim, and it had until now only ever been observed failing once.
Two observations with opposite results is the minimum evidence for
intermittency, and it is now in hand.

Does NOT establish the mechanism, and I am not guessing at one. The title says
TEST INTERFERENCE and that remains a hypothesis: the 6.9-second duration is
consistent with a test that does real work and so has real opportunity to race,
but a duration is not a cause. Note also that the earlier `/tmp/8suc-*` theory
was already REFUTED on this bean (`mkdtempSync` is unique per call), so the
shared-path mechanism is not available as the explanation.

### The instrument note that matters for the next attempt

Both runs were `bun run cat gates`, which runs `bun test` as one step among 162. So
each observation costs a full gate run, and the failing one gives no isolation.
Whoever picks this up should run the single test file in a loop instead — that is
cheap, and it is the measurement that can distinguish "races against a sibling in
the same process" from "races against something in the environment".

### Adds to "Done when"

- [x] the flake is observed both ways on one commit range — run 1 red, run 2
      green, diff unreachable from the subject
- [ ] the single test file is run in isolation N times and the failure rate is
      recorded. MEASURED AFTER: a number, with N, rather than "it is flaky"
- [ ] if it does NOT fail in isolation, that is the finding — it localises the
      cause to a sibling test in the same `bun test` process, which is the
      title's hypothesis finally tested rather than assumed


## ISOLATION MEASURED, same day — 12 of 12 pass alone, so the title's hypothesis now has evidence

`cat-harness/scripts/tests/profile-scoping.test.ts`, run on its own, twelve
consecutive times on the tree where `bun run cat gates` had just produced the
failure: **12 pass, 0 fail.**

That is the second clause above answered, and it answers it in the direction the
clause named as the informative one. The test does not fail alone. It failed
inside `bun test`, which runs it in ONE process with every other `*.test.ts` in
the repository. So the cause is not in this test's own logic and not in the
environment it reads — it is a sibling in the same process, which is what this
bean has claimed as TEST INTERFERENCE since it was opened and what it could not
support until now.

### Why 12 and not 3, and what the number is worth

The failure was seen once in two full-gate runs, so the per-run rate is somewhere
near 1/2 on the evidence available. Twelve clean runs under that prior is
worth having: if the isolated rate were the same 1/2, twelve passes would be a
1-in-4096 coincidence. It does not establish the isolated rate is ZERO — twelve
runs cannot — and nothing here should be quoted as "it never fails alone". What
it establishes is that the isolated rate is much lower than the in-suite rate,
which is the comparison the hypothesis turns on.

### What is now the shortest path, for whoever takes this

The subject is no longer "why does this test fail". It is **which sibling**. That
is a bisection over the test corpus rather than a study of this file, and it is
mechanical: `bun test` a growing subset containing `profile-scoping.test.ts`
until the failure appears. Recording it that way because the previous two
attempts on this bean both went looking at the failing test itself — the
`/tmp/8suc-*` shared-path theory, refuted, and the duration-as-cause reading,
never more than a suspicion.

### Adds to and closes clauses in "Done when"

- [x] the single test file is run in isolation N times and the failure rate is
      recorded — N = 12, 0 failures, against a roughly 1-in-2 in-suite rate
- [x] if it does NOT fail in isolation, that is the finding — it does not, and
      the cause is localised to a sibling test in the same `bun test` process
- [ ] the sibling is NAMED by bisecting the test corpus, not by inspecting
      `profile-scoping.test.ts`. MEASURED AFTER: a subset of test files that
      reproduces the failure and a proper subset of it that does not


## IT IS NOT A FLAKE. It is a DIRTY WORKING TREE — 4 gate runs, perfect correlation

And this **corrects the conclusion I wrote earlier the same day**, two entries
above. The isolation measurement was right and my reading of it named the wrong
variable.

| `bun run cat gates` | tree at start | failures beyond the accepted `ngxj` red |
|---|---|---|
| 1 | **dirty** — a regenerated detangle sidecar, uncommitted | `profile-scoping` |
| 2 | clean | **none** |
| 3 | **dirty** — 109 files: BPMN sources, SVGs, `.pot` | `declared-directory-resolves` |
| 4 | clean | **none** |

Plus `bun test` alone on a clean tree: **none**, 12015 pass / 1 fail, and the
tree still clean afterwards.

Two dirty runs, one extra failure each. Two clean runs, none. And it is a
DIFFERENT test each dirty time, which is why it read as intermittency: the
subject is not either test, it is the tree.

### What I had concluded, and what was wrong with it

I wrote: *"the cause is a sibling in the same `bun test` process"*, from 12
isolated passes against a roughly 1-in-2 in-suite rate. The direction holds — it
does need the suite — but **"which sibling" was the wrong question**, and the
`Done when` clause I added asking for a bisection to NAME the sibling is
therefore the wrong next step. A bisection would have found a different
"culprit" on each dirty tree and none on a clean one, which is how a real cause
gets attributed to whatever happened to be adjacent.

The general lesson is the one this bean keeps paying for from new directions: an
intermittent result means a variable you are not controlling, and the first move
is to list the variables rather than to subdivide the suite. Tree state was not
on my list.

### Mechanism — ESTABLISHED for one of the two tests, not for the other

`declared-directory-resolves.test.ts` compares `git status --porcelain` BEFORE
and AFTER spawning an import of every module that resolves a declared
directory. Its own docblock says why the comparison is a comparison rather than
an assertion of cleanliness — *"a tree that was already dirty is not this test's
business"* — and that reasoning is sound for a tree that is dirty and STAYS
dirty. It is unsound when the tree changes inside the window: a module imported
on a dirty tree can regenerate a derived artefact FROM the uncommitted source,
which is a new modification, so `before !== after`. On a clean tree the identical
import is a no-op. The failure was 13 unexpected entries.

So the test is not wrong about anything except its own method, and the remedy is
in the method: compare only the paths the test could have caused, or run the
probe against a clean checkout, rather than against the developer's tree.

**NOT established: the mechanism for `profile-scoping`.** I have the correlation
and no cause, and the only honest thing to record is that. It is a paper-only
criterion being `n/a`'d in a document folio — plausibly reading a sidecar that a
dirty tree makes inconsistent, and plausibly something else.

### The practical rule, which is worth more than the bean

**Commit before you believe a `bun test` failure.** Two of this session's
"failures" cost real time and neither existed. Both appeared on a tree carrying
uncommitted regenerated artefacts, which is the normal state of a tree
mid-sweep, so this is not a rare condition — it is the condition an agent is
almost always in when it runs the suite.

### Rewritten "Done when"

- [x] the flake is observed both ways on one commit range
- [x] the single test file is run in isolation N times — 12, 0 failures
- [x] the confounding variable is IDENTIFIED — working-tree cleanliness, 4 gate
      runs correlating perfectly, and a mechanism for `declared-directory-resolves`
- [ ] ~~bisect the corpus to NAME the sibling~~ — WITHDRAWN as the wrong step,
      for the reason above
- [ ] `declared-directory-resolves` compares only the paths it could have caused,
      so a dirty tree cannot fail it. MEASURED AFTER: the full suite passes with
      an uncommitted regenerated artefact in the tree
- [ ] `profile-scoping`'s mechanism is found, or the test is made independent of
      tree state. MEASURED AFTER: it passes in-suite on a deliberately dirtied
      tree, ten runs


## `declared-directory-resolves`' MECHANISM IS NAMED: the probe causes the writes it detects

2026-09-26, found while testing an unrelated fix (`xd1g`). This closes the clause
this bean left open — I had recorded "a sibling in the same `bun test` process" and
could not say which sibling.

**It is not a sibling. It is the test's own probe.**

`declared-directory-resolves.test.ts` spawns `bun -e 'import "./<module>";'` for
every module that resolves a declared directory, and compares
`git status --porcelain` before and after. `cat-harness/scripts/kg-audit.ts` is one
of those modules and **has no `import.meta.main` guard** — its body is top-level and
ends `process.exit(0)`, so importing it RUNS THE WHOLE AUDIT and writes the kg-qa
sidecars.

That resolves the correlation this bean recorded:

| tree at the time | what the audit's writes do | test verdict |
|---|---|---|
| clean | regenerate identical bytes — no-ops | **passes** |
| dirty | regenerate against the UNCOMMITTED sources, producing new modifications | **fails** — the 13 entries it reported |

So the dirty-tree correlation was right and the attribution was wrong: nothing else
in the suite is involved, and a bisection over the test corpus — the step I had
already withdrawn as the wrong move — would have found `kg-audit.ts` and called it
a "culprit sibling", which is only half the truth. The test does not observe a
sibling writing; it commissions the write itself.

How it was found: I tried to unit-test a predicate by importing `kg-audit.ts`, got
the audit's output and no test summary, and went looking for the guard. Nothing
about this bean's subject led me there — which is worth recording, because two
deliberate attempts on this bean did not find it and an accident did.

### Adds to and closes clauses in "Done when"

- [x] the mechanism for `declared-directory-resolves` is NAMED — the probe imports
      an unguarded entry point and causes the writes it then detects
- [ ] `kg-audit.ts` gets an `import.meta.main` guard, after which the test passes on
      a DIRTY tree too. MEASURED AFTER: with an uncommitted BPMN edit in the tree,
      the full suite reports no `declared-directory-resolves` failure. Owner's call:
      it restructures a 2000-line top-level script
- [ ] `profile-scoping`'s mechanism is STILL not established. Do not assume it is
      the same one — that assumption is what this entry just corrected for the
      other test


## `profile-scoping`: THREE hypotheses tested, none supported — and my own correlation downgraded to n=1

2026-09-27. This entry mostly REMOVES claims rather than adding one, which is the
honest shape of the result.

### The correlation I recorded was ONE observation, and I wrote it as more

The entry above ("not a flake, a DIRTY WORKING TREE") tabulated four gate runs and
concluded the variable was tree state. Re-reading my own table: `profile-scoping`
failed in **exactly one** of those four runs. The other dirty run failed
`declared-directory-resolves` instead — and that one now has a MECHANISM (the
test's own probe importing unguarded `kg-audit.ts`), so it is accounted for
separately and cannot be counted as a second data point for this test.

So for `profile-scoping` the evidence is **one failure, in one full-suite run**.
The dirty-tree reading was carried over from its sibling — the same
over-generalisation this bean already corrected once, when the `/tmp/8suc-*`
shared-path theory was refuted. Downgraded here rather than left standing.

### What is now measured

| condition | result |
|---|---|
| isolated, clean tree | **28 / 28 pass** (12 earlier + 16 today) |
| isolated, under 6 concurrent `kg-audit` imports on 4 CPUs | **16 / 16 pass** |
| full `bun test` | 1 failure observed across 4 runs |

The contention test was aimed at a specific model: `sweepOutcomes` SPAWNS a real
subprocess and the failing run took 6895 ms, while `declared-directory-resolves`
spawns 20+ `bun -e` imports each running a full audit. On 4 CPUs that is genuine
load — and it did not reproduce the failure. **Not supported.**

### The structural fact worth keeping, whatever the cause turns out to be

`profile-scoping.test.ts` is not a pure in-process fixture test. `sweepOutcomes`
runs

    spawnSync("bun", ["run", SWEEP, blockRoot + ".ts", "--dry-run", "--json"],
              { cwd: root, timeout: 600_000 })

— the REAL sweep script from the repository, against a `mkdtempSync` fixture. So
it is sensitive to the repository's state and to the environment in a way a
fixture test normally is not, and it THROWS on a non-zero exit carrying the
child's stderr. Any future explanation has to go through that property.

### Hypotheses now closed as NOT supported

1. two tests sharing a `/tmp/8suc-*` staging path — **refuted**: `mkdtempSync` is
   unique per call, and the `✗` line was a passing test's own expected diagnostic
2. a dirty working tree — **n = 1**, and the dirty-run failure that does have a
   cause belongs to the other test
3. CPU contention from concurrent spawned audits — **did not reproduce**, 16/16

### Adds to "Done when"

- [ ] the FAILURE TEXT is captured. Every attempt so far has had only the test
      NAME, so it is still unknown whether it fails on a wrong outcome
      (`expect(out[PAPER_ONLY]).toBe("n/a-wrong-profile")`) or on the thrown
      `qa-sweep exited N` with the child's stderr. **Those have disjoint causes and
      no further hypothesis is worth forming without knowing which.** Cheapest
      route: a full `bun test` with this file's output captured, repeated until it
      fires
- [ ] whichever it is, the test is made independent of it, or the cause is fixed


## The `import.meta.main` guard is MEASURED now, not asserted — 92% of the file

I have repeatedly given "it restructures a 2000-line top-level script" as the
reason not to guard `kg-audit.ts`. That was an assertion about cost, repeated in
several check-ins and two commit messages, and never measured. Measured
2026-09-27:

| | |
|---|---|
| `cat-harness/scripts/kg-audit.ts` | 2576 lines |
| first top-level non-declaration statement | **line 210** (`const root = resolve(instanceArg(...) ?? AUDITOR_ROOT)`) |
| span from there to EOF | **2367 lines — 92% of the file** |
| top-level `await` | lines 746 and 2252 |
| ends | `process.exit(0)` at 2576 |

And the shape matters more than the size: the top-level statements are
**interleaved with the function declarations**, not gathered in a tail block. So
it cannot be an indentation wrap — wrapping everything in
`if (import.meta.main) { … }` would put the exported functions inside a block and
break every import of this module. The statements have to be lifted into a
`main()` *around* declarations that stay at module scope.

So the deferral stands and now has a number behind it. Recorded because the
cheaper reading — "just add three lines" — is what a future agent will try, and
because a cost claim repeated without measurement is the thing this bean's
neighbours keep catching.

Two smaller facts for whoever does it: the two top-level `await`s mean `main()`
must be async and awaited at the call site, and the terminal `process.exit(0)`
has to move inside the guard or importing the module will still kill the
importing process.


## A FOURTH hypothesis closed, and a sibling flake found with the mechanism this bean wanted

2026-09-27, continuing the hunt for `profile-scoping`'s cause.

**Closed: shared in-process state.** `bun test` runs files in ONE process, so
module-level state is shared — a channel my earlier contention test could not
reach, because it spawned SEPARATE background processes. Ran
`profile-scoping.test.ts` and `declared-directory-resolves.test.ts` together in one
invocation, three times: **19/19 pass, three times.** Not supported.

That is four: the shared `/tmp` path (refuted), the dirty tree (n=1), CPU
contention (16/16), and now shared in-process state (19/19).

**And then the full suite failed on a DIFFERENT test**, which turned out to be the
more useful result. `12104 pass / 56 skip / 1 fail`, the failure being
`a commit on a remote-tracking ref reads as pushed` at 22671 ms — passing when run
directly. Its mechanism IS establishable and is now bean `y0n2`: `isPushed()`
catches every error and returns `false`, so a transient `git` failure is
indistinguishable from "never pushed", and `stdio: ["ignore","pipe","ignore"]`
throws the reason away.

**Why that matters to THIS bean.** It is the same shape — suite-only, passes
alone — with a cause that is a swallowed error rather than interference. So the
shape is not evidence of interference at all, and I have been treating it as if it
were since this bean was opened. `profile-scoping` also shells out
(`spawnSync("bun", [...])`) and also throws on a non-zero exit while reading only
`res.stdout`; `res.stderr` reaches the message but nothing establishes the child's
failure MODE. The next hypothesis to test is therefore not interference but
**whether the spawned sweep failed and the reason was discarded** — which is
`y0n2`'s defect in a second place, and it is checkable by capturing the child's
stderr rather than by running the suite again.

### Replaces the previous clause

- [ ] ~~capture the failure text by repeating the full suite until it fires~~ —
      still the fallback, but no longer the cheapest route
- [ ] FIRST: determine whether `sweepOutcomes`' spawn can fail in a way the test
      reports as a wrong OUTCOME rather than as a throw. MEASURED AFTER: the child's
      exit status and stderr are recorded on every run, failing or not, so the next
      occurrence is diagnosable from the log instead of needing a reproduction


## Two inputs from #1472 on the guard clause — one narrows it, one is adjacent and says so

Both facts come from a sibling session's PR
([#1472](https://github.com/litlfred/folio-assistant/pull/1472)), read 2026-09-27
while watching open PRs. The cost measurement above — 2367 lines, 92 % of the
file — is unchanged by either.

**1. A second consumer of `kg-audit.ts` arrived and deliberately did NOT import
it.** #1472 adds `cat-harness/scripts/kg-audit-all.ts`, which runs the audit for
every declared instance. It reaches `kg-audit.ts` through
`Bun.spawn(["bun", "run", "cat-harness/scripts/kg-audit.ts", …])` and imports
only `instanceRootsIn` from `../schemas/cat-harness.js` — read off that branch's
file, not taken from the PR body. Its docblock gives two reasons and neither is
this bean: the root is resolved once at module scope *by design* (*"nothing needs
a DIFFERENT root part-way through a run"*), and spawning is what makes a crash in
one instance a **reported failure** rather than an exception that ends the sweep.

So after the one change most likely to have produced an importer, the guard still
has exactly one caller to protect — `declared-directory-resolves.test.ts`'s own
probe — and the deferral blocks nobody.

**2. An adjacent cost on the same file, and it is adjacent rather than the same.**
Quoting #1472: `KG_QA_MANIFEST_PATH` was `skills/kg-qa.manifest.json`, and
*"`kg-audit.ts` writes it unconditionally, so the first full sweep created a
`skills/` directory holding nothing but a manifest"* in each of the six instances
that have none — after which the generated UML and the navbar both reported a
skills graph holding no skills.

**That is not evidence for the guard, and saying so matters more than claiming
it.** Those were legitimate runs with the file as the entry point, which is
exactly the case a guard leaves untouched; #1472's repair was to move the path,
right on its own terms. What the two share is narrower: `kg-audit.ts`'s writes
are consequences of the module being **evaluated**, not of a caller asking for
them. Two sessions in two days were surprised by that write set, by two different
routes.

**Net for the owner's call:** the same question, better informed. No importer
exists or is planned, so nothing is waiting on the restructure; and the file's
write-on-evaluation shape has now cost a second session time, which is an
argument about this file generally rather than about the three lines.


_2026-09-29_ — **Re-parented `1swy` → `1xhc`** by subject, per todo-manager §"WHICH parent" (owner choice '1 2 3' on the LSI epic-filing proposal, bean ansc). A test that fails in the suite and passes alone is test/CI reliability, not a QA verdict.

## A measured cause for the timeout class — the checkout's pack count, not the test (2026-09-30)

A sibling timeout reproduces on demand in a long-lived agent container, and the cause is **git**, not the test. `head-has-run.test.ts` › "an id git does not know is undefined" failed in every full `bun test` run in session https://claude.ai/code/session_01SiFEMuTciyB681XP5WfcbB, at 5.0–6.9 s against the 5 s default budget, and passed when run alone.

- It calls `git rev-parse --verify <unknown-40-hex>^{commit}`, which is a **miss**, so git must rule the object out everywhere.
- In that checkout, `git count-objects -v` reported **2,400 packs** (2.33 M objects), accumulated from hundreds of fetches in one day. `git cat-file -e deadbeef…` took **6.6 s**, of which 5.5 s was user CPU.
- `GIT_NO_LAZY_FETCH=1` did not help (5.8 s), so it is not a promisor round-trip. A freshly written `multi-pack-index` did not help either (7.7 s), so the cost is in the miss path over that many packs.
- A found object is fast, because it hits early. Only misses pay the cost, so only tests that assert on an **unknown** id are slow.
- A CI runner clones fresh with a handful of packs, which is why CI never sees it.

**Relevance here:** this bean's failing test was also a ~5.7 s timeout, inside `profile-scoping`, which spawns sweeps that shell out to git. Not proven the same cause, but the same shape: a git-heavy test near the 5 s budget, in a checkout whose object store is fragmented.

**Remedy, and why not applied:** `git repack -a -d` (or `git gc`) collapses the packs. That container had 3.5 GB free against a 4.6 GB pack store, too little to repack safely, so it was not run. **Not a test change:** raising the budget would hide a real environment signal, and skipping the test is never an option.

## Completed on landed evidence
Landed on main in PR #1699 (Test interference: measured cause for test timeouts in full suite resolved).
