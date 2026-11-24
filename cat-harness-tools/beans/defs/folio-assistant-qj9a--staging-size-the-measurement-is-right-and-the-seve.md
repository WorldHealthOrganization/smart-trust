---
# folio-assistant-qj9a
$schema: bean/1.0.0
title: 'STAGING SIZE: the measurement is right and the SEVERITY is an unverifiable claim — critical predicts a failed publish, and nothing in this repo can observe enforcement'
status: completed
type: bug
priority: normal
created_at: 2026-09-25T18:10:30Z
updated_at: 2026-10-08T01:15:00Z
parent: folio-assistant-1xhc
---

`health` reports `staging-preview-size` as **critical** while every deploy keeps
succeeding. I went looking for a wrong number and did not find one: **the
measurement is sound.** What is wrong is one level up, in what `critical` is
asserting.

## Measured first-hand, 2026-09-25

Directly off the publish ref — `git ls-tree -r -l origin/gh-pages`, not the
check's own report:

| | files | size |
|---|---|---|
| whole published tree | 50,511 | **2.67 GB** |
| `STAGING/` | 46,127 | 2.37 GB |
| the main site | 4,384 | 0.30 GB |

So the check is right about the quantity AND right that it is the published
tree: `docs-site.yml`'s own header states the serving model — *"published to the
gh-pages branch … Settings → Pages → 'Deploy from a branch' → gh-pages → /
(root)"*. `STAGING/` is inside what is served, so its bytes count. Both halves of
my leading hypothesis (that the limit was not about this tree, or that the
measurement counted a different quantity) are **refuted**.

**When it crossed**, from the committed health history rather than from memory:

    2026-09-19 … 2026-09-22    0.06 – 0.86 GB
    2026-09-23                 1.46 GB   ← crosses the documented 1 GB
    2026-09-24                 2.83, 2.84 GB
    2026-09-25                 2.93, 3.10 GB

Two and a half days above the limit, continuously.

## A second, smaller finding found by cross-checking the two numbers

My `git ls-tree` measurement and the check agree **exactly** on `STAGING/` —
2.37 GB — which is the cross-validation that makes the rest of this trustworthy.
But it shows what the threshold is compared against: **`STAGING/` alone**, not the
whole served tree.

That is coherent with the basis's reasoning (leave room for the main site) and
the arithmetic does not quite work:

    STAGING_CRITICAL_BYTES   750 MB   the slice previews may occupy
    the main site             300 MB   measured, 4,384 files
                            -------
                            1050 MB   against a documented 1 GB ceiling

So `critical` fires 50 MB *after* the combined total would already have crossed
the limit it is derived from. Tiny next to a 2.37 GB overshoot, and not what this
bean is about — recorded because it was found while checking the numbers agreed,
and because the main site's 0.30 GB is itself a measurement nobody had put beside
the threshold.

## The defect: `critical` asserts something nothing here can observe

The threshold's `basis` for `STAGING_CRITICAL_BYTES` says:

> Three-quarters of GitHub's documented 1 GB Pages limit. Past here the previews
> occupy most of the budget the main site must also fit inside, and **the next
> deploy is the one that fails to publish** — so **something is about to be
> lost**, which is what `critical` means on this scale.

That is a claim about **GitHub's enforcement behaviour**. This repository has no
instrument for it, and I could not acquire one:

| what I tried | result |
|---|---|
| `GET https://litlfred.github.io/folio-assistant/` | `connect_rejected` — egress proxy, organization policy |
| the same for a `STAGING/<slug>/` page | `connect_rejected` |
| `GET /repos/:o/:r/pages` (source + status) | every field `None` |
| `GET /repos/:o/:r/pages/builds` | *"Access to this GitHub API path is not permitted through this proxy"* |
| `actions/workflows/pages-build-deployment/runs` | `total_count: None` |

**And the evidence I had been leaning on does not bear the weight.** I had said
"the site is publishing" because `docs-site.yml` runs #683–#690 are green. A
green run proves the **push to `gh-pages` succeeded**. Serving is GitHub's side
of the line, and a successful push tells you nothing about whether Pages then
built, truncated, or refused. Two days of green deploys therefore neither
confirm nor refute the basis — which is exactly the point.

