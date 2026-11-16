---
name: before-after-preview
description: >-
  Make a reviewer-facing BEFORE/AFTER preview of a change to anything that is
  rendered — a docs site, a paper's PDF, a FHIR IG, a slide deck, a website —
  and put it where the review and feedback processes expect it. Covers one
  build with one variable, stable capture, pairing every picture with a
  measured count and its method, the viewports and colour schemes to shoot,
  an honest status line, publishing with alt text, a section per content type
  naming this repository's own build and render tools, and how reviewer
  feedback on the preview becomes work items. Use before asking anyone to review a
  rendered change, at the HCI validation gate, and whenever a reviewer asks
  "what did it look like before".
user_invocable: true
---

# /before-after-preview — show the reviewer the change, not a description of it

> Skill id: `before-after-preview` · Package: `sdlc-core` · Worked example: the
> Folio tab

[`continual-progress`](../../../skills/conduct/conduct-core/continual-progress.md) holds that **a human cannot
assess a rendered artefact from a description of it.**
[`rendered-verification`](../../../skills/ui/ui-core/rendered-verification.md) adds that the agent that
wrote the change cannot either. This skill is about **what goes to the
reviewer**: a before/after preview that is a fair comparison, carries a number,
and can be read without opening anything else. It covers every content type
this platform renders.

## How this sits beside its neighbours

This skill does not replace any of these. It tells you which one to use.

| skill | what it answers | use it for |
|---|---|---|
| [`rendered-verification`](../../../skills/ui/ui-core/rendered-verification.md) | *does it work?* — the agent checks in a browser | the tools: computed style, hit tests, `pageerror`, and asserting that the page actually loaded its styles |
| [`visual-diff`](visual-diff.md) | *how much of this figure changed?* | automatic pixel pictures of changed blocks on a folio's review page |
| [`staging-review`](../../../skills/ui/ui-core/staging-review.md) | *where do I look?* | the before (main) and after (staging) URL pairs, and what to review at each |
| **this skill** | *is the reviewer's comparison fair, measured and findable?* | the preview itself, for any content type, and where it fits in the processes |

If the change is a folio block and the staging job already made its pictures,
link to those. Use this skill for everything the job cannot make: page chrome,
behaviour on scroll, a PDF page, an IG page, a slide.

**A staging "after" is not permanent.** `gh-pages` keeps at most ten
`branches/<slug>/` previews and rotates the least recently updated off, so a link in a preview can 404 days later
while the PR is still open. The next push to the branch re-stages it. Where the
comparison must outlive that, publish the captures themselves (§6) rather than
only the staging URL. Detail: [`staging-review`](../../../skills/ui/ui-core/staging-review.md) §"The cap".

**Which pages to picture.** For a Change Set, the pages come from its
rendered list (skill [`rendered-impact`](rendered-impact.md)), so the "k of n
pages changed" count is the list's count, not one made by hand. Its
`unconfirmed` content pages (bytes unchanged, content loaded in the browser)
are exactly the ones a screenshot settles.

## The rule

> **A reviewer is shown a rendered change as a before/after pair. Each pair
> comes from ONE build with ONE variable, is captured stably, is paired with a
> measured count and its method, and has a status line saying what it is and
> what was not checked. Each pair is introduced by a narrative: a sentence or
> two, in plain words, on what a reader will now see or do differently and
> why.**

The narrative comes first, above the pictures. A pair without it makes the
reviewer play spot-the-difference, and the difference they find first is not
always the one that changed: a re-render shifts anti-aliasing, a merge brings
in somebody else's edit. Name the change so the reviewer looks for it, then
let the pair confirm it.

If any part is missing, say so in the preview. Never drop a missing part
silently.

**Build only the cone.** For any rendered kind, the "after" build need only
cover what the change can reach: its own files, its generator's import closure,
and what is derived from those. That is the general rule, written once in
[`feature-staging`](../../../skills/ui/ui-core/feature-staging.md) §7. Anything the cone leaves out is
identical to the "before" by construction, so leaving it out loses no
comparison.

## 1. One build, one variable

The only difference between the two pictures should be the change under
review.

In order of preference:

1. **The same build, with the change toggled.** Render once and make "before"
   by switching the change off in place. The usual way is injected CSS that
   hides the new element, reverts a rule, or removes a class. Everything else
   stays identical, including the build, the theme, the fonts, the data and
   the viewport.
