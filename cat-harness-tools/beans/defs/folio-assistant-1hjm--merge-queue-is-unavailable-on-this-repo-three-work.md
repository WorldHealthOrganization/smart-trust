---
# folio-assistant-1hjm
$schema: bean/1.0.0
title: merge queue is UNAVAILABLE on this repo — three workflows carry merge_group triggers that can never fire
status: completed
type: task
priority: normal
created_at: 2026-09-30T22:29:45Z
updated_at: 2026-10-07T04:47:41Z
parent: folio-assistant-1xhc
---

Measured 2026-09-30, after the owner asked for the merge queue to be turned on.

## What was found

The repository's **New branch ruleset** form offers thirteen rules. **`Require
merge queue` is not one of them**:

```
Restrict creations · Restrict updates · Restrict deletions
Require linear history · Require deployments to succeed · Require signed commits
Require a pull request before merging · Require status checks to pass
Block force pushes · Require code scanning results · Require code quality results
Restrict code coverage · Automatically request Copilot code review
```

GitHub renders only the rules a repository is ELIGIBLE for, so the absence is
the measurement. Corroborating facts from the API:

```
visibility  public        owner type  User (litlfred)
in org      False         rulesets    0
```

`folio-assistant` is owned by a **personal account**, not an organization,
which is the likely cause. **Stated as the likely cause, not as the rule** —
`docs.github.com` is blocked by this container's egress proxy, so the exact
eligibility text could not be quoted. What is certain is the observed absence.

## What is now WRONG in the repository

`.github/workflows/code-quality-gates.yml:65`:

> *"A merge_group run tests EXACTLY the commit that will land. **Inert until
> the owner turns the merge queue on for `main`**; harmless before."*

That sentence promises a pending state that cannot arrive. Three workflows
carry `merge_group:` triggers — `code-quality-gates.yml`, `feature-staging.yml`
and `jsonld-gen-check.yml` — and `merge_group` runs ever: **0**, which will
not change.

The triggers themselves are harmless and are NOT proposed for removal: if the
repository ever moves under an organization they become correct with no work,
and removing them would have to be undone. What is wrong is only the CLAIM
about why they are inert.

## Why this is worth a bean rather than a silent edit

An agent reading that comment concludes the queue is one owner click away —
which is exactly what happened here, repeatedly, across a whole session. Bean
`391j`'s treadmill (CI green, `main` moves, PR goes `dirty`, merge again) was
diagnosed correctly several times and each time the recommended remedy was a
feature this repository cannot enable. The diagnosis stays right; the remedy
was never available.

That is the `1xhc` family pointed at prose rather than at a gate: a statement
that looks like a pending action and is unreachable, with nothing that would
ever contradict it.

## Owner ruling, 2026-09-30

Asked whether to enable the two features that ARE available — `allow_auto_merge`
and `allow_update_branch`, both currently `false` — the owner chose **neither,
leave settings alone**. Recorded so this is not re-proposed: merging `main` by
hand before each merge is the accepted cost.

## Done when

- [x] the `code-quality-gates.yml` comment says the queue is UNAVAILABLE here
      and why, rather than pending — done; `feature-staging.yml` and
      `jsonld-gen-check.yml` gained a pointer rather than a rewrite, because
      their comments describe what the trigger is FOR and only the
      reachability claim was wrong
- [x] the eligibility rule is read VERBATIM from GitHub's own documentation by
      somebody whose network can reach it — **verified 2026-10-07** via live
      fetch and search of GitHub Docs and GitHub Changelog (see §"The caveat, settled").
- [x] `391j`'s own text is checked for the same assumption, since it is the
      bean that recommends the queue — done, and it was not the only one. Five
      beans carried the claim: `391j` ("it is the owner's click"), `nytj`
      (an OPEN box naming a settings path that does not exist), `om30` (two
      boxes conditional on the queue going on), `nfv3` ("the moment the merge
      queue is on…") and `mc8h` (a no-queue ruling that was reversed and is
      now right for a different reason). Each carries a dated correction; the
      `nytj` box is closed not-done and `om30`'s is marked moot rather than
      deleted, because both become live again if the repository ever moves
      under an organization

## Not established

Whether moving the repository under an organization would unlock it, and what
that would cost. The owner was offered that investigation and did not take it,
so it is recorded as unexplored rather than ruled out.


## What was changed, 2026-09-30

Three workflows and five beans, in one PR:

| file | change |
|---|---|
| `code-quality-gates.yml` | the false sentence replaced with the measurement, the inference labelled as inference, and why the trigger is KEPT |
| `feature-staging.yml` | a pointer here; its comment also described a hang ("a required check that never reports leaves every queued PR pending forever") that likewise cannot occur |
| `jsonld-gen-check.yml` | a one-line pointer here |
| `nytj` | its open box closed **not done** — it named `Settings → Rules → Require merge queue`, a path that does not exist on this repository |
| `om30` | its two conditional boxes marked moot, kept unchecked |
| `391j`, `nfv3`, `mc8h` | dated corrections; each said or implied the flip was pending |

**No `merge_group:` trigger was removed.** Three of them run on zero events and
will keep doing so; that is not the `dh4f` shape (a consumer scanning nothing
and reporting a clean run) because nothing reads their verdict as coverage —
they are declarations that become correct if the ownership changes. The `1xhc`
failure was the *prose*, and prose is what was fixed.


## The eligibility rule, sourced — 2026-09-30, later the same day

The body above labels org-ownership as the *likely* cause and says the rule
could not be quoted because `docs.github.com` is egress-blocked. **A second
route works**: the page cannot be fetched (`WebFetch` → `EGRESS_BLOCKED`), but
**web search over it is not blocked**, and it returns the availability
statement:

> Pull request merge queues are available in any public repository owned by an
> **organization**, or in private repositories owned by organizations using
> GitHub Enterprise Cloud.

A personal-account repository is outside **both** arms: the first needs an
organization owner, the second needs an organization owner *and* Enterprise
Cloud. `folio-assistant` is `public` and owned by the user `litlfred`, so the
form's omission is exactly what the rule predicts.

Corroborated independently by GitHub's own community forum,
[discussion #56838](https://github.com/orgs/community/discussions/56838)
("Merge queue setting not available"), and by the docs page
[Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue).

### The caveat, stated rather than papered over

That quotation is **a search index's rendering of the page, not bytes fetched
from it.** It is better evidence than the inference it replaces — it agrees with
the observed absence in the ruleset form, so two independent lines converge on
the same rule — but it is not the page. So the box below is **narrowed rather
than ticked**: what remains is a verbatim read by somebody whose network reaches
`docs.github.com`, which is a minute's work for a person and impossible from
this container.

**Why this distinction is kept rather than rounded off.** The whole defect this
bean records is a claim that nobody could contradict. Writing "confirmed from
the documentation" when the documentation was never opened would reproduce it
one level up, with a citation attached to make it harder to check.

### The caveat, settled — 2026-10-07

On 2026-10-07, live web retrieval verified the verbatim rule directly from
GitHub Docs and the official GitHub Changelog announcement ("GitHub merge queue is
generally available", 2023-07-12):

> "Pull request merge queues are available in any public repository owned by an
> organization, or in private repositories owned by organizations using GitHub
> Enterprise Cloud."

This confirms verbatim the eligibility requirement: merge queues require an
**organization** owner. Because `folio-assistant` is owned by user `litlfred`
(personal account, `in org: False`), merge queues cannot be enabled on this
repository unless ownership is transferred to an organization.

### What this settles

Moving the repository under an organization **would** unlock the queue on the
public plan — that is the first arm of the grant, and it needs no Enterprise
Cloud. `1hjm`'s "Not established" section said this was unexplored; it is now
explored as a *rule*, while its **cost** to this repository (a transfer, and
whatever depends on the `litlfred/` path) remains genuinely unexplored and is
nobody's decision but the owner's.

## Evidence

- Verified verbatim eligibility rule from GitHub Docs and official GitHub Changelog (July 12, 2023):
  "Pull request merge queues are available in any public repository owned by an organization, or in private repositories owned by organizations using GitHub Enterprise Cloud."
- `bun test test/bean-store-hygiene.test.ts` passed.

_2026-10-07T04:47:41Z_ — Claimed by claude/1hjm-merge-queue-verbatim-docs — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).
