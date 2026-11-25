---
name: publish-verification
description: >-
  Verify what a publish produced, and alert the publication manager
  whenever any step after the publish button fails —
  the verifier set, how to add a verifier, what is in scope, and how the
  publication manager triages the one alert.
---

# Publish verification, and the one alert

The verifier set runs over the built site before it is deployed. It does
not stop the deploy: its outcome is judged after the push, and any failure
reaches the publication manager through the same single alert as every
other step after the publish button.

## The two processes

- **`publish-verification.bpmn`** — the verifier set over the built tree,
  between the export and the deploy. Pass, fail, or could-not-tell; the
  caller deploys either way and judges the outcome after the push.
- **`publish-alert.bpmn`** — ONE alert, called from every failure edge in
  `docs-site-publish.bpmn`: a refused security gate, a failed deploy, a lost
  preview, a failed built-site check. It reaches the role that already owns the
  release: the **publication manager**.

## The verifier set

`bun run cat publish:verify -- --dir <built site> [--report out.md]` —
`scripts/publish-verify.ts`. Exit 0 pass · 1 a finding · 2 could not tell.
The caller treats 1 and 2 alike: an unverified release is not a verified one.

Each verifier is one entry in `VERIFIERS`: an id, the question it asks, and a
function from the directory to findings. **Adding a verifier is adding an
entry**; the report, the exit code and the alert need no change. Give it a
test that builds a document to break it, as `publish-verify.test.ts` does.

**`jsonld-expand`** is the first: every JSON-LD document of ours is expanded
by a real processor (`jsonld.js`, network refused). A key the `@context` does
not declare is DROPPED by a processor, silently.

## A verifier the preview cannot ask is a release failure waiting (STRICT)

The staging preview runs the same verifier set, so a preview is never greener
than the release it previews. **That promise breaks wherever the preview
answers a different question.** It serves the PUBLISHED search index
(`--search-index borrowed`), so `search-index` there asks only "present and
parsing", never "does it cover the pages" — so a preview can be green while
the release refuses it.

So the preview asks the coverage question of the index **it built**, before
swapping in the published one:
`publish-verify.ts --dir ./_site --only search-index`. The rule, for any
verifier added later: **if the preview substitutes an input, the verifier runs
on the preview's own input before the substitution.** A check only the
release asks fails after merge, on main, where everyone pays for it.

**Deliberate exclusion is marked in what is built.** `search_exclude: true`
is front matter, and front matter is gone after Jekyll. `head_custom.html`
writes `<meta name="fa-search-exclude">` for it, and `search-index` leaves
those pages out of the coverage denominator and COUNTS them in its finding.
An exclusion the built page does not carry cannot be told from a truncated
index, and the release check will refuse it, correctly.

## What is in scope

A document is ours when its `@context` names our content context or binds a
namespace in the `own-namespaces` code list. Everything else in the tree —
an ingested IG's artefact index, for example — is counted as out of scope,
reported, and never able to block the release.

## Triage, for the publication manager

The alert is a tracking issue labelled `publication-manager`: opened on the
first failure, **commented on** for each later one (a comment notifies; an
edit does not), closed by the next clean publish. The issue says which step
failed and whether the site deployed:

- **Nothing was deployed** (the export, or verification) — the live site is
  the previous publish. Hold, or fix forward.
- **The site deployed** and something after it failed (a lost preview) — it
  is live. Say so in the issue before fixing.

The label names the role, not a person: no actor declares a GitHub account
for `publication-manager`. Watching the label is how a person takes the role.
