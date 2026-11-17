---
name: getting-started
description: Triage what a person means when they ask to create a folio, and route them. Five requests share one sentence — a folio in a new repo, folio-assistant overlaid on an existing repo, a second folio in a layer that already has one, a content object they called a folio, or something the filesystem cannot tell apart. Reads the repository facts, runs them through the folio-intent decision table, asks a selectable question for what facts cannot settle, scaffolds, and reports the published URL. Use whenever a user asks to create, start, set up, or initialise a folio, a paper, a DAK, an IG, or "folio-assistant" itself.
user_invocable: true
---

# /getting-started — what did they actually ask for?

Process: the content core's `processes/conduct/getting-started.bpmn`.
Decision table: the content core's `decisions/folio-intent.dmn`.

## The landing page is the layer's own description

A folio's home page opens with **its** description inside **its** backdrop, both
declared in the repository's declaration. Nothing about any
particular layer is written into the template, so a downstream folio does not
inherit the platform's grumpy cat.

**Where the markdown node is:** `description` in `<name>.json`. It is
markdown and it is rendered as-is. There is no separate landing page to keep in
step with it, because a description in two places will disagree with itself.

**How the picture is declared:** an image with `role: "landing"` and a `layout`
(`laptop`, `mobile`, `card`), plus a `textRegion` giving, as fractions of the
image, where words may safely be drawn.

`textRegion` is **authored, not computed.** It states where the composition is
*quiet*, which is a judgement: find it by rendering candidate boxes over the
image and looking at them, not by deriving a number from the aspect ratio.

Run `bun run cat docs:harness` after editing, and `--check` in CI.

**Three states:**

| declared | rendered |
|---|---|
| backdrop **with** region | description drawn inside it |
| backdrop, **no** region | picture shown, words placed **below** it |
| **no** backdrop | words alone |

An undeclared region means *do not overlay*, never *anywhere is fine*, because
text positioned by guesswork lands on the picture. A folio with no art is
ordinary.

A viewport with no variant falls back to the widest available, and the fallback
is **reported** — that crop's region is wrong for a narrow screen, so a consumer
can decline to overlay rather than place text somewhere nobody chose.

Reader-facing walkthrough: `docs/start/getting-started.md` §8.

**A new layer's `beans/` and `todos/` are not written into its checkout.**
By default `folio_init` declares them on their own branches,
`cat/<instance>/beans` and `cat/<instance>/todos`, and prints a one-time seed
command. Say so when you hand the scaffold over: until the seed has been run
and mounted, an empty `beans list` means *not mounted*, not *no work*. The
rule, the branch naming and the override live in
[`directory-conventions`](../../kg/kg-core/directory-conventions.md)
§"Where a NEW layer's state lives".

## 0. Why this skill exists

`folio_init` scaffolds a folio, and it does it well. What it cannot do is know
whether scaffolding is the right move, because the sentence that reaches it —
"create a folio", "set me up with folio-assistant", "I want to start a paper" —
is spoken by at least five different people:

| they mean | what they have | the wrong move costs them |
|---|---|---|
| **new-repo** | nothing yet, or an empty directory | — (this is the safe default, and the only one an agent may assume) |
| **overlay** | a repository with their own work in it | a folio scaffolded on top of a project the agent never looked at |
| **add-folio** | a folio-assistant layer already | a second repository they did not want, and a split corpus |
| **new-content** | a folio, and they wanted a *document* in it | an entire empty folio, and the chapter they asked for still not written |
| **ask** | any of the above, undeclared | — |

**Four of these five states look identical from the user's sentence**, and
three of them look identical from the filesystem, so the triage always runs.

## 1. Read the facts — mechanical, read-only, before anything is written

Three facts, and nothing else. Gather them by looking, not by asking:

```sh
# isFolio — does an instantiated config here declare a contentType?
#   The root <name>.config.json files, and index.config.json, whose instances
#   may carry contentType inline (index-config skill).
grep -lq '"contentType"' ./*.config.json 2>/dev/null && echo isFolio=true || echo isFolio=false

# repoHasContent — does the tree hold somebody's project, as opposed to being bare?
#   Ignore VCS bookkeeping and editor droppings; count anything else.
git ls-files | grep -vE '^\.(git|github|vscode|idea)/' | head -1
```

`statedIntent` is the third, and it is a fact about the **conversation**: one of
`new-repo`, `overlay`, `add-folio`, `new-content`, or `unstated`. It is
`unstated` until the user has actually said which — never *inferred* from tone,
from the repo, or from what would be convenient. A user who says "I want to add a chapter" has stated
`new-content`; a user who says "create a folio" has stated **nothing**, because
that sentence is what the five requests have in common.

