---
name: publish-site
description: >
  Give a layer a site: its Knowledge Graph rendered for publication at
  its site address, and the address answering. Four checks — a workflow
  publishes it, the gh-pages branch exists, Pages serves that branch, the
  address answers. How the rendering is staged and pushed is the toolset's
  own process, not this skill's.
---

# The site: a layer rendered for publication, and its address answering

**One abstract step.** A layer with a `repository` is **rendered for
publication at its site address, and the address answers**. How the
rendering is staged, committed and checked is the toolset's own subprocess
(its render-to-GitHub-Pages skill and diagram), so this skill stays a list
of checks. The site is how the documents reach their IRIs
([`publish-documents`](publish-documents.md), the primary step), not the
goal.

**Where the README page lands.** At `<site address>README.html`, and the site
address itself (`index.html`) is the **landing page**: by default a plain
redirect to `README.html`, so a Harness that wants a different front page puts
its own `index.html` or `index.md` at its root and changes nothing else. A page generated from the layer's files says so at its top,
and its footer points to what it was generated from, never to an editor for
the published copy: that copy is replaced on every publish.

The site address is the declaration's `iriBase` when it declares one,
otherwise `https://<owner>.github.io/<repo>/`.

## The checks ([`initialization-steps`](initialization-steps.md))

| step | done when |
|---|---|
| `site:workflow` | a workflow commits the rendering onto `gh-pages`: one under the layer's own `.github/workflows/`, or one in the toolset that publishes it from outside. bootstrap's own workflow writes only its JSON-LD context to `gh-pages`; its site is published from outside |
| `site:branch` | a `gh-pages` branch exists. **It must exist before Pages can be switched on**; where it does not, the step says how to create it (an orphan branch with a placeholder page) |
| `site:enabled` | Pages is on, serving `gh-pages` at `/`. Only after `site:branch` passes for this repository (see **Order** below). Switched on only by an authenticated forge CLI once the branch exists; otherwise the person gets the one step below |
| `site:live` | the address answers 200, and so does its README page, `README.html`. 404 after Pages is on usually means the workflow has not run yet. A 403, 407, 5xx or no answer is about the way from here: *could not determine*, never done |

**Order: create `gh-pages`, then switch Pages on. Never the reverse.**
`site:enabled` is not attempted, and not asked of a person, until
`site:branch` has passed for that repository, checked at the moment of
asking (a read of the branch, not a remembered publish run). A first publish
that is still running, or that failed, has not created the branch. When
several repositories are set up together, the ask lists only those whose
`gh-pages` exists now; the others are asked later, once their branch exists,
and never ahead of it "for when it appears". Owner, 2026-11-10: "you need
to create gh-pages first ... create gh-pages THEN update settings. you make
this mistake a lot."

When `site:enabled` cannot be done here, it goes to the person through
[`human-agent-discussion`](human-agent-discussion.md), written so it can be
followed without opening anything else:

> Open `https://github.com/<owner>/<repo>/settings/pages`. Under "Build and
> deployment", set **Source** to **Deploy from a branch**, branch
> **`gh-pages`**, folder **`/ (root)`**. It is free for a public
> repository. Then re-run the workflow that publishes the site from its
> Actions tab.

If Pages is already on but serves something else, **do not switch it
yourself**: that changes how an existing site is built, so ask.

Never silent: a step that could not be checked is said to be unchecked.

## Cost

Pages on a public repository, and the Actions minutes its workflow uses, are
free. Nothing else is switched on.
