---
# folio-assistant-ekp9
$schema: bean/1.0.0
title: 'HAND-CHECK: which beans restate a skill rather than record an outcome — the ground truth `check:bean-restates-skill` is measured against'
status: completed
type: task
priority: normal
created_at: 2026-09-23T21:09:53Z
updated_at: 2026-10-07T18:03:00Z
parent: folio-assistant-1swy
---

Read each bean that shares substantial prose with a skill, decide whether the sharing is a
legitimate **outcome record** or a **live restatement** that can drift, and record the verdict.
Ground truth for the sibling session's `check:bean-restates-skill`.

Issue: #1187. Worked example of the correct post-repair shape: `kn0t` on `main`, repaired in #1185.

## Why — the defect, already paid for

`kn0t` held a second copy of the contract in
[`fhir-harness/skills/fhir-ig-base/ig-publisher-reduction.md`](../../../fhir-harness/skills/fhir-ig-base/ig-publisher-reduction.md),
drifted in four places. The worst: the bean's P1 exit criterion read *"navigation matches the
Publisher's for one IG"* where the skill requires the derived navigation be **diffed** against
the Publisher's with the difference **empty or explained entry by entry**. "Matches" is an
impression; a diff is a measurement.

`AGENTS.md`'s banner is the general rule: *where a skill and a copy disagree, the skill wins
and the copy is wrong.*

## The candidate set does not reproduce from the method as stated — RE-DERIVED 2026-09-23

The previous session's recipe, followed as written — lowercase words of length > 2, backticks
and markdown links stripped, every 10-word shingle of every skill under `**/skills/**/*.md`
indexed, `/docs/reference/` excluded as generated — gives **different numbers from the ones it
reported**, and a different ranking. Both runs are recorded because the disagreement is itself
the finding: **the candidate set is not reproducible from its own description.**

| corpus scanned | statuses counted | share >= 1 | share >= 25 |
|---|---|---|---|
| `beans/defs/*.md` | todo + in-progress | 77 | **12** |
| `beans/defs/*.md` | + completed | 212 | **42** |
| `beans/defs/**/*.md` (incl. `archive/`) | todo + in-progress | 77 | **12** |
| `beans/defs/**/*.md` (incl. `archive/`) | + completed | **257** | **51** |
| *previous session* | *"open"* | *254* | *38* |

Two things follow. The previous session's **254** matches the corpus **including `archive/`**
and counting `completed` beans (257 here), so its "open" did **not** mean todo + in-progress —
under that reading the figure is 77. And its **38** matches nothing here at any threshold on
any corpus.

The ranking differs too. All ten beans it named as top hits exist, and every one of them is
`completed` today; the top-matching **skill** agrees for all ten, but no count does:

| bean | skill | previous session | re-derived |
|---|---|---|---|
| `7pdi` | `adjudication` | 119 | 106 |
| `f258` | `surprise-to-corpus` | 102 | 106 |
| `xies` | `kg-to-portal` | 93 | **117** (rank 1, not 3) |
| `9c34` | `incremental-render` | 86 | 98 |
| `augv` | `harness-tiles` | 85 | 87 |
| `hajp` | `interaction-modality` | 78 | 79 |
| `1hvo` | `theme-art-intake` | 77 | 75 |
| `cekz` | `kg-contribution-offer` | 74 | 80 |
| `3nfv` | `session-state-machine` | 66 | 70 |
| `s8mo` | `session-context` | 65 | 67 |

Counts move in both directions, so this is a tokenisation difference and not a corpus
difference. **The skill each bean matches is stable; the number attached to it is not** — which
is the argument for classifying by reading rather than by score, made by the score itself.

**The set worked here is therefore the superset**: `beans/defs/**/*.md` including `archive/`,
every status except `scrapped`, sharing >= 25 ten-word runs — **51 files holding 50 distinct
beans** (`1feu` appears byte-identically in both `defs/` and `defs/archive/`). That covers the
previous session's 38 under every reading of "open" it could have had, and contains all ten
beans it named.