> **`isFolio` is ONE MEMBERSHIP of a set, and the set is what a repository
> is.** `describeRepository()` (`schemas/content/content-type.ts`) returns every
> marker a repository carries — `folio`, `harness`, `dak`, `sushi` — with the
> facts each states and any disagreement between them.
> `describeRepositoryClosure()` (`schemas/kg/harness-config.ts`) extends that
> through the dependency tree, attributing each membership to the layer
> that carried it.
>
> **`folio` and `harness` are different types.** The declaration says *this is a layer*; a config that
> declares `contentType` says *this authors folio content*. That config is a root
> `<name>.config.json`, or its entry in `index.config.json`, where inline fields
> overlay the imported file ([`index-config`](../../kg/kg-core/index-config.md)).
> Listing a layer in the index makes it instantiated, not a folio. `cat-harness/` carries the first and not
> the second — it is a harness and is **not** a folio. `isFolio` is exactly
> membership of `folio`: the DMN documents the input as a config in the
> working directory that *declares* a `contentType`, not its mere presence.
>
> So a repository being several things at once does **not** perturb the five
> branches. They key on folio-ness alone, and a folio that is also a DAK takes
> the same branch as one that is not — it is still already a folio, still has
> content, and the user has still either stated an intent or not. Use
> `describeRepository` when you want to know what a repository *is*; this
> probe when you want to know which branch to take.

> **`isFolio` is about the working directory, not about the user.** Somebody
> who has used folio-assistant before, in another repo, is still in an
> `isFolio=false` directory. Their experience is not a fact this table reads —
> it changes how much you explain, not which branch you take.

## 2. Let the table decide

Feed the three facts to `workflow_complete` on `Gateway_Intent`, or read
`folio-intent.dmn` directly. Do **not** supply an `outcome`: the gateway is
computed, and `workflow_complete` refuses a hand-supplied answer there on
purpose.

The table returns one of five branches. Two of its seven rules return `ask`,
and that is a result, not a failure to produce one:

- **already a folio, intent unstated** → `ask`. `add-folio`, `new-repo` and
  `new-content` are all consistent with what is on disk.
- **not a folio but has content, intent unstated** → `ask`. `overlay` and
  `new-repo` are both consistent, and overlaying somebody's repository on a
  guess is not recoverable by a `git checkout`.
- **not a folio, nothing here** → `new-repo`. The one state that answers itself.

## 3. Ask — as options, never as prose

When the branch is `ask`, put the question as a **short list of selectable
options**. Not a paragraph, not an open "what would you like to do?", and not a
question whose answer has to be typed out. Load
[`interaction-modality`](interaction-modality.md) first; it decides the form the
question takes, and for some users free text is not an available input at all.

The list, phrased in the user's terms rather than the branch names:

1. **Start a new folio in a new repository** — nothing here gets touched.
2. **Add folio-assistant to this repository** — keeps what is here; I'll look
   through it first and show you what I find before importing anything.
3. **Add another folio to this repository** *(offer only when `isFolio=true`)*.
4. **Add something to the folio that's already here** *(only when
   `isFolio=true`)* — a chapter, a document, a DAK component.
5. **Tell me more** — for the user who wants to describe it in their own words.

Then ask what they want to get started **on**, offering the top-level content
types this platform knows about, because "a folio" is not something anybody
actually wants:

| content type | what it is | profile |
|---|---|---|
| **paper** | a scientific paper or book, with formal claims backed by Lean and typeset through LaTeX | `paper` |
| **document** | structured prose — policy guidance, a standard, a report. No Lean, no required TeX | `document` |
| **WHO SMART DAK** | a Digital Adaptation Kit (L2): personas, business processes, data elements, decision tables | `dak` |
| **WHO SMART IG** | a FHIR Implementation Guide (L3) built from an L2 DAK | `dak` |

Record the answer as `statedIntent` and evaluate the table again. **The user's
answer is a fact like any other** — it feeds the gateway, so the loop in the
diagram runs back to `Task_ReadFacts` rather than jumping straight to a branch.

**When a remote repository is involved, ask which mode — and never infer it from
push access.** A remote git repository is assumed **read-only (`read-from`)**.
Having push access to a remote is never permission to modify it, and
instantiating on a remote repository writes nothing there without the user's
explicit permission for that repository. Ask which mode they want, with
**materialize-or-reference** as its own question:

1. **Keep it here (`read-from`) — build and render from the remote KG in this
   repository** (`stage-ig-sites` into `/<instance>/`), and ask **whether to
   materialize its assets locally or reference it in place**
   (`materialize-remote` / `materialize-on-demand`).
2. **Put a harness on the remote repository (`written-to`)** — instantiate the
   harness in that remote repository itself and build in its own CI
   (`stage-ig-sites --only <instance> --source .`), only after explicit
   permission for that repository.

## 4. Route

| branch | do |
|---|---|
| `new-repo` | Ask for the name. Create or use the empty directory, then `folio_init`. |
| `overlay` | Hand off to [`repo-conversion`](repo-conversion.md) — scan first, import second, and never in the other order. The scan's `markers` are offered as picks (§2a, `Task_ChooseHarnessed`): the harness declares only what the person chose — declare, don't slurp. |
| `add-folio` | `folio_init` against a new top-level slug in the existing layer. Do not re-link the platform; it is already linked. |
| `new-content` | **Stop.** This process ends here. Hand off to the active content type's authoring skill. Scaffolding anything on this branch is the bug. |

