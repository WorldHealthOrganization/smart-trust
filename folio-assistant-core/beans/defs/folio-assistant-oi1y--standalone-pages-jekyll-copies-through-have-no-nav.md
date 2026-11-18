---
# folio-assistant-oi1y
$schema: bean/1.0.0
title: 'STANDALONE PAGES JEKYLL COPIES THROUGH HAVE NO NAVIGATION: 33 published pages (23 wireframes + 10 bootstrap) carry no rail and no way out'
status: completed
type: feature
priority: normal
created_at: 2026-09-24T05:12:16Z
updated_at: 2026-09-29T20:52:40Z
parent: folio-assistant-yj32
---

Owner, 2026-09-24, after `edx7` shipped: *"do edx7 navbar on mounted pages too"* —
then, when told mounted pages were already done and asked which family:
**"Both"** (`wireframes/` first, then `api/`).

## Measured on the published site, 2026-09-24

```
1301 of 3151 pages have navigation   (excluding STAGING/)
```

| family | no navigation |
|---|---|
| `api/` | **1816** (TypeDoc; its own toolbar, sidebar and search) |
| `wireframes/` | **23** |
| `bootstrap/` | **10** |
| `cat-harness/` | 1 (the `detangle` orphan — the owner's call, not this bean's) |

## THE INSTRUMENT TOOK FIVE TRIES, and that is the finding worth keeping

Each wrong one produced a confident, wrong number:

| instrument | what it got wrong |
|---|---|
| `class="fa-nav"` exact | called **681 railed smart-trust pages unrailed** — they carry the theme's `<nav id="site-nav">`, not the injected rail |
| `fa-nav` substring | called 21 wireframes railed — the string was inside `<code>` in PROSE, because the navbar wireframe *discusses* `.fa-nav-toggle` |
| `<nav class="fa-nav"` element | missed every theme-rendered page; validated against one positive and no negatives |
| counting `href="../"` | counted the STYLESHEET link as an escape route, so 23 stranded pages looked linked |
| the final one | `<nav class="fa-nav"` OR `id="site-nav"`, validated on THREE positives (injected viewer, mounted page, state dashboard) and one negative |

**Validate an instrument on a known positive AND a known negative before
trusting any count it produces.** Four of the five were checked against
neither.

## There are TWO navigations, and conflating them is what caused all of it

- `<nav class="fa-nav" aria-label="folio-assistant">` — injected by
  `injectRail`, on mounted pages (`mount-instance-docs.ts`) and on generated
  viewer pages (`viewer-page.ts`, `edx7`).
- `<nav aria-label="Main" id="site-nav" class="site-nav">` — the Jekyll
  theme's own sidebar, which `docs-ui.css` styles *using* `fa-nav-*` class
  names. That shared vocabulary is exactly why a substring match looked right.

`sjic` is the bean that makes these one component.

## Why these 33 are stranded and their siblings are not

A wireframe directory holds `as-is.html` beside `intent.md`. The `.md` is laid
out by Jekyll and inherits the theme sidebar; the `.html` is copied through
verbatim and inherits nothing. Same subject, same directory, opposite outcome
— and the `.html` has **no navigation and no outward link at all**, not even
back to the wireframe it belongs to. There is no index page above them either.

## The design objection, raised and answered from precedent

Six of the 23 DRAW a sidebar as part of the mockup, so a real rail sits beside
a drawn one. That is the shape of the IRIS-replica case, where chrome on a
replica is the opposite of what a replica is for.

It does not apply here, and the repository already settled it: `navbar/intent.md`
**also** depicts and discusses the navbar, **and wears the theme sidebar**, and
nobody has treated that as wrong. The drawing is content *within* a docs page.
A replica impersonates another site; a wireframe is this site's own
documentation of itself.

## Shape

Hand-editing 23 committed files leaves the 24th wireframe to forget — the
`edx7` argument exactly. These are not generated, so `edx7`'s `emit` fixture
cannot reach them. The mechanism this repository already has for *"a page
Jekyll never laid out"* is post-build injection, which is what
`mount-instance-docs.ts` does for mounts.

## Done when

- [x] every standalone page the site publishes carries navigation, by one pass rather than by 33 edits
      — `rail-standalone-pages.ts`, PR #1232; 3429/3429 on `gh-pages`, 2026-09-29
- [x] `api/` decided separately — it has its own navigation, so it is a layout question and not a gap (the owner's second stream)
      — decided by rendering: railed, toolbar reflows beside the 56px strip, PR #1236 (`a48aaa8bf`)
- [x] verified on the BUILT site, with an instrument validated on positives and negatives
      — 2026-09-29, see §"Verified on the published site" below
- [x] the five-instrument lesson written where the next agent measuring coverage will find it
      — `rendered-verification` §"A COUNT over the built site needs its instrument validated first", owner's choice 2026-09-30


_2026-09-29_ — **Re-parented `p5wm` → `yj32`** by subject, per todo-manager §"WHICH parent" (owner choice '1 2 3' on the LSI epic-filing proposal, bean ansc). Pages with no navigation are a defect of the harness's default rendering (LHS + docs/); 4ccr (wireframe findings) was the runner-up, but only 23 of the 33 pages are wireframes.

Claimed by claude/goal2-navbar-resume — 2026-09-29, session https://claude.ai/code/session_014nDNCRPYSuF4DiJUP7wMDq (GOAL 2 resume after the 09-25 usage-limit stall).

## Verified on the published site, 2026-09-29

`gh-pages` at `e956325` (built from `main` `f2d58d67b`), read through git
because the proxy refuses `litlfred.github.io`: a `--filter=blob:none --sparse`
clone, sparse set to every `*.html` outside `STAGING/`.

Instrument: the final one from the table above — `<nav class="fa-nav"` OR
`id="site-nav"`. Negative control: a bare `<html><body>x</body></html>` →
0 matches. Positives: `index.html` (theme sidebar) and `api/index.html`
(injected rail).

```
3429 / 3429 published pages carry navigation   (excluding STAGING/)
  wireframes/  45 of 45    bootstrap/  11 of 11    api/  1989 of 1989
  detangle.html  navigated
```

Was 1301 of 3151 on 2026-09-24. The site grew by 278 pages in five days and
none of them is stranded — which is the "24th wireframe" argument the one-pass
shape was chosen for, now observed rather than argued.

**Cost, for the next agent:** the sparse checkout of all HTML is 1.7 GB and
takes a few minutes; `api/` is most of it. A family-only check is seconds.

## Summary of Changes — closed 2026-09-30

- One post-build pass (`rail-standalone-pages.ts`, PR #1232) rails every
  standalone page. `api/` was decided by rendering (PR #1236).
- Verified on the published site: 3429/3429 (see above).
- The lesson about validating a measurement is in
  `skills/sdlc/sdlc-core/rendered-verification.md`, where the owner chose to put
  it: known positive AND known negative, one positive per way the thing can
  appear, and the sparse `gh-pages` clone for site-wide counts.