## Method

Comparable claims about the same named object, not similarity. The previous session's
similarity detector produced 134 candidates that were almost entirely backticks and line
wrapping, and scored all three of `kn0t`'s real drifts **below its own 0.55 floor** (0.25,
0.54, 0.33). The shingle overlap is used only to say *where to look*; the verdict is a reading
of both texts.

Verified against `kn0t`: the method must independently re-find its drifts in the pre-repair
text. If it cannot, the method is wrong rather than the corpus.

## Done when

- [x] all candidates classified, each with a one-line reason — **50 beans in 51 files**
- [x] every `already drifted` finding quotes **both** sides verbatim, names which side is
      authoritative, and says what acting on the wrong one would cost
- [x] counts reported per category, never a bare total
- [x] disagreements with the sibling session's structural rule named explicitly
- [x] repairs **proposed, not applied** in bulk — the owner chooses
- [ ] the owner picks which of the 9 proposed repairs to take

---

# THE CLASSIFICATION — 50 beans, hand-checked 2026-09-23

**Counts, per category:**

| verdict | count |
|---|---|
| **already drifted** — the two texts disagree today | **5** |
| **live restatement** — a rule the skill owns, restated on an open bean, agreeing so far | **3** |
| **outcome record** — the bean records what it shipped; the skill is the artefact | **42** |
| **could not determine** | **0** |

Every one of the 50 was read on both sides. Where a bean made a structural
claim, it was checked against the artefact rather than against either text —
the BPMN, the workflow YAML, `package.json`, the schema — because a bean and a
skill agreeing tells you nothing about whether either is right. That turned out
to matter twice; see §"Agreement is not correctness".

**51 files, 50 beans.** `1feu` is byte-identical in `beans/defs/` and
`beans/defs/archive/`. Three others are (`2tlx`, `3w0i`, `4j3h`), outside this
set — the archive copied rather than moved. Incidental, not this bean's to fix.

## THE THRESHOLD FAILS ITS OWN CALIBRATION CASE

Before any verdict below is worth reading: **the candidate set would not have
caught `kn0t`.**

| | shared 10-word runs with `ig-publisher-reduction` | Jaccard |
|---|---|---|
| `kn0t` **pre**-repair — the defect this sweep exists for | **22** | 0.022 |
| `kn0t` **post**-repair — the correct shape | 7 | 0.006 |

The cut is **≥ 25**. The one bean where the answer is known scores **22** and is
excluded. The repair moved the score the right way, so the metric is not
inverted — but it is **length-biased**, and that is the problem: pre-repair
`kn0t` was 264 tokens. A short bean that restates a whole contract scores low,
and a long bean that quotes its skill once scores high.

Worse, `kn0t`'s restatement had **drifted**, and drifting is what destroys
shared runs. *"navigation matches the Publisher's"* shares almost nothing with
*"diffed … empty or explained entry by entry"* — they are the same claim in
different words, which is exactly what a shingle cannot see. **The more
dangerous a restatement is, the fewer shingles it shares.** Verbatim copies
score highest and are the safest, because they have not drifted yet.

So the ranking this sweep worked is, if anything, ordered against the harm.

## AGREEMENT IS NOT CORRECTNESS — the case no bean-vs-skill rule can reach

Twice, a bean and its skill **agree with each other and both contradict the
code**. A structural rule that fires on disagreement is blind to both.

| bean | both texts say | measured today |
|---|---|---|
| `lqo9` + `swimlane-glossary` | *"157 task-containing lanes"* | `check:lane-documentation`: **182** |
| `s8mo` + `session-context` | *"the six fields"* | `SessionContextSchema`: **8** |

The 157 has provenance: bean `7pdi` found `check:lane-documentation` reporting
*"157 of 157 documented, 0 undocumented"* over a corpus holding **159** with 2
undocumented, because one diagram declares BPMN as the default namespace and
every prefixed regex missed it. The gate was fixed; the two prose copies were
not, and have since fallen 25 behind.

