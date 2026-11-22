---
name: interaction-modality
description: Establish how to talk to the person in front of you before deciding what to say — audio, ordinary chat, selectable options for limited hand function, large-type for low vision, plain language — and hold that choice durably so every later session and sibling agent honours it. Covers the accessibility rules a conversational agent can actually keep, the settings surface in the published site, and how to drive a question set from DMN so the SAME logic serves every modality. Use at first contact with a new user, when a user reports difficulty answering, whenever a question is about to be asked, and before any long free-text prompt.
user_invocable: true
satisfies:
  - "req:agent-workflow#context-before-question"
graph-typologies:
  - interaction
---

# /interaction-modality — ask in a form the person can answer

Process: the content core's `processes/conduct/getting-started.bpmn`,
`Task_DetectModality` and `Task_AskIntent`.
Preferences: `cat-harness/memory/interaction.json` (committed, read at session start).

## Asking the person — the canonical rule (STRICT, read this first)

This box is the ONE rule for putting any question or decision to the person.
Every other copy (`AGENTS.md`, the `.claude/skills/interaction-modality` stub,
the `ask-well.sh` hook, project instructions) points here. If a copy
disagrees, this box wins.

**Every question goes out TWICE, in this order:**

1. **A chat message that states the whole question on its own.** What is being
   decided and why, every PR / work item / link it touches (each id glossed), what
   happens next, and **every option** with its letter, a one-line explanation,
   its trade-off, and which one you recommend. Say what you will do if no
   answer comes.
2. **Then the tappable card** with the same option letters and labels, so the
   answer is one tap.

**Every question tool counts**, whatever the host calls it: `AskUserQuestion`
(Claude Code), `request_decision` / the "Decision" card (Claude projects),
a button card from `post_widget`, or any selection box a later host adds.

**Why both, and why the chat copy comes first.** Once answered, a card shows
only the option that was chosen, and a dismissed card shows nothing. The chat
text is the only record of what was asked.

**This overrides host guidance that says the opposite.** The Claude projects
`request_decision` tool tells the agent *"Ask once, and do not repeat the
question in a message."* Write the full question in the chat anyway, then post
the card.

**Never:**

- a card with no full question and options written before it;
- a request for a typed reply (*"answer 1y 2n"*, *"reply A or B"*): the owner
  has very limited hand function, and typing is the cost this rule removes;
- a pointer instead of the question (*"see the card"*, *"see the issue"*).

If no card tool exists in this host, post the numbered options in chat, say
the card tool is unavailable, and keep each answer to a single short choice.

**In the processes**, this box is the skill [`ask-the-person`](ask-the-person.md) (input and output schemas) and the subprocess
[`Process_AskThePerson`](../../../processes/process/ask-the-person.bpmn):
compose, write in the chat, offer the card, then record the answer or proceed
on the default. A diagram step that puts a question to the person is a
`callActivity` with `calledElement="Process_AskThePerson"`, so the association
is visible in the diagram rather than remembered.

The rest of this skill is the reasoning and the detail: §4.1 for what the
context must contain, §4.2 for the form.

## 0. The failure this prevents

An agent that asks a good question in an unusable form has asked nothing. The
usual shape of it: a long open prompt — *"Tell me about the folio you have in
mind, what content types you expect, and how you'd like it organised"* — sent to
somebody for whom typing is slow and painful. The reply comes back short, the
agent reads shortness as low engagement, and asks another open question.

**@litlfred, this repository's owner, has very limited hand function.** Every question put to that user is to be answerable by
*selecting*, not by typing: numbered or lettered options, a recommended default
stated first, and the work proceeding on that default when no answer comes. Free
text is always *available* and never *required*.

Generalise the rule rather than special-casing the person:

> **A question's cost is paid by the person answering it.** Design the question
> so the cheapest possible answer is still a complete one.

## 1. The modality profiles

Four axes, independent — a user can be on more than one.