So the finding is not "the check is wrong". It is:

> **`critical` is a determined-sounding verdict over a question the check has no
> instrument for.** The repository's own rule is that could-not-determine must
> never be rendered as a determined answer; here the violation is in a
> threshold's SEVERITY rather than in a check's output, which is why no existing
> guard catches it.

## Why this is not `tebu` again

`tebu` (completed) took the same finding at 878.7 MiB and acted on **preview
size** — measured 88.3 → 39.2 MiB per preview by omitting `reference/` and `api/`
unless a branch touches their sources. That was the right lever and it worked.
It did not touch the severity semantics, and the number has since grown 3×
anyway, which suggests per-preview size alone does not hold the line at this
concurrency.

## The instrument that is missing is already a known gap

`7s52` — *"staging-review hands a reader URLs the AGENT cannot open"* — is the
same wall, hit from the other side, and it is `in-progress` and quiet.

**But it does NOT supply the instrument this bean wants, and I had that wrong.**
I first wrote here that "whatever answers those answers this". Reading `7s52`'s
own `## Done when` refutes it — one item is:

> The limit is stated: it serves BYTES, not the live host — redirects, headers
> and Pages' own 404 behaviour are out of scope.

So `7s52` works AROUND the unreachable host by reading bytes off the publish ref,
and explicitly declines to observe serving. That is the right call for its
purpose (a reader wants the content) and the wrong one for this (a check wants to
know whether GitHub accepted it). **The instrument is a separate need, not a
by-product of `7s52`**, and saying otherwise would have left the gap looking
owned when it is not.

`1lfx` (*"DEPLOY: STAGING must report which host…"*) is adjacent and `todo`.

Nothing in `7s52` is edited from here: it is a sibling's claim, quiet but theirs.

## Options — not a decision

1. **Re-word the severity's basis to what it can support.** `critical` becomes
   "past a documented limit; enforcement not observed from here", and the action
   names the person who can look. Cheapest, honest, and changes no behaviour.
2. **Build the instrument** — a probe that fetches the published site and records
   HTTP status and served size, so a claim about publishing has evidence. Blocked
   from this container by egress policy, so it has to run in CI, not locally.
   That is `7s52`'s territory and should be settled there rather than twice.
3. **Split the check in two**: `staging-preview-size` measures and stays
   `major` at most; a separate `pages-publish-health` owns the serving claim and
   reports `unknown` until an instrument exists. Cleanest against the
   content/context/state discipline, largest change.

1 is worth doing whichever of 2 or 3 happens, and does not preclude either.

## What I am NOT doing

Not removing a preview. Every remedy this check names is a person's
(`deletion-requires-confirmation`), the owner set 500 MB deliberately on
2026-09-20, and nothing here establishes that the store needs draining — only
that the reason given for draining it is unverified.

## Done when

- [x] `STAGING_CRITICAL_BYTES`' basis claims only what an instrument can support —
      superseded by the SPLIT: the threshold is gone from `staging-preview-size`
      entirely, and its argument moved to `pages-publish-health`
- [x] The finding's action names who can observe the served site, since no agent
      here can
- [x] It is recorded that a green `docs-site.yml` run is evidence about the PUSH
      and not about serving — in `pages-publish-health`'s own docs, so it sits
      beside the check that would otherwise re-make the mistake
- [x] The instrument's owner is settled — it is NOT `7s52`, which declines the
      live host by design. It got its own bean: `1dre`, the CI-side serving probe


## The split landed, and building it corrected the plan again

Option 3 was chosen and implemented. Two things the implementation established
that the options above had wrong:

**1. A check reporting `unknown` would have broken the health family.** The
option read *"a separate `pages-publish-health` owns the serving claim and
reports `unknown` until an instrument exists"*. Reading `healthVerdict` refutes
it: a single `unknown` takes the ENTIRE report to `unknown`, `run.ts` exits 2 and
the tracking issue is left untouched. `health-check.yml`'s own comment already
said what that is worth — *"the whole verdict goes to `unknown` — correctly, and
uselessly"*. A permanently blind check would have made the daily sweep
permanently useless and hidden every other check behind it.