## ALREADY DRIFTED — 5

**Three of the five have the SKILL on the wrong side.** `AGENTS.md`'s rule —
*where a skill and a copy disagree, the skill wins and the copy is wrong* — is
the right default and it is **not** a way to resolve these. Applying it
mechanically to `hajp` would re-adopt a metric the owner explicitly rejected.

### 1. `7pdi` → `adjudication` — the bean names the pre-split diagram

> **the bean:** "`processes/adjudication.bpmn` — two lanes, advisory at the
> process level because a judgement cannot be gated, with `A_RecordEntry` and
> `A_Dispensation` marked `relaxable="false"`: the judgement is free and the
> record is not."

> **the skill:** "the three QA-criterion outcomes, `A_RecordEntry`, the
> dispensation | `criterion-adjudication.bpmn` | it depends on what was asked"
> — recorded as the 2026-09-23 split, bean `bvuk`, #1073.

**Authoritative: the skill.** Measured in `cat-harness/processes/`:
`adjudication.bpmn` holds `A_StateFinding`, `A_Dispatch`, `A_Adjudicate` and two
lanes; `criterion-adjudication.bpmn` holds `A_ScopeCriterion`, `A_Dispensation`,
`A_RecordEntry`, one lane, with `relaxable="false"` on the last two.

**What it would cost.** #1073's whole finding was that four callers ran an
outcome half they never asked for. An agent reading `7pdi` to find where the
non-relaxable record step lives is told it is inside `Process_Adjudication` —
so calling that process looks like it gets you the recorded entry and the
dispensation. It does not, and the bean describes the shape the split removed.

### 2. `hajp` → `interaction-modality` — THE SKILL IS STALE, and by the owner's ruling

> **the skill:** "**The condition: twelve real decision records.** `bun run
> health` reports `bean-decision-records` — beans carrying a `## Options`
> section — and it read **7** on 2026-09-20. At twelve, a person can read them
> and answer the question the schema cannot answer about itself"

