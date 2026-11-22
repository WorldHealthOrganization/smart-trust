---
# folio-assistant-xwrt
$schema: bean/1.0.0
title: 'Mounted instance pages widen at phone width: kg-to-portal is 566px at 390'
status: completed
type: bug
priority: normal
created_at: 2026-09-24T07:06:54Z
updated_at: 2026-09-24T17:18:12Z
parent: folio-assistant-4ccr
---

Found by bean 2r2n (2026-09-24). After 2r2n, 1 of 249 built pages still scrolls sideways at 390 px: `docs/who-iris/kg-to-portal.html`, 566 px wide because of three long inline `code` spans (482, 357 and 311 px).

It is a MOUNTED instance page: `mount-instance-docs.ts` copies who-iris's own docs verbatim and injects the rail. It gets neither `narrow-viewport.css` (themed pages link it from head_custom.html) nor the inline copy (`withViewerNav` inlines it into generated viewers only).

The open question is whose page it is. The mount is the harness's write, but the page is the instance's content, and the navbar CSS deliberately carries no page-content rules because it lands on third-party pages (smart-trust's 681). Options: inline narrow-viewport.css at mount time for who-iris only; or fix it in who-iris's source.

## Done when
- [x] Where the fix goes: the owner chose xwrt with the recommendation; the page's own generator won on measurement (below)
- [x] kg-to-portal measures ≤ 390 px at a 390 px viewport

## Summary of Changes — 2026-09-24

**The fix is in the page's own generator, not the mount.** The first plan was
to inline `narrow-viewport.css` at mount time for in-repo instances only. The
check that would falsify it did: `mountable()` finds every mount, smart-trust's
681 IG pages included, among this repository's own top-level directories, so
the mount cannot tell who-iris from smart-trust without a new declaration.
`kg-to-portal` is written by `who-iris/scripts/gen-iris-pages.ts`, the same
generator as the catalogue viewer, so the rule goes in that generator's
stylesheet: `:not(pre) > code { overflow-wrap: anywhere; }`.

**Measured at 390×844:** all 10 who-iris pages, the 3 in `docs/` and the 7 in
`library/`, are 390 px wide. `kg-to-portal` was 566 px.

A test in `gen-iris-pages.test.ts` asserts every committed page carries the rule.

