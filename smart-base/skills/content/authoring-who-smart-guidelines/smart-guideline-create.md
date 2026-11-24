---
name: smart-guideline-create
description: >
  Somebody asked for a new WHO SMART Guideline (an IG built on smart-base, or
  a DAK that will feed one). Specialises fhir-ig-create: the same three facts,
  the same numbered question with the same default (stage it inside this
  repository first), and the same routes, plus the SMART rules: every
  guideline repository instantiates smart-base identically, forks under
  litlfred come before any WHO repository, the identity comes from the
  declaration and never from the directory, and the WHO template's theme and
  chrome come from smart-base by `needs`, never copied. Use whenever a user
  asks to create, start or set up a SMART Guideline, a SMART IG, a WHO IG or
  a DAK.
---

# smart-guideline-create

> Skill id: `smart-guideline-create` · Package: `authoring-who-smart-guidelines`
> Specialises [`fhir-ig-create`](../../../../fhir-harness/skills/fhir-ig-base/fhir-ig-create.md)

A new SMART guideline is created either in a new repository or inside the
folio of an existing harnessed repository. **Run `fhir-ig-create` and change
only what is below.** Its facts, decision table, question and default
(`in-repo`, a staged sub-KG) all hold. This skill adds what is WHO's, which
the FHIR layer must not know (`check:fhir-harness-exclusions`).

## What changes

### 1. A fourth fact: which level is being started

A SMART guideline is L1 narrative, an L2 DAK, or an L3 IG
([`smart-stack-layering`](smart-stack-layering.md)), and they are not a chain.
Ask it as one more numbered question, only when the request did not say:

> What are you starting with?
>
> 1. **The FHIR IG (L3)** *(recommended)*. The level the pipeline builds today.
> 2. **The DAK (L2)**: the ten components. Its document kind is still being
>    built, so this starts as plain authoring.
> 3. **An L1 narrative document** from the smart-base library.
> 4. **Tell me more.**
>
> **Default if you do not answer: 1.**

An L1 or DAK start is a document kind inside smart-base, authored with
[`l2-dak-authoring`](https://github.com/litlfred/smart-base/blob/main/smart-base/L2/skills/smart-l2/l2-dak-authoring.md) or as an L1 document, not a new
layer. Only the IG (option 1) goes through the routes below.

### 2. The declaration `needs` the IG-publication layer, not fhir-harness

Where `fhir-ig-create` writes `needs: ["fhir-harness"]`, a SMART guideline
needs the layer every ingested guideline already needs: copy the `needs` of
an existing staged guideline's declaration rather than typing a name. That
layer brings smart-base, and through it the WHO template's theme and chrome.
**Never copy a theme or a `chrome.json` into the new layer**: chrome is
keyed to the template, not to one guideline.

### 3. The layout is the same in every repository

Every guideline repository instantiates smart-base **the same way**.

| at the repository root | under `smart-base/` |
|---|---|
| the IG source as WHO publishes it (`sushi-config.yaml`, `input/`), unchanged | this guideline's data: its declaration, artefact index, menu, generated pages, QA results |
| `index.config.json`, whose `smart-base` entry carries the layer's config inline (there is no `smart-base.config.json`) | |

So while the guideline is staged in place (route `in-repo`), its directory is
already that `smart-base/` data directory, under whatever path `livesAt`
names. When it leaves, the directory becomes `smart-base/` in the new
repository, so **nothing may key on the directory name**: identity comes from
the declaration's `name`. Check every new generator for this before it ships.

### 4. A new repository is a litlfred fork first

`litlfred/smart-*` forks are the staging ground before any WHO repository. In
route `new-repo`, and in `sub-kg-lifecycle`'s stage 8, the planned
`repository` is `litlfred/<name>`, a fork of the WHO repository when one
exists. Moving to a `WorldHealthOrganization/*` repository is a later, separate
owner decision, never part of this skill. The question before creating is the
same one, with the same default ("not yet").

### 5. Pages are generated with the WHO labels passed in

The page generator is fhir-harness's and knows nothing of WHO; the WHO names
are configuration. Model the new layer's `<name>:pages` script on
`smart-base:pages` in `smart-base/package.json`: `--publish-note`,
`--sidecar-label "DAK API"`, `--label` and `--chrome-owner smart-base`.

### 6. A new repository carries its entry point and its platform mount

An empty repository gives an agent no skills, no process and nothing saying
the work is staged L1 → L2 → L3 ([`smart-guideline-end-to-end`](smart-guideline-end-to-end.md),
*The order is a rule*). So route `new-repo` writes these before any guideline
content, copied from an existing guideline repository
(<https://github.com/litlfred/smart-immunizations>), never typed:

| file | what it does |
|---|---|
| `AGENTS.md`, declared in `<name>.json` as the asset `agent-instructions` (role `agent-instructions`), with `README.md` as `instance-readme` | names [`smart-guideline-end-to-end`](smart-guideline-end-to-end.md) as the entry point for any authoring or adaptation work, and nothing else. `CLAUDE.md` is the pointer stub `init-folio` writes (`@AGENTS.md`; in an index checkout whose root declares no layer, `bun run cat index:render` writes it); never put guidance in it ([`placement`](../../../../cat-harness/skills/kg/kg-core/placement.md), *The agent-file stub*) |
| `.claude/settings.json` + `.claude/mount-platform.sh` | the SessionStart hook that mounts the platform, so the skills and processes are on disk in every session |
| `index.config.json` | the mount of smart-base (and through it the platform), as in every guideline repository (§3) |
| its site, its checks, its `.gitignore` mount block, and an IG's site templates | what [`sub-kg-lifecycle`](https://github.com/litlfred/cat-harness/blob/main/skills/kg/graph-management/sub-kg-lifecycle.md) stage 10 (*its site*, *its checks*, `.gitignore`) and [`fhir-ig-create`](https://github.com/litlfred/fhir-harness/blob/main/skills/fhir-ig-base/fhir-ig-create.md) `new-repo` step 5 list, copied from the guideline repository named above |
| `<name>.json` | the layer declaration: its `assets` (above), `library/` as `library`, and one `l1-extraction` entry per extraction directory as each is created ([`recommendation-extraction`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/recommendation-extraction.md), *Declare every output directory*) — an undeclared one fails folio-assistant's `check:l1-complete` and with it the staging build |

An existing repository that lacks any of these gets them copied first, in
their own commit.

## What does not change

The import seam (`<name>/platform.ts`), the separation guard, `seed:ready`,
the two owner confirmations and the fresh-clone check are all
[`sub-kg-lifecycle`](../../../../cat-harness/skills/kg/graph-management/sub-kg-lifecycle.md)'s,
and apply to a SMART guideline unchanged.

## Anti-patterns

1. **A per-guideline harness.** smart-base is the harness; a guideline is a
   layer on it ([`smart-stack-layering`](smart-stack-layering.md)
   §"Two consequences").
2. **Creating under `WorldHealthOrganization/` first.** The forks are the
   staging ground (§4).
3. **Copying the WHO theme into the guideline** to make a page look right.
   It arrives by `needs`.
4. **Writing L3 into a bare repository**: FSH or CQL with no declared entry
   point, no mount and no `library/` (§6).
5. **Extraction output the declaration does not name.** An `l1-extraction/`
   directory, or a scenario directory beside the library entries, missing
   from `<name>.json` passes every check in the guideline repository and
   fails folio-assistant's QA working copy once the index mounts it (§6).
6. **A hand-written `CLAUDE.md`.** It is read by one vendor's agent and
   checked by nothing. Declare `AGENTS.md` and keep `CLAUDE.md` the generated
   stub (§6).
