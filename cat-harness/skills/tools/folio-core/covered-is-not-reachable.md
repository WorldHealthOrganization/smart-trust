---
name: covered-is-not-reachable
description: >
  A skill can be satisfied by the neighbours of its mechanism while the mechanism
  is reachable from no Tool node. Read before concluding from check:tools that a
  command is reachable, and before adding a Tool node or a `maintains` claim.
---

# Covered is not reachable — and `check:tools` cannot tell you which

**A skill can be satisfied by the *neighbours* of its mechanism while the
mechanism itself is reachable from nothing.** `check:tools` reports the skill as
covered and is right to: coverage is a relation between a Tool and a **skill**,
never between a Tool and a command.

For example, `kg-export` can be satisfied by a publishing node, a serving node
and schema carriers while no node runs an export; `translation-manager` by
extract, inject, status, signoff and validate nodes while none reaches the
round-trip QA.

## The two questions, kept apart

> **"Does this skill have a Tool?"** — `bun run cat check:tools`, and
> `bun run cat tools:coverage` for which of the uncovered ones warrant one.
>
> **"Is this command reachable by asking the graph?"** — no instrument answers
> this yet; it has to be measured by hand.

**A skill showing as covered is not evidence that its code is reachable.** Do not
use the first question to answer the second: the cause of an invisible
mechanism is structural, because nobody asks the second question.

## What to do when you meet one

Add the node for the mechanism. Then two things not to do:

- **Do not widen an existing node's `satisfies`** to make the gap look closed.
  That makes the graph assert a node does something it does not.
- **Do not give the new node the same I/O as an existing one** unless it
  really is a substitute. Alternatives are derived from a shared skill plus an
  identical I/O signature (`deriveAlternatives`), and export-then-publish-then-
  serve are complementary steps, not competing arms.

## Two reasons NOT to write `maintains`

**`maintains.artefact` is a single path.** A generator that writes one file per
subject — `gen-skill-docs`, `gen-schema-docs`, `gen-block-jsonld` — has no single
artefact to name. A declaration naming one file out of tens is worse than
absent: **it looks like a complete provenance record.**

**A `maintains` claim asserts the artefact is published.** Verify that by reading
the build, not by assuming: `cat-harness/ns.jsonld` is a real claim because
`.github/workflows/docs-site.yml` writes it. Remove a claim in the same change
that retires its artefact: a claim outliving its artefact is the same 404 from
the other side. An artefact nobody publishes is exactly the 404 the
drift check exists to prevent.

### And the drift check only covers its own producer

`kg:schema:check` reconciles `maintains` both ways, but its `unproduced`
direction runs **only over artefacts whose declaring Tool invokes
`bun run cat kg:schema`**, because a maintained artefact is not necessarily
produced by the schema exporter. So **a `maintains` claim on any other producer's
artefact is unchecked**: it can rot to a 404 and nothing notices. The fix — not
yet built — is to assert every declared artefact is present after `_site/` is
assembled, with could-not-determine kept distinct from present.

## Adding a Tool type is fail-closed, and that is deliberate

`check:tools` refuses a command-line input whose type could express a shell
payload, against the membership list in `schemas/tools/tool-types.ts`. **A newly added
type is absent from that list and therefore unsafe by default.** Adding it is a
deliberate step, not an oversight to route around — and the fix for an enumerable
input is *the enum*, never a looser type that happens to pass.

Where the enum duplicates a union declared elsewhere, guard it in both
directions: `satisfies` catches a member that stops being valid, and a
conditional type catches a member added to the union and not here. An unavoidable
duplicate is fine; an unchecked one is not — see
[`directory-conventions`](../../kg/kg-core/directory-conventions.md).

## Five cases, most invisible to the instruments

| case | what exists | what is missing | what sees it |
|---|---|---|---|
| 1 | a skill | a Tool | `check:tools`, `tools:coverage` |
| 2 | a skill **and** Tools for its neighbours | a Tool for the mechanism | nothing — this skill |
| 3 | a mechanism | **any skill stating the capability** | nothing |
| 4 | a skill, a mechanism, a Tool | **a command** — it runs in-process only | nothing |
| 5 | a skill, a mechanism, **a command** | anything that *invokes* it | nothing |

