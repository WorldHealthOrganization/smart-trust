---
$schema: folio-memory/v1
id: why-the-watchdog-exists
label: stable
summary: "why the watchdog exists"
createdAt: 2026-09-19
roles:
  - build-pipeline
  - validation-pipeline
references:
  - kind: agent
    id: ci-health-watcher
---
`docs-site.yml` fired on every push to `main` and **failed all 30 times over
two months**. The trigger was fine; the *outcome* was invisible, so the
published site sat stale and nothing in the repo said so. Work item `xom7`.

**A report is only read by someone in the room.** The session-start sweep
covers every day somebody is working; the failure being guarded against is a
quiet stretch with nobody looking — which is exactly the stretch in which no
session starts either. So `.github/workflows/ci-health.yml` runs the same
check **weekly** and maintains **one** tracking issue labelled `ci-health`:
opened when the default branch has a live failure, **edited in place** while
it persists (an edit does not notify, so a long outage stays one unread
item), and closed automatically when `main` is clean. Work item `ynu8`.

It deliberately does **not** send another email. GitHub sent 30, and the
premise of `xom7` is that nobody reads them. The three live badges at the top
of `README.md` are the same state at the front door.