2. **Two builds made with identical tooling**, one of the base commit and one
   of the head commit. Use this when the change cannot be toggled, for example
   generated markup, a different PDF, or a new IG page. Use
   `git worktree add <dir> origin/main --detach` and symlink the installed
   dependencies (see `rendered-verification` §"A before/after pair beats an
   after"). **Say in the preview that there are two builds**, with both SHAs.
3. **A local build against a published one.** Only if nothing else is
   possible, and the preview must say so in its first line. The published side
   used different tooling. On the docs site, for example, the pinned
   `remote_theme` differs from the local theme gem. Any difference in the
   pictures may come from that and not from the change.

Record which of the three you used. It is the first line of the status line
in section 5.

## 2. Stable capture — load everything, then check the two shots line up

A pair captured while the page is still settling compares two moments, not
two versions.

Do all of these before either shot:

- **Force lazy media to eager**:
  `document.querySelectorAll('img[loading=lazy],iframe[loading=lazy]').forEach(e => e.loading = 'eager')`.
- **Scroll the whole page once**, top to bottom and back, so anything that
  loads on intersection has loaded.
- **Wait for network idle** (`page.waitForLoadState('networkidle')`) and for
  `document.fonts.ready`.
- **Turn smooth scrolling off**:
  `document.documentElement.style.scrollBehavior = 'auto'`. Otherwise a
  `scrollTo` returns before the page has moved.
- **Assert the shots line up**: `scrollY` must be equal in both, and so must
  the `getBoundingClientRect().top` of a **reference element** outside the
  change, such as a heading. If either differs, the shots are invalid. Retake
  them. Do not caption around the mismatch.

Lazy images that load between the before and after shots move the text, so
the two pictures show *different content* at the same scroll offset and still
look plausible. The reference-element check catches this; looking at the
pictures does not.

## 3. Measure, don't just show

A picture shows one position. A count shows all of them. Send both, and
**name the method** so the reviewer can repeat it or dispute it.

- Choose a **question that has a yes/no answer at one position**. For
  example: "is body text visible beside the handle?", "does the caption
  overflow the slide?", "is this IG table wider than the viewport?".
- Ask it at **many positions**: scroll steps, pages, slides, or viewports.
  Report the result as *k of n*, before and after.
- Measure from the rendered geometry. For text overlap, collect `Range`
  client rects of the text nodes, intersect them with the element's
  `getBoundingClientRect()`, and **confirm each hit** with
  `document.elementFromPoint` at the overlap. A rect intersection alone
  counts text that is painted underneath.
- State the step size and the viewport with the numbers.

Folio tab, `platform.html`, 19 scroll positions at 1280×900:
*text visible beside the handle at **16 of 19** positions before, **0 of 19**
after*. At 390×844: **18 of 20** before, **0 of 20** after. A second table used 97 px steps across four page and viewport pairs:
platform 1280 9/21 → 0, platform 390 32/39 → 0, index 1280 25/50 → 0,
cat-harness/index 390 36/60 → 0.

Treat a count the same way as any other measurement. Validate the method on a
known positive and a known negative before trusting it
(`rendered-verification` §"A COUNT over the built site needs its instrument
validated first").

## 4. Several viewports, and both schemes when colour is involved

At least:

| viewport | size | why |
|---|---|---|
| desktop | 1280×900 | the layout most authors write in |
| phone | 390×844 | fixed and sticky elements, narrow columns, overflow |

Add **light and dark** whenever the change touches colour, contrast, a
border or an image with transparency. Switch the scheme with the real
control (on the docs site that is `jtd.setTheme`, not an attribute set by
hand) and check that the switch took effect before shooting.

Show a pair for each combination that matters. Give the count for every
combination you measured.

## 5. Honest status — one line, at the top

```
Status: <committed | pushed | in PR #N | merged> at <sha> ·
Build: <one build, toggled | base <sha> vs head <sha>, same tooling | local vs published> ·
Not checked: <what, and why>
```

"Not checked" is required and is never empty without a reason. Typical
entries:

- local theme gem vs the pinned remote theme;
- dark mode;
- a browser other than Chromium;
- print CSS;
- the IG Publisher's full build (only sushi ran);
- the PPTX was not rendered, only its geometry was reconstructed.

A preview that looks complete but hides an unchecked axis is a false green.

## 6. Publishing — a private page, updated in place

- **Where:** a private web page. Use the Artifact tool when it is available.
  It holds the pairs, the counts, the method, the status line and links to the
  PR and the issue. **Update the same page as the work moves on**, so the link
  in the PR body stays current. Do not post a new page for each round. Where
  no page can be published, attach the images to the turn and to the PR
  comment instead.
- **Alt text on every image**, saying what the reader should see. For
  example: *"Before, phone, scrolled 1200 px: the Folio tab covers the first
  three words of each line"*. Do not write "before screenshot". A preview
  without alt text cannot be used by a reviewer with a screen reader.
- **Label each pair in words**, not only with position or colour:
  "Before" and "After", then viewport and scheme.
- **Committed evidence:** do not commit screenshots to the repository. The
  page and the PR are the record. `visual-diff`'s pictures are built by CI and
  are not committed either.

The Folio tab preview was published this way as a private artifact page, with
the before/after pairs, the counts above, the method and the PR link.

## 7. By content type

The discipline above is the same for every type. What changes is how you
build it, what one "position" is, and what you toggle.

### Docs site (Jekyll, just-the-docs)

- **Build:** `bun run cat preview:site`. Its header explains how its output
  differs from CI's: the local theme gem, not the pinned `remote_theme`.
- **Serve under the baseurl.** Symlink `<serve>/folio-assistant -> <build>`
  and serve the parent directory. Served at `/`, every stylesheet returns 404
  and the page still renders, unstyled.
- **For theme chrome**, take the real CI build from `gh-pages`
  (`rendered-verification` §"The REAL build is reachable").
- **Toggle:** inject CSS into the one build.
- **Position:** a scroll step (for example 97 px) or a page.

**The worked example is the Folio tab.** The fixed "Folio"
handle covered body text as the page scrolled. The capture used one
`preview:site` build of commit `438268976`. "Before" was made by injecting
`.fa-glass-band{visibility:hidden!important}`, so the new strip was the only
difference. The capture forced lazy images to eager, scrolled the page once,
turned smooth scrolling off, and checked that `scrollY` was equal in both
shots. The counts are in section 3.

### Papers (LaTeX → PDF)

- **Build:** the paper render path. See `build-pdf` (the science layer) and the
  `paper_render_pdf` tool, or `document_render_pdf` for a document folio with
  no TeX. Build base and head with the **same TeX Live and the same class
  files**. A PDF cannot be toggled in place, so this is always case 2 of
  section 1.
- **Page images:** rasterise with `pdftoppm -r 110 -png` or `mutool draw`
  when present (check with `command -v`). Otherwise render the pages with
  pdf.js in Chromium. `paper_preview` opens a rendered PDF or HTML for a
  person to look at. It is for a human looking, not for capture.
- **Position:** a page. Align pages by **anchor, not by page number**. An
  added paragraph shifts every later page. Pair the page that holds the
  changed label in each build.
- **Measure:** changed pages *k of n*, overfull boxes and warnings from the
  log before and after, and page count.
- A changed block's own picture comes from `visual-diff` on the HTML render.
  Link it rather than taking it again.

### FHIR IGs (sushi, IG Publisher)

- **Order:** **sushi must pass first.** A red sushi run has no IG to preview.
  Then run the IG Publisher, and compare the rendered `output/` pages
  (`ig-publication` (the FHIR IG layer),
  `fhir-validation` (the FHIR IG layer)).
- **Build:** two builds with identical tooling. The Publisher jar floats to
  the latest release on every run, so **record its version for
  both sides**. If the versions differ, some differences in the pictures may
  come from the tool and not from the change. `ig-incremental-build.bpmn`'s
  restored-state assembly is fine for an authoring preview but is not the
  full build. Say which one you used.
- **Position:** an `output/` page such as `StructureDefinition-*.html`, a
  pagecontent page or `artifacts.html`. Pick the pages from the changed
  resources, not by browsing.
- **Measure:** pages changed *k of n*. Also compare `qa.json` errors and
  warnings before and after. A preview that looks right with more QA errors
  is not an improvement.

### Slide decks (PPTX, ODP)

On a slide, layout carries meaning. What overlaps, what is cut off and what
sits next to what is part of the message.

- **Render if you can.** `soffice --headless --convert-to pdf`, then use the
  paper route for page images. Check with `command -v soffice`. The session
  that worked out this route had no LibreOffice in its container.
- **If you cannot render, reconstruct the geometry from the package XML.** A
  `.pptx` is a zip file.
  - `ppt/presentation.xml` `<p:sldSz cx cy>` gives the slide size.
  - Each `ppt/slides/slideN.xml` shape has `<a:off x y>` and `<a:ext cx cy>`,
    in EMU (914400 per inch).
  - A shape with no `<a:xfrm>` **inherits** its geometry from its placeholder
    in `slideLayoutN.xml`, then from `slideMasterN.xml`. Follow the chain or
    the shape is missing.
  - For `.odp`, read `content.xml` `svg:x/svg:y/svg:width/svg:height`, which
    use units such as `cm`.
  - Draw the boxes as SVG with their text, before and after. Measure overlaps
    and boxes past the slide edge as *k of n* slides.
- **Status must say "geometry reconstructed, not rendered"**. Fonts,
  autofit and text wrapping are not modelled, so text overflow inside a box is
  unchecked.

### Websites in general

- The docs-site method, without the Jekyll parts. Build base and head with
  the site's own build, or toggle with injected CSS or JS in one build. Serve
  under the same path prefix the site is deployed at.
- Everything in `rendered-verification` applies: styles actually loaded,
  `pageerror` count zero, and hit tests at the centre of controls.
- **Position:** scroll steps, routes, or interaction states such as a menu
  open or a form in error. List the states you covered.

## 8. In the review and feedback processes

**When it is required.** A preview is required before a rendered change is
handed to anyone to judge:

- when the PR is opened for review;
- at each round of author feedback;
- at the HCI validation gate's review.

A non-rendered change needs none. Say so in one line, rather than attaching
an empty preview.

**Who makes it.** The agent that made the change, in its own lane. The
reviewer's lane **reads** the preview and does not build it. A reviewer who
must build their own before/after has been handed a chore, not a review.

Only the producing activities carry the skill ref, because a skill ref says
the lane PERFORMS the skill and the lane's role must carry it
(`role-carries-activity-skill`). The reading activities name the preview in
their documentation and carry no ref.

| process (`cat-harness/processes/`) | activity | role |
|---|---|---|
| `content-change-review.bpmn` | `Task_CommitPush` | agent **produces** it with the first push (skill ref) |
| `content-change-review.bpmn` | `Task_Iterate` | agent **refreshes** it with each revision push, which bypasses `Task_CommitPush` (skill ref) |
| `content-change-review.bpmn` | `Task_ReviewStaging` | author **reads** it beside the staging URLs |
| `content-change-review.bpmn` | `Task_CompareBeforeAfter` | review committee **reads** it beside `visual-diff` |
| `code-change-review.bpmn` | `Task_CommitAndOpenPR` | agent **produces** it for a change to a rendered surface (skill ref) |
| `code-change-review.bpmn` | `Task_Review` | reviewer **reads** it |
| `editing-hci-validation.bpmn` | `Task_DraftEdit`, `Task_ReviseEdit` | agent **produces** it with the proposal, before `Gateway_ValidationFork`, so it exists when review starts (skill ref) |
| `editing-hci-validation.bpmn` | `Task_SmeReview` | human or SME **reads** it as an input to judgement |

**Where it is linked.**

- **PR body:** the preview link and the status line, near the top. Also any
  count that settles the question.
- **Issue comment:** each round's summary on the issue carries the same link
  ([`issue-working`](issue-working.md)).
- Update the page in place, so both links stay current.

**Asking the reviewer.** The question follows
[`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md):
context first, then options, then the recommendation, then the question. The
choices are **structured and easy to select**, because some reviewers find
typing hard. Put the preview link and the counts in the context, so the
reviewer can answer without opening anything else. Recommended first:

1. **Looks right. Approve this preview.** (recommended when the counts went to
   zero and nothing is unchecked)
2. **Something is wrong at a position.** Pick the pair by its label, for
   example "After, phone, 1200 px". Adding a note is optional.
3. **Check something not covered.** Pick from the "Not checked" list.
4. **Not now.**

Say what happens if they give no answer: the PR stays open and nothing
merges. Merging still needs the explicit confirmation the processes require.

**How feedback becomes work.**

- A choice of 2 or 3, or a comment on the preview, becomes a **work item** with
  the pair's label, the status line's SHA and the position
  (`todo-manager` (opt-in `cat-harness.work-plan`); check before you create).
- On a folio, a comment tagged `block: <label>` on the PR becomes a
  `review-comment/1.0.0` todo (`review-comments`).
- Feedback on published content goes through
  [`content-feedback`](../../../skills/authoring/content-lifecycle/content-feedback.md).
- The next round's preview answers each item. Take the same pair again and
  update the count.

## What this does NOT do

- It does not decide whether the change is right. It makes that decision
  possible to take at a glance.
- It does not replace the gates, `rendered-verification`'s checks, or
  `visual-diff`'s pixel job. It uses them.
- It is not a merge approval. A reviewer choosing option 1 has approved the
  preview, and the merge still needs its own confirmation.
