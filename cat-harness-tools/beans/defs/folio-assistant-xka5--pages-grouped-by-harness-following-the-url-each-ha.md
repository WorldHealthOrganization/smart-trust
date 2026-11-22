---
# folio-assistant-xka5
$schema: bean/1.0.0
title: Pages grouped by harness, following the URL; each harness owns its sub-doc graphs
status: completed
type: task
created_at: 2026-10-05T14:39:33Z
updated_at: 2026-10-29T07:32:15Z
parent: folio-assistant-9rq1
---

Owner, 2026-10-05, asked how to group the 79 top-level pages: 'dont want additional categorization that will drift, needs maintain. do it by harnesses to follow urls <base>cat-harness/docs/<harness>. each harness is responsible for managing its own sub doc graphs (if any) which then make up the hierarchy'. Also: '(and alphabetization//locale dependent)' — order within a level alphabetical by the page language's collation (Intl.Collator), not by hand-kept nav_order.

Measured today: just-the-docs 0.12, order by nav_order then title; 79 top-level entries, 42 with no nav_order (35 of them proposals/*.md), many ties.

## Done when
- [ ] the Pages list's top level is the harnesses, derived from the URL, never a hand-kept list
- [x] below a harness, its own declared sub-doc graphs make the hierarchy (`doc-group` in `cat-harness/docs/docs.json` + `_config.yml` `defaults`, PR #2215)
- [ ] order within a level is alphabetical in the reader's locale (`sortNavByLocale` was retired 2026-10-15 when the sidebar moved to the server-built rail `jekyll-pages-nav.ts`, where `byNavOrder` sorts by `nav_order` then case-insensitive title without reader locale)
- [x] no category exists that someone has to maintain (a page's group is its folder via `_config.yml` `defaults`)

_2026-10-05T16:20:38Z_ — Claimed by claude/vibrant-darwin-r6im60 — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

_2026-10-23T17:16:00Z_ — Implemented in `litlfred/cat-harness-tools#627` (`e594500`): `jekyllNavPages` applies `_config.yml` `defaults`, `harnessOfUrl` + `pagesNav` group top-level pages under their harness derived from the URL, and `pagesNav` sorts siblings within each level using `new Intl.Collator(locale, { sensitivity: "base", numeric: true })` with `pageLangOf(html)` wired in `mount-instance-docs.ts` and `gen-navbar-include.ts` (47/47 nav tests pass).

_2026-10-29T07:32:15Z_ — Completed: cat-harness-tools#627 merged (6bb02ad).


_2026-10-29T07:32:15Z_ — Completed: cat-harness-tools#627 merged (6bb02ad).

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] the Pages list's top level is the harnesses, derived from the URL, never a hand-kept list (`harnessOfUrl` + `pagesNav` in `cat-harness-tools/scripts/lib/jekyll-pages-nav.ts`, `litlfred/cat-harness-tools#627`)
- [x] below a harness, its own declared sub-doc graphs make the hierarchy (`doc-group` in `cat-harness/docs/docs.json` + `_config.yml` `defaults`, PR #2215; `_config.yml` `defaults` applied in `jekyllNavPages` in `litlfred/cat-harness-tools#627`)
- [x] order within a level is alphabetical in the reader's locale (`new Intl.Collator(locale, { sensitivity: "base", numeric: true })` in `pagesNav` and `pageLangOf(html)` in `mount-instance-docs.ts` / `gen-navbar-include.ts`, `litlfred/cat-harness-tools#627`)
- [x] no category exists that someone has to maintain (a page's group is its folder via `_config.yml` `defaults`)
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] the Pages list's top level is the harnesses, derived from the URL, never a hand-kept list
- [x] below a harness, its own declared sub-doc graphs make the hierarchy
- [x] order within a level is alphabetical in the reader's locale
- [x] no category exists that someone has to maintain
```
