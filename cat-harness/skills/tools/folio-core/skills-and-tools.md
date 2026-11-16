---
name: skills-and-tools
description: >
  A skill states a capability generically; a Tool node carries the concrete
  mechanism. Read before writing or editing any skill, and whenever a skill is
  about to name a vendor, a CLI, a binary or an API endpoint.
governs:
  - cat-harness/tools
---

# Skills and Tools — the skill says what, the Tool says how

**A skill is a capability stated generically. A Tool content node is one
concrete way to exercise it.** One skill may be satisfied by several Tools; a
Tool names the skills it satisfies through its `satisfies` field.

This is the standard operating procedure for every skill in the harness, not a
guideline for new ones. A skill that names GitHub, names the `beans` binary, or
embeds a shell invocation **has swallowed a Tool**, and the swallowing is what
makes a layer un-portable.

Schema for the Tool node: `schemas/tools/tool.ts` in the tools layer; carrier
convention (Zod authoritative, JSON-LD and JSON Schema generated) in
[`directory-conventions`](../../kg/kg-core/directory-conventions.md) §"What lives in the
`schemas` graph".

## The test, in one line

> **Would this sentence still be true on a different forge, a different
> binary, a different machine?** If yes it is skill. If no it is Tool.

Applied:

| sentence | verdict |
|---|---|
| "Open a change proposal as soon as there is one commit to hang it on." | **skill** — true anywhere |
| "`gh pr create`", or the REST call it wraps | **Tool** — one forge, one transport |
| "Claim the item before you work, so a sibling session does not pick it up." | **skill** |
| "`beans update <id> --status in-progress`" | **Tool** |
| "If the CLI is unavailable, the store is still writable by hand." | **skill** — the *fact* is portable |
| "Edit the `status:` line in the front matter of `beans/defs/<id>--*.md`." | **Tool** |

That last pair is the one people get wrong. **Having a fallback is a property
of the capability; performing the fallback is a mechanism.** The skill must say
a fallback exists and when to reach for it, because an agent that does not know
one exists will stop. What it must not do is spell out the edit.

**When the mechanism is itself a procedure**, it is the Tool's subprocess
(§"A Tool may describe its own subprocess"). The Tool node names the BPMN in
`subprocesses` (process ids, checked by `check:tools`), conventionally under
`processes/tools/`; the skill keeps the portable sentence. See
[`bpmn-processes`](../../process/workflow/bpmn-processes.md).

## Every bean skill has (at least) two Tools

The work-plan skills are the worked example:

| Tool | when |
|---|---|
| `beans` CLI | normal case — installed via `scripts/install-beans.sh` |
| hand edit / `scripts/beans-fallback.ts` | CLI absent or cannot be installed here |

Both satisfy the same skills. Neither is the skill. A fresh container has no
`beans` on `PATH`, so an agent that only knows the CLI reads the plan and
touches nothing. The fallback is a second Tool with equal standing, and the
skill must present it that way.

**An external project is a candidate Tool before it is anything else.** When
somebody asks whether another project could do a skill's job — Beads for the
work plan, say — that survey is research, not a proposal and not a skill edit:
it files under `<instance>/docs/research-and-analysis/` per
[`placement`](../../kg/kg-core/placement.md), dated, with each project's health measured rather
than recalled (for example `research-and-analysis/prior-art.md`). Only if a candidate is adopted does it become a Tool node, with the
`selection` its derived alternatives call for, below.

## Substitutable Tools are derived, and each says how to choose

A pair like that is **substitutable**: same job, different mechanism, pick one.
Nobody declares it. Two Tools are alternatives when they **satisfy a common
skill AND have the same I/O signature** — the same input names, types and
required flags, the same outputs, the same `renders` and `maintains`
(`deriveAlternatives` in `schemas/tools/tool.ts`). A shared skill alone
is not enough: most skills with several Tools have complementary ones, steps
rather than choices, and their I/O is what tells them apart.

So the discipline moves to the ports. **Type and name a port for what it
really takes and gives.** A CSV reader and a workbook reader typed `Text`
would derive as alternatives; `DelimitedTextPath` and `WorkbookPath` keep them
apart. Two generators whose output is a bare `pages` would too; naming each
output for what it writes does not.

Each Tool with a derived alternative then carries `selection` —
three fields, all required together (`check-tools` fails one without it):

| field | answers |
|---|---|
| `when` | the case this Tool is the right answer to |
| `limits` | where it stops, and which sibling picks up |
| `cost` | what having it available costs |

**Do not skip `limits`**: without it an agent reaches for the tool and discovers the
boundary by failing. State it even when it is "none", for the same reason
`install.none` exists — so "no limits" is distinguishable from an unfinished
record.

