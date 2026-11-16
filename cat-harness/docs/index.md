---
layout: default
title: Home
nav_order: 1
lang: en
description: "folio-assistant — a content-agnostic agent skills framework."
permalink: /
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

{% include landing.html %}

# folio-assistant
{: .fs-9 }


A content-agnostic agent skills framework for authoring rigorous content with a
large language model — scientific papers and books, WHO SMART Guidelines, and
FHIR Implementation Guides — backed by an MCP server, role-based access control,
and a typed content-object model.
{: .fs-6 .fw-300 }

<!--
  `View on GitHub` STAYS: it is authored content on this page, not site chrome,
  so removing the site-wide GitHub link does not remove it.
-->
[Get started]({{ '/docs/cat-harness/start/getting-started.html' | relative_url }}){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[Install]({{ '/docs/cat-harness/start/installation.html' | relative_url }}){: .btn .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/litlfred/folio-assistant){: .btn .fs-5 .mb-4 .mb-md-0 }

{% include harness_details.html %}

---

## Four things, in order

**1. The work plan is where you say what you are doing.**
Not a chat message, not a comment — [work items]({{ '/docs/cat-harness/guides/beans-and-todos.html' | relative_url }}), a committed
store any session or agent can read. Claim before you work so a sibling session
does not pick up the same item; a work item that turns out not to be wanted is
`scrapped`, with its reasons, never deleted.

```sh
cat-harness-tools/scripts/install-beans.sh && export PATH="$HOME/.local/bin:$PATH"
beans list                          # what is open
beans create "<title>"              # ...after checking the title does not exist
bun run cat beans:claim <id>        # claim it, visibly
```

**2. Make your first folio.** This repository is the *platform*; your content
lives in its own. One command scaffolds it — the manifests, the declaration, the
agent files and the link back here:

```sh
bun run cat init-folio --help
```

Then [Get started]({{ '/docs/cat-harness/start/getting-started.html' | relative_url }}) walks the first block through validate,
render and review.

**3. Know which kind of thing you are writing.** A *document* is structured
prose; a *paper* is that plus the block kinds whose assertion is a formal claim,
backed by Lean and typeset through LaTeX. The choice decides which blocks are
legal and which gates run: [Content types]({{ '/docs/cat-harness/concepts/content-types.html' | relative_url }}).

**4. The rest of the documentation.**
[All of it]({{ '/docs/cat-harness/guides/index.html' | relative_url }}) — the authoring guides, the architecture, the
publication workflow, the generated schema and skill reference. Read it when you
need it; the three steps above are the ones worth reading now.

When it is the *machinery* that has you puzzled rather than the authoring —
who does a thing, under which process, using which skill — start at
[The platform]({{ '/docs/cat-harness/platform.html' | relative_url }}).

---

## What is folio-assistant?

**folio-assistant** is the *platform* — it does not contain content. It provides
the skills, schemas, tooling, and an MCP (Model Context Protocol) server that an
LLM-driven agent uses to plan, author, validate, review, test, and publish a
**folio** of content that lives in a separate repository.

> **Separation of concerns.** This documentation describes the framework and how
> to use it. Where content appears in these pages, it is an *example*, never the
> canonical artifact.

```mermaid
flowchart LR
    A[Author + LLM] -->|chat / MCP tools| B(folio-assistant)
    B --> C{Content adapter}
    C -->|paper| D[Lean + LaTeX repo]
    C -->|WHO SMART DAK| E[L2 BPMN / DMN / Excel]
    C -->|WHO SMART IG| F[L3 FHIR / FSH]
    B --> G[Skills + Schemas + RBAC]
    D & E & F --> H[Published site / PDF / IG]
```

## Supported content types

folio-assistant is **pluggable** — each content type is handled by a content
*adapter* and a matching skill *package*. The currently supported types:

| Content type | Artifacts | Skill package |
|--------------|-----------|---------------|
| **Scientific papers & books** | Lean 4 formalization + LaTeX/Markdown | [`authoring-math`]({{ site.baseurl }}/docs/cat-harness/concepts/content-types.html#scientific-papers--books) |
| **WHO SMART Guidelines DAKs** | L2 artifacts — BPMN, DMN, Excel data dictionaries, personas | [`authoring-who-smart-guidelines`](https://litlfred.github.io/folio-assistant/smart-base/concepts/who-smart-content-types.html#who-smart-guidelines-daks-l2) |
| **WHO SMART Implementation Guides** | L3 FHIR resources, FSH, IG Publisher output | [`authoring-who-smart-guidelines`](https://litlfred.github.io/folio-assistant/smart-base/concepts/who-smart-content-types.html#who-smart-implementation-guides-l3) |
| **Others** | Pluggable — add a new adapter + skill package | [Adding a content type]({{ site.baseurl }}/docs/cat-harness/guides/new-content-type.html) |

The cross-cutting [`content-lifecycle`]({{ '/docs/cat-harness/concepts/content-types.html' | relative_url }}#the-content-lifecycle)
package (plan → author → validate → review → test → publish → feedback → retire)
applies to every content type. The
[publication workflow](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html) models it properly — as BPMN
swimlanes, with the roles, the HCI validation gate, and the shared work plan.

## Where to go next

- **[Installation]({{ '/docs/cat-harness/start/installation.html' | relative_url }})** — prerequisites, clone, `bun install`, capability check.
- **[Getting started]({{ '/docs/cat-harness/start/getting-started.html' | relative_url }})** — connect the MCP server to your LLM and run your first skill.
- **[Tutorial: Writing a paper with folio-assistant](https://litlfred.github.io/folio-assistant/folio-assistant-sci/guides/writing-a-paper.html)** — a full, LLM-driven walk-through with a mock chat session.
- **[Content types]({{ '/docs/cat-harness/concepts/content-types.html' | relative_url }})** — the formalism of each authoring domain.
- **[Publication workflow](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html)** — BPMN swimlane diagrams of the editing and publication processes: the HCI validation gate, who reviews what, and the shared work plan.
- **[Processes]({{ '/processes/' | relative_url }})** — every executable BPMN diagram, searchable, each with the workflow instances running it: open one to see where its token sits, what is stuck, and the work items and todos it names.
- **[Agent onboarding]({{ '/docs/cat-harness/guides/agent-onboarding.html' | relative_url }})** — orientation for an LLM agent dropped into a folio: first steps, finding skills, the content-object model, QA sidecars.
- **[Skills & roles]({{ '/docs/cat-harness/concepts/skills.html' | relative_url }})** — every skill and role, and how they work together with the LLM.
- **[Skill schema reference](reference/skills/)** — generated input/output contracts for every skill.
- **[TypeScript API reference](api/)** — the content-object model (`Block`, `Chapter`, `Paper`, builders, Zod constraints).
- **[Architecture]({{ '/docs/cat-harness/concepts/architecture.html' | relative_url }})** — adapters, MCP server, RBAC, the block model.
- **[The Knowledge Graph]({{ '/docs/cat-harness/concepts/knowledge-graph.html' | relative_url }})** — the subgraph taxonomy, which way the references run, and how repositories divide the work.
- **[The Harness]({{ '/docs/cat-harness/concepts/harness.html' | relative_url }})** — instantiation, the dependency walk, and what harnessing a directory obliges.

Two Skills are worth reading before the pages above, because everything else
assumes them: [`getting-started`](reference/skill-instructions/getting-started.html)
routes what you are actually trying to do, and
[`placement`](reference/skill-instructions/placement.html) settles where a new
node belongs before you make one.

## Documentation map

```mermaid
flowchart TD
    Home --> Install[Installation]
    Home --> GS[Getting started]
    Install --> GS
    GS --> Tut[Tutorial: writing a paper]
    GS --> CT[Content types]
    CT --> Skills[Skills & roles]
    CT --> WF[Publication workflow<br/>BPMN swimlanes]
    CT --> Guides[Authoring guides]
    Guides --> Paper[Papers: Lean + LaTeX]
    Guides --> DAK[WHO SMART DAK / L2]
    Guides --> IG[WHO SMART IG / L3 FHIR]
    Guides --> New[Add a content type]
    Skills --> Ref[Skill schema reference]
    CT --> Ref
    Ref --> API[TypeScript API reference]
    Home --> Arch[Architecture]

    click Skills "skills.html" "Skills & roles"
    click WF "publication-workflow.html" "Publication workflow (BPMN)"
    click Install "installation.html" "Installation"
    click GS "getting-started.html" "Getting started"
    click Tut "guides/writing-a-paper.html" "Tutorial: writing a paper"
    click CT "content-types.html" "Content types"
    click Guides "guides/" "Authoring guides"
    click Paper "guides/writing-a-paper.html" "Papers: Lean + LaTeX"
    click DAK "guides/who-smart-dak.html" "WHO SMART DAK (L2)"
    click IG "guides/who-smart-ig.html" "WHO SMART IG (L3 FHIR)"
    click New "guides/new-content-type.html" "Add a content type"
    click Ref "reference/skills/" "Skill schema reference"
    click API "api/" "TypeScript API reference"
    click Arch "architecture.html" "Architecture"
```

> The map nodes are clickable on the docs site.
