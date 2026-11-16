---
# folio-assistant-ozwb
$schema: bean/1.0.0
title: Mount pass claims /smart-trust/ for openapi and rails the IG site (#2401)
status: completed
type: bug
priority: normal
created_at: 2026-10-07T07:34:06Z
updated_at: 2026-10-08T05:42:00Z
parent: folio-assistant-o3xy
---

An igSite instance root is skipped by mountable(), so withRoutes hands /<instance>/ to the next renderable kind (smart-trust: openapi). The mount then copies openapi over the IG site and rails every IG page, adding navbar.css (body padding-left 56px, .fa-nav-* rules) on top of the Jekyll side-bar. Fix: withRoutes takes rootTaken = igSiteRoots(). Issue #2401.

## Done when
- [x] root cause measured on gh-pages
- [x] withRoutes reserves igSite roots; tests
- [x] PR green (merged in PR #2402)

## Completed on landed evidence
Landed on main in PR #2402 (merge commit `71fce17e9931`, commit `0ecf8742166f`: "mount: an igSite root is taken — openapi no longer mounts over /smart-trust/ (#2401)").
- `withRoutes` reserves igSite roots (`igSiteRoots()`), so openapi mounts at `/openapi/smart-trust/` instead of overriding `/smart-trust/`.
- Verified on main.