**`cost` is not `install`.** `install` says how to obtain the tool; `cost` says
what having it costs — CI minutes, a wheel needing a C toolchain, a network
round trip. Two Tools can be equally easy to install and very differently
expensive to keep.

**Not in `description`.** It is projected verbatim as the MCP tool
description and into the exported graph, and answers "what does this do";
comparative prose about cost does not belong there, because it would degrade
the surface an agent reads when choosing among tools.

### Sharing a skill does NOT make two Tools alternatives

Most skills with several Tools have complementary ones: `workflow-list`,
`-start`, `-next`, `-gate` and `-complete` are five *steps* of `process-state`,
not five ways to perform it. Only Tools that also share an I/O signature are
alternatives, and `scripts/check-tools.ts` checks that the relation is
**mutual**, because a one-sided one means an agent arriving at the silent end
never learns a choice exists. Keying substitutability on a shared skill alone
would demand comparative prose where there is nothing to compare, and an author
obliged to write it writes noise.

### The worked pair: stdlib vs extensions

`ingest-stdlib` and `ingest-extended` both satisfy `library-ingestion`, and the
split falls where the dependency boundary actually is rather than on principle:

| | `ingest-stdlib` | `ingest-extended` |
|---|---|---|
| install | nothing (`install.none`) | PyMuPDF, pypdf + Pillow, tesseract |
| covers | archives, CSV/spreadsheets, technical metadata, content routing | PDF outline, page text, OCR, images |
| runs in CI here | **yes** | no — CI installs `ruff` and nothing else |

Reading a zip's central directory, sniffing magic bytes and parsing an xlsx's
XML are all in the Python standard library; rendering a PDF's text layer is not
and never will be. An agent picks by **what the machine has**, not by what the
document is — and the stdlib arm refuses a PDF outright rather than
half-ingesting one, so the choice is never made silently.

This is also the shape to reach for whenever a capability has a heavyweight
backend: two Tools, one skill, the dependency posture legible on each node,
instead of a repository-wide yes/no that no reader of a skill can see.

## The harness assumes no MCP — and knows how to emit one

**`agentic-harness` must work with no MCP server running.** Everything it needs
is files in directories the layer declares: skills in the `kg` graph, Tool
nodes beside them, the work plan in the `beans` graph. An agent with nothing but
a filesystem and `<name>.json` can read all of it.

MCP is **acknowledged as a future transport, not assumed as the present one.**
Where a downstream layer runs a server, `skill_list` / `skill_fetch` /
`work_plan_prime` are a convenience over the same files — and `ToolDefinition`
accordingly declares `invoke.mcp` as **one optional arm** beside `shell` and
`container`. A Tool whose *only* invocation is an MCP call is not usable by the
harness that defines it.

**Editing a skill goes through `skill_update`, not a raw file write.** Where the server runs, it is the write side of
`skill_fetch`. It refuses unless every gate passes:

- the skill resolves as `skill_fetch` serves it;
- the file is tracked in this repository, so not another layer's skill and not a mounted copy;
- the file is not generated;
- a policy grants `skill-update` to the actor (no default policy does);
- the file is unchanged since it was read;
- the front matter parses and keeps the skill's name;
- every link the edit adds resolves.

A gate that cannot decide refuses. The Tool writes the working tree, and the
caller commits the change.

**That is a statement about dependency, not about ignorance.** MCP is an
*output* of this harness: [`mcp-projection`](mcp-projection.md) is how an agent
takes a Tool node describing a CLI and produces a working MCP service from it,
[`mcp-assembly`](mcp-assembly.md) covers composing several into one namespace,
and [`mcp-contract`](mcp-contract.md) checks the result still matches its
sources. The harness is the thing that knows the mapping; it just does not need
the result in order to run.

It is what makes the harness bootstrappable: the layer that defines what a Tool *is* cannot require a tool
server to read its own definitions without arguing in a circle. It is also why
sovereign-compute and air-gapped operation are reachable later without a second
design — a layer with no server loses a transport, not a capability.

So when this skill says "reach a Tool through the graph", the floor is: read
`<name>.json`, find the `kg` entry, open the directory. Anything richer
is an optimisation a layer may offer.

## GitHub is a Tool node, not a layer

The PR-choreography skills — `prepare-merge-auto`, `pickup`, `watch`,
`coordinate` — assume a forge, but most of their text is portable: "pull
request", "PR", "GitHub" as a noun. Only a few lines are concrete invocations.
So forge-specificity is **isolated at the Tool layer**: the skills stay in the
harness, stated generically, and Tool nodes carry the invocations — one per
forge operation (table below). Adding another forge is more Tool nodes
satisfying the same skills, not a repository or a fork.

