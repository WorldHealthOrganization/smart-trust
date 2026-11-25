---
# folio-assistant-7s52
$schema: bean/1.0.0
title: staging-review hands a reader URLs the AGENT cannot open — but the publish ref is a git branch
status: completed
type: task
priority: normal
created_at: 2026-09-22T06:33:57Z
updated_at: 2026-09-30T14:44:36Z
parent: folio-assistant-o3xy
---

Issue: https://github.com/litlfred/folio-assistant/issues/849

`staging-review` already owns the publish ref, and already names the failure:
bean `rptk`, a contrast defect that survived two days *"because the gate that
swept the page never opened the view"*. It composes URLs for a reader and stops
there.

THE AGENT CANNOT OPEN THEM. Measured this session, all three routes:
`curl` -> 403 CONNECT tunnel failed; `WebFetch` -> EGRESS_BLOCKED; Playwright
-> `net::ERR_TUNNEL_CONNECTION_FAILED` (Chromium is proxy-configured too, so a
browser is not a way around it).

The cost is measured rather than hypothetical: twelve navbar tiles shipped
pointing at the ORIGIN instead of the site (#801), and 100+ green gates were
fine with it, because nothing in the repository could look at what deployed.

But the site is published to the `gh-pages` BRANCH, and git works. Serving that
ref through a Playwright route handler renders the real deployed bytes. Used
twice this session: the production/staging A/B that reproduced the owner's 404
mechanically (12/12 off-site vs 0/12), and the post-merge uploads check.

Related to `81vy` (deployment awareness — which tools apply on which surface),
which stays open: that bean is about the surface constraining the tools, this
is one technique for one surface.

## Done when

- [x] `staging-review` says the agent can open it itself, with the mechanics
- [x] The limit is stated: it serves BYTES, not the live host — redirects,
      headers and Pages' own 404 behaviour are out of scope
- [x] How to tell the technique has stopped applying (publishing moves off a
      branch), rather than reporting a clean run over nothing
- [x] `bun run cat gates` green



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, and no holder recorded; the sessions that held theme C (rendered site) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

## Summary of Changes

Closed on evidence 2026-09-30. The work landed in #850 on 2026-09-22 and #849 was closed then; this bean was never updated.

- Box 1: staging-review §"You can open it yourself — the publish ref is a git branch" gives the mechanics (a treeless `gh-pages` fetch, and a Playwright route handler serving `git show` blobs under the real `BASE`).
- Box 2: §"What this does NOT verify" states the limit — bytes, not the live host.
- Box 3: §"When it stops applying" covers publishing moving off a branch, which is reported as could-not-determine.
- Box 4: gates were green on #850's merge.

**Re-falsified today, not only read.** From this container, curl to the live site gets no response (status 000). The technique still works: `git fetch --depth 1 --filter=blob:none origin gh-pages` took 1.2 s, and the home page rendered in Chromium from `git cat-file` blobs with 31 resources served and 0 missing.
