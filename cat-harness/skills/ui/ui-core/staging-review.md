---
name: staging-review
description: >-
  Staging preview and before/after comparison for content review.
  Takes one optional string — what the reader wants to look at, in their own
  words — and returns a list of URLs, each looked up in the publish ref, with
  what is published at it and what to review there. Provides before (MAIN) and
  after (branches/) pairs so reviewers can compare rather than guess. Used by the
  CRDM feature development workflow, content authoring review sessions, and
  whenever a staging preview deploys or someone asks to see it.
user_invocable: true
input: schemas/skills/staging-review/input.schema.json
output: schemas/skills/staging-review/output.schema.json
allowed-tools: Bash(git*) Read Grep Glob mcp__github__pull_request_read mcp__github__issue_read
---

# Staging review — before/after comparison

> Skill id: `staging-review` · Package: `sdlc-core`

Provide before/after URL pairs whenever rendered content has changed in a
feature branch. This is part of every review or feedback session involving
visual content.

URLs tell the reviewer where to look. The captured, measured pair that goes
with them is `before-after-preview` (opt-in `cat-harness.sdlc`).

## The deep-link rule — every request for feedback

The rule now lives in [`feedback-deep-links`](../../authoring/content-lifecycle/feedback-deep-links.md),
outside the opt-in `sdlc` sub-graph, so every layer has it (owner, 2026-11-10,
card Q-SG-2 option A). This skill builds the links that rule asks for.

## Signature — one optional string in, a reviewable list out

Other processes invoke this skill, and so does a person typing
`/staging-review`, so the contract is stated formally: one left in prose is
one each caller re-derives.

### Input

| | |
|---|---|
| **type** | string |
| **cardinality** | `0,1` — optional, and at most one |
| **meaning** | what the reader wants to look at, **in their own words** |
| **absent** | the whole preview: every page this branch changed |

Keep the wording **verbatim** wherever the output echoes it — the same rule
`goal-review` (opt-in `cat-harness.sdlc`) applies to a goal: a request the agent
paraphrased is a different request, and the reader cannot tell which one the
list was built for.

It **narrows**; it never adds. *"The navbar"* gets the pages carrying it, not a
page that mentions it. **An ask matching nothing that changed is said, not
answered with the whole preview** — a list that silently ignores its input is
worse than an empty one, because the reader believes it was answered.

### Output

Markdown, in this order. Every part is required; an absent part is **stated**,
not dropped.

1. **What changed, in prose** — a short narrative, before any link: what a
   reader of the site will now see or do differently, in plain sentences,
   and why (the request it answers, in the requester's words where there
   are any). One paragraph per PR or per coherent change. A table of URLs
   tells a reviewer *where* to look; only the narrative tells them *what
   they are looking for*, and a reviewer who has not read the code cannot
   reconstruct it from a filename.
2. **Where to start** — one line, one URL: the one that best answers the input,
   or the page with the most change behind it when there was none. A reader
   opens one thing first whether or not you choose it for them.
3. **The comparison table** below — before (main), after (staging), what to
   review. Links are **deep** — to the page, and to the anchor on it where
   the change sits (`…/#harness-cat-harness`), never the site root with
   "scroll down".
4. **The pictures** — a before/after pair for each visual change, SHOWN to
   the reviewer (sent as images where the surface allows it), not only
   linked. A link asks the reviewer to do the comparison; a pair does it
   for them. How to make a fair pair is
   `before-after-preview` (opt-in `cat-harness.sdlc`). If a pair could not be
   made, say which and why — that is part 5, not a silent gap.
5. **What could not be checked**, per the three states below.

### The third column is the one with value

`What changed` must be phrased as **something to look at**, never as a
restatement of the filename. Build it by mapping changed files to published
surfaces:

| what changed | which page | what to say |
|---|---|---|
| a stylesheet or client script | every page that loads it | the affordance that changed, and **the gesture to make** |
| a template or include | the pages that include it | where on the page to look |
| generated content | the page it generates | **what it was generated from** — a stale generator and a correct one look identical on the page |
| a schema, a test, a gate | **none** | say so, and point at the diff |
| **folio content** (block manifests and prose) | the page each block renders on | **the ChangeSet's aspect**: reworded, moved, renamed, added, removed. See below. |