**An empty repository gets `main` before any feature branch.** GitHub makes
the first branch pushed to an empty repository its default, so run
`init-folio` (it seeds `main` first) or push `main` yourself before pushing
anything else.

**A specialised content type is routed by its own creation skill.** When the
answer to step 3's second question names a domain content type shipped by a
higher harness layer, hand over to that layer's creation skill (discover it via
`skill_list`). It reads the same facts and adds the in-repository staged
sub-KG option — staging inside the current repository first so nothing outside
the repository changes until the owner confirms. Where `folio_init` does not
handle that content type directly, the new-repository route scaffolds with
`--instance`.

**A second folio can leave later.** What `add-folio` creates, and any staged
sub-KG, may later move to a repository of its own. That is
[`sub-kg-lifecycle`](../../kg/graph-management/sub-kg-lifecycle.md): stage it
in place, then create the repository and delete the in-repo copy, each only on
the owner's confirmation.

## 5. After scaffolding — seed the plan, then publish

1. **Seed the work plan.** One work item per top-level thing the author named in
   step 3. Run the exact-title existence check in
   `todo-manager.md` (opt-in `cat-harness.work-plan`) §"Check before you create" first —
   `beans create` is not idempotent.
2. **Provision `gh-pages` — before Pages is switched on.** This is
   `Task_ProvisionGhPages` in the process, and it carries the semantics of
   `A_Provision` in bootstrap-tools'
   [`render-kg-to-github-pages.bpmn`](../../../../bootstrap-tools/processes/render-kg-to-github-pages.bpmn)
   (the `gh-pages` Tool's subprocess —
   [`render-kg-to-cdn`](../../process/workflow/render-kg-to-cdn.md)):
   **a `gh-pages` branch must exist before Pages can be switched on** to serve
   it. Run
   `bun run cat-harness-tools/scripts/pages-bootstrap.ts --provision`: it checks
   `git ls-remote --heads origin gh-pages` and, only if the branch is absent,
   pushes an orphan `gh-pages` holding a placeholder `index.html` and
   `.nojekyll`. It is idempotent and never forces a push; without
   `--provision` the script creates no remote branch, it only reports
   `unprovisioned` with the exact command. Then switch Pages on with
   **Source: "Deploy from a branch: gh-pages, / (root)"** — not "GitHub
   Actions", when the publish workflow pushes `gh-pages` (the script prints
   the source it expects). **Every publishing route reaches this step**:
   new-repo, add-folio, and the overlay route through
   [`repo-conversion`](repo-conversion.md) — including an overlay or new repo
   that [remote-mounts](../../kg/kg-core/remote-mount.md) its dependencies,
   which never reaches this section by itself.
3. **Start the Pages build and report the URL.** Run
   `bun run cat-harness-tools/scripts/pages-bootstrap.ts --wait`. It checks the
   branch first, derives the site address, says whether a publish workflow
   exists and which Pages source it needs, and probes until the site answers.
4. **Say which of the four states you got**, and never blur them:
   - **unprovisioned** — there is no `gh-pages` branch (exit 3). Go back to
     step 2; nothing later can succeed until it exists.
   - **live** — hand over the link, and say what is on it.
   - **not-yet** — a measured 404. Give the address, say the first build has
     not landed there yet, and say roughly how long it takes.
   - **unknown** — no URL could be derived, or the probe failed. Say *that*.
     "Should be live shortly" is a claim you do not have evidence for.
5. **Tell them the corpus is by reference, and how to change that.** A fresh
   harness holds references, not the remote content itself, which can be
   hundreds of gigabytes. When they need part of a remote subgraph locally,
   that is an ask made later, as the need appears. Name the skill
   (`materialize-on-demand`) and the one command that shows what is already
   held (`bun run cat cache:index`), so they learn the option exists here rather
   than by finding a schema. Do not materialize anything now.

## 6. Anti-patterns

1. **Scaffolding on `ask`.** The table returned a question; answering it
   yourself with the convenient branch defeats the table.
2. **Treating "I've used this before" as `add-folio`.** Experience is not a
   filesystem fact and not an intent.
3. **Asking in prose.** "Could you tell me a bit about what you're hoping to
   build?" is a wall for a user who types with difficulty, and it produces a worse
   answer than the numbered list.
4. **Announcing a Pages URL you have not probed.** See step 5.
5. **Going straight to `folio_init` because the request seemed obvious.** Every
   one of the five requests seems obvious to the person making it.
6. **Switching Pages on before `gh-pages` exists, or choosing "GitHub
   Actions" as the source for a workflow that pushes `gh-pages`.** Step 2
   first; the source is "Deploy from a branch".