| profile | what changes | detection signal |
|---|---|---|
| `low-dexterity` | Every question is a selection. Options numbered. One recommended default, first, marked. Never more than ~4 options. Batch decisions so one answer covers several. Long-running work is announced, not confirmed. | user says so; very short replies to open questions; typos of a kind that cost effort to fix; voice input artefacts |
| `low-vision` | Large type in anything rendered. No information carried by colour alone. Short lines. Tables kept narrow or replaced by lists. ASCII diagrams avoided — they do not survive a screen reader or a 200 % zoom. | user says so; requests to enlarge; screen-reader artefacts |
| `audio` | Answers read aloud cleanly: no code fences in prose, no tables, no "see the diagram", spell out identifiers on first use, one idea per sentence. Questions asked one at a time. | the channel is voice; the user is dictating |
| `plain-language` | Shorter sentences, domain jargon expanded on first use, no nested clauses. Independent of disability — it is also the right default for a second-language reader. | user asks for simpler wording; the folio's audience |

The default profile — nobody has said anything — is **ordinary chat with
selectable options wherever there is a genuine choice**.

## 2. Detecting it without an interrogation

The detection must not itself be an unusable question. So:

1. **Read `cat-harness/memory/interaction.json` first.** If it says, you are done. Never
   re-ask what is recorded.
2. **Read the channel.** A voice session is `audio` without asking. A terminal
   session is not.