**Where a change is only visible after an interaction — a control behind a
disclosure, a mode a reader turns on — say WHICH interaction.** A reviewer who
cannot find the thing reports it as missing, and a gate that sweeps the page
without opening the view misses a defect behind it.

### You can open it yourself — the publish ref is a git branch

Everything above composes URLs **for a reader**. The agent writing them
usually cannot open them. From inside a session container:

| route | result |
|---|---|
| `curl https://<owner>.github.io/…` | `403` — CONNECT tunnel failed (policy denial) |
| `WebFetch` | `EGRESS_BLOCKED` |
| Playwright / Chromium | `net::ERR_TUNNEL_CONNECTION_FAILED` |

**A browser is not a way around it** — Chromium is proxy-configured too, so
"use Playwright" fails identically. Without another route, nothing in the
repository can look at what deployed, and a defect only a click reveals ships
past every green gate.

**But the site is published to the `gh-pages` BRANCH, and git works.** So the
deployed bytes are readable with `git show`, and a Playwright route handler can
serve them at their real path:

```ts
const blob = (p: string) => {
  try { return execFileSync("git", ["show", `origin/gh-pages:${ROOT}/${p}`], { maxBuffer: 1 << 28 }); }
  catch { return undefined; }                 // absent is a FINDING, not a 200
};
let missing = 0;                              // REPORT THIS. See below.
await page.route(`${ORIGIN}/**`, (route) => {
  const u = new URL(route.request().url());
  let p = u.pathname.startsWith(BASE) ? u.pathname.slice(BASE.length) : u.pathname;
  p = p.replace(/^\/+/, "");
  if (p === "" || p.endsWith("/")) p += "index.html";
  const b = blob(p) ?? blob(`${p}/index.html`) ?? shared(p);
  if (!b) { missing++; return route.fulfill({ status: 404, body: "not in the publish ref" }); }
  return route.fulfill({ contentType: typeFor(p), body: b });
});
```

**A preview that shares with the live site falls back to it.** A preview
(`cat-harness-tools/scripts/staging-share.ts`) stores only the files that
differ from the live site, and its `staging-sw.js` serves the
rest from the live root in the browser. So when `branches/<slug>/staging-sw.js`
is in the ref, a file absent from the preview is the live site's file at the
same path, and `shared(p)` must read it from the root (`blob` with `ROOT` set
to `""`). Without that, every shared file reads as missing. Where there is no
`staging-sw.js`, `shared` returns `undefined` and an absent file is a finding. The worker also puts the banner and `fa-staging` back on a live
page it serves, which the route handler does not, so judge banner presence on
the preview's own pages.

`ROOT` is `""` for the canonical deploy and `branches/<slug>` for a preview, so
the same handler gives you the **before/after pair this skill is about** — and
a count, not an impression. Fetch the ref first (`git fetch --depth=1
--filter=blob:none origin gh-pages`); blobs are then fetched on demand.

**Serve it under the real `BASE`.** A page served at the origin root cannot
reveal a missing `baseurl`, because *"composed against the base"* and *"not
composed at all"* are the same string there, so an e2e at the root stays
green over a missing `baseurl`.

**And `BASE` is NOT the site's base when you are reading a preview.** A
preview is published at `<origin>/folio-assistant/branches/<slug>/`, so that
whole prefix is what its pages compose hrefs against — `BASE` and `ROOT` carry
the same staging segment, one in the URL and one in the ref:

| reading | `ROOT` (in the ref) | `BASE` (in the URL) |
|---|---|---|
| the canonical deploy | `""` | `/folio-assistant` |
| a branches/ preview | `branches/<slug>` | `/folio-assistant/branches/<slug>` |

Getting that wrong doubles the segment — `branches/<slug>/branches/<slug>/...` —
and every asset 404s.

#### Report the absent count, and read it before anything else

**A run that could not fetch the page's assets has established nothing**, and
its other numbers are actively misleading: a wrong `BASE` on a correct deploy
reports zero tiles, which looks like the very defect being checked for. The
rule outranks every other number the run prints:

> **`missing > 0` is COULD NOT DETERMINE.** Not clean, and not a finding.
> Discard the run's other counts rather than reading them, fix the rig, and
> re-run.

Scanning nothing and reporting it *broken* is as wrong as reporting it clean,
and costlier: an agent acting on it goes looking for a defect that is not
there, or "fixes" one.

#### What this does NOT verify, and it matters

It serves the **bytes in the publish ref**. It is not the live host, so it
cannot see:

- redirects, headers, or anything else the host decides at request time
- Pages' own 404 handling, or its directory-index rules where they differ
  from the handler above
- whether the deploy has actually *published* — a ref can hold bytes that
  Pages has not served yet (§"Say how long")

So a green result here means *"the published bytes are right"*, never *"the
site works"*. Report it in those words.

#### When it stops applying

The technique rests on one assumption: **publishing goes to a branch.** If
publishing moves to the Pages artifact API, `git fetch origin gh-pages` fails
and there is nothing to read. Report that as **could not determine**, never as
a clean run — an empty ref and a correct deploy are opposite facts.

### The third state, here as everywhere

"Could not determine" is never rendered as clean — and a change with **no
rendered surface** is not a failure, it is the useful answer.

| case | report it as |
|---|---|
| not deployed yet | not deployed, with the timing from §"Say how long" — never a link to where it will be |
| a changed page absent from the publish ref | **a finding** — the build dropped it, or it is not a page |
| no rendered surface | reviewed in the diff, naming the files |

The middle row is the most useful thing this skill can report, and composing
its URL anyway would hide exactly that — §"Before you report a staging URL as
broken".

### The commit in the bot's comment is NOT your branch head

On a `pull_request` trigger the stage job builds `refs/pull/<n>/merge` — your
head merged into the base — so the commit the comment names **never** equals
your head and is not even in your clone. Comparing the two reports a stale
preview on every PR.

Resolve it instead. The merge commit's **second parent** is the head it was
built from:

```sh
git fetch origin "refs/pull/<n>/merge:refs/remotes/origin/pr-<n>-merge" -q
git log --format="%h %p" -1 origin/pr-<n>-merge   # <merge> <base> <YOUR HEAD>
```

Stale means that second parent is not your head — nothing else does. This is
the same fact `bun run cat gates` exists around: **CI tests the merge**, and so
does the preview, so a branch behind its base is previewing a tree nobody will
have.

### A stub where a layer should be is the cone, not a broken build

A composed layer the branch cannot reach is replaced by a one-page stub
pointing at the published copy. Which layers a preview carries is decided
by the staging cone ([`feature-staging`](feature-staging.md) §7), and the
build log prints each decision with its reason. Before reporting a missing IG
as a defect, read that line. If the cone left out something your change does
affect, the fix is a missing `writer` or `derivedFrom` on the directory's
declaration, not a rule to always carry it.

## Which pages to list: the Change Set's rendered list

When the change is a Change Set, do not choose the before/after pages by
judgement: take them from its rendered list (skill
`rendered-impact` (opt-in `cat-harness.sdlc`)), every content page on it, and say
which inputs the renderer could not place. A page the list does not name and
you add anyway is fine; a page on the list that you leave out is a gap the
reviewer cannot see.

### Read the node-view report for the preview

Before asking for review of a viewer change, run
`bun run cat node-views:report -- --base <preview root>/branches/<slug>/`
(or `--site` on the built tree) and read the rows for the folders the change
touches: which nodes there have no page, no row or no `.jsonld`, and which
folder links are dead or point at the raw repository. It is a QA report, not
a gate; quote its row for each folder you list, so the reviewer sees the
nodes the screenshots do not.

## When to provide before/after URLs

Provide before/after URLs in **every** interaction where:

1. **Content has changed** on a feature branch (authoring, editing, translation)
2. **CRDM feature development** — once requirements are agreed and a staging
   preview exists
3. **Review/feedback sessions** — when the user asks to review changes
4. **Translation review** — comparing translated vs source pages

## Before/after URL schema

Every feedback response involving rendered content must include a
`stagingComparison` object:

```typescript
interface StagingComparison {
  /** Feature branch name (e.g. "claude/206-staging-preview"). */
  branch: string;
  /** URL to the branch on GitHub. */
  branchUrl: string;
  /** PR number if one exists. */
  pr?: number;
  /** Pairs of before (main) and after (staging) URLs for changed pages. */
  pages: Array<{
    /** Page title or path. */
    title: string;
    /** URL on the main (production) site. */
    before: string;
    /** URL on the staging preview site. */
    after: string;
    /** What changed on this page. */
    summary?: string;
  }>;
}
```

### Example output

When reporting changes to the user:

```
### 📋 Staging comparison