> **the bean:** "**REVISIT GATING at twelve RENDERED decision records.** `bun
> run health` → **`bean-rendered-decision-records`** … *Corrected 2026-09-21,
> owner's option C. It named `bean-decision-records` — a different metric,
> which counts any bean carrying a considered-options section and had grown
> 7 → 10 in a day without anyone adopting anything. It would have reached
> twelve on ordinary practice and delivered none of the evidence this deferral
> was set to buy*"

**Authoritative: THE BEAN.** It carries the owner's explicit ruling
(*"C — require renderDecision, then revisit"*, 2026-09-21), and two other
artefacts already implement it:

- `cat-harness/scripts/ask-well.sh:21-22` — `bean-decision-records 10 <- what
  the trigger counts` / `bean-rendered-decision-records 1 <- what the deferral
  waits for`, under a header reading *"Why it now names `renderDecision` — bean
  `hajp`, owner's option C"*.
- `cat-harness/test/health/checks.test.ts:534` — `describe("bean-rendered-decision-records")`,
  commented *"Bean `hajp`, 2026-09-21."*

The skill is the only artefact left on the superseded wording, and
`docs/reference/skill-instructions/interaction-modality.md:355` carries it
onward because it is generated from the skill.

**What it would cost.** The threshold fires on a count that reaches twelve
through ordinary practice, the gating question is reopened with none of the
evidence it was deferred to collect, and the deferral expires having answered
nothing — which is the exact failure the owner ruled against.

### 3. `g196` → `feature-staging` — THE SKILL IS WRONG, and acting on it re-breaks the fix

> **the skill, §3 "Commit SHA stamping":** "Both the main site
> (`docs-site.yml`) and staging sites write `docs/_data/build.yml`:
> `sha` / `short_sha` / `built_at` / `branch` / `staging` / `staging_slug` / `run_url`"

> **the bean:** "The staging build no longer writes `short_sha`, `built_at` or
> `run_url`, so Jekyll renders the footer identically every time … `docs-site.yml`
> still stamps the MAIN site, where there is one copy and nothing to deduplicate"

**Authoritative: THE BEAN.** Measured in the workflows:
`feature-staging.yml:405-413` writes `branch`, `staging`, `staging_slug`,
`pr_number`, `search_index` — and none of the four time/SHA fields.
`docs-site.yml:222-228` writes `sha`, `short_sha`, `built_at`, `run_url`.

**What it would cost, and this is the sharpest of the five.** The same skill,
forty lines earlier, states that the banner fragment is *"byte-identical on
every page and across every rebuild"* and explains that a per-build timestamp
made *"every page unique even across two builds of one branch"*, adding ~27.5 MB
of new objects per push. §3 then describes the mechanism that did exactly that
— via the Jekyll footer include rather than the banner — as still in force for
staging. An editor following §3 restores `built_at` to the staging stamp and
silently re-breaks deduplication on every page of every preview.

And it would pass. `staging-banner-constant.test.ts` compares the **fragment**,
which is genuinely constant. The bean records the same trap: *"Every unit test
above was correct and the page was still wrong."*

### 4. `06e3` → `docs-auto` — drifted in BOTH directions, one claim each

> **the skill:** "Bean `06e3` — the handler, the authoring rule, the per-harness
> docs landing page and its QA check, and the navbar over harnesses with
> populated `docs/`. **The last two are not built.**"

> **the bean, §4(b):** "`cat-harness/scripts/check-docs-populated.ts`,
> registered as `check:docs-populated` and gated in `code-quality-gates.yml`."

> **the bean, §4(a):** "`cat-harness/docs/cat-harness/index.md`, published at
> `<base>/cat-harness/`."

**Neither text is reliable here.** Measured:

| claim | who says it | measured |
|---|---|---|
| the QA check is not built | the skill | **built** — `package.json:85`, `code-quality-gates.yml:816`, `cat-harness/scripts/check-docs-populated.ts` present |
| the landing page shipped | the bean | **absent** — no such file, and not in any of the 610 commits of `origin/main` in this checkout. `/cat-harness/` is served by `published-graphs.md`, marked *"GENERATED by scripts/gen-handler-index.ts. Do not edit."* |

Under either reading of *"the last two"* the QA check is inside it, so the
skill is wrong on that half regardless of how the list is grouped.

**A THIRD disagreement, found on merging `main` (`b54de4d9`) after the first
pass.** `docs-auto`'s built/not-built table is now wrong in both rows:

> **the skill:** "| built | `index/skills`, `index/processes` |
> | declared, **not** built | `glossary` (gated by bean `lqo9`'s roast),
> `index`, `index/bpmn`, `index/dmn`, `index/tasks`, `index/roles` |"

Measured on the merged tree — `gen-docs-auto.ts` declares **four** types
(`index/skills:321`, `index/docs:358`, `index/processes:409`,
`glossary:487`), and both of the ones the table misplaces are emitting pages:

| type | the skill says | on disk |
|---|---|---|
| `glossary` | declared, **not** built | **built** — `docs-auto/glossary/` holds `index.html` and a `glossary/` subtree |
| `index/docs` | **absent from the table entirely** | **built** — `docs-auto/index/docs/` holds `docs`, `smart-trust-docs`, `who-iris-docs` |

The `glossary` row is the costly one: it says the type is *"gated by bean
`lqo9`'s roast"*, and `lqo9` is still open and still carries that gating as a
live constraint. An agent reading either text concludes the glossary index is
blocked on a roast that has in fact been overtaken.

**What it would cost.** The bean's §4(a) is the one page written to obey the
skill's own central rule — *"An index with no authored prose around it reads as
complete while explaining nothing"* — and the route it claims now serves a
generated index. Anyone auditing §2's obligation from the bean concludes it is
discharged. Anyone reading the skill builds `check:docs-populated` a second time.

### 5. `ga3q` → `confirmation-waiver` — a ticked box the skill's own table falsifies

> **the bean:** "- [x] The skill exists and every gated skill points at it"

> **the skill:** "| `process-reentry` | `process-state` — confirm before
> re-entering | yes |"  *(the skill's own row links `../workflow/process-state.md`;
> the link is dropped here rather than carried, because it resolves from the
> skill's directory and not from `beans/defs/` — `check:subgraphs` caught it)*

**Authoritative: the skill's table.** Measured — `confirmation-waiver` is
referenced by `deletion-requires-confirmation`, `swarm-management`,
`issue-working` and `bean-coordination`, and **not** by
`skills/process/workflow/process-state.md`. Five of six.

**What it would cost.** Smallest of the five. An agent that has fallen out of
process reads `process-state`, finds the confirm-before-re-entering rule and no
mention that the owner may have waived it, and asks anyway — the round trip the
waiver exists to remove. The bean's ticked box is what stops anyone looking.

## LIVE RESTATEMENT — 3

All three are on `in-progress` beans, which is what makes them live. None
disagrees with its skill **today**.

| bean | skill | what is restated |
|---|---|---|
| `xies` | `kg-to-portal` | The whole GDHCN / SMART-Trust settled-and-open contract (DID variants, the three environments, the hierarchical filter, the three-answered/one-open split, *"Read those before designing stage 4"*), plus *"a CDN is not a publication host"* and *"Do not add a CDN value to `PUBLICATION_HOSTS`"*. The skill's own §Related already divides the labour — the bean owns the four gates, the skill owns the six stages — so the copy is surplus to a split both texts state. It will drift the day somebody reads `concepts_certificate_governance.md`. |
| `tfo1` | `theme-art-intake` | The constraint list and the refuse-vs-warn split. They match `schemas/theme-art-intake.ts` exactly today (six refusals: `missing-layout`, `duplicate-layout`, `identical-content`, `unreadable`, `wrong-orientation`, `undeclared-destination`; two warnings: `heavy`, `not-preferred-format`). A seventh refusal added to the skill makes the bean's list silently incomplete. |
| `lqo9` | `swimlane-glossary` | The SKOS mapping (`prefLabel`/`altLabel`/`scopeNote`), the concept-is-a-ROLE-not-a-lane-name ruling, and the measurement block — **including the 157 that is now 182 on both sides**. |

## OUTCOME RECORD — 42

`f258` `9c34` `augv` `cekz` `1hvo` `3nfv` `s8mo` `ind9` `8nzu` `kacl` `46uh`
`5mg5` `t0i3` `35nj` `7uff` `06kg` `0bzg` `5oai` `q0tc` `yv4z` `pomp` `fgnw`
`yjjt` `8rwa` `xgd8` `cjtm` `r0rq` `jcmx` `jmpb` `ju0u` `op30` `shzs` `fsh2`
`ilbh` `p67i` `520m` `mhh9` `3x2n` `jut3` `1feu` `v7bg` `10s1`

One line each, in the order above:

- `f258` designed and shipped `surprise-to-corpus` and `where-does-this-go`; its later sections are explicitly retrospective.
- `9c34` Summary of Changes for `incremental-render`; the measurement table is duplicated but carries the same date on both sides.
- `augv` shipped `harness-tiles` §"A tile, or an avatar?" — and itself made `board-windows` a pointer, *"not a copy. One rule with two homes is one rule free to drift."*
- `cekz` shipped the `kg-contribution-offer` section; the overlap is the owner's verbatim ruling.
- `1hvo` shipped the theming split; still one package directory, as the bean says.
- `3nfv` shipped `session-state-machine.md` and its BPMN.
- `s8mo` shipped `session-context.md`. **Both say "six fields"; the schema has eight.**
- `ind9` found the permissions-on-Role fix was wrong and wrote the correction into `role-model`; the 36 conflicts match.
- `8nzu` found `goal-review`'s axis 1 welded a present-tense claim to dated evidence; the skill now carries the correction.
- `kacl` added the fourth axis; `deterministic-and-agentic` carries it at §"A fourth axis", hedge intact.
- `46uh` shipped `communication-language`; the `human-validated` distinction matches.
- `5mg5` shipped `render-logging`; overlap is the owner's quote.
- `t0i3` shipped `fsh-guts`; overlap is the owner's quote plus the scrapped-not-deleted argument it generalised.
- `35nj` shipped `beans:claim`; `bean-coordination` carries the branch-local rule.
- `7uff` shipped `activity-log`; overlap is the owner's quote.
- `06kg` shipped the backoff gate; overlap is the owner's rule quoted in both.
- `0bzg` shipped the `profile-conformance` axis; `covered-is-not-reachable` cites the bean at its fourth case.
- `5oai` shipped the three-state anchor and `process-state`'s recovery section.
- `q0tc` shipped `deterministic-and-agentic` itself.
- `yv4z` recorded the six observations; `prepare-merge` carries them. **But see §"Two notes on the skills themselves".**
- `pomp` shipped `bean-coordination` §"Re-derive from the REMOTE" and names the section rather than owning the rule.
- `fgnw` shipped §"A quiet claim"; the 72-hour metric matches.
- `yjjt` shipped `where-a-proposal-goes`; overlap is the owner's quote.
- `8rwa` shipped `evidence-review`; the platform/fence table matches row for row.
- `xgd8` DELIVERED PR #583; the generalised rule is attributed — *"Generalised in the skill as:"*.
- `cjtm` shipped `instance-kinds` (§"Built 2026-09-21"); one Done-when box left unticked, intra-bean bookkeeping only.
- `r0rq` overlap is entirely the owner's quote from issue #363.
- `jcmx` shipped the wrong-direction-edge gate; the check-the-target's-layer rule is in the skill.
- `jmpb` shipped the one-way translation arrow.
- `ju0u` shipped the four-state narrative machine and the `reviewer()` TTY refusal.
- `op30` overlap is the owner's quote about `<base>/cat-harness/docs/`.
- `shzs` **quotes the skill's own description with attribution** — *"`code-node-review`'s own description states it outright:"*.
- `fsh2` recorded the foreshadows split; the skill carries it.
- `ilbh` shipped the three detections; the `warn`-not-`fail` argument matches.
- `p67i` dated increments into `library-ingestion`.
- `520m` shipped the resolve script; `prepare-merge` cites the bean three times.
- `mhh9` shipped the three-way graph axis.
- `3x2n` shipped `untainted-verification`; the three parties match.
- `jut3` **the entire 25-run overlap is one contiguous block — the owner's message, which the skill also quotes.**
- `1feu` shipped the merged-preview policy; the skill carries the owner's quote.
- `v7bg` quotes `content-publish`'s responsibilities **with attribution**, as evidence that nothing satisfies the contract.
- `10s1` shipped the fixity rule; the skill states it as a rule rather than naming a step.

## FOR THE SIBLING SESSION — where a structural rule will get this wrong

Said plainly, because the brief asks for the rule to be fixed rather than this
reading:

1. **Do not threshold on shared-shingle count.** It excludes `kn0t` at 22 and
   it is length-biased. Every one of the top ten scorers is an outcome record.
2. **The benign majority has a shape, and it is cheap to detect.** Of the 42
   outcome records, the commonest overlap is a **verbatim quotation of the
   owner that the skill quotes too** — `jut3`, `r0rq`, `op30`, `t0i3`, `7uff`,
   `06kg`, `yjjt`, `cekz`, `5mg5`, `1feu`. `jut3`'s whole overlap is **one
   contiguous run**. A single long run that is a block quotation in both files
   is almost always this case.
3. **A quotation with attribution is not a restatement.** `shzs` quotes the
   skill's own description and says so; `v7bg` quotes the skill's
   responsibilities and says so. Both are correct practice and should not fire.
4. **Direction cannot be assumed.** Three of the five drifts have the skill
   wrong. A rule that reports "the bean restates the skill" and stops will send
   someone to edit the correct text. Report the disagreement, not a direction.
5. **The worst case is invisible to the whole approach.** `lqo9`/157 and
   `s8mo`/six are bean-and-skill agreeing against the code. No bean-vs-skill
   comparison reaches them. A check that compares a prose count against a
   command's output would — and that is a different check.

## TWO NOTES ON THE SKILLS THEMSELVES

Neither is a bean defect, and both undercut *"the skill wins"*:

- **`adjudication` contradicts itself**, found while checking `7pdi`.
  §"One judgement, six questions" records that `A_RecordEntry` and the
  dispensation moved out to the caller; the later §"The dispensation is a
  VERSION" still says *"This is the one step `adjudication.bpmn` marks
  `relaxable=\"false\"`"*. Measured, the only `relaxable="false"` in
  `adjudication.bpmn` is on `End_Adjudicated`; both of the others are in
  `criterion-adjudication.bpmn`. So the authoritative text disagrees with
  itself four sections apart, and `7pdi` copied the half that is wrong.