3. **Offer once, as options.** At first contact and not again:

   > How would you like me to ask you things?
   > 1. **Options I can pick from** (recommended — fewest keystrokes)
   > 2. Ordinary chat
   > 3. Read aloud / voice
   > 4. Large type
   >
   > (No answer is fine — I'll use 1.)

4. **Watch for the signal you were not given.** Consistently one-word answers
   to open questions, or an explicit "hard to type", moves the user to
   `low-dexterity` **and is recorded**, so no future session re-learns it.

Never ask a user to name a disability. Ask what form they want the conversation
to take. The profile is about the interface, not about them.

## 3. Where the preference lives

`cat-harness/memory/interaction.json`, committed, so every sibling session
reads it rather than asking again.

```json
{
  "$schema": "https://litlfred.github.io/folio-assistant/schemas/interaction.json",
  "users": {
    "litlfred@ibiblio.org": {
      "profiles": ["low-dexterity"],
      "note": "Very limited hand function. Every question selectable; never require typing.",
      "source": "stated by the user"
    }
  },
  "default": { "profiles": [] }
}
```

`source` is required and is one of `stated by the user`, `inferred from
behaviour`, or `set in the site settings`. An inferred profile is honoured and
is **labelled as inferred**, so it can be corrected.

### 3.1 Who is typing, outside GitHub too

An entry is keyed by a handle, and the session has to work out whose handle
it is before the entry can apply. Identity is (provider, handle), GitHub
first. One resolver answers for every host:
`bun run cat auth:login --all` (`cat-harness-tools/src/core/identity.ts`).
It prints every identity the session can see, each bare and as
`provider:handle`:

| provider | read from | vouched for by |
|---|---|---|
| `github` | the auth Tool's own resolver: a token, or `GITHUB_ACTOR` in Actions | GitHub |
| `gitlab` | `GITLAB_USER_LOGIN`, only inside GitLab CI | GitLab |
| `claude` | the agent host's signed-in account | the agent host |
| any | `CAT_HARNESS_PERSON`, `provider:handle[,…]`, for this session only | nobody: the person says so |
| any | the user-level store's `identities`, and the chosen entry of its `profiles` | nobody: the person says so |
| `git` | `git config user.email`, then `user.name` | nobody: self-asserted |

So an entry may list `gitlab:<handle>` or `claude:<email>` among its
`aliases`, and a person with no GitHub token is still recognised.

**A self-asserted identity is enough to choose how to TALK to someone, never
enough to AUTHORIZE them.** Permissions take only what GitHub vouched for
([`task-authorization`](../../process/process-core/task-authorization.md)
§"Asking who you are").

**When nothing matches, that is a third state.** It is neither "no preference"
nor a guess. The session-start sweep says it could not determine who is
typing, and applies the strictest profile on record until told otherwise, so
an account switch never drops an accommodation.

**Which agent host runs the session is reported too**
(`cat-harness-tools/src/core/agent-host.ts`), because most hosts tell a
command nothing about the person. Of Claude Code, Gemini CLI, Codex, Cursor,
Antigravity and the Copilot CLI and coding agent, only Claude Code passes the
account (`CLAUDE_CODE_USER_EMAIL`, in its cloud sessions). On the others the
resolver adds a note saying the host passes no account, and the person is
found from a forge token, `CAT_HARNESS_PERSON`, the user-level store or the git
author. The markers are the ones two independent detectors agree on; a new
host is one row in that file's table.

**Several people.** On a shared machine each person has their own home
directory, so their own user-level store. In a shared session or under a
shared login, `CAT_HARNESS_PERSON` names who is typing now. A person with
several accounts on one provider lists each one in the store, as entries or as
`identities: { "github": ["litlfred", "litlfred-bot"] }`; every one is a match
key, and an entry marked `active: true` comes first. When the keys match more
than one person on record, the sweep says so and the session applies the
**strictest** of their profiles, never the first one listed.

**Several people in one store.** `identity.json` may hold named profiles,
`profiles: { "<name>": { identities, interaction } }`. The one in use is the
profile `CAT_HARNESS_PROFILE` names, else the store's `activeProfile`, else the
one whose identities match `CAT_HARNESS_PERSON`, else the only one. With
several profiles and nothing to choose between them, the resolver reports a
third state, `ambiguous-multi-user`, and applies the **strictest** interaction
profile on record until someone says who is typing. The same state is reported
when the session matches several people in `interaction.json` whose profiles
differ.

**A preference that must not be committed** lives in the user-level store,
`~/.config/cat-harness/identity.json` (or `$XDG_CONFIG_HOME/…`, or the path
in `CAT_HARNESS_USER_CONFIG`), under `interaction`. It is per machine and
never in the repository. The sweep prints it, marked as not committed.

## 4. Asking a question well

§4.1 is what the question has to *contain*; §4.2 is what shape it has to
*take*. A question can pass every item in §4.2 and still be unanswerable,
because none of those say what the options mean.

### 4.1 Context before the question (STRICT)

**Order matters, and it is: context → options → recommendation → question.**
Never the question first with the explanation available on request.

The test is one sentence, and it is checkable in a single pass:

> **Can the reader answer without opening anything?**

If answering needs them to open an issue, a file, a diff or a scrollback, the
question is not ready. A link is where somebody goes for *more*; it is never
where the terms are defined.

**And when a link IS the right thing — a rendered page the reader has to see
for themselves — it points at the page, not at the site it is on.** The rule
and where the page list comes from:
[`feedback-deep-links`](../../authoring/content-lifecycle/feedback-deep-links.md); the failure it also
hides: [`continual-progress`](continual-progress.md) §"Link the PAGE, never the
site root".

Six parts, in order:

1. **What is being decided**, in plain words — stated as what will *differ*
   depending on the answer, not as the name of the decision.
2. **Every identifier expanded on first use.** A work item id, an option name you
   coined, a field, a Lean declaration, a file path: all opaque without their
   gloss, above all an option name you coined yourself, because it *feels*
   defined to you.
3. **The options, compared** — what each does, its pro, its con, what it
   changes **downstream**, and how reversible it is. Laid out here, in the
   prose, where the rows can be read against each other; a selection tool shows
   one option at a time, so trade-offs written into its labels are not a
   comparison. [`decision-comparison`](decision-comparison.md) carries the
   columns, why cost and downstream impact are different things, and when a
   decision is too small to deserve a table.
4. **Your recommendation, and why**, stated first and marked. See §4.2.
5. **What happens if they say nothing.** Then do that.
6. **The question itself**, last.

**This binds every place a decision is handed to the person**, not only an
explicit question tool: the end-of-turn "next" line, a work item's `## Done when`, a
PR body asking the author to choose, a comment on an issue. Those are where it
is most often broken, because they feel like reporting rather than asking.
A PR body as a whole, not only its question, is governed by
`pr-description`.

#### The prose does not travel — the question object must stand alone (STRICT)

The six parts above assume the reader is **in the conversation**, reading the
prose that precedes the question. Often they are not. A question asked by a
background session, a cloud session, a subagent or a scheduled run reaches the
person through a channel that carries **only the structured fields** — the
question text, the option labels, the option descriptions. Everything written
around the call stays in a transcript the person would have to go and open.

The asker's analysis stays in its own transcript, and a relay has to
reconstruct it. So the test grows one clause:

> **Can the reader answer without opening anything — including the session that
> asked?**

**Put in the structured fields everything needed to choose:**

| field | carries |
|---|---|
| the question | what will **differ** depending on the answer, with every identifier expanded. Never a bare noun phrase — *"`kupb` scope"* is a topic, not a question. |
| each option's description | that option's own consequence and **how reversible** it is. A reader comparing two options must be able to do it from the two descriptions alone. |
| **one** option's description | **what happens if they say nothing**, marked as the default and phrased as what you will then do. |

**The comparison table still belongs in the prose**, where rows can be read
against each other, but **nothing may be load-bearing *only* in the prose**.

Two things this rules out:

- **A question whose context sits in the paragraph above the call.** Correct in
  a live conversation, invisible through a relay.
- **An option label carrying the trade-off and a description carrying nothing**
  — or the reverse. A label is a handle; the description is the argument.

#### The question goes in the chat too — both, every time (STRICT)

The rule above makes the **structured fields** stand alone. This is its mirror:
the **chat** must stand alone as well. Every question handed to the person is
written **in the chat, as text** — the question, the numbered options, the
recommendation and what happens with no answer — **and** asked through the
selection tool. Neither copy may depend on the other.

A question asked only in the selection tool vanishes with one stray tap; for
a person with limited hand function a stray tap is the ordinary case.

**A dismissal is not an answer.** The tool reports a dismissed box as "do not
proceed", and the right move is exactly that: proceed on nothing. The question
stays open in the chat text, and the next turn re-asks it through the selection
tool when the person indicates it was accidental — never treat the dismissal as
a choice of any option, including the default. (The stated default governs
**silence** over time, not a dismissal.)

Two things this rules out:

- **A question that exists only inside the selection tool.** One dismissal, one
  connection drop or one client that does not render the box, and the decision
  is gone with no trace in the conversation.
- **A chat that says "see the question below".** A pointer to the box is not
  the question; if the box goes, the pointer points at nothing.

And when you are the one **relaying** somebody else's blocked question: say
that you are relaying, and say where the answer has to be given. An answer
typed at the relay does not reach the asker. The reverse direction, a
sibling getting its question to the agent that is talking with the person, and
the answer back, is [`hand-back-to-discussion`](hand-back-to-discussion.md).

#### Worked example

Unanswerable — every content word is undefined, no option has a cost, and
there is no recommendation:

> **next** — cross-agent skill install + prefix. I'd want your call on
> prefix-at-rest vs prefix-at-install before writing anything.

The same decision, askable:

> **Next up is installing this platform's skills into whichever agent is
> running** (Claude Code, Gemini CLI, Cursor), so each one can load them.
> Skills would get an `fa-` prefix so their names cannot collide with the host
> agent's own commands: `/fa-beans-tui` rather than `/beans-tui`.
>
> One decision shapes everything else — **where the prefix gets applied:**
>
> 1. **When a skill is installed into an agent** *(recommended)* — files in this
>    repo keep their plain names, and the prefix is added as they are emitted.
>    Nothing here has to change.
> 2. **In this repository itself** — rename every skill file. That touches the
>    package manifests, every skill ref in the BPMN diagrams, two doc
>    generators and every cross-reference between skill bodies, and is painful
>    to reverse.
>
> Say nothing and I will take (1) when I start.

#### A pending question is not a STATUS — ask it (STRICT)

**"Stream 3 is blocked on four questions" is not a report. It is a question you
declined to ask.** Naming a block, linking to where it lives and summarising it
still leaves the person unable to answer with a click.

**Whoever can put the question to the person owns asking it.** A question
does not "belong to" the session that blocked on it: if you can act on the
answer — and an agent with repository access usually can — ask it. If you
truly cannot act, ask anyway and carry the answer back.

**Pointing somewhere is the failure mode, not the fix.** *"Answer it in that
session"* moves the whole cost of the decision onto the person. Reserve it for
what genuinely cannot be done from here, and say plainly that it cannot.

**When several are pending**, ask the most consequential in full and give a
count for the rest — never *"which question would you like me to ask?"*.
§"More than one decision pending" below carries that rule.

#### More than one decision pending — ask ONE, count the rest

The six parts above are per decision. When several are open, stating all in
full is a wall, and naming them compactly is a teaser.

**Ask the one that is actually next, in full. For the others, give a COUNT and
no option names.**

> Two other decisions are waiting; I will put each properly when it is next.

A count says work is queued without inviting an answer to a question whose
terms the reader cannot see.

**There is no "just listing what's open" exemption.** A wrap-up that names a
decision has handed it over, whatever the framing sentence says. Either the
options and their costs are there, or the name comes out and a count goes in.

#### Enforced, not remembered — the layers

**A rule that depends on being remembered is not enforced.** So:

| layer | what it does | what it cannot do |
|---|---|---|
| `.claude/skills/interaction-modality/` | makes this skill **offerable by name** | triggering is probabilistic; it helps an agent already thinking about asking well |
| `PreToolUse` on `AskUserQuestion` → `scripts/ask-well.sh` | prints the six parts at the one moment the rule certainly applies, on every agent and every session | it sees the tool call, not the prose written before it, so it REMINDS and never blocks — a gate that cannot tell must not refuse |
| `schemas/process/decision-request.ts` | makes the comparison **unomittable**: no optionals, so a decision with two options and one comparison does not parse, and `renderDecision` emits the prose table and the selection from ONE object so they cannot drift | it cannot tell a good `con` from a lazy one, and does not try — it checks that the question was asked, never that the answer is honest |
| `Stop` → `scripts/decisions-named-not-asked.ts` | reads the turn that just ENDED and names the paragraph that handed decisions over bare (e.g. a closing list of open item ids) — the one path the layers keyed on a question tool cannot see | it reads prose, so it is a heuristic; it reminds and never blocks, and a paragraph that happens to carry a comparison suppresses it |

None of these is sufficient on its own.
`bun test cat-harness-tools/scripts/tests/decision-request.test.ts` asserts each
refusal, and the `Stop` hook's fixtures are real turns rather than invented
strings.

##### The posture, and the condition that revisits it

**The hook reminds; it does not gate.** A gate that refused a well-formed
question because the schema turned out too narrow would cost the person the
one channel they use to correct an agent. So:

1. **The hook reminds.** It never blocks, and a question always reaches the
   person, well-formed or not.
2. **`renderDecision` is the house style** for any decision with more than two
   options, or any decision whose options differ in cost rather than only in
   kind. Write the object, render the prose, then offer the selection.
3. **Gating is revisited on EVIDENCE, not on a date.**

> **The condition: twelve RENDERED decision records.** `bun run cat health` reports
> **`bean-rendered-decision-records`** — work items whose decision actually went
> through {@link renderDecision}, detected from the five-row table it emits. At
> twelve, a person can read them and judge whether the schema fits the
> decisions this repository actually has. An `## Options` heading is NOT a
> rendered decision, because work items carry considered-options sections as
> ordinary practice, so their count grows without anyone using the schema.

The counter is a **health metric over `beans/`**, not a second store, because
a parallel store of decision objects would be a count free to disagree with the
work item store's. The
record goes in the **work item it belongs to**, under `## Options`, where `madr.md`'s
two-option floor and `bean-thin-decision-records` govern it; `renderDecision`
composes the chat message.

**The unit is WORK ITEMS, not decisions**: `hasRenderedDecision` is a per-bean
boolean, so twelve means twelve different work items. The unit is not changed,
because moving it without moving the number is a silent re-calibration.

**A deferral with no trigger is not a deferral**: it is indistinguishable a
month later from a decision nobody made.

### 4.2 Form — the checklist

Before any question, all five:

- [ ] **Could this be a selection?** If the answer set is finite, make it one.
- [ ] **Is there a recommended option, and is it first and marked?** A user who
      does not want to decide should be able to pick the first thing and be
      right.
- [ ] **Is it four options or fewer?** Beyond that, split the question.
- [ ] **Does no answer have a safe meaning?** Say what you will do if they say
      nothing, then do that. Silence must never block the work.
- [ ] **Is it blocking at all?** Do everything that does not depend on the
      answer first, and ask at the point where the answer is actually needed.

And the negative rule: **do not ask a question whose answer you could look up.**
Every fact `getting-started` reads from the filesystem is a question not asked.
This is the largest accessibility win available, and it is invisible.

### 4.3 After the answer — a ruling is a skill edit, not just an applied answer

The asking is half the loop. The answer comes back, and if it settles how a
*kind* of thing is decided rather than only this one, it is a rule and it is
written into the skill that governs it **in the same turn**: the rule and its
reason in the narrative, the quote and date in the skill's provenance log.
Otherwise the next session asks again.

**The rule, the three questions that identify a rule-level answer, and why it
needs no permission**: [`symbiotic-interaction`](symbiotic-interaction.md) §2.
It applies to any author correction, not only to answers to questions asked
here.

## 5. Driving the questions from DMN — one logic, four surfaces

Guided questions driven by DMN logic, across modalities, are two separable
things:

**What to ask next** is a decision. It belongs in a DMN table alongside
`folio-intent.dmn`: inputs are the facts known so far, output is the next
question's id (or `none`, when enough is known). It is authored by whoever owns
the process, is reviewable as a table, and is the same for every user.

**How to render the question** is the modality. Options as a numbered list in
chat, as spoken alternatives one at a time over audio, as large-type radio
buttons on the site. The DMN table never learns about any of this.

```
 facts ──▶ [ next-question.dmn ] ──▶ question id ──▶ renderer(profile) ──▶ user
   ▲                                                                        │
   └──────────────────── answer recorded as a new fact ─────────────────────┘
```

Four properties over an agent improvising the interview:

1. **The question set is finite and reviewable.** You can read the table and
   know every question the agent can ask.
2. **It terminates.** A table whose output can be `none` has a stopping
   condition; an improvising agent does not.
3. **Asking becomes obligatory rather than optional.** This is the trick
   `folio-intent.dmn` already uses: `ask` is an *outcome of the table*, so the
   agent cannot route past it; an agent that decides for itself whether to ask
   will, under pressure to be helpful, decide not to.
4. **A question skipped is auditable.** The facts are recorded; you can replay
   the table and see which rule fired.

The limits, stated so nobody is surprised: the FEEL subset this repo implements
covers equality, comparison and one-of — no ranges, no `not()`, no function
calls (`src/workflow/decision-table.ts`). A genuinely open question — "what is
this paper about?" — is not a decision and does not belong in a table. And
conversation is not a wizard: a user must always be able to say something the
table did not anticipate, which is what option 5 of the intent question is for.

## 6. Grounding — what this follows

The rules above are the subset of published accessibility guidance that a
*conversational agent* can actually keep. Named so they can be checked rather
than taken on trust:

- **WCAG 2.2 AA** is the baseline for anything rendered — the docs site, the
  viewer, a generated PDF. The success criteria that bite hardest here:
  1.4.4 Resize text (200 % without loss), 1.4.3 Contrast, 1.4.1 Use of Colour
  (never colour alone), 2.4.7 Focus Visible, 3.3.2 Labels or Instructions.
- **WCAG 2.2's newer criteria are the dexterity ones**: 2.5.7 Dragging Movements, 2.5.8 Target Size
  (Minimum) — 24 × 24 CSS px — and 3.3.7 Redundant Entry, which says do not make
  someone enter the same information twice. §3's committed preferences file is
  3.3.7 applied to a conversation.
- **Cognitive accessibility (WCAG 3.1, and W3C's COGA guidance)** is what §4's
  "four options or fewer" and plain-language profile come from.
- **EN 301 549** is the procurement standard that makes WCAG AA a legal
  requirement in EU public-sector contexts; Section 508 does the same in the US.
  Folios published for public-sector use land in those contexts.
- **Authoring Tool Accessibility Guidelines (ATAG 2.0)** is the one most often
  missed: it covers tools that *produce* content, which is what this platform
  is. Part A is the tool being usable; Part B is the tool helping the author
  produce accessible output. The alt-text and heading-order checks a folio's QA
  sweep should carry are Part B.

## 7. The settings surface

The published site carries a settings control (gear, top right) writing the same
four profiles to `localStorage`, so a reader who is not the author still gets
large type or reduced motion. It is per-viewer and per-browser by construction —
it never reaches an agent. `cat-harness/memory/interaction.json` is the
agent-facing record and the site control is the reader-facing one; keep them
separate.

## 8. Anti-patterns

0. **The question first, the context on request** (§4.1), typically in the
   private vocabulary the agent built while working. "Happy to explain if
   useful" does not repair it.
1. **Asking someone to describe their disability.** Ask about the interface.
2. **Re-asking what `cat-harness/memory/interaction.json` records** (WCAG
   3.3.7).
3. **A "quick open question" because the option list felt like overkill.** The
   list is cheaper for the person answering.
4. **Blocking on an answer with no default.** State the default, act on it.
5. **Treating an inferred profile as a diagnosis.** It is a rendering choice,
   labelled `inferred from behaviour`, and the user overrules it.
6. **Accessibility as a rendering concern only.** The largest win is §4's last
   rule — not asking at all — and no stylesheet delivers it.