| Page | Before (main) | After (staging) | What changed |
|---|---|---|---|
| Landing page | [main](https://litlfred.github.io/folio-assistant/#languages) | [staging](https://litlfred.github.io/folio-assistant/branches/claude-206-staging-preview/#languages) | Added French translation badge (the landing page itself changed, so its root is the page; the anchor is where the badge sits) |
| French landing | — | [staging](https://litlfred.github.io/folio-assistant/branches/claude-206-staging-preview/fr/index.html) | New page |
| Agent onboarding | [main](https://litlfred.github.io/folio-assistant/docs/cat-harness/guides/agent-onboarding.html) | [staging](https://litlfred.github.io/folio-assistant/branches/claude-206-staging-preview/docs/cat-harness/guides/agent-onboarding.html) | Language switcher added |
```

## URL construction

### Main (before)

```
https://<owner>.github.io/<repo>/<path>
```

Read from the layer's config (its `index.config.json` entry) → `readme.pagesBaseUrl`, or construct from
the repo's GitHub Pages URL.

### Staging (after)

```
https://<owner>.github.io/<repo>/branches/<branch-slug>/<path>
```

The `<branch-slug>` is the branch name with non-alphanumeric characters
replaced by hyphens (the same transform as `feature-staging.yml`).

### Deriving the slug

```typescript
function branchToSlug(branch: string): string {
  return branch
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}
```

## Integration with CRDM

In the CRDM requirements workflow (Phase 5: implementation), once a staging
preview is deployed:

1. **Post the staging URL** on the GitHub issue as a comment. For a folio,
   post the **review page** too, `branches/<slug>/review/`, and name it as the
   page a reviewer opens first. The `folio-staging` workflow's PR comment
   carries both links. The page lists every changed block, not only every
   changed page. Posting the site root alone sends a reviewer hunting through
   a 300-page document for a one-word edit.
2. **Include before/after table** for every changed page
3. **Link from the PR body** to the staging preview
4. **Remind reviewers** that staging uses the magenta "FEATURE BRANCH" banner

The staging preview is part of the acceptance criteria: stakeholders must
review the rendered output, not just the code diff.

## Integration with content authoring

When an author has made content changes on a feature branch:

1. **Compute the ChangeSet**, not a file list, when the branch touches a
   folio's `folio` graph: the `folio-changeset` Tool, with `--folio <folio
   dir> --base origin/main --head <branch>`. Its command line is the Tool
   node's `invoke`, declared by the content layer that defines the `folio`
   graph kind; this skill names the Tool, not that layer's path. It says, per block, whether it was added, removed, reworded (`prose`),
   edited (`manifest`), `moved` or `renamed`. A file list cannot: a
   prose-only edit changes no `.ts`, and a move changes two files that look
   unrelated. Rank "where to start" by it. For a large document, the section
   with the most changed blocks is where a reviewer's time goes first.
2. **Construct before/after URLs** for each changed docs page, and for each
   page carrying a changed block
3. **Present the change to the author** in the Output order above: the
   narrative first, then the deep-linked comparison table, then the
   before/after pictures themselves
4. **Offer to run the staging workflow** if not already running

### Finding your way on the review page

A 300-page review needs to know where it is, and to move in one key or one
click. The review page has a navigation pane, beside the list on a wide
screen and above it on a narrow one:

- **Outline.** Each document's chapters and sections, in manifest order,
  from the `outline.json` the folio's site build writes.
  - A section with something to review is a button that moves focus to it,
    with word badges ("2 changed, 1 comment, QA failing").
  - Any other section links to its published page.
  - It is **on the review page only**; normal pages carry no table of
    contents.
- **Minimap.** One cell per block, in order. It is **one tab stop**: Up and
  Down move, Home and End jump to either end, and Enter opens the block.
  Each cell is labelled in words and marked with glyphs (Δ changed, + added,
  ● open comments, ! QA failing), so colour is never the only signal.
- **Where am I.** Every move announces "document › chapter › section ›
  block" in the page's one live status line.

**Keys, each with a visible button twin:**

| key | button | goes to |
|---|---|---|
| `j` | Next | the next item |
| `k` | Previous | the previous item |
| `n` | Next with comments | the next block with open comments |
| `p` | Previous with comments | the previous block with open comments |
| `u` | Next unreviewed | the next changed block with no reviewer verdict on its CURRENT version |

**"Unreviewed" means no verdict on this version**, not "no comments". A
block whose only verdict is on an earlier version is unreviewed, and says so
in words ("1 verdict on an earlier version, not counted"). A build whose
`review-comments.json` carries no verdicts says "No verdict data on this
build" rather than treating every block as unread. Typing into a selector is never navigation.

**Tests.** the tools layer's `test/review-nav.e2e.ts` drives all of this with the
keyboard alone. It uses no mouse, no click and no hover.

### The review page, and choosing how to see a change

A folio's preview carries `review/index.html`: every changed block, grouped by
section, with its reviewer comments (the `review-comments` skill). Each
changed block has a **"Show this change as"** selector, and one
at the top applies to every block:

| renderer | shows | the default for | needs |
|---|---|---|---|
| **Word diff of the source** | the Markdown with removed words struck and added words marked: exactly what the author typed | any kind not listed below | the block's prose |
| **Inline, as rendered** | the block as a reader sees it now, with the change marked in place | `prose`, `remark`, `definition`, `example` | the block's prose |
| **Pictures, before and after** | a picture of the block on each side, the changed pixels marked, and the share changed in words (`visual-diff` (opt-in `cat-harness.sdlc`)) | `table`, `figure`, `diagram`, `equation`, `simulator` | `visual-diff.json` from the `folio-block-screenshots` Tool |
| **Side by side** | `main` and the preview next to each other, each scrolled to the block | the same kinds, as the second choice when a build published no pictures | a page on either side |

- **Where the data comes from.** The ChangeSet step's `--text-out` writes
  `changeset-text.json`: the source and rendered prose of each listed block,
  on each side that has it. The pictures step writes `visual-diff.json`
  and `visual/`. With neither file, only side by side is available, and
  the page says so.
- **Two renderers may default for one kind.** Order is preference: the
  page opens a block on the first renderer that lists its kind AND can run.
- **A renderer that cannot run on a block is listed, disabled, with the
  reason.** For example, a manifest-only change has no prose to diff. If the
  page-level choice cannot run on a block, that block falls back to one
  that can.
- **The page-level choice is remembered** for this viewer in
  `localStorage`. A private window just gets the defaults.
- **The renderers and the registry** are `cat-harness-tools/scripts/review-renderers.ts`,
  `cat-harness-tools/scripts/word-diff.ts` (no diff library; about forty lines,
  tested) and `cat-harness/schemas/ui/diff-renderers.ts`. To add one, declare it
  in the registry with what it needs and which kinds it defaults for, add its
  function to `review-renderers.ts`, and add a case to the page's
  `renderInto`.

## Staging retention

**A MERGED pull request's preview goes away. Everything else is retained by
default**, subject to the size cap below.

The distinction is about **where the content lives**, not about how confident
anyone is:

| the PR was | the preview is | so |
|---|---|---|
| **merged** | the same thing the MAIN SITE now shows | redundant on the instant, and removed automatically — no label |
| **closed, unmerged** | the ONLY rendering of that work | the last copy, and retained unless a person says otherwise |

The store therefore drains: what remains is bounded by **concurrent reviews**,
not by cumulative history, so a size warning stays a signal rather than
becoming a permanent verdict.

**This applies
[`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md);
it does not relax it.** The merge *is* the confirmation: a person decided this
content belongs on `main`. What the label guards is the case where nobody
decided anything. Removal is one preview directory at a time.

**Which mechanism depends on whether the PR is still open.** Three cases, and
the label cannot reach a closed PR:

0. **Merged** — nothing to do. `cleanup` reads
   `github.event.pull_request.merged` off the close event and removes without
   a label, recording the reason as `merged`.
1. **While the PR is open, and it will not be merged** — add the
   `staging:cleanup` label. `cleanup` in `feature-staging.yml` fires on
   `pull_request_target: closed` and reads the labels off that event, so the
   label has to be there *before* the PR closes.
2. **Once the PR is closed unmerged and unlabelled** — run
   `feature-staging.yml` from the Actions tab
   with `cleanup_slug: <slug>` and `cleanup_confirm: <slug>`. The confirmation
   repeats the slug so that it names the artefact it confirms, and the job
   re-checks that nothing is still using the preview before it removes
   anything.

**Labelling a closed PR does nothing, and re-running its old workflow run does
nothing either** — a re-run replays the stored event payload, which still
carries no label. So for an orphan the health sweep's
`staging-preview-orphans` finding names, option 2 is the remedy. If you find
yourself reaching for a hand-pushed `gh-pages` commit instead, stop: that is the unilateral removal
[`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md) exists to
stop, and option 2 exists so you do not have to.

### The cap — 3 GB of previews in total, the oldest rotated off

Previews are capped by total size, not count, because preview sizes vary
widely and a count bounds the total only while preview size holds still. GitHub Pages deploys `gh-pages` as-is, and past its 10 GB artifact
limit the **live** site stops deploying. Every removal path above is
per-preview and event-driven; none bounds the total.

What the `stage` job does, on every deploy, before its one push:

- **Sums the size of the previews under `branches/`, including the one it is
  staging, and keeps them within 3 GB.** The number lives once, as
  `MAX_PREVIEW_BYTES` in `cat-harness-tools/scripts/staging-rotate.ts`.
- **Keeps the newest that fit and removes the rest, oldest first — strictly by
  recency.** An older small preview never outlives a newer one that did not
  fit, so a preview's age alone says whether it is still there. One 780 MB
  preview displaces several small ones; that is what a size budget means. "Last updated" is the
  `branches/<slug>/.staged-at` stamp the job writes on every stage, falling back
  to the latest `rendered` render-log entry, then the record's `builtAt`, then
  git. The preview being staged is never removed.
- **Never touches `branches/_retired/`** or anything that is not a preview
  directory.
- **Leaves a record for each removal** — a `removed` render-log entry with the
  reason, the preview's `staging-preview.json` retired into `_retired/`, and a
  line in the commit message and the job log giving slug, age and size.

**This DOES reach open pull requests.** Under the cap, the oldest preview goes
whatever its PR's state; the owner's cap is the confirmation
[`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md)
asks for, given for the class. It is recoverable because a preview is a build,
not content: **the next push to that PR's branch re-stages it**, and the run
that re-stages it can never rotate it off. So when a reviewer's preview link
404s, check `_render-log/` on `gh-pages` for a `removed` entry for its slug
before calling it broken — if it says "rotated off", push to the branch (an
empty commit will do) or re-run the PR's `Feature Staging` workflow.

### A closed PR is not an abandoned preview

`staging-preview-orphans` does **not** ask "is there an open PR?", and neither
should you. A session that reuses one branch across successive pull requests
has no open PR for the whole gap between one merging and the next opening.
Liveness is
three signals, any one of which means leave it alone: an open PR, a branch on
the remote carrying work not in the default branch, or a tip commit in the last
30 minutes. `scripts/staging-cleanup-preflight.ts --slug <slug>` answers the
same question on demand, and the dispatch above runs it before removing.

## Before you hand a staging URL to a person (STRICT)

**A staging URL is not a deliverable until you have checked the ref, and it is
never "live" on your say-so.** The bot's comment says a workflow *pushed*, not
that a site *serves*.

Three states, and conflating any two of them is the defect:

| | observable from a container? | how |
|---|---|---|
| the `stage` job succeeded | **yes** | the check run on the PR's head |
| the files are in `gh-pages` | **yes** | read `branches/<slug>/` on `refs/heads/gh-pages` |
| the URL serves them | **NO** | see below |

**The third is not available to you, and `curl` will not make it available.**
The proxy blocks `github.io`, so a fetch returns `000` and says nothing either
way. And where Pages is configured as *Deploy from a branch* — as it is here —
its builds produce **no workflow runs at all** (`event: page_build` returns
`total_count: 0`, and there is no `pages-build-deployment` workflow to query).
So there is no API answer either.

So: **verify the ref, and report the third state as unverified rather than
inferring it.** Listing `branches/<slug>/` on `gh-pages` and finding
`index.html` proves the build ran and what it published; it does not prove
Pages has rebuilt. Those are different claims and only one of them is yours to
make.

**LIST the directory. Do not FETCH the page.** A staging page is ~100 KB of
rendered HTML, a context window spent to learn a fact the directory listing
gives for free. The listing returns a name and a byte count per entry;
`index.html` present and non-zero is the whole check. Request only the `name`
and `size` fields.

### Say how long, and come back

A person handed a URL with no timing either refreshes a 404 or walks away.
Give them the number and the follow-up, in the same breath as the link:

- **The `stage` job takes about 22 minutes, plus its wait at the rate limit**
  (derived artefacts, the knowledge-graph export, mounting, Jekyll and
  checks). Drafts are staged too, from the first push. The job then waits
  until `gh-pages` has gone 5 minutes without a staging push and 10 without a
  main-site one
  ([`feature-staging`](feature-staging.md) §7), and its PR comment says
  **queued** with an earliest push time and a live-by time while it waits.
  Quote those times; they are the job's own estimate.
- **Pages propagation is on top of that**, and GitHub documents it as up to
  ten minutes. Since it is unobservable from here, quote the bound rather than
  a guess: *"give it ~5 minutes; up to 10 if Pages is slow."*
- **Then actually check back.** Schedule it rather than promising it — the
  same mechanism that watches a PR. Re-list the ref, and if the person reports
  a 404 after the window, that is a real finding worth chasing; before it, it
  is the window.

Never present a URL as though it is already serving. *"Deployed to `gh-pages`,
should be live in ~5 minutes"* is the honest sentence and costs nothing.

### Check for newer cleanup commits on gh-pages

Before declaring a preview good, check the `gh-pages` commit log for any
`staging(cleanup)` commit touching that slug that is **newer than** the last
`staging(...)` publish:

```sh
git log -n 5 --oneline origin/gh-pages -- "branches/<slug>"
```

If a `staging(cleanup)` commit appears newer than the last `staging(...)`
publish, or if the directory was deleted within the hour, **flag it
immediately**. A preview whose slug was recently deleted and re-published is
vulnerable to cancelled Pages builds: if Pages cancelled the re-publish build,
the site continues serving the deletion (a 404) even though the publish ref has
the files.

A preview whose slug was deleted within the hour is not in the ordinary
propagation window.

### Re-publishing without a code push

When a preview needs to be rebuilt or re-published — because a previous Pages
build was cancelled, or because a slug was deleted by cleanup from a preceding
PR — you do **not** need an empty code commit or push. Dispatch the staging
workflow directly with the branch name:

```sh
gh workflow run feature-staging.yml -f branch=<branch>
```

This triggers `feature-staging.yml` via `workflow_dispatch` for that branch,
building and deploying a fresh preview to `branches/<slug>/` on `gh-pages` and
queueing a new Pages build.

## Do not

- **Do not hand over a staging URL without listing `branches/<slug>/` on
  `gh-pages` first.** The bot's comment says a workflow pushed, not that a
  site serves.
- **Do not declare a preview good without checking the `gh-pages` commit log for
  newer cleanup commits.** A `staging(cleanup)` commit newer than the publish
  means a cancelled Pages build leaves the live site serving a 404.
- **Do not say a preview is "live", "up" or "deployed and ready"** unless
  someone has loaded it. You cannot see that from here.
- **Do not provide before/after URLs without checking the staging workflow
  has run.** A URL that 404s is worse than no URL.
- **Do not remove a staging preview by hand without confirmation.** Apart
  from a merged PR's preview and the size cap's rotation, a person confirms
  every removal — the label while the PR is open, or the dispatch with its
  repeated-slug confirmation once it is closed.
- **Do not read "no open pull request" as "abandoned".** It is true of a live
  branch for the whole gap between one PR merging and the next opening.
- **Do not assume all pages are at the root.** Guides are under `guides/`,
  reference under `reference/`, French under `fr/` etc.
- **Do not omit the comparison table.** Even for a single page change, show
  the before/after pair — it is the whole point of staging.

## Before you report a staging URL as broken

**Look at the publish ref, not the site.** A staging URL is LOOKED UP in
`gh-pages` under `branches/<branch-slug>/`, never composed from the source
path — `docs/<stub>/proposals/x.md` publishes to `/proposals/x.html`, and
composing it from the source path yields a 404 for a page that is there. From
an agent container a `curl` against a Pages URL fails on the proxy regardless,
so a failed fetch is not evidence either way.

Full rule: `github-state-inspection` (opt-in `cat-harness.sdlc`).
