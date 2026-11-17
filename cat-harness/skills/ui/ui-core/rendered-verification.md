---
name: rendered-verification
description: Confirm a UI change by LOOKING at it in a browser and sending the screenshots to the author, rather than describing it. Use whenever a change touches CSS, a Liquid/HTML template, a generated page, the navbar, a board, a sticky or any rendered surface — before claiming it works, and before asking the author to review it. Covers building the site locally, taking the REAL CI build off `gh-pages` when the question is theme chrome or layout, driving it with Playwright in this environment, measuring computed style rather than reading the stylesheet, hit-testing a control's centre because visible is not usable, asserting the conditions so a check cannot pass over an unstyled page, and the defect classes that are invisible to a green gate set.
user_invocable: true
---

# /rendered-verification — look at it, then send the picture

[`continual-progress`](../../conduct/conduct-core/continual-progress.md) holds that **a human cannot
assess a rendered artefact from a description of it.** Neither can the agent
that wrote it. A stylesheet is not a rendering, a generator's output is not a
page, and a green gate set is not a screenshot.

## The rule

> **A change to a rendered surface is not done until you have looked at it
> in a browser and sent the author the picture.**

Not "ran the tests". Not "checked the CSS". Opened it, measured the
computed result, and attached the image to the turn. Sending the screenshot
is **part of the rule, not a courtesy**: an image lets the author disagree
with you in one glance.

## Check the page the owner opened, and that it is LIVE

Owner, 2026-11-14: *"why I am having to ask for the same requests multiple
times?"* An audit of five repeated requests found the same four failures:

- **Merged and pinned is not live.** The layer's publish run failed at a
  guard, nothing recorded it, and the site kept serving pages from an older
  pin, so three merged fixes never reached the owner. Before saying a fix is
  done, find the layer's latest publish run for the pinned commit and say
  whether it succeeded; if it failed, say so and hand it on.
- **The fix went to a different surface.** "Cap + hover" for long titles was
  applied to the library table and not to the rail the owner was looking at.
  Screenshot the URL the owner named, not a page you chose.
- **The fix covered a batch, not the owner's entry.** A figures fix scoped to
  one family of entries left the owner's entry with none. Check the entry
  the owner named, and say which entries the fix does not reach.
- **An older ruling outlived a newer one.** A November 10 card chose wrapping
  for short menu names; three days later the owner asked for one line with
  hover for long titles, and the code still cited the old ruling. When a new
  request contradicts a recorded ruling, ask on a card which one wins, then
  change the code comment and the test that cite the old ruling.

## Why a green gate set does not cover this

Defect classes no test catches, because **the source was right and the
rendering was not**:

| what happens | why the suite is green |
|---|---|
| a generator emits raw `<h3>`, kramdown assigns no ids, and every heading on a page shares one anchor | the generator's own output looks right |
| two files hold their own copy of a shared size (a rail at 40px, a sidebar at 56px) | each file has a test asserting **its own copy** |
| a component renders with **no colour** | an invalid custom-property substitution fails *silently* — no parse error, no console warning, just the initial value |
| a region lays out below the viewport, rendered and unreachable | the markup is correct; a `!important` in the theme makes the flex column inert |

## Measure the COMPUTED result, never the stylesheet

`getComputedStyle` and `getBoundingClientRect` are the instruments. Reading
the CSS tells you what was authored; only the browser tells you what won.

Measure every time:

- **`display`, `flex`, `min-height`** on a region you believe is a flex
  child. A `!important` from a theme utility class silently makes every
  flex value below it inert.
- **`scrollHeight` against `clientHeight`.** A region that "does not
  scroll" and a region whose content is ten times its height look
  identical in a screenshot of the top of it.
- **the resolved colour**, not the declaration. A custom property holding
  a *hue* substituted into `color-mix()` yields `rgba(0,0,0,0)` and no
  error.

**Use a control.** When you suspect a value is invalid, build the minimal
element in the page and read it back, rather than reasoning from the spec: the
probe is a measurement, and reasoning from the spec is a claim.

```js
const probe = document.createElement("div");
probe.style.cssText = "--h:268;background:color-mix(in oklab, var(--h) 28%, transparent)";
document.body.appendChild(probe);
getComputedStyle(probe).backgroundColor;   // rgba(0, 0, 0, 0) -> invalid
```

## A before/after pair beats an after