So the new check's subject is narrowed to something **determinable**: *does an
instrument exist?* Answerable today (no), so it reports a `major` finding and
never `unknown` about its own subject. Measured after the change: `bun run
health` exits **1 (findings)**, not 2.

**2. The critical threshold did not need re-wording, it needed removing.** `qj9a`
first re-worded its basis. The split shows that was treating a symptom: the
threshold's entire justification was the publish consequence, so once that moved,
nothing was left for the number to mean in this check. `staging-preview-size` now
carries one threshold — the owner's 500 MB budget — and **never escalates past
`major`**, pinned by a test at an absurd 3.7 GB rather than just past the line.

Two stale statements fixed in passing, both the same defect the code comments
warn about: the registry summary still advertised *"owner's 100 MB warning"* after
the raise to 500 MB, and the check's own summary still claimed the previews had
*"grown past what a GitHub Pages site can carry"* — a publish claim, in the check
that just had one taken away.


## R4's scope — settled 2026-10-02, and it was my own commit that needed correcting

The question (raised by the nav-options agent against commit `2eb113ea280`):
does R4's linear floor govern the **docs nav** or only the **board**? Only the
board — and the nav was never under it, so relaxing R4 was not merely
mis-scoped, it was **unnecessary** for the nav work.

Evidence, all checkable:

- `cat-harness/docs/concepts/architecture/folio-board-requirements.md` §"What this is,
  and what it is not" states on the owner's own ruling that the file is
  "history, not instruction", and that the rules an agent follows live in the
  `cat-harness` skills. R4 governs nothing *directly*, board or docs.
- R4's normative sentence names its subject: "**The board** SHALL always be
  collapsible…".
- The skill that DOES bind the docs site is `ui-accessibility` — it says so:
  "it binds every surface this project produces: the knowledge-graph viewer,
  **the docs site**, the action-icon tiles, anything future". Its standard is
  WCAG 2.2 A/AA + keyboard + 24 px targets + computed contrast + visible focus
  + announced change. **No no-JavaScript clause**, and WCAG imposes none.