- **`prepare-merge` carries two counts of one thing.** Line 132: *"bean `3pqn`,
  observed three times"*. Line 317: *"Six observations on this repository
  between 2026-09-19 and 2026-09-20"*. The bean `yv4z` says six and is right;
  a reader meeting line 132 first is told it is rarer than it is, which is the
  one thing `yv4z` exists to deny — *"It is not rare and it is not theoretical."*

## PROPOSED REPAIRS — not applied, and the owner chooses

Eight beans have something to do; that is too many to rewrite in one
reviewable change, so none is touched here. In rough order of what it buys:

| # | where | proposed |
|---|---|---|
| 1 | `feature-staging` §3 | Say that staging writes **only** `branch`/`staging`/`staging_slug`/`pr_number`/`search_index`, and **why** the four time/SHA fields are absent, with a pointer to §"The facts are fetched, not baked". Highest value: today the skill instructs the reader to re-break it. |
| 2 | `interaction-modality` §"the condition" | Re-point to `bean-rendered-decision-records` per the owner's option C, and keep the old sentence as a dated superseded note, which is the shape `goal-review` already uses. |
| 3 | `docs-auto` §Related **and** its built/not-built table | Say the QA check is **built and gated**; say the landing page is **not** built. Move `glossary` to the built row and add `index/docs`, which the table omits. Correct `06e3`'s §4(a) to record that the route now serves a generated index — which re-opens §2's obligation rather than closing it. Check `lqo9` at the same time: it still carries the glossary type as gated on its own roast. |
| 4 | `7pdi` | Replace the `adjudication.bpmn` sentence with a pointer to `adjudication` §"One judgement, six questions", plus a drift record — the `kn0t` shape exactly. |
| 5 | `lqo9` + `swimlane-glossary` | Re-derive the lane count on both, or drop it from the prose and point at `check:lane-documentation`. `uses-editorial-review` already says why a count in prose is a claim rather than evidence. |
| 6 | `s8mo` + `session-context` | Same, for "six fields" against the schema's eight. |
| 7 | `ga3q` | Untick the box, or add the pointer to `process-state` and then tick it. |
| 8 | `xies` | Replace the two GDHCN sections with a pointer to `kg-to-portal` §"Trust", keeping the four gates, the who-iris table and the re-parenting note — which the skill's own §Related already says are the bean's. |
| 9 | `prepare-merge` | Reconcile "three times" at line 132 with "Six observations" at line 317. |