Build the base branch too and shoot the same element. Without it "the
dividers have colour now" is unfalsifiable. `git worktree add <dir>
origin/main --detach` is the cheap way; symlink `node_modules` and the docs
`vendor`/`.bundle` into it rather than re-installing.

When the pair goes to a **reviewer** rather than confirming the change to
yourself, `before-after-preview` (opt-in `cat-harness.sdlc`) governs it:
one build with one variable where possible, stable capture, a *k of n* count
with its method, the status line, and where the preview sits in the review
processes. It also covers papers, FHIR IGs and slide decks.

## Running it here

Building the site is `preview:site`, whose header carries the two things that
make a naive `bundle exec jekyll` fail in this repo. **It is not what CI
builds** — CI uses the pinned `remote_theme`, this uses the gem — so read a
*theme-chrome* question off the staging preview (next section), not off this.
Liquid and kramdown are identical, and so is our own stylesheet.

Two environment facts:

1. **Serve it under its `baseurl`.** `_config.yml` pins
   `baseurl: "/folio-assistant"`, so every stylesheet is requested at
   `/folio-assistant/assets/…`. Serving the build directory at `/` returns
   200 for the HTML and 404 for **every** stylesheet — and an unstyled page
   renders, so the failure looks like a CSS bug rather than a 404. Symlink
   `<serve>/folio-assistant -> <build>` and serve the parent.
2. **Pin the browser.** Chromium is pre-installed but its build number
   will not match whatever `playwright-core` resolves to, and
   `playwright install` is not available. Launch with
   `executablePath: "/opt/pw-browsers/chromium"`.

**Drive the control a reader would drive.** `page.click(".side-bar .site-title")`
(the avatar, which opens and closes the sidebar from 50rem up),
not `element.classList.add(…)`. A state you set by hand is a state you have
not tested the way in to.

**And check that the state actually changed.** Setting `data-fa-scheme`
directly does not switch the scheme — the real toggle is
`jtd.setTheme(name)`. *A test that silently does nothing reports the old
state as the new one.* Assert the switch landed (for example, the sidebar
background changed) before reading anything off it.

Know what that toggle does: `setTheme` swaps the theme's first stylesheet,
so while the new file is in flight the page has no ground but the browser's
white canvas, and it flashes white. A scheme check that only reads the
SETTLED page cannot see it — hold the new sheet in flight with `page.route`
and read the ground then, as `first-paint-scheme.e2e.ts` does. The rule
itself lives in `theme-artefacts` (opt-in `cat-harness.platform-ui`)
§"The page ground: the first paint is DARK".

## The REAL build is reachable — take it off `gh-pages`

This environment's proxy refuses `litlfred.github.io`, but
`feature-staging.yml` deploys each preview into `branches/<slug>/` on the
`gh-pages` branch, and git reaches what HTTP cannot:

```sh
git fetch origin gh-pages
S=claude-my-branch-slug              # the deploy comment names it
mkdir -p "/tmp/rv/folio-assistant/branches/$S"
git archive "FETCH_HEAD:branches/$S" | tar -x -C "/tmp/rv/folio-assistant/branches/$S"
cd /tmp/rv && nohup python3 -m http.server 8091 >/dev/null 2>&1 &
# → http://127.0.0.1:8091/folio-assistant/branches/$S/<page>.html
```

That is the pinned `remote_theme`, the composed tree, the mounted layers
and the post-Jekyll steps — the thing CI publishes. A whole preview is
~90 MB; `git archive FETCH_HEAD:branches/$S page.html assets` takes just what a
page needs.

**Mount it at the branches/ path, not at the site root.** A staged page
requests `/folio-assistant/branches/<slug>/assets/…`, so serving the extract at
`/folio-assistant/` 404s **every** stylesheet.

## Assert the CONDITIONS, or the check passes over nothing

An unstyled page still renders. It still answers `elementFromPoint`. It still
returns PASS. A run mounted at the wrong path reports a pass over a page with
zero stylesheets; what gives it away is the numbers beside the verdict, not
the verdict.

So every rendered check reports, beside its verdict:

- `document.styleSheets.length` — zero or one means the page is bare;
- a count of responses with `status >= 400`, collected from `page.on("response")`;
- **the precondition the defect needs** — the class, the state, the element
  count. If the bug only appears when `fa-has-fullwidth` is set, a run where
  it is unset has not tested anything.

A check that cannot tell a styled page from a bare one is not a check:
could-not-determine rendered as a pass.

### A COUNT over the built site needs its instrument validated first

Before trusting any "N of M pages have X", run the instrument on **a known
positive AND a known negative**, and on one positive of **each** way X can
appear. Naive instruments give confident wrong numbers: an exact class match
misses the theme's own variant, a substring match counts the class name quoted
in **prose**, a link count takes a stylesheet `href` as a way out. For
navigated pages, the instrument that holds is `<nav class="fa-nav"` OR
`id="site-nav"`.

For a count of NODES with a page, an IRI and a folder-page row, do not write
an instrument: `bun run cat node-views:report -- --site <dir>` is that count,
validated by its tests, and it says `unknown` rather than 0 where it could not
ask. It reads a folder's data files, so rows a script draws are counted.

For a site-wide count, the `gh-pages` route above scales. Use a
`--filter=blob:none --sparse` clone of `gh-pages`, with sparse patterns for
the files counted, and exclude `branches/`. All HTML is about 1.7 GB and takes
minutes; one directory takes seconds.

## Visible is not usable — hit-test the control's CENTRE

A control can have the right size, the right colour and the right label, and
still be un-clickable because something is painted over it — for example a
wrapper that computes to height 0 because its only child is
`position: absolute`, letting a flow sibling paint across the field.

```js
const b = el.getBoundingClientRect();
const hit = document.elementFromPoint(
  Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2));