- The docs navbar **already requires JavaScript**: `mountNavIconRow`,
  `mountDocumentIndex`, `mountInstanceGraphs` build three of its regions in the
  DOM at load (shipped #959; `cat-harness/test/navbar-row.e2e.ts` opens "The
  three JS-mounted navbar regions"). No gate objects.

So a client-side docs nav is permitted by the rules as written **today**,
independently of the relaxation. That unblocks the nav-duplication options.

**Exactly two `javaScriptEnabled: false` contexts exist in this repository**,
measured today, and neither is the nav:

| gate | what it requires | what it does not reach |
|---|---|---|
| `cat-harness/test/linear-floor.e2e.ts:117` | the **todo listing** (`#fa-todo-listing`) is in the served bytes, in document order, with count = own cardinality | anything else on the page |
| `cat-harness/test/first-paint-scheme.e2e.ts:247` | eight generated dashboards **first-paint dark from CSS alone** in a light-preferring browser | the page's content — it is a colour assertion |

**The relaxation's real target is therefore the todo listing**, which is
`gen-docs-pages.ts`'s 19.5 MB floor and R4's actual subject. Converting it to a
fetch is now *permitted*; it is not thereby *decided*. The test header records
what the static floor cost to build (bean `0jtj`: with JS off, a reader
previously got "no note, no count, no hint that notes exist"), so those five
tests must not be deleted to go green. Both running agents have been told.

**Second defect in the same commit, independent of scope.** It added two NEW
`SHALL` obligations — print/PDF waits for load and render; a failed load says
so — to a document that disclaims being instruction. Nothing enforced them and
nothing looking for the rule would have found them: the AGENTS.md banner's
failure mode, one directory over. Re-homed to `ui-accessibility` §"A rendering
built client-side owes two things the static one gave for free", with the
`console.warn` trap stated and the reason a PDF is the strictest case.

Fixed in `166507acd1b`.


## Collision review — run LATE, 2026-10-02, and two phases stood down

**I broke the rule I am now following.** PR #1886 landed
`coordinate` §"Before a platform refactor" (STRICT) earlier today — owner,
verbatim: *"if you are working on a refactor of the platform, review active
agents/beans for impact and coordiante"* — and I dispatched two agents at
shared includes, committed generators and workflow YAML **without** it. By
that section's own definition (blast radius, not diff size) this was a
platform refactor. Recorded here because the section says a review living only
in chat is gone when the container goes.

### What was already claimed

| sibling | its PRs / beans | shared files | effect on this work |
|---|---|---|---|
| page-weight session (bean `gp2f`, issue #1885) | **#1886**, `ready-to-merge` | the whole per-page chrome plan, phases A–E | **owns** the harness bar (C) and the shared nav (D) |
| navbar session (bean `ob3m`) | #1804, #1805, #1808, #1819 — all `ready-to-merge` | `docs-ui.css`, `docs-ui.js`, `_includes/generated/navbar-footer.html`, `harness_details.html`, `head_custom.html` | gates the KG islands work; `check:nav-names` gates `nav_exclude` |
| — | #1875, #1801 | `.github/workflows/docs-site.yml` | gates where the minifier step wires in |

`gp2f` records phase C as "owned here, at the navbar session's request",
waiting on those four PRs. So the harness-bar work was claimed with agreement
before I started.

### Stood down, measurements offered rather than discarded

- **Harness bar duplication (~60.6 MiB)** — is `gp2f` phase C. Dropped.
  `gp2f` has the better mechanism: `nav_footer_custom` is emitted in both
  `components/sidebar.html` and `components/footer.html`, so the fix is to
  override those two includes.
- **`nav_exclude` the generated sections (~94.3 MiB)** — a *different*
  mechanism against phase D's bytes, and complementary: 94.3 MiB off the nav
  before it is published once beats publishing the large one once. Dropped as
  a workstream, offered to `gp2f` as an input. Collides with #1804.

### Kept, because it collides with nothing

**Post-build HTML minification.** Operates on the built `_site`, touches no
include, generator or source page, composes with all five `gp2f` phases.
Measured on three sampled pages of `origin/gh-pages` preview
`STAGING/agy-wnhh-sushi-publisher-local`: comments −10.0%; plus inter-tag
whitespace collapse −10.7% stored (~45 MB of 418 MB HTML); **gzipped transfer
−25.4%**. The "no Jekyll plugin under `actions/jekyll-build-pages@v1`"
objection is true of plugins and irrelevant to the route: the workflows
already post-process the tree (`strip-preview-seo.ts --site ./_site`,
`feature-staging.yml:712`).

### A measurement to correct, since it is cited elsewhere

My first chrome/content split (56.6% / 43.4%) was **wrong by ~7×**. It summed
nav + svg + script + style and called the remainder content; the remainder is
`<head>`, `<footer>` and wrappers, all chrome. Measuring `<main>` directly:
content is **5.9%** (24.7 MB of 417.5 MB), independently 2.7–2.8% on three
pages. A subtraction-based baseline makes #1885's 10–15 KB/page target look
already met.

### Defect reported on #1886 (non-blocking)

`coordinate.kg-qa.json` regresses in that diff: `skill-not-a-document`
pass → fail (481 lines, p90 391), `totals.fail` 2 → 3. `kg:audit:check` fails
only on `critical`, so it stays green; `kg:audit:strict` adds `major`, and the
PR carries `ready-to-merge`.


## The linear floor, measured on `origin/gh-pages` 2026-10-02 — and a 5x error corrected

**The 19.5 MB figure in circulation for `fa-todo-listing` is wrong by about 5x.**
It was relayed from an agent report and I repeated it without deriving it.
Measured directly:

- the listing section is **12,876 bytes, byte-identical** on every page that
  carries it — six pages sampled across `reference/`, `smart-trust/` and the
  root all gave the same number, because it is a GLOBAL listing, not
  page-specific;
- it renders **3 notes**, so ~4.3 KB per note;
- it is injected by `cat-harness/docs/_includes/footer_custom.html:40`, so
  every Jekyll page gets it.

| tree | HTML pages | carrying it | bytes |
|---|---|---|---|
| main site, non-`api/` | 2,505 | ~2,405 (24 of 25 sampled) | **31.0 MB** |
| main site, `api/` (TypeDoc) | 2,206 | **0** | — |
| `STAGING/` previews | 11,096 | ~51 % by carry-rate | ~73 MB (estimated by rate, NOT counted) |
| | | | **~104 MB** |

The STAGING row is an estimate from the carry-rate, not a count. Stated as
such because the main-site row IS counted and the two must not be read as
equally firm.

### The `api/` absence is the rule working, not a hole

`footer_custom.html` justifies per-page inclusion thus: *"the board is
launched from every page, so a floor that exists on some of them is not a
floor."* 2,206 pages lack the listing, which looks like a contradiction. It is
not: `api/` pages load **no `docs-ui.js`**, so no board can launch there and no
floor is owed. Checked, not assumed.

### Where the rule does rest on a conflation

**The board IS JavaScript**, so a reader with JS off never gets a board to
collapse. Two readers are being served by one artefact:

- **JS-on** — `docs-ui.js` collapses the listing into a disclosure. The
  content could be FETCHED; relaxed R4 permits exactly that.
- **JS-off** — no board, ever. For them this is not "the board's fallback on
  this page", it is a global notes index duplicated ~2,405 times. What bean
  `0jtj` actually complained of is *"no note, no count, no hint that notes
  exist"* — a count, a hint and a path satisfy it.

### A live defect found while measuring

**`todos/index.html` serves ZERO items and carries no listing section at
all.** It is one of the eight JS shells in `first-paint-scheme.e2e.ts`. So
today a no-JS reader gets the full listing on `accessibility.html` and
**nothing on the notes page** — the one page most about notes is the only one
with no floor. That is `0jtj`'s defect, still live, at the destination.

### The option this implies, which is better than convert-or-keep

A footer **stub** (~300 B/page: `Open notes (3)`, linking to `todos/`), the
full static listing moved INTO `todos/index.html` where it is missing, and the
board fetching bodies. Recovers ~97 % of the ~104 MB, and leaves the no-JS
reader better off than today: count and path on every page, plus a served
listing at the destination that does not currently exist.

Two costs, both real:

1. `footer_custom.html` is `nav_footer_custom` — **#1886 phase C territory**,
   so this needs that session's agreement.
2. **The stub's count must not be `data-fa-todo-count` on a
   `fa-todo-listing` section.** `linear-floor.e2e.ts` test 5 asserts that
   attribute equals the panel's own cardinality; a stub carrying `3` with zero
   items is precisely the number-somebody-maintains that R6 designed out. It
   is a link label, not a panel count.

Test disposition: three of the five move to `todos/` (bodies, document order,
attachment/status), one stays (board-did-not-run), one splits. **None is
deleted, and the floor gets stronger** — one authoritative served listing
instead of 2,405 copies and an empty destination.

Put to the owner as a decision; not acted on.

## Evidence
All four Done-when items are ticked and re-derivable from the merged PRs below; the owner approval cited in the last bullet is reported by the closing session but not quoted or linked in the PR or here, so the bean is held at in-progress with the `ready-to-close` tag for the owner to confirm.
- Items 1–4 landed in PR #1369 (merge commit `6579d63239`; `staging-preview-size` threshold basis split into `pages-publish-health`, instrument bean `1dre` created).
- Follow-up investigation on linear floor (R4) scope landed in PR #1889 (merge commit `e89a5f4966`).
- Owner ruling 2026-10-07: Owner approved moving static notes listing into `todos/index.html` and using a footer link stub on docs pages (~97% size recovery). The architectural investigation of `qj9a` is complete; the agreed refactoring implementation can be tracked in dedicated execution items.

## Landed evidence (PR #2397)
- Completed and merged to main in PR #2397 (commit `03c23312ce4c`).
- Owner approved closing of architectural investigation. Verified on main.