**Case 5 is case 4's inverse** — the entry point is present and the callers are
absent — and it is discussed under [§Reachability is PLURAL](#reachability-is-plural--which-caller-should-this-have-presumes-one)
below, because the useful question there is *how many dispatch points this
should have*. A script whose only references are its own usage string and a line
of skill prose telling a human what to type is case 5: its mechanism is inlined
in prose.

## The third case: a mechanism with no skill at all

A generator that renders theme and avatar nodes into the site's stylesheets is a
textbook `maintains` pair, and yet no generic skill need state the capability.
`tools:coverage` cannot see this: it enumerates **skills** and asks which lack
Tools, so a capability nobody has stated is absent from the list it walks.
([`site-presentation-assets`](../../ui/theming/site-presentation-assets.md) is
the skill that now states that one.)

`satisfies` requires at least one skill, so a node cannot be written without one:

- **Do not stretch a neighbouring skill to make the node validate.** The
  resulting `satisfies` edge is simply false.
- **Do not write the skill as a wrapper for the command.** A skill states a
  capability generically and names no script; one that exists to give a script
  somewhere to point is a Tool with front matter.

Authoring the skill is a **design act** — a claim about the platform's capability
vocabulary, inherited by every dependent layer — so it goes to the owner rather
than being decided in passing. Write the skill before the nodes. Once the gap
is closed, remove any note announcing it: an agent that believes a stale gap
either avoids the capability or rebuilds it.

## The fourth case: a mechanism with no command, reachable in-process only

Cases 1–3 are about a missing *node* or a missing *skill*. This one has both, and
is still unaskable: **the mechanism has no command, so no CI job and no person can
run it.** For example, `checkFolioProfile` in `pipeline/profile-check.ts` catches
what schema validation structurally cannot — a block valid against its own
schema but wrong for the folio's content profile, because adapters partition
disjointly while profiles nest. Its only caller is the MCP tool registration,
so it is reachable by an MCP-connected agent and by nothing else: not a gate,
not a sweep, not a person at a shell. Every
instrument that asks "can this be reached" answers yes.

> **Ask which callers, not whether.** "Reachable from MCP" and "reachable from CI"
> are different claims, and a durable verdict needs the second.

### Giving a library function its first command

Prefer a `qa-sweep` axis to a one-off check script: **a sweep verdict is durable
where a printed one is not** — a printed verdict cannot distinguish "wrong since
it was written" from "broken in the commit under review".

Watch the library's defaults. `checkFolioProfile` resolves through
`readFolioProfile`, which turns an undeclared profile into `"paper"` — correct
for a validator, which validates against the wider vocabulary, and wrong for a
reporter, which must use `readDeclaredFolioProfile` or report `pass` on a folio
that declares no content type at all.

> **A library's defaulting is usually what erases the third state.** When you give
> a library function its first entry point, the value it resolves for its own use
> is not the value a verdict may report. Check which of the two you are reading —
> by running it, not by reading it.

## Reachability is PLURAL — "which caller should this have?" presumes one

One mechanism can have several dispatch points, so the question to ask is not
*which caller should this have* but:

> **What should be able to start this — and is each of those a trigger or a Tool?**

The two are different objects, and which one a dispatch point is follows from who
initiates:

| dispatch point | it is a | because |
|---|---|---|
| a named command | **Tool** | a caller invokes it; that is what a Tool node IS |
| a BPMN activity | **trigger** | the process fires it when the step is reached |
| a QA sweep axis | **trigger** | the sweep fires it per subject |
| a schedule or a watcher | **trigger** | time or an event fires it |

None of them is an alternative to another, by the same argument
`deriveAlternatives` makes about sharing a skill: they are different ways the
same work gets started.

**Enumerating the dispatch points also finds the ones already built.** For each
candidate, check whether it exists (an activity may already carry the skill, so
`workflow_next` already hands it to an agent), whether it is possible (a sweep
cannot run a check whose verdict originates outside it), and only then what is
missing. Presented as a choice, the options waste proposals; enumerated as
dispatch points, they are a short audit with one action.

**Read the mechanism's entry point before proposing dispatch points.** A name
and a position in a diagram say what something is for; an argument list says
what it does — for example, whether it performs a check or only records a
verdict somebody else produced.

## The same failure one level out: a KIND, not a mechanism

Ask what is missing of a **kind of node** and the same mistake appears: counting
`kg-qa` sidecars over the work item store, finding zero, and calling work items unaudited
when several gates audit them. **Coverage is a relation between an instrument and
the question it was built for** — see
[`audit-coverage`](../../kg/kg-core/audit-coverage.md), with
`bun run cat audit:coverage` as the second question.