const usable = hit && (hit === el || el.contains(hit) || hit.contains(el));
```

**Two ways this test lies:**

- **It resolves INSIDE the control.** `elementFromPoint` returns the deepest
  element, often an `<svg>` or `<span>` within a button. `hit === el` alone
  reports a working control as covered — which is what the `contains` pair
  above is for.
- **It reports a preview-only overlay.** The staging banner (a `<div>` with
  no class, `z-index: 9999`, a child of `<body>`) exists only on previews.
  Identify the coverer (`document.elementsFromPoint(x, y).slice(0, 3)`)
  before calling it a defect: *what* is on top decides whether it ships.

Where the covered control is the ONLY route back to a state — the magnifier
that reopens a collapsed search — being un-clickable means an action whose
inverse is not reachable.

## Two environment facts that cost cycles rather than correctness

- **Never `pkill -f "http.server"` from the shell running one.** The pattern
  matches your own process group and kills the command issuing it — exit 144,
  no output, looks like the tool failed. Start each server on a fresh port in
  its own invocation instead.
- **Probe scripts must not be left in the repository root.**
  `check:undeclared-files` fails the gate set on a stray `probe.mjs`.
  Playwright needs the script where `playwright` resolves, so write it to the
  repo root, run it, and delete it in the same command.

## What to send

The frames that answer a question the author would otherwise have to ask:

- **before and after** of the same element, same viewport;
- the surface in **both colour schemes**, if the change touches colour;
- the state that is hard to describe — a region **scrolled to its end**,
  a menu open, an empty case.

Caption them with what to look at, not with what they are. "The nav
crushed to a 64px sliver, no home link" is a caption; "navbar screenshot"
is a filename.

`SendUserFile` is the mechanism; write into the working directory or the
scratchpad, since a file the author cannot open is not a deliverable.

## Accessibility is measured here too

Unique heading anchors and the 3:1 bar for meaningful non-text content are
*rendered* facts: compute the contrast from the two resolved colours rather
than from the tokens, because the token you authored and the colour that won
are different questions.

## Listen for `pageerror`, or a crash reads as a missing feature

A throw early in a page's `init()` takes the rest of `init()` with it. The
symptom is a feature that is simply not there — which looks exactly like a
feature that did not mount — and a swallowed init is silent in a screenshot.

So: attach the listener, and assert zero.

```js
page.on("pageerror", (e) => errors.push(e.stack || e.message));
```

**And check the base branch before you claim a crash is yours** — or before you
claim it is not. One run against a build of `origin/main` tells "something I
just broke" from "a live defect nobody had reported".

## A STATIC read of a client-rendered page is not verification — in either direction

This skill stops a false **red** as well as a false **green**.

> **Grepping a page's committed HTML for content the page fetches at runtime
> proves nothing.** The content is absent whether the page works or not.

A library viewer, for example, carries
`DATA_HREF = "../../../assets/library/index.json"`, fetches it, and filters by
layer. Its committed `index.html` never holds the entry names, so grepping
it for them returns the same answer for a working page and a broken one.
Loading it in Chromium settles it in one command.

A false red files a bug against working code and sends the next agent to
rewrite a correct generator, and because the report carries measurements it
reads as thoroughly evidenced.

**If a page assembles any of its content after load, open it.** The tell is
cheap to check: a `fetch`, an `XMLHttpRequest`, a `DATA_HREF`, a `<script>`
that writes into the DOM. Finding one means a static read cannot answer the
question, and `§"Running it here"` above is how to answer it instead.

## Print it too, when the page defers anything

A page that lazy-loads (images, a tree built on toggle, a listing drawn on
first open, text kept for a popout) must print complete (owner, 2026-11-14).
Check it the way a reader prints: emulate print media, run the page's print
preparation (its Print button with `window.print` stubbed, or a dispatched
`beforeprint`), assert every image is loaded (`complete && naturalWidth`) and
the deferred text is present, then `page.pdf()` and look at a page of it.

## What this does NOT replace

The gate set. This is the layer **above** it: gates catch what is checkable
from the source, and this catches what is only true once a browser has laid
it out. A change that skips either is unverified.
