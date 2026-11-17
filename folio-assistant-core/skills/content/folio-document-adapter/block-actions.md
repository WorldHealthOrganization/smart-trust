---
name: block-actions
description: >
  Every block of a rendered document links back to where it can be changed:
  [edit] opens the block's Markdown source in GitHub's editor, and [feedback]
  opens a GitHub issue about that block, from the folio's own issue form when it
  has one, listing the change-sets that already discuss the block. Use when a
  reader, reviewer or agent needs to propose a change to one block, when setting
  up a folio's feedback issue form, or when a document site's links point
  nowhere.
---

# Block actions: [edit] and [feedback] on every block

A reader who finds something wrong in a block is one click from proposing the
fix or saying what is wrong, and the click lands on the block, not on the
repository. The links are per **block**, because a block is what a comment, a
change-set and an edit are about.

The code is `folio-assistant-core/scripts/block-actions.ts`; the Tool is
`block-actions`; the document build (`build-document-site.ts`) draws the links
on every labelled block, and the public-comment overlay adds the issues that
already discuss the block.

## What each link does

| link | opens | what the person does next |
|---|---|---|
| **✎ edit** | the block's source (`folio/<doc>/<chapter>/<root>.md`, or its `.ts` if it has no `.md`) in GitHub's editor, on `main` | edits and proposes the change; GitHub makes the branch and the pull request, which is reviewed like any content change (`content-change-review.bpmn`) |
| **📣 feedback** | a new issue about the block | describes the problem; the issue is intake, and a public-comment folio triages it like any other comment (`public-comment` skill) |
| **discussed in #n** | the issue of each change-set the block's comments are in | joins the existing discussion instead of opening a duplicate |

## Every issue is coded with its content

[feedback] codes the issue with the slug of the document it came from: the
title reads `Feedback [dpi-h-ra]: <section> — <block>` and the body opens with
`**Content:** \`dpi-h-ra\``. A folio with several documents, or a repository
that takes issues about more than one thing, can then sort feedback by what it
is about without opening it. The code is in the **title** rather than only a
label because GitHub silently drops a prefilled label when the reporter has
no triage rights, and most public reviewers do not.

## The issue form is the folio's, and optional

With no form, [feedback] opens a blank issue whose body already says which
block, which section, the source link and the block's address on the site. It
works on day one.

A folio that wants structured feedback adds a GitHub issue form at
`.github/ISSUE_TEMPLATE/block-feedback.yml` (start from the shared
`templates/issue-forms/block-feedback.yml`, whose answers the drafting review
sheet imports: skill `review-sheet-script`) (another name with
`--issue-template`). The link then names the form and prefills **only the
fields the form declares**, matched by `id`:

| field id | filled with |
|---|---|
| `block` | the block's label (its anchor) |
| `section` | the heading the block is under |
| `source` | the block's source path in the repository |
| `page` | the page it renders on |
| `url` | the block's address on the published site (needs `--site-url`) |
| `content` | the document's slug, the code the issue is triaged by |

A form may declare any subset, and fields it does not declare are not sent.
Add the questions you want answered (what is wrong, a suggested wording, the
reviewer's organisation) as further fields; they are left for the person.

## Where the repository comes from

`GITHUB_REPOSITORY` in CI, else the checkout's `origin` when it is on GitHub,
else `--github <owner/repo>`. **No repository, no links**: a page with no
links is honest, a page with broken ones is not. `--no-block-actions` turns
them off for a build that should have none.

## Two forms of the same links

- **Full** (`blockActionsHtml`): every href written into the page. Used on a
  one-page document and on `index.hydrated.html`, so the links work without
  JavaScript.
- **Compact** (`compactActionsHtml` + `compactActionsScript`): the block's
  facts as data attributes, and the hrefs built in the browser when a pointer
  or focus reaches them. Used on a lazy page's shell, where a prefilled URL
  per block would bloat the page. The browser builder, `BLOCK_URLS_JS`, is held
  equal to `editUrl` and `feedbackUrl` by `block-actions.test.ts`; change both
  together or the test fails.

The recipe lives in the harness, `cat-harness-tools/src/core/edit-links.ts`, so
every layer can use it; this package re-exports it. It is published once as
`assets/js/edit-links.js` (held equal to the code by a test). On a page, mark
a link `data-fa-link="edit|source|feedback"` and either give its host the
facts (`data-src`, optional `data-repo`, `data-line`, `data-block`,
`data-sec`) or leave a GitHub `blob`/`edit` href, which the runtime reads the
facts from. Generators that write Markdown use `markdownEditLink`.

Three places keep their own link on purpose: the public-comment dashboard's
**Discuss** (it opens a change-set discussion, not feedback on a block), the
bootstrap site's **Improve this page** (`bootstrap-tools` may import nothing
outside itself), and an IG page's per-**section** ✎ / 📣 (`SOURCE_LINKS_JS`
in `build-ig-site.ts`): a section's heading can live in an included file,
and its issue is titled after the section with the page apart.
The IG page's own *Edit this page* link does use the recipe.

**Any page that shows edit or feedback links uses these,** not a URL of its
own: one recipe, so a change to the issue form or the branch reaches every
page at once.

## In the library: edit opens the folio, never the source

A library entry is a frozen source: the version published for public comment
stays in `library/` exactly as circulated, and the changes the review asks
for are made in `folio/`. So the library's Document view
(`cat-harness-tools/scripts/lib/library-document.ts`, drawn by the platform viewer
and by `build-library-site.ts` on a folio's site) shows:

| link | on | opens |
|---|---|---|
| **source** | the document, each section | the library's own file on GitHub, read-only |
| **📣 feedback** | the document, each section | an issue coded with the entry: `Feedback [<entry>]: <section>` |
| **✎ edit** | each section, and its contents row | the FIRST folio block of the folio section MATERIALISED from it |

A section is matched to the folio by its number, else its title, through the
`folio-review-anchors/v1` file whose `library` names the entry. A section the
folio has no counterpart for (a PDF's front matter) gets no ✎ edit, because a
guessed link would open the wrong block. The platform's own library has no
materialisation, so it shows source and feedback only.

`bun run folio-assistant-core/scripts/build-library-site.ts --repo <folio> --out _site`
publishes a folio's library at `<out>/folio-assistant-core/<library dir>/<entry>/`,
the same `<base>/<handler>/<kind>/<subject>` route every viewer follows.

## Using it as an agent

```sh
# one block's links, to hand a reader
bun run folio-assistant-core/scripts/block-actions.ts --repo <folio> --block prose:1-1-4-a8e0b3
# every block's, as JSON
bun run folio-assistant-core/scripts/block-actions.ts --repo <folio>
```

When someone in a chat says "this paragraph is wrong", give them the block's
**feedback** link, not the repository's issue page, and the **edit** link if
they can propose the wording themselves.

## What not to do

- Do not point [edit] at the frozen review version under `library/`. Comments
  cite it, so it is never edited; the folio's blocks are.
- Do not point [edit] at the staging branch. An edit is a proposal to the
  published text, so it starts from `main`; a different branch is an explicit
  `--edit-branch`.
- Do not hand-write issue URLs in a folio's pages. They drift when a block is
  renamed; the build recomputes them from the manifests every time.
