Knowledge graphs are managed in git repositories, made of self-documenting JSON
and JSON-LD. Content is rendered in several formats for downstream knowledge
products and for public, clinical and personal health applications.

| kind | the question it answers | examples on the slide |
|---|---|---|
| **Tool** repos | how can we compare deterministic and agentic workflows in well-defined processes? | `who/smart-kg-tools`, `ohs/folio-asst-tools` |
| **Content** repos | how can agentic workflows support quality-assured, evidence-based authoring and publication, and how can agentic access to knowledge assets keep trusted provenance without overloading existing systems? | `ohs/harness`, `ohs/folio-asst`, `who/ref-arch`, `who/iris`, `who/smart-hiv`, `kenya/smart-hiv`, `who/data-hub` |
| **Test** repos | how can we adjudicate, quality-control and compliance-test model performance in several modalities? | `who/smart-imz-test`, `kenya/smart-hiv-test` |
| **Consumer apps** | how can they be assured in agentic public-health and clinical workflows? | `app:ohs-*`, `app:anthropic-mcp`, `app:turn.io` |

**The colours are slide 1's.** Each repository kind is filled in the colour of
a bar under the SMART levels on slide 1: tool repos in *tooling*'s colour, test
repos in *test data*'s, consumer apps in *apps*', and content repos unfilled
like *content*. So the slide ties each kind to a span of levels: content to L1
to L3, tools to L3 and L4, tests to L2 to L4, apps to L4.

**Source:** [Repo taxonomy](architecture/repo-taxonomy.html).

> **Misaligned — target, not current:** none of these repositories exists under
> these names. Today it is one monorepo, `litlfred/folio-assistant`, with
> layer directories (`cat-harness`, the content core, the DAK layer,
> the IG layers, the IRIS replica, …).
> [Current state](architecture/current-state.html) is the measured picture, and
> the slide is the [future state](architecture/future-state.html).