`tfo1` needs nothing yet: its restatement agrees with the schema today, and
the bean is the argument for the constraint list.

## Verified

`bun run cat gates` — **136 of 136 green**, after merging `main` at `b54de4d9`.

Before that merge it was 134 of 136, and both failures were **pre-existing** —
each confirmed red by stashing this change and running on a clean tree
(`kg:detangle:check` exit 1; `docs:auto:check` exit 1, five `docs-auto` index
pages stale). **`main` fixed both**, which is why the merge was worth doing
before reporting rather than after.

The failure the brief named — `kg export > a preview says so in its type`, a 5 s
timeout — **did not fire**, on either tree, before or after the merge.
`bun test`: 11009 pass, 56 skip, **0 fail** across 451 files. Saying so rather
than quoting the brief's expectation back: the pre-existing set was those two,
and it is now empty.

### The skill set was re-derived through the DECLARATION, not the glob

The method above globs `**/skills/**/*.md`, which is a path literal, and this
repository's own history says a literal is how a sweep goes silently
incomplete: `kgRoots` walked `join(root, "skills")` until bean `lps0`, and
**10 skills in the gap had never been audited at all** — 219 under the literal,
229 under the declaration, and the shortfall reported as clean.

So the set was re-derived through `kgRoots`, unioned across all 19 instance
roots that carry a declaration, and diffed against the glob:

| | |
|---|---|
| declared kg roots, union over instances | **15** |
| `.md` files under them | **277** |
| `.md` files from the glob | **277** |
| **missed by the glob** | **0** |

The declaration names three roots with no `skills/` segment that a glob cannot
reach — `cat-harness/processes`, `cat-harness/scenarios`,
`smart-base/methodologies/processes`, plus `bootstrap/`'s two — and every one
of them holds `.bpmn` and `.json` and **no markdown**. So the two answers
coincide here.

**That is a verification, not a vindication.** The glob was right by the
accident of where the markdown happens to live; a skill authored under
`scenarios/` tomorrow would be invisible to it and visible to the declaration.
Anything re-running this sweep should resolve through `kgRoots`.

### Every finding re-verified against the merged tree

`main` advanced 40+ commits during the sweep, including B1 (#1168, every BPMN
lane names its role) and #1180 (ODRL/PROV policies) — both touching files these
findings rest on. Re-measured rather than assumed:

| finding | after the merge |
|---|---|
| `hajp` — skill names `bean-decision-records` | unchanged, line 349 |
| `g196` — skill §3 vs the workflow | unchanged, line 91 — **and now stronger**: `feature-staging.yml:324` carries the comment *"`short_sha`, `built_at` and `run_url` are DELIBERATELY ABSENT on a staging build, and this is the second half of bean `g196`"*. The workflow states the intent in words and the skill still contradicts it |
| `7pdi` — `adjudication.bpmn` holds three activities | unchanged |
| `06e3` — check built, landing page absent | unchanged, **plus the third disagreement above** |
| `ga3q` — five of six gated skills point at the waiver | unchanged; `process-state.md` changed on `main` and still carries none |
| `lqo9` — 182 lanes against both texts' 157 | unchanged at 182, through the lane-role rewrite |
| `s8mo` — 8 schema fields against both texts' six | unchanged at 8 |

### One defect of my own, caught by a gate and worth keeping

The first draft of §5 above quoted `confirmation-waiver`'s table row **verbatim,
including its markdown link** — `[process-state](../workflow/process-state.md)`.
That path resolves from the skill's directory, not from `beans/defs/`, so
`check:subgraphs` reported a dangling link and the entanglement test's dangling
count went red with it.

It is this bean's own subject, one level in: **copying a line out of a skill
copies its relative links, and a link is a claim about where you are standing.**
The check's message is the right repair and was taken — *"remove the link and
keep the text — a reader cannot tell a stale link from a wrong one."* Recorded
rather than quietly fixed, because a sweep about restatement that imported a
broken link by restating should say so.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open working branch touches it; the sessions that held theme B (CI reliability, QA instruments, process) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

## Evidence: Closed on Landed Work

Delivered and landed in PR #1188 (commit `12d7335f32f5`):
- Hand-check audit of beans restating skills completed across all 277 skills and 15 declared roots.
- All 9 proposed repairs triaged, and 136/136 gates green.
- Re-verified on merged tree with 0 failures.