### The forge operations, one Tool node each

**One Tool node per forge operation**, using the fields Tools already have. A
skill names the
*operation* in neutral words, and this table is where an operation meets its
nodes. An agent picks the node for the forge the checkout's remote is on; each
pair is a derived alternative carrying `selection` (`check:tools` holds it).
These Tool nodes sit in the opt-in `integrations` sub-graph
(`integrations/tools/`): a layer that uses them lists `cat-harness.integrations`
in its `enableSubgraphs`.

| operation (as a skill names it) | GitHub | GitLab |
|---|---|---|
| *list change proposals* | `github-pr-list` | `gitlab-mr-list` |
| *read change proposal* (body, comments, reviews) | `github-pr-view` | `gitlab-mr-view` |
| *read change proposal* (check runs) | `github-pr-checks` | — |
| *list changed files* | `github-pr-files` | `gitlab-mr-files` |
| *comment on change proposal* | `github-pr-comment` | `gitlab-mr-comment` |
| *request review* | `github-pr-request-review` | `gitlab-mr-request-review` |
| *resolve review thread* | `github-pr-resolve-thread` | `gitlab-mr-resolve-thread` |
| *list branches* | `github-branches` | `gitlab-branches` |

A dash is a known gap. Two GitLab nodes run a script rather than `glab`
directly: `glab mr diff` has no `--name-only`, so `gitlab-mr-files`
reads the paths out of the raw diff; and `glab mr update --reviewer NAME`
replaces the reviewers, so `gitlab-mr-request-review` passes `+NAME`, which
adds one. Its names are `GitLabUsername`s, since GitLab usernames do not fit
`Login`.

Branches alone are also listable with `git ls-remote --heads origin`, which
needs no forge.

**Subscribing to a change proposal's activity is not a forge operation.** It is
the session platform's (in a Claude Code remote session, its PR-activity
subscription), so no forge Tool node offers it, and a skill says so rather than
naming a forge for it.

### A Tool may describe its own subprocess

When one mechanism
takes several steps, they belong to **the Tool**, not to the general skill: the
Tool lists `subprocesses` (process ids, each the stem of a `.bpmn` the checkout declares),
and a general diagram's call activity is bound by it. **General skills name the
Tool, never its steps.** Example: `render-kg-to-cdn` is the general step
(render a Knowledge Graph for a CDN at a publication root URL; output a status
and a message), and `gh-pages` is one Tool for it whose subprocess is
bootstrap-tools' `render-kg-to-github-pages.bpmn` — declared below the harness,
so the reference points down.

### Vocabulary — name the concept, not the vendor's word for it

GitHub calls it a pull request; GitLab calls it a merge request; Gerrit calls it
a change. A skill that says "pull request" has picked one vendor's noun, which
is a milder form of the same defect.

**Prefer the neutral term on first use and the local term thereafter**, rather
than scrubbing every occurrence — a skill written entirely in invented
vocabulary is unreadable, and unreadable is worse than mildly GitHub-flavoured.
The rule is that an agent must never have to *resolve a vendor noun to act*: it
is fine for a skill to say "pull request (PR)" once and use PR after it; it is
not fine for the only statement of what to do to be `gh pr create`.

## Writing or editing a skill — the checklist

1. **Grep your own draft** for vendor names, binaries, endpoints, file paths
   under a tool's control, and flag characters. Each hit is a Tool that has not
   been declared.
2. **State the capability first**, in a sentence that survives the mechanism
   being replaced.
2b. **If an input reaches a command line, give it a type that cannot be a
   payload** — and put free prose on stdin. See
   [`untrusted-input`](../../conduct/conduct-core/untrusted-input.md); `check:tools` fails CI on a
   violation.
3. **Say a mechanism exists and where to find it** — never inline it. A Tool is
   reached the same way a skill is: resolve the `kg` graph from the layer's
   declaration and read from the directory it names. Not a remembered
   path, and — see below — not necessarily a tool call.
4. **Say when each Tool applies** if there is more than one, because choosing
   between them is judgement and judgement is skill.
5. **Name what happens when no Tool is available.** Three states, as everywhere
   here: the Tool worked, the Tool is absent and here is the fallback, and *we
   could not tell* — which is never rendered as success.

## The Tool schema, and the remaining debt

**`schemas/tools/tool.ts`** (in the tools layer) defines a Tool, `tools/` holds
the nodes, and `bun run cat check:tools` fails when a `satisfies` names a skill
that does not exist.

