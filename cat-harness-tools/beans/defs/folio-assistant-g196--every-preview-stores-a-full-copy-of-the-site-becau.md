---
# folio-assistant-g196
$schema: bean/1.0.0
title: Every preview stores a full copy of the site because per-preview facts are baked into every page
status: completed
type: feature
priority: normal
created_at: 2026-09-19T12:53:43Z
updated_at: 2026-11-15T18:56:00Z
parent: folio-assistant-1xhc
---

**In one sentence:** every staging preview stores a full ~37.5 MB copy of the
site because three per-preview facts are baked into all ~530 pages, so git's
content-hash deduplication has nothing to grip — and moving those facts into one
small data file read in the browser would turn 530 differing files into one.
[View this bean](https://github.com/litlfred/folio-assistant/blob/main/beans/defs/folio-assistant-g196--every-preview-stores-a-full-copy-of-the-site-becau.md)

**What I would do next:** emit `STAGING/<slug>/staging.json` carrying branch, sha,
built, PR and run URL, and render the banner and supply the baseurl from it at
load time — the same client-derived pattern `head_custom.html` already uses for
the sidebar QR.

Split out of `xxku`, which measured the problem and fixed only the fourth cause.

## The measurement — 2026-09-19, `origin/gh-pages`

9 previews, **346.1 MB**, against `STAGING_WARN_BYTES = 100 * MB`. Of each
37.5 MB preview, **27.5 MB is HTML** — and **zero HTML blobs are shared between
any two previews** (`git ls-tree` blob-hash intersection: 0 of ~390 HTML objects,
against 185 of ~780 overall; the shared ones are images, fonts and vendor JS).

Diffing `crdm-methodology.html`, a page neither branch touched, between two
previews: 86 of 1881 lines differ, **75 of them carrying the preview slug.**

## Three causes, and any one of them defeats deduplication alone

**1. The build timestamp and commit SHA in the staging banner.** This is the
fundamental one. `feature-staging.yml` injects into every page:

    🔀 FEATURE BRANCH — <slug> · commit ${SHA} · built ${BUILT} · PR #… · build log

`${BUILT}` is `date -u +%Y-%m-%dT%H:%M:%SZ`, so **every page is unique even
across two builds of one branch.** Each re-push therefore adds ~27.5 MB of
permanently new blobs to `gh-pages`, and the history grows even when the preview
count does not. Confirmed in the run 597 log: *"Injected staging banner into 530
HTML files"*.

**2. `baseurl`-prefixed hrefs, ~235 per page.** Jekyll's `relative_url`
**prepends `baseurl`**; it is not document-relative. `head_custom.html` uses it
throughout and its comments already anticipate the STAGING baseurl — which is
precisely why the slug is on every asset href. Byte-identical pages need a
post-build rewrite to document-relative paths, not a config change.

**3. The `fa-translation-index` island publishes `site.baseurl` to JavaScript.**
`docs-ui.js` is *told* the baseurl, deliberately, per its own comment: *"under a
`baseurl` this script is told rather than guesses"*. `navKey()` strips it from
each nav href and the language switcher **rebuilds** hrefs as `baseurl + t.url`.
So (2) cannot be done without (3): document-relative hrefs break the switcher,
and the island keeps every page distinct until the baseurl is derived at runtime.

A fourth cause — `canonical`, `og:url` and `jekyll-seo-tag`'s inline
`WebPage.url` — is **already fixed** by `scripts/strip-preview-seo.ts`
(`xxku`, PR #414), on correctness grounds rather than size. Verified on the
deployed preview against a control: 0 claims per page where an older preview has
2–3.

## The shape, and the precedent is in this repo already

**Derive the per-preview facts in the browser rather than baking them into 530
pages.** `STAGING/<slug>/staging.json` holds branch, sha, built, PR and run URL;
a script reads it at load time to render the banner and to supply the baseurl the
language switcher needs. **530 differing files become one.**

This is not a new idea here: `head_custom.html` records the sidebar QR as
*"generated in the browser from `window.location.href` rather than baked per page
at build time"*, for the neighbouring reason (so it is right for anchors and both
URL spellings). The banner and the baseurl want the same treatment.

## What it is worth, stated honestly

Projected: one HTML copy (~27.5 MB) + N x ~5 MB graph/search exports + ~5 MB
shared assets. At 9 previews that is **~77 MB — under the threshold with nothing
pruned and no live preview destroyed**, against 346 MB today.

**But the exports are a real floor, not duplication.** `search-data.json` must
index the branch's own pages and `folio-assistant.jsonld` is the graph *of that
branch*, so both legitimately differ per preview. At ~18 concurrent previews they
alone breach 100 MB. That is the point to reconsider the threshold's **value** —
and to do it by stating the floor in its basis, never by a prune policy.

## What must NOT change, and why

The **identity** references stay absolute, byte-for-byte. In
`folio-assistant.jsonld`: `@id` (1244), `partOf` (857), `to`/`from` (443 each),
`performedBy` (414), `schema` (104), `inputSchema`/`outputSchema` (22 each) —
5205 in total. A relative JSON-LD `@id` resolves against the document's
**retrieval** URL, so serving it from Pages, opening it from disk and embedding
it elsewhere give three different graphs; and `schema`/`inputSchema`/
`outputSchema` are JSON Schema references a validator handed the document out of
band cannot resolve at all.

**An address may be relativized; a name may not.** Deduplication is worth
having; it is not worth buying with identity. This was the owner's correction to
`xxku`'s first proposal and it is the constraint on this bean.

Also already safe: `@context` prefixes are absolute and slug-free
(`https://litlfred.github.io/folio-assistant/bootstrap/ns/`), so the vocabulary
namespace was never at risk.

## Not doing without the owner deciding

Whether a preview should mint its own `@id` for all 1244 nodes at all. It may
well be correct — a preview's graph genuinely differs in content, and an unstable
id for an unstable artefact is honest. The clearly *wrong* alternative is a
preview claiming the published `@id`s, since two documents would then assert
different facts about one node. Left alone.

## Done when

- [x] `staging.json` emitted per preview, carrying branch, sha, built, PR, run
      URL — and `newPages`, which the bean did not anticipate. See below.
- [x] The banner rendered from it at load time, so its markup is constant
      across previews AND across rebuilds of one preview. **Pinned by byte
      comparison** (`staging-banner-constant.test.ts`) rather than by
      inspection; the client half is pinned in a real browser
      (`staging-banner.e2e.ts`). **Still wants the person's look at a rendered
      preview** — continual-progress is explicit that a rendered artefact
      cannot be assessed from a description of it, and a byte-equality test is
      a description.
- [x] `docs-ui.js` derives the baseurl at runtime (`SCRIPT_BASE` derived from its own `<script>` URL in `cat-harness/site-chrome/docs-ui.js`, `navKey` resolving relative hrefs via `new URL(href, location)`, and `fa-translation-index` moved to `assets/harness/site.json`, landed in `cat-harness#439` and `cat-harness-tools#676`).
- [x] Presentational hrefs emitted document-relative (`cat-harness/site-chrome/_plugins/fa-root-relative.rb` in `cat-harness#439` / `#478`, content-hash `?v=` in `cat-harness#432`, `liquidSiteBase` in `fhir-harness#137`, scope-hashed rail/row assets in `cat-harness-tools#904` `bfaaa9f`, and `staging-share.ts` serving pages identical to `main` from `main` in `cat-harness-tools#1115` + `isReleaseBuild` in `staging-stamp.ts`).
- [x] Re-measure STAGING and compare against the ~77 MB projection (measured 2026-11-15 on `litlfred/folio-assistant` `origin/gh-pages` @ `2b16b35dd0050bc7c225a236abe525e4a51cd679` — see §"2026-11-15: Re-measured on deployed previews (`origin/gh-pages` @ `2b16b35`)" below).
- [x] `STAGING_WARN_BYTES` revisited with its floor restated, once the real
      number is known (`STAGING_WARN_BYTES = MAX_PREVIEW_BYTES` = 3 GB in `cat-harness-tools/test/health/checks.ts:551`, enforced by `staging-rotate.ts` per owner ruling 2026-10-04 `"Cap by size, not count"`, `"3gb"`, with the two-budget floor documented in `stagingPreviewSize`'s `basis` in beans `1dre` and `xxku`).

## Risks

- Touches the docs build and the language switcher, with ~20 branches live in
  `docs/` on 2026-09-19 — coordinate rather than land blind.
- The banner exists so a reviewer **cannot** mistake staged content for the
  published site. A client-rendered banner must not be defeatable by a failed
  fetch: if `staging.json` cannot be read, the page must still say it is a
  preview. **"Could not determine" is never rendered as "this is the real
  site"** — the same third-state rule the rest of this repository runs on, and
  here the failure mode is a reviewer approving the wrong artefact.


---

*2026-09-20* — **Cause 1 landed. Causes 2 and 3 did not, on purpose.**

## What shipped

`cat-harness/scripts/staging-banner.ts` replaces the bash banner in
`feature-staging.yml`. It writes the build's facts once to `staging.json` at
the preview root and injects a fragment that **takes no argument**; the
browser derives its preview root from `location.pathname`, fetches the JSON
and fills the banner in — the client-derived pattern `head_custom.html`
already uses for the sidebar QR, as this bean proposed.

## The one thing that could have sunk it, checked first

The compare link was the risk: it is the single genuinely per-page fragment,
with three states (present on main → deep link; absent → site root and SAY the
page is new; publish ref unread → site root, neutral). It looked like
build-time per-page data, and if it were, the fragment could not be constant
and the saving would collapse.

It is not. The client knows its own path; the only thing it cannot compute is
**which pages main has** — so `staging.json` carries `newPages`, the pages
with NO counterpart, which is the **short** list rather than the long one.
Membership is a client-side check. That field is not in this bean's proposal
and is the one design decision the bean did not already contain.

## How it is verified, and why not by looking at it

`staging-banner-constant.test.ts` (16 tests) runs **two builds with different
SHA, timestamp and PR and compares the emitted HTML byte for byte**. That is
the bean's actual claim — a test asserting the markup contains some string
would pass just as happily with the SHA still in it. Beside it, a positive
control: `staging.json` must still DIFFER between those runs, or the facts
went nowhere and the banner is constant because it is empty.

`staging-banner.e2e.ts` (9 tests) runs the client half in Chromium, because a
unit test cannot: it only runs with a `location.pathname` under `STAGING/` and
a JSON to fetch. All three states are asserted first-class — fetched, 404, and
not-served-from-a-preview-path — along with the sidebar offset (filling the
banner in is a **third** moment its height changes, which the build-time
version never had) and a branch name carrying an `onerror` payload.

**Ratcheted both directions.** Reintroducing a build fact into the page fails
2 unit tests. Degrading the failed-fetch path to silence fails the e2e — and
initially did **not** fail the unit test, because `toContain` over the whole
fragment matched the *other* unavailability message. Found by ratcheting, not
by review; that test is now scoped to the `catch` body. A test that cannot
fail is this repository's recurring defect and it was one keystroke from
shipping again here.

## The two rules this bean set, and where they now live

*"A client-rendered banner must not be defeatable by a failed fetch."* The
static markup carries "FEATURE BRANCH" before any fetch happens and the fetch
only ever ADDS detail, so the degraded state announces the preview and says
the detail is gone.

New, and not in this bean: **values from the JSON go in as `textContent`,
never as markup.** Git ref names may contain `<`, `>` and `"` — they are not
in git's forbidden set, which stops at space, `~`, `^`, `:`, `?`, `*`, `[`,
`\` and the control characters. The bash banner interpolated `$BRANCH` into
an HTML string, so a branch name was markup; the client builds nodes.

## What is NOT fixed, and the honest accounting

Causes **2** and **3** are untouched: `relative_url` still prepends the
`baseurl` to ~235 hrefs per page, and the `fa-translation-index` island still
publishes `site.baseurl` to JavaScript. This bean already establishes they are
**one** change — document-relative hrefs break the language switcher, which
rebuilds them from the baseurl — and its own Risks section says ~20 branches
were live in `docs/`. Splitting them off was the cut with the best
risk-to-value ratio, not a stopping point reached by running out of road.

So: pages still differ **between** previews by slug. They no longer differ
**across rebuilds of one preview**, which is the *unbounded* half — the reason
"the history grows even when the preview count does not".

**The ~77 MB projection is not claimed.** It needs previews deployed from this
code, which a checkout cannot produce. This bean's own words: *"A projection
that was not checked is a guess."* Two Done-when rows stay open on it.

## Two drift hazards found in passing, one fixed

`skills/sdlc/sdlc-core/feature-staging.md` described a **"yellow staging
banner"** — stale since the contrast fix that replaced `#d946ef` (3.46:1
against its own white text, failing AA) with `#4F6F52` (5.63:1). Fixed, with
the measurement, so the next editor does not restore a colour for looking
right.

Not fixed: `cat-harness/test/sidebar-panels.e2e.ts:62-63` carries its **own
hand-copied** banner and offset script. It is a theme-structure harness rather
than a banner test, so it is not wrong today — but it is the shape `bqrg`
measured, where six copies of one function had three broken and nothing said
so. Left alone rather than changed blind, and recorded here so it is a known
copy rather than a forgotten one.

---

*2026-09-20, same session* — **The claim above was FALSE as deployed, and the deployed artefact is what found it.**

## What I claimed, and what the previews actually did

The entry above says pages "no longer differ **across rebuilds of one
preview**". Two deploys of this branch, **three minutes apart**, both already
shipping the constant banner:

```
b56b960  17:00:26  staging(claude-wonderful-bohr-6kxh7b)
bbd5989  17:03:27  staging(claude-wonderful-bohr-6kxh7b)
   1466 insertions(+), 1465 deletions(-)  across 613 files
   every HTML page: 1 insertion, 1 deletion
```

Every page still changed, on every deploy. The only source difference between
those two runs was a QA sidecar that is not rendered at all.

## Cause: the footer carries the same stamp, one include away

`docs/_includes/footer_custom.html` renders `site.data.build.short_sha`,
`built_at` and `run_url` into the footer of **every** page, and the staging
build's "Stamp the build" step wrote a fresh `date -u` into
`docs/_data/build.yml` on every run.

**It is the same defect as the banner and it survived the banner fix**, because
it lives in a Jekyll include rather than in the workflow's injection step. The
bean's three named causes did not include it: cause 1 was scoped to "the build
timestamp and commit SHA **in the staging banner**".

## Fixed the same way

The staging build no longer writes `short_sha`, `built_at` or `run_url`, so
Jekyll renders the footer identically every time, and the client's `stamp()`
fills the real values from the **same** `staging.json` the banner already
fetches — one request, two consumers. `docs-site.yml` still stamps the MAIN
site, where there is one copy and nothing to deduplicate, and where the
include's own reason stands: *"a stale browser cache and a deploy that has not
run look identical"*.

A failed fetch leaves Jekyll's `| default: 'dev'` in place rather than blanking
the footer — the same third state as the banner.

## The lesson, which is the part worth keeping

**Every unit test above was correct and the page was still wrong.** They assert
things about `FRAGMENT`, and `FRAGMENT` is genuinely constant. A test of the
part is not a measurement of the whole, and the only thing that caught this was
reading the deploy commits on `gh-pages` — the artefact, not the code.

That is this bean's own Done-when row talking: *"Re-measure STAGING… A
projection that was not checked is a guess."* The projection was not the only
guess; the **mechanism** was one too.

Now guarded by 6 more tests: the workflow must not write those three keys on a
staging build, the keys it does write must be the per-preview-constant ones,
the client must CALL `stamp`, `docs-site.yml` must keep stamping the main site,
and two browser tests over a fixture reproducing the real Liquid output.

## Four tests that could not fail, in one change

Worth recording together, because the pattern is identical each time — **an
assertion naming what two things share rather than what distinguishes them**:

1. `toContain("build details unavailable")` over the whole fragment — matched
   the *other* unavailability message, stayed green with the catch path
   emptied.
2. "carries no copy of the arithmetic" in `06kg` — matched the *comment*
   explaining why it carries no copy.
3. `toContain("fa-build-stamp")` — matched the function *definition*, stayed
   green with the call deleted.
4. `/\bstamp\(f\)/` — the fix for (3), and it matched `function stamp(f){`
   too. The call ends in `;`, the definition in `{`.

All four were found by **ratcheting**, none by review. A test written and not
falsified is a test whose failure mode is unknown.

## The confirming measurement is still outstanding, and why

Two attempts at it, neither decisive, both worth recording so the next agent
does not repeat them:

| deploy | from | verdict |
|---|---|---|
| `6335c20` 17:11:28 | 06kg commit | last deploy with the stamped footer |
| *(the footer-fix commit's own run)* | `d64e14dc8` | **never deployed** — superseded |
| `63a8016` 17:21:47 | merged head | transition, and contaminated |

**The footer fix's own deploy never happened.** Its run was cancelled when the
next push queued behind it — the concurrency behaviour this repository already
measured and recorded (three runs, three different branches, seventeen
seconds, two cancelled). Pushing twice in quick succession costs the first
deploy, which is worth knowing when a deploy IS the measurement.

**And `63a8016` cannot settle it.** It is the transition (stamped footer →
constant footer), so every page legitimately changes once; and the same push
merged `main`, which had taken three PRs, so the pages gained markup from
elsewhere. Measured **+9 / −1 per page** — the `−1` is consistent with the
footer line going, the `+9` is main's, and neither is evidence about
deduplication.

### What would settle it

Two consecutive deploys of one branch **with no intervening change to rendered
content**. A bean-only commit is exactly that: the sticky board fetches
`docs/assets/todos/index.json` at runtime, so a bean edit reaches no HTML page.
If the banner and footer are both constant, such a deploy must touch **no
`.html` file at all** — only `staging.json`, the todo index and the render log.

That is a sharper test than the ~77 MB projection, and it fails loudly: one
changed HTML page means something per-build is still baked in, and the diff
names the line.

**Until that number exists, this bean claims nothing about deduplication.**
The banner and footer are each pinned constant by tests; whether the PAGE is
constant has been asserted twice in this bean and measured false once.

---

*2026-09-20* — **The probe fired. There was a THIRD cause, and the fix was still incomplete.**

## The measurement, at last

`9cda2235` was bean-only — one file, and a bean reaches no HTML page. Its
deploy `d7a09ee` (17:25:19) directly follows `63a8016` (17:21:47) on the same
branch, with nothing else in between. Exactly the controlled pair this bean
asked for:

```
1193 insertions(+), 1192 deletions(-)
```

**Still every page, still one line.** Two claims made, two claims false.

## Cause 3: TypeDoc writes the commit SHA into every source link

Fetched the actual page rather than guessing again:

```html
<li>Defined in <a href="https://github.com/litlfred/folio-assistant/blob/
    9cda2235164f598e1d7197a39628ac47f141eb80/cat-harness/schemas/builders.ts#L85">
```

TypeDoc defaults `gitRevision` to the current commit, so every `api/` page
carries a fresh 40-hex SHA on every build.

## What the same measurement says about the first two fixes — they WORKED

The diff is path-sorted, and its first entry moved:

| deploy | first changed file |
|---|---|
| `bbd5989` (before) | `STAGING/…/start/accessibility.html` |
| `d7a09ee` (after) | `STAGING/…/api/functions/…actor.html` |

`accessibility.html` and `agentic-harness.html` sort **before** `api/` and led
the old diff. They are absent from the new one, so those Jekyll pages are now
byte-identical across rebuilds where they previously changed every time.

**Stated no wider than that.** GitHub caps a commit's file list, so the tail
was not readable and this bean does NOT claim every Jekyll page is constant —
only that the two it can name are, and that the changed set now begins at
`api/`.

## Fixed

`--gitRevision "$STAGING_BRANCH"` on the staging TypeDoc invocation. The branch
is stable across rebuilds of one preview, which is what deduplicates.

The cost is named rather than hidden: a source link now follows the branch
instead of freezing a commit. That is right for a **preview**, whose purpose is
to show the branch as it stands. `docs-site.yml` is deliberately unchanged —
one copy, nothing to deduplicate, and a permanent link is worth more there than
a live one. Both halves are pinned by tests, and the second ratchets against
somebody "tidying up" the asymmetry.

## The lesson, sharpened

Three causes, three fixes, and **each was invisible until the one in front of
it was removed.** No test of the banner could have found the footer; no test of
either could have found TypeDoc. Every unit test passed at every stage, and
every stage was still wrong.

The only thing that ever found a cause was **measuring the deployed artefact**
— and it took a deliberately controlled experiment (a bean-only commit, to
hold rendered content fixed) to make the measurement mean anything. Two
earlier attempts failed: one deploy never ran, cancelled by the next push; the
other was a transition contaminated by a `main` merge.

**This bean still claims nothing about deduplication.** The fix is now three
deep and the fourth measurement has not been taken.

- [x] **Re-measured, and it passes.** See below — exactly ONE `.html` file
      changed, and it is the page whose source changed.


---

*2026-09-20* — **MEASURED TRUE. Third time asked, first time evidenced.**

## The pair

Two consecutive deploys of this branch, both carrying all three fixes:

```
6ce2495  17:30:28  from a328ec0   (the TypeDoc fix)
92abd14  17:36:36  from 566b2be   (hqku — a skill edit and a schema change)
```

## The result

| changed | lines | why |
|---|---|---|
| `reference/skill-instructions/content-context-and-state-graphs.html` | 74 / 1 | **the one page whose source I edited** |
| `assets/js/search-data.json` | 1931 / 1924 | the search index over that page |
| `folio-assistant.json`, `.jsonld` | 7 / 7 | the graph export of the schema I changed |
| `folio-assistant.schema.json`, `skills/*/{input,output}.schema.json` | 2 / 2 each | schema exports of the same change |

**Exactly one `.html` file, and it is the page that genuinely changed.** No
`api/` page moved. No unrelated Jekyll page moved.

Against the baselines this bean recorded:

| pair | HTML churn |
|---|---|
| `bbd5989` (banner only) | 1466 / 1465 across 613 files — **every page** |
| `d7a09ee` (banner + footer) | 1193 / 1192 — **every page**, TypeDoc's SHA |
| `92abd14` (all three) | **1 page**, and it is the one that changed |

## What this establishes, and what it does not

**Established:** a preview's pages are byte-identical across rebuilds of that
preview. That is the unbounded half — the reason *"the history grows even when
the preview count does not"* — and it is closed. Each re-push no longer adds
~27.5 MB of permanently new HTML objects.

**Not established, and still not claimed:**

- Pages still differ **between** previews by slug. Causes 2 and 3
  (`relative_url`'s baseurl prefixing, the `fa-translation-index` island) are
  deliberately untouched, so the cross-preview duplication is unchanged.
- The **~77 MB projection** remains unverified. It depends on the between-
  preview half, which was never in this change's scope.
- `search-data.json` and the schema exports moved here because the source
  moved. Whether any of them ALSO carries per-build data has not been isolated
  — a bean-only probe would settle it, and none of them is per-page, so none
  is the 27.5 MB problem.

## What it cost to get one number

Three causes, three fixes, **two false claims published before the first
measurement**, and four failed or contaminated attempts at measuring:

1. deploy never ran — cancelled by the next push
2. transition deploy — contaminated by a `main` merge
3. probe fired, found cause 3 rather than confirming
4. this one

The rule that came out of it is on the skill now, and it is the only thing
here worth carrying forward: **a test of the part is not a measurement of the
whole.** Every unit test passed at every stage, and the page was wrong at
every stage until the last.

---

## A measurement from another session — 2026-09-26, deployed previews

_Not this bean's owner, and nothing here is resolved or re-statused. Added
because two of the open `Done when` rows say the number "cannot be done from a
checkout", and I had reason to read the deployed `STAGING/` tree for an
unrelated reason (the owner asked whether anything was prunable). Read from
`origin/gh-pages`, not from a working copy._

### What `STAGING/` weighs today

| | |
|---|---|
| previews | **13**, every one an unmerged branch — 0 orphans, 0 prunable |
| summed file sizes | **1,884 MiB** |
| main site (non-`STAGING`) | 309 MiB |
| whole publish ref | 2,193 MiB |

Four previews drained themselves between 2026-09-25 18:20 and 2026-09-26, with
nothing prompting it: **17 → 13, 2,533 → 1,884 MiB.** So a single-instant
reading of this directory overstates it — the store drains on PR close, and a
measurement taken during a busy day catches previews whose PRs are about to
close. Worth knowing before anyone treats a size finding as a standing fact.

### This is NOT the confirming measurement, and it cannot be

The `~77 MB` row asks for previews **deployed from code with causes 2 and 3
fixed**. Those are deliberately untouched, so the tree I measured is the
*before* picture for the remaining work, not a test of the projection. Stating
that plainly because I nearly made the opposite mistake in the other direction:

**I first read `~77 MB` as per-preview rather than as the total at 9 previews**,
and computed from it that completing this bean would still leave the site 240
MiB over GitHub's 1 GB — i.e. that the fix was necessary but not sufficient.
That was wrong, and it is this bean's own rule biting the reader rather than the
author: a figure can be real and attached to the wrong quantity. At 13 previews
the model gives **~27.5 + 13×5 + 5 ≈ 97 MB**, which is not a dent in 1,884 MiB,
it is the removal of it.

### What the tree does independently confirm — the dedup premise holds

The projection rests on one shared HTML copy. That mechanism is already working
for whatever is identical, and can be measured now:

| | |
|---|---|
| file entries under `STAGING/` | **38,407** |
| distinct blobs | **12,138** |
| entries that are duplicate content | **68.4 %** |
| summed sizes | 1,884 MiB |
| **distinct content** | **1,362 MiB** |

So git already shares two thirds of the entries, and 522 MiB of the 1,884 is
dedup happening today. The remaining gap is the per-page HTML that causes 2 and
3 keep distinct by slug — which is the same thing this bean says, now with a
number on how much of the store is already behaving as the projection assumes.

### The export floor, restated with today's concurrency

This bean's own caveat — *"the exports are a real floor, not duplication … at
~18 concurrent previews they alone breach 100 MB"* — lands differently at 13:
13 × ~5 MB ≈ 65 MB of legitimate per-preview content, before any HTML. That is
the number the threshold's `basis` would have to state, and this bean already
says the value is reconsidered *"by stating the floor in its basis, never by a
prune policy."* Recorded here rather than acted on: the floor moves when causes
2 and 3 land, so restating it now would pin it to the wrong model.

### Left alone, deliberately

No box ticked, no status changed, no threshold edited. The two deferred rows
stay deferred — their reasoning (causes 2 and 3 are one change, the language
switcher rebuilds hrefs from the baseurl, ~20 branches live in `docs/`) is
sound and unaffected by anything above.

_2026-10-16T10:30:00Z_ — Back to `todo`: nobody is holding this; its last note says it is parked (waiting on a trigger, a ruling or a deferred row), and an untouched `in-progress` claim misleads sibling sessions (owner choice, https://claude.ai/code/session_01NUrhvvMEwU5MmPW4L2w9jP).

_2026-10-16T10:30:00Z_ — Back to `todo`: nobody is holding this; its last note says it is parked (waiting on a trigger, a ruling or a deferred row), and an untouched `in-progress` claim misleads sibling sessions (owner choice, https://claude.ai/code/session_01NUrhvvMEwU5MmPW4L2w9jP).

---

*2026-10-23* — **Re-read of the deployed tree before proposing causes 2 and 3. One regression found; cause 3 has mostly moved already.**

_Read from `origin/gh-pages` (trees only, no sizes) and from `cat-harness@main`
(`site-chrome/`). No code changed; a proposal is with the owner._

**The store today.** 6 previews, ~4,900–6,100 HTML pages each (it was ~530 when
this bean was written). 33,050 HTML entries, 26,247 distinct blobs, only 2,285
shared by two or more previews. `index.html` of two previews: 206 slug
occurrences in one 152 KB page.

**Regression of cause 1 (the unbounded half).** `head_custom.html` puts
`?v={{ site.time | date: '%s' }}` on every first-party CSS and JS link (added
2026-09-21, the day after this bean measured rebuilds constant, to stop a
reviewer seeing a cached stylesheet). `site.time` is the build time, so every
page again differs on every rebuild of one preview. Its own comment names the
fix: a content hash per asset.

**Cause 3 has mostly moved.** The `fa-translation-index` island was moved to
the fetched `assets/harness/site.json` on 2026-10-02, which carries `baseurl`
once per preview. What is still per page: `<meta name="fa-baseurl">` and the
`relative_url`-built `fa-site-index-src` / `fa-todo-src` metas. `docs-ui.js`
already derives a base at runtime from its own script address (`SCRIPT_BASE`),
and `navKey` resolves relative hrefs with `new URL(href, location)`, so the
language switcher survives document-relative hrefs if `baseurl` keeps coming
from `site.json`.

**Cause 2 is unchanged** and is now the whole between-preview problem.
Precedent for document-relative output already ships: the nav rail data is
loaded as `./assets/navbar/rail-<hash>.js`.

## Measured on two deployed previews, 2026-10-23 16:47Z

Previews `STAGING/claude-g196-measure-a` and `-b` (folio-assistant#2639,
#2640), both pinned to cat-harness 5c8f6ec = main plus cat-harness#432
(content-hash `?v=`) and #439 (page-relative links, swap at `post_read`),
built 25 minutes apart. 5,592 HTML pages each:

| | pages |
|---|---|
| byte-identical between the two previews | 2,284 |
| differ ONLY by the preview's name | 1,954 |
| — smart-trust IG pages (fhir-harness `stage-ig-sites.ts` writes a literal baseurl into nav JSON and ig-topbar) | 1,514 |
| — TypeDoc API pages (`--gitRevision` / `--name` per branch, by design) | 294 |
| — smart-base pages | 146 |
| differ by `<meta name="fa-tiles">` only (one open-bean count went 133 → 132 between the builds) | 1,353 |
| `changes/` (per-branch by design) | 1 |

Every Jekyll page is now free of the preview's name. Before the fix, 0 pages
were shared between two previews.

**New finding: the live counts in `fa-tiles`.** The 12 KB tiles meta inlined
in every page carries live counts, so one bean opening or closing changes
every page of the site. cat-harness#434 (gp2f, Page weight thread) moves the
tiles list out to one cached file, which removes this churn too: no separate
work here.

**Left for this bean:** the IG nav JSON and topbar (fhir-harness), and
whether smart-base's 146 come from the same source. TypeDoc and `changes/`
stay per-branch.


_2026-10-26T10:40:00Z_ — Claimed by the cloud thread "Drain beans and open issues across repos" (session https://claude.ai/code/session_01MuDtPYhiVLUpaCdbvwQVL9). Taking the fhir-harness half: `stage-ig-sites.ts` writes a literal baseurl into the IG nav JSON and ig-topbar.

## 2026-10-26: re-measured on the four deployed previews; the fix is written, the pin is not (session https://claude.ai/code/session_01MuDtPYhiVLUpaCdbvwQVL9)

The fhir-harness half named on 10-23 (IG nav JSON and top bar) was already fixed that day: `liquidSiteBase` in `build-ig-site.ts` (fhir-harness 73de11f) hands the staged layout back to the host as `{{ site.baseurl }}`. Nothing more to write there.

Compared the four previews on gh-pages (blob ids from the git tree API):

| pair | HTML pages in both | byte-identical |
|---|---|---|
| pages-checks-after-deploy / pages-independent-of-ci | 5,481 | 2,349 |
| either of those / workflow-steps-accounted | 5,481 | 2,212 |
| repin-layers-green / any other | 5,414-6,096 | 1 |

Every differing page sampled (smart-trust/artifact 1,466, en/cat-harness 925, uml/overview 244, smart-base 146, proposals) differs only by `/folio-assistant/STAGING/<slug>/` in `relative_url` output: stylesheet and script links, the IG top bar. That is what `site-chrome/_plugins/fa-root-relative.rb` (cat-harness#439) removes. It is not in these builds: folio-assistant main pins cat-harness at a196134 (2026-10-23 19:45), which has no `site-chrome/_plugins/`; #439 merged at 21:36. The previews were built on that pin.

So the next step is the cat-harness re-pin in folio-assistant#2681 (CI speed thread's), then two previews from the new pin and the same comparison. Back to `todo`: nothing here to build until that pin lands.
---

*2026-10-29* — **Re-measured on deployed previews after folio-assistant#2681 (5827603) pinned the fixes (cat-harness#432, #478, fhir-harness#137).**

_Read from `origin/gh-pages` f1ede3c (git trees and blobs, HTML only)._

- **Cause 2 is fixed in deployed output.** `STAGING/claude-repin-layers-green/` (the #2681 branch, the only preview built with the new pins) has hrefs like `./assets/css/…` and `./assets/qa/…`, and its `index.html` has 0 occurrences of its own slug. A preview built from older pins (`dependabot-…`) still writes `/folio-assistant/STAGING/<slug>/` into every link.
- **Rebuilds are mostly constant.** The same preview, built 2026-10-26 16:35 and 2026-10-28 12:37 across further layer re-pins: 11,625 common pages, **6,945 byte-identical (59.7 %)**. The differences checked are real content (a count 23→24, a new Schemas link), not build stamps.
- **Not yet measurable: sharing BETWEEN previews and with the root.** Every other preview and the main-site root were built from pre-#2681 code, so they share 0 identical pages with the new one, as expected. The ~77 MB projection is still unclaimed. It needs two previews (or a preview and the root) built from main at or after 5827603. The `Re-measure STAGING` row stays open for that.

---

*2026-10-29T11:05Z* — **Second reading, gh-pages 51c51bc (after the 10:36Z main publish). Lane D, session https://claude.ai/code/session_01Qmmkt62KVMxDU9gjVV1mm2.**

- `STAGING/claude-repin-lane-e-2/` is now the one preview on current code. Its pages carry no slug, no SHA and no build time (checked on `smart-trust/artifact/ActorDefinition-Holder-testing.html`); the banner reads `staging.json`.
- **A preview can never share pages with the root as built.** The root was rebuilt from current code at 10:36Z, yet lane-e-2 and the root share 1 of 9,342 HTML pages. The diff is the inline staging-banner script (about 50 lines at the top of every preview page), which root pages do not have. The script is constant, so previews can share with each other, but not with the root. Moving it to a shared `assets/js/staging-banner.js` would not fix this either: the `<script src>` tag itself still differs from the root page. The ~77 MB projection should count preview-to-preview sharing only.
- Preview-to-preview sharing is still not measurable: it needs a second preview built on current code. The `Re-measure STAGING` row stays open.

_2026-10-30T12:00Z_ — Measured on gh-pages aa92ccd. The two newest previews share 4,694 of 11,897 HTML pages, but they were built from different code, so this is not yet the same-code re-measure. There are two causes whatever the code. (1) About 20% of graph pages embed the preview IRI (`kg-export --base-url` in feature-staging.yml, deliberate). (2) About 45% of pages reference the content-hashed `rail-<hash>.js`, so every railed page changes when the rail does. Owner calls are pending on both. Side finding: smart-base node IRIs differ between the two previews. (https://claude.ai/code/session_01Qmmkt7iaCtGYwZbW9x7eYe)

_2026-10-30T12:45Z_ — Owner, 2026-10-30 12:39Z (card "A. Apply all"): (1) keep the per-preview IRIs in node HTML, because that is deliberate and stops a preview claiming to be the canonical graph. (2) Give the rail data a stable filename and do the cache-busting outside the page, so railed pages stop changing whenever the rail does. Next: build two previews from the same main commit to close the re-measure row. (https://claude.ai/code/session_01Qmmkt7iaCtGYwZbW9x7eYe)

_2026-10-16T10:30:00Z_ — Back to `todo`: nobody is holding this; its last note says it is parked (waiting on a trigger, a ruling or a deferred row), and an untouched `in-progress` claim misleads sibling sessions (owner choice, https://claude.ai/code/session_01NUrhvvMEwU5MmPW4L2w9jP).

_2026-10-30T14:40Z_ — Implemented owner ruling (2) in `cat-harness-tools#904`: `railDataAsset` (`scripts/lib/harness-rail.ts`) now hashes the rail's scope (`instance`, `root`, `pages` scope and `documentIndex` header) rather than the full `RailShared` JSON, and `navbarRowAsset` uses a constant filename (`assets/navbar/row-c3p1k2f55u.js`), so railed HTML pages stay byte-identical when links, pages, harnesses, marks or row counts change. Pinned by unit test in `scripts/tests/ui/navbar-assets.test.ts`. Remaining: once pinned in `folio-assistant`, build two previews from the same `main` commit to close the re-measure row.

_2026-10-30T19:45:00Z_ — litlfred/cat-harness-tools#904 merged as `bfaaa9f` (owner card 19:40Z): shared rail and row assets are named by scope, not content. Takes effect on the site after folio-assistant re-pins cat-harness-tools past `bfaaa9f` (CI speed thread). Open boxes above are unchanged. Session https://claude.ai/code/session_01Qmmkt7giLfKwPARpwXGm2d (thread "Drain CI and QA beans").

_2026-10-31T01:15:00Z_ — Re-measured STAGING on gh-pages `db3f36f` (git tree sizes, read from the API): about **911 MB** in all, 3 previews plus `_retired` (0.3 MB). `claude-repin-lane-e-2` 563 MB (31,901 files), `claude-repin-pot-who-free` 596 MB (32,982), `claude-workflow-steps-accounted` 408 MB (17,939). Each carries `staging.json`. So each preview is still a full copy, as expected while the baseurl and href rows are deliberately not done; the ~77 MB projection is not met and is not claimed. Two previews record `pr: n/a` (no open PR) and the third is PR #2674's from 2026-10-23, so all three look prunable. Session https://claude.ai/code/session_01Qmmkt7giLfKwPARpwXGm2d (thread "Drain CI and QA beans").

_2026-10-31T22:42:32Z_ — Claimed by sibling S1 of the bean drain (thread "Slim preview pages to match main", session https://claude.ai/code/session_01Qmmkt8NsZHrqX71Q8Hnx8w). Measured on gh-pages `6b6942b`:

- **Row 2 of "Shrinking the cone" is already met another way.** `staging-share.ts` (cat-harness-tools#1115) compares preview pages to main's with the banner, the two metas, the SEO strip and the TypeDoc title set aside, and serves the equal ones from main. The four live previews share 16,675 to 18,462 files each and keep 9,213 to 11,243. The footer is already filled in the browser (main pages render `deployed dev`).
- **What the kept pages differ by.** A sample of 120 kept pages of `claude-repin-core-figure-kinds`: 59 are graph pages (preview IRIs and `alternateOf`, kept by the owner's 2026-10-30 ruling, plus the `staging` stamp); 50 are Jekyll pages with a different `?v=` asset hash, which is real (that preview re-pins cat-harness-tools).
- **The bigger cone: the `staging` stamp on main.** Main deploy `ee02d1d..5bdefb2` (19:33Z to 21:14Z) changed 10,635 files; in a sample of 150, 112 (75%) differed only by the stamp's `sha` and `run`. Fixed here: a build of `main`/`master` with no `KG_BRANCH` writes no stamp (`isReleaseBuild` in `staging-stamp.ts`), which is what the term's gloss already says ("when it is a staging preview rather than a release"). `build.json` names main's commit once.

---

_2026-11-15T18:56:00Z_ — **Re-measured on deployed previews (`litlfred/folio-assistant` `origin/gh-pages` @ `2b16b35dd0050bc7c225a236abe525e4a51cd679`) and completed (session https://claude.ai/code/session_01E667391F74184786BF4B9D):**

- **Preview-to-main sharing (`staging-share.ts`, `cat-harness-tools#1115`):** Previews built with `mainPagesKnown: true` omit HTML pages identical to `main` and serve them from `main` via `staging.json`. Per-preview HTML file counts dropped from `15,564` HTML files (`504.0 MiB`, unshared builds `repin-train-20261105-2025` / `2222`) to `6,095–9,037` HTML files (`226.5–357.2 MiB`, e.g. `repin-train-20261106-0041` at `6,095` HTML files / `226.5 MiB`, `claude-tv20-qa-copy-reuse-probe` at `6,529` HTML files / `240.9 MiB`, `claude-repin-subgraphs-and-deploy-fix` at `6,711` HTML files / `287.9 MiB`, `repin-train-20261106-0425` at `9,016` HTML files / `353.3 MiB`, `repin-train-20261106-0658` at `9,037` HTML files / `357.2 MiB`) — a **42.0%–60.8% reduction in per-preview HTML file count**.
- **Preview-to-preview git blob deduplication:** Between consecutive previews built on current code (`repin-train-20261106-0425` with `9,016` HTML blobs and `repin-train-20261106-0658` with `9,037` HTML blobs), **`5,451` HTML blobs (`60.4%`) are byte-for-byte identical git blobs** (compared against **0 shared HTML blobs** before `g196`).
- **Whole-`STAGING/` deduplication vs initial ~77 MB projection:** Across all `15` live previews plus `_retired` (`282,167` file entries whose raw entry sizes sum to `5,487,008,675 B` = `5,232.8 MiB`), git stores **`169,560` distinct blobs totaling `2,630,442,977 B` (`2,508.6 MiB`)** — a **52.1% reduction in unique blob bytes** (`144,119` HTML entries deduplicated to `88,160` unique HTML blobs, `1,753.0 MiB`). Total unique storage exceeds the 2026-09-19 `~77 MB` projection because the corpus grew ~30× (`~530` pages / `37.5 MB` per preview in Sept 2026 → `15,564` pages / `~504 MiB` per full preview across 12 mounted instances in Nov 2026) and `STAGING_WARN_BYTES` was raised by the owner (`2026-10-04`) to `MAX_PREVIEW_BYTES = 3 GB` (`cat-harness-tools/test/health/checks.ts:551`), under which `STAGING/` holds 15 previews within budget (`2.51 GiB` unique blob bytes < `3 GB`).
- All six `Done when` items are met on `main` and `gh-pages`. Marking `completed`.