`ToolInput.repeated` marks a list input (rather than a list type per scalar
type, which would multiply the shared `$defs` and break the identity property
the shared vocabulary exists for). `invoke.inProcess` names a
TypeScript function for a Tool with no shell equivalent; it is runnable by the
harness directly, and is the projection *source* rather than something to
proxy, so the refusal of an mcp-only Tool does not reach it.

**Many skills still carry their invocations inline.** Most of the remainder is
fine — a great many skills are pure judgement (`interaction-modality`,
`one-voice-style-guide`) and have no mechanism to name. `check:tools` reports
the coverage count rather than failing on it, for exactly that reason. What it
cannot tell you, and what needs a human eye, is which of the uncovered skills
*describe an action* — those are the ones whose mechanism is still swallowed.

### A `satisfies` edge is checkable against the skill's own contract

**`satisfies` is the one part of a Tool node a schema cannot check, and it was
being written on judgement alone.** `bun run cat check:tools` compares a Tool's
`io` against the input contract of every skill it claims — the contract the
skill names in its own front matter (`input:`), never one found by directory
name. Two rules: **every `required` property of the contract must
appear as an input on the Tool**, and **where a Tool input and a contract
property share a name, their JSON types must agree** (an `integer` port may
serve a `number` property). If either fails, the Tool cannot exercise the skill
and the edge is false.

**What is compared, and what is not.** A skill's contract is free-form JSON
Schema; a Tool's `io` is named ports referencing shared `$defs` IRIs, so they
meet only at names and at the JSON type each port's vocabulary type projects
to. The type rule is weak — nearly every contract property here is a bare
`{"type": "string"}` — but not vacuous: it catches an `array` contract served
by a `string` port, which the name rule passes.

A mismatch that is "only" a naming difference — `path` against `targetPath` — is
a **finding**, not a false positive to suppress. Two names for one input, across
a skill and the Tool claiming to implement it, means an agent reading the
contract cannot call the Tool.

**Three states, as everywhere.** No contract (the common case, not a defect) is
`undefined`; a contract requiring nothing is `[]` and passes; a contract that is
declared but missing or unparseable is reported and **fails**, never counted as
agreement. An external `https://` contract is not fetched by this offline check.

For example, a Tool that validates a `.po` against its `.pot` does not satisfy
`content-validate`, whose contract requires `targetPath`: validating
translations is not validating a folio's content.

### Which uncovered skills actually need one — `bun run cat tools:coverage`

The count alone does not say which. A grep for shell blocks over-reports, because
a skill may legitimately QUOTE a command while stating its capability
generically.

The corpus carries a better signal — **BPMN task type**. A process step is a
`serviceTask` (runs without a person) or a `userTask` (performed by one), and
the diagrams already say which. Triaged on that, plus an I/O contract under
`schemas/skills/`, the tiers are **A** (automation evidence), **B**
(userTask-only), **C** (ambiguous) and **D** (nothing), and only C needs a human
read.

**Run it for the numbers; do not quote them from prose**: a count in prose is a
claim that nothing re-checks, and it drifts unnoticed.

Many skills are both: two activities name `interaction-modality`, a
`serviceTask` that reads the preferences file — a mechanism — and a `userTask`
about how to frame a question — judgement.

> **The question is not "is this skill a Tool?" but "which PART of it is."**

A skill with both halves is not mis-modelled. Migrating it is a **split**: the
mechanical half becomes a Tool, the judgement half stays as prose. Expecting a
clean move makes the migration look bigger than it is.

So when you write or edit a skill: follow the checklist above and reference a
Tool. When you read one that inlines `gh pr create` or `beans update`, that is
the debt, not the pattern — do not propagate it.

Authoring a Tool node: `tools/<id>/<id>.json`, one folder per Tool, a
`"$schema": "tool-definition/v1"` document validated against the Tool schema;
the loader lives in the tools layer. `io` ports reference the shared vocabulary
in `schemas/tools/tool-types.ts` by its type name (`"$type"`) — never a
free-form string, because a reference nothing checks is eventually wrong.

For the end-to-end guide on authoring, implementing, packaging, and registering
concrete tools across separated repositories, see [`tool-authoring`](tool-authoring.md).
For runtime conventions, test preloading, and TypeScript configuration, see
`bun-use` (opt-in `cat-harness.sdlc`).

## Covered is not reachable — see its own skill

A skill can be satisfied by the **neighbours** of its mechanism while the
mechanism itself is reachable from nothing, and `check:tools` reports it as
covered and is right to. That discipline, the two questions it keeps apart, what to do when you meet one,
and the two reasons *not* to write `maintains`:
[`covered-is-not-reachable`](covered-is-not-reachable.md).
